// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function isCharAcquainted(charId, targetId) {
        const row = dependencies.db.prepare("SELECT 1 FROM char_relationships WHERE source_id = ? AND target_id = ? AND source = 'recommend'").get(charId, targetId);
        return !!row;
    }

    return { isCharAcquainted };
}

module.exports = { createModule };
