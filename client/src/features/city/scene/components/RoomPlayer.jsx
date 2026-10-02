import React from 'react';
import { getRoomEditorPlayerRenderZIndex, getRoomEditorPlayerDepthTie } from '../roomEditorCore.js';
import {
    commercialV2RoleActorId,
    commercialV2UserActorId,
    getCommercialV2PlayerCharacter,
    commercialV2PlayerFrameOrder,
    commercialV2PlayerFrame,
    commercialV2PlayerPeerCollision,
} from '../commercialStreetCore.js';

export function RoomPlayer({
    targetPlayer,
    getPlayerVisualDimensions,
    controlledPlayerId,
    tx,
    players,
    activeBehaviorDialog,
    zoom,
    stageSize,
    ptxt,
    chooseBehaviorDialogChoice,
    behaviorLoading,
    exitBehaviorDialog,
    continueBehaviorDialog,
    showCollisionLines,
}) {
    const character = getCommercialV2PlayerCharacter(targetPlayer);
    const visualDimensions = getPlayerVisualDimensions(targetPlayer);
    const isControlled = targetPlayer.id === controlledPlayerId;
    const actorKind =
        targetPlayer.id === commercialV2RoleActorId
            ? 'role-actor'
            : targetPlayer.id === commercialV2UserActorId
              ? 'user-actor'
              : '';
    const actorLabel = targetPlayer.id === commercialV2RoleActorId ? tx('Character', '角色') : tx('Player', '玩家');
    const frameName = targetPlayer.moving ? commercialV2PlayerFrameOrder[targetPlayer.frame] : 'idle';
    const src = commercialV2PlayerFrame(targetPlayer, `${targetPlayer.direction || 'front'}_walk_${frameName}.png`);
    const zIndex = getRoomEditorPlayerRenderZIndex(targetPlayer, getRoomEditorPlayerDepthTie(players, targetPlayer));
    const behaviorDialog = targetPlayer.id === commercialV2RoleActorId ? activeBehaviorDialog : null;
    const actionBubble = behaviorDialog ? '' : targetPlayer.bubble;
    const playerLeftPx = ((targetPlayer.x || 0) - visualDimensions.width / 2) * zoom;
    const playerTopPx = ((targetPlayer.y || 0) - visualDimensions.height + visualDimensions.footOffset) * zoom;
    const nameplateTop =
        (((targetPlayer.y || 0) - visualDimensions.height + visualDimensions.footOffset - 22) / stageSize.height) * 100;
    const bubbleTop =
        (((targetPlayer.y || 0) - visualDimensions.height + visualDimensions.footOffset - 8) / stageSize.height) * 100;
    const dialogTop =
        (Math.max(20, (targetPlayer.y || 0) - visualDimensions.height + visualDimensions.footOffset - 34) /
            stageSize.height) *
        100;
    const footprintWidth = Math.max(
        commercialV2PlayerPeerCollision.minWidth,
        visualDimensions.width * commercialV2PlayerPeerCollision.widthRatio,
    );
    const footprintHeight = Math.max(
        commercialV2PlayerPeerCollision.minHeight,
        visualDimensions.footOffset * commercialV2PlayerPeerCollision.heightRatio,
    );
    return (
        <React.Fragment key={`room-player-${targetPlayer.id}`}>
            <img
                className={`pixel-world-player ${isControlled ? 'controlled' : ''} ${actorKind}`}
                src={src}
                alt=""
                draggable={false}
                title={`${ptxt(character.label)} · ${actorLabel}`}
                style={{
                    left: 0,
                    top: 0,
                    width: `${visualDimensions.width * zoom}px`,
                    height: `${visualDimensions.height * zoom}px`,
                    transform: `translate3d(${playerLeftPx}px, ${playerTopPx}px, 0)`,
                    zIndex,
                }}
            />
            <span
                className={`pixel-world-player-nameplate ${actorKind}`}
                style={{
                    left: `${((targetPlayer.x || 0) / stageSize.width) * 100}%`,
                    top: `${nameplateTop}%`,
                    zIndex: zIndex + 900,
                }}
            >
                {actorLabel}
            </span>
            {actionBubble && (
                <span
                    className="pixel-world-player-action-bubble"
                    style={{
                        left: `${((targetPlayer.x || 0) / stageSize.width) * 100}%`,
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
                        left: `${((targetPlayer.x || 0) / stageSize.width) * 100}%`,
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
                        left: `${(((targetPlayer.x || 0) - footprintWidth / 2) / stageSize.width) * 100}%`,
                        top: `${(((targetPlayer.y || 0) - footprintHeight / 2) / stageSize.height) * 100}%`,
                        width: `${(footprintWidth / stageSize.width) * 100}%`,
                        height: `${(footprintHeight / stageSize.height) * 100}%`,
                        zIndex: zIndex + 1,
                    }}
                />
            )}
        </React.Fragment>
    );
}
