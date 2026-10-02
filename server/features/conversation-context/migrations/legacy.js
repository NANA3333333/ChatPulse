const { rethrowMigrationError } = require('../../../platform/db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade29(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE prompt_block_cache ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE prompt_block_cache ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE prompt_block_cache ADD COLUMN last_hit_at INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE history_window_cache ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE history_window_cache ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE history_window_cache ADD COLUMN last_hit_at INTEGER NOT NULL DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }

}
module.exports = { upgrade29 };
