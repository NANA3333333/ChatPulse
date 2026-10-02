const { normalizeExternalProcessingState } = require("../maintenance/index.js");
// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeExternalSourceApp(value = '') {
    const raw = String(value || '').trim().toLowerCase();
    if (/silly\s*tavern|sillytavern|tavern/.test(raw)) return 'sillytavern';
    if (/gemini|bard/.test(raw)) return 'gemini';
    if (/chatgpt|openai|\bgpt\b/.test(raw)) return 'gpt';
    return 'external_app';
}

function getExternalSourceAppLabel(sourceApp = '') {
    if (sourceApp === 'sillytavern') return 'SillyTavern';
    if (sourceApp === 'gemini') return 'Gemini';
    if (sourceApp === 'gpt') return 'GPT';
    return 'External App';
}

function getExternalSceneTag(sourceApp = '') {
    if (sourceApp === 'sillytavern') return 'external_sillytavern';
    if (sourceApp === 'gemini') return 'external_gemini';
    if (sourceApp === 'gpt') return 'external_gpt';
    return 'external_app';
}

function normalizeExternalImportMode(value = '', sourceApp = '') {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'multi_role' || raw === 'multi' || raw === 'group') return 'multi_role';
    if (raw === 'one_to_one' || raw === 'single' || raw === 'private') return 'one_to_one';
    return sourceApp === 'sillytavern' ? 'multi_role' : 'one_to_one';
}

