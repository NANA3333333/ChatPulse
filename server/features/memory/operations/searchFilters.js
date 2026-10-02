// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeMemorySearchRequest(queryInput, limit = 5) {
        const requestedLimit = Math.max(1, Math.min(20, Number(limit || 5) || 5));
        if (queryInput && typeof queryInput === 'object' && !Array.isArray(queryInput)) {
            const explicitQueries = Array.isArray(queryInput.queries)
                ? queryInput.queries.map(item => String(item || '').trim()).filter(Boolean).slice(0, 12)
                : [];
            const primaryText = String(queryInput.queryText || explicitQueries[0] || '').trim();
            const filters = queryInput.filters && typeof queryInput.filters === 'object'
                ? queryInput.filters
                : {};
            const relativeText = String(queryInput?.temporal_hint?.relative_text || queryInput?.temporal_hint?.relative || '').trim();
            const absoluteStart = Number(queryInput?.temporal_hint?.absolute_start || 0);
            const absoluteEnd = Number(queryInput?.temporal_hint?.absolute_end || 0);
            const temporalIntent = normalizeSearchTemporalIntent(
                queryInput?.temporal_intent || queryInput?.temporalIntent || null,
                [primaryText, ...explicitQueries].filter(Boolean).join('\n')
            );
            return {
                primaryText,
                explicitQueries,
                filters: {
                    memory_focus: Array.isArray(filters.memory_focus)
                        ? filters.memory_focus.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4)
                        : [],
                    memory_tier: Array.isArray(filters.memory_tier)
                        ? filters.memory_tier.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3)
                        : []
                },
                temporalHint: {
                    ...(relativeText ? { relative_text: relativeText } : {}),
                    ...(Number.isFinite(absoluteStart) && absoluteStart > 0 ? { absolute_start: absoluteStart } : {}),
                    ...(Number.isFinite(absoluteEnd) && absoluteEnd > 0 ? { absolute_end: absoluteEnd } : {})
                },
                temporalIntent,
                limit: Math.max(1, Math.min(20, Number(queryInput.limit || requestedLimit) || requestedLimit))
            };
        }
        const primaryText = String(queryInput || '').trim();
        return {
            primaryText,
            explicitQueries: [],
            filters: { memory_focus: [], memory_tier: [] },
            temporalHint: {},
            temporalIntent: normalizeSearchTemporalIntent(null, primaryText),
            limit: requestedLimit
        };
    }

function clampUnit(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Math.max(0, Math.min(1, parsed));
    }

function inferRecentSearchIntent(text = '') {
        const raw = String(text || '').trim();
        if (!raw) return { mode: 'none', confidence: 0, reason: '' };
        const normalized = raw.toLowerCase();
        const signals = [
            {
                score: 0.82,
                pattern: /(刚刚|刚才|刚提到|刚聊|刚说|最近|近来|这两天|这几天|前几天|今天|昨天|刚发生|刚收到|刚被)/i,
                reason: 'explicit_recent_time_expression'
            },
            {
                score: 0.74,
                pattern: /(新的那个|新那个|新的|这次|这回|另一个|另外一个|不是上次|不是之前|不是以前|不是三月|不是3月)/i,
                reason: 'new_or_not_previous_reference'
            },
            {
                score: 0.58,
                pattern: /(刚提|前面说|上面说|刚才聊|刚刚聊|主动找我|主动联系|主动接触|主动挖掘|看了.*账号|小红书.*找)/i,
                reason: 'contextual_recent_reference'
            }
        ];
        let best = { mode: 'none', confidence: 0, reason: '' };
        for (const signal of signals) {
            if (signal.pattern.test(normalized) && signal.score > best.confidence) {
                best = { mode: 'recent', confidence: signal.score, reason: signal.reason };
            }
        }
        return best;
    }

function normalizeSearchTemporalIntent(rawIntent = null, fallbackText = '') {
        const fallback = inferRecentSearchIntent(fallbackText);
        let normalized = { mode: 'none', confidence: 0, reason: '' };
        if (rawIntent && typeof rawIntent === 'object') {
            const rawMode = String(rawIntent.mode || rawIntent.intent || rawIntent.recency || rawIntent.temporal_mode || '').trim().toLowerCase();
            const mode = ['recent', 'latest', 'new', 'current'].includes(rawMode)
                ? 'recent'
                : (['none', 'neutral', 'unspecified'].includes(rawMode) ? 'none' : '');
            if (mode === 'recent') {
                const confidence = clampUnit(rawIntent.confidence ?? rawIntent.score ?? rawIntent.recent_intent_score ?? 0.65);
                normalized = {
                    mode: 'recent',
                    confidence: confidence > 0 ? confidence : 0.65,
                    reason: String(rawIntent.reason || rawIntent.rationale || '').trim().slice(0, 240)
                };
            }
        } else if (typeof rawIntent === 'string') {
            const rawMode = rawIntent.trim().toLowerCase();
            if (['recent', 'latest', 'new', 'current'].includes(rawMode)) {
                normalized = { mode: 'recent', confidence: 0.65, reason: 'planner_string_recent_intent' };
            }
        }
        if (fallback.mode === 'recent' && fallback.confidence > normalized.confidence) {
            return fallback;
        }
        return normalized;
    }

