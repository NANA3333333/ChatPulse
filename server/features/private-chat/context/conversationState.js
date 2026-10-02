// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function preparePrivateConversationState({ db, memory, character, refreshDigest = false, forUserReply = false }) {
    const contextLimit = character.context_msg_limit ?? 60;
    const rawContextHistory = db.getVisibleMessages(character.id, 0);
    let contextHistory = Array.isArray(rawContextHistory)
        ? rawContextHistory.map(msg => {
            if (!msg || typeof msg !== 'object') return msg;
            let metadata = msg.metadata;
            if (typeof metadata === 'string' && metadata.trim()) {
                try { metadata = JSON.parse(metadata); } catch (e) { metadata = null; }
            }
            return { ...msg, metadata: metadata || null };
        }).filter(msg => !dependencies.isSyntheticSystemErrorMessage(msg))
        : [];
    const latestUserInWindow = [...contextHistory].reverse().find(m => m.role === 'user');

    if (forUserReply && latestUserInWindow) {
        const latestUserId = Number(latestUserInWindow.id || 0);
        const latestUserTimestamp = Number(latestUserInWindow.timestamp || 0);
        contextHistory = contextHistory.map(msg => {
            if (!msg || msg.role === 'user') return msg;
            const msgId = Number(msg.id || 0);
            const msgTimestamp = Number(msg.timestamp || 0);
            const afterLatestUser = latestUserId > 0
                ? msgId > latestUserId
                : (latestUserTimestamp > 0 && msgTimestamp > latestUserTimestamp);
            if (!afterLatestUser) return msg;
            if (msg.role === 'character') return dependencies.markPostUserCharacterMessageAsEvent(msg, character);
            return msg;
        }).filter(Boolean);
    }

    let privateContextSummaries = typeof db.getPrivateContextSummaries === 'function'
        ? db.getPrivateContextSummaries(character.id, 3)
        : [];
    if (refreshDigest && typeof memory?.updateConversationDigest === 'function') {
        try {
            privateContextSummaries = await memory.updateConversationDigest(character, {
                rawWindow: contextLimit,
                visibleMessages: contextHistory
            });
        } catch (e) {
            console.warn(`[Engine] Private context summary refresh failed for ${character.name}: ${e.message}`);
            throw e;
        }
    }

    const conversationDigest = privateContextSummaries.length > 0
        ? {
            digest_text: privateContextSummaries.map((item, index) => {
                return `Summary ${index + 1} (${item.start_message_id}-${item.end_message_id}): ${String(item.summary_text || '').trim()}`;
            }).join('\n\n')
        }
        : null;
    const hasConversationDigest = Array.isArray(privateContextSummaries) && privateContextSummaries.length > 0;
    const liveHistoryWindowSize = Math.min(contextLimit, contextHistory.length);
    const liveHistory = liveHistoryWindowSize > 0 ? contextHistory.slice(-liveHistoryWindowSize) : [];
    const latestSummaryEndId = Number(privateContextSummaries[privateContextSummaries.length - 1]?.end_message_id || 0);
    const summaryBaselineId = Number(db.getCharacter?.(character.id)?.private_summary_baseline_message_id
        ?? character.private_summary_baseline_message_id ?? 0);
    const pendingSummaryMessages = contextLimit > 0
        ? contextHistory.slice(0, contextHistory.length - liveHistoryWindowSize)
            .filter(msg => Number(msg.id || 0) > Math.max(latestSummaryEndId, summaryBaselineId))
        : [];
    // Keep overflowed raw messages visible until a persisted summary covers them.
    const transformedHistory = dependencies.compileHistoryMessages(db, [...pendingSummaryMessages, ...liveHistory], {
        includeTimeSpeaker: true,
        characterName: character.name,
        userName: db.getUserProfile?.()?.name || 'User'
    });
    const latestUserMessage = [...liveHistory].reverse().find(m => m.role === 'user') || latestUserInWindow;
    const recentInputString = String(latestUserMessage?.content || '').trim();

    return {
        contextLimit,
        contextHistory,
        conversationDigest,
        privateContextSummaries,
        hasConversationDigest,
        liveHistoryWindowSize,
        liveHistory,
        pendingSummaryMessages,
        transformedHistory,
        latestUserMessage,
        recentInputString
    };
}

    return { preparePrivateConversationState };
}

module.exports = { createModule };
