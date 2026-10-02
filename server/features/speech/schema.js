// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    message_tts: `CREATE TABLE IF NOT EXISTS message_tts (
            message_id INTEGER PRIMARY KEY,
            character_id TEXT NOT NULL,
            provider TEXT DEFAULT '',
            voice TEXT DEFAULT '',
            model TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            audio_path TEXT DEFAULT '',
            mime_type TEXT DEFAULT 'audio/mpeg',
            duration_ms INTEGER DEFAULT 0,
            error TEXT DEFAULT '',
            intent_json TEXT DEFAULT '{}',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        `
};
