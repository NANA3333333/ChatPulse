// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeMessageTtsRow(row) {
        if (!row) return null;
        let intent = {};
        try {
            intent = row.intent_json ? JSON.parse(row.intent_json) : {};
        } catch (e) {
            intent = {};
        }
        return { ...row, intent };
    }

function upsertMessageTts(entry = {}) {
        const now = Date.now();
        const messageId = dependencies.normalizePositiveRowId(entry.message_id, 'message id');
        const message = dependencies.db.prepare('SELECT id, character_id FROM messages WHERE id = ? LIMIT 1').get(messageId);
        if (!message) {
            const error = new Error('Message not found.');
            error.status = 404;
            throw error;
        }
        if (dependencies.privateReplyVersions?.getInfo(messageId)?.revision > 0) {
            const error = new Error('Reply text changed while speech was being generated.');
            error.status = 409;
            throw error;
        }
        const requestedCharacterId = String(entry.character_id || '').trim();
        const characterId = String(message.character_id || '').trim();
        if (requestedCharacterId && requestedCharacterId !== characterId) {
            const error = new Error('TTS character does not match message.');
            error.status = 400;
            throw error;
        }
        const rawDurationMs = entry.duration_ms === undefined || entry.duration_ms === null || entry.duration_ms === ''
            ? 0
            : Number(entry.duration_ms);
        if (!Number.isFinite(rawDurationMs) || rawDurationMs < 0) {
            const error = new Error('Invalid TTS duration.');
            error.status = 400;
            throw error;
        }
        const existing = dependencies.db.prepare('SELECT created_at FROM message_tts WHERE message_id = ?').get(messageId);
        dependencies.db.prepare(`
            INSERT INTO message_tts (
                message_id, character_id, provider, voice, model, status, audio_path, mime_type,
                duration_ms, error, intent_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(message_id) DO UPDATE SET
                character_id = excluded.character_id,
                provider = excluded.provider,
                voice = excluded.voice,
                model = excluded.model,
                status = excluded.status,
                audio_path = excluded.audio_path,
                mime_type = excluded.mime_type,
                duration_ms = excluded.duration_ms,
                error = excluded.error,
                intent_json = excluded.intent_json,
                updated_at = excluded.updated_at
        `).run(
            messageId,
            characterId,
            String(entry.provider || ''),
            String(entry.voice || ''),
            String(entry.model || ''),
            String(entry.status || 'pending'),
            String(entry.audio_path || ''),
            String(entry.mime_type || 'audio/mpeg'),
            Math.floor(rawDurationMs),
            String(entry.error || ''),
            typeof entry.intent_json === 'string' ? entry.intent_json : JSON.stringify(entry.intent_json || {}),
            Number(existing?.created_at || entry.created_at || now),
            Number(entry.updated_at || now)
        );
        return getMessageTts(messageId);
    }

function getMessageTts(messageId) {
        const id = dependencies.normalizePositiveRowId(messageId, 'message id');
        return normalizeMessageTtsRow(dependencies.db.prepare(`
            SELECT message_tts.*
            FROM message_tts
            JOIN messages ON messages.id = message_tts.message_id
            WHERE message_tts.message_id = ?
        `).get(id));
    }

    return { normalizeMessageTtsRow, upsertMessageTts, getMessageTts };
}

module.exports = { createModule };
