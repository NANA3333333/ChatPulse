// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeSearchText(text = '') {
        return String(text || '')
            .toLowerCase()
            .replace(/open\s+ai/g, 'openai')
            .replace(/sam\s+altman/g, 'samaltman')
            .replace(/[\s_\-"'`.,!?，。！？：:；;（）()【】\[\]]+/g, '');
    }

function buildMemorySearchQueries(queryText = '') {
        const raw = String(queryText || '').trim();
        if (!raw) return [];

        const variants = new Set([raw]);
        const stripped = raw
            .replace(/你还?记得|你记得|我说了什么|我提过什么|关于|还有|那关于|之前|以前|上次|当时|到底|吗|呢|呀|啊/g, ' ')
            .replace(/[？?！!]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (stripped && stripped !== raw) variants.add(stripped);

        for (const rule of dependencies.MEMORY_QUERY_EXPANSIONS) {
            if (rule.pattern.test(raw)) {
                rule.variants.forEach(v => variants.add(v));
            }
        }

        const normalizedSeen = new Set();
        return Array.from(variants)
            .map(v => String(v || '').trim())
            .filter(Boolean)
            .filter(v => {
                const normalized = normalizeSearchText(v);
                if (!normalized || normalizedSeen.has(normalized)) return false;
                normalizedSeen.add(normalized);
                return true;
            })
            .slice(0, 5);
    }

function stripGenericMemoryQuery(text = '') {
        let cleaned = String(text || '').trim();
        for (const phrase of dependencies.GENERIC_MEMORY_SEARCH_STOP_PHRASES) {
            cleaned = cleaned.split(phrase).join(' ');
        }
        return cleaned
            .replace(/[？?！!，,。.:：;；"'“”‘’（）()【】\[\]、]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

function expandBilingualAliases(text = '') {
        const normalized = normalizeSearchText(text);
        if (!normalized) return [];
        const variants = new Set();
        for (const group of dependencies.BILINGUAL_MEMORY_ALIASES) {
            const normalizedGroup = group.map(alias => ({
                raw: alias,
                normalized: normalizeSearchText(alias)
            }));
            if (normalizedGroup.some(alias => alias.normalized && normalized.includes(alias.normalized))) {
                normalizedGroup.forEach(alias => variants.add(alias.raw));
            }
        }
        return Array.from(variants).filter(Boolean);
    }

function expandGenericChineseAnchor(anchor = '') {
        const value = String(anchor || '').trim();
        if (!value) return [];
        const variants = new Set([value]);
        const trimmed = value
            .replace(/(这件事|那件事|事情|情况|内容|相关|方面|一下|一下子|的问题)$/g, '')
            .replace(/^(关于|有关|那个|这个)/g, '')
            .trim();
        if (trimmed && trimmed !== value) variants.add(trimmed);
        if (trimmed.length >= 4 && trimmed.length <= 10) {
            variants.add(trimmed.slice(0, trimmed.length - 1));
        }
        return Array.from(variants).filter(Boolean);
    }

function isUsefulGenericChineseAnchor(anchor = '') {
        const value = String(anchor || '').trim();
        if (!value || value.length < 2) return false;
        if (/^(的|了|和|与|对|把|被|将|给|在|向|从|跟)/.test(value)) return false;
        if (/(的|了|和|与|对|把|被|将|给|在|向|从|跟)$/.test(value)) return false;
        if (/^(用户对|用户与|关于|有关|对话中|互动中|关系中|我的|你的|他的|她的)$/.test(value)) return false;
        if (/^(含义|解释|细节|记录|历史|确认|明确解释)$/.test(value)) return false;
        return true;
    }

function buildExpandedMemorySearchQueries(queryText = '') {
        const raw = String(queryText || '').trim();
        if (!raw) return [];

        const variants = new Set(buildMemorySearchQueries(raw));
        const stripped = stripGenericMemoryQuery(raw);
        if (stripped) variants.add(stripped);
        expandBilingualAliases(raw).forEach(v => variants.add(v));
        expandBilingualAliases(stripped).forEach(v => variants.add(v));

        const englishTokens = stripped.match(/[a-zA-Z][a-zA-Z0-9+_.-]{2,}/g) || [];
        for (const token of englishTokens) variants.add(token);

        const chineseChunks = stripped.match(/[\u4e00-\u9fff]{2,12}/g) || [];
        const genericAnchors = [];
        for (const chunk of chineseChunks) {
            for (const variant of expandGenericChineseAnchor(chunk)) {
                if (!isUsefulGenericChineseAnchor(variant)) continue;
                genericAnchors.push(variant);
                variants.add(variant);
                expandBilingualAliases(variant).forEach(v => variants.add(v));
            }
        }

        if (genericAnchors.length >= 2 && genericAnchors[0] !== genericAnchors[1]) {
            variants.add(`${genericAnchors[0]} ${genericAnchors[1]}`);
        }

        const normalizedSeen = new Set();
        return Array.from(variants)
            .map(v => String(v || '').trim())
            .filter(Boolean)
            .filter(v => {
                const normalized = normalizeSearchText(v);
                if (!normalized || normalizedSeen.has(normalized)) return false;
                normalizedSeen.add(normalized);
                return true;
            })
            .slice(0, 8);
    }

function extractLexicalQueryTokens(variant = '') {
        const raw = String(variant || '').trim();
        if (!raw) return [];
        const tokens = raw.match(/[a-zA-Z0-9+_.-]{2,}|[\u4e00-\u9fff]{2,}/g) || [];
        const normalizedSeen = new Set();
        return tokens
            .map(token => normalizeSearchText(token))
            .filter(token => token && token.length >= 2)
            .filter(token => {
                if (normalizedSeen.has(token)) return false;
                normalizedSeen.add(token);
                return true;
            })
            .slice(0, 8);
    }

function computeLexicalVariantBoost(haystack, variant = '') {
        const needle = normalizeSearchText(variant);
        if (!haystack || !needle || needle.length < 2) return 0;
        if (haystack.includes(needle)) {
            return needle.length >= 6 ? 1.25 : 0.55;
        }

        const tokens = extractLexicalQueryTokens(variant);
        if (tokens.length < 2) return 0;
        const hitCount = tokens.filter(token => haystack.includes(token)).length;
        const coverage = hitCount / tokens.length;
        if (hitCount < 2 || coverage < 0.35) return 0;
        return Math.min(0.55, 0.12 + (hitCount * 0.12) + (coverage * 0.12));
    }

function hasNewLibrarySummary(memoryRow = {}) {
        return !!String(memoryRow?.consolidation_summary || '').trim();
    }

function selectSearchableMemoryRows(rows = []) {
        const activeRows = (Array.isArray(rows) ? rows : [])
            .filter(row => row && Number(row.is_archived || 0) === 0);
        return activeRows.filter(hasNewLibrarySummary);
    }

function buildMemoryRecallText(memoryRow = {}) {
        const primary = String(memoryRow.consolidation_summary || memoryRow.summary || memoryRow.content || memoryRow.event || '').trim();
        const legacySummary = String(memoryRow.legacy_summary || '').trim();
        const legacyContent = String(memoryRow.legacy_content || '').trim();
        const detailContent = String(memoryRow.content || '').trim();
        return [
            primary,
            legacySummary && legacySummary !== primary ? legacySummary : '',
            legacyContent && legacyContent !== primary ? legacyContent : '',
            detailContent && detailContent !== primary && detailContent !== legacyContent ? detailContent : '',
            memoryRow?.people,
            memoryRow?.relationships,
            memoryRow?.location,
            memoryRow?.source_time_text,
            memoryRow?.time
        ].filter(Boolean).join(' ');
    }

function getNewLibraryRecallKey(memoryRow = {}) {
        if (!hasNewLibrarySummary(memoryRow)) return `legacy:${memoryRow?.id || ''}`;
        const key = String(memoryRow.consolidation_key || '').trim().toLowerCase();
        const summary = String(memoryRow.consolidation_summary || '').trim().toLowerCase();
        return `new:${memoryRow.character_id || ''}:${key || summary}`;
    }

function prepareMemoryForRecall(memoryRow = {}) {
        if (!memoryRow || !hasNewLibrarySummary(memoryRow)) return memoryRow;
        const summary = String(memoryRow.consolidation_summary || '').trim();
        const legacySummary = String(memoryRow.legacy_summary || memoryRow.summary || '').trim();
        const legacyContent = String(memoryRow.legacy_content || '').trim()
            || (String(memoryRow.content || '').trim() !== summary ? String(memoryRow.content || '').trim() : '');
        return {
            ...memoryRow,
            legacy_summary: legacySummary,
            legacy_content: legacyContent,
            summary,
            content: legacyContent || summary,
            event: memoryRow.event || summary,
            memory_library_source: 'new'
        };
    }

function finalizeMemorySearchRows(rows = [], limit = 5) {
        const deduped = [];
        const seen = new Set();
        for (const row of rows) {
            if (!row?.id) continue;
            const key = getNewLibraryRecallKey(row);
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(prepareMemoryForRecall(row));
            if (deduped.length >= limit) break;
        }
        return deduped;
    }

function computeLexicalBoost(memoryRow, queryVariants = []) {
        const haystack = normalizeSearchText(buildMemoryRecallText(memoryRow));
        if (!haystack) return 0;

        let boost = 0;
        for (const variant of queryVariants) {
            boost += computeLexicalVariantBoost(haystack, variant);
        }
        return Math.min(boost, 2.5);
    }

function computeAliasBridgeBoost(memoryRow, queryVariants = []) {
        const haystack = normalizeSearchText(buildMemoryRecallText(memoryRow));
        if (!haystack) return 0;

        const normalizedQueries = queryVariants.map(v => normalizeSearchText(v)).filter(Boolean);
        let boost = 0;
        for (const group of dependencies.BILINGUAL_MEMORY_ALIASES) {
            const normalizedGroup = group.map(alias => normalizeSearchText(alias)).filter(Boolean);
            const queryHit = normalizedQueries.some(q => normalizedGroup.some(alias => q.includes(alias)));
            const memoryHit = normalizedGroup.some(alias => haystack.includes(alias));
            if (queryHit && memoryHit) boost += 0.12;
        }
        return Math.min(boost, 0.36);
    }

function computeRecallContradictionPenalty(memoryRow, queryText = '') {
        const query = String(queryText || '');
        if (!/记得|说了什么|提过什么|回忆|想起/i.test(query)) return 0;
        const text = [
            buildMemoryRecallText(memoryRow)
        ].filter(Boolean).join(' ');
        if (!text) return 0;
        if (/(不记得|想不起来|记不清|lack of recall|can't remember|空白)/i.test(text)) {
            return 0.22;
        }
        return 0;
    }

    return { normalizeSearchText, buildMemorySearchQueries, stripGenericMemoryQuery, expandBilingualAliases, expandGenericChineseAnchor, isUsefulGenericChineseAnchor, buildExpandedMemorySearchQueries, extractLexicalQueryTokens, computeLexicalVariantBoost, hasNewLibrarySummary, selectSearchableMemoryRows, buildMemoryRecallText, getNewLibraryRecallKey, prepareMemoryForRecall, finalizeMemorySearchRows, computeLexicalBoost, computeAliasBridgeBoost, computeRecallContradictionPenalty };
}

module.exports = { createModule };
