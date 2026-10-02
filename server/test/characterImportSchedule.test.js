const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { importCharacterArchive } = require('../features/backup/characterImportService');

function fixture(t, options = {}) {
    const rawDb = new Database(':memory:');
    rawDb.exec(`CREATE TABLE characters(id TEXT PRIMARY KEY, name TEXT, status TEXT, sys_proactive INTEGER,
        sys_timer INTEGER, interval_min REAL, interval_max REAL, is_blocked INTEGER);
        INSERT INTO characters VALUES('role','Role','active',1,1,1,1,0);
        CREATE TABLE messages(content TEXT); INSERT INTO messages VALUES('original');`);
    const db = {
        getCharacter: id => rawDb.prepare('SELECT * FROM characters WHERE id = ?').get(id),
        updateCharacter(id, patch) {
            const char = { ...this.getCharacter(id), ...patch };
            rawDb.prepare('UPDATE characters SET status = ?, sys_proactive = ?, interval_min = ?, interval_max = ?, is_blocked = ? WHERE id = ?')
                .run(char.status, char.sys_proactive, char.interval_min, char.interval_max, char.is_blocked, id);
        },
    };
    const timers = new Map();
    const engine = require('../features/private-chat/scheduling').createModule({
        timers, groupProactiveTimers: new Map(), db, PRIVATE_AUTONOMY_DISABLED: options.disabled,
        broadcastEngineState() {}, queueEngineTask() { throw new Error('Unexpected timer execution in fixture'); },
    });
    t.after(() => { engine.stopAllTimers(); rawDb.close(); });
    const args = {
        db, rawDb, engine, wsClients: [], characterId: 'role',
        payload: { character: { interval_min: 3, interval_max: 3 } }, includeCharacter: true, replace: true,
        clearCharacterArchiveData: () => rawDb.exec('DELETE FROM messages'), runArchiveCleanup() {},
        importCharacterArchiveRows() { rawDb.exec("INSERT INTO messages VALUES('imported')"); return { messages: 1 }; },
        memory: { rebuildIndex: async () => {} },
    };
    return { rawDb, db, engine, timers, args };
}

test('successful imports schedule from the new settings, after index work completes', async t => {
    const f = fixture(t);
    f.engine.scheduleNext(f.db.getCharacter('role'), []);
    let release;
    f.args.memory.rebuildIndex = () => new Promise(resolve => { release = resolve; });
    const work = importCharacterArchive(f.args);
    assert.equal(f.timers.size, 0);
    assert.throws(() => f.engine.suspendCharacterSchedule('role', []), { status: 409 });
    f.engine.scheduleNext(f.db.getCharacter('role'), []);
    assert.equal(f.timers.size, 0, 'Scheduling cannot restart a suspended role');
    release();
    await work;
    const remaining = f.timers.get('role').targetTime - Date.now();
    assert.ok(remaining > 179000 && remaining <= 180000);
    assert.equal(f.timers.get('role').isSelfScheduled, false);
});

for (const selfScheduled of [false, true]) {
    test(`failed imports restore the original ${selfScheduled ? 'self-scheduled' : 'proactive'} timer and database`, async t => {
        const f = fixture(t);
        f.engine.scheduleNext(f.db.getCharacter('role'), [], selfScheduled ? 90000 : null);
        const original = f.timers.get('role');
        f.args.payload.character.sys_proactive = 0;
        f.args.importCharacterArchiveRows = () => { throw new Error('injected import failure'); };
        await assert.rejects(importCharacterArchive(f.args), /injected import failure/);
        assert.equal(f.timers.get('role').targetTime, original.targetTime);
        assert.equal(f.timers.get('role').isSelfScheduled, selfScheduled);
        assert.equal(f.db.getCharacter('role').sys_proactive, 1);
        assert.equal(f.rawDb.prepare('SELECT content FROM messages').get().content, 'original');
    });
}

test('an index failure after commit returns a warning and still resumes scheduling', async t => {
    const f = fixture(t);
    f.args.memory.rebuildIndex = async () => { throw new Error('injected index failure'); };
    const result = await importCharacterArchive(f.args);
    assert.equal(result.rebuiltMemoryIndex, false);
    assert.equal(result.rebuildWarning, 'injected index failure');
    assert.equal(f.timers.size, 1);
    assert.equal(f.rawDb.prepare('SELECT content FROM messages').get().content, 'imported');
});

test('disabled, blocked and inactive imported roles stay silent', async t => {
    for (const patch of [{ sys_proactive: 0 }, { status: 'inactive' }, { is_blocked: 1 }]) {
        const f = fixture(t);
        f.engine.scheduleNext(f.db.getCharacter('role'), []);
        f.args.payload.character = patch;
        await importCharacterArchive(f.args);
        assert.equal(f.timers.size, 0);
    }
    const disabled = fixture(t, { disabled: true });
    await importCharacterArchive(disabled.args);
    assert.equal(disabled.timers.size, 0);
});

test('failed import without a previous timer does not invent a new timer', async t => {
    const f = fixture(t);
    f.args.importCharacterArchiveRows = () => { throw new Error('injected failure'); };
    await assert.rejects(importCharacterArchive(f.args), /injected failure/);
    assert.equal(f.timers.size, 0);
});

test('shutdown cancels an import schedule lease so its completion cannot restart timers', async t => {
    const f = fixture(t);
    const resume = f.engine.suspendCharacterSchedule('role', []);
    f.engine.stopAllTimers();
    resume({ committed: true });
    assert.equal(f.timers.size, 0);
});

test('busy engine rejects import before changing the database or existing timer', async t => {
    const f = fixture(t);
    f.engine.scheduleNext(f.db.getCharacter('role'), []);
    const original = f.timers.get('role');
    f.engine.isBusy = () => true;
    await assert.rejects(importCharacterArchive(f.args), { status: 409 });
    assert.equal(f.timers.get('role'), original);
    assert.equal(f.rawDb.prepare('SELECT content FROM messages').get().content, 'original');
});
