// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    character_friends: `CREATE TABLE IF NOT EXISTS character_friends (
            char1_id TEXT NOT NULL,
            char2_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (char1_id, char2_id),
            FOREIGN KEY (char1_id) REFERENCES characters(id) ON DELETE CASCADE,
            FOREIGN KEY (char2_id) REFERENCES characters(id) ON DELETE CASCADE
        );

        `,
    char_relationships: `CREATE TABLE IF NOT EXISTS char_relationships (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            affinity INTEGER DEFAULT 50,
            impression TEXT DEFAULT '',
            source TEXT DEFAULT 'recommend',
            PRIMARY KEY (source_id, target_id, source)
        );

        `,
    char_impression_history: `CREATE TABLE IF NOT EXISTS char_impression_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            impression TEXT NOT NULL,
            trigger_event TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        );

        `
};
