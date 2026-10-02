// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function searchMemories(characterId, queryText, limit = 5, onTrace = null) {
        try {
            const db = dependencies.getDb();
            let vectorIndexReady = true;
            try {
                await dependencies.ensureSearchIndexReady(characterId, onTrace);
            } catch (e) {
                vectorIndexReady = false;
                console.warn(`[Memory] Failed to ensure new-library search index for ${characterId}; continuing with lexical fallback where possible:`, e.message);
                if (typeof onTrace === 'function') {
                    await onTrace({ phase: 'ensure_error', message: String(e?.message || e) });
                }
            }
            const normalizedRequest = dependencies.normalizeMemorySearchRequest(queryText, limit);
            const searchableRows = dependencies.selectSearchableMemoryRows(db.getMemories ? db.getMemories(characterId) : []);
            if (searchableRows.length === 0) {
                if (typeof onTrace === 'function') {
                    await onTrace({
                        phase: 'new_library_empty',
                        message: 'No consolidated new-library memories are available for this character.'
                    });
                }
                return [];
            }
            const baseQuery = normalizedRequest.primaryText || normalizedRequest.explicitQueries[0] || '';
            const temporalRange = dependencies.resolveTemporalHintRange(normalizedRequest.temporalHint, Date.now());
            const temporalIntent = normalizedRequest.temporalIntent || { mode: 'none', confidence: 0, reason: '' };
            const searchNow = Date.now();
            let queryVariants = normalizedRequest.explicitQueries.length > 0
                ? Array.from(new Set([
                    ...normalizedRequest.explicitQueries,
                    ...dependencies.buildExpandedMemorySearchQueries(baseQuery)
                ])).slice(0, 6)
                : dependencies.buildExpandedMemorySearchQueries(baseQuery);
            const llmExpandedVariants = await dependencies.expandMemoryQueriesWithLLM(db, characterId, baseQuery, queryVariants);
            if (llmExpandedVariants.length > 0) {
                const merged = new Set(queryVariants);
                llmExpandedVariants.forEach(v => merged.add(v));
                queryVariants = Array.from(merged).slice(0, 6);
            }
            if (queryVariants.length === 0) return [];
            const searchFilter = dependencies.buildMemorySearchFilter(characterId, normalizedRequest.filters, temporalRange);
            const resultLimit = normalizedRequest.limit;
            if (typeof onTrace === 'function') {
                await onTrace({
                    phase: 'search_start',
                    baseQuery,
                    queryVariants,
                    filters: normalizedRequest.filters,
                    temporalHint: normalizedRequest.temporalHint,
                    temporalIntent,
                    temporalRange,
                    resultLimit
                });
            }

            if (vectorIndexReady && await dependencies.canUseQdrant()) {
                try {
                    if (typeof onTrace === 'function') {
                        await onTrace({ phase: 'qdrant_begin', variantCount: queryVariants.length });
                    }
                    const aggregate = new Map();
                    for (let i = 0; i < queryVariants.length; i++) {
                        const variant = queryVariants[i];
                        const variantStartedAt = Date.now();
                        if (typeof onTrace === 'function') {
                            await onTrace({ phase: 'qdrant_variant_start', variant, index: i });
                        }
                        const queryEmbedding = await dependencies.getEmbedding(variant);
                        const qdrantResults = await dependencies.qdrant.searchMemoryPoints(
                            dependencies.userId,
                            queryEmbedding,
                            searchFilter,
                            Math.max(resultLimit * 3, 8)
                        );
                        if (typeof onTrace === 'function') {
                            await onTrace({
                                phase: 'qdrant_variant_finish',
                                variant,
                                index: i,
                                durationMs: Date.now() - variantStartedAt,
                                resultCount: Array.isArray(qdrantResults) ? qdrantResults.length : 0
                            });
                        }

                        for (const res of qdrantResults) {
                            const memoryId = res?.payload?.memory_id || res?.id;
                            if (!memoryId || res.score <= 0.3) continue;
                            const memRow = db.getMemory(memoryId);
                            if (!dependencies.hasNewLibrarySummary(memRow)) continue;
                            if (!dependencies.memoryMatchesSearchFilters(memRow, normalizedRequest.filters, temporalRange)) continue;
                            const surpriseScore = res?.payload?.importance || memRow.importance || 5;
                            const retrievalWeight = Math.max(
                                Number(res?.payload?.retrieval_weight || 1),
                                Number(dependencies.computeMemoryRetrievalWeight(memRow) || 1)
                            );
                            const lexicalBoost = dependencies.computeLexicalBoost(memRow, queryVariants);
                            const aliasBridgeBoost = dependencies.computeAliasBridgeBoost(memRow, queryVariants);
                            const queryWeight = i === 0 ? 1 : (i === 1 ? 0.96 : 0.9);
                            const contradictionPenalty = dependencies.computeRecallContradictionPenalty(memRow, baseQuery);
                            const tierBoost = dependencies.computeMemoryTierBoost(memRow);
                            const profilePriorityBoost = dependencies.computeUserProfilePriorityBoost(memRow, baseQuery, queryVariants);
                            const temporalAdjustment = dependencies.computeTemporalScoreAdjustment(memRow, temporalRange)
                                + dependencies.computeTemporalAnchorPenalty(memRow, temporalRange);
                            const recencyAdjustment = dependencies.computeRecencyScoreAdjustment(memRow, temporalIntent, searchNow);
                            const retentionAdjustment = dependencies.computeRetentionSearchAdjustment(memRow);
                            const finalScore = (res.score * retrievalWeight * (1 + surpriseScore * 0.05) * queryWeight) + lexicalBoost + aliasBridgeBoost + tierBoost + profilePriorityBoost + temporalAdjustment + recencyAdjustment + retentionAdjustment - contradictionPenalty;
                            const existing = aggregate.get(memoryId);
                            if (!existing || finalScore > existing.finalScore) {
                                aggregate.set(memoryId, { memRow, finalScore, rawScore: res.score, matchedQuery: variant });
                            }
                        }
                    }

                    const lexicalSupplement = dependencies.runLexicalMemoryFallback(
                        db,
                        characterId,
                        queryVariants,
                        Math.max(resultLimit * 2, 8),
                        { temporalIntent, nowTs: searchNow }
                    ).filter(memRow => dependencies.memoryMatchesSearchFilters(memRow, normalizedRequest.filters, temporalRange));
                    for (const memRow of lexicalSupplement) {
                        if (!memRow?.id) continue;
                        const lexicalScore = (Number(memRow._search_score || 0) || 0) + 0.45;
                        const existing = aggregate.get(memRow.id);
                        if (!existing || lexicalScore > existing.finalScore) {
                            aggregate.set(memRow.id, {
                                memRow,
                                finalScore: lexicalScore,
                                rawScore: lexicalScore,
                                matchedQuery: memRow._matched_query || 'lexical_exact'
                            });
                        }
                    }

                    const rankedRows = Array.from(aggregate.values())
                        .sort((a, b) => b.finalScore - a.finalScore)
                        .slice(0, Math.max(resultLimit * 3, resultLimit))
                        .map(entry => {
                            entry.memRow._search_score = entry.finalScore.toFixed(3);
                            entry.memRow._matched_query = entry.matchedQuery;
                            return entry.memRow;
                        });
                    const memories = dependencies.finalizeMemorySearchRows(rankedRows, resultLimit);
                    if (memories.length > 0 && db.markMemoriesRetrieved) {
                        db.markMemoriesRetrieved(memories.map(m => m.id));
                    }
                    if (memories.length > 0) {
                        if (typeof onTrace === 'function') {
                            await onTrace({
                                phase: 'qdrant_return',
                                count: memories.length,
                                results: memories.map(mem => ({
                                    id: mem.id,
                                    score: mem._search_score || '',
                                    matched_query: mem._matched_query || '',
                                    memory_focus: mem.memory_focus || '',
                                    memory_tier: mem.memory_tier || '',
                                    retention_action: mem.retention_action || '',
                                    source_started_at: mem.source_started_at || 0,
                                    source_ended_at: mem.source_ended_at || 0
                                }))
                            });
                        }
                        return memories;
                    }
                    if (typeof onTrace === 'function') {
                        await onTrace({ phase: 'qdrant_empty' });
                    }
                } catch (e) {
                    if (typeof onTrace === 'function') {
                        await onTrace({ phase: 'qdrant_error', message: String(e?.message || e) });
                    }
                    console.error(`[Memory] Qdrant search failed for ${characterId}:`, e.message);
                    if (!dependencies.isRecoverableQdrantError(e)) {
                        dependencies.qdrantAvailability = false;
                    }
                }
            }

            if (vectorIndexReady && dependencies.LOCAL_VECTOR_INDEX_ENABLED) {
                if (typeof onTrace === 'function') {
                    await onTrace({ phase: 'vectra_begin', variantCount: queryVariants.length });
                }
                const index = await dependencies.getVectorIndex(dependencies.userId, characterId);
                const aggregate = new Map();
                for (let i = 0; i < queryVariants.length; i++) {
                    const variant = queryVariants[i];
                    const variantStartedAt = Date.now();
                    if (typeof onTrace === 'function') {
                        await onTrace({ phase: 'vectra_variant_start', variant, index: i });
                    }
                    const queryEmbedding = await dependencies.getEmbedding(variant);
                    const results = await index.queryItems(queryEmbedding, Math.max(resultLimit * 3, 8));
                    if (typeof onTrace === 'function') {
                        await onTrace({
                            phase: 'vectra_variant_finish',
                            variant,
                            index: i,
                            durationMs: Date.now() - variantStartedAt,
                            resultCount: Array.isArray(results) ? results.length : 0
                        });
                    }

                    for (const res of results) {
                        if (!(res.score > 0.3 && res.item.metadata && res.item.metadata.memory_id)) continue;
                        const memRow = db.getMemory(res.item.metadata.memory_id);
                        if (!dependencies.hasNewLibrarySummary(memRow)) continue;
                        if (!dependencies.memoryMatchesSearchFilters(memRow, normalizedRequest.filters, temporalRange)) continue;
                        const surpriseScore = (res.item.metadata && res.item.metadata.surprise_score) ? res.item.metadata.surprise_score : 5;
                        const retrievalWeight = Math.max(
                            (res.item.metadata && Number(res.item.metadata.retrieval_weight)) || 1,
                            Number(dependencies.computeMemoryRetrievalWeight(memRow) || 1)
                        );
                        const lexicalBoost = dependencies.computeLexicalBoost(memRow, queryVariants);
                        const aliasBridgeBoost = dependencies.computeAliasBridgeBoost(memRow, queryVariants);
                        const queryWeight = i === 0 ? 1 : (i === 1 ? 0.96 : 0.9);
                        const contradictionPenalty = dependencies.computeRecallContradictionPenalty(memRow, baseQuery);
                        const tierBoost = dependencies.computeMemoryTierBoost(memRow);
                        const profilePriorityBoost = dependencies.computeUserProfilePriorityBoost(memRow, baseQuery, queryVariants);
                        const temporalAdjustment = dependencies.computeTemporalScoreAdjustment(memRow, temporalRange)
                            + dependencies.computeTemporalAnchorPenalty(memRow, temporalRange);
                        const recencyAdjustment = dependencies.computeRecencyScoreAdjustment(memRow, temporalIntent, searchNow);
                        const retentionAdjustment = dependencies.computeRetentionSearchAdjustment(memRow);
                        const finalScore = (res.score * retrievalWeight * (1 + surpriseScore * 0.05) * queryWeight) + lexicalBoost + aliasBridgeBoost + tierBoost + profilePriorityBoost + temporalAdjustment + recencyAdjustment + retentionAdjustment - contradictionPenalty;
                        const existing = aggregate.get(memRow.id);
                        if (!existing || finalScore > existing.finalScore) {
                            aggregate.set(memRow.id, { memRow, finalScore, matchedQuery: variant });
                        }
                    }
                }

                const lexicalSupplement = dependencies.runLexicalMemoryFallback(
                    db,
                    characterId,
                    queryVariants,
                    Math.max(resultLimit * 2, 8),
                    { temporalIntent, nowTs: searchNow }
                ).filter(memRow => dependencies.memoryMatchesSearchFilters(memRow, normalizedRequest.filters, temporalRange));
                for (const memRow of lexicalSupplement) {
                    if (!memRow?.id) continue;
                    const lexicalScore = (Number(memRow._search_score || 0) || 0) + 0.45;
                    const existing = aggregate.get(memRow.id);
                    if (!existing || lexicalScore > existing.finalScore) {
                        aggregate.set(memRow.id, {
                            memRow,
                            finalScore: lexicalScore,
                            matchedQuery: memRow._matched_query || 'lexical_exact'
                        });
                    }
                }

                const rankedRows = Array.from(aggregate.values())
                    .sort((a, b) => b.finalScore - a.finalScore)
                    .slice(0, Math.max(resultLimit * 3, resultLimit))
                    .map(entry => {
                        entry.memRow._search_score = entry.finalScore.toFixed(3);
                        entry.memRow._matched_query = entry.matchedQuery;
                        return entry.memRow;
                    });
                const memories = dependencies.finalizeMemorySearchRows(rankedRows, resultLimit);
                if (memories.length > 0 && db.markMemoriesRetrieved) {
                    db.markMemoriesRetrieved(memories.map(m => m.id));
                }
                if (memories.length > 0) {
                    if (typeof onTrace === 'function') {
                        await onTrace({
                            phase: 'vectra_return',
                            count: memories.length,
                            results: memories.map(mem => ({
                                id: mem.id,
                                score: mem._search_score || '',
                                matched_query: mem._matched_query || '',
                                memory_focus: mem.memory_focus || '',
                                memory_tier: mem.memory_tier || '',
                                retention_action: mem.retention_action || '',
                                source_started_at: mem.source_started_at || 0,
                                source_ended_at: mem.source_ended_at || 0
                            }))
                        });
                    }
                    return memories;
                }
            }

            if (typeof onTrace === 'function') {
                await onTrace({ phase: 'lexical_begin' });
            }
            const lexicalFallback = dependencies.runLexicalMemoryFallback(db, characterId, queryVariants, resultLimit, { temporalIntent, nowTs: searchNow })
                .filter(memRow => dependencies.memoryMatchesSearchFilters(memRow, normalizedRequest.filters, temporalRange));
            if (lexicalFallback.length > 0) {
                if (db.markMemoriesRetrieved) {
                    db.markMemoriesRetrieved(lexicalFallback.map(m => m.id));
                }
                if (typeof onTrace === 'function') {
                    await onTrace({
                        phase: 'lexical_return',
                        count: lexicalFallback.length,
                        results: lexicalFallback.map(mem => ({
                            id: mem.id,
                            score: mem._search_score || '',
                            matched_query: mem._matched_query || '',
                            memory_focus: mem.memory_focus || '',
                            memory_tier: mem.memory_tier || '',
                            retention_action: mem.retention_action || '',
                            source_started_at: mem.source_started_at || 0,
                            source_ended_at: mem.source_ended_at || 0
                        }))
                    });
                }
                return lexicalFallback;
            }

            if (typeof onTrace === 'function') {
                await onTrace({ phase: 'semantic_begin' });
            }
            const semanticFallback = (await dependencies.runSemanticMemoryFallback(db, characterId, baseQuery, resultLimit, { temporalIntent, nowTs: searchNow }))
                .filter(memRow => dependencies.memoryMatchesSearchFilters(memRow, normalizedRequest.filters, temporalRange));
            if (semanticFallback.length > 0 && db.markMemoriesRetrieved) {
                db.markMemoriesRetrieved(semanticFallback.map(m => m.id));
            }
            if (typeof onTrace === 'function') {
                await onTrace({
                    phase: 'semantic_finish',
                    count: semanticFallback.length,
                    results: semanticFallback.map(mem => ({
                        id: mem.id,
                        score: mem._search_score || '',
                        matched_query: mem._matched_query || '',
                        memory_focus: mem.memory_focus || '',
                        memory_tier: mem.memory_tier || '',
                        retention_action: mem.retention_action || '',
                        source_started_at: mem.source_started_at || 0,
                        source_ended_at: mem.source_ended_at || 0
                    }))
                });
            }
            return semanticFallback;
        } catch (e) {
            if (typeof onTrace === 'function') {
                await onTrace({ phase: 'search_error', message: String(e?.message || e) });
            }
            console.error(`[Memory] Search failed for ${characterId}:`, e.message);
            return [];
        }
    }

    return { searchMemories };
}

module.exports = { createModule };
