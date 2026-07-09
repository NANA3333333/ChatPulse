import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AvatarWithFrame from '../components/AvatarWithFrame';
import Live2DDesktopWallpaper from '../components/Live2DDesktopWallpaper';
import DesktopAppButton from './DesktopAppButton';
import { defaultAvatarUrl } from '../utils/avatar';
import {
  Accessibility,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Battery,
  BatteryCharging,
  Bell,
  BellOff,
  Bluetooth,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  ChevronUp,
  CirclePlus,
  Cloud,
  CloudSun,
  Copy,
  Database,
  Download,
  Eye,
  Eraser,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Heading1,
  Home,
  Italic,
  LayoutGrid,
  LibraryBig,
  Link,
  ListPlus,
  List,
  LoaderCircle,
  Lock,
  MapPinned,
  Maximize2,
  Merge,
  MessageSquare,
  Minus,
  Minimize2,
  MonitorCog,
  MoreHorizontal,
  Music2,
  Paintbrush,
  PanelTopOpen,
  Pause,
  Pencil,
  Plane,
  Play,
  Plus,
  Recycle,
  RefreshCw,
  Save,
  Search,
  Scissors,
  Settings,
  Share2,
  Sparkles,
  Square,
  Star,
  Strikethrough,
  Store,
  SunMedium,
  Table,
  Trash2,
  Type,
  Undo2,
  UsersRound,
  UserPlus,
  Volume2,
  VolumeX,
  Wand2,
  Wifi,
  X,
} from 'lucide-react';
import {
  DESKTOP_ALIGN_TO_GRID_STORAGE_KEY,
  DESKTOP_APP_ICONS,
  DESKTOP_AUTO_ARRANGE_STORAGE_KEY,
  DESKTOP_ICON_SIZE_STORAGE_KEY,
  DESKTOP_ICONS_VISIBLE_STORAGE_KEY,
  DESKTOP_RECYCLE_BIN_ID,
  DESKTOP_TASKBAR_HEIGHT,
  DESKTOP_WALLPAPER_IMAGE_URLS,
  DESKTOP_WIDGET_IMAGES,
  TASKBAR_APP_ICONS,
  buildDesktopCalendarDays,
  clampDesktopIconPosition,
  createDesktopItemId,
  findOpenDesktopIconPosition,
  formatDesktopDateTime,
  formatDesktopMonthTitle,
  formatDesktopPanelDate,
  formatPomodoroTime,
  getCurrentDesktopWeatherEvent,
  getDefaultDesktopIconPosition,
  getDesktopGridMetrics,
  getDesktopLunarInfo,
  getDesktopWeatherVisual,
  loadCreatedDesktopItems,
  loadDesktopIconLayout,
  loadDesktopStoredBoolean,
  loadDesktopStoredChoice,
  loadRecycleBinItems,
  normalizeCreatedDesktopItem,
  normalizeDesktopIconPosition,
  normalizeDesktopWallpaper,
  normalizeRecycleBinItem,
  saveCreatedDesktopItems,
  saveDesktopIconLayout,
  saveDesktopStoredPreference,
  saveRecycleBinItems,
} from './desktopUtils';

const API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;


const DESKTOP_FOLDER_WINDOW_MIN_WIDTH = 640;
const DESKTOP_FOLDER_WINDOW_MIN_HEIGHT = 420;

function getDefaultFolderWindowGeometry(index = 0) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 780;
  const width = Math.min(1180, Math.max(DESKTOP_FOLDER_WINDOW_MIN_WIDTH, Math.round(viewportWidth * 0.76)));
  const height = Math.min(720, Math.max(DESKTOP_FOLDER_WINDOW_MIN_HEIGHT, Math.round(viewportHeight * 0.7)));
  const offset = Math.min(96, Math.max(0, index) * 28);
  return clampFolderWindowGeometry({
    x: 48 + offset,
    y: 28 + offset,
    width,
    height,
  });
}

function clampFolderWindowGeometry(geometry = {}) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 780;
  const maxWidth = Math.max(DESKTOP_FOLDER_WINDOW_MIN_WIDTH, viewportWidth - 28);
  const maxHeight = Math.max(DESKTOP_FOLDER_WINDOW_MIN_HEIGHT, viewportHeight - DESKTOP_TASKBAR_HEIGHT - 24);
  const width = Math.min(maxWidth, Math.max(DESKTOP_FOLDER_WINDOW_MIN_WIDTH, Math.round(Number(geometry.width) || DESKTOP_FOLDER_WINDOW_MIN_WIDTH)));
  const height = Math.min(maxHeight, Math.max(DESKTOP_FOLDER_WINDOW_MIN_HEIGHT, Math.round(Number(geometry.height) || DESKTOP_FOLDER_WINDOW_MIN_HEIGHT)));
  const x = Math.min(Math.max(12, Math.round(Number(geometry.x) || 12)), Math.max(12, viewportWidth - width - 12));
  const y = Math.min(Math.max(8, Math.round(Number(geometry.y) || 8)), Math.max(8, viewportHeight - DESKTOP_TASKBAR_HEIGHT - height - 8));
  return { x, y, width, height };
}

