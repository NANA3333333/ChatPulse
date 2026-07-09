import React from 'react';
import { commercialV2BehaviorConfigStorageKey } from './behaviorTreeCore';
import {
  commercialV2CanvasStorageKey,
  commercialV2DefaultSnapshotStorageKey,
  commercialV2ResetBackupStorageKey,
  commercialV2StorageKey
} from './commercialStreetCore';
import {
  roomEditorBehaviorTreeStorageKey,
  roomEditorCanvasStorageKey,
  roomEditorAssemblyStorageKey,
  roomEditorDefaultSnapshotStorageKey,
  roomEditorPlayerStorageKey,
  roomEditorResetBackupStorageKey,
  roomEditorSizeProfileStorageKey,
  roomEditorStorageKey
} from './roomEditorCore';

export const commercialStreetCacheKeys = [
  commercialV2StorageKey,
  commercialV2CanvasStorageKey,
  commercialV2ResetBackupStorageKey,
  commercialV2DefaultSnapshotStorageKey,
  commercialV2BehaviorConfigStorageKey
];

export const pixelCottageCacheKeys = [
  roomEditorStorageKey,
  roomEditorCanvasStorageKey,
  roomEditorSizeProfileStorageKey,
  roomEditorAssemblyStorageKey,
  roomEditorResetBackupStorageKey,
  roomEditorDefaultSnapshotStorageKey,
  roomEditorPlayerStorageKey,
  roomEditorBehaviorTreeStorageKey
];

export const pixelWorldCacheKeys = [
  ...commercialStreetCacheKeys,
  ...pixelCottageCacheKeys
];

export default class PixelWorldErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[PixelWorld] module crashed', error, info);
  }

  retry = () => {
    this.setState({ error: null });
  };

  clearPixelWorldCache = () => {
    const cacheKeys = this.props.cacheKeys || pixelWorldCacheKeys;
    cacheKeys.forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const isEn = this.props.lang === 'en';
    const title = isEn
      ? (this.props.titleEn || 'Pixel app did not open correctly')
      : (this.props.titleZh || '像素 App 没有正常打开');
    const description = isEn
      ? (this.props.descriptionEn || 'The module caught this crash. Try again first; if it still fails, clear the local layout cache to restore the default layout.')
      : (this.props.descriptionZh || '模块入口已经拦截住这次崩溃了。可以先重试；如果还是打不开，清理本地布局缓存后会恢复默认布局。');
    const clearLabel = isEn
      ? (this.props.clearLabelEn || 'Clear layout cache')
      : (this.props.clearLabelZh || '清理布局缓存');

    return (
      <div className="pixel-world-page">
        <div className="pixel-world-crash-card">
          <div className="pixel-world-kicker">{isEn ? 'Pixel App' : '像素 App'}</div>
          <h2>{title}</h2>
          <p>{description}</p>
          <div className="pixel-world-crash-actions">
            <button onClick={this.retry}>{isEn ? 'Retry' : '重试打开'}</button>
            <button onClick={this.clearPixelWorldCache}>{clearLabel}</button>
          </div>
          <pre>{String(this.state.error?.message || this.state.error || 'Unknown error')}</pre>
        </div>
      </div>
    );
  }
}
