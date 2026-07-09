import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './LanguageContext.jsx'
import { AuthProvider } from './AuthContext.jsx'

const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
const ASSET_PRELOAD_RECOVERY_KEY = 'chatpulse:asset-preload-recovery:v1';
const ASSET_PRELOAD_RECOVERY_COOLDOWN_MS = 30000;

function isRecoverableAssetLoadError(error) {
  const message = String(error?.message || error || '');
  return /Unable to preload CSS|Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script|error loading dynamically imported module|Loading chunk \d+ failed/i.test(message);
}

function getAssetLoadErrorSignature(error) {
  const message = String(error?.message || error || 'asset-load');
  const assetUrl = message.match(/https?:\/\/[^\s)]+|\/assets\/[^\s)]+/i)?.[0];
  return (assetUrl || message.slice(0, 180)).replace(/[^\w:./-]+/g, '_').slice(0, 220);
}

function scheduleAssetPreloadRecovery(error) {
  if (typeof window === 'undefined') return false;
  const signature = `${window.location.origin}${window.location.pathname}:${getAssetLoadErrorSignature(error)}`;
  try {
    const previous = JSON.parse(window.sessionStorage.getItem(ASSET_PRELOAD_RECOVERY_KEY) || 'null');
    if (
      previous?.signature === signature
      && Date.now() - Number(previous.at || 0) < ASSET_PRELOAD_RECOVERY_COOLDOWN_MS
    ) {
      return false;
    }
    window.sessionStorage.setItem(ASSET_PRELOAD_RECOVERY_KEY, JSON.stringify({ signature, at: Date.now() }));
  } catch {
    return false;
  }

  console.warn('[asset-preload] Asset preload failed; suppressing the error and keeping the current view.', error);
  return true;
}

window.addEventListener('vite:preloadError', (event) => {
  const error = event?.payload || event?.detail || event?.reason || event?.error;
  if (!isRecoverableAssetLoadError(error)) return;
  event.preventDefault?.();
  scheduleAssetPreloadRecovery(error);
});

window.addEventListener('error', (event) => {
  const target = event?.target;
  if (target && target !== window) {
    const tagName = String(target.tagName || '').toUpperCase();
    const rel = String(target.rel || '');
    const href = target.href || target.src || '';
    if ((tagName === 'LINK' || tagName === 'SCRIPT') && (/stylesheet|modulepreload/i.test(rel) || /\/assets\//i.test(href))) {
      scheduleAssetPreloadRecovery(new Error(`Asset failed to load: ${href}`));
    }
    return;
  }
  if (isRecoverableAssetLoadError(event?.error || event?.message)) {
    scheduleAssetPreloadRecovery(event.error || event.message);
  }
}, true);

function getFetchUrl(resource) {
  const rawUrl = typeof resource === 'string' ? resource : (resource?.url || '');
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl, window.location.origin);
  } catch {
    return null;
  }
}

function getConfiguredApiUrl() {
  return new URL(CONFIGURED_API_URL, window.location.origin);
}

function getConfiguredApiPath() {
  return getConfiguredApiUrl().pathname.replace(/\/+$/, '') || '/api';
}

function isChatPulseApiRequest(resource) {
  const requestUrl = getFetchUrl(resource);
  if (!requestUrl) return false;
  const apiUrl = getConfiguredApiUrl();
  const apiPath = getConfiguredApiPath();
  if (requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api/')) return true;
  return requestUrl.origin === apiUrl.origin && (requestUrl.pathname === apiPath || requestUrl.pathname.startsWith(`${apiPath}/`));
}

function isBootstrapUserRequest(resource) {
  const requestUrl = getFetchUrl(resource);
  if (!requestUrl || !isChatPulseApiRequest(resource)) return false;
  return requestUrl.pathname === `${getConfiguredApiPath()}/user`;
}

// Intercept global fetch to automatically inject Authorization token
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  const token = localStorage.getItem('cp_token');

  // Only intercept our own API calls
  if (token && isChatPulseApiRequest(resource)) {
    config = config || {};
    const headers = new Headers(config.headers || (resource instanceof Request ? resource.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
    args[1] = config;
  }

  const response = await originalFetch(...args);
  const shouldForceLogout = isBootstrapUserRequest(resource);
  // Only force logout on the bootstrap auth/profile endpoint.
  // Do not wipe local login state just because some secondary request returned 401.
  if (response.status === 401 && shouldForceLogout) {
    localStorage.removeItem('cp_token');
    localStorage.removeItem('cp_user');
    window.location.reload();
  }
  return response;
};

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </AuthProvider>,
)
