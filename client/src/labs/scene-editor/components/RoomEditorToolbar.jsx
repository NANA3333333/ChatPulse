import { roomEditorMinPlayerScale, roomEditorMaxPlayerScale } from '../../../features/city/scene/roomEditorCore.js';

export function RoomEditorToolbar({
    saveLayout,
    tx,
    viewMode,
    toggleViewMode,
    ptxt,
    zoom,
    showAdvancedToolbar,
    setShowAdvancedToolbar,
    saveCurrentAsDefaultScene,
    copyLayout,
    copyAiLayout,
    setZoom,
    showCollisionLines,
    toggleCollisionLines,
    showPlaceAnchors,
    togglePlaceAnchors,
    showLayerPanel,
    setShowLayerPanel,
    playerScale,
    updatePlayerScale,
    canEditLayout,
    groupEditMode,
    setGroupEditMode,
    restoreResetBackup,
    resetLayout,
    selectedItem,
    scaleSelected,
    items,
    cycleSelectedDirection,
    canRotateSelected,
    moveSelectedLayer,
    bringSelectedToFront,
    sendSelectedToBack,
    deleteSelected,
    notice,
}) {
    return (
        <div className="pixel-world-editor-toolbar">
            <div className="pixel-world-toolbar-section pixel-world-toolbar-section--primary">
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
            </div>

            <div className="pixel-world-toolbar-section pixel-world-toolbar-section--status">
                <strong>{Math.round(zoom * 100)}%</strong>
                <span className="pixel-world-player-help">
                    {tx('Move sprites with WASD / arrow keys', 'WASD / 方向键移动小人')}
                </span>
            </div>

            <button
                type="button"
                className={`pixel-world-toolbar-more ${showAdvancedToolbar ? 'active' : ''}`}
                onClick={() => setShowAdvancedToolbar((value) => !value)}
            >
                {showAdvancedToolbar ? tx('Hide Advanced', '收起高级') : tx('Advanced Tools', '高级工具')}
            </button>

            {showAdvancedToolbar && (
                <div className="pixel-world-toolbar-advanced">
                    <div className="pixel-world-toolbar-section">
                        <button onClick={saveCurrentAsDefaultScene}>
                            {tx('Save Current as Default', '保存当前场景为默认场景')}
                        </button>
                        <button onClick={copyLayout}>{tx('Copy JSON', '复制 JSON')}</button>
                        <button onClick={copyAiLayout}>{tx('Copy AI Layout Context', '复制 AI 布局上下文')}</button>
                        <button onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.08).toFixed(2))))}>
                            {tx('Zoom Out', '画布缩小')}
                        </button>
                        <button onClick={() => setZoom((value) => Math.min(1.25, Number((value + 0.08).toFixed(2))))}>
                            {tx('Zoom In', '画布放大')}
                        </button>
                        <button
                            className={showCollisionLines ? 'active' : ''}
                            onClick={toggleCollisionLines}
                            title={tx(
                                'Only toggles collision-line visibility. Collision data is still saved.',
                                '只切换碰撞箱线条显示；碰撞数据默认会保存',
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
                                'Show future character interaction points, furniture approach points, or standing anchors.',
                                '查看后续角色交互、家具靠近点或站位锚点',
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

                    <div className="pixel-world-toolbar-section">
                        <label className="pixel-world-player-scale-control">
                            <span>{tx('Sprite Size', '小人尺寸')}</span>
                            <input
                                type="range"
                                min={roomEditorMinPlayerScale}
                                max={roomEditorMaxPlayerScale}
                                step="0.05"
                                value={playerScale}
                                onChange={(event) => updatePlayerScale(event.target.value)}
                            />
                            <input
                                type="number"
                                min={roomEditorMinPlayerScale}
                                max={roomEditorMaxPlayerScale}
                                step="0.05"
                                value={playerScale}
                                onChange={(event) => updatePlayerScale(event.target.value)}
                            />
                            <strong>{Math.round(playerScale * 100)}%</strong>
                        </label>
                    </div>

                    {canEditLayout ? (
                        <div className="pixel-world-toolbar-section pixel-world-toolbar-section--edit">
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
                    ) : (
                        <span className="pixel-world-toolbar-muted">
                            {tx(
                                'Switch to edit mode to reveal layout and selected-asset tools.',
                                '切到编辑模式后才显示图层和选中素材工具。',
                            )}
                        </span>
                    )}

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
                                    <button onClick={cycleSelectedDirection} disabled={!canRotateSelected}>
                                        {tx('Rotate', '旋转方向')}
                                    </button>
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
                </div>
            )}

            <span className="pixel-world-toolbar-notice">{ptxt(notice)}</span>
        </div>
    );
}
