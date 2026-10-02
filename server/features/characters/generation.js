// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function parseGeneratedCharacterReply(replyText) {
    const cleanText = String(replyText || '')
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim();
    if (!cleanText) throw new Error('LLM did not return a valid JSON object. Check Server Logs.');
    const parsed = JSON.parse(cleanText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Generated character must be a JSON object.');
    }
    return parsed;
}

function requireGeneratedCharacterText(value, field, maxLength = 6000) {
    const text = String(value || '').trim();
    if (!text) throw new Error(`Generated character is missing ${field}.`);
    return text.slice(0, maxLength);
}

function requireGeneratedCharacterInteger(value, field, min, max) {
    const normalized = typeof value === 'number'
        ? value
        : (typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : NaN);
    if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
        throw new Error(`Generated character has invalid ${field}.`);
    }
    return normalized;
}

function requireGeneratedCharacterFlag(value, field) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const text = String(value ?? '').trim().toLowerCase();
    if (['true', 'yes', 'on'].includes(text)) return 1;
    if (['false', 'no', 'off'].includes(text)) return 0;
    const numeric = requireGeneratedCharacterInteger(value, field, 0, 100);
    return numeric > 0 ? 1 : 0;
}

function normalizeGeneratedCharacterPayload(parsed) {
    const intervalMin = requireGeneratedCharacterInteger(parsed.interval_min, 'interval_min', 1, 10080);
    const intervalMax = requireGeneratedCharacterInteger(parsed.interval_max, 'interval_max', 1, 10080);
    if (intervalMax < intervalMin) {
        throw new Error('Generated character has invalid interval range.');
    }
    return {
        name: requireGeneratedCharacterText(parsed.name, 'name', 80),
        persona: requireGeneratedCharacterText(parsed.persona, 'persona'),
        world_info: requireGeneratedCharacterText(parsed.world_info, 'world_info'),
        affinity: requireGeneratedCharacterInteger(parsed.affinity, 'affinity', 0, 100),
        sys_pressure: requireGeneratedCharacterFlag(parsed.sys_pressure, 'sys_pressure'),
        sys_jealousy: requireGeneratedCharacterFlag(parsed.sys_jealousy, 'sys_jealousy'),
        interval_min: intervalMin,
        interval_max: intervalMax,
        target_emoji: requireGeneratedCharacterText(parsed.target_emoji, 'target_emoji', 16)
    };
}

function isLocalOllamaEndpoint(endpoint) {
    try {
        const parsed = new URL(String(endpoint || '').trim());
        const host = parsed.hostname.toLowerCase();
        return ['127.0.0.1', 'localhost', '::1'].includes(host)
            && (!parsed.port || parsed.port === '11434');
    } catch (_) {
        return false;
    }
}

function getLocalCharacterGeneratorConfig({ endpoint, model }) {
    if (!isLocalOllamaEndpoint(endpoint)) {
        return {
            model,
            maxTokens: 1500,
            temperature: 0.7,
            requestTimeoutMs: 0,
            maxAttempts: 2,
            responseFormat: null,
            localOllama: false
        };
    }
    return {
        model: String(process.env.CP_LOCAL_CHARACTER_GENERATOR_MODEL || model).trim() || model,
        maxTokens: Math.max(256, Math.min(1200, Number(process.env.CP_LOCAL_CHARACTER_GENERATOR_MAX_TOKENS || 512) || 512)),
        temperature: Math.max(0, Math.min(1, Number(process.env.CP_LOCAL_CHARACTER_GENERATOR_TEMPERATURE || 0.35) || 0.35)),
        requestTimeoutMs: Math.max(0, Number(process.env.CP_LOCAL_CHARACTER_GENERATOR_TIMEOUT_MS || 1200000) || 1200000),
        maxAttempts: 1,
        responseFormat: { type: 'json_object' },
        localOllama: true
    };
}

function buildLocalOllamaNativeChatUrl(endpoint) {
    const parsed = new URL(String(endpoint || '').trim());
    parsed.pathname = '/api/chat';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}

async function callLocalOllamaCharacterGenerator({ endpoint, model, messages, maxTokens, temperature }) {
    const url = buildLocalOllamaNativeChatUrl(endpoint);
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
            format: 'json',
            think: false,
            options: {
                num_predict: maxTokens,
                temperature,
                top_p: 0.9
            }
        })
    });
    if (!response.ok) {
        throw new Error(`Ollama native API Error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    const content = String(data?.message?.content || data?.response || '').trim();
    if (!content) {
        throw new Error('Local Ollama did not return JSON content.');
    }
    return content;
}

    return { parseGeneratedCharacterReply, requireGeneratedCharacterText, requireGeneratedCharacterInteger, requireGeneratedCharacterFlag, normalizeGeneratedCharacterPayload, isLocalOllamaEndpoint, getLocalCharacterGeneratorConfig, buildLocalOllamaNativeChatUrl, callLocalOllamaCharacterGenerator };
}

module.exports = { createModule };
