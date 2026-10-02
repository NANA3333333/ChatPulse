import { useEffect } from 'react';

export function useConversationLifecycle(dependencies) {
const { PRIVATE_CHAT_DECOR_STORAGE_KEY, PRIVATE_CHAT_DECOR_TARGETS, activeBrowserWindowId, activeGroupId, activeTab, browserWindows, effectiveUser, isDecorTransformDefault, isGroupConversationVisible, plugins, privateChatDecorTransforms, setActiveTab, setGroupUnreadCounts, setPrivateChatDecorEditorOpenPersisted } = dependencies;
useEffect(() => {
    if (!activeGroupId || !isGroupConversationVisible(activeGroupId)) return;
    setGroupUnreadCounts((current) => {
      if (!current[activeGroupId]) return current;
      const next = { ...current };
      delete next[activeGroupId];
      return next;
    });
  }, [activeBrowserWindowId, activeGroupId, activeTab, browserWindows, isGroupConversationVisible, setGroupUnreadCounts]);

useEffect(() => {
    const hasCustomTransform = PRIVATE_CHAT_DECOR_TARGETS.some(({ id }) => (
      !isDecorTransformDefault(id, privateChatDecorTransforms[id])
    ));
    if (hasCustomTransform) {
      window.localStorage.setItem(PRIVATE_CHAT_DECOR_STORAGE_KEY, JSON.stringify(privateChatDecorTransforms));
    } else {
      window.localStorage.removeItem(PRIVATE_CHAT_DECOR_STORAGE_KEY);
    }
  }, [PRIVATE_CHAT_DECOR_STORAGE_KEY, PRIVATE_CHAT_DECOR_TARGETS, isDecorTransformDefault, privateChatDecorTransforms]);

useEffect(() => {
    const handleDecorEditorShortcut = (event) => {
      if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'd') return;
      event.preventDefault();
      setPrivateChatDecorEditorOpenPersisted((open) => !open);
    };

    window.addEventListener('keydown', handleDecorEditorShortcut);
    return () => window.removeEventListener('keydown', handleDecorEditorShortcut);
  }, [setPrivateChatDecorEditorOpenPersisted]);

useEffect(() => {
    const activePlugin = plugins.find(p => p.id === activeTab);
    if (activePlugin && activePlugin.condition && !activePlugin.condition(effectiveUser)) {
      setActiveTab('chats');
    }
  }, [activeTab, effectiveUser, plugins, setActiveTab]);
    return {  };
}
