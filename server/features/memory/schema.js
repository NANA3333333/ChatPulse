// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    memories: `CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            time TEXT,
            location TEXT,
            people TEXT,
            event TEXT NOT NULL,
            relationships TEXT,
            items TEXT,
            importance INTEGER DEFAULT 5,
            embedding BLOB,
            created_at INTEGER NOT NULL,
            last_retrieved_at INTEGER,
            retrieval_count INTEGER DEFAULT 0,
            group_id TEXT DEFAULT NULL,
            memory_type TEXT DEFAULT 'event',
            summary TEXT DEFAULT '',
            content TEXT DEFAULT '',
            people_json TEXT DEFAULT '[]',
            items_json TEXT DEFAULT '[]',
            relationship_json TEXT DEFAULT '[]',
            emotion TEXT DEFAULT '',
            source_message_ids_json TEXT DEFAULT '[]',
            dedupe_key TEXT DEFAULT '',
            updated_at INTEGER DEFAULT 0,
            is_archived INTEGER DEFAULT 0,
            source_started_at INTEGER DEFAULT 0,
            source_ended_at INTEGER DEFAULT 0,
            source_time_text TEXT DEFAULT '',
            source_message_count INTEGER DEFAULT 0,
            memory_tier TEXT DEFAULT 'ambient',
            memory_focus TEXT DEFAULT 'general',
            maintenance_status TEXT DEFAULT 'pending',
            classification_source TEXT DEFAULT '',
            classified_at INTEGER DEFAULT 0,
            retention_score REAL DEFAULT 1,
            retention_action TEXT DEFAULT '',
            retention_reason TEXT DEFAULT '',
            retention_checked_at INTEGER DEFAULT 0,
            consolidation_key TEXT DEFAULT '',
            consolidation_summary TEXT DEFAULT '',
            consolidated_into_memory_id INTEGER DEFAULT 0,
            archive_reason TEXT DEFAULT '',
            forgetting_grace_started_at INTEGER DEFAULT 0,
            forgetting_grace_expires_at INTEGER DEFAULT 0,
            source_context TEXT DEFAULT '',
            scene_tag TEXT DEFAULT '',
            source_app TEXT DEFAULT '',
            temporal_label TEXT DEFAULT '',
            temporal_scope TEXT DEFAULT '',
            temporal_anchor TEXT DEFAULT '',
            temporal_confidence REAL DEFAULT 0,
            temporal_reason TEXT DEFAULT '',
            temporal_checked_at INTEGER DEFAULT 0,
            FOREIGN KEY (character_id) REFERENCES characters(id)
        );

        `,
    external_memory_imports: `CREATE TABLE IF NOT EXISTS external_memory_imports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_app TEXT DEFAULT '',
            import_mode TEXT DEFAULT '',
            filename TEXT DEFAULT '',
            raw_text TEXT DEFAULT '',
            normalized_messages_json TEXT DEFAULT '[]',
            summary_json TEXT DEFAULT '{}',
            role_tags_json TEXT DEFAULT '[]',
            selected_character_ids_json TEXT DEFAULT '[]',
            memory_ids_json TEXT DEFAULT '[]',
            created_at INTEGER NOT NULL,
            committed_at INTEGER DEFAULT 0
        );

        `,
    external_memory_role_bindings: `CREATE TABLE IF NOT EXISTS external_memory_role_bindings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            import_id INTEGER DEFAULT 0,
            memory_id INTEGER NOT NULL,
            character_id TEXT NOT NULL,
            character_name TEXT DEFAULT '',
            created_at INTEGER NOT NULL,
            UNIQUE(memory_id, character_id)
        );
        CREATE INDEX IF NOT EXISTS idx_external_memory_role_bindings_character
            ON external_memory_role_bindings(character_id, memory_id);
        CREATE INDEX IF NOT EXISTS idx_external_memory_role_bindings_memory
            ON external_memory_role_bindings(memory_id);

        `
};
