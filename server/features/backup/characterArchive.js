// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function sanitizeDownloadName(value, fallback = 'character') {
    const clean = (input) => String(input || '')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_.-]+/g, '_')
        .slice(0, 80);
    return clean(value) || clean(fallback) || 'character';
}

function normalizeCharacterArchivePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Character archive must be a JSON object.');
    }
    if (payload.data?.character) return payload.data;
    if (payload.character) return payload;
    throw new Error('Character archive is missing a character object.');
}

function parseCharacterArchiveRequest(req) {
    const file = req.files?.[0];
    if (file) {
        const format = dependencies.inferMemoryImportFormat(file.originalname, req.body?.format);
        if (format && format !== 'json') {
            throw new Error('Character archives must be .json files.');
        }
        return normalizeCharacterArchivePayload(JSON.parse(dependencies.stripBom(file.buffer.toString('utf8'))));
    }
    return normalizeCharacterArchivePayload(req.body);
}

function getTableColumnSet(rawDb, tableName) {
    try {
        return new Set(rawDb.prepare(`PRAGMA table_info(${tableName})`).all().map(col => col.name));
    } catch (e) {
        return new Set();
    }
}

function stringifyArchiveJson(value, fallback = null) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch (e) {
        return fallback;
    }
}

function toArchiveNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function makeInsertStatement(rawDb, tableName, columns) {
    const placeholders = columns.map(() => '?').join(', ');
    return rawDb.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`);
}

function runArchiveCleanup(rawDb, sql, ...params) {
    try {
        rawDb.prepare(sql).run(...params);
    } catch (e) { }
}

function clearCharacterArchiveData(rawDb, characterId) {
    runArchiveCleanup(rawDb, 'DELETE FROM message_tts WHERE character_id = ?', characterId);
    runArchiveCleanup(rawDb, 'DELETE FROM message_tts WHERE message_id IN (SELECT id FROM messages WHERE character_id = ?)', characterId);
    runArchiveCleanup(rawDb, 'DELETE FROM messages WHERE character_id = ?', characterId);
    runArchiveCleanup(rawDb, 'DELETE FROM memories WHERE character_id = ?', characterId);
    runArchiveCleanup(rawDb, 'DELETE FROM diaries WHERE character_id = ?', characterId);
    runArchiveCleanup(rawDb, 'DELETE FROM history_window_cache WHERE character_id = ?', characterId);
    runArchiveCleanup(rawDb, 'DELETE FROM prompt_block_cache WHERE character_id = ?', characterId);
    runArchiveCleanup(rawDb, 'DELETE FROM conversation_digest_cache WHERE character_id = ?', characterId);
    runArchiveCleanup(rawDb, 'DELETE FROM llm_cache WHERE character_id = ? OR cache_scope = ?', characterId, `character:${characterId}`);
}

function importArchiveMessages(rawDb, characterId, rows = []) {
    const columns = getTableColumnSet(rawDb, 'messages');
    const insertColumns = ['character_id', 'role', 'content', 'timestamp', 'read', 'hidden', 'is_summarized', 'metadata']
        .filter(col => columns.has(col));
    if (insertColumns.length === 0) return 0;
    const stmt = makeInsertStatement(rawDb, 'messages', insertColumns);
    let count = 0;
    for (const row of Array.isArray(rows) ? rows : []) {
        const content = dependencies.firstImportString(row?.content);
        if (!content) continue;
        const valuesByColumn = {
            character_id: characterId,
            role: dependencies.firstImportString(row?.role, 'system'),
            content,
            timestamp: toArchiveNumber(row?.timestamp, Date.now()),
            read: toArchiveNumber(row?.read, 0),
            hidden: toArchiveNumber(row?.hidden, 0),
            is_summarized: toArchiveNumber(row?.is_summarized, 0),
            metadata: stringifyArchiveJson(row?.metadata, null)
        };
        stmt.run(...insertColumns.map(col => valuesByColumn[col]));
        count += 1;
    }
    return count;
}

function importArchiveMemories(rawDb, characterId, rows = []) {
    const columns = getTableColumnSet(rawDb, 'memories');
    const insertColumns = [
        'character_id', 'time', 'location', 'people', 'event', 'relationships', 'items',
        'importance', 'embedding', 'created_at', 'last_retrieved_at', 'retrieval_count',
        'group_id', 'memory_type', 'summary', 'content', 'people_json', 'items_json',
        'relationship_json', 'emotion', 'source_message_ids_json', 'dedupe_key', 'updated_at',
        'is_archived', 'source_started_at', 'source_ended_at', 'source_time_text',
        'source_message_count', 'memory_tier', 'memory_focus',
        'source_context', 'scene_tag', 'source_app',
        'maintenance_status', 'classification_source', 'classified_at',
        'retention_score', 'retention_action', 'retention_reason', 'retention_checked_at',
        'consolidation_key', 'consolidation_summary', 'consolidated_into_memory_id', 'archive_reason',
        'forgetting_grace_started_at', 'forgetting_grace_expires_at',
        'temporal_label', 'temporal_scope', 'temporal_anchor', 'temporal_confidence', 'temporal_reason', 'temporal_checked_at'
    ].filter(col => columns.has(col));
    if (insertColumns.length === 0) return 0;
    const stmt = makeInsertStatement(rawDb, 'memories', insertColumns);
    let count = 0;
    for (const row of Array.isArray(rows) ? rows : []) {
        const summary = dependencies.firstImportString(row?.summary, row?.event, row?.content);
        const content = dependencies.firstImportString(row?.content, row?.event, summary);
        const event = dependencies.firstImportString(row?.event, summary, content, '(empty memory)');
        if (!event && !content && !summary) continue;
        const createdAt = toArchiveNumber(row?.created_at, Date.now());
        const valuesByColumn = {
            character_id: characterId,
            time: dependencies.firstImportString(row?.time),
            location: dependencies.firstImportString(row?.location),
            people: dependencies.firstImportString(row?.people),
            event,
            relationships: dependencies.firstImportString(row?.relationships),
            items: dependencies.firstImportString(row?.items),
            importance: dependencies.clampImportNumber(row?.importance, 5, 1, 10),
            embedding: null,
            created_at: createdAt,
            last_retrieved_at: toArchiveNumber(row?.last_retrieved_at, 0),
            retrieval_count: toArchiveNumber(row?.retrieval_count, 0),
            group_id: dependencies.firstImportString(row?.group_id),
            memory_type: dependencies.firstImportString(row?.memory_type, 'event'),
            summary: summary || event || content,
            content: content || event || summary,
            people_json: stringifyArchiveJson(row?.people_json ?? row?.people ?? [], '[]'),
            items_json: stringifyArchiveJson(row?.items_json ?? row?.items ?? [], '[]'),
            relationship_json: stringifyArchiveJson(row?.relationship_json ?? row?.relationships ?? [], '[]'),
            emotion: dependencies.firstImportString(row?.emotion),
            source_message_ids_json: stringifyArchiveJson(row?.source_message_ids_json ?? row?.source_message_ids ?? [], '[]'),
            dedupe_key: dependencies.firstImportString(row?.dedupe_key),
            updated_at: toArchiveNumber(row?.updated_at, createdAt),
            is_archived: toArchiveNumber(row?.is_archived, 0),
            source_started_at: toArchiveNumber(row?.source_started_at, 0),
            source_ended_at: toArchiveNumber(row?.source_ended_at, 0),
            source_time_text: dependencies.firstImportString(row?.source_time_text),
            source_message_count: toArchiveNumber(row?.source_message_count, 0),
            memory_tier: dependencies.firstImportString(row?.memory_tier, 'ambient'),
            memory_focus: dependencies.firstImportString(row?.memory_focus, 'general'),
            source_context: dependencies.firstImportString(row?.source_context),
            scene_tag: dependencies.firstImportString(row?.scene_tag),
            source_app: dependencies.firstImportString(row?.source_app),
            maintenance_status: dependencies.firstImportString(row?.maintenance_status, 'pending'),
            classification_source: dependencies.firstImportString(row?.classification_source),
            classified_at: toArchiveNumber(row?.classified_at, 0),
            retention_score: Number.isFinite(Number(row?.retention_score)) ? Number(row.retention_score) : 1,
            retention_action: dependencies.firstImportString(row?.retention_action),
            retention_reason: dependencies.firstImportString(row?.retention_reason),
            retention_checked_at: toArchiveNumber(row?.retention_checked_at, 0),
            consolidation_key: dependencies.firstImportString(row?.consolidation_key),
            consolidation_summary: dependencies.firstImportString(row?.consolidation_summary),
            consolidated_into_memory_id: toArchiveNumber(row?.consolidated_into_memory_id, 0),
            archive_reason: dependencies.firstImportString(row?.archive_reason),
            forgetting_grace_started_at: toArchiveNumber(row?.forgetting_grace_started_at, 0),
            forgetting_grace_expires_at: toArchiveNumber(row?.forgetting_grace_expires_at, 0),
            temporal_label: dependencies.firstImportString(row?.temporal_label),
            temporal_scope: dependencies.firstImportString(row?.temporal_scope),
            temporal_anchor: dependencies.firstImportString(row?.temporal_anchor),
            temporal_confidence: Number.isFinite(Number(row?.temporal_confidence)) ? Number(row.temporal_confidence) : 0,
            temporal_reason: dependencies.firstImportString(row?.temporal_reason),
            temporal_checked_at: toArchiveNumber(row?.temporal_checked_at, 0)
        };
        stmt.run(...insertColumns.map(col => valuesByColumn[col]));
        count += 1;
    }
    return count;
}

function importArchiveDiaries(rawDb, characterId, rows = []) {
    const columns = getTableColumnSet(rawDb, 'diaries');
    const insertColumns = ['character_id', 'content', 'emotion', 'is_unlocked', 'timestamp']
        .filter(col => columns.has(col));
    if (insertColumns.length === 0) return 0;
    const stmt = makeInsertStatement(rawDb, 'diaries', insertColumns);
    let count = 0;
    for (const row of Array.isArray(rows) ? rows : []) {
        const content = dependencies.firstImportString(row?.content);
        if (!content) continue;
        const valuesByColumn = {
            character_id: characterId,
            content,
            emotion: dependencies.firstImportString(row?.emotion),
            is_unlocked: toArchiveNumber(row?.is_unlocked, 0),
            timestamp: toArchiveNumber(row?.timestamp, Date.now())
        };
        stmt.run(...insertColumns.map(col => valuesByColumn[col]));
        count += 1;
    }
    return count;
}

function importCharacterArchiveRows(rawDb, characterId, payload) {
    return {
        messages: importArchiveMessages(rawDb, characterId, payload.messages),
        memories: importArchiveMemories(rawDb, characterId, payload.memories),
        diaries: importArchiveDiaries(rawDb, characterId, payload.diaries)
    };
}

    return { sanitizeDownloadName, normalizeCharacterArchivePayload, parseCharacterArchiveRequest, getTableColumnSet, stringifyArchiveJson, toArchiveNumber, makeInsertStatement, runArchiveCleanup, clearCharacterArchiveData, importArchiveMessages, importArchiveMemories, importArchiveDiaries, importCharacterArchiveRows };
}

module.exports = { createModule };
