// POST /api/groups/:id/members
function register(dependencies) {
dependencies.app.post('/api/groups/:id/members', require("../../../platform/http/trace.js").traceHttp("group-chat", "POST /api/groups/:id/members"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const { member_id } = req.body;
            const memberId = String(member_id || '').trim();
            if (!memberId) return res.status(400).json({ error: 'member_id is required' });
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            if (memberId === 'user' || !db.getCharacter(memberId)) {
                return res.status(400).json({ error: 'Invalid group member id' });
            }
            const alreadyMember = group.members.some(m => String(m.member_id) === memberId);
            if (alreadyMember) return res.status(409).json({ error: 'Group member already exists' });
            const added = db.addGroupMember(req.params.id, memberId);
            if (!added) return res.status(400).json({ error: 'Unable to add group member' });

            // Insert system announcement message
            const char = db.getCharacter(memberId);
            const charName = char?.name || memberId;
            const sysContent = '[System] ' + charName + ' 加入了群聊';
            const sysMsgId = db.addGroupMessage(req.params.id, 'system', sysContent, 'System', '');
            const sysMsg = { id: sysMsgId, group_id: req.params.id, sender_id: 'system', content: sysContent, timestamp: Date.now(), sender_name: 'System', sender_avatar: '' };

            // Broadcast system message via WebSocket
            const wsPayload = JSON.stringify({ type: 'group_message', data: sysMsg });
            wsClients.forEach(c => { if (c.readyState === 1) c.send(wsPayload); });

            const updatedGroup = db.getGroup(req.params.id);
            res.json({ success: true, group: updatedGroup });

            // Trigger AI chain so all members (including new one) react to the joining
            setTimeout(() => {
                dependencies.triggerGroupAIChain(req.user.id, req.params.id, wsClients, [memberId], true);
            }, 1500);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
