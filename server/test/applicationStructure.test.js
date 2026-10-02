const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

// Set fixture paths before importing modules with process-lifetime connections.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-application-test-'));
Object.assign(process.env, {
    CHATPULSE_DATA_DIR: dataDir,
    CHATPULSE_UPLOADS_DIR: path.join(dataDir, 'uploads'),
    JWT_SECRET: 'application-test-secret',
    ADMIN_PASSWORD: 'Application-fixture-428',
    CP_PRIVATE_AUTONOMY: '0',
    CP_GROUP_AUTONOMY: '0',
    QDRANT_ENABLED: '0',
    QDRANT_REQUIRED: '0',
});
const { createApplication } = require('../app');
const { featureIds } = require('../features/registry');
const { userDbCache } = require('../platform/db/userDatabase');
let application, base, token;

async function request(route, { method = 'GET', body, authenticated = true } = {}) {
    const response = await fetch(base + route, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Run-Id': 'application-fixture-run',
            ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    return { response, data };
}

test.before(async () => {
    application = createApplication({ backgroundJobs: false });
    await application.assertReady();
    application.server.listen(0, '127.0.0.1');
    await once(application.server, 'listening');
    base = `http://127.0.0.1:${application.server.address().port}`;
    const login = await request('/api/auth/login', {
        method: 'POST',
        body: {
            username: 'Nana',
            password: process.env.ADMIN_PASSWORD,
        },
    });
    assert.equal(login.response.status, 200);
    token = login.data.token;
    assert.ok(token);
});

test.after(async () => {
    if (application) await application.close();
    for (const db of userDbCache.values()) db.getRawDb().close();
    userDbCache.clear();
    // The auth repository owns a process-lifetime connection. Keep this small
    // OS-temp fixture until process exit instead of deleting an open Windows DB.
});

test('all declared features initialize before readiness succeeds', () => {
    assert.deepEqual(application.featureStatus.registered, featureIds);
    assert.deepEqual(application.featureStatus.failures, []);
});

test('feature routes, repositories and schema upgrades compose on isolated data', async () => {
    const created = await request('/api/characters', {
        method: 'POST',
        body: {
            id: 'structure-character',
            name: 'Structure fixture',
            sys_proactive: 0,
            sys_timer: 0,
        },
    });
    assert.equal(created.response.status, 200, JSON.stringify(created.data));
    for (const route of [
        '/api/user',
        '/api/characters',
        '/api/groups',
        '/api/system/announcement',
        '/api/system/background-queue',
        '/api/memory-maintenance/settings',
        '/api/city/config',
        '/api/city/districts',
        '/api/social-housing/bootstrap',
        '/api/wallet/structure-character',
        '/api/characters/structure-character/friends',
        '/api/characters/structure-character/relationships',
        '/api/scheduler/structure-character',
        '/api/admin/users',
        '/api/mcp-lab/status',
    ]) {
        const { response, data } = await request(route);
        assert.equal(response.status, 200, `${route}: ${JSON.stringify(data)}`);
        assert.equal(response.headers.get('X-Run-Id'), 'application-fixture-run', route);
    }
    const group = await request('/api/groups', {
        method: 'POST',
        body: {
            name: 'Structure group',
            member_ids: ['structure-character'],
        },
    });
    assert.equal(group.response.status, 200, JSON.stringify(group.data));
    assert.equal(group.data.group.name, 'Structure group');
});

test('memory sources resolve through the maintenance module without implicit globals', async () => {
    const db = userDbCache.values().next().value.getRawDb();
    const row = db
        .prepare(
            `INSERT INTO memories
        (character_id, event, created_at, source_message_ids_json)
        VALUES ('structure-character', '来源回归', ?, '["private:999999"]')`,
        )
        .run(Date.now());
    const { response, data } = await request(`/api/memory-source?ids=${row.lastInsertRowid}`);
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.memories[0].source_context, 'private_chat');
});

test('errors retain their feature, operation and request identifier', async () => {
    const { response, data } = await request('/api/characters', { method: 'POST', body: {} });
    assert.equal(response.status, 400);
    assert.equal(data.feature, 'characters');
    assert.equal(data.action, 'POST /api/characters');
    assert.equal(data.runId, 'application-fixture-run');
    assert.equal(data.errorCode, 'HTTP_400');
    const unauthorized = await request('/api/characters', { authenticated: false });
    assert.equal(unauthorized.response.status, 401);
    assert.equal(unauthorized.data.feature, 'characters');
});

