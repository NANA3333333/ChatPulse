import {
    roomEditorDirectionOrder,
    roomEditorDirectionLabels,
    roomEditorAsset,
} from '../../../features/city/scene/roomEditorCore.js';
import { isCommercialV2CollisionAsset } from '../../../features/city/scene/commercialStreetCore.js';

export function RoomSelectionInspector({
    tx,
    viewMode,
    selectedItem,
    selectedAsset,
    ptxt,
    selectedDirectionGroup,
    cycleSelectedDirection,
    canRotateSelected,
    selectedDirection,
    updateSelectedDirection,
    selectedIsGroundLayer,
    updateSelectedGroundLayer,
    selectedPlace,
    showPlaceAnchors,
    togglePlaceAnchors,
    selectedPlaceAnchorLocalPoint,
    updateSelectedPlaceAnchorLocalPoint,
    resetSelectedPlaceAnchor,
    updateItem,
    nudgeSelected,
    scaleSelected,
    groupEditMode,
    showCollisionLines,
    toggleCollisionLines,
    selectedCollision,
    selectedCollisionCanTakeEffect,
    updateSelectedCollisionEnabled,
    selectedCollisionLocalBox,
    updateSelectedCollisionLocalBox,
    resetSelectedCollision,
    fitSelectedCollisionToSprite,
    showLayerPanel,
    selectedLayerRow,
    layerRows,
    selectedId,
    setSelectedId,
    aiLayoutPrompt,
    layoutJson,
}) {
    return (
        <aside className="pixel-world-inspector">
            <h3>{tx('Selection', '选中')}</h3>
            {viewMode ? (
                <p>
                    {tx(
                        'View mode is on. Assets cannot be selected or dragged. Switch to edit mode to move them.',
                        '观赏模式已开启，素材不会被选中或拖动；切到编辑模式后可以移动素材。',
                    )}
                </p>
            ) : selectedItem && selectedAsset ? (
                <>
                    <div className="pixel-world-selected-name">{ptxt(selectedAsset.name)}</div>
                    {selectedDirectionGroup && (
                        <div className="pixel-world-direction-card">
                            <div className="pixel-world-direction-card-head">
                                <strong>{tx('Direction', '方向')}</strong>
                                <button onClick={cycleSelectedDirection} disabled={!canRotateSelected}>
                                    {tx('Rotate', '旋转方向')}
                                </button>
                            </div>
                            <div
                                className="pixel-world-direction-grid"
                                role="group"
                                aria-label={tx(
                                    `${ptxt(selectedDirectionGroup.name)} direction`,
                                    `${selectedDirectionGroup.name}方向`,
                                )}
                            >
                                {roomEditorDirectionOrder.map((direction) => {
                                    const variant = selectedDirectionGroup.variants?.[direction];
                                    return (
                                        <button
                                            key={`${selectedDirectionGroup.id}-${direction}`}
                                            type="button"
                                            className={selectedDirection === direction ? 'active' : ''}
                                            onClick={() => updateSelectedDirection(direction)}
                                            disabled={!canRotateSelected || !variant}
                                            title={ptxt(
                                                variant?.name ||
                                                    `${selectedDirectionGroup.name}-${roomEditorDirectionLabels[direction]}`,
                                            )}
                                        >
                                            {variant ? (
                                                <img
                                                    src={roomEditorAsset(variant.path)}
                                                    alt=""
                                                    draggable={false}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <span aria-hidden="true">--</span>
                                            )}
                                            <em>{ptxt(roomEditorDirectionLabels[direction])}</em>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className={`pixel-world-layer-mode-card ${selectedIsGroundLayer ? 'ground' : ''}`}>
                        <div className="pixel-world-layer-mode-head">
                            <strong>{tx('Layer Properties', '图层属性')}</strong>
                            <label className="pixel-world-collision-toggle">
                                <input
                                    type="checkbox"
                                    checked={selectedIsGroundLayer}
                                    onChange={(event) => updateSelectedGroundLayer(event.target.checked)}
                                />
                                <span>{tx('Ground Layer', '地面层')}</span>
                            </label>
                        </div>
                        <small>
                            {selectedIsGroundLayer
                                ? tx(
                                      'This instance stays below normal assets. Its collision box is saved but does not block characters.',
                                      '当前实例会恒在普通素材下方；碰撞箱保留但不会阻挡人物。',
                                  )
                                : tx(
                                      'Normal assets render by layer order, and collision boxes can block characters later.',
                                      '普通素材会按图层顺序显示，碰撞箱可用于后续人物阻挡。',
                                  )}
                        </small>
                    </div>
                    {selectedPlace && (
                        <div className="pixel-world-place-card">
                            <div className="pixel-world-place-card-head">
                                <strong>{tx('Place Anchor', '地点锚点')}</strong>
                                {!showPlaceAnchors && (
                                    <button onClick={togglePlaceAnchors}>{tx('Show Anchors', '查看锚点')}</button>
                                )}
                            </div>
                            <span>{ptxt(selectedPlace.name)}</span>
                            <small>
                                {tx(
                                    'Use: furniture approach point / standing point / reserved interaction point',
                                    '用途: 家具靠近点 / 站位点 / 交互点预留',
                                )}
                            </small>
                            {selectedPlaceAnchorLocalPoint && (
                                <>
                                    <div className="pixel-world-place-fields">
                                        {['x', 'y'].map((key) => (
                                            <label key={`room-place-anchor-${key}`}>
                                                <span>{key.toUpperCase()}</span>
                                                <input
                                                    type="number"
                                                    value={selectedPlaceAnchorLocalPoint[key]}
                                                    onChange={(event) =>
                                                        updateSelectedPlaceAnchorLocalPoint(key, event.target.value)
                                                    }
                                                />
                                            </label>
                                        ))}
                                    </div>
                                    <div className="pixel-world-collision-actions">
                                        <button onClick={resetSelectedPlaceAnchor}>
                                            {tx('Default Anchor', '默认锚点')}
                                        </button>
                                    </div>
                                    <div className="pixel-world-inspector-hint">
                                        {tx(
                                            'After showing anchors, drag the pink point to edit the approach point. Saving the layout saves it too.',
                                            '显示锚点后，拖粉色点就能改靠近点；保存布局会一起保存。',
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {['x', 'y', 'w', 'h'].map((key) => (
                        <label key={key}>
                            <span>{key.toUpperCase()}</span>
                            <input
                                type="number"
                                value={Math.round(selectedItem[key])}
                                onChange={(event) => updateItem(selectedItem.id, { [key]: Number(event.target.value) })}
                            />
                        </label>
                    ))}
                    <div className="pixel-world-nudge-pad" aria-label={tx('Nudge position', '微调位置')}>
                        <button onClick={() => nudgeSelected(0, -4)}>↑</button>
                        <button onClick={() => nudgeSelected(-4, 0)}>←</button>
                        <button onClick={() => nudgeSelected(4, 0)}>→</button>
                        <button onClick={() => nudgeSelected(0, 4)}>↓</button>
                    </div>
                    <div className="pixel-world-scale-row">
                        <button onClick={() => scaleSelected(0.96)}>
                            {groupEditMode ? tx('Smaller All', '整体小一点') : tx('Smaller', '小一点')}
                        </button>
                        <button onClick={() => scaleSelected(1.04)}>
                            {groupEditMode ? tx('Larger All', '整体大一点') : tx('Larger', '大一点')}
                        </button>
                    </div>
                    <div className={`pixel-world-collision-editor ${showCollisionLines ? 'active' : ''}`}>
                        <div className="pixel-world-collision-editor-head">
                            <strong>{tx('Collision Volume', '碰撞体积')}</strong>
                            {!showCollisionLines && (
                                <button onClick={toggleCollisionLines}>{tx('Show Collision', '查看碰撞箱线')}</button>
                            )}
                            <label className="pixel-world-collision-toggle">
                                <input
                                    type="checkbox"
                                    checked={Boolean(selectedCollision?.enabled)}
                                    disabled={
                                        !isCommercialV2CollisionAsset(selectedAsset) || !selectedCollisionCanTakeEffect
                                    }
                                    onChange={(event) => updateSelectedCollisionEnabled(event.target.checked)}
                                />
                                <span>{tx('Enabled', '启用')}</span>
                            </label>
                        </div>
                        {selectedCollisionCanTakeEffect && selectedCollisionLocalBox ? (
                            <>
                                <div className="pixel-world-collision-fields">
                                    {['x', 'y', 'w', 'h'].map((key) => (
                                        <label key={`room-collision-${key}`}>
                                            <span>{key.toUpperCase()}</span>
                                            <input
                                                type="number"
                                                value={selectedCollisionLocalBox[key]}
                                                onChange={(event) =>
                                                    updateSelectedCollisionLocalBox(key, event.target.value)
                                                }
                                            />
                                        </label>
                                    ))}
                                </div>
                                <div className="pixel-world-collision-actions">
                                    <button onClick={resetSelectedCollision}>{tx('Default', '默认')}</button>
                                    <button onClick={fitSelectedCollisionToSprite}>
                                        {tx('Fit Sprite', '贴合整图')}
                                    </button>
                                </div>
                                <div className="pixel-world-inspector-hint">
                                    {tx(
                                        'After showing lines, drag the green box to move the collision area and blue handles to resize it.',
                                        '显示线条后，拖绿色框移动碰撞箱，拖蓝色点调整大小。',
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="pixel-world-inspector-hint">
                                {selectedIsGroundLayer
                                    ? tx(
                                          'Ground-layer rule: this collision box will not block characters.',
                                          '地面层规则：这个实例的碰撞箱不会参与人物阻挡。',
                                      )
                                    : tx(
                                          'This asset has no editable collision box yet.',
                                          '这个素材还没有可编辑的碰撞箱。',
                                      )}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <p>
                    {tx(
                        'Click a room asset on the canvas to edit it. Before assets are connected, the JSON on the right stays as an empty room template.',
                        '点击画布上的房间素材开始编辑；素材还没接入时，右侧 JSON 会保持为空房间模板。',
                    )}
                </p>
            )}
            {showLayerPanel && (
                <section className="pixel-world-layer-panel">
                    <div className="pixel-world-layer-panel-head">
                        <strong>{tx('Layers', '图层')}</strong>
                        <small>
                            {tx(
                                'Upper rows render later. Ground layers do not participate in collision.',
                                '上方后绘制；地面层不参与碰撞。',
                            )}
                        </small>
                    </div>
                    {selectedLayerRow && (
                        <div className="pixel-world-layer-current">
                            {tx('Current:', '当前：')}
                            {ptxt(selectedLayerRow.asset?.name || selectedLayerRow.item.assetId)}
                            <span>#{selectedLayerRow.layerIndex + 1}</span>
                        </div>
                    )}
                    <div className="pixel-world-layer-list">
                        {layerRows
                            .slice()
                            .reverse()
                            .map((row) => (
                                <button
                                    key={`room-layer-row-${row.item.id}`}
                                    type="button"
                                    className={`pixel-world-layer-row ${row.item.id === selectedId ? 'active' : ''} ${row.isGround ? 'ground' : 'asset'}`}
                                    onClick={() => setSelectedId(row.item.id)}
                                    title={`${row.asset?.name || row.item.assetId} / z-index ${row.zIndex}`}
                                >
                                    <span className="pixel-world-layer-index">#{row.layerIndex + 1}</span>
                                    <span className="pixel-world-layer-name">
                                        {row.asset?.name || row.item.assetId}
                                        <small>
                                            {ptxt(row.asset?.type || '未知')} · z {row.zIndex} · {ptxt(row.playerRule)}
                                        </small>
                                    </span>
                                    <span className="pixel-world-layer-kind">
                                        {row.isGround ? tx('Ground', '地面') : tx('Asset', '素材')}
                                    </span>
                                </button>
                            ))}
                    </div>
                </section>
            )}
            <h3>{tx('AI Layout Context', 'AI 布局上下文')}</h3>
            <textarea className="pixel-world-ai-layout-textarea" value={aiLayoutPrompt} readOnly />
            <h3>{tx('Layout JSON', '布局 JSON')}</h3>
            <textarea value={layoutJson} readOnly />
        </aside>
    );
}
