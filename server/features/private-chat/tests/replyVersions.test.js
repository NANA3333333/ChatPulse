const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PRIVATE_REPLY_STYLE_GUIDANCE } = require("../context/replyStyle.js");
const { SHARED_CONTEXT_GUIDANCE } = require("../../conversation-context/guidance.js");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-reroll-test-'));
process.env.CHATPULSE_DATA_DIR = dataDir;
process.env.CP_PRIVATE_AUTONOMY = '0';
const calls = [];
let normalGeneration = false;
let contextBuilds = 0;
let modelReply = async () => ({ content: '新的第一句。\n新的第二句。', finishReason: 'stop', usage: { prompt_tokens: 12, completion_tokens: 8 } });
require.cache[require.resolve("../../../platform/llm/client.js")] = { exports: { callLLM: async request => { calls.push(structuredClone(request.messages)); if (!normalGeneration) assert.equal(request.enableCache, false); return modelReply(request); } } };
require.cache[require.resolve("../../memory/index.js")] = { exports: { getMemory: () => new Proxy({}, { get: (_, key) => {
    if (normalGeneration) return key === 'updateConversationDigest' ? async () => [] : undefined;
    throw new Error(`Unexpected auxiliary operation: ${String(key)}`);
} }) } };
require.cache[require.resolve("../../conversation-context/index.js")] = { exports: {
    buildUniversalContext: async () => { assert.equal(normalGeneration, true); contextBuilds++; return {
        preamble: `${SHARED_CONTEXT_GUIDANCE}\n\nSaved module routing result`,
        contextPreamble: 'Saved module routing result', systemGuidance: SHARED_CONTEXT_GUIDANCE
    }; },
    formatTypedAntiRepeatBlock: () => ''
} };
const { getUserDb } = require("../../../platform/db/userDatabase.js");
const { getEngine } = require("../runtime.js");
const db = getUserDb('reroll-test');
const sql = db.getRawDb();
const engine = getEngine('reroll-test');
const events = [];
const clients = new Set([{ readyState: 1, send: value => events.push(JSON.parse(value)) }]);
let sequence = 0;

function fixture(messages = [{ role: 'system', content: 'Cached small-model results and memory' }, { role: 'user', content: '测试问题' }]) {
    const characterId = `reroll-${++sequence}`;
    sql.prepare("INSERT INTO characters (id, name, status, api_endpoint, api_key, model_name, sys_proactive) VALUES (?, 'Test', 'active', 'https://example.invalid/v1', 'test-key', 'main-model', 0)").run(characterId);
    db.addMessage(characterId, 'user', '测试问题');
    const ids = ['原来第一句。', '原来第二句。'].map(content => Number(db.addMessage(characterId, 'character', content).id));
    const request = { messages, maxTokens: 1000, presencePenalty: 0.35, frequencyPenalty: 0.45 };
    const saved = db.registerPrivateReply(characterId, ids, request, { retrievedMemories: [{ id: 'memory-1', content: '记忆' }] });
    return { characterId, ids, messageId: saved.id, request };
}

test.after(() => {
    engine.stopAllTimers();
    db.close();
    assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dataDir).startsWith('chatpulse-reroll-test-'));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

test('ordinary reply automatically saves its complete main request for later rerolls', async () => {
    const f = fixture();
    db.clearMessages(f.characterId);
    db.addMessage(f.characterId, 'user', '新的一轮问题');
    normalGeneration = true;
    try {
        const runId = 'ordinary-reply-queue-test';
        await engine.triggerImmediateUserReply(f.characterId, clients, { skipTopicSwitchGate: true,
            requestId: runId, trace: { runId, feature: 'private-chat', action: 'retry' } });
        assert.ok(require("../../../platform/jobs/backgroundQueue.js").getBackgroundQueueStats({ userId: 'reroll-test' })
            .recentTasks.some(task => task.runId === runId && task.status === 'completed'));
        assert.ok(db.getReplyDispatchLogs(f.characterId).some(log => log.request_id === runId));
    } finally {
        normalGeneration = false;
    }
    const last = db.getMessages(f.characterId).at(-1);
    assert.equal(last.role, 'character');
    assert.equal(last.metadata.replyVersion.count, 1);
    const request = db.getPrivateReplyRun(f.characterId, last.id).request;
    assert.deepEqual(request.messages, calls.at(-1));
    assert.ok(request.messages.some(message => message.content.includes('Saved module routing result')));
    assert.equal(request.messages[0].content.split(PRIVATE_REPLY_STYLE_GUIDANCE).length - 1, 1);
    assert.equal(request.messages.map(message => message.content).join('\n').split(SHARED_CONTEXT_GUIDANCE).length - 1, 1);
    const buildsBefore = contextBuilds;
    await engine.changePrivateReplyVersion(f.characterId, last.id, clients, { reroll: true, revision: 0 });
    assert.deepEqual(calls.at(-1), request.messages);
    assert.equal(contextBuilds, buildsBefore);
});

