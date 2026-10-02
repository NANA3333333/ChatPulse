// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function recordContextRouteDebug(db, character, direction, payload, meta = {}) {
    if (!character || character.llm_debug_capture !== 1 || typeof db?.addLlmDebugLog !== 'function') return;
    try {
        const normalizedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
        db.addLlmDebugLog({
            character_id: character.id,
            direction,
            context_type: meta.context_type || 'context_module_router',
            payload: normalizedPayload || '',
            meta,
            timestamp: Date.now()
        });
    } catch (e) {
        console.warn(`[ContextBuilder] Failed to record route debug for ${character?.name || character?.id}: ${e.message}`);
    }
}

function parseModuleRouteJson(rawText = '') {
    const text = String(rawText || '').trim();
    if (!text) return null;

    const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = codeFenceMatch ? codeFenceMatch[1].trim() : text;

    try {
        const parsed = JSON.parse(candidate);
        return {
            city_detail: parsed?.city_detail === 1 ? 1 : 0,
            school_detail: parsed?.school_detail === 1 ? 1 : 0,
            society_detail: parsed?.society_detail === 1 ? 1 : 0
        };
    } catch (e) {
        const readBit = (key) => {
            const match = candidate.match(new RegExp(`"${key}"\\s*:\\s*([01])`, 'i'));
            if (!match) return null;
            return match[1] === '1' ? 1 : 0;
        };
        const city = readBit('city_detail');
        const school = readBit('school_detail');
        const society = readBit('society_detail');
        if (city === null || school === null || society === null) return null;
        return {
            city_detail: city,
            school_detail: school,
            society_detail: society
        };
    }
}

function isValidModuleRoutePayload(rawText = '') {
    return !!parseModuleRouteJson(rawText);
}

function buildRecentPrivateRouteContext(db, character, maxItems = 6) {
    if (!db || typeof db.getVisibleMessages !== 'function' || !character?.id) return '';
    try {
        const rows = db.getVisibleMessages(character.id, Math.max(1, maxItems)) || [];
        if (!Array.isArray(rows) || rows.length === 0) return '';
        const lines = rows.slice(-maxItems).map(row => {
            const role = row?.role === 'character' ? '角色' : '用户';
            return `${role}: ${String(row?.content || '').trim()}`;
        }).filter(Boolean);
        if (lines.length === 0) return '';
        return ['[最近私聊窗口]', ...lines].join('\n');
    } catch (e) {
        console.warn('[ContextBuilder] Failed to build recent private route context:', e.message);
        return '';
    }
}

