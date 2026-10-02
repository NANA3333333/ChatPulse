const { clampImportNumber } = require("../numbers.js");
// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function configureMemoryMaintenanceService(options = {}) {
    if (typeof options.getExternalSourceAppLabel === 'function') {
        dependencies.externalSourceAppLabelResolver = options.getExternalSourceAppLabel;
    }
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

function buildMemoryMaintenancePayload(row, now = Date.now()) {
    const retention = dependencies.computeMemoryRetention(row, now);
    const daysUntilThreshold = dependencies.computeDaysUntilRetentionThreshold(row, retention);
    const forgettingWindow = dependencies.computeMemoryForgettingWindow(row, retention, now);
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
            threshold: dependencies.getMemoryRetentionThreshold(row, retention),
            days_until_threshold: daysUntilThreshold,
            forgetting_window: forgettingWindow
        }
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

function hasCjkText(value = '') {
    return /[\u3400-\u9fff]/.test(String(value || ''));
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
        const sourceContext = dependencies.MEMORY_SOURCE_CONTEXTS.has(String(mem.source_context || '').trim()) ? String(mem.source_context).trim() : 'external_app';
        const firstExternal = sourceItems[0]?.external_import || {};
        const sceneTag = dependencies.MEMORY_SCENE_TAGS.has(String(mem.scene_tag || '').trim())
            ? String(mem.scene_tag).trim()
            : (firstExternal.scene_tag || 'external_app');
        const sourceApp = firstExternal.source_app || 'External';
        const startedValues = sourceItems.map(item => Number(item.signals?.source_started_at || 0)).filter(Boolean);
        const endedValues = sourceItems.map(item => Number(item.signals?.source_ended_at || item.signals?.source_started_at || 0)).filter(Boolean);
        const sourceMessageIds = Array.from(new Set(sourceItems.flatMap(item => item.external_import?.source_message_ids_json || [])));
        const sourceTimeText = firstImportString(...sourceItems.map(item => item.signals?.source_time_text).filter(Boolean));
        const timeBinding = mem.time_binding && typeof mem.time_binding === 'object' ? mem.time_binding : {};
        const isTimeBound = timeBinding.is_time_bound === true;
        const temporalLabel = isTimeBound && dependencies.MEMORY_TEMPORAL_BINDING_LABELS.has(String(timeBinding.label || '').trim()) ? String(timeBinding.label).trim() : '';
        const temporalScope = isTimeBound && dependencies.MEMORY_TEMPORAL_BINDING_SCOPES.has(String(timeBinding.scope || '').trim()) ? String(timeBinding.scope).trim() : '';
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
                memory_focus: dependencies.MEMORY_MAINTENANCE_FOCUS.has(mem.memory_focus) ? mem.memory_focus : 'general',
                memory_tier: dependencies.MEMORY_MAINTENANCE_TIERS.has(mem.memory_tier) ? mem.memory_tier : 'ambient',
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

function incrementCount(map, key, amount = 1) {
    const safeKey = String(key || 'unknown');
    map[safeKey] = Number(map[safeKey] || 0) + Number(amount || 0);
}

function clipMemoryDisplayText(value, max = 520) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

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
    if (dependencies.MEMORY_SOURCE_CONTEXTS.has(existing)) return existing;
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
    if (dependencies.MEMORY_SCENE_TAGS.has(existing)) return existing;
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

function isMaskedSecretInput(value) {
    return /^(\u2022{2,}|\*{2,})/.test(String(value || '').trim());
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
        if (!dependencies.MEMORY_MAINTENANCE_FOCUS.has(value)) {
            const error = new Error(`Invalid memory_focus: ${value}`);
            error.status = 400;
            throw error;
        }
        patch.memory_focus = value;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'memory_tier')) {
        const value = String(body.memory_tier || '').trim();
        if (!dependencies.MEMORY_MAINTENANCE_TIERS.has(value)) {
            const error = new Error(`Invalid memory_tier: ${value}`);
            error.status = 400;
            throw error;
        }
        patch.memory_tier = value;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'source_context')) {
        const value = String(body.source_context || '').trim();
        if (value && !dependencies.MEMORY_SOURCE_CONTEXTS.has(value)) {
            const error = new Error(`Invalid source_context: ${value}`);
            error.status = 400;
            throw error;
        }
        patch.source_context = value;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'scene_tag')) {
        const value = String(body.scene_tag || '').trim();
        if (value && !dependencies.MEMORY_SCENE_TAGS.has(value)) {
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

    return { configureMemoryMaintenanceService, parseBooleanFlag, stripBom, firstImportString, tryParseJsonValue, safeJsonParse, clampNumber, daysBetween, getMemoryLastUsefulAt, detectRoutineCityMemory, hasProtectedMemorySignal, buildMemoryMaintenancePayload, normalizeExternalProcessingState, makeExternalProcessingKey, getExternalSceneTag, cleanExternalSpeakerName, isLikelyUserSpeaker, normalizeExternalCharacterName, getExternalImportRows, getExternalCharacterName, hasCjkText, buildMemoryMaintenanceAttemptError, isNonRetryableMemoryMaintenanceError, buildMemoryMaintenanceNoProgressAttempt, appendExternalImportProcessingEntries, applyExternalImportMigrationItems, incrementCount, clipMemoryDisplayText, quoteSqlIdentifier, getTableColumnSet, parseMemorySourceIds, hasExternalMemorySourceSignal, inferMemorySourceContext, inferMemorySceneTag, getPositiveMin, updateFormalMemoryGraceRows, isMaskedSecretInput, normalizeManualMemoryPatch };
}

module.exports = { createModule };
