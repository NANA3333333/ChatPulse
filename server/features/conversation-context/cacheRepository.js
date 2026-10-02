// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getPromptBlockCache(characterId, blockType, sourceHash) {
        try {
            const now = Date.now();
            const row = dependencies.db.prepare(`
                SELECT *
                FROM prompt_block_cache
                WHERE character_id = ?
                  AND block_type = ?
                  AND source_hash = ?
                LIMIT 1
            `).get(String(characterId || ''), String(blockType || ''), String(sourceHash || '')) || null;
            if (!row) return null;
            dependencies.db.prepare('UPDATE prompt_block_cache SET hit_count = COALESCE(hit_count, 0) + 1, last_hit_at = ? WHERE id = ?').run(now, row.id);
            return {
                ...row,
                hit_count: Number(row.hit_count || 0) + 1,
                last_hit_at: now
            };
        } catch (e) {
            console.error('[DB] Error reading prompt block cache:', e.message);
            return null;
        }
    }

function upsertPromptBlockCache(entry = {}) {
        try {
            const now = Date.now();
            dependencies.db.prepare(`
                INSERT INTO prompt_block_cache (
                    character_id, block_type, source_hash, compiled_text, hit_count, created_at, last_hit_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(character_id, block_type) DO UPDATE SET
                    source_hash = excluded.source_hash,
                    compiled_text = excluded.compiled_text,
                    hit_count = COALESCE(prompt_block_cache.hit_count, 0) + COALESCE(excluded.hit_count, 0),
                    created_at = CASE
                        WHEN COALESCE(prompt_block_cache.created_at, 0) > 0 THEN prompt_block_cache.created_at
                        ELSE excluded.created_at
                    END,
                    last_hit_at = CASE
                        WHEN COALESCE(excluded.last_hit_at, 0) > COALESCE(prompt_block_cache.last_hit_at, 0) THEN excluded.last_hit_at
                        ELSE prompt_block_cache.last_hit_at
                    END,
                    updated_at = excluded.updated_at
            `).run(
                String(entry.character_id || ''),
                String(entry.block_type || ''),
                String(entry.source_hash || ''),
                String(entry.compiled_text || ''),
                Number(entry.hit_count || 0),
                Number(entry.created_at || now),
                Number(entry.last_hit_at || 0),
                Number(entry.updated_at || now)
            );
            return true;
        } catch (e) {
            console.error('[DB] Error writing prompt block cache:', e.message);
            return false;
        }
    }

function getHistoryWindowCache(characterId, windowType, windowSize, sourceHash) {
        try {
            const now = Date.now();
            const row = dependencies.db.prepare(`
                SELECT *
                FROM history_window_cache
                WHERE character_id = ?
                  AND window_type = ?
                  AND window_size = ?
                  AND source_hash = ?
                LIMIT 1
            `).get(
                String(characterId || ''),
                String(windowType || ''),
                Number(windowSize || 0),
                String(sourceHash || '')
            );
            if (!row) return null;
            dependencies.db.prepare('UPDATE history_window_cache SET hit_count = COALESCE(hit_count, 0) + 1, last_hit_at = ? WHERE id = ?').run(now, row.id);
            return {
                ...row,
                message_ids_json: dependencies.safeParseJson(row.message_ids_json, []),
                compiled_json: dependencies.safeParseJson(row.compiled_json, []),
                hit_count: Number(row.hit_count || 0) + 1,
                last_hit_at: now
            };
        } catch (e) {
            console.error('[DB] Error reading history window cache:', e.message);
            return null;
        }
    }

function getLatestHistoryWindowCache(characterId, windowType, windowSize) {
        try {
            const row = dependencies.db.prepare(`
                SELECT *
                FROM history_window_cache
                WHERE character_id = ?
                  AND window_type = ?
                  AND window_size = ?
                LIMIT 1
            `).get(
                String(characterId || ''),
                String(windowType || ''),
                Number(windowSize || 0)
            );
            if (!row) return null;
            return {
                ...row,
                message_ids_json: dependencies.safeParseJson(row.message_ids_json, []),
                compiled_json: dependencies.safeParseJson(row.compiled_json, [])
            };
        } catch (e) {
            console.error('[DB] Error reading latest history window cache:', e.message);
            return null;
        }
    }

