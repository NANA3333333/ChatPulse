import {
    commercialV2BehaviorContextMinQ,
    commercialV2BehaviorContextMaxQ,
    commercialV2BehaviorContextMinP,
    commercialV2BehaviorContextMaxP,
} from '../../../features/city/scene/behaviorTreeCore.js';

export function RoomBehaviorContext({
    summaryHint,
    tx,
    behaviorConfig,
    updateBehaviorConfig,
    behaviorContextStats,
    lang,
}) {
    return (
        <div className="pixel-world-behavior-context-grid">
            <label className="pixel-world-behavior-field">
                <span>{tx('q Raw Window', 'q 原文窗口')}</span>
                <div className="pixel-world-behavior-slider-row">
                    <input
                        type="range"
                        min={commercialV2BehaviorContextMinQ}
                        max={commercialV2BehaviorContextMaxQ}
                        step="1"
                        value={behaviorConfig.context_q_limit}
                        onChange={(event) => updateBehaviorConfig({ context_q_limit: event.target.value })}
                    />
                    <strong>{behaviorConfig.context_q_limit}</strong>
                </div>
                <small>{tx('Live input reads at most q raw branches.', '实时输入最多读取 q 条枝丫原文。')}</small>
            </label>
            <label className="pixel-world-behavior-field">
                <span>{tx('p Summary Threshold', 'p 摘要阈值')}</span>
                <div className="pixel-world-behavior-slider-row">
                    <input
                        type="range"
                        min={commercialV2BehaviorContextMinP}
                        max={commercialV2BehaviorContextMaxP}
                        step="1"
                        value={behaviorConfig.context_summary_threshold}
                        onChange={(event) => updateBehaviorConfig({ context_summary_threshold: event.target.value })}
                    />
                    <strong>{behaviorConfig.context_summary_threshold}</strong>
                </div>
                <small>{summaryHint}</small>
            </label>
            <div className="pixel-world-behavior-context-stats">
                {tx('Summary backlog:', '摘要积攒：')}
                <strong>
                    {behaviorContextStats.pending_summary_count} / {behaviorContextStats.p_summary_threshold}
                </strong>
                {tx(' items pending summary, currently reading ', '条待总结，当前读取 ')}
                {behaviorContextStats.active_summary_count}
                {tx(' summary rounds.', ' 轮摘要。')}
                <span>
                    {lang === 'en' ? (
                        <>
                            Raw {behaviorContextStats.raw_readable_count} / {behaviorContextStats.q_raw_limit} items
                        </>
                    ) : (
                        <>
                            原文 {behaviorContextStats.raw_readable_count} / {behaviorContextStats.q_raw_limit} 条
                        </>
                    )}
                </span>
            </div>
        </div>
    );
}
