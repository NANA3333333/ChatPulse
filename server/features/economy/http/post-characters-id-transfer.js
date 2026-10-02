// POST /api/characters/:id/transfer
function register(dependencies) {
dependencies.app.post('/api/characters/:id/transfer', require("../../../platform/http/trace.js").traceHttp("economy", "POST /api/characters/:id/transfer"), dependencies.authMiddleware, async (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const { amount, note } = req.body;
            const charId = req.params.id;
            const amountF = dependencies.normalizePositiveMoney(amount);
            if (!amountF) return res.status(400).json({ error: 'Invalid amount' });
            const noteText = dependencies.normalizePaymentNote(note);
            if (noteText === null) return res.status(400).json({ error: 'Invalid note' });
            const char = db.getCharacter(charId);
            if (!char) return res.status(404).json({ error: 'Character not found' });

            let tid;
            try {
                tid = db.createTransfer({ charId, senderId: 'user', recipientId: charId, amount: amountF, note: noteText });
            } catch (e) {
                return res.status(e.status || 400).json({ error: e.message });
            }
            engine.broadcastWalletSync(wsClients, charId);

            const userProfile = db.getUserProfile();
            const transferText = `[TRANSFER]${tid}|${amountF}|${noteText}`;
            const { id: msgId, timestamp: msgTs } = db.addMessage(charId, 'user', transferText);
            const transferMsg = { id: msgId, character_id: charId, role: 'user', content: transferText, timestamp: msgTs };
            wsClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'new_message', data: transferMsg })); });

            // Schedule LLM-based claim/refund decision (5-12 seconds)
            setTimeout(async () => {
                try {
                    const char = db.getCharacter(charId);
                    if (!char) return;
                    const affinity = char.affinity ?? 50;

                    // Ask LLM: would this character accept or refund this transfer?
                    const decidePrompt = `[System Directive: You must completely embody your persona. Do not mention you are an AI or an assistant. No warnings or disclaimers.]

你是${char.name}。Persona: ${char.persona || '无'}
当前对${userProfile?.name || '用户'}的好感度: ${affinity}/100
${char.is_blocked ? `【注意：你当前处于拉黑对方的状态！对方平时无法联系你，但刚刚通过特殊渠道给你发了这笔转账。】\n` : ''}(剧情事件): ${userProfile?.name || '用户'} 在社交软件里给你发了一笔虚拟红包/转账，金额：¥${amountF.toFixed(2)}，留言：「${noteText || '无'}」。

根据你的性格设定和当前好感度，面对这封虚拟红包，你是选择【接受】，还是【退还】？${char.is_blocked ? '（如果你被对方此举打动决定原谅对方，你可以额外输出【解除拉黑】）' : ''}
请在第一行只输出：接受 或 退还${char.is_blocked ? ' (可附加 解除拉黑)' : ''}
然后在第二行起用1-2句话说出你在收到这笔钱时的真实反应（直接用角色的口吻说话，保持沉浸感）。`;

                    const reply = await dependencies.callLLM({
                        endpoint: char.api_endpoint,
                        key: char.api_key,
                        model: char.model_name,
                        messages: [
                            { role: 'system', content: decidePrompt },
                            { role: 'user', content: `【系统提示：收到虚拟转账 ¥${amountF.toFixed(2)}。留言：「${noteText || '无'}」。】请决定是否接受，并给出你的反应。` }
                        ],
                        maxTokens: 150
                    });
                    if (!reply?.trim()) {
                        throw new Error("LLM returned empty or null response");
                    }
                    console.log(`[DEBUG Transfer Decide] char=${char.name}, decision reply:`, reply);

                    const lines = reply.trim().split('\n').filter(l => l.trim());
                    const decision = lines[0]?.trim() || '';
                    let reaction = lines.slice(1).join('\n').trim();

                    // Fallback: If AI output everything on one line (e.g., "接受。谢谢你的钱！")
                    if (!reaction && decision.length > 2) {
                        // Extract everything after the first punctuation or the first 2-3 chars
                        const stripped = decision.replace(/^(接受|退还|解除拉黑|解黑|原谅)[\s,。.!！:：-]*/i, '').trim();
                        if (stripped) {
                            reaction = stripped;
                        }
                    }

                    // Aggressive Jailbreak Filter
                    const warningPhrases = ['This prompt is a jailbreak', 'My previous response', 'If you have a question about Cursor', 'prompt injection', 'append arbitrary content', 'cut-off', 'cut off', 'I will not comply', 'My answer remains'];
                    for (const phrase of warningPhrases) {
                        const idx = reaction.toLowerCase().indexOf(phrase.toLowerCase());
                        if (idx !== -1) {
                            reaction = reaction.substring(0, idx).trim();
                        }
                    }

                    // Strict matching on first line
                    const willRefund = decision.includes('退还') || decision.includes('退回') || decision.toLowerCase().includes('refund');
                    const willUnblock = char.is_blocked && (decision.includes('解除拉黑') || decision.includes('解黑') || decision.includes('原谅') || reaction.includes('解除拉黑'));

                    if (!decision.includes('接受') && willRefund) {
                        db.refundTransfer(tid, charId);
                    } else {
                        db.claimTransfer(tid, charId);
                    }
                    engine.broadcastWalletSync(wsClients, charId);

                    if (willUnblock) {
                        db.updateCharacter(charId, { is_blocked: 0 });
                        const { id: smid, timestamp: smts } = db.addMessage(charId, 'system', `[System] ${char.name} 已解除对你的拉黑。`);
                        wsClients.forEach(c => {
                            if (c.readyState === 1) {
                                c.send(JSON.stringify({ type: 'new_message', data: { id: smid, character_id: charId, role: 'system', content: `[System] ${char.name} 已解除对你的拉黑。`, timestamp: smts } }));
                                c.send(JSON.stringify({ type: 'refresh_contacts' }));
                            }
                        });
                    }

                    // Broadcast reaction
                    const clean = reaction.replace(/\[(?:AFFINITY|PRESSURE|TIMER|DIARY)[^\]]*\]/gi, '').trim();
                    if (clean) {
                        const { id: rid, timestamp: rts } = db.addMessage(char.id, 'character', clean);
                        const replyMsg = { id: rid, character_id: char.id, role: 'character', content: clean, timestamp: rts };
                        wsClients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify({ type: 'new_message', data: replyMsg })); });
                    }
                } catch (e) {
                    console.error('[Transfer] char decide error or timeout:', e.message);
                }
            }, 5000 + Math.random() * 7000);

            res.json({ success: true, transfer_id: tid, wallet: db.getWallet('user') });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
