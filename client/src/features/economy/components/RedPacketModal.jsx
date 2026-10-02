import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import { useState } from 'react';
import { Gift, X } from 'lucide-react';
import { formatPacketMoney } from '../redPacketFormatting.js';

export function RedPacketModal({ group, apiUrl, onClose, userWallet }) {
    const { lang } = useLanguage();
    const [type, setType] = useState('lucky');
    const [amount, setAmount] = useState('');
    const [count, setCount] = useState(group?.members?.length || 3);
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const isFixed = type === 'fixed';
    const cnt = Math.max(1, parseInt(count) || 1);
    const amt = Math.max(0, parseFloat(amount) || 0);
    const totalCost = isFixed ? amt * cnt : amt;
    const perPreview = cnt > 0 ? (isFixed ? amt : totalCost / cnt) : 0;
    const overBudget = totalCost > (userWallet ?? 100);
    const tooSmall = totalCost > 0 && Math.round(totalCost * 100) < cnt;
    const isValid = amt > 0 && cnt > 0 && !overBudget && !tooSmall;

    const onSend = async () => {
        if (!isValid || sending) return;
        setSending(true);
        setSendError('');
        try {
            const payload = isFixed
                ? { type, count: cnt, per_amount: amt, total_amount: totalCost, note: note.trim() }
                : { type, count: cnt, total_amount: totalCost, note: note.trim() };

            const res = await fetch(`${apiUrl}/groups/${group.id}/redpackets`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false)
                throw new Error(data.error || (lang === 'en' ? 'Failed to send red packet' : '红包发送失败'));
            onClose();
        } catch (e) {
            console.error(e);
            setSendError(e.message || (lang === 'en' ? 'Failed to send red packet' : '红包发送失败'));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="red-packet-overlay">
            <section
                className="red-packet-modal"
                role="dialog"
                aria-modal="true"
                aria-label={lang === 'en' ? 'Send red packet' : '发送红包'}
            >
                <header className="red-packet-modal__hero">
                    <div className="red-packet-modal__title">
                        <span className="red-packet-modal__icon">
                            <Gift size={22} />
                        </span>
                        <div>
                            <h3>{lang === 'en' ? 'Send Red Packet' : '发送红包'}</h3>
                            <p>{group?.name || (lang === 'en' ? 'Group chat' : '群聊')}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="red-packet-modal__close"
                        onClick={onClose}
                        title={lang === 'en' ? 'Close' : '关闭'}
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="red-packet-modal__body">
                    <div className="red-packet-summary">
                        <div>
                            <span>{lang === 'en' ? 'Wallet' : '余额'}</span>
                            <strong>¥{formatPacketMoney(userWallet)}</strong>
                        </div>
                        <div>
                            <span>{lang === 'en' ? 'Cost' : '扣款'}</span>
                            <strong className={overBudget ? 'is-danger' : ''}>¥{formatPacketMoney(totalCost)}</strong>
                        </div>
                        <div>
                            <span>{lang === 'en' ? 'Approx.' : '约每份'}</span>
                            <strong>¥{formatPacketMoney(perPreview)}</strong>
                        </div>
                    </div>

                    <div
                        className="red-packet-segmented"
                        role="tablist"
                        aria-label={lang === 'en' ? 'Red packet type' : '红包类型'}
                    >
                        {[
                            ['lucky', lang === 'en' ? 'Lucky' : '拼手气'],
                            ['fixed', lang === 'en' ? 'Regular' : '普通'],
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                className={type === value ? 'active' : ''}
                                onClick={() => setType(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="red-packet-form-grid">
                        <label>
                            <span>{lang === 'en' ? 'Packets' : '个数'}</span>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={count}
                                onChange={(e) => setCount(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>
                                {isFixed ? (lang === 'en' ? 'Each' : '每份金额') : lang === 'en' ? 'Total' : '总金额'}
                            </span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </label>
                    </div>

                    <label className="red-packet-note-field">
                        <span>{lang === 'en' ? 'Message' : '留言'}</span>
                        <input
                            type="text"
                            maxLength="80"
                            placeholder={lang === 'en' ? 'Best wishes' : '恭喜发财，大吉大利'}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </label>

                    {(overBudget || tooSmall || sendError) && (
                        <div className="red-packet-error">
                            {sendError ||
                                (overBudget
                                    ? lang === 'en'
                                        ? 'Insufficient balance.'
                                        : '余额不足。'
                                    : lang === 'en'
                                      ? 'Each packet must be at least ¥0.01.'
                                      : '每个红包至少需要 ¥0.01。')}
                        </div>
                    )}

                    <button type="button" className="red-packet-submit" onClick={onSend} disabled={!isValid || sending}>
                        <Gift size={18} />
                        {sending
                            ? lang === 'en'
                                ? 'Sending...'
                                : '发送中...'
                            : lang === 'en'
                              ? 'Send Red Packet'
                              : '发红包'}
                    </button>
                </div>
            </section>
        </div>
    );
}
