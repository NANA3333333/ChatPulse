import { BrainCircuit, Route, WandSparkles, Upload, RefreshCw } from 'lucide-react';
import { formatNumber } from '../memoryLabels.js';

export function MemoryCoreHeader({ tx, primaryView, setPrimaryView, onRefresh, refreshing, autoProgress, onImport }) {
    const pendingCount = Number(autoProgress?.stats?.pending || autoProgress?.pending_before || 0);
    return (
        <header className="memory-core-header">
            <div className="memory-core-brand">
                <span>
                    <BrainCircuit size={20} />
                </span>
                <div>
                    <small>MEMORY LIBRARY</small>
                    <strong>{tx('Memory is not a table', '记忆不是一张表')}</strong>
                </div>
            </div>
            <nav className="memory-core-tabs" aria-label={tx('Memory library views', '记忆库视图')}>
                <button
                    type="button"
                    className={primaryView === 'map' ? 'is-active' : ''}
                    onClick={() => setPrimaryView('map')}
                >
                    <Route size={16} /> {tx('Memory Map', '记忆地图')}
                </button>
                <button
                    type="button"
                    className={primaryView === 'maintenance' ? 'is-active' : ''}
                    onClick={() => setPrimaryView('maintenance')}
                >
                    <WandSparkles size={16} /> {tx('Maintenance Workspace', '维护工作台')}
                    {pendingCount > 0 && <em>{formatNumber(pendingCount)}</em>}
                </button>
            </nav>
            <div className="memory-core-actions">
                <button type="button" className="memory-core-ghost" onClick={onImport}>
                    <Upload size={15} /> {tx('Import External Memory', '导入外部记忆')}
                </button>
                <button
                    type="button"
                    className="memory-core-icon"
                    onClick={onRefresh}
                    disabled={refreshing}
                    title={tx('Refresh', '刷新')}
                >
                    <RefreshCw size={16} className={refreshing ? 'memory-spin' : ''} />
                </button>
            </div>
        </header>
    );
}
