import { Monitor, RefreshCw, Smartphone, Laptop } from 'lucide-react';

export function SessionSettings({
    lang,
    loadSessions,
    sessionsLoading,
    sessionsError,
    sessions,
    formatSessionDevice,
    formatSessionMeta,
    revokeSession,
}) {
    return (
        <section className="settings-card settings-sessions-card">
            <div className="settings-card-title settings-card-title-row">
                <div>
                    <h2>
                        <Monitor size={20} /> {lang === 'en' ? 'Login Sessions' : '登录会话'}
                    </h2>
                    <p>
                        {lang === 'en'
                            ? 'Revoke unfamiliar devices without touching character data.'
                            : '发现陌生设备时，可以只撤销对应会话，不影响角色数据。'}
                    </p>
                </div>
                <button
                    type="button"
                    className="settings-secondary-button"
                    onClick={loadSessions}
                    disabled={sessionsLoading}
                >
                    <RefreshCw size={15} />{' '}
                    {sessionsLoading ? (lang === 'en' ? 'Refreshing' : '刷新中') : lang === 'en' ? 'Refresh' : '刷新'}
                </button>
            </div>
            {sessionsError && <div className="settings-form-error">{sessionsError}</div>}
            <div className="settings-session-list">
                {sessions.slice(0, 12).map((session, index) => {
                    const sessionId = session.id || session.session_id || session.token_id || String(index);
                    const isCurrent = session.current === true || session.is_current === true;
                    const Icon = /android|iphone|mobile|phone/i.test(formatSessionDevice(session))
                        ? Smartphone
                        : /mac|windows|linux|desktop|edge|chrome/i.test(formatSessionDevice(session))
                          ? Monitor
                          : Laptop;
                    return (
                        <div className="settings-session-row" key={sessionId}>
                            <span>
                                <Icon size={18} />
                            </span>
                            <div>
                                <strong>{formatSessionDevice(session)}</strong>
                                <small>{formatSessionMeta(session)}</small>
                            </div>
                            {isCurrent ? (
                                <em>{lang === 'en' ? 'Current' : '当前会话'}</em>
                            ) : (
                                <button type="button" onClick={() => revokeSession(sessionId, isCurrent)}>
                                    {lang === 'en' ? 'Revoke' : '撤销'}
                                </button>
                            )}
                        </div>
                    );
                })}
                {!sessionsLoading && sessions.length === 0 && (
                    <div className="settings-guided-empty">
                        {lang === 'en' ? 'No session records returned by the backend.' : '后端没有返回会话记录。'}
                    </div>
                )}
                {sessions.length > 12 && (
                    <div className="settings-guided-empty">
                        {lang === 'en'
                            ? `${sessions.length - 12} older sessions are hidden here. Use Refresh after revoking recent sessions.`
                            : `还有 ${sessions.length - 12} 条更早的会话已折叠；撤销近期会话后可刷新查看。`}
                    </div>
                )}
            </div>
        </section>
    );
}
