// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function queueEngineTask(keySuffix, task, options = {}) {
        return dependencies.enqueueBackgroundTask({
            key: `engine:${dependencies.userId}:${keySuffix}`,
            dedupeKey: options.dedupeKey ? `engine:${dependencies.userId}:${options.dedupeKey}` : '',
            maxPending: options.maxPending ?? 1,
            trace: options.trace,
            task
        });
    }

function getLatestUserMessageId(characterId) {
        if (typeof dependencies.db.getLatestUserMessage !== 'function') return 0;
        const latest = dependencies.db.getLatestUserMessage(characterId);
        return Number(latest?.id || 0);
    }

function isPrivateReplyStale(characterId, generationOptions = {}) {
        const targetUserMessageId = Number(generationOptions?.targetUserMessageId || 0);
        if (!targetUserMessageId) return false;
        return getLatestUserMessageId(characterId) > targetUserMessageId;
    }

function abortStalePrivateReply(character, wsClients, generationOptions = {}, phase = 'answer') {
        const targetUserMessageId = Number(generationOptions?.targetUserMessageId || 0);
        const latestUserMessageId = getLatestUserMessageId(character.id);
        console.log(`[Engine] Discarding stale private reply for ${character.name}: target user message ${targetUserMessageId}, latest ${latestUserMessageId} (${phase}).`);
        dependencies.timers.delete(character.id);
        if (generationOptions?.targetUserMessageId) {
            dependencies.updateRagProgress(character.id, wsClients, {
                currentKey: 'answer',
                status: 'skipped',
                skipped: true
            });
        }
        return { stale: true, targetUserMessageId, latestUserMessageId };
    }

function clearUserReplyDebounce(characterId) {
        const timerId = dependencies.userReplyDebounceTimers.get(characterId);
        if (timerId) {
            clearTimeout(timerId);
            dependencies.userReplyDebounceTimers.delete(characterId);
        }
    }

function createPrivateUserReplyRequest(characterId, wsClients, options = {}) {
        const char = dependencies.db.getCharacter(characterId);
        if (!char || char.status !== 'active' || char.is_blocked) return null;

        const hadPendingCityReply = !!char.city_reply_pending;
        const cityIgnoreStreak = Math.max(0, char.city_ignore_streak || 0);
        if (hadPendingCityReply) {
            dependencies.db.updateCharacter(characterId, {
                city_reply_pending: 0,
                city_post_ignore_reaction: cityIgnoreStreak > 0 ? 1 : 0
            });
        }

        return {
            ...options,
            wsClients,
            targetUserMessageId: Number(options?.targetUserMessageId || 0) || getLatestUserMessageId(characterId),
            hadPendingCityReply,
            cityIgnoreStreak,
            createdAt: Date.now()
        };
    }

function cleanupPrivateUserReplyRequest(characterId, request = {}) {
        const cleanupPatch = {};
        if (request.hadPendingCityReply) {
            cleanupPatch.city_post_ignore_reaction = 0;
            cleanupPatch.city_ignore_streak = 0;
        }
        if (Object.keys(cleanupPatch).length > 0) {
            dependencies.db.updateCharacter(characterId, cleanupPatch);
        }
    }

function mergePrivateUserReplyCleanup(previousRequest = {}, nextRequest = {}) {
        if (!previousRequest?.hadPendingCityReply) return nextRequest;
        return {
            ...nextRequest,
            hadPendingCityReply: true,
            cityIgnoreStreak: Math.max(
                Number(previousRequest.cityIgnoreStreak || 0),
                Number(nextRequest.cityIgnoreStreak || 0)
            )
        };
    }

function scheduleQueuedUserReply(characterId, wsClients, options = {}) {
        const request = createPrivateUserReplyRequest(characterId, wsClients, options);
        if (!request) return Promise.resolve({ skipped: true, reason: 'character_unavailable' });
        const previousRequest = dependencies.latestUserReplyRequests.get(characterId);
        const nextRequest = mergePrivateUserReplyCleanup(previousRequest, request);
        dependencies.latestUserReplyRequests.set(characterId, nextRequest);
        clearUserReplyDebounce(characterId);
        const debounceMs = Math.max(0, Number(options?.debounceMs ?? 1500) || 0);
        if (debounceMs === 0) {
            return queueLatestUserReply(characterId);
        }
        const timerId = setTimeout(() => {
            dependencies.userReplyDebounceTimers.delete(characterId);
            queueLatestUserReply(characterId).catch(err => {
                console.error(`[Engine] Failed to run queued user reply for ${characterId}:`, err.message);
            });
        }, debounceMs);
        dependencies.userReplyDebounceTimers.set(characterId, timerId);
        return Promise.resolve({ queued: true, targetUserMessageId: nextRequest.targetUserMessageId });
    }

