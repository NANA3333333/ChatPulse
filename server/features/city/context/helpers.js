// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function didUserAskAboutCity(db, character, recentInput = '') {
    const text = String(recentInput || '').trim();
    if (!text) return false;

    const endpoint = character?.memory_api_endpoint || character?.api_endpoint || '';
    const key = character?.memory_api_key || character?.api_key || '';
    const model = character?.memory_model_name || character?.model_name || '';
    if (!endpoint || !key || !model) {
        dependencies.recordContextRouteDebug(db, character, 'event', 'City intent routing skipped: missing model config.', {
            context_type: 'semantic_city_intent',
            skipped: true,
            reason: 'missing_model_config',
            recent_input: text
        });
        return false;
    }

    const judgePrompt = [
        '判断用户这句话是不是在问角色的“商业街/真实生活内容”。',
        '这里的“商业街/真实生活内容”不只包括去了哪，也包括角色最近做了什么、吃了什么、忙什么、为什么累/饿/困/没回消息、住院/输液/看病、收到或送出礼物、当前现实处境和拟人状态来源。',
        '只要用户在追问角色现实生活中的经历、行动、处境、身体状态来源、礼物流转、最近现实轨迹，回答 YES。',
        '只有当用户纯粹是在普通安抚、调情、观点讨论、抽象情绪确认、闲聊，而且不需要借助现实生活记录解释时，才回答 NO。',
        '只能输出 YES 或 NO。'
    ].join('\n');

    dependencies.recordContextRouteDebug(db, character, 'input', {
        recent_input: text,
        judge_prompt: judgePrompt
    }, {
        context_type: 'semantic_city_intent',
        model,
        endpoint,
        cache_type: 'semantic_city_intent'
    });

    try {
        const result = await dependencies.callLLM({
            endpoint,
            key,
            model,
            messages: [
                { role: 'system', content: judgePrompt },
                { role: 'user', content: text }
            ],
            maxTokens: dependencies.CONTEXT_ROUTER_MAX_TOKENS,
            temperature: 0,
            enableCache: true,
            cacheDb: db,
            cacheType: 'semantic_city_intent',
            cacheTtlMs: 12 * 60 * 60 * 1000,
            cacheScope: `character:${character?.id || ''}`,
            cacheCharacterId: character?.id || '',
            cacheKeyExtra: 'v5',
            cacheKeyMode: 'exact',
            returnUsage: true
        });
        const content = typeof result === 'string' ? result : result?.content;
        const normalizedContent = String(content || '').trim();
        const finishReason = String(result?.finishReason || '').trim();
        if (finishReason === 'length') {
            const routeErr = new Error('Semantic city intent output was truncated. Please retry.');
            dependencies.recordContextRouteDebug(db, character, 'event', normalizedContent, {
                context_type: 'semantic_city_intent',
                error: true,
                recent_input: text,
                model,
                endpoint,
                reason: 'semantic_city_intent_truncated',
                finishReason,
                cached: !!result?.cached,
                usage: result?.usage || null
            });
            throw routeErr;
        }
        if (!/^(yes|no)\b/i.test(normalizedContent)) {
            const routeErr = new Error('Semantic city intent output was malformed. Please retry.');
            dependencies.recordContextRouteDebug(db, character, 'event', normalizedContent, {
                context_type: 'semantic_city_intent',
                error: true,
                recent_input: text,
                model,
                endpoint,
                reason: 'semantic_city_intent_malformed',
                finishReason,
                cached: !!result?.cached,
                usage: result?.usage || null
            });
            throw routeErr;
        }
        const decision = /^yes\b/i.test(normalizedContent);
        dependencies.recordContextRouteDebug(db, character, 'output', String(content || ''), {
            context_type: 'semantic_city_intent',
            model,
            endpoint,
            cache_type: 'semantic_city_intent',
            decision,
            cached: !!result?.cached,
            finishReason,
            usage: result?.usage || null
        });
        return decision;
    } catch (e) {
        console.warn('[ContextBuilder] City intent model fallback failed:', e.message);
        dependencies.recordContextRouteDebug(db, character, 'event', dependencies.previewText(e.message, 400), {
            context_type: 'semantic_city_intent',
            error: true,
            recent_input: text,
            model,
            endpoint,
            reason: e.message || 'unknown_error'
        });
        throw e;
    }
}

function formatOtherCityLogForContext(log, currentCharacter) {
    const message = String(log?.message || log?.content || '').replace(/\s+/g, ' ').trim();
    if (!message) return '';

    const actorId = String(log?.character_id || '').trim();
    const currentId = String(currentCharacter?.id || '').trim();
    const actorName = String(log?.char_name || log?.character_name || '').trim();
    const actionType = String(log?.action_type || '').trim();
    const location = String(log?.location || '').trim();
    const meta = [actionType ? `类型=${actionType}` : '', location ? `地点=${location}` : ''].filter(Boolean).join(' | ');

    if (!actorId || actorId.toLowerCase() === 'system') {
        return `${meta ? `[${meta}] ` : ''}${message}`;
    }

    const resolvedActor = actorName || actorId;
    if (actorId === currentId) {
        return `${meta ? `[${meta}] ` : ''}${message}`;
    }

    return `【${resolvedActor} 的经历，不是你；下面原文里的“我”都指 ${resolvedActor}】${meta ? `[${meta}] ` : ''}${message}`;
}

