import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Shield, Users, Key, Copy, CheckCircle, RefreshCw } from 'lucide-react';

function AdminDashboard({ apiUrl }) {
    const { user, token } = useAuth();
    const [users, setUsers] = useState([]);
    const [inviteCodes, setInviteCodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copiedCode, setCopiedCode] = useState('');

    const cleanApiUrl = apiUrl.replace(/\/api\/?$/, '');

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
            } else {
                setError(data.error);
            }
        } catch (e) {
            setError('Failed to load users');
        }
    };

    useEffect(() => {
        // Only fetch if admin
        if (user?.username === 'Nana') {
            fetchUsers();
        }
    }, [user, token, cleanApiUrl]);

    const handleGenerateInvite = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${cleanApiUrl}/api/admin/invites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                // Add to local state to show it immediately
                setInviteCodes(prev => [{ code: data.code, used_by: null, created_at: Date.now() }, ...prev]);
            } else {
                setError(data.error);
            }
        } catch (e) {
            setError('Failed to generate invite code');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedCode(text);
        setTimeout(() => setCopiedCode(''), 2000);
    };

    if (user?.username !== 'Nana') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--danger)' }}>
                <h2>⛔ Access Denied</h2>
            </div>
        );
    }

    return (
        <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto', overflowY: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px', color: 'var(--text-primary)' }}>
                <Shield size={32} color="var(--primary)" />
                <h1 style={{ margin: 0 }}>Root Admin Dashboard</h1>
            </div>

            {error && <div style={{ padding: '15px', background: '#ffebeb', color: 'var(--danger)', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '24px', marginBottom: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: 'var(--text-primary)' }}>
                        <Key size={20} /> Invite Codes
                    </h2>
                    <button
                        onClick={handleGenerateInvite}
                        disabled={loading}
                        style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                    >
                        {loading ? <RefreshCw size={16} className="fa-spin" /> : <Shield size={16} />}
                        Generate New Code
                    </button>
                </div>

                {inviteCodes.length > 0 && (
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {inviteCodes.map(invite => (
                            <div key={invite.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px', color: 'var(--accent-color)' }}>
                                    {invite.code}
                                </div>
                                <button
                                    onClick={() => copyToClipboard(invite.code)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedCode === invite.code ? 'var(--success)' : 'var(--text-secondary)' }}
                                >
                                    {copiedCode === invite.code ? <CheckCircle size={20} /> : <Copy size={20} />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {inviteCodes.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No invites generated in this session yet.</p>}
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: 'var(--text-primary)' }}>
                        <Users size={20} /> Registered Citizens
                    </h2>
                    <button onClick={fetchUsers} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Refresh Users">
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text-primary)' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--card-border)' }}>
                                <th style={{ padding: '12px 8px' }}>Username</th>
                                <th style={{ padding: '12px 8px' }}>ID (Database Profile)</th>
                                <th style={{ padding: '12px 8px' }}>Joined Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <td style={{ padding: '12px 8px', fontWeight: '500' }}>
                                        {u.username}
                                        {u.username === 'Nana' && <span style={{ marginLeft: '8px', fontSize: '10px', background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '10px' }}>ROOT</span>}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{u.id}</td>
                                    <td style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{new Date(u.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {users.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>Loading users...</p>}
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;
