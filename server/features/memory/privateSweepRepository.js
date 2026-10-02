// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getUnsummarizedMessages(characterId, olderThanTimestamp, limit = 50) {
        return dependencies.db.prepare('SELECT * FROM messages WHERE character_id = ? AND hidden = 0 AND is_summarized = 0 AND timestamp < ? ORDER BY timestamp ASC, id ASC LIMIT ?')
            .all(characterId, olderThanTimestamp, limit);
    }

function countUnsummarizedMessages(characterId, olderThanTimestamp) {
        const row = dependencies.db.prepare('SELECT COUNT(*) as count FROM messages WHERE character_id = ? AND hidden = 0 AND is_summarized = 0 AND timestamp < ?')
            .get(characterId, olderThanTimestamp);
        return row ? row.count : 0;
    }

function getOverflowMessages(characterId, windowLimit = 0, limit = 50) {
        if (windowLimit < 0) return [];
        return dependencies.db.prepare(`
            SELECT * FROM messages
            WHERE character_id = ?
              AND hidden = 0
              AND is_summarized = 0
              AND id NOT IN (
                SELECT id FROM messages
                WHERE character_id = ? AND hidden = 0
                ORDER BY id DESC
                LIMIT ?
              )
            ORDER BY timestamp ASC, id ASC
            LIMIT ?
        `).all(characterId, characterId, windowLimit, limit);
    }

function countOverflowMessages(characterId, windowLimit = 0) {
        if (windowLimit < 0) return 0;
        const row = dependencies.db.prepare(`
            SELECT COUNT(*) as count FROM messages
            WHERE character_id = ?
              AND hidden = 0
              AND is_summarized = 0
              AND id NOT IN (
                SELECT id FROM messages
                WHERE character_id = ? AND hidden = 0
                ORDER BY id DESC
                LIMIT ?
              )
        `).get(characterId, characterId, windowLimit);
        return row ? row.count : 0;
    }

function markOverflowMessagesSummarized(characterId, windowLimit = 0) {
        if (windowLimit < 0) return 0;
        const info = dependencies.db.prepare(`
            UPDATE messages
            SET is_summarized = 1
            WHERE character_id = ?
              AND hidden = 0
              AND is_summarized = 0
              AND id NOT IN (
                SELECT id FROM messages
                WHERE character_id = ? AND hidden = 0
                ORDER BY id DESC
                LIMIT ?
              )
        `).run(characterId, characterId, windowLimit);
        return info ? info.changes : 0;
    }

function markMessagesSummarized(messageIds) {
        if (!messageIds || messageIds.length === 0) return 0;
        const placeholders = messageIds.map(() => '?').join(', ');
        const info = dependencies.db.prepare(`UPDATE messages SET is_summarized = 1 WHERE id IN (${placeholders})`).run(...messageIds);
        return info.changes;
    }

    return { getUnsummarizedMessages, countUnsummarizedMessages, getOverflowMessages, countOverflowMessages, markOverflowMessagesSummarized, markMessagesSummarized };
}

module.exports = { createModule };
