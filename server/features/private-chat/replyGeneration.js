// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function triggerMessage(character, wsClients, isUserReply = false, isTimerWakeup = false, extraSystemDirective = null, generationOptions = {}) {
        console.log(`\n[DEBUG] === Trigger Message Entry: ${character.name} (isUserReply: ${isUserReply}) ===`);

        // Check if character is still active or blocked
        const charCheck = dependencies.db.getCharacter(character.id);
        if (!charCheck || charCheck.status !== 'active' || charCheck.is_blocked) {
            dependencies.stopTimer(character.id);
            return;
        }
        if (isUserReply && dependencies.isPrivateReplyStale(character.id, generationOptions)) {
            return dependencies.abortStalePrivateReply(charCheck, wsClients, generationOptions, 'before_generation');
        }

        const shouldResumeRag = !!(generationOptions && generationOptions.resumeRagState && isUserReply);
        const initialProgress = isUserReply
            ? (() => {
                const progress = dependencies.createRagProgress(
                    shouldResumeRag ? (generationOptions.resumeRagState.failedAt || 'switch') : 'switch'
                );
                return progress;
            })()
            : null;
        dependencies.timers.set(character.id, {
            timerId: null,
            targetTime: Date.now(),
            isThinking: true,
            ragProgress: initialProgress
        });
        dependencies.broadcastEngineState(wsClients);

        // Process pressure mechanics if this is a spontaneous auto-message (not a fast reply)
        let currentPressure = charCheck.pressure_level || 0;
        if (!isUserReply) {
            // Increase pressure since they reached a proactive trigger without user replying
            const prevPressure = currentPressure;
            currentPressure = Math.min(4, currentPressure + 1);

            // Affinity drop if they just hit max panic mode
            let newAffinity = charCheck.affinity;
            let newBlocked = charCheck.is_blocked;
            if (currentPressure === 4 && prevPressure < 4) {
                newAffinity = Math.max(0, newAffinity - 20); // Big penalty for ignoring them this long
                if (newAffinity <= 10) {
                    newBlocked = 1; // Blocked!
                    console.log(`[Engine] ${charCheck.name} has BLOCKED the user due to low affinity.`);
                }
            }

            const proactivePressurePatch = {
                pressure_level: currentPressure,
                affinity: newAffinity,
                is_blocked: newBlocked
            };
            dependencies.db.updateCharacter(character.id, proactivePressurePatch);
            dependencies.logEmotionTransition(
                charCheck,
                proactivePressurePatch,
                'auto_pressure_tick',
                '角色主动触发消息但仍未得到用户回应，焦虑值上升。'
            );
            charCheck.pressure_level = currentPressure;
            charCheck.affinity = newAffinity;
            charCheck.is_blocked = newBlocked;

            if (newBlocked) {
                dependencies.stopTimer(character.id);
                return; // Don't even send this message, they just blocked you
            }
        }

        let customDelayMs = null;
        let latestUserInputForFailure = '';
        try {
            const {
                contextHistory,
                conversationDigest,
                privateContextSummaries,
                liveHistory,
                transformedHistory,
                recentInputString
            } = await dependencies.preparePrivateConversationState({
                db: dependencies.db,
                memory: dependencies.memory,
                character: charCheck,
                refreshDigest: !!isUserReply,
                forUserReply: !!isUserReply
            });
            const eventUserDirective = String(generationOptions?.eventUserDirective || '').trim();
            const effectiveRecentInputString = String(eventUserDirective || extraSystemDirective || recentInputString || '').trim();
            latestUserInputForFailure = effectiveRecentInputString;
            const shouldSkipTopicSwitchGate = !!generationOptions?.skipTopicSwitchGate;

            if (isUserReply && !shouldSkipTopicSwitchGate) {
                dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'switch' });
            }

            const topicSwitchState = isUserReply
                ? await (async () => {
                    if (shouldSkipTopicSwitchGate) {
                        dependencies.recordLlmDebug(charCheck, 'event', 'Topic switch gate skipped for system-triggered private reply.', {
                            context_type: 'chat_topic_switch',
                            planner_source: 'skipped_system_directive',
                            latest_user_message: effectiveRecentInputString,
                            triggerSource: generationOptions?.triggerSource || '',
                            triggerRoute: generationOptions?.triggerRoute || ''
                        });
                        return {
                            decision: 'CONTINUE_CURRENT_TOPIC',
                            reason: 'system_triggered_private_reply',
                            malformed: false,
                            skipped: true
                        };
                    }
                    try {
                        return await dependencies.runTopicSwitchGate({
                            character: charCheck,
                            transformedHistory,
                            conversationDigest,
                            recentInputString: effectiveRecentInputString,
                            plannerLatestUserMessage: effectiveRecentInputString
                        });
                    } catch (switchErr) {
                        const rawMessage = String(switchErr?.message || 'Unknown topic switch gate error');
                        console.error('[Engine] Topic switch gate failed:', rawMessage);
                        dependencies.setRagFailureState(character.id, {
                            characterId: character.id,
                            latestUserMessage: effectiveRecentInputString,
                            ...(extraSystemDirective ? { extraSystemDirective } : {}),
                            ...(switchErr?.ragResume || { failedAt: 'switch', latestUserMessage: effectiveRecentInputString })
                        });
                        dependencies.updateRagProgress(character.id, wsClients, {
                            currentKey: 'answer',
                            status: 'error'
                        });
                        throw switchErr;
                    }
                })()
                : null;

            if (isUserReply) {
                dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'route' });
            }

            const {
                prompt: systemPrompt,
                promptWithoutDigest,
                stablePromptBlock,
                dynamicPromptBlock,
                dynamicPromptWithoutDigest,
                retrievedMemoriesContext,
                promptStats
            } = await dependencies.buildPrompt(charCheck, liveHistory, isTimerWakeup, {
                conversationDigest,
                privateContextSummaries,
                recentInputString: effectiveRecentInputString,
                topicSwitchState
            });
            if (isUserReply) {
                dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'topics' });
            }
            const apiMessages = [
                { role: 'system', content: stablePromptBlock || systemPrompt },
                ...(dynamicPromptBlock ? [{ role: 'system', content: dynamicPromptBlock }] : []),
                ...transformedHistory,
                // A zero history window still needs the current user's message, even without RAG results.
                ...(isUserReply && transformedHistory.length === 0 && recentInputString
                    ? [{ role: 'user', content: recentInputString }]
                    : [])
            ];

            // Setup metadata block if we retrieved any memories
            let msgMetadata = null;
            if (retrievedMemoriesContext && retrievedMemoriesContext.length > 0) {
                msgMetadata = { retrievedMemories: retrievedMemoriesContext };
            }

            if (extraSystemDirective) {
                const directiveRole = String(generationOptions?.extraDirectiveRole || 'user').trim().toLowerCase();
                apiMessages.push({
                    role: directiveRole === 'system' ? 'system' : 'user',
                    content: extraSystemDirective
                });
                if (eventUserDirective) {
                    apiMessages.push({
                        role: 'user',
                        content: eventUserDirective
                    });
                }
                if (generationOptions?.markSystemEventReply !== false) {
                    msgMetadata = {
                        ...(msgMetadata || {}),
                        systemEventReply: {
                            extraSystemDirective,
                            extraDirectiveRole: directiveRole === 'system' ? 'system' : 'user',
                            eventUserDirective,
                            triggerSource: String(generationOptions?.triggerSource || '').trim(),
                            triggerRoute: String(generationOptions?.triggerRoute || '').trim(),
                            triggerNote: String(generationOptions?.triggerNote || '').trim()
                        }
                    }
                }
            } else if (!isUserReply && (transformedHistory.length === 0 || apiMessages[apiMessages.length - 1]?.role === 'assistant')) {
                // Prevent third-party AI API proxies from auto-injecting "继续" (Continue)
                // by explicitly providing a system-level user message.
                const currentUserName = String(dependencies.db.getUserProfile?.()?.name || '用户').trim() || '用户';
                apiMessages.push({
                    role: 'user',
                    content: `[系统提示：上面 history 里 role=assistant 的内容，都是你这个角色自己之前说过的话；role=user 的内容，才是用户 ${currentUserName} 说的话；role=system 是系统事件。现在请你以 assistant 身份，基于当前语境主动给 ${currentUserName} 发一条新消息。不要把 assistant 历史误认成 user 说的话。]`
                });
            }

            if (isUserReply) {
                try {
                    msgMetadata = await dependencies.runStructuredRagPipeline({
                        character,
                        transformedHistory,
                        recentInputString: effectiveRecentInputString,
                        plannerLatestUserMessage: effectiveRecentInputString,
                        conversationDigest,
                        topicSwitchState,
                        wsClients,
                        apiMessages,
                        msgMetadata,
                        resumeState: generationOptions?.resumeRagState || null
                    });
                    dependencies.setRagFailureState(character.id, null);
                } catch (intentErr) {
                    const rawMessage = String(intentErr?.message || 'Unknown RAG planner error');
                    console.error(`[Engine] RAG planner failed:`, rawMessage);
                    dependencies.setRagFailureState(character.id, {
                        characterId: character.id,
                        latestUserMessage: effectiveRecentInputString,
                        ...(extraSystemDirective ? { extraSystemDirective } : {}),
                        ...(intentErr?.ragResume || {})
                    });
                    dependencies.updateRagProgress(character.id, wsClients, {
                        currentKey: 'answer',
                        status: 'error'
                    });
                    if (/RAG planner/i.test(rawMessage)) {
                        throw intentErr;
                    }
                    throw new Error(`RAG planner failed. Please retry. (${rawMessage.slice(0, 180)})`);
                }
            }

            if (isUserReply) {
                dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'answer' });
            }

            const currentBreakdown = { ...(promptStats?.universalBreakdown || {}) };
            const estimatedHistoryTokens = dependencies.estimateMessageTokens(transformedHistory);
            const estimatedFullHistoryTokens = dependencies.estimateMessageTokens(
                (Array.isArray(contextHistory) ? contextHistory : []).map(m => ({
                    role: m?.role === 'character'
                        ? 'assistant'
                        : (m?.role === 'user' ? 'user' : 'system'),
                    content: String(m?.content || '')
                }))
            );
            const estimatedMessageEnvelopeTokens = 8 + (Array.isArray(transformedHistory) ? transformedHistory.length * 2 : 0);
            const estimatedFullMessageEnvelopeTokens = 8 + (Array.isArray(contextHistory) ? contextHistory.length * 2 : 0);
            const estimatedSystemPromptTokens = dependencies.getTokenCount(systemPrompt);
            const estimatedSystemPromptWithoutDigestTokens = dependencies.getTokenCount(promptWithoutDigest || systemPrompt);
            const estimatedWithoutCacheTokens = estimatedSystemPromptWithoutDigestTokens + estimatedFullHistoryTokens + estimatedFullMessageEnvelopeTokens;
            const estimatedWithCacheTokens = estimatedSystemPromptTokens + estimatedHistoryTokens + estimatedMessageEnvelopeTokens;
            const estimatedRagInjectedTokens = Math.max(0, Number(currentBreakdown.z_memory || 0));
            const lastRequestContextSnapshot = {
                estimated_without_cache_tokens: estimatedWithoutCacheTokens,
                estimated_with_cache_tokens: estimatedWithCacheTokens,
                estimated_rag_injected_tokens: estimatedRagInjectedTokens,
                estimated_history_tokens: estimatedHistoryTokens,
                estimated_full_history_tokens: estimatedFullHistoryTokens,
                estimated_message_envelope_tokens: estimatedMessageEnvelopeTokens,
                estimated_full_message_envelope_tokens: estimatedFullMessageEnvelopeTokens,
                estimated_system_prompt_tokens: estimatedSystemPromptTokens,
                estimated_system_prompt_without_digest_tokens: estimatedSystemPromptWithoutDigestTokens,
                breakdown: currentBreakdown,
                module_routes: { ...(promptStats?.moduleRoutes || {}) },
                topic_switch: topicSwitchState ? {
                    decision: String(topicSwitchState.decision || '').trim() || 'CONTINUE_CURRENT_TOPIC',
                    reason: String(topicSwitchState.reason || '').trim() || 'unspecified',
                    fallback: !!topicSwitchState.fallback
                } : null,
                context_msg_limit: Number(charCheck.context_msg_limit || 0),
                live_history_window_size: Number(liveHistory.length || 0),
                visible_history_count: Number(contextHistory.length || 0),
                timestamp: Date.now()
            };

            dependencies.recordLlmDebug(charCheck, 'input', apiMessages, {
                context_type: isUserReply ? 'private_reply' : (isTimerWakeup ? 'timer_wakeup' : 'proactive'),
                isUserReply,
                isTimerWakeup,
                extraSystemDirective: extraSystemDirective || '',
                eventUserDirective,
                retrievedMemoriesCount: Array.isArray(msgMetadata?.retrievedMemories) ? msgMetadata.retrievedMemories.length : 0,
                maxTokens: charCheck.max_tokens || 2000,
                model: charCheck.model_name,
                presencePenalty: isUserReply ? 0.35 : 0,
                frequencyPenalty: isUserReply ? 0.45 : 0,
                context_snapshot: isUserReply ? lastRequestContextSnapshot : null
            });
            const uncachedApiMessages = isUserReply
                ? [
                    { role: 'system', content: stablePromptBlock || promptWithoutDigest || systemPrompt },
                    ...(dynamicPromptWithoutDigest ? [{ role: 'system', content: dynamicPromptWithoutDigest }] : []),
                    ...(Array.isArray(contextHistory) ? contextHistory : []).map(m => ({
                        role: m?.role === 'character'
                            ? 'assistant'
                            : (m?.role === 'user' ? 'user' : 'system'),
                        content: String(m?.content || '')
                    }))
                ]
                : null;

            let replyRequestSnapshot = isUserReply ? {
                messages: structuredClone(apiMessages),
                maxTokens: character.max_tokens || 2000,
                presencePenalty: 0.35,
                frequencyPenalty: 0.45
            } : null;
            let { content: generatedText, usage, finishReason } = await dependencies.callLLM({
                endpoint: character.api_endpoint,
                key: character.api_key,
                model: character.model_name,
                messages: apiMessages,
                uncachedMessages: uncachedApiMessages,
                maxTokens: character.max_tokens || 2000,
                presencePenalty: isUserReply ? 0.35 : 0,
                frequencyPenalty: isUserReply ? 0.45 : 0,
                enableCache: !!isUserReply,
                cacheDb: dependencies.db,
                cacheType: 'private_chat_reply',
                cacheTtlMs: 24 * 60 * 60 * 1000,
                cacheScope: `character:${character.id}`,
                cacheCharacterId: character.id,
                cacheKeyExtra: 'weekday-timefacts-v1',
                cacheKeyMode: 'private_prefix',
                enablePromptCacheHints: !!isUserReply,
                promptCacheHintMode: 'stable_system_only',
                returnUsage: true,
                debugAttempt: dependencies.buildLlmAttemptRecorder(character, {
                    context_type: isUserReply ? 'private_reply' : (isTimerWakeup ? 'timer_wakeup' : 'proactive')
                })
            });

            if (isUserReply && dependencies.isPrivateReplyStale(character.id, generationOptions)) {
                return dependencies.abortStalePrivateReply(charCheck, wsClients, generationOptions, 'after_model');
            }

            if (isUserReply && generatedText && /\[WEB_SEARCH_INTENT:/i.test(String(generatedText))) {
                if (dependencies.isPrivateReplyStale(character.id, generationOptions)) {
                    return dependencies.abortStalePrivateReply(charCheck, wsClients, generationOptions, 'before_web_draft');
                }
                const firstWebDraftText = dependencies.stripHiddenTagsForVisibleMessage(generatedText);
                const preWebFreshChar = dependencies.db.getCharacter(character.id);
                const preWebMessages = dependencies.db.getMessages(character.id, 2);
                const preWebLastMsg = preWebMessages[preWebMessages.length - 1];
                const preWebWasWiped = !preWebFreshChar
                    || preWebMessages.length === 0
                    || (preWebMessages.length <= 1 && preWebLastMsg?.content?.includes('All chat history'));
                if (preWebWasWiped) {
                    console.log(`\n[Engine] Aborting web followup for ${charCheck.name}: Chat history was wiped mid-generation.`);
                    dependencies.timers.delete(character.id);
                    return;
                }
                const draftSaved = firstWebDraftText
                    ? dependencies.persistVisibleCharacterText({
                        characterId: character.id,
                        text: firstWebDraftText,
                        wsClients,
                        metadata: msgMetadata
                    })
                    : [];
                const webFollowup = await dependencies.runWebSearchFollowupIfRequested({
                    character,
                    charCheck,
                    generatedText,
                    usage,
                    apiMessages,
                    transformedHistory,
                    recentInputString: effectiveRecentInputString,
                    conversationDigest,
                    topicSwitchState,
                    wsClients
                });
                generatedText = webFollowup.generatedText;
                usage = webFollowup.usage;
                finishReason = webFollowup.finishReason || finishReason;
                if (webFollowup.replyRequest) replyRequestSnapshot = webFollowup.replyRequest;
                if (dependencies.isPrivateReplyStale(character.id, generationOptions)) {
                    return dependencies.abortStalePrivateReply(charCheck, wsClients, generationOptions, 'after_web_followup');
                }
                if (draftSaved.length > 0) {
                    msgMetadata = null;
                }
            }

            if ((finishReason === 'length' || dependencies.looksPrematurelyCutOff(generatedText)) && generatedText) {
                const continuationMaxAttempts = 3;
                const continuationMaxTokens = Math.min(character.max_tokens || 2000, 800);
                for (let continuationIndex = 0; continuationIndex < continuationMaxAttempts; continuationIndex++) {
                    try {
                        const continuation = await dependencies.callLLM({
                            endpoint: character.api_endpoint,
                            key: character.api_key,
                            model: character.model_name,
                            messages: [
                                ...apiMessages,
                                { role: 'assistant', content: generatedText },
                                { role: 'user', content: '[系统续写] 你上一条消息被截断了。不要重说前文，只把刚才没说完的那句话自然续完并收尾。输出纯文本。' }
                            ],
                            maxTokens: continuationMaxTokens,
                            presencePenalty: isUserReply ? 0.2 : 0,
                            frequencyPenalty: isUserReply ? 0.3 : 0,
                            enableCache: !!isUserReply,
                            cacheDb: dependencies.db,
                            cacheType: 'private_chat_reply_continuation',
                            cacheTtlMs: 24 * 60 * 60 * 1000,
                            cacheScope: `character:${character.id}`,
                            cacheCharacterId: character.id,
                            cacheKeyExtra: 'weekday-timefacts-v1',
                            cacheKeyMode: 'private_prefix',
                            enablePromptCacheHints: !!isUserReply,
                            promptCacheHintMode: 'stable_system_only',
                            returnUsage: true,
                            debugAttempt: dependencies.buildLlmAttemptRecorder(character, {
                                context_type: 'private_reply_continuation'
                            })
                        });
                        const continuationText = String(continuation?.content || '').trim();
                        if (!continuationText) break;
                        generatedText = `${generatedText}${continuationText}`.trim();
                        if (continuation.usage) {
                            usage = usage || { prompt_tokens: 0, completion_tokens: 0 };
                            usage.prompt_tokens = (usage.prompt_tokens || 0) + (continuation.usage.prompt_tokens || 0);
                            usage.completion_tokens = (usage.completion_tokens || 0) + (continuation.usage.completion_tokens || 0);
                        }
                        finishReason = continuation.finishReason || finishReason;
                        if (!(finishReason === 'length' || dependencies.looksPrematurelyCutOff(generatedText))) {
                            break;
                        }
                    } catch (continuationErr) {
                        console.warn(`[Engine] Continuation failed for ${character.name}: ${continuationErr.message}`);
                        break;
                    }
                }
            }

            if (isUserReply && dependencies.isPrivateReplyStale(character.id, generationOptions)) {
                return dependencies.abortStalePrivateReply(charCheck, wsClients, generationOptions, 'before_save');
            }

            if (usage) {
                dependencies.recordTokenUsage(character.id, 'chat', usage);
                dependencies.broadcastEvent(wsClients, {
                    type: 'token_stats',
                    character_id: character.id,
                    module: 'chat',
                    usage: usage
                });
            }

            console.log(`[Engine] LLM output received for ${charCheck.name}. chars=${String(generatedText || '').length}`);
            dependencies.recordLlmDebug(charCheck, 'output', generatedText, {
                context_type: isUserReply ? 'private_reply' : (isTimerWakeup ? 'timer_wakeup' : 'proactive'),
                finishReason: finishReason || 'unknown',
                usage: usage || null,
                model: charCheck.model_name
            });

            // --- Anti-Race-Condition Check ---
            // If the user clicked "Deep Wipe" while the LLM was thinking (which takes 5-15s),
            // we MUST abort saving this reply, otherwise we will resurrect their wiped stats!
            // We check specifically for the deep-wipe system notice rather than message count,
            // because message count check causes false positives on the very first message.
            const freshCharCheck = dependencies.db.getCharacter(character.id);
            const postWipeCheck = dependencies.db.getMessages(character.id, 2);
            const lastMsg = postWipeCheck[postWipeCheck.length - 1];
            const wasWiped = !freshCharCheck
                || postWipeCheck.length === 0                                          // messages fully cleared
                || (postWipeCheck.length <= 1 && lastMsg?.content?.includes('All chat history')); // wipe notice present
            if (wasWiped) {
                console.log(`\n[Engine] Aborting save for ${charCheck.name}: Chat history was wiped mid-generation.`);
                dependencies.timers.delete(character.id);
                return;
            }

            const visibleGeneratedText = dependencies.stripHistoryMetadataPrefixFromOutput(dependencies.stripHiddenTagsForVisibleMessage(generatedText));
            if (!visibleGeneratedText) {
                throw new Error('AI returned no visible reply. Please retry.');
            }

            const generatedTransferMatch = String(generatedText || '').match(/\[TRANSFER:\s*([^\]|\s]+)\s*(?:\|\s*([\s\S]*?))?\s*\]/i);
            const generatedTransferIntent = generatedTransferMatch
                ? {
                    amount: dependencies.normalizeGeneratedTransferAmount(generatedTransferMatch[1]),
                    note: (generatedTransferMatch[2] || '').trim()
                }
                : null;
            if (generatedTransferMatch && !generatedTransferIntent.amount) {
                throw new Error('AI returned invalid transfer amount. Please retry.');
            }
            // Mood changes are constrained to EMOTION_STATE only.
            // Legacy mood/pressure tags are still stripped later, but no longer mutate mood.
            const generatedJealousyLevel = charCheck.sys_jealousy !== 0
                ? dependencies.parseGeneratedBoundedTag(generatedText, 'JEALOUSY', 0, 100, 'AI returned invalid jealousy level. Please retry.')
                : null;
            const generatedAffinityDelta = dependencies.parseGeneratedAffinityDelta(generatedText);
            const generatedCharAffinityDeltas = dependencies.parseGeneratedCharAffinityDeltas(generatedText, { selfId: character.id });

            if (generatedText) {
                // Check for self-scheduled timer tags like [TIMER: 60]
                const timerRegex = /\[TIMER:\s*(\d+)\s*\]/i;
                const match = generatedText.match(timerRegex);
                if (match && match[1]) {
                    let minutes = parseInt(match[1], 10);
                    // Cap the self-scheduled timer to the user's absolute max interval to prevent 2-hour dropoffs
                    const maxAllowedMins = charCheck.interval_max || 120;
                    minutes = Math.min(Math.max(minutes, 0.1), maxAllowedMins);
                    customDelayMs = minutes * 60 * 1000;
                    console.log(`[Engine] ${charCheck.name} self-scheduled next message in ${minutes} minutes (capped to max interval).`);
                }

                // Check for transfer tags like [TRANSFER: 5.20 | Sorry!]
                if (generatedTransferIntent) {
                    const { amount, note } = generatedTransferIntent;
                    console.log(`[Engine] ${charCheck.name} wants to send a transfer of 楼${amount}. noteChars=${String(note || '').length}`);

                    // Create traceable transfer record in DB (also deducts char wallet)
                    let transferId = null;
                    try {
                        transferId = dependencies.db.createTransfer({
                            charId: character.id,
                            senderId: character.id,
                            recipientId: 'user',
                            amount,
                            note,
                            messageId: null // will update below
                        });
                    } catch (walletErr) {
                        console.warn(`[Engine] ${charCheck.name} wallet insufficient for transfer 楼${amount}: ${walletErr.message}`);
                    }

                    // Only send transfer message + boost affinity if wallet had enough funds
                    if (transferId) {
                        dependencies.broadcastWalletSync(wsClients, character.id);

                        // Build message with transfer ID so frontend can render the claim button
                        const transferText = `[TRANSFER]${transferId}|${amount}|${note}`;
                        const { id: tMsgId, timestamp: tTs } = dependencies.db.addMessage(character.id, 'character', transferText);
                        dependencies.broadcastNewMessage(wsClients, { id: tMsgId, character_id: character.id, role: 'character', content: transferText, timestamp: tTs });

                        // Boost affinity slightly and potentially unblock
                        const newAff = Math.min(100, charCheck.affinity + 20);
                        dependencies.db.updateCharacter(character.id, { affinity: newAff, is_blocked: 0, pressure_level: 0 });
                    } else {
                        console.log(`[Engine] ${charCheck.name} transfer of 楼${amount} was BLOCKED (insufficient wallet). No message sent.`);
                    }
                }

                // Check for Diary tags
                const diaryRegex = /\[DIARY:\s*([\s\S]*?)\s*\]/i;
                const diaryMatch = generatedText.match(diaryRegex);
                if (diaryMatch && diaryMatch[1]) {
                    const diaryContent = diaryMatch[1].trim();
                    console.log(`[Engine] ${charCheck.name} wrote a Diary entry.`);
                    dependencies.db.addDiary(character.id, diaryContent, 'neutral'); // Emotion could be extracted later
                }

                // Check for Diary Unlock
                const unlockRegex = /\[UNLOCK_DIARY\]/i;
                if (unlockRegex.test(generatedText)) {
                    console.log(`[Engine] ${charCheck.name} unlocked their diary for the user!`);
                    dependencies.db.unlockDiaries(character.id);
                }

                // Check for Diary Password reveal [DIARY_PASSWORD:xxxx]
                const diaryPwRegex = /\[DIARY_PASSWORD:\s*([^\]]+)\s*\]/i;
                const diaryPwMatch = generatedText.match(diaryPwRegex);
                if (diaryPwMatch && diaryPwMatch[1]) {
                    const pw = diaryPwMatch[1].trim();
                    console.log(`[Engine] ${charCheck.name} set a diary password.`);
                    dependencies.db.setDiaryPassword(character.id, pw);
                }

                // Check for Affinity changes (AI-evaluated)
                if (generatedAffinityDelta !== null) {
                    const delta = generatedAffinityDelta;
                    const newAff = Math.max(0, Math.min(100, charCheck.affinity + delta));
                    console.log(`[Engine] ${charCheck.name} evaluation: Affinity changed by ${delta}, now ${newAff}`);
                    dependencies.db.updateCharacter(character.id, { affinity: newAff });
                    charCheck.affinity = newAff; // Update local state
                    dependencies.broadcastEvent(wsClients, { type: 'refresh_contacts' });
                }

                const combinedEmotionPatch = {};
                let combinedEmotionSource = '';
                const combinedEmotionReasons = [];

                const emotionStateRegex = /\[EMOTION_STATE:\s*([a-zA-Z_\u4e00-\u9fa5]+)\s*\]/i;
                const emotionStateMatch = generatedText.match(emotionStateRegex);
                if (emotionStateMatch?.[1]) {
                    const statePatch = dependencies.getExplicitEmotionStatePatch({ ...charCheck, ...combinedEmotionPatch }, emotionStateMatch[1]);
                    if (statePatch && Object.keys(statePatch).length > 0) {
                        Object.assign(combinedEmotionPatch, statePatch);
                        combinedEmotionSource = combinedEmotionSource || 'ai_combined_emotion_update';
                        combinedEmotionReasons.push('角色在回复中从允许的心情名称中选择了当前主情绪。');
                    }
                }

                // Parse [JEALOUSY:N] tag; AI self-regulates jealousy cooldown.
                if (generatedJealousyLevel !== null) {
                    const newJealousy = generatedJealousyLevel;
                    combinedEmotionPatch.jealousy_level = newJealousy;
                    if (newJealousy === 0) combinedEmotionPatch.jealousy_target = '';
                    combinedEmotionSource = combinedEmotionSource || 'ai_combined_emotion_update';
                    combinedEmotionReasons.push('角色在回复中主动调整了自己的嫉妒值。');
                    console.log(`[Engine] ${character.name} jealousy self-adjusted to ${newJealousy}`);
                }

                if (Object.keys(combinedEmotionPatch).length > 0) {
                    dependencies.db.updateCharacter(character.id, combinedEmotionPatch);
                    dependencies.logEmotionTransition(
                        charCheck,
                        combinedEmotionPatch,
                        combinedEmotionSource || 'ai_combined_emotion_update',
                        combinedEmotionReasons.join(' ')
                    );
                    Object.assign(charCheck, combinedEmotionPatch);
                    dependencies.broadcastEvent(wsClients, { type: 'refresh_contacts' });
                }

                // Check for CHAR_AFFINITY changes (inter-character affinity from private chat context)
                for (const { targetId, delta } of generatedCharAffinityDeltas) {
                    const source = `private:${character.id}`;
                    const existing = dependencies.db.getCharRelationship(character.id, targetId);
                    const existingRow = existing?.sources?.find(s => s.source === source);
                    const currentAffinity = existingRow?.affinity || 50;
                    const newAffinity = Math.max(0, Math.min(100, currentAffinity + delta));
                    const updated = dependencies.db.updateCharRelationship(character.id, targetId, source, { affinity: newAffinity });
                    if (updated) console.log(`[Social] ${charCheck.name} -> ${targetId}: private affinity delta ${delta}, now ${newAffinity}`);
                }

                let cityIntentHandled = false;
                const cityActionRegex = /\[CITY_ACTION:\s*([\s\S]*?)\s*\]/i;
                const cityActionMatch = generatedText.match(cityActionRegex);
                if (cityActionMatch && cityActionMatch[1] && dependencies.cityReplyActionCallback) {
                    try {
                        const rawCityAction = cityActionMatch[1].trim();
                        const parsedCityAction = dependencies.parseGeneratedCityActionPayload(rawCityAction);
                        const cityActionResult = await dependencies.cityReplyActionCallback(dependencies.userId, character.id, parsedCityAction, generatedText);
                        if (cityActionResult?.canRetry) {
                            throw new Error(cityActionResult.reason || 'city action retry required');
                        }
                        cityIntentHandled = true;
                    } catch (cityActionErr) {
                        throw new Error(`AI returned invalid city action. Please retry. ${cityActionErr.message}`);
                    }
                }

                const cityIntentRegex = /\[CITY_INTENT:\s*([^\]]+)\]/i;
                const cityIntentMatch = generatedText.match(cityIntentRegex);
                if (!cityIntentHandled && cityIntentMatch && cityIntentMatch[1] && dependencies.cityReplyIntentCallback) {
                    try {
                        const cityIntentResult = await dependencies.cityReplyIntentCallback(dependencies.userId, character.id, cityIntentMatch[1].trim(), generatedText);
                        if (cityIntentResult?.canRetry) {
                            throw new Error(cityIntentResult.reason || 'city intent retry required');
                        }
                        cityIntentHandled = true;
                    } catch (cityIntentErr) {
                        throw new Error(`AI returned invalid city intent. Please retry. ${cityIntentErr.message}`);
                    }
                }

                const ttsIntent = dependencies.parseTtsIntentTag(generatedText);

                // Strip all tags from the final text message using a global regex
                const globalStripRegex = /\[(?:TIMER|TRANSFER|DIARY|UNLOCK_DIARY|AFFINITY|CHAR_AFFINITY|PRESSURE|PRESSURE_DELTA|JEALOUSY|MOOD_DELTA|EMOTION_REASON|EMOTION_STATE|CITY_INTENT|CITY_ACTION|WEB_SEARCH_INTENT|TTS_INTENT|DIARY_PASSWORD|REDPACKET_SEND|Red Packet)[^\]]*\]/gi;
                generatedText = generatedText.replace(globalStripRegex, '').replace(/\[\s*\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
                generatedText = dependencies.stripTtsIntentTags(generatedText);
                generatedText = dependencies.stripHistoryMetadataPrefixFromOutput(generatedText);

                if (generatedText.length > 0 && dependencies.cityReplyStateSyncCallback && !cityIntentHandled) {
                    try {
                        await dependencies.cityReplyStateSyncCallback(dependencies.userId, character.id, generatedText);
                    } catch (citySyncErr) {
                        console.warn(`[Engine] City reply state sync failed for ${character.name}: ${citySyncErr.message}`);
                    }
                }

                if (isUserReply && dependencies.isPrivateReplyStale(character.id, generationOptions)) {
                    return dependencies.abortStalePrivateReply(charCheck, wsClients, generationOptions, 'before_visible_save');
                }

                if (generatedText.length > 0) {
                    // Server-side deduplication: reject identical/near-identical messages.
                    const recentCharMsgs = dependencies.db.getMessages(character.id, 15)
                        .filter(m => m.role === 'character')
                        .slice(-8)
                        .map(m => m.content.replace(/\s+/g, '').toLowerCase());
                    const normalizedNew = generatedText.replace(/\s+/g, '').toLowerCase();
                    const isDuplicate = recentCharMsgs.some(prev => {
                        // Layer 1: Exact match
                        if (prev === normalizedNew) return true;

                        // Layer 2: Overall character similarity > 50%
                        const shorter = Math.min(prev.length, normalizedNew.length);
                        const longer = Math.max(prev.length, normalizedNew.length);
                        if (shorter === 0) return false;
                        let matches = 0;
                        for (let ci = 0; ci < shorter; ci++) {
                            if (prev[ci] === normalizedNew[ci]) matches++;
                        }
                        if ((matches / longer) > 0.5) return true;

                        // Layer 3: Prefix pattern; if first 40% of message is same, it's a structural repeat.
                        const prefixLen = Math.max(4, Math.floor(Math.min(prev.length, normalizedNew.length) * 0.4));
                        if (prev.substring(0, prefixLen) === normalizedNew.substring(0, prefixLen)) return true;

                        return false;
                    });

                    if (isDuplicate && !isUserReply) {
                        // Track consecutive dedup blocks per character
                        const blockCount = (dependencies.dedupBlockCounts.get(character.id) || 0) + 1;
                        dependencies.dedupBlockCounts.set(character.id, blockCount);
                        console.log(`[Engine] DEDUP: ${charCheck.name} generated duplicate message (block #${blockCount}), skipping. chars=${generatedText.length}`);

                        if (blockCount >= 2) {
                            // After 2 consecutive blocks, inject a context-breaking system message
                            const topicResetMsg = `[System Notice: Your previous messages were too repetitive and were blocked. You MUST talk about something COMPLETELY DIFFERENT now. Do NOT reply to the user's last message again - instead, share what you're doing, talk about something random, express a new emotion, or bring up an unrelated memory. Be creative and surprising.]`;
                            dependencies.db.addMessage(character.id, 'system', topicResetMsg);
                            console.log(`[Engine] Injected topic-reset notice for ${charCheck.name} after ${blockCount} dedup blocks.`);
                            dependencies.dedupBlockCounts.set(character.id, 0); // Reset counter
                        }

                        console.log(`[DEBUG] === Trigger Message Exit: ${charCheck.name}. Calling scheduleNext. ===`);
                        dependencies.scheduleNext(character, wsClients);
                        return;
                    }

                    // Reset dedup block counter on successful send
                    dependencies.dedupBlockCounts.set(character.id, 0);

                    // Split the response by newlines to allow the AI to send multiple separate bubbles in one turn
                    const textBubbles = generatedText.split('\n').map(msg => msg.trim()).filter(msg => msg.length > 0);
                    const replyMessageIds = [];

                    for (let i = 0; i < textBubbles.length; i++) {
                        const bubbleString = textBubbles[i];

                        // Save to DB
                        const { id: messageId, timestamp: messageTs } = dependencies.db.addMessage(character.id, 'character', bubbleString, msgMetadata);
                        replyMessageIds.push(messageId);
                        const shouldTts = dependencies.shouldSynthesizePrivateTts({
                            character: charCheck,
                            text: bubbleString,
                            intent: ttsIntent,
                            isUserReply
                        });
                        const ttsMetadata = shouldTts ? {
                            ...(msgMetadata || {}),
                            tts: {
                                status: 'pending',
                                provider: charCheck.tts_provider || 'tencent',
                                voice: charCheck.tts_voice || '',
                                model: charCheck.tts_model || ''
                            }
                        } : msgMetadata;
                        const newMessage = {
                            id: messageId,
                            character_id: character.id,
                            role: 'character',
                            content: bubbleString,
                            timestamp: messageTs + i, // slight increment to ensure ordering
                            read: 0,
                            metadata: ttsMetadata
                        };

                        if (replyRequestSnapshot && i === textBubbles.length - 1) {
                            const registered = dependencies.db.registerPrivateReply(character.id, replyMessageIds, replyRequestSnapshot, msgMetadata);
                            newMessage.metadata = { ...(ttsMetadata || {}), replyVersion: registered.metadata.replyVersion };
                        }

                        // Push to any connected websockets
                        dependencies.broadcastNewMessage(wsClients, newMessage);
                        if (shouldTts) {
                            dependencies.synthesizeAndStoreMessage({
                                db: dependencies.db,
                                userId: dependencies.userId,
                                character: charCheck,
                                messageId,
                                text: bubbleString,
                                intent: ttsIntent,
                                broadcastEvent: dependencies.broadcastEvent,
                                wsClients
                            }).catch(err => console.error('[TTS] Background synthesis error:', err.message));
                        }
                    }

                    if (isUserReply) {
                        dependencies.updateRagProgress(character.id, wsClients, {
                            currentKey: 'answer',
                            status: 'completed',
                            skipped: false
                        });
                        const completedRunId = dependencies.timers.get(character.id)?.ragProgress?.runId || null;
                        dependencies.clearCompletedRagProgressSoon(character.id, wsClients, completedRunId);
                    }
                    if (isUserReply) {
                        dependencies.setRagFailureState(character.id, null);
                    }

                    // Long-term memory extraction is handled by the overflow sweep/manual extraction paths.
                    // Avoid running the small memory model after every reply; overlapping chat windows
                    // create duplicate memory cards and unnecessary token usage.
                }
            }

        } catch (e) {
            console.error(`[Engine] Failed to trigger message for ${character.id}:`, e.message);
            if (isUserReply) {
                const resumeState = generationOptions?.resumeRagState || null;
                dependencies.setRagFailureState(character.id, {
                    ...(resumeState && typeof resumeState === 'object' ? resumeState : {}),
                    characterId: character.id,
                    latestUserMessage: latestUserInputForFailure || String(resumeState?.latestUserMessage || '').trim(),
                    failedAt: String(resumeState?.failedAt || (extraSystemDirective ? 'event_reply' : 'answer')).trim() || 'answer',
                    ...(extraSystemDirective ? { extraSystemDirective } : {}),
                    ...(generationOptions?.extraDirectiveRole ? { extraDirectiveRole: generationOptions.extraDirectiveRole } : {}),
                    ...(generationOptions?.eventUserDirective ? { eventUserDirective: generationOptions.eventUserDirective } : {}),
                    ...(generationOptions?.triggerSource ? { triggerSource: generationOptions.triggerSource } : {}),
                    ...(generationOptions?.triggerNote ? { triggerNote: generationOptions.triggerNote } : {}),
                    ...(generationOptions?.skipTopicSwitchGate ? { skipTopicSwitchGate: true } : {}),
                    ...(generationOptions?.skipContextModuleRouting ? { skipContextModuleRouting: true } : {})
                });
            }
            if (isUserReply) {
                dependencies.updateRagProgress(character.id, wsClients, {
                    currentKey: 'answer',
                    status: 'error',
                    skipped: false
                });
            }
            // Show the error visibly in the chat so the user knows what went wrong
            const errText = e.message || 'Unknown error';
            const errorMetadata = extraSystemDirective ? {
                systemEventReply: {
                    extraSystemDirective,
                    extraDirectiveRole: String(generationOptions?.extraDirectiveRole || 'system').trim() || 'system',
                    eventUserDirective: String(generationOptions?.eventUserDirective || '').trim(),
                    triggerSource: String(generationOptions?.triggerSource || '').trim(),
                    triggerRoute: String(generationOptions?.triggerRoute || '').trim(),
                    triggerNote: String(generationOptions?.triggerNote || '').trim(),
                    skipTopicSwitchGate: !!generationOptions?.skipTopicSwitchGate,
                    skipContextModuleRouting: !!generationOptions?.skipContextModuleRouting
                }
            } : null;
            const { id: msgId, timestamp: msgTs } = dependencies.db.addMessage(character.id, 'system', `[System] API Error: ${errText}`, errorMetadata);
            dependencies.broadcastNewMessage(wsClients, {
                id: msgId, character_id: character.id, role: 'system',
                content: `[System] API Error: ${errText}`, timestamp: msgTs,
                metadata: errorMetadata
            });
            if (generationOptions?.propagateError) {
                throw e;
            }
        }

        // Re-fetch fresh character data for scheduling (status/interval/pressure may have changed during LLM call)
        const freshChar = dependencies.db.getCharacter(character.id);
        if (freshChar) {
            console.log(`[DEBUG] === Trigger Message Exit: ${freshChar.name}. Calling scheduleNext. ===\n`);
            dependencies.scheduleNext(freshChar, wsClients, customDelayMs);
        } else {
            console.log(`[DEBUG] === Trigger Message Exit: character ${character.id} no longer exists, skipping scheduleNext. ===\n`);
        }
    }

    return { triggerMessage };
}

module.exports = { createModule };