test('rerolls only the main model, persists variants and uses the selected text as context', async () => {
    const f = fixture();
    calls.length = 0;
    const update = await engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0].content, `${f.request.messages[0].content}\n\n${PRIVATE_REPLY_STYLE_GUIDANCE}\n\n${SHARED_CONTEXT_GUIDANCE}`);
    assert.deepEqual(calls[0].slice(1), f.request.messages.slice(1));
    assert.deepEqual(db.getPrivateReplyRun(f.characterId, f.messageId).request, f.request);
    assert.deepEqual(update.removedIds, [f.ids[0]]);
    assert.equal(update.message.metadata.replyVersion.count, 2);
    assert.equal(update.message.metadata.replyVersion.active, 1);
    assert.equal(update.message.metadata.replyVersion.revision, 1);
    assert.equal(update.message.metadata.replyBubbles, true);
    assert.equal(JSON.stringify(update).includes('Cached small-model'), false);
    assert.equal(db.getVisibleMessages(f.characterId).at(-1).content, '新的第一句。\n新的第二句。');
    const switched = await engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { version: 0, revision: 1 });
    assert.equal(calls.length, 1, 'switching versions is free');
    assert.equal(switched.message.content, '原来第一句。\n原来第二句。');
    assert.equal(db.getMessages(f.characterId).at(-1).metadata.replyVersion.count, 2);
    assert.ok(events.some(event => event.type === 'private_reply_updated'));
    // A second connection simulates a reload/restart reading persisted data.
    const Database = require('better-sqlite3');
    const reopened = new Database(db.getDbPath());
    assert.equal(reopened.prepare('SELECT active_version FROM private_reply_runs WHERE message_id = ?').get(f.messageId).active_version, 0);
    assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM private_reply_versions WHERE message_id = ?').get(f.messageId).n, 2);
    reopened.close();
});

test('reroll upgrades the legacy recall boundary with one main call and leaves the saved request intact', async () => {
    const memories = 'Memory 1: 当时讨论过搬家，但并未决定。\nDetails: 只是设想。';
    const rawUser = '不是已经搬了，只是举例。';
    const oldRecall = `\n[SYSTEM: You successfully retrieved memories related to "搬家". Current Time Now: 2026-09-16 14:00. You must compare the time. Treat these as factual recall anchors.]\n${memories}\n(Use these recalled facts to answer the user accurately and specifically.)\n\n[Newest user message]\n${rawUser}`;
    const f = fixture([
        { role: 'system', content: 'Cached small-model results and memory' },
        { role: 'system', content: 'Saved module routing result' },
        { role: 'assistant', content: '之前的回答。' },
        { role: 'user', content: oldRecall }
    ]);
    calls.length = 0;
    const buildsBefore = contextBuilds;
    await engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 });
    assert.equal(calls.length, 1);
    assert.equal(contextBuilds, buildsBefore);
    assert.deepEqual(calls[0].slice(1, -1), f.request.messages.slice(1, -1));
    assert.ok(calls[0].at(-1).content.includes(`<过往对话参考>\n${memories}\n</过往对话参考>\n\n<本轮用户输入>\n${rawUser}\n</本轮用户输入>`));
    assert.deepEqual(db.getPrivateReplyRun(f.characterId, f.messageId).request, f.request);
});

test('rejects missing, cross-character and stale versions without changing existing messages', async () => {
    const f = fixture();
    const other = fixture();
    assert.throws(() => db.getPrivateReplyRun(other.characterId, f.messageId), { status: 404 });
    assert.throws(() => db.selectPrivateReplyVersion(f.characterId, f.messageId, 8, 0), { status: 404 });
    await assert.rejects(engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { version: 0, revision: 99 }), { status: 409 });
    assert.equal(db.getMessages(f.characterId).length, 3);
    assert.equal(db.getMessages(f.characterId).at(-1).metadata.replyVersion.count, 1);
});

