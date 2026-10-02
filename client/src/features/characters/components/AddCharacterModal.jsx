import React, { useMemo, useRef, useState } from 'react';
import { requestJson } from '../../../shared/http/requestJson.js';
import { Check, Dices, Laptop, RefreshCw, Sparkles, UserRound, Wand2, X } from 'lucide-react';
import { useLanguage } from "../../../shared/i18n/LanguageContext.jsx";
import { LOCAL_OLLAMA_MODEL_PRESET, withLocalModelOption } from "../localModelPreset.js";

const CHARACTER_PRESETS = [
    {
        id: 'pink-cardigan-girl-v1',
        label: 'Pink Cardigan',
        spriteBase: '/assets/pixel-world/characters/pink-cardigan-girl-v1/frames-64x80',
        assetVersion: 'pink-cardigan-girl-v1-20260524'
    },
    {
        id: 'casual-boy-v1',
        label: 'Casual Boy',
        spriteBase: '/assets/pixel-world/characters/casual-boy-v1/frames-64x80',
        assetVersion: 'casual-boy-v1-20260524'
    }
];

const LOOKS = [
    { id: 'default', label: 'Default' }
];

const ACTIONS = ['walk'];
const DIRECTIONS = ['front', 'left', 'right', 'back'];
const FRAMES = ['idle', 'step_a', 'passing', 'step_b'];

function getFrameSrc(characterId, _lookId, action = 'walk', direction = 'front', frame = 'idle') {
    const preset = CHARACTER_PRESETS.find(item => item.id === characterId) || CHARACTER_PRESETS[0];
    const resolvedDirection = DIRECTIONS.includes(direction) ? direction : 'front';
    const resolvedFrame = FRAMES.includes(frame) ? frame : 'idle';
    const resolvedAction = ACTIONS.includes(action) ? action : 'walk';
    return `${preset.spriteBase}/${resolvedDirection}_${resolvedAction}_${resolvedFrame}.png?v=${preset.assetVersion}`;
}

function getRandomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function AddCharacterModal({ isOpen, onClose, onAdd, apiUrl }) {
    const { t, lang } = useLanguage();
    const [selectedCharacter, setSelectedCharacter] = useState(CHARACTER_PRESETS[0].id);
    const [selectedLook, setSelectedLook] = useState(LOOKS[0].id);
    const [previewAction, setPreviewAction] = useState('walk');
    const [previewDirection, setPreviewDirection] = useState('front');
    const defaultSpriteSrc = getFrameSrc(CHARACTER_PRESETS[0].id, LOOKS[0].id);
    const [avatarIsCustom, setAvatarIsCustom] = useState(false);
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        avatar: defaultSpriteSrc,
        persona: '',
        api_endpoint: '',
        api_key: '',
        model_name: '',
        memory_api_endpoint: '',
        memory_api_key: '',
        memory_model_name: '',
        affinity: 50,
        wallet: 200
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const submitLock = useRef(false);
    const generatedId = useRef('');

    const [genQuery, setGenQuery] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [modelList, setModelList] = useState([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelFetchError, setModelFetchError] = useState('');
    const authToken = localStorage.getItem('cp_token') || '';
    const authJsonHeaders = React.useMemo(() => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    }), [authToken]);
    const modelOptions = React.useMemo(() => withLocalModelOption(modelList), [modelList]);

    const selectedSpriteSrc = useMemo(
        () => getFrameSrc(selectedCharacter, selectedLook, 'walk', 'front', 'idle'),
        [selectedCharacter, selectedLook]
    );

    const selectedCharacterLabel = CHARACTER_PRESETS.find(item => item.id === selectedCharacter)?.label || selectedCharacter;
    const selectedLookLabel = LOOKS.find(item => item.id === selectedLook)?.label || selectedLook;

    if (!isOpen) return null;

    const updateAvatarFromDressup = (characterId, lookId) => {
        if (avatarIsCustom) return;
        setFormData(prev => ({
            ...prev,
            avatar: getFrameSrc(characterId, lookId, 'walk', 'front', 'idle')
        }));
    };

    const selectCharacter = (characterId) => {
        setSelectedCharacter(characterId);
        updateAvatarFromDressup(characterId, selectedLook);
    };

    const selectLook = (lookId) => {
        setSelectedLook(lookId);
        updateAvatarFromDressup(selectedCharacter, lookId);
    };

    const randomizeDressup = () => {
        const nextCharacter = getRandomItem(CHARACTER_PRESETS).id;
        const nextLook = getRandomItem(LOOKS).id;
        setSelectedCharacter(nextCharacter);
        setSelectedLook(nextLook);
        updateAvatarFromDressup(nextCharacter, nextLook);
    };

    const useSelectedSpriteAsAvatar = () => {
        setAvatarIsCustom(false);
        setFormData(prev => ({ ...prev, avatar: selectedSpriteSrc }));
    };

    const applyLocalModelPreset = () => {
        setFormData(prev => ({
            ...prev,
            ...LOCAL_OLLAMA_MODEL_PRESET,
            memory_api_endpoint: LOCAL_OLLAMA_MODEL_PRESET.api_endpoint,
            memory_api_key: LOCAL_OLLAMA_MODEL_PRESET.api_key,
            memory_model_name: LOCAL_OLLAMA_MODEL_PRESET.model_name
        }));
        setModelList(prev => withLocalModelOption(prev));
        setModelFetchError('');
    };

    const handleModelSelect = (modelName) => {
        if (modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name) {
            applyLocalModelPreset();
            return;
        }
        setFormData(prev => ({ ...prev, model_name: modelName }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitLock.current) return;
        if (!formData.name.trim()) {
            setSubmitError(lang === 'en' ? 'Enter a character name.' : '请输入角色名称。');
            return;
        }
        submitLock.current = true;
        setSubmitting(true);
        setSubmitError('');
        generatedId.current ||= `char-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
        const characterId = formData.id.trim() || generatedId.current;
        const payload = {
            ...formData,
            id: characterId,
            name: formData.name.trim(),
            avatar: String(formData.avatar || '').trim() || selectedSpriteSrc,
            memory_api_endpoint: formData.api_endpoint,
            memory_api_key: formData.api_key,
            memory_model_name: formData.model_name
        };

        try {
            const data = await requestJson(`${apiUrl}/characters`, {
                method: 'POST',
                headers: authJsonHeaders,
                body: JSON.stringify(payload)
            });
            if (!data.character?.id) throw new Error(lang === 'en' ? 'Invalid character response' : '服务器未返回角色信息');
            onAdd(data.character);
            onClose();
        } catch (err) {
            setSubmitError(err.message || (lang === 'en' ? 'Failed to connect to backend.' : '无法连接到后端服务器。'));
        } finally {
            submitLock.current = false;
            setSubmitting(false);
        }
    };

    const handleGenerate = async () => {
        if (!genQuery || !formData.api_endpoint || !formData.api_key || !formData.model_name) {
            alert(t('Required fields missing'));
            return;
        }
        setIsGenerating(true);
        try {
            const res = await fetch(`${apiUrl}/characters/generate`, {
                method: 'POST',
                headers: authJsonHeaders,
                body: JSON.stringify({
                    query: genQuery,
                    api_endpoint: formData.api_endpoint,
                    api_key: formData.api_key,
                    model_name: formData.model_name
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setFormData(prev => ({
                ...prev,
                name: data.character.name || prev.name,
                avatar: data.character.avatar || prev.avatar,
                persona: data.character.persona || prev.persona,
                affinity: data.character.affinity ?? prev.affinity,
                wallet: data.character.wallet ?? prev.wallet
            }));
            if (data.character.avatar) setAvatarIsCustom(true);
        } catch (e) {
            alert(lang === 'en' ? 'Generation Failed: ' + e.message : '生成角色失败: ' + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFetchModels = async () => {
        if (!formData.api_endpoint || !formData.api_key) {
            setModelFetchError(lang === 'en' ? 'Fill in the API Endpoint and API Key first.' : '请先填写 API Endpoint 和 API Key');
            return;
        }
        setFetchingModels(true);
        setModelFetchError('');
        setModelList([]);
        try {
            const res = await fetch(`${apiUrl}/models`, {
                method: 'POST',
                headers: authJsonHeaders,
                body: JSON.stringify({ endpoint: formData.api_endpoint, key: formData.api_key })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setModelList(withLocalModelOption(data.models || []));
            if ((data.models || []).length === 0) setModelFetchError(lang === 'en' ? 'No remote models found. The local Ollama option is still available.' : '未找到远端模型；仍可选择本地 Ollama。');
        } catch (e) {
            setModelFetchError((lang === 'en' ? 'Fetch failed: ' : '拉取失败: ') + e.message);
        }
        setFetchingModels(false);
    };

    return (
        <div className="modal-overlay chat-modal-overlay add-character-modal-overlay dressup-character-overlay">
            <div className="modal-content chat-action-modal add-character-modal dressup-character-modal">
                <header className="dressup-character-header">
                    <div>
                        <p>{lang === 'en' ? 'Private chat character' : '私聊角色'}</p>
                        <h3>{lang === 'en' ? 'Create Character' : '添加新联系人'}</h3>
                    </div>
                    <button type="button" className="dressup-icon-button" onClick={onClose} title={lang === 'en' ? 'Close' : '关闭'}>
                        <X size={20} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="dressup-character-layout">
                    <section className="dressup-wardrobe-panel" aria-label={lang === 'en' ? 'Wardrobe' : '换装'}>
                        <div className="dressup-stage">
                            <div className="dressup-stage-toolbar">
                                <span>{selectedCharacterLabel} / {selectedLookLabel}</span>
                                <button type="button" className="dressup-mini-button" onClick={randomizeDressup}>
                                    <Dices size={15} />
                                    {lang === 'en' ? 'Random' : '随机'}
                                </button>
                            </div>
                            <div className="dressup-sprite-stage">
                                <img src={getFrameSrc(selectedCharacter, selectedLook, previewAction, previewDirection, 'idle')} alt="" />
                            </div>
                            <div className="dressup-preview-controls">
                                {ACTIONS.map(action => (
                                    <button key={action} type="button" className={previewAction === action ? 'active' : ''} onClick={() => setPreviewAction(action)}>
                                        {action}
                                    </button>
                                ))}
                            </div>
                            <div className="dressup-preview-controls">
                                {DIRECTIONS.map(direction => (
                                    <button key={direction} type="button" className={previewDirection === direction ? 'active' : ''} onClick={() => setPreviewDirection(direction)}>
                                        {direction}
                                    </button>
                                ))}
                            </div>
                            <div className="dressup-frame-strip">
                                {FRAMES.map(frame => (
                                    <img key={frame} src={getFrameSrc(selectedCharacter, selectedLook, previewAction, previewDirection, frame)} alt="" />
                                ))}
                            </div>
                        </div>

                        <div className="dressup-picker-group">
                            <div className="dressup-picker-heading">
                                <UserRound size={16} />
                                <span>{lang === 'en' ? 'Character' : '角色'}</span>
                            </div>
                            <div className="dressup-tile-grid hair-grid">
                                {CHARACTER_PRESETS.map(character => (
                                    <button key={character.id} type="button" className={selectedCharacter === character.id ? 'selected' : ''} onClick={() => selectCharacter(character.id)} title={character.label}>
                                        <img src={getFrameSrc(character.id, selectedLook)} alt="" />
                                        <span>{character.label}</span>
                                        {selectedCharacter === character.id && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="dressup-picker-group">
                            <div className="dressup-picker-heading">
                                <Sparkles size={16} />
                                <span>{lang === 'en' ? 'Style' : '款式'}</span>
                            </div>
                            <div className="dressup-tile-grid outfit-grid">
                                {LOOKS.map(look => (
                                    <button key={look.id} type="button" className={selectedLook === look.id ? 'selected' : ''} onClick={() => selectLook(look.id)} title={look.label}>
                                        <img src={getFrameSrc(selectedCharacter, look.id)} alt="" />
                                        <span>{look.label}</span>
                                        {selectedLook === look.id && <Check size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="dressup-character-form-panel">
                        <div className="dressup-generator-box">
                            <div className="dressup-section-title">
                                <Wand2 size={16} />
                                <span>{lang === 'en' ? 'Auto-Generate Character' : '自动生成角色'}</span>
                            </div>
                            <textarea
                                value={genQuery}
                                onChange={(e) => setGenQuery(e.target.value)}
                                placeholder={lang === 'en' ? 'Describe the persona. Fill API settings first.' : '描述角色设定，请先填写下方 API 配置。'}
                            />
                            <button type="button" className="dressup-primary-button" onClick={handleGenerate} disabled={isGenerating}>
                                {isGenerating ? (lang === 'en' ? 'Generating...' : '生成中...') : (lang === 'en' ? 'Auto-Fill Form' : '自动填充表单')}
                            </button>
                        </div>

                        <div className="dressup-field-grid">
                            <label>
                                <span>{t('Name')} ({lang === 'en' ? 'Required' : '必填'})</span>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'Initial Affinity' : '初始好感度'}</span>
                                <input type="number" min="0" max="100" value={formData.affinity} onChange={e => setFormData({ ...formData, affinity: parseInt(e.target.value, 10) || 0 })} />
                            </label>
                            <label>
                                <span>{lang === 'en' ? 'Wallet' : '初始钱包'}</span>
                                <input type="number" min="0" step="10" value={formData.wallet} onChange={e => setFormData({ ...formData, wallet: parseFloat(e.target.value) || 0 })} />
                            </label>
                            <label>
                                <span>{t('Avatar URL')}</span>
                                <div className="dressup-avatar-row">
                                    <input
                                        type="text"
                                        value={formData.avatar}
                                        onChange={e => {
                                            setAvatarIsCustom(true);
                                            setFormData({ ...formData, avatar: e.target.value });
                                        }}
                                        placeholder={selectedSpriteSrc}
                                    />
                                    <button type="button" onClick={useSelectedSpriteAsAvatar}>{lang === 'en' ? 'Use Sprite' : '用当前素材'}</button>
                                </div>
                            </label>
                            <label className="dressup-wide-field">
                                <span>{t('Persona')}</span>
                                <textarea rows={5} value={formData.persona} onChange={e => setFormData({ ...formData, persona: e.target.value })} />
                            </label>
                        </div>

                        <div className="dressup-api-panel">
                            <div className="dressup-section-title muted">
                                <Laptop size={16} />
                                <span>{lang === 'en' ? 'Model Settings' : '模型设置'}</span>
                            </div>
                            <label>
                                <span>{t('API Endpoint')}</span>
                                <input
                                    type="text"
                                    value={formData.api_endpoint}
                                    onChange={e => setFormData({ ...formData, api_endpoint: e.target.value })}
                                    placeholder="https://api.openai.com/v1/chat/completions"
                                />
                            </label>
                            <button type="button" className="dressup-secondary-button" onClick={applyLocalModelPreset}>
                                <Laptop size={14} />
                                {lang === 'en' ? 'Use local Ollama model' : '使用本地 Ollama 模型'}
                            </button>
                            <label>
                                <span>{t('API Key')}</span>
                                <input type="password" value={formData.api_key} onChange={e => setFormData({ ...formData, api_key: e.target.value })} />
                            </label>
                            <label>
                                <span>{t('Model Name')}</span>
                                <div className="dressup-model-row">
                                    <input type="text" value={formData.model_name} onChange={e => setFormData({ ...formData, model_name: e.target.value })} placeholder="gpt-4o" />
                                    <button type="button" onClick={handleFetchModels} disabled={fetchingModels}>
                                        <RefreshCw size={14} className={fetchingModels ? 'spin' : ''} />
                                        {fetchingModels ? '...' : t('Fetch Models')}
                                    </button>
                                </div>
                            </label>
                            {modelFetchError && <p className="dressup-form-error">{modelFetchError}</p>}
                            {modelOptions.length > 0 && (
                                <select onChange={e => handleModelSelect(e.target.value)} defaultValue="">
                                    <option value="" disabled>{lang === 'en' ? 'Select model' : '选择模型'}</option>
                                    {modelOptions.map(model => (
                                        <option key={model} value={model}>
                                            {model === LOCAL_OLLAMA_MODEL_PRESET.model_name ? `${model} · ${lang === 'en' ? 'Local Ollama' : '本地 Ollama'}` : model}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {submitError && <p role="alert">{submitError}</p>}
                        <button type="submit" className="dressup-submit-button" disabled={submitting}>{submitting ? t('Loading...') : t('Add Character')}</button>
                    </section>
                </form>
            </div>
        </div>
    );
}

export default AddCharacterModal;
