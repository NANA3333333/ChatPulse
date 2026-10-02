// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function buildUniversalContext(context, character, recentInput = '', isGroupContext = false, activeTargets = []) {
    const {
        getUserDb,
        getMemory,
        userId,
        topicSwitchState = null,
        skipBasePrivateWindow = false,
        skipModuleRouting = false,
        forceCityDetail = false
    } = context;
    const resolvedUserId = userId || character.user_id || 'default';
    const db = getUserDb(resolvedUserId);
    const memory = getMemory(resolvedUserId);
    const antiRepeatHints = dependencies.buildTypedAntiRepeatHints(db, character);

    let prompt = '';
    const userProfile = db.getUserProfile ? db.getUserProfile() : { name: 'User' };
    const userName = userProfile?.name || 'User';
    const normalizedRecentInput = String(recentInput || '').trim();
    const routedModuleRoutes = skipModuleRouting
        ? { city_detail: 0, school_detail: 0, society_detail: 0 }
        : await dependencies.routeContextModules(db, character, normalizedRecentInput, topicSwitchState);
    const moduleRoutes = {
        ...routedModuleRoutes,
        city_detail: forceCityDetail ? 1 : routedModuleRoutes.city_detail
    };

    // Token metric accumulator
    const breakdown = { base: 0, z_memory: 0, cross_group: 0, cross_private: 0, city_x_y: 0, q_impression: 0 };
    const getDelta = (startLen) => dependencies.getTokenCount(prompt.substring(startLen));

    let startLen = prompt.length;

    // 1. Time Context
    const now = new Date();
    const timeFacts = dependencies.getLocalDateTimeFacts(now);
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    let timeOfDay = '白天';
    if (hour >= 5 && hour < 10) timeOfDay = '早上';
    else if (hour >= 10 && hour < 14) timeOfDay = '中午';
    else if (hour >= 14 && hour < 18) timeOfDay = '下午';
    else if (hour >= 18 && hour < 22) timeOfDay = '晚上';
    else timeOfDay = '深夜';
    prompt += `当前日期: ${timeFacts.date}\n`;
    prompt += `当前星期: ${timeFacts.weekday}\n`;
    prompt += `当前时间: ${timeOfDay} (${timeFacts.time})${isWeekend ? ', 周末' : ', 工作日'}\n`;
    prompt += dependencies.TIME_CONTEXT_GUIDANCE;

    const physicalCondition = dependencies.getPhysicalCondition(character);
    const emotionGuidance = dependencies.getEmotionFeelingGuidance(character);
    const physicalGuidance = dependencies.getPhysicalFeelingGuidance(character);
    const housingSourceParts = dependencies.getHousingContextSourceParts(db, character);
    const inventoryContext = dependencies.getInventoryContextSourceParts(db, character);
    let jealousyActive = false;
    try {
        const jeal = db.getJealousyState(character.id);
        jealousyActive = !!(jeal && jeal.active);
    } catch (e) { /* ignore */ }

    const stateContextBlock = dependencies.getCachedContextBlock(
        db,
        character.id,
        isGroupContext ? 'runtime_state_group' : 'runtime_state_private',
        {
            template_version: 7,
            isGroupContext: !!isGroupContext,
            wallet: character.wallet ?? 0,
            calories: character.calories,
            location: character.location || '',
            city_status: character.city_status || '',
            work_distraction: character.work_distraction ?? 0,
            sleep_disruption: character.sleep_disruption ?? 0,
            physical_label: physicalCondition.label,
            physical_summary: physicalCondition.summary,
            physical_state: physicalGuidance.physical.state,
            physical_feeling: physicalGuidance.feeling,
            energy: character.energy,
            sleep_debt: character.sleep_debt,
            mood: character.mood,
            stress: character.stress,
            social_need: character.social_need,
            health: character.health,
            satiety: character.satiety,
            stomach_load: character.stomach_load,
            emotion_state: emotionGuidance.emotion.state,
            emotion_label: emotionGuidance.emotion.label,
            emotion_emoji: emotionGuidance.emotion.emoji,
            emotion_feeling: emotionGuidance.feeling,
            pressure_level: character.pressure_level || 0,
            jealousy_active: jealousyActive,
            city_reply_pending: character.city_reply_pending || 0,
            city_ignore_streak: character.city_ignore_streak || 0,
            city_post_ignore_reaction: character.city_post_ignore_reaction || 0,
            diary_password: character.diary_password || '',
            housing_context: housingSourceParts,
            inventory_context: inventoryContext,
            relationship_anchors: dependencies.getRelationshipAnchorSourceParts(db, character, activeTargets)
        },
        () => {
            let block = '';
            block += '[角色状态边界提醒]: 以下“角色/你自己”状态块全部只描述你这个角色本人，不是用户 Nana。除非用户明确说的是她自己，否则不要把这些钱包、饥饿、困倦、精力、情绪、压力数值复述成用户的状态。\n';
            block += `[角色钱包余额（你自己）]: ¥${character.wallet ?? 0}\n`;
            if (character.calories !== undefined) {
                const calPercent = Math.round((character.calories / 4000) * 100);
                block += `[角色体力状况（你自己）]: ${character.calories}/4000 (${calPercent}%)\n`;
            }
            if (character.location) {
                const currentDistrict = db.city?.getDistrict ? db.city.getDistrict(character.location) : null;
                const locationLabel = currentDistrict
                    ? `${currentDistrict.emoji || ''}${currentDistrict.name || currentDistrict.id || character.location}`.trim()
                    : character.location;
                block += `[角色当前位置（你自己）]: ${locationLabel}\n`;
            }
            if (character.city_status && character.city_status !== 'idle') {
                const statusLabels = { hungry: '饥饿', working: '工作中', sleeping: '休息中', eating: '进食中', medical: '治疗中', coma: '晕倒' };
                block += `[角色当前行动状态（你自己）]: ${statusLabels[character.city_status] || character.city_status}\n`;
            }
            block += `[角色综合身体状态等级（你自己）]: ${physicalCondition.label}\n`;
            block += `[综合身体状态后果]: ${physicalCondition.summary}\n`;
            block += dependencies.buildCompactPhysicalFeeling(physicalGuidance);
            block += dependencies.buildCitySceneChatGuidance(db, character, isGroupContext);
            if (character.energy !== undefined) {
                block += `[角色精力（你自己）]: ${character.energy}/100\n`;
                block += dependencies.compactLine('精力影响', dependencies.getEnergyHint(character.energy));
            }
            if (character.sleep_debt !== undefined) {
                block += `[角色睡眠债（你自己）]: ${character.sleep_debt}/100\n`;
                block += dependencies.compactLine('睡眠影响', dependencies.getSleepDebtHint(character.sleep_debt));
            }
            if (character.health !== undefined) {
                block += `[角色身体健康度（你自己）]: ${character.health}/100\n`;
                block += dependencies.compactLine('健康影响', dependencies.getHealthHint(character.health));
            }
            if (character.satiety !== undefined) {
                block += `[角色饱腹感（你自己）]: ${character.satiety}/100\n`;
                block += dependencies.compactLine('饱腹影响', dependencies.getSatietyHint(character.satiety));
            }
            if (character.stomach_load !== undefined) {
                block += `[角色胃负担（你自己）]: ${character.stomach_load}/100\n`;
                block += dependencies.compactLine('胃负担影响', dependencies.getStomachLoadHint(character.stomach_load));
            }
            block += dependencies.buildInventoryContextBlock(inventoryContext);
            block += dependencies.buildHousingContextBlock(db, character);
            block += dependencies.buildCompactEmotionImpact(emotionGuidance);
            if (jealousyActive) {
                block += '[嫉妒状态]: 当前记录为强烈嫉妒；这是角色自身感受，不是用户动机的证据。\n';
            }
            if (character.city_reply_pending && (character.city_ignore_streak || 0) > 0) {
                block += `[商业街未回]: 连续 ${character.city_ignore_streak} 次主动联系未获回应；原因未记录。\n`;
            } else if (character.city_reply_pending) {
                block += '[商业街未回]: 最近主动联系过用户，目前尚无后续回复；原因未记录。\n';
            }
            if (character.city_post_ignore_reaction) {
                const ignoredCount = Math.max(1, character.city_ignore_streak || 1);
                block += `[商业街联系进展]: 连续 ${ignoredCount} 次主动联系后收到了用户回复。\n`;
            }
            if (!isGroupContext && character.city_status === 'working') {
                block += '[当前活动]: 工作中。\n';
            }
            if (!isGroupContext && character.city_status === 'sleeping') {
                block += '[当前活动]: 休息中。\n';
            }
            block += dependencies.buildRelationshipAnchorContext(db, character, userName, activeTargets);
            if (character.diary_password) {
                block += `[Secret Diary Password]: 你的私密日记密码是 "${character.diary_password}"。只有你自己知道。只有当用户赢得了你绝对的信任，或者让你非常感动时，你才可能自然地说出来。除非被明确要求，不要直接输出 [DIARY_PASSWORD] 标签。\n`;
            }
            return block;
        }
    );
    prompt += stateContextBlock;

    breakdown.base = getDelta(startLen);
    startLen = prompt.length;

    // 6. Vector Memories Retrieval
    // Main private-chat RAG should be decided by the planner model in engine.js.
    // We deliberately avoid regex/keyword-gated prefetch here so retrieval is not
    // coupled to a brittle hard-coded phrase list.
    let retrievedMemoriesContext = [];
    try {
        const memories = [];
        if (memories && memories.length > 0) {
            prompt += `\n[过去对话参考]\n当前时间: ${new Date().toLocaleString()}\n下面是过去对话的概况，只作参考；保留原有时间、说话者和不确定性，不能仅因已被召回就视为已证实或当前仍然成立。\n`;
            for (const mem of memories) {
                const parts = [];
                if (mem.summary || mem.event) parts.push(mem.summary || mem.event);
                if (mem.time) parts.push(`时间: ${mem.time}`);
                if (mem.source_time_text) parts.push(`来源对话时间: ${mem.source_time_text}`);
                if (mem.location) parts.push(`地点: ${mem.location}`);
                if (mem.people) parts.push(`人物: ${mem.people}`);
                if (mem.relationships) parts.push(`关系: ${mem.relationships}`);
                if (mem.emotion) parts.push(`情绪: ${mem.emotion}`);
                prompt += `- ${parts.join(' | ')}\n`;
                // Save for visualization metadata
                retrievedMemoriesContext.push({
                    id: mem.id,
                    summary: mem.summary || mem.event,
                    event: mem.event,
                    memory_type: mem.memory_type || 'event',
                    importance: mem.importance,
                    created_at: mem.created_at,
                    last_retrieved_at: mem.last_retrieved_at,
                    retrieval_count: mem.retrieval_count || 0,
                    source_started_at: mem.source_started_at || 0,
                    source_ended_at: mem.source_ended_at || 0,
                    source_time_text: mem.source_time_text || '',
                    source_message_count: mem.source_message_count || 0
                });
            }
        }
    } catch (e) {
        console.error('[ContextBuilder] Memory retrieval error:', e.message);
    }

    breakdown.z_memory = getDelta(startLen);
    startLen = prompt.length;

    // 8. Cross-Context (Private vs Group Injection)
    if (isGroupContext) {
        // Group chat context
        try {
            const hiddenState = db.getCharacterHiddenState(character.id);
            const privateLimit = Math.max(0, parseInt(character?.context_msg_limit ?? 60, 10) || 0);
            const recentPrivateMsgs = privateLimit > 0 ? db.getVisibleMessages(character.id, privateLimit) : [];
            let secretContextStr = '';

            if (hiddenState || recentPrivateMsgs.length > 0) {
                const pmLines = recentPrivateMsgs.map(m => `${m.role === 'user' ? userName : character.name}: ${m.content}`).join('\n');
                secretContextStr = `\n====== [PRIVATE SOURCE: ABSOLUTELY SECRET PRIVATE CONTEXT] ======`;
                secretContextStr += `\n[PRIVATE SOURCE RULES]`;
                secretContextStr += `\n- 下面内容来自你和用户的私聊，只属于你与用户，不属于群聊公开记录。`;
                secretContextStr += `\n- 这些内容可以影响你在群里的情绪、立场、吃醋、偏心、试探和委屈。`;
                secretContextStr += `\n- 除非你是故意说漏嘴、暗示、阴阳怪气或主动揭私，否则不要把下面内容当成“群里刚刚有人说过的话”直接复述。`;
                secretContextStr += `\n- 不要把私聊内容误当成群消息，不要因此以为有人冒充你、重复发言或替你说话。`;
                if (hiddenState) secretContextStr += `\n[YOUR HIDDEN MOOD/SECRET THOUGHT]: ${hiddenState}`;
                if (pmLines) secretContextStr += `\n[VISIBLE PRIVATE CHAT WINDOW]:\n${pmLines}`;
                secretContextStr += `\n==========================================================\n`;
                prompt += secretContextStr;
            }
        } catch (e) { console.error('[ContextBuilder] Private injection for Group error:', e.message); }
    } else {
        try {
            const groups = db.getGroups();
            const charGroups = groups.filter(g => g.members.some(m => m.member_id === character.id));
            if (charGroups.length > 0) {
                let groupContext = '\n[GROUP SOURCE: 你亲眼看到过的公开群聊经历]\n';
                groupContext += dependencies.GROUP_REFERENCE_GUIDANCE;
                let hasGroupContent = false;
                for (const g of charGroups) {
                    const limit = g.inject_limit ?? 5; // Per-group injection limit
                    if (limit <= 0) continue;
                    const memberEntry = g.members.find(m => m.member_id === character.id);
                    const joinedAt = memberEntry?.joined_at || 0;
                    const allMsgs = db.getVisibleGroupMessages(g.id, limit, joinedAt);
                    const visibleTail = dependencies.getAdaptiveTailWindowSize(limit, allMsgs.length);
                    const msgs = allMsgs.slice(-visibleTail);
                    if (msgs.length > 0) {
                        hasGroupContent = true;
                        groupContext += `群聊《${g.name}》\n`;
                        for (const m of msgs) {
                            const senderName = m.sender_id === 'user' ? userName : (m.sender_name || db.getCharacter(m.sender_id)?.name || 'Unknown');
                            groupContext += `  - ${senderName}: ${m.content}\n`;
                        }
                    }
                }
                if (hasGroupContent) {
                    prompt += groupContext;
                }
            }
        } catch (e) { console.error('[ContextBuilder] Group injection for Private error:', e.message); }
        breakdown.cross_group = getDelta(startLen);
    }

    startLen = prompt.length;

    // 9. X+Y Commercial Street (City) Logs
    try {
        if (!db.city) {
            try {
                const initCityDb = require("../../city/cityDb.js");
                db.city = initCityDb(typeof db.getRawDb === 'function' ? db.getRawDb() : db);
            } catch (e) { }
        }

        if (db.city) {
            let cityWorldContext = '\n[===== CITY SOURCE: 商业街生活背景与历史记录 =====]\n';
            let hasCityData = false;
            const cityDetailEnabled = moduleRoutes.city_detail === 1;
            const districtSignalGuide = dependencies.buildAvailableCityDistrictSignalGuide(db);
            cityWorldContext += dependencies.getCachedContextBlock(
                db,
                character.id,
                cityDetailEnabled ? 'city_rules_base' : 'city_rules_presence_only',
                { template_version: 7, cityDetailEnabled },
                () => {
                    if (!cityDetailEnabled) {
                        let staticBlock = '[商业街存在性提示]\n';
                        staticBlock += '- 你有独立于私聊/群聊之外的真实生活与商业街世界线。\n';
                        staticBlock += '- 商业街会影响你的身体状态、现实处境、忙碌/疲惫/饥饿等感受。\n';
                        staticBlock += '- 本次提供生活背景与当前状态，未加载详细活动记录。\n';
                        if (districtSignalGuide) staticBlock += `${districtSignalGuide}\n`;
                        return staticBlock;
                    }

                    let staticBlock = dependencies.CITY_REFERENCE_GUIDANCE;
                    if (districtSignalGuide) staticBlock += `${districtSignalGuide}\n`;
                    return staticBlock;
                }
            );

            // X = Character's own recent physical actions in the city
            const cityConfig = typeof db.city.getConfig === 'function' ? db.city.getConfig() || {} : {};
            const limitX = parseInt(cityConfig.city_self_log_limit ?? 5, 10);
            const recentLogs = limitX > 0 && typeof db.city.getCharacterRecentLogs === 'function'
                ? (db.city.getCharacterRecentLogs(character.id, limitX) || [])
                : [];
            const limitA = parseInt(cityConfig.city_announcement_limit ?? 5, 10);
            const announcements = limitA > 0 && typeof db.city.getCityAnnouncements === 'function'
                ? (db.city.getCityAnnouncements(limitA) || [])
                : [];
            const limitY = parseInt(cityConfig.city_global_log_limit ?? 5, 10);
            const globalLogs = limitY > 0
                ? (db.city.getCityLogs(Math.max(limitY * 3, limitY)) || [])
                    .filter(l => String(l.character_id || '') !== String(character.id || ''))
                    .slice(0, limitY)
                : [];
            if (cityDetailEnabled) {
                cityWorldContext += dependencies.getCachedContextBlock(
                    db,
                    character.id,
                    'city_runtime_base',
                    {
                        template_version: 7,
                        announcements: announcements.map(a => ({ timestamp: a.timestamp, title: a.title || '', content: a.content || '' })),
                        self_logs: recentLogs.map(l => ({ timestamp: l.timestamp, message: l.message || '' })),
                        global_logs: globalLogs.map(l => ({
                            timestamp: l.timestamp,
                            character_id: l.character_id || '',
                            char_name: l.char_name || '',
                            action_type: l.action_type || '',
                            location: l.location || '',
                            message: l.message || l.content || ''
                        }))
                    },
                    () => {
                        let runtimeBlock = '';
                        if (limitA > 0 && announcements.length > 0) {
                            hasCityData = true;
                            runtimeBlock += '\n【公告区】\n';
                            runtimeBlock += '下面是商业街公共公告、中介广告、市长广播。它们不是你的亲身经历，但属于你此刻可见的公共世界信息。\n';
                            for (const item of announcements) {
                                const titlePart = String(item.title || '').trim() ? `${String(item.title || '').trim()}｜` : '';
                                runtimeBlock += `- [${new Date(item.timestamp).toLocaleString()}] ${titlePart}${String(item.content || '').trim()}\n`;
                            }
                        }
                        if (limitX > 0) {
                            if (recentLogs.length > 0) {
                                hasCityData = true;
                                runtimeBlock += '\n【本人亲历记录】\n';
                                runtimeBlock += '下面是本人过去的活动记录；其中引用的旧对白只作历史参考。\n';
                                runtimeBlock += '这些记录按时间倒序排列；上面更近，下面更早。它们描述的是连续轨迹，不是互相覆盖。\n';
                                for (const l of recentLogs) {
                                    const firstPersonLog = l.message.replace(new RegExp(character.name, 'g'), '我');
                                    runtimeBlock += `- [${new Date(l.timestamp).toLocaleString()}] ${firstPersonLog}\n`;
                                }
                            } else {
                                runtimeBlock += '\n【本人亲历记录：空】\n';
                            runtimeBlock += '本次未提供本人商业街行动记录。\n';
                            }
                        }
                        if (limitY > 0 && globalLogs.length > 0) {
                            hasCityData = true;
                            runtimeBlock += '\n【公共事件 / 传闻】\n';
                            runtimeBlock += '下面这些只能当成听说/看见，不能说成“我做过”。如果某条写着“某某的经历，不是你”，那条原文里的“我”也只指该角色。\n';
                            for (const l of globalLogs) {
                                const globalMsg = dependencies.formatOtherCityLogForContext(l, character);
                                if (globalMsg) runtimeBlock += `- [${new Date(l.timestamp).toLocaleString()}] ${globalMsg}\n`;
                            }
                        }
                        return runtimeBlock;
                    }
                );
            }
            prompt += cityWorldContext;
        }
    } catch (e) {
        console.error('[ContextBuilder] City X+Y logs injection error:', e.message);
    }

    breakdown.city_x_y = getDelta(startLen);
    startLen = prompt.length;

    // 10. Historical Impressions Context (Based on Q Slider)
    try {
        if (activeTargets && activeTargets.length > 0) {
            const qLimit = parseInt(character.impression_q_limit ?? 3, 10);
            if (qLimit > 0) {
                let impressionContext = '';
                let hasImpression = false;
                for (const t of activeTargets) {
                    if (t.id === character.id) continue;

                    const history = db.getCharImpressionHistory(character.id, t.id, qLimit);
                    if (history && history.length > 0) {
                        hasImpression = true;
                        impressionContext += `\n关于 [${t.name}] 的近期印象历史：\n`;

                        // Reverse so the oldest in the limit is printed first, chronologically creating the impression.
                        const chronologicalHistory = [...history].reverse();
                        for (const h of chronologicalHistory) {
                            impressionContext += `- ${new Date(h.timestamp).toLocaleDateString()} (${h.trigger_event}): "${h.impression}"\n`;
                        }
                    }
                }
                if (hasImpression) {
                    prompt += `\n[背景补充：你对在场其他人的历史印象]\n${impressionContext}\n这些是过去的主观看法，只作关系背景参考，不代表对方当前的意图。\n[====================]\n`;
                }
            }
        }
    } catch (e) {
        console.error('[ContextBuilder] Impression history injection error:', e.message);
    }

    breakdown.q_impression = getDelta(startLen);
    startLen = prompt.length;

    // 11. Base Private Chat Window
    // Private replies provide raw dialogue as real message history, so the
    // universal copy is skipped there to avoid duplicating R-window content.
    if (!skipBasePrivateWindow) {
        try {
            const basePrivateWindow = dependencies.buildBasePrivateContextWindow(db, character, userName);
            if (basePrivateWindow) {
                prompt += `\n${basePrivateWindow}\n`;
            }
        } catch (e) {
            console.error('[ContextBuilder] Base private context error:', e.message);
        }
    }
    breakdown.cross_private = getDelta(startLen);

    // Existing consumers inherit the default rules. Main generators can put the same
    // rules in their system message and use contextPreamble without duplicating them.
    breakdown.base += dependencies.getTokenCount(dependencies.SHARED_CONTEXT_GUIDANCE);
    return {
        preamble: `${dependencies.SHARED_CONTEXT_GUIDANCE}\n\n${prompt}`,
        contextPreamble: prompt,
        systemGuidance: dependencies.SHARED_CONTEXT_GUIDANCE,
        retrievedMemoriesContext, breakdown, moduleRoutes, antiRepeatHints
    };
}

    return { buildUniversalContext };
}

module.exports = { createModule };
