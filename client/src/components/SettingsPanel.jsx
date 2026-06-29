import React, { useState, useEffect, useCallback } from 'react';
import {
    Trash2,
    Edit3,
    Save,
    RefreshCw,
    Download,
    Upload,
    ChevronLeft,
    Volume2,
    Wallet,
    Heart,
    Activity,
    ShieldCheck,
    Cloud,
    Plus,
    FileText,
    MessageSquare,
} from 'lucide-react';
import AvatarWithFrame, { AVATAR_FRAME_OPTIONS, normalizeAvatarFrameId } from './AvatarWithFrame';
import { useLanguage } from '../LanguageContext';
import { defaultAvatarUrl, resolveAvatarUrl } from '../utils/avatar';
import { useAuth } from '../AuthContext';

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
   - If your anxiety/pressure is relieved by their message, output [PRESSURE:0].
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
   - 如果你的压力被缓解，输出 [PRESSURE:0]。
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
    };
}


function SettingsPanel({ apiUrl, contacts: parentContacts = [], onCharactersUpdate, onProfileUpdate, onBack }) {
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

    const getEditingTtsProviderConfig = useCallback((providerId) => {
        const config = getTtsProviderConfig(providerId);
        if (config.id === 'tencent' && tencentVoiceOptions.length) {
            return { ...config, voiceOptions: tencentVoiceOptions };
        }
        return config;
    }, [tencentVoiceOptions]);

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
        if (!cleanEndpoint) { setError('请先填写 Endpoint'); return; }
        if (!cleanKey && !options.hasSavedKey) { setError('请先填写 Key，或使用已保存的 Key'); return; }
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
            if (!(data.models || []).length) setError('未找到可用模型');
        } catch (e) { setError('拉取失败: ' + e.message); }
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
            if (!voices.length) throw new Error('没有拉到腾讯云音色列表');
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
    }, [apiUrl]);

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
    }, [apiUrl]);

    useEffect(() => {
        loadTencentVoices(false);
    }, [loadTencentVoices]);

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
        if (!window.confirm("Are you sure you want to delete this contact and all their data?")) return;
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
                alert((lang === 'en' ? 'Delete failed: ' : '删除失败：') + (data.error || res.statusText || 'Unknown error'));
            }
        } catch (e) {
            console.error('Failed to delete character:', e);
            alert((lang === 'en' ? 'Delete failed: ' : '删除失败：') + (e.message || 'Network error'));
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



    const handleSaveContact = async () => {
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
                setEditingContact(null);
                window.dispatchEvent(new Event('refresh_contacts'));
                if (onCharactersUpdate) onCharactersUpdate({ type: 'updated', id: savedCharacter.id, character: savedCharacter });
                fetch(`${apiUrl}/characters`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } })
                    .then(r => r.json())
                    .then(d => setContacts(d))
                    .catch(console.error);
            } else {
                alert("Failed to save: " + data.error);
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
                alert(`上传成功 / Upload Success!\n\n文件路径：${data.url}\n\n请不要忘记点击下方的 Save / 保存 按钮使头像生效。\n(Please click Save below)`);
            } else {
                alert(lang === 'en' ? 'Failed to save: ' + data.error : '保存失败: ' + data.error);
            }
        } catch (e) {
            console.error('Upload failed:', e);
            alert('上传过程中发生错误 / Upload Exception: ' + e.message);
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
                alert("Failed to restore: " + data.error);
            }
        } catch (e) {
            console.error('Import Error:', e);
            alert('Upload failed.');
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
        } catch (e) {
            console.error('Export Error:', e);
            alert(lang === 'en' ? `Backup download failed: ${e.message}` : `备份下载失败：${e.message}`);
        }
    };

    const handleSystemWipe = async () => {
        if (!window.confirm(lang === 'en' ? 'DANGER: This will permanently wipe ALL characters, chats, and memories. Are you absolutely sure?' : '危险：这将永久清空所有角色、聊天、群聊和记忆。你确定要执行吗？')) return;

        // Double check
        if (!window.confirm(lang === 'en' ? 'Final confirmation: Wipe everything?' : '最后一次确认：真的要抹除所有数据吗？')) return;

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
                alert("Wipe failed: " + data.error);
            }
        } catch (e) {
            console.error('Wipe Error:', e);
            alert('Wipe failed.');
        }
    };

    const renderAvatarFramePicker = (value, onChange, previewSrc, previewName = 'User') => (
        <div className="avatar-frame-picker">
            {AVATAR_FRAME_OPTIONS.map(option => {
                const selected = normalizeAvatarFrameId(value) === option.id;
                return (
                    <button
                        key={option.id}
                        type="button"
                        className={`avatar-frame-choice ${selected ? 'is-selected' : ''}`}
                        onClick={() => onChange(option.id)}
                        title={option.label}
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
                        <span className="avatar-frame-choice__label">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );

    const selectedSettingsContactBase = contacts.find(c => c.id === selectedSettingsContactId) || contacts[0] || null;
    const selectedSettingsContact = selectedSettingsContactBase
        ? {
            ...selectedSettingsContactBase,
            ...(characterMessageStatsById[selectedSettingsContactBase.id] || {})
        }
        : null;
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
    const selectedTtsConfig = getTtsProviderConfig(selectedSettingsContact?.tts_provider);
    const selectedContactDetailRows = selectedSettingsContact ? [
        [
            lang === 'en' ? 'Created' : '加入时间',
            formatJoinTime(selectedSettingsContact)
        ],
        [
            lang === 'en' ? 'Last Interaction' : '最后互动',
            formatSettingsDate(
                selectedSettingsContact.last_message_at || selectedSettingsContact.last_user_msg_time || selectedSettingsContact.updated_at,
                lang === 'en' ? 'No private chat yet' : '还没有私聊互动'
            )
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
        [lang === 'en' ? 'Wallet' : '钱包余额', `¥${Number(selectedSettingsContact.wallet ?? 0).toFixed(2)}`],
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

    const formatCompactInteraction = (character, emptyLabel) => {
        const timestamp = normalizeTimestampMs(character?.last_message_at || character?.last_user_msg_time || character?.updated_at);
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

    const averageAffinity = contacts.length
        ? Math.round(contacts.reduce((total, item) => total + Number(item.affinity || 0), 0) / contacts.length)
        : 0;

    const latestInteractionCharacter = contacts.reduce((latest, item) => {
        const currentTime = normalizeTimestampMs(item.last_message_at || item.last_user_msg_time || item.updated_at);
        const latestTime = normalizeTimestampMs(latest?.last_message_at || latest?.last_user_msg_time || latest?.updated_at);
        return currentTime > latestTime ? item : latest;
    }, null);

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

    return (
        <>
            <div className="settings-panel-page settings-command-center-page">
                {profileLoadError && (
                    <div className="settings-inline-alert">
                        {lang === 'en' ? 'Live profile sync is delayed. Showing local fallback data for now.' : '实时用户资料同步超时，当前先显示本地兜底数据。'}
                        <div>{profileLoadError}</div>
                    </div>
                )}

                <section id="settings-profile-section" className="settings-card settings-command-profile-card">
                    {onBack && (
                        <button className="mobile-back-btn settings-command-back" onClick={onBack} title="Back">
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
                            <Heart size={27} />
                            <span>{lang === 'en' ? 'Average Affinity' : '好感度平均'}</span>
                            <strong>{averageAffinity || 0} / 100</strong>
                        </div>
                        <div className="settings-command-stat">
                            <Activity size={27} />
                            <span>{lang === 'en' ? 'Last Interaction' : '最后互动'}</span>
                            <strong>{formatCompactInteraction(latestInteractionCharacter, lang === 'en' ? 'No chat yet' : '暂无互动')}</strong>
                        </div>
                    </div>
                    <button className="settings-icon-text-button settings-command-edit-profile" onClick={() => setIsEditing(true)} title={lang === 'en' ? 'Edit your profile (name, avatar, bio)' : '编辑个人资料（名字、头像、签名）'}>
                        <Edit3 size={16} /> {lang === 'en' ? 'Edit Profile' : '编辑档案'}
                    </button>

                    {isEditing && (
                        <div className="settings-profile-edit settings-command-profile-edit">
                            <label>
                                <span>Name</span>
                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                            </label>
                            <label>
                                <span>Avatar URL or Upload</span>
                                <div className="settings-upload-row">
                                    <input type="text" value={editAvatar} onChange={e => setEditAvatar(e.target.value)} placeholder="https://..." />
                                    <label className="settings-secondary-button">
                                        Upload
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
                                        Upload
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setEditBanner)} />
                                    </label>
                                </div>
                            </label>
                            <label>
                                <span>Bio</span>
                                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="What's up?" />
                            </label>
                            <div className="settings-form-actions">
                                <button className="settings-primary-button" onClick={handleSaveProfile} title={lang === 'en' ? 'Save profile changes' : '保存个人资料修改'}>
                                    <Save size={16} /> Save
                                </button>
                                <button className="settings-secondary-button" onClick={() => setIsEditing(false)} title={lang === 'en' ? 'Cancel editing' : '取消编辑'}>Cancel</button>
                            </div>
                        </div>
                    )}
                </section>

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
                                                            解除
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
                                <div className="settings-detail-stats">
                                    <div className="settings-detail-stat">
                                        <Heart size={22} />
                                        <span>{lang === 'en' ? 'Affinity' : '好感度'}</span>
                                        <strong>{Number(selectedSettingsContact.affinity || 0)} / 100</strong>
                                    </div>
                                    <div className="settings-detail-stat settings-detail-stat--wallet">
                                        <Wallet size={22} />
                                        <span>{lang === 'en' ? 'Wallet' : '钱包余额'}</span>
                                        <strong>¥{Number(selectedSettingsContact.wallet ?? 0).toFixed(2)}</strong>
                                    </div>
                                    <div className="settings-detail-stat settings-detail-stat--chat">
                                        <MessageSquare size={22} />
                                        <span>{lang === 'en' ? 'Last' : '最后互动'}</span>
                                        <strong>{formatCompactInteraction(selectedSettingsContact)}</strong>
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
                        <button type="button" className="settings-backup-action settings-backup-action--danger" onClick={handleSystemWipe}>
                            <span className="settings-backup-icon"><Trash2 size={20} /></span>
                            <span>
                                <strong>{lang === 'en' ? 'Factory Reset' : '恢复出厂设置'}</strong>
                                <small>{lang === 'en' ? 'Clear all data permanently' : '清除所有数据，无法恢复'}</small>
                            </span>
                        </button>
                    </div>
                </section>
            </div>

            {/* Character Edit Modal */}
            {editingContact && (
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
                                        <option value="" disabled>-- 选择模型 --</option>
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
                                Min Interval (mins):
                                <div className="autopulse-interval-control" style={{ marginTop: '5px' }}>
                                    <input type="range" min="0.1" max="120" step="0.1" value={editingContact.interval_min || 0.1} onChange={(e) => setEditingContact({ ...editingContact, interval_min: parseFloat(e.target.value) })} style={{ width: '100%', backgroundSize: `${((editingContact.interval_min || 0.1) - 0.1) * 100 / (120 - 0.1)}% 100%` }} />
                                    <input type="number" step="0.1" value={editingContact.interval_min || 0} onChange={(e) => setEditingContact({ ...editingContact, interval_min: parseFloat(e.target.value) })} className="autopulse-number-input" />
                                </div>
                            </label>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                Max Interval (mins):
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
                            <strong style={{ fontSize: '13px', color: '#4a5568' }}>Memory Extraction AI (Small Model)</strong>
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
                                Memory Model Name:
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    <input type="text" value={editingContact.memory_model_name || ''} onChange={(e) => setEditingContact({ ...editingContact, memory_model_name: e.target.value })} placeholder="e.g. gpt-4o-mini" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    <button type="button" onClick={() => fetchModels(editingContact.memory_api_endpoint, editingContact.memory_api_key, setMemModels, setMemModelFetching, setMemModelError, { characterId: editingContact.id, scope: 'memory', hasSavedKey: editingContact.memory_api_key_configured && !editingContact.memory_api_key_clear })} disabled={memModelFetching}
                                        style={{ padding: '6px 10px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={13} /> {memModelFetching ? '...' : '拉取'}
                                    </button>
                                </div>
                                {memModelError && <span style={{ color: 'var(--danger)', fontSize: '12px' }}>{memModelError}</span>}
                                {memModels.length > 0 && (
                                    <select defaultValue="" onChange={e => setEditingContact({ ...editingContact, memory_model_name: e.target.value })}
                                        style={{ marginTop: '4px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                                        <option value="" disabled>-- 选择模型 --</option>
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
                                    {TTS_PROVIDERS.map(provider => (
                                        <option key={provider.id} value={provider.id}>{provider.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {lang === 'en' ? 'API Key / Credentials' : 'API Key / 凭证'}:
                                {editingContact.tts_provider === 'tencent' ? (
                                    <textarea
                                        value={editingContact.tts_api_key || ''}
                                        onChange={(e) => updateEditingSecret('tts_api_key', e.target.value)}
                                        placeholder={getSecretPlaceholder(editingContact, 'tts_api_key', 'SecretId 这里粘贴第一行\nSecretKey 这里粘贴第二行')}
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
                                                    {tencentVoiceError ? `音色列表拉取失败，已使用内置列表：${tencentVoiceError}` : (tencentVoiceSource ? `音色列表：${tencentVoiceSource === 'tencent-docs' ? '腾讯官方文档' : tencentVoiceSource}` : '')}
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
                                                text: `你好，我是${editingContact.name || '这个角色'}。这是一段语音试听。`,
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
                            Persona (Prompt Info):
                            <textarea value={editingContact.persona || ''} onChange={(e) => setEditingContact({ ...editingContact, persona: e.target.value })} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '80px', resize: 'vertical' }} />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666', marginTop: '10px' }}>
                            System Guidelines (Core Rules & Tags):
                            <textarea
                                value={editingContact.system_prompt || ''}
                                onChange={(e) => setEditingContact({ ...editingContact, system_prompt: e.target.value })}
                                placeholder="Leave blank to use default system guidelines."
                                style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                            />
                        </label>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                            <button onClick={() => setEditingContact(null)} style={{ padding: '8px 16px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleSaveContact} style={{ padding: '8px 16px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Settings</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default SettingsPanel;
