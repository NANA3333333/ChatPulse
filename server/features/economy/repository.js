// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeTransferAmount(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('转账金额无效');
        const rounded = +amount.toFixed(2);
        if (!Number.isFinite(rounded) || rounded <= 0) throw new Error('转账金额无效');
        return rounded;
    }

function normalizePaymentNote(value) {
        if (value === undefined || value === null) return '';
        if (typeof value !== 'string') {
            const error = new Error('备注无效');
            error.status = 400;
            throw error;
        }
        return value.trim().slice(0, 120);
    }

function createTransfer({ charId, senderId, recipientId, amount, note, messageId }) {
        const transferAmount = normalizeTransferAmount(amount);
        const safeNote = normalizePaymentNote(note);
        const cleanCharId = String(charId || '').trim();
        const cleanSenderId = String(senderId || '').trim();
        const cleanRecipientId = String(recipientId || '').trim();
        if (!cleanCharId || !dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(cleanCharId)) {
            throw new Error('角色不存在');
        }
        if (!cleanSenderId || !cleanRecipientId) throw new Error('转账参与方无效');
        if (cleanSenderId !== 'user' && !dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(cleanSenderId)) {
            throw new Error('付款方不存在');
        }
        if (cleanRecipientId !== 'user' && !dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(cleanRecipientId)) {
            throw new Error('收款方不存在');
        }
        if (cleanSenderId !== 'user' && cleanSenderId !== cleanCharId && cleanRecipientId !== cleanCharId) {
            throw new Error('转账角色无效');
        }
        if (cleanSenderId === 'user' && cleanRecipientId !== cleanCharId) {
            throw new Error('转账角色无效');
        }
        // Deduct from sender wallet
        if (cleanSenderId === 'user') {
            const profile = dependencies.db.prepare('SELECT wallet FROM user_profile WHERE id = ?').get('default');
            const bal = profile?.wallet ?? 520;
            if (bal < transferAmount) throw new Error('余额不足');
            dependencies.db.prepare('UPDATE user_profile SET wallet = ? WHERE id = ?').run(+(bal - transferAmount).toFixed(2), 'default');
        } else {
            const char = dependencies.db.prepare('SELECT wallet FROM characters WHERE id = ?').get(cleanSenderId);
            const bal = char?.wallet ?? 0;
            if (bal < transferAmount) throw new Error('余额不足');
            dependencies.db.prepare('UPDATE characters SET wallet = ? WHERE id = ?').run(+(bal - transferAmount).toFixed(2), cleanSenderId);
        }
        const info = dependencies.db.prepare(
            'INSERT INTO private_transfers (char_id, sender_id, recipient_id, amount, note, claimed, message_id, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
        ).run(cleanCharId, cleanSenderId, cleanRecipientId, transferAmount, safeNote, messageId ?? null, Date.now());
        return info.lastInsertRowid;
    }

function getTransfer(transferId) {
        return dependencies.db.prepare('SELECT * FROM private_transfers WHERE id = ?').get(transferId);
    }

function claimTransfer(transferId, claimerId) {
        const t = dependencies.db.prepare('SELECT * FROM private_transfers WHERE id = ?').get(transferId);
        if (!t) return { success: false, error: '转账不存在' };
        if (t.claimed) return { success: false, error: '已经领取过了' };
        if (t.refunded) return { success: false, error: '已退还' };
        const cleanClaimerId = String(claimerId || '').trim();
        if (!cleanClaimerId) return { success: false, error: '收款方无效' };
        if (t.recipient_id !== cleanClaimerId) return { success: false, error: '不是这笔转账的收款方' };
        if (cleanClaimerId !== 'user' && !dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(cleanClaimerId)) {
            return { success: false, error: '收款方不存在' };
        }
        let transferAmount;
        try {
            transferAmount = normalizeTransferAmount(t.amount);
        } catch (e) {
            return { success: false, error: e.message };
        }

        dependencies.db.prepare('UPDATE private_transfers SET claimed = 1, claimed_at = ? WHERE id = ?').run(Date.now(), transferId);

        // Credit to recipient
        if (cleanClaimerId === 'user') {
            const profile = dependencies.db.prepare('SELECT wallet FROM user_profile WHERE id = ?').get('default');
            const bal = profile?.wallet ?? 520;
            dependencies.db.prepare('UPDATE user_profile SET wallet = ? WHERE id = ?').run(+(bal + transferAmount).toFixed(2), 'default');
        } else {
            const char = dependencies.db.prepare('SELECT wallet FROM characters WHERE id = ?').get(cleanClaimerId);
            const bal = char?.wallet ?? 0;
            dependencies.db.prepare('UPDATE characters SET wallet = ? WHERE id = ?').run(+(bal + transferAmount).toFixed(2), cleanClaimerId);
        }
        return { success: true, amount: transferAmount };
    }

