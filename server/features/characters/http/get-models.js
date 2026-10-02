// GET /api/models
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/models', require("../../../platform/http/trace.js").traceHttp("characters", "GET /api/models"), dependencies.authMiddleware, async (req, res) => {
    return dependencies.handleModelListProxy(req, res, req.query);
});
}
module.exports = { register };
