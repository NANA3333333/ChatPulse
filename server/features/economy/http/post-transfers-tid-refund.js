// POST /api/transfers/:tid/refund
function register(dependencies) {
dependencies.app.post('/api/transfers/:tid/refund', require("../../../platform/http/trace.js").traceHttp("economy", "POST /api/transfers/:tid/refund"), dependencies.authMiddleware, async (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const refunder_id = 'user';
            const tid = dependencies.normalizeTransferId(req.params.tid);
            if (!tid) return res.status(400).json({ error: 'Invalid transfer id' });
            const t = db.getTransfer(tid);
            if (!t) return res.status(404).json({ error: 'Transfer not found' });

            const result = db.refundTransfer(tid, refunder_id);
            if (!result.success) return res.status(400).json({ success: false, error: result.error });

            engine.broadcastWalletSync(wsClients, t.char_id);
            res.json({ success: true, amount: result.amount, wallet: db.getWallet(t.sender_id) });

            // Trigger char reaction to refund (ENHANCED: time elapsed + conversation context)
            const charId = t.char_id;
            const char = db.getCharacter(charId);
            if (!char) return;

            setTimeout(async () => {
                try {
                    const userProfile = db.getUserProfile();
                    const userName = userProfile?.name || 'User';

                    // Calculate how long ago the transfer was sent
                    const elapsedMs = Date.now() - (t.created_at || Date.now());
                    const elapsedMins = Math.round(elapsedMs / 60000);
                    let timeAgoStr;
                    if (elapsedMins < 2) timeAgoStr = '刚才';
                    else if (elapsedMins < 60) timeAgoStr = `${elapsedMins}分钟前`;
                    else if (elapsedMins < 1440) timeAgoStr = `${Math.round(elapsedMins / 60)}小时前`;
                    else timeAgoStr = `${Math.round(elapsedMins / 1440)}天前`;

                    // Get recent conversation context so the reaction feels natural
                    const recentMsgs = db.getVisibleMessages(charId, 5);
                    const recentContext = recentMsgs.map(m => `${m.role === 'user' ? userName : char.name}: ${m.content.substring(0, 60)}`).join('\n');

                    let reactionPrompt;
                    if (refunder_id === 'user') {
                        // User refunded char's transfer back to char
                        reactionPrompt = `[System Directive: You must completely embody your persona. Do not mention you are an AI or an assistant. No warnings or disclaimers.]

你是${char.name}。Persona: ${char.persona || '无'}
你在${timeAgoStr}给 ${userName} 发了一笔 ¥${result.amount.toFixed(2)} 的转账，留言「${t.note || '无'}」，但对方刚刚把转账退还给你了。

最近的对话：
${recentContext || '（无）'}

根据你的性格和最近对话的语境，用1-2句话自然地回应被退款这件事（可能是失落、不解、理解、尴尬、故作无所谓、生气等）。注意要结合上下文语境，不要突兀。直接说话，不要有名字前缀。`;
                    } else {
                        // Char refunded user's transfer back to user
                        reactionPrompt = `[System Directive: You must completely embody your persona. Do not mention you are an AI or an assistant. No warnings or disclaimers.]

你是${char.name}。Persona: ${char.persona || '无'}
${userName} 在${timeAgoStr}给你转账了 ¥${result.amount.toFixed(2)}，留言「${t.note || '无'}」，你选择退还了这笔钱。

最近的对话：
${recentContext || '（无）'}

用1-2句话说说退还的理由（可能是骄傲、不想欠人情、感觉奇怪等），要结合上下文语境。直接说话，不要有名字前缀。`;
                    }
                    const reply = await dependencies.callLLM({ endpoint: char.api_endpoint, key: char.api_key, model: char.model_name, messages: [{ role: 'system', content: reactionPrompt }, { role: 'user', content: '请回应。' }], maxTokens: 100 });
                    if (reply?.trim()) {
                        const clean = reply.trim().replace(/\[(?:AFFINITY|PRESSURE|TIMER|DIARY)[^\]]*\]/gi, '').trim();
                        if (clean) {
                            const { id: rid, timestamp: rts } = db.addMessage(char.id, 'character', clean);
                            const reactionMsg = { id: rid, character_id: char.id, role: 'character', content: clean, timestamp: rts };
                            wsClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'new_message', data: reactionMsg })); });
                        }
                    }
                } catch (e) { console.error('[Transfer] refund reaction error:', e.message); }
            }, 1500 + Math.random() * 3000);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
}
module.exports = { register };
