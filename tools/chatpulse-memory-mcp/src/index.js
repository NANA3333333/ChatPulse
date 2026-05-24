#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.chatpulse-memory-mcp', 'memory.db');
const DB_PATH = process.env.MEMORY_MCP_DB_PATH || DEFAULT_DB_PATH;
const EMBEDDING_MODEL = process.env.MEMORY_MCP_EMBEDDING_MODEL || 'Xenova/bge-m3';
const EMBEDDING_DIM = Number(process.env.MEMORY_MCP_EMBEDDING_DIM || 1024);
const DISABLE_EMBEDDINGS = process.env.MEMORY_MCP_DISABLE_EMBEDDINGS === '1';
const LLM_ENDPOINT = process.env.MEMORY_MCP_LLM_ENDPOINT || '';
const LLM_API_KEY = process.env.MEMORY_MCP_LLM_API_KEY || '';
const LLM_MODEL = process.env.MEMORY_MCP_LLM_MODEL || '';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  subject TEXT DEFAULT '',
  type TEXT DEFAULT 'event',
  tier TEXT DEFAULT 'ambient',
  focus TEXT DEFAULT 'general',
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  tags_json TEXT DEFAULT '[]',
  metadata_json TEXT DEFAULT '{}',
  importance INTEGER DEFAULT 5,
  embedding_json TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_retrieved_at INTEGER DEFAULT 0,
  retrieval_count INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories(namespace, archived, updated_at);
