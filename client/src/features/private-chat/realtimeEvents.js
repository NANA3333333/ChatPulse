// Feature-owned reactions to server events. State setters are supplied by the app.
export function handleEvent(message, dependencies) {
    const msg = message;
    switch (msg.type) {
        case "new_message": {

            dependencies.setIncomingMessageQueue(prev => [...prev, msg.data]);
            dependencies.scheduleContactsRefresh();
          
            return true;
        }
        case "private_reply_updated": {

            dependencies.dispatchReplyUpdate(msg.data, 'websocket');
          
            return true;
        }
        case "engine_state": {

            dependencies.setEngineState(msg.data);
          
            return true;
        }
        default: return false;
    }
}
