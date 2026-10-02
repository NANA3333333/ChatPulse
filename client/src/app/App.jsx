import { PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY, PRIVATE_CHAT_FOREGROUND_EXIT_MS, PRIVATE_CHAT_DECOR_STORAGE_KEY, PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY, PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY, PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT, PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES, PRIVATE_CHAT_DECOR_DEFAULTS, PRIVATE_CHAT_DECOR_TARGETS } from '../features/private-chat/scene/config';
import { hasPrimaryModelConfig } from '../features/characters/modelConfig';
import { createModuleLoading } from "../shared/ui/moduleLoading.jsx";
import { createScenePreferences } from "../features/private-chat/scene/preferences.jsx";
import { useApplicationState } from "./useApplicationState.js";
import { useForegroundSettings } from "../features/private-chat/scene/useForegroundSettings.js";
import { useWindowState } from "../desktop/useWindowState.js";
import { useJumpTargets } from "../features/conversation-search/useJumpTargets.js";
import { useWindowNavigation } from "../desktop/useWindowNavigation.js";
import { useDesktopApps } from "../desktop/useDesktopApps.js";
import { useWindowInteractions } from "../desktop/useWindowInteractions.js";
import { useApplicationRefs } from "./useApplicationRefs.js";
import { useSearchNavigation } from "../features/conversation-search/useSearchNavigation.js";
import { useNotifications } from "../features/notifications/useNotifications.js";
import { useNotificationItems } from "../features/notifications/useNotificationItems.js";
import { useCharacterCreation } from "../features/characters/useCharacterCreation.js";
import { useCharacterDataReset } from "../features/characters/useCharacterDataReset.js";
import { useContacts } from "../features/characters/useContacts.js";
import { useDrawers } from "../features/private-chat/useDrawers.js";
import { useGroupActions } from "../features/group-chat/useGroupActions.jsx";
import { useApplicationEvents } from "./useApplicationEvents.js";
import { useConnection } from "./useRealtimeConnection.js";
import { useIncomingMessages } from "../features/private-chat/useIncomingMessages.js";
import { useIncomingGroupMessages } from "../features/group-chat/useIncomingMessages.js";
import { useConversationLifecycle } from "../features/private-chat/useConversationLifecycle.js";
import { useSceneRenderer } from "../features/private-chat/scene/useSceneRenderer.jsx";
import { useSocialWindowRenderer } from "./useSocialWindowRenderer.jsx";
import { useWindowRenderer } from "../desktop/useWindowRenderer.jsx";
import { useForegroundInteraction } from "../features/private-chat/scene/useForegroundInteraction.js";
import { ApplicationView } from "./ApplicationView";
import React, { lazy, useState, useEffect, useCallback, useMemo, useRef } from "react";

import ContactList from "../features/characters/components/ContactList.jsx";
import { ChatWindow } from "../features/private-chat";
import { dispatchReplyUpdate, subscribeToReplyUpdates } from "../features/private-chat";
import PrivateChatJournalPanel from "../features/diaries/components/PrivateChatJournalPanel.jsx";
import Live2DDesktopWallpaper from "../desktop/Live2DDesktopWallpaper.jsx";

import "../App.css";
import "../styles/desktop.css";
import { ArrowLeft, ArrowRight, Bell, BookOpen, Database, Home, LibraryBig, LogOut, MessageSquare, Minus, RefreshCw, Search, Settings, Square, Store, UsersRound, UserPlus, Wifi, X } from "lucide-react";
import { plugins } from "./featureRegistry.jsx";
import { useLanguage } from "../shared/i18n/LanguageContext.jsx";
import { useAuth } from "../features/account/AuthContext.jsx";
import Login from "../features/account/components/Login.jsx";
import AvatarWithFrame from "../shared/media/AvatarWithFrame.jsx";
import { defaultAvatarUrl, resolveAvatarUrl } from "../shared/media/avatar.js";
import ChatPulseDesktop from "../desktop/ChatPulseDesktop";
import DesktopTaskbar from "../desktop/DesktopTaskbar";
import { DESKTOP_APP_ICONS, DESKTOP_EVENT_NOTIFICATION_LIMIT, DESKTOP_MULTI_WINDOW_APP_TABS, DESKTOP_NOTIFICATION_TOAST_LIMIT, DESKTOP_NOTIFICATION_TOAST_TTL_MS, DESKTOP_TAB_DETACH_OFFSET, DESKTOP_TAB_DRAG_THRESHOLD, DESKTOP_TASKBAR_HEIGHT, DESKTOP_WALLPAPER_IMAGE_URLS, DESKTOP_WALLPAPER_OPTIONS, DESKTOP_WALLPAPER_STORAGE_KEY, DESKTOP_WINDOW_CHROME_HEIGHT, DESKTOP_WINDOW_MIN_HEIGHT, DESKTOP_WINDOW_MIN_WIDTH, TASKBAR_APP_ICON_BY_ID, getBrowserSnapshotFields, getDesktopAppSurfaceClass, getDesktopNotificationPreview, getResponsiveBrowserChromeHeight, loadDesktopWallpaper, normalizeDesktopWallpaper } from "../desktop/desktopUtils";

