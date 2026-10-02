// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getLlmDebugLogStats() {
        try {
            const row = dependencies.db.prepare(`
                SELECT
                    COUNT(*) AS row_count,
                    COALESCE(SUM(COALESCE(length(payload), 0) + COALESCE(length(meta), 0)), 0) AS logical_bytes,
                    MIN(id) AS min_id,
                    MAX(id) AS max_id
                FROM llm_debug_logs
            `).get();
            return {
                rowCount: Number(row?.row_count || 0),
                logicalBytes: Number(row?.logical_bytes || 0),
                minId: Number(row?.min_id || 0),
                maxId: Number(row?.max_id || 0)
            };
        } catch (e) {
            return { rowCount: 0, logicalBytes: 0, minId: 0, maxId: 0 };
        }
    }

function enforceLlmDebugLogRetention(options = {}) {
        const now = Date.now();
        if (!options.force && now - dependencies.llmDebugLastPruneAt < dependencies.LLM_DEBUG_PRUNE_INTERVAL_MS) return;
        dependencies.llmDebugLastPruneAt = now;

        try {
            const stats = getLlmDebugLogStats();
            if (stats.rowCount <= dependencies.llmDebugMaxRows && stats.logicalBytes <= dependencies.llmDebugMaxBytes) return;

            const averageBytes = Math.max(1, Math.ceil(stats.logicalBytes / Math.max(1, stats.rowCount)));
            const rowsByByteBudget = Math.floor((dependencies.llmDebugMaxBytes * 0.85) / averageBytes);
            const minKeepRows = Math.max(1, Math.min(dependencies.LLM_DEBUG_MIN_KEEP_ROWS, dependencies.llmDebugMaxRows));
            const targetRows = Math.max(
                minKeepRows,
                Math.min(dependencies.llmDebugMaxRows, rowsByByteBudget || dependencies.llmDebugMaxRows, stats.rowCount)
            );
            if (targetRows >= stats.rowCount) return;

            const cutoff = dependencies.db.prepare(`
                SELECT id
                FROM llm_debug_logs
                ORDER BY id DESC
                LIMIT 1 OFFSET ?
            `).get(targetRows - 1);
            if (!cutoff?.id) return;

            const result = dependencies.db.prepare('DELETE FROM llm_debug_logs WHERE id < ?').run(cutoff.id);
            if (Number(result.changes || 0) > 0) {
                console.warn(
                    `[DB] Pruned ${result.changes} old LLM debug log row(s). ` +
                    `Kept newest ~${targetRows}; budget=${Math.round(dependencies.llmDebugMaxBytes / 1024 / 1024)}MB/${dependencies.llmDebugMaxRows} rows.`
                );
            }
        } catch (e) {
            console.warn('[DB] Failed to prune LLM debug logs:', e.message);
        }
    }

    return { getLlmDebugLogStats, enforceLlmDebugLogRetention };
}

module.exports = { createModule };
