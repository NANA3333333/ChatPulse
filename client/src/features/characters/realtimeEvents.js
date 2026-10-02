// Feature-owned reactions to server events. State setters are supplied by the app.
export function handleEvent(message, dependencies) {
    const msg = message;
    switch (msg.type) {
        case "refresh_contacts": {

            window.dispatchEvent(new Event('refresh_contacts'));
            dependencies.scheduleContactsRefresh(100);
          
            return true;
        }
        case "character_deleted": {

            dependencies.removeDeletedContact(msg.characterId || msg.data?.characterId);
            window.dispatchEvent(new CustomEvent('character_deleted', {
              detail: { characterId: msg.characterId || msg.data?.characterId }
            }));
            dependencies.scheduleContactsRefresh(100);
          
            return true;
        }
        default: return false;
    }
}
