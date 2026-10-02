// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function deleteCharacter(id) {
        dependencies.deleteCharacterAttachedRows(id);
        dependencies.db.prepare('DELETE FROM messages WHERE character_id = ?').run(id);
        const memoryIds = dependencies.db.prepare('SELECT id FROM memories WHERE character_id = ?').all(id).map(row => row.id);
        if (memoryIds.length > 0) {
            const placeholders = memoryIds.map(() => '?').join(', ');
            dependencies.db.prepare(`DELETE FROM external_memory_role_bindings WHERE memory_id IN (${placeholders})`).run(...memoryIds);
        }
        dependencies.db.prepare('DELETE FROM external_memory_role_bindings WHERE character_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM memories WHERE character_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM history_window_cache WHERE character_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM prompt_block_cache WHERE character_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM conversation_digest_cache WHERE character_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM group_conversation_digest_cache WHERE character_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM diaries WHERE character_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM character_friends WHERE char1_id = ? OR char2_id = ?').run(id, id);
        dependencies.db.prepare('DELETE FROM char_relationships WHERE source_id = ? OR target_id = ?').run(id, id);
        dependencies.db.prepare('DELETE FROM group_members WHERE member_id = ?').run(id); // Auto-kick from groups
        dependencies.db.prepare('DELETE FROM characters WHERE id = ?').run(id);
    }

    return { deleteCharacter };
}

module.exports = { createModule };
