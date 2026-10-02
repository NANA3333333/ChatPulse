// POST /api/mcp-lab/knowledge
function register(dependencies) {
dependencies.app.post('/api/mcp-lab/knowledge', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "POST /api/mcp-lab/knowledge"), dependencies.authMiddleware, (req, res) => {
        try {
            const payload = dependencies.normalizeMcpKnowledgePayload(req.body || {});
            if (payload.character_id && !req.db.getCharacter?.(payload.character_id)) {
                return res.status(404).json({ success: false, error: 'Character not found.' });
            }
            const labDb = dependencies.ensureMcpLabDb(req.db);
            const doc = labDb.saveExternalKnowledge({
                owner_id: req.user?.id || '',
                character_id: payload.character_id,
                title: payload.title,
                content: payload.content,
                source_url: payload.source_url,
                source_type: payload.source_type,
                trust_level: payload.trust_level,
                tags: payload.tags
            }, labDb.chunkText(payload.content), dependencies.makeId);
            res.json({ success: true, doc });
        } catch (e) {
            res.status(dependencies.isMcpLabValidationError(e) ? 400 : 500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
