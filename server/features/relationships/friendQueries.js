// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getFriends(charId) {
        // Return list of character objects that are friends with charId
        return dependencies.db.prepare(`
        SELECT c.* FROM characters c
        JOIN character_friends f ON c.id = f.char2_id
        WHERE f.char1_id = ?
    `).all(charId);
    }

function isFriend(charId, targetId) {
        if (charId === targetId) return true;
        const relation = dependencies.db.prepare('SELECT 1 FROM character_friends WHERE char1_id = ? AND char2_id = ?').get(charId, targetId);
        return !!relation;
    }

    return { getFriends, isFriend };
}

module.exports = { createModule };
