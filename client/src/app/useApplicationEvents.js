import { useEffect } from 'react';

export function useApplicationEvents(dependencies) {
const { API_URL, activeContactRef, activeGroupRef, activeTabRef, fetchContacts, scheduleContactsRefresh, setActiveContactId, setActiveContactSnapshot, setActiveGroupId, setActiveTab, setGlobalAnnouncement, setGroupChatEnabled, setGroups, setIncomingMessageQueue, setIsLoaded, setUserProfile, subscribeToReplyUpdates, token } = dependencies;
useEffect(() => {
    if (!token) {
      setIsLoaded(true);
      return;
    }
    setIsLoaded(true);
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    const userPromise = fetch(`${API_URL}/user`, { headers })
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        setUserProfile(data);
        if (data.avatar) localStorage.setItem('cp_avatar', data.avatar);
      })
      .catch(err => {
        console.error('Failed fetching user profile:', err);
      });

    const announcementPromise = fetch(`${API_URL}/system/announcement`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.announcement) {
          setGlobalAnnouncement(data.announcement.content);
        }
      })
      .catch(err => console.error('Failed to load announcement:', err));

    fetchContacts().then((loadedContacts) => {
      if (activeTabRef.current === 'chats' && !activeContactRef.current && !activeGroupRef.current && Array.isArray(loadedContacts) && loadedContacts.length > 0) {
        const first = loadedContacts[0];
        setActiveContactId(first.id);
        setActiveContactSnapshot(first);
        activeContactRef.current = first.id;
      }
    });

    void userPromise;
    void announcementPromise;
  }, [token, fetchContacts, setIsLoaded, API_URL, setUserProfile, setGroups, setGroupChatEnabled, setGlobalAnnouncement, activeTabRef, activeContactRef, activeGroupRef, setActiveContactId, setActiveContactSnapshot]);

useEffect(() => {
    if (!token) return undefined;
    let controller;
    const refreshGroups = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const response = await fetch(API_URL + '/groups', { headers: { Authorization: 'Bearer ' + token }, signal: request.signal });
        if (request.signal.aborted) return;
        if (response.status === 404) { setGroupChatEnabled(false); return; }
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (request.signal.aborted) return;
        if (!Array.isArray(data)) throw new Error('Invalid group list');
        setGroups(data);
        setGroupChatEnabled(true);
      } catch (error) {
        if (!request.signal.aborted) console.warn('Failed to refresh groups:', error.message);
      }
    };
    refreshGroups();
    window.addEventListener('ws_reconnected', refreshGroups);
    window.addEventListener('online', refreshGroups);
    return () => {
      controller?.abort();
      window.removeEventListener('ws_reconnected', refreshGroups);
      window.removeEventListener('online', refreshGroups);
    };
  }, [API_URL, token, setGroups, setGroupChatEnabled]);

useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'st_chat_changed') {
        const { characterId } = event.data;
        if (characterId) {
          fetchContacts(); // Ensure we have the latest list in case ST auto-created them
          setActiveTab('chats');
          setActiveContactId(characterId);
          setActiveGroupId(null);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchContacts, setActiveContactId, setActiveGroupId, setActiveTab]);

useEffect(() => {
    const handleReplyUpdate = update => {
      if (!update?.message?.metadata?.replyVersion) return;
      const removed = new Set((update.removedIds || []).map(String));
      setIncomingMessageQueue(prev => prev.filter(item => !removed.has(String(item.id)))
        .map(item => String(item.id) === String(update.message.id)
          && Number(item.metadata?.replyVersion?.revision || 0) <= update.message.metadata.replyVersion.revision
          ? update.message : item));
      scheduleContactsRefresh();
    };
    return subscribeToReplyUpdates(handleReplyUpdate);
  }, [scheduleContactsRefresh, setIncomingMessageQueue, subscribeToReplyUpdates]);
    return {  };
}
