// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function clearDiaries(characterId) {
        dependencies.db.prepare('DELETE FROM diaries WHERE character_id = ?').run(characterId);
    }

    return { clearDiaries };
}

module.exports = { createModule };
