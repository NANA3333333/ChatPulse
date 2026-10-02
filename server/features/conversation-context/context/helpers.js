// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function previewText(value, maxLen = 1200) {
    const text = String(value || '');
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}...<truncated>`;
}

function parseMetadataObject(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
}

function getCachedContextBlock(db, characterId, blockType, sourceParts, compileFn) {
    const sourceText = JSON.stringify(sourceParts || {});
    const sourceHash = dependencies.crypto.createHash('sha256').update(sourceText).digest('hex');
    const cached = typeof db.getPromptBlockCache === 'function'
        ? db.getPromptBlockCache(characterId, blockType, sourceHash)
        : null;
    if (cached?.compiled_text) return cached.compiled_text;
    const compiledText = String(compileFn() || '');
    db.upsertPromptBlockCache?.({
        character_id: characterId,
        block_type: blockType,
        source_hash: sourceHash,
        compiled_text: compiledText
    });
    return compiledText;
}

function buildBasePrivateContextWindow(db, character, userName = '用户') {
    if (!db || typeof db.getVisibleMessages !== 'function' || !character?.id) return '';
    try {
        const privateLimit = Math.max(0, parseInt(character?.context_msg_limit ?? 60, 10) || 0);
        if (privateLimit <= 0) return '';
        const rows = db.getVisibleMessages(character.id, privateLimit) || [];
        if (!Array.isArray(rows) || rows.length === 0) return '';

        const lines = rows.map(row => {
            let metadata = row?.metadata || null;
            if (typeof metadata === 'string' && metadata.trim()) {
                try { metadata = JSON.parse(metadata); } catch (e) { metadata = null; }
            }
            const source = metadata && typeof metadata === 'object'
                ? String(metadata.source || metadata.origin || metadata.type || '').trim()
                : '';
            const isCityOutreach = ['city_outreach', 'city_private_outreach', 'city_to_chat', 'background_city_outreach'].includes(source);
            const role = isCityOutreach
                ? `${character.name}（商业街主动私聊）`
                : row?.role === 'character'
                    ? character.name
                    : row?.role === 'system'
                        ? '系统'
                        : userName;
            const content = String(row?.content || '').trim();
            const timestamp = Number(row?.timestamp || row?.created_at || 0) || 0;
            const timeLabel = timestamp > 0 ? new Date(timestamp).toLocaleString() : '时间未知';
            return content ? `[${timeLabel}] ${role}: ${content}` : '';
        }).filter(Boolean);

        if (lines.length === 0) return '';
        return [
            `====== [BASE PRIVATE CHAT WINDOW / R=${privateLimit}] ======`,
            '[PRIVATE WINDOW RULES]',
            '- 下面内容来自你和用户的最近私聊窗口，是所有场景都会参考的基础上下文。',
            '- 这些私聊消息按时间从旧到新排列；越靠后的消息越新，最后几条通常最接近当前对话。',
            '- 每行开头的时间是该消息实际发生时间；判断“刚刚/刚才/现在”时，优先结合这些时间和当前轮最新 user 消息。',
            '- 它可以影响你对用户刚刚是否找过你、你们正在聊什么、你的情绪延续、商业街行动动机和对用户的回应。',
            '- 如果当前任务不是直接回复私聊，不要把这里的内容机械复述成活动记录；只把它当作连续生活背景。',
            '- 商业街主动私聊会标成“商业街主动私聊”，那仍然是你自己发给用户的话，不是用户说的话。',
            ...lines,
            '=========================================================='
        ].join('\n');
    } catch (e) {
        console.warn('[ContextBuilder] Failed to build base private context window:', e.message);
        return '';
    }
}

function compactLine(label, value) {
    if (!value) return '';
    return `[${label}]: ${value}\n`;
}

    return { previewText, parseMetadataObject, getCachedContextBlock, buildBasePrivateContextWindow, compactLine };
}

module.exports = { createModule };
