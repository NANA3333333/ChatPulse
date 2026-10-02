const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-zero-window-test-'));
process.env.CHATPULSE_DATA_DIR = dataDir;
const db = require('../../../platform/db/userDatabase.js').getUserDb('zero-window-test');
const sql = db.getRawDb();
const history = require('../context/history.js').createModule({ formatMessageForLLM: (_, text) => text });
const { preparePrivateConversationState } = require('../context/conversationState.js').createModule({
    ...history, isSyntheticSystemErrorMessage: () => false
});
let sequence = 0;
let server;
let base;

function fixture(limit = 60) {
    const id = `zero-window-${++sequence}`;
    sql.prepare("INSERT INTO characters (id, name, status, context_msg_limit, explicit_emotion_state) VALUES (?, 'Test', 'active', ?, 'playful')").run(id, limit);
    db.addMessage(id, 'user', 'Old user message');
    db.addMessage(id, 'character', 'Old quoted reply');
    db.addMessage(id, 'user', 'Current user question');
    return db.getCharacter(id);
}

test.before(async () => {
    const app = express();
    app.use(express.json());
    const dependencies = {
        authMiddleware: (req, res, next) => {
            req.db = db; req.memory = {}; req.engine = { stopTimer() {} };
            req.user = { id: 'zero-window-test' }; next();
        },
        getWsClients: () => [], CHARACTER_SECRET_FIELDS: [],
        preserveExistingSecretFields: value => value, redactSecretFields: value => value
    };
    require('../../characters/http/put-characters-id.js').register(app, dependencies);
    require('../../characters/http/post-characters.js').register(app, dependencies);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dataDir).startsWith('chatpulse-zero-window-test-'));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

for (const method of ['PUT', 'POST']) {
    test(`${method} saves zero, resets summary caches, preserves chat and emotion, and can restore the window`, async () => {
        const character = fixture();
        const rows = db.getVisibleMessages(character.id, 0);
        db.addPrivateContextSummary({ character_id: character.id, start_message_id: rows[0].id,
            end_message_id: rows[1].id, message_count: 2, summary_text: 'Old summary', source_hash: 'old' });
        db.upsertHistoryWindowCache({ character_id: character.id, window_type: 'private_llm_history_window',
            window_size: 60, source_hash: 'old', message_ids_json: rows.map(r => r.id), compiled_json: [] });
        const save = async limit => {
            const response = await fetch(base + (method === 'PUT' ? `/api/characters/${character.id}` : '/api/characters'), {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: character.id, name: character.name, context_msg_limit: limit })
            });
            assert.equal(response.status, 200);
            return (await response.json()).character;
        };
        const saved = await save(0);
        assert.equal(saved.context_msg_limit, 0);
        assert.equal(saved.explicit_emotion_state, 'playful');
        assert.equal(saved.private_summary_baseline_message_id, rows.at(-1).id);
        assert.deepEqual(db.getVisibleMessages(character.id, 0), rows);
        assert.deepEqual(db.getPrivateContextSummaries(character.id), []);
        assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM history_window_cache WHERE character_id=?').get(character.id).n, 0);
        assert.equal((await save(20)).context_msg_limit, 20);
        assert.equal((await save(-5)).context_msg_limit, 0);
    });
}

test('zero compiles no historical messages but retains the current user input and passes zero to summaries', async () => {
    const character = fixture(0);
    let digestOptions;
    const state = await preparePrivateConversationState({ db, character, forUserReply: true, refreshDigest: true,
        memory: { updateConversationDigest: async (_, options) => { digestOptions = options; return []; } } });
    assert.equal(state.contextLimit, 0);
    assert.equal(state.liveHistoryWindowSize, 0);
    assert.deepEqual(state.liveHistory, []);
    assert.deepEqual(state.transformedHistory, []);
    assert.equal(state.recentInputString, 'Current user question');
    assert.equal(digestOptions.rawWindow, 0);
    const restored = await preparePrivateConversationState({ db, character: { ...character, context_msg_limit: 2 } });
    assert.equal(restored.liveHistory.length, 2);
    assert.equal(restored.pendingSummaryMessages.length, 1);
    assert.equal(restored.transformedHistory[0].role, 'user');
    assert.equal(restored.transformedHistory[1].role, 'assistant');
    assert.match(restored.transformedHistory[2].content, /Current user question/);
});

test('overflowed messages stay in reply history until their summary is saved', async () => {
    const character = fixture(2);
    const firstMessage = db.getVisibleMessages(character.id, 0)[0];
    for (let i = 0; i < 28; i += 1) db.addMessage(character.id, 'user', `Pending ${i}`);

    const pending = await preparePrivateConversationState({ db, character });
    assert.equal(pending.liveHistory.length, 2);
    assert.equal(pending.pendingSummaryMessages.length, 29);
    assert.equal(pending.transformedHistory.length, 31);
    assert.match(pending.transformedHistory[0].content, /Old user message/);

    const overflow = db.getVisibleMessages(character.id, 0).slice(0, -2);
    db.addPrivateContextSummary({
        character_id: character.id,
        start_message_id: firstMessage.id,
        end_message_id: overflow.at(-1).id,
        message_count: overflow.length,
        summary_text: 'Saved overflow summary',
        source_hash: 'overflow-test'
    });
    const summarized = await preparePrivateConversationState({ db, character });
    assert.equal(summarized.pendingSummaryMessages.length, 0);
    assert.equal(summarized.transformedHistory.length, 2);
    assert.equal(summarized.privateContextSummaries[0].summary_text, 'Saved overflow summary');
});

