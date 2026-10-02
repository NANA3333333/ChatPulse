// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function wipeIndex(characterId) {
        const key = `${dependencies.userId}_${characterId}`;
        dependencies.indices.delete(key);
        dependencies.indexRepairAttempts.delete(key);
        if (await dependencies.canUseQdrant()) {
            try {
                await dependencies.qdrant.deleteCharacterPoints(dependencies.userId, characterId);
            } catch (e) {
                console.error(`[Memory] Failed to wipe Qdrant points for ${characterId}:`, e.message);
            }
        }
        const dirsToWipe = [
            dependencies.getVectorIndexDir(dependencies.userId, characterId),
            dependencies.getLegacyVectorIndexDir(dependencies.userId, characterId),
            dependencies.getLegacyDefaultVectorIndexDir(characterId)
        ];
        for (const dir of dirsToWipe) {
            if (!dependencies.fs.existsSync(dir)) continue;
            try {
                dependencies.fs.rmSync(dir, { recursive: true, force: true });
            } catch (e) {
                console.error(`[Memory] Failed to physically wipe vector dir for ${characterId}:`, e.message);
            }
        }
    }

async function rebuildIndex(characterId) {
        await wipeIndex(characterId);
        const db = dependencies.getDb();
        const allRows = db.getMemories ? db.getMemories(characterId) : [];
        const rows = dependencies.selectSearchableMemoryRows(allRows);
        const cards = dependencies.buildNewLibraryIndexCards(rows);
        if (!cards || cards.length === 0) {
            dependencies.writeVectorIndexSourceVersion(dependencies.userId, characterId, {
                indexed_count: 0,
                source_count: Array.isArray(allRows) ? allRows.length : 0,
                new_library_count: rows.length,
                new_library_card_count: 0,
                memory_index_granularity: dependencies.MEMORY_INDEX_GRANULARITY
            });
            return;
        }

        const index = dependencies.LOCAL_VECTOR_INDEX_ENABLED ? await dependencies.getVectorIndex(dependencies.userId, characterId) : null;
        for (const card of cards) {
            await dependencies.upsertNewLibraryIndexCard(characterId, card, index);
        }
        dependencies.writeVectorIndexSourceVersion(dependencies.userId, characterId, {
            indexed_count: cards.length,
            source_count: Array.isArray(allRows) ? allRows.length : rows.length,
            new_library_count: rows.length,
            new_library_card_count: cards.length,
            memory_index_granularity: dependencies.MEMORY_INDEX_GRANULARITY
        });
    }

async function deleteMemoryIndexEntries(characterId, memoryIds = []) {
        const ids = Array.from(new Set((Array.isArray(memoryIds) ? memoryIds : [memoryIds])
            .map(id => String(id || '').trim())
            .filter(Boolean)));
        if (ids.length === 0) return { deleted: 0, qdrant_deleted: 0, local_deleted: 0, errors: [] };
        const pointIds = Array.from(new Set(ids.flatMap(id => [id, `${id}:bound:${characterId}`])));

        const errors = [];
        let qdrantDeleted = 0;
        let localDeleted = 0;

        const qdrantEnabled = dependencies.qdrant.getQdrantConfig?.().enabled !== false;
        const qdrantUsable = await dependencies.canUseQdrant();
        if (qdrantUsable) {
            try {
                if (typeof dependencies.qdrant.deleteMemoryPoints === 'function') {
                    const result = await dependencies.qdrant.deleteMemoryPoints(dependencies.userId, pointIds);
                    qdrantDeleted = Number(result?.deleted || pointIds.length);
                } else {
                    for (const id of pointIds) {
                        await dependencies.qdrant.deleteMemoryPoint(dependencies.userId, id);
                        qdrantDeleted += 1;
                    }
                }
            } catch (e) {
                errors.push(`qdrant:${e.message}`);
                dependencies.qdrantAvailability = false;
            }
        } else if (qdrantEnabled) {
            errors.push('qdrant:unavailable');
        }

        if (dependencies.LOCAL_VECTOR_INDEX_ENABLED) {
            try {
                const index = await dependencies.getVectorIndex(dependencies.userId, characterId);
                if (typeof index.deleteItem === 'function') {
                    for (const id of pointIds) {
                        try {
                            await index.deleteItem(String(id));
                            localDeleted += 1;
                        } catch (e) {
                            errors.push(`local:${id}:${e.message}`);
                        }
                    }
                }
            } catch (e) {
                errors.push(`local:${e.message}`);
            }
        }

        return {
            deleted: ids.length,
            qdrant_deleted: qdrantDeleted,
            local_deleted: localDeleted,
            errors
        };
    }