CREATE INDEX IF NOT EXISTS idx_memories_subject ON memories(namespace, subject, archived);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(namespace, type, archived);
`);

let extractorPromise = null;
const embeddingCache = new Map();

function now() {
  return Date.now();
}

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value, fallback) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/[,，、\n]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function clampImportance(value) {
  return Math.max(1, Math.min(10, Number(value || 5) || 5));
}

function normalizeMemory(input) {
  const content = String(input.content || input.summary || '').trim();
  const summary = String(input.summary || content).replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!content || !summary) throw new Error('Memory content or summary is required.');
  return {
    id: String(input.id || randomId()),
    namespace: String(input.namespace || 'default').trim() || 'default',
    subject: String(input.subject || '').trim().slice(0, 200),
    type: String(input.type || 'event').trim().slice(0, 80) || 'event',
    tier: String(input.tier || 'ambient').trim().slice(0, 80) || 'ambient',
    focus: String(input.focus || 'general').trim().slice(0, 80) || 'general',
    summary,
    content,
    tags: normalizeStringArray(input.tags),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    importance: clampImportance(input.importance),
    created_at: Number(input.created_at || now()) || now(),
    updated_at: now(),
    archived: input.archived ? 1 : 0
  };
}

function embeddingText(memory) {
  return [
    memory.summary,
    memory.content,
    memory.subject ? `Subject: ${memory.subject}` : '',
    memory.type ? `Type: ${memory.type}` : '',
    memory.focus ? `Focus: ${memory.focus}` : '',
    Array.isArray(memory.tags) && memory.tags.length ? `Tags: ${memory.tags.join(', ')}` : ''
  ].filter(Boolean).join('\n');
}

async function getExtractor() {
  if (DISABLE_EMBEDDINGS) return null;
  if (!extractorPromise) {
    extractorPromise = import('@xenova/transformers')
      .then(mod => mod.pipeline('feature-extraction', EMBEDDING_MODEL))
      .catch(err => {
        extractorPromise = null;
        throw err;
      });
  }
  return extractorPromise;
}

async function embed(text) {
  const normalized = String(text || '').trim();
  if (!normalized || DISABLE_EMBEDDINGS) return null;
  if (embeddingCache.has(normalized)) return embeddingCache.get(normalized);
  const extractor = await getExtractor();
  if (!extractor) return null;
  const output = await extractor(normalized, { pooling: 'mean', normalize: true });
  const vector = Array.from(output.data);
  if (vector.length !== EMBEDDING_DIM && process.env.MEMORY_MCP_STRICT_DIM === '1') {
    throw new Error(`Embedding dimension mismatch: got ${vector.length}, expected ${EMBEDDING_DIM}.`);
  }
  embeddingCache.set(normalized, vector);
  if (embeddingCache.size > 256) embeddingCache.delete(embeddingCache.keys().next().value);
  return vector;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i += 1) {
    const x = Number(a[i] || 0);
    const y = Number(b[i] || 0);
    dot += x * y;
    ma += x * x;
    mb += y * y;
  }
  return ma && mb ? dot / (Math.sqrt(ma) * Math.sqrt(mb)) : 0;
}

function lexicalScore(memory, query) {
  const terms = String(query || '').toLowerCase().split(/\s+/).map(v => v.trim()).filter(Boolean);
  if (!terms.length) return 0;
  const haystack = `${memory.summary}\n${memory.content}\n${memory.subject}\n${memory.tags.join(' ')}`.toLowerCase();
  let score = 0;
  for (const term of terms.slice(0, 12)) {
    let pos = haystack.indexOf(term);
    while (pos !== -1) {
      score += 0.08;
      pos = haystack.indexOf(term, pos + term.length);
    }
  }
  return Math.min(1, score);
}

function rowToMemory(row, includeEmbedding = false) {
  if (!row) return null;
  const embedding = safeJsonParse(row.embedding_json, null);
  const memory = {
    id: row.id,
    namespace: row.namespace,
    subject: row.subject || '',
    type: row.type || 'event',
    tier: row.tier || 'ambient',
    focus: row.focus || 'general',
    summary: row.summary || '',
    content: row.content || '',
    tags: safeJsonParse(row.tags_json, []),
    metadata: safeJsonParse(row.metadata_json, {}),
    importance: Number(row.importance || 5),
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0),
    last_retrieved_at: Number(row.last_retrieved_at || 0),
    retrieval_count: Number(row.retrieval_count || 0),
    archived: Number(row.archived || 0) === 1
  };
  if (includeEmbedding) memory.embedding = embedding;
  return memory;
}

async function saveMemory(input) {
  const memory = normalizeMemory(input);
  let vector = null;
  try {
    vector = await embed(embeddingText(memory));
  } catch (err) {
    if (process.env.MEMORY_MCP_REQUIRE_EMBEDDINGS === '1') throw err;
  }
  db.prepare(`
    INSERT INTO memories
      (id, namespace, subject, type, tier, focus, summary, content, tags_json, metadata_json,
       importance, embedding_json, created_at, updated_at, archived)
    VALUES
      (@id, @namespace, @subject, @type, @tier, @focus, @summary, @content, @tags_json,
       @metadata_json, @importance, @embedding_json, @created_at, @updated_at, @archived)
    ON CONFLICT(id) DO UPDATE SET
      namespace = excluded.namespace,
      subject = excluded.subject,
      type = excluded.type,
      tier = excluded.tier,
      focus = excluded.focus,
      summary = excluded.summary,
      content = excluded.content,
      tags_json = excluded.tags_json,
      metadata_json = excluded.metadata_json,
      importance = excluded.importance,
      embedding_json = excluded.embedding_json,
      updated_at = excluded.updated_at,
      archived = excluded.archived
  `).run({
    ...memory,
    tags_json: safeJsonStringify(memory.tags, []),
    metadata_json: safeJsonStringify(memory.metadata, {}),
    embedding_json: vector ? JSON.stringify(vector) : ''
  });
  return rowToMemory(db.prepare('SELECT * FROM memories WHERE id = ?').get(memory.id));
}

function buildWhere(options = {}) {
  const clauses = ['namespace = @namespace', 'archived = 0'];
  const params = { namespace: String(options.namespace || 'default') };
  if (options.subject) {
    clauses.push('subject = @subject');
    params.subject = String(options.subject);
  }
  if (options.type) {
    clauses.push('type = @type');
    params.type = String(options.type);
  }
  if (options.focus) {
    clauses.push('focus = @focus');
    params.focus = String(options.focus);
  }
  return { where: clauses.join(' AND '), params };
}

async function searchMemories(input) {
  const query = String(input.query || '').trim();
  if (!query) throw new Error('Query is required.');
  const limit = Math.max(1, Math.min(50, Number(input.limit || 8) || 8));
  const { where, params } = buildWhere(input);
  const rows = db.prepare(`SELECT * FROM memories WHERE ${where} ORDER BY updated_at DESC LIMIT 1000`).all(params);
  let queryVector = null;
  try {
    queryVector = await embed(query);
  } catch (err) {
    if (process.env.MEMORY_MCP_REQUIRE_EMBEDDINGS === '1') throw err;
  }
  const results = rows
    .map(row => {
      const memory = rowToMemory(row, true);
      const semantic = queryVector && memory.embedding ? cosineSimilarity(queryVector, memory.embedding) : 0;
      const lexical = lexicalScore(memory, query);
      const importanceBoost = Math.min(0.25, Number(memory.importance || 5) * 0.025);
      const score = Math.max(semantic, lexical) + importanceBoost;
      delete memory.embedding;
      return { ...memory, score: Number(score.toFixed(4)), semantic_score: Number(semantic.toFixed(4)), lexical_score: Number(lexical.toFixed(4)) };
    })
    .filter(item => item.score > 0.02)
    .sort((a, b) => b.score - a.score || b.updated_at - a.updated_at)
    .slice(0, limit);
  if (results.length) {
    const stamp = now();
    const update = db.prepare('UPDATE memories SET last_retrieved_at = ?, retrieval_count = retrieval_count + 1 WHERE id = ?');
    const tx = db.transaction(items => items.forEach(item => update.run(stamp, item.id)));
    tx(results);
  }
  return results;
}

function listMemories(input = {}) {
  const limit = Math.max(1, Math.min(200, Number(input.limit || 30) || 30));
  const { where, params } = buildWhere(input);
  return db.prepare(`SELECT * FROM memories WHERE ${where} ORDER BY updated_at DESC LIMIT @limit`)
    .all({ ...params, limit })
    .map(row => rowToMemory(row));
}

function deleteMemory(input) {
  const id = String(input.id || '').trim();
  if (!id) throw new Error('id is required.');
  const result = db.prepare('UPDATE memories SET archived = 1, updated_at = ? WHERE id = ?').run(now(), id);
  return { id, archived: result.changes > 0 };
}

async function callExtractionLLM(messages, options = {}) {
  const endpoint = String(options.endpoint || LLM_ENDPOINT).replace(/\/+$/, '');
  const apiKey = String(options.apiKey || LLM_API_KEY);
  const model = String(options.model || LLM_MODEL);
  if (!endpoint || !apiKey || !model) {
    throw new Error('Set MEMORY_MCP_LLM_ENDPOINT, MEMORY_MCP_LLM_API_KEY, and MEMORY_MCP_LLM_MODEL, or pass endpoint/apiKey/model.');
  }
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'Extract durable long-term memories from the conversation.',
            'Return only JSON: {"memories":[...]}',
            'Each memory: summary, content, importance 1-10, type, tier, focus, subject, tags array.',
            'Skip temporary chatter, greetings, and facts that will not matter later.'
          ].join('\n')
        },
        {
          role: 'user',
          content: JSON.stringify(messages, null, 2)
        }
      ]
    })
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || text || `LLM returned HTTP ${response.status}`);
  }
  const content = data?.choices?.[0]?.message?.content || '';
  const match = content.match(/\{[\s\S]*\}/);
  return safeJsonParse(match ? match[0] : content, { memories: [] });
}

async function extractMemories(input) {
  const namespace = String(input.namespace || 'default');
  const messages = Array.isArray(input.messages) ? input.messages : [];
  if (!messages.length) throw new Error('messages is required.');
  const extracted = await callExtractionLLM(messages, input.llm || {});
  const rawMemories = Array.isArray(extracted?.memories) ? extracted.memories : [];
  const saved = [];
  for (const item of rawMemories.slice(0, 20)) {
    if (!item || (!item.content && !item.summary)) continue;
    saved.push(await saveMemory({
      namespace,
      subject: input.subject || item.subject || '',
      type: item.type || 'event',
      tier: item.tier || 'ambient',
      focus: item.focus || 'general',
      summary: item.summary,
      content: item.content || item.summary,
      tags: item.tags,
      importance: item.importance,
      metadata: {
        ...(item.metadata || {}),
        extracted_by: 'chatpulse-memory-mcp',
        source_message_count: messages.length
      }
    }));
  }
  return { saved_count: saved.length, memories: saved };
}

function status() {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN embedding_json <> '' THEN 1 ELSE 0 END) AS embedded
    FROM memories
  `).get();
  return {
    db_path: DB_PATH,
    embedding_model: EMBEDDING_MODEL,
    embedding_disabled: DISABLE_EMBEDDINGS,
    embedding_cache_size: embeddingCache.size,
    llm_configured: Boolean(LLM_ENDPOINT && LLM_API_KEY && LLM_MODEL),
    total_memories: Number(row?.total || 0),
    active_memories: Number(row?.active || 0),
    embedded_memories: Number(row?.embedded || 0)
  };
}

