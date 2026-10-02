// POST /api/groups/:id/messages
function register(dependencies) {
dependencies.app.post('/api/groups/:id/messages', require("../../../platform/http/trace.js").traceHttp("group-chat", "POST /api/groups/:id/messages"), dependencies.authMiddleware, async (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        let savedMsg;
        try {
            const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
            if (!content) return res.status(400).json({ error: 'A non-empty text message is required' });
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });

            // Save user message
            const baseProfile = typeof db.getUserProfile === 'function' ? db.getUserProfile() : null;
            const userProfile = baseProfile || { name: 'User', avatar: '' };
            const msgId = db.addGroupMessage(req.params.id, 'user', content, userProfile.name, userProfile.avatar);
            savedMsg = { id: msgId, group_id: req.params.id, sender_id: 'user', content, timestamp: Date.now(), sender_name: userProfile.name, sender_avatar: userProfile.avatar };

            // Broadcast to all WS clients
            const wsPayload = JSON.stringify({ type: 'group_message', data: savedMsg });
            wsClients.forEach(c => { if (c.readyState === 1) c.send(wsPayload); });

            // Parse @mentions from message content (user only can do @all)
            const allRef = /@(?:all|全体成员)/i.test(content);
            const isAtAll = allRef; // only user (sender) can use @all
            const charMembers = group.members.filter(m => m.member_id !== 'user');
            const mentionedIds = dependencies.resolveMentionedGroupCharacterIds(db, charMembers, content);

            for (const member of charMembers) {
                const memberChar = db.getCharacter(member.member_id);
                if (!memberChar) continue;
                const emotionPatch = dependencies.applyEmotionEvent(memberChar, 'group_user_message_received', {
                    isMentioned: mentionedIds.includes(member.member_id),
                    isAtAll
                });
                if (emotionPatch) {
                    db.updateCharacter(member.member_id, emotionPatch);
                    const mentionReason = isAtAll
                        ? '用户在群聊 ' + group.name + ' 中使用了 @all。'
                        : (mentionedIds.includes(member.member_id)
                            ? '用户在群聊 ' + group.name + ' 中点名提到了角色。'
                            : '用户在群聊 ' + group.name + ' 中发言，角色感知到群体互动变化。');
                    dependencies.logEmotionTransition(
                        db,
                        memberChar,
                        emotionPatch,
                        'group_user_message_received',
                        mentionReason
                    );
                }
                if (dependencies.context.hooks?.cityBusyChatImpactPatch) {
                    const busyPatch = dependencies.context.hooks.cityBusyChatImpactPatch(memberChar, 'group', {
                        isMentioned: mentionedIds.includes(member.member_id),
                        isAtAll
                    });
                    if (Object.keys(busyPatch).length > 0) {
                        db.updateCharacter(member.member_id, busyPatch);
                    }
                }
            }

            // ACCUMULATE mentions across rapid user messages (fix: previous debounce lost earlier @mentions)
            const groupId = req.params.id;
            const runtimeKey = dependencies.getGroupRuntimeKey(req.user.id, groupId);
            if (!dependencies.groupPendingMentions[runtimeKey]) {
                dependencies.groupPendingMentions[runtimeKey] = { ids: new Set(), isAtAll: false };
            }
            mentionedIds.forEach(id => dependencies.groupPendingMentions[runtimeKey].ids.add(id));
            if (isAtAll) dependencies.groupPendingMentions[runtimeKey].isAtAll = true;

            // Debounce: reset timer each time user sends a message; AI chain fires after LAST message.
            if (dependencies.groupDebounceTimers[runtimeKey]) {
                clearTimeout(dependencies.groupDebounceTimers[runtimeKey]);
            }
            // Mentions are time-sensitive: fire slightly faster than normal debounce
            const hasMentions = dependencies.groupPendingMentions[runtimeKey].ids.size > 0 || dependencies.groupPendingMentions[runtimeKey].isAtAll;
            const debounceDelay = hasMentions ? 1500 : 5000;
            dependencies.groupDebounceTimers[runtimeKey] = setTimeout(() => {
                delete dependencies.groupDebounceTimers[runtimeKey];
                const pending = dependencies.groupPendingMentions[runtimeKey] || { ids: new Set(), isAtAll: false };
                delete dependencies.groupPendingMentions[runtimeKey]; // consume accumulated mentions
                Promise.resolve().then(() => dependencies.triggerGroupAIChain(req.user.id, groupId, wsClients, Array.from(pending.ids), pending.isAtAll))
                    .catch(error => console.error('[GroupChat] Reply dispatch failed', { groupId, runId: req.runId, error: error.message }));
            }, debounceDelay);

            res.json({ success: true, message: savedMsg });
        } catch (e) {
            // The message is durable even if broadcasting or AI bookkeeping fails.
            // A failure response here would invite the client to send it again.
            if (savedMsg) {
                console.error('[GroupChat] Post-save action failed', { groupId: req.params.id, runId: req.runId, error: e.message });
                return res.json({ success: true, message: savedMsg, warnings: ['GROUP_POST_SAVE_FAILED'] });
            }
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
