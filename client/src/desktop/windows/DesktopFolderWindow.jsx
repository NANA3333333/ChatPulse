import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
    Home,
    PanelTopOpen,
    Cloud,
    MonitorCog,
    Download,
    FileText,
    Music2,
    Volume2,
    Folder,
    Maximize2,
    X,
    Plus,
    Minus,
    Minimize2,
    Square,
    ArrowLeft,
    ArrowRight,
    ChevronUp,
    RefreshCw,
    Search,
    CirclePlus,
    FolderPlus,
    Scissors,
    Copy,
    ClipboardPaste,
    Pencil,
    Share2,
    Trash2,
    ArrowDownUp,
    LayoutGrid,
    List,
    MoreHorizontal,
} from 'lucide-react';
import {
    clampFolderWindowGeometry,
    getDefaultFolderWindowGeometry,
    resizeFolderWindowGeometry,
} from '../windowGeometry.js';
import { DesktopFolderAppTile } from '../DesktopAppButton';

export function DesktopFolderWindow({
    item,
    apps,
    lang,
    active = false,
    geometry,
    maximized = false,
    minimized = false,
    minimizedIndex = 0,
    zIndex = 82,
    onActivate,
    onClose,
    onGeometryChange,
    onMaximizeToggle,
    onMinimize,
    onRestore,
    onMoveAppToDesktop,
    onAddAppToFolder,
    onOpenApp,
    isDropTarget = false,
}) {
    const windowRef = useRef(null);
    const moveRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortAscending, setSortAscending] = useState(true);
    const [viewMode, setViewMode] = useState('details');
    const [activeLocation, setActiveLocation] = useState('folder');
    const [locationHistory, setLocationHistory] = useState(['folder']);
    const [locationHistoryIndex, setLocationHistoryIndex] = useState(0);
    const [selectedAppId, setSelectedAppId] = useState('');
    const [activityMessage, setActivityMessage] = useState('');
    const [openMenu, setOpenMenu] = useState('');
    const [folderClipboard, setFolderClipboard] = useState(null);
    const [detailsPaneOpen, setDetailsPaneOpen] = useState(false);
    const folderAppIds = useMemo(() => new Set(item.folderAppIds || []), [item.folderAppIds]);
    const storedApps = useMemo(() => apps.filter((app) => folderAppIds.has(app.id)), [apps, folderAppIds]);
    const availableApps = useMemo(() => apps.filter((app) => !folderAppIds.has(app.id)), [apps, folderAppIds]);
    const navigationItems = useMemo(
        () => [
            { id: 'folder', label: lang === 'en' ? 'Home folder' : '主文件夹', icon: Home, count: storedApps.length },
            { id: 'gallery', label: lang === 'en' ? 'Gallery' : '图库', icon: PanelTopOpen },
            { id: 'cloud', label: lang === 'en' ? 'NA - Personal' : 'NA - 个人', icon: Cloud },
            { id: 'divider-a', divider: true },
            { id: 'desktop', label: lang === 'en' ? 'Desktop' : '桌面', icon: MonitorCog },
            { id: 'downloads', label: lang === 'en' ? 'Downloads' : '下载', icon: Download },
            { id: 'documents', label: lang === 'en' ? 'Documents' : '文档', icon: FileText },
            { id: 'pictures', label: lang === 'en' ? 'Pictures' : '图片', icon: PanelTopOpen },
            { id: 'music', label: lang === 'en' ? 'Music' : '音乐', icon: Music2 },
            { id: 'videos', label: lang === 'en' ? 'Videos' : '视频', icon: Volume2 },
            { id: 'divider-b', divider: true },
            { id: 'this-pc', label: lang === 'en' ? 'This PC' : '此电脑', icon: Home },
        ],
        [lang, storedApps.length],
    );
    const activeNavItem = navigationItems.find((navItem) => navItem.id === activeLocation) || navigationItems[0];
    const modifiedLabel = useMemo(() => {
        const value = Number(item.updatedAt || item.createdAt || Date.now());
        return new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }, [item.createdAt, item.updatedAt, lang]);
    const filteredApps = useMemo(() => {
        const currentLocationApps = activeLocation === 'folder' ? storedApps : [];
        const query = searchQuery.trim().toLocaleLowerCase();
        return currentLocationApps
            .filter((app) =>
                String(app.label || '')
                    .toLocaleLowerCase()
                    .includes(query),
            )
            .sort((a, b) =>
                sortAscending
                    ? String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'zh-Hans-CN')
                    : String(b.label).localeCompare(String(a.label), lang === 'en' ? 'en' : 'zh-Hans-CN'),
            );
    }, [activeLocation, storedApps, lang, searchQuery, sortAscending]);
    const selectedApp =
        filteredApps.find((app) => app.id === selectedAppId) ||
        storedApps.find((app) => app.id === selectedAppId) ||
        null;
    const canGoBack = locationHistoryIndex > 0;
    const canGoForward = locationHistoryIndex < locationHistory.length - 1;
    const baseStatusText =
        lang === 'en'
            ? `${filteredApps.length} item${filteredApps.length === 1 ? '' : 's'}`
            : `${filteredApps.length} 个项目`;
    const statusText = activityMessage || baseStatusText;

    useEffect(() => {
        if (selectedAppId && !filteredApps.some((app) => app.id === selectedAppId)) {
            setSelectedAppId('');
        }
    }, [filteredApps, selectedAppId]);

    const pushLocation = useCallback(
        (locationId) => {
            const target = navigationItems.find((navItem) => navItem.id === locationId && !navItem.divider);
            if (!target) return;
            setActiveLocation(locationId);
            setSearchQuery('');
            setSelectedAppId('');
            setOpenMenu('');
            setActivityMessage(target.label);
            setLocationHistory((current) => {
                const next = current.slice(0, locationHistoryIndex + 1);
                if (next[next.length - 1] !== locationId) next.push(locationId);
                return next;
            });
            setLocationHistoryIndex((current) => {
                const next = locationHistory.slice(0, current + 1);
                return next[next.length - 1] === locationId ? current : current + 1;
            });
        },
        [locationHistory, locationHistoryIndex, navigationItems],
    );

    const goToHistory = useCallback(
        (direction) => {
            const nextIndex = locationHistoryIndex + direction;
            if (nextIndex < 0 || nextIndex >= locationHistory.length) {
                setActivityMessage(lang === 'en' ? 'No more folder history' : '没有更多文件夹历史记录');
                return;
            }
            const nextLocation = locationHistory[nextIndex] || 'folder';
            setLocationHistoryIndex(nextIndex);
            setActiveLocation(nextLocation);
            setSearchQuery('');
            setSelectedAppId('');
            setOpenMenu('');
            const navItem = navigationItems.find((item) => item.id === nextLocation);
            setActivityMessage(navItem?.label || '');
        },
        [lang, locationHistory, locationHistoryIndex, navigationItems],
    );

    const getWindowDropPoint = useCallback(() => {
        const rect = windowRef.current?.getBoundingClientRect?.();
        if (rect) {
            return {
                x: Math.min(rect.right + 28, window.innerWidth - 40),
                y: Math.min(rect.top + 112, window.innerHeight - 80),
            };
        }
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }, []);

    const copyFolderTextToClipboard = useCallback(
        async (text) => {
            const value = String(text || '');
            try {
                await navigator.clipboard.writeText(value);
                return true;
            } catch {
                window.prompt(lang === 'en' ? 'Copy text:' : '复制文本：', value);
                return false;
            }
        },
        [lang],
    );

    const requireSelectedApp = useCallback(() => {
        if (selectedApp) return selectedApp;
        setActivityMessage(lang === 'en' ? 'Select an item first' : '请先选择一个项目');
        return null;
    }, [lang, selectedApp]);

    const handleAddAppToFolder = useCallback(
        (appId) => {
            const targetApp = apps.find((app) => app.id === appId);
            if (!targetApp) return;
            const added = onAddAppToFolder?.(appId);
            setActiveLocation('folder');
            setSelectedAppId(appId);
            setOpenMenu('');
            setActivityMessage(
                added === false
                    ? lang === 'en'
                        ? 'Could not add item'
                        : '无法添加项目'
                    : `${lang === 'en' ? 'Added' : '已添加'} ${targetApp.label}`,
            );
        },
        [apps, lang, onAddAppToFolder],
    );

    const handleOpenSelected = useCallback(() => {
        const target = requireSelectedApp();
        if (!target) return;
        setOpenMenu('');
        onOpenApp?.(target);
    }, [onOpenApp, requireSelectedApp]);

    const handleCutSelected = useCallback(() => {
        const target = requireSelectedApp();
        if (!target) return;
        setFolderClipboard({ mode: 'cut', appId: target.id });
        setActivityMessage(`${lang === 'en' ? 'Cut' : '已剪切'} ${target.label}`);
    }, [lang, requireSelectedApp]);

    const handleCopySelected = useCallback(async () => {
        const target = requireSelectedApp();
        if (!target) return;
        setFolderClipboard({ mode: 'copy', appId: target.id });
        await copyFolderTextToClipboard(`ChatPulse\\Desktop\\${item.label}\\${target.label}`);
        setActivityMessage(`${lang === 'en' ? 'Copied' : '已复制'} ${target.label}`);
    }, [copyFolderTextToClipboard, item.label, lang, requireSelectedApp]);

    const handlePaste = useCallback(() => {
        if (!folderClipboard?.appId) {
            setActivityMessage(lang === 'en' ? 'Nothing to paste' : '没有可粘贴的项目');
            return;
        }
        if (folderAppIds.has(folderClipboard.appId)) {
            setActivityMessage(lang === 'en' ? 'Item is already in this folder' : '项目已在此文件夹中');
            return;
        }
        handleAddAppToFolder(folderClipboard.appId);
    }, [folderAppIds, folderClipboard, handleAddAppToFolder, lang]);

    const handleRenameSelected = useCallback(() => {
        const target = requireSelectedApp();
        if (!target) return;
        setActivityMessage(
            lang === 'en' ? 'System app shortcuts keep their original names' : '系统应用快捷方式会保留原名称',
        );
    }, [lang, requireSelectedApp]);

    const handleShareSelected = useCallback(async () => {
        const target = requireSelectedApp();
        if (!target) return;
        await copyFolderTextToClipboard(`${item.label}: ${target.label}`);
        setActivityMessage(lang === 'en' ? 'Share text copied' : '共享文本已复制');
    }, [copyFolderTextToClipboard, item.label, lang, requireSelectedApp]);

    const handleRemoveSelected = useCallback(() => {
        const target = requireSelectedApp();
        if (!target) return;
        onMoveAppToDesktop?.(target.id, getWindowDropPoint());
        setSelectedAppId('');
        setActivityMessage(`${lang === 'en' ? 'Moved to desktop' : '已移回桌面'} ${target.label}`);
    }, [getWindowDropPoint, lang, onMoveAppToDesktop, requireSelectedApp]);

    const handleRefreshFolder = useCallback(() => {
        setSearchQuery('');
        setOpenMenu('');
        setActivityMessage(lang === 'en' ? 'Folder refreshed' : '文件夹已刷新');
    }, [lang]);

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
        setOpenMenu('');
        setActivityMessage(lang === 'en' ? 'Search cleared' : '搜索已清除');
    }, [lang]);

    const safeGeometry = clampFolderWindowGeometry(geometry || getDefaultFolderWindowGeometry());

    const startWindowMove = useCallback(
        (event) => {
            if (event.button !== undefined && event.button !== 0) return;
            if (
                maximized ||
                event.target.closest(
                    'button, input, textarea, select, [data-window-no-drag="true"], .desktop-folder-window__menu',
                )
            )
                return;
            event.preventDefault();
            onActivate?.();
            moveRef.current = {
                type: 'move',
                startX: event.clientX,
                startY: event.clientY,
                startGeometry: clampFolderWindowGeometry(geometry || safeGeometry),
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        [geometry, maximized, onActivate, safeGeometry],
    );

    const startWindowResize = useCallback(
        (event, direction = 'se') => {
            if (event.button !== undefined && event.button !== 0) return;
            if (maximized) return;
            event.preventDefault();
            event.stopPropagation();
            onActivate?.();
            moveRef.current = {
                type: 'resize',
                direction,
                startX: event.clientX,
                startY: event.clientY,
                startGeometry: clampFolderWindowGeometry(geometry || safeGeometry),
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        [geometry, maximized, onActivate, safeGeometry],
    );

    const handleWindowPointerMove = useCallback(
        (event) => {
            const move = moveRef.current;
            if (!move) return;
            event.preventDefault();
            const deltaX = event.clientX - move.startX;
            const deltaY = event.clientY - move.startY;
            const nextGeometry =
                move.type === 'resize'
                    ? resizeFolderWindowGeometry(move.startGeometry, deltaX, deltaY, move.direction)
                    : clampFolderWindowGeometry({
                          ...move.startGeometry,
                          x: move.startGeometry.x + deltaX,
                          y: move.startGeometry.y + deltaY,
                      });
            onGeometryChange?.(nextGeometry);
        },
        [onGeometryChange],
    );

    const stopWindowInteraction = useCallback((event) => {
        if (!moveRef.current) return;
        moveRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }, []);

    useEffect(() => {
        const stopGlobalInteraction = () => {
            moveRef.current = null;
        };
        window.addEventListener('pointermove', handleWindowPointerMove);
        window.addEventListener('pointerup', stopGlobalInteraction);
        window.addEventListener('pointercancel', stopGlobalInteraction);
        return () => {
            window.removeEventListener('pointermove', handleWindowPointerMove);
            window.removeEventListener('pointerup', stopGlobalInteraction);
            window.removeEventListener('pointercancel', stopGlobalInteraction);
        };
    }, [handleWindowPointerMove]);

    const windowStyle = maximized
        ? { zIndex }
        : {
              left: `${safeGeometry.x}px`,
              top: `${safeGeometry.y}px`,
              width: `${safeGeometry.width}px`,
              height: `${safeGeometry.height}px`,
              zIndex,
          };

    if (minimized) {
        return (
            <button
                type="button"
                className={`desktop-folder-window-minimized ${active ? 'is-active' : ''}`}
                style={{
                    left: `${18 + minimizedIndex * 14}px`,
                    zIndex,
                }}
                onClick={() => {
                    onRestore?.();
                    onActivate?.();
                }}
                aria-label={lang === 'en' ? `Restore ${item.label}` : `还原 ${item.label}`}
            >
                <Folder size={18} />
                <span>{item.label}</span>
                <Maximize2 size={15} />
            </button>
        );
    }

    return (
        <section
            ref={windowRef}
            className={[
                'desktop-item-window',
                'desktop-folder-window',
                `desktop-folder-window--${viewMode}`,
                active ? 'is-active' : '',
                maximized ? 'is-maximized' : '',
                isDropTarget ? 'is-drop-target' : '',
                detailsPaneOpen ? 'is-details-pane-open' : '',
            ]
                .filter(Boolean)
                .join(' ')}
            style={windowStyle}
            data-desktop-folder-window-id={item.id}
            aria-label={item.label}
            onPointerDown={(event) => {
                event.stopPropagation();
                onActivate?.();
                if (!event.target.closest('.desktop-folder-window__menu-anchor')) setOpenMenu('');
            }}
            onContextMenu={(event) => event.stopPropagation()}
        >
            <header
                className="desktop-folder-window__chrome"
                onPointerDown={startWindowMove}
                onPointerMove={handleWindowPointerMove}
                onPointerUp={stopWindowInteraction}
                onPointerCancel={stopWindowInteraction}
            >
                <div className="desktop-folder-window__tabbar">
                    <div className="desktop-folder-window__tab is-active" data-window-no-drag="true">
                        <Folder size={16} />
                        <span>{item.label}</span>
                        <button type="button" onClick={onClose} aria-label={lang === 'en' ? 'Close tab' : '关闭标签页'}>
                            <X size={14} />
                        </button>
                    </div>
                    <button
                        type="button"
                        className="desktop-folder-window__new-tab"
                        aria-label={lang === 'en' ? 'New tab' : '新建标签页'}
                        onClick={() =>
                            setActivityMessage(
                                lang === 'en'
                                    ? 'This folder is already open in the current tab'
                                    : '当前标签页已打开此文件夹',
                            )
                        }
                        data-window-no-drag="true"
                    >
                        <Plus size={18} />
                    </button>
                    <div className="desktop-folder-window__window-controls" data-window-no-drag="true">
                        <button type="button" onClick={onMinimize} aria-label={lang === 'en' ? 'Minimize' : '最小化'}>
                            <Minus size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={onMaximizeToggle}
                            aria-label={
                                maximized ? (lang === 'en' ? 'Restore' : '还原') : lang === 'en' ? 'Maximize' : '最大化'
                            }
                        >
                            {maximized ? <Minimize2 size={14} /> : <Square size={13} />}
                        </button>
                        <button
                            type="button"
                            className="is-close"
                            onClick={onClose}
                            aria-label={lang === 'en' ? 'Close' : '关闭'}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
                <div className="desktop-folder-window__address-row">
                    <div className="desktop-folder-window__nav-controls">
                        <button
                            type="button"
                            className={canGoBack ? '' : 'is-muted'}
                            onClick={() => goToHistory(-1)}
                            aria-label={lang === 'en' ? 'Back' : '后退'}
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <button
                            type="button"
                            className={canGoForward ? '' : 'is-muted'}
                            onClick={() => goToHistory(1)}
                            aria-label={lang === 'en' ? 'Forward' : '前进'}
                        >
                            <ArrowRight size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => pushLocation('desktop')}
                            aria-label={lang === 'en' ? 'Up' : '向上'}
                        >
                            <ChevronUp size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={handleRefreshFolder}
                            aria-label={lang === 'en' ? 'Refresh' : '刷新'}
                        >
                            <RefreshCw size={17} />
                        </button>
                    </div>
                    <div className="desktop-folder-window__breadcrumb" aria-label={lang === 'en' ? 'Address' : '地址'}>
                        <MonitorCog size={18} />
                        <button type="button" onClick={() => pushLocation('desktop')}>
                            {lang === 'en' ? 'Desktop' : '桌面'}
                        </button>
                        <ArrowRight size={15} />
                        <button type="button" className="is-current" onClick={() => pushLocation('folder')}>
                            {activeLocation === 'folder' ? item.label : activeNavItem.label}
                        </button>
                    </div>
                    <label className="desktop-folder-window__search">
                        <Search size={18} />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={
                                lang === 'en'
                                    ? `Search ${activeLocation === 'folder' ? item.label : activeNavItem.label}`
                                    : `在 ${activeLocation === 'folder' ? item.label : activeNavItem.label} 中搜索`
                            }
                            aria-label={lang === 'en' ? 'Search folder' : '搜索文件夹'}
                        />
                    </label>
                </div>
                <div className="desktop-folder-window__commandbar">
                    <div className="desktop-folder-window__menu-anchor">
                        <button
                            type="button"
                            className="desktop-folder-window__command-primary"
                            onClick={() => setOpenMenu((current) => (current === 'new' ? '' : 'new'))}
                        >
                            <CirclePlus size={18} />
                            <span>{lang === 'en' ? 'New' : '新建'}</span>
                        </button>
                        {openMenu === 'new' && (
                            <div className="desktop-folder-window__menu" role="menu">
                                <span className="desktop-folder-window__menu-title">
                                    {lang === 'en' ? 'Add app' : '添加应用'}
                                </span>
                                {availableApps.slice(0, 8).map((app) => (
                                    <button
                                        key={app.id}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => handleAddAppToFolder(app.id)}
                                    >
                                        {app.iconImage ? (
                                            <img src={app.iconImage} alt="" draggable="false" />
                                        ) : (
                                            <FolderPlus size={17} />
                                        )}
                                        <span>{app.label}</span>
                                    </button>
                                ))}
                                {availableApps.length === 0 && (
                                    <span className="desktop-folder-window__menu-empty">
                                        {lang === 'en' ? 'No apps available' : '没有可添加的应用'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <span className="desktop-folder-window__command-separator" />
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleCutSelected}
                        title={lang === 'en' ? 'Cut' : '剪切'}
                        aria-label={lang === 'en' ? 'Cut' : '剪切'}
                    >
                        <Scissors size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleCopySelected}
                        title={lang === 'en' ? 'Copy' : '复制'}
                        aria-label={lang === 'en' ? 'Copy' : '复制'}
                    >
                        <Copy size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handlePaste}
                        title={lang === 'en' ? 'Paste' : '粘贴'}
                        aria-label={lang === 'en' ? 'Paste' : '粘贴'}
                    >
                        <ClipboardPaste size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleRenameSelected}
                        title={lang === 'en' ? 'Rename' : '重命名'}
                        aria-label={lang === 'en' ? 'Rename' : '重命名'}
                    >
                        <Pencil size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleShareSelected}
                        title={lang === 'en' ? 'Share' : '共享'}
                        aria-label={lang === 'en' ? 'Share' : '共享'}
                    >
                        <Share2 size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleRemoveSelected}
                        title={lang === 'en' ? 'Remove from folder' : '从文件夹移除'}
                        aria-label={lang === 'en' ? 'Remove from folder' : '从文件夹移除'}
                    >
                        <Trash2 size={17} />
                    </button>
                    <span className="desktop-folder-window__command-separator" />
                    <div className="desktop-folder-window__menu-anchor">
                        <button
                            type="button"
                            onClick={() => setOpenMenu((current) => (current === 'sort' ? '' : 'sort'))}
                        >
                            <ArrowDownUp size={17} />
                            <span>{lang === 'en' ? 'Sort' : '排序'}</span>
                        </button>
                        {openMenu === 'sort' && (
                            <div className="desktop-folder-window__menu" role="menu">
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={sortAscending ? 'is-active' : ''}
                                    onClick={() => {
                                        setSortAscending(true);
                                        setOpenMenu('');
                                        setActivityMessage(lang === 'en' ? 'Sorted A to Z' : '已按名称升序排列');
                                    }}
                                >
                                    <ArrowDownUp size={17} />
                                    <span>{lang === 'en' ? 'Name A to Z' : '名称升序'}</span>
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={!sortAscending ? 'is-active' : ''}
                                    onClick={() => {
                                        setSortAscending(false);
                                        setOpenMenu('');
                                        setActivityMessage(lang === 'en' ? 'Sorted Z to A' : '已按名称降序排列');
                                    }}
                                >
                                    <ArrowDownUp size={17} />
                                    <span>{lang === 'en' ? 'Name Z to A' : '名称降序'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="desktop-folder-window__menu-anchor">
                        <button
                            type="button"
                            onClick={() => setOpenMenu((current) => (current === 'view' ? '' : 'view'))}
                        >
                            <LayoutGrid size={17} />
                            <span>{lang === 'en' ? 'View' : '查看'}</span>
                        </button>
                        {openMenu === 'view' && (
                            <div className="desktop-folder-window__menu" role="menu">
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={viewMode === 'details' ? 'is-active' : ''}
                                    onClick={() => {
                                        setViewMode('details');
                                        setOpenMenu('');
                                    }}
                                >
                                    <List size={17} />
                                    <span>{lang === 'en' ? 'Details' : '详细信息'}</span>
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    className={viewMode === 'icons' ? 'is-active' : ''}
                                    onClick={() => {
                                        setViewMode('icons');
                                        setOpenMenu('');
                                    }}
                                >
                                    <LayoutGrid size={17} />
                                    <span>{lang === 'en' ? 'Icons' : '图标'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="desktop-folder-window__menu-anchor">
                        <button
                            type="button"
                            className="desktop-folder-window__icon-command"
                            onClick={() => setOpenMenu((current) => (current === 'more' ? '' : 'more'))}
                            aria-label={lang === 'en' ? 'More' : '更多'}
                        >
                            <MoreHorizontal size={18} />
                        </button>
                        {openMenu === 'more' && (
                            <div className="desktop-folder-window__menu desktop-folder-window__menu--right" role="menu">
                                <button type="button" role="menuitem" onClick={handleOpenSelected}>
                                    <Folder size={17} />
                                    <span>{lang === 'en' ? 'Open selected' : '打开所选项目'}</span>
                                </button>
                                <button type="button" role="menuitem" onClick={handleClearSearch}>
                                    <Search size={17} />
                                    <span>{lang === 'en' ? 'Clear search' : '清除搜索'}</span>
                                </button>
                                <button type="button" role="menuitem" onClick={handleRefreshFolder}>
                                    <RefreshCw size={17} />
                                    <span>{lang === 'en' ? 'Refresh' : '刷新'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className={`desktop-folder-window__details-toggle ${detailsPaneOpen ? 'is-active' : ''}`}
                        onClick={() => setDetailsPaneOpen((current) => !current)}
                    >
                        <List size={17} />
                        <span>{lang === 'en' ? 'Details' : '详细信息'}</span>
                    </button>
                </div>
            </header>
            <div className="desktop-folder-window__content">
                <aside className="desktop-folder-window__sidebar">
                    {navigationItems.map((navItem) => {
                        if (navItem.divider)
                            return <span key={navItem.id} className="desktop-folder-window__sidebar-divider" />;
                        const NavIcon = navItem.icon;
                        return (
                            <button
                                key={navItem.id}
                                type="button"
                                className={navItem.id === activeLocation ? 'is-active' : ''}
                                onClick={() => pushLocation(navItem.id)}
                            >
                                <NavIcon size={18} />
                                <span>{navItem.label}</span>
                                {typeof navItem.count === 'number' && <small>{navItem.count}</small>}
                            </button>
                        );
                    })}
                </aside>
                <section className="desktop-folder-window__main">
                    {viewMode === 'details' && (
                        <div className="desktop-folder-window__details-head" role="row">
                            <button type="button" onClick={() => setSortAscending((current) => !current)}>
                                {lang === 'en' ? 'Name' : '名称'}
                            </button>
                            <span>{lang === 'en' ? 'Date modified' : '修改日期'}</span>
                            <span>{lang === 'en' ? 'Type' : '类型'}</span>
                            <span>{lang === 'en' ? 'Size' : '大小'}</span>
                        </div>
                    )}
                    <div className="desktop-folder-window__grid">
                        {filteredApps.map((app) => (
                            <DesktopFolderAppTile
                                key={app.id}
                                app={app}
                                lang={lang}
                                viewMode={viewMode}
                                selected={selectedAppId === app.id}
                                modifiedLabel={modifiedLabel}
                                onSelect={setSelectedAppId}
                                onOpen={() => onOpenApp(app)}
                                onMoveToDesktop={onMoveAppToDesktop}
                            />
                        ))}
                        {filteredApps.length === 0 && (
                            <div className="desktop-folder-window__empty">
                                <span>
                                    {searchQuery
                                        ? lang === 'en'
                                            ? 'No matching items.'
                                            : '没有匹配的项目。'
                                        : lang === 'en'
                                          ? 'This folder is empty.'
                                          : '此文件夹为空。'}
                                </span>
                            </div>
                        )}
                    </div>
                </section>
                {detailsPaneOpen && (
                    <aside className="desktop-folder-window__details-pane">
                        <span className="desktop-folder-window__details-pane-icon">
                            {selectedApp?.iconImage ? (
                                <img src={selectedApp.iconImage} alt="" draggable="false" />
                            ) : (
                                <Folder size={34} />
                            )}
                        </span>
                        <strong>
                            {selectedApp?.label || (activeLocation === 'folder' ? item.label : activeNavItem.label)}
                        </strong>
                        <span>
                            {selectedApp
                                ? lang === 'en'
                                    ? 'App shortcut'
                                    : '应用快捷方式'
                                : lang === 'en'
                                  ? 'Folder'
                                  : '文件夹'}
                        </span>
                        <small>{selectedApp ? modifiedLabel : baseStatusText}</small>
                    </aside>
                )}
                <footer className="desktop-folder-window__status">{statusText}</footer>
            </div>
            {!maximized &&
                ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((direction) => (
                    <span
                        key={direction}
                        className={`desktop-folder-window__resize desktop-folder-window__resize--${direction}`}
                        aria-hidden="true"
                        onPointerDown={(event) => startWindowResize(event, direction)}
                        onPointerMove={handleWindowPointerMove}
                        onPointerUp={stopWindowInteraction}
                        onPointerCancel={stopWindowInteraction}
                    />
                ))}
        </section>
    );
}
