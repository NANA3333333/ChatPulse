import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AvatarWithFrame from '../components/AvatarWithFrame';
import { defaultAvatarUrl } from '../utils/avatar';
import {
  Accessibility,
  Battery,
  BatteryCharging,
  Bell,
  BellOff,
  Bluetooth,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CloudSun,
  Database,
  Folder,
  Home,
  LayoutGrid,
  LibraryBig,
  LoaderCircle,
  Lock,
  MapPinned,
  MessageSquare,
  Minus,
  MonitorCog,
  MoreHorizontal,
  Music2,
  Pause,
  Plane,
  Play,
  Plus,
  Recycle,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Store,
  SunMedium,
  UsersRound,
  UserPlus,
  Volume2,
  VolumeX,
  Wand2,
  Wifi,
  X,
} from 'lucide-react';
import {
  DESKTOP_APP_ICONS,
  DESKTOP_TASKBAR_HEIGHT,
  DESKTOP_WIDGET_IMAGES,
  TASKBAR_APP_ICONS,
  buildDesktopCalendarDays,
  formatDesktopDateTime,
  formatDesktopMonthTitle,
  formatDesktopPanelDate,
  formatPomodoroTime,
  getCurrentDesktopWeatherEvent,
  getDesktopLunarInfo,
  getDesktopWeatherVisual,
} from './desktopUtils';
import DesktopAppButton from './DesktopAppButton';

