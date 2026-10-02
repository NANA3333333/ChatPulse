const { replyError } = require("./errors");
const { ensureReplyVersionsSchema } = require("./migrations/replyVersions");

// Prompt snapshots stay in the user's database. Only version counters reach the UI.
function createPrivateReplyVersions(sql, { normalizeMessage, invalidateContext }) {
    ensureReplyVersionsSchema(sql);

    function getInfo(messageId) {
        return sql.prepare(`SELECT r.message_id AS messageId, r.active_version AS active,
            r.revision, (SELECT COUNT(*) FROM private_reply_versions v WHERE v.message_id = r.message_id) AS count
            FROM private_reply_runs r WHERE r.message_id = ?`).get(messageId) || null;
    }

    function getRun(characterId, messageId) {
        const row = sql.prepare(`SELECT r.* FROM private_reply_runs r JOIN messages m ON m.id = r.message_id
            WHERE r.message_id = ? AND r.character_id = ? AND m.character_id = ? AND m.role = 'character'`)
            .get(messageId, characterId, characterId);
        if (!row) throw replyError('这条回复没有可复用的生成记录，请在下一次新回复下使用重 roll。', 404, 'REPLY_NOT_FOUND');
        return { ...row, request: JSON.parse(row.request_json), metadata: JSON.parse(row.metadata_json) };
    }

    function getMessage(characterId, messageId) {
        const row = sql.prepare('SELECT * FROM messages WHERE id = ? AND character_id = ?').get(messageId, characterId);
        return row ? normalizeMessage(row) : null;
    }

    const register = sql.transaction((characterId, messageIds, request, metadata) => {
        if (!messageIds.length || !request?.messages?.length) return null;
        const rows = messageIds.map(id => sql.prepare('SELECT * FROM messages WHERE id = ? AND character_id = ? AND role = ?')
            .get(id, characterId, 'character'));
        if (rows.some(row => !row)) throw replyError('回复已被删除。');
        const messageId = messageIds[messageIds.length - 1];
        const safeMetadata = { ...(metadata || {}) };
        delete safeMetadata.tts;
        sql.prepare('INSERT INTO private_reply_runs (message_id, character_id, request_json, metadata_json) VALUES (?, ?, ?, ?)')
            .run(messageId, characterId, JSON.stringify(request), JSON.stringify(safeMetadata));
        sql.prepare('INSERT INTO private_reply_versions (message_id, version, content, created_at) VALUES (?, 0, ?, ?)')
            .run(messageId, rows.map(row => row.content).join('\n'), Date.now());
        for (const id of messageIds) sql.prepare('INSERT INTO private_reply_members (member_id, message_id) VALUES (?, ?)').run(id, messageId);
        return getMessage(characterId, messageId);
    });

    // Keep the final bubble's ID and timeline position even when a variant has a different bubble count.
    const select = sql.transaction((characterId, messageId, version, expectedRevision, content = null) => {
        const run = getRun(characterId, messageId);
        if (run.revision !== expectedRevision) throw replyError('回复版本已改变，请刷新后重试。');
        if (content !== null) {
            if (!String(content).trim()) throw replyError('主模型没有返回可见内容，已保留原回复。', 502);
            version = getInfo(messageId).count;
            sql.prepare('INSERT INTO private_reply_versions (message_id, version, content, created_at) VALUES (?, ?, ?, ?)')
                .run(messageId, version, content, Date.now());
        }
        const selected = sql.prepare('SELECT content FROM private_reply_versions WHERE message_id = ? AND version = ?').get(messageId, version);
        if (!selected) throw replyError('回复版本不存在。', 404, 'REPLY_VERSION_NOT_FOUND');
        const members = sql.prepare('SELECT member_id FROM private_reply_members WHERE message_id = ? ORDER BY member_id').all(messageId);
        const removedIds = members.map(row => row.member_id).filter(id => id !== messageId);
        // Detach members first so intentional replacement does not trigger run cleanup.
        for (const id of removedIds) {
            sql.prepare('DELETE FROM private_reply_members WHERE member_id = ?').run(id);
            sql.prepare('DELETE FROM messages WHERE id = ? AND character_id = ?').run(id, characterId);
        }
        for (const { member_id: id } of members) sql.prepare('DELETE FROM message_tts WHERE message_id = ?').run(id);
        sql.prepare('UPDATE messages SET content = ?, metadata = ? WHERE id = ? AND character_id = ?')
            .run(selected.content, JSON.stringify({ ...run.metadata, replyBubbles: true }), messageId, characterId);
        sql.prepare('UPDATE private_reply_runs SET active_version = ?, revision = revision + 1 WHERE message_id = ?').run(version, messageId);
        invalidateContext(characterId, members[0]?.member_id || messageId);
        return { character_id: characterId, removedIds, message: getMessage(characterId, messageId) };
    });

    return { getInfo, getRun, getMessage, register, select };
}

module.exports = { createPrivateReplyVersions };
