const { rethrowMigrationError } = require('../../../platform/db/migrationErrors.js');
// Compatibility upgrades invoked in their historical order by schemaLifecycle.
function upgrade2(inputs) {
try {
            inputs.dependencies.db.prepare('ALTER TABLE group_members ADD COLUMN joined_at INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade4(inputs) {
try {
            inputs.dependencies.db.prepare('ALTER TABLE group_chats ADD COLUMN context_msg_limit INTEGER DEFAULT 60').run();
        } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade9(inputs) {
inputs.addColumnIfMissing('group_messages', 'is_summarized', 'INTEGER DEFAULT 0');

}

function upgrade11(inputs) {
inputs.addColumnIfMissing('group_messages', 'sender_name', 'TEXT');
inputs.addColumnIfMissing('group_messages', 'sender_avatar', 'TEXT');
const msgs = inputs.dependencies.db.prepare('SELECT DISTINCT sender_id FROM group_messages WHERE sender_name IS NULL').all();
return { msgs };
}

function upgrade15(inputs) {
try {
            inputs.dependencies.db.prepare('ALTER TABLE group_messages ADD COLUMN hidden INTEGER DEFAULT 0').run();
        } catch (e) {
            rethrowMigrationError(e); }
try {
            inputs.dependencies.db.prepare('ALTER TABLE group_messages ADD COLUMN metadata TEXT DEFAULT NULL').run();
        } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade17(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE group_chats ADD COLUMN group_proactive_enabled INTEGER DEFAULT 0').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE group_chats ADD COLUMN group_interval_min INTEGER DEFAULT 10').run(); } catch (e) {
            rethrowMigrationError(e); }
try { inputs.dependencies.db.prepare('ALTER TABLE group_chats ADD COLUMN group_interval_max INTEGER DEFAULT 60').run(); } catch (e) {
            rethrowMigrationError(e); }

}

function upgrade25(inputs) {
try { inputs.dependencies.db.prepare('ALTER TABLE group_chats ADD COLUMN inject_limit INTEGER DEFAULT 5').run(); } catch (e) {
            rethrowMigrationError(e); }

}
module.exports = { upgrade2, upgrade4, upgrade9, upgrade11, upgrade15, upgrade17, upgrade25 };
