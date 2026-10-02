import { useCallback, useEffect, useRef, useState } from 'react';
import { requestReplyVersion } from "./api";
import { dispatchReplyUpdate, mergeReplyUpdate, subscribeToReplyUpdates } from "./events";

export function useReplyVersions({ apiUrl, characterId, lang, setMessages, deletedMessageIdsRef }) {
    const [replyAction, setReplyAction] = useState(null);
    const inFlight = useRef(null);
    const currentCharacter = useRef(characterId);
    useEffect(() => { currentCharacter.current = characterId; }, [characterId]);

    const applyUpdate = useCallback(update => {
        if (!update?.message || update.character_id !== currentCharacter.current) return;
        setReplyAction(previous => previous?.characterId === update.character_id
            && previous?.messageId === update.message.id && !previous.pending ? null : previous);
        (update.removedIds || []).forEach(id => deletedMessageIdsRef.current.add(`${update.character_id}:${id}`));
        setMessages(previous => mergeReplyUpdate(previous, update));
    }, [deletedMessageIdsRef, setMessages]);

    useEffect(() => subscribeToReplyUpdates(applyUpdate), [applyUpdate]);

    const changeReplyVersion = async (message, version) => {
        if (inFlight.current) return;
        const action = { characterId: currentCharacter.current, messageId: message.id,
            pending: version === null ? 'reroll' : 'version' };
        inFlight.current = action;
        setReplyAction(action);
        try {
            const update = await requestReplyVersion({ apiUrl, characterId: action.characterId, message, version,
                fallbackError: lang === 'en' ? 'Unable to update reply' : '回复更新失败' });
            dispatchReplyUpdate(update);
            setReplyAction(null);
        } catch (error) {
            setReplyAction({ ...action, pending: null, error: error.message, runId: error.runId });
        } finally {
            inFlight.current = null;
        }
    };

    return { replyAction, changeReplyVersion };
}
