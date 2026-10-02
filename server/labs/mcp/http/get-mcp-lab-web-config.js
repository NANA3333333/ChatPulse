// GET /api/mcp-lab/web-config
function register(dependencies) {
dependencies.app.get('/api/mcp-lab/web-config', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "GET /api/mcp-lab/web-config"), dependencies.authMiddleware, (req, res) => {
        try {
            const config = dependencies.getWebSearchConfig(req.db);
            const resolved = dependencies.resolveSearchProvider(req.db);
            res.json({
                success: true,
                preferred_provider: config.provider,
                active_provider: resolved.id,
                active_provider_label: resolved.label,
                saved_key_count: Object.values(config.keys || {}).filter(value => String(value || '').trim()).length,
                providers: config.providers.map(({ id, label, env, docs, has_key, masked, source }) => ({ id, label, env, docs, has_key, masked, source }))
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
