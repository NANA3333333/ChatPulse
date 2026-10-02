// Own the database transaction and the character schedule for one archive import.
async function importCharacterArchive({ db, rawDb, memory, engine, wsClients, characterId, payload,
    includeCharacter, replace, clearCharacterArchiveData, runArchiveCleanup, importCharacterArchiveRows }) {
    if (engine.isBusy?.()) {
        throw Object.assign(new Error('Chat processing is busy. Retry the import when it is idle.'), { status: 409 });
    }
    const resume = engine.suspendCharacterSchedule(characterId, wsClients);
    let committed = false;
    try {
        const imported = rawDb.transaction(() => {
            if (includeCharacter && payload.character) db.updateCharacter(characterId, { ...payload.character, id: characterId });
            if (replace) {
                clearCharacterArchiveData(rawDb, characterId);
            } else {
                runArchiveCleanup(rawDb, 'DELETE FROM history_window_cache WHERE character_id = ?', characterId);
                runArchiveCleanup(rawDb, 'DELETE FROM prompt_block_cache WHERE character_id = ?', characterId);
                runArchiveCleanup(rawDb, 'DELETE FROM conversation_digest_cache WHERE character_id = ?', characterId);
                runArchiveCleanup(rawDb, 'DELETE FROM llm_cache WHERE character_id = ? OR cache_scope = ?', characterId, `character:${characterId}`);
            }
            return importCharacterArchiveRows(rawDb, characterId, payload);
        })();
        committed = true;
        let rebuiltMemoryIndex = false;
        let rebuildWarning = '';
        try {
            await memory.rebuildIndex(characterId);
            rebuiltMemoryIndex = true;
        } catch (error) {
            rebuildWarning = error.message || 'Memory index rebuild failed.';
            console.error(`[Character Import] Failed to rebuild memory index for ${characterId}:`, rebuildWarning);
        }
        return { imported, rebuiltMemoryIndex, rebuildWarning };
    } finally {
        resume({ committed });
    }
}

module.exports = { importCharacterArchive };