function detectExternalSourceApp(filename = '', rawText = '') {
    const name = String(filename || '').toLowerCase();
    const text = String(rawText || '').slice(0, 300000);
    if (/silly\s*tavern|sillytavern|tavern|imported\.jsonl/.test(name)) return 'sillytavern';
    if (/"chat_metadata"|"swipes"|"mes"|"send_date"|LWB_|<本轮用户输入>|<recall>/i.test(text)) return 'sillytavern';
    if (/gemini|bard/.test(name) || /"chunkedPrompt"|"model":"gemini/i.test(text)) return 'gemini';
    if (/chatgpt|openai|conversations\.json/.test(name) || /"mapping"|"conversation_id"|"author"/i.test(text)) return 'gpt';
    return '';
}

function cleanExternalSpeakerName(value = '') {
    return String(value || '')
        .replace(/^[#@]+/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
}

function isLikelyUserSpeaker(name = '') {
    return /^(user|you|me|myself|human|nana|用户|我|自己)$/i.test(String(name || '').trim());
}

function extractExternalTextContent(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        return value.map(extractExternalTextContent).filter(Boolean).join('\n').trim();
    }
    if (typeof value !== 'object') return '';
    if (Array.isArray(value.parts)) return extractExternalTextContent(value.parts);
    if (Array.isArray(value.texts)) return extractExternalTextContent(value.texts);
    if (typeof value.text === 'string') return value.text.trim();
    if (typeof value.content === 'string') return value.content.trim();
    if (typeof value.value === 'string') return value.value.trim();
    if (typeof value.string_value === 'string') return value.string_value.trim();
    if (value.content && typeof value.content === 'object') return extractExternalTextContent(value.content);
    return '';
}

function escapeImportRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripExternalNoiseBlocks(text = '') {
    let output = String(text || '');
    const blockTags = [
        'think', 'thinking', 'thought', 'thoughts', 'analysis', 'reasoning',
        'scratchpad', 'cot', 'chain_of_thought', 'inner_monologue', 'recall'
    ];
    for (const tag of blockTags) {
        output = output.replace(new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, 'gi'), '\n');
    }
    output = output.replace(/^[\s\S]*?<\s*\/\s*(?:think|thinking|thought|thoughts|analysis|reasoning|scratchpad|cot|chain_of_thought|inner_monologue)\s*>/i, '\n');
    output = output.replace(/<\s*(?:本轮用户输入|当前用户输入|用户输入)[^>]*>[\s\S]*?<\s*\/\s*(?:本轮用户输入|当前用户输入|用户输入)\s*>/gi, '\n');
    const bracketLabels = [
        'think', 'thinking', 'analysis', 'reasoning', 'cot', 'chain of thought',
        '思维链', '推理', '分析', '内心', '心理活动'
    ];
    for (const label of bracketLabels) {
        const escaped = escapeImportRegex(label);
        output = output.replace(new RegExp(`\\[\\s*${escaped}\\s*\\][\\s\\S]*?\\[\\s*\\/\\s*${escaped}\\s*\\]`, 'gi'), '\n');
        output = output.replace(new RegExp(`【\\s*${escaped}\\s*】[\\s\\S]*?【\\s*\\/\\s*${escaped}\\s*】`, 'gi'), '\n');
    }
    output = output.replace(/```(?:think|thinking|analysis|reasoning|cot|chain[-_\s]*of[-_\s]*thought)[\s\S]*?```/gi, '\n');
    output = output.replace(/<\|im_(?:start|end)\|>/gi, '\n');
    output = output.replace(/<\/?s>/gi, '\n');
    return output;
}

function isExternalNoiseLine(line = '') {
    const text = String(line || '').trim();
    if (!text) return true;
    if (/^(?:---+|\*\*\*+|={3,})$/.test(text)) return true;
    if (/^\{\{[^}]{1,100}\}\}$/.test(text)) return true;
    if (/^<[^>]{1,100}>$/.test(text)) return true;
    if (/^(?:\[\/?(?:INST|SYS|SYSTEM|PROMPT|THINK|ANALYSIS|REASONING|COT)\]|<\/?(?:START|END)>)/i.test(text)) return true;
    if (/^###\s*(?:instruction|system|developer|prompt|input|response|assistant|user)\s*:?\s*$/i.test(text)) return true;
    if (/^(?:system|developer|instruction|prompt|jailbreak|persona|scenario|world\s*info|author'?s?\s*note|prefix|suffix|thinking|reasoning|analysis|chain\s*of\s*thought)\s*[:：]/i.test(text)) return true;
    if (/^(?:系统|开发者|指令|提示词?|系统提示|越狱|人格|角色设定|世界书|作者注|前缀|后缀|思维链|推理|分析|内心|心理活动)\s*[:：]/.test(text)) return true;
    if (/^\|?\s*(?:小猫之神|系统|system|developer)\s*\|?\s*/i.test(text)) return true;
    if (/^(?:以下|下面).{0,60}(?:输入|提示|记忆条目|索引编码|剧情相关|正文)/.test(text)) return true;
    return false;
}

function cleanExternalMessageText(text = '') {
    const original = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const stripped = stripExternalNoiseBlocks(original);
    const removedStructuredNoise = stripped !== original;
    let cleaned = stripped
        .replace(/\{\{\s*char\s*\}\}/gi, '角色')
        .replace(/\{\{\s*user\s*\}\}/gi, '用户')
        .replace(/\[\s*(?:\/?INST|\/?SYS|\/?SYSTEM|\/?PROMPT)\s*\]/gi, '\n');
    const lines = cleaned
        .split('\n')
        .map(line => line.trim())
        .filter(line => !isExternalNoiseLine(line));
    cleaned = lines.join('\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!cleaned && original.trim() && !removedStructuredNoise) {
        cleaned = original
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !isExternalNoiseLine(line))
            .join('\n')
            .trim();
    }
    return cleaned || '';
}

function cleanExternalMessagesForPrompt(messages = []) {
    let changed = 0;
    let dropped = 0;
    const cleanedMessages = [];
    for (const message of messages) {
        const rawText = String(message?.text || '');
        const cleanedText = cleanExternalMessageText(rawText);
        if (!cleanedText) {
            dropped += 1;
            continue;
        }
        if (cleanedText !== rawText.trim()) changed += 1;
        cleanedMessages.push({
            ...message,
            text: cleanedText.slice(0, 2200)
        });
    }
    return {
        messages: cleanedMessages,
        stats: {
            original_messages: messages.length,
            cleaned_messages: cleanedMessages.length,
            changed_messages: changed,
            dropped_messages: dropped
        }
    };
}

function normalizeExternalTimestamp(...values) {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || value <= 0) continue;
            return value < 100000000000 ? Math.round(value * 1000) : Math.round(value);
        }
        const parsed = Date.parse(String(value));
        if (Number.isFinite(parsed)) return parsed;
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric < 100000000000 ? Math.round(numeric * 1000) : Math.round(numeric);
        }
    }
    return 0;
}

