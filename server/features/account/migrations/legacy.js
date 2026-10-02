const { rethrowMigrationError } = require('../../../platform/db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade3(inputs) {
try {
            inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN banner TEXT').run();
        } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade12(inputs) {
for (const m of inputs.msgs) {
            if (m.sender_id === 'user') {
                const profile = inputs.dependencies.db.prepare('SELECT name, avatar FROM user_profile WHERE id = ?').get('default');
                if (profile) {
                    inputs.dependencies.db.prepare('UPDATE group_messages SET sender_name = ?, sender_avatar = ? WHERE sender_id = ? AND sender_name IS NULL')
                        .run(profile.name || 'User', profile.avatar || '', 'user');
                }
            } else {
                const char = inputs.dependencies.db.prepare('SELECT name, avatar FROM characters WHERE id = ?').get(m.sender_id);
                if (char) {
                    inputs.dependencies.db.prepare('UPDATE group_messages SET sender_name = ?, sender_avatar = ? WHERE sender_id = ? AND sender_name IS NULL')
                        .run(char.name, char.avatar || '', m.sender_id);
                }
            }
        }

}

function upgrade16(inputs) {
try {
            inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN group_msg_limit INTEGER DEFAULT 20').run();
        } catch (e) {
            rethrowMigrationError(e); }
try {
            inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN private_msg_limit_for_group INTEGER DEFAULT 3').run();
        } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade18(inputs) {
const columns = new Set(inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().map(column => column.name));
if (!['group_proactive_enabled', 'group_interval_min', 'group_interval_max'].every(name => columns.has(name))) return;
try {
            const legacyGroupProactive = inputs.dependencies.db.prepare(`
                SELECT group_proactive_enabled, group_interval_min, group_interval_max
                FROM user_profile
                WHERE id = ?
            `).get('default');
            if (Number(legacyGroupProactive?.group_proactive_enabled || 0) === 1) {
                const min = Math.max(1, Math.min(1440, Number(legacyGroupProactive.group_interval_min || 10)));
                const max = Math.max(min, Math.min(1440, Number(legacyGroupProactive.group_interval_max || 60)));
                inputs.dependencies.db.prepare(`
                    UPDATE group_chats
                    SET group_proactive_enabled = 1,
                        group_interval_min = ?,
                        group_interval_max = ?
                    WHERE COALESCE(group_proactive_enabled, 0) = 0
                `).run(min, max);
            }
        } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade20(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN wallet REAL DEFAULT 520').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("UPDATE user_profile SET wallet = 520 WHERE wallet IS NULL").run(); } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade22(inputs) {
if (inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().some(column => column.name === 'theme')) {
    inputs.dependencies.db.prepare('ALTER TABLE user_profile DROP COLUMN theme').run();
}
if (inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().some(column => column.name === 'custom_css')) {
    inputs.dependencies.db.prepare('ALTER TABLE user_profile DROP COLUMN custom_css').run();
}
if (inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().some(column => column.name === 'theme_config')) {
    inputs.dependencies.db.prepare('ALTER TABLE user_profile DROP COLUMN theme_config').run();
}
if (inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().some(column => column.name === 'group_skip_rate')) {
    inputs.dependencies.db.prepare('ALTER TABLE user_profile DROP COLUMN group_skip_rate').run();
}
if (inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().some(column => column.name === 'jealousy_chance')) {
    inputs.dependencies.db.prepare('ALTER TABLE user_profile DROP COLUMN jealousy_chance').run();
}
if (inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().some(column => column.name === 'group_proactive_enabled')) {
    inputs.dependencies.db.prepare('ALTER TABLE user_profile DROP COLUMN group_proactive_enabled').run();
}
if (inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().some(column => column.name === 'group_interval_min')) {
    inputs.dependencies.db.prepare('ALTER TABLE user_profile DROP COLUMN group_interval_min').run();
}
if (inputs.dependencies.db.prepare('PRAGMA table_info(user_profile)').all().some(column => column.name === 'group_interval_max')) {
    inputs.dependencies.db.prepare('ALTER TABLE user_profile DROP COLUMN group_interval_max').run();
}

}

function upgrade24(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN avatar_frame TEXT DEFAULT ""').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN response_style_constitution TEXT DEFAULT ""').run(); } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade26(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN serper_api_key TEXT DEFAULT ""').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN web_search_keys_json TEXT DEFAULT "{}"').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN web_search_provider TEXT DEFAULT "auto"').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN memory_maintenance_api_endpoint TEXT DEFAULT ""').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN memory_maintenance_api_key TEXT DEFAULT ""').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN memory_maintenance_model_name TEXT DEFAULT ""').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN memory_maintenance_batch_size INTEGER DEFAULT 30').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE user_profile ADD COLUMN memory_maintenance_max_tokens INTEGER DEFAULT 8000').run(); } catch (e) {
            rethrowMigrationError(e); }

}
module.exports = { upgrade3, upgrade12, upgrade16, upgrade18, upgrade20, upgrade22, upgrade24, upgrade26 };
