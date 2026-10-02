// GET /api/mcp-lab/context/:characterId
function register(dependencies) {
dependencies.app.get('/api/mcp-lab/context/:characterId', require("../../../platform/http/trace.js").traceHttp("mcp-lab", "GET /api/mcp-lab/context/:characterId"), dependencies.authMiddleware, (req, res) => {
        try {
            if (!req.db.city) {
                try {
                    const initCityDb = require("../../../features/city/cityDb.js");
                    req.db.city = initCityDb(typeof req.db.getRawDb === 'function' ? req.db.getRawDb() : req.db);
                } catch (e) { }
            }
            res.json({ success: true, context: dependencies.inspectContext(req.db, req.params.characterId) });
        } catch (e) {
            res.status(e.message === 'Character not found.' ? 404 : 500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
