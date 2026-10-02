import {
    getBoxesOverlapArea,
    clampRoomEditorPlayer,
    roomEditorBehaviorSafePoints,
    getRoomEditorDirectionFromDelta,
} from '../roomEditorCore.js';
import { segmentCrossesBox } from './segmentCollision.js';

// Room collision, safe positions and routes. No React state, timers, storage or network calls.
export function createRoomNavigation({ playerDimensions, roomCollisionRects, behaviorPlaceLinks }) {
    const getRoomPlayerFootBox = (x, y) => {
        const footWidth = Math.max(14, playerDimensions.width * 0.28);
        const footHeight = Math.max(8, playerDimensions.footOffset * 0.72);
        return {
            x: Number(x || 0) - footWidth / 2,
            y: Number(y || 0) - footHeight / 2,
            w: footWidth,
            h: footHeight,
        };
    };

    const getRoomPlayerCollisionOverlapArea = (x, y) => {
        if (!roomCollisionRects.length) return 0;
        const footBox = getRoomPlayerFootBox(x, y);
        return roomCollisionRects.reduce((total, rect) => total + getBoxesOverlapArea(footBox, rect), 0);
    };

    const isRoomPlayerBlockedByItems = (x, y) => getRoomPlayerCollisionOverlapArea(x, y) > 0.01;

    const findSafeRoomPlayerPointNear = (point, origin = null) => {
        const base = clampRoomEditorPlayer(point);
        if (!isRoomPlayerBlockedByItems(base.x, base.y)) return base;
        const directions = [
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: -1 },
            { x: -1, y: 1 },
            { x: 1, y: 1 },
            { x: -1, y: -1 },
            { x: 1, y: -1 },
        ];
        const distances = [18, 32, 52, 76, 108, 144];
        let best = null;
        distances.forEach((distance) => {
            directions.forEach((direction) => {
                const candidate = clampRoomEditorPlayer({
                    ...base,
                    x: base.x + direction.x * distance,
                    y: base.y + direction.y * distance,
                });
                if (isRoomPlayerBlockedByItems(candidate.x, candidate.y)) return;
                const anchorDistance = Math.hypot(candidate.x - base.x, candidate.y - base.y);
                const originDistance = origin ? Math.hypot(candidate.x - origin.x, candidate.y - origin.y) * 0.08 : 0;
                const frontBias = direction.y > 0 ? -4 : 0;
                const score = anchorDistance + originDistance + frontBias;
                if (!best || score < best.score) {
                    best = { ...candidate, score };
                }
            });
        });
        return best ? clampRoomEditorPlayer({ ...base, x: best.x, y: best.y }) : base;
    };

    const resolveRoomPlayerMovement = (currentPlayer, targetPoint) => {
        const currentPoint = clampRoomEditorPlayer(currentPlayer);
        const desiredPoint = clampRoomEditorPlayer({
            ...currentPoint,
            x: Number.isFinite(Number(targetPoint?.x)) ? Number(targetPoint.x) : currentPoint.x,
            y: Number.isFinite(Number(targetPoint?.y)) ? Number(targetPoint.y) : currentPoint.y,
        });
        const currentOverlap = getRoomPlayerCollisionOverlapArea(currentPoint.x, currentPoint.y);
        const isAllowedPoint = (point) => {
            const overlap = getRoomPlayerCollisionOverlapArea(point.x, point.y);
            return overlap <= 0.01 || (currentOverlap > 0.01 && overlap < currentOverlap - 0.01);
        };
        if (isAllowedPoint(desiredPoint)) return desiredPoint;
        const xOnlyPoint = clampRoomEditorPlayer({ ...currentPoint, x: desiredPoint.x });
        if (isAllowedPoint(xOnlyPoint)) return xOnlyPoint;
        const yOnlyPoint = clampRoomEditorPlayer({ ...currentPoint, y: desiredPoint.y });
        if (isAllowedPoint(yOnlyPoint)) return yOnlyPoint;
        return currentPoint;
    };

    function isRoomTravelSegmentClear(fromPoint, toPoint) {
        if (!fromPoint || !toPoint) return false;
        const start = clampRoomEditorPlayer(fromPoint);
        const target = clampRoomEditorPlayer(toPoint);
        const dx = target.x - start.x;
        const dy = target.y - start.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) return !isRoomPlayerBlockedByItems(target.x, target.y);
        const startOverlap = getRoomPlayerCollisionOverlapArea(start.x, start.y);
        if (startOverlap <= 0.01) {
            // Swept footprint catches corner clipping that widely spaced sample points can miss.
            const footprint = getRoomPlayerFootBox(0, 0);
            return !roomCollisionRects.some((rect) =>
                segmentCrossesBox(start, target, {
                    x: rect.x - footprint.w / 2,
                    y: rect.y - footprint.h / 2,
                    w: rect.w + footprint.w,
                    h: rect.h + footprint.h,
                }),
            );
        }
        // Keep the legacy escape rule for characters spawned inside moved furniture.
        const steps = Math.max(1, Math.ceil(distance / 4));
        let previousOverlap = startOverlap;
        for (let index = 1; index <= steps; index += 1) {
            const ratio = index / steps;
            const sample = clampRoomEditorPlayer({
                ...start,
                x: start.x + dx * ratio,
                y: start.y + dy * ratio,
            });
            const overlap = getRoomPlayerCollisionOverlapArea(sample.x, sample.y);
            const leavingCurrentCollision = startOverlap > 0.01 && overlap <= previousOverlap + 0.01;
            if (overlap > 0.01 && !leavingCurrentCollision) return false;
            previousOverlap = overlap;
        }
        return true;
    }

    function buildRoomTravelCandidatePoints(fromPoint, toPoint) {
        const start = clampRoomEditorPlayer(fromPoint);
        const target = clampRoomEditorPlayer(toPoint);
        const clearance = Math.max(34, playerDimensions.width * 0.36, playerDimensions.footOffset * 2);
        const rawCandidates = [
            { ...start, x: start.x, y: target.y },
            { ...start, x: target.x, y: start.y },
            { ...start, x: start.x + (target.x - start.x) * 0.5, y: start.y },
            { ...start, x: start.x + (target.x - start.x) * 0.5, y: target.y },
            { ...start, x: target.x, y: start.y + (target.y - start.y) * 0.5 },
            ...roomEditorBehaviorSafePoints,
        ];
        roomCollisionRects.forEach((rect) => {
            const left = rect.x - clearance;
            const right = rect.x + rect.w + clearance;
            const top = rect.y - clearance;
            const bottom = rect.y + rect.h + clearance;
            const centerX = rect.x + rect.w / 2;
            const centerY = rect.y + rect.h / 2;
            rawCandidates.push(
                { ...start, x: left, y: top },
                { ...start, x: right, y: top },
                { ...start, x: left, y: bottom },
                { ...start, x: right, y: bottom },
                { ...start, x: centerX, y: top },
                { ...start, x: centerX, y: bottom },
                { ...start, x: left, y: centerY },
                { ...start, x: right, y: centerY },
            );
        });
        const seen = new Set();
        return rawCandidates
            .map((point) => {
                const clamped = clampRoomEditorPlayer(point);
                return findSafeRoomPlayerPointNear(clamped, start);
            })
            .filter((point) => !isRoomPlayerBlockedByItems(point.x, point.y))
            .filter((point) => {
                const key = `${Math.round(point.x / 8)}:${Math.round(point.y / 8)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .sort(
                (a, b) =>
                    Math.hypot(a.x - start.x, a.y - start.y) +
                    Math.hypot(a.x - target.x, a.y - target.y) -
                    Math.hypot(b.x - start.x, b.y - start.y) -
                    Math.hypot(b.x - target.x, b.y - target.y),
            )
            .slice(0, 36);
    }

    function getRoomTravelPathScore(points) {
        return points.reduce((total, point, index) => {
            const previous = index === 0 ? null : points[index - 1];
            return previous ? total + Math.hypot(point.x - previous.x, point.y - previous.y) : total;
        }, 0);
    }

    function buildBehaviorSmoothTravelPath(fromPoint, toPoint) {
        if (!fromPoint || !toPoint) return [];
        const targetPoint = clampRoomEditorPlayer({
            ...fromPoint,
            x: Number.isFinite(toPoint.x) ? toPoint.x : fromPoint.x,
            y: Number.isFinite(toPoint.y) ? toPoint.y : fromPoint.y,
        });
        const safeTargetPoint = findSafeRoomPlayerPointNear(targetPoint, fromPoint);
        const dx = targetPoint.x - fromPoint.x;
        const dy = targetPoint.y - fromPoint.y;
        if (Math.hypot(dx, dy) < 4) return [safeTargetPoint];
        if (isRoomTravelSegmentClear(fromPoint, safeTargetPoint)) return [safeTargetPoint];
        const candidates = buildRoomTravelCandidatePoints(fromPoint, safeTargetPoint);
        let bestPath = null;
        const tryPath = (path) => {
            const fullPath = [fromPoint, ...path];
            const isClear = fullPath.every(
                (point, index) => index === 0 || isRoomTravelSegmentClear(fullPath[index - 1], point),
            );
            if (!isClear) return;
            const score = getRoomTravelPathScore(fullPath);
            if (!bestPath || score < bestPath.score) {
                bestPath = { path, score };
            }
        };
        candidates.forEach((candidate) => {
            tryPath([candidate, safeTargetPoint]);
        });
        const nearCandidates = candidates.slice(0, 18);
        nearCandidates.forEach((first) => {
            nearCandidates.forEach((second) => {
                if (first === second) return;
                tryPath([first, second, safeTargetPoint]);
            });
        });
        if (bestPath?.path?.length) return bestPath.path;
        if (Math.abs(dx) < 36 || Math.abs(dy) > Math.abs(dx) * 0.55) {
            return [safeTargetPoint];
        }
        const laneY = Math.round(fromPoint.y + dy * 0.32);
        const midPoint = findSafeRoomPlayerPointNear(
            clampRoomEditorPlayer({
                ...fromPoint,
                x: fromPoint.x + dx * 0.5,
                y: laneY,
            }),
            fromPoint,
        );
        const alignedPoint = findSafeRoomPlayerPointNear(
            clampRoomEditorPlayer({
                ...fromPoint,
                x: safeTargetPoint.x,
                y: laneY,
            }),
            fromPoint,
        );
        return [midPoint, alignedPoint, safeTargetPoint];
    }

    function resolveRoomBehaviorTarget(targetId, currentPlayer) {
        const safeTargetId = String(targetId || '').trim();
        if (!safeTargetId) return null;
        const place = behaviorPlaceLinks.find(
            (item) =>
                item.placeId === safeTargetId ||
                item.locationId === safeTargetId ||
                item.locationIds?.includes(safeTargetId),
        );
        if (!place?.anchor) return null;
        const anchorPoint = clampRoomEditorPlayer({
            ...currentPlayer,
            x: Number(place.anchor.x),
            y: Number(place.anchor.y),
        });
        const point = findSafeRoomPlayerPointNear(anchorPoint, currentPlayer);
        const direction =
            place.facing ||
            getRoomEditorDirectionFromDelta(
                point.x - currentPlayer.x,
                point.y - currentPlayer.y,
                currentPlayer.direction,
            );
        return {
            targetId: place.placeId,
            label: place.name,
            point,
            anchorPoint,
            path: buildBehaviorSmoothTravelPath(currentPlayer, point),
            place: { facing: direction },
            action: place.kind || '房间行动',
            mode: 'roomBehavior',
        };
    }
    return {
        findSafeRoomPlayerPointNear,
        resolveRoomPlayerMovement,
        buildBehaviorSmoothTravelPath,
        resolveRoomBehaviorTarget,
    };
}
