import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGroupMessages } from '../useGroupMessages.js';
import { requestJson } from '../../../shared/http/requestJson.js';
import { normalizeGroupMessages } from '../messages.js';
import { resolveAvatarUrl, defaultAvatarUrl } from '../../../shared/media/avatar.js';
import { ChevronLeft, Users, Search, Trash, Settings, ArrowRightLeft, Smile, Paperclip, Gift, X } from 'lucide-react';
import ConversationSearchPanel from '../../conversation-search/components/ConversationSearchPanel.jsx';
import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { RedPacketCard } from '../../economy/components/RedPacketCard.jsx';
import { GroupManageDrawer } from './GroupManageDrawer.jsx';
import { RedPacketModal } from '../../economy/components/RedPacketModal.jsx';

const quickEmojis = [
    '\u{1F600}',
    '\u{1F601}',
    '\u{1F602}',
    '\u{1F923}',
    '\u{1F979}',
    '\u{1F60A}',
    '\u{1F642}',
    '\u{1F609}',
    '\u{1F60D}',
    '\u{1F618}',
    '\u{1F970}',
    '\u{1F60E}',
    '\u{1F914}',
    '\u{1F644}',
    '\u{1F634}',
    '\u{1F62D}',
    '\u{1F621}',
    '\u{1F624}',
    '\u{1F97A}',
    '\u{1F633}',
    '\u{1F917}',
    '\u{1FAF6}',
    '\u{1F44D}',
    '\u{1F44E}',
    '\u{1F64F}',
    '\u{1F44F}',
    '\u{1F4AA}',
    '\u{1F494}',
    '\u{2764}\u{FE0F}',
    '\u{1F495}',
    '\u{1F525}',
    '\u{2728}',
    '\u{1F389}',
    '\u{1F38A}',
    '\u{1F339}',
    '\u{1F35C}',
    '\u{1F35A}',
    '\u{1F370}',
    '\u{2615}',
    '\u{1F9CB}',
    '\u{1F381}',
    '\u{1F490}',
    '\u{1F436}',
    '\u{1F431}',
    '\u{1F319}',
    '\u{2600}\u{FE0F}',
    '\u{26A1}',
    '\u{1F4A4}',
    '\u{1F440}',
    '\u{1F90D}',
];

/* ─── Red Packet Send Modal ─── */

/* ─── Red Packet Card (parsed from [REDPACKET:id] in content) ─── */

/* ─── Right-side Group Management Drawer ─── */

