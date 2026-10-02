// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
}

function isRecoverableQdrantError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('already exists');
}

async function canUseQdrant() {
    const now = Date.now();
    if (
        dependencies.qdrantAvailability !== null
        && (dependencies.qdrantAvailability || (now - dependencies.qdrantAvailabilityCheckedAt) < dependencies.QDRANT_AVAILABILITY_CACHE_MS)
    ) {
        return dependencies.qdrantAvailability;
    }
    const previous = dependencies.qdrantAvailability;
    dependencies.qdrantAvailability = await dependencies.qdrant.healthcheck();
    dependencies.qdrantAvailabilityCheckedAt = now;
    if (dependencies.qdrantAvailability && previous !== true) {
        console.log('[Memory] Qdrant is available. Vector operations will use Qdrant first.');
    } else if (!dependencies.qdrantAvailability && previous !== false) {
        console.warn('[Memory] Qdrant is unavailable. Falling back to local vectra indices.');
    }
    return dependencies.qdrantAvailability;
}

async function getVectorIndex(userId, characterId) {
    const key = `${userId}_${characterId}`;
    if (dependencies.indices.has(key)) {
        return dependencies.indices.get(key);
    }
    const dir = getVectorIndexDir(userId, characterId);
    const indexPath = dependencies.path.join(dir, 'index.json');
    if (!dependencies.fs.existsSync(dir)) {
        dependencies.fs.mkdirSync(dir, { recursive: true });
    }
    if (dependencies.fs.existsSync(indexPath)) {
        try {
            const stat = dependencies.fs.statSync(indexPath);
            if (stat.isDirectory()) {
                const legacyIndexFile = dependencies.path.join(indexPath, 'index.json');
                const tempIndexFile = dependencies.path.join(dir, '__index_migrated__.json');
                if (dependencies.fs.existsSync(legacyIndexFile) && dependencies.fs.statSync(legacyIndexFile).isFile()) {
                    dependencies.fs.copyFileSync(legacyIndexFile, tempIndexFile);
                }
                dependencies.fs.rmSync(indexPath, { recursive: true, force: true });
                if (dependencies.fs.existsSync(tempIndexFile)) {
                    dependencies.fs.renameSync(tempIndexFile, indexPath);
                }
            }
        } catch (e) {
            try { dependencies.fs.rmSync(indexPath, { recursive: true, force: true }); } catch (err) { }
        }
    }
    const index = new dependencies.LocalIndex(indexPath);
    // Create if not exists OR if it exists but is corrupted
    try {
        const isCreated = await index.isIndexCreated();
        if (!isCreated) {
            await index.createIndex({
                version: 1,
                deleteConfig: { enabled: false }, // Simple config
                dimension: dependencies.LOCAL_EMBEDDING_DIM
            });
        }
    } catch (err) {
        // If it throws "Index does not exist" or "Unexpected end of JSON input", recreate it
        console.warn(`[Memory] Vector index corrupted/missing for ${characterId}, recreating...`, err.message);
        try { dependencies.fs.rmSync(indexPath, { recursive: true, force: true }); } catch (e) { }
        dependencies.fs.mkdirSync(dir, { recursive: true });
        await index.createIndex({
            version: 1,
            deleteConfig: { enabled: false },
            dimension: dependencies.LOCAL_EMBEDDING_DIM
        });
    }
    dependencies.indices.set(key, index);
    return index;
}

function getVectorIndexDir(userId, characterId) {
    return dependencies.buildVectorIndexDir(dependencies.LOCAL_EMBEDDING_INDEX_TAG, userId, characterId);
}

function getLegacyVectorIndexDir(userId, characterId) {
    return dependencies.buildVectorIndexDir(userId, characterId);
}

function getLegacyDefaultVectorIndexDir(characterId) {
    return dependencies.buildVectorIndexDir('default', characterId);
}

function getVectorIndexFile(dir) {
    return dependencies.path.join(dir, 'index.json');
}

function getVectorIndexVersionFile(userId, characterId) {
    return dependencies.path.join(getVectorIndexDir(userId, characterId), 'memory_source_version.json');
}

function readVectorIndexSourceVersion(userId, characterId) {
    try {
        const filePath = getVectorIndexVersionFile(userId, characterId);
        if (!dependencies.fs.existsSync(filePath)) return null;
        return JSON.parse(dependencies.fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return null;
    }
}

function writeVectorIndexSourceVersion(userId, characterId, payload = {}) {
    try {
        const filePath = getVectorIndexVersionFile(userId, characterId);
        dependencies.fs.mkdirSync(dependencies.path.dirname(filePath), { recursive: true });
        dependencies.fs.writeFileSync(filePath, JSON.stringify({
            version: dependencies.MEMORY_RETRIEVAL_SOURCE_VERSION,
            built_at: Date.now(),
            ...payload
        }, null, 2));
    } catch (e) {
        console.warn(`[Memory] Failed to write memory index source marker for ${characterId}:`, e.message);
    }
}

function getVectorIndexItemCountSync(dir) {
    try {
        const indexPath = getVectorIndexFile(dir);
        let filePath = indexPath;
        if (dependencies.fs.existsSync(indexPath) && dependencies.fs.statSync(indexPath).isDirectory()) {
            filePath = dependencies.path.join(indexPath, 'index.json');
        }
        if (!dependencies.fs.existsSync(filePath) || !dependencies.fs.statSync(filePath).isFile()) return 0;
        const parsed = JSON.parse(dependencies.fs.readFileSync(filePath, 'utf8'));
        return Array.isArray(parsed?.items) ? parsed.items.length : 0;
    } catch (e) {
        return 0;
    }
}

    return { yieldToEventLoop, isRecoverableQdrantError, canUseQdrant, getVectorIndex, getVectorIndexDir, getLegacyVectorIndexDir, getLegacyDefaultVectorIndexDir, getVectorIndexFile, getVectorIndexVersionFile, readVectorIndexSourceVersion, writeVectorIndexSourceVersion, getVectorIndexItemCountSync };
}

module.exports = { createModule };
