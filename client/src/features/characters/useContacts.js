import { useCallback, useEffect } from 'react';

export function useContacts(dependencies) {
const { API_URL, activeContactRef, contactsRefreshRef, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setContacts, setContactsLoadError, setContactsLoaded, setEngineState, setGroups, token } = dependencies;
const fetchContacts = useCallback(() => {
    if (!token) return;
    return fetch(`${API_URL}/characters`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        setContactsLoadError('');
        setContacts(prev => data.map(newContact => {
          const existing = prev.find(p => p.id === newContact.id);
          if (existing) {
            return {
              ...newContact,
              unread: existing.unread || 0,
              lastMessage: newContact.lastMessage || existing.lastMessage,
              time: newContact.time || existing.time
            };
          }
          return newContact;
        }));
        return data;
      })
      .catch(err => {
        console.error('Failed to load contacts:', err);
        setContactsLoadError(err.message || 'Failed to load contacts');
        return [];
      })
      .finally(() => setContactsLoaded(true));
  }, [API_URL, setContacts, setContactsLoadError, setContactsLoaded, token]);

useEffect(() => { setContactsLoaded(false); }, [token, setContactsLoaded]);

const scheduleContactsRefresh = useCallback((delay = 350) => {
    if (contactsRefreshRef.current) {
      clearTimeout(contactsRefreshRef.current);
    }
    contactsRefreshRef.current = setTimeout(() => {
      contactsRefreshRef.current = null;
      fetchContacts();
    }, delay);
  }, [contactsRefreshRef, fetchContacts]);

useEffect(() => {
    if (!token) return undefined;
    const handleRefreshContacts = () => {
      fetchContacts();
    };
    window.addEventListener('refresh_contacts', handleRefreshContacts);
    return () => window.removeEventListener('refresh_contacts', handleRefreshContacts);
  }, [fetchContacts, token]);

const removeDeletedContact = useCallback((deletedId) => {
    if (!deletedId) return;
    const targetId = String(deletedId);
    setContacts(prev => prev.filter(contact => String(contact.id) !== targetId));
    setGroups(prev => prev.map(group => ({
      ...group,
      members: Array.isArray(group.members)
        ? group.members.filter(member => {
          const memberId = typeof member === 'object' ? member.member_id : member;
          return String(memberId) !== targetId;
        })
        : group.members
    })));
    setEngineState(prev => {
      if (!prev || !(targetId in prev)) return prev;
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    if (String(activeContactRef.current || '') === targetId) {
      activeContactRef.current = null;
      setActiveContactId(null);
      setActiveContactSnapshot(null);
      setActiveDrawer(null);
    }
  }, [activeContactRef, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setContacts, setEngineState, setGroups]);
    return { fetchContacts, scheduleContactsRefresh, removeDeletedContact };
}
