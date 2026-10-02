// PUT /api/mcp-lab/serper-config
function register(dependencies) {
dependencies.app.put('/api/mcp-lab/serper-config', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "PUT /api/mcp-lab/serper-config"), dependencies.authMiddleware, (req, res) => {
        try {
            const nextKey = String(req.body?.serper_api_key || '').trim();
            const profile = req.db.getUserProfile?.() || {};
            const keys = dependencies.safeParseJson(profile.web_search_keys_json, {});
            keys.serper = nextKey;
            req.db.updateUserProfile?.({
                serper_api_key: nextKey,
                web_search_keys_json: JSON.stringify(keys),
                web_search_provider: nextKey ? 'serper' : (profile.web_search_provider || 'auto')
            });
            const config = dependencies.getWebSearchConfig(req.db);
            const serper = config.providers.find(item => item.id === 'serper') || {};
            res.json({
                success: true,
                has_key: !!serper.has_key,
                source: serper.source || 'none',
                masked: serper.masked || ''
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
