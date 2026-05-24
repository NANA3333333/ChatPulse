import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-memory-mcp-'));
const dbPath = path.join(tempDir, 'memory.db');
const serverPath = path.resolve(import.meta.dirname, '..', 'src', 'index.js');

const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    MEMORY_MCP_DB_PATH: dbPath,
    MEMORY_MCP_DISABLE_EMBEDDINGS: '1'
  },
  stdio: ['pipe', 'pipe', 'inherit']
});

let nextId = 1;
let buffer = '';
const pending = new Map();

child.stdout.on('data', chunk => {
  buffer += chunk.toString();
  let idx = buffer.indexOf('\n');
  while (idx !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) {
      const msg = JSON.parse(line);
      const resolver = pending.get(msg.id);
      if (resolver) {
        pending.delete(msg.id);
        resolver(msg);
      }
    }
    idx = buffer.indexOf('\n');
  }
});

function request(method, params) {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  return new Promise(resolve => pending.set(id, resolve));
}

try {
  await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '0.0.0' }
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`);
  const tools = await request('tools/list', {});
  assert.equal(tools.error, undefined);
  assert.ok(tools.result.tools.some(tool => tool.name === 'memory_save'));
  const saved = await request('tools/call', {
    name: 'memory_save',
    arguments: {
      namespace: 'smoke',
      subject: 'user',
      summary: 'User likes compact memory systems.',
      content: 'The user prefers compact, portable long-term memory systems for agents.',
      tags: ['memory', 'mcp'],
      importance: 8
    }
  });
  assert.equal(saved.error, undefined);
  const searched = await request('tools/call', {
    name: 'memory_search',
    arguments: { namespace: 'smoke', query: 'portable memory', limit: 3 }
  });
  assert.equal(searched.error, undefined);
  const text = searched.result.content[0].text;
  assert.match(text, /portable long-term memory/);
  const list = await request('tools/call', {
    name: 'memory_list',
    arguments: { namespace: 'smoke', limit: 10 }
  });
  assert.equal(list.error, undefined);
  assert.match(list.result.content[0].text, /compact memory systems/);
  const status = await request('tools/call', {
    name: 'memory_status',
    arguments: {}
  });
  assert.equal(status.error, undefined);
  assert.match(status.result.content[0].text, /active_memories/);
  const savedPayload = JSON.parse(saved.result.content[0].text);
  const deleted = await request('tools/call', {
    name: 'memory_delete',
    arguments: { id: savedPayload.id }
  });
  assert.equal(deleted.error, undefined);
  assert.match(deleted.result.content[0].text, /"archived": true/);
  console.log('smoke ok');
} finally {
  child.kill();
}
