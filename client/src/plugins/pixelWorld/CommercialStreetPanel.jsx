import React from 'react';
import { useLanguage } from '../../LanguageContext';
import './PixelWorldPanel.css';
import CommercialStreetEditor from './CommercialStreetEditor';
import PixelWorldErrorBoundary, { commercialStreetCacheKeys } from './PixelWorldErrorBoundary';

function CommercialStreetPanelContent({ apiUrl = '/api', userProfile = null }) {
  return (
    <div className="pixel-world-page">
      <CommercialStreetEditor apiUrl={apiUrl} userProfile={userProfile} />
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
