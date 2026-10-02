// GET /api/admin/qdrant/status
function register(dependencies) {
dependencies.app.get('/api/admin/qdrant/status', require("../../../platform/http/trace.js").traceHttp("admin", "GET /api/admin/qdrant/status"), dependencies.authMiddleware, dependencies.adminMiddleware, async (req, res) => {
        const config = dependencies.qdrant.getQdrantConfig();
        const status = {
            enabled: !!config.enabled,
            reachable: false,
            url: config.url,
            mode: dependencies.getQdrantMode(),
            collectionPrefix: process.env.QDRANT_COLLECTION_PREFIX || 'chatpulse_memories',
            backend: config.enabled ? 'qdrant-primary-with-vectra-fallback' : 'vectra-fallback-only',
            collectionsCount: 0,
            collections: [],
            indexedPoints: 0,
            lastError: ''
        };

        if (!config.enabled) {
            return res.json({ success: true, status });
        }

        try {
            const collections = await dependencies.qdrant.listCollections();
            const ownCollections = collections
                .map(item => String(item?.name || ''))
                .filter(Boolean)
                .filter(name => name.startsWith(`${status.collectionPrefix}_`));

            let indexedPoints = 0;
            for (const collectionName of ownCollections.slice(0, 20)) {
                try {
                    const info = await dependencies.qdrant.getCollectionInfo(collectionName);
                    indexedPoints += Number(
                        info?.points_count ??
                        info?.vectors_count ??
                        info?.indexed_vectors_count ??
                        0
                    );
                } catch (e) { }
            }

            status.reachable = true;
            status.collectionsCount = ownCollections.length;
            status.collections = ownCollections.slice(0, 8);
            status.indexedPoints = indexedPoints;
            return res.json({ success: true, status });
        } catch (e) {
            status.lastError = e.message;
            status.backend = 'vectra-fallback-active';
            return res.json({ success: true, status });
        }
    });
}
module.exports = { register };
