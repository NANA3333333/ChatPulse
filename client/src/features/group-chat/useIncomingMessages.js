import { useEffect } from 'react';

export function useIncomingGroupMessages(dependencies) {
const { DESKTOP_APP_ICONS, UsersRound, contactsRef, getDesktopNotificationPreview, groupsRef, incomingGroupMessageQueue, isGroupConversationVisible, langRef, processedGroupMessagesRef, pushDesktopEventNotification, setGroupUnreadCounts } = dependencies;
useEffect(() => {
    if (!incomingGroupMessageQueue.length) return;

    const freshMessages = [];
    incomingGroupMessageQueue.forEach((incomingMsg) => {
      if (!incomingMsg) return;
      const groupId = incomingMsg.group_id || incomingMsg.groupId || '';
      const messageKey = incomingMsg.id
        ? `group:${groupId}:${incomingMsg.id}`
        : `group:${groupId}:${incomingMsg.timestamp || ''}:${incomingMsg.sender_id || ''}:${incomingMsg.content || ''}`;
      if (processedGroupMessagesRef.current.has(messageKey)) return;
      processedGroupMessagesRef.current.add(messageKey);
      freshMessages.push({ ...incomingMsg, group_id: groupId });
    });

    if (freshMessages.length === 0) return;

    let playedSound = false;
    const unreadDeltas = {};

    freshMessages.forEach((incomingMsg) => {
      const groupId = incomingMsg.group_id;
      if (!groupId) return;
      const isUserMessage = incomingMsg.sender_id === 'user' || incomingMsg.role === 'user';
      if (isUserMessage) return;

      const isVisible = isGroupConversationVisible(groupId);
      if (!isVisible) {
        unreadDeltas[groupId] = (unreadDeltas[groupId] || 0) + 1;
      }

      const group = groupsRef.current.find(g => String(g.id) === String(groupId));
      const sender = contactsRef.current.find(c => String(c.id) === String(incomingMsg.sender_id));
      const senderName = incomingMsg.sender_name
        || sender?.name
        || (incomingMsg.sender_id === 'system'
          ? (langRef.current === 'en' ? 'System' : '系统')
          : (langRef.current === 'en' ? 'Group member' : '群成员'));
      const preview = getDesktopNotificationPreview(
        incomingMsg.content,
        langRef.current === 'en' ? 'New group message' : '收到新的群聊消息'
      );
      const shouldPlaySound = !playedSound && !isVisible;
      if (shouldPlaySound) playedSound = true;

      pushDesktopEventNotification({
        kind: 'group',
        sourceId: groupId,
        target: { type: 'group', id: groupId },
        icon: UsersRound,
        image: DESKTOP_APP_ICONS.social,
        appIcon: DESKTOP_APP_ICONS.social,
        appName: langRef.current === 'en' ? 'Social' : '社交',
        title: group?.name || (langRef.current === 'en' ? 'Group chat' : '群聊消息'),
        meta: `${senderName}: ${preview}`,
        tone: 'pink',
      }, {
        toast: !isVisible,
        sound: shouldPlaySound,
      });
    });

    if (Object.keys(unreadDeltas).length > 0) {
      setGroupUnreadCounts((current) => {
        const next = { ...current };
        Object.entries(unreadDeltas).forEach(([groupId, delta]) => {
          next[groupId] = (Number(next[groupId]) || 0) + delta;
        });
        return next;
      });
    }
  }, [DESKTOP_APP_ICONS.social, UsersRound, contactsRef, getDesktopNotificationPreview, groupsRef, incomingGroupMessageQueue, isGroupConversationVisible, langRef, processedGroupMessagesRef, pushDesktopEventNotification, setGroupUnreadCounts]);
    return {  };
}
