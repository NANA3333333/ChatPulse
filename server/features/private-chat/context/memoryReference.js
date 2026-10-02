const PAST_CONVERSATION_REFERENCE = '召回内容是过去聊天的内容，不一定是正确事实，只是过去对话的概况，代表过去聊过、记录过的内容，只可以做对话参考。';

const MEMORY_REFERENCE_GUIDANCE = `${PAST_CONVERSATION_REFERENCE}
记录中可能包含当时的陈述、猜测、误解、假设或计划；聊过某件事，不等于其中的说法已被证实，也不等于计划已经发生或情况延续至今。保留这些区别，不能把摘要里的推测变成对用户的定论。
结合记录时间理解过去，只在与本轮有关时参考；可以默用，也可以完全不提。召回不表示用户重新开启了这些话题，旧问题也不自动成为本轮待回答的问题。不要为了展示记忆而复述旧事。
本轮用户输入在历史参考区结束之后单独列出。直接回应本轮原文，保留否定、条件与不确定性；摘要或检索词与原文冲突时，以当前明确说明和近期原文为准。
Search Queries、Matched Query、Slot Coverage 是辅助检索元数据，可能概括不准，不是用户原话、事实证据或回复提纲。
用户明确要求回忆时，可以依据相关记录说明当时聊过什么，保留说话者、时间与不确定性；不必因为记录未经独立核实而一概拒绝回忆，也无需在普通闲聊中机械声明这些规则。`;

function formatRetrievedMemoryReference({ currentTime, searchQueries, memories, newestUserMessage }) {
    const sections = [
        '[Past Conversation Reference Guidance]',
        MEMORY_REFERENCE_GUIDANCE,
        `Current Time Now: ${currentTime}`,
        '[Retrieval Metadata]',
        `Search Queries (search metadata, not facts): ${searchQueries}`,
        '[/Retrieval Metadata]',
        '<过往对话参考>',
        memories,
        '</过往对话参考>'
    ];
    if (newestUserMessage !== undefined) {
        sections.push('', '<本轮用户输入>', newestUserMessage, '</本轮用户输入>');
    }
    return sections.join('\n');
}

// Only replace the known app-owned wrapper. Preserve the cached records and user text verbatim.
function upgradeLegacyRetrievedMemoryMessage(content) {
    if (typeof content !== 'string'
        || !/^\n?\[SYSTEM: (?:You successfully retrieved memories related to |Retrieved Memory Reference Guidance\.)/.test(content)) return content;
    const recordsStart = content.indexOf('\nMemory 1:');
    if (recordsStart < 0) return content;
    const footer = /\n\((?:Use these recalled facts to answer the user accurately and specifically\.|Respond to the newest user message\. Mention recalled details only when needed for that response\.)\)\n\n\[Newest user message\]\n/g;
    footer.lastIndex = recordsStart;
    const boundary = footer.exec(content);
    if (!boundary) return content;
    const header = content.slice(0, recordsStart);
    const time = header.match(/Current Time Now: (.*?)\. You must compare /)?.[1];
    const queries = header.match(/related to "([\s\S]*?)"\. Current Time Now:/)?.[1]
        ?? header.match(/\nSearch Queries \(search metadata, not facts\): ([\s\S]*?)\n?$/)?.[1];
    if (!time || queries === undefined) return content;
    return formatRetrievedMemoryReference({
        currentTime: time,
        searchQueries: queries,
        memories: content.slice(recordsStart + 1, boundary.index),
        newestUserMessage: content.slice(boundary.index + boundary[0].length)
    });
}

// These exact lines belong to the old stable system prompt, outside recalled records.
function upgradeLegacyMemorySystemGuidance(content) {
    if (typeof content !== 'string') return content;
    return content
        .replace('Things returned by memory/date recall are reference facts, not proof that the user has already reintroduced that topic into the live conversation.',
            'Memory/date recall summarizes past conversations for reference only; it does not establish that every recorded claim is true, still current, or a topic the user has reintroduced.')
        .replace('not in retrieved memory/date-recall facts,', 'not in retrieved past-conversation records,')
        .replace('Retrieved memory/date-recall facts are reference material, not automatic proof that the user is still actively discussing every recalled item right now.',
            'Retrieved memory/date-recall summaries describe past conversations, not verified facts or current input. Use them only as relevant conversation references; recalled topics are not automatically active now.')
        .replace('the retrieved memory/date-recall facts,', 'the retrieved past-conversation records,');
}

module.exports = {
    PAST_CONVERSATION_REFERENCE,
    formatRetrievedMemoryReference,
    upgradeLegacyRetrievedMemoryMessage,
    upgradeLegacyMemorySystemGuidance
};
