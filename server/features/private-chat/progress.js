// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function createRagProgress(stepKey = 'switch') {
        const safeKey = dependencies.RAG_PROGRESS_STEP_KEYS.includes(stepKey) ? stepKey : 'switch';
        return {
            runId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            totalSteps: dependencies.RAG_PROGRESS_TOTAL_STEPS,
            currentKey: safeKey,
            currentStep: Math.max(1, dependencies.RAG_PROGRESS_STEP_KEYS.indexOf(safeKey) + 1),
            status: 'running',
            skipped: false,
            updatedAt: Date.now()
        };
    }

function updateRagProgress(characterId, wsClients, updates = {}) {
        if (!dependencies.timers.has(characterId)) return;
        const timerData = dependencies.timers.get(characterId) || {};
        const baseProgress = (timerData.ragProgress && typeof timerData.ragProgress === 'object')
            ? timerData.ragProgress
            : createRagProgress();
        const nextKey = updates.currentKey && dependencies.RAG_PROGRESS_STEP_KEYS.includes(updates.currentKey)
            ? updates.currentKey
            : (dependencies.RAG_PROGRESS_STEP_KEYS.includes(baseProgress.currentKey) ? baseProgress.currentKey : 'switch');
        const nextProgress = {
            ...baseProgress,
            ...updates,
            totalSteps: dependencies.RAG_PROGRESS_TOTAL_STEPS,
            currentKey: nextKey,
            currentStep: Number(updates.currentStep || (dependencies.RAG_PROGRESS_STEP_KEYS.indexOf(nextKey) + 1) || baseProgress.currentStep || 1),
            updatedAt: Date.now()
        };
        dependencies.timers.set(characterId, { ...timerData, ragProgress: nextProgress });
        dependencies.broadcastEngineState(wsClients);
    }

function clearCompletedRagProgressSoon(characterId, wsClients, runId, delayMs = 1400) {
        if (!characterId || !runId) return;
        setTimeout(() => {
            const timerData = dependencies.timers.get(characterId);
            const currentProgress = timerData?.ragProgress;
            if (!timerData || currentProgress?.runId !== runId || currentProgress?.status !== 'completed') {
                return;
            }
            dependencies.timers.set(characterId, { ...timerData, ragProgress: null });
            dependencies.broadcastEngineState(wsClients);
        }, delayMs);
    }

function setRagFailureState(characterId, state = null) {
        if (!characterId) return;
        if (!state) {
            dependencies.ragFailureCache.delete(characterId);
            return;
        }
        dependencies.ragFailureCache.set(characterId, {
            ...state,
            updatedAt: Date.now()
        });
    }

function getRagFailureState(characterId) {
        return dependencies.ragFailureCache.get(characterId) || null;
    }

    return { createRagProgress, updateRagProgress, clearCompletedRagProgressSoon, setRagFailureState, getRagFailureState };
}

module.exports = { createModule };
