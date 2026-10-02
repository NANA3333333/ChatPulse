import { createStreetMotionStepper } from './createStreetMotionStepper.js';
import { subscribeSceneKeyboard } from '../sceneKeyboard.js';
import { useCallback, useRef, useEffect } from 'react';
import {
    commercialV2DefaultControlledPlayerId,
    commercialV2RoleActorId,
    createCommercialV2PlayerState,
    commercialV2PlayerCharacters,
    commercialV2PlayerCharacterById,
    commercialV2UserActorId,
    getCommercialV2LoopDeltaX,
    wrapLoopCoordinate,
    commercialV2PlayerApproachGap,
    commercialV2MovementKeys,
} from '../commercialStreetCore.js';
import { useEventCallback } from '../../../../shared/hooks/useEventCallback.js';

// Street movement, player switching, auto travel and frame/keyboard lifecycle.
export function useStreetMotion({
    isActive,
    canvasWrapRef,
    playersRef,
    controlledPlayerIdRef,
    playerRef,
    playerSpawnedRef,
    advanceBehaviorRuntime,
    autoTargetId,
    setAutoTargetId,
    setAutoTravelActive,
    setNotice,
    setControlledPlayerId,
    setPlayers,
    setPlayerActionBubble,
    setPlayerActionBubbles,
    setBehaviorActorId,
    stageSize,
    activateBehaviorTravelFailureBranchEvent,
    setPlayerById,
    setPlayer,
    setWorldPlayerBubble,
    isPlayerPositionAllowed,
    buildAutoTravelPath,
    buildSafePlayerStates,
    getNearestWalkablePlayerPoint,
    buildStreetCruiseSegment,
    resolveAutoTravelTarget,
    resolvePlayerGroundMove,
}) {
    const pressedKeysRef = useRef(new Set());

    const autoTravelRef = useRef(null);

    const spawnPlayersOnStage = useCallback(
        (basePlayers = playersRef.current) => {
            const nextPlayers = buildSafePlayerStates(basePlayers);
            playerSpawnedRef.current = true;
            playersRef.current = nextPlayers;
            playerRef.current =
                nextPlayers[controlledPlayerIdRef.current] || nextPlayers[commercialV2DefaultControlledPlayerId];
            setPlayers(nextPlayers);
        },
        [buildSafePlayerStates, controlledPlayerIdRef, playerRef, playerSpawnedRef, playersRef, setPlayers],
    );

    function addRoleCharacter() {
        const roleCharacter = commercialV2PlayerCharacterById.get(commercialV2RoleActorId);
        const userCharacter = commercialV2PlayerCharacterById.get(commercialV2UserActorId);
        if (!roleCharacter || !userCharacter) return;
        cancelAutoTravel();
        const currentPlayers = playersRef.current;
        const userPlayer = currentPlayers[commercialV2UserActorId] || createCommercialV2PlayerState(userCharacter);
        const rolePlayer = currentPlayers[commercialV2RoleActorId] || createCommercialV2PlayerState(roleCharacter);
        const spawnX = wrapLoopCoordinate(userPlayer.x + commercialV2PlayerApproachGap, stageSize.width);
        const spawnPoint = getNearestWalkablePlayerPoint(spawnX, userPlayer.y, rolePlayer, {
            fallbackToCurrent: false,
            ignorePlayerId: commercialV2RoleActorId,
        });
        const faceUserDelta = getCommercialV2LoopDeltaX(spawnPoint.x, userPlayer.x, stageSize.width);
        const nextRole = {
            ...rolePlayer,
            ...spawnPoint,
            id: commercialV2RoleActorId,
            characterId: commercialV2RoleActorId,
            direction: faceUserDelta >= 0 ? 'right' : 'left',
            moving: false,
            frame: 0,
            stepTime: 0,
        };
        const nextPlayers = {
            ...currentPlayers,
            [commercialV2RoleActorId]: nextRole,
        };
        playersRef.current = nextPlayers;
        controlledPlayerIdRef.current = commercialV2RoleActorId;
        playerRef.current = nextRole;
        setPlayers(nextPlayers);
        setControlledPlayerId(commercialV2RoleActorId);
        setWorldPlayerBubble(commercialV2RoleActorId, roleCharacter.label || '角色');
        setNotice(`已新增角色：角色小人现在绑定 ${roleCharacter.label || '男孩'}，并生成在玩家旁边。`);
    }

    const cancelAutoTravel = useCallback(
        (message = '') => {
            const travelPlayerId = autoTravelRef.current?.playerId || controlledPlayerIdRef.current;
            autoTravelRef.current = null;
            setAutoTravelActive(false);
            setPlayerActionBubble('');
            setPlayerActionBubbles((current) => {
                if (!current[travelPlayerId]) return current;
                const next = { ...current };
                delete next[travelPlayerId];
                return next;
            });
            if (message) setNotice(message);
        },
        [controlledPlayerIdRef, setAutoTravelActive, setNotice, setPlayerActionBubble, setPlayerActionBubbles],
    );

    const switchControlledPlayer = useCallback(
        (nextPlayerId) => {
            const character = commercialV2PlayerCharacterById.get(nextPlayerId);
            if (!character || nextPlayerId === controlledPlayerIdRef.current) return;
            pressedKeysRef.current.clear();
            cancelAutoTravel();
            controlledPlayerIdRef.current = nextPlayerId;
            playerRef.current = playersRef.current[nextPlayerId] || createCommercialV2PlayerState(character);
            setControlledPlayerId(nextPlayerId);
            setBehaviorActorId(nextPlayerId);
            setNotice(`现在控制：${character.label}。WASD 会移动当前选中的人物。`);
        },
        [
            cancelAutoTravel,
            controlledPlayerIdRef,
            playerRef,
            playersRef,
            setBehaviorActorId,
            setControlledPlayerId,
            setNotice,
        ],
    );

    const startAutoTravel = useCallback(
        (targetId = autoTargetId) => {
            const playerId = controlledPlayerIdRef.current;
            const target = resolveAutoTravelTarget(targetId, playerRef.current);
            if (!target) {
                setNotice('这个地点现在没有可用锚点或绕行路线，先检查地点锚点和碰撞箱。');
                return;
            }
            pressedKeysRef.current.clear();
            autoTravelRef.current = {
                ...target,
                playerId,
                pathIndex: 0,
                stuckTime: 0,
                lastX: playerRef.current.x,
                lastY: playerRef.current.y,
            };
            setAutoTargetId(target.targetId);
            setAutoTravelActive(true);
            if (target.mode === 'streetCruise') {
                setPlayerActionBubble(`逛 ${target.label}`);
                setNotice(`沿 ${target.label} 往前走，已规划 ${target.path.length} 个绕行点。`);
                return;
            }
            setPlayerActionBubble(`去 ${target.label}`);
            setNotice(`自动前往 ${target.label}，已规划 ${target.path.length} 个绕行点。`);
        },
        [
            autoTargetId,
            controlledPlayerIdRef,
            playerRef,
            resolveAutoTravelTarget,
            setAutoTargetId,
            setAutoTravelActive,
            setNotice,
            setPlayerActionBubble,
        ],
    );

    const stepMotion = useEventCallback(
        createStreetMotionStepper({
            playersRef,
            controlledPlayerIdRef,
            playerRef,
            advanceBehaviorRuntime,
            setAutoTravelActive,
            setNotice,
            stageSize,
            activateBehaviorTravelFailureBranchEvent,
            setPlayerById,
            setPlayer,
            setWorldPlayerBubble,
            buildAutoTravelPath,
            buildStreetCruiseSegment,
            resolvePlayerGroundMove,
            pressedKeysRef,
            autoTravelRef,
        }),
    );

    const spawnPlayersOnStageEvent = useEventCallback(spawnPlayersOnStage);
    const addRoleCharacterEvent = useEventCallback(addRoleCharacter);
    const cancelAutoTravelEvent = useEventCallback(cancelAutoTravel);
    const switchControlledPlayerEvent = useEventCallback(switchControlledPlayer);
    const startAutoTravelEvent = useEventCallback(startAutoTravel);
    useEffect(() => {
        if (playerSpawnedRef.current) return;
        spawnPlayersOnStage(playersRef.current);
    }, [playerSpawnedRef, playersRef, spawnPlayersOnStage]);

    useEffect(() => {
        setPlayers((currentPlayers) => {
            let changed = false;
            const nextPlayers = {};
            commercialV2PlayerCharacters.forEach((character) => {
                const current = currentPlayers[character.id] || createCommercialV2PlayerState(character);
                if (isPlayerPositionAllowed(current.x, current.y)) {
                    nextPlayers[character.id] = current;
                    return;
                }
                const groundedPoint = getNearestWalkablePlayerPoint(current.x, current.y, current);
                nextPlayers[character.id] = {
                    ...current,
                    ...groundedPoint,
                    moving: false,
                    frame: 0,
                    stepTime: 0,
                };
                changed = true;
            });
            return changed ? nextPlayers : currentPlayers;
        });
    }, [getNearestWalkablePlayerPoint, isPlayerPositionAllowed, setPlayers]);

    useEffect(() => {
        const pressedKeys = pressedKeysRef.current;
        const isTypingTarget = (target) => {
            const tagName = target?.tagName?.toLowerCase();
            return target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
        };
        const getKeyVector = (key) => {
            if (key === 'a' || key === 'arrowleft') return { dx: -1, dy: 0 };
            if (key === 'd' || key === 'arrowright') return { dx: 1, dy: 0 };
            if (key === 'w' || key === 'arrowup') return { dx: 0, dy: -1 };
            if (key === 's' || key === 'arrowdown') return { dx: 0, dy: 1 };
            return null;
        };
        const getDirection = (dx, dy) =>
            Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back';
        const nudgePlayer = (dx, dy) => {
            const direction = getDirection(dx, dy);
            setPlayer((current) => ({
                ...current,
                ...resolvePlayerGroundMove(current, current.x + dx * 12, current.y + dy * 12),
                direction,
                moving: true,
                frame: 1,
                stepTime: current.stepTime + 0.14,
            }));
        };
        const onKeyDown = (event) => {
            const key = event.key.toLowerCase();
            if (!commercialV2MovementKeys.has(key) || isTypingTarget(event.target)) return;
            if (!autoTravelRef.current?.playerId || autoTravelRef.current.playerId === controlledPlayerIdRef.current) {
                cancelAutoTravel('已切回手动控制。');
            }
            const wasPressed = pressedKeys.has(key);
            pressedKeys.add(key);
            const vector = getKeyVector(key);
            if (!wasPressed && vector) nudgePlayer(vector.dx, vector.dy);
            event.preventDefault();
        };
        const onKeyUp = (event) => {
            const key = event.key.toLowerCase();
            if (!commercialV2MovementKeys.has(key)) return;
            pressedKeys.delete(key);
            event.preventDefault();
        };
        return subscribeSceneKeyboard({
            canvas: canvasWrapRef.current,
            enabled: isActive,
            keys: pressedKeys,
            onKeyDown,
            onKeyUp,
        });
    }, [cancelAutoTravel, resolvePlayerGroundMove, setPlayer, isActive, canvasWrapRef, controlledPlayerIdRef]);

    useEffect(() => {
        let frameId;
        let previousTime = performance.now();
        const tick = (time) => {
            const elapsed = Math.max(0, (time - previousTime) / 1000);
            const delta = Math.min(0.05, elapsed);
            const manualDelta = Math.min(0.12, elapsed);
            previousTime = time;
            stepMotion(delta, manualDelta);
            frameId = requestAnimationFrame(tick);
        };
        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [stepMotion]);
    return {
        spawnPlayersOnStage: spawnPlayersOnStageEvent,
        addRoleCharacter: addRoleCharacterEvent,
        cancelAutoTravel: cancelAutoTravelEvent,
        switchControlledPlayer: switchControlledPlayerEvent,
        startAutoTravel: startAutoTravelEvent,
        autoTravelRef,
    };
}
