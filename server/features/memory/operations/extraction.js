// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function extractMemoryFromContext(character, recentMessages, groupId = null) {
        const memoryConfig = dependencies.resolveMemoryModelConfig(character);
        if (!memoryConfig.endpoint || !memoryConfig.key || !memoryConfig.model) {
            // Skip memory extraction if memory AI is not configured
            return null;
        }

        const contextText = recentMessages.map(m => `${m.role === 'user' ? 'User' : character.name}: ${m.content}`).join('\n');
        const sourceTimeMeta = dependencies.buildSourceTimeMeta(recentMessages);
        const sourceContext = groupId ? 'group_chat' : 'private_chat';
        const sceneTag = groupId ? 'group_chat' : 'private_chat';
        const subjectRules = dependencies.buildMemorySubjectRules(character, sourceContext);
        const engineContextWrapper = { getUserDb: dependencies.getUserDb, getMemory: () => dependencies.getMemory(dependencies.userId) };
        const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, character, '', !!groupId);

        const extractionPrompt = `[全局世界观与前情提要]
${universalResult?.preamble || ''}

[当前特殊任务]：
You are a memory extraction assistant. Analyze the following recent conversation snippet between User and ${character.name}.
Identify if there are any noteworthy facts, events, preferences, emotions, or relationship changes worth remembering.
Return a structured JSON object. Focus on extracting WHAT happened, WHEN, WHERE, and WHO.

${subjectRules}

WRITING STYLE:
- Write "summary" as a natural Chinese short sentence that a human can read at a glance.
- "summary" should feel like a memory card title, not a dry database label.
- Prefer concrete, relationship-aware phrasing over abstract categories.
- Write "content" as 1 to 2 fuller Chinese sentences with key detail.
- "event" is only an internal short tag, and can be shorter / more generic than summary.
- Classify each memory from a user-centered perspective:
  - "memory_focus": "user_profile" for stable identity, background, preferences, durable traits, long-term goals, or explicit durable constraints
  - "memory_focus": "user_current_arc" for what the user is currently dealing with, pursuing, waiting on, worrying about, or going through as a time-bound event/state
  - "memory_focus": "relationship" for major user-character relationship dynamics, trust shifts, conflicts, closeness, jealousy, repair
  - "memory_focus": "general" for everything else
- Non-stable facts such as one-off, dated, current, or situational states/events belong to "user_current_arc", not "user_profile".
- If one memory mixes a specific occurrence with a recurring pattern, split it into separate atomic memories when possible.
- Then assign "memory_tier":
  - "core" for the user's personal identity, current main life thread, or major relationship nodes that should be easy to recall later
  - "active" for currently relevant but more temporary memories
  - "ambient" for lower-priority background fragments
- Do not write summary as bland labels like "Financial transfer", "Meta-commentary conflict", "Preference update", "Emotional insecurity".
- Better summary examples:
  - "Nana给Claude转了83.52元，让他先去吃饭休息。"
  - "Claude嘴上逞强，还是承认自己很怕Nana逗完就不理他。"
  - "Nana提到有初创公司愿意要她，Claude立刻顺着这点继续鼓励她。"

IMPORTANT: Be selective. This immediate extraction path is only for durable, high-value long-term memory.
- Prefer "action": "add" or "update" only for memories that will still matter after the current chat scrolls away.
- Good candidates: clear user preferences, stable background facts, current life arc, explicit plans, major emotional turning points, confessions, promises, conflicts, repair, or relationship changes.
- Usually skip routine back-and-forth, light teasing, generic affection, one-off small talk, and ordinary daily activity unless it creates strong emotion, money/survival pressure, or a meaningful relationship shift.
- Routine city activities like eating, wandering, sitting in a park, or heading home should usually be skipped.

Importance scale:
- 1-3: Casual preferences, small talk, routine activities
- 4-6: Personal events, expressed emotions, shared plans
- 7-8: Deep emotional moments, confessions, conflicts
- 9-10: Life-changing events, major relationship shifts

Use "action": "add" or "update" only when the memory is genuinely worth keeping long-term right now. In most ordinary cases, use "action": "none".

Conversation:
---
${contextText}
---

[Source Dialogue Time Range]
- Absolute start: ${dependencies.formatAbsoluteTimestamp(sourceTimeMeta.source_started_at)}
- Absolute end: ${dependencies.formatAbsoluteTimestamp(sourceTimeMeta.source_ended_at)}
- Source range label: ${sourceTimeMeta.source_time_text || 'unknown'}
- Source message count: ${sourceTimeMeta.source_message_count}

Output exactly in this JSON format (and nothing else):
{
    "action": "add" | "update" | "none",
    "memory_type": "event | fact | preference | relationship | plan | emotion",
    "memory_tier": "core | active | ambient",
    "memory_focus": "user_profile | user_current_arc | relationship | general",
    "summary": "自然中文短句，适合直接显示在记忆卡片上",
    "content": "更完整的中文说明，1到2句",
    "time": "...",
    "location": "...",
    "people": ["..."],
    "event": "内部短标签",
    "relationships": ["..."] or [{"summary":"...","target":"...","change":"..."}],
    "items": ["..."],
    "emotion": "...",
    "importance": <number 1-10>,
    "source_context": "${sourceContext}",
    "scene_tag": "${sceneTag}",
    "source_message_ids_json": ["optional ids if known"]
}
`;

        try {
            dependencies.recordMemoryDebug(character, 'input', extractionPrompt, {
                context_type: 'memory_extract',
                source_time_text: sourceTimeMeta.source_time_text || '',
                source_started_at: sourceTimeMeta.source_started_at,
                source_ended_at: sourceTimeMeta.source_ended_at,
                source_message_count: sourceTimeMeta.source_message_count,
                group_id: groupId || ''
            });
            const { content: responseText, usage } = await dependencies.callLLM({
                endpoint: memoryConfig.endpoint,
                key: memoryConfig.key,
                model: memoryConfig.model,
                messages: [
                    { role: 'system', content: 'You extract structured JSON facts from conversations. Be selective: only return add/update for durable high-value long-term memories, otherwise return none.' },
                    { role: 'user', content: extractionPrompt }
                ],
                maxTokens: dependencies.MEMORY_SMALL_MODEL_MAX_TOKENS,
                temperature: 0.3,
                enableCache: true,
                cacheDb: dependencies.getDb(),
                cacheType: 'memory_extract',
                cacheTtlMs: 30 * 24 * 60 * 60 * 1000,
                cacheScope: `character:${character.id}`,
                cacheCharacterId: character.id,
                returnUsage: true
            });
            dependencies.recordMemoryTokenUsage(character.id, 'memory_extract', usage);
            dependencies.recordMemoryDebug(character, 'output', responseText, {
                context_type: 'memory_extract',
                usage: usage || null,
                model: memoryConfig.model,
                source_time_text: sourceTimeMeta.source_time_text || '',
                source_started_at: sourceTimeMeta.source_started_at,
                source_ended_at: sourceTimeMeta.source_ended_at,
                source_message_count: sourceTimeMeta.source_message_count,
                group_id: groupId || ''
            });

            const parsed = dependencies.parseStrictMemoryJsonObject(responseText, 'Memory extraction');
            if (parsed.action === 'add' || parsed.action === 'update') {
                parsed.source_context = sourceContext;
                parsed.scene_tag = sceneTag;
                parsed.source_started_at = sourceTimeMeta.source_started_at;
                parsed.source_ended_at = sourceTimeMeta.source_ended_at;
                parsed.source_time_text = parsed.source_time_text || sourceTimeMeta.source_time_text;
                parsed.source_message_count = sourceTimeMeta.source_message_count;
                if (!Array.isArray(parsed.source_message_ids_json) || parsed.source_message_ids_json.length === 0) {
                    parsed.source_message_ids_json = sourceTimeMeta.source_message_ids_json;
                }
                if (!dependencies.shouldWriteImmediateMemory(parsed)) {
                    console.log(`[Memory] Skipped immediate memory for ${character.id}: below high-value threshold (${parsed.summary || parsed.event || 'untitled'})`);
                    return null;
                }
                await dependencies.saveExtractedMemory(character.id, parsed, groupId);
                return parsed;
            }
        } catch (e) {
            console.error(`[Memory] Extraction failed for ${character.id}:`, e.message);
        }
        return null;
    }

    return { extractMemoryFromContext };
}

module.exports = { createModule };