function resizeFolderWindowGeometry(startGeometry, deltaX, deltaY, direction = 'se') {
  const start = clampFolderWindowGeometry(startGeometry);
  const dir = String(direction || 'se');
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (dir.includes('e')) right += deltaX;
  if (dir.includes('w')) left += deltaX;
  if (dir.includes('s')) bottom += deltaY;
  if (dir.includes('n')) top += deltaY;
  if (right - left < DESKTOP_FOLDER_WINDOW_MIN_WIDTH) {
    if (dir.includes('w')) left = right - DESKTOP_FOLDER_WINDOW_MIN_WIDTH;
    else right = left + DESKTOP_FOLDER_WINDOW_MIN_WIDTH;
  }
  if (bottom - top < DESKTOP_FOLDER_WINDOW_MIN_HEIGHT) {
    if (dir.includes('n')) top = bottom - DESKTOP_FOLDER_WINDOW_MIN_HEIGHT;
    else bottom = top + DESKTOP_FOLDER_WINDOW_MIN_HEIGHT;
  }
  return clampFolderWindowGeometry({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}

function DesktopFolderWindow({
  item,
  apps,
  lang,
  active = false,
  geometry,
  maximized = false,
  minimized = false,
  minimizedIndex = 0,
  zIndex = 82,
  onActivate,
  onClose,
  onGeometryChange,
  onMaximizeToggle,
  onMinimize,
  onRestore,
  onMoveAppToDesktop,
  onAddAppToFolder,
  onOpenApp,
  isDropTarget = false,
}) {
  const windowRef = useRef(null);
  const moveRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(true);
  const [viewMode, setViewMode] = useState('details');
  const [activeLocation, setActiveLocation] = useState('folder');
  const [locationHistory, setLocationHistory] = useState(['folder']);
  const [locationHistoryIndex, setLocationHistoryIndex] = useState(0);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [activityMessage, setActivityMessage] = useState('');
  const [openMenu, setOpenMenu] = useState('');
  const [folderClipboard, setFolderClipboard] = useState(null);
  const [detailsPaneOpen, setDetailsPaneOpen] = useState(false);
  const folderAppIds = useMemo(() => new Set(item.folderAppIds || []), [item.folderAppIds]);
  const storedApps = useMemo(() => apps.filter(app => folderAppIds.has(app.id)), [apps, folderAppIds]);
  const availableApps = useMemo(() => apps.filter(app => !folderAppIds.has(app.id)), [apps, folderAppIds]);
  const navigationItems = [
    { id: 'folder', label: lang === 'en' ? 'Home folder' : '主文件夹', icon: Home, count: storedApps.length },
    { id: 'gallery', label: lang === 'en' ? 'Gallery' : '图库', icon: PanelTopOpen },
    { id: 'cloud', label: lang === 'en' ? 'NA - Personal' : 'NA - 个人', icon: Cloud },
    { id: 'divider-a', divider: true },
    { id: 'desktop', label: lang === 'en' ? 'Desktop' : '桌面', icon: MonitorCog },
    { id: 'downloads', label: lang === 'en' ? 'Downloads' : '下载', icon: Download },
    { id: 'documents', label: lang === 'en' ? 'Documents' : '文档', icon: FileText },
    { id: 'pictures', label: lang === 'en' ? 'Pictures' : '图片', icon: PanelTopOpen },
    { id: 'music', label: lang === 'en' ? 'Music' : '音乐', icon: Music2 },
    { id: 'videos', label: lang === 'en' ? 'Videos' : '视频', icon: Volume2 },
    { id: 'divider-b', divider: true },
    { id: 'this-pc', label: lang === 'en' ? 'This PC' : '此电脑', icon: Home },
  ];
  const activeNavItem = navigationItems.find(navItem => navItem.id === activeLocation) || navigationItems[0];
  const currentLocationApps = activeLocation === 'folder' ? storedApps : [];
  const modifiedLabel = useMemo(() => {
    const value = Number(item.updatedAt || item.createdAt || Date.now());
    return new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [item.createdAt, item.updatedAt, lang]);
  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return currentLocationApps
      .filter((app) => String(app.label || '').toLocaleLowerCase().includes(query))
      .sort((a, b) => (
        sortAscending
          ? String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'zh-Hans-CN')
          : String(b.label).localeCompare(String(a.label), lang === 'en' ? 'en' : 'zh-Hans-CN')
      ));
  }, [currentLocationApps, lang, searchQuery, sortAscending]);
  const selectedApp = filteredApps.find(app => app.id === selectedAppId)
    || storedApps.find(app => app.id === selectedAppId)
    || null;
  const canGoBack = locationHistoryIndex > 0;
  const canGoForward = locationHistoryIndex < locationHistory.length - 1;
  const baseStatusText = lang === 'en'
    ? `${filteredApps.length} item${filteredApps.length === 1 ? '' : 's'}`
    : `${filteredApps.length} 个项目`;
  const statusText = activityMessage || baseStatusText;

  useEffect(() => {
    if (selectedAppId && !filteredApps.some(app => app.id === selectedAppId)) {
      setSelectedAppId('');
    }
  }, [filteredApps, selectedAppId]);

  const pushLocation = useCallback((locationId) => {
    const target = navigationItems.find(navItem => navItem.id === locationId && !navItem.divider);
    if (!target) return;
    setActiveLocation(locationId);
    setSearchQuery('');
    setSelectedAppId('');
    setOpenMenu('');
    setActivityMessage(target.label);
    setLocationHistory((current) => {
      const next = current.slice(0, locationHistoryIndex + 1);
      if (next[next.length - 1] !== locationId) next.push(locationId);
      return next;
    });
    setLocationHistoryIndex((current) => {
      const next = locationHistory.slice(0, current + 1);
      return next[next.length - 1] === locationId ? current : current + 1;
    });
  }, [locationHistory, locationHistoryIndex, navigationItems]);

  const goToHistory = useCallback((direction) => {
    const nextIndex = locationHistoryIndex + direction;
    if (nextIndex < 0 || nextIndex >= locationHistory.length) {
      setActivityMessage(lang === 'en' ? 'No more folder history' : '没有更多文件夹历史记录');
      return;
    }
    const nextLocation = locationHistory[nextIndex] || 'folder';
    setLocationHistoryIndex(nextIndex);
    setActiveLocation(nextLocation);
    setSearchQuery('');
    setSelectedAppId('');
    setOpenMenu('');
    const navItem = navigationItems.find(item => item.id === nextLocation);
    setActivityMessage(navItem?.label || '');
  }, [lang, locationHistory, locationHistoryIndex, navigationItems]);

  const getWindowDropPoint = useCallback(() => {
    const rect = windowRef.current?.getBoundingClientRect?.();
    if (rect) {
      return {
        x: Math.min(rect.right + 28, window.innerWidth - 40),
        y: Math.min(rect.top + 112, window.innerHeight - 80),
      };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }, []);

  const copyFolderTextToClipboard = useCallback(async (text) => {
    const value = String(text || '');
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_error) {
      window.prompt(lang === 'en' ? 'Copy text:' : '复制文本：', value);
      return false;
    }
  }, [lang]);

  const requireSelectedApp = useCallback(() => {
    if (selectedApp) return selectedApp;
    setActivityMessage(lang === 'en' ? 'Select an item first' : '请先选择一个项目');
    return null;
  }, [lang, selectedApp]);

  const handleAddAppToFolder = useCallback((appId) => {
    const targetApp = apps.find(app => app.id === appId);
    if (!targetApp) return;
    const added = onAddAppToFolder?.(appId);
    setActiveLocation('folder');
    setSelectedAppId(appId);
    setOpenMenu('');
    setActivityMessage(
      added === false
        ? (lang === 'en' ? 'Could not add item' : '无法添加项目')
        : `${lang === 'en' ? 'Added' : '已添加'} ${targetApp.label}`
    );
  }, [apps, lang, onAddAppToFolder]);

  const handleOpenSelected = useCallback(() => {
    const target = requireSelectedApp();
    if (!target) return;
    setOpenMenu('');
    onOpenApp?.(target);
  }, [onOpenApp, requireSelectedApp]);

  const handleCutSelected = useCallback(() => {
    const target = requireSelectedApp();
    if (!target) return;
    setFolderClipboard({ mode: 'cut', appId: target.id });
    setActivityMessage(`${lang === 'en' ? 'Cut' : '已剪切'} ${target.label}`);
  }, [lang, requireSelectedApp]);

  const handleCopySelected = useCallback(async () => {
    const target = requireSelectedApp();
    if (!target) return;
    setFolderClipboard({ mode: 'copy', appId: target.id });
    await copyFolderTextToClipboard(`ChatPulse\\Desktop\\${item.label}\\${target.label}`);
    setActivityMessage(`${lang === 'en' ? 'Copied' : '已复制'} ${target.label}`);
  }, [copyFolderTextToClipboard, item.label, lang, requireSelectedApp]);

  const handlePaste = useCallback(() => {
    if (!folderClipboard?.appId) {
      setActivityMessage(lang === 'en' ? 'Nothing to paste' : '没有可粘贴的项目');
      return;
    }
    if (folderAppIds.has(folderClipboard.appId)) {
      setActivityMessage(lang === 'en' ? 'Item is already in this folder' : '项目已在此文件夹中');
      return;
    }
    handleAddAppToFolder(folderClipboard.appId);
  }, [folderAppIds, folderClipboard, handleAddAppToFolder, lang]);

  const handleRenameSelected = useCallback(() => {
    const target = requireSelectedApp();
    if (!target) return;
    setActivityMessage(lang === 'en' ? 'System app shortcuts keep their original names' : '系统应用快捷方式会保留原名称');
  }, [lang, requireSelectedApp]);

  const handleShareSelected = useCallback(async () => {
    const target = requireSelectedApp();
    if (!target) return;
    await copyFolderTextToClipboard(`${item.label}: ${target.label}`);
    setActivityMessage(lang === 'en' ? 'Share text copied' : '共享文本已复制');
  }, [copyFolderTextToClipboard, item.label, lang, requireSelectedApp]);

  const handleRemoveSelected = useCallback(() => {
    const target = requireSelectedApp();
    if (!target) return;
    onMoveAppToDesktop?.(target.id, getWindowDropPoint());
    setSelectedAppId('');
    setActivityMessage(`${lang === 'en' ? 'Moved to desktop' : '已移回桌面'} ${target.label}`);
  }, [getWindowDropPoint, lang, onMoveAppToDesktop, requireSelectedApp]);

  const handleRefreshFolder = useCallback(() => {
    setSearchQuery('');
    setOpenMenu('');
    setActivityMessage(lang === 'en' ? 'Folder refreshed' : '文件夹已刷新');
  }, [lang]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setOpenMenu('');
    setActivityMessage(lang === 'en' ? 'Search cleared' : '搜索已清除');
  }, [lang]);

  const safeGeometry = clampFolderWindowGeometry(geometry || getDefaultFolderWindowGeometry());

  const startWindowMove = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (maximized || event.target.closest('button, input, textarea, select, [data-window-no-drag="true"], .desktop-folder-window__menu')) return;
    event.preventDefault();
    onActivate?.();
    moveRef.current = {
      type: 'move',
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: clampFolderWindowGeometry(geometry || safeGeometry),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [geometry, maximized, onActivate, safeGeometry]);

  const startWindowResize = useCallback((event, direction = 'se') => {
    if (event.button !== undefined && event.button !== 0) return;
    if (maximized) return;
    event.preventDefault();
    event.stopPropagation();
    onActivate?.();
    moveRef.current = {
      type: 'resize',
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: clampFolderWindowGeometry(geometry || safeGeometry),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [geometry, maximized, onActivate, safeGeometry]);

  const handleWindowPointerMove = useCallback((event) => {
    const move = moveRef.current;
    if (!move) return;
    event.preventDefault();
    const deltaX = event.clientX - move.startX;
    const deltaY = event.clientY - move.startY;
    const nextGeometry = move.type === 'resize'
      ? resizeFolderWindowGeometry(move.startGeometry, deltaX, deltaY, move.direction)
      : clampFolderWindowGeometry({
          ...move.startGeometry,
          x: move.startGeometry.x + deltaX,
          y: move.startGeometry.y + deltaY,
        });
    onGeometryChange?.(nextGeometry);
  }, [onGeometryChange]);

  const stopWindowInteraction = useCallback((event) => {
    if (!moveRef.current) return;
    moveRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  useEffect(() => {
    const stopGlobalInteraction = () => {
      moveRef.current = null;
    };
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', stopGlobalInteraction);
    window.addEventListener('pointercancel', stopGlobalInteraction);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', stopGlobalInteraction);
      window.removeEventListener('pointercancel', stopGlobalInteraction);
    };
  }, [handleWindowPointerMove]);

  const windowStyle = maximized
    ? { zIndex }
    : {
        left: `${safeGeometry.x}px`,
        top: `${safeGeometry.y}px`,
        width: `${safeGeometry.width}px`,
        height: `${safeGeometry.height}px`,
        zIndex,
      };

  if (minimized) {
    return (
      <button
        type="button"
        className={`desktop-folder-window-minimized ${active ? 'is-active' : ''}`}
        style={{
          left: `${18 + (minimizedIndex * 14)}px`,
          zIndex,
        }}
        onClick={() => {
          onRestore?.();
          onActivate?.();
        }}
        aria-label={lang === 'en' ? `Restore ${item.label}` : `还原 ${item.label}`}
      >
        <Folder size={18} />
        <span>{item.label}</span>
        <Maximize2 size={15} />
      </button>
    );
  }

  return (
    <section
      ref={windowRef}
      className={[
        'desktop-item-window',
        'desktop-folder-window',
        `desktop-folder-window--${viewMode}`,
        active ? 'is-active' : '',
        maximized ? 'is-maximized' : '',
        isDropTarget ? 'is-drop-target' : '',
        detailsPaneOpen ? 'is-details-pane-open' : '',
      ].filter(Boolean).join(' ')}
      style={windowStyle}
      data-desktop-folder-window-id={item.id}
      aria-label={item.label}
      onPointerDown={(event) => {
        event.stopPropagation();
        onActivate?.();
        if (!event.target.closest('.desktop-folder-window__menu-anchor')) setOpenMenu('');
      }}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <header
        className="desktop-folder-window__chrome"
        onPointerDown={startWindowMove}
        onPointerMove={handleWindowPointerMove}
        onPointerUp={stopWindowInteraction}
        onPointerCancel={stopWindowInteraction}
      >
        <div className="desktop-folder-window__tabbar">
          <div className="desktop-folder-window__tab is-active" data-window-no-drag="true">
            <Folder size={16} />
            <span>{item.label}</span>
            <button type="button" onClick={onClose} aria-label={lang === 'en' ? 'Close tab' : '关闭标签页'}>
              <X size={14} />
            </button>
          </div>
          <button
            type="button"
            className="desktop-folder-window__new-tab"
            aria-label={lang === 'en' ? 'New tab' : '新建标签页'}
            onClick={() => setActivityMessage(lang === 'en' ? 'This folder is already open in the current tab' : '当前标签页已打开此文件夹')}
            data-window-no-drag="true"
          >
            <Plus size={18} />
          </button>
          <div className="desktop-folder-window__window-controls" data-window-no-drag="true">
            <button type="button" onClick={onMinimize} aria-label={lang === 'en' ? 'Minimize' : '最小化'}>
              <Minus size={15} />
            </button>
            <button
              type="button"
              onClick={onMaximizeToggle}
              aria-label={maximized ? (lang === 'en' ? 'Restore' : '还原') : (lang === 'en' ? 'Maximize' : '最大化')}
            >
              {maximized ? <Minimize2 size={14} /> : <Square size={13} />}
            </button>
            <button type="button" className="is-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : '关闭'}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="desktop-folder-window__address-row">
          <div className="desktop-folder-window__nav-controls">
            <button type="button" className={canGoBack ? '' : 'is-muted'} onClick={() => goToHistory(-1)} aria-label={lang === 'en' ? 'Back' : '后退'}><ArrowLeft size={18} /></button>
            <button type="button" className={canGoForward ? '' : 'is-muted'} onClick={() => goToHistory(1)} aria-label={lang === 'en' ? 'Forward' : '前进'}><ArrowRight size={18} /></button>
            <button type="button" onClick={() => pushLocation('desktop')} aria-label={lang === 'en' ? 'Up' : '向上'}><ChevronUp size={18} /></button>
            <button type="button" onClick={handleRefreshFolder} aria-label={lang === 'en' ? 'Refresh' : '刷新'}><RefreshCw size={17} /></button>
          </div>
          <div className="desktop-folder-window__breadcrumb" aria-label={lang === 'en' ? 'Address' : '地址'}>
            <MonitorCog size={18} />
            <button type="button" onClick={() => pushLocation('desktop')}>{lang === 'en' ? 'Desktop' : '桌面'}</button>
            <ArrowRight size={15} />
            <button type="button" className="is-current" onClick={() => pushLocation('folder')}>
              {activeLocation === 'folder' ? item.label : activeNavItem.label}
            </button>
          </div>
          <label className="desktop-folder-window__search">
            <Search size={18} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={lang === 'en' ? `Search ${activeLocation === 'folder' ? item.label : activeNavItem.label}` : `在 ${activeLocation === 'folder' ? item.label : activeNavItem.label} 中搜索`}
              aria-label={lang === 'en' ? 'Search folder' : '搜索文件夹'}
            />
          </label>
        </div>
        <div className="desktop-folder-window__commandbar">
          <div className="desktop-folder-window__menu-anchor">
            <button type="button" className="desktop-folder-window__command-primary" onClick={() => setOpenMenu((current) => current === 'new' ? '' : 'new')}>
              <CirclePlus size={18} />
              <span>{lang === 'en' ? 'New' : '新建'}</span>
            </button>
            {openMenu === 'new' && (
              <div className="desktop-folder-window__menu" role="menu">
                <span className="desktop-folder-window__menu-title">{lang === 'en' ? 'Add app' : '添加应用'}</span>
                {availableApps.slice(0, 8).map((app) => (
                  <button key={app.id} type="button" role="menuitem" onClick={() => handleAddAppToFolder(app.id)}>
                    {app.iconImage ? <img src={app.iconImage} alt="" draggable="false" /> : <FolderPlus size={17} />}
                    <span>{app.label}</span>
                  </button>
                ))}
                {availableApps.length === 0 && <span className="desktop-folder-window__menu-empty">{lang === 'en' ? 'No apps available' : '没有可添加的应用'}</span>}
              </div>
            )}
          </div>
          <span className="desktop-folder-window__command-separator" />
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleCutSelected} title={lang === 'en' ? 'Cut' : '剪切'} aria-label={lang === 'en' ? 'Cut' : '剪切'}>
            <Scissors size={17} />
          </button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleCopySelected} title={lang === 'en' ? 'Copy' : '复制'} aria-label={lang === 'en' ? 'Copy' : '复制'}>
            <Copy size={17} />
          </button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handlePaste} title={lang === 'en' ? 'Paste' : '粘贴'} aria-label={lang === 'en' ? 'Paste' : '粘贴'}>
            <ClipboardPaste size={17} />
          </button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleRenameSelected} title={lang === 'en' ? 'Rename' : '重命名'} aria-label={lang === 'en' ? 'Rename' : '重命名'}>
            <Pencil size={17} />
          </button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleShareSelected} title={lang === 'en' ? 'Share' : '共享'} aria-label={lang === 'en' ? 'Share' : '共享'}>
            <Share2 size={17} />
          </button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleRemoveSelected} title={lang === 'en' ? 'Remove from folder' : '从文件夹移除'} aria-label={lang === 'en' ? 'Remove from folder' : '从文件夹移除'}>
            <Trash2 size={17} />
          </button>
          <span className="desktop-folder-window__command-separator" />
          <div className="desktop-folder-window__menu-anchor">
            <button type="button" onClick={() => setOpenMenu((current) => current === 'sort' ? '' : 'sort')}>
              <ArrowDownUp size={17} />
              <span>{lang === 'en' ? 'Sort' : '排序'}</span>
            </button>
            {openMenu === 'sort' && (
              <div className="desktop-folder-window__menu" role="menu">
                <button type="button" role="menuitem" className={sortAscending ? 'is-active' : ''} onClick={() => { setSortAscending(true); setOpenMenu(''); setActivityMessage(lang === 'en' ? 'Sorted A to Z' : '已按名称升序排列'); }}>
                  <ArrowDownUp size={17} />
                  <span>{lang === 'en' ? 'Name A to Z' : '名称升序'}</span>
                </button>
                <button type="button" role="menuitem" className={!sortAscending ? 'is-active' : ''} onClick={() => { setSortAscending(false); setOpenMenu(''); setActivityMessage(lang === 'en' ? 'Sorted Z to A' : '已按名称降序排列'); }}>
                  <ArrowDownUp size={17} />
                  <span>{lang === 'en' ? 'Name Z to A' : '名称降序'}</span>
                </button>
              </div>
            )}
          </div>
          <div className="desktop-folder-window__menu-anchor">
            <button type="button" onClick={() => setOpenMenu((current) => current === 'view' ? '' : 'view')}>
              <LayoutGrid size={17} />
              <span>{lang === 'en' ? 'View' : '查看'}</span>
            </button>
            {openMenu === 'view' && (
              <div className="desktop-folder-window__menu" role="menu">
                <button type="button" role="menuitem" className={viewMode === 'details' ? 'is-active' : ''} onClick={() => { setViewMode('details'); setOpenMenu(''); }}>
                  <List size={17} />
                  <span>{lang === 'en' ? 'Details' : '详细信息'}</span>
                </button>
                <button type="button" role="menuitem" className={viewMode === 'icons' ? 'is-active' : ''} onClick={() => { setViewMode('icons'); setOpenMenu(''); }}>
                  <LayoutGrid size={17} />
                  <span>{lang === 'en' ? 'Icons' : '图标'}</span>
                </button>
              </div>
            )}
          </div>
          <div className="desktop-folder-window__menu-anchor">
            <button type="button" className="desktop-folder-window__icon-command" onClick={() => setOpenMenu((current) => current === 'more' ? '' : 'more')} aria-label={lang === 'en' ? 'More' : '更多'}>
              <MoreHorizontal size={18} />
            </button>
            {openMenu === 'more' && (
              <div className="desktop-folder-window__menu desktop-folder-window__menu--right" role="menu">
                <button type="button" role="menuitem" onClick={handleOpenSelected}>
                  <Folder size={17} />
                  <span>{lang === 'en' ? 'Open selected' : '打开所选项目'}</span>
                </button>
                <button type="button" role="menuitem" onClick={handleClearSearch}>
                  <Search size={17} />
                  <span>{lang === 'en' ? 'Clear search' : '清除搜索'}</span>
                </button>
                <button type="button" role="menuitem" onClick={handleRefreshFolder}>
                  <RefreshCw size={17} />
                  <span>{lang === 'en' ? 'Refresh' : '刷新'}</span>
                </button>
              </div>
            )}
          </div>
          <button type="button" className={`desktop-folder-window__details-toggle ${detailsPaneOpen ? 'is-active' : ''}`} onClick={() => setDetailsPaneOpen((current) => !current)}>
            <List size={17} />
            <span>{lang === 'en' ? 'Details' : '详细信息'}</span>
          </button>
        </div>
      </header>
      <div className="desktop-folder-window__content">
        <aside className="desktop-folder-window__sidebar">
          {navigationItems.map((navItem) => {
            if (navItem.divider) return <span key={navItem.id} className="desktop-folder-window__sidebar-divider" />;
            const NavIcon = navItem.icon;
            return (
              <button
                key={navItem.id}
                type="button"
                className={navItem.id === activeLocation ? 'is-active' : ''}
                onClick={() => pushLocation(navItem.id)}
              >
                <NavIcon size={18} />
                <span>{navItem.label}</span>
                {typeof navItem.count === 'number' && <small>{navItem.count}</small>}
              </button>
            );
          })}
        </aside>
        <section className="desktop-folder-window__main">
          {viewMode === 'details' && (
            <div className="desktop-folder-window__details-head" role="row">
              <button type="button" onClick={() => setSortAscending((current) => !current)}>{lang === 'en' ? 'Name' : '名称'}</button>
              <span>{lang === 'en' ? 'Date modified' : '修改日期'}</span>
              <span>{lang === 'en' ? 'Type' : '类型'}</span>
              <span>{lang === 'en' ? 'Size' : '大小'}</span>
            </div>
          )}
          <div className="desktop-folder-window__grid">
            {filteredApps.map(app => (
              <DesktopFolderAppTile
                key={app.id}
                app={app}
                lang={lang}
                viewMode={viewMode}
                selected={selectedAppId === app.id}
                modifiedLabel={modifiedLabel}
                onSelect={setSelectedAppId}
                onOpen={() => onOpenApp(app)}
                onMoveToDesktop={onMoveAppToDesktop}
              />
            ))}
            {filteredApps.length === 0 && (
              <div className="desktop-folder-window__empty">
                <span>{searchQuery ? (lang === 'en' ? 'No matching items.' : '没有匹配的项目。') : (lang === 'en' ? 'This folder is empty.' : '此文件夹为空。')}</span>
              </div>
            )}
          </div>
        </section>
        {detailsPaneOpen && (
          <aside className="desktop-folder-window__details-pane">
            <span className="desktop-folder-window__details-pane-icon">
              {selectedApp?.iconImage ? <img src={selectedApp.iconImage} alt="" draggable="false" /> : <Folder size={34} />}
            </span>
            <strong>{selectedApp?.label || (activeLocation === 'folder' ? item.label : activeNavItem.label)}</strong>
            <span>{selectedApp ? (lang === 'en' ? 'App shortcut' : '应用快捷方式') : (lang === 'en' ? 'Folder' : '文件夹')}</span>
            <small>{selectedApp ? modifiedLabel : baseStatusText}</small>
          </aside>
        )}
        <footer className="desktop-folder-window__status">{statusText}</footer>
      </div>
      {!maximized && ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((direction) => (
        <span
          key={direction}
          className={`desktop-folder-window__resize desktop-folder-window__resize--${direction}`}
          aria-hidden="true"
          onPointerDown={(event) => startWindowResize(event, direction)}
          onPointerMove={handleWindowPointerMove}
          onPointerUp={stopWindowInteraction}
          onPointerCancel={stopWindowInteraction}
        />
      ))}
    </section>
  );
}

function getRecycleBinEntryType(entry, lang) {
  return entry?.item?.kind === 'folder'
    ? (lang === 'en' ? 'File folder' : '文件夹')
    : (lang === 'en' ? 'Text document' : '文本文档');
}

function getRecycleBinEntrySize(entry, lang) {
  const item = entry?.item;
  if (!item) return lang === 'en' ? '0 KB' : '0 KB';
  const rawSize = item.kind === 'text'
    ? Math.max(1, Math.ceil(String(item.content || '').length / 1024))
    : Math.max(1, (item.folderAppIds || []).length || 1);
  return `${rawSize} KB`;
}