const API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
function DesktopTaskbar({
  lang,
  apps = [],
  pinnedApps,
  browserWindows = [],
  notificationItems = [],
  notificationBadgeCount = 0,
  onOpenDesktop,
  onToggleBrowserWindow,
  onToggleLanguage,
  toastItems = [],
  onDismissToast,
  token,
  userLabel = 'NA NA',
}) {
  const [dateTime, setDateTime] = useState(() => formatDesktopDateTime(lang));
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [startQuery, setStartQuery] = useState('');
  const [startFeedOffset, setStartFeedOffset] = useState(0);
  const [startSidePanelHidden, setStartSidePanelHidden] = useState(false);
  const [startDeviceMode, setStartDeviceMode] = useState('android');
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationCenterClosing, setNotificationCenterClosing] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [quickSettingsClosing, setQuickSettingsClosing] = useState(false);
  const notificationCenterOpenRef = useRef(false);
  const notificationCenterClosingRef = useRef(false);
  const quickSettingsOpenRef = useRef(false);
  const quickSettingsClosingRef = useRef(false);
  const notificationCenterPanelMountedRef = useRef(false);
  const quickSettingsPanelMountedRef = useRef(false);
  const [quickSettingsView, setQuickSettingsView] = useState('main');
  const [quietModeEnabled, setQuietModeEnabled] = useState(false);
  const [wifiEnabled, setWifiEnabled] = useState(true);
  const [wifiConnectedId, setWifiConnectedId] = useState('koi-diner');
  const [wifiConnectingId, setWifiConnectingId] = useState(null);
  const [wifiPanelSelectedId, setWifiPanelSelectedId] = useState('koi-diner');
  const [wifiPasswordDraft, setWifiPasswordDraft] = useState('');
  const [wifiPasswordError, setWifiPasswordError] = useState('');
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [studioEffectsEnabled, setStudioEffectsEnabled] = useState(false);
  const [airplaneModeEnabled, setAirplaneModeEnabled] = useState(false);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [powerSaverEnabled, setPowerSaverEnabled] = useState(true);
  const [brightnessLevel, setBrightnessLevel] = useState(94);
  const [systemVolume, setSystemVolume] = useState(3);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [pomodoroMinutes, setPomodoroMinutes] = useState(30);
  const [pomodoroSecondsLeft, setPomodoroSecondsLeft] = useState(30 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [widgetsPanelOpen, setWidgetsPanelOpen] = useState(false);
  const [widgetsCategory, setWidgetsCategory] = useState('discover');
  const [widgetsNewsOffset, setWidgetsNewsOffset] = useState(0);
  const [widgetNewsMotion, setWidgetNewsMotion] = useState({
    current: [],
    previous: [],
    phaseKey: 0,
    isTransitioning: false,
  });
  const [desktopWeatherEvent, setDesktopWeatherEvent] = useState(null);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => new Set());
  const wifiConnectTimerRef = useRef(null);
  const notificationExitTimerRef = useRef(null);
  const quickSettingsExitTimerRef = useRef(null);
  const desktopWeather = useMemo(
    () => getDesktopWeatherVisual(desktopWeatherEvent, lang === 'en'),
    [desktopWeatherEvent, lang]
  );
  const DesktopWeatherIcon = desktopWeather.Icon || CloudSun;

  useEffect(() => {
    setDateTime(formatDesktopDateTime(lang));
    const timer = window.setInterval(() => {
      setDateTime(formatDesktopDateTime(lang));
    }, 30000);
    return () => window.clearInterval(timer);
  }, [lang]);

  useEffect(() => () => {
    if (wifiConnectTimerRef.current) {
      window.clearTimeout(wifiConnectTimerRef.current);
    }
    if (notificationExitTimerRef.current) {
      window.clearTimeout(notificationExitTimerRef.current);
    }
    if (quickSettingsExitTimerRef.current) {
      window.clearTimeout(quickSettingsExitTimerRef.current);
    }
  }, []);

  useEffect(() => {
    notificationCenterOpenRef.current = notificationCenterOpen;
  }, [notificationCenterOpen]);

  useEffect(() => {
    notificationCenterClosingRef.current = notificationCenterClosing;
  }, [notificationCenterClosing]);

  useEffect(() => {
    quickSettingsOpenRef.current = quickSettingsOpen;
  }, [quickSettingsOpen]);

  useEffect(() => {
    quickSettingsClosingRef.current = quickSettingsClosing;
  }, [quickSettingsClosing]);

  useEffect(() => {
    if (!pomodoroRunning) return undefined;
    const timer = window.setInterval(() => {
      setPomodoroSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setPomodoroRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pomodoroRunning]);

  const refreshDesktopWeather = useCallback(async (signal) => {
    if (!token) {
      setDesktopWeatherEvent(null);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/city/events`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok) return;
      const data = await response.json();
      setDesktopWeatherEvent(getCurrentDesktopWeatherEvent(data?.events) || null);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('Failed to refresh desktop weather widget:', error);
      }
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    refreshDesktopWeather(controller.signal);
    const timer = window.setInterval(() => {
      refreshDesktopWeather();
    }, 120000);
    const handleCityUpdate = () => {
      refreshDesktopWeather();
    };
    window.addEventListener('city_update', handleCityUpdate);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('city_update', handleCityUpdate);
    };
  }, [refreshDesktopWeather]);

  const closeNotificationCenter = useCallback((animate = true) => {
    if (notificationExitTimerRef.current) {
      window.clearTimeout(notificationExitTimerRef.current);
      notificationExitTimerRef.current = null;
    }

    if (animate && (notificationCenterPanelMountedRef.current || notificationCenterOpenRef.current || notificationCenterClosingRef.current)) {
      notificationCenterOpenRef.current = false;
      notificationCenterClosingRef.current = true;
      setNotificationCenterOpen(false);
      setNotificationCenterClosing(true);
      notificationExitTimerRef.current = window.setTimeout(() => {
        notificationCenterClosingRef.current = false;
        setNotificationCenterClosing(false);
        notificationExitTimerRef.current = null;
      }, 280);
      return;
    }

    notificationCenterOpenRef.current = false;
    notificationCenterClosingRef.current = false;
    setNotificationCenterOpen(false);
    setNotificationCenterClosing(false);
  }, []);

  const openNotificationCenter = useCallback(() => {
    if (notificationExitTimerRef.current) {
      window.clearTimeout(notificationExitTimerRef.current);
      notificationExitTimerRef.current = null;
    }
    notificationCenterOpenRef.current = true;
    notificationCenterClosingRef.current = false;
    setNotificationCenterClosing(false);
    setNotificationCenterOpen(true);
  }, []);

  const closeQuickSettings = useCallback((animate = true) => {
    if (quickSettingsExitTimerRef.current) {
      window.clearTimeout(quickSettingsExitTimerRef.current);
      quickSettingsExitTimerRef.current = null;
    }

    if (animate && (quickSettingsPanelMountedRef.current || quickSettingsOpenRef.current || quickSettingsClosingRef.current)) {
      quickSettingsOpenRef.current = false;
      quickSettingsClosingRef.current = true;
      setQuickSettingsOpen(false);
      setQuickSettingsClosing(true);
      quickSettingsExitTimerRef.current = window.setTimeout(() => {
        quickSettingsClosingRef.current = false;
        setQuickSettingsClosing(false);
        setQuickSettingsView('main');
        quickSettingsExitTimerRef.current = null;
      }, 280);
      return;
    }

    quickSettingsOpenRef.current = false;
    quickSettingsClosingRef.current = false;
    setQuickSettingsOpen(false);
    setQuickSettingsClosing(false);
    setQuickSettingsView('main');
  }, []);

  const openQuickSettings = useCallback(() => {
    if (quickSettingsExitTimerRef.current) {
      window.clearTimeout(quickSettingsExitTimerRef.current);
      quickSettingsExitTimerRef.current = null;
    }
    quickSettingsOpenRef.current = true;
    quickSettingsClosingRef.current = false;
    setQuickSettingsClosing(false);
    setQuickSettingsView('main');
    setQuickSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (!startMenuOpen && !notificationCenterOpen && !widgetsPanelOpen && !quickSettingsOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setStartMenuOpen(false);
        closeNotificationCenter();
        setWidgetsPanelOpen(false);
        closeQuickSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeNotificationCenter, closeQuickSettings, notificationCenterOpen, quickSettingsOpen, startMenuOpen, widgetsPanelOpen]);

  const visibleStartApps = useMemo(() => {
    const query = startQuery.trim().toLowerCase();
    if (!query) return apps;
    return apps.filter((app) => {
      const haystack = [
        app.id,
        app.label,
        app.title,
        app.kind,
        app.variant,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [apps, startQuery]);

  const startMenuFeed = useMemo(() => ([
    {
      id: 'social-unread-feed',
      appId: 'social',
      icon: MessageSquare,
      image: DESKTOP_APP_ICONS.social,
      title: lang === 'en' ? 'Social inbox' : '社交收件箱',
      meta: lang === 'en' ? 'Private chats and group updates' : '私聊和群聊更新',
      tone: 'pink',
    },
    {
      id: 'memory-review-feed',
      appId: 'memory_library',
      icon: LibraryBig,
      image: DESKTOP_APP_ICONS.memoryLibrary,
      title: lang === 'en' ? 'Memory review' : '记忆回顾',
      meta: lang === 'en' ? 'Review recent fragments' : '查看最近记忆片段',
      tone: 'blue',
    },
    {
      id: 'mcp-workbench-feed',
      appId: 'mcp_lab',
      icon: Wifi,
      image: DESKTOP_APP_ICONS.mcpLab,
      title: lang === 'en' ? 'MCP workbench' : 'MCP 实验室',
      meta: lang === 'en' ? 'Search, fetch and inspect runs' : '联网、抓取和任务报告',
      tone: 'mint',
    },
    {
      id: 'wallpaper-feed',
      appId: 'settings',
      icon: Wand2,
      image: DESKTOP_APP_ICONS.settings,
      title: lang === 'en' ? 'Desktop wallpaper' : '桌面壁纸',
      meta: lang === 'en' ? 'Change desktop appearance' : '调整桌面外观',
      tone: 'pearl',
    },
    {
      id: 'character-feed',
      appId: 'social',
      icon: UserPlus,
      image: DESKTOP_APP_ICONS.social,
      title: lang === 'en' ? 'Character contact list' : '角色联系人',
      meta: lang === 'en' ? 'Open social space' : '进入社交空间',
      tone: 'pink',
    },
    {
      id: 'memory-cleanup-feed',
      appId: 'memory_library',
      icon: Database,
      image: DESKTOP_APP_ICONS.memoryLibrary,
      title: lang === 'en' ? 'Memory library status' : '记忆库状态',
      meta: lang === 'en' ? 'Check storage and recall' : '检查存储和召回',
      tone: 'blue',
    },
    {
      id: 'settings-feed',
      appId: 'settings',
      icon: Settings,
      image: DESKTOP_APP_ICONS.settings,
      title: lang === 'en' ? 'App settings' : '应用设置',
      meta: lang === 'en' ? 'Profile, wallpaper and security' : '个人资料、壁纸和安全',
      tone: 'pearl',
    },
  ]), [lang]);

  const availableStartFeed = useMemo(() => (
    startMenuFeed.filter(item => apps.some(app => app.id === item.appId))
  ), [apps, startMenuFeed]);

  const visibleStartFeed = useMemo(() => {
    if (availableStartFeed.length === 0) return [];
    const pageSize = Math.min(4, availableStartFeed.length);
    return Array.from({ length: pageSize }, (_, index) => availableStartFeed[(startFeedOffset + index) % availableStartFeed.length]);
  }, [availableStartFeed, startFeedOffset]);

  const visibleNotifications = useMemo(() => (
    notificationItems.filter(item => !dismissedNotificationIds.has(item.id))
  ), [dismissedNotificationIds, notificationItems]);

  const widgetCategories = useMemo(() => ([
    { id: 'discover', label: lang === 'en' ? 'Discover' : '发现', icon: Sparkles },
    { id: 'life', label: lang === 'en' ? 'Life' : '生活', icon: CloudSun },
    { id: 'community', label: lang === 'en' ? 'Community' : '社区', icon: Music2 },
  ]), [lang]);

  const widgetNews = useMemo(() => ([
    {
      id: 'memory-map',
      category: 'discover',
      source: lang === 'en' ? 'Pocket Bulletin' : '口袋晨报',
      time: lang === 'en' ? '18 min' : '18 分钟',
      image: DESKTOP_WIDGET_IMAGES.memoryMap,
      title: lang === 'en'
        ? 'Tiny memory map starts trial, moments are folded into glowing blocks'
        : '记忆小地图试运行，角色把一天片段收进发光街区',
      likes: 128,
    },
    {
      id: 'greenhouse-care',
      category: 'life',
      source: lang === 'en' ? 'Cloud Garden' : '云栖花房',
      time: lang === 'en' ? '32 min' : '32 分钟',
      image: DESKTOP_WIDGET_IMAGES.greenhouseCare,
      title: lang === 'en'
        ? 'Shared plant care opens today, gentle chores become a soft routine'
        : '共享植物照护今日开放，温柔日程被排成一张小卡片',
      likes: 86,
    },
    {
      id: 'dessert-pop-up',
      category: 'community',
      source: lang === 'en' ? 'Pastel Market' : '软糖市集',
      time: lang === 'en' ? '1 h' : '1 小时',
      image: DESKTOP_WIDGET_IMAGES.dessertPopUp,
      title: lang === 'en'
        ? 'Pastel dessert pop-up opens, weekend flavors are picked by character votes'
        : '粉绿甜品快闪开张，周末口味由角色投票决定',
      likes: 112,
    },
    {
      id: 'rain-observatory',
      category: 'life',
      source: lang === 'en' ? 'Drizzle Desk' : '细雨观测台',
      time: lang === 'en' ? '9 min' : '9 分钟',
      image: DESKTOP_WIDGET_IMAGES.rainObservatory,
      title: lang === 'en'
        ? 'Tiny rain boxes begin tracking soft showers across the walkway'
        : '小雨观测台上线，透明雨量盒沿步道亮起',
      likes: 73,
    },
    {
      id: 'bento-station',
      category: 'life',
      source: lang === 'en' ? 'Morning Tray' : '晨间便当台',
      time: lang === 'en' ? '28 min' : '28 分钟',
      image: DESKTOP_WIDGET_IMAGES.bentoStation,
      title: lang === 'en'
        ? 'Morning bento station opens, lunch boxes flow toward rest corners'
        : '晨间便当台开放，粉绿餐盒按路线送到休息角',
      likes: 88,
    },
    {
      id: 'cloud-post',
      category: 'community',
      source: lang === 'en' ? 'Cloud Post' : '云朵邮局',
      time: lang === 'en' ? '37 min' : '37 分钟',
      image: DESKTOP_WIDGET_IMAGES.cloudPost,
      title: lang === 'en'
        ? 'Cloud post starts a trial run with parcels sliding through soft paths'
        : '云朵邮局试投递，轻飘包裹沿粉绿滑道出发',
      likes: 121,
    },
    {
      id: 'notice-plaza',
      category: 'community',
      source: lang === 'en' ? 'Starlamp Board' : '星灯布告台',
      time: lang === 'en' ? '52 min' : '52 分钟',
      image: DESKTOP_WIDGET_IMAGES.noticePlaza,
      title: lang === 'en'
        ? 'Starlamp notice boards update as blank cards glow along pale tracks'
        : '星灯布告台更新，通知卡片沿浅色轨道亮起',
      likes: 79,
    },
    {
      id: 'laundry-station',
      category: 'life',
      source: lang === 'en' ? 'Mini Laundry' : '迷你洗衣站',
      time: lang === 'en' ? '1 h' : '1 小时',
      image: DESKTOP_WIDGET_IMAGES.laundryStation,
      title: lang === 'en'
        ? 'Mini laundry station opens reservations with baskets in soft rows'
        : '迷你洗衣站开始预约，衣物篮按时段排成色块',
      likes: 91,
    },
    {
      id: 'storage-cart',
      category: 'community',
      source: lang === 'en' ? 'Tidy Cart' : '夜间收纳车',
      time: lang === 'en' ? '1 h' : '1 小时',
      image: DESKTOP_WIDGET_IMAGES.storageCart,
      title: lang === 'en'
        ? 'Night storage cart starts rounds, sorting boxes follow quiet markers'
        : '夜间收纳车巡回，小物件沿柔光路标归位',
      likes: 83,
    },
  ]), [lang]);

  const filteredWidgetNews = useMemo(() => {
    return widgetsCategory === 'discover'
      ? widgetNews
      : widgetNews.filter(item => item.category === widgetsCategory || item.category === 'discover');
  }, [widgetNews, widgetsCategory]);

  useEffect(() => {
    if (!widgetsPanelOpen || filteredWidgetNews.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setWidgetsNewsOffset((current) => (current + 1) % filteredWidgetNews.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [filteredWidgetNews.length, widgetsPanelOpen]);

  const visibleWidgetNews = useMemo(() => {
    if (filteredWidgetNews.length === 0) return [];
    const pageSize = Math.min(3, filteredWidgetNews.length);
    return Array.from({ length: pageSize }, (_, index) => (
      filteredWidgetNews[(widgetsNewsOffset + index) % filteredWidgetNews.length]
    )).filter(Boolean);
  }, [filteredWidgetNews, widgetsNewsOffset]);

  const visibleWidgetNewsSignature = useMemo(() => (
    visibleWidgetNews.map(item => item.id).join('|')
  ), [visibleWidgetNews]);

  useEffect(() => {
    setWidgetNewsMotion((currentMotion) => {
      const currentSignature = currentMotion.current.map(item => item.id).join('|');
      if (currentSignature === visibleWidgetNewsSignature) return currentMotion;
      if (!widgetsPanelOpen || currentMotion.current.length === 0 || visibleWidgetNews.length === 0) {
        return {
          current: visibleWidgetNews,
          previous: [],
          phaseKey: currentMotion.phaseKey + 1,
          isTransitioning: false,
        };
      }
      return {
        current: visibleWidgetNews,
        previous: currentMotion.current,
        phaseKey: currentMotion.phaseKey + 1,
        isTransitioning: true,
      };
    });
  }, [visibleWidgetNews, visibleWidgetNewsSignature, widgetsPanelOpen]);

  useEffect(() => {
    if (!widgetNewsMotion.isTransitioning) return undefined;
    const timer = window.setTimeout(() => {
      setWidgetNewsMotion((currentMotion) => {
        if (currentMotion.phaseKey !== widgetNewsMotion.phaseKey) return currentMotion;
        return {
          ...currentMotion,
          previous: [],
          isTransitioning: false,
        };
      });
    }, 560);
    return () => window.clearTimeout(timer);
  }, [widgetNewsMotion.isTransitioning, widgetNewsMotion.phaseKey]);

  const renderedWidgetNews = widgetNewsMotion.current.length > 0
    ? widgetNewsMotion.current
    : visibleWidgetNews;
  const exitingWidgetNews = widgetNewsMotion.previous;

  const unreadNotificationCount = Number(notificationBadgeCount) || 0;
  const todayDate = useMemo(() => new Date(), [dateTime.date]);
  const selectedLunarInfo = useMemo(() => (
    getDesktopLunarInfo(selectedCalendarDate, lang)
  ), [lang, selectedCalendarDate]);
  const calendarDays = useMemo(() => (
    buildDesktopCalendarDays(calendarMonth, selectedCalendarDate, todayDate, lang)
  ), [calendarMonth, lang, selectedCalendarDate, todayDate]);
  const weekLabels = lang === 'en'
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['一', '二', '三', '四', '五', '六', '日'];
  const primaryNotifications = visibleNotifications.slice(0, 3);
  const hiddenNotificationCount = Math.max(0, visibleNotifications.length - primaryNotifications.length);
  const hasPomodoroProgress = pomodoroSecondsLeft > 0 && pomodoroSecondsLeft < pomodoroMinutes * 60;
  const pomodoroDisplay = pomodoroRunning || hasPomodoroProgress
    ? formatPomodoroTime(pomodoroSecondsLeft)
    : `${pomodoroMinutes} ${lang === 'en' ? 'min' : '分钟'}`;
  const systemBatteryPercent = 75;
  const desktopBrightnessOverlayStyle = {
    '--desktop-brightness-dim': Math.min(0.62, Math.max(0, (100 - brightnessLevel) * 0.0062)),
    '--desktop-brightness-boost': 0,
    '--desktop-brightness-filter': 1,
  };
  const wifiNetworks = useMemo(() => ([
    {
      id: 'koi-diner',
      name: lang === 'en' ? 'Koi Diner Guest' : '锦鲤餐馆 Guest',
      meta: lang === 'en' ? 'Commercial street restaurant anchor' : '商业街餐馆锚点',
      secured: true,
      strength: 4,
    },
    {
      id: 'blue-cafe',
      name: lang === 'en' ? 'Blue Cafe WLAN' : '蓝湾咖啡 WLAN',
      meta: lang === 'en' ? 'Cafe terrace anchor' : '咖啡店露台锚点',
      secured: true,
      strength: 4,
    },
    {
      id: 'rose-mart',
      name: lang === 'en' ? 'Rose Mart 24H' : '玫瑰便利店 24H',
      meta: lang === 'en' ? 'Convenience store counter' : '便利店柜台',
      secured: true,
      strength: 3,
    },
    {
      id: 'clocktower-plaza',
      name: lang === 'en' ? 'Clocktower Plaza' : '钟塔广场 WLAN',
      meta: lang === 'en' ? 'Central plaza anchor' : '中心广场锚点',
      secured: true,
      strength: 3,
    },
    {
      id: 'night-bookshop',
      name: lang === 'en' ? 'Night Bookshop 5G' : '夜灯书店 5G',
      meta: lang === 'en' ? 'Bookshop reading corner' : '书店阅读角',
      secured: true,
      strength: 2,
    },
  ]), [lang]);
  const connectedWifi = useMemo(
    () => wifiNetworks.find((network) => network.id === wifiConnectedId) || null,
    [wifiConnectedId, wifiNetworks]
  );
  const handleOpenWifiPanel = useCallback(() => {
    setQuickSettingsView('wifi');
    setWifiPanelSelectedId(wifiConnectedId || wifiNetworks[0]?.id || null);
    setWifiPasswordError('');
  }, [wifiConnectedId, wifiNetworks]);
  const handleToggleWifi = useCallback(() => {
    setWifiEnabled((current) => {
      const next = !current;
      if (!next) {
        if (wifiConnectTimerRef.current) {
          window.clearTimeout(wifiConnectTimerRef.current);
          wifiConnectTimerRef.current = null;
        }
        setWifiConnectingId(null);
        setWifiConnectedId(null);
        setWifiPasswordDraft('');
        setWifiPasswordError('');
      }
      return next;
    });
  }, []);
  const handleSelectWifiNetwork = useCallback((networkId) => {
    if (!wifiEnabled) return;
    setWifiPanelSelectedId(networkId);
    setWifiPasswordDraft('');
    setWifiPasswordError('');
  }, [wifiEnabled]);
  const handleCancelWifiNetwork = useCallback(() => {
    setWifiPanelSelectedId(wifiConnectedId || null);
    setWifiPasswordDraft('');
    setWifiPasswordError('');
  }, [wifiConnectedId]);
  const handleConnectWifiNetwork = useCallback((network) => {
    if (!wifiEnabled || !network || wifiConnectingId) return;
    if (network.secured && wifiPasswordDraft.trim().length < 4) {
      setWifiPasswordError(lang === 'en' ? 'Enter at least 4 characters.' : '请输入至少 4 位密码。');
      return;
    }
    setWifiPasswordError('');
    setWifiConnectingId(network.id);
    setWifiConnectedId(null);
    if (wifiConnectTimerRef.current) window.clearTimeout(wifiConnectTimerRef.current);
    wifiConnectTimerRef.current = window.setTimeout(() => {
      setWifiConnectingId((current) => (current === network.id ? null : current));
      setWifiConnectedId(network.id);
      setWifiPanelSelectedId(network.id);
      setWifiPasswordDraft('');
      wifiConnectTimerRef.current = null;
    }, 1650);
  }, [lang, wifiConnectingId, wifiEnabled, wifiPasswordDraft]);
  const quickSettingsTiles = [
    {
      id: 'wifi',
      label: wifiEnabled ? (connectedWifi?.name || 'WLAN') : 'WLAN',
      icon: Wifi,
      active: wifiEnabled,
      onToggle: handleToggleWifi,
      onOpenOptions: handleOpenWifiPanel,
      hasArrow: true,
      className: 'desktop-quick-settings__tile--wifi',
    },
    {
      id: 'bluetooth',
      label: lang === 'en' ? 'Bluetooth' : '蓝牙',
      icon: Bluetooth,
      active: bluetoothEnabled,
      onToggle: () => setBluetoothEnabled((current) => !current),
      hasArrow: true,
    },
    {
      id: 'studio',
      label: lang === 'en' ? 'Studio effects' : '工作室效果',
      icon: Sparkles,
      active: studioEffectsEnabled,
      onToggle: () => setStudioEffectsEnabled((current) => !current),
      hasArrow: true,
    },
    {
      id: 'airplane',
      label: lang === 'en' ? 'Airplane mode' : '飞行模式',
      icon: Plane,
      active: airplaneModeEnabled,
      onToggle: () => setAirplaneModeEnabled((current) => !current),
    },
    {
      id: 'accessibility',
      label: lang === 'en' ? 'Accessibility' : '辅助功能',
      icon: Accessibility,
      active: accessibilityEnabled,
      onToggle: () => setAccessibilityEnabled((current) => !current),
      hasArrow: true,
    },
    {
      id: 'battery-saver',
      label: lang === 'en' ? 'Battery saver' : '节能模式',
      icon: BatteryCharging,
      active: powerSaverEnabled,
      onToggle: () => setPowerSaverEnabled((current) => !current),
    },
  ];

  const closeStartMenu = useCallback(() => {
    setStartMenuOpen(false);
  }, []);

  const handleOpenDesktop = useCallback(() => {
    closeStartMenu();
    closeNotificationCenter();
    setWidgetsPanelOpen(false);
    closeQuickSettings();
    onOpenDesktop();
  }, [closeNotificationCenter, closeQuickSettings, closeStartMenu, onOpenDesktop]);

  const handleOpenStartApp = useCallback((event, app) => {
    closeStartMenu();
    closeNotificationCenter();
    setWidgetsPanelOpen(false);
    closeQuickSettings();
    app.onOpen?.(event);
  }, [closeNotificationCenter, closeQuickSettings, closeStartMenu]);

  const handleOpenFeedItem = useCallback((event, item) => {
    const targetApp = apps.find(app => app.id === item.appId);
    if (targetApp) handleOpenStartApp(event, targetApp);
  }, [apps, handleOpenStartApp]);

  const handleOpenSettingsApp = useCallback((event) => {
    const targetApp = apps.find(app => app.id === 'settings');
    closeQuickSettings();
    if (targetApp) {
      handleOpenStartApp(event, targetApp);
    }
  }, [apps, closeQuickSettings, handleOpenStartApp]);

  const readQuickSliderPointerValue = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }, []);

  const handleBrightnessPointerDown = useCallback((event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setBrightnessLevel(readQuickSliderPointerValue(event));
  }, [readQuickSliderPointerValue]);

  const handleBrightnessPointerMove = useCallback((event) => {
    if ((event.buttons ?? 0) !== 1) return;
    event.preventDefault();
    setBrightnessLevel(readQuickSliderPointerValue(event));
  }, [readQuickSliderPointerValue]);

  const handleBrightnessKeyDown = useCallback((event) => {
    const keySteps = {
      Home: -100,
      End: 100,
      ArrowLeft: -5,
      ArrowDown: -5,
      ArrowRight: 5,
      ArrowUp: 5,
      PageDown: -10,
      PageUp: 10,
    };
    if (!(event.key in keySteps)) return;
    event.preventDefault();
    setBrightnessLevel((current) => {
      const next = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 100
          : current + keySteps[event.key];
      return Math.max(0, Math.min(100, next));
    });
  }, []);

  const handleVolumePointerDown = useCallback((event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSystemVolume(readQuickSliderPointerValue(event));
  }, [readQuickSliderPointerValue]);

  const handleVolumePointerMove = useCallback((event) => {
    if ((event.buttons ?? 0) !== 1) return;
    event.preventDefault();
    setSystemVolume(readQuickSliderPointerValue(event));
  }, [readQuickSliderPointerValue]);

  const handleVolumeKeyDown = useCallback((event) => {
    const keySteps = {
      Home: -100,
      End: 100,
      ArrowLeft: -5,
      ArrowDown: -5,
      ArrowRight: 5,
      ArrowUp: 5,
      PageDown: -10,
      PageUp: 10,
    };
    if (!(event.key in keySteps)) return;
    event.preventDefault();
    setSystemVolume((current) => {
      const next = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 100
          : current + keySteps[event.key];
      return Math.max(0, Math.min(100, next));
    });
  }, []);

  const handleShowAllApps = useCallback(() => {
    setStartQuery('');
  }, []);

  const handleRefreshFeed = useCallback(() => {
    setStartFeedOffset((current) => (current + 1) % Math.max(1, availableStartFeed.length));
  }, [availableStartFeed.length]);

  const handleToggleStartMenu = useCallback(() => {
    closeNotificationCenter();
    setWidgetsPanelOpen(false);
    closeQuickSettings();
    setStartMenuOpen((current) => !current);
  }, [closeNotificationCenter, closeQuickSettings]);

  const handleOpenSearch = useCallback(() => {
    closeNotificationCenter();
    setWidgetsPanelOpen(false);
    closeQuickSettings();
    setStartMenuOpen(true);
  }, [closeNotificationCenter, closeQuickSettings]);

  const handleToggleNotifications = useCallback(() => {
    setStartMenuOpen(false);
    setWidgetsPanelOpen(false);
    closeQuickSettings();
    if (notificationCenterOpen && !notificationCenterClosing) {
      closeNotificationCenter();
    } else {
      openNotificationCenter();
    }
  }, [closeNotificationCenter, closeQuickSettings, notificationCenterClosing, notificationCenterOpen, openNotificationCenter]);

  const handleSelectCalendarDate = useCallback((date) => {
    setSelectedCalendarDate(date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, []);

  const handleShiftCalendarMonth = useCallback((offset) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }, []);

  const handleAdjustPomodoroMinutes = useCallback((delta) => {
    setPomodoroRunning(false);
    setPomodoroMinutes((current) => {
      const next = Math.min(120, Math.max(5, current + delta));
      setPomodoroSecondsLeft(next * 60);
      return next;
    });
  }, []);

  const handleTogglePomodoro = useCallback(() => {
    setPomodoroSecondsLeft((current) => current > 0 ? current : pomodoroMinutes * 60);
    setPomodoroRunning((current) => !current);
  }, [pomodoroMinutes]);

  const handleToggleWidgets = useCallback(() => {
    setStartMenuOpen(false);
    closeNotificationCenter();
    closeQuickSettings();
    setWidgetsPanelOpen((current) => !current);
  }, [closeNotificationCenter, closeQuickSettings]);

  const handleToggleQuickSettings = useCallback(() => {
    setStartMenuOpen(false);
    closeNotificationCenter();
    setWidgetsPanelOpen(false);
    if (quickSettingsOpen && !quickSettingsClosing) {
      closeQuickSettings();
    } else {
      openQuickSettings();
    }
  }, [closeNotificationCenter, closeQuickSettings, openQuickSettings, quickSettingsClosing, quickSettingsOpen]);

  const handleOpenNotification = useCallback((event, item) => {
    closeNotificationCenter();
    closeQuickSettings();
    item.onOpen?.(event);
  }, [closeNotificationCenter, closeQuickSettings]);

  const handleOpenToastNotification = useCallback((event, item) => {
    onDismissToast?.(item.id);
    closeNotificationCenter();
    closeQuickSettings();
    item.onOpen?.(event);
  }, [closeNotificationCenter, closeQuickSettings, onDismissToast]);

  const handleDismissToastNotification = useCallback((event, itemId) => {
    event.preventDefault();
    event.stopPropagation();
    onDismissToast?.(itemId);
  }, [onDismissToast]);

  const handleDismissNotification = useCallback((event, itemId) => {
    event.preventDefault();
    event.stopPropagation();
    setDismissedNotificationIds((current) => {
      const next = new Set(current);
      next.add(itemId);
      return next;
    });
  }, []);

  const handleClearNotifications = useCallback(() => {
    setDismissedNotificationIds(new Set(notificationItems.map(item => item.id)));
  }, [notificationItems]);

  const { time, date } = dateTime;
  const renderWidgetNewsLayer = (items, layerClassName, layerKey) => (
    <div key={layerKey} className={`desktop-news-layer ${layerClassName}`}>
      {items[0] && (
        <article className="desktop-featured-news" style={{ '--desktop-news-card-index': 0 }}>
          <img src={items[0].image} alt="" draggable="false" />
          <div>
            <small>{items[0].source} · {items[0].time}</small>
            <h3>{items[0].title}</h3>
            <span>♡ {items[0].likes}</span>
          </div>
        </article>
      )}

      <div className="desktop-news-grid">
        {items.slice(1).map((item, index) => (
          <article
            key={`${layerKey}-${item.id}`}
            className="desktop-news-card"
            style={{ '--desktop-news-card-index': index + 1 }}
          >
            <img src={item.image} alt="" draggable="false" />
            <div>
              <small>{item.source} · {item.time}</small>
              <h4>{item.title}</h4>
              <span>♡ {item.likes}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );

  const notificationCenterVisible = notificationCenterOpen || notificationCenterClosing;
  const quickSettingsVisible = quickSettingsOpen || quickSettingsClosing;

  return (
    <footer className={`desktop-taskbar ${startMenuOpen ? 'is-start-open' : ''} ${notificationCenterOpen ? 'is-notification-open' : ''} ${widgetsPanelOpen ? 'is-widgets-open' : ''} ${quickSettingsOpen ? 'is-quick-settings-open' : ''}`} aria-label={lang === 'en' ? 'Taskbar' : '任务栏'}>
      {createPortal(
        <div
          className="desktop-brightness-overlay"
          style={desktopBrightnessOverlayStyle}
          aria-hidden="true"
        />,
        document.body
      )}

      {(notificationCenterVisible || widgetsPanelOpen) && (
        <button
          type="button"
          className="desktop-start-menu-backdrop"
          onClick={() => { closeStartMenu(); closeNotificationCenter(); setWidgetsPanelOpen(false); }}
          aria-label={lang === 'en' ? 'Close desktop panels' : '关闭桌面面板'}
        />
      )}

      {widgetsPanelOpen && createPortal((
        <section className="desktop-widgets-panel" aria-label={lang === 'en' ? 'Widgets' : '小组件'}>
          <div className="desktop-widgets-panel__top">
            <div>
              <small>{date}</small>
              <h2>{lang === 'en' ? 'Good evening' : '晚上好'}</h2>
            </div>
            <div className="desktop-widgets-panel__tools" aria-label={lang === 'en' ? 'Widget controls' : '小组件控制'}>
              <button type="button" onClick={() => setWidgetsNewsOffset((current) => (current + 1) % Math.max(1, filteredWidgetNews.length))} aria-label={lang === 'en' ? 'Refresh news' : '刷新新闻'}>
                <RefreshCw size={18} />
              </button>
              <button type="button" onClick={handleOpenDesktop} aria-label={lang === 'en' ? 'Close widgets' : '关闭小组件'}>
                <X size={19} />
              </button>
            </div>
          </div>

          <div className="desktop-widgets-panel__body">
            <aside className="desktop-widgets-rail">
              <div className="desktop-widgets-section-title">
                <span>{lang === 'en' ? 'Widgets' : '小组件'}</span>
              </div>

              <div
                className={`desktop-weather-card desktop-weather-card--${desktopWeather.preset}`}
                style={{ '--desktop-weather-bg': `url("${desktopWeather.background}")` }}
              >
                <img className="desktop-weather-card__bg" src={desktopWeather.background} alt="" aria-hidden="true" />
                <span className="desktop-weather-card__city"><MapPinned size={16} /> {lang === 'en' ? 'Starbay' : '星湾区'}</span>
                <span className="desktop-weather-card__main"><DesktopWeatherIcon size={48} /> <b>{desktopWeather.temp}</b><sup>°C</sup></span>
                <span>{desktopWeather.summary}</span>
              </div>

              <div className="desktop-note-widget">
                <div className="desktop-widget-card-head">
                  <BookOpen size={17} />
                  <strong>{lang === 'en' ? 'Today Notes' : '今日便签'}</strong>
                </div>
                <p>{lang === 'en' ? 'Keep the soft map story at the top today.' : '今天优先保留记忆小地图的柔和故事。'}</p>
                <p>{lang === 'en' ? 'Refresh once to rotate the feature card.' : '点一次刷新可以轮换主新闻卡。'}</p>
              </div>
            </aside>

            <section className="desktop-widgets-news">
              <nav className="desktop-widgets-tabs" aria-label={lang === 'en' ? 'News categories' : '新闻分类'}>
                {widgetCategories.map((item) => {
                  const TabIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={widgetsCategory === item.id ? 'is-active' : ''}
                      onClick={() => {
                        setWidgetsCategory(item.id);
                        setWidgetsNewsOffset(0);
                      }}
                    >
                      <TabIcon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className={`desktop-news-stack ${widgetNewsMotion.isTransitioning ? 'is-transitioning' : ''}`}>
                {exitingWidgetNews.length > 0 && renderWidgetNewsLayer(
                  exitingWidgetNews,
                  'desktop-news-layer--exiting',
                  `desktop-news-exiting-${widgetNewsMotion.phaseKey}`
                )}
                {renderWidgetNewsLayer(
                  renderedWidgetNews,
                  'desktop-news-layer--current',
                  `desktop-news-current-${widgetNewsMotion.phaseKey}`
                )}
              </div>
            </section>
          </div>
        </section>
      ), document.body)}

      {startMenuOpen && createPortal((
        <>
        <button
          type="button"
          className="desktop-start-menu-backdrop"
          onClick={() => { closeStartMenu(); closeNotificationCenter(); setWidgetsPanelOpen(false); }}
          aria-label={lang === 'en' ? 'Close desktop panels' : '关闭桌面面板'}
        />
        <div className={`desktop-start-menu-shell ${startSidePanelHidden ? 'is-side-hidden' : ''}`}>
          <section className="desktop-start-menu" aria-label={lang === 'en' ? 'Start menu' : '开始菜单'}>
            <label className="desktop-start-menu__search">
              <Search size={18} />
              <input
                autoFocus
                value={startQuery}
                onChange={(event) => setStartQuery(event.target.value)}
                placeholder={lang === 'en' ? 'Search apps, settings and files' : '搜索应用、设置和文档'}
              />
            </label>

            <div className="desktop-start-menu__header">
              <span>{lang === 'en' ? 'Pinned' : '已固定'}</span>
              <button type="button" onClick={handleShowAllApps}>{lang === 'en' ? 'All apps >' : '全部显示 >'}</button>
            </div>

            <div className="desktop-start-menu__apps">
              {visibleStartApps.map((app) => {
                const Icon = app.icon || Folder;
                return (
                  <button
                    key={`start-${app.id}`}
                    type="button"
                    className={`desktop-start-menu__app ${app.active ? 'is-active' : ''}`}
                    onClick={(event) => handleOpenStartApp(event, app)}
                    title={app.title || app.label}
                    style={app.accent ? { '--desktop-app-accent': app.accent } : undefined}
                  >
                    <span className={`desktop-start-menu__app-icon ${app.iconImage ? 'desktop-start-menu__app-icon--image' : ''}`}>
                      {app.iconImage
                        ? <img src={app.iconImage} alt="" draggable="false" />
                        : <Icon size={23} strokeWidth={2} />}
                    </span>
                    <span className="desktop-start-menu__app-label">{app.label}</span>
                    {app.badge ? <span className="desktop-start-menu__app-badge">{app.badge}</span> : null}
                  </button>
                );
              })}
              {visibleStartApps.length === 0 && (
                <div className="desktop-start-menu__empty">
                  {lang === 'en' ? 'No matching apps' : '没有匹配的应用'}
                </div>
              )}
            </div>

            <div className="desktop-start-menu__recommend">
              <div className="desktop-start-menu__header desktop-start-menu__header--recommend">
                <span>{lang === 'en' ? 'Hot now' : '今日热搜'}</span>
                <button type="button" onClick={handleRefreshFeed}>{lang === 'en' ? 'Refresh >' : '换一批 >'}</button>
              </div>
              <div className="desktop-start-menu__recommend-grid">
                {visibleStartFeed.map((item) => {
                  const FeedIcon = item.icon;
                  return (
                  <button
                    key={`feed-${item.id}`}
                    type="button"
                    className={`desktop-start-menu__recommend-item desktop-start-menu__recommend-item--${item.tone}`}
                    onClick={(event) => handleOpenFeedItem(event, item)}
                  >
                    <span className="desktop-start-menu__recommend-icon">
                      {item.image
                        ? <img src={item.image} alt="" draggable="false" />
                        : <FeedIcon size={17} strokeWidth={2.2} />}
                    </span>
                    <span>{item.title}</span>
                    <small>{item.meta}</small>
                  </button>
                  );
                })}
              </div>
            </div>

            <div className="desktop-start-menu__footer">
              <span className="desktop-start-menu__user">
                <span className="desktop-start-menu__avatar" aria-hidden="true" />
                <span>{userLabel}</span>
              </span>
              <span className="desktop-start-menu__footer-actions">
                {startSidePanelHidden && (
                  <button type="button" className="desktop-start-menu__restore-panel" onClick={() => setStartSidePanelHidden(false)}>
                    {lang === 'en' ? 'Show devices' : '显示移动设备'}
                  </button>
                )}
                <button type="button" className="desktop-start-menu__power" onClick={handleOpenDesktop} aria-label={lang === 'en' ? 'Power' : '电源'}>⏻</button>
              </span>
            </div>
          </section>

          {!startSidePanelHidden && (
          <aside className="desktop-start-side-panel" aria-label={lang === 'en' ? 'Mobile devices' : '移动设备'}>
            <div className="desktop-start-side-panel__content">
              <div className="desktop-start-side-panel__art" aria-hidden="true">
                <img
                  className="desktop-start-side-panel__device-art"
                  src="/assets/ui/desktop/start-device-panel.png?v=manual-recut-20260706"
                  alt=""
                  draggable="false"
                />
              </div>
              <div className="desktop-start-side-panel__copy">
                <span>{lang === 'en' ? 'Access mobile devices here' : '在此处访问移动设备'}</span>
                <small>
                  {startDeviceMode === 'android'
                      ? (lang === 'en' ? 'Android mode: messages and recent activity' : 'Android 模式：消息和最近活动')
                      : (lang === 'en' ? 'iPhone mode: calls and recent activity' : 'iPhone 模式：通话和最近活动')}
                </small>
              </div>
              <div className="desktop-start-side-panel__buttons">
                <button type="button" className={startDeviceMode === 'android' ? 'is-active' : ''} onClick={() => { setStartDeviceMode('android'); setStartSidePanelHidden(false); }}>Android</button>
                <button type="button" className={startDeviceMode === 'iphone' ? 'is-active' : ''} onClick={() => { setStartDeviceMode('iphone'); setStartSidePanelHidden(false); }}>iPhone</button>
              </div>
              <button type="button" className="desktop-start-side-panel__hide" onClick={() => setStartSidePanelHidden((current) => !current)}>
                {startSidePanelHidden ? (lang === 'en' ? 'Show this panel' : '显示此窗格') : (lang === 'en' ? 'Hide this panel' : '隐藏此窗格')}
              </button>
            </div>
          </aside>
          )}
        </div>
        </>
      ), document.body)}

      {notificationCenterVisible && createPortal((
        <>
          <button
            type="button"
            className="desktop-start-menu-backdrop desktop-calendar-panel-backdrop"
            onClick={() => { closeNotificationCenter(); setWidgetsPanelOpen(false); }}
            aria-label={lang === 'en' ? 'Close notification calendar' : '关闭通知日历'}
          />
          <section
            ref={(node) => { notificationCenterPanelMountedRef.current = Boolean(node); }}
            className={`desktop-notification-center ${quietModeEnabled ? 'is-quiet' : ''} ${notificationCenterClosing ? 'is-closing' : ''}`}
            aria-label={lang === 'en' ? 'Notification calendar' : '通知和日历'}
          >
            <section className="desktop-notification-center__card" aria-label={lang === 'en' ? 'Notifications' : '通知'}>
              <header className="desktop-notification-center__head">
                <h2>{lang === 'en' ? 'Notifications' : '通知'}</h2>
                <div className="desktop-notification-center__head-actions">
                  <button
                    type="button"
                    className={`desktop-notification-center__quiet ${quietModeEnabled ? 'is-active' : ''}`}
                    onClick={() => setQuietModeEnabled((current) => !current)}
                    aria-label={quietModeEnabled ? (lang === 'en' ? 'Disable do not disturb' : '关闭勿扰') : (lang === 'en' ? 'Enable do not disturb' : '开启勿扰')}
                    title={quietModeEnabled ? (lang === 'en' ? 'Do not disturb on' : '勿扰已开启') : (lang === 'en' ? 'Do not disturb' : '勿扰')}
                  >
                    <BellOff size={18} />
                  </button>
                  {visibleNotifications.length > 0 && (
                    <button type="button" onClick={handleClearNotifications}>
                      {lang === 'en' ? 'Clear all' : '全部清除'}
                    </button>
                  )}
                </div>
              </header>

              <section
                className={`desktop-notification-center__notifications ${primaryNotifications.length === 0 ? 'is-empty' : ''}`}
                aria-label={lang === 'en' ? 'Notifications' : '通知列表'}
              >
                {primaryNotifications.length > 0 ? (
                  <>
                    <div className="desktop-notification-center__source">
                      <img src={DESKTOP_APP_ICONS.social} alt="" draggable="false" />
                      <span>{lang === 'en' ? 'ChatPulse' : 'ChatPulse'}</span>
                    </div>
                    <div className="desktop-notification-center__list">
                      {primaryNotifications.map((item) => {
                    const NotificationIcon = item.icon || Bell;
                    const hasNotificationImage = Boolean(item.avatar || item.image);
                    return (
                      <article key={item.id} className={`desktop-notification-item desktop-notification-item--${item.tone || 'default'}`}>
                        <button
                          type="button"
                          className="desktop-notification-item__main"
                          onClick={(event) => handleOpenNotification(event, item)}
                        >
                          <span className="desktop-notification-item__time">{dateTime.time}</span>
                          <span className="desktop-notification-item__chevron" aria-hidden="true"><ChevronDown size={17} /></span>
                          <span className={`desktop-notification-item__icon ${hasNotificationImage ? 'desktop-notification-item__icon--image' : ''}`} aria-hidden="true">
                            {item.avatar ? (
                              <AvatarWithFrame
                                size={38}
                                frame={item.avatarFrame}
                                src={item.avatar}
                                fallbackSrc={item.fallbackAvatar || defaultAvatarUrl(item.title)}
                                alt=""
                              />
                            ) : item.image ? (
                              <img src={item.image} alt="" draggable="false" />
                            ) : (
                              <NotificationIcon size={18} strokeWidth={2.1} />
                            )}
                          </span>
                          <span className="desktop-notification-item__body">
                            <strong>{item.title}</strong>
                            <small>{item.meta}</small>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="desktop-notification-item__dismiss"
                          onClick={(event) => handleDismissNotification(event, item.id)}
                          aria-label={lang === 'en' ? 'Dismiss notification' : '忽略通知'}
                        >
                          <X size={14} />
                        </button>
                      </article>
                    );
                  })}
                      {hiddenNotificationCount > 0 && (
                        <button type="button" className="desktop-notification-center__more" onClick={() => closeNotificationCenter()}>
                          +{hiddenNotificationCount} {lang === 'en' ? 'notifications' : '个通知'}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="desktop-notification-center__empty">
                    {lang === 'en' ? 'No new notifications' : '没有新通知'}
                  </div>
                )}
              </section>
            </section>

            <section className="desktop-calendar-panel__card" aria-label={formatDesktopMonthTitle(calendarMonth, lang)}>
              <section className="desktop-calendar-panel__date-summary">
                <div>
                  <strong>{formatDesktopPanelDate(selectedCalendarDate, lang)}</strong>
                  <span>{lang === 'en' ? selectedLunarInfo.day : `${selectedLunarInfo.month}${selectedLunarInfo.day}`}</span>
                </div>
                <button type="button" onClick={() => handleSelectCalendarDate(todayDate)} aria-label={lang === 'en' ? 'Back to today' : '回到今天'}>
                  <ChevronDown size={19} />
                </button>
              </section>

              <section className="desktop-calendar-panel__month" aria-label={formatDesktopMonthTitle(calendarMonth, lang)}>
                <header className="desktop-calendar-panel__month-head">
                  <strong>{formatDesktopMonthTitle(calendarMonth, lang)}</strong>
                  <span>
                    <button type="button" onClick={() => handleShiftCalendarMonth(-1)} aria-label={lang === 'en' ? 'Previous month' : '上个月'}>
                      <ChevronUp size={17} />
                    </button>
                    <button type="button" onClick={() => handleShiftCalendarMonth(1)} aria-label={lang === 'en' ? 'Next month' : '下个月'}>
                      <ChevronDown size={17} />
                    </button>
                  </span>
                </header>
                <div className="desktop-calendar-panel__weekdays">
                  {weekLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
                </div>
                <div className="desktop-calendar-panel__grid">
                  {calendarDays.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      className={[
                        day.isCurrentMonth ? '' : 'is-outside',
                        day.isToday ? 'is-today' : '',
                        day.isSelected ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleSelectCalendarDate(day.date)}
                      aria-label={`${day.day} ${day.lunar}`}
                    >
                      <b>{day.day}</b>
                      <small>{day.lunar}</small>
                    </button>
                  ))}
                </div>
              </section>

              <footer className="desktop-pomodoro">
                <button
                  type="button"
                  onClick={() => handleAdjustPomodoroMinutes(-5)}
                  disabled={pomodoroMinutes <= 5 && !pomodoroRunning}
                  aria-label={lang === 'en' ? 'Decrease focus duration' : '减少专注时长'}
                >
                  <Minus size={18} />
                </button>
                <strong>{pomodoroDisplay}</strong>
                <button
                  type="button"
                  onClick={() => handleAdjustPomodoroMinutes(5)}
                  disabled={pomodoroMinutes >= 120 && !pomodoroRunning}
                  aria-label={lang === 'en' ? 'Increase focus duration' : '增加专注时长'}
                >
                  <Plus size={18} />
                </button>
                <button type="button" className="desktop-pomodoro__start" onClick={handleTogglePomodoro}>
                  {pomodoroRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  <span>{pomodoroRunning ? (lang === 'en' ? 'Pause focus' : '暂停专注') : (lang === 'en' ? 'Start focus' : '开始专注')}</span>
                </button>
              </footer>
            </section>
          </section>
        </>
      ), document.body)}

      {quickSettingsVisible && createPortal((
        <>
          <button
            type="button"
            className="desktop-start-menu-backdrop desktop-quick-settings-backdrop"
            onClick={() => {
              closeQuickSettings();
            }}
            aria-label={lang === 'en' ? 'Close quick settings' : '关闭快捷设置'}
          />
          <section
            ref={(node) => { quickSettingsPanelMountedRef.current = Boolean(node); }}
            className={`desktop-quick-settings-panel ${quickSettingsView === 'wifi' ? 'is-wifi-view' : ''} ${quickSettingsClosing ? 'is-closing' : ''}`}
            aria-label={quickSettingsView === 'wifi' ? 'WLAN' : (lang === 'en' ? 'Quick settings' : '快捷设置')}
          >
            {quickSettingsView === 'wifi' ? (
              <>
                <header className="desktop-wifi-panel__header">
                  <button type="button" onClick={() => setQuickSettingsView('main')} aria-label={lang === 'en' ? 'Back to quick settings' : '返回快捷设置'}>
                    <ArrowLeft size={21} strokeWidth={1.9} />
                  </button>
                  <strong>WLAN</strong>
                  <button
                    type="button"
                    className={`desktop-wifi-panel__toggle ${wifiEnabled ? 'is-on' : ''}`}
                    onClick={handleToggleWifi}
                    aria-pressed={wifiEnabled}
                    aria-label={wifiEnabled ? (lang === 'en' ? 'Turn off WLAN' : '关闭 WLAN') : (lang === 'en' ? 'Turn on WLAN' : '开启 WLAN')}
                  >
                    <span />
                  </button>
                </header>

                <div className="desktop-wifi-panel__list">
                  {wifiEnabled ? wifiNetworks.map((network) => {
                    const selected = wifiPanelSelectedId === network.id;
                    const connecting = wifiConnectingId === network.id;
                    const connected = wifiConnectedId === network.id;
                    const showPassword = selected && !connected;
                    const statusText = connecting
                      ? (lang === 'en' ? 'Connecting' : '正在连接')
                      : connected
                        ? (lang === 'en' ? 'Connected, secured' : '已连接，安全')
                        : network.meta;
                    return (
                      <article
                        key={network.id}
                        className={`desktop-wifi-network ${selected ? 'is-selected' : ''} ${connecting ? 'is-connecting' : ''} ${connected ? 'is-connected' : ''}`}
                      >
                        <button
                          type="button"
                          className="desktop-wifi-network__summary"
                          onClick={() => handleSelectWifiNetwork(network.id)}
                        >
                          <span className={`desktop-wifi-network__signal strength-${network.strength}`} aria-hidden="true">
                            <Wifi size={24} strokeWidth={2} />
                            {network.secured && <Lock size={11} strokeWidth={2.5} />}
                          </span>
                          <span className="desktop-wifi-network__copy">
                            <strong>{network.name}</strong>
                            <small>{statusText}</small>
                          </span>
                          {connecting ? (
                            <LoaderCircle className="desktop-wifi-network__spinner" size={17} strokeWidth={2.2} aria-hidden="true" />
                          ) : connected ? (
                            <Check className="desktop-wifi-network__check" size={18} strokeWidth={2.2} aria-hidden="true" />
                          ) : null}
                        </button>

                        {showPassword && (
                          <div className="desktop-wifi-network__details">
                            <label>
                              <span>{lang === 'en' ? 'Enter password' : '输入密码'}</span>
                              <input
                                type="password"
                                value={wifiPasswordDraft}
                                onChange={(event) => {
                                  setWifiPasswordDraft(event.target.value);
                                  if (wifiPasswordError) setWifiPasswordError('');
                                }}
                                disabled={connecting}
                                aria-label={lang === 'en' ? `Password for ${network.name}` : `${network.name} 密码`}
                              />
                            </label>
                            {wifiPasswordError && <p>{wifiPasswordError}</p>}
                            <div className="desktop-wifi-network__actions">
                              <button
                                type="button"
                                className="primary"
                                onClick={() => handleConnectWifiNetwork(network)}
                                disabled={connecting || (network.secured && wifiPasswordDraft.trim().length < 4)}
                              >
                                {connecting ? (lang === 'en' ? 'Connecting...' : '连接中...') : (lang === 'en' ? 'Connect' : '连接')}
                              </button>
                              <button type="button" onClick={handleCancelWifiNetwork} disabled={connecting}>
                                {lang === 'en' ? 'Cancel' : '取消'}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  }) : (
                    <div className="desktop-wifi-panel__empty">
                      <Wifi size={25} />
                      <span>{lang === 'en' ? 'WLAN is off' : 'WLAN 已关闭'}</span>
                    </div>
                  )}
                </div>

                <footer className="desktop-wifi-panel__footer">
                  <button type="button" onClick={handleOpenSettingsApp}>
                    {lang === 'en' ? 'More WLAN settings' : '更多 WLAN 设置'}
                  </button>
                  <span aria-hidden="true">
                    <RefreshCw size={18} />
                    <Settings size={18} />
                  </span>
                </footer>
              </>
            ) : (
              <>
                <div className="desktop-quick-settings-panel__tiles">
                  {quickSettingsTiles.map((item) => {
                    const TileIcon = item.icon;
                    const label = item.active
                      ? (lang === 'en' ? `Turn off ${item.label}` : `关闭${item.label}`)
                      : (lang === 'en' ? `Turn on ${item.label}` : `开启${item.label}`);
                    return (
                      <article
                        key={item.id}
                        className={`desktop-quick-settings-tile ${item.active ? 'is-active' : ''} ${item.className || ''}`}
                      >
                        <div className="desktop-quick-settings-tile__control">
                          <button
                            type="button"
                            className="desktop-quick-settings-tile__main"
                            onClick={item.onToggle}
                            aria-pressed={item.active}
                            aria-label={label}
                          >
                            <TileIcon size={21} strokeWidth={2.1} />
                          </button>
                          {item.hasArrow && (
                            <button
                              type="button"
                              className="desktop-quick-settings-tile__arrow"
                              onClick={item.onOpenOptions || item.onToggle}
                              aria-label={lang === 'en' ? `Open ${item.label} options` : `打开${item.label}选项`}
                            >
                              <ChevronRight size={18} strokeWidth={2.2} />
                            </button>
                          )}
                        </div>
                        <span>{item.label}</span>
                      </article>
                    );
                  })}
                  <span className="desktop-quick-settings-panel__page-indicator" aria-hidden="true">
                    <i /><i /><i /><b />
                  </span>
                </div>

                <div className="desktop-quick-settings-panel__sliders">
                  <label className="desktop-quick-settings-slider desktop-quick-settings-slider--brightness">
                    <SunMedium size={24} strokeWidth={1.9} />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={brightnessLevel}
                      onChange={(event) => setBrightnessLevel(Number(event.target.value))}
                      onPointerDown={handleBrightnessPointerDown}
                      onPointerMove={handleBrightnessPointerMove}
                      onKeyDown={handleBrightnessKeyDown}
                      aria-label={lang === 'en' ? 'Brightness' : '亮度'}
                    />
                  </label>
                  <label className="desktop-quick-settings-slider desktop-quick-settings-slider--volume">
                    {systemVolume > 0 ? <Volume2 size={24} strokeWidth={1.9} /> : <VolumeX size={24} strokeWidth={1.9} />}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={systemVolume}
                      onChange={(event) => setSystemVolume(Number(event.target.value))}
                      onPointerDown={handleVolumePointerDown}
                      onPointerMove={handleVolumePointerMove}
                      onKeyDown={handleVolumeKeyDown}
                      aria-label={lang === 'en' ? 'Volume' : '音量'}
                    />
                  </label>
                </div>

                <footer className="desktop-quick-settings-panel__footer">
                  <span><Battery size={23} strokeWidth={1.8} />{systemBatteryPercent}%</span>
                  <button type="button" onClick={handleOpenSettingsApp} aria-label={lang === 'en' ? 'Open settings' : '打开设置'}>
                    <Settings size={23} strokeWidth={1.8} />
                  </button>
                </footer>
              </>
            )}
          </section>
        </>
      ), document.body)}

      {toastItems.length > 0 && (
        <div className="desktop-notification-toast-stack" aria-live="polite" aria-atomic="false">
          {toastItems.map((item) => {
            const ToastIcon = item.icon || Bell;
            const hasToastImage = Boolean(item.avatar || item.image);
            return (
              <article key={`toast-${item.id}`} className={`desktop-notification-toast desktop-notification-toast--${item.tone || 'default'}`} role="status">
                <button
                  type="button"
                  className="desktop-notification-toast__main"
                  onClick={(event) => handleOpenToastNotification(event, item)}
                >
                  <span className={`desktop-notification-toast__avatar ${hasToastImage ? 'desktop-notification-toast__avatar--image' : ''}`} aria-hidden="true">
                    {item.avatar ? (
                      <AvatarWithFrame
                        size={72}
                        frame={item.avatarFrame}
                        src={item.avatar}
                        fallbackSrc={item.fallbackAvatar || defaultAvatarUrl(item.title)}
                        alt=""
                      />
                    ) : item.image ? (
                      <img src={item.image} alt="" draggable="false" />
                    ) : (
                      <ToastIcon size={28} strokeWidth={1.9} />
                    )}
                  </span>
                  <span className="desktop-notification-toast__copy">
                    <span className="desktop-notification-toast__source">
                      <img src={item.appIcon || DESKTOP_APP_ICONS.social} alt="" draggable="false" />
                      <span>{item.appName || (lang === 'en' ? 'ChatPulse' : 'ChatPulse')}</span>
                    </span>
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="desktop-notification-toast__close"
                  onClick={(event) => handleDismissToastNotification(event, item.id)}
                  aria-label={lang === 'en' ? 'Close notification' : '关闭通知'}
                >
                  <X size={20} strokeWidth={1.8} />
                </button>
              </article>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="desktop-taskbar__widget"
        style={{ '--desktop-taskbar-weather-bg': `url("${desktopWeather.background}")` }}
        onClick={handleToggleWidgets}
        aria-label={lang === 'en' ? 'Widgets' : '小组件'}
        aria-expanded={widgetsPanelOpen}
      >
        <DesktopWeatherIcon size={25} />
        <span><b>{desktopWeather.temp}°C</b><small>{desktopWeather.taskbarLabel}</small></span>
      </button>

      <div className="desktop-taskbar__center">
        <button
          type="button"
          className="desktop-start-button"
          onClick={handleToggleStartMenu}
          aria-label={lang === 'en' ? 'Start' : '开始'}
          aria-expanded={startMenuOpen}
        >
          <span aria-hidden="true"><i /><i /><i /><i /></span>
        </button>
        <button
          type="button"
          className="desktop-search"
          onClick={handleOpenSearch}
          aria-label={lang === 'en' ? 'Search' : '搜索'}
        >
          <Search size={20} />
          <span>{lang === 'en' ? 'Search apps, characters, world' : '搜索 ChatPulse'}</span>
        </button>
        {browserWindows.map(windowItem => {
          const actionLabel = windowItem.minimized || !windowItem.active
            ? (lang === 'en' ? `Restore ${windowItem.title}` : `还原${windowItem.title}`)
            : (lang === 'en' ? `Minimize ${windowItem.title}` : `最小化${windowItem.title}`);
          return (
            <button
              key={windowItem.id}
              type="button"
              className={`desktop-taskbar-browser ${windowItem.minimized ? 'is-minimized' : ''} ${windowItem.active ? 'is-active' : ''} ${windowItem.recalled ? 'is-recalled' : ''}`}
              onClick={() => onToggleBrowserWindow?.(windowItem.id)}
              title={actionLabel}
              aria-label={actionLabel}
            >
              <span className="desktop-taskbar-browser__icon" aria-hidden="true">
                <img src={TASKBAR_APP_ICONS.browser} alt="" draggable="false" />
              </span>
              {windowItem.tabsCount > 1 ? <span className="desktop-taskbar-browser__tabs">{windowItem.tabsCount}</span> : null}
            </button>
          );
        })}
        {pinnedApps.length > 0 && (
          <div className="desktop-taskbar__pinned" aria-label={lang === 'en' ? 'Pinned apps' : '固定应用'}>
            {pinnedApps.map(app => (
              <DesktopAppButton
                key={`pinned-${app.id}`}
                app={app}
                pinned
                onOpen={(event) => handleOpenStartApp(event, app)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="desktop-taskbar__tray" aria-label={lang === 'en' ? 'System tray' : '系统托盘'}>
        <ChevronUp size={18} />
        <button
          type="button"
          className="desktop-taskbar__bell"
          onClick={handleToggleNotifications}
          aria-label={lang === 'en' ? 'Notifications' : '通知'}
          aria-expanded={notificationCenterOpen}
        >
          <Bell size={18} />
          {unreadNotificationCount > 0 && <span>{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>}
        </button>
        <button
          type="button"
          className="desktop-taskbar__language"
          onClick={onToggleLanguage}
          title={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
          aria-label={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
        >
          {lang === 'en' ? '英' : '中'}
        </button>
        <button
          type="button"
          className="desktop-taskbar__quick-settings"
          onClick={handleToggleQuickSettings}
          aria-label={lang === 'en' ? 'Open quick settings' : '打开快捷设置'}
          aria-expanded={quickSettingsOpen}
        >
          <Wifi size={18} />
          {systemVolume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span className="desktop-taskbar__battery"><Battery size={19} />{systemBatteryPercent}%</span>
        </button>
        <button
          type="button"
          className="desktop-taskbar__clock"
          onClick={handleToggleNotifications}
          aria-label={lang === 'en' ? 'Open calendar and notifications' : '打开通知和日历'}
          aria-expanded={notificationCenterOpen}
        >
          <b>{time}</b><small>{date}</small>
        </button>
      </div>
    </footer>
  );
}

export default DesktopTaskbar;
