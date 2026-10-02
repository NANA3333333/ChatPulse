// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getExternalSourceAppLabel(sourceApp = '') {
    return dependencies.externalSourceAppLabelResolver(sourceApp);
}

function buildMemoryTemporalBindingPayload(row, source = 'new') {
    const legacyText = row.summary || row.content || row.event || '';
    const primaryText = row.consolidation_summary || legacyText;
    const sourceContext = dependencies.inferMemorySourceContext(row);
    const sceneTag = dependencies.inferMemorySceneTag(row, sourceContext);
    const sourceIds = String(row.source_ids || row.id || '')
        .split(',')
        .map(id => Number(id || 0))
        .filter(id => id > 0);
    return {
        id: row.id,
        source_ids: sourceIds.length ? sourceIds : [Number(row.id || 0)].filter(Boolean),
        source_count: Number(row.source_count || sourceIds.length || 1),
        text: dependencies.clipMemoryDisplayText(primaryText, 180),
        source_card_text: dependencies.clipMemoryDisplayText(legacyText, 120),
        current: {
            memory_focus: row.memory_focus || 'general',
            memory_tier: row.memory_tier || 'ambient',
            importance: Number(row.importance || 5),
            maintenance_status: row.maintenance_status || 'pending',
            consolidation_key: row.consolidation_key || '',
            has_consolidation_summary: !!String(row.consolidation_summary || '').trim(),
            source_context: sourceContext,
            scene_tag: sceneTag,
            source_app: row.source_app || '',
            temporal_label: row.temporal_label || '',
            temporal_scope: row.temporal_scope || '',
            temporal_anchor: row.temporal_anchor || ''
        },
        signals: {
            time: row.time || '',
            source_time_text: row.source_time_text || '',
            source_started_at: Number(row.source_started_at || 0),
            source_ended_at: Number(row.source_ended_at || 0),
            created_at: Number(row.created_at || 0),
            updated_at: Number(row.updated_at || 0),
            retrieval_count: Number(row.retrieval_count || 0)
        }
    };
}

