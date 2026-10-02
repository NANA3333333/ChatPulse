import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import { useState, useCallback, useEffect } from 'react';
import { Gift } from 'lucide-react';
import { formatPacketMoney } from '../redPacketFormatting.js';
import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { resolveAvatarUrl, defaultAvatarUrl } from '../../../shared/media/avatar.js';

export function RedPacketCard({ packetId, apiUrl, groupId, resolveSender, claimEvent }) {
    const { lang } = useLanguage();
    const [pkt, setPkt] = useState(null);
    const [showDetail, setShowDetail] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [claimError, setClaimError] = useState('');
    const loadPkt = useCallback(async () => {
        try {
            const r = await fetch(`${apiUrl}/groups/${groupId}/redpackets/${packetId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            setPkt(await r.json());
        } catch (e) {
            console.error(e);
        }
    }, [apiUrl, groupId, packetId]);
    useEffect(() => {
        if (packetId) loadPkt();
    }, [packetId, loadPkt]);

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
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false)
                throw new Error(data.error || (lang === 'en' ? 'Claim failed' : '领取失败'));
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
                <div className="red-packet-card__seal">
                    <Gift size={20} />
                </div>
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
    const userClaim = claims.find((c) => c.claimer_id === 'user');
    const userClaimed = !!userClaim;
    const progress = totalCount > 0 ? Math.min(100, Math.max(0, (claimedCount / totalCount) * 100)) : 0;
    const typeLabel = pkt.type === 'fixed' ? (lang === 'en' ? 'Regular' : '普通') : lang === 'en' ? 'Lucky' : '拼手气';
    const statusText = userClaimed
        ? `${lang === 'en' ? 'Claimed' : '已领取'} ¥${formatPacketMoney(userClaim.amount)}`
        : isExpired
          ? lang === 'en'
              ? 'All claimed'
              : '已抢完'
          : lang === 'en'
            ? 'Ready'
            : '可领取';

    return (
        <article
            className={`red-packet-card ${userClaimed ? 'is-claimed' : ''} ${isExpired ? 'is-empty' : ''}`}
            onClick={() => setShowDetail(!showDetail)}
        >
            <div className="red-packet-card__top">
                <div className="red-packet-card__seal">
                    <Gift size={21} />
                </div>
                <div className="red-packet-card__main">
                    <div className="red-packet-card__title">
                        {pkt.note || (lang === 'en' ? 'Best wishes' : '恭喜发财')}
                    </div>
                    <div className="red-packet-card__meta">
                        <span>{typeLabel}</span>
                        <span>
                            {claimedCount}/{totalCount}
                        </span>
                        <span>¥{formatPacketMoney(pkt.total_amount)}</span>
                    </div>
                </div>
                <div className="red-packet-card__status">{statusText}</div>
            </div>

            <div className="red-packet-card__progress" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
            </div>

            <div className="red-packet-card__bottom">
                <span>
                    {remainingCount > 0
                        ? `${lang === 'en' ? 'Left' : '剩余'} ${remainingCount}`
                        : lang === 'en'
                          ? 'Closed'
                          : '已结束'}
                </span>
                {!isExpired && !userClaimed ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClaim();
                        }}
                        disabled={claiming}
                    >
                        {claiming ? (lang === 'en' ? 'Opening...' : '领取中...') : lang === 'en' ? 'Open' : '领取'}
                    </button>
                ) : (
                    <button
                        type="button"
                        className="ghost"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDetail(!showDetail);
                        }}
                    >
                        {showDetail ? (lang === 'en' ? 'Hide' : '收起') : lang === 'en' ? 'Details' : '详情'}
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
                    {!claims.length && (
                        <div className="red-packet-detail__empty">{lang === 'en' ? 'No claims yet' : '暂无人领取'}</div>
                    )}
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
