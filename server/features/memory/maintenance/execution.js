const { clampImportNumber } = require("../numbers.js");
// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getMemoryMaintenanceBatch(rawDb, characterId, options = {}) {
    const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions(options, { limitFallback: 30 });
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
        } else if (dependencies.MEMORY_MAINTENANCE_STATUS.has(status)) {
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
    const externalPendingCount = status === 'pending' ? dependencies.getExternalImportPendingCountForCharacter(rawDb, characterId) : 0;
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
        items: rows.map(row => dependencies.buildMemoryMaintenancePayload(row, now)),
        next_after_id: rows.length > 0 ? rows[rows.length - 1].id : afterId,
        remaining_pending: Number(remainingPending || 0) + externalPendingCount,
        offset,
        batch_index: Math.floor(offset / limit) + 1,
        total_matching: Number(totalMatching || 0) + externalPendingCount,
        total_batches: Math.max(0, Math.ceil((Number(totalMatching || 0) + externalPendingCount) / limit))
    };
}

function getExternalImportMaintenanceBatch(rawDb, characterId, options = {}) {
    const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions(options, { limitFallback: 30 });
    const limit = batchOptions.limit;
    const offset = batchOptions.offset;
    const allItems = dependencies.buildExternalImportPendingItems(rawDb, characterId);
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
                memory_focus: dependencies.MEMORY_MAINTENANCE_FOCUS.has(candidate.memory_focus) ? candidate.memory_focus : 'general',
                memory_tier: dependencies.MEMORY_MAINTENANCE_TIERS.has(candidate.memory_tier) ? candidate.memory_tier : 'ambient',
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
            const action = String(item.retention_action || existing.retention_action || dependencies.computeMemoryRetention(existing, now).suggested_action || 'keep').trim();
            if (!dependencies.MEMORY_MAINTENANCE_FOCUS.has(focus)) {
                errors.push({ id, error: `Invalid memory_focus: ${focus}` });
                continue;
            }
            if (!dependencies.MEMORY_MAINTENANCE_TIERS.has(tier)) {
                errors.push({ id, error: `Invalid memory_tier: ${tier}` });
                continue;
            }
            if (!dependencies.MEMORY_MAINTENANCE_STATUS.has(status)) {
                errors.push({ id, error: `Invalid maintenance_status: ${status}` });
                continue;
            }
            if (action && !dependencies.MEMORY_MAINTENANCE_ACTIONS.has(action)) {
                errors.push({ id, error: `Invalid retention_action: ${action}` });
                continue;
            }
            const sourceContext = String(item.source_context || existing.source_context || dependencies.inferMemorySourceContext(existing)).trim();
            const sceneTag = String(item.scene_tag || existing.scene_tag || dependencies.inferMemorySceneTag(existing, sourceContext)).trim();
            if (sourceContext && !dependencies.MEMORY_SOURCE_CONTEXTS.has(sourceContext)) {
                errors.push({ id, error: `Invalid source_context: ${sourceContext}` });
                continue;
            }
            if (sceneTag && !dependencies.MEMORY_SCENE_TAGS.has(sceneTag)) {
                errors.push({ id, error: `Invalid scene_tag: ${sceneTag}` });
                continue;
            }
            const hasTemporalLabel = Object.prototype.hasOwnProperty.call(item, 'temporal_label');
            const hasTemporalScope = Object.prototype.hasOwnProperty.call(item, 'temporal_scope');
            const temporalLabel = String(hasTemporalLabel ? item.temporal_label : (existing.temporal_label || '')).trim();
            const temporalScope = String(hasTemporalScope ? item.temporal_scope : (existing.temporal_scope || '')).trim();
            if (temporalLabel && !dependencies.MEMORY_TEMPORAL_BINDING_LABELS.has(temporalLabel)) {
                errors.push({ id, error: `Invalid temporal_label: ${temporalLabel}` });
                continue;
            }
            if (temporalScope && !dependencies.MEMORY_TEMPORAL_BINDING_SCOPES.has(temporalScope)) {
                errors.push({ id, error: `Invalid temporal_scope: ${temporalScope}` });
                continue;
            }
            const retention = dependencies.computeMemoryRetention({ ...existing, memory_focus: focus, memory_tier: tier, importance: item.importance ?? existing.importance }, now);
            const retentionScore = Number.isFinite(Number(item.retention_score)) ? dependencies.clampNumber(item.retention_score, retention.retention_score, 0, 1) : retention.retention_score;
            const existingGraceStartedAt = Number(existing.forgetting_grace_started_at || 0);
            const existingGraceExpiresAt = Number(existing.forgetting_grace_expires_at || 0);
            const startsForgettingGrace = (action || retention.suggested_action) === 'archive_candidate';
            const nextGraceStartedAt = startsForgettingGrace
                ? (existingGraceStartedAt > 0 ? existingGraceStartedAt : now)
                : 0;
            const nextGraceExpiresAt = startsForgettingGrace
                ? (existingGraceExpiresAt > nextGraceStartedAt ? existingGraceExpiresAt : nextGraceStartedAt + dependencies.MEMORY_FORGETTING_GRACE_MS)
                : 0;
            const valuesByColumn = {
                memory_focus: focus,
                memory_tier: tier,
                importance: dependencies.clampNumber(item.importance ?? existing.importance, Number(existing.importance || 5), 1, 10),
                summary: dependencies.firstImportString(item.summary, item.normalized_summary, existing.summary, existing.event),
                content: dependencies.firstImportString(item.content, item.normalized_content, existing.content, existing.event),
                event: dependencies.firstImportString(item.event, item.summary, existing.event, existing.summary),
                source_context: sourceContext,
                scene_tag: sceneTag,
                source_app: dependencies.firstImportString(item.source_app, existing.source_app).slice(0, 80),
                maintenance_status: status,
                classification_source: String(source || 'small-model').slice(0, 80),
                classified_at: now,
                retention_score: retentionScore,
                retention_action: action || retention.suggested_action,
                retention_reason: dependencies.firstImportString(item.retention_reason, item.reason, retention.reason).slice(0, 500),
                retention_checked_at: now,
                consolidation_key: dependencies.firstImportString(item.consolidation_key, item.merge_key, existing.consolidation_key).slice(0, 160),
                consolidation_summary: dependencies.firstImportString(item.consolidation_summary, item.merge_summary, existing.consolidation_summary).slice(0, 2000),
                consolidated_into_memory_id: Math.max(0, Number(item.consolidated_into_memory_id || existing.consolidated_into_memory_id || 0) || 0),
                archive_reason: dependencies.firstImportString(item.archive_reason, existing.archive_reason).slice(0, 500),
                temporal_label: temporalLabel,
                temporal_scope: temporalScope,
                temporal_anchor: dependencies.firstImportString(item.temporal_anchor, existing.temporal_anchor).slice(0, 120),
                temporal_confidence: Number.isFinite(Number(item.temporal_confidence)) ? dependencies.clampNumber(item.temporal_confidence, 0, 0, 1) : Number(existing.temporal_confidence || 0),
                temporal_reason: dependencies.firstImportString(item.temporal_reason, existing.temporal_reason).slice(0, 500),
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

async function runMemoryMaintenanceBatch(rawDb, memory, character, settings, options = {}) {
    const characterId = character.id;
    const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions(options, {
        limitFallback: settings.batch_size || 30
    });
    const batch = getMemoryMaintenanceBatch(rawDb, characterId, {
        limit: batchOptions.limit,
        offset: batchOptions.offset,
        after_id: batchOptions.after_id,
        status: options.status || 'pending',
        include_archived: dependencies.parseBooleanFlag(options.include_archived)
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
    const prompt = dependencies.buildMemoryMigrationPrompt(character, batch, settings);
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
    const normalized = dependencies.normalizeSmallModelMigrationResult(parsed, batch.items.map(item => item.id));
    let applyResult = { updated: 0, errors: [] };
    let indexRefresh = null;
    let indexRefreshWarning = '';
    if (!dependencies.parseBooleanFlag(options.dry_run)) {
        if (batch.source_kind === 'external_import') {
            applyResult = await dependencies.applyExternalImportMigrationItems(
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
        dry_run: dependencies.parseBooleanFlag(options.dry_run),
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
        stats: dependencies.getMemoryMaintenanceStats(rawDb, characterId)
    };
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

    return { getMemoryMaintenanceBatch, getExternalImportMaintenanceBatch, applyMemoryMaintenanceItems, refreshMaintenanceMemoryIndex, runMemoryMaintenanceBatch, rescueMemoryMaintenanceItems };
}

module.exports = { createModule };
