import React, { useState } from 'react';
import { X, Wand2, RefreshCw } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function AddCharacterModal({ isOpen, onClose, onAdd, apiUrl }) {
    const { t, lang } = useLanguage();
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        avatar: '',
        persona: '',
        api_endpoint: '',
        api_key: '',
        model_name: '',
        affinity: 50,
        wallet: 200
    });

    const [genQuery, setGenQuery] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [modelList, setModelList] = useState([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelFetchError, setModelFetchError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Auto-generate ID if missing
        const characterId = formData.id.trim() || `char-${Date.now()}`;
        const payload = { ...formData, id: characterId };

        try {
            const res = await fetch(`${apiUrl}/characters`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                onAdd(data.character);
                onClose();
            } else {
                alert(lang === 'en' ? 'Add failed: ' + data.error : '添加失败: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert(lang === 'en' ? 'Failed to connect to backend.' : '无法连接到后端服务器�?);
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: genQuery,
                    api_endpoint: formData.api_endpoint,
                    api_key: formData.api_key,
                    model_name: formData.model_name
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Auto-fill the form with generated data
            setFormData(prev => ({
                ...prev,
                name: data.character.name || prev.name,
                avatar: data.character.avatar || prev.avatar,
                persona: data.character.persona || prev.persona,
                affinity: data.character.affinity ?? prev.affinity,
                wallet: data.character.wallet ?? prev.wallet
            }));
        } catch (e) {
            alert(lang === 'en' ? 'Generation Failed: ' + e.message : '生成角色失败: ' + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFetchModels = async () => {
        if (!formData.api_endpoint || !formData.api_key) {
            setModelFetchError('请先填写 API Endpoint �?API Key');
            return;
        }
        setFetchingModels(true);
        setModelFetchError('');
        setModelList([]);
        try {
            const res = await fetch(
                `${apiUrl}/models?endpoint=${encodeURIComponent(formData.api_endpoint)}&key=${encodeURIComponent(formData.api_key)}`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setModelList(data.models || []);
            if ((data.models || []).length === 0) setModelFetchError('未找到可用模�?);
        } catch (e) {
            setModelFetchError('拉取失败: ' + e.message);
        }
        setFetchingModels(false);
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                backgroundColor: '#fff', padding: '20px', borderRadius: '8px',
                width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Add New Contact</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                {/* AI Generator Box */}
                <div style={{ padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px', color: '#333', fontWeight: 'bold' }}>
                        <Wand2 size={16} color="var(--accent-color)" /> Auto-Generate Character
                    </div>
                    <textarea
                        value={genQuery}
                        onChange={(e) => setGenQuery(e.target.value)}
                        placeholder="Describe the persona... (Make sure to fill out API keys below first)"
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical' }}
                    />
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        style={{ marginTop: '10px', width: '100%', padding: '8px', backgroundColor: isGenerating ? '#ccc' : 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: isGenerating ? 'not-allowed' : 'pointer' }}
                    >
                        {isGenerating ? '�?Generating...' : 'Auto-Fill Form'}
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>{t('Name')} (Required)</label>
                        <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>{t('Avatar URL')}</label>
                        <input type="text" value={formData.avatar} onChange={e => setFormData({ ...formData, avatar: e.target.value })}
                            placeholder="https://..."
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>{t('Persona')}</label>
                        <textarea value={formData.persona} onChange={e => setFormData({ ...formData, persona: e.target.value })}
                            rows={4}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Initial Affinity (0-100)</label>
                        <input type="number" min="0" max="100" value={formData.affinity} onChange={e => setFormData({ ...formData, affinity: parseInt(e.target.value) || 0 })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>{lang === 'en' ? 'Initial Wallet Balance' : '初始钱包余额'}</label>
                        <input type="number" min="0" step="10" value={formData.wallet} onChange={e => setFormData({ ...formData, wallet: parseFloat(e.target.value) || 0 })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>

                    <hr style={{ borderTop: '1px dashed #ddd', margin: '5px 0' }} />

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold', color: '#666' }}>{t('API Endpoint')}</label>
                        <input type="text" value={formData.api_endpoint} onChange={e => setFormData({ ...formData, api_endpoint: e.target.value })}
                            placeholder="https://api.openai.com/v1/chat/completions"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>{t('API Key')}</label>
                        <input type="password" value={formData.api_key} onChange={e => setFormData({ ...formData, api_key: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>{t('Model Name')}</label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input type="text" value={formData.model_name} onChange={e => setFormData({ ...formData, model_name: e.target.value })}
                                placeholder="gpt-4o"
                                style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                            <button type="button" onClick={handleFetchModels} disabled={fetchingModels}
                                style={{ padding: '8px 12px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RefreshCw size={14} className={fetchingModels ? 'spin' : ''} />
                                {fetchingModels ? '...' : t('Fetch Models')}
                            </button>
                        </div>
                        {modelFetchError && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{modelFetchError}</p>}
                        {modelList.length > 0 && (
                            <select
                                onChange={e => setFormData({ ...formData, model_name: e.target.value })}
                                defaultValue=""
                                style={{ marginTop: '6px', width: '100%', padding: '7px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
                            >
                                <option value="" disabled>── 选择模型 ──</option>
                                {modelList.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        )}
                    </div>

                    <button type="submit" style={{
                        marginTop: '10px', padding: '10px', backgroundColor: 'var(--accent-color)',
                        color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                    }}>{t('Add Character')}</button>
                </form>
            </div>
        </div>
    );
}

export default AddCharacterModal;
import React, { useState, useEffect } from 'react';
import { X, Trash2, Settings, RefreshCw } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function ChatSettingsDrawer({ contact, apiUrl, onClose, onClearHistory }) {
    const { t, lang } = useLanguage();
    const [relationships, setRelationships] = useState([]);
    const [regenLoading, setRegenLoading] = useState(null);
    const [regenError, setRegenError] = useState(null);

    useEffect(() => {
        if (!contact) return;
        fetch(`${apiUrl}/characters/${contact.id}/relationships`)
            .then(r => r.json())
            .then(data => setRelationships(Array.isArray(data) ? data : []))
            .catch(() => { });
    }, [contact, apiUrl]);

    const handleRegenerate = async (targetId) => {
        setRegenLoading(targetId);
        setRegenError(null);
        try {
            const r = await fetch(`${apiUrl}/characters/${contact.id}/relationships/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetId })
            });
            const d = await r.json();
            if (!r.ok) {
                setRegenError(d.error || (lang === 'en' ? 'Generation failed' : '生成失败'));
            } else {
                setRelationships(prev => prev.map(rel =>
                    rel.targetId === targetId ? { ...rel, affinity: d.affinity ?? rel.affinity, impression: d.impression ?? rel.impression } : rel
                ));
            }
        } catch (e) {
            console.error(e);
            setRegenError(e.message || (lang === 'en' ? 'Network error' : '网络错误'));
        }
        setRegenLoading(null);
    };

    if (!contact) return null;

    const handleClearHistory = async () => {
        if (!window.confirm(lang === 'en' ?
            `Are you sure you want to completely wipe all history with ${contact.name}?\n\nThis deletes chats, memories, diaries, moments, vector indices, and resets affinity.\n\nThis cannot be undone.` :
            `确定要完全重置与 ${contact.name} 的关系吗？\n\n这将清除：聊天记录、长期记忆、日记、朋友圈、向量索引，并重置好感度。\n\n此操作不可撤销。`)) return;
        try {
            const res = await fetch(`${apiUrl}/data/${contact.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                if (onClearHistory) onClearHistory();
            }
        } catch (e) {
            console.error('Failed to wipe character data:', e);
        }
    };

    return (
        <div className="memory-drawer" style={{ width: '320px', backgroundColor: '#f7f7f7' }}>
            <div className="memory-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={18} /> {t('Chat Settings')}
                </h3>
                <button className="icon-btn" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>
            <div className="memory-content" style={{ padding: '0' }}>
                {/* Contact Banner */}
                <div style={{ backgroundColor: '#fff', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                    <img src={contact.avatar} alt={contact.name} style={{ width: '60px', height: '60px', borderRadius: '50%', marginBottom: '10px' }} />
                    <div style={{ fontSize: '18px', fontWeight: '500' }}>{contact.name}</div>
                    <div style={{ fontSize: '13px', color: '#999', marginTop: '5px', textAlign: 'center', padding: '0 10px' }}>
                        {contact.persona ? contact.persona.substring(0, 50) + '...' : (lang === 'en' ? 'No persona set.' : '未设�?Persona�?)}
                    </div>
                </div>

                {/* AI Stats */}
                <div style={{ marginTop: '10px', backgroundColor: '#fff', padding: '15px', borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {lang === 'en' ? 'Hidden AI Stats' : 'AI 隐藏数据'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                        <span>{lang === 'en' ? 'Affinity' : '好感�?}</span>
                        <span style={{ fontWeight: '500', color: contact.affinity >= 80 ? 'var(--accent-color)' : contact.affinity < 30 ? 'var(--danger)' : '#333' }}>
                            {contact.affinity} / 100
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                        <span>{lang === 'en' ? 'Wallet' : '钱包余额'}</span>
                        <span style={{ fontWeight: '500', color: '#e67e22' }}>
                            💰 ¥{(contact.wallet ?? 0).toFixed(2)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                        <span>{lang === 'en' ? 'Pressure' : '焦虑�?}</span>
                        <span style={{ fontWeight: '500', color: contact.pressure_level > 2 ? 'var(--danger)' : '#333' }}>
                            {contact.pressure_level}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span>Status</span>
                        <span style={{ fontWeight: '500', color: contact.is_blocked ? 'var(--danger)' : 'var(--accent-color)' }}>
                            {contact.is_blocked ? (lang === 'en' ? 'Blocked You' : '已拉�?) : (lang === 'en' ? 'Active' : '正常')}
                        </span>
                    </div>
                </div>

                {/* Inter-character Relationships (char-to-char impressions) */}
                <div style={{ marginTop: '10px', backgroundColor: '#fff', padding: '15px', borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {lang === 'en' ? `${contact.name}'s Impressions of Others` : `${contact.name} 对其他角色的印象`}
                    </div>
                    {relationships.length === 0 ? (
                        <div style={{ fontSize: '13px', color: '#bbb', fontStyle: 'italic' }}>
                            {lang === 'en' ? 'No relationships yet.' : '还没有角色关系�?}
                        </div>
                    ) : (
                        relationships.map(rel => (
                            <div key={rel.targetId} style={{ marginBottom: '12px', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <img src={rel.targetAvatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${rel.targetName}`} alt=""
                                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: '500', fontSize: '13px' }}>{rel.targetName}</span>
                                        <span style={{ fontSize: '11px', color: '#999', marginLeft: '6px' }}>
                                            ❤️ {rel.affinity ?? '?'}
                                        </span>
                                    </div>
                                    <button onClick={() => handleRegenerate(rel.targetId)} disabled={regenLoading === rel.targetId}
                                        title={lang === 'en' ? 'Regenerate this character\'s impression via AI' : '通过 AI 重新生成此角色的印象'}
                                        style={{ background: 'none', border: '1px solid #ddd', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <RefreshCw size={10} /> {regenLoading === rel.targetId ? '...' : (lang === 'en' ? 'Regen' : '刷新')}
                                    </button>
                                </div>
                                {rel.impression && (
                                    <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4', fontStyle: 'italic' }}>
                                        "{rel.impression}"
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    {regenError && (
                        <div style={{ marginTop: '8px', padding: '6px 10px', background: '#fff1f1', border: '1px solid #ffc0c0', borderRadius: '6px', fontSize: '12px', color: '#c0392b' }}>
                            ⚠️ {regenError}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ marginTop: '10px', backgroundColor: '#fff', borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
                    <div
                        style={{ padding: '15px', display: 'flex', justifyContent: 'center', color: 'var(--danger)', cursor: 'pointer', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                        onClick={handleClearHistory}
                    >
                        <Trash2 size={18} /> {t('Deep Wipe')}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ChatSettingsDrawer;
import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import TransferModal from './TransferModal';
import RecommendModal from './RecommendModal';
import { Send, Smile, Paperclip, Bell, Users, EyeOff, ShieldBan, Trash, BookOpen, Brain, MoreHorizontal, UserPlus, Gift, Heart, UserMinus, ShieldAlert, BadgeInfo, Eye, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

// Parse /hide 0-xx, /hide xx, /unhide commands
function parseHideCommand(text) {
    const hideRangeMatch = text.match(/^\/hide\s+(\d+)\s*[-~]\s*(\d+)\s*$/i);
    if (hideRangeMatch) return { cmd: 'hide', start: parseInt(hideRangeMatch[1]), end: parseInt(hideRangeMatch[2]) };

    const hideSingleMatch = text.match(/^\/hide\s+(\d+)\s*$/i);
    if (hideSingleMatch) return { cmd: 'hide', start: 0, end: parseInt(hideSingleMatch[1]) };

    const unhideMatch = text.match(/^\/unhide\s*$/i);
    if (unhideMatch) return { cmd: 'unhide' };

    return null;
}

function SystemMessage({ text }) {
    return (
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <span style={{ fontSize: '12px', color: '#aaa', backgroundColor: '#f0f0f0', padding: '3px 10px', borderRadius: '10px' }}>
                {text}
            </span>
        </div>
    );
}

function ChatWindow({ contact, allContacts, apiUrl, newIncomingMessage, engineState, onToggleMemo, onToggleDiary, onToggleSettings, userAvatar, onBack }) {
    const { t, lang } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showHidden, setShowHidden] = useState(false);
    const PAGE_SIZE = 100;
    const prevBlockedRef = useRef(false);
    const messagesEndRef = useRef(null);
    // contactRef keeps the current contact ID stable inside async callbacks
    const contactRef = useRef(contact);
    useEffect(() => { contactRef.current = contact; }, [contact]);

    const isCurrentlyBlocked = engineState?.[contact?.id]?.isBlocked === 1;

    // Fetch most recent messages when contact changes
    useEffect(() => {
        if (!contact?.id) return;
        setMessages([]);
        setHasMore(false);
        fetch(`${apiUrl}/messages/${contact.id}?limit=${PAGE_SIZE}`)
            .then(res => res.json())
            .then(data => {
                setMessages(data);
                // If we got a full page, there are probably more older messages
                setHasMore(data.length >= PAGE_SIZE);
            })
            .catch(err => console.error('Failed to load messages:', err));
    }, [contact?.id, apiUrl]);

    const loadMore = async () => {
        if (loadingMore || messages.length === 0) return;
        setLoadingMore(true);
        const oldest = messages[0];
        try {
            const data = await fetch(
                `${apiUrl}/messages/${contactRef.current?.id}?limit=${PAGE_SIZE}&before=${oldest.id}`
            ).then(r => r.json());
            if (data.length > 0) {
                setMessages(prev => [...data, ...prev]);
                setHasMore(data.length >= PAGE_SIZE);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error('Failed to load more:', e);
        }
        setLoadingMore(false);
    };

    // Handle new incoming WS messages
    useEffect(() => {
        if (newIncomingMessage && contact?.id && newIncomingMessage.character_id === contact.id) {
            setMessages(prev => {
                if (prev.some(m => m.id === newIncomingMessage.id)) return prev;
                return [...prev, newIncomingMessage];
            });
        }
    }, [newIncomingMessage, contact?.id]);

    // Detect when a character goes from unblocked -> blocked mid-session and inject a system message
    useEffect(() => {
        const isBlocked = engineState?.[contact?.id]?.isBlocked === 1;
        if (isBlocked && !prevBlockedRef.current) {
            setMessages(prev => [...prev, {
                id: `block - event - ${Date.now()} `,
                character_id: contact?.id,
                role: 'system',
                content: `[System] ${contact?.name} 将你拉黑了。`,
                timestamp: Date.now()
            }]);
        }
        prevBlockedRef.current = isBlocked;
    }, [engineState, contact?.id, contact?.name]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    const handleSend = async (text) => {
        const currentContactId = contactRef.current?.id;
        if (!currentContactId) return;

        // Check for /hide or /unhide slash commands
        const hideCmd = parseHideCommand(text.trim());
        if (hideCmd) {
            if (hideCmd.cmd === 'hide') {
                const res = await fetch(`${apiUrl}/messages/${currentContactId}/hide`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ startIdx: hideCmd.start, endIdx: hideCmd.end })
                });
                const data = await res.json();
                if (data.success && contactRef.current?.id === currentContactId) {
                    const updated = await fetch(`${apiUrl}/messages/${currentContactId}`).then(r => r.json());
                    setMessages(updated);
                }
            } else if (hideCmd.cmd === 'unhide') {
                const res = await fetch(`${apiUrl}/messages/${currentContactId}/unhide`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (data.success && contactRef.current?.id === currentContactId) {
                    const updated = await fetch(`${apiUrl}/messages/${currentContactId}`).then(r => r.json());
                    setMessages(updated);
                }
            }
            return;
        }

        try {
            const res = await fetch(`${apiUrl}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ characterId: currentContactId, content: text })
            });
            const data = await res.json();
            // Only update state if we're still looking at the same contact
            if (contactRef.current?.id !== currentContactId) return;
            if (data.blocked && data.message) {
                setMessages(prev => [...prev, { ...data.message, isBlocked: true }]);
            }
        } catch (e) {
            console.error('Failed to send:', e);
        }
    };

    const handleTransfer = async (amount, note) => {
        const currentContactId = contactRef.current?.id;
        setIsTransferModalOpen(false);
        try {
            const res = await fetch(`${apiUrl}/characters/${currentContactId}/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, note })
            });
            const data = await res.json();
            if (data.success && contactRef.current?.id === currentContactId) {
                // Refresh messages to pick up the new transfer message with tid
                const updated = await fetch(`${apiUrl}/messages/${currentContactId}`).then(r => r.json());
                setMessages(updated);
            }
        } catch (e) {
            console.error('Transfer failed:', e);
        }
    };

    const handleRecommendContact = async (targetCharId) => {
        setIsRecommendModalOpen(false);
        try {
            const res = await fetch(`${apiUrl}/characters/${contactRef.current?.id}/friends`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetCharId })
            });
            const data = await res.json();
            if (data.success) {
                const updated = await fetch(`${apiUrl}/messages/${contactRef.current?.id}`).then(r => r.json());
                setMessages(updated);
            } else {
                alert(lang === 'en' ? 'Failed to recommend contact: ' + data.error : '推荐联系人失�? ' + data.error);
            }
        } catch (e) {
            console.error('Failed to recommend contact:', e);
            alert(lang === 'en' ? 'Network error.' : '网络错误�?);
        }
    };

    if (!contact) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                <span className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', color: 'var(--accent-color)' }}></span>
            </div>
        );
    }

    const hiddenCount = messages.filter(m => m.hidden).length;
    // Always show all messages to the user. Hidden = dimmed (AI won't see them).
    // showHidden controls whether the dim effect + badge are visible or not.

    return (
        <>
            <div className="chat-header">
                <div className="chat-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="mobile-back-btn" onClick={onBack} title="Back">
                        <ChevronLeft size={24} />
                    </button>
                    {contact.name}
                    {engineState?.[contact.id]?.isBlocked === 1 && <span style={{ color: 'var(--danger)', fontSize: '14px', fontWeight: 'bold' }}>(Blocked) 🚫</span>}
                </div>
                <div className="chat-header-actions">
                    <button onClick={() => setIsRecommendModalOpen(true)} title={lang === 'en' ? 'Recommend Contact' : '推荐联系�?}>
                        <UserPlus size={20} />
                    </button>
                    <button onClick={onToggleMemo} title={t('Memories')}>
                        <Brain size={20} />
                    </button>
                    <button onClick={onToggleDiary} title={t('Secret Diary')}>
                        <BookOpen size={20} />
                    </button>
                    <button onClick={onToggleSettings} title={t('Chat Settings')}>
                        <MoreHorizontal size={20} />
                    </button>
                </div>
            </div>

            {hiddenCount > 0 && (
                <div
                    style={{ display: 'flex', justifyContent: 'center', padding: '5px', background: '#fff9e0', cursor: 'pointer', fontSize: '12px', color: '#888', gap: '5px', alignItems: 'center', borderBottom: '1px solid #f0e8c0' }}
                    onClick={() => setShowHidden(h => !h)}
                >
                    {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                    {hiddenCount} messages hidden from AI context (shown dimmed) �?click to {showHidden ? 'show badges' : 'hide badges'}
                </div>
            )}

            {isCurrentlyBlocked && (
                <div style={{ textAlign: 'center', padding: '8px', background: '#ffebeb', color: 'var(--danger)', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #ffcccc' }}>
                    You are blocked by {contact.name}. You cannot send messages.
                </div>
            )}

            <div className="chat-history">
                {hasMore && (
                    <div style={{ textAlign: 'center', padding: '10px' }}>
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            style={{
                                fontSize: '12px', color: '#888', background: '#f5f5f5',
                                border: '1px solid #ddd', borderRadius: '12px',
                                padding: '5px 16px', cursor: 'pointer'
                            }}
                        >
                            {loadingMore ? t('Loading') : (lang === 'en' ? '�?Load older messages' : '�?加载更早的消�?)}
                        </button>
                    </div>
                )}
                {messages.map((msg, idx) => {
                    if (idx > 0 && messages[idx - 1].id === msg.id) return null;
                    return (
                        <div key={msg.id} style={msg.hidden ? {
                            opacity: 0.4, filter: 'grayscale(0.5)',
                            borderLeft: '3px solid #f0c060', paddingLeft: '4px',
                            marginBottom: '2px'
                        } : {}}>
                            <MessageBubble
                                message={msg}
                                characterName={contact.name}
                                avatar={msg.role === 'character' ? contact.avatar : (userAvatar || 'https://api.dicebear.com/7.x/shapes/svg?seed=User')}
                                apiUrl={apiUrl}
                            />
                        </div>
                    );
                })}
                {engineState?.[contact.id]?.countdownMs > 0 && engineState?.[contact.id]?.isBlocked !== 1 && (
                    <div className="message-wrapper character" style={{ marginTop: '10px' }}>
                        <div className="message-avatar" style={{ visibility: 'hidden' }}>
                            <img src={contact.avatar} alt="Avatar" />
                        </div>
                        <div className="message-content">
                            <div className="message-bubble" style={{ background: 'transparent', color: '#bbb', boxShadow: 'none', fontStyle: 'italic', padding: 0 }}>
                                {t('Thinking')} �?{Math.ceil(engineState[contact.id].countdownMs / 1000)}s
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <InputBar
                onSend={handleSend}
                onTransfer={() => setIsTransferModalOpen(true)}
                onQuickHide={async () => {
                    const cid = contactRef.current?.id;
                    if (!cid) return;
                    const all = messages;
                    const half = Math.floor(all.length / 2);
                    if (half === 0) return;
                    const res = await fetch(`${apiUrl}/messages/${cid}/hide`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ startIdx: 0, endIdx: half - 1 })
                    });
                    if ((await res.json()).success && contactRef.current?.id === cid) {
                        const updated = await fetch(`${apiUrl}/messages/${cid}`).then(r => r.json());
                        setMessages(updated);
                    }
                }}
            />
            {isTransferModalOpen && (
                <TransferModal
                    contact={contact}
                    onClose={() => setIsTransferModalOpen(false)}
                    onConfirm={handleTransfer}
                />
            )}
            {isRecommendModalOpen && (
                <RecommendModal
                    apiUrl={apiUrl}
                    currentContact={contact}
                    allContacts={allContacts || []}
                    onClose={() => setIsRecommendModalOpen(false)}
                    onRecommend={handleRecommendContact}
                />
            )}
        </>
    );
}

export default ChatWindow;
import React from 'react';

function ContactList({ contacts, activeId, onSelect, engineState = {} }) {
    return (
        <>
            {contacts.map((contact) => {
                const state = engineState[contact.id];
                const countdown = state?.countdownMs ? Math.ceil(state.countdownMs / 1000) : null;

                return (
                    <div
                        key={contact.id}
                        className={`contact-item ${activeId === contact.id ? 'active' : ''}`}
                        onClick={() => onSelect(contact.id)}
                    >
                        <div className="contact-avatar" style={{ position: 'relative' }}>
                            <img src={contact.avatar} alt={contact.name} />
                            <div className={`autopulse-status-dot ${state?.isThinking ? 'thinking' : 'connected'}`} />
                        </div>
                        <div className="contact-info">
                            <div className="contact-header">
                                <span className="contact-name">{contact.name}</span>
                                <span className="contact-time" style={{ color: countdown ? (state?.isThinking ? '#ff9800' : 'var(--accent-color)') : undefined, fontWeight: countdown ? 'bold' : 'normal' }}>
                                    {countdown ? (state?.isThinking ? '✍️...' : `�?${countdown}s`) : contact.time}
                                </span>
                            </div>
                            <div className="contact-last-msg">
                                {contact.lastMessage}
                                {contact.unread > 0 && <span className="unread-badge">{contact.unread}</span>}
                                {state?.isBlocked === 1 && <span style={{ marginLeft: 5, color: 'var(--danger)' }} title="Blocked">🚫</span>}
                            </div>
                        </div>
                    </div>
                )
            })}
        </>
    );
}

export default ContactList;
import React, { useState } from 'react';
import { X, CheckCircle2, Search } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function CreateGroupModal({ apiUrl, contacts, onClose, onCreate }) {
    const { lang } = useLanguage();
    const [groupName, setGroupName] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [creating, setCreating] = useState(false);

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleCreate = async () => {
        if (!groupName.trim() || selectedIds.length === 0) return;
        setCreating(true);
        try {
            const res = await fetch(`${apiUrl}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: groupName.trim(), member_ids: selectedIds })
            });
            const data = await res.json();
            if (data.success) {
                onCreate(data.group);
            }
        } catch (e) {
            console.error('Failed to create group:', e);
        }
        setCreating(false);
    };

    const filtered = contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '420px', padding: 0 }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>
                        {lang === 'en' ? 'Create Group Chat' : '发起群聊'}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="#999" />
                    </button>
                </div>

                <div style={{ padding: '15px 20px' }}>
                    <input
                        type="text"
                        placeholder={lang === 'en' ? 'Group Name' : '群聊名称'}
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', marginBottom: '12px' }}
                    />

                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <Search size={16} color="#aaa" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                        <input
                            type="text"
                            placeholder={lang === 'en' ? 'Search contacts...' : '搜索联系�?..'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                        />
                    </div>

                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {filtered.map(c => (
                            <div
                                key={c.id}
                                onClick={() => toggleSelect(c.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', padding: '8px',
                                    borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                                    backgroundColor: selectedIds.includes(c.id) ? '#f0f9eb' : 'transparent',
                                    borderRadius: '6px'
                                }}
                            >
                                <img src={c.avatar} alt={c.name} style={{ width: '36px', height: '36px', borderRadius: '50%', marginRight: '10px' }} />
                                <div style={{ flex: 1, fontWeight: '500', fontSize: '14px' }}>{c.name}</div>
                                {selectedIds.includes(c.id) && <CheckCircle2 size={18} color="var(--accent-color)" />}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={!groupName.trim() || selectedIds.length === 0 || creating}
                        style={{
                            width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginTop: '15px',
                            backgroundColor: (groupName.trim() && selectedIds.length > 0) ? 'var(--accent-color)' : '#e0e0e0',
                            color: (groupName.trim() && selectedIds.length > 0) ? '#fff' : '#999',
                            fontWeight: '500', fontSize: '15px', cursor: (groupName.trim() && selectedIds.length > 0) ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {creating ? '...' : (lang === 'en' ? `Create (${selectedIds.length} selected)` : `创建 (${selectedIds.length} �?`)}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupModal;
import React, { useState, useEffect } from 'react';
import { BookOpen, X, Lock, KeyRound, Eye } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function DiaryTable({ contact, apiUrl, onClose }) {
    const { t, lang } = useLanguage();
    const [diaries, setDiaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [pwError, setPwError] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    useEffect(() => {
        if (!contact) return;
        fetch(`${apiUrl}/diaries/${contact.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.entries !== undefined) {
                    setDiaries(data.entries);
                    setIsUnlocked(data.isUnlocked);
                } else {
                    setDiaries(data);
                    setIsUnlocked(data.length > 0 && data[0].is_unlocked === 1);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load diaries:', err);
                setLoading(false);
            });
    }, [apiUrl, contact, contact?.id]);

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!passwordInput.trim()) return;
        setPwLoading(true);
        setPwError('');
        try {
            const res = await fetch(`${apiUrl}/diaries/${contact.id}/unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: passwordInput.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setIsUnlocked(true);
                setDiaries(prev => prev.map(d => ({ ...d, is_unlocked: 1 })));
            } else {
                setPwError(data.reason || 'Wrong password.');
            }
        } catch {
            setPwError('Network error. Try again.');
        }
        setPwLoading(false);
    };

    return (
        <div className="memory-drawer" style={{ width: '380px', backgroundColor: '#fffdf5' }}>
            <div className="memory-header" style={{ backgroundColor: '#f6f1e3', borderBottomColor: '#e0d8c3' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5a4d3c' }}>
                    <BookOpen size={18} />
                    {contact.name} {lang === 'en' ? "'s Diary" : "的日�?}
                </h3>
                <button className="icon-btn" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            <div className="memory-list" style={{ padding: '20px' }}>
                {loading ? (
                    <div className="placeholder-text">{t('Loading')}</div>
                ) : !isUnlocked ? (
                    <div style={{ textAlign: 'center', marginTop: '30px' }}>
                        <Lock size={48} color="#d4a96a" style={{ marginBottom: '12px' }} />
                        <div style={{ color: '#5a4d3c', fontWeight: 'bold', fontSize: '16px', marginBottom: '6px' }}>
                            {t('Diary Locked')}
                        </div>
                        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '24px', padding: '0 20px' }}>
                            {lang === 'en' ? `Build your bond with ${contact.name} and get them to reveal their password.` : `�?${contact.name} 培养亲密度，并试着让对方告诉你密码吧。`}
                        </div>

                        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', width: '100%', maxWidth: '240px' }}>
                                <KeyRound size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#bbb' }} />
                                <input
                                    type="text"
                                    value={passwordInput}
                                    onChange={e => { setPasswordInput(e.target.value); setPwError(''); }}
                                    placeholder={lang === 'en' ? "Enter diary password..." : "输入日记密码..."}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        padding: '9px 12px 9px 32px', borderRadius: '8px',
                                        border: pwError ? '1.5px solid var(--danger)' : '1.5px solid #e0d8c3',
                                        background: '#fff', fontSize: '14px', outline: 'none',
                                        color: '#333', letterSpacing: '1px'
                                    }}
                                />
                            </div>
                            {pwError && (
                                <div style={{ color: 'var(--danger)', fontSize: '12px' }}>{pwError}</div>
                            )}
                            <button
                                type="submit"
                                disabled={pwLoading || !passwordInput.trim()}
                                style={{
                                    padding: '8px 24px', borderRadius: '8px', border: 'none',
                                    background: '#d4a96a', color: '#fff', fontWeight: '600',
                                    fontSize: '14px', cursor: 'pointer', opacity: pwLoading ? 0.6 : 1
                                }}
                            >
                                {pwLoading ? (lang === 'en' ? 'Checking...' : '验证�?..') : t('Unlock Diary')}
                            </button>
                        </form>

                        <div style={{ marginTop: '20px', fontSize: '11px', color: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            <Eye size={11} /> {lang === 'en' ? `Hint: Ask ${contact.name} directly in chat.` : `提示：试着在聊天中直接询问 ${contact.name}。`}
                        </div>
                    </div>
                ) : diaries.length === 0 ? (
                    <div className="empty-text">{t('No entries yet')}</div>
                ) : (
                    diaries.map(diary => {
                        const dateObj = new Date(diary.timestamp);
                        const dateStr = dateObj.toLocaleDateString();
                        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                            <div key={diary.id} className="diary-entry" style={{
                                backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px',
                                padding: '15px', marginBottom: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                            }}>
                                <div className="diary-meta" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#999', fontSize: '13px' }}>
                                    <span>{dateStr} {timeStr}</span>
                                    {diary.emotion && <span style={{ textTransform: 'capitalize' }}>{diary.emotion}</span>}
                                </div>
                                <div className="diary-content" style={{ color: '#333', lineHeight: '1.6', fontSize: '15px', whiteSpace: 'pre-wrap' }}>
                                    {diary.content}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default DiaryTable;
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Smile, Paperclip, X, Settings, Trash2, UserMinus, ArrowRightLeft, Gift, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const quickEmojis = ['😀', '😂', '🥺', '😡', '🥰', '👍', '🙏', '💔', '🔥', '�?, '🥳', '😭', '😎', '🙄', '🤔'];

/* ─── Red Packet Send Modal ─── */
function RedPacketModal({ group, apiUrl, onClose, userWallet }) {
    const { lang } = useLanguage();
    const [type, setType] = useState('lucky');
    const [amount, setAmount] = useState('');
    const [count, setCount] = useState(group?.members?.length || 3);
    const [note, setNote] = useState('');
    const isFixed = type === 'fixed';
    const cnt = Math.max(1, parseInt(count) || 1);
    const amt = Math.max(0, parseFloat(amount) || 0);
    const totalCost = isFixed ? amt * cnt : amt;
    const overBudget = totalCost > (userWallet ?? 100);
    const isValid = amt > 0 && cnt > 0 && !overBudget;

    const onSend = async () => {
        if (!isValid) return;
        try {
            const payload = isFixed
                ? { type, count: cnt, per_amount: amt, total_amount: totalCost, note: note.trim() }
                : { type, count: cnt, total_amount: totalCost, note: note.trim() };

            await fetch(`${apiUrl}/groups/${group.id}/redpackets`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            onClose();
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ width: '340px', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', background: '#fff' }}>
                <div style={{ background: 'linear-gradient(135deg,#d63031,#c0392b)', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontWeight: '700', fontSize: '17px' }}>🧧 {lang === 'en' ? 'Send Red Packet' : '发送红�?}</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffcccb', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
                    {[['lucky', lang === 'en' ? '🎲 Lucky' : '🎲 拼手�?], ['fixed', lang === 'en' ? '📦 Regular' : '📦 普�?]].map(([t, label]) => (
                        <button key={t} onClick={() => setType(t)}
                            style={{
                                flex: 1, padding: '10px', border: 'none', cursor: 'pointer', fontWeight: type === t ? '700' : '400',
                                background: type === t ? '#fff5f5' : '#fff', color: type === t ? '#c0392b' : '#666', borderBottom: type === t ? '2px solid #c0392b' : '2px solid transparent'
                            }}>
                            {label}
                        </button>
                    ))}
                </div>
                <div style={{ padding: '16px 20px' }}>
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: '5px' }}>{lang === 'en' ? 'Number of packets' : '红包个数'}</label>
                        <input type="number" min="1" value={count} onChange={e => setCount(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '16px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: '5px' }}>
                            {isFixed ? (lang === 'en' ? 'Amount per person (¥)' : '每人金额（元�?) : (lang === 'en' ? 'Total amount (¥)' : '总金额（元）')}
                        </label>
                        <input type="number" min="0.01" step="0.01" placeholder="¥" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '16px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '12px', color: '#999', display: 'block', marginBottom: '5px' }}>{lang === 'en' ? 'Message (optional)' : '留言（可选）'}</label>
                        <input type="text" placeholder={lang === 'en' ? 'Leave a message...' : '写点什�?..'} value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '14px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ background: '#fafafa', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                            <span>{lang === 'en' ? 'Total cost:' : '合计�?}</span>
                            <span style={{ fontWeight: '600', color: totalCost > 0 ? '#c0392b' : '#aaa' }}>¥{totalCost > 0 ? totalCost.toFixed(2) : '0.00'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', marginTop: '4px' }}>
                            <span>{lang === 'en' ? 'My wallet:' : '我的余额�?}</span>
                            <span style={{ color: overBudget ? '#e53935' : 'var(--accent-color)' }}>¥{(userWallet ?? 0).toFixed(2)}</span>
                        </div>
                        {overBudget && <div style={{ color: '#e53935', fontSize: '12px', marginTop: '6px' }}>⚠️ {lang === 'en' ? 'Insufficient balance' : '余额不足'}</div>}
                    </div>
                    <button onClick={onSend} disabled={!isValid}
                        style={{ width: '100%', padding: '13px', background: isValid ? 'linear-gradient(135deg,#d63031,#c0392b)' : '#ccc', color: '#fff', border: 'none', borderRadius: '10px', cursor: isValid ? 'pointer' : 'not-allowed', fontSize: '15px', fontWeight: '700' }}>
                        {lang === 'en' ? '🧧 Send' : '🧧 塞钱进红�?}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Red Packet Card (parsed from [REDPACKET:id] in content) ─── */
function RedPacketCard({ packetId, apiUrl, groupId, isUser, resolveSender }) {
    const { lang } = useLanguage();
    const [pkt, setPkt] = useState(null);
    const [showDetail, setShowDetail] = useState(false);

    const loadPkt = useCallback(async () => {
        try { const r = await fetch(`${apiUrl}/groups/${groupId}/redpackets/${packetId}`); setPkt(await r.json()); } catch (e) { console.error(e); }
    }, [apiUrl, groupId, packetId]);
    useEffect(() => { if (packetId) loadPkt(); }, [packetId, loadPkt]);

    const handleClaim = async () => {
        try {
            await fetch(`${apiUrl}/groups/${groupId}/redpackets/${packetId}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claimer_id: 'user' })
            });
            loadPkt();
        } catch (e) { console.error(e); }
    };

    if (!pkt) return <div style={{ padding: '8px', color: '#aaa', fontSize: '13px' }}>🧧 Loading...</div>;
    const isExpired = pkt.claims?.length >= pkt.count;
    const userClaimed = pkt.claims?.some(c => c.claimer_id === 'user');

    return (
        <div style={{ background: 'linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%)', borderRadius: '12px', padding: '12px 15px', width: '220px', boxSizing: 'border-box', border: '1px solid #ffccbc', cursor: 'pointer' }}
            onClick={() => setShowDetail(!showDetail)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px' }}>🧧</span>
                <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#c0392b' }}>{pkt.note || (lang === 'en' ? 'Red Packet' : '红包')}</div>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                        {pkt.type === 'fixed' ? (lang === 'en' ? 'Regular' : '普通红�?) : (lang === 'en' ? 'Lucky' : '拼手气红�?)}
                        {' · '}{pkt.claims?.length || 0}/{pkt.count}
                    </div>
                </div>
            </div>
            {!isExpired && !userClaimed && (
                <button onClick={e => { e.stopPropagation(); handleClaim(); }}
                    style={{ width: '100%', padding: '8px', background: '#fff0eb', color: '#e67e22', border: '1px solid #ffd4a8', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                    {lang === 'en' ? '🧧 Open' : '🧧 拆红�?}
                </button>
            )}
            {(isExpired || userClaimed) && (
                <div style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>
                    {userClaimed ? (lang === 'en' ? '�?Claimed' : '�?已领�?) : (lang === 'en' ? 'All claimed' : '已抢�?)}
                </div>
            )}
            {showDetail && (
                <div style={{ background: '#fff8f0', borderRadius: '10px', padding: '10px 12px', marginTop: '6px', border: '1px solid #ffe0b2' }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{lang === 'en' ? 'Claims:' : '领取记录'}</span>
                        <span>¥{pkt.total_amount?.toFixed(2)} {lang === 'en' ? 'total' : '总计'}</span>
                    </div>
                    {(!pkt.claims || pkt.claims.length === 0) && <div style={{ fontSize: '12px', color: '#bbb' }}>{lang === 'en' ? 'No one yet' : '暂无人领�?}</div>}
                    {pkt.claims?.map((c, i) => {
                        const s = resolveSender(c.claimer_id);
                        return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <img src={s.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                                <span style={{ fontSize: '13px', flex: 1 }}>{s.name}</span>
                                <span style={{ fontSize: '13px', color: '#c0392b', fontWeight: '600' }}>¥{c.amount?.toFixed(2)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ─── Right-side Group Management Drawer ─── */
function GroupManageDrawer({ group, apiUrl, resolveSender, onClose, lang }) {
    const [noChain, setNoChain] = useState(false);

    useEffect(() => {
        if (!group) return;
        fetch(`${apiUrl}/groups/${group.id}/no-chain`).then(r => r.json()).then(d => setNoChain(!!d.no_chain)).catch(() => { });
    }, [group, apiUrl]);


    const toggleNoChain = async () => {
        const v = !noChain; setNoChain(v);
        fetch(`${apiUrl}/groups/${group.id}/no-chain`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ no_chain: v }) });
    };
    const clearMessages = () => { if (window.confirm(lang === 'en' ? 'Clear all messages?' : '清空所有消息？')) fetch(`${apiUrl}/groups/${group.id}/messages`, { method: 'DELETE' }).then(() => window.location.reload()); };
    const dissolveGroup = () => { if (window.confirm(lang === 'en' ? 'Dissolve this group?' : '解散此群�?)) fetch(`${apiUrl}/groups/${group.id}`, { method: 'DELETE' }).then(() => window.location.reload()); };
    const kickMember = (mid) => { if (window.confirm(lang === 'en' ? 'Remove this member?' : '移除此成员？')) fetch(`${apiUrl}/groups/${group.id}/members/${mid}`, { method: 'DELETE' }).then(() => window.location.reload()); };


    return (
        <div style={{ width: '280px', minWidth: '280px', backgroundColor: '#f7f7f7', borderLeft: '1px solid #eee', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ padding: '12px 15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Settings size={16} /> {lang === 'en' ? 'Group Management' : '群管�?}
                </h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={18} /></button>
            </div>

            {/* Members */}
            <div style={{ backgroundColor: '#fff', padding: '12px 15px', borderBottom: '1px solid #eee' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '10px', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'Members' : '群成�?} ({group.members?.length || 0})
                </div>
                {group.members?.map(memberObj => {
                    const mid = memberObj.member_id || memberObj;
                    const m = resolveSender(mid);
                    return (
                        <div key={mid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
                            <img src={m.avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                            <span style={{ flex: 1, fontSize: '13px' }}>{m.name}</span>
                            {mid !== 'user' && (
                                <button onClick={() => kickMember(mid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }} title={lang === 'en' ? 'Remove member from group' : '将该成员踢出群聊'}>
                                    <UserMinus size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* AI Controls */}
            <div style={{ backgroundColor: '#fff', padding: '12px 15px', borderBottom: '1px solid #eee', marginTop: '8px' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '10px', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'AI Controls' : 'AI 控制'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                    <span>{lang === 'en' ? '�?Prevent AI Chaining' : '�?禁止AI互相接话'}</span>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                        <input type="checkbox" checked={noChain} onChange={toggleNoChain} style={{ opacity: 0, width: 0, height: 0 }} />
                        <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: noChain ? 'var(--accent-color)' : '#ccc', borderRadius: '24px', transition: '0.3s' }}>
                            <span style={{ position: 'absolute', height: '18px', width: '18px', left: noChain ? '23px' : '3px', bottom: '3px', backgroundColor: 'white', borderRadius: '50%', transition: '0.3s' }} />
                        </span>
                    </label>
                </div>
            </div>

            {/* Danger Zone */}
            <div style={{ backgroundColor: '#fff', padding: '12px 15px', marginTop: '8px' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '10px', textTransform: 'uppercase' }}>
                    {lang === 'en' ? 'Danger Zone' : '危险操作'}
                </div>
                <button onClick={clearMessages} title={lang === 'en' ? 'Delete all messages in this group' : '清空群聊中的所有消�?} style={{ width: '100%', padding: '10px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Trash2 size={14} /> {lang === 'en' ? 'Clear Messages' : '清空消息'}
                </button>
                <button onClick={dissolveGroup} title={lang === 'en' ? 'Permanently dissolve this group chat' : '永久解散此群�?} style={{ width: '100%', padding: '10px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    💥 {lang === 'en' ? 'Dissolve Group' : '解散群聊'}
                </button>
            </div>
        </div>
    );
}

/* ─── Main GroupChatWindow ─── */
function GroupChatWindow({ group, apiUrl, allContacts, userProfile, newGroupMessage, typingIndicators, onBack }) {
    const { lang } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showRedPacketModal, setShowRedPacketModal] = useState(false);
    const [showManageDrawer, setShowManageDrawer] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    // Mentions logic
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    useEffect(() => {
        if (!group?.id) return;
        setMessages([]); setShowManageDrawer(false);
        fetch(`${apiUrl}/groups/${group.id}/messages`).then(r => r.json()).then(setMessages).catch(console.error);
    }, [group?.id, apiUrl]);

    useEffect(() => {
        if (newGroupMessage && group?.id && newGroupMessage.group_id === group.id) {
            setMessages(prev => prev.find(m => m.id === newGroupMessage.id) ? prev : [...prev, newGroupMessage]);
        }
    }, [newGroupMessage, group?.id]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !group) return;
        const text = input.trim(); setInput('');
        try { await fetch(`${apiUrl}/groups/${group.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text }) }); } catch (e) { console.error(e); }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        e.target.value = '';
        if (file.size > 100 * 1024) { alert(lang === 'en' ? `File too large (${(file.size / 1024).toFixed(1)} KB). Max 100 KB.` : `文件太大。最�?100 KB。`); return; }
        const reader = new FileReader();
        reader.onload = (ev) => { const snippet = `📄 [${file.name}]\n${ev.target.result}`; setInput(prev => prev ? prev + '\n' + snippet : snippet); };
        reader.onerror = () => alert(lang === 'en' ? 'Failed to read file' : '读取文件失败');
        reader.readAsText(file, 'utf-8');
    };

    const resolveSender = (senderId) => {
        if (senderId === 'user') return { name: userProfile?.name || 'User', avatar: userProfile?.avatar || 'https://api.dicebear.com/7.x/shapes/svg?seed=User' };
        const char = allContacts?.find(c => String(c.id) === String(senderId));
        return char || { name: senderId, avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${senderId}` };
    };

    const addEmoji = (emoji) => { setInput(prev => prev + emoji); setShowEmojiPicker(false); };

    // --- MENTION HANDLERS ---
    const availableMentions = React.useMemo(() => {
        if (!group) return [];
        const base = [{ id: 'all', name: lang === 'en' ? 'All' : '全体成员', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=All' }];
        if (group.members) {
            group.members.forEach(memberObj => {
                const mid = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                if (mid !== 'user') base.push(resolveSender(mid));
            });
        }
        return base.filter(m => m.name.toLowerCase().includes(mentionFilter.toLowerCase()));
    }, [group, mentionFilter, allContacts, lang]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);
        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.substring(0, cursor);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || /[\\s\\n]/.test(textBeforeCursor[lastAtIndex - 1]))) {
            const query = textBeforeCursor.substring(lastAtIndex + 1);
            if (!/\\s/.test(query)) {
                setMentionFilter(query);
                setShowMentionMenu(true);
                setMentionIndex(0);
                return;
            }
        }
        setShowMentionMenu(false);
    };

    const handleMentionSelect = (member) => {
        const cursor = textareaRef.current?.selectionStart || input.length;
        const textBeforeCursor = input.substring(0, cursor);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            const beforeMention = input.substring(0, lastAtIndex);
            const afterMention = input.substring(cursor);
            const newText = beforeMention + `@${member.name} ` + afterMention;
            setInput(newText);
            setTimeout(() => {
                if (textareaRef.current) {
                    const newPos = lastAtIndex + member.name.length + 2;
                    textareaRef.current.setSelectionRange(newPos, newPos);
                    textareaRef.current.focus();
                }
            }, 0);
        }
        setShowMentionMenu(false);
    };

    const handleKeyDown = (e) => {
        if (showMentionMenu && availableMentions.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(p => Math.min(p + 1, availableMentions.length - 1)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(p => Math.max(p - 1, 0)); return; }
            if (e.key === 'Enter') { e.preventDefault(); handleMentionSelect(availableMentions[mentionIndex]); return; }
            if (e.key === 'Escape') { setShowMentionMenu(false); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };
    // ------------------------


    // Parse message content to detect special types
    const parseContent = (content) => {
        if (!content) return { type: 'text', text: '' };
        // Red packet: [REDPACKET:123]
        const rpMatch = content.trim().match(/^\[REDPACKET:(\d+)\]\s*$/);
        if (rpMatch) return { type: 'redpacket', packetId: parseInt(rpMatch[1]) };
        // Transfer: [TRANSFER] amount | note
        if (content.startsWith('[TRANSFER]')) return { type: 'transfer', content };
        // System
        if (content.startsWith('[System]')) return { type: 'system', text: content.replace('[System] ', '') };
        return { type: 'text', text: content };
    };

    if (!group) return null;

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minWidth: 0 }}>
                {/* Header */}
                <div className="chat-header">
                    <div className="chat-header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="mobile-back-btn" onClick={onBack} title="Back">
                            <ChevronLeft size={24} />
                        </button>
                        <Users size={20} />
                        {group.name}
                        <span style={{ fontSize: '12px', color: '#999' }}>({group.members?.length || 0})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button onClick={() => setShowManageDrawer(!showManageDrawer)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: showManageDrawer ? 'var(--danger)' : 'var(--accent-color)' }}
                            title={lang === 'en' ? 'Group management �?members, AI controls, danger zone' : '群管�?�?成员、AI 控制、危险操�?}>
                            <Settings size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chat-history">
                    {messages.map(msg => {
                        const sender = resolveSender(msg.sender_id);
                        const isUser = msg.sender_id === 'user';
                        const parsed = parseContent(msg.content);

                        // System message
                        if (msg.sender_id === 'system' || parsed.type === 'system') {
                            return (
                                <div key={msg.id} style={{ textAlign: 'center', margin: '8px 0' }}>
                                    <span style={{ fontSize: '12px', color: '#aaa', backgroundColor: '#f0f0f0', padding: '3px 10px', borderRadius: '10px' }}>
                                        {parsed.text || (msg.content || '').replace('[System] ', '')}
                                    </span>
                                </div>
                            );
                        }

                        // Red packet
                        if (parsed.type === 'redpacket') {
                            return (
                                <div key={msg.id} className={`message-wrapper ${isUser ? 'user' : 'character'}`}>
                                    <div className="message-avatar"><img src={sender.avatar} alt="" /></div>
                                    <div className="message-content">
                                        {!isUser && <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '2px', fontWeight: '500' }}>{sender.name}</div>}
                                        <RedPacketCard packetId={parsed.packetId} apiUrl={apiUrl} groupId={group.id} isUser={isUser} resolveSender={resolveSender} />
                                        {msg.timestamp && (
                                            <div style={{
                                                fontSize: '11px', color: '#bbb', marginTop: '4px',
                                                display: 'flex', gap: '6px', alignItems: 'center',
                                                justifyContent: isUser ? 'flex-end' : 'flex-start'
                                            }}>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        // Transfer
                        if (parsed.type === 'transfer') {
                            const raw = parsed.content.replace('[TRANSFER]', '').trim();
                            const parts = raw.split('|');
                            const amount = parts[0].trim();
                            const note = parts.length > 1 ? parts.slice(1).join('|').trim() : 'Transfer';
                            return (
                                <div key={msg.id} className={`message-wrapper ${isUser ? 'user' : 'character'}`}>
                                    <div className="message-avatar"><img src={sender.avatar} alt="" /></div>
                                    <div className="message-content">
                                        {!isUser && <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '2px', fontWeight: '500' }}>{sender.name}</div>}
                                        <div className="message-bubble transfer-bubble">
                                            <div className="transfer-icon-area"><ArrowRightLeft size={24} color="#fff" /></div>
                                            <div className="transfer-text-area">
                                                <div className="transfer-amount">¥{amount}</div>
                                                <div className="transfer-note">{note}</div>
                                            </div>
                                        </div>
                                        {msg.timestamp && (
                                            <div style={{
                                                fontSize: '11px', color: '#bbb', marginTop: '4px',
                                                display: 'flex', gap: '6px', alignItems: 'center',
                                                justifyContent: isUser ? 'flex-end' : 'flex-start'
                                            }}>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        // Normal message
                        return (
                            <div key={msg.id} className={`message-wrapper ${isUser ? 'user' : 'character'}`}>
                                <div className="message-avatar"><img src={sender.avatar} alt="" /></div>
                                <div className="message-content">
                                    {!isUser && <div style={{ fontSize: '12px', color: 'var(--accent-color)', marginBottom: '2px', fontWeight: '500' }}>{sender.name}</div>}
                                    <div className="message-bubble">{msg.content}</div>
                                    {msg.timestamp && (
                                        <div style={{
                                            fontSize: '11px', color: '#bbb', marginTop: '4px',
                                            display: 'flex', gap: '6px', alignItems: 'center',
                                            justifyContent: isUser ? 'flex-end' : 'flex-start'
                                        }}>
                                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Typing indicators and Interrupt Button */}
                {(typingIndicators.length > 0) && (
                    <div style={{ padding: '4px 15px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ color: '#999', fontSize: '13px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>�?/span>
                            {typingIndicators.map(t => t.name).join(', ')} {lang === 'en' ? 'typing...' : '正在输入�?..'}
                        </div>
                        <button
                            onClick={async () => {
                                // Instantly interrupt AIs
                                await fetch(`${apiUrl}/groups/${group.id}/ai-pause`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: true }) });
                                // Automatically unpause after 10 seconds or when user sends a message
                                setTimeout(() => {
                                    fetch(`${apiUrl}/groups/${group.id}/ai-pause`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: false }) });
                                }, 10000);
                            }}
                            title={lang === 'en' ? 'Interrupt AIs and stop them from chaining texts' : '打断 AI 的连续发言'}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px', background: '#fff0f0', border: '1px solid #ffcccc', color: 'var(--danger)',
                                padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 5px rgba(240,107,142,0.1)'
                            }}
                        >
                            �?{lang === 'en' ? 'Interrupt' : '打断'}
                        </button>
                    </div>
                )}

                {/* Input area �?matches private chat InputBar style */}
                <div className="input-area">
                    <div className="input-toolbar" style={{ position: 'relative' }}>
                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} title={lang === 'en' ? 'Insert emoji' : '插入表情'}><Smile size={20} /></button>
                        <button onClick={() => fileInputRef.current?.click()} title={lang === 'en' ? 'Send file' : '发送文�?}><Paperclip size={20} /></button>
                        <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,.log,.py,.js,.ts,.html,.css,.xml,.yaml,.yml" style={{ display: 'none' }} onChange={handleFileChange} />
                        <button onClick={() => setShowRedPacketModal(true)} title={lang === 'en' ? 'Send red packet �?lucky money for group' : '发红�?�?给群友发财运'}>
                            <Gift size={20} color="var(--danger)" />
                        </button>

                        {showEmojiPicker && (
                            <div className="emoji-picker" style={{ position: 'absolute', bottom: '50px', left: '10px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px', width: '220px', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)', zIndex: 100 }}>
                                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
                                    <button onClick={() => setShowEmojiPicker(false)} style={{ padding: '2px' }}><X size={14} /></button>
                                </div>
                                {quickEmojis.map(e => (
                                    <span key={e} onClick={() => addEmoji(e)} style={{ fontSize: '20px', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>{e}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="input-textarea-wrapper" style={{ position: 'relative' }}>
                        {showMentionMenu && availableMentions.length > 0 && (
                            <div className="mention-menu" style={{ position: 'absolute', bottom: '100%', left: 0, backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '6px 0', width: '240px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginBottom: '8px' }}>
                                {availableMentions.map((m, i) => (
                                    <div key={m.id} onClick={() => handleMentionSelect(m)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 15px', cursor: 'pointer', backgroundColor: i === mentionIndex ? '#f0f9eb' : 'transparent' }} onMouseEnter={() => setMentionIndex(i)}>
                                        <img src={m.avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                                        <span style={{ fontSize: '14px', fontWeight: '500', color: i === mentionIndex ? 'var(--accent-color)' : '#333' }}>{m.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <textarea
                            ref={textareaRef}
                            className="input-textarea"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={lang === 'en' ? 'Type a message...' : '输入消息...'}
                        />
                    </div>
                    <div className="input-actions">
                        <button className="send-button" onClick={handleSend}>{lang === 'en' ? 'Send' : '发�?}</button>
                    </div>
                </div>
            </div>

            {showManageDrawer && (
                <GroupManageDrawer group={group} apiUrl={apiUrl} resolveSender={resolveSender}
                    onClose={() => setShowManageDrawer(false)} lang={lang} />
            )}

            {/* Red Packet Modal */}
            {showRedPacketModal && (
                <RedPacketModal group={group} apiUrl={apiUrl} onClose={() => setShowRedPacketModal(false)} userWallet={userProfile?.wallet ?? 100} />
            )}
        </>
    );
}

export default GroupChatWindow;
import React, { useState, useRef } from 'react';
import { Smile, Paperclip, CreditCard, X, EyeOff } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function InputBar({ onSend, onTransfer, onQuickHide }) {
    const { t, lang } = useLanguage();
    const [text, setText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const fileInputRef = useRef(null);

    const emojis = ['😀', '😂', '🥺', '😡', '🥰', '👍', '🙏', '💔', '🔥', '�?, '🥳', '😭', '😎', '🙄', '🤔'];

    const addEmoji = (emoji) => {
        setText(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const handleSend = () => {
        if (text.trim()) {
            onSend(text);
            setText('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Read file from user's local device (FileReader runs in browser �?works on cloud too)
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = ''; // reset so same file can be re-selected

        const maxSize = 100 * 1024; // 100 KB limit for text
        if (file.size > maxSize) {
            const msgen = `File too large (${(file.size / 1024).toFixed(1)} KB). Limited to 100 KB text files.`;
            const msgzh = `文件太大�?{(file.size / 1024).toFixed(1)} KB）。只支持 100 KB 以内的文本文件。`;
            alert(lang === 'en' ? msgen : msgzh);
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target.result;
            // Prepend file name header then append to textarea
            const snippet = `📄 [${file.name}]\n${content}`;
            setText(prev => prev ? prev + '\n' + snippet : snippet);
        };
        reader.onerror = () => alert(lang === 'en' ? 'Failed to read file' : '读取文件失败');
        reader.readAsText(file, 'utf-8');
    };

    return (
        <div className="input-area">
            <div className="input-toolbar" style={{ position: 'relative' }}>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji"><Smile size={20} /></button>

                {/* File button �?reads from user's local device via browser FileReader */}
                <button onClick={() => fileInputRef.current?.click()} title={lang === 'en' ? 'Send text file content' : '发送文件内�?}>
                    <Paperclip size={20} />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.csv,.json,.log,.py,.js,.ts,.html,.css,.xml,.yaml,.yml"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />

                {onTransfer && (
                    <button onClick={onTransfer} title={t('Send Transfer')}>
                        <CreditCard size={20} color="var(--accent-color)" />
                    </button>
                )}
                {onQuickHide && (
                    <button
                        onClick={onQuickHide}
                        title={lang === 'en' ? 'Quick-hide old messages from AI context' : '折叠前半部分的聊天记录（不给AI看到�?}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#888', padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', background: '#fafafa' }}
                    >
                        <EyeOff size={14} />
                        <span>{t('Hide Old Messages')}</span>
                    </button>
                )}

                {showEmojiPicker && (
                    <div className="emoji-picker" style={{
                        position: 'absolute', bottom: '50px', left: '10px', backgroundColor: '#fff',
                        border: '1px solid #ddd', borderRadius: '8px', padding: '10px', display: 'flex',
                        flexWrap: 'wrap', gap: '5px', width: '220px', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                        zIndex: 100
                    }}>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
                            <button onClick={() => setShowEmojiPicker(false)} style={{ padding: '2px' }}><X size={14} /></button>
                        </div>
                        {emojis.map(e => (
                            <span key={e} onClick={() => addEmoji(e)} style={{ fontSize: '20px', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
                                {e}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div className="input-textarea-wrapper">
                <textarea
                    className="input-textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={lang === 'en' ? 'Type a message... (try /hide 0-50 or /unhide)' : '输入消息... (支持 /hide �?/unhide)'}
                />
            </div>
            <div className="input-actions">
                <button className="send-button" onClick={handleSend}>{t('Send')}</button>
            </div>
        </div>
    );
}

export default InputBar;
import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Wand2, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function MemoTable({ contact, apiUrl, onClose }) {
    const { t, lang } = useLanguage();
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);

    const fetchMemories = React.useCallback(() => {
        if (!contact) return;
        setLoading(true);
        fetch(`${apiUrl}/memories/${contact.id}`)
            .then(res => res.json())
            .then(data => {
                if (!Array.isArray(data)) {
                    console.error('API Error:', data);
                    data = [];
                }
                setMemories(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load memories:', err);
                setLoading(false);
            });
    }, [contact, apiUrl]);

    useEffect(() => {
        fetchMemories();
    }, [fetchMemories]);

    const handleDelete = async (id) => {
        try {
            await fetch(`${apiUrl}/memories/${id}`, { method: 'DELETE' });
            setMemories(prev => prev.filter(m => m.id !== id));
        } catch (e) {
            console.error('Failed to delete memory:', e);
        }
    };

    const handleExtract = async () => {
        if (!contact) return;
        setIsExtracting(true);
        try {
            const res = await fetch(`${apiUrl}/memories/${contact.id}/extract`, { method: 'POST' });
            const data = await res.json();

            if (!res.ok) {
                alert(lang === 'en' ? `Extraction Failed:\n${data.error}` : `提取失败:\n${data.error}`);
            } else {
                alert(lang === 'en' ? `Extraction Complete:\n${data.message}` : `提取完成:\n${data.message}`);
                fetchMemories(); // Refresh the list if successful
            }
        } catch (e) {
            console.error('Failed to extract memories:', e);
            alert(lang === 'en' ? 'Failed to connect to the server for memory extraction.' : '无法连接服务器提取记忆�?);
        } finally {
            setIsExtracting(false);
        }
    };

    if (!contact) return null;

    console.log('MemoTable rendering:', { contact: contact?.name, memoriesLength: memories.length, loading });

    return (
        <div className="drawer-container memory-drawer">
            <div className="memory-header">
                <h3>{contact.name} {lang === 'en' ? "'s Memories" : "的记�?}</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={handleExtract}
                        disabled={isExtracting}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px', backgroundColor: isExtracting ? '#ccc' : 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: isExtracting ? 'not-allowed' : 'pointer', fontSize: '13px' }}
                    >
                        <Wand2 size={14} /> {isExtracting ? (lang === 'en' ? 'Extracting...' : '提取�?..') : (lang === 'en' ? 'Extract Now' : '立即提取')}
                    </button>
                    <button className="icon-btn" onClick={fetchMemories} title={lang === 'en' ? "Refresh" : "刷新"}>
                        <RefreshCw size={16} />
                    </button>
                    <button className="icon-btn" onClick={onClose} title={t('Cancel')}>
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="memory-content">
                {loading || isExtracting ? (
                    <p className="loading-text">{isExtracting ? (lang === 'en' ? 'Analyzing recent context...' : '分析最近的上下�?..') : (lang === 'en' ? 'Loading memories...' : '加载记忆�?..')}</p>
                ) : memories.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                        <p>{t('No memories yet')}</p>
                        <p style={{ fontSize: '12px', marginTop: '10px' }}>{lang === 'en' ? 'The AI usually extracts them in the background, but you can force an extraction now.' : 'AI 通常会在后台提取记忆，但您可以点击上方按钮强制立即提取�?}</p>
                    </div>
                ) : (
                    <div className="memory-list">
                        {memories.map(mem => (
                            <div key={mem.id} className="memory-card">
                                <div className="memory-card-header">
                                    <span className="memory-time">{new Date(mem.created_at).toLocaleString()}</span>
                                    <button className="icon-btn danger" onClick={() => handleDelete(mem.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="memory-card-body">
                                    <strong>{lang === 'en' ? 'Event' : '事件'}:</strong> {mem.event}
                                </div>
                                {(mem.time || mem.location || mem.people) && (
                                    <div className="memory-card-footer">
                                        {mem.time && <span>🕒 {mem.time}</span>}
                                        {mem.location && <span>📍 {mem.location}</span>}
                                        {mem.people && <span>👥 {mem.people}</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MemoTable;
import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRightLeft } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function BlockedSystemMessage({ name }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0', gap: '8px' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: '#fff1f1', border: '1px solid #ffc0c0',
                borderRadius: '10px', padding: '10px 18px',
                color: '#c0392b', fontSize: '13px', fontWeight: '500'
            }}>
                🚫 {name} 已将你拉黑。消息已发出，但对方不会收到�?
            </div>
            <div style={{ fontSize: '11px', color: '#bbb' }}>
                尝试转账来解锁对话�?
            </div>
        </div>
    );
}

/* Interactive Transfer Card �?handles both old and new formats */
function TransferCardInteractive({ content, isUser, apiUrl }) {
    const { lang } = useLanguage();
    const raw = content.replace('[TRANSFER]', '').trim();
    const parts = raw.split('|');

    // Detect format: new has tid|amount|note (tid is numeric), old has amount|note
    let tid = null, amount = '0', note = 'Transfer';
    if (parts.length >= 3 && /^\d+$/.test(parts[0].trim())) {
        tid = parseInt(parts[0].trim());
        amount = parts[1].trim();
        note = parts.slice(2).join('|').trim() || 'Transfer';
    } else if (parts.length >= 1) {
        amount = parts[0].trim();
        note = parts.length > 1 ? parts.slice(1).join('|').trim() : 'Transfer';
    }

    const [transferInfo, setTransferInfo] = useState(null);
    const [actionDone, setActionDone] = useState(false);

    useEffect(() => {
        if (!tid || !apiUrl) return;
        let cancelled = false;
        let pollCount = 0;
        const fetchStatus = () => {
            fetch(`${apiUrl}/transfers/${tid}`)
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d && !cancelled) setTransferInfo(d); })
                .catch(() => { });
        };
        fetchStatus();
        // Poll every 5s up to 30 times (~2.5 min) to catch AI's claim/refund decision
        const interval = setInterval(() => {
            pollCount++;
            if (pollCount > 30) { clearInterval(interval); return; }
            fetchStatus();
        }, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [tid, apiUrl]);

    // Auto-update UI when status resolves
    // DB returns: claimed (0/1), refunded (0/1) �?NOT a 'status' string
    const isClaimed = !!(transferInfo?.claimed);
    const isRefunded = !!(transferInfo?.refunded);
    const isPending = transferInfo ? (!isClaimed && !isRefunded) : true;

    useEffect(() => {
        if (isClaimed || isRefunded) setActionDone(true);
    }, [isClaimed, isRefunded]);

    const handleClaim = async () => {
        if (!tid) return;
        try {
            await fetch(`${apiUrl}/transfers/${tid}/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            setActionDone(true);
            const r = await fetch(`${apiUrl}/transfers/${tid}`);
            if (r.ok) setTransferInfo(await r.json());
        } catch (e) { console.error(e); }
    };

    const handleRefund = async () => {
        if (!tid) return;
        try {
            await fetch(`${apiUrl}/transfers/${tid}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            setActionDone(true);
            const r = await fetch(`${apiUrl}/transfers/${tid}`);
            if (r.ok) setTransferInfo(await r.json());
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ background: 'linear-gradient(135deg, #fff5f0 0%, #ffe8d8 100%)', borderRadius: '12px', padding: '12px 15px', width: '220px', boxSizing: 'border-box', border: '1px solid #ffd4a8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '24px' }}>💰</span>
                <div>
                    <div style={{ fontWeight: '600', fontSize: '15px', color: '#e67e22' }}>¥{amount}</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>{note}</div>
                </div>
            </div>
            {/* Status badge �?shown when claimed or refunded */}
            {(isClaimed || isRefunded) && (
                <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', padding: '4px 0' }}>
                    {isClaimed
                        ? (lang === 'en' ? '�?Claimed' : '�?已领�?)
                        : (lang === 'en' ? '↩️ Refunded' : '↩️ 已退�?)}
                </div>
            )}
            {/* Buttons: only for recipient (not sender) when still pending */}
            {tid && isPending && !actionDone && !isUser && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button onClick={handleClaim}
                        title={lang === 'en' ? 'Accept this transfer and add to your wallet' : '接受转账，入账到你的钱包'}
                        style={{ flex: 1, padding: '7px', fontSize: '12px', background: '#e67e22', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
                        {lang === 'en' ? '💰 Claim' : '💰 领取'}
                    </button>
                    <button onClick={handleRefund}
                        title={lang === 'en' ? 'Return this transfer back to the sender' : '将转账退回给发送�?}
                        style={{ flex: 1, padding: '7px', fontSize: '12px', background: '#fff', color: '#e67e22', border: '1px solid #e67e22', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                        {lang === 'en' ? '↩️ Refund' : '↩️ 退�?}
                    </button>
                </div>
            )}
            {/* Sender sees waiting status when still pending */}
            {tid && isPending && !actionDone && isUser && (
                <div style={{ fontSize: '11px', color: '#bbb', textAlign: 'center', marginTop: '4px', fontStyle: 'italic' }}>
                    {lang === 'en' ? '�?Waiting for response...' : '�?等待对方回应...'}
                </div>
            )}
        </div>
    );
}

function MessageBubble({ message, avatar, characterName, apiUrl }) {
    const isUser = message.role === 'user';
    const content = message.content || '';  // null-safe: old DB records may have null content
    const { lang } = useLanguage();

    if (message.role === 'system') {
        return (
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <span style={{ fontSize: '12px', color: '#aaa', backgroundColor: '#f0f0f0', padding: '3px 10px', borderRadius: '10px' }}>
                    {content.replace('[System] ', '')}
                </span>
            </div>
        );
    }

    return (
        <>
            <div className={`message-wrapper ${isUser ? 'user' : 'character'}`}>
                <div className="message-avatar">
                    <img src={avatar} alt="Avatar" />
                </div>
                <div className="message-content">
                    {content.startsWith('[TRANSFER]') ? (
                        <TransferCardInteractive content={content} isUser={isUser} apiUrl={apiUrl} />
                    ) : content.startsWith('[CONTACT_CARD:') ? (
                        (() => {
                            const parts = content.split(':');
                            if (parts.length >= 4) {
                                const cardName = parts[2];
                                const cardAvatar = parts.slice(3).join(':');
                                return (
                                    <div className="message-bubble" style={{ padding: 0, overflow: 'hidden', backgroundColor: '#fff', color: '#333', textAlign: 'left', width: '220px', boxSizing: 'border-box', border: '1px solid #eaeaea' }}>
                                        <div style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f0f0f0' }}>
                                            <img src={cardAvatar.replace(']', '')} alt={cardName} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                            <div style={{ fontSize: '16px', fontWeight: '400' }}>{cardName}</div>
                                        </div>
                                        <div style={{ padding: '4px 15px 6px', fontSize: '12px', color: '#999' }}>
                                            个人名片
                                        </div>
                                    </div>
                                );
                            }
                            return <div className="message-bubble">{content}</div>;
                        })()
                    ) : (
                        <div className="message-bubble">
                            {content}
                        </div>
                    )}
                    {message.timestamp && (
                        <div style={{
                            fontSize: '11px', color: '#bbb', marginTop: '4px',
                            display: 'flex', gap: '6px', alignItems: 'center',
                            justifyContent: isUser ? 'flex-end' : 'flex-start'
                        }}>
                            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    )}
                </div>
                {message.isBlocked && (
                    <div className="message-blocked-icon" title="消息已发出，但被对方拒收了�?>
                        <AlertCircle size={20} color="var(--danger)" />
                    </div>
                )}
            </div>
            {message.isBlocked && isUser && (
                <BlockedSystemMessage name={characterName || '对方'} />
            )}
        </>
    );
}

export default MessageBubble;
import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Trash2, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function MomentsFeed({ apiUrl, userProfile, onBack }) {
    const { t } = useLanguage();
    const [moments, setMoments] = useState([]);
    const [characters, setCharacters] = useState({});
    const [loading, setLoading] = useState(true);

    // New Moment Post State
    const [newPostText, setNewPostText] = useState('');
    const [posting, setPosting] = useState(false);

    // Comment State (keyed by moment id)
    const [commentTexts, setCommentTexts] = useState({});
    const [activeCommentBox, setActiveCommentBox] = useState(null);

    const fetchMomentsData = React.useCallback(() => {
        // Fetch characters for mapping avatars/names
        fetch(`${apiUrl}/characters`)
            .then(res => res.json())
            .then(data => {
                const charMap = {};
                data.forEach(c => charMap[c.id] = c);
                setCharacters(charMap);
                return fetch(`${apiUrl}/moments`);
            })
            .then(res => res.json())
            .then(data => {
                setMoments(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load moments/characters:', err);
                setLoading(false);
            });
    }, [apiUrl]);

    useEffect(() => {
        fetchMomentsData();
    }, [fetchMomentsData]);

    const handlePostMoment = async () => {
        if (!newPostText.trim()) return;
        setPosting(true);
        try {
            const res = await fetch(`${apiUrl}/moments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newPostText })
            });
            if (res.ok) {
                setNewPostText('');
                fetchMomentsData(); // refresh
            }
        } catch (e) {
            console.error('Failed to post moment', e);
        }
        setPosting(false);
    };

    const handleLikeToggle = async (id) => {
        try {
            const res = await fetch(`${apiUrl}/moments/${id}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ liker_id: 'user' })
            });
            const data = await res.json();
            if (data.success) {
                // Optimistically update the moments array without a full refetch
                setMoments(prev => prev.map(m =>
                    m.id === id ? { ...m, likers: data.likers } : m
                ));
            }
        } catch (e) {
            console.error('Like toggle failed', e);
        }
    };

    const handlePostComment = async (momentId) => {
        const text = commentTexts[momentId];
        if (!text || !text.trim()) return;

        try {
            const res = await fetch(`${apiUrl}/moments/${momentId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ author_id: 'user', content: text })
            });
            const data = await res.json();
            if (data.success) {
                setCommentTexts(prev => ({ ...prev, [momentId]: '' }));
                setActiveCommentBox(null);
                fetchMomentsData(); // refresh to get comments
            }
        } catch (e) {
            console.error('Comment failed', e);
        }
    };

    const handleDeleteMoment = async (momentId) => {
        try {
            const res = await fetch(`${apiUrl}/moments/${momentId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setMoments(prev => prev.filter(m => m.id !== momentId));
            }
        } catch (e) {
            console.error('Delete moment failed', e);
        }
    };

    const formatTime = (ts) => {
        const timeAgo = Math.round((Date.now() - ts) / 60000);
        if (timeAgo < 1) return 'Just now';
        if (timeAgo < 60) return `${timeAgo} mins ago`;
        if (timeAgo < 1440) return `${Math.floor(timeAgo / 60)} hours ago`;
        return `${Math.floor(timeAgo / 1440)} days ago`;
    };

    const resolveAuthor = (id) => {
        if (id === 'user') return { name: userProfile?.name || 'User', avatar: userProfile?.avatar || 'https://api.dicebear.com/7.x/shapes/svg?seed=User' };
        return characters[id] || { name: 'Unknown', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Unknown' };
    };

    if (loading) return <div className="placeholder-text">Loading Moments...</div>;

    return (
        <div className="moments-feed" style={{ paddingBottom: '80px' }}>
            {/* Cover Photo Area */}
            <div className="moments-cover" style={{ marginBottom: '20px', backgroundImage: userProfile?.banner ? `url(${userProfile.banner})` : undefined, position: 'relative' }}>
                {onBack && (
                    <button className="mobile-back-btn" onClick={onBack} title="Back" style={{ position: 'absolute', top: '15px', left: '15px', background: 'rgba(0,0,0,0.3)', color: 'white', display: 'flex' }}>
                        <ChevronLeft size={24} />
                    </button>
                )}
                <div className="moments-cover-user">
                    <span className="moments-cover-name">{userProfile?.name || 'User'}</span>
                    <img src={userProfile?.avatar || 'https://api.dicebear.com/7.x/shapes/svg?seed=User'} alt="Me" className="moments-cover-avatar" />
                </div>
            </div>

            <div className="moments-list">
                {/* Post New Moment Area */}
                <div style={{ backgroundColor: '#fff', padding: '15px', marginBottom: '20px', borderBottom: '1px solid #f0f0f0', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <img src={userProfile?.avatar || 'https://api.dicebear.com/7.x/shapes/svg?seed=User'} style={{ width: '44px', height: '44px', borderRadius: '50%' }} alt="" />
                        <div style={{ flex: 1 }}>
                            <textarea
                                placeholder={t('Share something new')}
                                value={newPostText}
                                onChange={(e) => setNewPostText(e.target.value)}
                                style={{ width: '100%', border: 'none', resize: 'none', minHeight: '60px', outline: 'none', fontSize: '15px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button
                                    onClick={handlePostMoment}
                                    disabled={posting || !newPostText.trim()}
                                    style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', opacity: (!newPostText.trim() || posting) ? 0.5 : 1 }}
                                >
                                    {posting ? t('Loading') : t('Post')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>


                {moments.length === 0 ? (
                    <p className="empty-text" style={{ padding: '20px', textAlign: 'center' }}>{t('No moments yet')}</p>
                ) : (
                    moments.map(moment => {
                        const author = resolveAuthor(moment.character_id);
                        const isLikedByUser = (moment.likers || []).includes('user');

                        return (
                            <div key={moment.id} className="moment-post" style={{ paddingBottom: '15px', marginBottom: '15px', borderBottom: '1px solid #f0f0f0' }}>
                                <img src={author.avatar} alt={author.name} className="moment-avatar" />
                                <div className="moment-body" style={{ flex: 1, minWidth: 0 }}>
                                    <div className="moment-author">{author.name}</div>
                                    <div className="moment-content" style={{ marginTop: '5px' }}>{moment.content}</div>
                                    {moment.image_url && <img src={moment.image_url} alt="Attached" className="moment-image" />}

                                    <div className="moment-footer" style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="moment-time">{formatTime(moment.timestamp)}</span>
                                        <div className="moment-actions" style={{ display: 'flex', gap: '15px' }}>
                                            {moment.character_id === 'user' && (
                                                <button onClick={() => handleDeleteMoment(moment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }} title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => handleLikeToggle(moment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isLikedByUser ? 'var(--danger)' : 'var(--accent-color)' }}>
                                                <Heart size={18} fill={isLikedByUser ? 'var(--danger)' : 'none'} color={isLikedByUser ? 'var(--danger)' : 'var(--accent-color)'} />
                                                <span>{(moment.likers || []).length > 0 ? moment.likers.length : ''}</span>
                                            </button>
                                            <button onClick={() => setActiveCommentBox(activeCommentBox === moment.id ? null : moment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MessageCircle size={18} />
                                                <span>{(moment.comments || []).length > 0 ? moment.comments.length : ''}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Interaction Display Area (Likes + Comments) */}
                                    {((moment.likers && moment.likers.length > 0) || (moment.comments && moment.comments.length > 0)) && (
                                        <div style={{ background: '#f8f8f8', marginTop: '10px', padding: '8px', borderRadius: '4px', fontSize: '13px' }}>

                                            {/* Likes Text */}
                                            {moment.likers && moment.likers.length > 0 && (
                                                <div style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '5px', paddingBottom: (moment.comments && moment.comments.length > 0) ? '5px' : '0', borderBottom: (moment.comments && moment.comments.length > 0) ? '1px solid #eaeaea' : 'none' }}>
                                                    <Heart size={12} fill="var(--accent-color)" />
                                                    {moment.likers.map(lId => resolveAuthor(lId).name).join(', ')}
                                                </div>
                                            )}

                                            {/* Comments List */}
                                            {moment.comments && moment.comments.length > 0 && (
                                                <div style={{ paddingTop: (moment.likers && moment.likers.length > 0) ? '5px' : '0' }}>
                                                    {moment.comments.map(c => {
                                                        const cAuthor = resolveAuthor(c.author_id);
                                                        return (
                                                            <div key={c.id} style={{ marginBottom: '3px', wordBreak: 'break-word' }}>
                                                                <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>{cAuthor.name}: </span>
                                                                <span style={{ color: '#333' }}>{c.content}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Comment Input Box */}
                                    {activeCommentBox === moment.id && (
                                        <div style={{ display: 'flex', marginTop: '10px', gap: '5px' }}>
                                            <input
                                                type="text"
                                                value={commentTexts[moment.id] || ''}
                                                onChange={e => setCommentTexts({ ...commentTexts, [moment.id]: e.target.value })}
                                                placeholder="Comment..."
                                                style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none' }}
                                                onKeyDown={e => e.key === 'Enter' && handlePostComment(moment.id)}
                                                autoFocus
                                            />
                                            <button onClick={() => handlePostComment(moment.id)} style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '4px', cursor: 'pointer' }}>
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default MomentsFeed;
import React, { useState, useEffect } from 'react';
import { X, Search, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function RecommendModal({ apiUrl, currentContact, allContacts, onClose, onRecommend }) {
    const { t, lang } = useLanguage();
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCharId, setSelectedCharId] = useState(null);

    useEffect(() => {
        if (!currentContact) return;
        fetch(`${apiUrl}/characters/${currentContact.id}/friends`)
            .then(res => res.json())
            .then(data => {
                setFriends(data.map(f => f.id));
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load friends:', err);
                setLoading(false);
            });
    }, [apiUrl, currentContact]);

    const handleConfirm = () => {
        if (selectedCharId) {
            onRecommend(selectedCharId);
        }
    };

    // Filter out the current contact and already added friends
    const availableContacts = allContacts.filter(c =>
        c.id !== currentContact.id &&
        !friends.includes(c.id) &&
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px', padding: '0' }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>
                        {lang === 'en' ? `Recommend Contact to ${currentContact.name}` : `将联系人推荐�?${currentContact.name}`}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="#999" />
                    </button>
                </div>

                <div style={{ padding: '20px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                            {t('Loading')}
                        </div>
                    ) : (
                        <>
                            <div style={{ position: 'relative', marginBottom: '15px' }}>
                                <Search size={16} color="#aaa" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                                <input
                                    type="text"
                                    placeholder={lang === 'en' ? 'Search contacts...' : '搜索联系�?..'}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                                />
                            </div>

                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {availableContacts.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '14px' }}>
                                        {lang === 'en' ? 'No contacts available to recommend.' : '没有可以推荐的联系人了�?}
                                    </div>
                                ) : (
                                    availableContacts.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => setSelectedCharId(c.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', padding: '10px',
                                                borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                                                backgroundColor: selectedCharId === c.id ? '#f0f9eb' : 'transparent',
                                                borderRadius: '6px'
                                            }}
                                        >
                                            <img src={c.avatar} alt={c.name} style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '12px' }} />
                                            <div style={{ flex: 1, fontWeight: '500', fontSize: '15px' }}>{c.name}</div>
                                            {selectedCharId === c.id && (
                                                <CheckCircle2 size={20} color="var(--accent-color)" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div style={{ marginTop: '20px' }}>
                                <button
                                    onClick={handleConfirm}
                                    disabled={!selectedCharId}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '6px', border: 'none',
                                        backgroundColor: selectedCharId ? 'var(--accent-color)' : '#e0e0e0',
                                        color: selectedCharId ? '#fff' : '#999',
                                        fontWeight: '500', fontSize: '15px', cursor: selectedCharId ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    {lang === 'en' ? 'Send Recommendation' : '发送名片推�?}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RecommendModal;
import React, { useState, useEffect } from 'react';
import { User, Trash2, Edit3, Save, RefreshCw, Palette, Download, Upload, FileText, ChevronDown, ChevronRight, Sparkles, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

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
   - If you want to post a public update to your Moments (朋友�? for everyone to see, output [MOMENT:your post content]. Do this occasionally.
   - You can react to someone else's Moment (including the user's) using [MOMENT_LIKE:moment_id] or [MOMENT_COMMENT:moment_id:your comment text].
   - If you want to write a secret entry in your private diary (for your eyes only), output [DIARY:your secret thought]. Do this if you are feeling very emotional.
   - If your feelings toward the user change based on their message (e.g., they insulted you or flattered you), output [AFFINITY:+5] or [AFFINITY:-10].
   - If your anxiety/pressure is relieved by their message, output [PRESSURE:0].
   These tags will be processed hidden from the user.`;
    }

    return `行为准则�?
1. 请完全进入并扮演你的角色设定 (Persona)。绝对不可以脱离角色�?
2. 我们正在使用一个移动手机聊天软件�?
3. 你的回复需要保持简短、随意、口语化�?
4. 绝对不可以表现得像一个AI助手。绝对不可以问“有什么我可以帮你的吗？”�?
5. 当你主动发起对话时，请根据当前时间自然地打招呼，或者提一下你现在可能在做的事�?
6. [后台动作的强制性规范]�?
   - 如果你想等待几分钟后再发送下一条主动消息，请输出标�?[TIMER:分钟数]�?
   - 如果你想表达歉意或者发个红包，请输出标�?[TRANSFER:金额] (例如：[TRANSFER:5.20])�?
   - 如果你想发一条公开的朋友圈动态，请输出标�?[MOMENT:你的动态内容]。请偶尔这样做�?
   - 如果你想给别人的朋友圈（包括我的）点赞或评论，请使用 [MOMENT_LIKE:moment_id] �?[MOMENT_COMMENT:moment_id:你的评论]�?
   - 如果你情绪激动想要写一段绝对私密的私人日记（仅你可见），请输出标签 [DIARY:你的秘密想法]�?
   - 如果因为我的话导致你对我的好感度改变（被冒犯或被夸奖），请输出标�?[AFFINITY:+5] �?[AFFINITY:-10]�?
   - 如果我的话让你觉得情绪压力得到缓解，请输出标�?[PRESSURE:0]�?
   以上所有的括号标签[TAG]在处理时都会在前端对我隐藏，但我能看到对应的效果。`;
};


function SettingsPanel({ apiUrl, onCharactersUpdate, onProfileUpdate, onBack }) {
    const { t, lang } = useLanguage();
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [themeAccordion, setThemeAccordion] = useState({ ai_gen: false, accent: true, bg: false, text: false, bubbles: false, advanced: false });
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [editBanner, setEditBanner] = useState('');
    const [editBio, setEditBio] = useState('');

    // Theme Editor states
    const [editThemeConfig, setEditThemeConfig] = useState({});
    const [editCustomCss, setEditCustomCss] = useState('');

    // AI Theme Gen states
    const [contacts, setContacts] = useState([]);
    const [aiThemeQuery, setAiThemeQuery] = useState('');
    const [aiProviderId, setAiProviderId] = useState('manual');
    const [aiManualEndpoint, setAiManualEndpoint] = useState('');
    const [aiManualKey, setAiManualKey] = useState('');
    const [aiManualModel, setAiManualModel] = useState('');
    const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    // Model list fetch state (main API + memory API)
    const [mainModels, setMainModels] = useState([]);
    const [mainModelFetching, setMainModelFetching] = useState(false);
    const [mainModelError, setMainModelError] = useState('');
    const [memModels, setMemModels] = useState([]);
    const [memModelFetching, setMemModelFetching] = useState(false);
    const [memModelError, setMemModelError] = useState('');

    const fetchModels = async (endpoint, key, setList, setFetching, setError) => {
        if (!endpoint || !key) { setError('请先填写 Endpoint �?Key'); return; }
        setFetching(true); setError(''); setList([]);
        try {
            const res = await fetch(`${apiUrl}/models?endpoint=${encodeURIComponent(endpoint)}&key=${encodeURIComponent(key)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setList(data.models || []);
            if (!(data.models || []).length) setError('未找到可用模�?);
        } catch (e) { setError('拉取失败: ' + e.message); }
        setFetching(false);
    };

    useEffect(() => {
        // Fetch user profile
        fetch(`${apiUrl}/user`)
            .then(res => res.json())
            .then(data => {
                setProfile(data);
                setEditName(data.name || '');
                setEditAvatar(data.avatar || '');
                setEditBanner(data.banner || '');
                setEditBio(data.bio || '');

                // Initialize theme config edit states
                if (data.theme_config) {
                    try {
                        const parsed = typeof data.theme_config === 'string' ? JSON.parse(data.theme_config) : data.theme_config;
                        setEditThemeConfig(parsed || {});
                    } catch (e) {
                        setEditThemeConfig({});
                    }
                }
                if (data.custom_css) {
                    setEditCustomCss(data.custom_css);
                }
            })
            .catch(console.error);

        // Fetch contacts for AI provider dropdown
        fetch(`${apiUrl}/characters`)
            .then(res => res.json())
            .then(data => setContacts(data))
            .catch(console.error);
    }, [apiUrl]);

    const handleSaveProfile = async () => {
        const updated = { ...profile, name: editName, avatar: editAvatar, banner: editBanner, bio: editBio };
        try {
            const res = await fetch(`${apiUrl}/user`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
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

    const handleSaveTheme = async () => {
        try {
            const res = await fetch(`${apiUrl}/user`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme_config: JSON.stringify(editThemeConfig), custom_css: editCustomCss })
            });
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
                if (onProfileUpdate) onProfileUpdate(data.profile);
                alert(lang === 'en' ? 'Theme Settings Saved!' : '主题设置已保存！');
            }
        } catch (e) {
            console.error('Failed to update theme:', e);
            alert('Failed to save theme.');
        }
    };

    const handleExportTheme = () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                theme_config: editThemeConfig,
                custom_css: editCustomCss
            }, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "chatpulse-theme.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            alert(lang === 'en' ? 'Theme exported successfully!' : '主题导出成功�?);
        } catch (e) {
            console.error("Export error", e);
            alert(lang === 'en' ? 'Failed to export theme.' : '主题导出失败�?);
        }
    };

    const handleImportTheme = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (json.theme_config || json.custom_css) {
                    if (json.theme_config) setEditThemeConfig(json.theme_config);
                    if (json.custom_css) setEditCustomCss(json.custom_css);
                } else {
                    setEditThemeConfig(json);
                }
                alert(lang === 'en' ? 'Theme imported successfully! Please click "Save" to apply.' : '主题导入成功！请点击"保存"先生效�?);
            } catch (err) {
                alert(lang === 'en' ? "Invalid theme JSON file. Import failed." : "无效的主�?JSON 文件，导入失败�?);
            }
        };
        reader.readAsText(file);
        event.target.value = null; // reset input
    };

    const handleGenerateTheme = async () => {
        if (!aiThemeQuery.trim()) {
            alert(lang === 'en' ? 'Please enter a theme description.' : '请输入主题描述�?);
            return;
        }

        let endpoint, key, model;
        if (aiProviderId === 'manual') {
            endpoint = aiManualEndpoint;
            key = aiManualKey;
            model = aiManualModel;
        } else {
            const provider = contacts.find(c => c.id === aiProviderId);
            if (provider) {
                endpoint = provider.api_endpoint;
                key = provider.api_key;
                model = provider.model_name;
            }
        }

        if (!endpoint || !key || !model) {
            alert(lang === 'en' ? 'Missing API configuration. Please select a valid Contact or enter manual API details.' : '缺少 API 配置。请选择有效的联系人或手动输�?API 信息�?);
            return;
        }

        setIsGeneratingTheme(true);
        try {
            const res = await fetch(`${apiUrl}/theme/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: aiThemeQuery,
                    api_endpoint: endpoint,
                    api_key: key,
                    model_name: model
                })
            });

            const data = await res.json();
            if (data.success && data.theme_config) {
                setEditThemeConfig(data.theme_config);
                // Automatically open the background tab so they see it
                setThemeAccordion(prev => ({ ...prev, bg: true, accent: true }));
                alert(lang === 'en' ? 'Theme generated successfully! Click Save to apply.' : '主题生成成功！点�?保存"先生效�?);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (e) {
            console.error('AI Generation error:', e);
            alert((lang === 'en' ? 'Theme generation failed: ' : '主题生成失败�?) + e.message);
        } finally {
            setIsGeneratingTheme(false);
        }
    };

    const handleDeleteContact = async (id) => {
        if (!window.confirm("Are you sure you want to delete this contact and all their data?")) return;
        try {
            const res = await fetch(`${apiUrl}/characters/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                if (onCharactersUpdate) onCharactersUpdate();
            }
        } catch (e) {
            console.error('Failed to delete character:', e);
        }
    };

    const handleWipeData = async (id) => {
        if (!window.confirm(lang === 'en' ? "Are you sure you want to wipe all data (messages, memories, etc.) for this character?" : "确定要清空该角色的所有数据（消息、记忆等）吗�?)) return;
        try {
            const res = await fetch(`${apiUrl}/data/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                alert(lang === 'en' ? "Data wiped successfully." : "数据已清空�?);
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingContact)
            });
            const data = await res.json();
            if (res.ok) {
                setEditingContact(null);
                if (onCharactersUpdate) onCharactersUpdate();
            } else {
                alert("Failed to save: " + data.error);
            }
        } catch (e) {
            console.error('Failed to update contact:', e);
        }
    };

    const handleFileUpload = async (event, setAvatarCallback) => {
        const file = event.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetch(`${apiUrl}/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                setAvatarCallback(data.url);
            } else {
                alert(lang === 'en' ? "Failed to save: " + data.error : "保存失败: " + data.error);
            }
        } catch (e) {
            console.error('Upload Error:', e);
            alert('Upload failed.');
        }
    };

    const handleImportDatabase = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!window.confirm(lang === 'en' ? "Warning! This will overwrite all your current characters and chats. The server will restart. Continue?" : "警告！这将会覆盖你当前所有的聊天记录和角色数据，并且服务器会自动重启。是否继续？")) {
            event.target.value = null;
            return;
        }

        const formData = new FormData();
        formData.append('db_file', file);
        try {
            const res = await fetch(`${apiUrl}/system/import`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                alert(lang === 'en' ? "Database restored! Please refresh the page in a few seconds." : "存档恢复成功！服务器正在重启，请�?秒后刷新本页面�?);
                setTimeout(() => window.location.reload(), 3000);
            } else {
                alert("Failed to restore: " + data.error);
            }
        } catch (e) {
            console.error('Import Error:', e);
            alert('Upload failed.');
        }
    };

    const handleSystemWipe = async () => {
        if (!window.confirm(lang === 'en' ? "DANGER: This will permanently wipe ALL characters, chats, and memories. Your theme settings will remain. Are you absolutely sure?" : "危险：这将永久清空所有角色、聊天记录、群聊和记忆。仅保留主题设置。你确定要执行【恢复出厂设置】吗�?)) return;

        // Double check
        if (!window.confirm(lang === 'en' ? "Final confirmation: Wipe everything?" : "最后一次确认：真的要抹除所有数据吗�?)) return;

        try {
            const res = await fetch(`${apiUrl}/system/wipe`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                alert(lang === 'en' ? "All data wiped successfully." : "所有数据已成功清空�?);
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

    if (!profile) return <div className="loading-text">Loading settings...</div>;

    return (
        <>
            <div style={{ padding: '30px', maxWidth: '600px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '30px' }}>

                {/* User Profile Section */}
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {onBack && (
                            <button className="mobile-back-btn" onClick={onBack} title="Back" style={{ display: 'flex', padding: 0, marginRight: '5px' }}>
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        <User size={20} /> {t('User Profile')}
                    </h2>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '14px', color: '#666' }}>Name:</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '16px' }}
                                    />
                                    <label style={{ fontSize: '14px', color: '#666' }}>Avatar URL or Upload:</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={editAvatar}
                                            onChange={e => setEditAvatar(e.target.value)}
                                            placeholder="https://..."
                                            style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                                        />
                                        <label style={{ cursor: 'pointer', padding: '8px 12px', backgroundColor: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                            Upload
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setEditAvatar)} />
                                        </label>
                                    </div>
                                    <label style={{ fontSize: '14px', color: '#666' }}>Banner URL or Upload (Moments):</label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={editBanner}
                                            onChange={e => setEditBanner(e.target.value)}
                                            placeholder="https://..."
                                            style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                                        />
                                        <label style={{ cursor: 'pointer', padding: '8px 12px', backgroundColor: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                            Upload
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, setEditBanner)} />
                                        </label>
                                    </div>
                                    <label style={{ fontSize: '14px', color: '#666' }}>Bio:</label>
                                    <textarea
                                        value={editBio}
                                        onChange={e => setEditBio(e.target.value)}
                                        placeholder="What's up?"
                                        style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '60px', resize: 'vertical' }}
                                    />
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={handleSaveProfile} title={lang === 'en' ? 'Save profile changes' : '保存个人资料修改'} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                            <Save size={16} /> Save
                                        </button>
                                        <button onClick={() => setIsEditing(false)} title={lang === 'en' ? 'Cancel editing' : '取消编辑'} style={{ padding: '6px 12px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <img src={profile.avatar || 'https://api.dicebear.com/7.x/shapes/svg?seed=User'} alt="Me" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                                            <div>
                                                <h3 style={{ margin: '0 0 5px 0', fontSize: '20px' }}>{profile.name}</h3>
                                                <p style={{ color: '#666', margin: 0, whiteSpace: 'pre-wrap', fontSize: '14px' }}>{profile.bio || 'Signature...'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsEditing(true)} title={lang === 'en' ? 'Edit your profile (name, avatar, bio)' : '编辑个人资料（名字、头像、签名）'} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Edit3 size={16} /> Edit
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Visual Theme Editor */}
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Palette size={20} /> {lang === 'en' ? 'Visual Theme Editor' : '主题样式编辑�?}
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* AI Theme Generation Panel */}
                        <div style={{ border: '2px solid var(--accent-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(123, 159, 224, 0.15)' }}>
                            <button
                                onClick={() => setThemeAccordion(prev => ({ ...prev, ai_gen: !prev.ai_gen }))}
                                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'linear-gradient(to right, #f4f7fc, #fff)', border: 'none', cursor: 'pointer', outline: 'none' }}
                            >
                                <span style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Sparkles size={18} /> {lang === 'en' ? '�?Auto-Generate Theme with AI' : '�?使用 AI 一键生成主�?}
                                </span>
                                {themeAccordion.ai_gen ? <ChevronDown size={18} color="var(--accent-color)" /> : <ChevronRight size={18} color="var(--accent-color)" />}
                            </button>
                            {themeAccordion.ai_gen && (
                                <div style={{ padding: '15px', background: '#fff', borderTop: '1px solid #eaeaea', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div>
                                        <label style={{ fontSize: '13px', color: '#555', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                                            {lang === 'en' ? '1. Connect AI Provider' : '1. 连接 AI 服务�?}
                                        </label>
                                        <select
                                            value={aiProviderId}
                                            onChange={e => setAiProviderId(e.target.value)}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '10px' }}
                                        >
                                            <option value="manual">{lang === 'en' ? 'Manual API Entry' : '手动输入 API 密钥'}</option>
                                            <optgroup label={lang === 'en' ? 'Use Contact API Settings' : '使用联系�?API 配置'}>
                                                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </optgroup>
                                        </select>

                                        {aiProviderId === 'manual' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: '#f9f9f9', borderRadius: '6px' }}>
                                                <input type="text" placeholder="Base URL (e.g. https://api.openai.com/v1)" value={aiManualEndpoint} onChange={e => setAiManualEndpoint(e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                                <input type="password" placeholder="API Key" value={aiManualKey} onChange={e => setAiManualKey(e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                                <input type="text" placeholder="Model (e.g. gpt-4o)" value={aiManualModel} onChange={e => setAiManualModel(e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '13px', color: '#555', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                                            {lang === 'en' ? '2. Describe your desired UI' : '2. 描述您想要的界面风格'}
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input
                                                type="text"
                                                placeholder={lang === 'en' ? 'e.g. "Cyberpunk neon city, dark mode with hot pink accents"' : '例如�?赛博朋克霓虹光，暗黑背景搭配亮粉色按�?'}
                                                value={aiThemeQuery}
                                                onChange={e => setAiThemeQuery(e.target.value)}
                                                style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
                                            />
                                            <button
                                                onClick={handleGenerateTheme}
                                                disabled={isGeneratingTheme}
                                                style={{ padding: '10px 20px', background: isGeneratingTheme ? '#ccc' : 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: isGeneratingTheme ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                {isGeneratingTheme ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
                                                {lang === 'en' ? (isGeneratingTheme ? 'Generating...' : 'Generate!') : (isGeneratingTheme ? '生成�?..' : '开始生成！')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {[
                            {
                                id: 'accent', labelEn: 'Accent Colors', labelZh: '🎨 主题�?,
                                keys: [
                                    { key: '--accent-color', labelEn: 'Primary Accent', labelZh: '核心主题�? },
                                    { key: '--accent-hover', labelEn: 'Accent Hover', labelZh: '主题悬浮�? }
                                ]
                            },
                            {
                                id: 'bg', labelEn: 'Backgrounds', labelZh: '🖼�?背景颜色',
                                keys: [
                                    { key: '--bg-main', labelEn: 'App Background', labelZh: '全局主背�? },
                                    { key: '--bg-sidebar', labelEn: 'Sidebar Bg', labelZh: '左侧导航栏背�? },
                                    { key: '--bg-contacts', labelEn: 'Contacts List Bg', labelZh: '联系人列表背�? },
                                    { key: '--bg-chat-area', labelEn: 'Chat Area Bg', labelZh: '聊天区背�? },
                                    { key: '--bg-input', labelEn: 'Input Box Bg', labelZh: '输入框背�? }
                                ]
                            },
                            {
                                id: 'text', labelEn: 'Text, Borders & Icons', labelZh: '🔤 文字与图�?,
                                keys: [
                                    { key: '--text-primary', labelEn: 'Primary Text', labelZh: '主要文字颜色' },
                                    { key: '--text-secondary', labelEn: 'Secondary Text', labelZh: '次要文字颜色' },
                                    { key: '--border-color', labelEn: 'Border Color', labelZh: '全局边框颜色' },
                                    { key: '--sidebar-icon', labelEn: 'Sidebar Icon (Inactive)', labelZh: '侧边栏图标（未激活）' },
                                    { key: '--sidebar-icon-active', labelEn: 'Sidebar Icon (Active)', labelZh: '侧边栏图标（激活）' }
                                ]
                            },
                            {
                                id: 'bubbles', labelEn: 'Chat Bubbles', labelZh: '💬 聊天气泡',
                                keys: [
                                    { key: '--bubble-user-bg', labelEn: 'User Bubble Bg', labelZh: '用户气泡背景' },
                                    { key: '--bubble-user-text', labelEn: 'User Bubble Text', labelZh: '用户气泡文字' },
                                    { key: '--bubble-ai-bg', labelEn: 'AI Bubble Bg', labelZh: 'AI气泡背景' },
                                    { key: '--bubble-ai-text', labelEn: 'AI Bubble Text', labelZh: 'AI气泡文字' }
                                ]
                            }
                        ].map(group => (
                            <div key={group.id} style={{ border: '1px solid #eaeaea', borderRadius: '8px', overflow: 'hidden' }}>
                                <button
                                    onClick={() => setThemeAccordion(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: themeAccordion[group.id] ? '#f8f9fa' : '#fff', border: 'none', cursor: 'pointer', outline: 'none', transition: 'background 0.2s' }}
                                >
                                    <span style={{ fontWeight: '500', fontSize: '14px', color: '#333' }}>
                                        {lang === 'en' ? group.labelEn : group.labelZh}
                                    </span>
                                    {themeAccordion[group.id] ? <ChevronDown size={18} color="#888" /> : <ChevronRight size={18} color="#888" />}
                                </button>
                                {themeAccordion[group.id] && (
                                    <div style={{ padding: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px', background: '#fff', borderTop: '1px solid #eaeaea' }}>
                                        {group.keys.map(({ key, labelEn, labelZh }) => (
                                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                <label style={{ fontSize: '12px', color: '#666' }}>{lang === 'en' ? labelEn : labelZh} <span style={{ fontFamily: 'monospace', opacity: 0.6 }}>({key})</span></label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input
                                                        type="color"
                                                        value={editThemeConfig[key] && editThemeConfig[key].startsWith('#') ? editThemeConfig[key].slice(0, 7) : '#ffffff'}
                                                        onChange={(e) => setEditThemeConfig(prev => ({ ...prev, [key]: e.target.value }))}
                                                        style={{ width: '30px', height: '30px', padding: '0', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editThemeConfig[key] || ''}
                                                        onChange={(e) => setEditThemeConfig(prev => ({ ...prev, [key]: e.target.value }))}
                                                        placeholder="e.g. #7B9FE0 or rgba(...)"
                                                        style={{ flex: 1, padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '15px', border: '1px solid #eaeaea', borderRadius: '8px', overflow: 'hidden' }}>
                        <button
                            onClick={() => setThemeAccordion(prev => ({ ...prev, advanced: !prev.advanced }))}
                            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: themeAccordion.advanced ? '#f8f9fa' : '#fff', border: 'none', cursor: 'pointer', outline: 'none', transition: 'background 0.2s' }}
                        >
                            <span style={{ fontWeight: '500', fontSize: '14px', color: '#333' }}>
                                {lang === 'en' ? '🛠�?Custom CSS Injection' : '🛠�?自定�?CSS 注入'}
                            </span>
                            {themeAccordion.advanced ? <ChevronDown size={18} color="#888" /> : <ChevronRight size={18} color="#888" />}
                        </button>
                        {themeAccordion.advanced && (
                            <div style={{ padding: '15px', background: '#fff', borderTop: '1px solid #eaeaea' }}>
                                <textarea
                                    value={editCustomCss}
                                    onChange={e => setEditCustomCss(e.target.value)}
                                    placeholder="/* body { background: red; } */"
                                    style={{ width: '100%', minHeight: '120px', padding: '10px', fontFamily: 'monospace', fontSize: '12px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <a href={`${apiUrl}/theme-guide`} download="chatpulse-theme-prompt.txt" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', backgroundColor: '#f0f0f0', color: '#555', textDecoration: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '500' }}>
                                <FileText size={16} /> {lang === 'en' ? 'AI Theme Prompt' : '下载 AI 主题生成�?}
                            </a>
                            <button onClick={handleExportTheme} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', backgroundColor: '#f0f0f0', color: '#555', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                                <Download size={16} /> {lang === 'en' ? 'Export JSON' : '导出配置'}
                            </button>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', backgroundColor: '#f0f0f0', color: '#555', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                                <Upload size={16} /> {lang === 'en' ? 'Import JSON' : '导入配置'}
                                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportTheme} />
                            </label>
                        </div>
                        <button onClick={handleSaveTheme} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                            <Save size={16} /> {lang === 'en' ? 'Save Theme & CSS' : '保存主题与CSS'}
                        </button>
                    </div>
                </div>

                {/* Contacts Management Section */}
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>{t('Characters')}</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {contacts.map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', border: '1px solid #f0f0f0', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <img src={c.avatar} alt={c.name} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                                    <div>
                                        <div style={{ fontWeight: '500' }}>{c.name}</div>
                                        <div style={{ fontSize: '12px', color: '#999' }}>
                                            {lang === 'en' ? 'Affinity' : '好感�?}: {c.affinity} | 💰 ¥{(c.wallet ?? 0).toFixed(2)} | {c.is_blocked ? (lang === 'en' ? '🚫 Blocked' : '🚫 已拉�?) : (lang === 'en' ? 'Active' : '正常')}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    {!!c.is_blocked && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await fetch(`${apiUrl}/characters`, {
                                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ id: c.id, affinity: 60, is_blocked: 0 })
                                                    });
                                                    onCharactersUpdate?.();
                                                } catch (e) { console.error(e); }
                                            }}
                                            style={{ background: 'none', border: '1px solid #ddd', borderRadius: '4px', color: 'var(--accent-color)', cursor: 'pointer', padding: '3px 8px', fontSize: '12px' }}
                                            title={lang === 'en' ? 'Admin Unblock & Reset Affinity' : '管理员解�?& 重置好感�?}>
                                            🔓
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleWipeData(c.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: '5px' }} title={lang === 'en' ? 'Wipe all data (Memories, Messages, etc)' : '清空数据（记忆、消息等�?}>
                                        <RefreshCw size={18} />
                                    </button>
                                    <button
                                        onClick={() => setEditingContact({ ...c, system_prompt: c.system_prompt || getDefaultGuidelines(lang) })}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: '5px' }} title={lang === 'en' ? 'Edit API endpoint, model, persona, prompt' : '编辑 API 接口、模型、人设、提示词'}>
                                        <Edit3 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteContact(c.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '5px' }} title={lang === 'en' ? 'Delete this character permanently' : '永久删除此角�?}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Group Chat Settings */}
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
                        {lang === 'en' ? '🎯 Group Chat Settings' : '🎯 群聊设置'}
                    </h2>

                    {/* Group Context Limit */}
                    <div style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                            <span>{lang === 'en' ? 'Group Context Messages' : '群聊上下文消息数'}</span>
                            <span>{profile.group_msg_limit || 20} <span style={{ fontSize: '12px', color: '#999' }}>{lang === 'en' ? '(rich context)' : '（上下文丰富�?}</span></span>
                        </div>
                        <input type="range" min="5" max="50" value={profile.group_msg_limit || 20}
                            onChange={e => {
                                const v = parseInt(e.target.value);
                                setProfile(p => ({ ...p, group_msg_limit: v }));
                                fetch(`${apiUrl}/user`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_msg_limit: v }) });
                            }}
                            style={{ width: '100%' }} />
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            {lang === 'en' ? 'Number of recent messages each AI can see in group chat. Higher = richer context, but slightly slower.'
                                : '控制每个 AI 角色在群聊回复前能看到的最近消息数量。越高上下文越丰富，但响应稍慢�?}
                        </div>
                    </div>

                    {/* Skip Reply Chance */}
                    <div style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                            <span>{lang === 'en' ? 'Chance to Skip Reply' : '不回复概�?}</span>
                            <span>{Math.round((profile.group_skip_rate || 0) * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="50" value={Math.round((profile.group_skip_rate || 0) * 100)}
                            onChange={e => {
                                const v = parseInt(e.target.value) / 100;
                                setProfile(p => ({ ...p, group_skip_rate: v }));
                                fetch(`${apiUrl}/user`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_skip_rate: v }) });
                            }}
                            style={{ width: '100%' }} />
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            {lang === 'en' ? 'Probability each character randomly skips replies. 0% = always reply, 50% = skip ~every other.'
                                : '每个角色随机跳过回复的概率�?% = 每条必回�?0% = 约每2条跳1条�?}
                        </div>
                    </div>

                    {/* Proactive Group Messaging �?frequency slider */}
                    <div style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                            <span>{lang === 'en' ? 'Proactive Messaging Frequency' : '群聊主动发消息频�?}</span>
                            <span>
                                {!profile.group_proactive_enabled
                                    ? (lang === 'en' ? 'Off' : '关闭')
                                    : `${profile.group_interval_min || 3}~${profile.group_interval_max || 10} ${lang === 'en' ? 'min' : '分钟'}`}
                            </span>
                        </div>
                        <input type="range" min="0" max="10"
                            value={(() => {
                                if (!profile.group_proactive_enabled) return 0;
                                const avg = ((profile.group_interval_min || 3) + (profile.group_interval_max || 10)) / 2;
                                return Math.max(1, Math.min(10, Math.round(11 - avg)));
                            })()}
                            onChange={e => {
                                const level = parseInt(e.target.value);
                                if (level === 0) {
                                    setProfile(p => ({ ...p, group_proactive_enabled: 0 }));
                                    fetch(`${apiUrl}/user`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_proactive_enabled: 0 }) });
                                } else {
                                    const avg = 11 - level;
                                    const min = Math.max(1, avg - 2);
                                    const max = Math.max(min, 2 * avg - min); // Ensures (min+max)/2 always matches `avg` so slider doesn't snap back
                                    setProfile(p => ({ ...p, group_proactive_enabled: 1, group_interval_min: min, group_interval_max: max }));
                                    fetch(`${apiUrl}/user`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_proactive_enabled: 1, group_interval_min: min, group_interval_max: max }) });
                                }
                            }}
                            style={{ width: '100%' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            <span>{lang === 'en' ? 'Off' : '关闭'}</span>
                            <span>{lang === 'en' ? 'Very frequent' : '非常频繁'}</span>
                        </div>
                    </div>

                    {/* Jealousy Chance */}
                    <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                            <span>{lang === 'en' ? '💚 Jealousy Chance' : '💚 嫉妒概率'}</span>
                            <span>{Math.round((profile.jealousy_chance ?? 0.3) * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={Math.round((profile.jealousy_chance ?? 0.3) * 100)}
                            onChange={e => {
                                const v = parseInt(e.target.value) / 100;
                                setProfile(p => ({ ...p, jealousy_chance: v }));
                                fetch(`${apiUrl}/user`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jealousy_chance: v }) });
                            }}
                            style={{ width: '100%' }} />
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            {lang === 'en' ? 'Probability that a character gets jealous when you chat with someone else. 0% = never, 100% = always.'
                                : '当你和别人聊天时，角色产生嫉妒的概率�?% = 从不�?00% = 总是�?}
                        </div>
                    </div>
                </div>

                {/* Wallet */}
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <h2 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
                        {lang === 'en' ? '💰 Wallet' : '💰 钱包'}
                    </h2>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                        {lang === 'en' ? 'Wallet Balance (¥):' : '钱包余额（元）：'}
                        <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-color)', marginLeft: '10px' }}>
                            ¥{(profile.wallet ?? 100).toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Data Management */}
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                    <h2 style={{ margin: '0 0 15px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Save size={20} /> {lang === 'en' ? 'Data Backup & Restore' : '数据备份与恢�?}
                    </h2>
                    <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px', lineHeight: 1.5 }}>
                        {lang === 'en' ? 'Backup your entire ChatPulse database (chats, memories, settings) as a single SQLite file, or restore from a previous backup.' : '将你整个 ChatPulse 的所有聊天记录、AI记忆、角色和设置打包下载为一个专属存档（SQLite数据库文件），或者随时上传恢复�?}
                    </p>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <a href={`${apiUrl}/system/export`} download="chatpulse.db" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: 'var(--accent-color)', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
                            <Download size={18} /> {lang === 'en' ? 'Download Full Backup (.db)' : '下载完整备份 (.db)'}
                        </a>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: '#f0f0f0', color: '#333', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                            <Upload size={18} /> {lang === 'en' ? 'Restore from Backup' : '上传并恢复存�?}
                            <input type="file" accept=".db,application/x-sqlite3,application/octet-stream" style={{ display: 'none' }} onChange={handleImportDatabase} />
                        </label>
                        <div style={{ width: '1px', height: '24px', backgroundColor: '#ddd', margin: '0 5px' }}></div>
                        <button onClick={handleSystemWipe} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: '#fff', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                            <Trash2 size={18} /> {lang === 'en' ? 'Factory Reset (Wipe All)' : '恢复出厂设置 (清空所有数�?'}
                        </button>
                    </div>
                </div>

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
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Avatar URL')}:
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    <input type="text" value={editingContact.avatar || ''} onChange={(e) => setEditingContact({ ...editingContact, avatar: e.target.value })} style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    <label style={{ cursor: 'pointer', padding: '8px 12px', backgroundColor: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                        Upload
                                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, (url) => setEditingContact({ ...editingContact, avatar: url }))} />
                                    </label>
                                </div>
                            </label>
                        </div>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                            {t('API Endpoint')}:
                            <input type="text" value={editingContact.api_endpoint || ''} onChange={(e) => setEditingContact({ ...editingContact, api_endpoint: e.target.value })} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                            {t('API Key')}:
                            <input type="password" value={editingContact.api_key || ''} onChange={(e) => setEditingContact({ ...editingContact, api_key: e.target.value })} placeholder="sk-..." style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                        </label>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Model Name')}:
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    <input type="text" value={editingContact.model_name || ''} onChange={(e) => setEditingContact({ ...editingContact, model_name: e.target.value })} style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    <button type="button" onClick={() => fetchModels(editingContact.api_endpoint, editingContact.api_key, setMainModels, setMainModelFetching, setMainModelError)} disabled={mainModelFetching}
                                        style={{ padding: '6px 10px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={13} /> {mainModelFetching ? '...' : t('Fetch Models')}
                                    </button>
                                </div>
                                {mainModelError && <span style={{ color: 'var(--danger)', fontSize: '12px' }}>{mainModelError}</span>}
                                {mainModels.length > 0 && (
                                    <select defaultValue="" onChange={e => setEditingContact({ ...editingContact, model_name: e.target.value })}
                                        style={{ marginTop: '4px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                                        <option value="" disabled>── 选择模型 ──</option>
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
                                    <input type="range" min="0.1" max="120" step="0.1" value={editingContact.interval_min || 0.1} onChange={(e) => setEditingContact({ ...editingContact, interval_min: parseFloat(e.target.value) })} />
                                    <input type="number" step="0.1" value={editingContact.interval_min || 0} onChange={(e) => setEditingContact({ ...editingContact, interval_min: parseFloat(e.target.value) })} className="autopulse-number-input" />
                                </div>
                            </label>
                            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                Max Interval (mins):
                                <div className="autopulse-interval-control" style={{ marginTop: '5px' }}>
                                    <input type="range" min="0.1" max="120" step="0.1" value={editingContact.interval_max || 0.1} onChange={(e) => setEditingContact({ ...editingContact, interval_max: parseFloat(e.target.value) })} />
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
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', padding: '10px', background: '#f5f7fa', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            <strong style={{ fontSize: '13px', color: '#4a5568' }}>Memory Extraction AI (Small Model)</strong>
                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Memory API Endpoint')}:
                                <input type="text" value={editingContact.memory_api_endpoint || ''} onChange={(e) => setEditingContact({ ...editingContact, memory_api_endpoint: e.target.value })} placeholder="e.g. https://api.openai.com/v1" style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                {t('Memory API Key')}:
                                <input type="password" value={editingContact.memory_api_key || ''} onChange={(e) => setEditingContact({ ...editingContact, memory_api_key: e.target.value })} style={{ padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', color: '#666' }}>
                                Memory Model Name:
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    <input type="text" value={editingContact.memory_model_name || ''} onChange={(e) => setEditingContact({ ...editingContact, memory_model_name: e.target.value })} placeholder="e.g. gpt-4o-mini" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                    <button type="button" onClick={() => fetchModels(editingContact.memory_api_endpoint, editingContact.memory_api_key, setMemModels, setMemModelFetching, setMemModelError)} disabled={memModelFetching}
                                        style={{ padding: '6px 10px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={13} /> {memModelFetching ? '...' : '拉取'}
                                    </button>
                                </div>
                                {memModelError && <span style={{ color: 'var(--danger)', fontSize: '12px' }}>{memModelError}</span>}
                                {memModels.length > 0 && (
                                    <select defaultValue="" onChange={e => setEditingContact({ ...editingContact, memory_model_name: e.target.value })}
                                        style={{ marginTop: '4px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                                        <option value="" disabled>── 选择模型 ──</option>
                                        {memModels.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                )}
                            </label>
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
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function TransferModal({ contact, onClose, onConfirm }) {
    const { lang } = useLanguage();
    const [amount, setAmount] = useState('0.01');
    const [note, setNote] = useState('');

    const handleConfirm = () => {
        const value = parseFloat(amount);
        if (isNaN(value) || value <= 0) {
            alert(lang === 'en' ? 'Please enter a valid amount.' : '请输入有效的金额�?);
            return;
        }
        onConfirm(value, note.trim() || (lang === 'en' ? 'Transfer' : '转账'));
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '320px', padding: '0' }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>{lang === 'en' ? 'Transfer to' : '转账�?} {contact?.name}</div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><span style={{ fontSize: '18px', color: '#999' }}>�?/span></button>
                </div>
                <div style={{ padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>{lang === 'en' ? 'Amount (¥)' : '转账金额 (¥)'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '36px', fontWeight: 'bold' }}>
                        <span style={{ marginRight: '5px', fontSize: '28px' }}>¥</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            style={{ width: '120px', fontSize: '36px', border: 'none', borderBottom: '1px solid var(--accent-color)', textAlign: 'center', outline: 'none' }}
                            step="0.01"
                            min="0.01"
                            autoFocus
                        />
                    </div>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={lang === 'en' ? "Add a note (optional)" : "添加备注 (可�?"}
                        style={{ marginTop: '20px', width: '100%', maxWidth: '200px', padding: '8px', border: 'none', borderBottom: '1px solid #ddd', textAlign: 'center', outline: 'none', fontSize: '14px', backgroundColor: 'transparent' }}
                    />
                </div>
                <div style={{ padding: '15px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={handleConfirm}
                        style={{ backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', padding: '10px 40px', borderRadius: '4px', fontSize: '16px', cursor: 'pointer', width: '100%' }}
                    >
                        {lang === 'en' ? 'Transfer' : '转账'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TransferModal;
