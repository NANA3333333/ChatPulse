const { rethrowMigrationError } = require('../../db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade28(inputs) {
try { inputs.dependencies.db.prepare("ALTER TABLE llm_cache ADD COLUMN cache_scope TEXT DEFAULT ''").run(); } catch (e) { rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare("ALTER TABLE llm_cache ADD COLUMN character_id TEXT DEFAULT ''").run(); } catch (e) { rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('CREATE INDEX IF NOT EXISTS idx_llm_cache_character ON llm_cache(character_id, expires_at)').run(); } catch (e) { rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('CREATE TABLE IF NOT EXISTS llm_cache_stats (scope TEXT PRIMARY KEY, lookup_count INTEGER NOT NULL DEFAULT 0, hit_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0)').run(); } catch (e) { rethrowMigrationError(e); }

}
module.exports = { upgrade28 };