function getUnclaimedTransfersFrom(senderId, charId) {
        return dependencies.db.prepare(
            'SELECT * FROM private_transfers WHERE sender_id = ? AND char_id = ? AND claimed = 0 AND refunded = 0 AND created_at > ? ORDER BY created_at DESC'
        ).all(senderId, charId, Date.now() - 24 * 60 * 60 * 1000); // last 24h
    }

function refundTransfer(transferId, refunderId) {
        const t = dependencies.db.prepare('SELECT * FROM private_transfers WHERE id = ?').get(transferId);
        if (!t) return { success: false, error: '转账不存在' };
        if (t.refunded) return { success: false, error: '已经退还过了' };
        const cleanRefunderId = String(refunderId || '').trim();
        if (!cleanRefunderId) return { success: false, error: '退款方无效' };
        if (cleanRefunderId !== 'user' && !dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(cleanRefunderId)) {
            return { success: false, error: '退款方不存在' };
        }
        // Allow sender to refund anytime if still pending, allow recipient to refund anytime
        const canRefund = (cleanRefunderId === t.sender_id && !t.claimed) || (cleanRefunderId === t.recipient_id);
        if (!canRefund) return { success: false, error: '无权退还' };
        let transferAmount;
        try {
            transferAmount = normalizeTransferAmount(t.amount);
        } catch (e) {
            return { success: false, error: e.message };
        }
        if (t.sender_id !== 'user' && !dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(t.sender_id)) {
            return { success: false, error: '付款方不存在' };
        }
        if (t.recipient_id !== 'user' && !dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(t.recipient_id)) {
            return { success: false, error: '收款方不存在' };
        }
        // A claimed transfer can only be returned if the recipient can repay it in full.
        // Validate before changing either the transfer state or either wallet.
        if (t.claimed && getWallet(t.recipient_id) < transferAmount) {
            return { success: false, error: '余额不足，无法退还已领取的转账' };
        }

        dependencies.db.prepare('UPDATE private_transfers SET refunded = 1, claimed = 0 WHERE id = ?').run(transferId);

        // Return money to original sender
        if (t.sender_id === 'user') {
            const profile = dependencies.db.prepare('SELECT wallet FROM user_profile WHERE id = ?').get('default');
            const bal = profile?.wallet ?? 520;
            dependencies.db.prepare('UPDATE user_profile SET wallet = ? WHERE id = ?').run(+(bal + transferAmount).toFixed(2), 'default');
        } else {
            const char = dependencies.db.prepare('SELECT wallet FROM characters WHERE id = ?').get(t.sender_id);
            const bal = char?.wallet ?? 0;
            dependencies.db.prepare('UPDATE characters SET wallet = ? WHERE id = ?').run(+(bal + transferAmount).toFixed(2), t.sender_id);
        }
        // If the recipient had already claimed, also deduct from their wallet
        if (t.claimed) {
            if (t.recipient_id === 'user') {
                const profile = dependencies.db.prepare('SELECT wallet FROM user_profile WHERE id = ?').get('default');
                const bal = profile?.wallet ?? 0;
                dependencies.db.prepare('UPDATE user_profile SET wallet = ? WHERE id = ?').run(+(bal - transferAmount).toFixed(2), 'default');
            } else {
                const char = dependencies.db.prepare('SELECT wallet FROM characters WHERE id = ?').get(t.recipient_id);
                const bal = char?.wallet ?? 0;
                dependencies.db.prepare('UPDATE characters SET wallet = ? WHERE id = ?').run(+(bal - transferAmount).toFixed(2), t.recipient_id);
            }
        }
        return { success: true, amount: transferAmount, senderId: t.sender_id };
    }

