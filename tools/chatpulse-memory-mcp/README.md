# ChatPluse Memory MCP

This is a portable MCP server that extracts the reusable core of ChatPluse's memory system:

- structured long-term memory records
- namespace isolation for different apps, users, agents, or characters
- local SQLite persistence
- semantic retrieval with `@xenova/transformers` when enabled
- lexical fallback when embeddings are disabled or unavailable
- optional LLM-powered memory extraction through an OpenAI-compatible `/chat/completions` API

It is not a full copy of ChatPluse's in-app memory engine. The original system is tightly coupled to ChatPluse characters, message history, private summaries, RAG planning, Qdrant, WebSocket updates, and UI routes. This MCP package keeps the part other apps can realistically reuse.

## Install

```bash
cd tools/chatpulse-memory-mcp
npm install
```

## Run

```bash
npm start
```

By default, data is stored at:

```text
~/.chatpulse-memory-mcp/memory.db
```

Useful environment variables:

```bash
MEMORY_MCP_DB_PATH=/path/to/memory.db
MEMORY_MCP_DISABLE_EMBEDDINGS=1
MEMORY_MCP_EMBEDDING_MODEL=Xenova/bge-m3
MEMORY_MCP_LLM_ENDPOINT=https://api.openai.com/v1
MEMORY_MCP_LLM_API_KEY=...
MEMORY_MCP_LLM_MODEL=gpt-4.1-mini
```

## MCP Client Config Example

```json
{
  "mcpServers": {
    "chatpulse-memory": {
      "command": "node",
      "args": ["C:/Users/Nana/Documents/ChatPluse/tools/chatpulse-memory-mcp/src/index.js"],
      "env": {
        "MEMORY_MCP_DB_PATH": "C:/Users/Nana/.chatpulse-memory-mcp/memory.db",
        "MEMORY_MCP_DISABLE_EMBEDDINGS": "1"
      }
    }
  }
}
```

Remove `MEMORY_MCP_DISABLE_EMBEDDINGS` or set it to `0` to enable local semantic embeddings. The first run may download the model.

## Tools

- `memory_save`: save or update one memory
- `memory_search`: retrieve relevant memories
- `memory_list`: list recent memories in a namespace
- `memory_delete`: archive a memory
- `memory_extract`: call an OpenAI-compatible small model to extract memories from messages, then save them
- `memory_status`: inspect storage and embedding status

## Smoke Test

```bash
npm run smoke
```

The smoke test disables embeddings so it can run quickly without downloading a model.
