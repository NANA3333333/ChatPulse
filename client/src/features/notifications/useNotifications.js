import { useCallback } from 'react';

export function useNotifications(dependencies) {
const { DESKTOP_EVENT_NOTIFICATION_LIMIT, DESKTOP_NOTIFICATION_TOAST_LIMIT, DESKTOP_NOTIFICATION_TOAST_TTL_MS, activeBrowserWindowIdRef, activeContactRef, activeGroupRef, activeTabRef, browserWindowsRef, desktopToastTimersRef, setDesktopEventNotifications, setDesktopToastNotifications } = dependencies;
const playDesktopNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/pop.wav');
      audio.volume = 0.72;
      audio.play().catch(error => console.error('Audio play blocked:', error));
    } catch (error) {
      console.error(error);
    }
  }, []);

const dismissDesktopToastNotification = useCallback((notificationId) => {
    setDesktopToastNotifications((current) => current.filter(item => item.id !== notificationId));
    const timerId = desktopToastTimersRef.current.get(notificationId);
    if (timerId) {
      window.clearTimeout(timerId);
      desktopToastTimersRef.current.delete(notificationId);
    }
  }, [desktopToastTimersRef, setDesktopToastNotifications]);

const pushDesktopEventNotification = useCallback((item, options = {}) => {
    const createdAt = Date.now();
    const notificationId = item.id || `${item.kind || 'event'}-${item.sourceId || 'desktop'}-${createdAt}-${Math.random().toString(36).slice(2, 7)}`;
    const nextItem = {
      tone: 'default',
      ...item,
      id: notificationId,
      createdAt,
    };

    setDesktopEventNotifications((current) => [
      nextItem,
      ...current.filter(existing => existing.id !== notificationId),
    ].slice(0, DESKTOP_EVENT_NOTIFICATION_LIMIT));

    if (options.toast) {
      setDesktopToastNotifications((current) => [
        nextItem,
        ...current.filter(existing => existing.id !== notificationId),
      ].slice(0, DESKTOP_NOTIFICATION_TOAST_LIMIT));

      const previousTimer = desktopToastTimersRef.current.get(notificationId);
      if (previousTimer) window.clearTimeout(previousTimer);
      const timerId = window.setTimeout(() => {
        desktopToastTimersRef.current.delete(notificationId);
        setDesktopToastNotifications((current) => current.filter(existing => existing.id !== notificationId));
      }, DESKTOP_NOTIFICATION_TOAST_TTL_MS);
      desktopToastTimersRef.current.set(notificationId, timerId);
    }

    if (options.sound) {
      playDesktopNotificationSound();
    }

    return notificationId;
  }, [DESKTOP_EVENT_NOTIFICATION_LIMIT, DESKTOP_NOTIFICATION_TOAST_LIMIT, DESKTOP_NOTIFICATION_TOAST_TTL_MS, desktopToastTimersRef, playDesktopNotificationSound, setDesktopEventNotifications, setDesktopToastNotifications]);

const isBrowserTabVisible = useCallback((tab) => {
    const currentWindowId = activeBrowserWindowIdRef.current;
    const currentWindow = browserWindowsRef.current.find(windowItem => windowItem.id === currentWindowId);
    return Boolean(
      currentWindow
      && !currentWindow.minimized
      && activeTabRef.current === tab
      && currentWindow.activeTab === tab
    );
  }, [activeBrowserWindowIdRef, activeTabRef, browserWindowsRef]);

const isPrivateConversationVisible = useCallback((characterId) => (
    isBrowserTabVisible('chats')
    && String(activeContactRef.current || '') === String(characterId || '')
  ), [activeContactRef, isBrowserTabVisible]);

const isGroupConversationVisible = useCallback((groupId) => (
    isBrowserTabVisible('chats')
    && String(activeGroupRef.current || '') === String(groupId || '')
  ), [activeGroupRef, isBrowserTabVisible]);
    return { playDesktopNotificationSound, dismissDesktopToastNotification, pushDesktopEventNotification, isBrowserTabVisible, isPrivateConversationVisible, isGroupConversationVisible };
}
