import React, { useState, useEffect, useCallback } from 'react';
import {
    AudioWaveform,
    Trash2,
    Edit3,
    Save,
    RefreshCw,
    Download,
    Upload,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    CircleCheck,
    CircleDotDashed,
    Volume2,
    Wallet,
    CalendarDays,
    Heart,
    House,
    Activity,
    Database,
    ShieldCheck,
    Shield,
    Cloud,
    Image as ImageIcon,
    Info,
    Laptop,
    Monitor,
    Plus,
    FileText,
    MessageSquare,
    Smartphone,
    TriangleAlert,
    UserRound,
    UsersRound,
} from 'lucide-react';
import AvatarWithFrame, { AVATAR_FRAME_OPTIONS, normalizeAvatarFrameId } from './AvatarWithFrame';
import { useLanguage } from '../LanguageContext';
import { defaultAvatarUrl, resolveAvatarUrl } from '../utils/avatar';
import { useAuth } from '../AuthContext';
import { LOCAL_OLLAMA_MODEL_PRESET, withLocalModelOption } from '../utils/localModelPreset';
import './SettingsPanel.css';

const getDefaultGuidelines = (lang) => {
    if (lang === 'en') {
        return `Guidelines:
1. Act and speak EXACTLY like the persona. DO NOT break character.
2. We are chatting on a mobile messaging app.
3. Keep responses relatively short, casual, and conversational.
4. DO NOT act as an AI assistant. Never say "How can I help you?".
5. You are initiating this specific message randomly based on the Current Time. Mention the time of day or what you might be doing.
6. [MANDATORY KNOWLEDGE FOR BACKGROUND ACTIONS]:
   - If you want to wait a specific amount of time before your NEXT proactive message, output [TIMER:minutes].
   - If you want to apologize or send a "Red Packet" to the user, output [TRANSFER:amount] (e.g. [TRANSFER:5.20]).
   - If you want to write a secret entry in your private diary (for your eyes only), output [DIARY:your secret thought]. Do this if you are feeling very emotional.
   - If your feelings toward the user change based on their message (e.g., they insulted you or flattered you), output [AFFINITY:+5] or [AFFINITY:-10].
   - If your current mood visibly changes, output one [EMOTION_STATE:value]. value must be one of: jealous, hurt, angry, lonely, happy, sad, cautious, guarded, shy, hopeful, playful, disappointed, relieved, affectionate, reassured, yearning, flustered, guilty, frustrated, wistful, proud, secure, tender, helpless, tense, calm.
   These tags will be processed hidden from the user.`;
    }

    return `行为准则：
1. 请完全进入并扮演你的角色设定（Persona），不要脱离角色。
2. 我们正在使用一个移动聊天应用。
3. 你的回复要保持简短、自然、口语化。
4. 不要表现得像 AI 助手，绝不要说“有什么我可以帮你的吗？”。
5. 当你主动发起对话时，请根据当前时间自然地打招呼，或提到你现在可能正在做的事。
6. [后台动作的强制规则]
   - 如果你想等待几分钟后再发送下一条主动消息，输出 [TIMER:分钟数]。
   - 如果你想道歉或发红包，输出 [TRANSFER:金额]，例如 [TRANSFER:5.20]。
   - 如果你想写一段只有自己可见的私密日记，输出 [DIARY:你的秘密想法]。
   - 如果你对用户的好感发生变化，输出 [AFFINITY:+5] 或 [AFFINITY:-10]。
   - 如果你当前心情明显变化，输出一个 [EMOTION_STATE:value]。value 只能从这些名字里选：jealous, hurt, angry, lonely, happy, sad, cautious, guarded, shy, hopeful, playful, disappointed, relieved, affectionate, reassured, yearning, flustered, guilty, frustrated, wistful, proud, secure, tender, helpless, tense, calm。
   以上方括号标签都会在处理时对用户隐藏，但效果会生效。`;
};

const TTS_PROVIDERS = [
    {
        id: 'tencent',
        label: '腾讯云 TTS',
        modelHint: '大模型音色 / 精品音色',
        voiceHint: '例如：101001 / 101016，按腾讯云音色 ID 填写',
        keyHint: '可直接粘贴腾讯云弹窗里的 SecretId / SecretKey 两行',
        modelOptions: [
            { value: 'large', label: '大模型音色' },
            { value: 'premium', label: '精品音色' }
        ],
        voiceOptions: [
            { value: '501001', label: '501001 智兰 - 资讯女声（大模型）' },
            { value: '101001', label: '101001 智瑜 - 中文女声' },
            { value: '101004', label: '101004 智云 - 通用男声' },
            { value: '101011', label: '101011 智燕 - 新闻女声' },
            { value: '101013', label: '101013 智辉 - 新闻男声' },
            { value: '101016', label: '101016 智甜 - 女童声' }
        ]
    },
    {
        id: 'openai',
        label: 'OpenAI TTS',
        modelHint: '例如：gpt-4o-mini-tts / tts-1',
        voiceHint: '例如：alloy / verse / shimmer',
        keyHint: 'sk-...',
        modelOptions: [
            { value: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts' },
            { value: 'tts-1', label: 'tts-1' },
            { value: 'tts-1-hd', label: 'tts-1-hd' }
        ],
        voiceOptions: [
            { value: 'alloy', label: 'alloy' },
            { value: 'ash', label: 'ash' },
            { value: 'ballad', label: 'ballad' },
            { value: 'coral', label: 'coral' },
            { value: 'nova', label: 'nova' },
            { value: 'shimmer', label: 'shimmer' },
            { value: 'verse', label: 'verse' }
        ]
    },
    {
        id: 'azure',
        label: 'Azure Speech',
        modelHint: 'neural',
        voiceHint: '例如：zh-CN-XiaoxiaoNeural',
        keyHint: 'Speech key；Endpoint 可填 region 或完整地址',
        modelOptions: [
            { value: 'neural', label: 'Neural voice' }
        ],
        voiceOptions: [
            { value: 'zh-CN-XiaoxiaoNeural', label: 'zh-CN-XiaoxiaoNeural 女声' },
            { value: 'zh-CN-YunxiNeural', label: 'zh-CN-YunxiNeural 男声' },
            { value: 'zh-CN-XiaoyiNeural', label: 'zh-CN-XiaoyiNeural 女声' },
            { value: 'zh-CN-YunjianNeural', label: 'zh-CN-YunjianNeural 男声' }
        ]
    },
    {
        id: 'google',
        label: 'Google Cloud TTS',
        modelHint: 'neural2 / wavenet / standard',
        voiceHint: '例如：cmn-CN-Wavenet-A',
        keyHint: 'API key 或服务账号凭证标识',
        modelOptions: [
            { value: 'neural2', label: 'Neural2' },
            { value: 'wavenet', label: 'WaveNet' },
            { value: 'standard', label: 'Standard' }
        ],
        voiceOptions: [
            { value: 'cmn-CN-Wavenet-A', label: 'cmn-CN-Wavenet-A 女声' },
            { value: 'cmn-CN-Wavenet-B', label: 'cmn-CN-Wavenet-B 男声' },
            { value: 'cmn-CN-Wavenet-C', label: 'cmn-CN-Wavenet-C 男声' },
            { value: 'cmn-CN-Wavenet-D', label: 'cmn-CN-Wavenet-D 女声' }
        ]
    },
    {
        id: 'minimax',
        label: 'MiniMax Speech',
        modelHint: 'speech-02-turbo / speech-02-hd',
        voiceHint: '填写 voice_id',
        keyHint: 'API key',
        modelOptions: [
            { value: 'speech-02-turbo', label: 'speech-02-turbo' },
            { value: 'speech-02-hd', label: 'speech-02-hd' }
        ],
        voiceOptions: [
            { value: 'male-qn-qingse', label: 'male-qn-qingse 男声' },
            { value: 'female-shaonv', label: 'female-shaonv 女声' }
        ]
    },
    {
        id: 'elevenlabs',
        label: 'ElevenLabs',
        modelHint: 'eleven_multilingual_v2',
        voiceHint: '填写 voice_id',
        keyHint: 'xi-api-key',
        modelOptions: [
            { value: 'eleven_multilingual_v2', label: 'eleven_multilingual_v2' },
            { value: 'eleven_turbo_v2_5', label: 'eleven_turbo_v2_5' }
        ],
        voiceOptions: []
    },
    {
        id: 'custom',
        label: '自定义兼容接口',
        modelHint: '由接口决定',
        voiceHint: '由接口决定',
        keyHint: 'Bearer token / API key'
    }
];

function getTtsProviderConfig(providerId) {
    return TTS_PROVIDERS.find(item => item.id === providerId) || TTS_PROVIDERS[0];
}

function translateTtsProviderConfig(config, lang) {
    if (lang !== 'en') return config;
    const commonVoiceGender = (label) => String(label || '')
        .replace('女声', 'female')
        .replace('男声', 'male')
        .replace('资讯', 'news ')
        .replace('中文', 'Chinese ')
        .replace('通用', 'general ')
        .replace('新闻', 'news ')
        .replace('女童声', 'child female voice');
    const translated = { ...config };
    if (config.id === 'tencent') {
        translated.label = 'Tencent Cloud TTS';
        translated.modelHint = 'Large-model voice / premium voice';
        translated.voiceHint = 'e.g. 101001 / 101016, Tencent Cloud voice ID';
        translated.keyHint = 'Paste the SecretId / SecretKey lines from Tencent Cloud';
        translated.modelOptions = [
            { value: 'large', label: 'Large-model voice' },
            { value: 'premium', label: 'Premium voice' }
        ];
        translated.voiceOptions = (config.voiceOptions || []).map(option => ({
            ...option,
            label: commonVoiceGender(option.label)
                .replace('智兰 -', 'Zhilan -')
                .replace('智瑜 -', 'Zhiyu -')
                .replace('智云 -', 'Zhiyun -')
                .replace('智燕 -', 'Zhiyan -')
                .replace('智辉 -', 'Zhihui -')
                .replace('智甜 -', 'Zhitian -')
                .replace('（大模型）', '(large model)')
        }));
    } else if (config.id === 'azure') {
        translated.label = 'Azure Speech';
        translated.voiceHint = 'e.g. zh-CN-XiaoxiaoNeural';
        translated.keyHint = 'Speech key; Endpoint can be a region or full URL';
        translated.voiceOptions = (config.voiceOptions || []).map(option => ({
            ...option,
            label: commonVoiceGender(option.label)
        }));
    } else if (config.id === 'google') {
        translated.label = 'Google Cloud TTS';
        translated.voiceHint = 'e.g. cmn-CN-Wavenet-A';
        translated.keyHint = 'API key or service account credential ID';
        translated.voiceOptions = (config.voiceOptions || []).map(option => ({
            ...option,
            label: commonVoiceGender(option.label)
        }));
    } else if (config.id === 'minimax') {
        translated.label = 'MiniMax Speech';
        translated.voiceHint = 'Enter voice_id';
        translated.voiceOptions = (config.voiceOptions || []).map(option => ({
            ...option,
            label: commonVoiceGender(option.label)
        }));
    } else if (config.id === 'elevenlabs') {
        translated.label = 'ElevenLabs';
        translated.voiceHint = 'Enter voice_id';
    } else if (config.id === 'custom') {
        translated.label = 'Custom compatible API';
        translated.modelHint = 'Defined by the API';
        translated.voiceHint = 'Defined by the API';
    }
    return translated;
}

function getTtsSelectValue(value, options = []) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return options.some(item => item.value === raw) ? raw : '__custom';
}

function isCustomTtsValue(value, options = []) {
    return getTtsSelectValue(value, options) === '__custom';
}

function inferTencentModelTier(option) {
    const text = `${option?.type || ''} ${option?.label || ''}`.toLowerCase();
    if (!text.trim()) return '';
    if (text.includes('精品')) return 'premium';
    if (text.includes('大模型') || text.includes('超自然')) return 'large';
    return '';
}

function getLocalFallbackProfile() {
    let localUser = null;
    try {
        const raw = localStorage.getItem('cp_user');
        localUser = raw ? JSON.parse(raw) : null;
    } catch {
        localUser = null;
    }

    return {
        name: localUser?.username || 'User',
        username: localUser?.username || 'User',
        avatar: localStorage.getItem('cp_avatar') || '',
        avatar_frame: '',
        bio: '',
        banner: '',
        wallet: 0,
        created_at: Number(localUser?.created_at || 0),
    };
}


