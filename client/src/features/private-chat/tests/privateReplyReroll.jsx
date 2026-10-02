import React from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from "../../../shared/i18n/LanguageContext.jsx";
import { ChatWindow } from "../index";
import "../../../App.css";
import "../../../index.css";
import "../../../styles/desktop.css";

const avatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" rx="20" fill="%23e6cad5"/%3E%3C/svg%3E';
const contact = { id: 'reroll-ui', name: '测试角色', avatar, status: 'active', api_endpoint: 'https://example.invalid', api_key_configured: true, model_name: 'Main', affinity: 65 };
createRoot(document.getElementById('root')).render(
    <LanguageProvider><div className="app-container tab-chats has-active-chat has-private-chat is-private-chat-scene is-window-maximized" style={{ height: '100dvh', width: '100%', display: 'flex' }}><div className="private-chat-main" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <ChatWindow contact={contact} allContacts={[contact]} userAvatar={avatar} apiUrl="/api" incomingMessageQueue={[]} engineState={{}} />
    </div></div></LanguageProvider>
);
