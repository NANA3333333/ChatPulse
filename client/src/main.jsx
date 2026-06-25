import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './LanguageContext.jsx'
import { AuthProvider } from './AuthContext.jsx'

const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api`;

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
  <StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AuthProvider>
  </StrictMode>,
)
