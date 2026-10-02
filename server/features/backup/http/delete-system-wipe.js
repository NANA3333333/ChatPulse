// DELETE /api/system/wipe
function register(dependencies) {
dependencies.app.delete('/api/system/wipe', require("../../../platform/http/trace.js").traceHttp("backup", "DELETE /api/system/wipe"), dependencies.authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            const memory = dependencies.getMemory(userId);

            const characters = req.db.getCharacters();
            for (const c of characters) {
                await memory.wipeIndex(c.id);
            }

            const dbPath = req.db.getDbPath();
            const { userDbCache } = require("../../../platform/db/userDatabase.js");
            const { engineCache } = require("../../private-chat/runtime.js");

            // Stop workers and cached handles before removing the underlying DB files.
            dependencies.closeSchedulerDb(userId);
            const oldEngine = engineCache.get(userId);
            if (oldEngine && typeof oldEngine.stopAllTimers === 'function') {
                oldEngine.stopAllTimers();
            }
            req.db.close();
            userDbCache.delete(userId);
            dependencies.clearMemoryCache(userId);

            dependencies.removeFileIfExists(dbPath);
            dependencies.removeFileIfExists(`${dbPath}-wal`);
            dependencies.removeFileIfExists(`${dbPath}-shm`);
            dependencies.removeDirectoryIfExists(dependencies.path.join(dependencies.uploadsDir, 'users', String(userId)));
            dependencies.removeDirectoryIfExists(dependencies.path.join(dependencies.getTtsDir(), String(userId)));

            // Also clear engine cache so stale DB references are purged
            engineCache.delete(userId);

            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