test('changing the threshold before the first summary does not skip pending messages', async () => {
    const character = fixture(2);
    const firstMessage = db.getVisibleMessages(character.id, 0)[0];
    const { updateConversationDigest } = require('../../memory/operations/digests.js').createModule({
        resolveMemoryModelConfig: () => ({ endpoint: 'test', key: 'test', model: 'test' }),
        getDb: () => db,
        buildMemorySubjectRules: () => '',
        callLLM: async () => ({ content: 'First overflow batch', usage: {}, finishReason: 'stop' }),
        MEMORY_SMALL_MODEL_MAX_TOKENS: 1000,
        isCompletePrivateContextSummaryResponse: () => true,
        recordMemoryTokenUsage: () => {},
        crypto: require('node:crypto')
    });

    await updateConversationDigest(character, { rawWindow: 2 });
    assert.equal(db.getPrivateContextSummaries(character.id).length, 0);
    assert.equal(db.getCharacter(character.id).private_summary_baseline_message_id, -1);
    db.updateCharacter(character.id, { private_summary_threshold: 5 });
    for (let i = 0; i < 4; i += 1) db.addMessage(character.id, 'user', `Later ${i}`);
    const summaries = await updateConversationDigest(db.getCharacter(character.id), { rawWindow: 2 });
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].start_message_id, firstMessage.id);
    assert.equal(summaries[0].message_count, 5);
});

test('zero suppresses base private history and private anti-repeat hints while retaining city and group hints', () => {
    const character = { id: 'isolated', name: 'Test', context_msg_limit: 0 };
    const stubDb = {
        getVisibleMessages: () => assert.fail('Zero must not call the unlimited-history database query'),
        city: { getCharacterRecentLogs: () => [{ message: 'Current city activity' }] },
        getGroups: () => [{ id: 'group', members: [{ member_id: character.id }] }],
        getVisibleGroupMessages: () => [{ sender_id: character.id, content: 'Group reply' }]
    };
    const { buildBasePrivateContextWindow } = require('../../conversation-context/context/helpers.js').createModule({});
    const { buildTypedAntiRepeatHints } = require('../../conversation-context/context/antiRepeat.js').createModule({});
    assert.equal(buildBasePrivateContextWindow(stubDb, character), '');
    const hints = buildTypedAntiRepeatHints(stubDb, character);
    assert.deepEqual(hints.private_character_replies, []);
    assert.deepEqual(hints.city_private_outreach, []);
    assert.equal(hints.city_self_logs[0].text, 'Current city activity');
    assert.equal(hints.group_character_replies[0].text, 'Group reply');
});

test('zero treats private messages as outside the window for memory sweeping', () => {
    const character = fixture(0);
    const rows = db.getVisibleMessages(character.id, 0);
    assert.equal(db.countOverflowMessages(character.id, 0), rows.length);
    assert.deepEqual(db.getOverflowMessages(character.id, 0, 10).map(r => r.id).sort((a, b) => a - b), rows.map(r => r.id).sort((a, b) => a - b));
    assert.equal(db.countOverflowMessages(character.id, 2), rows.length - 2);
    db.markOverflowMessagesSummarized(character.id, 0);
    assert.equal(db.countOverflowMessages(character.id, 0), 0);
});

test('the main reply request still contains the current user message when both history and RAG are empty', async () => {
    const character = fixture(0);
    let captured;
    const noOp = () => {};
    const dependencies = {
        db, memory: {}, timers: new Map(), isPrivateReplyStale: () => Boolean(captured),
        abortStalePrivateReply: noOp, createRagProgress: () => ({}), broadcastEngineState: noOp,
        updateRagProgress: noOp, setRagFailureState: noOp, recordLlmDebug: noOp,
        preparePrivateConversationState,
        runTopicSwitchGate: async () => ({ decision: 'CONTINUE_CURRENT_TOPIC' }),
        buildPrompt: async () => ({ prompt: 'Role and emotion', stablePromptBlock: 'Role', dynamicPromptBlock: 'Emotion: playful' }),
        runStructuredRagPipeline: async () => null,
        estimateMessageTokens: () => 0, getTokenCount: () => 0, buildLlmAttemptRecorder: () => noOp,
        callLLM: async request => { captured = request; return { content: 'Test response' }; }
    };
    const { triggerMessage } = require('../replyGeneration.js').createModule(dependencies);
    await triggerMessage(character, [], true);
    assert.deepEqual(captured.messages, [
        { role: 'system', content: 'Role' },
        { role: 'system', content: 'Emotion: playful' },
        { role: 'user', content: 'Current user question' }
    ]);
    assert.equal(db.getVisibleMessages(character.id, 0).length, 3, 'Model capture must not write a reply');
});
