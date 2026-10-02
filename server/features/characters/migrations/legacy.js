const { rethrowMigrationError } = require('../../../platform/db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade1(inputs) {
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN system_prompt TEXT').run();
        } catch (e) {
            rethrowMigrationError(e);
            // Ignore error if column already exists
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN created_at INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
            // Ignore error if column already exists
        }
try {
            inputs.dependencies.db.prepare("ALTER TABLE characters ADD COLUMN emoji TEXT DEFAULT '👤'").run();
        } catch (e) {
            rethrowMigrationError(e);
            // Ignore error if column already exists
        }

}

function upgrade6(inputs) {
inputs.addColumnIfMissing('characters', 'initial_affinity', 'INTEGER');
inputs.dependencies.db.prepare('UPDATE characters SET initial_affinity = affinity WHERE initial_affinity IS NULL').run();
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN max_tokens INTEGER DEFAULT 800').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN is_blocked INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN impression_q_limit INTEGER DEFAULT 3').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN context_msg_limit INTEGER DEFAULT 60').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
inputs.addColumnIfMissing('characters', 'sys_proactive', 'INTEGER DEFAULT 1');
inputs.addColumnIfMissing('characters', 'sys_timer', 'INTEGER DEFAULT 1');
inputs.addColumnIfMissing('characters', 'sys_pressure', 'INTEGER DEFAULT 1');
inputs.addColumnIfMissing('characters', 'sys_jealousy', 'INTEGER DEFAULT 1');
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN is_diary_unlocked INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sweep_limit INTEGER DEFAULT 30').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
if (inputs.addColumnIfMissing('characters', 'sweep_initialized', 'INTEGER DEFAULT 1')) {
            inputs.dependencies.db.prepare('UPDATE characters SET sweep_initialized = 0').run();
        }
try {
            inputs.dependencies.db.prepare("ALTER TABLE characters ADD COLUMN sweep_last_error TEXT DEFAULT ''").run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sweep_last_run_at INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sweep_last_success_at INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sweep_last_saved_count INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN private_summary_threshold INTEGER DEFAULT 30').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare("ALTER TABLE characters ADD COLUMN private_summary_last_error TEXT DEFAULT ''").run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN private_summary_last_run_at INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN private_summary_last_success_at INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN private_summary_baseline_message_id INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN diary_password TEXT').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare("ALTER TABLE characters ADD COLUMN hidden_state TEXT DEFAULT ''").run();
        } catch (e) {
            rethrowMigrationError(e);
        }

}

function upgrade10(inputs) {
inputs.addColumnIfMissing('characters', 'memory_api_endpoint', 'TEXT');
inputs.addColumnIfMissing('characters', 'memory_api_key', 'TEXT');
inputs.addColumnIfMissing('characters', 'memory_model_name', 'TEXT');
inputs.addColumnIfMissing('characters', 'tts_enabled', 'INTEGER DEFAULT 0');
inputs.addColumnIfMissing('characters', 'tts_provider', "TEXT DEFAULT 'tencent'");
inputs.addColumnIfMissing('characters', 'tts_api_key', "TEXT DEFAULT ''");
inputs.addColumnIfMissing('characters', 'tts_voice', "TEXT DEFAULT ''");
inputs.addColumnIfMissing('characters', 'tts_model', "TEXT DEFAULT ''");
inputs.addColumnIfMissing('characters', 'tts_endpoint', "TEXT DEFAULT ''");
inputs.addColumnIfMissing('characters', 'tts_trigger_mode', "TEXT DEFAULT 'tagged'");
inputs.addColumnIfMissing('characters', 'tts_autoplay', 'INTEGER DEFAULT 0');

}

function upgrade13(inputs) {
inputs.dependencies.ensureAllDiaryPasswords();
inputs.dependencies.ensureAllCharacterAvatars();
try {
            inputs.dependencies.db.prepare("UPDATE characters SET max_tokens = 2000 WHERE max_tokens IS NULL OR max_tokens <= 800").run();
        } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade19(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN wallet REAL DEFAULT 200').run(); } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade23(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN avatar_frame TEXT DEFAULT ""').run(); } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade27(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN jealousy_level INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE characters ADD COLUMN jealousy_target TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN city_reply_pending INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN city_ignore_streak INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN city_last_outreach_at INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN city_post_ignore_reaction INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sys_city_notify INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sys_city_social INTEGER DEFAULT 1').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN is_scheduled INTEGER DEFAULT 1').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN city_action_frequency INTEGER DEFAULT 1').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN stat_int INTEGER DEFAULT 50').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN stat_sta INTEGER DEFAULT 50').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN stat_cha INTEGER DEFAULT 50').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN energy INTEGER DEFAULT 100').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sleep_debt INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sleep_pressure INTEGER DEFAULT 20').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN mood INTEGER DEFAULT 50').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN stress INTEGER DEFAULT 20').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN social_need INTEGER DEFAULT 50').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE characters ADD COLUMN explicit_emotion_state TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN health INTEGER DEFAULT 100').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN satiety INTEGER DEFAULT 45').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN stomach_load INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN work_distraction INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE characters ADD COLUMN sleep_disruption INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
inputs.addColumnIfMissing('characters', 'llm_debug_capture', 'INTEGER DEFAULT 1');

}
module.exports = { upgrade1, upgrade6, upgrade10, upgrade13, upgrade19, upgrade23, upgrade27 };
