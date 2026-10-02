import {
    wrapLoopCoordinate,
    commercialV2PlayerPeerCollision,
    commercialV2PlayerCharacters,
    boxesOverlap,
    commercialV2StreetCruiseRoadCenterRatio,
    commercialV2StreetCruiseCenterLinePenalty,
    commercialV2StreetCruiseOffRoadPenalty,
} from '../commercialStreetCore.js';

// Street walkable surfaces and collision probes, including wrap-around peers.
export function createStreetCollision({
    playerDimensions,
    stageSize,
    walkableRects,
    controlledPlayerIdRef,
    playersRef,
    collisionRects,
    autoRouteBlockRects,
    mainRoadRects,
    streetCruiseRoadRects,
}) {
    const getPlayerFootBox = (x, y) => {
        const footWidth = Math.max(12, playerDimensions.width * 0.28);
        const footHeight = Math.max(8, playerDimensions.footOffset * 0.75);
        return {
            x: wrapLoopCoordinate(x, stageSize.width) - footWidth / 2,
            y: y - footHeight / 2,
            w: footWidth,
            h: footHeight,
        };
    };

    const getPlayerPeerCollisionBox = (x, y) => {
        const width = Math.max(
            commercialV2PlayerPeerCollision.minWidth,
            playerDimensions.width * commercialV2PlayerPeerCollision.widthRatio,
        );
        const height = Math.max(
            commercialV2PlayerPeerCollision.minHeight,
            playerDimensions.footOffset * commercialV2PlayerPeerCollision.heightRatio,
        );
        return {
            x: wrapLoopCoordinate(x, stageSize.width) - width / 2,
            y: y - height / 2,
            w: width,
            h: height,
        };
    };

    const getPlayerCollisionProbeBoxes = (x, y) => {
        const footBox = getPlayerFootBox(x, y);
        const upperProbeHeight = Math.max(8, Math.min(26, playerDimensions.footOffset * 1.6));
        return [
            footBox,
            {
                x: footBox.x,
                y: footBox.y - upperProbeHeight,
                w: footBox.w,
                h: upperProbeHeight,
            },
        ];
    };

    const isPlayerPointWalkable = (x, y) => {
        if (!walkableRects.length) return true;
        const pointX = wrapLoopCoordinate(x, stageSize.width);
        return walkableRects.some((rect) =>
            [-stageSize.width, 0, stageSize.width].some(
                (offset) =>
                    pointX >= rect.x + offset &&
                    pointX <= rect.x + offset + rect.w &&
                    y >= rect.y &&
                    y <= rect.y + rect.h,
            ),
        );
    };

    const isPlayerBlockedByOtherPlayers = (x, y, options = {}) => {
        if (options.ignorePlayers) return false;
        const ignorePlayerId = options.ignorePlayerId || controlledPlayerIdRef.current;
        const currentPlayers = options.players || playersRef.current;
        const playerBox = getPlayerPeerCollisionBox(x, y);
        return commercialV2PlayerCharacters.some((character) => {
            if (character.id === ignorePlayerId) return false;
            const otherPlayer = currentPlayers[character.id];
            if (!otherPlayer) return false;
            const otherBox = getPlayerPeerCollisionBox(otherPlayer.x, otherPlayer.y);
            return [-stageSize.width, 0, stageSize.width].some((offset) =>
                boxesOverlap(playerBox, {
                    x: otherBox.x + offset,
                    y: otherBox.y,
                    w: otherBox.w,
                    h: otherBox.h,
                }),
            );
        });
    };

    const isPlayerFootBlocked = (x, y) => {
        if (!collisionRects.length) return false;
        const probeBoxes = getPlayerCollisionProbeBoxes(x, y);
        return collisionRects.some((rect) =>
            [-stageSize.width, 0, stageSize.width].some((offset) => {
                const shiftedRect = {
                    x: rect.x + offset,
                    y: rect.y,
                    w: rect.w,
                    h: rect.h,
                };
                return probeBoxes.some((box) => boxesOverlap(box, shiftedRect));
            }),
        );
    };

    const isAutoTravelFootBlocked = (x, y) => {
        if (!autoRouteBlockRects.length) return false;
        const probeBoxes = getPlayerCollisionProbeBoxes(x, y);
        return autoRouteBlockRects.some((rect) =>
            [-stageSize.width, 0, stageSize.width].some((offset) => {
                const shiftedRect = {
                    x: rect.x + offset,
                    y: rect.y,
                    w: rect.w,
                    h: rect.h,
                };
                return probeBoxes.some((box) => boxesOverlap(box, shiftedRect));
            }),
        );
    };

    const isPlayerPositionAllowed = (x, y, options = {}) =>
        isPlayerPointWalkable(x, y) && !isPlayerFootBlocked(x, y) && !isPlayerBlockedByOtherPlayers(x, y, options);

    const isAutoTravelPositionAllowed = (x, y, options = {}) =>
        isPlayerPointWalkable(x, y) && !isAutoTravelFootBlocked(x, y) && !isPlayerBlockedByOtherPlayers(x, y, options);

    const isMainRoadPoint = (x, y) => {
        if (!mainRoadRects.length) return false;
        const pointX = wrapLoopCoordinate(x, stageSize.width);
        return mainRoadRects.some((rect) =>
            [-stageSize.width, 0, stageSize.width].some(
                (offset) =>
                    pointX >= rect.x + offset &&
                    pointX <= rect.x + offset + rect.w &&
                    y >= rect.y &&
                    y <= rect.y + rect.h,
            ),
        );
    };

    const isStreetCruiseRoadPoint = (x, y) => {
        if (!streetCruiseRoadRects.length) return false;
        const pointX = wrapLoopCoordinate(x, stageSize.width);
        return streetCruiseRoadRects.some((rect) =>
            [-stageSize.width, 0, stageSize.width].some(
                (offset) =>
                    pointX >= rect.x + offset &&
                    pointX <= rect.x + offset + rect.w &&
                    y >= rect.y &&
                    y <= rect.y + rect.h,
            ),
        );
    };

    const getStreetCruiseRoadPenalty = (x, y) => {
        if (!streetCruiseRoadRects.length) return 0;
        const pointX = wrapLoopCoordinate(x, stageSize.width);
        let bestScore = Infinity;
        streetCruiseRoadRects.forEach((rect) => {
            [-stageSize.width, 0, stageSize.width].forEach((offset) => {
                const left = rect.x + offset;
                const right = left + rect.w;
                if (pointX < left || pointX > right || y < rect.y || y > rect.y + rect.h) return;
                const centerY = rect.y + rect.h * commercialV2StreetCruiseRoadCenterRatio;
                bestScore = Math.min(bestScore, Math.abs(y - centerY) * commercialV2StreetCruiseCenterLinePenalty);
            });
        });
        return Number.isFinite(bestScore) ? bestScore : commercialV2StreetCruiseOffRoadPenalty;
    };
    return {
        isPlayerPositionAllowed,
        isAutoTravelPositionAllowed,
        isMainRoadPoint,
        isStreetCruiseRoadPoint,
        getStreetCruiseRoadPenalty,
    };
}
