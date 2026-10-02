import { useState, useRef, useEffect } from 'react';

export function useApplicationState(dependencies) {
const { authUser, token } = dependencies;
const [activeTab, setActiveTab] = useState('desktop');

const [activeContactId, setActiveContactId] = useState(null);

const [contacts, setContacts] = useState([]);

const [chatSearch, setChatSearch] = useState('');

const [contactsLoadError, setContactsLoadError] = useState('');
const [contactsLoaded, setContactsLoaded] = useState(false);

const [activeContactSnapshot, setActiveContactSnapshot] = useState(null);

const [incomingMessageQueue, setIncomingMessageQueue] = useState([]);

const [activeDrawer, setActiveDrawer] = useState(null);

const [userProfile, setUserProfile] = useState(() => authUser || null);

const [isLoaded, setIsLoaded] = useState(() => !!token);

const [engineState, setEngineState] = useState({});

const [showAddCharModal, setShowAddCharModal] = useState(false);

const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

const [groups, setGroups] = useState([]);

const [activeGroupId, setActiveGroupId] = useState(null);

const [conversationJumpTarget, setConversationJumpTarget] = useState(null);

const [incomingGroupMessageQueue, setIncomingGroupMessageQueue] = useState([]);

const [groupUnreadCounts, setGroupUnreadCounts] = useState({});

const [desktopEventNotifications, setDesktopEventNotifications] = useState([]);

const [desktopToastNotifications, setDesktopToastNotifications] = useState([]);

const [groupTyping, setGroupTyping] = useState({});

const [globalAnnouncement, setGlobalAnnouncement] = useState(null);

const [groupChatEnabled, setGroupChatEnabled] = useState(false);

const [redpacketClaimEvent, setRedpacketClaimEvent] = useState(null);

const [generatingSchedules, setGeneratingSchedules] = useState({});

const [hiddenMessagesCount, setHiddenMessagesCount] = useState(0);
const activeContactRef = useRef(activeContactId);

useEffect(() => { activeContactRef.current = activeContactId; }, [activeContactId]);

const activeGroupRef = useRef(activeGroupId);

useEffect(() => { activeGroupRef.current = activeGroupId; }, [activeGroupId]);

    return { activeContactRef, activeGroupRef, activeTab, setActiveTab, activeContactId, setActiveContactId, contacts, setContacts, chatSearch, setChatSearch, contactsLoadError, setContactsLoadError, contactsLoaded, setContactsLoaded, activeContactSnapshot, setActiveContactSnapshot, incomingMessageQueue, setIncomingMessageQueue, activeDrawer, setActiveDrawer, userProfile, setUserProfile, isLoaded, setIsLoaded, engineState, setEngineState, showAddCharModal, setShowAddCharModal, showCreateGroupModal, setShowCreateGroupModal, groups, setGroups, activeGroupId, setActiveGroupId, conversationJumpTarget, setConversationJumpTarget, incomingGroupMessageQueue, setIncomingGroupMessageQueue, groupUnreadCounts, setGroupUnreadCounts, desktopEventNotifications, setDesktopEventNotifications, desktopToastNotifications, setDesktopToastNotifications, groupTyping, setGroupTyping, globalAnnouncement, setGlobalAnnouncement, groupChatEnabled, setGroupChatEnabled, redpacketClaimEvent, setRedpacketClaimEvent, generatingSchedules, setGeneratingSchedules, hiddenMessagesCount, setHiddenMessagesCount };
}
