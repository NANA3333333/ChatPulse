// GET /api/transfers/:tid
function register(dependencies) {
dependencies.app.get('/api/transfers/:tid', require("../../../platform/http/trace.js").traceHttp("economy", "GET /api/transfers/:tid"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const transferId = dependencies.normalizeTransferId(req.params.tid);
            if (!transferId) return res.status(400).json({ error: 'Invalid transfer id' });
            const t = db.getTransfer(transferId);
            if (!t) return res.status(404).json({ error: 'Transfer not found' });
            res.json(t);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
}
module.exports = { register };
