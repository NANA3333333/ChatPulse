// GET /api/system/export
function register(dependencies) {
dependencies.app.get('/api/system/export', require("../../../platform/http/trace.js").traceHttp("backup", "GET /api/system/export"), dependencies.authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            const db = req.db || dependencies.getUserDb(userId);
            const dbPath = db.getDbPath(); // Use the correct path from db instance

            if (!dependencies.fs.existsSync(dbPath)) return res.status(404).send('Database not found');

            // Force ALL WAL content into the main DB file for a fully up-to-date snapshot
            db.checkpoint();

            // Create a synchronous file copy — guaranteed to include all latest data
            const backupFileName = `chatpulse_backup_${userId}_${Date.now()}.db`;
            const backupDir = dependencies.path.dirname(dbPath);
            const backupPath = dependencies.path.join(backupDir, backupFileName);
            dependencies.fs.copyFileSync(dbPath, backupPath);

            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="chatpulse_backup_${userId}_${Date.now()}.zip"`);

            // Stream a zip archive containing the DB and uploads folder
            const archive = dependencies.archiver('zip', { zlib: { level: 5 } });

            archive.on('error', (err) => {
                console.error('[Backup] Archive error:', err);
                // Clean up temp backup
                if (dependencies.fs.existsSync(backupPath)) dependencies.fs.unlinkSync(backupPath);
                if (!res.headersSent) res.status(500).send('Archive creation failed');
            });

            archive.on('end', () => {
                // Clean up temp backup after archive is fully streamed
                if (dependencies.fs.existsSync(backupPath)) dependencies.fs.unlinkSync(backupPath);
            });

            archive.pipe(res);

            // Add the database backup file
            archive.file(backupPath, { name: 'chatpulse.db' });

            // Add only the current user's referenced upload files.
            for (const relPath of dependencies.getReferencedUploadsForUser(db, userId)) {
                const fullPath = dependencies.resolveUploadReferencePath(relPath);
                if (!fullPath) continue;
                if (!dependencies.fs.existsSync(fullPath)) continue;
                archive.file(fullPath, { name: relPath.replaceAll(dependencies.path.sep, '/') });
            }

            await archive.finalize();
        } catch (e) {
            console.error('[Backup] Export error:', e);
            if (!res.headersSent) res.status(500).send(e.message);
        }
    });
}
module.exports = { register };
