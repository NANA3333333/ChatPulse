const { rethrowMigrationError } = require('../../../platform/db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade8(inputs) {
try {
            inputs.dependencies.db.prepare('ALTER TABLE messages ADD COLUMN hidden INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
try {
            inputs.dependencies.db.prepare('ALTER TABLE messages ADD COLUMN metadata TEXT DEFAULT NULL').run();
        } catch (e) {
            rethrowMigrationError(e);
        }
inputs.addColumnIfMissing('messages', 'is_summarized', 'INTEGER DEFAULT 0');

}
module.exports = { upgrade8 };
