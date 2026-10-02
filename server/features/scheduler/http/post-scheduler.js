// POST /scheduler
function register(dependencies) {
dependencies.router.post('/scheduler', require("../../../platform/http/trace.js").traceHttp("scheduler", "POST /scheduler"), dependencies.authMiddleware, (req, res) => {
        try {
            const db = dependencies.getSchedulerDb(req.user.id);
            const userDb = dependencies.getUserDb(req.user.id);
            const payload = dependencies.normalizeSchedulerTaskPayload(req.body || {});
            if (!userDb.getCharacter(payload.character_id)) {
                return res.status(404).json({ error: 'Character not found' });
            }
            const newId = db.addTask(payload);
            res.json({ success: true, id: newId });
        } catch (e) {
            console.error('[Scheduler] POST task error:', e);
            res.status(dependencies.isSchedulerValidationError(e) ? 400 : 500).json({ error: dependencies.isSchedulerValidationError(e) ? e.message : 'Internal Server Error' });
        }
    });
}
module.exports = { register };
