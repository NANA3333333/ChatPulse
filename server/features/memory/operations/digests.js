// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function updateConversationDigest(character, options = {}) {
        const memoryConfig = dependencies.resolveMemoryModelConfig(character);
        if (!memoryConfig.endpoint || !memoryConfig.key || !memoryConfig.model) {
            throw new Error('私聊上下文总结失败：未配置记忆/总结小模型。');
        }

        const db = dependencies.getDb();
        const rawWindow = Math.max(0, Number(options.rawWindow ?? character.context_msg_limit ?? 60) || 0);
        const threshold = Math.max(1, Number(character.private_summary_threshold || 30) || 30);
        const visibleMessages = Array.isArray(options.visibleMessages)
            ? options.visibleMessages
            : db.getVisibleMessages(character.id, 0);
        if (!Array.isArray(visibleMessages) || visibleMessages.length === 0) {
            return [];
        }

        const overflowMessages = rawWindow > 0 ? visibleMessages.slice(0, Math.max(0, visibleMessages.length - rawWindow)) : visibleMessages;
        const latestSummary = typeof db.getLatestPrivateContextSummary === 'function'
            ? db.getLatestPrivateContextSummary(character.id)
            : null;
        let baselineMessageId = Number(character.private_summary_baseline_message_id || 0);
        // A negative baseline marks a chat that was already checked before it had
        // a summary. On a first encounter with a long existing chat, skip only the
        // old backlog and retain its newest threshold - 1 messages as pending raw.
        if (!latestSummary && baselineMessageId === 0) {
            baselineMessageId = overflowMessages.length > threshold
                ? Number(overflowMessages[overflowMessages.length - threshold]?.id || 0)
                : -1;
            db.updateCharacter?.(character.id, {
                private_summary_baseline_message_id: baselineMessageId,
                private_summary_last_error: ''
            });
        }
        const lastSummarizedId = Math.max(Number(latestSummary?.end_message_id || 0), baselineMessageId);
        let pendingMessages = overflowMessages.filter(m => Number(m.id || 0) > lastSummarizedId);
        if (pendingMessages.length < threshold) {
            return typeof db.getPrivateContextSummaries === 'function'
                ? db.getPrivateContextSummaries(character.id, 3)
                : [];
        }

        const speakerName = (message) => {
            if (message.role === 'user') return 'User';
            if (message.role === 'character') return character.name;
            return 'System/Event';
        };
        const summarizeBatch = async (batch) => {
            const dialogueText = batch.map(m => `${speakerName(m)}: ${String(m.content || '').trim()}`).join('\n');
            const subjectRules = dependencies.buildMemorySubjectRules(character, 'private_chat');
            const summaryPrompt = `请总结下面这一段私聊窗口外的原文对话。

要求：
- 只总结发生了什么，不写建议，不评价系统，不解释你在做总结。
- 详细、准确、精简，不要灌水。
- 必须保留关键事实、请求、承诺、误会、纠正、争执、情绪转折、关系状态、未解决问题。
- 必须分清 User 说了什么、${character.name} 说了什么；不要把 ${character.name} 的话写成 User 的话。
- 如果有 System/Event，写成事件背景，不要当成 User 发言。
- 用中文自然段或要点输出纯文本，不要 JSON，不要 Markdown 表格。

${subjectRules}

[待总结私聊原文]
${dialogueText}`;

            const maxSummaryAttempts = 2;
            for (let attempt = 1; attempt <= maxSummaryAttempts; attempt += 1) {
                const { content, usage, finishReason } = await dependencies.callLLM({
                    endpoint: memoryConfig.endpoint,
                    key: memoryConfig.key,
                    model: memoryConfig.model,
                    messages: [
                        { role: 'system', content: '你是私聊上下文总结器。你只输出对话事实总结，必须准确区分说话人。' },
                        { role: 'user', content: summaryPrompt }
                    ],
                    maxTokens: dependencies.MEMORY_SMALL_MODEL_MAX_TOKENS,
                    temperature: 0.1,
                    enableCache: true,
                    cacheDb: dependencies.getDb(),
                    cacheType: 'private_context_summary_update',
                    cacheTtlMs: 30 * 24 * 60 * 60 * 1000,
                    cacheScope: `character:${character.id}`,
                    cacheCharacterId: character.id,
                    validateCachedContent: (cachedText, cachedMeta) => (
                        dependencies.isCompletePrivateContextSummaryResponse(cachedText, cachedMeta)
                    ),
                    shouldCacheResult: (resultText, resultMeta) => (
                        dependencies.isCompletePrivateContextSummaryResponse(resultText, resultMeta)
                    ),
                    returnUsage: true
                });
                dependencies.recordMemoryTokenUsage(character.id, 'private_context_summary_update', usage);
                const summaryText = String(content || '').trim();
                const normalizedFinishReason = String(finishReason || '').trim().toLowerCase();
                const promptTokens = Number(usage?.prompt_tokens || 0);
                const completionTokens = Number(usage?.completion_tokens || 0);
                if (!summaryText) {
                    console.error(
                        `[Memory] Private context summary model returned empty output `
                        + `(character=${character.id}, model=${memoryConfig.model}, finish_reason=${normalizedFinishReason || 'unknown'}, `
                        + `prompt_tokens=${promptTokens}, completion_tokens=${completionTokens})`
                    );
                    throw new Error('私聊上下文总结失败：小模型返回了空内容。');
                }
                if (normalizedFinishReason === 'length') {
                    console.error(
                        `[Memory] Private context summary model output was truncated `
                        + `(character=${character.id}, model=${memoryConfig.model}, attempt=${attempt}/${maxSummaryAttempts}, `
                        + `finish_reason=length, prompt_tokens=${promptTokens}, completion_tokens=${completionTokens}, `
                        + `max_tokens=${dependencies.MEMORY_SMALL_MODEL_MAX_TOKENS})`
                    );
                    if (attempt < maxSummaryAttempts) {
                        console.warn(`[Memory] Retrying truncated private context summary for ${character.id}.`);
                        continue;
                    }
                    throw new Error(
                        `私聊上下文总结失败：小模型连续 ${maxSummaryAttempts} 次输出达到 `
                        + `${dependencies.MEMORY_SMALL_MODEL_MAX_TOKENS} token 上限，内容被截断。`
                    );
                }
                return summaryText;
            }
            throw new Error('私聊上下文总结失败：小模型未返回可用内容。');
        };

        try {
            db.updateCharacter?.(character.id, {
                private_summary_last_run_at: Date.now(),
                private_summary_last_error: ''
            });
            while (pendingMessages.length >= threshold) {
                const batch = pendingMessages.slice(0, threshold);
                const summaryText = await summarizeBatch(batch);
                const startMessageId = Number(batch[0]?.id || 0);
                const endMessageId = Number(batch[batch.length - 1]?.id || 0);
                const sourceHash = dependencies.crypto.createHash('sha256').update(JSON.stringify({
                    characterId: character.id,
                    threshold,
                    batch: batch.map(m => [m.id, m.role, m.content])
                })).digest('hex');
                db.addPrivateContextSummary?.({
                    character_id: character.id,
                    start_message_id: startMessageId,
                    end_message_id: endMessageId,
                    message_count: batch.length,
                    summary_text: summaryText,
                    source_hash: sourceHash
                });
                pendingMessages = pendingMessages.slice(batch.length);
            }
            db.updateCharacter?.(character.id, {
                private_summary_last_success_at: Date.now(),
                private_summary_last_error: ''
            });
            return typeof db.getPrivateContextSummaries === 'function'
                ? db.getPrivateContextSummaries(character.id, 3)
                : [];
        } catch (e) {
            const errorText = String(e?.message || e || 'unknown_error').slice(0, 500);
            console.error(`[Memory] Private context summary update failed for ${character.id}:`, errorText);
            db.updateCharacter?.(character.id, {
                private_summary_last_run_at: Date.now(),
                private_summary_last_error: errorText
            });
            throw new Error(`私聊上下文总结失败，请检查记忆小模型后重试：${errorText}`);
        }
    }

