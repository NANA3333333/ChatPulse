// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    pixel_behavior_tree_states: `CREATE TABLE IF NOT EXISTS pixel_behavior_tree_states (
            scene_key TEXT PRIMARY KEY,
            tree_json TEXT NOT NULL,
            meta_json TEXT DEFAULT '{}',
            updated_at INTEGER NOT NULL,
            revision INTEGER NOT NULL DEFAULT 0
        );

        `
};