test('existing scene rows gain a revision without losing data during repeated startup', () => {
    const facade = userDbCache.values().next().value;
    const db = facade.getRawDb();
    db.exec('ALTER TABLE pixel_behavior_tree_states DROP COLUMN revision');
    db.prepare(
        'INSERT INTO pixel_behavior_tree_states (scene_key, tree_json, meta_json, updated_at) VALUES (?, ?, ?, ?)',
    ).run('legacy-scene', '{"version":42}', '{}', 123);
    facade.initDb();
    facade.initDb();
    assert.deepEqual(
        db
            .prepare('SELECT tree_json, updated_at, revision FROM pixel_behavior_tree_states WHERE scene_key = ?')
            .get('legacy-scene'),
        { tree_json: '{"version":42}', updated_at: 123, revision: 0 },
    );
});

test('scene HTTP saves require a revision and reject one of two competing edits', async () => {
    const route = '/api/city/behavior-tree-state/concurrent-fixture';
    const missing = await request(route, { method: 'POST', body: { tree: { version: 1, nodes: {} } } });
    assert.equal(missing.response.status, 428);
    const attempts = await Promise.all(
        [1, 2].map((version) =>
            request(route, {
                method: 'POST',
                body: { tree: { version, nodes: {} }, expected_revision: 0 },
            }),
        ),
    );
    assert.deepEqual(attempts.map((item) => item.response.status).sort(), [200, 409]);
    const winner = attempts.find((item) => item.response.status === 200);
    const loaded = await request(route);
    assert.equal(loaded.data.revision, 1);
    assert.equal(loaded.data.tree.version, attempts.indexOf(winner) + 1);
});

test('disabling experiments removes diagnostics while authenticated player scenes keep working', async () => {
    const manifest = require('../../config/feature-manifest.json');
    const previous = Object.fromEntries(Object.entries(manifest.labs).map(([id, value]) => [id, value.enabled]));
    let isolated;
    try {
        for (const lab of Object.values(manifest.labs)) lab.enabled = false;
        isolated = createApplication({ backgroundJobs: false });
        await isolated.assertReady();
        isolated.server.listen(0, '127.0.0.1');
        await once(isolated.server, 'listening');
        const origin = `http://127.0.0.1:${isolated.server.address().port}`;
        for (const [method, route] of [
            ['GET', '/api/mcp-lab/status'],
            ['GET', '/api/city/characters/structure-character/behavior-models'],
            ['POST', '/api/city/characters/structure-character/behavior-input'],
        ]) {
            const response = await fetch(origin + route, { method, headers: { Authorization: `Bearer ${token}` } });
            assert.equal(response.status, 404, route);
        }
        for (const sceneKey of ['commercial_street_v2', 'pixel_cottage_room_v1']) {
            const route = `/api/city/behavior-tree-state/${sceneKey}`;
            const unauthorized = await fetch(origin + route);
            assert.equal(unauthorized.status, 401);
            assert.equal((await unauthorized.json()).feature, 'city');
            const saved = await fetch(origin + route, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tree: { version: 1, nodes: {}, memory: { boundary_test: sceneKey } },
                    expected_revision: 0,
                }),
            });
            assert.equal(saved.status, 200, await saved.text());
            const loaded = await fetch(origin + route, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(loaded.status, 200);
            assert.equal((await loaded.json()).tree.memory.boundary_test, sceneKey);
        }
        // Missing characters exercise route ownership without contacting a model provider.
        for (const action of ['behavior-base-branches', 'behavior-branch']) {
            const route = `/api/city/characters/missing-character/${action}`;
            const denied = await fetch(origin + route, { method: 'POST' });
            assert.equal(denied.status, 401);
            const response = await fetch(origin + route, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            assert.equal(response.status, 404);
            assert.equal((await response.json()).feature, 'city');
        }
        const city = await fetch(origin + '/api/city/config', { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(city.status, 200);
    } finally {
        if (isolated) await isolated.close();
        for (const [id, enabled] of Object.entries(previous)) manifest.labs[id].enabled = enabled;
    }
});
