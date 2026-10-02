// POST /api/mcp-lab/fetch
function register(dependencies) {
dependencies.app.post('/api/mcp-lab/fetch', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "POST /api/mcp-lab/fetch"), dependencies.authMiddleware, async (req, res) => {
        let task = null;
        let labDb = null;
        try {
            labDb = dependencies.ensureMcpLabDb(req.db);
            const url = dependencies.normalizeMcpHttpUrl(req.body?.url);
            task = labDb.saveTask({
                id: dependencies.makeId(),
                owner_id: req.user?.id || '',
                title: dependencies.safeText(url || 'Fetch URL', 160),
                kind: 'fetch_url',
                input: { url },
                status: 'running',
                output: null,
                error: '',
                created_at: dependencies.nowIso(),
                started_at: dependencies.nowIso(),
                finished_at: ''
            });
            task.output = await dependencies.runFetchUrl(url);
            task.status = 'done';
            task.finished_at = dependencies.nowIso();
            labDb.saveTask(task);
            res.json({ success: true, result: task.output, task });
        } catch (e) {
            if (task && labDb) {
                task.status = 'error';
                task.error = e.message;
                task.finished_at = dependencies.nowIso();
                labDb.saveTask(task);
            }
            res.status(dependencies.isMcpLabValidationError(e) ? 400 : 500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
