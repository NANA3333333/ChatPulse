// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function clearMemories(characterId) {
        const ids = dependencies.db.prepare('SELECT id FROM memories WHERE character_id = ?').all(characterId).map(row => row.id);
        if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(', ');
            dependencies.db.prepare(`DELETE FROM external_memory_role_bindings WHERE memory_id IN (${placeholders})`).run(...ids);
        }
        dependencies.db.prepare('DELETE FROM external_memory_role_bindings WHERE character_id = ?').run(characterId);
        dependencies.db.prepare('DELETE FROM memories WHERE character_id = ?').run(characterId);
    }

    return { clearMemories };
}

module.exports = { createModule };
