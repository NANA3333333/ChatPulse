// GET /api/mcp-lab/status
function register(dependencies) {
dependencies.app.get('/api/mcp-lab/status', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "GET /api/mcp-lab/status"), dependencies.authMiddleware, (req, res) => {
        const resolved = dependencies.resolveSearchProvider(req.db);
        const config = dependencies.getWebSearchConfig(req.db);
        res.json({
            success: true,
            name: 'mcpLab',
            stage: 'experimental',
            search_provider: resolved.id,
            search_provider_label: resolved.label,
            preferred_search_provider: config.provider,
            web_search_providers: config.providers.map(({ id, label, env, docs, has_key, masked, source }) => ({ id, label, env, docs, has_key, masked, source })),
            has_serper_key: !!dependencies.getSerperApiKey(req.db),
            serper_key_masked: dependencies.maskSecret(dependencies.getSerperApiKey(req.db)),
            tools: [
                { id: 'web_search', label: 'Web Search', input_schema: { query: 'string' } },
                { id: 'fetch_url', label: 'Fetch URL', input_schema: { url: 'string' } },
                { id: 'knowledge.save_note', label: 'Save External Knowledge', input_schema: { title: 'string', content: 'string', source_url: 'string' } },
                { id: 'knowledge.search', label: 'Search External Knowledge', input_schema: { query: 'string' } },
                { id: 'context.inspect', label: 'Inspect Character Context', input_schema: { character_id: 'string' } }
            ],
            note: 'Experimental DLC tool layer. Character auto-tool calls are not enabled yet.'
        });
    });
}
module.exports = { register };
