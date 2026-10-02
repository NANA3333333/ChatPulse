import { useEffect, useRef } from 'react';

export function useCharacterDataReset(dependencies) {
const { activeContactRef, setActiveContactSnapshot, setContacts } = dependencies;
const processedMessagesRef = useRef(new Set());

const processedGroupMessagesRef = useRef(new Set());

const cityRefreshRef = useRef(null);

const contactsRefreshRef = useRef(null);

useEffect(() => {
    const handleCharacterDataWiped = (event) => {
      const wipedId = event.detail?.characterId;
      if (!wipedId) return;
      setContacts(prev => prev.map(c => c.id === wipedId ? {
        ...c,
        lastMessage: '',
        time: '',
        unread: 0,
        affinity: c.initial_affinity ?? 50,
        pressure_level: 0,
        jealousy_level: 0,
        wallet: 200,
        calories: 2000,
        city_status: 'idle',
        location: 'home'
      } : c));
      if (activeContactRef.current === wipedId) {
        setActiveContactSnapshot(prev => prev ? {
          ...prev,
          lastMessage: '',
          time: '',
          unread: 0,
          affinity: prev.initial_affinity ?? 50,
          pressure_level: 0,
          jealousy_level: 0,
          wallet: 200,
          calories: 2000,
          city_status: 'idle',
          location: 'home'
        } : prev);
      }
    };
    window.addEventListener('character_data_wiped', handleCharacterDataWiped);
    return () => window.removeEventListener('character_data_wiped', handleCharacterDataWiped);
  }, [activeContactRef, setActiveContactSnapshot, setContacts]);
    return { processedMessagesRef, processedGroupMessagesRef, cityRefreshRef, contactsRefreshRef };
}
