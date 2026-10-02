// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function stripGroupHiddenTags(text) {
        return String(text || '')
            .replace(dependencies.GROUP_HIDDEN_TAG_REGEX, '')
            .replace(/\[\s*\]/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

function normalizeGeneratedIntegerInRange(value, min, max) {
        const text = String(value ?? '').trim();
        if (!/^[+-]?\d+$/.test(text)) return null;
        const parsed = Number(text);
        return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
    }

function compactGroupPreview(text, maxLength = 24) {
        const cleaned = String(text || '')
            .replace(/\[[A-Z_]+:[^\]]*?\]/g, '')
            .replace(/\[[A-Z_]+\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned) return '';
        if (cleaned.length <= maxLength) return cleaned;
        return `${cleaned.slice(0, Math.max(12, maxLength - 1)).trim()}…`;
    }

function normalizeMentionName(value = '') {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    }

function normalizeGroupIntegerSetting(value, min, max) {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;
        return parsed;
    }

function normalizeGroupBooleanSetting(value) {
        const text = String(value ?? '').trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(text)) return 1;
        if (['0', 'false', 'no', 'off'].includes(text)) return 0;
        return null;
    }

function normalizeGroupName(value) {
        if (typeof value !== 'string') return '';
        return value.trim();
    }

function normalizeGeneratedRedPacketType(value) {
        const type = String(value || '').trim().toLowerCase();
        if (!dependencies.GENERATED_RED_PACKET_TYPES.has(type)) throw new Error('Invalid REDPACKET_SEND type');
        return type;
    }

function normalizeGeneratedRedPacketAmount(value) {
        const text = String(value || '').trim();
        if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Invalid REDPACKET_SEND amount');
        const amount = Number(text);
        if (!Number.isFinite(amount) || amount < 1 || amount > 200) throw new Error('Invalid REDPACKET_SEND amount');
        return +amount.toFixed(2);
    }

function normalizeGeneratedRedPacketCount(value) {
        const text = String(value || '').trim();
        if (!/^\d+$/.test(text)) throw new Error('Invalid REDPACKET_SEND count');
        const count = Number(text);
        if (!Number.isSafeInteger(count) || count < 1 || count > 20) throw new Error('Invalid REDPACKET_SEND count');
        return count;
    }

function buildCompactGroupAntiRepeat(character, messages) {
        const recentAssistantMsgs = (Array.isArray(messages) ? messages : [])
            .filter(m => m.sender_id === character.id)
            .slice(-5);
        if (recentAssistantMsgs.length === 0) return '';
        const recentTopics = [];
        for (const msg of recentAssistantMsgs) {
            const preview = compactGroupPreview(msg.content, 20);
            if (!preview) continue;
            if (!recentTopics.includes(preview)) recentTopics.push(preview);
            if (recentTopics.length >= 2) break;
        }
        if (recentTopics.length === 0) return '';
        return `\n[Anti-Repeat]\nRecent topics: ${recentTopics.join(' | ')}\nAvoid same jab, same defense, or same emotional line.`;
    }

    return { stripGroupHiddenTags, normalizeGeneratedIntegerInRange, compactGroupPreview, normalizeMentionName, normalizeGroupIntegerSetting, normalizeGroupBooleanSetting, normalizeGroupName, normalizeGeneratedRedPacketType, normalizeGeneratedRedPacketAmount, normalizeGeneratedRedPacketCount, buildCompactGroupAntiRepeat };
}

module.exports = { createModule };
