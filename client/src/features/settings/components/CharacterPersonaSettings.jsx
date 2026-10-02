import { UserRound, Upload, Heart, FileText } from 'lucide-react';
import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { resolveAvatarUrl, defaultAvatarUrl } from '../../../shared/media/avatar.js';
import { getDefaultGuidelines } from '../profileDefaults.js';

export function CharacterPersonaSettings({
    lang,
    activeReadiness,
    activeCharacterDraft,
    apiUrl,
    handleFileUpload,
    updateCharacterDraft,
    selectedOriginalForDraft,
    renderAvatarFramePicker,
}) {
    return (
        <div className="settings-control-form-stack">
            <section className="settings-control-card">
                <div className="settings-control-card-title">
                    <div>
                        <span>
                            <UserRound size={18} />
                        </span>
                        <div>
                            <h2>{lang === 'en' ? 'Identity and appearance' : '身份与外观'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'Used by chats, contact lists, groups, and city scenes.'
                                    : '聊天、联系人、群聊和商业街都会使用这些信息。'}
                            </p>
                        </div>
                    </div>
                    <em>
                        {activeReadiness?.personaReady
                            ? lang === 'en'
                                ? 'Complete'
                                : '完整'
                            : lang === 'en'
                              ? 'Incomplete'
                              : '待补充'}
                    </em>
                </div>
                <div className="settings-control-avatar-row">
                    <AvatarWithFrame
                        size={88}
                        frame={activeCharacterDraft.avatar_frame}
                        src={resolveAvatarUrl(
                            activeCharacterDraft.avatar,
                            apiUrl,
                            activeCharacterDraft.name || activeCharacterDraft.id || 'User',
                        )}
                        fallbackSrc={defaultAvatarUrl(activeCharacterDraft.name || activeCharacterDraft.id || 'User')}
                        alt=""
                    />
                    <div>
                        <strong>{activeCharacterDraft.name || activeCharacterDraft.id}</strong>
                        <small>
                            {lang === 'en' ? 'PNG, JPG, GIF, WebP or URL' : '支持 PNG、JPG、GIF、WebP 或 URL'}
                        </small>
                        <div className="settings-control-inline-actions">
                            <label className="settings-control-ghost-button compact">
                                <Upload size={14} />
                                {lang === 'en' ? 'Upload avatar' : '上传头像'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(event) =>
                                        handleFileUpload(event, (url) => updateCharacterDraft({ avatar: url }))
                                    }
                                />
                            </label>
                        </div>
                    </div>
                </div>
                <div className="settings-control-form-grid two">
                    <label>
                        <span>
                            {lang === 'en' ? 'Character ID' : '角色 ID'} <em>{lang === 'en' ? 'Required' : '必填'}</em>
                        </span>
                        <input
                            value={activeCharacterDraft.id || ''}
                            onChange={(event) => updateCharacterDraft({ id: event.target.value })}
                            disabled={Boolean(selectedOriginalForDraft)}
                        />
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Name' : '角色名称'}</span>
                        <input
                            value={activeCharacterDraft.name || ''}
                            onChange={(event) => updateCharacterDraft({ name: event.target.value })}
                        />
                    </label>
                    <label className="full">
                        <span>{lang === 'en' ? 'Avatar URL' : '头像 URL'}</span>
                        <input
                            value={activeCharacterDraft.avatar || ''}
                            onChange={(event) => updateCharacterDraft({ avatar: event.target.value })}
                            placeholder="https://..."
                        />
                    </label>
                    <label className="full">
                        <span>{lang === 'en' ? 'Avatar frame' : '头像框'}</span>
                        {renderAvatarFramePicker(
                            activeCharacterDraft.avatar_frame,
                            (frameId) => updateCharacterDraft({ avatar_frame: frameId }),
                            activeCharacterDraft.avatar,
                            activeCharacterDraft.name || activeCharacterDraft.id || 'User',
                        )}
                    </label>
                </div>
            </section>

            <section className="settings-control-card">
                <div className="settings-control-card-title">
                    <div>
                        <span className="pink">
                            <Heart size={18} />
                        </span>
                        <div>
                            <h2>{lang === 'en' ? 'Persona and world' : '人格与世界观'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'Define how the character understands themself, you, and the story world.'
                                    : '决定角色如何理解自己、你和所在世界。'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="settings-control-form-grid">
                    <label>
                        <span>
                            {lang === 'en' ? 'Persona' : '人物设定'} <em>Persona</em>
                        </span>
                        <textarea
                            rows={6}
                            value={activeCharacterDraft.persona || ''}
                            onChange={(event) => updateCharacterDraft({ persona: event.target.value })}
                        />
                        <small>
                            {lang === 'en'
                                ? 'Personality, expression habits, values, and relationship with the user.'
                                : '描述性格、表达习惯、价值观以及和用户相处的方式。'}
                        </small>
                    </label>
                    <label>
                        <span>
                            {lang === 'en' ? 'World info' : '世界观'} <em>World Info</em>
                        </span>
                        <textarea
                            rows={6}
                            value={activeCharacterDraft.world_info || ''}
                            onChange={(event) => updateCharacterDraft({ world_info: event.target.value })}
                        />
                        <small>
                            {lang === 'en'
                                ? 'Places, people, rules, and background the character should know.'
                                : '角色知道哪些地点、人物、规则和故事背景。'}
                        </small>
                    </label>
                </div>
            </section>

            <section className="settings-control-card">
                <div className="settings-control-card-title">
                    <div>
                        <span className="mint">
                            <FileText size={18} />
                        </span>
                        <div>
                            <h2>{lang === 'en' ? 'System behavior rules' : '系统行为准则'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'Advanced prompt rules affect private chat, groups, diaries, and proactive messages.'
                                    : '高级提示词会影响私聊、群聊、日记和主动消息。'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="settings-control-text-button"
                        onClick={() => updateCharacterDraft({ system_prompt: getDefaultGuidelines(lang) })}
                    >
                        {lang === 'en' ? 'Restore default' : '恢复默认'}
                    </button>
                </div>
                <label className="settings-control-field">
                    <span>System Prompt</span>
                    <textarea
                        className="settings-control-code-area"
                        rows={9}
                        value={activeCharacterDraft.system_prompt || getDefaultGuidelines(lang)}
                        onChange={(event) => updateCharacterDraft({ system_prompt: event.target.value })}
                    />
                </label>
            </section>
        </div>
    );
}
