// Feature-owned reactions to server events. State setters are supplied by the app.
export function handleEvent(message) {
    const msg = message;
    switch (msg.type) {
        case "memory_update": {

            console.log('[WS] Memory update received for character:', msg.characterId);
            window.dispatchEvent(new CustomEvent('memory_update', { detail: { characterId: msg.characterId } }));
          
            return true;
        }
        case "memory_maintenance_progress": {

            window.dispatchEvent(new CustomEvent('memory_maintenance_progress', { detail: msg.data || {} }));
          
            return true;
        }
        default: return false;
    }
}
