// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getCachedGroupPromptBlock(db, characterId, blockType, sourcePayload, buildFn) {
        const sourceHash = dependencies.crypto.createHash('sha256')
            .update(JSON.stringify(sourcePayload || {}))
            .digest('hex');
        const cached = typeof db?.getPromptBlockCache === 'function'
            ? db.getPromptBlockCache(characterId, blockType, sourceHash)
            : null;
        if (cached?.compiled_text) return cached.compiled_text;
        const compiledText = String(buildFn?.() || '');
        if (compiledText) {
            db?.upsertPromptBlockCache?.({
                character_id: characterId,
                block_type: blockType,
                source_hash: sourceHash,
                compiled_text: compiledText
            });
        }
        return compiledText;
    }

function normalizeGroupMessageLimit(value) {
        if (value === undefined) return 100;
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
        return Math.min(parsed, 200);
    }

function recordGroupLlmDebug(db, character, direction, payload, meta = {}) {
        if (!character || character.llm_debug_capture !== 1 || typeof db?.addLlmDebugLog !== 'function') return;
        try {
            db.addLlmDebugLog({
                character_id: character.id,
                direction,
                context_type: meta.context_type || 'group_chat',
                payload: typeof payload === 'string' ? payload : JSON.stringify(payload || []),
                meta: {
                    ...meta,
                    context_type: meta.context_type || 'group_chat'
                },
                timestamp: Date.now()
            });
        } catch (e) {
            console.warn(`[GroupChat] Failed to record LLM debug for ${character?.name || character?.id}: ${e.message}`);
        }
    }

    return { getCachedGroupPromptBlock, normalizeGroupMessageLimit, recordGroupLlmDebug };
}

module.exports = { createModule };
