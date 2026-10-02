// GET /api/tts/tencent/voices
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/tts/tencent/voices', require("../../../platform/http/trace.js").traceHttp("speech", "GET /api/tts/tencent/voices"), dependencies.authMiddleware, async (req, res) => {
    try {
        const result = await dependencies.getTencentVoiceList({ forceRefresh: req.query.refresh === '1' });
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
