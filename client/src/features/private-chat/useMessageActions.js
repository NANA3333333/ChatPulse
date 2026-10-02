import { useCallback, useRef, useState } from 'react';
import { deleteMessages, retryMessage, sendMessage } from "./api";
import { normalizeMessages } from "./messages";

export function useMessageActions({ apiUrl, contactRef, setMessages, deletedMessageIdsRef, prepareSend }) {
    const [messageNotice, setMessageNotice] = useState(null);
    const pendingRetries = useRef(new Set());
    const reportError = useCallback((error, characterId) => setMessageNotice({ characterId, error: error.message, runId: error.runId }), []);

    async function handleSend(content) {
        const characterId = contactRef.current?.id;
        if (!characterId) return false;
        setMessageNotice(null);
        const optimisticId = `temp-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        prepareSend();
        setMessages(previous => normalizeMessages([...previous, {
            id: optimisticId, character_id: characterId, role: 'user', content, timestamp: Date.now()
        }]));
        try {
            const data = await sendMessage({ apiUrl, characterId, content });
            if (contactRef.current?.id !== characterId) return false;
            const saved = data.blocked && data.message ? { ...data.message, isBlocked: true } : data.message;
            setMessages(previous => normalizeMessages([
                ...previous.filter(message => message.id !== optimisticId), ...(saved ? [saved] : [])
            ]));
            if (data.warnings?.length) setMessageNotice({ characterId, warnings: data.warnings, runId: data.runId });
            return true;
        } catch (error) {
            if (contactRef.current?.id === characterId) {
                setMessages(previous => previous.filter(message => message.id !== optimisticId));
                reportError(error, characterId);
            }
            return false;
        }
    }

    async function handleRetry(failedMessageId) {
        const characterId = contactRef.current?.id;
        if (!characterId || pendingRetries.current.has(characterId)) return;
        pendingRetries.current.add(characterId);
        setMessageNotice(null);
        try {
            await retryMessage({ apiUrl, characterId, failedMessageId });
            if (contactRef.current?.id === characterId) {
                setMessages(previous => previous.filter(message => message.id !== failedMessageId));
            }
        } catch (error) {
            // Keep the original error bubble until the server accepts the retry.
            if (contactRef.current?.id === characterId) reportError(error, characterId);
        } finally {
            pendingRetries.current.delete(characterId);
        }
    }

    async function handleDelete(messageIds) {
        const characterId = contactRef.current?.id;
        if (!characterId || !messageIds.length) return false;
        setMessageNotice(null);
        try {
            await deleteMessages({ apiUrl, characterId, messageIds });
            messageIds.forEach(id => deletedMessageIdsRef.current.add(`${characterId}:${id}`));
            if (contactRef.current?.id !== characterId) return false;
            const removed = new Set(messageIds);
            setMessages(previous => previous.filter(message => !removed.has(message.id)));
            return true;
        } catch (error) {
            if (contactRef.current?.id === characterId) reportError(error, characterId);
            return false;
        }
    }

    return { handleSend, handleRetry, handleDelete, messageNotice, dismissMessageNotice: () => setMessageNotice(null), reportMessageError: reportError };
}
