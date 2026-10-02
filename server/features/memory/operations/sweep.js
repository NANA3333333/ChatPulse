// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeSweepPool(pool = 'auto') {
        const normalized = String(pool || 'auto').trim().toLowerCase();
        if (['private', 'private_chat', 'chat'].includes(normalized)) return 'private';
        if (['group', 'group_chat'].includes(normalized)) return 'group';
        if (['city', 'commercial_street', 'commercial', 'street'].includes(normalized)) return 'city';
        return 'auto';
    }

function getSweepPoolMeta(pool = 'private') {
        if (pool === 'group') {
            return {
                label: 'group chat',
                contextLabel: 'group chats',
                source_context: 'group_chat',
                scene_tag: 'group_chat',
                debugContext: 'memory_sweep_group'
            };
        }
        if (pool === 'city') {
            return {
                label: 'commercial street',
                contextLabel: 'city / commercial-street activity logs',
                source_context: 'commercial_street',
                scene_tag: 'commercial_street',
                debugContext: 'memory_sweep_city'
            };
        }
        return {
            label: 'private chat',
            contextLabel: 'private chats',
            source_context: 'private_chat',
            scene_tag: 'private_chat',
            debugContext: 'memory_sweep_private'
        };
    }

function getSweepPoolCounts(db, character, sweepLimit = 30) {
        const privateWindow = character.context_msg_limit ?? 60;
        const groups = typeof db.getGroups === 'function'
            ? db.getGroups().filter(g => g.members.some(m => m.member_id === character.id))
            : [];
        let groupCount = 0;
        if (typeof db.countOverflowGroupMessages === 'function') {
            for (const g of groups) {
                groupCount += Number(db.countOverflowGroupMessages(g.id, g.inject_limit ?? 5) || 0);
            }
        }
        return {
            private: typeof db.countOverflowMessages === 'function'
                ? Number(db.countOverflowMessages(character.id, privateWindow) || 0)
                : 0,
            group: groupCount,
            city: db.city && typeof db.city.countOverflowCityLogs === 'function'
                ? Number(db.city.countOverflowCityLogs(character.id, 0) || 0)
                : 0,
            limit: sweepLimit
        };
    }

function resolveSweepPool(db, character, requestedPool, sweepLimit) {
        const normalized = normalizeSweepPool(requestedPool);
        if (normalized !== 'auto') return normalized;
        const counts = getSweepPoolCounts(db, character, sweepLimit);
        const ranked = ['private', 'group', 'city']
            .map(pool => ({ pool, count: Number(counts[pool] || 0) }))
            .sort((a, b) => b.count - a.count);
        return ranked[0]?.count > 0 ? ranked[0].pool : 'private';
    }

