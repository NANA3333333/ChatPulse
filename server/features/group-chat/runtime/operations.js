// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function recordGroupTokenUsage(db, characterId, contextType, usage) {
        if (!usage || !characterId || !db?.addTokenUsage) return;
        db.addTokenUsage(characterId, contextType, usage.prompt_tokens || 0, usage.completion_tokens || 0);
    }

function isAsciiMentionContinuation(char = '') {
        return /[a-z0-9._-]/i.test(String(char || ''));
    }

function readMentionTokenAfterAt(text = '', atIndex = -1) {
        if (atIndex < 0) return '';
        const tail = String(text || '').slice(atIndex + 1);
        const match = tail.match(/^([^\s@,，。.!！？;；:：()（）[\]【】]+)/);
        return dependencies.normalizeMentionName(match?.[1] || '');
    }

function resolveMentionedGroupCharacterIds(db, members = [], text = '', options = {}) {
        const selfId = String(options.selfId || '').trim();
        const rawText = String(text || '');
        if (!rawText.includes('@')) return [];
        const candidates = (Array.isArray(members) ? members : [])
            .map(member => {
                const memberId = String(member?.member_id || member || '').trim();
                if (!memberId || memberId === 'user' || memberId === selfId) return null;
                const char = db.getCharacter(memberId);
                if (!char) return null;
                const normalizedName = dependencies.normalizeMentionName(char.name);
                const normalizedId = dependencies.normalizeMentionName(char.id);
                if (!normalizedName && !normalizedId) return null;
                return { id: char.id, normalizedName, normalizedId };
            })
            .filter(Boolean)
            .sort((a, b) => Math.max(b.normalizedName.length, b.normalizedId.length) - Math.max(a.normalizedName.length, a.normalizedId.length));
        if (candidates.length === 0) return [];

        const mentioned = new Set();
        const atMatches = [...rawText.matchAll(/@/g)];
        for (const atMatch of atMatches) {
            const atIndex = atMatch.index ?? -1;
            const tail = rawText.slice(atIndex + 1, atIndex + 96);
            const normalizedTail = dependencies.normalizeMentionName(tail);
            const exact = candidates.find(candidate => {
                const aliases = [candidate.normalizedName, candidate.normalizedId].filter(Boolean);
                return aliases.some(alias => normalizedTail.startsWith(alias) && !isAsciiMentionContinuation(normalizedTail[alias.length] || ''));
            });
            if (exact) {
                mentioned.add(exact.id);
                continue;
            }

            const token = readMentionTokenAfterAt(rawText, atIndex);
            if (!token || token.length < 3) continue;
            const prefixMatches = candidates.filter(candidate => {
                const aliases = [candidate.normalizedName, candidate.normalizedId].filter(Boolean);
                return aliases.some(alias => alias.startsWith(token));
            });
            if (prefixMatches.length === 1) {
                mentioned.add(prefixMatches[0].id);
            }
        }

        return Array.from(mentioned);
    }

function buildGroupAttemptRecorder(db, character, baseMeta = {}) {
        return (attemptMeta = {}) => {
            dependencies.recordGroupLlmDebug(db, character, attemptMeta.phase === 'start' ? 'attempt' : 'attempt_result', '', {
                ...baseMeta,
                llm_attempt: true,
                ...attemptMeta
            });
        };
    }

function logEmotionTransition(db, beforeState, patch, source, reason) {
        if (!db?.addEmotionLog || !beforeState || !patch || Object.keys(patch).length === 0) return;
        const entry = dependencies.buildEmotionLogEntry(beforeState, { ...beforeState, ...patch }, source, reason);
        if (entry) db.addEmotionLog(entry);
    }

