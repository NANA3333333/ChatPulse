import { useState, useCallback, useEffect } from 'react';
import { getTtsProviderConfig, translateTtsProviderConfig } from './ttsProviders.js';

export function useSettingsModels({ lang, apiUrl }) {
    const [mainModels, setMainModels] = useState([]);
    const [mainModelFetching, setMainModelFetching] = useState(false);
    const [mainModelError, setMainModelError] = useState('');
    const [memModels, setMemModels] = useState([]);
    const [memModelFetching, setMemModelFetching] = useState(false);
    const [memModelError, setMemModelError] = useState('');
    const [tencentVoiceOptions, setTencentVoiceOptions] = useState([]);
    const [tencentVoiceSource, setTencentVoiceSource] = useState('');
    const [tencentVoiceError, setTencentVoiceError] = useState('');
    const getEditingTtsProviderConfig = useCallback(
        (providerId) => {
            const config = getTtsProviderConfig(providerId);
            const mergedConfig =
                config.id === 'tencent' && tencentVoiceOptions.length
                    ? { ...config, voiceOptions: tencentVoiceOptions }
                    : config;
            return translateTtsProviderConfig(mergedConfig, lang);
        },
        [tencentVoiceOptions, lang],
    );

    const tencentVoiceSourceLabel = useCallback(
        (source) => {
            if (!source) return '';
            if (source === 'tencent-docs') return lang === 'en' ? 'Tencent official docs' : '腾讯官方文档';
            return source;
        },
        [lang],
    );

    const ttsPreviewText = useCallback(
        (name) => {
            const displayName = name || (lang === 'en' ? 'this character' : '这个角色');
            if (lang === 'en') {
                return `Hi, I am ${displayName}. This is a voice preview.`;
            }
            return `你好，我是${displayName}。这是一段语音试听。`;
        },
        [lang],
    );

    const getSecretPlaceholder = useCallback(
        (record, field, fallback = '') => {
            if (record?.[`${field}_clear`]) {
                return lang === 'en' ? 'Marked to clear on save' : '已标记保存时清除';
            }
            if (record?.[`${field}_configured`]) {
                const last4 = record?.[`${field}_last4`]
                    ? `••••${record[`${field}_last4`]}`
                    : lang === 'en'
                      ? 'saved key'
                      : '已保存 Key';
                return lang === 'en'
                    ? `Saved: ${last4}. Leave blank to keep it; type a new key to replace.`
                    : `已保存：${last4}。留空保留，输入新 Key 替换。`;
            }
            return fallback;
        },
        [lang],
    );

    const getSecretStatusText = useCallback(
        (record, field) => {
            if (record?.[`${field}_clear`]) {
                return lang === 'en'
                    ? 'This saved key will be cleared after saving.'
                    : '保存后会清除当前已保存的 Key。';
            }
            if (record?.[`${field}_configured`]) {
                const last4 = record?.[`${field}_last4`] ? `••••${record[`${field}_last4`]}` : '';
                return lang === 'en'
                    ? `Saved ${last4}. Leave this field blank to keep it.`
                    : `已保存 ${last4}。这个输入框留空会继续保留原 Key。`;
            }
            return lang === 'en' ? 'No key saved yet.' : '还没有保存 Key。';
        },
        [lang],
    );

    const fetchModels = async (endpoint, key, setList, setFetching, setError, options = {}) => {
        const cleanEndpoint = String(endpoint || '').trim();
        const cleanKey = String(key || '').trim();
        if (!cleanEndpoint) {
            setError(lang === 'en' ? 'Fill in the endpoint first.' : '请先填写 Endpoint');
            return;
        }
        if (!cleanKey && !options.hasSavedKey) {
            setError(lang === 'en' ? 'Fill in a key, or use the saved key.' : '请先填写 Key，或使用已保存的 Key');
            return;
        }
        setFetching(true);
        setError('');
        setList([]);
        try {
            const modelUrl = options.characterId
                ? `${apiUrl}/characters/${encodeURIComponent(options.characterId)}/models`
                : `${apiUrl}/models`;
            const res = await fetch(modelUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                },
                body: JSON.stringify({ endpoint: cleanEndpoint, key: cleanKey, scope: options.scope || 'main' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setList(data.models || []);
            if (!(data.models || []).length)
                setError(
                    lang === 'en'
                        ? 'No remote models found. The local Ollama option is still available.'
                        : '未找到远端模型；仍可选择本地 Ollama。',
                );
        } catch (e) {
            setError((lang === 'en' ? 'Fetch failed: ' : '拉取失败: ') + e.message);
        }
        setFetching(false);
    };

    const loadTencentVoices = useCallback(
        async (forceRefresh = false) => {
            try {
                setTencentVoiceError('');
                const res = await fetch(`${apiUrl}/tts/tencent/voices${forceRefresh ? '?refresh=1' : ''}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                const voices = Array.isArray(data.voices) ? data.voices : [];
                if (!voices.length)
                    throw new Error(
                        lang === 'en' ? 'No Tencent Cloud voice list was returned.' : '没有拉到腾讯云音色列表',
                    );
                setTencentVoiceOptions(
                    voices
                        .map((voice) => ({
                            value: String(voice.value || voice.id || '').trim(),
                            label:
                                voice.label ||
                                `${voice.id || voice.value} ${voice.name || ''} - ${voice.scene || ''}`.trim(),
                            type: voice.type || '',
                            name: voice.name || '',
                            scene: voice.scene || '',
                        }))
                        .filter((voice) => voice.value),
                );
                setTencentVoiceSource(data.source || '');
            } catch (e) {
                setTencentVoiceError(e.message || String(e));
            }
        },
        [apiUrl, lang],
    );

    useEffect(() => {
        loadTencentVoices(false);
    }, [loadTencentVoices]);

    return {
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
    };
}