function collectSweepPoolEntries(db, character, pool, sweepLimit) {
        const meta = getSweepPoolMeta(pool);
        const privateMsgs = [];
        const groupMsgIds = [];
        const cityLogIds = [];
        const activityEntries = [];
        if (pool === 'private') {
            const privateWindow = character.context_msg_limit ?? 60;
            const rows = db.getOverflowMessages(character.id, privateWindow, sweepLimit);
            for (const m of rows) {
                privateMsgs.push(m);
                activityEntries.push({
                    id: m.id,
                    timestamp: Number(m.timestamp || 0),
                    kind: 'private',
                    role: m.role,
                    text: `[Private][${dependencies.formatAbsoluteTimestamp(m.timestamp)}] ${m.role === 'user' ? 'User' : character.name}: ${m.content}`,
                    source_message_ids_json: [String(m.id)],
                    source_context: meta.source_context,
                    scene_tag: meta.scene_tag
                });
            }
        } else if (pool === 'group') {
            const groups = db.getGroups().filter(g => g.members.some(m => m.member_id === character.id));
            const candidates = [];
            for (const g of groups) {
                const groupWindow = g.inject_limit ?? 5;
                const msgs = db.getOverflowGroupMessages(g.id, groupWindow, sweepLimit);
                for (const m of msgs) {
                    candidates.push({ group: g, message: m });
                }
            }
            candidates
                .sort((a, b) => Number(a.message.timestamp || 0) - Number(b.message.timestamp || 0))
                .slice(0, sweepLimit)
                .forEach(({ group, message }) => {
                    groupMsgIds.push(message.id);
                    const speaker = message.sender_id === 'user' ? 'User' : (message.sender_name || 'Unknown');
                    activityEntries.push({
                        id: message.id,
                        timestamp: Number(message.timestamp || 0),
                        kind: 'group',
                        role: message.sender_id === 'user' ? 'user' : 'character',
                        groupName: group.name || '',
                        text: `[Group:${group.name || 'Unknown'}][${dependencies.formatAbsoluteTimestamp(message.timestamp)}] ${speaker}: ${message.content}`,
                        source_message_ids_json: [`group:${message.id}`],
                        source_context: meta.source_context,
                        scene_tag: meta.scene_tag
                    });
                });
        } else if (pool === 'city' && db.city && typeof db.city.getOverflowCityLogs === 'function') {
            const cityLogs = db.city.getOverflowCityLogs(character.id, 0, sweepLimit);
            for (const log of cityLogs) {
                cityLogIds.push(log.id);
                activityEntries.push({
                    id: `city:${log.id}`,
                    timestamp: Number(log.timestamp || 0),
                    kind: 'city',
                    role: 'character',
                    text: `[City:${String(log.action_type || 'ACTION')}][${dependencies.formatAbsoluteTimestamp(log.timestamp)}][location=${log.location || ''}] ${character.name}: ${log.content}`,
                    source_message_ids_json: [`city:${log.id}`],
                    source_context: meta.source_context,
                    scene_tag: meta.scene_tag
                });
            }
        }
        activityEntries.sort((a, b) => {
            const tsDelta = Number(a.timestamp || 0) - Number(b.timestamp || 0);
            if (tsDelta !== 0) return tsDelta;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });
        return { activityEntries, privateMsgs, groupMsgIds, cityLogIds, meta };
    }

