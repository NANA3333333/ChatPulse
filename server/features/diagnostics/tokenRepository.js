// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function addTokenUsage(characterId, contextType, promptTokens, completionTokens) {
        try {
            const stmt = dependencies.db.prepare('INSERT INTO token_usage (character_id, context_type, prompt_tokens, completion_tokens, timestamp) VALUES (?, ?, ?, ?, ?)');
            stmt.run(characterId, contextType, promptTokens, completionTokens, Date.now());
        } catch (e) {
            console.error('[DB] Error logging token usage:', e.message);
        }
    }

    return { addTokenUsage };
}

module.exports = { createModule };
