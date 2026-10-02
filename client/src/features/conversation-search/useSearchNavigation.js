import { useCallback, useEffect } from 'react';

export function useSearchNavigation(dependencies) {
const { activeBrowserWindowIdRef, activeContactId, activeContactRef, activeGroupId, activeGroupRef, buildConversationJumpTarget, contacts, conversationJumpTarget, desktopToastTimersRef, lang, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setContacts, setConversationJumpTarget, setGroupUnreadCounts, updateBrowserWindowSocialState } = dependencies;
const clearConversationJumpTarget = useCallback((handledTarget = null) => {
    const handledToken = String(handledTarget?.token || '');
    setConversationJumpTarget((current) => {
      if (!current) return current;
      if (handledToken && String(current.token || '') !== handledToken) return current;
      return null;
    });
    const currentWindowId = activeBrowserWindowIdRef.current;
    if (currentWindowId) {
      updateBrowserWindowSocialState(currentWindowId, { searchJumpTarget: null });
    }
  }, [activeBrowserWindowIdRef, setConversationJumpTarget, updateBrowserWindowSocialState]);

const handleConversationSearchResultSelect = useCallback((result) => {
    const target = buildConversationJumpTarget(result);
    if (!target) return;
    setConversationJumpTarget(target);
    setActiveTab('chats');
    setActiveDrawer(null);

    if (target.scope === 'group') {
      setActiveContactId(null);
      setActiveContactSnapshot(null);
      activeContactRef.current = null;
      setActiveGroupId(target.groupId);
      activeGroupRef.current = target.groupId;
      setGroupUnreadCounts((current) => {
        if (!current[target.groupId]) return current;
        const next = { ...current };
        delete next[target.groupId];
        return next;
      });
      return;
    }

    const selected = contacts.find(contact => String(contact.id) === String(target.characterId));
    setActiveGroupId(null);
    activeGroupRef.current = null;
    setActiveContactId(target.characterId);
    setActiveContactSnapshot(selected || {
      id: target.characterId,
      name: result?.conversation_name || result?.sender_name || (lang === 'en' ? 'Conversation' : '对话')
    });
    activeContactRef.current = target.characterId;
    setContacts(prev => prev.map(contact => (
      String(contact.id) === String(target.characterId) ? { ...contact, unread: 0 } : contact
    )));
  }, [activeContactRef, activeGroupRef, buildConversationJumpTarget, contacts, lang, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setContacts, setConversationJumpTarget, setGroupUnreadCounts]);

useEffect(() => {
    if (!conversationJumpTarget) return;
    if (conversationJumpTarget.scope === 'group') {
      if (String(activeGroupId || '') !== String(conversationJumpTarget.groupId || '')) {
        setConversationJumpTarget(null);
      }
      return;
    }
    if (String(activeContactId || '') !== String(conversationJumpTarget.characterId || '')) {
      setConversationJumpTarget(null);
    }
  }, [activeContactId, activeGroupId, conversationJumpTarget, setConversationJumpTarget]);

useEffect(() => () => {
    desktopToastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    desktopToastTimersRef.current.clear();
  }, [desktopToastTimersRef]);
    return { clearConversationJumpTarget, handleConversationSearchResultSelect };
}
