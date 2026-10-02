// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function resolveMemoryModelConfig(character) {
        return {
            endpoint: character.memory_api_endpoint || character.api_endpoint || '',
            key: character.memory_api_key || character.api_key || '',
            model: character.memory_model_name || character.model_name || ''
        };
    }

function buildMemoryConfigFingerprint(config = {}) {
        return dependencies.crypto
            .createHash('sha256')
            .update([
                String(config.endpoint || '').trim(),
                String(config.model || '').trim(),
                String(config.key || '').trim()
            ].join('\n'))
            .digest('hex');
    }

function isNonRetryableMemoryModelError(error) {
        const text = [
            error?.message,
            error?.payload?.raw_response,
            error?.payload?.error,
            error?.response?.status,
            error?.status
        ].filter(Boolean).join('\n');
        return /(401|403|unauthorized|forbidden|invalid\s*(api\s*)?key|invalid_key|permission|auth)/i.test(text);
    }

function recordMemoryDebug(character, direction, payload, meta = {}) {
        if (!character || character.llm_debug_capture !== 1) return;
        const db = dependencies.getDb();
        if (typeof db.addLlmDebugLog !== 'function') return;
        try {
            const normalizedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
            db.addLlmDebugLog({
                character_id: character.id,
                direction,
                context_type: meta.context_type || 'memory',
                payload: normalizedPayload || '',
                meta,
                timestamp: Date.now()
            });
        } catch (e) {
            console.warn('[Memory] Failed to record debug log:', e.message);
        }
    }

async function expandMemoryQueriesWithLLM(db, characterId, queryText, baseVariants = []) {
        if (!dependencies.MEMORY_QUERY_EXPANSION_ENABLED) {
            return [];
        }
        try {
            const character = db.getCharacter ? db.getCharacter(characterId) : null;
            if (!character) return [];
            const memoryConfig = resolveMemoryModelConfig(character);
            if (!memoryConfig.endpoint || !memoryConfig.key || !memoryConfig.model) return [];

            const prompt = [
                '你是记忆检索查询改写器。',
                '目标：把用户这句“想让角色回忆什么”的问题，改写成 3 到 6 个短检索词或短短语。',
                '要求：',
                '- 保留原主题，不要发散到无关方向。',
                '- 优先抽出实体、人名、公司名、地点名、事件名、别名、英文名、关键词。',
                '- 如果原句是中文，但核心实体常见英文形式更适合检索，可以同时给英文词。',
                '- 不要输出解释。',
                '- 每行只写一个检索词或短短语，不要编号，不要 JSON，不要多余说明。',
                `原问题: ${String(queryText || '').trim()}`,
                `已有基础检索词: ${JSON.stringify(baseVariants || [])}`
            ].join('\n');

            const { content } = await dependencies.callLLM({
                endpoint: memoryConfig.endpoint,
                key: memoryConfig.key,
                model: memoryConfig.model,
                messages: [
                    { role: 'system', content: 'You rewrite memory recall questions into compact retrieval keywords. Output one retrieval phrase per line. No JSON. No numbering. No explanation.' },
                    { role: 'user', content: prompt }
                ],
                maxTokens: dependencies.MEMORY_SMALL_MODEL_MAX_TOKENS,
                temperature: 0,
                enableCache: true,
                cacheDb: db,
                cacheType: 'memory_query_expand',
                cacheTtlMs: 30 * 24 * 60 * 60 * 1000,
                cacheScope: `character:${characterId}`,
                cacheCharacterId: characterId,
                cacheKeyExtra: 'v2',
                cacheKeyMode: 'exact'
            });

            const text = String(content || '').trim();
            return text
                .split(/\r?\n/)
                .map(line => String(line || '').replace(/^[-*•\d.\s]+/, '').trim())
                .filter(Boolean)
                .slice(0, 6);
        } catch (e) {
            console.warn('[Memory] Query expansion failed:', e.message);
            return [];
        }
    }

    return { resolveMemoryModelConfig, buildMemoryConfigFingerprint, isNonRetryableMemoryModelError, recordMemoryDebug, expandMemoryQueriesWithLLM };
}

module.exports = { createModule };
