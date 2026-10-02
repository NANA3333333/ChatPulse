const { rethrowMigrationError } = require('../../../platform/db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade7(inputs) {
try {
            const historyCount = inputs.dependencies.db.prepare('SELECT COUNT(*) as c FROM char_impression_history').get().c;
            if (historyCount === 0) {
                // If history is completely empty, backfill it from existing impressions
                const existingRels = inputs.dependencies.db.prepare('SELECT * FROM char_relationships WHERE impression IS NOT NULL AND impression != \'\'').all();
                if (existingRels.length > 0) {
                    const insertStmt = inputs.dependencies.db.prepare('INSERT INTO char_impression_history (source_id, target_id, impression, trigger_event, timestamp) VALUES (?, ?, ?, ?, ?)');
                    inputs.dependencies.db.transaction(() => {
                        for (const r of existingRels) {
                            insertStmt.run(r.source_id, r.target_id, r.impression, `Migration: ${r.source}`, Date.now());
                        }
                    })();
                    console.log(`[DB Migration] Backfilled ${existingRels.length} impression histories for user ${inputs.dependencies.userId}.`);
                }
            }
        } catch (e) {
            rethrowMigrationError(e);
            console.error('[DB Migration] Failed to backfill impression history:', e.message);
        }

}
module.exports = { upgrade7 };
