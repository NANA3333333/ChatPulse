// GET /api/media/uploads/:filename
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/media/uploads/:filename', require("../../../platform/http/trace.js").traceHttp("media", "GET /api/media/uploads/:filename"), dependencies.authMiddleware, (req, res) => {
    try {
        const filePath = dependencies.resolveUserUploadPath(req.user.id, req.params.filename);
        if (!filePath || !dependencies.fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.sendFile(filePath);
    } catch (e) {
        res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message });
    }
});
}
module.exports = { register };
