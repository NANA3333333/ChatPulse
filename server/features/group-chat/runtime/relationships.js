// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function parseGeneratedAffinityDelta(text) {
        const match = String(text || '').match(/\[AFFINITY:\s*([^\]]*)\]/i);
        if (!match) return null;
        const delta = dependencies.normalizeGeneratedIntegerInRange(match[1], -100, 100);
        if (delta === null) throw new Error('Group AI returned invalid affinity delta. Please retry.');
        return delta;
    }

function parseGeneratedCharAffinityDeltas(db, text, options = {}) {
        const raw = String(text || '');
        const selfId = String(options.selfId || '').trim();
        const allowedTargetIds = options.allowedTargetIds instanceof Set ? options.allowedTargetIds : null;
        const deltas = [];
        const tagRegex = /\[CHAR_AFFINITY:\s*([^\]]*)\]/gi;
        let match;
        while ((match = tagRegex.exec(raw)) !== null) {
            const payload = String(match[1] || '').trim();
            const splitAt = payload.lastIndexOf(':');
            if (splitAt <= 0) throw new Error('Group AI returned malformed character affinity tag. Please retry.');
            const targetId = payload.slice(0, splitAt).trim();
            const delta = dependencies.normalizeGeneratedIntegerInRange(payload.slice(splitAt + 1), -100, 100);
            if (!targetId || delta === null) {
                throw new Error('Group AI returned invalid character affinity delta. Please retry.');
            }
            if (targetId === selfId || (allowedTargetIds && !allowedTargetIds.has(targetId)) || !db.getCharacter?.(targetId)) {
                throw new Error('Group AI returned invalid character affinity target. Please retry.');
            }
            deltas.push({ targetId, delta });
        }
        return deltas;
    }

function normalizeGroupMemberIds(value) {
        if (!Array.isArray(value)) return [];
        return Array.from(new Set(value
            .map(memberId => String(memberId || '').trim())
            .filter(Boolean)));
    }

function getInvalidGroupMemberIds(db, memberIds) {
        return memberIds.filter(memberId => memberId === 'user' || !db.getCharacter(memberId));
    }

    return { parseGeneratedAffinityDelta, parseGeneratedCharAffinityDeltas, normalizeGroupMemberIds, getInvalidGroupMemberIds };
}

module.exports = { createModule };
