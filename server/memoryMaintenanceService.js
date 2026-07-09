const { callLLM } = require('./llm');
const {
    normalizeMemoryMaintenanceSettingsPatch,
    normalizeMemoryMaintenanceBatchOptions
} = require('./memoryInputGuards');

let externalSourceAppLabelResolver = (sourceApp = '') => String(sourceApp || '').trim() || 'External App';

function configureMemoryMaintenanceService(options = {}) {
    if (typeof options.getExternalSourceAppLabel === 'function') {
        externalSourceAppLabelResolver = options.getExternalSourceAppLabel;
    }
}

function getExternalSourceAppLabel(sourceApp = '') {
    return externalSourceAppLabelResolver(sourceApp);
}

function parseBooleanFlag(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value !== 'string') return false;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function stripBom(text) {
    return String(text || '').replace(/^\uFEFF/, '');
}

function firstImportString(...values) {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) return trimmed;
            continue;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
    }
    return '';
}

function tryParseJsonValue(text) {
    try {
        return { ok: true, value: JSON.parse(stripBom(text)) };
    } catch (e) {
        return { ok: false, error: e };
    }
}

function safeJsonParse(text, fallback) {
    const parsed = tryParseJsonValue(String(text || ''));
    return parsed.ok ? parsed.value : fallback;
}
const MEMORY_MAINTENANCE_FOCUS = new Set(['user_profile', 'user_current_arc', 'relationship', 'general']);
const MEMORY_MAINTENANCE_TIERS = new Set(['core', 'active', 'ambient']);
const MEMORY_MAINTENANCE_STATUS = new Set(['pending', 'classified', 'needs_review', 'consolidated', 'ignored']);
const MEMORY_MAINTENANCE_ACTIONS = new Set(['keep', 'downgrade', 'archive_candidate', 'merge_candidate', 'superseded', 'needs_review']);
const MEMORY_SOURCE_CONTEXTS = new Set(['private_chat', 'group_chat', 'commercial_street', 'external_app', 'unknown']);
const MEMORY_SCENE_TAGS = new Set(['none', 'private_chat', 'group_chat', 'commercial_street', 'external_gpt', 'external_gemini', 'external_sillytavern', 'external_app', 'other']);
const MEMORY_SOURCE_CONTEXT_DEFINITIONS = [
    {
        key: 'private_chat',
        label: '私聊来源',
        description: '来自用户与当前对象的一对一对话。它是来源场景，不等于 user_profile/relationship 等语义分类。'
    },
    {
        key: 'group_chat',
        label: '群聊来源',
        description: '来自群聊消息。群聊只作为来源场景显示，具体内容仍会归入用户画像、关系、当前阶段或普通事件。'
    },
    {
        key: 'commercial_street',
        label: '商业街来源',
        description: '来自商业街/city 行动、工厂、餐厅、便利店、公园、回家、日结等生活日志。默认是当前对象自己的行动。'
    },
    {
        key: 'external_app',
        label: '外部 App 来源',
        description: '来自 GPT、Gemini、SillyTavern 等外部 App 导入记忆。'
    },
    {
        key: 'unknown',
        label: '来源未明',
        description: '暂时无法判断来源场景的正式记忆，后续可用补充 prompt 再打标签。'
    }
];
const MEMORY_FORGETTING_GRACE_MS = 24 * 60 * 60 * 1000;
const MEMORY_TEMPORAL_BINDING_LABELS = new Set([
    'temporary_body_state',
    'temporary_emotion',
    'deadline_or_plan',
    'temporary_location',
    'recent_phase',
    'single_event_state',
    'cyclic_state',
    'other'
]);
const MEMORY_TEMPORAL_BINDING_SCOPES = new Set([
    'single_day',
    'recent_period',
    'until_event_end',
    'cyclic',
    'unknown'
]);
const MEMORY_TEMPORAL_SIGNAL_TERMS = [
    '今天', '昨天', '明天', '今晚', '今早', '刚刚', '刚才', '现在', '此刻', '当下',
    '近期', '最近', '这周', '本周', '这几天', '这段时间', '短期', '临时', '当天',
    '痛经', '月经', '经期', '来姨妈', '来例假', '生理期', '不舒服', '发烧', '感冒',
    '胃痛', '头痛', '失眠', '困', '疲惫', '焦虑', '崩溃', '心情', '压力',
    'today', 'yesterday', 'tomorrow', 'tonight', 'recent', 'now', 'temporary'
];

function clampNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function daysBetween(now, timestamp) {
    const safeTs = Number(timestamp || 0);
    if (!safeTs) return 0;
    return Math.max(0, (Number(now || Date.now()) - safeTs) / 86400000);
}

function getMemoryLastUsefulAt(row = {}) {
    return Number(row.last_retrieved_at || row.updated_at || row.source_ended_at || row.created_at || 0);
}

function detectRoutineCityMemory(row = {}) {
    const type = String(row.memory_type || '').toLowerCase();
    const location = String(row.location || '').toLowerCase();
    const text = [row.summary, row.content, row.event, row.location].filter(Boolean).join(' ').toLowerCase();
    if (type.startsWith('city')) return true;
    if (/^(park|restaurant|home|factory|convenience_store|school|street|mall|cafe|office|hospital)$/.test(location)) return true;
    return /(商业街|公园|餐厅|便利店|街上|散步|发呆|吃饭|回到家|在家|长椅|路灯|晚风|city activity)/i.test(text);
}

function hasProtectedMemorySignal(row = {}) {
    const focus = String(row.memory_focus || '').trim();
    const tier = String(row.memory_tier || '').trim();
    const importance = Number(row.importance || 0);
    const retrievalCount = Number(row.retrieval_count || 0);
    const text = [row.summary, row.content, row.event, row.relationships, row.people].filter(Boolean).join(' ');
    if (tier === 'core') return true;
    if (retrievalCount >= 3) return true;
    if (importance >= 8) return true;
    if (focus === 'relationship' && importance >= 6) return true;
    if (focus === 'user_profile' && importance >= 5) return true;
    return /(你要记住|不许忘|记住|承诺|约定|告白|表白|喜欢你|爱你|和好|分手|边界|秘密|密码|身份|学校|专业|家庭|长期目标)/i.test(text);
}

function computeMemoryRetention(row = {}, now = Date.now()) {
    const tier = String(row.memory_tier || 'ambient').trim();
    const focus = String(row.memory_focus || 'general').trim();
    const routineCity = detectRoutineCityMemory(row);
    const protectedMemory = hasProtectedMemorySignal(row);
    const lastUsefulAt = getMemoryLastUsefulAt(row);
    const idleDays = daysBetween(now, lastUsefulAt);
    const ageDays = daysBetween(now, Number(row.source_ended_at || row.created_at || 0));
    if (protectedMemory) {
        return {
            retention_score: 1,
            suggested_action: 'keep',
            half_life_days: null,
            idle_days: Number(idleDays.toFixed(2)),
            age_days: Number(ageDays.toFixed(2)),
            protected: true,
            routine_city: routineCity,
            reason: 'protected_by_core_relationship_profile_importance_or_retrieval'
        };
    }

    const baseHalfLife = routineCity ? 7 : ({ core: 3650, active: 60, ambient: 21 }[tier] || 21);
    const focusFactor = routineCity ? 0.4 : ({
        relationship: 2.5,
        user_profile: 2,
        user_current_arc: 0.7,
        general: 1
    }[focus] || 1);
    const importance = clampNumber(row.importance, 5, 1, 10);
    const retrievalCount = Math.max(0, Number(row.retrieval_count || 0));
    const importanceFactor = 0.6 + (importance / 10);
    const retrievalFactor = 1 + Math.min(0.8, Math.log1p(retrievalCount) / 4);
    const halfLife = Math.max(1, baseHalfLife * focusFactor * importanceFactor * retrievalFactor);
    const retention = Math.max(0, Math.min(1, Math.pow(0.5, idleDays / halfLife)));
    let suggestedAction = 'keep';
    if (retention < 0.12 && (routineCity || tier === 'ambient')) {
        suggestedAction = 'archive_candidate';
    } else if (retention < 0.25 && tier === 'ambient') {
        suggestedAction = 'archive_candidate';
    } else if (retention < 0.25 && tier === 'active') {
        suggestedAction = 'downgrade';
    } else if (retention < 0.45) {
        suggestedAction = 'needs_review';
    }
    if (focus === 'user_current_arc' && ageDays >= 60 && suggestedAction === 'keep') {
        suggestedAction = 'downgrade';
    }
    return {
        retention_score: Number(retention.toFixed(4)),
        suggested_action: suggestedAction,
        half_life_days: Number(halfLife.toFixed(2)),
        idle_days: Number(idleDays.toFixed(2)),
        age_days: Number(ageDays.toFixed(2)),
        protected: false,
        routine_city: routineCity,
        reason: `tier=${tier};focus=${focus};importance=${importance};retrieval_count=${retrievalCount}`
    };
}

function getMemoryRetentionThreshold(row = {}, retention = null) {
    const tier = String(row.memory_tier || 'ambient').trim();
    const routineCity = retention ? !!retention.routine_city : detectRoutineCityMemory(row);
    if (routineCity || tier === 'ambient') return 0.25;
    if (tier === 'active') return 0.25;
    return 0.12;
}

function computeDaysUntilRetentionThreshold(row = {}, retention = null) {
    const result = retention || computeMemoryRetention(row, Date.now());
    if (result.protected || !Number.isFinite(Number(result.half_life_days))) return null;
    const threshold = getMemoryRetentionThreshold(row, result);
    const score = Number(result.retention_score);
    const idleDays = Number(result.idle_days || 0);
    const halfLife = Number(result.half_life_days || 0);
    if (!Number.isFinite(score) || !Number.isFinite(halfLife) || halfLife <= 0) return null;
    if (score <= threshold) return 0;
    const targetIdleDays = halfLife * (Math.log(threshold) / Math.log(0.5));
    return Math.max(0, Number((targetIdleDays - idleDays).toFixed(2)));
}

function computeMemoryForgettingWindow(row = {}, retention = null, now = Date.now()) {
    const result = retention || computeMemoryRetention(row, now);
    if (result.protected || !Number.isFinite(Number(result.half_life_days))) {
        return {
            stage: 'protected',
            threshold_at: null,
            grace_started_at: null,
            grace_expires_at: null,
            days_until_threshold: null,
            days_until_grace_expires: null,
            grace_hours: 24
        };
    }
    const threshold = getMemoryRetentionThreshold(row, result);
    const halfLife = Number(result.half_life_days || 0);
    if (!Number.isFinite(halfLife) || halfLife <= 0) {
        return {
            stage: 'none',
            threshold_at: null,
            grace_started_at: null,
            grace_expires_at: null,
            days_until_threshold: null,
            days_until_grace_expires: null,
            grace_hours: 24
        };
    }
    const lastUsefulAt = getMemoryLastUsefulAt(row);
    const targetIdleDays = halfLife * (Math.log(threshold) / Math.log(0.5));
    const thresholdAt = lastUsefulAt
        ? Math.round(lastUsefulAt + targetIdleDays * 86400000)
        : Math.round(now + computeDaysUntilRetentionThreshold(row, result) * 86400000);
    const msUntilThreshold = thresholdAt - now;
    let graceStartedAt = null;
    let graceExpiresAt = thresholdAt + MEMORY_FORGETTING_GRACE_MS;
    if (msUntilThreshold <= 0) {
        const storedStartedAt = Number(row.forgetting_grace_started_at || 0);
        const storedExpiresAt = Number(row.forgetting_grace_expires_at || 0);
        graceStartedAt = storedStartedAt > 0 ? storedStartedAt : now;
        graceExpiresAt = storedExpiresAt > graceStartedAt
            ? storedExpiresAt
            : graceStartedAt + MEMORY_FORGETTING_GRACE_MS;
    }
    const msUntilGraceExpires = graceExpiresAt - now;
    const stage = msUntilThreshold > 0 ? 'approaching' : (msUntilGraceExpires > 0 ? 'grace' : 'expired');
    return {
        stage,
        threshold_at: thresholdAt,
        grace_started_at: graceStartedAt,
        grace_expires_at: graceExpiresAt,
        days_until_threshold: Math.max(0, Number((msUntilThreshold / 86400000).toFixed(2))),
        days_until_grace_expires: Number((msUntilGraceExpires / 86400000).toFixed(2)),
        grace_hours: 24
    };
}