function buildCitySceneChatGuidance(db, character, isGroupContext) {
    if (!character?.city_status || character.city_status === 'idle') return '';

    const district = db.city?.getDistrict ? db.city.getDistrict(character.location) : null;
    const districtName = district?.name || character.location || '当前地点';
    const districtEmoji = district?.emoji || '';
    const locationLabel = `${districtEmoji}${districtName}`.trim();
    const workDistraction = Number(character.work_distraction || 0);
    const sleepDisruption = Number(character.sleep_disruption || 0);

    let prompt = '\n[当前生活场景]\n';

    if (character.city_status === 'working') {
        prompt += `地点=${locationLabel}；状态=工作中。`;
        if (!isGroupContext) {
            prompt += ` 当前分心值=${workDistraction}/100。`;
        }
    } else if (character.city_status === 'sleeping') {
        prompt += `地点=${locationLabel}；状态=休息/补觉。`;
        if (!isGroupContext) {
            prompt += ` 当前睡眠打断值=${sleepDisruption}/100。`;
        }
    } else if (character.city_status === 'eating') {
        prompt += `地点=${locationLabel}；状态=在吃东西。`;
    } else if (character.city_status === 'hungry') {
        prompt += `地点=${locationLabel}；状态=明显饥饿。`;
    } else if (character.city_status === 'medical') {
        prompt += `地点=${locationLabel}；状态=在治疗/恢复中。`;
    } else if (character.city_status === 'coma') {
        prompt += `地点=${locationLabel}；状态很差。意识发飘，身体发虚，很难真正集中起来。`;
    }

    prompt += '\n';
    return prompt;
}

function buildAvailableCityDistrictSignalGuide(db) {
    const districts = db?.city?.getEnabledDistricts ? (db.city.getEnabledDistricts() || []) : [];
    if (!Array.isArray(districts) || districts.length === 0) return '';
    const lines = districts
        .map((district) => {
            if (!district?.id) return '';
            const parts = [
                `${district.emoji || ''}${district.name || district.id}`.trim(),
                `id=${district.id}`,
                `type=${district.type || 'generic'}`
            ];
            return `- ${parts.join(' | ')}`;
        })
        .filter(Boolean);
    if (lines.length === 0) return '';
    return ['[可用商业街地点信号]', '如果你要触发 CITY_ACTION / CITY_INTENT，优先从下面这些真实地点里选，不要自己编地点名。', ...lines].join('\n');
}

function ensureContextCityDb(db) {
    if (!db || db.city) return db?.city || null;
    try {
        const initCityDb = require("../cityDb.js");
        db.city = initCityDb(typeof db.getRawDb === 'function' ? db.getRawDb() : db);
    } catch (e) {
        return null;
    }
    return db.city || null;
}

function getInventoryContextSourceParts(db, character) {
    const cityDb = ensureContextCityDb(db);
    const limit = Number(cityDb?.getInventorySlotLimit?.() || 10);
    const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 10;
    let inventory = [];
    try {
        inventory = cityDb?.getInventory?.(character.id) || [];
    } catch (e) {
        inventory = [];
    }
    return {
        limit: safeLimit,
        slots: inventory.length,
        total_quantity: inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0),
        items: inventory.slice(0, safeLimit).map(item => {
            const quantity = Math.max(0, Number(item.quantity || 0));
            const giftedQty = Math.min(quantity, Math.max(0, Number(item.user_gifted_quantity || item.gifted_quantity || 0)));
            return {
                item_id: String(item.item_id || item.id || '').trim(),
                name: String(item.name || '').trim(),
                emoji: String(item.emoji || '').trim(),
                category: String(item.category || '').trim(),
                quantity,
                user_gifted_quantity: giftedQty,
                cal_restore: Number(item.cal_restore || 0)
            };
        })
    };
}

function formatInventoryContextItem(item = {}) {
    const quantity = Math.max(0, Number(item.quantity || 0));
    const giftedQty = Math.min(quantity, Math.max(0, Number(item.user_gifted_quantity || 0)));
    const giftText = giftedQty > 0 ? `，用户送的x${giftedQty}` : '';
    const calText = Number(item.cal_restore || 0) > 0 ? `，+${Number(item.cal_restore)}体力` : '';
    return `${item.emoji || ''}${item.name || item.item_id || '物品'}x${quantity}${giftText}${calText}`;
}

function buildInventoryContextBlock(snapshot = {}) {
    const limit = Number(snapshot.limit || 10);
    const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 10;
    const slots = Math.max(0, Number(snapshot.slots || 0));
    const totalQuantity = Math.max(0, Number(snapshot.total_quantity ?? slots));
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const itemText = items.length ? items.map(formatInventoryContextItem).join('、') : '空';
    const overflowText = slots > safeLimit ? `\n- 只展示前 ${safeLimit} 行物品，剩余 ${slots - safeLimit} 行不展开。` : '';
    const fullText = totalQuantity > safeLimit
        ? '\n- 背包超重：物品总数超过 10 件时，必须立刻把一轮商业街活动用于整理背包；你只能保留 10 件物品，其他由你自己处理。'
        : '';
    return `[角色当前背包（你自己）]: ${totalQuantity}/${safeLimit} 件物品；同一种物品合并显示，但数量都计入总数。\n- 背包物品: ${itemText}${overflowText}\n- 用户送的物品会标注“用户送的”；它们对关系更敏感，处理前要更慎重。\n- 你要控制背包数量，不要无限囤货。${fullText}\n`;
}

    return { didUserAskAboutCity, formatOtherCityLogForContext, buildCitySceneChatGuidance, buildAvailableCityDistrictSignalGuide, ensureContextCityDb, getInventoryContextSourceParts, formatInventoryContextItem, buildInventoryContextBlock };
}

module.exports = { createModule };
