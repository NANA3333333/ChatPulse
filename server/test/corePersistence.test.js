const test = require('node:test');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('character, profile, group, messages and imported memories survive a full process restart', { timeout: 60000 }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-e2e-persistence-'));
    let child, base, token;
    const start = async () => {
        child = fork(path.resolve(__dirname, '../../tests/e2e/fixture.cjs'), [], {
            env: { ...process.env, CHATPULSE_E2E_DATA_DIR: dataDir }, silent: true, windowsHide: true
        });
        child.stderr.on('data', () => {});
        child.stdout.on('data', () => {});
        const info = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Fixture startup timed out')), 20000);
            child.once('message', value => { clearTimeout(timeout); resolve(value); });
            child.once('error', error => { clearTimeout(timeout); reject(error); });
            child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Fixture exited before ready: ${code}`)); });
        });
        base = info.baseUrl;
    };
    const stop = async () => {
        if (!child || child.exitCode !== null) return;
        const exited = once(child, 'exit');
        child.send('close');
        const force = setTimeout(() => child.kill(), 5000);
        await exited;
        clearTimeout(force);
    };
    const request = async (route, method = 'GET', body, status = 200) => {
        const response = await fetch(base + route, { method,
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const data = await response.json();
        assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
        return data;
    };
    try {
        await start();
        token = (await request('/api/auth/login', 'POST', { username: 'Nana', password: 'E2E-fixture-password-428' })).token;
        const characterId = 'durable-character';
        await request('/api/characters', 'POST', { id: characterId, name: 'Durable role', persona: 'Saved persona', is_blocked: 1, sys_proactive: 0, sys_timer: 0 });
        await request('/api/user', 'POST', { name: 'Durable profile', bio: 'Saved bio' });
        const group = (await request('/api/groups', 'POST', { name: 'Durable group', member_ids: [characterId] })).group;
        await request(`/api/groups/${group.id}/ai-pause`, 'POST', { paused: true });
        await request(`/api/groups/${group.id}/messages`, 'POST', { content: 'Durable group message' });
        for (const content of ['  ', {}, 123]) await request(`/api/groups/${group.id}/messages`, 'POST', { content }, 400);
        await request('/api/messages', 'POST', { characterId, content: 'Durable private message' });
        const memoryPath = `/api/memories/${characterId}/import`;
        const dry = await request(memoryPath + '?dry_run=1', 'POST', { memories: ['Imported durable memory'] });
        assert.equal(dry.dryRun, true);
        assert.equal((await request(`/api/memories/${characterId}`)).length, 0);
        const imported = await request(memoryPath, 'POST', { memories: ['Imported durable memory'] });
        assert.equal(imported.imported, 1);
        await request(memoryPath, 'POST', { memories: ['valid replacement', {}] }, 400);
        assert.equal((await request(`/api/memories/${characterId}`))[0].content, 'Imported durable memory');
        await stop();
        await start();
        // The existing session remains usable with the same server secret and DB.
        const characters = await request('/api/characters');
        assert.equal(characters.find(c => c.id === characterId).persona, 'Saved persona');
        const profile = await request('/api/user');
        assert.equal(profile.name, 'Durable profile');
        assert.equal(profile.bio, 'Saved bio');
        assert.equal((await request('/api/groups')).find(g => g.id === group.id).name, 'Durable group');
        assert.equal((await request(`/api/groups/${group.id}/messages`)).filter(m => m.content === 'Durable group message').length, 1);
        assert.ok((await request(`/api/messages/${characterId}`)).some(m => m.content === 'Durable private message'));
        assert.equal((await request(`/api/memories/${characterId}`))[0].content, 'Imported durable memory');
        await request(`/api/groups/${group.id}`, 'DELETE');
        assert.ok(!(await request('/api/groups')).some(g => g.id === group.id));
        await request(`/api/characters/${characterId}`, 'DELETE');
        assert.ok(!(await request('/api/characters')).some(c => c.id === characterId));
    } finally {
        await stop();
        const target = path.resolve(dataDir);
        assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
        assert.ok(path.basename(target).startsWith('chatpulse-e2e-persistence-'));
        fs.rmSync(target, { recursive: true, force: true });
    }
});