function ensureForgettingGraceWindows(rawDb, rows = [], now = Date.now()) {
    if (!rawDb || !Array.isArray(rows) || rows.length === 0) return { started: 0, cleared: 0 };
    const columns = getTableColumnSet(rawDb, 'memories');
    if (!columns.has('forgetting_grace_started_at') || !columns.has('forgetting_grace_expires_at')) {
        return { started: 0, cleared: 0 };
    }
    const startStmt = rawDb.prepare(`
        UPDATE memories
        SET forgetting_grace_started_at = ?,
            forgetting_grace_expires_at = ?
        WHERE id = ?
          AND COALESCE(forgetting_grace_started_at, 0) = 0
    `);
    const fillExpiresStmt = rawDb.prepare(`
        UPDATE memories
        SET forgetting_grace_expires_at = ?
        WHERE id = ?
          AND COALESCE(forgetting_grace_started_at, 0) > 0
          AND COALESCE(forgetting_grace_expires_at, 0) = 0
    `);
    const clearStmt = rawDb.prepare(`
        UPDATE memories
        SET forgetting_grace_started_at = 0,
            forgetting_grace_expires_at = 0
        WHERE id = ?
          AND (COALESCE(forgetting_grace_started_at, 0) > 0 OR COALESCE(forgetting_grace_expires_at, 0) > 0)
    `);
    let started = 0;
    let cleared = 0;
    const tx = rawDb.transaction((items) => {
        for (const row of items) {
            const retention = computeMemoryRetention(row, now);
            const daysUntilThreshold = computeDaysUntilRetentionThreshold(row, retention);
            const shouldBeInGrace = !retention.protected && daysUntilThreshold !== null && Number(daysUntilThreshold) <= 0;
            const existingStartedAt = Number(row.forgetting_grace_started_at || 0);
            const existingExpiresAt = Number(row.forgetting_grace_expires_at || 0);
            if (shouldBeInGrace && existingStartedAt <= 0) {
                const expiresAt = now + MEMORY_FORGETTING_GRACE_MS;
                const info = startStmt.run(now, expiresAt, row.id);
                if (Number(info.changes || 0) > 0) {
                    row.forgetting_grace_started_at = now;
                    row.forgetting_grace_expires_at = expiresAt;
                    started += 1;
                }
            } else if (shouldBeInGrace && existingStartedAt > 0 && existingExpiresAt <= 0) {
                const expiresAt = existingStartedAt + MEMORY_FORGETTING_GRACE_MS;
                const info = fillExpiresStmt.run(expiresAt, row.id);
                if (Number(info.changes || 0) > 0) {
                    row.forgetting_grace_expires_at = expiresAt;
                }
            } else if (!shouldBeInGrace && (existingStartedAt > 0 || existingExpiresAt > 0)) {
                const info = clearStmt.run(row.id);
                if (Number(info.changes || 0) > 0) {
                    row.forgetting_grace_started_at = 0;
                    row.forgetting_grace_expires_at = 0;
                    cleared += 1;
                }
            }
        }
    });
    tx(rows);
    return { started, cleared };
}

function getExpiredForgettingMemoryRows(rawDb, options = {}) {
    if (!rawDb) return [];
    const now = Number(options.now || Date.now());
    const limit = Math.max(1, Math.min(1000, Number(options.limit || 200) || 200));
    const columns = getTableColumnSet(rawDb, 'memories');
    if (!columns.has('forgetting_grace_started_at') || !columns.has('forgetting_grace_expires_at')) {
        return [];
    }
    const rowSelect = getMemoryLibraryRowSelect(rawDb);
    const rows = rawDb.prepare(`
        SELECT ${rowSelect}
        FROM memories
        WHERE COALESCE(is_archived, 0) = 0
        ORDER BY COALESCE(NULLIF(forgetting_grace_expires_at, 0), NULLIF(updated_at, 0), NULLIF(created_at, 0), id) ASC
    `).all();
    ensureForgettingGraceWindows(rawDb, rows, now);
    return rows
        .filter(row => {
            if (Number(row.forgetting_grace_started_at || 0) <= 0) return false;
            if (Number(row.forgetting_grace_expires_at || 0) <= 0) return false;
            const retention = computeMemoryRetention(row, now);
            const daysUntilThreshold = computeDaysUntilRetentionThreshold(row, retention);
            if (retention.protected || daysUntilThreshold === null || Number(daysUntilThreshold) > 0) return false;
            return computeMemoryForgettingWindow(row, retention, now).stage === 'expired';
        })
        .sort((a, b) => Number(a.forgetting_grace_expires_at || 0) - Number(b.forgetting_grace_expires_at || 0))
        .slice(0, limit);
}

function buildMemoryMaintenancePayload(row, now = Date.now()) {
    const retention = computeMemoryRetention(row, now);
    const daysUntilThreshold = computeDaysUntilRetentionThreshold(row, retention);
    const forgettingWindow = computeMemoryForgettingWindow(row, retention, now);
    const sourceContext = inferMemorySourceContext(row);
    const sceneTag = inferMemorySceneTag(row, sourceContext);
    return {
        id: row.id,
        character_id: row.character_id,
        summary: row.summary || row.event || '',
        content: row.content || row.event || '',
        event: row.event || row.summary || '',
        current: {
            memory_type: row.memory_type || 'event',
            memory_focus: row.memory_focus || 'general',
            memory_tier: row.memory_tier || 'ambient',
            importance: Number(row.importance || 5),
            maintenance_status: row.maintenance_status || 'pending',
            retention_action: row.retention_action || '',
            retention_score: Number(row.retention_score ?? 1),
            consolidation_key: row.consolidation_key || '',
            consolidation_summary: row.consolidation_summary || '',
            source_context: sourceContext,
            scene_tag: sceneTag,
            source_app: row.source_app || '',
            temporal_label: row.temporal_label || '',
            temporal_scope: row.temporal_scope || '',
            temporal_anchor: row.temporal_anchor || ''
        },
        signals: {
            retrieval_count: Number(row.retrieval_count || 0),
            last_retrieved_at: Number(row.last_retrieved_at || 0),
            created_at: Number(row.created_at || 0),
            updated_at: Number(row.updated_at || 0),
            source_started_at: Number(row.source_started_at || 0),
            source_ended_at: Number(row.source_ended_at || 0),
            source_time_text: row.source_time_text || '',
            source_message_count: Number(row.source_message_count || 0)
        },
        retention: {
            ...retention,
            threshold: getMemoryRetentionThreshold(row, retention),
            days_until_threshold: daysUntilThreshold,
            forgetting_window: forgettingWindow
        }
    };
}

function getMemoryMaintenanceBatch(rawDb, characterId, options = {}) {
    const batchOptions = normalizeMemoryMaintenanceBatchOptions(options, { limitFallback: 30 });
    const limit = batchOptions.limit;
    const afterId = batchOptions.after_id;
    const offset = batchOptions.offset;
    const includeArchived = !!options.include_archived;
    const status = String(options.status || 'pending').trim().toLowerCase();
    const where = ['character_id = ?'];
    const params = [characterId];
    if (!includeArchived) where.push('COALESCE(is_archived, 0) = 0');
    if (afterId > 0) {
        where.push('id > ?');
        params.push(afterId);
    }
    if (status !== 'all') {
        if (status === 'pending') {
            where.push("(COALESCE(maintenance_status, '') = '' OR maintenance_status = 'pending')");
        } else if (MEMORY_MAINTENANCE_STATUS.has(status)) {
            where.push('maintenance_status = ?');
            params.push(status);
        }
    }
    const totalMatching = rawDb.prepare(`
        SELECT COUNT(*) AS count
        FROM memories
        WHERE ${where.join(' AND ')}
    `).get(...params)?.count || 0;
    const rows = rawDb.prepare(`
        SELECT *
        FROM memories
        WHERE ${where.join(' AND ')}
        ORDER BY id ASC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    const remainingPending = rawDb.prepare(`
        SELECT COUNT(*) AS count
        FROM memories
        WHERE character_id = ?
          AND COALESCE(is_archived, 0) = 0
          AND (COALESCE(maintenance_status, '') = '' OR maintenance_status = 'pending')
    `).get(characterId)?.count || 0;
    const externalPendingCount = status === 'pending' ? getExternalImportPendingCountForCharacter(rawDb, characterId) : 0;
    if (status === 'pending' && rows.length === 0) {
        const externalOffset = Math.max(0, offset - Number(totalMatching || 0));
        const externalBatch = getExternalImportMaintenanceBatch(rawDb, characterId, { limit, offset: externalOffset });
        if (externalBatch.items.length > 0) {
            return {
                ...externalBatch,
                remaining_pending: Number(remainingPending || 0) + externalPendingCount,
                total_matching: Number(totalMatching || 0) + externalPendingCount,
                total_batches: Math.max(0, Math.ceil((Number(totalMatching || 0) + externalPendingCount) / limit))
            };
        }
    }
    const now = Date.now();
    return {
        source_kind: 'legacy_memory',
        items: rows.map(row => buildMemoryMaintenancePayload(row, now)),
        next_after_id: rows.length > 0 ? rows[rows.length - 1].id : afterId,
        remaining_pending: Number(remainingPending || 0) + externalPendingCount,
        offset,
        batch_index: Math.floor(offset / limit) + 1,
        total_matching: Number(totalMatching || 0) + externalPendingCount,
        total_batches: Math.max(0, Math.ceil((Number(totalMatching || 0) + externalPendingCount) / limit))
    };
}

function normalizeExternalProcessingState(value) {
    const raw = safeJsonParse(value, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(item => {
        if (item && typeof item === 'object' && !Array.isArray(item)) return item;
        const numericId = Number(item || 0);
        return numericId > 0 ? { memory_id: numericId } : null;
    }).filter(Boolean);
}

function makeExternalProcessingKey(importId, candidateId, characterId) {
    return `${Number(importId || 0)}:${String(candidateId || '')}:${String(characterId || '')}`;
}

function getExternalSceneTag(sourceApp = '') {
    if (sourceApp === 'sillytavern') return 'external_sillytavern';
    if (sourceApp === 'gemini') return 'external_gemini';
    if (sourceApp === 'gpt') return 'external_gpt';
    return 'external_app';
}

function cleanExternalSpeakerName(value = '') {
    return String(value || '')
        .replace(/^[#@]+/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
}

function isLikelyUserSpeaker(name = '') {
    return /^(user|you|me|myself|human|nana|用户|我|自己)$/i.test(String(name || '').trim());
}

function normalizeExternalCharacterName(name = '', fallback = '') {
    const cleaned = cleanExternalSpeakerName(name || fallback)
        .replace(/[<>\[\]{}"'`]+/g, '')
        .trim();
    if (!cleaned || isLikelyUserSpeaker(cleaned)) return '';
    return cleaned.slice(0, 60);
}

function getExternalImportRows(rawDb) {
    // External app imports are now summarized directly into the new library.
    // Keep historical rows for source traceability, but do not feed them into
    // the legacy maintenance scanner again.
    return [];
}

function getExternalCharacterName(rawDb, characterId) {
    try {
        const row = rawDb.prepare('SELECT name FROM characters WHERE id = ?').get(characterId);
        return row?.name || '';
    } catch (e) {
        return '';
    }
}

function buildExternalImportPendingItems(rawDb, characterId) {
    const characterName = normalizeExternalCharacterName(getExternalCharacterName(rawDb, characterId)).toLowerCase();
    if (!characterName) return [];
    const items = [];
    for (const row of getExternalImportRows(rawDb)) {
        const selectedIds = safeJsonParse(row.selected_character_ids_json, [])
            .map(id => String(id || ''))
            .filter(Boolean);
        if (!selectedIds.includes(String(characterId))) continue;
        const state = normalizeExternalProcessingState(row.memory_ids_json);
        const processedKeys = new Set(state
            .filter(item => String(item.character_id || '') === String(characterId) && item.candidate_id)
            .map(item => item.key || makeExternalProcessingKey(row.id, item.candidate_id, characterId)));
        const summary = safeJsonParse(row.summary_json, {});
        const candidates = Array.isArray(summary.candidates) ? summary.candidates : [];
        const sourceApp = row.source_app || summary.source_app || 'external_app';
        const appLabel = getExternalSourceAppLabel(sourceApp);
        const sceneTag = getExternalSceneTag(sourceApp);
        for (const candidate of candidates) {
            const candidateNames = (Array.isArray(candidate.character_names) ? candidate.character_names : [])
                .map(name => normalizeExternalCharacterName(name).toLowerCase())
                .filter(Boolean);
            const oneToOneFallback = candidateNames.length === 0 && String(row.import_mode || '') === 'one_to_one' && selectedIds.length === 1;
            if (!candidateNames.includes(characterName) && !oneToOneFallback) continue;
            const key = makeExternalProcessingKey(row.id, candidate.id, characterId);
            if (processedKeys.has(key)) continue;
            items.push({
                importRow: row,
                candidate,
                key,
                sourceApp,
                appLabel,
                sceneTag
            });
        }
    }
    return items;
}

function getExternalImportPendingCountForCharacter(rawDb, characterId) {
    return buildExternalImportPendingItems(rawDb, characterId).length;
}

function getExternalImportPendingStatsByCharacter(rawDb) {
    let characters = [];
    try {
        characters = rawDb.prepare('SELECT id, name FROM characters ORDER BY name COLLATE NOCASE ASC').all();
    } catch (e) {
        return new Map();
    }
    const stats = new Map();
    for (const character of characters) {
        const count = getExternalImportPendingCountForCharacter(rawDb, character.id);
        if (count > 0) {
            stats.set(String(character.id), {
                character_id: character.id,
                name: character.name || character.id,
                pending: count,
                total: count
            });
        }
    }
    return stats;
}

