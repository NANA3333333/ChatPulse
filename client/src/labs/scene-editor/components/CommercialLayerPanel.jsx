import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Folder } from 'lucide-react';
import { commercialV2Asset } from '../../../features/city/scene/commercialStreetCore.js';

const sceneryGroups = [
    { id: 'near', en: 'Foreground', zh: '近景', factor: '1.0×' },
    { id: 'middle', en: 'Midground', zh: '中景', factor: '0.75×' },
    { id: 'far', en: 'Background', zh: '远景', factor: '0.4×' },
];

export function CommercialLayerPanel({
    tx,
    ptxt,
    layerRows,
    selectedLayerRow,
    selectedId,
    setSelectedId,
    hiddenLayerItemIds,
    setLayerVisibility,
    nudgeLayerGroup,
    scaleLayerGroup,
    editable,
}) {
    const [activeGroup, setActiveGroup] = useState(null);
    const [collapsedGroups, setCollapsedGroups] = useState(() => new Set(sceneryGroups.map((group) => group.id)));
    const [moveStep, setMoveStep] = useState(20);
    const toggleCollapsed = (groupId) => {
        setCollapsedGroups((previous) => {
            const next = new Set(previous);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    return (
        <section className="pixel-world-layer-panel commercial-layer-panel commercial-layer-dock" aria-label={tx('Layers', '图层')}>
            <div className="pixel-world-layer-panel-head">
                <strong>{tx('Layers', '图层')}</strong>
                <small>{tx(
                    'Folders group the existing draw layers. Eye icons change only the editor preview; layout order and collision stay intact. Save Layout after batch edits.',
                    '文件夹整理原有绘制图层。眼睛只控制编辑预览；图层顺序和碰撞规则保持不变。批量调整后请保存布局。',
                )}</small>
            </div>
            {selectedLayerRow && (
                <div className="pixel-world-layer-current">
                    {tx('Selected:', '已选：')}{ptxt(selectedLayerRow.asset?.name || selectedLayerRow.item.assetId)}
                    <span>#{selectedLayerRow.layerIndex + 1}</span>
                </div>
            )}
            <div className="pixel-world-layer-list">
                {sceneryGroups.map((group) => {
                    const rows = layerRows.filter((row) => row.sceneryGroup === group.id).slice().reverse();
                    const ids = rows.map((row) => row.item.id);
                    const allVisible = ids.every((id) => !hiddenLayerItemIds.has(id));
                    const collapsed = collapsedGroups.has(group.id);
                    return (
                        <div className={`commercial-layer-group ${activeGroup === group.id ? 'active' : ''}`} key={group.id}>
                            <div className="commercial-layer-group-head">
                                <button
                                    type="button"
                                    className="commercial-layer-eye"
                                    aria-label={allVisible ? tx(`Hide ${group.en}`, `隐藏${group.zh}`) : tx(`Show ${group.en}`, `显示${group.zh}`)}
                                    aria-pressed={allVisible}
                                    onClick={() => setLayerVisibility(ids, !allVisible)}
                                >{allVisible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                                <button
                                    type="button"
                                    className="commercial-layer-folder"
                                    aria-expanded={!collapsed}
                                    onClick={() => {
                                        setActiveGroup(group.id);
                                        toggleCollapsed(group.id);
                                    }}
                                >
                                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    <Folder size={16} />
                                    <span>{tx(group.en, group.zh)}</span>
                                    <small>{group.factor} · {rows.length}</small>
                                </button>
                            </div>
                            {editable && activeGroup === group.id && rows.length > 0 && (
                                <div className="commercial-layer-batch" aria-label={tx(`${group.en} batch controls`, `${group.zh}批量调整`)}>
                                    <span>{tx('Move all', '整组移动')}</span>
                                    <select value={moveStep} onChange={(event) => setMoveStep(Number(event.target.value))} aria-label={tx('Group move step', '整组移动步长')}>
                                        <option value={4}>4px</option>
                                        <option value={20}>20px</option>
                                        <option value={100}>100px</option>
                                    </select>
                                    <button type="button" onClick={() => nudgeLayerGroup(group.id, -moveStep, 0)} aria-label={tx(`Move ${group.en} left`, `${group.zh}左移`)}>←</button>
                                    <button type="button" onClick={() => nudgeLayerGroup(group.id, moveStep, 0)} aria-label={tx(`Move ${group.en} right`, `${group.zh}右移`)}>→</button>
                                    <button type="button" onClick={() => nudgeLayerGroup(group.id, 0, -moveStep)} aria-label={tx(`Move ${group.en} up`, `${group.zh}上移`)}>↑</button>
                                    <button type="button" onClick={() => nudgeLayerGroup(group.id, 0, moveStep)} aria-label={tx(`Move ${group.en} down`, `${group.zh}下移`)}>↓</button>
                                    <span>{tx('Scale all', '整组缩放')}</span>
                                    <button type="button" onClick={() => scaleLayerGroup(group.id, 0.98)} aria-label={tx(`Shrink ${group.en}`, `${group.zh}缩小`)}>−</button>
                                    <button type="button" onClick={() => scaleLayerGroup(group.id, 1.02)} aria-label={tx(`Grow ${group.en}`, `${group.zh}放大`)}>＋</button>
                                </div>
                            )}
                            {!collapsed && rows.map((row) => {
                                const visible = !hiddenLayerItemIds.has(row.item.id);
                                return (
                                    <div className={`pixel-world-layer-row commercial-layer-row ${row.item.id === selectedId ? 'active' : ''} ${visible ? '' : 'is-hidden'}`} data-item-id={row.item.id} key={row.item.id}>
                                        <button
                                            type="button"
                                            className="commercial-layer-eye"
                                            aria-label={visible ? tx(`Hide ${row.asset?.name || row.item.assetId}`, `隐藏${row.asset?.name || row.item.assetId}`) : tx(`Show ${row.asset?.name || row.item.assetId}`, `显示${row.asset?.name || row.item.assetId}`)}
                                            aria-pressed={visible}
                                            onClick={() => setLayerVisibility([row.item.id], !visible)}
                                        >{visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                                        <button
                                            type="button"
                                            className="commercial-layer-select"
                                            onClick={() => {
                                                setSelectedId(row.item.id);
                                                setActiveGroup(group.id);
                                            }}
                                            title={`${row.asset?.name || row.item.assetId} / z-index ${row.zIndex}`}
                                        >
                                            <img src={commercialV2Asset(row.asset?.path || '')} alt="" loading="lazy" decoding="async" />
                                            <span className="pixel-world-layer-name">
                                                {ptxt(row.asset?.name || row.item.assetId)}
                                                <small>#{row.layerIndex + 1} · z {row.zIndex} · {ptxt(row.playerRule)}</small>
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
