// POST /api/transfer
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/transfer', require("../../../platform/http/trace.js").traceHttp("economy", "POST /api/transfer"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const { characterId, amount, note } = req.body;
        if (!characterId) return res.status(400).json({ error: 'Missing characterId' });

        const char = db.getCharacter(characterId);
        if (!char) return res.status(404).json({ error: 'Character not found' });

        // Create traceable transfer record in DB (deducts user wallet)
        const transferAmount = dependencies.normalizePositiveMoney(amount);
        if (!transferAmount) return res.status(400).json({ error: 'Invalid amount' });
        const transferNote = dependencies.normalizePaymentNote(note, 'Transfer');
        if (transferNote === null) return res.status(400).json({ error: 'Invalid note' });
        let tid;
        try {
            tid = db.createTransfer({
                charId: characterId,
                senderId: 'user',
                recipientId: characterId,
                amount: transferAmount,
                note: transferNote,
                messageId: null
            });
        } catch (e) {
            return res.status(400).json({ error: e.message });
        }

        // Add user transfer message to DB
        const transferText = `[TRANSFER]${tid}|${transferAmount}|${transferNote}`;
        const { id: msgId, timestamp: msgTs } = db.addMessage(characterId, 'user', transferText);
        const savedMessage = { id: msgId, character_id: characterId, role: 'user', content: transferText, timestamp: msgTs };

        // Broadcast wallet update for user
        engine.broadcastWalletSync(wsClients, characterId);

        // Unblock them and reset pressure
        db.updateCharacter(characterId, {
            is_blocked: 0,
            pressure_level: 0,
            last_user_msg_time: msgTs
        });

        // Tell the engine to process the unblock reaction
        engine.handleUserMessage(characterId, wsClients, {
            triggerSource: 'transfer_unblock',
            triggerRoute: 'POST /api/characters/:characterId/transfer',
            requestId: dependencies.createRequestTraceId('unblock'),
            triggerNote: 'transfer unblocked character'
        });

        // Push user message to UI via WS
        engine.broadcastNewMessage?.(wsClients, savedMessage);

        res.json({ success: true, unblocked: true, message: savedMessage });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
