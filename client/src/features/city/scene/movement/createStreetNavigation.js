import { createStreetCollision } from './createStreetCollision.js';
import { createStreetPathfinder } from './createStreetPathfinder.js';
import {
    commercialV2PlayerInitial,
    wrapLoopCoordinate,
    createCommercialV2PlayerStates,
    commercialV2PlayerCharacters,
    createCommercialV2PlayerState,
    getCommercialV2LoopDeltaX,
    commercialV2RoleActorId,
    commercialV2UserActorId,
    getCommercialV2CollisionWorldBox,
    getCommercialV2PlaceApproachMinY,
    commercialV2StreetCruiseMinForward,
    commercialV2ForwardPathBacktrackLimit,
    commercialV2ForwardPathOvershootTolerance,
    commercialV2StreetCruiseCenterStep,
    commercialV2StreetCruiseDistances,
    commercialV2StreetCruiseLaneOffsets,
    commercialV2TravelLabelById,
    getCommercialV2TravelAction,
} from '../commercialStreetCore.js';

// Safe spawns, destination approach points and continuous street cruising.
export function createStreetNavigation({
    playerDimensions,
    stageSize,
    walkableRects,
    controlledPlayerIdRef,
    playersRef,
    collisionRects,
    autoRouteBlockRects,
    mainRoadRects,
    streetCruiseRoadRects,
    items,
    assetById,
    playerRef,
    placeLinks,
}) {
    const {
        isPlayerPositionAllowed,
        isAutoTravelPositionAllowed,
        isMainRoadPoint,
        isStreetCruiseRoadPoint,
        getStreetCruiseRoadPenalty,
    } = createStreetCollision({
        playerDimensions,
        stageSize,
        walkableRects,
        controlledPlayerIdRef,
        playersRef,
        collisionRects,
        autoRouteBlockRects,
        mainRoadRects,
        streetCruiseRoadRects,
    });
    const { getNearestMainRoadTravelPoint, getNearestStreetCruiseRoadTravelPoint, buildAutoTravelPath } =
        createStreetPathfinder({
            mainRoadRects,
            stageSize,
            isAutoTravelPositionAllowed,
            streetCruiseRoadRects,
            isMainRoadPoint,
            getStreetCruiseRoadPenalty,
        });

    const getSafePlayerSpawnPoint = (targetX = commercialV2PlayerInitial.x, targetY = commercialV2PlayerInitial.y) => {
        const targetPointX = wrapLoopCoordinate(targetX, stageSize.width);
        const candidates = [];
        const addCandidate = (x, y) => {
            candidates.push({
                x: wrapLoopCoordinate(x, stageSize.width),
                y,
            });
        };
        walkableRects.forEach((rect) => {
            const columns = Math.max(3, Math.min(24, Math.ceil(rect.w / 72)));
            const rows = Math.max(2, Math.min(5, Math.ceil(rect.h / 48)));
            for (let column = 0; column < columns; column += 1) {
                const x = rect.x + ((column + 0.5) / columns) * rect.w;
                for (let row = 0; row < rows; row += 1) {
                    const y = rect.y + ((row + 0.5) / rows) * rect.h;
                    addCandidate(x, y);
                }
            }
            addCandidate(rect.x + rect.w * 0.5, rect.y + rect.h * 0.55);
            addCandidate(rect.x + rect.w * 0.5, rect.y + rect.h * 0.72);
            addCandidate(rect.x + rect.w * 0.25, rect.y + rect.h * 0.65);
            addCandidate(rect.x + rect.w * 0.75, rect.y + rect.h * 0.65);
        });
        if (!candidates.length) {
            return {
                x: targetPointX,
                y: Math.max(178, Math.min(Math.max(179, stageSize.height - 12), targetY)),
            };
        }
        let best = null;
        candidates.forEach((candidate) => {
            if (!isPlayerPositionAllowed(candidate.x, candidate.y, { ignorePlayers: true })) return;
            const rawDx = Math.abs(candidate.x - targetPointX);
            const dx = Math.min(rawDx, Math.max(0, stageSize.width - rawDx));
            const distance = dx ** 2 + (candidate.y - targetY) ** 2;
            if (!best || distance < best.distance) {
                best = { ...candidate, distance };
            }
        });
        if (best) return { x: best.x, y: best.y };
        const largestRoad = walkableRects.reduce(
            (largest, rect) => (!largest || rect.w * rect.h > largest.w * largest.h ? rect : largest),
            null,
        );
        return {
            x: wrapLoopCoordinate((largestRoad?.x ?? targetPointX) + (largestRoad?.w ?? 0) / 2, stageSize.width),
            y: largestRoad ? largestRoad.y + largestRoad.h * 0.6 : targetY,
        };
    };

    const buildSafePlayerStates = (currentPlayers = createCommercialV2PlayerStates()) => {
        const occupiedPoints = [];
        const nextPlayers = {};
        commercialV2PlayerCharacters.forEach((character) => {
            const initial = createCommercialV2PlayerState(character);
            const current = currentPlayers[character.id] || initial;
            const targetOffsets = [0, 72, -72, 128, -128, 196, -196];
            let spawnPoint = null;
            for (const offset of targetOffsets) {
                const candidate = getSafePlayerSpawnPoint(initial.x + offset, initial.y);
                const overlapsExisting = occupiedPoints.some(
                    (point) =>
                        Math.hypot(
                            getCommercialV2LoopDeltaX(point.x, candidate.x, stageSize.width),
                            point.y - candidate.y,
                        ) < 48,
                );
                if (!overlapsExisting) {
                    spawnPoint = candidate;
                    break;
                }
            }
            spawnPoint = spawnPoint || getSafePlayerSpawnPoint(initial.x, initial.y);
            occupiedPoints.push(spawnPoint);
            nextPlayers[character.id] = {
                ...current,
                ...spawnPoint,
                direction: initial.direction,
                moving: false,
                frame: 0,
                stepTime: 0,
            };
        });
        const roleSpawn = nextPlayers[commercialV2RoleActorId];
        const userSpawn = nextPlayers[commercialV2UserActorId];
        if (roleSpawn && userSpawn && isPlayerPositionAllowed(roleSpawn.x, userSpawn.y, { ignorePlayers: true })) {
            roleSpawn.y = userSpawn.y;
        }
        return nextPlayers;
    };

    const getNearestWalkablePlayerPoint = (x, y, current = null, options = {}) => {
        const pointOptions = {
            ignorePlayerId: options.ignorePlayerId || current?.id || controlledPlayerIdRef.current,
            ignorePlayers: Boolean(options.ignorePlayers),
        };
        const pointAllowed = options.useAutoTravelBlocks
            ? (pointX, pointY) => isAutoTravelPositionAllowed(pointX, pointY, pointOptions)
            : (pointX, pointY) => isPlayerPositionAllowed(pointX, pointY, pointOptions);
        const approachMinY = Number.isFinite(options.approachMinY) ? Number(options.approachMinY) : null;
        const fallbackToCurrent = options.fallbackToCurrent !== false;
        const fallbackMinY = 178;
        const fallbackMaxY = Math.max(fallbackMinY + 1, stageSize.height - 12);
        const fallbackPoint = current || {
            x: wrapLoopCoordinate(x, stageSize.width),
            y: Math.max(fallbackMinY, Math.min(fallbackMaxY, y)),
        };
        if (!walkableRects.length) {
            return pointAllowed(fallbackPoint.x, fallbackPoint.y) ? fallbackPoint : current || fallbackPoint;
        }
        const pointX = wrapLoopCoordinate(x, stageSize.width);
        let best = null;
        let approachBest = null;
        const candidates = [];
        walkableRects.forEach((rect) => {
            [-stageSize.width, 0, stageSize.width].forEach((offset) => {
                const left = rect.x + offset;
                const right = left + rect.w;
                const top = rect.y;
                const bottom = rect.y + rect.h;
                const clampedX = Math.max(left, Math.min(right, pointX));
                const clampedY = Math.max(top, Math.min(bottom, y));
                candidates.push({ x: clampedX, y: clampedY });
                candidates.push({ x: clampedX - 12, y: clampedY });
                candidates.push({ x: clampedX + 12, y: clampedY });
                candidates.push({ x: clampedX, y: clampedY - 12 });
                candidates.push({ x: clampedX, y: clampedY + 12 });
                candidates.push({ x: clampedX, y: top + rect.h * 0.25 });
                candidates.push({ x: clampedX, y: top + rect.h * 0.5 });
                candidates.push({ x: clampedX, y: top + rect.h * 0.75 });
                candidates.push({ x: left, y: clampedY });
                candidates.push({ x: right, y: clampedY });
                candidates.push({ x: clampedX, y: top });
                candidates.push({ x: clampedX, y: bottom });
            });
        });
        candidates.forEach((candidate) => {
            const wrappedX = wrapLoopCoordinate(candidate.x, stageSize.width);
            if (!pointAllowed(wrappedX, candidate.y)) return;
            const distance = (candidate.x - pointX) ** 2 + (candidate.y - y) ** 2;
            if (approachMinY !== null && candidate.y >= approachMinY) {
                const approachDistance = distance + (candidate.y - approachMinY) ** 2 * 0.2;
                if (!approachBest || approachDistance < approachBest.distance) {
                    approachBest = { x: wrappedX, y: candidate.y, distance: approachDistance };
                }
            }
            if (!best || distance < best.distance) {
                best = { x: wrappedX, y: candidate.y, distance };
            }
        });
        if (approachBest) return { x: approachBest.x, y: approachBest.y };
        if (best) return { x: best.x, y: best.y };
        if (fallbackToCurrent && current && pointAllowed(current.x, current.y)) return current;
        return getSafePlayerSpawnPoint(pointX, Math.max(fallbackMinY, Math.min(fallbackMaxY, y)));
    };

    const getAutoTravelPropApproachPoint = (place, currentPlayer) => {
        const item = items.find((candidate) => candidate.id === place?.itemId);
        const asset = item ? assetById.get(item.assetId) : null;
        const collisionBox = item && asset ? getCommercialV2CollisionWorldBox(item, asset) : null;
        if (!place || !collisionBox) return null;
        const anchorX = wrapLoopCoordinate(place.anchor.x, stageSize.width);
        const anchorY = place.anchor.y;
        const footWidth = Math.max(12, playerDimensions.width * 0.28);
        const footHeight = Math.max(8, playerDimensions.footOffset * 0.75);
        const upperProbeHeight = Math.max(8, Math.min(26, playerDimensions.footOffset * 1.6));
        const northClearance = Math.max(18, footHeight / 2 + 2);
        const southClearance = Math.max(18, upperProbeHeight + footHeight / 2 + 2);
        const sideClearance = Math.max(18, footWidth / 2 + 2);
        const xSamples = [
            anchorX,
            collisionBox.x + collisionBox.w * 0.5,
            collisionBox.x + collisionBox.w * 0.25,
            collisionBox.x + collisionBox.w * 0.75,
        ];
        const ySamples = [
            anchorY,
            collisionBox.y + collisionBox.h * 0.5,
            collisionBox.y + collisionBox.h * 0.25,
            collisionBox.y + collisionBox.h * 0.75,
        ];
        const sideOrderByFacing = {
            front: ['north', 'west', 'east', 'south'],
            back: ['south', 'west', 'east', 'north'],
            left: ['east', 'north', 'south', 'west'],
            right: ['west', 'north', 'south', 'east'],
        };
        const sideOrder = sideOrderByFacing[place.facing] || sideOrderByFacing.back;
        const candidates = [];
        const getPointSide = (x, y) => {
            if (y <= collisionBox.y) return 'north';
            if (y >= collisionBox.y + collisionBox.h) return 'south';
            const dxLeft = Math.abs(getCommercialV2LoopDeltaX(x, collisionBox.x, stageSize.width));
            const dxRight = Math.abs(getCommercialV2LoopDeltaX(x, collisionBox.x + collisionBox.w, stageSize.width));
            return dxLeft <= dxRight ? 'west' : 'east';
        };
        const addCandidate = (x, y, side) => {
            candidates.push({
                x: wrapLoopCoordinate(x, stageSize.width),
                y,
                side,
            });
        };
        const anchorSide = getPointSide(anchorX, anchorY);
        if (place.manualAnchor || anchorSide === sideOrder[0]) {
            addCandidate(anchorX, anchorY, anchorSide);
        }
        xSamples.forEach((x) => {
            addCandidate(x, collisionBox.y - northClearance, 'north');
            addCandidate(x, collisionBox.y + collisionBox.h + southClearance, 'south');
        });
        ySamples.forEach((y) => {
            addCandidate(collisionBox.x - sideClearance, y, 'west');
            addCandidate(collisionBox.x + collisionBox.w + sideClearance, y, 'east');
        });
        [28, 48, 72, 96].forEach((radius) => {
            for (let step = 0; step < 16; step += 1) {
                const angle = (Math.PI * 2 * step) / 16;
                addCandidate(anchorX + Math.cos(angle) * radius, anchorY + Math.sin(angle) * radius, 'ring');
            }
        });
        let best = null;
        candidates.forEach((candidate) => {
            if (candidate.y < 0 || candidate.y > stageSize.height - 4) return;
            if (!isAutoTravelPositionAllowed(candidate.x, candidate.y)) return;
            const sideRank = sideOrder.includes(candidate.side) ? sideOrder.indexOf(candidate.side) : sideOrder.length;
            const anchorDistance = Math.hypot(
                getCommercialV2LoopDeltaX(anchorX, candidate.x, stageSize.width),
                candidate.y - anchorY,
            );
            const currentDistance = currentPlayer
                ? Math.hypot(
                      getCommercialV2LoopDeltaX(currentPlayer.x, candidate.x, stageSize.width),
                      candidate.y - currentPlayer.y,
                  )
                : 0;
            const score = sideRank * 10000 + anchorDistance + currentDistance * 0.05;
            if (!best || score < best.score) {
                best = { ...candidate, score };
            }
        });
        return best ? { x: best.x, y: best.y } : null;
    };

    const getAutoTravelTargetPoint = (place, currentPlayer) => {
        if (!place) return null;
        const approachMinY = getCommercialV2PlaceApproachMinY(place);
        if (place.manualAnchor) {
            if (approachMinY === null) {
                const propApproachPoint = getAutoTravelPropApproachPoint(place, currentPlayer);
                if (propApproachPoint) return propApproachPoint;
            }
            return getNearestWalkablePlayerPoint(place.anchor.x, place.anchor.y, currentPlayer, {
                useAutoTravelBlocks: true,
                fallbackToCurrent: false,
            });
        }
        if (approachMinY === null) {
            const propApproachPoint = getAutoTravelPropApproachPoint(place, currentPlayer);
            if (propApproachPoint) return propApproachPoint;
            return getNearestWalkablePlayerPoint(place.anchor.x, place.anchor.y, currentPlayer, {
                useAutoTravelBlocks: true,
                fallbackToCurrent: false,
            });
        }
        const desiredX = wrapLoopCoordinate(place.anchor.x, stageSize.width);
        const buildingApproachOffset =
            place.assetId === 'building_hospital'
                ? Math.max(96, playerDimensions.height * 0.68)
                : Math.max(54, playerDimensions.height * 0.42);
        const desiredY = Math.max(0, Math.min(stageSize.height - 8, place.anchor.y + buildingApproachOffset));
        const xOffsets = [0, -12, 12, -24, 24, -36, 36, -48, 48, -72, 72, -96, 96, -132, 132, -168, 168];
        const yOffsets = [0, 12, 24, 36, 48, 64, 80, 104, 128, -12, -24, -36];
        let best = null;
        yOffsets.forEach((dy) => {
            const y = desiredY + dy;
            if (y < approachMinY || y < 0 || y > stageSize.height - 4) return;
            xOffsets.forEach((dx) => {
                const x = wrapLoopCoordinate(desiredX + dx, stageSize.width);
                if (!isAutoTravelPositionAllowed(x, y)) return;
                const score = Math.abs(dx) * 2.2 + Math.abs(dy) + Math.max(0, y - desiredY) * 0.35;
                if (!best || score < best.score) {
                    best = { x, y, score };
                }
            });
        });
        if (best) return { x: best.x, y: best.y };
        const fallback = getNearestWalkablePlayerPoint(place.anchor.x, place.anchor.y, currentPlayer, {
            useAutoTravelBlocks: true,
            fallbackToCurrent: false,
            approachMinY,
        });
        return fallback && fallback.y >= approachMinY ? fallback : null;
    };

    const buildStreetCruiseSegment = (fromPoint) => {
        if (!fromPoint || stageSize.width <= 0 || stageSize.height <= 0) return null;
        const origin = {
            x: wrapLoopCoordinate(
                Number.isFinite(fromPoint.x) ? fromPoint.x : commercialV2PlayerInitial.x,
                stageSize.width,
            ),
            y: Number.isFinite(fromPoint.y) ? fromPoint.y : commercialV2PlayerInitial.y,
        };
        const minY = 178;
        const maxY = Math.max(minY + 1, stageSize.height - 12);
        const baseY = Math.max(minY, Math.min(maxY, origin.y));
        const isAcceptableCruiseRoute = (route) => {
            if (!route?.waypoints?.length) return false;
            const routeForwardDelta = getCommercialV2LoopDeltaX(origin.x, route.destination.x, stageSize.width);
            if (routeForwardDelta < commercialV2StreetCruiseMinForward) return false;
            const minProgress = route.waypoints.reduce(
                (minimum, point) => Math.min(minimum, getCommercialV2LoopDeltaX(origin.x, point.x, stageSize.width)),
                routeForwardDelta,
            );
            const maxProgress = route.waypoints.reduce(
                (maximum, point) => Math.max(maximum, getCommercialV2LoopDeltaX(origin.x, point.x, stageSize.width)),
                routeForwardDelta,
            );
            return (
                minProgress >= -commercialV2ForwardPathBacktrackLimit * 2 &&
                maxProgress <= routeForwardDelta + commercialV2ForwardPathOvershootTolerance * 2
            );
        };
        const buildStreetCruiseRoadCenterRoute = (candidate) => {
            if (!streetCruiseRoadRects.length || !isStreetCruiseRoadPoint(candidate.x, candidate.y)) return null;
            const finalProgress = getCommercialV2LoopDeltaX(origin.x, candidate.x, stageSize.width);
            if (finalProgress < commercialV2StreetCruiseMinForward) return null;
            const distances = [0];
            for (
                let distance = commercialV2StreetCruiseCenterStep;
                distance < finalProgress;
                distance += commercialV2StreetCruiseCenterStep
            ) {
                distances.push(distance);
            }
            distances.push(finalProgress);
            const centerPoints = [];
            let preferredY = baseY;
            distances.forEach((distance, index) => {
                const point =
                    index === distances.length - 1
                        ? candidate
                        : getNearestStreetCruiseRoadTravelPoint(origin.x + distance, preferredY);
                if (!point) return;
                const previous = centerPoints[centerPoints.length - 1] || origin;
                const progress = getCommercialV2LoopDeltaX(origin.x, point.x, stageSize.width);
                const previousProgress = getCommercialV2LoopDeltaX(origin.x, previous.x, stageSize.width);
                const duplicate =
                    Math.hypot(getCommercialV2LoopDeltaX(previous.x, point.x, stageSize.width), previous.y - point.y) <
                    8;
                if (duplicate || progress < previousProgress - 8) return;
                centerPoints.push(point);
                preferredY = point.y;
            });
            if (!centerPoints.length) return null;
            const waypoints = [];
            let totalDistance = 0;
            let previous = origin;
            for (const point of centerPoints) {
                const forwardDelta = getCommercialV2LoopDeltaX(previous.x, point.x, stageSize.width);
                const segment = buildAutoTravelPath(previous, point, {
                    preferStreetCruiseRoad: true,
                    preferForward: forwardDelta >= commercialV2StreetCruiseMinForward,
                });
                if (!segment?.waypoints?.length) return null;
                segment.waypoints.forEach((waypoint) => {
                    const last = waypoints[waypoints.length - 1] || previous;
                    const distance = Math.hypot(
                        getCommercialV2LoopDeltaX(last.x, waypoint.x, stageSize.width),
                        waypoint.y - last.y,
                    );
                    if (distance < 2) return;
                    waypoints.push(waypoint);
                    totalDistance += distance;
                });
                previous = segment.destination;
            }
            return {
                destination: waypoints[waypoints.length - 1] || centerPoints[centerPoints.length - 1],
                waypoints,
                totalDistance,
            };
        };
        const buildCruiseRoute = (candidate) => {
            const centerRoute = buildStreetCruiseRoadCenterRoute(candidate);
            if (isAcceptableCruiseRoute(centerRoute)) return centerRoute;
            const attempts = [
                { preferStreetCruiseRoad: isStreetCruiseRoadPoint(candidate.x, candidate.y), preferForward: true },
                { preferMainRoad: isMainRoadPoint(candidate.x, candidate.y), preferForward: true },
                { preferMainRoad: false, preferForward: true },
                { preferMainRoad: false, preferForward: false },
            ];
            for (const routeOptions of attempts) {
                const route = buildAutoTravelPath(origin, candidate, routeOptions);
                if (isAcceptableCruiseRoute(route)) return route;
            }
            return null;
        };
        for (const distance of commercialV2StreetCruiseDistances) {
            for (const laneOffset of commercialV2StreetCruiseLaneOffsets) {
                const candidate =
                    getNearestStreetCruiseRoadTravelPoint(origin.x + distance, baseY + laneOffset) ||
                    getNearestMainRoadTravelPoint(origin.x + distance, baseY + laneOffset) ||
                    getNearestWalkablePlayerPoint(origin.x + distance, baseY + laneOffset, origin, {
                        useAutoTravelBlocks: true,
                        fallbackToCurrent: false,
                    });
                if (!candidate) continue;
                const forwardDelta = getCommercialV2LoopDeltaX(origin.x, candidate.x, stageSize.width);
                if (forwardDelta < commercialV2StreetCruiseMinForward) continue;
                const route = buildCruiseRoute(candidate);
                if (!route) continue;
                return {
                    ...route,
                    anchorPoint: candidate,
                };
            }
        }
        return null;
    };

    const resolveStreetCruiseTarget = (currentPlayer = playerRef.current) => {
        const route = buildStreetCruiseSegment(currentPlayer);
        if (!route?.waypoints?.length) return null;
        return {
            targetId: 'street',
            mode: 'streetCruise',
            place: { facing: 'right' },
            point: route.destination,
            anchorPoint: route.anchorPoint,
            path: route.waypoints,
            score: route.totalDistance,
            label: commercialV2TravelLabelById.street,
            action: '闲逛中',
        };
    };

    const resolveAutoTravelTarget = (targetId, currentPlayerOverride = null) => {
        const requestedId = String(targetId || '').trim();
        if (!requestedId) return null;
        const currentPlayer = currentPlayerOverride || playerRef.current;
        if (requestedId === 'street') {
            return resolveStreetCruiseTarget(currentPlayer);
        }
        const exactPlaceCandidates = placeLinks.filter((place) => place.placeId === requestedId);
        const exactLocationCandidates = exactPlaceCandidates.length
            ? []
            : placeLinks.filter((place) => place.locationId === requestedId);
        const candidates = exactPlaceCandidates.length
            ? exactPlaceCandidates
            : exactLocationCandidates.length
              ? exactLocationCandidates
              : placeLinks.filter((place) => place.locationIds.includes(requestedId));
        if (!candidates.length) return null;
        let best = null;
        candidates.forEach((place) => {
            const point = getAutoTravelTargetPoint(place, currentPlayer);
            if (!point) return;
            const route = buildAutoTravelPath(currentPlayer, point);
            if (!route?.waypoints?.length) return;
            const score = route.totalDistance;
            if (!best || score < best.score) {
                best = {
                    targetId: requestedId,
                    place,
                    point: route.destination,
                    anchorPoint: point,
                    path: route.waypoints,
                    score,
                    label: commercialV2TravelLabelById[requestedId] || place.name,
                    action: getCommercialV2TravelAction(place, requestedId),
                };
            }
        });
        return best;
    };

    function buildBehaviorSmoothTravelPath(fromPoint, toPoint) {
        if (!fromPoint || !toPoint) return [];
        const targetPoint = {
            x: wrapLoopCoordinate(Number.isFinite(toPoint.x) ? toPoint.x : fromPoint.x, stageSize.width),
            y: Number.isFinite(toPoint.y) ? toPoint.y : fromPoint.y,
        };
        const dx = getCommercialV2LoopDeltaX(fromPoint.x, targetPoint.x, stageSize.width);
        const dy = targetPoint.y - fromPoint.y;
        if (Math.hypot(dx, dy) < 4) return [targetPoint];
        if (Math.abs(dx) < 36 || Math.abs(dy) > Math.abs(dx) * 0.55) {
            return [targetPoint];
        }
        const laneY = Math.round(fromPoint.y + dy * 0.32);
        const midPoint = {
            x: wrapLoopCoordinate(fromPoint.x + dx * 0.5, stageSize.width),
            y: laneY,
        };
        return [midPoint, { x: targetPoint.x, y: laneY }, targetPoint];
    }

    const resolvePlayerGroundMove = (current, nextX, nextY, options = {}) => {
        const useAutoTravelBlocks = Boolean(options.useAutoTravelBlocks);
        const pointOptions = { ignorePlayerId: current?.id || controlledPlayerIdRef.current };
        const pointAllowed = useAutoTravelBlocks
            ? (pointX, pointY) => isAutoTravelPositionAllowed(pointX, pointY, pointOptions)
            : (pointX, pointY) => isPlayerPositionAllowed(pointX, pointY, pointOptions);
        const wrappedNextX = wrapLoopCoordinate(nextX, stageSize.width);
        if (pointAllowed(wrappedNextX, nextY)) {
            return { x: wrappedNextX, y: nextY };
        }
        if (pointAllowed(wrappedNextX, current.y)) {
            return { x: wrappedNextX, y: current.y };
        }
        if (pointAllowed(current.x, nextY)) {
            return { x: current.x, y: nextY };
        }
        if (pointAllowed(current.x, current.y)) {
            return { x: current.x, y: current.y };
        }
        return getNearestWalkablePlayerPoint(wrappedNextX, nextY, current, {
            useAutoTravelBlocks,
            ...pointOptions,
        });
    };
    return {
        isPlayerPositionAllowed,
        buildAutoTravelPath,
        buildSafePlayerStates,
        getNearestWalkablePlayerPoint,
        buildStreetCruiseSegment,
        resolveAutoTravelTarget,
        buildBehaviorSmoothTravelPath,
        resolvePlayerGroundMove,
    };
}
