import { mtx } from './memoryLabels.js';

export function getMemoryItemKey(item = {}) {
    const ids = getMemorySourceIds(item);
    return `${item.memory_library_source || item.source || 'memory'}-${item.id || item.representative_id || ids[0] || item.consolidation_key || item.summary || item.text}`;
}

export function getMemorySourceIds(item = {}) {
    const ids =
        Array.isArray(item.source_ids) && item.source_ids.length
            ? item.source_ids
            : [item.representative_id || item.id].filter(Boolean);
    return Array.from(new Set(ids.map((id) => Number(id || 0)).filter((id) => id > 0)));
}

export function getMemoryTitle(item = {}, tx = mtx) {
    return item.summary || item.text || item.event || item.consolidation_summary || tx('Untitled memory', '未命名记忆');
}

export function getMemoryBody(item = {}, tx = mtx) {
    return (
        item.content ||
        item.consolidation_summary ||
        item.summary ||
        item.text ||
        item.event ||
        tx('This memory does not have saved body text.', '这条记忆没有保存正文。')
    );
}

export function getMemorySourceContexts(item = {}) {
    return Array.isArray(item.source_contexts) && item.source_contexts.length
        ? item.source_contexts
        : [item.source_context || 'unknown'];
}

export function getMemorySceneTags(item = {}) {
    return Array.isArray(item.scene_tags) && item.scene_tags.length ? item.scene_tags : [item.scene_tag || 'none'];
}

export function uniqueMemoryLabels(values = []) {
    const seen = new Set();
    return values
        .map((value) => String(value || '').trim())
        .filter((value) => value && value !== 'none')
        .filter((value) => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

export function getMemoryDisplayTags(item = {}) {
    return uniqueMemoryLabels([...getMemorySourceContexts(item), ...getMemorySceneTags(item)]);
}

export function getMemoryUpdatedAt(item = {}) {
    return item.updated_at || item.created_at || item.source_time || item.timestamp || 0;
}

export function getMemoryImportance(item = {}) {
    const score = Number(item.importance ?? item.retention_score ?? 0);
    return Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0;
}

export function getMemoryTier(item = {}) {
    return String(item.memory_tier || item.tier || 'ambient');
}

export function getMemoryTone(item = {}) {
    const tier = getMemoryTier(item);
    if (tier === 'core') return 'core';
    if (tier === 'active') return 'active';
    if (String(item.forgetting_stage || '').trim()) return 'fading';
    return 'ambient';
}

export function getCharacterInitial(name = '') {
    const text = String(name || '').trim();
    if (!text) return '?';
    return text.slice(0, 1).toUpperCase();
}

export function getMemoryCharacterName(item = {}, characterStats = [], tx = mtx) {
    if (item.character_name) return item.character_name;
    const found = characterStats.find((character) => String(character.character_id) === String(item.character_id));
    return found?.name || item.character_id || tx('Unknown role', '未知角色');
}

export function memoryMatchesLens(item = {}, lens = 'all') {
    if (lens === 'all') return true;
    const focus = String(item.memory_focus || '').toLowerCase();
    const sourceContexts = getMemorySourceContexts(item).map((value) => String(value || '').toLowerCase());
    const sceneTags = getMemorySceneTags(item).map((value) => String(value || '').toLowerCase());
    if (lens === 'relationship') return focus === 'relationship';
    if (lens === 'user_profile') return focus === 'user_profile';
    if (lens === 'scene') {
        return (
            sourceContexts.some((value) =>
                ['private_chat', 'group_chat', 'commercial_street', 'external_app'].includes(value),
            ) || sceneTags.some((value) => value && value !== 'none')
        );
    }
    if (lens === 'temporal') {
        return (
            !item.source_time_text ||
            !item.temporal_checked_at ||
            !item.source_context ||
            String(item.source_context).toLowerCase() === 'unknown'
        );
    }
    if (lens === 'forgetting') return !!item.forgetting_stage || Number(item.days_until_threshold ?? 999) < 14;
    return true;
}

export function memoryMatchesSearch(item = {}, search = '') {
    const query = String(search || '')
        .trim()
        .toLowerCase();
    if (!query) return true;
    const text = [
        item.summary,
        item.text,
        item.content,
        item.event,
        item.character_name,
        item.consolidation_key,
        item.consolidation_summary,
        item.memory_focus,
        item.memory_tier,
        ...getMemorySourceContexts(item),
        ...getMemorySceneTags(item),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return text.includes(query);
}

export function normalizeThreadItems(items = [], lens = 'all', search = '') {
    const seen = new Set();
    return (items || [])
        .filter((item) => item && memoryMatchesLens(item, lens) && memoryMatchesSearch(item, search))
        .filter((item) => {
            const key = getMemoryItemKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => Number(getMemoryUpdatedAt(b) || 0) - Number(getMemoryUpdatedAt(a) || 0));
}

export function buildMemoryThreads({
    newCategories = [],
    newSourceGroups = [],
    categories = [],
    forgettingGroups = [],
    lens = 'all',
    search = '',
    tx,
}) {
    const sourceGroups =
        lens === 'forgetting'
            ? forgettingGroups
            : [
                  ...(newCategories || []).map((group) => ({ ...group, groupKind: 'semantic' })),
                  ...(newSourceGroups || []).map((group) => ({ ...group, groupKind: 'source' })),
                  ...(categories || []).map((group) => ({ ...group, groupKind: 'legacy' })),
              ];
    const threads = sourceGroups
        .map((group, index) => {
            const items = normalizeThreadItems(group.items || [], lens, search);
            if (!items.length) return null;
            const strongest = items.reduce((max, item) => Math.max(max, getMemoryImportance(item)), 0);
            const tone = items.some((item) => getMemoryTone(item) === 'core')
                ? 'core'
                : items.some((item) => getMemoryTone(item) === 'active')
                  ? 'active'
                  : lens === 'forgetting' || items.some((item) => getMemoryTone(item) === 'fading')
                    ? 'fading'
                    : 'ambient';
            return {
                key: `${group.groupKind || 'group'}-${group.key || index}`,
                label: group.label || group.name || tx('Memory Thread', '记忆主线'),
                description: group.description || tx('Grouped by real memory metadata.', '按真实记忆字段聚合。'),
                count: Number(group.count || items.length),
                items,
                tone,
                strongest,
            };
        })
        .filter(Boolean);

    return threads.length ? threads : [];
}

export function getAllThreadItems(threads = []) {
    const seen = new Set();
    return threads
        .flatMap((thread) => thread.items.map((item) => ({ item, thread })))
        .filter(({ item }) => {
            const key = getMemoryItemKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

export function buildLensCount(items = [], lens = 'all') {
    return items.filter((item) => memoryMatchesLens(item, lens)).length;
}
