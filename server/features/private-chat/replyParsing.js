// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

function normalizeGeneratedIntegerInRange(value, min, max) {
        const text = String(value ?? '').trim();
        if (!/^[+-]?\d+$/.test(text)) return null;
        const parsed = Number(text);
        return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
    }

function parseGeneratedBoundedTag(text, tagName, min, max, errorMessage) {
        const regex = new RegExp(`\\[${tagName}:\\s*([^\\]]*)\\]`, 'i');
        const match = String(text || '').match(regex);
        if (!match) return null;
        const parsed = normalizeGeneratedIntegerInRange(match[1], min, max);
        if (parsed === null) throw new Error(errorMessage);
        return parsed;
    }

function parseTaggedDelta(text, tagName, min, max) {
        return parseGeneratedBoundedTag(text, tagName, min, max, `AI returned invalid ${tagName} value. Please retry.`);
    }

function parseGeneratedAffinityDelta(text) {
        return parseGeneratedBoundedTag(text, 'AFFINITY', -100, 100, 'AI returned invalid affinity delta. Please retry.');
    }

function parseGeneratedCharAffinityDeltas(text, options = {}) {
        const raw = String(text || '');
        const selfId = String(options.selfId || '').trim();
        const allowedTargetIds = options.allowedTargetIds instanceof Set ? options.allowedTargetIds : null;
        const deltas = [];
        const tagRegex = /\[CHAR_AFFINITY:\s*([^\]]*)\]/gi;
        let match;
        while ((match = tagRegex.exec(raw)) !== null) {
            const payload = String(match[1] || '').trim();
            const splitAt = payload.lastIndexOf(':');
            if (splitAt <= 0) throw new Error('AI returned malformed character affinity tag. Please retry.');
            const targetId = payload.slice(0, splitAt).trim();
            const delta = normalizeGeneratedIntegerInRange(payload.slice(splitAt + 1), -100, 100);
            if (!targetId || delta === null) {
                throw new Error('AI returned invalid character affinity delta. Please retry.');
            }
            if (targetId === selfId || (allowedTargetIds && !allowedTargetIds.has(targetId)) || !dependencies.db.getCharacter?.(targetId)) {
                throw new Error('AI returned invalid character affinity target. Please retry.');
            }
            deltas.push({ targetId, delta });
        }
        return deltas;
    }

function normalizeGeneratedTransferAmount(value) {
        const text = String(value ?? '').trim();
        if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
        const amount = Number(text);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return +amount.toFixed(2);
    }

function normalizeGeneratedPressureLevel(value) {
        return normalizeGeneratedIntegerInRange(value, 0, 4);
    }

function addUsageTotals(baseUsage, extraUsage) {
        if (!extraUsage) return baseUsage || null;
        const next = baseUsage ? { ...baseUsage } : { prompt_tokens: 0, completion_tokens: 0 };
        next.prompt_tokens = (next.prompt_tokens || 0) + (extraUsage.prompt_tokens || 0);
        next.completion_tokens = (next.completion_tokens || 0) + (extraUsage.completion_tokens || 0);
        return next;
    }

function stripHiddenTagsForVisibleMessage(text) {
        return String(text || '')
            .replace(/\[(?:TIMER|TRANSFER|DIARY|UNLOCK_DIARY|AFFINITY|CHAR_AFFINITY|PRESSURE|PRESSURE_DELTA|JEALOUSY|MOOD_DELTA|EMOTION_REASON|EMOTION_STATE|CITY_INTENT|CITY_ACTION|WEB_SEARCH_INTENT|DIARY_PASSWORD|REDPACKET_SEND|Red Packet)[^\]]*\]/gi, '')
            .replace(/\[TTS_INTENT:\s*[\s\S]*?\]/gi, '')
            .replace(/\[\s*\]/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    return { clamp, normalizeGeneratedIntegerInRange, parseGeneratedBoundedTag, parseTaggedDelta, parseGeneratedAffinityDelta, parseGeneratedCharAffinityDeltas, normalizeGeneratedTransferAmount, normalizeGeneratedPressureLevel, addUsageTotals, stripHiddenTagsForVisibleMessage };
}

module.exports = { createModule };
