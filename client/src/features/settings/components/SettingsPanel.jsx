import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getTtsProviderConfig } from '../ttsProviders.js';
import { normalizeAvatarFrameId, AVATAR_FRAME_OPTIONS } from '../../../shared/media/avatarFrames.js';
import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { resolveAvatarUrl, defaultAvatarUrl } from '../../../shared/media/avatar.js';
import {
    UserRound,
    Shield,
    UsersRound,
    AudioWaveform,
    Database,
    Activity,
    ChevronRight,
    CircleDotDashed,
    CheckCircle2,
    Save,
    Plus,
    Heart,
    MessageSquare,
    PanelRightOpen,
    X,
} from 'lucide-react';
import { LOCAL_OLLAMA_MODEL_PRESET, withLocalModelOption } from '../../characters/localModelPreset.js';
import { ProfileSettings } from './ProfileSettings.jsx';
import { CharacterPersonaSettings } from './CharacterPersonaSettings.jsx';
import { CharacterModelSettings } from './CharacterModelSettings.jsx';
import { CharacterBehaviorSettings } from './CharacterBehaviorSettings.jsx';
import { CharacterVoiceSettings } from './CharacterVoiceSettings.jsx';
import { CharacterDataSettings } from './CharacterDataSettings.jsx';
import { AccountSecuritySettings } from './AccountSecuritySettings.jsx';
import { SessionSettings } from './SessionSettings.jsx';
import { BackupSettings } from './BackupSettings.jsx';
import { SettingsContext } from './SettingsContext.jsx';
import { WipeDataDialog } from './WipeDataDialog.jsx';
import './SettingsPanel.css';
import { useSettingsProfile } from '../useSettingsProfile.js';
import { useSettingsSessions } from '../useSettingsSessions.js';
import { useSettingsBackup } from '../useSettingsBackup.js';
import { useSettingsModels } from '../useSettingsModels.js';
import { useCharacterConfiguration } from '../useCharacterConfiguration.js';

