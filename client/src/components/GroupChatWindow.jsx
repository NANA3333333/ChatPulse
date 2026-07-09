import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Smile, Paperclip, X, Settings, Trash2, UserMinus, ArrowRightLeft, Gift, ChevronLeft, Trash, UserPlus, Edit3 } from 'lucide-react';
import AvatarWithFrame from './AvatarWithFrame';
import { useLanguage } from '../LanguageContext';
import { defaultAvatarUrl, resolveAvatarUrl } from '../utils/avatar';

function normalizeGroupMessages(list = []) {
    const byId = new Map();
    list.forEach((msg, index) => {
        if (!msg || !msg.id) return;
        byId.set(msg.id, { ...msg, __fallbackIndex: index });
    });
    return Array.from(byId.values())
        .sort((a, b) => {
            const aTs = Number(a.timestamp || 0);
            const bTs = Number(b.timestamp || 0);
            if (aTs !== bTs) return aTs - bTs;
            const aId = String(a.id);
            const bId = String(b.id);
            if (aId !== bId) return aId.localeCompare(bId, 'en', { numeric: true });
            return (a.__fallbackIndex || 0) - (b.__fallbackIndex || 0);
        })
        .map((entry) => {
            const msg = { ...entry };
            delete msg.__fallbackIndex;
            return msg;
        });
}

const quickEmojis = [
    '\u{1F600}', '\u{1F601}', '\u{1F602}', '\u{1F923}', '\u{1F979}',
    '\u{1F60A}', '\u{1F642}', '\u{1F609}', '\u{1F60D}', '\u{1F618}',
    '\u{1F970}', '\u{1F60E}', '\u{1F914}', '\u{1F644}', '\u{1F634}',
    '\u{1F62D}', '\u{1F621}', '\u{1F624}', '\u{1F97A}', '\u{1F633}',
    '\u{1F917}', '\u{1FAF6}', '\u{1F44D}', '\u{1F44E}', '\u{1F64F}',
    '\u{1F44F}', '\u{1F4AA}', '\u{1F494}', '\u{2764}\u{FE0F}', '\u{1F495}',
    '\u{1F525}', '\u{2728}', '\u{1F389}', '\u{1F38A}', '\u{1F339}',
    '\u{1F35C}', '\u{1F35A}', '\u{1F370}', '\u{2615}', '\u{1F9CB}',
    '\u{1F381}', '\u{1F490}', '\u{1F436}', '\u{1F431}', '\u{1F319}',
    '\u{2600}\u{FE0F}', '\u{26A1}', '\u{1F4A4}', '\u{1F440}', '\u{1F90D}'
];

const groupProactivePresets = {
    1: [45, 90],
    2: [30, 60],
    3: [20, 40],
    4: [15, 30],
    5: [10, 20],
    6: [8, 15],
    7: [6, 12],
    8: [4, 8],
    9: [2, 5],
    10: [1, 3]
};

function getGroupProactivePreset(level) {
    return groupProactivePresets[Math.max(1, Math.min(10, Number(level) || 1))] || groupProactivePresets[1];
}

function getGroupProactiveLevelFromInterval(enabled, min, max) {
    if (!enabled) return 0;
    const avg = ((Number(min) || 10) + (Number(max) || 60)) / 2;
    let bestLevel = 1;
    let bestDistance = Infinity;
    Object.entries(groupProactivePresets).forEach(([level, range]) => {
        const presetAvg = (range[0] + range[1]) / 2;
        const distance = Math.abs(avg - presetAvg);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestLevel = Number(level);
        }
    });
    return bestLevel;
}

/* ─── Red Packet Send Modal ─── */
function formatPacketMoney(value) {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

function RedPacketModal({ group, apiUrl, onClose, userWallet }) {
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
                method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || (lang === 'en' ? 'Failed to send red packet' : '红包发送失败'));
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
            <section className="red-packet-modal" role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'Send red packet' : '发送红包'}>
                <header className="red-packet-modal__hero">
                    <div className="red-packet-modal__title">
                        <span className="red-packet-modal__icon"><Gift size={22} /></span>
                        <div>
                            <h3>{lang === 'en' ? 'Send Red Packet' : '发送红包'}</h3>
                            <p>{group?.name || (lang === 'en' ? 'Group chat' : '群聊')}</p>
                        </div>
                    </div>
                    <button type="button" className="red-packet-modal__close" onClick={onClose} title={lang === 'en' ? 'Close' : '关闭'}>
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

                    <div className="red-packet-segmented" role="tablist" aria-label={lang === 'en' ? 'Red packet type' : '红包类型'}>
                        {[
                            ['lucky', lang === 'en' ? 'Lucky' : '拼手气'],
                            ['fixed', lang === 'en' ? 'Regular' : '普通']
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
                            <input type="number" min="1" max="100" value={count} onChange={e => setCount(e.target.value)} />
                        </label>
                        <label>
                            <span>{isFixed ? (lang === 'en' ? 'Each' : '每份金额') : (lang === 'en' ? 'Total' : '总金额')}</span>
                            <input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                        </label>
                    </div>

                    <label className="red-packet-note-field">
                        <span>{lang === 'en' ? 'Message' : '留言'}</span>
                        <input type="text" maxLength="80" placeholder={lang === 'en' ? 'Best wishes' : '恭喜发财，大吉大利'} value={note} onChange={e => setNote(e.target.value)} />
                    </label>

                    {(overBudget || tooSmall || sendError) && (
                        <div className="red-packet-error">
                            {sendError || (overBudget
                                ? (lang === 'en' ? 'Insufficient balance.' : '余额不足。')
                                : (lang === 'en' ? 'Each packet must be at least ¥0.01.' : '每个红包至少需要 ¥0.01。'))}
                        </div>
                    )}

                    <button type="button" className="red-packet-submit" onClick={onSend} disabled={!isValid || sending}>
                        <Gift size={18} />
                        {sending ? (lang === 'en' ? 'Sending...' : '发送中...') : (lang === 'en' ? 'Send Red Packet' : '发红包')}
                    </button>
                </div>
            </section>
        </div>
    );
}