function upsertHistoryWindowCache(entry = {}) {
        try {
            const now = Date.now();
            dependencies.db.prepare(`
                INSERT INTO history_window_cache (
                    character_id, window_type, window_size, source_hash, message_ids_json, compiled_json, hit_count, created_at, last_hit_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(character_id, window_type, window_size) DO UPDATE SET
                    source_hash = excluded.source_hash,
                    message_ids_json = excluded.message_ids_json,
                    compiled_json = excluded.compiled_json,
                    hit_count = COALESCE(history_window_cache.hit_count, 0),
                    created_at = CASE
                        WHEN COALESCE(history_window_cache.created_at, 0) > 0 THEN history_window_cache.created_at
                        ELSE excluded.created_at
                    END,
                    last_hit_at = CASE
                        WHEN COALESCE(excluded.last_hit_at, 0) > COALESCE(history_window_cache.last_hit_at, 0) THEN excluded.last_hit_at
                        ELSE history_window_cache.last_hit_at
                    END,
                    updated_at = excluded.updated_at
            `).run(
                String(entry.character_id || ''),
                String(entry.window_type || ''),
                Number(entry.window_size || 0),
                String(entry.source_hash || ''),
                dependencies.stringifyJson(entry.message_ids_json || []),
                dependencies.stringifyJson(entry.compiled_json || []),
                Number(entry.hit_count || 0),
                Number(entry.created_at || now),
                Number(entry.last_hit_at || 0),
                Number(entry.updated_at || now)
            );
            return true;
        } catch (e) {
            console.error('[DB] Error writing history window cache:', e.message);
            return false;
        }
    }

function getConversationDigest(characterId, options = {}) {
        try {
            const row = dependencies.db.prepare(`
                SELECT *
                FROM conversation_digest_cache
                WHERE character_id = ?
                LIMIT 1
            `).get(String(characterId || ''));
            if (!row) return null;
            const normalized = dependencies.normalizeConversationDigestRow(row);
            if (options.trackHit === false) {
                return normalized;
            }
            const now = Date.now();
            dependencies.db.prepare('UPDATE conversation_digest_cache SET hit_count = COALESCE(hit_count, 0) + 1, last_hit_at = ? WHERE id = ?').run(now, row.id);
            return {
                ...normalized,
                hit_count: normalized.hit_count + 1,
                last_hit_at: now
            };
        } catch (e) {
            console.error('[DB] Error reading conversation digest cache:', e.message);
            return null;
        }
    }

function getGroupConversationDigest(groupId, characterId, options = {}) {
        try {
            const row = dependencies.db.prepare(`
                SELECT *
                FROM group_conversation_digest_cache
                WHERE group_id = ? AND character_id = ?
                LIMIT 1
            `).get(String(groupId || ''), String(characterId || ''));
            if (!row) return null;
            const normalized = dependencies.normalizeGroupConversationDigestRow(row);
            if (options.trackHit === false) {
                return normalized;
            }
            const now = Date.now();
            dependencies.db.prepare('UPDATE group_conversation_digest_cache SET hit_count = COALESCE(hit_count, 0) + 1, last_hit_at = ? WHERE id = ?').run(now, row.id);
            return {
                ...normalized,
                hit_count: normalized.hit_count + 1,
                last_hit_at: now
            };
        } catch (e) {
            console.error('[DB] Error reading group conversation digest cache:', e.message);
            return null;
        }
    }

function upsertConversationDigest(entry = {}) {
        try {
            const now = Date.now();
            dependencies.db.prepare(`
                INSERT INTO conversation_digest_cache (
                    character_id, source_hash, digest_text, emotion_state,
                    relationship_state_json, open_loops_json, recent_facts_json, scene_state_json,
                    last_message_id, hit_count, created_at, last_hit_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(character_id) DO UPDATE SET
                    source_hash = excluded.source_hash,
                    digest_text = excluded.digest_text,
                    emotion_state = excluded.emotion_state,
                    relationship_state_json = excluded.relationship_state_json,
                    open_loops_json = excluded.open_loops_json,
                    recent_facts_json = excluded.recent_facts_json,
                    scene_state_json = excluded.scene_state_json,
                    last_message_id = excluded.last_message_id,
                    hit_count = COALESCE(conversation_digest_cache.hit_count, 0) + COALESCE(excluded.hit_count, 0),
                    created_at = CASE
                        WHEN COALESCE(conversation_digest_cache.created_at, 0) > 0 THEN conversation_digest_cache.created_at
                        ELSE excluded.created_at
                    END,
                    last_hit_at = CASE
                        WHEN COALESCE(excluded.last_hit_at, 0) > COALESCE(conversation_digest_cache.last_hit_at, 0) THEN excluded.last_hit_at
                        ELSE conversation_digest_cache.last_hit_at
                    END,
                    updated_at = excluded.updated_at
            `).run(
                String(entry.character_id || ''),
                String(entry.source_hash || ''),
                String(entry.digest_text || ''),
                String(entry.emotion_state || ''),
                dependencies.stringifyJson(entry.relationship_state_json || []),
                dependencies.stringifyJson(entry.open_loops_json || []),
                dependencies.stringifyJson(entry.recent_facts_json || []),
                dependencies.stringifyJson(entry.scene_state_json || []),
                Number(entry.last_message_id || 0),
                Number(entry.hit_count || 0),
                Number(entry.created_at || now),
                Number(entry.last_hit_at || 0),
                Number(entry.updated_at || now)
            );
            return true;
        } catch (e) {
            console.error('[DB] Error writing conversation digest cache:', e.message);
            return false;
        }
    }

    return { getPromptBlockCache, upsertPromptBlockCache, getHistoryWindowCache, getLatestHistoryWindowCache, upsertHistoryWindowCache, getConversationDigest, getGroupConversationDigest, upsertConversationDigest };
}

module.exports = { createModule };
