import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Database, Edit2, FileText, Play, RefreshCw, RotateCcw, Save, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const emptySettings = {
    api_endpoint: '',
    api_key: '',
    model_name: '',
    batch_size: 30,
    max_output_tokens: 8000
};

const MEMORY_FOCUS_OPTIONS = [
    ['user_profile', '用户画像'],
    ['relationship', '关系记忆'],
    ['user_current_arc', '当前阶段'],
    ['general', '普通事件']
];

const MEMORY_TIER_OPTIONS = [
    ['core', '核心'],
    ['active', '活跃'],
    ['ambient', '背景']
];

const SOURCE_CONTEXT_OPTIONS = [
    ['private_chat', '私聊'],
    ['group_chat', '群聊'],
    ['commercial_street', '商业街'],
    ['external_app', '外部 App'],
    ['unknown', '来源未明']
];

const SCENE_TAG_OPTIONS = [
    ['none', '无'],
    ['private_chat', '私聊'],
    ['group_chat', '群聊'],
    ['commercial_street', '商业街'],
    ['external_gpt', 'GPT'],
    ['external_gemini', 'Gemini'],
    ['external_sillytavern', 'SillyTavern'],
    ['external_app', '外部 App'],
    ['other', '其他']
];

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatDays(value) {
    if (value === null || value === undefined) return '受保护';
    const days = Number(value || 0);
    if (days < 1) return `${Math.ceil(days * 24)} 小时`;
    return `${Math.ceil(days)} 天`;
}

function formatDate(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return '未记录';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatDateTime(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return '未记录';
    return new Date(timestamp).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatMonth(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return '未记录月份';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long'
    });
}

function formatDay(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return '未记录日期';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
}

function getLocalDayKey(value) {
    const date = new Date(Number(value || 0));
    if (!Number.isFinite(date.getTime())) return 'unknown';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getLocalMonthKey(value) {
    const date = new Date(Number(value || 0));
    if (!Number.isFinite(date.getTime())) return 'unknown';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

const TIMELINE_FILTERS = [
    { key: 'all', label: '全部' },
    { key: 'temporary_body_state', label: '身体临时' },
    { key: 'temporary_emotion', label: '情绪临时' },
    { key: 'deadline_or_plan', label: '计划截止' },
    { key: 'temporary_location', label: '临时地点' },
    { key: 'recent_phase', label: '近期阶段' },
    { key: 'cyclic_state', label: '周期状态' },
    { key: 'short_term_state', label: '短期状态' },
    { key: 'ongoing_phase', label: '持续阶段' },
    { key: 'periodic_state', label: '周期性' },
    { key: 'one_time_event', label: '一次事件' },
    { key: 'expiring', label: '快遗忘' }
];

const TEMPORAL_BADGES = {
    temporary_body_state: { key: 'temporary_body_state', label: '身体临时' },
    temporary_emotion: { key: 'temporary_emotion', label: '情绪临时' },
    deadline_or_plan: { key: 'deadline_or_plan', label: '计划截止' },
    temporary_location: { key: 'temporary_location', label: '临时地点' },
    recent_phase: { key: 'recent_phase', label: '近期阶段' },
    single_event_state: { key: 'single_event_state', label: '一次状态' },
    cyclic_state: { key: 'cyclic_state', label: '周期状态' },
    other: { key: 'other', label: '其他时间' },
    short_term_state: { key: 'short_term_state', label: '短期状态' },
    ongoing_phase: { key: 'ongoing_phase', label: '持续阶段' },
    periodic_state: { key: 'periodic_state', label: '周期性' },
    one_time_event: { key: 'one_time_event', label: '一次事件' },
    long_term_fact: { key: 'long_term_fact', label: '长期事实' },
    unclear: { key: 'unclear', label: '时间不明' }
};

function decorateTimelineItem(item = {}) {
    const timelineAt = Number(item.timeline_at || item.source_ended_at || item.source_started_at || item.created_at || 0);
    const temporalKey = item.temporal_label || 'unclear';
    const temporalBadge = TEMPORAL_BADGES[temporalKey] || TEMPORAL_BADGES.unclear;
    const daysUntilThreshold = Number(item.days_until_threshold);
    const isFastForgetting = item.forgetting_stage === 'grace'
        || item.forgetting_stage === 'expired'
        || (Number.isFinite(daysUntilThreshold) && daysUntilThreshold <= 30);
    return {
        ...item,
        timeline_at: timelineAt,
        temporal_badge: temporalBadge,
        temporal_label: temporalBadge.key,
        is_temporal_candidate: !['long_term_fact', 'unclear'].includes(temporalBadge.key),
        is_temporary_state: ['short_term_state', 'ongoing_phase', 'periodic_state'].includes(temporalBadge.key),
        is_fast_forgetting: isFastForgetting
    };
}

function startOfLocalMonth(value) {
    const date = new Date(Number(value || 0));
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function buildTimelineGraph(items = [], filter = 'all') {
    const decorated = items
        .map(decorateTimelineItem)
        .filter(item => item.timeline_at > 0)
        .sort((a, b) => Number(a.timeline_at || 0) - Number(b.timeline_at || 0));
    const filtered = decorated.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'expiring') return item.is_fast_forgetting;
        return item.temporal_label === filter;
    });
    if (!filtered.length) {
        return { items: decorated, filtered, clusters: [], months: [], range_start: 0, range_end: 0, max_count: 0 };
    }
    const rangeStart = filtered[0].timeline_at;
    const rangeEnd = filtered[filtered.length - 1].timeline_at;
    const range = Math.max(24 * 60 * 60 * 1000, rangeEnd - rangeStart);
    const clusterMap = new Map();
    for (const item of filtered) {
        const key = getLocalDayKey(item.timeline_at);
        const dayStart = new Date(item.timeline_at);
        dayStart.setHours(0, 0, 0, 0);
        if (!clusterMap.has(key)) {
            clusterMap.set(key, {
                key,
                timestamp: dayStart.getTime(),
                label: formatDay(item.timeline_at),
                month_key: getLocalMonthKey(item.timeline_at),
                month_label: formatMonth(item.timeline_at),
                items: [],
                counts: {},
                temporary_count: 0,
                expiring_count: 0
            });
        }
        const cluster = clusterMap.get(key);
        cluster.items.push(item);
        cluster.counts[item.temporal_label] = Number(cluster.counts[item.temporal_label] || 0) + 1;
        if (item.is_temporary_state) cluster.temporary_count += 1;
        if (item.is_fast_forgetting) cluster.expiring_count += 1;
    }
    const clusters = Array.from(clusterMap.values())
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
        .map((cluster, index) => {
            const dominant = Object.entries(cluster.counts)
                .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0]?.[0] || 'one_time_event';
            const position = ((cluster.timestamp - rangeStart) / range) * 100;
            return {
                ...cluster,
                items: cluster.items.sort((a, b) => Number(b.timeline_at || 0) - Number(a.timeline_at || 0)),
                count: cluster.items.length,
                dominant_label: dominant,
                lane: index % 4,
                position: Math.max(0.5, Math.min(99.5, position)),
                size: Math.max(22, Math.min(62, 18 + Math.sqrt(cluster.items.length) * 6))
            };
        });
    const monthMap = new Map();
    for (const cluster of clusters) {
        if (!monthMap.has(cluster.month_key)) {
            monthMap.set(cluster.month_key, {
                key: cluster.month_key,
                label: cluster.month_label,
                timestamp: startOfLocalMonth(cluster.timestamp),
                count: 0,
                temporary_count: 0,
                expiring_count: 0
            });
        }
        const month = monthMap.get(cluster.month_key);
        month.count += cluster.count;
        month.temporary_count += cluster.temporary_count;
        month.expiring_count += cluster.expiring_count;
    }
    const months = Array.from(monthMap.values())
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
        .map(month => ({
            ...month,
            position: Math.max(0.5, Math.min(99.5, ((month.timestamp - rangeStart) / range) * 100))
        }));
    return {
        items: decorated,
        filtered,
        clusters,
        months,
        range_start: rangeStart,
        range_end: rangeEnd,
        max_count: Math.max(...clusters.map(cluster => cluster.count), 1)
    };
}

function formatStoppedReason(reason) {
    const map = {
        empty: '待分类已清空',
        completed: '已完成',
        max_batches: '达到批次数',
        error: '小模型错误',
        no_progress: '无进展停止',
        dry_run: '预演停止',
        backend_missing: '后端任务不存在'
    };
    return map[reason] || reason || '未记录';
}

function formatProgressPhase(phase) {
    const map = {
        start: '启动中',
        batch_start: '读取批次',
        attempt_start: '调用小模型',
        attempt_result: '收到结果',
        attempt_no_progress: '无进展，准备重 roll',
        attempt_error: '本次尝试失败',
        batch_success: '批次写回完成',
        batch_empty: '待分类已清空',
        done: '已完成',
        stopped: '已停止'
    };
    return map[phase] || phase || '等待中';
}

function formatRunResultDetails(result) {
    if (!result) return '';
    if (result.mode === 'auto') {
        return JSON.stringify({
            stopped_reason: result.stopped_reason,
            max_rerolls: result.max_rerolls,
            errors: result.errors || [],
            runs: result.runs || [],
            raw_response: result.raw_response || ''
        }, null, 2);
    }
    return result.raw_response || JSON.stringify(result.parsed || {}, null, 2);
}

function formatForgettingLabel(item = {}) {
    if (item.days_until_threshold === null || item.days_until_threshold === undefined) return '受保护';
    if (item.forgetting_stage === 'expired') return '缓冲结束，可彻底遗忘';
    if (item.forgetting_stage === 'grace') {
        const daysLeft = Number(item.days_until_grace_expires || 0);
        const leftText = daysLeft <= 0 ? '不足 1 小时' : formatDays(daysLeft);
        return `缓冲中，${leftText}后可遗忘`;
    }
    return `${formatDays(item.days_until_threshold)}后进入缓冲`;
}

function StatCard({ label, value, detail }) {
    return (
        <div className="memory-lib-stat">
            <div className="memory-lib-stat-label">{label}</div>
            <div className="memory-lib-stat-value">{value}</div>
            {detail && <div className="memory-lib-stat-detail">{detail}</div>}
        </div>
    );
}

