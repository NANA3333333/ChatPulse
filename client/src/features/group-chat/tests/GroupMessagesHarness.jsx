import React, { useEffect, useState } from 'react';
import { LanguageProvider } from '../../../shared/i18n/LanguageContext.jsx';
import GroupChatWindow from '../components/GroupChatWindow.jsx';
import '../../../App.css';
import '../../../index.css';

const groups = ['a', 'b'].map(id => ({ id, name: `群聊 ${id}`, members: [{ member_id: 'user' }] }));

export default function GroupMessagesHarness() {
    const [state, setState] = useState({ groupId: 'a', queue: [] });
    const [currentGroups, setCurrentGroups] = useState(groups);
    useEffect(() => {
        const update = event => setState(current => ({ ...current, ...event.detail }));
        window.addEventListener('test_group_state', update);
        return () => window.removeEventListener('test_group_state', update);
    }, []);
    return <LanguageProvider><div className="app-container" style={{ height: '100dvh', width: '100%' }}>
        <GroupChatWindow group={currentGroups.find(g => g.id === state.groupId)} apiUrl="/api"
            jumpTarget={state.jumpTarget} onJumpHandled={() => setState(current => ({ ...current, jumpTarget: null }))}
            onGroupUpdated={group => setCurrentGroups(current => current.map(item => item.id === group.id ? group : item))}
            allContacts={[]} userProfile={{ name: 'Test User' }} typingIndicators={[]}
            incomingGroupMessageQueue={state.queue} />
    </div></LanguageProvider>;
}
