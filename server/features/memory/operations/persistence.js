// Prepare asynchronous work before opening a short SQLite transaction.
function createModule(dependencies) {
    const imports = new Map();
    async function prepareMemory(characterId, memoryData, saveOptions) {
            const normalizedMemory = dependencies.normalizeMemoryPayload(memoryData, { characterId });
            if (!saveOptions.allowRoutineCity && dependencies.isRoutineCityMemory(normalizedMemory) && Number(normalizedMemory.importance || 0) <= 3) {
                console.log(`[Memory] Skipped routine city memory for ${characterId}: ${normalizedMemory.summary}`);
                return null;
            }
            const retrievalWeight = dependencies.computeMemoryRetrievalWeight(normalizedMemory);

            // 1. Generate embedding for the normalized memory text
            const textToEmbed = dependencies.buildMemoryEmbeddingText(normalizedMemory);
            let embeddingArray = null;
            try {
                embeddingArray = await dependencies.getEmbedding(textToEmbed);
                // Convert JS array to Buffer for SQLite storage (optional, vectra uses its own file)
                normalizedMemory.embedding = Buffer.from(new Float32Array(embeddingArray).buffer);
            } catch (e) {
                if (!saveOptions.allowUnindexed) {
                    throw e;
                }
                console.warn(`[Memory] Embedding unavailable; storing unindexed memory for ${characterId}:`, e.message);
            }

        return { normalizedMemory, embeddingArray, retrievalWeight };
    }

    function saveRecord(characterId, prepared, groupId) {
        const db = dependencies.getDb();
        const { normalizedMemory } = prepared;
            const existing = normalizedMemory.dedupe_key && db.getMemoryByDedupeKey
                ? db.getMemoryByDedupeKey(characterId, normalizedMemory.dedupe_key)
                : null;

            let memoryId = null;
            if (existing) {
                db.updateMemory(existing.id, {
                    ...normalizedMemory,
                    group_id: groupId ?? existing.group_id ?? null,
                    retrieval_count: existing.retrieval_count || 0,
                    last_retrieved_at: existing.last_retrieved_at || null
                });
                memoryId = existing.id;
            } else {
                memoryId = db.addMemory(characterId, normalizedMemory, groupId);
            }
            const storedMemory = (memoryId && typeof db.getMemory === 'function')
                ? (db.getMemory(memoryId) || normalizedMemory)
                : normalizedMemory;
            const storedIsNewLibrary = dependencies.hasNewLibrarySummary(storedMemory);

        return { ...prepared, memoryId, existing, storedMemory, storedIsNewLibrary };
    }

    async function indexRecord(characterId, record, groupId) {
        const { normalizedMemory, embeddingArray, retrievalWeight, memoryId, existing, storedMemory, storedIsNewLibrary } = record;
            if (embeddingArray && await dependencies.canUseQdrant()) {
                try {
                    await dependencies.qdrant.upsertMemoryPoint(dependencies.userId, {
                        id: String(memoryId),
                        vector: embeddingArray,
                        payload: {
                            memory_id: memoryId,
                            character_id: String(characterId),
                            group_id: storedMemory.group_id || groupId || '',
                            memory_type: storedMemory.memory_type || normalizedMemory.memory_type || 'event',
                            memory_tier: storedMemory.memory_tier || normalizedMemory.memory_tier || 'ambient',
                            memory_focus: storedMemory.memory_focus || normalizedMemory.memory_focus || 'general',
                            importance: storedMemory.importance || normalizedMemory.importance || 5,
                            created_at: storedMemory.created_at || existing?.created_at || Date.now(),
                            updated_at: storedMemory.updated_at || Date.now(),
                            time: storedMemory.time || normalizedMemory.time || '',
                            is_archived: Number(storedMemory.is_archived || normalizedMemory.is_archived || 0),
                            dedupe_key: storedMemory.dedupe_key || normalizedMemory.dedupe_key || '',
                            retrieval_weight: retrievalWeight,
                            summary: storedMemory.consolidation_summary || storedMemory.summary || normalizedMemory.summary || '',
                            content: storedMemory.consolidation_summary || storedMemory.content || normalizedMemory.content || '',
                            consolidation_summary: storedMemory.consolidation_summary || normalizedMemory.consolidation_summary || normalizedMemory.summary || '',
                            consolidation_key: storedMemory.consolidation_key || normalizedMemory.consolidation_key || '',
                            location: storedMemory.location || normalizedMemory.location || '',
                            source_started_at: Number(storedMemory.source_started_at || normalizedMemory.source_started_at || 0),
                            source_ended_at: Number(storedMemory.source_ended_at || normalizedMemory.source_ended_at || 0),
                            source_time_text: storedMemory.source_time_text || normalizedMemory.source_time_text || '',
                            source_message_count: Number(storedMemory.source_message_count || normalizedMemory.source_message_count || 0),
                            source_memory_ids: String(memoryId),
                            memory_library_source: storedIsNewLibrary ? 'new' : 'legacy_backup',
                            memory_index_version: dependencies.MEMORY_RETRIEVAL_SOURCE_VERSION,
                            memory_index_granularity: storedIsNewLibrary ? dependencies.MEMORY_INDEX_GRANULARITY : 'legacy_backup_row_v1'
                        }
                    });
                } catch (e) {
                    console.error(`[Memory] Qdrant save failed for ${characterId}:`, e.message);
                    dependencies.qdrantAvailability = false;
                }
            }

            // 3. Save to Vectra store as a fallback / local cache
            if (embeddingArray && dependencies.LOCAL_VECTOR_INDEX_ENABLED) {
                const index = await dependencies.getVectorIndex(dependencies.userId, characterId);
                if (existing && typeof index.deleteItem === 'function') {
                    try {
                        await index.deleteItem(String(memoryId));
                    } catch (e) { }
                }
                await index.insertItem({
                    id: String(memoryId),
                    vector: embeddingArray,
                    metadata: {
                        memory_id: memoryId,
                        surprise_score: normalizedMemory.surprise_score || 5,
                        memory_type: normalizedMemory.memory_type || 'event',
                        memory_tier: normalizedMemory.memory_tier || 'ambient',
                        memory_focus: normalizedMemory.memory_focus || 'general',
                        dedupe_key: normalizedMemory.dedupe_key || '',
                        retrieval_weight: retrievalWeight,
                        memory_library_source: storedIsNewLibrary ? 'new' : 'legacy_backup',
                        memory_index_version: dependencies.MEMORY_RETRIEVAL_SOURCE_VERSION,
                        memory_index_granularity: storedIsNewLibrary ? dependencies.MEMORY_INDEX_GRANULARITY : 'legacy_backup_row_v1'
                    }
                });
            }

            console.log(`[Memory] Stored${embeddingArray ? '' : ' unindexed'} memory for ${characterId}: ${normalizedMemory.summary} `);

            // Broadcast real-time update to connected clients
            if (dependencies.globalWsClientsResolver) {
                const wsClients = dependencies.globalWsClientsResolver(dependencies.userId);
                if (wsClients) {
                    const eventPayload = JSON.stringify({ type: 'memory_update', characterId: characterId });
                    wsClients.forEach(c => {
                        if (c.readyState === 1) c.send(eventPayload);
                    });
                }
            }
        return memoryId;
    }

    async function saveExtractedMemory(characterId, memoryData, groupId = null, options = {}) {
        const saveOptions = options && typeof options === 'object' ? options : {};
        try {
            const prepared = await prepareMemory(characterId, memoryData, saveOptions);
            if (!prepared) return null;
            const record = saveRecord(characterId, prepared, groupId);
            return await indexRecord(characterId, record, groupId);
        } catch (error) {
            console.error('[Memory] Save failed for ' + characterId + ':', error.message);
            if (saveOptions.throwOnError) throw error;
            return null;
        }
    }

    async function performImport(characterId, entries, { replace = false } = {}) {
        const db = dependencies.getDb();
        const prepared = [];
        for (const entry of entries) {
            const { group_id: groupId = null, ...memoryData } = entry;
            const data = await prepareMemory(characterId, memoryData, { allowRoutineCity: true, allowUnindexed: true });
            if (!data) throw new Error('Memory import preparation failed');
            prepared.push({ data, groupId });
        }
        if (!prepared.length) throw new Error('No memories to import');
        // No await inside this transaction: a failed insert restores the old rows
        // and their role bindings, even in replace mode.
        const records = db.getRawDb().transaction(() => {
            if (!db.getCharacter(characterId)) throw new Error('Character no longer exists');
            if (replace) db.clearMemories(characterId);
            return prepared.map(({ data, groupId }) => ({ record: saveRecord(characterId, data, groupId), groupId }));
        })();
        const warnings = [];
        if (replace) {
            try { await dependencies.wipeIndex(characterId); }
            catch (error) { warnings.push({ stage: 'index-reset', error: error.message }); }
        }
        for (const { record, groupId } of records) {
            try { await indexRecord(characterId, record, groupId); }
            catch (error) { warnings.push({ stage: 'index', memory_id: record.memoryId, error: error.message }); }
        }
        return { ids: [...new Set(records.map(({ record }) => record.memoryId))], warnings };
    }

    async function importMemories(characterId, entries, options) {
        const previous = imports.get(characterId) || Promise.resolve();
        const task = previous.catch(() => {}).then(() => performImport(characterId, entries, options));
        imports.set(characterId, task);
        try { return await task; }
        finally { if (imports.get(characterId) === task) imports.delete(characterId); }
    }
    return { saveExtractedMemory, importMemories };
}
module.exports = { createModule };
