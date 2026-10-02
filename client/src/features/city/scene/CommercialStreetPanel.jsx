import React from 'react';
import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import './PixelWorldPanel.css';
import CommercialStreetScene from './CommercialStreetScene.jsx';
import PixelWorldErrorBoundary, { commercialStreetCacheKeys } from './PixelWorldErrorBoundary.jsx';

function CommercialStreetPanelContent({ apiUrl = '/api', userProfile = null, editorTools = null, isActive = true }) {
    return (
        <div className="pixel-world-page">
            <CommercialStreetScene apiUrl={apiUrl} userProfile={userProfile} editorTools={editorTools} isActive={isActive} />
        </div>
    );
}

export default function CommercialStreetPanel(props) {
    const { lang } = useLanguage();

    return (
        <PixelWorldErrorBoundary
            lang={lang}
            cacheKeys={commercialStreetCacheKeys}
            titleEn="Commercial Street did not open correctly"
            titleZh="商业街没有正常打开"
            clearLabelEn="Clear street cache"
            clearLabelZh="清理商业街缓存"
        >
            <CommercialStreetPanelContent {...props} />
        </PixelWorldErrorBoundary>
    );
}
