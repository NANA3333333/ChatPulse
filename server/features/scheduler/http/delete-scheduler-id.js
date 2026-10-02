// DELETE /scheduler/:id
function register(dependencies) {
dependencies.router.delete('/scheduler/:id', require("../../../platform/http/trace.js").traceHttp("scheduler", "DELETE /scheduler/:id"), dependencies.authMiddleware, (req, res) => {
        try {
            const db = dependencies.getSchedulerDb(req.user.id);
            const taskId = dependencies.normalizeSchedulerTaskId(req.params.id);
            const deleted = db.deleteTask(taskId);
            if (!deleted) return res.status(404).json({ error: 'Task not found' });
            res.json({ success: true });
        } catch (e) {
            console.error('[Scheduler] DELETE task error:', e);
            res.status(dependencies.isSchedulerValidationError(e) ? 400 : 500).json({ error: dependencies.isSchedulerValidationError(e) ? e.message : 'Internal Server Error' });
        }
    });
}
module.exports = { register };
