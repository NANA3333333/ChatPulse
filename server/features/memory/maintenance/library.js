// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function buildExternalImportPendingItems(rawDb, characterId) {
    const characterName = dependencies.normalizeExternalCharacterName(dependencies.getExternalCharacterName(rawDb, characterId)).toLowerCase();
    if (!characterName) return [];
    const items = [];
    for (const row of dependencies.getExternalImportRows(rawDb)) {
        const selectedIds = dependencies.safeJsonParse(row.selected_character_ids_json, [])
            .map(id => String(id || ''))
            .filter(Boolean);
        if (!selectedIds.includes(String(characterId))) continue;
        const state = dependencies.normalizeExternalProcessingState(row.memory_ids_json);
        const processedKeys = new Set(state
            .filter(item => String(item.character_id || '') === String(characterId) && item.candidate_id)
            .map(item => item.key || dependencies.makeExternalProcessingKey(row.id, item.candidate_id, characterId)));
        const summary = dependencies.safeJsonParse(row.summary_json, {});
        const candidates = Array.isArray(summary.candidates) ? summary.candidates : [];
        const sourceApp = row.source_app || summary.source_app || 'external_app';
        const appLabel = dependencies.getExternalSourceAppLabel(sourceApp);
        const sceneTag = dependencies.getExternalSceneTag(sourceApp);
        for (const candidate of candidates) {
            const candidateNames = (Array.isArray(candidate.character_names) ? candidate.character_names : [])
                .map(name => dependencies.normalizeExternalCharacterName(name).toLowerCase())
                .filter(Boolean);
            const oneToOneFallback = candidateNames.length === 0 && String(row.import_mode || '') === 'one_to_one' && selectedIds.length === 1;
            if (!candidateNames.includes(characterName) && !oneToOneFallback) continue;
            const key = dependencies.makeExternalProcessingKey(row.id, candidate.id, characterId);
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

function clampMemoryLibraryLimit(value, fallback = 28, max = 120) {
    return Math.max(5, Math.min(max, Number(value || fallback) || fallback));
}

function getMemoryLibraryRowSelect(rawDb, alias = '') {
    const columns = dependencies.getTableColumnSet(rawDb, 'memories');
    const prefix = alias ? `${dependencies.quoteSqlIdentifier(alias)}.` : '';
    const selected = dependencies.MEMORY_LIBRARY_ROW_COLUMNS.filter(column => columns.has(column));
    return selected.map(column => `${prefix}${dependencies.quoteSqlIdentifier(column)}`).join(', ');
}

function buildMemoryLibraryItem(row, charById, now = Date.now()) {
    const character = charById.get(String(row.character_id)) || { id: row.character_id, name: row.character_id };
    const retention = dependencies.computeMemoryRetention(row, now);
    const daysUntilThreshold = dependencies.computeDaysUntilRetentionThreshold(row, retention);
    const forgettingWindow = dependencies.computeMemoryForgettingWindow(row, retention, now);
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
        text: dependencies.clipMemoryDisplayText(text),
        legacy_text: row.consolidation_summary ? dependencies.clipMemoryDisplayText(row.summary || row.content || row.event || '', 260) : '',
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
        source_context: dependencies.inferMemorySourceContext(row),
        scene_tag: dependencies.inferMemorySceneTag(row),
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
        const summary = dependencies.clipMemoryDisplayText(row.consolidation_summary || '', 720);
        if (!summary) continue;
        const groupKey = [
            row.character_id || '',
            row.consolidation_key || '',
            String(summary).toLowerCase()
        ].join('::');
        const existing = grouped.get(groupKey);
        const sourceText = dependencies.clipMemoryDisplayText(row.summary || row.content || row.event || '', 180);
        const sourceContext = dependencies.inferMemorySourceContext(row);
        const sceneTag = dependencies.inferMemorySceneTag(row, sourceContext);
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
        .map(item => dependencies.applyFormalMemoryForgettingState(item, rawDb, now, { persistGrace: false }))
        .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
    const curveItems = items
        .filter(item => !item.protected && item.days_until_threshold !== null && item.days_until_threshold !== undefined)
        .sort(dependencies.compareMemoryForgettingItems);
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
    const sourceGroups = dependencies.MEMORY_SOURCE_CONTEXT_DEFINITIONS.map(def => {
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
        forgetting_groups: dependencies.buildMemoryForgettingGroups(curveItems, showAll, forgettingLimit, 'new')
    };
}

function getMemoryMaintenanceLibrary(rawDb, options = {}) {
    const showAll = dependencies.parseBooleanFlag(options.all);
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
        baseWhere.push(dependencies.getMemoryTemporalSignalSql());
        baseParams.push(...dependencies.getMemoryTemporalSignalParams());
    }
    const graceRows = rawDb.prepare(`
        SELECT ${rowSelect}
        FROM memories
        WHERE ${baseWhere.join(' AND ')}
    `).all(...baseParams);
    if (sourceMode === 'legacy') {
        dependencies.ensureForgettingGraceWindows(rawDb, graceRows, now);
    }

    const focusCounts = rawDb.prepare(`
        SELECT COALESCE(NULLIF(memory_focus, ''), 'general') AS memory_focus, COUNT(*) AS count
        FROM memories
        WHERE ${baseWhere.join(' AND ')}
        GROUP BY COALESCE(NULLIF(memory_focus, ''), 'general')
        ORDER BY count DESC
    `).all(...baseParams);
    const knownKeys = new Set(dependencies.MEMORY_LIBRARY_FOCUS_DEFINITIONS.map(item => item.key));
    const extraDefinitions = focusCounts
        .filter(item => !knownKeys.has(item.memory_focus))
        .map(item => ({
            key: item.memory_focus,
            label: `${item.memory_focus} 分类`,
            description: '小模型或历史数据写入的扩展分类。后续可以补充专门规则，暂时按原分类名展示。'
        }));
    const definitions = [...dependencies.MEMORY_LIBRARY_FOCUS_DEFINITIONS, ...extraDefinitions];

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
        .sort(dependencies.compareMemoryForgettingItems);
    const legacyForgettingGroups = dependencies.buildMemoryForgettingGroups(curveItems, showAll, forgettingLimit, 'legacy');

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
            dependencies.incrementCount(byFocus, row.memory_focus || 'general');
            dependencies.incrementCount(byTier, row.memory_tier || 'ambient');
            const retention = dependencies.computeMemoryRetention(row, now);
            const daysUntil = dependencies.computeDaysUntilRetentionThreshold(row, retention);
            dependencies.incrementCount(byAction, retention.suggested_action);
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
                const forgettingWindow = dependencies.computeMemoryForgettingWindow(row, retention, now);
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

    return { buildExternalImportPendingItems, getExternalImportPendingCountForCharacter, getExternalImportPendingStatsByCharacter, getMemoryMaintenanceStats, clampMemoryLibraryLimit, getMemoryLibraryRowSelect, buildMemoryLibraryItem, buildNewMemorySummaryLibrary, getMemoryMaintenanceLibrary, getMemoryMaintenanceOverview, buildMemoryIndexTargets };
}

module.exports = { createModule };
