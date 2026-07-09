import React, { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import ContactList from './components/ContactList';
import ChatWindow from './components/ChatWindow';
import PrivateChatJournalPanel from './components/PrivateChatJournalPanel';
import Live2DDesktopWallpaper from './components/Live2DDesktopWallpaper';

import './App.css';
import './styles/desktop.css';
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  ArrowDownUp,
  Archive,
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
  CloudFog,
  CloudLightning,
  CloudRain,
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
  LogOut,
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
  RefreshCw,
  Recycle,
  Save,
  Search,
  Send,
  Settings,
  Scissors,
  Share2,
  Smartphone,
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
  Upload,
  UsersRound,
  UserPlus,
  Volume2,
  VolumeX,
  Wand2,
  Wind,
  Wrench,
  Wifi,
  X
} from 'lucide-react';
import { plugins } from './plugins';
import { useLanguage } from './LanguageContext';
import { useAuth } from './AuthContext';
import Login from './components/Login';
import AvatarWithFrame from './components/AvatarWithFrame';
import { defaultAvatarUrl, resolveAvatarUrl } from './utils/avatar';
import ChatPulseDesktop from './desktop/ChatPulseDesktop';
import DesktopTaskbar from './desktop/DesktopTaskbar';
import {
  DESKTOP_ALIGN_TO_GRID_STORAGE_KEY,
  DESKTOP_APP_ICONS,
  DESKTOP_AUTO_ARRANGE_STORAGE_KEY,
  DESKTOP_EVENT_NOTIFICATION_LIMIT,
  DESKTOP_ICON_SIZE_STORAGE_KEY,
  DESKTOP_ICONS_VISIBLE_STORAGE_KEY,
  DESKTOP_MULTI_WINDOW_APP_TABS,
  DESKTOP_NOTIFICATION_TOAST_LIMIT,
  DESKTOP_NOTIFICATION_TOAST_TTL_MS,
  DESKTOP_RECYCLE_BIN_ID,
  DESKTOP_TAB_DETACH_OFFSET,
  DESKTOP_TAB_DRAG_THRESHOLD,
  DESKTOP_TASKBAR_HEIGHT,
  DESKTOP_WALLPAPER_IMAGE_URLS,
  DESKTOP_WALLPAPER_OPTIONS,
  DESKTOP_WALLPAPER_STORAGE_KEY,
  DESKTOP_WIDGET_IMAGES,
  DESKTOP_WINDOW_CHROME_HEIGHT,
  DESKTOP_WINDOW_MIN_HEIGHT,
  DESKTOP_WINDOW_MIN_WIDTH,
  TASKBAR_APP_ICON_BY_ID,
  TASKBAR_APP_ICONS,
  buildDesktopCalendarDays,
  clampDesktopIconPosition,
  createDesktopItemId,
  findOpenDesktopIconPosition,
  formatDesktopDateTime,
  formatDesktopMonthTitle,
  formatDesktopPanelDate,
  formatPomodoroTime,
  getBrowserSnapshotFields,
  getCurrentDesktopWeatherEvent,
  getDefaultDesktopIconPosition,
  getDesktopAppSurfaceClass,
  getDesktopGridMetrics,
  getDesktopLunarInfo,
  getDesktopNotificationPreview,
  getDesktopWeatherVisual,
  getResponsiveBrowserChromeHeight,
  isSameDesktopDate,
  loadCreatedDesktopItems,
  loadDesktopIconLayout,
  loadDesktopStoredBoolean,
  loadDesktopStoredChoice,
  loadDesktopWallpaper,
  loadRecycleBinItems,
  normalizeCreatedDesktopItem,
  normalizeDesktopIconPosition,
  normalizeDesktopWallpaper,
  saveCreatedDesktopItems,
  saveDesktopIconLayout,
  saveDesktopStoredPreference,
  saveRecycleBinItems,
} from './desktop/desktopUtils';

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

function isLikelyModuleLoadError(error) {
  const message = String(error?.message || error || '');
  return /Unable to preload CSS|Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|error loading dynamically imported module|Loading chunk \d+ failed/i.test(message);
}

function getModuleLoadErrorSignature(error) {
  const message = String(error?.message || error || 'Unknown error');
  const assetUrl = message.match(/https?:\/\/[^\s)]+|\/assets\/[^\s)]+/i)?.[0];
  return (assetUrl || message.slice(0, 180)).replace(/[^\w:./-]+/g, '_').slice(0, 220);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clearRetiredThemeOverrides() {
  try {
    RETIRED_THEME_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear retired theme storage:', error);
  }

  const root = document.documentElement;
  root.removeAttribute('data-theme');
  RETIRED_THEME_CSS_VARS.forEach(key => root.style.removeProperty(key));
  document.getElementById('chatpulse-custom-css')?.remove();
}

function lazyWithPreload(factory) {
  let loadPromise = null;
  const loadWithRetry = async (attempt = 0) => {
    try {
      return await factory();
    } catch (error) {
      if (!isLikelyModuleLoadError(error) || attempt >= MODULE_LOAD_RETRY_LIMIT) {
        throw error;
      }
      const delay = Math.min(MODULE_LOAD_RETRY_MAX_MS, MODULE_LOAD_RETRY_BASE_MS * (attempt + 1));
      console.warn(`[lazy] Module is still loading; retrying in ${delay}ms.`, error);
      await wait(delay);
      return loadWithRetry(attempt + 1);
    }
  };
  const load = () => {
    if (!loadPromise) {
      loadPromise = loadWithRetry().catch((error) => {
        loadPromise = null;
        console.warn('[lazy] Failed to load module:', error);
        throw error;
      });
    }
    return loadPromise;
  };
  const Component = lazy(load);
  Component.preload = () => load().catch((error) => {
    console.warn('[lazy] Preload failed:', error);
    return null;
  });
  return Component;
}

const GroupChatWindow = lazyWithPreload(() => import('./components/GroupChatWindow'));
const GroupManageDrawer = lazyWithPreload(() => import('./components/GroupChatWindow').then(module => ({ default: module.GroupManageDrawer })));
const CreateGroupModal = lazyWithPreload(() => import('./components/CreateGroupModal'));
const AddCharacterModal = lazyWithPreload(() => import('./components/AddCharacterModal'));
const MemoTable = lazyWithPreload(() => import('./components/MemoTable'));
const DiaryTable = lazyWithPreload(() => import('./components/DiaryTable'));
const SettingsPanel = lazyWithPreload(() => import('./components/SettingsPanel'));
const ChatSettingsDrawer = lazyWithPreload(() => import('./components/ChatSettingsDrawer'));
const MemoryLibraryPanel = lazyWithPreload(() => import('./components/MemoryLibraryPanel'));

const PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY = 'chatpulse:private-chat-foreground-enabled';
const PRIVATE_CHAT_FOREGROUND_EXIT_MS = 960;
const PRIVATE_CHAT_DECOR_STORAGE_KEY = 'chatpulse:private-chat-decor-adjustments:v8';
const PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY = 'chatpulse:private-chat-decor-editor-open';
const PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY = 'chatpulse:private-chat-foreground-person:v1';
const PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT = { x: 0, y: 0, direction: 'front', frame: 0 };
const PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES = {
  front: [
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/front_walk_idle.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/front_walk_step_a.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/front_walk_passing.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/front_walk_step_b.png?v=20260702',
  ],
  back: [
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/back_walk_idle.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/back_walk_step_a.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/back_walk_passing.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/back_walk_step_b.png?v=20260702',
  ],
  left: [
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/left_walk_idle.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/left_walk_step_a.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/left_walk_passing.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/left_walk_step_b.png?v=20260702',
  ],
  right: [
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/right_walk_idle.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/right_walk_step_a.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/right_walk_passing.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/right_walk_step_b.png?v=20260702',
  ],
};

const PRIVATE_CHAT_DECOR_DEFAULTS = {
  floor: { x: 28, y: 94, scale: 1.18 },
  left: { x: 12, y: 11, scale: 0.91 },
  right: { x: -7, y: 32, scale: 0.79 },
};
const PRIVATE_CHAT_DECOR_TARGETS = [
  { id: 'floor', label: '地板', labelEn: 'Floor', selector: '[data-private-decor-id="floor"]' },
  { id: 'left', label: '左素材', labelEn: 'Left Decor', selector: '[data-private-decor-id="left"]' },
  { id: 'right', label: '右素材', labelEn: 'Right Decor', selector: '[data-private-decor-id="right"]' },
];

function getPrivateDecorTargetLabel(target, lang = 'zh') {
  return lang === 'en' ? (target.labelEn || target.label) : target.label;
}

function loadPrivateChatForegroundEnabled() {
  try {
    return window.localStorage.getItem(PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY) !== '0';
  } catch (error) {
    console.warn('Failed to load private chat foreground preference:', error);
    return true;
  }
}

function clampDecorScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(3, Math.max(0.25, parsed));
}

function normalizeDecorTransform(transform) {
  return {
    x: Number.isFinite(Number(transform?.x)) ? Number(transform.x) : 0,
    y: Number.isFinite(Number(transform?.y)) ? Number(transform.y) : 0,
    scale: clampDecorScale(transform?.scale ?? 1),
  };
}

function normalizeForegroundPersonPosition(position) {
  const x = Number.isFinite(Number(position?.x)) ? Number(position.x) : PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT.x;
  const y = Number.isFinite(Number(position?.y)) ? Number(position.y) : PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT.y;
  const direction = Object.prototype.hasOwnProperty.call(PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES, position?.direction)
    ? position.direction
    : PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT.direction;
  const frame = Number.isFinite(Number(position?.frame)) ? Number(position.frame) : PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT.frame;
  return {
    x: Math.max(-560, Math.min(560, x)),
    y: Math.max(-180, Math.min(48, y)),
    direction,
    frame: Math.max(0, Math.min(3, Math.round(frame))),
  };
}

function loadPrivateChatForegroundPersonPosition() {
  try {
    const raw = window.localStorage.getItem(PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY);
    if (!raw) return PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT;
    return normalizeForegroundPersonPosition(JSON.parse(raw));
  } catch (error) {
    console.warn('Failed to load private chat foreground person position:', error);
    return PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT;
  }
}

function savePrivateChatForegroundPersonPosition(position) {
  window.localStorage.setItem(
    PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY,
    JSON.stringify(normalizeForegroundPersonPosition(position)),
  );
}

function loadPrivateChatDecorTransforms() {
  try {
    const raw = window.localStorage.getItem(PRIVATE_CHAT_DECOR_STORAGE_KEY);
    if (!raw) return PRIVATE_CHAT_DECOR_DEFAULTS;
    const parsed = JSON.parse(raw);
    return Object.fromEntries(
      PRIVATE_CHAT_DECOR_TARGETS.map(({ id }) => [
        id,
        normalizeDecorTransform(parsed?.[id] || PRIVATE_CHAT_DECOR_DEFAULTS[id]),
      ])
    );
  } catch (error) {
    console.warn('Failed to load private chat decor adjustments:', error);
    return PRIVATE_CHAT_DECOR_DEFAULTS;
  }
}

function isDecorTransformDefault(id, transform) {
  const current = normalizeDecorTransform(transform);
  const defaults = normalizeDecorTransform(PRIVATE_CHAT_DECOR_DEFAULTS[id]);
  return Math.round((current.x - defaults.x) * 100) === 0
    && Math.round((current.y - defaults.y) * 100) === 0
    && Math.round((current.scale - defaults.scale) * 1000) === 0;
}

function buildDecorCssSnippet(transforms) {
  const selectorMap = {
    floor: '.private-chat-scene-decor__floor',
    left: '.private-chat-scene-decor__left',
    right: '.private-chat-scene-decor__right',
  };

  return PRIVATE_CHAT_DECOR_TARGETS.map(({ id, label }) => {
    const transform = normalizeDecorTransform(transforms[id]);
    return [
      `/* ${label} */`,
      `${selectorMap[id]} {`,
      `  --decor-x: ${Math.round(transform.x)}px;`,
      `  --decor-y: ${Math.round(transform.y)}px;`,
      `  --decor-scale: ${Number(transform.scale.toFixed(3))};`,
      `}`,
    ].join('\n');
  }).join('\n\n');
}

function hasPrimaryModelConfig(contact = {}) {
  return Boolean(
    String(contact.api_endpoint || '').trim()
    && contact.api_key_configured === true
    && String(contact.model_name || '').trim()
  );
}

