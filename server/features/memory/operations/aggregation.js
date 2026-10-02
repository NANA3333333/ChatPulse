// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function parseMemoryArrayFromResponse(responseText) {
        return dependencies.parseStrictMemoryJsonArray(responseText, 'Memory aggregation');
    }

async function aggregateDailyMemoriesChunked(character, hoursAgo = 24, options = {}) {
        const memoryConfig = dependencies.resolveMemoryModelConfig(character);
        if (!memoryConfig.endpoint || !memoryConfig.key || !memoryConfig.model) {
            return 0;
        }

        const sinceMs = Date.now() - hoursAgo * 60 * 60 * 1000;
        const batchSize = Math.max(10, Math.min(500, Number(options.batchSize) || 80));
        const activityEntries = [];
        const db = dependencies.getDb();

        const privateMsgs = db.getVisibleMessagesSince(character.id, sinceMs);
        privateMsgs.forEach((m) => {
            activityEntries.push({
                timestamp: m.timestamp || 0,
                text: `[Private Chat][private_chat] ${m.role === 'user' ? 'User' : character.name}: ${m.content}`
            });
        });

        const groups = db.getGroups().filter(g => g.members.some(m => m.member_id === character.id));
        for (const g of groups) {
            const msgs = db.getVisibleGroupMessages(g.id, 1000, sinceMs);
            msgs.forEach((m) => {
                const sName = m.sender_id === 'user' ? 'User' : (m.sender_name || 'Unknown');
                activityEntries.push({
                    timestamp: m.timestamp || 0,
                    text: `[Group Chat: ${g.name}][group_chat] ${sName}: ${m.content}`
                });
            });
        }

        try {
            const initCityDb = require("../../city/cityDb.js");
            const cityDb = initCityDb(typeof db.getRawDb === 'function' ? db.getRawDb() : db);
            if (cityDb) {
                const logs = cityDb.getCharacterTodayLogs(character.id, 100);
                const recentLogs = (logs || []).filter((l) => l.timestamp >= sinceMs);
                recentLogs.forEach((l) => {
                    activityEntries.push({
                        timestamp: l.timestamp || 0,
                        text: `[City Activity][commercial_street] ${character.name}: ${l.message}`
                    });
                });
            }
        } catch (e) { /* ignore */ }

        if (activityEntries.length === 0) return 0;

        activityEntries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const engineContextWrapper = { getUserDb: dependencies.getUserDb, getMemory: () => dependencies.getMemory(dependencies.userId) };
        const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, character, '', false);
        const totalBatches = Math.ceil(activityEntries.length / batchSize);
        const subjectRules = dependencies.buildMemorySubjectRules(character, 'mixed');
        let savedCount = 0;

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batchEntries = activityEntries.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
            const batchText = batchEntries.map((entry) => entry.text).join('\n');
            const extractionPrompt = `[Global Context]
${universalResult?.preamble || ''}

[Current Task]
You are a memory aggregation assistant. Analyze batch ${batchIndex + 1} of ${totalBatches} from ${character.name}'s daily activity log over the past ${hoursAgo} hours.
This chunk may include private chats with User, group chats, and city activities.
Identify noteworthy events, facts, relationship developments, preferences, plans, emotional shifts, or recurring themes worth remembering long-term.
Return a structured JSON ARRAY of memory objects.

${subjectRules}

IMPORTANT:
- Process only this chunk.
- If importance >= 3, include it.
- If nothing meaningful happened in this chunk, return [].
- Do not explain your answer outside the JSON array.
- Routine city logs (eating, wandering, sitting around, heading home) should usually be omitted unless they create strong emotional, relational, financial, or survival-relevant developments.
- Classify each memory from a user-centered perspective:
  - "memory_focus": "user_profile" for stable identity, background, preferences, durable traits, long-term goals, or explicit durable constraints
  - "memory_focus": "user_current_arc" for what the user is currently dealing with, pursuing, waiting on, worrying about, or going through as a time-bound event/state
  - "memory_focus": "relationship" for major user-character relationship dynamics
  - "memory_focus": "general" for everything else
- Non-stable facts such as one-off, dated, current, or situational states/events belong to "user_current_arc", not "user_profile".
- If one memory mixes a specific occurrence with a recurring pattern, split it into separate atomic memories when possible.
- Then assign "memory_tier":
  - "core" for user identity, current main life thread, or key relationship nodes
  - "active" for currently relevant but more temporary memories
  - "ambient" for lower-priority fragments
- Treat repeated confessions, direct affection, explicit "I like/love you", relationship confirmation, or clear emotional demands toward the character as key relationship nodes. These should usually be stored as "memory_focus": "relationship" and "memory_tier": "core".
- Choose "source_context" and "scene_tag" from the source prefix: private_chat, group_chat, commercial_street, diary, external_app, or unknown.
- For city/commercial-street logs, output source_context="commercial_street" and scene_tag="commercial_street"; do not rewrite the character's city action as a User action.

Importance scale:
- 1-3: Casual preferences, routine activities
- 4-6: Personal events, expressed emotions, shared plans
- 7-8: Deep emotional moments, conflicts
- 9-10: Life-changing events, major relationship shifts

Chunk Activities:
---
${batchText}
---

Output exactly in this JSON format (and nothing else):
[
  {
    "memory_type": "event | fact | preference | relationship | plan | emotion",
    "memory_tier": "core | active | ambient",
    "memory_focus": "user_profile | user_current_arc | relationship | general",
    "summary": "...",
    "content": "...",
    "time": "e.g. today",
    "location": "...",
    "people": ["..."],
    "event": "...",
    "relationships": ["..."] or [{"summary":"...","target":"...","change":"..."}],
    "items": ["..."],
    "emotion": "...",
    "importance": <number 1-10>,
    "source_context": "private_chat | group_chat | commercial_street | diary | external_app | unknown",
    "scene_tag": "private_chat | group_chat | commercial_street | diary | external_app | unknown"
  }
]`;

            try {
                const { content: responseText, usage } = await dependencies.callLLM({
                    endpoint: memoryConfig.endpoint,
                    key: memoryConfig.key,
                    model: memoryConfig.model,
                    messages: [
                        { role: 'system', content: 'You extract structured JSON arrays of facts from diverse daily logs. Lean toward extracting memories.' },
                        { role: 'user', content: extractionPrompt }
                    ],
                    maxTokens: dependencies.MEMORY_SMALL_MODEL_MAX_TOKENS,
                    temperature: 0.3,
                    enableCache: true,
                    cacheDb: dependencies.getDb(),
                    cacheType: 'memory_daily_aggregate',
                    cacheTtlMs: 30 * 24 * 60 * 60 * 1000,
                    cacheScope: `character:${character.id}`,
                    cacheCharacterId: character.id,
                    returnUsage: true
                });
                dependencies.recordMemoryTokenUsage(character.id, 'memory_daily_aggregate', usage);

                const parsed = parseMemoryArrayFromResponse(responseText);
                if (Array.isArray(parsed)) {
                    for (const mem of parsed) {
                        if (mem.importance >= 3 && mem.event) {
                            await dependencies.saveExtractedMemory(character.id, mem, null);
                            savedCount++;
                        }
                    }
                }
            } catch (e) {
                console.error(`[Memory] Daily aggregation batch ${batchIndex + 1}/${totalBatches} failed for ${character.id}:`, e.message);
            }
        }

        console.log(`[Memory] Daily aggregation completed for ${character.name}, saved ${savedCount} memories across ${totalBatches} batch(es).`);
        return savedCount;
    }

async function aggregateDailyMemories(character, hoursAgo = 24, options = {}) {
        const memoryConfig = dependencies.resolveMemoryModelConfig(character);
        if (!memoryConfig.endpoint || !memoryConfig.key || !memoryConfig.model) {
            return 0;
        }

        return aggregateDailyMemoriesChunked(character, hoursAgo, options);
    }

    return { parseMemoryArrayFromResponse, aggregateDailyMemoriesChunked, aggregateDailyMemories };
}

module.exports = { createModule };