function MemoryEntryRow({ item, mode = 'category', onRescue, onCharacterClick, onEdit, onDelete, onViewSource, rescuing, deletingIds = [] }) {
    const daysText = formatForgettingLabel(item);
    const isNewMemory = item.memory_library_source === 'new' || item.memory_library_source === 'new_grouped';
    const sourceIds = Array.isArray(item.source_ids) && item.source_ids.length ? item.source_ids : [item.representative_id || item.id].filter(Boolean);
    const sourceCount = Number(item.source_count || sourceIds.length || 1);
    const displayId = sourceCount > 1
        ? `#${sourceIds[0]} 等 ${formatNumber(sourceCount)} 条`
        : `#${item.representative_id || item.id}`;
    const isDeleting = sourceIds.some(id => deletingIds.includes(Number(id)));
    let forgettingTimeLabel = '';
    if (mode === 'forgetting' && item.forgetting_stage === 'approaching' && item.threshold_at) {
        forgettingTimeLabel = `预计进缓冲 ${formatDateTime(item.threshold_at)}`;
    } else if (mode === 'forgetting' && item.forgetting_stage === 'grace' && item.grace_expires_at) {
        forgettingTimeLabel = `缓冲截止 ${formatDateTime(item.grace_expires_at)}`;
    } else if (mode === 'forgetting' && item.forgetting_stage === 'expired' && item.grace_expires_at) {
        forgettingTimeLabel = `缓冲已截止 ${formatDateTime(item.grace_expires_at)}`;
    }
    return (
        <div className={`memory-entry-row ${mode}`}>
            <div className="memory-entry-main">
                <div className="memory-entry-meta">
                    <span className="memory-lib-id">{displayId}</span>
                    <button type="button" className="memory-entry-character" onClick={() => onCharacterClick?.(item.character_id)}>
                        {item.character_name}
                    </button>
                    <span>{item.memory_focus} / {item.memory_tier}</span>
                    <span>调用 {formatNumber(item.retrieval_count)}</span>
                    <span>重要性 {item.importance}</span>
                    {mode === 'forgetting' && <b>{daysText}</b>}
                    {mode === 'timeline' && item.temporal_badge && (
                        <span className={`memory-temporal-badge ${item.temporal_badge.key}`}>{item.temporal_badge.label}</span>
                    )}
                    {mode === 'timeline' && item.is_fast_forgetting && <b>快遗忘</b>}
                </div>
                <div className="memory-entry-text">{item.text || '空记忆条目'}</div>
                <div className="memory-entry-foot">
                    <span>创建 {formatDate(item.created_at)}</span>
                    <span>更新 {formatDate(item.updated_at)}</span>
                    <span>分数 {Number(item.retention_score || 0).toFixed(2)}</span>
                    {sourceCount > 1 && <span>来源 {formatNumber(sourceCount)} 条</span>}
                    <span>{item.retention_action || 'keep'}</span>
                    {mode === 'forgetting' && forgettingTimeLabel && <span>{forgettingTimeLabel}</span>}
                </div>
            </div>
            {mode === 'forgetting' && (
                <button className="memory-lib-button compact" onClick={() => onRescue(sourceIds)} disabled={rescuing}>
                    <RotateCcw size={14} /> {rescuing ? '救回中' : '救回'}
                </button>
            )}
            <div className="memory-entry-actions">
                <button className="memory-lib-button compact ghost" onClick={() => onViewSource?.({ item, ids: sourceIds })}>
                    <FileText size={14} /> 原文
                </button>
                <button className="memory-lib-button compact ghost" onClick={() => onEdit?.({ type: isNewMemory ? 'new' : 'legacy', item, ids: isNewMemory ? sourceIds : [item.representative_id || item.id] })} disabled={isDeleting}>
                    <Edit2 size={14} /> 编辑
                </button>
                <button className="memory-lib-button compact danger" onClick={() => onDelete?.({ type: isNewMemory ? 'new' : 'legacy', item, ids: isNewMemory ? sourceIds : [item.representative_id || item.id] })} disabled={isDeleting}>
                    <Trash2 size={14} /> {isDeleting ? '删除中' : '删除'}
                </button>
            </div>
        </div>
    );
}

function EntryList({ items = [], emptyText, mode, onRescue, onCharacterClick, onEdit, onDelete, onViewSource, rescuingIds, deletingIds = [] }) {
    if (!items.length) return <div className="memory-lib-empty">{emptyText}</div>;
    return (
        <div className="memory-entry-list">
            {items.map(item => {
                const sourceIds = Array.isArray(item.source_ids) && item.source_ids.length
                    ? item.source_ids
                    : [item.representative_id || item.id].filter(Boolean);
                const isRescuing = sourceIds.some(id => rescuingIds?.includes(Number(id)))
                    || rescuingIds?.includes(item.id);
                return (
                    <MemoryEntryRow
                        key={`${mode}-${item.id}`}
                        item={item}
                        mode={mode}
                        onRescue={onRescue}
                        onCharacterClick={onCharacterClick}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onViewSource={onViewSource}
                        rescuing={isRescuing}
                        deletingIds={deletingIds}
                    />
                );
            })}
        </div>
    );
}

