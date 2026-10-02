import React, { useRef } from 'react';
import {
    isCommercialV2DynamicOcclusionItem,
    getCommercialV2EffectiveCollision,
    buildCommercialV2ItemPlace,
    isCommercialV2GroundLayerItem,
    isCommercialV2BackgroundSceneryItem,
    getCommercialV2ItemRenderZIndex,
    createCommercialV2PlayerState,
    commercialV2PlayerCharacters,
    commercialV2PlayerFrame,
    commercialV2PlayerPeerCollision,
    commercialV2PlayerFrameOrder,
    commercialV2BackgroundColor,
    isCommercialV2SkyStripAsset,
    commercialV2LoopSeamMargin,
    getCommercialV2OcclusionDecision,
    commercialV2PlayerOccludedZReserve,
    getCommercialV2PlayerRenderZIndex,
    commercialV2PlayerLayerGap,
    commercialV2Asset,
} from '../commercialStreetCore.js';

export function CommercialCanvasPanel({
    panelKey,
    interactive,
    renderContents = true,
    parallaxActive,
    stageSize,
    playerDimensions,
    items,
    assetById,
    assetSilhouettes,
    players,
    canEditLayout,
    selectedId,
    showCollisionLines,
    groupEditMode,
    onPointerDown,
    setSelectedId,
    showLayerPanel,
    hiddenLayerItemIds,
    onCollisionPointerDown,
    onPlaceAnchorPointerDown,
    ptxt,
    getPlayerVisualDimensions,
    controlledPlayerId,
    behaviorTargetActorId,
    behaviorUserActorId,
    behaviorCharacter,
    tx,
    activeBehaviorDialog,
    playerActionBubbles,
    playerActionBubble,
    zoom,
    chooseBehaviorDialogChoice,
    behaviorLoading,
    exitBehaviorDialog,
    continueBehaviorDialog,
    player,
    showPlaceAnchors,
    stageRef,
    onPointerMove,
    onPointerUp,
    renderPlayerInteractionMenu,
}) {
    const itemLayerCacheRef = useRef(null);
    function getLoopOffsets(item, asset) {
        const offsets = [0];
        if (isCommercialV2SkyStripAsset(asset) && item.w > 0) {
            const minCopy = Math.floor((-item.x - item.w) / item.w);
            const maxCopy = Math.ceil((stageSize.width - item.x) / item.w);
            for (let copy = minCopy; copy <= maxCopy; copy += 1) {
                const offset = copy * item.w;
                const left = item.x + offset;
                const right = left + item.w;
                if (right > 0 && left < stageSize.width) offsets.push(offset);
            }
            return [...new Set(offsets)];
        }
        if (item.x <= commercialV2LoopSeamMargin) offsets.push(stageSize.width);
        if (item.x + item.w >= stageSize.width - commercialV2LoopSeamMargin) offsets.push(-stageSize.width);
        return offsets;
    }

    function getItemStyle(item, offset = 0, zIndex = 1) {
        const style = {
            left: `${((item.x + offset) / stageSize.width) * 100}%`,
            top: `${(item.y / stageSize.height) * 100}%`,
            width: `${(item.w / stageSize.width) * 100}%`,
            height: `${(item.h / stageSize.height) * 100}%`,
            zIndex,
        };
        return style;
    }

    function getItemZIndex(layerIndex, item, asset, playerZIndex = null) {
        const zIndex = getCommercialV2ItemRenderZIndex(layerIndex, item, asset);
        if (asset && isCommercialV2GroundLayerItem(item, asset) && Number.isFinite(playerZIndex)) {
            return Math.min(zIndex, playerZIndex - 1);
        }
        return zIndex;
    }

    function getPlayerOcclusionProbeForOffset(targetPlayer, offset = 0) {
        const visualX = targetPlayer.x + offset;
        const probeWidth = Math.max(28, playerDimensions.width * 0.44);
        const probeHeight = Math.max(34, playerDimensions.height * 0.36);
        return {
            x: visualX - probeWidth / 2,
            y: targetPlayer.y - probeHeight,
            w: probeWidth,
            h: probeHeight + playerDimensions.footOffset,
        };
    }

    function getPlayerOccludingLayerIndex(targetPlayer) {
        let occludingLayerIndex = null;
        const playerBoxes = getPlayerLoopOffsets(targetPlayer).map((offset) => ({
            probe: getPlayerOcclusionProbeForOffset(targetPlayer, offset),
        }));
        items.forEach((item, layerIndex) => {
            const asset = assetById.get(item.assetId);
            if (!isCommercialV2DynamicOcclusionItem(item, asset)) return;
            const silhouette = assetSilhouettes[item.assetId];
            getLoopOffsets(item, asset).forEach((itemOffset) => {
                playerBoxes.forEach(({ probe }) => {
                    const shouldOcclude =
                        getCommercialV2OcclusionDecision(item, asset, silhouette, probe, targetPlayer.y, itemOffset) ===
                        'front';
                    if (!shouldOcclude) return;
                    occludingLayerIndex =
                        occludingLayerIndex === null ? layerIndex : Math.min(occludingLayerIndex, layerIndex);
                });
            });
        });
        return occludingLayerIndex;
    }

    function getPlayerDepthTie(targetPlayer) {
        const sortedPlayers = commercialV2PlayerCharacters
            .map((character) => players[character.id] || createCommercialV2PlayerState(character))
            .sort(
                (a, b) =>
                    Number(a?.y || 0) - Number(b?.y || 0) ||
                    Number(a?.x || 0) - Number(b?.x || 0) ||
                    String(a?.id || '').localeCompare(String(b?.id || '')),
            );
        return Math.max(
            0,
            sortedPlayers.findIndex((item) => item.id === targetPlayer.id),
        );
    }

    function getPlayerZIndex(targetPlayer) {
        const depthTie = getPlayerDepthTie(targetPlayer);
        const occludingLayerIndex = getPlayerOccludingLayerIndex(targetPlayer);
        if (occludingLayerIndex !== null) {
            const occludingItem = items[occludingLayerIndex];
            const occludingAsset = occludingItem ? assetById.get(occludingItem.assetId) : null;
            return (
                getCommercialV2ItemRenderZIndex(occludingLayerIndex, occludingItem, occludingAsset) -
                commercialV2PlayerOccludedZReserve +
                Math.min(depthTie, commercialV2PlayerOccludedZReserve - 1)
            );
        }
        return getCommercialV2PlayerRenderZIndex(targetPlayer, depthTie * commercialV2PlayerLayerGap);
    }

    function renderEditorItem(panelItem, asset, offset, isGhost, layerIndex, playerZIndex) {
        const collision = getCommercialV2EffectiveCollision(panelItem, asset);
        let parallaxPlane;
        if (asset?.type === '天空') parallaxPlane = 'far';
        else if (asset?.id?.startsWith('greenery_') && isCommercialV2BackgroundSceneryItem(panelItem, asset)) {
            parallaxPlane = 'middle';
        }
        const isSelected = canEditLayout && selectedId === panelItem.id;
        const canEditCollisionBox = showCollisionLines && isSelected && !isGhost && !groupEditMode;
        const collisionHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        return (
            <button
                key={`${panelKey}-${panelItem.id}-${isGhost ? 'ghost' : 'active'}-${offset}`}
                data-item-id={panelItem.id}
                data-parallax-plane={parallaxPlane}
                type="button"
                className={`pixel-world-editor-item ${isGhost ? 'loop-ghost' : ''} ${isSelected ? 'selected' : ''} ${canEditLayout && groupEditMode ? 'group-bound' : ''}`}
                style={getItemStyle(panelItem, offset, getItemZIndex(layerIndex, panelItem, asset, playerZIndex))}
                onPointerDown={canEditLayout ? (event) => onPointerDown(event, panelItem, offset) : undefined}
                onClick={() => {
                    if (canEditLayout) setSelectedId(panelItem.id);
                }}
                title={asset.name}
            >
                {(!parallaxActive || !parallaxPlane) && <img src={commercialV2Asset(asset.path)} alt="" draggable={false} />}
                {showLayerPanel && (
                    <span
                        className={`pixel-world-layer-badge ${isCommercialV2GroundLayerItem(panelItem, asset) ? 'ground' : 'asset'}`}
                    >
                        {layerIndex + 1}
                    </span>
                )}
                {showCollisionLines && collision.enabled && (
                    <span
                        className={`pixel-world-collision-box ${isSelected ? 'selected' : ''} ${canEditCollisionBox ? 'editable' : ''}`}
                        onPointerDown={
                            canEditCollisionBox
                                ? (event) => onCollisionPointerDown(event, panelItem, asset, offset, 'move')
                                : undefined
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
                                    onPointerDown={(event) =>
                                        onCollisionPointerDown(event, panelItem, asset, offset, handle)
                                    }
                                />
                            ))}
                    </span>
                )}
            </button>
        );
    }

    function renderPlaceAnchor(panelItem, asset, offset, layerIndex, playerZIndex) {
        const place = buildCommercialV2ItemPlace(panelItem, asset);
        if (!place) return null;
        const isSelected = canEditLayout && selectedId === panelItem.id;
        const canEditPlaceAnchor = isSelected && !groupEditMode && offset === 0;
        const locationText = place.locationIds.join(' / ');
        return (
            <span
                key={`${panelKey}-${panelItem.id}-place-anchor-${offset}`}
                className={`pixel-world-place-anchor ${isSelected ? 'selected' : ''} ${canEditPlaceAnchor ? 'editable' : ''} ${place.manualAnchor ? 'manual' : ''}`}
                onPointerDown={
                    canEditPlaceAnchor
                        ? (event) => onPlaceAnchorPointerDown(event, panelItem, asset, offset)
                        : undefined
                }
                style={{
                    left: `${((place.anchor.x + offset) / stageSize.width) * 100}%`,
                    top: `${(place.anchor.y / stageSize.height) * 100}%`,
                    zIndex: playerZIndex + 80 + layerIndex,
                }}
                title={`${ptxt(place.name)} -> ${locationText}`}
            >
                <span>{ptxt(place.name)}</span>
            </span>
        );
    }

    function getPlayerLoopOffsets(targetPlayer) {
        const offsets = [0];
        const halfWidth = getPlayerVisualDimensions(targetPlayer).width / 2;
        if (targetPlayer.x - halfWidth < 0) offsets.push(stageSize.width);
        if (targetPlayer.x + halfWidth > stageSize.width) offsets.push(-stageSize.width);
        return offsets;
    }

    function renderPlayer(targetPlayer, offset = 0, zIndex = getPlayerZIndex(targetPlayer)) {
        const isControlled = targetPlayer.id === controlledPlayerId;
        const visualDimensions = getPlayerVisualDimensions(targetPlayer);
        const actorKind =
            targetPlayer.id === behaviorTargetActorId
                ? 'role-actor'
                : targetPlayer.id === behaviorUserActorId
                  ? 'user-actor'
                  : '';
        const actorLabel =
            actorKind === 'role-actor'
                ? behaviorCharacter?.name || tx('Character', '角色')
                : actorKind === 'user-actor'
                  ? tx('Player', '玩家')
                  : '';
        const frameName = targetPlayer.moving ? commercialV2PlayerFrameOrder[targetPlayer.frame] : 'idle';
        const src = commercialV2PlayerFrame(targetPlayer, `${targetPlayer.direction}_walk_${frameName}.png`);
        const visualX = targetPlayer.x + offset;
        const behaviorDialog = targetPlayer.id === behaviorTargetActorId ? activeBehaviorDialog : null;
        const actionBubble = behaviorDialog
            ? ''
            : playerActionBubbles[targetPlayer.id] || (isControlled ? playerActionBubble : '');
        const playerLeftPx = (visualX - visualDimensions.width / 2) * zoom;
        const playerTopPx = (targetPlayer.y - visualDimensions.height + visualDimensions.footOffset) * zoom;
        const bubbleTop =
            ((targetPlayer.y - visualDimensions.height + visualDimensions.footOffset - 8) / stageSize.height) * 100;
        const dialogTop =
            (Math.max(20, targetPlayer.y - visualDimensions.height + visualDimensions.footOffset - 34) /
                stageSize.height) *
            100;
        const nameplateTop =
            ((targetPlayer.y - visualDimensions.height + visualDimensions.footOffset - 22) / stageSize.height) * 100;
        const peerCollisionWidth = Math.max(
            commercialV2PlayerPeerCollision.minWidth,
            visualDimensions.width * commercialV2PlayerPeerCollision.widthRatio,
        );
        const peerCollisionHeight = Math.max(
            commercialV2PlayerPeerCollision.minHeight,
            visualDimensions.footOffset * commercialV2PlayerPeerCollision.heightRatio,
        );
        const peerCollisionBox = {
            x: visualX - peerCollisionWidth / 2,
            y: targetPlayer.y - peerCollisionHeight / 2,
            w: peerCollisionWidth,
            h: peerCollisionHeight,
        };
        return (
            <React.Fragment key={`player-${targetPlayer.id}-${offset}`}>
                <img
                    className={`pixel-world-player ${isControlled ? 'controlled' : ''} ${actorKind}`}
                    src={src}
                    alt=""
                    draggable={false}
                    style={{
                        left: 0,
                        top: 0,
                        width: `${visualDimensions.width * zoom}px`,
                        height: `${visualDimensions.height * zoom}px`,
                        transform: `translate3d(${playerLeftPx}px, ${playerTopPx}px, 0)`,
                        zIndex,
                    }}
                />
                {actorLabel && (
                    <span
                        className={`pixel-world-player-nameplate ${actorKind}`}
                        style={{
                            left: `${(visualX / stageSize.width) * 100}%`,
                            top: `${nameplateTop}%`,
                            zIndex: zIndex + 900,
                        }}
                    >
                        {actorLabel}
                    </span>
                )}
                {actionBubble && (
                    <span
                        className="pixel-world-player-action-bubble"
                        style={{
                            left: `${(visualX / stageSize.width) * 100}%`,
                            top: `${bubbleTop}%`,
                            zIndex: zIndex + 1000,
                        }}
                    >
                        {ptxt(actionBubble)}
                    </span>
                )}
                {behaviorDialog && (
                    <div
                        className={`pixel-world-behavior-dialog ${behaviorDialog.type || ''}`}
                        style={{
                            left: `${(visualX / stageSize.width) * 100}%`,
                            top: `${dialogTop}%`,
                            zIndex: zIndex + 1300,
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        <div className="pixel-world-behavior-dialog-head">
                            <strong>{behaviorDialog.title || tx('Character', '角色')}</strong>
                            <span>
                                {Math.min((behaviorDialog.stepIndex || 0) + 1, behaviorDialog.totalSteps || 1)}/
                                {behaviorDialog.totalSteps || 1}
                            </span>
                        </div>
                        <p>{behaviorDialog.text}</p>
                        {behaviorDialog.type === 'pending' ? (
                            <button type="button" disabled>
                                {tx('Generating...', '生成中...')}
                            </button>
                        ) : behaviorDialog.type === 'choice' && behaviorDialog.choices?.length ? (
                            <div className="pixel-world-behavior-dialog-choices">
                                {behaviorDialog.choices.map((choice) => (
                                    <button
                                        key={choice.id}
                                        type="button"
                                        onClick={() => chooseBehaviorDialogChoice(choice)}
                                        disabled={behaviorLoading}
                                    >
                                        {ptxt(choice.label)}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className="pixel-world-behavior-dialog-exit"
                                    onClick={exitBehaviorDialog}
                                    disabled={behaviorLoading}
                                >
                                    {tx('Exit Dialog', '退出对话')}
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={continueBehaviorDialog}>
                                {tx('Next Line', '下一句')}
                            </button>
                        )}
                    </div>
                )}
                {showCollisionLines && (
                    <span
                        className={`pixel-world-player-footprint ${isControlled ? 'controlled' : ''}`}
                        style={{
                            left: `${(peerCollisionBox.x / stageSize.width) * 100}%`,
                            top: `${(peerCollisionBox.y / stageSize.height) * 100}%`,
                            width: `${(peerCollisionBox.w / stageSize.width) * 100}%`,
                            height: `${(peerCollisionBox.h / stageSize.height) * 100}%`,
                            zIndex: zIndex + 1,
                        }}
                    />
                )}
            </React.Fragment>
        );
    }

    function renderItemCopies(item, asset, interactivePanel, layerIndex, playerZIndex) {
        if (!interactivePanel) {
            return getLoopOffsets(item, asset).map((offset) =>
                renderEditorItem(item, asset, offset, true, layerIndex, playerZIndex),
            );
        }
        return [
            ...getLoopOffsets(item, asset)
                .filter((offset) => offset !== 0)
                .map((offset) => renderEditorItem(item, asset, offset, true, layerIndex, playerZIndex)),
            renderEditorItem(item, asset, 0, false, layerIndex, playerZIndex),
        ];
    }

    if (!renderContents) {
        return (
            <div
                className="pixel-world-editor-stage loop-copy"
                data-loop-culled="true"
                style={{
                    '--editor-zoom': zoom,
                    width: `${stageSize.width * zoom}px`,
                    height: `${stageSize.height * zoom}px`,
                    '--street-bg-color': commercialV2BackgroundColor,
                }}
            >
                <div className="pixel-world-editor-bg" aria-hidden="true" />
            </div>
        );
    }

    const controlledPlayerZIndex = getPlayerZIndex(player);
    const playerNodes = commercialV2PlayerCharacters.flatMap((character) => {
        const targetPlayer = players[character.id] || createCommercialV2PlayerState(character);
        const targetPlayerZIndex = getPlayerZIndex(targetPlayer);
        return getPlayerLoopOffsets(targetPlayer).map((offset) =>
            renderPlayer(targetPlayer, offset, targetPlayerZIndex),
        );
    });
    const cacheableView = !canEditLayout && !showCollisionLines && !showPlaceAnchors && !showLayerPanel && !hiddenLayerItemIds?.size;
    const cachedItems = itemLayerCacheRef.current;
    const cacheHit = cacheableView && cachedItems && cachedItems.items === items &&
        cachedItems.assetById === assetById && cachedItems.stageSize === stageSize &&
        cachedItems.interactive === interactive && cachedItems.parallaxActive === parallaxActive &&
        cachedItems.playerZIndex === controlledPlayerZIndex;
    let itemLayer = cacheHit ? cachedItems.element : null;
    const placeAnchorNodes = [];
    if (!itemLayer) {
        const itemNodes = [];
        items.forEach((item, layerIndex) => {
            if (hiddenLayerItemIds?.has(item.id)) return;
            const asset = assetById.get(item.assetId);
            if (!asset) return;
            itemNodes.push(...renderItemCopies(item, asset, interactive, layerIndex, controlledPlayerZIndex));
            if (showPlaceAnchors) {
                getLoopOffsets(item, asset).forEach((offset) => {
                    const anchorNode = renderPlaceAnchor(item, asset, offset, layerIndex, controlledPlayerZIndex);
                    if (anchorNode) placeAnchorNodes.push(anchorNode);
                });
            }
        });
        itemLayer = <>{itemNodes}</>;
        itemLayerCacheRef.current = cacheableView ? {
            items, assetById, stageSize, interactive, parallaxActive,
            playerZIndex: controlledPlayerZIndex, element: itemLayer,
        } : null;
    }

    return (
        <div
            key={panelKey}
            className={`pixel-world-editor-stage ${interactive ? 'active-loop' : 'loop-copy'} ${showCollisionLines ? 'collision-lines-visible' : ''}`}
            ref={interactive ? stageRef : undefined}
            style={{
                '--editor-zoom': zoom,
                width: `${stageSize.width * zoom}px`,
                height: `${stageSize.height * zoom}px`,
                '--street-bg-color': commercialV2BackgroundColor,
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <div className="pixel-world-editor-bg" aria-hidden="true" />
            {itemLayer}
            {playerNodes}
            {placeAnchorNodes}
            {interactive && renderPlayerInteractionMenu()}
        </div>
    );
}
