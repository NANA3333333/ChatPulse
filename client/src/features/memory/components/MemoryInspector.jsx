import { PanelRightClose, Link2, Tags, Activity, Edit2, FileText, Trash2 } from 'lucide-react';
import {
    getMemorySourceIds,
    getMemoryItemKey,
    getMemoryImportance,
    getMemoryTone,
    getMemoryTier,
    getMemoryTitle,
    getMemoryBody,
    getMemoryCharacterName,
    getMemoryUpdatedAt,
    uniqueMemoryLabels,
    getMemoryDisplayTags,
} from '../memoryThreads.js';
import { optionLabel, formatDateTime, formatDate } from '../memoryLabels.js';

export function MemoryInspector({ tx, memory, thread, characterStats, onViewSource, onEdit, onDelete, deletingIds }) {
    if (!memory) {
        return (
            <aside className="memory-inspector">
                <div className="memory-inspector-heading">
                    <div>
                        <span className="memory-eyebrow">MEMORY DETAIL</span>
                        <h2>{tx('Memory Detail', '记忆详情')}</h2>
                    </div>
                    <PanelRightClose size={17} />
                </div>
                <div className="memory-map-empty">
                    {tx('Select a memory to inspect details.', '选择一条记忆查看详情。')}
                </div>
            </aside>
        );
    }

    const sourceIds = getMemorySourceIds(memory);
    const isNewMemory =
        memory.memory_library_source === 'new' ||
        memory.memory_library_source === 'new_grouped' ||
        Array.isArray(memory.source_ids);
    const isDeleting = sourceIds.some((id) => deletingIds.includes(Number(id)));
    const related = (thread?.items || [])
        .filter((item) => getMemoryItemKey(item) !== getMemoryItemKey(memory))
        .slice(0, 3);
    const importance = getMemoryImportance(memory);
    const tone = getMemoryTone(memory);

    return (
        <aside className="memory-inspector">
            <div className="memory-inspector-heading">
                <div>
                    <span className="memory-eyebrow">MEMORY DETAIL</span>
                    <h2>{tx('Memory Detail', '记忆详情')}</h2>
                </div>
                <PanelRightClose size={17} />
            </div>
            <section className="memory-detail-hero">
                <div className="memory-detail-badges">
                    <span>{optionLabel(getMemoryTier(memory), getMemoryTier(memory))}</span>
                    <span>{optionLabel(memory.memory_focus, memory.memory_focus || 'general')}</span>
                </div>
                <h3>{getMemoryTitle(memory, tx)}</h3>
                <p>{getMemoryBody(memory, tx)}</p>
                {importance > 0 && (
                    <div className="memory-importance-meter">
                        <span>
                            <strong>{tx('Importance', '重要性')}</strong>
                            <em>{importance} / 10</em>
                        </span>
                        <i>
                            <b className={`is-${tone}`} style={{ width: `${importance * 10}%` }} />
                        </i>
                    </div>
                )}
            </section>
            <section className="memory-detail-card">
                <div className="memory-card-heading">
                    <span>
                        <Link2 size={15} />
                        {tx('Source', '来源')}
                    </span>
                    <button
                        type="button"
                        onClick={() => onViewSource({ item: memory, ids: sourceIds })}
                        disabled={!sourceIds.length}
                    >
                        {tx('View Source', '查看原文')}
                    </button>
                </div>
                <div className="memory-source-summary">
                    <strong>{getMemoryCharacterName(memory, characterStats, tx)}</strong>
                    <small>
                        {formatDateTime(getMemoryUpdatedAt(memory))} ·{' '}
                        {sourceIds
                            .slice(0, 5)
                            .map((id) => `#${id}`)
                            .join(' ') || tx('No carrier id', '无承载卡 ID')}
                    </small>
                </div>
            </section>
            <section className="memory-detail-card">
                <div className="memory-card-heading">
                    <span>
                        <Tags size={15} />
                        {tx('Bound Tags', '绑定标签')}
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            onEdit({
                                type: isNewMemory ? 'new' : 'legacy',
                                item: memory,
                                ids: isNewMemory ? sourceIds : [memory.representative_id || memory.id].filter(Boolean),
                            })
                        }
                    >
                        {tx('Edit', '编辑')}
                    </button>
                </div>
                <div className="memory-tag-cloud">
                    {uniqueMemoryLabels([memory.consolidation_key, ...getMemoryDisplayTags(memory)])
                        .filter(Boolean)
                        .slice(0, 8)
                        .map((tag, tagIndex) => (
                            <span key={`${getMemoryItemKey(memory)}-${tag}-${tagIndex}`}>{optionLabel(tag, tag)}</span>
                        ))}
                </div>
            </section>
            {related.length > 0 && (
                <section className="memory-detail-card">
                    <div className="memory-card-heading">
                        <span>
                            <Activity size={15} />
                            {tx('Related by Same Thread', '同主线关联')}
                        </span>
                        <em>{related.length}</em>
                    </div>
                    <div className="memory-related-list">
                        {related.map((item) => (
                            <div key={getMemoryItemKey(item)}>
                                <i className={`memory-dot ${getMemoryTone(item)}`} />
                                <span>
                                    <strong>{getMemoryTitle(item, tx)}</strong>
                                    <small>{formatDate(getMemoryUpdatedAt(item))}</small>
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            <div className="memory-detail-actions">
                <button
                    type="button"
                    className="memory-core-ghost"
                    onClick={() =>
                        onEdit({
                            type: isNewMemory ? 'new' : 'legacy',
                            item: memory,
                            ids: isNewMemory ? sourceIds : [memory.representative_id || memory.id].filter(Boolean),
                        })
                    }
                >
                    <Edit2 size={14} />
                    {tx('Edit', '编辑')}
                </button>
                <button
                    type="button"
                    className="memory-core-ghost"
                    onClick={() => onViewSource({ item: memory, ids: sourceIds })}
                    disabled={!sourceIds.length}
                >
                    <FileText size={14} />
                    {tx('Source', '原文')}
                </button>
                <button
                    type="button"
                    className="memory-core-ghost danger"
                    onClick={() => onDelete({ type: isNewMemory ? 'new' : 'legacy', item: memory, ids: sourceIds })}
                    disabled={isDeleting}
                >
                    <Trash2 size={14} />
                    {isDeleting ? tx('Deleting', '删除中') : tx('Delete', '删除')}
                </button>
            </div>
        </aside>
    );
}
