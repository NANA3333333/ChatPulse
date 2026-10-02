// POST /api/mcp-lab/tasks
function register(dependencies) {
dependencies.app.post('/api/mcp-lab/tasks', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "POST /api/mcp-lab/tasks"), dependencies.authMiddleware, async (req, res) => {
        try {
            const payload = dependencies.normalizeMcpTaskPayload(req.body || {});
            const task = {
                id: dependencies.makeId(),
                title: payload.title,
                kind: payload.kind,
                input: payload.input,
                status: 'queued',
                output: null,
                error: '',
                created_at: dependencies.nowIso(),
                started_at: '',
                finished_at: ''
            };
            task.owner_id = req.user?.id || '';
            const labDb = dependencies.ensureMcpLabDb(req.db);
            labDb.saveTask(task);
            if (req.body?.run_now !== false) await dependencies.runTask(task, { db: req.db });
            res.json({ success: true, task: labDb.getTask(task.id, req.user?.id || '') || task });
        } catch (e) {
            res.status(dependencies.isMcpLabValidationError(e) ? 400 : 500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
