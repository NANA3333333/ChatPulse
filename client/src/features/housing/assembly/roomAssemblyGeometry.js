import {
    roomAssemblyKinds,
    roomAssemblyAllowedDirections,
    roomAssemblyShopByAssetId,
    roomEditorSizeProfileVersion,
    roomAssemblyCalibratedSizeProfile,
    scaleRoomAssemblyBoxByKind,
    roomEditorStageSize,
    roomAssemblyGridSize,
    roomAssemblyBedTopBaselineY,
    roomAssemblyWallArtVisualBounds,
    roomAssemblyWallBufferCells,
    roomAssemblyShopItems,
    roomAssemblyBedTopBaselineMinGridY,
    roomAssemblyVisualFloorLineOffsetCells,
} from './roomAssemblyCatalog.js';
import { toNum } from '../housingFormatting.js';

export function normalizeRoomAssemblyKind(value) {
    const text = String(value || '').trim();
    const compact = text.replace(/[\s_-]+/g, '').toLowerCase();
    const aliases = {
        bed: 'bed',
        床: 'bed',
        nightstand: 'nightstand',
        bedside: 'nightstand',
        bedsidecabinet: 'nightstand',
        床头柜: 'nightstand',
        wardrobe: 'wardrobe',
        closet: 'wardrobe',
        衣柜: 'wardrobe',
        vanity: 'vanity',
        dresser: 'vanity',
        梳妆台: 'vanity',
        bookshelf: 'bookshelf',
        bookcase: 'bookshelf',
        shelf: 'bookshelf',
        书架: 'bookshelf',
        书柜: 'bookshelf',
        sofa: 'sofa',
        couch: 'sofa',
        沙发: 'sofa',
        rug: 'rug',
        carpet: 'rug',
        地毯: 'rug',
        floorlamp: 'floorLamp',
        lamp: 'floorLamp',
        tablelamp: 'floorLamp',
        落地灯: 'floorLamp',
        台灯: 'floorLamp',
        wallart: 'wallArt',
        art: 'wallArt',
        painting: 'wallArt',
        挂画: 'wallArt',
        墙面装饰: 'wallArt',
    };
    const kind = aliases[text] || aliases[text.toLowerCase()] || aliases[compact];
    return roomAssemblyKinds.includes(kind) ? kind : '';
}

export function normalizeRoomAssemblyDirection(value) {
    const text = String(value || '').trim();
    const aliases = {
        front: 'front',
        正面: 'front',
        back: 'back',
        背面: 'back',
        left: 'left',
        左: 'left',
        左侧: 'left',
        right: 'right',
        右: 'right',
        右侧: 'right',
    };
    const direction = aliases[text] || aliases[text.toLowerCase()] || text.toLowerCase();
    return roomAssemblyAllowedDirections.has(direction) ? direction : 'front';
}

export function getRoomAssemblyBaseAssetId(assetId) {
    const value = String(assetId || '').trim();
    const match = value.match(/^room_dir_(.+)_(front|back|left|right)_v1$/);
    return match ? `room_front_${match[1]}_v1` : value;
}

export function getRoomAssemblyShopItemForAsset(assetId) {
    const baseAssetId = getRoomAssemblyBaseAssetId(assetId);
    return roomAssemblyShopByAssetId.get(baseAssetId) || null;
}

export function normalizeRoomAssemblySizeProfile(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { version: roomEditorSizeProfileVersion, kindSizes: {} };
    }
    if (
        value.version !== roomEditorSizeProfileVersion ||
        !value.kindSizes ||
        typeof value.kindSizes !== 'object' ||
        Array.isArray(value.kindSizes)
    ) {
        return { version: roomEditorSizeProfileVersion, kindSizes: {} };
    }
    const kindSizes = Object.entries(value.kindSizes).reduce((profile, [kind, size]) => {
        const safeKind = normalizeRoomAssemblyKind(kind);
        const w = Math.round(toNum(size?.w, 0));
        const h = Math.round(toNum(size?.h, 0));
        if (!roomAssemblyCalibratedSizeProfile[safeKind] || w < 8 || h < 8) return profile;
        profile[safeKind] = {
            w,
            h,
            sourceAssetId: getRoomAssemblyBaseAssetId(size?.sourceAssetId || ''),
            updatedAt: Math.max(0, Math.round(toNum(size?.updatedAt, 0))),
        };
        return profile;
    }, {});
    return { version: roomEditorSizeProfileVersion, kindSizes };
}

