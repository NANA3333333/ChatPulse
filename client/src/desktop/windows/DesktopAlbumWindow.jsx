import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
    PanelTopOpen,
    Cloud,
    MonitorCog,
    Download,
    FileText,
    Music2,
    Volume2,
    Home,
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
    Trash2,
    Eraser,
    ArrowDownUp,
    LayoutGrid,
    List,
    MoreHorizontal,
} from 'lucide-react';
import { formatDesktopPhotoTimestamp, getDesktopPhotoFileName } from '../desktopPhoto.js';
import { clampFolderWindowGeometry, resizeFolderWindowGeometry } from '../windowGeometry.js';

export function DesktopAlbumWindow({
    photos,
    selectedPhotoId,
    lang,
    active = false,
    geometry,
    maximized = false,
    minimized = false,
    zIndex = 86,
    onActivate,
    onClose,
    onGeometryChange,
    onMaximizeToggle,
    onMinimize,
    onRestore,
    onSelectPhoto,
    onCapture,
    onDeletePhoto,
    onClearPhotos,
}) {
    const windowRef = useRef(null);
    const moveRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortAscending, setSortAscending] = useState(true);
    const [viewMode, setViewMode] = useState('details');
    const [activeLocation, setActiveLocation] = useState('album');
    const [locationHistory, setLocationHistory] = useState(['album']);
    const [locationHistoryIndex, setLocationHistoryIndex] = useState(0);
    const [activityMessage, setActivityMessage] = useState('');
    const [openMenu, setOpenMenu] = useState('');
    const [detailsPaneOpen, setDetailsPaneOpen] = useState(false);
    const albumLabel = lang === 'en' ? 'Pictures' : '图片';
    const navigationItems = useMemo(
        () => [
            { id: 'album', label: albumLabel, icon: PanelTopOpen, count: photos.length },
            { id: 'gallery', label: lang === 'en' ? 'Gallery' : '图库', icon: PanelTopOpen },
            { id: 'cloud', label: lang === 'en' ? 'NA - Personal' : 'NA - 个人', icon: Cloud },
            { id: 'divider-a', divider: true },
            { id: 'desktop', label: lang === 'en' ? 'Desktop' : '桌面', icon: MonitorCog },
            { id: 'downloads', label: lang === 'en' ? 'Downloads' : '下载', icon: Download },
            { id: 'documents', label: lang === 'en' ? 'Documents' : '文档', icon: FileText },
            { id: 'music', label: lang === 'en' ? 'Music' : '音乐', icon: Music2 },
            { id: 'videos', label: lang === 'en' ? 'Videos' : '视频', icon: Volume2 },
            { id: 'divider-b', divider: true },
            { id: 'this-pc', label: lang === 'en' ? 'This PC' : '此电脑', icon: Home },
        ],
        [albumLabel, lang, photos.length],
    );
    const activeNavItem = navigationItems.find((navItem) => navItem.id === activeLocation) || navigationItems[0];
    const filteredPhotos = useMemo(() => {
        if (activeLocation !== 'album') return [];
        const query = searchQuery.trim().toLocaleLowerCase();
        return [...photos]
            .filter((photo) =>
                String(photo.label || '')
                    .toLocaleLowerCase()
                    .includes(query),
            )
            .sort((a, b) =>
                sortAscending
                    ? String(a.label || '').localeCompare(String(b.label || ''), lang === 'en' ? 'en' : 'zh-Hans-CN')
                    : String(b.label || '').localeCompare(String(a.label || ''), lang === 'en' ? 'en' : 'zh-Hans-CN'),
            );
    }, [activeLocation, lang, photos, searchQuery, sortAscending]);
    const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) || photos[0] || null;
    const canGoBack = locationHistoryIndex > 0;
    const canGoForward = locationHistoryIndex < locationHistory.length - 1;
    const baseStatusText =
        lang === 'en'
            ? `${filteredPhotos.length} item${filteredPhotos.length === 1 ? '' : 's'}`
            : `${filteredPhotos.length} 个项目`;
    const statusText = activityMessage || baseStatusText;
    const selectedPhotoDateLabel = selectedPhoto ? formatDesktopPhotoTimestamp(selectedPhoto.createdAt, lang) : '';
    const selectedPhotoTypeLabel = selectedPhoto
        ? String(selectedPhoto.type || '').includes('svg')
            ? lang === 'en'
                ? 'SVG image'
                : 'SVG 图像'
            : lang === 'en'
              ? 'JPEG image'
              : 'JPEG 图像'
        : lang === 'en'
          ? 'Folder'
          : '文件夹';
    const getPhotoSizeLabel = useCallback((photo) => {
        if (!photo?.dataUrl) return '0 KB';
        const payloadLength = String(photo.dataUrl).split(',')[1]?.length || 0;
        const sizeKb = Math.max(1, Math.round((payloadLength * 0.75) / 1024));
        return `${sizeKb} KB`;
    }, []);

    useEffect(() => {
        if (selectedPhotoId && photos.some((photo) => photo.id === selectedPhotoId)) return;
        onSelectPhoto?.(photos[0]?.id || '');
    }, [onSelectPhoto, photos, selectedPhotoId]);

    const pushLocation = useCallback(
        (locationId) => {
            const target = navigationItems.find((navItem) => navItem.id === locationId && !navItem.divider);
            if (!target) return;
            setActiveLocation(locationId);
            setSearchQuery('');
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
            const nextLocation = locationHistory[nextIndex] || 'album';
            setLocationHistoryIndex(nextIndex);
            setActiveLocation(nextLocation);
            setSearchQuery('');
            setOpenMenu('');
            const navItem = navigationItems.find((item) => item.id === nextLocation);
            setActivityMessage(navItem?.label || '');
        },
        [lang, locationHistory, locationHistoryIndex, navigationItems],
    );

    const handleRefreshAlbum = useCallback(() => {
        setSearchQuery('');
        setOpenMenu('');
        setActivityMessage(lang === 'en' ? 'Folder refreshed' : '文件夹已刷新');
    }, [lang]);

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
        setOpenMenu('');
        setActivityMessage(lang === 'en' ? 'Search cleared' : '搜索已清除');
    }, [lang]);

    const requireSelectedPhoto = useCallback(() => {
        if (selectedPhoto) return selectedPhoto;
        setActivityMessage(lang === 'en' ? 'Select an item first' : '请先选择一个项目');
        return null;
    }, [lang, selectedPhoto]);

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
            const currentGeometry = clampFolderWindowGeometry(geometry);
            moveRef.current = {
                mode: 'move',
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                geometry: currentGeometry,
            };
            onActivate?.();
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        [geometry, maximized, onActivate],
    );
    const startWindowResize = useCallback(
        (event, direction) => {
            if (event.button !== undefined && event.button !== 0) return;
            if (maximized) return;
            event.preventDefault();
            event.stopPropagation();
            moveRef.current = {
                mode: 'resize',
                direction,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                geometry: clampFolderWindowGeometry(geometry),
            };
            onActivate?.();
            event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        [geometry, maximized, onActivate],
    );
    const handleWindowPointerMove = useCallback(
        (event) => {
            const drag = moveRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            event.preventDefault();
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (drag.mode === 'resize') {
                onGeometryChange?.(resizeFolderWindowGeometry(drag.geometry, dx, dy, drag.direction));
                return;
            }
            onGeometryChange?.(
                clampFolderWindowGeometry({
                    ...drag.geometry,
                    x: drag.geometry.x + dx,
                    y: drag.geometry.y + dy,
                }),
            );
        },
        [onGeometryChange],
    );
    const stopWindowInteraction = useCallback((event) => {
        const drag = moveRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        moveRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }, []);
    const handleDownload = useCallback(
        (photo) => {
            const target = photo?.id ? photo : requireSelectedPhoto();
            if (!target) return;
            const link = document.createElement('a');
            link.href = target.dataUrl;
            link.download = getDesktopPhotoFileName(target);
            link.click();
            setActivityMessage(lang === 'en' ? 'Save started' : '已开始保存');
            setOpenMenu('');
        },
        [lang, requireSelectedPhoto],
    );
    const handleDeleteSelected = useCallback(() => {
        const target = requireSelectedPhoto();
        if (!target) return;
        onDeletePhoto?.(target.id);
        setActivityMessage(lang === 'en' ? 'Photo deleted' : '照片已删除');
        setOpenMenu('');
    }, [lang, onDeletePhoto, requireSelectedPhoto]);

    if (minimized) {
        return (
            <button
                type="button"
                className={`desktop-folder-window-minimized ${active ? 'is-active' : ''}`}
                style={{ left: '174px', zIndex }}
                onClick={() => {
                    onRestore?.();
                    onActivate?.();
                }}
                aria-label={lang === 'en' ? 'Restore Pictures' : '还原图片'}
            >
                <Folder size={18} />
                <span>{albumLabel}</span>
                <Maximize2 size={15} />
            </button>
        );
    }

    const safeGeometry = clampFolderWindowGeometry(geometry);
    const windowStyle = maximized
        ? { zIndex }
        : {
              left: `${safeGeometry.x}px`,
              top: `${safeGeometry.y}px`,
              width: `${safeGeometry.width}px`,
              height: `${safeGeometry.height}px`,
              zIndex,
          };

    return (
        <section
            ref={windowRef}
            className={[
                'desktop-item-window',
                'desktop-folder-window',
                'desktop-album-window',
                `desktop-folder-window--${viewMode}`,
                active ? 'is-active' : '',
                maximized ? 'is-maximized' : '',
                detailsPaneOpen ? 'is-details-pane-open' : '',
            ]
                .filter(Boolean)
                .join(' ')}
            style={windowStyle}
            data-desktop-album-window="true"
            aria-label={albumLabel}
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
                        <span>{albumLabel}</span>
                        <button type="button" onClick={onClose} aria-label={lang === 'en' ? 'Close tab' : '关闭标签页'}>
                            <X size={14} />
                        </button>
                    </div>
                    <button
                        type="button"
                        className="desktop-folder-window__new-tab"
                        aria-label={lang === 'en' ? 'New tab' : '新建标签页'}
                        onClick={() => setActivityMessage(lang === 'en' ? 'Pictures is already open' : '图片已打开')}
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
                            onClick={handleRefreshAlbum}
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
                        <button type="button" className="is-current" onClick={() => pushLocation('album')}>
                            {activeLocation === 'album' ? albumLabel : activeNavItem.label}
                        </button>
                    </div>
                    <label className="desktop-folder-window__search">
                        <Search size={18} />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={
                                lang === 'en'
                                    ? `Search ${activeLocation === 'album' ? albumLabel : activeNavItem.label}`
                                    : `在 ${activeLocation === 'album' ? albumLabel : activeNavItem.label} 中搜索`
                            }
                            aria-label={lang === 'en' ? 'Search folder' : '搜索文件夹'}
                        />
                    </label>
                </div>
                <div className="desktop-folder-window__commandbar">
                    <button type="button" className="desktop-folder-window__command-primary" onClick={onCapture}>
                        <CirclePlus size={18} />
                        <span>{lang === 'en' ? 'Screenshot' : '截图'}</span>
                    </button>
                    <span className="desktop-folder-window__command-separator" />
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleDownload}
                        title={lang === 'en' ? 'Save' : '保存'}
                        aria-label={lang === 'en' ? 'Save' : '保存'}
                    >
                        <Download size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleDeleteSelected}
                        title={lang === 'en' ? 'Delete' : '删除'}
                        aria-label={lang === 'en' ? 'Delete' : '删除'}
                    >
                        <Trash2 size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={onClearPhotos}
                        title={lang === 'en' ? 'Clear all' : '清空'}
                        aria-label={lang === 'en' ? 'Clear all' : '清空'}
                    >
                        <Eraser size={17} />
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
                                <button type="button" role="menuitem" onClick={handleDownload}>
                                    <Download size={17} />
                                    <span>{lang === 'en' ? 'Save selected' : '保存所选照片'}</span>
                                </button>
                                <button type="button" role="menuitem" onClick={handleClearSearch}>
                                    <Search size={17} />
                                    <span>{lang === 'en' ? 'Clear search' : '清除搜索'}</span>
                                </button>
                                <button type="button" role="menuitem" onClick={handleRefreshAlbum}>
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
                    <div
                        className="desktop-folder-window__grid"
                        aria-label={lang === 'en' ? 'Saved photos' : '已保存照片'}
                    >
                        {filteredPhotos.map((photo) => {
                            const selected = selectedPhoto?.id === photo.id;
                            const photoType = String(photo.type || '').includes('svg')
                                ? lang === 'en'
                                    ? 'SVG image'
                                    : 'SVG 图像'
                                : lang === 'en'
                                  ? 'JPEG image'
                                  : 'JPEG 图像';
                            return (
                                <div
                                    key={photo.id}
                                    className={`desktop-folder-app-tile desktop-album-photo-file ${selected ? 'is-selected' : ''}`}
                                    data-album-photo-id={photo.id}
                                >
                                    <button
                                        type="button"
                                        className="desktop-folder-app-tile__open"
                                        onClick={() => onSelectPhoto?.(photo.id)}
                                        onDoubleClick={() => handleDownload(photo)}
                                        title={photo.label}
                                        aria-label={photo.label}
                                    >
                                        <span className="desktop-folder-app-tile__primary">
                                            <span className="desktop-folder-app-tile__icon desktop-album-photo-file__icon">
                                                <img src={photo.dataUrl} alt="" draggable="false" />
                                            </span>
                                            <span className="desktop-folder-app-tile__name">{photo.label}</span>
                                        </span>
                                        {viewMode === 'details' && (
                                            <>
                                                <span className="desktop-folder-app-tile__date">
                                                    {formatDesktopPhotoTimestamp(photo.createdAt, lang)}
                                                </span>
                                                <span className="desktop-folder-app-tile__type">{photoType}</span>
                                                <span className="desktop-folder-app-tile__size">
                                                    {getPhotoSizeLabel(photo)}
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                        {filteredPhotos.length === 0 && (
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
                        <span className="desktop-folder-window__details-pane-icon desktop-album-photo-file__details-icon">
                            {selectedPhoto ? (
                                <img src={selectedPhoto.dataUrl} alt="" draggable="false" />
                            ) : (
                                <Folder size={34} />
                            )}
                        </span>
                        <strong>
                            {selectedPhoto?.label || (activeLocation === 'album' ? albumLabel : activeNavItem.label)}
                        </strong>
                        <span>{selectedPhoto ? selectedPhotoTypeLabel : lang === 'en' ? 'Folder' : '文件夹'}</span>
                        <small>
                            {selectedPhoto
                                ? `${selectedPhotoDateLabel} · ${getPhotoSizeLabel(selectedPhoto)}`
                                : baseStatusText}
                        </small>
                    </aside>
                )}
                <footer className="desktop-folder-window__status">{statusText}</footer>
            </div>

            {!maximized &&
                ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map((direction) => (
                    <span
                        key={direction}
                        className={`desktop-folder-window__resize desktop-folder-window__resize--${direction}`}
                        onPointerDown={(event) => startWindowResize(event, direction)}
                        onPointerMove={handleWindowPointerMove}
                        onPointerUp={stopWindowInteraction}
                        onPointerCancel={stopWindowInteraction}
                        aria-hidden="true"
                    />
                ))}
        </section>
    );
}
