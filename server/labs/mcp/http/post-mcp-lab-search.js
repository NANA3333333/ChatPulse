// POST /api/mcp-lab/search
function register(dependencies) {
dependencies.app.post('/api/mcp-lab/search', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "POST /api/mcp-lab/search"), dependencies.authMiddleware, async (req, res) => {
        let task = null;
        let labDb = null;
        try {
            const payload = dependencies.normalizeMcpSearchPayload(req.body || {});
            const resolved = dependencies.resolveSearchProvider(req.db, payload.provider);
            labDb = dependencies.ensureMcpLabDb(req.db);
            const query = payload.query;
            task = labDb.saveTask({
                id: dependencies.makeId(),
                owner_id: req.user?.id || '',
                title: dependencies.safeText(query || 'Web search', 160),
                kind: 'web_search',
                input: { query, provider: payload.provider || resolved.id, fetch_pages: payload.fetch_pages, fetch_page_limit: payload.fetch_page_limit },
                status: 'running',
                output: null,
                error: '',
                created_at: dependencies.nowIso(),
                started_at: dependencies.nowIso(),
                finished_at: ''
            });
            task.output = await dependencies.runWebSearch(query, {
                provider: resolved.id,
                apiKey: resolved.key,
                fetchPages: payload.fetch_pages,
                fetchPageLimit: payload.fetch_page_limit
            });
            task.status = 'done';
            task.finished_at = dependencies.nowIso();
            labDb.saveTask(task);
            res.json({
                success: true,
                result: task.output,
                task
            });
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