function startOfLocalDay(input) {
        const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
        date.setHours(0, 0, 0, 0);
        return date;
    }

function endOfLocalDay(input) {
        const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
        date.setHours(23, 59, 59, 999);
        return date;
    }

function addLocalDays(input, days) {
        const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
        date.setDate(date.getDate() + Number(days || 0));
        return date;
    }

function parseChineseNumber(text = '') {
        const normalized = String(text || '').trim();
        if (!normalized) return NaN;
        if (/^\d+$/.test(normalized)) return Number(normalized);
        const digitMap = {
            '零': 0,
            '一': 1,
            '二': 2,
            '两': 2,
            '三': 3,
            '四': 4,
            '五': 5,
            '六': 6,
            '七': 7,
            '八': 8,
            '九': 9
        };
        if (Object.prototype.hasOwnProperty.call(digitMap, normalized)) {
            return digitMap[normalized];
        }
        if (normalized === '十') return 10;
        const match = normalized.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
        if (match) {
            const tens = match[1] ? digitMap[match[1]] : 1;
            const ones = match[2] ? digitMap[match[2]] : 0;
            return tens * 10 + ones;
        }
        return NaN;
    }

function resolveTemporalHintRange(temporalHint = {}, nowTs = Date.now()) {
        const hint = temporalHint && typeof temporalHint === 'object' ? temporalHint : {};
        const absoluteStart = Number(hint.absolute_start || 0);
        const absoluteEnd = Number(hint.absolute_end || 0);
        if (Number.isFinite(absoluteStart) && absoluteStart > 0 && Number.isFinite(absoluteEnd) && absoluteEnd > 0) {
            return {
                start: Math.min(absoluteStart, absoluteEnd),
                end: Math.max(absoluteStart, absoluteEnd),
                source: 'absolute_hint'
            };
        }

        const relativeText = String(hint.relative_text || hint.relative || '').trim();
        if (!relativeText) return null;
        const now = new Date(nowTs);
        const todayStart = startOfLocalDay(now);

        if (/^今天$/i.test(relativeText)) {
            return { start: todayStart.getTime(), end: endOfLocalDay(now).getTime(), source: 'relative_today' };
        }
        if (/^昨天$/i.test(relativeText)) {
            const target = addLocalDays(todayStart, -1);
            return { start: startOfLocalDay(target).getTime(), end: endOfLocalDay(target).getTime(), source: 'relative_yesterday' };
        }
        if (/^前天$/i.test(relativeText)) {
            const target = addLocalDays(todayStart, -2);
            return { start: startOfLocalDay(target).getTime(), end: endOfLocalDay(target).getTime(), source: 'relative_day_before_yesterday' };
        }
        if (/^大前天$/i.test(relativeText)) {
            const target = addLocalDays(todayStart, -3);
            return { start: startOfLocalDay(target).getTime(), end: endOfLocalDay(target).getTime(), source: 'relative_three_days_ago' };
        }

        let match = relativeText.match(/^([零一二两三四五六七八九十百\d]+)\s*天前$/i);
        if (match) {
            const days = parseChineseNumber(match[1]);
            if (days >= 0) {
                const target = addLocalDays(todayStart, -days);
                return { start: startOfLocalDay(target).getTime(), end: endOfLocalDay(target).getTime(), source: 'relative_n_days_ago' };
            }
        }

        match = relativeText.match(/^([零一二两三四五六七八九十百\d]+)\s*周前$/i);
        if (match) {
            const weeks = parseChineseNumber(match[1]);
            if (weeks >= 0) {
                const weekdayOffset = (todayStart.getDay() + 6) % 7;
                const weekStart = addLocalDays(todayStart, -weekdayOffset - (weeks * 7));
                const weekEnd = endOfLocalDay(addLocalDays(weekStart, 6));
                return { start: weekStart.getTime(), end: weekEnd.getTime(), source: 'relative_n_weeks_ago' };
            }
        }

        if (/^上周$/i.test(relativeText)) {
            const weekdayOffset = (todayStart.getDay() + 6) % 7;
            const weekStart = addLocalDays(todayStart, -weekdayOffset - 7);
            const weekEnd = endOfLocalDay(addLocalDays(weekStart, 6));
            return { start: weekStart.getTime(), end: weekEnd.getTime(), source: 'relative_last_week' };
        }

        if (/^这周$|^本周$/i.test(relativeText)) {
            const weekdayOffset = (todayStart.getDay() + 6) % 7;
            const weekStart = addLocalDays(todayStart, -weekdayOffset);
            const weekEnd = endOfLocalDay(addLocalDays(weekStart, 6));
            return { start: weekStart.getTime(), end: weekEnd.getTime(), source: 'relative_this_week' };
        }

        match = relativeText.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]) - 1;
            const day = Number(match[3]);
            const target = new Date(year, month, day);
            if (!Number.isNaN(target.getTime())) {
                return { start: startOfLocalDay(target).getTime(), end: endOfLocalDay(target).getTime(), source: 'absolute_date_text' };
            }
        }

        match = relativeText.match(/^(\d{1,2})月(\d{1,2})日$/);
        if (match) {
            const year = now.getFullYear();
            const month = Number(match[1]) - 1;
            const day = Number(match[2]);
            const target = new Date(year, month, day);
            if (!Number.isNaN(target.getTime())) {
                return { start: startOfLocalDay(target).getTime(), end: endOfLocalDay(target).getTime(), source: 'month_day_text' };
            }
        }

        return null;
    }