function getExternalImportMaintenanceBatch(rawDb, characterId, options = {}) {
    const batchOptions = normalizeMemoryMaintenanceBatchOptions(options, { limitFallback: 30 });
    const limit = batchOptions.limit;
    const offset = batchOptions.offset;
    const allItems = buildExternalImportPendingItems(rawDb, characterId);
    const now = Date.now();
    const items = allItems.slice(offset, offset + limit).map((entry, index) => {
        const candidate = entry.candidate || {};
        const sourceStartedAt = Number(candidate.source_started_at || 0);
        const sourceEndedAt = Number(candidate.source_ended_at || sourceStartedAt || 0);
        return {
            id: index + 1,
            character_id: characterId,
            summary: candidate.summary || candidate.content || '',
            content: candidate.content || candidate.summary || '',
            event: candidate.summary || candidate.content || '',
            current: {
                memory_type: 'external_import_staged',
                memory_focus: MEMORY_MAINTENANCE_FOCUS.has(candidate.memory_focus) ? candidate.memory_focus : 'general',
                memory_tier: MEMORY_MAINTENANCE_TIERS.has(candidate.memory_tier) ? candidate.memory_tier : 'ambient',
                importance: Math.round(clampImportNumber(candidate.importance, 5, 1, 10)),
                maintenance_status: 'pending',
                retention_action: 'keep',
                retention_score: 1,
                consolidation_key: candidate.consolidation_key || '',
                consolidation_summary: '',
                source_context: 'external_app',
                scene_tag: entry.sceneTag,
                source_app: entry.appLabel,
                temporal_label: '',
                temporal_scope: '',
                temporal_anchor: ''
            },
            signals: {
                retrieval_count: 0,
                last_retrieved_at: 0,
                created_at: Number(entry.importRow?.created_at || now),
                updated_at: Number(entry.importRow?.committed_at || entry.importRow?.created_at || now),
                source_started_at: sourceStartedAt,
                source_ended_at: sourceEndedAt,
                source_time_text: candidate.source_time_text || '',
                source_message_count: Number(candidate.source_message_count || candidate.source_refs?.length || 0)
            },
            retention: {
                retention_score: 1,
                suggested_action: 'keep',
                reason: '外部导入暂存原料，等待自动总结。',
                threshold: null,
                days_until_threshold: null,
                forgetting_window: null
            },
            external_import: {
                import_id: Number(entry.importRow?.id || 0),
                candidate_id: String(candidate.id || ''),
                character_id: String(characterId),
                key: entry.key,
                source_message_ids_json: [`external-import:${entry.importRow?.id}:${candidate.id}`],
                source_refs: Array.isArray(candidate.source_refs) ? candidate.source_refs : [],
                source_app: entry.appLabel,
                scene_tag: entry.sceneTag
            }
        };
    });
    return {
        source_kind: 'external_import',
        items,
        next_after_id: 0,
        remaining_pending: allItems.length,
        offset,
        batch_index: Math.floor(offset / limit) + 1,
        total_matching: allItems.length,
        total_batches: Math.max(0, Math.ceil(allItems.length / limit))
    };
}

