// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function setGroupChainCallback(cb) {
        dependencies.groupChainCallback = cb;
    }

function stopGroupProactiveTimer(groupId) {
        if (dependencies.groupProactiveTimers.has(groupId)) {
            clearTimeout(dependencies.groupProactiveTimers.get(groupId));
            dependencies.groupProactiveTimers.delete(groupId);
        }
    }

function scheduleGroupProactive(groupId, wsClients) {
        if (dependencies.GROUP_AUTONOMY_DISABLED) return;
        stopGroupProactiveTimer(groupId);
        const group = dependencies.db.getGroup(groupId);
        if (!group?.group_proactive_enabled) return;

        const minMs = Math.max(1, group.group_interval_min || 10) * 60 * 1000;
        const maxMs = Math.max(minMs, (group.group_interval_max || 60) * 60 * 1000);
        const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

        console.log(`[GroupProactive] Group ${groupId}: next fire in ${Math.round(delay / 60000)} min`);
        const handle = setTimeout(() => {
            dependencies.groupProactiveTimers.delete(groupId);
            dependencies.queueEngineTask(
                `group:${groupId}`,
                () => triggerGroupProactive(groupId, wsClients),
                {
                    dedupeKey: `group-proactive:${groupId}`,
                    maxPending: 1
                }
            ).catch(err => {
                console.error(`[Engine] Failed to run group proactive task for ${groupId}:`, err.message);
            });
        }, delay);
        dependencies.groupProactiveTimers.set(groupId, handle);
    }

async function triggerGroupProactive(groupId, wsClients) {
        const group = dependencies.db.getGroup(groupId);
        if (!group) return;
        if (!group.group_proactive_enabled) return;
        const profile = dependencies.db.getUserProfile();

        // Pick a random eligible char member
        const charMembers = group.members.filter(m => m.member_id !== 'user');
        if (charMembers.length === 0) { scheduleGroupProactive(groupId, wsClients); return; }

        const shuffled = [...charMembers].sort(() => Math.random() - 0.5);
        let picked = null;
        for (const m of shuffled) {
            const c = dependencies.db.getCharacter(m.member_id);
            if (c && !c.is_blocked) { picked = c; break; }
        }
        if (!picked) { scheduleGroupProactive(groupId, wsClients); return; }

        // Get recent messages to avoid repetition
        const recentMsgs = dependencies.db.getVisibleGroupMessages(groupId, 10);
        const recentTexts = recentMsgs.slice(-5).map(m => `"${m.content}"`).join(', ');
        const userName = profile?.name || 'User';
        const historyForPrompt = recentMsgs.map(m => {
            const sName = m.sender_id === 'user' ? userName : (dependencies.db.getCharacter(m.sender_id)?.name || m.sender_name || '?');
            return { role: m.sender_id === picked.id ? 'assistant' : 'user', content: `[${sName}]: ${dependencies.formatMessageForLLM(dependencies.db, m.content)}` };
        });

        const now = new Date();
        const hour = now.getHours();
        const tod = hour < 6 ? '深夜' : hour < 10 ? '早上' : hour < 14 ? '中午' : hour < 18 ? '下午' : '晚上';

        // 1+2 Hybrid Hidden Context Injection
        const otherMembers = group.members
            .filter(m => m.member_id !== 'user' && m.member_id !== picked.id)
            .map(m => dependencies.db.getCharacter(m.member_id))
            .filter(Boolean);
        const engineContextWrapper = { getUserDb: dependencies.getUserDb, getMemory: require("../memory/index.js").getMemory, userId: dependencies.userId };
        const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, picked, recentTexts, true, otherMembers);
        const secretContextStr = `\n统一上下文：\n${universalResult?.preamble || ''}`;

        const systemPrompt = `你是${picked.name}，正在群聊"${group.name}"中。Persona: ${picked.persona || '普通人'}
现在是${tod}。你想主动在群里发一条消息，引发一些互动。
最近的对话：${recentTexts || '（无）'}
要求：
1. 说一句全新的话，不能重复上面的任何内容。
2. 可以发起新话题、聊生活、问问题、分享心情。
3. 保持口语化，1-2句。
4. 不要带名字前缀，直接说话。${secretContextStr}`;

        try {
            const { content: reply, usage } = await dependencies.callLLM({
                endpoint: picked.api_endpoint,
                key: picked.api_key,
                model: picked.model_name,
                messages: [{ role: 'system', content: systemPrompt }, ...historyForPrompt],
                maxTokens: picked.max_tokens || 300,
                returnUsage: true
            });
            dependencies.recordTokenUsage(picked.id, 'group_proactive', usage);
            if (reply && reply.trim()) {
                const clean = reply.trim().replace(/\[CHAR_AFFINITY:[^\]]*\]/gi, '').trim();
                if (clean) {
                    const msgId = dependencies.db.addGroupMessage(groupId, picked.id, clean, picked.name, picked.avatar);
                    const proactiveEmotionPatch = dependencies.applyEmotionEvent(picked, 'group_character_message_sent');
                    if (proactiveEmotionPatch) {
                        dependencies.db.updateCharacter(picked.id, proactiveEmotionPatch);
                    }
                    const payload = JSON.stringify({ type: 'group_message', data: { id: msgId, group_id: groupId, sender_id: picked.id, sender_name: picked.name, sender_avatar: picked.avatar, content: clean, timestamp: Date.now() } });
                    wsClients.forEach(c => { if (c.readyState === 1) c.send(payload); });
                    console.log(`[GroupProactive] ${picked.name} in ${group.name}. chars=${clean.length}`);

                    // Trigger other AIs to respond to this proactive message!
                    if (dependencies.groupChainCallback) {
                        // Small delay before firing the chain to simulate reading
                        setTimeout(() => dependencies.groupChainCallback(dependencies.userId, groupId, wsClients, [], false), 2000);
                    }
                }
            }
        } catch (e) {
            console.error(`[GroupProactive] Error for ${picked.name}:`, e.message);
        }
        scheduleGroupProactive(groupId, wsClients);
    }

function startGroupProactiveTimers(wsClients) {
        if (dependencies.GROUP_AUTONOMY_DISABLED) {
            if (!dependencies.loggedGroupAutonomyDisabled) {
                console.warn('[Engine] Group proactive timers are disabled by CP_GROUP_AUTONOMY=0.');
                dependencies.loggedGroupAutonomyDisabled = true;
            }
            return;
        }
        const groups = dependencies.db.getGroups();
        for (const g of groups) {
            scheduleGroupProactive(g.id, wsClients);
        }
    }

    return { setGroupChainCallback, stopGroupProactiveTimer, scheduleGroupProactive, triggerGroupProactive, startGroupProactiveTimers };
}

module.exports = { createModule };
