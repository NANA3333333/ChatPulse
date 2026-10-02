const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');
const { once } = require('node:events');

test(
    'HTTP archive export/restore replaces data and rejects a fake SQLite header without damaging the restored account',
    { timeout: 60000 },
    async () => {
        const child = fork(path.resolve(__dirname, '../../tests/e2e/fixture.cjs'), [], {
            silent: true,
            windowsHide: true,
        });
        child.stdout.on('data', () => {});
        child.stderr.on('data', () => {});
        let info;
        try {
            info = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Fixture timeout')), 20000);
                child.once('message', (value) => {
                    clearTimeout(timer);
                    resolve(value);
                });
                child.once('error', (error) => {
                    clearTimeout(timer);
                    reject(error);
                });
                child.once('exit', (code) => {
                    clearTimeout(timer);
                    reject(new Error(`Fixture exited ${code}`));
                });
            });
            const login = await fetch(info.baseUrl + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'Nana', password: 'E2E-fixture-password-428' }),
            }).then((r) => r.json());
            const headers = { Authorization: `Bearer ${login.token}` };
            const create = (id) =>
                fetch(info.baseUrl + '/api/characters', {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, name: id, is_blocked: 1, sys_proactive: 0, sys_timer: 0 }),
                });
            assert.equal((await create('archived-role')).status, 200);
            const characterArchive = await fetch(info.baseUrl + '/api/data/archived-role/export', { headers }).then(r => r.json());
            const characterImport = await fetch(info.baseUrl + '/api/data/archived-role/import?mode=merge', {
                method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(characterArchive),
            });
            const characterResult = await characterImport.json();
            assert.equal(characterImport.status, 200, JSON.stringify(characterResult));
            assert.equal(characterResult.success, true);
            const exported = await fetch(info.baseUrl + '/api/system/export', { headers });
            assert.equal(exported.status, 200);
            const bytes = await exported.arrayBuffer();
            assert.equal((await create('later-role')).status, 200);
            const form = new FormData();
            form.append('db_file', new Blob([bytes], { type: 'application/zip' }), 'archive.zip');
            const restored = await fetch(info.baseUrl + '/api/system/import', { method: 'POST', headers, body: form });
            const result = await restored.json();
            assert.equal(restored.status, 200, JSON.stringify(result));
            assert.equal(result.success, true);
            const roles = await fetch(info.baseUrl + '/api/characters', { headers }).then((r) => r.json());
            assert.ok(roles.some((role) => role.id === 'archived-role'));
            assert.ok(!roles.some((role) => role.id === 'later-role'));
            const invalid = new FormData();
            invalid.append('db_file', new Blob(['SQLite format 3' + '\0'.repeat(150)]), 'bad.db');
            const rejected = await fetch(info.baseUrl + '/api/system/import', {
                method: 'POST',
                headers,
                body: invalid,
            });
            assert.equal(rejected.status, 400);
            const after = await fetch(info.baseUrl + '/api/characters', { headers }).then((r) => r.json());
            assert.deepEqual(
                after.map((role) => role.id),
                roles.map((role) => role.id),
            );
        } finally {
            if (child.exitCode === null) {
                const exited = once(child, 'exit');
                if (child.connected) child.send('close');
                else child.kill();
                const timer = setTimeout(() => child.kill(), 5000);
                await exited;
                clearTimeout(timer);
            }
            if (info) {
                const target = path.resolve(info.dataDir);
                assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
                assert.ok(path.basename(target).startsWith('chatpulse-e2e-'));
                fs.rmSync(target, { recursive: true, force: true });
            }
        }
    },
);
