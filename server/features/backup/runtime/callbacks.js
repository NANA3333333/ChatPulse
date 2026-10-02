// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
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

const resolveUploadReferencePath = (relPath) => {
        if (!relPath) return null;
        const fullPath = dependencies.path.resolve(dependencies.publicRoot, relPath);
        if (fullPath !== dependencies.uploadsRoot && !fullPath.startsWith(dependencies.uploadsRoot + dependencies.path.sep)) {
            return null;
        }
        return fullPath;
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

const getReferencedUploadsForUser = (dbInstance, userId) => {
        const rawDb = typeof dbInstance?.getRawDb === 'function' ? dbInstance.getRawDb() : null;
        if (!rawDb) return [];
        return Array.from(new Set([
            ...collectUploadReferences(rawDb, 'SELECT avatar, banner FROM user_profile', undefined, userId),
            ...collectUploadReferences(rawDb, 'SELECT avatar FROM characters', undefined, userId),
            ...collectUploadReferences(rawDb, 'SELECT avatar FROM group_chats', undefined, userId),
        ]));
    };

const fileFilter = (req, file, cb) => {
        const name = file.originalname.toLowerCase();
        if (name.endsWith('.db') || name.endsWith('.zip') ||
            file.mimetype === 'application/octet-stream' ||
            file.mimetype === 'application/x-sqlite3' ||
            file.mimetype === 'application/zip') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only .db or .zip backups are allowed for import.'), false);
        }
    };

    return { toScopedMediaUploadRelativePath, toUploadRelativePath, resolveUploadReferencePath, collectUploadReferences, getReferencedUploadsForUser, fileFilter };
}

module.exports = { createModule };
