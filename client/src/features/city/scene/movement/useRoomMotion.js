import { subscribeSceneKeyboard } from '../sceneKeyboard.js';
import { useRef, useEffect } from 'react';
import {
    createRoomEditorPlayerState,
    clampRoomEditorPlayer,
    roomEditorBehaviorSafePoints,
    normalizeRoomEditorPlayerState,
    roomEditorPlayerMoveSpeed,
    getRoomEditorDirectionFromDelta,
    roomEditorDefaultPlayerScale,
} from '../roomEditorCore.js';
import {
    commercialV2DefaultControlledPlayerId,
    commercialV2PlayerCharacters,
    commercialV2RoleActorId,
    commercialV2PlayerCharacterById,
    commercialV2UserActorId,
    commercialV2PlayerFrameOrder,
    commercialV2PlayerApproachGap,
    commercialV2PathWaypointReach,
    commercialV2BehaviorPlayerSpeed,
} from '../commercialStreetCore.js';
import { useEventCallback } from '../../../../shared/hooks/useEventCallback.js';

// Room movement, travel recovery, player controls and frame/keyboard lifecycle.
export function useRoomMotion({
    isActive,
    canvasWrapRef,
    playersRef,
    setControlledPlayerIdState,
    controlledPlayerIdRef,
    setPlayerScaleState,
    playerScaleRef,
    advanceBehaviorRuntime: advanceBehavior,
    setBehaviorStatus,
    setNotice,
    stageSize,
    findSafeRoomPlayerPointNear,
    resolveRoomPlayerMovement,
    buildBehaviorSmoothTravelPath,
    queuePlayersRender,
    commitPlayers,
    updateRoomPlayer,
    setWorldPlayerBubble,
    activateBehaviorTravelFailureBranch,
}) {
    const advanceBehaviorRuntime = useEventCallback(advanceBehavior);
    const roomBehaviorTravelRef = useRef(null);

    const roomBehaviorStepRef = useRef(0);

    function stepRoomBehaviorTravel(delta) {
        const travel = roomBehaviorTravelRef.current;
        if (!travel?.playerId) return;
        const travelCharacter = commercialV2PlayerCharacterById.get(travel.playerId) || commercialV2PlayerCharacters[0];
        const currentPlayer = playersRef.current[travel.playerId] || createRoomEditorPlayerState(travelCharacter);
        const path = travel.path?.length ? travel.path : [travel.point];
        let waypointIndex = Math.min(travel.pathIndex || 0, path.length - 1);
        let waypoint = path[waypointIndex] || travel.point;
        let targetDx = waypoint.x - currentPlayer.x;
        let targetDy = waypoint.y - currentPlayer.y;
        let distance = Math.hypot(targetDx, targetDy);
        const waypointReach = Math.max(5, commercialV2PathWaypointReach * 0.65);
        while (distance <= waypointReach && waypointIndex < path.length - 1) {
            waypointIndex += 1;
            travel.pathIndex = waypointIndex;
            waypoint = path[waypointIndex] || travel.point;
            targetDx = waypoint.x - currentPlayer.x;
            targetDy = waypoint.y - currentPlayer.y;
            distance = Math.hypot(targetDx, targetDy);
        }
        if (distance <= waypointReach) {
            roomBehaviorTravelRef.current = null;
            setWorldPlayerBubble(travel.playerId, travel.action);
            setNotice(`已到达 ${travel.label}，当前状态：${travel.action}。`);
            updateRoomPlayer(travel.playerId, (current) => ({
                ...current,
                x: waypoint.x,
                y: waypoint.y,
                direction: travel.place?.facing || current.direction,
                moving: false,
                frame: 0,
                stepTime: 0,
            }));
            return;
        }
        const normalizedX = targetDx / distance;
        const normalizedY = targetDy / distance;
        const direction = getRoomEditorDirectionFromDelta(normalizedX, normalizedY, currentPlayer.direction);
        const travelSpeed = travel.behaviorRuntimeId ? commercialV2BehaviorPlayerSpeed : roomEditorPlayerMoveSpeed;
        const frameRate = travel.behaviorRuntimeId ? 6 : 8;
        const stepDistance = Math.min(travelSpeed * delta, distance);
        const desiredPoint = clampRoomEditorPlayer({
            ...currentPlayer,
            x: currentPlayer.x + normalizedX * stepDistance,
            y: currentPlayer.y + normalizedY * stepDistance,
        });
        const nextPoint = resolveRoomPlayerMovement(currentPlayer, desiredPoint);
        const moved = Math.hypot(nextPoint.x - currentPlayer.x, nextPoint.y - currentPlayer.y) > 0.25;
        const stepTime = currentPlayer.stepTime + delta;
        if (!moved) {
            travel.stuckTime = (travel.stuckTime || 0) + delta;
            const rerouteTarget = travel.anchorPoint || travel.point || waypoint;
            const reroute =
                travel.stuckTime > 0.2 && (travel.replanCount || 0) < 4
                    ? buildBehaviorSmoothTravelPath(currentPlayer, rerouteTarget)
                    : [];
            const usefulReroute = reroute.filter(
                (point) => Math.hypot(point.x - currentPlayer.x, point.y - currentPlayer.y) > waypointReach,
            );
            if (usefulReroute.length) {
                travel.path = usefulReroute;
                travel.point = usefulReroute[usefulReroute.length - 1] || travel.point;
                travel.pathIndex = 0;
                travel.stuckTime = 0;
                travel.replanCount = (travel.replanCount || 0) + 1;
                setWorldPlayerBubble(travel.playerId, '换条路');
                setNotice(`去 ${travel.label || '目标'} 的路被挡住了，正在绕开家具。`);
                return;
            }
            if (travel.stuckTime <= 0.8) {
                updateRoomPlayer(travel.playerId, {
                    moving: false,
                    frame: 0,
                    stepTime: 0,
                });
                return;
            }
            roomBehaviorTravelRef.current = null;
            if (
                travel.behaviorRuntimeId &&
                activateBehaviorTravelFailureBranch({
                    reason: 'travel_blocked',
                    action: travel.action,
                    targetLabel: travel.label,
                })
            )
                return;
            setWorldPlayerBubble(travel.playerId, '绕不开');
            setNotice(`去 ${travel.label || '目标'} 的路被家具碰撞箱挡住了，先停在附近。`);
            updateRoomPlayer(travel.playerId, {
                moving: false,
                frame: 0,
                stepTime: 0,
            });
            return;
        }
        travel.stuckTime = 0;
        updateRoomPlayer(travel.playerId, {
            x: nextPoint.x,
            y: nextPoint.y,
            direction,
            moving: true,
            stepTime,
            frame: Math.floor(stepTime * frameRate) % commercialV2PlayerFrameOrder.length,
        });
    }

    function faceRoomPlayers() {
        commitPlayers((prev) => {
            const roleCharacter =
                commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
            const userCharacter =
                commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0];
            const currentRole = prev[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
            const currentUser = prev[commercialV2UserActorId] || createRoomEditorPlayerState(userCharacter);
            return {
                ...prev,
                [commercialV2RoleActorId]: normalizeRoomEditorPlayerState(
                    {
                        ...currentRole,
                        direction: getRoomEditorDirectionFromDelta(
                            currentUser.x - currentRole.x,
                            currentUser.y - currentRole.y,
                            currentRole.direction,
                        ),
                        moving: false,
                        frame: 0,
                        stepTime: 0,
                        bubble: '我看着你。',
                    },
                    roleCharacter,
                ),
                [commercialV2UserActorId]: normalizeRoomEditorPlayerState(
                    {
                        ...currentUser,
                        direction: getRoomEditorDirectionFromDelta(
                            currentRole.x - currentUser.x,
                            currentRole.y - currentUser.y,
                            currentUser.direction,
                        ),
                        moving: false,
                        frame: 0,
                        stepTime: 0,
                    },
                    userCharacter,
                ),
            };
        });
        setBehaviorStatus('已执行房间行为：两位小人面对彼此。');
    }

    function approachRoomPlayer() {
        commitPlayers((prev) => {
            const roleCharacter =
                commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
            const userCharacter =
                commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0];
            const currentRole = prev[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
            const currentUser = prev[commercialV2UserActorId] || createRoomEditorPlayerState(userCharacter);
            const side =
                currentUser.x > stageSize.width / 2 ? -commercialV2PlayerApproachGap : commercialV2PlayerApproachGap;
            const safePoint = findSafeRoomPlayerPointNear(
                clampRoomEditorPlayer({
                    ...currentRole,
                    x: currentUser.x + side,
                    y: currentUser.y,
                }),
                currentRole,
            );
            const nextRole = clampRoomEditorPlayer({
                ...currentRole,
                ...safePoint,
                direction: side < 0 ? 'right' : 'left',
                moving: false,
                frame: 0,
                stepTime: 0,
                bubble: '我过来了。',
            });
            return {
                ...prev,
                [commercialV2RoleActorId]: normalizeRoomEditorPlayerState(nextRole, roleCharacter),
                [commercialV2UserActorId]: normalizeRoomEditorPlayerState(
                    {
                        ...currentUser,
                        direction: getRoomEditorDirectionFromDelta(
                            nextRole.x - currentUser.x,
                            nextRole.y - currentUser.y,
                            currentUser.direction,
                        ),
                        moving: false,
                        frame: 0,
                        stepTime: 0,
                    },
                    userCharacter,
                ),
            };
        });
        setBehaviorStatus('已执行房间行为：角色靠近玩家，距离进入互动阈值。');
    }

    function wanderRoomPlayer() {
        const point = roomEditorBehaviorSafePoints[roomBehaviorStepRef.current % roomEditorBehaviorSafePoints.length];
        roomBehaviorStepRef.current += 1;
        const roleCharacter =
            commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
        const currentRole = playersRef.current[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
        const safePoint = findSafeRoomPlayerPointNear(point, currentRole);
        updateRoomPlayer(commercialV2RoleActorId, {
            x: safePoint.x,
            y: safePoint.y,
            direction: point.direction,
            moving: false,
            frame: 0,
            stepTime: 0,
            bubble: `走到${point.label}`,
        });
        setBehaviorStatus(`已执行房间行为：角色移动到${point.label}。`);
    }

    function clearRoomPlayerBubbles() {
        commitPlayers((prev) =>
            Object.fromEntries(
                commercialV2PlayerCharacters.map((character) => {
                    const current = prev[character.id] || createRoomEditorPlayerState(character);
                    return [character.id, normalizeRoomEditorPlayerState({ ...current, bubble: '' }, character)];
                }),
            ),
        );
        setBehaviorStatus('已清空房间小人的动作气泡。');
    }

    function resetRoomPlayers() {
        const nextPlayers = Object.fromEntries(
            commercialV2PlayerCharacters.map((character) => {
                const initial = createRoomEditorPlayerState(character);
                const safePoint = findSafeRoomPlayerPointNear(initial, initial);
                return [character.id, normalizeRoomEditorPlayerState({ ...initial, ...safePoint }, character)];
            }),
        );
        playersRef.current = nextPlayers;
        controlledPlayerIdRef.current = commercialV2DefaultControlledPlayerId;
        playerScaleRef.current = roomEditorDefaultPlayerScale;
        queuePlayersRender(nextPlayers, { immediate: true });
        setControlledPlayerIdState(commercialV2DefaultControlledPlayerId);
        setPlayerScaleState(roomEditorDefaultPlayerScale);
        setBehaviorStatus('两位小人已回到房间默认站位。');
    }
    const stepRoomBehaviorTravelEvent = useEventCallback(stepRoomBehaviorTravel);
    const faceRoomPlayersEvent = useEventCallback(faceRoomPlayers);
    const approachRoomPlayerEvent = useEventCallback(approachRoomPlayer);
    const wanderRoomPlayerEvent = useEventCallback(wanderRoomPlayer);
    const clearRoomPlayerBubblesEvent = useEventCallback(clearRoomPlayerBubbles);
    const resetRoomPlayersEvent = useEventCallback(resetRoomPlayers);
    useEffect(() => {
        const pressedKeys = new Set();
        let animationFrame = 0;
        let lastTime = performance.now();
        const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
        const isTypingTarget = (target) => {
            const tag = String(target?.tagName || '').toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
        };
        const tick = (time) => {
            const deltaSeconds = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
            lastTime = time;
            advanceBehaviorRuntime();
            stepRoomBehaviorTravelEvent(deltaSeconds);
            const playerId = controlledPlayerIdRef.current;
            const character = commercialV2PlayerCharacterById.get(playerId);
            if (character) {
                const current = playersRef.current[playerId] || createRoomEditorPlayerState(character);
                let dx = 0;
                let dy = 0;
                if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) dx -= 1;
                if (pressedKeys.has('d') || pressedKeys.has('arrowright')) dx += 1;
                if (pressedKeys.has('w') || pressedKeys.has('arrowup')) dy -= 1;
                if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) dy += 1;
                if (dx || dy) {
                    const length = Math.hypot(dx, dy) || 1;
                    const step = roomEditorPlayerMoveSpeed * deltaSeconds;
                    const nextStepTime = (Number(current.stepTime) || 0) + deltaSeconds;
                    const nextPoint = resolveRoomPlayerMovement(current, {
                        x: current.x + (dx / length) * step,
                        y: current.y + (dy / length) * step,
                    });
                    const moved = Math.hypot(nextPoint.x - current.x, nextPoint.y - current.y) > 0.25;
                    updateRoomPlayer(playerId, {
                        x: nextPoint.x,
                        y: nextPoint.y,
                        direction: getRoomEditorDirectionFromDelta(dx, dy, current.direction),
                        moving: moved,
                        stepTime: moved ? nextStepTime : 0,
                        frame: moved ? Math.floor(nextStepTime * 8) % commercialV2PlayerFrameOrder.length : 0,
                    });
                } else if (current.moving) {
                    updateRoomPlayer(playerId, {
                        moving: false,
                        frame: 0,
                        stepTime: 0,
                    });
                }
            }
            animationFrame = requestAnimationFrame(tick);
        };
        const onKeyDown = (event) => {
            const key = String(event.key || '').toLowerCase();
            if (!movementKeys.has(key) || isTypingTarget(event.target)) return;
            if (roomBehaviorTravelRef.current?.playerId === controlledPlayerIdRef.current) {
                roomBehaviorTravelRef.current = null;
            }
            pressedKeys.add(key);
            event.preventDefault();
        };
        const onKeyUp = (event) => {
            pressedKeys.delete(String(event.key || '').toLowerCase());
        };
        const stopKeyboard = subscribeSceneKeyboard({
            canvas: canvasWrapRef.current,
            enabled: isActive,
            keys: pressedKeys,
            onKeyDown,
            onKeyUp,
        });
        animationFrame = requestAnimationFrame(tick);
        return () => {
            stopKeyboard();
            cancelAnimationFrame(animationFrame);
        };
    }, [
        resolveRoomPlayerMovement,
        updateRoomPlayer,
        stepRoomBehaviorTravelEvent,
        isActive,
        canvasWrapRef,
        advanceBehaviorRuntime,
        controlledPlayerIdRef,
        playersRef,
    ]);
    return {
        stepRoomBehaviorTravel: stepRoomBehaviorTravelEvent,
        faceRoomPlayers: faceRoomPlayersEvent,
        approachRoomPlayer: approachRoomPlayerEvent,
        wanderRoomPlayer: wanderRoomPlayerEvent,
        clearRoomPlayerBubbles: clearRoomPlayerBubblesEvent,
        resetRoomPlayers: resetRoomPlayersEvent,
        roomBehaviorTravelRef,
    };
}
