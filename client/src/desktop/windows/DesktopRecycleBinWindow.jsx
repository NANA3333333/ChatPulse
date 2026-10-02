import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import {
    clampFolderWindowGeometry,
    getDefaultFolderWindowGeometry,
    resizeFolderWindowGeometry,
} from '../windowGeometry.js';
import {
    Recycle,
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
    MonitorCog,
    Search,
    CirclePlus,
    Scissors,
    Copy,
    ClipboardPaste,
    Pencil,
    Trash2,
    ArrowDownUp,
    LayoutGrid,
    List,
    MoreHorizontal,
    Home,
    PanelTopOpen,
    Cloud,
    Download,
    FileText,
} from 'lucide-react';
import { DESKTOP_APP_ICONS } from '../desktopUtils';
import { getRecycleBinDateLabel, getRecycleBinEntrySize, getRecycleBinEntryType } from '../recycleBinFormatting.js';

export function DesktopRecycleBinWindow({
    entries,
    lang,
    active = false,
    geometry,
    maximized = false,
    minimized = false,
    zIndex = 84,
    onActivate,
    onClose,
    onGeometryChange,
    onMaximizeToggle,
    onMinimize,
    onRestore,
    onRestoreEntry,
    onDeleteEntry,
    onEmptyRecycleBin,
}) {
    const windowRef = useRef(null);
    const moveRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortAscending, setSortAscending] = useState(true);
    const [viewMode, setViewMode] = useState('details');
    const [selectedEntryId, setSelectedEntryId] = useState('');
    const [activityMessage, setActivityMessage] = useState('');
    const [openMenu, setOpenMenu] = useState('');
    const [detailsPaneOpen, setDetailsPaneOpen] = useState(false);
    const recycleBinLabel = lang === 'en' ? 'Recycle Bin' : '回收站';
    const filteredEntries = useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase();
        return [...entries]
            .filter((entry) =>
                String(entry.item?.label || '')
                    .toLocaleLowerCase()
                    .includes(query),
            )
            .sort((a, b) =>
                sortAscending
                    ? String(a.item?.label || '').localeCompare(
                          String(b.item?.label || ''),
                          lang === 'en' ? 'en' : 'zh-Hans-CN',
                      )
                    : String(b.item?.label || '').localeCompare(
                          String(a.item?.label || ''),
                          lang === 'en' ? 'en' : 'zh-Hans-CN',
                      ),
            );
    }, [entries, lang, searchQuery, sortAscending]);
    const selectedEntry =
        filteredEntries.find((entry) => entry.id === selectedEntryId) ||
        entries.find((entry) => entry.id === selectedEntryId) ||
        null;
    const baseStatusText =
        lang === 'en'
            ? `${filteredEntries.length} item${filteredEntries.length === 1 ? '' : 's'}`
            : `${filteredEntries.length} 个项目`;
    const statusText = activityMessage || baseStatusText;

    useEffect(() => {
        if (selectedEntryId && !entries.some((entry) => entry.id === selectedEntryId)) {
            setSelectedEntryId('');
        }
    }, [entries, selectedEntryId]);

    const requireSelectedEntry = useCallback(() => {
        if (selectedEntry) return selectedEntry;
        setActivityMessage(lang === 'en' ? 'Select an item first' : '请先选择一个项目');
        return null;
    }, [lang, selectedEntry]);

    const handleRestoreSelected = useCallback(() => {
        const target = requireSelectedEntry();
        if (!target) return;
        const restored = onRestoreEntry?.(target.id);
        if (restored === false) return;
        setSelectedEntryId('');
        setOpenMenu('');
        setActivityMessage(`${lang === 'en' ? 'Restored' : '已还原'} ${target.item.label}`);
    }, [lang, onRestoreEntry, requireSelectedEntry]);

    const handleDeleteSelected = useCallback(() => {
        const target = requireSelectedEntry();
        if (!target) return;
        const deleted = onDeleteEntry?.(target.id);
        if (deleted === false) return;
        setSelectedEntryId('');
        setOpenMenu('');
        setActivityMessage(`${lang === 'en' ? 'Permanently deleted' : '已永久删除'} ${target.item.label}`);
    }, [lang, onDeleteEntry, requireSelectedEntry]);

    const handleEmptyRecycleBin = useCallback(() => {
        if (!entries.length) {
            setActivityMessage(lang === 'en' ? 'Recycle Bin is already empty' : '回收站已经是空的');
            return;
        }
        const emptied = onEmptyRecycleBin?.();
        if (emptied !== false) {
            setSelectedEntryId('');
            setActivityMessage(lang === 'en' ? 'Recycle Bin emptied' : '已清空回收站');
        }
    }, [entries.length, lang, onEmptyRecycleBin]);

    const handleUnavailableCommand = useCallback(() => {
        setActivityMessage(lang === 'en' ? 'This command is not available in Recycle Bin' : '此命令在回收站中不可用');
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
                style={{ left: '18px', zIndex }}
                onClick={() => {
                    onRestore?.();
                    onActivate?.();
                }}
                aria-label={lang === 'en' ? 'Restore Recycle Bin' : '还原回收站'}
            >
                <Recycle size={18} />
                <span>{recycleBinLabel}</span>
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
                'desktop-recycle-bin-window',
                `desktop-folder-window--${viewMode}`,
                active ? 'is-active' : '',
                maximized ? 'is-maximized' : '',
                detailsPaneOpen ? 'is-details-pane-open' : '',
            ]
                .filter(Boolean)
                .join(' ')}
            style={windowStyle}
            data-desktop-recycle-bin-window="true"
            aria-label={recycleBinLabel}
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
                        <Recycle size={16} />
                        <span>{recycleBinLabel}</span>
                        <button type="button" onClick={onClose} aria-label={lang === 'en' ? 'Close tab' : '关闭标签页'}>
                            <X size={14} />
                        </button>
                    </div>
                    <button
                        type="button"
                        className="desktop-folder-window__new-tab"
                        aria-label={lang === 'en' ? 'New tab' : '新建标签页'}
                        onClick={() =>
                            setActivityMessage(lang === 'en' ? 'Recycle Bin is already open' : '回收站已打开')
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
                            className="is-muted"
                            onClick={() =>
                                setActivityMessage(lang === 'en' ? 'No more folder history' : '没有更多文件夹历史记录')
                            }
                            aria-label={lang === 'en' ? 'Back' : '后退'}
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <button
                            type="button"
                            className="is-muted"
                            onClick={() =>
                                setActivityMessage(lang === 'en' ? 'No more folder history' : '没有更多文件夹历史记录')
                            }
                            aria-label={lang === 'en' ? 'Forward' : '前进'}
                        >
                            <ArrowRight size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivityMessage(lang === 'en' ? 'Desktop' : '桌面')}
                            aria-label={lang === 'en' ? 'Up' : '向上'}
                        >
                            <ChevronUp size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setActivityMessage(lang === 'en' ? 'Recycle Bin refreshed' : '回收站已刷新')}
                            aria-label={lang === 'en' ? 'Refresh' : '刷新'}
                        >
                            <RefreshCw size={17} />
                        </button>
                    </div>
                    <div className="desktop-folder-window__breadcrumb" aria-label={lang === 'en' ? 'Address' : '地址'}>
                        <MonitorCog size={18} />
                        <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Desktop' : '桌面')}>
                            {lang === 'en' ? 'Desktop' : '桌面'}
                        </button>
                        <ArrowRight size={15} />
                        <button
                            type="button"
                            className="is-current"
                            onClick={() => setActivityMessage(recycleBinLabel)}
                        >
                            {recycleBinLabel}
                        </button>
                    </div>
                    <label className="desktop-folder-window__search">
                        <Search size={18} />
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={lang === 'en' ? 'Search Recycle Bin' : '在 回收站 中搜索'}
                            aria-label={lang === 'en' ? 'Search Recycle Bin' : '搜索回收站'}
                        />
                    </label>
                </div>
                <div className="desktop-folder-window__commandbar">
                    <button
                        type="button"
                        className="desktop-folder-window__command-primary"
                        onClick={handleUnavailableCommand}
                    >
                        <CirclePlus size={18} />
                        <span>{lang === 'en' ? 'New' : '新建'}</span>
                    </button>
                    <span className="desktop-folder-window__command-separator" />
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleUnavailableCommand}
                        title={lang === 'en' ? 'Cut' : '剪切'}
                        aria-label={lang === 'en' ? 'Cut' : '剪切'}
                    >
                        <Scissors size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleUnavailableCommand}
                        title={lang === 'en' ? 'Copy' : '复制'}
                        aria-label={lang === 'en' ? 'Copy' : '复制'}
                    >
                        <Copy size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleUnavailableCommand}
                        title={lang === 'en' ? 'Paste' : '粘贴'}
                        aria-label={lang === 'en' ? 'Paste' : '粘贴'}
                    >
                        <ClipboardPaste size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleUnavailableCommand}
                        title={lang === 'en' ? 'Rename' : '重命名'}
                        aria-label={lang === 'en' ? 'Rename' : '重命名'}
                    >
                        <Pencil size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleRestoreSelected}
                        title={lang === 'en' ? 'Restore selected item' : '还原所选项目'}
                        aria-label={lang === 'en' ? 'Restore selected item' : '还原所选项目'}
                    >
                        <Recycle size={17} />
                    </button>
                    <button
                        type="button"
                        className="desktop-folder-window__icon-command"
                        onClick={handleDeleteSelected}
                        title={lang === 'en' ? 'Delete permanently' : '永久删除'}
                        aria-label={lang === 'en' ? 'Delete permanently' : '永久删除'}
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
                                <button type="button" role="menuitem" onClick={handleRestoreSelected}>
                                    <Recycle size={17} />
                                    <span>{lang === 'en' ? 'Restore selected item' : '还原所选项目'}</span>
                                </button>
                                <button type="button" role="menuitem" onClick={handleDeleteSelected}>
                                    <Trash2 size={17} />
                                    <span>{lang === 'en' ? 'Delete permanently' : '永久删除'}</span>
                                </button>
                                <button type="button" role="menuitem" onClick={handleEmptyRecycleBin}>
                                    <Trash2 size={17} />
                                    <span>{lang === 'en' ? 'Empty Recycle Bin' : '清空回收站'}</span>
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
                    <button type="button" className="is-active" onClick={() => setActivityMessage(recycleBinLabel)}>
                        <Home size={18} />
                        <span>{lang === 'en' ? 'Home folder' : '主文件夹'}</span>
                        <small>{entries.length}</small>
                    </button>
                    <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Gallery' : '图库')}>
                        <PanelTopOpen size={18} />
                        <span>{lang === 'en' ? 'Gallery' : '图库'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActivityMessage(lang === 'en' ? 'NA - Personal' : 'NA - 个人')}
                    >
                        <Cloud size={18} />
                        <span>{lang === 'en' ? 'NA - Personal' : 'NA - 个人'}</span>
                    </button>
                    <span className="desktop-folder-window__sidebar-divider" />
                    <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Desktop' : '桌面')}>
                        <MonitorCog size={18} />
                        <span>{lang === 'en' ? 'Desktop' : '桌面'}</span>
                    </button>
                    <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Downloads' : '下载')}>
                        <Download size={18} />
                        <span>{lang === 'en' ? 'Downloads' : '下载'}</span>
                    </button>
                    <button type="button" onClick={() => setActivityMessage(lang === 'en' ? 'Documents' : '文档')}>
                        <FileText size={18} />
                        <span>{lang === 'en' ? 'Documents' : '文档'}</span>
                    </button>
                </aside>
                <section className="desktop-folder-window__main">
                    {viewMode === 'details' && (
                        <div
                            className="desktop-folder-window__details-head desktop-recycle-bin-window__details-head"
                            role="row"
                        >
                            <button type="button" onClick={() => setSortAscending((current) => !current)}>
                                {lang === 'en' ? 'Name' : '名称'}
                            </button>
                            <span>{lang === 'en' ? 'Original location' : '原位置'}</span>
                            <span>{lang === 'en' ? 'Date deleted' : '删除日期'}</span>
                            <span>{lang === 'en' ? 'Size' : '大小'}</span>
                            <span>{lang === 'en' ? 'Item type' : '项目类型'}</span>
                        </div>
                    )}
                    <div
                        className={`desktop-folder-window__grid desktop-recycle-bin-window__grid desktop-recycle-bin-window__grid--${viewMode}`}
                    >
                        {filteredEntries.map((entry) => {
                            const entryIcon =
                                entry.item.kind === 'folder'
                                    ? DESKTOP_APP_ICONS.createdFolder
                                    : DESKTOP_APP_ICONS.createdTextDocument;
                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    className={`desktop-recycle-bin-item ${selectedEntryId === entry.id ? 'is-selected' : ''}`}
                                    onClick={() => setSelectedEntryId(entry.id)}
                                    onDoubleClick={() => onRestoreEntry?.(entry.id)}
                                    title={entry.item.label}
                                >
                                    <span className="desktop-recycle-bin-item__primary">
                                        <img src={entryIcon} alt="" draggable="false" />
                                        <span>{entry.item.label}</span>
                                    </span>
                                    {viewMode === 'details' && (
                                        <>
                                            <span>
                                                {entry.originalLocation === 'Desktop'
                                                    ? lang === 'en'
                                                        ? 'Desktop'
                                                        : '桌面'
                                                    : entry.originalLocation}
                                            </span>
                                            <span>{getRecycleBinDateLabel(entry.deletedAt, lang)}</span>
                                            <span>{getRecycleBinEntrySize(entry, lang)}</span>
                                            <span>{getRecycleBinEntryType(entry, lang)}</span>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                        {filteredEntries.length === 0 && (
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
                            {selectedEntry ? (
                                <img
                                    src={
                                        selectedEntry.item.kind === 'folder'
                                            ? DESKTOP_APP_ICONS.createdFolder
                                            : DESKTOP_APP_ICONS.createdTextDocument
                                    }
                                    alt=""
                                    draggable="false"
                                />
                            ) : (
                                <img
                                    src={
                                        entries.length
                                            ? DESKTOP_APP_ICONS.recycleBinFull
                                            : DESKTOP_APP_ICONS.recycleBinEmpty
                                    }
                                    alt=""
                                    draggable="false"
                                />
                            )}
                        </span>
                        <strong>{selectedEntry?.item.label || recycleBinLabel}</strong>
                        <span>
                            {selectedEntry
                                ? getRecycleBinEntryType(selectedEntry, lang)
                                : lang === 'en'
                                  ? 'System folder'
                                  : '系统文件夹'}
                        </span>
                        <small>
                            {selectedEntry ? getRecycleBinDateLabel(selectedEntry.deletedAt, lang) : baseStatusText}
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
