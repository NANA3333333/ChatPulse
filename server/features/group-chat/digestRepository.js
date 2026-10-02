// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function upsertGroupConversationDigest(entry = {}) {
        try {
            const now = Date.now();
            dependencies.db.prepare(`
                INSERT INTO group_conversation_digest_cache (
                    group_id, character_id, source_hash, digest_text, emotion_state,
                    relationship_state_json, open_loops_json, recent_facts_json, scene_state_json,
                    last_message_id, hit_count, created_at, last_hit_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(group_id, character_id) DO UPDATE SET
                    source_hash = excluded.source_hash,
                    digest_text = excluded.digest_text,
                    emotion_state = excluded.emotion_state,
                    relationship_state_json = excluded.relationship_state_json,
                    open_loops_json = excluded.open_loops_json,
                    recent_facts_json = excluded.recent_facts_json,
                    scene_state_json = excluded.scene_state_json,
                    last_message_id = excluded.last_message_id,
                    hit_count = COALESCE(group_conversation_digest_cache.hit_count, 0) + COALESCE(excluded.hit_count, 0),
                    created_at = CASE
                        WHEN COALESCE(group_conversation_digest_cache.created_at, 0) > 0 THEN group_conversation_digest_cache.created_at
                        ELSE excluded.created_at
                    END,
                    last_hit_at = CASE
                        WHEN COALESCE(excluded.last_hit_at, 0) > COALESCE(group_conversation_digest_cache.last_hit_at, 0) THEN excluded.last_hit_at
                        ELSE group_conversation_digest_cache.last_hit_at
                    END,
                    updated_at = excluded.updated_at
            `).run(
                String(entry.group_id || ''),
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
            console.error('[DB] Error writing group conversation digest cache:', e.message);
            return false;
        }
    }

    return { upsertGroupConversationDigest };
}

module.exports = { createModule };
