// DELETE /api/diaries/:id
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.delete('/api/diaries/:id', require("../../../platform/http/trace.js").traceHttp("diaries", "DELETE /api/diaries/:id"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        if (typeof db.deleteDiary !== 'function') {
            return res.status(501).json({ error: 'Not implemented' });
        }
        const deleted = db.deleteDiary(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Diary not found' });
        res.json({ success: true, deleted });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
