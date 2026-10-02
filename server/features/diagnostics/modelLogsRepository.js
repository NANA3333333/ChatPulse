// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function addLlmDebugLog(entry) {
        const stmt = dependencies.db.prepare(`
            INSERT INTO llm_debug_logs (
                character_id, direction, context_type, payload, meta, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            entry.character_id,
            entry.direction || 'unknown',
            entry.context_type || 'chat',
            entry.payload || '',
            typeof entry.meta === 'string' ? entry.meta : JSON.stringify(entry.meta || {}),
            entry.timestamp || Date.now()
        );
        dependencies.enforceLlmDebugLogRetention();
    }

function getLlmDebugLogs(characterId, limit = 50) {
        const safeLimit = dependencies.normalizeSqlLimit(limit, 50, 200);
        return dependencies.db.prepare('SELECT * FROM llm_debug_logs WHERE character_id = ? ORDER BY id DESC LIMIT ?')
            .all(characterId, safeLimit);
    }

    return { addLlmDebugLog, getLlmDebugLogs };
}

module.exports = { createModule };
