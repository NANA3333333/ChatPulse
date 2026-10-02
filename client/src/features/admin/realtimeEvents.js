// Feature-owned reactions to server events. State setters are supplied by the app.
export function handleEvent(message, dependencies) {
    const msg = message;
    switch (msg.type) {
        case "announcement": {

            dependencies.setGlobalAnnouncement(msg.content);
          
            return true;
        }
        case "force_reload": {

            console.log('[WS] Force reload requested by server...');
            setTimeout(() => window.location.reload(), 500);
          
            return true;
        }
        default: return false;
    }
}
