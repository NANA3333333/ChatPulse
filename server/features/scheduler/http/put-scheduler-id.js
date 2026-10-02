// PUT /scheduler/:id
function register(dependencies) {
dependencies.router.put('/scheduler/:id', require("../../../platform/http/trace.js").traceHttp("scheduler", "PUT /scheduler/:id"), dependencies.authMiddleware, (req, res) => {
        try {
            const db = dependencies.getSchedulerDb(req.user.id);
            const userDb = dependencies.getUserDb(req.user.id);
            const payload = dependencies.normalizeSchedulerTaskPayload(req.body || {});
            if (!userDb.getCharacter(payload.character_id)) {
                return res.status(404).json({ error: 'Character not found' });
            }
            const taskId = dependencies.normalizeSchedulerTaskId(req.params.id);
            const updated = db.updateTask(taskId, payload);
            if (!updated) return res.status(404).json({ error: 'Task not found' });
            res.json({ success: true });
        } catch (e) {
            console.error('[Scheduler] PUT task error:', e);
            res.status(dependencies.isSchedulerValidationError(e) ? 400 : 500).json({ error: dependencies.isSchedulerValidationError(e) ? e.message : 'Internal Server Error' });
        }
    });
}
module.exports = { register };
