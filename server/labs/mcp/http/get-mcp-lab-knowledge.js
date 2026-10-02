// GET /api/mcp-lab/knowledge
function register(dependencies) {
dependencies.app.get('/api/mcp-lab/knowledge', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "GET /api/mcp-lab/knowledge"), dependencies.authMiddleware, (req, res) => {
        try {
            const options = dependencies.normalizeMcpKnowledgeListOptions(req.query || {});
            if (options.character_id && !req.db.getCharacter?.(options.character_id)) {
                return res.status(404).json({ success: false, error: 'Character not found.' });
            }
            const labDb = dependencies.ensureMcpLabDb(req.db);
            res.json({
                success: true,
                docs: labDb.listExternalKnowledgeDocs(options)
            });
        } catch (e) {
            res.status(dependencies.isMcpLabValidationError(e) ? 400 : 500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
