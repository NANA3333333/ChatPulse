// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function clipQuestContextText(value, maxLength = 180) {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return '';
        return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
    }

function buildQuestCompetitionContext(db, occupants, district) {
        if (!Array.isArray(occupants) || occupants.length < 2) return '';
        const activeClaims = occupants
            .map((char) => {
                const claim = db.city.getCharacterActiveQuestClaim?.(char.id);
                return claim ? { char, claim } : null;
            })
            .filter(Boolean);
        if (activeClaims.length < 2) return '';

        const grouped = new Map();
        for (const item of activeClaims) {
            const key = String(item.claim.quest_id);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(item);
        }

        const conflict = Array.from(grouped.values()).find((items) => items.length >= 2);
        if (!conflict) return '';
        const quest = conflict[0].claim;
        const names = conflict.map((item) => item.char.name).join('、');
        const targetDistrict = String(quest.target_district || '');
        const onSite = targetDistrict === district.id ? '你们现在就在这单的目标地点。' : `这单的目标地点是 ${targetDistrict}。`;
        return `\n[竞争任务现场]\n${names} 正在竞争同一条公告任务：${quest.emoji || '📜'} ${quest.title}。\n任务内容：${quest.description || ''}\n${onSite}\n这次偶遇请明显体现“彼此知道对方在抢同一单”的紧张感、试探、让步、暗中较劲或嘴上不说破的竞争。`;
    }

function normalizeBehaviorContextInteger(value, fallback, min, max) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return dependencies.clamp(Math.trunc(parsed), min, max);
    }

function resolveBehaviorIterationContextConfig(payload = {}, behaviorTree = {}) {
        const raw = {
            ...(behaviorTree?.iteration_context?.config || {}),
            ...(behaviorTree?.iterationContext?.config || {}),
            ...(payload?.behavior_context || payload?.behaviorContext || {})
        };
        return {
            q_raw_limit: normalizeBehaviorContextInteger(
                raw.q_raw_limit ?? raw.qRawLimit ?? raw.context_q_limit ?? raw.q,
                dependencies.BEHAVIOR_CONTEXT_DEFAULT_Q,
                dependencies.BEHAVIOR_CONTEXT_MIN_Q,
                dependencies.BEHAVIOR_CONTEXT_MAX_Q
            ),
            p_summary_threshold: normalizeBehaviorContextInteger(
                raw.p_summary_threshold ?? raw.pSummaryThreshold ?? raw.context_summary_threshold ?? raw.p,
                dependencies.BEHAVIOR_CONTEXT_DEFAULT_P,
                dependencies.BEHAVIOR_CONTEXT_MIN_P,
                dependencies.BEHAVIOR_CONTEXT_MAX_P
            ),
            max_summary_rounds: dependencies.BEHAVIOR_CONTEXT_MAX_SUMMARIES
        };
    }

function formatCityWebSearchKnowledge(searchResult) {
        const results = Array.isArray(searchResult?.results) ? searchResult.results.slice(0, 3) : [];
        return [
            `查询: ${searchResult?.query || ''}`,
            `来源: ${searchResult?.source || ''}`,
            `时间: ${searchResult?.fetched_at || new Date().toISOString()}`,
            '',
            ...results.map((item, index) => [
                `${index + 1}. ${item.title || item.url || 'Result'}`,
                item.snippet ? `摘要: ${item.snippet}` : '',
                item.page_text ? `来源正文: ${String(item.page_text).slice(0, 4000)}` : '',
                item.url ? `链接: ${item.url}` : ''
            ].filter(Boolean).join('\n'))
        ].join('\n').trim();
    }

    return { clipQuestContextText, buildQuestCompetitionContext, normalizeBehaviorContextInteger, resolveBehaviorIterationContextConfig, formatCityWebSearchKnowledge };
}

module.exports = { createModule };
