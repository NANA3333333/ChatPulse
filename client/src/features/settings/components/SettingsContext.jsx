import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { resolveAvatarUrl, defaultAvatarUrl } from '../../../shared/media/avatar.js';
import {
    CircleCheck,
    TriangleAlert,
    FileText,
    MessageSquare,
    AudioWaveform,
    RefreshCw,
    Database,
    Activity,
    Cloud,
    UsersRound,
    Edit3,
} from 'lucide-react';

export function SettingsContext({
    activePreviewContact,
    lang,
    apiUrl,
    activeReadiness,
    activePreviewDescription,
    activePreviewTtsProviderLabel,
    controlHasContextLimitChange,
    controlHasModelChange,
    controlHasVoiceChange,
    loadServiceDiagnostics,
    serviceDiagnosticsLoading,
    serviceDiagnosticsError,
    serviceDiagnostics,
    setActiveSettingsScreen,
    openCharacterEditor,
}) {
    return (
        <aside className="settings-guided-context">
            <div className="settings-context-heading">
                <span className="settings-guided-kicker">LIVE PREVIEW</span>
                <h2>{activePreviewContact?.name || (lang === 'en' ? 'No character selected' : '未选择角色')}</h2>
            </div>
            {activePreviewContact ? (
                <>
                    <section className="settings-context-preview">
                        <div className="settings-context-portrait">
                            <AvatarWithFrame
                                size={86}
                                frame={activePreviewContact.avatar_frame}
                                src={resolveAvatarUrl(
                                    activePreviewContact.avatar,
                                    apiUrl,
                                    activePreviewContact.name || activePreviewContact.id || 'User',
                                )}
                                fallbackSrc={defaultAvatarUrl(
                                    activePreviewContact.name || activePreviewContact.id || 'User',
                                )}
                                alt={activePreviewContact.name}
                            />
                        </div>
                        <div>
                            <h3>{activePreviewContact.name}</h3>
                            <span
                                className={`settings-character-status ${activeReadiness?.ready ? 'online' : 'offline'}`}
                            >
                                <i />
                                {activeReadiness?.ready
                                    ? lang === 'en'
                                        ? 'Ready'
                                        : '可用'
                                    : lang === 'en'
                                      ? 'Needs setup'
                                      : '待处理'}
                            </span>
                            <p>
                                {activePreviewDescription ||
                                    (lang === 'en' ? 'No persona description yet.' : '暂未填写角色描述。')}
                            </p>
                        </div>
                    </section>
                    <section className="settings-context-panel">
                        <h3>{lang === 'en' ? 'Readiness check' : '就绪检查'}</h3>
                        <div className="settings-context-checks">
                            {[
                                [activeReadiness?.personaReady, lang === 'en' ? 'Persona complete' : '人设完整'],
                                [
                                    activeReadiness?.mainModelReady,
                                    `${lang === 'en' ? 'Main model' : '主模型'} ${activePreviewContact.model_name || ''}`,
                                ],
                                [
                                    activeReadiness?.memoryModelReady,
                                    `${lang === 'en' ? 'Memory model' : '记忆模型'} ${activePreviewContact.memory_model_name || ''}`,
                                ],
                                [
                                    !activeReadiness?.ttsEnabled || activeReadiness?.ttsConfigured,
                                    activeReadiness?.ttsEnabled
                                        ? `${lang === 'en' ? 'Voice configured' : '声音已配置'} ${activePreviewTtsProviderLabel}`
                                        : lang === 'en'
                                          ? 'Voice optional'
                                          : '声音未启用',
                                ],
                                [
                                    !activeReadiness?.ttsEnabled || activeReadiness?.ttsPreviewVerified,
                                    lang === 'en' ? 'Voice preview in this session' : '本会话声音试听',
                                ],
                            ].map(([done, label]) => (
                                <p key={label} className={done ? '' : 'warning'}>
                                    {done ? <CircleCheck size={15} /> : <TriangleAlert size={15} />}
                                    <span>{label}</span>
                                </p>
                            ))}
                        </div>
                    </section>
                    <section className="settings-context-panel">
                        <h3>{lang === 'en' ? 'What changes affect' : '更改将影响的内容'}</h3>
                        {controlHasContextLimitChange && (
                            <article>
                                <span>
                                    <FileText size={16} />
                                </span>
                                <div>
                                    <strong>{lang === 'en' ? 'Context window changed' : '上下文窗口已改动'}</strong>
                                    <p>
                                        {lang === 'en'
                                            ? 'Saving clears summary cache and dialogue digest for this character.'
                                            : '保存后会清理该角色的摘要缓存和对话 digest。'}
                                    </p>
                                </div>
                            </article>
                        )}
                        {controlHasModelChange && (
                            <article>
                                <span>
                                    <MessageSquare size={16} />
                                </span>
                                <div>
                                    <strong>{lang === 'en' ? 'Model credentials changed' : '模型连接已改动'}</strong>
                                    <p>
                                        {lang === 'en'
                                            ? 'Blank keys keep saved credentials; clear actions remove them explicitly.'
                                            : '空白 Key 会保留旧凭证；只有清除操作会显式删除。'}
                                    </p>
                                </div>
                            </article>
                        )}
                        {controlHasVoiceChange && (
                            <article>
                                <span>
                                    <AudioWaveform size={16} />
                                </span>
                                <div>
                                    <strong>{lang === 'en' ? 'Voice config changed' : '声音配置已改动'}</strong>
                                    <p>
                                        {lang === 'en'
                                            ? 'Use preview to verify the Blob response before relying on TTS in chat.'
                                            : '建议先试听确认 Blob 音频可用，再在聊天里使用 TTS。'}
                                    </p>
                                </div>
                            </article>
                        )}
                        <article>
                            <span>
                                <RefreshCw size={16} />
                            </span>
                            <div>
                                <strong>{lang === 'en' ? 'Saving character settings' : '保存角色设置'}</strong>
                                <p>
                                    {lang === 'en'
                                        ? 'The proactive timer is stopped and rescheduled, but no AI reply is triggered immediately.'
                                        : '会停止并重排主动消息计时器，但不会立即触发 AI 回复。'}
                                </p>
                            </div>
                        </article>
                    </section>
                    <section className="settings-context-panel settings-diagnostics-panel">
                        <div className="settings-diagnostics-head">
                            <h3>{lang === 'en' ? 'Service diagnostics' : '服务诊断'}</h3>
                            <button type="button" onClick={loadServiceDiagnostics} disabled={serviceDiagnosticsLoading}>
                                <RefreshCw size={14} />
                                {serviceDiagnosticsLoading
                                    ? lang === 'en'
                                        ? 'Checking'
                                        : '检查中'
                                    : lang === 'en'
                                      ? 'Refresh'
                                      : '刷新'}
                            </button>
                        </div>
                        {serviceDiagnosticsError && (
                            <p className="settings-diagnostics-error">{serviceDiagnosticsError}</p>
                        )}
                        <div className="settings-diagnostics-grid">
                            <article>
                                <span>
                                    <Database size={16} />
                                </span>
                                <div>
                                    <strong>{lang === 'en' ? 'Embedding' : 'Embedding'}</strong>
                                    <p>
                                        {serviceDiagnostics.embedding?.embedding?.extractorState ||
                                            (lang === 'en' ? 'Unknown' : '未知')}
                                    </p>
                                    <small>
                                        {lang === 'en' ? 'Active' : '活跃'}{' '}
                                        {serviceDiagnostics.embedding?.embedding?.activeCount ?? '-'} · cache{' '}
                                        {serviceDiagnostics.embedding?.embedding?.cacheSize ?? '-'}
                                    </small>
                                </div>
                            </article>
                            <article>
                                <span>
                                    <Activity size={16} />
                                </span>
                                <div>
                                    <strong>{lang === 'en' ? 'Background queue' : '后台队列'}</strong>
                                    <p>
                                        {lang === 'en' ? 'Pending' : '待执行'}{' '}
                                        {serviceDiagnostics.queue?.stats?.pendingTasks ?? '-'}
                                    </p>
                                    <small>
                                        {lang === 'en' ? 'Workers' : 'Worker'}{' '}
                                        {serviceDiagnostics.queue?.stats?.activeWorkers ?? '-'} /{' '}
                                        {serviceDiagnostics.queue?.stats?.globalConcurrency ?? '-'}
                                    </small>
                                </div>
                            </article>
                            <article>
                                <span>
                                    <Cloud size={16} />
                                </span>
                                <div>
                                    <strong>{lang === 'en' ? 'Character cache' : '角色缓存'}</strong>
                                    <p>
                                        {lang === 'en' ? 'LLM entries' : 'LLM 条目'}{' '}
                                        {serviceDiagnostics.cache?.stats?.entries_count ?? '-'}
                                    </p>
                                    <small>
                                        {lang === 'en' ? 'Hits' : '命中'}{' '}
                                        {serviceDiagnostics.cache?.stats?.hit_count ?? '-'} · digest{' '}
                                        {serviceDiagnostics.cache?.stats?.digest_entries_count ?? '-'}
                                    </small>
                                </div>
                            </article>
                        </div>
                    </section>
                    <div className="settings-context-actions">
                        <button type="button" onClick={() => setActiveSettingsScreen('characters')}>
                            <UsersRound size={15} />
                            {lang === 'en' ? 'Characters' : '查看角色'}
                        </button>
                        <button
                            type="button"
                            className="primary"
                            onClick={() => {
                                setActiveSettingsScreen('characters');
                                openCharacterEditor(activePreviewContact);
                            }}
                        >
                            <Edit3 size={15} />
                            {lang === 'en' ? 'Edit' : '编辑'}
                        </button>
                    </div>
                </>
            ) : (
                <div className="settings-guided-empty">
                    {lang === 'en'
                        ? 'Create or select a character to see setup context.'
                        : '创建或选择角色后，这里会显示配置上下文。'}
                </div>
            )}
        </aside>
    );
}
