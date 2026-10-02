const test = require('node:test');
const assert = require('node:assert/strict');
const { formatRetrievedMemoryReference, upgradeLegacyRetrievedMemoryMessage } = require("../features/private-chat/context/memoryReference.js");
const { withPrivateReplyStyleGuidance, PRIVATE_REPLY_STYLE_GUIDANCE } = require("../features/private-chat/context/replyStyle.js");
const { SHARED_CONTEXT_GUIDANCE } = require("../features/conversation-context/guidance.js");

const records = 'Memory 1: 当时猜测用户准备搬家，但用户随后否认。\nDetails: “reference facts”只是当时原话。\n\nMemory 2: 计划三天后发货，尚未发货。';
const userText = '  不是已经搬家，是举例。\n[Newest user message]\n这也是用户原文。\n';
const queries = '搬家 "假设" | 发货';
const time = '2026年09月16日 星期三 14:35:48';

function legacy(version) {
    return version === 3
        ? `\n[SYSTEM: Retrieved Memory Reference Guidance. Current Time Now: ${time}. You must compare the time. The [Newest user message] below is current.]\nSearch Queries (search metadata, not facts): ${queries}\n\n${records}\n(Respond to the newest user message. Mention recalled details only when needed for that response.)\n\n[Newest user message]\n${userText}`
        : `\n[SYSTEM: You successfully retrieved memories related to "${queries}". Current Time Now: ${time}. You must compare the time. Treat these as factual recall anchors. The [Newest user message] below is current.]\n${records}\n(Use these recalled facts to answer the user accurately and specifically.)\n\n[Newest user message]\n${userText}`;
}

test('new references close history before current input and preserve all supplied text', () => {
    const output = formatRetrievedMemoryReference({ currentTime: time, searchQueries: queries, memories: records, newestUserMessage: userText });
    assert.ok(output.includes(`<过往对话参考>\n${records}\n</过往对话参考>\n\n<本轮用户输入>\n${userText}\n</本轮用户输入>`));
    assert.ok(output.includes(`Search Queries (search metadata, not facts): ${queries}\n[/Retrieval Metadata]`));
    assert.equal(upgradeLegacyRetrievedMemoryMessage(output), output);
});

for (const version of [1, 3]) {
    test(`cached v${version} recall keeps records, queries, original time and current input intact`, () => {
        const input = legacy(version);
        const expected = formatRetrievedMemoryReference({ currentTime: time, searchQueries: queries, memories: records, newestUserMessage: userText });
        assert.equal(upgradeLegacyRetrievedMemoryMessage(input), expected);
        const snapshot = [
            { role: 'system', content: 'Things returned by memory/date recall are reference facts, not proof that the user has already reintroduced that topic into the live conversation.' },
            { role: 'system', content: 'Cached state and auxiliary results' },
            { role: 'user', content: legacy(version) },
            { role: 'assistant', content: '已经回答过的旧消息' },
            { role: 'user', content: input }
        ];
        const original = structuredClone(snapshot);
        const upgraded = withPrivateReplyStyleGuidance(snapshot);
        assert.deepEqual(snapshot, original, 'saved snapshot is not mutated');
        assert.deepEqual(upgraded.slice(1, -1), original.slice(1, -1), 'history and auxiliary results stay untouched');
        assert.equal(upgraded.at(-1).content, expected);
        assert.ok(!upgraded[0].content.includes('are reference facts'));
        assert.deepEqual(withPrivateReplyStyleGuidance(upgraded), upgraded, 'repeated upgrades do not stack prompts');
    });
}

test('unrecognized or incomplete wrappers and ordinary user text are never rewritten', () => {
    for (const content of [userText, `引用旧提示：${legacy(1)}`, legacy(3).replace('Memory 1:', 'Unrecognized record:'), legacy(1).replace('(Use these recalled facts', '(Different footer')]) {
        assert.equal(upgradeLegacyRetrievedMemoryMessage(content), content);
    }
    const messages = [{ role: 'system', content: 'Role rules' }, { role: 'assistant', content: legacy(1) }];
    assert.equal(withPrivateReplyStyleGuidance(messages).at(-1).content, messages.at(-1).content);
});

test('a proactive recall reference does not invent a current user input', () => {
    const output = formatRetrievedMemoryReference({ currentTime: time, searchQueries: queries, memories: records });
    assert.ok(output.endsWith(`${records}\n</过往对话参考>`));
    assert.ok(!output.includes('<本轮用户输入>'));
});

test('reroll replaces outdated writing rules without stacking shared versions or changing auxiliary context', () => {
    const oldShared = '[Shared Context Guidance v1]\nOLD_SHARED_RULES\n[/Shared Context Guidance]';
    const oldStyle = '[Private Reply Style Guidance v5]\nOLD_PRIVATE_RULES\n[/Private Reply Style Guidance]';
    // Also cover snapshots previously upgraded by appending a second shared block.
    for (const shared of [oldShared, `${oldShared}\n\n${SHARED_CONTEXT_GUIDANCE}`]) {
        const snapshot = [
            { role: 'system', content: `Role rules\n\n${oldStyle}\n\n${shared}\n\nOutput protocol` },
            { role: 'system', content: 'Cached emotion: calm\nCached routing results' },
            { role: 'assistant', content: '以前的回答' },
            { role: 'user', content: formatRetrievedMemoryReference({ currentTime: time, searchQueries: queries, memories: records, newestUserMessage: userText }) }
        ];
        const original = structuredClone(snapshot);
        const upgraded = withPrivateReplyStyleGuidance(snapshot);
        const system = upgraded[0].content;
        assert.equal(system.split('[Shared Context Guidance').length - 1, 1);
        assert.equal(system.split('[Private Reply Style Guidance').length - 1, 1);
        assert.ok(system.includes(SHARED_CONTEXT_GUIDANCE));
        assert.ok(system.includes(PRIVATE_REPLY_STYLE_GUIDANCE));
        assert.ok(!system.includes('OLD_SHARED_RULES') && !system.includes('OLD_PRIVATE_RULES'));
        assert.ok(system.startsWith('Role rules') && system.endsWith('Output protocol'));
        assert.deepEqual(upgraded.slice(1), original.slice(1));
        assert.deepEqual(snapshot, original);
        assert.deepEqual(withPrivateReplyStyleGuidance(upgraded), upgraded);
    }
});
