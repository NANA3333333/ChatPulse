import {
    Aperture,
    Heart,
    UserRound,
    MapPin,
    Clock3,
    AlarmClock,
    ListFilter,
    Lightbulb,
    Search,
    GitBranch,
    List,
    CalendarDays,
} from 'lucide-react';
import {
    buildLensCount,
    getCharacterInitial,
    getMemoryItemKey,
    getMemorySourceIds,
    getMemoryUpdatedAt,
    getMemoryTitle,
    getMemoryCharacterName,
    getMemoryDisplayTags,
} from '../memoryThreads.js';
import { formatNumber, formatDate, optionLabel } from '../memoryLabels.js';
import { MemoryInspector } from './MemoryInspector.jsx';

export function MemoryMapView(props) {
    const {
        tx,
        threads,
        allThreadItems,
        selectedMemory,
        selectedThread,
        selectedMemoryKey,
        setSelectedMemoryKey,
        characterStats,
        totals,
        activeCharacterId,
        jumpToCharacter,
        memoryLens,
        setMemoryLens,
        memorySearch,
        setMemorySearch,
        libraryViewMode,
        setLibraryViewMode,
        forgettingTotal,
        onViewSource,
        onEdit,
        onDelete,
        deletingIds,
    } = props;

    const items = allThreadItems.map((entry) => entry.item);
    const lensItems = [
        { key: 'all', icon: <Aperture size={15} />, label: tx('All Threads', '全部脉络'), count: items.length },
        {
            key: 'relationship',
            icon: <Heart size={15} />,
            label: tx('Relationship', '关系与情感'),
            count: buildLensCount(items, 'relationship'),
        },
        {
            key: 'user_profile',
            icon: <UserRound size={15} />,
            label: tx('About You', '关于你'),
            count: buildLensCount(items, 'user_profile'),
        },
        {
            key: 'scene',
            icon: <MapPin size={15} />,
            label: tx('Scenes', '地点与场景'),
            count: buildLensCount(items, 'scene'),
        },
        {
            key: 'temporal',
            icon: <Clock3 size={15} />,
            label: tx('Missing Time', '缺少时间标签'),
            count: buildLensCount(items, 'temporal'),
        },
        {
            key: 'forgetting',
            icon: <AlarmClock size={15} />,
            label: tx('Forgetting Soon', '即将遗忘'),
            count: forgettingTotal,
            warning: true,
        },
    ];

    return (
        <section className="memory-map-screen">
            <aside className="memory-map-sidebar">
                <div className="memory-sidebar-heading">
                    <div>
                        <span className="memory-eyebrow">CHARACTERS</span>
                        <h2>{tx('Whose memories?', '谁的记忆？')}</h2>
                    </div>
                    <ListFilter size={17} />
                </div>
                <div className="memory-character-list">
                    <button
                        type="button"
                        className={!activeCharacterId ? 'is-active' : ''}
                        onClick={() => jumpToCharacter('')}
                    >
                        <span className="memory-avatar is-blue">*</span>
                        <span>
                            <strong>{tx('All Roles', '全部角色')}</strong>
                            <small>
                                {formatNumber(totals?.formal_total ?? totals?.total ?? 0)} {tx('memories', '条记忆')}
                            </small>
                        </span>
                        <em>{formatNumber(characterStats.length)}</em>
                    </button>
                    {characterStats.map((character, index) => (
                        <button
                            type="button"
                            className={String(activeCharacterId) === String(character.character_id) ? 'is-active' : ''}
                            key={character.character_id}
                            onClick={() => jumpToCharacter(character.character_id)}
                        >
                            <span className={`memory-avatar ${index % 2 ? 'is-pink' : 'is-blue'}`}>
                                {getCharacterInitial(character.name)}
                            </span>
                            <span>
                                <strong>{character.name}</strong>
                                <small>
                                    {formatNumber(character.formal_total ?? character.total ?? 0)}{' '}
                                    {tx('memories', '条记忆')}
                                </small>
                            </span>
                            <em>{formatNumber(character.pending || 0)}</em>
                        </button>
                    ))}
                </div>

                <div className="memory-lens-section">
                    <span className="memory-eyebrow">MEMORY LENSES</span>
                    <h3>{tx('View by angle', '从哪个角度看')}</h3>
                    {lensItems.map((item) => (
                        <button
                            type="button"
                            className={`${memoryLens === item.key ? 'is-active' : ''}${item.warning ? ' is-warning' : ''}`}
                            key={item.key}
                            onClick={() => setMemoryLens(item.key)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                            <em>{formatNumber(item.count)}</em>
                        </button>
                    ))}
                </div>

                <div className="memory-sidebar-note">
                    <Lightbulb size={17} />
                    <div>
                        <strong>{tx('Threads come from real fields', '主线来自真实字段')}</strong>
                        <p>
                            {tx(
                                'Groups use semantic category, source scene, consolidation keys, and dates.',
                                '按语义分类、来源场景、合并键和时间确定性聚合。',
                            )}
                        </p>
                    </div>
                </div>
            </aside>

            <main className="memory-map-main">
                <div className="memory-map-toolbar">
                    <div>
                        <span className="memory-eyebrow">MEMORY MAP</span>
                        <h1>
                            {activeCharacterId
                                ? tx('Role Memory Threads', '角色记忆脉络')
                                : tx('All Memory Threads', '全部记忆脉络')}
                        </h1>
                        <p>
                            {tx(
                                'Browse formal memories by topic, source, time, and traceable carrier cards.',
                                '按主题、来源、时间和可追溯承载卡浏览正式记忆。',
                            )}
                        </p>
                    </div>
                    <div className="memory-toolbar-controls">
                        <label className="memory-search-box">
                            <Search size={15} />
                            <input
                                value={memorySearch}
                                onChange={(event) => setMemorySearch(event.target.value)}
                                placeholder={tx('Search memory content, people, or places', '搜索记忆内容、人物或地点')}
                            />
                        </label>
                        <div className="memory-view-switch">
                            <button
                                type="button"
                                className={libraryViewMode === 'new' ? 'is-active' : ''}
                                onClick={() => setLibraryViewMode('new')}
                                title={tx('New library', '新版记忆库')}
                            >
                                <GitBranch size={15} />
                            </button>
                            <button
                                type="button"
                                className={libraryViewMode === 'old' ? 'is-active' : ''}
                                onClick={() => setLibraryViewMode('old')}
                                title={tx('Legacy backup', '旧库备份')}
                            >
                                <List size={15} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="memory-map-legend">
                    <span>
                        <i className="memory-dot core" />
                        {tx('Core', '核心记忆')}
                    </span>
                    <span>
                        <i className="memory-dot active" />
                        {tx('Active', '活跃记忆')}
                    </span>
                    <span>
                        <i className="memory-dot ambient" />
                        {tx('Ambient', '背景记忆')}
                    </span>
                    <span>
                        <CalendarDays size={14} />
                        {tx('Sorted by latest update', '按最近更新')}
                    </span>
                </div>

                <div className="memory-thread-canvas">
                    {threads.length === 0 ? (
                        <div className="memory-map-empty">
                            {tx('No memories match the current filters.', '当前筛选下没有匹配的记忆。')}
                        </div>
                    ) : (
                        threads.map((thread) => (
                            <article className={`memory-thread memory-thread-${thread.tone}`} key={thread.key}>
                                <div className="memory-thread-line">
                                    <span>
                                        <MemoryThreadIcon tone={thread.tone} />
                                    </span>
                                    <i />
                                </div>
                                <div className="memory-thread-content">
                                    <div className="memory-thread-heading">
                                        <div>
                                            <span>
                                                {thread.label} · {formatNumber(thread.count)} {tx('memories', '条记忆')}
                                            </span>
                                            <h3>{thread.description}</h3>
                                        </div>
                                        {thread.strongest > 0 && (
                                            <em>
                                                {tx('Importance', '重要性')} {thread.strongest}
                                            </em>
                                        )}
                                    </div>
                                    <div className="memory-cluster-grid">
                                        {thread.items.slice(0, 6).map((item) => {
                                            const itemKey = getMemoryItemKey(item);
                                            const sourceIds = getMemorySourceIds(item);
                                            const deleting = sourceIds.some((id) => deletingIds.includes(Number(id)));
                                            return (
                                                <button
                                                    type="button"
                                                    className={`memory-map-card ${String(selectedMemoryKey || '') === String(itemKey) || (!selectedMemoryKey && selectedMemory && getMemoryItemKey(selectedMemory) === itemKey) ? 'is-selected' : ''}`}
                                                    key={itemKey}
                                                    onClick={() => setSelectedMemoryKey(itemKey)}
                                                >
                                                    <span>{formatDate(getMemoryUpdatedAt(item))}</span>
                                                    <strong>{getMemoryTitle(item, tx)}</strong>
                                                    <small>
                                                        {getMemoryCharacterName(item, characterStats, tx)} ·{' '}
                                                        {optionLabel(item.memory_focus, item.memory_focus)} ·{' '}
                                                        {deleting
                                                            ? tx('Deleting', '删除中')
                                                            : `${tx('Sources', '来源')} ${formatNumber(item.source_count || sourceIds.length || 1)}`}
                                                    </small>
                                                    <div>
                                                        {getMemoryDisplayTags(item)
                                                            .slice(0, 4)
                                                            .map((tag, tagIndex) => (
                                                                <em key={`${itemKey}-${tag}-${tagIndex}`}>
                                                                    {optionLabel(tag, tag)}
                                                                </em>
                                                            ))}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </main>

            <MemoryInspector
                tx={tx}
                memory={selectedMemory}
                thread={selectedThread}
                characterStats={characterStats}
                onViewSource={onViewSource}
                onEdit={onEdit}
                onDelete={onDelete}
                deletingIds={deletingIds}
            />
        </section>
    );
}

function MemoryThreadIcon({ tone }) {
    if (tone === 'core') return <Heart size={16} />;
    if (tone === 'active') return <Clock3 size={16} />;
    if (tone === 'fading') return <AlarmClock size={16} />;
    return <Aperture size={16} />;
}
