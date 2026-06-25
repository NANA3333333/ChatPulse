const net = require('net');

const MCP_TASK_KINDS = new Set(['web_search', 'private_web_search', 'city_web_search', 'fetch_url']);
const MCP_SEARCH_PROVIDERS = new Set(['auto', 'duckduckgo', 'duckduckgo_instant_answer', 'serper', 'tavily', 'brave', 'bing']);
const MAX_MCP_TITLE_LENGTH = 160;
const MAX_MCP_NOTE_CONTENT_LENGTH = 200000;
const MAX_MCP_KNOWLEDGE_SEARCH_LIMIT = 30;
const MAX_MCP_KNOWLEDGE_LIST_LIMIT = 100;
const MAX_MCP_TASK_LIST_LIMIT = 200;

class McpLabValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'McpLabValidationError';
        this.statusCode = 400;
    }
}

function reject(message) {
    throw new McpLabValidationError(message);
}

function cleanText(value, maxLength = 2000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeHostname(value) {
    return String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isPrivateIpv4(hostname) {
    const parts = hostname.split('.').map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [a, b] = parts;
    return a === 0
        || a === 10
        || a === 127
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 198 && (b === 18 || b === 19))
        || a >= 224;
}

function isPrivateIpv6(hostname) {
    const clean = normalizeHostname(hostname);
    return clean === '::'
        || clean === '::1'
        || clean.startsWith('fc')
        || clean.startsWith('fd')
        || clean.startsWith('fe80:')
        || clean.startsWith('::ffff:127.')
        || clean.startsWith('::ffff:10.')
        || clean.startsWith('::ffff:192.168.')
        || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(clean);
}

function isBlockedMcpFetchHost(hostname) {
    const clean = normalizeHostname(hostname);
    if (!clean) return true;
    if (clean === 'localhost' || clean.endsWith('.localhost') || clean.endsWith('.local')) return true;
    const ipVersion = net.isIP(clean);
    if (ipVersion === 4) return isPrivateIpv4(clean);
    if (ipVersion === 6) return isPrivateIpv6(clean);
    return false;
}

function normalizeMcpProvider(value, fallback = 'auto') {
    const provider = String(value || fallback).trim() || fallback;
    if (!MCP_SEARCH_PROVIDERS.has(provider)) reject('Invalid web search provider');
    return provider;
}

function normalizeMcpHttpUrl(value, label = 'URL') {
    let parsed;
    try {
        parsed = new URL(String(value || '').trim());
    } catch (e) {
        reject(`${label} is invalid`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        reject(`${label} must be http or https`);
    }
    if (isBlockedMcpFetchHost(parsed.hostname)) {
        reject(`${label} host is not allowed`);
    }
    return parsed.toString();
}

function normalizeMcpSearchPayload(payload = {}) {
    const query = cleanText(payload.query, 300);
    if (!query) reject('Query is required');
    return {
        query,
        provider: normalizeMcpProvider(payload.provider),
        fetch_pages: payload.fetch_pages !== false,
        fetch_page_limit: normalizeMcpInteger(payload.fetch_page_limit, 3, 0, 5)
    };
}

function normalizeMcpInteger(value, fallback, min, max) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        reject('Invalid numeric value');
    }
    return parsed;
}

function normalizeMcpLimit(value, fallback, max) {
    return normalizeMcpInteger(value, fallback, 1, max);
}

function normalizeMcpTaskPayload(payload = {}) {
    const kind = String(payload.kind || 'web_search').trim();
    if (!MCP_TASK_KINDS.has(kind)) reject('Unsupported MCP Lab task kind');
    const input = payload.input && typeof payload.input === 'object' ? payload.input : {};
    const normalizedInput = kind === 'fetch_url'
        ? { url: normalizeMcpHttpUrl(input.url, 'URL') }
        : normalizeMcpSearchPayload(input);
    return {
        title: cleanText(payload.title || normalizedInput.query || normalizedInput.url || kind, MAX_MCP_TITLE_LENGTH) || kind,
        kind,
        input: normalizedInput
    };
}

function normalizeMcpKnowledgePayload(payload = {}) {
    const content = String(payload.content || '').trim();
    if (!content) reject('External knowledge content is required');
    if (content.length > MAX_MCP_NOTE_CONTENT_LENGTH) reject('External knowledge content is too large');
    const sourceUrl = String(payload.source_url || '').trim()
        ? normalizeMcpHttpUrl(payload.source_url, 'Source URL')
        : '';
    return {
        character_id: String(payload.character_id || '').trim(),
        title: cleanText(payload.title || sourceUrl || 'External note', 240) || 'External note',
        content,
        source_url: sourceUrl,
        source_type: cleanText(payload.source_type || (sourceUrl ? 'web' : 'note'), 80) || 'note',
        trust_level: cleanText(payload.trust_level || 'raw', 40) || 'raw',
        tags: payload.tags || []
    };
}

function normalizeMcpKnowledgeSearchPayload(payload = {}) {
    const query = cleanText(payload.query, 300);
    if (!query) reject('Knowledge search query is required');
    return {
        query,
        character_id: String(payload.character_id || '').trim(),
        limit: normalizeMcpLimit(payload.limit, 8, MAX_MCP_KNOWLEDGE_SEARCH_LIMIT)
    };
}

function normalizeMcpKnowledgeListOptions(payload = {}) {
    return {
        character_id: String(payload.character_id || '').trim(),
        limit: normalizeMcpLimit(payload.limit, 30, MAX_MCP_KNOWLEDGE_LIST_LIMIT)
    };
}

function normalizeMcpTaskListOptions(payload = {}) {
    return {
        limit: normalizeMcpLimit(payload.limit, 80, MAX_MCP_TASK_LIST_LIMIT)
    };
}

module.exports = {
    MCP_TASK_KINDS,
    MCP_SEARCH_PROVIDERS,
    MAX_MCP_KNOWLEDGE_SEARCH_LIMIT,
    MAX_MCP_KNOWLEDGE_LIST_LIMIT,
    MAX_MCP_TASK_LIST_LIMIT,
    McpLabValidationError,
    isMcpLabValidationError: (error) => error instanceof McpLabValidationError || error?.statusCode === 400,
    normalizeMcpHttpUrl,
    normalizeMcpKnowledgeListOptions,
    normalizeMcpKnowledgePayload,
    normalizeMcpKnowledgeSearchPayload,
    normalizeMcpProvider,
    normalizeMcpSearchPayload,
    normalizeMcpTaskListOptions,
    normalizeMcpTaskPayload
};