export function roomAssemblyDirectionalAssetId(assetId, direction = 'front') {
    const baseAssetId = getRoomAssemblyBaseAssetId(assetId);
    const shopItem = roomAssemblyShopByAssetId.get(baseAssetId);
    const safeDirection = normalizeRoomAssemblyDirection(direction);
    if (!shopItem?.directional || safeDirection === 'front') return baseAssetId;
    const match = baseAssetId.match(/^room_front_(.+)_v1$/);
    return match ? `room_dir_${match[1]}_${safeDirection}_v1` : baseAssetId;
}

export function makeRoomAssemblyItem(assetId, box, suffix, meta = {}) {
    return {
        assetId,
        id: `${assetId}-agency-${suffix}`,
        ...box,
        assemblyKind: meta.kind || meta.assemblyKind || '',
        direction: normalizeRoomAssemblyDirection(meta.direction),
        collision: meta.collision || { enabled: true, x: 0.16, y: 0.68, w: 0.68, h: 0.28 },
        placeAnchor: meta.placeAnchor || { x: 0.5, y: 1 },
        ...(meta.groundLayer ? { groundLayer: true } : {}),
    };
}

export function roomAssemblyAssetId(groupId, direction = 'front') {
    return direction === 'front' ? `room_front_${groupId}_v1` : `room_dir_${groupId}_${direction}_v1`;
}

export function roomAssemblyNightstandSize(direction) {
    return direction === 'left' || direction === 'right' ? { w: 145, h: 220 } : { w: 185, h: 220 };
}

export function roomAssemblyBedSize(direction) {
    return direction === 'left' || direction === 'right' ? { w: 606, h: 370 } : { w: 343, h: 370 };
}

export function getRoomAssemblyGroup(palette, kind) {
    if (kind === 'bed') return palette.bedGroup;
    if (kind === 'nightstand') return palette.nightstandGroup;
    if (kind === 'wardrobe') return palette.wardrobeGroup;
    if (kind === 'vanity') return palette.vanityGroup;
    return '';
}

export function getRoomAssemblyItemSize(palette, kind, direction, sizeProfile = {}) {
    const baseSize =
        kind === 'bed'
            ? roomAssemblyBedSize(direction)
            : kind === 'nightstand'
              ? roomAssemblyNightstandSize(direction)
              : kind === 'wardrobe'
                ? { w: 235, h: 330 }
                : kind === 'vanity'
                  ? { w: palette.vanityW || 273, h: 340 }
                  : { w: 120, h: 120 };
    const scaledBaseSize = scaleRoomAssemblyBoxByKind(baseSize, kind);
    return applyRoomAssemblySizeProfile({ w: scaledBaseSize.w, h: scaledBaseSize.h }, kind, sizeProfile);
}

export function clampRoomAssemblyBox(box, bounds = {}) {
    const w = Math.max(1, Math.round(box.w || 1));
    const h = Math.max(1, Math.round(box.h || 1));
    const minX = toNum(bounds.minX, 24);
    const minY = toNum(bounds.minY, 24);
    const maxXPad = toNum(bounds.maxXPad, 24);
    const maxYPad = toNum(bounds.maxYPad, 24);
    return {
        ...box,
        w,
        h,
        x: Math.max(minX, Math.min(roomEditorStageSize.width - w - maxXPad, Math.round(box.x || minX))),
        y: Math.max(minY, Math.min(roomEditorStageSize.height - h - maxYPad, Math.round(box.y || minY))),
    };
}

