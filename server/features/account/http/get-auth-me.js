// GET /api/auth/me
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/auth/me', require("../../../platform/http/trace.js").traceHttp("account", "GET /api/auth/me"), dependencies.authMiddleware, (req, res) => {
    res.json({ success: true, user: req.user });
});
}
module.exports = { register };