function PrivateChatDecorEditor({
  open,
  onOpenChange,
  transforms,
  setTransforms,
  isPrivateChatView,
  lang = 'zh',
}) {
  const [selectedId, setSelectedId] = useState('floor');
  const [boxes, setBoxes] = useState({});
  const [copyStatus, setCopyStatus] = useState('');
  const dragRef = useRef(null);

  const selectedTransform = normalizeDecorTransform(transforms[selectedId]);

  const measureDecor = useCallback(() => {
    if (!isPrivateChatView) return;
    const root = document.querySelector('.app-container.has-private-chat');
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const nextBoxes = {};
    PRIVATE_CHAT_DECOR_TARGETS.forEach((target) => {
      const element = root.querySelector(target.selector);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      nextBoxes[target.id] = {
        left: rect.left - rootRect.left,
        top: rect.top - rootRect.top,
        width: rect.width,
        height: rect.height,
      };
    });
    setBoxes(nextBoxes);
  }, [isPrivateChatView]);

  useEffect(() => {
    if (!open || !isPrivateChatView) return undefined;
    const rafId = window.requestAnimationFrame(measureDecor);
    const timeoutId = window.setTimeout(measureDecor, 120);
    window.addEventListener('resize', measureDecor);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', measureDecor);
    };
  }, [open, isPrivateChatView, transforms, measureDecor]);

  useEffect(() => {
    if (!copyStatus) return undefined;
    const timeoutId = window.setTimeout(() => setCopyStatus(''), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const updateTransform = useCallback((id, patch) => {
    setTransforms((prev) => ({
      ...prev,
      [id]: normalizeDecorTransform({
        ...(prev[id] || PRIVATE_CHAT_DECOR_DEFAULTS[id]),
        ...patch,
      }),
    }));
  }, [setTransforms]);

  const startDrag = useCallback((event, id) => {
    event.preventDefault();
    setSelectedId(id);
    const base = normalizeDecorTransform(transforms[id]);
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      base,
    };

    const handlePointerMove = (moveEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      updateTransform(drag.id, {
        x: drag.base.x + (moveEvent.clientX - drag.startX),
        y: drag.base.y + (moveEvent.clientY - drag.startY),
      });
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [transforms, updateTransform]);

  const handleWheelScale = useCallback((event, id) => {
    event.preventDefault();
    setSelectedId(id);
    const current = normalizeDecorTransform(transforms[id]);
    const step = event.shiftKey ? 0.02 : 0.06;
    updateTransform(id, {
      scale: current.scale + (event.deltaY > 0 ? -step : step),
    });
  }, [transforms, updateTransform]);

  const resetDecor = useCallback((id) => {
    updateTransform(id, PRIVATE_CHAT_DECOR_DEFAULTS[id]);
  }, [updateTransform]);

  const resetAllDecor = useCallback(() => {
    setTransforms(PRIVATE_CHAT_DECOR_DEFAULTS);
    window.localStorage.removeItem(PRIVATE_CHAT_DECOR_STORAGE_KEY);
  }, [setTransforms]);

  const copyDecorCss = useCallback(async () => {
    const snippet = buildDecorCssSnippet(transforms);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyStatus(lang === 'en' ? 'CSS copied' : '已复制 CSS');
    } catch (error) {
      console.warn('Failed to copy private chat decor CSS:', error);
      window.prompt(lang === 'en' ? 'Copy these CSS variables:' : '复制这些 CSS 变量：', snippet);
      setCopyStatus(lang === 'en' ? 'Copy prompt opened' : '已弹出复制框');
    }
  }, [lang, transforms]);

  if (!isPrivateChatView) return null;

  return (
    <>
      {open && (
        <div className="private-decor-editor" aria-label={lang === 'en' ? 'Private chat asset debug panel' : '私聊素材调试面板'}>
          <div className="private-decor-editor__stage">
            {PRIVATE_CHAT_DECOR_TARGETS.map((target) => {
              const box = boxes[target.id];
              if (!box) return null;
              return (
                <button
                  key={target.id}
                  type="button"
                  className={`private-decor-editor__box ${selectedId === target.id ? 'is-selected' : ''}`}
                  style={{
                    left: `${box.left}px`,
                    top: `${box.top}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                  }}
                  onPointerDown={(event) => startDrag(event, target.id)}
                  onWheel={(event) => handleWheelScale(event, target.id)}
                  title={lang === 'en' ? `${getPrivateDecorTargetLabel(target, lang)}: drag to move, wheel to scale` : `${getPrivateDecorTargetLabel(target, lang)}：拖动移动，滚轮缩放`}
                >
                  <span>{getPrivateDecorTargetLabel(target, lang)}</span>
                </button>
              );
            })}
          </div>
          <div className="private-decor-editor__panel">
            <div className="private-decor-editor__header">
              <strong>{lang === 'en' ? 'Asset Debug' : '素材调试'}</strong>
              <button type="button" onClick={() => onOpenChange(false)} aria-label={lang === 'en' ? 'Close asset debug' : '关闭素材调试'}>
                <X size={16} />
              </button>
            </div>
            <div className="private-decor-editor__hint">{lang === 'en' ? 'Drag the selected box to move, wheel to scale, Shift + wheel for fine tuning.' : '拖动选中框移动，滚轮缩放，Shift + 滚轮细调。'}</div>
            <div className="private-decor-editor__tabs">
              {PRIVATE_CHAT_DECOR_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className={selectedId === target.id ? 'is-selected' : ''}
                  onClick={() => setSelectedId(target.id)}
                >
                  {getPrivateDecorTargetLabel(target, lang)}
                </button>
              ))}
            </div>
            <div className="private-decor-editor__fields">
              <label>
                X
                <input
                  type="number"
                  value={Math.round(selectedTransform.x)}
                  onChange={(event) => updateTransform(selectedId, { x: Number(event.target.value) })}
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={Math.round(selectedTransform.y)}
                  onChange={(event) => updateTransform(selectedId, { y: Number(event.target.value) })}
                />
              </label>
              <label>
                {lang === 'en' ? 'Scale' : '缩放'}
                <input
                  type="number"
                  min="0.25"
                  max="3"
                  step="0.05"
                  value={Number(selectedTransform.scale.toFixed(2))}
                  onChange={(event) => updateTransform(selectedId, { scale: Number(event.target.value) })}
                />
              </label>
            </div>
            <div className="private-decor-editor__actions">
              <button type="button" onClick={() => resetDecor(selectedId)}>{lang === 'en' ? 'Reset Current' : '重置当前'}</button>
              <button type="button" onClick={resetAllDecor}>{lang === 'en' ? 'Clear All' : '全部清空'}</button>
              <button type="button" onClick={copyDecorCss}>{lang === 'en' ? 'Copy CSS' : '复制 CSS'}</button>
            </div>
            {copyStatus && <div className="private-decor-editor__status">{copyStatus}</div>}
          </div>
        </div>
      )}
    </>
  );
}

function PanelFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a8f98', fontSize: '13px' }}>
      Loading...
    </div>
  );
}

function DrawerFallback({ type = 'settings', contact, lang = 'zh', onClose }) {
  const contactName = contact?.name || (lang === 'en' ? 'Character' : '角色');
  if (type === 'memo') {
    return (
      <aside className="drawer-container memory-drawer memory-table-drawer drawer-loading-fallback">
        <div className="memory-header">
          <h3>{contactName} {lang === 'en' ? "'s Memories" : '的记忆'}</h3>
        </div>
        <div className="memory-content">
          <p className="loading-text">{lang === 'en' ? 'Loading memories...' : '加载记忆中...'}</p>
        </div>
      </aside>
    );
  }
  if (type === 'diary') {
    return (
      <aside className="memory-drawer diary-drawer drawer-loading-fallback diary">
        <div className="memory-header" style={{ backgroundColor: '#f6f1e3', borderBottomColor: '#e0d8c3' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5a4d3c' }}>
            <BookOpen size={18} />
            {contactName} {lang === 'en' ? "'s Diary" : '的日记'}
          </h3>
        </div>
        <div className="memory-list" style={{ padding: '20px' }}>
          <div className="placeholder-text">{lang === 'en' ? 'Loading...' : '加载中...'}</div>
        </div>
      </aside>
    );
  }
  return (
    <aside className="memory-drawer chat-settings-drawer drawer-loading-fallback">
      <div className="memory-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} />
          {lang === 'en' ? 'Chat Settings' : '聊天设置'}
        </h3>
      </div>
      <div className="memory-content">
        <p className="loading-text">{lang === 'en' ? 'Loading settings...' : '加载设置中...'}</p>
      </div>
    </aside>
  );
}

function PrivateChatDrawerShell({ type, children }) {
  return (
    <div className="private-chat-drawer-shell" data-drawer-type={type}>
      <div className="private-chat-drawer-shell__content">
        {children}
      </div>
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, autoReloading: false };
    this.autoReloadTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { error, autoReloading: true };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] UI crashed:', error, info);
    this.scheduleModuleAutoRetry(error);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.clearAutoReloadTimer();
      this.setState({ error: null, autoReloading: false });
    }
  }

  componentWillUnmount() {
    this.clearAutoReloadTimer();
  }

  clearAutoReloadTimer = () => {
    if (this.autoReloadTimer) {
      clearTimeout(this.autoReloadTimer);
      this.autoReloadTimer = null;
    }
  };

  getAutoRetryStorageKey = (error) => {
    const resetKey = String(this.props.resetKey || 'boundary');
    return `${MODULE_LOAD_AUTO_RETRY_PREFIX}${resetKey}:${getModuleLoadErrorSignature(error)}`;
  };

  scheduleModuleAutoRetry = (error) => {
    if (this.autoReloadTimer) return;
    if (typeof window === 'undefined') {
      this.setState({ autoReloading: true });
      return;
    }

    let storage = null;
    try {
      storage = window.sessionStorage;
    } catch {
      this.setState({ autoReloading: true });
      this.autoReloadTimer = window.setTimeout(() => {
        this.autoReloadTimer = null;
        this.retry();
      }, MODULE_LOAD_AUTO_RETRY_DELAY_MS);
      return;
    }
    if (!storage) {
      this.setState({ autoReloading: true });
      this.autoReloadTimer = window.setTimeout(() => {
        this.autoReloadTimer = null;
        this.retry();
      }, MODULE_LOAD_AUTO_RETRY_DELAY_MS);
      return;
    }

    const storageKey = this.getAutoRetryStorageKey(error);
    try {
      if (storage.getItem(storageKey) === '1') {
        this.setState({ autoReloading: true });
        this.autoReloadTimer = window.setTimeout(() => {
          this.autoReloadTimer = null;
          this.retry();
        }, MODULE_LOAD_AUTO_RETRY_DELAY_MS + 1000);
        return;
      }
      storage.setItem(storageKey, '1');
    } catch {
      this.setState({ autoReloading: true });
      this.autoReloadTimer = window.setTimeout(() => {
        this.autoReloadTimer = null;
        this.retry();
      }, MODULE_LOAD_AUTO_RETRY_DELAY_MS);
      return;
    }

    this.setState({ autoReloading: true });
    this.autoReloadTimer = window.setTimeout(() => {
      this.autoReloadTimer = null;
        this.retry();
    }, MODULE_LOAD_AUTO_RETRY_DELAY_MS);
  };

  retry = () => {
    this.clearAutoReloadTimer();
    this.setState({ error: null, autoReloading: false });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const isDrawer = this.props.variant === 'drawer';
    const Wrapper = isDrawer ? 'aside' : 'div';

    return (
      <Wrapper
        className={isDrawer ? 'memory-drawer drawer-loading-fallback drawer-loading-fallback--silent' : 'panel-error-state panel-loading-state panel-loading-state--silent'}
        aria-hidden="true"
        style={{
          width: isDrawer ? 'var(--private-chat-drawer-width, 360px)' : '100%',
          minWidth: 0,
          flex: isDrawer ? '0 0 var(--private-chat-drawer-width, 360px)' : 1,
          height: '100%',
          boxSizing: 'border-box',
          display: 'block',
          padding: 0,
          background: 'transparent',
          borderLeft: isDrawer ? '1px solid transparent' : 'none',
          pointerEvents: 'none'
        }}
      />
    );
  }
}

const getDefaultBrowserWindowGeometry = (sequence = 0) => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
  const stackIndex = Math.max(0, sequence - 1);
  const width = Math.min(
    Math.max(420, viewportWidth - 48),
    1280,
    Math.max(900, Math.round(viewportWidth * 0.72))
  );
  const height = Math.min(
    Math.max(320, viewportHeight - taskbarHeight - 24),
    780,
    Math.max(560, viewportHeight - taskbarHeight - 118)
  );
  const maxX = Math.max(18, viewportWidth - width - 22);
  const maxY = Math.max(18, viewportHeight - height - taskbarHeight - 18);
  return {
    x: Math.min(maxX, Math.max(18, Math.round((viewportWidth - width) / 2) + (stackIndex % 4) * 32)),
    y: Math.min(maxY, 54 + (stackIndex % 3) * 28),
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
  const [activeTab, setActiveTab] = useState('desktop'); // 'desktop', 'chats', 'contacts', 'settings'
  const [activeContactId, setActiveContactId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactsLoadError, setContactsLoadError] = useState('');
  const [activeContactSnapshot, setActiveContactSnapshot] = useState(null);

  const [incomingMessageQueue, setIncomingMessageQueue] = useState([]);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'memo', 'diary', 'settings', 'group-manage', or null
  const [userProfile, setUserProfile] = useState(() => authUser || null);
  const [isLoaded, setIsLoaded] = useState(() => !!token);
  const [engineState, setEngineState] = useState({});
  const [showAddCharModal, setShowAddCharModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [incomingGroupMessageQueue, setIncomingGroupMessageQueue] = useState([]);
  const [groupUnreadCounts, setGroupUnreadCounts] = useState({});
  const [desktopEventNotifications, setDesktopEventNotifications] = useState([]);
  const [desktopToastNotifications, setDesktopToastNotifications] = useState([]);
  const [groupTyping, setGroupTyping] = useState({}); // { groupId: [{ sender_id, name }, ...] }
  const [globalAnnouncement, setGlobalAnnouncement] = useState(null);
  const [groupChatEnabled, setGroupChatEnabled] = useState(false); // Auto-detected: true if Group Chat DLC is loaded
  const [redpacketClaimEvent, setRedpacketClaimEvent] = useState(null);
  const [generatingSchedules, setGeneratingSchedules] = useState({});
  const [hiddenMessagesCount, setHiddenMessagesCount] = useState(0);
  const [desktopWallpaper, setDesktopWallpaper] = useState(loadDesktopWallpaper);
  const [privateChatForegroundEnabled, setPrivateChatForegroundEnabled] = useState(loadPrivateChatForegroundEnabled);
  const [privateChatForegroundExiting, setPrivateChatForegroundExiting] = useState(false);
  const privateChatForegroundExitTimerRef = useRef(null);
  const [privateChatDecorTransforms, setPrivateChatDecorTransforms] = useState(loadPrivateChatDecorTransforms);
  const [privateChatForegroundPersonPosition, setPrivateChatForegroundPersonPosition] = useState(loadPrivateChatForegroundPersonPosition);
  const privateChatForegroundPersonPositionRef = useRef(privateChatForegroundPersonPosition);
  const privateChatForegroundPersonKeysRef = useRef(new Set());
  const privateChatForegroundPersonLastSaveRef = useRef(0);
  const [privateChatDecorEditorOpen, setPrivateChatDecorEditorOpen] = useState(() => {
    const search = new URLSearchParams(window.location.search);
    return search.get('decorEditor') === '1'
      || window.localStorage.getItem(PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY) === '1';
  });
  const setPrivateChatDecorEditorOpenPersisted = useCallback((valueOrUpdater) => {
    setPrivateChatDecorEditorOpen((previous) => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(previous) : valueOrUpdater;
      window.localStorage.setItem(PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const handleDesktopWallpaperChange = useCallback((nextWallpaper) => {
    const normalized = normalizeDesktopWallpaper(nextWallpaper);
    setDesktopWallpaper(normalized);
    try {
      window.localStorage.setItem(DESKTOP_WALLPAPER_STORAGE_KEY, normalized);
    } catch (error) {
      console.warn('Failed to save desktop wallpaper preference:', error);
    }
  }, []);

  const getPrivateChatDecorStyle = useCallback((id) => {
    const transform = normalizeDecorTransform(privateChatDecorTransforms[id]);
    return {
      '--decor-x': `${Math.round(transform.x)}px`,
      '--decor-y': `${Math.round(transform.y)}px`,
      '--decor-scale': Number(transform.scale.toFixed(3)),
    };
  }, [privateChatDecorTransforms]);

  const clearPrivateChatForegroundExitTimer = useCallback(() => {
    if (privateChatForegroundExitTimerRef.current !== null) {
      window.clearTimeout(privateChatForegroundExitTimerRef.current);
      privateChatForegroundExitTimerRef.current = null;
    }
  }, []);

  const handlePrivateChatForegroundToggle = useCallback(() => {
    clearPrivateChatForegroundExitTimer();

    if (privateChatForegroundEnabled) {
      setPrivateChatForegroundEnabled(false);
      setPrivateChatForegroundExiting(true);
      privateChatForegroundExitTimerRef.current = window.setTimeout(() => {
        setPrivateChatForegroundExiting(false);
        privateChatForegroundExitTimerRef.current = null;
      }, PRIVATE_CHAT_FOREGROUND_EXIT_MS);
      return;
    }

    setPrivateChatForegroundEnabled(true);
    setPrivateChatForegroundExiting(false);
  }, [clearPrivateChatForegroundExitTimer, privateChatForegroundEnabled]);

  useEffect(() => {
    return () => clearPrivateChatForegroundExitTimer();
  }, [clearPrivateChatForegroundExitTimer]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY,
        privateChatForegroundEnabled ? '1' : '0'
      );
    } catch (error) {
      console.warn('Failed to save private chat foreground preference:', error);
    }
  }, [privateChatForegroundEnabled]);

  const effectiveUser = useMemo(() => ({ ...(authUser || {}), ...(userProfile || {}) }), [authUser, userProfile]);
  const visiblePlugins = plugins.filter(p => !p.condition || p.condition(effectiveUser));
  const experimentalPlugins = visiblePlugins.filter(p => p.position === 'experiment');
  const regularPlugins = visiblePlugins.filter(p => p.position !== 'experiment');
  const activeChatContact = contacts.find(c => c.id === activeContactId) || activeContactSnapshot;
  const pluginById = useMemo(() => new Map(visiblePlugins.map(plugin => [plugin.id, plugin])), [visiblePlugins]);
  const privateUnreadCount = contacts.reduce((sum, contact) => sum + (Number(contact.unread) || 0), 0);
  const groupUnreadCount = Object.values(groupUnreadCounts).reduce((sum, count) => sum + (Number(count) || 0), 0);
  const socialUnreadCount = privateUnreadCount + groupUnreadCount;
  const [browserWindowMaximized, setBrowserWindowMaximized] = useState(false);
  const [browserWindows, setBrowserWindows] = useState([]);
  const [activeBrowserWindowId, setActiveBrowserWindowId] = useState(null);
  const [browserWindowInteractionMode, setBrowserWindowInteractionMode] = useState(null);
  const [browserWindowMergeTargetId, setBrowserWindowMergeTargetId] = useState(null);
  const [browserTabDragPreview, setBrowserTabDragPreview] = useState(null);
  const [browserWindowRecallPulse, setBrowserWindowRecallPulse] = useState(null);
  const [browserWindowGeometrySwitchingWindowId, setBrowserWindowGeometrySwitchingWindowId] = useState(null);
  const browserWindowSeqRef = useRef(1);
  const browserWindowInteractionRef = useRef(null);
  const browserWindowsRef = useRef(browserWindows);
  const browserWindowGeometrySyncTimersRef = useRef(new Map());
  const browserWindowPointerListenerCleanupRef = useRef(null);
  const browserWindowGeometrySwitchTimerRef = useRef(null);
  const suppressBrowserWindowClickRef = useRef(null);

  const normalizeBrowserWindowSocialState = useCallback((socialState = {}) => {
    const requestedGroupId = socialState?.activeGroupId;
    const selectedGroup = requestedGroupId
      ? groups.find(group => String(group.id) === String(requestedGroupId))
      : null;
    if (selectedGroup) {
      return {
        activeContactId: null,
        activeGroupId: selectedGroup.id,
        activeDrawer: socialState?.activeDrawer || null,
      };
    }

    const requestedContactId = socialState?.activeContactId;
    const selectedContact = requestedContactId
      ? contacts.find(contact => String(contact.id) === String(requestedContactId))
      : null;
    const fallbackContact = selectedContact || contacts[0] || null;
    return {
      activeContactId: fallbackContact?.id || null,
      activeGroupId: null,
      activeDrawer: socialState?.activeDrawer || null,
    };
  }, [contacts, groups]);

  const applyBrowserWindowSocialState = useCallback((windowItem) => {
    const socialState = normalizeBrowserWindowSocialState(windowItem?.social || {});
    const selectedContact = socialState.activeContactId
      ? contacts.find(contact => String(contact.id) === String(socialState.activeContactId))
      : null;

    setActiveGroupId(socialState.activeGroupId);
    activeGroupRef.current = socialState.activeGroupId;
    setActiveContactId(socialState.activeContactId);
    setActiveContactSnapshot(selectedContact || null);
    activeContactRef.current = socialState.activeContactId;
    setActiveDrawer(socialState.activeDrawer || null);
  }, [contacts, normalizeBrowserWindowSocialState]);

  const updateBrowserWindowSocialState = useCallback((windowId, patch = {}) => {
    if (!windowId) return;
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => {
      if (windowItem.id !== windowId) return windowItem;
      const previousSocial = windowItem.social || {};
      const nextSocial = {
        ...previousSocial,
        ...patch,
      };
      if (
        previousSocial.activeContactId === nextSocial.activeContactId
        && previousSocial.activeGroupId === nextSocial.activeGroupId
        && previousSocial.activeDrawer === nextSocial.activeDrawer
      ) {
        return windowItem;
      }
      return { ...windowItem, social: nextSocial };
    }));
  }, []);

  const buildActiveBrowserWindowSnapshot = useCallback(() => {
    if (typeof document === 'undefined' || activeTab === 'desktop' || !activeBrowserWindowId) {
      return null;
    }

    const root = document.querySelector('.app-container:not(.tab-desktop)');
    if (!root) return null;

    const directChildren = Array.from(root.children);
    const findDirectChild = (className) => directChildren.find((child) => child.classList?.contains(className));
    const snapshotParts = [];

    const syncFormValues = (sourceNode, cloneNode) => {
      const sourceFields = sourceNode.querySelectorAll('input, textarea, select');
      const cloneFields = cloneNode.querySelectorAll('input, textarea, select');
      sourceFields.forEach((sourceField, index) => {
        const cloneField = cloneFields[index];
        if (!cloneField) return;

        if (sourceField instanceof HTMLTextAreaElement) {
          cloneField.textContent = sourceField.value;
          return;
        }

        if (sourceField instanceof HTMLSelectElement) {
          Array.from(sourceField.options).forEach((option, optionIndex) => {
            if (cloneField.options?.[optionIndex]) {
              cloneField.options[optionIndex].selected = option.selected;
            }
          });
          return;
        }

        if (sourceField instanceof HTMLInputElement) {
          if (sourceField.type === 'checkbox' || sourceField.type === 'radio') {
            if (sourceField.checked) {
              cloneField.setAttribute('checked', '');
            } else {
              cloneField.removeAttribute('checked');
            }
          } else {
            cloneField.setAttribute('value', sourceField.value);
          }
        }
      });
    };

    const setSnapshotStyle = (element, property, value) => {
      if (!element?.style || value == null || value === '') return;
      try {
        element.style.setProperty(property, value, 'important');
      } catch (error) {
        // Some browser-specific computed properties are readonly or invalid to set.
      }
    };

    const replaceCloneWithStillMedia = (sourceElement, cloneElement) => {
      if (!cloneElement?.parentNode) return null;
      const createImageReplacement = (src) => {
        if (!src) return null;
        const image = document.createElement('img');
        image.src = src;
        image.alt = sourceElement.getAttribute?.('alt') || '';
        image.draggable = false;
        image.setAttribute('aria-hidden', 'true');
        image.className = cloneElement.className || sourceElement.className || '';
        image.style.cssText = cloneElement.style.cssText;
        cloneElement.parentNode.replaceChild(image, cloneElement);
        return image;
      };

      try {
        if (sourceElement instanceof HTMLCanvasElement && sourceElement.width && sourceElement.height) {
          return createImageReplacement(sourceElement.toDataURL('image/png'));
        }

        if (
          sourceElement instanceof HTMLVideoElement
          && sourceElement.readyState >= 2
          && sourceElement.videoWidth
          && sourceElement.videoHeight
        ) {
          const canvas = document.createElement('canvas');
          canvas.width = sourceElement.videoWidth;
          canvas.height = sourceElement.videoHeight;
          const context = canvas.getContext('2d');
          context?.drawImage(sourceElement, 0, 0, canvas.width, canvas.height);
          return createImageReplacement(canvas.toDataURL('image/png'));
        }
      } catch (error) {
        return null;
      }

      return null;
    };

    const freezeComputedSnapshotStyles = (sourceNode, cloneNode) => {
      const sourceNodes = [sourceNode, ...sourceNode.querySelectorAll('*')];
      const cloneNodes = [cloneNode, ...cloneNode.querySelectorAll('*')];

      sourceNodes.forEach((sourceElement, index) => {
        const cloneElement = cloneNodes[index];
        if (!cloneElement || !(sourceElement instanceof Element) || !(cloneElement instanceof Element)) return;
        const computedStyle = window.getComputedStyle(sourceElement);

        if (computedStyle.display === 'none') {
          setSnapshotStyle(cloneElement, 'display', 'none');
          return;
        }
        if (computedStyle.visibility && computedStyle.visibility !== 'visible') {
          setSnapshotStyle(cloneElement, 'visibility', computedStyle.visibility);
        }
        if (computedStyle.opacity && computedStyle.opacity !== '1') {
          setSnapshotStyle(cloneElement, 'opacity', computedStyle.opacity);
        }
        if (computedStyle.transform && computedStyle.transform !== 'none') {
          setSnapshotStyle(cloneElement, 'transform', computedStyle.transform);
          setSnapshotStyle(cloneElement, 'transform-origin', computedStyle.transformOrigin);
        }
        if (computedStyle.filter && computedStyle.filter !== 'none') {
          setSnapshotStyle(cloneElement, 'filter', computedStyle.filter);
        }
        if (computedStyle.backdropFilter && computedStyle.backdropFilter !== 'none') {
          setSnapshotStyle(cloneElement, 'backdrop-filter', computedStyle.backdropFilter);
        }
        setSnapshotStyle(cloneElement, 'animation', 'none');
        setSnapshotStyle(cloneElement, 'animation-delay', '0s');
        setSnapshotStyle(cloneElement, 'animation-duration', '0s');
        setSnapshotStyle(cloneElement, 'transition', 'none');
        setSnapshotStyle(cloneElement, 'transition-delay', '0s');
        setSnapshotStyle(cloneElement, 'transition-duration', '0s');
        setSnapshotStyle(cloneElement, 'caret-color', 'transparent');
        setSnapshotStyle(cloneElement, 'scroll-behavior', 'auto');
        setSnapshotStyle(cloneElement, 'pointer-events', 'none');
        cloneElement.setAttribute('data-browser-photo-node', 'true');

        if ((sourceElement.scrollTop || sourceElement.scrollLeft) && cloneElement.children?.length) {
          const scrollLeft = Number(sourceElement.scrollLeft) || 0;
          const scrollTop = Number(sourceElement.scrollTop) || 0;
          cloneElement.setAttribute('data-browser-photo-scroll', 'true');
          setSnapshotStyle(cloneElement, 'overflow', 'hidden');
          Array.from(cloneElement.children).forEach((child) => {
            const childTransform = child.style?.getPropertyValue('transform');
            const scrollTransform = `translate3d(${-scrollLeft}px, ${-scrollTop}px, 0)`;
            setSnapshotStyle(child, 'transform', childTransform && childTransform !== 'none'
              ? `${scrollTransform} ${childTransform}`
              : scrollTransform);
          });
        }

        replaceCloneWithStillMedia(sourceElement, cloneElement);
      });
    };

    const lockSnapshotPieceToWindow = (sourceNode, cloneNode, origin) => {
      const rect = sourceNode.getBoundingClientRect();
      cloneNode.setAttribute('data-browser-photo-piece', 'true');
      setSnapshotStyle(cloneNode, 'position', 'absolute');
      setSnapshotStyle(cloneNode, 'left', `${Math.round(rect.left - origin.left)}px`);
      setSnapshotStyle(cloneNode, 'top', `${Math.round(rect.top - origin.top)}px`);
      setSnapshotStyle(cloneNode, 'right', 'auto');
      setSnapshotStyle(cloneNode, 'bottom', 'auto');
      setSnapshotStyle(cloneNode, 'width', `${Math.round(rect.width)}px`);
      setSnapshotStyle(cloneNode, 'height', `${Math.round(rect.height)}px`);
      setSnapshotStyle(cloneNode, 'min-width', '0px');
      setSnapshotStyle(cloneNode, 'min-height', '0px');
      setSnapshotStyle(cloneNode, 'max-width', 'none');
      setSnapshotStyle(cloneNode, 'max-height', 'none');
      setSnapshotStyle(cloneNode, 'margin', '0px');
      setSnapshotStyle(cloneNode, 'transform', 'none');
      setSnapshotStyle(cloneNode, 'transform-origin', '0px 0px');
      setSnapshotStyle(cloneNode, 'box-sizing', 'border-box');
    };

    const cloneForSnapshot = (sourceNode, origin) => {
      if (!sourceNode) return null;
      const rect = sourceNode.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const clone = sourceNode.cloneNode(true);
      syncFormValues(sourceNode, clone);
      freezeComputedSnapshotStyles(sourceNode, clone);
      lockSnapshotPieceToWindow(sourceNode, clone, origin);
      clone.querySelectorAll('button, a, input, textarea, select, [tabindex]').forEach((node) => {
        node.setAttribute('tabindex', '-1');
      });
      return clone.outerHTML;
    };

    const chromeRect = findDirectChild('desktop-browser-chrome')?.getBoundingClientRect();
    const contentRect = findDirectChild('right-column')?.getBoundingClientRect()
      || findDirectChild('middle-column')?.getBoundingClientRect();
    const windowWidth = Math.max(320, Math.round(chromeRect?.width || contentRect?.width || 980));
    const chromeHeight = Math.max(78, Math.round(chromeRect?.height || DESKTOP_WINDOW_CHROME_HEIGHT));
    const contentHeight = Math.max(260, Math.round(contentRect?.height || 620));
    const windowHeight = chromeHeight + contentHeight;
    const origin = {
      left: Math.round(chromeRect?.left ?? contentRect?.left ?? 0),
      top: Math.round(chromeRect?.top ?? Math.max(0, (contentRect?.top || chromeHeight) - chromeHeight)),
    };

    [
      findDirectChild('desktop-browser-chrome'),
      findDirectChild('sidebar-nav'),
      findDirectChild('middle-column'),
      findDirectChild('right-column'),
    ].forEach((node) => {
      const html = cloneForSnapshot(node, origin);
      if (html) snapshotParts.push(html);
    });

    if (!snapshotParts.length) return null;

    const rootClassName = String(root.className || '')
      .split(/\s+/)
      .filter((className) => className && !['is-window-dragging', 'is-window-resizing', 'is-window-tab-dragging', 'is-window-merge-target'].includes(className))
      .concat('is-window-snapshot-frozen')
      .join(' ');
    const snapshotStyle = [
      'position:relative!important',
      'display:block!important',
      'padding:0!important',
      'overflow:hidden!important',
      'contain:layout paint style!important',
      'pointer-events:none!important',
      '--browser-window-x:0px',
      '--browser-window-y:0px',
      '--real-window-left:0px',
      '--real-window-top:0px',
      `--browser-window-width:${windowWidth}px`,
      `--browser-window-height:${windowHeight}px`,
      `--browser-window-content-height:${contentHeight}px`,
      `--real-window-width:${windowWidth}px`,
      `--real-window-height:${windowHeight}px`,
      `--real-window-content-height:${contentHeight}px`,
      `--desktop-browser-chrome-height:${chromeHeight}px`,
      `--snapshot-window-width:${windowWidth}px`,
      `--snapshot-window-height:${windowHeight}px`,
      `width:${windowWidth}px!important`,
      `height:${windowHeight}px!important`,
      'min-width:0!important',
      'min-height:0!important',
      'max-width:none!important',
      'max-height:none!important',
    ].join(';');

    return {
      snapshotHtml: `<div class="${rootClassName} desktop-browser-snapshot-app" data-browser-photo-snapshot="true" style="${snapshotStyle}" aria-hidden="true">${snapshotParts.join('')}</div>`,
      snapshotWidth: windowWidth,
      snapshotHeight: windowHeight,
      snapshotTab: activeTab,
      snapshotUpdatedAt: Date.now(),
    };
  }, [activeBrowserWindowId, activeTab]);

  const snapshotActiveBrowserWindow = useCallback((windowId = activeBrowserWindowId) => {
    return null;
  }, []);

  const openDesktop = useCallback(() => {
    snapshotActiveBrowserWindow();
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      {
        ...windowItem,
        activeTab: windowItem.id === activeBrowserWindowId && activeTab !== 'desktop'
          ? activeTab
          : windowItem.activeTab,
        minimized: true,
        maximized: windowItem.id === activeBrowserWindowId
          ? browserWindowMaximized
          : windowItem.maximized,
      }
    )));
    setActiveBrowserWindowId(null);
    setBrowserWindowMaximized(false);
    setActiveTab('desktop');
  }, [activeBrowserWindowId, activeTab, browserWindowMaximized, snapshotActiveBrowserWindow]);

  const openBrowserApp = useCallback((tab) => {
    snapshotActiveBrowserWindow();
    const allowMultipleWindows = DESKTOP_MULTI_WINDOW_APP_TABS.has(tab);
    const currentBrowserWindows = browserWindowsRef.current || [];
    const reusableWindow = allowMultipleWindows
      ? null
      : currentBrowserWindows.find((windowItem) => (windowItem.tabs || []).includes(tab));

    if (reusableWindow) {
      const reusableTabIndex = Math.max(0, (reusableWindow.tabs || []).indexOf(tab));
      setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
        windowItem.id === reusableWindow.id
          ? { ...windowItem, activeTab: tab, activeTabIndex: reusableTabIndex, minimized: false, snapshotHtml: null }
          : windowItem
      )));
      setActiveBrowserWindowId(reusableWindow.id);
      setBrowserWindowMaximized(Boolean(reusableWindow.maximized));
      setActiveTab(tab);
      if (tab === 'chats') {
        applyBrowserWindowSocialState(reusableWindow);
      }
      setBrowserWindowRecallPulse({ windowId: reusableWindow.id, token: Date.now() });
      return { reused: true, windowId: reusableWindow.id };
    }

    const sequence = browserWindowSeqRef.current++;
    const targetWindowId = `browser-window-${sequence}`;
    const geometry = getDefaultBrowserWindowGeometry(sequence);
    const shouldOpenMaximized = Boolean(activeBrowserWindowId && activeTab !== 'desktop' && browserWindowMaximized);
    const newWindow = {
      id: targetWindowId,
      tabs: [tab],
      activeTab: tab,
      activeTabIndex: 0,
      minimized: false,
      maximized: shouldOpenMaximized,
      snapshotHtml: null,
      tabSnapshots: {},
      social: tab === 'chats'
        ? normalizeBrowserWindowSocialState({
          activeContactId: activeContactId || contacts[0]?.id || null,
          activeGroupId,
          activeDrawer,
        })
        : undefined,
      ...geometry,
    };

    setBrowserWindows((currentWindows) => ([
      ...currentWindows.filter((windowItem) => windowItem.id !== targetWindowId),
      newWindow,
    ]));

    setActiveBrowserWindowId(targetWindowId);
    setBrowserWindowMaximized(shouldOpenMaximized);
    setActiveTab(tab);
    return { created: true, windowId: targetWindowId };
  }, [
    activeBrowserWindowId,
    activeContactId,
    activeDrawer,
    activeGroupId,
    activeTab,
    applyBrowserWindowSocialState,
    browserWindowMaximized,
    contacts,
    normalizeBrowserWindowSocialState,
    snapshotActiveBrowserWindow,
  ]);

  const openSocialApp = useCallback(() => {
    const openResult = openBrowserApp('chats');
    if (openResult?.reused) {
      setActiveDrawer(null);
      return;
    }
    setActiveGroupId(null);
    activeGroupRef.current = null;
    const firstContact = contacts[0] || null;
    setActiveContactId(firstContact?.id || null);
    setActiveContactSnapshot(firstContact);
    activeContactRef.current = firstContact?.id || null;
    setActiveDrawer(null);
  }, [contacts, openBrowserApp]);

  const openSimpleTabApp = useCallback((tab) => {
    openBrowserApp(tab);
    setActiveContactId(null);
    setActiveContactSnapshot(null);
    activeContactRef.current = null;
    setActiveGroupId(null);
    activeGroupRef.current = null;
    setActiveDrawer(null);
  }, [openBrowserApp]);

  useEffect(() => {
    if (!browserWindowRecallPulse || typeof window === 'undefined') return undefined;
    const timerId = window.setTimeout(() => {
      setBrowserWindowRecallPulse((current) => (
        current?.token === browserWindowRecallPulse.token ? null : current
      ));
    }, 940);
    return () => window.clearTimeout(timerId);
  }, [browserWindowRecallPulse]);

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

    return appList.map(app => ({
      ...app,
      taskbarIconImage: TASKBAR_APP_ICON_BY_ID[app.id] || app.taskbarIconImage,
    }));
  }, [
    activeTab,
    formatBadge,
    lang,
    openSocialApp,
    openSimpleTabApp,
    openBrowserTabs,
    pluginById,
    socialUnreadCount,
  ]);

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

  const beginBrowserWindowGeometrySwitch = useCallback((windowId = activeBrowserWindowId) => {
    if (!windowId) return;
    setBrowserWindowGeometrySwitchingWindowId(windowId);
    if (typeof window === 'undefined') return;
    if (browserWindowGeometrySwitchTimerRef.current) {
      window.clearTimeout(browserWindowGeometrySwitchTimerRef.current);
    }
    browserWindowGeometrySwitchTimerRef.current = window.setTimeout(() => {
      setBrowserWindowGeometrySwitchingWindowId((current) => (
        current === windowId ? null : current
      ));
      browserWindowGeometrySwitchTimerRef.current = null;
    }, 180);
  }, [activeBrowserWindowId]);

  const minimizeBrowserWindow = useCallback((windowId = activeBrowserWindowId) => {
    if (!windowId) return;
    const targetWindow = browserWindows.find(windowItem => windowItem.id === windowId);
    if (!targetWindow) return;
    beginBrowserWindowGeometrySwitch(windowId);
    const isActiveWindow = windowId === activeBrowserWindowId && activeTab !== 'desktop';
    const nextWindow = isActiveWindow
      ? [...browserWindows].reverse().find(windowItem => windowItem.id !== windowId && !windowItem.minimized)
      : null;
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      windowItem.id === windowId
        ? {
            ...windowItem,
            activeTab: isActiveWindow ? activeTab : windowItem.activeTab,
            minimized: true,
            maximized: isActiveWindow ? browserWindowMaximized : windowItem.maximized,
          }
        : windowItem
    )));
    if (isActiveWindow) {
      if (nextWindow) {
        const nextTab = nextWindow.activeTab === 'desktop'
          ? (nextWindow.tabs?.[0] || 'chats')
          : nextWindow.activeTab;
        setActiveBrowserWindowId(nextWindow.id);
        setBrowserWindowMaximized(Boolean(nextWindow.maximized));
        setActiveTab(nextTab);
        if (nextTab === 'chats') {
          applyBrowserWindowSocialState(nextWindow);
        } else {
          setActiveContactId(null);
          setActiveContactSnapshot(null);
          activeContactRef.current = null;
          setActiveGroupId(null);
          activeGroupRef.current = null;
          setActiveDrawer(null);
        }
        return;
      }
      setActiveBrowserWindowId(null);
      setBrowserWindowMaximized(false);
      setActiveTab('desktop');
    }
  }, [
    activeBrowserWindowId,
    activeTab,
    applyBrowserWindowSocialState,
    beginBrowserWindowGeometrySwitch,
    browserWindowMaximized,
    browserWindows,
  ]);

  const restoreBrowserWindow = useCallback((windowId) => {
    const targetWindow = browserWindows.find(windowItem => windowItem.id === windowId)
      || browserWindows.find(windowItem => windowItem.minimized)
      || browserWindows[0];
    if (!targetWindow) return;

    beginBrowserWindowGeometrySwitch(targetWindow.id);
    if (activeBrowserWindowId && activeBrowserWindowId !== targetWindow.id && activeTab !== 'desktop') {
      snapshotActiveBrowserWindow(activeBrowserWindowId);
    }
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      windowItem.id === targetWindow.id
        ? { ...windowItem, minimized: false, snapshotHtml: null }
        : windowItem
    )));
    setActiveBrowserWindowId(targetWindow.id);
    setBrowserWindowMaximized(Boolean(targetWindow.maximized));
    const nextTab = targetWindow.activeTab === 'desktop' ? 'chats' : targetWindow.activeTab;
    setActiveTab(nextTab);
    if (nextTab === 'chats') {
      applyBrowserWindowSocialState(targetWindow);
    }
  }, [activeBrowserWindowId, activeTab, applyBrowserWindowSocialState, beginBrowserWindowGeometrySwitch, browserWindows, snapshotActiveBrowserWindow]);

  const toggleBrowserWindowFromTaskbar = useCallback((windowId) => {
    const targetWindow = browserWindows.find(windowItem => windowItem.id === windowId);
    if (!targetWindow) return;
    if (targetWindow.minimized || activeBrowserWindowId !== windowId || activeTab === 'desktop') {
      restoreBrowserWindow(windowId);
      return;
    }
    minimizeBrowserWindow();
  }, [activeBrowserWindowId, activeTab, browserWindows, minimizeBrowserWindow, restoreBrowserWindow]);

  const activateBrowserTab = useCallback((tab, tabIndex = null) => {
    if (!activeBrowserWindowId) return;
    snapshotActiveBrowserWindow(activeBrowserWindowId);
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      windowItem.id === activeBrowserWindowId
        ? {
            ...windowItem,
            activeTab: tab,
            activeTabIndex: Number.isInteger(tabIndex) ? tabIndex : Math.max(0, (windowItem.tabs || []).indexOf(tab)),
            minimized: false,
            snapshotHtml: null,
          }
        : windowItem
    )));
    setActiveTab(tab);
  }, [activeBrowserWindowId, snapshotActiveBrowserWindow]);

  const focusBrowserWindowTab = useCallback((windowId, tab, tabIndex = null) => {
    if (!windowId || !tab) return;
    const targetWindow = browserWindows.find(windowItem => windowItem.id === windowId);
    if (!targetWindow || !targetWindow.tabs?.includes(tab)) return;
    const resolvedTabIndex = Number.isInteger(tabIndex)
      ? tabIndex
      : Math.max(0, targetWindow.tabs.indexOf(tab));

    if (windowId === activeBrowserWindowId && activeTab !== 'desktop') {
      activateBrowserTab(tab, resolvedTabIndex);
      if (tab === 'chats') {
        applyBrowserWindowSocialState(targetWindow);
      }
      return;
    }

    if (activeBrowserWindowId && activeTab !== 'desktop') {
      snapshotActiveBrowserWindow(activeBrowserWindowId);
    }

    beginBrowserWindowGeometrySwitch(windowId);
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      windowItem.id === windowId
        ? { ...windowItem, activeTab: tab, activeTabIndex: resolvedTabIndex, minimized: false, snapshotHtml: null }
        : windowItem
    )));
    setActiveBrowserWindowId(windowId);
    setBrowserWindowMaximized(Boolean(targetWindow.maximized));
    setActiveTab(tab);
    if (tab === 'chats') {
      applyBrowserWindowSocialState(targetWindow);
    }
  }, [activateBrowserTab, activeBrowserWindowId, activeTab, applyBrowserWindowSocialState, beginBrowserWindowGeometrySwitch, browserWindows, snapshotActiveBrowserWindow]);

  const toggleBrowserWindowMaximized = useCallback(() => {
    beginBrowserWindowGeometrySwitch(activeBrowserWindowId);
    setBrowserWindowMaximized((current) => {
      const next = !current;
      if (activeBrowserWindowId) {
        setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
          windowItem.id === activeBrowserWindowId
            ? { ...windowItem, maximized: next }
            : windowItem
        )));
      }
      return next;
    });
  }, [activeBrowserWindowId, beginBrowserWindowGeometrySwitch]);

  const activeBrowserWindowStyle = useMemo(() => {
    if (!activeBrowserWindow || activeTab === 'desktop') return undefined;
    const latestActiveBrowserWindow = browserWindowsRef.current?.find(windowItem => windowItem.id === activeBrowserWindow.id)
      || activeBrowserWindow;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
    const geometry = browserWindowMaximized
      ? {
        x: 0,
        y: 0,
        width: viewportWidth,
        height: Math.max(320, viewportHeight - taskbarHeight),
      }
      : clampBrowserWindowGeometry(latestActiveBrowserWindow);
    const contentHeight = Math.max(320, geometry.height - chromeHeight);
    const foregroundBaseWidth = Math.max(320, geometry.width);
    const foregroundBaseHeight = Math.max(320, contentHeight);

    return {
      '--browser-window-x': `${geometry.x}px`,
      '--browser-window-y': `${geometry.y}px`,
      '--browser-window-width': `${geometry.width}px`,
      '--browser-window-height': `${geometry.height}px`,
      '--browser-window-content-height': `${contentHeight}px`,
      '--private-foreground-base-width': `${foregroundBaseWidth}px`,
      '--private-foreground-base-height': `${foregroundBaseHeight}px`,
      '--private-foreground-scale': '1',
      '--private-chat-stage-width': `${foregroundBaseWidth}px`,
      '--private-chat-stage-height': `${foregroundBaseHeight}px`,
      '--private-chat-stage-scale': '1',
      '--private-chat-stage-x': '0px',
      '--private-chat-stage-y': '0px',
    };
  }, [activeBrowserWindow, activeTab, browserWindowMaximized]);

  const activeBrowserWindowLayoutClasses = useMemo(() => {
    if (!activeBrowserWindow || activeTab === 'desktop') return '';
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
    const latestActiveBrowserWindow = browserWindowsRef.current?.find(windowItem => windowItem.id === activeBrowserWindow.id)
      || activeBrowserWindow;
    const geometry = browserWindowMaximized
      ? {
        width: viewportWidth,
        height: Math.max(320, viewportHeight - taskbarHeight),
      }
      : clampBrowserWindowGeometry(latestActiveBrowserWindow);
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const contentHeight = Math.max(260, geometry.height - chromeHeight);
    const classes = [];

    if (geometry.width <= 760) classes.push('is-window-tight');
    if (geometry.width > 760 && geometry.width <= 1020) classes.push('is-window-mid');
    if (geometry.width >= 1180) classes.push('is-window-wide');
    if (contentHeight <= 430) classes.push('is-window-low');
    if (contentHeight >= 620) classes.push('is-window-tall');

    return classes.join(' ');
  }, [activeBrowserWindow, activeTab, browserWindowMaximized]);

  const getBrowserWindowStackStyle = useCallback((windowItem, index = 0) => {
    const latestWindowItem = browserWindowsRef.current?.find(currentWindow => currentWindow.id === windowItem?.id)
      || windowItem;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
    const isMaximized = Boolean(latestWindowItem?.maximized);
    const geometry = isMaximized
      ? {
        x: 0,
        y: 0,
        width: viewportWidth,
        height: Math.max(320, viewportHeight - taskbarHeight),
      }
      : clampBrowserWindowGeometry(latestWindowItem);
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const contentHeight = Math.max(260, geometry.height - chromeHeight);
    const snapshotWidth = Math.max(1, Number(windowItem.snapshotWidth) || geometry.width);
    const snapshotHeight = Math.max(1, Number(windowItem.snapshotHeight) || geometry.height);
    return {
      '--browser-window-x': `${geometry.x}px`,
      '--browser-window-y': `${geometry.y}px`,
      '--browser-window-width': `${geometry.width}px`,
      '--browser-window-height': `${geometry.height}px`,
      '--browser-window-content-height': `${contentHeight}px`,
      '--shadow-window-x': `${geometry.x}px`,
      '--shadow-window-y': `${geometry.y}px`,
      '--shadow-window-width': `${geometry.width}px`,
      '--shadow-window-height': `${geometry.height}px`,
      '--shadow-window-content-height': `${contentHeight}px`,
      '--shadow-snapshot-width': `${snapshotWidth}px`,
      '--shadow-snapshot-height': `${snapshotHeight}px`,
      '--private-foreground-base-width': `${Math.max(320, geometry.width)}px`,
      '--private-foreground-base-height': `${Math.max(320, contentHeight)}px`,
      '--private-foreground-scale': '1',
      '--private-chat-stage-width': `${Math.max(320, geometry.width)}px`,
      '--private-chat-stage-height': `${Math.max(320, contentHeight)}px`,
      '--private-chat-stage-scale': '1',
      '--private-chat-stage-x': '0px',
      '--private-chat-stage-y': '0px',
      '--shadow-window-z': 42 + index,
    };
  }, []);

  const applyBrowserWindowPreviewGeometry = useCallback((windowId, geometry) => {
    if (typeof document === 'undefined' || !windowId || !geometry) return;
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const contentHeight = Math.max(260, geometry.height - chromeHeight);
    const target = windowId === activeBrowserWindowId
      ? document.querySelector('.app-container:not(.tab-desktop)')
      : document.querySelector(`[data-browser-window-id="${windowId}"]`);
    if (!target) return;
    const propertyPrefix = windowId === activeBrowserWindowId ? '--browser-window' : '--shadow-window';
    target.style.setProperty(`${propertyPrefix}-x`, `${geometry.x}px`);
    target.style.setProperty(`${propertyPrefix}-y`, `${geometry.y}px`);
    target.style.setProperty(`${propertyPrefix}-width`, `${geometry.width}px`);
    target.style.setProperty(`${propertyPrefix}-height`, `${geometry.height}px`);
    target.style.setProperty(`${propertyPrefix}-content-height`, `${contentHeight}px`);
    if (windowId !== activeBrowserWindowId) {
      target.style.setProperty('--browser-window-x', `${geometry.x}px`);
      target.style.setProperty('--browser-window-y', `${geometry.y}px`);
      target.style.setProperty('--browser-window-width', `${geometry.width}px`);
      target.style.setProperty('--browser-window-height', `${geometry.height}px`);
      target.style.setProperty('--browser-window-content-height', `${contentHeight}px`);
    }
  }, [activeBrowserWindowId]);

  const getBrowserWindowDomNode = useCallback((windowId = activeBrowserWindowId) => {
    if (typeof document === 'undefined' || !windowId) return null;
    if (windowId === activeBrowserWindowId) {
      return document.querySelector('.app-container:not(.tab-desktop):not(.desktop-browser-live-window)');
    }
    return document.querySelector(`[data-browser-window-id="${windowId}"]`);
  }, [activeBrowserWindowId]);

  const setBrowserWindowDomInteraction = useCallback((windowId, mode, enabled) => {
    const target = getBrowserWindowDomNode(windowId);
    if (!target) return;
    const classes = ['is-window-dragging', 'is-window-resizing', 'is-window-tab-dragging'];
    classes.forEach((className) => target.classList.remove(className));
    target.classList.toggle('is-interacting', Boolean(enabled));
    if (!enabled) return;
    if (mode === 'resize') {
      target.classList.add('is-window-resizing');
    } else if (mode === 'tab') {
      target.classList.add('is-window-tab-dragging');
    } else {
      target.classList.add('is-window-dragging');
    }
  }, [getBrowserWindowDomNode]);

  const commitBrowserWindowGeometry = useCallback((windowId, geometry, options = {}) => {
    if (!windowId || !geometry) return;
    const finalGeometry = clampBrowserWindowGeometry(geometry);
    browserWindowsRef.current = (browserWindowsRef.current || []).map((windowItem) => (
      windowItem.id === windowId
        ? { ...windowItem, ...finalGeometry, maximized: false }
        : windowItem
    ));

    const existingTimer = browserWindowGeometrySyncTimersRef.current.get(windowId);
    if (existingTimer) {
      if (existingTimer.type === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(existingTimer.id);
      } else if (typeof window !== 'undefined') {
        window.clearTimeout(existingTimer.id);
      }
    }

    const syncState = () => {
      browserWindowGeometrySyncTimersRef.current.delete(windowId);
      setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
        windowItem.id === windowId
          ? { ...windowItem, ...finalGeometry, maximized: false }
          : windowItem
      )));
    };

    if (options.defer === false || typeof window === 'undefined') {
      syncState();
      return;
    }

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(syncState, { timeout: 900 });
      browserWindowGeometrySyncTimersRef.current.set(windowId, { type: 'idle', id });
      return;
    }

    const id = window.setTimeout(syncState, 220);
    browserWindowGeometrySyncTimersRef.current.set(windowId, { type: 'timeout', id });
  }, []);

  const moveBrowserTabToWindow = useCallback((sourceWindowId, tabId, targetWindowId, sourceTabIndex = null) => {
    if (!sourceWindowId || !targetWindowId || !tabId || sourceWindowId === targetWindowId) return false;

    const sourceWindow = browserWindows.find(windowItem => windowItem.id === sourceWindowId);
    const targetWindow = browserWindows.find(windowItem => windowItem.id === targetWindowId);
    if (!sourceWindow || !targetWindow || !sourceWindow.tabs?.includes(tabId)) return false;

    const nextMaximized = targetWindow.id === activeBrowserWindowId
      ? browserWindowMaximized
      : Boolean(targetWindow.maximized);
    const nextActiveTab = tabId;

    setBrowserWindows((currentWindows) => {
      const currentSource = currentWindows.find(windowItem => windowItem.id === sourceWindowId);
      const currentTarget = currentWindows.find(windowItem => windowItem.id === targetWindowId);
      if (!currentSource || !currentTarget || !currentSource.tabs?.includes(tabId)) return currentWindows;

      const currentSourceTabs = currentSource.tabs || [];
      const resolvedSourceIndex = Number.isInteger(sourceTabIndex)
        && currentSourceTabs[sourceTabIndex] === tabId
        ? sourceTabIndex
        : currentSourceTabs.indexOf(tabId);
      if (resolvedSourceIndex < 0) return currentWindows;

      const remainingSourceTabs = currentSourceTabs.filter((_, index) => index !== resolvedSourceIndex);
      const sourceTabSnapshots = currentSource.tabSnapshots || {};
      const targetTabSnapshots = currentTarget.tabSnapshots || {};
      const targetTabs = [...(currentTarget.tabs || []), tabId];
      const currentSourceActiveIndex = Number.isInteger(currentSource.activeTabIndex)
        ? currentSource.activeTabIndex
        : currentSourceTabs.indexOf(currentSource.activeTab);
      const nextSourceActiveIndex = remainingSourceTabs.length
        ? (
            currentSourceActiveIndex === resolvedSourceIndex
              ? Math.min(resolvedSourceIndex, remainingSourceTabs.length - 1)
              : Math.max(0, currentSourceActiveIndex - (currentSourceActiveIndex > resolvedSourceIndex ? 1 : 0))
          )
        : -1;
      const nextSourceActiveTab = remainingSourceTabs[nextSourceActiveIndex];
      const nextSourceSnapshot = getBrowserSnapshotFields(sourceTabSnapshots[nextSourceActiveTab]);
      const movedTabSnapshot = sourceTabSnapshots[tabId];
      const nextTargetActiveIndex = targetTabs.length - 1;

      return currentWindows.reduce((nextWindows, windowItem) => {
        if (windowItem.id === sourceWindowId) {
          if (remainingSourceTabs.length > 0) {
            nextWindows.push({
              ...windowItem,
              tabs: remainingSourceTabs,
              activeTab: nextSourceActiveTab,
              activeTabIndex: nextSourceActiveIndex,
              ...nextSourceSnapshot,
            });
          }
          return nextWindows;
        }

        if (windowItem.id === targetWindowId) {
          nextWindows.push({
            ...windowItem,
            tabs: targetTabs,
            activeTab: nextActiveTab,
            activeTabIndex: nextTargetActiveIndex,
            minimized: false,
            maximized: nextMaximized,
            snapshotHtml: null,
            social: tabId === 'chats'
              ? { ...(currentSource.social || currentTarget.social || {}) }
              : currentTarget.social,
            tabSnapshots: {
              ...targetTabSnapshots,
              ...(movedTabSnapshot ? { [tabId]: movedTabSnapshot } : {}),
            },
          });
          return nextWindows;
        }

        nextWindows.push(windowItem);
        return nextWindows;
      }, []);
    });

    setActiveBrowserWindowId(targetWindowId);
    setBrowserWindowMaximized(nextMaximized);
    setActiveTab(nextActiveTab);
    return true;
  }, [activeBrowserWindowId, browserWindowMaximized, browserWindows]);

  const detachBrowserTabToWindow = useCallback((sourceWindowId, tabId, pointerX, pointerY, sourceTabIndex = null) => {
    if (!sourceWindowId || !tabId) return false;

    const sourceWindow = browserWindows.find(windowItem => windowItem.id === sourceWindowId);
    const sourceTabs = sourceWindow?.tabs || [];
    if (!sourceWindow || sourceTabs.length <= 1 || !sourceTabs.includes(tabId)) return false;
    const resolvedSourceIndex = Number.isInteger(sourceTabIndex) && sourceTabs[sourceTabIndex] === tabId
      ? sourceTabIndex
      : sourceTabs.indexOf(tabId);
    if (resolvedSourceIndex < 0) return false;

    const sourceGeometry = clampBrowserWindowGeometry(sourceWindow);
    const newWindowId = `browser-window-${browserWindowSeqRef.current++}`;
    const nextGeometry = clampBrowserWindowGeometry({
      ...sourceGeometry,
      x: Math.round((Number(pointerX) || sourceGeometry.x) - Math.min(sourceGeometry.width * 0.42, 360)),
      y: Math.round((Number(pointerY) || sourceGeometry.y) - 18),
    });
    const remainingSourceTabs = sourceTabs.filter((_, index) => index !== resolvedSourceIndex);
    const currentSourceActiveIndex = Number.isInteger(sourceWindow.activeTabIndex)
      ? sourceWindow.activeTabIndex
      : sourceTabs.indexOf(sourceWindow.activeTab);
    const nextSourceActiveIndex = remainingSourceTabs.length
      ? (
          currentSourceActiveIndex === resolvedSourceIndex
            ? Math.min(resolvedSourceIndex, remainingSourceTabs.length - 1)
            : Math.max(0, currentSourceActiveIndex - (currentSourceActiveIndex > resolvedSourceIndex ? 1 : 0))
        )
      : -1;
    const nextSourceActiveTab = remainingSourceTabs[nextSourceActiveIndex];
    const sourceTabSnapshots = sourceWindow.tabSnapshots || {};
    const nextSourceSnapshot = getBrowserSnapshotFields(sourceTabSnapshots[nextSourceActiveTab]);
    const detachedTabSnapshot = sourceTabSnapshots[tabId];

    setBrowserWindows((currentWindows) => {
      const nextWindows = [];
      currentWindows.forEach((windowItem) => {
        if (windowItem.id === sourceWindowId) {
          nextWindows.push({
            ...windowItem,
            tabs: remainingSourceTabs,
            activeTab: nextSourceActiveTab,
            activeTabIndex: nextSourceActiveIndex,
            social: remainingSourceTabs.includes('chats') ? windowItem.social : undefined,
            ...nextSourceSnapshot,
          });
          nextWindows.push({
            id: newWindowId,
            tabs: [tabId],
            activeTab: tabId,
            activeTabIndex: 0,
            minimized: false,
            maximized: false,
            snapshotHtml: null,
            social: tabId === 'chats' ? { ...(sourceWindow.social || {}) } : undefined,
            tabSnapshots: detachedTabSnapshot ? { [tabId]: detachedTabSnapshot } : {},
            ...nextGeometry,
          });
          return;
        }
        nextWindows.push(windowItem);
      });
      return nextWindows;
    });

    setActiveBrowserWindowId(newWindowId);
    setBrowserWindowMaximized(false);
    setActiveTab(tabId);
    return true;
  }, [browserWindows]);

  const updateBrowserWindowGeometry = useCallback((windowId, updater) => {
    if (!windowId) return;
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => {
      if (windowItem.id !== windowId) return windowItem;
      const currentGeometry = clampBrowserWindowGeometry(windowItem);
      const nextGeometry = clampBrowserWindowGeometry(
        typeof updater === 'function' ? updater(currentGeometry) : updater
      );
      return { ...windowItem, ...nextGeometry, maximized: false };
    }));
    if (windowId === activeBrowserWindowId) setBrowserWindowMaximized(false);
  }, [activeBrowserWindowId]);

  const getBrowserTabDropTargetId = useCallback((event, interaction = browserWindowInteractionRef.current) => {
    if (
      !interaction
      || interaction.type !== 'tab'
      || typeof window === 'undefined'
    ) {
      return null;
    }

    const chromeHeight = getResponsiveBrowserChromeHeight();
    const horizontalSlop = 12;
    const verticalSlop = 10;

    const currentBrowserWindows = browserWindowsRef.current?.length ? browserWindowsRef.current : browserWindows;
    const candidates = currentBrowserWindows
      .filter(windowItem => !windowItem.minimized && windowItem.id !== interaction.sourceWindowId)
      .map((windowItem, index) => {
        const targetGeometry = clampBrowserWindowGeometry(windowItem);
        const pointerInsideCardHead =
          event.clientX >= targetGeometry.x - horizontalSlop
          && event.clientX <= targetGeometry.x + targetGeometry.width + horizontalSlop
          && event.clientY >= targetGeometry.y - verticalSlop
          && event.clientY <= targetGeometry.y + chromeHeight + verticalSlop;

        if (!pointerInsideCardHead) return null;

        const chromeMidpointY = targetGeometry.y + chromeHeight / 2;
        const verticalScore = Math.max(0, chromeHeight - Math.abs(event.clientY - chromeMidpointY));

        return {
          id: windowItem.id,
          score:
            (windowItem.id === activeBrowserWindowId ? 100000 : 0)
            + verticalScore
            + index,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.id || null;
  }, [activeBrowserWindowId, browserWindows]);

  const stopBrowserWindowInteraction = useCallback((event) => {
    const interaction = browserWindowInteractionRef.current;
    if (!interaction) return;
    browserWindowPointerListenerCleanupRef.current?.();
    browserWindowPointerListenerCleanupRef.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(interaction.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }

    if (interaction.type === 'tab') {
      const dropTargetId = browserWindowMergeTargetId || getBrowserTabDropTargetId(event, interaction);
      const sourceWindow = browserWindows.find(windowItem => windowItem.id === interaction.sourceWindowId);
      const sourceGeometry = sourceWindow ? clampBrowserWindowGeometry(sourceWindow) : null;
      const chromeHeight = getResponsiveBrowserChromeHeight();
      const outsideSourceCardHead = sourceGeometry
        ? (
            event.clientX < sourceGeometry.x - DESKTOP_TAB_DETACH_OFFSET
            || event.clientX > sourceGeometry.x + sourceGeometry.width + DESKTOP_TAB_DETACH_OFFSET
            || event.clientY < sourceGeometry.y - DESKTOP_TAB_DETACH_OFFSET
            || event.clientY > sourceGeometry.y + chromeHeight + DESKTOP_TAB_DETACH_OFFSET
          )
        : false;

      browserWindowInteractionRef.current = null;
      setBrowserWindowInteractionMode(null);
      setBrowserWindowMergeTargetId(null);
      setBrowserTabDragPreview(null);

      if (event.type !== 'pointercancel') {
        if (interaction.moved && dropTargetId && interaction.sourceWindowId !== dropTargetId) {
          event.preventDefault();
          moveBrowserTabToWindow(interaction.sourceWindowId, interaction.tabId, dropTargetId, interaction.tabIndex);
        } else if (interaction.moved && outsideSourceCardHead) {
          event.preventDefault();
          detachBrowserTabToWindow(interaction.sourceWindowId, interaction.tabId, event.clientX, event.clientY, interaction.tabIndex);
        } else if (!interaction.moved) {
          focusBrowserWindowTab(interaction.sourceWindowId, interaction.tabId, interaction.tabIndex);
        }
      }

      if (interaction.moved) {
        suppressBrowserWindowClickRef.current = interaction.sourceWindowId;
        window.setTimeout(() => {
          if (suppressBrowserWindowClickRef.current === interaction.sourceWindowId) {
            suppressBrowserWindowClickRef.current = null;
          }
        }, 180);
      }
      return;
    }

    const finalGeometry = interaction.currentGeometry
      ? clampBrowserWindowGeometry(interaction.currentGeometry)
      : null;
    browserWindowInteractionRef.current = null;
    setBrowserWindowDomInteraction(
      interaction.windowId,
      interaction.type === 'resize' ? 'resize' : 'drag',
      false
    );
    setBrowserWindowMergeTargetId(null);

    if (finalGeometry && interaction.moved) {
      commitBrowserWindowGeometry(interaction.windowId, finalGeometry);
      if (interaction.windowId === activeBrowserWindowId && browserWindowMaximized) {
        setBrowserWindowMaximized(false);
      }
    }

    if (interaction.moved) {
      suppressBrowserWindowClickRef.current = interaction.windowId;
      window.setTimeout(() => {
        if (suppressBrowserWindowClickRef.current === interaction.windowId) {
          suppressBrowserWindowClickRef.current = null;
        }
      }, 180);
    }
  }, [
    activeBrowserWindowId,
    browserWindowMergeTargetId,
    browserWindows,
    browserWindowMaximized,
    commitBrowserWindowGeometry,
    detachBrowserTabToWindow,
    focusBrowserWindowTab,
    getBrowserTabDropTargetId,
    moveBrowserTabToWindow,
    setBrowserWindowDomInteraction,
  ]);

  const handleBrowserWindowPointerMove = useCallback((event) => {
    const interaction = browserWindowInteractionRef.current;
    if (!interaction) return;
    event.preventDefault();
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    if (!interaction.moved && Math.hypot(deltaX, deltaY) > DESKTOP_TAB_DRAG_THRESHOLD) {
      interaction.moved = true;
    }

    if (interaction.type === 'tab') {
      interaction.currentX = event.clientX;
      interaction.currentY = event.clientY;
      if (interaction.moved) {
        setBrowserTabDragPreview({
          x: event.clientX,
          y: event.clientY,
          title: interaction.title,
          mark: interaction.mark,
          moved: true,
        });
      }
      const dropTargetId = getBrowserTabDropTargetId(event, interaction);
      setBrowserWindowMergeTargetId((current) => (
        current === dropTargetId ? current : dropTargetId
      ));
      return;
    }

    const nextGeometry = interaction.type === 'resize'
      ? resizeBrowserWindowGeometry(
        interaction.startGeometry,
        deltaX,
        deltaY,
        interaction.direction
      )
      : clampBrowserWindowGeometry({
        ...interaction.startGeometry,
        x: interaction.startGeometry.x + deltaX,
        y: interaction.startGeometry.y + deltaY,
      });
    interaction.currentGeometry = nextGeometry;
    applyBrowserWindowPreviewGeometry(interaction.windowId, nextGeometry);
  }, [applyBrowserWindowPreviewGeometry, getBrowserTabDropTargetId]);

  const attachBrowserWindowPointerListeners = useCallback(() => {
    if (typeof window === 'undefined') return;
    browserWindowPointerListenerCleanupRef.current?.();
    const handleGlobalPointerMove = (event) => {
      handleBrowserWindowPointerMove(event);
    };
    const handleGlobalPointerEnd = (event) => {
      stopBrowserWindowInteraction(event);
    };
    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', handleGlobalPointerEnd);
    window.addEventListener('pointercancel', handleGlobalPointerEnd);
    browserWindowPointerListenerCleanupRef.current = () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerEnd);
      window.removeEventListener('pointercancel', handleGlobalPointerEnd);
    };
  }, [handleBrowserWindowPointerMove, stopBrowserWindowInteraction]);

  const startBrowserWindowDrag = useCallback((event, windowId = activeBrowserWindowId) => {
    const currentBrowserWindows = browserWindowsRef.current?.length ? browserWindowsRef.current : browserWindows;
    const targetWindow = currentBrowserWindows.find(windowItem => windowItem.id === windowId) || activeBrowserWindow;
    if (!targetWindow || event.button !== 0) return;
    if (targetWindow.maximized || (windowId === activeBrowserWindowId && browserWindowMaximized)) return;
    if (event.target.closest('button, a, input, textarea, select, .desktop-browser-tab, .desktop-browser-address, [data-window-no-drag="true"]')) return;
    event.preventDefault();
    const geometry = clampBrowserWindowGeometry(targetWindow);
    browserWindowInteractionRef.current = {
      type: 'move',
      windowId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: geometry,
      currentGeometry: geometry,
      moved: false,
    };
    setBrowserWindowDomInteraction(windowId, 'drag', true);
    setBrowserWindowMergeTargetId(null);
    attachBrowserWindowPointerListeners();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [
    activeBrowserWindow,
    activeBrowserWindowId,
    attachBrowserWindowPointerListeners,
    browserWindowMaximized,
    browserWindows,
    setBrowserWindowDomInteraction,
  ]);

  const startBrowserWindowResize = useCallback((event, direction = 'se', windowId = activeBrowserWindowId) => {
    const currentBrowserWindows = browserWindowsRef.current?.length ? browserWindowsRef.current : browserWindows;
    const targetWindow = currentBrowserWindows.find(windowItem => windowItem.id === windowId) || activeBrowserWindow;
    if (!targetWindow || event.button !== 0) return;
    if (targetWindow.maximized || (windowId === activeBrowserWindowId && browserWindowMaximized)) return;
    event.preventDefault();
    event.stopPropagation();
    const geometry = clampBrowserWindowGeometry(targetWindow);
    browserWindowInteractionRef.current = {
      type: 'resize',
      windowId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: geometry,
      currentGeometry: geometry,
      direction,
      moved: false,
    };
    setBrowserWindowDomInteraction(windowId, 'resize', true);
    setBrowserWindowMergeTargetId(null);
    attachBrowserWindowPointerListeners();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [
    activeBrowserWindow,
    activeBrowserWindowId,
    attachBrowserWindowPointerListeners,
    browserWindowMaximized,
    browserWindows,
    setBrowserWindowDomInteraction,
  ]);

  const getShadowWindowTabAtPoint = useCallback((event, windowItem) => {
    const tabs = windowItem?.tabs || [];
    if (!tabs.length) return null;

    const geometry = clampBrowserWindowGeometry(windowItem);
    const relativeX = event.clientX - geometry.x;
    const relativeY = event.clientY - geometry.y;
    const tabStripHeight = 42;
    if (relativeY < 0 || relativeY > tabStripHeight) return null;

    const leftPadding = 10;
    const rightReserved = 160;
    const addButtonWidth = 40;
    const usableWidth = Math.max(0, geometry.width - leftPadding - rightReserved - addButtonWidth);
    if (relativeX < leftPadding || relativeX > leftPadding + usableWidth) return null;

    const gap = 4;
    const tabWidth = Math.min(260, Math.max(128, (usableWidth - gap * Math.max(0, tabs.length - 1)) / tabs.length));
    const tabIndex = Math.floor((relativeX - leftPadding) / (tabWidth + gap));
    const tabStart = leftPadding + tabIndex * (tabWidth + gap);
    const insideTab = relativeX >= tabStart && relativeX <= tabStart + tabWidth;
    if (!insideTab) return null;
    return tabs[tabIndex] ? { tabId: tabs[tabIndex], tabIndex } : null;
  }, []);

  const startBrowserTabDrag = useCallback((event, tabId, sourceWindowId = activeBrowserWindowId, tabIndex = null) => {
    const sourceWindow = browserWindows.find(windowItem => windowItem.id === sourceWindowId);
    const sourceTabs = sourceWindow?.tabs || [];
    const resolvedTabIndex = Number.isInteger(tabIndex) && sourceTabs[tabIndex] === tabId
      ? tabIndex
      : sourceTabs.indexOf(tabId);
    if (!sourceWindow || !tabId || event.button !== 0 || resolvedTabIndex < 0) return;
    if (sourceWindow.maximized || (sourceWindowId === activeBrowserWindowId && browserWindowMaximized)) return;

    event.preventDefault();
    event.stopPropagation();

    const geometry = clampBrowserWindowGeometry(sourceWindow);
    const title = getBrowserTabLabel(tabId);
    const mark = getBrowserTabMark(tabId);
    browserWindowInteractionRef.current = {
      type: 'tab',
      tabId,
      tabIndex: resolvedTabIndex,
      sourceWindowId,
      windowId: sourceWindowId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      startGeometry: geometry,
      currentGeometry: geometry,
      title,
      mark,
      moved: false,
    };
    setBrowserWindowInteractionMode('tab-dragging');
    setBrowserWindowMergeTargetId(null);
    setBrowserTabDragPreview({
      x: event.clientX,
      y: event.clientY,
      title,
      mark,
      moved: false,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [
    activeBrowserWindowId,
    browserWindowMaximized,
    browserWindows,
    getBrowserTabLabel,
    getBrowserTabMark,
  ]);

  const handleBrowserShadowWindowPointerDown = useCallback((event, windowItem) => {
    const tabHit = getShadowWindowTabAtPoint(event, windowItem);
    if (tabHit) {
      startBrowserTabDrag(event, tabHit.tabId, windowItem.id, tabHit.tabIndex);
      return;
    }
    startBrowserWindowDrag(event, windowItem.id);
  }, [getShadowWindowTabAtPoint, startBrowserTabDrag, startBrowserWindowDrag]);

  useEffect(() => {
    if (!browserWindowInteractionMode || typeof window === 'undefined') return undefined;

    const handleGlobalPointerMove = (event) => {
      handleBrowserWindowPointerMove(event);
    };
    const handleGlobalPointerEnd = (event) => {
      stopBrowserWindowInteraction(event);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', handleGlobalPointerEnd);
    window.addEventListener('pointercancel', handleGlobalPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerEnd);
      window.removeEventListener('pointercancel', handleGlobalPointerEnd);
    };
  }, [browserWindowInteractionMode, handleBrowserWindowPointerMove, stopBrowserWindowInteraction]);

  const closeBrowserWindow = useCallback((windowId = activeBrowserWindowId) => {
    if (!windowId) {
      openDesktop();
      return;
    }
    const isActiveWindow = windowId === activeBrowserWindowId;
    const remainingWindows = browserWindows.filter(windowItem => windowItem.id !== windowId);
    const nextWindow = [...remainingWindows].reverse().find(windowItem => !windowItem.minimized) || null;

    setBrowserWindows(remainingWindows);
    if (!isActiveWindow) {
      return;
    }
    if (nextWindow) {
      const nextTab = nextWindow.activeTab || nextWindow.tabs?.[0] || 'desktop';
      setActiveBrowserWindowId(nextWindow.id);
      setBrowserWindowMaximized(Boolean(nextWindow.maximized));
      setActiveTab(nextTab);
      if (nextTab === 'chats') {
        applyBrowserWindowSocialState(nextWindow);
      } else {
        setActiveContactId(null);
        setActiveContactSnapshot(null);
        activeContactRef.current = null;
        setActiveGroupId(null);
        activeGroupRef.current = null;
        setActiveDrawer(null);
      }
      return;
    }

    setActiveBrowserWindowId(null);
    setBrowserWindowMaximized(false);
    setActiveTab('desktop');
  }, [activeBrowserWindowId, applyBrowserWindowSocialState, browserWindows, openDesktop]);

  const browserTabs = useMemo(() => {
    const tabs = activeBrowserWindow?.tabs?.length
      ? activeBrowserWindow.tabs
      : (activeTab !== 'desktop' ? [activeTab] : []);
    const fallbackActiveIndex = Math.max(0, tabs.indexOf(activeTab));
    const activeTabIndex = Number.isInteger(activeBrowserWindow?.activeTabIndex)
      && activeBrowserWindow.activeTabIndex >= 0
      && activeBrowserWindow.activeTabIndex < tabs.length
      ? activeBrowserWindow.activeTabIndex
      : fallbackActiveIndex;
    return tabs.map((tab, index) => ({
      id: tab,
      index,
      key: `${tab}-${index}`,
      title: getBrowserTabLabel(tab),
      mark: getBrowserTabMark(tab),
      active: tab === activeTab && index === activeTabIndex,
    }));
  }, [activeBrowserWindow, activeTab, getBrowserTabLabel, getBrowserTabMark]);

  const getBrowserWindowTabs = useCallback((windowItem) => {
    const tabs = windowItem?.tabs?.length ? windowItem.tabs : [windowItem?.activeTab].filter(Boolean);
    const fallbackActiveIndex = Math.max(0, tabs.indexOf(windowItem?.activeTab));
    const activeTabIndex = Number.isInteger(windowItem?.activeTabIndex)
      && windowItem.activeTabIndex >= 0
      && windowItem.activeTabIndex < tabs.length
      ? windowItem.activeTabIndex
      : fallbackActiveIndex;

    return tabs.map((tab, index) => ({
      id: tab,
      index,
      key: `${windowItem?.id || 'window'}-${tab}-${index}`,
      title: getBrowserTabLabel(tab),
      mark: getBrowserTabMark(tab),
      active: tab === windowItem?.activeTab && index === activeTabIndex,
    }));
  }, [getBrowserTabLabel, getBrowserTabMark]);

  const getBrowserWindowAddress = useCallback((tab) => {
    const label = getBrowserTabLabel(tab);
    const appSlug = String(label || 'app')
      .trim()
      .replace(/\s+/g, '-');
    return `${window.location.host}/${appSlug}`;
  }, [getBrowserTabLabel]);

  const getBrowserWindowLayoutClasses = useCallback((windowItem, maximized = false) => {
    if (!windowItem) return '';
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
    const latestWindowItem = browserWindowsRef.current?.find(currentWindow => currentWindow.id === windowItem.id)
      || windowItem;
    const geometry = maximized || latestWindowItem.maximized
      ? {
          width: viewportWidth,
          height: Math.max(320, viewportHeight - taskbarHeight),
        }
      : clampBrowserWindowGeometry(latestWindowItem);
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const contentHeight = Math.max(260, geometry.height - chromeHeight);
    const classes = [];

    if (geometry.width <= 760) classes.push('is-window-tight');
    if (geometry.width > 760 && geometry.width <= 1020) classes.push('is-window-mid');
    if (geometry.width >= 1180) classes.push('is-window-wide');
    if (contentHeight <= 430) classes.push('is-window-low');
    if (contentHeight >= 620) classes.push('is-window-tall');

    return classes.join(' ');
  }, []);

  useEffect(() => {
    if (!activeBrowserWindowId || activeTab === 'desktop' || typeof window === 'undefined') return undefined;
    const timerId = window.setTimeout(() => {
      snapshotActiveBrowserWindow(activeBrowserWindowId);
    }, 140);
    return () => window.clearTimeout(timerId);
  }, [
    activeBrowserWindowId,
    activeContactId,
    activeGroupId,
    activeTab,
    browserWindowMaximized,
    contacts,
    groups,
    groupUnreadCounts,
    lang,
    snapshotActiveBrowserWindow,
  ]);

  useEffect(() => {
    clearRetiredThemeOverrides();
  }, []);

  // Use a ref to track the active contact ID without causing useEffect re-renders when it changes.
  const activeContactRef = useRef(activeContactId);
  useEffect(() => { activeContactRef.current = activeContactId; }, [activeContactId]);
  const activeGroupRef = useRef(activeGroupId);
  useEffect(() => { activeGroupRef.current = activeGroupId; }, [activeGroupId]);
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { browserWindowsRef.current = browserWindows; }, [browserWindows]);
  useEffect(() => {
    if (!activeBrowserWindowId || activeTab !== 'chats') return;
    updateBrowserWindowSocialState(activeBrowserWindowId, {
      activeContactId,
      activeGroupId,
      activeDrawer,
    });
  }, [
    activeBrowserWindowId,
    activeContactId,
    activeDrawer,
    activeGroupId,
    activeTab,
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
  }, []);
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

  useEffect(() => () => {
    desktopToastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    desktopToastTimersRef.current.clear();
  }, []);

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
  }, []);

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
  }, [playDesktopNotificationSound]);

  const isBrowserTabVisible = useCallback((tab) => {
    const currentWindowId = activeBrowserWindowIdRef.current;
    const currentWindow = browserWindowsRef.current.find(windowItem => windowItem.id === currentWindowId);
    return Boolean(
      currentWindow
      && !currentWindow.minimized
      && activeTabRef.current === tab
      && currentWindow.activeTab === tab
    );
  }, []);

  const isPrivateConversationVisible = useCallback((characterId) => (
    isBrowserTabVisible('chats')
    && String(activeContactRef.current || '') === String(characterId || '')
  ), [isBrowserTabVisible]);

  const isGroupConversationVisible = useCallback((groupId) => (
    isBrowserTabVisible('chats')
    && String(activeGroupRef.current || '') === String(groupId || '')
  ), [isBrowserTabVisible]);

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
        TIMESKIP: 'Time-skip activity',
        'time-skip-start': 'Time-skip started',
        'time-skip-end': 'Time-skip completed',
        'rent-settled': 'Rent settled',
        'social-housing-rental-chain': 'Housing recommendation updated',
        'social-housing-assigned': 'Housing assignment updated',
        'social-housing-ad': 'Agency listing published',
      }
      : {
        schedule_updated: '行程已更新',
        REROLL: '活动已重 roll',
        TIMESKIP: '时间飞逝活动',
        'time-skip-start': '时间飞逝开始',
        'time-skip-end': '时间飞逝完成',
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
  }, []);

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
  }, [openBrowserApp, openSimpleTabApp, pluginById]);

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
  }, [
    browserWindowTaskbarItems,
    contactsLoadError,
    decorateDesktopEventNotification,
    desktopEventNotifications,
    lang,
    openSocialApp,
    restoreBrowserWindow,
    socialUnreadCount,
  ]);

  const desktopToastItems = useMemo(() => (
    desktopToastNotifications.map(decorateDesktopEventNotification)
  ), [decorateDesktopEventNotification, desktopToastNotifications]);

  const openAddCharacterModal = useCallback((openCreatedCharacterInChat = false) => {
    AddCharacterModal.preload?.();
    openCreatedCharacterInChatRef.current = openCreatedCharacterInChat;
    setShowAddCharModal(true);
  }, []);

  const closeAddCharacterModal = useCallback(() => {
    openCreatedCharacterInChatRef.current = false;
    setShowAddCharModal(false);
  }, []);

  const handleCharacterAdded = useCallback((newChar) => {
    if (!newChar) {
      openCreatedCharacterInChatRef.current = false;
      return;
    }

    setContacts(prev => {
      const nextId = String(newChar.id || '');
      if (!nextId) return [...prev, newChar];
      const exists = prev.some(contact => String(contact.id) === nextId);
      return exists
        ? prev.map(contact => (String(contact.id) === nextId ? { ...contact, ...newChar } : contact))
        : [...prev, newChar];
    });

    if (openCreatedCharacterInChatRef.current && newChar.id) {
      setActiveTab('chats');
      setActiveGroupId(null);
      activeGroupRef.current = null;
      setActiveContactId(newChar.id);
      setActiveContactSnapshot(newChar);
      activeContactRef.current = newChar.id;
      setActiveDrawer(null);
    }

    openCreatedCharacterInChatRef.current = false;
  }, []);

  useEffect(() => {
    if (!activeContactId) {
      setActiveContactSnapshot(null);
      return;
    }
    const latest = contacts.find(c => c.id === activeContactId);
    if (latest) {
      setActiveContactSnapshot(latest);
    }
  }, [activeContactId, contacts]);

  useEffect(() => {
    if (activeTab !== 'chats' || activeContactId || activeGroupId || contacts.length === 0) return;
    const firstContact = contacts[0];
    setActiveContactId(firstContact.id);
    setActiveContactSnapshot(firstContact);
    activeContactRef.current = firstContact.id;
  }, [activeContactId, activeGroupId, activeTab, contacts]);

  // Use a ref to track which incoming messages we've already processed for unread badges and sounds
  const processedMessagesRef = useRef(new Set());
  const processedGroupMessagesRef = useRef(new Set());
  const cityRefreshRef = useRef(null);
  const contactsRefreshRef = useRef(null);

  useEffect(() => {
    const handleCharacterDataWiped = (event) => {
      const wipedId = event.detail?.characterId;
      if (!wipedId) return;
      setContacts(prev => prev.map(c => c.id === wipedId ? {
        ...c,
        lastMessage: '',
        time: '',
        unread: 0,
        affinity: c.initial_affinity ?? 50,
        pressure_level: 0,
        jealousy_level: 0,
        wallet: 200,
        calories: 2000,
        city_status: 'idle',
        location: 'home'
      } : c));
      if (activeContactRef.current === wipedId) {
        setActiveContactSnapshot(prev => prev ? {
          ...prev,
          lastMessage: '',
          time: '',
          unread: 0,
          affinity: prev.initial_affinity ?? 50,
          pressure_level: 0,
          jealousy_level: 0,
          wallet: 200,
          calories: 2000,
          city_status: 'idle',
          location: 'home'
        } : prev);
      }
    };
    window.addEventListener('character_data_wiped', handleCharacterDataWiped);
    return () => window.removeEventListener('character_data_wiped', handleCharacterDataWiped);
  }, []);

  const fetchContacts = useCallback(() => {
    if (!token) return;
    return fetch(`${API_URL}/characters`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        setContactsLoadError('');
        setContacts(prev => data.map(newContact => {
          const existing = prev.find(p => p.id === newContact.id);
          if (existing) {
            return {
              ...newContact,
              unread: existing.unread || 0,
              lastMessage: newContact.lastMessage || existing.lastMessage,
              time: newContact.time || existing.time
            };
          }
          return newContact;
        }));
        return data;
      })
      .catch(err => {
        console.error('Failed to load contacts:', err);
        setContactsLoadError(err.message || 'Failed to load contacts');
        return [];
      });
  }, [token]);

  const scheduleContactsRefresh = useCallback((delay = 350) => {
    if (contactsRefreshRef.current) {
      clearTimeout(contactsRefreshRef.current);
    }
    contactsRefreshRef.current = setTimeout(() => {
      contactsRefreshRef.current = null;
      fetchContacts();
    }, delay);
  }, [fetchContacts]);

  useEffect(() => {
    if (!token) return undefined;
    const handleRefreshContacts = () => {
      fetchContacts();
    };
    window.addEventListener('refresh_contacts', handleRefreshContacts);
    return () => window.removeEventListener('refresh_contacts', handleRefreshContacts);
  }, [fetchContacts, token]);

  const removeDeletedContact = useCallback((deletedId) => {
    if (!deletedId) return;
    const targetId = String(deletedId);
    setContacts(prev => prev.filter(contact => String(contact.id) !== targetId));
    setGroups(prev => prev.map(group => ({
      ...group,
      members: Array.isArray(group.members)
        ? group.members.filter(member => {
          const memberId = typeof member === 'object' ? member.member_id : member;
          return String(memberId) !== targetId;
        })
        : group.members
    })));
    setEngineState(prev => {
      if (!prev || !(targetId in prev)) return prev;
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    if (String(activeContactRef.current || '') === targetId) {
      activeContactRef.current = null;
      setActiveContactId(null);
      setActiveContactSnapshot(null);
      setActiveDrawer(null);
    }
  }, []);

  const preloadChatDrawer = useCallback((drawer) => {
    if (drawer === 'memo') MemoTable.preload?.();
    if (drawer === 'diary') DiaryTable.preload?.();
    if (drawer === 'settings') ChatSettingsDrawer.preload?.();
    if (drawer === 'group-manage') GroupManageDrawer.preload?.();
  }, []);

  const toggleChatDrawer = useCallback((drawer) => {
    preloadChatDrawer(drawer);
    setActiveDrawer((current) => (current === drawer ? null : drawer));
  }, [preloadChatDrawer]);

  const updateGroupInState = useCallback((updatedGroup) => {
    if (!updatedGroup?.id) return;
    setGroups((currentGroups) => (
      currentGroups.map((group) => (
        String(group.id) === String(updatedGroup.id) ? updatedGroup : group
      ))
    ));
  }, []);

  const resolveGroupSenderForDrawer = useCallback((senderId) => {
    const normalizedId = String(senderId || '');
    if (normalizedId === 'user') {
      const userName = effectiveUser?.name || 'User';
      return {
        name: userName,
        avatar: resolveAvatarUrl(effectiveUser?.avatar, API_URL, userName),
        avatar_frame: effectiveUser?.avatar_frame,
      };
    }

    const contact = contacts.find((item) => String(item.id) === normalizedId);
    const displayName = contact?.name || senderId || 'User';
    return {
      name: displayName,
      avatar: resolveAvatarUrl(contact?.avatar, API_URL, displayName),
      avatar_frame: contact?.avatar_frame,
    };
  }, [contacts, effectiveUser]);

  const handleGroupAddMember = useCallback(async (group, characterId) => {
    if (!group?.id || !characterId) return;
    try {
      const res = await fetch(`${API_URL}/groups/${group.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ member_id: characterId }),
      });
      const data = await res.json();
      if (data.success && data.group) {
        updateGroupInState(data.group);
      }
    } catch (error) {
      console.error('Add member failed:', error);
    }
  }, [updateGroupInState]);

  const handleGroupRename = useCallback(async (group, newName) => {
    if (!group?.id || !String(newName || '').trim()) return;
    try {
      const res = await fetch(`${API_URL}/groups/${group.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: String(newName).trim() }),
      });
      const data = await res.json();
      if (data.success && data.group) {
        updateGroupInState(data.group);
      }
    } catch (error) {
      console.error('Rename failed:', error);
    }
  }, [updateGroupInState]);

  const renderGroupSideSlot = useCallback(({ group, drawer, onClose }) => {
    const isManageDrawer = drawer === 'group-manage';
    return (
      <div className="private-chat-side-slot group-chat-side-slot" data-slot-view={isManageDrawer ? 'group-manage' : 'group-placeholder'}>
        {isManageDrawer && group ? (
          <GroupManageDrawer
            group={group}
            apiUrl={API_URL}
            resolveSender={resolveGroupSenderForDrawer}
            onClose={onClose}
            lang={lang}
            allContacts={contacts}
            onAddMember={(characterId) => handleGroupAddMember(group, characterId)}
            onRename={(newName) => handleGroupRename(group, newName)}
            onGroupUpdated={updateGroupInState}
          />
        ) : (
          <aside className="private-chat-journal group-chat-placeholder" aria-label={lang === 'en' ? 'Group side panel placeholder' : '群聊侧栏占位'}>
            <div className="private-chat-journal__head">
              <span className="private-chat-journal__icon">
                <UsersRound size={17} />
              </span>
              <div>
                <h3>{lang === 'en' ? 'Group Space' : '群聊侧栏'}</h3>
                <p>{lang === 'en' ? 'Reserved area' : '预留区域'}</p>
              </div>
              <span className="private-chat-journal__weather">
                <BookOpen size={14} />
              </span>
            </div>

            <section className="private-chat-journal__section group-chat-placeholder__section">
              <div className="private-chat-journal__section-title">
                <MessageSquare size={14} />
                <span>{lang === 'en' ? 'Waiting' : '先占位'}</span>
              </div>
              <p className="group-chat-placeholder__copy">
                {lang === 'en'
                  ? 'Keeping this side aligned with the private diary panel.'
                  : '这里先和私聊日记区保持同样占位，内容之后再定。'}
              </p>
            </section>
          </aside>
        )}
      </div>
    );
  }, [
    contacts,
    handleGroupAddMember,
    handleGroupRename,
    lang,
    resolveGroupSenderForDrawer,
    updateGroupInState,
  ]);

  // 1. Fetch Contacts (Characters) and Profile on mount
  useEffect(() => {
    if (!token) {
      setIsLoaded(true);
      return;
    }
    setIsLoaded(true);
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const userPromise = fetch(`${API_URL}/user`, { headers })
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        setUserProfile(data);
        if (data.avatar) localStorage.setItem('cp_avatar', data.avatar);
      })
      .catch(err => {
        console.error('Failed fetching user profile:', err);
      });

    const groupsPromise = fetch(`${API_URL}/groups`, { headers })
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => { setGroups(data); setGroupChatEnabled(true); })
      .catch(err => { console.warn('[DLC] Group Chat DLC not available:', err.message); setGroupChatEnabled(false); });

    const announcementPromise = fetch(`${API_URL}/system/announcement`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.announcement) {
          setGlobalAnnouncement(data.announcement.content);
        }
      })
      .catch(err => console.error('Failed to load announcement:', err));

    fetchContacts().then((loadedContacts) => {
      if (activeTabRef.current === 'chats' && !activeContactRef.current && !activeGroupRef.current && Array.isArray(loadedContacts) && loadedContacts.length > 0) {
        const first = loadedContacts[0];
        setActiveContactId(first.id);
        setActiveContactSnapshot(first);
        activeContactRef.current = first.id;
      }
    });

    void userPromise;
    void groupsPromise;
    void announcementPromise;
  }, [token, fetchContacts]);

  // Listen for iframe postMessage from SillyTavern parent
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'st_chat_changed') {
        const { characterId } = event.data;
        if (characterId) {
          fetchContacts(); // Ensure we have the latest list in case ST auto-created them
          setActiveTab('chats');
          setActiveContactId(characterId);
          setActiveGroupId(null);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchContacts, setActiveContactId, setActiveGroupId, setActiveTab]);

  // 2. Setup WebSocket for real-time messages
  useEffect(() => {
    if (!token) return;
    let ws = null;
    let reconnectTimer = null;
    let closedByCleanup = false;
    let hasOpenedWs = false;

    const connectWs = () => {
      reconnectTimer = null;
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token: token }));
        if (hasOpenedWs) {
          window.dispatchEvent(new Event('ws_reconnected'));
          scheduleContactsRefresh(100);
        }
        hasOpenedWs = true;
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(connectWs, 1200);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'new_message') {
            setIncomingMessageQueue(prev => [...prev, msg.data]);
            scheduleContactsRefresh();
          } else if (msg.type === 'tts_ready') {
            window.dispatchEvent(new CustomEvent('tts_ready', { detail: msg.data }));
          } else if (msg.type === 'engine_state') {
            setEngineState(msg.data);
          } else if (msg.type === 'group_message') {
            setIncomingGroupMessageQueue(prev => [...prev, msg.data]);
            scheduleContactsRefresh();
          } else if (msg.type === 'group_typing') {
            setGroupTyping(prev => {
              const key = msg.data.group_id;
              const current = prev[key] || [];
              if (current.find(t => t.sender_id === msg.data.sender_id)) return prev;
              return { ...prev, [key]: [...current, msg.data] };
            });
          } else if (msg.type === 'group_typing_stop') {
            setGroupTyping(prev => {
              const key = msg.data.group_id;
              return { ...prev, [key]: (prev[key] || []).filter(t => t.sender_id !== msg.data.sender_id) };
            });
          } else if (msg.type === 'wallet_sync') {
            const { characterId, characterWallet, userWallet } = msg.data;
            if (characterId && characterWallet !== null && characterWallet !== undefined) {
              setContacts(prev => prev.map(c => c.id === characterId ? { ...c, wallet: characterWallet } : c));
            }
            if (userWallet !== null && userWallet !== undefined) {
              setUserProfile(prev => prev ? { ...prev, wallet: userWallet } : prev);
            }
          } else if (msg.type === 'refresh_contacts') {
            window.dispatchEvent(new Event('refresh_contacts'));
            scheduleContactsRefresh(100);
          } else if (msg.type === 'character_deleted') {
            removeDeletedContact(msg.characterId || msg.data?.characterId);
            window.dispatchEvent(new CustomEvent('character_deleted', {
              detail: { characterId: msg.characterId || msg.data?.characterId }
            }));
            scheduleContactsRefresh(100);
          } else if (msg.type === 'announcement') {
            setGlobalAnnouncement(msg.content);
          } else if (msg.type === 'force_reload') {
            console.log('[WS] Force reload requested by server...');
            setTimeout(() => window.location.reload(), 500);
          } else if (msg.type === 'redpacket_claim') {
            setRedpacketClaimEvent({ ...msg.data, _ts: Date.now() });
          } else if (msg.type === 'memory_update') {
            console.log('[WS] Memory update received for character:', msg.characterId);
            window.dispatchEvent(new CustomEvent('memory_update', { detail: { characterId: msg.characterId } }));
          } else if (msg.type === 'memory_maintenance_progress') {
            window.dispatchEvent(new CustomEvent('memory_maintenance_progress', { detail: msg.data || {} }));
          } else if (msg.type === 'city_update') {
            window.dispatchEvent(new CustomEvent('city_update', { detail: msg }));
            scheduleContactsRefresh();
            const cityNotification = buildCityNotificationItem(msg);
            if (cityNotification) {
              const isCitySurfaceVisible = isBrowserTabVisible('city')
                || isBrowserTabVisible('commercial_street')
                || isBrowserTabVisible('housing_social');
              pushDesktopEventNotification(cityNotification, {
                toast: !isCitySurfaceVisible,
                sound: false,
              });
            }
            if (!cityRefreshRef.current) {
              cityRefreshRef.current = setTimeout(() => {
                cityRefreshRef.current = null;
                fetchContacts();
              }, 1200);
            }
            if (msg.action === 'schedule_generating') {
              setGeneratingSchedules(prev => ({ ...prev, [msg.charId]: true }));
            } else if (msg.action === 'schedule_updated') {
              setGeneratingSchedules(prev => ({ ...prev, [msg.charId]: false }));
            }
          }
        } catch (e) {
          console.error('WS Parse Error', e);
        }
      };
    };

    connectWs();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (contactsRefreshRef.current) {
        clearTimeout(contactsRefreshRef.current);
        contactsRefreshRef.current = null;
      }
      if (cityRefreshRef.current) {
        clearTimeout(cityRefreshRef.current);
        cityRefreshRef.current = null;
      }
      if (ws) ws.close();
    };
  }, [token, buildCityNotificationItem, fetchContacts, isBrowserTabVisible, pushDesktopEventNotification, scheduleContactsRefresh, removeDeletedContact]);

  // Update contact last message preview on new incoming message
  useEffect(() => {
    if (!incomingMessageQueue.length) return;

    const freshMessages = [];
    incomingMessageQueue.forEach((incomingMsg) => {
      if (!incomingMsg) return;
      const messageKey = incomingMsg.id
        ? `private:${incomingMsg.id}`
        : `private:${incomingMsg.character_id || 'unknown'}:${incomingMsg.timestamp || ''}:${incomingMsg.content || ''}`;
      if (processedMessagesRef.current.has(messageKey)) return;
      processedMessagesRef.current.add(messageKey);
      freshMessages.push(incomingMsg);
    });

    if (freshMessages.length === 0) return;

    let playedSound = false;
    freshMessages.forEach((incomingMsg) => {
      if (incomingMsg.role === 'user') return;
      const characterId = incomingMsg.character_id;
      const contact = contactsRef.current.find(c => String(c.id) === String(characterId));
      const isVisible = isPrivateConversationVisible(characterId);
      const shouldPlaySound = !playedSound && !isVisible;
      if (shouldPlaySound) playedSound = true;
      const title = contact?.name || (langRef.current === 'en' ? 'Private message' : '私聊消息');
      const preview = getDesktopNotificationPreview(
        incomingMsg.content,
        langRef.current === 'en' ? 'New private message' : '收到新的私聊消息'
      );

      pushDesktopEventNotification({
        kind: 'private',
        sourceId: characterId || 'unknown',
        target: { type: 'private', id: characterId },
        icon: MessageSquare,
        image: DESKTOP_APP_ICONS.social,
        appIcon: DESKTOP_APP_ICONS.social,
        appName: langRef.current === 'en' ? 'Social' : '社交',
        avatar: contact ? resolveAvatarUrl(contact.avatar, API_URL, contact.name || characterId || 'User') : '',
        avatarFrame: contact?.avatar_frame,
        fallbackAvatar: defaultAvatarUrl(contact?.name || characterId || 'User'),
        title,
        meta: preview,
        tone: 'pink',
      }, {
        toast: !isVisible,
        sound: shouldPlaySound,
      });
    });

    const messagesByContact = freshMessages.reduce((groupsByContact, incomingMsg) => {
      const key = String(incomingMsg.character_id || '');
      if (!key) return groupsByContact;
      if (!groupsByContact[key]) groupsByContact[key] = [];
      groupsByContact[key].push(incomingMsg);
      return groupsByContact;
    }, {});

    setContacts(prev => {
      let changed = false;
      const updatedContacts = prev.map((contact) => {
        const contactMessages = messagesByContact[String(contact.id)] || [];
        if (contactMessages.length === 0) return contact;
        changed = true;
        const incomingMsg = contactMessages[contactMessages.length - 1];
        const isReadInPlace = isPrivateConversationVisible(contact.id);
        const unreadDelta = contactMessages.filter(msg => msg.role !== 'user').length;
        const newUnread = isReadInPlace ? 0 : (Number(contact.unread) || 0) + unreadDelta;
        const messageTimestamp = Number(incomingMsg.timestamp || 0);
        const latestUserMessageTimestamp = contactMessages.reduce((latest, msg) => {
          if (msg.role !== 'user') return latest;
          return Math.max(latest, Number(msg.timestamp || 0));
        }, 0);
        const userMessageTimePatch = latestUserMessageTimestamp > 0
          ? {
            last_user_msg_time: latestUserMessageTimestamp,
            last_user_message_at: latestUserMessageTimestamp
          }
          : {};
        return {
          ...contact,
          lastMessage: incomingMsg.content,
          time: new Date(incomingMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: newUnread,
          last_message_at: messageTimestamp || contact.last_message_at,
          ...userMessageTimePatch
        };
      });
      return changed ? updatedContacts : prev;
    });
  }, [incomingMessageQueue, isPrivateConversationVisible, pushDesktopEventNotification]);

  useEffect(() => {
    if (!incomingGroupMessageQueue.length) return;

    const freshMessages = [];
    incomingGroupMessageQueue.forEach((incomingMsg) => {
      if (!incomingMsg) return;
      const groupId = incomingMsg.group_id || incomingMsg.groupId || '';
      const messageKey = incomingMsg.id
        ? `group:${groupId}:${incomingMsg.id}`
        : `group:${groupId}:${incomingMsg.timestamp || ''}:${incomingMsg.sender_id || ''}:${incomingMsg.content || ''}`;
      if (processedGroupMessagesRef.current.has(messageKey)) return;
      processedGroupMessagesRef.current.add(messageKey);
      freshMessages.push({ ...incomingMsg, group_id: groupId });
    });

    if (freshMessages.length === 0) return;

    let playedSound = false;
    const unreadDeltas = {};

    freshMessages.forEach((incomingMsg) => {
      const groupId = incomingMsg.group_id;
      if (!groupId) return;
      const isUserMessage = incomingMsg.sender_id === 'user' || incomingMsg.role === 'user';
      if (isUserMessage) return;

      const isVisible = isGroupConversationVisible(groupId);
      if (!isVisible) {
        unreadDeltas[groupId] = (unreadDeltas[groupId] || 0) + 1;
      }

      const group = groupsRef.current.find(g => String(g.id) === String(groupId));
      const sender = contactsRef.current.find(c => String(c.id) === String(incomingMsg.sender_id));
      const senderName = incomingMsg.sender_name
        || sender?.name
        || (incomingMsg.sender_id === 'system'
          ? (langRef.current === 'en' ? 'System' : '系统')
          : (langRef.current === 'en' ? 'Group member' : '群成员'));
      const preview = getDesktopNotificationPreview(
        incomingMsg.content,
        langRef.current === 'en' ? 'New group message' : '收到新的群聊消息'
      );
      const shouldPlaySound = !playedSound && !isVisible;
      if (shouldPlaySound) playedSound = true;

      pushDesktopEventNotification({
        kind: 'group',
        sourceId: groupId,
        target: { type: 'group', id: groupId },
        icon: UsersRound,
        image: DESKTOP_APP_ICONS.social,
        appIcon: DESKTOP_APP_ICONS.social,
        appName: langRef.current === 'en' ? 'Social' : '社交',
        title: group?.name || (langRef.current === 'en' ? 'Group chat' : '群聊消息'),
        meta: `${senderName}: ${preview}`,
        tone: 'pink',
      }, {
        toast: !isVisible,
        sound: shouldPlaySound,
      });
    });

    if (Object.keys(unreadDeltas).length > 0) {
      setGroupUnreadCounts((current) => {
        const next = { ...current };
        Object.entries(unreadDeltas).forEach(([groupId, delta]) => {
          next[groupId] = (Number(next[groupId]) || 0) + delta;
        });
        return next;
      });
    }
  }, [incomingGroupMessageQueue, isGroupConversationVisible, pushDesktopEventNotification]);

  useEffect(() => {
    if (!activeGroupId || !isGroupConversationVisible(activeGroupId)) return;
    setGroupUnreadCounts((current) => {
      if (!current[activeGroupId]) return current;
      const next = { ...current };
      delete next[activeGroupId];
      return next;
    });
  }, [activeBrowserWindowId, activeGroupId, activeTab, browserWindows, isGroupConversationVisible]);

  useEffect(() => {
    const hasCustomTransform = PRIVATE_CHAT_DECOR_TARGETS.some(({ id }) => (
      !isDecorTransformDefault(id, privateChatDecorTransforms[id])
    ));
    if (hasCustomTransform) {
      window.localStorage.setItem(PRIVATE_CHAT_DECOR_STORAGE_KEY, JSON.stringify(privateChatDecorTransforms));
    } else {
      window.localStorage.removeItem(PRIVATE_CHAT_DECOR_STORAGE_KEY);
    }
  }, [privateChatDecorTransforms]);

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
  }, [activeTab, effectiveUser]);

  const isViewingList = (activeTab === 'contacts' || (activeTab === 'chats' && !activeContactId && !activeGroupId));
  const isPrivateChatView = activeTab === 'chats' && !!activeContactId;
  const isChatSceneView = activeTab === 'chats' && (!!activeContactId || !!activeGroupId);
  const isContactsSceneView = activeTab === 'contacts';
  const isStaticPixelSceneView = activeTab === 'memory_library' || activeTab === 'mcp_lab' || activeTab === 'settings' || activeTab === 'housing_social';
  const isBarePixelSceneView = activeTab === 'commercial_street' || activeTab === 'pixel_cottage' || activeTab === 'city';
  const activeGroup = activeGroupId
    ? groups.find(group => String(group.id) === String(activeGroupId))
    : null;
  const shouldShowSocialWindowLoading = activeTab === 'chats' && (
    (!activeContactId && !activeGroupId && contacts.length === 0 && !contactsLoadError)
    || (!!activeContactId && !activeChatContact)
    || (!!activeGroupId && !activeGroup)
  );
  function renderPrivateChatForegroundScene({ includeEditor = false } = {}) {
    return (
      <>
        <div className="private-chat-floor-decor" aria-hidden="true">
          <div className="private-chat-stage-layer private-chat-floor-stage">
            <img
              className="private-chat-scene-decor__floor"
              data-private-decor-id="floor"
              style={getPrivateChatDecorStyle('floor')}
              src="/assets/ui/private-chat/pixel-foreground-floor-ai-grid.png?v=20260702-crop-top2"
              alt=""
            />
          </div>
        </div>
        <div className="private-chat-scene-decor" aria-hidden="true">
          <div className="private-chat-stage-layer private-chat-scene-stage">
            <img
              className="private-chat-scene-decor__left"
              data-private-decor-id="left"
              style={getPrivateChatDecorStyle('left')}
              src="/assets/ui/private-chat/pixel-foreground-left-cart.png?v=20260708-glass-light1"
              alt=""
            />
            <img
              className="private-chat-scene-decor__right"
              data-private-decor-id="right"
              style={getPrivateChatDecorStyle('right')}
              src="/assets/ui/private-chat/pixel-foreground-right-sign.png?v=20260702-recut1"
              alt=""
            />
          </div>
        </div>
        {includeEditor && (
          <PrivateChatDecorEditor
            open={privateChatDecorEditorOpen}
            onOpenChange={setPrivateChatDecorEditorOpenPersisted}
            transforms={privateChatDecorTransforms}
            setTransforms={setPrivateChatDecorTransforms}
            isPrivateChatView={hasForegroundSceneView}
            lang={lang}
          />
        )}
      </>
    );
  }

  const renderLiveSocialWindowContent = useCallback((windowItem) => {
    const socialState = normalizeBrowserWindowSocialState(windowItem?.social || {});
    const liveContact = socialState.activeContactId
      ? contacts.find(contact => String(contact.id) === String(socialState.activeContactId))
      : null;
    const liveGroup = socialState.activeGroupId
      ? groups.find(group => String(group.id) === String(socialState.activeGroupId))
      : null;
    const liveDrawer = socialState.activeDrawer || null;
    const liveWindowId = windowItem?.id;

    const updateLiveSocial = (patch) => {
      updateBrowserWindowSocialState(liveWindowId, patch);
    };
    const toggleLiveDrawer = (drawer) => {
      preloadChatDrawer(drawer);
      updateLiveSocial({ activeDrawer: liveDrawer === drawer ? null : drawer });
    };
    const handleLiveContactSelect = (id) => {
      const selected = contacts.find(contact => String(contact.id) === String(id));
      updateLiveSocial({
        activeContactId: selected?.id || id,
        activeGroupId: null,
        activeDrawer: liveDrawer,
      });
      setContacts(prev => prev.map(contact => String(contact.id) === String(id) ? { ...contact, unread: 0 } : contact));
    };
    const handleLiveGroupSelect = (groupId) => {
      updateLiveSocial({
        activeContactId: null,
        activeGroupId: groupId,
        activeDrawer: null,
      });
      setGroupUnreadCounts((current) => {
        if (!current[groupId]) return current;
        const next = { ...current };
        delete next[groupId];
        return next;
      });
    };
    const handleLiveSwitchTab = (nextTab) => {
      if (!liveWindowId) return;
      setBrowserWindows((currentWindows) => currentWindows.map((currentWindow) => (
        currentWindow.id === liveWindowId
          ? {
            ...currentWindow,
            tabs: currentWindow.tabs?.includes(nextTab) ? currentWindow.tabs : [...(currentWindow.tabs || []), nextTab],
            activeTab: nextTab,
            activeTabIndex: Math.max(0, (currentWindow.tabs || []).includes(nextTab)
              ? (currentWindow.tabs || []).indexOf(nextTab)
              : (currentWindow.tabs || []).length),
          }
          : currentWindow
      )));
    };

    return (
      <div
        key={`live-social-window-${liveWindowId || 'unknown'}`}
        className="desktop-live-social-window"
        data-desktop-app-tab="chats"
      >
        <div className="middle-column">
          <div className="middle-column-heading">
            <div className="private-chat-heading-actions">
              <button
                type="button"
                className="private-chat-create-character-button"
                onClick={() => openAddCharacterModal(true)}
                title={lang === 'en' ? 'Create character and open chat' : '创建角色并进入私聊'}
                aria-label={lang === 'en' ? 'Create character and open chat' : '创建角色并进入私聊'}
              >
                <UserPlus size={18} />
              </button>
            </div>
          </div>
          <div className="search-bar-container">
            <input type="text" className="search-bar" placeholder={t('Search') || 'Search'} />
          </div>
          <div className="list-container">
            <ContactList
              apiUrl={API_URL}
              contacts={contacts}
              activeId={liveContact?.id || null}
              engineState={engineState}
              onSelect={handleLiveContactSelect}
            />
            {groupChatEnabled && groups.length > 0 && (
              <div style={{ borderTop: '1px solid #eee' }}>
                <div style={{ padding: '5px 15px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                  {lang === 'en' ? 'Group Chats' : '群聊'}
                </div>
                {groups.map(group => {
                  const memberCount = group.members?.length || 0;
                  const groupAvatarSize = memberCount <= 1 ? 58 : 46;
                  const groupAvatarOverlap = memberCount <= 1 ? 0 : -18;
                  const unreadCount = Number(groupUnreadCounts[group.id]) || 0;

                  return (
                    <div
                      key={`live-${liveWindowId}-group-${group.id}`}
                      className={`contact-item group-contact-item ${liveGroup?.id === group.id ? 'active' : ''}`}
                      title={group.name}
                      aria-label={lang === 'en' ? `${group.name}, group chat` : `${group.name}，群聊`}
                      onClick={() => handleLiveGroupSelect(group.id)}
                    >
                      <div className="contact-avatar group-contact-avatar" style={{ width: 'auto', minWidth: '42px', height: '42px', display: 'flex', alignItems: 'center' }}>
                        {group.members?.slice(0, 4).map((memberObj, idx) => {
                          const memberId = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                          const member = contacts.find(contact => String(contact.id) === String(memberId));
                          const memberName = memberId === 'user'
                            ? userProfile?.name || 'User'
                            : member?.name || memberId || 'User';
                          const memberAvatar = memberId === 'user'
                            ? resolveAvatarUrl(userProfile?.avatar, API_URL, memberName)
                            : resolveAvatarUrl(member?.avatar, API_URL, memberName);
                          const memberFrame = memberId === 'user' ? userProfile?.avatar_frame : member?.avatar_frame;
                          return (
                            <AvatarWithFrame
                              key={`${memberId}-${idx}`}
                              size={groupAvatarSize}
                              frame={memberFrame}
                              src={memberAvatar}
                              fallbackSrc={defaultAvatarUrl(memberName)}
                              alt=""
                              style={{ marginLeft: idx > 0 ? `${groupAvatarOverlap}px` : '0', zIndex: 10 - idx }}
                              imageStyle={{ border: memberCount === 1 ? '1px solid rgba(255, 111, 151, 0.28)' : '2px solid #fff' }}
                            />
                          );
                        })}
                        {(!group.members || group.members.length === 0) && (
                          <div style={{ width: `${groupAvatarSize}px`, height: `${groupAvatarSize}px`, backgroundColor: '#e1e1e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <UsersRound size={22} style={{ color: '#fff' }} />
                          </div>
                        )}
                      </div>
                      <div className="group-contact-item__body">
                        <span className="group-contact-item__name">{group.name}</span>
                        <span className="group-contact-item__meta">{lang === 'en' ? `${memberCount} members` : `${memberCount} 位成员`}</span>
                      </div>
                      {unreadCount > 0 && <span className="unread-badge">{formatBadge(unreadCount)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="right-column" style={{ flexDirection: 'row' }}>
          {liveContact ? (
            <div className="private-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minWidth: 0 }}>
              <div className="private-chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <ChatWindow
                  contact={liveContact}
                  allContacts={contacts}
                  userAvatar={effectiveUser?.avatar}
                  userAvatarFrame={effectiveUser?.avatar_frame}
                  apiUrl={API_URL}
                  incomingMessageQueue={incomingMessageQueue}
                  engineState={engineState}
                  onToggleMemo={() => toggleLiveDrawer('memo')}
                  onToggleDiary={() => toggleLiveDrawer('diary')}
                  onToggleSettings={() => toggleLiveDrawer('settings')}
                  onPreloadMemo={() => preloadChatDrawer('memo')}
                  onPreloadDiary={() => preloadChatDrawer('diary')}
                  onPreloadSettings={() => preloadChatDrawer('settings')}
                  onBack={() => updateLiveSocial({ activeContactId: null, activeGroupId: null })}
                  onSwitchTab={handleLiveSwitchTab}
                  isGeneratingSchedule={generatingSchedules[liveContact.id]}
                  onMessagesChange={setHiddenMessagesCount}
                  isPrivateChatForegroundEnabled={privateChatForegroundEnabled}
                  chatLayoutKey={liveDrawer || 'journal'}
                />
              </div>
              <div className="private-chat-side-slot" data-slot-view={liveDrawer || 'journal'}>
                {!liveDrawer && (
                  <PrivateChatJournalPanel
                    contact={liveContact}
                    lang={lang}
                    onOpenDiary={() => toggleLiveDrawer('diary')}
                  />
                )}
                {liveDrawer === 'memo' && (
                  <PrivateChatDrawerShell type="memo">
                    <AppErrorBoundary
                      variant="drawer"
                      resetKey={`live-drawer:memo:${liveWindowId}:${liveContact.id}`}
                      lang={lang}
                      title={`${liveContact?.name || (lang === 'en' ? 'Character' : '角色')} ${lang === 'en' ? "'s Memories" : '的记忆'}`}
                      onClose={() => updateLiveSocial({ activeDrawer: null })}
                    >
                      <Suspense fallback={<DrawerFallback type="memo" contact={liveContact} lang={lang} onClose={() => updateLiveSocial({ activeDrawer: null })} />}>
                        <MemoTable
                          contact={liveContact}
                          apiUrl={API_URL}
                          onClose={() => updateLiveSocial({ activeDrawer: null })}
                        />
                      </Suspense>
                    </AppErrorBoundary>
                  </PrivateChatDrawerShell>
                )}
                {liveDrawer === 'diary' && (
                  <PrivateChatDrawerShell type="diary">
                    <AppErrorBoundary
                      variant="drawer"
                      resetKey={`live-drawer:diary:${liveWindowId}:${liveContact.id}`}
                      lang={lang}
                      title={`${liveContact?.name || (lang === 'en' ? 'Character' : '角色')} ${lang === 'en' ? "'s Diary" : '的日记'}`}
                      onClose={() => updateLiveSocial({ activeDrawer: null })}
                    >
                      <Suspense fallback={<DrawerFallback type="diary" contact={liveContact} lang={lang} onClose={() => updateLiveSocial({ activeDrawer: null })} />}>
                        <DiaryTable
                          contact={liveContact}
                          apiUrl={API_URL}
                          onClose={() => updateLiveSocial({ activeDrawer: null })}
                        />
                      </Suspense>
                    </AppErrorBoundary>
                  </PrivateChatDrawerShell>
                )}
                {liveDrawer === 'settings' && (
                  <PrivateChatDrawerShell type="settings">
                    <AppErrorBoundary
                      variant="drawer"
                      resetKey={`live-drawer:settings:${liveWindowId}:${liveContact.id}`}
                      lang={lang}
                      title={lang === 'en' ? 'Chat Settings' : '聊天设置'}
                      onClose={() => updateLiveSocial({ activeDrawer: null })}
                    >
                      <Suspense fallback={<DrawerFallback type="settings" contact={liveContact} lang={lang} onClose={() => updateLiveSocial({ activeDrawer: null })} />}>
                        <ChatSettingsDrawer
                          contact={liveContact}
                          contacts={contacts}
                          apiUrl={API_URL}
                          onClose={() => updateLiveSocial({ activeDrawer: null })}
                          onClearHistory={() => {
                            updateLiveSocial({ activeDrawer: null });
                            fetchContacts();
                          }}
                          isGeneratingSchedule={!!generatingSchedules[liveContact.id]}
                          messagesHideStateCount={hiddenMessagesCount}
                        />
                      </Suspense>
                    </AppErrorBoundary>
                  </PrivateChatDrawerShell>
                )}
              </div>
            </div>
          ) : liveGroup ? (
            <div className="group-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minWidth: 0 }}>
              <GroupChatWindow
                group={liveGroup}
                apiUrl={API_URL}
                allContacts={contacts}
                userProfile={effectiveUser}
                incomingGroupMessageQueue={incomingGroupMessageQueue}
                typingIndicators={groupTyping[liveGroup.id] || []}
                redpacketClaimEvent={redpacketClaimEvent}
                onBack={() => updateLiveSocial({ activeContactId: null, activeGroupId: null, activeDrawer: null })}
                onGroupUpdated={updateGroupInState}
                isManageOpen={liveDrawer === 'group-manage'}
                onToggleManage={() => toggleLiveDrawer('group-manage')}
                onCloseManage={() => updateLiveSocial({ activeDrawer: null })}
              />
              {renderGroupSideSlot({
                group: liveGroup,
                drawer: liveDrawer,
                onClose: () => updateLiveSocial({ activeDrawer: null }),
              })}
            </div>
          ) : (
            <div className="empty-chat-state">
              <MessageSquare size={64} className="empty-icon" />
              <p>{lang === 'en' ? 'Select a conversation' : '选择一个会话'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }, [
    API_URL,
    contacts,
    effectiveUser,
    engineState,
    fetchContacts,
    formatBadge,
    generatingSchedules,
    groupChatEnabled,
    groupTyping,
    groupUnreadCounts,
    groups,
    hiddenMessagesCount,
    incomingGroupMessageQueue,
    incomingMessageQueue,
    lang,
    normalizeBrowserWindowSocialState,
    openAddCharacterModal,
    preloadChatDrawer,
    privateChatForegroundEnabled,
    privateChatDecorTransforms,
    privateChatDecorEditorOpen,
    redpacketClaimEvent,
    renderGroupSideSlot,
    setGroups,
    setPrivateChatDecorEditorOpenPersisted,
    t,
    updateBrowserWindowSocialState,
    updateGroupInState,
    userProfile,
  ]);

  const renderDesktopWindowContent = useCallback((tab, options = {}) => {
    const surfaceKey = options.surfaceKey || tab;
    const Plugin = visiblePlugins.find(p => p.id === tab);

    if (tab === 'chats') {
      return (
        <div
          key={`social-loading-${surfaceKey}`}
          className={`${getDesktopAppSurfaceClass('chats')} desktop-app-surface--social-loading`}
          data-desktop-app-tab="chats"
        >
          <PanelFallback />
        </div>
      );
    }

    if (Plugin) {
      const PluginComponent = Plugin.component;
      return (
        <div
          key={`plugin-surface-${surfaceKey}`}
          className={getDesktopAppSurfaceClass(tab)}
          data-desktop-app-tab={tab}
        >
          <PluginComponent
            apiUrl={API_URL}
            userProfile={effectiveUser}
          />
        </div>
      );
    }

    if (tab === 'settings') {
      return (
        <div
          key={`settings-surface-${surfaceKey}`}
          className={getDesktopAppSurfaceClass('settings')}
          data-desktop-app-tab="settings"
        >
          <SettingsPanel
            apiUrl={API_URL}
            contacts={contacts}
            desktopWallpaper={desktopWallpaper}
            wallpaperOptions={DESKTOP_WALLPAPER_OPTIONS}
            onDesktopWallpaperChange={handleDesktopWallpaperChange}
            onCharactersUpdate={(event) => {
              if (event?.type === 'deleted') {
                removeDeletedContact(event.id);
              }
              fetchContacts();
            }}
            onProfileUpdate={setUserProfile}
            onBack={() => setActiveTab('chats')}
          />
        </div>
      );
    }

    if (tab === 'memory_library') {
      return (
        <div
          key={`memory-library-surface-${surfaceKey}`}
          className={getDesktopAppSurfaceClass('memory_library')}
          data-desktop-app-tab="memory_library"
        >
          <MemoryLibraryPanel apiUrl={API_URL} contacts={contacts} />
        </div>
      );
    }

    return (
      <div className="empty-chat-state">
        <MessageSquare size={64} className="empty-icon" />
        <p>ChatPulse</p>
      </div>
    );
  }, [
    API_URL,
    contacts,
    desktopWallpaper,
    effectiveUser,
    fetchContacts,
    handleDesktopWallpaperChange,
    removeDeletedContact,
    setUserProfile,
    visiblePlugins,
  ]);
  const hasPixelSceneView = isChatSceneView || isContactsSceneView || isStaticPixelSceneView;
  const hasPixelSkinView = hasPixelSceneView || isBarePixelSceneView || activeTab === 'chats';
  const hasForegroundSceneView = isPrivateChatView && privateChatForegroundEnabled && !shouldShowSocialWindowLoading;
  const isForegroundExitingSceneView = isPrivateChatView && !privateChatForegroundEnabled && privateChatForegroundExiting && !shouldShowSocialWindowLoading;
  const shouldRenderForegroundScene = hasForegroundSceneView || isForegroundExitingSceneView;
  const isForegroundLayoutLifted = shouldRenderForegroundScene;
  const shouldEnableForegroundPersonControl = false;
  const appWallpaperKey = normalizeDesktopWallpaper(desktopWallpaper);
  const appWallpaperImageSrc = DESKTOP_WALLPAPER_IMAGE_URLS[appWallpaperKey];
  const appWallpaperAnimated = appWallpaperKey === 'ocean-live2d';

  useEffect(() => {
    if (!shouldEnableForegroundPersonControl) return undefined;

    const moveByKey = {
      w: true,
      a: true,
      s: true,
      d: true,
    };

    let animationFrameId = 0;
    let lastTickAt = performance.now();
    let lastFrameAt = lastTickAt;
    let walkFrame = privateChatForegroundPersonPositionRef.current.frame || 0;
    const personCollisionSize = { width: 64 * 1.8, height: 80 * 1.8 };
    const decorCollisionTargets = [
      {
        selector: '.private-chat-scene-decor__left',
        inset: { top: 34, right: 22, bottom: 8, left: 20 },
      },
      {
        selector: '.private-chat-scene-decor__right',
        inset: { top: 26, right: 18, bottom: 6, left: 22 },
      },
    ];

    const intersectsRect = (a, b) => (
      a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top
    );

    const getControllingForegroundRoot = () => {
      const roots = Array.from(document.querySelectorAll('.app-container.tab-chats.has-private-chat.is-private-chat-scene.is-foreground-lifted'));
      if (!roots.length) return null;
      return roots.find(root => !root.classList.contains('desktop-browser-live-window'))
        || roots[roots.length - 1]
        || null;
    };

    const getPersonCollisionRect = (position) => {
      const lane = getControllingForegroundRoot()?.querySelector('.private-chat-pet-lane');
      if (!lane) return null;
      const laneRect = lane.getBoundingClientRect();
      const centerX = laneRect.left + (laneRect.width / 2) + position.x;
      const bottom = laneRect.bottom + position.y;
      return {
        left: centerX - (personCollisionSize.width / 2),
        right: centerX + (personCollisionSize.width / 2),
        top: bottom - personCollisionSize.height,
        bottom,
      };
    };

    const getDecorCollisionRects = () => decorCollisionTargets
      .map(({ selector, inset }) => {
        const element = getControllingForegroundRoot()?.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
          left: rect.left + inset.left,
          right: rect.right - inset.right,
          top: rect.top + inset.top,
          bottom: rect.bottom - inset.bottom,
        };
      })
      .filter(Boolean);

    const collidesWithDecor = (position, decorRects) => {
      const personRect = getPersonCollisionRect(position);
      if (!personRect) return false;
      return decorRects.some((decorRect) => intersectsRect(personRect, decorRect));
    };

    const resolveDecorCollision = (previous, desired) => {
      const decorRects = getDecorCollisionRects();
      if (!collidesWithDecor(desired, decorRects)) return desired;

      const xOnly = normalizeForegroundPersonPosition({
        ...desired,
        y: previous.y,
      });
      if (!collidesWithDecor(xOnly, decorRects)) return xOnly;

      const yOnly = normalizeForegroundPersonPosition({
        ...desired,
        x: previous.x,
      });
      if (!collidesWithDecor(yOnly, decorRects)) return yOnly;

      return normalizeForegroundPersonPosition({
        ...previous,
        direction: desired.direction,
        frame: desired.frame,
      });
    };

    const shouldIgnoreKeyTarget = (target) => {
      const tagName = target?.tagName?.toLowerCase();
      return target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    };

    const nudgeForegroundPersonForKeyPress = (event) => {
      const keys = privateChatForegroundPersonKeysRef.current;
      let deltaX = 0;
      let deltaY = 0;
      if (keys.has('a')) deltaX -= 1;
      if (keys.has('d')) deltaX += 1;
      if (keys.has('w')) deltaY -= 1;
      if (keys.has('s')) deltaY += 1;
      if (deltaX === 0 && deltaY === 0) return;

      const length = Math.hypot(deltaX, deltaY) || 1;
      const speed = keys.has('shift') || event.shiftKey ? 320 : 190;
      const direction = deltaX < 0
        ? 'left'
        : deltaX > 0
          ? 'right'
          : deltaY < 0
            ? 'back'
            : 'front';
      walkFrame = (walkFrame + 1) % 4;
      lastFrameAt = performance.now();

      const previous = privateChatForegroundPersonPositionRef.current;
      const desired = normalizeForegroundPersonPosition({
        x: previous.x + (deltaX / length) * speed * 0.075,
        y: previous.y + (deltaY / length) * speed * 0.075,
        direction,
        frame: walkFrame,
      });
      const next = resolveDecorCollision(previous, desired);
      privateChatForegroundPersonPositionRef.current = next;
      setPrivateChatForegroundPersonPosition(next);
      savePrivateChatForegroundPersonPosition(next);
      privateChatForegroundPersonLastSaveRef.current = performance.now();
    };

    const normalizeMoveKey = (event) => {
      const key = String(event.key || '').toLowerCase();
      if (moveByKey[key] || key === 'shift') return key;
      const code = String(event.code || '').toLowerCase();
      if (code.startsWith('key')) {
        const codeKey = code.slice(3);
        if (moveByKey[codeKey]) return codeKey;
      }
      return key;
    };

    const updatePressedKey = (event, pressed) => {
      const key = normalizeMoveKey(event);
      if (key === 'shift') {
        if (pressed) {
          privateChatForegroundPersonKeysRef.current.add('shift');
        } else {
          privateChatForegroundPersonKeysRef.current.delete('shift');
        }
        return;
      }

      if (!moveByKey[key]) return;
      if (shouldIgnoreKeyTarget(event.target)) return;

      event.preventDefault();
      if (pressed) {
        const wasPressed = privateChatForegroundPersonKeysRef.current.has(key);
        privateChatForegroundPersonKeysRef.current.add(key);
        if (!wasPressed) {
          nudgeForegroundPersonForKeyPress(event);
        }
      } else {
        privateChatForegroundPersonKeysRef.current.delete(key);
      }
    };

    const animateForegroundPerson = (now) => {
      const keys = privateChatForegroundPersonKeysRef.current;
      const elapsedSeconds = Math.min((now - lastTickAt) / 1000, 0.05);
      lastTickAt = now;

      let deltaX = 0;
      let deltaY = 0;
      if (keys.has('a')) deltaX -= 1;
      if (keys.has('d')) deltaX += 1;
      if (keys.has('w')) deltaY -= 1;
      if (keys.has('s')) deltaY += 1;

      const isMoving = deltaX !== 0 || deltaY !== 0;
      if (isMoving) {
        const length = Math.hypot(deltaX, deltaY) || 1;
        const speed = keys.has('shift') ? 320 : 190;
        const direction = deltaX < 0
          ? 'left'
          : deltaX > 0
            ? 'right'
            : deltaY < 0
              ? 'back'
              : 'front';

        if (now - lastFrameAt >= 90) {
          walkFrame = (walkFrame + 1) % 4;
          lastFrameAt = now;
        }

        const previous = privateChatForegroundPersonPositionRef.current;
        const desired = normalizeForegroundPersonPosition({
          x: previous.x + (deltaX / length) * speed * elapsedSeconds,
          y: previous.y + (deltaY / length) * speed * elapsedSeconds,
          direction,
          frame: walkFrame,
        });
        const next = resolveDecorCollision(previous, desired);
        privateChatForegroundPersonPositionRef.current = next;
        setPrivateChatForegroundPersonPosition(next);

        if (now - privateChatForegroundPersonLastSaveRef.current >= 180) {
          savePrivateChatForegroundPersonPosition(next);
          privateChatForegroundPersonLastSaveRef.current = now;
        }
      } else if (privateChatForegroundPersonPositionRef.current.frame !== 0) {
        const next = normalizeForegroundPersonPosition({
          ...privateChatForegroundPersonPositionRef.current,
          frame: 0,
        });
        privateChatForegroundPersonPositionRef.current = next;
        setPrivateChatForegroundPersonPosition(next);
        savePrivateChatForegroundPersonPosition(next);
      }

      animationFrameId = window.requestAnimationFrame(animateForegroundPerson);
    };

    const handleKeyDown = (event) => updatePressedKey(event, true);
    const handleKeyUp = (event) => updatePressedKey(event, false);

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    animationFrameId = window.requestAnimationFrame(animateForegroundPerson);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.cancelAnimationFrame(animationFrameId);
      privateChatForegroundPersonKeysRef.current.clear();
      savePrivateChatForegroundPersonPosition(privateChatForegroundPersonPositionRef.current);
    };
  }, [shouldEnableForegroundPersonControl]);

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

  return (
    <div style={activeBrowserWindowStyle} className={`app-container tab-${activeTab} ${browserWindowMaximized ? 'is-window-maximized' : 'is-window-floating'} ${activeBrowserWindowLayoutClasses} ${browserWindowInteractionMode ? `is-window-${browserWindowInteractionMode}` : ''} ${browserWindowGeometrySwitchingWindowId === activeBrowserWindowId ? 'is-window-geometry-switching' : ''} ${browserWindowRecallPulse?.windowId === activeBrowserWindowId ? 'is-window-recall-pulse' : ''} ${browserWindowMergeTargetId && browserWindowMergeTargetId === activeBrowserWindowId ? 'is-window-merge-target' : ''} ${shouldShowSocialWindowLoading ? 'is-social-window-loading' : ''} ${activeContactId || activeGroupId ? 'has-active-chat' : 'no-active-chat'} ${isViewingList ? 'viewing-list' : 'viewing-content'} ${hasPixelSkinView ? 'has-chat-skin has-private-chat' : ''} ${isPrivateChatView ? 'is-private-chat-scene' : ''} ${isContactsSceneView ? 'is-contacts-scene' : ''} ${isStaticPixelSceneView ? 'is-static-pixel-scene' : ''} ${isBarePixelSceneView ? 'is-bare-pixel-scene' : ''} ${activeGroupId && activeTab === 'chats' ? 'is-group-chat-scene' : ''} ${hasForegroundSceneView ? 'is-foreground-enabled' : 'is-foreground-disabled'} ${isForegroundExitingSceneView ? 'is-foreground-exiting' : ''} ${isForegroundLayoutLifted ? 'is-foreground-lifted' : ''} ${privateChatDecorEditorOpen ? 'is-decor-editing' : ''}`}>
      {globalAnnouncement && (
        <div style={{ position: 'absolute', top: 0, left: '70px', right: 0, zIndex: 9999, background: 'var(--primary, #07c160)', color: 'white', padding: '10px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 'bold' }}>📢</span>
          <span>{globalAnnouncement}</span>
          <button onClick={() => setGlobalAnnouncement(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', marginLeft: 'auto', fontSize: '20px', padding: '0 5px' }}>&times;</button>
        </div>
      )}
      {activeTab !== 'desktop' && appWallpaperImageSrc && (
        <div className="desktop-wallpaper-backdrop" aria-hidden="true">
          <Live2DDesktopWallpaper src={appWallpaperImageSrc} animated={appWallpaperAnimated} />
        </div>
      )}
      {activeTab !== 'desktop' && (!browserWindowMaximized || isPrivateChatView || isForegroundExitingSceneView) && (
        <div className="desktop-home-underlay" aria-hidden="true">
          <ChatPulseDesktop
            lang={lang}
            apps={desktopApps}
            desktopWallpaper={desktopWallpaper}
            onDesktopWallpaperChange={handleDesktopWallpaperChange}
            showWallpaper={false}
          />
        </div>
      )}
      {shouldRenderForegroundScene && (
        renderPrivateChatForegroundScene({ includeEditor: true })
      )}
      {activeTab !== 'desktop' && !browserWindowMaximized && browserWindows
        .filter(windowItem => !windowItem.minimized && windowItem.id !== activeBrowserWindowId)
        .map((windowItem, index) => {
          const liveTabs = getBrowserWindowTabs(windowItem);
          const liveAddress = getBrowserWindowAddress(windowItem.activeTab);
          const liveIsMaximized = Boolean(windowItem.maximized);
          const liveLayoutClasses = getBrowserWindowLayoutClasses(windowItem, liveIsMaximized);
          const liveSocialState = normalizeBrowserWindowSocialState(windowItem.social || {});
          const liveHasActiveChat = windowItem.activeTab === 'chats'
            && (liveSocialState.activeContactId || liveSocialState.activeGroupId);
          const liveHasPixelSkin = windowItem.activeTab === 'chats';
          const liveIsPrivateChat = windowItem.activeTab === 'chats' && !!liveSocialState.activeContactId;
          const liveIsGroupChat = windowItem.activeTab === 'chats' && !!liveSocialState.activeGroupId;
          const liveHasBoundContact = !liveSocialState.activeContactId
            || contacts.some(contact => String(contact.id) === String(liveSocialState.activeContactId));
          const liveHasBoundGroup = !liveSocialState.activeGroupId
            || groups.some(group => String(group.id) === String(liveSocialState.activeGroupId));
          const liveIsSocialLoading = windowItem.activeTab === 'chats' && (
            (!liveSocialState.activeContactId && !liveSocialState.activeGroupId && contacts.length === 0 && !contactsLoadError)
            || !liveHasBoundContact
            || !liveHasBoundGroup
          );
          const liveHasForegroundScene = liveIsPrivateChat && privateChatForegroundEnabled && !liveIsSocialLoading;
          const liveIsStaticPixel = windowItem.activeTab === 'memory_library'
            || windowItem.activeTab === 'mcp_lab'
            || windowItem.activeTab === 'settings'
            || windowItem.activeTab === 'housing_social';
          const liveIsBarePixel = windowItem.activeTab === 'commercial_street'
            || windowItem.activeTab === 'pixel_cottage'
            || windowItem.activeTab === 'city';
          const liveSurfaceClasses = [
            liveHasActiveChat ? 'has-active-chat viewing-content' : 'no-active-chat viewing-list',
            liveIsSocialLoading ? 'is-social-window-loading' : '',
            liveHasPixelSkin ? 'has-chat-skin has-private-chat' : '',
            liveIsPrivateChat ? 'is-private-chat-scene' : '',
            liveIsGroupChat ? 'is-group-chat-scene' : '',
            liveIsStaticPixel ? 'is-static-pixel-scene' : '',
            liveIsBarePixel ? 'is-bare-pixel-scene' : '',
            liveHasForegroundScene ? 'is-foreground-enabled is-foreground-lifted' : 'is-foreground-disabled',
          ].filter(Boolean).join(' ');
          return (
            <div
              key={`live-window-${windowItem.id}`}
              className={`desktop-browser-live-window app-container tab-${windowItem.activeTab} ${liveIsMaximized ? 'is-window-maximized' : 'is-window-floating'} ${liveLayoutClasses} ${liveSurfaceClasses} ${browserWindowGeometrySwitchingWindowId === windowItem.id ? 'is-window-geometry-switching' : ''} ${browserWindowMergeTargetId === windowItem.id ? 'is-window-merge-target' : ''} ${browserWindowInteractionRef.current?.windowId === windowItem.id ? 'is-interacting' : ''}`}
              data-browser-window-id={windowItem.id}
              style={getBrowserWindowStackStyle(windowItem, index)}
              onClickCapture={(event) => {
                if (suppressBrowserWindowClickRef.current === windowItem.id) return;
                const target = event.target instanceof Element ? event.target : null;
                if (target?.closest('.desktop-window-control, .desktop-browser-resize-handle, .desktop-browser-tab, .desktop-browser-tab-add, .desktop-browser-icon-button, .desktop-browser-address')) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                focusBrowserWindowTab(windowItem.id, windowItem.activeTab, windowItem.activeTabIndex);
              }}
            >
              {liveHasForegroundScene && renderPrivateChatForegroundScene()}
              <div
                className="desktop-browser-chrome desktop-browser-chrome--live"
                role="navigation"
                aria-label={lang === 'en' ? 'Background desktop navigation' : '后台窗口导航'}
                onPointerDown={(event) => startBrowserWindowDrag(event, windowItem.id)}
                onPointerMove={handleBrowserWindowPointerMove}
                onPointerUp={stopBrowserWindowInteraction}
                onPointerCancel={stopBrowserWindowInteraction}
              >
                <div className="desktop-browser-tabs">
                  {liveTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`desktop-browser-tab ${tab.active ? 'is-active' : ''}`}
                      title={tab.title}
                      aria-label={tab.title}
                      onPointerDown={(event) => startBrowserTabDrag(event, tab.id, windowItem.id, tab.index)}
                      onPointerMove={handleBrowserWindowPointerMove}
                      onPointerUp={stopBrowserWindowInteraction}
                      onPointerCancel={stopBrowserWindowInteraction}
                      onClick={(event) => {
                        if (suppressBrowserWindowClickRef.current === windowItem.id) {
                          event.preventDefault();
                          return;
                        }
                        focusBrowserWindowTab(windowItem.id, tab.id, tab.index);
                      }}
                    >
                      <span className="desktop-browser-tab__mark">{tab.mark}</span>
                      <span className="desktop-browser-tab__title">{tab.title}</span>
                      <X className="desktop-browser-tab__close" size={14} strokeWidth={2.2} />
                    </button>
                  ))}
                  <button type="button" className="desktop-browser-tab-add" aria-hidden="true" tabIndex={-1}>+</button>
                  <span className="desktop-window-drag-spacer" aria-hidden="true" />
                  <div className="desktop-window-controls" aria-label={lang === 'en' ? 'Window controls' : '窗口控制'}>
                    <button
                      type="button"
                      className="desktop-window-control"
                      onClick={(event) => {
                        event.stopPropagation();
                        minimizeBrowserWindow(windowItem.id);
                      }}
                      aria-label={lang === 'en' ? 'Minimize to desktop' : '最小化到桌面'}
                      title={lang === 'en' ? 'Minimize to desktop' : '最小化到桌面'}
                    >
                      <Minus size={18} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      className="desktop-window-control"
                      onClick={(event) => {
                        event.stopPropagation();
                        beginBrowserWindowGeometrySwitch(windowItem.id);
                        const nextMaximized = !windowItem.maximized;
                        setBrowserWindows((currentWindows) => currentWindows.map((currentWindow) => (
                          currentWindow.id === windowItem.id
                            ? { ...currentWindow, maximized: nextMaximized, minimized: false }
                            : currentWindow
                        )));
                        setActiveBrowserWindowId(windowItem.id);
                        setBrowserWindowMaximized(nextMaximized);
                        setActiveTab(windowItem.activeTab === 'desktop' ? 'chats' : windowItem.activeTab);
                      }}
                      aria-label={windowItem.maximized ? (lang === 'en' ? 'Restore' : '还原') : (lang === 'en' ? 'Maximize' : '最大化')}
                      title={windowItem.maximized ? (lang === 'en' ? 'Restore' : '还原') : (lang === 'en' ? 'Maximize' : '最大化')}
                    >
                      <Square size={15} strokeWidth={1.9} />
                    </button>
                    <button
                      type="button"
                      className="desktop-window-control desktop-window-control--close"
                      onClick={(event) => {
                        event.stopPropagation();
                        closeBrowserWindow(windowItem.id);
                      }}
                      aria-label={lang === 'en' ? 'Close app window' : '关闭窗口'}
                      title={lang === 'en' ? 'Close app window' : '关闭窗口'}
                    >
                      <X size={21} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
                <div className="desktop-browser-toolbar">
                  <button
                    type="button"
                    className="desktop-browser-icon-button desktop-return-button"
                    onClick={() => minimizeBrowserWindow(windowItem.id)}
                    aria-label={lang === 'en' ? 'Back to desktop' : '返回桌面'}
                    title={lang === 'en' ? 'Back to desktop' : '返回桌面'}
                  >
                    <ArrowLeft size={22} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="desktop-browser-icon-button"
                    disabled
                    aria-label={lang === 'en' ? 'Forward' : '前进'}
                    title={lang === 'en' ? 'Forward' : '前进'}
                  >
                    <ArrowRight size={22} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="desktop-browser-icon-button"
                    onClick={() => focusBrowserWindowTab(windowItem.id, windowItem.activeTab, windowItem.activeTabIndex)}
                    aria-label={lang === 'en' ? 'Reload' : '刷新'}
                    title={lang === 'en' ? 'Reload' : '刷新'}
                  >
                    <RefreshCw size={20} strokeWidth={2.2} />
                  </button>
                  <div className="desktop-browser-address" aria-label={liveAddress}>
                    <span className="desktop-browser-address__info">i</span>
                    <span>{liveAddress}</span>
                  </div>
                </div>
              </div>
              <div className="desktop-browser-live-window__content">
                <AppErrorBoundary resetKey={`live-window:${windowItem.id}:${windowItem.activeTab}`} lang={lang}>
                  <Suspense fallback={<PanelFallback />}>
                    {windowItem.activeTab === 'chats'
                      ? renderLiveSocialWindowContent(windowItem)
                      : renderDesktopWindowContent(windowItem.activeTab, { surfaceKey: `live-${windowItem.id}-${windowItem.activeTab}` })}
                  </Suspense>
                </AppErrorBoundary>
              </div>
            {['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'].map((direction) => (
              <button
                key={`shadow-resize-${windowItem.id}-${direction}`}
                type="button"
                className={`desktop-browser-resize-handle desktop-browser-resize-handle--shadow desktop-browser-resize-handle--${direction}`}
                onPointerDown={(event) => startBrowserWindowResize(event, direction, windowItem.id)}
                onPointerMove={handleBrowserWindowPointerMove}
                onPointerUp={stopBrowserWindowInteraction}
                onPointerCancel={stopBrowserWindowInteraction}
                aria-label={lang === 'en' ? `Resize window ${direction}` : `缩放窗口 ${direction}`}
                title={lang === 'en' ? 'Drag to resize window' : '拖动缩放窗口'}
              />
            ))}
            </div>
          );
        })}
      {activeTab === 'desktop' ? (
        <ChatPulseDesktop
          lang={lang}
          apps={desktopApps}
          desktopWallpaper={desktopWallpaper}
          onDesktopWallpaperChange={handleDesktopWallpaperChange}
        />
      ) : (
        <>
          {browserWindowRecallPulse?.windowId === activeBrowserWindowId && (
            <div
              key={browserWindowRecallPulse.token}
              className="desktop-window-recall-hint"
              aria-hidden="true"
            >
              <span className="desktop-window-recall-hint__pill">
                <RefreshCw size={15} strokeWidth={2.2} />
                <span>{lang === 'en' ? 'Already open' : '已打开'}</span>
              </span>
            </div>
          )}
          {browserTabDragPreview?.moved && (
            <div
              className="desktop-tab-drag-ghost"
              style={{
                '--tab-drag-x': `${browserTabDragPreview.x}px`,
                '--tab-drag-y': `${browserTabDragPreview.y}px`,
              }}
              aria-hidden="true"
            >
              <span className="desktop-browser-tab__mark">{browserTabDragPreview.mark}</span>
              <span className="desktop-browser-tab__title">{browserTabDragPreview.title}</span>
            </div>
          )}
          <div className={`desktop-browser-chrome ${browserWindowMaximized ? 'is-maximized' : ''}`} role="navigation" aria-label={lang === 'en' ? 'Desktop navigation' : '桌面导航'}
            onPointerDown={startBrowserWindowDrag}
            onPointerMove={handleBrowserWindowPointerMove}
            onPointerUp={stopBrowserWindowInteraction}
            onPointerCancel={stopBrowserWindowInteraction}>
            <div className="desktop-browser-tabs">
              {browserTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`desktop-browser-tab ${tab.active ? 'is-active' : ''}`}
                  title={tab.title}
                  aria-label={tab.title}
                  onPointerDown={(event) => startBrowserTabDrag(event, tab.id, activeBrowserWindowId, tab.index)}
                  onPointerMove={handleBrowserWindowPointerMove}
                  onPointerUp={stopBrowserWindowInteraction}
                  onPointerCancel={stopBrowserWindowInteraction}
                  onClick={(event) => {
                    if (suppressBrowserWindowClickRef.current === activeBrowserWindowId) {
                      event.preventDefault();
                      return;
                    }
                    activateBrowserTab(tab.id, tab.index);
                  }}
                >
                  <span className="desktop-browser-tab__mark">{tab.mark}</span>
                  <span className="desktop-browser-tab__title">{tab.title}</span>
                  <X className="desktop-browser-tab__close" size={14} strokeWidth={2.2} />
                </button>
              ))}
              <button type="button" className="desktop-browser-tab-add" aria-hidden="true" tabIndex={-1}>+</button>
              <span className="desktop-window-drag-spacer" aria-hidden="true" />
              <div className="desktop-window-controls" aria-label={lang === 'en' ? 'Window controls' : '窗口控制'}>
                <button
                  type="button"
                  className="desktop-window-control"
                  onClick={() => minimizeBrowserWindow()}
                  aria-label={lang === 'en' ? 'Minimize to desktop' : '最小化到桌面'}
                  title={lang === 'en' ? 'Minimize to desktop' : '最小化到桌面'}
                >
                  <Minus size={18} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="desktop-window-control"
                  onClick={toggleBrowserWindowMaximized}
                  aria-label={browserWindowMaximized ? (lang === 'en' ? 'Restore' : '还原') : (lang === 'en' ? 'Maximize' : '最大化')}
                  title={browserWindowMaximized ? (lang === 'en' ? 'Restore' : '还原') : (lang === 'en' ? 'Maximize' : '最大化')}
                >
                  <Square size={15} strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  className="desktop-window-control desktop-window-control--close"
                  onClick={() => closeBrowserWindow()}
                  aria-label={lang === 'en' ? 'Close app window' : '关闭窗口'}
                  title={lang === 'en' ? 'Close app window' : '关闭窗口'}
                >
                  <X size={21} strokeWidth={1.8} />
                </button>
              </div>
            </div>
            <div className="desktop-browser-toolbar">
              <button
                type="button"
                className="desktop-browser-icon-button desktop-return-button"
                onClick={openDesktop}
                aria-label={lang === 'en' ? 'Back to desktop' : '返回桌面'}
                title={lang === 'en' ? 'Back to desktop' : '返回桌面'}
              >
                <ArrowLeft size={22} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="desktop-browser-icon-button"
                disabled
                aria-label={lang === 'en' ? 'Forward' : '前进'}
                title={lang === 'en' ? 'Forward' : '前进'}
              >
                <ArrowRight size={22} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="desktop-browser-icon-button"
                onClick={() => window.location.reload()}
                aria-label={lang === 'en' ? 'Reload' : '刷新'}
                title={lang === 'en' ? 'Reload' : '刷新'}
              >
                <RefreshCw size={20} strokeWidth={2.2} />
              </button>
              <div className="desktop-browser-address" aria-label={activeDesktopAddress}>
                <span className="desktop-browser-address__info">i</span>
                <span>{activeDesktopAddress}</span>
              </div>
            </div>
          </div>
          {!browserWindowMaximized && (
            <>
              {['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'].map((direction) => (
                <button
                  key={`resize-${direction}`}
                  type="button"
                  className={`desktop-browser-resize-handle desktop-browser-resize-handle--${direction}`}
                  onPointerDown={(event) => startBrowserWindowResize(event, direction)}
                  onPointerMove={handleBrowserWindowPointerMove}
                  onPointerUp={stopBrowserWindowInteraction}
                  onPointerCancel={stopBrowserWindowInteraction}
                  aria-label={lang === 'en' ? `Resize window ${direction}` : `缩放窗口 ${direction}`}
                  title={lang === 'en' ? 'Drag to resize window' : '拖动缩放窗口'}
                />
              ))}
            </>
          )}
          {/* 1. Very Left Sidebar (Navigation) */}
          <nav className="sidebar-nav">
        <div className="sidebar-brand" aria-label="ChatPulse">
          <MessageSquare size={22} />
          <span>ChatPulse</span>
        </div>
        <div className="my-avatar" onClick={() => setActiveTab('settings')} style={{ cursor: 'pointer' }}>
          <AvatarWithFrame
            size={40}
            frame={effectiveUser?.avatar_frame}
            src={resolveAvatarUrl(effectiveUser?.avatar, API_URL, effectiveUser?.name || 'User')}
            fallbackSrc={defaultAvatarUrl(effectiveUser?.name || 'User')}
            alt="Me"
          />
        </div>
        <div className="nav-icons">
          <button className={`nav-icon ${activeTab === 'chats' ? 'active' : ''}`} data-label={lang === 'en' ? 'Chats' : '聊天'} onClick={() => setActiveTab('chats')} title={lang === 'en' ? 'Chats — View conversations' : '聊天 — 查看会话列表'}>
            <MessageSquare size={24} />
          </button>
          <button className={`nav-icon ${activeTab === 'memory_library' ? 'active' : ''}`} data-label={lang === 'en' ? 'Memory' : '记忆库'} onClick={() => setActiveTab('memory_library')} title={lang === 'en' ? 'Memory Library — Classification and forgetting' : '记忆库 — 分类与遗忘曲线'}>
            <LibraryBig size={24} />
          </button>
        </div>
        <div className="nav-icons-bottom">
          {experimentalPlugins.map(Plugin => {
            const Icon = Plugin.icon;
            return (
              <button key={Plugin.id} className={`nav-icon ${activeTab === Plugin.id ? 'active' : ''}`} data-label={lang === 'en' ? Plugin.name_en : Plugin.name_zh} onClick={() => setActiveTab(Plugin.id)} title={lang === 'en' ? Plugin.name_en : Plugin.name_zh} style={activeTab === Plugin.id ? undefined : { color: Plugin.color || 'inherit' }}>
                <Icon size={24} />
              </button>
            );
          })}
          <button className={`nav-icon ${activeTab === 'settings' ? 'active' : ''}`} data-label={lang === 'en' ? 'Settings' : '设置'} onClick={() => setActiveTab('settings')} title={lang === 'en' ? 'Settings — Global configuration' : '设置 — 全局设置'}>
            <Settings size={24} />
          </button>
          {regularPlugins.map(Plugin => {
            const Icon = Plugin.icon;
            return (
              <button key={Plugin.id} className={`nav-icon ${activeTab === Plugin.id ? 'active' : ''}`} data-label={lang === 'en' ? Plugin.name_en : Plugin.name_zh} onClick={() => setActiveTab(Plugin.id)} title={lang === 'en' ? Plugin.name_en : Plugin.name_zh} style={activeTab === Plugin.id ? undefined : { color: Plugin.color || 'inherit' }}>
                <Icon size={24} />
              </button>
            );
          })}
          <button className="nav-icon" data-label={lang === 'en' ? 'Logout' : '退出登录'} onClick={() => logout(API_URL)} title={lang === 'en' ? 'Logout' : '退出登录'} style={{ color: '#ff4d4f' }}>
            <LogOut size={24} />
          </button>
        </div>
          </nav>

          {/* 2. Middle Column (List) */}
          <div className="middle-column">
        {activeTab === 'chats' && (
          <div className="middle-column-heading">
            <div className="private-chat-heading-actions">
              <button
                type="button"
                className="private-chat-create-character-button"
                onClick={() => openAddCharacterModal(true)}
                title={lang === 'en' ? 'Create character and open chat' : '创建角色并进入私聊'}
                aria-label={lang === 'en' ? 'Create character and open chat' : '创建角色并进入私聊'}
              >
                <UserPlus size={18} />
              </button>
              <button
                type="button"
                className={`foreground-toggle ${privateChatForegroundEnabled ? 'is-on' : 'is-off'}`}
                aria-label={privateChatForegroundEnabled ? (lang === 'en' ? 'Disable foreground' : '关闭前景') : (lang === 'en' ? 'Enable foreground' : '开启前景')}
                aria-pressed={privateChatForegroundEnabled}
                title={privateChatForegroundEnabled ? (lang === 'en' ? 'Disable foreground' : '关闭前景') : (lang === 'en' ? 'Enable foreground' : '开启前景')}
                onClick={handlePrivateChatForegroundToggle}
              >
                <span className="foreground-toggle__text">{lang === 'en' ? 'FG' : '前景'}</span>
                <span className="foreground-toggle__track" aria-hidden="true">
                  <span className="foreground-toggle__thumb" />
                </span>
              </button>
            </div>
          </div>
        )}
        <div className="search-bar-container">
          <input type="text" className="search-bar" placeholder={t('Search') || 'Search'} />
        </div>
        <div className="list-container">
          {activeTab === 'chats' && (
            <>
              {contactsLoadError && contacts.length === 0 && (
                <div style={{ padding: '14px 16px', color: '#c0392b', fontSize: '12px', lineHeight: 1.5 }}>
                  Failed to load contacts: {contactsLoadError}
                </div>
              )}
              <ContactList
                apiUrl={API_URL}
                contacts={contacts}
                activeId={activeContactId}
                engineState={engineState}
                onSelect={(id) => {
                  const selected = contacts.find(c => c.id === id);
                  setActiveContactId(id);
                  if (selected) setActiveContactSnapshot(selected);
                  activeContactRef.current = id;
                  setActiveGroupId(null);
                  activeGroupRef.current = null;
                  // Clear unread badge
                  setContacts(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
                }}
              />
            </>
          )}
          {activeTab === 'chats' && groupChatEnabled && groups.length > 0 && (
            <div style={{ borderTop: '1px solid #eee' }}>
              <div style={{ padding: '5px 15px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                {lang === 'en' ? 'Group Chats' : '群聊'}
              </div>
              {groups.map(g => {
                const memberCount = g.members?.length || 0;
                const groupAvatarSize = memberCount <= 1 ? 58 : 46;
                const groupAvatarOverlap = memberCount <= 1 ? 0 : -18;
                const unreadCount = Number(groupUnreadCounts[g.id]) || 0;

                return (
                <div
                  key={g.id}
                  className={`contact-item group-contact-item ${activeGroupId === g.id ? 'active' : ''}`}
                  title={g.name}
                  aria-label={lang === 'en' ? `${g.name}, group chat` : `${g.name}，群聊`}
                  onClick={() => {
                    setActiveGroupId(g.id);
                    activeGroupRef.current = g.id;
                    setActiveContactId(null);
                    setActiveContactSnapshot(null);
                    activeContactRef.current = null;
                    setGroupUnreadCounts((current) => {
                      if (!current[g.id]) return current;
                      const next = { ...current };
                      delete next[g.id];
                      return next;
                    });
                  }}
                >
                  <div className="contact-avatar group-contact-avatar" style={{ width: 'auto', minWidth: '42px', height: '42px', display: 'flex', alignItems: 'center' }}>
                    {g.members?.slice(0, 4).map((memberObj, idx) => {
                      const memberId = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                      const member = contacts.find(c => String(c.id) === String(memberId));
                      const memberName = memberId === 'user'
                        ? userProfile?.name || 'User'
                        : member?.name || memberId || 'User';
                      const memberAvatar = memberId === 'user'
                        ? resolveAvatarUrl(userProfile?.avatar, API_URL, memberName)
                        : resolveAvatarUrl(member?.avatar, API_URL, memberName);
                      const memberFrame = memberId === 'user' ? userProfile?.avatar_frame : member?.avatar_frame;
                      return (
                        <AvatarWithFrame
                          key={idx}
                          size={groupAvatarSize}
                          frame={memberFrame}
                          src={memberAvatar}
                          fallbackSrc={defaultAvatarUrl(memberName)}
                          alt=""
                          style={{ marginLeft: idx > 0 ? `${groupAvatarOverlap}px` : '0', zIndex: 10 - idx }}
                          imageStyle={{ border: memberCount === 1 ? '1px solid rgba(255, 111, 151, 0.28)' : '2px solid #fff' }}
                        />
                      );
                    })}
                    {(!g.members || g.members.length === 0) && <div style={{ width: `${groupAvatarSize}px`, height: `${groupAvatarSize}px`, backgroundColor: '#e1e1e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UsersRound size={22} style={{ color: '#fff' }} /></div>}
                  </div>
                  <div className="group-contact-item__body">
                    <span className="group-contact-item__name">{g.name}</span>
                    <span className="group-contact-item__meta">{lang === 'en' ? `${memberCount} members` : `${memberCount} 位成员`}</span>
                  </div>
                  {unreadCount > 0 && <span className="unread-badge">{formatBadge(unreadCount)}</span>}
                </div>
                );
              })}
            </div>
          )}
          {activeTab === 'contacts' && (
            <div className="contacts-page-shell">
              <div className="contacts-page-header">
                <div className="contacts-page-title">
                  <span>{lang === 'en' ? 'Contacts' : '联系人'}</span>
                  <h2>{lang === 'en' ? 'Address Book' : '通讯录'}</h2>
                </div>
                <button
                  type="button"
                  className="contacts-page-icon-button"
                  onClick={() => openAddCharacterModal(false)}
                  title={lang === 'en' ? 'Add new AI character' : '添加新的 AI 角色'}
                  aria-label={lang === 'en' ? 'Add new AI character' : '添加新的 AI 角色'}
                >
                  <UserPlus size={18} />
                </button>
              </div>

              <section className="contacts-page-section">
                <div className="contacts-page-section__head">
                  <span>{lang === 'en' ? 'Private Contacts' : '私聊联系人'}</span>
                  <span className="contacts-page-count">{contacts.length}</span>
                </div>
                <div className="contacts-page-grid">
                  {contacts.map((c) => {
                    const isOnline = hasPrimaryModelConfig(c);
                    const statusLabel = isOnline ? (lang === 'en' ? 'Online' : '在线') : (lang === 'en' ? 'Offline' : '离线');
                    const configLabel = isOnline
                      ? (c.model_name || c.model || (lang === 'en' ? 'Ready' : '主 API 已配置'))
                      : (lang === 'en' ? 'No primary API key' : '缺少主 API 有效 key');
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`contacts-page-card ${isOnline ? 'is-online' : 'is-offline'}`}
                        onClick={() => { setActiveContactId(c.id); setActiveContactSnapshot(c); setActiveTab('chats'); }}
                      >
                        <span className="contacts-page-card__avatar">
                          <AvatarWithFrame
                            size={52}
                            frame={c.avatar_frame}
                            src={resolveAvatarUrl(c.avatar, API_URL, c.name || c.id || 'User')}
                            fallbackSrc={defaultAvatarUrl(c.name || c.id || 'User')}
                            alt={c.name}
                          />
                          <span className={`contacts-page-status-dot ${isOnline ? 'online' : 'offline'}`} />
                        </span>
                        <span className="contacts-page-card__body">
                          <span className="contacts-page-card__topline">
                            <span className="contacts-page-card__name">{c.name}</span>
                            <span className={`contacts-page-card__status ${isOnline ? 'online' : 'offline'}`}>{statusLabel}</span>
                          </span>
                          <span className="contacts-page-card__meta">{configLabel}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {groupChatEnabled && (
                <section className="contacts-page-section contacts-page-section--groups">
                  <div className="contacts-page-section__head">
                    <span>{lang === 'en' ? 'Group Chats' : '群聊'}</span>
                    <button
                      type="button"
                      className="contacts-page-small-action"
                      onClick={() => setShowCreateGroupModal(true)}
                      title={lang === 'en' ? 'Create Group' : '创建群聊'}
                      aria-label={lang === 'en' ? 'Create Group' : '创建群聊'}
                    >
                      <UsersRound size={16} />
                    </button>
                  </div>
                  <div className="contacts-page-grid">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className="contacts-page-card contacts-page-card--group"
                        onClick={() => { setActiveGroupId(g.id); setActiveContactId(null); setActiveContactSnapshot(null); setActiveTab('chats'); }}
                      >
                        <span className="contacts-page-group-avatar">
                          {g.members?.slice(0, 3).map((memberObj, idx) => {
                            const memberId = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                            const member = contacts.find(c => String(c.id) === String(memberId));
                            const memberName = memberId === 'user'
                              ? userProfile?.name || 'User'
                              : member?.name || memberId || 'User';
                            const memberAvatar = memberId === 'user'
                              ? resolveAvatarUrl(userProfile?.avatar, API_URL, memberName)
                              : resolveAvatarUrl(member?.avatar, API_URL, memberName);
                            const memberFrame = memberId === 'user' ? userProfile?.avatar_frame : member?.avatar_frame;
                            return (
                              <AvatarWithFrame
                                key={`${memberId}-${idx}`}
                                className="contacts-page-group-avatar__frame"
                                size={34}
                                frame={memberFrame}
                                src={memberAvatar}
                                fallbackSrc={defaultAvatarUrl(memberName)}
                                alt=""
                                style={{ marginLeft: idx > 0 ? '-12px' : '0', zIndex: 10 - idx }}
                                imageClassName="contacts-page-group-avatar__image"
                              />
                            );
                          })}
                          {g.members?.length > 3 && (
                            <span className="contacts-page-group-avatar__more">+{g.members.length - 3}</span>
                          )}
                          {(!g.members || g.members.length === 0) && (
                            <span className="contacts-page-group-avatar__empty">
                              <UsersRound size={20} />
                            </span>
                          )}
                        </span>
                        <span className="contacts-page-card__body">
                          <span className="contacts-page-card__topline">
                            <span className="contacts-page-card__name">{g.name}</span>
                            <span className="contacts-page-card__status online">{g.members?.length || 0}</span>
                          </span>
                          <span className="contacts-page-card__meta">{lang === 'en' ? 'Tap to enter group chat' : '点击进入群聊'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="contact-item active">
              <Settings size={24} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
              <div className="contact-info">
                <div className="contact-name">{t('Settings')}</div>
              </div>
            </div>
          )}
          {activeTab === 'memory_library' && (
            <div className="contact-item active">
              <Database size={24} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
              <div className="contact-info">
                <div className="contact-name">{lang === 'en' ? 'Memory Library' : '记忆库'}</div>
              </div>
            </div>
          )}
          {activeTab === 'mcp_lab' && (
            <div className="contact-item active">
              <Wifi size={24} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
              <div className="contact-info">
                <div className="contact-name">{lang === 'en' ? 'MCP Lab' : 'MCP 实验室'}</div>
              </div>
            </div>
          )}
        </div>
          </div>



          {/* 3. Right Column (Chat Area / Content) — hidden on contacts tab */}
          {activeTab !== 'contacts' && (
            <div className="right-column" style={{ flexDirection: 'row' }}>
          <AppErrorBoundary resetKey={`content:${activeTab}:${activeContactId || ''}:${activeGroupId || ''}`} lang={lang}>
            <Suspense fallback={<PanelFallback />}>
              {activeContactId && activeTab === 'chats' ? (
                <div className="private-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minWidth: 0 }}>
                  <div className="private-chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <ChatWindow
                      contact={activeChatContact}
                      allContacts={contacts}
                      userAvatar={effectiveUser?.avatar}
                      userAvatarFrame={effectiveUser?.avatar_frame}
                      apiUrl={API_URL}
                      incomingMessageQueue={incomingMessageQueue}
                      engineState={engineState}
                      onToggleMemo={() => toggleChatDrawer('memo')}
                      onToggleDiary={() => toggleChatDrawer('diary')}
                      onToggleSettings={() => toggleChatDrawer('settings')}
                      onPreloadMemo={() => preloadChatDrawer('memo')}
                      onPreloadDiary={() => preloadChatDrawer('diary')}
                      onPreloadSettings={() => preloadChatDrawer('settings')}
                      onBack={() => { setActiveContactId(null); setActiveContactSnapshot(null); activeContactRef.current = null; }}
                      onSwitchTab={setActiveTab}
                      isGeneratingSchedule={generatingSchedules[activeContactId]}
                      onMessagesChange={setHiddenMessagesCount}
                      isPrivateChatForegroundEnabled={isForegroundLayoutLifted}
                      chatLayoutKey={activeDrawer || 'journal'}
                    />
                  </div>
                  <div className="private-chat-side-slot" data-slot-view={activeDrawer || 'journal'}>
                    {!activeDrawer && (
                      <PrivateChatJournalPanel
                        contact={activeChatContact}
                        lang={lang}
                        onOpenDiary={() => toggleChatDrawer('diary')}
                      />
                    )}
                    {activeDrawer === 'memo' && (
                      <PrivateChatDrawerShell type="memo">
                        <AppErrorBoundary
                          variant="drawer"
                          resetKey={`drawer:memo:${activeChatContact?.id || ''}`}
                          lang={lang}
                          title={`${activeChatContact?.name || (lang === 'en' ? 'Character' : '角色')} ${lang === 'en' ? "'s Memories" : '的记忆'}`}
                          onClose={() => setActiveDrawer(null)}
                        >
                          <Suspense fallback={<DrawerFallback type="memo" contact={activeChatContact} lang={lang} onClose={() => setActiveDrawer(null)} />}>
                            <MemoTable
                              contact={activeChatContact}
                              apiUrl={API_URL}
                              onClose={() => setActiveDrawer(null)}
                            />
                          </Suspense>
                        </AppErrorBoundary>
                      </PrivateChatDrawerShell>
                    )}
                    {activeDrawer === 'diary' && (
                      <PrivateChatDrawerShell type="diary">
                        <AppErrorBoundary
                          variant="drawer"
                          resetKey={`drawer:diary:${activeChatContact?.id || ''}`}
                          lang={lang}
                          title={`${activeChatContact?.name || (lang === 'en' ? 'Character' : '角色')} ${lang === 'en' ? "'s Diary" : '的日记'}`}
                          onClose={() => setActiveDrawer(null)}
                        >
                          <Suspense fallback={<DrawerFallback type="diary" contact={activeChatContact} lang={lang} onClose={() => setActiveDrawer(null)} />}>
                            <DiaryTable
                              contact={activeChatContact}
                              apiUrl={API_URL}
                              onClose={() => setActiveDrawer(null)}
                            />
                          </Suspense>
                        </AppErrorBoundary>
                      </PrivateChatDrawerShell>
                    )}
                    {activeDrawer === 'settings' && (
                      <PrivateChatDrawerShell type="settings">
                        <AppErrorBoundary
                          variant="drawer"
                          resetKey={`drawer:settings:${activeChatContact?.id || ''}`}
                          lang={lang}
                          title={lang === 'en' ? 'Chat Settings' : '聊天设置'}
                          onClose={() => setActiveDrawer(null)}
                        >
                          <Suspense fallback={<DrawerFallback type="settings" contact={activeChatContact} lang={lang} onClose={() => setActiveDrawer(null)} />}>
                            <ChatSettingsDrawer
                              contact={activeChatContact}
                              contacts={contacts}
                              apiUrl={API_URL}
                              onClose={() => setActiveDrawer(null)}
                              onClearHistory={() => {
                                setActiveDrawer(null);
                                fetchContacts(); // Re-pull character data so stats show as reset immediately
                              }}
                              isGeneratingSchedule={!!generatingSchedules[activeContactId]}
                              messagesHideStateCount={hiddenMessagesCount}
                            />
                          </Suspense>
                        </AppErrorBoundary>
                      </PrivateChatDrawerShell>
                    )}
                  </div>
                </div>
              ) : activeGroupId && activeTab === 'chats' ? (
                <div className="group-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minWidth: 0 }}>
                  <GroupChatWindow
                    group={groups.find(g => g.id === activeGroupId)}
                    apiUrl={API_URL}
                    allContacts={contacts}
                    userProfile={effectiveUser}
                    incomingGroupMessageQueue={incomingGroupMessageQueue}
                    typingIndicators={groupTyping[activeGroupId] || []}
                    redpacketClaimEvent={redpacketClaimEvent}
                    onBack={() => { setActiveGroupId(null); setActiveDrawer(null); }}
                    onGroupUpdated={updateGroupInState}
                    isManageOpen={activeDrawer === 'group-manage'}
                    onToggleManage={() => toggleChatDrawer('group-manage')}
                    onCloseManage={() => setActiveDrawer(null)}
                  />
                  {renderGroupSideSlot({
                    group: activeGroup,
                    drawer: activeDrawer,
                    onClose: () => setActiveDrawer(null),
                  })}
                </div>
              ) : (
                renderDesktopWindowContent(activeTab, { surfaceKey: `active-${activeTab}` })
              )}
            </Suspense>
          </AppErrorBoundary>
            </div>
          )}
        </>
      )}

      <DesktopTaskbar
        lang={lang}
        apps={desktopApps}
        pinnedApps={pinnedDesktopApps}
        browserWindows={browserWindowTaskbarItems}
        notificationItems={desktopNotifications}
        toastItems={desktopToastItems}
        onOpenDesktop={openDesktop}
        onToggleBrowserWindow={toggleBrowserWindowFromTaskbar}
        onToggleLanguage={toggleLanguage}
        onDismissToast={dismissDesktopToastNotification}
        token={token}
        notificationBadgeCount={socialUnreadCount}
        userLabel={effectiveUser?.name || 'NA NA'}
      />



      {showAddCharModal && (
        <Suspense fallback={null}>
          <AddCharacterModal
            isOpen={showAddCharModal}
            onClose={closeAddCharacterModal}
            apiUrl={API_URL}
            onAdd={handleCharacterAdded}
          />
        </Suspense>
      )}

      {groupChatEnabled && showCreateGroupModal && (
        <Suspense fallback={null}>
          <CreateGroupModal
            apiUrl={API_URL}
            contacts={contacts}
            onClose={() => setShowCreateGroupModal(false)}
            onCreate={(group) => {
              setGroups(prev => [group, ...prev]);
              setShowCreateGroupModal(false);
              setActiveGroupId(group.id);
              setActiveContactId(null);
              setActiveTab('chats');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