export function getRoomAssemblyCellsForBox(box = {}) {
    const cellW = roomEditorStageSize.width / roomAssemblyGridSize.cols;
    const cellH = roomEditorStageSize.height / roomAssemblyGridSize.rows;
    return `${Math.max(1, Math.ceil(toNum(box.w, 1) / cellW))}x${Math.max(1, Math.ceil(toNum(box.h, 1) / cellH))}`;
}

export function getRoomAssemblyGridFootprint(box = {}) {
    const cellW = roomEditorStageSize.width / roomAssemblyGridSize.cols;
    const cellH = roomEditorStageSize.height / roomAssemblyGridSize.rows;
    return {
        cols: Math.max(1, Math.ceil(toNum(box.w, 1) / cellW)),
        rows: Math.max(1, Math.ceil(toNum(box.h, 1) / cellH)),
    };
}

export function getRoomAssemblyVisualOffset(kind, box = {}) {
    const safeKind = normalizeRoomAssemblyKind(kind);
    const cellH = roomEditorStageSize.height / roomAssemblyGridSize.rows;
    if (safeKind === 'wallArt') {
        return { x: 0, y: -Math.round(Math.max(cellH * 0.9, toNum(box.h, 0) * 0.5)) };
    }
    if (safeKind === 'bed') {
        return { x: 0, y: -Math.round(cellH) };
    }
    return { x: 0, y: 0 };
}

export function clampRoomAssemblyVisualBoxByKind(kind, box = {}) {
    const safeKind = normalizeRoomAssemblyKind(kind);
    if (safeKind === 'bed') {
        return {
            ...box,
            y: Math.max(roomAssemblyBedTopBaselineY, Math.round(toNum(box.y, roomAssemblyBedTopBaselineY))),
        };
    }
    if (safeKind !== 'wallArt') return box;
    const h = Math.max(1, toNum(box.h, 1));
    const minY = roomAssemblyWallArtVisualBounds.minY;
    const maxY = roomAssemblyWallArtVisualBounds.maxBottomY - h;
    const y = maxY < minY ? maxY : Math.max(minY, Math.min(maxY, toNum(box.y, minY)));
    return {
        ...box,
        y: Math.round(y),
    };
}

export function getRoomAssemblyGridAxisRange(footprintSize = 1, axisSize = 16, minOverride = null, maxOverride = null) {
    const baseMin = roomAssemblyWallBufferCells;
    const baseMax = Math.max(baseMin, axisSize - roomAssemblyWallBufferCells - Math.max(1, footprintSize));
    const requestedMin = minOverride == null ? baseMin : toNum(minOverride, baseMin);
    const requestedMax = maxOverride == null ? baseMax : toNum(maxOverride, baseMax);
    const min = Math.max(baseMin, Math.round(requestedMin));
    const max = Math.max(min, Math.min(baseMax, Math.round(requestedMax)));
    return { min, max };
}

export function clampRoomAssemblyGridCoordinate(
    value,
    footprintSize = 1,
    axisSize = 16,
    fallback = roomAssemblyWallBufferCells,
    minOverride = null,
    maxOverride = null,
) {
    const { min, max } = getRoomAssemblyGridAxisRange(footprintSize, axisSize, minOverride, maxOverride);
    const num = Math.round(toNum(value, fallback));
    return Math.max(min, Math.min(max, num));
}

export function getRoomAssemblyPlacementGridBounds(kind) {
    if (kind === 'wallArt') return { minY: 2, maxY: 3, fallbackY: 2 };
    if (kind === 'rug') return { minY: 8, fallbackY: 9 };
    if (kind === 'bed') return { minY: 4, fallbackY: 4 };
    return { minY: 4, fallbackY: 4 };
}

