import React, { Suspense } from 'react';

export function ApplicationView(dependencies) {
return (
    <div style={dependencies.activeBrowserWindowStyle} className={`app-container tab-${dependencies.activeTab} ${dependencies.browserWindowMaximized ? 'is-window-maximized' : 'is-window-floating'} ${dependencies.activeBrowserWindowLayoutClasses} ${dependencies.browserWindowInteractionMode ? `is-window-${dependencies.browserWindowInteractionMode}` : ''} ${dependencies.browserWindowGeometrySwitchingWindowId === dependencies.activeBrowserWindowId ? 'is-window-geometry-switching' : ''} ${dependencies.browserWindowRecallPulse?.windowId === dependencies.activeBrowserWindowId ? 'is-window-recall-pulse' : ''} ${dependencies.browserWindowMergeTargetId && dependencies.browserWindowMergeTargetId === dependencies.activeBrowserWindowId ? 'is-window-merge-target' : ''} ${dependencies.shouldShowSocialWindowLoading ? 'is-social-window-loading' : ''} ${dependencies.activeContactId || dependencies.activeGroupId ? 'has-active-chat' : 'no-active-chat'} ${dependencies.isViewingList ? 'viewing-list' : 'viewing-content'} ${dependencies.hasPixelSkinView ? 'has-chat-skin has-private-chat' : ''} ${dependencies.isPrivateChatView ? 'is-private-chat-scene' : ''} ${dependencies.isContactsSceneView ? 'is-contacts-scene' : ''} ${dependencies.isStaticPixelSceneView ? 'is-static-pixel-scene' : ''} ${dependencies.isBarePixelSceneView ? 'is-bare-pixel-scene' : ''} ${dependencies.activeGroupId && dependencies.activeTab === 'chats' ? 'is-group-chat-scene' : ''} ${dependencies.hasForegroundSceneView ? 'is-foreground-enabled' : 'is-foreground-disabled'} ${dependencies.isForegroundExitingSceneView ? 'is-foreground-exiting' : ''} ${dependencies.isForegroundLayoutLifted ? 'is-foreground-lifted' : ''} ${dependencies.privateChatDecorEditorOpen ? 'is-decor-editing' : ''}`}>
      {dependencies.globalAnnouncement && (
        <div style={{ position: 'absolute', top: 0, left: '70px', right: 0, zIndex: 9999, background: 'var(--primary, #07c160)', color: 'white', padding: '10px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 'bold' }}>📢</span>
          <span>{dependencies.globalAnnouncement}</span>
          <button onClick={() => dependencies.setGlobalAnnouncement(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', marginLeft: 'auto', fontSize: '20px', padding: '0 5px' }}>&times;</button>
        </div>
      )}
      {dependencies.activeTab !== 'desktop' && dependencies.appWallpaperImageSrc && (
        <div className="desktop-wallpaper-backdrop" aria-hidden="true">
          <dependencies.Live2DDesktopWallpaper
            src={dependencies.appWallpaperImageSrc}
            animated={dependencies.appWallpaperAnimated && dependencies.activeTab !== 'commercial_street' && dependencies.activeTab !== 'pixel_cottage'}
          />
        </div>
      )}
      {dependencies.activeTab !== 'desktop' && !dependencies.browserWindowMaximized && (
        <div className="desktop-home-underlay" aria-hidden="true">
          <dependencies.ChatPulseDesktop
            lang={dependencies.lang}
            apps={dependencies.desktopApps}
            desktopWallpaper={dependencies.desktopWallpaper}
            onDesktopWallpaperChange={dependencies.handleDesktopWallpaperChange}
            showWallpaper={false}
          />
        </div>
      )}
      {dependencies.shouldRenderForegroundScene && (
        dependencies.renderPrivateChatForegroundScene({ includeEditor: true })
      )}
      {dependencies.activeTab !== 'desktop' && !dependencies.browserWindowMaximized && dependencies.browserWindows
        .filter(windowItem => !windowItem.minimized && windowItem.id !== dependencies.activeBrowserWindowId)
        .map((windowItem, index) => {
          const liveTabs = dependencies.getBrowserWindowTabs(windowItem);
          const liveAddress = dependencies.getBrowserWindowAddress(windowItem.activeTab);
          const liveIsMaximized = Boolean(windowItem.maximized);
          const liveLayoutClasses = dependencies.getBrowserWindowLayoutClasses(windowItem, liveIsMaximized);
          const liveSocialState = dependencies.normalizeBrowserWindowSocialState(windowItem.social || {});
          const liveHasActiveChat = windowItem.activeTab === 'chats'
            && (liveSocialState.activeContactId || liveSocialState.activeGroupId);
          const liveHasPixelSkin = windowItem.activeTab === 'chats';
          const liveIsPrivateChat = windowItem.activeTab === 'chats' && !!liveSocialState.activeContactId;
          const liveIsGroupChat = windowItem.activeTab === 'chats' && !!liveSocialState.activeGroupId;
          const liveIsSocialLoading = windowItem.activeTab === 'chats' && !dependencies.contactsLoaded && !dependencies.contactsLoadError;
          const liveHasForegroundScene = (liveIsPrivateChat || liveIsGroupChat) && dependencies.privateChatForegroundEnabled && !liveIsSocialLoading;
          const liveIsForegroundLayoutLifted = liveHasForegroundScene && !(liveIsGroupChat && liveIsMaximized);
          const liveIsStaticPixel = windowItem.activeTab === 'memory_library'
            || windowItem.activeTab === 'mcp_lab'
            || windowItem.activeTab === 'settings'
            || windowItem.activeTab === 'housing_social';
          const liveIsBarePixel = windowItem.activeTab === 'commercial_street'
            || windowItem.activeTab === 'pixel_cottage'
            || windowItem.activeTab === 'city';
          const liveSurfaceClasses = [
            liveHasActiveChat ? 'has-active-chat viewing-content' : 'no-active-chat viewing-list',
            liveIsSocialLoading ? 'is-social-window-loading' : '',
            liveHasPixelSkin ? 'has-chat-skin has-private-chat' : '',
            liveIsPrivateChat ? 'is-private-chat-scene' : '',
            liveIsGroupChat ? 'is-group-chat-scene' : '',
            liveIsStaticPixel ? 'is-static-pixel-scene' : '',
            liveIsBarePixel ? 'is-bare-pixel-scene' : '',
            liveHasForegroundScene ? `is-foreground-enabled ${liveIsForegroundLayoutLifted ? 'is-foreground-lifted' : ''}` : 'is-foreground-disabled',
          ].filter(Boolean).join(' ');
          return (
            <div
              key={`live-window-${windowItem.id}`}
              className={`desktop-browser-live-window app-container tab-${windowItem.activeTab} ${liveIsMaximized ? 'is-window-maximized' : 'is-window-floating'} ${liveLayoutClasses} ${liveSurfaceClasses} ${dependencies.browserWindowGeometrySwitchingWindowId === windowItem.id ? 'is-window-geometry-switching' : ''} ${dependencies.browserWindowMergeTargetId === windowItem.id ? 'is-window-merge-target' : ''} ${dependencies.browserWindowInteractionRef.current?.windowId === windowItem.id ? 'is-interacting' : ''}`}
              data-browser-window-id={windowItem.id}
              style={dependencies.getBrowserWindowStackStyle(windowItem, index)}
              onClickCapture={(event) => {
                if (dependencies.suppressBrowserWindowClickRef.current === windowItem.id) return;
                const target = event.target instanceof Element ? event.target : null;
                if (target?.closest('.desktop-window-control, .desktop-browser-resize-handle, .desktop-browser-tab, .desktop-browser-tab-add, .desktop-browser-icon-button, .desktop-browser-address')) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                dependencies.focusBrowserWindowTab(windowItem.id, windowItem.activeTab, windowItem.activeTabIndex);
              }}
            >
              {liveHasForegroundScene && dependencies.renderPrivateChatForegroundScene()}
              <div
                className="desktop-browser-chrome desktop-browser-chrome--live"
                role="navigation"
                aria-label={dependencies.lang === 'en' ? 'Background desktop navigation' : '后台窗口导航'}
                onPointerDown={(event) => dependencies.startBrowserWindowDrag(event, windowItem.id)}
                onPointerMove={dependencies.handleBrowserWindowPointerMove}
                onPointerUp={dependencies.stopBrowserWindowInteraction}
                onPointerCancel={dependencies.stopBrowserWindowInteraction}
              >
                <div className="desktop-browser-tabs">
                  {liveTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`desktop-browser-tab ${tab.active ? 'is-active' : ''}`}
                      title={tab.title}
                      aria-label={tab.title}
                      onPointerDown={(event) => dependencies.startBrowserTabDrag(event, tab.id, windowItem.id, tab.index)}
                      onPointerMove={dependencies.handleBrowserWindowPointerMove}
                      onPointerUp={dependencies.stopBrowserWindowInteraction}
                      onPointerCancel={dependencies.stopBrowserWindowInteraction}
                      onClick={(event) => {
                        if (dependencies.suppressBrowserWindowClickRef.current === windowItem.id) {
                          event.preventDefault();
                          return;
                        }
                        dependencies.focusBrowserWindowTab(windowItem.id, tab.id, tab.index);
                      }}
                    >
                      <span className="desktop-browser-tab__mark">{tab.mark}</span>
                      <span className="desktop-browser-tab__title">{tab.title}</span>
                      <dependencies.X className="desktop-browser-tab__close" size={14} strokeWidth={2.2} />
                    </button>
                  ))}
                  <button type="button" className="desktop-browser-tab-add" aria-hidden="true" tabIndex={-1}>+</button>
                  <span className="desktop-window-drag-spacer" aria-hidden="true" />
                  <div className="desktop-window-controls" aria-label={dependencies.lang === 'en' ? 'Window controls' : '窗口控制'}>
                    <button
                      type="button"
                      className="desktop-window-control"
                      onClick={(event) => {
                        event.stopPropagation();
                        dependencies.minimizeBrowserWindow(windowItem.id);
                      }}
                      aria-label={dependencies.lang === 'en' ? 'Minimize to desktop' : '最小化到桌面'}
                      title={dependencies.lang === 'en' ? 'Minimize to desktop' : '最小化到桌面'}
                    >
                      <dependencies.Minus size={18} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      className="desktop-window-control"
                      onClick={(event) => {
                        event.stopPropagation();
                        dependencies.beginBrowserWindowGeometrySwitch(windowItem.id);
                        const nextMaximized = !windowItem.maximized;
                        dependencies.setBrowserWindows((currentWindows) => currentWindows.map((currentWindow) => (
                          currentWindow.id === windowItem.id
                            ? { ...currentWindow, maximized: nextMaximized, minimized: false }
                            : currentWindow
                        )));
                        dependencies.setActiveBrowserWindowId(windowItem.id);
                        dependencies.setBrowserWindowMaximized(nextMaximized);
                        dependencies.setActiveTab(windowItem.activeTab === 'desktop' ? 'chats' : windowItem.activeTab);
                      }}
                      aria-label={windowItem.maximized ? (dependencies.lang === 'en' ? 'Restore' : '还原') : (dependencies.lang === 'en' ? 'Maximize' : '最大化')}
                      title={windowItem.maximized ? (dependencies.lang === 'en' ? 'Restore' : '还原') : (dependencies.lang === 'en' ? 'Maximize' : '最大化')}
                    >
                      <dependencies.Square size={15} strokeWidth={1.9} />
                    </button>
                    <button
                      type="button"
                      className="desktop-window-control desktop-window-control--close"
                      onClick={(event) => {
                        event.stopPropagation();
                        dependencies.closeBrowserWindow(windowItem.id);
                      }}
                      aria-label={dependencies.lang === 'en' ? 'Close app window' : '关闭窗口'}
                      title={dependencies.lang === 'en' ? 'Close app window' : '关闭窗口'}
                    >
                      <dependencies.X size={21} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
                <div className="desktop-browser-toolbar">
                  <button
                    type="button"
                    className="desktop-browser-icon-button desktop-return-button"
                    onClick={() => dependencies.minimizeBrowserWindow(windowItem.id)}
                    aria-label={dependencies.lang === 'en' ? 'Back to desktop' : '返回桌面'}
                    title={dependencies.lang === 'en' ? 'Back to desktop' : '返回桌面'}
                  >
                    <dependencies.ArrowLeft size={22} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="desktop-browser-icon-button"
                    disabled
                    aria-label={dependencies.lang === 'en' ? 'Forward' : '前进'}
                    title={dependencies.lang === 'en' ? 'Forward' : '前进'}
                  >
                    <dependencies.ArrowRight size={22} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="desktop-browser-icon-button"
                    onClick={() => dependencies.focusBrowserWindowTab(windowItem.id, windowItem.activeTab, windowItem.activeTabIndex)}
                    aria-label={dependencies.lang === 'en' ? 'Reload' : '刷新'}
                    title={dependencies.lang === 'en' ? 'Reload' : '刷新'}
                  >
                    <dependencies.RefreshCw size={20} strokeWidth={2.2} />
                  </button>
                  <div className="desktop-browser-address" aria-label={liveAddress}>
                    <span className="desktop-browser-address__info">i</span>
                    <span>{liveAddress}</span>
                  </div>
                </div>
              </div>
              <div className="desktop-browser-live-window__content">
                <dependencies.AppErrorBoundary resetKey={`live-window:${windowItem.id}:${windowItem.activeTab}`} lang={dependencies.lang}>
                  <Suspense fallback={<dependencies.PanelFallback />}>
                    {windowItem.activeTab === 'chats'
                      ? dependencies.renderLiveSocialWindowContent(windowItem)
                      : dependencies.renderDesktopWindowContent(windowItem.activeTab, { surfaceKey: `live-${windowItem.id}-${windowItem.activeTab}`, isActive: false })}
                  </Suspense>
                </dependencies.AppErrorBoundary>
              </div>
            {['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'].map((direction) => (
              <button
                key={`shadow-resize-${windowItem.id}-${direction}`}
                type="button"
                className={`desktop-browser-resize-handle desktop-browser-resize-handle--shadow desktop-browser-resize-handle--${direction}`}
                onPointerDown={(event) => dependencies.startBrowserWindowResize(event, direction, windowItem.id)}
                onPointerMove={dependencies.handleBrowserWindowPointerMove}
                onPointerUp={dependencies.stopBrowserWindowInteraction}
                onPointerCancel={dependencies.stopBrowserWindowInteraction}
                aria-label={dependencies.lang === 'en' ? `Resize window ${direction}` : `缩放窗口 ${direction}`}
                title={dependencies.lang === 'en' ? 'Drag to resize window' : '拖动缩放窗口'}
              />
            ))}
            </div>
          );
        })}
      {dependencies.activeTab === 'desktop' ? (
        <dependencies.ChatPulseDesktop
          lang={dependencies.lang}
          apps={dependencies.desktopApps}
          desktopWallpaper={dependencies.desktopWallpaper}
          onDesktopWallpaperChange={dependencies.handleDesktopWallpaperChange}
        />
      ) : (
        <>
          {dependencies.browserWindowRecallPulse?.windowId === dependencies.activeBrowserWindowId && (
            <div
              key={dependencies.browserWindowRecallPulse.token}
              className="desktop-window-recall-hint"
              aria-hidden="true"
            >
              <span className="desktop-window-recall-hint__pill">
                <dependencies.RefreshCw size={15} strokeWidth={2.2} />
                <span>{dependencies.lang === 'en' ? 'Already open' : '已打开'}</span>
              </span>
            </div>
          )}
          {dependencies.browserTabDragPreview?.moved && (
            <div
              className="desktop-tab-drag-ghost"
              style={{
                '--tab-drag-x': `${dependencies.browserTabDragPreview.x}px`,
                '--tab-drag-y': `${dependencies.browserTabDragPreview.y}px`,
              }}
              aria-hidden="true"
            >
              <span className="desktop-browser-tab__mark">{dependencies.browserTabDragPreview.mark}</span>
              <span className="desktop-browser-tab__title">{dependencies.browserTabDragPreview.title}</span>
            </div>
          )}
          <div className={`desktop-browser-chrome ${dependencies.browserWindowMaximized ? 'is-maximized' : ''}`} role="navigation" aria-label={dependencies.lang === 'en' ? 'Desktop navigation' : '桌面导航'}
            onPointerDown={dependencies.startBrowserWindowDrag}
            onPointerMove={dependencies.handleBrowserWindowPointerMove}
            onPointerUp={dependencies.stopBrowserWindowInteraction}
            onPointerCancel={dependencies.stopBrowserWindowInteraction}>
            <div className="desktop-browser-tabs">
              {dependencies.browserTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`desktop-browser-tab ${tab.active ? 'is-active' : ''}`}
                  title={tab.title}
                  aria-label={tab.title}
                  onPointerDown={(event) => dependencies.startBrowserTabDrag(event, tab.id, dependencies.activeBrowserWindowId, tab.index)}
                  onPointerMove={dependencies.handleBrowserWindowPointerMove}
                  onPointerUp={dependencies.stopBrowserWindowInteraction}
                  onPointerCancel={dependencies.stopBrowserWindowInteraction}
                  onClick={(event) => {
                    if (dependencies.suppressBrowserWindowClickRef.current === dependencies.activeBrowserWindowId) {
                      event.preventDefault();
                      return;
                    }
                    dependencies.activateBrowserTab(tab.id, tab.index);
                  }}
                >
                  <span className="desktop-browser-tab__mark">{tab.mark}</span>
                  <span className="desktop-browser-tab__title">{tab.title}</span>
                  <dependencies.X className="desktop-browser-tab__close" size={14} strokeWidth={2.2} />
                </button>
              ))}
              <button type="button" className="desktop-browser-tab-add" aria-hidden="true" tabIndex={-1}>+</button>
              <span className="desktop-window-drag-spacer" aria-hidden="true" />
              <div className="desktop-window-controls" aria-label={dependencies.lang === 'en' ? 'Window controls' : '窗口控制'}>
                <button
                  type="button"
                  className="desktop-window-control"
                  onClick={() => dependencies.minimizeBrowserWindow()}
                  aria-label={dependencies.lang === 'en' ? 'Minimize to desktop' : '最小化到桌面'}
                  title={dependencies.lang === 'en' ? 'Minimize to desktop' : '最小化到桌面'}
                >
                  <dependencies.Minus size={18} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="desktop-window-control"
                  onClick={dependencies.toggleBrowserWindowMaximized}
                  aria-label={dependencies.browserWindowMaximized ? (dependencies.lang === 'en' ? 'Restore' : '还原') : (dependencies.lang === 'en' ? 'Maximize' : '最大化')}
                  title={dependencies.browserWindowMaximized ? (dependencies.lang === 'en' ? 'Restore' : '还原') : (dependencies.lang === 'en' ? 'Maximize' : '最大化')}
                >
                  <dependencies.Square size={15} strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  className="desktop-window-control desktop-window-control--close"
                  onClick={() => dependencies.closeBrowserWindow()}
                  aria-label={dependencies.lang === 'en' ? 'Close app window' : '关闭窗口'}
                  title={dependencies.lang === 'en' ? 'Close app window' : '关闭窗口'}
                >
                  <dependencies.X size={21} strokeWidth={1.8} />
                </button>
              </div>
            </div>
            <div className="desktop-browser-toolbar">
              <button
                type="button"
                className="desktop-browser-icon-button desktop-return-button"
                onClick={dependencies.openDesktop}
                aria-label={dependencies.lang === 'en' ? 'Back to desktop' : '返回桌面'}
                title={dependencies.lang === 'en' ? 'Back to desktop' : '返回桌面'}
              >
                <dependencies.ArrowLeft size={22} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="desktop-browser-icon-button"
                disabled
                aria-label={dependencies.lang === 'en' ? 'Forward' : '前进'}
                title={dependencies.lang === 'en' ? 'Forward' : '前进'}
              >
                <dependencies.ArrowRight size={22} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="desktop-browser-icon-button"
                onClick={() => window.location.reload()}
                aria-label={dependencies.lang === 'en' ? 'Reload' : '刷新'}
                title={dependencies.lang === 'en' ? 'Reload' : '刷新'}
              >
                <dependencies.RefreshCw size={20} strokeWidth={2.2} />
              </button>
              <div className="desktop-browser-address" aria-label={dependencies.activeDesktopAddress}>
                <span className="desktop-browser-address__info">i</span>
                <span>{dependencies.activeDesktopAddress}</span>
              </div>
            </div>
          </div>
          {!dependencies.browserWindowMaximized && (
            <>
              {['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'].map((direction) => (
                <button
                  key={`resize-${direction}`}
                  type="button"
                  className={`desktop-browser-resize-handle desktop-browser-resize-handle--${direction}`}
                  onPointerDown={(event) => dependencies.startBrowserWindowResize(event, direction)}
                  onPointerMove={dependencies.handleBrowserWindowPointerMove}
                  onPointerUp={dependencies.stopBrowserWindowInteraction}
                  onPointerCancel={dependencies.stopBrowserWindowInteraction}
                  aria-label={dependencies.lang === 'en' ? `Resize window ${direction}` : `缩放窗口 ${direction}`}
                  title={dependencies.lang === 'en' ? 'Drag to resize window' : '拖动缩放窗口'}
                />
              ))}
            </>
          )}
          {/* 1. Very Left Sidebar (Navigation) */}
          <nav className="sidebar-nav">
        <div className="sidebar-brand" aria-label="ChatPulse">
          <dependencies.MessageSquare size={22} />
          <span>ChatPulse</span>
        </div>
        <div className="my-avatar" onClick={() => dependencies.setActiveTab('settings')} style={{ cursor: 'pointer' }}>
          <dependencies.AvatarWithFrame
            size={40}
            frame={dependencies.effectiveUser?.avatar_frame}
            src={dependencies.resolveAvatarUrl(dependencies.effectiveUser?.avatar, dependencies.API_URL, dependencies.effectiveUser?.name || 'User')}
            fallbackSrc={dependencies.defaultAvatarUrl(dependencies.effectiveUser?.name || 'User')}
            alt="Me"
          />
        </div>
        <div className="nav-icons">
          <button className={`nav-icon ${dependencies.activeTab === 'chats' ? 'active' : ''}`} data-label={dependencies.lang === 'en' ? 'Chats' : '聊天'} onClick={() => dependencies.setActiveTab('chats')} title={dependencies.lang === 'en' ? 'Chats — View conversations' : '聊天 — 查看会话列表'}>
            <dependencies.MessageSquare size={24} />
          </button>
          <button className={`nav-icon ${dependencies.activeTab === 'memory_library' ? 'active' : ''}`} data-label={dependencies.lang === 'en' ? 'Memory' : '记忆库'} onClick={() => dependencies.setActiveTab('memory_library')} title={dependencies.lang === 'en' ? 'Memory Library — Classification and forgetting' : '记忆库 — 分类与遗忘曲线'}>
            <dependencies.LibraryBig size={24} />
          </button>
        </div>
        <div className="nav-icons-bottom">
          {dependencies.experimentalPlugins.map(Plugin => {
            const Icon = Plugin.icon;
            return (
              <button key={Plugin.id} className={`nav-icon ${dependencies.activeTab === Plugin.id ? 'active' : ''}`} data-label={dependencies.lang === 'en' ? Plugin.name_en : Plugin.name_zh} onClick={() => dependencies.setActiveTab(Plugin.id)} title={dependencies.lang === 'en' ? Plugin.name_en : Plugin.name_zh} style={dependencies.activeTab === Plugin.id ? undefined : { color: Plugin.color || 'inherit' }}>
                <Icon size={24} />
              </button>
            );
          })}
          <button className={`nav-icon ${dependencies.activeTab === 'settings' ? 'active' : ''}`} data-label={dependencies.lang === 'en' ? 'Settings' : '设置'} onClick={() => dependencies.setActiveTab('settings')} title={dependencies.lang === 'en' ? 'Settings — Global configuration' : '设置 — 全局设置'}>
            <dependencies.Settings size={24} />
          </button>
          {dependencies.regularPlugins.map(Plugin => {
            const Icon = Plugin.icon;
            return (
              <button key={Plugin.id} className={`nav-icon ${dependencies.activeTab === Plugin.id ? 'active' : ''}`} data-label={dependencies.lang === 'en' ? Plugin.name_en : Plugin.name_zh} onClick={() => dependencies.setActiveTab(Plugin.id)} title={dependencies.lang === 'en' ? Plugin.name_en : Plugin.name_zh} style={dependencies.activeTab === Plugin.id ? undefined : { color: Plugin.color || 'inherit' }}>
                <Icon size={24} />
              </button>
            );
          })}
          <button className="nav-icon" data-label={dependencies.lang === 'en' ? 'Logout' : '退出登录'} onClick={() => dependencies.logout(dependencies.API_URL)} title={dependencies.lang === 'en' ? 'Logout' : '退出登录'} style={{ color: '#ff4d4f' }}>
            <dependencies.LogOut size={24} />
          </button>
        </div>
          </nav>

          {/* 2. Middle Column (List) */}
          <div className="middle-column">
        {dependencies.activeTab === 'chats' && (
          <div className="middle-column-heading">
              <div className="private-chat-heading-actions">
              {dependencies.groupChatEnabled && <button type="button" onClick={() => dependencies.setShowCreateGroupModal(true)}
                aria-label={dependencies.lang === 'en' ? 'Create Group' : '创建群聊'} title={dependencies.lang === 'en' ? 'Create Group' : '创建群聊'}>
                <dependencies.UsersRound size={18} />
              </button>}
              <button
                type="button"
                className="private-chat-create-character-button"
                onClick={() => dependencies.openAddCharacterModal(true)}
                title={dependencies.lang === 'en' ? 'Create character and open chat' : '创建角色并进入私聊'}
                aria-label={dependencies.lang === 'en' ? 'Create character and open chat' : '创建角色并进入私聊'}
              >
                <dependencies.UserPlus size={18} />
              </button>
              <button
                type="button"
                className={`foreground-toggle ${dependencies.privateChatForegroundEnabled ? 'is-on' : 'is-off'}`}
                aria-label={dependencies.privateChatForegroundEnabled ? (dependencies.lang === 'en' ? 'Disable foreground' : '关闭前景') : (dependencies.lang === 'en' ? 'Enable foreground' : '开启前景')}
                aria-pressed={dependencies.privateChatForegroundEnabled}
                title={dependencies.privateChatForegroundEnabled ? (dependencies.lang === 'en' ? 'Disable foreground' : '关闭前景') : (dependencies.lang === 'en' ? 'Enable foreground' : '开启前景')}
                onClick={dependencies.handlePrivateChatForegroundToggle}
              >
                <span className="foreground-toggle__text">{dependencies.lang === 'en' ? 'FG' : '前景'}</span>
                <span className="foreground-toggle__track" aria-hidden="true">
                  <span className="foreground-toggle__thumb" />
                </span>
              </button>
            </div>
          </div>
        )}
        <div className="search-bar-container">
          <input
            type="text"
            className="search-bar"
            value={dependencies.chatSearch}
            onChange={(event) => dependencies.setChatSearch(event.target.value)}
            placeholder={dependencies.t('Search') || 'Search'}
          />
        </div>
        <div className="list-container">
          {dependencies.activeTab === 'chats' && (
            <>
              {dependencies.contactsLoadError && dependencies.contacts.length === 0 && (
                <div style={{ padding: '14px 16px', color: '#c0392b', fontSize: '12px', lineHeight: 1.5 }}>
                  Failed to load contacts: {dependencies.contactsLoadError}
                </div>
              )}
              <dependencies.ContactList
                apiUrl={dependencies.API_URL}
                contacts={dependencies.filteredContacts}
                activeId={dependencies.activeContactId}
                engineState={dependencies.engineState}
                onSelect={(id) => {
                  const selected = dependencies.contacts.find(c => c.id === id);
                  dependencies.setConversationJumpTarget(null);
                  dependencies.setActiveContactId(id);
                  if (selected) dependencies.setActiveContactSnapshot(selected);
                  dependencies.activeContactRef.current = id;
                  dependencies.setActiveGroupId(null);
                  dependencies.activeGroupRef.current = null;
                  // Clear unread badge
                  dependencies.setContacts(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
                }}
              />
            </>
          )}
          {dependencies.activeTab === 'chats' && dependencies.groupChatEnabled && dependencies.filteredGroups.length > 0 && (
            <div style={{ borderTop: '1px solid #eee' }}>
              <div style={{ padding: '5px 15px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                {dependencies.lang === 'en' ? 'Group Chats' : '群聊'}
              </div>
              {dependencies.filteredGroups.map(g => {
                const memberCount = g.members?.length || 0;
                const groupAvatarSize = memberCount <= 1 ? 58 : 46;
                const groupAvatarOverlap = memberCount <= 1 ? 0 : -18;
                const unreadCount = Number(dependencies.groupUnreadCounts[g.id]) || 0;

                return (
                <div
                  key={g.id}
                  className={`contact-item group-contact-item ${dependencies.activeGroupId === g.id ? 'active' : ''}`}
                  title={g.name}
                  aria-label={dependencies.lang === 'en' ? `${g.name}, group chat` : `${g.name}，群聊`}
                  onClick={() => {
                    dependencies.setConversationJumpTarget(null);
                    dependencies.setActiveGroupId(g.id);
                    dependencies.activeGroupRef.current = g.id;
                    dependencies.setActiveContactId(null);
                    dependencies.setActiveContactSnapshot(null);
                    dependencies.activeContactRef.current = null;
                    dependencies.setGroupUnreadCounts((current) => {
                      if (!current[g.id]) return current;
                      const next = { ...current };
                      delete next[g.id];
                      return next;
                    });
                  }}
                >
                  <div className="contact-avatar group-contact-avatar" style={{ width: 'auto', minWidth: '42px', height: '42px', display: 'flex', alignItems: 'center' }}>
                    {g.members?.slice(0, 4).map((memberObj, idx) => {
                      const memberId = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                      const member = dependencies.contacts.find(c => String(c.id) === String(memberId));
                      const memberName = memberId === 'user'
                        ? dependencies.userProfile?.name || 'User'
                        : member?.name || memberId || 'User';
                      const memberAvatar = memberId === 'user'
                        ? dependencies.resolveAvatarUrl(dependencies.userProfile?.avatar, dependencies.API_URL, memberName)
                        : dependencies.resolveAvatarUrl(member?.avatar, dependencies.API_URL, memberName);
                      const memberFrame = memberId === 'user' ? dependencies.userProfile?.avatar_frame : member?.avatar_frame;
                      return (
                        <dependencies.AvatarWithFrame
                          key={idx}
                          size={groupAvatarSize}
                          frame={memberFrame}
                          src={memberAvatar}
                          fallbackSrc={dependencies.defaultAvatarUrl(memberName)}
                          alt=""
                          style={{ marginLeft: idx > 0 ? `${groupAvatarOverlap}px` : '0', zIndex: 10 - idx }}
                          imageStyle={{ border: memberCount === 1 ? '1px solid rgba(255, 111, 151, 0.28)' : '2px solid #fff' }}
                        />
                      );
                    })}
                    {(!g.members || g.members.length === 0) && <div style={{ width: `${groupAvatarSize}px`, height: `${groupAvatarSize}px`, backgroundColor: '#e1e1e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><dependencies.UsersRound size={22} style={{ color: '#fff' }} /></div>}
                  </div>
                  <div className="group-contact-item__body">
                    <span className="group-contact-item__name">{g.name}</span>
                    <span className="group-contact-item__meta">{dependencies.lang === 'en' ? `${memberCount} members` : `${memberCount} 位成员`}</span>
                  </div>
                  {unreadCount > 0 && <span className="unread-badge">{dependencies.formatBadge(unreadCount)}</span>}
                </div>
                );
              })}
            </div>
          )}
          {dependencies.activeTab === 'chats' && dependencies.chatSearchNeedle && dependencies.filteredContacts.length === 0 && dependencies.filteredGroups.length === 0 && (
            <div className="empty-chat-state empty-chat-state--compact">
              <dependencies.Search size={28} className="empty-icon" />
              <p>{dependencies.lang === 'en' ? 'No conversations found' : '没有找到会话'}</p>
            </div>
          )}
          {dependencies.activeTab === 'contacts' && (
            <div className="contacts-page-shell">
              <div className="contacts-page-header">
                <div className="contacts-page-title">
                  <span>{dependencies.lang === 'en' ? 'Contacts' : '联系人'}</span>
                  <h2>{dependencies.lang === 'en' ? 'Address Book' : '通讯录'}</h2>
                </div>
                <button
                  type="button"
                  className="contacts-page-icon-button"
                  onClick={() => dependencies.openAddCharacterModal(false)}
                  title={dependencies.lang === 'en' ? 'Add new AI character' : '添加新的 AI 角色'}
                  aria-label={dependencies.lang === 'en' ? 'Add new AI character' : '添加新的 AI 角色'}
                >
                  <dependencies.UserPlus size={18} />
                </button>
              </div>

              <section className="contacts-page-section">
                <div className="contacts-page-section__head">
                  <span>{dependencies.lang === 'en' ? 'Private Contacts' : '私聊联系人'}</span>
                  <span className="contacts-page-count">{dependencies.contacts.length}</span>
                </div>
                <div className="contacts-page-grid">
                  {dependencies.contacts.map((c) => {
                    const isOnline = dependencies.hasPrimaryModelConfig(c);
                    const statusLabel = isOnline ? (dependencies.lang === 'en' ? 'Online' : '在线') : (dependencies.lang === 'en' ? 'Offline' : '离线');
                    const configLabel = isOnline
                      ? (c.model_name || c.model || (dependencies.lang === 'en' ? 'Ready' : '主 API 已配置'))
                      : (dependencies.lang === 'en' ? 'No primary API key' : '缺少主 API 有效 key');
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`contacts-page-card ${isOnline ? 'is-online' : 'is-offline'}`}
                        onClick={() => { dependencies.setActiveContactId(c.id); dependencies.setActiveContactSnapshot(c); dependencies.setActiveTab('chats'); }}
                      >
                        <span className="contacts-page-card__avatar">
                          <dependencies.AvatarWithFrame
                            size={52}
                            frame={c.avatar_frame}
                            src={dependencies.resolveAvatarUrl(c.avatar, dependencies.API_URL, c.name || c.id || 'User')}
                            fallbackSrc={dependencies.defaultAvatarUrl(c.name || c.id || 'User')}
                            alt={c.name}
                          />
                          <span className={`contacts-page-status-dot ${isOnline ? 'online' : 'offline'}`} />
                        </span>
                        <span className="contacts-page-card__body">
                          <span className="contacts-page-card__topline">
                            <span className="contacts-page-card__name">{c.name}</span>
                            <span className={`contacts-page-card__status ${isOnline ? 'online' : 'offline'}`}>{statusLabel}</span>
                          </span>
                          <span className="contacts-page-card__meta">{configLabel}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {dependencies.groupChatEnabled && (
                <section className="contacts-page-section contacts-page-section--groups">
                  <div className="contacts-page-section__head">
                    <span>{dependencies.lang === 'en' ? 'Group Chats' : '群聊'}</span>
                    <button
                      type="button"
                      className="contacts-page-small-action"
                      onClick={() => dependencies.setShowCreateGroupModal(true)}
                      title={dependencies.lang === 'en' ? 'Create Group' : '创建群聊'}
                      aria-label={dependencies.lang === 'en' ? 'Create Group' : '创建群聊'}
                    >
                      <dependencies.UsersRound size={16} />
                    </button>
                  </div>
                  <div className="contacts-page-grid">
                    {dependencies.groups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className="contacts-page-card contacts-page-card--group"
                        onClick={() => { dependencies.setActiveGroupId(g.id); dependencies.setActiveContactId(null); dependencies.setActiveContactSnapshot(null); dependencies.setActiveTab('chats'); }}
                      >
                        <span className="contacts-page-group-avatar">
                          {g.members?.slice(0, 3).map((memberObj, idx) => {
                            const memberId = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                            const member = dependencies.contacts.find(c => String(c.id) === String(memberId));
                            const memberName = memberId === 'user'
                              ? dependencies.userProfile?.name || 'User'
                              : member?.name || memberId || 'User';
                            const memberAvatar = memberId === 'user'
                              ? dependencies.resolveAvatarUrl(dependencies.userProfile?.avatar, dependencies.API_URL, memberName)
                              : dependencies.resolveAvatarUrl(member?.avatar, dependencies.API_URL, memberName);
                            const memberFrame = memberId === 'user' ? dependencies.userProfile?.avatar_frame : member?.avatar_frame;
                            return (
                              <dependencies.AvatarWithFrame
                                key={`${memberId}-${idx}`}
                                className="contacts-page-group-avatar__frame"
                                size={34}
                                frame={memberFrame}
                                src={memberAvatar}
                                fallbackSrc={dependencies.defaultAvatarUrl(memberName)}
                                alt=""
                                style={{ marginLeft: idx > 0 ? '-12px' : '0', zIndex: 10 - idx }}
                                imageClassName="contacts-page-group-avatar__image"
                              />
                            );
                          })}
                          {g.members?.length > 3 && (
                            <span className="contacts-page-group-avatar__more">+{g.members.length - 3}</span>
                          )}
                          {(!g.members || g.members.length === 0) && (
                            <span className="contacts-page-group-avatar__empty">
                              <dependencies.UsersRound size={20} />
                            </span>
                          )}
                        </span>
                        <span className="contacts-page-card__body">
                          <span className="contacts-page-card__topline">
                            <span className="contacts-page-card__name">{g.name}</span>
                            <span className="contacts-page-card__status online">{g.members?.length || 0}</span>
                          </span>
                          <span className="contacts-page-card__meta">{dependencies.lang === 'en' ? 'Tap to enter group chat' : '点击进入群聊'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          {dependencies.activeTab === 'settings' && (
            <div className="contact-item active">
              <dependencies.Settings size={24} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
              <div className="contact-info">
                <div className="contact-name">{dependencies.t('Settings')}</div>
              </div>
            </div>
          )}
          {dependencies.activeTab === 'memory_library' && (
            <div className="contact-item active">
              <dependencies.Database size={24} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
              <div className="contact-info">
                <div className="contact-name">{dependencies.lang === 'en' ? 'Memory Library' : '记忆库'}</div>
              </div>
            </div>
          )}
          {dependencies.activeTab === 'mcp_lab' && (
            <div className="contact-item active">
              <dependencies.Wifi size={24} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
              <div className="contact-info">
                <div className="contact-name">{dependencies.lang === 'en' ? 'MCP Lab' : 'MCP 实验室'}</div>
              </div>
            </div>
          )}
        </div>
          </div>



          {/* 3. Right Column (Chat Area / Content) — hidden on contacts tab */}
          {dependencies.activeTab !== 'contacts' && (
            <div className="right-column" style={{ flexDirection: 'row' }}>
          <dependencies.AppErrorBoundary resetKey={`content:${dependencies.activeTab}:${dependencies.activeContactId || ''}:${dependencies.activeGroupId || ''}`} lang={dependencies.lang}>
            <Suspense fallback={<dependencies.PanelFallback />}>
              {dependencies.activeContactId && dependencies.activeTab === 'chats' ? (
                <div className="private-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minWidth: 0 }}>
                  <div className="private-chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <dependencies.ChatWindow
                      contact={dependencies.activeChatContact}
                      allContacts={dependencies.contacts}
                      userAvatar={dependencies.effectiveUser?.avatar}
                      userAvatarFrame={dependencies.effectiveUser?.avatar_frame}
                      apiUrl={dependencies.API_URL}
                      incomingMessageQueue={dependencies.incomingMessageQueue}
                      engineState={dependencies.engineState}
                      onToggleMemo={() => dependencies.toggleChatDrawer('memo')}
                      onToggleDiary={() => dependencies.toggleChatDrawer('diary')}
                      onToggleSettings={() => dependencies.toggleChatDrawer('settings')}
                      onPreloadMemo={() => dependencies.preloadChatDrawer('memo')}
                      onPreloadDiary={() => dependencies.preloadChatDrawer('diary')}
                      onPreloadSettings={() => dependencies.preloadChatDrawer('settings')}
                      onBack={() => { dependencies.setActiveContactId(null); dependencies.setActiveContactSnapshot(null); dependencies.activeContactRef.current = null; dependencies.setConversationJumpTarget(null); }}
                      onSwitchTab={dependencies.setActiveTab}
                      isGeneratingSchedule={dependencies.generatingSchedules[dependencies.activeContactId]}
                      onMessagesChange={dependencies.setHiddenMessagesCount}
                      isPrivateChatForegroundEnabled={dependencies.isForegroundLayoutLifted}
                      chatLayoutKey={dependencies.activeDrawer || 'journal'}
                      jumpTarget={dependencies.conversationJumpTarget}
                      onSearchResultSelect={dependencies.handleConversationSearchResultSelect}
                      onJumpHandled={dependencies.clearConversationJumpTarget}
                    />
                  </div>
                  <div className="private-chat-side-slot" data-slot-view={dependencies.activeDrawer || 'journal'}>
                    {!dependencies.activeDrawer && (
                      <dependencies.PrivateChatJournalPanel
                        contact={dependencies.activeChatContact}
                        lang={dependencies.lang}
                        onOpenDiary={() => dependencies.toggleChatDrawer('diary')}
                      />
                    )}
                    {dependencies.activeDrawer === 'memo' && (
                      <dependencies.PrivateChatDrawerShell type="memo">
                        <dependencies.AppErrorBoundary
                          variant="drawer"
                          resetKey={`drawer:memo:${dependencies.activeChatContact?.id || ''}`}
                          lang={dependencies.lang}
                          title={`${dependencies.activeChatContact?.name || (dependencies.lang === 'en' ? 'Character' : '角色')} ${dependencies.lang === 'en' ? "'s Memories" : '的记忆'}`}
                          onClose={() => dependencies.setActiveDrawer(null)}
                        >
                          <Suspense fallback={<dependencies.DrawerFallback type="memo" contact={dependencies.activeChatContact} lang={dependencies.lang} onClose={() => dependencies.setActiveDrawer(null)} />}>
                            <dependencies.MemoTable
                              contact={dependencies.activeChatContact}
                              apiUrl={dependencies.API_URL}
                              onClose={() => dependencies.setActiveDrawer(null)}
                            />
                          </Suspense>
                        </dependencies.AppErrorBoundary>
                      </dependencies.PrivateChatDrawerShell>
                    )}
                    {dependencies.activeDrawer === 'diary' && (
                      <dependencies.PrivateChatDrawerShell type="diary">
                        <dependencies.AppErrorBoundary
                          variant="drawer"
                          resetKey={`drawer:diary:${dependencies.activeChatContact?.id || ''}`}
                          lang={dependencies.lang}
                          title={`${dependencies.activeChatContact?.name || (dependencies.lang === 'en' ? 'Character' : '角色')} ${dependencies.lang === 'en' ? "'s Diary" : '的日记'}`}
                          onClose={() => dependencies.setActiveDrawer(null)}
                        >
                          <Suspense fallback={<dependencies.DrawerFallback type="diary" contact={dependencies.activeChatContact} lang={dependencies.lang} onClose={() => dependencies.setActiveDrawer(null)} />}>
                            <dependencies.DiaryTable
                              contact={dependencies.activeChatContact}
                              apiUrl={dependencies.API_URL}
                              onClose={() => dependencies.setActiveDrawer(null)}
                            />
                          </Suspense>
                        </dependencies.AppErrorBoundary>
                      </dependencies.PrivateChatDrawerShell>
                    )}
                    {dependencies.activeDrawer === 'settings' && (
                      <dependencies.PrivateChatDrawerShell type="settings">
                        <dependencies.AppErrorBoundary
                          variant="drawer"
                          resetKey={`drawer:settings:${dependencies.activeChatContact?.id || ''}`}
                          lang={dependencies.lang}
                          title={dependencies.lang === 'en' ? 'Chat Settings' : '聊天设置'}
                          onClose={() => dependencies.setActiveDrawer(null)}
                        >
                          <Suspense fallback={<dependencies.DrawerFallback type="settings" contact={dependencies.activeChatContact} lang={dependencies.lang} onClose={() => dependencies.setActiveDrawer(null)} />}>
                            <dependencies.ChatSettingsDrawer
                              contact={dependencies.activeChatContact}
                              contacts={dependencies.contacts}
                              apiUrl={dependencies.API_URL}
                              onClose={() => dependencies.setActiveDrawer(null)}
                              onClearHistory={() => {
                                dependencies.setActiveDrawer(null);
                                dependencies.fetchContacts(); // Re-pull character data so stats show as reset immediately
                              }}
                              isGeneratingSchedule={!!dependencies.generatingSchedules[dependencies.activeContactId]}
                              messagesHideStateCount={dependencies.hiddenMessagesCount}
                            />
                          </Suspense>
                        </dependencies.AppErrorBoundary>
                      </dependencies.PrivateChatDrawerShell>
                    )}
                  </div>
                </div>
              ) : dependencies.activeGroupId && dependencies.activeTab === 'chats' ? (
                <div className="group-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minWidth: 0 }}>
                  <dependencies.GroupChatWindow
                    group={dependencies.groups.find(g => g.id === dependencies.activeGroupId)}
                    apiUrl={dependencies.API_URL}
                    allContacts={dependencies.contacts}
                    userProfile={dependencies.effectiveUser}
                    incomingGroupMessageQueue={dependencies.incomingGroupMessageQueue}
                    typingIndicators={dependencies.groupTyping[dependencies.activeGroupId] || []}
                    redpacketClaimEvent={dependencies.redpacketClaimEvent}
                    onBack={() => { dependencies.setActiveGroupId(null); dependencies.setActiveDrawer(null); dependencies.setConversationJumpTarget(null); }}
                    onGroupUpdated={dependencies.updateGroupInState}
                    isManageOpen={dependencies.activeDrawer === 'group-manage'}
                    onToggleManage={() => dependencies.toggleChatDrawer('group-manage')}
                    onCloseManage={() => dependencies.setActiveDrawer(null)}
                    isForegroundLayoutLifted={dependencies.isForegroundLayoutLifted}
                    jumpTarget={dependencies.conversationJumpTarget}
                    onSearchResultSelect={dependencies.handleConversationSearchResultSelect}
                    onJumpHandled={dependencies.clearConversationJumpTarget}
                  />
                  {dependencies.renderGroupSideSlot({
                    group: dependencies.activeGroup,
                    drawer: dependencies.activeDrawer,
                    onClose: () => dependencies.setActiveDrawer(null),
                  })}
                </div>
              ) : (
                dependencies.renderDesktopWindowContent(dependencies.activeTab, { surfaceKey: `active-${dependencies.activeTab}` })
              )}
            </Suspense>
          </dependencies.AppErrorBoundary>
            </div>
          )}
        </>
      )}

      <dependencies.DesktopTaskbar
        lang={dependencies.lang}
        apps={dependencies.desktopApps}
        pinnedApps={dependencies.pinnedDesktopApps}
        browserWindows={dependencies.browserWindowTaskbarItems}
        notificationItems={dependencies.desktopNotifications}
        toastItems={dependencies.desktopToastItems}
        onOpenDesktop={dependencies.openDesktop}
        onToggleBrowserWindow={dependencies.toggleBrowserWindowFromTaskbar}
        onToggleLanguage={dependencies.toggleLanguage}
        onDismissToast={dependencies.dismissDesktopToastNotification}
        token={dependencies.token}
        notificationBadgeCount={dependencies.socialUnreadCount}
        userLabel={dependencies.effectiveUser?.name || 'NA NA'}
      />



      {dependencies.showAddCharModal && (
        <Suspense fallback={null}>
          <dependencies.AddCharacterModal
            isOpen={dependencies.showAddCharModal}
            onClose={dependencies.closeAddCharacterModal}
            apiUrl={dependencies.API_URL}
            onAdd={dependencies.handleCharacterAdded}
          />
        </Suspense>
      )}

      {dependencies.groupChatEnabled && dependencies.showCreateGroupModal && (
        <Suspense fallback={null}>
          <dependencies.CreateGroupModal
            apiUrl={dependencies.API_URL}
            contacts={dependencies.contacts}
            onClose={() => dependencies.setShowCreateGroupModal(false)}
            onCreate={(group) => {
              dependencies.setGroups(prev => [group, ...prev]);
              dependencies.setShowCreateGroupModal(false);
              dependencies.setActiveGroupId(group.id);
              dependencies.setActiveContactId(null);
              dependencies.setActiveTab('chats');
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