// Allow VITE config if available, otherwise dynamically use the current host IP/Domain
const defaultApiOrigin = window.location.origin;
const defaultWsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const defaultWsHost = window.location.host;
const API_URL = import.meta.env.VITE_API_URL || `${defaultApiOrigin}/api`;
const WS_URL = import.meta.env.VITE_WS_URL || `${defaultWsProtocol}//${defaultWsHost}/ws`;
const MODULE_LOAD_RETRY_BASE_MS = 800;
const MODULE_LOAD_RETRY_MAX_MS = 5000;
const MODULE_LOAD_RETRY_LIMIT = 3;
const MODULE_LOAD_AUTO_RETRY_DELAY_MS = 500;
const MODULE_LOAD_AUTO_RETRY_PREFIX = 'chatpulse:auto-module-retry:';

const normalizeChatSearchText = (value) => String(value || '').trim().toLowerCase();

const RETIRED_THEME_STORAGE_KEYS = ['cp_theme', 'cp_theme_config', 'cp_custom_css'];
const RETIRED_THEME_CSS_VARS = [
  '--accent-color',
  '--accent-hover',
  '--bg-main',
  '--bg-sidebar',
  '--bg-contacts',
  '--bg-chat-area',
  '--bg-input',
  '--text-primary',
  '--text-secondary',
  '--border-color',
  '--sidebar-icon',
  '--sidebar-icon-active',
  '--bubble-user-bg',
  '--bubble-user-text',
  '--bubble-ai-bg',
  '--bubble-ai-text',
];

const { clearRetiredThemeOverrides, lazyWithPreload, PanelFallback, DrawerFallback, AppErrorBoundary } = createModuleLoading({ get BookOpen() { return BookOpen; }, get MODULE_LOAD_AUTO_RETRY_DELAY_MS() { return MODULE_LOAD_AUTO_RETRY_DELAY_MS; }, get MODULE_LOAD_AUTO_RETRY_PREFIX() { return MODULE_LOAD_AUTO_RETRY_PREFIX; }, get MODULE_LOAD_RETRY_BASE_MS() { return MODULE_LOAD_RETRY_BASE_MS; }, get MODULE_LOAD_RETRY_LIMIT() { return MODULE_LOAD_RETRY_LIMIT; }, get MODULE_LOAD_RETRY_MAX_MS() { return MODULE_LOAD_RETRY_MAX_MS; }, get PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT() { return PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT; }, get PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES() { return PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES; }, get RETIRED_THEME_CSS_VARS() { return RETIRED_THEME_CSS_VARS; }, get RETIRED_THEME_STORAGE_KEYS() { return RETIRED_THEME_STORAGE_KEYS; }, get React() { return React; }, get Settings() { return Settings; }, get lazy() { return lazy; } });

const GroupChatWindow = lazyWithPreload(() => import("../features/group-chat/components/GroupChatWindow.jsx"));
const GroupManageDrawer = lazyWithPreload(() => import("../features/group-chat/components/GroupManageDrawer.jsx").then(module => ({ default: module.GroupManageDrawer })));
const CreateGroupModal = lazyWithPreload(() => import("../features/group-chat/components/CreateGroupModal.jsx"));
const AddCharacterModal = lazyWithPreload(() => import("../features/characters/components/AddCharacterModal.jsx"));
const MemoTable = lazyWithPreload(() => import("../features/memory/components/MemoTable.jsx"));
const DiaryTable = lazyWithPreload(() => import("../features/diaries/components/DiaryTable.jsx"));
const SettingsPanel = lazyWithPreload(() => import("../features/settings/components/SettingsPanel.jsx"));
const ChatSettingsDrawer = lazyWithPreload(() => import("../features/characters/components/ChatSettingsDrawer.jsx"));
const MemoryLibraryPanel = lazyWithPreload(() => import("../features/memory/components/MemoryLibraryPanel.jsx"));

const { normalizeForegroundPersonPosition, loadPrivateChatForegroundEnabled, normalizeDecorTransform, loadPrivateChatForegroundPersonPosition, savePrivateChatForegroundPersonPosition, loadPrivateChatDecorTransforms, isDecorTransformDefault, PrivateChatDecorEditor, PrivateChatDrawerShell } = createScenePreferences({ get PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES() { return PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES; }, get PRIVATE_CHAT_DECOR_DEFAULTS() { return PRIVATE_CHAT_DECOR_DEFAULTS; }, get PRIVATE_CHAT_DECOR_STORAGE_KEY() { return PRIVATE_CHAT_DECOR_STORAGE_KEY; }, get PRIVATE_CHAT_DECOR_TARGETS() { return PRIVATE_CHAT_DECOR_TARGETS; }, get PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY() { return PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY; }, get PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT() { return PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT; }, get PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY() { return PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY; }, get X() { return X; }, get useCallback() { return useCallback; }, get useEffect() { return useEffect; }, get useRef() { return useRef; }, get useState() { return useState; } });

