// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function computeMemoryRetention(row = {}, now = Date.now()) {
    const tier = String(row.memory_tier || 'ambient').trim();
    const focus = String(row.memory_focus || 'general').trim();
    const routineCity = dependencies.detectRoutineCityMemory(row);
    const protectedMemory = dependencies.hasProtectedMemorySignal(row);
    const lastUsefulAt = dependencies.getMemoryLastUsefulAt(row);
    const idleDays = dependencies.daysBetween(now, lastUsefulAt);
    const ageDays = dependencies.daysBetween(now, Number(row.source_ended_at || row.created_at || 0));
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
    const importance = dependencies.clampNumber(row.importance, 5, 1, 10);
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
    const routineCity = retention ? !!retention.routine_city : dependencies.detectRoutineCityMemory(row);
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
    const lastUsefulAt = dependencies.getMemoryLastUsefulAt(row);
    const targetIdleDays = halfLife * (Math.log(threshold) / Math.log(0.5));
    const thresholdAt = lastUsefulAt
        ? Math.round(lastUsefulAt + targetIdleDays * 86400000)
        : Math.round(now + computeDaysUntilRetentionThreshold(row, result) * 86400000);
    const msUntilThreshold = thresholdAt - now;
    let graceStartedAt = null;
    let graceExpiresAt = thresholdAt + dependencies.MEMORY_FORGETTING_GRACE_MS;
    if (msUntilThreshold <= 0) {
        const storedStartedAt = Number(row.forgetting_grace_started_at || 0);
        const storedExpiresAt = Number(row.forgetting_grace_expires_at || 0);
        graceStartedAt = storedStartedAt > 0 ? storedStartedAt : now;
        graceExpiresAt = storedExpiresAt > graceStartedAt
            ? storedExpiresAt
            : graceStartedAt + dependencies.MEMORY_FORGETTING_GRACE_MS;
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
    const columns = dependencies.getTableColumnSet(rawDb, 'memories');
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
                const expiresAt = now + dependencies.MEMORY_FORGETTING_GRACE_MS;
                const info = startStmt.run(now, expiresAt, row.id);
                if (Number(info.changes || 0) > 0) {
                    row.forgetting_grace_started_at = now;
                    row.forgetting_grace_expires_at = expiresAt;
                    started += 1;
                }
            } else if (shouldBeInGrace && existingStartedAt > 0 && existingExpiresAt <= 0) {
                const expiresAt = existingStartedAt + dependencies.MEMORY_FORGETTING_GRACE_MS;
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
    const columns = dependencies.getTableColumnSet(rawDb, 'memories');
    if (!columns.has('forgetting_grace_started_at') || !columns.has('forgetting_grace_expires_at')) {
        return [];
    }
    const rowSelect = dependencies.getMemoryLibraryRowSelect(rawDb);
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
        const existingStartedAt = dependencies.getPositiveMin(rows.map(row => row.forgetting_grace_started_at));
        const existingExpiresAt = dependencies.getPositiveMin(rows.map(row => row.forgetting_grace_expires_at));
        const startedAt = existingStartedAt > 0 ? existingStartedAt : now;
        const expiresAt = existingExpiresAt > startedAt ? existingExpiresAt : startedAt + dependencies.MEMORY_FORGETTING_GRACE_MS;
        virtualRow.forgetting_grace_started_at = startedAt;
        virtualRow.forgetting_grace_expires_at = expiresAt;
        if (persistGrace) {
            dependencies.updateFormalMemoryGraceRows(rawDb, item.source_ids, { started_at: startedAt, expires_at: expiresAt });
        }
    } else {
        virtualRow.forgetting_grace_started_at = 0;
        virtualRow.forgetting_grace_expires_at = 0;
        if (persistGrace) {
            dependencies.updateFormalMemoryGraceRows(rawDb, item.source_ids, { started_at: 0, expires_at: 0 });
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

    return { computeMemoryRetention, getMemoryRetentionThreshold, computeDaysUntilRetentionThreshold, computeMemoryForgettingWindow, ensureForgettingGraceWindows, getExpiredForgettingMemoryRows, compareMemoryForgettingItems, buildMemoryForgettingGroups, applyFormalMemoryForgettingState };
}

module.exports = { createModule };