function triggerGroupAIChain(userId, groupId, wsClients, mentionedIds = [], isAtAll = false, isSecondaryChain = false, carriedRedPacketFeedback = []) {
        const db = dependencies.getUserDb(userId);
        const engine = dependencies.getEngine(userId);
        const memory = dependencies.getMemory(userId);
        const runtimeKey = dependencies.getGroupRuntimeKey(userId, groupId);
        if (!runtimeKey) return;

        if (dependencies.pausedGroups.has(runtimeKey)) return; // AI replies paused by user
        if (dependencies.groupReplyLock[runtimeKey]) {
            // Already running! Put mentions back so they fire in the NEXT chain.
            if (mentionedIds.length > 0 || isAtAll) {
                if (!dependencies.groupPendingMentions[runtimeKey]) dependencies.groupPendingMentions[runtimeKey] = { ids: new Set(), isAtAll: false };
                mentionedIds.forEach(id => dependencies.groupPendingMentions[runtimeKey].ids.add(id));
                if (isAtAll) dependencies.groupPendingMentions[runtimeKey].isAtAll = true;

                // Re-trigger debounce so they aren't lost indefinitely
                if (!dependencies.groupDebounceTimers[runtimeKey]) {
                    dependencies.groupDebounceTimers[runtimeKey] = setTimeout(() => {
                        delete dependencies.groupDebounceTimers[runtimeKey];
                        const pending = dependencies.groupPendingMentions[runtimeKey] || { ids: new Set(), isAtAll: false };
                        delete dependencies.groupPendingMentions[runtimeKey];
                        triggerGroupAIChain(userId, groupId, wsClients, Array.from(pending.ids), pending.isAtAll, false);
                    }, 4000);
                }
            }
            return;
        }
        dependencies.groupReplyLock[runtimeKey] = true;

        const group = db.getGroup(groupId);
        if (!group) { delete dependencies.groupReplyLock[runtimeKey]; return; }

        const charMembers = group.members.filter(m => m.member_id !== 'user');
        // Fisher-Yates shuffle
        const shuffled = [...charMembers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            // Ensure explicitly mentioned chars are moved to the front so they reply first
        }
        // Re-order: mentioned chars first, rest after
        const mentionedFirst = [
            ...shuffled.filter(m => mentionedIds.includes(m.member_id) || isAtAll),
            ...shuffled.filter(m => !mentionedIds.includes(m.member_id) && !isAtAll)
        ];

        (async () => {
            const pendingSecondaryChains = []; // collect @mention triggers to fire AFTER lock release
            const pendingRedPacketFeedback = [...carriedRedPacketFeedback]; // collect { packetId, senderId } for post-chain sender reaction
            let interruptedByRedPacket = false;
            let remainingMembers = [];

            try {
                for (let i = 0; i < mentionedFirst.length; i++) {
                    const member = mentionedFirst[i];
                    const char = db.getCharacter(member.member_id);
                    if (!char || char.is_blocked) continue;
                    const isMentioned = mentionedIds.includes(char.id) || isAtAll;

                    // Bystander / Unmentioned message filtering
                    if (!isMentioned) {
                        if (isSecondaryChain) {
                            // If this is an AI-to-AI interaction (secondary chain), ONLY the mentioned char can talk.
                            // Unmentioned AIs MUST NOT speak, to prevent infinite loops (char@char should only trigger that char).
                            continue;
                        }

                    }

                    // Broadcast "typing" indicator
                    const typingPayload = JSON.stringify({ type: 'group_typing', data: { group_id: groupId, sender_id: char.id, name: char.name } });
                    wsClients.forEach(c => { if (c.readyState === 1) c.send(typingPayload); });

                    // Random delay 2-5 seconds before this character speaks
                    const delay = Math.floor(2000 + Math.random() * 3000);
                    await new Promise(resolve => setTimeout(resolve, delay));

                    try {
                        // Re-fetch messages RIGHT NOW so this char sees all prior replies
                        const userProfile = db.getUserProfile();
                        const groupMsgLimit = group.context_msg_limit || 60; // Use saved limit or default 60
                        // Filter: new members can only see messages from after they joined
                        const memberEntry = group.members.find(m => m.member_id === char.id);
                        const joinedAt = memberEntry?.joined_at || 0;
                        const allRecentGroupMsgs = db.getVisibleGroupMessages(groupId, groupMsgLimit, joinedAt);
                        const liveGroupWindowSize = dependencies.getAdaptiveTailWindowSize(groupMsgLimit, allRecentGroupMsgs.length);
                        const recentGroupMsgs = allRecentGroupMsgs.slice(-liveGroupWindowSize);
                        const userName = userProfile?.name || 'User';

                        const formatMessageForLLM = (db, content) => {
                            if (!content) return '';
                            try {
                                if (content.startsWith('[CONTACT_CARD:')) {
                                    const parts = content.split(':');
                                    if (parts.length >= 3) {
                                        const userName = db.getUserProfile()?.name || 'User';
                                        return `[System Notice: ${userName} shared a Contact Card with you for a new friend named "${parts[2]}". You are now friends with them.]`;
                                    }
                                }
                                if (content.startsWith('[TRANSFER]')) {
                                    const parts = content.replace('[TRANSFER]', '').trim().split('|');
                                    const tId = parseInt(parts[0]);
                                    const amount = parts[1] || '0';
                                    const note = parts.slice(2).join('|') || '';
                                    const t = db.getTransfer(tId);
                                    if (t) {
                                        const status = t.claimed ? '（已被对方领取）' : (t.refunded ? '（已退还）' : '（待领取）');
                                        return `[转账: ¥${amount}, 备注: "${note}" ${status}]`;
                                    }
                                    return `[转账: ¥${amount}, 备注: "${note}"]`;
                                }
                                const rpMatch = content.match(/^\[REDPACKET:(\d+)\]$/);
                                if (rpMatch) {
                                    const pId = parseInt(rpMatch[1]);
                                    const rp = db.getRedPacket(pId);
                                    if (rp) {
                                        let statusStr = '';
                                        if (rp.remaining_count === 0) {
                                            statusStr = '（已抢光）';
                                        } else {
                                            statusStr = '（剩余 ' + rp.remaining_count + '/' + rp.count + ' 份）';
                                        }
                                        let claimNote = '';
                                        if (rp.claims && rp.claims.length > 0) {
                                            const claimers = rp.claims.map(c => {
                                                const cName = c.claimer_id === 'user' ? (db.getUserProfile()?.name || '用户') : (db.getCharacter(c.claimer_id)?.name || c.claimer_id);
                                                return `${cName}(¥${c.amount})`;
                                            }).join(', ');
                                            claimNote = ` 领取记录: ${claimers}`;
                                        }
                                        const senderName = rp.sender_id === 'user' ? '用户' : (db.getCharacter(rp.sender_id)?.name || rp.sender_id);
                                        return `[${senderName}发了一个群红包: ¥${rp.total_amount}${rp.type === 'lucky' ? '(拼手气)' : '(普通)'}, 备注: "${rp.note}" ${statusStr}${claimNote}]`;
                                    }
                                    return `[群红包]`;
                                }
                            } catch (e) { }
                            return content;
                        };

                        const history = recentGroupMsgs.map(m => {
                            const senderName = m.sender_id === 'user' ? userName : (db.getCharacter(m.sender_id)?.name || m.sender_name || 'Unknown');
                            return { role: m.sender_id === char.id ? 'assistant' : 'user', content: `[${senderName}]: ${formatMessageForLLM(db, m.content)} ` };
                        });

                        const recentInput = history.slice(-2).map(m => m.content).join(' ');
                        const groupConversationDigest = typeof db.getGroupConversationDigest === 'function'
                            ? db.getGroupConversationDigest(groupId, char.id)
                            : null;
                        const digestBlock = typeof memory.formatGroupConversationDigestForPrompt === 'function'
                            ? memory.formatGroupConversationDigestForPrompt(groupConversationDigest, { recentMessages: recentGroupMsgs })
                            : '';

                        // Build relationship-aware member descriptions
                        const otherMembers = group.members.filter(m => m.member_id !== char.id);

                        // Extract char objects for Universal Context (Impression History injection)
                        const activeTargets = otherMembers
                            .filter(m => m.member_id !== 'user')
                            .map(m => db.getCharacter(m.member_id))
                            .filter(c => c && !c.is_blocked);

                        // --- Use Universal Context Builder ---
                        const engineContextWrapper = { getUserDb: dependencies.getUserDb, getMemory: dependencies.context.getMemory, userId };
                        const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, char, recentInput, true, activeTargets);

                        const knownMembers = [];
                        const unknownMembers = [];

                        for (const m of otherMembers) {
                            if (m.member_id === 'user') {
                                const userRel = db.getCharRelationship(char.id, 'user');
                                knownMembers.push(`- ${userName} (id: user, 好感度: ${userRel?.affinity ?? char.affinity ?? 50})`);
                                continue;
                            }
                            const otherChar = db.getCharacter(m.member_id);
                            if (!otherChar) continue;
                            const rel = db.getCharRelationship(char.id, otherChar.id);
                            if (rel && rel.isAcquainted) {
                                knownMembers.push(`- ${otherChar.name} (id: ${otherChar.id}, 好感度: ${rel.affinity}, 印象: "${rel.impression}")`);
                            } else {
                                unknownMembers.push(`- ${otherChar.name} (id: ${otherChar.id}, 你不认识这个人，只知道名字)`);
                            }
                        }

                        let relationSection = '';
                        if (knownMembers.length > 0) {
                            relationSection += `\n你认识的人：\n${knownMembers.join('\n')} `;
                        }
                        if (unknownMembers.length > 0) {
                            relationSection += `\n你不认识的人：\n${unknownMembers.join('\n')} `;
                        }

                        // List char's own recent messages to prevent repetition
                        const noRepeatNote = dependencies.buildCompactGroupAntiRepeat(char, recentGroupMsgs);
                        const mentionNote = isMentioned
                            ? `\n[MENTION]: Someone just @mentioned you directly! You MUST reply to this message; don't ignore it.`
                            : '';

                        const emotionGuidance = dependencies.getEmotionBehaviorGuidance(char);
                        const mentionableNames = charMembers
                            .map(m => db.getCharacter(m.member_id)?.name)
                            .filter(Boolean)
                            .map(name => '@' + name)
                            .join(' / ');
                        const stableGroupPrompt = dependencies.getCachedGroupPromptBlock(
                            db,
                            char.id,
                            'group_stable_prompt_v1',
                            {
                                groupName: group.name || '',
                                persona: char.persona || '',
                                worldInfo: char.world_info || '',
                                systemPrompt: char.system_prompt || ''
                            },
                            () => {
                                const parts = [
                                    '[System Directive: Stay fully in character. No AI/assistant mentions. No disclaimers.]',
                                    `你是${char.name}，正在群聊“${group.name}”里说话。这里是群聊，不是私聊。`,
                                    char.persona ? `Persona: ${char.persona}` : '',
                                    char.world_info ? `World: ${char.world_info}` : '',
                                    char.system_prompt ? `Extra rules: ${char.system_prompt}` : ''
                                ].filter(Boolean);
                                return parts.join('\n\n');
                            }
                        );
                        const groupRulesBlock = [
                            'Group rules:',
                            '1. Keep replies short and natural, usually 1-2 sentences.',
                            '2. React to the latest group flow; do not force a turn.',
                            '3. Output reply text only. Do not prefix your own name.',
                            `4. Use @Name only if you want an immediate reply. Mentionable: @${userName}${mentionableNames ? ' / ' + mentionableNames : ''}`,
                            '5. Red packet reactions stay in role.',
                            '6. Source boundaries matter: [PRIVATE SOURCE] can shape your feelings but is not public chat; [GROUP SOURCE] is public chat and can be replied to directly; [CITY SOURCE] is real-life experience, not a chat line.',
                            '7. Never mistake private/city snippets for someone literally speaking in this group right now. Do not invent message duplication, impersonation, or fake send errors unless the group history itself shows that.',
                            '8. Optional hidden tags: [CHAR_AFFINITY:id:+3], [REDPACKET_SEND:lucky|50|5|新年快乐]'
                        ].join('\n');
                        const systemPrompt =
                            stableGroupPrompt + '\n\n' +
                            (universalResult.preamble || '') + '\n\n' +
                            (digestBlock ? `${digestBlock}\n\n` : '') +
                            '当前主情绪：' + emotionGuidance.emotion.label + ' ' + emotionGuidance.emotion.emoji + '\n' +
                            '当前情绪的身体感受：' + emotionGuidance.groupChat + '\n' +
                            relationSection + '\n' +
                            noRepeatNote + mentionNote + '\n\n' +
                            groupRulesBlock;

                        const llmMessages = [{ role: 'system', content: systemPrompt }, ...history];

                        // Prevent third-party proxies from auto-appending "缁х画" if the active AI spoke last 
                        if (llmMessages.length > 0 && llmMessages[llmMessages.length - 1].role === 'assistant') {
                            llmMessages.push({ role: 'user', content: '[系统提示：群里现在很安静，请自然地继续发言或开启新话题。]' });
                        }

                        dependencies.recordGroupLlmDebug(db, char, 'input', llmMessages, {
                            context_type: 'group_chat',
                            group_id: groupId,
                            group_name: group.name,
                            isMentioned,
                            isAtAll,
                            digest_active: !!digestBlock,
                            live_tail_count: recentGroupMsgs.length,
                            history_chars: history.reduce((sum, m) => sum + String(m.content || '').length, 0),
                            system_chars: systemPrompt.length
                        });

                        const { content: reply, usage } = await dependencies.callLLM({
                            endpoint: char.api_endpoint,
                            key: char.api_key,
                            model: char.model_name,
                            messages: llmMessages,
                            maxTokens: char.max_tokens || 500,
                            returnUsage: true,
                            debugAttempt: buildGroupAttemptRecorder(db, char, {
                                context_type: 'group_chat',
                                group_id: groupId,
                                group_name: group.name
                            })
                        });
                        recordGroupTokenUsage(db, char.id, 'group_chat', usage);


                        if (!reply || !reply.trim()) {
                            throw new Error('Group AI returned no reply. Please retry.');
                        }
                        if (reply && reply.trim()) {
                            let cleanReply = reply.trim();
                            // Strip AI's own name prefix; AI sometimes mimics the history format.
                            // Handles: [Name]:, 【Name】:, Name:, [Name]:, etc.
                            const nameEscaped = char.name.replace(/[.*+?^()|[\]\\{}$]/g, '\\$&');
                            const namePrefixRegex = new RegExp('^(?:\\[)?' + nameEscaped + '(?:\\])?[:：]\\s*', 'i');
                            cleanReply = cleanReply.replace(namePrefixRegex, '').trim();
                            const visibleGroupReply = dependencies.stripGroupHiddenTags(cleanReply);
                            if (!visibleGroupReply) {
                                throw new Error('Group AI returned no visible reply. Please retry.');
                            }
                            const groupMemberIds = new Set((group.members || [])
                                .map(member => String(member.member_id || '').trim())
                                .filter(memberId => memberId && memberId !== 'user'));
                            const generatedCharAffinityDeltas = dependencies.parseGeneratedCharAffinityDeltas(db, cleanReply, {
                                selfId: char.id,
                                allowedTargetIds: groupMemberIds
                            });
                            const generatedUserAffinityDelta = dependencies.parseGeneratedAffinityDelta(cleanReply);

                            dependencies.recordGroupLlmDebug(db, char, 'output', cleanReply, {
                                context_type: 'group_chat',
                                group_id: groupId,
                                group_name: group.name,
                                finishReason: 'stop',
                                usage: usage || null,
                                digest_active: !!digestBlock,
                                live_tail_count: recentGroupMsgs.length
                            });

                            // Parse [CHAR_AFFINITY:targetId:delta] inter-character affinity changes.
                            for (const { targetId, delta } of generatedCharAffinityDeltas) {
                                const groupSource = 'group:' + groupId;
                                const existing = db.getCharRelationship(char.id, targetId);
                                const existingGroupRow = existing?.sources?.find(s => s.source === groupSource);
                                const currentGroupAffinity = existingGroupRow?.affinity || 50;
                                const newAffinity = Math.max(0, Math.min(100, currentGroupAffinity + delta));
                                const updated = db.updateCharRelationship(char.id, targetId, groupSource, { affinity: newAffinity });
                                if (updated) console.log('[Social] ' + char.name + ' -> ' + targetId + ': group affinity delta ' + delta + ', now ' + newAffinity);
                            }

                            // Parse [DIARY:content] char writes a diary entry.
                            const diaryMatch = cleanReply.match(/\[DIARY:\s*([\s\S]*?)\s*\]/i);
                            if (diaryMatch?.[1]) {
                                db.addDiary(char.id, diaryMatch[1].trim(), 'neutral');
                                console.log('[GroupChat] ' + char.name + ' wrote a Diary entry from group chat.');
                            }

                            // Parse [AFFINITY:+/-N] char's affinity toward user changes.
                            if (generatedUserAffinityDelta !== null) {
                                const delta = generatedUserAffinityDelta;
                                const freshChar = db.getCharacter(char.id);
                                if (freshChar) {
                                    const newAff = Math.max(0, Math.min(100, freshChar.affinity + delta));
                                    db.updateCharacter(char.id, { affinity: newAff });
                                    console.log('[GroupChat] ' + char.name + ' affinity -> user: Δ' + delta + ', now ' + newAff);
                                }
                            }

                            // Parse [REDPACKET_SEND:type|amount|count|note] char sends a red packet.
                            const rpSendMatch = cleanReply.match(/\[REDPACKET_SEND:([^|]+)\|([^|]+)\|([^|]+)\|([^\]]*)\]/i);
                            if (rpSendMatch) {
                                try {
                                    const rpType = dependencies.normalizeGeneratedRedPacketType(rpSendMatch[1]);
                                    const rpTotal = dependencies.normalizeGeneratedRedPacketAmount(rpSendMatch[2]);
                                    const rpCount = dependencies.normalizeGeneratedRedPacketCount(rpSendMatch[3]);
                                    const rpNote = String(rpSendMatch[4] || '').trim().slice(0, 80) || (char.name + ' 的红包');
                                    const packetId = db.createRedPacket({ groupId, senderId: char.id, type: rpType, totalAmount: rpTotal, perAmount: rpType === 'fixed' ? +(rpTotal / rpCount).toFixed(2) : null, count: rpCount, note: rpNote });
                                    // Broadcast red packet message
                                    const rpContent = '[REDPACKET:' + packetId + ']';
                                    const rpMsgId = db.addGroupMessage(groupId, char.id, rpContent, char.name, char.avatar);
                                    const rpMsg = { id: rpMsgId, group_id: groupId, sender_id: char.id, content: rpContent, timestamp: Date.now(), sender_name: char.name, sender_avatar: char.avatar };
                                    wsClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'group_message', data: rpMsg })); });
                                    console.log('[GroupChat] ' + char.name + ' sent a ' + rpType + ' red packet ¥' + rpTotal + ' x' + rpCount + ' in group ' + group.name);
                                    pendingRedPacketFeedback.push({ packetId, senderId: char.id });

                                    // NEW: Abort the current chain, collect ALL characters (including sender), and reshuffle!
                                    interruptedByRedPacket = true;
                                    remainingMembers = group.members
                                        .filter(m => m.member_id !== 'user')
                                        .map(m => m.member_id)
                                        .sort(() => Math.random() - 0.5);
                                } catch (rpErr) { console.error('[GroupChat] REDPACKET_SEND error:', rpErr.message); }
                            }

                            // Strip ALL action tags before saving/broadcasting.
                            cleanReply = dependencies.stripGroupHiddenTags(cleanReply);

                            if (cleanReply.length > 0) {
                                let msgMetadata = null;
                                // Attach memories to metadata from our universal Result
                                if (universalResult.retrievedMemoriesContext && universalResult.retrievedMemoriesContext.length > 0) {
                                    msgMetadata = { retrievedMemories: universalResult.retrievedMemoriesContext };
                                }
                                const replyId = db.addGroupMessage(groupId, char.id, cleanReply, char.name, char.avatar, msgMetadata);
                                const groupReplyEmotionPatch = dependencies.applyEmotionEvent(char, 'group_character_message_sent');
                                if (groupReplyEmotionPatch) {
                                    db.updateCharacter(char.id, groupReplyEmotionPatch);
                                    logEmotionTransition(
                                        db,
                                        char,
                                        groupReplyEmotionPatch,
                                        'group_character_message_sent',
                                        '角色在群聊 ' + group.name + ' 中发言后，社交情绪发生变化。'
                                    );
                                }
                                const replyMsg = { id: replyId, group_id: groupId, sender_id: char.id, content: cleanReply, timestamp: Date.now(), sender_name: char.name, sender_avatar: char.avatar, metadata: msgMetadata };
                                const payload = JSON.stringify({ type: 'group_message', data: replyMsg });
                                wsClients.forEach(c => { if (c.readyState === 1) c.send(payload); });

                                const secondaryIds = resolveMentionedGroupCharacterIds(db, group.members, cleanReply, { selfId: char.id });
                                if (secondaryIds.length > 0) {
                                    if (dependencies.noChainGroups.has(runtimeKey)) {
                                        console.log('[GroupChat] ' + char.name + ' mentioned ' + secondaryIds.join(',') + ' - secondary chain BLOCKED (no-chain mode ON)');
                                    } else {
                                        console.log('[GroupChat] ' + char.name + ' mentioned ' + secondaryIds.join(',') + ' - queuing secondary reply after current chain');
                                        pendingSecondaryChains.push(secondaryIds);
                                    }
                                }

                                // Long-term memory extraction is handled by overflow sweep/manual extraction.
                                // Do not run the small memory model after every group reply.
                                if (typeof memory.updateGroupConversationDigest === 'function') {
                                    memory.updateGroupConversationDigest(char, groupId, { tailWindow: groupMsgLimit })
                                        .catch(err => console.error('[GroupChat] Group digest update err for ' + char.name + ':', err.message));
                                }

                                // Claim-on-success: auto-claim unclaimed red packets after successful API reply.
                                try {
                                    const unclaimedPackets = db.getUnclaimedRedPacketsForGroup(groupId, char.id);
                                    for (const pkt of unclaimedPackets) {
                                        // Prevent claiming the red packet we just created in this very turn.
                                        // It should be claimed in the next reshuffled chain.
                                        if (interruptedByRedPacket && pendingRedPacketFeedback.some(pf => pf.packetId === pkt.id)) {
                                            continue;
                                        }
                                        const claimResult = db.claimRedPacket(pkt.id, char.id);
                                        if (claimResult.success) {
                                            const freshPkt = db.getRedPacket(pkt.id);
                                            // Broadcast claim event via WebSocket for real-time UI update
                                            const claimEvent = JSON.stringify({
                                                type: 'redpacket_claim',
                                                data: {
                                                    packet_id: pkt.id,
                                                    group_id: groupId,
                                                    claimer_id: char.id,
                                                    amount: claimResult.amount,
                                                    remaining_count: freshPkt?.remaining_count ?? 0
                                                }
                                            });
                                            wsClients.forEach(c => { if (c.readyState === 1) c.send(claimEvent); });
                                            console.log('[GroupChat] ' + char.name + ' claimed red packet #' + pkt.id + ' for ¥' + claimResult.amount.toFixed(2) + ' (on successful reply)');
                                        }
                                    }
                                } catch (rpClaimErr) {
                                    console.error('[GroupChat] Claim-on-success error for ' + char.name + ':', rpClaimErr.message);
                                }
                            }
                        }

                        // Clear typing indicator
                        const stopPayload = JSON.stringify({ type: 'group_typing_stop', data: { group_id: groupId, sender_id: char.id } });
                        wsClients.forEach(c => { if (c.readyState === 1) c.send(stopPayload); });
                    } catch (err) {
                        console.error('[GroupChat] ' + char.name + ' failed to reply:', err.message);
                        const stopPayload = JSON.stringify({ type: 'group_typing_stop', data: { group_id: groupId, sender_id: char.id } });
                        wsClients.forEach(c => { if (c.readyState === 1) c.send(stopPayload); });
                    }

                    if (interruptedByRedPacket) {
                        console.log('[GroupChat] Chain abruptly halted because ' + char.name + ' threw a Red Packet. Redirecting ' + remainingMembers.length + ' remaining characters to react.');
                        break;
                    }
                }
            } finally {
                delete dependencies.groupReplyLock[runtimeKey];

                // Fire secondary chains sequentially; preserve duplicate @mentions
                // so the same char can reply multiple times if mentioned by different members
                if (pendingSecondaryChains.length > 0 && !interruptedByRedPacket) {
                    let chainDelay = 2500;
                    for (const secondaryIds of pendingSecondaryChains) {
                        const ids = [...secondaryIds];
                        setTimeout(() => triggerGroupAIChain(userId, groupId, wsClients, ids, false, true), chainDelay);
                        chainDelay += 3000; // stagger each secondary chain
                    }
                }

                // If interrupted by a red packet, start a fresh chain with the remaining characters
                if (interruptedByRedPacket) {
                    setTimeout(() => triggerGroupAIChain(userId, groupId, wsClients, remainingMembers, false, false, pendingRedPacketFeedback), 1500);
                } else {
                    // Post-chain red packet sender feedback.
                    for (const { packetId, senderId } of pendingRedPacketFeedback) {
                        setTimeout(async () => {
                            try {
                                const senderChar = db.getCharacter(senderId);
                                if (!senderChar) return;
                                const pkt = db.getRedPacket(packetId);
                                if (!pkt) return;
                                const allClaimed = pkt.remaining_count <= 0;
                                const claimedCount = pkt.count - pkt.remaining_count;
                                const claimNames = pkt.claims.map(c => {
                                    if (c.claimer_id === 'user') return db.getUserProfile()?.name || 'User';
                                    return db.getCharacter(c.claimer_id)?.name || '???';
                                });

                                let statusLine;
                                if (allClaimed) {
                                    statusLine = '你在群 "' + group.name + '" 发的红包已经被抢光了！共 ' + pkt.count + ' 份，领取人：' + claimNames.join('、') + '。';
                                } else {
                                    statusLine = '你在群 "' + group.name + '" 发的红包还剩 ' + pkt.remaining_count + ' 份没人领。已领取 ' + claimedCount + ' 份' + (claimNames.length > 0 ? '（' + claimNames.join('、') + '）' : '') + '。';
                                }

                                const feedbackEmotionGuidance = dependencies.getEmotionBehaviorGuidance(senderChar);
                                const feedbackPrompt =
                                    '[System Directive: You must completely embody your persona. Do not mention you are an AI or an assistant. No warnings or disclaimers.]\n\n' +
                                    '你是' + senderChar.name + '。Persona: ' + (senderChar.persona || '普通人') + '\n' +
                                    '当前主情绪：' + feedbackEmotionGuidance.emotion.label + ' ' + feedbackEmotionGuidance.emotion.emoji + '\n' +
                                    '当前情绪的身体感受：' + feedbackEmotionGuidance.groupChat + '\n' +
                                    statusLine + '\n' +
                                    '根据你的性格，用 1-2 句话在群聊中自然地反应，不要有名字前缀，直接说话。';

                                const { content: feedbackReply, usage } = await dependencies.callLLM({
                                    endpoint: senderChar.api_endpoint,
                                    key: senderChar.api_key,
                                    model: senderChar.model_name,
                                    messages: [{ role: 'system', content: feedbackPrompt }],
                                    maxTokens: 80,
                                    returnUsage: true
                                });
                                recordGroupTokenUsage(db, senderChar.id, 'group_feedback', usage);
                                if (feedbackReply?.trim()) {
                                    const clean = feedbackReply.trim().replace(/\[(?:CHAR_AFFINITY|AFFINITY|DIARY|UNLOCK_DIARY|PRESSURE|TIMER|TRANSFER|DIARY_PASSWORD|REDPACKET_SEND)[^\]]*\]/gi, '').trim();
                                    if (clean) {
                                        const fbMsgId = db.addGroupMessage(groupId, senderChar.id, clean, senderChar.name, senderChar.avatar);
                                        const feedbackEmotionPatch = dependencies.applyEmotionEvent(senderChar, 'group_character_message_sent');
                                        if (feedbackEmotionPatch) {
                                            db.updateCharacter(senderChar.id, feedbackEmotionPatch);
                                            logEmotionTransition(
                                                db,
                                                senderChar,
                                                feedbackEmotionPatch,
                                                'group_character_message_sent',
                                                '角色在群聊 ' + group.name + ' 中对红包反馈发言后，社交情绪发生变化。'
                                            );
                                        }
                                        const fbMsg = { id: fbMsgId, group_id: groupId, sender_id: senderChar.id, content: clean, timestamp: Date.now(), sender_name: senderChar.name, sender_avatar: senderChar.avatar };
                                        wsClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'group_message', data: fbMsg })); });
                                    }
                                }
                            } catch (fbErr) {
                                console.error('[GroupChat] Red packet sender feedback error:', fbErr.message);
                            }
                        }, 3000 + Math.random() * 5000); // 3-8s delay after chain ends
                    }
                }
            }
        })();
    }

    return { recordGroupTokenUsage, isAsciiMentionContinuation, readMentionTokenAfterAt, resolveMentionedGroupCharacterIds, buildGroupAttemptRecorder, logEmotionTransition, triggerGroupAIChain };
}

module.exports = { createModule };
