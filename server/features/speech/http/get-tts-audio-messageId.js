// GET /api/tts/audio/:messageId
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/tts/audio/:messageId', require("../../../platform/http/trace.js").traceHttp("speech", "GET /api/tts/audio/:messageId"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const row = db.getMessageTts?.(req.params.messageId);
        if (!row || row.status !== 'ready' || !row.audio_path) {
            return res.status(404).json({ error: 'TTS audio not found.' });
        }
        const messageCharId = db.getMessageCharacterId?.(req.params.messageId);
        if (!messageCharId) {
            return res.status(404).json({ error: 'TTS audio not found.' });
        }
        if (messageCharId && String(messageCharId) !== String(row.character_id)) {
            return res.status(403).json({ error: 'TTS audio does not match message.' });
        }
        const audioPath = dependencies.resolveTtsAudioPath(req.user.id, row.audio_path);
        if (!audioPath) {
            return res.status(404).json({ error: 'TTS audio not found.' });
        }
        if (!dependencies.fs.existsSync(audioPath)) {
            return res.status(404).json({ error: 'TTS audio file is missing.' });
        }
        res.setHeader('Content-Type', dependencies.sanitizeTtsMimeType(row.mime_type));
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.sendFile(audioPath);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
