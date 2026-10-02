// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function clearCharacterMessageCaches(characterId) {
        const id = String(characterId || '').trim();
        if (!id) return 0;
        let changes = 0;
        changes += dependencies.db.prepare('DELETE FROM history_window_cache WHERE character_id = ?').run(id).changes || 0;
        changes += dependencies.db.prepare('DELETE FROM conversation_digest_cache WHERE character_id = ?').run(id).changes || 0;
        changes += dependencies.db.prepare('DELETE FROM prompt_block_cache WHERE character_id = ?').run(id).changes || 0;
        changes += dependencies.db.prepare('DELETE FROM llm_cache WHERE character_id = ? OR cache_scope = ?').run(id, `character:${id}`).changes || 0;
        return changes;
    }

    return { clearCharacterMessageCaches };
}

module.exports = { createModule };
