// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function addReplyDispatchLog(entry) {
        const stmt = dependencies.db.prepare(`
            INSERT INTO reply_dispatch_logs (
                character_id,
                source,
                route,
                request_id,
                latest_user_message_id,
                latest_user_message_timestamp,
                payload,
                note,
                timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            entry.character_id,
            String(entry.source || 'unknown'),
            String(entry.route || ''),
            String(entry.request_id || ''),
            entry.latest_user_message_id ?? null,
            entry.latest_user_message_timestamp ?? null,
            typeof entry.payload === 'string' ? entry.payload : JSON.stringify(entry.payload || {}),
            String(entry.note || ''),
            entry.timestamp || Date.now()
        );
    }

function getReplyDispatchLogs(characterId, limit = 50) {
        const safeLimit = dependencies.normalizeSqlLimit(limit, 50, 200);
        return dependencies.db.prepare(`
            SELECT * FROM reply_dispatch_logs
            WHERE character_id = ?
            ORDER BY id DESC
            LIMIT ?
        `).all(characterId, safeLimit).map(row => {
            let payload = row.payload;
            if (typeof payload === 'string' && payload.trim()) {
                try {
                    payload = JSON.parse(payload);
                } catch (e) {
                    payload = { raw: payload };
                }
            }
            return { ...row, payload: payload || {} };
        });
    }

    return { addReplyDispatchLog, getReplyDispatchLogs };
}

module.exports = { createModule };
