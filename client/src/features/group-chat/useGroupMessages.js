import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson } from '../../shared/http/requestJson.js';
import { normalizeGroupMessages } from './messages.js';

const EMPTY = [];

export function useGroupMessages({ groupId, apiUrl, lang, pauseHistory = false }) {
    const [histories, setHistories] = useState({});
    const [drafts, setDrafts] = useState({});
    const [errors, setErrors] = useState({});
    const [pending, setPending] = useState({});
    const sendLocks = useRef(new Set());
    const historiesRef = useRef(histories);
    historiesRef.current = histories;
    const setMessages = useCallback(updater => {
        setHistories(current => ({ ...current, [groupId]: typeof updater === 'function' ? updater(current[groupId] || EMPTY) : updater }));
    }, [groupId]);
    const setInput = useCallback(updater => {
        setDrafts(current => ({ ...current, [groupId]: typeof updater === 'function' ? updater(current[groupId] || '') : updater }));
    }, [groupId]);
    const setError = useCallback(error => setErrors(current => ({ ...current, [groupId]: error })), [groupId]);
    const [reloadVersion, setReloadVersion] = useState(0);
    const reload = useCallback(() => setReloadVersion(value => value + 1), []);

    useEffect(() => {
        if (!groupId || pauseHistory) return undefined;
        const controller = new AbortController();
        const previousIds = new Set((historiesRef.current[groupId] || EMPTY).map(row => String(row.id)));
        setError('');
        requestJson(`${apiUrl}/groups/${encodeURIComponent(groupId)}/messages`, { signal: controller.signal })
            .then(rows => {
                if (controller.signal.aborted) return;
                if (!Array.isArray(rows)) throw new Error('Invalid message history');
                // Preserve messages delivered while the history request was in flight.
                setMessages(current => normalizeGroupMessages([...rows, ...current.filter(row => !previousIds.has(String(row.id)))]));
            })
            .catch(error => { if (!controller.signal.aborted) setError(error.message); });
        return () => controller.abort();
    }, [apiUrl, groupId, pauseHistory, reloadVersion, setError, setMessages]);

    useEffect(() => {
        window.addEventListener('ws_reconnected', reload);
        return () => window.removeEventListener('ws_reconnected', reload);
    }, [reload]);

    const input = drafts[groupId] || '';
    const send = async () => {
        const content = input.trim();
        if (!groupId || !content || sendLocks.current.has(groupId)) return false;
        sendLocks.current.add(groupId);
        setPending(current => ({ ...current, [groupId]: true }));
        setError('');
        try {
            const data = await requestJson(`${apiUrl}/groups/${encodeURIComponent(groupId)}/messages`, {
                method: 'POST', body: JSON.stringify({ content })
            });
            if (!data.message?.id) throw new Error('Invalid saved message');
            setMessages(current => normalizeGroupMessages([...current, data.message]));
            setInput(current => current === input ? '' : current);
            return true;
        } catch (error) {
            setError(error instanceof TypeError
                ? (lang === 'en' ? 'Network connection failed. Your draft is preserved.' : '网络连接失败，草稿已保留。')
                : error.message);
            return false;
        } finally {
            sendLocks.current.delete(groupId);
            setPending(current => ({ ...current, [groupId]: false }));
        }
    };
    return { messages: histories[groupId] || EMPTY, setMessages, input, setInput, send,
        sending: Boolean(pending[groupId]), error: errors[groupId] || '', setError, reload };
}