test('a model error or empty visible output preserves the original version', async () => {
    const f = fixture();
    modelReply = async () => { throw new Error('Provider unavailable'); };
    await assert.rejects(engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 }), /Provider unavailable/);
    modelReply = async () => ({ content: '[AFFINITY: 2]', finishReason: 'stop' });
    await assert.rejects(engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 }), { status: 502 });
    assert.equal(db.getMessages(f.characterId).length, 3);
    assert.equal(db.getMessages(f.characterId).at(-1).metadata.replyVersion.count, 1);
});

test('does not execute generated transfers, diary, mood, city or web-search actions', async () => {
    const f = fixture();
    const before = db.getCharacter(f.characterId);
    modelReply = async () => ({ content: '可见回复。[TRANSFER: 5][AFFINITY: 2][EMOTION_STATE: happy][DIARY: secret][CITY_INTENT: shop][WEB_SEARCH_INTENT: search]', finishReason: 'stop' });
    engine.setCityReplyIntentCallback(() => { throw new Error('City action must not run'); });
    const update = await engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 });
    assert.equal(update.message.content, '可见回复。');
    const after = db.getCharacter(f.characterId);
    assert.equal(after.affinity, before.affinity);
    assert.equal(after.wallet, before.wallet);
    assert.equal(db.getDiaries(f.characterId).length, 0);
});

test('serializes double clicks and cancels if history is deleted during generation', async () => {
    const f = fixture();
    let resolveModel;
    let started;
    const entered = new Promise(resolve => { started = resolve; });
    modelReply = () => { started(); return new Promise(resolve => { resolveModel = resolve; }); };
    const pending = engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 });
    await entered;
    await assert.rejects(engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 }), { status: 409 });
    db.clearMessages(f.characterId);
    resolveModel({ content: '不应该复活的回复。', finishReason: 'stop' });
    await assert.rejects(pending, { status: 409 });
    assert.deepEqual(db.getMessages(f.characterId), []);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM private_reply_versions WHERE message_id = ?').get(f.messageId).n, 0);
});

test('a new user message during reroll cancels replacement', async () => {
    const f = fixture();
    modelReply = async () => {
        db.addMessage(f.characterId, 'user', '新问题');
        return { content: '过时的回复。', finishReason: 'stop' };
    };
    await assert.rejects(engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 }), { status: 409 });
    assert.equal(db.getPrivateReplyRun(f.characterId, f.messageId).active_version, 0);
});

test('deleting any original bubble cleans up snapshots; changing an older reply keeps later history', () => {
    const deleted = fixture();
    db.deleteMessage(deleted.ids[0], deleted.characterId);
    assert.throws(() => db.getPrivateReplyRun(deleted.characterId, deleted.messageId), { status: 404 });
    const f = fixture();
    const later = db.addMessage(f.characterId, 'user', '后面的对话');
    db.addPrivateContextSummary({ character_id: f.characterId, start_message_id: f.ids[0], end_message_id: later.id, summary_text: 'Old summary' });
    const originalPosition = db.getMessages(f.characterId).find(row => row.id === f.messageId).timestamp;
    db.selectPrivateReplyVersion(f.characterId, f.messageId, null, 0, '改写的历史回复。');
    const messages = db.getMessages(f.characterId);
    assert.equal(messages.at(-1).id, later.id);
    assert.equal(messages.find(row => row.id === f.messageId).timestamp, originalPosition);
    assert.equal(db.getPrivateContextSummaries(f.characterId).length, 0);
});

