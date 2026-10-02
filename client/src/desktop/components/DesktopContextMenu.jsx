import {
    Recycle,
    Trash2,
    RefreshCw,
    Scissors,
    Copy,
    Pencil,
    Camera,
    Settings,
    LayoutGrid,
    ArrowRight,
    ArrowDownUp,
    ClipboardPaste,
    Undo2,
    CirclePlus,
    FolderPlus,
    FileText,
    MonitorCog,
    Paintbrush,
    ListPlus,
} from 'lucide-react';

export function DesktopContextMenu({
    contextMenu,
    contextMenuCreatedItem,
    contextMenuRecycleBin,
    openRecycleBinWindow,
    closeContextMenu,
    lang,
    handleEmptyRecycleBin,
    handleResetContextAppPosition,
    handleCutContextCreatedItem,
    handleCopyContextCreatedItem,
    handleRenameContextCreatedItem,
    handleDeleteContextCreatedItem,
    handleOpenContextApp,
    ContextMenuCreatedIcon,
    ContextMenuAppIcon,
    handleCaptureDesktopScreenshot,
    handleOpenSettingsFromDesktop,
    setContextMenu,
    desktopIconSize,
    handleSetIconSize,
    desktopAutoArrange,
    handleToggleAutoArrange,
    desktopAlignIconsToGrid,
    handleToggleAlignToGrid,
    desktopIconsVisible,
    handleToggleDesktopIcons,
    desktopSortKey,
    handleSortIcons,
    handleRefreshDesktop,
    desktopClipboard,
    handlePasteDesktopClipboard,
    handleUndoIconLayout,
    handleCreateDesktopItem,
    handleOpenDisplaySettings,
    handleOpenPersonalization,
    handleArrangeIcons,
}) {
    const CreatedIcon = ContextMenuCreatedIcon;
    const AppIcon = ContextMenuAppIcon;
    return (
        <div
            className={`desktop-context-menu desktop-context-menu--${contextMenu.type} ${contextMenuCreatedItem ? 'desktop-context-menu--created-item' : ''} desktop-context-menu--submenu-${contextMenu.submenuSide || 'right'}`}
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            onPointerDown={(event) => event.stopPropagation()}
            role="menu"
        >
            {contextMenu.type === 'app' ? (
                contextMenuRecycleBin ? (
                    <>
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={(event) => {
                                openRecycleBinWindow();
                                closeContextMenu();
                                event.stopPropagation();
                            }}
                        >
                            <Recycle size={18} />
                            <span>{lang === 'en' ? 'Open' : '打开'}</span>
                        </button>
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={() => {
                                closeContextMenu();
                                handleEmptyRecycleBin();
                            }}
                        >
                            <Trash2 size={18} />
                            <span>{lang === 'en' ? 'Empty Recycle Bin' : '清空回收站'}</span>
                        </button>
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={handleResetContextAppPosition}
                        >
                            <RefreshCw size={18} />
                            <span>{lang === 'en' ? 'Reset icon position' : '重置图标位置'}</span>
                        </button>
                    </>
                ) : contextMenuCreatedItem ? (
                    <>
                        <div
                            className="desktop-context-menu__command-bar"
                            role="group"
                            aria-label={lang === 'en' ? 'Item actions' : '项目操作'}
                        >
                            <button
                                type="button"
                                className="desktop-context-menu__command"
                                onClick={handleCutContextCreatedItem}
                                title={lang === 'en' ? 'Cut' : '剪切'}
                            >
                                <Scissors size={18} />
                                <span>{lang === 'en' ? 'Cut' : '剪切'}</span>
                            </button>
                            <button
                                type="button"
                                className="desktop-context-menu__command"
                                onClick={handleCopyContextCreatedItem}
                                title={lang === 'en' ? 'Copy' : '复制'}
                            >
                                <Copy size={18} />
                                <span>{lang === 'en' ? 'Copy' : '复制'}</span>
                            </button>
                            <button
                                type="button"
                                className="desktop-context-menu__command"
                                onClick={handleRenameContextCreatedItem}
                                title={lang === 'en' ? 'Rename' : '重命名'}
                            >
                                <Pencil size={18} />
                                <span>{lang === 'en' ? 'Rename' : '重命名'}</span>
                            </button>
                            <button
                                type="button"
                                className="desktop-context-menu__command is-danger"
                                onClick={handleDeleteContextCreatedItem}
                                title={lang === 'en' ? 'Delete' : '删除'}
                            >
                                <Trash2 size={18} />
                                <span>{lang === 'en' ? 'Delete' : '删除'}</span>
                            </button>
                        </div>
                        <span className="desktop-context-menu__separator" />
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={handleOpenContextApp}
                        >
                            <CreatedIcon size={18} />
                            <span>{lang === 'en' ? 'Open' : '打开'}</span>
                            <kbd>Enter</kbd>
                        </button>
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={handleResetContextAppPosition}
                        >
                            <RefreshCw size={18} />
                            <span>{lang === 'en' ? 'Reset icon position' : '重置图标位置'}</span>
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={handleOpenContextApp}
                        >
                            <AppIcon size={18} />
                            <span>{lang === 'en' ? 'Open' : '打开'}</span>
                        </button>
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={handleResetContextAppPosition}
                        >
                            <RefreshCw size={18} />
                            <span>{lang === 'en' ? 'Reset icon position' : '重置图标位置'}</span>
                        </button>
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={handleCaptureDesktopScreenshot}
                        >
                            <Camera size={18} />
                            <span>{lang === 'en' ? 'Screenshot' : '截图'}</span>
                        </button>
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={handleOpenSettingsFromDesktop}
                        >
                            <Settings size={18} />
                            <span>{lang === 'en' ? 'Open Settings' : '打开设置'}</span>
                        </button>
                    </>
                )
            ) : (
                <>
                    <div
                        className={`desktop-context-menu__item-wrap ${contextMenu.pinnedSubmenu === 'view' ? 'is-pinned' : ''}`}
                    >
                        <button
                            type="button"
                            className="desktop-context-menu__row has-submenu"
                            role="menuitem"
                            onClick={() =>
                                setContextMenu((current) =>
                                    current
                                        ? { ...current, pinnedSubmenu: current.pinnedSubmenu === 'view' ? '' : 'view' }
                                        : current,
                                )
                            }
                        >
                            <LayoutGrid size={21} strokeWidth={1.75} />
                            <span>{lang === 'en' ? 'View' : '查看'}</span>
                            <ArrowRight size={16} />
                        </button>
                        <div className="desktop-context-submenu" role="menu">
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopIconSize === 'large' ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={() => handleSetIconSize('large')}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Large icons' : '大图标'}</span>
                                <kbd>Ctrl+Shift+2</kbd>
                            </button>
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopIconSize === 'medium' ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={() => handleSetIconSize('medium')}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Medium icons' : '中等图标'}</span>
                                <kbd>Ctrl+Shift+3</kbd>
                            </button>
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopIconSize === 'small' ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={() => handleSetIconSize('small')}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Small icons' : '小图标'}</span>
                                <kbd>Ctrl+Shift+4</kbd>
                            </button>
                            <span className="desktop-context-menu__separator" />
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopAutoArrange ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={handleToggleAutoArrange}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Auto arrange icons' : '自动排列图标'}</span>
                            </button>
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopAlignIconsToGrid ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={handleToggleAlignToGrid}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Align icons to grid' : '将图标与网格对齐'}</span>
                            </button>
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopIconsVisible ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={handleToggleDesktopIcons}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Show desktop icons' : '显示桌面图标'}</span>
                            </button>
                        </div>
                    </div>

                    <div
                        className={`desktop-context-menu__item-wrap ${contextMenu.pinnedSubmenu === 'sort' ? 'is-pinned' : ''}`}
                    >
                        <button
                            type="button"
                            className="desktop-context-menu__row has-submenu"
                            role="menuitem"
                            onClick={() =>
                                setContextMenu((current) =>
                                    current
                                        ? { ...current, pinnedSubmenu: current.pinnedSubmenu === 'sort' ? '' : 'sort' }
                                        : current,
                                )
                            }
                        >
                            <ArrowDownUp size={21} strokeWidth={1.75} />
                            <span>{lang === 'en' ? 'Sort by' : '排序方式'}</span>
                            <ArrowRight size={16} />
                        </button>
                        <div className="desktop-context-submenu" role="menu">
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopSortKey === 'name' ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={() => handleSortIcons('name')}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Name' : '名称'}</span>
                            </button>
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopSortKey === 'status' ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={() => handleSortIcons('status')}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Running status' : '运行状态'}</span>
                            </button>
                            <button
                                type="button"
                                className={`desktop-context-menu__row ${desktopSortKey === 'unread' ? 'is-checked' : ''}`}
                                role="menuitem"
                                onClick={() => handleSortIcons('unread')}
                            >
                                <span className="desktop-context-menu__check" />
                                <span>{lang === 'en' ? 'Unread first' : '未读优先'}</span>
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="desktop-context-menu__row"
                        role="menuitem"
                        onClick={handleRefreshDesktop}
                    >
                        <RefreshCw size={18} />
                        <span>{lang === 'en' ? 'Refresh' : '刷新'}</span>
                    </button>
                    <button
                        type="button"
                        className="desktop-context-menu__row"
                        role="menuitem"
                        onClick={handleCaptureDesktopScreenshot}
                    >
                        <Camera size={18} />
                        <span>{lang === 'en' ? 'Screenshot' : '截图'}</span>
                    </button>
                    {desktopClipboard && (
                        <button
                            type="button"
                            className="desktop-context-menu__row"
                            role="menuitem"
                            onClick={handlePasteDesktopClipboard}
                        >
                            <ClipboardPaste size={18} />
                            <span>{lang === 'en' ? 'Paste' : '粘贴'}</span>
                            <kbd>Ctrl+V</kbd>
                        </button>
                    )}
                    <span className="desktop-context-menu__separator" />
                    <button
                        type="button"
                        className="desktop-context-menu__row"
                        role="menuitem"
                        onClick={handleUndoIconLayout}
                    >
                        <Undo2 size={21} strokeWidth={1.75} />
                        <span>{lang === 'en' ? 'Undo Delete' : '撤消 删除'}</span>
                        <kbd>Ctrl+Z</kbd>
                    </button>

                    <div
                        className={`desktop-context-menu__item-wrap ${contextMenu.pinnedSubmenu === 'new' ? 'is-pinned' : ''}`}
                    >
                        <button
                            type="button"
                            className="desktop-context-menu__row has-submenu"
                            role="menuitem"
                            onClick={() =>
                                setContextMenu((current) =>
                                    current
                                        ? { ...current, pinnedSubmenu: current.pinnedSubmenu === 'new' ? '' : 'new' }
                                        : current,
                                )
                            }
                        >
                            <CirclePlus size={21} strokeWidth={1.75} />
                            <span>{lang === 'en' ? 'New' : '新建'}</span>
                            <ArrowRight size={16} />
                        </button>
                        <div className="desktop-context-submenu" role="menu">
                            <button
                                type="button"
                                className="desktop-context-menu__row"
                                role="menuitem"
                                onClick={() => handleCreateDesktopItem('folder')}
                            >
                                <FolderPlus size={19} />
                                <span>{lang === 'en' ? 'Folder' : '文件夹'}</span>
                            </button>
                            <button
                                type="button"
                                className="desktop-context-menu__row"
                                role="menuitem"
                                onClick={() => handleCreateDesktopItem('text')}
                            >
                                <FileText size={19} />
                                <span>{lang === 'en' ? 'Text Document' : '文本文档'}</span>
                            </button>
                        </div>
                    </div>

                    <span className="desktop-context-menu__separator" />
                    <button
                        type="button"
                        className="desktop-context-menu__row"
                        role="menuitem"
                        onClick={handleOpenDisplaySettings}
                    >
                        <MonitorCog size={21} strokeWidth={1.75} />
                        <span>{lang === 'en' ? 'Display settings' : '显示设置'}</span>
                    </button>
                    <button
                        type="button"
                        className="desktop-context-menu__row"
                        role="menuitem"
                        onClick={handleOpenPersonalization}
                    >
                        <Paintbrush size={21} strokeWidth={1.75} />
                        <span>{lang === 'en' ? 'Personalize' : '个性化'}</span>
                    </button>
                    <span className="desktop-context-menu__separator" />
                    <button
                        type="button"
                        className="desktop-context-menu__row"
                        role="menuitem"
                        onClick={() =>
                            setContextMenu((current) =>
                                current ? { ...current, showMore: !current.showMore } : current,
                            )
                        }
                    >
                        <ListPlus size={21} strokeWidth={1.75} />
                        <span>{lang === 'en' ? 'Show more options' : '显示更多选项'}</span>
                    </button>
                    {contextMenu.showMore && (
                        <>
                            <span className="desktop-context-menu__separator" />
                            <button
                                type="button"
                                className="desktop-context-menu__row"
                                role="menuitem"
                                onClick={() => handleArrangeIcons()}
                            >
                                <RefreshCw size={18} />
                                <span>{lang === 'en' ? 'Reset all icon positions' : '重置全部图标位置'}</span>
                            </button>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
