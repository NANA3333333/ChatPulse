import { useCallback, useMemo } from 'react';

export function useDesktopApps(dependencies) {
const { DESKTOP_APP_ICONS, Home, LibraryBig, MessageSquare, Settings, Store, TASKBAR_APP_ICON_BY_ID, Wifi, activeBrowserWindowId, activeTab, browserWindowRecallPulse, browserWindows, lang, openSimpleTabApp, openSocialApp, pluginById, socialUnreadCount } = dependencies;
const formatBadge = useCallback((count) => {
    if (!count) return '';
    return count > 99 ? '99+' : String(count);
  }, []);

const openBrowserTabs = useMemo(() => (
    new Set(browserWindows.flatMap(windowItem => windowItem.tabs || []))
  ), [browserWindows]);

const desktopApps = useMemo(() => {
    const appList = [
      {
        id: 'social',
        label: lang === 'en' ? 'Social' : '社交',
        title: lang === 'en' ? 'Open private and group chats' : '打开社交 App',
        icon: MessageSquare,
        iconImage: DESKTOP_APP_ICONS.social,
        badge: formatBadge(socialUnreadCount),
        onOpen: openSocialApp,
        active: activeTab === 'chats',
        running: openBrowserTabs.has('chats'),
      },
      {
        id: 'memory_library',
        label: lang === 'en' ? 'Memory' : '记忆库',
        title: lang === 'en' ? 'Open memory library' : '打开记忆库 App',
        icon: LibraryBig,
        iconImage: DESKTOP_APP_ICONS.memoryLibrary,
        onOpen: () => openSimpleTabApp('memory_library'),
        active: activeTab === 'memory_library',
        running: openBrowserTabs.has('memory_library'),
      },
      {
        id: 'mcp_lab',
        label: lang === 'en' ? 'MCP Lab' : 'MCP 实验室',
        title: lang === 'en' ? 'Open MCP lab' : '打开 MCP 实验室 App',
        icon: pluginById.get('mcp_lab')?.icon || Wifi,
        iconImage: DESKTOP_APP_ICONS.mcpLab,
        onOpen: () => openSimpleTabApp('mcp_lab'),
        active: activeTab === 'mcp_lab',
        running: openBrowserTabs.has('mcp_lab'),
      },
      {
        id: 'settings',
        label: lang === 'en' ? 'Settings' : '设置',
        title: lang === 'en' ? 'Open settings' : '打开设置 App',
        icon: Settings,
        iconImage: DESKTOP_APP_ICONS.settings,
        onOpen: () => openSimpleTabApp('settings'),
        active: activeTab === 'settings',
        running: openBrowserTabs.has('settings'),
      },
    ];

    if (pluginById.has('housing_social')) {
      appList.push({
        id: 'housing_social',
        label: lang === 'en' ? 'Housing' : '住房系统',
        title: lang === 'en' ? 'Open housing system' : '打开住房系统 App',
        icon: pluginById.get('housing_social')?.icon || Home,
        iconImage: DESKTOP_APP_ICONS.housing,
        onOpen: () => openSimpleTabApp('housing_social'),
        active: activeTab === 'housing_social',
        running: openBrowserTabs.has('housing_social'),
      });
    }

    if (pluginById.has('commercial_street')) {
      appList.push({
        id: 'commercial_street',
        label: lang === 'en' ? 'Street' : '商业街',
        title: lang === 'en' ? 'Open commercial street' : '打开商业街 App',
        icon: pluginById.get('commercial_street')?.icon || Store,
        iconImage: DESKTOP_APP_ICONS.commercialStreet,
        onOpen: () => openSimpleTabApp('commercial_street'),
        active: activeTab === 'commercial_street',
        running: openBrowserTabs.has('commercial_street'),
      });
    }

    if (pluginById.has('pixel_cottage')) {
      appList.push({
        id: 'pixel_cottage',
        label: lang === 'en' ? 'Cottage' : '像素小屋',
        title: lang === 'en' ? 'Open pixel cottage' : '打开像素小屋 App',
        icon: pluginById.get('pixel_cottage')?.icon || Home,
        iconImage: DESKTOP_APP_ICONS.pixelCottage,
        onOpen: () => openSimpleTabApp('pixel_cottage'),
        active: activeTab === 'pixel_cottage',
        running: openBrowserTabs.has('pixel_cottage'),
      });
    }

    if (pluginById.has('city')) {
      appList.push({
        id: 'city',
        label: lang === 'en' ? 'City Log' : '商业街日志',
        title: lang === 'en' ? 'Open city activity log' : '打开商业街日志 App',
        icon: pluginById.get('city')?.icon || Store,
        iconImage: DESKTOP_APP_ICONS.cityLog,
        onOpen: () => openSimpleTabApp('city'),
        active: activeTab === 'city',
        running: openBrowserTabs.has('city'),
      });
    }

    return appList.filter(app => app.id !== 'mcp_lab' || pluginById.has('mcp_lab')).map(app => ({
      ...app,
      taskbarIconImage: TASKBAR_APP_ICON_BY_ID[app.id] || app.taskbarIconImage,
    }));
  }, [lang, MessageSquare, DESKTOP_APP_ICONS.social, DESKTOP_APP_ICONS.memoryLibrary, DESKTOP_APP_ICONS.mcpLab, DESKTOP_APP_ICONS.settings, DESKTOP_APP_ICONS.housing, DESKTOP_APP_ICONS.commercialStreet, DESKTOP_APP_ICONS.pixelCottage, DESKTOP_APP_ICONS.cityLog, formatBadge, socialUnreadCount, openSocialApp, activeTab, openBrowserTabs, LibraryBig, pluginById, Wifi, Settings, openSimpleTabApp, Home, Store, TASKBAR_APP_ICON_BY_ID]);

const pinnedDesktopApps = useMemo(
    () => desktopApps.filter(app => app.id !== 'language'),
    [desktopApps]
  );

const activeDesktopAppLabel = useMemo(() => {
    const activeApp = desktopApps.find(app => app.active);
    if (activeApp) return activeApp.label;
    const activePlugin = pluginById.get(activeTab);
    if (activePlugin) return lang === 'en' ? activePlugin.name_en : activePlugin.name_zh;
    if (activeTab === 'chats') return lang === 'en' ? 'Social' : '社交';
    return lang === 'en' ? 'ChatPulse' : 'ChatPulse';
  }, [activeTab, desktopApps, lang, pluginById]);

const activeDesktopAddress = useMemo(() => {
    const appSlug = String(activeDesktopAppLabel || 'app')
      .trim()
      .replace(/\s+/g, '-');
    return `${window.location.host}/${appSlug}`;
  }, [activeDesktopAppLabel]);

const getBrowserTabLabel = useCallback((tab) => {
    if (tab === 'chats') return lang === 'en' ? 'Social' : '社交';
    const app = desktopApps.find(item => item.id === tab);
    if (app) return app.label;
    const plugin = pluginById.get(tab);
    if (plugin) return lang === 'en' ? plugin.name_en : plugin.name_zh;
    return 'ChatPulse';
  }, [desktopApps, lang, pluginById]);

const getBrowserTabMark = useCallback((tab) => {
    const label = getBrowserTabLabel(tab);
    const normalized = String(label || 'CP').replace(/\s+/g, '');
    if (/^[\u4e00-\u9fa5]/.test(normalized)) return normalized.slice(0, 1);
    return normalized.slice(0, 2).toUpperCase();
  }, [getBrowserTabLabel]);

const activeBrowserWindow = useMemo(
    () => browserWindows.find(windowItem => windowItem.id === activeBrowserWindowId) || null,
    [activeBrowserWindowId, browserWindows]
  );

const browserWindowTaskbarItems = useMemo(() => (
    browserWindows.map((windowItem, index) => ({
      id: windowItem.id,
      minimized: windowItem.minimized,
      active: activeBrowserWindowId === windowItem.id && activeTab !== 'desktop',
      title: getBrowserTabLabel(windowItem.activeTab),
      tabsCount: windowItem.tabs.length,
      ordinal: index + 1,
      recalled: browserWindowRecallPulse?.windowId === windowItem.id,
    }))
  ), [activeBrowserWindowId, activeTab, browserWindowRecallPulse, browserWindows, getBrowserTabLabel]);
    return { formatBadge, openBrowserTabs, desktopApps, pinnedDesktopApps, activeDesktopAppLabel, activeDesktopAddress, getBrowserTabLabel, getBrowserTabMark, activeBrowserWindow, browserWindowTaskbarItems };
}
