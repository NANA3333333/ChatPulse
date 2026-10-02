// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function clearConversationDigest(characterId) {
        dependencies.db.prepare('DELETE FROM conversation_digest_cache WHERE character_id = ?').run(characterId);
    }

function clearGroupConversationDigest(groupId, characterId = null) {
        if (characterId) {
            dependencies.db.prepare('DELETE FROM group_conversation_digest_cache WHERE group_id = ? AND character_id = ?').run(groupId, characterId);
            return;
        }
        dependencies.db.prepare('DELETE FROM group_conversation_digest_cache WHERE group_id = ?').run(groupId);
    }

    return { clearConversationDigest, clearGroupConversationDigest };
}

module.exports = { createModule };