function collectExternalMessages(value, out = [], depth = 0, seen = new Set()) {
    if (out.length >= dependencies.EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES || depth > 10 || value === undefined || value === null) return out;
    if (Array.isArray(value)) {
        for (const item of value) collectExternalMessages(item, out, depth + 1, seen);
        return out;
    }
    if (typeof value !== 'object') return out;

    const role = dependencies.firstImportString(value.role, value.author?.role, value.sender_role, value.type);
    const explicitName = dependencies.firstImportString(value.name, value.sender, value.sender_name, value.author?.name, value.from, value.user);
    const speaker = cleanExternalSpeakerName(explicitName || role || (value.is_user === true ? 'User' : ''));
    const text = extractExternalTextContent(value.mes ?? value.message ?? value.text ?? value.content ?? value.parts ?? value.value);
    const hasMessageShape = !!text && (
        !!speaker
        || Object.prototype.hasOwnProperty.call(value, 'mes')
        || Object.prototype.hasOwnProperty.call(value, 'role')
        || Object.prototype.hasOwnProperty.call(value, 'author')
        || Object.prototype.hasOwnProperty.call(value, 'is_user')
    );
    if (hasMessageShape) {
        const timestamp = normalizeExternalTimestamp(value.timestamp, value.created_at, value.updated_at, value.create_time, value.send_date, value.date);
        const compactText = text.replace(/\s+/g, ' ').trim();
        const dedupeKey = `${speaker}|${timestamp}|${compactText.slice(0, 120)}`;
        if (compactText && !seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            out.push({
                id: `m${out.length + 1}`,
                speaker: speaker || 'Unknown',
                role: role || (value.is_user === true ? 'user' : ''),
                timestamp,
                text: text.trim().slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_MAX_MESSAGE_CHARS)
            });
        }
        return out;
    }

    if (value.message && typeof value.message === 'object') {
        collectExternalMessages(value.message, out, depth + 1, seen);
    }

    const keys = ['messages', 'mapping', 'conversations', 'conversation', 'chat', 'history', 'data', 'items', 'rows', 'children'];
    for (const key of keys) {
        if (value[key] !== undefined) collectExternalMessages(value[key], out, depth + 1, seen);
    }
    if (value.mapping && typeof value.mapping === 'object') {
        for (const item of Object.values(value.mapping)) collectExternalMessages(item?.message || item, out, depth + 1, seen);
    }
    return out;
}

function splitExternalPlainTextMessages(text = '') {
    const rows = dependencies.stripBom(text)
        .replace(/\r\n/g, '\n')
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean);
    const messages = [];
    for (const line of rows) {
        if (messages.length >= dependencies.EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES) break;
        const match = line.match(/^([^:：]{1,80})[:：]\s*(.+)$/);
        const speaker = cleanExternalSpeakerName(match ? match[1] : '');
        const body = (match ? match[2] : line).trim();
        if (!body) continue;
        messages.push({
            id: `m${messages.length + 1}`,
            speaker: speaker || 'Unknown',
            role: isLikelyUserSpeaker(speaker) ? 'user' : '',
            timestamp: 0,
            text: body.slice(0, 2200)
        });
    }
    if (messages.length > 0) return messages;
    return dependencies.splitPlainTextMemories(text).slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES).map((part, idx) => ({
        id: `m${idx + 1}`,
        speaker: 'Unknown',
        role: '',
        timestamp: 0,
        text: part.slice(0, 2200)
    }));
}

