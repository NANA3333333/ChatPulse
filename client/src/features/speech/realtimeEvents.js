// Feature-owned reactions to server events. State setters are supplied by the app.
export function handleEvent(message) {
    const msg = message;
    switch (msg.type) {
        case "tts_ready": {

            window.dispatchEvent(new CustomEvent('tts_ready', { detail: msg.data }));
          
            return true;
        }
        default: return false;
    }
}
