// POST /api/groups/:id/ai-pause
function register(dependencies) {
dependencies.app.post('/api/groups/:id/ai-pause', require("../../../platform/http/trace.js").traceHttp("group-chat", "POST /api/groups/:id/ai-pause"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            const id = dependencies.getGroupRuntimeKey(req.user.id, group.id);
            // Allow explicitly setting state from request body, otherwise fallback to toggle
            const requestedPause = req.body?.paused;
            const wantsPause = requestedPause !== undefined
                ? requestedPause === true || requestedPause === 1 || requestedPause === '1' || String(requestedPause).toLowerCase() === 'true'
                : !dependencies.pausedGroups.has(id);

            if (!wantsPause) {
                dependencies.pausedGroups.delete(id);
                // Restart proactive timer if it was running
                engine.scheduleGroupProactive(group.id, wsClients);
                res.json({ paused: false });
            } else {
                dependencies.pausedGroups.add(id);
                engine.stopGroupProactiveTimer(group.id);
                // Clear any pending debounce/chaining locks instantly
                if (dependencies.groupDebounceTimers[id]) { clearTimeout(dependencies.groupDebounceTimers[id]); delete dependencies.groupDebounceTimers[id]; }
                delete dependencies.groupReplyLock[id];
                res.json({ paused: true });
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
