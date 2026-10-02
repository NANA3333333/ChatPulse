import { isCommercialV2CollisionAsset } from '../../../features/city/scene/commercialStreetCore.js';

export function CommercialSelectionInspector({
    viewMode,
    tx,
    selectedItem,
    selectedAsset,
    ptxt,
    selectedIsGroundLayer,
    selectedIsBuiltInGroundLayer,
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
    layoutJson,
}) {
    return (
        <div className="pixel-world-inspector pixel-world-behavior-selection-inspector">
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
                    <div className={`pixel-world-layer-mode-card ${selectedIsGroundLayer ? 'ground' : ''}`}>
                        <div className="pixel-world-layer-mode-head">
                            <strong>{tx('Layer Properties', '图层属性')}</strong>
                            <label className="pixel-world-collision-toggle">
                                <input
                                    type="checkbox"
                                    checked={selectedIsGroundLayer}
                                    disabled={selectedIsBuiltInGroundLayer}
                                    onChange={(event) => updateSelectedGroundLayer(event.target.checked)}
                                />
                                <span>{tx('Backdrop Layer', '背景/地面下层')}</span>
                            </label>
                        </div>
                        <small>
                            {selectedIsBuiltInGroundLayer
                                ? tx(
                                      'Sky and road assets use fixed base layers and do not block characters.',
                                      '天空和道路使用固定基础层，碰撞箱不会阻挡人物。',
                                  )
                                : selectedIsGroundLayer
                                  ? tx(
                                        'This instance stays above the sky and below the road ground. Its collision box is saved but does not block characters.',
                                        '当前实例会在天空上方、地面下方；碰撞箱保留但不会阻挡人物。',
                                    )
                                  : tx(
                                        'Normal assets render above the road ground by layer and occlusion order.',
                                        '普通素材会在地面上方，按图层和遮挡判断显示。',
                                    )}
                        </small>
                    </div>
                    {selectedPlace && (
                        <div className="pixel-world-place-card">
                            <div className="pixel-world-place-card-head">
                                <strong>{tx('Place Link', '地点联动')}</strong>
                                {!showPlaceAnchors && (
                                    <button onClick={togglePlaceAnchors}>{tx('Show Endpoint', '查看终点')}</button>
                                )}
                            </div>
                            <span>{ptxt(selectedPlace.name)}</span>
                            <small>ID: {selectedPlace.placeId}</small>
                            <small>
                                {tx('Backend places:', '后端地点:')} {selectedPlace.locationIds.join(' / ')}
                            </small>
                            <small>
                                {tx('Actions:', '动作:')} {selectedPlace.actions.join(' / ')}
                            </small>
                            {selectedPlaceAnchorLocalPoint && (
                                <>
                                    <div className="pixel-world-place-fields">
                                        {['x', 'y'].map((key) => (
                                            <label key={`place-anchor-${key}`}>
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
                                            {tx('Default Endpoint', '默认终点')}
                                        </button>
                                    </div>
                                    <div className="pixel-world-inspector-hint">
                                        {tx(
                                            'After showing endpoints, drag the pink point to edit the auto-travel landing point. Saving the layout saves it too.',
                                            '显示终点后，拖粉色点就能改自动循迹落点；保存布局会一起保存。',
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
                                        <label key={`collision-${key}`}>
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
                                        'Collision is active by default. Show lines, then drag the green box to move it and blue handles to resize.',
                                        '碰撞默认生效；显示线条后，拖绿色框移动碰撞箱，拖蓝色点调整大小。',
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="pixel-world-inspector-hint">
                                {selectedIsGroundLayer
                                    ? tx(
                                          'Ground-layer rule: this collision box will not block characters or auto-travel paths.',
                                          '地面层规则：这个实例的碰撞箱不会参与人物阻挡或自动循迹绕路。',
                                      )
                                    : tx(
                                          'This asset has no editable collision box yet.',
                                          '这个素材还没有可编辑的碰撞箱。',
                                      )}
                            </div>
                        )}
                    </div>
                    <div className="pixel-world-inspector-hint">
                        {groupEditMode
                            ? tx(
                                  'Group editing is on: dragging any asset moves all current buildings and props together.',
                                  '整体编辑已开启：拖动任意素材会带动当前全部建筑和道具。',
                              )
                            : tx(
                                  'Drag assets to move them. Use W/H to resize while preserving the source aspect ratio.',
                                  '拖动素材移动；用 W/H 调整大小，显示会保持原图比例。',
                              )}
                    </div>
                </>
            ) : (
                <p>{tx('Click an asset on the canvas to start editing.', '点击画布上的素材开始编辑。')}</p>
            )}
            <h3>{tx('Layout JSON', '布局 JSON')}</h3>
            <textarea value={layoutJson} readOnly />
        </div>
    );
}