const getDefaultBrowserWindowGeometry = (sequence = 0) => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
  const stackIndex = Math.max(0, sequence - 1);
  const width = Math.min(
    Math.max(420, viewportWidth - 40),
    1360,
    Math.max(900, Math.round(viewportWidth * 0.86))
  );
  const height = Math.min(
    Math.max(320, viewportHeight - taskbarHeight - 24),
    900,
    Math.max(560, viewportHeight - taskbarHeight - 58)
  );
  const maxX = Math.max(18, viewportWidth - width - 22);
  const maxY = Math.max(18, viewportHeight - height - taskbarHeight - 18);
  return {
    x: Math.min(maxX, Math.max(18, Math.round((viewportWidth - width) / 2) + (stackIndex % 4) * 32)),
    y: Math.min(maxY, 26 + (stackIndex % 3) * 24),
    width,
    height,
  };
};

const clampBrowserWindowGeometry = (geometry) => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
  const minWidth = Math.min(DESKTOP_WINDOW_MIN_WIDTH, Math.max(420, viewportWidth - 32));
  const minHeight = Math.min(DESKTOP_WINDOW_MIN_HEIGHT, Math.max(320, viewportHeight - taskbarHeight - 32));
  const maxWidth = Math.max(minWidth, viewportWidth - 24);
  const maxHeight = Math.max(minHeight, viewportHeight - taskbarHeight - 18);
  const width = Math.min(maxWidth, Math.max(minWidth, Math.round(geometry.width || 980)));
  const height = Math.min(maxHeight, Math.max(minHeight, Math.round(geometry.height || 640)));
  const x = Math.min(Math.max(12, Math.round(geometry.x || 0)), Math.max(12, viewportWidth - width - 12));
  const y = Math.min(Math.max(12, Math.round(geometry.y || 0)), Math.max(12, viewportHeight - taskbarHeight - height - 10));
  return { x, y, width, height };
};

const resizeBrowserWindowGeometry = (startGeometry, deltaX, deltaY, direction = 'se') => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
  const minWidth = Math.min(DESKTOP_WINDOW_MIN_WIDTH, Math.max(420, viewportWidth - 32));
  const minHeight = Math.min(DESKTOP_WINDOW_MIN_HEIGHT, Math.max(320, viewportHeight - taskbarHeight - 32));
  const maxWidth = Math.max(minWidth, viewportWidth - 24);
  const maxHeight = Math.max(minHeight, viewportHeight - taskbarHeight - 18);
  const dir = String(direction || 'se');
  let left = startGeometry.x;
  let top = startGeometry.y;
  let right = startGeometry.x + startGeometry.width;
  let bottom = startGeometry.y + startGeometry.height;

  if (dir.includes('e')) right += deltaX;
  if (dir.includes('w')) left += deltaX;
  if (dir.includes('s')) bottom += deltaY;
  if (dir.includes('n')) top += deltaY;

  let width = right - left;
  let height = bottom - top;

  if (width < minWidth) {
    if (dir.includes('w') && !dir.includes('e')) left = right - minWidth;
    else right = left + minWidth;
    width = minWidth;
  } else if (width > maxWidth) {
    if (dir.includes('w') && !dir.includes('e')) left = right - maxWidth;
    else right = left + maxWidth;
    width = maxWidth;
  }

  if (height < minHeight) {
    if (dir.includes('n') && !dir.includes('s')) top = bottom - minHeight;
    else bottom = top + minHeight;
    height = minHeight;
  } else if (height > maxHeight) {
    if (dir.includes('n') && !dir.includes('s')) top = bottom - maxHeight;
    else bottom = top + maxHeight;
    height = maxHeight;
  }

  return clampBrowserWindowGeometry({ x: left, y: top, width, height });
};