/* ─── Red Packet Card (parsed from [REDPACKET:id] in content) ─── */
function RedPacketCard({ packetId, apiUrl, groupId, resolveSender, claimEvent }) {
    const { lang } = useLanguage();
    const [pkt, setPkt] = useState(null);
    const [showDetail, setShowDetail] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [claimError, setClaimError] = useState('');

    const loadPkt = useCallback(async () => {
        try { const r = await fetch(`${apiUrl}/groups/${groupId}/redpackets/${packetId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }); setPkt(await r.json()); } catch (e) { console.error(e); }
    }, [apiUrl, groupId, packetId]);
    useEffect(() => { if (packetId) loadPkt(); }, [packetId, loadPkt]);

    // Re-fetch when a matching claim event arrives (real-time update)
    useEffect(() => {
        if (claimEvent && claimEvent.packet_id === packetId) {
            loadPkt();
        }
    }, [claimEvent, packetId, loadPkt]);

    const handleClaim = async () => {
        if (claiming) return;
        setClaiming(true);
        setClaimError('');
        try {
            const res = await fetch(`${apiUrl}/groups/${groupId}/redpackets/${packetId}/claim`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || (lang === 'en' ? 'Claim failed' : '领取失败'));
            loadPkt();
        } catch (e) {
            console.error(e);
            setClaimError(e.message || (lang === 'en' ? 'Claim failed' : '领取失败'));
        } finally {
            setClaiming(false);
        }
    };

    if (!pkt) {
        return (
            <div className="red-packet-card red-packet-card--loading">
                <div className="red-packet-card__seal"><Gift size={20} /></div>
                <div className="red-packet-card__main">
                    <div className="red-packet-skeleton wide" />
                    <div className="red-packet-skeleton short" />
                </div>
            </div>
        );
    }

    const claims = Array.isArray(pkt.claims) ? pkt.claims : [];
    const claimedCount = claims.length;
    const totalCount = Number(pkt.count || 0);
    const remainingCount = Number(pkt.remaining_count ?? Math.max(0, totalCount - claimedCount));
    const isExpired = remainingCount <= 0 || claimedCount >= totalCount;
    const userClaim = claims.find(c => c.claimer_id === 'user');
    const userClaimed = !!userClaim;
    const progress = totalCount > 0 ? Math.min(100, Math.max(0, (claimedCount / totalCount) * 100)) : 0;
    const typeLabel = pkt.type === 'fixed'
        ? (lang === 'en' ? 'Regular' : '普通')
        : (lang === 'en' ? 'Lucky' : '拼手气');
    const statusText = userClaimed
        ? `${lang === 'en' ? 'Claimed' : '已领取'} ¥${formatPacketMoney(userClaim.amount)}`
        : (isExpired ? (lang === 'en' ? 'All claimed' : '已抢完') : (lang === 'en' ? 'Ready' : '可领取'));

    return (
        <article className={`red-packet-card ${userClaimed ? 'is-claimed' : ''} ${isExpired ? 'is-empty' : ''}`}
            onClick={() => setShowDetail(!showDetail)}>
            <div className="red-packet-card__top">
                <div className="red-packet-card__seal"><Gift size={21} /></div>
                <div className="red-packet-card__main">
                    <div className="red-packet-card__title">{pkt.note || (lang === 'en' ? 'Best wishes' : '恭喜发财')}</div>
                    <div className="red-packet-card__meta">
                        <span>{typeLabel}</span>
                        <span>{claimedCount}/{totalCount}</span>
                        <span>¥{formatPacketMoney(pkt.total_amount)}</span>
                    </div>
                </div>
                <div className="red-packet-card__status">{statusText}</div>
            </div>

            <div className="red-packet-card__progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
            </div>

            <div className="red-packet-card__bottom">
                <span>{remainingCount > 0 ? `${lang === 'en' ? 'Left' : '剩余'} ${remainingCount}` : (lang === 'en' ? 'Closed' : '已结束')}</span>
                {!isExpired && !userClaimed ? (
                    <button type="button" onClick={e => { e.stopPropagation(); handleClaim(); }} disabled={claiming}>
                        {claiming ? (lang === 'en' ? 'Opening...' : '领取中...') : (lang === 'en' ? 'Open' : '领取')}
                    </button>
                ) : (
                    <button type="button" className="ghost" onClick={e => { e.stopPropagation(); setShowDetail(!showDetail); }}>
                        {showDetail ? (lang === 'en' ? 'Hide' : '收起') : (lang === 'en' ? 'Details' : '详情')}
                    </button>
                )}
            </div>

            {claimError && <div className="red-packet-card__error">{claimError}</div>}

            {showDetail && (
                <div className="red-packet-detail">
                    <div className="red-packet-detail__head">
                        <span>{lang === 'en' ? 'Claims' : '领取记录'}</span>
                        <span>{lang === 'en' ? `${remainingCount} left` : `剩 ${remainingCount} 份`}</span>
                    </div>
                    {!claims.length && <div className="red-packet-detail__empty">{lang === 'en' ? 'No claims yet' : '暂无人领取'}</div>}
                    {claims.map((c, i) => {
                        const fallbackSender = resolveSender(c.claimer_id);
                        const name = c.name || fallbackSender.name;
                        const avatar = c.avatar || fallbackSender.avatar;
                        return (
                            <div key={`${c.claimer_id}-${i}`} className="red-packet-detail__row">
                                <AvatarWithFrame
                                    size={28}
                                    frame={fallbackSender.avatar_frame}
                                    src={resolveAvatarUrl(avatar, apiUrl, name || 'User')}
                                    fallbackSrc={defaultAvatarUrl(name || 'User')}
                                    alt=""
                                />
                                <span>{name}</span>
                                <strong>¥{formatPacketMoney(c.amount)}</strong>
                            </div>
                        );
                    })}
                </div>
            )}
        </article>
    );
}

/* ─── Right-side Group Management Drawer ─── */
export function GroupManageDrawer({ group, apiUrl, resolveSender, onClose, lang, allContacts, onAddMember, onRename, onGroupUpdated }) {
    const [noChain, setNoChain] = useState(false);
    const [injectLimit, setInjectLimit] = useState(group?.inject_limit ?? 5);
    const [contextLimit, setContextLimit] = useState(group?.context_msg_limit ?? 60);
    const [groupProactiveEnabled, setGroupProactiveEnabled] = useState(group?.group_proactive_enabled === 1);
    const [groupIntervalMin, setGroupIntervalMin] = useState(group?.group_interval_min ?? 10);
    const [groupIntervalMax, setGroupIntervalMax] = useState(group?.group_interval_max ?? 60);
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(group?.name || '');
    const [showAddMember, setShowAddMember] = useState(false);
    const [addSearch, setAddSearch] = useState('');

    useEffect(() => {
        if (!group) return;
        setInjectLimit(group.inject_limit ?? 5);
        setContextLimit(group.context_msg_limit ?? 60);
        setGroupProactiveEnabled(group.group_proactive_enabled === 1);
        setGroupIntervalMin(group.group_interval_min ?? 10);
        setGroupIntervalMax(group.group_interval_max ?? 60);
        setNameInput(group.name || '');
        fetch(`${apiUrl}/groups/${group.id}/no-chain`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }).then(r => r.json()).then(d => setNoChain(!!d.no_chain)).catch(() => { });
    }, [group, apiUrl]);

    const toggleNoChain = async () => {
        const v = !noChain; setNoChain(v);
        fetch(`${apiUrl}/groups/${group.id}/no-chain`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ no_chain: v }) });
    };
    const updateInjectLimit = (val) => {
        setInjectLimit(val);
        fetch(`${apiUrl}/groups/${group.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inject_limit: val }) });
    };
    const updateContextLimit = (val) => {
        setContextLimit(val);
        fetch(`${apiUrl}/groups/${group.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ context_msg_limit: val }) });
        if (group) group.context_msg_limit = val;
    };
    const getProactiveLevel = () => {
        return getGroupProactiveLevelFromInterval(groupProactiveEnabled, groupIntervalMin, groupIntervalMax);
    };
    const updateGroupProactive = async (level) => {
        const payload = level === 0
            ? { group_proactive_enabled: 0 }
            : (() => {
                const [min, max] = getGroupProactivePreset(level);
                return { group_proactive_enabled: 1, group_interval_min: min, group_interval_max: max };
            })();
        setGroupProactiveEnabled(payload.group_proactive_enabled === 1);
        if (payload.group_interval_min !== undefined) setGroupIntervalMin(payload.group_interval_min);
        if (payload.group_interval_max !== undefined) setGroupIntervalMax(payload.group_interval_max);
        try {
            const res = await fetch(`${apiUrl}/groups/${group.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (data.success && data.group) {
                onGroupUpdated?.(data.group);
            }
        } catch (e) {
            console.error('Update group proactive failed:', e);
        }
    };
    const clearMessages = () => { if (window.confirm(lang === 'en' ? 'Clear all messages?' : '清空所有消息？')) fetch(`${apiUrl}/groups/${group.id}/messages`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }).then(() => window.location.reload()); };
    const dissolveGroup = () => { if (window.confirm(lang === 'en' ? 'Dissolve this group?' : '解散此群？')) fetch(`${apiUrl}/groups/${group.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }).then(() => window.location.reload()); };
    const kickMember = (mid) => { if (window.confirm(lang === 'en' ? 'Remove this member?' : '移除此成员？')) fetch(`${apiUrl}/groups/${group.id}/members/${mid}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }).then(() => window.location.reload()); };

    const handleRename = () => {
        const newName = nameInput.trim();
        if (newName && newName !== group.name) {
            onRename(newName);
        }
        setEditingName(false);
    };

    // Characters not already in the group
    const memberIds = new Set((group.members || []).map(m => m.member_id || m));
    const availableChars = (allContacts || []).filter(c => !memberIds.has(String(c.id)) && !memberIds.has(c.id));
    const filteredChars = availableChars.filter(c => c.name.toLowerCase().includes(addSearch.toLowerCase()));

    return (
        <div className="group-manage-drawer chat-peer-drawer" style={{ width: '280px', minWidth: '280px', backgroundColor: '#f7f7f7', borderLeft: '1px solid #eee', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            {/* Header */}
            <div className="group-manage-drawer__header" style={{ padding: '12px 15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Settings size={16} /> {lang === 'en' ? 'Group Management' : '群管理'}
                </h3>
                <button className="group-manage-drawer__close" onClick={onClose} title={lang === 'en' ? 'Close' : '关闭'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
            </div>

            {/* Group Name (editable) */}
            <div className="group-manage-card group-manage-card--name" style={{ backgroundColor: '#fff', padding: '12px 15px', borderBottom: '1px solid #eee' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'Group Name' : '群名称'}
                </div>
                {editingName ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditingName(false); setNameInput(group.name); } }}
                            autoFocus
                            style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--accent-color)', fontSize: '14px', outline: 'none' }} />
                        <button onClick={handleRename} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>
                            ✓
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '15px', fontWeight: '500' }}>{group.name}</span>
                        <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }} title={lang === 'en' ? 'Rename group' : '修改群名'}>
                            <Edit3 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Members */}
            <div className="group-manage-card group-manage-card--members" style={{ backgroundColor: '#fff', padding: '12px 15px', borderBottom: '1px solid #eee' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{lang === 'en' ? 'Members' : '群成员'} ({group.members?.length || 0})</span>
                    <button onClick={() => setShowAddMember(!showAddMember)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', padding: '0' }} title={lang === 'en' ? 'Add member' : '添加成员'}>
                        <UserPlus size={14} />
                    </button>
                </div>
                {group.members?.map(memberObj => {
                    const mid = memberObj.member_id || memberObj;
                    const m = resolveSender(mid);
                    return (
                            <div key={mid} className="group-manage-member-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
                            <AvatarWithFrame
                                size={30}
                                frame={m.avatar_frame}
                                src={m.avatar}
                                fallbackSrc={defaultAvatarUrl(m.name || mid || 'User')}
                                alt=""
                            />
                            <span style={{ flex: 1, fontSize: '13px' }}>{m.name}</span>
                            {mid !== 'user' && (
                                <button onClick={() => kickMember(mid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }} title={lang === 'en' ? 'Remove member from group' : '将该成员踢出群聊'}>
                                    <UserMinus size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}
                {/* Add Member Panel */}
                {showAddMember && (
                    <div className="group-manage-add-member" style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                        <input type="text" placeholder={lang === 'en' ? 'Search characters...' : '搜索角色...'} value={addSearch} onChange={e => setAddSearch(e.target.value)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {filteredChars.length === 0 && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                                    {lang === 'en' ? 'No characters available' : '没有可添加的角色'}
                                </div>
                            )}
                            {filteredChars.map(c => (
                                <div key={c.id} onClick={() => { onAddMember(c.id); setShowAddMember(false); setAddSearch(''); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0f9eb'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <AvatarWithFrame
                                        size={28}
                                        frame={c.avatar_frame}
                                        src={resolveAvatarUrl(c.avatar, apiUrl, c.name || c.id || 'User')}
                                        fallbackSrc={defaultAvatarUrl(c.name || c.id || 'User')}
                                        alt=""
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: '500' }}>{c.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>



            {/* AI Controls */}
            <div className="group-manage-card group-manage-card--ai" style={{ backgroundColor: '#fff', padding: '12px 15px', borderBottom: '1px solid #eee', marginTop: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'AI Controls' : 'AI 控制'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span>{lang === 'en' ? '⚡ Prevent AI Chaining' : '⚡ 禁止AI互相接话'}</span>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                        <input type="checkbox" checked={noChain} onChange={toggleNoChain} style={{ opacity: 0, width: 0, height: 0 }} />
                        <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: noChain ? 'var(--accent-color)' : '#ccc', borderRadius: '24px', transition: '0.3s' }}>
                            <span style={{ position: 'absolute', height: '18px', width: '18px', left: noChain ? '23px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '0.3s' }} />
                        </span>
                    </label>
                </div>
                <div style={{ marginTop: '14px', borderTop: '1px dashed #eee', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '6px' }}>
                        <span>💬 {lang === 'en' ? 'Proactive group message' : '群聊主动发消息'}</span>
                        <span style={{ fontWeight: '600', color: 'var(--accent-color)', minWidth: '70px', textAlign: 'right' }}>
                            {!groupProactiveEnabled
                                ? (lang === 'en' ? 'Off' : '关闭')
                                : `${groupIntervalMin || 10}~${groupIntervalMax || 60}${lang === 'en' ? ' min' : '分钟'}`}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        value={getProactiveLevel()}
                        onChange={e => updateGroupProactive(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        <span>{lang === 'en' ? 'Off' : '关闭'}</span>
                        <span>{lang === 'en' ? 'Very frequent' : '非常频繁'}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {lang === 'en'
                            ? 'Only controls this group. A random member may start a topic when the group is quiet.'
                            : '只控制当前群。群里安静时，会随机挑一名群成员主动起话题。'}
                    </div>
                </div>
                <div style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '6px' }}>
                        <span>📤 {lang === 'en' ? 'Inject into other contexts' : '注入私聊/其他群的消息条数'}</span>
                        <span style={{ fontWeight: '600', color: 'var(--accent-color)', minWidth: '28px', textAlign: 'right' }}>{injectLimit}</span>
                    </div>
                    <input type="range" min="0" max="30" value={injectLimit} onChange={e => updateInjectLimit(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }} />
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {lang === 'en' ? 'Messages from this group injected into private chat & other group chats. 0 = disabled.' : '本群消息注入私聊和其他群聊的条数。0 = 关闭注入。'}
                    </div>
                </div>
                <div style={{ marginTop: '14px', borderTop: '1px dashed #eee', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '6px' }}>
                        <span>🧠 {lang === 'en' ? 'AI Vision Boundary' : 'AI 记忆视界 (上下文条数)'}</span>
                        <span style={{ fontWeight: '600', color: 'var(--accent-color)', minWidth: '28px', textAlign: 'right' }}>{contextLimit}</span>
                    </div>
                    <input type="range" min="10" max="200" step="10" value={contextLimit} onChange={e => updateContextLimit(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }} />
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {lang === 'en' ? 'How many recent messages AI can "see" in this group. Older ones are hidden from AI.' : 'AI 在本群能感知的最近消息条数。超出该线的旧消息将被忽略，节省算力。'}
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="group-manage-card group-manage-card--danger" style={{ backgroundColor: '#fff', padding: '12px 15px', marginTop: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'Danger Zone' : '危险操作'}
                </div>
                <button onClick={clearMessages} title={lang === 'en' ? 'Delete all messages in this group' : '清空群聊中的所有消息'} style={{ width: '100%', padding: '10px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Trash2 size={14} /> {lang === 'en' ? 'Clear Messages' : '清空消息'}
                </button>
                <button onClick={dissolveGroup} title={lang === 'en' ? 'Permanently dissolve this group chat' : '永久解散此群聊'} style={{ width: '100%', padding: '10px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    💥 {lang === 'en' ? 'Dissolve Group' : '解散群聊'}
                </button>
            </div>
        </div>
    );
}

/* ─── Main GroupChatWindow ─── */
function GroupChatWindow({
    group,
    apiUrl,
    allContacts,
    userProfile,
    incomingGroupMessageQueue,
    typingIndicators,
    redpacketClaimEvent,
    onBack,
    onGroupUpdated,
    isManageOpen,
    onToggleManage,
    onCloseManage
}) {
    const { lang } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showRedPacketModal, setShowRedPacketModal] = useState(false);
    const [showManageDrawer, setShowManageDrawer] = useState(false);
    const isManageControlled = typeof isManageOpen === 'boolean';
    const manageDrawerOpen = isManageControlled ? isManageOpen : showManageDrawer;
    const toggleManageDrawer = () => {
        if (onToggleManage) {
            onToggleManage();
            return;
        }
        setShowManageDrawer(current => !current);
    };
    const closeManageDrawer = () => {
        if (onCloseManage) {
            onCloseManage();
            return;
        }
        setShowManageDrawer(false);
    };
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const processedIncomingGroupMessageIdsRef = useRef(new Set());
    const deletedGroupMessageIdsRef = useRef(new Set());
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Mentions logic
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    useEffect(() => {
        if (!group?.id) return;
        setMessages([]); setShowManageDrawer(false);
        fetch(`${apiUrl}/groups/${group.id}/messages`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }).then(r => r.json()).then(data => setMessages(normalizeGroupMessages(data))).catch(console.error);
    }, [group?.id, apiUrl]);

    useEffect(() => {
        if (incomingGroupMessageQueue && incomingGroupMessageQueue.length > 0 && group?.id) {
            const relevantMsgs = incomingGroupMessageQueue.filter((m) => {
                if (!m || m.group_id !== group.id || !m.id) return false;
                const messageId = `${group.id}:${m.id}`;
                if (deletedGroupMessageIdsRef.current.has(messageId)) return false;
                if (processedIncomingGroupMessageIdsRef.current.has(messageId)) return false;
                processedIncomingGroupMessageIdsRef.current.add(messageId);
                return true;
            });
            if (relevantMsgs.length > 0) {
                setMessages(prev => {
                    return normalizeGroupMessages([...prev, ...relevantMsgs]);
                });
            }
        }
    }, [incomingGroupMessageQueue, group?.id]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !group) return;
        const text = input.trim(); setInput('');
        try { await fetch(`${apiUrl}/groups/${group.id}/messages`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text }) }); } catch (e) { console.error(e); }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        e.target.value = '';
        if (file.size > 100 * 1024) { alert(lang === 'en' ? `File too large (${(file.size / 1024).toFixed(1)} KB). Max 100 KB.` : `文件太大。最大 100 KB。`); return; }
        const reader = new FileReader();
        reader.onload = (ev) => { const snippet = `📄 [${file.name}]\n${ev.target.result}`; setInput(prev => prev ? prev + '\n' + snippet : snippet); };
        reader.onerror = () => alert(lang === 'en' ? 'Failed to read file' : '读取文件失败');
        reader.readAsText(file, 'utf-8');
    };

    const resolveSender = useCallback((senderId) => {
        if (senderId === 'user') {
            return {
                name: userProfile?.name || 'User',
                avatar: resolveAvatarUrl(userProfile?.avatar, apiUrl, userProfile?.name || 'User'),
                avatar_frame: userProfile?.avatar_frame || ''
            };
        }
        const char = allContacts?.find(c => String(c.id) === String(senderId));
        return char ? { ...char, avatar: resolveAvatarUrl(char.avatar, apiUrl, char.name || senderId || 'User') } : { name: senderId, avatar: defaultAvatarUrl(senderId || 'User') };
    }, [allContacts, apiUrl, userProfile?.avatar, userProfile?.avatar_frame, userProfile?.name]);

    const addEmoji = (emoji) => { setInput(prev => prev + emoji); setShowEmojiPicker(false); };

    // --- MENTION HANDLERS ---
    const availableMentions = React.useMemo(() => {
        if (!group) return [];
        const base = [{ id: 'all', name: lang === 'en' ? 'All' : '全体成员', avatar: defaultAvatarUrl('All') }];
        if (group.members) {
            group.members.forEach(memberObj => {
                const mid = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                if (mid !== 'user') base.push(resolveSender(mid));
            });
        }
        return base.filter(m => m.name.toLowerCase().includes(mentionFilter.toLowerCase()));
    }, [group, mentionFilter, lang, resolveSender]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);
        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.substring(0, cursor);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || /\W/.test(textBeforeCursor[lastAtIndex - 1]))) {
            const query = textBeforeCursor.substring(lastAtIndex + 1);
            if (!/\s/.test(query)) {
                setMentionFilter(query);
                setShowMentionMenu(true);
                setMentionIndex(0);
                return;
            }
        }
        setShowMentionMenu(false);
    };

    const handleMentionSelect = (member) => {
        const cursor = textareaRef.current?.selectionStart || input.length;
        const textBeforeCursor = input.substring(0, cursor);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const beforeMention = input.substring(0, lastAtIndex);
            const afterMention = input.substring(cursor);
            const newText = beforeMention + `@${member.name} ` + afterMention;
            setInput(newText);
            setTimeout(() => {
                if (textareaRef.current) {
                    const newPos = lastAtIndex + member.name.length + 2;
                    textareaRef.current.setSelectionRange(newPos, newPos);
                    textareaRef.current.focus();
                }
            }, 0);
        }
        setShowMentionMenu(false);
    };

    const handleKeyDown = (e) => {
        if (showMentionMenu && availableMentions.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(p => Math.min(p + 1, availableMentions.length - 1)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(p => Math.max(p - 1, 0)); return; }
            if (e.key === 'Enter') { e.preventDefault(); handleMentionSelect(availableMentions[mentionIndex]); return; }
            if (e.key === 'Escape') { setShowMentionMenu(false); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };
    // ------------------------


    // Parse message content to detect special types
    const parseContent = (content) => {
        if (!content) return { type: 'text', text: '' };
        // Red packet: [REDPACKET:123]
        const rpMatch = content.trim().match(/^\[REDPACKET:(\d+)\]\s*$/);
        if (rpMatch) return { type: 'redpacket', packetId: parseInt(rpMatch[1]) };
        // Transfer: [TRANSFER] amount | note
        if (content.startsWith('[TRANSFER]')) return { type: 'transfer', content };
        // System
        if (content.startsWith('[System]')) return { type: 'system', text: content.replace('[System] ', '') };
        return { type: 'text', text: content };
    };



    const handleAddMember = async (charId) => {
        try {
            const res = await fetch(`${apiUrl}/groups/${group.id}/members`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ member_id: charId })
            });
            const data = await res.json();
            if (data.success && onGroupUpdated) {
                onGroupUpdated(data.group);
            }
        } catch (e) { console.error('Add member failed:', e); }
    };

    const handleRename = async (newName) => {
        try {
            const res = await fetch(`${apiUrl}/groups/${group.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            const data = await res.json();
            if (data.success && onGroupUpdated) {
                onGroupUpdated(data.group);
            }
        } catch (e) { console.error('Rename failed:', e); }
    };



    if (!group) return null;

    return (
        <>
            <div className="group-chat-main private-chat-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minWidth: 0 }}>
                {/* Header */}
                <div className="chat-header">
                    <div className="chat-header-title group-chat-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="mobile-back-btn" onClick={onBack} title={lang === 'en' ? 'Back' : '返回'}>
                            <ChevronLeft size={24} />
                        </button>
                        <Users size={20} />
                        <span className="chat-header-name-text">{group.name}</span>
                        <span className="chat-state-chip group-member-count">{lang === 'en' ? `${group.members?.length || 0} members` : `${group.members?.length || 0} 人`}</span>
                    </div>
                    <div className="chat-header-actions group-chat-header-actions" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }} title={lang === 'en' ? 'Select Messages' : '选择消息'}
                            style={selectMode ? { color: 'var(--accent-color)', background: 'rgba(var(--accent-rgb, 74,144,226), 0.12)', borderRadius: '8px', border: 'none', cursor: 'pointer', padding: '6px' } : { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', padding: '6px' }}>
                            <Trash size={20} />
                            <span>{lang === 'en' ? 'Select' : '选择消息'}</span>
                        </button>
                        <button onClick={toggleManageDrawer}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: manageDrawerOpen ? 'var(--danger)' : 'var(--accent-color)' }}
                            title={lang === 'en' ? 'Group management — members, AI controls, danger zone' : '群管理 — 成员、AI 控制、危险操作'}>
                            <Settings size={20} />
                            <span>{lang === 'en' ? 'Manage' : '群管理'}</span>
                        </button>
                    </div>
                </div>



                {/* Messages */}
                <div className="chat-history">
                    {messages.map((msg, index) => {
                        const sender = resolveSender(msg.sender_id);
                        const isUser = msg.sender_id === 'user';
                        const parsed = parseContent(msg.content);

                        const currentLimit = group?.context_msg_limit || 60;
                        const isBoundary = index === Math.max(0, messages.length - currentLimit) && messages.length > currentLimit;

                        const boundaryElement = isBoundary ? (
                            <div key={`boundary-${msg.id}`} style={{ textAlign: 'center', margin: '30px 0', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ borderBottom: '1px dashed #ccc', position: 'absolute', top: '20px', left: '10%', right: '10%' }}></div>
                                <span style={{ background: 'rgba(255, 247, 250, 0.94)', padding: '0 15px', color: 'var(--text-warm)', fontSize: '12px', fontWeight: 'bold', position: 'relative', zIndex: 1, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    👀 {lang === 'en' ? 'AI Vision Boundary' : 'AI 视界边界'} 👀
                                </span>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', position: 'relative', zIndex: 1, backgroundColor: 'rgba(255, 247, 250, 0.94)', padding: '0 10px' }}>
                                    {lang === 'en' ? 'AI can only "see" messages below this line' : '模型只能感知此线以下的消息'}
                                </div>
                            </div>
                        ) : null;

                        // System message
                        if (msg.sender_id === 'system' || parsed.type === 'system') {
                            return (
                                <React.Fragment key={msg.id}>
                                    {boundaryElement}
                                    <div style={{ textAlign: 'center', margin: '8px 0' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'rgba(255, 247, 250, 0.92)', padding: '3px 10px', borderRadius: '10px' }}>
                                            {parsed.text || (msg.content || '').replace('[System] ', '')}
                                        </span>
                                    </div>
                                </React.Fragment>
                            );
                        }

                        const isSelected = selectedIds.has(msg.id);
                        const selectionClick = selectMode ? () => {
                            setSelectedIds(prev => {
                                const next = new Set(prev);
                                if (next.has(msg.id)) next.delete(msg.id);
                                else next.add(msg.id);
                                return next;
                            });
                        } : undefined;

                        // Red packet
                        if (parsed.type === 'redpacket') {
                            return (
                                <React.Fragment key={msg.id}>
                                    {boundaryElement}
                                    <div className={`message-wrapper ${isUser ? 'user' : 'character'}`}
                                        style={isSelected ? { backgroundColor: 'rgba(var(--accent-rgb, 74,144,226), 0.08)', borderRadius: '8px' } : {}}
                                        onClick={selectionClick}>
                                        {selectMode && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', paddingTop: '12px', cursor: 'pointer' }}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid #ccc', backgroundColor: isSelected ? 'var(--accent-color, #4a90e2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                                                    {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                                                </div>
                                            </div>
                                        )}
                                    <div className="message-avatar">
                                        <AvatarWithFrame
                                            size={36}
                                            frame={sender.avatar_frame}
                                            src={resolveAvatarUrl(sender.avatar, apiUrl, sender.name || 'User')}
                                            fallbackSrc={defaultAvatarUrl(sender.name || 'User')}
                                            alt=""
                                        />
                                    </div>
                                    <div className="message-content">
                                        {!isUser && <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '2px', fontWeight: '500' }}>{sender.name}</div>}
                                        <RedPacketCard packetId={parsed.packetId} apiUrl={apiUrl} groupId={group.id} isUser={isUser} resolveSender={resolveSender} claimEvent={redpacketClaimEvent} />
                                        {msg.timestamp && (
                                            <div style={{
                                                fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px',
                                                display: 'flex', gap: '6px', alignItems: 'center',
                                                justifyContent: isUser ? 'flex-end' : 'flex-start'
                                            }}>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </React.Fragment>
                            );
                        }

                        // Transfer
                        if (parsed.type === 'transfer') {
                            const raw = parsed.content.replace('[TRANSFER]', '').trim();
                            const parts = raw.split('|');
                            // Format is: tid|amount|note — parts[0]=tid, parts[1]=amount, parts[2+]=note
                            const amount = parts.length > 1 ? parts[1].trim() : parts[0].trim();
                            const note = parts.length > 2 ? parts.slice(2).join('|').trim() : 'Transfer';
                            return (
                                <React.Fragment key={msg.id}>
                                    {boundaryElement}
                                    <div className={`message-wrapper ${isUser ? 'user' : 'character'}`}
                                        style={isSelected ? { backgroundColor: 'rgba(var(--accent-rgb, 74,144,226), 0.08)', borderRadius: '8px' } : {}}
                                        onClick={selectionClick}>
                                    {selectMode && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', paddingTop: '12px', cursor: 'pointer' }}>
                                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid #ccc', backgroundColor: isSelected ? 'var(--accent-color, #4a90e2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                                                {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                                            </div>
                                        </div>
                                    )}
                                    <div className="message-avatar">
                                        <AvatarWithFrame
                                            size={36}
                                            frame={sender.avatar_frame}
                                            src={resolveAvatarUrl(sender.avatar, apiUrl, sender.name || 'User')}
                                            fallbackSrc={defaultAvatarUrl(sender.name || 'User')}
                                            alt=""
                                        />
                                    </div>
                                    <div className="message-content">
                                        {!isUser && <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '2px', fontWeight: '500' }}>{sender.name}</div>}
                                        <div className="message-bubble transfer-bubble">
                                            <div className="transfer-icon-area"><ArrowRightLeft size={24} color="#fff" /></div>
                                            <div className="transfer-text-area">
                                                <div className="transfer-amount">¥{amount}</div>
                                                <div className="transfer-note">{note}</div>
                                            </div>
                                        </div>
                                        {msg.timestamp && (
                                            <div style={{
                                                fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px',
                                                display: 'flex', gap: '6px', alignItems: 'center',
                                                justifyContent: isUser ? 'flex-end' : 'flex-start'
                                            }}>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                </React.Fragment>
                            );
                        }

                        // Normal message
                        return (
                            <React.Fragment key={msg.id}>
                                {boundaryElement}
                                <div className={`message-wrapper ${isUser ? 'user' : 'character'}`}
                                    style={isSelected ? { backgroundColor: 'rgba(var(--accent-rgb, 74,144,226), 0.08)', borderRadius: '8px' } : {}}
                                    onClick={selectionClick}>
                                {selectMode && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', paddingTop: '12px', cursor: 'pointer' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid #ccc', backgroundColor: isSelected ? 'var(--accent-color, #4a90e2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                                            {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                                        </div>
                                    </div>
                                )}
                                <div className="message-avatar">
                                    <AvatarWithFrame
                                        size={36}
                                        frame={sender.avatar_frame}
                                        src={resolveAvatarUrl(sender.avatar, apiUrl, sender.name || 'User')}
                                        fallbackSrc={defaultAvatarUrl(sender.name || 'User')}
                                        alt=""
                                    />
                                </div>
                                <div className="message-content">
                                    {!isUser && <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '2px', fontWeight: '500' }}>{sender.name}</div>}
                                    <div className="message-bubble">{msg.content}</div>
                                    {msg.timestamp && (
                                        <div style={{
                                            fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px',
                                            display: 'flex', gap: '6px', alignItems: 'center',
                                            justifyContent: isUser ? 'flex-end' : 'flex-start'
                                        }}>
                                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            </React.Fragment>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Typing indicators and Interrupt Button */}
                {(typingIndicators.length > 0) && (
                    <div style={{ padding: '4px 15px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>✨</span>
                            {typingIndicators.map(t => t.name).join(', ')} {lang === 'en' ? 'typing...' : '正在输入中...'}
                        </div>
                        <button
                            onClick={async () => {
                                // Instantly interrupt AIs
                                await fetch(`${apiUrl}/groups/${group.id}/ai-pause`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: true }) });
                                // Automatically unpause after 10 seconds or when user sends a message
                                setTimeout(() => {
                                    fetch(`${apiUrl}/groups/${group.id}/ai-pause`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: false }) });
                                }, 10000);
                            }}
                            title={lang === 'en' ? 'Interrupt AIs and stop them from chaining texts' : '打断 AI 的连续发言'}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px', background: '#fff0f0', border: '1px solid #ffcccc', color: 'var(--danger)',
                                padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 5px rgba(240,107,142,0.1)'
                            }}
                        >
                            ✋ {lang === 'en' ? 'Interrupt' : '打断'}
                        </button>
                    </div>
                )}

                {/* Floating delete bar when in select mode */}
                {selectMode && (
                    <div className="select-action-bar group-select-action-bar" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', background: '#fff', borderTop: '1px solid #eee',
                        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                onClick={() => {
                                    if (selectedIds.size === messages.length) setSelectedIds(new Set());
                                    else setSelectedIds(new Set(messages.map(m => m.id)));
                                }}
                                style={{ fontSize: '13px', color: 'var(--accent-color, #4a90e2)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                            >
                                {selectedIds.size === messages.length ? (lang === 'en' ? 'Deselect All' : '取消全选') : (lang === 'en' ? 'Select All' : '全选')}
                            </button>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {lang === 'en' ? `${selectedIds.size} selected` : `已选 ${selectedIds.size} 条`}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                                style={{ padding: '6px 16px', fontSize: '13px', background: 'rgba(255, 247, 250, 0.92)', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            >
                                {lang === 'en' ? 'Cancel' : '取消'}
                            </button>
                            <button
                                disabled={selectedIds.size === 0}
                                onClick={async () => {
                                    if (selectedIds.size === 0) return;
                                    const confirmMsg = lang === 'en'
                                        ? `Permanently delete ${selectedIds.size} message(s)?`
                                        : `确定永久删除 ${selectedIds.size} 条消息？`;
                                    if (!confirm(confirmMsg)) return;
                                    try {
                                        const res = await fetch(`${apiUrl}/groups/${group.id}/messages/batch-delete`, {
                                            method: 'POST',
                                            headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ messageIds: [...selectedIds] })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            [...selectedIds].forEach(id => deletedGroupMessageIdsRef.current.add(`${group.id}:${id}`));
                                            setMessages(prev => prev.filter(m => !selectedIds.has(m.id)));
                                            setSelectedIds(new Set());
                                            setSelectMode(false);
                                        }
                                    } catch (e) {
                                        console.error('Group batch delete failed:', e);
                                    }
                                }}
                                style={{
                                    padding: '6px 16px', fontSize: '13px', fontWeight: '600',
                                    background: selectedIds.size > 0 ? '#e74c3c' : '#ddd',
                                    color: '#fff', border: 'none', borderRadius: '8px',
                                    cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed'
                                }}
                            >
                                <Trash size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                {lang === 'en' ? 'Delete' : '删除'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Input area — matches private chat InputBar style */}
                {!selectMode && (<div className="input-area">
                    <div className="input-toolbar" style={{ position: 'relative' }}>
                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} title={lang === 'en' ? 'Insert emoji' : '插入表情'}><Smile size={20} /></button>
                        <button onClick={() => fileInputRef.current?.click()} title={lang === 'en' ? 'Send file' : '发送文件'}><Paperclip size={20} /></button>
                        <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,.log,.py,.js,.ts,.html,.css,.xml,.yaml,.yml" style={{ display: 'none' }} onChange={handleFileChange} />
                        <button onClick={() => setShowRedPacketModal(true)} title={lang === 'en' ? 'Send red packet — lucky money for group' : '发红包 — 给群友发财运'}>
                            <Gift size={20} color="var(--danger)" />
                        </button>

                        {showEmojiPicker && (
                            <div className="emoji-picker" style={{ position: 'absolute', bottom: '50px', left: '10px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '12px 40px 12px 12px', display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '8px', width: 'min(420px, calc(100vw - 40px))', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)', zIndex: 100 }}>
                                <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                    <button onClick={() => setShowEmojiPicker(false)} style={{ padding: '2px' }}><X size={14} /></button>
                                </div>
                                {quickEmojis.map(e => (
                                    <span key={e} onClick={() => addEmoji(e)} style={{ fontSize: '22px', cursor: 'pointer', padding: '6px', borderRadius: '8px', textAlign: 'center' }}>{e}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="input-textarea-wrapper" style={{ position: 'relative' }}>
                        {showMentionMenu && availableMentions.length > 0 && (
                            <div className="mention-menu" style={{ position: 'absolute', bottom: '100%', left: 0, backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 0', width: '240px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginBottom: '8px' }}>
                                {availableMentions.map((m, i) => (
                                    <div key={m.id} onClick={() => handleMentionSelect(m)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 15px', cursor: 'pointer', backgroundColor: i === mentionIndex ? '#f0f9eb' : 'transparent' }} onMouseEnter={() => setMentionIndex(i)}>
                                        <AvatarWithFrame
                                            size={28}
                                            frame={m.avatar_frame}
                                            src={m.avatar}
                                            fallbackSrc={defaultAvatarUrl(m.name || 'User')}
                                            alt=""
                                        />
                                        <span style={{ fontSize: '14px', fontWeight: '500', color: i === mentionIndex ? 'var(--accent-color)' : 'var(--text-warm)' }}>{m.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <textarea
                            ref={textareaRef}
                            className="input-textarea"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={lang === 'en' ? 'Type a message...' : '输入消息...'}
                        />
                    </div>
                    <div className="input-actions">
                        <button className="send-button" onClick={handleSend}>{lang === 'en' ? 'Send' : '发送'}</button>
                    </div>
                </div>
                )}
            </div>

            {!isManageControlled && manageDrawerOpen && (
                <GroupManageDrawer group={group} apiUrl={apiUrl} resolveSender={resolveSender}
                    onClose={closeManageDrawer} lang={lang}
                    messages={messages} allContacts={allContacts}
                    onAddMember={handleAddMember} onRename={handleRename} onGroupUpdated={onGroupUpdated} />
            )}

            {/* Red Packet Modal */}
            {showRedPacketModal && (
                <RedPacketModal group={group} apiUrl={apiUrl} onClose={() => setShowRedPacketModal(false)} userWallet={userProfile?.wallet ?? 100} />
            )}
        </>
    );
}

export default GroupChatWindow;
