// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function createGroup(id, name, memberIds, avatar = null) {
        const groupId = typeof id === 'string' ? id.trim() : '';
        const groupName = typeof name === 'string' ? name.trim() : '';
        if (!groupId) {
            const error = new Error('Invalid group id.');
            error.status = 400;
            throw error;
        }
        if (!groupName) {
            const error = new Error('Invalid group name.');
            error.status = 400;
            throw error;
        }
        const cleanMemberIds = Array.from(new Set((Array.isArray(memberIds) ? memberIds : [])
            .map(mid => String(mid || '').trim())
            .filter(Boolean)));
        const invalidMemberIds = cleanMemberIds.filter(mid => mid === 'user' || !dependencies.getCharacter(mid));
        if (cleanMemberIds.length === 0 || invalidMemberIds.length > 0) {
            const error = new Error('Invalid group member ids.');
            error.status = 400;
            error.invalid_member_ids = invalidMemberIds;
            throw error;
        }
        const safeAvatar = typeof avatar === 'string' ? avatar.trim() : null;
        dependencies.db.prepare('INSERT INTO group_chats (id, name, avatar, created_at) VALUES (?, ?, ?, ?)').run(groupId, groupName, safeAvatar || null, Date.now());
        const stmt = dependencies.db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id, role) VALUES (?, ?, ?)');
        stmt.run(groupId, 'user', 'owner');
        for (const mid of cleanMemberIds) {
            stmt.run(groupId, mid, 'member');
        }
        return groupId;
    }

function getGroups() {
        const groups = dependencies.db.prepare('SELECT * FROM group_chats ORDER BY created_at DESC').all();
        return groups.map(g => ({
            ...g,
            members: dependencies.db.prepare('SELECT member_id, role, joined_at FROM group_members WHERE group_id = ?').all(g.id)
        }));
    }

function getGroup(id) {
        const group = dependencies.db.prepare('SELECT * FROM group_chats WHERE id = ?').get(id);
        if (!group) return null;
        group.members = dependencies.db.prepare('SELECT member_id, role, joined_at FROM group_members WHERE group_id = ?').all(id);
        return group;
    }

function deleteGroup(id) {
        dependencies.db.prepare('DELETE FROM group_messages WHERE group_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM group_members WHERE group_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM group_conversation_digest_cache WHERE group_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM char_relationships WHERE source = ?').run(`group:${id}`);
        dependencies.db.prepare('DELETE FROM memories WHERE group_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM group_chats WHERE id = ?').run(id);
    }

function normalizeGroupMessageQueryLimit(value, fallback = 100, max = 200) {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
        return Math.min(parsed, max);
    }

function getGroupMessages(groupId, limit = 100) {
        const targetGroupId = String(groupId || '').trim();
        if (!targetGroupId) return [];
        const safeLimit = normalizeGroupMessageQueryLimit(limit, 100, 200);
        return dependencies.db.prepare('SELECT * FROM group_messages WHERE group_id = ? ORDER BY timestamp DESC LIMIT ?').all(targetGroupId, safeLimit).reverse();
    }

