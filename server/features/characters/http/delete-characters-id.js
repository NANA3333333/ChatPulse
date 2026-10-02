// DELETE /api/characters/:id
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.delete('/api/characters/:id', require("../../../platform/http/trace.js").traceHttp("characters", "DELETE /api/characters/:id"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const charId = req.params.id;
        const charToDelete = db.getCharacter(charId);
        if (!charToDelete) return res.status(404).json({ error: 'Character not found' });
        const charName = charToDelete?.name || '';

        // 1. Stop any running engine timers for this character
        engine.stopTimer(charId);

        // 2. Wipe vector memory index for this character
        try {
            await memory.wipeIndex(charId);
        } catch (e) {
            console.error(`[Delete] Failed to wipe vector index for char ${charId}:`, e.message);
        }

        // 3. Clean up other characters' memories that mention the deleted char
        const deletedMentionMemoryRows = [];
        if (charName) {
            const allChars = db.getCharacters();
            for (const otherChar of allChars) {
                if (String(otherChar.id) === String(charId)) continue;
                // Remove memories where the deleted char's name appears in the 'people' field
                const otherMemories = db.getMemories(otherChar.id);
                for (const mem of otherMemories) {
                    if (mem.people && mem.people.includes(charName)) {
                        deletedMentionMemoryRows.push(mem);
                    }
                }
            }
        }
        const deletedMentionIndexTargets = dependencies.buildMemoryIndexTargets(db, deletedMentionMemoryRows);
        const deletedMentionIdsByCharacter = new Map();
        const deletedMentionRowsByCharacter = new Map();
        for (const mem of deletedMentionMemoryRows) {
            const memoryId = Number(mem.id || 0);
            const targets = deletedMentionIndexTargets.get(memoryId) || new Map();
            for (const target of targets.values()) {
                const targetCharacterId = String(target.characterId || '').trim();
                if (!targetCharacterId) continue;
                if (!deletedMentionIdsByCharacter.has(targetCharacterId)) deletedMentionIdsByCharacter.set(targetCharacterId, []);
                if (!deletedMentionRowsByCharacter.has(targetCharacterId)) deletedMentionRowsByCharacter.set(targetCharacterId, []);
                deletedMentionIdsByCharacter.get(targetCharacterId).push(memoryId);
                deletedMentionRowsByCharacter.get(targetCharacterId).push(target.previousRow || mem);
            }
        }
        if (memory?.deleteMemoryIndexEntries) {
            for (const [targetCharacterId, memoryIds] of deletedMentionIdsByCharacter.entries()) {
                try {
                    const result = await memory.deleteMemoryIndexEntries(targetCharacterId, memoryIds);
                    if (Array.isArray(result?.errors) && result.errors.length > 0) {
                        console.warn(`[Delete] Memory index delete warning for ${targetCharacterId}: ${result.errors.join('; ')}`);
                    }
                } catch (e) {
                    console.warn(`[Delete] Failed to delete stale memory index entries for ${targetCharacterId}:`, e.message);
                }
            }
        }
        for (const mem of deletedMentionMemoryRows) {
            db.deleteMemory(mem.id);
        }
        if (memory?.refreshMemoryIndexEntries) {
            for (const [targetCharacterId, memoryIds] of deletedMentionIdsByCharacter.entries()) {
                try {
                    await memory.refreshMemoryIndexEntries(targetCharacterId, memoryIds, {
                        previousRows: deletedMentionRowsByCharacter.get(targetCharacterId) || []
                    });
                } catch (e) {
                    console.warn(`[Delete] Failed to refresh memory index entries for ${targetCharacterId}:`, e.message);
                }
            }
        }
        for (const targetCharacterId of deletedMentionIdsByCharacter.keys()) {
            wsClients.forEach(c => {
                if (c.readyState === 1) c.send(JSON.stringify({ type: 'memory_update', characterId: targetCharacterId }));
            });
        }

        // 4. Delete the character (handles messages, groups, relationships, etc.)
        db.deleteCharacter(charId);

        // 5. Notify frontend
        engine.broadcastEvent?.(wsClients, { type: 'character_deleted', characterId: charId });
        res.json({ success: true });
    } catch (e) {
        console.error('[Delete] Error deleting character:', e.message);
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
