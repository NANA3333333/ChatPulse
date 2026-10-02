import {
    normalizeDesktopWallpaper,
    DESKTOP_WALLPAPER_IMAGE_URLS,
    loadDesktopIconLayout,
    loadDesktopStoredChoice,
    DESKTOP_ICON_SIZE_STORAGE_KEY,
    loadDesktopStoredBoolean,
    DESKTOP_ICONS_VISIBLE_STORAGE_KEY,
    DESKTOP_AUTO_ARRANGE_STORAGE_KEY,
    DESKTOP_ALIGN_TO_GRID_STORAGE_KEY,
    loadCreatedDesktopItems,
    loadRecycleBinItems,
    loadDesktopAlbumPhotos,
    DESKTOP_RECYCLE_BIN_ID,
    DESKTOP_ALBUM_APP_ID,
    DESKTOP_APP_ICONS,
    normalizeDesktopIconPosition,
    getDefaultDesktopIconPosition,
    findOpenDesktopIconPosition,
    saveDesktopIconLayout,
    saveDesktopStoredPreference,
    saveCreatedDesktopItems,
    saveRecycleBinItems,
    saveDesktopAlbumPhotos,
    createDesktopPhotoId,
    normalizeCreatedDesktopItem,
    normalizeRecycleBinItem,
    createDesktopItemId,
    getDesktopGridMetrics,
    clampDesktopIconPosition,
} from './desktopUtils';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { getDefaultFolderWindowGeometry, clampFolderWindowGeometry } from './windowGeometry.js';
import { Recycle, Folder, Image as ImageIcon, FileText, MessageSquare } from 'lucide-react';
import { captureDesktopElement, formatDesktopPhotoTimestamp } from './desktopPhoto.js';
import Live2DDesktopWallpaper from './Live2DDesktopWallpaper.jsx';
import DesktopAppButton from './DesktopAppButton';
import { DesktopContextMenu } from './components/DesktopContextMenu.jsx';
import { DesktopFolderWindow } from './windows/DesktopFolderWindow.jsx';
import { DesktopRecycleBinWindow } from './windows/DesktopRecycleBinWindow.jsx';
import { DesktopAlbumWindow } from './windows/DesktopAlbumWindow.jsx';
import { DesktopTextDocumentWindow } from './windows/DesktopTextDocumentWindow.jsx';
import 'react-dom';
import '../shared/media/avatar.js';
import { useDesktopAuxiliaryWindows } from './useDesktopAuxiliaryWindows.js';

const API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

