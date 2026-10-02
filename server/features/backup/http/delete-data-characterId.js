// DELETE /api/data/:characterId
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.delete('/api/data/:characterId', require("../../../platform/http/trace.js").traceHttp("backup", "DELETE /api/data/:characterId"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const id = req.params.characterId;
        const char = db.getCharacter(id);
        if (!char) return res.status(404).json({ error: 'Character not found' });

        // Stop the engine timer first to minimize the race-condition window.
        engine.stopTimer(id);

        // Clear all data
        db.clearMessages(id);
        db.clearCharacterMessageCaches?.(id);
        db.clearMemories(id);
        db.clearDiaries(id);
        db.clearFriends(id);
        db.clearCharRelationships(id); // Also wipe inter-char social bonds
        db.clearTransfers(id);         // Wipe all private transfers (sent & received)
        if (db.city && typeof db.city.clearCharacterCityData === 'function') {
            db.city.clearCharacterCityData(id);
        }
        await memory.wipeIndex(id);

        // Reset core emotional stats, wallet, AND diary lock state
        const resetAffinity = char?.initial_affinity ?? 50;

        db.updateCharacter(id, {
            affinity: resetAffinity,
            pressure_level: 0,
            is_blocked: 0,
            is_diary_unlocked: 0,
            wallet: 200,
            calories: 2000,
            city_status: 'idle',
            location: 'home',
            diary_password: null,
            hidden_state: '',
            jealousy_level: 0,
            jealousy_target: ''
        });
        // Immediately assign a fresh diary password
        const newPw = String(Math.floor(1000 + Math.random() * 9000));
        db.setDiaryPassword(id, newPw);

        // Add wipe notice (engine's anti-wipe check looks for this message)
        db.addMessage(id, 'system', '[System] All chat history, long-term memories, extracted vectors, and diary have been completely wiped. This character is now a blank slate.');

        // Restart the character's engine timer so they resume proactive messaging
        engine.handleUserMessage(id, wsClients, {
            triggerSource: 'deep_wipe_reset',
            triggerRoute: 'DELETE /api/characters/:id/deep-wipe',
            requestId: dependencies.createRequestTraceId('wipe'),
            triggerNote: 'deep wipe follow-up'
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
