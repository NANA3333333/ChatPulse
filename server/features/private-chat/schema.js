// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    messages: `CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            read INTEGER DEFAULT 0,
            hidden INTEGER DEFAULT 0,
            is_summarized INTEGER DEFAULT 0,
            FOREIGN KEY (character_id) REFERENCES characters(id)
        );

        `,
    reply_dispatch_logs: `CREATE TABLE IF NOT EXISTS reply_dispatch_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'unknown',
            route TEXT NOT NULL DEFAULT '',
            request_id TEXT NOT NULL DEFAULT '',
            latest_user_message_id INTEGER,
            latest_user_message_timestamp INTEGER,
            payload TEXT NOT NULL DEFAULT '{}',
            note TEXT NOT NULL DEFAULT '',
            timestamp INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reply_dispatch_logs_char_time
            ON reply_dispatch_logs(character_id, timestamp DESC);

        `,
    private_context_summaries: `CREATE TABLE IF NOT EXISTS private_context_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            start_message_id INTEGER NOT NULL,
            end_message_id INTEGER NOT NULL,
            message_count INTEGER NOT NULL DEFAULT 0,
            summary_text TEXT NOT NULL DEFAULT '',
            source_hash TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_private_context_summaries_character
            ON private_context_summaries(character_id, end_message_id);

        `
};
