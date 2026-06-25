import React, { useEffect, useState } from 'react';

const CONFIGURED_API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api`;

function getConfiguredApiUrl() {
    return new URL(CONFIGURED_API_URL, window.location.origin);
}

function getConfiguredApiPath() {
    return getConfiguredApiUrl().pathname.replace(/\/+$/, '') || '/api';
}

function needsAuthenticatedFetch(src) {
    const raw = String(src || '').trim();
    if (!raw) return false;
    try {
        const imageUrl = new URL(raw, window.location.origin);
        const apiUrl = getConfiguredApiUrl();
        const apiPath = getConfiguredApiPath();
        const mediaPath = `${apiPath}/media/uploads/`;
        if (imageUrl.origin === window.location.origin && imageUrl.pathname.startsWith('/api/media/uploads/')) {
            return true;
        }
        return imageUrl.origin === apiUrl.origin && imageUrl.pathname.startsWith(mediaPath);
    } catch {
        return false;
    }
}

function AuthenticatedImage({ src, fallbackSrc = '', onError, ...props }) {
    const imageSrc = String(src || '').trim();
    const [objectUrl, setObjectUrl] = useState('');
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
        setObjectUrl('');
        if (!needsAuthenticatedFetch(imageSrc)) return undefined;

        let cancelled = false;
        let nextObjectUrl = '';
        const token = localStorage.getItem('cp_token') || '';
        if (!token) {
            setFailed(true);
            return undefined;
        }

        fetch(imageSrc, { headers: { Authorization: `Bearer ${token}` } })
            .then((response) => {
                if (!response.ok) throw new Error(`Image request failed with ${response.status}`);
                return response.blob();
            })
            .then((blob) => {
                if (cancelled) return;
                nextObjectUrl = URL.createObjectURL(blob);
                setObjectUrl(nextObjectUrl);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });

        return () => {
            cancelled = true;
            if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
        };
    }, [imageSrc]);

    const displaySrc = failed ? (fallbackSrc || '') : (objectUrl || imageSrc || fallbackSrc);

    return (
        <img
            {...props}
            src={displaySrc}
            onError={(event) => {
                if (!failed && fallbackSrc) setFailed(true);
                if (onError) onError(event);
            }}
        />
    );
}

export default AuthenticatedImage;
