const { clampImportNumber } = require('../numbers');
// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function parseBooleanFlag(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value !== 'string') return false;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function stripBom(text) {
    return String(text || '').replace(/^\uFEFF/, '');
}

function firstImportString(...values) {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) return trimmed;
            continue;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
    }
    return '';
}



function makeImportedMemorySummary(text) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
}

function inferMemoryImportFormat(filename = '', explicitFormat = '') {
    const explicit = String(explicitFormat || '').trim().toLowerCase();
    if (['json', 'jsonl', 'ndjson', 'txt', 'text', 'md', 'markdown'].includes(explicit)) {
        if (explicit === 'ndjson') return 'jsonl';
        if (explicit === 'text') return 'txt';
        if (explicit === 'markdown') return 'md';
        return explicit;
    }
    const ext = dependencies.path.extname(filename || '').toLowerCase();
    if (ext === '.json') return 'json';
    if (ext === '.jsonl' || ext === '.ndjson') return 'jsonl';
    if (ext === '.md' || ext === '.markdown') return 'md';
    if (ext === '.txt') return 'txt';
    return '';
}

function hasImportMemoryContent(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return ['summary', 'content', 'event', 'text', 'memory', 'note', 'value'].some(key => {
        const item = value[key];
        return item !== undefined && item !== null && String(item).trim();
    });
}

function splitPlainTextMemories(text) {
    return stripBom(text)
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n+/)
        .map(part => part.replace(/^\s*[-*]\s+/gm, '').trim())
        .filter(Boolean);
}

function tryParseJsonValue(text) {
    try {
        return { ok: true, value: JSON.parse(stripBom(text)) };
    } catch (e) {
        return { ok: false, error: e };
    }
}

function safeJsonParse(text, fallback) {
    const parsed = tryParseJsonValue(String(text || ''));
    return parsed.ok ? parsed.value : fallback;
}

function extractMemoryEntriesFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (typeof payload === 'string') {
        const trimmed = stripBom(payload).trim();
        if (!trimmed) return [];
        const parsed = tryParseJsonValue(trimmed);
        if (parsed.ok) return extractMemoryEntriesFromPayload(parsed.value);
        return splitPlainTextMemories(trimmed);
    }
    if (!payload || typeof payload !== 'object') return [];

    if (Array.isArray(payload.memories)) return payload.memories;
    if (Array.isArray(payload.data?.memories)) return payload.data.memories;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.results)) return payload.results;
    if (!hasImportMemoryContent(payload) && Array.isArray(payload.items)) return payload.items;
    if (typeof payload.memories === 'string') return extractMemoryEntriesFromPayload(payload.memories);
    if (typeof payload.payload === 'string') return extractMemoryEntriesFromPayload(payload.payload);
    if (hasImportMemoryContent(payload)) return [payload];
    return [];
}

function parseMemoryImportText(text, format = '') {
    const normalizedText = stripBom(text).trim();
    if (!normalizedText) return [];

    if (format === 'json') {
        const parsed = JSON.parse(normalizedText);
        return extractMemoryEntriesFromPayload(parsed);
    }
    if (format === 'jsonl') {
        return normalizedText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map((line, idx) => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    throw new Error(`Invalid JSONL on line ${idx + 1}: ${e.message}`);
                }
            });
    }
    if (format === 'txt' || format === 'md') {
        return splitPlainTextMemories(normalizedText);
    }

    if (/^[\[{]/.test(normalizedText)) {
        const parsed = tryParseJsonValue(normalizedText);
        if (parsed.ok) return extractMemoryEntriesFromPayload(parsed.value);
    }
    return splitPlainTextMemories(normalizedText);
}

function parseMemoryImportRequest(req) {
    const file = req.files?.[0];
    if (file) {
        const format = inferMemoryImportFormat(file.originalname, req.body?.format);
        return {
            source: {
                type: 'file',
                filename: file.originalname || 'memory-import',
                format: format || 'text'
            },
            entries: parseMemoryImportText(file.buffer.toString('utf8'), format)
        };
    }

    const body = req.body;
    return {
        source: { type: 'json', format: 'json' },
        entries: extractMemoryEntriesFromPayload(body)
    };
}

function normalizeImportedMemoryEntry(entry, index) {
    if (typeof entry === 'string') {
        const content = entry.trim();
        if (!content) return { error: 'Empty memory text.' };
        return {
            data: {
                memory_type: 'imported',
                summary: makeImportedMemorySummary(content),
                content,
                event: makeImportedMemorySummary(content),
                importance: 5,
                memory_tier: 'ambient',
                memory_focus: 'general'
            }
        };
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return { error: 'Memory entry must be an object or string.' };
    }

    const content = firstImportString(entry.content, entry.text, entry.memory, entry.note, entry.value, entry.event, entry.summary);
    if (!content) {
        return { error: 'Memory entry is missing content, text, memory, note, event, or summary.' };
    }

    const summary = firstImportString(entry.summary, entry.title, entry.event, entry.memory, entry.text, entry.note, entry.value, makeImportedMemorySummary(content));
    const sourceStartedAt = clampImportNumber(entry.source_started_at ?? entry.created_at ?? entry.timestamp, 0, 0, Number.MAX_SAFE_INTEGER);
    const sourceEndedAt = clampImportNumber(entry.source_ended_at ?? entry.updated_at ?? sourceStartedAt, sourceStartedAt, 0, Number.MAX_SAFE_INTEGER);

    return {
        data: {
            memory_type: firstImportString(entry.memory_type, entry.type, 'imported'),
            summary: makeImportedMemorySummary(summary),
            content,
            event: firstImportString(entry.event, summary),
            time: firstImportString(entry.time),
            location: firstImportString(entry.location),
            people_json: entry.people_json ?? entry.people ?? [],
            items_json: entry.items_json ?? entry.items ?? [],
            relationship_json: entry.relationship_json ?? entry.relationships ?? [],
            emotion: firstImportString(entry.emotion),
            importance: clampImportNumber(entry.importance ?? entry.score, 5, 1, 10),
            source_message_ids_json: entry.source_message_ids_json ?? entry.source_message_ids ?? [],
            dedupe_key: firstImportString(entry.dedupe_key),
            is_archived: parseBooleanFlag(entry.is_archived) ? 1 : 0,
            source_started_at: sourceStartedAt,
            source_ended_at: sourceEndedAt,
            source_time_text: firstImportString(entry.source_time_text, entry.time_text),
            source_message_count: clampImportNumber(entry.source_message_count, 0, 0, Number.MAX_SAFE_INTEGER),
            memory_tier: firstImportString(entry.memory_tier, 'ambient'),
            memory_focus: firstImportString(entry.memory_focus, 'general'),
            group_id: firstImportString(entry.group_id)
        }
    };
}

    return { parseBooleanFlag, stripBom, firstImportString, clampImportNumber, makeImportedMemorySummary, inferMemoryImportFormat, hasImportMemoryContent, splitPlainTextMemories, tryParseJsonValue, safeJsonParse, extractMemoryEntriesFromPayload, parseMemoryImportText, parseMemoryImportRequest, normalizeImportedMemoryEntry };
}

module.exports = { createModule };
