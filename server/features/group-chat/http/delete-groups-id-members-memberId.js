// DELETE /api/groups/:id/members/:memberId
function register(dependencies) {
dependencies.app.delete('/api/groups/:id/members/:memberId', require("../../../platform/http/trace.js").traceHttp("group-chat", "DELETE /api/groups/:id/members/:memberId"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            const memberId = String(req.params.memberId || '').trim();
            if (!memberId || memberId === 'user') return res.status(400).json({ error: 'Invalid group member id' });
            const isMember = group.members.some(m => String(m.member_id) === memberId);
            if (!isMember) return res.status(404).json({ error: 'Group member not found' });
            // Get char name before removing
            const char = db.getCharacter(memberId);
            const charName = char?.name || memberId;

            db.removeGroupMember(req.params.id, memberId);

            // Insert system announcement message
            const sysContent = '[System] ' + charName + ' 被移出了群聊';
            const sysMsgId = db.addGroupMessage(req.params.id, 'system', sysContent, 'System', '');
            const sysMsg = { id: sysMsgId, group_id: req.params.id, sender_id: 'system', content: sysContent, timestamp: Date.now(), sender_name: 'System', sender_avatar: '' };

            // Broadcast system message via WebSocket
            const wsPayload = JSON.stringify({ type: 'group_message', data: sysMsg });
            wsClients.forEach(c => { if (c.readyState === 1) c.send(wsPayload); });

            const updatedGroup = db.getGroup(req.params.id);
            res.json({ success: true, group: updatedGroup });

            // Trigger AI chain so remaining members react to the departure
            setTimeout(() => {
                dependencies.triggerGroupAIChain(req.user.id, req.params.id, wsClients, [], false, false);
            }, 1500);
        } catch (e) {
            res.status(e.status || 500).json({ error: e.message });
        }
    });
}
module.exports = { register };
