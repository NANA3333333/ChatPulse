import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './LanguageContext.jsx'
import { AuthProvider } from './AuthContext.jsx'

// Intercept global fetch to automatically inject Authorization token
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  const token = localStorage.getItem('cp_token');

  // Only intercept our own API calls
  if (token && typeof resource === 'string' && resource.includes('/api/')) {
    config = config || {};
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
    args[1] = config;
  }

  const response = await originalFetch(...args);
  // Auto logout if token expires or is invalid (skip /auth/login so we don't loop on bad passwords)
  if (response.status === 401 && !resource.includes('/api/auth/')) {
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
