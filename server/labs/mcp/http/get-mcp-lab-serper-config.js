// GET /api/mcp-lab/serper-config
function register(dependencies) {
dependencies.app.get('/api/mcp-lab/serper-config', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "GET /api/mcp-lab/serper-config"), dependencies.authMiddleware, (req, res) => {
        try {
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
