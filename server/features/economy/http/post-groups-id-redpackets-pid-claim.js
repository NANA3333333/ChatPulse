// POST /api/groups/:id/redpackets/:pid/claim
function register(dependencies) {
dependencies.app.post('/api/groups/:id/redpackets/:pid/claim', require("../../../platform/http/trace.js").traceHttp("economy", "POST /api/groups/:id/redpackets/:pid/claim"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const claimer_id = 'user';
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            const packetId = dependencies.normalizeRedPacketId(req.params.pid);
            if (!packetId) return res.status(400).json({ error: 'Invalid red packet id' });
            const result = db.claimRedPacket(packetId, claimer_id, group.id);
            if (result.success) {
                // Broadcast real-time claim event via WebSocket
                const pkt = db.getRedPacket(packetId);
                const claimEvent = JSON.stringify({
                    type: 'redpacket_claim',
                    data: {
                        packet_id: packetId,
                        group_id: group.id,
                        claimer_id,
                        amount: result.amount,
                        remaining_count: pkt?.remaining_count ?? 0
                    }
                });
                wsClients.forEach(c => { if (c.readyState === 1) c.send(claimEvent); });
                res.json({ success: true, amount: result.amount, wallet: db.getWallet(claimer_id) });
            } else {
                res.status(400).json({ success: false, error: result.error });
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