function SettingsPanel({
    apiUrl,
    contacts: parentContacts = [],
    desktopWallpaper = 'ocean-live2d',
    wallpaperOptions = [],
    onDesktopWallpaperChange,
    onCharactersUpdate,
    onProfileUpdate,
    onBack,
}) {
    const { lang } = useLanguage();
    const {
        setMemModels,
        setMemModelError,
        setMainModels,
        setMainModelError,
        mainModels,
        memModels,
        getSecretPlaceholder,
        getSecretStatusText,
        fetchModels,
        setMainModelFetching,
        mainModelFetching,
        mainModelError,
        setMemModelFetching,
        memModelFetching,
        memModelError,
        getEditingTtsProviderConfig,
        loadTencentVoices,
        tencentVoiceError,
        tencentVoiceSource,
        tencentVoiceSourceLabel,
        ttsPreviewText,
    } = useSettingsModels({ lang, apiUrl });

    const [characterMessageStatsById, setCharacterMessageStatsById] = useState({});
    const [saveError, setSaveError] = useState('');
    const [contextOpen, setContextOpen] = useState(false);

    useEffect(() => {
        if (!contextOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setContextOpen(false);
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [contextOpen]);

    // Model list fetch state (main API + memory API)

    const [activeSettingsScreen, setActiveSettingsScreen] = useState('characters');
    const [activeCharacterTab, setActiveCharacterTab] = useState('persona');
    const [ttsPreviewVerifiedIds, setTtsPreviewVerifiedIds] = useState(() => new Set());
    const [serviceDiagnostics, setServiceDiagnostics] = useState({ embedding: null, queue: null, cache: null });
    const [serviceDiagnosticsLoading, setServiceDiagnosticsLoading] = useState(false);
    const [serviceDiagnosticsError, setServiceDiagnosticsError] = useState('');
    const {
        selectedSettingsContactId,
        contacts,
        selectedSettingsContact,
        setSelectedSettingsContactId,
        openCharacterEditor,
        editingContact,
        characterDraftChanged,
        controlChangeCount,
        handleSaveContact,
        savingContact,
        createCharacterDraft,
        selectControlCharacter,
        updateCharacterDraft,
        selectedOriginalForDraft,
        applyLocalModelPreset,
        handleMainModelSelect,
        handleMemoryModelSelect,
        handleExportCharacterData,
        handleImportCharacterData,
        handleResetPhysicalState,
        handleWipeData,
        handleDeleteContact,
        controlHasContextLimitChange,
        controlHasModelChange,
        controlHasVoiceChange,
    } = useCharacterConfiguration({
        parentContacts,
        apiUrl,
        lang,
        onCharactersUpdate,
        setSaveError,
        characterMessageStatsById,
        setMemModels,
        setMemModelError,
        setMainModels,
        setMainModelError,
        setActiveSettingsScreen,
        setActiveCharacterTab,
    });

    const normalizeCharacterMessageStats = useCallback(
        (stats = {}) => ({
            first_message_at: Number(stats.first_message_at || 0),
            last_message_at: Number(stats.last_message_at || 0),
            last_user_message_at: Number(stats.last_user_message_at || stats.last_user_msg_time || 0),
            private_message_count: Number(stats.private_message_count || 0),
            user_message_count: Number(stats.user_message_count || 0),
            character_message_count: Number(stats.character_message_count || 0),
        }),
        [],
    );

    useEffect(() => {
        const selectedId = selectedSettingsContactId || contacts[0]?.id || '';
        if (!selectedId || characterMessageStatsById[selectedId]) return;

        const current = contacts.find((c) => c.id === selectedId);
        if (
            Number(current?.first_message_at || 0) > 0 ||
            Number(current?.last_message_at || 0) > 0 ||
            Number(current?.private_message_count || 0) > 0
        ) {
            return;
        }

        let cancelled = false;
        fetch(`${apiUrl}/characters/${encodeURIComponent(selectedId)}/message-stats`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((data) => {
                if (cancelled) return;
                setCharacterMessageStatsById((prev) => ({
                    ...prev,
                    [selectedId]: normalizeCharacterMessageStats(data.stats || data),
                }));
            })
            .catch((err) => console.warn('Failed to load character message stats:', err));

        return () => {
            cancelled = true;
        };
    }, [apiUrl, contacts, selectedSettingsContactId, characterMessageStatsById, normalizeCharacterMessageStats]);

    const loadServiceDiagnostics = useCallback(async () => {
        const selectedId = selectedSettingsContactId || contacts[0]?.id || '';
        setServiceDiagnosticsLoading(true);
        setServiceDiagnosticsError('');
        const authHeaders = { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` };
        const fetchJson = async (path) => {
            const res = await fetch(`${apiUrl}${path}`, { headers: authHeaders });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            return data;
        };
        try {
            const tasks = [
                fetchJson('/system/embedding-status'),
                fetchJson('/system/background-queue'),
                selectedId
                    ? fetchJson(`/characters/${encodeURIComponent(selectedId)}/cache-stats`)
                    : Promise.resolve(null),
            ];
            const [embeddingResult, queueResult, cacheResult] = await Promise.allSettled(tasks);
            const errors = [];
            const nextDiagnostics = {};
            if (embeddingResult.status === 'fulfilled') nextDiagnostics.embedding = embeddingResult.value;
            else errors.push(embeddingResult.reason?.message || 'embedding-status');
            if (queueResult.status === 'fulfilled') nextDiagnostics.queue = queueResult.value;
            else errors.push(queueResult.reason?.message || 'background-queue');
            if (cacheResult.status === 'fulfilled') nextDiagnostics.cache = cacheResult.value;
            else errors.push(cacheResult.reason?.message || 'cache-stats');
            setServiceDiagnostics((prev) => ({ ...prev, ...nextDiagnostics }));
            if (errors.length) {
                setServiceDiagnosticsError(errors.join(' / '));
            }
        } finally {
            setServiceDiagnosticsLoading(false);
        }
    }, [apiUrl, contacts, selectedSettingsContactId]);

    useEffect(() => {
        loadServiceDiagnostics().catch((err) => {
            setServiceDiagnosticsError(err.message);
            setServiceDiagnosticsLoading(false);
        });
    }, [loadServiceDiagnostics]);

    const handleFileUpload = async (event, setAvatarCallback) => {
        const targetInput = event.target;
        const file = targetInput.files[0];

        if (!file) {
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${apiUrl}/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: formData,
            });

            const data = await res.json();

            if (data.success) {
                setAvatarCallback(data.url);
                alert(
                    lang === 'en'
                        ? `Upload success!\n\nFile path: ${data.url}\n\nClick Save below to apply this avatar.`
                        : `上传成功！\n\n文件路径：${data.url}\n\n请点击下方“保存”按钮使头像生效。`,
                );
            } else {
                alert(lang === 'en' ? 'Failed to save: ' + data.error : '保存失败: ' + data.error);
            }
        } catch (e) {
            console.error('Upload failed:', e);
            alert((lang === 'en' ? 'Upload failed: ' : '上传过程中发生错误：') + e.message);
        } finally {
            if (targetInput) targetInput.value = null;
        }
    };

    const renderAvatarFramePicker = (value, onChange, previewSrc, previewName = 'User') => (
        <div className="avatar-frame-picker">
            {AVATAR_FRAME_OPTIONS.map((option) => {
                const selected = normalizeAvatarFrameId(value) === option.id;
                const optionLabel = lang === 'en' ? option.labelEn || option.label : option.label;
                return (
                    <button
                        key={option.id}
                        type="button"
                        className={`avatar-frame-choice ${selected ? 'is-selected' : ''}`}
                        onClick={() => onChange(option.id)}
                        title={optionLabel}
                    >
                        <span className="avatar-frame-choice__preview">
                            <AvatarWithFrame
                                size={42}
                                frame={option.id}
                                src={resolveAvatarUrl(previewSrc, apiUrl, previewName)}
                                fallbackSrc={defaultAvatarUrl(previewName)}
                                alt=""
                            />
                        </span>
                        <span className="avatar-frame-choice__label">{optionLabel}</span>
                    </button>
                );
            })}
        </div>
    );

    const {
        profile,
        isEditing,
        handleSaveProfile,
        savingProfile,
        profileLoadError,
        setIsEditing,
        editName,
        setEditName,
        editAvatar,
        setEditAvatar,
        editAvatarFrame,
        setEditAvatarFrame,
        editBanner,
        setEditBanner,
        editBio,
        setEditBio,
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
    } = useSettingsProfile({ apiUrl, lang, setSaveError, onProfileUpdate });

    const {
        handleExportDatabase,
        handleImportDatabase,
        setWipeModalOpen,
        wipeModalOpen,
        wipeConfirmText,
        setWipeConfirmText,
        handleSystemWipe,
    } = useSettingsBackup({ lang, apiUrl, onCharactersUpdate });

    const selectedSettingsContactOnline = Boolean(
        selectedSettingsContact &&
            String(selectedSettingsContact.api_endpoint || '').trim() &&
            selectedSettingsContact.api_key_configured === true &&
            String(selectedSettingsContact.model_name || '').trim(),
    );
    const selectedContactDescription = String(selectedSettingsContact?.persona || '').trim();
    const formatSettingsDate = (value, emptyLabel) => {
        const timestamp = Number(value || 0);
        if (!timestamp) return emptyLabel || (lang === 'en' ? 'Not recorded' : '暂无记录');
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return emptyLabel || (lang === 'en' ? 'Not recorded' : '暂无记录');
        return date.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };
    const formatJoinTime = (character) => {
        if (!character) return lang === 'en' ? 'Not recorded' : '暂无记录';
        if (Number(character.created_at || 0) > 0) {
            return formatSettingsDate(character.created_at);
        }
        if (Number(character.first_message_at || 0) > 0) {
            return lang === 'en'
                ? `First chat ${formatSettingsDate(character.first_message_at)}`
                : `按首次对话 ${formatSettingsDate(character.first_message_at)}`;
        }
        return lang === 'en' ? 'No private chat yet' : '还没有私聊记录';
    };
    const isSettingOn = (value, fallback = true) => {
        if (value === undefined || value === null || value === '') return fallback;
        return !(value === 0 || value === '0' || value === false);
    };
    const formatApiSourceName = (endpoint) => {
        const raw = String(endpoint || '').trim();
        if (!raw) return '';
        const parseTarget = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
            const { hostname, port } = new URL(parseTarget);
            const host = String(hostname || '')
                .replace(/^api\./i, '')
                .replace(/^www\./i, '');
            if (!host) return raw.slice(0, 42);
            const lower = host.toLowerCase();
            if (lower.includes('openai')) return 'OpenAI';
            if (lower.includes('anthropic') || lower.includes('claude')) return 'Anthropic';
            if (lower.includes('deepseek')) return 'DeepSeek';
            if (lower.includes('siliconflow')) return 'SiliconFlow';
            if (lower.includes('google') || lower.includes('gemini')) return 'Gemini';
            if (lower.includes('volcengine') || lower.includes('volces')) return 'Volcengine';
            if (lower.includes('moonshot') || lower.includes('kimi')) return 'Moonshot';
            if (lower.includes('localhost') || lower === '127.0.0.1') return port ? `Local:${port}` : 'Local';
            return port ? `${host}:${port}` : host;
        } catch {
            return raw
                .replace(/^https?:\/\//i, '')
                .split('/')[0]
                .slice(0, 42);
        }
    };
    const getCharacterApiBadge = (character, scope) => {
        const isMemory = scope === 'memory';
        const endpoint = isMemory ? character?.memory_api_endpoint : character?.api_endpoint;
        const model = String((isMemory ? character?.memory_model_name : character?.model_name) || '').trim();
        const endpointName = formatApiSourceName(endpoint);
        const hasSavedKey = isMemory
            ? character?.memory_api_key_configured === true
            : character?.api_key_configured === true;
        const isConfigured = Boolean(String(endpoint || '').trim() && model && hasSavedKey);
        const emptyLabel = lang === 'en' ? 'Not configured' : '未配置';
        const value = [model, endpointName].filter(Boolean).join(' · ') || emptyLabel;
        const label = isMemory ? (lang === 'en' ? 'Aux API' : '辅助 API') : lang === 'en' ? 'Main API' : '主 API';
        const title = `${label}: ${value}${endpoint ? `\n${endpoint}` : ''}`;
        return { label, value, title, isConfigured };
    };
    const selectedTtsConfig = getTtsProviderConfig(selectedSettingsContact?.tts_provider);
    const selectedContactDetailRows = selectedSettingsContact
        ? [
              [lang === 'en' ? 'Created' : '加入时间', formatJoinTime(selectedSettingsContact)],
              [
                  lang === 'en' ? 'Conversations' : '对话次数',
                  `${Number(selectedSettingsContact.private_message_count || 0)} ${lang === 'en' ? 'messages' : '次'}`,
              ],
              [
                  lang === 'en' ? 'User / Character' : '用户 / 角色',
                  `${Number(selectedSettingsContact.user_message_count || 0)} / ${Number(selectedSettingsContact.character_message_count || 0)}`,
              ],
              [
                  lang === 'en' ? 'Main Model' : '主模型',
                  selectedSettingsContact.model_name || (lang === 'en' ? 'Not configured' : '未配置'),
              ],
              [
                  lang === 'en' ? 'Main API' : '主 API',
                  selectedSettingsContactOnline
                      ? lang === 'en'
                          ? 'Ready'
                          : '可用'
                      : lang === 'en'
                        ? 'No valid key'
                        : '未配置有效 Key',
              ],
              [
                  lang === 'en' ? 'Memory Model' : '记忆模型',
                  selectedSettingsContact.memory_model_name || (lang === 'en' ? 'Not configured' : '未配置'),
              ],
              [
                  lang === 'en' ? 'Voice' : '语音',
                  isSettingOn(selectedSettingsContact.tts_enabled, false)
                      ? `${selectedTtsConfig.label}${selectedSettingsContact.tts_voice ? ` · ${selectedSettingsContact.tts_voice}` : ''}`
                      : lang === 'en'
                        ? 'Off'
                        : '关闭',
              ],
              [
                  lang === 'en' ? 'Proactive' : '主动消息',
                  isSettingOn(selectedSettingsContact.sys_proactive, true)
                      ? `${selectedSettingsContact.interval_min ?? 10}-${selectedSettingsContact.interval_max ?? 120} ${lang === 'en' ? 'min' : '分钟'}`
                      : lang === 'en'
                        ? 'Off'
                        : '关闭',
              ],
              [
                  lang === 'en' ? 'Timer Tasks' : '定时任务',
                  isSettingOn(selectedSettingsContact.sys_timer, true)
                      ? lang === 'en'
                          ? 'On'
                          : '开启'
                      : lang === 'en'
                        ? 'Off'
                        : '关闭',
              ],
              [
                  lang === 'en' ? 'Emotion Systems' : '情绪系统',
                  `${isSettingOn(selectedSettingsContact.sys_pressure, true) ? (lang === 'en' ? 'Pressure on' : '压力开') : lang === 'en' ? 'Pressure off' : '压力关'} · ${isSettingOn(selectedSettingsContact.sys_jealousy, true) ? (lang === 'en' ? 'Jealousy on' : '嫉妒开') : lang === 'en' ? 'Jealousy off' : '嫉妒关'}`,
              ],
              [
                  lang === 'en' ? 'City Activity' : '商业街活动',
                  isSettingOn(selectedSettingsContact.sys_survival, true)
                      ? lang === 'en'
                          ? 'Joined'
                          : '参与'
                      : lang === 'en'
                        ? 'Paused'
                        : '不参与',
              ],
              [
                  lang === 'en' ? 'Status' : '角色状态',
                  selectedSettingsContact.is_blocked
                      ? lang === 'en'
                          ? 'Blocked'
                          : '已拉黑'
                      : selectedSettingsContact.status === 'active' || !selectedSettingsContact.status
                        ? lang === 'en'
                            ? 'Active'
                            : '正常'
                        : selectedSettingsContact.status,
              ],
          ]
        : [];

    const getCharacterOnline = (character) =>
        Boolean(
            character &&
                String(character.api_endpoint || '').trim() &&
                character.api_key_configured === true &&
                String(character.model_name || '').trim(),
        );

    const normalizeTimestampMs = (value) => {
        const raw = Number(value || 0);
        if (!raw) return 0;
        return raw < 10000000000 ? raw * 1000 : raw;
    };

    const getProjectUsageDays = (value) => {
        const startedAt = normalizeTimestampMs(value);
        if (!startedAt) return 1;
        const day = 24 * 60 * 60 * 1000;
        return Math.max(1, Math.floor((Date.now() - startedAt) / day) + 1);
    };

    const getPlayerInteractionTimestamp = (character) =>
        normalizeTimestampMs(character?.last_user_message_at || character?.last_user_msg_time);

    const formatCompactInteractionTime = (value, emptyLabel) => {
        const timestamp = normalizeTimestampMs(value);
        if (!timestamp) return emptyLabel || (lang === 'en' ? 'No chat yet' : '暂无互动');
        const diff = Math.max(0, Date.now() - timestamp);
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        if (diff < minute) return lang === 'en' ? 'Just now' : '刚刚';
        if (diff < hour) return `${Math.floor(diff / minute)}${lang === 'en' ? 'm ago' : '分钟前'}`;
        if (diff < day) return `${Math.floor(diff / hour)}${lang === 'en' ? 'h ago' : '小时前'}`;
        if (diff < 7 * day) return `${Math.floor(diff / day)}${lang === 'en' ? 'd ago' : '天前'}`;
        return new Date(timestamp).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', {
            month: '2-digit',
            day: '2-digit',
        });
    };

    const formatCompactInteraction = (character, emptyLabel) =>
        formatCompactInteractionTime(
            character?.last_message_at || character?.last_user_msg_time || character?.updated_at,
            emptyLabel,
        );

    const projectUsageDays = getProjectUsageDays(profile.created_at);

    const latestPlayerInteractionCharacter = contacts.reduce((latest, item) => {
        const currentTime = getPlayerInteractionTimestamp(item);
        const latestTime = getPlayerInteractionTimestamp(latest);
        return currentTime > latestTime ? item : latest;
    }, null);
    const latestPlayerInteractionAt = getPlayerInteractionTimestamp(latestPlayerInteractionCharacter);
    const wallpaperOptionList = Array.isArray(wallpaperOptions) ? wallpaperOptions : [];
    const selectedWallpaperOption =
        wallpaperOptionList.find((option) => option.id === desktopWallpaper) || wallpaperOptionList[0] || null;
    const getWallpaperOptionLabel = (option) =>
        (lang === 'en' ? option?.labelEn : option?.labelZh) || option?.label || option?.id || '';
    const getWallpaperOptionDescription = (option) =>
        (lang === 'en' ? option?.descriptionEn : option?.descriptionZh) || option?.description || '';
    const screenLabels = {
        profile: lang === 'en' ? 'Profile' : '个人资料',
        security: lang === 'en' ? 'Account Security' : '账号安全',
        characters: lang === 'en' ? 'Character Config' : '角色配置',
        models: lang === 'en' ? 'Models & Voice' : '模型与声音',
        backup: lang === 'en' ? 'Backup & Migration' : '备份与迁移',
    };
    const getCharacterReadiness = (character) => {
        const mainModelReady = Boolean(
            String(character?.api_endpoint || '').trim() &&
                character?.api_key_configured === true &&
                String(character?.model_name || '').trim(),
        );
        const memoryModelReady = Boolean(
            String(character?.memory_api_endpoint || '').trim() &&
                character?.memory_api_key_configured === true &&
                String(character?.memory_model_name || '').trim(),
        );
        const personaReady = Boolean(String(character?.name || '').trim() && String(character?.persona || '').trim());
        const ttsEnabled = character?.tts_enabled === 1;
        const ttsConfigured =
            !ttsEnabled ||
            Boolean(
                character?.tts_provider &&
                    (character?.tts_api_key_configured || character?.tts_provider === 'browser') &&
                    character?.tts_voice,
            );
        const ttsPreviewVerified = ttsEnabled && ttsConfigured && ttsPreviewVerifiedIds.has(character?.id);
        return {
            mainModelReady,
            memoryModelReady,
            personaReady,
            ttsEnabled,
            ttsConfigured,
            ttsPreviewVerified,
            ready: mainModelReady && personaReady,
        };
    };
    const profileReady = Boolean(String(profile?.name || '').trim() && (profile?.avatar || profile?.username));
    const characterReadiness = contacts.map((character) => ({
        character,
        readiness: getCharacterReadiness(character),
    }));
    const mainModelReadyCharacters = characterReadiness.filter((item) => item.readiness.mainModelReady).length;
    const ttsNeedsAttention = characterReadiness.filter(
        (item) => item.readiness.ttsEnabled && (!item.readiness.ttsConfigured || !item.readiness.ttsPreviewVerified),
    );

    const settingsNavItems = [
        {
            key: 'profile',
            icon: <UserRound size={16} />,
            label: screenLabels.profile,
            detail: lang === 'en' ? 'Avatar, bio, appearance' : '头像、签名和外观',
            notice: !profileReady,
        },
        {
            key: 'security',
            icon: <Shield size={16} />,
            label: screenLabels.security,
            detail: lang === 'en' ? 'Username, password, sessions' : '用户名、密码和会话',
        },
        {
            key: 'characters',
            icon: <UsersRound size={16} />,
            label: screenLabels.characters,
            detail: lang === 'en' ? 'Persona, behavior, context' : '人设、行为与上下文',
            count: contacts.length,
        },
        {
            key: 'models',
            icon: <AudioWaveform size={16} />,
            label: screenLabels.models,
            detail: lang === 'en' ? 'Main, memory, TTS' : '主模型、记忆和 TTS',
            notice: ttsNeedsAttention.length > 0 || mainModelReadyCharacters < contacts.length,
        },
        {
            key: 'backup',
            icon: <Database size={16} />,
            label: screenLabels.backup,
            detail: lang === 'en' ? 'Import, export, reset' : '导入、导出和恢复',
        },
    ];

    const {
        loadSessions,
        sessionsLoading,
        sessionsError,
        sessions,
        formatSessionDevice,
        formatSessionMeta,
        revokeSession,
    } = useSettingsSessions({ apiUrl, lang, formatSettingsDate });

    const activeCharacterDraft = editingContact || selectedSettingsContact;
    const activePreviewContact = activeCharacterDraft || selectedSettingsContact;
    const activeReadiness = activePreviewContact ? getCharacterReadiness(activePreviewContact) : null;

    const hasUnsavedSettings = characterDraftChanged || isEditing;
    const activePreviewDescription = String(activePreviewContact?.persona || '').trim();
    const activePreviewTtsProviderLabel = getTtsProviderConfig(activePreviewContact?.tts_provider).label;
    const mainModelOptions = withLocalModelOption(mainModels);
    const memModelOptions = withLocalModelOption(memModels);
    const getModelOptionLabel = (model) =>
        model === LOCAL_OLLAMA_MODEL_PRESET.model_name
            ? `${model} · ${lang === 'en' ? 'Local Ollama' : '本地 Ollama'}`
            : model;

    return (
        <>
            <div className="settings-panel-page settings-control-center-page settings-guided-page">
                <header className="settings-guided-header">
                    <div className="settings-guided-brand">
                        <span>
                            <Activity size={19} />
                        </span>
                        <strong>ChatPulse</strong>
                        <em>{lang === 'en' ? 'Settings' : '设置'}</em>
                    </div>
                    <div className="settings-guided-breadcrumb">
                        <span>{lang === 'en' ? 'Settings' : '设置'}</span>
                        <ChevronRight size={14} />
                        <strong>{screenLabels[activeSettingsScreen]}</strong>
                    </div>
                    <div className="settings-guided-save">
                        <span className={hasUnsavedSettings ? 'is-dirty' : ''}>
                            {hasUnsavedSettings ? <CircleDotDashed size={15} /> : <CheckCircle2 size={15} />}
                            {hasUnsavedSettings
                                ? characterDraftChanged
                                    ? lang === 'en'
                                        ? `${controlChangeCount || 1} character changes`
                                        : `${controlChangeCount || 1} 项角色改动待保存`
                                    : lang === 'en'
                                      ? 'Unsaved draft'
                                      : '有未保存草稿'
                                : lang === 'en'
                                  ? 'Saved'
                                  : '所有更改已保存'}
                        </span>
                        <button
                            type="button"
                            onClick={async () => {
                                if (characterDraftChanged && !(await handleSaveContact())) return;
                                if (isEditing) await handleSaveProfile();
                            }}
                            disabled={!hasUnsavedSettings || savingProfile || savingContact}
                        >
                            <Save size={15} />
                            {lang === 'en' ? 'Save' : '保存'}
                        </button>
                        <button
                            type="button"
                            className="settings-context-trigger"
                            aria-expanded={contextOpen}
                            aria-controls="settings-preview-drawer"
                            onClick={() => setContextOpen(true)}
                        >
                            <PanelRightOpen size={15} />
                            {lang === 'en' ? 'Preview & diagnostics' : '预览与诊断'}
                        </button>
                    </div>
                </header>

                {saveError && (
                    <div role="alert" className="settings-save-error">
                        {saveError}
                    </div>
                )}
                <div className="settings-guided-shell">
                    <aside className="settings-guided-sidebar">
                        <nav>
                            {settingsNavItems.map((item) => (
                                <button
                                    type="button"
                                    key={item.key}
                                    className={activeSettingsScreen === item.key ? 'is-active' : ''}
                                    onClick={() => {
                                        setActiveSettingsScreen(item.key);
                                        if (item.key === 'models') setActiveCharacterTab('model');
                                    }}
                                >
                                    {item.icon}
                                    <span>
                                        <strong>{item.label}</strong>
                                        {item.detail && <small>{item.detail}</small>}
                                    </span>
                                    {item.count !== undefined && <em>{item.count}</em>}
                                    {item.notice && <i className="settings-guided-notice-dot" />}
                                </button>
                            ))}
                        </nav>
                        <div className="settings-guided-system-state">
                            <span className="settings-guided-online-dot" />
                            <div>
                                <strong>{lang === 'en' ? 'Service running' : '服务运行正常'}</strong>
                                <small>{lang === 'en' ? 'Synced from live API' : '来自真实接口数据'}</small>
                            </div>
                        </div>
                    </aside>

                    <main className="settings-guided-content">
                        {profileLoadError && (
                            <div className="settings-inline-alert">
                                {lang === 'en'
                                    ? 'Live profile sync is delayed. Showing local fallback data for now.'
                                    : '实时用户资料同步超时，当前先显示本地兜底数据。'}
                                <div>{profileLoadError}</div>
                            </div>
                        )}

                        <ProfileSettings
                            activeSettingsScreen={activeSettingsScreen}
                            onBack={onBack}
                            lang={lang}
                            profile={profile}
                            apiUrl={apiUrl}
                            projectUsageDays={projectUsageDays}
                            formatCompactInteractionTime={formatCompactInteractionTime}
                            latestPlayerInteractionAt={latestPlayerInteractionAt}
                            setIsEditing={setIsEditing}
                            isEditing={isEditing}
                            editName={editName}
                            setEditName={setEditName}
                            editAvatar={editAvatar}
                            setEditAvatar={setEditAvatar}
                            handleFileUpload={handleFileUpload}
                            renderAvatarFramePicker={renderAvatarFramePicker}
                            editAvatarFrame={editAvatarFrame}
                            setEditAvatarFrame={setEditAvatarFrame}
                            editBanner={editBanner}
                            setEditBanner={setEditBanner}
                            editBio={editBio}
                            setEditBio={setEditBio}
                            handleSaveProfile={handleSaveProfile}
                            savingProfile={savingProfile}
                            wallpaperOptionList={wallpaperOptionList}
                            getWallpaperOptionLabel={getWallpaperOptionLabel}
                            selectedWallpaperOption={selectedWallpaperOption}
                            desktopWallpaper={desktopWallpaper}
                            onDesktopWallpaperChange={onDesktopWallpaperChange}
                            getWallpaperOptionDescription={getWallpaperOptionDescription}
                        />

                        {['characters', 'models'].includes(activeSettingsScreen) && (
                            <section className="settings-control-workbench">
                                <div className="settings-control-screen-title">
                                    <div>
                                        <span className="settings-guided-kicker">CHARACTER WORKBENCH</span>
                                        <h1>
                                            {lang === 'en' ? 'Character configuration workbench' : '角色配置工作台'}
                                        </h1>
                                        <p>
                                            {lang === 'en'
                                                ? 'Choose a character, then edit persona, models, behavior, voice, and data actions in one place.'
                                                : '选择角色后，在这里集中管理人设、模型、行为、声音和角色数据。'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="settings-control-ghost-button"
                                        onClick={createCharacterDraft}
                                    >
                                        <Plus size={15} />
                                        {lang === 'en' ? 'New character' : '创建新角色'}
                                    </button>
                                </div>

                                <div className="settings-control-character-strip">
                                    {contacts.map((character) => {
                                        const stats = characterMessageStatsById[character.id] || {};
                                        const readiness = getCharacterReadiness(character);
                                        const selected =
                                            String(activePreviewContact?.id || '') === String(character.id);
                                        return (
                                            <button
                                                type="button"
                                                key={character.id}
                                                className={`settings-control-character-chip ${selected ? 'is-active' : ''}`}
                                                onClick={() => selectControlCharacter(character)}
                                            >
                                                <AvatarWithFrame
                                                    size={38}
                                                    frame={character.avatar_frame}
                                                    src={resolveAvatarUrl(
                                                        character.avatar,
                                                        apiUrl,
                                                        character.name || character.id || 'User',
                                                    )}
                                                    fallbackSrc={defaultAvatarUrl(
                                                        character.name || character.id || 'User',
                                                    )}
                                                    alt=""
                                                />
                                                <span>
                                                    <strong>{character.name || character.id}</strong>
                                                    <small>
                                                        <i
                                                            className={`settings-status-dot ${readiness.ready ? 'online' : 'warning'}`}
                                                        />
                                                        {readiness.ready
                                                            ? lang === 'en'
                                                                ? 'Ready'
                                                                : '可用'
                                                            : lang === 'en'
                                                              ? 'Needs setup'
                                                              : '待配置'}
                                                        {' · '}
                                                        {Number(
                                                            stats.private_message_count ||
                                                                character.private_message_count ||
                                                                0,
                                                        )}{' '}
                                                        {lang === 'en' ? 'messages' : '条消息'}
                                                    </small>
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {contacts.length === 0 && (
                                        <div className="settings-guided-empty">
                                            {lang === 'en'
                                                ? 'No characters yet. Create one to begin.'
                                                : '还没有角色，创建一个角色后开始配置。'}
                                        </div>
                                    )}
                                </div>

                                {activeCharacterDraft ? (
                                    <>
                                        <div className="settings-control-section-tabs">
                                            {[
                                                [
                                                    'persona',
                                                    lang === 'en' ? 'Persona' : '基础人设',
                                                    <Heart size={15} />,
                                                ],
                                                [
                                                    'model',
                                                    lang === 'en' ? 'Models' : '模型能力',
                                                    <MessageSquare size={15} />,
                                                ],
                                                [
                                                    'behavior',
                                                    lang === 'en' ? 'Behavior' : '行为与上下文',
                                                    <Activity size={15} />,
                                                ],
                                                [
                                                    'voice',
                                                    lang === 'en' ? 'Voice' : '声音',
                                                    <AudioWaveform size={15} />,
                                                ],
                                                ['data', lang === 'en' ? 'Data' : '角色数据', <Database size={15} />],
                                            ].map(([key, label, icon]) => (
                                                <button
                                                    type="button"
                                                    key={key}
                                                    className={activeCharacterTab === key ? 'is-active' : ''}
                                                    onClick={() => setActiveCharacterTab(key)}
                                                >
                                                    {icon}
                                                    {label}
                                                </button>
                                            ))}
                                        </div>

                                        {activeCharacterTab === 'persona' && (
                                            <CharacterPersonaSettings
                                                lang={lang}
                                                activeReadiness={activeReadiness}
                                                activeCharacterDraft={activeCharacterDraft}
                                                apiUrl={apiUrl}
                                                handleFileUpload={handleFileUpload}
                                                updateCharacterDraft={updateCharacterDraft}
                                                selectedOriginalForDraft={selectedOriginalForDraft}
                                                renderAvatarFramePicker={renderAvatarFramePicker}
                                            />
                                        )}

                                        {activeCharacterTab === 'model' && (
                                            <CharacterModelSettings
                                                activeReadiness={activeReadiness}
                                                lang={lang}
                                                activeCharacterDraft={activeCharacterDraft}
                                                updateCharacterDraft={updateCharacterDraft}
                                                applyLocalModelPreset={applyLocalModelPreset}
                                                editingContact={editingContact}
                                                getSecretPlaceholder={getSecretPlaceholder}
                                                getSecretStatusText={getSecretStatusText}
                                                fetchModels={fetchModels}
                                                setMainModels={setMainModels}
                                                setMainModelFetching={setMainModelFetching}
                                                setMainModelError={setMainModelError}
                                                mainModelFetching={mainModelFetching}
                                                mainModelError={mainModelError}
                                                mainModelOptions={mainModelOptions}
                                                handleMainModelSelect={handleMainModelSelect}
                                                getModelOptionLabel={getModelOptionLabel}
                                                setMemModels={setMemModels}
                                                setMemModelFetching={setMemModelFetching}
                                                setMemModelError={setMemModelError}
                                                memModelFetching={memModelFetching}
                                                memModelError={memModelError}
                                                memModelOptions={memModelOptions}
                                                handleMemoryModelSelect={handleMemoryModelSelect}
                                            />
                                        )}

                                        {activeCharacterTab === 'behavior' && (
                                            <CharacterBehaviorSettings
                                                lang={lang}
                                                activeCharacterDraft={activeCharacterDraft}
                                                updateCharacterDraft={updateCharacterDraft}
                                            />
                                        )}

                                        {activeCharacterTab === 'voice' && (
                                            <CharacterVoiceSettings
                                                lang={lang}
                                                activeCharacterDraft={activeCharacterDraft}
                                                updateCharacterDraft={updateCharacterDraft}
                                                editingContact={editingContact}
                                                getSecretPlaceholder={getSecretPlaceholder}
                                                getEditingTtsProviderConfig={getEditingTtsProviderConfig}
                                                getSecretStatusText={getSecretStatusText}
                                                loadTencentVoices={loadTencentVoices}
                                                tencentVoiceError={tencentVoiceError}
                                                tencentVoiceSource={tencentVoiceSource}
                                                tencentVoiceSourceLabel={tencentVoiceSourceLabel}
                                                apiUrl={apiUrl}
                                                ttsPreviewText={ttsPreviewText}
                                                setTtsPreviewVerifiedIds={setTtsPreviewVerifiedIds}
                                            />
                                        )}

                                        {activeCharacterTab === 'data' && (
                                            <CharacterDataSettings
                                                lang={lang}
                                                handleExportCharacterData={handleExportCharacterData}
                                                activeCharacterDraft={activeCharacterDraft}
                                                selectedOriginalForDraft={selectedOriginalForDraft}
                                                handleImportCharacterData={handleImportCharacterData}
                                                handleResetPhysicalState={handleResetPhysicalState}
                                                handleWipeData={handleWipeData}
                                                handleDeleteContact={handleDeleteContact}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <div className="settings-guided-empty">
                                        {lang === 'en'
                                            ? 'Select or create a character to edit.'
                                            : '选择或创建角色后开始编辑。'}
                                    </div>
                                )}
                            </section>
                        )}

                        <AccountSecuritySettings
                            activeSettingsScreen={activeSettingsScreen}
                            lang={lang}
                            contacts={contacts}
                            getCharacterOnline={getCharacterOnline}
                            getCharacterApiBadge={getCharacterApiBadge}
                            selectedSettingsContact={selectedSettingsContact}
                            setSelectedSettingsContactId={setSelectedSettingsContactId}
                            apiUrl={apiUrl}
                            formatCompactInteraction={formatCompactInteraction}
                            onCharactersUpdate={onCharactersUpdate}
                            handleWipeData={handleWipeData}
                            openCharacterEditor={openCharacterEditor}
                            handleDeleteContact={handleDeleteContact}
                            accountUsername={accountUsername}
                            setAccountUsername={setAccountUsername}
                            accountCurrentPassword={accountCurrentPassword}
                            setAccountCurrentPassword={setAccountCurrentPassword}
                            accountNewPassword={accountNewPassword}
                            setAccountNewPassword={setAccountNewPassword}
                            accountConfirmPassword={accountConfirmPassword}
                            setAccountConfirmPassword={setAccountConfirmPassword}
                            handleSaveAccount={handleSaveAccount}
                            accountSaving={accountSaving}
                            accountError={accountError}
                            accountMessage={accountMessage}
                            selectedSettingsContactOnline={selectedSettingsContactOnline}
                            selectedContactDescription={selectedContactDescription}
                            selectedContactDetailRows={selectedContactDetailRows}
                        />

                        {activeSettingsScreen === 'security' && (
                            <SessionSettings
                                lang={lang}
                                loadSessions={loadSessions}
                                sessionsLoading={sessionsLoading}
                                sessionsError={sessionsError}
                                sessions={sessions}
                                formatSessionDevice={formatSessionDevice}
                                formatSessionMeta={formatSessionMeta}
                                revokeSession={revokeSession}
                            />
                        )}

                        <BackupSettings
                            activeSettingsScreen={activeSettingsScreen}
                            lang={lang}
                            handleExportDatabase={handleExportDatabase}
                            handleImportDatabase={handleImportDatabase}
                            setWipeModalOpen={setWipeModalOpen}
                        />
                    </main>

                </div>
                {contextOpen &&
                    createPortal(
                    <div className="settings-context-overlay">
                        <button
                            type="button"
                            className="settings-context-backdrop"
                            aria-label={lang === 'en' ? 'Close preview' : '关闭预览'}
                            onClick={() => setContextOpen(false)}
                        />
                        <div className="settings-context-drawer" id="settings-preview-drawer" role="dialog" aria-modal="true" aria-label={lang === 'en' ? 'Preview and diagnostics' : '预览与诊断'}>
                            <div className="settings-context-drawer-head">
                                <strong>{lang === 'en' ? 'Preview & diagnostics' : '预览与诊断'}</strong>
                                <button type="button" onClick={() => setContextOpen(false)} aria-label={lang === 'en' ? 'Close preview' : '关闭预览'}>
                                    <X size={17} />
                                </button>
                            </div>
                            <SettingsContext
                                activePreviewContact={activePreviewContact}
                                lang={lang}
                                apiUrl={apiUrl}
                                activeReadiness={activeReadiness}
                                activePreviewDescription={activePreviewDescription}
                                activePreviewTtsProviderLabel={activePreviewTtsProviderLabel}
                                controlHasContextLimitChange={controlHasContextLimitChange}
                                controlHasModelChange={controlHasModelChange}
                                controlHasVoiceChange={controlHasVoiceChange}
                                loadServiceDiagnostics={loadServiceDiagnostics}
                                serviceDiagnosticsLoading={serviceDiagnosticsLoading}
                                serviceDiagnosticsError={serviceDiagnosticsError}
                                serviceDiagnostics={serviceDiagnostics}
                                setActiveSettingsScreen={(screen) => {
                                    setActiveSettingsScreen(screen);
                                    setContextOpen(false);
                                }}
                                openCharacterEditor={(...args) => {
                                    openCharacterEditor(...args);
                                    setContextOpen(false);
                                }}
                            />
                        </div>
                    </div>,
                    document.body,
                )}
            </div>

            {wipeModalOpen && (
                <WipeDataDialog
                    lang={lang}
                    wipeConfirmText={wipeConfirmText}
                    setWipeConfirmText={setWipeConfirmText}
                    setWipeModalOpen={setWipeModalOpen}
                    handleSystemWipe={handleSystemWipe}
                />
            )}
        </>
    );
}

export default SettingsPanel;
