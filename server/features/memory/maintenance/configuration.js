// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function buildMemoryMigrationPrompt(character, batch, options = {}) {
    const batchSize = Array.isArray(batch?.items) ? batch.items.length : 0;
    const fields = ['id', 'memory_card_text', 'focus', 'tier', 'importance', 'calls', 'score', 'forget_in_days', 'action', 'time', 'source_time_text', 'source_context', 'scene_tag'];
    const compactItems = (batch?.items || []).map(item => ([
        item.id,
        dependencies.clipMemoryDisplayText(item.summary || item.content || item.event || '', 120),
        item.current?.memory_focus || 'general',
        item.current?.memory_tier || 'ambient',
        Number(item.current?.importance || 5),
        Number(item.signals?.retrieval_count || 0),
        Number(item.retention?.retention_score ?? item.current?.retention_score ?? 1),
        item.retention?.days_until_threshold ?? null,
        item.current?.retention_action || item.retention?.suggested_action || 'keep',
        item.signals?.time || '',
        item.signals?.source_time_text || '',
        item.current?.source_context || 'private_chat',
        item.current?.scene_tag || 'private_chat'
    ]));
    const source = {
        input_kind: 'old_memory_card_compact_rows',
        input_note: 'Rows are model-extracted memory cards from ChatPulse or imported apps such as GPT/Gemini/SillyTavern, not raw chat/log source text and not embedding index text.',
        character: { id: character?.id || '', name: character?.name || '' },
        fields,
        rows: compactItems,
        next_after_id: batch?.next_after_id || 0,
        remaining_pending: batch?.remaining_pending || 0
    };
    const systemPrompt = `你是 ChatPulse 记忆库迁移与时间标签小模型。输入是“旧记忆卡片/外部 App 导入记忆的紧凑概况”，不是原始对话/日志，也不是 embedding 索引文本。你只做卡片级整理：去噪、合并、拆分、分类、给迁移建议，并为新记忆判断时间绑定标签。不要聊天、不要扩写、不要猜测。所有面向用户的自然语言字段必须输出简体中文，即使输入记忆卡片是英文；枚举值和 consolidation_key 保持英文机器格式。只输出合法 JSON；不要输出思考过程、解释、Markdown 或代码块。输出必须以 { 开始、以 } 结束。`;
    const userPrompt = `任务：把本批旧记忆卡片或外部 App 导入记忆迁移为新版记忆库条目，并同时给每条新记忆打时间标签。30 条卡片不是总结成 1 条，而是去噪、拆分、合并后输出若干条可召回的原子记忆。每个输入 id 都必须有明确去向：要么被某条 new_memories.source_ids 覆盖，要么出现在 old_memory_actions 里；不要无声忽略任何输入卡片。

分类：user_profile=用户长期画像；relationship=用户与当前角色关系；user_current_arc=近期阶段/任务/压力；general=普通事件。
来源/场景：source_context 表示记忆从哪里来，只能是 private_chat、group_chat、commercial_street、external_app、unknown；scene_tag 表示场景/来源细分，只能是 none、private_chat、group_chat、commercial_street、external_gpt、external_gemini、external_sillytavern、external_app、other。商业街、群聊和外部 App 不要新增为 memory_focus，而是写在 source_context/scene_tag。
层级：core=身份/人格/长期关系/强边界，慎用；active=当前有用但会过期；ambient=低价值背景。
语言：summary、reason 等自然语言字段统一用简体中文；可以保留 Claude、GPT、API、Qdrant、地名、人名等专有名词原文；consolidation_key 必须是英文 snake_case。
规则：只基于输入卡片概况；不要假装读过原始对话；同义重复合并；一条新记忆只写一个事实；冲突/敏感/不确定用 needs_review；明确无后续价值的噪声/一次性闲聊才 archive；summary 不写“本批/多条记忆显示”。用户临时身体/情绪状态保留在原语义分类中，不新增分类；除非卡片明确表示长期、反复、慢性或稳定偏好，否则不要写成 user_profile。临时状态有明确日期、当天、近期等时间锚时，summary 要保留这个时间锚。
保留角色记忆：不要因为内容是“角色自己的经历/状态/商业街生活/对用户的反应”就默认当成无用。只要它体现当前角色的持续状态、重要经历、任务进展、健康/金钱风险、对用户的关系变化、稳定偏好或会影响未来互动，就必须 create 或 merge_create。只有纯流水账、失败输出、系统提示、重复片段、没有后续影响的一次性动作才 archive。
表述规则：summary 是给主模型召回的正式记忆，不是元叙事备注。不要用“在角色扮演中”“角色扮演里”“在设定中”“剧情中”“扮演时”等前缀包装普通事件；除非输入卡片明确讨论“角色扮演机制/元矛盾/扮演规则”本身，否则直接写成“${character?.name || '当前对象'}……”。如果必须表达元层冲突，用“互动语境/对话语境/元层矛盾”，不要把普通经历都说成角色扮演。
主语判定（非常重要）：
- “用户/Nana”只指真实用户；“${character?.name || '当前对象'} / 当前对象 / 当前角色本人”指本角色本人。这里的“角色”只是数据库对象，不等于 roleplay。
- commercial_street / 商业街 / city 活动 / 工厂 / 餐厅 / 便利店 / 公园 / 回家 / 领工钱 / 日结等第一人称生活日志，默认是 ${character?.name || '当前对象'} 自己在商业街发生的事，不是用户做的事。summary 必须写“${character?.name || '当前对象'}……”，不能写“用户……”，也不能额外加“在角色扮演中”。
- source_context="commercial_street" 的硬前提：主语必须是第一人称商业街生活日志、当前角色本人，或可明确还原为当前角色本人。只要这条新记忆的主语是“用户/Nana/User”（例如用户开发游戏、读博实习、现实工作压力、现实身体状态），就禁止标 commercial_street；即使文本提到“商业街”、可视化商业街、或本批 source_ids 混有 city:，也只能按内容标 private_chat 或 unknown。
- 只有输入卡片明确写“用户/Nana/User”做了某事时，summary 才能以用户为主语。
- ${character?.name || '当前对象'} 在商业街的工作、吃饭、休息、受伤、赚钱、回家等经历，不要归为 user_profile 或 user_current_arc；通常用 general，只有直接改变用户与 ${character?.name || '当前对象'} 关系时才用 relationship。
动作：create, merge_create, archive, needs_review, skip_duplicate。

时间标签规则：
- 只有记忆内容依赖时间语境时才标 is_time_bound=true；不要因为有来源日期就强行标。
- 临时身体/情绪/地点/计划/阶段/周期性状态必须打时间标签，例如今天焦虑、最近赶 ddl、明天面试、这次状态变化。
- 长期身份、长期偏好、长期关系边界、稳定目标通常 is_time_bound=false。
- 如果输入来自 GPT/Gemini/SillyTavern 等外部导出，可能只有概况没有来源时间；不能补造日期，只能写“未明确”或从卡片文字中抽取。

输出 JSON：
{
  "new_memories": [
    {
      "action": "create | merge_create",
      "source_ids": [123],
      "summary": "短而清楚的中文新记忆",
      "memory_focus": "user_profile | relationship | user_current_arc | general",
      "memory_tier": "core | active | ambient",
      "source_context": "private_chat | group_chat | commercial_street | external_app | unknown",
      "scene_tag": "none | private_chat | group_chat | commercial_street | external_gpt | external_gemini | external_sillytavern | external_app | other",
      "importance": 1-10,
      "consolidation_key": "english_snake_case_key",
      "reason": "一句中文理由",
      "time_binding": {
        "is_time_bound": true,
        "label": "temporary_body_state | temporary_emotion | deadline_or_plan | temporary_location | recent_phase | single_event_state | cyclic_state | other",
        "scope": "single_day | recent_period | until_event_end | cyclic | unknown",
        "time_anchor": "今天 / 2026-05-22 / 最近几天 / 明天汇报前 / 未明确",
        "confidence": 0.0-1.0,
        "reason": "一句中文理由"
      }
    }
  ],
  "old_memory_actions": [
    {
      "id": 123,
      "action": "archive | needs_review | skip_duplicate",
      "reason": "一句中文理由"
    }
  ]
}

约束：new_memories 通常 3-12 条；source_ids 必须来自输入卡片 id；importance 是整数；不确定就 needs_review；非时间绑定记忆的 time_binding 写 {"is_time_bound":false,"label":"","scope":"","time_anchor":"","confidence":0,"reason":"长期或不依赖时间语境"}；如果本批没有可迁移内容，也必须把所有输入 id 放进 old_memory_actions，并说明 archive/needs_review/skip_duplicate 的理由。禁止返回空 JSON 导致输入 id 没有去向。

输入旧记忆/外部导入记忆卡片 JSON（紧凑数组；fields 对应 rows 每一列；不含原始对话/日志，不含 embedding 索引文本）：
${JSON.stringify(source)}`;
    return {
        version: 'memory-card-migration-time-tags-v9',
        target: 'old-or-external-memory-card-batch-to-new-library-with-time-tags',
        batch_size: batchSize,
        model_name: options.model_name || '',
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        full_prompt: `${systemPrompt}\n\n---\n\n${userPrompt}`
    };
}

