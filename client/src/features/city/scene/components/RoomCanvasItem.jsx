import { getRoomEditorItemRenderZIndex, roomEditorAsset } from '../roomEditorCore.js';
import { getCommercialV2EffectiveCollision } from '../commercialStreetCore.js';

export function RoomCanvasItem({
    item,
    asset,
    layerIndex,
    canEditLayout,
    selectedId,
    showCollisionLines,
    groupEditMode,
    getItemStyle,
    onPointerDown,
    setSelectedId,
    showLayerPanel,
    onCollisionPointerDown,
}) {
    const collision = getCommercialV2EffectiveCollision(item, asset);
    const isSelected = canEditLayout && selectedId === item.id;
    const canEditCollisionBox = showCollisionLines && isSelected && !groupEditMode;
    const collisionHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    return (
        <button
            key={item.id}
            data-item-id={item.id}
            type="button"
            className={`pixel-world-editor-item ${isSelected ? 'selected' : ''} ${canEditLayout && groupEditMode ? 'group-bound' : ''}`}
            style={getItemStyle(item, getRoomEditorItemRenderZIndex(item, asset, layerIndex))}
            onPointerDown={canEditLayout ? (event) => onPointerDown(event, item) : undefined}
            onClick={() => {
                if (canEditLayout) setSelectedId(item.id);
            }}
            title={asset.name}
        >
            <img src={roomEditorAsset(asset.path)} alt="" draggable={false} />
            {showLayerPanel && (
                <span className={`pixel-world-layer-badge ${item.groundLayer ? 'ground' : 'asset'}`}>
                    {layerIndex + 1}
                </span>
            )}
            {showCollisionLines && collision.enabled && (
                <span
                    className={`pixel-world-collision-box ${isSelected ? 'selected' : ''} ${canEditCollisionBox ? 'editable' : ''}`}
                    onPointerDown={
                        canEditCollisionBox ? (event) => onCollisionPointerDown(event, item, asset, 'move') : undefined
                    }
                    style={{
                        left: `${collision.x * 100}%`,
                        top: `${collision.y * 100}%`,
                        width: `${collision.w * 100}%`,
                        height: `${collision.h * 100}%`,
                    }}
                >
                    {canEditCollisionBox &&
                        collisionHandles.map((handle) => (
                            <span
                                key={handle}
                                className={`pixel-world-collision-handle handle-${handle}`}
                                onPointerDown={(event) => onCollisionPointerDown(event, item, asset, handle)}
                            />
                        ))}
                </span>
            )}
        </button>
    );
}
