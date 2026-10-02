// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function getExtractor() {
    if (dependencies.extractionDisabled) {
        if (Date.now() < dependencies.extractionRetryAt) return null;
        dependencies.extractionDisabled = false;
        dependencies.embeddingStats.extractorState = 'idle';
    }
    if (!dependencies.pipeline) {
        dependencies.embeddingStats.extractorState = 'loading';
        try {
            const transformers = await import('@xenova/transformers');
            dependencies.pipeline = await transformers.pipeline('feature-extraction', dependencies.LOCAL_EMBEDDING_MODEL);
            dependencies.embeddingStats.extractorState = 'ready';
        } catch (e) {
            console.error('[Memory] Xenova/ONNX initialization failed. Temporarily disabling local embeddings. Error:', e.message);
            dependencies.extractionDisabled = true;
            dependencies.extractionRetryAt = Date.now() + 60 * 1000;
            dependencies.embeddingStats.extractorState = 'failed';
            dependencies.embeddingStats.lastError = String(e.message || e);
            return null;
        }
    }
    return dependencies.pipeline;
}

function refreshEmbeddingStats() {
    dependencies.embeddingStats.cacheSize = dependencies.embeddingCache.size;
    dependencies.embeddingStats.inflightSize = dependencies.embeddingInFlight.size;
    dependencies.embeddingStats.activeCount = dependencies.activeEmbeddingJobs.size;
    let slowestPreview = '';
    let slowestElapsed = 0;
    const now = Date.now();
    for (const job of dependencies.activeEmbeddingJobs.values()) {
        const elapsed = Math.max(0, now - Number(job.startedAt || now));
        if (elapsed >= slowestElapsed) {
            slowestElapsed = elapsed;
            slowestPreview = job.preview || '';
        }
    }
    dependencies.embeddingStats.slowestActiveTextPreview = slowestPreview;
    dependencies.embeddingStats.slowestActiveElapsedMs = slowestElapsed;
}

async function getEmbedding(text) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) {
        return Array.from({ length: dependencies.LOCAL_EMBEDDING_DIM }, () => 0);
    }
    dependencies.embeddingStats.totalCalls += 1;
    if (dependencies.embeddingCache.has(normalizedText)) {
        dependencies.embeddingStats.totalCacheHits += 1;
        refreshEmbeddingStats();
        return dependencies.embeddingCache.get(normalizedText);
    }
    if (dependencies.embeddingInFlight.has(normalizedText)) {
        dependencies.embeddingStats.totalInflightHits += 1;
        refreshEmbeddingStats();
        return dependencies.embeddingInFlight.get(normalizedText);
    }
    const startedAt = Date.now();
    const preview = normalizedText.slice(0, 80);
    dependencies.activeEmbeddingJobs.set(normalizedText, { startedAt, preview });
    dependencies.embeddingStats.lastStartedAt = startedAt;
    refreshEmbeddingStats();
    const pending = (async () => {
        const extractor = await getExtractor();
        if (!extractor) {
            throw new Error('Local embedding model is unavailable; refusing to create a zero vector.');
        }
        const output = await extractor(normalizedText, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data);
        dependencies.embeddingCache.set(normalizedText, vector);
        if (dependencies.embeddingCache.size > dependencies.EMBEDDING_CACHE_LIMIT) {
            const oldestKey = dependencies.embeddingCache.keys().next().value;
            if (oldestKey) dependencies.embeddingCache.delete(oldestKey);
        }
        return vector;
    })();
    dependencies.embeddingInFlight.set(normalizedText, pending);
    try {
        const vector = await pending;
        dependencies.embeddingStats.totalCompleted += 1;
        dependencies.embeddingStats.lastFinishedAt = Date.now();
        dependencies.embeddingStats.lastDurationMs = Math.max(0, dependencies.embeddingStats.lastFinishedAt - startedAt);
        dependencies.embeddingStats.lastError = '';
        return vector;
    } catch (e) {
        dependencies.embeddingStats.totalFailures += 1;
        dependencies.embeddingStats.lastFinishedAt = Date.now();
        dependencies.embeddingStats.lastDurationMs = Math.max(0, dependencies.embeddingStats.lastFinishedAt - startedAt);
        dependencies.embeddingStats.lastError = String(e?.message || e || '');
        throw e;
    } finally {
        dependencies.embeddingInFlight.delete(normalizedText);
        dependencies.activeEmbeddingJobs.delete(normalizedText);
        refreshEmbeddingStats();
    }
}

function getEmbeddingDebugStatus() {
    refreshEmbeddingStats();
    return {
        ...dependencies.embeddingStats,
        extractionDisabled: dependencies.extractionDisabled,
        pipelineLoaded: !!dependencies.pipeline
    };
}

    return { getExtractor, refreshEmbeddingStats, getEmbedding, getEmbeddingDebugStatus };
}

module.exports = { createModule };