function TimelineList({ items = [], emptyText, onCharacterClick, onEdit, onDelete, onViewSource, deletingIds = [] }) {
    const [zoom, setZoom] = useState(0.7);
    const [filter, setFilter] = useState('all');
    const [activeClusterKey, setActiveClusterKey] = useState('');
    const view = useMemo(() => buildTimelineGraph(items, filter), [items, filter]);
    const timelineLayout = useMemo(() => {
        const clusterGap = Math.round(112 + zoom * 30);
        const padding = 86;
        const branchGap = 58;
        const branchBase = 42;
        const maxBranchTiers = view.clusters.reduce((max, cluster) => {
            const topCount = Math.ceil((cluster.items?.length || 0) / 2);
            const bottomCount = Math.floor((cluster.items?.length || 0) / 2);
            return Math.max(max, topCount, bottomCount);
        }, 1);
        const height = Math.max(360, branchBase * 2 + Math.max(1, maxBranchTiers) * branchGap * 2 + 86);
        const clusterXs = new Map();
        view.clusters.forEach((cluster, index) => {
            clusterXs.set(cluster.key, padding + index * clusterGap);
        });
        const width = Math.max(620, padding * 2 + Math.max(0, view.clusters.length - 1) * clusterGap);
        const months = view.months.map(month => {
            const monthClusters = view.clusters.filter(cluster => cluster.month_key === month.key);
            const first = monthClusters[0];
            const last = monthClusters[monthClusters.length - 1];
            const firstX = first ? clusterXs.get(first.key) : padding;
            const lastX = last ? clusterXs.get(last.key) : firstX;
            return { ...month, x: Math.round((Number(firstX || 0) + Number(lastX || 0)) / 2) };
        });
        return { branchBase, branchGap, clusterXs, height, months, width };
    }, [view.clusters, view.months, zoom]);
    const activeCluster = view.clusters.find(cluster => cluster.key === activeClusterKey)
        || view.clusters[view.clusters.length - 1]
        || null;

    useEffect(() => {
        if (!view.clusters.length) {
            setActiveClusterKey('');
            return;
        }
        if (!view.clusters.some(cluster => cluster.key === activeClusterKey)) {
            setActiveClusterKey(view.clusters[view.clusters.length - 1].key);
        }
    }, [activeClusterKey, view.clusters]);

    const scrollToMonth = (monthKey) => {
        const target = view.clusters.find(cluster => cluster.month_key === monthKey);
        if (!target) return;
        setActiveClusterKey(target.key);
        window.requestAnimationFrame(() => {
            document.getElementById(`memory-timeline-node-${target.key}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        });
    };

    if (!items.length) return <div className="memory-lib-empty">{emptyText}</div>;
    if (!view.clusters.length) return <div className="memory-lib-empty">当前筛选下没有可放到时间线上的记忆。</div>;

    const axisWidth = `${timelineLayout.width}px`;
    return (
        <div className="memory-timeline-list">
            <div className="memory-timeline-toolbar">
                <div className="memory-timeline-tabs">
                    {TIMELINE_FILTERS.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            className={filter === tab.key ? 'active' : ''}
                            onClick={() => setFilter(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <label className="memory-timeline-zoom">
                    <span>缩放 {zoom.toFixed(1)}x</span>
                    <input
                        type="range"
                        min="0.3"
                        max="12"
                        step="0.2"
                        value={zoom}
                        onChange={event => setZoom(Number(event.target.value))}
                    />
                </label>
            </div>

            <div className="memory-timeline-summary">
                <strong>{formatDate(view.range_start)} - {formatDate(view.range_end)}</strong>
                <span>{formatNumber(view.filtered.length)} 条时间强绑定记忆</span>
                <span>{formatNumber(view.clusters.length)} 个日期节点</span>
                <span>只显示已打时间标签的记忆；点击节点查看当天条目。</span>
            </div>

            <div className="memory-timeline-month-strip">
                {view.months.map(month => (
                    <button
                        type="button"
                        key={month.key}
                        onClick={() => scrollToMonth(month.key)}
                    >
                        <strong>{month.label}</strong>
                        <span>{formatNumber(month.count)} 条</span>
                        <small>临时 {formatNumber(month.temporary_count)} / 快遗忘 {formatNumber(month.expiring_count)}</small>
                    </button>
                ))}
            </div>

            <div className="memory-timeline-scroll">
                <div
                    className="memory-timeline-axis"
                    style={{
                        width: axisWidth,
                        '--timeline-axis-height': `${timelineLayout.height}px`
                    }}
                >
                    <div className="memory-timeline-line" />
                    {timelineLayout.months.map(month => (
                        <div
                            className="memory-timeline-tick"
                            key={`tick-${month.key}`}
                            style={{ left: `${month.x}px` }}
                        >
                            <span>{month.label}</span>
                        </div>
                    ))}
                    {view.clusters.map(cluster => {
                        const previewItems = cluster.items;
                        return (
                            <div
                                className={`memory-timeline-cluster ${activeCluster?.key === cluster.key ? 'active' : ''}`}
                                key={cluster.key}
                                style={{ left: `${timelineLayout.clusterXs.get(cluster.key) || 0}px` }}
                            >
                                <button
                                    type="button"
                                    id={`memory-timeline-node-${cluster.key}`}
                                    className={`memory-timeline-node ${cluster.dominant_label}`}
                                    onClick={() => setActiveClusterKey(cluster.key)}
                                    title={`${cluster.label}，${cluster.count} 条记忆`}
                                >
                                    <span>{cluster.label.replace(/\s.+$/, '')}</span>
                                    <b>{formatNumber(cluster.count)}</b>
                                </button>
                                {previewItems.map((item, index) => {
                                    const isTop = index % 2 === 0;
                                    const tier = Math.floor(index / 2);
                                    const branchOffset = timelineLayout.branchBase + tier * timelineLayout.branchGap;
                                    return (
                                        <button
                                            type="button"
                                            key={`${cluster.key}-${item.id}`}
                                            className={`memory-timeline-branch-card ${isTop ? 'top' : 'bottom'} ${item.temporal_label}`}
                                            style={{ '--branch-offset': `${branchOffset}px` }}
                                            onClick={() => setActiveClusterKey(cluster.key)}
                                            title={item.text || '空记忆条目'}
                                        >
                                            <span>{item.source_time_text || formatDateTime(item.timeline_at || item.created_at)}</span>
                                            <p>{item.text || '空记忆条目'}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {activeCluster && (
                <div className="memory-timeline-detail">
                    <div className="memory-timeline-detail-head">
                        <div>
                            <h4>{activeCluster.label}</h4>
                            <p>{activeCluster.month_label}，共 {formatNumber(activeCluster.count)} 条记忆。</p>
                        </div>
                        <div className="memory-timeline-cluster-stats">
                            <span>临时 {formatNumber(activeCluster.temporary_count)}</span>
                            <span>快遗忘 {formatNumber(activeCluster.expiring_count)}</span>
                            {Object.entries(activeCluster.counts).map(([key, count]) => (
                                <span className={`memory-temporal-badge ${key}`} key={key}>
                                    {TEMPORAL_BADGES[key]?.label || key} {formatNumber(count)}
                                </span>
                            ))}
                        </div>
                    </div>
                    <EntryList
                        items={activeCluster.items}
                        mode="timeline"
                        emptyText="这个日期节点没有记忆条目。"
                        onCharacterClick={onCharacterClick}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onViewSource={onViewSource}
                        deletingIds={deletingIds}
                    />
                </div>
            )}
        </div>
    );
}

function NewMemorySummaryRow({ item, onCharacterClick, onEdit, onDelete, onViewSource, deletingIds = [] }) {
    const sourceContexts = Array.isArray(item.source_contexts) && item.source_contexts.length
        ? item.source_contexts
        : [item.source_context || 'unknown'];
    const sceneTags = Array.isArray(item.scene_tags) && item.scene_tags.length
        ? item.scene_tags
        : [item.scene_tag || 'none'];
    const sourceIds = Array.isArray(item.source_ids) ? item.source_ids : [];
    const isDeleting = sourceIds.some(id => deletingIds.includes(Number(id)));
    const forgettingLabel = formatForgettingLabel(item);
    return (
        <div className="memory-new-summary-card">
            <div className="memory-entry-meta">
                <button type="button" className="memory-entry-character" onClick={() => onCharacterClick?.(item.character_id)}>
                    {item.character_name}
                </button>
                <span>{item.memory_focus} / {item.memory_tier}</span>
                <span>{sourceContexts.join(' / ')}</span>
                <span>{sceneTags.join(' / ')}</span>
                <span>来源 {formatNumber(item.source_count)} 条</span>
                <span>重要性 {item.importance}</span>
                <span>{item.retention_action || 'keep'}</span>
                <b>{forgettingLabel}</b>
            </div>
            <div className="memory-new-summary-text">{item.summary || '空总结'}</div>
            <div className="memory-entry-foot">
                {item.consolidation_key && <span>{item.consolidation_key}</span>}
                <span>更新 {formatDate(item.updated_at)}</span>
                <span>分数 {Number(item.retention_score || 0).toFixed(2)}</span>
                <span>{(item.source_ids || []).slice(0, 8).map(id => `#${id}`).join(' ')}</span>
            </div>
            {item.source_preview?.length > 0 && (
                <div className="memory-new-source-preview">
                    {item.source_preview.map(source => (
                        <div key={source.id}><b>#{source.id}</b> {source.text}</div>
                    ))}
                </div>
            )}
            <div className="memory-entry-actions">
                <button className="memory-lib-button compact ghost" onClick={() => onViewSource?.({ item, ids: sourceIds.length ? sourceIds : [item.representative_id].filter(Boolean) })}>
                    <FileText size={14} /> 原文
                </button>
                <button className="memory-lib-button compact ghost" onClick={() => onEdit?.({ type: 'new', item, ids: item.source_ids || [] })} disabled={isDeleting}>
                    <Edit2 size={14} /> 编辑
                </button>
                <button className="memory-lib-button compact danger" onClick={() => onDelete?.({ type: 'new', item, ids: item.source_ids || [] })} disabled={isDeleting}>
                    <Trash2 size={14} /> {isDeleting ? '删除中' : '删除'}
                </button>
            </div>
        </div>
    );
}

function NewSummaryList({ items = [], emptyText, onCharacterClick, onEdit, onDelete, onViewSource, deletingIds = [] }) {
    if (!items.length) return <div className="memory-lib-empty">{emptyText}</div>;
    return (
        <div className="memory-new-summary-list">
            {items.map(item => (
                <NewMemorySummaryRow key={item.id} item={item} onCharacterClick={onCharacterClick} onEdit={onEdit} onDelete={onDelete} onViewSource={onViewSource} deletingIds={deletingIds} />
            ))}
        </div>
    );
}

function formatSourceKind(kind = '') {
    if (kind === 'private_chat') return '私聊';
    if (kind === 'group_chat') return '群聊';
    if (kind === 'commercial_street') return '商业街';
    return '未知来源';
}

function SourceViewerModal({ viewer, onClose }) {
    if (!viewer) return null;
    const data = viewer.data || {};
    const memories = data.memories || [];
    const sources = data.sources || [];
    const stats = data.stats || {};
    return (
        <div className="memory-edit-overlay">
            <div className="memory-source-modal">
                <div className="memory-edit-head">
                    <div>
                        <strong>来源原文</strong>
                        <span>{viewer.item?.summary || viewer.item?.text || '记忆来源追溯'}</span>
                    </div>
                    <button type="button" className="memory-edit-close" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>
                {viewer.loading ? (
                    <div className="memory-source-empty">正在读取来源原文...</div>
                ) : viewer.error ? (
                    <div className="memory-lib-error">{viewer.error}</div>
                ) : (
                    <>
                        <div className="memory-source-summary">
                            <span>承载卡片 {formatNumber(stats.memory_count || memories.length)}</span>
                            <span>来源引用 {formatNumber(stats.source_ref_count || sources.length)}</span>
                            <span>找到原文 {formatNumber(stats.found_source_count || sources.filter(source => source.found).length)}</span>
                            {Number(stats.missing_source_count || 0) > 0 && <b>缺失 {formatNumber(stats.missing_source_count)}</b>}
                        </div>
                        {memories.length > 0 && (
                            <div className="memory-source-memory-list">
                                {memories.map(memory => (
                                    <div key={memory.id}>
                                        <b>#{memory.id}</b>
                                        <span>{memory.summary || '空记忆'}</span>
                                        {memory.source_time_text && <small>{memory.source_time_text}</small>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {sources.length === 0 ? (
                            <div className="memory-source-empty">这条记忆没有保存可反查的原始消息 id；只能追到记忆卡片本身。</div>
                        ) : (
                            <div className="memory-source-list">
                                {sources.map(source => (
                                    <div className={`memory-source-line ${source.found ? '' : 'missing'}`} key={source.source_key}>
                                        <div className="memory-source-line-meta">
                                            <span>{formatSourceKind(source.kind)} #{source.id || source.raw_ref}</span>
                                            {source.timestamp > 0 && <span>{formatDateTime(source.timestamp)}</span>}
                                            {source.speaker && <b>{source.speaker}</b>}
                                            {source.location && <span>{source.location}</span>}
                                            {!source.found && <b>原文缺失</b>}
                                        </div>
                                        <div className="memory-source-line-text">
                                            {source.found ? (source.content || '空内容') : `找不到 ${source.raw_ref || source.source_key} 对应的原始记录。`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function MemoryLibraryPanel({ apiUrl, contacts = [] }) {
    const { lang } = useLanguage();
    const statsRef = useRef(null);
    const progressRefreshRef = useRef(null);
    const activeRunMissRef = useRef(0);
    const [overview, setOverview] = useState(null);
    const [library, setLibrary] = useState(null);
    const [settings, setSettings] = useState(emptySettings);
    const [activeCharacterId, setActiveCharacterId] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modelFetching, setModelFetching] = useState(false);
    const [models, setModels] = useState([]);
    const [modelError, setModelError] = useState('');
    const [notice, setNotice] = useState('');
    const [batchPreview, setBatchPreview] = useState(null);
    const [promptPreview, setPromptPreview] = useState('');
    const [temporalPromptPreview, setTemporalPromptPreview] = useState('');
    const temporalPromptSource = 'new';
    const [batchLoading, setBatchLoading] = useState(false);
    const [temporalPromptLoading, setTemporalPromptLoading] = useState(false);
    const [runLoading, setRunLoading] = useState(false);
    const [autoLoading, setAutoLoading] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const [autoProgress, setAutoProgress] = useState(null);
    const [autoProgressLog, setAutoProgressLog] = useState([]);
    const [selectedCharacterId, setSelectedCharacterId] = useState('');
    const [libraryViewMode, setLibraryViewMode] = useState('new');
    const [maintenanceMode, setMaintenanceMode] = useState('manual');
    const [promptTaskMode, setPromptTaskMode] = useState('complete');
    const [manualBatchIndex, setManualBatchIndex] = useState(1);
    const [autoMaxBatches, setAutoMaxBatches] = useState('');
    const [rescuingIds, setRescuingIds] = useState([]);
    const [deletingIds, setDeletingIds] = useState([]);
    const [editingMemory, setEditingMemory] = useState(null);
    const [sourceViewer, setSourceViewer] = useState(null);
    const [editSaving, setEditSaving] = useState(false);
    const [openGroups, setOpenGroups] = useState({ category_user_profile: true, source_commercial_street: true, source_group_chat: true, forgetting_fast: true, time_bound_timeline: true });

    const headers = useMemo(() => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`
    }), []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({ all: '1' });
            if (activeCharacterId) query.set('character_id', activeCharacterId);
            query.set('timeline_filter', 'strong_time_bound');
            query.set('source', libraryViewMode === 'old' ? 'legacy' : 'new');
            const [overviewRes, libraryRes] = await Promise.all([
                fetch(`${apiUrl}/memory-maintenance/overview`, { headers }),
                fetch(`${apiUrl}/memory-maintenance/library?${query.toString()}`, { headers })
            ]);
            const overviewData = await overviewRes.json().catch(() => ({}));
            const libraryData = await libraryRes.json().catch(() => ({}));
            if (!overviewRes.ok || !overviewData.success) throw new Error(overviewData.error || 'Failed to load overview');
            if (!libraryRes.ok || !libraryData.success) throw new Error(libraryData.error || 'Failed to load library');
            setOverview(overviewData.overview || null);
            setLibrary(libraryData.library || null);
            setSettings({ ...emptySettings, ...(overviewData.settings || {}) });
            const topCharacter = overviewData.overview?.migration_characters?.[0]?.character_id
                || overviewData.overview?.by_character?.[0]?.character_id
                || contacts?.[0]?.id
                || '';
            setSelectedCharacterId(prev => prev || topCharacter);
        } catch (e) {
            console.error('Failed to load memory library:', e);
        } finally {
            setLoading(false);
        }
    }, [activeCharacterId, apiUrl, contacts, headers, libraryViewMode]);

    const scheduleProgressRefresh = useCallback((delay = 700) => {
        if (progressRefreshRef.current) {
            clearTimeout(progressRefreshRef.current);
        }
        progressRefreshRef.current = window.setTimeout(() => {
            progressRefreshRef.current = null;
            loadData();
        }, delay);
    }, [loadData]);

    const adoptRunSnapshot = useCallback((run) => {
        if (!run?.run_id) return;
        activeRunMissRef.current = 0;
        const events = Array.isArray(run.events) ? run.events : [];
        setAutoProgress({
            ...run,
            running: !!run.running,
            last_event: events[events.length - 1] || run
        });
        setAutoProgressLog(events);
        setAutoLoading(!!run.running);
        if (run.characterId) {
            setSelectedCharacterId(prev => prev || run.characterId);
        }
    }, []);

    const markAutoRunMissing = useCallback(() => {
        activeRunMissRef.current = 0;
        if (!autoProgress?.running) {
            setAutoLoading(false);
            return;
        }
        const event = {
            ...autoProgress,
            running: false,
            phase: 'stopped',
            stopped_reason: 'backend_missing',
            message: '后端没有找到正在运行的自动任务，可能是后端重启或任务已被清掉。',
            timestamp: Date.now()
        };
        setAutoProgress(event);
        setAutoProgressLog(prev => [...prev, event].slice(-80));
        setAutoLoading(false);
        setRunResult({
            mode: 'auto',
            task_mode: autoProgress.task_mode,
            success: false,
            character: autoProgress.character,
            stopped_reason: 'backend_missing',
            can_continue: false,
            continue_from: null,
            stats: autoProgress.stats,
            errors: [],
            processed: autoProgress.processed || 0,
            updated: autoProgress.updated || 0,
            run_until_empty: autoProgress.run_until_empty,
            max_batches: autoProgress.max_batches,
            max_rerolls: autoProgress.max_rerolls
        });
        setNotice('后端已经没有这个自动任务了，页面已把旧进度标成停止；可以重新点开始自动工作。');
        scheduleProgressRefresh(100);
    }, [autoProgress, scheduleProgressRefresh]);

    const loadMaintenanceRunSnapshot = useCallback(async (runId) => {
        if (!runId) return false;
        try {
            const res = await fetch(`${apiUrl}/memory-maintenance/runs/${encodeURIComponent(runId)}`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success || !data.run) return false;
            adoptRunSnapshot(data.run);
            return true;
        } catch (e) {
            console.warn('Failed to load memory maintenance run:', e.message);
            return false;
        }
    }, [adoptRunSnapshot, apiUrl, headers]);

    const loadActiveMaintenanceRun = useCallback(async () => {
        try {
            const query = new URLSearchParams({ active: '1' });
            if (selectedCharacterId) query.set('character_id', selectedCharacterId);
            const res = await fetch(`${apiUrl}/memory-maintenance/runs?${query.toString()}`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) return false;
            const run = (data.runs || [])[0];
            if (run) {
                adoptRunSnapshot(run);
                return true;
            }
            return false;
        } catch (e) {
            console.warn('Failed to load active memory maintenance run:', e.message);
            return false;
        }
    }, [adoptRunSnapshot, apiUrl, headers, selectedCharacterId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        loadActiveMaintenanceRun();
    }, [loadActiveMaintenanceRun]);

    useEffect(() => {
        if (!autoLoading && autoProgress?.running !== true) return undefined;
        const timer = window.setInterval(async () => {
            const found = autoProgress?.run_id
                ? await loadMaintenanceRunSnapshot(autoProgress.run_id)
                : false;
            const foundActive = found || await loadActiveMaintenanceRun();
            if (foundActive) {
                activeRunMissRef.current = 0;
            } else {
                activeRunMissRef.current += 1;
                if (activeRunMissRef.current >= 2) {
                    markAutoRunMissing();
                }
            }
            scheduleProgressRefresh(150);
        }, 4000);
        return () => window.clearInterval(timer);
    }, [
        autoLoading,
        autoProgress?.run_id,
        autoProgress?.running,
        loadActiveMaintenanceRun,
        loadMaintenanceRunSnapshot,
        markAutoRunMissing,
        scheduleProgressRefresh
    ]);

    useEffect(() => () => {
        if (progressRefreshRef.current) {
            clearTimeout(progressRefreshRef.current);
        }
    }, []);

    useEffect(() => {
        const handleMaintenanceProgress = (event) => {
            const detail = event.detail || {};
            if (!detail.run_id) return;
            activeRunMissRef.current = 0;
            const eventCharacterId = String(detail.characterId || detail.character?.id || '');
            const currentCharacterId = String(selectedCharacterId || '');
            setAutoProgress(prev => {
                const sameRun = prev?.run_id && prev.run_id === detail.run_id;
                const relevantCharacter = !currentCharacterId || eventCharacterId === currentCharacterId;
                if (!sameRun && !relevantCharacter) return prev;
                const isTerminal = detail.phase === 'done' || detail.phase === 'stopped';
                return {
                    ...(prev || {}),
                    ...detail,
                    running: !isTerminal,
                    last_event: detail
                };
            });
            setAutoProgressLog(prev => {
                const sameCurrentRun = autoProgress?.run_id && autoProgress.run_id === detail.run_id;
                const relevantCharacter = !currentCharacterId || eventCharacterId === currentCharacterId;
                if (!sameCurrentRun && !relevantCharacter) return prev;
                return [...prev, detail].slice(-80);
            });
            if (['batch_success', 'batch_empty', 'done', 'stopped'].includes(detail.phase)) {
                scheduleProgressRefresh(detail.phase === 'batch_success' ? 700 : 100);
            }
            if (detail.phase === 'done' || detail.phase === 'stopped') {
                setAutoLoading(false);
                setRunResult({
                    mode: 'auto',
                    task_mode: detail.task_mode,
                    success: detail.success,
                    character: detail.character,
                    stopped_reason: detail.stopped_reason,
                    can_continue: detail.can_continue,
                    continue_from: detail.continue_from,
                    stats: detail.stats,
                    errors: detail.errors || [],
                    processed: detail.processed || 0,
                    updated: detail.updated || 0,
                    run_until_empty: detail.run_until_empty,
                    max_batches: detail.max_batches,
                    max_rerolls: detail.max_rerolls
                });
            }
        };
        window.addEventListener('memory_maintenance_progress', handleMaintenanceProgress);
        return () => window.removeEventListener('memory_maintenance_progress', handleMaintenanceProgress);
    }, [autoProgress?.run_id, scheduleProgressRefresh, selectedCharacterId]);

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
            setSettings({ ...emptySettings, ...(data.settings || {}) });
            setNotice('小模型配置已保存。');
        } catch (e) {
            alert(lang === 'en' ? `Save failed: ${e.message}` : `保存失败：${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const fetchModels = async () => {
        if (!settings.api_endpoint || !settings.api_key) {
            setModelError(lang === 'en' ? 'Fill endpoint and key first.' : '请先填写 URL 和 Key。');
            return;
        }
        setModelFetching(true);
        setModelError('');
        setModels([]);
        try {
            const res = await fetch(`${apiUrl}/models?endpoint=${encodeURIComponent(settings.api_endpoint)}&key=${encodeURIComponent(settings.api_key)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            const nextModels = data.models || [];
            setModels(nextModels);
            if (!nextModels.length) setModelError(lang === 'en' ? 'No models found.' : '没有找到模型。');
        } catch (e) {
            setModelError(lang === 'en' ? `Fetch failed: ${e.message}` : `拉取失败：${e.message}`);
        } finally {
            setModelFetching(false);
        }
    };

    const loadBatchPreview = async () => {
        if (!selectedCharacterId) return;
        setBatchLoading(true);
        try {
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 30)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const res = await fetch(`${apiUrl}/memories/${selectedCharacterId}/maintenance/batch?limit=${limit}&offset=${offset}&status=pending`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Batch load failed');
            setBatchPreview(data);
            setPromptPreview(data.prompt?.full_prompt || '');
            setRunResult(null);
        } catch (e) {
            alert(lang === 'en' ? `Batch load failed: ${e.message}` : `读取批次失败：${e.message}`);
        } finally {
            setBatchLoading(false);
        }
    };

    const loadTemporalPromptPreview = async () => {
        if (!selectedCharacterId) return;
        setTemporalPromptLoading(true);
        try {
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 40)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const query = new URLSearchParams({
                limit: String(limit),
                offset: String(offset),
                source: temporalPromptSource
            });
            const res = await fetch(`${apiUrl}/memories/${selectedCharacterId}/maintenance/temporal-binding-batch?${query.toString()}`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Temporal prompt load failed');
            setTemporalPromptPreview(data.prompt?.full_prompt || '');
            setNotice(`已生成来源场景+时间标签 prompt：新版库第 ${data.batch_index || batchIndex} 批，${data.items?.length || 0} 条。`);
        } catch (e) {
            alert(`读取时间绑定补充 prompt 失败：${e.message}`);
        } finally {
            setTemporalPromptLoading(false);
        }
    };

    const runBatchMigration = async () => {
        if (!selectedCharacterId) return;
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert('请先填写并保存小模型 URL、Key 和模型名。');
            return;
        }
        const confirmBatchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
        if (!window.confirm(`将调用小模型处理当前角色第 ${confirmBatchIndex} 批旧记忆卡片，每批 ${settings.batch_size} 条，输出上限 ${settings.max_output_tokens || 8000} tokens，并把结果写回记忆维护状态。继续吗？`)) {
            return;
        }
        setRunLoading(true);
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 30)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const res = await fetch(`${apiUrl}/memories/${selectedCharacterId}/maintenance/run`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ limit, offset, status: 'pending' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                if (data.raw_response || data.prompt) {
                    setRunResult(data);
                    setPromptPreview(data.prompt?.full_prompt || promptPreview);
                }
                throw new Error(data.error || 'Small model run failed');
            }
            setRunResult(data);
            setBatchPreview(prev => prev || { items: (data.normalized?.apply_items || []).map(item => ({ id: item.id })) });
            setPromptPreview(data.prompt?.full_prompt || promptPreview);
            setNotice(`手动第 ${data.batch?.batch_index || batchIndex} 批已处理 ${data.batch?.item_count || 0} 条，应用更新 ${data.apply?.updated || 0} 条。`);
            await loadData();
        } catch (e) {
            alert(`小模型归纳失败：${e.message}`);
        } finally {
            setRunLoading(false);
        }
    };

    const runTemporalBindingBatch = async () => {
        if (!selectedCharacterId) return;
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert('请先填写并保存小模型 URL、Key 和模型名。');
            return;
        }
        const confirmBatchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
        if (!window.confirm(`将调用小模型给当前角色第 ${confirmBatchIndex} 批新版记忆补来源场景和时间标签，每批 ${settings.batch_size} 条。它不会改写记忆内容。继续吗？`)) {
            return;
        }
        setRunLoading(true);
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 40)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const res = await fetch(`${apiUrl}/memories/${selectedCharacterId}/maintenance/temporal-binding-run`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ limit, offset, source: 'new' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                if (data.raw_response || data.prompt) {
                    setRunResult(data);
                    setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
                }
                throw new Error(data.error || 'Small model supplemental run failed');
            }
            setRunResult({ ...data, mode: 'supplement' });
            setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
            setNotice(`补充第 ${data.batch?.batch_index || batchIndex} 批已处理 ${data.batch?.item_count || 0} 条，写回 ${data.apply?.updated || 0} 条。`);
            await loadData();
        } catch (e) {
            alert(`小模型补充失败：${e.message}`);
        } finally {
            setRunLoading(false);
        }
    };

    const previewSelectedPrompt = () => {
        if (promptTaskMode === 'complete') {
            loadBatchPreview();
            return;
        }
        loadTemporalPromptPreview();
    };

    const runSelectedPromptTask = () => {
        if (promptTaskMode === 'complete') {
            runBatchMigration();
            return;
        }
        runTemporalBindingBatch();
    };

    const runAutoMigration = async (runOptions = {}) => {
        const options = runOptions?.nativeEvent ? {} : (runOptions || {});
        const targetCharacterId = options.characterId || selectedCharacterId;
        const isContinuation = options.continuation === true;
        if (!targetCharacterId) return;
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert('请先填写并保存小模型 URL、Key 和模型名。');
            return;
        }
        const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 30)));
        const runUntilEmpty = String(autoMaxBatches || '').trim() === '';
        const maxBatches = runUntilEmpty ? null : Math.max(1, Number(autoMaxBatches || 1) || 1);
        const runScopeText = isContinuation
            ? '从断点处重新读取剩余 pending 并继续'
            : (runUntilEmpty ? '一直跑到待分类为空或失败' : `最多 ${maxBatches} 批`);
        if (!options.skipConfirm && !window.confirm(`自动总结会从当前角色的待分类记忆开头连续处理，${runScopeText}，每批 ${limit} 条，输出上限 ${settings.max_output_tokens || 8000} tokens，并把结果写回记忆维护状态。继续吗？`)) {
            return;
        }
        setAutoLoading(true);
        activeRunMissRef.current = 0;
        setAutoProgress({
            running: true,
            phase: 'start',
            characterId: targetCharacterId,
            processed: 0,
            updated: 0,
            applied_errors: 0,
            limit,
            max_batches: maxBatches,
            run_until_empty: runUntilEmpty,
            message: isContinuation ? '准备从断点继续。' : '准备开始自动总结。'
        });
        setAutoProgressLog([]);
        let keepAutoLoading = false;
        try {
            if (isContinuation) {
                setNotice('正在从断点处继续自动总结，会重新读取当前剩余 pending 的第一批。');
            }
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });
            const res = await fetch(`${apiUrl}/memories/${targetCharacterId}/maintenance/auto-run`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    limit,
                    max_batches: maxBatches,
                    run_until_empty: runUntilEmpty,
                    max_rerolls: 3,
                    status: 'pending',
                    continue_from_breakpoint: isContinuation,
                    background: true
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                setRunResult(data);
                setBatchPreview(null);
                setPromptPreview(data.prompt?.full_prompt || promptPreview);
                await loadData();
                const lastError = (data.errors || []).slice(-1)[0]?.error;
                throw new Error(lastError || data.error || 'Auto migration failed');
            }
            if (data.accepted) {
                keepAutoLoading = !!data.run?.running;
                if (data.run) adoptRunSnapshot(data.run);
                setRunResult(null);
                setBatchPreview(null);
                setNotice(data.reused
                    ? '已有自动总结任务正在后台运行，已恢复进度显示。'
                    : `${isContinuation ? '继续任务' : '自动总结'}已在后台启动，切换页面或刷新不会打断。`);
                scheduleProgressRefresh(300);
                return;
            }
            setRunResult(data);
            setAutoProgress(prev => ({
                ...(prev || {}),
                running: false,
                phase: 'done',
                processed: data.processed || 0,
                updated: data.updated || 0,
                stopped_reason: data.stopped_reason,
                stats: data.stats
            }));
            setBatchPreview(null);
            setPromptPreview(data.prompt?.full_prompt || promptPreview);
            const realRuns = (data.runs || []).filter(item => !item.empty).length;
            const rerollCount = (data.runs || []).reduce((sum, item) => sum + Number(item.rerolls || 0), 0);
            const rerollText = rerollCount ? `，重 roll ${rerollCount} 次` : '';
            const stoppedText = data.stopped_reason ? `，停止原因：${formatStoppedReason(data.stopped_reason)}` : '';
            setNotice(`${isContinuation ? '继续任务完成' : '自动总结完成'}：跑了 ${realRuns} 批，处理 ${data.processed || 0} 条，应用更新 ${data.updated || 0} 条${rerollText}${stoppedText}。`);
            await loadData();
        } catch (e) {
            setAutoProgress(prev => prev ? { ...prev, running: false, phase: prev.phase === 'stopped' ? prev.phase : 'stopped' } : prev);
            alert(`${isContinuation ? '继续任务失败' : '自动总结失败'}：${e.message}`);
        } finally {
            setAutoLoading(keepAutoLoading);
        }
    };

    const runAutoSupplement = async (runOptions = {}) => {
        const options = runOptions?.nativeEvent ? {} : (runOptions || {});
        const targetCharacterId = options.characterId || selectedCharacterId;
        const isContinuation = options.continuation === true;
        if (!targetCharacterId) return;
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert('请先填写并保存小模型 URL、Key 和模型名。');
            return;
        }
        const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 40)));
        const runUntilEmpty = String(autoMaxBatches || '').trim() === '';
        const maxBatches = runUntilEmpty ? null : Math.max(1, Number(autoMaxBatches || 1) || 1);
        const runScopeText = isContinuation
            ? '从断点处继续补充'
            : (runUntilEmpty ? '扫完整个新版库或失败' : `最多 ${maxBatches} 批`);
        if (!options.skipConfirm && !window.confirm(`自动补充会连续处理当前角色的新版记忆，${runScopeText}，每批 ${limit} 条，补来源场景和时间标签，不改写记忆。继续吗？`)) {
            return;
        }
        setAutoLoading(true);
        activeRunMissRef.current = 0;
        setAutoProgress({
            running: true,
            task_mode: 'supplement',
            phase: 'start',
            characterId: targetCharacterId,
            processed: 0,
            updated: 0,
            applied_errors: 0,
            limit,
            max_batches: maxBatches,
            run_until_empty: runUntilEmpty,
            message: isContinuation ? '准备继续自动补充。' : '准备开始自动补充。'
        });
        setAutoProgressLog([]);
        let keepAutoLoading = false;
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });
            const res = await fetch(`${apiUrl}/memories/${targetCharacterId}/maintenance/temporal-binding-auto-run`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    limit,
                    max_batches: maxBatches,
                    run_until_empty: runUntilEmpty,
                    max_rerolls: 3,
                    source: 'new',
                    continue_from_breakpoint: isContinuation,
                    background: true
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                setRunResult(data);
                setBatchPreview(null);
                setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
                await loadData();
                const lastError = (data.errors || []).slice(-1)[0]?.error;
                throw new Error(lastError || data.error || 'Auto supplemental run failed');
            }
            if (data.accepted) {
                keepAutoLoading = !!data.run?.running;
                if (data.run) adoptRunSnapshot(data.run);
                setRunResult(null);
                setBatchPreview(null);
                setNotice(data.reused
                    ? '已有自动任务正在后台运行，已恢复进度显示。'
                    : `${isContinuation ? '继续补充' : '自动补充'}已在后台启动，切换页面或刷新不会打断。`);
                scheduleProgressRefresh(300);
                return;
            }
            setRunResult({ ...data, task_mode: 'supplement' });
            setAutoProgress(prev => ({
                ...(prev || {}),
                running: false,
                task_mode: 'supplement',
                phase: 'done',
                processed: data.processed || 0,
                updated: data.updated || 0,
                stopped_reason: data.stopped_reason,
                stats: data.stats
            }));
            setBatchPreview(null);
            setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
            const realRuns = (data.runs || []).filter(item => !item.empty).length;
            const rerollCount = (data.runs || []).reduce((sum, item) => sum + Number(item.rerolls || 0), 0);
            const rerollText = rerollCount ? `，重 roll ${rerollCount} 次` : '';
            const stoppedText = data.stopped_reason ? `，停止原因：${formatStoppedReason(data.stopped_reason)}` : '';
            setNotice(`${isContinuation ? '继续补充完成' : '自动补充完成'}：跑了 ${realRuns} 批，处理 ${data.processed || 0} 条，写回 ${data.updated || 0} 条${rerollText}${stoppedText}。`);
            await loadData();
        } catch (e) {
            setAutoProgress(prev => prev ? { ...prev, running: false, phase: prev.phase === 'stopped' ? prev.phase : 'stopped' } : prev);
            alert(`${isContinuation ? '继续补充失败' : '自动补充失败'}：${e.message}`);
        } finally {
            setAutoLoading(keepAutoLoading);
        }
    };

    const runAutoSelectedTask = (options = {}) => {
        if (promptTaskMode === 'complete') {
            runAutoMigration(options);
            return;
        }
        runAutoSupplement(options);
    };

    const openMemoryEditor = ({ type, item, ids }) => {
        const safeIds = (Array.isArray(ids) ? ids : [item?.id]).filter(Boolean);
        setEditingMemory({
            type,
            ids: safeIds,
            character_id: item?.character_id || '',
            title: type === 'new' ? '编辑新版记忆' : '编辑记忆条目',
            summary: type === 'new' ? (item?.summary || item?.text || '') : (item?.text || ''),
            content: type === 'new' ? (item?.summary || item?.text || '') : (item?.text || ''),
            memory_focus: item?.memory_focus || 'general',
            memory_tier: item?.memory_tier || 'ambient',
            importance: Number(item?.importance || 5),
            source_context: item?.source_context || item?.source_contexts?.[0] || 'unknown',
            scene_tag: item?.scene_tag || item?.scene_tags?.[0] || 'other'
        });
    };

    const saveMemoryEditor = async () => {
        if (!editingMemory?.ids?.length) return;
        setEditSaving(true);
        try {
            const payload = {
                memory_focus: editingMemory.memory_focus,
                memory_tier: editingMemory.memory_tier,
                importance: Number(editingMemory.importance || 5),
                source_context: editingMemory.source_context,
                scene_tag: editingMemory.scene_tag
            };
            if (editingMemory.type === 'new') {
                payload.consolidation_summary = editingMemory.summary;
            } else {
                payload.summary = editingMemory.summary;
                payload.content = editingMemory.content || editingMemory.summary;
                payload.event = editingMemory.summary;
            }
            const res = await fetch(`${apiUrl}/memories/bulk`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ ids: editingMemory.ids, patch: payload })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || '保存失败');
            setNotice(`已保存 ${formatNumber(data.updated || editingMemory.ids.length)} 条记忆修改。`);
            setEditingMemory(null);
            await loadData();
        } catch (e) {
            alert(`保存记忆失败：${e.message}`);
        } finally {
            setEditSaving(false);
        }
    };

    const openSourceViewer = async ({ item, ids }) => {
        const safeIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids])
            .map(id => Number(id || 0))
            .filter(id => id > 0)));
        if (!safeIds.length) {
            setSourceViewer({ item, loading: false, data: null, error: '这条记忆没有承载卡片 id，无法继续反查原文。' });
            return;
        }
        setSourceViewer({ item, loading: true, data: null, error: '' });
        try {
            const query = new URLSearchParams({ ids: safeIds.join(',') });
            const res = await fetch(`${apiUrl}/memory-source?${query.toString()}`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || '读取来源原文失败');
            setSourceViewer({ item, loading: false, data, error: '' });
        } catch (e) {
            setSourceViewer({ item, loading: false, data: null, error: e.message || '读取来源原文失败' });
        }
    };

    const deleteMemoryItems = async ({ type, item, ids }) => {
        const safeIds = Array.from(new Set((Array.isArray(ids) ? ids : [item?.id])
            .map(id => Number(id || 0))
            .filter(id => id > 0)));
        if (!safeIds.length) return;
        const label = type === 'new'
            ? `这条新版记忆的 ${safeIds.length} 条承载卡片`
            : `#${item?.id || safeIds[0]}`;
        if (!window.confirm(`确定删除 ${label} 吗？删除后会从记忆库和 RAG 索引里移除。`)) return;
        setDeletingIds(prev => Array.from(new Set([...prev, ...safeIds])));
        setNotice(`正在彻底删除 ${formatNumber(safeIds.length)} 条承载卡片和对应 RAG 索引...`);
        try {
            const res = await fetch(`${apiUrl}/memories/bulk`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ ids: safeIds })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || '删除失败');
            setNotice(`已彻底删除 ${formatNumber(data.deleted || 0)} / ${formatNumber(safeIds.length)} 条承载卡片，并移除对应 RAG 索引。列表正在刷新。`);
            await loadData();
        } catch (e) {
            alert(`删除记忆失败：${e.message}`);
        } finally {
            setDeletingIds(prev => prev.filter(id => !safeIds.includes(Number(id))));
        }
    };

    const rescueItem = async (ids) => {
        const safeIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids])
            .map(id => Number(id || 0))
            .filter(id => id > 0)));
        if (!safeIds.length) return;
        setRescuingIds(prev => Array.from(new Set([...prev, ...safeIds])));
        try {
            const res = await fetch(`${apiUrl}/memory-maintenance/rescue`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ids: safeIds })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Rescue failed');
            setNotice(`已救回 ${formatNumber(data.rescued || safeIds.length)} 条承载卡片，重新标记为保留并回到活跃记忆库。`);
            await loadData();
        } catch (e) {
            alert(lang === 'en' ? `Rescue failed: ${e.message}` : `救回失败：${e.message}`);
        } finally {
            setRescuingIds(prev => prev.filter(item => !safeIds.includes(Number(item))));
        }
    };

    const jumpToCharacter = useCallback((characterId = '') => {
        const nextId = String(characterId || '');
        const character = overview?.by_character?.find(item => String(item.character_id) === nextId);
        setActiveCharacterId(nextId);
        if (nextId) setSelectedCharacterId(nextId);
        setManualBatchIndex(1);
        setBatchPreview(null);
        setPromptPreview('');
        setRunResult(null);
        setNotice(nextId ? `已切到 ${character?.name || nextId} 的记忆库统计。` : '已切回全部角色记忆库。');
        window.setTimeout(() => {
            statsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    }, [overview]);

    const toggleGroup = (key) => {
        setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const totals = overview?.totals || {};
    const characterStats = overview?.by_character || [];
    const migrationCharacters = overview?.migration_characters || overview?.legacy_by_character || characterStats;
    const activeCharacter = characterStats.find(item => String(item.character_id) === String(activeCharacterId));
    const categories = library?.categories || [];
    const timeline = library?.timeline || { count: 0, items: [] };
    const newLibrary = library?.new_library || { total: 0, source_total: 0, categories: [] };
    const newCategories = newLibrary.categories || [];
    const newSourceGroups = newLibrary.source_groups || [];
    const forgettingGroups = library?.forgetting_groups || [];
    const fastForgetting = forgettingGroups.find(group => group.key === 'fast')?.count || 0;
    const onCurveForgetting = forgettingGroups.find(group => group.key === 'on_curve')?.count || 0;
    const canContinueAutoRun = runResult?.mode === 'auto'
        && (runResult.can_continue === true
            || (!runResult.success && ['error', 'no_progress'].includes(runResult.stopped_reason) && Number(runResult.stats?.pending || 0) > 0));
    const autoRunActive = autoLoading || autoProgress?.running === true;
    const latestProgressEvents = autoProgressLog.slice(-8).reverse();
    const latestProgressSamples = Array.isArray(autoProgress?.new_memory_samples) ? autoProgress.new_memory_samples : [];
    const scopedLegacyTotal = Number(activeCharacter?.legacy_total ?? totals.legacy_total ?? totals.total ?? 0);
    const scopedMigratedCards = Number(activeCharacter?.migrated_card_total ?? activeCharacter?.migrated_total ?? totals.migrated_card_total ?? totals.total ?? 0);
    const scopedFormalTotal = Number(activeCharacter?.formal_total ?? totals.formal_total ?? 0);
    const visibleFormalTotal = Number(newLibrary.total ?? scopedFormalTotal);
    const visibleSourceCards = Number(newLibrary.source_total ?? scopedMigratedCards);
    const pendingMigrationCards = Math.max(0, scopedLegacyTotal - scopedMigratedCards);
    const viewStats = activeCharacter ? {
        total: activeCharacter.total,
        formal_total: activeCharacter.formal_total,
        migrated_card_total: activeCharacter.migrated_card_total,
        legacy_total: activeCharacter.legacy_total,
        active: activeCharacter.active,
        archived: activeCharacter.archived,
        total_retrieval_count: activeCharacter.retrieval_count,
        pending: activeCharacter.pending,
        classified: activeCharacter.classified,
        forgetting_total: fastForgetting + onCurveForgetting,
        fast_forgetting: fastForgetting,
        on_curve_forgetting: onCurveForgetting
    } : {
        ...totals,
        forgetting_total: fastForgetting + onCurveForgetting,
        fast_forgetting: fastForgetting,
        on_curve_forgetting: onCurveForgetting
    };

    return (
        <div className="memory-library-page">
            <div className="memory-library-header">
                <div>
                    <div className="memory-library-kicker"><Database size={16} /> 记忆库</div>
                    <h2>{activeCharacter ? `${activeCharacter.name} 的记忆库统计` : '分类记忆与遗忘曲线'}</h2>
                    <p>{activeCharacter ? '正在显示这个角色的全部分类记忆和遗忘曲线条目。' : '每个分类直接挂载该分类的全部记忆条目；遗忘区按距离阈值从近到远排列。'}</p>
                </div>
                <button className="memory-lib-button ghost" onClick={loadData} disabled={loading}>
                    <RefreshCw size={16} /> {loading ? '刷新中' : '刷新'}
                </button>
            </div>

            {notice && <div className="memory-lib-notice">{notice}</div>}

            {editingMemory && (
                <div className="memory-edit-overlay">
                    <div className="memory-edit-modal">
                        <div className="memory-edit-head">
                            <div>
                                <strong>{editingMemory.title}</strong>
                                <span>{editingMemory.ids.length} 条承载记录</span>
                            </div>
                            <button type="button" className="memory-edit-close" onClick={() => setEditingMemory(null)}>
                                <X size={16} />
                            </button>
                        </div>
                        <label>
                            <span>{editingMemory.type === 'new' ? '新版记忆内容' : '标题/摘要'}</span>
                            <textarea
                                value={editingMemory.summary}
                                onChange={e => setEditingMemory(prev => ({ ...prev, summary: e.target.value }))}
                            />
                        </label>
                        {editingMemory.type !== 'new' && (
                            <label>
                                <span>详细内容</span>
                                <textarea
                                    value={editingMemory.content}
                                    onChange={e => setEditingMemory(prev => ({ ...prev, content: e.target.value }))}
                                />
                            </label>
                        )}
                        <div className="memory-edit-grid">
                            <label>
                                <span>语义分类</span>
                                <select value={editingMemory.memory_focus} onChange={e => setEditingMemory(prev => ({ ...prev, memory_focus: e.target.value }))}>
                                    {MEMORY_FOCUS_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>层级</span>
                                <select value={editingMemory.memory_tier} onChange={e => setEditingMemory(prev => ({ ...prev, memory_tier: e.target.value }))}>
                                    {MEMORY_TIER_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>来源场景</span>
                                <select value={editingMemory.source_context} onChange={e => setEditingMemory(prev => ({ ...prev, source_context: e.target.value }))}>
                                    {SOURCE_CONTEXT_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>场景细分</span>
                                <select value={editingMemory.scene_tag} onChange={e => setEditingMemory(prev => ({ ...prev, scene_tag: e.target.value }))}>
                                    {SCENE_TAG_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>重要性 {editingMemory.importance}</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={editingMemory.importance}
                                    onChange={e => setEditingMemory(prev => ({ ...prev, importance: Number(e.target.value) }))}
                                />
                            </label>
                        </div>
                        <div className="memory-edit-actions">
                            <button type="button" className="memory-lib-button ghost" onClick={() => setEditingMemory(null)}>取消</button>
                            <button type="button" className="memory-lib-button" onClick={saveMemoryEditor} disabled={editSaving}>
                                <Save size={15} /> {editSaving ? '保存中' : '保存修改'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SourceViewerModal viewer={sourceViewer} onClose={() => setSourceViewer(null)} />

            <div className="memory-lib-grid stats" ref={statsRef}>
                <StatCard
                    label={libraryViewMode === 'old' ? '旧库卡片' : '正式记忆'}
                    value={formatNumber(libraryViewMode === 'old' ? scopedLegacyTotal : visibleFormalTotal)}
                    detail={libraryViewMode === 'old'
                        ? `已迁移卡片 ${formatNumber(scopedMigratedCards)}`
                        : `承载卡片 ${formatNumber(visibleSourceCards)} / 旧库 ${formatNumber(scopedLegacyTotal)}`}
                />
                <StatCard label="卡片调用" value={formatNumber(viewStats.total_retrieval_count)} detail={activeCharacter ? '这个角色的承载卡片调用累计' : `被调用过 ${formatNumber(totals.recalled_memories)} 张卡片`} />
                <StatCard label="待迁移卡片" value={formatNumber(pendingMigrationCards)} detail={`已迁移 ${formatNumber(scopedMigratedCards)} / 旧库 ${formatNumber(scopedLegacyTotal)}`} />
                <StatCard
                    label="遗忘曲线"
                    value={formatNumber(viewStats.forgetting_total)}
                    detail={`${libraryViewMode === 'new' ? '按正式记忆计算' : '按承载卡片计算'}：快遗忘 ${formatNumber(viewStats.fast_forgetting)} / 曲线中 ${formatNumber(viewStats.on_curve_forgetting)}`}
                />
            </div>

            <div className="memory-lib-section">
                <div className="memory-lib-section-title">按角色分类</div>
                <div className="memory-character-grid">
                    <button type="button" className={`memory-character-card ${!activeCharacterId ? 'active' : ''}`} onClick={() => jumpToCharacter('')}>
                        <strong>全部角色</strong>
                        <span>{formatNumber(totals.formal_total ?? newLibrary.total ?? totals.total)} 条</span>
                        <small>正式 {formatNumber(totals.formal_total ?? 0)} / 承载 {formatNumber(totals.migrated_card_total ?? totals.total)} / 旧库 {formatNumber(totals.legacy_total ?? totals.total)}</small>
                    </button>
                    {characterStats.map(character => (
                        <button
                            type="button"
                            className={`memory-character-card ${String(activeCharacterId) === String(character.character_id) ? 'active' : ''}`}
                            key={character.character_id}
                            onClick={() => jumpToCharacter(character.character_id)}
                        >
                            <strong>{character.name}</strong>
                            <span>{formatNumber(character.formal_total ?? character.total)} 条</span>
                            <small>正式 {formatNumber(character.formal_total ?? 0)} / 承载 {formatNumber(character.migrated_card_total ?? character.migrated_total ?? character.total)} / 旧库 {formatNumber(character.legacy_total ?? character.total)}</small>
                        </button>
                    ))}
                </div>
            </div>

            <div className="memory-lib-view-switch">
                <div>
                    <strong>{libraryViewMode === 'old' ? '旧库备份' : '新版记忆库'}</strong>
                    <span>{libraryViewMode === 'old' ? '只作为迁移来源和备份查看；RAG、统计和默认时间线都不读取旧库，未迁移角色会暂时没有可召回记忆。' : `显示小模型归纳出的正式记忆，共 ${formatNumber(newLibrary.total)} 条，来自 ${formatNumber(newLibrary.source_total)} 张旧卡片。`}</span>
                </div>
                <div className="memory-lib-mode-tabs">
                    <button type="button" className={libraryViewMode === 'new' ? 'active' : ''} onClick={() => setLibraryViewMode('new')}>新版记忆库</button>
                    <button type="button" className={libraryViewMode === 'old' ? 'active' : ''} onClick={() => setLibraryViewMode('old')}>旧库备份</button>
                </div>
            </div>

            <div className="memory-lib-section">
                <div className="memory-lib-section-title">全库时间线</div>
                <section className={`memory-category-card timeline ${openGroups.time_bound_timeline ? 'open' : ''}`}>
                    <button type="button" className="memory-category-head" onClick={() => toggleGroup('time_bound_timeline')}>
                        <div>
                            <h3>按时间查看记忆</h3>
                            <p>{timeline.criteria || '仅收录小模型明确标为时间强绑定的记忆；普通长期事实不会进入时间线。'}</p>
                        </div>
                        <span className="memory-category-count">{formatNumber(timeline.count)} 条</span>
                        <ChevronDown size={16} />
                    </button>
                    {openGroups.time_bound_timeline && (
                        <>
                            <TimelineList
                                items={timeline.items}
                                emptyText="当前筛选下没有已标为时间强绑定的记忆。先跑来源场景+时间标签扫描后，这里才会出现时间线节点。"
                                onCharacterClick={jumpToCharacter}
                                onEdit={openMemoryEditor}
                                onDelete={deleteMemoryItems}
                                onViewSource={openSourceViewer}
                                deletingIds={deletingIds}
                            />
                            {timeline.items?.length > 0 && <div className="memory-lib-more">已把 {formatNumber(timeline.items.length)} 条正式时间线记忆聚合为可缩放日期节点；背后承载卡片 {formatNumber(timeline.source_count || timeline.items.length)} 张，疑似时间相关正式记忆 {formatNumber(timeline.temporal_signal_count || 0)} 条。</div>}
                        </>
                    )}
                </section>
            </div>

            <div className="memory-lib-section">
                <div className="memory-lib-section-title">遗忘曲线</div>
                <div className="memory-forgetting-stack">
                    {forgettingGroups.map(group => (
                        <section className={`memory-category-card forgetting ${group.key} ${openGroups[`forgetting_${group.key}`] ? 'open' : ''}`} key={group.key}>
                            <button type="button" className="memory-category-head" onClick={() => toggleGroup(`forgetting_${group.key}`)}>
                                <div>
                                    <h3>{group.label}</h3>
                                    <p>{group.description}</p>
                                </div>
                                <span className="memory-category-count">{formatNumber(group.count)} 条</span>
                                <ChevronDown size={16} />
                            </button>
                            {openGroups[`forgetting_${group.key}`] && (
                                <>
                                    <EntryList
                                        items={group.items}
                                        mode="forgetting"
                                        emptyText="这个遗忘大类暂时没有记忆条目。"
                                        onRescue={rescueItem}
                                        onCharacterClick={jumpToCharacter}
                                        onEdit={openMemoryEditor}
                                        onDelete={deleteMemoryItems}
                                        onViewSource={openSourceViewer}
                                        rescuingIds={rescuingIds}
                                        deletingIds={deletingIds}
                                    />
                                    {group.items?.length > 0 && <div className="memory-lib-more">已按最快遗忘排序，加载全部 {formatNumber(group.items.length)} 条，可在气泡内滚动查看。</div>}
                                </>
                            )}
                        </section>
                    ))}
                </div>
            </div>

            {libraryViewMode === 'old' ? (
                <>
                    <div className="memory-lib-section">
                        <div className="memory-lib-section-title">记忆分类</div>
                        <div className="memory-category-stack">
                            {categories.map(category => (
                                <section className={`memory-category-card ${openGroups[`category_${category.key}`] ? 'open' : ''}`} key={category.key}>
                                    <button type="button" className="memory-category-head" onClick={() => toggleGroup(`category_${category.key}`)}>
                                        <div>
                                            <h3>{category.label}</h3>
                                            <p>{category.description}</p>
                                        </div>
                                        <span className="memory-category-count">{formatNumber(category.count)} 条</span>
                                        <ChevronDown size={16} />
                                    </button>
                                    {openGroups[`category_${category.key}`] && (
                                        <>
                                            <EntryList
                                                items={category.items}
                                                mode="category"
                                                emptyText="这个分类暂时没有记忆条目。"
                                                onRescue={rescueItem}
                                                onCharacterClick={jumpToCharacter}
                                                onEdit={openMemoryEditor}
                                                onDelete={deleteMemoryItems}
                                                onViewSource={openSourceViewer}
                                                rescuingIds={rescuingIds}
                                                deletingIds={deletingIds}
                                            />
                                            {category.items?.length > 0 && <div className="memory-lib-more">已加载这个分类的全部 {formatNumber(category.items.length)} 条，可在气泡内滚动查看。</div>}
                                        </>
                                    )}
                                </section>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="memory-lib-section">
                        <div className="memory-lib-section-title">新版来源场景分类</div>
                        <div className="memory-lib-view-note">商业街、群聊、私聊和外部 App 是来源场景维度，不是语义分类；同一条记忆仍会同时归入用户画像、关系、当前阶段或普通事件。</div>
                        <div className="memory-category-stack">
                            {newSourceGroups.map(group => (
                                <section className={`memory-category-card new-summary source ${openGroups[`source_${group.key}`] ? 'open' : ''}`} key={group.key}>
                                    <button type="button" className="memory-category-head" onClick={() => toggleGroup(`source_${group.key}`)}>
                                        <div>
                                            <h3>{group.label}</h3>
                                            <p>{group.description}</p>
                                        </div>
                                        <span className="memory-category-count">{formatNumber(group.count)} 条</span>
                                        <ChevronDown size={16} />
                                    </button>
                                    {openGroups[`source_${group.key}`] && (
                                        <>
                                            <NewSummaryList
                                                items={group.items}
                                                emptyText="这个来源场景暂时没有正式新版记忆。完整迁移或补充标签后会出现在这里。"
                                                onCharacterClick={jumpToCharacter}
                                                onEdit={openMemoryEditor}
                                                onDelete={deleteMemoryItems}
                                                onViewSource={openSourceViewer}
                                                deletingIds={deletingIds}
                                            />
                                            {group.items?.length > 0 && <div className="memory-lib-more">已加载这个来源场景的全部 {formatNumber(group.items.length)} 条新版总结，可在气泡内滚动查看。</div>}
                                        </>
                                    )}
                                </section>
                            ))}
                        </div>
                    </div>
                    <div className="memory-lib-section">
                        <div className="memory-lib-section-title">新版语义分类</div>
                        <div className="memory-lib-view-note">这里显示的是当前正式记忆库。RAG、记忆统计和时间线只读取这些新版总结；没有迁移出新版总结的角色不会回退到旧库。</div>
                        <div className="memory-category-stack">
                            {newCategories.map(category => (
                                <section className={`memory-category-card new-summary ${openGroups[`new_${category.key}`] ? 'open' : ''}`} key={category.key}>
                                    <button type="button" className="memory-category-head" onClick={() => toggleGroup(`new_${category.key}`)}>
                                        <div>
                                            <h3>{category.label}</h3>
                                            <p>{category.description}</p>
                                        </div>
                                        <span className="memory-category-count">{formatNumber(category.count)} 条</span>
                                        <ChevronDown size={16} />
                                    </button>
                                    {openGroups[`new_${category.key}`] && (
                                        <>
                                            <NewSummaryList
                                                items={category.items}
                                                emptyText="这个分类暂时还没有小模型生成的新总结。"
                                                onCharacterClick={jumpToCharacter}
                                                onEdit={openMemoryEditor}
                                                onDelete={deleteMemoryItems}
                                                onViewSource={openSourceViewer}
                                                deletingIds={deletingIds}
                                            />
                                            {category.items?.length > 0 && <div className="memory-lib-more">已加载这个分类的全部 {formatNumber(category.items.length)} 条新版总结，可在气泡内滚动查看。</div>}
                                        </>
                                    )}
                                </section>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <div className="memory-lib-section">
                <div className="memory-lib-section-title"><SlidersHorizontal size={16} /> 记忆库管理小模型</div>
                <div className="memory-lib-model-grid">
                    <label>
                        <span>URL</span>
                        <input value={settings.api_endpoint} onChange={e => setSettings(prev => ({ ...prev, api_endpoint: e.target.value }))} placeholder="https://api.openai.com/v1" />
                    </label>
                    <label>
                        <span>Key</span>
                        <input type="password" value={settings.api_key} onChange={e => setSettings(prev => ({ ...prev, api_key: e.target.value }))} placeholder="sk-..." />
                    </label>
                    <label>
                        <span>模型</span>
                        <input value={settings.model_name} onChange={e => setSettings(prev => ({ ...prev, model_name: e.target.value }))} placeholder="model name" />
                    </label>
                    <div className="memory-lib-model-actions">
                        <button className="memory-lib-button ghost" onClick={fetchModels} disabled={modelFetching}>
                            <Search size={15} /> {modelFetching ? '拉取中' : '拉取模型'}
                        </button>
                        <button className="memory-lib-button" onClick={saveSettings} disabled={saving}>
                            <Save size={15} /> {saving ? '保存中' : '保存配置'}
                        </button>
                    </div>
                </div>
                {modelError && <div className="memory-lib-error">{modelError}</div>}
                {models.length > 0 && (
                    <select className="memory-lib-model-select" value="" onChange={e => setSettings(prev => ({ ...prev, model_name: e.target.value }))}>
                        <option value="" disabled>选择拉取到的模型</option>
                        {models.map(model => <option key={model} value={model}>{model}</option>)}
                    </select>
                )}
                <div className="memory-lib-batch-row">
                    <div>
                        <strong>每轮读取 {settings.batch_size} 条{promptTaskMode === 'complete' ? '旧记忆卡片' : '正式新版记忆'}</strong>
                        <p>{promptTaskMode === 'complete'
                            ? '小模型只吃卡片概况，输出的新记忆统一中文，不吃原始对话/日志或 embedding 索引文本。'
                            : '补充模式只扫正式新版记忆，不扫承载卡片；只补来源场景和时间标签，不改写记忆。'}</p>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={settings.batch_size}
                        onChange={e => setSettings(prev => ({ ...prev, batch_size: Number(e.target.value) }))}
                    />
                </div>
                <div className="memory-lib-batch-row">
                    <div>
                        <strong>小模型输出上限 {settings.max_output_tokens || 8000} tokens</strong>
                        <p>失败日志如果出现 finish_reason=length，就把这里调大；推理模型会消耗更多输出预算。</p>
                    </div>
                    <input
                        type="range"
                        min="1000"
                        max="20000"
                        step="500"
                        value={settings.max_output_tokens || 8000}
                        onChange={e => setSettings(prev => ({ ...prev, max_output_tokens: Number(e.target.value) }))}
                    />
                </div>
                <div className="memory-lib-mode-tabs">
                    <button
                        type="button"
                        className={maintenanceMode === 'manual' ? 'active' : ''}
                        onClick={() => setMaintenanceMode('manual')}
                    >
                        手动选择批次总结
                    </button>
                    <button
                        type="button"
                        className={maintenanceMode === 'auto' ? 'active' : ''}
                        onClick={() => setMaintenanceMode('auto')}
                    >
                        自动总结
                    </button>
                </div>
                <div className="memory-lib-batch-tools primary">
                    <select value={selectedCharacterId} onChange={e => setSelectedCharacterId(e.target.value)}>
                        {migrationCharacters.map(item => (
                            <option value={item.character_id} key={item.character_id}>
                                {item.name} (旧库 {formatNumber(item.total)} / 新版 {formatNumber(item.formal_total ?? item.new_total ?? item.migrated_total ?? 0)})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="memory-lib-mode-tabs">
                    <button
                        type="button"
                        className={promptTaskMode === 'complete' ? 'active' : ''}
                        onClick={() => setPromptTaskMode('complete')}
                    >
                        完整
                    </button>
                    <button
                        type="button"
                        className={promptTaskMode === 'supplement' ? 'active' : ''}
                        onClick={() => setPromptTaskMode('supplement')}
                    >
                        补充
                    </button>
                </div>
                <div className="memory-lib-mode-copy">
                    {promptTaskMode === 'complete'
                        ? '完整：把旧库/外部 App 记忆迁移进新版库，同时写来源场景和时间标签。'
                        : '补充：只给现有新版记忆补来源场景和时间标签，不改写记忆内容。'}
                </div>
                {maintenanceMode === 'manual' ? (
                    <div className="memory-lib-mode-panel">
                        <label className="memory-lib-inline-field">
                            <span>选择第几批</span>
                            <input
                                type="number"
                                min="1"
                                value={manualBatchIndex}
                                onChange={e => setManualBatchIndex(Math.max(1, Number(e.target.value || 1)))}
                            />
                        </label>
                        <div className="memory-lib-mode-copy">
                            第 {manualBatchIndex} 批会跳过前 {formatNumber((Math.max(1, Number(manualBatchIndex || 1)) - 1) * Number(settings.batch_size || 30))} 条；完整处理 pending 旧卡片，补充处理已有新版记忆。
                        </div>
                        <div className="memory-lib-batch-tools">
                            <button className="memory-lib-button ghost" onClick={previewSelectedPrompt} disabled={batchLoading || temporalPromptLoading || !selectedCharacterId}>
                                <Database size={15} /> {(batchLoading || temporalPromptLoading) ? '生成中' : '预览 Prompt'}
                            </button>
                            <button className="memory-lib-button" onClick={runSelectedPromptTask} disabled={runLoading || autoRunActive || !selectedCharacterId}>
                                <Play size={15} /> {runLoading ? '工作中' : '开始工作'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="memory-lib-mode-panel">
                        <label className="memory-lib-inline-field">
                            <span>连续跑几批</span>
                            <input
                                type="number"
                                min="1"
                                placeholder="不限制"
                                value={autoMaxBatches}
                                onChange={e => {
                                    const raw = e.target.value;
                                    setAutoMaxBatches(raw === '' ? '' : String(Math.max(1, Number(raw || 1) || 1)));
                                }}
                            />
                        </label>
                        <div className="memory-lib-mode-copy">
                            {promptTaskMode === 'complete'
                                ? '自动完整会从 pending 第一批开始连续处理，每批结束后下一批会重新读取剩余 pending；留空则不限制批数。单批失败会自动重 roll 3 次，仍失败才终止并返回错误。'
                                : '自动补充会连续扫描已有新版记忆，补来源场景和时间标签；留空则扫完整个新版库。单批失败会自动重 roll 3 次，仍失败才终止并返回错误。'}
                        </div>
                        <div className="memory-lib-batch-tools">
                            <button className="memory-lib-button" onClick={() => runAutoSelectedTask()} disabled={autoRunActive || runLoading || !selectedCharacterId}>
                                <Play size={15} /> {autoRunActive ? '自动工作中' : '开始自动工作'}
                            </button>
                        </div>
                    </div>
                )}
                {autoProgress && (
                    <div className={`memory-lib-live-progress ${autoProgress.running ? 'running' : ''}`}>
                        <div className="memory-lib-live-head">
                            <div>
                                <strong>{autoProgress.task_mode === 'supplement' ? (autoProgress.running ? '自动补充运行中' : '自动补充状态') : (autoProgress.running ? '自动总结运行中' : '自动总结状态')}</strong>
                                <p>{autoProgress.message || formatProgressPhase(autoProgress.phase)}</p>
                            </div>
                            <span>{formatProgressPhase(autoProgress.phase)}</span>
                        </div>
                        {autoProgress.max_batches && autoProgress.batch_number && (
                            <div className="memory-lib-live-bar">
                                <i style={{ width: `${Math.min(100, Math.round((Number(autoProgress.batch_number || 0) / Math.max(1, Number(autoProgress.max_batches || 1))) * 100))}%` }} />
                            </div>
                        )}
                        <div className="memory-lib-live-grid">
                            <span>批次：{autoProgress.batch_number ? `第 ${autoProgress.batch_number} 批` : '等待中'}</span>
                            <span>尝试：{autoProgress.attempt ? `${autoProgress.attempt}/${Number(autoProgress.max_rerolls || 3) + 1}` : '未开始'}</span>
                            <span>已处理：{formatNumber(autoProgress.processed)}</span>
                            <span>已写回：{formatNumber(autoProgress.updated)}</span>
                            <span>待分类：{formatNumber(autoProgress.remaining_pending_after_batch ?? autoProgress.pending_before ?? autoProgress.stats?.pending)}</span>
                            <span>错误：{formatNumber(autoProgress.applied_errors)}</span>
                        </div>
                        {latestProgressSamples.length > 0 && (
                            <div className="memory-lib-live-samples">
                                <strong>本批新总结预览</strong>
                                {latestProgressSamples.map((sample, idx) => <p key={`${idx}-${sample}`}>{sample}</p>)}
                            </div>
                        )}
                        {latestProgressEvents.length > 0 && (
                            <div className="memory-lib-live-log">
                                {latestProgressEvents.map((event, idx) => (
                                    <span key={`${event.run_id}-${event.timestamp}-${idx}`}>
                                        {formatProgressPhase(event.phase)}
                                        {event.batch_number ? ` · 第 ${event.batch_number} 批` : ''}
                                        {event.reroll ? ` · 重 roll ${event.reroll}` : ''}
                                        {event.updated !== undefined ? ` · 写回 ${formatNumber(event.updated)}` : ''}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {batchPreview && (
                    <div className="memory-lib-batch-preview">
                        已准备第 {batchPreview.batch_index || manualBatchIndex} 批 / 共 {formatNumber(batchPreview.total_batches)} 批，{batchPreview.items?.length || 0} 条，下一游标 #{batchPreview.next_after_id || 0}，待分类剩余 {formatNumber(batchPreview.remaining_pending)}。
                        <div>{(batchPreview.items || []).slice(0, 12).map(item => `#${item.id}`).join('  ')}</div>
                    </div>
                )}
                {runResult && (
                    <div className="memory-lib-run-result">
                        <div className="memory-lib-prompt-head">
                            <strong>{runResult.mode === 'supplement' ? '小模型补充结果' : '小模型归纳结果'}</strong>
                            <span>
                                {runResult.mode === 'supplement'
                                    ? `来源 ${formatNumber(runResult.normalized?.source_label_count)} / 时间 ${formatNumber(runResult.normalized?.time_label_count)} / 写回 ${formatNumber(runResult.apply?.updated)} 条`
                                    : runResult.mode === 'auto'
                                    ? `自动 ${formatNumber((runResult.runs || []).filter(item => !item.empty).length)} 批 / 应用 ${formatNumber(runResult.updated)} 条`
                                    : `新记忆建议 ${formatNumber(runResult.normalized?.new_memory_count)} / 应用 ${formatNumber(runResult.apply?.updated)} 条`}
                            </span>
                        </div>
                        <div className="memory-lib-result-grid">
                            <span>
                                {runResult.mode === 'supplement'
                                    ? `批次：${(runResult.batch?.ids || []).slice(0, 14).map(id => `#${id}`).join(' ')}`
                                    : runResult.mode === 'auto'
                                    ? `处理：${formatNumber(runResult.processed)} 条 / ${runResult.run_until_empty ? '不限制批数' : `上限 ${formatNumber(runResult.max_batches)} 批`}`
                                    : `批次：${(runResult.batch?.ids || []).slice(0, 14).map(id => `#${id}`).join(' ')}`}
                            </span>
                            <span>错误：{formatNumber(runResult.mode === 'auto' ? ((runResult.errors || []).length + Number(runResult.applied_errors || 0)) : ((runResult.normalized?.errors || []).length + (runResult.apply?.errors || []).length))}</span>
                            {runResult.mode === 'auto' && <span>停止：{formatStoppedReason(runResult.stopped_reason)}</span>}
                            <span>模型：{runResult.model?.name || settings.model_name}{runResult.model?.finishReason ? ` / ${runResult.model.finishReason}` : ''}</span>
                        </div>
                        {canContinueAutoRun && (
                            <div className="memory-lib-continue">
                                <div>
                                    <strong>自动任务已停在断点</strong>
                                    <p>当前还有 {formatNumber(runResult.continue_from?.pending || runResult.stats?.pending || 0)} 条 pending。继续会从剩余 pending 的第一批重新尝试，不会重跑已写回的批次。</p>
                                </div>
                                <button
                                    type="button"
                                    className="memory-lib-button"
                                    onClick={() => (runResult.task_mode === 'supplement' ? runAutoSupplement : runAutoMigration)({
                                        skipConfirm: true,
                                        continuation: true,
                                        characterId: runResult.character?.id || selectedCharacterId
                                    })}
                                    disabled={autoRunActive || runLoading}
                                >
                                    <Play size={15} /> {autoRunActive ? '继续中' : '从断点继续'}
                                </button>
                            </div>
                        )}
                        <textarea readOnly value={formatRunResultDetails(runResult)} />
                    </div>
                )}
                <div className="memory-lib-prompt-window">
                    <div className="memory-lib-prompt-head">
                        <strong>{promptTaskMode === 'complete' ? '完整 Prompt' : '补充 Prompt'}</strong>
                        <span>
                            {promptTaskMode === 'complete'
                                ? (promptPreview ? `约 ${formatNumber(promptPreview.length)} 字符` : '先点“预览 Prompt”生成')
                                : (temporalPromptPreview ? `约 ${formatNumber(temporalPromptPreview.length)} 字符` : '先点“预览 Prompt”生成')}
                        </span>
                    </div>
                    <textarea
                        readOnly
                        value={promptTaskMode === 'complete'
                            ? (promptPreview || '完整 Prompt：把旧库/外部 App 记忆迁移进新版库，同时生成中文正式记忆、来源场景标签和时间标签。这里不会放原始对话/日志或 embedding 索引文本。')
                            : (temporalPromptPreview || '补充 Prompt：只给已有新版记忆补私聊/群聊/商业街/外部 App 来源场景标签，以及时间强绑定标签；不改写记忆内容，不改变 memory_focus。')}
                    />
                </div>
            </div>
        </div>
    );
}

export default MemoryLibraryPanel;
