// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getDigestTailWindowSize(contextLimit, availableCount) {
    const safeLimit = Math.max(0, Number(contextLimit) || 0);
    const safeAvailable = Math.max(0, Number(availableCount) || 0);
    if (safeAvailable <= 0) return 0;
    return Math.min(safeAvailable, Math.max(3, Math.min(60, Math.ceil(safeLimit * 0.3))));
}

function extractMessagePlainText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(part => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object') {
                return String(part.text || part.content || '');
            }
            return '';
        }).join('\n');
    }
    if (content && typeof content === 'object') {
        return String(content.text || content.content || '');
    }
    return '';
}

function buildClaudePromptCacheEstimateMessages(messages = []) {
    let markedCount = 0;
    return (messages || []).map((msg, index) => {
        if (!msg || typeof msg !== 'object') return msg;
        const clone = { ...msg };
        const shouldMark = markedCount < 2 && (
            clone.role === 'system' ||
            (index > 0 && typeof clone.content === 'string' && clone.content.length >= 512)
        );
        if (shouldMark && typeof clone.content === 'string') {
            clone.content = [{
                type: 'text',
                text: clone.content,
                cache_control: { type: 'ephemeral' }
            }];
            markedCount += 1;
        }
        return clone;
    });
}

function estimateJsonWrapperTokensForMessages(messages = []) {
    const safeMessages = Array.isArray(messages) ? messages : [];
    const plainTextTokens = safeMessages.reduce((sum, message) => {
        return sum + dependencies.getTokenCount(extractMessagePlainText(message?.content || ''));
    }, 0);
    const messagesJsonTokens = dependencies.getTokenCount(JSON.stringify(safeMessages));
    return {
        plainTextTokens,
        messagesJsonTokens,
        wrapperTokens: Math.max(0, messagesJsonTokens - plainTextTokens)
    };
}

function estimateRequestBodyTokens(body) {
    return dependencies.getTokenCount(JSON.stringify(body || {}));
}

function formatContextStatsTimestamp(timestamp) {
    const ts = Number(timestamp || 0);
    if (!Number.isFinite(ts) || ts <= 0) return '';
    try {
        return new Date(ts).toLocaleString('zh-CN', {
            hour12: false,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (_) {
        return '';
    }
}

function formatContextStatsHistoryMessage(db, character, message) {
    const role = String(message?.role || '').trim();
    if (role === 'character') return String(message?.content || '');
    const speaker = role === 'user'
        ? String(db.getUserProfile?.()?.name || 'User').trim()
        : (role === 'character' ? String(character?.name || 'Assistant').trim() : 'System/Event');
    const timestamp = formatContextStatsTimestamp(message?.timestamp);
    const prefix = timestamp ? `[${timestamp}] ${speaker}:` : `${speaker}:`;
    return `${prefix} ${String(message?.content || '')}`;
}

    return { getDigestTailWindowSize, extractMessagePlainText, buildClaudePromptCacheEstimateMessages, estimateJsonWrapperTokensForMessages, estimateRequestBodyTokens, formatContextStatsTimestamp, formatContextStatsHistoryMessage };
}

module.exports = { createModule };