export function getRoomAssemblyFurnitureContext(sizeProfile = {}) {
    return roomAssemblyShopItems.map((item) => {
        const profiledBox = applyRoomAssemblySizeProfile(item.box, item.kind, sizeProfile);
        return {
            assetId: item.assetId,
            item: item.kind,
            label: item.name,
            style: item.style,
            price: item.price,
            maxQuantity: item.maxQuantity,
            preferred_dir: item.preferred_dir,
            directional: item.directional,
            cells: {
                front: getRoomAssemblyCellsForBox(profiledBox),
                side: item.directional ? 'directional variant may change width' : undefined,
            },
            size_px: {
                w: profiledBox.w,
                h: profiledBox.h,
            },
            ...(item.kind === 'bed'
                ? {
                      constraints: {
                          top_baseline_y_px: roomAssemblyBedTopBaselineY,
                          min_grid_y: roomAssemblyBedTopBaselineMinGridY,
                      },
                  }
                : {}),
        };
    });
}

export function getRoomAssemblyDirections() {
    return {
        bed: 'front',
        nightstand: 'front',
        wardrobe: 'front',
        vanity: 'front',
    };
}

export function getRoomAssemblyFallbackShopItem(palette, kind) {
    if (kind === 'bed') {
        const bedItem = roomAssemblyShopByAssetId.get(roomAssemblyAssetId(palette.bedGroup, 'front'));
        if (bedItem) return bedItem;
    }
    const style =
        palette.style || roomAssemblyShopByAssetId.get(roomAssemblyAssetId(palette.bedGroup, 'front'))?.style || '';
    return (
        roomAssemblyShopItems.find((item) => item.kind === kind && item.style === style) ||
        roomAssemblyShopItems.find((item) => item.kind === kind) ||
        null
    );
}

export function getRoomAssemblyDirectionFromAssetId(assetId) {
    const match = String(assetId || '').match(/^room_dir_.+_(front|back|left|right)_v1$/);
    return match ? match[1] : '';
}

export function getRoomAssemblyPlacementPriority(kind) {
    const order = {
        bed: 10,
        wardrobe: 20,
        vanity: 30,
        bookshelf: 40,
        sofa: 50,
        nightstand: 60,
        floorLamp: 70,
        wallArt: 80,
        rug: 90,
    };
    return order[kind] || 999;
}

export const roomAssemblySingleInstanceKinds = new Set(['wallArt']);

export const roomAssemblyWallFriendlyKinds = new Set(['bed', 'wardrobe', 'vanity', 'bookshelf', 'sofa']);

export const roomAssemblyNonCollisionKinds = new Set(['rug', 'wallArt']);

export const roomAssemblyWallArtOccluderKinds = new Set(['bed', 'wardrobe', 'vanity', 'bookshelf', 'sofa']);

export function getRoomAssemblyRawGridCoordinate(value, fallback = roomAssemblyWallBufferCells) {
    const num = toNum(value, fallback);
    return Number.isFinite(num) ? num : fallback;
}

export function getRoomAssemblyPlacementKind(placement) {
    const requestedAssetId = String(placement?.assetId || placement?.asset_id || placement?.asset || '').trim();
    const shopItem = requestedAssetId ? getRoomAssemblyShopItemForAsset(requestedAssetId) : null;
    return normalizeRoomAssemblyKind(
        placement?.item || placement?.kind || placement?.category || placement?.id || shopItem?.kind,
    );
}

export function getRoomAssemblyWallPreferenceScore(kind, candidate, xRange, yRange) {
    if (!roomAssemblyWallFriendlyKinds.has(kind)) return 0;
    const sideWallDistance = Math.min(Math.abs(candidate.x - xRange.min), Math.abs(candidate.x - xRange.max));
    const backWallDistance = Math.abs(candidate.y - yRange.min);
    return backWallDistance * 2 + sideWallDistance;
}

