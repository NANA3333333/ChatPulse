// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getLatestUserMessage(characterId) {
        const row = dependencies.db.prepare(`
            SELECT * FROM messages
            WHERE character_id = ? AND role = 'user'
            ORDER BY id DESC
            LIMIT 1
        `).get(characterId);
        return dependencies.normalizeMessageRow(row);
    }

function getVisibleMessages(characterId, limit = 0) {
        if (limit > 0) {
            return dependencies.db.prepare('SELECT * FROM messages WHERE character_id = ? AND hidden = 0 ORDER BY id DESC LIMIT ?')
                .all(characterId, limit)
                .reverse();
        }
        return dependencies.db.prepare('SELECT * FROM messages WHERE character_id = ? AND hidden = 0 ORDER BY id ASC')
            .all(characterId);
    }

function getVisibleMessagesSince(characterId, sinceTimestamp = 0) {
        return dependencies.db.prepare('SELECT * FROM messages WHERE character_id = ? AND hidden = 0 AND timestamp >= ? ORDER BY timestamp ASC')
            .all(characterId, sinceTimestamp);
    }

function inferCharacterCreatedAtFromId(characterId) {
        const match = String(characterId || '').match(/^char-(\d{12,14})(?:\D|$)/);
        const timestamp = Number(match?.[1] || 0);
        if (!Number.isSafeInteger(timestamp)) return 0;
        if (timestamp < Date.UTC(2020, 0, 1) || timestamp > Date.UTC(2100, 0, 1)) return 0;
        return timestamp;
    }

function getCharacterMessageStats(characterId) {
        const cleanCharacterId = String(characterId || '').trim();
        if (!cleanCharacterId) {
            return {
                first_message_at: 0,
                last_message_at: 0,
                last_user_message_at: 0,
                private_message_count: 0,
                user_message_count: 0,
                character_message_count: 0
            };
        }
        const inferredCreatedAt = inferCharacterCreatedAtFromId(cleanCharacterId);
        const earliestExpectedMessageAt = inferredCreatedAt
            ? Math.max(0, inferredCreatedAt - 24 * 60 * 60 * 1000)
            : 0;
        const row = dependencies.db.prepare(`
            SELECT
                MIN(CASE WHEN role IN ('user', 'character', 'assistant') AND timestamp > 0 THEN timestamp END) AS first_message_at,
                MIN(CASE
                    WHEN role IN ('user', 'character', 'assistant')
                      AND timestamp > 0
                      AND (? = 0 OR timestamp >= ?)
                    THEN timestamp
                END) AS first_valid_message_at,
                MAX(CASE WHEN role IN ('user', 'character', 'assistant') AND timestamp > 0 THEN timestamp END) AS last_message_at,
                MAX(CASE WHEN role = 'user' AND timestamp > 0 THEN timestamp END) AS last_user_message_at,
                COUNT(CASE WHEN role IN ('user', 'character', 'assistant') THEN 1 END) AS private_message_count,
                COUNT(CASE WHEN role = 'user' THEN 1 END) AS user_message_count,
                COUNT(CASE WHEN role IN ('character', 'assistant') THEN 1 END) AS character_message_count
            FROM messages
            WHERE character_id = ?
              AND COALESCE(hidden, 0) = 0
        `).get(earliestExpectedMessageAt, earliestExpectedMessageAt, cleanCharacterId) || {};
        return {
            first_message_at: Number(row.first_valid_message_at || row.first_message_at || 0),
            last_message_at: Number(row.last_message_at || 0),
            last_user_message_at: Number(row.last_user_message_at || 0),
            private_message_count: Number(row.private_message_count || 0),
            user_message_count: Number(row.user_message_count || 0),
            character_message_count: Number(row.character_message_count || 0)
        };
    }

