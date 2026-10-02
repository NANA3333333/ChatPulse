// Idempotent schema bootstrap, called after the existing messages table is initialized.
function ensureReplyVersionsSchema(sql) {
    sql.exec(`
        CREATE TABLE IF NOT EXISTS private_reply_runs (
            message_id INTEGER PRIMARY KEY,
            character_id TEXT NOT NULL,
            request_json TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            active_version INTEGER NOT NULL DEFAULT 0,
            revision INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS private_reply_versions (
            message_id INTEGER NOT NULL,
            version INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (message_id, version)
        );
        CREATE TABLE IF NOT EXISTS private_reply_members (
            member_id INTEGER PRIMARY KEY,
            message_id INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_private_reply_members_run ON private_reply_members(message_id);
        CREATE TRIGGER IF NOT EXISTS private_reply_member_deleted AFTER DELETE ON messages BEGIN
            DELETE FROM private_reply_runs WHERE message_id IN
                (SELECT message_id FROM private_reply_members WHERE member_id = OLD.id);
        END;
        CREATE TRIGGER IF NOT EXISTS private_reply_run_deleted AFTER DELETE ON private_reply_runs BEGIN
            DELETE FROM private_reply_versions WHERE message_id = OLD.message_id;
            DELETE FROM private_reply_members WHERE message_id = OLD.message_id;
        END;
    `);
}

module.exports = { ensureReplyVersionsSchema };
