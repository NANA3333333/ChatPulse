// GET /api/characters/:id/context-stats
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/characters/:id/context-stats', require("../../../platform/http/trace.js").traceHttp("private-chat", "GET /api/characters/:id/context-stats"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    try {
        const charId = req.params.id;
        const character = db.getCharacter(charId);
        if (!character) return res.status(404).json({ error: 'Character not found' });

        const { getUserDb } = require("../../../platform/db/userDatabase.js");
        const { getMemory } = require("../../memory/index.js");
        const memory = getMemory(req.user.id);
        const engineContextWrapper = { getUserDb, getMemory, userId: req.user.id, skipBasePrivateWindow: true };

        // relationships exist in the DLC, so fallback to just friends or a raw DB query if method doesn't exist
        const isDlcActive = typeof db.getCharRelationships === 'function';
        const relationships = isDlcActive ? db.getCharRelationships(charId) : db.getCharacters().filter(c => c.id !== charId);
        const activeTargets = relationships.map(r => isDlcActive ? db.getCharacter(r.target_id || r.targetId) : r).filter(Boolean).slice(0, 5);

        // Initialize City DLC if not already attached to this request's db instance
        if (!db.city) {
            try {
                const initCityDb = require("../../city/cityDb.js");
                db.city = initCityDb(typeof db.getRawDb === 'function' ? db.getRawDb() : db);
            } catch (e) { }
        }

        const { buildUniversalContext } = require("../../conversation-context/index.js");
        const { getDefaultGuidelines } = require("../runtime.js");
        const universalResult = await buildUniversalContext(engineContextWrapper, character, '', false, activeTargets);
        const breakdown = { ...(universalResult.breakdown || {}) };

        const privateContextSummaries = typeof db.getPrivateContextSummaries === 'function'
            ? db.getPrivateContextSummaries(charId, 3)
            : [];

        // Calculate X (Recent Chat History - based on context_msg_limit)
        const contextLimit = character.context_msg_limit ?? 60;
        const allVisibleMsgs = db.getVisibleMessages(charId, 0);
        const recentMsgs = contextLimit > 0 ? allVisibleMsgs.slice(-contextLimit) : [];
        const liveHistoryWindowSize = recentMsgs.length;
        const summaryLastEndId = Math.max(
            Number(privateContextSummaries[privateContextSummaries.length - 1]?.end_message_id || 0),
            Number(character.private_summary_baseline_message_id || 0)
        );
        const overflowForSummary = contextLimit > 0
            ? allVisibleMsgs.slice(0, Math.max(0, allVisibleMsgs.length - contextLimit))
            : allVisibleMsgs;
        const pendingSummaryMsgs = overflowForSummary.filter(m => Number(m.id || 0) > summaryLastEndId);
        const liveMsgs = contextLimit > 0 ? [...pendingSummaryMsgs, ...recentMsgs] : [];
        const x_chat_text = liveMsgs.map(m => dependencies.formatContextStatsHistoryMessage(db, character, m)).join('\n');
        breakdown.x_chat = dependencies.getTokenCount(x_chat_text);

        const systemPromptPreamble = `You are playing the role of ${character.name}.\nPersona:\n${character.persona || 'No specific persona given.'}\n\nWorld Info:\n${character.world_info || 'No specific world info.'}\n\nContext:\n${universalResult.preamble}`;
        let finalSystemPrompt = systemPromptPreamble;

        try {
            const unclaimed = typeof db.getUnclaimedTransfersFrom === 'function'
                ? db.getUnclaimedTransfersFrom(character.id, character.id)
                : [];
            if (unclaimed && unclaimed.length > 0) {
                const recent = unclaimed.filter(t => (Date.now() - t.created_at) < (24 * 60 * 60 * 1000));
                if (recent.length > 0) {
                    const total = recent.reduce((s, t) => s + t.amount, 0).toFixed(2);
                    const minutesAgo = Math.round((Date.now() - recent[0].created_at) / 60000);
                    const unclaimedNote = recent[0].note ? `（留言：“${recent[0].note}”）` : '';
                    finalSystemPrompt += `\n[系统提示] 你在 ${minutesAgo} 分钟前给 ${db.getUserProfile()?.name || '用户'} 转了一笔账，共 ¥${total}${unclaimedNote}，但对方还没有领取。你可以按自己的性格顺手提一句，也可以不提。\n`;
                }
            }
        } catch (e) { /* ignore */ }

        finalSystemPrompt += `\n${getDefaultGuidelines()}`;
        const supplementalCharacterPrompt = String(character.system_prompt || '').trim();
        if (supplementalCharacterPrompt) {
            finalSystemPrompt += `\n\n[Character-Specific Supplemental Rules]\n${supplementalCharacterPrompt}`;
        }
        let digestBlock = '';
        if (privateContextSummaries.length > 0) {
            digestBlock = [
                '[Private Context Summaries]',
                ...privateContextSummaries.map((item, index) => `\n[Summary ${index + 1} / messages ${item.start_message_id}-${item.end_message_id} / ${item.message_count}条]\n${item.summary_text || ''}`)
            ].join('\n');
            finalSystemPrompt += `\n\n${digestBlock}`;
        }

        const ownRecentMsgs = recentMsgs
            .filter(m => m.role === 'character')
            .slice(-6)
            .map(m => `"${String(m.content || '').substring(0, 200)}"`)
            .join(', ');
        let antiRepeat = '';
        if (ownRecentMsgs) {
            antiRepeat = `\n\n[Anti-Repeat]: Your recent messages were: ${ownRecentMsgs}. Do NOT repeat, reuse, or closely paraphrase any of these. Your next message must be distinctly different in both TOPIC and WORDING.`;
            if ((character.pressure_level || 0) >= 2) {
                antiRepeat += ` Since you are feeling anxious, try a COMPLETELY NEW approach: talk about what you're doing right now, share a random thought, ask a question about something unrelated, express your feelings from a different angle, or bring up a memory. DO NOT just rephrase "why aren't you replying" again.`;
            }
            finalSystemPrompt += antiRepeat;
        }

        const transformedHistory = liveMsgs.map(m => ({
            role: m.role === 'character' ? 'assistant' : 'user',
            content: dependencies.formatContextStatsHistoryMessage(db, character, m)
        }));
        const estimatedWithCacheMessagesRaw = [
            { role: 'system', content: finalSystemPrompt },
            ...transformedHistory
        ];
        const estimatedWithoutCacheMessagesRaw = [
            { role: 'system', content: finalSystemPrompt },
            ...transformedHistory
        ];
        const useClaudePromptCacheShape = String(character.model_name || '').toLowerCase().includes('claude');
        const estimatedWithCacheMessages = useClaudePromptCacheShape
            ? dependencies.buildClaudePromptCacheEstimateMessages(estimatedWithCacheMessagesRaw)
            : estimatedWithCacheMessagesRaw;
        const estimatedWithoutCacheMessages = estimatedWithoutCacheMessagesRaw;
        const estimatedWithCacheMessageStats = dependencies.estimateJsonWrapperTokensForMessages(estimatedWithCacheMessages);
        const estimatedWithoutCacheMessageStats = dependencies.estimateJsonWrapperTokensForMessages(estimatedWithoutCacheMessages);
        const estimatedHistoryTokens = transformedHistory.reduce((sum, msg) => sum + dependencies.getTokenCount(msg.content) + 6, 0);
        const estimatedFullHistoryTokens = estimatedHistoryTokens;
        const estimatedSystemPromptTokens = dependencies.getTokenCount(finalSystemPrompt);
        const estimatedSystemPromptWithoutDigestTokens = estimatedSystemPromptTokens;
        const estimatedMessageEnvelopeTokens = 8 + transformedHistory.length * 2;
        const estimatedFullMessageEnvelopeTokens = estimatedMessageEnvelopeTokens;
        const estimatedWithCacheRequestBody = {
            model: character.model_name,
            messages: estimatedWithCacheMessages,
            max_tokens: Number(character.max_tokens || 2000),
            presence_penalty: Number(character.presence_penalty || 0),
            frequency_penalty: Number(character.frequency_penalty || 0),
        };
        const estimatedWithoutCacheRequestBody = {
            model: character.model_name,
            messages: estimatedWithoutCacheMessages,
            max_tokens: Number(character.max_tokens || 2000),
            presence_penalty: Number(character.presence_penalty || 0),
            frequency_penalty: Number(character.frequency_penalty || 0),
        };
        const estimatedWithoutCacheTokens = dependencies.estimateRequestBodyTokens(estimatedWithoutCacheRequestBody);
        const estimatedWithCacheTokens = dependencies.estimateRequestBodyTokens(estimatedWithCacheRequestBody);
        const finalPromptEstimate = estimatedWithCacheTokens;

        const estimatedDigestTokens = dependencies.getTokenCount(digestBlock || '');
        const estimatedTailTokens = dependencies.getTokenCount(x_chat_text);
        const estimatedWithoutCacheXTokens = estimatedFullHistoryTokens;
        const estimatedWithCacheXTokens = estimatedHistoryTokens;
        const estimatedComparableBaseTokens = Math.max(
            0,
            estimatedSystemPromptWithoutDigestTokens
            - Number(breakdown.city_x_y || 0)
            - Number(breakdown.z_memory || 0)
            - Number(breakdown.q_impression || 0)
        );
        const estimatedWithoutCacheOtherTokens = Math.max(
            0,
            estimatedWithoutCacheTokens
            - estimatedComparableBaseTokens
            - estimatedWithoutCacheXTokens
            - Number(breakdown.city_x_y || 0)
            - Number(breakdown.z_memory || 0)
            - Number(breakdown.q_impression || 0)
        );
        const estimatedWithCacheOtherTokens = Math.max(
            0,
            estimatedWithCacheTokens
            - estimatedComparableBaseTokens
            - estimatedDigestTokens
            - estimatedWithCacheXTokens
            - Number(breakdown.city_x_y || 0)
            - Number(breakdown.z_memory || 0)
            - Number(breakdown.q_impression || 0)
        );
        const estimatedWithoutCacheBaseTokens = Math.max(
            0,
            estimatedComparableBaseTokens
        );
        const estimatedWithCacheBaseTokens = Math.max(
            0,
            estimatedComparableBaseTokens
        );
        const estimatedRagInjectedTokens = Math.max(
            0,
            Number(breakdown.city_x_y || 0)
            + Number(breakdown.z_memory || 0)
            + Number(breakdown.q_impression || 0)
        );
        breakdown.system_full = estimatedSystemPromptTokens;
        breakdown.history_full = estimatedHistoryTokens;
        breakdown.message_envelope = estimatedMessageEnvelopeTokens;

        let unsummarizedCount = 0;
        let privateUnsummarizedCount = 0;
        let groupUnsummarizedCount = 0;
        let cityUnsummarizedCount = 0;
        if (!character.sweep_initialized && typeof db.initializeSweepBaseline === 'function' && typeof db.getGroups === 'function') {
            const groups = db.getGroups().filter(g => g.members.some(m => m.member_id === character.id));
            const groupWindows = groups.map(g => ({ groupId: g.id, windowLimit: g.inject_limit ?? 5 }));
            db.initializeSweepBaseline(charId, contextLimit, groupWindows);
        } else if (character.sweep_initialized) {
            const privateWindow = character.context_msg_limit ?? 60;
            privateUnsummarizedCount = typeof db.countOverflowMessages === 'function'
                ? db.countOverflowMessages(charId, privateWindow)
                : 0;

            if (typeof db.countOverflowGroupMessages === 'function' && typeof db.getGroups === 'function') {
                const groups = db.getGroups().filter(g => g.members.some(m => m.member_id === character.id));
                for (const g of groups) {
                    const groupWindow = g.inject_limit ?? 5;
                    groupUnsummarizedCount += db.countOverflowGroupMessages(g.id, groupWindow);
                }
            }
            if (db.city && typeof db.city.countOverflowCityLogs === 'function') {
                cityUnsummarizedCount = db.city.countOverflowCityLogs(charId, 0);
            }
            unsummarizedCount = privateUnsummarizedCount + groupUnsummarizedCount + cityUnsummarizedCount;
        }

        // Calculate total tokens
        let total = 0;
        if (breakdown) {
            total = Object.values(breakdown).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        }

        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        const actualUsage = typeof db.getTokenUsageSummary === 'function'
            ? db.getTokenUsageSummary(charId)
            : { request_count: 0, prompt_tokens: 0, completion_tokens: 0, by_context: [] };
        const mainUsageRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS request_count,
                    COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                    COALESCE(SUM(completion_tokens), 0) AS completion_tokens
                FROM token_usage
                WHERE character_id = ?
                  AND context_type NOT LIKE 'memory_%'
                  AND context_type NOT IN ('chat_intent', 'conversation_digest_update', 'private_context_summary_update')
            `).get(charId)
            : null;
        const auxiliaryUsageRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS request_count,
                    COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
                    COALESCE(SUM(completion_tokens), 0) AS completion_tokens
                FROM token_usage
                WHERE character_id = ?
                  AND (
                    context_type LIKE 'memory_%'
                    OR context_type IN ('chat_intent', 'conversation_digest_update', 'private_context_summary_update')
                  )
            `).get(charId)
            : null;
        const latestUsageRow = rawDb
            ? rawDb.prepare('SELECT context_type, prompt_tokens, completion_tokens, timestamp FROM token_usage WHERE character_id = ? ORDER BY id DESC LIMIT 1').get(charId)
            : null;
        const latestConversationUsageRow = rawDb
            ? rawDb.prepare(`
                SELECT context_type, prompt_tokens, completion_tokens, timestamp
                FROM token_usage
                WHERE character_id = ?
                  AND context_type = 'chat'
                ORDER BY id DESC
                LIMIT 1
            `).get(charId)
            : null;
        const cacheUsageRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    COALESCE(SUM(prompt_tokens * hit_count), 0) AS saved_prompt_tokens,
                    COALESCE(SUM(completion_tokens * hit_count), 0) AS saved_completion_tokens,
                    MAX(last_hit_at) AS last_cache_hit_at
                FROM llm_cache
                WHERE character_id = ?
                  AND expires_at > ?
            `).get(charId, Date.now())
            : null;
        const promptBlockUsageRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(updated_at) AS last_write_at
                FROM prompt_block_cache
                WHERE character_id = ?
            `).get(charId)
            : null;
        const historyWindowUsageRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(updated_at) AS last_write_at
                FROM history_window_cache
                WHERE character_id = ?
            `).get(charId)
            : null;
        const conversationDigestRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    MAX(updated_at) AS last_write_at,
                    MAX(end_message_id) AS last_message_id
                FROM private_context_summaries
                WHERE character_id = ?
            `).get(charId)
            : null;
        const privateSummaryPendingCount = pendingSummaryMsgs.length;
        const latestConversationSnapshotRow = rawDb
            ? rawDb.prepare(`
                SELECT meta, timestamp
                FROM llm_debug_logs
                WHERE character_id = ?
                  AND direction = 'input'
                  AND context_type = 'private_reply'
                ORDER BY id DESC
                LIMIT 1
            `).get(charId)
            : null;
        const latestConversationAttemptRow = rawDb
            ? rawDb.prepare(`
                SELECT meta, timestamp
                FROM llm_debug_logs
                WHERE character_id = ?
                  AND direction = 'attempt_result'
                  AND context_type = 'private_reply'
                ORDER BY id DESC
                LIMIT 1
            `).get(charId)
            : null;
        let latestConversationSnapshot = null;
        try {
            latestConversationSnapshot = latestConversationSnapshotRow?.meta
                ? JSON.parse(latestConversationSnapshotRow.meta)?.context_snapshot || null
                : null;
        } catch (_) {
            latestConversationSnapshot = null;
        }
        let latestConversationAttemptMeta = null;
        try {
            latestConversationAttemptMeta = latestConversationAttemptRow?.meta
                ? JSON.parse(latestConversationAttemptRow.meta)
                : null;
        } catch (_) {
            latestConversationAttemptMeta = null;
        }

        const lastConversationPromptTokens = Number(latestConversationUsageRow?.prompt_tokens || 0);
        const latestConversationUsage = latestConversationAttemptMeta?.usage || {};
        const latestConversationPromptDetails = latestConversationUsage?.prompt_tokens_details || latestConversationUsage?.input_tokens_details || {};
        const lastConversationCachedReadTokens = Math.max(0, Number(
            latestConversationPromptDetails.cached_tokens
            || latestConversationPromptDetails.cache_read_input_tokens
            || latestConversationPromptDetails.cached_input_tokens
            || latestConversationUsage.cache_read_input_tokens
            || latestConversationUsage.cached_input_tokens
            || latestConversationUsage.input_cached_tokens
            || 0
        ) || 0);
        const lastConversationCacheCreationTokens = Math.max(0, Number(
            latestConversationPromptDetails.cached_creation_tokens
            || latestConversationPromptDetails.cache_creation_input_tokens
            || latestConversationUsage.cache_creation_input_tokens
            || latestConversationUsage.input_cache_creation_tokens
            || (
                Number(latestConversationUsage.claude_cache_creation_5_m_tokens || 0)
                + Number(latestConversationUsage.claude_cache_creation_1_h_tokens || 0)
            )
            || 0
        ) || 0);
        const lastConversationUncachedPromptTokens = Math.max(
            0,
            lastConversationPromptTokens - lastConversationCachedReadTokens - lastConversationCacheCreationTokens
        );
        const lastConversationProviderCacheHitRate = lastConversationPromptTokens > 0
            ? Math.round((lastConversationCachedReadTokens / lastConversationPromptTokens) * 100)
            : 0;
        let loggedCachedRequestBodyTokens = Number(latestConversationAttemptMeta?.requestBodyTokens || 0);
        let loggedUncachedRequestBodyTokens = Number(latestConversationAttemptMeta?.uncachedRequestBodyTokens || 0);
        try {
            if (!loggedCachedRequestBodyTokens && latestConversationAttemptMeta?.requestBodyPreview) {
                loggedCachedRequestBodyTokens = dependencies.getTokenCount(latestConversationAttemptMeta.requestBodyPreview);
                const parsedCachedRequestBody = JSON.parse(latestConversationAttemptMeta.requestBodyPreview);
                loggedCachedRequestBodyTokens = dependencies.getTokenCount(JSON.stringify(parsedCachedRequestBody));
            }
            if (!loggedUncachedRequestBodyTokens && latestConversationAttemptMeta?.uncachedRequestBodyPreview) {
                const parsedUncachedRequestBody = JSON.parse(latestConversationAttemptMeta.uncachedRequestBodyPreview);
                loggedUncachedRequestBodyTokens = dependencies.getTokenCount(JSON.stringify(parsedUncachedRequestBody));
            }
        } catch (e) {
            console.warn('[API] Failed to derive logged cached/uncached request body tokens:', e.message);
        }
        const validLoggedUncachedRequestBodyTokens = loggedUncachedRequestBodyTokens > loggedCachedRequestBodyTokens
            ? loggedUncachedRequestBodyTokens
            : 0;
        const snapshotLooksLikeLegacyFullHistory = Number(latestConversationSnapshot?.estimated_full_history_tokens || 0) > Math.max(
            estimatedHistoryTokens * 3,
            estimatedHistoryTokens + 5000
        );
        const snapshotWithoutCacheTokens = Number(
            snapshotLooksLikeLegacyFullHistory
                ? estimatedWithoutCacheTokens
                : (
                    validLoggedUncachedRequestBodyTokens
                    || latestConversationSnapshot?.estimated_without_cache_tokens
                    || estimatedWithoutCacheTokens
                )
            || 0
        );
        const snapshotWithCacheTokens = Number(
            loggedCachedRequestBodyTokens
            || latestConversationSnapshot?.estimated_with_cache_tokens
            || estimatedWithCacheTokens
            || 0
        );
        const snapshotRagInjectedTokens = Math.max(
            0,
            Number(
                latestConversationSnapshot?.estimated_rag_injected_tokens
                || latestConversationSnapshot?.breakdown?.z_memory
                || estimatedRagInjectedTokens
                || 0
            )
        );
        let lastConversationRequestBodyTokens = 0;
        let lastConversationMessagesJsonTokens = 0;
        let lastConversationPlainMessageTokens = 0;
        let lastConversationJsonWrapperTokens = 0;
        let lastConversationOtherTokens = 0;
        try {
            if (latestConversationAttemptMeta?.requestBodyPreview) {
                const requestBody = JSON.parse(latestConversationAttemptMeta.requestBodyPreview);
                const requestMessages = Array.isArray(requestBody?.messages) ? requestBody.messages : [];
                lastConversationRequestBodyTokens = dependencies.getTokenCount(JSON.stringify(requestBody));
                lastConversationMessagesJsonTokens = dependencies.getTokenCount(JSON.stringify(requestMessages));
                lastConversationPlainMessageTokens = requestMessages.reduce((sum, message) => {
                    return sum + dependencies.getTokenCount(dependencies.extractMessagePlainText(message?.content || ''));
                }, 0);
                lastConversationJsonWrapperTokens = Math.max(
                    0,
                    lastConversationMessagesJsonTokens - lastConversationPlainMessageTokens
                );
                lastConversationOtherTokens = Math.max(
                    0,
                    lastConversationRequestBodyTokens - (
                        dependencies.getTokenCount(dependencies.extractMessagePlainText(requestMessages?.[0]?.content || ''))
                        + requestMessages.slice(1).reduce((sum, message) => {
                            return sum + dependencies.getTokenCount(dependencies.extractMessagePlainText(message?.content || ''));
                        }, 0)
                    )
                );
            }
        } catch (e) {
            console.warn('[API] Failed to derive JSON wrapper token stats:', e.message);
        }
        const cacheOnlyWithoutRagBaselineTokens = Math.max(0, snapshotWithoutCacheTokens - snapshotRagInjectedTokens);
        const cacheOnlyActualInputTokens = Math.max(0, lastConversationPromptTokens - snapshotRagInjectedTokens);
        const cacheOnlySavedTokens = Math.max(0, cacheOnlyWithoutRagBaselineTokens - cacheOnlyActualInputTokens);
        const cacheOnlyHitRatePercent = cacheOnlyWithoutRagBaselineTokens > 0
            ? Math.round((cacheOnlySavedTokens / cacheOnlyWithoutRagBaselineTokens) * 100)
            : 0;
        const totalSavedIncludingRagTokens = Math.max(0, snapshotWithoutCacheTokens - lastConversationPromptTokens);
        const totalSavedIncludingRagRatePercent = snapshotWithoutCacheTokens > 0
            ? Math.round((totalSavedIncludingRagTokens / snapshotWithoutCacheTokens) * 100)
            : 0;
        const lastConversationModuleRoutes = latestConversationSnapshot?.module_routes || {};
        const lastConversationRoutedToCity = !!(
            lastConversationModuleRoutes.city_detail
            || lastConversationModuleRoutes.city
            || lastConversationModuleRoutes.city_x_y
            || lastConversationModuleRoutes.city_social
        );
        const lastConversationUsedRag = snapshotRagInjectedTokens > 0;
        const lastConversationTopicSwitch = latestConversationSnapshot?.topic_switch || null;

        res.json({
            success: true,
            stats: {
                ...breakdown,
                total: finalPromptEstimate || total,
                total_breakdown_only: total,
                w_unsummarized_count: unsummarizedCount,
                w_private_unsummarized_count: privateUnsummarizedCount,
                w_group_unsummarized_count: groupUnsummarizedCount,
                w_city_unsummarized_count: cityUnsummarizedCount,
                w_sweep_limit: character.sweep_limit || 30,
                w_last_error: character.sweep_last_error || '',
                w_last_run_at: character.sweep_last_run_at || 0,
                w_last_success_at: character.sweep_last_success_at || 0,
                w_last_saved_count: character.sweep_last_saved_count || 0,
                estimated_system_prompt_tokens: estimatedSystemPromptTokens,
                estimated_history_tokens: estimatedHistoryTokens,
                estimated_message_envelope_tokens: estimatedMessageEnvelopeTokens,
                estimated_digest_tokens: estimatedDigestTokens,
                estimated_without_cache_tokens: estimatedWithoutCacheTokens,
                estimated_with_cache_tokens: estimatedWithCacheTokens,
                estimated_tail_tokens: estimatedTailTokens,
                estimated_without_cache_x_tokens: estimatedWithoutCacheXTokens,
                estimated_with_cache_x_tokens: estimatedWithCacheXTokens,
                estimated_full_history_tokens: estimatedFullHistoryTokens,
                estimated_full_message_envelope_tokens: estimatedFullMessageEnvelopeTokens,
                estimated_without_cache_base_tokens: estimatedWithoutCacheBaseTokens,
                estimated_with_cache_base_tokens: estimatedWithCacheBaseTokens,
                estimated_without_cache_other_tokens: estimatedWithoutCacheOtherTokens,
                estimated_with_cache_other_tokens: estimatedWithCacheOtherTokens,
                estimated_rag_injected_tokens: snapshotRagInjectedTokens,
                actual_prompt_tokens_total: mainUsageRow?.prompt_tokens || 0,
                actual_completion_tokens_total: mainUsageRow?.completion_tokens || 0,
                actual_request_count: mainUsageRow?.request_count || 0,
                actual_total_tokens: (mainUsageRow?.prompt_tokens || 0) + (mainUsageRow?.completion_tokens || 0),
                auxiliary_prompt_tokens_total: auxiliaryUsageRow?.prompt_tokens || 0,
                auxiliary_completion_tokens_total: auxiliaryUsageRow?.completion_tokens || 0,
                auxiliary_request_count: auxiliaryUsageRow?.request_count || 0,
                auxiliary_total_tokens: (auxiliaryUsageRow?.prompt_tokens || 0) + (auxiliaryUsageRow?.completion_tokens || 0),
                raw_all_prompt_tokens_total: actualUsage?.prompt_tokens || 0,
                raw_all_completion_tokens_total: actualUsage?.completion_tokens || 0,
                raw_all_request_count: actualUsage?.request_count || 0,
                raw_all_total_tokens: (actualUsage?.prompt_tokens || 0) + (actualUsage?.completion_tokens || 0),
                actual_by_context: actualUsage?.by_context || [],
                cache_entries_count: cacheUsageRow?.entries_count || 0,
                cache_hit_count: cacheUsageRow?.hit_count || 0,
                cache_saved_prompt_tokens: cacheUsageRow?.saved_prompt_tokens || 0,
                cache_saved_completion_tokens: cacheUsageRow?.saved_completion_tokens || 0,
                cache_saved_total_tokens: (cacheUsageRow?.saved_prompt_tokens || 0) + (cacheUsageRow?.saved_completion_tokens || 0),
                cache_last_hit_at: cacheUsageRow?.last_cache_hit_at || 0,
                block_cache_entries_count: promptBlockUsageRow?.entries_count || 0,
                block_cache_hit_count: promptBlockUsageRow?.hit_count || 0,
                block_cache_last_hit_at: promptBlockUsageRow?.last_hit_at || 0,
                block_cache_last_write_at: promptBlockUsageRow?.last_write_at || 0,
                history_cache_entries_count: historyWindowUsageRow?.entries_count || 0,
                history_cache_hit_count: historyWindowUsageRow?.hit_count || 0,
                history_cache_last_hit_at: historyWindowUsageRow?.last_hit_at || 0,
                history_cache_last_write_at: historyWindowUsageRow?.last_write_at || 0,
                digest_cache_entries_count: conversationDigestRow?.entries_count || 0,
                digest_cache_hit_count: 0,
                digest_cache_last_hit_at: 0,
                digest_cache_last_write_at: conversationDigestRow?.last_write_at || 0,
                digest_cache_last_message_id: conversationDigestRow?.last_message_id || 0,
                digest_active: privateContextSummaries.length > 0,
                digest_live_history_window_size: liveHistoryWindowSize,
                private_summary_threshold: character.private_summary_threshold || 30,
                private_summary_pending_count: privateSummaryPendingCount,
                private_summary_active_count: privateContextSummaries.length,
                private_summary_last_error: character.private_summary_last_error || '',
                private_summary_last_run_at: character.private_summary_last_run_at || 0,
                private_summary_last_success_at: character.private_summary_last_success_at || 0,
                private_summary_baseline_message_id: character.private_summary_baseline_message_id || 0,
                last_actual_prompt_tokens: latestUsageRow?.prompt_tokens || 0,
                last_actual_completion_tokens: latestUsageRow?.completion_tokens || 0,
                last_actual_context_type: latestUsageRow?.context_type || '',
                last_actual_timestamp: latestUsageRow?.timestamp || 0,
                last_conversation_prompt_tokens: lastConversationPromptTokens,
                last_conversation_completion_tokens: latestConversationUsageRow?.completion_tokens || 0,
                last_conversation_context_type: latestConversationUsageRow?.context_type || '',
                last_conversation_timestamp: latestConversationUsageRow?.timestamp || 0,
                last_conversation_uncached_prompt_tokens: lastConversationUncachedPromptTokens,
                last_conversation_cached_read_tokens: lastConversationCachedReadTokens,
                last_conversation_cache_creation_tokens: lastConversationCacheCreationTokens,
                last_conversation_provider_cache_hit_rate_percent: lastConversationProviderCacheHitRate,
                last_conversation_snapshot_timestamp: Number(latestConversationSnapshot?.timestamp || latestConversationSnapshotRow?.timestamp || 0),
                last_conversation_estimated_without_cache_tokens: snapshotWithoutCacheTokens,
                last_conversation_estimated_with_cache_tokens: snapshotWithCacheTokens,
                last_conversation_request_body_tokens: lastConversationRequestBodyTokens,
                last_conversation_messages_json_tokens: lastConversationMessagesJsonTokens,
                last_conversation_plain_message_tokens: lastConversationPlainMessageTokens,
                last_conversation_json_wrapper_tokens: lastConversationJsonWrapperTokens,
                last_conversation_other_tokens: lastConversationOtherTokens,
                last_conversation_routed_to_city: lastConversationRoutedToCity,
                last_conversation_used_rag: lastConversationUsedRag,
                last_conversation_topic_switch_decision: String(lastConversationTopicSwitch?.decision || '').trim(),
                last_conversation_topic_switch_reason: String(lastConversationTopicSwitch?.reason || '').trim(),
                last_conversation_topic_switch_fallback: !!lastConversationTopicSwitch?.fallback,
                cache_only_without_rag_baseline_tokens: cacheOnlyWithoutRagBaselineTokens,
                cache_only_actual_input_tokens: cacheOnlyActualInputTokens,
                cache_only_saved_tokens: cacheOnlySavedTokens,
                cache_only_hit_rate_percent: cacheOnlyHitRatePercent,
                total_saved_including_rag_tokens: totalSavedIncludingRagTokens,
                total_saved_including_rag_rate_percent: totalSavedIncludingRagRatePercent
            }
        });
    } catch (e) {
        console.error('[API] Context Stats error:', e.message);
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
