// POST /api/tts/preview/:characterId
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/tts/preview/:characterId', require("../../../platform/http/trace.js").traceHttp("speech", "POST /api/tts/preview/:characterId"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    try {
        const character = db.getCharacter(req.params.characterId);
        if (!character) return res.status(404).json({ error: 'Character not found.' });
        const overrides = req.body?.config && typeof req.body.config === 'object' ? req.body.config : req.body || {};
        const enabled = overrides.tts_enabled !== undefined ? Number(overrides.tts_enabled || 0) === 1 : Number(character.tts_enabled || 0) === 1;
        if (!enabled) {
            return res.status(400).json({ error: 'TTS is not enabled for this character.' });
        }
        const pickTtsOverride = (field) => {
            if (!Object.prototype.hasOwnProperty.call(overrides, field)) return character[field];
            const value = overrides[field];
            if (typeof value === 'string' && !value.trim()) return character[field];
            return value ?? character[field];
        };
        const previewCharacter = {
            ...character,
            tts_provider: pickTtsOverride('tts_provider'),
            tts_api_key: pickTtsOverride('tts_api_key'),
            tts_voice: pickTtsOverride('tts_voice'),
            tts_model: pickTtsOverride('tts_model'),
            tts_endpoint: pickTtsOverride('tts_endpoint')
        };
        const text = String(req.body?.text || `你好，我是${character.name || '这个角色'}。这是一段试听。`).trim().slice(0, 160);
        const audio = await dependencies.synthesizeSpeech({
            character: previewCharacter,
            text,
            intent: { style: 'preview', reason: 'settings preview', priority: 1 }
        });
        res.setHeader('Content-Type', audio.mimeType || 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.send(audio.buffer);
    } catch (e) {
        res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message });
    }
});
}
module.exports = { register };
