import {
    commercialV2PlayerInitial,
    commercialV2MainRoadTargetInset,
    commercialV2MainRoadCenterRatio,
    wrapLoopCoordinate,
    commercialV2StreetCruiseRoadCenterRatio,
    getCommercialV2LoopDeltaX,
    commercialV2PathCellSize,
    commercialV2StreetCruiseMinForward,
    commercialV2ForwardPathBacktrackLimit,
    commercialV2ForwardPathOvershootTolerance,
    pushCommercialV2PathHeap,
    commercialV2PathMaxVisited,
    popCommercialV2PathHeap,
    commercialV2MainRoadCellPenalty,
    commercialV2ForwardPathBacktrackPenalty,
} from '../commercialStreetCore.js';

// Route search and simplification depend only on geometry and collision queries.
export function createStreetPathfinder({
    mainRoadRects,
    stageSize,
    isAutoTravelPositionAllowed,
    streetCruiseRoadRects,
    isMainRoadPoint,
    getStreetCruiseRoadPenalty,
}) {
    const getNearestMainRoadTravelPoint = (rawX, preferredY = null) => {
        if (!mainRoadRects.length || stageSize.width <= 0) return null;
        const targetX = Number.isFinite(rawX) ? rawX : commercialV2PlayerInitial.x;
        let best = null;
        mainRoadRects.forEach((rect) => {
            [-stageSize.width, 0, stageSize.width].forEach((offset) => {
                const insetX = Math.min(commercialV2MainRoadTargetInset, Math.max(0, rect.w / 2 - 1));
                const insetY = Math.min(20, Math.max(0, rect.h / 2 - 1));
                const left = rect.x + offset + insetX;
                const right = rect.x + offset + rect.w - insetX;
                const top = rect.y + insetY;
                const bottom = rect.y + rect.h - insetY;
                if (right < left || bottom < top) return;
                const clampedX = Math.max(left, Math.min(right, targetX));
                const centerY = rect.y + rect.h * commercialV2MainRoadCenterRatio;
                const preferredRoadY = Number.isFinite(preferredY)
                    ? Math.max(top, Math.min(bottom, preferredY))
                    : centerY;
                const xSamples = [clampedX, clampedX - 24, clampedX + 24, clampedX - 48, clampedX + 48];
                const ySamples = [centerY, preferredRoadY, centerY - 24, centerY + 24, centerY - 48, centerY + 48];
                xSamples.forEach((candidateX) => {
                    if (candidateX < left || candidateX > right) return;
                    ySamples.forEach((candidateY) => {
                        if (candidateY < top || candidateY > bottom) return;
                        const x = wrapLoopCoordinate(candidateX, stageSize.width);
                        if (!isAutoTravelPositionAllowed(x, candidateY)) return;
                        const score =
                            Math.abs(candidateX - targetX) * 0.8 +
                            Math.abs(candidateY - centerY) * 2.2 +
                            Math.abs(candidateY - preferredRoadY) * 0.25;
                        if (!best || score < best.score) {
                            best = { x, y: candidateY, score };
                        }
                    });
                });
            });
        });
        return best ? { x: best.x, y: best.y } : null;
    };

    const getNearestStreetCruiseRoadTravelPoint = (rawX, preferredY = null) => {
        if (!streetCruiseRoadRects.length || stageSize.width <= 0) return null;
        const targetX = Number.isFinite(rawX) ? rawX : commercialV2PlayerInitial.x;
        let best = null;
        streetCruiseRoadRects.forEach((rect) => {
            [-stageSize.width, 0, stageSize.width].forEach((offset) => {
                const insetX = Math.min(commercialV2MainRoadTargetInset, Math.max(0, rect.w / 2 - 1));
                const insetY = Math.min(28, Math.max(0, rect.h / 2 - 1));
                const left = rect.x + offset + insetX;
                const right = rect.x + offset + rect.w - insetX;
                const top = rect.y + insetY;
                const bottom = rect.y + rect.h - insetY;
                if (right < left || bottom < top) return;
                const clampedX = Math.max(left, Math.min(right, targetX));
                const centerY = rect.y + rect.h * commercialV2StreetCruiseRoadCenterRatio;
                const preferredRoadY = Number.isFinite(preferredY)
                    ? Math.max(top, Math.min(bottom, preferredY))
                    : centerY;
                const xSamples = [clampedX, clampedX - 24, clampedX + 24, clampedX - 48, clampedX + 48];
                const ySamples = [centerY, centerY - 24, centerY + 24, preferredRoadY, centerY - 48, centerY + 48];
                xSamples.forEach((candidateX) => {
                    if (candidateX < left || candidateX > right) return;
                    ySamples.forEach((candidateY) => {
                        if (candidateY < top || candidateY > bottom) return;
                        const x = wrapLoopCoordinate(candidateX, stageSize.width);
                        if (!isAutoTravelPositionAllowed(x, candidateY)) return;
                        const score =
                            Math.abs(candidateX - targetX) * 0.8 +
                            Math.abs(candidateY - centerY) * 3.6 +
                            Math.abs(candidateY - preferredRoadY) * 0.05;
                        if (!best || score < best.score) {
                            best = { x, y: candidateY, score };
                        }
                    });
                });
            });
        });
        return best ? { x: best.x, y: best.y } : null;
    };

    const isAutoTravelSegmentClear = (fromPoint, toPoint) => {
        const dx = getCommercialV2LoopDeltaX(fromPoint.x, toPoint.x, stageSize.width);
        const dy = toPoint.y - fromPoint.y;
        const distance = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(distance / (commercialV2PathCellSize * 0.25)));
        for (let step = 0; step <= steps; step += 1) {
            const ratio = step / steps;
            const x = wrapLoopCoordinate(fromPoint.x + dx * ratio, stageSize.width);
            const y = fromPoint.y + dy * ratio;
            if (!isAutoTravelPositionAllowed(x, y)) return false;
        }
        return true;
    };

    const simplifyAutoTravelPath = (points) => {
        if (points.length <= 2) return points;
        const simplified = [points[0]];
        let anchorIndex = 0;
        while (anchorIndex < points.length - 1) {
            let nextIndex = anchorIndex + 1;
            for (let candidateIndex = points.length - 1; candidateIndex > nextIndex; candidateIndex -= 1) {
                if (isAutoTravelSegmentClear(points[anchorIndex], points[candidateIndex])) {
                    nextIndex = candidateIndex;
                    break;
                }
            }
            simplified.push(points[nextIndex]);
            anchorIndex = nextIndex;
        }
        return simplified;
    };

    const buildAutoTravelPath = (fromPoint, targetPoint, options = {}) => {
        if (stageSize.width <= 0 || stageSize.height <= 0) return null;
        const preferMainRoad = Boolean(options.preferMainRoad && mainRoadRects.length);
        const preferStreetCruiseRoad = Boolean(options.preferStreetCruiseRoad && streetCruiseRoadRects.length);
        const preferForward = Boolean(options.preferForward);
        const targetForwardDistance = preferForward
            ? Math.max(
                  commercialV2StreetCruiseMinForward,
                  getCommercialV2LoopDeltaX(fromPoint.x, targetPoint.x, stageSize.width),
              )
            : 0;
        const minForwardProgress = -commercialV2ForwardPathBacktrackLimit;
        const maxForwardProgress = targetForwardDistance + commercialV2ForwardPathOvershootTolerance;
        const getForwardProgress = (point) => getCommercialV2LoopDeltaX(fromPoint.x, point.x, stageSize.width);
        const cellSize = commercialV2PathCellSize;
        const columnCount = Math.max(1, Math.ceil(stageSize.width / cellSize));
        const rowCount = Math.max(1, Math.ceil(stageSize.height / cellSize));
        const cellCount = columnCount * rowCount;
        const allowedCells = new Uint8Array(cellCount);
        const getCellIndex = (column, row) => row * columnCount + column;
        const getCellCenter = (index) => {
            const row = Math.floor(index / columnCount);
            const column = index % columnCount;
            return {
                x: wrapLoopCoordinate(Math.min(stageSize.width - 1, column * cellSize + cellSize / 2), stageSize.width),
                y: Math.min(stageSize.height - 1, row * cellSize + cellSize / 2),
            };
        };
        let allowedCount = 0;
        for (let row = 0; row < rowCount; row += 1) {
            for (let column = 0; column < columnCount; column += 1) {
                const index = getCellIndex(column, row);
                const center = getCellCenter(index);
                if (isAutoTravelPositionAllowed(center.x, center.y)) {
                    allowedCells[index] = 1;
                    allowedCount += 1;
                }
            }
        }
        if (!allowedCount) return null;

        const findNearestCell = (point, options = {}) => {
            const requireClearSegment = Boolean(options.requireClearSegment);
            let best = null;
            for (let index = 0; index < cellCount; index += 1) {
                if (!allowedCells[index]) continue;
                const center = getCellCenter(index);
                if (preferForward) {
                    const progress = getForwardProgress(center);
                    if (progress < minForwardProgress || progress > maxForwardProgress) continue;
                }
                if (requireClearSegment && !isAutoTravelSegmentClear(point, center)) continue;
                const dx = getCommercialV2LoopDeltaX(point.x, center.x, stageSize.width);
                const dy = center.y - point.y;
                const score = dx ** 2 + dy ** 2;
                if (!best || score < best.score) {
                    best = { index, center, score };
                }
            }
            return best;
        };

        const startCell =
            findNearestCell(fromPoint, {
                requireClearSegment: isAutoTravelPositionAllowed(fromPoint.x, fromPoint.y),
            }) || findNearestCell(fromPoint);
        const targetCell =
            findNearestCell(targetPoint, {
                requireClearSegment: isAutoTravelPositionAllowed(targetPoint.x, targetPoint.y),
            }) || findNearestCell(targetPoint);
        if (!startCell || !targetCell) return null;
        if (startCell.index === targetCell.index) {
            const destination = isAutoTravelSegmentClear(fromPoint, targetPoint) ? targetPoint : targetCell.center;
            return {
                destination,
                waypoints: [destination],
                totalDistance: Math.hypot(
                    getCommercialV2LoopDeltaX(fromPoint.x, destination.x, stageSize.width),
                    destination.y - fromPoint.y,
                ),
            };
        }

        const getHeuristic = (index) => {
            const current = getCellCenter(index);
            const target = targetCell.center;
            return Math.hypot(getCommercialV2LoopDeltaX(current.x, target.x, stageSize.width), target.y - current.y);
        };
        const gScore = new Float64Array(cellCount);
        gScore.fill(Infinity);
        const cameFrom = new Int32Array(cellCount);
        cameFrom.fill(-1);
        const closedCells = new Uint8Array(cellCount);
        const openHeap = [];
        gScore[startCell.index] = 0;
        pushCommercialV2PathHeap(openHeap, {
            index: startCell.index,
            priority: getHeuristic(startCell.index),
        });

        const directions = [
            { dx: 1, dy: 0, cost: 1 },
            { dx: -1, dy: 0, cost: 1 },
            { dx: 0, dy: 1, cost: 1 },
            { dx: 0, dy: -1, cost: 1 },
            { dx: 1, dy: 1, cost: Math.SQRT2 },
            { dx: 1, dy: -1, cost: Math.SQRT2 },
            { dx: -1, dy: 1, cost: Math.SQRT2 },
            { dx: -1, dy: -1, cost: Math.SQRT2 },
        ];

        let reachedIndex = -1;
        let visitedCount = 0;
        while (openHeap.length && visitedCount < commercialV2PathMaxVisited) {
            const currentNode = popCommercialV2PathHeap(openHeap);
            if (!currentNode || closedCells[currentNode.index]) continue;
            if (currentNode.index === targetCell.index) {
                reachedIndex = currentNode.index;
                break;
            }
            closedCells[currentNode.index] = 1;
            visitedCount += 1;
            const currentRow = Math.floor(currentNode.index / columnCount);
            const currentColumn = currentNode.index % columnCount;
            const currentCenter = getCellCenter(currentNode.index);
            directions.forEach((direction) => {
                const nextRow = currentRow + direction.dy;
                if (nextRow < 0 || nextRow >= rowCount) return;
                const nextColumn = (currentColumn + direction.dx + columnCount) % columnCount;
                const nextIndex = getCellIndex(nextColumn, nextRow);
                if (!allowedCells[nextIndex] || closedCells[nextIndex]) return;
                if (direction.dx && direction.dy) {
                    const horizontalIndex = getCellIndex(nextColumn, currentRow);
                    const verticalIndex = getCellIndex(currentColumn, nextRow);
                    if (!allowedCells[horizontalIndex] || !allowedCells[verticalIndex]) return;
                }
                const nextCenter = getCellCenter(nextIndex);
                if (preferForward) {
                    const nextProgress = getForwardProgress(nextCenter);
                    if (nextProgress < minForwardProgress || nextProgress > maxForwardProgress) return;
                }
                if (!isAutoTravelSegmentClear(currentCenter, nextCenter)) return;
                const mainRoadPenalty =
                    preferMainRoad && !isMainRoadPoint(nextCenter.x, nextCenter.y)
                        ? commercialV2MainRoadCellPenalty
                        : 0;
                const streetCruiseRoadPenalty = preferStreetCruiseRoad
                    ? getStreetCruiseRoadPenalty(nextCenter.x, nextCenter.y)
                    : 0;
                const forwardPenalty = preferForward
                    ? Math.max(0, getForwardProgress(currentCenter) - getForwardProgress(nextCenter)) *
                          commercialV2ForwardPathBacktrackPenalty +
                      Math.max(0, -getForwardProgress(nextCenter)) * commercialV2ForwardPathBacktrackPenalty
                    : 0;
                const tentativeScore =
                    gScore[currentNode.index] +
                    direction.cost * cellSize +
                    mainRoadPenalty +
                    streetCruiseRoadPenalty +
                    forwardPenalty;
                if (tentativeScore >= gScore[nextIndex]) return;
                cameFrom[nextIndex] = currentNode.index;
                gScore[nextIndex] = tentativeScore;
                pushCommercialV2PathHeap(openHeap, {
                    index: nextIndex,
                    priority: tentativeScore + getHeuristic(nextIndex),
                });
            });
        }
        if (reachedIndex < 0) return null;

        const pathIndices = [];
        let cursor = reachedIndex;
        while (cursor >= 0) {
            pathIndices.push(cursor);
            if (cursor === startCell.index) break;
            cursor = cameFrom[cursor];
        }
        pathIndices.reverse();
        const gridPoints = pathIndices.map((index) => getCellCenter(index));
        const rawPoints = [fromPoint];
        const startCenter = gridPoints[0] || startCell.center;
        if (
            startCenter &&
            Math.hypot(
                getCommercialV2LoopDeltaX(fromPoint.x, startCenter.x, stageSize.width),
                startCenter.y - fromPoint.y,
            ) > 2
        ) {
            rawPoints.push(startCenter);
        }
        rawPoints.push(...gridPoints.slice(1));
        const lastGridPoint = rawPoints[rawPoints.length - 1] || fromPoint;
        if (isAutoTravelSegmentClear(lastGridPoint, targetPoint)) {
            rawPoints.push(targetPoint);
        } else if (!rawPoints.length || rawPoints[rawPoints.length - 1] !== targetCell.center) {
            rawPoints.push(targetCell.center);
        }
        const simplifiedPoints = simplifyAutoTravelPath(rawPoints);
        const waypoints = simplifiedPoints.slice(1).filter((point, index, list) => {
            const previous = index === 0 ? fromPoint : list[index - 1];
            return (
                Math.hypot(getCommercialV2LoopDeltaX(previous.x, point.x, stageSize.width), point.y - previous.y) > 2
            );
        });
        const finalWaypoints = waypoints.length ? waypoints : [targetCell.center];
        const destination = finalWaypoints[finalWaypoints.length - 1];
        let totalDistance = 0;
        let previous = fromPoint;
        finalWaypoints.forEach((point) => {
            totalDistance += Math.hypot(
                getCommercialV2LoopDeltaX(previous.x, point.x, stageSize.width),
                point.y - previous.y,
            );
            previous = point;
        });
        return {
            destination,
            waypoints: finalWaypoints,
            totalDistance,
        };
    };
    return { getNearestMainRoadTravelPoint, getNearestStreetCruiseRoadTravelPoint, buildAutoTravelPath };
}