function getMemoryTemporalBindingBatch(rawDb, characterId, options = {}) {
    const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions(options, { limitFallback: 40 });
    const limit = batchOptions.limit;
    const offset = batchOptions.offset;
    const source = normalizeMemoryTemporalBindingSource(options.source || 'new');
    const includeArchived = !!options.include_archived;
    const where = ['character_id = ?'];
    const params = [characterId];
    if (!includeArchived) where.push('COALESCE(is_archived, 0) = 0');
    where.push("COALESCE(NULLIF(consolidation_summary, ''), '') <> ''");
    if (source === 'new_temporal_signal') {
        where.push(getMemoryTemporalSignalSql());
        params.push(...getMemoryTemporalSignalParams());
    }
    const formalGroupExpr = "COALESCE(NULLIF(consolidation_key, ''), '') || '::' || LOWER(TRIM(COALESCE(consolidation_summary, '')))";
    const totalMatching = rawDb.prepare(`
        SELECT COUNT(*) AS count
        FROM (
            SELECT 1
            FROM memories
            WHERE ${where.join(' AND ')}
            GROUP BY ${formalGroupExpr}
        ) formal_groups
    `).get(...params)?.count || 0;
    const rows = rawDb.prepare(`
        WITH eligible AS (
            SELECT *,
                   ${formalGroupExpr} AS formal_group_key,
                   COALESCE(NULLIF(source_ended_at, 0), NULLIF(source_started_at, 0), NULLIF(created_at, 0), id) AS formal_sort_at
            FROM memories
            WHERE ${where.join(' AND ')}
        ),
        grouped AS (
            SELECT formal_group_key,
                   MAX(formal_sort_at) AS formal_sort_at,
                   COUNT(*) AS source_count,
                   GROUP_CONCAT(id) AS source_ids
            FROM eligible
            GROUP BY formal_group_key
        )
        SELECT e.*, g.source_count, g.source_ids, g.formal_sort_at
        FROM grouped g
        JOIN eligible e ON e.id = (
            SELECT e2.id
            FROM eligible e2
            WHERE e2.formal_group_key = g.formal_group_key
            ORDER BY e2.formal_sort_at DESC, e2.id DESC
            LIMIT 1
        )
        ORDER BY g.formal_sort_at DESC, e.id DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    return {
        source,
        items: rows.map(row => buildMemoryTemporalBindingPayload(row, source)),
        offset,
        batch_index: Math.floor(offset / limit) + 1,
        total_matching: Number(totalMatching || 0),
        total_batches: Math.max(0, Math.ceil(Number(totalMatching || 0) / limit))
    };
}

function buildMemoryTemporalBindingPrompt(character, batch, options = {}) {
    const batchSize = Array.isArray(batch?.items) ? batch.items.length : 0;
    const fields = [
        'id',
        'memory_text',
        'source_card_text',
        'source_count',
        'focus',
        'tier',
        'importance',
        'calls',
        'time',
        'source_time_text',
        'source_context',
        'scene_tag'
    ];
    const compactItems = (batch?.items || []).map(item => ([
        item.id,
        item.text || '',
        item.source_card_text || '',
        Number(item.source_count || 1),
        item.current?.memory_focus || 'general',
        item.current?.memory_tier || 'ambient',
        Number(item.current?.importance || 5),
        Number(item.signals?.retrieval_count || 0),
        item.signals?.time || '',
        item.signals?.source_time_text || '',
        item.current?.source_context || 'private_chat',
        item.current?.scene_tag || 'private_chat'
    ]));
    const source = {
        input_kind: 'memory_temporal_binding_compact_rows',
        input_note: 'Rows are memory cards or migrated memory summaries, not raw chat/log source text and not embedding index text.',
        character: { id: character?.id || '', name: character?.name || '' },
        source_scope: batch?.source || 'new',
        fields,
        rows: compactItems,
        batch_index: batch?.batch_index || 1,
        total_batches: batch?.total_batches || 0,
        total_matching: batch?.total_matching || 0
    };
    const systemPrompt = `你是 ChatPulse 记忆库来源场景与时间标签小模型。输入是已经存在的记忆卡片或新版总结，不是原始对话/日志，也不是 embedding 索引文本。你只做两件事：判断每条记忆的来源/场景标签，并判断它是否和时间强绑定。不要改写记忆内容，不要改变 memory_focus，不做归纳迁移，不删除记忆。所有自然语言字段输出简体中文。只输出合法 JSON；不要输出解释、Markdown 或代码块。输出必须以 { 开始、以 } 结束。`;
    const userPrompt = `任务：给本批记忆补来源场景标签和时间标签。这个 prompt 只负责标注，不负责总结、合并、分类或写新记忆。商业街、群聊、外部 App 是 source_context/scene_tag，不是 memory_focus。

来源/场景标签规则：
- source_context 只能是：private_chat、group_chat、commercial_street、external_app、unknown。
- scene_tag 只能是：none、private_chat、group_chat、commercial_street、external_gpt、external_gemini、external_sillytavern、external_app、other。
- 商业街活动、商业街行动、city: 来源、街区/餐厅/便利店/公园/工厂等商业街生活记录，标 commercial_street。
- commercial_street 的主语必须是第一人称商业街生活日志、当前角色本人，或可明确还原为当前角色本人。主语是“用户/Nana/User”的记忆禁止标 commercial_street；用户开发游戏、读博实习、现实工作压力、现实身体状态，即使文本提到商业街或混有 city: source_id，也按内容标 private_chat 或 unknown。
- 群聊、group_id、多人对话、群成员互动，标 group_chat。
- GPT、Gemini、SillyTavern 等外部 App 导入记忆，source_context 标 external_app，scene_tag 按 external_gpt/external_gemini/external_sillytavern 细分；不能判断具体 App 就用 external_app。
- 私聊记忆标 private_chat；当前版本不使用日记/动态作为来源分类，如果只像日记或动态但无法归入私聊、群聊、商业街、外部 App，就用 unknown/other。

主语判定规则：
- “用户/Nana”只指真实用户；“当前角色/角色/${character?.name || '当前角色'}”指本角色。
- commercial_street / 商业街 / city 活动 / 工厂 / 餐厅 / 便利店 / 公园 / 回家 / 领工钱 / 日结等第一人称生活日志，默认是当前角色在商业街发生的事，不是用户做的事。
- source_context="commercial_street" 的硬前提：主语必须是第一人称商业街生活日志、当前角色本人，或可明确还原为当前角色本人。主语是“用户/Nana/User”的记忆，禁止标 commercial_street；即使文本提到商业街或本批 source_ids 混有 city:，也只能按内容标 private_chat 或 unknown。
- 本 prompt 只补标签，不改写文本；但判断 source_context/scene_tag 和 time_labels 时必须按上述主语理解，不要把角色的商业街行动当成用户状态。

时间强绑定包括：
- 临时状态：带有今天、这次、上次、当时、近期、阶段性、一次性等时间语境的状态变化。
- 临时情绪/压力：今天焦虑、这几天崩溃、最近压力很大、某个汇报/考试/ddl 前后的情绪。
- 临时地点/行程/任务：今天在某地、刚从某地回来、明天要做某事、短期计划或截止日期。
- 周期性但不是长期画像的状态：如果记忆明确是在说某一轮/某一次/某阶段，可以标 cyclic_state，但不能把它当成用户永远如此。

不要标为时间强绑定：
- 稳定身份、专业、长期偏好、长期关系边界、长期目标。
- 长期/反复/慢性状态，除非这条记忆明确是在说“这一次/今天/近期”的状态。
- 普通历史事件本身有来源时间，但内容不依赖这个时间仍然成立的，不要仅因为有 source_time_text 就标。

输出 JSON：
{
  "source_labels": [
    {
      "id": 123,
      "source_context": "private_chat | group_chat | commercial_street | external_app | unknown",
      "scene_tag": "none | private_chat | group_chat | commercial_street | external_gpt | external_gemini | external_sillytavern | external_app | other",
      "source_app": "GPT / Gemini / SillyTavern / 空字符串",
      "confidence": 0.0-1.0,
      "reason": "一句中文理由"
    }
  ],
  "time_labels": [
    {
      "id": 123,
      "is_time_bound": true,
      "label": "temporary_body_state | temporary_emotion | deadline_or_plan | temporary_location | recent_phase | single_event_state | cyclic_state | other",
      "scope": "single_day | recent_period | until_event_end | cyclic | unknown",
      "time_anchor": "今天 / 2026-05-22 / 最近几天 / 明天汇报前 / 未明确",
      "confidence": 0.0-1.0,
      "reason": "一句中文理由"
    }
  ],
  "needs_review": [
    {
      "id": 123,
      "reason": "为什么不确定"
    }
  ],
  "not_time_bound_ids": [456]
}

约束：id 必须来自输入；source_labels 必须尽量覆盖输入里的每条记忆；真正依赖时间语境的记忆放进 time_labels 且 is_time_bound=true；不依赖时间语境的 id 放进 not_time_bound_ids；来源或时间不确定的放进 needs_review。不要输出原文以外的新事实；如果没有时间候选，也仍然要输出 source_labels，并输出 {"time_labels":[],"needs_review":[],"not_time_bound_ids":[...]}。

输入记忆 JSON（紧凑数组；fields 对应 rows 每一列；不含原始对话/日志，不含 embedding 索引文本）：
${JSON.stringify(source)}`;
    return {
        version: 'memory-source-scene-time-label-v6',
        target: 'memory-library-source-scene-and-time-label-only',
        batch_size: batchSize,
        model_name: options.model_name || '',
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        full_prompt: `${systemPrompt}\n\n---\n\n${userPrompt}`
    };
}

function normalizeTemporalBindingResult(parsed = {}, knownIds = []) {
    const idSet = new Set((knownIds || []).map(id => Number(id || 0)).filter(Boolean));
    const sourceLabels = [];
    const candidates = [];
    const needsReview = [];
    const notTimeBoundIds = [];
    const errors = [];
    for (const item of Array.isArray(parsed.source_labels) ? parsed.source_labels : []) {
        const id = Number(item?.id || 0);
        if (!idSet.has(id)) {
            errors.push({ error: 'source_label id is not in this batch', item });
            continue;
        }
        const sourceContext = String(item.source_context || '').trim();
        const sceneTag = String(item.scene_tag || '').trim();
        const reason = String(item.reason || '').trim();
        if (!dependencies.MEMORY_SOURCE_CONTEXTS.has(sourceContext)) {
            errors.push({ id, error: `Invalid source_context: ${sourceContext}` });
            continue;
        }
        if (!dependencies.MEMORY_SCENE_TAGS.has(sceneTag)) {
            errors.push({ id, error: `Invalid scene_tag: ${sceneTag}` });
            continue;
        }
        sourceLabels.push({
            id,
            source_context: sourceContext,
            scene_tag: sceneTag,
            source_app: String(item.source_app || '').trim().slice(0, 80),
            confidence: dependencies.clampNumber(item.confidence, 0.5, 0, 1),
            reason: (dependencies.hasCjkText(reason) ? reason : '小模型未提供中文理由。').slice(0, 500)
        });
    }
    const labelItems = Array.isArray(parsed.time_labels)
        ? parsed.time_labels
        : (Array.isArray(parsed.time_bound_candidates) ? parsed.time_bound_candidates : []);
    for (const item of labelItems) {
        const id = Number(item?.id || 0);
        if (!idSet.has(id)) {
            errors.push({ error: 'time_bound_candidate id is not in this batch', item });
            continue;
        }
        if (item?.is_time_bound === false) {
            notTimeBoundIds.push(id);
            continue;
        }
        const label = String(item.label || '').trim();
        const scope = String(item.scope || '').trim();
        const reason = String(item.reason || '').trim();
        if (!dependencies.MEMORY_TEMPORAL_BINDING_LABELS.has(label)) {
            errors.push({ id, error: `Invalid temporal label: ${label}` });
            continue;
        }
        if (!dependencies.MEMORY_TEMPORAL_BINDING_SCOPES.has(scope)) {
            errors.push({ id, error: `Invalid temporal scope: ${scope}` });
            continue;
        }
        candidates.push({
            id,
            label,
            scope,
            time_anchor: String(item.time_anchor || '').trim().slice(0, 120),
            confidence: dependencies.clampNumber(item.confidence, 0.5, 0, 1),
            reason: (dependencies.hasCjkText(reason) ? reason : '小模型未提供中文理由。').slice(0, 500)
        });
    }
    for (const item of Array.isArray(parsed.needs_review) ? parsed.needs_review : []) {
        const id = Number(item?.id || 0);
        if (!idSet.has(id)) {
            errors.push({ error: 'needs_review id is not in this batch', item });
            continue;
        }
        const reason = String(item.reason || '').trim();
        needsReview.push({
            id,
            reason: (dependencies.hasCjkText(reason) ? reason : '小模型未提供中文理由。').slice(0, 500)
        });
    }
    for (const idValue of Array.isArray(parsed.not_time_bound_ids) ? parsed.not_time_bound_ids : []) {
        const id = Number(idValue || 0);
        if (idSet.has(id)) notTimeBoundIds.push(id);
        else errors.push({ error: 'not_time_bound id is not in this batch', id: idValue });
    }
    return { sourceLabels, candidates, needsReview, notTimeBoundIds: Array.from(new Set(notTimeBoundIds)), errors };
}

function buildTemporalBindingApplyItems(normalized = {}) {
    const merged = new Map();
    const ensureItem = (id) => {
        const safeId = Number(id || 0);
        if (!safeId) return null;
        if (!merged.has(safeId)) merged.set(safeId, { id: safeId });
        return merged.get(safeId);
    };
    for (const item of normalized.sourceLabels || []) {
        const target = ensureItem(item.id);
        if (!target) continue;
        target.source_context = item.source_context;
        target.scene_tag = item.scene_tag;
        target.source_app = item.source_app || '';
        target.retention_reason = item.reason || target.retention_reason || '补充来源场景标签。';
    }
    for (const item of normalized.candidates || []) {
        const target = ensureItem(item.id);
        if (!target) continue;
        target.temporal_label = item.label;
        target.temporal_scope = item.scope;
        target.temporal_anchor = item.time_anchor || '';
        target.temporal_confidence = item.confidence;
        target.temporal_reason = item.reason || '';
    }
    for (const id of normalized.notTimeBoundIds || []) {
        const target = ensureItem(id);
        if (!target) continue;
        target.temporal_label = '';
        target.temporal_scope = '';
        target.temporal_anchor = '';
        target.temporal_confidence = 0;
        target.temporal_reason = target.temporal_reason || '小模型判断这条记忆不依赖时间语境。';
    }
    for (const item of normalized.needsReview || []) {
        const target = ensureItem(item.id);
        if (!target) continue;
        target.maintenance_status = 'needs_review';
        target.retention_action = 'needs_review';
        target.retention_reason = item.reason || '来源或时间标签需要人工复核。';
    }
    return Array.from(merged.values());
}

function expandTemporalBindingApplyItemsForFormalBatch(applyItems = [], batchItems = []) {
    const sourceIdsByRepresentative = new Map();
    for (const item of Array.isArray(batchItems) ? batchItems : []) {
        const representativeId = Number(item?.id || 0);
        if (!representativeId) continue;
        const sourceIds = Array.from(new Set((Array.isArray(item.source_ids) ? item.source_ids : [representativeId])
            .map(id => Number(id || 0))
            .filter(id => id > 0)));
        sourceIdsByRepresentative.set(representativeId, sourceIds.length ? sourceIds : [representativeId]);
    }
    const merged = new Map();
    for (const item of Array.isArray(applyItems) ? applyItems : []) {
        const representativeId = Number(item?.id || 0);
        if (!representativeId) continue;
        const sourceIds = sourceIdsByRepresentative.get(representativeId) || [representativeId];
        for (const sourceId of sourceIds) {
            merged.set(sourceId, { ...item, id: sourceId });
        }
    }
    return Array.from(merged.values());
}

async function runMemoryTemporalBindingBatch(rawDb, character, settings, options = {}) {
    const characterId = character.id;
    const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions(options, {
        limitFallback: settings.batch_size || 40
    });
    const batch = getMemoryTemporalBindingBatch(rawDb, characterId, {
        limit: batchOptions.limit,
        offset: batchOptions.offset,
        source: options.source || 'new',
        include_archived: dependencies.parseBooleanFlag(options.include_archived)
    });
    if (!batch.items.length) {
        return {
            success: true,
            empty: true,
            character: { id: character.id, name: character.name },
            message: 'No new-library memories in this supplemental batch.',
            batch
        };
    }
    const prompt = buildMemoryTemporalBindingPrompt(character, batch, settings);
    const response = await dependencies.callLLM({
        endpoint: settings.api_endpoint,
        key: settings.api_key,
        model: settings.model_name,
        messages: [
            { role: 'system', content: prompt.system_prompt },
            { role: 'user', content: prompt.user_prompt }
        ],
        maxTokens: Math.max(1000, Math.min(20000, Number(settings.max_output_tokens || 8000) || 8000)),
        temperature: 0.1,
        returnUsage: true,
        responseFormat: { type: 'json_object' }
    });
    const rawText = typeof response === 'string' ? response : response.content;
    let parsed;
    try {
        parsed = dependencies.extractJsonObjectFromText(rawText);
    } catch (parseError) {
        const error = new Error(parseError.message);
        error.status = 422;
        error.payload = {
            success: false,
            error: parseError.message,
            character: { id: character.id, name: character.name },
            prompt,
            batch: {
                item_count: batch.items.length,
                ids: batch.items.map(item => item.id),
                offset: batch.offset,
                batch_index: batch.batch_index,
                total_batches: batch.total_batches
            },
            model: { name: settings.model_name, usage: response?.usage || null, finishReason: response?.finishReason || '' },
            raw_response: rawText
        };
        throw error;
    }
    const normalized = normalizeTemporalBindingResult(parsed, batch.items.map(item => item.id));
    const applyItems = buildTemporalBindingApplyItems(normalized);
    const expandedApplyItems = expandTemporalBindingApplyItemsForFormalBatch(applyItems, batch.items);
    let applyResult = { updated: 0, errors: [] };
    if (!dependencies.parseBooleanFlag(options.dry_run)) {
        applyResult = dependencies.applyMemoryMaintenanceItems(
            rawDb,
            characterId,
            expandedApplyItems,
            options.source_name || 'small-model-temporal-binding'
        );
    }
    return {
        success: true,
        empty: false,
        character: { id: character.id, name: character.name },
        dry_run: dependencies.parseBooleanFlag(options.dry_run),
        prompt,
        batch: {
            item_count: batch.items.length,
            ids: batch.items.map(item => item.id),
            offset: batch.offset,
            batch_index: batch.batch_index,
            total_matching: batch.total_matching,
            total_batches: batch.total_batches
        },
        model: { name: settings.model_name, usage: response?.usage || null, finishReason: response?.finishReason || '' },
        raw_response: rawText,
        parsed,
        normalized: {
            apply_items: applyItems,
            expanded_apply_count: expandedApplyItems.length,
            errors: normalized.errors,
            source_label_count: normalized.sourceLabels.length,
            time_label_count: normalized.candidates.length,
            not_time_bound_count: normalized.notTimeBoundIds.length,
            needs_review_count: normalized.needsReview.length
        },
        apply: applyResult,
        stats: dependencies.getMemoryMaintenanceStats(rawDb, characterId)
    };
}

function getMemoryTemporalSignalSql() {
    const haystack = [
        "COALESCE(consolidation_summary, '')",
        "COALESCE(summary, '')",
        "COALESCE(content, '')",
        "COALESCE(event, '')",
        "COALESCE(time, '')",
        "COALESCE(source_time_text, '')"
    ].join(" || ' ' || ");
    return `(${dependencies.MEMORY_TEMPORAL_SIGNAL_TERMS.map(() => `${haystack} LIKE ?`).join(' OR ')})`;
}

function getMemoryTemporalSignalParams() {
    return dependencies.MEMORY_TEMPORAL_SIGNAL_TERMS.map(term => `%${term}%`);
}

function normalizeMemoryTemporalBindingSource(value = 'new') {
    const normalized = String(value || 'new').trim().toLowerCase();
    if (normalized === 'temporal_signal' || normalized === 'new_temporal_signal') return 'new_temporal_signal';
    return 'new';
}

    return { getExternalSourceAppLabel, buildMemoryTemporalBindingPayload, getMemoryTemporalBindingBatch, buildMemoryTemporalBindingPrompt, normalizeTemporalBindingResult, buildTemporalBindingApplyItems, expandTemporalBindingApplyItemsForFormalBatch, runMemoryTemporalBindingBatch, getMemoryTemporalSignalSql, getMemoryTemporalSignalParams, normalizeMemoryTemporalBindingSource };
}

module.exports = { createModule };