export function getRoomAssemblyPlacementCandidates(kind, footprint = {}, requestedX, requestedY) {
    const placementBounds = getRoomAssemblyPlacementGridBounds(kind);
    const xRange = getRoomAssemblyGridAxisRange(footprint.cols, roomAssemblyGridSize.cols);
    const yRange = getRoomAssemblyGridAxisRange(
        footprint.rows,
        roomAssemblyGridSize.rows,
        placementBounds.minY,
        placementBounds.maxY,
    );
    const startX = clampRoomAssemblyGridCoordinate(
        requestedX,
        footprint.cols,
        roomAssemblyGridSize.cols,
        roomAssemblyWallBufferCells,
    );
    const startY = clampRoomAssemblyGridCoordinate(
        requestedY,
        footprint.rows,
        roomAssemblyGridSize.rows,
        placementBounds.fallbackY,
        placementBounds.minY,
        placementBounds.maxY,
    );
    const candidates = [];
    for (let y = yRange.min; y <= yRange.max; y += 1) {
        for (let x = xRange.min; x <= xRange.max; x += 1) {
            const candidate = { x, y, distance: Math.abs(x - startX) + Math.abs(y - startY) };
            candidates.push({
                ...candidate,
                wallScore: getRoomAssemblyWallPreferenceScore(kind, candidate, xRange, yRange),
            });
        }
    }
    return candidates.sort((a, b) => a.distance - b.distance || a.wallScore - b.wallScore || a.y - b.y || a.x - b.x);
}

export function isRoomAssemblyCollisionItem(item = {}) {
    return Boolean(item && !roomAssemblyNonCollisionKinds.has(item.assemblyKind));
}

export function getRoomAssemblyBoxOverlapArea(a, b, padding = 8) {
    if (!a || !b) return 0;
    const left = Math.max(toNum(a.x), toNum(b.x));
    const top = Math.max(toNum(a.y), toNum(b.y));
    const right = Math.min(toNum(a.x) + toNum(a.w), toNum(b.x) + toNum(b.w));
    const bottom = Math.min(toNum(a.y) + toNum(a.h), toNum(b.y) + toNum(b.h));
    const w = right - left;
    const h = bottom - top;
    if (w <= padding || h <= padding) return 0;
    return w * h;
}

export function getRoomAssemblyOverlapArea(a, b, padding = 8) {
    if (!isRoomAssemblyCollisionItem(a) || !isRoomAssemblyCollisionItem(b)) return 0;
    return getRoomAssemblyBoxOverlapArea(a, b, padding);
}

export function getRoomAssemblyOverlapScore(item, existingItems = []) {
    return existingItems.reduce((sum, existing) => sum + getRoomAssemblyOverlapArea(item, existing), 0);
}

export function getRoomAssemblyWallArtCoverageScore(item, existingItems = []) {
    if (!item) return 0;
    return existingItems.reduce((sum, existing) => {
        if (item.assemblyKind === 'wallArt' && roomAssemblyWallArtOccluderKinds.has(existing?.assemblyKind)) {
            return sum + getRoomAssemblyBoxOverlapArea(item, existing, 0);
        }
        if (existing?.assemblyKind === 'wallArt' && roomAssemblyWallArtOccluderKinds.has(item.assemblyKind)) {
            return sum + getRoomAssemblyBoxOverlapArea(item, existing, 0);
        }
        return sum;
    }, 0);
}

export function buildRoomAssemblyResolvedCandidate(item, candidate, existingItems = []) {
    if (!item) return null;
    return {
        item,
        x: candidate?.x ?? 0,
        y: candidate?.y ?? 0,
        distance: candidate?.distance ?? 0,
        wallScore: candidate?.wallScore ?? 0,
        overlapScore: getRoomAssemblyOverlapScore(item, existingItems),
        wallArtScore: getRoomAssemblyWallArtCoverageScore(item, existingItems),
    };
}

