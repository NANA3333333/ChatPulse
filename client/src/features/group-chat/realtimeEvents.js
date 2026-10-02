// Feature-owned reactions to server events. State setters are supplied by the app.
export function handleEvent(message, dependencies) {
    const msg = message;
    switch (msg.type) {
        case "group_message": {

            dependencies.setIncomingGroupMessageQueue(prev => [...prev, msg.data]);
            dependencies.scheduleContactsRefresh();
          
            return true;
        }
        case "group_typing": {

            dependencies.setGroupTyping(prev => {
              const key = msg.data.group_id;
              const current = prev[key] || [];
              if (current.find(t => t.sender_id === msg.data.sender_id)) return prev;
              return { ...prev, [key]: [...current, msg.data] };
            });
          
            return true;
        }
        case "group_typing_stop": {

            dependencies.setGroupTyping(prev => {
              const key = msg.data.group_id;
              return { ...prev, [key]: (prev[key] || []).filter(t => t.sender_id !== msg.data.sender_id) };
            });
          
            return true;
        }
        default: return false;
    }
}