function ChatPulseDesktop({ lang, apps, desktopWallpaper, showWallpaper = true }) {
    const normalizedWallpaper = normalizeDesktopWallpaper(desktopWallpaper);
    const wallpaperImageSrc = DESKTOP_WALLPAPER_IMAGE_URLS[normalizedWallpaper];
    const wallpaperAnimated = normalizedWallpaper === 'ocean-live2d';
    const desktopHomeRef = useRef(null);
    const gridRef = useRef(null);
    const dragRef = useRef(null);
    const suppressClickRef = useRef(null);
    const settleFrameRef = useRef(null);
    const settleTimerRef = useRef(null);
    const [iconLayout, setIconLayout] = useState(loadDesktopIconLayout);
    const [draggingIcon, setDraggingIcon] = useState(null);
    const [folderDropTargetId, setFolderDropTargetId] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [desktopClipboard, setDesktopClipboard] = useState(null);

    const [desktopRefreshPulse, setDesktopRefreshPulse] = useState(0);
    const desktopRefreshTimerRef = useRef(null);
    const [desktopIconSize, setDesktopIconSize] = useState(() =>
        loadDesktopStoredChoice(DESKTOP_ICON_SIZE_STORAGE_KEY, ['large', 'medium', 'small'], 'medium'),
    );
    const [desktopIconsVisible, setDesktopIconsVisible] = useState(() =>
        loadDesktopStoredBoolean(DESKTOP_ICONS_VISIBLE_STORAGE_KEY, true),
    );
    const [desktopAutoArrange, setDesktopAutoArrange] = useState(() =>
        loadDesktopStoredBoolean(DESKTOP_AUTO_ARRANGE_STORAGE_KEY, false),
    );
    const [desktopAlignIconsToGrid, setDesktopAlignIconsToGrid] = useState(() =>
        loadDesktopStoredBoolean(DESKTOP_ALIGN_TO_GRID_STORAGE_KEY, true),
    );
    const [desktopSortKey, setDesktopSortKey] = useState('name');
    const [previousIconLayout, setPreviousIconLayout] = useState(null);
    const [createdDesktopItems, setCreatedDesktopItems] = useState(loadCreatedDesktopItems);
    const [recycleBinItems, setRecycleBinItems] = useState(loadRecycleBinItems);
    const [albumPhotos, setAlbumPhotos] = useState(loadDesktopAlbumPhotos);
    const [selectedAlbumPhotoId, setSelectedAlbumPhotoId] = useState('');
    const [openCreatedItemId, setOpenCreatedItemId] = useState(null);

    const [renamingCreatedItemId, setRenamingCreatedItemId] = useState(null);
    const [createdItemRenameDraft, setCreatedItemRenameDraft] = useState('');

    const showDesktopNotice = useCallback(() => {}, []);

    const appById = useMemo(() => new Map(apps.map((app) => [app.id, app])), [apps]);

    const folderedAppIds = useMemo(() => {
        const ids = new Set();
        createdDesktopItems.forEach((item) => {
            if (item.kind !== 'folder') return;
            (item.folderAppIds || []).forEach((appId) => ids.add(appId));
        });
        return ids;
    }, [createdDesktopItems]);

    const topLevelDesktopApps = useMemo(
        () => apps.filter((app) => !folderedAppIds.has(app.id)),
        [apps, folderedAppIds],
    );

    const {
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
    } = useDesktopAuxiliaryWindows({ setFolderDropTargetId });

    const recycleBinApp = useMemo(
        () => ({
            id: DESKTOP_RECYCLE_BIN_ID,
            label: lang === 'en' ? 'Recycle Bin' : '回收站',
            title: lang === 'en' ? 'Open Recycle Bin' : '打开回收站',
            kind: 'recycle-bin',
            variant: recycleBinItems.length ? 'recycle-bin-full' : 'recycle-bin-empty',
            icon: Recycle,
            iconImage: recycleBinItems.length ? DESKTOP_APP_ICONS.recycleBinFull : DESKTOP_APP_ICONS.recycleBinEmpty,
            shortcut: false,
            accent: '#3f8fd4',
            onOpen: openRecycleBinWindow,
        }),
        [lang, openRecycleBinWindow, recycleBinItems.length],
    );

    const albumApp = useMemo(() => {
        const previewPhoto = albumPhotos[0] || null;
        return {
            id: DESKTOP_ALBUM_APP_ID,
            label: lang === 'en' ? 'Pictures' : '图片',
            title: lang === 'en' ? 'Open Pictures' : '打开图片',
            kind: 'album',
            variant: 'folder',
            icon: Folder,
            iconImage: DESKTOP_APP_ICONS.createdFolder,
            folderPreviewApp: previewPhoto ? { icon: ImageIcon, iconImage: previewPhoto.dataUrl } : null,
            badge: albumPhotos.length ? String(Math.min(albumPhotos.length, 99)) : '',
            shortcut: false,
            accent: '#d69a24',
            active: activeFolderWindowId === DESKTOP_ALBUM_APP_ID && albumWindowOpen,
            running: albumWindowOpen,
            onOpen: openAlbumWindow,
        };
    }, [activeFolderWindowId, albumPhotos, albumWindowOpen, lang, openAlbumWindow]);

    const decoratedCreatedDesktopItems = useMemo(() => {
        return createdDesktopItems.map((item) => {
            const folderPreviewApp =
                item.kind === 'folder'
                    ? (item.folderAppIds || []).map((appId) => appById.get(appId)).find(Boolean)
                    : null;
            return {
                ...item,
                title:
                    item.kind === 'folder'
                        ? lang === 'en'
                            ? 'Open folder'
                            : '打开文件夹'
                        : lang === 'en'
                          ? 'Open text document'
                          : '打开文本文档',
                icon: item.kind === 'folder' ? Folder : FileText,
                iconImage:
                    item.kind === 'folder' ? DESKTOP_APP_ICONS.createdFolder : DESKTOP_APP_ICONS.createdTextDocument,
                folderPreviewApp,
                shortcut: false,
                accent: item.kind === 'folder' ? '#d69a24' : '#5d8fe8',
                onOpen: () => {
                    if (item.kind === 'folder') {
                        openCreatedFolderWindow(item.id);
                        return;
                    }
                    setOpenCreatedItemId(item.id);
                },
            };
        });
    }, [appById, createdDesktopItems, lang, openCreatedFolderWindow]);

    const desktopItems = useMemo(
        () => [recycleBinApp, albumApp, ...topLevelDesktopApps, ...decoratedCreatedDesktopItems],
        [albumApp, decoratedCreatedDesktopItems, recycleBinApp, topLevelDesktopApps],
    );

    const openCreatedItem = useMemo(
        () => createdDesktopItems.find((item) => item.id === openCreatedItemId && item.kind === 'text') || null,
        [createdDesktopItems, openCreatedItemId],
    );

    const appPositions = useMemo(() => {
        const used = new Set();
        return desktopItems.reduce((positions, app, index) => {
            let position = normalizeDesktopIconPosition(iconLayout[app.id]) || getDefaultDesktopIconPosition(index);
            let key = `${position.col}:${position.row}`;
            if (used.has(key)) {
                position = findOpenDesktopIconPosition(used, index);
                key = `${position.col}:${position.row}`;
            }
            used.add(key);
            positions[app.id] = position;
            return positions;
        }, {});
    }, [desktopItems, iconLayout]);

    useEffect(() => {
        const knownIds = new Set(desktopItems.map((app) => app.id));
        const compactLayout = Object.entries(iconLayout).reduce((nextLayout, [id, position]) => {
            if (!knownIds.has(id)) return nextLayout;
            const normalized = normalizeDesktopIconPosition(position);
            if (normalized) nextLayout[id] = normalized;
            return nextLayout;
        }, {});

        if (Object.keys(compactLayout).length !== Object.keys(iconLayout).length) {
            setIconLayout(compactLayout);
            return;
        }

        saveDesktopIconLayout(compactLayout);
    }, [desktopItems, iconLayout]);

    useEffect(
        () => () => {
            if (settleFrameRef.current) window.cancelAnimationFrame(settleFrameRef.current);
            if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
        },
        [],
    );

    useEffect(
        () => () => {
            if (desktopRefreshTimerRef.current) window.clearTimeout(desktopRefreshTimerRef.current);
        },
        [],
    );

    useEffect(() => {
        saveDesktopStoredPreference(DESKTOP_ICON_SIZE_STORAGE_KEY, desktopIconSize);
    }, [desktopIconSize]);

    useEffect(() => {
        saveDesktopStoredPreference(DESKTOP_ICONS_VISIBLE_STORAGE_KEY, desktopIconsVisible ? '1' : '0');
    }, [desktopIconsVisible]);

    useEffect(() => {
        saveDesktopStoredPreference(DESKTOP_AUTO_ARRANGE_STORAGE_KEY, desktopAutoArrange ? '1' : '0');
    }, [desktopAutoArrange]);

    useEffect(() => {
        saveDesktopStoredPreference(DESKTOP_ALIGN_TO_GRID_STORAGE_KEY, desktopAlignIconsToGrid ? '1' : '0');
    }, [desktopAlignIconsToGrid]);

    useEffect(() => {
        saveCreatedDesktopItems(createdDesktopItems);
    }, [createdDesktopItems]);

    useEffect(() => {
        saveRecycleBinItems(recycleBinItems);
    }, [recycleBinItems]);

    useEffect(() => {
        saveDesktopAlbumPhotos(albumPhotos);
    }, [albumPhotos]);

    useEffect(() => {
        if (selectedAlbumPhotoId && albumPhotos.some((photo) => photo.id === selectedAlbumPhotoId)) return;
        setSelectedAlbumPhotoId(albumPhotos[0]?.id || '');
    }, [albumPhotos, selectedAlbumPhotoId]);

    useEffect(() => {
        const createdItemIds = new Set(createdDesktopItems.map((item) => item.id));
        if (openCreatedItemId && !createdDesktopItems.some((item) => item.id === openCreatedItemId)) {
            setOpenCreatedItemId(null);
        }
        setOpenFolderWindowIds((current) => current.filter((id) => createdItemIds.has(id)));
        setActiveFolderWindowId((current) =>
            current === DESKTOP_RECYCLE_BIN_ID ||
            current === DESKTOP_ALBUM_APP_ID ||
            (current && createdItemIds.has(current))
                ? current
                : null,
        );
        setFolderWindowStates((current) => {
            const next = Object.entries(current).reduce((states, [id, value]) => {
                if (createdItemIds.has(id)) states[id] = value;
                return states;
            }, {});
            return Object.keys(next).length === Object.keys(current).length ? current : next;
        });
        if (renamingCreatedItemId && !createdDesktopItems.some((item) => item.id === renamingCreatedItemId)) {
            setRenamingCreatedItemId(null);
            setCreatedItemRenameDraft('');
        }
    }, [
        createdDesktopItems,
        openCreatedItemId,
        renamingCreatedItemId,
        setActiveFolderWindowId,
        setFolderWindowStates,
        setOpenFolderWindowIds,
    ]);

    useEffect(() => {
        if (!contextMenu) return undefined;
        const closeMenu = () => setContextMenu(null);
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') closeMenu();
        };
        window.addEventListener('pointerdown', closeMenu);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('pointerdown', closeMenu);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu]);

    const getContextMenuPoint = useCallback((event) => {
        const x = event.clientX;
        const y = event.clientY;
        return {
            x,
            y,
            submenuSide: 'right',
        };
    }, []);

    const openDesktopContextMenu = useCallback(
        (event) => {
            event.preventDefault();
            setContextMenu({
                type: 'desktop',
                ...getContextMenuPoint(event),
            });
        },
        [getContextMenuPoint],
    );

    const openAppContextMenu = useCallback(
        (event, app) => {
            event.preventDefault();
            event.stopPropagation();
            setContextMenu({
                type: 'app',
                appId: app.id,
                ...getContextMenuPoint(event),
            });
        },
        [getContextMenuPoint],
    );

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const rememberIconLayout = useCallback(() => {
        setPreviousIconLayout(iconLayout);
    }, [iconLayout]);

    const triggerDesktopRefreshPulse = useCallback(() => {
        setDesktopRefreshPulse((current) => (current % 2) + 1);
        if (desktopRefreshTimerRef.current) {
            window.clearTimeout(desktopRefreshTimerRef.current);
        }
        desktopRefreshTimerRef.current = window.setTimeout(() => {
            setDesktopRefreshPulse(0);
            desktopRefreshTimerRef.current = null;
        }, 560);
    }, []);

    const handleRefreshDesktop = useCallback(() => {
        triggerDesktopRefreshPulse();
        closeContextMenu();
        showDesktopNotice(
            lang === 'en' ? 'Desktop refreshed' : '桌面已刷新',
            lang === 'en' ? 'Icons and wallpaper state were re-rendered.' : '图标和壁纸状态已重新渲染。',
        );
    }, [closeContextMenu, lang, showDesktopNotice, triggerDesktopRefreshPulse]);

    const handleCaptureDesktopScreenshot = useCallback(async () => {
        closeContextMenu();
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
        const now = Date.now();
        const image = await captureDesktopElement(desktopHomeRef.current, lang);
        const photo = {
            id: createDesktopPhotoId(),
            label:
                lang === 'en'
                    ? `Screenshot ${formatDesktopPhotoTimestamp(now, lang)}`
                    : `截图 ${formatDesktopPhotoTimestamp(now, lang)}`,
            createdAt: now,
            ...image,
        };
        setAlbumPhotos((current) => {
            const saved = saveDesktopAlbumPhotos([photo, ...current]);
            return saved;
        });
        setSelectedAlbumPhotoId(photo.id);
        openAlbumWindow();
        showDesktopNotice(
            lang === 'en' ? 'Screenshot saved' : '截图已保存',
            lang === 'en' ? 'Saved to Pictures.' : '已放入图片。',
        );
    }, [closeContextMenu, lang, openAlbumWindow, showDesktopNotice]);

    const handleDeleteAlbumPhoto = useCallback((photoId) => {
        if (!photoId) return;
        setAlbumPhotos((current) => {
            const next = current.filter((photo) => photo.id !== photoId);
            saveDesktopAlbumPhotos(next);
            return next;
        });
    }, []);

    const handleClearAlbumPhotos = useCallback(() => {
        if (!albumPhotos.length) return;
        const confirmed = window.confirm(lang === 'en' ? 'Clear all photos in Pictures?' : '清空图片里的所有照片？');
        if (!confirmed) return;
        setAlbumPhotos([]);
        saveDesktopAlbumPhotos([]);
    }, [albumPhotos.length, lang]);

    const handleArrangeIcons = useCallback(
        (keepMenuOpen = false) => {
            rememberIconLayout();
            setIconLayout({});
            if (!keepMenuOpen) closeContextMenu();
            showDesktopNotice(
                lang === 'en' ? 'Icons arranged' : '图标已自动排列',
                lang === 'en'
                    ? 'Desktop icons were placed back into the Windows-style grid.'
                    : '桌面图标已回到类似 Windows 的网格位置。',
            );
        },
        [closeContextMenu, lang, rememberIconLayout, showDesktopNotice],
    );

    const handleUndoIconLayout = useCallback(() => {
        if (previousIconLayout) {
            setIconLayout(previousIconLayout);
            setPreviousIconLayout(null);
            showDesktopNotice(
                lang === 'en' ? 'Undo complete' : '已撤销上一步',
                lang === 'en' ? 'The previous desktop layout was restored.' : '已恢复上一次桌面布局。',
            );
        } else {
            triggerDesktopRefreshPulse();
            showDesktopNotice(
                lang === 'en' ? 'Nothing to undo' : '没有可撤销的删除',
                lang === 'en' ? 'The desktop was refreshed instead.' : '已改为刷新桌面。',
            );
        }
        closeContextMenu();
    }, [closeContextMenu, lang, previousIconLayout, showDesktopNotice, triggerDesktopRefreshPulse]);

    const applySequentialIconLayout = useCallback(
        (orderedApps) => {
            rememberIconLayout();
            setIconLayout(
                Object.fromEntries(orderedApps.map((app, index) => [app.id, getDefaultDesktopIconPosition(index)])),
            );
            closeContextMenu();
        },
        [closeContextMenu, rememberIconLayout],
    );

    const handleSortIcons = useCallback(
        (sortKey) => {
            setDesktopSortKey(sortKey);
            const sortedApps = [...desktopItems].sort((a, b) => {
                if (sortKey === 'status') {
                    return (
                        Number(Boolean(b.active || b.running)) - Number(Boolean(a.active || a.running)) ||
                        String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'zh-Hans-CN')
                    );
                }
                if (sortKey === 'unread') {
                    return (
                        Number(Boolean(b.badge)) - Number(Boolean(a.badge)) ||
                        String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'zh-Hans-CN')
                    );
                }
                return String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'zh-Hans-CN');
            });
            applySequentialIconLayout(sortedApps);
            const sortLabel =
                {
                    name: lang === 'en' ? 'name' : '名称',
                    status: lang === 'en' ? 'running status' : '运行状态',
                    unread: lang === 'en' ? 'unread count' : '未读优先',
                }[sortKey] || sortKey;
            showDesktopNotice(
                lang === 'en' ? 'Icons sorted' : '图标已排序',
                lang === 'en' ? `Sorted by ${sortLabel}.` : `已按${sortLabel}排序。`,
            );
        },
        [applySequentialIconLayout, desktopItems, lang, showDesktopNotice],
    );

    const handleSetIconSize = useCallback(
        (size) => {
            setDesktopIconSize(size);
            closeContextMenu();
            const sizeLabel =
                {
                    large: lang === 'en' ? 'large' : '大图标',
                    medium: lang === 'en' ? 'medium' : '中等图标',
                    small: lang === 'en' ? 'small' : '小图标',
                }[size] || size;
            showDesktopNotice(
                lang === 'en' ? 'View changed' : '查看方式已更改',
                lang === 'en' ? `Desktop icons are now ${sizeLabel}.` : `桌面图标已切换为${sizeLabel}。`,
            );
        },
        [closeContextMenu, lang, showDesktopNotice],
    );

    const handleToggleAutoArrange = useCallback(() => {
        rememberIconLayout();
        setDesktopAutoArrange((current) => {
            const next = !current;
            if (next) {
                setIconLayout(
                    Object.fromEntries(
                        desktopItems.map((app, index) => [app.id, getDefaultDesktopIconPosition(index)]),
                    ),
                );
            }
            showDesktopNotice(
                lang === 'en' ? 'Auto arrange icons' : '自动排列图标',
                next
                    ? lang === 'en'
                        ? 'Enabled. Icons will stay in order.'
                        : '已开启，图标会保持顺序排列。'
                    : lang === 'en'
                      ? 'Disabled. Icons can be moved manually.'
                      : '已关闭，可以手动摆放图标。',
            );
            return next;
        });
        closeContextMenu();
    }, [closeContextMenu, desktopItems, lang, rememberIconLayout, showDesktopNotice]);

    const handleToggleAlignToGrid = useCallback(() => {
        setDesktopAlignIconsToGrid((current) => {
            const next = !current;
            if (next) {
                rememberIconLayout();
                setIconLayout((currentLayout) =>
                    Object.fromEntries(
                        Object.entries(currentLayout).map(([id, position]) => {
                            const normalized = normalizeDesktopIconPosition(position);
                            return [
                                id,
                                normalized
                                    ? { col: Math.round(normalized.col), row: Math.round(normalized.row) }
                                    : position,
                            ];
                        }),
                    ),
                );
            }
            showDesktopNotice(
                lang === 'en' ? 'Align icons to grid' : '将图标与网格对齐',
                next
                    ? lang === 'en'
                        ? 'Enabled. Dragged icons snap to the grid.'
                        : '已开启，拖动后会吸附到网格。'
                    : lang === 'en'
                      ? 'Disabled. Dragged icons can rest between grid slots.'
                      : '已关闭，拖动后可停在网格之间。',
            );
            return next;
        });
        closeContextMenu();
    }, [closeContextMenu, lang, rememberIconLayout, showDesktopNotice]);

    const handleToggleDesktopIcons = useCallback(() => {
        setDesktopIconsVisible((current) => {
            const next = !current;
            showDesktopNotice(
                lang === 'en' ? 'Desktop icons' : '桌面图标',
                next
                    ? lang === 'en'
                        ? 'Desktop icons are visible.'
                        : '桌面图标已显示。'
                    : lang === 'en'
                      ? 'Desktop icons are hidden. Right-click the wallpaper to show them again.'
                      : '桌面图标已隐藏，右键壁纸可再次显示。',
            );
            return next;
        });
        closeContextMenu();
    }, [closeContextMenu, lang, showDesktopNotice]);

    const updateCreatedDesktopItem = useCallback((itemId, patchOrUpdater) => {
        setCreatedDesktopItems((current) => {
            const nextItems = current
                .map((item) => {
                    if (item.id !== itemId) return item;
                    const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(item) : patchOrUpdater;
                    return normalizeCreatedDesktopItem({
                        ...item,
                        ...(patch || {}),
                        updatedAt: Date.now(),
                    });
                })
                .filter(Boolean);
            saveCreatedDesktopItems(nextItems);
            return nextItems;
        });
    }, []);

    const handleRenameCreatedItem = useCallback(
        (itemId, label) => {
            updateCreatedDesktopItem(itemId, { label });
        },
        [updateCreatedDesktopItem],
    );

    const beginRenameCreatedItem = useCallback(
        (itemId) => {
            const target = createdDesktopItems.find((item) => item.id === itemId);
            if (!target) return false;
            setCreatedItemRenameDraft(target.label);
            setRenamingCreatedItemId(itemId);
            return true;
        },
        [createdDesktopItems],
    );

    const cancelRenameCreatedItem = useCallback(() => {
        setRenamingCreatedItemId(null);
        setCreatedItemRenameDraft('');
    }, []);

    const commitRenameCreatedItem = useCallback(
        (itemId, rawLabel = createdItemRenameDraft) => {
            const target = createdDesktopItems.find((item) => item.id === itemId);
            if (!target) {
                cancelRenameCreatedItem();
                return;
            }
            const label = String(rawLabel || '').trim();
            if (!label) {
                cancelRenameCreatedItem();
                showDesktopNotice(
                    lang === 'en' ? 'Rename cancelled' : '未重命名',
                    lang === 'en' ? 'The name cannot be empty.' : '名称不能为空。',
                );
                return;
            }
            if (label !== target.label) {
                handleRenameCreatedItem(itemId, label);
                showDesktopNotice(lang === 'en' ? 'Renamed' : '已重命名', label);
            }
            setRenamingCreatedItemId(null);
            setCreatedItemRenameDraft('');
        },
        [
            cancelRenameCreatedItem,
            createdDesktopItems,
            createdItemRenameDraft,
            handleRenameCreatedItem,
            lang,
            showDesktopNotice,
        ],
    );

    const handleSaveTextDocument = useCallback(
        (itemId, draft) => {
            const label = String(draft?.label || '').trim() || (lang === 'en' ? 'New text document' : '新建文本文档');
            updateCreatedDesktopItem(itemId, {
                label,
                content: String(draft?.content || ''),
            });
            showDesktopNotice(lang === 'en' ? 'Document saved' : '文档已保存', label);
        },
        [lang, showDesktopNotice, updateCreatedDesktopItem],
    );

    const handleDeleteCreatedItem = useCallback(
        (itemId) => {
            const target = createdDesktopItems.find((item) => item.id === itemId);
            if (!target) return;
            const deletedAt = Date.now();
            const recycleEntry = normalizeRecycleBinItem({
                id: `recycle-${itemId}-${deletedAt}`,
                item: target,
                deletedAt,
                originalLocation: 'Desktop',
                originalPosition: normalizeDesktopIconPosition(iconLayout[itemId]) || appPositions[itemId] || null,
            });
            setCreatedDesktopItems((current) => {
                const nextItems = current.filter((item) => item.id !== itemId);
                saveCreatedDesktopItems(nextItems);
                return nextItems;
            });
            if (recycleEntry) {
                setRecycleBinItems((current) => [recycleEntry, ...current]);
            }
            setIconLayout((currentLayout) => {
                const nextLayout = { ...currentLayout };
                delete nextLayout[itemId];
                return nextLayout;
            });
            setOpenCreatedItemId((current) => (current === itemId ? null : current));
            closeCreatedFolderWindow(itemId);
            setRenamingCreatedItemId((current) => (current === itemId ? null : current));
            setCreatedItemRenameDraft((current) => (renamingCreatedItemId === itemId ? '' : current));
            showDesktopNotice(
                target?.kind === 'folder'
                    ? lang === 'en'
                        ? 'Folder moved to Recycle Bin'
                        : '文件夹已移入回收站'
                    : lang === 'en'
                      ? 'Document moved to Recycle Bin'
                      : '文档已移入回收站',
                target?.label || '',
            );
        },
        [
            appPositions,
            closeCreatedFolderWindow,
            createdDesktopItems,
            iconLayout,
            lang,
            renamingCreatedItemId,
            showDesktopNotice,
        ],
    );

    const handleCreateTextDocumentFromWindow = useCallback(
        (draft = {}) => {
            const id = createDesktopItemId('text');
            const now = Date.now();
            const nextItem = normalizeCreatedDesktopItem({
                id,
                kind: 'text',
                label: String(draft.label || '').trim() || (lang === 'en' ? 'New text document' : '新建文本文档'),
                createdAt: now,
                updatedAt: now,
                content: String(draft.content || ''),
            });
            if (!nextItem) return null;
            rememberIconLayout();
            setCreatedDesktopItems((current) => {
                const nextItems = [...current, nextItem];
                saveCreatedDesktopItems(nextItems);
                return nextItems;
            });
            setOpenCreatedItemId(id);
            showDesktopNotice(lang === 'en' ? 'Text document created' : '已新建文本文档', nextItem.label);
            return id;
        },
        [lang, rememberIconLayout, showDesktopNotice],
    );

    const handleSplitTextDocument = useCallback(
        (itemId, draft = {}) => {
            const id = createDesktopItemId('text');
            const now = Date.now();
            const currentItem = createdDesktopItems.find((item) => item.id === itemId);
            const splitLabel =
                String(draft.label || '').trim() ||
                `${currentItem?.label || (lang === 'en' ? 'Text document' : '文本文档')} - ${lang === 'en' ? 'Split' : '拆分'}`;
            const splitItem = normalizeCreatedDesktopItem({
                id,
                kind: 'text',
                label: splitLabel,
                createdAt: now,
                updatedAt: now,
                content: String(draft.content || ''),
            });
            if (!splitItem) return null;
            rememberIconLayout();
            setCreatedDesktopItems((current) => {
                const nextItems = [
                    ...current
                        .map((item) =>
                            item.id === itemId
                                ? normalizeCreatedDesktopItem({
                                      ...item,
                                      content: String(draft.remainingContent ?? item.content ?? ''),
                                      updatedAt: now,
                                  })
                                : item,
                        )
                        .filter(Boolean),
                    splitItem,
                ];
                saveCreatedDesktopItems(nextItems);
                return nextItems;
            });
            setOpenCreatedItemId(id);
            showDesktopNotice(lang === 'en' ? 'Document split' : '文档已拆分', splitItem.label);
            return id;
        },
        [createdDesktopItems, lang, rememberIconLayout, showDesktopNotice],
    );

    const handleMergeTextDocuments = useCallback(
        (itemId, draft = {}) => {
            const mergeSource = createdDesktopItems
                .filter((item) => item.kind === 'text' && item.id !== itemId)
                .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))[0];
            if (!mergeSource) {
                showDesktopNotice(
                    lang === 'en' ? 'Nothing to merge' : '没有可合并的文档',
                    lang === 'en' ? 'Create or split another text document first.' : '请先新建或拆分另一个文本文档。',
                );
                return null;
            }
            const now = Date.now();
            const currentContent = String(draft.content || '');
            const mergedContent = [
                currentContent.trimEnd(),
                '',
                `--- ${mergeSource.label} ---`,
                '',
                String(mergeSource.content || '').trimStart(),
            ].join('\n');
            const nextLabel =
                String(draft.label || '').trim() || (lang === 'en' ? 'New text document' : '新建文本文档');
            setCreatedDesktopItems((current) => {
                const nextItems = current
                    .filter((item) => item.id !== mergeSource.id)
                    .map((item) =>
                        item.id === itemId
                            ? normalizeCreatedDesktopItem({
                                  ...item,
                                  label: nextLabel,
                                  content: mergedContent,
                                  updatedAt: now,
                              })
                            : item,
                    )
                    .filter(Boolean);
                saveCreatedDesktopItems(nextItems);
                return nextItems;
            });
            setIconLayout((currentLayout) => {
                const nextLayout = { ...currentLayout };
                delete nextLayout[mergeSource.id];
                return nextLayout;
            });
            setOpenCreatedItemId(itemId);
            showDesktopNotice(lang === 'en' ? 'Documents merged' : '文档已合并', mergeSource.label);
            return mergedContent;
        },
        [createdDesktopItems, lang, showDesktopNotice],
    );

    const handleOpenFolderApp = useCallback((app) => {
        app.onOpen?.();
    }, []);

    const handleCreateDesktopItem = useCallback(
        (kind) => {
            if (kind !== 'folder' && kind !== 'text') return;
            const id = createDesktopItemId(kind);
            const now = Date.now();
            const config =
                {
                    folder: {
                        label: lang === 'en' ? 'New folder' : '新建文件夹',
                        kind: 'folder',
                        notice: lang === 'en' ? 'Folder created' : '已新建文件夹',
                    },
                    text: {
                        label: lang === 'en' ? 'New text document' : '新建文本文档',
                        kind: 'text',
                        notice: lang === 'en' ? 'Text document created' : '已新建文本文档',
                    },
                }[kind] || {};
            const nextItem = normalizeCreatedDesktopItem({
                id,
                kind: config.kind,
                label: config.label,
                createdAt: now,
                updatedAt: now,
                folderAppIds: [],
                content: '',
            });
            if (!nextItem) return;
            rememberIconLayout();
            setCreatedDesktopItems((current) => {
                const nextItems = [...current, nextItem];
                saveCreatedDesktopItems(nextItems);
                return nextItems;
            });
            if (kind === 'folder') {
                openCreatedFolderWindow(id);
            } else {
                setOpenCreatedItemId(id);
            }
            closeContextMenu();
            showDesktopNotice(config.notice || (lang === 'en' ? 'Item created' : '已新建项目'), config.label || id);
        },
        [closeContextMenu, lang, openCreatedFolderWindow, rememberIconLayout, showDesktopNotice],
    );

    const handleOpenSettingsFromDesktop = useCallback(
        (event) => {
            apps.find((app) => app.id === 'settings')?.onOpen?.(event);
            closeContextMenu();
        },
        [apps, closeContextMenu],
    );

    const handleOpenDisplaySettings = useCallback(
        (event) => {
            apps.find((app) => app.id === 'settings')?.onOpen?.(event);
            closeContextMenu();
            showDesktopNotice(
                lang === 'en' ? 'Opened ChatPulse settings' : '已打开 ChatPulse 设置',
                lang === 'en' ? 'Display options are handled inside ChatPulse.' : '显示选项由 ChatPulse 内部设置处理。',
            );
        },
        [apps, closeContextMenu, lang, showDesktopNotice],
    );

    const handleOpenPersonalization = useCallback(
        (event) => {
            apps.find((app) => app.id === 'settings')?.onOpen?.(event);
            closeContextMenu();
            showDesktopNotice(
                lang === 'en' ? 'Opened ChatPulse personalization' : '已打开 ChatPulse 个性化',
                lang === 'en'
                    ? 'Wallpaper and desktop style are handled inside ChatPulse.'
                    : '壁纸和桌面样式由 ChatPulse 内部设置处理。',
            );
        },
        [apps, closeContextMenu, lang, showDesktopNotice],
    );

    const handleOpenContextApp = useCallback(
        (event) => {
            const targetApp = desktopItems.find((app) => app.id === contextMenu?.appId);
            targetApp?.onOpen?.(event);
            closeContextMenu();
        },
        [closeContextMenu, contextMenu, desktopItems],
    );

    const getDesktopGridPositionFromPoint = useCallback(
        (point) => {
            const gridElement = gridRef.current;
            const metrics = getDesktopGridMetrics(gridElement);
            const rect = gridElement?.getBoundingClientRect?.();
            const localX = (Number(point?.x) || 0) - (rect?.left || 0);
            const localY = (Number(point?.y) || 0) - (rect?.top || 0);
            return clampDesktopIconPosition(
                {
                    col: (localX - metrics.originX) / metrics.cellX,
                    row: (localY - metrics.originY) / metrics.cellY,
                },
                metrics,
                desktopAlignIconsToGrid,
            );
        },
        [desktopAlignIconsToGrid],
    );

    const getAvailableDesktopPosition = useCallback(
        (preferredPosition, excludedId = '') => {
            const used = new Set(
                Object.entries(appPositions).reduce((keys, [id, position]) => {
                    if (id !== excludedId && position)
                        keys.push(`${Math.round(position.col)}:${Math.round(position.row)}`);
                    return keys;
                }, []),
            );
            const preferred =
                normalizeDesktopIconPosition(preferredPosition) ||
                findOpenDesktopIconPosition(used, desktopItems.length);
            const preferredKey = `${Math.round(preferred.col)}:${Math.round(preferred.row)}`;
            return used.has(preferredKey) ? findOpenDesktopIconPosition(used, desktopItems.length) : preferred;
        },
        [appPositions, desktopItems.length],
    );

    const handleRestoreRecycleBinItem = useCallback(
        (entryId) => {
            const entry = recycleBinItems.find((item) => item.id === entryId);
            const restoredItem = normalizeCreatedDesktopItem(entry?.item);
            if (!entry || !restoredItem) return false;
            const existingIds = new Set(createdDesktopItems.map((item) => item.id));
            const finalItem = existingIds.has(restoredItem.id)
                ? normalizeCreatedDesktopItem({
                      ...restoredItem,
                      id: createDesktopItemId(restoredItem.kind),
                      label: lang === 'en' ? `${restoredItem.label} copy` : `${restoredItem.label} - 副本`,
                  })
                : restoredItem;
            if (!finalItem) return false;
            const position = getAvailableDesktopPosition(entry.originalPosition || undefined, finalItem.id);
            setCreatedDesktopItems((current) => {
                const nextItems = [...current, finalItem];
                saveCreatedDesktopItems(nextItems);
                return nextItems;
            });
            setRecycleBinItems((current) => current.filter((item) => item.id !== entryId));
            setIconLayout((currentLayout) => ({
                ...currentLayout,
                [finalItem.id]: position,
            }));
            showDesktopNotice(lang === 'en' ? 'Restored from Recycle Bin' : '已从回收站还原', finalItem.label);
            return true;
        },
        [createdDesktopItems, getAvailableDesktopPosition, lang, recycleBinItems, showDesktopNotice],
    );

    const handleDeleteRecycleBinItem = useCallback(
        (entryId) => {
            const entry = recycleBinItems.find((item) => item.id === entryId);
            if (!entry) return false;
            const confirmed = window.confirm(
                lang === 'en' ? `Permanently delete "${entry.item.label}"?` : `永久删除「${entry.item.label}」？`,
            );
            if (!confirmed) return false;
            setRecycleBinItems((current) => current.filter((item) => item.id !== entryId));
            showDesktopNotice(lang === 'en' ? 'Permanently deleted' : '已永久删除', entry.item.label);
            return true;
        },
        [lang, recycleBinItems, showDesktopNotice],
    );

    const handleEmptyRecycleBin = useCallback(() => {
        if (!recycleBinItems.length) {
            showDesktopNotice(lang === 'en' ? 'Recycle Bin is empty' : '回收站为空', '');
            return false;
        }
        const confirmed = window.confirm(
            lang === 'en'
                ? `Permanently delete all ${recycleBinItems.length} item${recycleBinItems.length === 1 ? '' : 's'}?`
                : `永久删除回收站中的 ${recycleBinItems.length} 个项目？`,
        );
        if (!confirmed) return false;
        setRecycleBinItems([]);
        showDesktopNotice(lang === 'en' ? 'Recycle Bin emptied' : '已清空回收站', '');
        return true;
    }, [lang, recycleBinItems.length, showDesktopNotice]);

    const moveAppIntoFolder = useCallback(
        (folderId, appId) => {
            const targetApp = appById.get(appId);
            const targetFolder = createdDesktopItems.find((item) => item.id === folderId && item.kind === 'folder');
            if (!targetApp || !targetFolder) return false;

            setCreatedDesktopItems((current) => {
                const nextItems = current
                    .map((item) => {
                        if (item.kind !== 'folder') return item;
                        const withoutApp = (item.folderAppIds || []).filter((id) => id !== appId);
                        const folderAppIds = item.id === folderId ? [...withoutApp, appId] : withoutApp;
                        return normalizeCreatedDesktopItem({
                            ...item,
                            folderAppIds,
                            updatedAt: Date.now(),
                        });
                    })
                    .filter(Boolean);
                saveCreatedDesktopItems(nextItems);
                return nextItems;
            });
            setIconLayout((currentLayout) => {
                const nextLayout = { ...currentLayout };
                delete nextLayout[appId];
                return nextLayout;
            });
            showDesktopNotice(
                lang === 'en' ? 'Moved to folder' : '已移入文件夹',
                `${targetApp.label} -> ${targetFolder.label}`,
            );
            return true;
        },
        [appById, createdDesktopItems, lang, showDesktopNotice],
    );

    const moveAppFromFolderToDesktop = useCallback(
        (folderId, appId, point) => {
            const targetApp = appById.get(appId);
            const targetFolder = createdDesktopItems.find((item) => item.id === folderId && item.kind === 'folder');
            if (!targetApp || !targetFolder) return false;
            const preferredPosition = getDesktopGridPositionFromPoint(point);
            const nextPosition = getAvailableDesktopPosition(preferredPosition, appId);

            setCreatedDesktopItems((current) => {
                const nextItems = current
                    .map((item) => {
                        if (item.id !== folderId || item.kind !== 'folder') return item;
                        return normalizeCreatedDesktopItem({
                            ...item,
                            folderAppIds: (item.folderAppIds || []).filter((id) => id !== appId),
                            updatedAt: Date.now(),
                        });
                    })
                    .filter(Boolean);
                saveCreatedDesktopItems(nextItems);
                return nextItems;
            });
            setIconLayout((currentLayout) => ({
                ...currentLayout,
                [appId]: nextPosition,
            }));
            showDesktopNotice(
                lang === 'en' ? 'Moved to desktop' : '已移回桌面',
                `${targetApp.label} <- ${targetFolder.label}`,
            );
            return true;
        },
        [
            appById,
            createdDesktopItems,
            getAvailableDesktopPosition,
            getDesktopGridPositionFromPoint,
            lang,
            showDesktopNotice,
        ],
    );

    const getFolderDropTargetAtPoint = useCallback(
        (point, draggedId = '') => {
            const x = Number(point?.x);
            const y = Number(point?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

            const openFolderTargets = [...openFolderWindowIds]
                .filter((id) => id !== draggedId && !folderWindowStates[id]?.minimized)
                .sort(
                    (leftId, rightId) =>
                        (folderWindowStates[rightId]?.zIndex || 0) - (folderWindowStates[leftId]?.zIndex || 0),
                );
            for (const folderId of openFolderTargets) {
                const windowElement = document.querySelector(`[data-desktop-folder-window-id="${folderId}"]`);
                const rect = windowElement?.getBoundingClientRect?.();
                if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return folderId;
                }
            }

            const folders = createdDesktopItems.filter((item) => item.kind === 'folder' && item.id !== draggedId);
            for (const folder of folders) {
                const node = document.querySelector(`[data-desktop-app-id="${folder.id}"]`);
                const rect = node?.getBoundingClientRect?.();
                if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return folder.id;
                }
            }
            return null;
        },
        [createdDesktopItems, folderWindowStates, openFolderWindowIds],
    );

    const getRecycleBinDropTargetAtPoint = useCallback(
        (point, draggedId = '') => {
            const x = Number(point?.x);
            const y = Number(point?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            if (!createdDesktopItems.some((item) => item.id === draggedId)) return null;
            const node = document.querySelector(`[data-desktop-app-id="${DESKTOP_RECYCLE_BIN_ID}"]`);
            const rect = node?.getBoundingClientRect?.();
            return rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
                ? DESKTOP_RECYCLE_BIN_ID
                : null;
        },
        [createdDesktopItems],
    );

    const getCreatedItemCopyLabel = useCallback(
        (label) => {
            const baseLabel = String(label || '').trim() || (lang === 'en' ? 'New item' : '新建项目');
            return lang === 'en' ? `${baseLabel} copy` : `${baseLabel} - 副本`;
        },
        [lang],
    );

    const handleCutContextCreatedItem = useCallback(() => {
        const itemId = contextMenu?.appId;
        const target = createdDesktopItems.find((item) => item.id === itemId);
        if (!target) {
            closeContextMenu();
            return;
        }
        setDesktopClipboard({ mode: 'cut', itemId });
        closeContextMenu();
        showDesktopNotice(
            lang === 'en' ? 'Cut' : '已剪切',
            lang === 'en' ? 'Right-click the desktop and choose Paste to move it.' : '右键桌面选择“粘贴”即可移动。',
        );
    }, [closeContextMenu, contextMenu, createdDesktopItems, lang, showDesktopNotice]);

    const handleCopyContextCreatedItem = useCallback(() => {
        const itemId = contextMenu?.appId;
        const target = createdDesktopItems.find((item) => item.id === itemId);
        if (!target) {
            closeContextMenu();
            return;
        }
        setDesktopClipboard({ mode: 'copy', itemId, item: target });
        closeContextMenu();
        showDesktopNotice(
            lang === 'en' ? 'Copied' : '已复制',
            lang === 'en'
                ? 'Right-click the desktop and choose Paste to create a copy.'
                : '右键桌面选择“粘贴”即可创建副本。',
        );
    }, [closeContextMenu, contextMenu, createdDesktopItems, lang, showDesktopNotice]);

    const handleRenameContextCreatedItem = useCallback(() => {
        const itemId = contextMenu?.appId;
        if (!itemId || !beginRenameCreatedItem(itemId)) {
            closeContextMenu();
            return;
        }
        closeContextMenu();
    }, [beginRenameCreatedItem, closeContextMenu, contextMenu]);

    const handleDeleteContextCreatedItem = useCallback(() => {
        const itemId = contextMenu?.appId;
        const target = createdDesktopItems.find((item) => item.id === itemId);
        if (!target) {
            closeContextMenu();
            return;
        }

        const confirmed = window.confirm(
            target.kind === 'folder'
                ? lang === 'en'
                    ? `Delete folder "${target.label}"?`
                    : `删除文件夹「${target.label}」？`
                : lang === 'en'
                  ? `Delete document "${target.label}"?`
                  : `删除文档「${target.label}」？`,
        );
        closeContextMenu();
        if (!confirmed) return;
        handleDeleteCreatedItem(itemId);
    }, [closeContextMenu, contextMenu, createdDesktopItems, handleDeleteCreatedItem, lang]);

    const handlePasteDesktopClipboard = useCallback(() => {
        if (!desktopClipboard) {
            closeContextMenu();
            return;
        }

        const preferredPosition = getDesktopGridPositionFromPoint(contextMenu);

        if (desktopClipboard.mode === 'cut') {
            const target = createdDesktopItems.find((item) => item.id === desktopClipboard.itemId);
            if (!target) {
                setDesktopClipboard(null);
                closeContextMenu();
                showDesktopNotice(
                    lang === 'en' ? 'Nothing to paste' : '没有可粘贴的项目',
                    lang === 'en' ? 'The original item no longer exists.' : '原项目已经不存在。',
                );
                return;
            }

            const position = getAvailableDesktopPosition(preferredPosition, desktopClipboard.itemId);
            setIconLayout((currentLayout) => ({
                ...currentLayout,
                [desktopClipboard.itemId]: position,
            }));
            setDesktopClipboard(null);
            closeContextMenu();
            showDesktopNotice(lang === 'en' ? 'Moved' : '已移动', target.label);
            return;
        }

        const source = createdDesktopItems.find((item) => item.id === desktopClipboard.itemId) || desktopClipboard.item;
        if (!source) {
            setDesktopClipboard(null);
            closeContextMenu();
            return;
        }

        const id = createDesktopItemId(source.kind);
        const now = Date.now();
        const copyItem = normalizeCreatedDesktopItem({
            ...source,
            id,
            label: getCreatedItemCopyLabel(source.label),
            createdAt: now,
            updatedAt: now,
        });
        const position = getAvailableDesktopPosition(preferredPosition, id);

        setCreatedDesktopItems((current) => {
            const nextItems = [...current, copyItem].filter(Boolean);
            saveCreatedDesktopItems(nextItems);
            return nextItems;
        });
        setIconLayout((currentLayout) => ({
            ...currentLayout,
            [id]: position,
        }));
        closeContextMenu();
        showDesktopNotice(lang === 'en' ? 'Pasted copy' : '已粘贴副本', copyItem.label);
    }, [
        closeContextMenu,
        contextMenu,
        createdDesktopItems,
        desktopClipboard,
        getAvailableDesktopPosition,
        getCreatedItemCopyLabel,
        getDesktopGridPositionFromPoint,
        lang,
        showDesktopNotice,
    ]);

    const handleResetContextAppPosition = useCallback(() => {
        const appId = contextMenu?.appId;
        if (!appId) return;
        rememberIconLayout();
        setIconLayout((currentLayout) => {
            const nextLayout = { ...currentLayout };
            delete nextLayout[appId];
            return nextLayout;
        });
        closeContextMenu();
        showDesktopNotice(
            lang === 'en' ? 'Icon position reset' : '图标位置已重置',
            lang === 'en' ? 'The selected icon returned to its default grid slot.' : '所选图标已回到默认网格位置。',
        );
    }, [closeContextMenu, contextMenu, lang, rememberIconLayout, showDesktopNotice]);

    const handleAppClick = useCallback((event, app) => {
        if (suppressClickRef.current === app.id) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = null;
            return;
        }
        app.onOpen?.(event);
    }, []);

    const handleAppPointerDown = useCallback(
        (event, app) => {
            if (event.button === 2) {
                event.preventDefault();
                event.stopPropagation();
                setContextMenu({
                    type: 'app',
                    appId: app.id,
                    ...getContextMenuPoint(event),
                });
                return;
            }
            if (event.button !== undefined && event.button !== 0) return;
            if (desktopAutoArrange) return;
            if (settleFrameRef.current) {
                window.cancelAnimationFrame(settleFrameRef.current);
                settleFrameRef.current = null;
            }
            if (settleTimerRef.current) {
                window.clearTimeout(settleTimerRef.current);
                settleTimerRef.current = null;
            }
            setDraggingIcon(null);
            setFolderDropTargetId(null);
            const position =
                appPositions[app.id] ||
                getDefaultDesktopIconPosition(desktopItems.findIndex((item) => item.id === app.id));
            dragRef.current = {
                id: app.id,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                dx: 0,
                dy: 0,
                moved: false,
                position,
                positions: appPositions,
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        [appPositions, desktopAutoArrange, desktopItems, getContextMenuPoint],
    );

    const handleAppPointerMove = useCallback(
        (event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            const moved = drag.moved || Math.hypot(dx, dy) > 5;
            drag.dx = dx;
            drag.dy = dy;
            drag.moved = moved;

            if (moved) {
                event.preventDefault();
                setDraggingIcon({ id: drag.id, dx, dy });
                const point = { x: event.clientX, y: event.clientY };
                const nextTargetId = appById.has(drag.id)
                    ? getFolderDropTargetAtPoint(point, drag.id)
                    : getRecycleBinDropTargetAtPoint(point, drag.id);
                setFolderDropTargetId((current) => (current === nextTargetId ? current : nextTargetId));
            }
        },
        [appById, getFolderDropTargetAtPoint, getRecycleBinDropTargetAtPoint],
    );

    const finishDrag = useCallback(
        (event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
            dragRef.current = null;

            if (!drag.moved) {
                setDraggingIcon(null);
                setFolderDropTargetId(null);
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (event.type !== 'pointercancel' && appById.has(drag.id)) {
                const targetFolderId = getFolderDropTargetAtPoint({ x: event.clientX, y: event.clientY }, drag.id);
                if (targetFolderId && moveAppIntoFolder(targetFolderId, drag.id)) {
                    setDraggingIcon(null);
                    setFolderDropTargetId(null);
                    suppressClickRef.current = drag.id;
                    window.setTimeout(() => {
                        if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
                    }, 0);
                    return;
                }
            }

            if (
                event.type !== 'pointercancel' &&
                getRecycleBinDropTargetAtPoint({ x: event.clientX, y: event.clientY }, drag.id)
            ) {
                handleDeleteCreatedItem(drag.id);
                setDraggingIcon(null);
                setFolderDropTargetId(null);
                suppressClickRef.current = drag.id;
                window.setTimeout(() => {
                    if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
                }, 0);
                return;
            }

            setFolderDropTargetId(null);
            const metrics = getDesktopGridMetrics(gridRef.current);
            const nextPosition = clampDesktopIconPosition(
                {
                    col: drag.position.col + drag.dx / metrics.cellX,
                    row: drag.position.row + drag.dy / metrics.cellY,
                },
                metrics,
                desktopAlignIconsToGrid,
            );
            const settlingOffset = {
                dx: drag.dx - (nextPosition.col - drag.position.col) * metrics.cellX,
                dy: drag.dy - (nextPosition.row - drag.position.row) * metrics.cellY,
            };

            setIconLayout((currentLayout) => {
                const nextLayout = { ...currentLayout };
                const targetKey = `${nextPosition.col}:${nextPosition.row}`;
                const occupant = desktopItems.find((app) => {
                    if (app.id === drag.id) return false;
                    const position = drag.positions[app.id] || normalizeDesktopIconPosition(currentLayout[app.id]);
                    return position && `${position.col}:${position.row}` === targetKey;
                });

                nextLayout[drag.id] = nextPosition;
                if (occupant) {
                    nextLayout[occupant.id] = drag.position;
                }
                return nextLayout;
            });
            setDraggingIcon({
                id: drag.id,
                dx: settlingOffset.dx,
                dy: settlingOffset.dy,
                settling: 'hold',
            });

            if (settleFrameRef.current) window.cancelAnimationFrame(settleFrameRef.current);
            if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
            settleFrameRef.current = window.requestAnimationFrame(() => {
                settleFrameRef.current = null;
                setDraggingIcon((current) =>
                    current?.id === drag.id && current.settling
                        ? { ...current, dx: 0, dy: 0, settling: 'animate' }
                        : current,
                );
                settleTimerRef.current = window.setTimeout(() => {
                    settleTimerRef.current = null;
                    setDraggingIcon((current) => (current?.id === drag.id && current.settling ? null : current));
                }, 190);
            });

            suppressClickRef.current = drag.id;
            window.setTimeout(() => {
                if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
            }, 0);
        },
        [
            appById,
            desktopAlignIconsToGrid,
            desktopItems,
            getFolderDropTargetAtPoint,
            getRecycleBinDropTargetAtPoint,
            handleDeleteCreatedItem,
            moveAppIntoFolder,
        ],
    );

    const contextMenuApp =
        contextMenu?.type === 'app' ? desktopItems.find((app) => app.id === contextMenu.appId) : null;
    const contextMenuRecycleBin = contextMenuApp?.id === DESKTOP_RECYCLE_BIN_ID;
    const contextMenuCreatedItem =
        contextMenuApp?.kind === 'folder' || contextMenuApp?.kind === 'text' ? contextMenuApp : null;
    const ContextMenuCreatedIcon = contextMenuCreatedItem?.kind === 'folder' ? Folder : FileText;
    const ContextMenuAppIcon = contextMenuApp?.icon || MessageSquare;

    return (
        <main
            ref={desktopHomeRef}
            className={`desktop-home desktop-home--${normalizedWallpaper} ${showWallpaper ? '' : 'desktop-home--wallpaper-hidden'}`}
            aria-label={lang === 'en' ? 'ChatPulse desktop' : 'ChatPulse 桌面'}
            onContextMenu={openDesktopContextMenu}
        >
            {showWallpaper && wallpaperImageSrc && (
                <Live2DDesktopWallpaper src={wallpaperImageSrc} animated={wallpaperAnimated} />
            )}

            {desktopIconsVisible && (
                <section
                    ref={gridRef}
                    className={[
                        'desktop-icon-grid',
                        `desktop-icon-grid--${desktopIconSize}`,
                        desktopRefreshPulse ? 'is-refreshing' : '',
                        desktopRefreshPulse === 1 ? 'desktop-icon-grid--refresh-odd' : '',
                        desktopRefreshPulse === 2 ? 'desktop-icon-grid--refresh-even' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    aria-label={lang === 'en' ? 'Desktop apps' : '桌面 App'}
                >
                    {desktopItems.map((app, index) => {
                        const position = appPositions[app.id] || getDefaultDesktopIconPosition(0);
                        const drag = draggingIcon?.id === app.id ? draggingIcon : null;
                        return (
                            <DesktopAppButton
                                key={app.id}
                                app={app}
                                isDragging={Boolean(drag && !drag.settling)}
                                isSettling={Boolean(drag?.settling)}
                                settlingPhase={drag?.settling || ''}
                                isRenaming={renamingCreatedItemId === app.id}
                                isFolderDropTarget={folderDropTargetId === app.id}
                                renameValue={renamingCreatedItemId === app.id ? createdItemRenameDraft : ''}
                                onRenameChange={setCreatedItemRenameDraft}
                                onRenameCommit={(label) => commitRenameCreatedItem(app.id, label)}
                                onRenameCancel={cancelRenameCreatedItem}
                                style={{
                                    '--desktop-col': position.col,
                                    '--desktop-row': position.row,
                                    '--desktop-drag-x': drag ? `${drag.dx}px` : '0px',
                                    '--desktop-drag-y': drag ? `${drag.dy}px` : '0px',
                                    '--desktop-icon-delay': `${index * 28}ms`,
                                }}
                                onOpen={(event) => handleAppClick(event, app)}
                                onPointerDown={(event) => handleAppPointerDown(event, app)}
                                onPointerMove={handleAppPointerMove}
                                onPointerUp={finishDrag}
                                onPointerCancel={finishDrag}
                                onContextMenu={(event) => openAppContextMenu(event, app)}
                            />
                        );
                    })}
                </section>
            )}

            {contextMenu && (
                <DesktopContextMenu
                    contextMenu={contextMenu}
                    contextMenuCreatedItem={contextMenuCreatedItem}
                    contextMenuRecycleBin={contextMenuRecycleBin}
                    openRecycleBinWindow={openRecycleBinWindow}
                    closeContextMenu={closeContextMenu}
                    lang={lang}
                    handleEmptyRecycleBin={handleEmptyRecycleBin}
                    handleResetContextAppPosition={handleResetContextAppPosition}
                    handleCutContextCreatedItem={handleCutContextCreatedItem}
                    handleCopyContextCreatedItem={handleCopyContextCreatedItem}
                    handleRenameContextCreatedItem={handleRenameContextCreatedItem}
                    handleDeleteContextCreatedItem={handleDeleteContextCreatedItem}
                    handleOpenContextApp={handleOpenContextApp}
                    ContextMenuCreatedIcon={ContextMenuCreatedIcon}
                    ContextMenuAppIcon={ContextMenuAppIcon}
                    handleCaptureDesktopScreenshot={handleCaptureDesktopScreenshot}
                    handleOpenSettingsFromDesktop={handleOpenSettingsFromDesktop}
                    setContextMenu={setContextMenu}
                    desktopIconSize={desktopIconSize}
                    handleSetIconSize={handleSetIconSize}
                    desktopAutoArrange={desktopAutoArrange}
                    handleToggleAutoArrange={handleToggleAutoArrange}
                    desktopAlignIconsToGrid={desktopAlignIconsToGrid}
                    handleToggleAlignToGrid={handleToggleAlignToGrid}
                    desktopIconsVisible={desktopIconsVisible}
                    handleToggleDesktopIcons={handleToggleDesktopIcons}
                    desktopSortKey={desktopSortKey}
                    handleSortIcons={handleSortIcons}
                    handleRefreshDesktop={handleRefreshDesktop}
                    desktopClipboard={desktopClipboard}
                    handlePasteDesktopClipboard={handlePasteDesktopClipboard}
                    handleUndoIconLayout={handleUndoIconLayout}
                    handleCreateDesktopItem={handleCreateDesktopItem}
                    handleOpenDisplaySettings={handleOpenDisplaySettings}
                    handleOpenPersonalization={handleOpenPersonalization}
                    handleArrangeIcons={handleArrangeIcons}
                />
            )}

            {openFolderWindowIds.map((folderId, index) => {
                const folderItem = createdDesktopItems.find((item) => item.id === folderId && item.kind === 'folder');
                if (!folderItem) return null;
                const windowState = folderWindowStates[folderId] || {
                    geometry: getDefaultFolderWindowGeometry(index),
                    minimized: false,
                    maximized: false,
                    zIndex: 82 + index,
                };
                return (
                    <DesktopFolderWindow
                        key={folderId}
                        item={folderItem}
                        apps={apps}
                        lang={lang}
                        active={activeFolderWindowId === folderId}
                        geometry={windowState.geometry}
                        maximized={Boolean(windowState.maximized)}
                        minimized={Boolean(windowState.minimized)}
                        minimizedIndex={index}
                        zIndex={windowState.zIndex || 82}
                        onActivate={() => bringFolderWindowToFront(folderId)}
                        onClose={() => closeCreatedFolderWindow(folderId)}
                        onGeometryChange={(geometry) => setFolderWindowGeometry(folderId, geometry)}
                        onMaximizeToggle={() => toggleFolderWindowMaximized(folderId)}
                        onMinimize={() => minimizeFolderWindow(folderId)}
                        onRestore={() => restoreFolderWindow(folderId)}
                        onMoveAppToDesktop={(appId, point) => moveAppFromFolderToDesktop(folderId, appId, point)}
                        onAddAppToFolder={(appId) => moveAppIntoFolder(folderId, appId)}
                        onOpenApp={handleOpenFolderApp}
                        isDropTarget={folderDropTargetId === folderId}
                    />
                );
            })}

            {recycleBinWindowOpen && (
                <DesktopRecycleBinWindow
                    entries={recycleBinItems}
                    lang={lang}
                    active={activeFolderWindowId === DESKTOP_RECYCLE_BIN_ID}
                    geometry={recycleBinWindowState.geometry}
                    maximized={Boolean(recycleBinWindowState.maximized)}
                    minimized={Boolean(recycleBinWindowState.minimized)}
                    zIndex={recycleBinWindowState.zIndex || 84}
                    onActivate={bringRecycleBinWindowToFront}
                    onClose={closeRecycleBinWindow}
                    onGeometryChange={(geometry) =>
                        setRecycleBinWindowState((current) => ({
                            ...current,
                            geometry: clampFolderWindowGeometry(geometry),
                        }))
                    }
                    onMaximizeToggle={() => {
                        const nextZIndex = allocateFolderWindowZIndex();
                        setActiveFolderWindowId(DESKTOP_RECYCLE_BIN_ID);
                        setRecycleBinWindowState((current) => ({
                            ...current,
                            maximized: !current.maximized,
                            minimized: false,
                            zIndex: nextZIndex,
                        }));
                    }}
                    onMinimize={() => {
                        setRecycleBinWindowState((current) => ({ ...current, minimized: true }));
                        setActiveFolderWindowId((current) => (current === DESKTOP_RECYCLE_BIN_ID ? null : current));
                    }}
                    onRestore={bringRecycleBinWindowToFront}
                    onRestoreEntry={handleRestoreRecycleBinItem}
                    onDeleteEntry={handleDeleteRecycleBinItem}
                    onEmptyRecycleBin={handleEmptyRecycleBin}
                />
            )}

            {albumWindowOpen && (
                <DesktopAlbumWindow
                    photos={albumPhotos}
                    selectedPhotoId={selectedAlbumPhotoId}
                    lang={lang}
                    active={activeFolderWindowId === DESKTOP_ALBUM_APP_ID}
                    geometry={albumWindowState.geometry}
                    maximized={Boolean(albumWindowState.maximized)}
                    minimized={Boolean(albumWindowState.minimized)}
                    zIndex={albumWindowState.zIndex || 86}
                    onActivate={bringAlbumWindowToFront}
                    onClose={closeAlbumWindow}
                    onGeometryChange={setAlbumWindowGeometry}
                    onMaximizeToggle={toggleAlbumWindowMaximized}
                    onMinimize={minimizeAlbumWindow}
                    onRestore={bringAlbumWindowToFront}
                    onSelectPhoto={setSelectedAlbumPhotoId}
                    onCapture={handleCaptureDesktopScreenshot}
                    onDeletePhoto={handleDeleteAlbumPhoto}
                    onClearPhotos={handleClearAlbumPhotos}
                />
            )}

            {openCreatedItem?.kind === 'text' && (
                <DesktopTextDocumentWindow
                    item={openCreatedItem}
                    lang={lang}
                    mergeCandidateCount={
                        createdDesktopItems.filter((item) => item.kind === 'text' && item.id !== openCreatedItem.id)
                            .length
                    }
                    onClose={() => setOpenCreatedItemId(null)}
                    onSave={(draft) => handleSaveTextDocument(openCreatedItem.id, draft)}
                    onDelete={() => handleDeleteCreatedItem(openCreatedItem.id)}
                    onCreateNew={() => handleCreateTextDocumentFromWindow()}
                    onSplitDocument={(draft) => handleSplitTextDocument(openCreatedItem.id, draft)}
                    onMergeDocuments={(draft) => handleMergeTextDocuments(openCreatedItem.id, draft)}
                />
            )}
        </main>
    );
}

export default ChatPulseDesktop;
