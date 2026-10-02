// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    group_conversation_digest_cache: `CREATE TABLE IF NOT EXISTS group_conversation_digest_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
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
            updated_at INTEGER NOT NULL,
            UNIQUE(group_id, character_id)
        );
        CREATE INDEX IF NOT EXISTS idx_group_conversation_digest_lookup ON group_conversation_digest_cache(group_id, character_id, source_hash);

        `,
    group_chats: `CREATE TABLE IF NOT EXISTS group_chats (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            avatar TEXT,
            context_msg_limit INTEGER DEFAULT 60,
            group_proactive_enabled INTEGER DEFAULT 0,
            group_interval_min INTEGER DEFAULT 10,
            group_interval_max INTEGER DEFAULT 60,
            created_at INTEGER NOT NULL
        );

        `,
    group_members: `CREATE TABLE IF NOT EXISTS group_members (
            group_id TEXT NOT NULL,
            member_id TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            joined_at INTEGER DEFAULT 0,
            PRIMARY KEY (group_id, member_id)
        );

        `,
    group_messages: `CREATE TABLE IF NOT EXISTS group_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            is_summarized INTEGER DEFAULT 0
        );

        `
};
