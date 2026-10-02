// GET /api/mcp-lab/tasks
function register(dependencies) {
dependencies.app.get('/api/mcp-lab/tasks', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "GET /api/mcp-lab/tasks"), dependencies.authMiddleware, (req, res) => {
        try {
            const options = dependencies.normalizeMcpTaskListOptions(req.query || {});
            res.json({ success: true, tasks: dependencies.ensureMcpLabDb(req.db).listTasks(req.user?.id || '', options.limit) });
        } catch (e) {
            res.status(dependencies.isMcpLabValidationError(e) ? 400 : 500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
