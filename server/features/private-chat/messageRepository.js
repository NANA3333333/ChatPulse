// Private message persistence; shared normalizers and cache invalidation are supplied by the database adapter.
function createMessageRepository(db, { normalizeSqlLimit, normalizePositiveRowId, normalizeMessageRow, clearCharacterMessageCaches, updateCharacter }) {
    function getMessages(characterId, limit = 100) {
        const safeLimit = normalizeSqlLimit(limit, 100, 200);
        return db.prepare('SELECT * FROM messages WHERE character_id = ? ORDER BY id DESC LIMIT ?')
            .all(characterId, safeLimit)
            .reverse()
            .map(normalizeMessageRow);
    }

    function getMessagesBefore(characterId, beforeId, limit = 100) {
        const safeLimit = normalizeSqlLimit(limit, 100, 200);
        return db.prepare('SELECT * FROM messages WHERE character_id = ? AND id < ? ORDER BY id DESC LIMIT ?')
            .all(characterId, beforeId, safeLimit)
            .reverse()
            .map(normalizeMessageRow);
    }

    function getMessagesAfter(characterId, afterId, limit = 100) {
        const safeLimit = normalizeSqlLimit(limit, 100, 200);
        return db.prepare('SELECT * FROM messages WHERE character_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
            .all(characterId, afterId, safeLimit)
            .map(normalizeMessageRow);
    }

    function getMessagesAround(characterId, messageId, limit = 100) {
        const safeLimit = normalizeSqlLimit(limit, 100, 200);
        const safeMessageId = normalizePositiveRowId(messageId, 'message id');
        const target = db.prepare('SELECT * FROM messages WHERE character_id = ? AND id = ?').get(characterId, safeMessageId);
        if (!target) return getMessages(characterId, safeLimit);
        const beforeLimit = Math.floor((safeLimit - 1) / 2);
        const afterLimit = Math.max(0, safeLimit - 1 - beforeLimit);
        const before = db.prepare('SELECT * FROM messages WHERE character_id = ? AND id < ? ORDER BY id DESC LIMIT ?')
            .all(characterId, safeMessageId, beforeLimit)
            .reverse();
        const after = db.prepare('SELECT * FROM messages WHERE character_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
            .all(characterId, safeMessageId, afterLimit);
        return [...before, target, ...after].map(normalizeMessageRow);
    }

    function addMessage(characterId, role, content, metadata = null) {
        const ts = Date.now();
        const targetCharacterId = String(characterId || '').trim();
        const safeRole = String(role || '').trim();
        const safeContent = typeof content === 'string' ? content : '';
        if (!targetCharacterId) {
            const error = new Error('Invalid character id.');
            error.status = 400;
            throw error;
        }
        if (!['user', 'character', 'system'].includes(safeRole)) {
            const error = new Error('Invalid message role.');
            error.status = 400;
            throw error;
        }
        if (!safeContent.trim()) {
            const error = new Error('Message content required.');
            error.status = 400;
            throw error;
        }
        const characterExists = db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(targetCharacterId);
        if (!characterExists) {
            const error = new Error('Character not found.');
            error.status = 404;
            throw error;
        }
        const metadataStr = metadata ? JSON.stringify(metadata) : null;
        let info;
        try {
            info = db.prepare('INSERT INTO messages (character_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?)')
                .run(targetCharacterId, safeRole, safeContent, ts, metadataStr);
        } catch (e) {
            // Fallback for old databases without metadata column
            info = db.prepare('INSERT INTO messages (character_id, role, content, timestamp) VALUES (?, ?, ?, ?)')
                .run(targetCharacterId, safeRole, safeContent, ts);
        }
        return { id: info.lastInsertRowid, timestamp: ts };
    }

    function deleteMessage(messageId, characterId = null) {
        const id = Number(messageId || 0);
        if (!Number.isSafeInteger(id) || id <= 0) return 0;
        const scopedCharacterId = characterId !== null && characterId !== undefined ? String(characterId || '').trim() : '';
        const info = scopedCharacterId
            ? db.prepare('DELETE FROM messages WHERE id = ? AND character_id = ?').run(id, scopedCharacterId)
            : db.prepare('DELETE FROM messages WHERE id = ?').run(id);
        if ((info.changes || 0) > 0) {
            db.prepare('DELETE FROM message_tts WHERE message_id = ?').run(id);
        }
        return info.changes || 0;
    }

    function getMessageCharacterId(messageId) {
        const id = Number(messageId || 0);
        if (!Number.isSafeInteger(id) || id <= 0) return null;
        const row = db.prepare('SELECT character_id FROM messages WHERE id = ? LIMIT 1').get(id);
        return row?.character_id || null;
    }

    function markMessagesRead(characterId) {
        db.prepare('UPDATE messages SET read = 1 WHERE character_id = ? AND read = 0 AND role = ?')
            .run(characterId, 'character');
    }

    function getUnreadCount(characterId) {
        const row = db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE character_id = ? AND role = ? AND read = 0').get(characterId, 'character');
        return row?.cnt || 0;
    }

    function clearMessages(characterId) {
        db.prepare('DELETE FROM messages WHERE character_id = ?').run(characterId);
        clearCharacterMessageCaches(characterId);
    }

    // Save the message and its character timestamp together before dispatching a reply.
    const saveUserMessage = db.transaction((characterId, content) => {
        const saved = addMessage(characterId, 'user', content);
        updateCharacter(characterId, { last_user_msg_time: saved.timestamp });
        return saved;
    });

    return { getMessages, getMessagesBefore, getMessagesAfter, getMessagesAround, addMessage, deleteMessage, getMessageCharacterId, markMessagesRead, getUnreadCount, clearMessages, saveUserMessage };
}

module.exports = { createMessageRepository };
