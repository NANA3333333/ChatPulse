/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext } from 'react';

export const AuthContext = createContext();

function readStoredUser() {
    const saved = localStorage.getItem('cp_user');
    if (!saved) return null;
    try {
        return JSON.parse(saved);
    } catch (error) {
        console.warn('[AuthContext] Failed to parse cp_user from localStorage. Clearing corrupted state.', error);
        localStorage.removeItem('cp_user');
        return null;
    }
}

export function useAuth() {
    return useContext(AuthContext);
}

function buildAuthUrl(apiUrl, path) {
    const cleanApiUrl = String(apiUrl || '/api').replace(/\/+$/, '');
    const apiBase = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;
    return `${apiBase}${path}`;
}

export function AuthProvider({ children }) {
    const [token, setToken] = useState(localStorage.getItem('cp_token'));
    const [user, setUser] = useState(() => readStoredUser());

    const login = (newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('cp_token', newToken);
        localStorage.setItem('cp_user', JSON.stringify(newUser));
    };

    const updateUser = (nextUser) => {
        setUser(nextUser);
        localStorage.setItem('cp_user', JSON.stringify(nextUser));
    };

    const logout = async (apiUrl) => {
        const currentToken = localStorage.getItem('cp_token');
        if (currentToken) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            try {
                await fetch(buildAuthUrl(apiUrl, '/auth/logout'), {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${currentToken}` },
                    keepalive: true,
                    signal: controller.signal
                });
            } catch {
                // Local state still needs to be cleared even if the network request is interrupted.
            } finally {
                clearTimeout(timeoutId);
            }
        }
        setToken(null);
        setUser(null);
        localStorage.removeItem('cp_token');
        localStorage.removeItem('cp_user');
        window.location.reload();
    };

    return (
        <AuthContext.Provider value={{ token, user, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}
