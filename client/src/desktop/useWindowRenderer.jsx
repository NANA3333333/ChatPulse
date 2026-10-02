import { useCallback } from 'react';

export function useWindowRenderer(dependencies) {
const { API_URL, DESKTOP_WALLPAPER_OPTIONS, MemoryLibraryPanel, MessageSquare, PanelFallback, SettingsPanel, contacts, desktopWallpaper, effectiveUser, fetchContacts, getDesktopAppSurfaceClass, handleDesktopWallpaperChange, removeDeletedContact, setActiveTab, setUserProfile, visiblePlugins } = dependencies;
const renderDesktopWindowContent = useCallback((tab, options = {}) => {
    const surfaceKey = options.surfaceKey || tab;
    const Plugin = visiblePlugins.find(p => p.id === tab);

    if (tab === 'chats') {
      return (
        <div
          key={`social-loading-${surfaceKey}`}
          className={`${getDesktopAppSurfaceClass('chats')} desktop-app-surface--social-loading`}
          data-desktop-app-tab="chats"
        >
          <PanelFallback />
        </div>
      );
    }

    if (Plugin) {
      const PluginComponent = Plugin.component;
      return (
        <div
          key={`plugin-surface-${surfaceKey}`}
          className={getDesktopAppSurfaceClass(tab)}
          data-desktop-app-tab={tab}
        >
          <PluginComponent
            apiUrl={API_URL}
            userProfile={effectiveUser}
            isActive={options.isActive !== false}
          />
        </div>
      );
    }

    if (tab === 'settings') {
      return (
        <div
          key={`settings-surface-${surfaceKey}`}
          className={getDesktopAppSurfaceClass('settings')}
          data-desktop-app-tab="settings"
        >
          <SettingsPanel
            apiUrl={API_URL}
            contacts={contacts}
            desktopWallpaper={desktopWallpaper}
            wallpaperOptions={DESKTOP_WALLPAPER_OPTIONS}
            onDesktopWallpaperChange={handleDesktopWallpaperChange}
            onCharactersUpdate={(event) => {
              if (event?.type === 'deleted') {
                removeDeletedContact(event.id);
              }
              fetchContacts();
            }}
            onProfileUpdate={setUserProfile}
            onBack={() => setActiveTab('chats')}
          />
        </div>
      );
    }

    if (tab === 'memory_library') {
      return (
        <div
          key={`memory-library-surface-${surfaceKey}`}
          className={getDesktopAppSurfaceClass('memory_library')}
          data-desktop-app-tab="memory_library"
        >
          <MemoryLibraryPanel apiUrl={API_URL} contacts={contacts} />
        </div>
      );
    }

    return (
      <div className="empty-chat-state">
        <MessageSquare size={64} className="empty-icon" />
        <p>ChatPulse</p>
      </div>
    );
  }, [API_URL, DESKTOP_WALLPAPER_OPTIONS, contacts, desktopWallpaper, effectiveUser, fetchContacts, getDesktopAppSurfaceClass, handleDesktopWallpaperChange, removeDeletedContact, setActiveTab, setUserProfile, visiblePlugins]);
    return { renderDesktopWindowContent };
}
