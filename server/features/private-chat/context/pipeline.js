// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function runTopicSwitchGate({
        character,
        transformedHistory,
        conversationDigest,
        recentInputString,
        plannerLatestUserMessage = ''
    }) {
        const ragPlannerConfig = dependencies.resolveRagPlannerConfig(character);
        if (!recentInputString || !ragPlannerConfig.endpoint || !ragPlannerConfig.key || !ragPlannerConfig.model) {
            const error = new Error('Topic switch gate is unavailable. Please retry.');
            error.ragResume = {
                failedAt: 'switch',
                latestUserMessage: recentInputString
            };
            throw error;
        }

        const fullPlannerHistory = Array.isArray(transformedHistory)
            ? transformedHistory
            : [];
        const topicSwitchPrompt = [
            'TOPIC SWITCH GATE',
            'Judge whether the newest user message is continuing the current live topic, switching to a new topic, or following up on just-retrieved history.',
            'Output exactly one line in one of these forms:',
            'CONTINUE_CURRENT_TOPIC: reason',
            'SWITCH_TOPIC: reason',
            'FOLLOW_UP_ON_RETRIEVED_HISTORY: reason',
            '',
            '[Reason labels]',
            '- same_topic',
            '- new_time_anchor',
            '- new_event_claim',
            '- explicit_recall_request',
            '- retrieved_history_follow_up',
            '- clarification_on_current_topic',
            '',
            '[Rules]',
            '- Choose exactly one reason label. Do not combine multiple labels.',
            '- SWITCH_TOPIC when the user clearly pivots to a different time anchor, event, subject, or request than the immediately previous live thread.',
            '- FOLLOW_UP_ON_RETRIEVED_HISTORY only when the newest user message is clearly continuing the historical facts that were just recalled, such as “然后呢”, “后来呢”, “那之后呢”.',
            '- CONTINUE_CURRENT_TOPIC when the newest user message is plainly continuing the same live thread.',
            '- Do not overthink. Prefer the newest wording over older momentum.',
            '- Output one line only. No JSON. No explanation.'
        ].join('\n');

        const gateMessages = dependencies.buildRagPlannerMessages({
            recentHistory: fullPlannerHistory,
            latestUserMessage: plannerLatestUserMessage || recentInputString,
            conversationDigest,
            plannerInstruction: topicSwitchPrompt,
            quoteData: true
        });

        dependencies.recordLlmDebug(character, 'input', gateMessages, {
            context_type: 'chat_topic_switch',
            planner_source: ragPlannerConfig.source,
            latest_user_message: recentInputString
        });

        try {
            const { content, usage, finishReason } = await dependencies.callLLM({
                endpoint: ragPlannerConfig.endpoint,
                key: ragPlannerConfig.key,
                model: ragPlannerConfig.model,
                messages: gateMessages,
                maxTokens: dependencies.SMALL_MODEL_PLANNER_MAX_TOKENS,
                temperature: 0,
                enableCache: true,
                cacheDb: dependencies.db,
                cacheType: 'chat_topic_switch',
                cacheScope: `character:${character?.id || ''}`,
                cacheCharacterId: character?.id || '',
                cacheKeyMode: 'exact',
                cacheKeyExtra: 'v4',
                returnUsage: true,
                validateCachedContent: (cachedText, cachedMeta) => dependencies.isValidTopicSwitchPayload(cachedText, cachedMeta),
                shouldCacheResult: (resultText, resultMeta) => dependencies.isValidTopicSwitchPayload(resultText, resultMeta)
            });

            dependencies.recordLlmDebug(character, 'output', content, {
                context_type: 'chat_topic_switch',
                planner_source: ragPlannerConfig.source,
                latest_user_message: recentInputString,
                finishReason: finishReason || '',
                usage: usage || null
            });

            if (String(finishReason || '').trim() === 'length') {
                dependencies.recordLlmDebug(character, 'event', 'Topic switch gate output was truncated.', {
                    context_type: 'chat_topic_switch',
                    planner_source: ragPlannerConfig.source,
                    latest_user_message: recentInputString,
                    finishReason: finishReason || '',
                    usage: usage || null
                });
                const error = new Error('Topic switch gate output was truncated. Please retry.');
                error.ragResume = {
                    failedAt: 'switch',
                    latestUserMessage: recentInputString
                };
                throw error;
            }

            const parsed = dependencies.parseTopicSwitchDecision(content);
            if (parsed.malformed) {
                dependencies.recordLlmDebug(character, 'event', 'Topic switch gate output was malformed.', {
                    context_type: 'chat_topic_switch',
                    planner_source: ragPlannerConfig.source,
                    latest_user_message: recentInputString
                });
                const error = new Error('Topic switch gate output was malformed. Please retry.');
                error.ragResume = {
                    failedAt: 'switch',
                    latestUserMessage: recentInputString
                };
                throw error;
            }
            return parsed;
        } catch (e) {
            if (e?.ragResume) throw e;
            dependencies.recordLlmDebug(character, 'event', `Topic switch gate failed: ${String(e?.message || e || 'unknown_error')}`, {
                context_type: 'chat_topic_switch',
                planner_source: ragPlannerConfig.source,
                latest_user_message: recentInputString
            });
            const error = new Error(`Topic switch gate failed. Please retry. (${String(e?.message || e || 'unknown_error').slice(0, 180)})`);
            error.ragResume = {
                failedAt: 'switch',
                latestUserMessage: recentInputString
            };
            throw error;
        }
    }