function getRecentUserConversationIntel(spyCharacterId, options = {}) {
        const sinceHours = Math.max(1, Number(options.sinceHours || 5));
        const maxMessages = Math.max(1, Number(options.maxMessages || 20));
        const maxCharacters = Math.max(1, Number(options.maxCharacters || 20));
        const sinceTimestamp = Date.now() - sinceHours * 60 * 60 * 1000;

        const recentCharacters = dependencies.db.prepare(`
            SELECT
                character_id,
                MAX(timestamp) AS last_user_timestamp
            FROM messages
            WHERE hidden = 0
              AND role = 'user'
              AND timestamp >= ?
              AND character_id != ?
            GROUP BY character_id
            ORDER BY last_user_timestamp DESC
            LIMIT ?
        `).all(sinceTimestamp, spyCharacterId, maxCharacters);

        if (!Array.isArray(recentCharacters) || recentCharacters.length === 0) {
            return {
                since_timestamp: sinceTimestamp,
                since_hours: sinceHours,
                max_messages: maxMessages,
                max_characters: maxCharacters,
                per_character_limit: 0,
                characters: [],
                total_messages: 0
            };
        }

        const selectedCharacters = recentCharacters.slice(0, Math.min(maxCharacters, maxMessages));
        const perCharacterLimit = Math.max(1, Math.floor(maxMessages / selectedCharacters.length));
        const characters = [];
        let totalMessages = 0;

        for (const row of selectedCharacters) {
            const character = dependencies.getCharacter(row.character_id);
            if (!character) continue;
            const messages = dependencies.db.prepare(`
                SELECT *
                FROM messages
                WHERE character_id = ?
                  AND hidden = 0
                  AND timestamp >= ?
                  AND role IN ('user', 'character')
                ORDER BY timestamp DESC
                LIMIT ?
            `)
                .all(row.character_id, sinceTimestamp, perCharacterLimit)
                .reverse()
                .map(dependencies.normalizeMessageRow);

            characters.push({
                character_id: row.character_id,
                character_name: character.name,
                last_user_timestamp: Number(row.last_user_timestamp || 0),
                messages
            });
            totalMessages += messages.length;
        }

        return {
            since_timestamp: sinceTimestamp,
            since_hours: sinceHours,
            max_messages: maxMessages,
            max_characters: maxCharacters,
            per_character_limit: perCharacterLimit,
            characters,
            total_messages: totalMessages
        };
    }

function getLastUserMessageTimestamp(characterId) {
        const row = dependencies.db.prepare('SELECT timestamp FROM messages WHERE character_id = ? AND role = ? ORDER BY id DESC LIMIT 1')
            .get(characterId, 'user');
        return row ? row.timestamp : 0;
    }

function hideMessagesByRange(characterId, startIdx, endIdx) {
        const allMsgs = dependencies.db.prepare('SELECT id FROM messages WHERE character_id = ? ORDER BY timestamp ASC').all(characterId);
        const toHide = allMsgs.slice(startIdx, endIdx + 1).map(m => m.id);
        if (toHide.length === 0) return 0;
        const placeholders = toHide.map(() => '?').join(', ');
        const info = dependencies.db.prepare(`UPDATE messages SET hidden = 1 WHERE id IN (${placeholders})`).run(...toHide);
        return info.changes;
    }

function hideMessagesByIds(characterId, messageIds) {
        if (!messageIds || messageIds.length === 0) return 0;
        const placeholders = messageIds.map(() => '?').join(', ');
        // Security check: ONLY hide messages belonging to this characterId
        const info = dependencies.db.prepare(`UPDATE messages SET hidden = 1 WHERE character_id = ? AND id IN (${placeholders})`).run(characterId, ...messageIds);
        return info.changes;
    }

function unhideMessages(characterId) {
        const info = dependencies.db.prepare('UPDATE messages SET hidden = 0 WHERE character_id = ?').run(characterId);
        return info.changes;
    }

    return { getLatestUserMessage, getVisibleMessages, getVisibleMessagesSince, inferCharacterCreatedAtFromId, getCharacterMessageStats, getRecentUserConversationIntel, getLastUserMessageTimestamp, hideMessagesByRange, hideMessagesByIds, unhideMessages };
}

module.exports = { createModule };
