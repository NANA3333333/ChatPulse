// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const removeFileIfExists = async (filePath, options = {}) => {
        const retries = Math.max(1, Number(options.retries || 6));
        const delayMs = Math.max(20, Number(options.delayMs || 120));
        for (let attempt = 0; attempt < retries; attempt += 1) {
            try {
                if (!dependencies.fs.existsSync(filePath)) return;
                dependencies.fs.unlinkSync(filePath);
                return;
            } catch (e) {
                const isBusy = e && ['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(String(e.code || ''));
                if (!isBusy || attempt === retries - 1) {
                    throw e;
                }
                await wait(delayMs * (attempt + 1));
            }
        }
    };

const disconnectUserSessions = (userId) => {
        const clients = dependencies.getWsClients(userId);
        if (clients && clients.size > 0) {
            clients.forEach(c => c.close());
        }
    };

const getDirectorySize = (dirPath) => {
        if (!dirPath || !dependencies.fs.existsSync(dirPath)) return 0;
        let total = 0;
        for (const entry of dependencies.fs.readdirSync(dirPath, { withFileTypes: true })) {
            const fullPath = dependencies.path.join(dirPath, entry.name);
            try {
                if (entry.isDirectory()) {
                    total += getDirectorySize(fullPath);
                } else if (entry.isFile()) {
                    total += dependencies.fs.statSync(fullPath).size;
                }
            } catch (e) { }
        }
        return total;
    };

const removeDirectoryIfExists = async (dirPath, options = {}) => {
        const retries = Math.max(1, Number(options.retries || 6));
        const delayMs = Math.max(20, Number(options.delayMs || 120));
        for (let attempt = 0; attempt < retries; attempt += 1) {
            try {
                if (!dependencies.fs.existsSync(dirPath)) return;
                dependencies.fs.rmSync(dirPath, { recursive: true, force: true });
                return;
            } catch (e) {
                const isBusy = e && ['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(String(e.code || ''));
                if (!isBusy || attempt === retries - 1) {
                    throw e;
                }
                await wait(delayMs * (attempt + 1));
            }
        }
    };

const removeUserVectorArtifacts = async (userId) => {
        const vectorsRoot = dependencies.getVectorRootDir();
        if (!dependencies.fs.existsSync(vectorsRoot)) return;
        const entries = dependencies.fs.readdirSync(vectorsRoot, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const candidateDir = dependencies.path.join(vectorsRoot, entry.name, String(userId));
            await removeDirectoryIfExists(candidateDir);
        }
    };

const cleanupUserStorage = async (userId) => {
        dependencies.closeSchedulerDb(userId);
        const db = dependencies.userDbCache.get(userId);
        if (db) {
            try { db.checkpoint(); } catch (e) { }
            try { db.close(); } catch (e) { }
            dependencies.userDbCache.delete(userId);
        }
        dependencies.clearMemoryCache(userId);
        await wait(250);

        try {
            await dependencies.qdrant.deleteUserCollection(userId);
        } catch (e) { }
        await removeUserVectorArtifacts(userId);
        dependencies.clearMemoryCache(userId);

        const dbPath = dependencies.getUserDbPath(userId);
        await removeFileIfExists(dbPath);
        await removeFileIfExists(`${dbPath}-wal`);
        await removeFileIfExists(`${dbPath}-shm`);

        const userUploadDir = dependencies.path.join(dependencies.getUploadsDir(), 'users', String(userId));
        await removeDirectoryIfExists(userUploadDir);
        const userTtsDir = dependencies.path.join(dependencies.getTtsDir(), String(userId));
        await removeDirectoryIfExists(userTtsDir);
    };

const scheduleDeferredUserDeletion = (userId) => {
        const key = String(userId);
        if (dependencies.pendingUserDeletionJobs.has(key)) return;
        const timer = setInterval(async () => {
            try {
                await cleanupUserStorage(key);
                clearInterval(timer);
                dependencies.pendingUserDeletionJobs.delete(key);
                dependencies.unmarkUserDbDeleting(key);
                console.log(`[Admin] Deferred user storage cleanup completed for ${key}.`);
            } catch (e) {
                const code = String(e?.code || '');
                if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(code)) {
                    clearInterval(timer);
                    dependencies.pendingUserDeletionJobs.delete(key);
                    dependencies.unmarkUserDbDeleting(key);
                    console.error(`[Admin] Deferred user storage cleanup failed for ${key}:`, e);
                }
            }
        }, 5000);
        dependencies.pendingUserDeletionJobs.set(key, timer);
    };

