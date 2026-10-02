import {
    createCommercialV2PlayerState,
    commercialV2PlayerCharacters,
    commercialV2PlayerCharacterById,
    getCommercialV2LoopDeltaX,
    wrapLoopCoordinate,
    commercialV2PathWaypointReach,
    commercialV2BehaviorPlayerSpeed,
    commercialV2PlayerSpeed,
    commercialV2PlayerFrameOrder,
} from '.././commercialStreetCore.js';
// A single motion frame. Scheduling and disposal belong to useStreetMotion.
export function createStreetMotionStepper({
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
}) {
    const stepConcurrentAutoTravel = (delta) => {
        const travel = autoTravelRef.current;
        if (!travel?.playerId || travel.playerId === controlledPlayerIdRef.current) return;
        const travelPlayerId = travel.playerId;
        const travelCharacter = commercialV2PlayerCharacterById.get(travelPlayerId) || commercialV2PlayerCharacters[0];
        const currentPlayer = playersRef.current[travelPlayerId] || createCommercialV2PlayerState(travelCharacter);
        const path = travel.path?.length ? travel.path : [travel.point];
        let waypointIndex = Math.min(travel.pathIndex || 0, path.length - 1);
        let waypoint = path[waypointIndex] || travel.point;
        let targetDx = getCommercialV2LoopDeltaX(currentPlayer.x, waypoint.x, stageSize.width);
        let targetDy = waypoint.y - currentPlayer.y;
        let distance = Math.hypot(targetDx, targetDy);
        const waypointReach = travel.behaviorRuntimeId
            ? Math.max(5, commercialV2PathWaypointReach * 0.65)
            : commercialV2PathWaypointReach;
        while (distance <= waypointReach && waypointIndex < path.length - 1) {
            waypointIndex += 1;
            travel.pathIndex = waypointIndex;
            waypoint = path[waypointIndex] || travel.point;
            targetDx = getCommercialV2LoopDeltaX(currentPlayer.x, waypoint.x, stageSize.width);
            targetDy = waypoint.y - currentPlayer.y;
            distance = Math.hypot(targetDx, targetDy);
        }
        if (distance <= waypointReach) {
            autoTravelRef.current = null;
            setAutoTravelActive(false);
            setWorldPlayerBubble(travelPlayerId, travel.action);
            setNotice(`已到达 ${travel.label}，当前状态：${travel.action}。`);
            setPlayerById(travelPlayerId, (current) => ({
                ...current,
                x: wrapLoopCoordinate(waypoint.x, stageSize.width),
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
        const direction =
            Math.abs(normalizedX) > Math.abs(normalizedY)
                ? normalizedX > 0
                    ? 'right'
                    : 'left'
                : normalizedY > 0
                  ? 'front'
                  : 'back';
        const travelSpeed = travel.behaviorRuntimeId ? commercialV2BehaviorPlayerSpeed : commercialV2PlayerSpeed;
        const frameRate = travel.behaviorRuntimeId ? 6 : 8;
        const stepDistance = Math.min(travelSpeed * delta, distance);
        const rawNextPoint = {
            x: wrapLoopCoordinate(currentPlayer.x + normalizedX * stepDistance, stageSize.width),
            y: currentPlayer.y + normalizedY * stepDistance,
        };
        const groundedPoint = travel.semanticSlide
            ? rawNextPoint
            : resolvePlayerGroundMove(currentPlayer, rawNextPoint.x, rawNextPoint.y, { useAutoTravelBlocks: true });
        const stepTime = currentPlayer.stepTime + delta;
        setPlayerById(travelPlayerId, {
            x: groundedPoint.x,
            y: groundedPoint.y,
            direction,
            moving: true,
            stepTime,
            frame: Math.floor(stepTime * frameRate) % commercialV2PlayerFrameOrder.length,
        });
    };
    const step = (delta, manualDelta = delta) => {
        advanceBehaviorRuntime();
        const keys = pressedKeysRef.current;
        let dx = 0;
        let dy = 0;
        if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
        if (keys.has('d') || keys.has('arrowright')) dx += 1;
        if (keys.has('w') || keys.has('arrowup')) dy -= 1;
        if (keys.has('s') || keys.has('arrowdown')) dy += 1;
        const moving = dx !== 0 || dy !== 0;
        if (moving) stepConcurrentAutoTravel(delta);
        if (!moving) {
            const travel = autoTravelRef.current;
            if (travel) {
                const travelPlayerId = travel.playerId || controlledPlayerIdRef.current;
                const travelCharacter =
                    commercialV2PlayerCharacterById.get(travelPlayerId) || commercialV2PlayerCharacters[0];
                const currentPlayer =
                    playersRef.current[travelPlayerId] || createCommercialV2PlayerState(travelCharacter);
                const path = travel.path?.length ? travel.path : [travel.point];
                let waypointIndex = Math.min(travel.pathIndex || 0, path.length - 1);
                let waypoint = path[waypointIndex] || travel.point;
                let targetDx = getCommercialV2LoopDeltaX(currentPlayer.x, waypoint.x, stageSize.width);
                let targetDy = waypoint.y - currentPlayer.y;
                let distance = Math.hypot(targetDx, targetDy);
                const waypointReach = travel.behaviorRuntimeId
                    ? Math.max(5, commercialV2PathWaypointReach * 0.65)
                    : commercialV2PathWaypointReach;
                while (distance <= waypointReach && waypointIndex < path.length - 1) {
                    waypointIndex += 1;
                    travel.pathIndex = waypointIndex;
                    waypoint = path[waypointIndex] || travel.point;
                    targetDx = getCommercialV2LoopDeltaX(currentPlayer.x, waypoint.x, stageSize.width);
                    targetDy = waypoint.y - currentPlayer.y;
                    distance = Math.hypot(targetDx, targetDy);
                }
                if (distance <= waypointReach) {
                    if (travel.mode === 'streetCruise') {
                        const arrivedPoint = {
                            x: wrapLoopCoordinate(waypoint.x, stageSize.width),
                            y: waypoint.y,
                        };
                        const nextCruise = buildStreetCruiseSegment(arrivedPoint);
                        if (nextCruise?.waypoints?.length) {
                            autoTravelRef.current = {
                                ...travel,
                                point: nextCruise.destination,
                                anchorPoint: nextCruise.anchorPoint,
                                path: nextCruise.waypoints,
                                score: nextCruise.totalDistance,
                                pathIndex: 0,
                                stuckTime: 0,
                                replanCount: 0,
                                lastX: arrivedPoint.x,
                                lastY: arrivedPoint.y,
                            };
                            setWorldPlayerBubble(travelPlayerId, `逛 ${travel.label}`);
                            setPlayerById(travelPlayerId, (current) => ({
                                ...current,
                                ...arrivedPoint,
                                direction: 'right',
                                moving: true,
                            }));

                            return;
                        }
                        autoTravelRef.current = null;
                        setAutoTravelActive(false);
                        setWorldPlayerBubble(travelPlayerId, '');
                        setNotice(`${travel.label} 前方没有可继续行走的路，已先停下。`);
                        setPlayerById(travelPlayerId, (current) => ({
                            ...current,
                            ...arrivedPoint,
                            direction: 'right',
                            moving: false,
                            frame: 0,
                            stepTime: 0,
                        }));

                        return;
                    }
                    autoTravelRef.current = null;
                    setAutoTravelActive(false);
                    setWorldPlayerBubble(travelPlayerId, travel.action);
                    setNotice(`已到达 ${travel.label}，当前状态：${travel.action}。`);
                    setPlayerById(travelPlayerId, (current) => ({
                        ...current,
                        x: wrapLoopCoordinate(waypoint.x, stageSize.width),
                        y: waypoint.y,
                        direction: travel.place.facing || current.direction,
                        moving: false,
                        frame: 0,
                        stepTime: 0,
                    }));

                    return;
                }
                const normalizedX = targetDx / distance;
                const normalizedY = targetDy / distance;
                const direction =
                    Math.abs(normalizedX) > Math.abs(normalizedY)
                        ? normalizedX > 0
                            ? 'right'
                            : 'left'
                        : normalizedY > 0
                          ? 'front'
                          : 'back';
                const travelDelta = delta;
                const travelSpeed = travel.behaviorRuntimeId
                    ? commercialV2BehaviorPlayerSpeed
                    : commercialV2PlayerSpeed;
                const frameRate = travel.behaviorRuntimeId ? 6 : 8;
                const stepDistance = Math.min(travelSpeed * travelDelta, distance);
                const rawNextPoint = {
                    x: wrapLoopCoordinate(currentPlayer.x + normalizedX * stepDistance, stageSize.width),
                    y: currentPlayer.y + normalizedY * stepDistance,
                };
                const groundedPoint = travel.semanticSlide
                    ? rawNextPoint
                    : resolvePlayerGroundMove(currentPlayer, rawNextPoint.x, rawNextPoint.y, {
                          useAutoTravelBlocks: true,
                      });
                const movedDistance = Math.hypot(
                    getCommercialV2LoopDeltaX(currentPlayer.x, groundedPoint.x, stageSize.width),
                    currentPlayer.y - groundedPoint.y,
                );
                const nextDistance = Math.hypot(
                    getCommercialV2LoopDeltaX(groundedPoint.x, waypoint.x, stageSize.width),
                    waypoint.y - groundedPoint.y,
                );
                travel.stuckTime =
                    !travel.semanticSlide && movedDistance < 0.25 && nextDistance > 10
                        ? (travel.stuckTime || 0) + delta
                        : 0;
                if (!travel.semanticSlide && travel.stuckTime > 1.2) {
                    const reroute =
                        (travel.replanCount || 0) < 2
                            ? travel.mode === 'streetCruise'
                                ? buildStreetCruiseSegment(groundedPoint)
                                : buildAutoTravelPath(groundedPoint, travel.anchorPoint || travel.point)
                            : null;
                    if (reroute?.waypoints?.length) {
                        travel.path = reroute.waypoints;
                        travel.point = reroute.destination;
                        if (reroute.anchorPoint) travel.anchorPoint = reroute.anchorPoint;
                        travel.pathIndex = 0;
                        travel.stuckTime = 0;
                        travel.replanCount = (travel.replanCount || 0) + 1;
                        setNotice(
                            travel.mode === 'streetCruise'
                                ? `${travel.label} 前方被挡住了，正在换一条路继续往前走。`
                                : `去 ${travel.label} 的路被挡住了，正在重新绕路。`,
                        );

                        return;
                    }
                    autoTravelRef.current = null;
                    setAutoTravelActive(false);
                    if (
                        travel.behaviorRuntimeId &&
                        activateBehaviorTravelFailureBranchEvent({
                            reason: 'travel_blocked',
                            action: travel.action,
                            targetLabel: travel.label,
                        })
                    ) {
                        return;
                    }
                    setWorldPlayerBubble(travelPlayerId, '');
                    setNotice(
                        travel.mode === 'streetCruise'
                            ? `${travel.label} 前方被碰撞挡住了，先停在附近。`
                            : `去 ${travel.label} 的路被碰撞挡住了，先停在附近。`,
                    );
                    setPlayerById(travelPlayerId, (current) => ({
                        ...current,
                        moving: false,
                        frame: 0,
                        stepTime: 0,
                    }));

                    return;
                }
                const stepTime = currentPlayer.stepTime + travelDelta;
                setPlayerById(travelPlayerId, {
                    x: groundedPoint.x,
                    y: groundedPoint.y,
                    direction,
                    moving: true,
                    stepTime,
                    frame: Math.floor(stepTime * frameRate) % commercialV2PlayerFrameOrder.length,
                });

                return;
            }
            if (playerRef.current.moving || playerRef.current.frame !== 0) {
                setPlayer((current) => ({ ...current, moving: false, frame: 0, stepTime: 0 }));
            }

            return;
        }

        const length = Math.hypot(dx, dy) || 1;
        const normalizedX = dx / length;
        const normalizedY = dy / length;
        const direction =
            Math.abs(normalizedX) > Math.abs(normalizedY)
                ? normalizedX > 0
                    ? 'right'
                    : 'left'
                : normalizedY > 0
                  ? 'front'
                  : 'back';

        setPlayer((current) => {
            const stepTime = current.stepTime + manualDelta;
            let groundedPoint = { x: current.x, y: current.y };
            let remaining = manualDelta;
            while (remaining > 0) {
                const slice = Math.min(0.05, remaining);
                groundedPoint = resolvePlayerGroundMove(
                    { ...current, ...groundedPoint },
                    groundedPoint.x + normalizedX * commercialV2PlayerSpeed * slice,
                    groundedPoint.y + normalizedY * commercialV2PlayerSpeed * slice,
                );
                remaining -= slice;
            }
            return {
                x: groundedPoint.x,
                y: groundedPoint.y,
                direction,
                moving: true,
                stepTime,
                frame: Math.floor(stepTime * 8) % commercialV2PlayerFrameOrder.length,
            };
        });
    };
    return step;
}
