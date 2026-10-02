import { useEffect } from 'react';

export function useIncomingMessages(dependencies) {
const { API_URL, DESKTOP_APP_ICONS, MessageSquare, contactsRef, defaultAvatarUrl, getDesktopNotificationPreview, incomingMessageQueue, isPrivateConversationVisible, langRef, processedMessagesRef, pushDesktopEventNotification, resolveAvatarUrl, setContacts } = dependencies;
useEffect(() => {
    if (!incomingMessageQueue.length) return;

    const freshMessages = [];
    incomingMessageQueue.forEach((incomingMsg) => {
      if (!incomingMsg) return;
      const messageKey = incomingMsg.id
        ? `private:${incomingMsg.id}`
        : `private:${incomingMsg.character_id || 'unknown'}:${incomingMsg.timestamp || ''}:${incomingMsg.content || ''}`;
      if (processedMessagesRef.current.has(messageKey)) return;
      processedMessagesRef.current.add(messageKey);
      freshMessages.push(incomingMsg);
    });

    if (freshMessages.length === 0) return;

    let playedSound = false;
    freshMessages.forEach((incomingMsg) => {
      if (incomingMsg.role === 'user') return;
      const characterId = incomingMsg.character_id;
      const contact = contactsRef.current.find(c => String(c.id) === String(characterId));
      const isVisible = isPrivateConversationVisible(characterId);
      const shouldPlaySound = !playedSound && !isVisible;
      if (shouldPlaySound) playedSound = true;
      const title = contact?.name || (langRef.current === 'en' ? 'Private message' : '私聊消息');
      const preview = getDesktopNotificationPreview(
        incomingMsg.content,
        langRef.current === 'en' ? 'New private message' : '收到新的私聊消息'
      );

      pushDesktopEventNotification({
        kind: 'private',
        sourceId: characterId || 'unknown',
        target: { type: 'private', id: characterId },
        icon: MessageSquare,
        image: DESKTOP_APP_ICONS.social,
        appIcon: DESKTOP_APP_ICONS.social,
        appName: langRef.current === 'en' ? 'Social' : '社交',
        avatar: contact ? resolveAvatarUrl(contact.avatar, API_URL, contact.name || characterId || 'User') : '',
        avatarFrame: contact?.avatar_frame,
        fallbackAvatar: defaultAvatarUrl(contact?.name || characterId || 'User'),
        title,
        meta: preview,
        tone: 'pink',
      }, {
        toast: !isVisible,
        sound: shouldPlaySound,
      });
    });

    const messagesByContact = freshMessages.reduce((groupsByContact, incomingMsg) => {
      const key = String(incomingMsg.character_id || '');
      if (!key) return groupsByContact;
      if (!groupsByContact[key]) groupsByContact[key] = [];
      groupsByContact[key].push(incomingMsg);
      return groupsByContact;
    }, {});

    setContacts(prev => {
      let changed = false;
      const updatedContacts = prev.map((contact) => {
        const contactMessages = messagesByContact[String(contact.id)] || [];
        if (contactMessages.length === 0) return contact;
        changed = true;
        const incomingMsg = contactMessages[contactMessages.length - 1];
        const isReadInPlace = isPrivateConversationVisible(contact.id);
        const unreadDelta = contactMessages.filter(msg => msg.role !== 'user').length;
        const newUnread = isReadInPlace ? 0 : (Number(contact.unread) || 0) + unreadDelta;
        const messageTimestamp = Number(incomingMsg.timestamp || 0);
        const latestUserMessageTimestamp = contactMessages.reduce((latest, msg) => {
          if (msg.role !== 'user') return latest;
          return Math.max(latest, Number(msg.timestamp || 0));
        }, 0);
        const userMessageTimePatch = latestUserMessageTimestamp > 0
          ? {
            last_user_msg_time: latestUserMessageTimestamp,
            last_user_message_at: latestUserMessageTimestamp
          }
          : {};
        return {
          ...contact,
          lastMessage: incomingMsg.content,
          time: new Date(incomingMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: newUnread,
          last_message_at: messageTimestamp || contact.last_message_at,
          ...userMessageTimePatch
        };
      });
      return changed ? updatedContacts : prev;
    });
  }, [API_URL, DESKTOP_APP_ICONS.social, MessageSquare, contactsRef, defaultAvatarUrl, getDesktopNotificationPreview, incomingMessageQueue, isPrivateConversationVisible, langRef, processedMessagesRef, pushDesktopEventNotification, resolveAvatarUrl, setContacts]);
    return {  };
}
