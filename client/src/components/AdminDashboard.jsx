import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Ban, Copy, Database, Key, RefreshCw, Search, Send, Shield, Trash2, Users } from 'lucide-react';

function badgeStyle(bg, color) {
    return { display: 'inline-block', padding: '3px 8px', borderRadius: '999px', background: bg, color };
}

function formatStatus(status, isEn) {
    return status === 'banned' ? (isEn ? 'Banned' : '已封禁') : (isEn ? 'Active' : '正常');
}

function formatRole(role, isEn) {
    if (role === 'root') return isEn ? 'Root Admin' : '根管理员';
    if (role === 'admin') return isEn ? 'Admin' : '管理员';
    return isEn ? 'User' : '普通用户';
}

function timeAgo(timestamp, isEn) {
    if (!timestamp) return isEn ? 'Never' : '从未';
    const seconds = Math.floor((Date.now() - Number(timestamp)) / 1000);
    if (seconds < 60) return isEn ? `${seconds}s ago` : `${seconds} 秒前`;
    if (seconds < 3600) return isEn ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 60)} 分钟前`;
    if (seconds < 86400) return isEn ? `${Math.floor(seconds / 3600)}h ago` : `${Math.floor(seconds / 3600)} 小时前`;
    return isEn ? `${Math.floor(seconds / 86400)}d ago` : `${Math.floor(seconds / 86400)} 天前`;
}

function showActionError(setError, fallbackMessage, error) {
    const message = String(error || fallbackMessage || '操作失败').trim();
    setError(message);
    window.alert(message);
}

export default function AdminDashboard({ apiUrl }) {
    const { user, token } = useAuth();
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const tx = useCallback((en, zh) => (isEn ? en : zh), [isEn]);
    const [users, setUsers] = useState([]);
    const [inviteCodes, setInviteCodes] = useState([]);
    const [qdrantStatus, setQdrantStatus] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [busyUserId, setBusyUserId] = useState('');
    const [busyInviteCode, setBusyInviteCode] = useState('');
    const [copiedCode, setCopiedCode] = useState('');
    const [announcementMsg, setAnnouncementMsg] = useState('');
    const [userQuery, setUserQuery] = useState('');

    const cleanApiUrl = apiUrl.replace(/\/api\/?$/, '');
    const isAdmin = user?.role === 'root' || user?.role === 'admin';
    const isRoot = user?.role === 'root';
    const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/users`, { headers: authHeaders });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to load users', '加载用户失败'));
            setUsers(data.users || []);
        } catch (e) {
            setError(e.message || tx('Failed to load users', '加载用户失败'));
        }
    }, [authHeaders, cleanApiUrl, tx]);

    const fetchInvites = useCallback(async () => {
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/invites/all`, { headers: authHeaders });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to load invite codes', '加载邀请码失败'));
            setInviteCodes(data.codes || []);
        } catch (e) {
            setError(e.message || tx('Failed to load invite codes', '加载邀请码失败'));
        }
    }, [authHeaders, cleanApiUrl, tx]);

    const fetchQdrantStatus = useCallback(async () => {
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/qdrant/status`, { headers: authHeaders });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to load Qdrant status', '加载 Qdrant 状态失败'));
            setQdrantStatus(data.status || null);
        } catch (e) {
            setError(e.message || tx('Failed to load Qdrant status', '加载 Qdrant 状态失败'));
        }
    }, [authHeaders, cleanApiUrl, tx]);

    useEffect(() => {
        if (!isAdmin) return;
        fetchUsers();
        fetchInvites();
        fetchQdrantStatus();
    }, [isAdmin, fetchUsers, fetchInvites, fetchQdrantStatus]);

    const filteredUsers = useMemo(() => {
        const q = userQuery.trim().toLowerCase();
        if (!q) return users;
        return users.filter((item) =>
            String(item.username || '').toLowerCase().includes(q) ||
            String(item.id || '').toLowerCase().includes(q) ||
            String(item.role || '').toLowerCase().includes(q) ||
            String(item.status || '').toLowerCase().includes(q)
        );
    }, [userQuery, users]);

    const handleDeleteUser = async (target) => {
        if (!window.confirm(tx(
            `Danger: delete account "${target.username}" and wipe all of its data? This cannot be undone.`,
            `危险操作：确定删除账号「${target.username}」并清空其全部数据吗？此操作不可恢复。`
        ))) return;
        setBusyUserId(target.id);
        setError('');
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/users/${target.id}`, {
                method: 'DELETE',
                headers: authHeaders,
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to delete user', '删除用户失败'));
            setUsers((prev) => prev.filter((item) => item.id !== target.id));
            window.alert(tx(`Deleted user: ${target.username}`, `已删除用户：${target.username}`));
        } catch (e) {
            showActionError(setError, tx('Failed to delete user', '删除用户失败'), e?.message);
        } finally {
            setBusyUserId('');
        }
    };

    const handleToggleBan = async (target) => {
        const nextBanned = target.status !== 'banned';
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/users/${target.id}/ban`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ banned: nextBanned }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to update status', '更新状态失败'));
            setUsers((prev) => prev.map((item) => item.id === target.id ? { ...item, status: data.status } : item));
        } catch (e) {
            showActionError(setError, tx('Failed to update status', '更新状态失败'), e?.message);
        }
    };

    const handleRoleChange = async (target, role) => {
        if (target.role === role) return;
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/users/${target.id}/role`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to update role', '修改角色失败'));
            setUsers((prev) => prev.map((item) => item.id === target.id ? { ...item, role: data.role } : item));
        } catch (e) {
            showActionError(setError, tx('Failed to update role', '修改角色失败'), e?.message);
        }
    };

    const handleGenerateInvite = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/invites`, {
                method: 'POST',
                headers: authHeaders,
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to generate invite code', '生成邀请码失败'));
            await fetchInvites();
            window.alert(tx(`Invite code generated: ${data.code}`, `已生成邀请码：${data.code}`));
        } catch (e) {
            showActionError(setError, tx('Failed to generate invite code', '生成邀请码失败'), e?.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeInvite = async (code) => {
        if (!window.confirm(tx('Revoke this invite code?', '确定要撤销这条邀请码吗？'))) return;
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/invites/${code}`, {
                method: 'DELETE',
                headers: authHeaders,
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to revoke invite code', '撤销邀请码失败'));
            setInviteCodes((prev) => prev.filter((item) => item.code !== code));
        } catch (e) {
            showActionError(setError, tx('Failed to revoke invite code', '撤销邀请码失败'), e?.message);
        }
    };

    const handleRenewInvite = async (code) => {
        setBusyInviteCode(code);
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/invites/${code}/renew`, {
                method: 'POST',
                headers: authHeaders,
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to renew invite code', '续期邀请码失败'));
            if (data.invite) {
                setInviteCodes((prev) => prev.map((item) => item.code === code ? data.invite : item));
            } else {
                await fetchInvites();
            }
        } catch (e) {
            showActionError(setError, tx('Failed to renew invite code', '续期邀请码失败'), e?.message);
        } finally {
            setBusyInviteCode('');
        }
    };

    const handlePostAnnouncement = async () => {
        if (!announcementMsg.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/announcement`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: announcementMsg }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || tx('Failed to post announcement', '发布公告失败'));
            setAnnouncementMsg('');
            window.alert(tx('Site announcement posted.', '全站公告已发布'));
        } catch (e) {
            showActionError(setError, tx('Failed to post announcement', '发布公告失败'), e?.message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(''), 1500);
    };

    const formatInviteExpiry = (invite) => {
        const expiresAt = Number(invite?.expires_at || 0);
        if (!expiresAt) return tx('Never expires', '不过期');
        const dateText = new Date(expiresAt).toLocaleDateString();
        if (invite.expired) return isEn ? `${dateText} (expired)` : `${dateText}（已过期）`;
        const days = Number(invite.remaining_days || 0);
        return isEn ? `${dateText} (${days} days left)` : `${dateText}（剩 ${days} 天）`;
    };

    const formatInviteUsage = (invite) => {
        const maxUses = Number(invite?.max_uses || 0);
        const useCount = Number(invite?.use_count || 0);
        return maxUses > 0 ? `${useCount}/${maxUses}` : `${useCount}/${tx('unlimited', '不限')}`;
    };
    const activeUsers = users.filter((item) => item.status !== 'banned').length;
    const bannedUsers = users.filter((item) => item.status === 'banned').length;
    const usableInviteCodes = inviteCodes.filter((item) => !item.expired && item.status !== 'revoked').length;
    const refreshAll = () => {
        fetchUsers();
        fetchInvites();
        fetchQdrantStatus();
    };

    if (!isAdmin) {
        return <div className="admin-dashboard-page admin-dashboard-page--denied">{tx('You do not have permission to access the admin dashboard.', '无权访问管理员后台。')}</div>;
    }

    return (
        <div className="admin-dashboard-page admin-command-page">
            <header className="admin-command-hero command-page-hero">
                <div className="command-page-title">
                    <div className="command-page-kicker"><Shield size={17} /> {isRoot ? tx('Root Console', '根管理员控制台') : tx('Admin Console', '管理员控制台')}</div>
                    <h1>{isRoot ? tx('Root Admin Dashboard', '根管理员后台') : tx('Admin Dashboard', '管理员后台')}</h1>
                    <p>{tx('Manage accounts, invite codes, announcements, and memory-vector health from one operational surface.', '集中管理账号、邀请码、全站公告和记忆向量服务状态。')}</p>
                </div>
                <div className="command-page-hero-actions">
                    <button type="button" className="command-icon-button" onClick={refreshAll} title={tx('Refresh all admin data', '刷新全部后台数据')}>
                        <RefreshCw size={17} />
                    </button>
                </div>
                <div className="command-page-metrics admin-command-metrics">
                    <div>
                        <span>{tx('Users', '用户')}</span>
                        <strong>{users.length}</strong>
                    </div>
                    <div>
                        <span>{tx('Active', '正常')}</span>
                        <strong>{activeUsers}</strong>
                    </div>
                    <div>
                        <span>{tx('Banned', '已封禁')}</span>
                        <strong>{bannedUsers}</strong>
                    </div>
                    <div>
                        <span>{tx('Usable Invites', '可用邀请码')}</span>
                        <strong>{usableInviteCodes}</strong>
                    </div>
                </div>
            </header>

            {error && <div className="command-alert command-alert--danger">{error}</div>}

            <div className="admin-command-workspace command-page-workspace">
                <aside className="admin-command-rail command-page-rail">
                    <section className="command-card admin-command-status-card">
                        <div className="command-card-title">
                            <h2><Database size={19} /> {tx('Qdrant Status', 'Qdrant 状态')}</h2>
                            <button type="button" className="command-icon-button compact" onClick={fetchQdrantStatus} title={tx('Refresh', '刷新')}>
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        <div className="admin-command-status-grid">
                            <div>
                                <span>{tx('Reachability', '连通性')}</span>
                                <strong className={qdrantStatus?.reachable ? 'online' : 'offline'}>{qdrantStatus?.reachable ? tx('Online', '在线') : tx('Offline', '离线')}</strong>
                            </div>
                            <div>
                                <span>{tx('Mode', '模式')}</span>
                                <strong>{qdrantStatus?.mode || '-'}</strong>
                            </div>
                            <div>
                                <span>{tx('Collections', '集合')}</span>
                                <strong>{qdrantStatus?.collectionsCount ?? '-'}</strong>
                            </div>
                            <div>
                                <span>{tx('Indexed Points', '已索引点数')}</span>
                                <strong>{Number(qdrantStatus?.indexedPoints || 0).toLocaleString()}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="command-card admin-command-announcement-card">
                        <div className="command-card-title">
                            <h2><Send size={19} /> {tx('Site Announcement', '全站公告')}</h2>
                        </div>
                        <div className="admin-command-announcement-form">
                            <input value={announcementMsg} onChange={(e) => setAnnouncementMsg(e.target.value)} placeholder={tx('Send an announcement to all users...', '向所有用户发送一条公告...')} />
                            <button type="button" className="command-primary-button" onClick={handlePostAnnouncement} disabled={loading || !announcementMsg.trim()}>{tx('Post', '发布')}</button>
                        </div>
                    </section>
                </aside>

                <main className="admin-command-main command-page-main">
                    <section className="command-card admin-command-invite-card">
                        <div className="command-card-title">
                            <h2><Key size={19} /> {tx('Invite Code Management', '邀请码管理')}</h2>
                            <button type="button" className="command-primary-button" onClick={handleGenerateInvite} disabled={loading}>{tx('Generate Invite Code', '生成邀请码')}</button>
                        </div>
                        <div className="admin-command-invite-list">
                            {inviteCodes.length === 0 && <div className="command-empty">{tx('No invite codes yet.', '还没有邀请码。')}</div>}
                            {inviteCodes.map((invite) => (
                                <div key={invite.code} className="admin-command-invite-row">
                                    <div>
                                        <div className="admin-command-code">{invite.code}</div>
                                        <div className="admin-command-meta">
                                            <span>{tx('Status', '状态')}：{invite.expired ? tx('Expired', '已过期') : (invite.status || 'active')}</span>
                                            <span>{tx('Expires', '有效期')}：{formatInviteExpiry(invite)}</span>
                                            <span>{tx('Usage', '使用')}：{formatInviteUsage(invite)}</span>
                                        </div>
                                    </div>
                                    <div className="admin-command-row-actions">
                                        <button type="button" className="command-icon-button compact" onClick={() => copyToClipboard(invite.code)} title={tx('Copy invite code', '复制邀请码')}>{copiedCode === invite.code ? <Ban size={17} /> : <Copy size={17} />}</button>
                                        <button
                                            type="button"
                                            className="command-icon-button compact"
                                            onClick={() => handleRenewInvite(invite.code)}
                                            disabled={busyInviteCode === invite.code}
                                            title={tx('Renew for 30 days', '续期 30 天')}
                                        >
                                            <RefreshCw size={17} />
                                        </button>
                                        <button type="button" className="command-icon-button compact danger" onClick={() => handleRevokeInvite(invite.code)} title={tx('Revoke invite code', '撤销邀请码')}><Trash2 size={17} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="command-card admin-command-users-card">
                        <div className="command-card-title">
                            <h2><Users size={19} /> {tx('User Management', '用户管理')}</h2>
                            <label className="admin-command-search">
                                <Search size={16} />
                                <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder={tx('Search username / ID / role / status', '搜索用户名 / ID / 角色 / 状态')} />
                            </label>
                        </div>

                        <div className="admin-command-table-wrap">
                            <table className="admin-command-table">
                        <thead>
                            <tr>
                                <th>{tx('Username', '用户名')}</th>
                                <th>{tx('Role', '角色')}</th>
                                <th>{tx('Status', '状态')}</th>
                                <th>{tx('Last Active', '最近活跃')}</th>
                                <th>{tx('Actions', '操作')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <div className="admin-command-username">{item.username}</div>
                                        <div className="admin-command-user-id">{item.id}</div>
                                    </td>
                                    <td>
                                        {isRoot && item.role !== 'root' ? (
                                            <select value={item.role || 'user'} onChange={(e) => handleRoleChange(item, e.target.value)}>
                                                <option value="user">{tx('User', '普通用户')}</option>
                                                <option value="admin">{tx('Admin', '管理员')}</option>
                                            </select>
                                        ) : formatRole(item.role, isEn)}
                                    </td>
                                    <td>
                                        <span style={item.status === 'banned' ? badgeStyle('rgba(239,68,68,0.12)', 'var(--danger)') : badgeStyle('rgba(34,197,94,0.12)', 'var(--success)')}>
                                            {formatStatus(item.status, isEn)}
                                        </span>
                                    </td>
                                    <td>{timeAgo(item.last_active_at, isEn)}</td>
                                    <td>
                                        {item.role !== 'root' && (
                                            <div className="admin-command-row-actions">
                                                <button type="button" className="command-icon-button compact warning" onClick={() => handleToggleBan(item)} title={tx('Ban / Unban', '封禁 / 解封')}>
                                                    <Ban size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="command-icon-button compact danger"
                                                    onClick={() => handleDeleteUser(item)}
                                                    title={busyUserId === item.id ? tx('Deleting...', '删除中...') : tx('Delete user and wipe data', '删除用户并清空数据')}
                                                    disabled={busyUserId === item.id}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
