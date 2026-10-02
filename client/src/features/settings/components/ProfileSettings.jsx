import { ChevronLeft, Wallet, CalendarDays, Activity, Edit3, Save, Image as ImageIcon } from 'lucide-react';
import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { resolveAvatarUrl, defaultAvatarUrl } from '../../../shared/media/avatar.js';

export function ProfileSettings({
    activeSettingsScreen,
    onBack,
    lang,
    profile,
    apiUrl,
    projectUsageDays,
    formatCompactInteractionTime,
    latestPlayerInteractionAt,
    setIsEditing,
    isEditing,
    editName,
    setEditName,
    editAvatar,
    setEditAvatar,
    handleFileUpload,
    renderAvatarFramePicker,
    editAvatarFrame,
    setEditAvatarFrame,
    editBanner,
    setEditBanner,
    editBio,
    setEditBio,
    handleSaveProfile,
    savingProfile,
    wallpaperOptionList,
    getWallpaperOptionLabel,
    selectedWallpaperOption,
    desktopWallpaper,
    onDesktopWallpaperChange,
    getWallpaperOptionDescription,
}) {
    return (
        <div className="settings-guided-screen" hidden={activeSettingsScreen !== 'profile'}>
            <section id="settings-profile-section" className="settings-card settings-command-profile-card">
                {onBack && (
                    <button
                        className="mobile-back-btn settings-command-back"
                        onClick={onBack}
                        title={lang === 'en' ? 'Back' : '返回'}
                    >
                        <ChevronLeft size={22} />
                    </button>
                )}
                <div className="settings-command-profile-main">
                    <AvatarWithFrame
                        size={100}
                        frame={profile.avatar_frame}
                        src={resolveAvatarUrl(profile.avatar, apiUrl, profile.name || 'User')}
                        fallbackSrc={defaultAvatarUrl(profile.name || 'User')}
                        alt="Me"
                    />
                    <div className="settings-command-profile-copy">
                        <div className="settings-profile-name-line">
                            <h3>{profile.name}</h3>
                            <span className="settings-character-status online">
                                <i />
                                {lang === 'en' ? 'Online' : '在线'}
                            </span>
                        </div>
                        <p>
                            {lang === 'en' ? 'Signature:' : '签名：'}
                            {profile.bio || (lang === 'en' ? 'Keep curious, keep warm.' : '保持好奇，保持热爱。')}
                        </p>
                    </div>
                </div>
                <div
                    className="settings-command-profile-stats"
                    aria-label={lang === 'en' ? 'Profile stats' : '档案统计'}
                >
                    <div className="settings-command-stat">
                        <Wallet size={25} />
                        <span>{lang === 'en' ? 'Wallet' : '钱包余额'}</span>
                        <strong>¥{Number(profile.wallet ?? 100).toFixed(2)}</strong>
                    </div>
                    <div className="settings-command-stat">
                        <CalendarDays size={27} />
                        <span>{lang === 'en' ? 'Days Used' : '已使用'}</span>
                        <strong>
                            {projectUsageDays} {lang === 'en' ? (projectUsageDays === 1 ? 'day' : 'days') : '天'}
                        </strong>
                    </div>
                    <div className="settings-command-stat">
                        <Activity size={27} />
                        <span>{lang === 'en' ? 'Last Interaction' : '最后互动'}</span>
                        <strong>
                            {formatCompactInteractionTime(
                                latestPlayerInteractionAt,
                                lang === 'en' ? 'No chat yet' : '暂无互动',
                            )}
                        </strong>
                    </div>
                </div>
                <button
                    className="settings-icon-text-button settings-command-edit-profile"
                    onClick={() => setIsEditing(true)}
                    title={lang === 'en' ? 'Edit your profile (name, avatar, bio)' : '编辑个人资料（名字、头像、签名）'}
                >
                    <Edit3 size={16} /> {lang === 'en' ? 'Edit Profile' : '编辑档案'}
                </button>

                {isEditing && (
                    <div className="settings-profile-edit settings-command-profile-edit">
                        <label>
                            <span>{lang === 'en' ? 'Name' : '名称'}</span>
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </label>
                        <label>
                            <span>{lang === 'en' ? 'Avatar URL or Upload' : '头像 URL 或上传'}</span>
                            <div className="settings-upload-row">
                                <input
                                    type="text"
                                    value={editAvatar}
                                    onChange={(e) => setEditAvatar(e.target.value)}
                                    placeholder="https://..."
                                />
                                <label className="settings-secondary-button">
                                    {lang === 'en' ? 'Upload' : '上传'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleFileUpload(e, setEditAvatar)}
                                    />
                                </label>
                            </div>
                        </label>
                        <label>
                            <span>{lang === 'en' ? 'Avatar Frame' : '头像框'}</span>
                            {renderAvatarFramePicker(
                                editAvatarFrame,
                                setEditAvatarFrame,
                                editAvatar,
                                editName || profile.name || 'User',
                            )}
                        </label>
                        <label>
                            <span>{lang === 'en' ? 'Banner URL or Upload' : '横幅 URL 或上传'}</span>
                            <div className="settings-upload-row">
                                <input
                                    type="text"
                                    value={editBanner}
                                    onChange={(e) => setEditBanner(e.target.value)}
                                    placeholder="https://..."
                                />
                                <label className="settings-secondary-button">
                                    {lang === 'en' ? 'Upload' : '上传'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleFileUpload(e, setEditBanner)}
                                    />
                                </label>
                            </div>
                        </label>
                        <label>
                            <span>{lang === 'en' ? 'Bio' : '个性签名'}</span>
                            <textarea
                                value={editBio}
                                onChange={(e) => setEditBio(e.target.value)}
                                placeholder={lang === 'en' ? "What's up?" : '今天想写点什么？'}
                            />
                        </label>
                        <div className="settings-form-actions">
                            <button
                                className="settings-primary-button"
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                                title={lang === 'en' ? 'Save profile changes' : '保存个人资料修改'}
                            >
                                <Save size={16} /> {lang === 'en' ? 'Save' : '保存'}
                            </button>
                            <button
                                className="settings-secondary-button"
                                onClick={() => setIsEditing(false)}
                                title={lang === 'en' ? 'Cancel editing' : '取消编辑'}
                            >
                                {lang === 'en' ? 'Cancel' : '取消'}
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {wallpaperOptionList.length > 0 && (
                <section id="settings-wallpaper-section" className="settings-card settings-wallpaper-card">
                    <div className="settings-card-title settings-card-title-row">
                        <div>
                            <h2>
                                <ImageIcon size={20} />
                                {lang === 'en' ? 'Desktop Wallpaper' : '桌面壁纸'}
                            </h2>
                            <p>{lang === 'en' ? 'Choose the desktop background style.' : '选择桌面的背景样式。'}</p>
                        </div>
                        <span>{getWallpaperOptionLabel(selectedWallpaperOption)}</span>
                    </div>
                    <div className="settings-wallpaper-options">
                        {wallpaperOptionList.map((option) => {
                            const selected = option.id === desktopWallpaper;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`settings-wallpaper-option ${selected ? 'active' : ''}`}
                                    onClick={() => onDesktopWallpaperChange?.(option.id)}
                                    aria-pressed={selected}
                                >
                                    <span
                                        className={`settings-wallpaper-preview settings-wallpaper-preview--${option.id}`}
                                        aria-hidden="true"
                                    />
                                    <span className="settings-wallpaper-copy">
                                        <strong>{getWallpaperOptionLabel(option)}</strong>
                                        <small>{getWallpaperOptionDescription(option)}</small>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
