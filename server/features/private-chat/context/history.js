// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function formatMessageTimestampForLLM(timestamp) {
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

function resolveHistorySpeakerName(db, message, options = {}) {
    const role = String(message?.role || '').trim();
    if (role === 'user') {
        return String(options.userName || db.getUserProfile?.()?.name || 'User').trim() || 'User';
    }
    if (role === 'character') {
        return String(options.characterName || options.character?.name || 'Assistant').trim() || 'Assistant';
    }
    return String(options.systemName || 'System/Event').trim() || 'System/Event';
}

function formatHistoryMessageForLLM(db, message, options = {}) {
    const content = dependencies.formatMessageForLLM(db, String(message?.content || ''));
    if (!options.includeTimeSpeaker) return content;
    if (String(message?.role || '') === 'character') return content;
    const timestamp = formatMessageTimestampForLLM(message?.timestamp);
    const speaker = resolveHistorySpeakerName(db, message, options);
    const prefix = timestamp ? `[${timestamp}] ${speaker}:` : `${speaker}:`;
    return `${prefix} ${content}`;
}

function stripHistoryMetadataPrefixFromOutput(text = '') {
    return String(text || '')
        .replace(/^\s*\[\d{4}[\/-]\d{1,2}[\/-]\d{1,2}[\s,]+\d{1,2}:\d{2}(?::\d{2})?\]\s*[^:\n：]{1,48}[:：]\s*/gm, '')
        .trim();
}

function getCachedHistoryWindow(db, characterId, windowType, windowSize, messages, compileFn) {
    const normalizedMessages = Array.isArray(messages) ? messages.map(m => ({
        id: m?.id ?? null,
        role: m?.role || '',
        content: m?.content || ''
    })) : [];
    const sourceHash = dependencies.crypto.createHash('sha256').update(JSON.stringify(normalizedMessages)).digest('hex');
    const cached = typeof db.getHistoryWindowCache === 'function'
        ? db.getHistoryWindowCache(characterId, windowType, windowSize, sourceHash)
        : null;
    if (Array.isArray(cached?.compiled_json)) {
        return cached.compiled_json;
    }
    const compiledValue = compileFn?.();
    const compiledJson = Array.isArray(compiledValue) ? compiledValue : [];
    db.upsertHistoryWindowCache?.({
        character_id: characterId,
        window_type: windowType,
        window_size: windowSize,
        source_hash: sourceHash,
        message_ids_json: normalizedMessages.map(m => m.id).filter(id => id != null),
        compiled_json: compiledJson
    });
    return compiledJson;
}

function isBackgroundCharacterMessageAfterUser(message) {
    if (!message || String(message.role || '') !== 'character') return false;
    const meta = message.metadata && typeof message.metadata === 'object' ? message.metadata : {};
    const source = String(meta.source || meta.origin || meta.type || '').trim();
    return [
        'city_outreach',
        'city_private_outreach',
        'city_to_chat',
        'background_city_outreach'
    ].includes(source);
}

function markPostUserCharacterMessageAsEvent(message, character) {
    const meta = message?.metadata && typeof message.metadata === 'object' ? message.metadata : {};
    const source = String(meta.source || meta.origin || meta.type || '').trim();
    const isCityOutreach = isBackgroundCharacterMessageAfterUser(message);
    const label = isCityOutreach
        ? '商业街主动私聊事件'
        : '后台插入的角色主动消息';
    const charName = String(character?.name || '角色').trim() || '角色';
    const content = String(message?.content || '').trim();
    return {
        ...message,
        role: 'system',
        content: `[${label}，不是用户消息，也不是你对当前用户消息的正式回复。下面这句话是你刚刚主动发给用户的插入消息；可以作为你已说出口的事实和情绪连续性参考，但不要误认成 user 在对你说话。来源=${source || 'unknown'}]\n${charName}: ${content}`
    };
}

function compileHistoryMessages(db, messages, options = {}) {
    return (Array.isArray(messages) ? messages : []).map(m => ({
        role: m.role === 'character'
            ? 'assistant'
            : (m.role === 'user' ? 'user' : 'system'),
        content: formatHistoryMessageForLLM(db, m, options)
    }));
}

