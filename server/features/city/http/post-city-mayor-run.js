// POST /api/city/mayor/run
function register(dependencies) {
dependencies.app.post('/api/city/mayor/run', require("../../../platform/http/trace.js").traceHttp("city", "POST /api/city/mayor/run"), dependencies.authMiddleware, async (req, res) => {
        try {
            dependencies.ensureCityDb(req.db);
            const result = await dependencies.maybeRunMayorAI(req.db, req.user?.id || 'manual', { force: true });
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
}
module.exports = { register };
