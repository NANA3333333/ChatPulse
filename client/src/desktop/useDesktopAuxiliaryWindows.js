import { DESKTOP_RECYCLE_BIN_ID, DESKTOP_ALBUM_APP_ID } from './desktopUtils';
import { useRef, useState, useCallback } from 'react';
import { getDefaultFolderWindowGeometry, clampFolderWindowGeometry } from './windowGeometry.js';

export function useDesktopAuxiliaryWindows({ setFolderDropTargetId }) {
    const [openFolderWindowIds, setOpenFolderWindowIds] = useState([]);

    const [activeFolderWindowId, setActiveFolderWindowId] = useState(null);

    const [folderWindowStates, setFolderWindowStates] = useState({});

    const [albumWindowOpen, setAlbumWindowOpen] = useState(false);

    const [albumWindowState, setAlbumWindowState] = useState(() => ({
        geometry: getDefaultFolderWindowGeometry(2),
        minimized: false,
        maximized: false,
        zIndex: 86,
    }));

    const [recycleBinWindowOpen, setRecycleBinWindowOpen] = useState(false);

    const [recycleBinWindowState, setRecycleBinWindowState] = useState(() => ({
        geometry: getDefaultFolderWindowGeometry(1),
        minimized: false,
        maximized: false,
        zIndex: 84,
    }));

    const folderWindowZCounterRef = useRef(120);

    const allocateFolderWindowZIndex = useCallback(() => {
        folderWindowZCounterRef.current += 1;
        return folderWindowZCounterRef.current;
    }, []);

    const makeFolderWindowState = useCallback(
        (index = 0, zIndex = allocateFolderWindowZIndex()) => ({
            geometry: getDefaultFolderWindowGeometry(index),
            minimized: false,
            maximized: false,
            zIndex,
        }),
        [allocateFolderWindowZIndex],
    );

    const openCreatedFolderWindow = useCallback(
        (folderId) => {
            if (!folderId) return;
            const nextZIndex = allocateFolderWindowZIndex();
            setOpenFolderWindowIds((current) => (current.includes(folderId) ? current : [...current, folderId]));
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
        },
        [allocateFolderWindowZIndex, makeFolderWindowState, openFolderWindowIds.length],
    );

    const closeCreatedFolderWindow = useCallback(
        (folderId) => {
            setOpenFolderWindowIds((current) => current.filter((id) => id !== folderId));
            setFolderWindowStates((current) => {
                if (!current[folderId]) return current;
                const next = { ...current };
                delete next[folderId];
                return next;
            });
            setActiveFolderWindowId((current) => (current === folderId ? null : current));
            setFolderDropTargetId((current) => (current === folderId ? null : current));
        },
        [setFolderDropTargetId],
    );

    const updateFolderWindowState = useCallback(
        (folderId, updater) => {
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
        },
        [makeFolderWindowState, openFolderWindowIds],
    );

    const bringFolderWindowToFront = useCallback(
        (folderId) => {
            if (!folderId) return;
            const nextZIndex = allocateFolderWindowZIndex();
            setActiveFolderWindowId(folderId);
            updateFolderWindowState(folderId, { zIndex: nextZIndex });
        },
        [allocateFolderWindowZIndex, updateFolderWindowState],
    );

    const minimizeFolderWindow = useCallback(
        (folderId) => {
            updateFolderWindowState(folderId, { minimized: true });
            setActiveFolderWindowId((current) => (current === folderId ? null : current));
        },
        [updateFolderWindowState],
    );

    const restoreFolderWindow = useCallback(
        (folderId) => {
            if (!folderId) return;
            const nextZIndex = allocateFolderWindowZIndex();
            setActiveFolderWindowId(folderId);
            updateFolderWindowState(folderId, {
                minimized: false,
                zIndex: nextZIndex,
            });
        },
        [allocateFolderWindowZIndex, updateFolderWindowState],
    );

    const toggleFolderWindowMaximized = useCallback(
        (folderId) => {
            if (!folderId) return;
            const nextZIndex = allocateFolderWindowZIndex();
            setActiveFolderWindowId(folderId);
            updateFolderWindowState(folderId, (current) => ({
                maximized: !current.maximized,
                minimized: false,
                zIndex: nextZIndex,
            }));
        },
        [allocateFolderWindowZIndex, updateFolderWindowState],
    );

    const setFolderWindowGeometry = useCallback(
        (folderId, geometry) => {
            updateFolderWindowState(folderId, {
                geometry: clampFolderWindowGeometry(geometry),
            });
        },
        [updateFolderWindowState],
    );

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

    const openAlbumWindow = useCallback(() => {
        const nextZIndex = allocateFolderWindowZIndex();
        setAlbumWindowOpen(true);
        setAlbumWindowState((current) => ({
            ...current,
            minimized: false,
            zIndex: nextZIndex,
        }));
        setActiveFolderWindowId(DESKTOP_ALBUM_APP_ID);
    }, [allocateFolderWindowZIndex]);

    const closeAlbumWindow = useCallback(() => {
        setAlbumWindowOpen(false);
        setActiveFolderWindowId((current) => (current === DESKTOP_ALBUM_APP_ID ? null : current));
    }, []);

    const bringAlbumWindowToFront = useCallback(() => {
        const nextZIndex = allocateFolderWindowZIndex();
        setAlbumWindowOpen(true);
        setActiveFolderWindowId(DESKTOP_ALBUM_APP_ID);
        setAlbumWindowState((current) => ({
            ...current,
            minimized: false,
            zIndex: nextZIndex,
        }));
    }, [allocateFolderWindowZIndex]);

    const minimizeAlbumWindow = useCallback(() => {
        setAlbumWindowState((current) => ({ ...current, minimized: true }));
        setActiveFolderWindowId((current) => (current === DESKTOP_ALBUM_APP_ID ? null : current));
    }, []);

    const toggleAlbumWindowMaximized = useCallback(() => {
        const nextZIndex = allocateFolderWindowZIndex();
        setAlbumWindowOpen(true);
        setActiveFolderWindowId(DESKTOP_ALBUM_APP_ID);
        setAlbumWindowState((current) => ({
            ...current,
            maximized: !current.maximized,
            minimized: false,
            zIndex: nextZIndex,
        }));
    }, [allocateFolderWindowZIndex]);

    const setAlbumWindowGeometry = useCallback((geometry) => {
        setAlbumWindowState((current) => ({
            ...current,
            geometry: clampFolderWindowGeometry(geometry),
        }));
    }, []);

    return {
        openRecycleBinWindow,
        activeFolderWindowId,
        albumWindowOpen,
        openAlbumWindow,
        openCreatedFolderWindow,
        setOpenFolderWindowIds,
        setActiveFolderWindowId,
        setFolderWindowStates,
        closeCreatedFolderWindow,
        openFolderWindowIds,
        folderWindowStates,
        bringFolderWindowToFront,
        setFolderWindowGeometry,
        toggleFolderWindowMaximized,
        minimizeFolderWindow,
        restoreFolderWindow,
        recycleBinWindowOpen,
        recycleBinWindowState,
        bringRecycleBinWindowToFront,
        closeRecycleBinWindow,
        setRecycleBinWindowState,
        allocateFolderWindowZIndex,
        albumWindowState,
        bringAlbumWindowToFront,
        closeAlbumWindow,
        setAlbumWindowGeometry,
        toggleAlbumWindowMaximized,
        minimizeAlbumWindow,
    };
}
