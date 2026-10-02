// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function compactAntiRepeatText(value, maxLen = 260) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function pushUniqueAntiRepeat(items, item, maxItems = 6) {
    if (!Array.isArray(items) || !item?.text) return;
    const normalized = item.text.replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    if (items.some(existing => existing.text === normalized)) return;
    items.push({ ...item, text: normalized });
    if (items.length > maxItems) items.splice(0, items.length - maxItems);
}

function buildTypedAntiRepeatHints(db, character, options = {}) {
    const hints = {
        private_character_replies: [],
        city_private_outreach: [],
        city_self_logs: [],
        group_character_replies: []
    };
    if (!db || !character?.id) return hints;

    const privateLimit = Math.max(0, Math.min(Number(options.privateLimit ?? 18), Number(character.context_msg_limit ?? 60)));
    const cityLimit = Math.max(1, Number(options.cityLimit || 10));
    const groupLimit = Math.max(1, Number(options.groupLimit || 8));

    try {
        if (privateLimit > 0 && typeof db.getVisibleMessages === 'function') {
            const rows = db.getVisibleMessages(character.id, privateLimit) || [];
            for (const row of rows) {
                if (row?.role !== 'character') continue;
                const text = compactAntiRepeatText(row.content);
                if (!text) continue;
                const metadata = dependencies.parseMetadataObject(row.metadata);
                const source = metadata && typeof metadata === 'object'
                    ? String(metadata.source || metadata.origin || metadata.type || '').trim()
                    : '';
                const isCityOutreach = ['city_outreach', 'city_private_outreach', 'city_to_chat', 'background_city_outreach'].includes(source);
                const target = isCityOutreach ? hints.city_private_outreach : hints.private_character_replies;
                pushUniqueAntiRepeat(target, {
                    text,
                    timestamp: Number(row.timestamp || row.created_at || 0) || 0,
                    source: isCityOutreach ? 'city_private_outreach' : 'private_reply'
                }, 6);
            }
        }
    } catch (e) {
        console.warn('[ContextBuilder] Failed to build private anti-repeat hints:', e.message);
    }

    try {
        if (!db.city) {
            try {
                const initCityDb = require("../../city/cityDb.js");
                db.city = initCityDb(typeof db.getRawDb === 'function' ? db.getRawDb() : db);
            } catch (e) { /* ignore */ }
        }
        if (db.city && typeof db.city.getCharacterRecentLogs === 'function') {
            const logs = db.city.getCharacterRecentLogs(character.id, cityLimit) || [];
            for (const log of logs) {
                const text = compactAntiRepeatText(log.message);
                if (!text) continue;
                pushUniqueAntiRepeat(hints.city_self_logs, {
                    text,
                    timestamp: Number(log.timestamp || 0) || 0,
                    action_type: String(log.action_type || '').trim(),
                    location: String(log.location || '').trim(),
                    source: 'city_self_log'
                }, 6);
            }
        }
    } catch (e) {
        console.warn('[ContextBuilder] Failed to build city anti-repeat hints:', e.message);
    }

    try {
        if (typeof db.getGroups === 'function' && typeof db.getVisibleGroupMessages === 'function') {
            const groups = db.getGroups() || [];
            for (const group of groups) {
                const isMember = Array.isArray(group.members) && group.members.some(m => m.member_id === character.id);
                if (!isMember) continue;
                const memberEntry = group.members.find(m => m.member_id === character.id);
                const joinedAt = memberEntry?.joined_at || 0;
                const rows = db.getVisibleGroupMessages(group.id, groupLimit, joinedAt) || [];
                for (const row of rows) {
                    if (String(row.sender_id || '') !== String(character.id || '')) continue;
                    const text = compactAntiRepeatText(row.content);
                    if (!text) continue;
                    pushUniqueAntiRepeat(hints.group_character_replies, {
                        text,
                        timestamp: Number(row.timestamp || row.created_at || 0) || 0,
                        group_name: group.name || '',
                        source: 'group_reply'
                    }, 4);
                }
            }
        }
    } catch (e) {
        console.warn('[ContextBuilder] Failed to build group anti-repeat hints:', e.message);
    }

    return hints;
}

function flattenTypedAntiRepeatHints(hints = {}, options = {}) {
    const include = new Set(options.include || [
        'private_character_replies',
        'city_private_outreach',
        'city_self_logs',
        'group_character_replies'
    ]);
    const maxPerType = Math.max(1, Number(options.maxPerType || 4));
    const rows = [];
    for (const [type, items] of Object.entries(hints || {})) {
        if (!include.has(type) || !Array.isArray(items)) continue;
        for (const item of items.slice(-maxPerType)) {
            const text = compactAntiRepeatText(item?.text, options.maxTextLen || 220);
            if (!text) continue;
            rows.push({ type, text, timestamp: Number(item.timestamp || 0) || 0 });
        }
    }
    return rows.sort((a, b) => a.timestamp - b.timestamp);
}

function formatTypedAntiRepeatBlock(hints = {}, options = {}) {
    const rows = flattenTypedAntiRepeatHints(hints, options);
    if (rows.length === 0) return '';
    const typeLabels = {
        private_character_replies: '私聊里你刚说过',
        city_private_outreach: '商业街主动私聊里你刚说过',
        city_self_logs: '商业街行动记录刚写过',
        group_character_replies: '群聊里你刚说过'
    };
    const lines = rows.map((row) => `- ${typeLabels[row.type] || row.type}: ${row.text}`);
    const modeLine = options.mode === 'city_chat'
        ? '- 如果本轮要填写 chat，必须承接当前商业街事件说新的状态/发现/决定；不要复述上面这些话。只想延续旧争执时，chat 可以留空。'
        : '- 不要复制或近似改写上面这些角色自己已经说过/写过的话；可以承接事实，但要推进到新的角度、动作或判断。';
    return [
        options.title || '[Typed Anti-Repeat From Universal Context]',
        ...lines,
        modeLine,
        '- 用户输入、任务目标、身体数值和世界状态不是禁止词；它们只能作为要回应/承接的事实。'
    ].join('\n');
}

    return { compactAntiRepeatText, pushUniqueAntiRepeat, buildTypedAntiRepeatHints, flattenTypedAntiRepeatHints, formatTypedAntiRepeatBlock };
}

module.exports = { createModule };
