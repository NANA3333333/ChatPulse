// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function recordTokenUsage(characterId, contextType, usage) {
        if (!usage || usage.cached) return;
        dependencies.db.addTokenUsage(characterId, contextType, usage.prompt_tokens || 0, usage.completion_tokens || 0);
    }

function recordLlmDebug(character, direction, payload, meta = {}) {
        if (!character || character.llm_debug_capture !== 1 || typeof dependencies.db.addLlmDebugLog !== 'function') return;
        try {
            const normalizedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
            dependencies.db.addLlmDebugLog({
                character_id: character.id,
                direction,
                context_type: meta.context_type || 'chat',
                payload: normalizedPayload,
                meta
            });
        } catch (e) {
            console.warn(`[Engine] Failed to record LLM debug for ${character?.name || character?.id}: ${e.message}`);
        }
    }

function recordReplyDispatch(characterId, options = {}, note = '') {
        if (!characterId || typeof dependencies.db.addReplyDispatchLog !== 'function') return;
        try {
            const latestUserMessage = typeof dependencies.db.getLatestUserMessage === 'function'
                ? dependencies.db.getLatestUserMessage(characterId)
                : null;
            dependencies.db.addReplyDispatchLog({
                character_id: characterId,
                source: options?.triggerSource || 'unknown',
                route: options?.triggerRoute || '',
                request_id: options?.requestId || '',
                latest_user_message_id: latestUserMessage?.id ?? null,
                latest_user_message_timestamp: latestUserMessage?.timestamp ?? null,
                payload: {
                    useRetryResume: !!options?.useRetryResume,
                    extraSystemDirective: String(options?.extraSystemDirective || '').trim(),
                    extraDirectiveRole: String(options?.extraDirectiveRole || '').trim(),
                    eventUserDirective: String(options?.eventUserDirective || '').trim(),
                    isImmediateReply: !!options?.isImmediateReply,
                    isUserReply: options?.isUserReply ?? null,
                    isTimerWakeup: options?.isTimerWakeup ?? null,
                    note: String(options?.triggerNote || '').trim()
                },
                note
            });
        } catch (e) {
            console.warn(`[Engine] Failed to record reply dispatch for ${characterId}: ${e.message}`);
        }
    }

function buildLlmAttemptRecorder(character, baseMeta = {}) {
        return (attemptMeta = {}) => {
            recordLlmDebug(character, attemptMeta.phase === 'start' ? 'attempt' : 'attempt_result', '', {
                ...baseMeta,
                llm_attempt: true,
                ...attemptMeta
            });
        };
    }

    return { recordTokenUsage, recordLlmDebug, recordReplyDispatch, buildLlmAttemptRecorder };
}

module.exports = { createModule };