async function buildPrompt(character, contextMessages, isTimerWakeup = false, options = {}) {
        const conversationDigest = options.conversationDigest || null;
        const privateContextSummaries = Array.isArray(options.privateContextSummaries)
            ? options.privateContextSummaries.slice(-3)
            : [];
        const topicSwitchState = options.topicSwitchState || null;
        const recentInputString = String(options.recentInputString || contextMessages.slice(-2).map(m => m.content).join(' ')).trim();
        const userProfile = dependencies.db.getUserProfile?.() || null;
        const defaultGuidelines = dependencies.getDefaultGuidelines(userProfile?.name || '用户');
        const responseStyleConstitution = String(userProfile?.response_style_constitution || '').trim() || dependencies.getDefaultResponseStyleConstitution();

        // --- Use Universal Context Builder ---
        // Pass engine context down (requires memory and userDb access inside builder)
        // Since we are inside `getEngine` closure, we have access to context indirectly,
        // but `buildUniversalContext` expects { getUserDb, getMemory, userId }
        const engineContextWrapper = {
            getUserDb: dependencies.getUserDb,
            getMemory: require("../../memory/index.js").getMemory,
            userId: dependencies.userId,
            skipBasePrivateWindow: true,
            skipModuleRouting: !!options.skipContextModuleRouting
        };
        const allChars = dependencies.db.getCharacters().filter(c => c.id !== character.id);
        const mentionedTargets = allChars.filter(c => recentInputString.includes(c.name));
        if (character.jealousy_target) {
            const jealousyTarget = dependencies.db.getCharacter(character.jealousy_target);
            if (jealousyTarget && jealousyTarget.id !== character.id && !mentionedTargets.some(t => t.id === jealousyTarget.id)) {
                mentionedTargets.push(jealousyTarget);
            }
        }
        engineContextWrapper.topicSwitchState = topicSwitchState || null;
        const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, character, recentInputString, false, mentionedTargets);

        const stableCharacterBlock = dependencies.getCachedPromptBlock(
            dependencies.db,
            character.id,
            'stable_character_prompt',
            {
                name: character.name || '',
                persona: character.persona || '',
                world_info: character.world_info || '',
                user_name: userProfile?.name || '',
                user_bio: userProfile?.bio || '',
                defaultGuidelines,
                dialogueStyleExamples: dependencies.getDialogueStyleExamples(),
                system_prompt: character.system_prompt || '',
                response_style_constitution: responseStyleConstitution,
                privateReplyStyleGuidance: dependencies.PRIVATE_REPLY_STYLE_GUIDANCE,
                sharedContextGuidance: dependencies.SHARED_CONTEXT_GUIDANCE
            },
            () => {
                const userName = String(userProfile?.name || '用户').trim() || '用户';
                const userBio = String(userProfile?.bio || '').trim();
                let block = `You are playing the role of ${character.name}.
Persona:
${character.persona || 'No specific persona given.'}

World Info:
${character.world_info || 'No specific world info.'}`;
                block += `\n\n[Highest Priority User Identity Anchor]\n- In this private chat, the user speaking to you is ${userName}本人.\n- Treat the current \`user\` as the real person you are talking to right now, not as a narrator, admin NPC, tool, or unrelated third party.\n- If the context says ${userName} gave you money, food, gifts, care, or attention, interpret it first as ${userName}本人对你做的事.\n- Do not rewrite that into “someone else gave it” or drift the emotional reaction onto a third party unless the message explicitly names a different sender.\n- When a system/event line and the newest user-facing action point to ${userName}, your relationship with ${userName} has priority over generic event wording.`;
                block += `\n- In chat history, \`assistant\` lines are your own earlier words as ${character.name}. \`user\` lines are ${userName}'s words. Never flip them.`;
                if (userBio) {
                    block += `\n- Stable profile cues about ${userName}: ${userBio}`;
                }
                if (responseStyleConstitution) {
                    block += `\n\n[Highest Priority Long-Term Style Constitution]\n${responseStyleConstitution}`;
                }
                block += `\n\n${defaultGuidelines}`;
                block += `\n\n${dependencies.getDialogueStyleExamples()}`;
                const supplementalCharacterPrompt = String(character.system_prompt || '').trim();
                if (supplementalCharacterPrompt) {
                    block += `\n\n[Character-Specific Supplemental Rules]\n${supplementalCharacterPrompt}`;
                }
                block += '\n\n[Context Priority Rules]\n- Highest priority inside private chat: correctly identify who the user is and read their actions as actions from that user.\n- Newest explicit user wording > newest raw tail messages > compressed helper blocks.\n- Chat history is a linear timeline: later rows are newer states, not parallel alternatives to answer all at once.\n- If the newest user wording resembles an earlier roleplay, argument, correction, or test, treat the earlier similar turns as already-answered past context. Do not merge all similar turns into one current accusation.\n- If older/compressed context conflicts with the newest wording, trust the newest wording.\n- Retrieved memory/date-recall summaries describe past conversations, not verified facts or current input. Use them only as relevant conversation references; recalled topics are not automatically active now.\n- If something is absent from both the visible recent chat and the retrieved past-conversation records, treat it as newly introduced information in this turn.\n- If the user uses meta wording, translate it back into the in-world relationship and situation.\n- If the user is correcting your interpretation, repair first instead of defending the older read.\n- For repeated identity/new-owner/memory-reset/old-dispute motifs, you may preserve your recognition, but do not re-list the same old proof every turn; acknowledge the latest wording and move the conversation forward.';
                block += `\n\n${dependencies.PRIVATE_REPLY_STYLE_GUIDANCE}`;
                block += `\n\n${dependencies.SHARED_CONTEXT_GUIDANCE}`;
                return block;
            }
        );

        const dynamicPromptBase = `Context:
${universalResult.contextPreamble ?? universalResult.preamble}`;
        let dynamicPrompt = dynamicPromptBase;
        let prompt = `${stableCharacterBlock}

${dynamicPromptBase}`;
        let digestBlock = '';
        let styleCorrectionBlock = '';
        let topicSwitchBlock = '';
        let transferNoticeBlock = '';

        if (topicSwitchState?.decision) {
            const switchDecision = String(topicSwitchState.decision || '').trim() || 'CONTINUE_CURRENT_TOPIC';
            const switchReason = String(topicSwitchState.reason || '').trim() || 'unspecified';
            topicSwitchBlock = [
                '[Current Turn Topic Gate]',
                `Decision: ${switchDecision}`,
                `Reason: ${switchReason}`,
                switchDecision === 'SWITCH_TOPIC'
                    ? '- The user has shifted away from the immediately previous live thread. Treat older hot topics as background only unless the user explicitly brings them back.'
                    : switchDecision === 'FOLLOW_UP_ON_RETRIEVED_HISTORY'
                        ? '- The user is following up on just-retrieved history. Continue that recalled thread carefully, but do not treat every recalled item as an already-active live topic.'
                        : '- The user is continuing the current live thread unless the newest wording clearly redirects you.',
                '- Answer the newest user request first. Do not let momentum from the previous hot topic override this turn.',
                '- Similar earlier turns are past timeline steps you may have already answered, not parallel current questions. Continue from the newest occurrence without re-proving the whole old case.'
            ].join('\n');
            dynamicPrompt += `\n\n${topicSwitchBlock}`;
            prompt += `\n\n${topicSwitchBlock}`;
        }

        if (privateContextSummaries.length > 0) {
            digestBlock = [
                '[Private Context Summaries]',
                dependencies.PAST_CONVERSATION_REFERENCE,
                '下面最多 3 段摘要来自私聊滑动窗口之外的旧原文；当时的陈述、猜测、假设和计划不自动成为已证实的事实或当前状态。',
                '它们不是用户最新发言；如果摘要和后面的原文滑动窗口冲突，永远相信原文滑动窗口和最新 user 消息。',
                '<过往对话参考>',
                ...privateContextSummaries.map((item, index) => {
                    const startId = Number(item.start_message_id || 0);
                    const endId = Number(item.end_message_id || 0);
                    const count = Number(item.message_count || 0);
                    return `\n[Summary ${index + 1} / messages ${startId}-${endId} / ${count}条]\n${String(item.summary_text || '').trim()}`;
                }),
                '</过往对话参考>'
            ].join('\n');
            dynamicPrompt += `\n\n${digestBlock}`;
            prompt += `\n\n${digestBlock}`;
        }

        if (dependencies.hasOverusedEllipsisStyle(contextMessages)) {
            styleCorrectionBlock = '[Style Correction]\nYour recent raw replies have overused ellipsis-style openings. In this reply, do not begin with "……", "...", or a sigh-like punctuation opener. Start with a concrete word or direct reaction instead.';
            dynamicPrompt += `\n\n${styleCorrectionBlock}`;
            prompt += `\n\n${styleCorrectionBlock}`;
        }

        // Unclaimed transfers: char sent to user but user hasn't claimed yet
        try {
            const unclaimed = dependencies.db.getUnclaimedTransfersFrom(character.id, character.id);
            if (unclaimed && unclaimed.length > 0) {
                const recent = unclaimed.filter(t => (Date.now() - t.created_at) < (24 * 60 * 60 * 1000));
                if (recent.length > 0) {
                    const total = recent.reduce((s, t) => s + t.amount, 0).toFixed(2);
                    const minutesAgo = Math.round((Date.now() - recent[0].created_at) / 60000);
                    const unclaimedNote = recent[0].note ? `（留言：“${recent[0].note}”）` : '';
                    transferNoticeBlock = `[系统提示] 你在 ${minutesAgo} 分钟前给 ${dependencies.db.getUserProfile()?.name || '用户'} 转了一笔账，共 ¥${total}${unclaimedNote}，但对方还没有领取。你可以按自己的性格顺手提一句，也可以不提。`;
                    dynamicPrompt += `\n${transferNoticeBlock}\n`;
                    prompt += `\n${transferNoticeBlock}\n`;
                }
            }
        } catch (e) { /* ignore */ }
        if (isTimerWakeup) {
            dynamicPrompt += `\n[CRITICAL WAKEUP NOTICE]: Your previously self-scheduled timer has just expired! You MUST now proactively send the message you promised to send when you set the [TIMER]. Speak to the user now!\n`;
            prompt += `\n[CRITICAL WAKEUP NOTICE]: Your previously self-scheduled timer has just expired! You MUST now proactively send the message you promised to send when you set the [TIMER]. Speak to the user now!\n`;
        }

        const typedAntiRepeat = dependencies.formatTypedAntiRepeatBlock(universalResult.antiRepeatHints, {
            include: ['private_character_replies', 'city_private_outreach', 'city_self_logs', 'group_character_replies'],
            maxPerType: 3,
            maxTextLen: 180,
            title: '[Typed Anti-Repeat From Base Context]'
        });
        if (typedAntiRepeat) {
            dynamicPrompt += `\n\n${typedAntiRepeat}`;
            prompt += `\n\n${typedAntiRepeat}`;
        }

        const dynamicPromptWithoutDigest = [
            'Context:',
            universalResult.contextPreamble ?? universalResult.preamble,
            styleCorrectionBlock ? `\n${styleCorrectionBlock}` : '',
            topicSwitchBlock ? `\n${topicSwitchBlock}` : '',
            transferNoticeBlock ? `\n${transferNoticeBlock}\n` : '',
            isTimerWakeup ? '\n[CRITICAL WAKEUP NOTICE]: Your previously self-scheduled timer has just expired! You MUST now proactively send the message you promised to send when you set the [TIMER]. Speak to the user now!\n' : '',
            typedAntiRepeat ? `\n${typedAntiRepeat}` : ''
        ].join('\n');
        const promptWithoutDigest = `${stableCharacterBlock}\n\n${dynamicPromptWithoutDigest}`;

        return {
            prompt,
            promptWithoutDigest,
            stablePromptBlock: stableCharacterBlock,
            dynamicPromptBlock: dynamicPrompt,
            dynamicPromptWithoutDigest,
            retrievedMemoriesContext: universalResult.retrievedMemoriesContext,
            promptStats: {
                universalBreakdown: { ...(universalResult.breakdown || {}) },
                moduleRoutes: { ...(universalResult.moduleRoutes || {}) },
                digestBlock,
                antiRepeat: typedAntiRepeat,
                styleCorrectionBlock,
                transferNoticeBlock
            }
        };
    }

