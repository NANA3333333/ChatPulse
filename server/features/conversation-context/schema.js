// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    prompt_block_cache: `CREATE TABLE IF NOT EXISTS prompt_block_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            block_type TEXT NOT NULL,
            source_hash TEXT NOT NULL,
            compiled_text TEXT NOT NULL,
            hit_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT 0,
            last_hit_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL,
            UNIQUE(character_id, block_type)
        );
        CREATE INDEX IF NOT EXISTS idx_prompt_block_cache_lookup ON prompt_block_cache(character_id, block_type, source_hash);

        `,
    history_window_cache: `CREATE TABLE IF NOT EXISTS history_window_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            window_type TEXT NOT NULL,
            window_size INTEGER NOT NULL DEFAULT 0,
            source_hash TEXT NOT NULL,
            message_ids_json TEXT NOT NULL DEFAULT '[]',
            compiled_json TEXT NOT NULL DEFAULT '[]',
            hit_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT 0,
            last_hit_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL,
            UNIQUE(character_id, window_type, window_size)
        );
        CREATE INDEX IF NOT EXISTS idx_history_window_cache_lookup ON history_window_cache(character_id, window_type, window_size, source_hash);

        `,
    conversation_digest_cache: `CREATE TABLE IF NOT EXISTS conversation_digest_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL UNIQUE,
            source_hash TEXT NOT NULL DEFAULT '',
            digest_text TEXT NOT NULL DEFAULT '',
            emotion_state TEXT NOT NULL DEFAULT '',
            relationship_state_json TEXT NOT NULL DEFAULT '[]',
            open_loops_json TEXT NOT NULL DEFAULT '[]',
            recent_facts_json TEXT NOT NULL DEFAULT '[]',
            scene_state_json TEXT NOT NULL DEFAULT '[]',
            last_message_id INTEGER NOT NULL DEFAULT 0,
            hit_count INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT 0,
            last_hit_at INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_conversation_digest_lookup ON conversation_digest_cache(character_id, source_hash);

        `
};