function getMemoryEffectiveTimeRange(memoryRow) {
        const start = Number(memoryRow?.source_started_at || 0);
        const end = Number(memoryRow?.source_ended_at || 0);
        if (start > 0 || end > 0) {
            const safeStart = start > 0 ? start : end;
            const safeEnd = end > 0 ? end : start;
            return {
                start: Math.min(safeStart, safeEnd),
                end: Math.max(safeStart, safeEnd),
                source: 'source_range'
            };
        }
        const createdAt = Number(memoryRow?.created_at || 0);
        if (createdAt > 0) {
            return { start: createdAt, end: createdAt, source: 'created_at' };
        }
        return null;
    }

function getMemoryTemporalAnchor(memoryRow) {
        const start = Number(memoryRow?.source_started_at || 0);
        if (start > 0) return start;
        const end = Number(memoryRow?.source_ended_at || 0);
        if (end > 0) return end;
        const createdAt = Number(memoryRow?.created_at || 0);
        if (createdAt > 0) return createdAt;
        return 0;
    }

function getMemoryRecencyAnchor(memoryRow) {
        const end = Number(memoryRow?.source_ended_at || 0);
        if (end > 0) return end;
        const start = Number(memoryRow?.source_started_at || 0);
        if (start > 0) return start;
        const updatedAt = Number(memoryRow?.updated_at || 0);
        if (updatedAt > 0) return updatedAt;
        const createdAt = Number(memoryRow?.created_at || 0);
        if (createdAt > 0) return createdAt;
        return 0;
    }

function computeRecencyScoreAdjustment(memoryRow, temporalIntent = {}, nowTs = Date.now()) {
        const mode = String(temporalIntent?.mode || '').trim().toLowerCase();
        const confidence = clampUnit(temporalIntent?.confidence || 0);
        if (mode !== 'recent' || confidence < 0.2) return 0;
        const anchor = getMemoryRecencyAnchor(memoryRow);
        if (!(anchor > 0)) return 0;
        const ageDays = Math.max(0, (Number(nowTs || Date.now()) - anchor) / (24 * 60 * 60 * 1000));
        let freshness = 0;
        if (ageDays <= 1) freshness = 0.9;
        else if (ageDays <= 3) freshness = 0.78;
        else if (ageDays <= 7) freshness = 0.62;
        else if (ageDays <= 14) freshness = 0.46;
        else if (ageDays <= 30) freshness = 0.28;
        else if (ageDays <= 90) freshness = -0.08;
        else freshness = -0.18;
        return freshness * confidence;
    }

function computeRetentionSearchAdjustment(memoryRow = {}) {
        const action = String(memoryRow?.retention_action || '').trim().toLowerCase();
        if (!action) return 0;
        if (action === 'superseded') return -0.65;
        if (['archive', 'archived', 'forget', 'delete', 'deprecated', 'drop'].includes(action)) return -0.9;
        return 0;
    }

