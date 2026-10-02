const test = require('node:test');
const assert = require('node:assert/strict');
const memoryStorage = () => {
    const values = new Map();
    return { get length() { return values.size; }, key: i => [...values.keys()][i],
        getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
};
async function fixture() {
    const { createBehaviorRecoveryStore } = await import('../../client/src/features/city/scene/behaviorRecoveryStore.js');
    const storage = memoryStorage();
    let id = 0;
    return { storage, create: session => createBehaviorRecoveryStore({ storageKey: 'room', storage, session, makeId: () => String(++id) }) };
}
const pending = version => ({ tree: { version }, revision: 1, meta: {} });

test('a successful tab never removes another tab failure, including reload and tab duplication', async () => {
    const { storage, create } = await fixture();
    const sessionA = memoryStorage(), sessionB = memoryStorage();
    const a = create(sessionA), b = create(sessionB);
    a.remember(pending(2)); b.remember(pending(3)); a.remember(null);
    assert.equal(create(sessionB).load().tree.version, 3);
    const duplicateSession = memoryStorage();
    duplicateSession.setItem('room.pending-sync-pointer', sessionB.getItem('room.pending-sync-pointer'));
    const duplicate = create(duplicateSession);
    assert.equal(duplicate.load().tree.version, 3);
    duplicate.remember(pending(4));
    b.remember(pending(5));
    duplicate.remember(null);
    assert.equal(create(sessionB).load().tree.version, 5);
    assert.equal(create(memoryStorage()).load().tree.version, 5, 'Closed tab journal is still recoverable');
    b.remember(null);
    assert.equal(storage.length, 0);
});

test('retries across remounts clean only acknowledged generations and migrate legacy pending data', async () => {
    const { storage, create } = await fixture();
    const session = memoryStorage();
    storage.setItem('room.pending-sync', JSON.stringify(pending(8)));
    const first = create(session);
    assert.equal(first.load().tree.version, 8);
    first.remember(pending(8));
    // The legacy copy must not reappear after a reload and successful retry.
    const second = create(session);
    assert.equal(second.load().tree.version, 8);
    second.remember(pending(8));
    second.remember(null);
    assert.equal(create(session).load(), null);
});

test('explicit server reload keeps independent backups from multiple tabs', async () => {
    const { storage, create } = await fixture();
    create(memoryStorage()).backup({ version: 7 });
    create(memoryStorage()).backup({ version: 9 });
    const versions = Array.from({ length: storage.length }, (_, i) => storage.key(i))
        .filter(key => key.startsWith('room.unsynced-backup/')).map(key => JSON.parse(storage.getItem(key)).version);
    assert.deepEqual(versions, [7, 9]);
});

test('discarding a duplicated tab copy cannot discard the original tab edit on reload', async () => {
    const { create } = await fixture();
    const originalSession = memoryStorage();
    const original = create(originalSession);
    original.remember(pending(12));
    const copiedSession = memoryStorage();
    for (let i = 0; i < originalSession.length; i++) {
        const key = originalSession.key(i);
        copiedSession.setItem(key, originalSession.getItem(key));
    }
    const copy = create(copiedSession);
    assert.equal(copy.load().tree.version, 12);
    copy.backup({ version: 12 });
    copy.remember(null); // The copied tab explicitly chooses the server version.
    assert.equal(create(copiedSession).load(), null);
    assert.equal(create(originalSession).load().tree.version, 12);
});