async function refreshMemoryIndexEntries(characterId, memoryIds = [], options = {}) {
        const ids = Array.from(new Set((Array.isArray(memoryIds) ? memoryIds : [memoryIds])
            .map(id => String(id || '').trim())
            .filter(Boolean)));
        const previousRows = Array.isArray(options?.previousRows) ? options.previousRows.filter(Boolean) : [];
        if (ids.length === 0 && previousRows.length === 0) {
            return { refreshed: 0, deleted: 0, card_count: 0 };
        }

        const db = dependencies.getDb();
        const allRows = db.getMemories ? db.getMemories(characterId) : [];
        const searchableRows = dependencies.selectSearchableMemoryRows(allRows);
        const allCards = dependencies.buildNewLibraryIndexCards(searchableRows);
        const idSet = new Set(ids);
        const targetGroupKeys = new Set();
        for (const row of previousRows) {
            if (row && dependencies.hasNewLibrarySummary(row)) {
                targetGroupKeys.add(dependencies.getNewLibraryIndexGroupKey(row));
            }
        }
        for (const row of searchableRows) {
            if (idSet.has(String(row.id || ''))) {
                targetGroupKeys.add(dependencies.getNewLibraryIndexGroupKey(row));
            }
        }

        const targetCards = allCards.filter(card => {
            if (targetGroupKeys.has(card.index_group_key)) return true;
            return (card.source_ids || []).some(sourceId => idSet.has(String(sourceId || '')));
        });
        const deleteIds = new Set(ids);
        for (const card of targetCards) {
            for (const sourceId of card.source_ids || []) {
                if (sourceId !== undefined && sourceId !== null) deleteIds.add(String(sourceId));
            }
        }

        if (deleteIds.size > 0) {
            try {
                await deleteMemoryIndexEntries(characterId, Array.from(deleteIds));
            } catch (e) {
                console.warn(`[Memory] Partial index delete before refresh failed for ${characterId}:`, e.message);
            }
        }

        const index = dependencies.LOCAL_VECTOR_INDEX_ENABLED ? await dependencies.getVectorIndex(dependencies.userId, characterId) : null;
        let refreshed = 0;
        for (const card of targetCards) {
            await dependencies.upsertNewLibraryIndexCard(characterId, card, index);
            refreshed += 1;
        }
        dependencies.writeVectorIndexSourceVersion(dependencies.userId, characterId, {
            indexed_count: allCards.length,
            source_count: Array.isArray(allRows) ? allRows.length : searchableRows.length,
            new_library_count: searchableRows.length,
            new_library_card_count: allCards.length,
            memory_index_granularity: dependencies.MEMORY_INDEX_GRANULARITY
        });
        return {
            refreshed,
            deleted: deleteIds.size,
            card_count: allCards.length,
            target_group_count: targetGroupKeys.size
        };
    }

function buildMemoryDeletionTargets(db, rows = []) {
        const targetsByMemoryId = new Map();
        const ids = Array.from(new Set((rows || [])
            .map(row => Number(row?.id || 0))
            .filter(id => id > 0)));

        for (const row of rows || []) {
            const memoryId = Number(row?.id || 0);
            if (!memoryId) continue;
            const characterId = String(row?.character_id || '').trim();
            if (!characterId) continue;
            targetsByMemoryId.set(memoryId, new Map([
                [characterId, { characterId, previousRow: { ...row } }]
            ]));
        }

        const rawDb = typeof db?.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb || ids.length === 0) return targetsByMemoryId;

        try {
            const placeholders = ids.map(() => '?').join(',');
            const bindings = rawDb.prepare(`
                SELECT memory_id, character_id, character_name
                FROM external_memory_role_bindings
                WHERE memory_id IN (${placeholders})
            `).all(...ids);
            const rowsById = new Map((rows || []).map(row => [Number(row?.id || 0), row]));
            for (const binding of bindings || []) {
                const memoryId = Number(binding.memory_id || 0);
                const characterId = String(binding.character_id || '').trim();
                if (!memoryId || !characterId) continue;
                const sourceRow = rowsById.get(memoryId) || {};
                const targets = targetsByMemoryId.get(memoryId) || new Map();
                targets.set(characterId, {
                    characterId,
                    previousRow: {
                        ...sourceRow,
                        shared_binding: 1,
                        bound_character_id: characterId,
                        bound_character_name: String(binding.character_name || '')
                    }
                });
                targetsByMemoryId.set(memoryId, targets);
            }
        } catch (e) {
            console.warn('[Memory] Failed to read external memory role bindings for auto-forget:', e.message);
        }

        return targetsByMemoryId;
    }

