// POST /api/mcp-lab/knowledge/search
function register(dependencies) {
dependencies.app.post('/api/mcp-lab/knowledge/search', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "POST /api/mcp-lab/knowledge/search"), dependencies.authMiddleware, (req, res) => {
        try {
            const payload = dependencies.normalizeMcpKnowledgeSearchPayload(req.body || {});
            if (payload.character_id && !req.db.getCharacter?.(payload.character_id)) {
                return res.status(404).json({ success: false, error: 'Character not found.' });
            }
            const labDb = dependencies.ensureMcpLabDb(req.db);
            res.json({
                success: true,
                results: labDb.searchExternalKnowledge(payload.query, payload)
            });
        } catch (e) {
            res.status(dependencies.isMcpLabValidationError(e) ? 400 : 500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
