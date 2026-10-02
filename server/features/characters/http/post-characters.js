// POST /api/characters
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/characters', require("../../../platform/http/trace.js").traceHttp("characters", "POST /api/characters"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const data = req.body || {};
        if (!data.id || !data.name) return res.status(400).json({ error: 'Missing ID or Name' });
        const prevCharacter = typeof db.getCharacter === 'function' ? db.getCharacter(data.id) : null;
        const characterPatch = dependencies.preserveExistingSecretFields(data, prevCharacter, dependencies.CHARACTER_SECRET_FIELDS);
        if (!prevCharacter) {
            if (!String(characterPatch.memory_api_endpoint || '').trim()) {
                characterPatch.memory_api_endpoint = characterPatch.api_endpoint || '';
            }
            if (!String(characterPatch.memory_api_key || '').trim()) {
                characterPatch.memory_api_key = characterPatch.api_key || '';
            }
            if (!String(characterPatch.memory_model_name || '').trim()) {
                characterPatch.memory_model_name = characterPatch.model_name || '';
            }
        }

        db.updateCharacter(data.id, characterPatch);
        // Changing S only changes future batch size; keep summaries/baseline so failed pending messages stay pending.
        if (prevCharacter && Object.prototype.hasOwnProperty.call(characterPatch, 'context_msg_limit')) {
            const prevLimit = Number(prevCharacter.context_msg_limit ?? 60);
            const nextLimit = Number(characterPatch.context_msg_limit ?? prevLimit);
            if (prevLimit !== nextLimit) {
                db.clearConversationDigest?.(characterPatch.id);
                const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
                rawDb?.prepare('DELETE FROM history_window_cache WHERE character_id = ?').run(characterPatch.id);
                rawDb?.prepare('DELETE FROM private_context_summaries WHERE character_id = ?').run(characterPatch.id);
                const nextCharacter = typeof db.getCharacter === 'function' ? db.getCharacter(characterPatch.id) : null;
                const rawWindow = Math.max(0, Number(nextCharacter?.context_msg_limit ?? 60) || 0);
                const visibleMessages = db.getVisibleMessages(data.id, 0) || [];
                const overflowMessages = rawWindow > 0 ? visibleMessages.slice(0, Math.max(0, visibleMessages.length - rawWindow)) : visibleMessages;
                db.updateCharacter(characterPatch.id, { private_summary_baseline_message_id: Number(overflowMessages[overflowMessages.length - 1]?.id || 0) });
            }
        }
        // Reset proactive timer after settings change. Do NOT call handleUserMessage here;
        // that would echo the character's own last message back to the AI as user input.
        engine.stopTimer(characterPatch.id);

        res.json({ success: true, character: dependencies.redactSecretFields(db.getCharacter(characterPatch.id), dependencies.CHARACTER_SECRET_FIELDS) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