export function compareRoomAssemblyResolvedCandidate(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.overlapScore !== b.overlapScore) return a.overlapScore < b.overlapScore ? a : b;
    if (a.wallArtScore !== b.wallArtScore) return a.wallArtScore < b.wallArtScore ? a : b;
    if (a.distance !== b.distance) return a.distance < b.distance ? a : b;
    if (a.wallScore !== b.wallScore) return a.wallScore < b.wallScore ? a : b;
    if (a.y !== b.y) return a.y < b.y ? a : b;
    if (a.x !== b.x) return a.x < b.x ? a : b;
    return a;
}

export function resolveRoomAssemblyPlacementItem(
    palette,
    placement,
    index = 0,
    kind = '',
    existingItems = [],
    sizeProfile = {},
) {
    const baseItem = buildRoomAssemblyItemFromPlacement(palette, placement, index, sizeProfile);
    if (!baseItem) return null;
    const safeKind = normalizeRoomAssemblyKind(kind || baseItem.assemblyKind);
    const footprint = getRoomAssemblyGridFootprint(baseItem);
    const candidates = getRoomAssemblyPlacementCandidates(safeKind, footprint, placement?.x, placement?.y);
    const resolved = candidates.reduce((best, candidate) => {
        const candidateItem = buildRoomAssemblyItemFromPlacement(palette, placement, index, sizeProfile, candidate);
        return compareRoomAssemblyResolvedCandidate(
            best,
            buildRoomAssemblyResolvedCandidate(candidateItem, candidate, existingItems),
        );
    }, null);
    const winner = resolved?.item || baseItem;
    const overlapScore = resolved ? resolved.overlapScore : getRoomAssemblyOverlapScore(winner, existingItems);
    if (overlapScore > 0 && isRoomAssemblyCollisionItem(winner)) return null;
    return winner;
}

export function getRoomAssemblyPlacementFromItem(item = {}) {
    const kind = normalizeRoomAssemblyKind(item.assemblyKind || getRoomAssemblyShopItemForAsset(item.assetId)?.kind);
    const cellW = roomEditorStageSize.width / roomAssemblyGridSize.cols;
    const cellH = roomEditorStageSize.height / roomAssemblyGridSize.rows;
    const visualOffset = getRoomAssemblyVisualOffset(kind, item);
    const visualGridY = (toNum(item.y, 0) - visualOffset.y) / cellH;
    return {
        assetId: getRoomAssemblyBaseAssetId(item.assetId),
        item: kind,
        x: Math.round((toNum(item.x, 0) - visualOffset.x) / cellW),
        y: Math.round(kind === 'wallArt' ? visualGridY : visualGridY + roomAssemblyVisualFloorLineOffsetCells),
        dir: item.direction || 'front',
    };
}

export function resolveRoomAssemblyExistingItem(palette, item, index = 0, existingItems = [], sizeProfile = {}) {
    return resolveRoomAssemblyPlacementItem(
        palette,
        getRoomAssemblyPlacementFromItem(item),
        index,
        item?.assemblyKind,
        existingItems,
        sizeProfile,
    );
}

