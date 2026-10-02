export function createModuleLoading(dependencies) {
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
    dependencies.RETIRED_THEME_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear retired theme storage:', error);
  }

  const root = document.documentElement;
  root.removeAttribute('data-theme');
  dependencies.RETIRED_THEME_CSS_VARS.forEach(key => root.style.removeProperty(key));
  document.getElementById('chatpulse-custom-css')?.remove();
}

function lazyWithPreload(factory) {
  let loadPromise = null;
  const loadWithRetry = async (attempt = 0) => {
    try {
      return await factory();
    } catch (error) {
      if (!isLikelyModuleLoadError(error) || attempt >= dependencies.MODULE_LOAD_RETRY_LIMIT) {
        throw error;
      }
      const delay = Math.min(dependencies.MODULE_LOAD_RETRY_MAX_MS, dependencies.MODULE_LOAD_RETRY_BASE_MS * (attempt + 1));
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
  const Component = dependencies.lazy(load);
  Component.preload = () => load().catch((error) => {
    console.warn('[lazy] Preload failed:', error);
    return null;
  });
  return Component;
}





function PanelFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a8f98', fontSize: '13px' }}>
      Loading...
    </div>
  );
}

function DrawerFallback({ type = 'settings', contact, lang = 'zh' }) {
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
            <dependencies.BookOpen size={18} />
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
          <dependencies.Settings size={18} />
          {lang === 'en' ? 'Chat Settings' : '聊天设置'}
        </h3>
      </div>
      <div className="memory-content">
        <p className="loading-text">{lang === 'en' ? 'Loading settings...' : '加载设置中...'}</p>
      </div>
    </aside>
  );
}

class AppErrorBoundary extends dependencies.React.Component {
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
    return `${dependencies.MODULE_LOAD_AUTO_RETRY_PREFIX}${resetKey}:${getModuleLoadErrorSignature(error)}`;
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
      }, dependencies.MODULE_LOAD_AUTO_RETRY_DELAY_MS);
      return;
    }
    if (!storage) {
      this.setState({ autoReloading: true });
      this.autoReloadTimer = window.setTimeout(() => {
        this.autoReloadTimer = null;
        this.retry();
      }, dependencies.MODULE_LOAD_AUTO_RETRY_DELAY_MS);
      return;
    }

    const storageKey = this.getAutoRetryStorageKey(error);
    try {
      if (storage.getItem(storageKey) === '1') {
        this.setState({ autoReloading: true });
        this.autoReloadTimer = window.setTimeout(() => {
          this.autoReloadTimer = null;
          this.retry();
        }, dependencies.MODULE_LOAD_AUTO_RETRY_DELAY_MS + 1000);
        return;
      }
      storage.setItem(storageKey, '1');
    } catch {
      this.setState({ autoReloading: true });
      this.autoReloadTimer = window.setTimeout(() => {
        this.autoReloadTimer = null;
        this.retry();
      }, dependencies.MODULE_LOAD_AUTO_RETRY_DELAY_MS);
      return;
    }

    this.setState({ autoReloading: true });
    this.autoReloadTimer = window.setTimeout(() => {
      this.autoReloadTimer = null;
        this.retry();
    }, dependencies.MODULE_LOAD_AUTO_RETRY_DELAY_MS);
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
return { isLikelyModuleLoadError, getModuleLoadErrorSignature, wait, clearRetiredThemeOverrides, lazyWithPreload, PanelFallback, DrawerFallback, AppErrorBoundary };
}