async function runUserReplyRequest(characterId, request) {
        const freshChar = dependencies.db.getCharacter(characterId);
        if (!freshChar || freshChar.status !== 'active' || freshChar.is_blocked) {
            return { skipped: true, reason: 'character_unavailable' };
        }

        const {
            wsClients: requestWsClients,
            hadPendingCityReply,
            cityIgnoreStreak,
            debounceMs,
            createdAt,
            ...generationRequest
        } = request || {};

        const resumeRagState = generationRequest?.useRetryResume ? dependencies.getRagFailureState(characterId) : null;
        const resumedExtraSystemDirective = String(
            resumeRagState?.extraSystemDirective ||
            generationRequest?.extraSystemDirective ||
            ''
        ).trim() || null;

        try {
            return await dependencies.triggerMessage(
                freshChar,
                requestWsClients || new Set(),
                true,
                false,
                resumedExtraSystemDirective,
                {
                    ...generationRequest,
                    resumeRagState,
                    targetUserMessageId: Number(generationRequest?.targetUserMessageId || 0) || getLatestUserMessageId(characterId)
                }
            );
        } finally {
            cleanupPrivateUserReplyRequest(characterId, { hadPendingCityReply, cityIgnoreStreak });
        }
    }

function queueLatestUserReply(characterId) {
        if (dependencies.userReplyInFlight.has(characterId)) {
            return Promise.resolve({ queued: true, reason: 'reply_in_flight' });
        }
        const request = dependencies.latestUserReplyRequests.get(characterId);
        if (!request) return Promise.resolve({ skipped: true, reason: 'no_pending_reply' });

        dependencies.latestUserReplyRequests.delete(characterId);
        dependencies.userReplyInFlight.add(characterId);

        return queueEngineTask(
            `char:${characterId}`,
            () => runUserReplyRequest(characterId, request),
            {
                dedupeKey: `private-reply:${characterId}`,
                maxPending: 1,
                trace: request.trace
            }
        ).then(result => {
            if (result?.skipped && ['queue_full', 'duplicate'].includes(result.reason)) {
                dependencies.latestUserReplyRequests.set(characterId, request);
                if (!dependencies.userReplyDebounceTimers.has(characterId)) {
                    const retryTimer = setTimeout(() => {
                        dependencies.userReplyDebounceTimers.delete(characterId);
                        queueLatestUserReply(characterId).catch(err => {
                            console.error(`[Engine] Failed to retry queued user reply for ${characterId}:`, err.message);
                        });
                    }, 500);
                    dependencies.userReplyDebounceTimers.set(characterId, retryTimer);
                }
            }
            return result;
        }).finally(() => {
            dependencies.userReplyInFlight.delete(characterId);
            if (dependencies.latestUserReplyRequests.has(characterId) && !dependencies.userReplyDebounceTimers.has(characterId)) {
                queueLatestUserReply(characterId).catch(err => {
                    console.error(`[Engine] Failed to run follow-up queued user reply for ${characterId}:`, err.message);
                });
            }
        });
    }

function handleUserMessage(characterId, wsClients, options = {}) {
        const char = dependencies.db.getCharacter(characterId);
        if (!char || char.status !== 'active' || char.is_blocked) return;

        dependencies.recordReplyDispatch(characterId, {
            ...options,
            isUserReply: true,
            isTimerWakeup: false
        }, 'handleUserMessage called');
        console.log(`[Engine] User sent message to ${char.name}. Resetting timer.`);
        // User replies are serialized per character so rapid sends cannot save older AI output after newer user input.
        scheduleQueuedUserReply(characterId, wsClients, options).catch(err => {
            console.error(`[Engine] Failed to schedule user reply for ${char.name}:`, err.message);
        });

        // Stop current background timer
        dependencies.stopTimer(characterId);
    }

async function triggerImmediateUserReply(characterId, wsClients, options = {}) {
        const freshChar = dependencies.db.getCharacter(characterId);
        if (!freshChar || freshChar.status !== 'active' || freshChar.is_blocked) {
            throw new Error('角色不可用');
        }
        dependencies.recordReplyDispatch(characterId, {
            ...options,
            isImmediateReply: true,
            isUserReply: true,
            isTimerWakeup: false
        }, 'triggerImmediateUserReply called');
        dependencies.stopTimer(characterId);
        await scheduleQueuedUserReply(characterId, wsClients, {
            ...options,
            debounceMs: 0
        });
    }

    return { queueEngineTask, getLatestUserMessageId, isPrivateReplyStale, abortStalePrivateReply, clearUserReplyDebounce, createPrivateUserReplyRequest, cleanupPrivateUserReplyRequest, mergePrivateUserReplyCleanup, scheduleQueuedUserReply, runUserReplyRequest, queueLatestUserReply, handleUserMessage, triggerImmediateUserReply };
}

module.exports = { createModule };