export function buildRoomAssemblyItemFromPlacement(
    palette,
    placement,
    index = 0,
    sizeProfile = {},
    gridOverride = null,
) {
    const requestedAssetId = String(placement?.assetId || placement?.asset_id || placement?.asset || '').trim();
    const shopItem = requestedAssetId ? getRoomAssemblyShopItemForAsset(requestedAssetId) : null;
    const kind = normalizeRoomAssemblyKind(
        placement?.item || placement?.kind || placement?.category || placement?.id || shopItem?.kind,
    );
    if (!kind) return null;
    const direction = normalizeRoomAssemblyDirection(
        placement?.dir ||
            placement?.direction ||
            placement?.facing ||
            getRoomAssemblyDirectionFromAssetId(requestedAssetId) ||
            shopItem?.preferred_dir,
    );
    const cellW = roomEditorStageSize.width / roomAssemblyGridSize.cols;
    const cellH = roomEditorStageSize.height / roomAssemblyGridSize.rows;
    const placementBox = shopItem
        ? applyRoomAssemblySizeProfile(shopItem.box, shopItem.kind, sizeProfile)
        : getRoomAssemblyItemSize(palette, kind, direction, sizeProfile);
    const footprint = getRoomAssemblyGridFootprint(placementBox);
    const placementBounds = getRoomAssemblyPlacementGridBounds(kind);
    const shouldConstrainGrid = kind === 'wallArt';
    const gridX = shouldConstrainGrid
        ? clampRoomAssemblyGridCoordinate(
              gridOverride?.x ?? placement?.x,
              footprint.cols,
              roomAssemblyGridSize.cols,
              roomAssemblyWallBufferCells,
          )
        : getRoomAssemblyRawGridCoordinate(gridOverride?.x ?? placement?.x, roomAssemblyWallBufferCells);
    const gridY = shouldConstrainGrid
        ? clampRoomAssemblyGridCoordinate(
              gridOverride?.y ?? placement?.y,
              footprint.rows,
              roomAssemblyGridSize.rows,
              placementBounds.fallbackY,
              placementBounds.minY,
              placementBounds.maxY,
          )
        : getRoomAssemblyRawGridCoordinate(gridOverride?.y ?? placement?.y, placementBounds.fallbackY);
    const visualGridY = shouldConstrainGrid ? gridY : gridY - roomAssemblyVisualFloorLineOffsetCells;
    if (shopItem) {
        const assetId = roomAssemblyDirectionalAssetId(shopItem.assetId, direction);
        const visualOffset = getRoomAssemblyVisualOffset(shopItem.kind, placementBox);
        const visualBox = clampRoomAssemblyVisualBoxByKind(shopItem.kind, {
            ...placementBox,
            x: Math.round(gridX * cellW + visualOffset.x),
            y: Math.round(visualGridY * cellH + visualOffset.y),
        });
        return makeRoomAssemblyItem(
            assetId,
            shopItem.kind === 'wallArt'
                ? clampRoomAssemblyBox(visualBox, { minY: roomAssemblyWallArtVisualBounds.minY })
                : visualBox,
            `${shopItem.kind}-${index}-${direction}`,
            {
                kind: shopItem.kind,
                direction,
                collision: shopItem.collision || undefined,
                groundLayer: shopItem.groundLayer,
            },
        );
    }
    const group = getRoomAssemblyGroup(palette, kind);
    if (!group) return null;
    return makeRoomAssemblyItem(
        roomAssemblyAssetId(group, direction),
        clampRoomAssemblyVisualBoxByKind(kind, {
            ...getRoomAssemblyItemSize(palette, kind, direction, sizeProfile),
            x: Math.round(gridX * cellW),
            y: Math.round(visualGridY * cellH),
        }),
        `${kind}-${index}-${direction}`,
        { kind, direction },
    );
}

export function applyRoomAssemblySizeProfile(box = {}, kind = '', sizeProfile = {}) {
    const safeKind = normalizeRoomAssemblyKind(kind);
    const normalizedProfile = normalizeRoomAssemblySizeProfile(sizeProfile);
    const size = safeKind ? normalizedProfile.kindSizes[safeKind] || roomAssemblyCalibratedSizeProfile[safeKind] : null;
    if (!size) return box;
    return {
        ...box,
        w: Math.max(1, Math.round(toNum(size.w, box.w || 1))),
        h: Math.max(1, Math.round(toNum(size.h, box.h || 1))),
    };
}
export function summarizeRoomAssemblyPurchases(items = []) {
    return items.map((item) => {
        const shopItem = getRoomAssemblyShopItemForAsset(item.assetId);
        return {
            assetId: getRoomAssemblyBaseAssetId(item.assetId),
            item: shopItem?.kind || item.assemblyKind || '',
            label: shopItem?.name || item.assetId,
            style: shopItem?.style || '',
            quantity: 1,
            price: toNum(shopItem?.price, 0),
            subtotal: toNum(shopItem?.price, 0),
        };
    });
}
