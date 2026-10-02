const { clipMemoryDisplayText } = require("./maintenance/index.js");
// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeMemorySourceRef(value) {
    const raw = String(value || '').trim();
    if (!raw) return { raw, kind: 'unknown', id: 0, key: 'unknown:' };
    const externalImport = raw.match(/^external[-_]?import:(\d+):([A-Za-z0-9_-]+)$/i);
    if (externalImport) {
        const importId = Number(externalImport[1] || 0);
        const candidateId = String(externalImport[2] || '').trim();
        return {
            raw,
            kind: 'external_app',
            id: importId,
            import_id: importId,
            candidate_id: candidateId,
            key: `external_app:${importId}:${candidateId}`
        };
    }
    const prefixed = raw.match(/^([a-z_-]+):(.+)$/i);
    const prefix = prefixed ? String(prefixed[1] || '').toLowerCase() : '';
    const idText = prefixed ? String(prefixed[2] || '').trim() : raw;
    const id = Number(idText);
    if (!Number.isFinite(id) || id <= 0) {
        return { raw, kind: 'unknown', id: 0, key: `unknown:${raw}` };
    }
    if (prefix === 'group') return { raw, kind: 'group_chat', id, key: `group_chat:${id}` };
    if (prefix === 'city') return { raw, kind: 'commercial_street', id, key: `commercial_street:${id}` };
    return { raw, kind: 'private_chat', id, key: `private_chat:${id}` };
}

function buildMemorySourcePayload(rawDb, refs = []) {
    const privateStmt = rawDb.prepare('SELECT id, character_id, role, content, timestamp FROM messages WHERE id = ?');
    const groupStmt = rawDb.prepare('SELECT id, group_id, sender_id, sender_name, content, timestamp FROM group_messages WHERE id = ?');
    const cityStmt = rawDb.prepare('SELECT id, character_id, action_type, content, location, timestamp FROM city_logs WHERE id = ?');
    const characterStmt = rawDb.prepare('SELECT name FROM characters WHERE id = ?');
    let externalImportStmt = null;
    try {
        externalImportStmt = rawDb.prepare('SELECT * FROM external_memory_imports WHERE id = ?');
    } catch (e) {
        externalImportStmt = null;
    }
    const characterNameCache = new Map();
    const getCharacterName = (characterId) => {
        const key = String(characterId || '');
        if (!key) return '';
        if (!characterNameCache.has(key)) {
            characterNameCache.set(key, characterStmt.get(key)?.name || key);
        }
        return characterNameCache.get(key);
    };

    return refs.map(ref => {
        if (ref.kind === 'private_chat') {
            const row = privateStmt.get(ref.id);
            if (row) {
                return {
                    source_key: ref.key,
                    raw_ref: ref.raw,
                    kind: ref.kind,
                    id: row.id,
                    character_id: row.character_id,
                    speaker: row.role === 'user' ? 'User' : getCharacterName(row.character_id),
                    role: row.role || '',
                    timestamp: Number(row.timestamp || 0),
                    content: row.content || '',
                    found: true
                };
            }
        }
        if (ref.kind === 'group_chat') {
            const row = groupStmt.get(ref.id);
            if (row) {
                return {
                    source_key: ref.key,
                    raw_ref: ref.raw,
                    kind: ref.kind,
                    id: row.id,
                    group_id: row.group_id,
                    speaker: row.sender_id === 'user' ? 'User' : (row.sender_name || getCharacterName(row.sender_id)),
                    role: row.sender_id || '',
                    timestamp: Number(row.timestamp || 0),
                    content: row.content || '',
                    found: true
                };
            }
        }
        if (ref.kind === 'commercial_street') {
            const row = cityStmt.get(ref.id);
            if (row) {
                return {
                    source_key: ref.key,
                    raw_ref: ref.raw,
                    kind: ref.kind,
                    id: row.id,
                    character_id: row.character_id,
                    speaker: getCharacterName(row.character_id),
                    role: row.action_type || 'city_log',
                    location: row.location || '',
                    timestamp: Number(row.timestamp || 0),
                    content: row.content || '',
                    found: true
                };
            }
        }
        if (ref.kind === 'external_app') {
            const row = externalImportStmt ? externalImportStmt.get(ref.import_id || ref.id) : null;
            if (row) {
                const summary = dependencies.tryParseJsonValue(row.summary_json || '{}').ok
                    ? dependencies.tryParseJsonValue(row.summary_json || '{}').value
                    : {};
                const messages = dependencies.tryParseJsonValue(row.normalized_messages_json || '[]').ok
                    ? dependencies.tryParseJsonValue(row.normalized_messages_json || '[]').value
                    : [];
                const candidates = Array.isArray(summary?.candidates) ? summary.candidates : [];
                const candidate = candidates.find(item => String(item.id || '') === String(ref.candidate_id || '')) || {};
                const sourceRefs = Array.isArray(candidate.source_refs) ? candidate.source_refs : [];
                const messageById = new Map((Array.isArray(messages) ? messages : []).map(message => [String(message.id), message]));
                const sourceMessages = sourceRefs.map(id => messageById.get(String(id))).filter(Boolean);
                const content = sourceMessages.length > 0
                    ? sourceMessages.map(message => `${message.speaker || 'Unknown'}: ${message.text || ''}`).join('\n')
                    : (candidate.content || candidate.summary || row.raw_text || '');
                const timestamps = sourceMessages.map(message => Number(message.timestamp || 0)).filter(ts => ts > 0);
                return {
                    source_key: ref.key,
                    raw_ref: ref.raw,
                    kind: ref.kind,
                    id: ref.import_id || ref.id,
                    candidate_id: ref.candidate_id || '',
                    source_app: row.source_app || '',
                    speaker: dependencies.getExternalSourceAppLabel(row.source_app || ''),
                    role: row.import_mode || 'external_import',
                    timestamp: timestamps.length ? Math.min(...timestamps) : Number(row.created_at || 0),
                    content: clipMemoryDisplayText(content, 4000),
                    found: true,
                    filename: row.filename || ''
                };
            }
        }
        return {
            source_key: ref.key,
            raw_ref: ref.raw,
            kind: ref.kind,
            id: ref.id,
            timestamp: 0,
            content: '',
            found: false
        };
    });
}

    return { normalizeMemorySourceRef, buildMemorySourcePayload };
}

module.exports = { createModule };
