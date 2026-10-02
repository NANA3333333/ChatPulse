import { useCallback, useEffect } from 'react';

export function useCharacterCreation(dependencies) {
const { AddCharacterModal, activeContactId, activeContactRef, activeGroupId, activeGroupRef, activeTab, contacts, openCreatedCharacterInChatRef, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setContacts, setShowAddCharModal } = dependencies;
const openAddCharacterModal = useCallback((openCreatedCharacterInChat = false) => {
    AddCharacterModal.preload?.();
    openCreatedCharacterInChatRef.current = openCreatedCharacterInChat;
    setShowAddCharModal(true);
  }, [AddCharacterModal, openCreatedCharacterInChatRef, setShowAddCharModal]);

const closeAddCharacterModal = useCallback(() => {
    openCreatedCharacterInChatRef.current = false;
    setShowAddCharModal(false);
  }, [openCreatedCharacterInChatRef, setShowAddCharModal]);

const handleCharacterAdded = useCallback((newChar) => {
    if (!newChar) {
      openCreatedCharacterInChatRef.current = false;
      return;
    }

    setContacts(prev => {
      const nextId = String(newChar.id || '');
      if (!nextId) return [...prev, newChar];
      const exists = prev.some(contact => String(contact.id) === nextId);
      return exists
        ? prev.map(contact => (String(contact.id) === nextId ? { ...contact, ...newChar } : contact))
        : [...prev, newChar];
    });

    if (openCreatedCharacterInChatRef.current && newChar.id) {
      setActiveTab('chats');
      setActiveGroupId(null);
      activeGroupRef.current = null;
      setActiveContactId(newChar.id);
      setActiveContactSnapshot(newChar);
      activeContactRef.current = newChar.id;
      setActiveDrawer(null);
    }

    openCreatedCharacterInChatRef.current = false;
  }, [activeContactRef, activeGroupRef, openCreatedCharacterInChatRef, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setContacts]);

useEffect(() => {
    if (!activeContactId) {
      setActiveContactSnapshot(null);
      return;
    }
    const latest = contacts.find(c => c.id === activeContactId);
    if (latest) {
      setActiveContactSnapshot(latest);
    }
  }, [activeContactId, contacts, setActiveContactSnapshot]);

useEffect(() => {
    if (activeTab !== 'chats' || activeContactId || activeGroupId || contacts.length === 0) return;
    const firstContact = contacts[0];
    setActiveContactId(firstContact.id);
    setActiveContactSnapshot(firstContact);
    activeContactRef.current = firstContact.id;
  }, [activeContactId, activeContactRef, activeGroupId, activeTab, contacts, setActiveContactId, setActiveContactSnapshot]);
    return { openAddCharacterModal, closeAddCharacterModal, handleCharacterAdded };
}
