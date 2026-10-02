import { useState, useCallback, useEffect } from 'react';

export function useSettingsSessions({ apiUrl, lang, formatSettingsDate }) {
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsError, setSessionsError] = useState('');
    const loadSessions = useCallback(async () => {
        setSessionsLoading(true);
        setSessionsError('');
        try {
            const res = await fetch(`${apiUrl}/auth/sessions`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            const list = Array.isArray(data.sessions) ? data.sessions : Array.isArray(data) ? data : [];
            setSessions(list);
        } catch (e) {
            setSessionsError(e.message || (lang === 'en' ? 'Failed to load sessions.' : '会话列表加载失败。'));
        } finally {
            setSessionsLoading(false);
        }
    }, [apiUrl, lang]);

    const revokeSession = async (sessionId, isCurrent = false) => {
        if (!sessionId) return;
        const ok = window.confirm(
            isCurrent
                ? lang === 'en'
                    ? 'Revoke the current session? You may need to sign in again.'
                    : '确定撤销当前会话吗？你可能需要重新登录。'
                : lang === 'en'
                  ? 'Revoke this login session?'
                  : '确定撤销这个登录会话吗？',
        );
        if (!ok) return;
        try {
            const res = await fetch(`${apiUrl}/auth/sessions/${encodeURIComponent(sessionId)}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            await loadSessions();
        } catch (e) {
            setSessionsError(e.message || (lang === 'en' ? 'Failed to revoke session.' : '撤销会话失败。'));
        }
    };

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const formatSessionDevice = (session = {}) =>
        session.device ||
        session.user_agent_summary ||
        session.userAgent ||
        session.user_agent ||
        session.platform ||
        (lang === 'en' ? 'Unknown device' : '未知设备');

    const formatSessionMeta = (session = {}) =>
        [
            session.ip || session.ip_address,
            formatSettingsDate(
                session.last_active_at || session.updated_at || session.created_at,
                lang === 'en' ? 'No activity recorded' : '暂无活跃记录',
            ),
        ]
            .filter(Boolean)
            .join(' · ');

    return {
        loadSessions,
        sessionsLoading,
        sessionsError,
        sessions,
        formatSessionDevice,
        formatSessionMeta,
        revokeSession,
    };
}
