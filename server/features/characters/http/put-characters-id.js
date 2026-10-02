// PUT /api/characters/:id
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.put('/api/characters/:id', require("../../../platform/http/trace.js").traceHttp("characters", "PUT /api/characters/:id"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    const memory = req.memory;
    try {
        const id = req.params.id;
        const data = req.body || {};
        if (!id) return res.status(400).json({ error: 'Missing ID' });
        const prevCharacter = typeof db.getCharacter === 'function' ? db.getCharacter(id) : null;
        if (!prevCharacter) return res.status(404).json({ error: 'Character not found' });
        const characterPatch = dependencies.preserveExistingSecretFields(data, prevCharacter, dependencies.CHARACTER_SECRET_FIELDS);

        db.updateCharacter(id, characterPatch);
        // Changing S only changes future batch size; keep summaries/baseline so failed pending messages stay pending.
        if (prevCharacter && Object.prototype.hasOwnProperty.call(characterPatch, 'context_msg_limit')) {
            const prevLimit = Number(prevCharacter.context_msg_limit ?? 60);
            const nextLimit = Number(characterPatch.context_msg_limit ?? prevLimit);
            if (prevLimit !== nextLimit) {
                db.clearConversationDigest?.(id);
                const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
                rawDb?.prepare('DELETE FROM history_window_cache WHERE character_id = ?').run(id);
                rawDb?.prepare('DELETE FROM private_context_summaries WHERE character_id = ?').run(id);
                const nextCharacter = typeof db.getCharacter === 'function' ? db.getCharacter(id) : null;
                const rawWindow = Math.max(0, Number(nextCharacter?.context_msg_limit ?? 60) || 0);
                const visibleMessages = db.getVisibleMessages(id, 0) || [];
                const overflowMessages = rawWindow > 0 ? visibleMessages.slice(0, Math.max(0, visibleMessages.length - rawWindow)) : visibleMessages;
                db.updateCharacter(id, { private_summary_baseline_message_id: Number(overflowMessages[overflowMessages.length - 1]?.id || 0) });
            }
        }
        res.json({ success: true, character: dependencies.redactSecretFields(db.getCharacter(id), dependencies.CHARACTER_SECRET_FIELDS) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
