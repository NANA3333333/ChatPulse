import { useCallback, useMemo } from 'react';

export function useNotificationItems(dependencies) {
const { Bell, DESKTOP_APP_ICONS, MessageSquare, Square, Store, activeContactRef, activeGroupRef, browserWindowTaskbarItems, contactsLoadError, contactsRef, desktopEventNotifications, desktopToastNotifications, getDesktopNotificationPreview, lang, langRef, openBrowserApp, openSimpleTabApp, openSocialApp, pluginById, restoreBrowserWindow, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setContacts, setGroupUnreadCounts, socialUnreadCount } = dependencies;
const buildCityNotificationItem = useCallback((msg) => {
    const action = String(msg?.action || '').trim();
    if (!action || action === 'schedule_generating') return null;

    const currentLang = langRef.current;
    const characterId = msg?.charId || msg?.character_id || msg?.characterId || '';
    const contact = contactsRef.current.find(c => String(c.id) === String(characterId));
    const actionLabels = currentLang === 'en'
      ? {
        schedule_updated: 'Schedule updated',
        REROLL: 'Activity rerolled',
        'rent-settled': 'Rent settled',
        'social-housing-rental-chain': 'Housing recommendation updated',
        'social-housing-assigned': 'Housing assignment updated',
        'social-housing-ad': 'Agency listing published',
      }
      : {
        schedule_updated: '行程已更新',
        REROLL: '活动已重 roll',
        'rent-settled': '房租已结算',
        'social-housing-rental-chain': '房源推荐有新进展',
        'social-housing-assigned': '住房指派已更新',
        'social-housing-ad': '中介所发布了新信息',
      };
    const fallback = actionLabels[action] || (currentLang === 'en' ? 'Commercial street has new activity' : '商业街有新动态');
    const preview = getDesktopNotificationPreview(msg?.message, fallback);
    const meta = contact?.name ? `${contact.name} · ${preview}` : preview;

    return {
      kind: 'commercial',
      sourceId: `${action}-${characterId || 'all'}`,
      target: { type: 'commercial' },
      icon: Store,
      image: DESKTOP_APP_ICONS.commercialStreet,
      appIcon: DESKTOP_APP_ICONS.commercialStreet,
      appName: currentLang === 'en' ? 'Commercial Street' : '商业街',
      title: currentLang === 'en' ? 'Commercial street activity' : '商业街活动',
      meta,
      tone: 'mint',
    };
  }, [DESKTOP_APP_ICONS.commercialStreet, Store, contactsRef, getDesktopNotificationPreview, langRef]);

const decorateDesktopEventNotification = useCallback((item) => {
    const openTarget = () => {
      const target = item.target || {};
      if (target.type === 'private') {
        const contact = contactsRef.current.find(c => String(c.id) === String(target.id));
        openBrowserApp('chats');
        setActiveGroupId(null);
        activeGroupRef.current = null;
        setActiveContactId(target.id);
        setActiveContactSnapshot(contact || null);
        activeContactRef.current = target.id;
        setActiveDrawer(null);
        setContacts(prev => prev.map(c => String(c.id) === String(target.id) ? { ...c, unread: 0 } : c));
        return;
      }

      if (target.type === 'group') {
        openBrowserApp('chats');
        setActiveContactId(null);
        setActiveContactSnapshot(null);
        activeContactRef.current = null;
        setActiveGroupId(target.id);
        activeGroupRef.current = target.id;
        setActiveDrawer(null);
        setGroupUnreadCounts((current) => {
          if (!current[target.id]) return current;
          const next = { ...current };
          delete next[target.id];
          return next;
        });
        return;
      }

      if (target.type === 'commercial') {
        openSimpleTabApp(pluginById.has('city') ? 'city' : 'commercial_street');
      }
    };

    return {
      ...item,
      onOpen: openTarget,
    };
  }, [activeContactRef, activeGroupRef, contactsRef, openBrowserApp, openSimpleTabApp, pluginById, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setContacts, setGroupUnreadCounts]);

const desktopNotifications = useMemo(() => {
    const items = desktopEventNotifications.map(decorateDesktopEventNotification);
    if (socialUnreadCount > 0) {
      items.push({
        id: `social-unread-${socialUnreadCount}`,
        icon: MessageSquare,
        image: DESKTOP_APP_ICONS.social,
        title: lang === 'en' ? `${socialUnreadCount} unread social update${socialUnreadCount > 1 ? 's' : ''}` : `${socialUnreadCount} 条社交未读`,
        meta: lang === 'en' ? 'Open Social to review messages' : '打开社交查看私聊和群聊消息',
        tone: 'pink',
        onOpen: openSocialApp,
      });
    }
    if (contactsLoadError) {
      items.push({
        id: 'contacts-load-error',
        icon: Bell,
        title: lang === 'en' ? 'Contacts failed to load' : '联系人加载失败',
        meta: contactsLoadError,
        tone: 'danger',
        onOpen: openSocialApp,
      });
    }
    const minimizedWindow = browserWindowTaskbarItems.find(windowItem => windowItem.minimized);
    if (minimizedWindow) {
      items.push({
        id: `minimized-window-${minimizedWindow.id}`,
        icon: Square,
        title: lang === 'en' ? `${minimizedWindow.title} is minimized` : `${minimizedWindow.title} 已最小化`,
        meta: lang === 'en' ? 'Click to restore the window' : '点击还原窗口',
        tone: 'blue',
        onOpen: () => restoreBrowserWindow(minimizedWindow.id),
      });
    }
    return items;
  }, [Bell, DESKTOP_APP_ICONS.social, MessageSquare, Square, browserWindowTaskbarItems, contactsLoadError, decorateDesktopEventNotification, desktopEventNotifications, lang, openSocialApp, restoreBrowserWindow, socialUnreadCount]);

const desktopToastItems = useMemo(() => (
    desktopToastNotifications.map(decorateDesktopEventNotification)
  ), [decorateDesktopEventNotification, desktopToastNotifications]);
    return { buildCityNotificationItem, decorateDesktopEventNotification, desktopNotifications, desktopToastItems };
}
