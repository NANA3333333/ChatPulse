import {
    commercialV2DefaultPlayerScale,
    commercialV2SegmentSize,
    commercialV2MinSegmentCount,
} from '../../../features/city/scene/commercialStreetCore.js';

export function CommercialEditorToolbar({
    tx,
    ptxt,
    showAdvancedToolbar,
    setShowAdvancedToolbar,
    saveLayout,
    viewMode,
    toggleViewMode,
    saveCurrentAsDefaultScene,
    copyLayout,
    assetPanelOpen,
    setAssetPanelOpen,
    setBehaviorPanelCollapsed,
    behaviorPanelCollapsed,
    zoom,
    segmentCount,
    setZoom,
    centerPlayerInView,
    showCollisionLines,
    toggleCollisionLines,
    showPlaceAnchors,
    togglePlaceAnchors,
    showLayerPanel,
    setShowLayerPanel,
    autoTargetId,
    setAutoTargetId,
    travelTargetOptions,
    startAutoTravel,
    cancelAutoTravel,
    autoTravelActive,
    playerActionBubble,
    playerScale,
    updatePlayerScale,
    setPlayerScale,
    canEditLayout,
    prependCanvasSegment,
    appendCanvasSegment,
    removeCanvasSegment,
    groupEditMode,
    setGroupEditMode,
    restoreResetBackup,
    resetLayout,
    selectedItem,
    scaleSelected,
    items,
    moveSelectedLayer,
    bringSelectedToFront,
    sendSelectedToBack,
    deleteSelected,
    notice,
}) {
    return (
        <div className="pixel-world-editor-toolbar">
            <button
                type="button"
                className={`pixel-world-toolbar-more ${showAdvancedToolbar ? 'active' : ''}`}
                onClick={() => setShowAdvancedToolbar((value) => !value)}
            >
                {showAdvancedToolbar ? tx('Hide Advanced', '收起高级') : tx('Advanced Settings', '高级设置')}
            </button>

            {showAdvancedToolbar && (
                <div className="pixel-world-toolbar-advanced pixel-world-toolbar-advanced--commercial">
                    <div className="pixel-world-toolbar-section pixel-world-toolbar-section--maintenance">
                        <button onClick={saveLayout}>{tx('Save Layout', '保存布局')}</button>
                        <button
                            className={viewMode ? 'active' : ''}
                            onClick={toggleViewMode}
                            title={
                                viewMode
                                    ? tx(
                                          'Assets are locked. Turn this off to move and edit.',
                                          '素材已锁定，关闭后才能移动和编辑',
                                      )
                                    : tx('Lock assets to avoid accidental dragging.', '开启后锁定素材，避免误拖')
                            }
                        >
                            {viewMode ? tx('View Mode', '观赏模式') : tx('Edit Mode', '编辑模式')}
                        </button>
                        <button onClick={saveCurrentAsDefaultScene}>
                            {tx('Save Current as Default', '保存当前场景为默认场景')}
                        </button>
                        <button onClick={copyLayout}>{tx('Copy JSON', '复制 JSON')}</button>
                        <button
                            type="button"
                            className={assetPanelOpen ? 'active' : ''}
                            onClick={() => {
                                if (assetPanelOpen) {
                                    setAssetPanelOpen(false);
                                    return;
                                }
                                setAssetPanelOpen(true);
                                setBehaviorPanelCollapsed(true);
                                setShowLayerPanel(false);
                            }}
                        >
                            {assetPanelOpen ? tx('Hide Asset Editor', '收起素材编辑') : tx('Asset Editor', '素材编辑')}
                        </button>
                        <button
                            type="button"
                            className={!behaviorPanelCollapsed ? 'active' : ''}
                            onClick={() => {
                                if (!behaviorPanelCollapsed) {
                                    setBehaviorPanelCollapsed(true);
                                    return;
                                }
                                setBehaviorPanelCollapsed(false);
                                setAssetPanelOpen(false);
                                setShowLayerPanel(false);
                            }}
                        >
                            {behaviorPanelCollapsed
                                ? tx('Behavior Details', '行为树详情')
                                : tx('Hide Behavior Details', '收起行为树详情')}
                        </button>
                    </div>

                    <div className="pixel-world-toolbar-section pixel-world-toolbar-section--status pixel-world-toolbar-section--metrics">
                        <strong>{Math.round(zoom * 100)}%</strong>
                        <strong>
                            {segmentCount} {tx('segments', '段')}
                        </strong>
                        <span>{tx('Looped', '首尾相连')}</span>
                        <span className="pixel-world-player-help">
                            {tx('WASD controls the current character', 'WASD 控制当前人物')}
                        </span>
                    </div>

                    <div className="pixel-world-toolbar-section pixel-world-toolbar-section--canvas-tools">
                        <button onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.1).toFixed(2))))}>
                            {tx('Zoom Out', '画布缩小')}
                        </button>
                        <button onClick={() => setZoom((value) => Math.min(1.4, Number((value + 0.1).toFixed(2))))}>
                            {tx('Zoom In', '画布放大')}
                        </button>
                        <button onClick={() => centerPlayerInView(true)}>
                            {tx('Center Current Character', '居中当前人物')}
                        </button>
                        <button
                            className={showCollisionLines ? 'active' : ''}
                            onClick={toggleCollisionLines}
                            title={tx(
                                'Only toggles collision-line visibility. Collision blocking stays active.',
                                '只切换碰撞箱线条显示；碰撞阻挡默认一直生效',
                            )}
                        >
                            {showCollisionLines
                                ? tx('Hide Collision', '隐藏碰撞箱线')
                                : tx('Show Collision', '查看碰撞箱线')}
                        </button>
                        <button
                            className={showPlaceAnchors ? 'active' : ''}
                            onClick={togglePlaceAnchors}
                            title={tx(
                                'Show anchors used for future auto-travel and interaction.',
                                '查看角色以后自动前往和交互的地点锚点',
                            )}
                        >
                            {showPlaceAnchors ? tx('Hide Anchors', '隐藏地点锚点') : tx('Show Anchors', '查看地点锚点')}
                        </button>
                        <button
                            className={showLayerPanel ? 'active' : ''}
                            onClick={() => setShowLayerPanel((value) => !value)}
                            title={tx(
                                'Show unified layer numbers and the right-side layer list.',
                                '显示统一图层序号和右侧图层列表',
                            )}
                        >
                            {showLayerPanel ? tx('Hide Layers', '隐藏图层') : tx('Show Layers', '查看图层')}
                        </button>
                    </div>

                    <div className="pixel-world-toolbar-section pixel-world-toolbar-section--travel">
                        <label className="pixel-world-auto-walk-control">
                            <span>{tx('Auto Travel', '自动循迹')}</span>
                            <select
                                value={autoTargetId}
                                onChange={(event) => setAutoTargetId(event.target.value)}
                                disabled={!travelTargetOptions.length}
                                aria-label={tx('Auto-travel target', '自动循迹目标')}
                            >
                                {travelTargetOptions.length ? (
                                    travelTargetOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">{tx('No places', '暂无地点')}</option>
                                )}
                            </select>
                            <button
                                type="button"
                                onClick={() => startAutoTravel()}
                                disabled={!travelTargetOptions.length}
                            >
                                {tx('Go', '前往')}
                            </button>
                            <button
                                type="button"
                                onClick={() => cancelAutoTravel('自动循迹已停止。')}
                                disabled={!autoTravelActive && !playerActionBubble}
                            >
                                {tx('Stop', '停止')}
                            </button>
                        </label>
                    </div>

                    <div className="pixel-world-toolbar-section pixel-world-toolbar-section--scale">
                        <label className="pixel-world-player-scale-control">
                            <span>{tx('Character Size', '角色尺寸')}</span>
                            <input
                                type="range"
                                min="0.6"
                                max="3"
                                step="0.05"
                                value={playerScale}
                                onChange={(event) => updatePlayerScale(event.target.value)}
                            />
                            <input
                                type="number"
                                min="0.6"
                                max="3"
                                step="0.05"
                                value={playerScale}
                                onChange={(event) => updatePlayerScale(event.target.value)}
                                aria-label={tx('Character scale', '角色尺寸倍率')}
                            />
                            <strong>{Math.round(playerScale * 100)}%</strong>
                        </label>
                        <button onClick={() => setPlayerScale(commercialV2DefaultPlayerScale)}>
                            {tx('Default Size', '默认角色尺寸')}
                        </button>
                    </div>

                    {canEditLayout ? (
                        <div className="pixel-world-toolbar-section pixel-world-toolbar-section--edit">
                            <button onClick={prependCanvasSegment}>
                                {tx('Add Left', '左边增加')} {commercialV2SegmentSize.width}px
                            </button>
                            <button onClick={appendCanvasSegment}>
                                {tx('Add Right', '右边增加')} {commercialV2SegmentSize.width}px
                            </button>
                            <button
                                onClick={removeCanvasSegment}
                                disabled={segmentCount <= commercialV2MinSegmentCount}
                            >
                                {tx('Remove Segment', '收回一段')}
                            </button>
                            <button
                                className={groupEditMode ? 'active' : ''}
                                onClick={() => setGroupEditMode((value) => !value)}
                                title={tx(
                                    'Drag, scale, and nudge all assets together.',
                                    '开启后拖动、缩放和微调会作用于全部素材',
                                )}
                            >
                                {groupEditMode ? tx('Group Editing', '整体编辑中') : tx('Group Edit', '整体编辑')}
                            </button>
                            <button onClick={restoreResetBackup}>{tx('Restore Previous', '恢复上次布局')}</button>
                            <button onClick={resetLayout}>{tx('Restore Default', '恢复默认')}</button>
                        </div>
                    ) : null}

                    {canEditLayout && (groupEditMode || selectedItem) && (
                        <div className="pixel-world-toolbar-section pixel-world-toolbar-section--selection">
                            <button
                                onClick={() => scaleSelected(0.92)}
                                disabled={groupEditMode ? items.length === 0 : !selectedItem}
                            >
                                {groupEditMode ? tx('Shrink All', '整体缩小') : tx('Shrink Asset', '素材缩小')}
                            </button>
                            <button
                                onClick={() => scaleSelected(1.08)}
                                disabled={groupEditMode ? items.length === 0 : !selectedItem}
                            >
                                {groupEditMode ? tx('Grow All', '整体放大') : tx('Grow Asset', '素材放大')}
                            </button>
                            {!groupEditMode && (
                                <>
                                    <button onClick={() => moveSelectedLayer('up')} disabled={!selectedItem}>
                                        {tx('Layer Up', '上移图层')}
                                    </button>
                                    <button onClick={() => moveSelectedLayer('down')} disabled={!selectedItem}>
                                        {tx('Layer Down', '下移图层')}
                                    </button>
                                    <button onClick={bringSelectedToFront} disabled={!selectedItem}>
                                        {tx('Bring Front', '置顶')}
                                    </button>
                                    <button onClick={sendSelectedToBack} disabled={!selectedItem}>
                                        {tx('Send Back', '置底')}
                                    </button>
                                    <button onClick={deleteSelected} disabled={!selectedItem}>
                                        {tx('Delete', '删除')}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    <div className="pixel-world-toolbar-message-row">
                        {!canEditLayout && (
                            <span className="pixel-world-toolbar-muted">
                                {tx(
                                    'Switch to edit mode to reveal layout and selected-asset tools.',
                                    '切到编辑模式后才显示画布、图层和选中素材工具。',
                                )}
                            </span>
                        )}
                        <span className="pixel-world-toolbar-notice">{ptxt(notice)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