function generateLuckyAmounts(total, count) {
        const totalCents = Math.round(Number(total) * 100);
        if (!Number.isSafeInteger(totalCents) || totalCents < count) {
            throw new Error('红包金额不足以分配');
        }
        const amounts = [];
        let remaining = totalCents; // work in cents to avoid float issues
        for (let i = 0; i < count - 1; i++) {
            const maxCents = Math.floor(remaining * 2 / (count - i));
            const cents = Math.max(1, Math.floor(Math.random() * maxCents) + 1);
            const safe = Math.min(cents, remaining - (count - i - 1));
            amounts.push(safe);
            remaining -= safe;
        }
        amounts.push(remaining);
        // Fisher-Yates shuffle
        for (let i = amounts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [amounts[i], amounts[j]] = [amounts[j], amounts[i]];
        }
        return amounts.map(c => +(c / 100).toFixed(2));
    }

function normalizeRedPacketCount(value) {
        const text = String(value ?? '').trim();
        if (!/^\d+$/.test(text)) return null;
        const parsed = Number(text);
        return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : null;
    }

function createRedPacket({ groupId, senderId, type, totalAmount, perAmount, count, note }) {
        const packetType = String(type || '').trim().toLowerCase();
        const packetCount = normalizeRedPacketCount(count);
        const packetTotal = Number(totalAmount);
        const packetPerAmount = perAmount == null ? null : Number(perAmount);
        const safeNote = normalizePaymentNote(note);
        if (!['fixed', 'lucky'].includes(packetType)) throw new Error('红包类型无效');
        if (!Number.isFinite(packetTotal) || packetTotal <= 0) throw new Error('红包金额无效');
        if (packetCount == null) throw new Error('红包个数无效');
        if (packetType === 'fixed' && (!Number.isFinite(packetPerAmount) || packetPerAmount <= 0)) throw new Error('红包金额无效');
        const packetTotalCents = Math.round(packetTotal * 100);
        if (!Number.isSafeInteger(packetTotalCents) || packetTotalCents < packetCount) throw new Error('红包金额不足以分配');
        const cleanGroupId = String(groupId || '').trim();
        const cleanSenderId = String(senderId || '').trim();
        const groupExists = dependencies.db.prepare('SELECT 1 FROM group_chats WHERE id = ? LIMIT 1').get(cleanGroupId);
        if (!groupExists) throw new Error('群聊不存在');
        if (!cleanSenderId) throw new Error('红包发送者无效');
        if (cleanSenderId !== 'user') {
            const senderExists = dependencies.db.prepare('SELECT 1 FROM characters WHERE id = ? LIMIT 1').get(cleanSenderId);
            if (!senderExists) throw new Error('红包发送者不存在');
            const senderIsMember = dependencies.db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND member_id = ? LIMIT 1').get(cleanGroupId, cleanSenderId);
            if (!senderIsMember) throw new Error('红包发送者不在群聊中');
        }
        const normalizedTotal = +(packetTotalCents / 100).toFixed(2);
        let normalizedPerAmount = null;
        if (packetType === 'fixed') {
            const packetPerCents = Math.round(packetPerAmount * 100);
            if (!Number.isSafeInteger(packetPerCents) || packetPerCents < 1) throw new Error('红包金额无效');
            if (packetPerCents * packetCount !== packetTotalCents) throw new Error('红包金额无效');
            normalizedPerAmount = +(packetPerCents / 100).toFixed(2);
        }

        // Deduct from sender wallet
        if (cleanSenderId === 'user') {
            const profile = dependencies.db.prepare('SELECT wallet FROM user_profile WHERE id = ?').get('default');
            const bal = profile?.wallet ?? 520;
            if (bal < normalizedTotal) throw new Error('余额不足');
            dependencies.db.prepare('UPDATE user_profile SET wallet = ? WHERE id = ?').run(+(bal - normalizedTotal).toFixed(2), 'default');
        } else {
            const char = dependencies.db.prepare('SELECT wallet FROM characters WHERE id = ?').get(cleanSenderId);
            const bal = char?.wallet ?? 0;
            if (bal < normalizedTotal) throw new Error('余额不足');
            dependencies.db.prepare('UPDATE characters SET wallet = ? WHERE id = ?').run(+(bal - normalizedTotal).toFixed(2), cleanSenderId);
        }

        // Pre-generate amounts
        let amounts;
        if (packetType === 'lucky') {
            amounts = generateLuckyAmounts(normalizedTotal, packetCount);
        } else {
            const each = normalizedPerAmount ?? +(normalizedTotal / packetCount).toFixed(2);
            amounts = Array(packetCount).fill(each);
        }

        const info = dependencies.db.prepare(
            'INSERT INTO group_red_packets (group_id, sender_id, type, total_amount, per_amount, count, remaining_count, amounts, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(cleanGroupId, cleanSenderId, packetType, normalizedTotal, normalizedPerAmount, packetCount, packetCount, JSON.stringify(amounts), safeNote, Date.now());
        return info.lastInsertRowid;
    }

function getRedPacket(packetId) {
        const pkt = dependencies.db.prepare('SELECT * FROM group_red_packets WHERE id = ?').get(packetId);
        if (!pkt) return null;
        pkt.amounts = JSON.parse(pkt.amounts);
        pkt.claims = dependencies.db.prepare('SELECT * FROM group_red_packet_claims WHERE packet_id = ? ORDER BY claimed_at ASC').all(packetId);
        return pkt;
    }

function claimRedPacket(packetId, claimerId, groupId = null) {
        const pkt = dependencies.db.prepare('SELECT * FROM group_red_packets WHERE id = ?').get(packetId);
        if (!pkt) return { success: false, error: '红包不存在' };
        if (groupId !== null && String(pkt.group_id) !== String(groupId)) return { success: false, error: '红包不存在' };
        if (pkt.remaining_count <= 0) return { success: false, error: '红包已被抢光' };

        const already = dependencies.db.prepare('SELECT id FROM group_red_packet_claims WHERE packet_id = ? AND claimer_id = ?').get(packetId, claimerId);
        if (already) return { success: false, error: '你已经领过了' };

        // Pick next available amount (in order, pre-shuffled)
        const claimedCount = pkt.count - pkt.remaining_count;
        const amounts = JSON.parse(pkt.amounts);
        const amount = amounts[claimedCount];
        if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            return { success: false, error: '红包金额异常' };
        }

        // Atomic update
        dependencies.db.prepare('UPDATE group_red_packets SET remaining_count = remaining_count - 1 WHERE id = ?').run(packetId);
        dependencies.db.prepare('INSERT INTO group_red_packet_claims (packet_id, claimer_id, amount, claimed_at) VALUES (?, ?, ?, ?)').run(packetId, claimerId, amount, Date.now());

        // Credit to claimer wallet
        if (claimerId === 'user') {
            const profile = dependencies.db.prepare('SELECT wallet FROM user_profile WHERE id = ?').get('default');
            const bal = profile?.wallet ?? 520;
            dependencies.db.prepare('UPDATE user_profile SET wallet = ? WHERE id = ?').run(+(bal + amount).toFixed(2), 'default');
        } else {
            const char = dependencies.db.prepare('SELECT wallet FROM characters WHERE id = ?').get(claimerId);
            const bal = char?.wallet ?? 0;
            dependencies.db.prepare('UPDATE characters SET wallet = ? WHERE id = ?').run(+(bal + amount).toFixed(2), claimerId);
        }

        return { success: true, amount };
    }