/* ─── Main GroupChatWindow ─── */
function GroupChatWindow({
    group,
    apiUrl,
    allContacts,
    userProfile,
    incomingGroupMessageQueue,
    typingIndicators,
    redpacketClaimEvent,
    onBack,
    onGroupUpdated,
    isManageOpen,
    onToggleManage,
    onCloseManage,
    isForegroundLayoutLifted = false,
    jumpTarget,
    onSearchResultSelect,
    onJumpHandled,
}) {
    const { lang } = useLanguage();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showRedPacketModal, setShowRedPacketModal] = useState(false);
    const [showManageDrawer, setShowManageDrawer] = useState(false);
    const [showConversationSearch, setShowConversationSearch] = useState(false);
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const [isSearchContextWindow, setIsSearchContextWindow] = useState(false);
    const [hasNewer, setHasNewer] = useState(false);
    const [loadingNewer, setLoadingNewer] = useState(false);
    const isManageControlled = typeof isManageOpen === 'boolean';
    const manageDrawerOpen = isManageControlled ? isManageOpen : showManageDrawer;
    const toggleManageDrawer = () => {
        if (onToggleManage) {
            onToggleManage();
            return;
        }
        setShowManageDrawer((current) => !current);
    };
    const closeManageDrawer = () => {
        if (onCloseManage) {
            onCloseManage();
            return;
        }
        setShowManageDrawer(false);
    };
    const messagesEndRef = useRef(null);
    const messageElementsRef = useRef(new Map());
    const pendingJumpMessageIdRef = useRef(null);
    const newerRequestRef = useRef(null);
    const searchHighlightTimerRef = useRef(null);
    const isConversationPinnedToBottomRef = useRef(true);
    const onJumpHandledRef = useRef(onJumpHandled);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const processedIncomingGroupMessageIdsRef = useRef(new Set());
    const deletedGroupMessageIdsRef = useRef(new Set());
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const jumpToken = String(jumpTarget?.token || '');
    const jumpMessageId = (() => {
        const targetMessageId = Number(jumpTarget?.messageId || jumpTarget?.message_id || 0);
        const targetGroupId = String(jumpTarget?.groupId || jumpTarget?.group_id || '').trim();
        if (!Number.isSafeInteger(targetMessageId) || targetMessageId <= 0) return 0;
        if (String(jumpTarget?.scope || '') !== 'group') return 0;
        if (!group?.id || targetGroupId !== String(group.id)) return 0;
        return targetMessageId;
    })();
    const {
        messages,
        setMessages,
        input,
        setInput,
        send,
        sending,
        error: messageError,
        setError: setMessageError,
        reload: reloadMessages,
    } = useGroupMessages({
        groupId: group?.id,
        apiUrl,
        lang,
        pauseHistory: Boolean(jumpMessageId) || isSearchContextWindow,
    });
    useEffect(() => {
        onJumpHandledRef.current = onJumpHandled;
    }, [onJumpHandled]);

    const getConversationScroller = useCallback(() => {
        return messagesEndRef.current?.closest?.('.chat-history') || null;
    }, []);

    const updateConversationPinnedState = useCallback(() => {
        const scroller = getConversationScroller();
        if (!scroller) return;
        const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        isConversationPinnedToBottomRef.current = distanceFromBottom <= 120;
    }, [getConversationScroller]);

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

    const getMessageAnchorClass = useCallback(
        (messageId, baseClass = '') => {
            const className = `${baseClass ? `${baseClass} ` : ''}conversation-message-anchor`;
            return String(highlightedMessageId || '') === String(messageId)
                ? `${className} is-search-target`
                : className;
        },
        [highlightedMessageId],
    );

    // Mentions logic
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    useEffect(() => {
        if (!group?.id) return;
        setShowManageDrawer(false);
        setShowConversationSearch(false);
        setIsSearchContextWindow(false);
        setHasNewer(false);
        setLoadingNewer(false);
        pendingJumpMessageIdRef.current = null;
        isConversationPinnedToBottomRef.current = true;
        return () => newerRequestRef.current?.abort();
    }, [group?.id, apiUrl]);

    useEffect(
        () => () => {
            if (searchHighlightTimerRef.current) window.clearTimeout(searchHighlightTimerRef.current);
        },
        [],
    );

    useEffect(() => {
        if (!jumpMessageId || !group?.id || !jumpToken) return undefined;
        let cancelled = false;
        const handledTarget = {
            scope: 'group',
            messageId: jumpMessageId,
            groupId: group.id,
            token: jumpToken,
        };
        pendingJumpMessageIdRef.current = jumpMessageId;
        isConversationPinnedToBottomRef.current = false;
        setShowConversationSearch(false);
        setIsSearchContextWindow(true);
        setHasNewer(false);
        requestJson(`${apiUrl}/groups/${group.id}/messages?limit=100&around=${jumpMessageId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
        })
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : [];
                setMessages(normalizeGroupMessages(list));
                setHasNewer(list.length > 0);
            })
            .catch((err) => {
                if (!cancelled) setMessageError(err.message);
            })
            .finally(() => {
                if (!cancelled) onJumpHandledRef.current?.(handledTarget);
            });
        return () => {
            cancelled = true;
        };
    }, [apiUrl, group?.id, jumpMessageId, jumpToken, setMessages, setMessageError]);

    useEffect(() => {
        if (incomingGroupMessageQueue && incomingGroupMessageQueue.length > 0 && group?.id) {
            const relevantMsgs = incomingGroupMessageQueue.filter((m) => {
                if (!m || m.group_id !== group.id || !m.id) return false;
                const messageId = `${group.id}:${m.id}`;
                if (deletedGroupMessageIdsRef.current.has(messageId)) return false;
                if (processedIncomingGroupMessageIdsRef.current.has(messageId)) return false;
                processedIncomingGroupMessageIdsRef.current.add(messageId);
                return true;
            });
            if (relevantMsgs.length > 0) {
                setMessages((prev) => {
                    return normalizeGroupMessages([...prev, ...relevantMsgs]);
                });
            }
        }
    }, [incomingGroupMessageQueue, group?.id, setMessages]);

    useEffect(() => {
        if (pendingJumpMessageIdRef.current) return;
        if (!isConversationPinnedToBottomRef.current) return;
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

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
        if (pendingJumpMessageIdRef.current) return undefined;
        if (!isConversationPinnedToBottomRef.current) return undefined;
        if (!isForegroundLayoutLifted || !messagesEndRef.current) return undefined;
        const rafId = window.requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
        return () => window.cancelAnimationFrame(rafId);
    }, [isForegroundLayoutLifted]);

    const loadNewerMessages = useCallback(async () => {
        if (loadingNewer || messages.length === 0 || !group?.id) return;
        const newestId = messages.reduce((maxId, msg) => {
            const id = Number(msg?.id);
            return Number.isSafeInteger(id) && id > maxId ? id : maxId;
        }, 0);
        if (!newestId) {
            setHasNewer(false);
            return;
        }
        setLoadingNewer(true);
        const request = new AbortController();
        newerRequestRef.current?.abort();
        newerRequestRef.current = request;
        try {
            const data = await requestJson(`${apiUrl}/groups/${group.id}/messages?limit=100&after=${newestId}`, {
                signal: request.signal,
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            if (request.signal.aborted) return;
            const list = Array.isArray(data) ? data : [];
            if (list.length > 0) {
                isConversationPinnedToBottomRef.current = false;
                setMessages((prev) => {
                    const seen = new Set(prev.map((msg) => String(msg.id)));
                    const fresh = list.filter((msg) => !seen.has(String(msg.id)));
                    return fresh.length > 0 ? normalizeGroupMessages([...prev, ...fresh]) : prev;
                });
            }
            setHasNewer(list.length >= 100);
        } catch (e) {
            if (!request.signal.aborted) setMessageError(e.message);
        } finally {
            if (newerRequestRef.current === request) {
                newerRequestRef.current = null;
                if (!request.signal.aborted) setLoadingNewer(false);
            }
        }
    }, [apiUrl, group?.id, loadingNewer, messages, setMessages, setMessageError]);

    const handleConversationScroll = useCallback(() => {
        updateConversationPinnedState();
        if (!isSearchContextWindow || !hasNewer || loadingNewer) return;
        const scroller = getConversationScroller();
        if (!scroller) return;
        const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
        if (distanceFromBottom <= 80) {
            loadNewerMessages();
        }
    }, [
        getConversationScroller,
        hasNewer,
        isSearchContextWindow,
        loadingNewer,
        loadNewerMessages,
        updateConversationPinnedState,
    ]);

    const handleSend = async () => {
        newerRequestRef.current?.abort();
        setLoadingNewer(false);
        isConversationPinnedToBottomRef.current = true;
        setIsSearchContextWindow(false);
        setHasNewer(false);
        await send();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        if (file.size > 100 * 1024) {
            alert(
                lang === 'en'
                    ? `File too large (${(file.size / 1024).toFixed(1)} KB). Max 100 KB.`
                    : `文件太大。最大 100 KB。`,
            );
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const snippet = `📄 [${file.name}]\n${ev.target.result}`;
            setInput((prev) => (prev ? prev + '\n' + snippet : snippet));
        };
        reader.onerror = () => alert(lang === 'en' ? 'Failed to read file' : '读取文件失败');
        reader.readAsText(file, 'utf-8');
    };

    const resolveSender = useCallback(
        (senderId) => {
            if (senderId === 'user') {
                return {
                    name: userProfile?.name || 'User',
                    avatar: resolveAvatarUrl(userProfile?.avatar, apiUrl, userProfile?.name || 'User'),
                    avatar_frame: userProfile?.avatar_frame || '',
                };
            }
            const char = allContacts?.find((c) => String(c.id) === String(senderId));
            return char
                ? { ...char, avatar: resolveAvatarUrl(char.avatar, apiUrl, char.name || senderId || 'User') }
                : { name: senderId, avatar: defaultAvatarUrl(senderId || 'User') };
        },
        [allContacts, apiUrl, userProfile?.avatar, userProfile?.avatar_frame, userProfile?.name],
    );

    const addEmoji = (emoji) => {
        setInput((prev) => prev + emoji);
        setShowEmojiPicker(false);
    };

    // --- MENTION HANDLERS ---
    const availableMentions = React.useMemo(() => {
        if (!group) return [];
        const base = [{ id: 'all', name: lang === 'en' ? 'All' : '全体成员', avatar: defaultAvatarUrl('All') }];
        if (group.members) {
            group.members.forEach((memberObj) => {
                const mid = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                if (mid !== 'user') base.push(resolveSender(mid));
            });
        }
        return base.filter((m) => m.name.toLowerCase().includes(mentionFilter.toLowerCase()));
    }, [group, mentionFilter, lang, resolveSender]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);
        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.substring(0, cursor);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        if (lastAtIndex !== -1 && (lastAtIndex === 0 || /\W/.test(textBeforeCursor[lastAtIndex - 1]))) {
            const query = textBeforeCursor.substring(lastAtIndex + 1);
            if (!/\s/.test(query)) {
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
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex((p) => Math.min(p + 1, availableMentions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex((p) => Math.max(p - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                handleMentionSelect(availableMentions[mentionIndex]);
                return;
            }
            if (e.key === 'Escape') {
                setShowMentionMenu(false);
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
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

    const handleAddMember = async (charId) => {
        const data = await requestJson(apiUrl + '/groups/' + group.id + '/members', {
            method: 'POST',
            body: JSON.stringify({ member_id: charId }),
        });
        if (data.group) onGroupUpdated?.(data.group);
    };
    const handleRename = async (newName) => {
        const data = await requestJson(apiUrl + '/groups/' + group.id, {
            method: 'PUT',
            body: JSON.stringify({ name: newName }),
        });
        if (data.group) onGroupUpdated?.(data.group);
    };

    if (!group) return null;

    return (
        <>
            <div
                className="group-chat-main private-chat-main"
                style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minWidth: 0 }}
            >
                {/* Header */}
                <div className="chat-header">
                    <div
                        className="chat-header-title group-chat-header-title"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <button className="mobile-back-btn" onClick={onBack} title={lang === 'en' ? 'Back' : '返回'}>
                            <ChevronLeft size={24} />
                        </button>
                        <Users size={20} />
                        <span className="chat-header-name-text">{group.name}</span>
                        <span className="chat-state-chip group-member-count">
                            {lang === 'en'
                                ? `${group.members?.length || 0} members`
                                : `${group.members?.length || 0} 人`}
                        </span>
                    </div>
                    <div
                        className="chat-header-actions group-chat-header-actions"
                        style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                        <button
                            onClick={() => setShowConversationSearch((value) => !value)}
                            title={lang === 'en' ? 'Search all conversations' : '搜索全部对话'}
                            style={
                                showConversationSearch
                                    ? {
                                          color: 'var(--accent-color)',
                                          background: 'rgba(var(--accent-rgb, 74,144,226), 0.12)',
                                          borderRadius: '8px',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '6px',
                                      }
                                    : {
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          color: 'var(--accent-color)',
                                          padding: '6px',
                                      }
                            }
                        >
                            <Search size={20} />
                            <span>{lang === 'en' ? 'Search' : '搜索'}</span>
                        </button>
                        <button
                            onClick={() => {
                                setSelectMode((m) => !m);
                                setSelectedIds(new Set());
                            }}
                            title={lang === 'en' ? 'Select Messages' : '选择消息'}
                            style={
                                selectMode
                                    ? {
                                          color: 'var(--accent-color)',
                                          background: 'rgba(var(--accent-rgb, 74,144,226), 0.12)',
                                          borderRadius: '8px',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '6px',
                                      }
                                    : {
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          color: 'var(--accent-color)',
                                          padding: '6px',
                                      }
                            }
                        >
                            <Trash size={20} />
                            <span>{lang === 'en' ? 'Select' : '选择消息'}</span>
                        </button>
                        <button
                            onClick={toggleManageDrawer}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: manageDrawerOpen ? 'var(--danger)' : 'var(--accent-color)',
                            }}
                            title={
                                lang === 'en'
                                    ? 'Group management — members, AI controls, danger zone'
                                    : '群管理 — 成员、AI 控制、危险操作'
                            }
                        >
                            <Settings size={20} />
                            <span>{lang === 'en' ? 'Manage' : '群管理'}</span>
                        </button>
                    </div>
                </div>

                <ConversationSearchPanel
                    apiUrl={apiUrl}
                    isOpen={showConversationSearch}
                    onClose={() => setShowConversationSearch(false)}
                    onResultSelect={onSearchResultSelect}
                />

                {/* Messages */}
                <div className="chat-history" onScroll={handleConversationScroll}>
                    {messages.map((msg, index) => {
                        const sender = resolveSender(msg.sender_id);
                        const isUser = msg.sender_id === 'user';
                        const parsed = parseContent(msg.content);

                        const currentLimit = group?.context_msg_limit || 60;
                        const isBoundary =
                            !isSearchContextWindow &&
                            index === Math.max(0, messages.length - currentLimit) &&
                            messages.length > currentLimit;

                        const boundaryElement = isBoundary ? (
                            <div
                                key={`boundary-${msg.id}`}
                                style={{
                                    textAlign: 'center',
                                    margin: '30px 0',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                }}
                            >
                                <div
                                    style={{
                                        borderBottom: '1px dashed #ccc',
                                        position: 'absolute',
                                        top: '20px',
                                        left: '10%',
                                        right: '10%',
                                    }}
                                ></div>
                                <span
                                    style={{
                                        background: 'rgba(255, 247, 250, 0.94)',
                                        padding: '0 15px',
                                        color: 'var(--text-warm)',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        position: 'relative',
                                        zIndex: 1,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                    }}
                                >
                                    👀 {lang === 'en' ? 'AI Vision Boundary' : 'AI 视界边界'} 👀
                                </span>
                                <div
                                    style={{
                                        fontSize: '11px',
                                        color: 'var(--text-secondary)',
                                        marginTop: '4px',
                                        position: 'relative',
                                        zIndex: 1,
                                        backgroundColor: 'rgba(255, 247, 250, 0.94)',
                                        padding: '0 10px',
                                    }}
                                >
                                    {lang === 'en'
                                        ? 'AI can only "see" messages below this line'
                                        : '模型只能感知此线以下的消息'}
                                </div>
                            </div>
                        ) : null;

                        // System message
                        if (msg.sender_id === 'system' || parsed.type === 'system') {
                            return (
                                <React.Fragment key={msg.id}>
                                    {boundaryElement}
                                    <div
                                        ref={(node) => setMessageElement(msg.id, node)}
                                        className={getMessageAnchorClass(msg.id, 'group-system-message-anchor')}
                                        style={{ textAlign: 'center', margin: '8px 0' }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                color: 'var(--text-secondary)',
                                                backgroundColor: 'rgba(255, 247, 250, 0.92)',
                                                padding: '3px 10px',
                                                borderRadius: '10px',
                                            }}
                                        >
                                            {parsed.text || (msg.content || '').replace('[System] ', '')}
                                        </span>
                                    </div>
                                </React.Fragment>
                            );
                        }

                        const isSelected = selectedIds.has(msg.id);
                        const selectionClick = selectMode
                            ? () => {
                                  setSelectedIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(msg.id)) next.delete(msg.id);
                                      else next.add(msg.id);
                                      return next;
                                  });
                              }
                            : undefined;

                        // Red packet
                        if (parsed.type === 'redpacket') {
                            return (
                                <React.Fragment key={msg.id}>
                                    {boundaryElement}
                                    <div
                                        ref={(node) => setMessageElement(msg.id, node)}
                                        className={getMessageAnchorClass(
                                            msg.id,
                                            `message-wrapper ${isUser ? 'user' : 'character'}`,
                                        )}
                                        style={
                                            isSelected
                                                ? {
                                                      backgroundColor: 'rgba(var(--accent-rgb, 74,144,226), 0.08)',
                                                      borderRadius: '8px',
                                                  }
                                                : {}
                                        }
                                        onClick={selectionClick}
                                    >
                                        {selectMode && (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    minWidth: '32px',
                                                    paddingTop: '12px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        border: isSelected ? 'none' : '2px solid #ccc',
                                                        backgroundColor: isSelected
                                                            ? 'var(--accent-color, #4a90e2)'
                                                            : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    {isSelected && (
                                                        <span
                                                            style={{
                                                                color: '#fff',
                                                                fontSize: '12px',
                                                                fontWeight: 'bold',
                                                            }}
                                                        >
                                                            ✓
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="message-avatar">
                                            <AvatarWithFrame
                                                size={36}
                                                frame={sender.avatar_frame}
                                                src={resolveAvatarUrl(sender.avatar, apiUrl, sender.name || 'User')}
                                                fallbackSrc={defaultAvatarUrl(sender.name || 'User')}
                                                alt=""
                                            />
                                        </div>
                                        <div className="message-content">
                                            {!isUser && (
                                                <div
                                                    style={{
                                                        fontSize: '12px',
                                                        color: 'var(--accent-color)',
                                                        marginBottom: '2px',
                                                        fontWeight: '500',
                                                    }}
                                                >
                                                    {sender.name}
                                                </div>
                                            )}
                                            <RedPacketCard
                                                packetId={parsed.packetId}
                                                apiUrl={apiUrl}
                                                groupId={group.id}
                                                isUser={isUser}
                                                resolveSender={resolveSender}
                                                claimEvent={redpacketClaimEvent}
                                            />
                                            {msg.timestamp && (
                                                <div
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-muted)',
                                                        marginTop: '4px',
                                                        display: 'flex',
                                                        gap: '6px',
                                                        alignItems: 'center',
                                                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                                                    }}
                                                >
                                                    <span>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        }

                        // Transfer
                        if (parsed.type === 'transfer') {
                            const raw = parsed.content.replace('[TRANSFER]', '').trim();
                            const parts = raw.split('|');
                            // Format is: tid|amount|note — parts[0]=tid, parts[1]=amount, parts[2+]=note
                            const amount = parts.length > 1 ? parts[1].trim() : parts[0].trim();
                            const note = parts.length > 2 ? parts.slice(2).join('|').trim() : 'Transfer';
                            return (
                                <React.Fragment key={msg.id}>
                                    {boundaryElement}
                                    <div
                                        ref={(node) => setMessageElement(msg.id, node)}
                                        className={getMessageAnchorClass(
                                            msg.id,
                                            `message-wrapper ${isUser ? 'user' : 'character'}`,
                                        )}
                                        style={
                                            isSelected
                                                ? {
                                                      backgroundColor: 'rgba(var(--accent-rgb, 74,144,226), 0.08)',
                                                      borderRadius: '8px',
                                                  }
                                                : {}
                                        }
                                        onClick={selectionClick}
                                    >
                                        {selectMode && (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    minWidth: '32px',
                                                    paddingTop: '12px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        border: isSelected ? 'none' : '2px solid #ccc',
                                                        backgroundColor: isSelected
                                                            ? 'var(--accent-color, #4a90e2)'
                                                            : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    {isSelected && (
                                                        <span
                                                            style={{
                                                                color: '#fff',
                                                                fontSize: '12px',
                                                                fontWeight: 'bold',
                                                            }}
                                                        >
                                                            ✓
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="message-avatar">
                                            <AvatarWithFrame
                                                size={36}
                                                frame={sender.avatar_frame}
                                                src={resolveAvatarUrl(sender.avatar, apiUrl, sender.name || 'User')}
                                                fallbackSrc={defaultAvatarUrl(sender.name || 'User')}
                                                alt=""
                                            />
                                        </div>
                                        <div className="message-content">
                                            {!isUser && (
                                                <div
                                                    style={{
                                                        fontSize: '12px',
                                                        color: 'var(--accent-color)',
                                                        marginBottom: '2px',
                                                        fontWeight: '500',
                                                    }}
                                                >
                                                    {sender.name}
                                                </div>
                                            )}
                                            <div className="message-bubble transfer-bubble">
                                                <div className="transfer-icon-area">
                                                    <ArrowRightLeft size={24} color="#fff" />
                                                </div>
                                                <div className="transfer-text-area">
                                                    <div className="transfer-amount">¥{amount}</div>
                                                    <div className="transfer-note">{note}</div>
                                                </div>
                                            </div>
                                            {msg.timestamp && (
                                                <div
                                                    style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-muted)',
                                                        marginTop: '4px',
                                                        display: 'flex',
                                                        gap: '6px',
                                                        alignItems: 'center',
                                                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                                                    }}
                                                >
                                                    <span>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        }

                        // Normal message
                        return (
                            <React.Fragment key={msg.id}>
                                {boundaryElement}
                                <div
                                    ref={(node) => setMessageElement(msg.id, node)}
                                    className={getMessageAnchorClass(
                                        msg.id,
                                        `message-wrapper ${isUser ? 'user' : 'character'}`,
                                    )}
                                    style={
                                        isSelected
                                            ? {
                                                  backgroundColor: 'rgba(var(--accent-rgb, 74,144,226), 0.08)',
                                                  borderRadius: '8px',
                                              }
                                            : {}
                                    }
                                    onClick={selectionClick}
                                >
                                    {selectMode && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: '32px',
                                                paddingTop: '12px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    border: isSelected ? 'none' : '2px solid #ccc',
                                                    backgroundColor: isSelected
                                                        ? 'var(--accent-color, #4a90e2)'
                                                        : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                {isSelected && (
                                                    <span
                                                        style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                                    >
                                                        ✓
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div className="message-avatar">
                                        <AvatarWithFrame
                                            size={36}
                                            frame={sender.avatar_frame}
                                            src={resolveAvatarUrl(sender.avatar, apiUrl, sender.name || 'User')}
                                            fallbackSrc={defaultAvatarUrl(sender.name || 'User')}
                                            alt=""
                                        />
                                    </div>
                                    <div className="message-content">
                                        {!isUser && (
                                            <div
                                                style={{
                                                    fontSize: '12px',
                                                    color: 'var(--accent-color)',
                                                    marginBottom: '2px',
                                                    fontWeight: '500',
                                                }}
                                            >
                                                {sender.name}
                                            </div>
                                        )}
                                        <div className="message-bubble">{msg.content}</div>
                                        {msg.timestamp && (
                                            <div
                                                style={{
                                                    fontSize: '11px',
                                                    color: 'var(--text-muted)',
                                                    marginTop: '4px',
                                                    display: 'flex',
                                                    gap: '6px',
                                                    alignItems: 'center',
                                                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                                                }}
                                            >
                                                <span>
                                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                        )}
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
                                    fontSize: '12px',
                                    color: 'var(--text-secondary)',
                                    background: 'rgba(255, 247, 250, 0.92)',
                                    border: '1px solid #ddd',
                                    borderRadius: '12px',
                                    padding: '5px 16px',
                                    cursor: loadingNewer ? 'default' : 'pointer',
                                }}
                            >
                                {loadingNewer
                                    ? lang === 'en'
                                        ? 'Loading...'
                                        : '加载中...'
                                    : lang === 'en'
                                      ? '↓ Load newer messages'
                                      : '↓ 加载更新的消息'}
                            </button>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Typing indicators and Interrupt Button */}
                {typingIndicators.length > 0 && (
                    <div
                        style={{
                            padding: '4px 15px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <div
                            style={{
                                color: 'var(--text-secondary)',
                                fontSize: '13px',
                                fontStyle: 'italic',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>✨</span>
                            {typingIndicators.map((t) => t.name).join(', ')}{' '}
                            {lang === 'en' ? 'typing...' : '正在输入中...'}
                        </div>
                        <button
                            onClick={async () => {
                                // Instantly interrupt AIs
                                await fetch(`${apiUrl}/groups/${group.id}/ai-pause`, {
                                    method: 'POST',
                                    headers: {
                                        Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ paused: true }),
                                });
                                // Automatically unpause after 10 seconds or when user sends a message
                                setTimeout(() => {
                                    fetch(`${apiUrl}/groups/${group.id}/ai-pause`, {
                                        method: 'POST',
                                        headers: {
                                            Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({ paused: false }),
                                    });
                                }, 10000);
                            }}
                            title={
                                lang === 'en' ? 'Interrupt AIs and stop them from chaining texts' : '打断 AI 的连续发言'
                            }
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#fff0f0',
                                border: '1px solid #ffcccc',
                                color: 'var(--danger)',
                                padding: '4px 10px',
                                borderRadius: '14px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                boxShadow: '0 2px 5px rgba(240,107,142,0.1)',
                            }}
                        >
                            ✋ {lang === 'en' ? 'Interrupt' : '打断'}
                        </button>
                    </div>
                )}

                {/* Floating delete bar when in select mode */}
                {selectMode && (
                    <div
                        className="select-action-bar group-select-action-bar"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 16px',
                            background: '#fff',
                            borderTop: '1px solid #eee',
                            boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                onClick={() => {
                                    if (selectedIds.size === messages.length) setSelectedIds(new Set());
                                    else setSelectedIds(new Set(messages.map((m) => m.id)));
                                }}
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--accent-color, #4a90e2)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px 0',
                                }}
                            >
                                {selectedIds.size === messages.length
                                    ? lang === 'en'
                                        ? 'Deselect All'
                                        : '取消全选'
                                    : lang === 'en'
                                      ? 'Select All'
                                      : '全选'}
                            </button>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {lang === 'en' ? `${selectedIds.size} selected` : `已选 ${selectedIds.size} 条`}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    setSelectMode(false);
                                    setSelectedIds(new Set());
                                }}
                                style={{
                                    padding: '6px 16px',
                                    fontSize: '13px',
                                    background: 'rgba(255, 247, 250, 0.92)',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                {lang === 'en' ? 'Cancel' : '取消'}
                            </button>
                            <button
                                disabled={selectedIds.size === 0}
                                onClick={async () => {
                                    if (selectedIds.size === 0) return;
                                    const confirmMsg =
                                        lang === 'en'
                                            ? `Permanently delete ${selectedIds.size} message(s)?`
                                            : `确定永久删除 ${selectedIds.size} 条消息？`;
                                    if (!confirm(confirmMsg)) return;
                                    try {
                                        const res = await fetch(`${apiUrl}/groups/${group.id}/messages/batch-delete`, {
                                            method: 'POST',
                                            headers: {
                                                Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({ messageIds: [...selectedIds] }),
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            [...selectedIds].forEach((id) =>
                                                deletedGroupMessageIdsRef.current.add(`${group.id}:${id}`),
                                            );
                                            setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
                                            setSelectedIds(new Set());
                                            setSelectMode(false);
                                        }
                                    } catch (e) {
                                        console.error('Group batch delete failed:', e);
                                    }
                                }}
                                style={{
                                    padding: '6px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    background: selectedIds.size > 0 ? '#e74c3c' : '#ddd',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                                }}
                            >
                                <Trash size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                {lang === 'en' ? 'Delete' : '删除'}
                            </button>
                        </div>
                    </div>
                )}

                {messageError && (
                    <div role="alert" className="group-message-error">
                        <span>{messageError}</span>
                        <button
                            type="button"
                            onClick={() => {
                                setIsSearchContextWindow(false);
                                setHasNewer(false);
                                reloadMessages();
                            }}
                        >
                            {lang === 'en' ? 'Reload messages' : '重新加载消息'}
                        </button>
                    </div>
                )}
                {/* Input area — matches private chat InputBar style */}
                {!selectMode && (
                    <div className="input-area">
                        <div className="input-toolbar" style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                title={lang === 'en' ? 'Insert emoji' : '插入表情'}
                            >
                                <Smile size={20} />
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                title={lang === 'en' ? 'Send file' : '发送文件'}
                            >
                                <Paperclip size={20} />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt,.md,.csv,.json,.log,.py,.js,.ts,.html,.css,.xml,.yaml,.yml"
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />
                            <button
                                onClick={() => setShowRedPacketModal(true)}
                                title={
                                    lang === 'en' ? 'Send red packet — lucky money for group' : '发红包 — 给群友发财运'
                                }
                            >
                                <Gift size={20} color="var(--danger)" />
                            </button>

                            {showEmojiPicker && (
                                <div
                                    className="emoji-picker"
                                    style={{
                                        position: 'absolute',
                                        bottom: '50px',
                                        left: '10px',
                                        backgroundColor: '#fff',
                                        border: '1px solid #ddd',
                                        borderRadius: '12px',
                                        padding: '12px 40px 12px 12px',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                                        gap: '8px',
                                        width: 'min(420px, calc(100vw - 40px))',
                                        boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                                        zIndex: 100,
                                    }}
                                >
                                    <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                        <button onClick={() => setShowEmojiPicker(false)} style={{ padding: '2px' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                    {quickEmojis.map((e) => (
                                        <span
                                            key={e}
                                            onClick={() => addEmoji(e)}
                                            style={{
                                                fontSize: '22px',
                                                cursor: 'pointer',
                                                padding: '6px',
                                                borderRadius: '8px',
                                                textAlign: 'center',
                                            }}
                                        >
                                            {e}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="input-textarea-wrapper" style={{ position: 'relative' }}>
                            {showMentionMenu && availableMentions.length > 0 && (
                                <div
                                    className="mention-menu"
                                    style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: 0,
                                        backgroundColor: '#fff',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        padding: '6px 0',
                                        width: '240px',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                                        zIndex: 100,
                                        marginBottom: '8px',
                                    }}
                                >
                                    {availableMentions.map((m, i) => (
                                        <div
                                            key={m.id}
                                            onClick={() => handleMentionSelect(m)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '8px 15px',
                                                cursor: 'pointer',
                                                backgroundColor: i === mentionIndex ? '#f0f9eb' : 'transparent',
                                            }}
                                            onMouseEnter={() => setMentionIndex(i)}
                                        >
                                            <AvatarWithFrame
                                                size={28}
                                                frame={m.avatar_frame}
                                                src={m.avatar}
                                                fallbackSrc={defaultAvatarUrl(m.name || 'User')}
                                                alt=""
                                            />
                                            <span
                                                style={{
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    color:
                                                        i === mentionIndex ? 'var(--accent-color)' : 'var(--text-warm)',
                                                }}
                                            >
                                                {m.name}
                                            </span>
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
                            <button className="send-button" onClick={handleSend} disabled={sending}>
                                {lang === 'en' ? 'Send' : '发送'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {!isManageControlled && manageDrawerOpen && (
                <GroupManageDrawer
                    group={group}
                    apiUrl={apiUrl}
                    resolveSender={resolveSender}
                    onClose={closeManageDrawer}
                    lang={lang}
                    messages={messages}
                    allContacts={allContacts}
                    onAddMember={handleAddMember}
                    onRename={handleRename}
                    onGroupUpdated={onGroupUpdated}
                />
            )}

            {/* Red Packet Modal */}
            {showRedPacketModal && (
                <RedPacketModal
                    group={group}
                    apiUrl={apiUrl}
                    onClose={() => setShowRedPacketModal(false)}
                    userWallet={userProfile?.wallet ?? 100}
                />
            )}
        </>
    );
}

export default GroupChatWindow;
