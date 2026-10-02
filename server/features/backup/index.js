const fs = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const unzipper = require('unzipper');
const { getUploadsDir, getPublicRootDir, getTtsDir } = require('../../paths');

module.exports = function initBackup(app, pluginContext) {
    const { getMemory, getUserDb, getEngine, getWsClients, authMiddleware } = pluginContext;
    const { clearMemoryCache } = require('../memory/index.js');
    const { closeSchedulerDb } = require('../scheduler/db.js');

    // Resolve path to the shared uploads directory.
    const uploadsDir = getUploadsDir();
    const tempUploadsDir = path.join(uploadsDir, 'temp');
    const publicRoot = path.resolve(getPublicRootDir());
    const uploadsRoot = path.resolve(uploadsDir);

    const { resolveUploadReferencePath, getReferencedUploadsForUser, fileFilter } =
        require('./runtime/callbacks.js').createModule({
            get path() {
                return path;
            },
            get publicRoot() {
                return publicRoot;
            },
            get uploadsRoot() {
                return uploadsRoot;
            },
        });

    const { removeFileIfExists, removeDirectoryIfExists, cleanupTemp, extractZipSafely } =
        require('./runtime/operations.js').createModule({
            get fs() {
                return fs;
            },
            get path() {
                return path;
            },
            get resolveUploadReferencePath() {
                return resolveUploadReferencePath;
            },
            get tempUploadsDir() {
                return tempUploadsDir;
            },
            get unzipper() {
                return unzipper;
            },
            get uploadsDir() {
                return uploadsDir;
            },
        });

    // ─── PRIVATE MULTER CONFIG FOR BACKUP UPLOADS ─────────────────────────
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const tempDir = path.join(uploadsDir, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            cb(null, tempDir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = path.extname(file.originalname);
            cb(null, 'import-' + uniqueSuffix + ext);
        },
    });

    const upload = multer({
        storage: storage,
        limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit (zip with images can be large)
        fileFilter: fileFilter,
    });

    const { userDbCache, beginUserDbMaintenance } = require('../../platform/db/userDatabase.js');
    const { engineCache } = require('../private-chat/runtime.js');
    const { getBackgroundQueueStats } = require('../../platform/jobs/backgroundQueue.js');
    const restoreArchive = require('./restoreService.js').createRestoreService({
        uploadsDir,
        userDbCache,
        engineCache,
        beginUserDbMaintenance,
        getBackgroundQueueStats,
        closeSchedulerDb,
        getUserDb,
        clearMemoryCache,
        getMemory,
        getEngine,
        getWsClients,
    });

    // ─── EXPORT: Download backup as .zip (DB + uploads) ──────────────────
    require('./http/get-system-export.js').register({
        get app() {
            return app;
        },
        get archiver() {
            return archiver;
        },
        get authMiddleware() {
            return authMiddleware;
        },
        get fs() {
            return fs;
        },
        get getReferencedUploadsForUser() {
            return getReferencedUploadsForUser;
        },
        get getUserDb() {
            return getUserDb;
        },
        get path() {
            return path;
        },
        get resolveUploadReferencePath() {
            return resolveUploadReferencePath;
        },
    });

    // ─── WIPE ALL DATA ────────────────────────────────────────────────────
    require('./http/delete-system-wipe.js').register({
        get app() {
            return app;
        },
        get authMiddleware() {
            return authMiddleware;
        },
        get clearMemoryCache() {
            return clearMemoryCache;
        },
        get closeSchedulerDb() {
            return closeSchedulerDb;
        },
        get getMemory() {
            return getMemory;
        },
        get getTtsDir() {
            return getTtsDir;
        },
        get path() {
            return path;
        },
        get removeDirectoryIfExists() {
            return removeDirectoryIfExists;
        },
        get removeFileIfExists() {
            return removeFileIfExists;
        },
        get uploadsDir() {
            return uploadsDir;
        },
    });

    // ─── IMPORT DATABASE (supports .zip or raw .db) ──────────────────────
    require('./http/post-system-import.js').register({
        app,
        authMiddleware,
        cleanupTemp,
        extractZipSafely,
        fs,
        path,
        upload,
        restoreArchive,
    });

    // ─── Helpers ─────────────────────────────────────────────────────────

    console.log('[Plugin] Loaded DLC: backup system');
};
