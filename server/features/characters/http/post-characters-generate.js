// POST /api/characters/generate
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/characters/generate', require("../../../platform/http/trace.js").traceHttp("characters", "POST /api/characters/generate"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const { query, api_endpoint, api_key, model_name } = req.body;
        if (!query || !api_endpoint || !api_key || !model_name) {
            return res.status(400).json({ error: 'Missing required API keys or query description.' });
        }

        const generatorConfig = dependencies.getLocalCharacterGeneratorConfig({
            endpoint: api_endpoint,
            model: model_name
        });

        const systemPrompt = generatorConfig.localOllama
            ? `You are a compact RPG character generator for a realistic social messaging app simulation.
Return ONLY one raw JSON object. No markdown. No prose outside JSON. Do not reason step by step.
Keep persona and world_info short: 1-2 sentences each.
Every string must be valid JSON with escaped newlines if needed.

The JSON MUST have the EXACT following keys:
- "name" (string)
- "persona" (string, first-person personality and speech habits)
- "world_info" (string, background and relationship to the user)
- "affinity" (integer 0-100)
- "sys_pressure" (integer 0 or 1)
- "sys_jealousy" (integer 0 or 1)
- "interval_min" (integer minutes)
- "interval_max" (integer minutes, >= interval_min)
- "target_emoji" (string, one emoji)`
            : `You are a professional RPG character generator. You must create a detailed character persona and world background based on the user's description. The character is intended for a realistic social messaging app simulation. Return ONLY a raw JSON object with no markdown formatting. Do not include \`\`\`json blocks.
CRITICAL JSON RULES:
1. Ensure all newlines within string values are escaped as \\n (Do not output literal newlines inside strings).
2. Do NOT include any comments (like // or /* */).
3. Do NOT output trailing commas.
4. Keep ALL text fields extremely concise (max 2-3 sentences per field) to prevent the generation from being cut off.

The JSON MUST have the EXACT following keys:
- "name" (string, the character's name)
- "persona" (string, extremely detailed, first-person psychological profile and speech habits)
- "world_info" (string, detailed background of the setting and their relationship to the user)
- "affinity" (number 0-100, initial relationship level, integer)
- "sys_pressure" (number 0 or 1, 1 if they are prone to anxiety/stress)
- "sys_jealousy" (number 0 or 1, 1 if they are possessive/jealous)
- "interval_min" (number, suggested minimum minutes between proactive messages, integer)
- "interval_max" (number, suggested max minutes, integer)
- "target_emoji" (string, a single emoji that best represents this character's vibe/personality)
`;

        const existingChars = db.getCharacters();
        const usedEmojis = Array.from(new Set(existingChars.map(c => c.emoji).filter(e => e && e !== '👤')));
        const excludeEmojiStr = usedEmojis.length > 0
            ? `\nCRITICAL EMOJI RULE: Do NOT use any of these emojis because they are already taken by other characters: ${usedEmojis.join(', ')}. You MUST pick a unique one.`
            : '';

        const finalSystemPrompt = systemPrompt + excludeEmojiStr;

        const generatorMessages = [{ role: 'system', content: finalSystemPrompt }, { role: 'user', content: query }];
        const generatedText = generatorConfig.localOllama
            ? await dependencies.callLocalOllamaCharacterGenerator({
                endpoint: api_endpoint,
                model: generatorConfig.model,
                messages: generatorMessages,
                maxTokens: generatorConfig.maxTokens,
                temperature: generatorConfig.temperature
            })
            : await dependencies.callLLM({
                endpoint: api_endpoint,
                key: api_key,
                model: generatorConfig.model,
                messages: generatorMessages,
                maxTokens: generatorConfig.maxTokens,
                temperature: generatorConfig.temperature,
                requestTimeoutMs: generatorConfig.requestTimeoutMs,
                maxAttempts: generatorConfig.maxAttempts,
                responseFormat: generatorConfig.responseFormat
            });

        console.log(`[Character Generator] LLM returned ${String(generatedText || '').length} chars.`);

        let parsed;
        try {
            parsed = dependencies.normalizeGeneratedCharacterPayload(dependencies.parseGeneratedCharacterReply(generatedText));
        } catch (err) {
            console.error(`[Character Generator] JSON validation failed. responseLength=${String(generatedText || '').length}`);
            throw new Error('LLM JSON Syntax Error: ' + err.message);
        }

        // Set local integration fields only after the generated payload validates.
        parsed.avatar = dependencies.buildDefaultAvatarUrl(parsed.name);
        parsed.api_endpoint = api_endpoint;
        parsed.api_key = api_key;
        parsed.model_name = model_name;
        parsed.sys_timer = 1;
        parsed.sys_proactive = 1;
        parsed.emoji = parsed.target_emoji;
        delete parsed.target_emoji;

        return res.json({ success: true, character: parsed });
    } catch (e) {
        console.error('Generation Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
