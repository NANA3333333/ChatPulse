// GET /scheduler/:charId
function register(dependencies) {
dependencies.router.get('/scheduler/:charId', require("../../../platform/http/trace.js").traceHttp("scheduler", "GET /scheduler/:charId"), dependencies.authMiddleware, (req, res) => {
        try {
            const db = dependencies.getSchedulerDb(req.user.id);
            const userDb = dependencies.getUserDb(req.user.id);
            const charId = req.params.charId;
            if (charId !== 'all' && !userDb.getCharacter(charId)) {
                return res.status(404).json({ error: 'Character not found' });
            }
            const tasks = charId === 'all' ? db.getTasks() : db.getTasks(charId);
            res.json(tasks);
        } catch (e) {
            console.error('[Scheduler] GET tasks error:', e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}
module.exports = { register };