async function sweepOverflowMemories(character, options = {}) {
        const db = dependencies.getDb();
        const sweepLimit = character.sweep_limit || 30;
        const sweepPool = resolveSweepPool(db, character, options.pool || options.scope || options.source_context, sweepLimit);
        const sweepKey = String(character.id || '');
        const poolCooldownKey = `${sweepKey}:${sweepPool}`;
        const lastRunAt = Number(dependencies.sweepPoolCooldowns.get(poolCooldownKey) || 0);
        const now = Date.now();

        if (dependencies.activeSweepJobs.has(sweepKey)) {
            const error = 'Another long-term memory sweep is already running for this character.';
            console.log(`[Memory] Sweep skipped for ${character.name}/${sweepPool}: another sweep is already running.`);
            dependencies.updateSweepStatus(character.id, {
                sweep_last_error: error,
                sweep_last_saved_count: 0
            });
            return { status: 'running', savedCount: 0, pool: sweepPool, error };
        }

        if (lastRunAt > 0 && (now - lastRunAt) < dependencies.SWEEP_COOLDOWN_MS) {
            const remainingSeconds = Math.ceil((dependencies.SWEEP_COOLDOWN_MS - (now - lastRunAt)) / 1000);
            const error = `Memory sweep cooldown active for ${sweepPool}. Try again in ${remainingSeconds}s.`;
            console.log(`[Memory] Sweep skipped for ${character.name}/${sweepPool}: cooldown active (${remainingSeconds}s remaining).`);
            dependencies.updateSweepStatus(character.id, {
                sweep_last_error: error,
                sweep_last_saved_count: 0
            });
            return {
                status: 'cooldown',
                savedCount: 0,
                pool: sweepPool,
                error,
                remainingSeconds
            };
        }

        const memoryConfig = dependencies.resolveMemoryModelConfig(character);
        const memoryConfigFingerprint = dependencies.buildMemoryConfigFingerprint(memoryConfig);
        const authFailureCooldown = dependencies.sweepPoolAuthFailureCooldowns.get(poolCooldownKey);
        if (authFailureCooldown) {
            const cooldownUntil = Number(authFailureCooldown.until || 0);
            if (cooldownUntil > now && authFailureCooldown.fingerprint === memoryConfigFingerprint) {
                return {
                    status: 'cooldown',
                    savedCount: 0,
                    pool: sweepPool,
                    error: authFailureCooldown.error || 'Memory sweep model auth failed recently.',
                    remainingSeconds: Math.ceil((cooldownUntil - now) / 1000)
                };
            }
            if (cooldownUntil <= now || authFailureCooldown.fingerprint !== memoryConfigFingerprint) {
                dependencies.sweepPoolAuthFailureCooldowns.delete(poolCooldownKey);
            }
        }

        dependencies.activeSweepJobs.add(sweepKey);
        dependencies.sweepPoolCooldowns.set(poolCooldownKey, now);
        dependencies.updateSweepStatus(character.id, {
            sweep_last_run_at: now,
            sweep_last_error: '',
            sweep_last_saved_count: 0
        });
        if (!memoryConfig.endpoint || !memoryConfig.key || !memoryConfig.model) {
            dependencies.updateSweepStatus(character.id, {
                sweep_last_error: 'Memory sweep model is not configured.',
                sweep_last_saved_count: 0
            });
            dependencies.activeSweepJobs.delete(sweepKey);
            return { status: 'failed', savedCount: 0, pool: sweepPool, error: 'Memory sweep model is not configured.' };
        }

        const { activityEntries, privateMsgs, groupMsgIds, cityLogIds, meta } = collectSweepPoolEntries(db, character, sweepPool, sweepLimit);

            if (activityEntries.length === 0) {
                dependencies.updateSweepStatus(character.id, {
                    sweep_last_error: '',
                    sweep_last_saved_count: 0
                });
                dependencies.activeSweepJobs.delete(sweepKey);
                return { status: 'done', savedCount: 0, pool: sweepPool, consumedCount: 0 };
            }

        const batchSize = Math.max(12, Math.min(30, Math.ceil(sweepLimit / 3)));
        const totalBatches = Math.ceil(activityEntries.length / batchSize);
        const parsedMemories = [];
        let rollingSummary = '';
        const subjectRules = dependencies.buildMemorySubjectRules(character, meta.source_context);

        try {
            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const batchEntries = activityEntries.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
                const batchTimeMeta = dependencies.buildSourceTimeMeta(batchEntries);
                const batchText = batchEntries.map(entry => entry.text).join('\n') || 'No messages.';
                const extractionPrompt = `You are a memory aggregation assistant. Analyze batch ${batchIndex + 1} of ${totalBatches} from ${character.name}'s overflowed ${meta.contextLabel}.
Carry forward the important context from previous batches using the rolling summary, then refine it with the current batch.
Return a structured JSON object with both an updated rolling summary and 0 to 4 strong memory candidates.

${subjectRules}

CRITICAL:
- Output only valid JSON.
- Use the rolling summary to preserve continuity across batches.
- Prefer 0 to 4 strong memories for this batch, not an exhaustive list.
- Score each memory on a "surprise" factor from 1 to 10.
- Include the batch's real dialogue time range in your understanding.
- Classify each memory from a user-centered perspective:
  - "memory_focus": "user_profile" for stable identity, background, preferences, durable traits, long-term goals, or explicit durable constraints
  - "memory_focus": "user_current_arc" for what the user is currently pursuing, waiting on, worrying about, or going through as a time-bound event/state
  - "memory_focus": "relationship" for major user-character relationship dynamics
  - "memory_focus": "general" for everything else
- Non-stable facts such as one-off, dated, current, or situational states/events belong to "user_current_arc", not "user_profile".
- If one memory mixes a specific occurrence with a recurring pattern, split it into separate atomic memories when possible.
- Then assign "memory_tier":
  - "core" for user identity, current main life thread, or key relationship nodes
  - "active" for currently relevant but more temporary memories
  - "ambient" for lower-priority fragments
- Treat repeated confessions, direct affection, explicit "I like/love you", relationship confirmation, or clear emotional demands toward the character as key relationship nodes. These should usually be stored as "memory_focus": "relationship" and "memory_tier": "core".
- Surprise 1-3: Routine, completely expected.
- Surprise 4-6: Mildly interesting, personal details.
- Surprise 7-8: Emotional, unexpected events.
- Surprise 9-10: Mind-blowing, life-changing completely unexpected twists.
- Write each memory "summary" as a natural Chinese short sentence a human can read directly.
- Write each memory "content" as 1 to 2 fuller Chinese sentences with the key detail.
- Treat "event" as an internal short tag only.
- Avoid bland labels in "summary" such as "Financial transfer", "Meta-commentary conflict", "Preference update".
- This sweep is source-separated. Every emitted memory belongs to source_context="${meta.source_context}" and scene_tag="${meta.scene_tag}". Do not blend in other pools.
- Never write "用户..." for a commercial_street / city action unless the source line explicitly names User/Nana as the actor.
- City activity logs are routine life traces. Do not store them verbatim.
- Only extract a city-derived memory if several logs together reveal a durable arc, major consequence, unusual event, relationship-relevant action, severe health/money risk, or a plan that should affect future behavior.
- If a city log merely describes eating, walking, working, going home, browsing, or resting, keep it in the rolling summary at most; do not emit it as a memory candidate.

[Previous Rolling Summary]
${rollingSummary || 'None yet.'}

[Current Batch Time Range]
- Absolute start: ${dependencies.formatAbsoluteTimestamp(batchTimeMeta.source_started_at)}
- Absolute end: ${dependencies.formatAbsoluteTimestamp(batchTimeMeta.source_ended_at)}
- Source range label: ${batchTimeMeta.source_time_text || 'unknown'}
- Source message count: ${batchTimeMeta.source_message_count}

[Current Batch Messages]
${batchText}

Output exactly in this JSON format (and nothing else):
{
  "rolling_summary": "...",
  "memories": [
    {
      "memory_type": "event | fact | preference | relationship | plan | emotion",
      "memory_tier": "core | active | ambient",
      "memory_focus": "user_profile | user_current_arc | relationship | general",
      "summary": "自然中文短句，适合直接显示在记忆卡片上",
      "content": "更完整的中文说明，1到2句",
      "time": "recent past",
      "location": "chat",
      "people": ["..."],
      "event": "内部短标签",
      "relationships": ["..."] or [{"summary":"...","target":"...","change":"..."}],
      "items": ["..."],
      "emotion": "...",
      "importance": <number 1-10>,
      "surprise_score": <number 1-10>,
      "source_context": "${meta.source_context}",
      "scene_tag": "${meta.scene_tag}"
    }
  ]
}`;

                dependencies.recordMemoryDebug(character, 'input', extractionPrompt, {
                    context_type: 'memory_sweep',
                    sweep_pool: sweepPool,
                    batch_index: batchIndex + 1,
                    total_batches: totalBatches,
                    rolling_summary: rollingSummary || '',
                    source_time_text: batchTimeMeta.source_time_text || '',
                    source_started_at: batchTimeMeta.source_started_at,
                    source_ended_at: batchTimeMeta.source_ended_at,
                    source_message_count: batchTimeMeta.source_message_count
                });
                const { content: responseText, usage } = await dependencies.callLLM({
                    endpoint: memoryConfig.endpoint,
                    key: memoryConfig.key,
                    model: memoryConfig.model,
                    messages: [
                        { role: 'system', content: 'You extract structured JSON memory objects from chat logs and keep a rolling summary across batches.' },
                        { role: 'user', content: extractionPrompt }
                    ],
                    maxTokens: dependencies.MEMORY_SMALL_MODEL_MAX_TOKENS,
                    temperature: 0.2,
                    enableCache: false,
                    cacheDb: dependencies.getDb(),
                    cacheType: 'memory_sweep',
                    cacheTtlMs: 30 * 24 * 60 * 60 * 1000,
                    cacheScope: `character:${character.id}`,
                    cacheCharacterId: character.id,
                    returnUsage: true
                });
                dependencies.recordMemoryTokenUsage(character.id, 'memory_sweep', usage);
                dependencies.recordMemoryDebug(character, 'output', responseText, {
                    context_type: 'memory_sweep',
                    batch_index: batchIndex + 1,
                    total_batches: totalBatches,
                    usage: usage || null,
                    model: memoryConfig.model,
                    source_time_text: batchTimeMeta.source_time_text || '',
                    source_started_at: batchTimeMeta.source_started_at,
                    source_ended_at: batchTimeMeta.source_ended_at,
                    source_message_count: batchTimeMeta.source_message_count
                });

                let parsed = null;
                try {
                    parsed = dependencies.parseStrictMemoryJsonObject(responseText, 'Memory sweep');
                } catch (e) {
                    dependencies.updateSweepStatus(character.id, {
                        sweep_last_error: `Batch ${batchIndex + 1}/${totalBatches} returned invalid JSON.`,
                        sweep_last_saved_count: 0
                    });
                    return {
                        status: 'failed',
                        savedCount: 0,
                        error: `Batch ${batchIndex + 1}/${totalBatches} returned invalid JSON.`
                    };
                }

                rollingSummary = String(parsed?.rolling_summary || rollingSummary || '').trim();
                const batchMemories = Array.isArray(parsed?.memories) ? parsed.memories : [];
                for (const mem of batchMemories) {
                    parsedMemories.push({
                        ...mem,
                        source_context: meta.source_context,
                        scene_tag: meta.scene_tag,
                        source_app: '',
                        source_started_at: batchTimeMeta.source_started_at,
                        source_ended_at: batchTimeMeta.source_ended_at,
                        source_time_text: batchTimeMeta.source_time_text,
                        source_message_count: batchTimeMeta.source_message_count,
                        source_message_ids_json: batchTimeMeta.source_message_ids_json
                    });
                }
            }

            let savedCount = 0;
            for (const mem of parsedMemories) {
                if (mem && mem.importance >= 3 && mem.event) {
                    mem.surprise_score = mem.surprise_score || 5;
                    const memoryId = await dependencies.saveExtractedMemory(character.id, mem, null);
                    if (memoryId) savedCount++;
                }
            }

            if (privateMsgs.length > 0) db.markMessagesSummarized(privateMsgs.map(m => m.id));
            if (groupMsgIds.length > 0) db.markGroupMessagesSummarized(groupMsgIds);
            if (cityLogIds.length > 0 && db.city && typeof db.city.markCityLogsSummarized === 'function') {
                db.city.markCityLogsSummarized(cityLogIds);
            }

            dependencies.updateSweepStatus(character.id, {
                sweep_last_error: savedCount > 0 ? '' : `${meta.label} sweep completed but no strong memories were extracted.`,
                sweep_last_success_at: savedCount > 0 ? Date.now() : character.sweep_last_success_at || 0,
                sweep_last_saved_count: savedCount
            });
            console.log(`[Memory] ${meta.label} sweep completed for ${character.name}, saved ${savedCount} memories across ${totalBatches} batch(es).`);
            return { status: 'done', savedCount, pool: sweepPool, consumedCount: activityEntries.length };
        } catch (e) {
            if (dependencies.isNonRetryableMemoryModelError(e)) {
                dependencies.sweepPoolAuthFailureCooldowns.set(poolCooldownKey, {
                    until: Date.now() + dependencies.SWEEP_AUTH_FAILURE_COOLDOWN_MS,
                    fingerprint: memoryConfigFingerprint,
                    error: e.message || 'Memory sweep model auth failed.'
                });
            }
            dependencies.updateSweepStatus(character.id, {
                sweep_last_error: e.message || 'Memory sweep failed.',
                sweep_last_saved_count: 0
            });
            console.error(`[Memory] ${sweepPool} sweep failed for ${character.id}:`, e.message);
            return {
                status: 'failed',
                savedCount: 0,
                pool: sweepPool,
                error: e.message || 'Memory sweep failed.'
            };
        } finally {
            dependencies.activeSweepJobs.delete(sweepKey);
        }
    }

    return { normalizeSweepPool, getSweepPoolMeta, getSweepPoolCounts, resolveSweepPool, collectSweepPoolEntries, sweepOverflowMemories };
}

module.exports = { createModule };