function getUnclaimedRedPacketsForGroup(groupId, claimerId) {
        const packets = dependencies.db.prepare(
            'SELECT * FROM group_red_packets WHERE group_id = ? AND remaining_count > 0'
        ).all(groupId);
        return packets.filter(pkt => {
            const already = dependencies.db.prepare(
                'SELECT id FROM group_red_packet_claims WHERE packet_id = ? AND claimer_id = ?'
            ).get(pkt.id, claimerId);
            return !already;
        });
    }

function getWallet(id) {
        if (id === 'user') {
            const p = dependencies.db.prepare('SELECT wallet FROM user_profile WHERE id = ?').get('default');
            return +(p?.wallet ?? 520).toFixed(2);
        }
        const c = dependencies.db.prepare('SELECT wallet FROM characters WHERE id = ?').get(id);
        return +(c?.wallet ?? 0).toFixed(2);
    }

    // State checks, ledger records and balances commit together, including nested callers.
    return {
        normalizeTransferAmount, normalizePaymentNote, getTransfer, getUnclaimedTransfersFrom,
        generateLuckyAmounts, normalizeRedPacketCount, getRedPacket, getUnclaimedRedPacketsForGroup, getWallet,
        createTransfer: dependencies.db.transaction(createTransfer).immediate,
        claimTransfer: dependencies.db.transaction(claimTransfer).immediate,
        refundTransfer: dependencies.db.transaction(refundTransfer).immediate,
        createRedPacket: dependencies.db.transaction(createRedPacket).immediate,
        claimRedPacket: dependencies.db.transaction(claimRedPacket).immediate,
    };
}

module.exports = { createModule };
