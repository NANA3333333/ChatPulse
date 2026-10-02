import { connectRealtime } from "../shared/realtime/connection";
import { dispatchRealtimeEvent } from "./realtimeEvents";
import { useEffect, useMemo } from 'react';

export function useConnection(dependencies) {
const { WS_URL, buildCityNotificationItem, cityRefreshRef, contactsRefreshRef, dispatchReplyUpdate, fetchContacts, isBrowserTabVisible, pushDesktopEventNotification, removeDeletedContact, scheduleContactsRefresh, setContacts, setEngineState, setGeneratingSchedules, setGlobalAnnouncement, setGroupTyping, setIncomingGroupMessageQueue, setIncomingMessageQueue, setRedpacketClaimEvent, setUserProfile, token } = dependencies;
const eventContext = useMemo(() => ({ buildCityNotificationItem, cityRefreshRef, dispatchReplyUpdate, fetchContacts, isBrowserTabVisible, pushDesktopEventNotification, removeDeletedContact, scheduleContactsRefresh, setContacts, setEngineState, setGeneratingSchedules, setGlobalAnnouncement, setGroupTyping, setIncomingGroupMessageQueue, setIncomingMessageQueue, setRedpacketClaimEvent, setUserProfile }), [buildCityNotificationItem, cityRefreshRef, dispatchReplyUpdate, fetchContacts, isBrowserTabVisible, pushDesktopEventNotification, removeDeletedContact, scheduleContactsRefresh, setContacts, setEngineState, setGeneratingSchedules, setGlobalAnnouncement, setGroupTyping, setIncomingGroupMessageQueue, setIncomingMessageQueue, setRedpacketClaimEvent, setUserProfile]);
useEffect(() => {
    if (!token) return;
    const disconnect = connectRealtime({
      url: WS_URL, token: token,
      onMessage: message => dispatchRealtimeEvent(message, eventContext),
      onReconnect: () => {
        window.dispatchEvent(new Event('ws_reconnected'));
        scheduleContactsRefresh(100);
      }
    });
    return () => {
      disconnect();
      if (contactsRefreshRef.current) {
        clearTimeout(contactsRefreshRef.current);
        contactsRefreshRef.current = null;
      }
      if (cityRefreshRef.current) {
        clearTimeout(cityRefreshRef.current);
        cityRefreshRef.current = null;
      }

    };
  }, [WS_URL, token, eventContext, scheduleContactsRefresh, contactsRefreshRef, cityRefreshRef]);
    return {  };
}