function SettingsPanel({
    apiUrl,
    contacts: parentContacts = [],
    desktopWallpaper = 'ocean-live2d',
    wallpaperOptions = [],
    onDesktopWallpaperChange,
    onCharactersUpdate,
    onProfileUpdate,
    onBack
}) {
    const { t, lang } = useLanguage();
    const { login, updateUser } = useAuth();
    const [profile, setProfile] = useState(() => getLocalFallbackProfile());
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [editAvatarFrame, setEditAvatarFrame] = useState('none');
    const [editBanner, setEditBanner] = useState('');
    const [editBio, setEditBio] = useState('');
    const [accountUsername, setAccountUsername] = useState('');
    const [accountCurrentPassword, setAccountCurrentPassword] = useState('');
    const [accountNewPassword, setAccountNewPassword] = useState('');
    const [accountConfirmPassword, setAccountConfirmPassword] = useState('');
    const [accountSaving, setAccountSaving] = useState(false);
    const [accountMessage, setAccountMessage] = useState('');
    const [accountError, setAccountError] = useState('');
    const [profileLoadError, setProfileLoadError] = useState('');

    const [contacts, setContacts] = useState(() => Array.isArray(parentContacts) ? parentContacts : []);
    const [characterMessageStatsById, setCharacterMessageStatsById] = useState({});
    const [selectedSettingsContactId, setSelectedSettingsContactId] = useState('');
    const [editingContact, setEditingContact] = useState(null);
    // Model list fetch state (main API + memory API)
    const [mainModels, setMainModels] = useState([]);
    const [mainModelFetching, setMainModelFetching] = useState(false);
    const [mainModelError, setMainModelError] = useState('');
    const [memModels, setMemModels] = useState([]);
    const [memModelFetching, setMemModelFetching] = useState(false);
    const [memModelError, setMemModelError] = useState('');
    const [customTtsVoiceOpen, setCustomTtsVoiceOpen] = useState(false);
    const [customTtsModelOpen, setCustomTtsModelOpen] = useState(false);
    const [tencentVoiceOptions, setTencentVoiceOptions] = useState([]);
    const [tencentVoiceSource, setTencentVoiceSource] = useState('');
    const [tencentVoiceError, setTencentVoiceError] = useState('');
    const [activeSettingsScreen, setActiveSettingsScreen] = useState('characters');
    const [activeCharacterTab, setActiveCharacterTab] = useState('persona');
    const [ttsPreviewVerifiedIds, setTtsPreviewVerifiedIds] = useState(() => new Set());
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsError, setSessionsError] = useState('');
    const [serviceDiagnostics, setServiceDiagnostics] = useState({ embedding: null, queue: null, cache: null });
    const [serviceDiagnosticsLoading, setServiceDiagnosticsLoading] = useState(false);
    const [serviceDiagnosticsError, setServiceDiagnosticsError] = useState('');
    const [lastBackupAt, setLastBackupAt] = useState(() => Number(localStorage.getItem('cp_last_full_backup_at') || 0));
    const [wipeModalOpen, setWipeModalOpen] = useState(false);
    const [wipeConfirmText, setWipeConfirmText] = useState('');

    const getEditingTtsProviderConfig = useCallback((providerId) => {
        const config = getTtsProviderConfig(providerId);
        const mergedConfig = config.id === 'tencent' && tencentVoiceOptions.length
            ? { ...config, voiceOptions: tencentVoiceOptions }
            : config;
        return translateTtsProviderConfig(mergedConfig, lang);
    }, [tencentVoiceOptions, lang]);

    const tencentVoiceSourceLabel = useCallback((source) => {
        if (!source) return '';
        if (source === 'tencent-docs') return lang === 'en' ? 'Tencent official docs' : '腾讯官方文档';
        return source;
    }, [lang]);

    const ttsPreviewText = useCallback((name) => {
        const displayName = name || (lang === 'en' ? 'this character' : '这个角色');
        if (lang === 'en') {
            return `Hi, I am ${displayName}. This is a voice preview.`;
        }
        return `你好，我是${displayName}。这是一段语音试听。`;
    }, [lang]);

    useEffect(() => {
        if (Array.isArray(parentContacts)) {
            setContacts(parentContacts);
        }
    }, [parentContacts]);

    useEffect(() => {
        if (!contacts.length) {
            setSelectedSettingsContactId('');
            return;
        }
        if (!contacts.some(c => c.id === selectedSettingsContactId)) {
            setSelectedSettingsContactId(contacts[0].id);
        }
    }, [contacts, selectedSettingsContactId]);

    const normalizeCharacterMessageStats = useCallback((stats = {}) => ({
        first_message_at: Number(stats.first_message_at || 0),
        last_message_at: Number(stats.last_message_at || 0),
        last_user_message_at: Number(stats.last_user_message_at || stats.last_user_msg_time || 0),
        private_message_count: Number(stats.private_message_count || 0),
        user_message_count: Number(stats.user_message_count || 0),
        character_message_count: Number(stats.character_message_count || 0)
    }), []);

    useEffect(() => {
        const selectedId = selectedSettingsContactId || contacts[0]?.id || '';
        if (!selectedId || characterMessageStatsById[selectedId]) return;

        const current = contacts.find(c => c.id === selectedId);
        if (
            Number(current?.first_message_at || 0) > 0
            || Number(current?.last_message_at || 0) > 0
            || Number(current?.private_message_count || 0) > 0
        ) {
            return;
        }

        let cancelled = false;
        fetch(`${apiUrl}/characters/${encodeURIComponent(selectedId)}/message-stats`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
        })
            .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
            .then(data => {
                if (cancelled) return;
                setCharacterMessageStatsById(prev => ({
                    ...prev,
                    [selectedId]: normalizeCharacterMessageStats(data.stats || data)
                }));
            })
            .catch(err => console.warn('Failed to load character message stats:', err));

        return () => {
            cancelled = true;
        };
    }, [apiUrl, contacts, selectedSettingsContactId, characterMessageStatsById, normalizeCharacterMessageStats]);

    const loadServiceDiagnostics = useCallback(async () => {
        const selectedId = selectedSettingsContactId || contacts[0]?.id || '';
        setServiceDiagnosticsLoading(true);
        setServiceDiagnosticsError('');
        const authHeaders = { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` };
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
                selectedId ? fetchJson(`/characters/${encodeURIComponent(selectedId)}/cache-stats`) : Promise.resolve(null)
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
        loadServiceDiagnostics().catch(err => {
            setServiceDiagnosticsError(err.message);
            setServiceDiagnosticsLoading(false);
        });
    }, [loadServiceDiagnostics]);

    const getSecretPlaceholder = useCallback((record, field, fallback = '') => {
        if (record?.[`${field}_clear`]) {
            return lang === 'en' ? 'Marked to clear on save' : '已标记保存时清除';
        }
        if (record?.[`${field}_configured`]) {
            const last4 = record?.[`${field}_last4`] ? `••••${record[`${field}_last4`]}` : (lang === 'en' ? 'saved key' : '已保存 Key');
            return lang === 'en'
                ? `Saved: ${last4}. Leave blank to keep it; type a new key to replace.`
                : `已保存：${last4}。留空保留，输入新 Key 替换。`;
        }
        return fallback;
    }, [lang]);

    const getSecretStatusText = useCallback((record, field) => {
        if (record?.[`${field}_clear`]) {
            return lang === 'en' ? 'This saved key will be cleared after saving.' : '保存后会清除当前已保存的 Key。';
        }
        if (record?.[`${field}_configured`]) {
            const last4 = record?.[`${field}_last4`] ? `••••${record[`${field}_last4`]}` : '';
            return lang === 'en'
                ? `Saved ${last4}. Leave this field blank to keep it.`
                : `已保存 ${last4}。这个输入框留空会继续保留原 Key。`;
        }
        return lang === 'en' ? 'No key saved yet.' : '还没有保存 Key。';
    }, [lang]);

    const updateEditingSecret = useCallback((field, value) => {
        setEditingContact(prev => prev ? { ...prev, [field]: value, [`${field}_clear`]: false } : prev);
    }, []);

    const markEditingSecretClear = useCallback((field) => {
        const ok = window.confirm(lang === 'en'
            ? 'Clear the saved key for this field after saving?'
            : '保存后清除这个已保存的 Key？');
        if (!ok) return;
        setEditingContact(prev => prev ? {
            ...prev,
            [field]: '',
            [`${field}_clear`]: true
        } : prev);
    }, [lang]);

    const renderSecretStatus = useCallback((field) => {
        if (!editingContact) return null;
        const isClearMarked = !!editingContact[`${field}_clear`];
        const hasSavedKey = !!editingContact[`${field}_configured`];
        return (
            <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', fontSize: '12px', color: isClearMarked ? '#b91c1c' : '#64748b' }}>
                <span>{getSecretStatusText(editingContact, field)}</span>
                {hasSavedKey && !isClearMarked && (
                    <button
                        type="button"
                        onClick={() => markEditingSecretClear(field)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', border: '1px solid #fecaca', borderRadius: '5px', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                        <Trash2 size={12} /> {lang === 'en' ? 'Clear' : '清除'}
                    </button>
                )}
                {isClearMarked && (
                    <button
                        type="button"
                        onClick={() => setEditingContact(prev => prev ? { ...prev, [`${field}_clear`]: false } : prev)}
                        style={{ padding: '2px 7px', border: '1px solid #cbd5e1', borderRadius: '5px', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                        {lang === 'en' ? 'Undo' : '取消清除'}
                    </button>
                )}
            </div>
        );
    }, [editingContact, getSecretStatusText, lang, markEditingSecretClear]);

    const fetchModels = async (endpoint, key, setList, setFetching, setError, options = {}) => {
        const cleanEndpoint = String(endpoint || '').trim();
        const cleanKey = String(key || '').trim();
        if (!cleanEndpoint) { setError(lang === 'en' ? 'Fill in the endpoint first.' : '请先填写 Endpoint'); return; }
        if (!cleanKey && !options.hasSavedKey) { setError(lang === 'en' ? 'Fill in a key, or use the saved key.' : '请先填写 Key，或使用已保存的 Key'); return; }
        setFetching(true); setError(''); setList([]);
        try {
            const modelUrl = options.characterId
                ? `${apiUrl}/characters/${encodeURIComponent(options.characterId)}/models`
                : `${apiUrl}/models`;
            const res = await fetch(modelUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`
                },
                body: JSON.stringify({ endpoint: cleanEndpoint, key: cleanKey, scope: options.scope || 'main' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setList(data.models || []);
            if (!(data.models || []).length) setError(lang === 'en' ? 'No remote models found. The local Ollama option is still available.' : '未找到远端模型；仍可选择本地 Ollama。');
        } catch (e) { setError((lang === 'en' ? 'Fetch failed: ' : '拉取失败: ') + e.message); }
        setFetching(false);
    };

    const loadTencentVoices = useCallback(async (forceRefresh = false) => {
        try {
            setTencentVoiceError('');
            const res = await fetch(`${apiUrl}/tts/tencent/voices${forceRefresh ? '?refresh=1' : ''}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            const voices = Array.isArray(data.voices) ? data.voices : [];
            if (!voices.length) throw new Error(lang === 'en' ? 'No Tencent Cloud voice list was returned.' : '没有拉到腾讯云音色列表');
            setTencentVoiceOptions(voices.map(voice => ({
                value: String(voice.value || voice.id || '').trim(),
                label: voice.label || `${voice.id || voice.value} ${voice.name || ''} - ${voice.scene || ''}`.trim(),
                type: voice.type || '',
                name: voice.name || '',
                scene: voice.scene || ''
            })).filter(voice => voice.value));
            setTencentVoiceSource(data.source || '');
        } catch (e) {
            setTencentVoiceError(e.message || String(e));
        }
    }, [apiUrl, lang]);

    const loadSessions = useCallback(async () => {
        setSessionsLoading(true);
        setSessionsError('');
        try {
            const res = await fetch(`${apiUrl}/auth/sessions`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            const list = Array.isArray(data.sessions) ? data.sessions : (Array.isArray(data) ? data : []);
            setSessions(list);
        } catch (e) {
            setSessionsError(e.message || (lang === 'en' ? 'Failed to load sessions.' : '会话列表加载失败。'));
        } finally {
            setSessionsLoading(false);
        }
    }, [apiUrl, lang]);

    const revokeSession = async (sessionId, isCurrent = false) => {
        if (!sessionId) return;
        const ok = window.confirm(isCurrent
            ? (lang === 'en' ? 'Revoke the current session? You may need to sign in again.' : '确定撤销当前会话吗？你可能需要重新登录。')
            : (lang === 'en' ? 'Revoke this login session?' : '确定撤销这个登录会话吗？'));
        if (!ok) return;
        try {
            const res = await fetch(`${apiUrl}/auth/sessions/${encodeURIComponent(sessionId)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            await loadSessions();
        } catch (e) {
            setSessionsError(e.message || (lang === 'en' ? 'Failed to revoke session.' : '撤销会话失败。'));
        }
    };

    useEffect(() => {
        // Fetch user profile
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` };
        const fallbackProfile = getLocalFallbackProfile();
        setProfile(prev => prev || fallbackProfile);
        setEditName(prev => prev || fallbackProfile.name || '');
        setEditAvatar(prev => prev || fallbackProfile.avatar || '');
        setEditAvatarFrame(prev => normalizeAvatarFrameId(prev || fallbackProfile.avatar_frame));
        setEditBanner(prev => prev || fallbackProfile.banner || '');
        setEditBio(prev => prev || fallbackProfile.bio || '');
        setAccountUsername(prev => prev || fallbackProfile.username || '');

        const controller = new AbortController();
        let didTimeout = false;
        const timeoutId = setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, 5000);

        fetch(`${apiUrl}/user`, { headers, signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                clearTimeout(timeoutId);
                setProfileLoadError('');
                setProfile(data);
                setEditName(data.name || '');
                setEditAvatar(data.avatar || '');
                setEditAvatarFrame(normalizeAvatarFrameId(data.avatar_frame));
                setEditBanner(data.banner || '');
                setEditBio(data.bio || '');
                setAccountUsername(data.username || '');
            })
            .catch((err) => {
                clearTimeout(timeoutId);
                if (err?.name === 'AbortError' && !didTimeout) {
                    return;
                }
                console.error(err);
                setProfileLoadError(err?.name === 'AbortError' ? 'Profile request timed out.' : (err?.message || 'Failed to load profile.'));
            });

        const fetchCharacters = () => {
            fetch(`${apiUrl}/characters`, { headers })
                .then(res => res.json())
                .then(data => setContacts(data))
                .catch(console.error);
        };

        fetchCharacters();

        window.addEventListener('refresh_contacts', fetchCharacters);
        return () => {
            clearTimeout(timeoutId);
            controller.abort();
            window.removeEventListener('refresh_contacts', fetchCharacters);
        };
    }, [apiUrl, lang]);

    useEffect(() => {
        loadTencentVoices(false);
    }, [loadTencentVoices]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleSaveProfile = async () => {
        const updated = { ...profile, name: editName, avatar: editAvatar, avatar_frame: normalizeAvatarFrameId(editAvatarFrame), banner: editBanner, bio: editBio };
        try {
            const res = await fetch(`${apiUrl}/user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`
                },
                body: JSON.stringify(updated)
            });
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
                if (onProfileUpdate) onProfileUpdate(data.profile);
                setIsEditing(false);
            }
        } catch (e) {
            console.error('Failed to update profile:', e);
        }
    };

    const handleSaveAccount = async () => {
        setAccountError('');
        setAccountMessage('');

        if (!accountCurrentPassword) {
            setAccountError(lang === 'en' ? 'Current password is required.' : '请输入当前密码。');
            return;
        }
        if (accountNewPassword && accountNewPassword !== accountConfirmPassword) {
            setAccountError(lang === 'en' ? 'New passwords do not match.' : '两次输入的新密码不一致。');
            return;
        }

        setAccountSaving(true);
        try {
            const res = await fetch(`${apiUrl}/auth/account`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`
                },
                body: JSON.stringify({
                    username: accountUsername,
                    currentPassword: accountCurrentPassword,
                    newPassword: accountNewPassword
                })
            });
            const raw = await res.text();
            let data = null;
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch {
                const preview = raw.trim().slice(0, 120);
                throw new Error(
                    lang === 'en'
                        ? `Account update endpoint returned non-JSON (HTTP ${res.status}). ${preview}`
                        : `账号更新接口返回的不是 JSON（HTTP ${res.status}）。${preview}`
                );
            }
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to update account');
            }

            login(data.token, data.user);
            updateUser(data.user);
            setProfile(prev => prev ? { ...prev, username: data.user.username } : prev);
            if (onProfileUpdate) onProfileUpdate({ ...(profile || {}), username: data.user.username });
            setAccountCurrentPassword('');
            setAccountNewPassword('');
            setAccountConfirmPassword('');
            setAccountMessage(lang === 'en' ? 'Account updated successfully.' : '账号信息已更新。');
        } catch (e) {
            setAccountError(e.message || (lang === 'en' ? 'Failed to update account.' : '账号更新失败。'));
        } finally {
            setAccountSaving(false);
        }
    };

    const handleDeleteContact = async (id) => {
        if (!window.confirm(lang === 'en' ? 'Are you sure you want to delete this contact and all their data?' : '确定要删除这个联系人及其全部数据吗？')) return;
        try {
            const res = await fetch(`${apiUrl}/characters/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setContacts(prev => prev.filter(contact => String(contact.id) !== String(id)));
                setEditingContact(prev => (String(prev?.id || '') === String(id) ? null : prev));
                window.dispatchEvent(new CustomEvent('character_deleted', { detail: { characterId: id } }));
                if (onCharactersUpdate) onCharactersUpdate({ type: 'deleted', id });
            } else {
                alert((lang === 'en' ? 'Delete failed: ' : '删除失败：') + (data.error || res.statusText || (lang === 'en' ? 'Unknown error' : '未知错误')));
            }
        } catch (e) {
            console.error('Failed to delete character:', e);
            alert((lang === 'en' ? 'Delete failed: ' : '删除失败：') + (e.message || (lang === 'en' ? 'Network error' : '网络错误')));
        }
    };

    const handleWipeData = async (id) => {
        if (!window.confirm(lang === 'en' ? 'Are you sure you want to wipe all data (messages, memories, etc.) for this character?' : '确定要清空该角色的所有数据（消息、记忆等）吗？')) return;
        try {
            const res = await fetch(`${apiUrl}/data/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            const data = await res.json();
            if (data.success) {
                setContacts(prev => prev.map(c => c.id === id ? {
                    ...c,
                    lastMessage: '',
                    time: '',
                    unread: 0,
                    affinity: c.initial_affinity ?? 50,
                    pressure_level: 0,
                    jealousy_level: 0,
                    wallet: 200
                } : c));
                if (editingContact?.id === id) {
                    setEditingContact(prev => prev ? {
                        ...prev,
                        affinity: prev.initial_affinity ?? 50,
                        pressure_level: 0,
                        jealousy_level: 0,
                        wallet: 200
                    } : prev);
                }
                window.dispatchEvent(new CustomEvent('character_data_wiped', { detail: { characterId: id } }));
                window.dispatchEvent(new Event('refresh_contacts'));
                alert(lang === 'en' ? 'Data wiped successfully.' : '数据已清空。');
                if (onCharactersUpdate) onCharactersUpdate();
            }
        } catch (e) {
            console.error('Failed to wipe data:', e);
        }
    };

    const handleExportCharacterData = async (id) => {
        if (!id) return;
        try {
            const res = await fetch(`${apiUrl}/data/${encodeURIComponent(id)}/export`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
            }
            const disposition = res.headers.get('Content-Disposition') || '';
            const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
            const filename = filenameMatch ? filenameMatch[1] : `${id}_character_export.json`;
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.href = objectUrl;
            downloadAnchorNode.download = filename;
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (e) {
            alert((lang === 'en' ? 'Character export failed: ' : '角色导出失败：') + (e.message || e));
        }
    };

    const handleImportCharacterData = async (id, event, mode = 'replace') => {
        const input = event.target;
        const file = input.files?.[0];
        if (!id || !file) return;
        const ok = window.confirm(mode === 'merge'
            ? (lang === 'en' ? 'Merge this archive into the selected character?' : '确定把这个存档合并到当前角色吗？')
            : (lang === 'en' ? 'Replace this character data with the archive? Existing messages and memories may be overwritten.' : '确定用这个存档替换当前角色数据吗？现有消息和记忆可能会被覆盖。'));
        if (!ok) {
            input.value = '';
            return;
        }
        try {
            const formData = new FormData();
            formData.append('archive', file);
            const res = await fetch(`${apiUrl}/data/${encodeURIComponent(id)}/import?mode=${encodeURIComponent(mode)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: formData
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            window.dispatchEvent(new Event('refresh_contacts'));
            alert(lang === 'en' ? 'Character archive imported.' : '角色存档已导入。');
            if (onCharactersUpdate) onCharactersUpdate({ type: 'imported', id });
        } catch (e) {
            alert((lang === 'en' ? 'Character import failed: ' : '角色导入失败：') + (e.message || e));
        } finally {
            input.value = '';
        }
    };

    const handleResetPhysicalState = async (id) => {
        if (!id) return;
        if (!window.confirm(lang === 'en' ? 'Reset energy, sleep, stress, and pressure without touching memories or wallet?' : '确定重置体力、睡眠、压力等身体状态吗？不会影响记忆和钱包。')) return;
        try {
            const res = await fetch(`${apiUrl}/characters/${encodeURIComponent(id)}/reset-physical-state`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            const character = data.character || null;
            if (character) {
                setContacts(prev => prev.map(item => String(item.id) === String(id) ? { ...item, ...character } : item));
                setEditingContact(prev => prev && String(prev.id) === String(id) ? { ...prev, ...character } : prev);
            }
            window.dispatchEvent(new Event('refresh_contacts'));
            alert(lang === 'en' ? 'Physical state reset.' : '身体状态已重置。');
        } catch (e) {
            alert((lang === 'en' ? 'Reset failed: ' : '重置失败：') + (e.message || e));
        }
    };



    const handleSaveContact = async () => {
        if (!editingContact) return;
        try {
            const res = await fetch(`${apiUrl}/characters`, {
                method: 'POST',  // Note: /characters POST handles updates too
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`
                },
                body: JSON.stringify(editingContact)
            });
            const data = await res.json();
            if (res.ok) {
                const savedCharacter = data.character || { ...editingContact };
                setContacts(prev => {
                    const index = prev.findIndex(item => String(item.id) === String(savedCharacter.id));
                    if (index === -1) return [...prev, savedCharacter];
                    return prev.map(item => (String(item.id) === String(savedCharacter.id) ? { ...item, ...savedCharacter } : item));
                });
                setSelectedSettingsContactId(savedCharacter.id);
                setEditingContact(null);
                window.dispatchEvent(new Event('refresh_contacts'));
                if (onCharactersUpdate) onCharactersUpdate({ type: 'updated', id: savedCharacter.id, character: savedCharacter });
                fetch(`${apiUrl}/characters`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } })
                    .then(r => r.json())
                    .then(d => setContacts(d))
                    .catch(console.error);
            } else {
                alert((lang === 'en' ? 'Failed to save: ' : '保存失败：') + (data.error || (lang === 'en' ? 'Unknown error' : '未知错误')));
            }
        } catch (e) {
            console.error('Failed to update contact:', e);
        }
    };

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
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: formData
            });

            const data = await res.json();

            if (data.success) {
                setAvatarCallback(data.url);
                alert(lang === 'en'
                    ? `Upload success!\n\nFile path: ${data.url}\n\nClick Save below to apply this avatar.`
                    : `上传成功！\n\n文件路径：${data.url}\n\n请点击下方“保存”按钮使头像生效。`);
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

    const handleImportDatabase = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!window.confirm(lang === 'en' ? "Warning! This will overwrite your current account archive, including characters, chats, memories, and uploaded assets. Continue?" : "警告：这将覆盖你当前账号的整套存档，包括角色、聊天、记忆和上传资源。是否继续？")) {
            event.target.value = null;
            return;
        }

        const cleanApiUrl = apiUrl.replace(/\/api\/?$/, '');
        const formData = new FormData();
        formData.append('db_file', file);
        try {
            const res = await fetch(`${cleanApiUrl}/api/system/import`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                alert(lang === 'en' ? 'Backup restored and memory indexes rebuilt. The page will refresh in a few seconds.' : '存档恢复完成，记忆索引也已重建。页面将在几秒后自动刷新。');
                setTimeout(() => window.location.reload(), 3000);
            } else {
                alert((lang === 'en' ? 'Failed to restore: ' : '恢复失败：') + (data.error || (lang === 'en' ? 'Unknown error' : '未知错误')));
            }
        } catch (e) {
            console.error('Import Error:', e);
            alert(lang === 'en' ? 'Upload failed.' : '上传失败。');
        } finally {
            event.target.value = null;
        }
    };

    const handleExportDatabase = async () => {
        try {
            const res = await fetch(`${apiUrl}/system/export`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || `Export failed with status ${res.status}`);
            }

            const disposition = res.headers.get('Content-Disposition') || '';
            const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
            const filename = filenameMatch ? filenameMatch[1] : 'chatpulse_backup.zip';
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.href = objectUrl;
            downloadAnchorNode.download = filename;
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(objectUrl);
            const now = Date.now();
            localStorage.setItem('cp_last_full_backup_at', String(now));
            setLastBackupAt(now);
        } catch (e) {
            console.error('Export Error:', e);
            alert(lang === 'en' ? `Backup download failed: ${e.message}` : `备份下载失败：${e.message}`);
        }
    };

    const handleSystemWipe = async (skipPrompt = false) => {
        if (!skipPrompt && !window.confirm(lang === 'en' ? 'DANGER: This will permanently wipe ALL characters, chats, and memories. Are you absolutely sure?' : '危险：这将永久清空所有角色、聊天、群聊和记忆。你确定要执行吗？')) return;

        // Double check
        if (!skipPrompt && !window.confirm(lang === 'en' ? 'Final confirmation: Wipe everything?' : '最后一次确认：真的要抹除所有数据吗？')) return;

        try {
            const res = await fetch(`${apiUrl}/system/wipe`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` }
            });
            const data = await res.json();
            if (data.success) {
                alert(lang === 'en' ? 'All data wiped successfully.' : '所有数据已成功清空。');
                if (onCharactersUpdate) onCharactersUpdate();
                window.location.reload();
            } else {
                alert((lang === 'en' ? 'Wipe failed: ' : '清空失败：') + (data.error || (lang === 'en' ? 'Unknown error' : '未知错误')));
            }
        } catch (e) {
            console.error('Wipe Error:', e);
            alert(lang === 'en' ? 'Wipe failed.' : '清空失败。');
        }
    };

    const renderAvatarFramePicker = (value, onChange, previewSrc, previewName = 'User') => (
        <div className="avatar-frame-picker">
            {AVATAR_FRAME_OPTIONS.map(option => {
                const selected = normalizeAvatarFrameId(value) === option.id;
                const optionLabel = lang === 'en' ? (option.labelEn || option.label) : option.label;
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

    const selectedSettingsContact = React.useMemo(() => {
        const base = contacts.find(c => c.id === selectedSettingsContactId) || contacts[0] || null;
        return base
            ? {
                ...base,
                ...(characterMessageStatsById[base.id] || {})
            }
            : null;
    }, [contacts, selectedSettingsContactId, characterMessageStatsById]);
    const selectedSettingsContactOnline = Boolean(
        selectedSettingsContact
        && String(selectedSettingsContact.api_endpoint || '').trim()
        && selectedSettingsContact.api_key_configured === true
        && String(selectedSettingsContact.model_name || '').trim()
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
            minute: '2-digit'
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
            const host = String(hostname || '').replace(/^api\./i, '').replace(/^www\./i, '');
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
            return raw.replace(/^https?:\/\//i, '').split('/')[0].slice(0, 42);
        }
    };
    const getCharacterApiBadge = (character, scope) => {
        const isMemory = scope === 'memory';
        const endpoint = isMemory ? character?.memory_api_endpoint : character?.api_endpoint;
        const model = String((isMemory ? character?.memory_model_name : character?.model_name) || '').trim();
        const endpointName = formatApiSourceName(endpoint);
        const hasSavedKey = isMemory ? character?.memory_api_key_configured === true : character?.api_key_configured === true;
        const isConfigured = Boolean(String(endpoint || '').trim() && model && hasSavedKey);
        const emptyLabel = lang === 'en' ? 'Not configured' : '未配置';
        const value = [model, endpointName].filter(Boolean).join(' · ') || emptyLabel;
        const label = isMemory
            ? (lang === 'en' ? 'Aux API' : '辅助 API')
            : (lang === 'en' ? 'Main API' : '主 API');
        const title = `${label}: ${value}${endpoint ? `\n${endpoint}` : ''}`;
        return { label, value, title, isConfigured };
    };
    const selectedTtsConfig = getTtsProviderConfig(selectedSettingsContact?.tts_provider);
    const selectedContactDetailRows = selectedSettingsContact ? [
        [
            lang === 'en' ? 'Created' : '加入时间',
            formatJoinTime(selectedSettingsContact)
        ],
        [
            lang === 'en' ? 'Conversations' : '对话次数',
            `${Number(selectedSettingsContact.private_message_count || 0)} ${lang === 'en' ? 'messages' : '次'}`
        ],
        [
            lang === 'en' ? 'User / Character' : '用户 / 角色',
            `${Number(selectedSettingsContact.user_message_count || 0)} / ${Number(selectedSettingsContact.character_message_count || 0)}`
        ],
        [lang === 'en' ? 'Main Model' : '主模型', selectedSettingsContact.model_name || (lang === 'en' ? 'Not configured' : '未配置')],
        [
            lang === 'en' ? 'Main API' : '主 API',
            selectedSettingsContactOnline
                ? (lang === 'en' ? 'Ready' : '可用')
                : (lang === 'en' ? 'No valid key' : '未配置有效 Key')
        ],
        [lang === 'en' ? 'Memory Model' : '记忆模型', selectedSettingsContact.memory_model_name || (lang === 'en' ? 'Not configured' : '未配置')],
        [
            lang === 'en' ? 'Voice' : '语音',
            isSettingOn(selectedSettingsContact.tts_enabled, false)
                ? `${selectedTtsConfig.label}${selectedSettingsContact.tts_voice ? ` · ${selectedSettingsContact.tts_voice}` : ''}`
                : (lang === 'en' ? 'Off' : '关闭')
        ],
        [
            lang === 'en' ? 'Proactive' : '主动消息',
            isSettingOn(selectedSettingsContact.sys_proactive, true)
                ? `${selectedSettingsContact.interval_min ?? 10}-${selectedSettingsContact.interval_max ?? 120} ${lang === 'en' ? 'min' : '分钟'}`
                : (lang === 'en' ? 'Off' : '关闭')
        ],
        [lang === 'en' ? 'Timer Tasks' : '定时任务', isSettingOn(selectedSettingsContact.sys_timer, true) ? (lang === 'en' ? 'On' : '开启') : (lang === 'en' ? 'Off' : '关闭')],
        [
            lang === 'en' ? 'Emotion Systems' : '情绪系统',
            `${isSettingOn(selectedSettingsContact.sys_pressure, true) ? (lang === 'en' ? 'Pressure on' : '压力开') : (lang === 'en' ? 'Pressure off' : '压力关')} · ${isSettingOn(selectedSettingsContact.sys_jealousy, true) ? (lang === 'en' ? 'Jealousy on' : '嫉妒开') : (lang === 'en' ? 'Jealousy off' : '嫉妒关')}`
        ],
        [lang === 'en' ? 'City Activity' : '商业街活动', isSettingOn(selectedSettingsContact.sys_survival, true) ? (lang === 'en' ? 'Joined' : '参与') : (lang === 'en' ? 'Paused' : '不参与')],
        [
            lang === 'en' ? 'Status' : '角色状态',
            selectedSettingsContact.is_blocked
                ? (lang === 'en' ? 'Blocked' : '已拉黑')
                : (selectedSettingsContact.status === 'active' || !selectedSettingsContact.status ? (lang === 'en' ? 'Active' : '正常') : selectedSettingsContact.status)
        ]
    ] : [];

    const getCharacterOnline = (character) => Boolean(
        character
        && String(character.api_endpoint || '').trim()
        && character.api_key_configured === true
        && String(character.model_name || '').trim()
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

    const getPlayerInteractionTimestamp = (character) => normalizeTimestampMs(
        character?.last_user_message_at || character?.last_user_msg_time
    );

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
            day: '2-digit'
        });
    };

    const formatCompactInteraction = (character, emptyLabel) => formatCompactInteractionTime(
        character?.last_message_at || character?.last_user_msg_time || character?.updated_at,
        emptyLabel
    );

    const projectUsageDays = getProjectUsageDays(profile.created_at);

    const latestPlayerInteractionCharacter = contacts.reduce((latest, item) => {
        const currentTime = getPlayerInteractionTimestamp(item);
        const latestTime = getPlayerInteractionTimestamp(latest);
        return currentTime > latestTime ? item : latest;
    }, null);
    const latestPlayerInteractionAt = getPlayerInteractionTimestamp(latestPlayerInteractionCharacter);
    const wallpaperOptionList = Array.isArray(wallpaperOptions) ? wallpaperOptions : [];
    const selectedWallpaperOption = wallpaperOptionList.find(option => option.id === desktopWallpaper) || wallpaperOptionList[0] || null;
    const getWallpaperOptionLabel = (option) => (lang === 'en' ? option?.labelEn : option?.labelZh) || option?.label || option?.id || '';
    const getWallpaperOptionDescription = (option) => (lang === 'en' ? option?.descriptionEn : option?.descriptionZh) || option?.description || '';
    const screenLabels = {
        profile: lang === 'en' ? 'Profile' : '个人资料',
        security: lang === 'en' ? 'Account Security' : '账号安全',
        characters: lang === 'en' ? 'Character Config' : '角色配置',
        models: lang === 'en' ? 'Models & Voice' : '模型与声音',
        backup: lang === 'en' ? 'Backup & Migration' : '备份与迁移'
    };
    const getCharacterReadiness = (character) => {
        const mainModelReady = Boolean(
            String(character?.api_endpoint || '').trim()
            && character?.api_key_configured === true
            && String(character?.model_name || '').trim()
        );
        const memoryModelReady = Boolean(
            String(character?.memory_api_endpoint || '').trim()
            && character?.memory_api_key_configured === true
            && String(character?.memory_model_name || '').trim()
        );
        const personaReady = Boolean(String(character?.name || '').trim() && String(character?.persona || '').trim());
        const ttsEnabled = character?.tts_enabled === 1;
        const ttsConfigured = !ttsEnabled || Boolean(
            character?.tts_provider
            && (character?.tts_api_key_configured || character?.tts_provider === 'browser')
            && character?.tts_voice
        );
        const ttsPreviewVerified = ttsEnabled && ttsConfigured && ttsPreviewVerifiedIds.has(character?.id);
        return {
            mainModelReady,
            memoryModelReady,
            personaReady,
            ttsEnabled,
            ttsConfigured,
            ttsPreviewVerified,
            ready: mainModelReady && personaReady
        };
    };
    const profileReady = Boolean(String(profile?.name || '').trim() && (profile?.avatar || profile?.username));
    const characterReadiness = contacts.map(character => ({ character, readiness: getCharacterReadiness(character) }));
    const mainModelReadyCharacters = characterReadiness.filter(item => item.readiness.mainModelReady).length;
    const ttsNeedsAttention = characterReadiness.filter(item => item.readiness.ttsEnabled && (!item.readiness.ttsConfigured || !item.readiness.ttsPreviewVerified));
    const actionableAttention = [
        ...characterReadiness
            .filter(item => !item.readiness.mainModelReady)
            .slice(0, 5)
            .map(item => ({
                key: `main-${item.character.id}`,
                tone: 'warning',
                title: lang === 'en' ? `${item.character.name}: main model is not connected` : `${item.character.name}：主模型未连接`,
                detail: lang === 'en' ? 'This character cannot reliably reply in private chat, groups, or city actions.' : '角色可能无法正常私聊、群聊或执行商业街行动。',
                action: lang === 'en' ? 'Connect model' : '去连接',
                onClick: () => {
                    setSelectedSettingsContactId(item.character.id);
                    setActiveSettingsScreen('models');
                }
            })),
        ...ttsNeedsAttention.slice(0, 4).map(item => ({
            key: `tts-${item.character.id}`,
            tone: 'pink',
            title: !item.readiness.ttsConfigured
                ? (lang === 'en' ? `${item.character.name}: voice is incomplete` : `${item.character.name}：声音配置不完整`)
                : (lang === 'en' ? `${item.character.name}: voice needs a preview test` : `${item.character.name}：声音需要试听验证`),
            detail: lang === 'en' ? 'TTS is optional, but enabled voices should be tested in this session.' : 'TTS 是可选能力，但已启用的声音应在当前会话试听一次。',
            action: lang === 'en' ? 'Open voice' : '打开声音',
            onClick: () => {
                setSelectedSettingsContactId(item.character.id);
                setActiveSettingsScreen('models');
                openCharacterEditor(item.character);
            }
        })),
        ...(!profileReady ? [{
            key: 'profile',
            tone: 'blue',
            title: lang === 'en' ? 'Profile is missing a display name or avatar' : '用户资料缺少显示名或头像',
            detail: lang === 'en' ? 'Complete your profile before sharing screenshots or exports.' : '先补齐资料，再分享截图或导出会更清楚。',
            action: lang === 'en' ? 'Edit profile' : '编辑资料',
            onClick: () => setActiveSettingsScreen('profile')
        }] : []),
        {
            key: 'backup',
            tone: 'blue',
            title: lastBackupAt
                ? (lang === 'en' ? 'A full backup exists in this browser' : '这个浏览器已记录过完整备份')
                : (lang === 'en' ? 'Create regular full backups' : '建议定期创建完整备份'),
            detail: lastBackupAt
                ? formatSettingsDate(lastBackupAt)
                : (lang === 'en' ? 'There is no backend metadata for the last backup time, so this only tracks exports made from this browser.' : '后端没有最近备份时间接口，这里只记录本浏览器导出的时间。'),
            action: lang === 'en' ? 'Backup' : '创建备份',
            onClick: () => setActiveSettingsScreen('backup')
        }
    ].slice(0, 8);
    const setupSteps = [
        {
            key: 'profile',
            done: profileReady,
            label: lang === 'en' ? 'Profile' : '资料完整',
            detail: profileReady ? (lang === 'en' ? 'Ready' : '已完成') : (lang === 'en' ? 'Needs profile' : '需要补充'),
            screen: 'profile'
        },
        {
            key: 'characters',
            done: contacts.length > 0,
            label: lang === 'en' ? 'Characters' : '角色已配置',
            detail: `${contacts.length} ${lang === 'en' ? 'characters' : '位角色'}`,
            screen: 'characters'
        },
        {
            key: 'models',
            done: contacts.length > 0 && mainModelReadyCharacters > 0,
            label: lang === 'en' ? 'Main model' : '主模型已连接',
            detail: `${mainModelReadyCharacters} / ${contacts.length || 0}`,
            screen: 'models'
        },
        {
            key: 'voice',
            done: ttsNeedsAttention.length === 0,
            label: lang === 'en' ? 'Voice' : '声音设置',
            detail: ttsNeedsAttention.length === 0 ? (lang === 'en' ? 'No action' : '无需处理') : (lang === 'en' ? 'Needs attention' : '需要关注'),
            screen: 'models'
        }
    ];
    const completedSteps = setupSteps.filter(item => item.done).length;
    const setupPercent = Math.round((completedSteps / setupSteps.length) * 100);
    const settingsNavItems = [
        { key: 'profile', icon: <UserRound size={16} />, label: screenLabels.profile, detail: lang === 'en' ? 'Avatar, bio, appearance' : '头像、签名和外观', notice: !profileReady },
        { key: 'security', icon: <Shield size={16} />, label: screenLabels.security, detail: lang === 'en' ? 'Username, password, sessions' : '用户名、密码和会话' },
        { key: 'characters', icon: <UsersRound size={16} />, label: screenLabels.characters, detail: lang === 'en' ? 'Persona, behavior, context' : '人设、行为与上下文', count: contacts.length },
        { key: 'models', icon: <AudioWaveform size={16} />, label: screenLabels.models, detail: lang === 'en' ? 'Main, memory, TTS' : '主模型、记忆和 TTS', notice: ttsNeedsAttention.length > 0 || mainModelReadyCharacters < contacts.length },
        { key: 'backup', icon: <Database size={16} />, label: screenLabels.backup, detail: lang === 'en' ? 'Import, export, reset' : '导入、导出和恢复' }
    ];
    const selectedTtsProviderLabel = getTtsProviderConfig(selectedSettingsContact?.tts_provider).label;
    const activeCharacterForModel = selectedSettingsContact || contacts[0] || null;
    const activeCharacterModelReadiness = activeCharacterForModel ? getCharacterReadiness(activeCharacterForModel) : null;
    const formatSessionDevice = (session = {}) => session.device
        || session.user_agent_summary
        || session.userAgent
        || session.user_agent
        || session.platform
        || (lang === 'en' ? 'Unknown device' : '未知设备');
    const formatSessionMeta = (session = {}) => [
        session.ip || session.ip_address,
        formatSettingsDate(session.last_active_at || session.updated_at || session.created_at, lang === 'en' ? 'No activity recorded' : '暂无活跃记录')
    ].filter(Boolean).join(' · ');

    const openCharacterEditor = (character) => {
        if (!character) return;
        setCustomTtsVoiceOpen(false);
        setCustomTtsModelOpen(false);
        setEditingContact({
            ...character,
            avatar_frame: normalizeAvatarFrameId(character.avatar_frame),
            system_prompt: character.system_prompt || getDefaultGuidelines(lang),
            tts_provider: character.tts_provider || 'tencent',
            tts_trigger_mode: character.tts_trigger_mode || 'tagged'
        });
    };

    const activeCharacterDraft = editingContact || selectedSettingsContact;
    const activePreviewContact = activeCharacterDraft || selectedSettingsContact;
    const activeReadiness = activePreviewContact ? getCharacterReadiness(activePreviewContact) : null;
    const ensureCharacterDraft = useCallback((patch = {}) => {
        setEditingContact(prev => {
            const base = prev || selectedSettingsContact || {
                id: `character_${Date.now()}`,
                name: lang === 'en' ? 'New Character' : '新角色',
                avatar: '',
                avatar_frame: 'none',
                persona: '',
                world_info: '',
                system_prompt: getDefaultGuidelines(lang),
                tts_provider: 'tencent',
                tts_trigger_mode: 'tagged',
                sys_proactive: 1,
                sys_timer: 1,
                sys_pressure: 1,
                sys_jealousy: 1,
                sys_survival: 1,
                sys_city_social: 1,
                llm_debug_capture: 1,
                context_msg_limit: 60,
                private_summary_threshold: 30,
                interval_min: 10,
                interval_max: 120,
                max_tokens: 800,
                wallet: 200
            };
            return {
                ...base,
                avatar_frame: normalizeAvatarFrameId(base.avatar_frame),
                system_prompt: base.system_prompt || getDefaultGuidelines(lang),
                tts_provider: base.tts_provider || 'tencent',
                tts_trigger_mode: base.tts_trigger_mode || 'tagged',
                ...patch
            };
        });
    }, [lang, selectedSettingsContact]);

    const updateCharacterDraft = useCallback((patch) => {
        ensureCharacterDraft(patch);
    }, [ensureCharacterDraft]);

    const applyLocalModelPreset = useCallback((scope = 'main') => {
        if (scope === 'memory') {
            updateCharacterDraft({
                memory_api_endpoint: LOCAL_OLLAMA_MODEL_PRESET.api_endpoint,
                memory_api_key: LOCAL_OLLAMA_MODEL_PRESET.api_key,
                memory_api_key_clear: false,
                memory_model_name: LOCAL_OLLAMA_MODEL_PRESET.model_name
            });
            setMemModels(prev => withLocalModelOption(prev));
            setMemModelError('');
            return;
        }
        updateCharacterDraft({
            api_endpoint: LOCAL_OLLAMA_MODEL_PRESET.api_endpoint,
            api_key: LOCAL_OLLAMA_MODEL_PRESET.api_key,
            api_key_clear: false,
            model_name: LOCAL_OLLAMA_MODEL_PRESET.model_name
        });
        setMainModels(prev => withLocalModelOption(prev));
        setMainModelError('');
    }, [updateCharacterDraft]);

    const handleMainModelSelect = useCallback((modelName) => {
        if (modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name) {
            applyLocalModelPreset('main');
            return;
        }
        updateCharacterDraft({ model_name: modelName });
    }, [applyLocalModelPreset, updateCharacterDraft]);

    const handleMemoryModelSelect = useCallback((modelName) => {
        if (modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name) {
            applyLocalModelPreset('memory');
            return;
        }
        updateCharacterDraft({ memory_model_name: modelName });
    }, [applyLocalModelPreset, updateCharacterDraft]);

    const selectControlCharacter = useCallback((character) => {
        if (!character) return;
        if (editingContact && String(editingContact.id || '') !== String(character.id || '')) {
            const ok = window.confirm(lang === 'en'
                ? 'Discard the current unsaved character draft and switch?'
                : '放弃当前未保存的角色草稿并切换吗？');
            if (!ok) return;
            setEditingContact(null);
        }
        setSelectedSettingsContactId(character.id);
        setActiveSettingsScreen('characters');
    }, [editingContact, lang]);

    const createCharacterDraft = () => {
        const id = `char_${Date.now()}`;
        setSelectedSettingsContactId(id);
        setActiveSettingsScreen('characters');
        setActiveCharacterTab('persona');
        setEditingContact({
            id,
            name: lang === 'en' ? 'New Character' : '新角色',
            avatar: '',
            avatar_frame: 'none',
            persona: '',
            world_info: '',
            system_prompt: getDefaultGuidelines(lang),
            api_endpoint: '',
            api_key: '',
            model_name: '',
            memory_api_endpoint: '',
            memory_api_key: '',
            memory_model_name: '',
            tts_provider: 'tencent',
            tts_trigger_mode: 'tagged',
            tts_enabled: 0,
            sys_proactive: 1,
            sys_timer: 1,
            sys_pressure: 1,
            sys_jealousy: 1,
            sys_survival: 1,
            sys_city_social: 1,
            llm_debug_capture: 1,
            context_msg_limit: 60,
            private_summary_threshold: 30,
            interval_min: 10,
            interval_max: 120,
            max_tokens: 800,
            wallet: 200,
            affinity: 50,
            energy: 100,
            calories: 2000,
            stress: 20,
            pressure_level: 0
        });
    };

    const compareDraftValue = (record, field) => {
        if (field === 'system_prompt') return String(record?.system_prompt || getDefaultGuidelines(lang));
        if (['sys_proactive', 'sys_timer', 'sys_pressure', 'sys_jealousy', 'sys_survival', 'sys_city_social', 'llm_debug_capture', 'tts_enabled', 'tts_autoplay'].includes(field)) {
            return Number(record?.[field] ?? 0);
        }
        if ([
            'max_tokens', 'context_msg_limit', 'private_summary_threshold', 'interval_min', 'interval_max',
            'wallet', 'affinity', 'energy', 'calories', 'stress', 'pressure_level',
            'sleep_debt', 'sleep_pressure', 'mood', 'social_need', 'health', 'satiety', 'stomach_load'
        ].includes(field)) {
            return Number(record?.[field] ?? 0);
        }
        return String(record?.[field] ?? '');
    };
    const draftCompareFields = [
        'id', 'name', 'avatar', 'avatar_frame', 'persona', 'world_info', 'system_prompt',
        'api_endpoint', 'model_name', 'memory_api_endpoint', 'memory_model_name',
        'max_tokens', 'context_msg_limit', 'private_summary_threshold', 'interval_min', 'interval_max',
        'sys_proactive', 'sys_timer', 'sys_pressure', 'sys_jealousy', 'sys_survival', 'sys_city_social',
        'llm_debug_capture', 'wallet', 'affinity', 'energy', 'calories', 'stress', 'pressure_level',
        'sleep_debt', 'sleep_pressure', 'mood', 'social_need', 'health', 'satiety', 'stomach_load',
        'tts_provider', 'tts_voice', 'tts_model', 'tts_endpoint', 'tts_trigger_mode', 'tts_enabled', 'tts_autoplay'
    ];
    const selectedOriginalForDraft = selectedSettingsContact && editingContact && String(selectedSettingsContact.id) === String(editingContact.id)
        ? selectedSettingsContact
        : null;
    const characterDraftChanged = Boolean(editingContact && (
        !selectedOriginalForDraft
        || draftCompareFields.some(field => compareDraftValue(editingContact, field) !== compareDraftValue(selectedOriginalForDraft, field))
        || Boolean(editingContact.api_key || editingContact.api_key_clear || editingContact.memory_api_key || editingContact.memory_api_key_clear || editingContact.tts_api_key || editingContact.tts_api_key_clear)
    ));
    const controlHasContextLimitChange = Boolean(editingContact && selectedOriginalForDraft && Number(editingContact.context_msg_limit ?? 60) !== Number(selectedOriginalForDraft.context_msg_limit ?? 60));
    const controlHasModelChange = Boolean(editingContact && selectedOriginalForDraft && (
        compareDraftValue(editingContact, 'api_endpoint') !== compareDraftValue(selectedOriginalForDraft, 'api_endpoint')
        || compareDraftValue(editingContact, 'model_name') !== compareDraftValue(selectedOriginalForDraft, 'model_name')
        || compareDraftValue(editingContact, 'memory_api_endpoint') !== compareDraftValue(selectedOriginalForDraft, 'memory_api_endpoint')
        || compareDraftValue(editingContact, 'memory_model_name') !== compareDraftValue(selectedOriginalForDraft, 'memory_model_name')
        || Boolean(editingContact.api_key || editingContact.api_key_clear || editingContact.memory_api_key || editingContact.memory_api_key_clear)
    ));
    const controlHasTimerChange = Boolean(editingContact && selectedOriginalForDraft && (
        compareDraftValue(editingContact, 'interval_min') !== compareDraftValue(selectedOriginalForDraft, 'interval_min')
        || compareDraftValue(editingContact, 'interval_max') !== compareDraftValue(selectedOriginalForDraft, 'interval_max')
        || compareDraftValue(editingContact, 'sys_proactive') !== compareDraftValue(selectedOriginalForDraft, 'sys_proactive')
    ));
    const controlHasVoiceChange = Boolean(editingContact && selectedOriginalForDraft && (
        ['tts_provider', 'tts_voice', 'tts_model', 'tts_endpoint', 'tts_trigger_mode', 'tts_enabled', 'tts_autoplay'].some(field => compareDraftValue(editingContact, field) !== compareDraftValue(selectedOriginalForDraft, field))
        || Boolean(editingContact.tts_api_key || editingContact.tts_api_key_clear)
    ));
    const controlChangeCount = [
        characterDraftChanged,
        controlHasModelChange,
        controlHasTimerChange,
        controlHasContextLimitChange,
        controlHasVoiceChange
    ].filter(Boolean).length;
    const hasUnsavedSettings = characterDraftChanged || isEditing;
    const activePreviewDescription = String(activePreviewContact?.persona || '').trim();
    const activePreviewTtsProviderLabel = getTtsProviderConfig(activePreviewContact?.tts_provider).label;
    const mainModelOptions = withLocalModelOption(mainModels);
    const memModelOptions = withLocalModelOption(memModels);
    const getModelOptionLabel = (model) => (
        model === LOCAL_OLLAMA_MODEL_PRESET.model_name
            ? `${model} · ${lang === 'en' ? 'Local Ollama' : '本地 Ollama'}`
            : model
    );

    return (
        <>
            <div className="settings-panel-page settings-control-center-page settings-guided-page">
                <header className="settings-guided-header">
                    <div className="settings-guided-brand">
                        <span><Activity size={19} /></span>
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
                                ? (characterDraftChanged
                                    ? (lang === 'en' ? `${controlChangeCount || 1} character changes` : `${controlChangeCount || 1} 项角色改动待保存`)
                                    : (lang === 'en' ? 'Unsaved draft' : '有未保存草稿'))
                                : (lang === 'en' ? 'Saved' : '所有更改已保存')}
                        </span>
                        <button
                            type="button"
                            onClick={async () => {
                                if (characterDraftChanged) await handleSaveContact();
                                if (isEditing) await handleSaveProfile();
                            }}
                            disabled={!hasUnsavedSettings}
                        >
                            <Save size={15} />{lang === 'en' ? 'Save' : '保存'}
                        </button>
                    </div>
                </header>

                <div className="settings-guided-shell">
                    <aside className="settings-guided-sidebar">
                        <nav>
                            {settingsNavItems.map(item => (
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
                                {lang === 'en' ? 'Live profile sync is delayed. Showing local fallback data for now.' : '实时用户资料同步超时，当前先显示本地兜底数据。'}
                                <div>{profileLoadError}</div>
                            </div>
                        )}

                        {activeSettingsScreen === 'overview' && (
                            <section className="settings-guided-overview">
                                <article className="settings-setup-hero">
                                    <div className="settings-setup-copy">
                                        <span className="settings-guided-kicker">SETUP PROGRESS</span>
                                        <h1>{setupPercent >= 100 ? (lang === 'en' ? 'ChatPulse is ready' : '你的 ChatPulse 已准备就绪') : (lang === 'en' ? 'ChatPulse is almost ready' : '你的 ChatPulse 几乎准备就绪')}</h1>
                                        <p>{lang === 'en' ? 'Finish the remaining tasks so profile, characters, models, memory, and voice stay reliable.' : '完成剩余任务，让资料、角色、模型、记忆和声音都保持可用。'}</p>
                                    </div>
                                    <div className="settings-setup-progress">
                                        <span><strong>{completedSteps} / {setupSteps.length} {lang === 'en' ? 'done' : '已完成'}</strong><small>{lang === 'en' ? 'Overall setup' : '整体配置'}</small></span>
                                        <i><b style={{ width: `${setupPercent}%` }} /></i>
                                    </div>
                                    <div className="settings-setup-steps">
                                        {setupSteps.map(step => (
                                            <button
                                                type="button"
                                                key={step.key}
                                                className={step.done ? 'is-done' : 'needs-attention'}
                                                onClick={() => setActiveSettingsScreen(step.screen)}
                                            >
                                                <span>{step.done ? <CheckCircle2 size={15} /> : <CircleDotDashed size={15} />}</span>
                                                <strong>{step.label}</strong>
                                                <small>{step.detail}</small>
                                            </button>
                                        ))}
                                    </div>
                                </article>

                                <section className="settings-readiness-section">
                                    <div className="settings-section-heading">
                                        <div>
                                            <span className="settings-guided-kicker">CHARACTER READINESS</span>
                                            <h2>{lang === 'en' ? 'Character readiness' : '角色就绪情况'}</h2>
                                            <p>{lang === 'en' ? 'Core chat depends on persona and the main model. Memory and voice are shown separately.' : '核心聊天取决于人设和主模型；记忆与声音单独展示。'}</p>
                                        </div>
                                        <button type="button" className="settings-guided-text-button" onClick={() => setActiveSettingsScreen('characters')}>
                                            {lang === 'en' ? 'Manage characters' : '管理全部角色'} <ChevronRight size={14} />
                                        </button>
                                    </div>
                                    <div className="settings-readiness-table">
                                        <div className="settings-readiness-head">
                                            <span>{lang === 'en' ? 'Character' : '角色'}</span>
                                            <span>{lang === 'en' ? 'Status' : '状态'}</span>
                                            <span>{lang === 'en' ? 'Main' : '主模型'}</span>
                                            <span>{lang === 'en' ? 'Memory' : '记忆模型'}</span>
                                            <span>{lang === 'en' ? 'Voice' : '声音'}</span>
                                            <span>{lang === 'en' ? 'Action' : '操作'}</span>
                                        </div>
                                        {characterReadiness.map(({ character, readiness }) => (
                                            <button
                                                type="button"
                                                className={`settings-readiness-row ${selectedSettingsContact?.id === character.id ? 'is-selected' : ''} ${!readiness.ready ? 'has-error' : ''}`}
                                                key={character.id}
                                                onClick={() => {
                                                    setSelectedSettingsContactId(character.id);
                                                    setActiveSettingsScreen(readiness.ready ? 'characters' : 'models');
                                                }}
                                            >
                                                <span className="settings-readiness-character">
                                                    <AvatarWithFrame
                                                        size={36}
                                                        frame={character.avatar_frame}
                                                        src={resolveAvatarUrl(character.avatar, apiUrl, character.name || character.id || 'User')}
                                                        fallbackSrc={defaultAvatarUrl(character.name || character.id || 'User')}
                                                        alt={character.name}
                                                    />
                                                    <span><strong>{character.name}</strong><small>{formatCompactInteraction(character)}</small></span>
                                                </span>
                                                <span><i className={`settings-status-pill ${readiness.ready ? 'ok' : 'warning'}`}>{readiness.ready ? (lang === 'en' ? 'Ready' : '可用') : (lang === 'en' ? 'Needs setup' : '待处理')}</i></span>
                                                <span className={readiness.mainModelReady ? '' : 'settings-error-text'}>{readiness.mainModelReady ? character.model_name : (lang === 'en' ? 'Missing' : '未连接')}</span>
                                                <span>{readiness.memoryModelReady ? character.memory_model_name : (lang === 'en' ? 'Optional' : '可选')}</span>
                                                <span>{readiness.ttsEnabled ? (readiness.ttsConfigured ? (readiness.ttsPreviewVerified ? (lang === 'en' ? 'Verified' : '已试听') : (lang === 'en' ? 'Preview needed' : '待试听')) : (lang === 'en' ? 'Incomplete' : '不完整')) : (lang === 'en' ? 'Off' : '关闭')}</span>
                                                <span className="settings-row-action">{readiness.ready ? (lang === 'en' ? 'Details' : '查看详情') : (lang === 'en' ? 'Fix' : '去处理')} <ChevronRight size={13} /></span>
                                            </button>
                                        ))}
                                        {characterReadiness.length === 0 && (
                                            <div className="settings-guided-empty">{lang === 'en' ? 'No characters yet. Create one from the contacts page.' : '还没有角色，请先在联系人页面创建角色。'}</div>
                                        )}
                                    </div>
                                </section>

                                <section className="settings-attention-section">
                                    <div className="settings-section-heading compact">
                                        <div>
                                            <span className="settings-guided-kicker">NEEDS ATTENTION</span>
                                            <h2>{lang === 'en' ? 'Needs attention' : '需要关注'}</h2>
                                        </div>
                                        <span className="settings-count-badge">{actionableAttention.length}</span>
                                    </div>
                                    <div className="settings-attention-list">
                                        {actionableAttention.map(item => (
                                            <button type="button" key={item.key} onClick={item.onClick}>
                                                <span className={`settings-attention-icon ${item.tone}`}><TriangleAlert size={16} /></span>
                                                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                                                <em>{item.action} <ChevronRight size={13} /></em>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            </section>
                        )}

                        <div className="settings-guided-screen" hidden={activeSettingsScreen !== 'profile'}>
                <section id="settings-profile-section" className="settings-card settings-command-profile-card">
                    {onBack && (
                        <button className="mobile-back-btn settings-command-back" onClick={onBack} title={lang === 'en' ? 'Back' : '返回'}>
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
                                <span className="settings-character-status online"><i />{lang === 'en' ? 'Online' : '在线'}</span>
                            </div>
                            <p>{lang === 'en' ? 'Signature:' : '签名：'}{profile.bio || (lang === 'en' ? 'Keep curious, keep warm.' : '保持好奇，保持热爱。')}</p>
                        </div>
                    </div>
                    <div className="settings-command-profile-stats" aria-label={lang === 'en' ? 'Profile stats' : '档案统计'}>
                        <div className="settings-command-stat">
                            <Wallet size={25} />
                            <span>{lang === 'en' ? 'Wallet' : '钱包余额'}</span>
                            <strong>¥{Number(profile.wallet ?? 100).toFixed(2)}</strong>
                        </div>
                        <div className="settings-command-stat">
                            <CalendarDays size={27} />
                            <span>{lang === 'en' ? 'Days Used' : '已使用'}</span>
                            <strong>{projectUsageDays} {lang === 'en' ? (projectUsageDays === 1 ? 'day' : 'days') : '天'}</strong>
                        </div>
                        <div className="settings-command-stat">
                            <Activity size={27} />
                            <span>{lang === 'en' ? 'Last Interaction' : '最后互动'}</span>
                            <strong>{formatCompactInteractionTime(latestPlayerInteractionAt, lang === 'en' ? 'No chat yet' : '暂无互动')}</strong>
                        </div>
                    </div>
                    <button className="settings-icon-text-button settings-command-edit-profile" onClick={() => setIsEditing(true)} title={lang === 'en' ? 'Edit your profile (name, avatar, bio)' : '编辑个人资料（名字、头像、签名）'}>
                        <Edit3 size={16} /> {lang === 'en' ? 'Edit Profile' : '编辑档案'}
                    </button>

                    {isEditing && (
                        <div className="settings-profile-edit settings-command-profile-edit">
                            <label>
                                <span>{lang === 'en' ? 'Name' : '名称'}</span>
                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'Avatar URL or Upload' : '头像 URL 或上传'}</span>
                                <div className="settings-upload-row">
                                    <input type="text" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} placeholder="https://..." />
                                    <label className="settings-secondary-button">
                                        {lang === 'en' ? 'Upload' : '上传'}
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setEditAvatar)} />
                                    </label>
                                </div>
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'Avatar Frame' : '头像框'}</span>
                                {renderAvatarFramePicker(editAvatarFrame, setEditAvatarFrame, editAvatar, editName || profile.name || 'User')}
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'Banner URL or Upload' : '横幅 URL 或上传'}</span>
                                <div className="settings-upload-row">
                                    <input type="text" value={editBanner} onChange={e => setEditBanner(e.target.value)} placeholder="https://..." />
                                    <label className="settings-secondary-button">
                                        {lang === 'en' ? 'Upload' : '上传'}
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setEditBanner)} />
                                    </label>
                                </div>
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'Bio' : '个性签名'}</span>
                                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder={lang === 'en' ? "What's up?" : '今天想写点什么？'} />
                            </label>
                            <div className="settings-form-actions">
                                <button className="settings-primary-button" onClick={handleSaveProfile} title={lang === 'en' ? 'Save profile changes' : '保存个人资料修改'}>
                                    <Save size={16} /> {lang === 'en' ? 'Save' : '保存'}
                                </button>
                                <button className="settings-secondary-button" onClick={() => setIsEditing(false)} title={lang === 'en' ? 'Cancel editing' : '取消编辑'}>{lang === 'en' ? 'Cancel' : '取消'}</button>
                            </div>
                        </div>
                    )}
                </section>

                {wallpaperOptionList.length > 0 && (
                    <section id="settings-wallpaper-section" className="settings-card settings-wallpaper-card">
                        <div className="settings-card-title settings-card-title-row">
                            <div>
                                <h2><ImageIcon size={20} />{lang === 'en' ? 'Desktop Wallpaper' : '桌面壁纸'}</h2>
                                <p>{lang === 'en' ? 'Choose the desktop background style.' : '选择桌面的背景样式。'}</p>
                            </div>
                            <span>{getWallpaperOptionLabel(selectedWallpaperOption)}</span>
                        </div>
                        <div className="settings-wallpaper-options">
                            {wallpaperOptionList.map(option => {
                                const selected = option.id === desktopWallpaper;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`settings-wallpaper-option ${selected ? 'active' : ''}`}
                                        onClick={() => onDesktopWallpaperChange?.(option.id)}
                                        aria-pressed={selected}
                                    >
                                        <span className={`settings-wallpaper-preview settings-wallpaper-preview--${option.id}`} aria-hidden="true" />
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

                        {['characters', 'models'].includes(activeSettingsScreen) && (
                            <section className="settings-control-workbench">
                                <div className="settings-control-screen-title">
                                    <div>
                                        <span className="settings-guided-kicker">CHARACTER WORKBENCH</span>
                                        <h1>{lang === 'en' ? 'Character configuration workbench' : '角色配置工作台'}</h1>
                                        <p>{lang === 'en' ? 'Choose a character, then edit persona, models, behavior, voice, and data actions in one place.' : '选择角色后，在这里集中管理人设、模型、行为、声音和角色数据。'}</p>
                                    </div>
                                    <button type="button" className="settings-control-ghost-button" onClick={createCharacterDraft}>
                                        <Plus size={15} />{lang === 'en' ? 'New character' : '创建新角色'}
                                    </button>
                                </div>

                                <div className="settings-control-character-strip">
                                    {contacts.map(character => {
                                        const stats = characterMessageStatsById[character.id] || {};
                                        const readiness = getCharacterReadiness(character);
                                        const selected = String(activePreviewContact?.id || '') === String(character.id);
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
                                                    src={resolveAvatarUrl(character.avatar, apiUrl, character.name || character.id || 'User')}
                                                    fallbackSrc={defaultAvatarUrl(character.name || character.id || 'User')}
                                                    alt=""
                                                />
                                                <span>
                                                    <strong>{character.name || character.id}</strong>
                                                    <small>
                                                        <i className={`settings-status-dot ${readiness.ready ? 'online' : 'warning'}`} />
                                                        {readiness.ready ? (lang === 'en' ? 'Ready' : '可用') : (lang === 'en' ? 'Needs setup' : '待配置')}
                                                        {' · '}
                                                        {Number(stats.private_message_count || character.private_message_count || 0)} {lang === 'en' ? 'messages' : '条消息'}
                                                    </small>
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {contacts.length === 0 && (
                                        <div className="settings-guided-empty">{lang === 'en' ? 'No characters yet. Create one to begin.' : '还没有角色，创建一个角色后开始配置。'}</div>
                                    )}
                                </div>

                                {activeCharacterDraft ? (
                                    <>
                                        <div className="settings-control-section-tabs">
                                            {[
                                                ['persona', lang === 'en' ? 'Persona' : '基础人设', <Heart size={15} />],
                                                ['model', lang === 'en' ? 'Models' : '模型能力', <MessageSquare size={15} />],
                                                ['behavior', lang === 'en' ? 'Behavior' : '行为与上下文', <Activity size={15} />],
                                                ['voice', lang === 'en' ? 'Voice' : '声音', <AudioWaveform size={15} />],
                                                ['data', lang === 'en' ? 'Data' : '角色数据', <Database size={15} />]
                                            ].map(([key, label, icon]) => (
                                                <button
                                                    type="button"
                                                    key={key}
                                                    className={activeCharacterTab === key ? 'is-active' : ''}
                                                    onClick={() => setActiveCharacterTab(key)}
                                                >
                                                    {icon}{label}
                                                </button>
                                            ))}
                                        </div>

                                        {activeCharacterTab === 'persona' && (
                                            <div className="settings-control-form-stack">
                                                <section className="settings-control-card">
                                                    <div className="settings-control-card-title">
                                                        <div>
                                                            <span><UserRound size={18} /></span>
                                                            <div>
                                                                <h2>{lang === 'en' ? 'Identity and appearance' : '身份与外观'}</h2>
                                                                <p>{lang === 'en' ? 'Used by chats, contact lists, groups, and city scenes.' : '聊天、联系人、群聊和商业街都会使用这些信息。'}</p>
                                                            </div>
                                                        </div>
                                                        <em>{activeReadiness?.personaReady ? (lang === 'en' ? 'Complete' : '完整') : (lang === 'en' ? 'Incomplete' : '待补充')}</em>
                                                    </div>
                                                    <div className="settings-control-avatar-row">
                                                        <AvatarWithFrame
                                                            size={88}
                                                            frame={activeCharacterDraft.avatar_frame}
                                                            src={resolveAvatarUrl(activeCharacterDraft.avatar, apiUrl, activeCharacterDraft.name || activeCharacterDraft.id || 'User')}
                                                            fallbackSrc={defaultAvatarUrl(activeCharacterDraft.name || activeCharacterDraft.id || 'User')}
                                                            alt=""
                                                        />
                                                        <div>
                                                            <strong>{activeCharacterDraft.name || activeCharacterDraft.id}</strong>
                                                            <small>{lang === 'en' ? 'PNG, JPG, GIF, WebP or URL' : '支持 PNG、JPG、GIF、WebP 或 URL'}</small>
                                                            <div className="settings-control-inline-actions">
                                                                <label className="settings-control-ghost-button compact">
                                                                    <Upload size={14} />{lang === 'en' ? 'Upload avatar' : '上传头像'}
                                                                    <input type="file" accept="image/*" hidden onChange={(event) => handleFileUpload(event, (url) => updateCharacterDraft({ avatar: url }))} />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="settings-control-form-grid two">
                                                        <label>
                                                            <span>{lang === 'en' ? 'Character ID' : '角色 ID'} <em>{lang === 'en' ? 'Required' : '必填'}</em></span>
                                                            <input value={activeCharacterDraft.id || ''} onChange={event => updateCharacterDraft({ id: event.target.value })} disabled={Boolean(selectedOriginalForDraft)} />
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Name' : '角色名称'}</span>
                                                            <input value={activeCharacterDraft.name || ''} onChange={event => updateCharacterDraft({ name: event.target.value })} />
                                                        </label>
                                                        <label className="full">
                                                            <span>{lang === 'en' ? 'Avatar URL' : '头像 URL'}</span>
                                                            <input value={activeCharacterDraft.avatar || ''} onChange={event => updateCharacterDraft({ avatar: event.target.value })} placeholder="https://..." />
                                                        </label>
                                                        <label className="full">
                                                            <span>{lang === 'en' ? 'Avatar frame' : '头像框'}</span>
                                                            {renderAvatarFramePicker(activeCharacterDraft.avatar_frame, frameId => updateCharacterDraft({ avatar_frame: frameId }), activeCharacterDraft.avatar, activeCharacterDraft.name || activeCharacterDraft.id || 'User')}
                                                        </label>
                                                    </div>
                                                </section>

                                                <section className="settings-control-card">
                                                    <div className="settings-control-card-title">
                                                        <div>
                                                            <span className="pink"><Heart size={18} /></span>
                                                            <div>
                                                                <h2>{lang === 'en' ? 'Persona and world' : '人格与世界观'}</h2>
                                                                <p>{lang === 'en' ? 'Define how the character understands themself, you, and the story world.' : '决定角色如何理解自己、你和所在世界。'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="settings-control-form-grid">
                                                        <label>
                                                            <span>{lang === 'en' ? 'Persona' : '人物设定'} <em>Persona</em></span>
                                                            <textarea rows={6} value={activeCharacterDraft.persona || ''} onChange={event => updateCharacterDraft({ persona: event.target.value })} />
                                                            <small>{lang === 'en' ? 'Personality, expression habits, values, and relationship with the user.' : '描述性格、表达习惯、价值观以及和用户相处的方式。'}</small>
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'World info' : '世界观'} <em>World Info</em></span>
                                                            <textarea rows={6} value={activeCharacterDraft.world_info || ''} onChange={event => updateCharacterDraft({ world_info: event.target.value })} />
                                                            <small>{lang === 'en' ? 'Places, people, rules, and background the character should know.' : '角色知道哪些地点、人物、规则和故事背景。'}</small>
                                                        </label>
                                                    </div>
                                                </section>

                                                <section className="settings-control-card">
                                                    <div className="settings-control-card-title">
                                                        <div>
                                                            <span className="mint"><FileText size={18} /></span>
                                                            <div>
                                                                <h2>{lang === 'en' ? 'System behavior rules' : '系统行为准则'}</h2>
                                                                <p>{lang === 'en' ? 'Advanced prompt rules affect private chat, groups, diaries, and proactive messages.' : '高级提示词会影响私聊、群聊、日记和主动消息。'}</p>
                                                            </div>
                                                        </div>
                                                        <button type="button" className="settings-control-text-button" onClick={() => updateCharacterDraft({ system_prompt: getDefaultGuidelines(lang) })}>
                                                            {lang === 'en' ? 'Restore default' : '恢复默认'}
                                                        </button>
                                                    </div>
                                                    <label className="settings-control-field">
                                                        <span>System Prompt</span>
                                                        <textarea className="settings-control-code-area" rows={9} value={activeCharacterDraft.system_prompt || getDefaultGuidelines(lang)} onChange={event => updateCharacterDraft({ system_prompt: event.target.value })} />
                                                    </label>
                                                </section>
                                            </div>
                                        )}

                                        {activeCharacterTab === 'model' && (
                                            <div className="settings-control-form-stack">
                                                <section className={`settings-control-model-card ${activeReadiness?.mainModelReady ? 'is-ready' : ''}`}>
                                                    <div className="settings-control-model-head">
                                                        <div>
                                                            <span><MessageSquare size={18} /></span>
                                                            <div>
                                                                <span className="settings-guided-kicker">MAIN MODEL</span>
                                                                <h2>{lang === 'en' ? 'Main chat model' : '主对话模型'}</h2>
                                                                <p>{lang === 'en' ? 'Used by private chat, groups, diaries, and city actions.' : '负责私聊、群聊、日记和商业街行动。'}</p>
                                                            </div>
                                                        </div>
                                                        <em><i className={`settings-status-dot ${activeReadiness?.mainModelReady ? 'online' : 'warning'}`} />{activeReadiness?.mainModelReady ? (lang === 'en' ? 'Ready' : '已连接') : (lang === 'en' ? 'Not ready' : '未连接')}</em>
                                                    </div>
                                                    <div className="settings-control-form-grid two">
                                                        <label>
                                                            <span>API Endpoint</span>
                                                            <input value={activeCharacterDraft.api_endpoint || ''} onChange={event => updateCharacterDraft({ api_endpoint: event.target.value })} placeholder="https://api.openai.com/v1" />
                                                            <button type="button" className="settings-control-text-button" onClick={() => applyLocalModelPreset('main')}>
                                                                <Laptop size={12} />{lang === 'en' ? 'Use local Ollama' : '使用本地 Ollama'}
                                                            </button>
                                                        </label>
                                                        <label>
                                                            <span>API Key</span>
                                                            <input type="password" value={editingContact?.api_key || ''} onChange={event => updateCharacterDraft({ api_key: event.target.value, api_key_clear: false })} placeholder={getSecretPlaceholder(activeCharacterDraft, 'api_key', 'sk-...')} />
                                                            <small>{getSecretStatusText(activeCharacterDraft, 'api_key')}</small>
                                                            {activeCharacterDraft.api_key_configured && (
                                                                <button type="button" className="settings-control-text-button danger" onClick={() => updateCharacterDraft({ api_key: '', api_key_clear: true })}>
                                                                    <Trash2 size={12} />{lang === 'en' ? 'Clear saved key' : '清除已保存 Key'}
                                                                </button>
                                                            )}
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Model' : '模型'}</span>
                                                            <div className="settings-control-inline-field">
                                                                <input value={activeCharacterDraft.model_name || ''} onChange={event => updateCharacterDraft({ model_name: event.target.value })} />
                                                                <button type="button" onClick={() => fetchModels(activeCharacterDraft.api_endpoint, editingContact?.api_key || '', setMainModels, setMainModelFetching, setMainModelError, { characterId: activeCharacterDraft.id, scope: 'main', hasSavedKey: activeCharacterDraft.api_key_configured && !activeCharacterDraft.api_key_clear })} disabled={mainModelFetching}>
                                                                    <RefreshCw size={14} />{mainModelFetching ? '...' : (lang === 'en' ? 'Fetch' : '获取')}
                                                                </button>
                                                            </div>
                                                            {mainModelError && <small className="settings-control-error">{mainModelError}</small>}
                                                            {mainModelOptions.length > 0 && (
                                                                <select value="" onChange={event => handleMainModelSelect(event.target.value)}>
                                                                    <option value="" disabled>{lang === 'en' ? 'Select a model' : '选择模型'}</option>
                                                                    {mainModelOptions.map(model => <option key={model} value={model}>{getModelOptionLabel(model)}</option>)}
                                                                </select>
                                                            )}
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Max output' : '最大输出'}</span>
                                                            <div className="settings-control-number-field">
                                                                <input type="number" min="100" max="20000" value={activeCharacterDraft.max_tokens ?? 800} onChange={event => updateCharacterDraft({ max_tokens: Number(event.target.value || 800) })} />
                                                                <span>tokens</span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </section>

                                                <section className={`settings-control-model-card ${activeReadiness?.memoryModelReady ? 'is-ready' : ''}`}>
                                                    <div className="settings-control-model-head">
                                                        <div>
                                                            <span className="pink"><FileText size={18} /></span>
                                                            <div>
                                                                <span className="settings-guided-kicker">MEMORY MODEL</span>
                                                                <h2>{lang === 'en' ? 'Memory and summary model' : '记忆与总结模型'}</h2>
                                                                <p>{lang === 'en' ? 'Used by long-term memory extraction, summaries, and relationship impressions.' : '负责长期记忆清扫、摘要和关系印象。'}</p>
                                                            </div>
                                                        </div>
                                                        <em><i className={`settings-status-dot ${activeReadiness?.memoryModelReady ? 'online' : 'warning'}`} />{activeReadiness?.memoryModelReady ? (lang === 'en' ? 'Ready' : '已连接') : (lang === 'en' ? 'Optional' : '可选')}</em>
                                                    </div>
                                                    <div className="settings-control-form-grid two">
                                                        <label>
                                                            <span>{lang === 'en' ? 'Memory API Endpoint' : '记忆 API Endpoint'}</span>
                                                            <input value={activeCharacterDraft.memory_api_endpoint || ''} onChange={event => updateCharacterDraft({ memory_api_endpoint: event.target.value })} placeholder="https://api.openai.com/v1" />
                                                            <button type="button" className="settings-control-text-button" onClick={() => applyLocalModelPreset('memory')}>
                                                                <Laptop size={12} />{lang === 'en' ? 'Use local Ollama' : '使用本地 Ollama'}
                                                            </button>
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Memory API Key' : '记忆 API Key'}</span>
                                                            <input type="password" value={editingContact?.memory_api_key || ''} onChange={event => updateCharacterDraft({ memory_api_key: event.target.value, memory_api_key_clear: false })} placeholder={getSecretPlaceholder(activeCharacterDraft, 'memory_api_key', 'sk-...')} />
                                                            <small>{getSecretStatusText(activeCharacterDraft, 'memory_api_key')}</small>
                                                            {activeCharacterDraft.memory_api_key_configured && (
                                                                <button type="button" className="settings-control-text-button danger" onClick={() => updateCharacterDraft({ memory_api_key: '', memory_api_key_clear: true })}>
                                                                    <Trash2 size={12} />{lang === 'en' ? 'Clear saved key' : '清除已保存 Key'}
                                                                </button>
                                                            )}
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Memory model' : '记忆模型'}</span>
                                                            <div className="settings-control-inline-field">
                                                                <input value={activeCharacterDraft.memory_model_name || ''} onChange={event => updateCharacterDraft({ memory_model_name: event.target.value })} />
                                                                <button type="button" onClick={() => fetchModels(activeCharacterDraft.memory_api_endpoint, editingContact?.memory_api_key || '', setMemModels, setMemModelFetching, setMemModelError, { characterId: activeCharacterDraft.id, scope: 'memory', hasSavedKey: activeCharacterDraft.memory_api_key_configured && !activeCharacterDraft.memory_api_key_clear })} disabled={memModelFetching}>
                                                                    <RefreshCw size={14} />{memModelFetching ? '...' : (lang === 'en' ? 'Fetch' : '获取')}
                                                                </button>
                                                            </div>
                                                            {memModelError && <small className="settings-control-error">{memModelError}</small>}
                                                            {memModelOptions.length > 0 && (
                                                                <select value="" onChange={event => handleMemoryModelSelect(event.target.value)}>
                                                                    <option value="" disabled>{lang === 'en' ? 'Select a model' : '选择模型'}</option>
                                                                    {memModelOptions.map(model => <option key={model} value={model}>{getModelOptionLabel(model)}</option>)}
                                                                </select>
                                                            )}
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Summary threshold' : '私聊摘要阈值'}</span>
                                                            <div className="settings-control-number-field">
                                                                <input type="number" min="5" max="100" value={activeCharacterDraft.private_summary_threshold ?? 30} onChange={event => updateCharacterDraft({ private_summary_threshold: Number(event.target.value || 30) })} />
                                                                <span>{lang === 'en' ? 'messages' : '条消息'}</span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                    <div className="settings-control-impact-note">
                                                        <Info size={16} />
                                                        <span>{lang === 'en' ? 'Changing context window clears summary, history window cache, and dialogue digest after saving.' : '修改上下文窗口后，保存会清理摘要、历史窗口缓存和对话 digest。'}</span>
                                                    </div>
                                                </section>
                                            </div>
                                        )}

                                        {activeCharacterTab === 'behavior' && (
                                            <div className="settings-control-form-stack">
                                                <section className="settings-control-card">
                                                    <div className="settings-control-card-title">
                                                        <div>
                                                            <span><Activity size={18} /></span>
                                                            <div>
                                                                <h2>{lang === 'en' ? 'Background behavior' : '角色会主动做什么？'}</h2>
                                                                <p>{lang === 'en' ? 'These switches affect background actions, city participation, and API usage.' : '这些开关决定后台行为、城市参与和 API 消耗。'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="settings-control-toggle-grid">
                                                        {[
                                                            ['sys_proactive', lang === 'en' ? 'Proactive messages' : '主动发消息', lang === 'en' ? 'The character may start private chats.' : '角色会在合适时主动开启私聊。', <MessageSquare size={16} />],
                                                            ['sys_timer', lang === 'en' ? 'Timer checks' : '定时检查', lang === 'en' ? 'Background timer judges when to act.' : '按间隔判断是否需要行动。', <CalendarDays size={16} />],
                                                            ['sys_pressure', lang === 'en' ? 'Pressure and body state' : '压力与生理状态', lang === 'en' ? 'Energy, sleep, and pressure can change.' : '启用体力、睡眠和压力变化。', <Activity size={16} />],
                                                            ['sys_jealousy', lang === 'en' ? 'Jealousy reactions' : '嫉妒反应', lang === 'en' ? 'Relationship system may create jealousy.' : '允许关系系统产生嫉妒情绪。', <Heart size={16} />],
                                                            ['sys_survival', lang === 'en' ? 'City activity' : '参与商业街', lang === 'en' ? 'Character joins city actions and social events.' : '角色会在城市中自主行动和社交。', <House size={16} />],
                                                            ['llm_debug_capture', lang === 'en' ? 'LLM debug capture' : '记录 LLM 调试', lang === 'en' ? 'Keep recent prompt and response diagnostics.' : '保留最近的提示词与回复诊断。', <FileText size={16} />]
                                                        ].map(([field, title, detail, icon]) => {
                                                            const on = Number(activeCharacterDraft[field] ?? 1) !== 0;
                                                            return (
                                                                <label className="settings-control-toggle-row" key={field}>
                                                                    <span>{icon}</span>
                                                                    <div><strong>{title}</strong><small>{detail}</small></div>
                                                                    <input type="checkbox" checked={on} onChange={event => updateCharacterDraft({ [field]: event.target.checked ? 1 : 0 })} />
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </section>

                                                <section className="settings-control-card">
                                                    <div className="settings-control-card-title">
                                                        <div>
                                                            <span className="pink"><CalendarDays size={18} /></span>
                                                            <div>
                                                                <h2>{lang === 'en' ? 'Proactive rhythm and context' : '主动消息节奏与上下文'}</h2>
                                                                <p>{lang === 'en' ? 'Control how often the character checks and how much recent content they can see.' : '控制角色后台检查频率，以及每次回复能看到多少最近信息。'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="settings-control-form-grid two">
                                                        <label>
                                                            <span>{lang === 'en' ? 'Min interval' : '最短间隔'}</span>
                                                            <div className="settings-control-number-field">
                                                                <input type="number" min="0.1" max="120" step="0.1" value={activeCharacterDraft.interval_min ?? 10} onChange={event => updateCharacterDraft({ interval_min: Number(event.target.value || 0.1) })} />
                                                                <span>{lang === 'en' ? 'min' : '分钟'}</span>
                                                            </div>
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Max interval' : '最长间隔'}</span>
                                                            <div className="settings-control-number-field">
                                                                <input type="number" min="0.1" max="120" step="0.1" value={activeCharacterDraft.interval_max ?? 120} onChange={event => updateCharacterDraft({ interval_max: Number(event.target.value || 0.1) })} />
                                                                <span>{lang === 'en' ? 'min' : '分钟'}</span>
                                                            </div>
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Private context' : '私聊上下文'}</span>
                                                            <div className="settings-control-number-field">
                                                                <input type="number" min="10" max="200" value={activeCharacterDraft.context_msg_limit ?? 60} onChange={event => updateCharacterDraft({ context_msg_limit: Number(event.target.value || 60) })} />
                                                                <span>{lang === 'en' ? 'messages' : '条消息'}</span>
                                                            </div>
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'City encounters' : '商业街相遇'}</span>
                                                            <select value={Number(activeCharacterDraft.sys_city_social ?? 1) !== 0 ? '1' : '0'} onChange={event => updateCharacterDraft({ sys_city_social: Number(event.target.value) })}>
                                                                <option value="1">{lang === 'en' ? 'Allowed' : '允许参与'}</option>
                                                                <option value="0">{lang === 'en' ? 'Disabled' : '暂停参与'}</option>
                                                            </select>
                                                        </label>
                                                    </div>
                                                </section>

                                                <section className="settings-control-card">
                                                    <div className="settings-control-card-title">
                                                        <div>
                                                            <span className="mint"><Wallet size={18} /></span>
                                                            <div>
                                                                <h2>{lang === 'en' ? 'Wallet and state' : '钱包与状态'}</h2>
                                                                <p>{lang === 'en' ? 'Editable numeric state used by chat, economy, and city systems.' : '聊天、经济和城市系统会读取这些数值状态。'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="settings-control-form-grid three">
                                                        {[
                                                            ['wallet', lang === 'en' ? 'Wallet' : '钱包', 0, 1000000000],
                                                            ['affinity', lang === 'en' ? 'Affinity' : '好感', 0, 100],
                                                            ['energy', lang === 'en' ? 'Energy' : '体力', 0, 100],
                                                            ['calories', lang === 'en' ? 'Calories' : '卡路里', 0, 4000],
                                                            ['stress', lang === 'en' ? 'Stress' : '压力', 0, 100],
                                                            ['pressure_level', lang === 'en' ? 'Pressure level' : '压力等级', 0, 4],
                                                            ['sleep_debt', lang === 'en' ? 'Sleep debt' : '睡眠欠债', 0, 1000],
                                                            ['sleep_pressure', lang === 'en' ? 'Sleep pressure' : '睡眠压力', 0, 100],
                                                            ['mood', lang === 'en' ? 'Mood' : '心情', 0, 100]
                                                        ].map(([field, label, min, max]) => (
                                                            <label key={field}>
                                                                <span>{label}</span>
                                                                <input type="number" min={min} max={max} value={activeCharacterDraft[field] ?? 0} onChange={event => updateCharacterDraft({ [field]: Number(event.target.value || 0) })} />
                                                            </label>
                                                        ))}
                                                    </div>
                                                </section>
                                            </div>
                                        )}

                                        {activeCharacterTab === 'voice' && (
                                            <div className="settings-control-form-stack">
                                                <section className="settings-control-voice-hero">
                                                    <div>
                                                        <span><AudioWaveform size={22} /></span>
                                                        <div>
                                                            <span className="settings-guided-kicker">TEXT TO SPEECH</span>
                                                            <h2>{lang === 'en' ? `Give ${activeCharacterDraft.name || 'this character'} a voice` : `让 ${activeCharacterDraft.name || '这个角色'} 拥有自己的声音`}</h2>
                                                            <p>{lang === 'en' ? 'Preview uses temporary config and does not create a chat message.' : '试听使用临时配置生成音频，不会写入聊天消息。'}</p>
                                                        </div>
                                                    </div>
                                                    <label className="settings-control-switch">
                                                        <input type="checkbox" checked={activeCharacterDraft.tts_enabled === 1} onChange={event => updateCharacterDraft({ tts_enabled: event.target.checked ? 1 : 0 })} />
                                                        <span />
                                                    </label>
                                                </section>
                                                <section className="settings-control-card">
                                                    <div className="settings-control-form-grid two">
                                                        <label>
                                                            <span>{lang === 'en' ? 'TTS provider' : 'TTS 服务'}</span>
                                                            <select
                                                                value={activeCharacterDraft.tts_provider || 'tencent'}
                                                                onChange={event => {
                                                                    const nextProvider = event.target.value;
                                                                    const providerConfig = getTtsProviderConfig(nextProvider);
                                                                    updateCharacterDraft({
                                                                        tts_provider: nextProvider,
                                                                        tts_voice: '',
                                                                        tts_model: providerConfig.modelOptions?.[0]?.value || '',
                                                                        tts_api_key: '',
                                                                        tts_api_key_clear: false
                                                                    });
                                                                }}
                                                            >
                                                                {TTS_PROVIDERS.map(provider => {
                                                                    const translated = translateTtsProviderConfig(provider, lang);
                                                                    return <option value={provider.id} key={provider.id}>{translated.label}</option>;
                                                                })}
                                                            </select>
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Trigger mode' : '触发方式'}</span>
                                                            <select value={activeCharacterDraft.tts_trigger_mode || 'tagged'} onChange={event => updateCharacterDraft({ tts_trigger_mode: event.target.value })}>
                                                                <option value="tagged">{lang === 'en' ? 'Main-model TTS tag only' : '仅主模型 TTS 标签'}</option>
                                                                <option value="all_private">{lang === 'en' ? 'Every private reply' : '每条私聊回复'}</option>
                                                            </select>
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'TTS API key' : 'TTS API 凭据'}</span>
                                                            <input type="password" value={editingContact?.tts_api_key || ''} onChange={event => updateCharacterDraft({ tts_api_key: event.target.value, tts_api_key_clear: false })} placeholder={getSecretPlaceholder(activeCharacterDraft, 'tts_api_key', getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).keyHint)} />
                                                            <small>{getSecretStatusText(activeCharacterDraft, 'tts_api_key')}</small>
                                                            {activeCharacterDraft.tts_api_key_configured && (
                                                                <button type="button" className="settings-control-text-button danger" onClick={() => updateCharacterDraft({ tts_api_key: '', tts_api_key_clear: true })}>
                                                                    <Trash2 size={12} />{lang === 'en' ? 'Clear saved key' : '清除已保存 Key'}
                                                                </button>
                                                            )}
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Voice' : '音色'}</span>
                                                            <div className="settings-control-inline-field">
                                                                <input value={activeCharacterDraft.tts_voice || ''} onChange={event => updateCharacterDraft({ tts_voice: event.target.value })} placeholder={getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).voiceHint} />
                                                                {activeCharacterDraft.tts_provider === 'tencent' && (
                                                                    <button type="button" onClick={() => loadTencentVoices(true)}><RefreshCw size={14} />{lang === 'en' ? 'Voices' : '音色'}</button>
                                                                )}
                                                            </div>
                                                            {getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).voiceOptions?.length > 0 && (
                                                                <select value="" onChange={event => updateCharacterDraft({ tts_voice: event.target.value, ...(activeCharacterDraft.tts_provider === 'tencent' ? { tts_model: inferTencentModelTier(getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).voiceOptions.find(option => option.value === event.target.value)) || activeCharacterDraft.tts_model } : {}) })}>
                                                                    <option value="" disabled>{lang === 'en' ? 'Select built-in voice' : '选择内置音色'}</option>
                                                                    {getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).voiceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                                </select>
                                                            )}
                                                            {tencentVoiceError && <small className="settings-control-error">{tencentVoiceError}</small>}
                                                            {!tencentVoiceError && tencentVoiceSource && <small>{tencentVoiceSourceLabel(tencentVoiceSource)}</small>}
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Model / tier' : '模型 / 档位'}</span>
                                                            <input value={activeCharacterDraft.tts_model || ''} onChange={event => updateCharacterDraft({ tts_model: event.target.value })} placeholder={getEditingTtsProviderConfig(activeCharacterDraft.tts_provider).modelHint} />
                                                        </label>
                                                        <label>
                                                            <span>{lang === 'en' ? 'Endpoint / region' : 'Endpoint / 地域'}</span>
                                                            <input value={activeCharacterDraft.tts_endpoint || ''} onChange={event => updateCharacterDraft({ tts_endpoint: event.target.value })} placeholder="optional" />
                                                        </label>
                                                        <label className="settings-control-check-line">
                                                            <input type="checkbox" checked={activeCharacterDraft.tts_autoplay === 1} onChange={event => updateCharacterDraft({ tts_autoplay: event.target.checked ? 1 : 0 })} />
                                                            <span><strong>{lang === 'en' ? 'Auto-play when generated' : '生成后自动播放'}</strong><small>{lang === 'en' ? 'May be limited by browser autoplay policy.' : '可能受浏览器自动播放策略限制。'}</small></span>
                                                        </label>
                                                    </div>
                                                </section>
                                                <section className="settings-control-tts-preview">
                                                    <div className="settings-control-preview-avatar">
                                                        <AvatarWithFrame
                                                            size={56}
                                                            frame={activeCharacterDraft.avatar_frame}
                                                            src={resolveAvatarUrl(activeCharacterDraft.avatar, apiUrl, activeCharacterDraft.name || activeCharacterDraft.id || 'User')}
                                                            fallbackSrc={defaultAvatarUrl(activeCharacterDraft.name || activeCharacterDraft.id || 'User')}
                                                            alt=""
                                                        />
                                                    </div>
                                                    <div>
                                                        <strong>{ttsPreviewText(activeCharacterDraft.name)}</strong>
                                                        <small>{lang === 'en' ? 'Preview returns an audio Blob and will not save a message.' : '试听返回音频 Blob，不会保存为消息。'}</small>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={activeCharacterDraft.tts_enabled !== 1 || !activeCharacterDraft.id}
                                                        onClick={async () => {
                                                            try {
                                                                const res = await fetch(`${apiUrl}/tts/preview/${activeCharacterDraft.id}`, {
                                                                    method: 'POST',
                                                                    headers: {
                                                                        'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`,
                                                                        'Content-Type': 'application/json'
                                                                    },
                                                                    body: JSON.stringify({
                                                                        text: ttsPreviewText(activeCharacterDraft.name),
                                                                        config: {
                                                                            tts_provider: activeCharacterDraft.tts_provider || 'tencent',
                                                                            tts_api_key: editingContact?.tts_api_key || '',
                                                                            tts_voice: activeCharacterDraft.tts_voice || '',
                                                                            tts_model: activeCharacterDraft.tts_model || '',
                                                                            tts_endpoint: activeCharacterDraft.tts_endpoint || '',
                                                                            tts_enabled: activeCharacterDraft.tts_enabled === 1 ? 1 : 0
                                                                        }
                                                                    })
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
                                                                setTtsPreviewVerifiedIds(prev => new Set(prev).add(activeCharacterDraft.id));
                                                            } catch (e) {
                                                                alert((lang === 'en' ? 'Preview failed: ' : '试听失败：') + (e.message || e));
                                                            }
                                                        }}
                                                    >
                                                        <Volume2 size={16} />{lang === 'en' ? 'Preview voice' : '试听声音'}
                                                    </button>
                                                </section>
                                            </div>
                                        )}

                                        {activeCharacterTab === 'data' && (
                                            <div className="settings-control-form-stack">
                                                <section className="settings-control-card">
                                                    <div className="settings-control-card-title">
                                                        <div>
                                                            <span><Database size={18} /></span>
                                                            <div>
                                                                <h2>{lang === 'en' ? 'Character archive' : '角色存档'}</h2>
                                                                <p>{lang === 'en' ? 'Export or migrate this character settings, messages, memories, and diaries.' : '单独导出或迁移该角色的资料、消息、记忆与日记。'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="settings-control-data-grid">
                                                        <button type="button" onClick={() => handleExportCharacterData(activeCharacterDraft.id)} disabled={!selectedOriginalForDraft}>
                                                            <span><Download size={18} /></span>
                                                            <div><strong>{lang === 'en' ? 'Export character' : `导出 ${activeCharacterDraft.name || '角色'}`}</strong><small>chatpulse.character.v2 JSON</small></div>
                                                            <ChevronRight size={15} />
                                                        </button>
                                                        <label className={!selectedOriginalForDraft ? 'is-disabled' : ''}>
                                                            <span><Upload size={18} /></span>
                                                            <div><strong>{lang === 'en' ? 'Import and replace' : '导入并替换'}</strong><small>{lang === 'en' ? 'Replace current character data.' : '用存档替换当前角色数据。'}</small></div>
                                                            <ChevronRight size={15} />
                                                            <input type="file" accept=".json,.zip,application/json,application/zip" hidden disabled={!selectedOriginalForDraft} onChange={event => handleImportCharacterData(activeCharacterDraft.id, event, 'replace')} />
                                                        </label>
                                                        <label className={!selectedOriginalForDraft ? 'is-disabled' : ''}>
                                                            <span><Upload size={18} /></span>
                                                            <div><strong>{lang === 'en' ? 'Import and merge' : '导入并合并'}</strong><small>{lang === 'en' ? 'Merge messages and memories where supported.' : '在支持的范围内合并消息与记忆。'}</small></div>
                                                            <ChevronRight size={15} />
                                                            <input type="file" accept=".json,.zip,application/json,application/zip" hidden disabled={!selectedOriginalForDraft} onChange={event => handleImportCharacterData(activeCharacterDraft.id, event, 'merge')} />
                                                        </label>
                                                        <button type="button" onClick={() => handleResetPhysicalState(activeCharacterDraft.id)} disabled={!selectedOriginalForDraft}>
                                                            <span><RefreshCw size={18} /></span>
                                                            <div><strong>{lang === 'en' ? 'Reset physical state' : '重置身体状态'}</strong><small>{lang === 'en' ? 'Keep memories, relationships, and wallet.' : '保留记忆、关系和钱包。'}</small></div>
                                                            <ChevronRight size={15} />
                                                        </button>
                                                    </div>
                                                </section>
                                                <section className="settings-control-danger-card">
                                                    <div>
                                                        <span><TriangleAlert size={19} /></span>
                                                        <div>
                                                            <h2>{lang === 'en' ? 'Dangerous character actions' : '角色危险操作'}</h2>
                                                            <p>{lang === 'en' ? 'These operations affect messages, memories, relationships, and vector indexes.' : '这些操作会影响消息、记忆、关系和向量索引。'}</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <button type="button" onClick={() => handleWipeData(activeCharacterDraft.id)} disabled={!selectedOriginalForDraft}>
                                                            <span><strong>{lang === 'en' ? 'Deep-wipe character data' : '深度清空角色数据'}</strong><small>{lang === 'en' ? 'Keep the character shell, clear history.' : '保留角色本体，清空历史并恢复默认状态。'}</small></span>
                                                            <em>{lang === 'en' ? 'Wipe data' : '清空数据'}</em>
                                                        </button>
                                                        <button type="button" onClick={() => handleDeleteContact(activeCharacterDraft.id)} disabled={!selectedOriginalForDraft}>
                                                            <span><strong>{lang === 'en' ? 'Delete character permanently' : '永久删除角色'}</strong><small>{lang === 'en' ? 'Delete settings, messages, groups, and indexes.' : '同时删除设置、消息、群关系和索引。'}</small></span>
                                                            <em>{lang === 'en' ? 'Delete' : '删除'}</em>
                                                        </button>
                                                    </div>
                                                </section>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="settings-guided-empty">{lang === 'en' ? 'Select or create a character to edit.' : '选择或创建角色后开始编辑。'}</div>
                                )}
                            </section>
                        )}

                        {activeSettingsScreen === 'legacy-models' && (
                            <section className="settings-guided-screen settings-models-screen">
                                <div className="settings-page-title">
                                    <div>
                                        <span className="settings-guided-kicker">MODELS & VOICE</span>
                                        <h1>{lang === 'en' ? 'Models and voice' : '模型与声音'}</h1>
                                        <p>{lang === 'en' ? 'Check real connection readiness first, then open the character editor for keys, model lists, and TTS preview.' : '先看真实连通状态，再进入角色编辑器配置密钥、模型列表和 TTS 试听。'}</p>
                                    </div>
                                    {activeCharacterForModel && (
                                        <button type="button" className="settings-character-select-button" onClick={() => setActiveSettingsScreen('characters')}>
                                            <AvatarWithFrame
                                                size={32}
                                                frame={activeCharacterForModel.avatar_frame}
                                                src={resolveAvatarUrl(activeCharacterForModel.avatar, apiUrl, activeCharacterForModel.name || activeCharacterForModel.id || 'User')}
                                                fallbackSrc={defaultAvatarUrl(activeCharacterForModel.name || activeCharacterForModel.id || 'User')}
                                                alt=""
                                            />
                                            <span><strong>{activeCharacterForModel.name}</strong><small>{lang === 'en' ? 'Current character' : '当前角色'}</small></span>
                                            <ChevronRight size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="settings-connection-summary">
                                    <div className={activeCharacterModelReadiness?.mainModelReady ? 'is-ready' : 'needs-check'}>
                                        <span><MessageSquare size={18} /></span>
                                        <div>
                                            <small>{lang === 'en' ? 'Main chat model' : '主对话模型'}</small>
                                            <strong>{activeCharacterForModel?.model_name || (lang === 'en' ? 'Not configured' : '未配置')}</strong>
                                            <em>{activeCharacterModelReadiness?.mainModelReady ? (lang === 'en' ? 'Ready' : '已连接') : (lang === 'en' ? 'Needs endpoint, key, and model' : '需要 endpoint、key 和模型')}</em>
                                        </div>
                                        {activeCharacterForModel && <button type="button" onClick={() => openCharacterEditor(activeCharacterForModel)}>{lang === 'en' ? 'Edit' : '编辑'}</button>}
                                    </div>
                                    <div className={activeCharacterModelReadiness?.memoryModelReady ? 'is-ready' : 'needs-check'}>
                                        <span><Database size={18} /></span>
                                        <div>
                                            <small>{lang === 'en' ? 'Memory model' : '记忆模型'}</small>
                                            <strong>{activeCharacterForModel?.memory_model_name || (lang === 'en' ? 'Optional' : '可选')}</strong>
                                            <em>{activeCharacterModelReadiness?.memoryModelReady ? (lang === 'en' ? 'Ready' : '已连接') : (lang === 'en' ? 'Affects long-term memory tasks' : '影响长期记忆任务')}</em>
                                        </div>
                                        {activeCharacterForModel && <button type="button" onClick={() => openCharacterEditor(activeCharacterForModel)}>{lang === 'en' ? 'Edit' : '编辑'}</button>}
                                    </div>
                                    <div className={activeCharacterModelReadiness?.ttsEnabled && (!activeCharacterModelReadiness?.ttsConfigured || !activeCharacterModelReadiness?.ttsPreviewVerified) ? 'needs-check' : 'is-ready'}>
                                        <span><AudioWaveform size={18} /></span>
                                        <div>
                                            <small>{lang === 'en' ? 'Voice' : '声音'}</small>
                                            <strong>{activeCharacterModelReadiness?.ttsEnabled ? `${selectedTtsProviderLabel}${activeCharacterForModel?.tts_voice ? ` · ${activeCharacterForModel.tts_voice}` : ''}` : (lang === 'en' ? 'Off' : '关闭')}</strong>
                                            <em>{activeCharacterModelReadiness?.ttsEnabled
                                                ? (activeCharacterModelReadiness.ttsPreviewVerified ? (lang === 'en' ? 'Preview verified this session' : '本会话已试听') : (lang === 'en' ? 'Preview in character editor' : '在角色编辑器里试听'))
                                                : (lang === 'en' ? 'Optional' : '可选')}</em>
                                        </div>
                                        {activeCharacterForModel && <button type="button" onClick={() => openCharacterEditor(activeCharacterForModel)}>{lang === 'en' ? 'Open' : '打开'}</button>}
                                    </div>
                                </div>
                                <section className="settings-model-task-panel">
                                    <div className="settings-task-panel-title">
                                        <div>
                                            <span className="settings-guided-kicker">CONFIG TASKS</span>
                                            <h2>{lang === 'en' ? 'Configuration path' : '配置路径'}</h2>
                                        </div>
                                    </div>
                                    <div className="settings-task-list">
                                        {[
                                            [activeCharacterModelReadiness?.mainModelReady, lang === 'en' ? 'Main model' : '主模型', lang === 'en' ? 'Endpoint, key, model name, max output.' : 'Endpoint、Key、模型名称、最大输出。'],
                                            [activeCharacterModelReadiness?.memoryModelReady, lang === 'en' ? 'Memory model' : '记忆模型', lang === 'en' ? 'Small model for memory extraction and maintenance.' : '用于记忆提取和维护的小模型。'],
                                            [!activeCharacterModelReadiness?.ttsEnabled || activeCharacterModelReadiness?.ttsConfigured, lang === 'en' ? 'TTS config' : 'TTS 配置', lang === 'en' ? 'Provider, credentials, voice, model tier, trigger mode.' : '厂商、凭证、音色、模型档位和触发方式。'],
                                            [!activeCharacterModelReadiness?.ttsEnabled || activeCharacterModelReadiness?.ttsPreviewVerified, lang === 'en' ? 'Voice preview' : '声音试听', lang === 'en' ? 'Preview success is tracked only for this frontend session.' : '试听成功只在当前前端会话标记。']
                                        ].map(([done, title, detail]) => (
                                            <button type="button" key={title} className={done ? 'is-done' : 'needs-attention'} onClick={() => activeCharacterForModel && openCharacterEditor(activeCharacterForModel)}>
                                                {done ? <CircleCheck size={16} /> : <CircleDotDashed size={16} />}
                                                <span><strong>{title}</strong><small>{detail}</small></span>
                                                <em>{lang === 'en' ? 'Edit' : '编辑'}</em>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            </section>
                        )}

                        <div className={`settings-guided-screen settings-guided-existing-workspace is-${activeSettingsScreen}`} hidden={activeSettingsScreen !== 'security'}>
                <div className="settings-command-workspace">
                    <main className="settings-command-main">
                        <section id="settings-characters-section" className="settings-card settings-characters-card settings-command-characters-card">
                            <div className="settings-card-title settings-card-title-row">
                                <h2><FileText size={20} />{lang === 'en' ? 'Character Management' : '角色管理'}</h2>
                                <button
                                    type="button"
                                    className="settings-secondary-button settings-add-character-button"
                                    onClick={() => alert(lang === 'en' ? 'Create a character from the Contacts page.' : '请在联系人页面创建角色。')}
                                    title={lang === 'en' ? 'Create characters from the contacts page' : '请在联系人页面创建角色'}
                                >
                                    <Plus size={15} /> {lang === 'en' ? 'Add Character' : '添加角色'}
                                </button>
                            </div>
                            <div className="settings-character-workbench">
                                <div className="settings-character-list">
                                    {contacts.map(c => {
                                        const modelOnline = getCharacterOnline(c);
                                        const characterApiBadges = [
                                            getCharacterApiBadge(c, 'main'),
                                            getCharacterApiBadge(c, 'memory')
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
                                                        <span className={`settings-character-status ${modelOnline ? 'online' : 'offline'}`}>
                                                            <i />{modelOnline ? (lang === 'en' ? 'Online' : '在线') : (lang === 'en' ? 'Offline' : '离线')}
                                                        </span>
                                                    </div>
                                                    <div className="settings-character-api-badges" aria-label={lang === 'en' ? 'Character API configuration' : '角色 API 配置'}>
                                                        {characterApiBadges.map(badge => (
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
                                                        <span className="settings-character-pill-label">{lang === 'en' ? 'Wallet' : '余额'}</span>
                                                        <strong>¥{Number(c.wallet ?? 0).toFixed(2)}</strong>
                                                    </span>
                                                    <span className="settings-character-pill settings-character-last">
                                                        <span className="settings-character-pill-label">{lang === 'en' ? 'Last' : '互动'}</span>
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
                                                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ id: c.id, affinity: 60, is_blocked: 0 })
                                                                    });
                                                                    onCharactersUpdate?.();
                                                                } catch (e) { console.error(e); }
                                                            }}
                                                            title={lang === 'en' ? 'Admin Unblock & Reset Affinity' : '管理员解除拉黑并重置好感度'}>
                                                            {lang === 'en' ? 'Unblock' : '解除'}
                                                        </button>
                                                    )}
                                                    <button type="button" onClick={(event) => { event.stopPropagation(); handleWipeData(c.id); }} title={lang === 'en' ? 'Wipe all data (Memories, Messages, etc)' : '清空全部数据（记忆、消息等）'}>
                                                        <RefreshCw size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openCharacterEditor(c);
                                                        }}
                                                        title={lang === 'en' ? 'Edit API endpoint, model, persona, prompt' : '编辑 API 接口、模型、人设和提示词'}>
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); handleDeleteContact(c.id); }} title={lang === 'en' ? 'Delete this character permanently' : '永久删除这个角色'}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>

                        <section id="settings-account-section" className="settings-card settings-security-card settings-command-security-card">
                            <div className="settings-card-title settings-card-title-row">
                                <h2><ShieldCheck size={20} /> {lang === 'en' ? 'Account Security' : '账号安全'}</h2>
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
                                    <input type="text" value={accountUsername} onChange={e => setAccountUsername(e.target.value)} />
                                </label>
                                <label>
                                    <span>{lang === 'en' ? 'Current Password' : '当前密码'}</span>
                                    <input type="password" value={accountCurrentPassword} onChange={e => setAccountCurrentPassword(e.target.value)} />
                                </label>
                                <label>
                                    <span>{lang === 'en' ? 'New Password' : '新密码'}</span>
                                    <input type="password" value={accountNewPassword} onChange={e => setAccountNewPassword(e.target.value)} placeholder={lang === 'en' ? 'Leave blank' : '留空则不修改'} />
                                </label>
                                <label>
                                    <span>{lang === 'en' ? 'Confirm New Password' : '确认新密码'}</span>
                                    <input type="password" value={accountConfirmPassword} onChange={e => setAccountConfirmPassword(e.target.value)} placeholder={lang === 'en' ? 'Repeat new password' : '再次输入新密码'} />
                                </label>
                            </div>
                            <div className="settings-security-footer">
                                <div className="settings-security-note">
                                    {lang === 'en'
                                        ? 'Minimum password length: 5. Change the initial root password before sharing accounts.'
                                        : '密码最少 5 位。全新部署后，请先修改初始 root 密码再分发账号。'}
                                </div>
                                <button className="settings-primary-button settings-security-save" onClick={handleSaveAccount} disabled={accountSaving}>
                                    {accountSaving
                                        ? (lang === 'en' ? 'Saving...' : '保存中...')
                                        : (lang === 'en' ? 'Save Account' : '修改安全设置')}
                                </button>
                            </div>
                            {accountError ? <div className="settings-form-error">{accountError}</div> : null}
                            {accountMessage ? <div className="settings-form-success">{accountMessage}</div> : null}
                        </section>
                    </main>

                    {selectedSettingsContact && (
                        <section className="settings-card settings-character-detail-card settings-command-detail-card">
                            <div className="settings-card-title settings-character-detail-title">
                                <h2><FileText size={20} />{lang === 'en' ? 'Character Brief' : '角色简略介绍'}</h2>
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
                                        src={resolveAvatarUrl(selectedSettingsContact.avatar, apiUrl, selectedSettingsContact.name || selectedSettingsContact.id || 'User')}
                                        fallbackSrc={defaultAvatarUrl(selectedSettingsContact.name || selectedSettingsContact.id || 'User')}
                                        alt={selectedSettingsContact.name}
                                    />
                                    <div>
                                        <h3>{selectedSettingsContact.name}</h3>
                                        <span className={`settings-character-status ${selectedSettingsContactOnline ? 'online' : 'offline'}`}>
                                            <i />{selectedSettingsContactOnline ? (lang === 'en' ? 'Online' : '在线') : (lang === 'en' ? 'Offline' : '离线')}
                                        </span>
                                    </div>
                                </div>
                                <div className="settings-character-description">
                                    <span>{lang === 'en' ? 'Character Description' : '角色描述'}</span>
                                    <p>{selectedContactDescription || (lang === 'en' ? 'No description yet.' : '暂未填写角色描述。')}</p>
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
                                    <Edit3 size={16} />{lang === 'en' ? 'Edit Character Info' : '编辑角色信息'}
                                </button>
                            </aside>
                        </section>
                    )}
                </div>
                        </div>

                        {activeSettingsScreen === 'security' && (
                            <section className="settings-card settings-sessions-card">
                                <div className="settings-card-title settings-card-title-row">
                                    <div>
                                        <h2><Monitor size={20} /> {lang === 'en' ? 'Login Sessions' : '登录会话'}</h2>
                                        <p>{lang === 'en' ? 'Revoke unfamiliar devices without touching character data.' : '发现陌生设备时，可以只撤销对应会话，不影响角色数据。'}</p>
                                    </div>
                                    <button type="button" className="settings-secondary-button" onClick={loadSessions} disabled={sessionsLoading}>
                                        <RefreshCw size={15} /> {sessionsLoading ? (lang === 'en' ? 'Refreshing' : '刷新中') : (lang === 'en' ? 'Refresh' : '刷新')}
                                    </button>
                                </div>
                                {sessionsError && <div className="settings-form-error">{sessionsError}</div>}
                                <div className="settings-session-list">
                                    {sessions.slice(0, 12).map((session, index) => {
                                        const sessionId = session.id || session.session_id || session.token_id || String(index);
                                        const isCurrent = session.current === true || session.is_current === true;
                                        const Icon = /android|iphone|mobile|phone/i.test(formatSessionDevice(session)) ? Smartphone : (/mac|windows|linux|desktop|edge|chrome/i.test(formatSessionDevice(session)) ? Monitor : Laptop);
                                        return (
                                            <div className="settings-session-row" key={sessionId}>
                                                <span><Icon size={18} /></span>
                                                <div>
                                                    <strong>{formatSessionDevice(session)}</strong>
                                                    <small>{formatSessionMeta(session)}</small>
                                                </div>
                                                {isCurrent ? <em>{lang === 'en' ? 'Current' : '当前会话'}</em> : (
                                                    <button type="button" onClick={() => revokeSession(sessionId, isCurrent)}>{lang === 'en' ? 'Revoke' : '撤销'}</button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {!sessionsLoading && sessions.length === 0 && (
                                        <div className="settings-guided-empty">{lang === 'en' ? 'No session records returned by the backend.' : '后端没有返回会话记录。'}</div>
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
                        )}

                        <div className="settings-guided-screen" hidden={activeSettingsScreen !== 'backup'}>
                <section id="settings-backup-section" className="settings-card settings-backup-card settings-command-backup-card">
                    <div className="settings-card-title settings-card-title-row">
                        <div>
                            <h2><Cloud size={21} /> {lang === 'en' ? 'Backup & Restore' : '备份与恢复'}</h2>
                            <p>{lang === 'en' ? 'Protect character data and settings with regular backups.' : '定期备份可保护你的角色数据与设置，建议每周至少备份一次。'}</p>
                        </div>
                    </div>
                    <div className="settings-backup-actions">
                        <button type="button" className="settings-backup-action settings-backup-action--primary" onClick={handleExportDatabase}>
                            <span className="settings-backup-icon"><Download size={20} /></span>
                            <span>
                                <strong>{lang === 'en' ? 'Backup Data' : '备份数据'}</strong>
                                <small>{lang === 'en' ? 'Export current data locally' : '导出当前数据到本地文件'}</small>
                            </span>
                        </button>
                        <label className="settings-backup-action settings-backup-upload">
                            <span className="settings-backup-icon"><Upload size={20} /></span>
                            <span>
                                <strong>{lang === 'en' ? 'Restore Data' : '恢复数据'}</strong>
                                <small>{lang === 'en' ? 'Restore data from local file' : '从本地文件恢复数据'}</small>
                            </span>
                            <input type="file" accept=".zip,.db,application/zip,application/x-sqlite3,application/octet-stream" style={{ display: 'none' }} onChange={handleImportDatabase} />
                        </label>
                        <button type="button" className="settings-backup-action settings-backup-action--danger" onClick={() => setWipeModalOpen(true)}>
                            <span className="settings-backup-icon"><Trash2 size={20} /></span>
                            <span>
                                <strong>{lang === 'en' ? 'Factory Reset' : '恢复出厂设置'}</strong>
                                <small>{lang === 'en' ? 'Clear all data permanently' : '清除所有数据，无法恢复'}</small>
                            </span>
                        </button>
                    </div>
                    <section className="settings-danger-zone">
                        <div>
                            <span><TriangleAlert size={20} /></span>
                            <div>
                                <h2>{lang === 'en' ? 'Wipe all data for this account' : '清空当前账号全部数据'}</h2>
                                <p>{lang === 'en' ? 'This permanently deletes characters, chats, memories, uploads, and generated files. Type DELETE ALL before continuing.' : '这会永久删除角色、聊天、记忆、上传和生成文件。继续前必须输入 DELETE ALL。'}</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => setWipeModalOpen(true)}>{lang === 'en' ? 'Wipe all data' : '清空全部数据'}</button>
                    </section>
                </section>
                        </div>
                    </main>

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
                                            src={resolveAvatarUrl(activePreviewContact.avatar, apiUrl, activePreviewContact.name || activePreviewContact.id || 'User')}
                                            fallbackSrc={defaultAvatarUrl(activePreviewContact.name || activePreviewContact.id || 'User')}
                                            alt={activePreviewContact.name}
                                        />
                                    </div>
                                    <div>
                                        <h3>{activePreviewContact.name}</h3>
                                        <span className={`settings-character-status ${activeReadiness?.ready ? 'online' : 'offline'}`}><i />{activeReadiness?.ready ? (lang === 'en' ? 'Ready' : '可用') : (lang === 'en' ? 'Needs setup' : '待处理')}</span>
                                        <p>{activePreviewDescription || (lang === 'en' ? 'No persona description yet.' : '暂未填写角色描述。')}</p>
                                    </div>
                                </section>
                                <section className="settings-context-panel">
                                    <h3>{lang === 'en' ? 'Readiness check' : '就绪检查'}</h3>
                                    <div className="settings-context-checks">
                                        {[
                                            [activeReadiness?.personaReady, lang === 'en' ? 'Persona complete' : '人设完整'],
                                            [activeReadiness?.mainModelReady, `${lang === 'en' ? 'Main model' : '主模型'} ${activePreviewContact.model_name || ''}`],
                                            [activeReadiness?.memoryModelReady, `${lang === 'en' ? 'Memory model' : '记忆模型'} ${activePreviewContact.memory_model_name || ''}`],
                                            [!activeReadiness?.ttsEnabled || activeReadiness?.ttsConfigured, activeReadiness?.ttsEnabled ? `${lang === 'en' ? 'Voice configured' : '声音已配置'} ${activePreviewTtsProviderLabel}` : (lang === 'en' ? 'Voice optional' : '声音未启用')],
                                            [!activeReadiness?.ttsEnabled || activeReadiness?.ttsPreviewVerified, lang === 'en' ? 'Voice preview in this session' : '本会话声音试听']
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
                                            <span><FileText size={16} /></span>
                                            <div><strong>{lang === 'en' ? 'Context window changed' : '上下文窗口已改动'}</strong><p>{lang === 'en' ? 'Saving clears summary cache and dialogue digest for this character.' : '保存后会清理该角色的摘要缓存和对话 digest。'}</p></div>
                                        </article>
                                    )}
                                    {controlHasModelChange && (
                                        <article>
                                            <span><MessageSquare size={16} /></span>
                                            <div><strong>{lang === 'en' ? 'Model credentials changed' : '模型连接已改动'}</strong><p>{lang === 'en' ? 'Blank keys keep saved credentials; clear actions remove them explicitly.' : '空白 Key 会保留旧凭证；只有清除操作会显式删除。'}</p></div>
                                        </article>
                                    )}
                                    {controlHasVoiceChange && (
                                        <article>
                                            <span><AudioWaveform size={16} /></span>
                                            <div><strong>{lang === 'en' ? 'Voice config changed' : '声音配置已改动'}</strong><p>{lang === 'en' ? 'Use preview to verify the Blob response before relying on TTS in chat.' : '建议先试听确认 Blob 音频可用，再在聊天里使用 TTS。'}</p></div>
                                        </article>
                                    )}
                                    <article>
                                        <span><RefreshCw size={16} /></span>
                                        <div><strong>{lang === 'en' ? 'Saving character settings' : '保存角色设置'}</strong><p>{lang === 'en' ? 'The proactive timer is stopped and rescheduled, but no AI reply is triggered immediately.' : '会停止并重排主动消息计时器，但不会立即触发 AI 回复。'}</p></div>
                                    </article>
                                </section>
                                <section className="settings-context-panel settings-diagnostics-panel">
                                    <div className="settings-diagnostics-head">
                                        <h3>{lang === 'en' ? 'Service diagnostics' : '服务诊断'}</h3>
                                        <button type="button" onClick={loadServiceDiagnostics} disabled={serviceDiagnosticsLoading}>
                                            <RefreshCw size={14} />{serviceDiagnosticsLoading ? (lang === 'en' ? 'Checking' : '检查中') : (lang === 'en' ? 'Refresh' : '刷新')}
                                        </button>
                                    </div>
                                    {serviceDiagnosticsError && <p className="settings-diagnostics-error">{serviceDiagnosticsError}</p>}
                                    <div className="settings-diagnostics-grid">
                                        <article>
                                            <span><Database size={16} /></span>
                                            <div>
                                                <strong>{lang === 'en' ? 'Embedding' : 'Embedding'}</strong>
                                                <p>{serviceDiagnostics.embedding?.embedding?.extractorState || (lang === 'en' ? 'Unknown' : '未知')}</p>
                                                <small>{lang === 'en' ? 'Active' : '活跃'} {serviceDiagnostics.embedding?.embedding?.activeCount ?? '-'} · cache {serviceDiagnostics.embedding?.embedding?.cacheSize ?? '-'}</small>
                                            </div>
                                        </article>
                                        <article>
                                            <span><Activity size={16} /></span>
                                            <div>
                                                <strong>{lang === 'en' ? 'Background queue' : '后台队列'}</strong>
                                                <p>{lang === 'en' ? 'Pending' : '待执行'} {serviceDiagnostics.queue?.stats?.pendingTasks ?? '-'}</p>
                                                <small>{lang === 'en' ? 'Workers' : 'Worker'} {serviceDiagnostics.queue?.stats?.activeWorkers ?? '-'} / {serviceDiagnostics.queue?.stats?.globalConcurrency ?? '-'}</small>
                                            </div>
                                        </article>
                                        <article>
                                            <span><Cloud size={16} /></span>
                                            <div>
                                                <strong>{lang === 'en' ? 'Character cache' : '角色缓存'}</strong>
                                                <p>{lang === 'en' ? 'LLM entries' : 'LLM 条目'} {serviceDiagnostics.cache?.stats?.entries_count ?? '-'}</p>
                                                <small>{lang === 'en' ? 'Hits' : '命中'} {serviceDiagnostics.cache?.stats?.hit_count ?? '-'} · digest {serviceDiagnostics.cache?.stats?.digest_entries_count ?? '-'}</small>
                                            </div>
                                        </article>
                                    </div>
                                </section>
                                <div className="settings-context-actions">
                                    <button type="button" onClick={() => setActiveSettingsScreen('characters')}><UsersRound size={15} />{lang === 'en' ? 'Characters' : '查看角色'}</button>
                                    <button type="button" className="primary" onClick={() => {
                                        setActiveSettingsScreen('characters');
                                        openCharacterEditor(activePreviewContact);
                                    }}><Edit3 size={15} />{lang === 'en' ? 'Edit' : '编辑'}</button>
                                </div>
                            </>
                        ) : (
                            <div className="settings-guided-empty">{lang === 'en' ? 'Create or select a character to see setup context.' : '创建或选择角色后，这里会显示配置上下文。'}</div>
                        )}
                    </aside>
                </div>
            </div>

            {wipeModalOpen && (
                <div className="settings-wipe-modal">
                    <div>
                        <span><TriangleAlert size={24} /></span>
                        <h2>{lang === 'en' ? 'Confirm full wipe?' : '确认清空全部数据？'}</h2>
                        <p>{lang === 'en' ? 'This deletes characters, private chats, group chats, memories, uploads, and generated files. Type DELETE ALL to continue.' : '这会删除角色、私聊、群聊、记忆、上传和生成文件。请输入 DELETE ALL 继续。'}</p>
                        <input
                            value={wipeConfirmText}
                            onChange={event => setWipeConfirmText(event.target.value)}
                            placeholder="DELETE ALL"
                        />
                        <section>
                            <button type="button" onClick={() => { setWipeModalOpen(false); setWipeConfirmText(''); }}>{lang === 'en' ? 'Cancel' : '取消'}</button>
                            <button
                                type="button"
                                className="danger"
                                disabled={wipeConfirmText !== 'DELETE ALL'}
                                onClick={() => {
                                    setWipeModalOpen(false);
                                    setWipeConfirmText('');
                                    handleSystemWipe(true);
                                }}
                            >
                                {lang === 'en' ? 'Wipe permanently' : '永久清空'}
                            </button>
                        </section>
                    </div>
                </div>
            )}

            {/* Legacy character modal is kept unreachable while the control-center workbench owns editing. */}
            {activeSettingsScreen === 'legacy-character-modal' && editingContact && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ margin: 0 }}>Edit Character Setting: {editingContact.name}</h3>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Name')}:
                                <input type="text" value={editingContact.name || ''} onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </label>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Avatar URL')}:
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    <input type="text" value={editingContact.avatar || ''} onChange={(e) => setEditingContact({ ...editingContact, avatar: e.target.value })} style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    <label style={{ cursor: 'pointer', padding: '8px 12px', backgroundColor: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                        Upload
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, (url) => setEditingContact({ ...editingContact, avatar: url }))} />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: '#666' }}>
                            {lang === 'en' ? 'Avatar Frame' : '头像框'}:
                            {renderAvatarFramePicker(
                                editingContact.avatar_frame,
                                (frameId) => setEditingContact({ ...editingContact, avatar_frame: frameId }),
                                editingContact.avatar,
                                editingContact.name || editingContact.id || 'User'
                            )}
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                            {t('API Endpoint')}:
                            <input type="text" value={editingContact.api_endpoint || ''} onChange={(e) => setEditingContact({ ...editingContact, api_endpoint: e.target.value })} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                            {t('API Key')}:
                            <input type="password" value={editingContact.api_key || ''} onChange={(e) => updateEditingSecret('api_key', e.target.value)} placeholder={getSecretPlaceholder(editingContact, 'api_key', 'sk-...')} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            {renderSecretStatus('api_key')}
                        </label>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Model Name')}:
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    <input type="text" value={editingContact.model_name || ''} onChange={(e) => setEditingContact({ ...editingContact, model_name: e.target.value })} style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    <button type="button" onClick={() => fetchModels(editingContact.api_endpoint, editingContact.api_key, setMainModels, setMainModelFetching, setMainModelError, { characterId: editingContact.id, scope: 'main', hasSavedKey: editingContact.api_key_configured && !editingContact.api_key_clear })} disabled={mainModelFetching}
                                        style={{ padding: '6px 10px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={13} /> {mainModelFetching ? '...' : t('Fetch Models')}
                                    </button>
                                </div>
                                {mainModelError && <span style={{ color: 'var(--danger)', fontSize: '12px' }}>{mainModelError}</span>}
                                {mainModels.length > 0 && (
                                    <select defaultValue="" onChange={e => setEditingContact({ ...editingContact, model_name: e.target.value })}
                                        style={{ marginTop: '4px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                                        <option value="" disabled>{lang === 'en' ? '-- Select model --' : '-- 选择模型 --'}</option>
                                        {mainModels.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                )}
                            </label>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Max Output Tokens')}:
                                <input type="number" value={editingContact.max_tokens ?? 800} onChange={(e) => setEditingContact({ ...editingContact, max_tokens: parseInt(e.target.value) || 800 })} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {lang === 'en' ? 'Min Interval (mins)' : '最小间隔（分钟）'}:
                                <div className="autopulse-interval-control" style={{ marginTop: '5px' }}>
                                    <input type="range" min="0.1" max="120" step="0.1" value={editingContact.interval_min || 0.1} onChange={(e) => setEditingContact({ ...editingContact, interval_min: parseFloat(e.target.value) })} style={{ width: '100%', backgroundSize: `${((editingContact.interval_min || 0.1) - 0.1) * 100 / (120 - 0.1)}% 100%` }} />
                                    <input type="number" step="0.1" value={editingContact.interval_min || 0} onChange={(e) => setEditingContact({ ...editingContact, interval_min: parseFloat(e.target.value) })} className="autopulse-number-input" />
                                </div>
                            </label>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {lang === 'en' ? 'Max Interval (mins)' : '最大间隔（分钟）'}:
                                <div className="autopulse-interval-control" style={{ marginTop: '5px' }}>
                                    <input type="range" min="0.1" max="120" step="0.1" value={editingContact.interval_max || 0.1} onChange={(e) => setEditingContact({ ...editingContact, interval_max: parseFloat(e.target.value) })} style={{ width: '100%', backgroundSize: `${((editingContact.interval_max || 0.1) - 0.1) * 100 / (120 - 0.1)}% 100%` }} />
                                    <input type="number" step="0.1" value={editingContact.interval_max || 0} onChange={(e) => setEditingContact({ ...editingContact, interval_max: parseFloat(e.target.value) })} className="autopulse-number-input" />
                                </div>
                            </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', marginBottom: '5px', background: '#f9f9f9', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editingContact.sys_proactive !== 0} onChange={(e) => setEditingContact({ ...editingContact, sys_proactive: e.target.checked ? 1 : 0 })} />
                                {t('Toggle Proactive Messages')}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editingContact.sys_timer !== 0} onChange={(e) => setEditingContact({ ...editingContact, sys_timer: e.target.checked ? 1 : 0 })} />
                                {t('Toggle Timer Actions')}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editingContact.sys_pressure !== 0} onChange={(e) => setEditingContact({ ...editingContact, sys_pressure: e.target.checked ? 1 : 0 })} />
                                {t('Toggle Pressure System')}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer' }}>
                                <input type="checkbox" checked={editingContact.sys_jealousy !== 0} onChange={(e) => setEditingContact({ ...editingContact, sys_jealousy: e.target.checked ? 1 : 0 })} />
                                {t('Toggle Jealousy System')}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer' }} title={lang === 'en' ? 'Enable/disable this character in City DLC simulation' : '开启或关闭该角色参与商业街模拟活动'}>
                                <input type="checkbox" checked={editingContact.sys_survival !== 0} onChange={(e) => setEditingContact({ ...editingContact, sys_survival: e.target.checked ? 1 : 0 })} />
                                {lang === 'en' ? 'City Activity' : '参与商业街活动'}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer' }} title={lang === 'en' ? 'Allow this character to join City social encounters when sharing a location' : '控制这个角色在同地时是否参与商业街相遇'}>
                                <input type="checkbox" checked={editingContact.sys_city_social !== 0} onChange={(e) => setEditingContact({ ...editingContact, sys_city_social: e.target.checked ? 1 : 0 })} />
                                {lang === 'en' ? 'City Encounters' : '商业街相遇'}
                            </label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '10px', background: '#f5f7fa', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            <strong style={{ fontSize: '13px', color: '#4a5568' }}>{lang === 'en' ? 'Memory Extraction AI (Small Model)' : '记忆提取 AI（小模型）'}</strong>
                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Memory API Endpoint')}:
                                <input type="text" value={editingContact.memory_api_endpoint || ''} onChange={(e) => setEditingContact({ ...editingContact, memory_api_endpoint: e.target.value })} placeholder="e.g. https://api.openai.com/v1" style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Memory API Key')}:
                                <input type="password" value={editingContact.memory_api_key || ''} onChange={(e) => updateEditingSecret('memory_api_key', e.target.value)} placeholder={getSecretPlaceholder(editingContact, 'memory_api_key', 'sk-...')} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                {renderSecretStatus('memory_api_key')}
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {lang === 'en' ? 'Memory Model Name' : '记忆模型名称'}:
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    <input type="text" value={editingContact.memory_model_name || ''} onChange={(e) => setEditingContact({ ...editingContact, memory_model_name: e.target.value })} placeholder="e.g. gpt-4o-mini" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    <button type="button" onClick={() => fetchModels(editingContact.memory_api_endpoint, editingContact.memory_api_key, setMemModels, setMemModelFetching, setMemModelError, { characterId: editingContact.id, scope: 'memory', hasSavedKey: editingContact.memory_api_key_configured && !editingContact.memory_api_key_clear })} disabled={memModelFetching}
                                        style={{ padding: '6px 10px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={13} /> {memModelFetching ? '...' : t('Fetch Models')}
                                    </button>
                                </div>
                                {memModelError && <span style={{ color: 'var(--danger)', fontSize: '12px' }}>{memModelError}</span>}
                                {memModels.length > 0 && (
                                    <select defaultValue="" onChange={e => setEditingContact({ ...editingContact, memory_model_name: e.target.value })}
                                        style={{ marginTop: '4px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                                        <option value="" disabled>{lang === 'en' ? '-- Select model --' : '-- 选择模型 --'}</option>
                                        {memModels.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                )}
                            </label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                <strong style={{ fontSize: '13px', color: '#4a5568', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Volume2 size={15} /> {lang === 'en' ? 'Private Chat TTS' : '私聊语音输出'}
                                </strong>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={editingContact.tts_enabled === 1}
                                        onChange={(e) => setEditingContact({ ...editingContact, tts_enabled: e.target.checked ? 1 : 0 })}
                                    />
                                    {lang === 'en' ? 'Enable' : '启用'}
                                </label>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                                {lang === 'en'
                                    ? 'Only private-chat character replies can use TTS. The main model may request speech with a hidden TTS tag; group chat, city logs, web-search drafts, and system messages are ignored.'
                                    : '只对私聊角色回复开放。主模型可以用隐藏 TTS 标签请求语音；群聊、商业街日志、联网草稿和系统消息都会忽略。'}
                            </div>

                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {lang === 'en' ? 'Provider' : '厂商'}:
                                <select
                                    value={editingContact.tts_provider || 'tencent'}
                                    onChange={(e) => {
                                        const nextProvider = e.target.value;
                                        setCustomTtsVoiceOpen(false);
                                        setCustomTtsModelOpen(false);
                                        setEditingContact({
                                            ...editingContact,
                                            tts_provider: nextProvider,
                                            tts_voice: '',
                                            tts_model: ''
                                        });
                                    }}
                                    style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                                >
                                    {TTS_PROVIDERS.map(provider => {
                                        const providerLabel = translateTtsProviderConfig(provider, lang).label;
                                        return <option key={provider.id} value={provider.id}>{providerLabel}</option>;
                                    })}
                                </select>
                            </label>

                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {lang === 'en' ? 'API Key / Credentials' : 'API Key / 凭证'}:
                                {editingContact.tts_provider === 'tencent' ? (
                                    <textarea
                                        value={editingContact.tts_api_key || ''}
                                        onChange={(e) => updateEditingSecret('tts_api_key', e.target.value)}
                                        placeholder={getSecretPlaceholder(editingContact, 'tts_api_key', lang === 'en' ? 'Paste SecretId on the first line\nPaste SecretKey on the second line' : 'SecretId 这里粘贴第一行\nSecretKey 这里粘贴第二行')}
                                        style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '58px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                                    />
                                ) : (
                                    <input
                                        type="password"
                                        value={editingContact.tts_api_key || ''}
                                        onChange={(e) => updateEditingSecret('tts_api_key', e.target.value)}
                                        placeholder={getSecretPlaceholder(editingContact, 'tts_api_key', getEditingTtsProviderConfig(editingContact.tts_provider).keyHint)}
                                        style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    />
                                )}
                                {renderSecretStatus('tts_api_key')}
                            </label>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666', minWidth: 0 }}>
                                    {lang === 'en' ? 'Voice' : '音色'}:
                                    {getEditingTtsProviderConfig(editingContact.tts_provider).voiceOptions?.length > 0 ? (
                                        <>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '5px' }}>
                                                <select
                                                    value={customTtsVoiceOpen ? '__custom' : getTtsSelectValue(editingContact.tts_voice, getEditingTtsProviderConfig(editingContact.tts_provider).voiceOptions)}
                                                    onChange={(e) => {
                                                        if (e.target.value === '__custom') {
                                                            setCustomTtsVoiceOpen(true);
                                                            setEditingContact({ ...editingContact, tts_voice: '' });
                                                            return;
                                                        }
                                                        setCustomTtsVoiceOpen(false);
                                                        const selectedVoice = getEditingTtsProviderConfig(editingContact.tts_provider).voiceOptions.find(option => option.value === e.target.value);
                                                        const inferredModel = editingContact.tts_provider === 'tencent' ? inferTencentModelTier(selectedVoice) : '';
                                                        setEditingContact({
                                                            ...editingContact,
                                                            tts_voice: e.target.value,
                                                            ...(inferredModel ? { tts_model: inferredModel } : {})
                                                        });
                                                    }}
                                                    style={{ flex: 1, minWidth: 0, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                                >
                                                    <option value="">{lang === 'en' ? '-- Select voice --' : '-- 选择音色 --'}</option>
                                                    {getEditingTtsProviderConfig(editingContact.tts_provider).voiceOptions.map(option => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                    <option value="__custom">{lang === 'en' ? 'Custom voice id...' : '自定义音色 ID...'}</option>
                                                </select>
                                                {editingContact.tts_provider === 'tencent' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => loadTencentVoices(true)}
                                                        title={lang === 'en' ? 'Refresh Tencent voice list' : '重新拉取腾讯云官方音色列表'}
                                                        style={{ width: '34px', height: '34px', display: 'grid', placeItems: 'center', border: '1px solid #d8dee8', borderRadius: '6px', background: '#fff', color: '#475569', cursor: 'pointer' }}
                                                    >
                                                        <RefreshCw size={15} />
                                                    </button>
                                                )}
                                            </div>
                                            {editingContact.tts_provider === 'tencent' && (
                                                <div style={{ fontSize: '12px', color: tencentVoiceError ? '#b91c1c' : '#64748b', marginTop: '4px' }}>
                                                    {tencentVoiceError
                                                        ? (lang === 'en'
                                                            ? `Voice list fetch failed; built-in list is being used: ${tencentVoiceError}`
                                                            : `音色列表拉取失败，已使用内置列表：${tencentVoiceError}`)
                                                        : (tencentVoiceSource
                                                            ? (lang === 'en'
                                                                ? `Voice list: ${tencentVoiceSourceLabel(tencentVoiceSource)}`
                                                                : `音色列表：${tencentVoiceSourceLabel(tencentVoiceSource)}`)
                                                            : '')}
                                                </div>
                                            )}
                                            {(customTtsVoiceOpen || isCustomTtsValue(editingContact.tts_voice, getEditingTtsProviderConfig(editingContact.tts_provider).voiceOptions)) && (
                                                <input
                                                    type="text"
                                                    value={editingContact.tts_voice || ''}
                                                    onChange={(e) => setEditingContact({ ...editingContact, tts_voice: e.target.value })}
                                                    placeholder={getEditingTtsProviderConfig(editingContact.tts_provider).voiceHint}
                                                    style={{ padding: '8px', marginTop: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <input
                                            type="text"
                                            value={editingContact.tts_voice || ''}
                                            onChange={(e) => setEditingContact({ ...editingContact, tts_voice: e.target.value })}
                                            placeholder={getEditingTtsProviderConfig(editingContact.tts_provider).voiceHint}
                                            style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        />
                                    )}
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666', minWidth: 0 }}>
                                    {lang === 'en' ? 'Model / Tier' : '模型 / 档位'}:
                                    {getEditingTtsProviderConfig(editingContact.tts_provider).modelOptions?.length > 0 ? (
                                        <>
                                            <select
                                                value={customTtsModelOpen ? '__custom' : getTtsSelectValue(editingContact.tts_model, getEditingTtsProviderConfig(editingContact.tts_provider).modelOptions)}
                                                onChange={(e) => {
                                                    if (e.target.value === '__custom') {
                                                        setCustomTtsModelOpen(true);
                                                        setEditingContact({ ...editingContact, tts_model: '' });
                                                        return;
                                                    }
                                                    setCustomTtsModelOpen(false);
                                                    setEditingContact({ ...editingContact, tts_model: e.target.value });
                                                }}
                                                style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                                            >
                                                <option value="">{lang === 'en' ? '-- Select model --' : '-- 选择模型 / 档位 --'}</option>
                                                {getEditingTtsProviderConfig(editingContact.tts_provider).modelOptions.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                                <option value="__custom">{lang === 'en' ? 'Custom model...' : '自定义模型 / 档位...'}</option>
                                            </select>
                                            {(customTtsModelOpen || isCustomTtsValue(editingContact.tts_model, getEditingTtsProviderConfig(editingContact.tts_provider).modelOptions)) && (
                                                <input
                                                    type="text"
                                                    value={editingContact.tts_model || ''}
                                                    onChange={(e) => setEditingContact({ ...editingContact, tts_model: e.target.value })}
                                                    placeholder={getEditingTtsProviderConfig(editingContact.tts_provider).modelHint}
                                                    style={{ padding: '8px', marginTop: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <input
                                            type="text"
                                            value={editingContact.tts_model || ''}
                                            onChange={(e) => setEditingContact({ ...editingContact, tts_model: e.target.value })}
                                            placeholder={getEditingTtsProviderConfig(editingContact.tts_provider).modelHint}
                                            style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                                        />
                                    )}
                                </label>
                            </div>

                            <button
                                type="button"
                                disabled={editingContact.tts_enabled !== 1}
                                onClick={async () => {
                                    try {
                                        const res = await fetch(`${apiUrl}/tts/preview/${editingContact.id}`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                                text: ttsPreviewText(editingContact.name),
                                                config: {
                                                    tts_provider: editingContact.tts_provider || 'tencent',
                                                    tts_api_key: editingContact.tts_api_key || '',
                                                    tts_voice: editingContact.tts_voice || '',
                                                    tts_model: editingContact.tts_model || '',
                                                    tts_endpoint: editingContact.tts_endpoint || '',
                                                    tts_enabled: editingContact.tts_enabled === 1 ? 1 : 0
                                                }
                                            })
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
                                        setTtsPreviewVerifiedIds(prev => new Set(prev).add(editingContact.id));
                                    } catch (e) {
                                        alert((lang === 'en' ? 'Preview failed: ' : '试听失败：') + (e.message || e));
                                    }
                                }}
                                title={editingContact.tts_enabled === 1 ? (lang === 'en' ? 'Preview this voice' : '试听当前音色') : (lang === 'en' ? 'Enable TTS first' : '请先启用 TTS')}
                                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: '1px solid #d8dee8', borderRadius: '6px', background: editingContact.tts_enabled === 1 ? '#fff' : '#eef2f7', color: editingContact.tts_enabled === 1 ? '#475569' : '#94a3b8', cursor: editingContact.tts_enabled === 1 ? 'pointer' : 'not-allowed', fontSize: '13px' }}
                            >
                                <Volume2 size={14} /> {lang === 'en' ? 'Preview voice' : '试听'}
                            </button>

                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {lang === 'en' ? 'Endpoint / Region (optional)' : 'Endpoint / 地域（可选）'}:
                                <input
                                    type="text"
                                    value={editingContact.tts_endpoint || ''}
                                    onChange={(e) => setEditingContact({ ...editingContact, tts_endpoint: e.target.value })}
                                    placeholder={editingContact.tts_provider === 'azure' ? 'eastasia / https://...cognitiveservices.azure.com' : 'optional'}
                                    style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                    {lang === 'en' ? 'Trigger' : '触发方式'}:
                                    <select
                                        value={editingContact.tts_trigger_mode || 'tagged'}
                                        onChange={(e) => setEditingContact({ ...editingContact, tts_trigger_mode: e.target.value })}
                                        style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                                    >
                                        <option value="tagged">{lang === 'en' ? 'Main-model TTS tag only' : '仅主模型 TTS 标签'}</option>
                                        <option value="all_private">{lang === 'en' ? 'Every private reply' : '每条私聊回复'}</option>
                                    </select>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer', paddingTop: '23px' }}>
                                    <input
                                        type="checkbox"
                                        checked={editingContact.tts_autoplay === 1}
                                        onChange={(e) => setEditingContact({ ...editingContact, tts_autoplay: e.target.checked ? 1 : 0 })}
                                    />
                                    {lang === 'en' ? 'Auto-play when ready' : '生成后自动播放'}
                                </label>
                            </div>
                        </div>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666', marginTop: '10px' }}>
                            {lang === 'en' ? 'Persona (Prompt Info)' : '角色设定（Prompt 信息）'}:
                            <textarea value={editingContact.persona || ''} onChange={(e) => setEditingContact({ ...editingContact, persona: e.target.value })} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '80px', resize: 'vertical' }} />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666', marginTop: '10px' }}>
                            {lang === 'en' ? 'System Guidelines (Core Rules & Tags)' : '系统准则（核心规则与标签）'}:
                            <textarea
                                value={editingContact.system_prompt || ''}
                                onChange={(e) => setEditingContact({ ...editingContact, system_prompt: e.target.value })}
                                placeholder={lang === 'en' ? 'Leave blank to use default system guidelines.' : '留空则使用默认系统准则。'}
                                style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                            />
                        </label>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                            <button onClick={() => setEditingContact(null)} style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{lang === 'en' ? 'Cancel' : '取消'}</button>
                            <button onClick={handleSaveContact} style={{ padding: '8px 16px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{lang === 'en' ? 'Save Settings' : '保存设置'}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default SettingsPanel;
