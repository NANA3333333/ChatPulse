import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';

const PIXEL_ASSET_BASE = '/assets/ui/login-pixel';
const WORDMARK_SLICES = [
    ['C', 'chatpulse-wordmark-slice-0-c.png'],
    ['h', 'chatpulse-wordmark-slice-1-h.png'],
    ['a', 'chatpulse-wordmark-slice-2-a.png'],
    ['t', 'chatpulse-wordmark-slice-3-t.png'],
    ['P', 'chatpulse-wordmark-slice-4-p.png'],
    ['u', 'chatpulse-wordmark-slice-5-u.png'],
    ['l', 'chatpulse-wordmark-slice-6-l.png'],
    ['s', 'chatpulse-wordmark-slice-7-s.png'],
    ['e', 'chatpulse-wordmark-slice-8-e.png'],
];

const pixelAsset = (fileName) => `${PIXEL_ASSET_BASE}/${fileName}`;

function PixelWordmark() {
    return (
        <span className="login-wordmark-main" aria-label="ChatPulse" role="img">
            {WORDMARK_SLICES.map(([letter, fileName], index) => (
                <span
                    key={`${letter}-${index}`}
                    className="login-wordmark-letter"
                    aria-hidden="true"
                    style={{ '--letter-index': index }}
                >
                    <img
                        className="login-wordmark-letter-img"
                        src={pixelAsset(`${fileName}?v=preview-sliced-20260625`)}
                        alt=""
                    />
                </span>
            ))}
        </span>
    );
}

function ChatPulseMark() {
    return (
        <div className="login-logo" aria-hidden="true">
            <img className="login-logo-image" src={pixelAsset('chatpulse-bubble-preview.png?v=preview-crop-20260625')} alt="" />
        </div>
    );
}

function Login({ apiUrl }) {
    const { login } = useAuth();
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const hash = String(window.location.hash || '').replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const desktopToken = params.get('cp_desktop_token');
        if (!desktopToken) return;

        const nextUrl = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', nextUrl || '/');

        let cancelled = false;
        const bootstrapDesktopSession = async () => {
            setLoading(true);
            setError('');
            try {
                const cleanApiUrl = apiUrl.replace(/\/api\/?$/, '');
                const res = await fetch(`${cleanApiUrl}/api/desktop/session`, {
                    method: 'POST',
                    headers: { 'x-chatpulse-desktop-token': desktopToken }
                });
                const data = await res.json();
                if (cancelled) return;
                if (data.success) {
                    login(data.token, data.user);
                } else {
                    setError(data.error || 'Desktop session failed');
                }
            } catch {
                if (!cancelled) setError('Desktop session failed. Please restart ChatPulse.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        bootstrapDesktopSession();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, login]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

        try {
            const cleanApiUrl = apiUrl.replace(/\/api\/?$/, '');
            const payload = isRegistering ? { username, password, inviteCode } : { username, password };

            const res = await fetch(`${cleanApiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                login(data.token, data.user);
            } else {
                setError(data.error || 'Authentication failed');
            }
        } catch {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <main className="login-layout">
                <section className="login-brand-panel" aria-label="ChatPulse">
                    <ChatPulseMark />
                    <PixelWordmark />
                </section>

                <section className={`login-card ${isRegistering ? 'is-registering' : ''}`}>
                    <div className="login-card-inner">
                        <div className="login-mode-switch" role="tablist" aria-label={isEn ? 'Authentication mode' : '登录方式'}>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={!isRegistering}
                                className={!isRegistering ? 'active' : ''}
                                onClick={() => { setIsRegistering(false); setError(''); }}
                            >
                                <span className="login-tab-text">{isEn ? 'Sign In' : '登录'}</span>
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={isRegistering}
                                className={isRegistering ? 'active' : ''}
                                onClick={() => { setIsRegistering(true); setError(''); }}
                            >
                                <span className="login-tab-text">{isEn ? 'Sign Up' : '注册'}</span>
                            </button>
                        </div>

                        <form className="login-form" onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label htmlFor="login-username">
                                    <span className="login-label-text">{isEn ? 'Account' : '账号'}</span>
                                </label>
                                <div className="login-input-shell is-account">
                                    <input
                                        id="login-username"
                                        type="text"
                                        required
                                        autoComplete="username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.trim())}
                                        placeholder={isEn ? 'Enter your account' : '输入你的账号'}
                                    />
                                    <span className="login-placeholder-img" aria-hidden="true">
                                        {isEn ? 'Enter your account' : '输入你的账号'}
                                    </span>
                                </div>
                            </div>
                            <div className="input-group">
                                <label htmlFor="login-password">
                                    <span className="login-label-text">{isEn ? 'Password' : '密码'}</span>
                                </label>
                                <div className="login-input-shell is-password">
                                    <input
                                        id="login-password"
                                        type="password"
                                        required
                                        autoComplete={isRegistering ? 'new-password' : 'current-password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={isEn ? 'Enter password' : '输入密码'}
                                    />
                                    <span className="login-placeholder-img" aria-hidden="true">
                                        {isEn ? 'Enter password' : '输入密码'}
                                    </span>
                                </div>
                            </div>

                            {isRegistering && (
                                <div className="input-group">
                                    <label htmlFor="login-invite">
                                        <span className="login-label-text">{isEn ? 'Invite Code' : '邀请码'}</span>
                                        <span className="login-hint-text">{isEn ? 'Required for sign-up' : '注册时必填'}</span>
                                    </label>
                                    <div className="login-input-shell is-invite">
                                        <input
                                            id="login-invite"
                                            type="text"
                                            value={inviteCode}
                                            onChange={(e) => setInviteCode(e.target.value.trim())}
                                            placeholder={isEn ? 'Enter invite code' : '输入邀请码'}
                                            required
                                        />
                                        <span className="login-placeholder-img" aria-hidden="true">
                                            {isEn ? 'Enter invite code' : '输入邀请码'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {error && <div className="login-error" role="alert">{error}</div>}

                            <button type="submit" className="login-submit-btn" disabled={loading} aria-busy={loading}>
                                {loading ? (
                                    <span className="login-loading-pips" aria-label={isEn ? 'Loading' : '加载中'}>
                                        <i></i>
                                        <i></i>
                                        <i></i>
                                    </span>
                                ) : (
                                    <>
                                        <span className="login-submit-text">
                                            {isRegistering ? (isEn ? 'Sign Up' : '注册') : (isEn ? 'Sign In' : '登录')}
                                        </span>
                                        <span className="login-submit-pips" aria-hidden="true">
                                            <i></i>
                                            <i></i>
                                            <i></i>
                                        </span>
                                    </>
                                )}
                            </button>
                        </form>

                    </div>
                </section>
            </main>
        </div>
    );
}

export default Login;