function App() {
  const { token, logout, user: authUser } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
  const { activeContactRef, activeGroupRef, activeTab, setActiveTab, activeContactId, setActiveContactId, contacts, setContacts, chatSearch, setChatSearch, contactsLoadError, setContactsLoadError, contactsLoaded, setContactsLoaded, activeContactSnapshot, setActiveContactSnapshot, incomingMessageQueue, setIncomingMessageQueue, activeDrawer, setActiveDrawer, userProfile, setUserProfile, isLoaded, setIsLoaded, engineState, setEngineState, showAddCharModal, setShowAddCharModal, showCreateGroupModal, setShowCreateGroupModal, groups, setGroups, activeGroupId, setActiveGroupId, conversationJumpTarget, setConversationJumpTarget, incomingGroupMessageQueue, setIncomingGroupMessageQueue, groupUnreadCounts, setGroupUnreadCounts, desktopEventNotifications, setDesktopEventNotifications, desktopToastNotifications, setDesktopToastNotifications, groupTyping, setGroupTyping, globalAnnouncement, setGlobalAnnouncement, groupChatEnabled, setGroupChatEnabled, redpacketClaimEvent, setRedpacketClaimEvent, generatingSchedules, setGeneratingSchedules, hiddenMessagesCount, setHiddenMessagesCount } = useApplicationState({
        authUser, token
    }); // 'desktop', 'chats', 'contacts', 'settings'

   // 'memo', 'diary', 'settings', 'group-manage', or null

   // { groupId: [{ sender_id, name }, ...] }
  
   // Auto-detected: true if Group Chat DLC is loaded

  const { desktopWallpaper, privateChatForegroundEnabled, privateChatForegroundExiting, privateChatDecorTransforms, setPrivateChatDecorTransforms, setPrivateChatForegroundPersonPosition, privateChatForegroundPersonPositionRef, privateChatForegroundPersonKeysRef, privateChatForegroundPersonLastSaveRef, privateChatDecorEditorOpen, setPrivateChatDecorEditorOpenPersisted, handleDesktopWallpaperChange, getPrivateChatDecorStyle, handlePrivateChatForegroundToggle } = useForegroundSettings({
        DESKTOP_WALLPAPER_STORAGE_KEY, PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY, PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY, PRIVATE_CHAT_FOREGROUND_EXIT_MS, loadDesktopWallpaper, loadPrivateChatDecorTransforms, loadPrivateChatForegroundEnabled, loadPrivateChatForegroundPersonPosition, normalizeDecorTransform, normalizeDesktopWallpaper
    });

  const effectiveUser = useMemo(() => ({ ...(authUser || {}), ...(userProfile || {}) }), [authUser, userProfile]);
  const visiblePlugins = plugins.filter(p => !p.condition || p.condition(effectiveUser));
  const experimentalPlugins = visiblePlugins.filter(p => p.position === 'experiment');
  const regularPlugins = visiblePlugins.filter(p => p.position !== 'experiment');
  const activeChatContact = contacts.find(c => c.id === activeContactId) || activeContactSnapshot;
  const pluginById = useMemo(() => new Map(visiblePlugins.map(plugin => [plugin.id, plugin])), [visiblePlugins]);
  const privateUnreadCount = contacts.reduce((sum, contact) => sum + (Number(contact.unread) || 0), 0);
  const groupUnreadCount = Object.values(groupUnreadCounts).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const socialUnreadCount = privateUnreadCount + groupUnreadCount;
  const { browserWindowMaximized, setBrowserWindowMaximized, browserWindows, setBrowserWindows, activeBrowserWindowId, setActiveBrowserWindowId, browserWindowInteractionMode, setBrowserWindowInteractionMode, browserWindowMergeTargetId, setBrowserWindowMergeTargetId, browserTabDragPreview, setBrowserTabDragPreview, browserWindowRecallPulse, setBrowserWindowRecallPulse, browserWindowGeometrySwitchingWindowId, setBrowserWindowGeometrySwitchingWindowId, browserWindowSeqRef, browserWindowInteractionRef, browserWindowsRef, browserWindowGeometrySyncTimersRef, browserWindowPointerListenerCleanupRef, browserWindowGeometrySwitchTimerRef, suppressBrowserWindowClickRef } = useWindowState({
        
    });

  const { normalizeConversationJumpTarget, buildConversationJumpTarget } = useJumpTargets({
        
    });

  const { normalizeBrowserWindowSocialState, applyBrowserWindowSocialState, updateBrowserWindowSocialState, snapshotActiveBrowserWindow, openDesktop, openBrowserApp, openSocialApp, openSimpleTabApp } = useWindowNavigation({
        DESKTOP_MULTI_WINDOW_APP_TABS, DESKTOP_WINDOW_CHROME_HEIGHT, activeBrowserWindowId, activeContactId, activeContactRef, activeDrawer, activeGroupId, activeGroupRef, activeTab, browserWindowMaximized, browserWindowRecallPulse, browserWindowSeqRef, browserWindowsRef, contacts, getDefaultBrowserWindowGeometry, groups, normalizeConversationJumpTarget, setActiveBrowserWindowId, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setBrowserWindowMaximized, setBrowserWindowRecallPulse, setBrowserWindows, setConversationJumpTarget
    });

  const { formatBadge, desktopApps, pinnedDesktopApps, activeDesktopAddress, getBrowserTabLabel, getBrowserTabMark, activeBrowserWindow, browserWindowTaskbarItems } = useDesktopApps({
        DESKTOP_APP_ICONS, Home, LibraryBig, MessageSquare, Settings, Store, TASKBAR_APP_ICON_BY_ID, Wifi, activeBrowserWindowId, activeTab, browserWindowRecallPulse, browserWindows, lang, openSimpleTabApp, openSocialApp, pluginById, socialUnreadCount
    });

  const { beginBrowserWindowGeometrySwitch, minimizeBrowserWindow, restoreBrowserWindow, toggleBrowserWindowFromTaskbar, activateBrowserTab, focusBrowserWindowTab, toggleBrowserWindowMaximized, activeBrowserWindowStyle, activeBrowserWindowLayoutClasses, getBrowserWindowStackStyle, stopBrowserWindowInteraction, handleBrowserWindowPointerMove, startBrowserWindowDrag, startBrowserWindowResize, startBrowserTabDrag, closeBrowserWindow, browserTabs, getBrowserWindowTabs, getBrowserWindowAddress, getBrowserWindowLayoutClasses } = useWindowInteractions({
        DESKTOP_TAB_DETACH_OFFSET, DESKTOP_TAB_DRAG_THRESHOLD, DESKTOP_TASKBAR_HEIGHT, activeBrowserWindow, activeBrowserWindowId, activeContactId, activeContactRef, activeGroupId, activeGroupRef, activeTab, applyBrowserWindowSocialState, browserWindowGeometrySwitchTimerRef, browserWindowGeometrySyncTimersRef, browserWindowInteractionMode, browserWindowInteractionRef, browserWindowMaximized, browserWindowMergeTargetId, browserWindowPointerListenerCleanupRef, browserWindowSeqRef, browserWindows, browserWindowsRef, clampBrowserWindowGeometry, clearRetiredThemeOverrides, contacts, getBrowserSnapshotFields, getBrowserTabLabel, getBrowserTabMark, getResponsiveBrowserChromeHeight, groupUnreadCounts, groups, lang, openDesktop, resizeBrowserWindowGeometry, setActiveBrowserWindowId, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setBrowserTabDragPreview, setBrowserWindowGeometrySwitchingWindowId, setBrowserWindowInteractionMode, setBrowserWindowMaximized, setBrowserWindowMergeTargetId, setBrowserWindows, snapshotActiveBrowserWindow, suppressBrowserWindowClickRef
    });

  // Use a ref to track the active contact ID without causing useEffect re-renders when it changes.
  const { activeTabRef, activeBrowserWindowIdRef, contactsRef, groupsRef, langRef, desktopToastTimersRef, openCreatedCharacterInChatRef } = useApplicationRefs({
        activeBrowserWindowId, activeContactId, activeDrawer, activeGroupId, activeTab, browserWindowGeometrySwitchTimerRef, browserWindowGeometrySyncTimersRef, browserWindowPointerListenerCleanupRef, browserWindows, browserWindowsRef, contacts, conversationJumpTarget, groups, lang, updateBrowserWindowSocialState
    });

  const { clearConversationJumpTarget, handleConversationSearchResultSelect } = useSearchNavigation({
        activeBrowserWindowIdRef, activeContactId, activeContactRef, activeGroupId, activeGroupRef, buildConversationJumpTarget, contacts, conversationJumpTarget, desktopToastTimersRef, lang, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setContacts, setConversationJumpTarget, setGroupUnreadCounts, updateBrowserWindowSocialState
    });

  const { dismissDesktopToastNotification, pushDesktopEventNotification, isBrowserTabVisible, isPrivateConversationVisible, isGroupConversationVisible } = useNotifications({
        DESKTOP_EVENT_NOTIFICATION_LIMIT, DESKTOP_NOTIFICATION_TOAST_LIMIT, DESKTOP_NOTIFICATION_TOAST_TTL_MS, activeBrowserWindowIdRef, activeContactRef, activeGroupRef, activeTabRef, browserWindowsRef, desktopToastTimersRef, setDesktopEventNotifications, setDesktopToastNotifications
    });

  const { buildCityNotificationItem, desktopNotifications, desktopToastItems } = useNotificationItems({
        Bell, DESKTOP_APP_ICONS, MessageSquare, Square, Store, activeContactRef, activeGroupRef, browserWindowTaskbarItems, contactsLoadError, contactsRef, desktopEventNotifications, desktopToastNotifications, getDesktopNotificationPreview, lang, langRef, openBrowserApp, openSimpleTabApp, openSocialApp, pluginById, restoreBrowserWindow, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setContacts, setGroupUnreadCounts, socialUnreadCount
    });

  const { openAddCharacterModal, closeAddCharacterModal, handleCharacterAdded } = useCharacterCreation({
        AddCharacterModal, activeContactId, activeContactRef, activeGroupId, activeGroupRef, activeTab, contacts, openCreatedCharacterInChatRef, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setContacts, setShowAddCharModal
    });

  // Use a ref to track which incoming messages we've already processed for unread badges and sounds
  const { processedMessagesRef, processedGroupMessagesRef, cityRefreshRef, contactsRefreshRef } = useCharacterDataReset({
        activeContactRef, setActiveContactSnapshot, setContacts
    });

  const { fetchContacts, scheduleContactsRefresh, removeDeletedContact } = useContacts({
        API_URL, activeContactRef, contactsRefreshRef, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setContacts, setContactsLoadError, setContactsLoaded, setEngineState, setGroups, token
    });

  const { preloadChatDrawer, toggleChatDrawer } = useDrawers({
        ChatSettingsDrawer, DiaryTable, GroupManageDrawer, MemoTable, clearConversationJumpTarget, setActiveDrawer
    });

  const { updateGroupInState, renderGroupSideSlot } = useGroupActions({
        API_URL, BookOpen, GroupManageDrawer, MessageSquare, UsersRound, contacts, effectiveUser, lang, resolveAvatarUrl, setGroups
    });

  // 1. Fetch Contacts (Characters) and Profile on mount
  useApplicationEvents({
        API_URL, activeContactRef, activeGroupRef, activeTabRef, fetchContacts, scheduleContactsRefresh, setActiveContactId, setActiveContactSnapshot, setActiveGroupId, setActiveTab, setGlobalAnnouncement, setGroupChatEnabled, setGroups, setIncomingMessageQueue, setIsLoaded, setUserProfile, subscribeToReplyUpdates, token
    });

  // Listen for iframe postMessage from SillyTavern parent

  // 2. Setup WebSocket for real-time messages
  useConnection({
        WS_URL, buildCityNotificationItem, cityRefreshRef, contactsRefreshRef, dispatchReplyUpdate, fetchContacts, isBrowserTabVisible, pushDesktopEventNotification, removeDeletedContact, scheduleContactsRefresh, setContacts, setEngineState, setGeneratingSchedules, setGlobalAnnouncement, setGroupTyping, setIncomingGroupMessageQueue, setIncomingMessageQueue, setRedpacketClaimEvent, setUserProfile, token
    });

  // Update contact last message preview on new incoming message
  useIncomingMessages({
        API_URL, DESKTOP_APP_ICONS, MessageSquare, contactsRef, defaultAvatarUrl, getDesktopNotificationPreview, incomingMessageQueue, isPrivateConversationVisible, langRef, processedMessagesRef, pushDesktopEventNotification, resolveAvatarUrl, setContacts
    });

  useIncomingGroupMessages({
        DESKTOP_APP_ICONS, UsersRound, contactsRef, getDesktopNotificationPreview, groupsRef, incomingGroupMessageQueue, isGroupConversationVisible, langRef, processedGroupMessagesRef, pushDesktopEventNotification, setGroupUnreadCounts
    });

  useConversationLifecycle({
        PRIVATE_CHAT_DECOR_STORAGE_KEY, PRIVATE_CHAT_DECOR_TARGETS, activeBrowserWindowId, activeGroupId, activeTab, browserWindows, effectiveUser, isDecorTransformDefault, isGroupConversationVisible, plugins, privateChatDecorTransforms, setActiveTab, setGroupUnreadCounts, setPrivateChatDecorEditorOpenPersisted
    });

  const isViewingList = (activeTab === 'contacts' || (activeTab === 'chats' && !activeContactId && !activeGroupId));
  const isPrivateChatView = activeTab === 'chats' && !!activeContactId;
  const isGroupChatView = activeTab === 'chats' && !!activeGroupId;
  const isChatSceneView = activeTab === 'chats' && (!!activeContactId || !!activeGroupId);
  const isContactsSceneView = activeTab === 'contacts';
  const isStaticPixelSceneView = activeTab === 'memory_library' || activeTab === 'mcp_lab' || activeTab === 'settings' || activeTab === 'housing_social';
  const isBarePixelSceneView = activeTab === 'commercial_street' || activeTab === 'pixel_cottage' || activeTab === 'city';
  const activeGroup = activeGroupId
    ? groups.find(group => String(group.id) === String(activeGroupId))
    : null;
  const chatSearchNeedle = useMemo(() => normalizeChatSearchText(chatSearch), [chatSearch]);
  const filteredContacts = useMemo(() => {
    if (!chatSearchNeedle) return contacts;
    return contacts.filter((contact) => [
      contact.id,
      contact.name,
      contact.lastMessage,
      contact.model_name,
      contact.city_status,
      contact.location,
    ].some((value) => normalizeChatSearchText(value).includes(chatSearchNeedle)));
  }, [chatSearchNeedle, contacts]);
  const filteredGroups = useMemo(() => {
    if (!chatSearchNeedle) return groups;
    return groups.filter((group) => {
      const memberNames = (group.members || []).map((memberObj) => {
        const memberId = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
        if (memberId === 'user') return userProfile?.name || 'User';
        return contacts.find((contact) => String(contact.id) === String(memberId))?.name || memberId || '';
      });
      return [
        group.id,
        group.name,
        group.description,
        ...memberNames,
      ].some((value) => normalizeChatSearchText(value).includes(chatSearchNeedle));
    });
  }, [chatSearchNeedle, contacts, groups, userProfile?.name]);
  const shouldShowSocialWindowLoading = activeTab === 'chats' && !contactsLoaded && !contactsLoadError;
  const hasForegroundSceneView = isChatSceneView && privateChatForegroundEnabled && !shouldShowSocialWindowLoading;
  const { renderPrivateChatForegroundScene } = useSceneRenderer({
        PrivateChatDecorEditor, getPrivateChatDecorStyle, hasForegroundSceneView, lang, privateChatDecorEditorOpen, privateChatDecorTransforms, setPrivateChatDecorEditorOpenPersisted, setPrivateChatDecorTransforms
    });

  const { renderLiveSocialWindowContent } = useSocialWindowRenderer({
        setShowCreateGroupModal,
        API_URL, AppErrorBoundary, AvatarWithFrame, ChatSettingsDrawer, ChatWindow, ContactList, DiaryTable, DrawerFallback, GroupChatWindow, MemoTable, MessageSquare, PrivateChatDrawerShell, PrivateChatJournalPanel, Search, UserPlus, UsersRound, buildConversationJumpTarget, chatSearch, chatSearchNeedle, contacts, defaultAvatarUrl, effectiveUser, engineState, fetchContacts, filteredContacts, filteredGroups, formatBadge, generatingSchedules, groupChatEnabled, groupTyping, groupUnreadCounts, groups, hiddenMessagesCount, incomingGroupMessageQueue, incomingMessageQueue, lang, normalizeBrowserWindowSocialState, openAddCharacterModal, preloadChatDrawer, privateChatDecorEditorOpen, privateChatDecorTransforms, privateChatForegroundEnabled, redpacketClaimEvent, renderGroupSideSlot, resolveAvatarUrl, setBrowserWindows, setChatSearch, setContacts, setGroupUnreadCounts, setGroups, setHiddenMessagesCount, setPrivateChatDecorEditorOpenPersisted, t, updateBrowserWindowSocialState, updateGroupInState, userProfile
    });

  const { renderDesktopWindowContent } = useWindowRenderer({
        API_URL, DESKTOP_WALLPAPER_OPTIONS, MemoryLibraryPanel, MessageSquare, PanelFallback, SettingsPanel, contacts, desktopWallpaper, effectiveUser, fetchContacts, getDesktopAppSurfaceClass, handleDesktopWallpaperChange, removeDeletedContact, setActiveTab, setUserProfile, visiblePlugins
    });
  const hasPixelSceneView = isChatSceneView || isContactsSceneView || isStaticPixelSceneView;
  const hasPixelSkinView = hasPixelSceneView || isBarePixelSceneView || activeTab === 'chats';
  
  const isForegroundExitingSceneView = isChatSceneView && !privateChatForegroundEnabled && privateChatForegroundExiting && !shouldShowSocialWindowLoading;
  const shouldRenderForegroundScene = hasForegroundSceneView || isForegroundExitingSceneView;
  const isForegroundLayoutLifted = shouldRenderForegroundScene && !(isGroupChatView && browserWindowMaximized);
  const shouldEnableForegroundPersonControl = false;
  const appWallpaperKey = normalizeDesktopWallpaper(desktopWallpaper);
  const appWallpaperImageSrc = DESKTOP_WALLPAPER_IMAGE_URLS[appWallpaperKey];
  const appWallpaperAnimated = appWallpaperKey === 'ocean-live2d';

  useForegroundInteraction({
        normalizeForegroundPersonPosition, privateChatForegroundPersonKeysRef, privateChatForegroundPersonLastSaveRef, privateChatForegroundPersonPositionRef, savePrivateChatForegroundPersonPosition, setPrivateChatForegroundPersonPosition, shouldEnableForegroundPersonControl
    });

  if (!token) {
    return <Login apiUrl={API_URL} />;
  }

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-color, #f5f5f5)' }}>
        <div className="spin" style={{ width: '40px', height: '40px', border: '4px solid var(--accent-color, #07c160)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
      </div>
    );
  }

  return <ApplicationView API_URL={API_URL}
        AddCharacterModal={AddCharacterModal}
        AppErrorBoundary={AppErrorBoundary}
        ArrowLeft={ArrowLeft}
        ArrowRight={ArrowRight}
        AvatarWithFrame={AvatarWithFrame}
        ChatPulseDesktop={ChatPulseDesktop}
        ChatSettingsDrawer={ChatSettingsDrawer}
        ChatWindow={ChatWindow}
        ContactList={ContactList}
        CreateGroupModal={CreateGroupModal}
        Database={Database}
        DesktopTaskbar={DesktopTaskbar}
        DiaryTable={DiaryTable}
        DrawerFallback={DrawerFallback}
        GroupChatWindow={GroupChatWindow}
        LibraryBig={LibraryBig}
        Live2DDesktopWallpaper={Live2DDesktopWallpaper}
        LogOut={LogOut}
        MemoTable={MemoTable}
        MessageSquare={MessageSquare}
        Minus={Minus}
        PanelFallback={PanelFallback}
        PrivateChatDrawerShell={PrivateChatDrawerShell}
        PrivateChatJournalPanel={PrivateChatJournalPanel}
        RefreshCw={RefreshCw}
        Search={Search}
        Settings={Settings}
        Square={Square}
        UserPlus={UserPlus}
        UsersRound={UsersRound}
        Wifi={Wifi}
        X={X}
        activateBrowserTab={activateBrowserTab}
        activeBrowserWindowId={activeBrowserWindowId}
        activeBrowserWindowLayoutClasses={activeBrowserWindowLayoutClasses}
        activeBrowserWindowStyle={activeBrowserWindowStyle}
        activeChatContact={activeChatContact}
        activeContactId={activeContactId}
        activeContactRef={activeContactRef}
        activeDesktopAddress={activeDesktopAddress}
        activeDrawer={activeDrawer}
        activeGroup={activeGroup}
        activeGroupId={activeGroupId}
        activeGroupRef={activeGroupRef}
        activeTab={activeTab}
        appWallpaperAnimated={appWallpaperAnimated}
        appWallpaperImageSrc={appWallpaperImageSrc}
        beginBrowserWindowGeometrySwitch={beginBrowserWindowGeometrySwitch}
        browserTabDragPreview={browserTabDragPreview}
        browserTabs={browserTabs}
        browserWindowGeometrySwitchingWindowId={browserWindowGeometrySwitchingWindowId}
        browserWindowInteractionMode={browserWindowInteractionMode}
        browserWindowInteractionRef={browserWindowInteractionRef}
        browserWindowMaximized={browserWindowMaximized}
        browserWindowMergeTargetId={browserWindowMergeTargetId}
        browserWindowRecallPulse={browserWindowRecallPulse}
        browserWindowTaskbarItems={browserWindowTaskbarItems}
        browserWindows={browserWindows}
        chatSearch={chatSearch}
        chatSearchNeedle={chatSearchNeedle}
        clearConversationJumpTarget={clearConversationJumpTarget}
        closeAddCharacterModal={closeAddCharacterModal}
        closeBrowserWindow={closeBrowserWindow}
        contacts={contacts}
        contactsLoadError={contactsLoadError}
        contactsLoaded={contactsLoaded}
        conversationJumpTarget={conversationJumpTarget}
        defaultAvatarUrl={defaultAvatarUrl}
        desktopApps={desktopApps}
        desktopNotifications={desktopNotifications}
        desktopToastItems={desktopToastItems}
        desktopWallpaper={desktopWallpaper}
        dismissDesktopToastNotification={dismissDesktopToastNotification}
        effectiveUser={effectiveUser}
        engineState={engineState}
        experimentalPlugins={experimentalPlugins}
        fetchContacts={fetchContacts}
        filteredContacts={filteredContacts}
        filteredGroups={filteredGroups}
        focusBrowserWindowTab={focusBrowserWindowTab}
        formatBadge={formatBadge}
        generatingSchedules={generatingSchedules}
        getBrowserWindowAddress={getBrowserWindowAddress}
        getBrowserWindowLayoutClasses={getBrowserWindowLayoutClasses}
        getBrowserWindowStackStyle={getBrowserWindowStackStyle}
        getBrowserWindowTabs={getBrowserWindowTabs}
        globalAnnouncement={globalAnnouncement}
        groupChatEnabled={groupChatEnabled}
        groupTyping={groupTyping}
        groupUnreadCounts={groupUnreadCounts}
        groups={groups}
        handleBrowserWindowPointerMove={handleBrowserWindowPointerMove}
        handleCharacterAdded={handleCharacterAdded}
        handleConversationSearchResultSelect={handleConversationSearchResultSelect}
        handleDesktopWallpaperChange={handleDesktopWallpaperChange}
        handlePrivateChatForegroundToggle={handlePrivateChatForegroundToggle}
        hasForegroundSceneView={hasForegroundSceneView}
        hasPixelSkinView={hasPixelSkinView}
        hasPrimaryModelConfig={hasPrimaryModelConfig}
        hiddenMessagesCount={hiddenMessagesCount}
        incomingGroupMessageQueue={incomingGroupMessageQueue}
        incomingMessageQueue={incomingMessageQueue}
        isBarePixelSceneView={isBarePixelSceneView}
        isContactsSceneView={isContactsSceneView}
        isForegroundExitingSceneView={isForegroundExitingSceneView}
        isForegroundLayoutLifted={isForegroundLayoutLifted}
        isPrivateChatView={isPrivateChatView}
        isStaticPixelSceneView={isStaticPixelSceneView}
        isViewingList={isViewingList}
        lang={lang}
        logout={logout}
        minimizeBrowserWindow={minimizeBrowserWindow}
        normalizeBrowserWindowSocialState={normalizeBrowserWindowSocialState}
        openAddCharacterModal={openAddCharacterModal}
        openDesktop={openDesktop}
        pinnedDesktopApps={pinnedDesktopApps}
        preloadChatDrawer={preloadChatDrawer}
        privateChatDecorEditorOpen={privateChatDecorEditorOpen}
        privateChatForegroundEnabled={privateChatForegroundEnabled}
        redpacketClaimEvent={redpacketClaimEvent}
        regularPlugins={regularPlugins}
        renderDesktopWindowContent={renderDesktopWindowContent}
        renderGroupSideSlot={renderGroupSideSlot}
        renderLiveSocialWindowContent={renderLiveSocialWindowContent}
        renderPrivateChatForegroundScene={renderPrivateChatForegroundScene}
        resolveAvatarUrl={resolveAvatarUrl}
        setActiveBrowserWindowId={setActiveBrowserWindowId}
        setActiveContactId={setActiveContactId}
        setActiveContactSnapshot={setActiveContactSnapshot}
        setActiveDrawer={setActiveDrawer}
        setActiveGroupId={setActiveGroupId}
        setActiveTab={setActiveTab}
        setBrowserWindowMaximized={setBrowserWindowMaximized}
        setBrowserWindows={setBrowserWindows}
        setChatSearch={setChatSearch}
        setContacts={setContacts}
        setConversationJumpTarget={setConversationJumpTarget}
        setGlobalAnnouncement={setGlobalAnnouncement}
        setGroupUnreadCounts={setGroupUnreadCounts}
        setGroups={setGroups}
        setHiddenMessagesCount={setHiddenMessagesCount}
        setShowCreateGroupModal={setShowCreateGroupModal}
        shouldRenderForegroundScene={shouldRenderForegroundScene}
        shouldShowSocialWindowLoading={shouldShowSocialWindowLoading}
        showAddCharModal={showAddCharModal}
        showCreateGroupModal={showCreateGroupModal}
        socialUnreadCount={socialUnreadCount}
        startBrowserTabDrag={startBrowserTabDrag}
        startBrowserWindowDrag={startBrowserWindowDrag}
        startBrowserWindowResize={startBrowserWindowResize}
        stopBrowserWindowInteraction={stopBrowserWindowInteraction}
        suppressBrowserWindowClickRef={suppressBrowserWindowClickRef}
        t={t}
        toggleBrowserWindowFromTaskbar={toggleBrowserWindowFromTaskbar}
        toggleBrowserWindowMaximized={toggleBrowserWindowMaximized}
        toggleChatDrawer={toggleChatDrawer}
        toggleLanguage={toggleLanguage}
        token={token}
        updateGroupInState={updateGroupInState}
        userProfile={userProfile} />;
}

export default App;