function extractJsonObjectFromText(text = '') {
    const raw = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    if (!raw) {
        const error = new Error('小模型没有返回 JSON 对象，后端找不到完整的 { ... }。');
        error.code = 'small_model_json_missing';
        error.payload = { raw_response: raw };
        throw error;
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            const error = new Error('小模型返回的 JSON 不是对象。');
            error.code = 'small_model_invalid_json';
            error.payload = { raw_response: raw, json_preview: dependencies.clipMemoryDisplayText(raw, 1600) };
            throw error;
        }
        return parsed;
    } catch (e) {
        if (e?.code === 'small_model_invalid_json') throw e;
        const error = new Error(`小模型返回的 JSON 格式不合法：${e.message}`);
        error.code = 'small_model_invalid_json';
        error.payload = { raw_response: raw, json_preview: dependencies.clipMemoryDisplayText(raw, 1600) };
        throw error;
    }
}

function normalizeSmallModelMigrationResult(parsed = {}, knownIds = []) {
    const idSet = new Set((knownIds || []).map(id => Number(id || 0)).filter(Boolean));
    const applyItems = [];
    const errors = [];
    const newMemories = Array.isArray(parsed.new_memories) ? parsed.new_memories : [];
    const oldActions = Array.isArray(parsed.old_memory_actions) ? parsed.old_memory_actions : [];

    for (const mem of newMemories) {
        const sourceIds = Array.isArray(mem?.source_ids) ? mem.source_ids.map(id => Number(id || 0)).filter(id => idSet.has(id)) : [];
        if (sourceIds.length === 0) {
            errors.push({ error: 'new_memory missing valid source_ids', memory: mem });
            continue;
        }
        const action = String(mem.action || '').trim() === 'create' ? 'keep' : 'merge_candidate';
        const summary = String(mem.summary || '').trim();
        if (!summary || !dependencies.hasCjkText(summary)) {
            errors.push({ error: 'new_memory summary must be Simplified Chinese', memory: mem });
            continue;
        }
        const reason = String(mem.reason || '').trim();
        const sourceContext = String(mem.source_context || '').trim();
        const sceneTag = String(mem.scene_tag || '').trim();
        if (sourceContext && !dependencies.MEMORY_SOURCE_CONTEXTS.has(sourceContext)) {
            errors.push({ error: `Invalid source_context: ${sourceContext}`, memory: mem });
            continue;
        }
        if (sceneTag && !dependencies.MEMORY_SCENE_TAGS.has(sceneTag)) {
            errors.push({ error: `Invalid scene_tag: ${sceneTag}`, memory: mem });
            continue;
        }
        const timeBinding = mem.time_binding && typeof mem.time_binding === 'object' ? mem.time_binding : {};
        const isTimeBound = timeBinding.is_time_bound === true;
        const temporalLabel = isTimeBound ? String(timeBinding.label || '').trim() : '';
        const temporalScope = isTimeBound ? String(timeBinding.scope || '').trim() : '';
        if (temporalLabel && !dependencies.MEMORY_TEMPORAL_BINDING_LABELS.has(temporalLabel)) {
            errors.push({ error: `Invalid temporal label: ${temporalLabel}`, memory: mem });
            continue;
        }
        if (temporalScope && !dependencies.MEMORY_TEMPORAL_BINDING_SCOPES.has(temporalScope)) {
            errors.push({ error: `Invalid temporal scope: ${temporalScope}`, memory: mem });
            continue;
        }
        for (const id of sourceIds) {
            applyItems.push({
                id,
                memory_focus: mem.memory_focus,
                memory_tier: mem.memory_tier,
                importance: mem.importance,
                source_context: sourceContext,
                scene_tag: sceneTag,
                maintenance_status: 'classified',
                retention_action: action,
                retention_reason: (dependencies.hasCjkText(reason) ? reason : '小模型未提供中文理由。').slice(0, 500),
                consolidation_key: String(mem.consolidation_key || '').slice(0, 240),
                consolidation_summary: summary.slice(0, 1000),
                temporal_label: temporalLabel,
                temporal_scope: temporalScope,
                temporal_anchor: isTimeBound ? String(timeBinding.time_anchor || '').trim().slice(0, 120) : '',
                temporal_confidence: isTimeBound ? dependencies.clampNumber(timeBinding.confidence, 0.5, 0, 1) : 0,
                temporal_reason: isTimeBound
                    ? (dependencies.hasCjkText(timeBinding.reason) ? String(timeBinding.reason || '') : '小模型未提供中文理由。').slice(0, 500)
                    : ''
            });
        }
    }

    for (const action of oldActions) {
        const id = Number(action?.id || 0);
        if (!idSet.has(id)) {
            errors.push({ error: 'old_memory_action id is not in this batch', item: action });
            continue;
        }
        const rawAction = String(action.action || '').trim();
        const mappedAction = rawAction === 'archive'
            ? 'archive_candidate'
            : (rawAction === 'skip_duplicate' ? 'superseded' : 'needs_review');
        applyItems.push({
            id,
            maintenance_status: rawAction === 'skip_duplicate' ? 'ignored' : 'needs_review',
            retention_action: mappedAction,
            retention_reason: (dependencies.hasCjkText(action.reason) ? String(action.reason || '') : '小模型未提供中文理由。').slice(0, 500)
        });
    }

    const merged = new Map();
    for (const item of applyItems) {
        const id = Number(item.id || 0);
        merged.set(id, { ...(merged.get(id) || {}), ...item, id });
    }
    for (const id of idSet) {
        if (merged.has(id)) continue;
        merged.set(id, {
            id,
            maintenance_status: 'needs_review',
            retention_action: 'needs_review',
            retention_reason: '小模型未覆盖这条输入记忆，保留人工复核，避免静默漏迁移。'
        });
        errors.push({ id, error: 'Small model omitted this input memory; marked needs_review instead of leaving pending.' });
    }
    return {
        applyItems: Array.from(merged.values()),
        errors,
        newMemories,
        oldActions
    };
}

