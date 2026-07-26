import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, Search, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const PAGE_SIZE = 10;

function buildAuthHeaders() {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('cp_token') || '' : '';
    return { Authorization: `Bearer ${token}` };
}

function formatTimestamp(timestamp, lang) {
    const value = Number(timestamp || 0);
    if (!value) return '';
    try {
        return new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        return '';
    }
}

function highlightContent(content, query) {
    const text = String(content || '');
    const needle = String(query || '').trim();
    if (!needle) return text;
    const lowerText = text.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    const parts = [];
    let cursor = 0;
    let index = lowerText.indexOf(lowerNeedle);
    while (index >= 0 && parts.length < 40) {
        if (index > cursor) parts.push(text.slice(cursor, index));
        parts.push(<mark key={`${index}-${parts.length}`}>{text.slice(index, index + needle.length)}</mark>);
        cursor = index + needle.length;
        index = lowerText.indexOf(lowerNeedle, cursor);
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
}

export default function ConversationSearchPanel({ apiUrl, isOpen, onClose, onResultSelect }) {
    const { lang } = useLanguage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [nextOffset, setNextOffset] = useState(null);
    const inputRef = useRef(null);

    const trimmedQuery = query.trim();
    const resultCountText = useMemo(() => {
        if (!trimmedQuery) return lang === 'en' ? 'Search all conversations' : '搜索全部对话';
        if (isLoading) return lang === 'en' ? 'Searching...' : '搜索中...';
        if (error) return error;
        const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
        if (lang === 'en') {
            return `Page ${pageNumber} · ${results.length} result(s)${hasMore ? ' · more available' : ''}`;
        }
        return `第 ${pageNumber} 页 · ${results.length} 条结果${hasMore ? ' · 还有更多' : ''}`;
    }, [error, hasMore, isLoading, lang, offset, results.length, trimmedQuery]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
        return () => window.clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        setOffset(0);
    }, [trimmedQuery]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const cleanQuery = query.trim();
        if (!cleanQuery) {
            setResults([]);
            setError('');
            setIsLoading(false);
            setHasMore(false);
            setNextOffset(null);
            return undefined;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setIsLoading(true);
            setError('');
            try {
                const response = await fetch(`${apiUrl}/messages/search?q=${encodeURIComponent(cleanQuery)}&limit=${PAGE_SIZE}&offset=${offset}`, {
                    headers: buildAuthHeaders(),
                    signal: controller.signal
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.success) {
                    throw new Error(data.error || (lang === 'en' ? 'Search failed' : '搜索失败'));
                }
                setResults(Array.isArray(data.results) ? data.results : []);
                setHasMore(Boolean(data.has_more));
                const parsedNextOffset = Number(data.next_offset);
                setNextOffset(Number.isSafeInteger(parsedNextOffset) && parsedNextOffset >= 0 ? parsedNextOffset : null);
            } catch (e) {
                if (e.name === 'AbortError') return;
                setResults([]);
                setHasMore(false);
                setNextOffset(null);
                setError(e.message || (lang === 'en' ? 'Search failed' : '搜索失败'));
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }, 260);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [apiUrl, isOpen, lang, offset, query]);

    if (!isOpen) return null;

    return (
        <div className="conversation-search-panel">
            <div className="conversation-search-panel__bar">
                <Search size={17} />
                <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={lang === 'en' ? 'Search all conversations' : '搜索全部对话'}
                    className="conversation-search-panel__input"
                />
                {isLoading ? (
                    <LoaderCircle size={17} className="conversation-search-panel__spinner" />
                ) : (
                    <button
                        type="button"
                        className="conversation-search-panel__icon-button"
                        onClick={trimmedQuery ? () => { setQuery(''); setOffset(0); } : onClose}
                        title={trimmedQuery ? (lang === 'en' ? 'Clear' : '清空') : (lang === 'en' ? 'Close' : '关闭')}
                    >
                        <X size={17} />
                    </button>
                )}
            </div>
            <div className={`conversation-search-panel__summary ${error ? 'is-error' : ''}`}>
                {resultCountText}
            </div>
            {trimmedQuery && !isLoading && !error && results.length === 0 && (
                <div className="conversation-search-panel__empty">
                    {lang === 'en' ? 'No matching messages' : '没有匹配的消息'}
                </div>
            )}
            {results.length > 0 && (
                <div className="conversation-search-panel__results">
                    {results.map((result) => {
                        const scopeLabel = result.scope === 'group'
                            ? (lang === 'en' ? 'Group' : '群聊')
                            : (lang === 'en' ? 'Private' : '私聊');
                        const timeLabel = formatTimestamp(result.timestamp, lang);
                        const contextMessages = Array.isArray(result.context_messages) ? result.context_messages : [];
                        return (
                            <button
                                type="button"
                                className="conversation-search-result"
                                key={result.id || `${result.scope}:${result.message_id}`}
                                onClick={() => {
                                    onResultSelect?.(result);
                                    onClose?.();
                                }}
                                aria-label={lang === 'en' ? 'Open matching message' : '打开匹配消息'}
                            >
                                <div className="conversation-search-result__meta">
                                    <span>{scopeLabel}</span>
                                    <span>{result.conversation_name || (lang === 'en' ? 'Conversation' : '对话')}</span>
                                    {timeLabel && <span>{timeLabel}</span>}
                                </div>
                                {contextMessages.length > 0 ? (
                                    <div className="conversation-search-result__context">
                                        {contextMessages.map((line) => (
                                            <div
                                                className={`conversation-search-context-line ${line.is_match ? 'is-match' : ''}`}
                                                key={`${result.id || result.message_id}-${line.message_id}`}
                                            >
                                                <span className="conversation-search-context-line__sender">
                                                    {line.sender_name || result.sender_name || (lang === 'en' ? 'Unknown' : '未知')}
                                                </span>
                                                <span className="conversation-search-context-line__content">
                                                    {highlightContent(line.content || '', trimmedQuery)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <div className="conversation-search-result__sender">
                                            {result.sender_name || (lang === 'en' ? 'Unknown' : '未知')}
                                        </div>
                                        <div className="conversation-search-result__content">
                                            {highlightContent(result.content, trimmedQuery)}
                                        </div>
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
            {(offset > 0 || hasMore) && (
                <div className="conversation-search-panel__pager">
                    <button
                        type="button"
                        onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                        disabled={offset <= 0 || isLoading}
                    >
                        {lang === 'en' ? '< Previous' : '< 上一页'}
                    </button>
                    {hasMore && (
                        <button
                            type="button"
                            onClick={() => setOffset(nextOffset ?? offset + PAGE_SIZE)}
                            disabled={isLoading}
                        >
                            {lang === 'en' ? '> Next' : '> 下一页'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
