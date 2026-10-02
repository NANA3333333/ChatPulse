// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    diaries: `CREATE TABLE IF NOT EXISTS diaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id TEXT NOT NULL,
            content TEXT NOT NULL,
            emotion TEXT,
            is_unlocked INTEGER DEFAULT 0,
            timestamp INTEGER NOT NULL
        );

        `
};
