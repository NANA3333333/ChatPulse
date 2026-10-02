// GET /api/groups/:id/redpackets/:pid
function register(dependencies) {
dependencies.app.get('/api/groups/:id/redpackets/:pid', require("../../../platform/http/trace.js").traceHttp("economy", "GET /api/groups/:id/redpackets/:pid"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            const packetId = dependencies.normalizeRedPacketId(req.params.pid);
            if (!packetId) return res.status(400).json({ error: 'Invalid red packet id' });
            const pkt = db.getRedPacket(packetId);
            if (!pkt) return res.status(404).json({ error: 'Red packet not found' });
            if (String(pkt.group_id) !== String(group.id)) {
                return res.status(404).json({ error: 'Red packet not found' });
            }
            const enrichedClaims = pkt.claims.map(c => {
                const name = c.claimer_id === 'user'
                    ? (db.getUserProfile()?.name || 'User')
                    : (db.getCharacter(c.claimer_id)?.name || c.claimer_id);
                const avatar = c.claimer_id === 'user'
                    ? (db.getUserProfile()?.avatar || '')
                    : (db.getCharacter(c.claimer_id)?.avatar || '');
                return { ...c, name, avatar };
            });
            res.json({ ...pkt, claims: enrichedClaims });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
