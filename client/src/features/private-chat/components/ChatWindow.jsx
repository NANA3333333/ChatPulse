import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MessageBubble from "../../conversation-ui/components/MessageBubble.jsx";
import PrivateReplyControls from "./PrivateReplyControls";
import MessageOperationNotice from "./MessageOperationNotice";
import { useReplyVersions } from "../useReplyVersions";
import { useMessageActions } from "../useMessageActions";
import { normalizeMessages } from "../messages";
import { fetchMessageHistory } from "../api";
import InputBar from "./InputBar.jsx";
import TransferModal from "../../economy/components/TransferModal.jsx";
import RecommendModal from "../../relationships/components/RecommendModal.jsx";
import AvatarWithFrame from "../../../shared/media/AvatarWithFrame.jsx";
import ConversationSearchPanel from "../../conversation-search/components/ConversationSearchPanel.jsx";
import { Send, Smile, Paperclip, Bell, Users, ShieldBan, Trash, BookOpen, Brain, MoreHorizontal, UserPlus, Gift, Heart, UserMinus, ShieldAlert, BadgeInfo, ChevronLeft, Search } from 'lucide-react';
import { useLanguage } from "../../../shared/i18n/LanguageContext.jsx";
import { defaultAvatarUrl, resolveAvatarUrl } from "../../../shared/media/avatar.js";
import { deriveEmotion, derivePhysicalState, getStateDisplayLabel } from "../../characters/emotion.js";

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
        ? Math.round((Math.max(activeIndex, 0) / (pipelineSteps.length - 1)) * 100)
        : percent;
    const activeSegment = pipelineSteps.length > 1
        ? Math.round((100 / (pipelineSteps.length - 1)) * 100) / 100
        : 100;
    const railStyle = {
        '--rag-active-position': `${railPercent}%`,
        '--rag-active-segment': `${activeSegment}%`
    };
    const statusText = progress?.status === 'completed'
        ? (lang === 'en' ? 'Completed' : '\u5DF2\u5B8C\u6210')
        : progress?.status === 'error'
            ? (lang === 'en' ? 'Failed' : '\u5931\u8D25')
            : progress?.skipped
                ? (lang === 'en' ? 'Skipped to answer' : '\u8DF3\u8FC7\u524D\u7F6E\u9636\u6BB5')
                : (lang === 'en' ? 'Searching' : '\u68C0\u7D22\u4E2D');

    return (
        <div
            className="rag-header-rail"
            style={railStyle}
            title={`${lang === 'en' ? 'RAG Pipeline' : 'RAG \u6D41\u7A0B'}: ${percent}% - ${statusText}`}
        >
            <div className="rag-header-rail__summary">
                <span className="rag-header-rail__label">RAG {statusText}</span>
                <span className="rag-header-rail__percent">{percent}%</span>
                <span className="rag-header-rail__eta">{lang === 'en' ? 'about 2-3s' : '\u9884\u8BA1 2-3 \u79D2'}</span>
            </div>
            <div className="rag-header-rail__track">
                <div className="rag-header-rail__steps">
                    <span
                        className="rag-header-rail__bar"
                        style={{
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
        </div>
    );
}

function ChatWindow({
    contact, allContacts, apiUrl, incomingMessageQueue, engineState,
    onToggleMemo, onToggleDiary, onToggleSettings,
    onPreloadMemo, onPreloadDiary, onPreloadSettings,
    userAvatar, userAvatarFrame, onBack, isPrivateChatForegroundEnabled = false, chatLayoutKey = 'closed',
    jumpTarget, onSearchResultSelect, onJumpHandled
}) {
    const { t, lang } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showConversationSearch, setShowConversationSearch] = useState(false);
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const [isSearchContextWindow, setIsSearchContextWindow] = useState(false);
    const [hasNewer, setHasNewer] = useState(false);
    const [loadingNewer, setLoadingNewer] = useState(false);

    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const PAGE_SIZE = 100;
    const prevBlockedRef = useRef(false);
    const processedIncomingMessageIdsRef = useRef(new Set());
    const deletedMessageIdsRef = useRef(new Set());
    const messagesEndRef = useRef(null);
    const messageElementsRef = useRef(new Map());
    const pendingJumpMessageIdRef = useRef(null);
    const searchHighlightTimerRef = useRef(null);
    const isConversationPinnedToBottomRef = useRef(true);
    const onJumpHandledRef = useRef(onJumpHandled);
    // contactRef keeps the current contact ID stable inside async callbacks
    const contactRef = useRef(contact);
    useEffect(() => { contactRef.current = contact; }, [contact]);
    useEffect(() => { onJumpHandledRef.current = onJumpHandled; }, [onJumpHandled]);

    const { replyAction, changeReplyVersion } = useReplyVersions({
        apiUrl, characterId: contact?.id, lang, setMessages, deletedMessageIdsRef
    });

    const { handleSend, handleRetry, handleDelete, messageNotice, dismissMessageNotice, reportMessageError } = useMessageActions({
        apiUrl, contactRef, setMessages, deletedMessageIdsRef,
        prepareSend: () => {
            isConversationPinnedToBottomRef.current = true;
            setIsSearchContextWindow(false);
            setHasNewer(false);
        }
    });

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
    const jumpToken = String(jumpTarget?.token || '');
    const jumpMessageId = useMemo(() => {
        const targetMessageId = Number(jumpTarget?.messageId || jumpTarget?.message_id || 0);
        const targetCharacterId = String(jumpTarget?.characterId || jumpTarget?.character_id || '').trim();
        if (!Number.isSafeInteger(targetMessageId) || targetMessageId <= 0) return 0;
        if (String(jumpTarget?.scope || 'private') !== 'private') return 0;
        if (!contact?.id || targetCharacterId !== String(contact.id)) return 0;
        return targetMessageId;
    }, [contact?.id, jumpTarget]);
    const jumpMessageIdRef = useRef(jumpMessageId);
    useEffect(() => { jumpMessageIdRef.current = jumpMessageId; }, [jumpMessageId]);

    const getConversationScroller = useCallback(() => {
        const marker = messagesEndRef.current;
        return marker?.closest?.('.chat-history') || marker?.parentElement || null;
    }, []);

    const setMessageElement = useCallback((messageId, node) => {
        const key = String(messageId || '');
        if (!key) return;
        if (node) {
            messageElementsRef.current.set(key, node);
        } else {
            messageElementsRef.current.delete(key);
        }
    }, []);

    const scrollToMessage = useCallback((messageId) => {
        const key = String(messageId || '');
        if (!key) return false;
        const node = messageElementsRef.current.get(key);
        if (!node) return false;
        const shouldReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        node.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'center' });
        isConversationPinnedToBottomRef.current = false;
        setHighlightedMessageId(key);
        if (searchHighlightTimerRef.current) window.clearTimeout(searchHighlightTimerRef.current);
        searchHighlightTimerRef.current = window.setTimeout(() => {
            setHighlightedMessageId((current) => (current === key ? null : current));
            searchHighlightTimerRef.current = null;
        }, 2600);
        return true;
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
            setIsSearchContextWindow(false);
            setHasNewer(false);
            isConversationPinnedToBottomRef.current = true;
        }
        const characterId = contactRef.current.id;
        return fetchMessageHistory({ apiUrl, characterId, limit: PAGE_SIZE })
            .then(data => {
                if (contactRef.current?.id !== characterId) return;
                setMessages(normalizeMessages(data));
                setIsSearchContextWindow(false);
                setHasNewer(false);
                // If we got a full page, there are probably more older messages
                setHasMore(data.length >= PAGE_SIZE);
            })
            .catch(error => {
                if (contactRef.current?.id === characterId) reportMessageError(error, characterId);
            });
    }, [apiUrl, reportMessageError]);

    // Fetch most recent messages when contact changes
    useEffect(() => {
        if (!contact?.id) return;
        setShowConversationSearch(false);
        setLoadingMore(false);
        setLoadingNewer(false);
        if (jumpMessageIdRef.current) {
            setMessages([]);
            setHasMore(false);
            setHasNewer(false);
            return;
        }
        fetchLatestMessages({ clear: true });
    }, [contact?.id, fetchLatestMessages]);

    useEffect(() => () => {
        if (searchHighlightTimerRef.current) window.clearTimeout(searchHighlightTimerRef.current);
    }, []);

    useEffect(() => {
        if (!jumpMessageId || !contact?.id || !jumpToken) return undefined;
        let cancelled = false;
        const handledTarget = {
            scope: 'private',
            messageId: jumpMessageId,
            characterId: contact.id,
            token: jumpToken
        };
        pendingJumpMessageIdRef.current = jumpMessageId;
        isConversationPinnedToBottomRef.current = false;
        setShowConversationSearch(false);
        setIsSearchContextWindow(true);
        setHasNewer(false);
        setLoadingMore(false);
        fetchMessageHistory({ apiUrl, characterId: contact.id, limit: PAGE_SIZE, around: jumpMessageId })
            .then(data => {
                if (cancelled || contactRef.current?.id !== contact.id) return;
                const list = Array.isArray(data) ? data : [];
                setMessages(normalizeMessages(list));
                setHasMore(list.length >= PAGE_SIZE);
                setHasNewer(list.length > 0);
            })
            .catch(err => {
                if (!cancelled) reportMessageError(err, contact.id);
            })
            .finally(() => {
                if (!cancelled) onJumpHandledRef.current?.(handledTarget);
            });
        return () => {
            cancelled = true;
        };
    }, [apiUrl, contact?.id, jumpMessageId, jumpToken, reportMessageError]);

    useEffect(() => {
        const refreshActiveMessages = (event) => {
            const characterId = event?.detail?.characterId || event?.detail?.charId || event?.detail?.data?.character_id || '';
            if (characterId && characterId !== contactRef.current?.id) return;
            if (!isConversationPinnedToBottomRef.current) return;
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
                if (String(msg.id) !== String(data.message_id) || msg.metadata?.replyVersion?.revision > 0) return msg;
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
            setIsSearchContextWindow(false);
            setHasNewer(false);
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
        const characterId = contactRef.current?.id;
        try {
            const data = await fetchMessageHistory({ apiUrl, characterId, limit: PAGE_SIZE, before: oldest.id });
            if (contactRef.current?.id !== characterId) return;
            if (data.length > 0) {
                setMessages(prev => normalizeMessages([...data, ...prev]));
                setHasMore(data.length >= PAGE_SIZE);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            if (contactRef.current?.id === characterId) reportMessageError(e, characterId);
        } finally {
            if (contactRef.current?.id === characterId) setLoadingMore(false);
        }
    };

    const loadNewerMessages = useCallback(async () => {
        if (loadingNewer || messages.length === 0 || !contactRef.current?.id) return;
        const newestId = messages.reduce((maxId, msg) => {
            const id = Number(msg?.id);
            return Number.isSafeInteger(id) && id > maxId ? id : maxId;
        }, 0);
        if (!newestId) {
            setHasNewer(false);
            return;
        }
        setLoadingNewer(true);
        const characterId = contactRef.current.id;
        try {
            const data = await fetchMessageHistory({ apiUrl, characterId, limit: PAGE_SIZE, after: newestId });
            if (contactRef.current?.id !== characterId) return;
            const list = Array.isArray(data) ? data : [];
            if (list.length > 0) {
                isConversationPinnedToBottomRef.current = false;
                setMessages(prev => {
                    const seen = new Set(prev.map(msg => String(msg.id)));
                    const fresh = list.filter(msg => !seen.has(String(msg.id)));
                    return fresh.length > 0 ? normalizeMessages([...prev, ...fresh]) : prev;
                });
            }
            setHasNewer(list.length >= PAGE_SIZE);
        } catch (e) {
            if (contactRef.current?.id === characterId) reportMessageError(e, characterId);
        } finally {
            if (contactRef.current?.id === characterId) setLoadingNewer(false);
        }
    }, [apiUrl, loadingNewer, messages, reportMessageError]);

    const handleConversationScroll = useCallback(() => {
        updateConversationPinnedState();
        if (!isSearchContextWindow || !hasNewer || loadingNewer) return;
        const scroller = getConversationScroller();
        if (!scroller) return;
        const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        if (distanceFromBottom <= 80) {
            loadNewerMessages();
        }
    }, [getConversationScroller, hasNewer, isSearchContextWindow, loadingNewer, loadNewerMessages, updateConversationPinnedState]);

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
        if (pendingJumpMessageIdRef.current) return;
        if (!isConversationPinnedToBottomRef.current) return;
        scrollToConversationEnd('smooth');
    }, [messages, scrollToConversationEnd]);

    useEffect(() => {
        const targetMessageId = pendingJumpMessageIdRef.current;
        if (!targetMessageId) return undefined;
        let secondFrame = null;
        const timeoutIds = [];
        const tryScroll = () => {
            if (scrollToMessage(targetMessageId)) {
                pendingJumpMessageIdRef.current = null;
            }
        };
        const firstFrame = window.requestAnimationFrame(() => {
            tryScroll();
            secondFrame = window.requestAnimationFrame(tryScroll);
        });
        [120, 280, 520].forEach((delay) => {
            timeoutIds.push(window.setTimeout(tryScroll, delay));
        });
        return () => {
            window.cancelAnimationFrame(firstFrame);
            if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
            timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
        };
    }, [messages, scrollToMessage]);

    useEffect(() => {
        if (!isPrivateChatForegroundEnabled) return undefined;
        if (pendingJumpMessageIdRef.current || !isConversationPinnedToBottomRef.current) return undefined;

        return scrollToConversationEndAfterLayout('smooth');
    }, [isPrivateChatForegroundEnabled, scrollToConversationEndAfterLayout]);

    useEffect(() => {
        if (pendingJumpMessageIdRef.current || !isConversationPinnedToBottomRef.current) return undefined;
        return scrollToConversationEndAfterLayout('smooth');
    }, [selectMode, scrollToConversationEndAfterLayout]);

    useEffect(() => {
        if (pendingJumpMessageIdRef.current || !isConversationPinnedToBottomRef.current) return undefined;
        return scrollToConversationEndAfterLayout('smooth', [60, 160, 320, 620]);
    }, [chatLayoutKey, scrollToConversationEndAfterLayout]);

    useEffect(() => {
        const scroller = getConversationScroller();
        if (!scroller || typeof ResizeObserver === 'undefined') return undefined;

        let cancelPendingScroll = null;
        const observer = new ResizeObserver(() => {
            if (pendingJumpMessageIdRef.current) return;
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



    // Message mutations are owned by useMessageActions.

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
                const updated = await fetchMessageHistory({ apiUrl, characterId: currentContactId });
                if (contactRef.current?.id !== currentContactId) return;
                setIsSearchContextWindow(false);
                setHasNewer(false);
                setMessages(normalizeMessages(updated));
            }
        } catch (e) {
            console.error('Transfer failed:', e);
        }
    };

    const handleRecommendContact = async (targetCharId) => {
        const currentContactId = contactRef.current?.id;
        setIsRecommendModalOpen(false);
        try {
            const res = await fetch(`${apiUrl}/characters/${currentContactId}/friends`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_id: targetCharId })
            });
            const data = await res.json();
            if (data.success) {
                const updated = await fetchMessageHistory({ apiUrl, characterId: currentContactId });
                if (contactRef.current?.id !== currentContactId) return;
                setIsSearchContextWindow(false);
                setHasNewer(false);
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
                    <button className="mobile-back-btn" onClick={onBack} title={lang === 'en' ? 'Back' : '返回'}>
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
                            <span className="chat-state-chip" title={lang === 'en' ? 'Emotional state' : '心理状态'} style={{ color: emotion.color }}>
                                {emotion.emoji} {getStateDisplayLabel(emotion, lang)}
                            </span>
                            <span className="chat-state-chip" title={lang === 'en' ? 'Physical state' : '生理状态'} style={{ color: physical.color }}>
                                {physical.emoji} {getStateDisplayLabel(physical, lang)}
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
                    <button onClick={() => setShowConversationSearch(value => !value)} title={lang === 'en' ? 'Search all conversations' : '搜索全部对话'}
                        style={showConversationSearch ? { color: 'var(--accent-color)', background: 'rgba(var(--accent-rgb, 74,144,226), 0.12)', borderRadius: '8px' } : {}}>
                        <Search size={20} />
                        <span>{lang === 'en' ? 'Search' : '搜索'}</span>
                    </button>
                    <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }} title={lang === 'en' ? 'Select Messages' : '选择消息'}
                        style={selectMode ? { color: 'var(--accent-color)', background: 'rgba(var(--accent-rgb, 74,144,226), 0.12)', borderRadius: '8px' } : {}}>
                        <Trash size={20} />
                        <span>{lang === 'en' ? 'Select' : '选择消息'}</span>
                    </button>
                    <button onClick={() => setIsRecommendModalOpen(true)} title={lang === 'en' ? 'Recommend Contact' : '推荐联系人'}>
                        <UserPlus size={20} />
                        <span>{lang === 'en' ? 'Recommend' : '推荐'}</span>
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

            <ConversationSearchPanel
                apiUrl={apiUrl}
                isOpen={showConversationSearch}
                onClose={() => setShowConversationSearch(false)}
                onResultSelect={onSearchResultSelect}
            />

            {isCurrentlyBlocked && (
                <div style={{ textAlign: 'center', padding: '8px', background: '#ffebeb', color: 'var(--danger)', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #ffcccc' }}>
                    {lang === 'en' ? `You are blocked by ${contact.name}. You cannot send messages.` : `你已被 ${contact.name} 拉黑，暂时无法发送消息。`}
                </div>
            )}

            <div className="chat-history" onScroll={handleConversationScroll}>
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
                    const currentLimit = contact?.context_msg_limit ?? 60;
                    const isBoundary = !isSearchContextWindow && idx === Math.max(0, displayMessages.length - currentLimit) && displayMessages.length > currentLimit;
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
                            <div
                            ref={(node) => setMessageElement(msg.id, node)}
                            className={`conversation-message-anchor ${String(highlightedMessageId || '') === String(msg.id) ? 'is-search-target' : ''}`}
                            style={{
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
                                {(msg.metadata?.replyBubbles ? msg.content.split('\n').map(text => text.trim()).filter(Boolean) : [msg.content]).map((content, bubbleIndex) => <MessageBubble
                                    key={`${msg.id}-${msg.metadata?.replyVersion?.revision || 0}-${bubbleIndex}`}
                                    message={{ ...msg, content }}
                                    characterName={contact.name}
                                    avatar={msg.role === 'user' ? (userAvatar || defaultAvatarUrl('User')) : (contact.avatar || defaultAvatarUrl(contact.name || contact.id || 'User'))}
                                    avatarFrame={msg.role === 'user' ? userAvatarFrame : contact.avatar_frame}
                                    apiUrl={apiUrl}
                                    onRetry={handleRetry}
                                    contacts={allContacts}
                                />)}
                                {!selectMode && msg.role === 'character' && msg.metadata?.replyVersion && <PrivateReplyControls
                                    info={msg.metadata.replyVersion}
                                    disabled={!!engineState?.[contact.id]?.isThinking || (replyAction?.characterId === contact.id && !!replyAction.pending)}
                                    pending={replyAction?.characterId === contact.id && replyAction?.messageId === msg.id ? replyAction.pending : null}
                                    runId={replyAction?.characterId === contact.id && replyAction?.messageId === msg.id ? replyAction.runId : null}
                                    error={replyAction?.characterId === contact.id && replyAction?.messageId === msg.id ? replyAction.error : null}
                                    onChange={version => changeReplyVersion(msg, version)}
                                />}
                            </div>
                        </div>
                        </React.Fragment>
                    );
                })}
                {isSearchContextWindow && hasNewer && (
                    <div style={{ textAlign: 'center', padding: '10px' }}>
                        <button
                            onClick={loadNewerMessages}
                            disabled={loadingNewer}
                            style={{
                                fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255, 247, 250, 0.92)',
                                border: '1px solid #ddd', borderRadius: '12px',
                                padding: '5px 16px', cursor: loadingNewer ? 'default' : 'pointer'
                            }}
                        >
                            {loadingNewer ? t('Loading') : (lang === 'en' ? '↓ Load newer messages' : '↓ 加载更新的消息')}
                        </button>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <MessageOperationNotice
                notice={messageNotice?.characterId === contact.id ? messageNotice : null}
                onDismiss={dismissMessageNotice}
                onRetry={handleRetry}
            />

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
                                if (await handleDelete([...selectedIds])) {
                                    setSelectedIds(new Set());
                                    setSelectMode(false);
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