const toScopedMediaUploadRelativePath = (value, userId) => {
        const raw = String(value || '').trim();
        const marker = '/api/media/uploads/';
        const markerIdx = raw.indexOf(marker);
        if (markerIdx < 0) return null;
        const encodedFilename = raw.slice(markerIdx + marker.length).split(/[?#]/, 1)[0];
        if (!encodedFilename) return null;
        let filename = encodedFilename;
        try {
            filename = decodeURIComponent(encodedFilename);
        } catch (e) {
            return null;
        }
        if (!filename || filename.includes('\0') || filename.includes('/') || filename.includes('\\') || filename !== dependencies.path.posix.basename(filename)) return null;
        return dependencies.path.join('uploads', 'users', String(userId || 'default'), filename);
    };

const toUploadRelativePath = (value, userId = '') => {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const scopedMediaPath = toScopedMediaUploadRelativePath(raw, userId);
        if (scopedMediaPath) return scopedMediaPath;
        const marker = '/uploads/';
        const markerIdx = raw.indexOf(marker);
        let rel = null;
        if (markerIdx >= 0) {
            rel = raw.slice(markerIdx + 1);
        } else if (/^uploads[\\/]/.test(raw)) {
            rel = raw;
        } else {
            return null;
        }

        rel = rel.split(/[?#]/, 1)[0].replace(/\\/g, '/');
        if (!rel || rel.includes('\0') || rel.startsWith('/') || /^[a-zA-Z]:/.test(rel)) {
            return null;
        }
        const normalizedPath = dependencies.path.posix.normalize(rel);
        if (normalizedPath === '.' || normalizedPath === '..' || normalizedPath.startsWith('../')) {
            return null;
        }
        if (!normalizedPath.startsWith('uploads/')) {
            return null;
        }
        return normalizedPath.replaceAll('/', dependencies.path.sep);
    };

const resolveUploadReferencePath = (uploadsRoot, relPath) => {
        if (!relPath) return null;
        const uploadsDir = dependencies.path.resolve(uploadsRoot, 'uploads');
        const fullPath = dependencies.path.resolve(uploadsRoot, relPath);
        if (fullPath !== uploadsDir && !fullPath.startsWith(uploadsDir + dependencies.path.sep)) {
            return null;
        }
        return fullPath;
    };

const getUserVectorStorageSize = (userId) => {
        const vectorsRoot = dependencies.getVectorRootDir();
        if (!dependencies.fs.existsSync(vectorsRoot)) return 0;
        const candidateDirs = new Set();
        candidateDirs.add(dependencies.path.join(vectorsRoot, String(userId)));
        for (const entry of dependencies.fs.readdirSync(vectorsRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            candidateDirs.add(dependencies.path.join(vectorsRoot, entry.name, String(userId)));
        }
        let total = 0;
        for (const dirPath of candidateDirs) {
            total += getDirectorySize(dirPath);
        }
        return total;
    };

const collectUploadReferences = (userDb, sql, mapper = (row) => Object.values(row || {}), userId = '') => {
        const refs = new Set();
        try {
            const rows = userDb.prepare(sql).all();
            for (const row of rows) {
                for (const value of mapper(row)) {
                    const relPath = toUploadRelativePath(value, userId);
                    if (relPath) refs.add(relPath);
                }
            }
        } catch (e) { }
        return refs;
    };

const getUserStats = (user) => {
        const dbPath = dependencies.getUserDbPath(user.id);
        const uploadsRoot = dependencies.getPublicRootDir();
        const stats = {
            db_size_bytes: 0,
            vector_size_bytes: 0,
            upload_size_bytes: 0,
            total_storage_bytes: 0,
            characters_count: 0,
            messages_count: 0,
            memories_count: 0,
            diaries_count: 0,
            token_total: 0,
            account_age_ms: Math.max(0, Date.now() - Number(user.created_at || Date.now()))
        };
        if (!dependencies.fs.existsSync(dbPath)) {
            return stats;
        }
        try {
            stats.db_size_bytes = dependencies.fs.statSync(dbPath).size;
        } catch (e) { }
        try {
            stats.vector_size_bytes = getUserVectorStorageSize(user.id);
        } catch (e) { }
        let userDb;
        try {
            userDb = new dependencies.Database(dbPath, { readonly: true, fileMustExist: true });
            const count = (table) => userDb.prepare(`SELECT COUNT(*) as c FROM ${table}`).get()?.c || 0;
            stats.characters_count = count('characters');
            stats.messages_count = count('messages');
            stats.memories_count = count('memories');
            stats.diaries_count = count('diaries');
            stats.token_total = userDb.prepare('SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total FROM token_usage').get()?.total || 0;

            const uploadRefs = new Set([
                ...collectUploadReferences(userDb, 'SELECT avatar, banner FROM user_profile', undefined, user.id),
                ...collectUploadReferences(userDb, 'SELECT avatar FROM characters', undefined, user.id),
                ...collectUploadReferences(userDb, 'SELECT avatar FROM group_chats', undefined, user.id),
            ]);
            for (const relPath of uploadRefs) {
                const fullPath = resolveUploadReferencePath(uploadsRoot, relPath);
                try {
                    if (fullPath && dependencies.fs.existsSync(fullPath)) {
                        stats.upload_size_bytes += dependencies.fs.statSync(fullPath).size;
                    }
                } catch (e) { }
            }
        } catch (e) {
            stats.read_error = e.message;
        } finally {
            try { userDb?.close(); } catch (e) { }
        }
        stats.total_storage_bytes = stats.db_size_bytes + stats.vector_size_bytes + stats.upload_size_bytes;
        return stats;
    };

const adminMiddleware = (req, res, next) => {
        if (!req.user || !dependencies.authDb.isAdminRole(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden. Admin level restricted.' });
        }
        next();
    };

const getMutableAdminTarget = (req, res) => {
        const targetId = req.params.id;
        const targetUser = dependencies.authDb.getUserById(targetId);
        if (!targetUser) {
            res.status(404).json({ error: 'User not found' });
            return null;
        }
        if (targetUser.role === 'root') {
            res.status(403).json({ error: 'Root account is protected' });
            return null;
        }
        return targetUser;
    };

const sendAdminUserMutationNotFound = (res) => {
        return res.status(404).json({ error: 'User not found' });
    };

const getQdrantMode = () => {
        const config = dependencies.qdrant.getQdrantConfig();
        if (!config.enabled) return 'disabled';
        const localBinaryPath = dependencies.path.join(require('../../../paths').repoRoot, 'tools', 'qdrant', 'current', 'qdrant.exe');
        if (dependencies.fs.existsSync(localBinaryPath)) return 'local';
        if (/127\.0\.0\.1|localhost/i.test(config.url)) return 'self-hosted';
        return 'external';
    };

    return { wait, removeFileIfExists, disconnectUserSessions, getDirectorySize, removeDirectoryIfExists, removeUserVectorArtifacts, cleanupUserStorage, scheduleDeferredUserDeletion, toScopedMediaUploadRelativePath, toUploadRelativePath, resolveUploadReferencePath, getUserVectorStorageSize, collectUploadReferences, getUserStats, adminMiddleware, getMutableAdminTarget, sendAdminUserMutationNotFound, getQdrantMode };
}

module.exports = { createModule };
