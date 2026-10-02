import { FileText, Plus, Heart, RefreshCw, Edit3, Trash2, ShieldCheck } from 'lucide-react';
import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { resolveAvatarUrl, defaultAvatarUrl } from '../../../shared/media/avatar.js';

export function AccountSecuritySettings({
    activeSettingsScreen,
    lang,
    contacts,
    getCharacterOnline,
    getCharacterApiBadge,
    selectedSettingsContact,
    setSelectedSettingsContactId,
    apiUrl,
    formatCompactInteraction,
    onCharactersUpdate,
    handleWipeData,
    openCharacterEditor,
    handleDeleteContact,
    accountUsername,
    setAccountUsername,
    accountCurrentPassword,
    setAccountCurrentPassword,
    accountNewPassword,
    setAccountNewPassword,
    accountConfirmPassword,
    setAccountConfirmPassword,
    handleSaveAccount,
    accountSaving,
    accountError,
    accountMessage,
    selectedSettingsContactOnline,
    selectedContactDescription,
    selectedContactDetailRows,
}) {
    return (
        <div
            className={`settings-guided-screen settings-guided-existing-workspace is-${activeSettingsScreen}`}
            hidden={activeSettingsScreen !== 'security'}
        >
            <div className="settings-command-workspace">
                <main className="settings-command-main">
                    <section
                        id="settings-characters-section"
                        className="settings-card settings-characters-card settings-command-characters-card"
                    >
                        <div className="settings-card-title settings-card-title-row">
                            <h2>
                                <FileText size={20} />
                                {lang === 'en' ? 'Character Management' : '角色管理'}
                            </h2>
                            <button
                                type="button"
                                className="settings-secondary-button settings-add-character-button"
                                onClick={() =>
                                    alert(
                                        lang === 'en'
                                            ? 'Create a character from the Contacts page.'
                                            : '请在联系人页面创建角色。',
                                    )
                                }
                                title={
                                    lang === 'en'
                                        ? 'Create characters from the contacts page'
                                        : '请在联系人页面创建角色'
                                }
                            >
                                <Plus size={15} /> {lang === 'en' ? 'Add Character' : '添加角色'}
                            </button>
                        </div>
                        <div className="settings-character-workbench">
                            <div className="settings-character-list">
                                {contacts.map((c) => {
                                    const modelOnline = getCharacterOnline(c);
                                    const characterApiBadges = [
                                        getCharacterApiBadge(c, 'main'),
                                        getCharacterApiBadge(c, 'memory'),
                                    ];
                                    return (
                                        <div
                                            key={c.id}
                                            role="button"
                                            tabIndex={0}
                                            className={`settings-character-row ${c.is_blocked ? 'is-blocked' : ''} ${selectedSettingsContact?.id === c.id ? 'active' : ''}`}
                                            onClick={() => setSelectedSettingsContactId(c.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    setSelectedSettingsContactId(c.id);
                                                }
                                            }}
                                        >
                                            <AvatarWithFrame
                                                size={44}
                                                frame={c.avatar_frame}
                                                src={resolveAvatarUrl(c.avatar, apiUrl, c.name || c.id || 'User')}
                                                fallbackSrc={defaultAvatarUrl(c.name || c.id || 'User')}
                                                alt={c.name}
                                            />
                                            <div className="settings-character-main">
                                                <div className="settings-character-name-line">
                                                    <strong>{c.name}</strong>
                                                    <span
                                                        className={`settings-character-status ${modelOnline ? 'online' : 'offline'}`}
                                                    >
                                                        <i />
                                                        {modelOnline
                                                            ? lang === 'en'
                                                                ? 'Online'
                                                                : '在线'
                                                            : lang === 'en'
                                                              ? 'Offline'
                                                              : '离线'}
                                                    </span>
                                                </div>
                                                <div
                                                    className="settings-character-api-badges"
                                                    aria-label={
                                                        lang === 'en' ? 'Character API configuration' : '角色 API 配置'
                                                    }
                                                >
                                                    {characterApiBadges.map((badge) => (
                                                        <span
                                                            key={badge.label}
                                                            className={`settings-character-api-badge ${badge.isConfigured ? 'is-configured' : 'is-empty'}`}
                                                            title={badge.title}
                                                        >
                                                            <b>{badge.label}</b>
                                                            <em>{badge.value}</em>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="settings-character-meta">
                                                <span className="settings-character-pill settings-character-affinity">
                                                    <span className="settings-character-pill-label">
                                                        <Heart size={14} /> {lang === 'en' ? 'Affinity' : '好感'}
                                                    </span>
                                                    <strong>{c.affinity} / 100</strong>
                                                </span>
                                                <span className="settings-character-pill">
                                                    <span className="settings-character-pill-label">
                                                        {lang === 'en' ? 'Wallet' : '余额'}
                                                    </span>
                                                    <strong>¥{Number(c.wallet ?? 0).toFixed(2)}</strong>
                                                </span>
                                                <span className="settings-character-pill settings-character-last">
                                                    <span className="settings-character-pill-label">
                                                        {lang === 'en' ? 'Last' : '互动'}
                                                    </span>
                                                    <strong>{formatCompactInteraction(c)}</strong>
                                                </span>
                                            </div>
                                            <div className="settings-character-actions">
                                                {!!c.is_blocked && (
                                                    <button
                                                        type="button"
                                                        className="settings-character-unblock-button"
                                                        onClick={async (event) => {
                                                            event.stopPropagation();
                                                            try {
                                                                await fetch(`${apiUrl}/characters`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        id: c.id,
                                                                        affinity: 60,
                                                                        is_blocked: 0,
                                                                    }),
                                                                });
                                                                onCharactersUpdate?.();
                                                            } catch (e) {
                                                                console.error(e);
                                                            }
                                                        }}
                                                        title={
                                                            lang === 'en'
                                                                ? 'Admin Unblock & Reset Affinity'
                                                                : '管理员解除拉黑并重置好感度'
                                                        }
                                                    >
                                                        {lang === 'en' ? 'Unblock' : '解除'}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleWipeData(c.id);
                                                    }}
                                                    title={
                                                        lang === 'en'
                                                            ? 'Wipe all data (Memories, Messages, etc)'
                                                            : '清空全部数据（记忆、消息等）'
                                                    }
                                                >
                                                    <RefreshCw size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        openCharacterEditor(c);
                                                    }}
                                                    title={
                                                        lang === 'en'
                                                            ? 'Edit API endpoint, model, persona, prompt'
                                                            : '编辑 API 接口、模型、人设和提示词'
                                                    }
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="danger"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDeleteContact(c.id);
                                                    }}
                                                    title={
                                                        lang === 'en'
                                                            ? 'Delete this character permanently'
                                                            : '永久删除这个角色'
                                                    }
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <section
                        id="settings-account-section"
                        className="settings-card settings-security-card settings-command-security-card"
                    >
                        <div className="settings-card-title settings-card-title-row">
                            <h2>
                                <ShieldCheck size={20} /> {lang === 'en' ? 'Account Security' : '账号安全'}
                            </h2>
                            <span>{lang === 'en' ? 'Protected' : '已保护'}</span>
                        </div>
                        <div className="settings-security-copy">
                            {lang === 'en'
                                ? 'Change your login username or password. Enter your current password to confirm.'
                                : '你可以修改登录账号或密码。保存前需要先输入当前密码确认。'}
                        </div>
                        <div className="settings-security-form">
                            <label>
                                <span>{lang === 'en' ? 'Login Username' : '登录账号'}</span>
                                <input
                                    type="text"
                                    value={accountUsername}
                                    onChange={(e) => setAccountUsername(e.target.value)}
                                />
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'Current Password' : '当前密码'}</span>
                                <input
                                    type="password"
                                    value={accountCurrentPassword}
                                    onChange={(e) => setAccountCurrentPassword(e.target.value)}
                                />
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'New Password' : '新密码'}</span>
                                <input
                                    type="password"
                                    value={accountNewPassword}
                                    onChange={(e) => setAccountNewPassword(e.target.value)}
                                    placeholder={lang === 'en' ? 'Leave blank' : '留空则不修改'}
                                />
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'Confirm New Password' : '确认新密码'}</span>
                                <input
                                    type="password"
                                    value={accountConfirmPassword}
                                    onChange={(e) => setAccountConfirmPassword(e.target.value)}
                                    placeholder={lang === 'en' ? 'Repeat new password' : '再次输入新密码'}
                                />
                            </label>
                        </div>
                        <div className="settings-security-footer">
                            <div className="settings-security-note">
                                {lang === 'en'
                                    ? 'Minimum password length: 5. Change the initial root password before sharing accounts.'
                                    : '密码最少 5 位。全新部署后，请先修改初始 root 密码再分发账号。'}
                            </div>
                            <button
                                className="settings-primary-button settings-security-save"
                                onClick={handleSaveAccount}
                                disabled={accountSaving}
                            >
                                {accountSaving
                                    ? lang === 'en'
                                        ? 'Saving...'
                                        : '保存中...'
                                    : lang === 'en'
                                      ? 'Save Account'
                                      : '修改安全设置'}
                            </button>
                        </div>
                        {accountError ? <div className="settings-form-error">{accountError}</div> : null}
                        {accountMessage ? <div className="settings-form-success">{accountMessage}</div> : null}
                    </section>
                </main>

                {selectedSettingsContact && (
                    <section className="settings-card settings-character-detail-card settings-command-detail-card">
                        <div className="settings-card-title settings-character-detail-title">
                            <h2>
                                <FileText size={20} />
                                {lang === 'en' ? 'Character Brief' : '角色简略介绍'}
                            </h2>
                            <button
                                type="button"
                                className="settings-icon-button"
                                onClick={() => openCharacterEditor(selectedSettingsContact)}
                                title={lang === 'en' ? 'Edit character' : '编辑角色'}
                            >
                                <Edit3 size={17} />
                            </button>
                        </div>
                        <aside className="settings-character-detail">
                            <div className="settings-character-detail-head">
                                <AvatarWithFrame
                                    size={72}
                                    frame={selectedSettingsContact.avatar_frame}
                                    src={resolveAvatarUrl(
                                        selectedSettingsContact.avatar,
                                        apiUrl,
                                        selectedSettingsContact.name || selectedSettingsContact.id || 'User',
                                    )}
                                    fallbackSrc={defaultAvatarUrl(
                                        selectedSettingsContact.name || selectedSettingsContact.id || 'User',
                                    )}
                                    alt={selectedSettingsContact.name}
                                />
                                <div>
                                    <h3>{selectedSettingsContact.name}</h3>
                                    <span
                                        className={`settings-character-status ${selectedSettingsContactOnline ? 'online' : 'offline'}`}
                                    >
                                        <i />
                                        {selectedSettingsContactOnline
                                            ? lang === 'en'
                                                ? 'Online'
                                                : '在线'
                                            : lang === 'en'
                                              ? 'Offline'
                                              : '离线'}
                                    </span>
                                </div>
                            </div>
                            <div className="settings-character-description">
                                <span>{lang === 'en' ? 'Character Description' : '角色描述'}</span>
                                <p>
                                    {selectedContactDescription ||
                                        (lang === 'en' ? 'No description yet.' : '暂未填写角色描述。')}
                                </p>
                            </div>
                            <dl className="settings-character-detail-list">
                                {selectedContactDetailRows.slice(0, 4).map(([label, value]) => (
                                    <div key={label}>
                                        <dt>{label}</dt>
                                        <dd title={String(value)}>{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <button
                                type="button"
                                className="settings-primary-button settings-character-detail-button"
                                onClick={() => openCharacterEditor(selectedSettingsContact)}
                            >
                                <Edit3 size={16} />
                                {lang === 'en' ? 'Edit Character Info' : '编辑角色信息'}
                            </button>
                        </aside>
                    </section>
                )}
            </div>
        </div>
    );
}
