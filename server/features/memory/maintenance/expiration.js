// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function purgeExpiredForgettingMemoriesForRequest(req, source = 'memory-maintenance') {
    if (typeof req.memory?.purgeExpiredForgettingMemories !== 'function') return null;
    try {
        const result = await req.memory.purgeExpiredForgettingMemories({
            force: true,
            limit: 500,
            source
        });
        if (Number(result?.deleted || 0) > 0) {
            console.log(`[Memory] Auto-forgot ${result.deleted} expired memory row(s) before ${source} for user ${req.user.id}.`);
        }
        return result;
    } catch (e) {
        console.warn(`[Memory] Expired memory auto-forget failed before ${source}:`, e.message);
        return { success: false, error: e.message };
    }
}

    return { purgeExpiredForgettingMemoriesForRequest };
}

module.exports = { createModule };
