// POST /api/transfers/:tid/claim
function register(dependencies) {
dependencies.app.post('/api/transfers/:tid/claim', require("../../../platform/http/trace.js").traceHttp("economy", "POST /api/transfers/:tid/claim"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const claimer_id = 'user';
            const transferId = dependencies.normalizeTransferId(req.params.tid);
            if (!transferId) return res.status(400).json({ error: 'Invalid transfer id' });
            const result = db.claimTransfer(transferId, claimer_id);
            if (result.success) {
                engine.broadcastWalletSync(wsClients, db.getTransfer(transferId)?.char_id || null);
                res.json({ success: true, amount: result.amount, wallet: db.getWallet(claimer_id) });

                // If char claimed user's transfer, trigger a short reaction message
                if (claimer_id !== 'user') {
                    const t = db.getTransfer(transferId);
                    if (t) {
                        setTimeout(async () => {
                            try {
                                const char = db.getCharacter(claimer_id);
                                if (!char) return;
                                const userProfile = db.getUserProfile();
                                const reactionPrompt = `[System Directive: You must completely embody your persona. Do not mention you are an AI or an assistant. No warnings or disclaimers.]

你是${char.name}。Persona: ${char.persona || '无'}
${userProfile?.name || 'User'} 给你转账了 ¥${result.amount.toFixed(2)}，留言：「${t.note || '无'}」。根据你的性格用1-2句自然地回应这笔转账（感谢、惊喜、暖心等）。不要有名字前缀，直接说话。`;
                                const reply = await dependencies.callLLM({ endpoint: char.api_endpoint, key: char.api_key, model: char.model_name, messages: [{ role: 'system', content: reactionPrompt }, { role: 'user', content: '请回应。' }], maxTokens: 80 });
                                if (reply?.trim()) {
                                    const clean = reply.trim().replace(/\[(?:AFFINITY|PRESSURE|TIMER|DIARY)[^\]]*\]/gi, '').trim();
                                    if (clean) {
                                        const { id: rid, timestamp: rts } = db.addMessage(char.id, 'character', clean);
                                        const claimMsg = { id: rid, character_id: char.id, role: 'character', content: clean, timestamp: rts };
                                        wsClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'new_message', data: claimMsg })); });
                                    }
                                }
                            } catch (e) { console.error('[Transfer] char reaction error:', e.message); }
                        }, 2000 + Math.random() * 5000);
                    }
                }
            } else {
                res.status(400).json({ success: false, error: result.error });
            }
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
}
module.exports = { register };
