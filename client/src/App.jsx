import React, { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ContactList from './components/ContactList';
import ChatWindow from './components/ChatWindow';
import CreateGroupModal from './components/CreateGroupModal';
import AddCharacterModal from './components/AddCharacterModal';
import PrivateChatJournalPanel from './components/PrivateChatJournalPanel';

import './App.css';
import { MessageSquare, Users, Settings, UserPlus, Globe, UsersRound, LogOut, Database, LibraryBig, Download, Upload, Wand2, RefreshCw, X, BookOpen } from 'lucide-react';
import { plugins } from './plugins';
import { useLanguage } from './LanguageContext';
import { useAuth } from './AuthContext';
import Login from './components/Login';
import AvatarWithFrame from './components/AvatarWithFrame';
import { defaultAvatarUrl, resolveAvatarUrl } from './utils/avatar';

// Allow VITE config if available, otherwise dynamically use the current host IP/Domain
const PROTOCOL = window.location.protocol;
const HOST = window.location.hostname;
const defaultApiOrigin = `${PROTOCOL}//${HOST}:8000`;
const defaultWsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const defaultWsHost = `${HOST}:8000`;
const API_URL = import.meta.env.VITE_API_URL || `${defaultApiOrigin}/api`;
const WS_URL = import.meta.env.VITE_WS_URL || `${defaultWsProtocol}//${defaultWsHost}`;
const MODULE_LOAD_RETRY_BASE_MS = 800;
const MODULE_LOAD_RETRY_MAX_MS = 5000;
const MODULE_LOAD_AUTO_RELOAD_DELAY_MS = 500;
const MODULE_LOAD_AUTO_RELOAD_PREFIX = 'chatpulse:auto-module-reload:';
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
  return /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|error loading dynamically imported module|Loading chunk \d+ failed/i.test(message);
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
      if (!isLikelyModuleLoadError(error)) {
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
const MemoTable = lazyWithPreload(() => import('./components/MemoTable'));
const DiaryTable = lazyWithPreload(() => import('./components/DiaryTable'));
const SettingsPanel = lazyWithPreload(() => import('./components/SettingsPanel'));
const ChatSettingsDrawer = lazyWithPreload(() => import('./components/ChatSettingsDrawer'));
const MemoryLibraryPanel = lazyWithPreload(() => import('./components/MemoryLibraryPanel'));

const PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY = 'chatpulse:private-chat-foreground-enabled';
const PRIVATE_CHAT_FOREGROUND_EXIT_MS = 960;
const PRIVATE_CHAT_DECOR_STORAGE_KEY = 'chatpulse:private-chat-decor-adjustments:v3';
const PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY = 'chatpulse:private-chat-decor-editor-open';
const PRIVATE_CHAT_DECOR_DEFAULTS = {
  floor: { x: 32, y: 67, scale: 1.18 },
  cottage: { x: -18, y: 27, scale: 1.27 },
  cart: { x: 7, y: 29, scale: 1.38 },
};
const PRIVATE_CHAT_DECOR_TARGETS = [
  { id: 'floor', label: '地板', selector: '[data-private-decor-id="floor"]' },
  { id: 'cottage', label: '左小屋', selector: '[data-private-decor-id="cottage"]' },
  { id: 'cart', label: '右栏杆', selector: '[data-private-decor-id="cart"]' },
];

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
    cottage: '.private-chat-scene-decor__cottage',
    cart: '.private-chat-scene-decor__cart',
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
      setCopyStatus('已复制 CSS');
    } catch (error) {
      console.warn('Failed to copy private chat decor CSS:', error);
      window.prompt('复制这些 CSS 变量：', snippet);
      setCopyStatus('已弹出复制框');
    }
  }, [transforms]);

  if (!isPrivateChatView) return null;

  return (
    <>
      {open && (
        <div className="private-decor-editor" aria-label="私聊素材调试面板">
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
                  title={`${target.label}：拖动移动，滚轮缩放`}
                >
                  <span>{target.label}</span>
                </button>
              );
            })}
          </div>
          <div className="private-decor-editor__panel">
            <div className="private-decor-editor__header">
              <strong>素材调试</strong>
              <button type="button" onClick={() => onOpenChange(false)} aria-label="关闭素材调试">
                <X size={16} />
              </button>
            </div>
            <div className="private-decor-editor__hint">拖动选中框移动，滚轮缩放，Shift + 滚轮细调。</div>
            <div className="private-decor-editor__tabs">
              {PRIVATE_CHAT_DECOR_TARGETS.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className={selectedId === target.id ? 'is-selected' : ''}
                  onClick={() => setSelectedId(target.id)}
                >
                  {target.label}
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
                缩放
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
              <button type="button" onClick={() => resetDecor(selectedId)}>重置当前</button>
              <button type="button" onClick={resetAllDecor}>全部清空</button>
              <button type="button" onClick={copyDecorCss}>复制 CSS</button>
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
          <div className="memory-header-actions">
            <button type="button" className="memory-action-btn drawer-fallback-action" aria-disabled="true" tabIndex={-1}>
              <Download size={14} /> {lang === 'en' ? 'Export all' : '导出全部'}
            </button>
            <button type="button" className="memory-action-btn drawer-fallback-action" aria-disabled="true" tabIndex={-1}>
              <Upload size={14} /> {lang === 'en' ? 'Import all' : '导入全部'}
            </button>
            <button type="button" className="memory-action-btn drawer-fallback-action" aria-disabled="true" tabIndex={-1}>
              <Wand2 size={14} /> {lang === 'en' ? 'Extract' : '提取'}
            </button>
            <button type="button" className="icon-btn drawer-fallback-action" aria-disabled="true" tabIndex={-1}>
              <RefreshCw size={16} />
            </button>
            <button type="button" className="icon-btn" onClick={onClose} title={lang === 'en' ? 'Close' : '关闭'}>
              <X size={16} />
            </button>
          </div>
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
          <button type="button" className="icon-btn" onClick={onClose} title={lang === 'en' ? 'Close' : '关闭'}>
            <X size={20} />
          </button>
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
        <button type="button" className="icon-btn" onClick={onClose} title={lang === 'en' ? 'Close' : '关闭'}>
          <X size={20} />
        </button>
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
    return { error, autoReloading: isLikelyModuleLoadError(error) };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] UI crashed:', error, info);
    if (isLikelyModuleLoadError(error)) {
      this.scheduleModuleAutoReload(error);
    }
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

  getAutoReloadStorageKey = (error) => {
    const resetKey = String(this.props.resetKey || 'boundary');
    return `${MODULE_LOAD_AUTO_RELOAD_PREFIX}${resetKey}:${getModuleLoadErrorSignature(error)}`;
  };

  scheduleModuleAutoReload = (error) => {
    if (this.autoReloadTimer) return;
    if (typeof window === 'undefined') {
      this.setState({ autoReloading: false });
      return;
    }

    let storage = null;
    try {
      storage = window.sessionStorage;
    } catch {
      this.setState({ autoReloading: false });
      return;
    }
    if (!storage) {
      this.setState({ autoReloading: false });
      return;
    }

    const storageKey = this.getAutoReloadStorageKey(error);
    try {
      if (storage.getItem(storageKey) === '1') {
        this.setState({ autoReloading: false });
        return;
      }
      storage.setItem(storageKey, '1');
    } catch {
      this.setState({ autoReloading: false });
      return;
    }

    this.setState({ autoReloading: true });
    this.autoReloadTimer = window.setTimeout(() => {
      this.autoReloadTimer = null;
      window.location.reload();
    }, MODULE_LOAD_AUTO_RELOAD_DELAY_MS);
  };

  retry = () => {
    this.clearAutoReloadTimer();
    this.setState({ error: null, autoReloading: false });
  };

  reload = () => {
    this.clearAutoReloadTimer();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const lang = this.props.lang || 'zh';
    const isDrawer = this.props.variant === 'drawer';
    const Wrapper = isDrawer ? 'aside' : 'div';

    if (this.state.autoReloading) {
      return (
        <Wrapper
          className={isDrawer ? 'memory-drawer drawer-loading-fallback' : 'panel-error-state panel-loading-state'}
          style={{
            width: isDrawer ? 'var(--private-chat-drawer-width, 360px)' : '100%',
            minWidth: 0,
            flex: isDrawer ? '0 0 var(--private-chat-drawer-width, 360px)' : 1,
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
            padding: '24px',
            background: '#fff',
            color: '#8a8f98',
            borderLeft: isDrawer ? '1px solid var(--border-color, #eee)' : 'none'
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: '28px',
              height: '28px',
              border: '3px solid rgba(7, 193, 96, 0.18)',
              borderTopColor: 'var(--accent-color, #07c160)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          <p style={{ margin: 0, fontSize: '13px' }}>
            {lang === 'en' ? 'Loading...' : '加载中...'}
          </p>
        </Wrapper>
      );
    }

    const title = this.props.title || (lang === 'en' ? 'This panel failed to load' : '这个面板没有正常打开');
    const message = lang === 'en'
      ? 'The app caught this error, so the rest of the page can keep running.'
      : '应用已经拦截住这次错误，其他区域可以继续使用。';
    const detail = String(this.state.error?.message || this.state.error || 'Unknown error');

    return (
      <Wrapper
        className={isDrawer ? 'memory-drawer drawer-error' : 'panel-error-state'}
        style={{
          width: isDrawer ? 'var(--private-chat-drawer-width, 360px)' : '100%',
          minWidth: 0,
          flex: isDrawer ? '0 0 var(--private-chat-drawer-width, 360px)' : 1,
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '12px',
          padding: '24px',
          background: '#fff',
          color: 'var(--text-primary)',
          borderLeft: isDrawer ? '1px solid var(--border-color, #eee)' : 'none'
        }}
      >
        <h3 style={{ margin: 0, fontSize: isDrawer ? '16px' : '20px' }}>{title}</h3>
        <p style={{ margin: 0, color: '#7a7f87', lineHeight: 1.5, fontSize: '13px' }}>{message}</p>
        <pre style={{
          margin: 0,
          maxHeight: '160px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          border: '1px solid #eee',
          borderRadius: '8px',
          padding: '10px',
          background: '#fafafa',
          color: '#6b7280',
          fontSize: '12px'
        }}>{detail}</pre>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="memory-action-btn" onClick={this.retry}>
            {lang === 'en' ? 'Try again' : '重试'}
          </button>
          <button type="button" className="memory-action-btn" onClick={this.reload}>
            {lang === 'en' ? 'Refresh page' : '刷新页面'}
          </button>
          {isDrawer && this.props.onClose && (
            <button type="button" className="memory-action-btn" onClick={this.props.onClose}>
              {lang === 'en' ? 'Close' : '关闭'}
            </button>
          )}
        </div>
      </Wrapper>
    );
  }
}

function App() {
  const { token, logout, user: authUser } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'contacts', 'settings'
  const [activeContactId, setActiveContactId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactsLoadError, setContactsLoadError] = useState('');
  const [activeContactSnapshot, setActiveContactSnapshot] = useState(null);

  const [incomingMessageQueue, setIncomingMessageQueue] = useState([]);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'memo', 'diary', or null
  const [userProfile, setUserProfile] = useState(() => authUser || null);
  const [isLoaded, setIsLoaded] = useState(() => !!token);
  const [engineState, setEngineState] = useState({});
  const [showAddCharModal, setShowAddCharModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [incomingGroupMessageQueue, setIncomingGroupMessageQueue] = useState([]);
  const [groupTyping, setGroupTyping] = useState({}); // { groupId: [{ sender_id, name }, ...] }
  const [globalAnnouncement, setGlobalAnnouncement] = useState(null);
  const [groupChatEnabled, setGroupChatEnabled] = useState(false); // Auto-detected: true if Group Chat DLC is loaded
  const [redpacketClaimEvent, setRedpacketClaimEvent] = useState(null);
  const [generatingSchedules, setGeneratingSchedules] = useState({});
  const [hiddenMessagesCount, setHiddenMessagesCount] = useState(0);
  const [privateChatForegroundEnabled, setPrivateChatForegroundEnabled] = useState(loadPrivateChatForegroundEnabled);
  const [privateChatForegroundExiting, setPrivateChatForegroundExiting] = useState(false);
  const privateChatForegroundExitTimerRef = useRef(null);
  const [privateChatDecorTransforms, setPrivateChatDecorTransforms] = useState(loadPrivateChatDecorTransforms);
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

  // Use a ref to track which incoming messages we've already processed for unread badges and sounds
  const processedMessagesRef = useRef(new Set());
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
  }, []);

  const toggleChatDrawer = useCallback((drawer) => {
    preloadChatDrawer(drawer);
    setActiveDrawer((current) => (current === drawer ? null : drawer));
  }, [preloadChatDrawer]);

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

    fetchContacts().then((loadedContacts) => {
      if (!activeContactRef.current && !activeGroupRef.current && Array.isArray(loadedContacts) && loadedContacts.length > 0) {
        const first = loadedContacts[0];
        setActiveContactId(first.id);
        setActiveContactSnapshot(first);
        activeContactRef.current = first.id;
      }

      fetch(`${API_URL}/user`, { headers })
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

      fetch(`${API_URL}/groups`, { headers })
        .then(res => {
          if (!res.ok) throw new Error('API Error');
          return res.json();
        })
        .then(data => { setGroups(data); setGroupChatEnabled(true); })
        .catch(err => { console.warn('[DLC] Group Chat DLC not available:', err.message); setGroupChatEnabled(false); });

      fetch(`${API_URL}/system/announcement`, { headers })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.announcement) {
            setGlobalAnnouncement(data.announcement.content);
          }
        })
        .catch(err => console.error('Failed to load announcement:', err));
    });
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
        }
        hasOpenedWs = true;
        scheduleContactsRefresh(100);
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
  }, [token, fetchContacts, scheduleContactsRefresh, removeDeletedContact]);

  // Update contact last message preview on new incoming message
  useEffect(() => {
    if (incomingMessageQueue.length > 0) {
      let playedSound = false;
      let contactsChanged = false;

      setContacts(prev => {
        let updatedContacts = [...prev];

        incomingMessageQueue.forEach(incomingMsg => {
          // Prevent double-processing the exact same message
          if (processedMessagesRef.current.has(incomingMsg.id)) return;
          processedMessagesRef.current.add(incomingMsg.id);
          contactsChanged = true;

          // Play notification sound
          if (!playedSound && incomingMsg.role !== 'user' && incomingMsg.character_id !== activeContactRef.current) {
            playedSound = true;
            try {
              const audio = new Audio('/pop.wav');
              audio.play().catch(e => console.error("Audio play blocked:", e));
            } catch (e) { console.error(e); }
          }

          updatedContacts = updatedContacts.map(c => {
            if (c.id === incomingMsg.character_id) {
              const newUnread = c.id === activeContactRef.current ? 0 : (c.unread || 0) + 1;
              return {
                ...c,
                lastMessage: incomingMsg.content,
                time: new Date(incomingMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                unread: newUnread
              };
            }
            return c;
          });
        });

        return contactsChanged ? updatedContacts : prev;
      });
    }
  }, [incomingMessageQueue]);

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
  const isStaticPixelSceneView = activeTab === 'memory_library' || activeTab === 'mcp_lab' || activeTab === 'settings' || activeTab === 'admin' || activeTab === 'housing_social';
  const isBarePixelSceneView = activeTab === 'pixel_world' || activeTab === 'city';
  const activePluginMeta = visiblePlugins.find(p => p.id === activeTab);
  const ActivePluginIcon = activePluginMeta?.icon;
  const hasPixelSceneView = isChatSceneView || isContactsSceneView || isStaticPixelSceneView;
  const hasPixelSkinView = hasPixelSceneView || isBarePixelSceneView || activeTab === 'chats';
  const hasForegroundSceneView = hasPixelSceneView && privateChatForegroundEnabled;
  const isForegroundExitingSceneView = hasPixelSceneView && !privateChatForegroundEnabled && privateChatForegroundExiting;
  const shouldRenderForegroundScene = hasForegroundSceneView || isForegroundExitingSceneView;
  const isForegroundLayoutLifted = shouldRenderForegroundScene;

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
    <div className={`app-container tab-${activeTab} ${activeContactId || activeGroupId ? 'has-active-chat' : 'no-active-chat'} ${isViewingList ? 'viewing-list' : 'viewing-content'} ${hasPixelSkinView ? 'has-chat-skin has-private-chat' : ''} ${isPrivateChatView ? 'is-private-chat-scene' : ''} ${isContactsSceneView ? 'is-contacts-scene' : ''} ${isStaticPixelSceneView ? 'is-static-pixel-scene' : ''} ${isBarePixelSceneView ? 'is-bare-pixel-scene' : ''} ${activeGroupId && activeTab === 'chats' ? 'is-group-chat-scene' : ''} ${hasForegroundSceneView ? 'is-foreground-enabled' : 'is-foreground-disabled'} ${isForegroundExitingSceneView ? 'is-foreground-exiting' : ''} ${isForegroundLayoutLifted ? 'is-foreground-lifted' : ''} ${privateChatDecorEditorOpen ? 'is-decor-editing' : ''}`}>
      {globalAnnouncement && (
        <div style={{ position: 'absolute', top: 0, left: '70px', right: 0, zIndex: 9999, background: 'var(--primary, #07c160)', color: 'white', padding: '10px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 'bold' }}>📢</span>
          <span>{globalAnnouncement}</span>
          <button onClick={() => setGlobalAnnouncement(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', marginLeft: 'auto', fontSize: '20px', padding: '0 5px' }}>&times;</button>
        </div>
      )}
      {shouldRenderForegroundScene && (
        <>
          <div className="private-chat-floor-decor" aria-hidden="true">
            <img
              className="private-chat-scene-decor__floor"
              data-private-decor-id="floor"
              style={getPrivateChatDecorStyle('floor')}
              src="/assets/ui/private-chat/pixel-foreground-floor-ai-grid.png?v=20260626"
              alt=""
            />
          </div>
          <div className="private-chat-scene-decor" aria-hidden="true">
            <img
              className="private-chat-scene-decor__cottage"
              data-private-decor-id="cottage"
              style={getPrivateChatDecorStyle('cottage')}
              src="/assets/ui/private-chat/pixel-left-cottage-house.png?v=20260626b"
              alt=""
            />
            <img
              className="private-chat-scene-decor__cart"
              data-private-decor-id="cart"
              style={getPrivateChatDecorStyle('cart')}
              src="/assets/ui/private-chat/pixel-right-garden-sign.png?v=20260626b"
              alt=""
            />
            <div className="private-chat-pet-lane" />
          </div>
          <PrivateChatDecorEditor
            open={privateChatDecorEditorOpen}
            onOpenChange={setPrivateChatDecorEditorOpenPersisted}
            transforms={privateChatDecorTransforms}
            setTransforms={setPrivateChatDecorTransforms}
            isPrivateChatView={hasForegroundSceneView}
          />
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
          <button className={`nav-icon ${activeTab === 'contacts' ? 'active' : ''}`} data-label={lang === 'en' ? 'Contacts' : '联系人'} onClick={() => setActiveTab('contacts')} title={lang === 'en' ? 'Contacts — Manage characters & groups' : '通讯录 — 管理角色和群聊'}>
            <Users size={24} />
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
          <button className="nav-icon" data-label={lang === 'en' ? 'Chinese' : '语言切换'} onClick={toggleLanguage} title={t('Toggle Language')}>
            <Globe size={24} />
            <span style={{ fontSize: '10px', marginTop: '4px', fontWeight: 'bold' }}>{lang === 'en' ? '中' : 'EN'}</span>
          </button>
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
      <div className="middle-column" data-panel-title={activeTab === 'chats' ? (lang === 'en' ? 'Private Chat' : '私聊') : ''}>
        {activeTab === 'chats' && (
          <div className="middle-column-heading">
            <h2>{lang === 'en' ? 'Private Chat' : '私聊'}</h2>
            <button
              type="button"
              className={`foreground-toggle ${privateChatForegroundEnabled ? 'is-on' : 'is-off'}`}
              aria-label={privateChatForegroundEnabled ? '关闭前景' : '开启前景'}
              aria-pressed={privateChatForegroundEnabled}
              title={privateChatForegroundEnabled ? '关闭前景' : '开启前景'}
              onClick={handlePrivateChatForegroundToggle}
            >
              <span className="foreground-toggle__text">前景</span>
              <span className="foreground-toggle__track" aria-hidden="true">
                <span className="foreground-toggle__thumb" />
              </span>
            </button>
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
              {groups.map(g => (
                <div
                  key={g.id}
                  className={`contact-item ${activeGroupId === g.id ? 'active' : ''}`}
                  onClick={() => { setActiveGroupId(g.id); setActiveContactId(null); activeContactRef.current = null; }}
                >
                  <div className="contact-avatar" style={{ width: 'auto', minWidth: '42px', height: '42px', display: 'flex', alignItems: 'center' }}>
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
                          key={idx}
                          size={g.members.length === 1 ? 42 : 32}
                          frame={memberFrame}
                          src={memberAvatar}
                          fallbackSrc={defaultAvatarUrl(memberName)}
                          alt=""
                          style={{ marginLeft: idx > 0 ? '-12px' : '0', zIndex: 10 - idx }}
                          imageStyle={{ border: g.members.length === 1 ? '1px solid rgba(255, 111, 151, 0.28)' : '2px solid #fff' }}
                        />
                      );
                    })}
                    {g.members?.length > 3 && (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', marginLeft: '-12px', border: '2px solid #fff', zIndex: 6, backgroundColor: '#f0f0f0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>
                        +{g.members.length - 3}
                      </div>
                    )}
                    {(!g.members || g.members.length === 0) && <div style={{ width: '42px', height: '42px', backgroundColor: '#e1e1e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><UsersRound size={20} style={{ color: '#fff' }} /></div>}
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">{g.name}</div>
                    <div className="contact-preview" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({g.members?.length || 0})</div>
                  </div>
                </div>
              ))}
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
                  onClick={() => setShowAddCharModal(true)}
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
          {activeTab === 'mcp_lab' && activePluginMeta && ActivePluginIcon && (
            <div className="contact-item active">
              <ActivePluginIcon size={24} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
              <div className="contact-info">
                <div className="contact-name">{lang === 'en' ? activePluginMeta.name_en : activePluginMeta.name_zh}</div>
              </div>
            </div>
          )}
        </div>
      </div>



      {/* 3. Right Column (Chat Area / Content) — hidden on contacts tab */}
      {activeTab !== 'contacts' && (
        <div className="right-column" style={{ flexDirection: 'row', backgroundColor: activeTab === 'settings' ? '#f5f5f5' : '#fff' }}>
          <AppErrorBoundary resetKey={`content:${activeTab}:${activeContactId || ''}:${activeGroupId || ''}`} lang={lang}>
            <Suspense fallback={<PanelFallback />}>
              {(visiblePlugins.find(p => p.id === activeTab)) ? (() => {
                const Plugin = visiblePlugins.find(p => p.id === activeTab);
                const PluginComponent = Plugin.component;
                return (
                  <div className="plugin-content-shell" style={{ flex: 1, height: '100%', overflowY: 'auto', minWidth: 0, minHeight: 0 }}>
                    <PluginComponent apiUrl={API_URL} userProfile={effectiveUser} />
                  </div>
                );
              })() : activeTab === 'settings' ? (
                <div style={{ flex: 1, height: '100%', overflowY: 'auto', minWidth: 0, minHeight: 0 }}>
                  <SettingsPanel
                    apiUrl={API_URL}
                    contacts={contacts}
                    onCharactersUpdate={(event) => {
                      if (event?.type === 'deleted') {
                        removeDeletedContact(event.id);
                      }
                      fetchContacts(); // Refetch after create/update/delete
                    }}
                    onProfileUpdate={setUserProfile}
                    onBack={() => setActiveTab('chats')}
                  />
                </div>
              ) : activeTab === 'memory_library' ? (
                <MemoryLibraryPanel apiUrl={API_URL} contacts={contacts} />
              ) : activeContactId && activeTab === 'chats' ? (
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
                    onBack={() => setActiveGroupId(null)}
                    onGroupUpdated={(updatedGroup) => {
                      setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
                    }}
                  />
                </div>
              ) : (
                <div className="empty-chat-state">
                  <MessageSquare size={64} className="empty-icon" />
                  <p>ChatPulse</p>
                </div>
              )}
            </Suspense>
          </AppErrorBoundary>
        </div>
      )}



      <AddCharacterModal
        isOpen={showAddCharModal}
        onClose={() => setShowAddCharModal(false)}
        apiUrl={API_URL}
        onAdd={(newChar) => {
          setContacts(prev => [...prev, newChar]);
        }}
      />

      {groupChatEnabled && showCreateGroupModal && (
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
      )}
    </div>
  );
}

export default App;
