// POST /api/characters/:id/friends
function register(dependencies) {
dependencies.app.post('/api/characters/:id/friends', require("../../../platform/http/trace.js").traceHttp("relationships", "POST /api/characters/:id/friends"), dependencies.authMiddleware, async (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const { target_id } = req.body;
            const targetId = String(target_id || '').trim();
            if (!targetId) return res.status(400).json({ error: 'target_id is required' });

            const sourceChar = db.getCharacter(req.params.id);
            const targetChar = db.getCharacter(targetId);
            if (!sourceChar || !targetChar) return res.status(404).json({ error: 'Character not found' });

            const added = db.addFriend(sourceChar.id, targetChar.id);
            if (added) {
                db.addMessage(sourceChar.id, 'user', `[CONTACT_CARD:${targetChar.id}:${targetChar.name}:${targetChar.avatar}]`);
                db.addMessage(targetChar.id, 'user', `[CONTACT_CARD:${sourceChar.id}:${sourceChar.name}:${sourceChar.avatar}]`);
                dependencies.scheduleInitialImpressions({ db, callLLM: dependencies.callLLM, sourceChar, targetChar });
            }
            res.json({ success: true, added });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
