// Feature-owned reactions to server events. State setters are supplied by the app.
export function handleEvent(message, dependencies) {
    const msg = message;
    switch (msg.type) {
        case "city_update": {

            window.dispatchEvent(new CustomEvent('city_update', { detail: msg }));
            dependencies.scheduleContactsRefresh();
            const cityNotification = dependencies.buildCityNotificationItem(msg);
            if (cityNotification) {
              const isCitySurfaceVisible = dependencies.isBrowserTabVisible('city')
                || dependencies.isBrowserTabVisible('commercial_street')
                || dependencies.isBrowserTabVisible('housing_social');
              dependencies.pushDesktopEventNotification(cityNotification, {
                toast: !isCitySurfaceVisible,
                sound: false,
              });
            }
            if (!dependencies.cityRefreshRef.current) {
              dependencies.cityRefreshRef.current = setTimeout(() => {
                dependencies.cityRefreshRef.current = null;
                dependencies.fetchContacts();
              }, 1200);
            }
            if (msg.action === 'schedule_generating') {
              dependencies.setGeneratingSchedules(prev => ({ ...prev, [msg.charId]: true }));
            } else if (msg.action === 'schedule_updated') {
              dependencies.setGeneratingSchedules(prev => ({ ...prev, [msg.charId]: false }));
            }
          
            return true;
        }
        default: return false;
    }
}
