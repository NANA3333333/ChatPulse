// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function escapeLikeSearchTerm(value = '') {
        return String(value || '').replace(/[\\%_]/g, '\\$&');
    }

function normalizeMessageSearchLimit(value, fallback = 80, max = 200) {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
        return Math.min(parsed, max);
    }

function normalizeMessageSearchOffset(value) {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 0) return 0;
        return Math.min(parsed, 100000);
    }

function getPrivateSearchContextMessages(characterId, messageId, radius = 2) {
        const safeMessageId = Number(messageId);
        if (!characterId || !Number.isSafeInteger(safeMessageId) || safeMessageId <= 0) return [];
        const profile = dependencies.getUserProfile();
        const character = dependencies.getCharacter(characterId);
        const before = dependencies.db.prepare('SELECT id, role, content, timestamp FROM messages WHERE character_id = ? AND id < ? ORDER BY id DESC LIMIT ?')
            .all(characterId, safeMessageId, radius)
            .reverse();
        const target = dependencies.db.prepare('SELECT id, role, content, timestamp FROM messages WHERE character_id = ? AND id = ?')
            .get(characterId, safeMessageId);
        const after = dependencies.db.prepare('SELECT id, role, content, timestamp FROM messages WHERE character_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
            .all(characterId, safeMessageId, radius);
        return [...before, target, ...after]
            .filter(Boolean)
            .map(row => ({
                message_id: Number(row.id || 0),
                sender_role: row.role || '',
                sender_name: row.role === 'user'
                    ? (profile?.name || 'User')
                    : (row.role === 'system' ? 'System' : (character?.name || 'Character')),
                content: row.content || '',
                timestamp: Number(row.timestamp || 0),
                is_match: Number(row.id || 0) === safeMessageId
            }));
    }

function getGroupSearchContextMessages(groupId, messageId, radius = 2) {
        const safeMessageId = Number(messageId);
        if (!groupId || !Number.isSafeInteger(safeMessageId) || safeMessageId <= 0) return [];
        const before = dependencies.db.prepare('SELECT id, sender_id, sender_name, content, timestamp FROM group_messages WHERE group_id = ? AND id < ? ORDER BY id DESC LIMIT ?')
            .all(groupId, safeMessageId, radius)
            .reverse();
        const target = dependencies.db.prepare('SELECT id, sender_id, sender_name, content, timestamp FROM group_messages WHERE group_id = ? AND id = ?')
            .get(groupId, safeMessageId);
        const after = dependencies.db.prepare('SELECT id, sender_id, sender_name, content, timestamp FROM group_messages WHERE group_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
            .all(groupId, safeMessageId, radius);
        const profile = dependencies.getUserProfile();
        return [...before, target, ...after]
            .filter(Boolean)
            .map(row => {
                const senderId = String(row.sender_id || '').trim();
                const character = senderId && senderId !== 'user' && senderId !== 'system' ? dependencies.getCharacter(senderId) : null;
                return {
                    message_id: Number(row.id || 0),
                    sender_role: senderId,
                    sender_name: senderId === 'user'
                        ? (row.sender_name || profile?.name || 'User')
                        : (senderId === 'system' ? 'System' : (row.sender_name || character?.name || senderId || 'Character')),
                    content: row.content || '',
                    timestamp: Number(row.timestamp || 0),
                    is_match: Number(row.id || 0) === safeMessageId
                };
            });
    }

function searchMessages(query, options = {}) {
        const cleanQuery = String(query || '').trim();
        if (!cleanQuery) return { results: [], has_more: false, next_offset: null, offset: 0, limit: 10 };
        const scope = ['all', 'private', 'group'].includes(String(options.scope || '').trim())
            ? String(options.scope || '').trim()
            : 'all';
        const limit = normalizeMessageSearchLimit(options.limit, 10, 10);
        const offset = normalizeMessageSearchOffset(options.offset);
        const pattern = `%${escapeLikeSearchTerm(cleanQuery)}%`;
        const queryParts = [];
        const params = [];

        if (scope === 'all' || scope === 'private') {
            queryParts.push(`
                SELECT
                    'private' AS scope,
                    m.id AS message_id,
                    m.character_id AS conversation_id,
                    m.character_id AS character_id,
                    NULL AS group_id,
                    COALESCE(c.name, m.character_id) AS conversation_name,
                    CASE
                        WHEN m.role = 'user' THEN COALESCE(up.name, 'User')
                        WHEN m.role IN ('character', 'assistant') THEN COALESCE(c.name, m.role)
                        ELSE 'System'
                    END AS sender_name,
                    CASE
                        WHEN m.role = 'user' THEN COALESCE(up.avatar, '')
                        ELSE COALESCE(c.avatar, '')
                    END AS sender_avatar,
                    m.role AS sender_role,
                    m.content AS content,
                    m.timestamp AS timestamp
                FROM messages m
                JOIN characters c ON c.id = m.character_id
                LEFT JOIN user_profile up ON up.id = 'default'
                WHERE m.role IN ('user', 'character', 'assistant')
                  AND m.content LIKE ? ESCAPE '\\'
            `);
            params.push(pattern);
        }

        if (scope === 'all' || scope === 'group') {
            queryParts.push(`
                SELECT
                    'group' AS scope,
                    gm.id AS message_id,
                    gm.group_id AS conversation_id,
                    NULL AS character_id,
                    gm.group_id AS group_id,
                    COALESCE(gc.name, gm.group_id) AS conversation_name,
                    CASE
                        WHEN gm.sender_id = 'user' THEN COALESCE(gm.sender_name, up.name, 'User')
                        WHEN gm.sender_id = 'system' THEN 'System'
                        ELSE COALESCE(gm.sender_name, c.name, gm.sender_id)
                    END AS sender_name,
                    CASE
                        WHEN gm.sender_id = 'user' THEN COALESCE(gm.sender_avatar, up.avatar, '')
                        ELSE COALESCE(gm.sender_avatar, c.avatar, '')
                    END AS sender_avatar,
                    gm.sender_id AS sender_role,
                    gm.content AS content,
                    gm.timestamp AS timestamp
                FROM group_messages gm
                JOIN group_chats gc ON gc.id = gm.group_id
                LEFT JOIN user_profile up ON up.id = 'default'
                LEFT JOIN characters c ON c.id = gm.sender_id
                WHERE gm.sender_id != 'system'
                  AND gm.content LIKE ? ESCAPE '\\'
            `);
            params.push(pattern);
        }

        const rows = dependencies.db.prepare(`
            SELECT *
            FROM (
                ${queryParts.join('\nUNION ALL\n')}
            )
            ORDER BY timestamp DESC, message_id DESC, scope ASC
            LIMIT ? OFFSET ?
        `).all(...params, limit + 1, offset);
        const hasMore = rows.length > limit;
        const pageRows = rows.slice(0, limit);

        return {
            results: pageRows.map(row => ({
                id: `${row.scope}:${row.message_id}`,
                scope: row.scope,
                message_id: Number(row.message_id || 0),
                conversation_id: row.conversation_id,
                character_id: row.character_id,
                group_id: row.group_id,
                conversation_name: row.conversation_name || '',
                sender_name: row.sender_name || '',
                sender_avatar: row.sender_avatar || '',
                sender_role: row.sender_role || '',
                content: row.content || '',
                timestamp: Number(row.timestamp || 0),
                context_messages: row.scope === 'group'
                    ? getGroupSearchContextMessages(row.group_id, row.message_id)
                    : getPrivateSearchContextMessages(row.character_id, row.message_id)
            })),
            has_more: hasMore,
            next_offset: hasMore ? offset + pageRows.length : null,
            offset,
            limit
        };
    }

    return { escapeLikeSearchTerm, normalizeMessageSearchLimit, normalizeMessageSearchOffset, getPrivateSearchContextMessages, getGroupSearchContextMessages, searchMessages };
}

module.exports = { createModule };