function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function stripInlineTags(text) {
    return String(text || '')
        .replace(/\[[A-Z_]+:[^\]]*?\]/g, '')
        .replace(/\[[A-Z_]+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractSpeechOpener(text) {
    const cleaned = stripInlineTags(text)
        .replace(/^[\s"'“”‘’]+/, '')
        .trim();
    if (!cleaned) return '';
    const punctuationLead = cleaned.match(/^(?:[.…·—\-~～]+|\.{2,}|。{2,})/);
    if (punctuationLead) return punctuationLead[0].slice(0, 4);
    const match = cleaned.match(/^(.{1,8}?)(?:[，。！？…\s]|$)/);
    return (match?.[1] || cleaned.slice(0, 6)).trim();
}

function hasOverusedEllipsisStyle(messages) {
    const recentAssistantMsgs = (Array.isArray(messages) ? messages : [])
        .filter(m => m.role === 'character')
        .slice(-4);
    if (recentAssistantMsgs.length < 3) return false;
    const ellipsisCount = recentAssistantMsgs.filter(msg => {
        const opener = extractSpeechOpener(msg.content || '');
        return /^(?:[.…·]+|\.{2,})$/.test(opener);
    }).length;
    return ellipsisCount >= 3;
}

function findWindowForwardOverlap(previousIds, currentIds) {
    const prev = Array.isArray(previousIds) ? previousIds : [];
    const curr = Array.isArray(currentIds) ? currentIds : [];
    const maxOverlap = Math.min(prev.length, curr.length);
    for (let overlap = maxOverlap; overlap > 0; overlap--) {
        if (arraysEqual(prev.slice(prev.length - overlap), curr.slice(0, overlap))) {
            return overlap;
        }
    }
    return 0;
}

function buildSlidingHistoryWindow(db, characterId, windowSize, messages, options = {}) {
    const normalizedMessages = Array.isArray(messages) ? messages.map(m => ({
        id: m?.id ?? null,
        role: m?.role || '',
        content: m?.content || ''
    })) : [];
    const currentIds = normalizedMessages.map(m => m.id).filter(id => id != null);
    const currentSourceHash = dependencies.crypto.createHash('sha256').update(JSON.stringify(normalizedMessages)).digest('hex');
    const exactCached = typeof db.getHistoryWindowCache === 'function'
        ? db.getHistoryWindowCache(characterId, 'private_llm_history_window', windowSize, currentSourceHash)
        : null;
    if (Array.isArray(exactCached?.compiled_json)) {
        return exactCached.compiled_json;
    }

    const previousWindow = typeof db.getLatestHistoryWindowCache === 'function'
        ? db.getLatestHistoryWindowCache(characterId, 'private_llm_history_window', windowSize)
        : null;
    const previousIds = Array.isArray(previousWindow?.message_ids_json) ? previousWindow.message_ids_json : [];
    const previousCompiled = Array.isArray(previousWindow?.compiled_json) ? previousWindow.compiled_json : [];
    let compiledJson = null;

    if (previousCompiled.length === previousIds.length && previousIds.length > 0) {
        const overlap = findWindowForwardOverlap(previousIds, currentIds);
        if (overlap > 0) {
            compiledJson = [
                ...previousCompiled.slice(previousCompiled.length - overlap),
                ...compileHistoryMessages(db, normalizedMessages.slice(overlap))
            ];
        }
    }

    if (!Array.isArray(compiledJson)) {
        compiledJson = compileHistoryMessages(db, normalizedMessages);
    }

    db.upsertHistoryWindowCache?.({
        character_id: characterId,
        window_type: 'private_llm_history_window',
        window_size: windowSize,
        source_hash: currentSourceHash,
        message_ids_json: currentIds,
        compiled_json: compiledJson,
        hit_count: 0,
        last_hit_at: 0
    });

    return compiledJson;
}

    return { formatMessageTimestampForLLM, resolveHistorySpeakerName, formatHistoryMessageForLLM, stripHistoryMetadataPrefixFromOutput, getCachedHistoryWindow, isBackgroundCharacterMessageAfterUser, markPostUserCharacterMessageAsEvent, compileHistoryMessages, arraysEqual, stripInlineTags, extractSpeechOpener, hasOverusedEllipsisStyle, findWindowForwardOverlap, buildSlidingHistoryWindow };
}

module.exports = { createModule };