function getMemoryMaintenanceSettings(db) {
    const profile = db.getUserProfile?.() || {};
    return {
        api_endpoint: profile.memory_maintenance_api_endpoint || '',
        api_key: profile.memory_maintenance_api_key || '',
        model_name: profile.memory_maintenance_model_name || '',
        batch_size: Math.max(10, Math.min(100, Number(profile.memory_maintenance_batch_size || 30) || 30)),
        max_output_tokens: Math.max(1000, Math.min(20000, Number(profile.memory_maintenance_max_tokens || 8000) || 8000))
    };
}

function redactMemoryMaintenanceSettings(settings = {}) {
    const apiKey = String(settings.api_key || '').trim();
    return {
        ...settings,
        api_key: apiKey ? `••••${apiKey.slice(-4)}` : '',
        api_key_configured: !!apiKey,
        api_key_last4: apiKey ? apiKey.slice(-4) : ''
    };
}

function updateMemoryMaintenanceSettings(db, body = {}) {
    const currentSettings = getMemoryMaintenanceSettings(db);
    const safeBody = { ...(body || {}) };
    if (dependencies.isMaskedSecretInput(safeBody.api_key) && currentSettings.api_key) {
        delete safeBody.api_key;
    }
    const patch = dependencies.normalizeMemoryMaintenanceSettingsPatch(safeBody);
    db.updateUserProfile?.(patch);
    return getMemoryMaintenanceSettings(db);
}

    return { buildMemoryMigrationPrompt, extractJsonObjectFromText, normalizeSmallModelMigrationResult, getMemoryMaintenanceSettings, redactMemoryMaintenanceSettings, updateMemoryMaintenanceSettings };
}

module.exports = { createModule };