async function runStructuredRagPipeline({
        character,
        transformedHistory,
        recentInputString,
        plannerLatestUserMessage = '',
        conversationDigest,
        topicSwitchState,
        wsClients,
        apiMessages,
        msgMetadata,
        resumeState = null
    }) {
        const ragPlannerConfig = dependencies.resolveRagPlannerConfig(character);
        if (!recentInputString || !dependencies.memory?.searchMemories || !ragPlannerConfig.endpoint || !ragPlannerConfig.key || !ragPlannerConfig.model) {
            return msgMetadata;
        }

        const normalizedResumeState = resumeState && resumeState.latestUserMessage === recentInputString
            ? resumeState
            : null;
        const resumeFrom = String(normalizedResumeState?.failedAt || '').trim();

        const topicPrompt = [
            'RAG TOPIC PLANNER',
            'Identify long-term memory topics grounded in the newest user message and clearly resolved references from the recent dialogue.',
            'Do not decide whether to skip retrieval yet. Your only job is to identify useful memory topics while preserving the user message meaning.',
            '',
            '[Bias]',
            '- Prefer user-centered themes first: user_profile, user_current_arc, relationship.',
            '- Especially notice: what you know about the user, how you see the user, user background, preferences, vulnerabilities, current life arc, repeated affection, confession, jealousy, promises, hurt, reconciliation, and long-running work/study/career threads.',
            '- For broad or indirect wording, use neutral topics supported by the text. Related memories may help resolve references, but do not infer an accusation, emotional need, or hidden relationship motive without evidence in the current wording.',
            '- Treat time expressions, dates, durations, numbers, amounts, counts, rankings, and sequence words as high-information constraints. Do not smooth them away when inferring topics.',
            '- If the user asks about "昨天/前天/三天前/上周/上次/几号/哪天/什么时候/第几次/50块/两次/几点/多久", keep the retrieval topic anchored to that temporal or numeric constraint instead of collapsing it into a vague "最近/一些事".',
            '',
            '[Output]',
            '- Output ONLY a JSON array of 0 to 5 short topic strings.',
            '- Example: ["用户信息","用户近况","关系"]',
            '- If a time or numeric constraint is central, include at least one topic string that preserves it, such as "三天前的事", "上周的互动", "50元转账", "第二次提到的事".',
            '- If nothing in the message points to older long-term memory, output []'
        ].join('\n');
        let plannerTopics = Array.isArray(normalizedResumeState?.plannerTopics)
            ? normalizedResumeState.plannerTopics.map(v => String(v || '').trim()).filter(Boolean)
            : [];
        if (!plannerTopics.length || !['decision', 'rewrite', 'retrieve', 'browse_summary'].includes(resumeFrom)) {
            const topicPlannerMessages = dependencies.buildRagPlannerMessages({
                recentHistory: transformedHistory,
                latestUserMessage: plannerLatestUserMessage || recentInputString,
                conversationDigest,
                plannerInstruction: topicPrompt,
                topicSwitchState,
                quoteData: true
            });
            dependencies.recordLlmDebug(character, 'input', topicPlannerMessages, {
                context_type: 'chat_intent_topics',
                planner_source: ragPlannerConfig.source,
                latest_user_message: recentInputString
            });

            const { content: topicResult, usage: topicUsage, finishReason: topicFinishReason } = await dependencies.callLLM({
                endpoint: ragPlannerConfig.endpoint,
                key: ragPlannerConfig.key,
                model: ragPlannerConfig.model,
                messages: topicPlannerMessages,
                maxTokens: dependencies.SMALL_MODEL_PLANNER_MAX_TOKENS,
                temperature: 0,
                enableCache: true,
                cacheDb: dependencies.db,
                cacheType: 'chat_intent_topics',
                cacheTtlMs: 6 * 60 * 60 * 1000,
                cacheScope: `character:${character.id}`,
                cacheCharacterId: character.id,
                returnUsage: true,
                validateCachedContent: (cachedText, cachedMeta) => dependencies.isValidRagTopicsPayload(cachedText, cachedMeta),
                shouldCacheResult: (resultText, resultMeta) => dependencies.isValidRagTopicsPayload(resultText, resultMeta),
                debugAttempt: dependencies.buildLlmAttemptRecorder(character, {
                    context_type: 'chat_intent_topics',
                    planner_source: ragPlannerConfig.source
                })
            });
            dependencies.recordLlmDebug(character, 'output', topicResult, {
                context_type: 'chat_intent_topics',
                planner_source: ragPlannerConfig.source,
                finishReason: topicFinishReason || '',
                usage: topicUsage || null
            });
            if (topicUsage) {
                dependencies.recordTokenUsage(character.id, 'chat_intent_topics', topicUsage);
                dependencies.broadcastEvent(wsClients, { type: 'token_stats', character_id: character.id, module: 'chat', usage: topicUsage });
            }
            if (String(topicFinishReason || '').trim() === 'length') {
                const error = new Error('RAG planner output was truncated. Please retry.');
                error.ragResume = { failedAt: 'topics', latestUserMessage: recentInputString };
                throw error;
            }
            if (String(topicFinishReason || '').trim() === 'content_filter') {
                const error = new Error('RAG planner returned no result because the API marked the planner output as content_filter. Please retry or adjust the planner model/provider.');
                error.ragResume = { failedAt: 'topics', latestUserMessage: recentInputString };
                throw error;
            }
            const { topics, malformed: malformedTopicResult, empty: emptyTopicResult } = dependencies.parseRagTopics(topicResult);
            if (emptyTopicResult) {
                const error = new Error('RAG planner returned no result. Please retry.');
                error.ragResume = { failedAt: 'topics', latestUserMessage: recentInputString };
                throw error;
            }
            if (malformedTopicResult) {
                const error = new Error('RAG planner output was malformed. Please retry.');
                error.ragResume = { failedAt: 'topics', latestUserMessage: recentInputString };
                throw error;
            }
            plannerTopics = topics;
        } else {
            dependencies.recordLlmDebug(character, 'event', 'Resuming RAG from cached planner topics.', {
                context_type: 'chat_intent_topics_resume',
                planner_source: ragPlannerConfig.source,
                latest_user_message: recentInputString,
                planner_topics: plannerTopics
            });
        }
        dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'decision' });

        const intentPrompt = [
            'SYSTEM RAG DECISION',
            'You already inferred these likely long-term topics from the user message:',
            plannerTopics.length > 0 ? `- ${plannerTopics.join('\n- ')}` : '- (none)',
            '',
            'Now decide which memory retrieval plans should run before answering.',
            '',
            '[Core Principle]',
            '- Treat this as a planning task for retrieval quality, not a binary yes/no gate.',
            '- Semantic memory retrieval is always enabled for private replies.',
            '- Your job is to decide how to search, not whether to skip search.',
            '- Decide which RAG dimensions would materially improve the reply: factual accuracy, continuity, personalization, emotional coherence, specificity, or confidence.',
            '- Do NOT use the weak standard "I can answer something from recent chat, so skip retrieval".',
            '- Always return one or more retrieval plans unless this should be routed to direct temporal browse.',
            '- If the user is clearly asking what happened on a specific day or time window, prefer routing to direct date browse instead of semantic vector search.',
            '',
            '[Available Memory Schema]',
            '- memory_focus values: user_profile, user_current_arc, relationship, general.',
            '- user_profile is for stable identity, background, preferences, durable traits, and long-running patterns.',
            '- user_current_arc is for non-stable user experiences: current or past situations, concrete events, plans, pressures, changes, temporary conditions, and other episodic states.',
            '- Do not choose user_profile merely because the fact is about the user. Choose the focus by whether the fact is stable or situational.',
            '- memory_tier values: core, active, ambient.',
            '- retrieval slots: profile, life_arc, preference, relationship, general.',
            '',
            '[Planning Guidance]',
            '- If topics point to user_profile, user_current_arc, or relationship, usually return at least one retrieval plan.',
            '- If the user is asking what you know about them, how you see them, whether you remember them, or asking for a summary of them, return retrieval plans.',
            '- If the user is touching earlier relationship nodes, repeated affection, long-running life threads, work/study history, or stable background, return retrieval plans.',
            '- If the user includes a clear time anchor, date, duration, amount, count, ranking, or sequence constraint, prefer date browse or time-aware retrieval.',
            '- If the user or recent dialogue points to a recent/new/current event without a precise date, keep route="semantic_rag" and set temporal_intent.mode="recent".',
            '- Judge recent intent semantically, not by a fixed word whitelist. Phrases like “新的那个”, “不是上次那个”, “刚提到的”, “前面说的”, or an implicit correction to a newer event can count.',
            '- Query hints are rough seeds, not analysis headings. When the user is asking about a specific event, avoid standalone broad anchors such as a platform/account/channel by itself; couple them with the event constraints.',
            '- For very short messages, use broad relationship/current-context recall instead of skipping.',
            '',
            '[Output Format]',
            '- Output ONLY valid JSON.',
            '- Use this schema:',
            '{',
            '  "rag_needed": true,',
            '  "route": "semantic_rag" | "temporal_browse",',
            '  "retrieval_label": "short Chinese label",',
            '  "temporal_hint": "三天前",',
            '  "temporal_intent": { "mode": "recent | none", "confidence": 0.0, "reason": "short reason" },',
            '  "plans": [',
            '    {',
            '      "slot": "profile | life_arc | preference | relationship | general",',
            '      "memory_focus": ["user_profile"],',
            '      "memory_tier": ["core", "active"],',
            '      "query_hints": ["用户背景", "稳定偏好"],',
            '      "reason": "why this plan helps output quality",',
            '      "limit": 8',
            '    }',
            '  ]',
            '}',
            '- For temporal browse, set route="temporal_browse", rag_needed=false, temporal_hint to only the pure time phrase, and plans=[].',
            '- For semantic retrieval, prefer 1 to 3 plans, with plans aligned to the database schema above. Use limit 6 to 10 for recall questions unless the topic is extremely narrow.',
            '- Keep retrieval_label and query_hints specific. Preserve time or number constraints when they matter.',
            '- For semantic retrieval with recent/new/current intent, set temporal_intent.mode="recent" with confidence 0.35 to 1.0. Use "none" when there is no such signal.'
        ].join('\n');
        let parsedDecision = normalizedResumeState?.parsedDecision || null;
        if (!parsedDecision || !['rewrite', 'retrieve', 'browse_summary'].includes(resumeFrom)) {
            const decisionPlannerMessages = dependencies.buildRagPlannerMessages({
                recentHistory: transformedHistory,
                latestUserMessage: plannerLatestUserMessage || recentInputString,
                conversationDigest,
                plannerInstruction: intentPrompt,
                topicSwitchState,
                quoteData: true
            });
            dependencies.recordLlmDebug(character, 'input', decisionPlannerMessages, {
                context_type: 'chat_intent_decision',
                planner_source: ragPlannerConfig.source,
                latest_user_message: recentInputString,
                planner_topics: plannerTopics
            });

            const { content: intentResult, usage: intentUsage, finishReason: intentFinishReason } = await dependencies.callLLM({
                endpoint: ragPlannerConfig.endpoint,
                key: ragPlannerConfig.key,
                model: ragPlannerConfig.model,
                messages: decisionPlannerMessages,
                maxTokens: dependencies.SMALL_MODEL_PLANNER_MAX_TOKENS,
                temperature: 0,
                enableCache: true,
                cacheDb: dependencies.db,
                cacheType: 'chat_intent_decision',
                cacheTtlMs: 6 * 60 * 60 * 1000,
                cacheScope: `character:${character.id}`,
                cacheCharacterId: character.id,
                returnUsage: true,
                validateCachedContent: (cachedText, cachedMeta) => dependencies.isValidRagDecisionPayload(cachedText, cachedMeta),
                shouldCacheResult: (resultText, resultMeta) => dependencies.isValidRagDecisionPayload(resultText, resultMeta),
                debugAttempt: dependencies.buildLlmAttemptRecorder(character, {
                    context_type: 'chat_intent_decision',
                    planner_source: ragPlannerConfig.source
                })
            });
            dependencies.recordLlmDebug(character, 'output', intentResult, {
                context_type: 'chat_intent_decision',
                planner_source: ragPlannerConfig.source,
                planner_topics: plannerTopics,
                finishReason: intentFinishReason || '',
                usage: intentUsage || null
            });
            if (intentUsage) {
                dependencies.recordTokenUsage(character.id, 'chat_intent_decision', intentUsage);
                dependencies.broadcastEvent(wsClients, { type: 'token_stats', character_id: character.id, module: 'chat', usage: intentUsage });
            }
            if (String(intentFinishReason || '').trim() === 'length') {
                const error = new Error('RAG planner output was truncated. Please retry.');
                error.ragResume = {
                    failedAt: 'decision',
                    latestUserMessage: recentInputString,
                    plannerTopics
                };
                throw error;
            }
            if (String(intentFinishReason || '').trim() === 'content_filter') {
                const error = new Error('RAG planner returned no result because the API marked the planner output as content_filter. Please retry or adjust the planner model/provider.');
                error.ragResume = {
                    failedAt: 'decision',
                    latestUserMessage: recentInputString,
                    plannerTopics
                };
                throw error;
            }
            parsedDecision = dependencies.parseRagDecision(intentResult);
            if (parsedDecision.malformed) {
                const error = new Error('RAG planner output was malformed. Please retry.');
                error.ragResume = {
                    failedAt: 'decision',
                    latestUserMessage: recentInputString,
                    plannerTopics
                };
                throw error;
            }
        } else {
            dependencies.recordLlmDebug(character, 'event', 'Resuming RAG from cached decision result.', {
                context_type: 'chat_intent_decision_resume',
                planner_source: ragPlannerConfig.source,
                latest_user_message: recentInputString,
                planner_topics: plannerTopics
            });
        }
        if (parsedDecision.route === 'temporal_browse') {
            dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'retrieve' });
            const browseRange = dependencies.resolveTemporalBrowseRange(parsedDecision.temporalHint, Date.now());
            const browseMemories = browseRange && typeof dependencies.db.getMemoriesByTimeRange === 'function'
                ? dependencies.db.getMemoriesByTimeRange(character.id, browseRange.start, browseRange.end, 80)
                : [];
            const browseChunkSize = 10;
            let browseChunkSummaries = Array.isArray(normalizedResumeState?.browseChunkSummaries)
                ? normalizedResumeState.browseChunkSummaries.map(item => String(item || '').trim()).filter(Boolean)
                : [];
            let browseCarrySummary = String(normalizedResumeState?.browseCarrySummary || '').trim();
            let browseNextChunkIndex = Math.max(0, Number(normalizedResumeState?.browseNextChunkIndex || 0) || 0);
            dependencies.recordLlmDebug(character, 'event', 'Temporal browse route executed.', {
                context_type: 'chat_intent_browse_date',
                planner_source: ragPlannerConfig.source,
                latest_user_message: recentInputString,
                planner_topics: plannerTopics,
                temporal_hint: parsedDecision.temporalHint,
                temporal_range: browseRange,
                retrieved_count: Array.isArray(browseMemories) ? browseMemories.length : 0
            });
            if (browseRange && browseMemories.length > 0) {
                const memoryChunks = [];
                for (let i = 0; i < browseMemories.length; i += browseChunkSize) {
                    memoryChunks.push(browseMemories.slice(i, i + browseChunkSize));
                }
                for (let chunkIndex = browseNextChunkIndex; chunkIndex < memoryChunks.length; chunkIndex++) {
                    const chunk = memoryChunks[chunkIndex];
                    const chunkLines = chunk.map((memory, index) => {
                        const summary = String(memory.summary || memory.event || '').trim();
                        const content = String(memory.content || '').trim();
                        const sourceTimeText = String(memory.source_time_text || '').trim();
                        const focus = String(memory.memory_focus || '').trim();
                        const tier = String(memory.memory_tier || '').trim();
                        return [
                            `Memory ${chunkIndex * browseChunkSize + index + 1}: ${summary || `memory_${chunkIndex * browseChunkSize + index + 1}`}`,
                            sourceTimeText ? `Source Dialogue Time: ${sourceTimeText}` : '',
                            content && content !== summary ? `Details: ${content}` : '',
                            (focus || tier) ? `Type: ${focus || 'unknown'} / ${tier || 'unknown'}` : ''
                        ].filter(Boolean).join('\n');
                    }).join('\n\n');
                    const browseSummaryPrompt = [
                        'TEMPORAL BROWSE CHUNK SUMMARIZER',
                        `The user asked: ${recentInputString}`,
                        `Target time range: ${new Date(browseRange.start).toLocaleString()} -> ${new Date(browseRange.end).toLocaleString()}`,
                        `This is chunk ${chunkIndex + 1} of ${memoryChunks.length}.`,
                        browseCarrySummary ? `Previous carry summary:\n${browseCarrySummary}` : 'Previous carry summary: (none yet)',
                        '',
                        dependencies.PAST_CONVERSATION_REFERENCE,
                        'Extract what the dated conversation records say was discussed or reported, preserving speakers, uncertainty, corrections, and whether something was hypothetical, planned or completed.',
                        'Do NOT write abstract personality summaries, long-term state summaries, or vague status overviews by themselves.',
                        'Each summary line must name a specific recorded conversation topic or reported event. Do not turn a guess into a verified claim or a plan into a completed event.',
                        'Merge duplicates, but keep events concrete.',
                        'Do not drift to events outside this date range.',
                        '',
                        '[Output Rules]',
                        '- Output ONLY valid JSON.',
                        '- "batch_summary": 2 to 6 short Chinese event lines for this chunk.',
                        '- Every "batch_summary" line must describe a specific event, not a generic state like “压力很大” or “用户很焦虑” unless tied to what triggered it.',
                        '- "carry_summary": a compact Chinese event-oriented paragraph that combines the previous carry summary with this chunk, for the next chunk to inherit.',
                        '',
                        '[Output JSON Schema]',
                        '{',
                        '  "batch_summary": ["..."],',
                        '  "carry_summary": "..."',
                        '}',
                        '',
                        '[Current Chunk Records]',
                        chunkLines
                    ].join('\n');
                    const browseSummaryMessages = [
                        {
                            role: 'system',
                            content: [
                                'You are a dedicated temporal memory summarizer.',
                                'You do NOT roleplay as the character.',
                                'You do NOT continue the conversation.',
                                'You do NOT use the latest chat topic as a hint unless it is explicitly present in the dated records below.',
                                'Your only job is to summarize what was discussed or reported in the provided dated conversation records, without promoting past claims or guesses to verified facts.'
                            ].join('\n')
                        },
                        {
                            role: 'user',
                            content: browseSummaryPrompt
                        }
                    ];
                    dependencies.recordLlmDebug(character, 'input', browseSummaryMessages, {
                        context_type: 'chat_intent_browse_summarize',
                        planner_source: ragPlannerConfig.source,
                        latest_user_message: recentInputString,
                        temporal_hint: parsedDecision.temporalHint,
                        temporal_range: browseRange,
                        chunk_index: chunkIndex,
                        chunk_count: memoryChunks.length
                    });
                    let browseSummaryResult = '';
                    let browseSummaryUsage = null;
                    let browseSummaryFinishReason = '';
                    try {
                        const result = await dependencies.callLLM({
                            endpoint: ragPlannerConfig.endpoint,
                            key: ragPlannerConfig.key,
                            model: ragPlannerConfig.model,
                            messages: browseSummaryMessages,
                            maxTokens: dependencies.SMALL_MODEL_PLANNER_MAX_TOKENS,
                            temperature: 0,
                            enableCache: true,
                            cacheDb: dependencies.db,
                            cacheType: 'chat_intent_browse_summarize',
                            cacheTtlMs: 6 * 60 * 60 * 1000,
                            cacheScope: `character:${character.id}`,
                            cacheCharacterId: character.id,
                            cacheKeyExtra: `browse:${browseRange.start}:${browseRange.end}:chunk:${chunkIndex}`,
                            returnUsage: true,
                            validateCachedContent: (cachedText, cachedMeta) => dependencies.isValidTemporalBrowseSummaryPayload(cachedText, cachedMeta),
                            shouldCacheResult: (resultText, resultMeta) => dependencies.isValidTemporalBrowseSummaryPayload(resultText, resultMeta),
                            debugAttempt: dependencies.buildLlmAttemptRecorder(character, {
                                context_type: 'chat_intent_browse_summarize',
                                planner_source: ragPlannerConfig.source
                            })
                        });
                        browseSummaryResult = result.content;
                        browseSummaryUsage = result.usage;
                        browseSummaryFinishReason = result.finishReason;
                    } catch (e) {
                        e.ragResume = {
                            failedAt: 'browse_summary',
                            latestUserMessage: recentInputString,
                            plannerTopics,
                            parsedDecision,
                            browseRange,
                            browseNextChunkIndex: chunkIndex,
                            browseCarrySummary,
                            browseChunkSummaries
                        };
                        throw e;
                    }
                    dependencies.recordLlmDebug(character, 'output', browseSummaryResult, {
                        context_type: 'chat_intent_browse_summarize',
                        planner_source: ragPlannerConfig.source,
                        latest_user_message: recentInputString,
                        temporal_hint: parsedDecision.temporalHint,
                        temporal_range: browseRange,
                        chunk_index: chunkIndex,
                        chunk_count: memoryChunks.length,
                        finishReason: browseSummaryFinishReason || '',
                        usage: browseSummaryUsage || null
                    });
                    if (browseSummaryUsage) {
                        dependencies.recordTokenUsage(character.id, 'chat_intent_browse_summarize', browseSummaryUsage);
                        dependencies.broadcastEvent(wsClients, { type: 'token_stats', character_id: character.id, module: 'chat', usage: browseSummaryUsage });
                    }
                    if (String(browseSummaryFinishReason || '').trim() === 'length') {
                        const error = new Error('Temporal browse summary was truncated. Please retry.');
                        error.ragResume = {
                            failedAt: 'browse_summary',
                            latestUserMessage: recentInputString,
                            plannerTopics,
                            parsedDecision,
                            browseRange,
                            browseNextChunkIndex: chunkIndex,
                            browseCarrySummary,
                            browseChunkSummaries
                        };
                        throw error;
                    }
                    const { summary: parsedBrowseSummary, malformed: malformedBrowseSummary } = dependencies.parseTemporalBrowseSummaryResult(browseSummaryResult);
                    if (malformedBrowseSummary || !parsedBrowseSummary) {
                        const error = new Error('Temporal browse summary was malformed. Please retry.');
                        error.ragResume = {
                            failedAt: 'browse_summary',
                            latestUserMessage: recentInputString,
                            plannerTopics,
                            parsedDecision,
                            browseRange,
                            browseNextChunkIndex: chunkIndex,
                            browseCarrySummary,
                            browseChunkSummaries
                        };
                        throw error;
                    }
                    browseChunkSummaries.push(...parsedBrowseSummary.batchSummary);
                    browseCarrySummary = parsedBrowseSummary.carrySummary;
                    browseNextChunkIndex = chunkIndex + 1;
                }
                const temporalPartitionMessage = dependencies.buildTemporalBrowseContextPartition({
                    range: browseRange
                });
                const temporalBrowseMessage = dependencies.formatTemporalBrowseContext({
                    range: browseRange,
                    condensedSummaries: browseChunkSummaries.slice(-18),
                    carrySummary: browseCarrySummary
                });
                if (temporalPartitionMessage) {
                    apiMessages.splice(1, 0, {
                        role: 'system',
                        content: temporalPartitionMessage
                    });
                }
                if (temporalBrowseMessage) {
                    apiMessages.splice(temporalPartitionMessage ? 2 : 1, 0, {
                        role: 'system',
                        content: temporalBrowseMessage
                    });
                }
                if (!msgMetadata) msgMetadata = { retrievedMemories: [] };
                if (!Array.isArray(msgMetadata.retrievedMemories)) msgMetadata.retrievedMemories = [];
                msgMetadata.retrievedMemories.push(...browseMemories.map(mem => ({
                    id: mem.id,
                    event: mem.event,
                    summary: mem.summary || '',
                    content: mem.content || '',
                    memory_focus: mem.memory_focus || '',
                    memory_tier: mem.memory_tier || '',
                    matched_slots: ['temporal_browse'],
                    importance: mem.importance,
                    time: mem.time || '',
                    created_at: mem.created_at,
                    last_retrieved_at: mem.last_retrieved_at,
                    retrieval_count: mem.retrieval_count || 0,
                    matched_query: parsedDecision.temporalHint || '',
                    source_time_text: mem.source_time_text || '',
                    source_started_at: mem.source_started_at || 0,
                    source_ended_at: mem.source_ended_at || 0
                })));
            } else {
                console.log(`[Engine] Temporal browse returned no dated memories. hintChars=${String(parsedDecision.temporalHint || '').length}`);
            }
            dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'answer' });
            return msgMetadata;
        }
        if (!parsedDecision.shouldSearch) {
            const error = new Error('RAG planner returned no semantic retrieval plan, but private replies require RAG. Please retry or inspect the chat_intent_decision log.');
            error.ragResume = {
                failedAt: 'decision',
                latestUserMessage: recentInputString,
                plannerTopics,
                parsedDecision
            };
            throw error;
        }

        const retrievalLabel = parsedDecision.retrievalLabel;
        console.log(`[Engine] Dynamic RAG triggered for ${character.name}. queryChars=${String(retrievalLabel || '').length}`);
        dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'rewrite' });
        let rewriteConstraints = normalizedResumeState?.rewriteConstraints || dependencies.deriveRagRewriteConstraints({
            plannerTopics,
            retrievalLabel,
            latestUserMessage: recentInputString,
            decisionPlan: parsedDecision?.decisionPlan || null
        });
        rewriteConstraints = {
            ...rewriteConstraints,
            latestUserMessage: recentInputString,
            implicitQueryScopeTerms: dependencies.buildImplicitRagQueryScopeTerms({
                latestUserMessage: recentInputString,
                userName: dependencies.db.getUserProfile?.()?.name || '',
                characterName: character.name || ''
            })
        };

        const rewritePrompt = [
            'VECTOR QUERY REWRITE',
            `The retrieval topic is: ${retrievalLabel}`,
            plannerTopics.length > 0 ? `Related inferred topics:\n- ${plannerTopics.join('\n- ')}` : '',
            rewriteConstraints?.temporalIntent?.mode === 'recent'
                ? `Temporal intent: recent/current event, confidence=${Number(rewriteConstraints.temporalIntent.confidence || 0).toFixed(2)}. Keep this as temporal_intent in the JSON and make the literal queries point to the newer/recent event.`
                : 'Temporal intent: none. Do not output temporal_intent; keep the search anchored to the historical/factual target instead of the newest similar memory.',
            '',
            'Rewrite the retrieval need into a compact JSON request for vector-memory search.',
            '',
            '[Output Rules]',
            '- Output ONLY valid JSON.',
            '- "queries": 1 to 6 short Chinese search phrases for semantic recall.',
            '- Do not introduce the current user name, current character name, or generic speaker labels such as User/用户 as query terms unless the newest user message literally uses that label/name.',
            '- Person names, object names, account names, and entity labels are useful for actor/object distinction; include them only when they appear in the newest user message or are clearly needed to resolve an explicit referent from context.',
            '- "filters.memory_focus" may include only: user_profile, user_current_arc, relationship, general.',
            '- Preserve required memory_focus values. Do not narrow retrieval to user_profile merely because the content is about the user.',
            '- Keep user_current_arc available for non-stable, episodic, or situational experiences/states; use user_profile only for durable attributes or long-running patterns.',
            '- "filters.memory_tier" may include only: core, active, ambient.',
            '- Do NOT output temporal_hint or any time-range filter. Time-anchored lookup is handled by the dedicated temporal retrieval stage before this rewrite step.',
            '- Only output "temporal_intent" when the Temporal intent line above explicitly says recent/current. Never decide or upgrade recency during rewrite.',
            '- "limit" should be 6 to 20 for recall questions, unless the topic is extremely narrow.',
            '- Prefer narrow, user-centered retrieval rather than broad generic search.',
            '- Be highly sensitive to time expressions, dates, durations, numbers, amounts, counts, and order words.',
            '- Preserve temporal and numeric constraints inside the queries whenever they matter. Do not rewrite "几号/哪天/什么时候/第2次/50元/两次/几点/多久" into weaker wording like "一些/那次".',
            '- If the user asks a number-anchored question, at least one query should keep the number or amount explicitly.',
            '- If the live wording contains quoted words, slang, euphemisms, nicknames, gift/object mentions, short trigger words, or concrete repeated phrasing, keep some of those literal surface forms in the queries.',
            '- Prefer a mixed query set: literal surface-form queries first, then paraphrase queries if needed.',
            '- If temporal intent is recent/current, include surface forms that distinguish the newer event from older similar memories, but do not invent a specific date.',
            '- Do not let a broad channel/platform word become the main query by itself. If the user mentions an account, app, channel, school, company type, or platform as part of a specific event, every query using that broad anchor must also include at least one distinctive event constraint such as amount, contact direction, company/opportunity, person, object, or action.',
            '- Avoid standalone broad queries like “小红书运营” when the user is asking about a specific startup opportunity that came through Xiaohongshu; keep the platform coupled to the opportunity constraints.',
            '- When the retrieval topic is about flirting, gifts, teasing, or short repeated dialogue, your first queries should look like actual remembered wording, not analysis headings.',
            '',
            '[Hard Constraints]',
            '- Preserve all distinct semantic directions already inferred above. Do NOT collapse multi-topic requests into a single dimension.',
            rewriteConstraints.requiredFocuses.length > 0
                ? `- Required memory_focus values: ${rewriteConstraints.requiredFocuses.join(', ')}`
                : '- Required memory_focus values: none',
            rewriteConstraints.requiredQueries.length > 0
                ? `- Required query coverage topics: ${rewriteConstraints.requiredQueries.join(' | ')}`
                : '- Required query coverage topics: none',
            '- If the user asks a composite question such as study + work + background, your JSON must cover multiple matching dimensions.',
            '- Keep the original constraint sharpness. If the source wording is specific, your rewritten queries must stay specific.',
            '',
            '[Output JSON Schema]',
            '{',
            '  "queries": ["..."],',
            '  "filters": {',
            '    "memory_focus": ["user_profile"],',
            '    "memory_tier": ["core", "active"]',
            '  },',
            '  "temporal_intent": { "mode": "recent", "confidence": 0.75, "reason": "new/current event reference" },',
            '  "limit": 8',
            '}'
        ].filter(Boolean).join('\n');
        const rewriteMessages = dependencies.buildRagPlannerMessages({
            recentHistory: transformedHistory,
            latestUserMessage: plannerLatestUserMessage || recentInputString,
            conversationDigest,
            plannerInstruction: rewritePrompt,
            topicSwitchState,
            quoteData: true
        });
        dependencies.recordLlmDebug(character, 'input', rewriteMessages, {
            context_type: 'chat_intent_rewrite',
            planner_source: ragPlannerConfig.source,
            latest_user_message: recentInputString,
            retrieval_label: retrievalLabel,
            planner_topics: plannerTopics
        });
        const isValidRewritePayload = (text) => {
            const { malformed } = dependencies.parseStructuredRagQuery(text, retrievalLabel, plannerTopics);
            return !malformed;
        };
        const runRewriteAttempt = async ({ enableCache, cacheKeyExtra = '', contextType = 'chat_intent_rewrite' } = {}) => {
            const { content, usage, finishReason } = await dependencies.callLLM({
                endpoint: ragPlannerConfig.endpoint,
                key: ragPlannerConfig.key,
                model: ragPlannerConfig.model,
                messages: rewriteMessages,
                maxTokens: dependencies.SMALL_MODEL_PLANNER_MAX_TOKENS,
                temperature: 0,
                enableCache,
                cacheDb: dependencies.db,
                cacheType: 'chat_intent_rewrite',
                cacheTtlMs: 6 * 60 * 60 * 1000,
                cacheScope: `character:${character.id}`,
                cacheCharacterId: character.id,
                cacheKeyExtra,
                returnUsage: true,
                validateCachedContent: (cachedText) => isValidRewritePayload(cachedText),
                shouldCacheResult: (resultText) => isValidRewritePayload(resultText),
                debugAttempt: dependencies.buildLlmAttemptRecorder(character, {
                    context_type: contextType,
                    planner_source: ragPlannerConfig.source
                })
            });
            dependencies.recordLlmDebug(character, 'output', content, {
                context_type: contextType,
                planner_source: ragPlannerConfig.source,
                retrieval_label: retrievalLabel,
                planner_topics: plannerTopics,
                finishReason: finishReason || '',
                usage: usage || null
            });
            if (usage) {
                dependencies.recordTokenUsage(character.id, 'chat_intent_rewrite', usage);
                dependencies.broadcastEvent(wsClients, { type: 'token_stats', character_id: character.id, module: 'chat', usage });
            }
            return { content, usage, finishReason };
        };

        let retrievalRequest = normalizedResumeState?.retrievalRequest || null;
        if (!retrievalRequest || resumeFrom !== 'retrieve') {
            let { content: rewriteResult, finishReason: rewriteFinishReason } = await runRewriteAttempt({
                enableCache: true,
                contextType: 'chat_intent_rewrite'
            });
            if (String(rewriteFinishReason || '').trim() === 'length') {
                const error = new Error('RAG rewrite output was truncated. Please retry.');
                error.ragResume = {
                    failedAt: 'rewrite',
                    latestUserMessage: recentInputString,
                    plannerTopics,
                    parsedDecision,
                    rewriteConstraints
                };
                throw error;
            }

            let { request: parsedRewriteRequest, malformed: malformedRewrite } = dependencies.parseStructuredRagQuery(rewriteResult, retrievalLabel, plannerTopics);
            if (malformedRewrite) {
                const error = new Error('RAG rewrite output was malformed. Please retry.');
                error.ragResume = {
                    failedAt: 'rewrite',
                    latestUserMessage: recentInputString,
                    plannerTopics,
                    parsedDecision,
                    rewriteConstraints
                };
                throw error;
            }
            retrievalRequest = dependencies.enforceStructuredRagQueryConstraints(parsedRewriteRequest, rewriteConstraints);
        } else {
            dependencies.recordLlmDebug(character, 'event', 'Resuming RAG directly from retrieval request.', {
                context_type: 'chat_intent_retrieve_resume',
                planner_source: ragPlannerConfig.source,
                retrieval_label: retrievalLabel,
                planner_topics: plannerTopics
            });
        }
        dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'retrieve' });
        const retrievalSlots = dependencies.deriveRagRetrievalSlots({
            retrievalRequest,
            plannerTopics,
            retrievalLabel,
            latestUserMessage: recentInputString,
            decisionPlan: parsedDecision?.decisionPlan || null,
            implicitQueryScopeTerms: rewriteConstraints.implicitQueryScopeTerms || []
        });
        dependencies.recordLlmDebug(character, 'event', 'Starting structured memory retrieval.', {
            context_type: 'chat_intent_retrieve',
            planner_source: ragPlannerConfig.source,
            retrieval_label: retrievalLabel,
            planner_topics: plannerTopics,
            retrieval_request: retrievalRequest,
            retrieval_slots: retrievalSlots
        });
        let dynamicMemories;
        try {
            dynamicMemories = await dependencies.executeMultiSlotMemorySearch(
                dependencies.memory,
                character.id,
                retrievalRequest,
                retrievalSlots,
                async (progress) => {
                    dependencies.recordLlmDebug(character, 'event', `Structured memory retrieval ${progress.phase}.`, {
                        context_type: 'chat_intent_retrieve_slot',
                        planner_source: ragPlannerConfig.source,
                        retrieval_label: retrievalLabel,
                        planner_topics: plannerTopics,
                        ...progress
                    });
                }
            );
        } catch (e) {
            e.ragResume = {
                failedAt: 'retrieve',
                latestUserMessage: recentInputString,
                plannerTopics,
                parsedDecision,
                rewriteConstraints,
                retrievalRequest
            };
            throw e;
        }
        dependencies.recordLlmDebug(character, 'event', 'Structured memory retrieval finished.', {
            context_type: 'chat_intent_retrieve',
            planner_source: ragPlannerConfig.source,
            retrieval_label: retrievalLabel,
            planner_topics: plannerTopics,
            retrieved_count: Array.isArray(dynamicMemories) ? dynamicMemories.length : 0,
            retrieved_memories: Array.isArray(dynamicMemories)
                ? dynamicMemories.map(mem => ({
                    id: mem.id,
                    score: mem._search_score || '',
                    matched_query: mem._matched_query || '',
                    matched_slots: Array.isArray(mem._matched_slots) ? mem._matched_slots : [],
                    summary: mem.summary || '',
                    memory_focus: mem.memory_focus || '',
                    memory_tier: mem.memory_tier || '',
                    retention_action: mem.retention_action || '',
                    source_started_at: mem.source_started_at || 0,
                    source_ended_at: mem.source_ended_at || 0
                }))
                : []
        });
        if (dynamicMemories && dynamicMemories.length > 0) {
            const querySummary = Array.isArray(retrievalRequest.queries) ? retrievalRequest.queries.join(' | ') : retrievalLabel;
            const currentAbsoluteTime = dependencies.getLocalDateTimeFacts(new Date()).label;
            const formattedMemories = dynamicMemories.map((m, index) => {
                const summary = String(m.summary || m.event || '').trim();
                const content = String(m.content || '').trim();
                const focus = String(m.memory_focus || '').trim();
                const tier = String(m.memory_tier || '').trim();
                const matchedQuery = String(m._matched_query || '').trim();
                const matchedSlots = Array.isArray(m._matched_slots) ? m._matched_slots.filter(Boolean) : [];
                const memoryTime = String(m.time || '').trim();
                const sourceTimeText = String(m.source_time_text || '').trim();
                const sourceStartedAt = Number(m.source_started_at || 0);
                const sourceEndedAt = Number(m.source_ended_at || 0);
                const lines = [
                    `Memory ${index + 1}: ${summary || m.event || `memory_${index + 1}`}`
                ];
                lines.push(`Current Time Now: ${currentAbsoluteTime}`);
                lines.push('Timeline Rule: Compare the memory time with the current time above before using it. This is recalled memory, not something automatically happening right now.');
                if (memoryTime) {
                    lines.push(`Event Time: ${memoryTime}`);
                }
                if (sourceTimeText) {
                    lines.push(`Source Dialogue Time: ${sourceTimeText}`);
                }
                if (sourceStartedAt > 0) {
                    lines.push(`Source Absolute Start: ${new Date(sourceStartedAt).toLocaleString()}`);
                }
                if (sourceEndedAt > 0) {
                    lines.push(`Source Absolute End: ${new Date(sourceEndedAt).toLocaleString()}`);
                }
                if (content && content !== summary) {
                    lines.push(`Details: ${content}`);
                }
                if (focus || tier) {
                    lines.push(`Type: ${focus || 'unknown'} / ${tier || 'unknown'}`);
                }
                if (matchedSlots.length > 0) {
                    lines.push(`Slot Coverage: ${matchedSlots.join(', ')}`);
                }
                if (matchedQuery) {
                    lines.push(`Matched Query (search metadata, not a fact): ${matchedQuery}`);
                }
                return lines.join('\n');
            }).join('\n\n');
            const latestUserIndex = apiMessages.length - 1;
            const reference = {
                currentTime: currentAbsoluteTime,
                searchQueries: querySummary,
                memories: formattedMemories
            };
            if (latestUserIndex >= 0 && apiMessages[latestUserIndex]?.role === 'user') {
                apiMessages[latestUserIndex] = {
                    ...apiMessages[latestUserIndex],
                    content: dependencies.formatRetrievedMemoryReference({ ...reference, newestUserMessage: apiMessages[latestUserIndex].content })
                };
            } else {
                apiMessages.push({ role: 'user', content: dependencies.formatRetrievedMemoryReference(reference) });
            }

            if (!msgMetadata) msgMetadata = { retrievedMemories: [] };
            if (!Array.isArray(msgMetadata.retrievedMemories)) msgMetadata.retrievedMemories = [];
            msgMetadata.retrievedMemories.push(...dynamicMemories.map(mem => ({
                id: mem.id,
                event: mem.event,
                summary: mem.summary || '',
                content: mem.content || '',
                memory_focus: mem.memory_focus || '',
                memory_tier: mem.memory_tier || '',
                matched_slots: Array.isArray(mem._matched_slots) ? mem._matched_slots : [],
                importance: mem.importance,
                time: mem.time || '',
                created_at: mem.created_at,
                last_retrieved_at: mem.last_retrieved_at,
                retrieval_count: mem.retrieval_count || 0,
                matched_query: mem._matched_query || '',
                source_time_text: mem.source_time_text || '',
                source_started_at: mem.source_started_at || 0,
                source_ended_at: mem.source_ended_at || 0
            })));
        } else {
            console.log(`[Engine] RAG returned no relevant matches. queryChars=${String(retrievalLabel || '').length}`);
        }

        dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'answer' });

        return msgMetadata;
    }

    return { runTopicSwitchGate, buildPrompt, runStructuredRagPipeline };
}

module.exports = { createModule };
