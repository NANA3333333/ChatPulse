// POST /api/upload
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/upload', require("../../../platform/http/trace.js").traceHttp("media", "POST /api/upload"), dependencies.authMiddleware, (req, res) => {
    dependencies.upload.single('image')(req, res, function (err) {
        if (err instanceof dependencies.multer.MulterError) {
            // A Multer error occurred when uploading (e.g. file too large)
            return res.status(400).json({ error: err.message });
        } else if (err) {
            // An unknown error occurred (e.g. our custom fileFilter threw an error)
            return res.status(400).json({ error: err.message });
        }

        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            if (!dependencies.isValidImageUploadContent(file)) {
                dependencies.cleanupUploadedFile(file);
                return res.status(400).json({ error: 'Invalid image content. Upload a PNG, JPEG, GIF, or WebP image.' });
            }
            // Return relative path so frontend can construct absolute URL or use it directly
            const authUrl = `/api/media/uploads/${encodeURIComponent(file.filename)}`;
            const legacyUrl = `/uploads/users/${encodeURIComponent(req.user.id)}/${encodeURIComponent(file.filename)}`;
            res.json({ success: true, url: authUrl, mediaUrl: authUrl, legacyUrl });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});
}
module.exports = { register };
