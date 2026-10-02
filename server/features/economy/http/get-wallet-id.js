// GET /api/wallet/:id
function register(dependencies) {
dependencies.app.get('/api/wallet/:id', require("../../../platform/http/trace.js").traceHttp("economy", "GET /api/wallet/:id"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const walletId = String(req.params.id || '').trim();
            if (!walletId) return res.status(400).json({ error: 'Invalid wallet id' });
            if (walletId !== 'user' && !db.getCharacter(walletId)) {
                return res.status(404).json({ error: 'Character not found' });
            }
            res.json({ wallet: db.getWallet(walletId) });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
