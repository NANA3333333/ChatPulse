import { buildRoomEditorItemAnchor, roomEditorOverlayZIndex } from '../roomEditorCore.js';

export function RoomPlaceAnchor({
    item,
    asset,
    layerIndex,
    canEditLayout,
    selectedId,
    groupEditMode,
    onPlaceAnchorPointerDown,
    stageSize,
    tx,
    ptxt,
}) {
    const place = buildRoomEditorItemAnchor(item, asset);
    if (!place) return null;
    const isSelected = canEditLayout && selectedId === item.id;
    const canEditPlaceAnchor = isSelected && !groupEditMode;
    return (
        <span
            key={`${item.id}-place-anchor`}
            className={`pixel-world-place-anchor ${isSelected ? 'selected' : ''} ${canEditPlaceAnchor ? 'editable' : ''} ${place.manualAnchor ? 'manual' : ''}`}
            onPointerDown={canEditPlaceAnchor ? (event) => onPlaceAnchorPointerDown(event, item, asset) : undefined}
            style={{
                left: `${(place.anchor.x / stageSize.width) * 100}%`,
                top: `${(place.anchor.y / stageSize.height) * 100}%`,
                zIndex: roomEditorOverlayZIndex + layerIndex,
            }}
            title={tx(`${ptxt(place.name)} anchor`, `${place.name} 锚点`)}
        >
            <span>{place.name}</span>
        </span>
    );
}
