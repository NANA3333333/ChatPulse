// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getTokenUsageSummary(characterId) {
        const totals = dependencies.db.prepare(`
            SELECT
                COUNT(*) as request_count,
                COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
                COALESCE(SUM(completion_tokens), 0) as completion_tokens
            FROM token_usage
            WHERE character_id = ?
        `).get(characterId);
        const byContext = dependencies.db.prepare(`
            SELECT
                context_type,
                COUNT(*) as request_count,
                COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
                COALESCE(SUM(completion_tokens), 0) as completion_tokens
            FROM token_usage
            WHERE character_id = ?
            GROUP BY context_type
        `).all(characterId);
        return {
            request_count: totals?.request_count || 0,
            prompt_tokens: totals?.prompt_tokens || 0,
            completion_tokens: totals?.completion_tokens || 0,
            by_context: byContext || []
        };
    }

    return { getTokenUsageSummary };
}

module.exports = { createModule };
