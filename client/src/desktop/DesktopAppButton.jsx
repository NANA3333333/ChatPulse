import React, { useCallback, useEffect, useRef } from 'react';
import { Folder } from 'lucide-react';
import { DESKTOP_APP_ICONS } from './desktopUtils';

function DesktopAppButton({
  app,
  pinned = false,
  style,
  isDragging = false,
  isRenaming = false,
  renameValue = '',
  onOpen,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
  isSettling = false,
  settlingPhase = '',
  isFolderDropTarget = false,
}) {
  const renameInputRef = useRef(null);
  const rootRef = useRef(null);
  const Icon = app.icon || Folder;
  const label = app.label;
  const iconImage = pinned ? (app.taskbarIconImage || app.iconImage) : app.iconImage;
  const folderPreviewApp = app.kind === 'folder' ? app.folderPreviewApp : null;
  const FolderPreviewIcon = folderPreviewApp?.icon || Folder;
  const folderPreviewIconImage = folderPreviewApp?.taskbarIconImage || folderPreviewApp?.iconImage;
  const usesFolderPreviewStack = Boolean(folderPreviewApp && !pinned);
  const iconClass = pinned ? 'desktop-taskbar-app__icon' : 'desktop-app__icon';
  const iconClassName = [
    iconClass,
    iconImage ? `${iconClass}--image` : '',
  ].filter(Boolean).join(' ');
  const className = [
    pinned ? 'desktop-taskbar-app' : 'desktop-app',
    app.kind ? `${pinned ? 'desktop-taskbar-app' : 'desktop-app'}--${app.kind}` : '',
    app.variant ? `${pinned ? 'desktop-taskbar-app' : 'desktop-app'}--${app.variant}` : '',
    !pinned && app.active ? 'is-active' : '',
    !pinned && app.running ? 'is-running' : '',
    usesFolderPreviewStack ? 'has-folder-preview' : '',
    isDragging ? 'is-dragging' : '',
    isRenaming && !pinned ? 'is-renaming' : '',
    isSettling ? 'is-settling' : '',
    isSettling && settlingPhase ? `is-settling-${settlingPhase}` : '',
    isFolderDropTarget ? 'is-folder-drop-target' : '',
  ].filter(Boolean).join(' ');
  const buttonStyle = {
    ...(app.accent ? { '--desktop-app-accent': app.accent } : {}),
    ...(style || {}),
  };
  const inlineRenaming = Boolean(isRenaming && !pinned);
  const RootElement = inlineRenaming ? 'div' : 'button';
  const rootProps = inlineRenaming
    ? { role: 'group' }
    : { type: 'button', onClick: onOpen || app.onOpen };
  const commitRename = useCallback(() => {
    if (!inlineRenaming) return;
    onRenameCommit?.(renameValue);
  }, [inlineRenaming, onRenameCommit, renameValue]);
  const handleRenameKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRename();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onRenameCancel?.();
    }
  }, [commitRename, onRenameCancel]);
  const handleRootMouseDown = useCallback((event) => {
    if (event.button !== 2 || !onContextMenu) return;
    onContextMenu(event);
  }, [onContextMenu]);

  useEffect(() => {
    if (!inlineRenaming) return;
    const frameId = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [inlineRenaming]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || !onContextMenu) return undefined;
    const handleNativeContextTrigger = (event) => {
      if (event.type !== 'contextmenu' && event.button !== 2) return;
      onContextMenu(event);
    };
    node.addEventListener('pointerdown', handleNativeContextTrigger);
    node.addEventListener('contextmenu', handleNativeContextTrigger);
    return () => {
      node.removeEventListener('pointerdown', handleNativeContextTrigger);
      node.removeEventListener('contextmenu', handleNativeContextTrigger);
    };
  }, [onContextMenu]);

  return (
    <RootElement
      ref={rootRef}
      {...rootProps}
      className={className}
      {...(pinned ? { 'data-taskbar-app-id': app.id } : { 'data-desktop-app-id': app.id })}
      style={Object.keys(buttonStyle).length ? buttonStyle : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onMouseDown={handleRootMouseDown}
      onContextMenu={onContextMenu}
      title={app.title || label}
      aria-label={label}
    >
      <span className={iconClassName}>
        {usesFolderPreviewStack ? (
          <span className="desktop-app__folder-stack" aria-hidden="true">
            <img className="desktop-app__folder-stack-layer desktop-app__folder-stack-layer--back" src={DESKTOP_APP_ICONS.createdFolderFilledBack} alt="" draggable="false" />
            <span className="desktop-app__folder-preview">
              {folderPreviewIconImage
                ? <img src={folderPreviewIconImage} alt="" draggable="false" />
                : <FolderPreviewIcon size={18} strokeWidth={2} />}
            </span>
            <img className="desktop-app__folder-stack-layer desktop-app__folder-stack-layer--front" src={DESKTOP_APP_ICONS.createdFolderFilledFront} alt="" draggable="false" />
          </span>
        ) : (
          iconImage
            ? <img className="desktop-app__icon-image" src={iconImage} alt="" draggable="false" />
            : <Icon size={pinned ? 22 : 34} strokeWidth={app.kind === 'folder' ? 1.8 : 2} />
        )}
        {!pinned && !iconImage && app.shortcut !== false && <span className="desktop-app__shortcut" aria-hidden="true">↗</span>}
        {app.badge ? <span className="desktop-app__badge">{app.badge}</span> : null}
      </span>
      {!pinned && (
        inlineRenaming ? (
          <input
            ref={renameInputRef}
            className="desktop-app__rename-input"
            value={renameValue}
            onChange={(event) => onRenameChange?.(event.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="Rename"
            spellCheck="false"
          />
        ) : (
          <span className="desktop-app__label">{label}</span>
        )
      )}
    </RootElement>
  );
}

function DesktopFolderAppTile({
  app,
  lang,
  viewMode = 'icons',
  selected = false,
  modifiedLabel,
  onSelect,
  onOpen,
  onMoveToDesktop,
}) {
  const Icon = app.icon || Folder;
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [dragState, setDragState] = useState(null);
  const typeLabel = lang === 'en' ? 'App shortcut' : '应用快捷方式';
  const sizeLabel = lang === 'en' ? '1 KB' : '1 KB';
  const renderIcon = (size = 24) => (
    app.iconImage
      ? <img src={app.iconImage} alt="" draggable="false" />
      : <Icon size={size} strokeWidth={2} />
  );
  const handlePointerDown = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      dy: 0,
      moved: false,
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);
  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(dx, dy) > 5;
    drag.dx = dx;
    drag.dy = dy;
    drag.moved = moved;
    if (!moved) return;
    event.preventDefault();
    setDragState({
      dx,
      dy,
      rect: drag.rect,
    });
  }, []);
  const finishPointerDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragState(null);
    if (!drag.moved || event.type === 'pointercancel') return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    const folderWindow = event.currentTarget.closest('.desktop-folder-window');
    const rect = folderWindow?.getBoundingClientRect?.();
    const outsideFolderWindow = !rect
      || event.clientX < rect.left
      || event.clientX > rect.right
      || event.clientY < rect.top
      || event.clientY > rect.bottom;
    if (outsideFolderWindow) {
      onMoveToDesktop?.(app.id, { x: event.clientX, y: event.clientY });
    }
  }, [app.id, onMoveToDesktop]);
  const handleSelect = useCallback((event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    onSelect?.(app.id);
  }, [app.id, onSelect]);
  const handleOpen = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(app.id);
    onOpen?.();
  }, [app.id, onOpen, onSelect]);
  const handleKeyDown = useCallback((event) => {
    if (event.key !== 'Enter') return;
    handleOpen(event);
  }, [handleOpen]);

  return (
    <div
      className={`desktop-folder-app-tile ${dragState ? 'is-dragging' : ''} ${selected ? 'is-selected' : ''}`}
      data-folder-app-id={app.id}
      data-folder-view-mode={viewMode}
    >
      <button
        type="button"
        className="desktop-folder-app-tile__open"
        onClick={handleSelect}
        onDoubleClick={handleOpen}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        title={app.title || app.label}
        aria-label={app.label}
      >
        <span className="desktop-folder-app-tile__primary">
          <span className="desktop-folder-app-tile__icon">
            {renderIcon()}
          </span>
          <span className="desktop-folder-app-tile__name">{app.label}</span>
        </span>
        {viewMode === 'details' && (
          <>
            <span className="desktop-folder-app-tile__date">{modifiedLabel}</span>
            <span className="desktop-folder-app-tile__type">{typeLabel}</span>
            <span className="desktop-folder-app-tile__size">{sizeLabel}</span>
          </>
        )}
      </button>
      {dragState && createPortal(
        <div
          className="desktop-folder-app-drag-ghost"
          style={{
            left: `${dragState.rect.left}px`,
            top: `${dragState.rect.top}px`,
            width: `${dragState.rect.width}px`,
            height: `${dragState.rect.height}px`,
            transform: `translate3d(${dragState.dx}px, ${dragState.dy}px, 0)`,
          }}
          aria-hidden="true"
        >
          <span className="desktop-folder-app-tile__primary">
            <span className="desktop-folder-app-tile__icon">
              {renderIcon()}
            </span>
            <span className="desktop-folder-app-tile__name">{app.label}</span>
          </span>
        </div>,
        document.body
      )}
    </div>
  );
}

export default DesktopAppButton;
