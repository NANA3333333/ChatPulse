// POST /api/groups/:id/redpackets
function register(dependencies) {
dependencies.app.post('/api/groups/:id/redpackets', require("../../../platform/http/trace.js").traceHttp("economy", "POST /api/groups/:id/redpackets"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const { type, count, per_amount, total_amount, note } = req.body;
            const sender_id = 'user';
            const packetType = String(type || '').trim().toLowerCase();
            const packetCount = dependencies.normalizePacketCount(count);
            if (!['fixed', 'lucky'].includes(packetType) || !packetCount) {
                return res.status(400).json({ error: 'Invalid red packet type or count' });
            }
            const noteText = dependencies.normalizePaymentNote(note);
            if (noteText === null) return res.status(400).json({ error: 'Invalid note' });
            const groupId = req.params.id;
            const group = db.getGroup(groupId);
            if (!group) return res.status(404).json({ error: 'Group not found' });

            const perAmount = packetType === 'fixed' ? dependencies.normalizePositiveMoney(per_amount) : null;
            const total = packetType === 'fixed'
                ? (perAmount ? +(perAmount * packetCount).toFixed(2) : null)
                : dependencies.normalizePositiveMoney(total_amount);
            if (!total || total <= 0 || Math.round(total * 100) < packetCount) {
                return res.status(400).json({ error: 'Invalid red packet amount' });
            }

            const packetId = db.createRedPacket({
                groupId,
                senderId: sender_id,
                type: packetType,
                totalAmount: total,
                perAmount,
                count: packetCount,
                note: noteText
            });

            // Save message & broadcast
            const userProfile = db.getUserProfile();
            const senderName = sender_id === 'user'
                ? (userProfile?.name || 'User')
                : (db.getCharacter(sender_id)?.name || 'Unknown');
            const senderAvatar = sender_id === 'user'
                ? (userProfile?.avatar || '')
                : (db.getCharacter(sender_id)?.avatar || '');

            const content = `[REDPACKET:${packetId}]`;
            const msgId = db.addGroupMessage(groupId, sender_id, content, senderName, senderAvatar);
            const savedMsg = { id: msgId, group_id: groupId, sender_id, content, timestamp: Date.now(), sender_name: senderName, sender_avatar: senderAvatar };
            wsClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'group_message', data: savedMsg })); });


            res.json({ success: true, packet_id: packetId, message: savedMsg });

            // Trigger AI group chain so characters react to the red packet
            if (typeof dependencies.context.hooks.groupChainCallback === 'function') {
                setTimeout(() => {
                    dependencies.context.hooks.groupChainCallback(req.user.id, groupId, wsClients, [], false, false, [{ packetId, senderId: sender_id }]);
                }, 1500);
            }
        } catch (e) {
            console.error('[RedPacket] Create error:', e.message);
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
