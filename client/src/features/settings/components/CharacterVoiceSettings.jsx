import { AudioWaveform, Trash2, RefreshCw, Volume2 } from 'lucide-react';
import {
    getTtsProviderConfig,
    TTS_PROVIDERS,
    translateTtsProviderConfig,
    inferTencentModelTier,
} from '../ttsProviders.js';
import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { resolveAvatarUrl, defaultAvatarUrl } from '../../../shared/media/avatar.js';

export function CharacterVoiceSettings({
    lang,
    activeCharacterDraft,
    updateCharacterDraft,
    editingContact,
    getSecretPlaceholder,
    getEditingTtsProviderConfig,
    getSecretStatusText,
    loadTencentVoices,
    tencentVoiceError,
    tencentVoiceSource,
    tencentVoiceSourceLabel,
    apiUrl,
    ttsPreviewText,
    setTtsPreviewVerifiedIds,
}) {
    return (
        <div className="settings-control-form-stack">
            <section className="settings-control-voice-hero">
                <div>
                    <span>
                        <AudioWaveform size={22} />
                    </span>
                    <div>
                        <span className="settings-guided-kicker">TEXT TO SPEECH</span>
                        <h2>
                            {lang === 'en'
                                ? `Give ${activeCharacterDraft.name || 'this character'} a voice`
                                : `让 ${activeCharacterDraft.name || '这个角色'} 拥有自己的声音`}
                        </h2>
                        <p>
                            {lang === 'en'
                                ? 'Preview uses temporary config and does not create a chat message.'
                                : '试听使用临时配置生成音频，不会写入聊天消息。'}
                        </p>
                    </div>
                </div>
                <label className="settings-control-switch">
                    <input
                        type="checkbox"
                        checked={activeCharacterDraft.tts_enabled === 1}
                        onChange={(event) => updateCharacterDraft({ tts_enabled: event.target.checked ? 1 : 0 })}
                    />
                    <span />
                </label>
            </section>
            <section className="settings-control-card">
                <div className="settings-control-form-grid two">
                    <label>
                        <span>{lang === 'en' ? 'TTS provider' : 'TTS 服务'}</span>
                        <select
                            value={activeCharacterDraft.tts_provider || 'tencent'}
                            onChange={(event) => {
                                const nextProvider = event.target.value;
                                const providerConfig = getTtsProviderConfig(nextProvider);
                                updateCharacterDraft({
                                    tts_provider: nextProvider,
                                    tts_voice: '',
                                    tts_model: providerConfig.modelOptions?.[0]?.value || '',
                                    tts_api_key: '',
                                    tts_api_key_clear: false,
                                });
                            }}
                        >
                            {TTS_PROVIDERS.map((provider) => {
                                const translated = translateTtsProviderConfig(provider, lang);
                                return (
                                    <option value={provider.id} key={provider.id}>
                                        {translated.label}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Trigger mode' : '触发方式'}</span>
                        <select
                            value={activeCharacterDraft.tts_trigger_mode || 'tagged'}
                            onChange={(event) => updateCharacterDraft({ tts_trigger_mode: event.target.value })}
                        >
                            <option value="tagged">
                                {lang === 'en' ? 'Main-model TTS tag only' : '仅主模型 TTS 标签'}
                            </option>
                            <option value="all_private">
                                {lang === 'en' ? 'Every private reply' : '每条私聊回复'}
                            </option>
                        </select>
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'TTS API key' : 'TTS API 凭据'}</span>
                        <input
                            type="password"
                            value={editingContact?.tts_api_key || ''}
                            onChange={(event) =>
                                updateCharacterDraft({ tts_api_key: event.target.value, tts_api_key_clear: false })
                            }
                            placeholder={getSecretPlaceholder(
                                activeCharacterDraft,
                                'tts_api_key',
                                getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).keyHint,
                            )}
                        />
                        <small>{getSecretStatusText(activeCharacterDraft, 'tts_api_key')}</small>
                        {activeCharacterDraft.tts_api_key_configured && (
                            <button
                                type="button"
                                className="settings-control-text-button danger"
                                onClick={() => updateCharacterDraft({ tts_api_key: '', tts_api_key_clear: true })}
                            >
                                <Trash2 size={12} />
                                {lang === 'en' ? 'Clear saved key' : '清除已保存 Key'}
                            </button>
                        )}
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Voice' : '音色'}</span>
                        <div className="settings-control-inline-field">
                            <input
                                value={activeCharacterDraft.tts_voice || ''}
                                onChange={(event) => updateCharacterDraft({ tts_voice: event.target.value })}
                                placeholder={getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).voiceHint}
                            />
                            {activeCharacterDraft.tts_provider === 'tencent' && (
                                <button type="button" onClick={() => loadTencentVoices(true)}>
                                    <RefreshCw size={14} />
                                    {lang === 'en' ? 'Voices' : '音色'}
                                </button>
                            )}
                        </div>
                        {getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).voiceOptions?.length > 0 && (
                            <select
                                value=""
                                onChange={(event) =>
                                    updateCharacterDraft({
                                        tts_voice: event.target.value,
                                        ...(activeCharacterDraft.tts_provider === 'tencent'
                                            ? {
                                                  tts_model:
                                                      inferTencentModelTier(
                                                          getEditingTtsProviderConfig(
                                                              activeCharacterDraft.tts_provider,
                                                          ).voiceOptions.find(
                                                              (option) => option.value === event.target.value,
                                                          ),
                                                      ) || activeCharacterDraft.tts_model,
                                              }
                                            : {}),
                                    })
                                }
                            >
                                <option value="" disabled>
                                    {lang === 'en' ? 'Select built-in voice' : '选择内置音色'}
                                </option>
                                {getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).voiceOptions.map(
                                    (option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ),
                                )}
                            </select>
                        )}
                        {tencentVoiceError && <small className="settings-control-error">{tencentVoiceError}</small>}
                        {!tencentVoiceError && tencentVoiceSource && (
                            <small>{tencentVoiceSourceLabel(tencentVoiceSource)}</small>
                        )}
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Model / tier' : '模型 / 档位'}</span>
                        <input
                            value={activeCharacterDraft.tts_model || ''}
                            onChange={(event) => updateCharacterDraft({ tts_model: event.target.value })}
                            placeholder={getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).modelHint}
                        />
                    </label>
                    <label>
                        <span>{lang === 'en' ? 'Endpoint / region' : 'Endpoint / 地域'}</span>
                        <input
                            value={activeCharacterDraft.tts_endpoint || ''}
                            onChange={(event) => updateCharacterDraft({ tts_endpoint: event.target.value })}
                            placeholder="optional"
                        />
                    </label>
                    <label className="settings-control-check-line">
                        <input
                            type="checkbox"
                            checked={activeCharacterDraft.tts_autoplay === 1}
                            onChange={(event) => updateCharacterDraft({ tts_autoplay: event.target.checked ? 1 : 0 })}
                        />
                        <span>
                            <strong>{lang === 'en' ? 'Auto-play when generated' : '生成后自动播放'}</strong>
                            <small>
                                {lang === 'en'
                                    ? 'May be limited by browser autoplay policy.'
                                    : '可能受浏览器自动播放策略限制。'}
                            </small>
                        </span>
                    </label>
                </div>
            </section>
            <section className="settings-control-tts-preview">
                <div className="settings-control-preview-avatar">
                    <AvatarWithFrame
                        size={56}
                        frame={activeCharacterDraft.avatar_frame}
                        src={resolveAvatarUrl(
                            activeCharacterDraft.avatar,
                            apiUrl,
                            activeCharacterDraft.name || activeCharacterDraft.id || 'User',
                        )}
                        fallbackSrc={defaultAvatarUrl(activeCharacterDraft.name || activeCharacterDraft.id || 'User')}
                        alt=""
                    />
                </div>
                <div>
                    <strong>{ttsPreviewText(activeCharacterDraft.name)}</strong>
                    <small>
                        {lang === 'en'
                            ? 'Preview returns an audio Blob and will not save a message.'
                            : '试听返回音频 Blob，不会保存为消息。'}
                    </small>
                </div>
                <button
                    type="button"
                    disabled={activeCharacterDraft.tts_enabled !== 1 || !activeCharacterDraft.id}
                    onClick={async () => {
                        try {
                            const res = await fetch(`${apiUrl}/tts/preview/${activeCharacterDraft.id}`, {
                                method: 'POST',
                                headers: {
                                    Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    text: ttsPreviewText(activeCharacterDraft.name),
                                    config: {
                                        tts_provider: activeCharacterDraft.tts_provider || 'tencent',
                                        tts_api_key: editingContact?.tts_api_key || '',
                                        tts_voice: activeCharacterDraft.tts_voice || '',
                                        tts_model: activeCharacterDraft.tts_model || '',
                                        tts_endpoint: activeCharacterDraft.tts_endpoint || '',
                                        tts_enabled: activeCharacterDraft.tts_enabled === 1 ? 1 : 0,
                                    },
                                }),
                            });
                            if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                throw new Error(data.error || `HTTP ${res.status}`);
                            }
                            const blob = await res.blob();
                            const objectUrl = URL.createObjectURL(blob);
                            const audio = new Audio(objectUrl);
                            audio.onended = () => URL.revokeObjectURL(objectUrl);
                            audio.onerror = () => URL.revokeObjectURL(objectUrl);
                            await audio.play();
                            setTtsPreviewVerifiedIds((prev) => new Set(prev).add(activeCharacterDraft.id));
                        } catch (e) {
                            alert((lang === 'en' ? 'Preview failed: ' : '试听失败：') + (e.message || e));
                        }
                    }}
                >
                    <Volume2 size={16} />
                    {lang === 'en' ? 'Preview voice' : '试听声音'}
                </button>
            </section>
        </div>
    );
}
