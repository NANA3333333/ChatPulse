// GET /api/system/announcement
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/system/announcement', require("../../../platform/http/trace.js").traceHttp("admin", "GET /api/system/announcement"), dependencies.authMiddleware, (req, res) => {
    try {
        const ann = dependencies.authDb.getLatestAnnouncement();
        res.json({ success: true, announcement: ann });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
