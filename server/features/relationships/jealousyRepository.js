// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getJealousyState(characterId) {
        const row = dependencies.db.prepare('SELECT jealousy_level, jealousy_target FROM characters WHERE id = ?').get(characterId);
        if (!row) return null;
        return {
            level: row.jealousy_level || 0,
            target_id: row.jealousy_target || '',
            active: (row.jealousy_level || 0) > 0
        };
    }

    return { getJealousyState };
}

module.exports = { createModule };