async function routeContextModules(db, character, recentInput = '', topicSwitchState = null) {
    const text = String(recentInput || '').trim();
    const defaultRoutes = {
        city_detail: 0,
        school_detail: 0,
        society_detail: 0
    };

    if (!text) {
        recordContextRouteDebug(db, character, 'event', 'Module routing skipped: empty recent input.', {
            context_type: 'context_module_router',
            skipped: true,
            reason: 'empty_recent_input'
        });
        return defaultRoutes;
    }

    const endpoint = character?.memory_api_endpoint || character?.api_endpoint || '';
    const key = character?.memory_api_key || character?.api_key || '';
    const model = character?.memory_model_name || character?.model_name || '';
    if (!endpoint || !key || !model) {
        recordContextRouteDebug(db, character, 'event', 'Module routing skipped: missing model config.', {
            context_type: 'context_module_router',
            skipped: true,
            reason: 'missing_model_config',
            recent_input: text
        });
        return defaultRoutes;
    }

    const recentPrivateContext = buildRecentPrivateRouteContext(db, character, 6);
    const recentCityContext = dependencies.buildRecentCityRouteContext(db, character, 5);
    const normalizedTopicSwitch = topicSwitchState && typeof topicSwitchState === 'object'
        ? {
            decision: String(topicSwitchState.decision || '').trim() || 'UNKNOWN',
            reason: String(topicSwitchState.reason || '').trim() || 'unspecified'
        }
        : null;

    const judgePrompt = [
        '你是私聊上下文模块路由器。',
        '任务：判断这一轮主模型是否需要加载某些“详细模块内容”。',
        '只输出一行 JSON，格式必须是：{"city_detail":0,"school_detail":0,"society_detail":0}',
        '核心规则只有一条：私聊模块只负责对话本身；只有当用户需要“角色像真人一样在现实里做过、见过、去过、花过、吃过、经历过”的信息时，才路由到商业街。',
        '- 这类拟人现实信息通常是：现实生活行动、地点轨迹、身体状态来源、账单去向、吃了什么、去了哪里、从哪回来、公告广播、租房广告、现实事件纠错。',
        '- 纯对话理解、情绪回应、关系互动、记忆检索、时间回忆、总结回顾，都留在私聊对话层，不属于商业街。',
        '- 像“昨天发生了什么”“三天前发生了什么”“上周聊了什么”“你记得我说过什么吗”这类问题，本质是检索回忆，不是商业街，city_detail=0。',
        '- 只有当用户明确追问现实生活轨迹或现实来源，比如“你刚才去哪了”“你路过哪儿了”“你吃了什么”“你为什么这么累”“你花钱花哪了”，才设 city_detail=1。',
        '- 允许参考最近私聊和最近商业街记录，判断这句是否是在继续追问上一轮已经出现的现实事件。',
        '- 切题层结果是重要参考：如果 Topic Switch Gate 已经判定 CONTINUE_CURRENT_TOPIC，你要认真判断这句是否仍在继续上一轮现实事件，而不是草率降回普通闲聊。',
        '- 如果 Topic Switch Gate 判定 FOLLOW_UP_ON_RETRIEVED_HISTORY，也要优先考虑这句是不是在追问上一轮刚被提到的现实/回忆事件细节。',
        '- 如果上一轮已经是现实事件（例如已经承认“去了黑客据点”“让他们帮我查了点东西”），而这轮用户只说很短的追问，如“查到什么了”“然后呢”“看到什么了”“具体呢”，那么追问对象很可能仍然指向上一轮那次现实事件；这类情况通常继续保持 city_detail=1。',
        '- 例子：上一轮角色承认“我去了黑客据点，让他们帮我查了点东西”，下一轮用户问“查到什么了”，这是在追问那次黑客据点现实事件的具体内容，应倾向 city_detail=1，而不是降回普通闲聊。',
        '- 只有纯情绪回应、纯调情、纯安抚、纯观点讨论，不需要现实记录支撑时，city_detail=0。',
        '- school_detail 只有在明确问学校/课程/考试/老师/同学近况时才设 1，否则 0。',
        '- society_detail 只有在明确问工作/公司/部门/老板/社会身份近况时才设 1，否则 0。',
        '拿不准时优先留在对话层，也就是 city_detail=0。',
        '只能输出 JSON，不能解释。'
    ].join('\n');

    recordContextRouteDebug(db, character, 'input', {
        recent_input: text,
        judge_prompt: judgePrompt,
        topic_switch: normalizedTopicSwitch
    }, {
        context_type: 'context_module_router',
        model,
        endpoint,
        cache_type: 'context_module_router'
    });

    try {
        const result = await dependencies.callLLM({
            endpoint,
            key,
            model,
            messages: [
                { role: 'system', content: judgePrompt },
                {
                    role: 'user',
                    content: [
                        `[本轮用户输入]\n${text}`,
                        normalizedTopicSwitch
                            ? `[Topic Switch Gate]\nDecision=${normalizedTopicSwitch.decision}\nReason=${normalizedTopicSwitch.reason}`
                            : '',
                        recentPrivateContext,
                        recentCityContext,
                        '[判断要求]\n优先结合 Topic Switch Gate 判断这轮是否仍在继续上一轮现实事件。可以参考上面的最近私聊和最近商业街记录，但不要脱离当前用户这句去凭空扩展新剧情。'
                    ].filter(Boolean).join('\n\n')
                }
            ],
            maxTokens: dependencies.CONTEXT_ROUTER_MAX_TOKENS,
            temperature: 0,
            enableCache: true,
            cacheDb: db,
            cacheType: 'context_module_router',
            cacheTtlMs: 12 * 60 * 60 * 1000,
            cacheScope: `character:${character?.id || ''}`,
            cacheCharacterId: character?.id || '',
            cacheKeyExtra: 'v9',
            cacheKeyMode: 'exact',
            validateCachedContent: (cachedText) => isValidModuleRoutePayload(cachedText),
            shouldCacheResult: (resultText) => isValidModuleRoutePayload(resultText),
            returnUsage: true
        });
        const content = typeof result === 'string' ? result : result?.content;
        const finishReason = String(result?.finishReason || '').trim();
        const parsed = parseModuleRouteJson(content);
        if (finishReason === 'length') {
            const routeErr = new Error('Context module router output was truncated. Please retry.');
            recordContextRouteDebug(db, character, 'event', String(content || ''), {
                context_type: 'context_module_router',
                error: true,
                recent_input: text,
                model,
                endpoint,
                reason: 'router_output_truncated',
                finishReason,
                cached: !!result?.cached,
                usage: result?.usage || null
            });
            throw routeErr;
        }
        if (!parsed) {
            const routeErr = new Error('Context module router output was malformed. Please retry.');
            recordContextRouteDebug(db, character, 'event', String(content || ''), {
                context_type: 'context_module_router',
                error: true,
                recent_input: text,
                model,
                endpoint,
                reason: 'router_output_malformed',
                finishReason,
                cached: !!result?.cached,
                usage: result?.usage || null
            });
            throw routeErr;
        }
        const resolvedRoutes = {
            city_detail: parsed.city_detail === 1 ? 1 : defaultRoutes.city_detail,
            school_detail: parsed.school_detail === 1 ? 1 : defaultRoutes.school_detail,
            society_detail: parsed.society_detail === 1 ? 1 : defaultRoutes.society_detail
        };
        recordContextRouteDebug(db, character, 'output', String(content || ''), {
            context_type: 'context_module_router',
            model,
            endpoint,
            cache_type: 'context_module_router',
            parsed_routes: resolvedRoutes,
            cached: !!result?.cached,
            finishReason,
            usage: result?.usage || null
        });
        return resolvedRoutes;
    } catch (e) {
        console.warn('[ContextBuilder] Module router failed:', e.message);
        recordContextRouteDebug(db, character, 'event', dependencies.previewText(e.message, 400), {
            context_type: 'context_module_router',
            error: true,
            recent_input: text,
            model,
            endpoint,
            reason: e.message || 'unknown_error'
        });
        throw e;
    }
}

    return { recordContextRouteDebug, parseModuleRouteJson, isValidModuleRoutePayload, buildRecentPrivateRouteContext, routeContextModules };
}

module.exports = { createModule };
