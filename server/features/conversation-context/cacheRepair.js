// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function repairHistoryWindowCacheHitCounts() {
        try {
            const suspiciousThreshold = 1000000;
            const result = dependencies.db.prepare(`
                UPDATE history_window_cache
                SET hit_count = 0,
                    last_hit_at = 0,
                    updated_at = CASE
                        WHEN COALESCE(updated_at, 0) > 0 THEN updated_at
                        ELSE ?
                    END
                WHERE COALESCE(hit_count, 0) > ?
            `).run(Date.now(), suspiciousThreshold);
            if (Number(result.changes || 0) > 0) {
                console.warn(`[DB] Repaired ${result.changes} corrupted history window cache hit counters.`);
            }
        } catch (e) {
            console.error('[DB] Error repairing history window cache hit counters:', e.message);
        }
    }

    return { repairHistoryWindowCacheHitCounts };
}

module.exports = { createModule };