async function updateGroupConversationDigest(character, groupId, options = {}) {
        const memoryConfig = dependencies.resolveMemoryModelConfig(character);
        if (!memoryConfig.endpoint || !memoryConfig.key || !memoryConfig.model || !groupId) {
            return null;
        }

        const db = dependencies.getDb();
        const group = typeof db.getGroup === 'function' ? db.getGroup(groupId) : null;
        if (!group) return null;
        const joinedMember = Array.isArray(group.members)
            ? group.members.find(m => m.member_id === character.id)
            : null;
        const joinedAt = Number(joinedMember?.joined_at || 0);
        const existingDigest = typeof db.getGroupConversationDigest === 'function'
            ? db.getGroupConversationDigest(groupId, character.id, { trackHit: false })
            : null;
        const tailWindow = Math.max(8, Math.min(Number(options.tailWindow || 16), group.context_msg_limit || 60));
        const visibleMessages = db.getVisibleGroupMessages(groupId, tailWindow, joinedAt);
        if (!Array.isArray(visibleMessages) || visibleMessages.length === 0) {
            return existingDigest;
        }

        const latestMessageId = Number(visibleMessages[visibleMessages.length - 1]?.id || 0);
        if (existingDigest && latestMessageId > 0 && Number(existingDigest.last_message_id || 0) === latestMessageId) {
            return existingDigest;
        }

        let deltaMessages = visibleMessages;
        if (existingDigest && Number(existingDigest.last_message_id || 0) > 0) {
            const filtered = visibleMessages.filter(m => Number(m.id || 0) > Number(existingDigest.last_message_id || 0));
            deltaMessages = filtered.length > 0
                ? filtered
                : visibleMessages.slice(-Math.min(8, visibleMessages.length));
        } else {
            deltaMessages = visibleMessages.slice(-Math.min(8, visibleMessages.length));
        }

        const deltaText = deltaMessages.map((m) => {
            const senderName = m.sender_id === 'user'
                ? (db.getUserProfile?.()?.name || 'User')
                : (db.getCharacter?.(m.sender_id)?.name || m.sender_name || m.sender_id || 'Unknown');
            return `${senderName}: ${m.content}`;
        }).join('\n');
        const previousDigestText = existingDigest ? JSON.stringify({
            digest_text: existingDigest.digest_text || '',
            emotion_state: existingDigest.emotion_state || '',
            relationship_state: existingDigest.relationship_state_json || [],
            open_loops: existingDigest.open_loops_json || [],
            recent_facts: existingDigest.recent_facts_json || [],
            scene_state: existingDigest.scene_state_json || []
        }, null, 2) : '{"digest_text":"","emotion_state":"","relationship_state":[],"open_loops":[],"recent_facts":[],"scene_state":[]}';
        const subjectRules = dependencies.buildMemorySubjectRules(character, 'group_chat');

        const digestPrompt = `You maintain a compact rolling state for ${character.name}'s view of an ongoing group chat named ${group.name}.
Update the previous digest using ONLY the new dialogue delta below.

Goals:
- Preserve who is pressuring, teasing, comforting, tagging, or provoking whom.
- Keep only unresolved topics, direct questions, social tension, and scene facts that still matter.
- Compress aggressively. Prefer fragments over sentences.
- The whole JSON values combined should usually stay under 65 words.

${subjectRules}

Return exactly one JSON object and nothing else:
{
  "digest_text": "one compact line under 70 words",
  "emotion_state": "one short line under 8 words",
  "relationship_state": ["up to 3 short bullets"],
  "open_loops": ["up to 3 unresolved topics / direct questions / social needs"],
  "recent_facts": ["up to 3 concrete facts still relevant right now"],
  "scene_state": ["up to 2 short group-scene notes that still matter"]
}

[Previous Digest]
${previousDigestText}

[New Group Dialogue Delta]
${deltaText}`;

        try {
            const { content: responseText, usage } = await dependencies.callLLM({
                endpoint: memoryConfig.endpoint,
                key: memoryConfig.key,
                model: memoryConfig.model,
                messages: [
                    { role: 'system', content: 'You are a compact group-conversation state updater. Output strict JSON only.' },
                    { role: 'user', content: digestPrompt }
                ],
                maxTokens: dependencies.MEMORY_SMALL_MODEL_MAX_TOKENS,
                temperature: 0.2,
                enableCache: true,
                cacheDb: dependencies.getDb(),
                cacheType: 'group_conversation_digest_update',
                cacheTtlMs: 30 * 24 * 60 * 60 * 1000,
                cacheScope: `group:${groupId}:character:${character.id}`,
                cacheCharacterId: character.id,
                returnUsage: true
            });
            dependencies.recordMemoryTokenUsage(character.id, 'group_conversation_digest_update', usage);

            const cleaned = String(responseText || '')
                .replace(/```(?:json)?\s*/gi, '')
                .replace(/```/g, '')
                .trim();
            if (!cleaned) {
                throw new Error('群聊上下文总结模型没有返回 JSON。');
            }
            const parsed = JSON.parse(cleaned);
            const normalized = dependencies.normalizeCompactGroupDigestPayload(parsed);
            if (!normalized.digest_text) {
                throw new Error('群聊上下文总结缺少 digest_text。');
            }
            const sourceHash = dependencies.crypto.createHash('sha256')
                .update(JSON.stringify({
                    groupId,
                    previousDigest: existingDigest?.digest_text || '',
                    latestMessageId,
                    delta: deltaMessages.map(m => [m.id, m.sender_id, m.content])
                }))
                .digest('hex');
            db.upsertGroupConversationDigest?.({
                group_id: groupId,
                character_id: character.id,
                source_hash: sourceHash,
                digest_text: normalized.digest_text,
                emotion_state: normalized.emotion_state,
                relationship_state_json: normalized.relationship_state_json,
                open_loops_json: normalized.open_loops_json,
                recent_facts_json: normalized.recent_facts_json,
                scene_state_json: normalized.scene_state_json,
                last_message_id: latestMessageId
            });
            return db.getGroupConversationDigest?.(groupId, character.id, { trackHit: false }) || {
                group_id: groupId,
                character_id: character.id,
                ...normalized,
                last_message_id: latestMessageId
            };
        } catch (e) {
            console.error(`[Memory] Group conversation digest update failed for ${character.id}/${groupId}:`, e.message);
            const errorText = String(e?.message || e || 'unknown_error');
            throw new Error(`群聊上下文总结失败，请检查记忆小模型后重试：${errorText}`);
        }
    }

    return { updateConversationDigest, updateGroupConversationDigest };
}

module.exports = { createModule };