function memoryOverlapsTemporalRange(memoryRow, temporalRange) {
        if (!temporalRange?.start || !temporalRange?.end) return true;
        const memoryRange = getMemoryEffectiveTimeRange(memoryRow);
        if (!memoryRange) return false;
        return memoryRange.start <= temporalRange.end && memoryRange.end >= temporalRange.start;
    }

function computeTemporalScoreAdjustment(memoryRow, temporalRange) {
        if (!temporalRange?.start || !temporalRange?.end) return 0;
        const memoryRange = getMemoryEffectiveTimeRange(memoryRow);
        if (!memoryRange) return -0.6;
        if (memoryRange.start <= temporalRange.end && memoryRange.end >= temporalRange.start) {
            return 0.4;
        }
        const targetCenter = (temporalRange.start + temporalRange.end) / 2;
        const memoryCenter = (memoryRange.start + memoryRange.end) / 2;
        const dayDistance = Math.abs(memoryCenter - targetCenter) / (24 * 60 * 60 * 1000);
        return -Math.min(1.5, 0.2 + (dayDistance * 0.15));
    }

function computeTemporalAnchorPenalty(memoryRow, temporalRange) {
        if (!temporalRange?.start || !temporalRange?.end) return 0;
        const anchor = getMemoryTemporalAnchor(memoryRow);
        if (!(anchor > 0)) return -0.8;
        if (anchor >= temporalRange.start && anchor <= temporalRange.end) return 0.45;
        const targetCenter = (temporalRange.start + temporalRange.end) / 2;
        const dayDistance = Math.abs(anchor - targetCenter) / (24 * 60 * 60 * 1000);
        return -Math.min(2.2, 0.35 + (dayDistance * 0.35));
    }

function buildMemorySearchFilter(characterId, filters = {}, temporalRange = null) {
        const must = [
            { key: 'character_id', match: { value: String(characterId) } },
            { key: 'is_archived', match: { value: 0 } },
            { key: 'memory_library_source', match: { value: 'new' } },
            { key: 'memory_index_version', match: { value: dependencies.MEMORY_RETRIEVAL_SOURCE_VERSION } },
            { key: 'memory_index_granularity', match: { value: dependencies.MEMORY_INDEX_GRANULARITY } }
        ];
        const focusList = Array.isArray(filters.memory_focus) ? filters.memory_focus.filter(Boolean) : [];
        const tierList = Array.isArray(filters.memory_tier) ? filters.memory_tier.filter(Boolean) : [];
        if (focusList.length === 1) {
            must.push({ key: 'memory_focus', match: { value: String(focusList[0]) } });
        }
        if (tierList.length === 1) {
            must.push({ key: 'memory_tier', match: { value: String(tierList[0]) } });
        }
        if (temporalRange?.start && temporalRange?.end) {
            must.push({ key: 'source_started_at', range: { lte: Number(temporalRange.end) } });
            must.push({ key: 'source_ended_at', range: { gte: Number(temporalRange.start) } });
        }
        return { must };
    }

function memoryMatchesSearchFilters(memoryRow, filters = {}, temporalRange = null) {
        if (!memoryRow) return false;
        const focusList = Array.isArray(filters.memory_focus) ? filters.memory_focus.filter(Boolean) : [];
        const tierList = Array.isArray(filters.memory_tier) ? filters.memory_tier.filter(Boolean) : [];
        if (focusList.length > 0 && !focusList.includes(String(memoryRow.memory_focus || '').trim())) {
            return false;
        }
        if (tierList.length > 0 && !tierList.includes(String(memoryRow.memory_tier || '').trim())) {
            return false;
        }
        if (temporalRange && !memoryOverlapsTemporalRange(memoryRow, temporalRange)) {
            return false;
        }
        return Number(memoryRow.is_archived || 0) === 0;
    }

    return { normalizeMemorySearchRequest, clampUnit, inferRecentSearchIntent, normalizeSearchTemporalIntent, startOfLocalDay, endOfLocalDay, addLocalDays, parseChineseNumber, resolveTemporalHintRange, getMemoryEffectiveTimeRange, getMemoryTemporalAnchor, getMemoryRecencyAnchor, computeRecencyScoreAdjustment, computeRetentionSearchAdjustment, memoryOverlapsTemporalRange, computeTemporalScoreAdjustment, computeTemporalAnchorPenalty, buildMemorySearchFilter, memoryMatchesSearchFilters };
}

module.exports = { createModule };