function asText(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({
  name: 'chatpulse-memory-mcp',
  version: '0.1.0'
});

server.tool('memory_save', 'Save or update one long-term memory.', {
  namespace: z.string().default('default'),
  subject: z.string().optional(),
  summary: z.string().optional(),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(1).max(10).optional(),
  type: z.string().optional(),
  tier: z.string().optional(),
  focus: z.string().optional(),
  metadata: z.record(z.any()).optional()
}, async args => asText(await saveMemory(args)));

server.tool('memory_search', 'Search long-term memories with semantic search when embeddings are enabled, plus lexical fallback.', {
  namespace: z.string().default('default'),
  query: z.string(),
  limit: z.number().min(1).max(50).optional(),
  subject: z.string().optional(),
  type: z.string().optional(),
  focus: z.string().optional()
}, async args => asText(await searchMemories(args)));

server.tool('memory_list', 'List recent long-term memories in a namespace.', {
  namespace: z.string().default('default'),
  limit: z.number().min(1).max(200).optional(),
  subject: z.string().optional(),
  type: z.string().optional(),
  focus: z.string().optional()
}, async args => asText(listMemories(args)));

server.tool('memory_delete', 'Archive a memory by id.', {
  id: z.string()
}, async args => asText(deleteMemory(args)));

server.tool('memory_extract', 'Extract durable memories from messages using an OpenAI-compatible chat completions endpoint, then save them.', {
  namespace: z.string().default('default'),
  subject: z.string().optional(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string()
  })),
  llm: z.object({
    endpoint: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional()
  }).optional()
}, async args => asText(await extractMemories(args)));

server.tool('memory_status', 'Show storage, embedding, and configuration status.', {}, async () => asText(status()));

const transport = new StdioServerTransport();
await server.connect(transport);
