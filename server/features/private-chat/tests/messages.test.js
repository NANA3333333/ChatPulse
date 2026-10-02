const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { once } = require('node:events');
const { createMessageService, registerPrivateMessageRoutes } = require("..");
const { createOperation } = require("../../../platform/logging/operation");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-messages-test-'));
process.env.CHATPULSE_DATA_DIR = dataDir;
const db = require("../../../platform/db/userDatabase.js").getUserDb('messages-test');
const sql = db.getRawDb();
let sequence = 0;
let server;
let base;
let overrides = {};
const calls = [];
const records = [];
const runtime = {
    applyCityBusyPatch: character => calls.push(['city', character.id]),
    notifyMessage: message => calls.push(['notify', message]),
    handleUserMessage: (id, options) => calls.push(['dispatch', id, options]),
    triggerJealousyCheck: id => calls.push(['jealousy', id]),
    triggerImmediateUserReply: async (id, options) => { calls.push(['immediate', id, options]); }
};

function fixture() {
    const id = `messages-${++sequence}`;
    sql.prepare("INSERT INTO characters (id, name, status) VALUES (?, 'Test', 'active')").run(id);
    return id;
}

async function request(route, { method = 'GET', body, runId = `message-test-${++sequence}` } = {}) {
    const response = await fetch(base + route, { method,
        headers: { 'Content-Type': 'application/json', 'X-Run-Id': runId },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    return { response, data, runId };
}

test.before(async () => {
    const app = express();
    app.use(express.json());
    registerPrivateMessageRoutes(app, {
        authMiddleware: (req, res, next) => { req.user = { id: 'messages-test' }; next(); },
        getService: () => createMessageService({ db, runtime: { ...runtime, ...overrides } }),
        startOperation: context => createOperation(context, { write: record => records.push(record) })
    });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}/api/messages`;
});

test.beforeEach(() => { overrides = {}; calls.length = 0; records.length = 0; });
test.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dataDir).startsWith('chatpulse-messages-test-'));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

test('history preserves array shape, chronological cursors, around context and unread behavior', async () => {
    const id = fixture();
    const ids = Array.from({ length: 5 }, (_, i) => Number(db.addMessage(id, 'character', `Reply ${i}`).id));
    const before = await request(`/${id}?limit=2&before=${ids[3]}`);
    assert.deepEqual(before.data.map(row => row.id), ids.slice(1, 3));
    assert.equal(db.getUnreadCount(id), 5, 'paging must not mark the whole conversation read');
    assert.deepEqual((await request(`/${id}?limit=2&after=${ids[1]}`)).data.map(row => row.id), ids.slice(2, 4));
    assert.deepEqual((await request(`/${id}?limit=3&around=${ids[2]}`)).data.map(row => row.id), ids.slice(1, 4));
    const latest = await request(`/${id}?limit=2`);
    assert.deepEqual(latest.data.map(row => row.id), ids.slice(3));
    assert.equal(latest.response.headers.get('X-Run-Id'), latest.runId);
    assert.equal(db.getUnreadCount(id), 0);
});

test('invalid requests fail before persistence or engine work and carry an operation ID', async () => {
    const id = fixture();
    for (const query of ['limit=0', 'before=0', 'after=no', 'around=-1']) {
        const result = await request(`/${id}?${query}`);
        assert.equal(result.response.status, 400);
        assert.equal(result.data.errorCode, 'INVALID_MESSAGE_QUERY');
        assert.equal(result.data.runId, result.runId);
    }
    for (const content of ['', '  ', { text: 'wrong shape' }]) {
        assert.equal((await request('', { method: 'POST', body: { characterId: id, content } })).response.status, 400);
    }
    assert.equal((await request('/missing')).response.status, 404);
    assert.deepEqual(db.getMessages(id), []);
    assert.deepEqual(calls, []);
});

test('sending saves before notification and dispatch, passing one ID to HTTP, WS and engine', async () => {
    const id = fixture();
    overrides.notifyMessage = message => {
        assert.equal(db.getMessages(id).at(-1).id, message.id);
        calls.push(['notify', message]);
    };
    const result = await request('', { method: 'POST', body: { characterId: id, content: 'private payload must stay out of logs' } });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.success, true);
    assert.deepEqual(calls.map(call => call[0]), ['city', 'notify', 'dispatch', 'jealousy']);
    assert.equal(result.data.message.runId, result.runId);
    assert.equal(calls[1][1].runId, result.runId);
    assert.equal(calls[2][2].requestId, result.runId);
    assert.equal(calls[2][2].trace.runId, result.runId);
    assert.equal(db.getCharacter(id).last_user_msg_time, result.data.message.timestamp);
    assert.ok(records.some(record => record.runId === result.runId && record.stage === 'save' && record.status === 'succeeded'));
    assert.equal(JSON.stringify(records).includes('private payload'), false);
});

test('blocked sends remain saved and visible without city hooks or model dispatch', async () => {
    const id = fixture();
    db.updateCharacter(id, { is_blocked: 1 });
    const result = await request('', { method: 'POST', body: { characterId: id, content: 'Blocked message' } });
    assert.equal(result.data.blocked, true);
    assert.equal(result.data.message.isBlocked, true);
    assert.equal(db.getMessages(id).length, 1);
    assert.deepEqual(calls.map(call => call[0]), ['notify']);
});

test('saved messages stay successful when push or dispatch fails; warnings identify the incomplete work', async () => {
    const id = fixture();
    overrides.notifyMessage = () => { throw new Error('Socket unavailable'); };
    overrides.handleUserMessage = () => { throw new Error('Dispatcher unavailable'); };
    const result = await request('', { method: 'POST', body: { characterId: id, content: 'Save once' } });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.message.content, 'Save once');
    assert.deepEqual(result.data.warnings, ['MESSAGE_NOTIFY_FAILED', 'MESSAGE_REPLY_DISPATCH_FAILED']);
    assert.equal(db.getMessages(id).length, 1);
    assert.ok(records.some(record => record.stage === 'dispatch' && record.errorCode === 'MESSAGE_REPLY_DISPATCH_FAILED'));
});

test('a timestamp write failure rolls back the user message and prevents dispatch', async () => {
    const id = fixture();
    sql.exec("CREATE TEMP TRIGGER fail_message_timestamp BEFORE UPDATE OF last_user_msg_time ON characters BEGIN SELECT RAISE(ABORT, 'test timestamp failure'); END;");
    try {
        const result = await request('', { method: 'POST', body: { characterId: id, content: 'Must roll back' } });
        assert.equal(result.response.status, 500);
        assert.deepEqual(db.getMessages(id), []);
        assert.equal(calls.some(call => call[0] === 'dispatch'), false);
        assert.ok(records.some(record => record.stage === 'save' && record.status === 'failed'));
    } finally { sql.exec('DROP TRIGGER fail_message_timestamp'); }
});

test('retry preserves ordinary resume and system-event options without accepting another character message', async () => {
    const id = fixture();
    const other = fixture();
    const otherMessage = db.addMessage(other, 'system', '[System] API Error: Other').id;
    let result = await request(`/${id}/retry`, { method: 'POST', body: { failedMessageId: otherMessage } });
    assert.equal(result.data.success, true);
    assert.equal(db.getMessages(other).length, 1);
    assert.equal(calls[0][2].useRetryResume, true);
    const failed = db.addMessage(id, 'system', '[System] API Error: Main', { systemEventReply: {
        extraSystemDirective: 'Saved event', eventUserDirective: 'User event', skipTopicSwitchGate: true
    } }).id;
    calls.length = 0;
    result = await request(`/${id}/retry`, { method: 'POST', body: { failedMessageId: failed } });
    assert.equal(result.data.retriedSystemEvent, true);
    assert.equal(calls[0][0], 'immediate');
    assert.equal(calls[0][2].extraSystemDirective, 'Saved event');
    assert.equal(calls[0][2].useRetryResume, false);
    assert.equal(calls[0][2].requestId, result.runId);
    assert.deepEqual(db.getMessages(id), []);
});

test('batch deletion scopes IDs to the requested character and clears reply versions; clear leaves other history intact', async () => {
    const id = fixture();
    const other = fixture();
    const first = Number(db.addMessage(id, 'character', 'First').id);
    const last = Number(db.addMessage(id, 'character', 'Last').id);
    const unrelated = Number(db.addMessage(other, 'character', 'Keep').id);
    db.registerPrivateReply(id, [first, last], { messages: [{ role: 'user', content: 'Question' }] });
    const result = await request('/batch-delete', { method: 'POST', body: { characterId: id, messageIds: [first, first, unrelated, 'bad'] } });
    assert.equal(result.data.deleted, 1);
    assert.throws(() => db.getPrivateReplyRun(id, last), { status: 404 });
    assert.equal(db.getMessages(id).length, 1);
    assert.equal(db.getMessages(other).length, 1);
    assert.equal((await request(`/${id}`, { method: 'DELETE' })).data.success, true);
    assert.deepEqual(db.getMessages(id), []);
    assert.equal(db.getMessages(other).length, 1);
});
