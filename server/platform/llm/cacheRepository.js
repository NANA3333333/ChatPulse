// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getLlmCache(cacheKey) {
        try {
            const now = Date.now();
            const row = dependencies.db.prepare(`
                SELECT *
                FROM llm_cache
                WHERE cache_key = ?
                  AND expires_at > ?
                LIMIT 1
            `).get(cacheKey, now);
            if (!row) return null;
            dependencies.db.prepare('UPDATE llm_cache SET hit_count = hit_count + 1, last_hit_at = ? WHERE id = ?').run(now, row.id);
            return {
                ...row,
                response_meta: dependencies.safeParseJson(row.response_meta, {})
            };
        } catch (e) {
            console.error('[DB] Error reading llm cache:', e.message);
            return null;
        }
    }

function incrementLlmCacheLookup(scope = 'global', wasHit = false) {
        try {
            const now = Date.now();
            dependencies.db.prepare(`
                INSERT INTO llm_cache_stats (scope, lookup_count, hit_count, updated_at)
                VALUES (?, 1, ?, ?)
                ON CONFLICT(scope) DO UPDATE SET
                    lookup_count = lookup_count + 1,
                    hit_count = hit_count + excluded.hit_count,
                    updated_at = excluded.updated_at
            `).run(String(scope || 'global'), wasHit ? 1 : 0, now);
            return true;
        } catch (e) {
            console.error('[DB] Error updating llm cache stats:', e.message);
            return false;
        }
    }

function getLlmCacheStats(scope = 'global') {
        try {
            return dependencies.db.prepare(`
                SELECT scope, lookup_count, hit_count, updated_at
                FROM llm_cache_stats
                WHERE scope = ?
                LIMIT 1
            `).get(String(scope || 'global')) || null;
        } catch (e) {
            console.error('[DB] Error reading llm cache stats:', e.message);
            return null;
        }
    }

function upsertLlmCache(entry = {}) {
        try {
            const now = Date.now();
            const expiresAt = Number(entry.expires_at || now + 3600000);
            dependencies.db.prepare(`
                INSERT INTO llm_cache (
                    cache_key, cache_type, cache_scope, character_id, model, prompt_hash, prompt_preview,
                    response_text, response_meta, prompt_tokens, completion_tokens,
                    hit_count, created_at, last_hit_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    cache_type = excluded.cache_type,
                    cache_scope = excluded.cache_scope,
                    character_id = excluded.character_id,
                    model = excluded.model,
                    prompt_hash = excluded.prompt_hash,
                    prompt_preview = excluded.prompt_preview,
                    response_text = excluded.response_text,
                    response_meta = excluded.response_meta,
                    prompt_tokens = excluded.prompt_tokens,
                    completion_tokens = excluded.completion_tokens,
                    expires_at = excluded.expires_at
            `).run(
                String(entry.cache_key || ''),
                String(entry.cache_type || 'generic'),
                String(entry.cache_scope || ''),
                String(entry.character_id || ''),
                String(entry.model || ''),
                String(entry.prompt_hash || ''),
                String(entry.prompt_preview || ''),
                String(entry.response_text || ''),
                dependencies.stringifyJson(entry.response_meta || {}),
                Number(entry.prompt_tokens || 0),
                Number(entry.completion_tokens || 0),
                Number(entry.hit_count || 0),
                Number(entry.created_at || now),
                Number(entry.last_hit_at || 0),
                expiresAt
            );
            return true;
        } catch (e) {
            console.error('[DB] Error writing llm cache:', e.message);
            return false;
        }
    }

function deleteLlmCache(cacheKey) {
        try {
            return dependencies.db.prepare('DELETE FROM llm_cache WHERE cache_key = ?').run(String(cacheKey || '')).changes || 0;
        } catch (e) {
            console.error('[DB] Error deleting llm cache:', e.message);
            return 0;
        }
    }

function pruneExpiredLlmCache(limit = 500) {
        try {
            const now = Date.now();
            return dependencies.db.prepare(`
                DELETE FROM llm_cache
                WHERE id IN (
                    SELECT id
                    FROM llm_cache
                    WHERE expires_at <= ?
                    ORDER BY expires_at ASC
                    LIMIT ?
                )
            `).run(now, Math.max(1, Number(limit || 500))).changes || 0;
        } catch (e) {
            console.error('[DB] Error pruning llm cache:', e.message);
            return 0;
        }
    }

    return { getLlmCache, incrementLlmCacheLookup, getLlmCacheStats, upsertLlmCache, deleteLlmCache, pruneExpiredLlmCache };
}

module.exports = { createModule };
