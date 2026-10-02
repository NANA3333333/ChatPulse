import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatSettingsDrawer from '../../characters/components/ChatSettingsDrawer.jsx';
import SettingsPanel from '../../settings/components/SettingsPanel.jsx';
import { LanguageProvider } from '../../../shared/i18n/LanguageContext.jsx';
import { AuthContext } from '../../account/AuthContext.jsx';

const contacts = await fetch('/api/characters').then(response => response.json());
const isSettings = new URLSearchParams(location.search).get('mode') === 'settings';
createRoot(document.getElementById('root')).render(
    <LanguageProvider>
        <AuthContext.Provider value={{ login() {}, updateUser() {} }}>
            {isSettings
                ? <SettingsPanel apiUrl="/api" contacts={contacts} />
                : <ChatSettingsDrawer apiUrl="/api" contact={contacts[0]} contacts={contacts} onClose={() => {}} />}
        </AuthContext.Provider>
    </LanguageProvider>
);