function buildMemoryTemporalBindingPayload(row, source = 'new') {
    const legacyText = row.summary || row.content || row.event || '';
    const primaryText = row.consolidation_summary || legacyText;
    const sourceContext = inferMemorySourceContext(row);
    const sceneTag = inferMemorySceneTag(row, sourceContext);
    const sourceIds = String(row.source_ids || row.id || '')
        .split(',')
        .map(id => Number(id || 0))
        .filter(id => id > 0);
    return {
        id: row.id,
        source_ids: sourceIds.length ? sourceIds : [Number(row.id || 0)].filter(Boolean),
        source_count: Number(row.source_count || sourceIds.length || 1),
        text: clipMemoryDisplayText(primaryText, 180),
        source_card_text: clipMemoryDisplayText(legacyText, 120),
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
    const batchOptions = normalizeMemoryMaintenanceBatchOptions(options, { limitFallback: 40 });
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

function buildMemoryMigrationPrompt(character, batch, options = {}) {
    const batchSize = Array.isArray(batch?.items) ? batch.items.length : 0;
    const fields = ['id', 'memory_card_text', 'focus', 'tier', 'importance', 'calls', 'score', 'forget_in_days', 'action', 'time', 'source_time_text', 'source_context', 'scene_tag'];
    const compactItems = (batch?.items || []).map(item => ([
        item.id,
        clipMemoryDisplayText(item.summary || item.content || item.event || '', 120),
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
- 临时身体/情绪/地点/计划/阶段/周期性状态必须打时间标签，例如痛经、今天焦虑、最近赶 ddl、明天面试、这次经期。
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
- 临时身体状态：痛经、经期/生理期、当天不舒服、发烧、感冒、胃痛、头痛、短期疲惫等。
- 临时情绪/压力：今天焦虑、这几天崩溃、最近压力很大、某个汇报/考试/ddl 前后的情绪。
- 临时地点/行程/任务：今天在某地、刚从某地回来、明天要做某事、短期计划或截止日期。
- 周期性但不是长期画像的状态：例如“这次经期痛经”，可以标 cyclic_state，但不能把它当成用户永远如此。

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
            error.payload = { raw_response: raw, json_preview: clipMemoryDisplayText(raw, 1600) };
            throw error;
        }
        return parsed;
    } catch (e) {
        if (e?.code === 'small_model_invalid_json') throw e;
        const error = new Error(`小模型返回的 JSON 格式不合法：${e.message}`);
        error.code = 'small_model_invalid_json';
        error.payload = { raw_response: raw, json_preview: clipMemoryDisplayText(raw, 1600) };
        throw error;
    }
}

function hasCjkText(value = '') {
    return /[\u3400-\u9fff]/.test(String(value || ''));
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
        if (!summary || !hasCjkText(summary)) {
            errors.push({ error: 'new_memory summary must be Simplified Chinese', memory: mem });
            continue;
        }
        const reason = String(mem.reason || '').trim();
        const sourceContext = String(mem.source_context || '').trim();
        const sceneTag = String(mem.scene_tag || '').trim();
        if (sourceContext && !MEMORY_SOURCE_CONTEXTS.has(sourceContext)) {
            errors.push({ error: `Invalid source_context: ${sourceContext}`, memory: mem });
            continue;
        }
        if (sceneTag && !MEMORY_SCENE_TAGS.has(sceneTag)) {
            errors.push({ error: `Invalid scene_tag: ${sceneTag}`, memory: mem });
            continue;
        }
        const timeBinding = mem.time_binding && typeof mem.time_binding === 'object' ? mem.time_binding : {};
        const isTimeBound = timeBinding.is_time_bound === true;
        const temporalLabel = isTimeBound ? String(timeBinding.label || '').trim() : '';
        const temporalScope = isTimeBound ? String(timeBinding.scope || '').trim() : '';
        if (temporalLabel && !MEMORY_TEMPORAL_BINDING_LABELS.has(temporalLabel)) {
            errors.push({ error: `Invalid temporal label: ${temporalLabel}`, memory: mem });
            continue;
        }
        if (temporalScope && !MEMORY_TEMPORAL_BINDING_SCOPES.has(temporalScope)) {
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
                retention_reason: (hasCjkText(reason) ? reason : '小模型未提供中文理由。').slice(0, 500),
                consolidation_key: String(mem.consolidation_key || '').slice(0, 240),
                consolidation_summary: summary.slice(0, 1000),
                temporal_label: temporalLabel,
                temporal_scope: temporalScope,
                temporal_anchor: isTimeBound ? String(timeBinding.time_anchor || '').trim().slice(0, 120) : '',
                temporal_confidence: isTimeBound ? clampNumber(timeBinding.confidence, 0.5, 0, 1) : 0,
                temporal_reason: isTimeBound
                    ? (hasCjkText(timeBinding.reason) ? String(timeBinding.reason || '') : '小模型未提供中文理由。').slice(0, 500)
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
            retention_reason: (hasCjkText(action.reason) ? String(action.reason || '') : '小模型未提供中文理由。').slice(0, 500)
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
        if (!MEMORY_SOURCE_CONTEXTS.has(sourceContext)) {
            errors.push({ id, error: `Invalid source_context: ${sourceContext}` });
            continue;
        }
        if (!MEMORY_SCENE_TAGS.has(sceneTag)) {
            errors.push({ id, error: `Invalid scene_tag: ${sceneTag}` });
            continue;
        }
        sourceLabels.push({
            id,
            source_context: sourceContext,
            scene_tag: sceneTag,
            source_app: String(item.source_app || '').trim().slice(0, 80),
            confidence: clampNumber(item.confidence, 0.5, 0, 1),
            reason: (hasCjkText(reason) ? reason : '小模型未提供中文理由。').slice(0, 500)
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
        if (!MEMORY_TEMPORAL_BINDING_LABELS.has(label)) {
            errors.push({ id, error: `Invalid temporal label: ${label}` });
            continue;
        }
        if (!MEMORY_TEMPORAL_BINDING_SCOPES.has(scope)) {
            errors.push({ id, error: `Invalid temporal scope: ${scope}` });
            continue;
        }
        candidates.push({
            id,
            label,
            scope,
            time_anchor: String(item.time_anchor || '').trim().slice(0, 120),
            confidence: clampNumber(item.confidence, 0.5, 0, 1),
            reason: (hasCjkText(reason) ? reason : '小模型未提供中文理由。').slice(0, 500)
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
            reason: (hasCjkText(reason) ? reason : '小模型未提供中文理由。').slice(0, 500)
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

function applyMemoryMaintenanceItems(rawDb, characterId, items = [], source = 'small-model', options = {}) {
    const now = Date.now();
    const inputRows = Array.isArray(items) ? items : [];
    const replaceSourceIds = Array.from(new Set((Array.isArray(options.replaceSourceIds) ? options.replaceSourceIds : [])
        .map(id => Number(id || 0))
        .filter(id => id > 0)))
        .slice(0, 200);
    const affectedIds = Array.from(new Set([
        ...replaceSourceIds,
        ...inputRows.map(item => Number(item?.id || 0)).filter(id => id > 0)
    ]));
    let previousRows = [];
    if (affectedIds.length > 0) {
        const placeholders = affectedIds.map(() => '?').join(', ');
        previousRows = rawDb.prepare(`
            SELECT *
            FROM memories
            WHERE character_id = ?
              AND id IN (${placeholders})
        `).all(characterId, ...affectedIds);
    }
    const updateColumns = [
        'memory_focus', 'memory_tier', 'importance', 'summary', 'content', 'event',
        'source_context', 'scene_tag', 'source_app',
        'maintenance_status', 'classification_source', 'classified_at',
        'retention_score', 'retention_action', 'retention_reason', 'retention_checked_at',
        'consolidation_key', 'consolidation_summary', 'consolidated_into_memory_id', 'archive_reason',
        'temporal_label', 'temporal_scope', 'temporal_anchor', 'temporal_confidence', 'temporal_reason', 'temporal_checked_at',
        'forgetting_grace_started_at', 'forgetting_grace_expires_at',
        'updated_at'
    ];
    const stmt = rawDb.prepare(`UPDATE memories SET ${updateColumns.map(col => `${col} = ?`).join(', ')} WHERE id = ? AND character_id = ?`);
    let updated = 0;
    let cleared = 0;
    const errors = [];
    const tx = rawDb.transaction((rows) => {
        if (replaceSourceIds.length > 0) {
            const placeholders = replaceSourceIds.map(() => '?').join(', ');
            const info = rawDb.prepare(`
                UPDATE memories
                SET consolidation_key = '',
                    consolidation_summary = '',
                    consolidated_into_memory_id = 0,
                    temporal_label = '',
                    temporal_scope = '',
                    temporal_anchor = '',
                    temporal_confidence = 0,
                    temporal_reason = '',
                    temporal_checked_at = 0,
                    updated_at = ?
                WHERE character_id = ?
                  AND id IN (${placeholders})
            `).run(now, characterId, ...replaceSourceIds);
            cleared = Number(info.changes || 0);
        }
        for (let idx = 0; idx < rows.length; idx++) {
            const item = rows[idx] || {};
            const id = Number(item.id || 0);
            if (!id) {
                errors.push({ index: idx, error: 'Missing memory id.' });
                continue;
            }
            const existing = rawDb.prepare('SELECT * FROM memories WHERE id = ? AND character_id = ?').get(id, characterId);
            if (!existing) {
                errors.push({ id, error: 'Memory not found for this character.' });
                continue;
            }
            const focus = String(item.memory_focus || existing.memory_focus || 'general').trim();
            const tier = String(item.memory_tier || existing.memory_tier || 'ambient').trim();
            const status = String(item.maintenance_status || 'classified').trim();
            const action = String(item.retention_action || existing.retention_action || computeMemoryRetention(existing, now).suggested_action || 'keep').trim();
            if (!MEMORY_MAINTENANCE_FOCUS.has(focus)) {
                errors.push({ id, error: `Invalid memory_focus: ${focus}` });
                continue;
            }
            if (!MEMORY_MAINTENANCE_TIERS.has(tier)) {
                errors.push({ id, error: `Invalid memory_tier: ${tier}` });
                continue;
            }
            if (!MEMORY_MAINTENANCE_STATUS.has(status)) {
                errors.push({ id, error: `Invalid maintenance_status: ${status}` });
                continue;
            }
            if (action && !MEMORY_MAINTENANCE_ACTIONS.has(action)) {
                errors.push({ id, error: `Invalid retention_action: ${action}` });
                continue;
            }
            const sourceContext = String(item.source_context || existing.source_context || inferMemorySourceContext(existing)).trim();
            const sceneTag = String(item.scene_tag || existing.scene_tag || inferMemorySceneTag(existing, sourceContext)).trim();
            if (sourceContext && !MEMORY_SOURCE_CONTEXTS.has(sourceContext)) {
                errors.push({ id, error: `Invalid source_context: ${sourceContext}` });
                continue;
            }
            if (sceneTag && !MEMORY_SCENE_TAGS.has(sceneTag)) {
                errors.push({ id, error: `Invalid scene_tag: ${sceneTag}` });
                continue;
            }
            const hasTemporalLabel = Object.prototype.hasOwnProperty.call(item, 'temporal_label');
            const hasTemporalScope = Object.prototype.hasOwnProperty.call(item, 'temporal_scope');
            const temporalLabel = String(hasTemporalLabel ? item.temporal_label : (existing.temporal_label || '')).trim();
            const temporalScope = String(hasTemporalScope ? item.temporal_scope : (existing.temporal_scope || '')).trim();
            if (temporalLabel && !MEMORY_TEMPORAL_BINDING_LABELS.has(temporalLabel)) {
                errors.push({ id, error: `Invalid temporal_label: ${temporalLabel}` });
                continue;
            }
            if (temporalScope && !MEMORY_TEMPORAL_BINDING_SCOPES.has(temporalScope)) {
                errors.push({ id, error: `Invalid temporal_scope: ${temporalScope}` });
                continue;
            }
            const retention = computeMemoryRetention({ ...existing, memory_focus: focus, memory_tier: tier, importance: item.importance ?? existing.importance }, now);
            const retentionScore = Number.isFinite(Number(item.retention_score)) ? clampNumber(item.retention_score, retention.retention_score, 0, 1) : retention.retention_score;
            const existingGraceStartedAt = Number(existing.forgetting_grace_started_at || 0);
            const existingGraceExpiresAt = Number(existing.forgetting_grace_expires_at || 0);
            const startsForgettingGrace = (action || retention.suggested_action) === 'archive_candidate';
            const nextGraceStartedAt = startsForgettingGrace
                ? (existingGraceStartedAt > 0 ? existingGraceStartedAt : now)
                : 0;
            const nextGraceExpiresAt = startsForgettingGrace
                ? (existingGraceExpiresAt > nextGraceStartedAt ? existingGraceExpiresAt : nextGraceStartedAt + MEMORY_FORGETTING_GRACE_MS)
                : 0;
            const valuesByColumn = {
                memory_focus: focus,
                memory_tier: tier,
                importance: clampNumber(item.importance ?? existing.importance, Number(existing.importance || 5), 1, 10),
                summary: firstImportString(item.summary, item.normalized_summary, existing.summary, existing.event),
                content: firstImportString(item.content, item.normalized_content, existing.content, existing.event),
                event: firstImportString(item.event, item.summary, existing.event, existing.summary),
                source_context: sourceContext,
                scene_tag: sceneTag,
                source_app: firstImportString(item.source_app, existing.source_app).slice(0, 80),
                maintenance_status: status,
                classification_source: String(source || 'small-model').slice(0, 80),
                classified_at: now,
                retention_score: retentionScore,
                retention_action: action || retention.suggested_action,
                retention_reason: firstImportString(item.retention_reason, item.reason, retention.reason).slice(0, 500),
                retention_checked_at: now,
                consolidation_key: firstImportString(item.consolidation_key, item.merge_key, existing.consolidation_key).slice(0, 160),
                consolidation_summary: firstImportString(item.consolidation_summary, item.merge_summary, existing.consolidation_summary).slice(0, 2000),
                consolidated_into_memory_id: Math.max(0, Number(item.consolidated_into_memory_id || existing.consolidated_into_memory_id || 0) || 0),
                archive_reason: firstImportString(item.archive_reason, existing.archive_reason).slice(0, 500),
                temporal_label: temporalLabel,
                temporal_scope: temporalScope,
                temporal_anchor: firstImportString(item.temporal_anchor, existing.temporal_anchor).slice(0, 120),
                temporal_confidence: Number.isFinite(Number(item.temporal_confidence)) ? clampNumber(item.temporal_confidence, 0, 0, 1) : Number(existing.temporal_confidence || 0),
                temporal_reason: firstImportString(item.temporal_reason, existing.temporal_reason).slice(0, 500),
                temporal_checked_at: (temporalLabel || temporalScope || item.temporal_anchor || item.temporal_reason) ? now : Number(existing.temporal_checked_at || 0),
                forgetting_grace_started_at: nextGraceStartedAt,
                forgetting_grace_expires_at: nextGraceExpiresAt,
                updated_at: now
            };
            const info = stmt.run(...updateColumns.map(col => valuesByColumn[col]), id, characterId);
            updated += Number(info.changes || 0);
        }
    });
    tx(inputRows);
    const result = { updated, cleared, replace_source_ids: replaceSourceIds, affected_ids: affectedIds, errors };
    Object.defineProperty(result, 'previousRows', {
        value: previousRows,
        enumerable: false
    });
    return result;
}

async function refreshMaintenanceMemoryIndex(memory, characterId, applyResult = {}) {
    const affectedIds = Array.from(new Set((Array.isArray(applyResult.affected_ids) ? applyResult.affected_ids : [])
        .map(id => Number(id || 0))
        .filter(id => id > 0)));
    const previousRows = Array.isArray(applyResult.previousRows) ? applyResult.previousRows : [];
    if (!memory || (affectedIds.length === 0 && previousRows.length === 0)) {
        return null;
    }
    if (typeof memory.refreshMemoryIndexEntries === 'function') {
        return await memory.refreshMemoryIndexEntries(characterId, affectedIds, { previousRows });
    }
    if (typeof memory.rebuildIndex === 'function') {
        return await memory.rebuildIndex(characterId);
    }
    return null;
}

function getMemoryMaintenanceStats(rawDb, characterId) {
    const row = rawDb.prepare(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(is_archived, 0) = 0 THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN COALESCE(is_archived, 0) = 1 THEN 1 ELSE 0 END) AS archived,
            SUM(CASE WHEN COALESCE(maintenance_status, '') = '' OR maintenance_status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN maintenance_status = 'classified' THEN 1 ELSE 0 END) AS classified,
            SUM(CASE WHEN maintenance_status = 'needs_review' THEN 1 ELSE 0 END) AS needs_review,
            SUM(CASE WHEN retention_action = 'archive_candidate' THEN 1 ELSE 0 END) AS archive_candidates,
            SUM(CASE WHEN retention_action = 'merge_candidate' THEN 1 ELSE 0 END) AS merge_candidates
        FROM memories
        WHERE character_id = ?
    `).get(characterId) || {};
    const byFocus = rawDb.prepare(`
        SELECT COALESCE(memory_focus, 'general') AS memory_focus, COUNT(*) AS count
        FROM memories
        WHERE character_id = ? AND COALESCE(is_archived, 0) = 0
        GROUP BY COALESCE(memory_focus, 'general')
        ORDER BY count DESC
    `).all(characterId);
    const byTier = rawDb.prepare(`
        SELECT COALESCE(memory_tier, 'ambient') AS memory_tier, COUNT(*) AS count
        FROM memories
        WHERE character_id = ? AND COALESCE(is_archived, 0) = 0
        GROUP BY COALESCE(memory_tier, 'ambient')
        ORDER BY count DESC
    `).all(characterId);
    const externalPending = getExternalImportPendingCountForCharacter(rawDb, characterId);
    const legacyPending = Number(row.pending || 0);
    return {
        total: Number(row.total || 0) + externalPending,
        active: Number(row.active || 0),
        archived: Number(row.archived || 0),
        pending: legacyPending + externalPending,
        legacy_pending: legacyPending,
        external_pending: externalPending,
        classified: Number(row.classified || 0),
        needs_review: Number(row.needs_review || 0),
        archive_candidates: Number(row.archive_candidates || 0),
        merge_candidates: Number(row.merge_candidates || 0),
        by_focus: byFocus,
        by_tier: byTier
    };
}

function buildMemoryMaintenanceAttemptError(error, attemptNumber) {
    const payload = error?.payload || {};
    return {
        attempt: attemptNumber,
        reroll: Math.max(0, attemptNumber - 1),
        kind: 'error',
        error: error?.message || 'Unknown small model error.',
        model: payload.model || null,
        batch: payload.batch
            ? {
                item_count: payload.batch.item_count || 0,
                ids: payload.batch.ids || [],
                batch_index: payload.batch.batch_index || 0,
                remaining_pending: payload.batch.remaining_pending || 0
            }
            : null,
        raw_response_preview: payload.raw_response ? clipMemoryDisplayText(payload.raw_response, 1600) : ''
    };
}

function isNonRetryableMemoryMaintenanceError(error) {
    const text = [
        error?.message,
        error?.payload?.raw_response,
        error?.payload?.error,
        error?.response?.status,
        error?.status
    ].filter(Boolean).join('\n');
    return /(401|403|unauthorized|forbidden|invalid\s*(api\s*)?key|invalid_key|permission|auth)/i.test(text);
}

function buildMemoryMaintenanceNoProgressAttempt(result, statsAfterBatch, attemptNumber) {
    return {
        attempt: attemptNumber,
        reroll: Math.max(0, attemptNumber - 1),
        kind: 'no_progress',
        error: 'No memory records were updated; rerolling this batch.',
        model: result?.model || null,
        batch: {
            item_count: result?.batch?.item_count || 0,
            ids: result?.batch?.ids || [],
            batch_index: result?.batch?.batch_index || 0,
            remaining_pending_before_batch: result?.batch?.remaining_pending || 0,
            remaining_pending_after_batch: statsAfterBatch?.pending || 0
        },
        normalized_errors: (result?.normalized?.errors || []).slice(0, 6),
        raw_response_preview: result?.raw_response ? clipMemoryDisplayText(result.raw_response, 1600) : ''
    };
}

function appendExternalImportProcessingEntries(rawDb, entries = []) {
    const grouped = new Map();
    for (const entry of entries) {
        const importId = Number(entry?.import_id || 0);
        if (!importId) continue;
        if (!grouped.has(importId)) grouped.set(importId, []);
        grouped.get(importId).push(entry);
    }
    for (const [importId, groupEntries] of grouped.entries()) {
        const row = rawDb.prepare('SELECT id, memory_ids_json FROM external_memory_imports WHERE id = ?').get(importId);
        if (!row) continue;
        const current = normalizeExternalProcessingState(row.memory_ids_json);
        const byKey = new Map();
        for (const item of current) {
            const key = item.key || makeExternalProcessingKey(importId, item.candidate_id, item.character_id);
            if (key) byKey.set(key, { ...item, key });
        }
        for (const entry of groupEntries) {
            const key = entry.key || makeExternalProcessingKey(importId, entry.candidate_id, entry.character_id);
            if (!key) continue;
            byKey.set(key, {
                ...entry,
                key,
                processed_at: entry.processed_at || Date.now()
            });
        }
        rawDb.prepare('UPDATE external_memory_imports SET memory_ids_json = ? WHERE id = ?')
            .run(JSON.stringify(Array.from(byKey.values())), importId);
    }
}

async function applyExternalImportMigrationItems(rawDb, memory, characterId, normalized = {}, batch = {}, source = 'external-import-auto-migration') {
    const now = Date.now();
    const inputRows = Array.isArray(batch.items) ? batch.items : [];
    const itemById = new Map(inputRows.map(item => [Number(item.id || 0), item]));
    const errors = [];
    const affectedIds = [];
    const processingEntries = [];
    const processedVirtualIds = new Set();
    const updateFormalStmt = rawDb.prepare(`
        UPDATE memories
        SET maintenance_status = 'classified',
            classification_source = ?,
            classified_at = ?,
            retention_action = ?,
            retention_reason = ?,
            retention_checked_at = ?,
            temporal_label = ?,
            temporal_scope = ?,
            temporal_anchor = ?,
            temporal_confidence = ?,
            temporal_reason = ?,
            temporal_checked_at = ?,
            updated_at = ?
        WHERE id = ? AND character_id = ?
    `);

    const newMemories = Array.isArray(normalized.newMemories) ? normalized.newMemories : [];
    for (const mem of newMemories) {
        const sourceIds = Array.from(new Set((Array.isArray(mem?.source_ids) ? mem.source_ids : [])
            .map(id => Number(id || 0))
            .filter(id => itemById.has(id))));
        if (!sourceIds.length) continue;
        const sourceItems = sourceIds.map(id => itemById.get(id)).filter(Boolean);
        const summary = String(mem.summary || '').trim();
        if (!summary) continue;
        const sourceContext = MEMORY_SOURCE_CONTEXTS.has(String(mem.source_context || '').trim()) ? String(mem.source_context).trim() : 'external_app';
        const firstExternal = sourceItems[0]?.external_import || {};
        const sceneTag = MEMORY_SCENE_TAGS.has(String(mem.scene_tag || '').trim())
            ? String(mem.scene_tag).trim()
            : (firstExternal.scene_tag || 'external_app');
        const sourceApp = firstExternal.source_app || 'External';
        const startedValues = sourceItems.map(item => Number(item.signals?.source_started_at || 0)).filter(Boolean);
        const endedValues = sourceItems.map(item => Number(item.signals?.source_ended_at || item.signals?.source_started_at || 0)).filter(Boolean);
        const sourceMessageIds = Array.from(new Set(sourceItems.flatMap(item => item.external_import?.source_message_ids_json || [])));
        const sourceTimeText = firstImportString(...sourceItems.map(item => item.signals?.source_time_text).filter(Boolean));
        const timeBinding = mem.time_binding && typeof mem.time_binding === 'object' ? mem.time_binding : {};
        const isTimeBound = timeBinding.is_time_bound === true;
        const temporalLabel = isTimeBound && MEMORY_TEMPORAL_BINDING_LABELS.has(String(timeBinding.label || '').trim()) ? String(timeBinding.label).trim() : '';
        const temporalScope = isTimeBound && MEMORY_TEMPORAL_BINDING_SCOPES.has(String(timeBinding.scope || '').trim()) ? String(timeBinding.scope).trim() : '';
        const sourceKey = sourceItems.map(item => item.external_import?.key || item.id).join('_');
        const consolidationKey = String(mem.consolidation_key || sourceKey || summary)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 120) || `external_import_${now}`;
        const dedupeKey = `external-import-formal:${characterId}:${sourceKey}:${consolidationKey}`;
        try {
            const memoryId = await memory.saveExtractedMemory(characterId, {
                memory_type: 'formal_memory',
                summary,
                content: summary,
                event: summary,
                importance: Math.round(clampImportNumber(mem.importance, sourceItems[0]?.current?.importance || 5, 1, 10)),
                memory_focus: MEMORY_MAINTENANCE_FOCUS.has(mem.memory_focus) ? mem.memory_focus : 'general',
                memory_tier: MEMORY_MAINTENANCE_TIERS.has(mem.memory_tier) ? mem.memory_tier : 'ambient',
                consolidation_key: consolidationKey,
                consolidation_summary: summary,
                source_context: sourceContext,
                scene_tag: sceneTag,
                source_app: sourceApp,
                source_message_ids_json: sourceMessageIds,
                source_started_at: startedValues.length ? Math.min(...startedValues) : 0,
                source_ended_at: endedValues.length ? Math.max(...endedValues) : 0,
                source_time_text: sourceTimeText || '',
                source_message_count: sourceMessageIds.length || sourceItems.reduce((sum, item) => sum + Number(item.signals?.source_message_count || 0), 0),
                dedupe_key: dedupeKey
            }, null);
            if (memoryId) {
                affectedIds.push(Number(memoryId));
                const retentionAction = String(mem.action || '').trim() === 'merge_create' ? 'merge_candidate' : 'keep';
                const reason = hasCjkText(mem.reason) ? String(mem.reason || '') : '外部导入自动总结生成。';
                updateFormalStmt.run(
                    source,
                    now,
                    retentionAction,
                    reason.slice(0, 500),
                    now,
                    temporalLabel,
                    temporalScope,
                    temporalLabel ? String(timeBinding.time_anchor || '').trim().slice(0, 120) : '',
                    temporalLabel ? clampNumber(timeBinding.confidence, 0.5, 0, 1) : 0,
                    temporalLabel ? (hasCjkText(timeBinding.reason) ? String(timeBinding.reason || '').slice(0, 500) : '小模型未提供中文理由。') : '',
                    temporalLabel ? now : 0,
                    now,
                    memoryId,
                    characterId
                );
                for (const item of sourceItems) {
                    processedVirtualIds.add(Number(item.id || 0));
                    processingEntries.push({
                        import_id: item.external_import?.import_id,
                        candidate_id: item.external_import?.candidate_id,
                        character_id: String(characterId),
                        key: item.external_import?.key,
                        action: 'created',
                        memory_id: Number(memoryId)
                    });
                }
            }
        } catch (e) {
            errors.push({ source_ids: sourceIds, error: e.message || 'Failed to save external formal memory.' });
        }
    }

    for (const action of Array.isArray(normalized.oldActions) ? normalized.oldActions : []) {
        const id = Number(action?.id || 0);
        const item = itemById.get(id);
        if (!item || processedVirtualIds.has(id)) continue;
        processedVirtualIds.add(id);
        processingEntries.push({
            import_id: item.external_import?.import_id,
            candidate_id: item.external_import?.candidate_id,
            character_id: String(characterId),
            key: item.external_import?.key,
            action: String(action.action || 'needs_review').trim() || 'needs_review',
            reason: String(action.reason || '').slice(0, 500)
        });
    }

    for (const applyItem of Array.isArray(normalized.applyItems) ? normalized.applyItems : []) {
        const id = Number(applyItem?.id || 0);
        const item = itemById.get(id);
        if (!item || processedVirtualIds.has(id)) continue;
        processedVirtualIds.add(id);
        processingEntries.push({
            import_id: item.external_import?.import_id,
            candidate_id: item.external_import?.candidate_id,
            character_id: String(characterId),
            key: item.external_import?.key,
            action: applyItem.maintenance_status || 'needs_review',
            reason: String(applyItem.retention_reason || '').slice(0, 500)
        });
    }

    appendExternalImportProcessingEntries(rawDb, processingEntries);
    return {
        updated: processingEntries.length,
        inserted: affectedIds.length,
        affected_ids: affectedIds,
        errors,
        external_processed: processingEntries.length
    };
}

async function runMemoryMaintenanceBatch(rawDb, memory, character, settings, options = {}) {
    const characterId = character.id;
    const batchOptions = normalizeMemoryMaintenanceBatchOptions(options, {
        limitFallback: settings.batch_size || 30
    });
    const batch = getMemoryMaintenanceBatch(rawDb, characterId, {
        limit: batchOptions.limit,
        offset: batchOptions.offset,
        after_id: batchOptions.after_id,
        status: options.status || 'pending',
        include_archived: parseBooleanFlag(options.include_archived)
    });
    if (!batch.items.length) {
        return {
            success: true,
            empty: true,
            character: { id: character.id, name: character.name },
            message: 'No pending memory cards in this batch.',
            batch
        };
    }
    const prompt = buildMemoryMigrationPrompt(character, batch, settings);
    const response = await callLLM({
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
        parsed = extractJsonObjectFromText(rawText);
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
                next_after_id: batch.next_after_id,
                remaining_pending: batch.remaining_pending,
                offset: batch.offset,
                batch_index: batch.batch_index,
                total_batches: batch.total_batches
            },
            model: { name: settings.model_name, usage: response?.usage || null, finishReason: response?.finishReason || '' },
            raw_response: rawText
        };
        throw error;
    }
    const normalized = normalizeSmallModelMigrationResult(parsed, batch.items.map(item => item.id));
    let applyResult = { updated: 0, errors: [] };
    let indexRefresh = null;
    let indexRefreshWarning = '';
    if (!parseBooleanFlag(options.dry_run)) {
        if (batch.source_kind === 'external_import') {
            applyResult = await applyExternalImportMigrationItems(
                rawDb,
                memory,
                characterId,
                normalized,
                batch,
                options.source || 'external-import-auto-migration'
            );
        } else {
            applyResult = applyMemoryMaintenanceItems(
                rawDb,
                characterId,
                normalized.applyItems,
                options.source || 'small-model-migration',
                { replaceSourceIds: normalized.applyItems.length > 0 ? batch.items.map(item => item.id) : [] }
            );
            try {
                indexRefresh = await refreshMaintenanceMemoryIndex(memory, characterId, applyResult);
            } catch (e) {
                indexRefreshWarning = e.message || 'Memory index refresh failed.';
                console.error(`[Memory Maintenance] Failed to refresh memory index for ${characterId}:`, indexRefreshWarning);
            }
        }
    }
    return {
        success: true,
        empty: false,
        character: { id: character.id, name: character.name },
        dry_run: parseBooleanFlag(options.dry_run),
        prompt,
        batch: {
            source_kind: batch.source_kind || 'legacy_memory',
            item_count: batch.items.length,
            ids: batch.items.map(item => item.id),
            next_after_id: batch.next_after_id,
            remaining_pending: batch.remaining_pending,
            offset: batch.offset,
            batch_index: batch.batch_index,
            total_matching: batch.total_matching,
            total_batches: batch.total_batches
        },
        model: { name: settings.model_name, usage: response?.usage || null, finishReason: response?.finishReason || '' },
        raw_response: rawText,
        parsed,
        normalized: {
            apply_items: normalized.applyItems,
            errors: normalized.errors,
            new_memory_count: normalized.newMemories.length,
            old_action_count: normalized.oldActions.length
        },
        apply: applyResult,
        index_refresh: indexRefresh,
        index_refresh_warning: indexRefreshWarning,
        stats: getMemoryMaintenanceStats(rawDb, characterId)
    };
}

async function runMemoryTemporalBindingBatch(rawDb, character, settings, options = {}) {
    const characterId = character.id;
    const batchOptions = normalizeMemoryMaintenanceBatchOptions(options, {
        limitFallback: settings.batch_size || 40
    });
    const batch = getMemoryTemporalBindingBatch(rawDb, characterId, {
        limit: batchOptions.limit,
        offset: batchOptions.offset,
        source: options.source || 'new',
        include_archived: parseBooleanFlag(options.include_archived)
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
    const response = await callLLM({
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
        parsed = extractJsonObjectFromText(rawText);
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
    if (!parseBooleanFlag(options.dry_run)) {
        applyResult = applyMemoryMaintenanceItems(
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
        dry_run: parseBooleanFlag(options.dry_run),
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
        stats: getMemoryMaintenanceStats(rawDb, characterId)
    };
}

function incrementCount(map, key, amount = 1) {
    const safeKey = String(key || 'unknown');
    map[safeKey] = Number(map[safeKey] || 0) + Number(amount || 0);
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
    return `(${MEMORY_TEMPORAL_SIGNAL_TERMS.map(() => `${haystack} LIKE ?`).join(' OR ')})`;
}

function getMemoryTemporalSignalParams() {
    return MEMORY_TEMPORAL_SIGNAL_TERMS.map(term => `%${term}%`);
}

function normalizeMemoryTemporalBindingSource(value = 'new') {
    const normalized = String(value || 'new').trim().toLowerCase();
    if (normalized === 'temporal_signal' || normalized === 'new_temporal_signal') return 'new_temporal_signal';
    return 'new';
}

const MEMORY_LIBRARY_FOCUS_DEFINITIONS = [
    {
        key: 'user_profile',
        label: '用户画像分类',
        description: '长期稳定的用户身份、偏好、背景、边界、长期目标。适合长期保留，通常只在冲突或更新时合并。'
    },
    {
        key: 'relationship',
        label: '关系记忆分类',
        description: '用户与角色之间的承诺、冲突、和解、告白、亲密度变化和相处边界。决定角色如何看待这段关系。'
    },
    {
        key: 'user_current_arc',
        label: '当前阶段分类',
        description: '用户近期正在经历的事情、短期计划、压力、情绪和当前任务。时效性强，会更早进入遗忘曲线。'
    },
    {
        key: 'general',
        label: '普通事件分类',
        description: '不属于画像、关系、当前阶段的普通事实和背景事件。重要性低且长期未调用时会优先降级或归档。'
    }
];

function clampMemoryLibraryLimit(value, fallback = 28, max = 120) {
    return Math.max(5, Math.min(max, Number(value || fallback) || fallback));
}

function clipMemoryDisplayText(value, max = 520) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

const MEMORY_LIBRARY_ROW_COLUMNS = [
    'id',
    'character_id',
    'time',
    'location',
    'people',
    'event',
    'relationships',
    'items',
    'importance',
    'created_at',
    'group_id',
    'last_retrieved_at',
    'retrieval_count',
    'memory_type',
    'summary',
    'content',
    'people_json',
    'items_json',
    'relationship_json',
    'emotion',
    'source_message_ids_json',
    'dedupe_key',
    'updated_at',
    'is_archived',
    'source_started_at',
    'source_ended_at',
    'source_time_text',
    'source_message_count',
    'memory_tier',
    'memory_focus',
    'maintenance_status',
    'classification_source',
    'classified_at',
    'retention_score',
    'retention_action',
    'retention_reason',
    'retention_checked_at',
    'consolidation_key',
    'consolidation_summary',
    'consolidated_into_memory_id',
    'archive_reason',
    'forgetting_grace_started_at',
    'forgetting_grace_expires_at',
    'source_context',
    'scene_tag',
    'source_app',
    'temporal_label',
    'temporal_scope',
    'temporal_anchor',
    'temporal_confidence',
    'temporal_reason',
    'temporal_checked_at'
];

function quoteSqlIdentifier(name) {
    return `"${String(name || '').replace(/"/g, '""')}"`;
}

function getTableColumnSet(rawDb, tableName) {
    if (!rawDb || !tableName) return new Set();
    try {
        return new Set(rawDb.prepare(`PRAGMA table_info(${quoteSqlIdentifier(tableName)})`).all().map(col => col.name));
    } catch (e) {
        return new Set();
    }
}

function getMemoryLibraryRowSelect(rawDb, alias = '') {
    const columns = getTableColumnSet(rawDb, 'memories');
    const prefix = alias ? `${quoteSqlIdentifier(alias)}.` : '';
    const selected = MEMORY_LIBRARY_ROW_COLUMNS.filter(column => columns.has(column));
    return selected.map(column => `${prefix}${quoteSqlIdentifier(column)}`).join(', ');
}

function parseMemorySourceIds(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    const raw = String(value || '').trim();
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
    } catch (e) {
        // Keep compact source detection resilient for legacy rows.
    }
    return raw.split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
}

function hasExternalMemorySourceSignal(row = {}) {
    if (String(row.source_app || '').trim()) return true;
    if (String(row.classification_source || '').trim() === 'manual-edit') return true;
    const ids = parseMemorySourceIds(row.source_message_ids_json);
    return ids.some(id => /^(external|import|gpt|gemini|sillytavern|silly-tavern):/i.test(id));
}

function inferMemorySourceContext(row = {}) {
    const existing = String(row.source_context || '').trim();
    if (existing === 'diary') return 'unknown';
    if (existing === 'external_app') {
        return hasExternalMemorySourceSignal(row) ? 'external_app' : 'unknown';
    }
    if (MEMORY_SOURCE_CONTEXTS.has(existing)) return existing;
    const ids = parseMemorySourceIds(row.source_message_ids_json);
    const text = [
        row.summary,
        row.content,
        row.event,
        row.location,
        row.source_time_text,
        row.group_id,
        row.source_app,
        ...ids
    ].filter(Boolean).join(' ');
    if (hasExternalMemorySourceSignal(row)) return 'external_app';
    if (ids.some(id => /^city:/i.test(id)) || /(商业街|city activity|商业街行动|商业街活动|街区|公告任务|工厂|厂区|工头|工服|领工钱|日结|仓储区|堆货区|签到处|便利店|餐厅|公园|长椅|回家|出租屋)/i.test(text)) return 'commercial_street';
    if (row.group_id || ids.some(id => /^group:/i.test(id)) || /(群聊|group_chat|group message)/i.test(text)) return 'group_chat';
    if (ids.some(id => /^diary:/i.test(id))) return 'unknown';
    return 'private_chat';
}

function inferMemorySceneTag(row = {}, context = inferMemorySourceContext(row)) {
    const existing = String(row.scene_tag || '').trim();
    if (existing === 'diary') return 'other';
    if (/^external_/i.test(existing) && context !== 'external_app') return 'other';
    if (existing === 'external_app' && context !== 'external_app') return 'other';
    if (MEMORY_SCENE_TAGS.has(existing)) return existing;
    const app = String(row.source_app || '').toLowerCase();
    if (/gpt/.test(app)) return 'external_gpt';
    if (/gemini/.test(app)) return 'external_gemini';
    if (/silly/.test(app)) return 'external_sillytavern';
    if (context === 'commercial_street') return 'commercial_street';
    if (context === 'group_chat') return 'group_chat';
    if (context === 'external_app') return 'external_app';
    if (context === 'private_chat') return 'private_chat';
    return 'other';
}

function buildMemoryLibraryItem(row, charById, now = Date.now()) {
    const character = charById.get(String(row.character_id)) || { id: row.character_id, name: row.character_id };
    const retention = computeMemoryRetention(row, now);
    const daysUntilThreshold = computeDaysUntilRetentionThreshold(row, retention);
    const forgettingWindow = computeMemoryForgettingWindow(row, retention, now);
    const text = row.consolidation_summary || row.summary || row.content || row.event || '';
    const sourceIds = String(row.source_ids || '')
        .split(',')
        .map(id => Number(id || 0))
        .filter(id => id > 0);
    const fallbackSourceIds = sourceIds.length ? sourceIds : [Number(row.id || 0)].filter(Boolean);
    const isFormalNewMemory = !!row.formal_group_key;
    return {
        id: row.formal_group_key || row.id,
        representative_id: row.id,
        character_id: row.character_id,
        character_name: character.name || row.character_id,
        text: clipMemoryDisplayText(text),
        legacy_text: row.consolidation_summary ? clipMemoryDisplayText(row.summary || row.content || row.event || '', 260) : '',
        memory_library_source: isFormalNewMemory ? 'new_grouped' : (row.consolidation_summary ? 'new' : 'legacy_backup'),
        memory_focus: row.memory_focus || 'general',
        memory_tier: row.memory_tier || 'ambient',
        memory_type: row.memory_type || 'event',
        importance: Number(row.source_importance || row.importance || 5),
        retrieval_count: Number(row.source_retrieval_count || row.retrieval_count || 0),
        last_retrieved_at: Number(row.last_retrieved_at || 0),
        created_at: Number(row.created_at || 0),
        updated_at: Number(row.updated_at || 0),
        source_started_at: Number(row.source_started_at || 0),
        source_ended_at: Number(row.source_ended_at || 0),
        source_time_text: row.source_time_text || '',
        source_ids: fallbackSourceIds,
        source_count: Number(row.source_count || fallbackSourceIds.length || 1),
        source_context: inferMemorySourceContext(row),
        scene_tag: inferMemorySceneTag(row),
        source_app: row.source_app || '',
        temporal_label: row.temporal_label || '',
        temporal_scope: row.temporal_scope || '',
        temporal_anchor: row.temporal_anchor || '',
        temporal_confidence: Number(row.temporal_confidence || 0),
        temporal_reason: row.temporal_reason || '',
        is_archived: Number(row.is_archived || 0),
        maintenance_status: row.maintenance_status || 'pending',
        retention_score: retention.retention_score,
        retention_action: retention.suggested_action,
        days_until_threshold: daysUntilThreshold,
        forgetting_stage: forgettingWindow.stage,
        threshold_at: forgettingWindow.threshold_at,
        grace_started_at: forgettingWindow.grace_started_at,
        grace_expires_at: forgettingWindow.grace_expires_at,
        days_until_grace_expires: forgettingWindow.days_until_grace_expires,
        grace_hours: forgettingWindow.grace_hours,
        protected: !!retention.protected
    };
}

function compareMemoryForgettingItems(a, b) {
    const dayDiff = Number(a.days_until_threshold || 0) - Number(b.days_until_threshold || 0);
    if (dayDiff !== 0) return dayDiff;
    const graceDiff = Number(a.grace_expires_at || 0) - Number(b.grace_expires_at || 0);
    if (graceDiff !== 0) return graceDiff;
    return Number(a.retention_score || 0) - Number(b.retention_score || 0);
}

function buildMemoryForgettingGroups(curveItems = [], showAll = false, forgettingLimit = 120, mode = 'legacy') {
    const sortedItems = [...curveItems].sort(compareMemoryForgettingItems);
    const fastForgetting = sortedItems.filter(item => Number(item.days_until_threshold || 0) <= 30);
    const onCurve = sortedItems.filter(item => Number(item.days_until_threshold || 0) > 30);
    const isFormal = mode === 'new';
    return [
        {
            key: 'fast',
            label: '快遗忘',
            description: isFormal
                ? '按新版正式记忆本身计算：30 天内到达遗忘阈值，或已经进入 24 小时缓冲池。救回会作用到背后的承载卡片。'
                : '30 天内到达遗忘阈值，或已经进入 24 小时缓冲池的记忆。缓冲期内可以救回。',
            count: fastForgetting.length,
            items: showAll ? fastForgetting : fastForgetting.slice(0, forgettingLimit),
            has_more: !showAll && fastForgetting.length > forgettingLimit
        },
        {
            key: 'on_curve',
            label: '已进入遗忘曲线',
            description: isFormal
                ? '按新版正式记忆的 summary、分类、重要性和调用情况计算衰减；还没进入 30 天快遗忘窗口。'
                : '已经按遗忘曲线开始衰减，但还没进入 30 天快遗忘窗口。越靠前越接近缓冲池。',
            count: onCurve.length,
            items: showAll ? onCurve : onCurve.slice(0, forgettingLimit),
            has_more: !showAll && onCurve.length > forgettingLimit
        }
    ];
}

function getPositiveMin(values = []) {
    const positives = values.map(value => Number(value || 0)).filter(value => value > 0);
    return positives.length ? Math.min(...positives) : 0;
}

function updateFormalMemoryGraceRows(rawDb, sourceIds = [], patch = {}) {
    const ids = Array.from(new Set((Array.isArray(sourceIds) ? sourceIds : [])
        .map(id => Number(id || 0))
        .filter(id => id > 0)));
    if (!rawDb || ids.length === 0) return;
    const columns = getTableColumnSet(rawDb, 'memories');
    if (!columns.has('forgetting_grace_started_at') || !columns.has('forgetting_grace_expires_at')) return;
    const stmt = rawDb.prepare(`
        UPDATE memories
        SET forgetting_grace_started_at = ?,
            forgetting_grace_expires_at = ?
        WHERE id = ?
    `);
    const tx = rawDb.transaction((rows) => {
        for (const id of rows) {
            stmt.run(Number(patch.started_at || 0), Number(patch.expires_at || 0), id);
        }
    });
    tx(ids);
}

function applyFormalMemoryForgettingState(item, rawDb, now = Date.now(), options = {}) {
    const persistGrace = options.persistGrace !== false;
    const rows = Array.isArray(item._source_rows) ? item._source_rows : [];
    const virtualRow = {
        id: item.id,
        character_id: item.character_id,
        summary: item.summary,
        content: item.summary,
        event: item.summary,
        consolidation_summary: item.summary,
        memory_type: 'formal_memory',
        memory_focus: item.memory_focus || 'general',
        memory_tier: item.memory_tier || 'ambient',
        importance: Number(item.importance || 5),
        retrieval_count: Number(item.retrieval_count || 0),
        last_retrieved_at: Number(item.last_retrieved_at || 0),
        created_at: Number(item.created_at || 0),
        updated_at: Number(item.updated_at || 0),
        source_started_at: Number(item.source_started_at || 0),
        source_ended_at: Number(item.source_ended_at || 0)
    };
    const retention = computeMemoryRetention(virtualRow, now);
    const daysUntilThreshold = computeDaysUntilRetentionThreshold(virtualRow, retention);
    const shouldBeInGrace = !retention.protected && daysUntilThreshold !== null && Number(daysUntilThreshold) <= 0;
    if (shouldBeInGrace) {
        const existingStartedAt = getPositiveMin(rows.map(row => row.forgetting_grace_started_at));
        const existingExpiresAt = getPositiveMin(rows.map(row => row.forgetting_grace_expires_at));
        const startedAt = existingStartedAt > 0 ? existingStartedAt : now;
        const expiresAt = existingExpiresAt > startedAt ? existingExpiresAt : startedAt + MEMORY_FORGETTING_GRACE_MS;
        virtualRow.forgetting_grace_started_at = startedAt;
        virtualRow.forgetting_grace_expires_at = expiresAt;
        if (persistGrace) {
            updateFormalMemoryGraceRows(rawDb, item.source_ids, { started_at: startedAt, expires_at: expiresAt });
        }
    } else {
        virtualRow.forgetting_grace_started_at = 0;
        virtualRow.forgetting_grace_expires_at = 0;
        if (persistGrace) {
            updateFormalMemoryGraceRows(rawDb, item.source_ids, { started_at: 0, expires_at: 0 });
        }
    }
    const forgettingWindow = computeMemoryForgettingWindow(virtualRow, retention, now);
    item.text = item.summary || '';
    item.memory_library_source = 'new_grouped';
    item.representative_id = rows[0]?.id || item.source_ids?.[0] || 0;
    item.retention_score = retention.retention_score;
    item.retention_action = retention.suggested_action || item.retention_action || 'keep';
    item.days_until_threshold = daysUntilThreshold;
    item.forgetting_stage = forgettingWindow.stage;
    item.threshold_at = forgettingWindow.threshold_at;
    item.grace_started_at = forgettingWindow.grace_started_at;
    item.grace_expires_at = forgettingWindow.grace_expires_at;
    item.days_until_grace_expires = forgettingWindow.days_until_grace_expires;
    item.grace_hours = forgettingWindow.grace_hours;
    item.protected = !!retention.protected;
    delete item._source_rows;
    return item;
}

function buildNewMemorySummaryLibrary(rawDb, charById, definitions, baseWhere, baseParams, options = {}) {
    const now = Number(options.now || Date.now());
    const showAll = !!options.showAll;
    const forgettingLimit = options.forgettingLimit || 120;
    const limitPerGroup = showAll ? null : clampMemoryLibraryLimit(options.limitPerGroup, 28, 120);
    const rowSelect = getMemoryLibraryRowSelect(rawDb);
    const rows = rawDb.prepare(`
        SELECT ${rowSelect}
        FROM memories
        WHERE ${baseWhere.join(' AND ')}
          AND COALESCE(NULLIF(consolidation_summary, ''), '') <> ''
        ORDER BY COALESCE(NULLIF(updated_at, 0), NULLIF(classified_at, 0), NULLIF(created_at, 0), id) DESC, id ASC
    `).all(...baseParams);
    const grouped = new Map();
    for (const row of rows) {
        const character = charById.get(String(row.character_id)) || { id: row.character_id, name: row.character_id };
        const summary = clipMemoryDisplayText(row.consolidation_summary || '', 720);
        if (!summary) continue;
        const groupKey = [
            row.character_id || '',
            row.consolidation_key || '',
            String(summary).toLowerCase()
        ].join('::');
        const existing = grouped.get(groupKey);
        const sourceText = clipMemoryDisplayText(row.summary || row.content || row.event || '', 180);
        const sourceContext = inferMemorySourceContext(row);
        const sceneTag = inferMemorySceneTag(row, sourceContext);
        const item = existing || {
            id: groupKey,
            character_id: row.character_id,
            character_name: character.name || row.character_id,
            summary,
            memory_focus: row.memory_focus || 'general',
            memory_tier: row.memory_tier || 'ambient',
            importance: Number(row.importance || 5),
            consolidation_key: row.consolidation_key || '',
            retention_action: row.retention_action || '',
            classification_source: row.classification_source || '',
            source_context: sourceContext,
            scene_tag: sceneTag,
            source_contexts: [],
            scene_tags: [],
            source_ids: [],
            source_count: 0,
            source_preview: [],
            retrieval_count: 0,
            last_retrieved_at: 0,
            created_at: Number(row.created_at || 0),
            updated_at: Number(row.updated_at || row.classified_at || row.created_at || 0),
            source_started_at: Number(row.source_started_at || 0),
            source_ended_at: Number(row.source_ended_at || row.source_started_at || 0),
            _source_rows: []
        };
        if (sourceContext && !item.source_contexts.includes(sourceContext)) item.source_contexts.push(sourceContext);
        if (sceneTag && !item.scene_tags.includes(sceneTag)) item.scene_tags.push(sceneTag);
        if ((!item.source_context || item.source_context === 'unknown') && sourceContext && sourceContext !== 'unknown') {
            item.source_context = sourceContext;
        }
        if ((!item.scene_tag || item.scene_tag === 'none' || item.scene_tag === 'other') && sceneTag && !['none', 'other'].includes(sceneTag)) {
            item.scene_tag = sceneTag;
        }
        item.source_ids.push(row.id);
        item.source_count += 1;
        item._source_rows.push(row);
        item.retrieval_count += Number(row.retrieval_count || 0);
        item.last_retrieved_at = Math.max(Number(item.last_retrieved_at || 0), Number(row.last_retrieved_at || 0));
        item.importance = Math.max(item.importance, Number(row.importance || 5));
        item.updated_at = Math.max(Number(item.updated_at || 0), Number(row.updated_at || row.classified_at || 0));
        item.created_at = Math.min(Number(item.created_at || row.created_at || 0), Number(row.created_at || item.created_at || 0));
        const rowSourceStartedAt = Number(row.source_started_at || 0);
        const rowSourceEndedAt = Number(row.source_ended_at || row.source_started_at || 0);
        if (rowSourceStartedAt > 0) {
            item.source_started_at = item.source_started_at > 0
                ? Math.min(Number(item.source_started_at || 0), rowSourceStartedAt)
                : rowSourceStartedAt;
        }
        if (rowSourceEndedAt > 0) {
            item.source_ended_at = Math.max(Number(item.source_ended_at || 0), rowSourceEndedAt);
        }
        if (row.memory_tier === 'core' || (row.memory_tier === 'active' && item.memory_tier === 'ambient')) {
            item.memory_tier = row.memory_tier;
        }
        if (row.retention_action === 'merge_candidate') item.retention_action = 'merge_candidate';
        if (sourceText && item.source_preview.length < 4) {
            item.source_preview.push({ id: row.id, text: sourceText });
        }
        grouped.set(groupKey, item);
    }
    const items = Array.from(grouped.values())
        .map(item => applyFormalMemoryForgettingState(item, rawDb, now, { persistGrace: false }))
        .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
    const curveItems = items
        .filter(item => !item.protected && item.days_until_threshold !== null && item.days_until_threshold !== undefined)
        .sort(compareMemoryForgettingItems);
    const categories = definitions.map(def => {
        const categoryItems = items.filter(item => item.memory_focus === def.key);
        return {
            key: def.key,
            label: def.label,
            description: def.description,
            count: categoryItems.length,
            limit: showAll ? categoryItems.length : limitPerGroup,
            has_more: !showAll && categoryItems.length > limitPerGroup,
            items: showAll ? categoryItems : categoryItems.slice(0, limitPerGroup)
        };
    }).filter(group => group.count > 0 || ['user_profile', 'relationship', 'user_current_arc', 'general'].includes(group.key));
    const sourceGroups = MEMORY_SOURCE_CONTEXT_DEFINITIONS.map(def => {
        const sourceItems = items.filter(item => {
            if (Array.isArray(item.source_contexts) && item.source_contexts.length > 0) {
                return item.source_contexts.includes(def.key);
            }
            return item.source_context === def.key;
        });
        return {
            key: def.key,
            label: def.label,
            description: def.description,
            count: sourceItems.length,
            limit: showAll ? sourceItems.length : limitPerGroup,
            has_more: !showAll && sourceItems.length > limitPerGroup,
            items: showAll ? sourceItems : sourceItems.slice(0, limitPerGroup)
        };
    });
    return {
        total: items.length,
        source_total: rows.length,
        categories,
        source_groups: sourceGroups,
        forgetting_groups: buildMemoryForgettingGroups(curveItems, showAll, forgettingLimit, 'new')
    };
}

function getMemoryMaintenanceLibrary(rawDb, options = {}) {
    const showAll = parseBooleanFlag(options.all);
    const limitPerGroup = showAll ? null : clampMemoryLibraryLimit(options.limit_per_group, 28, 120);
    const forgettingLimit = showAll ? null : clampMemoryLibraryLimit(options.forgetting_limit, 70, 160);
    const characterId = String(options.character_id || '').trim();
    const temporalFilter = String(options.temporal_filter || 'all').trim();
    const sourceMode = String(options.source || 'new').trim() === 'legacy' ? 'legacy' : 'new';
    const characters = rawDb.prepare('SELECT id, name, avatar FROM characters ORDER BY name COLLATE NOCASE ASC').all();
    const charById = new Map(characters.map(c => [String(c.id), c]));
    const now = Date.now();
    const rowSelect = getMemoryLibraryRowSelect(rawDb);
    const baseWhere = ['COALESCE(is_archived, 0) = 0'];
    const baseParams = [];
    if (sourceMode === 'new') {
        baseWhere.push("COALESCE(NULLIF(consolidation_summary, ''), '') <> ''");
    }
    if (characterId) {
        baseWhere.push('character_id = ?');
        baseParams.push(characterId);
    }
    if (sourceMode === 'new' && temporalFilter === 'temporal_signal') {
        baseWhere.push(getMemoryTemporalSignalSql());
        baseParams.push(...getMemoryTemporalSignalParams());
    }
    const graceRows = rawDb.prepare(`
        SELECT ${rowSelect}
        FROM memories
        WHERE ${baseWhere.join(' AND ')}
    `).all(...baseParams);
    if (sourceMode === 'legacy') {
        ensureForgettingGraceWindows(rawDb, graceRows, now);
    }

    const focusCounts = rawDb.prepare(`
        SELECT COALESCE(NULLIF(memory_focus, ''), 'general') AS memory_focus, COUNT(*) AS count
        FROM memories
        WHERE ${baseWhere.join(' AND ')}
        GROUP BY COALESCE(NULLIF(memory_focus, ''), 'general')
        ORDER BY count DESC
    `).all(...baseParams);
    const knownKeys = new Set(MEMORY_LIBRARY_FOCUS_DEFINITIONS.map(item => item.key));
    const extraDefinitions = focusCounts
        .filter(item => !knownKeys.has(item.memory_focus))
        .map(item => ({
            key: item.memory_focus,
            label: `${item.memory_focus} 分类`,
            description: '小模型或历史数据写入的扩展分类。后续可以补充专门规则，暂时按原分类名展示。'
        }));
    const definitions = [...MEMORY_LIBRARY_FOCUS_DEFINITIONS, ...extraDefinitions];

    const categories = definitions.map(def => {
        const where = [...baseWhere, "COALESCE(NULLIF(memory_focus, ''), 'general') = ?"];
        const params = [...baseParams, def.key];
        const count = Number(rawDb.prepare(`SELECT COUNT(*) AS c FROM memories WHERE ${where.join(' AND ')}`).get(...params)?.c || 0);
        const rows = rawDb.prepare(`
            SELECT ${rowSelect}
            FROM memories
            WHERE ${where.join(' AND ')}
            ORDER BY COALESCE(NULLIF(updated_at, 0), NULLIF(created_at, 0), id) DESC, id DESC
            ${showAll ? '' : 'LIMIT ?'}
        `).all(...params, ...(showAll ? [] : [limitPerGroup]));
        return {
            ...def,
            count,
            limit: showAll ? count : limitPerGroup,
            has_more: !showAll && count > rows.length,
            items: rows.map(row => buildMemoryLibraryItem(row, charById, now))
        };
    }).filter(group => group.count > 0 || knownKeys.has(group.key));

    const newLibrary = buildNewMemorySummaryLibrary(rawDb, charById, definitions, baseWhere, baseParams, {
        now,
        showAll,
        forgettingLimit,
        limitPerGroup
    });

    const forgettingRows = rawDb.prepare(`
        SELECT ${rowSelect}
        FROM memories
        WHERE ${baseWhere.join(' AND ')}
    `).all(...baseParams);
    const curveItems = forgettingRows
        .map(row => buildMemoryLibraryItem(row, charById, now))
        .filter(item => !item.protected && item.days_until_threshold !== null && item.days_until_threshold !== undefined)
        .sort(compareMemoryForgettingItems);
    const legacyForgettingGroups = buildMemoryForgettingGroups(curveItems, showAll, forgettingLimit, 'legacy');

    return {
        all: showAll,
        source: sourceMode,
        temporal_filter: temporalFilter,
        limit_per_group: limitPerGroup,
        forgetting_limit: forgettingLimit,
        categories,
        new_library: newLibrary,
        forgetting_groups: sourceMode === 'new' ? (newLibrary.forgetting_groups || []) : legacyForgettingGroups
    };
}

function getMemoryMaintenanceOverview(rawDb) {
    const characters = rawDb.prepare('SELECT id, name, avatar FROM characters ORDER BY name COLLATE NOCASE ASC').all();
    const charById = new Map(characters.map(c => [String(c.id), c]));
    const rowSelect = getMemoryLibraryRowSelect(rawDb);
    const allRows = rawDb.prepare(`SELECT ${rowSelect} FROM memories ORDER BY id ASC`).all();
    const rows = allRows.filter(row => String(row.consolidation_summary || '').trim());
    const legacyRows = allRows.filter(row => {
        const sourceContext = String(row.source_context || '').trim();
        const source = String(row.classification_source || '').trim();
        const dedupeKey = String(row.dedupe_key || '').trim();
        const hasFormalSummary = !!String(row.consolidation_summary || '').trim();
        const externalFormalOnly = sourceContext === 'external_app'
            && hasFormalSummary
            && (source === 'external-import-direct'
                || source === 'small-model-auto-migration'
                || dedupeKey.startsWith('external-import-direct:')
                || dedupeKey.startsWith('external-import-formal:'));
        return !externalFormalOnly;
    });
    const formalNewKeys = new Set();
    const formalNewKeysByCharacter = new Map();
    const legacyByCharacter = new Map();
    for (const row of legacyRows) {
        const key = String(row.character_id || '');
        if (!key) continue;
        const character = charById.get(key) || { id: key, name: key };
        if (!legacyByCharacter.has(key)) {
            legacyByCharacter.set(key, {
                character_id: row.character_id,
                name: character.name || key,
                total: 0,
                pending: 0,
                new_total: 0
            });
        }
        const legacyStats = legacyByCharacter.get(key);
        legacyStats.total += 1;
        if (String(row.consolidation_summary || '').trim()) {
            legacyStats.new_total += 1;
        }
        const maintenanceStatus = String(row.maintenance_status || 'pending');
        if (!maintenanceStatus || maintenanceStatus === 'pending') {
            legacyStats.pending += 1;
        }
    }
    const externalPendingByCharacter = getExternalImportPendingStatsByCharacter(rawDb);
    for (const [key, externalStats] of externalPendingByCharacter.entries()) {
        const character = charById.get(key) || { id: key, name: externalStats.name || key };
        if (!legacyByCharacter.has(key)) {
            legacyByCharacter.set(key, {
                character_id: character.id,
                name: character.name || key,
                total: 0,
                pending: 0,
                new_total: 0
            });
        }
        const legacyStats = legacyByCharacter.get(key);
        legacyStats.external_pending = Number(externalStats.pending || 0);
        legacyStats.external_total = Number(externalStats.total || 0);
        legacyStats.pending += Number(externalStats.pending || 0);
        legacyStats.total += Number(externalStats.total || 0);
    }
    const now = Date.now();
    const totals = {
        total: rows.length,
        migrated_card_total: rows.length,
        formal_total: 0,
        legacy_total: legacyRows.length,
        legacy_pending: legacyRows.filter(row => !String(row.maintenance_status || 'pending') || String(row.maintenance_status || 'pending') === 'pending').length,
        external_pending: Array.from(externalPendingByCharacter.values()).reduce((sum, item) => sum + Number(item.pending || 0), 0),
        active: 0,
        archived: 0,
        pending: 0,
        classified: 0,
        total_retrieval_count: 0,
        recalled_memories: 0,
        never_recalled: 0
    };
    totals.legacy_pending += totals.external_pending;
    const byFocus = {};
    const byTier = {};
    const byAction = {};
    const byCharacter = new Map();
    const forgettingBuckets = {
        protected: 0,
        now: 0,
        within_7_days: 0,
        within_14_days: 0,
        within_30_days: 0,
        later: 0,
        no_curve: 0
    };
    const upcoming = [];

    for (const row of rows) {
        const character = charById.get(String(row.character_id)) || { id: row.character_id, name: row.character_id };
        if (!byCharacter.has(row.character_id)) {
            byCharacter.set(row.character_id, {
                character_id: row.character_id,
                name: character.name || row.character_id,
                total: 0,
                migrated_card_total: 0,
                formal_total: 0,
                active: 0,
                archived: 0,
                pending: 0,
                classified: 0,
                retrieval_count: 0,
                archive_candidates: 0
            });
        }
        const charStats = byCharacter.get(row.character_id);
        charStats.total += 1;
        charStats.migrated_card_total += 1;
        const formalKey = [
            row.character_id || '',
            row.consolidation_key || '',
            String(row.consolidation_summary || '').trim().toLowerCase()
        ].join('::');
        formalNewKeys.add(formalKey);
        if (!formalNewKeysByCharacter.has(row.character_id)) {
            formalNewKeysByCharacter.set(row.character_id, new Set());
        }
        formalNewKeysByCharacter.get(row.character_id).add(formalKey);
        const archived = Number(row.is_archived || 0) === 1;
        if (archived) {
            totals.archived += 1;
            charStats.archived += 1;
        } else {
            totals.active += 1;
            charStats.active += 1;
        }
        const maintenanceStatus = String(row.maintenance_status || 'pending');
        if (!maintenanceStatus || maintenanceStatus === 'pending') {
            totals.pending += 1;
            charStats.pending += 1;
        } else if (maintenanceStatus === 'classified') {
            totals.classified += 1;
            charStats.classified += 1;
        }
        const retrievalCount = Number(row.retrieval_count || 0);
        totals.total_retrieval_count += retrievalCount;
        charStats.retrieval_count += retrievalCount;
        if (retrievalCount > 0) totals.recalled_memories += 1;
        else totals.never_recalled += 1;

        if (!archived) {
            incrementCount(byFocus, row.memory_focus || 'general');
            incrementCount(byTier, row.memory_tier || 'ambient');
            const retention = computeMemoryRetention(row, now);
            const daysUntil = computeDaysUntilRetentionThreshold(row, retention);
            incrementCount(byAction, retention.suggested_action);
            if (retention.suggested_action === 'archive_candidate') {
                charStats.archive_candidates += 1;
            }
            if (retention.protected) {
                forgettingBuckets.protected += 1;
            } else if (daysUntil === null) {
                forgettingBuckets.no_curve += 1;
            } else if (daysUntil <= 0) {
                forgettingBuckets.now += 1;
            } else if (daysUntil <= 7) {
                forgettingBuckets.within_7_days += 1;
            } else if (daysUntil <= 14) {
                forgettingBuckets.within_14_days += 1;
            } else if (daysUntil <= 30) {
                forgettingBuckets.within_30_days += 1;
            } else {
                forgettingBuckets.later += 1;
            }
            if (!retention.protected && daysUntil !== null && daysUntil <= 30) {
                const forgettingWindow = computeMemoryForgettingWindow(row, retention, now);
                upcoming.push({
                    id: row.id,
                    character_id: row.character_id,
                    character_name: character.name || row.character_id,
                    memory_focus: row.memory_focus || 'general',
                    memory_tier: row.memory_tier || 'ambient',
                    importance: Number(row.importance || 5),
                    retrieval_count: retrievalCount,
                    retention_score: retention.retention_score,
                    retention_action: retention.suggested_action,
                    days_until_threshold: daysUntil,
                    forgetting_stage: forgettingWindow.stage,
                    threshold_at: forgettingWindow.threshold_at,
                    grace_expires_at: forgettingWindow.grace_expires_at,
                    days_until_grace_expires: forgettingWindow.days_until_grace_expires,
                    routine_city: !!retention.routine_city
                });
            }
        }
    }
    totals.formal_total = formalNewKeys.size;
    for (const legacyStats of legacyByCharacter.values()) {
        if (!byCharacter.has(legacyStats.character_id)) {
            byCharacter.set(legacyStats.character_id, {
                character_id: legacyStats.character_id,
                name: legacyStats.name || legacyStats.character_id,
                total: 0,
                migrated_card_total: 0,
                formal_total: 0,
                active: 0,
                archived: 0,
                pending: 0,
                classified: 0,
                retrieval_count: 0,
                archive_candidates: 0
            });
        }
        const charStats = byCharacter.get(legacyStats.character_id);
        charStats.legacy_total = legacyStats.total;
        charStats.legacy_pending = legacyStats.pending;
        charStats.external_pending = Number(legacyStats.external_pending || 0);
        charStats.external_total = Number(legacyStats.external_total || 0);
        charStats.migrated_total = legacyStats.new_total;
        charStats.migrated_card_total = legacyStats.new_total;
        charStats.formal_total = formalNewKeysByCharacter.get(legacyStats.character_id)?.size || 0;
        charStats.needs_migration = legacyStats.new_total < legacyStats.total;
    }
    for (const charStats of byCharacter.values()) {
        if (charStats.legacy_total === undefined) {
            charStats.legacy_total = 0;
            charStats.legacy_pending = 0;
            charStats.migrated_total = 0;
            charStats.formal_total = formalNewKeysByCharacter.get(charStats.character_id)?.size || charStats.formal_total || 0;
            charStats.needs_migration = false;
        }
    }
    const byCharacterList = Array.from(byCharacter.values()).sort((a, b) => {
        const totalDiff = Number(b.total || 0) - Number(a.total || 0);
        if (totalDiff !== 0) return totalDiff;
        return Number(b.legacy_total || 0) - Number(a.legacy_total || 0);
    });
    const migrationCharacters = Array.from(legacyByCharacter.values())
        .map(stats => ({
            ...stats,
            migrated_card_total: stats.new_total,
            formal_total: formalNewKeysByCharacter.get(stats.character_id)?.size || 0
        }))
        .sort((a, b) => {
            const pendingDiff = Number(b.pending || 0) - Number(a.pending || 0);
            if (pendingDiff !== 0) return pendingDiff;
            return Number(b.total || 0) - Number(a.total || 0);
        });

    return {
        totals,
        by_focus: Object.entries(byFocus).map(([memory_focus, count]) => ({ memory_focus, count })).sort((a, b) => b.count - a.count),
        by_tier: Object.entries(byTier).map(([memory_tier, count]) => ({ memory_tier, count })).sort((a, b) => b.count - a.count),
        by_action: Object.entries(byAction).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count),
        forgetting_buckets: forgettingBuckets,
        by_character: byCharacterList,
        legacy_by_character: migrationCharacters,
        migration_characters: migrationCharacters,
        upcoming_forgetting: upcoming.sort((a, b) => a.days_until_threshold - b.days_until_threshold).slice(0, 80)
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

function isMaskedSecretInput(value) {
    return /^(\u2022{2,}|\*{2,})/.test(String(value || '').trim());
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
    if (isMaskedSecretInput(safeBody.api_key) && currentSettings.api_key) {
        delete safeBody.api_key;
    }
    const patch = normalizeMemoryMaintenanceSettingsPatch(safeBody);
    db.updateUserProfile?.(patch);
    return getMemoryMaintenanceSettings(db);
}

function normalizeManualMemoryPatch(body = {}) {
    const now = Date.now();
    const patch = {};
    const setString = (field, maxLen = 2000) => {
        if (!Object.prototype.hasOwnProperty.call(body, field)) return;
        patch[field] = String(body[field] ?? '').trim().slice(0, maxLen);
    };
    setString('summary', 1000);
    setString('content', 4000);
    setString('event', 1000);
    setString('consolidation_summary', 2000);
    setString('consolidation_key', 160);
    setString('source_app', 80);
    setString('time', 240);
    setString('location', 240);
    setString('emotion', 500);
    if (Object.prototype.hasOwnProperty.call(body, 'memory_focus')) {
        const value = String(body.memory_focus || '').trim();
        if (!MEMORY_MAINTENANCE_FOCUS.has(value)) {
            const error = new Error(`Invalid memory_focus: ${value}`);
            error.status = 400;
            throw error;
        }
        patch.memory_focus = value;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'memory_tier')) {
        const value = String(body.memory_tier || '').trim();
        if (!MEMORY_MAINTENANCE_TIERS.has(value)) {
            const error = new Error(`Invalid memory_tier: ${value}`);
            error.status = 400;
            throw error;
        }
        patch.memory_tier = value;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'source_context')) {
        const value = String(body.source_context || '').trim();
        if (value && !MEMORY_SOURCE_CONTEXTS.has(value)) {
            const error = new Error(`Invalid source_context: ${value}`);
            error.status = 400;
            throw error;
        }
        patch.source_context = value;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'scene_tag')) {
        const value = String(body.scene_tag || '').trim();
        if (value && !MEMORY_SCENE_TAGS.has(value)) {
            const error = new Error(`Invalid scene_tag: ${value}`);
            error.status = 400;
            throw error;
        }
        patch.scene_tag = value;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'importance')) {
        patch.importance = clampNumber(body.importance, 5, 1, 10);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'is_archived')) {
        patch.is_archived = parseBooleanFlag(body.is_archived) ? 1 : 0;
    }
    if (Object.keys(patch).length === 0) {
        const error = new Error('No editable memory fields provided.');
        error.status = 400;
        throw error;
    }
    patch.maintenance_status = 'classified';
    patch.classification_source = 'manual-edit';
    patch.classified_at = now;
    patch.updated_at = now;
    return patch;
}

function buildMemoryIndexTargets(db, rows = []) {
    const targetsByMemoryId = new Map();
    const ids = Array.from(new Set((Array.isArray(rows) ? rows : [])
        .map(row => Number(row?.id || 0))
        .filter(id => id > 0)));

    for (const row of rows || []) {
        const memoryId = Number(row?.id || 0);
        if (!memoryId) continue;
        const targets = targetsByMemoryId.get(memoryId) || new Map();
        const characterId = String(row?.character_id || '').trim();
        if (characterId) {
            targets.set(characterId, {
                characterId,
                previousRow: { ...row }
            });
        }
        targetsByMemoryId.set(memoryId, targets);
    }

    const rawDb = typeof db?.getRawDb === 'function' ? db.getRawDb() : null;
    if (rawDb && ids.length > 0) {
        try {
            const placeholders = ids.map(() => '?').join(',');
            const bindings = rawDb.prepare(`
                SELECT memory_id, character_id, character_name
                FROM external_memory_role_bindings
                WHERE memory_id IN (${placeholders})
            `).all(...ids);
            const rowsById = new Map((rows || []).map(row => [Number(row?.id || 0), row]));
            for (const binding of bindings || []) {
                const memoryId = Number(binding.memory_id || 0);
                const characterId = String(binding.character_id || '').trim();
                if (!memoryId || !characterId) continue;
                const sourceRow = rowsById.get(memoryId) || {};
                const targets = targetsByMemoryId.get(memoryId) || new Map();
                targets.set(characterId, {
                    characterId,
                    previousRow: {
                        ...sourceRow,
                        shared_binding: 1,
                        bound_character_id: characterId,
                        bound_character_name: String(binding.character_name || '')
                    }
                });
                targetsByMemoryId.set(memoryId, targets);
            }
        } catch (e) {
            console.warn('[Memory] Failed to read external memory role bindings for index cleanup:', e.message);
        }
    }

    return targetsByMemoryId;
}

function rescueMemoryMaintenanceItems(rawDb, ids = []) {
    const safeIds = Array.from(new Set((Array.isArray(ids) ? ids : [])
        .map(id => Number(id || 0))
        .filter(id => id > 0)))
        .slice(0, 200);
    if (safeIds.length === 0) return { rescued: 0, characterIds: [] };
    const now = Date.now();
    const rows = rawDb.prepare(`SELECT id, character_id, memory_tier, importance FROM memories WHERE id IN (${safeIds.map(() => '?').join(', ')})`).all(...safeIds);
    const stmt = rawDb.prepare(`
        UPDATE memories
        SET is_archived = 0,
            memory_tier = CASE WHEN COALESCE(memory_tier, 'ambient') = 'ambient' THEN 'active' ELSE memory_tier END,
            importance = CASE WHEN COALESCE(importance, 0) < 5 THEN 5 ELSE importance END,
            maintenance_status = 'needs_review',
            classification_source = 'manual-rescue',
            classified_at = ?,
            retention_score = 1,
            retention_action = 'keep',
            retention_reason = 'rescued_by_user',
            retention_checked_at = ?,
            last_retrieved_at = ?,
            archive_reason = '',
            forgetting_grace_started_at = 0,
            forgetting_grace_expires_at = 0,
            updated_at = ?
        WHERE id = ?
    `);
    const tx = rawDb.transaction((items) => {
        for (const row of items) stmt.run(now, now, now, now, row.id);
    });
    tx(rows);
    return {
        rescued: rows.length,
        characterIds: Array.from(new Set(rows.map(row => String(row.character_id || '')).filter(Boolean)))
    };
}
module.exports = {
    configureMemoryMaintenanceService,
    MEMORY_MAINTENANCE_FOCUS,
    MEMORY_MAINTENANCE_TIERS,
    MEMORY_MAINTENANCE_STATUS,
    MEMORY_MAINTENANCE_ACTIONS,
    MEMORY_SOURCE_CONTEXTS,
    MEMORY_SCENE_TAGS,
    MEMORY_SOURCE_CONTEXT_DEFINITIONS,
    MEMORY_TEMPORAL_BINDING_LABELS,
    MEMORY_TEMPORAL_BINDING_SCOPES,
    getMemoryMaintenanceBatch,
    getExternalImportPendingCountForCharacter,
    getExternalImportPendingStatsByCharacter,
    getExternalImportMaintenanceBatch,
    getMemoryTemporalBindingBatch,
    buildMemoryMigrationPrompt,
    buildMemoryTemporalBindingPrompt,
    extractJsonObjectFromText,
    normalizeSmallModelMigrationResult,
    normalizeTemporalBindingResult,
    buildTemporalBindingApplyItems,
    expandTemporalBindingApplyItemsForFormalBatch,
    applyMemoryMaintenanceItems,
    refreshMaintenanceMemoryIndex,
    getMemoryMaintenanceStats,
    runMemoryMaintenanceBatch,
    runMemoryTemporalBindingBatch,
    normalizeMemoryTemporalBindingSource,
    getExpiredForgettingMemoryRows,
    getMemoryMaintenanceLibrary,
    getMemoryMaintenanceOverview,
    getMemoryMaintenanceSettings,
    redactMemoryMaintenanceSettings,
    updateMemoryMaintenanceSettings,
    normalizeManualMemoryPatch,
    buildMemoryIndexTargets,
    rescueMemoryMaintenanceItems
};