async function purgeExpiredForgettingMemories(options = {}) {
        const now = Date.now();
        const force = options.force === true;
        const minIntervalMs = Math.max(60 * 1000, Number(options.minIntervalMs || dependencies.EXPIRED_FORGETTING_PURGE_INTERVAL_MS) || dependencies.EXPIRED_FORGETTING_PURGE_INTERVAL_MS);
        if (!force && now - dependencies.lastExpiredForgettingPurgeAt < minIntervalMs) {
            return {
                success: true,
                skipped: true,
                reason: 'cooldown',
                deleted: 0,
                next_allowed_at: dependencies.lastExpiredForgettingPurgeAt + minIntervalMs
            };
        }
        if (dependencies.expiredForgettingPurgePromise) {
            return dependencies.expiredForgettingPurgePromise;
        }

        dependencies.expiredForgettingPurgePromise = (async () => {
            dependencies.lastExpiredForgettingPurgeAt = now;
            const db = dependencies.getDb();
            const rawDb = typeof db?.getRawDb === 'function' ? db.getRawDb() : null;
            const rows = dependencies.getExpiredForgettingMemoryRows(rawDb, {
                now,
                limit: options.limit || 200
            });
            if (rows.length === 0) {
                return { success: true, deleted: 0, ids: [], character_ids: [], index_deleted: true };
            }

            const targetsByMemoryId = buildMemoryDeletionTargets(db, rows);
            const idsByCharacter = new Map();
            const previousRowsByCharacter = new Map();
            for (const [memoryId, targets] of targetsByMemoryId.entries()) {
                for (const target of targets.values()) {
                    const characterId = String(target.characterId || '').trim();
                    if (!characterId) continue;
                    if (!idsByCharacter.has(characterId)) idsByCharacter.set(characterId, []);
                    if (!previousRowsByCharacter.has(characterId)) previousRowsByCharacter.set(characterId, []);
                    idsByCharacter.get(characterId).push(memoryId);
                    previousRowsByCharacter.get(characterId).push(target.previousRow || rows.find(row => Number(row.id || 0) === memoryId));
                }
            }

            const indexResults = [];
            for (const [characterId, memoryIds] of idsByCharacter.entries()) {
                const result = await deleteMemoryIndexEntries(characterId, memoryIds);
                indexResults.push({ character_id: characterId, ...result });
                if (Array.isArray(result?.errors) && result.errors.length > 0) {
                    console.warn(`[Memory] Auto-forget index delete warning for ${characterId}: ${result.errors.join('; ')}`);
                }
            }

            let deleted = 0;
            for (const row of rows) {
                db.deleteMemory(row.id);
                deleted += 1;
            }

            for (const [characterId, memoryIds] of idsByCharacter.entries()) {
                const refreshResult = await refreshMemoryIndexEntries(characterId, memoryIds, {
                    previousRows: previousRowsByCharacter.get(characterId) || []
                });
                indexResults.push({ character_id: characterId, refresh: refreshResult });
            }

            if (dependencies.globalWsClientsResolver && idsByCharacter.size > 0) {
                const wsClients = dependencies.globalWsClientsResolver(dependencies.userId);
                if (wsClients) {
                    for (const characterId of idsByCharacter.keys()) {
                        const payload = JSON.stringify({ type: 'memory_update', characterId });
                        wsClients.forEach(c => {
                            if (c.readyState === 1) c.send(payload);
                        });
                    }
                }
            }

            return {
                success: true,
                deleted,
                ids: rows.map(row => row.id),
                character_ids: Array.from(idsByCharacter.keys()),
                index_deleted: indexResults.every(result => !Array.isArray(result.errors) || result.errors.length === 0),
                index_results: indexResults
            };
        })();

        try {
            return await dependencies.expiredForgettingPurgePromise;
        } finally {
            dependencies.expiredForgettingPurgePromise = null;
        }
    }

