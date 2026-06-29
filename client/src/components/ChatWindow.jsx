import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import TransferModal from './TransferModal';
import RecommendModal from './RecommendModal';
import AvatarWithFrame from './AvatarWithFrame';
import { Send, Smile, Paperclip, Bell, Users, ShieldBan, Trash, BookOpen, Brain, MoreHorizontal, UserPlus, Gift, Heart, UserMinus, ShieldAlert, BadgeInfo, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { defaultAvatarUrl, resolveAvatarUrl } from '../utils/avatar';
import { deriveEmotion, derivePhysicalState } from '../utils/emotion';

function normalizeMessages(list = []) {
    const byId = new Map();
    list.forEach((msg, index) => {
        if (!msg || !msg.id) return;
        byId.set(msg.id, { ...msg, __fallbackIndex: index });
    });
    return Array.from(byId.values())
        .sort((a, b) => {
            const aTs = Number(a.timestamp || 0);
            const bTs = Number(b.timestamp || 0);
            if (aTs !== bTs) return aTs - bTs;
            const aId = String(a.id);
            const bId = String(b.id);
            if (aId !== bId) return aId.localeCompare(bId, 'en', { numeric: true });
            return (a.__fallbackIndex || 0) - (b.__fallbackIndex || 0);
        })
        .map((entry) => {
            const msg = { ...entry };
            delete msg.__fallbackIndex;
            return msg;
        });
}

function collapseRepeatedApiErrors(list = []) {
    const collapsed = [];
    for (const msg of Array.isArray(list) ? list : []) {
        const prev = collapsed[collapsed.length - 1];
        const isApiError = msg?.role === 'system' && String(msg?.content || '').includes('API Error');
        const sameAsPrev = prev
            && prev.role === 'system'
            && String(prev.content || '') === String(msg?.content || '')
            && String(prev._mergeType || '') === 'api_error';
        if (isApiError && sameAsPrev) {
            prev._mergedIds = Array.isArray(prev._mergedIds) ? [...prev._mergedIds, msg.id] : [prev.id, msg.id];
            prev._mergedCount = Number(prev._mergedCount || 1) + 1;
            prev.id = msg.id;
            prev.timestamp = msg.timestamp;
            continue;
        }
        collapsed.push(isApiError ? {
            ...msg,
            _mergeType: 'api_error',
            _mergedCount: 1,
            _mergedIds: [msg.id]
        } : msg);
    }
    return collapsed;
}

function createSystemErrorMessage(message, characterId) {
    return {
        id: `system-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        character_id: characterId,
        role: 'system',
        content: `[System] API Error: ${message}`,
        timestamp: Date.now()
    };
}



function SystemMessage({ text }) {
    return (
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'rgba(255, 247, 250, 0.92)', padding: '3px 10px', borderRadius: '10px' }}>
                {text}
            </span>
        </div>
    );
}

function hasPrimaryModelConfig(contact = {}) {
    return !!(
        String(contact.api_endpoint || '').trim()
        && contact.api_key_configured === true
        && String(contact.model_name || '').trim()
    );
}

function RagHeaderProgress({ progress, lang }) {
    const [displayStep, setDisplayStep] = useState(progress?.currentStep || 0);
    const prevRunRef = useRef(progress?.runId || null);

    useEffect(() => {
        if (!progress) {
            setDisplayStep(0);
            prevRunRef.current = null;
            return;
        }

        if (progress.runId && prevRunRef.current && progress.runId !== prevRunRef.current) {
            setDisplayStep(0);
            const timer = setTimeout(() => setDisplayStep(progress.currentStep || 0), 80);
            prevRunRef.current = progress.runId;
            return () => clearTimeout(timer);
        }

        prevRunRef.current = progress.runId || null;
        setDisplayStep(progress.currentStep || 0);
    }, [progress?.runId, progress?.currentStep, progress]);

    const totalSteps = Number(progress?.totalSteps || 7);
    const percent = Math.max(0, Math.min(100, Math.round((displayStep / totalSteps) * 100)));
    const pipelineSteps = [
        { key: 'switch', zh: '切题', en: 'Switch' },
        { key: 'route', zh: '路由', en: 'Route' },
        { key: 'topics', zh: '主题', en: 'Topics' },
        { key: 'decision', zh: '决策', en: 'Decision' },
        { key: 'rewrite', zh: '改写', en: 'Rewrite' },
        { key: 'retrieve', zh: '召回', en: 'Recall' },
        { key: 'answer', zh: '输出', en: 'Answer' },
    ];
    const currentKeyIndex = pipelineSteps.findIndex((step) => step.key === progress?.currentKey);
    const activeIndex = Math.min(
        pipelineSteps.length - 1,
        Math.max(0, currentKeyIndex >= 0 ? currentKeyIndex : Number(displayStep || 1) - 1)
    );
    const railPercent = pipelineSteps.length > 1
        ? Math.round((activeIndex / (pipelineSteps.length - 1)) * 100)
        : percent;
    const statusText = progress?.status === 'completed'
        ? (lang === 'en' ? 'Completed' : '\u5DF2\u5B8C\u6210')
        : progress?.status === 'error'
            ? (lang === 'en' ? 'Failed' : '\u5931\u8D25')
            : progress?.skipped
                ? (lang === 'en' ? 'Skipped to answer' : '\u8DF3\u8FC7\u524D\u7F6E\u9636\u6BB5')
                : (lang === 'en' ? 'Searching' : '\u68C0\u7D22\u4E2D');

    return (
        <div className="rag-header-rail" title={`${lang === 'en' ? 'RAG Pipeline' : 'RAG \u6D41\u7A0B'}: ${percent}% - ${statusText}`}>
            <div className="rag-header-rail__summary">
                <span className="rag-header-rail__label">RAG {statusText}</span>
                <span className="rag-header-rail__percent">{percent}%</span>
                <span className="rag-header-rail__eta">{lang === 'en' ? 'about 2-3s' : '\u9884\u8BA1 2-3 \u79D2'}</span>
            </div>
            <div className="rag-header-rail__track">
                <span
                    className="rag-header-rail__bar"
                    style={{
                        width: `${railPercent}%`,
                        animation: displayStep > 0 && progress?.status !== 'completed' ? 'ragPulse 1.8s ease-in-out infinite' : 'none'
                    }}
                />
                {pipelineSteps.map((step, index) => (
                    <span
                        key={step.key}
                        className={`rag-header-rail__step ${index < activeIndex ? 'is-complete' : ''} ${index === activeIndex ? 'is-active' : ''}`}
                        style={{ left: `${(index / (pipelineSteps.length - 1)) * 100}%` }}
                    >
                        <span className="rag-header-rail__dot" />
                        <span className="rag-header-rail__step-label">{lang === 'en' ? step.en : step.zh}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}

function ChatWindow({
    contact, allContacts, apiUrl, incomingMessageQueue, engineState,
    onToggleMemo, onToggleDiary, onToggleSettings,
    onPreloadMemo, onPreloadDiary, onPreloadSettings,
    userAvatar, userAvatarFrame, onBack, isPrivateChatForegroundEnabled = false, chatLayoutKey = 'closed'
}) {
    const { t, lang } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const PAGE_SIZE = 100;
    const prevBlockedRef = useRef(false);
    const processedIncomingMessageIdsRef = useRef(new Set());
    const deletedMessageIdsRef = useRef(new Set());
    const messagesEndRef = useRef(null);
    const isConversationPinnedToBottomRef = useRef(true);
    // contactRef keeps the current contact ID stable inside async callbacks
    const contactRef = useRef(contact);
    useEffect(() => { contactRef.current = contact; }, [contact]);

    const isCurrentlyBlocked = engineState?.[contact?.id]?.isBlocked === 1;
    const ragProgress = engineState?.[contact?.id]?.ragProgress || {
        runId: null,
        totalSteps: 7,
        currentStep: 0,
        currentKey: 'switch',
        status: 'idle',
        skipped: false
    };
    const emotion = deriveEmotion(contact || {});
    const physical = derivePhysicalState(contact || {});
    const isModelOnline = hasPrimaryModelConfig(contact);
    const displayMessages = useMemo(() => collapseRepeatedApiErrors(messages), [messages]);

    const getConversationScroller = useCallback(() => {
        const marker = messagesEndRef.current;
        return marker?.closest?.('.chat-history') || marker?.parentElement || null;
    }, []);

    const updateConversationPinnedState = useCallback(() => {
        const scroller = getConversationScroller();
        if (!scroller) return;
        const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        isConversationPinnedToBottomRef.current = distanceFromBottom <= 120;
    }, [getConversationScroller]);

    const scrollToConversationEnd = useCallback((behavior = 'smooth') => {
        const scroller = getConversationScroller();
        if (!scroller) return;

        const shouldReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const scrollBehavior = shouldReduceMotion ? 'auto' : behavior;
        if (typeof scroller.scrollTo === 'function') {
            scroller.scrollTo({ top: scroller.scrollHeight, behavior: scrollBehavior });
        } else {
            scroller.scrollTop = scroller.scrollHeight;
        }
        isConversationPinnedToBottomRef.current = true;
    }, [getConversationScroller]);

    const scrollToConversationEndAfterLayout = useCallback((behavior = 'smooth', delays = []) => {
        let secondFrame = null;
        const timeoutIds = [];
        const firstFrame = window.requestAnimationFrame(() => {
            scrollToConversationEnd('auto');
            secondFrame = window.requestAnimationFrame(() => scrollToConversationEnd(behavior));
        });
        delays.forEach((delay, index) => {
            timeoutIds.push(window.setTimeout(() => {
                scrollToConversationEnd(index === 0 ? 'auto' : behavior);
            }, delay));
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
            timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
        };
    }, [scrollToConversationEnd]);

    const fetchLatestMessages = useCallback((options = {}) => {
        if (!contactRef.current?.id) return Promise.resolve();
        if (options.clear) {
            setMessages([]);
            setHasMore(false);
        }
        return fetch(`${apiUrl}/messages/${contactRef.current.id}?limit=${PAGE_SIZE}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } })
            .then(res => res.json())
            .then(data => {
                setMessages(normalizeMessages(data));
                // If we got a full page, there are probably more older messages
                setHasMore(data.length >= PAGE_SIZE);
            })
            .catch(err => console.error('Failed to load messages:', err));
    }, [apiUrl]);

    // Fetch most recent messages when contact changes
    useEffect(() => {
        if (!contact?.id) return;
        fetchLatestMessages({ clear: true });
    }, [contact?.id, fetchLatestMessages]);

    useEffect(() => {
        const refreshActiveMessages = (event) => {
            const characterId = event?.detail?.characterId || event?.detail?.charId || event?.detail?.data?.character_id || '';
            if (characterId && characterId !== contactRef.current?.id) return;
            fetchLatestMessages();
        };
        window.addEventListener('city_update', refreshActiveMessages);
        window.addEventListener('ws_reconnected', refreshActiveMessages);
        return () => {
            window.removeEventListener('city_update', refreshActiveMessages);
            window.removeEventListener('ws_reconnected', refreshActiveMessages);
        };
    }, [fetchLatestMessages]);

    useEffect(() => {
        const handleTtsReady = (event) => {
            const data = event?.detail || {};
            if (!data.message_id || data.character_id !== contactRef.current?.id) return;
            setMessages(prev => normalizeMessages(prev.map(msg => {
                if (String(msg.id) !== String(data.message_id)) return msg;
                return {
                    ...msg,
                    metadata: {
                        ...(msg.metadata || {}),
                        tts: {
                            ...(msg.metadata?.tts || {}),
                            status: data.status || 'ready',
                            audio_url: data.audio_url || msg.metadata?.tts?.audio_url || '',
                            provider: data.provider || msg.metadata?.tts?.provider || '',
                            voice: data.voice || msg.metadata?.tts?.voice || '',
                            model: data.model || msg.metadata?.tts?.model || '',
                            autoplay: data.autoplay === true,
                            error: data.error || ''
                        }
                    }
                };
            })));
        };
        window.addEventListener('tts_ready', handleTtsReady);
        return () => window.removeEventListener('tts_ready', handleTtsReady);
    }, []);

    useEffect(() => {
        const handleCharacterDataWiped = (event) => {
            if (event.detail?.characterId !== contactRef.current?.id) return;
            setMessages([]);
            setHasMore(false);
            setSelectedIds(new Set());
            setSelectMode(false);
        };
        window.addEventListener('character_data_wiped', handleCharacterDataWiped);
        return () => window.removeEventListener('character_data_wiped', handleCharacterDataWiped);
    }, []);

    const loadMore = async () => {
        if (loadingMore || messages.length === 0) return;
        setLoadingMore(true);
        const oldest = messages[0];
        try {
            const data = await fetch(
                `${apiUrl}/messages/${contactRef.current?.id}?limit=${PAGE_SIZE}&before=${oldest.id}`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }
            ).then(r => r.json());
            if (data.length > 0) {
                setMessages(prev => normalizeMessages([...data, ...prev]));
                setHasMore(data.length >= PAGE_SIZE);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error('Failed to load more:', e);
        }
        setLoadingMore(false);
    };

    // Handle new incoming WS messages Queue
    useEffect(() => {
        if (incomingMessageQueue && incomingMessageQueue.length > 0 && contact?.id) {
            const relevantMsgs = incomingMessageQueue.filter((m) => {
                if (!m || m.character_id !== contact.id || !m.id) return false;
                const messageId = `${contact.id}:${m.id}`;
                if (deletedMessageIdsRef.current.has(messageId)) return false;
                if (processedIncomingMessageIdsRef.current.has(messageId)) return false;
                processedIncomingMessageIdsRef.current.add(messageId);
                return true;
            });
            if (relevantMsgs.length > 0) {
                setMessages(prev => normalizeMessages([...prev, ...relevantMsgs]));
            }
        }
    }, [incomingMessageQueue, contact?.id]);

    // Detect when a character goes from unblocked -> blocked mid-session and inject a system message
    useEffect(() => {
        const isBlocked = engineState?.[contact?.id]?.isBlocked === 1;
        if (isBlocked && !prevBlockedRef.current) {
            setMessages(prev => normalizeMessages([...prev, {
                id: `block - event - ${Date.now()} `,
                character_id: contact?.id,
                role: 'system',
                content: `[System] ${contact?.name} \u5DF2\u5C06\u4F60\u62C9\u9ED1\u3002`,
                timestamp: Date.now()
            }]));
        }
        prevBlockedRef.current = isBlocked;
    }, [engineState, contact?.id, contact?.name]);

    useEffect(() => {
        scrollToConversationEnd('smooth');
    }, [messages, scrollToConversationEnd]);

    useEffect(() => {
        if (!isPrivateChatForegroundEnabled) return undefined;

        return scrollToConversationEndAfterLayout('smooth');
    }, [isPrivateChatForegroundEnabled, scrollToConversationEndAfterLayout]);

    useEffect(() => {
        return scrollToConversationEndAfterLayout('smooth');
    }, [selectMode, scrollToConversationEndAfterLayout]);

    useEffect(() => {
        return scrollToConversationEndAfterLayout('smooth', [60, 160, 320, 620]);
    }, [chatLayoutKey, scrollToConversationEndAfterLayout]);

    useEffect(() => {
        const scroller = getConversationScroller();
        if (!scroller || typeof ResizeObserver === 'undefined') return undefined;

        let cancelPendingScroll = null;
        const observer = new ResizeObserver(() => {
            if (!isConversationPinnedToBottomRef.current) return;
            if (cancelPendingScroll) cancelPendingScroll();
            cancelPendingScroll = scrollToConversationEndAfterLayout('auto', [90, 220]);
        });

        observer.observe(scroller);
        const chatMain = scroller.closest?.('.private-chat-main');
        if (chatMain) observer.observe(chatMain);

        return () => {
            observer.disconnect();
            if (cancelPendingScroll) cancelPendingScroll();
        };
    }, [chatLayoutKey, getConversationScroller, scrollToConversationEndAfterLayout]);



    const handleSend = async (text) => {
        const currentContactId = contactRef.current?.id;
        if (!currentContactId) return false;
        const optimisticId = `temp-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimisticMessage = {
            id: optimisticId,
            character_id: currentContactId,
            role: 'user',
            content: text,
            timestamp: Date.now()
        };

        setMessages(prev => normalizeMessages([...prev, optimisticMessage]));

        try {
            const res = await fetch(`${apiUrl}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ characterId: currentContactId, content: text })
            });
            const data = await res.json().catch(() => ({}));
            // Only update state if we're still looking at the same contact
            if (contactRef.current?.id !== currentContactId) return false;
            if (!res.ok) {
                const errorText = String(data?.error || data?.message || `HTTP ${res.status}`);
                setMessages(prev => normalizeMessages([
                    ...prev.filter(msg => msg.id !== optimisticId),
                    createSystemErrorMessage(errorText, currentContactId)
                ]));
                return false;
            }
            const savedMessage = data.blocked && data.message
                ? { ...data.message, isBlocked: true }
                : data.message;
            if (savedMessage) {
                setMessages(prev => normalizeMessages([
                    ...prev.filter(msg => msg.id !== optimisticId),
                    savedMessage
                ]));
            } else {
                setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
            }
            if (data.blocked && data.message) {
                return true;
            }
            return true;
        } catch (e) {
            console.error('Failed to send:', e);
            if (contactRef.current?.id === currentContactId) {
                setMessages(prev => normalizeMessages([
                    ...prev.filter(msg => msg.id !== optimisticId),
                    createSystemErrorMessage(e?.message || 'Network error', currentContactId)
                ]));
            }
            return false;
        }
    };

    const handleRetry = async (failedMessageId) => {
        const currentContactId = contactRef.current?.id;
        if (!currentContactId) return;

        // Optimistically remove the error message from the UI right away
        setMessages(prev => prev.filter(m => m.id !== failedMessageId));

        try {
            await fetch(`${apiUrl}/messages/${currentContactId}/retry`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ failedMessageId })
            });
            // We just trigger the retry; the WS will handle pushing the new message when ready
        } catch (e) {
            console.error('Failed to retry message:', e);
        }
    };

    const handleTransfer = async (amount, note) => {
        const currentContactId = contactRef.current?.id;
        setIsTransferModalOpen(false);
        try {
            const res = await fetch(`${apiUrl}/characters/${currentContactId}/transfer`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, note })
            });
            const data = await res.json();
            if (data.success && contactRef.current?.id === currentContactId) {
                // Refresh messages to pick up the new transfer message with tid
                const updated = await fetch(`${apiUrl}/messages/${currentContactId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }).then(r => r.json());
                setMessages(normalizeMessages(updated));
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
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetCharId })
            });
            const data = await res.json();
            if (data.success) {
                const updated = await fetch(`${apiUrl}/messages/${contactRef.current?.id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }).then(r => r.json());
                setMessages(normalizeMessages(updated));
            } else {
                alert(lang === 'en' ? 'Failed to recommend contact: ' + data.error : '推荐联系人失败: ' + data.error);
            }
        } catch (e) {
            console.error('Failed to recommend contact:', e);
            alert(lang === 'en' ? 'Network error.' : '网络错误。');
        }
    };

    // No-op string replacement to remove handleClearMemory



    if (!contact) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                <span className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', color: 'var(--accent-color)' }}></span>
            </div>
        );
    }

    return (
        <>
            <div className="chat-header">
                <div className="chat-header-main">
                    <button className="mobile-back-btn" onClick={onBack} title="Back">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="chat-header-avatar-shell">
                        <AvatarWithFrame
                            size={88}
                            frame={contact.avatar_frame}
                            src={resolveAvatarUrl(contact.avatar, apiUrl, contact.name || contact.id || 'User')}
                            alt={contact.name}
                            fallbackSrc={defaultAvatarUrl(contact.name || contact.id || 'User')}
                        />
                    </div>
                    <div className="chat-header-meta">
                        <div className="chat-header-identity">
                            <span className="chat-header-name-text">{contact.name}</span>
                            <span className={`chat-header-model-status ${isModelOnline ? 'online' : 'offline'}`}>
                                <span className="chat-header-model-status__dot" />
                                {isModelOnline ? (lang === 'en' ? 'Online' : '在线') : (lang === 'en' ? 'Offline' : '离线')}
                            </span>
                        </div>
                        <div className="chat-header-chips">
                            <span className="chat-state-chip" title="心理状态" style={{ color: emotion.color }}>
                                {emotion.emoji} {emotion.label}
                            </span>
                            <span className="chat-state-chip" title="生理状态" style={{ color: physical.color }}>
                                {physical.emoji} {physical.label}
                            </span>
                            <span className="chat-state-chip chat-state-chip--energy" title={lang === 'en' ? 'Energy' : '精力'}>
                                {lang === 'en' ? 'Energy 72' : '精力 72'}
                            </span>
                            {engineState?.[contact.id]?.isBlocked === 1 && <span className="chat-blocked-chip">(Blocked) [X]</span>}
                        </div>
                        <RagHeaderProgress progress={ragProgress} lang={lang} />
                    </div>
                </div>
                <div className="chat-header-actions">
                    <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }} title={lang === 'en' ? 'Select Messages' : '选择消息'}
                        style={selectMode ? { color: 'var(--accent-color)', background: 'rgba(var(--accent-rgb, 74,144,226), 0.12)', borderRadius: '8px' } : {}}>
                        <Trash size={20} />
                        <span>{lang === 'en' ? 'Select' : '选择消息'}</span>
                    </button>
                    <button onClick={() => setIsRecommendModalOpen(true)} title={lang === 'en' ? 'Recommend Contact' : '推荐联系人'}>
                        <UserPlus size={20} />
                        <span>{lang === 'en' ? 'Recommend' : '推荐联系人'}</span>
                    </button>
                    <button onPointerEnter={onPreloadMemo} onFocus={onPreloadMemo} onClick={onToggleMemo} title={t('Memories')}>
                        <Brain size={20} />
                        <span>{lang === 'en' ? 'Memory' : '记忆'}</span>
                    </button>
                    <button onPointerEnter={onPreloadDiary} onFocus={onPreloadDiary} onClick={onToggleDiary} title={t('Secret Diary')}>
                        <BookOpen size={20} />
                        <span>{lang === 'en' ? 'Diary' : '日记'}</span>
                    </button>
                    <button onPointerEnter={onPreloadSettings} onFocus={onPreloadSettings} onClick={onToggleSettings} title={t('Chat Settings')}>
                        <MoreHorizontal size={20} />
                        <span>{lang === 'en' ? 'Settings' : '聊天设置'}</span>
                    </button>
                </div>
            </div>

            {isCurrentlyBlocked && (
                <div style={{ textAlign: 'center', padding: '8px', background: '#ffebeb', color: 'var(--danger)', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #ffcccc' }}>
                    You are blocked by {contact.name}. You cannot send messages.
                </div>
            )}

            <div className="chat-history" onScroll={updateConversationPinnedState}>
                {hasMore && (
                    <div style={{ textAlign: 'center', padding: '10px' }}>
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            style={{
                                fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255, 247, 250, 0.92)',
                                border: '1px solid #ddd', borderRadius: '12px',
                                padding: '5px 16px', cursor: 'pointer'
                            }}
                        >
                            {loadingMore ? t('Loading') : (lang === 'en' ? '↑ Load older messages' : '↑ 加载更早的消息')}
                        </button>
                    </div>
                )}
                {displayMessages.map((msg, idx) => {
                    const currentLimit = contact?.context_msg_limit || 60;
                    const isBoundary = idx === Math.max(0, displayMessages.length - currentLimit) && displayMessages.length > currentLimit;
                    const boundaryElement = isBoundary ? (
                        <div key={`boundary-${msg.id}`} style={{ textAlign: 'center', margin: '30px 0', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ borderBottom: '1px dashed #ccc', position: 'absolute', top: '20px', left: '10%', right: '10%' }}></div>
                            <span style={{ background: 'rgba(255, 247, 250, 0.94)', padding: '0 15px', color: 'var(--text-warm)', fontSize: '12px', fontWeight: 'bold', position: 'relative', zIndex: 1, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                [AI] {lang === 'en' ? 'AI Vision Boundary' : 'AI \u89C6\u754C\u8FB9\u754C'} [AI]
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', position: 'relative', zIndex: 1, backgroundColor: 'rgba(255, 247, 250, 0.94)', padding: '0 10px' }}>
                                {lang === 'en' ? 'AI can only "see" messages below this line' : '\u6A21\u578B\u53EA\u80FD\u611F\u77E5\u6B64\u7EBF\u4EE5\u4E0B\u7684\u6D88\u606F'}
                            </div>
                        </div>
                    ) : null;

                    const isSelected = selectedIds.has(msg.id);
                    return (
                        <React.Fragment key={msg.id}>
                            {boundaryElement}
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: '0px',
                                ...(isSelected ? { backgroundColor: 'rgba(var(--accent-rgb, 74,144,226), 0.08)', borderRadius: '8px' } : {})
                            }}
                            onClick={selectMode ? () => {
                                setSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(msg.id)) next.delete(msg.id);
                                    else next.add(msg.id);
                                    return next;
                                });
                            } : undefined}
                        >
                            {selectMode && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    minWidth: '32px', paddingTop: '12px', cursor: 'pointer'
                                }}>
                                    <div style={{
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        border: isSelected ? 'none' : '2px solid #ccc',
                                        backgroundColor: isSelected ? 'var(--accent-color, #4a90e2)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.15s ease'
                                    }}>
                                        {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>\u2713</span>}
                                    </div>
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <MessageBubble
                                    message={msg}
                                    characterName={contact.name}
                                    avatar={msg.role === 'user' ? (userAvatar || defaultAvatarUrl('User')) : (contact.avatar || defaultAvatarUrl(contact.name || contact.id || 'User'))}
                                    avatarFrame={msg.role === 'user' ? userAvatarFrame : contact.avatar_frame}
                                    apiUrl={apiUrl}
                                    onRetry={handleRetry}
                                    contacts={allContacts}
                                />
                            </div>
                        </div>
                        </React.Fragment>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Floating delete bar when in select mode */}
            {selectMode && (
                <div className="select-action-bar private-select-action-bar" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', background: '#fff', borderTop: '1px solid #eee',
                    boxShadow: '0 -2px 8px rgba(0,0,0,0.06)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => {
                                if (selectedIds.size === messages.length) setSelectedIds(new Set());
                                else setSelectedIds(new Set(messages.map(m => m.id)));
                            }}
                            style={{ fontSize: '13px', color: 'var(--accent-color, #4a90e2)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                        >
                            {selectedIds.size === messages.length ? (lang === 'en' ? 'Deselect All' : '\u53D6\u6D88\u5168\u9009') : (lang === 'en' ? 'Select All' : '\u5168\u9009')}
                        </button>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {lang === 'en' ? `${selectedIds.size} selected` : `\u5DF2\u9009\u62E9 ${selectedIds.size} \u6761`}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                            style={{ padding: '6px 16px', fontSize: '13px', background: 'rgba(255, 247, 250, 0.92)', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                            {lang === 'en' ? 'Cancel' : '\u53D6\u6D88'}
                        </button>
                        <button
                            disabled={selectedIds.size === 0}
                            onClick={async () => {
                                if (selectedIds.size === 0) return;
                                const confirmMsg = lang === 'en'
                                    ? `Permanently delete ${selectedIds.size} message(s)?`
                                    : `\u786E\u5B9A\u6C38\u4E45\u5220\u9664 ${selectedIds.size} \u6761\u6D88\u606F\u5417\uFF1F`; 
                                if (!confirm(confirmMsg)) return;
                                try {
                                    const deletingContactId = contactRef.current?.id;
                                    const res = await fetch(`${apiUrl}/messages/batch-delete`, {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ characterId: deletingContactId, messageIds: [...selectedIds] })
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                        [...selectedIds].forEach(id => deletedMessageIdsRef.current.add(`${deletingContactId}:${id}`));
                                        setMessages(prev => (
                                            contactRef.current?.id === deletingContactId
                                                ? prev.filter(m => !selectedIds.has(m.id))
                                                : prev
                                        ));
                                        setSelectedIds(new Set());
                                        setSelectMode(false);
                                    }
                                } catch (e) {
                                    console.error('Batch delete failed:', e);
                                }
                            }}
                            style={{
                                padding: '6px 16px', fontSize: '13px', fontWeight: '600',
                                background: selectedIds.size > 0 ? '#e74c3c' : '#ddd',
                                color: '#fff', border: 'none', borderRadius: '8px',
                                cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed'
                            }}
                        >
                            <Trash size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            {lang === 'en' ? 'Delete' : '\u5220\u9664'}
                        </button>
                    </div>
                </div>
            )}

            {/* Normal input bar — hidden while in select mode */}
            {!selectMode && (
                <InputBar
                    onSend={handleSend}
                    onTransfer={() => setIsTransferModalOpen(true)}
                />
            )}
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
