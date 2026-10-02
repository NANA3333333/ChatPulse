// PUT /api/mcp-lab/web-config
function register(dependencies) {
dependencies.app.put('/api/mcp-lab/web-config', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "PUT /api/mcp-lab/web-config"), dependencies.authMiddleware, (req, res) => {
        try {
            const profile = req.db.getUserProfile?.() || {};
            const keys = dependencies.safeParseJson(profile.web_search_keys_json, {});
            const incomingKeys = req.body?.keys || {};
            const clearIds = new Set(Array.isArray(req.body?.clear_ids) ? req.body.clear_ids.map(String) : []);
            for (const provider of dependencies.WEB_SEARCH_PROVIDERS) {
                if (clearIds.has(provider.id)) {
                    delete keys[provider.id];
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(incomingKeys, provider.id)) {
                    const value = String(incomingKeys[provider.id] || '').trim();
                    if (value) keys[provider.id] = value;
                }
            }
            const validProvider = dependencies.normalizeMcpProvider(req.body?.preferred_provider || profile.web_search_provider || 'auto');
            req.db.updateUserProfile?.({
                serper_api_key: String(keys.serper || ''),
                web_search_keys_json: JSON.stringify(keys),
                web_search_provider: validProvider
            });
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
            res.status(dependencies.isMcpLabValidationError(e) ? 400 : 500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