function getRecycleBinDateLabel(timestamp, lang) {
  const value = Number(timestamp) || Date.now();
  return new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DesktopRecycleBinWindow({
  entries,
  lang,
  active = false,
  geometry,
  maximized = false,
  minimized = false,
  zIndex = 84,
  onActivate,
  onClose,
  onGeometryChange,
  onMaximizeToggle,
  onMinimize,
  onRestore,
  onRestoreEntry,
  onDeleteEntry,
  onEmptyRecycleBin,
}) {
  const windowRef = useRef(null);
  const moveRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(true);
  const [viewMode, setViewMode] = useState('details');
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [activityMessage, setActivityMessage] = useState('');
  const [openMenu, setOpenMenu] = useState('');
  const [detailsPaneOpen, setDetailsPaneOpen] = useState(false);
  const recycleBinLabel = lang === 'en' ? 'Recycle Bin' : '回收站';
  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return [...entries]
      .filter(entry => String(entry.item?.label || '').toLocaleLowerCase().includes(query))
      .sort((a, b) => (
        sortAscending
          ? String(a.item?.label || '').localeCompare(String(b.item?.label || ''), lang === 'en' ? 'en' : 'zh-Hans-CN')
          : String(b.item?.label || '').localeCompare(String(a.item?.label || ''), lang === 'en' ? 'en' : 'zh-Hans-CN')
      ));
  }, [entries, lang, searchQuery, sortAscending]);
  const selectedEntry = filteredEntries.find(entry => entry.id === selectedEntryId)
    || entries.find(entry => entry.id === selectedEntryId)
    || null;
  const baseStatusText = lang === 'en'
    ? `${filteredEntries.length} item${filteredEntries.length === 1 ? '' : 's'}`
    : `${filteredEntries.length} 个项目`;
  const statusText = activityMessage || baseStatusText;

  useEffect(() => {
    if (selectedEntryId && !entries.some(entry => entry.id === selectedEntryId)) {
      setSelectedEntryId('');
    }
  }, [entries, selectedEntryId]);

  const requireSelectedEntry = useCallback(() => {
    if (selectedEntry) return selectedEntry;
    setActivityMessage(lang === 'en' ? 'Select an item first' : '请先选择一个项目');
    return null;
  }, [lang, selectedEntry]);

  const handleRestoreSelected = useCallback(() => {
    const target = requireSelectedEntry();
    if (!target) return;
    const restored = onRestoreEntry?.(target.id);
    if (restored === false) return;
    setSelectedEntryId('');
    setOpenMenu('');
    setActivityMessage(`${lang === 'en' ? 'Restored' : '已还原'} ${target.item.label}`);
  }, [lang, onRestoreEntry, requireSelectedEntry]);

  const handleDeleteSelected = useCallback(() => {
    const target = requireSelectedEntry();
    if (!target) return;
    const deleted = onDeleteEntry?.(target.id);
    if (deleted === false) return;
    setSelectedEntryId('');
    setOpenMenu('');
    setActivityMessage(`${lang === 'en' ? 'Permanently deleted' : '已永久删除'} ${target.item.label}`);
  }, [lang, onDeleteEntry, requireSelectedEntry]);

  const handleEmptyRecycleBin = useCallback(() => {
    if (!entries.length) {
      setActivityMessage(lang === 'en' ? 'Recycle Bin is already empty' : '回收站已经是空的');
      return;
    }
    const emptied = onEmptyRecycleBin?.();
    if (emptied !== false) {
      setSelectedEntryId('');
      setActivityMessage(lang === 'en' ? 'Recycle Bin emptied' : '已清空回收站');
    }
  }, [entries.length, lang, onEmptyRecycleBin]);

  const handleUnavailableCommand = useCallback(() => {
    setActivityMessage(lang === 'en' ? 'This command is not available in Recycle Bin' : '此命令在回收站中不可用');
  }, [lang]);

  const safeGeometry = clampFolderWindowGeometry(geometry || getDefaultFolderWindowGeometry());

  const startWindowMove = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (maximized || event.target.closest('button, input, textarea, select, [data-window-no-drag="true"], .desktop-folder-window__menu')) return;
    event.preventDefault();
    onActivate?.();
    moveRef.current = {
      type: 'move',
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: clampFolderWindowGeometry(geometry || safeGeometry),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [geometry, maximized, onActivate, safeGeometry]);

  const startWindowResize = useCallback((event, direction = 'se') => {
    if (event.button !== undefined && event.button !== 0) return;
    if (maximized) return;
    event.preventDefault();
    event.stopPropagation();
    onActivate?.();
    moveRef.current = {
      type: 'resize',
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: clampFolderWindowGeometry(geometry || safeGeometry),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [geometry, maximized, onActivate, safeGeometry]);

  const handleWindowPointerMove = useCallback((event) => {
    const move = moveRef.current;
    if (!move) return;
    event.preventDefault();
    const deltaX = event.clientX - move.startX;
    const deltaY = event.clientY - move.startY;
    const nextGeometry = move.type === 'resize'
      ? resizeFolderWindowGeometry(move.startGeometry, deltaX, deltaY, move.direction)
      : clampFolderWindowGeometry({
          ...move.startGeometry,
          x: move.startGeometry.x + deltaX,
          y: move.startGeometry.y + deltaY,
        });
    onGeometryChange?.(nextGeometry);
  }, [onGeometryChange]);

  const stopWindowInteraction = useCallback((event) => {
    if (!moveRef.current) return;
    moveRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  useEffect(() => {
    const stopGlobalInteraction = () => {
      moveRef.current = null;
    };
    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', stopGlobalInteraction);
    window.addEventListener('pointercancel', stopGlobalInteraction);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', stopGlobalInteraction);
      window.removeEventListener('pointercancel', stopGlobalInteraction);
    };
  }, [handleWindowPointerMove]);

  const windowStyle = maximized
    ? { zIndex }
    : {
        left: `${safeGeometry.x}px`,
        top: `${safeGeometry.y}px`,
        width: `${safeGeometry.width}px`,
        height: `${safeGeometry.height}px`,
        zIndex,
      };

  if (minimized) {
    return (
      <button
        type="button"
        className={`desktop-folder-window-minimized ${active ? 'is-active' : ''}`}
        style={{ left: '18px', zIndex }}
        onClick={() => {
          onRestore?.();
          onActivate?.();
        }}
        aria-label={lang === 'en' ? 'Restore Recycle Bin' : '还原回收站'}
      >
        <Recycle size={18} />
        <span>{recycleBinLabel}</span>
        <Maximize2 size={15} />
      </button>
    );
  }

  return (
    <section
      ref={windowRef}
      className={[
        'desktop-item-window',
        'desktop-folder-window',
        'desktop-recycle-bin-window',
        `desktop-folder-window--${viewMode}`,
        active ? 'is-active' : '',
        maximized ? 'is-maximized' : '',
        detailsPaneOpen ? 'is-details-pane-open' : '',
      ].filter(Boolean).join(' ')}
      style={windowStyle}
      data-desktop-recycle-bin-window="true"
      aria-label={recycleBinLabel}
      onPointerDown={(event) => {
        event.stopPropagation();
        onActivate?.();
        if (!event.target.closest('.desktop-folder-window__menu-anchor')) setOpenMenu('');
      }}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <header
        className="desktop-folder-window__chrome"
        onPointerDown={startWindowMove}
        onPointerMove={handleWindowPointerMove}
        onPointerUp={stopWindowInteraction}
        onPointerCancel={stopWindowInteraction}
      >
        <div className="desktop-folder-window__tabbar">
          <div className="desktop-folder-window__tab is-active" data-window-no-drag="true">
            <Recycle size={16} />
            <span>{recycleBinLabel}</span>
            <button type="button" onClick={onClose} aria-label={lang === 'en' ? 'Close tab' : '关闭标签页'}>
              <X size={14} />
            </button>
          </div>
          <button
            type="button"
            className="desktop-folder-window__new-tab"
            aria-label={lang === 'en' ? 'New tab' : '新建标签页'}
            onClick={() => setActivityMessage(lang === 'en' ? 'Recycle Bin is already open' : '回收站已打开')}
            data-window-no-drag="true"
          >
            <Plus size={18} />
          </button>
          <div className="desktop-folder-window__window-controls" data-window-no-drag="true">
            <button type="button" onClick={onMinimize} aria-label={lang === 'en' ? 'Minimize' : '最小化'}>
              <Minus size={15} />
            </button>
            <button
              type="button"
              onClick={onMaximizeToggle}
              aria-label={maximized ? (lang === 'en' ? 'Restore' : '还原') : (lang === 'en' ? 'Maximize' : '最大化')}
            >
              {maximized ? <Minimize2 size={14} /> : <Square size={13} />}
            </button>
            <button type="button" className="is-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : '关闭'}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="desktop-folder-window__address-row">
          <div className="desktop-folder-window__nav-controls">
            <button type="button" className="is-muted" onClick={() => setActivityMessage(lang === 'en' ? 'No more folder history' : '没有更多文件夹历史记录')} aria-label={lang === 'en' ? 'Back' : '后退'}><ArrowLeft size={18} /></button>
            <button type="button" className="is-muted" onClick={() => setActivityMessage(lang === 'en' ? 'No more folder history' : '没有更多文件夹历史记录')} aria-label={lang === 'en' ? 'Forward' : '前进'}><ArrowRight size={18} /></button>
            <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Desktop' : '桌面')} aria-label={lang === 'en' ? 'Up' : '向上'}><ChevronUp size={18} /></button>
            <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Recycle Bin refreshed' : '回收站已刷新')} aria-label={lang === 'en' ? 'Refresh' : '刷新'}><RefreshCw size={17} /></button>
          </div>
          <div className="desktop-folder-window__breadcrumb" aria-label={lang === 'en' ? 'Address' : '地址'}>
            <MonitorCog size={18} />
            <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Desktop' : '桌面')}>{lang === 'en' ? 'Desktop' : '桌面'}</button>
            <ArrowRight size={15} />
            <button type="button" className="is-current" onClick={() => setActivityMessage(recycleBinLabel)}>
              {recycleBinLabel}
            </button>
          </div>
          <label className="desktop-folder-window__search">
            <Search size={18} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={lang === 'en' ? 'Search Recycle Bin' : '在 回收站 中搜索'}
              aria-label={lang === 'en' ? 'Search Recycle Bin' : '搜索回收站'}
            />
          </label>
        </div>
        <div className="desktop-folder-window__commandbar">
          <button type="button" className="desktop-folder-window__command-primary" onClick={handleUnavailableCommand}>
            <CirclePlus size={18} />
            <span>{lang === 'en' ? 'New' : '新建'}</span>
          </button>
          <span className="desktop-folder-window__command-separator" />
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleUnavailableCommand} title={lang === 'en' ? 'Cut' : '剪切'} aria-label={lang === 'en' ? 'Cut' : '剪切'}><Scissors size={17} /></button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleUnavailableCommand} title={lang === 'en' ? 'Copy' : '复制'} aria-label={lang === 'en' ? 'Copy' : '复制'}><Copy size={17} /></button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleUnavailableCommand} title={lang === 'en' ? 'Paste' : '粘贴'} aria-label={lang === 'en' ? 'Paste' : '粘贴'}><ClipboardPaste size={17} /></button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleUnavailableCommand} title={lang === 'en' ? 'Rename' : '重命名'} aria-label={lang === 'en' ? 'Rename' : '重命名'}><Pencil size={17} /></button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleRestoreSelected} title={lang === 'en' ? 'Restore selected item' : '还原所选项目'} aria-label={lang === 'en' ? 'Restore selected item' : '还原所选项目'}><Recycle size={17} /></button>
          <button type="button" className="desktop-folder-window__icon-command" onClick={handleDeleteSelected} title={lang === 'en' ? 'Delete permanently' : '永久删除'} aria-label={lang === 'en' ? 'Delete permanently' : '永久删除'}><Trash2 size={17} /></button>
          <span className="desktop-folder-window__command-separator" />
          <div className="desktop-folder-window__menu-anchor">
            <button type="button" onClick={() => setOpenMenu((current) => current === 'sort' ? '' : 'sort')}>
              <ArrowDownUp size={17} />
              <span>{lang === 'en' ? 'Sort' : '排序'}</span>
            </button>
            {openMenu === 'sort' && (
              <div className="desktop-folder-window__menu" role="menu">
                <button type="button" role="menuitem" className={sortAscending ? 'is-active' : ''} onClick={() => { setSortAscending(true); setOpenMenu(''); setActivityMessage(lang === 'en' ? 'Sorted A to Z' : '已按名称升序排列'); }}>
                  <ArrowDownUp size={17} />
                  <span>{lang === 'en' ? 'Name A to Z' : '名称升序'}</span>
                </button>
                <button type="button" role="menuitem" className={!sortAscending ? 'is-active' : ''} onClick={() => { setSortAscending(false); setOpenMenu(''); setActivityMessage(lang === 'en' ? 'Sorted Z to A' : '已按名称降序排列'); }}>
                  <ArrowDownUp size={17} />
                  <span>{lang === 'en' ? 'Name Z to A' : '名称降序'}</span>
                </button>
              </div>
            )}
          </div>
          <div className="desktop-folder-window__menu-anchor">
            <button type="button" onClick={() => setOpenMenu((current) => current === 'view' ? '' : 'view')}>
              <LayoutGrid size={17} />
              <span>{lang === 'en' ? 'View' : '查看'}</span>
            </button>
            {openMenu === 'view' && (
              <div className="desktop-folder-window__menu" role="menu">
                <button type="button" role="menuitem" className={viewMode === 'details' ? 'is-active' : ''} onClick={() => { setViewMode('details'); setOpenMenu(''); }}>
                  <List size={17} />
                  <span>{lang === 'en' ? 'Details' : '详细信息'}</span>
                </button>
                <button type="button" role="menuitem" className={viewMode === 'icons' ? 'is-active' : ''} onClick={() => { setViewMode('icons'); setOpenMenu(''); }}>
                  <LayoutGrid size={17} />
                  <span>{lang === 'en' ? 'Icons' : '图标'}</span>
                </button>
              </div>
            )}
          </div>
          <div className="desktop-folder-window__menu-anchor">
            <button type="button" className="desktop-folder-window__icon-command" onClick={() => setOpenMenu((current) => current === 'more' ? '' : 'more')} aria-label={lang === 'en' ? 'More' : '更多'}>
              <MoreHorizontal size={18} />
            </button>
            {openMenu === 'more' && (
              <div className="desktop-folder-window__menu desktop-folder-window__menu--right" role="menu">
                <button type="button" role="menuitem" onClick={handleRestoreSelected}>
                  <Recycle size={17} />
                  <span>{lang === 'en' ? 'Restore selected item' : '还原所选项目'}</span>
                </button>
                <button type="button" role="menuitem" onClick={handleDeleteSelected}>
                  <Trash2 size={17} />
                  <span>{lang === 'en' ? 'Delete permanently' : '永久删除'}</span>
                </button>
                <button type="button" role="menuitem" onClick={handleEmptyRecycleBin}>
                  <Trash2 size={17} />
                  <span>{lang === 'en' ? 'Empty Recycle Bin' : '清空回收站'}</span>
                </button>
              </div>
            )}
          </div>
          <button type="button" className={`desktop-folder-window__details-toggle ${detailsPaneOpen ? 'is-active' : ''}`} onClick={() => setDetailsPaneOpen((current) => !current)}>
            <List size={17} />
            <span>{lang === 'en' ? 'Details' : '详细信息'}</span>
          </button>
        </div>
      </header>
      <div className="desktop-folder-window__content">
        <aside className="desktop-folder-window__sidebar">
          <button type="button" className="is-active" onClick={() => setActivityMessage(recycleBinLabel)}>
            <Home size={18} />
            <span>{lang === 'en' ? 'Home folder' : '主文件夹'}</span>
            <small>{entries.length}</small>
          </button>
          <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Gallery' : '图库')}>
            <PanelTopOpen size={18} />
            <span>{lang === 'en' ? 'Gallery' : '图库'}</span>
          </button>
          <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'NA - Personal' : 'NA - 个人')}>
            <Cloud size={18} />
            <span>{lang === 'en' ? 'NA - Personal' : 'NA - 个人'}</span>
          </button>
          <span className="desktop-folder-window__sidebar-divider" />
          <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Desktop' : '桌面')}>
            <MonitorCog size={18} />
            <span>{lang === 'en' ? 'Desktop' : '桌面'}</span>
          </button>
          <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Downloads' : '下载')}>
            <Download size={18} />
            <span>{lang === 'en' ? 'Downloads' : '下载'}</span>
          </button>
          <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Documents' : '文档')}>
            <FileText size={18} />
            <span>{lang === 'en' ? 'Documents' : '文档'}</span>
          </button>
        </aside>
        <section className="desktop-folder-window__main">
          {viewMode === 'details' && (
            <div className="desktop-folder-window__details-head desktop-recycle-bin-window__details-head" role="row">
              <button type="button" onClick={() => setSortAscending((current) => !current)}>{lang === 'en' ? 'Name' : '名称'}</button>
              <span>{lang === 'en' ? 'Original location' : '原位置'}</span>
              <span>{lang === 'en' ? 'Date deleted' : '删除日期'}</span>
              <span>{lang === 'en' ? 'Size' : '大小'}</span>
              <span>{lang === 'en' ? 'Item type' : '项目类型'}</span>
            </div>
          )}
          <div className={`desktop-folder-window__grid desktop-recycle-bin-window__grid desktop-recycle-bin-window__grid--${viewMode}`}>
            {filteredEntries.map((entry) => {
              const entryIcon = entry.item.kind === 'folder' ? DESKTOP_APP_ICONS.createdFolder : DESKTOP_APP_ICONS.createdTextDocument;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`desktop-recycle-bin-item ${selectedEntryId === entry.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedEntryId(entry.id)}
                  onDoubleClick={() => onRestoreEntry?.(entry.id)}
                  title={entry.item.label}
                >
                  <span className="desktop-recycle-bin-item__primary">
                    <img src={entryIcon} alt="" draggable="false" />
                    <span>{entry.item.label}</span>
                  </span>
                  {viewMode === 'details' && (
                    <>
                      <span>{entry.originalLocation === 'Desktop' ? (lang === 'en' ? 'Desktop' : '桌面') : entry.originalLocation}</span>
                      <span>{getRecycleBinDateLabel(entry.deletedAt, lang)}</span>
                      <span>{getRecycleBinEntrySize(entry, lang)}</span>
                      <span>{getRecycleBinEntryType(entry, lang)}</span>
                    </>
                  )}
                </button>
              );
            })}
            {filteredEntries.length === 0 && (
              <div className="desktop-folder-window__empty">
                <span>{searchQuery ? (lang === 'en' ? 'No matching items.' : '没有匹配的项目。') : (lang === 'en' ? 'This folder is empty.' : '此文件夹为空。')}</span>
              </div>
            )}
          </div>
        </section>
        {detailsPaneOpen && (
          <aside className="desktop-folder-window__details-pane">
            <span className="desktop-folder-window__details-pane-icon">
              {selectedEntry
                ? <img src={selectedEntry.item.kind === 'folder' ? DESKTOP_APP_ICONS.createdFolder : DESKTOP_APP_ICONS.createdTextDocument} alt="" draggable="false" />
                : <img src={entries.length ? DESKTOP_APP_ICONS.recycleBinFull : DESKTOP_APP_ICONS.recycleBinEmpty} alt="" draggable="false" />}
            </span>
            <strong>{selectedEntry?.item.label || recycleBinLabel}</strong>
            <span>{selectedEntry ? getRecycleBinEntryType(selectedEntry, lang) : (lang === 'en' ? 'System folder' : '系统文件夹')}</span>
            <small>{selectedEntry ? getRecycleBinDateLabel(selectedEntry.deletedAt, lang) : baseStatusText}</small>
          </aside>
        )}
        <footer className="desktop-folder-window__status">{statusText}</footer>
      </div>
      {!maximized && ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((direction) => (
        <span
          key={direction}
          className={`desktop-folder-window__resize desktop-folder-window__resize--${direction}`}
          aria-hidden="true"
          onPointerDown={(event) => startWindowResize(event, direction)}
          onPointerMove={handleWindowPointerMove}
          onPointerUp={stopWindowInteraction}
          onPointerCancel={stopWindowInteraction}
        />
      ))}
    </section>
  );
}

const DESKTOP_TEXT_WINDOW_MIN_WIDTH = 520;
const DESKTOP_TEXT_WINDOW_MIN_HEIGHT = 360;

function getDefaultTextDocumentWindowGeometry() {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 780;
  const width = Math.min(980, Math.max(DESKTOP_TEXT_WINDOW_MIN_WIDTH, Math.round(viewportWidth * 0.58)));
  const height = Math.min(680, Math.max(DESKTOP_TEXT_WINDOW_MIN_HEIGHT, Math.round(viewportHeight * 0.62)));
  return {
    x: Math.max(18, Math.round((viewportWidth - width) / 2)),
    y: 72,
    width,
    height,
  };
}

function clampTextDocumentWindowGeometry(geometry) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 780;
  const maxWidth = Math.max(DESKTOP_TEXT_WINDOW_MIN_WIDTH, viewportWidth - 28);
  const maxHeight = Math.max(DESKTOP_TEXT_WINDOW_MIN_HEIGHT, viewportHeight - DESKTOP_TASKBAR_HEIGHT - 24);
  const width = Math.min(maxWidth, Math.max(DESKTOP_TEXT_WINDOW_MIN_WIDTH, Math.round(Number(geometry.width) || DESKTOP_TEXT_WINDOW_MIN_WIDTH)));
  const height = Math.min(maxHeight, Math.max(DESKTOP_TEXT_WINDOW_MIN_HEIGHT, Math.round(Number(geometry.height) || DESKTOP_TEXT_WINDOW_MIN_HEIGHT)));
  const x = Math.min(Math.max(12, Math.round(Number(geometry.x) || 12)), Math.max(12, viewportWidth - width - 12));
  const y = Math.min(Math.max(10, Math.round(Number(geometry.y) || 10)), Math.max(10, viewportHeight - DESKTOP_TASKBAR_HEIGHT - height - 10));
  return { x, y, width, height };
}

function resizeTextDocumentWindowGeometry(startGeometry, deltaX, deltaY, direction = 'se') {
  const start = clampTextDocumentWindowGeometry(startGeometry);
  const dir = String(direction || 'se');
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (dir.includes('e')) right += deltaX;
  if (dir.includes('w')) left += deltaX;
  if (dir.includes('s')) bottom += deltaY;
  if (dir.includes('n')) top += deltaY;
  if (right - left < DESKTOP_TEXT_WINDOW_MIN_WIDTH) {
    if (dir.includes('w')) left = right - DESKTOP_TEXT_WINDOW_MIN_WIDTH;
    else right = left + DESKTOP_TEXT_WINDOW_MIN_WIDTH;
  }
  if (bottom - top < DESKTOP_TEXT_WINDOW_MIN_HEIGHT) {
    if (dir.includes('n')) top = bottom - DESKTOP_TEXT_WINDOW_MIN_HEIGHT;
    else bottom = top + DESKTOP_TEXT_WINDOW_MIN_HEIGHT;
  }
  return clampTextDocumentWindowGeometry({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}

function getTextDocumentStats(content) {
  const text = String(content || '');
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.length ? normalized.split('\n') : [''];
  const words = normalized.trim() ? normalized.trim().split(/\s+/).length : 0;
  return {
    characters: text.length,
    lines: lines.length,
    words,
  };
}

function DesktopTextToolButton({ active = false, danger = false, disabled = false, label, onClick, children }) {
  return (
    <button
      type="button"
      className={`desktop-text-tool-button ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      data-window-no-drag="true"
    >
      {children}
    </button>
  );
}

function DesktopTextDocumentWindow({
  item,
  lang,
  mergeCandidateCount = 0,
  onClose,
  onSave,
  onDelete,
  onCreateNew,
  onSplitDocument,
  onMergeDocuments,
}) {
  const textareaRef = useRef(null);
  const moveRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [draftTitle, setDraftTitle] = useState(item.label);
  const [draftContent, setDraftContent] = useState(item.content);
  const [editing, setEditing] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [statusVisible, setStatusVisible] = useState(true);
  const [fontScale, setFontScale] = useState(1);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [geometry, setGeometry] = useState(getDefaultTextDocumentWindowGeometry);
  const dirty = draftTitle.trim() !== item.label || draftContent !== item.content;
  const stats = useMemo(() => getTextDocumentStats(draftContent), [draftContent]);

  useEffect(() => {
    setDraftTitle(item.label);
    setDraftContent(item.content);
    setEditing(true);
    setMinimized(false);
  }, [item.id, item.label, item.content]);

  const focusEditor = useCallback(() => {
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const rememberSelection = useCallback(() => {
    const editor = textareaRef.current;
    if (!editor) return selectionRef.current;
    selectionRef.current = {
      start: editor.selectionStart || 0,
      end: editor.selectionEnd || 0,
    };
    return selectionRef.current;
  }, []);

  const replaceEditorRange = useCallback((replacementBuilder) => {
    setEditing(true);
    const editor = textareaRef.current;
    const currentSelection = editor
      ? { start: editor.selectionStart || 0, end: editor.selectionEnd || 0 }
      : selectionRef.current;
    const start = Math.min(currentSelection.start, currentSelection.end);
    const end = Math.max(currentSelection.start, currentSelection.end);
    const selected = draftContent.slice(start, end);
    const built = replacementBuilder(selected, start, end);
    const replacement = typeof built === 'string' ? built : built.text;
    const selectionStart = typeof built === 'object' && Number.isFinite(built.selectionStart)
      ? built.selectionStart
      : start + replacement.length;
    const selectionEnd = typeof built === 'object' && Number.isFinite(built.selectionEnd)
      ? built.selectionEnd
      : selectionStart;
    const nextContent = `${draftContent.slice(0, start)}${replacement}${draftContent.slice(end)}`;
    setDraftContent(nextContent);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
      selectionRef.current = { start: selectionStart, end: selectionEnd };
    });
  }, [draftContent]);

  const wrapSelection = useCallback((prefix, suffix = prefix, fallback = 'text') => {
    replaceEditorRange((selected, start) => {
      const core = selected || fallback;
      return {
        text: `${prefix}${core}${suffix}`,
        selectionStart: start + prefix.length,
        selectionEnd: start + prefix.length + core.length,
      };
    });
  }, [replaceEditorRange]);

  const formatLines = useCallback((formatter) => {
    replaceEditorRange((selected, start, end) => {
      const source = selected || draftContent;
      const nextText = source.split(/\r?\n/).map(formatter).join('\n');
      return {
        text: nextText,
        selectionStart: selected ? start : 0,
        selectionEnd: selected ? start + nextText.length : nextText.length,
      };
    });
  }, [draftContent, replaceEditorRange]);

  const handleSave = useCallback(() => {
    const nextTitle = draftTitle.trim() || (lang === 'en' ? 'New text document' : '新建文本文档');
    setDraftTitle(nextTitle);
    onSave?.({ label: nextTitle, content: draftContent });
  }, [draftContent, draftTitle, lang, onSave]);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm(lang === 'en' ? 'Close without saving changes?' : '不保存更改并关闭？')) return;
    onClose?.();
  }, [dirty, lang, onClose]);

  const handleDelete = useCallback(() => {
    if (!window.confirm(lang === 'en' ? `Delete ${item.label}?` : `删除「${item.label}」？`)) return;
    onDelete?.();
  }, [item.label, lang, onDelete]);

  const handleSplit = useCallback(() => {
    const editor = textareaRef.current;
    const start = editor ? editor.selectionStart : selectionRef.current.start;
    const end = editor ? editor.selectionEnd : selectionRef.current.end;
    const left = Math.min(start || 0, end || 0);
    const right = Math.max(start || 0, end || 0);
    const selected = draftContent.slice(left, right);
    const splitContent = selected || draftContent;
    const remainingContent = selected
      ? `${draftContent.slice(0, left)}${draftContent.slice(right)}`
      : draftContent;
    setDraftContent(remainingContent);
    onSplitDocument?.({
      label: `${draftTitle.trim() || item.label} - ${lang === 'en' ? 'Split' : '拆分'}`,
      content: splitContent,
      remainingContent,
    });
  }, [draftContent, draftTitle, item.label, lang, onSplitDocument]);

  const handleMerge = useCallback(() => {
    const nextContent = onMergeDocuments?.({ label: draftTitle, content: draftContent });
    if (typeof nextContent === 'string') setDraftContent(nextContent);
  }, [draftContent, draftTitle, onMergeDocuments]);

  const cycleFontScale = useCallback(() => {
    setFontScale((current) => {
      if (current < 1) return 1;
      if (current < 1.12) return 1.18;
      return 0.92;
    });
  }, []);

  const clearMarkdown = useCallback(() => {
    replaceEditorRange((selected, start) => {
      const source = selected || draftContent;
      const cleaned = source
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*]\s+/gm, '');
      return {
        text: cleaned,
        selectionStart: selected ? start : 0,
        selectionEnd: selected ? start + cleaned.length : cleaned.length,
      };
    });
  }, [draftContent, replaceEditorRange]);

  const startWindowMove = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (maximized || event.target.closest('button, input, textarea, select, [data-window-no-drag="true"]')) return;
    event.preventDefault();
    moveRef.current = {
      type: 'move',
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: clampTextDocumentWindowGeometry(geometry),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [geometry, maximized]);

  const startWindowResize = useCallback((event, direction = 'se') => {
    if (event.button !== undefined && event.button !== 0) return;
    if (maximized) return;
    event.preventDefault();
    event.stopPropagation();
    moveRef.current = {
      type: 'resize',
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: clampTextDocumentWindowGeometry(geometry),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [geometry, maximized]);

  const handleWindowPointerMove = useCallback((event) => {
    const move = moveRef.current;
    if (!move) return;
    event.preventDefault();
    const deltaX = event.clientX - move.startX;
    const deltaY = event.clientY - move.startY;
    const nextGeometry = move.type === 'resize'
      ? resizeTextDocumentWindowGeometry(move.startGeometry, deltaX, deltaY, move.direction)
      : clampTextDocumentWindowGeometry({
          ...move.startGeometry,
          x: move.startGeometry.x + deltaX,
          y: move.startGeometry.y + deltaY,
        });
    setGeometry(nextGeometry);
  }, []);

  const stopWindowInteraction = useCallback((event) => {
    if (!moveRef.current) return;
    moveRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const windowStyle = maximized
    ? undefined
    : {
        left: `${geometry.x}px`,
        top: `${geometry.y}px`,
        width: `${geometry.width}px`,
        height: `${geometry.height}px`,
        '--desktop-text-editor-scale': fontScale,
      };

  const toolbarLabel = (zh, en) => (lang === 'en' ? en : zh);
  const lineText = lang === 'en'
    ? `Line ${stats.lines}, ${stats.words} words`
    : `行 ${stats.lines}，${stats.words} 个词`;
  const characterText = lang === 'en'
    ? `${stats.characters} chars`
    : `${stats.characters} 个字符`;

  if (minimized) {
    return (
      <button
        type="button"
        className="desktop-text-window-minimized"
        onClick={() => setMinimized(false)}
        aria-label={lang === 'en' ? 'Restore text document' : '还原文本文档'}
      >
        <FileText size={18} />
        <span>{draftTitle || item.label}</span>
        {dirty && <b />}
      </button>
    );
  }

  return (
    <section
      className={`desktop-item-window desktop-text-window ${maximized ? 'is-maximized' : ''} ${dirty ? 'is-dirty' : ''} ${statusVisible ? '' : 'is-status-hidden'}`}
      style={windowStyle}
      aria-label={item.label}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <header
        className="desktop-text-window__chrome"
        onPointerDown={startWindowMove}
        onPointerMove={handleWindowPointerMove}
        onPointerUp={stopWindowInteraction}
        onPointerCancel={stopWindowInteraction}
      >
        <div className="desktop-text-window__tabs">
          <div className="desktop-text-window__tab is-active" data-window-no-drag="true">
            <FileText size={18} />
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              aria-label={lang === 'en' ? 'Document name' : '文档名称'}
            />
            {dirty && <span className="desktop-text-window__dirty-dot" aria-hidden="true" />}
            <button type="button" onClick={requestClose} aria-label={lang === 'en' ? 'Close tab' : '关闭标签'}>
              <X size={14} />
            </button>
          </div>
          <button
            type="button"
            className="desktop-text-window__tab-add"
            onClick={onCreateNew}
            title={lang === 'en' ? 'New text document' : '新建文本文档'}
            aria-label={lang === 'en' ? 'New text document' : '新建文本文档'}
            data-window-no-drag="true"
          >
            <Plus size={18} />
          </button>
          <span className="desktop-text-window__drag-space" aria-hidden="true" />
          <div className="desktop-text-window__window-controls" data-window-no-drag="true">
            <button type="button" onClick={() => setMinimized(true)} aria-label={lang === 'en' ? 'Minimize' : '最小化'} title={lang === 'en' ? 'Minimize' : '最小化'}>
              <Minus size={17} />
            </button>
            <button type="button" onClick={() => setMaximized((current) => !current)} aria-label={maximized ? (lang === 'en' ? 'Restore' : '还原') : (lang === 'en' ? 'Maximize' : '最大化')} title={maximized ? (lang === 'en' ? 'Restore' : '还原') : (lang === 'en' ? 'Maximize' : '最大化')}>
              {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button type="button" className="desktop-text-window__close" onClick={requestClose} aria-label={lang === 'en' ? 'Close' : '关闭'} title={lang === 'en' ? 'Close' : '关闭'}>
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="desktop-text-window__menu" data-window-no-drag="true">
          <button type="button" onClick={handleSave}>{toolbarLabel('文件', 'File')}</button>
          <button type="button" onClick={() => { setEditing(true); focusEditor(); }}>{toolbarLabel('编辑', 'Edit')}</button>
          <button type="button" onClick={() => setStatusVisible((current) => !current)}>{toolbarLabel('查看', 'View')}</button>
        </div>

        <div className="desktop-text-window__toolbar" data-window-no-drag="true">
          <DesktopTextToolButton label={toolbarLabel('编辑', 'Edit')} active={editing} onClick={() => { setEditing((current) => !current); focusEditor(); }}>
            <Pencil size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('保存', 'Save')} active={dirty} onClick={handleSave}>
            <Save size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('新建', 'New')} onClick={onCreateNew}>
            <FilePlus2 size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('拆分为新文档', 'Split to new document')} onClick={handleSplit}>
            <Scissors size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={mergeCandidateCount > 0 ? toolbarLabel('合并最近文档', 'Merge recent document') : toolbarLabel('没有可合并文档', 'No document to merge')} onClick={handleMerge}>
            <Merge size={18} />
          </DesktopTextToolButton>
          <span className="desktop-text-window__toolbar-separator" />
          <DesktopTextToolButton label="H1" onClick={() => formatLines((line) => line.replace(/^#{1,6}\s*/, '# '))}>
            <Heading1 size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('列表', 'List')} onClick={() => formatLines((line) => (line.trim() ? `- ${line.replace(/^\s*[-*]\s+/, '')}` : line))}>
            <List size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('加粗', 'Bold')} onClick={() => wrapSelection('**', '**', toolbarLabel('加粗文本', 'bold text'))}>
            <Bold size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('斜体', 'Italic')} onClick={() => wrapSelection('*', '*', toolbarLabel('斜体文本', 'italic text'))}>
            <Italic size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('删除线', 'Strikethrough')} onClick={() => wrapSelection('~~', '~~', toolbarLabel('删除线文本', 'struck text'))}>
            <Strikethrough size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('链接', 'Link')} onClick={() => wrapSelection('[', '](https://)', 'link')}>
            <Link size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('表格', 'Table')} onClick={() => replaceEditorRange(() => '| 标题 | 内容 |\n| --- | --- |\n|  |  |')}>
            <Table size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('清除格式', 'Clear formatting')} onClick={clearMarkdown}>
            <Eraser size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('字体大小', 'Text size')} onClick={cycleFontScale}>
            <Type size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('状态栏', 'Status bar')} active={statusVisible} onClick={() => setStatusVisible((current) => !current)}>
            <Eye size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('自动换行', 'Word wrap')} active={wordWrap} onClick={() => setWordWrap((current) => !current)}>
            <PanelTopOpen size={18} />
          </DesktopTextToolButton>
          <DesktopTextToolButton label={toolbarLabel('删除', 'Delete')} danger onClick={handleDelete}>
            <Trash2 size={18} />
          </DesktopTextToolButton>
        </div>
      </header>

      <textarea
        ref={textareaRef}
        className={`desktop-text-window__editor ${wordWrap ? 'is-wrapped' : 'is-nowrap'}`}
        value={draftContent}
        onChange={(event) => setDraftContent(event.target.value)}
        onSelect={rememberSelection}
        onKeyUp={rememberSelection}
        onClick={rememberSelection}
        readOnly={!editing}
        aria-label={lang === 'en' ? 'Document text' : '文本文档内容'}
        spellCheck="false"
        style={{ '--desktop-text-editor-scale': fontScale }}
      />

      {statusVisible && (
        <footer className="desktop-text-window__status" data-window-no-drag="true">
          <span>{lineText}</span>
          <span>{characterText}</span>
          <span>{editing ? toolbarLabel('可编辑', 'Editable') : toolbarLabel('只读', 'Read only')}</span>
          <span>{dirty ? toolbarLabel('未保存', 'Unsaved') : toolbarLabel('已保存', 'Saved')}</span>
          <span>UTF-8</span>
        </footer>
      )}

      {!maximized && ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map(direction => (
        <span
          key={direction}
          className={`desktop-text-window__resize desktop-text-window__resize--${direction}`}
          onPointerDown={(event) => startWindowResize(event, direction)}
          onPointerMove={handleWindowPointerMove}
          onPointerUp={stopWindowInteraction}
          onPointerCancel={stopWindowInteraction}
          aria-hidden="true"
        />
      ))}
    </section>
  );
}


