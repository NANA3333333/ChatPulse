// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function exportCharacterData(characterId) {
        const character = dependencies.getCharacter(characterId);
        if (!character) return null;
        const messages = dependencies.db.prepare('SELECT * FROM messages WHERE character_id = ? ORDER BY timestamp ASC').all(characterId);
        const memories = dependencies.db.prepare('SELECT * FROM memories WHERE character_id = ? ORDER BY created_at ASC').all(characterId);
        const diaries = dependencies.db.prepare('SELECT * FROM diaries WHERE character_id = ? ORDER BY timestamp ASC').all(characterId);
        return { character, messages, memories, diaries };
    }

    return { exportCharacterData };
}

module.exports = { createModule };
