import { useCallback, useEffect, useRef, useState } from 'react';

export function useForegroundSettings(dependencies) {
const { DESKTOP_WALLPAPER_STORAGE_KEY, PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY, PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY, PRIVATE_CHAT_FOREGROUND_EXIT_MS, loadDesktopWallpaper, loadPrivateChatDecorTransforms, loadPrivateChatForegroundEnabled, loadPrivateChatForegroundPersonPosition, normalizeDecorTransform, normalizeDesktopWallpaper } = dependencies;
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
  }, [PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY]);

const handleDesktopWallpaperChange = useCallback((nextWallpaper) => {
    const normalized = normalizeDesktopWallpaper(nextWallpaper);
    setDesktopWallpaper(normalized);
    try {
      window.localStorage.setItem(DESKTOP_WALLPAPER_STORAGE_KEY, normalized);
    } catch (error) {
      console.warn('Failed to save desktop wallpaper preference:', error);
    }
  }, [DESKTOP_WALLPAPER_STORAGE_KEY, normalizeDesktopWallpaper]);

const getPrivateChatDecorStyle = useCallback((id) => {
    const transform = normalizeDecorTransform(privateChatDecorTransforms[id]);
    return {
      '--decor-x': `${Math.round(transform.x)}px`,
      '--decor-y': `${Math.round(transform.y)}px`,
      '--decor-scale': Number(transform.scale.toFixed(3)),
    };
  }, [normalizeDecorTransform, privateChatDecorTransforms]);

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
  }, [PRIVATE_CHAT_FOREGROUND_EXIT_MS, clearPrivateChatForegroundExitTimer, privateChatForegroundEnabled]);

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
  }, [PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY, privateChatForegroundEnabled]);
    return { desktopWallpaper, setDesktopWallpaper, privateChatForegroundEnabled, setPrivateChatForegroundEnabled, privateChatForegroundExiting, setPrivateChatForegroundExiting, privateChatForegroundExitTimerRef, privateChatDecorTransforms, setPrivateChatDecorTransforms, privateChatForegroundPersonPosition, setPrivateChatForegroundPersonPosition, privateChatForegroundPersonPositionRef, privateChatForegroundPersonKeysRef, privateChatForegroundPersonLastSaveRef, privateChatDecorEditorOpen, setPrivateChatDecorEditorOpen, setPrivateChatDecorEditorOpenPersisted, handleDesktopWallpaperChange, getPrivateChatDecorStyle, clearPrivateChatForegroundExitTimer, handlePrivateChatForegroundToggle };
}
