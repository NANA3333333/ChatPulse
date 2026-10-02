// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    user_profile: `CREATE TABLE IF NOT EXISTS user_profile (
            id TEXT PRIMARY KEY DEFAULT 'default',
            name TEXT DEFAULT 'User',
            avatar TEXT,
            avatar_frame TEXT DEFAULT '',
            bio TEXT DEFAULT '',
            group_msg_limit INTEGER DEFAULT 20,
            banner TEXT,
            private_msg_limit_for_group INTEGER DEFAULT 3,
            serper_api_key TEXT DEFAULT '',
            web_search_keys_json TEXT DEFAULT '{}',
            web_search_provider TEXT DEFAULT 'auto',
            memory_maintenance_api_endpoint TEXT DEFAULT '',
            memory_maintenance_api_key TEXT DEFAULT '',
            memory_maintenance_model_name TEXT DEFAULT '',
            memory_maintenance_batch_size INTEGER DEFAULT 30,
            memory_maintenance_max_tokens INTEGER DEFAULT 8000
        );
        `
};
