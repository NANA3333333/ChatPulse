// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function changePrivateReplyVersion(characterId, messageId, wsClients, options) {
        return dependencies.changeReplyVersion(characterId, messageId, {
            ...options,
            notify: event => dependencies.broadcastEvent(wsClients, event),
            onStart: runId => {
                dependencies.stopTimer(characterId);
                dependencies.timers.set(characterId, { timerId: null, targetTime: Date.now(), isThinking: true,
                    ragProgress: { ...dependencies.createRagProgress('answer'), runId, skipped: true } });
                dependencies.broadcastEngineState(wsClients);
            },
            onFinish: completed => {
                dependencies.updateRagProgress(characterId, wsClients, { currentKey: 'answer', status: completed ? 'completed' : 'error', skipped: true });
                if (completed) dependencies.clearCompletedRagProgressSoon(characterId, wsClients, dependencies.timers.get(characterId)?.ragProgress?.runId);
                const character = dependencies.db.getCharacter(characterId);
                if (character && !dependencies.latestUserReplyRequests.has(characterId) && !dependencies.userReplyInFlight.has(characterId)) dependencies.scheduleNext(character, wsClients);
                else if (!character) dependencies.timers.delete(characterId);
                dependencies.broadcastEngineState(wsClients);
            }
        });
    }

    return { changePrivateReplyVersion };
}

module.exports = { createModule };
