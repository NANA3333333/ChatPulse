// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function addFriend(char1Id, char2Id) {
        const sourceId = String(char1Id || '').trim();
        const targetId = String(char2Id || '').trim();
        if (!sourceId || !targetId || sourceId === targetId) return false;
        if (!dependencies.getCharacter(sourceId) || !dependencies.getCharacter(targetId)) return false;
        const stmt = dependencies.db.prepare('INSERT OR IGNORE INTO character_friends (char1_id, char2_id, created_at) VALUES (?, ?, ?)');
        const now = Date.now();
        const info1 = stmt.run(sourceId, targetId, now);
        const info2 = stmt.run(targetId, sourceId, now);
        return info1.changes > 0 || info2.changes > 0;
    }

function clearFriends(charId) {
        dependencies.db.prepare('DELETE FROM character_friends WHERE char1_id = ? OR char2_id = ?').run(charId, charId);
    }

function clearCharRelationships(charId) {
        dependencies.db.prepare('DELETE FROM char_relationships WHERE source_id = ? OR target_id = ?').run(charId, charId);
    }

    return { addFriend, clearFriends, clearCharRelationships };
}

module.exports = { createModule };