function ChatPulseDesktop({ lang, apps, desktopWallpaper, onDesktopWallpaperChange, showWallpaper = true }) {
  const normalizedWallpaper = normalizeDesktopWallpaper(desktopWallpaper);
  const wallpaperImageSrc = DESKTOP_WALLPAPER_IMAGE_URLS[normalizedWallpaper];
  const wallpaperAnimated = normalizedWallpaper === 'ocean-live2d';
  const gridRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(null);
  const settleFrameRef = useRef(null);
  const settleTimerRef = useRef(null);
  const [iconLayout, setIconLayout] = useState(loadDesktopIconLayout);
  const [draggingIcon, setDraggingIcon] = useState(null);
  const [folderDropTargetId, setFolderDropTargetId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [desktopClipboard, setDesktopClipboard] = useState(null);
  const [favoriteCreatedItemIds, setFavoriteCreatedItemIds] = useState(() => new Set());
  const [desktopRefreshPulse, setDesktopRefreshPulse] = useState(0);
  const desktopRefreshTimerRef = useRef(null);
  const [desktopIconSize, setDesktopIconSize] = useState(() => (
    loadDesktopStoredChoice(DESKTOP_ICON_SIZE_STORAGE_KEY, ['large', 'medium', 'small'], 'medium')
  ));
  const [desktopIconsVisible, setDesktopIconsVisible] = useState(() => (
    loadDesktopStoredBoolean(DESKTOP_ICONS_VISIBLE_STORAGE_KEY, true)
  ));
  const [desktopAutoArrange, setDesktopAutoArrange] = useState(() => (
    loadDesktopStoredBoolean(DESKTOP_AUTO_ARRANGE_STORAGE_KEY, false)
  ));
  const [desktopAlignIconsToGrid, setDesktopAlignIconsToGrid] = useState(() => (
    loadDesktopStoredBoolean(DESKTOP_ALIGN_TO_GRID_STORAGE_KEY, true)
  ));
  const [desktopSortKey, setDesktopSortKey] = useState('name');
  const [previousIconLayout, setPreviousIconLayout] = useState(null);
  const [createdDesktopItems, setCreatedDesktopItems] = useState(loadCreatedDesktopItems);
  const [recycleBinItems, setRecycleBinItems] = useState(loadRecycleBinItems);
  const [openCreatedItemId, setOpenCreatedItemId] = useState(null);
  const [openFolderWindowIds, setOpenFolderWindowIds] = useState([]);
  const [activeFolderWindowId, setActiveFolderWindowId] = useState(null);
  const [folderWindowStates, setFolderWindowStates] = useState({});
  const [recycleBinWindowOpen, setRecycleBinWindowOpen] = useState(false);
  const [recycleBinWindowState, setRecycleBinWindowState] = useState(() => ({
    geometry: getDefaultFolderWindowGeometry(1),
    minimized: false,
    maximized: false,
    zIndex: 84,
  }));
  const [renamingCreatedItemId, setRenamingCreatedItemId] = useState(null);
  const [createdItemRenameDraft, setCreatedItemRenameDraft] = useState('');
  const folderWindowZCounterRef = useRef(120);

  const showDesktopNotice = useCallback(() => {}, []);

  const appById = useMemo(() => new Map(apps.map(app => [app.id, app])), [apps]);

  const folderedAppIds = useMemo(() => {
    const ids = new Set();
    createdDesktopItems.forEach((item) => {
      if (item.kind !== 'folder') return;
      (item.folderAppIds || []).forEach(appId => ids.add(appId));
    });
    return ids;
  }, [createdDesktopItems]);

  const topLevelDesktopApps = useMemo(
    () => apps.filter(app => !folderedAppIds.has(app.id)),
    [apps, folderedAppIds]
  );

  const allocateFolderWindowZIndex = useCallback(() => {
    folderWindowZCounterRef.current += 1;
    return folderWindowZCounterRef.current;
  }, []);

  const makeFolderWindowState = useCallback((index = 0, zIndex = allocateFolderWindowZIndex()) => ({
    geometry: getDefaultFolderWindowGeometry(index),
    minimized: false,
    maximized: false,
    zIndex,
  }), [allocateFolderWindowZIndex]);

  const openCreatedFolderWindow = useCallback((folderId) => {
    if (!folderId) return;
    const nextZIndex = allocateFolderWindowZIndex();
    setOpenFolderWindowIds((current) => (
      current.includes(folderId) ? current : [...current, folderId]
    ));
    setActiveFolderWindowId(folderId);
    setFolderWindowStates((current) => {
      const previous = current[folderId] || makeFolderWindowState(openFolderWindowIds.length, nextZIndex);
      return {
        ...current,
        [folderId]: {
          ...previous,
          minimized: false,
          zIndex: nextZIndex,
        },
      };
    });
  }, [allocateFolderWindowZIndex, makeFolderWindowState, openFolderWindowIds.length]);

  const closeCreatedFolderWindow = useCallback((folderId) => {
    setOpenFolderWindowIds((current) => current.filter(id => id !== folderId));
    setFolderWindowStates((current) => {
      if (!current[folderId]) return current;
      const next = { ...current };
      delete next[folderId];
      return next;
    });
    setActiveFolderWindowId((current) => (current === folderId ? null : current));
    setFolderDropTargetId((current) => (current === folderId ? null : current));
  }, []);

  const updateFolderWindowState = useCallback((folderId, updater) => {
    if (!folderId) return;
    setFolderWindowStates((current) => {
      const index = openFolderWindowIds.indexOf(folderId);
      const previous = current[folderId] || makeFolderWindowState(index >= 0 ? index : 0);
      const patch = typeof updater === 'function' ? updater(previous) : updater;
      return {
        ...current,
        [folderId]: {
          ...previous,
          ...patch,
        },
      };
    });
  }, [makeFolderWindowState, openFolderWindowIds]);

  const bringFolderWindowToFront = useCallback((folderId) => {
    if (!folderId) return;
    const nextZIndex = allocateFolderWindowZIndex();
    setActiveFolderWindowId(folderId);
    updateFolderWindowState(folderId, { zIndex: nextZIndex });
  }, [allocateFolderWindowZIndex, updateFolderWindowState]);

  const minimizeFolderWindow = useCallback((folderId) => {
    updateFolderWindowState(folderId, { minimized: true });
    setActiveFolderWindowId((current) => (current === folderId ? null : current));
  }, [updateFolderWindowState]);

  const restoreFolderWindow = useCallback((folderId) => {
    if (!folderId) return;
    const nextZIndex = allocateFolderWindowZIndex();
    setActiveFolderWindowId(folderId);
    updateFolderWindowState(folderId, {
      minimized: false,
      zIndex: nextZIndex,
    });
  }, [allocateFolderWindowZIndex, updateFolderWindowState]);

  const toggleFolderWindowMaximized = useCallback((folderId) => {
    if (!folderId) return;
    const nextZIndex = allocateFolderWindowZIndex();
    setActiveFolderWindowId(folderId);
    updateFolderWindowState(folderId, (current) => ({
      maximized: !current.maximized,
      minimized: false,
      zIndex: nextZIndex,
    }));
  }, [allocateFolderWindowZIndex, updateFolderWindowState]);

  const setFolderWindowGeometry = useCallback((folderId, geometry) => {
    updateFolderWindowState(folderId, {
      geometry: clampFolderWindowGeometry(geometry),
    });
  }, [updateFolderWindowState]);

  const openRecycleBinWindow = useCallback(() => {
    const nextZIndex = allocateFolderWindowZIndex();
    setRecycleBinWindowOpen(true);
    setRecycleBinWindowState((current) => ({
      ...current,
      minimized: false,
      zIndex: nextZIndex,
    }));
    setActiveFolderWindowId(DESKTOP_RECYCLE_BIN_ID);
  }, [allocateFolderWindowZIndex]);

  const closeRecycleBinWindow = useCallback(() => {
    setRecycleBinWindowOpen(false);
    setActiveFolderWindowId((current) => (current === DESKTOP_RECYCLE_BIN_ID ? null : current));
  }, []);

  const bringRecycleBinWindowToFront = useCallback(() => {
    const nextZIndex = allocateFolderWindowZIndex();
    setRecycleBinWindowOpen(true);
    setActiveFolderWindowId(DESKTOP_RECYCLE_BIN_ID);
    setRecycleBinWindowState((current) => ({
      ...current,
      minimized: false,
      zIndex: nextZIndex,
    }));
  }, [allocateFolderWindowZIndex]);

  const recycleBinApp = useMemo(() => ({
    id: DESKTOP_RECYCLE_BIN_ID,
    label: lang === 'en' ? 'Recycle Bin' : '回收站',
    title: lang === 'en' ? 'Open Recycle Bin' : '打开回收站',
    kind: 'recycle-bin',
    variant: recycleBinItems.length ? 'recycle-bin-full' : 'recycle-bin-empty',
    icon: Recycle,
    iconImage: recycleBinItems.length ? DESKTOP_APP_ICONS.recycleBinFull : DESKTOP_APP_ICONS.recycleBinEmpty,
    shortcut: false,
    accent: '#3f8fd4',
    onOpen: openRecycleBinWindow,
  }), [lang, openRecycleBinWindow, recycleBinItems.length]);

  const decoratedCreatedDesktopItems = useMemo(() => {
    return createdDesktopItems.map((item) => {
      const folderPreviewApp = item.kind === 'folder'
        ? (item.folderAppIds || []).map(appId => appById.get(appId)).find(Boolean)
        : null;
      return {
        ...item,
        title: item.kind === 'folder'
          ? (lang === 'en' ? 'Open folder' : '打开文件夹')
          : (lang === 'en' ? 'Open text document' : '打开文本文档'),
        icon: item.kind === 'folder' ? Folder : FileText,
        iconImage: item.kind === 'folder' ? DESKTOP_APP_ICONS.createdFolder : DESKTOP_APP_ICONS.createdTextDocument,
        folderPreviewApp,
        shortcut: false,
        accent: item.kind === 'folder' ? '#d69a24' : '#5d8fe8',
        onOpen: () => {
          if (item.kind === 'folder') {
            openCreatedFolderWindow(item.id);
            return;
          }
          setOpenCreatedItemId(item.id);
        },
      };
    });
  }, [appById, createdDesktopItems, lang, openCreatedFolderWindow]);

  const desktopItems = useMemo(
    () => [recycleBinApp, ...topLevelDesktopApps, ...decoratedCreatedDesktopItems],
    [decoratedCreatedDesktopItems, recycleBinApp, topLevelDesktopApps]
  );

  const openCreatedItem = useMemo(
    () => createdDesktopItems.find(item => item.id === openCreatedItemId && item.kind === 'text') || null,
    [createdDesktopItems, openCreatedItemId]
  );

  const appPositions = useMemo(() => {
    const used = new Set();
    return desktopItems.reduce((positions, app, index) => {
      let position = normalizeDesktopIconPosition(iconLayout[app.id]) || getDefaultDesktopIconPosition(index);
      let key = `${position.col}:${position.row}`;
      if (used.has(key)) {
        position = findOpenDesktopIconPosition(used, index);
        key = `${position.col}:${position.row}`;
      }
      used.add(key);
      positions[app.id] = position;
      return positions;
    }, {});
  }, [desktopItems, iconLayout]);

  useEffect(() => {
    const knownIds = new Set(desktopItems.map(app => app.id));
    const compactLayout = Object.entries(iconLayout).reduce((nextLayout, [id, position]) => {
      if (!knownIds.has(id)) return nextLayout;
      const normalized = normalizeDesktopIconPosition(position);
      if (normalized) nextLayout[id] = normalized;
      return nextLayout;
    }, {});

    if (Object.keys(compactLayout).length !== Object.keys(iconLayout).length) {
      setIconLayout(compactLayout);
      return;
    }

    saveDesktopIconLayout(compactLayout);
  }, [desktopItems, iconLayout]);

  useEffect(() => () => {
    if (settleFrameRef.current) window.cancelAnimationFrame(settleFrameRef.current);
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
  }, []);

  useEffect(() => () => {
    if (desktopRefreshTimerRef.current) window.clearTimeout(desktopRefreshTimerRef.current);
  }, []);

  useEffect(() => {
    saveDesktopStoredPreference(DESKTOP_ICON_SIZE_STORAGE_KEY, desktopIconSize);
  }, [desktopIconSize]);

  useEffect(() => {
    saveDesktopStoredPreference(DESKTOP_ICONS_VISIBLE_STORAGE_KEY, desktopIconsVisible ? '1' : '0');
  }, [desktopIconsVisible]);

  useEffect(() => {
    saveDesktopStoredPreference(DESKTOP_AUTO_ARRANGE_STORAGE_KEY, desktopAutoArrange ? '1' : '0');
  }, [desktopAutoArrange]);

  useEffect(() => {
    saveDesktopStoredPreference(DESKTOP_ALIGN_TO_GRID_STORAGE_KEY, desktopAlignIconsToGrid ? '1' : '0');
  }, [desktopAlignIconsToGrid]);

  useEffect(() => {
    saveCreatedDesktopItems(createdDesktopItems);
  }, [createdDesktopItems]);

  useEffect(() => {
    saveRecycleBinItems(recycleBinItems);
  }, [recycleBinItems]);

  useEffect(() => {
    const createdItemIds = new Set(createdDesktopItems.map(item => item.id));
    if (openCreatedItemId && !createdDesktopItems.some(item => item.id === openCreatedItemId)) {
      setOpenCreatedItemId(null);
    }
    setOpenFolderWindowIds((current) => current.filter(id => createdItemIds.has(id)));
    setActiveFolderWindowId((current) => (
      current === DESKTOP_RECYCLE_BIN_ID || (current && createdItemIds.has(current)) ? current : null
    ));
    setFolderWindowStates((current) => {
      const next = Object.entries(current).reduce((states, [id, value]) => {
        if (createdItemIds.has(id)) states[id] = value;
        return states;
      }, {});
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
    if (renamingCreatedItemId && !createdDesktopItems.some(item => item.id === renamingCreatedItemId)) {
      setRenamingCreatedItemId(null);
      setCreatedItemRenameDraft('');
    }
  }, [createdDesktopItems, openCreatedItemId, renamingCreatedItemId]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const closeMenu = () => setContextMenu(null);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const getContextMenuPoint = useCallback((event) => {
    const x = event.clientX;
    const y = event.clientY;
    return {
      x,
      y,
      submenuSide: 'right',
    };
  }, []);

  const openDesktopContextMenu = useCallback((event) => {
    event.preventDefault();
    setContextMenu({
      type: 'desktop',
      ...getContextMenuPoint(event),
    });
  }, [getContextMenuPoint]);

  const openAppContextMenu = useCallback((event, app) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      type: 'app',
      appId: app.id,
      ...getContextMenuPoint(event),
    });
  }, [getContextMenuPoint]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const rememberIconLayout = useCallback(() => {
    setPreviousIconLayout(iconLayout);
  }, [iconLayout]);

  const triggerDesktopRefreshPulse = useCallback(() => {
    setDesktopRefreshPulse((current) => (current % 2) + 1);
    if (desktopRefreshTimerRef.current) {
      window.clearTimeout(desktopRefreshTimerRef.current);
    }
    desktopRefreshTimerRef.current = window.setTimeout(() => {
      setDesktopRefreshPulse(0);
      desktopRefreshTimerRef.current = null;
    }, 560);
  }, []);

  const handleRefreshDesktop = useCallback(() => {
    triggerDesktopRefreshPulse();
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Desktop refreshed' : '桌面已刷新',
      lang === 'en' ? 'Icons and wallpaper state were re-rendered.' : '图标和壁纸状态已重新渲染。'
    );
  }, [closeContextMenu, lang, showDesktopNotice, triggerDesktopRefreshPulse]);

  const handleArrangeIcons = useCallback((keepMenuOpen = false) => {
    rememberIconLayout();
    setIconLayout({});
    if (!keepMenuOpen) closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Icons arranged' : '图标已自动排列',
      lang === 'en' ? 'Desktop icons were placed back into the Windows-style grid.' : '桌面图标已回到类似 Windows 的网格位置。'
    );
  }, [closeContextMenu, lang, rememberIconLayout, showDesktopNotice]);

  const handleUndoIconLayout = useCallback(() => {
    if (previousIconLayout) {
      setIconLayout(previousIconLayout);
      setPreviousIconLayout(null);
      showDesktopNotice(
        lang === 'en' ? 'Undo complete' : '已撤销上一步',
        lang === 'en' ? 'The previous desktop layout was restored.' : '已恢复上一次桌面布局。'
      );
    } else {
      triggerDesktopRefreshPulse();
      showDesktopNotice(
        lang === 'en' ? 'Nothing to undo' : '没有可撤销的删除',
        lang === 'en' ? 'The desktop was refreshed instead.' : '已改为刷新桌面。'
      );
    }
    closeContextMenu();
  }, [closeContextMenu, lang, previousIconLayout, showDesktopNotice, triggerDesktopRefreshPulse]);

  const applySequentialIconLayout = useCallback((orderedApps) => {
    rememberIconLayout();
    setIconLayout(Object.fromEntries(
      orderedApps.map((app, index) => [app.id, getDefaultDesktopIconPosition(index)])
    ));
    closeContextMenu();
  }, [closeContextMenu, rememberIconLayout]);

  const handleSortIcons = useCallback((sortKey) => {
    setDesktopSortKey(sortKey);
    const sortedApps = [...desktopItems].sort((a, b) => {
      if (sortKey === 'status') {
        return Number(Boolean(b.active || b.running)) - Number(Boolean(a.active || a.running))
          || String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'zh-Hans-CN');
      }
      if (sortKey === 'unread') {
        return Number(Boolean(b.badge)) - Number(Boolean(a.badge))
          || String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'zh-Hans-CN');
      }
      return String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'zh-Hans-CN');
    });
    applySequentialIconLayout(sortedApps);
    const sortLabel = {
      name: lang === 'en' ? 'name' : '名称',
      status: lang === 'en' ? 'running status' : '运行状态',
      unread: lang === 'en' ? 'unread count' : '未读优先',
    }[sortKey] || sortKey;
    showDesktopNotice(
      lang === 'en' ? 'Icons sorted' : '图标已排序',
      lang === 'en' ? `Sorted by ${sortLabel}.` : `已按${sortLabel}排序。`
    );
  }, [applySequentialIconLayout, desktopItems, lang, showDesktopNotice]);

  const handleSetIconSize = useCallback((size) => {
    setDesktopIconSize(size);
    closeContextMenu();
    const sizeLabel = {
      large: lang === 'en' ? 'large' : '大图标',
      medium: lang === 'en' ? 'medium' : '中等图标',
      small: lang === 'en' ? 'small' : '小图标',
    }[size] || size;
    showDesktopNotice(
      lang === 'en' ? 'View changed' : '查看方式已更改',
      lang === 'en' ? `Desktop icons are now ${sizeLabel}.` : `桌面图标已切换为${sizeLabel}。`
    );
  }, [closeContextMenu, lang, showDesktopNotice]);

  const handleToggleAutoArrange = useCallback(() => {
    rememberIconLayout();
    setDesktopAutoArrange((current) => {
      const next = !current;
      if (next) {
        setIconLayout(Object.fromEntries(
          desktopItems.map((app, index) => [app.id, getDefaultDesktopIconPosition(index)])
        ));
      }
      showDesktopNotice(
        lang === 'en' ? 'Auto arrange icons' : '自动排列图标',
        next
          ? (lang === 'en' ? 'Enabled. Icons will stay in order.' : '已开启，图标会保持顺序排列。')
          : (lang === 'en' ? 'Disabled. Icons can be moved manually.' : '已关闭，可以手动摆放图标。')
      );
      return next;
    });
    closeContextMenu();
  }, [closeContextMenu, desktopItems, lang, rememberIconLayout, showDesktopNotice]);

  const handleToggleAlignToGrid = useCallback(() => {
    setDesktopAlignIconsToGrid((current) => {
      const next = !current;
      if (next) {
        rememberIconLayout();
        setIconLayout((currentLayout) => Object.fromEntries(
          Object.entries(currentLayout).map(([id, position]) => {
            const normalized = normalizeDesktopIconPosition(position);
            return [id, normalized ? { col: Math.round(normalized.col), row: Math.round(normalized.row) } : position];
          })
        ));
      }
      showDesktopNotice(
        lang === 'en' ? 'Align icons to grid' : '将图标与网格对齐',
        next
          ? (lang === 'en' ? 'Enabled. Dragged icons snap to the grid.' : '已开启，拖动后会吸附到网格。')
          : (lang === 'en' ? 'Disabled. Dragged icons can rest between grid slots.' : '已关闭，拖动后可停在网格之间。')
      );
      return next;
    });
    closeContextMenu();
  }, [closeContextMenu, lang, rememberIconLayout, showDesktopNotice]);

  const handleToggleDesktopIcons = useCallback(() => {
    setDesktopIconsVisible((current) => {
      const next = !current;
      showDesktopNotice(
        lang === 'en' ? 'Desktop icons' : '桌面图标',
        next
          ? (lang === 'en' ? 'Desktop icons are visible.' : '桌面图标已显示。')
          : (lang === 'en' ? 'Desktop icons are hidden. Right-click the wallpaper to show them again.' : '桌面图标已隐藏，右键壁纸可再次显示。')
      );
      return next;
    });
    closeContextMenu();
  }, [closeContextMenu, lang, showDesktopNotice]);

  const updateCreatedDesktopItem = useCallback((itemId, patchOrUpdater) => {
    setCreatedDesktopItems((current) => {
      const nextItems = current.map((item) => {
        if (item.id !== itemId) return item;
        const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(item) : patchOrUpdater;
        return normalizeCreatedDesktopItem({
          ...item,
          ...(patch || {}),
          updatedAt: Date.now(),
        });
      }).filter(Boolean);
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
  }, []);

  const handleRenameCreatedItem = useCallback((itemId, label) => {
    updateCreatedDesktopItem(itemId, { label });
  }, [updateCreatedDesktopItem]);

  const beginRenameCreatedItem = useCallback((itemId) => {
    const target = createdDesktopItems.find(item => item.id === itemId);
    if (!target) return false;
    setCreatedItemRenameDraft(target.label);
    setRenamingCreatedItemId(itemId);
    return true;
  }, [createdDesktopItems]);

  const cancelRenameCreatedItem = useCallback(() => {
    setRenamingCreatedItemId(null);
    setCreatedItemRenameDraft('');
  }, []);

  const commitRenameCreatedItem = useCallback((itemId, rawLabel = createdItemRenameDraft) => {
    const target = createdDesktopItems.find(item => item.id === itemId);
    if (!target) {
      cancelRenameCreatedItem();
      return;
    }
    const label = String(rawLabel || '').trim();
    if (!label) {
      cancelRenameCreatedItem();
      showDesktopNotice(
        lang === 'en' ? 'Rename cancelled' : '未重命名',
        lang === 'en' ? 'The name cannot be empty.' : '名称不能为空。'
      );
      return;
    }
    if (label !== target.label) {
      handleRenameCreatedItem(itemId, label);
      showDesktopNotice(
        lang === 'en' ? 'Renamed' : '已重命名',
        label
      );
    }
    setRenamingCreatedItemId(null);
    setCreatedItemRenameDraft('');
  }, [cancelRenameCreatedItem, createdDesktopItems, createdItemRenameDraft, handleRenameCreatedItem, lang, showDesktopNotice]);

  const handleChangeTextDocumentContent = useCallback((itemId, content) => {
    updateCreatedDesktopItem(itemId, { content });
  }, [updateCreatedDesktopItem]);

  const handleSaveTextDocument = useCallback((itemId, draft) => {
    const label = String(draft?.label || '').trim() || (lang === 'en' ? 'New text document' : '新建文本文档');
    updateCreatedDesktopItem(itemId, {
      label,
      content: String(draft?.content || ''),
    });
    showDesktopNotice(
      lang === 'en' ? 'Document saved' : '文档已保存',
      label
    );
  }, [lang, showDesktopNotice, updateCreatedDesktopItem]);

  const handleDeleteCreatedItem = useCallback((itemId) => {
    const target = createdDesktopItems.find(item => item.id === itemId);
    if (!target) return;
    const deletedAt = Date.now();
    const recycleEntry = normalizeRecycleBinItem({
      id: `recycle-${itemId}-${deletedAt}`,
      item: target,
      deletedAt,
      originalLocation: 'Desktop',
      originalPosition: normalizeDesktopIconPosition(iconLayout[itemId]) || appPositions[itemId] || null,
    });
    setCreatedDesktopItems((current) => {
      const nextItems = current.filter(item => item.id !== itemId);
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    if (recycleEntry) {
      setRecycleBinItems((current) => [recycleEntry, ...current]);
    }
    setIconLayout((currentLayout) => {
      const nextLayout = { ...currentLayout };
      delete nextLayout[itemId];
      return nextLayout;
    });
    setOpenCreatedItemId((current) => (current === itemId ? null : current));
    closeCreatedFolderWindow(itemId);
    setRenamingCreatedItemId((current) => (current === itemId ? null : current));
    setCreatedItemRenameDraft((current) => (renamingCreatedItemId === itemId ? '' : current));
    showDesktopNotice(
      target?.kind === 'folder'
        ? (lang === 'en' ? 'Folder moved to Recycle Bin' : '文件夹已移入回收站')
        : (lang === 'en' ? 'Document moved to Recycle Bin' : '文档已移入回收站'),
      target?.label || ''
    );
  }, [appPositions, closeCreatedFolderWindow, createdDesktopItems, iconLayout, lang, renamingCreatedItemId, showDesktopNotice]);

  const handleCreateTextDocumentFromWindow = useCallback((draft = {}) => {
    const id = createDesktopItemId('text');
    const now = Date.now();
    const nextItem = normalizeCreatedDesktopItem({
      id,
      kind: 'text',
      label: String(draft.label || '').trim() || (lang === 'en' ? 'New text document' : '新建文本文档'),
      createdAt: now,
      updatedAt: now,
      content: String(draft.content || ''),
    });
    if (!nextItem) return null;
    rememberIconLayout();
    setCreatedDesktopItems((current) => {
      const nextItems = [...current, nextItem];
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    setOpenCreatedItemId(id);
    showDesktopNotice(
      lang === 'en' ? 'Text document created' : '已新建文本文档',
      nextItem.label
    );
    return id;
  }, [lang, rememberIconLayout, showDesktopNotice]);

  const handleSplitTextDocument = useCallback((itemId, draft = {}) => {
    const id = createDesktopItemId('text');
    const now = Date.now();
    const currentItem = createdDesktopItems.find(item => item.id === itemId);
    const splitLabel = String(draft.label || '').trim()
      || `${currentItem?.label || (lang === 'en' ? 'Text document' : '文本文档')} - ${lang === 'en' ? 'Split' : '拆分'}`;
    const splitItem = normalizeCreatedDesktopItem({
      id,
      kind: 'text',
      label: splitLabel,
      createdAt: now,
      updatedAt: now,
      content: String(draft.content || ''),
    });
    if (!splitItem) return null;
    rememberIconLayout();
    setCreatedDesktopItems((current) => {
      const nextItems = [
        ...current.map((item) => (
          item.id === itemId
            ? normalizeCreatedDesktopItem({
                ...item,
                content: String(draft.remainingContent ?? item.content ?? ''),
                updatedAt: now,
              })
            : item
        )).filter(Boolean),
        splitItem,
      ];
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    setOpenCreatedItemId(id);
    showDesktopNotice(
      lang === 'en' ? 'Document split' : '文档已拆分',
      splitItem.label
    );
    return id;
  }, [createdDesktopItems, lang, rememberIconLayout, showDesktopNotice]);

  const handleMergeTextDocuments = useCallback((itemId, draft = {}) => {
    const mergeSource = createdDesktopItems
      .filter(item => item.kind === 'text' && item.id !== itemId)
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))[0];
    if (!mergeSource) {
      showDesktopNotice(
        lang === 'en' ? 'Nothing to merge' : '没有可合并的文档',
        lang === 'en' ? 'Create or split another text document first.' : '请先新建或拆分另一个文本文档。'
      );
      return null;
    }
    const now = Date.now();
    const currentContent = String(draft.content || '');
    const mergedContent = [
      currentContent.trimEnd(),
      '',
      `--- ${mergeSource.label} ---`,
      '',
      String(mergeSource.content || '').trimStart(),
    ].join('\n');
    const nextLabel = String(draft.label || '').trim() || (lang === 'en' ? 'New text document' : '新建文本文档');
    setCreatedDesktopItems((current) => {
      const nextItems = current
        .filter(item => item.id !== mergeSource.id)
        .map((item) => (
          item.id === itemId
            ? normalizeCreatedDesktopItem({
                ...item,
                label: nextLabel,
                content: mergedContent,
                updatedAt: now,
              })
            : item
        ))
        .filter(Boolean);
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    setIconLayout((currentLayout) => {
      const nextLayout = { ...currentLayout };
      delete nextLayout[mergeSource.id];
      return nextLayout;
    });
    setOpenCreatedItemId(itemId);
    showDesktopNotice(
      lang === 'en' ? 'Documents merged' : '文档已合并',
      mergeSource.label
    );
    return mergedContent;
  }, [createdDesktopItems, lang, showDesktopNotice]);

  const handleOpenFolderApp = useCallback((app) => {
    app.onOpen?.();
  }, []);

  const handleCreateDesktopItem = useCallback((kind) => {
    if (kind !== 'folder' && kind !== 'text') return;
    const id = createDesktopItemId(kind);
    const now = Date.now();
    const config = {
      folder: {
        label: lang === 'en' ? 'New folder' : '新建文件夹',
        kind: 'folder',
        notice: lang === 'en' ? 'Folder created' : '已新建文件夹',
      },
      text: {
        label: lang === 'en' ? 'New text document' : '新建文本文档',
        kind: 'text',
        notice: lang === 'en' ? 'Text document created' : '已新建文本文档',
      },
    }[kind] || {};
    const nextItem = normalizeCreatedDesktopItem({
      id,
      kind: config.kind,
      label: config.label,
      createdAt: now,
      updatedAt: now,
      folderAppIds: [],
      content: '',
    });
    if (!nextItem) return;
    rememberIconLayout();
    setCreatedDesktopItems((current) => {
      const nextItems = [...current, nextItem];
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    if (kind === 'folder') {
      openCreatedFolderWindow(id);
    } else {
      setOpenCreatedItemId(id);
    }
    closeContextMenu();
    showDesktopNotice(
      config.notice || (lang === 'en' ? 'Item created' : '已新建项目'),
      config.label || id
    );
  }, [closeContextMenu, lang, openCreatedFolderWindow, rememberIconLayout, showDesktopNotice]);

  const handleOpenSettingsFromDesktop = useCallback((event) => {
    apps.find(app => app.id === 'settings')?.onOpen?.(event);
    closeContextMenu();
  }, [apps, closeContextMenu]);

  const handleOpenDisplaySettings = useCallback((event) => {
    apps.find(app => app.id === 'settings')?.onOpen?.(event);
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Opened ChatPulse settings' : '已打开 ChatPulse 设置',
      lang === 'en' ? 'Display options are handled inside ChatPulse.' : '显示选项由 ChatPulse 内部设置处理。'
    );
  }, [apps, closeContextMenu, lang, showDesktopNotice]);

  const handleOpenPersonalization = useCallback((event) => {
    apps.find(app => app.id === 'settings')?.onOpen?.(event);
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Opened ChatPulse personalization' : '已打开 ChatPulse 个性化',
      lang === 'en' ? 'Wallpaper and desktop style are handled inside ChatPulse.' : '壁纸和桌面样式由 ChatPulse 内部设置处理。'
    );
  }, [apps, closeContextMenu, lang, showDesktopNotice]);

  const handleOpenDesktopAppById = useCallback((event, appId) => {
    apps.find(app => app.id === appId)?.onOpen?.(event);
    closeContextMenu();
  }, [apps, closeContextMenu]);

  const handleOpenContextApp = useCallback((event) => {
    const targetApp = desktopItems.find(app => app.id === contextMenu?.appId);
    targetApp?.onOpen?.(event);
    closeContextMenu();
  }, [closeContextMenu, contextMenu, desktopItems]);

  const getDesktopGridPositionFromPoint = useCallback((point) => {
    const gridElement = gridRef.current;
    const metrics = getDesktopGridMetrics(gridElement);
    const rect = gridElement?.getBoundingClientRect?.();
    const localX = (Number(point?.x) || 0) - (rect?.left || 0);
    const localY = (Number(point?.y) || 0) - (rect?.top || 0);
    return clampDesktopIconPosition({
      col: (localX - metrics.originX) / metrics.cellX,
      row: (localY - metrics.originY) / metrics.cellY,
    }, metrics, desktopAlignIconsToGrid);
  }, [desktopAlignIconsToGrid]);

  const getAvailableDesktopPosition = useCallback((preferredPosition, excludedId = '') => {
    const used = new Set(Object.entries(appPositions).reduce((keys, [id, position]) => {
      if (id !== excludedId && position) keys.push(`${Math.round(position.col)}:${Math.round(position.row)}`);
      return keys;
    }, []));
    const preferred = normalizeDesktopIconPosition(preferredPosition) || findOpenDesktopIconPosition(used, desktopItems.length);
    const preferredKey = `${Math.round(preferred.col)}:${Math.round(preferred.row)}`;
    return used.has(preferredKey)
      ? findOpenDesktopIconPosition(used, desktopItems.length)
      : preferred;
  }, [appPositions, desktopItems.length]);

  const handleRestoreRecycleBinItem = useCallback((entryId) => {
    const entry = recycleBinItems.find(item => item.id === entryId);
    const restoredItem = normalizeCreatedDesktopItem(entry?.item);
    if (!entry || !restoredItem) return false;
    const existingIds = new Set(createdDesktopItems.map(item => item.id));
    const finalItem = existingIds.has(restoredItem.id)
      ? normalizeCreatedDesktopItem({
          ...restoredItem,
          id: createDesktopItemId(restoredItem.kind),
          label: lang === 'en' ? `${restoredItem.label} copy` : `${restoredItem.label} - 副本`,
        })
      : restoredItem;
    if (!finalItem) return false;
    const position = getAvailableDesktopPosition(entry.originalPosition || undefined, finalItem.id);
    setCreatedDesktopItems((current) => {
      const nextItems = [...current, finalItem];
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    setRecycleBinItems((current) => current.filter(item => item.id !== entryId));
    setIconLayout((currentLayout) => ({
      ...currentLayout,
      [finalItem.id]: position,
    }));
    showDesktopNotice(
      lang === 'en' ? 'Restored from Recycle Bin' : '已从回收站还原',
      finalItem.label
    );
    return true;
  }, [createdDesktopItems, getAvailableDesktopPosition, lang, recycleBinItems, showDesktopNotice]);

  const handleDeleteRecycleBinItem = useCallback((entryId) => {
    const entry = recycleBinItems.find(item => item.id === entryId);
    if (!entry) return false;
    const confirmed = window.confirm(
      lang === 'en'
        ? `Permanently delete "${entry.item.label}"?`
        : `永久删除「${entry.item.label}」？`
    );
    if (!confirmed) return false;
    setRecycleBinItems((current) => current.filter(item => item.id !== entryId));
    showDesktopNotice(
      lang === 'en' ? 'Permanently deleted' : '已永久删除',
      entry.item.label
    );
    return true;
  }, [lang, recycleBinItems, showDesktopNotice]);

  const handleEmptyRecycleBin = useCallback(() => {
    if (!recycleBinItems.length) {
      showDesktopNotice(
        lang === 'en' ? 'Recycle Bin is empty' : '回收站为空',
        ''
      );
      return false;
    }
    const confirmed = window.confirm(
      lang === 'en'
        ? `Permanently delete all ${recycleBinItems.length} item${recycleBinItems.length === 1 ? '' : 's'}?`
        : `永久删除回收站中的 ${recycleBinItems.length} 个项目？`
    );
    if (!confirmed) return false;
    setRecycleBinItems([]);
    showDesktopNotice(
      lang === 'en' ? 'Recycle Bin emptied' : '已清空回收站',
      ''
    );
    return true;
  }, [lang, recycleBinItems.length, showDesktopNotice]);

  const moveAppIntoFolder = useCallback((folderId, appId) => {
    const targetApp = appById.get(appId);
    const targetFolder = createdDesktopItems.find(item => item.id === folderId && item.kind === 'folder');
    if (!targetApp || !targetFolder) return false;

    setCreatedDesktopItems((current) => {
      const nextItems = current.map((item) => {
        if (item.kind !== 'folder') return item;
        const withoutApp = (item.folderAppIds || []).filter(id => id !== appId);
        const folderAppIds = item.id === folderId ? [...withoutApp, appId] : withoutApp;
        return normalizeCreatedDesktopItem({
          ...item,
          folderAppIds,
          updatedAt: Date.now(),
        });
      }).filter(Boolean);
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    setIconLayout((currentLayout) => {
      const nextLayout = { ...currentLayout };
      delete nextLayout[appId];
      return nextLayout;
    });
    showDesktopNotice(
      lang === 'en' ? 'Moved to folder' : '已移入文件夹',
      `${targetApp.label} -> ${targetFolder.label}`
    );
    return true;
  }, [appById, createdDesktopItems, lang, showDesktopNotice]);

  const moveAppFromFolderToDesktop = useCallback((folderId, appId, point) => {
    const targetApp = appById.get(appId);
    const targetFolder = createdDesktopItems.find(item => item.id === folderId && item.kind === 'folder');
    if (!targetApp || !targetFolder) return false;
    const preferredPosition = getDesktopGridPositionFromPoint(point);
    const nextPosition = getAvailableDesktopPosition(preferredPosition, appId);

    setCreatedDesktopItems((current) => {
      const nextItems = current.map((item) => {
        if (item.id !== folderId || item.kind !== 'folder') return item;
        return normalizeCreatedDesktopItem({
          ...item,
          folderAppIds: (item.folderAppIds || []).filter(id => id !== appId),
          updatedAt: Date.now(),
        });
      }).filter(Boolean);
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    setIconLayout((currentLayout) => ({
      ...currentLayout,
      [appId]: nextPosition,
    }));
    showDesktopNotice(
      lang === 'en' ? 'Moved to desktop' : '已移回桌面',
      `${targetApp.label} <- ${targetFolder.label}`
    );
    return true;
  }, [appById, createdDesktopItems, getAvailableDesktopPosition, getDesktopGridPositionFromPoint, lang, showDesktopNotice]);

  const getFolderDropTargetAtPoint = useCallback((point, draggedId = '') => {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const openFolderTargets = [...openFolderWindowIds]
      .filter(id => id !== draggedId && !folderWindowStates[id]?.minimized)
      .sort((leftId, rightId) => (folderWindowStates[rightId]?.zIndex || 0) - (folderWindowStates[leftId]?.zIndex || 0));
    for (const folderId of openFolderTargets) {
      const windowElement = document.querySelector(`[data-desktop-folder-window-id="${folderId}"]`);
      const rect = windowElement?.getBoundingClientRect?.();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return folderId;
      }
    }

    const folders = createdDesktopItems.filter(item => item.kind === 'folder' && item.id !== draggedId);
    for (const folder of folders) {
      const node = document.querySelector(`[data-desktop-app-id="${folder.id}"]`);
      const rect = node?.getBoundingClientRect?.();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return folder.id;
      }
    }
    return null;
  }, [createdDesktopItems, folderWindowStates, openFolderWindowIds]);

  const getRecycleBinDropTargetAtPoint = useCallback((point, draggedId = '') => {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (!createdDesktopItems.some(item => item.id === draggedId)) return null;
    const node = document.querySelector(`[data-desktop-app-id="${DESKTOP_RECYCLE_BIN_ID}"]`);
    const rect = node?.getBoundingClientRect?.();
    return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      ? DESKTOP_RECYCLE_BIN_ID
      : null;
  }, [createdDesktopItems]);

  const getCreatedItemCopyLabel = useCallback((label) => {
    const baseLabel = String(label || '').trim() || (lang === 'en' ? 'New item' : '新建项目');
    return lang === 'en' ? `${baseLabel} copy` : `${baseLabel} - 副本`;
  }, [lang]);

  const getCreatedItemVirtualPath = useCallback((item) => {
    const safeLabel = String(item?.label || '').trim() || (lang === 'en' ? 'New item' : '新建项目');
    return `ChatPulse\\Desktop\\${safeLabel}`;
  }, [lang]);

  const getCreatedItemShareText = useCallback((item) => {
    const typeLabel = item?.kind === 'folder'
      ? (lang === 'en' ? 'Folder' : '文件夹')
      : (lang === 'en' ? 'Text document' : '文本文档');
    return [
      `ChatPulse ${typeLabel}`,
      `${lang === 'en' ? 'Name' : '名称'}: ${item?.label || ''}`,
      `${lang === 'en' ? 'Path' : '地址'}: ${getCreatedItemVirtualPath(item)}`,
    ].join('\n');
  }, [getCreatedItemVirtualPath, lang]);

  const copyDesktopTextToClipboard = useCallback(async (text, fallbackTitle) => {
    const value = String(text || '');
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      window.prompt(fallbackTitle, value);
      return false;
    }
  }, []);

  const handleCutContextCreatedItem = useCallback(() => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    if (!target) {
      closeContextMenu();
      return;
    }
    setDesktopClipboard({ mode: 'cut', itemId });
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Cut' : '已剪切',
      lang === 'en' ? 'Right-click the desktop and choose Paste to move it.' : '右键桌面选择“粘贴”即可移动。'
    );
  }, [closeContextMenu, contextMenu, createdDesktopItems, lang, showDesktopNotice]);

  const handleCopyContextCreatedItem = useCallback(() => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    if (!target) {
      closeContextMenu();
      return;
    }
    setDesktopClipboard({ mode: 'copy', itemId, item: target });
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Copied' : '已复制',
      lang === 'en' ? 'Right-click the desktop and choose Paste to create a copy.' : '右键桌面选择“粘贴”即可创建副本。'
    );
  }, [closeContextMenu, contextMenu, createdDesktopItems, lang, showDesktopNotice]);

  const handleShareContextCreatedItem = useCallback(async () => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    closeContextMenu();
    if (!target) return;
    await copyDesktopTextToClipboard(
      getCreatedItemShareText(target),
      lang === 'en' ? 'Copy share text:' : '复制共享文本：'
    );
    showDesktopNotice(
      lang === 'en' ? 'Share prepared' : '已准备共享',
      lang === 'en' ? 'Share details were copied.' : '共享信息已复制。'
    );
  }, [closeContextMenu, contextMenu, copyDesktopTextToClipboard, createdDesktopItems, getCreatedItemShareText, lang, showDesktopNotice]);

  const handleSendContextCreatedItemToPhone = useCallback(() => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    closeContextMenu();
    if (!target) return;
    try {
      window.localStorage.setItem('chatpulse:desktop-last-phone-send', JSON.stringify({
        id: target.id,
        label: target.label,
        at: Date.now(),
      }));
    } catch (error) {
      console.warn('Failed to store desktop phone send marker:', error);
    }
    showDesktopNotice(
      lang === 'en' ? 'Sent to phone' : '已发送到我的手机',
      target.label
    );
  }, [closeContextMenu, contextMenu, createdDesktopItems, lang, showDesktopNotice]);

  const handleShareContextCreatedObject = useCallback(async () => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    closeContextMenu();
    if (!target) return;
    await copyDesktopTextToClipboard(
      `${getCreatedItemShareText(target)}\nID: ${target.id}`,
      lang === 'en' ? 'Copy shared object:' : '复制共享对象：'
    );
    showDesktopNotice(
      lang === 'en' ? 'Shared object copied' : '共享对象已复制',
      target.label
    );
  }, [closeContextMenu, contextMenu, copyDesktopTextToClipboard, createdDesktopItems, getCreatedItemShareText, lang, showDesktopNotice]);

  const handleFavoriteContextCreatedItem = useCallback(() => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    closeContextMenu();
    if (!target) return;
    setFavoriteCreatedItemIds((current) => {
      const next = new Set(current);
      next.add(itemId);
      return next;
    });
    showDesktopNotice(
      lang === 'en' ? 'Added to favorites' : '已添加到收藏夹',
      target.label
    );
  }, [closeContextMenu, contextMenu, createdDesktopItems, lang, showDesktopNotice]);

  const handleCompressContextCreatedItem = useCallback(() => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    if (!target) {
      closeContextMenu();
      return;
    }

    const id = createDesktopItemId('text');
    const now = Date.now();
    const archiveItem = normalizeCreatedDesktopItem({
      id,
      kind: 'text',
      label: `${target.label}.zip.txt`,
      createdAt: now,
      updatedAt: now,
      content: [
        `Archive: ${target.label}`,
        `Type: ${target.kind}`,
        `Path: ${getCreatedItemVirtualPath(target)}`,
        '',
        target.kind === 'text' ? String(target.content || '') : `Apps: ${(target.folderAppIds || []).join(', ') || '-'}`,
      ].join('\n'),
    });
    const sourcePosition = appPositions[itemId] || getDesktopGridPositionFromPoint(contextMenu);
    const position = getAvailableDesktopPosition({ col: sourcePosition.col + 1, row: sourcePosition.row }, id);
    rememberIconLayout();
    setCreatedDesktopItems((current) => {
      const nextItems = [...current, archiveItem].filter(Boolean);
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    setIconLayout((currentLayout) => ({
      ...currentLayout,
      [id]: position,
    }));
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Compressed' : '已压缩到',
      archiveItem.label
    );
  }, [
    appPositions,
    closeContextMenu,
    contextMenu,
    createdDesktopItems,
    getAvailableDesktopPosition,
    getCreatedItemVirtualPath,
    getDesktopGridPositionFromPoint,
    lang,
    rememberIconLayout,
    showDesktopNotice,
  ]);

  const handleCopyContextCreatedItemPath = useCallback(async () => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    closeContextMenu();
    if (!target) return;
    await copyDesktopTextToClipboard(
      getCreatedItemVirtualPath(target),
      lang === 'en' ? 'Copy path:' : '复制文件地址：'
    );
    showDesktopNotice(
      lang === 'en' ? 'Path copied' : '已复制文件地址',
      getCreatedItemVirtualPath(target)
    );
  }, [closeContextMenu, contextMenu, copyDesktopTextToClipboard, createdDesktopItems, getCreatedItemVirtualPath, lang, showDesktopNotice]);

  const handleSyncContextCreatedItemToOneDrive = useCallback(() => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    closeContextMenu();
    if (!target) return;
    try {
      window.localStorage.setItem(`chatpulse:onedrive-sync:${target.id}`, JSON.stringify({ label: target.label, at: Date.now() }));
    } catch (error) {
      console.warn('Failed to store OneDrive sync marker:', error);
    }
    showDesktopNotice(
      lang === 'en' ? 'OneDrive synced' : 'OneDrive 已同步',
      target.label
    );
  }, [closeContextMenu, contextMenu, createdDesktopItems, lang, showDesktopNotice]);

  const handleSendContextCreatedItemViaQQ = useCallback(async () => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    closeContextMenu();
    if (!target) return;
    await copyDesktopTextToClipboard(
      getCreatedItemShareText(target),
      lang === 'en' ? 'Copy QQ message:' : '复制 QQ 发送内容：'
    );
    showDesktopNotice(
      lang === 'en' ? 'QQ message ready' : 'QQ 发送内容已准备',
      target.label
    );
  }, [closeContextMenu, contextMenu, copyDesktopTextToClipboard, createdDesktopItems, getCreatedItemShareText, lang, showDesktopNotice]);

  const handleShowContextCreatedItemSvn = useCallback(() => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    closeContextMenu();
    if (!target) return;
    showDesktopNotice(
      'TortoiseSVN',
      lang === 'en' ? `Working copy path: ${getCreatedItemVirtualPath(target)}` : `工作副本地址：${getCreatedItemVirtualPath(target)}`
    );
  }, [closeContextMenu, contextMenu, createdDesktopItems, getCreatedItemVirtualPath, lang, showDesktopNotice]);

  const handleEditContextCreatedItemInNotepad = useCallback((event) => {
    const targetApp = desktopItems.find(app => app.id === contextMenu?.appId);
    targetApp?.onOpen?.(event);
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Opened in editor' : '已在记事本中编辑',
      targetApp?.label || ''
    );
  }, [closeContextMenu, contextMenu, desktopItems, lang, showDesktopNotice]);

  const handleRenameContextCreatedItem = useCallback(() => {
    const itemId = contextMenu?.appId;
    if (!itemId || !beginRenameCreatedItem(itemId)) {
      closeContextMenu();
      return;
    }
    closeContextMenu();
  }, [beginRenameCreatedItem, closeContextMenu, contextMenu]);

  const handleDeleteContextCreatedItem = useCallback(() => {
    const itemId = contextMenu?.appId;
    const target = createdDesktopItems.find(item => item.id === itemId);
    if (!target) {
      closeContextMenu();
      return;
    }

    const confirmed = window.confirm(
      target.kind === 'folder'
        ? (lang === 'en' ? `Delete folder "${target.label}"?` : `删除文件夹「${target.label}」？`)
        : (lang === 'en' ? `Delete document "${target.label}"?` : `删除文档「${target.label}」？`)
    );
    closeContextMenu();
    if (!confirmed) return;
    handleDeleteCreatedItem(itemId);
  }, [closeContextMenu, contextMenu, createdDesktopItems, handleDeleteCreatedItem, lang]);

  const handlePasteDesktopClipboard = useCallback(() => {
    if (!desktopClipboard) {
      closeContextMenu();
      return;
    }

    const preferredPosition = getDesktopGridPositionFromPoint(contextMenu);

    if (desktopClipboard.mode === 'cut') {
      const target = createdDesktopItems.find(item => item.id === desktopClipboard.itemId);
      if (!target) {
        setDesktopClipboard(null);
        closeContextMenu();
        showDesktopNotice(
          lang === 'en' ? 'Nothing to paste' : '没有可粘贴的项目',
          lang === 'en' ? 'The original item no longer exists.' : '原项目已经不存在。'
        );
        return;
      }

      const position = getAvailableDesktopPosition(preferredPosition, desktopClipboard.itemId);
      setIconLayout((currentLayout) => ({
        ...currentLayout,
        [desktopClipboard.itemId]: position,
      }));
      setDesktopClipboard(null);
      closeContextMenu();
      showDesktopNotice(
        lang === 'en' ? 'Moved' : '已移动',
        target.label
      );
      return;
    }

    const source = createdDesktopItems.find(item => item.id === desktopClipboard.itemId) || desktopClipboard.item;
    if (!source) {
      setDesktopClipboard(null);
      closeContextMenu();
      return;
    }

    const id = createDesktopItemId(source.kind);
    const now = Date.now();
    const copyItem = normalizeCreatedDesktopItem({
      ...source,
      id,
      label: getCreatedItemCopyLabel(source.label),
      createdAt: now,
      updatedAt: now,
    });
    const position = getAvailableDesktopPosition(preferredPosition, id);

    setCreatedDesktopItems((current) => {
      const nextItems = [...current, copyItem].filter(Boolean);
      saveCreatedDesktopItems(nextItems);
      return nextItems;
    });
    setIconLayout((currentLayout) => ({
      ...currentLayout,
      [id]: position,
    }));
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Pasted copy' : '已粘贴副本',
      copyItem.label
    );
  }, [
    closeContextMenu,
    contextMenu,
    createdDesktopItems,
    desktopClipboard,
    getAvailableDesktopPosition,
    getCreatedItemCopyLabel,
    getDesktopGridPositionFromPoint,
    lang,
    showDesktopNotice,
  ]);

  const handleResetContextAppPosition = useCallback(() => {
    const appId = contextMenu?.appId;
    if (!appId) return;
    rememberIconLayout();
    setIconLayout((currentLayout) => {
      const nextLayout = { ...currentLayout };
      delete nextLayout[appId];
      return nextLayout;
    });
    closeContextMenu();
    showDesktopNotice(
      lang === 'en' ? 'Icon position reset' : '图标位置已重置',
      lang === 'en' ? 'The selected icon returned to its default grid slot.' : '所选图标已回到默认网格位置。'
    );
  }, [closeContextMenu, contextMenu, lang, rememberIconLayout, showDesktopNotice]);

  const handleAppClick = useCallback((event, app) => {
    if (suppressClickRef.current === app.id) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = null;
      return;
    }
    app.onOpen?.(event);
  }, []);

  const handleAppPointerDown = useCallback((event, app) => {
    if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        type: 'app',
        appId: app.id,
        ...getContextMenuPoint(event),
      });
      return;
    }
    if (event.button !== undefined && event.button !== 0) return;
    if (desktopAutoArrange) return;
    if (settleFrameRef.current) {
      window.cancelAnimationFrame(settleFrameRef.current);
      settleFrameRef.current = null;
    }
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setDraggingIcon(null);
    setFolderDropTargetId(null);
    const position = appPositions[app.id] || getDefaultDesktopIconPosition(desktopItems.findIndex(item => item.id === app.id));
    dragRef.current = {
      id: app.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      moved: false,
      position,
      positions: appPositions,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [appPositions, desktopAutoArrange, desktopItems, getContextMenuPoint]);

  const handleAppPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > 5;
    drag.dx = dx;
    drag.dy = dy;
    drag.moved = moved;

    if (moved) {
      event.preventDefault();
      setDraggingIcon({ id: drag.id, dx, dy });
      const point = { x: event.clientX, y: event.clientY };
      const nextTargetId = appById.has(drag.id)
        ? getFolderDropTargetAtPoint(point, drag.id)
        : getRecycleBinDropTargetAtPoint(point, drag.id);
      setFolderDropTargetId((current) => (current === nextTargetId ? current : nextTargetId));
    }
  }, [appById, getFolderDropTargetAtPoint, getRecycleBinDropTargetAtPoint]);

  const finishDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;

    if (!drag.moved) {
      setDraggingIcon(null);
      setFolderDropTargetId(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.type !== 'pointercancel' && appById.has(drag.id)) {
      const targetFolderId = getFolderDropTargetAtPoint({ x: event.clientX, y: event.clientY }, drag.id);
      if (targetFolderId && moveAppIntoFolder(targetFolderId, drag.id)) {
        setDraggingIcon(null);
        setFolderDropTargetId(null);
        suppressClickRef.current = drag.id;
        window.setTimeout(() => {
          if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
        }, 0);
        return;
      }
    }

    if (event.type !== 'pointercancel' && getRecycleBinDropTargetAtPoint({ x: event.clientX, y: event.clientY }, drag.id)) {
      handleDeleteCreatedItem(drag.id);
      setDraggingIcon(null);
      setFolderDropTargetId(null);
      suppressClickRef.current = drag.id;
      window.setTimeout(() => {
        if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
      }, 0);
      return;
    }

    setFolderDropTargetId(null);
    const metrics = getDesktopGridMetrics(gridRef.current);
    const nextPosition = clampDesktopIconPosition({
      col: drag.position.col + (drag.dx / metrics.cellX),
      row: drag.position.row + (drag.dy / metrics.cellY),
    }, metrics, desktopAlignIconsToGrid);
    const settlingOffset = {
      dx: drag.dx - ((nextPosition.col - drag.position.col) * metrics.cellX),
      dy: drag.dy - ((nextPosition.row - drag.position.row) * metrics.cellY),
    };

    setIconLayout((currentLayout) => {
      const nextLayout = { ...currentLayout };
      const targetKey = `${nextPosition.col}:${nextPosition.row}`;
      const occupant = desktopItems.find((app) => {
        if (app.id === drag.id) return false;
        const position = drag.positions[app.id] || normalizeDesktopIconPosition(currentLayout[app.id]);
        return position && `${position.col}:${position.row}` === targetKey;
      });

      nextLayout[drag.id] = nextPosition;
      if (occupant) {
        nextLayout[occupant.id] = drag.position;
      }
      return nextLayout;
    });
    setDraggingIcon({
      id: drag.id,
      dx: settlingOffset.dx,
      dy: settlingOffset.dy,
      settling: 'hold',
    });

    if (settleFrameRef.current) window.cancelAnimationFrame(settleFrameRef.current);
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    settleFrameRef.current = window.requestAnimationFrame(() => {
      settleFrameRef.current = null;
      setDraggingIcon((current) => (
        current?.id === drag.id && current.settling
          ? { ...current, dx: 0, dy: 0, settling: 'animate' }
          : current
      ));
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        setDraggingIcon((current) => (
          current?.id === drag.id && current.settling ? null : current
        ));
      }, 190);
    });

    suppressClickRef.current = drag.id;
    window.setTimeout(() => {
      if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
    }, 0);
  }, [appById, desktopAlignIconsToGrid, desktopItems, getFolderDropTargetAtPoint, getRecycleBinDropTargetAtPoint, handleDeleteCreatedItem, moveAppIntoFolder]);

  const contextMenuApp = contextMenu?.type === 'app'
    ? desktopItems.find(app => app.id === contextMenu.appId)
    : null;
  const contextMenuRecycleBin = contextMenuApp?.id === DESKTOP_RECYCLE_BIN_ID;
  const contextMenuCreatedItem = contextMenuApp?.kind === 'folder' || contextMenuApp?.kind === 'text'
    ? contextMenuApp
    : null;
  const ContextMenuCreatedIcon = contextMenuCreatedItem?.kind === 'folder' ? Folder : FileText;

  return (
    <main
      className={`desktop-home desktop-home--${normalizedWallpaper} ${showWallpaper ? '' : 'desktop-home--wallpaper-hidden'}`}
      aria-label={lang === 'en' ? 'ChatPulse desktop' : 'ChatPulse 桌面'}
      onContextMenu={openDesktopContextMenu}
    >
      {showWallpaper && wallpaperImageSrc && <Live2DDesktopWallpaper src={wallpaperImageSrc} animated={wallpaperAnimated} />}

      {desktopIconsVisible && (
      <section
        ref={gridRef}
        className={[
          'desktop-icon-grid',
          `desktop-icon-grid--${desktopIconSize}`,
          desktopRefreshPulse ? 'is-refreshing' : '',
          desktopRefreshPulse === 1 ? 'desktop-icon-grid--refresh-odd' : '',
          desktopRefreshPulse === 2 ? 'desktop-icon-grid--refresh-even' : '',
        ].filter(Boolean).join(' ')}
        aria-label={lang === 'en' ? 'Desktop apps' : '桌面 App'}
      >
        {desktopItems.map((app, index) => {
          const position = appPositions[app.id] || getDefaultDesktopIconPosition(0);
          const drag = draggingIcon?.id === app.id ? draggingIcon : null;
          return (
            <DesktopAppButton
              key={app.id}
              app={app}
              isDragging={Boolean(drag && !drag.settling)}
              isSettling={Boolean(drag?.settling)}
              settlingPhase={drag?.settling || ''}
              isRenaming={renamingCreatedItemId === app.id}
              isFolderDropTarget={folderDropTargetId === app.id}
              renameValue={renamingCreatedItemId === app.id ? createdItemRenameDraft : ''}
              onRenameChange={setCreatedItemRenameDraft}
              onRenameCommit={(label) => commitRenameCreatedItem(app.id, label)}
              onRenameCancel={cancelRenameCreatedItem}
              style={{
                '--desktop-col': position.col,
                '--desktop-row': position.row,
                '--desktop-drag-x': drag ? `${drag.dx}px` : '0px',
                '--desktop-drag-y': drag ? `${drag.dy}px` : '0px',
                '--desktop-icon-delay': `${index * 28}ms`,
              }}
              onOpen={(event) => handleAppClick(event, app)}
              onPointerDown={(event) => handleAppPointerDown(event, app)}
              onPointerMove={handleAppPointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onContextMenu={(event) => openAppContextMenu(event, app)}
            />
          );
        })}
      </section>
      )}

      {contextMenu && (
        <div
          className={`desktop-context-menu desktop-context-menu--${contextMenu.type} ${contextMenuCreatedItem ? 'desktop-context-menu--created-item' : ''} desktop-context-menu--submenu-${contextMenu.submenuSide || 'right'}`}
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
        >
          {contextMenu.type === 'app' ? (
            contextMenuRecycleBin ? (
              <>
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={(event) => { openRecycleBinWindow(); closeContextMenu(); event.stopPropagation(); }}>
                  <Recycle size={18} />
                  <span>{lang === 'en' ? 'Open' : '打开'}</span>
                </button>
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={() => { closeContextMenu(); handleEmptyRecycleBin(); }}>
                  <Trash2 size={18} />
                  <span>{lang === 'en' ? 'Empty Recycle Bin' : '清空回收站'}</span>
                </button>
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleResetContextAppPosition}>
                  <RefreshCw size={18} />
                  <span>{lang === 'en' ? 'Reset icon position' : '重置图标位置'}</span>
                </button>
              </>
            ) : contextMenuCreatedItem ? (
              <>
                <div className="desktop-context-menu__command-bar" role="group" aria-label={lang === 'en' ? 'Item actions' : '项目操作'}>
                  <button type="button" className="desktop-context-menu__command" onClick={handleCutContextCreatedItem} title={lang === 'en' ? 'Cut' : '剪切'}>
                    <Scissors size={18} />
                    <span>{lang === 'en' ? 'Cut' : '剪切'}</span>
                  </button>
                  <button type="button" className="desktop-context-menu__command" onClick={handleCopyContextCreatedItem} title={lang === 'en' ? 'Copy' : '复制'}>
                    <Copy size={18} />
                    <span>{lang === 'en' ? 'Copy' : '复制'}</span>
                  </button>
                  <button type="button" className="desktop-context-menu__command" onClick={handleRenameContextCreatedItem} title={lang === 'en' ? 'Rename' : '重命名'}>
                    <Pencil size={18} />
                    <span>{lang === 'en' ? 'Rename' : '重命名'}</span>
                  </button>
                  <button type="button" className="desktop-context-menu__command is-danger" onClick={handleDeleteContextCreatedItem} title={lang === 'en' ? 'Delete' : '删除'}>
                    <Trash2 size={18} />
                    <span>{lang === 'en' ? 'Delete' : '删除'}</span>
                  </button>
                </div>
                <span className="desktop-context-menu__separator" />
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleOpenContextApp}>
                  <ContextMenuCreatedIcon size={18} />
                  <span>{lang === 'en' ? 'Open' : '打开'}</span>
                  <kbd>Enter</kbd>
                </button>
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleResetContextAppPosition}>
                  <RefreshCw size={18} />
                  <span>{lang === 'en' ? 'Reset icon position' : '重置图标位置'}</span>
                </button>
              </>
            ) : (
              <>
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleOpenContextApp}>
                  <MessageSquare size={18} />
                  <span>{lang === 'en' ? 'Open' : '打开'}</span>
                </button>
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleResetContextAppPosition}>
                  <RefreshCw size={18} />
                  <span>{lang === 'en' ? 'Reset icon position' : '重置图标位置'}</span>
                </button>
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleOpenSettingsFromDesktop}>
                  <Settings size={18} />
                  <span>{lang === 'en' ? 'Open Settings' : '打开设置'}</span>
                </button>
              </>
            )
          ) : (
            <>
              <div className={`desktop-context-menu__item-wrap ${contextMenu.pinnedSubmenu === 'view' ? 'is-pinned' : ''}`}>
                <button
                  type="button"
                  className="desktop-context-menu__row has-submenu"
                  role="menuitem"
                  onClick={() => setContextMenu((current) => current ? { ...current, pinnedSubmenu: current.pinnedSubmenu === 'view' ? '' : 'view' } : current)}
                >
                  <LayoutGrid size={21} strokeWidth={1.75} />
                  <span>{lang === 'en' ? 'View' : '查看'}</span>
                  <ArrowRight size={16} />
                </button>
                <div className="desktop-context-submenu" role="menu">
                  <button type="button" className={`desktop-context-menu__row ${desktopIconSize === 'large' ? 'is-checked' : ''}`} role="menuitem" onClick={() => handleSetIconSize('large')}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Large icons' : '大图标'}</span>
                    <kbd>Ctrl+Shift+2</kbd>
                  </button>
                  <button type="button" className={`desktop-context-menu__row ${desktopIconSize === 'medium' ? 'is-checked' : ''}`} role="menuitem" onClick={() => handleSetIconSize('medium')}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Medium icons' : '中等图标'}</span>
                    <kbd>Ctrl+Shift+3</kbd>
                  </button>
                  <button type="button" className={`desktop-context-menu__row ${desktopIconSize === 'small' ? 'is-checked' : ''}`} role="menuitem" onClick={() => handleSetIconSize('small')}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Small icons' : '小图标'}</span>
                    <kbd>Ctrl+Shift+4</kbd>
                  </button>
                  <span className="desktop-context-menu__separator" />
                  <button type="button" className={`desktop-context-menu__row ${desktopAutoArrange ? 'is-checked' : ''}`} role="menuitem" onClick={handleToggleAutoArrange}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Auto arrange icons' : '自动排列图标'}</span>
                  </button>
                  <button type="button" className={`desktop-context-menu__row ${desktopAlignIconsToGrid ? 'is-checked' : ''}`} role="menuitem" onClick={handleToggleAlignToGrid}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Align icons to grid' : '将图标与网格对齐'}</span>
                  </button>
                  <button type="button" className={`desktop-context-menu__row ${desktopIconsVisible ? 'is-checked' : ''}`} role="menuitem" onClick={handleToggleDesktopIcons}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Show desktop icons' : '显示桌面图标'}</span>
                  </button>
                </div>
              </div>

              <div className={`desktop-context-menu__item-wrap ${contextMenu.pinnedSubmenu === 'sort' ? 'is-pinned' : ''}`}>
                <button
                  type="button"
                  className="desktop-context-menu__row has-submenu"
                  role="menuitem"
                  onClick={() => setContextMenu((current) => current ? { ...current, pinnedSubmenu: current.pinnedSubmenu === 'sort' ? '' : 'sort' } : current)}
                >
                  <ArrowDownUp size={21} strokeWidth={1.75} />
                  <span>{lang === 'en' ? 'Sort by' : '排序方式'}</span>
                  <ArrowRight size={16} />
                </button>
                <div className="desktop-context-submenu" role="menu">
                  <button type="button" className={`desktop-context-menu__row ${desktopSortKey === 'name' ? 'is-checked' : ''}`} role="menuitem" onClick={() => handleSortIcons('name')}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Name' : '名称'}</span>
                  </button>
                  <button type="button" className={`desktop-context-menu__row ${desktopSortKey === 'status' ? 'is-checked' : ''}`} role="menuitem" onClick={() => handleSortIcons('status')}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Running status' : '运行状态'}</span>
                  </button>
                  <button type="button" className={`desktop-context-menu__row ${desktopSortKey === 'unread' ? 'is-checked' : ''}`} role="menuitem" onClick={() => handleSortIcons('unread')}>
                    <span className="desktop-context-menu__check" />
                    <span>{lang === 'en' ? 'Unread first' : '未读优先'}</span>
                  </button>
                </div>
              </div>

              <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleRefreshDesktop}>
                <RefreshCw size={18} />
                <span>{lang === 'en' ? 'Refresh' : '刷新'}</span>
              </button>
              {desktopClipboard && (
                <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handlePasteDesktopClipboard}>
                  <ClipboardPaste size={18} />
                  <span>{lang === 'en' ? 'Paste' : '粘贴'}</span>
                  <kbd>Ctrl+V</kbd>
                </button>
              )}
              <span className="desktop-context-menu__separator" />
              <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleUndoIconLayout}>
                <Undo2 size={21} strokeWidth={1.75} />
                <span>{lang === 'en' ? 'Undo Delete' : '撤消 删除'}</span>
                <kbd>Ctrl+Z</kbd>
              </button>

              <div className={`desktop-context-menu__item-wrap ${contextMenu.pinnedSubmenu === 'new' ? 'is-pinned' : ''}`}>
                <button
                  type="button"
                  className="desktop-context-menu__row has-submenu"
                  role="menuitem"
                  onClick={() => setContextMenu((current) => current ? { ...current, pinnedSubmenu: current.pinnedSubmenu === 'new' ? '' : 'new' } : current)}
                >
                  <CirclePlus size={21} strokeWidth={1.75} />
                  <span>{lang === 'en' ? 'New' : '新建'}</span>
                  <ArrowRight size={16} />
                </button>
                <div className="desktop-context-submenu" role="menu">
                  <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={() => handleCreateDesktopItem('folder')}>
                    <FolderPlus size={19} />
                    <span>{lang === 'en' ? 'Folder' : '文件夹'}</span>
                  </button>
                  <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={() => handleCreateDesktopItem('text')}>
                    <FileText size={19} />
                    <span>{lang === 'en' ? 'Text Document' : '文本文档'}</span>
                  </button>
                </div>
              </div>

              <span className="desktop-context-menu__separator" />
              <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleOpenDisplaySettings}>
                <MonitorCog size={21} strokeWidth={1.75} />
                <span>{lang === 'en' ? 'Display settings' : '显示设置'}</span>
              </button>
              <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={handleOpenPersonalization}>
                <Paintbrush size={21} strokeWidth={1.75} />
                <span>{lang === 'en' ? 'Personalize' : '个性化'}</span>
              </button>
              <span className="desktop-context-menu__separator" />
              <button
                type="button"
                className="desktop-context-menu__row"
                role="menuitem"
                onClick={() => setContextMenu((current) => current ? { ...current, showMore: !current.showMore } : current)}
              >
                <ListPlus size={21} strokeWidth={1.75} />
                <span>{lang === 'en' ? 'Show more options' : '显示更多选项'}</span>
              </button>
              {contextMenu.showMore && (
                <>
                  <span className="desktop-context-menu__separator" />
                  <button type="button" className="desktop-context-menu__row" role="menuitem" onClick={() => handleArrangeIcons()}>
                    <RefreshCw size={18} />
                    <span>{lang === 'en' ? 'Reset all icon positions' : '重置全部图标位置'}</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {openFolderWindowIds.map((folderId, index) => {
        const folderItem = createdDesktopItems.find(item => item.id === folderId && item.kind === 'folder');
        if (!folderItem) return null;
        const windowState = folderWindowStates[folderId] || {
          geometry: getDefaultFolderWindowGeometry(index),
          minimized: false,
          maximized: false,
          zIndex: 82 + index,
        };
        return (
          <DesktopFolderWindow
            key={folderId}
            item={folderItem}
            apps={apps}
            lang={lang}
            active={activeFolderWindowId === folderId}
            geometry={windowState.geometry}
            maximized={Boolean(windowState.maximized)}
            minimized={Boolean(windowState.minimized)}
            minimizedIndex={index}
            zIndex={windowState.zIndex || 82}
            onActivate={() => bringFolderWindowToFront(folderId)}
            onClose={() => closeCreatedFolderWindow(folderId)}
            onGeometryChange={(geometry) => setFolderWindowGeometry(folderId, geometry)}
            onMaximizeToggle={() => toggleFolderWindowMaximized(folderId)}
            onMinimize={() => minimizeFolderWindow(folderId)}
            onRestore={() => restoreFolderWindow(folderId)}
            onMoveAppToDesktop={(appId, point) => moveAppFromFolderToDesktop(folderId, appId, point)}
            onAddAppToFolder={(appId) => moveAppIntoFolder(folderId, appId)}
            onOpenApp={handleOpenFolderApp}
            isDropTarget={folderDropTargetId === folderId}
          />
        );
      })}

      {recycleBinWindowOpen && (
        <DesktopRecycleBinWindow
          entries={recycleBinItems}
          lang={lang}
          active={activeFolderWindowId === DESKTOP_RECYCLE_BIN_ID}
          geometry={recycleBinWindowState.geometry}
          maximized={Boolean(recycleBinWindowState.maximized)}
          minimized={Boolean(recycleBinWindowState.minimized)}
          zIndex={recycleBinWindowState.zIndex || 84}
          onActivate={bringRecycleBinWindowToFront}
          onClose={closeRecycleBinWindow}
          onGeometryChange={(geometry) => setRecycleBinWindowState((current) => ({
            ...current,
            geometry: clampFolderWindowGeometry(geometry),
          }))}
          onMaximizeToggle={() => {
            const nextZIndex = allocateFolderWindowZIndex();
            setActiveFolderWindowId(DESKTOP_RECYCLE_BIN_ID);
            setRecycleBinWindowState((current) => ({
              ...current,
              maximized: !current.maximized,
              minimized: false,
              zIndex: nextZIndex,
            }));
          }}
          onMinimize={() => {
            setRecycleBinWindowState((current) => ({ ...current, minimized: true }));
            setActiveFolderWindowId((current) => (current === DESKTOP_RECYCLE_BIN_ID ? null : current));
          }}
          onRestore={bringRecycleBinWindowToFront}
          onRestoreEntry={handleRestoreRecycleBinItem}
          onDeleteEntry={handleDeleteRecycleBinItem}
          onEmptyRecycleBin={handleEmptyRecycleBin}
        />
      )}

      {openCreatedItem?.kind === 'text' && (
        <DesktopTextDocumentWindow
          item={openCreatedItem}
          lang={lang}
          mergeCandidateCount={createdDesktopItems.filter(item => item.kind === 'text' && item.id !== openCreatedItem.id).length}
          onClose={() => setOpenCreatedItemId(null)}
          onSave={(draft) => handleSaveTextDocument(openCreatedItem.id, draft)}
          onDelete={() => handleDeleteCreatedItem(openCreatedItem.id)}
          onCreateNew={() => handleCreateTextDocumentFromWindow()}
          onSplitDocument={(draft) => handleSplitTextDocument(openCreatedItem.id, draft)}
          onMergeDocuments={(draft) => handleMergeTextDocuments(openCreatedItem.id, draft)}
        />
      )}

    </main>
  );
}

export default ChatPulseDesktop;
