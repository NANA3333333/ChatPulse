const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
function fixture(t) {
    const db = new Database(':memory:');
    t.after(() => db.close());
    db.exec(`CREATE TABLE user_profile(id TEXT PRIMARY KEY, wallet REAL);
        INSERT INTO user_profile VALUES('default',520);
        CREATE TABLE characters(id TEXT PRIMARY KEY, wallet REAL);
        INSERT INTO characters VALUES('alice',200),('bob',0);
        CREATE TABLE group_chats(id TEXT PRIMARY KEY);
        INSERT INTO group_chats VALUES('group');
        CREATE TABLE group_members(group_id TEXT, member_id TEXT);
        INSERT INTO group_members VALUES('group','alice'),('group','bob');`);
    for (const schema of Object.values(require('../features/economy/schema'))) db.exec(schema);
    db.exec('ALTER TABLE private_transfers ADD COLUMN refunded INTEGER DEFAULT 0');
    return { db, repo: require('../features/economy/repository').createModule({ db }) };
}
const transfer = (repo, senderId = 'user', recipientId = 'alice', amount = 100) => repo.createTransfer({
    charId: senderId === 'user' ? recipientId : senderId, senderId, recipientId, amount,
});
const balances = repo => ['user', 'alice', 'bob'].map(id => repo.getWallet(id));

test('spent claimed transfers reject refunds without changing wallets or transfer state', t => {
    const { repo } = fixture(t);
    const id = transfer(repo, 'alice', 'user');
    assert.equal(repo.claimTransfer(id, 'user').success, true);
    const spent = transfer(repo, 'user', 'bob', 620);
    repo.claimTransfer(spent, 'bob');
    const before = repo.getTransfer(id);
    assert.deepEqual(balances(repo), [0, 100, 620]);
    assert.equal(repo.refundTransfer(id, 'user').success, false);
    assert.deepEqual(repo.getTransfer(id), before);
    assert.deepEqual(balances(repo), [0, 100, 620]);
});

test('pending and claimed refunds conserve balances and cannot be applied twice', t => {
    const { repo } = fixture(t);
    const pending = transfer(repo);
    assert.equal(repo.refundTransfer(pending, 'user').success, true);
    assert.equal(repo.refundTransfer(pending, 'user').success, false);
    const claimed = transfer(repo, 'alice', 'user');
    assert.equal(repo.claimTransfer(claimed, 'user').success, true);
    assert.equal(repo.refundTransfer(claimed, 'alice').success, false, 'Sender cannot reclaim accepted money');
    assert.equal(repo.refundTransfer(claimed, 'user').success, true);
    assert.equal(repo.claimTransfer(claimed, 'user').success, false);
    assert.equal(repo.refundTransfer(claimed, 'user').success, false);
    assert.deepEqual(balances(repo), [520, 200, 0]);
});

test('failed transfer insert rolls back the debit', t => {
    const { db, repo } = fixture(t);
    db.exec("CREATE TRIGGER fail_insert BEFORE INSERT ON private_transfers BEGIN SELECT RAISE(ABORT,'injected failure'); END");
    assert.throws(() => transfer(repo), /injected failure/);
    assert.deepEqual(balances(repo), [520, 200, 0]);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM private_transfers').get().n, 0);
    db.exec('DROP TRIGGER fail_insert');
    assert.ok(transfer(repo));
    assert.deepEqual(balances(repo), [420, 200, 0]);
});

test('failed credit rolls back claimed state and permits a successful retry', t => {
    const { db, repo } = fixture(t);
    const id = transfer(repo, 'alice', 'user');
    db.exec("CREATE TRIGGER fail_credit BEFORE UPDATE ON user_profile BEGIN SELECT RAISE(ABORT,'injected failure'); END");
    assert.throws(() => repo.claimTransfer(id, 'user'), /injected failure/);
    assert.equal(repo.getTransfer(id).claimed, 0);
    assert.deepEqual(balances(repo), [520, 100, 0]);
    db.exec('DROP TRIGGER fail_credit');
    assert.equal(repo.claimTransfer(id, 'user').success, true);
    assert.deepEqual(balances(repo), [620, 100, 0]);
});

test('failed refund debit rolls back the credited sender and refund marker', t => {
    const { db, repo } = fixture(t);
    const id = transfer(repo, 'alice', 'user');
    repo.claimTransfer(id, 'user');
    const before = repo.getTransfer(id);
    db.exec("CREATE TRIGGER fail_debit BEFORE UPDATE ON user_profile BEGIN SELECT RAISE(ABORT,'injected failure'); END");
    assert.throws(() => repo.refundTransfer(id, 'user'), /injected failure/);
    assert.deepEqual(repo.getTransfer(id), before);
    assert.deepEqual(balances(repo), [620, 100, 0]);
    db.exec('DROP TRIGGER fail_debit');
    assert.equal(repo.refundTransfer(id, 'user').success, true);
    assert.deepEqual(balances(repo), [520, 200, 0]);
});

test('red packet failures also roll back debits, remaining count and claims', t => {
    const { db, repo } = fixture(t);
    const send = () => repo.createRedPacket({ groupId: 'group', senderId: 'user', type: 'fixed', totalAmount: 100, perAmount: 50, count: 2 });
    db.exec("CREATE TRIGGER fail_packet BEFORE INSERT ON group_red_packets BEGIN SELECT RAISE(ABORT,'injected failure'); END");
    assert.throws(send, /injected failure/);
    assert.equal(repo.getWallet('user'), 520);
    db.exec('DROP TRIGGER fail_packet');
    const id = send();
    db.exec("CREATE TRIGGER fail_credit BEFORE UPDATE ON characters BEGIN SELECT RAISE(ABORT,'injected failure'); END");
    assert.throws(() => repo.claimRedPacket(id, 'alice', 'group'), /injected failure/);
    assert.equal(repo.getRedPacket(id).remaining_count, 2);
    assert.equal(repo.getRedPacket(id).claims.length, 0);
    assert.equal(repo.getWallet('alice'), 200);
    db.exec('DROP TRIGGER fail_credit');
    assert.equal(repo.claimRedPacket(id, 'alice', 'group').success, true);
    assert.equal(repo.getWallet('alice'), 250);
});
