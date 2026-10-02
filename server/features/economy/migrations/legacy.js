const { rethrowMigrationError } = require('../../../platform/db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade21(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE private_transfers ADD COLUMN refunded INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }

}
module.exports = { upgrade21 };
