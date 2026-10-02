const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-import-test-'));
process.env.CHATPULSE_DATA_DIR = dataDir;
const { getUserDb, userDbCache } = require('../platform/db/userDatabase');
const { createModule } = require('../features/memory/operations/persistence');
const db = getUserDb('import-fixture');
const sql = db.getRawDb();
let failIndex = false, resets = 0;
const memory = createModule({
    getDb: () => db,
    normalizeMemoryPayload: value => ({ ...value, dedupe_key: value.content }),
    isRoutineCityMemory: () => false, computeMemoryRetrievalWeight: () => 1,
    buildMemoryEmbeddingText: value => value.content,
    getEmbedding: async () => { throw new Error('Embedding unavailable in fixture'); },
    hasNewLibrarySummary: () => false, canUseQdrant: async () => false,
    LOCAL_VECTOR_INDEX_ENABLED: false,
    wipeIndex: async () => { resets++; if (failIndex) throw new Error('Index unavailable'); }
});
const entry = content => ({ content, summary: content });
const contents = () => db.getMemories('fixture-character').map(row => row.content).sort();

test.beforeEach(() => {
    sql.exec('DROP TRIGGER IF EXISTS fail_import_insert');
    db.updateCharacter('fixture-character', { name: 'Import test' });
    db.clearMemories('fixture-character');
    db.addMemory('fixture-character', entry('old memory'));
    failIndex = false; resets = 0;
});
test.after(() => {
    for (const value of userDbCache.values()) value.getRawDb().close();
    userDbCache.clear();
    const target = path.resolve(dataDir);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('chatpulse-import-test-'));
    fs.rmSync(target, { recursive: true, force: true });
});

test('replace import rolls back the deletion and earlier inserts when a later write fails', async () => {
    sql.exec(`CREATE TRIGGER fail_import_insert BEFORE INSERT ON memories
        WHEN NEW.content = 'reject this row' BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END`);
    await assert.rejects(memory.importMemories('fixture-character', [entry('first new row'), entry('reject this row')], { replace: true }), /simulated write failure/);
    assert.deepEqual(contents(), ['old memory']);
    assert.equal(resets, 0, 'Never clear an index for a rolled-back import');
});

test('replace import commits all rows and succeeds without an embedding provider', async () => {
    const result = await memory.importMemories('fixture-character', [entry('new one'), entry('new two')], { replace: true });
    assert.equal(result.ids.length, 2);
    assert.deepEqual(contents(), ['new one', 'new two']);
    assert.equal(resets, 1);
});

test('merge imports preserve old rows and deduplicate a repeated import', async () => {
    await memory.importMemories('fixture-character', [entry('new memory')]);
    await memory.importMemories('fixture-character', [entry('new memory')]);
    assert.deepEqual(contents(), ['new memory', 'old memory']);
    assert.equal(resets, 0);
});

test('index failure after commit reports a warning and preserves the saved data', async () => {
    failIndex = true;
    const result = await memory.importMemories('fixture-character', [entry('saved despite index outage')], { replace: true });
    assert.equal(result.ids.length, 1);
    assert.equal(result.warnings[0].stage, 'index-reset');
    assert.deepEqual(contents(), ['saved despite index outage']);
});
