const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createRestoreService } = require('../features/backup/restoreService');

function fixture(t, failure = '') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-restore-test-'));
    const live = path.join(root, 'live.db'),
        incoming = path.join(root, 'incoming.db');
    function seed(file, name) {
        const db = new Database(file);
        db.exec(
            'CREATE TABLE characters(id TEXT, name TEXT); CREATE TABLE messages(id INTEGER, character_id TEXT, role TEXT, content TEXT)',
        );
        db.prepare('INSERT INTO characters VALUES (?,?)').run('role', name);
        db.close();
    }
    seed(live, 'Original');
    seed(incoming, 'Imported');
    const uploadsDir = path.join(root, 'uploads'),
        uploadSource = path.join(root, 'archive-uploads');
    const target = path.join(uploadsDir, 'users', 'u', 'avatar.png');
    const replacement = path.join(uploadSource, 'users', 'archive-user', 'avatar.png');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'original image');
    fs.mkdirSync(path.dirname(replacement), { recursive: true });
    fs.writeFileSync(replacement, 'replacement image');
    const handles = new Set(),
        userDbCache = new Map(),
        events = [];
    let maintenance = false,
        injected = false;
    const engine = {
        isBusy: () => failure === 'busy',
        stopAllTimers: () => events.push('stop'),
        startEngine: () => events.push('restart'),
        startGroupProactiveTimers() {},
    };
    const dependencies = {
        uploadsDir,
        userDbCache,
        engineCache: new Map([['u', engine]]),
        getBackgroundQueueStats: () => ({ queues: [] }),
        beginUserDbMaintenance() {
            assert.equal(maintenance, false);
            maintenance = true;
            return () => {
                maintenance = false;
            };
        },
        closeSchedulerDb: () => events.push('close scheduler'),
        clearMemoryCache() {},
        getWsClients: () => new Set(),
        getEngine: () => engine,
        getMemory: () => ({
            wipeIndex: async () => events.push('wipe index'),
            rebuildIndex: async () => {
                if (failure === 'index') throw new Error('embedding unavailable');
                events.push('rebuild');
            },
        }),
        getUserDb(userId, options = {}) {
            assert.ok(!maintenance || options.maintenance, 'Only restore internals may reopen during maintenance');
            if (userDbCache.has(userId)) return userDbCache.get(userId);
            if (failure === 'open' && !injected) {
                injected = true;
                throw new Error('migration failed');
            }
            const raw = new Database(live);
            handles.add(raw);
            const db = {
                getCharacters: () => raw.prepare('SELECT * FROM characters').all(),
                getDbPath: () => live,
                close() {
                    if (raw.open) raw.close();
                },
                async backup(file) {
                    if (failure === 'backup') throw new Error('backup failed');
                    await raw.backup(file);
                },
            };
            userDbCache.set(userId, db);
            return db;
        },
    };
    // Open the existing database before injecting the replacement-open failure.
    const mode = failure;
    failure = failure === 'open' ? '' : failure;
    const db = dependencies.getUserDb('u');
    failure = mode;
    const io = new Proxy(fs, {
        get(object, key) {
            if (key === 'renameSync')
                return (from, to) => {
                    if (failure === 'rollback' && to === live) throw new Error('disk remains unavailable');
                    if (failure === 'install' && path.basename(from) === 'incoming.db' && to === live && !injected) {
                        injected = true;
                        throw new Error('install failed');
                    }
                    return fs.renameSync(from, to);
                };
            if (key === 'copyFileSync')
                return (from, to) => {
                    if (failure === 'upload' && from === replacement && to === target && !injected) {
                        injected = true;
                        fs.writeFileSync(to, 'partial');
                        throw new Error('upload copy failed');
                    }
                    return fs.copyFileSync(from, to);
                };
            return object[key];
        },
    });
    t.after(() => {
        for (const handle of handles) if (handle.open) handle.close();
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('chatpulse-restore-test-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    const restore = createRestoreService(dependencies, io);
    return {
        restore: () => restore({ userId: 'u', db, sourcePath: incoming, uploadsPath: uploadSource }),
        dependencies,
        incoming,
        events,
        target,
        root,
        get maintenance() {
            return maintenance;
        },
        name: () => dependencies.getUserDb('u').getCharacters()[0].name,
    };
}

for (const mode of ['backup', 'install', 'upload', 'open']) {
    test(`restore ${mode} failure preserves the old database, uploads and workers`, async (t) => {
        const f = fixture(t, mode);
        await assert.rejects(f.restore());
        assert.equal(f.name(), 'Original');
        assert.equal(fs.readFileSync(f.target, 'utf8'), 'original image');
        assert.equal(f.maintenance, false);
        assert.ok(f.events.includes('restart'));
        assert.equal(f.events.includes('wipe index'), false, 'Index remains untouched before a successful switch');
        assert.equal(
            fs.readdirSync(f.root).some((name) => name.startsWith('.restore-')),
            false,
        );
    });
}

test('invalid archives do not stop workers or change data', async (t) => {
    const f = fixture(t);
    fs.writeFileSync(f.incoming, 'SQLite format 3 fake header');
    await assert.rejects(f.restore(), { statusCode: 400 });
    assert.equal(f.name(), 'Original');
    assert.deepEqual(f.events, []);
    assert.equal(f.maintenance, false);
});

test('restore waits for active work instead of closing an in-use database', async (t) => {
    const f = fixture(t, 'busy');
    await assert.rejects(f.restore(), { statusCode: 409 });
    assert.equal(f.name(), 'Original');
    assert.deepEqual(f.events, []);
});

test('successful restore reports index failures as recoverable warnings', async (t) => {
    const f = fixture(t, 'index');
    const result = await f.restore();
    assert.equal(result.success, true);
    assert.equal(f.name(), 'Imported');
    assert.equal(fs.readFileSync(f.target, 'utf8'), 'replacement image');
    assert.equal(result.rebuiltMemoryIndexes, 0);
    assert.equal(result.warnings[0].stage, 'rebuild_index');
    assert.ok(f.events.includes('restart'));
    assert.equal(f.maintenance, false);
});

test('a failed rollback retains recovery files and blocks requests from creating an empty database', async (t) => {
    const f = fixture(t, 'rollback');
    await assert.rejects(f.restore(), /Recovery files have been retained/);
    assert.equal(f.maintenance, true);
    assert.equal(f.events.includes('restart'), false);
    const recovery = fs.readdirSync(f.root).find((name) => name.startsWith('.restore-'));
    assert.ok(recovery);
    const snapshot = new Database(path.join(f.root, recovery, 'snapshot.db'), { readonly: true });
    try {
        assert.equal(snapshot.prepare('SELECT name FROM characters').get().name, 'Original');
    } finally {
        snapshot.close();
    }
    assert.ok(fs.existsSync(path.join(f.root, recovery, 'original.db')));
});
