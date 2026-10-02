import React, { useEffect, useState } from 'react';
import { LanguageProvider } from "../../../shared/i18n/LanguageContext.jsx";
import { ChatWindow } from "../index";
import "../../../App.css";
import "../../../index.css";
import "../../../styles/desktop.css";

const avatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23e6cad5"/%3E%3C/svg%3E';
const contacts = ['messages-a', 'messages-b'].map((id, index) => ({ id, name: `测试角色 ${index + 1}`, avatar,
    status: 'active', api_endpoint: 'https://example.invalid', api_key_configured: true, model_name: 'Main' }));

export default function Harness() {
    const [state, setState] = useState({ characterId: contacts[0].id, queue: [], jumpTarget: null });
    useEffect(() => {
        const update = event => setState(previous => ({ ...previous, ...event.detail }));
        window.addEventListener('test_chat_state', update);
        return () => window.removeEventListener('test_chat_state', update);
    }, []);
    return <LanguageProvider><div className="app-container tab-chats has-active-chat has-private-chat is-private-chat-scene is-window-maximized" style={{ height: '100dvh', width: '100%', display: 'flex' }}>
        <div className="private-chat-main" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <ChatWindow contact={contacts.find(contact => contact.id === state.characterId)} allContacts={contacts} userAvatar={avatar}
                apiUrl="/api" incomingMessageQueue={state.queue} engineState={{}} jumpTarget={state.jumpTarget} />
        </div>
    </div></LanguageProvider>;
}

