const { rethrowMigrationError } = require('../../../platform/db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade5(inputs) {
try {
            inputs.dependencies.db.prepare('ALTER TABLE memories ADD COLUMN last_retrieved_at INTEGER').run();
        } catch (e) {
            rethrowMigrationError(e); }
try {
            inputs.dependencies.db.prepare('ALTER TABLE memories ADD COLUMN retrieval_count INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade14(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE memories ADD COLUMN group_id TEXT DEFAULT NULL').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN memory_type TEXT DEFAULT 'event'").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN summary TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN content TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN people_json TEXT DEFAULT '[]'").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN items_json TEXT DEFAULT '[]'").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN relationship_json TEXT DEFAULT '[]'").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN emotion TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN source_message_ids_json TEXT DEFAULT '[]'").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN dedupe_key TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN updated_at INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN is_archived INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN source_started_at INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN source_ended_at INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN source_time_text TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN source_message_count INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN memory_tier TEXT DEFAULT 'ambient'").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN memory_focus TEXT DEFAULT 'general'").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN maintenance_status TEXT DEFAULT 'pending'").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN classification_source TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN classified_at INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN retention_score REAL DEFAULT 1").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN retention_action TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN retention_reason TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN retention_checked_at INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN consolidation_key TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN consolidation_summary TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN consolidated_into_memory_id INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN archive_reason TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN forgetting_grace_started_at INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN forgetting_grace_expires_at INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN source_context TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN scene_tag TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN source_app TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN temporal_label TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN temporal_scope TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN temporal_anchor TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN temporal_confidence REAL DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN temporal_reason TEXT DEFAULT ''").run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE memories ADD COLUMN temporal_checked_at INTEGER DEFAULT 0").run(); } catch (e) {
            rethrowMigrationError(e); }
try {
            inputs.dependencies.db.exec(`
                CREATE TABLE IF NOT EXISTS external_memory_imports (
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
                CREATE TABLE IF NOT EXISTS external_memory_role_bindings (
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
            `);
        } catch (e) {
            rethrowMigrationError(e); }
try {
            inputs.dependencies.db.prepare(`
                UPDATE memories
                SET
                    summary = CASE WHEN COALESCE(summary, '') = '' THEN COALESCE(event, '') ELSE summary END,
                    content = CASE WHEN COALESCE(content, '') = '' THEN COALESCE(event, '') ELSE content END,
                    people_json = CASE WHEN COALESCE(people_json, '') = '' THEN json_array() ELSE people_json END,
                    items_json = CASE WHEN COALESCE(items_json, '') = '' THEN json_array() ELSE items_json END,
                    relationship_json = CASE WHEN COALESCE(relationship_json, '') = '' THEN json_array() ELSE relationship_json END,
                    source_message_ids_json = CASE WHEN COALESCE(source_message_ids_json, '') = '' THEN json_array() ELSE source_message_ids_json END,
                    updated_at = CASE WHEN COALESCE(updated_at, 0) = 0 THEN COALESCE(created_at, strftime('%s','now') * 1000) ELSE updated_at END,
                    source_started_at = CASE WHEN COALESCE(source_started_at, 0) = 0 THEN COALESCE(created_at, 0) ELSE source_started_at END,
                    source_ended_at = CASE WHEN COALESCE(source_ended_at, 0) = 0 THEN COALESCE(updated_at, created_at, 0) ELSE source_ended_at END,
                    source_time_text = CASE WHEN COALESCE(source_time_text, '') = '' AND COALESCE(time, '') <> '' THEN COALESCE(time, '') ELSE source_time_text END,
                    source_message_count = CASE WHEN COALESCE(source_message_count, 0) = 0 THEN CASE WHEN json_valid(source_message_ids_json) THEN json_array_length(source_message_ids_json) ELSE 0 END ELSE source_message_count END,
                    memory_tier = CASE WHEN COALESCE(memory_tier, '') = '' THEN 'ambient' ELSE memory_tier END,
                    memory_focus = CASE WHEN COALESCE(memory_focus, '') = '' THEN 'general' ELSE memory_focus END,
                    maintenance_status = CASE WHEN COALESCE(maintenance_status, '') = '' THEN 'pending' ELSE maintenance_status END,
                    retention_score = CASE WHEN retention_score IS NULL THEN 1 ELSE retention_score END
            `).run();
        } catch (e) {
            rethrowMigrationError(e); }

}
module.exports = { upgrade5, upgrade14 };