function looksLikeExternalJsonl(filename = '', rawText = '') {
    if (/\.(?:jsonl|ndjson)$/i.test(String(filename || ''))) return true;
    const lines = String(rawText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 8);
    if (lines.length < 2) return false;
    return lines.filter(line => /^[\[{]/.test(line)).length >= 2;
}

function collectExternalJsonlMessages(rawText = '') {
    const messages = [];
    const seen = new Set();
    const lines = String(rawText || '').split(/\r?\n/);
    let parsedLines = 0;
    let failedLines = 0;
    for (const line of lines) {
        if (messages.length >= dependencies.EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES) break;
        const trimmed = line.trim();
        if (!trimmed || !/^[\[{]/.test(trimmed)) continue;
        try {
            const parsed = JSON.parse(trimmed);
            parsedLines += 1;
            collectExternalMessages(parsed, messages, 0, seen);
        } catch (e) {
            failedLines += 1;
        }
    }
    return { messages, parsedLines, failedLines };
}

function parseExternalImportRequest(req) {
    const file = req.files?.[0] || null;
    const filename = file?.originalname || '';
    let rawText = '';
    if (file) {
        rawText = file.buffer.toString('utf8');
    } else {
        rawText = dependencies.firstImportString(req.body?.text, req.body?.transcript, req.body?.raw_text, req.body?.content);
        if (!rawText && req.body && typeof req.body === 'object') {
            rawText = JSON.stringify(req.body);
        }
    }
    rawText = dependencies.stripBom(rawText).trim();
    if (!rawText) {
        const error = new Error('No external conversation text or file was provided.');
        error.status = 400;
        throw error;
    }
    const fullRawText = rawText;
    const rawTextForStorage = fullRawText.slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_MAX_RAW_CHARS);
    let parsed = null;
    let jsonlStats = null;
    let messages = [];
    if (looksLikeExternalJsonl(filename, fullRawText)) {
        jsonlStats = collectExternalJsonlMessages(fullRawText);
        messages = jsonlStats.messages;
    }
    if (messages.length === 0 && /^[\[{]/.test(fullRawText)) {
        try { parsed = JSON.parse(fullRawText); } catch (e) { parsed = null; }
    }
    if (messages.length === 0 && parsed) messages = collectExternalMessages(parsed);
    if (messages.length === 0) messages = splitExternalPlainTextMessages(rawTextForStorage);
    const cleaned = cleanExternalMessagesForPrompt(messages);
    return {
        filename,
        rawText: rawTextForStorage,
        cleanedRawText: cleanExternalMessageText(rawTextForStorage).slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_MAX_RAW_CHARS),
        messages: cleaned.messages,
        detectedSourceApp: detectExternalSourceApp(filename, fullRawText),
        cleanStats: {
            ...cleaned.stats,
            jsonl_parsed_lines: jsonlStats?.parsedLines || 0,
            jsonl_failed_lines: jsonlStats?.failedLines || 0,
            raw_chars: fullRawText.length,
            stored_raw_chars: rawTextForStorage.length
        }
    };
}

function loadExternalImportRequestFromDb(rawDb, importId) {
    const id = Number(importId || 0);
    if (!id) {
        const error = new Error('Missing external import id for retry.');
        error.status = 400;
        throw error;
    }
    const row = rawDb.prepare('SELECT * FROM external_memory_imports WHERE id = ?').get(id);
    if (!row) {
        const error = new Error('External import record not found.');
        error.status = 404;
        throw error;
    }
    const messages = dependencies.safeJsonParse(row.normalized_messages_json, []);
    if (!Array.isArray(messages) || messages.length === 0) {
        const error = new Error('This external import has no stored normalized messages to retry.');
        error.status = 422;
        throw error;
    }
    return {
        row,
        filename: row.filename || '',
        rawText: row.raw_text || '',
        cleanedRawText: cleanExternalMessageText(row.raw_text || '').slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_MAX_RAW_CHARS),
        messages,
        detectedSourceApp: normalizeExternalSourceApp(row.source_app || ''),
        storedSourceApp: normalizeExternalSourceApp(row.source_app || ''),
        storedImportMode: normalizeExternalImportMode(row.import_mode || '', row.source_app || ''),
        cleanStats: null
    };
}

function inferExternalImportContinueOffset(row = {}, limit = 10) {
    const summary = dependencies.safeJsonParse(row.summary_json, {});
    const explicitOffset = Number(summary?.last_run?.processed || summary?.continue_from?.offset || 0);
    if (Number.isFinite(explicitOffset) && explicitOffset > 0) return explicitOffset;
    const safeLimit = Math.max(1, Number(limit || 10) || 10);
    const saved = normalizeExternalProcessingState(row.memory_ids_json);
    const maxBatch = saved.reduce((max, item) => {
        const match = /^b(\d+)_/i.exec(String(item?.candidate_id || ''));
        return match ? Math.max(max, Number(match[1] || 0)) : max;
    }, 0);
    return maxBatch > 0 ? maxBatch * safeLimit : 0;
}

    return { normalizeExternalSourceApp, getExternalSourceAppLabel, getExternalSceneTag, normalizeExternalImportMode, detectExternalSourceApp, cleanExternalSpeakerName, isLikelyUserSpeaker, extractExternalTextContent, escapeImportRegex, stripExternalNoiseBlocks, isExternalNoiseLine, cleanExternalMessageText, cleanExternalMessagesForPrompt, normalizeExternalTimestamp, collectExternalMessages, splitExternalPlainTextMessages, looksLikeExternalJsonl, collectExternalJsonlMessages, parseExternalImportRequest, loadExternalImportRequestFromDb, inferExternalImportContinueOffset };
}

module.exports = { createModule };