async function ensureSearchIndexReady(characterId, onTrace = null) {
        const key = `${dependencies.userId}_${characterId}`;
        const lastAttemptAt = Number(dependencies.indexRepairAttempts.get(key) || 0);
        const now = Date.now();
        if (typeof onTrace === 'function') {
            await onTrace({
                phase: 'ensure_begin',
                throttleMsRemaining: lastAttemptAt ? Math.max(0, (5 * 60 * 1000) - (now - lastAttemptAt)) : 0
            });
        }
        if (lastAttemptAt && (now - lastAttemptAt) < 5 * 60 * 1000) return;

        const db = dependencies.getDb();
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb || typeof rawDb.prepare !== 'function') return;
        const countRow = rawDb.prepare(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' AND COALESCE(is_archived, 0) = 0 THEN 1 ELSE 0 END) AS new_count,
                MAX(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' THEN COALESCE(updated_at, classified_at, created_at, 0) ELSE 0 END) AS latest_new_at
            FROM memories
            WHERE character_id = ?
        `).get(characterId) || {};
        const totalMemoryCount = Number(countRow.total || 0);
        const newLibraryCount = Number(countRow.new_count || 0);
        const latestNewLibraryAt = Number(countRow.latest_new_at || 0);
        const memoryCount = newLibraryCount;
        if (typeof onTrace === 'function') {
            await onTrace({ phase: 'ensure_memory_count', memoryCount, totalMemoryCount, newLibraryCount });
        }
        if (memoryCount <= 0) return;

        const sourceMarker = dependencies.readVectorIndexSourceVersion(dependencies.userId, characterId);
        const markerIsCurrent = sourceMarker?.version === dependencies.MEMORY_RETRIEVAL_SOURCE_VERSION
            && Number(sourceMarker?.built_at || 0) >= latestNewLibraryAt;
        if (newLibraryCount > 0 && !markerIsCurrent) {
            dependencies.indexRepairAttempts.set(key, now);
            console.warn(`[Memory] Search index marker is stale for ${characterId}; skipping automatic rebuild. Run an explicit rebuild instead.`);
            if (typeof onTrace === 'function') {
                await onTrace({
                    phase: 'ensure_stale_no_auto_rebuild',
                    newLibraryCount,
                    latestNewLibraryAt,
                    markerVersion: sourceMarker?.version || ''
                });
            }
            return;
        }

        let localItemCount = 0;
        if (dependencies.LOCAL_VECTOR_INDEX_ENABLED) {
            const currentDir = dependencies.getVectorIndexDir(dependencies.userId, characterId);
            const legacyDir = dependencies.getLegacyVectorIndexDir(dependencies.userId, characterId);
            const legacyDefaultDir = dependencies.getLegacyDefaultVectorIndexDir(characterId);
            localItemCount = Math.max(
                dependencies.getVectorIndexItemCountSync(currentDir),
                dependencies.getVectorIndexItemCountSync(legacyDir),
                dependencies.getVectorIndexItemCountSync(legacyDefaultDir)
            );
        }

        let qdrantCount = 0;
        if (await dependencies.canUseQdrant()) {
            try {
                if (typeof onTrace === 'function') {
                    await onTrace({ phase: 'ensure_qdrant_count_begin' });
                }
                const collectionName = dependencies.qdrant.getCollectionName(dependencies.userId);
                const response = await fetch(`${dependencies.qdrant.getQdrantConfig().url}/collections/${collectionName}/points/count`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filter: dependencies.buildMemorySearchFilter(characterId),
                        exact: true
                    })
                });
                const payload = await response.json();
                qdrantCount = Number(payload?.result?.count || 0);
                if (typeof onTrace === 'function') {
                    await onTrace({ phase: 'ensure_qdrant_count_finish', qdrantCount, localItemCount });
                }
            } catch (e) {
                if (typeof onTrace === 'function') {
                    await onTrace({ phase: 'ensure_qdrant_count_error', message: String(e?.message || e), localItemCount });
                }
                console.warn(`[Memory] Failed to inspect Qdrant count for ${characterId}:`, e.message);
            }
        }

        if (localItemCount > 0 || qdrantCount > 0) {
            if (typeof onTrace === 'function') {
                await onTrace({ phase: 'ensure_ready', qdrantCount, localItemCount });
            }
            return;
        }

        dependencies.indexRepairAttempts.set(key, now);
        console.warn(`[Memory] Detected empty visible search index for ${characterId} despite ${memoryCount} SQL memories; skipping automatic rebuild.`);
        if (typeof onTrace === 'function') {
            await onTrace({ phase: 'ensure_missing_no_auto_rebuild', qdrantCount, localItemCount, memoryCount });
        }
    }

    return { wipeIndex, rebuildIndex, deleteMemoryIndexEntries, refreshMemoryIndexEntries, buildMemoryDeletionTargets, purgeExpiredForgettingMemories, ensureSearchIndexReady };
}

module.exports = { createModule };
