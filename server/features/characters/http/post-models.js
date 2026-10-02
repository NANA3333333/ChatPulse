// POST /api/models
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/models', require("../../../platform/http/trace.js").traceHttp("characters", "POST /api/models"), dependencies.authMiddleware, async (req, res) => {
    return dependencies.handleModelListProxy(req, res, req.body);
});
}
module.exports = { register };
