// PUT /api/groups/:id
function register(dependencies) {
dependencies.app.put('/api/groups/:id', require("../../../platform/http/trace.js").traceHttp("group-chat", "PUT /api/groups/:id"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            const { inject_limit, name, context_msg_limit, group_proactive_enabled, group_interval_min, group_interval_max } = req.body;
            // Use raw SQL update since db wrapper doesn't have updateGroup
            const updates = [];
            const values = [];
            if (inject_limit !== undefined) {
                const injectLimit = dependencies.normalizeGroupIntegerSetting(inject_limit, 0, 30);
                if (injectLimit === null) return res.status(400).json({ error: 'Invalid inject limit' });
                updates.push('inject_limit = ?');
                values.push(injectLimit);
            }
            if (name !== undefined) {
                const groupName = dependencies.normalizeGroupName(name);
                if (groupName) {
                    updates.push('name = ?');
                    values.push(groupName);
                } else {
                    return res.status(400).json({ error: 'Invalid group name' });
                }
            }
            if (context_msg_limit !== undefined) {
                const contextLimit = dependencies.normalizeGroupIntegerSetting(context_msg_limit, 10, 200);
                if (contextLimit === null) return res.status(400).json({ error: 'Invalid context message limit' });
                updates.push('context_msg_limit = ?');
                values.push(contextLimit);
            }
            if (group_proactive_enabled !== undefined) {
                const enabled = dependencies.normalizeGroupBooleanSetting(group_proactive_enabled);
                if (enabled === null) return res.status(400).json({ error: 'Invalid group proactive setting' });
                updates.push('group_proactive_enabled = ?');
                values.push(enabled);
            }
            let nextIntervalMin = group.group_interval_min ?? 10;
            let nextIntervalMax = group.group_interval_max ?? 60;
            if (group_interval_min !== undefined) {
                const intervalMin = dependencies.normalizeGroupIntegerSetting(group_interval_min, 1, 1440);
                if (intervalMin === null) return res.status(400).json({ error: 'Invalid group proactive minimum interval' });
                nextIntervalMin = intervalMin;
                updates.push('group_interval_min = ?');
                values.push(intervalMin);
            }
            if (group_interval_max !== undefined) {
                const intervalMax = dependencies.normalizeGroupIntegerSetting(group_interval_max, 1, 1440);
                if (intervalMax === null) return res.status(400).json({ error: 'Invalid group proactive maximum interval' });
                nextIntervalMax = intervalMax;
                updates.push('group_interval_max = ?');
                values.push(intervalMax);
            }
            if ((group_interval_min !== undefined || group_interval_max !== undefined) && nextIntervalMax < nextIntervalMin) {
                return res.status(400).json({ error: 'Group proactive maximum interval cannot be lower than minimum interval' });
            }
            if (updates.length > 0) {
                values.push(req.params.id);
                db.rawRun(`UPDATE group_chats SET ${updates.join(', ')} WHERE id = ?`, values);
                if (context_msg_limit !== undefined && typeof db.clearGroupConversationDigest === 'function') {
                    db.clearGroupConversationDigest(req.params.id);
                }
                if (group_proactive_enabled !== undefined || group_interval_min !== undefined || group_interval_max !== undefined) {
                    engine.scheduleGroupProactive(group.id, wsClients);
                }
            }
            res.json({ success: true, group: db.getGroup(req.params.id) });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
