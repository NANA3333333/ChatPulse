// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function runLexicalMemoryFallback(db, characterId, queryVariants = [], limit = 5, options = {}) {
        try {
            if (!db?.getRawDb) return [];
            const rawDb = db.getRawDb();
            if (!rawDb) return [];

            const normalizedVariants = queryVariants
                .map(v => String(v || '').trim())
                .filter(Boolean);
            if (normalizedVariants.length === 0) return [];

            const rows = dependencies.buildNewLibraryIndexCards(db.getMemories(characterId));

            const scored = rows.map(row => {
                let lexicalBoost = dependencies.computeLexicalBoost(row, normalizedVariants);
                const aliasBridgeBoost = dependencies.computeAliasBridgeBoost(row, normalizedVariants);
                let matchedQuery = '';
                for (const variant of normalizedVariants) {
                    const needle = dependencies.normalizeSearchText(variant);
                    if (!needle) continue;
                    const haystack = dependencies.normalizeSearchText(dependencies.buildMemoryRecallText(row));
                    if (haystack.includes(needle) || dependencies.computeLexicalVariantBoost(haystack, variant) > 0) {
                        matchedQuery = variant;
                        break;
                    }
                }
                if (!matchedQuery && lexicalBoost <= 0) return null;

                const importance = Number(row.importance || 5);
                const retrievalWeight = Number(row.retrieval_weight || dependencies.computeMemoryRetrievalWeight(row) || 1);
                const tierBoost = dependencies.computeMemoryTierBoost(row);
                const profilePriorityBoost = dependencies.computeUserProfilePriorityBoost(row, normalizedVariants[0] || '', normalizedVariants);
                const recencyAdjustment = dependencies.computeRecencyScoreAdjustment(row, options.temporalIntent, options.nowTs);
                const retentionAdjustment = dependencies.computeRetentionSearchAdjustment(row);
                const finalScore = lexicalBoost + aliasBridgeBoost + tierBoost + profilePriorityBoost + (importance * 0.025) + ((retrievalWeight - 1) * 0.1) + recencyAdjustment + retentionAdjustment;
                return {
                    row,
                    finalScore,
                    matchedQuery: matchedQuery || 'lexical_fallback'
                };
            }).filter(Boolean);

            const rankedRows = scored
                .sort((a, b) => b.finalScore - a.finalScore)
                .slice(0, Math.max(limit * 3, limit))
                .map(entry => {
                    entry.row._search_score = entry.finalScore.toFixed(3);
                    entry.row._matched_query = entry.matchedQuery;
                    return entry.row;
                });
            return dependencies.finalizeMemorySearchRows(rankedRows, limit);
        } catch (e) {
            console.error(`[Memory] Lexical fallback failed for ${characterId}:`, e.message);
            return [];
        }
    }

async function runSemanticMemoryFallback(db, characterId, queryText, limit = 5, options = {}) {
        try {
            const rows = dependencies.buildNewLibraryIndexCards(db.getMemories(characterId))
                .slice(0, 120);
            if (rows.length === 0) return [];

            const queryEmbedding = await dependencies.getEmbedding(queryText);
            const scored = [];
            for (let idx = 0; idx < rows.length; idx++) {
                if (idx > 0 && idx % 10 === 0) {
                    await dependencies.yieldToEventLoop();
                }
                const row = rows[idx];
                const text = dependencies.buildMemoryRecallText(row);
                if (!text) continue;
                const rowEmbedding = await dependencies.getEmbedding(text.slice(0, 1200));
                const similarity = queryEmbedding.reduce((sum, value, idx) => sum + (value * (rowEmbedding[idx] || 0)), 0);
                if (similarity < 0.20) continue;
                const importance = Number(row.importance || 5);
                const retrievalWeight = Number(row.retrieval_weight || dependencies.computeMemoryRetrievalWeight(row) || 1);
                const contradictionPenalty = dependencies.computeRecallContradictionPenalty(row, queryText);
                const tierBoost = dependencies.computeMemoryTierBoost(row);
                const profilePriorityBoost = dependencies.computeUserProfilePriorityBoost(row, queryText, [queryText]);
                const recencyAdjustment = dependencies.computeRecencyScoreAdjustment(row, options.temporalIntent, options.nowTs);
                const retentionAdjustment = dependencies.computeRetentionSearchAdjustment(row);
                const finalScore = similarity + tierBoost + profilePriorityBoost + (importance * 0.02) + ((retrievalWeight - 1) * 0.08) + recencyAdjustment + retentionAdjustment - contradictionPenalty;
                scored.push({ row, finalScore });
            }

            const rankedRows = scored
                .sort((a, b) => b.finalScore - a.finalScore)
                .slice(0, Math.max(limit * 3, limit))
                .map(entry => {
                    entry.row._search_score = entry.finalScore.toFixed(3);
                    entry.row._matched_query = 'semantic_fallback';
                    return entry.row;
                });
            return dependencies.finalizeMemorySearchRows(rankedRows, limit);
        } catch (e) {
            console.error(`[Memory] Semantic fallback failed for ${characterId}:`, e.message);
            return [];
        }
    }

    return { runLexicalMemoryFallback, runSemanticMemoryFallback };
}

module.exports = { createModule };
