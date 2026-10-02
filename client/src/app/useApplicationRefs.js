import { useEffect, useRef } from 'react';

export function useApplicationRefs(dependencies) {
const { activeBrowserWindowId, activeContactId, activeDrawer, activeGroupId, activeTab, browserWindowGeometrySwitchTimerRef, browserWindowGeometrySyncTimersRef, browserWindowPointerListenerCleanupRef, browserWindows, browserWindowsRef, contacts, conversationJumpTarget, groups, lang, updateBrowserWindowSocialState } = dependencies;
const activeTabRef = useRef(activeTab);

useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

useEffect(() => { browserWindowsRef.current = browserWindows; }, [browserWindows, browserWindowsRef]);

useEffect(() => {
    if (!activeBrowserWindowId || activeTab !== 'chats') return;
    updateBrowserWindowSocialState(activeBrowserWindowId, {
      activeContactId: activeContactId,
      activeGroupId: activeGroupId,
      activeDrawer: activeDrawer,
      searchJumpTarget: conversationJumpTarget,
    });
  }, [
    activeBrowserWindowId,
    activeContactId,
    activeDrawer,
    activeGroupId,
    activeTab,
    conversationJumpTarget,
    updateBrowserWindowSocialState,
  ]);

useEffect(() => () => {
    browserWindowPointerListenerCleanupRef.current?.();
    browserWindowPointerListenerCleanupRef.current = null;
    if (browserWindowGeometrySwitchTimerRef.current) {
      window.clearTimeout(browserWindowGeometrySwitchTimerRef.current);
      browserWindowGeometrySwitchTimerRef.current = null;
    }
    browserWindowGeometrySyncTimersRef.current.forEach((timer) => {
      if (!timer) return;
      if (timer.type === 'idle' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(timer.id);
      } else {
        window.clearTimeout(timer.id);
      }
    });
    browserWindowGeometrySyncTimersRef.current.clear();
  }, [browserWindowGeometrySwitchTimerRef, browserWindowGeometrySyncTimersRef, browserWindowPointerListenerCleanupRef]);

const activeBrowserWindowIdRef = useRef(activeBrowserWindowId);

useEffect(() => { activeBrowserWindowIdRef.current = activeBrowserWindowId; }, [activeBrowserWindowId]);

const contactsRef = useRef(contacts);

useEffect(() => { contactsRef.current = contacts; }, [contacts]);

const groupsRef = useRef(groups);

useEffect(() => { groupsRef.current = groups; }, [groups]);

const langRef = useRef(lang);

useEffect(() => { langRef.current = lang; }, [lang]);

const desktopToastTimersRef = useRef(new Map());

const openCreatedCharacterInChatRef = useRef(false);
    return { activeTabRef, activeBrowserWindowIdRef, contactsRef, groupsRef, langRef, desktopToastTimersRef, openCreatedCharacterInChatRef };
}
