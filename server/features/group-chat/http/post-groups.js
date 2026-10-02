// POST /api/groups
function register(dependencies) {
dependencies.app.post('/api/groups', require("../../../platform/http/trace.js").traceHttp("group-chat", "POST /api/groups"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const { name, member_ids } = req.body;
            const groupName = dependencies.normalizeGroupName(name);
            const memberIds = dependencies.normalizeGroupMemberIds(member_ids);
            if (!groupName || memberIds.length === 0) {
                return res.status(400).json({ error: 'name and member_ids are required' });
            }
            const invalidMemberIds = dependencies.getInvalidGroupMemberIds(db, memberIds);
            if (invalidMemberIds.length > 0) {
                return res.status(400).json({ error: 'Invalid group member ids', invalid_member_ids: invalidMemberIds });
            }
            const id = 'group_' + Date.now();
            // Generate a group avatar mosaic from members
            const firstMember = db.getCharacter(memberIds[0]);
            const avatar = firstMember?.avatar || 'https://api.dicebear.com/7.x/shapes/svg?seed=' + id;
            db.createGroup(id, groupName, memberIds, avatar);
            res.json({ success: true, group: db.getGroup(id) });
        } catch (e) {
            res.status(e.status || 500).json({ error: e.message, invalid_member_ids: e.invalid_member_ids });
        }
    });
}
module.exports = { register };
