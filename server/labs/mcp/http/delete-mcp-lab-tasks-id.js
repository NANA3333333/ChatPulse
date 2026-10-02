// DELETE /api/mcp-lab/tasks/:id
function register(dependencies) {
dependencies.app.delete('/api/mcp-lab/tasks/:id', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "DELETE /api/mcp-lab/tasks/:id"), dependencies.authMiddleware, (req, res) => {
        try {
            const deleted = dependencies.ensureMcpLabDb(req.db).deleteTask(req.params.id, req.user?.id || '');
            if (!deleted) return res.status(404).json({ success: false, error: 'Task not found.' });
            res.json({ success: true, deleted });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