test('HTTP, queue, model diagnostics and reply events share an operation ID on success and failure', async () => {
    const express = require('express');
    const { once } = require('node:events');
    const { registerPrivateReplyRoutes } = require("..");
    const { createOperation } = require("../../../platform/logging/operation");
    const { getBackgroundQueueStats } = require("../../../platform/jobs/backgroundQueue.js");
    const records = [];
    const app = express();
    app.use(express.json());
    registerPrivateReplyRoutes(app, {
        authMiddleware: (req, res, next) => { req.user = { id: 'reroll-test' }; next(); },
        startOperation: context => createOperation(context, { write: record => records.push(record) }),
        changeReplyVersion: (req, characterId, messageId, options) =>
            engine.changePrivateReplyVersion(characterId, messageId, clients, options)
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const f = fixture();
        db.updateCharacter(f.characterId, { llm_debug_capture: 1 });
        modelReply = async request => {
            request.debugAttempt({ phase: 'start', attempt: 0 });
            return { content: '带操作编号的回复。', finishReason: 'stop' };
        };
        const url = `http://127.0.0.1:${server.address().port}/api/messages/${f.characterId}/replies/${f.messageId}`;
        const post = (action, body, runId) => fetch(`${url}/${action}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Run-Id': runId }, body: JSON.stringify(body)
        });
        const successId = 'test-reply-success-0001';
        const response = await post('reroll', { revision: 0 }, successId);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-run-id'), successId);
        const update = await response.json();
        assert.equal(update.runId, successId);
        assert.equal(update.message.metadata.replyVersion.active, 1);
        assert.ok(events.some(event => event.type === 'private_reply_updated' && event.data.runId === successId));
        assert.ok(getBackgroundQueueStats({ userId: 'reroll-test' }).recentTasks.some(task => task.runId === successId && task.status === 'completed'));
        for (const stage of ['request', 'validate', 'load_context', 'llm', 'parse', 'save', 'notify', 'http_response']) {
            assert.ok(records.some(record => record.runId === successId && record.stage === stage && record.status === 'succeeded'), stage);
        }
        assert.ok(db.getLlmDebugLogs(f.characterId).some(row => JSON.stringify(row).includes(successId)));
        assert.equal(JSON.stringify(records).includes('Cached small-model results'), false, 'stage logs omit saved prompts');
        assert.equal(JSON.stringify(records).includes('test-key'), false, 'stage logs omit API keys');

        const beforeInvalid = calls.length;
        const invalid = await post('version', { revision: 1, version: -1 }, 'test-reply-invalid-0001');
        assert.equal(invalid.status, 400);
        assert.equal((await invalid.json()).errorCode, 'INVALID_REPLY_VERSION_REQUEST');
        const stale = await post('reroll', { revision: 0 }, 'test-reply-stale-0001');
        assert.equal(stale.status, 409);
        assert.equal((await stale.json()).errorCode, 'REPLY_VERSION_CONFLICT');
        assert.equal(calls.length, beforeInvalid);

        modelReply = async () => { throw new Error('Provider unavailable'); };
        const failedId = 'test-reply-failed-0001';
        const failure = await post('reroll', { revision: 1 }, failedId);
        assert.equal(failure.status, 500);
        assert.deepEqual(await failure.json(), { error: 'Provider unavailable', errorCode: 'LLM_REQUEST_FAILED', runId: failedId,
            feature: 'private-chat', action: 'POST /api/messages/:characterId/replies/:messageId/reroll' });
        assert.ok(records.some(record => record.runId === failedId && record.stage === 'llm'
            && record.status === 'failed' && record.errorCode === 'LLM_REQUEST_FAILED'));
        assert.equal(db.getMessages(f.characterId).at(-1).content, update.message.content);
        assert.equal(db.getPrivateReplyRun(f.characterId, f.messageId).active_version, 1);
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});

test('a notification failure after commit returns the saved version without another model call', async () => {
    const f = fixture();
    modelReply = async () => ({ content: '已经保存的回复。', finishReason: 'stop' });
    const disconnectedClients = new Set([{ readyState: 1, send: value => {
        if (JSON.parse(value).type === 'private_reply_updated') throw new Error('Socket disconnected');
    } }]);
    const before = calls.length;
    const update = await engine.changePrivateReplyVersion(f.characterId, f.messageId, disconnectedClients, { reroll: true, revision: 0 });
    assert.equal(update.message.content, '已经保存的回复。');
    assert.equal(update.notificationWarning, 'REPLY_NOTIFY_FAILED');
    assert.equal(db.getPrivateReplyRun(f.characterId, f.messageId).active_version, 1);
    await assert.rejects(engine.changePrivateReplyVersion(f.characterId, f.messageId, clients, { reroll: true, revision: 0 }), { status: 409 });
    assert.equal(calls.length, before + 1);
});
