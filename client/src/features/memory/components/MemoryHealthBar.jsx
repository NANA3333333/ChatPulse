import { Database, ScanSearch, LibraryBig, Sparkles, LoaderCircle, WandSparkles } from 'lucide-react';
import { formatNumber, formatProgressPhase } from '../memoryLabels.js';

export function MemoryHealthBar({
    tx,
    memoryStatus,
    memoryStatusLoading,
    memoryStatusError,
    getMemoryBackendLabel,
    memoryStatusNote,
    totals,
    characterStats,
    autoProgress,
    setPrimaryView,
}) {
    const totalMemories = Number(
        memoryStatus?.memoriesCount ??
            memoryStatus?.structuredMemoriesCount ??
            totals?.formal_total ??
            totals?.total ??
            0,
    );
    const indexed = Number(memoryStatus?.indexedPoints ?? memoryStatus?.embeddedMemoriesCount ?? 0);
    const coverage =
        totalMemories > 0
            ? Math.min(100, Math.round((indexed / totalMemories) * 100))
            : Number(memoryStatus?.indexingCoverage || 0);
    const recalled = Number(memoryStatus?.everRetrievedMemoriesCount || 0);
    const backendOnline = memoryStatus?.enabled !== false && memoryStatus?.reachable !== false;
    const running = !!autoProgress?.running;
    return (
        <section className="memory-healthbar">
            <div className={`memory-health-item ${backendOnline ? 'is-healthy' : 'is-warning'}`}>
                <span>
                    <Database size={16} />
                </span>
                <div>
                    <small>{tx('Memory Backend', '记忆后端')}</small>
                    <strong>
                        {memoryStatus
                            ? getMemoryBackendLabel(memoryStatus.backend)
                            : memoryStatusLoading
                              ? tx('Loading', '加载中')
                              : tx('Unknown', '未知')}
                    </strong>
                    {(memoryStatusNote || memoryStatusError || memoryStatus?.lastError) && (
                        <p>{memoryStatusError || memoryStatus?.lastError || memoryStatusNote}</p>
                    )}
                </div>
                <em>{backendOnline ? tx('Online', '在线') : tx('Fallback', '降级')}</em>
            </div>
            <div className="memory-health-item">
                <span>
                    <ScanSearch size={16} />
                </span>
                <div>
                    <small>{tx('Index Coverage', '索引覆盖')}</small>
                    <strong>{coverage ? `${coverage}%` : tx('Waiting', '等待中')}</strong>
                    <i>
                        <b style={{ width: `${Math.max(0, Math.min(100, coverage || 0))}%` }} />
                    </i>
                </div>
            </div>
            <div className="memory-health-item">
                <span>
                    <LibraryBig size={16} />
                </span>
                <div>
                    <small>{tx('All Memories', '全部记忆')}</small>
                    <strong>{formatNumber(totalMemories || totals?.formal_total || totals?.total)}</strong>
                </div>
                <em>
                    {formatNumber(characterStats.length)} {tx('roles', '角色')}
                </em>
            </div>
            <div className="memory-health-item">
                <span>
                    <Sparkles size={16} />
                </span>
                <div>
                    <small>{tx('Recalled', '被唤起')}</small>
                    <strong>{formatNumber(recalled)}</strong>
                </div>
                <em>{tx('lifetime', '累计')}</em>
            </div>
            <div className={`memory-health-item ${running ? 'is-running' : ''}`}>
                <span>{running ? <LoaderCircle size={16} className="memory-spin" /> : <WandSparkles size={16} />}</span>
                <div>
                    <small>{tx('Background Task', '后台任务')}</small>
                    <strong>
                        {running
                            ? autoProgress.message || formatProgressPhase(autoProgress.phase)
                            : tx('No active task', '没有运行中的任务')}
                    </strong>
                </div>
                <button type="button" onClick={() => setPrimaryView('maintenance')}>
                    {tx('View', '查看')}
                </button>
            </div>
        </section>
    );
}
