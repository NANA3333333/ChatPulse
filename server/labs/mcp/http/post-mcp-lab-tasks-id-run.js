// POST /api/mcp-lab/tasks/:id/run
function register(dependencies) {
dependencies.app.post('/api/mcp-lab/tasks/:id/run', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "POST /api/mcp-lab/tasks/:id/run"), dependencies.authMiddleware, async (req, res) => {
        try {
            const labDb = dependencies.ensureMcpLabDb(req.db);
            const task = labDb.getTask(req.params.id, req.user?.id || '');
            if (!task) return res.status(404).json({ success: false, error: 'Task not found.' });
            res.json({ success: true, task: await dependencies.runTask(task, { db: req.db }) });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
