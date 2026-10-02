function register(dependencies) {
    dependencies.app.post(
        '/api/system/import',
        require('../../../platform/http/trace.js').traceHttp('backup', 'POST /api/system/import'),
        dependencies.authMiddleware,
        dependencies.upload.single('db_file'),
        async (req, res) => {
            const uploadedPath = req.file?.path;
            let extractedDir;
            try {
                if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
                let sourcePath = uploadedPath;
                let uploadsPath;
                if (req.file.originalname.toLowerCase().endsWith('.zip') || req.file.mimetype === 'application/zip') {
                    extractedDir = uploadedPath + '_extracted';
                    dependencies.fs.mkdirSync(extractedDir, { recursive: true });
                    await dependencies.extractZipSafely(uploadedPath, extractedDir);
                    const entries = dependencies.fs.readdirSync(extractedDir);
                    const name = entries.includes('chatpulse.db')
                        ? 'chatpulse.db'
                        : entries.find((entry) => entry.endsWith('.db'));
                    if (!name) return res.status(400).json({ error: 'No database found in archive' });
                    sourcePath = dependencies.path.join(extractedDir, name);
                    uploadsPath = dependencies.path.join(extractedDir, 'uploads');
                }
                res.json(
                    await dependencies.restoreArchive({ userId: req.user.id, db: req.db, sourcePath, uploadsPath }),
                );
            } catch (error) {
                console.error('[Backup] Import failed:', error);
                res.status(error.statusCode || 500).json({ error: error.message });
            } finally {
                dependencies.cleanupTemp(uploadedPath, extractedDir);
            }
        },
    );
}
module.exports = { register };
