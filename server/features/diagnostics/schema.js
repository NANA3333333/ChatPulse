// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    token_usage: `CREATE TABLE IF NOT EXISTS token_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            context_type TEXT NOT NULL,
            prompt_tokens INTEGER DEFAULT 0,
            completion_tokens INTEGER DEFAULT 0,
            timestamp INTEGER NOT NULL
        );

        `,
    llm_debug_logs: `CREATE TABLE IF NOT EXISTS llm_debug_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            direction TEXT NOT NULL,
            context_type TEXT DEFAULT 'chat',
            payload TEXT NOT NULL,
            meta TEXT DEFAULT '{}',
            timestamp INTEGER NOT NULL
        );

        `
};
