import React, { useState } from 'react';
import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import './PixelWorldPanel.css';
import RoomScene from './RoomScene.jsx';
import PixelWorldErrorBoundary, { pixelCottageCacheKeys } from './PixelWorldErrorBoundary.jsx';
import { roomScenes, roomStyleMeta } from './roomEditorCore.js';

function PixelCottagePanelContent({ apiUrl = '/api', userProfile = null, editorTools = null, isActive = true }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const [activeRoomStyle, setActiveRoomStyle] = useState('empty');
    const scene = roomScenes[activeRoomStyle] || roomScenes.empty;
    const roomStyleEntries = Object.entries(roomStyleMeta);

    return (
        <div className="pixel-world-page pixel-cottage-page">
            {roomStyleEntries.length > 1 && (
                <div className="pixel-world-style-tabs" role="tablist" aria-label={isEn ? 'Room style' : '房间风格'}>
                    {roomStyleEntries.map(([key, meta]) => (
                        <button
                            key={key}
                            className={activeRoomStyle === key ? 'active' : ''}
                            onClick={() => setActiveRoomStyle(key)}
                        >
                            {meta.label}
                        </button>
                    ))}
                </div>
            )}

            <RoomScene scene={scene} apiUrl={apiUrl} userProfile={userProfile} editorTools={editorTools} isActive={isActive} />
        </div>
    );
}

export default function PixelCottagePanel(props) {
    const { lang } = useLanguage();

    return (
        <PixelWorldErrorBoundary
            lang={lang}
            cacheKeys={pixelCottageCacheKeys}
            titleEn="Pixel Cottage did not open correctly"
            titleZh="像素小屋没有正常打开"
            clearLabelEn="Clear cottage cache"
            clearLabelZh="清理小屋缓存"
        >
            <PixelCottagePanelContent {...props} />
        </PixelWorldErrorBoundary>
    );
}