function getGroupMessagesAround(groupId, messageId, limit = 100) {
        const targetGroupId = String(groupId || '').trim();
        if (!targetGroupId) return [];
        const safeLimit = normalizeGroupMessageQueryLimit(limit, 100, 200);
        const safeMessageId = dependencies.normalizePositiveRowId(messageId, 'group message id');
        const target = dependencies.db.prepare('SELECT * FROM group_messages WHERE group_id = ? AND id = ?')
            .get(targetGroupId, safeMessageId);
        if (!target) return getGroupMessages(targetGroupId, safeLimit);
        const beforeLimit = Math.floor((safeLimit - 1) / 2);
        const afterLimit = Math.max(0, safeLimit - 1 - beforeLimit);
        const before = dependencies.db.prepare('SELECT * FROM group_messages WHERE group_id = ? AND id < ? ORDER BY id DESC LIMIT ?')
            .all(targetGroupId, safeMessageId, beforeLimit)
            .reverse();
        const after = dependencies.db.prepare('SELECT * FROM group_messages WHERE group_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
            .all(targetGroupId, safeMessageId, afterLimit);
        return [...before, target, ...after];
    }

function getGroupMessagesAfter(groupId, afterId, limit = 100) {
        const targetGroupId = String(groupId || '').trim();
        if (!targetGroupId) return [];
        const safeLimit = normalizeGroupMessageQueryLimit(limit, 100, 200);
        return dependencies.db.prepare('SELECT * FROM group_messages WHERE group_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
            .all(targetGroupId, afterId, safeLimit);
    }

function getVisibleGroupMessages(groupId, limit = 50, sinceTimestamp = 0) {
        const safeLimit = normalizeGroupMessageQueryLimit(limit, 50, 200);
        return dependencies.db.prepare('SELECT * FROM group_messages WHERE group_id = ? AND hidden = 0 AND timestamp >= ? ORDER BY timestamp DESC LIMIT ?').all(groupId, sinceTimestamp, safeLimit).reverse();
    }

function getUnsummarizedGroupMessages(groupId, olderThanTimestamp, limit = 50) {
        const safeLimit = normalizeGroupMessageQueryLimit(limit, 50, 500);
        return dependencies.db.prepare('SELECT * FROM group_messages WHERE group_id = ? AND hidden = 0 AND is_summarized = 0 AND timestamp < ? ORDER BY timestamp ASC LIMIT ?')
            .all(groupId, olderThanTimestamp, safeLimit);
    }

function countUnsummarizedGroupMessages(groupId, olderThanTimestamp) {
        const row = dependencies.db.prepare('SELECT COUNT(*) as count FROM group_messages WHERE group_id = ? AND hidden = 0 AND is_summarized = 0 AND timestamp < ?')
            .get(groupId, olderThanTimestamp);
        return row ? row.count : 0;
    }

function getOverflowGroupMessages(groupId, windowLimit = 0, limit = 50) {
        if (windowLimit <= 0) return [];
        return dependencies.db.prepare(`
            SELECT * FROM group_messages
            WHERE group_id = ?
              AND hidden = 0
              AND is_summarized = 0
              AND id NOT IN (
                SELECT id FROM group_messages
                WHERE group_id = ? AND hidden = 0
                ORDER BY id DESC
                LIMIT ?
              )
            ORDER BY timestamp ASC
            LIMIT ?
        `).all(groupId, groupId, windowLimit, limit);
    }

function countOverflowGroupMessages(groupId, windowLimit = 0) {
        if (windowLimit <= 0) return 0;
        const row = dependencies.db.prepare(`
            SELECT COUNT(*) as count FROM group_messages
            WHERE group_id = ?
              AND hidden = 0
              AND is_summarized = 0
              AND id NOT IN (
                SELECT id FROM group_messages
                WHERE group_id = ? AND hidden = 0
                ORDER BY id DESC
                LIMIT ?
              )
        `).get(groupId, groupId, windowLimit);
        return row ? row.count : 0;
    }

function markOverflowGroupMessagesSummarized(groupId, windowLimit = 0) {
        if (windowLimit <= 0) return 0;
        const info = dependencies.db.prepare(`
            UPDATE group_messages
            SET is_summarized = 1
            WHERE group_id = ?
              AND hidden = 0
              AND is_summarized = 0
              AND id NOT IN (
                SELECT id FROM group_messages
                WHERE group_id = ? AND hidden = 0
                ORDER BY id DESC
                LIMIT ?
              )
        `).run(groupId, groupId, windowLimit);
        return info ? info.changes : 0;
    }

function markGroupMessagesSummarized(messageIds) {
        if (!messageIds || messageIds.length === 0) return 0;
        const placeholders = messageIds.map(() => '?').join(', ');
        const info = dependencies.db.prepare(`UPDATE group_messages SET is_summarized = 1 WHERE id IN (${placeholders})`).run(...messageIds);
        return info.changes;
    }

function initializeSweepBaseline(characterId, privateWindow = 0, groupWindows = []) {
        let changed = 0;
        changed += dependencies.markOverflowMessagesSummarized(characterId, privateWindow);
        for (const gw of groupWindows || []) {
            if (!gw || !gw.groupId) continue;
            changed += markOverflowGroupMessagesSummarized(gw.groupId, gw.windowLimit || 0);
        }
        dependencies.db.prepare('UPDATE characters SET sweep_initialized = 1 WHERE id = ?').run(characterId);
        return changed;
    }

function addGroupMessage(groupId, senderId, content, senderName = null, senderAvatar = null, metadata = null) {
        const targetGroupId = String(groupId || '').trim();
        const cleanSenderId = String(senderId || '').trim();
        const safeContent = typeof content === 'string' ? content : '';
        if (!targetGroupId) {
            const error = new Error('Invalid group id.');
            error.status = 400;
            throw error;
        }
        if (!cleanSenderId) {
            const error = new Error('Invalid group message sender.');
            error.status = 400;
            throw error;
        }
        if (!safeContent.trim()) {
            const error = new Error('Group message content required.');
            error.status = 400;
            throw error;
        }
        const groupExists = dependencies.db.prepare('SELECT 1 FROM group_chats WHERE id = ? LIMIT 1').get(targetGroupId);
        if (!groupExists) {
            const error = new Error('Group not found.');
            error.status = 404;
            throw error;
        }
        if (cleanSenderId !== 'user' && cleanSenderId !== 'system') {
            const senderExists = dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(cleanSenderId);
            if (!senderExists) {
                const error = new Error('Group message sender not found.');
                error.status = 404;
                throw error;
            }
            const senderIsMember = dependencies.db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND member_id = ? LIMIT 1')
                .get(targetGroupId, cleanSenderId);
            if (!senderIsMember) {
                const error = new Error('Group message sender is not a member.');
                error.status = 403;
                throw error;
            }
        }
        const metadataStr = metadata ? JSON.stringify(metadata) : null;
        let info;
        try {
            info = dependencies.db.prepare('INSERT INTO group_messages (group_id, sender_id, content, timestamp, sender_name, sender_avatar, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(targetGroupId, cleanSenderId, safeContent, Date.now(), senderName, senderAvatar, metadataStr);
        } catch (e) {
            info = dependencies.db.prepare('INSERT INTO group_messages (group_id, sender_id, content, timestamp, sender_name, sender_avatar) VALUES (?, ?, ?, ?, ?, ?)')
                .run(targetGroupId, cleanSenderId, safeContent, Date.now(), senderName, senderAvatar);
        }
        return info.lastInsertRowid;
    }

function clearGroupMessages(groupId) {
        dependencies.db.prepare('DELETE FROM group_messages WHERE group_id = ?').run(groupId);
        dependencies.db.prepare('DELETE FROM group_conversation_digest_cache WHERE group_id = ?').run(groupId);
        dependencies.db.prepare('DELETE FROM char_relationships WHERE source = ?').run(`group:${groupId}`);
        dependencies.db.prepare('DELETE FROM memories WHERE group_id = ?').run(groupId);
    }

function deleteGroupMessages(groupId, messageIds) {
        const ids = Array.from(new Set((Array.isArray(messageIds) ? messageIds : [])
            .map(id => Number(id || 0))
            .filter(id => Number.isSafeInteger(id) && id > 0)))
            .slice(0, 500);
        if (!groupId || ids.length === 0) return 0;
        const placeholders = ids.map(() => '?').join(',');
        const info = dependencies.db.prepare(`DELETE FROM group_messages WHERE group_id = ? AND id IN (${placeholders})`).run(groupId, ...ids);
        return info.changes;
    }

function addGroupMember(groupId, memberId, role = 'member') {
        const cleanGroupId = String(groupId || '').trim();
        const cleanMemberId = String(memberId || '').trim();
        if (!cleanGroupId || !cleanMemberId || cleanMemberId === 'user') return 0;
        const groupExists = dependencies.db.prepare('SELECT 1 FROM group_chats WHERE id = ? LIMIT 1').get(cleanGroupId);
        if (!groupExists) return 0;
        const characterExists = dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(cleanMemberId);
        if (!characterExists) return 0;
        const info = dependencies.db.prepare('INSERT OR IGNORE INTO group_members (group_id, member_id, role, joined_at) VALUES (?, ?, ?, ?)').run(cleanGroupId, cleanMemberId, role, Date.now());
        return info.changes;
    }

function removeGroupMember(groupId, memberId) {
        dependencies.db.prepare('DELETE FROM group_members WHERE group_id = ? AND member_id = ?').run(groupId, memberId);
        dependencies.db.prepare('DELETE FROM group_conversation_digest_cache WHERE group_id = ? AND character_id = ?').run(groupId, memberId);
    }

function hideGroupMessagesByRange(groupId, startIdx, endIdx) {
        const allMsgs = dependencies.db.prepare('SELECT id FROM group_messages WHERE group_id = ? ORDER BY timestamp ASC').all(groupId);
        const toHide = allMsgs.slice(startIdx, endIdx + 1).map(m => m.id);
        if (toHide.length === 0) return 0;
        const placeholders = toHide.map(() => '?').join(', ');
        const info = dependencies.db.prepare(`UPDATE group_messages SET hidden = 1 WHERE id IN (${placeholders})`).run(...toHide);
        return info.changes;
    }

function hideGroupMessagesByIds(groupId, messageIds) {
        if (!messageIds || messageIds.length === 0) return 0;
        const placeholders = messageIds.map(() => '?').join(', ');
        const info = dependencies.db.prepare(`UPDATE group_messages SET hidden = 1 WHERE group_id = ? AND id IN (${placeholders})`).run(groupId, ...messageIds);
        return info.changes;
    }

function unhideGroupMessages(groupId) {
        const info = dependencies.db.prepare('UPDATE group_messages SET hidden = 0 WHERE group_id = ?').run(groupId);
        return info.changes;
    }

    return { createGroup, getGroups, getGroup, deleteGroup, normalizeGroupMessageQueryLimit, getGroupMessages, getGroupMessagesAround, getGroupMessagesAfter, getVisibleGroupMessages, getUnsummarizedGroupMessages, countUnsummarizedGroupMessages, getOverflowGroupMessages, countOverflowGroupMessages, markOverflowGroupMessagesSummarized, markGroupMessagesSummarized, initializeSweepBaseline, addGroupMessage, clearGroupMessages, deleteGroupMessages, addGroupMember, removeGroupMember, hideGroupMessagesByRange, hideGroupMessagesByIds, unhideGroupMessages };
}

module.exports = { createModule };
