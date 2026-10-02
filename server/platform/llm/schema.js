// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    llm_cache: `CREATE TABLE IF NOT EXISTS llm_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cache_key TEXT NOT NULL UNIQUE,
            cache_type TEXT NOT NULL DEFAULT 'generic',
            cache_scope TEXT DEFAULT '',
            character_id TEXT DEFAULT '',
            model TEXT DEFAULT '',
            prompt_hash TEXT DEFAULT '',
            prompt_preview TEXT DEFAULT '',
            response_text TEXT DEFAULT '',
            response_meta TEXT DEFAULT '{}',
            prompt_tokens INTEGER DEFAULT 0,
            completion_tokens INTEGER DEFAULT 0,
            hit_count INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            last_hit_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_llm_cache_type_expires ON llm_cache(cache_type, expires_at);
        CREATE INDEX IF NOT EXISTS idx_llm_cache_last_hit ON llm_cache(last_hit_at);

        `,
    llm_cache_stats: `CREATE TABLE IF NOT EXISTS llm_cache_stats (
            scope TEXT PRIMARY KEY,
            lookup_count INTEGER NOT NULL DEFAULT 0,
            hit_count INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL DEFAULT 0
        );

        `
};
