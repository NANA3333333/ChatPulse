// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function logEmotionTransition(beforeState, patch, source, reason) {
        if (!patch || Object.keys(patch).length === 0 || typeof dependencies.db.addEmotionLog !== 'function') return;
        const afterState = { ...beforeState, ...patch };
        const entry = dependencies.buildEmotionLogEntry(beforeState, afterState, source, reason);
        if (entry) dependencies.db.addEmotionLog(entry);
    }

    return { logEmotionTransition };
}

module.exports = { createModule };
