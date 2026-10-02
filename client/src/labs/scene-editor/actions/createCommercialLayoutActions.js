import {
    createCommercialV2PlayerStates,
    getCommercialV2StageSize,
    canCommercialV2ItemCollisionTakeEffect,
    buildCommercialV2ItemPlace,
    wrapLoopBox,
    clampBox,
    commercialV2SegmentSize,
    getCommercialV2DefaultCollision,
    commercialV2MaxSavedItems,
    serializeCommercialV2Item,
    commercialV2StorageKey,
    commercialV2CanvasStorageKey,
    commercialV2BackgroundColor,
    getCommercialV2Loop,
    commercialV2ResetBackupStorageKey,
    commercialV2DefaultSnapshotStorageKey,
    normalizeCommercialV2LayoutState,
    commercialV2RecoveredLayoutUrl,
    commercialV2RecoveredCanvasUrl,
    getRequiredSegmentCount,
    getDefaultCommercialLayoutState,
    getCommercialV2ItemLayerRank,
    normalizeCommercialV2Collision,
    normalizeCommercialV2PlaceAnchor,
    getPointerStagePoint,
    normalizeSegmentCount,
    commercialV2MaxSegmentCount,
} from '../../../features/city/scene/commercialStreetCore.js';

export function createCommercialLayoutActions({
    canEditLayout,
    commitItems,
    stageSize,
    selectedItem,
    selectedAsset,
    selectedIsBuiltInGroundLayer,
    selectedIsBackgroundSceneryAsset,
    setNotice,
    items,
    segmentCount,
    setSelectedId,
    itemsRef,
    segmentCountRef,
    assetById,
    selectedId,
    setResetBackup,
    commitSegmentCount,
    cancelAutoTravel,
    spawnPlayersOnStage,
    resetBackup,
    layoutJson,
    groupEditMode,
    layoutBounds,
    setShowCollisionLines,
    selectedCollisionLocalBox,
    selectedCollision,
    selectedPlaceAnchorLocalPoint,
    setShowPlaceAnchors,
    selectedPlace,
    stageRef,
    dragRef,
    pendingDragPointRef,
    dragFrameRef,
    pendingLoopScrollRef,
}) {
    function updateItem(id, patch, options = {}) {
        if (!canEditLayout) return;
        commitItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const next = { ...item, ...patch };
                return options.wrapX ? wrapLoopBox(next, stageSize) : clampBox(next, stageSize);
            }),
        );
    }

    function updateSelectedGroundLayer(enabled) {
        if (!selectedItem || !selectedAsset || selectedIsBuiltInGroundLayer) return;
        const patch = enabled
            ? { groundLayer: true, foregroundLayer: undefined }
            : {
                  groundLayer: undefined,
                  foregroundLayer: selectedIsBackgroundSceneryAsset ? true : undefined,
              };
        updateItem(selectedItem.id, patch);
        setNotice(
            enabled
                ? `${selectedAsset.name} 已切到背景层：会在天空上方、地面下方，碰撞箱不再阻挡人物。`
                : `${selectedAsset.name} 已切回普通素材：会在地面上方，按图层和遮挡判断显示。`,
        );
    }

    function addAsset(asset) {
        if (!canEditLayout) return;
        const count = items.filter((item) => item.assetId === asset.id).length + 1;
        const segmentIndex = (count - 1) % segmentCount;
        const localMaxX = Math.max(8, commercialV2SegmentSize.width - asset.box.w - 8);
        const localX = Math.max(8, Math.min((asset.box.x % commercialV2SegmentSize.width) + count * 12, localMaxX));
        const next = {
            assetId: asset.id,
            id: `${asset.id}-${Date.now().toString(36)}-${count}`,
            ...asset.box,
            x: segmentIndex * commercialV2SegmentSize.width + localX,
            y: Math.min(asset.box.y + count * 10, stageSize.height - asset.box.h),
            collision: getCommercialV2DefaultCollision(asset).enabled
                ? getCommercialV2DefaultCollision(asset)
                : undefined,
        };
        commitItems((prev) => [...prev, clampBox(next, stageSize)]);
        setSelectedId(next.id);
    }

    function getLatestLayoutParts() {
        const latestItems = itemsRef.current;
        const latestSegmentCount = segmentCountRef.current;
        const latestStageSize = getCommercialV2StageSize(latestSegmentCount, latestItems);
        return {
            latestItems,
            latestSegmentCount,
            latestStageSize,
        };
    }

    function saveLayout() {
        try {
            const { latestItems, latestSegmentCount, latestStageSize } = getLatestLayoutParts();
            const itemsToSave = latestItems
                .slice(0, commercialV2MaxSavedItems)
                .map((item) => serializeCommercialV2Item(item, assetById.get(item.assetId)));
            localStorage.setItem(commercialV2StorageKey, JSON.stringify(itemsToSave));
            localStorage.setItem(
                commercialV2CanvasStorageKey,
                JSON.stringify({
                    segmentCount: latestSegmentCount,
                    segment: { width: commercialV2SegmentSize.width, height: latestStageSize.height },
                    backgroundColor: commercialV2BackgroundColor,
                    loop: getCommercialV2Loop(latestStageSize),
                }),
            );
            if (itemsToSave.length !== latestItems.length) {
                commitItems(itemsToSave);
                setNotice(`已保存前 ${itemsToSave.length} 个素材，超出部分已裁掉以避免页面卡死。`);
            } else {
                setNotice(`已保存 ${latestSegmentCount} 段纯色横向画布、${latestItems.length} 个素材和碰撞体积。`);
            }
        } catch (error) {
            console.error('[PixelWorld] Failed to save layout:', error);
            setNotice('保存失败：浏览器本地存储不可用或空间不足。');
        }
    }

    function writeResetBackup() {
        try {
            const { latestItems, latestSegmentCount } = getLatestLayoutParts();
            const backupItems = latestItems
                .slice(0, commercialV2MaxSavedItems)
                .map((item) => serializeCommercialV2Item(item, assetById.get(item.assetId)));
            const backup = {
                segmentCount: latestSegmentCount,
                selectedId,
                savedAt: Date.now(),
                items: backupItems,
            };
            localStorage.setItem(commercialV2ResetBackupStorageKey, JSON.stringify(backup));
            setResetBackup(backup);
            return backup;
        } catch (error) {
            console.error('[PixelWorld] Failed to write reset backup:', error);
            return null;
        }
    }

    function buildLayoutSnapshot() {
        const { latestItems, latestSegmentCount } = getLatestLayoutParts();
        return {
            segmentCount: latestSegmentCount,
            selectedId,
            savedAt: Date.now(),
            items: latestItems
                .slice(0, commercialV2MaxSavedItems)
                .map((item) => serializeCommercialV2Item(item, assetById.get(item.assetId))),
        };
    }

    function saveCurrentAsDefaultScene() {
        try {
            const snapshot = buildLayoutSnapshot();
            localStorage.setItem(commercialV2DefaultSnapshotStorageKey, JSON.stringify(snapshot));
            localStorage.setItem(commercialV2StorageKey, JSON.stringify(snapshot.items));
            localStorage.setItem(
                commercialV2CanvasStorageKey,
                JSON.stringify({
                    segmentCount,
                    segment: { width: commercialV2SegmentSize.width, height: stageSize.height },
                    backgroundColor: commercialV2BackgroundColor,
                    loop: getCommercialV2Loop(stageSize),
                }),
            );
            setNotice(
                `已把当前 ${snapshot.items.length} 个素材保存为默认场景；以后“恢复默认”和重新进入都会使用这个快照。`,
            );
        } catch (error) {
            console.error('[PixelWorld] Failed to save default scene snapshot:', error);
            setNotice('保存默认场景失败：浏览器本地存储不可用或空间不足。');
        }
    }

    function applyLayoutSnapshot(snapshot, message = '已恢复上次布局。') {
        if (!snapshot?.items?.length) {
            setNotice('没有找到可恢复的布局备份。');
            return;
        }
        const normalized = normalizeCommercialV2LayoutState(snapshot.items, snapshot.segmentCount);
        if (!normalized?.items?.length) {
            setNotice('找到备份了，但里面没有可用素材。');
            return;
        }
        const nextStageSize = getCommercialV2StageSize(normalized.segmentCount, normalized.items);
        const itemsToSave = normalized.items
            .slice(0, commercialV2MaxSavedItems)
            .map((item) => serializeCommercialV2Item(item, assetById.get(item.assetId)));
        try {
            localStorage.setItem(commercialV2StorageKey, JSON.stringify(itemsToSave));
            localStorage.setItem(
                commercialV2CanvasStorageKey,
                JSON.stringify({
                    segmentCount: normalized.segmentCount,
                    segment: { width: commercialV2SegmentSize.width, height: nextStageSize.height },
                    backgroundColor: commercialV2BackgroundColor,
                    loop: getCommercialV2Loop(nextStageSize),
                }),
            );
        } catch (error) {
            console.error('[PixelWorld] Failed to persist restored layout:', error);
        }
        commitItems(normalized.items);
        commitSegmentCount(normalized.segmentCount);
        setSelectedId(snapshot.selectedId || normalized.items[0]?.id || '');
        cancelAutoTravel();
        spawnPlayersOnStage(createCommercialV2PlayerStates());
        setNotice(message);
    }

    async function restoreResetBackup() {
        if (!canEditLayout) return;
        if (resetBackup?.items?.length) {
            applyLayoutSnapshot(resetBackup, `已恢复误点前的 ${resetBackup.items.length} 个素材。`);
            return;
        }
        try {
            const layoutResponse = await fetch(commercialV2RecoveredLayoutUrl);
            if (!layoutResponse.ok) {
                setNotice('没有找到可恢复的布局备份。');
                return;
            }
            const recoveredItems = await layoutResponse.json();
            let recoveredCanvas = null;
            try {
                const canvasResponse = await fetch(commercialV2RecoveredCanvasUrl);
                if (canvasResponse.ok) recoveredCanvas = await canvasResponse.json();
            } catch {
                recoveredCanvas = null;
            }
            applyLayoutSnapshot(
                {
                    items: recoveredItems,
                    segmentCount: recoveredCanvas?.segmentCount || getRequiredSegmentCount(recoveredItems),
                    selectedId: recoveredItems[0]?.id || '',
                },
                `已从恢复文件找回 ${recoveredItems.length} 个素材。`,
            );
        } catch (error) {
            console.error('[PixelWorld] Failed to restore recovered layout:', error);
            setNotice('恢复失败：没读到可用的备份文件。');
        }
    }

    function resetLayout() {
        if (!canEditLayout) return;
        writeResetBackup();
        const defaultLayout = getDefaultCommercialLayoutState();
        const defaultItems = defaultLayout.items;
        const defaultSegmentCount = defaultLayout.segmentCount || getRequiredSegmentCount(defaultItems);
        commitItems(defaultItems);
        commitSegmentCount(defaultSegmentCount);
        setSelectedId(defaultLayout.selectedId || defaultItems[0]?.id || '');
        cancelAutoTravel();
        spawnPlayersOnStage(createCommercialV2PlayerStates());
        localStorage.removeItem(commercialV2StorageKey);
        localStorage.removeItem(commercialV2CanvasStorageKey);
        setNotice(
            defaultLayout.savedAt
                ? '已恢复为你保存的默认场景；误点的话可以点“恢复上次布局”。'
                : '已恢复为内置默认素材摆放；误点的话可以点“恢复上次布局”。',
        );
    }

    async function copyLayout() {
        try {
            await navigator.clipboard.writeText(layoutJson);
            setNotice('布局 JSON 已复制，可以直接发给我。');
        } catch {
            setNotice('复制失败，但下方 JSON 可以手动选中。');
        }
    }

    function deleteSelected() {
        if (!canEditLayout || !selectedId) return;
        commitItems((prev) => prev.filter((item) => item.id !== selectedId));
        setSelectedId('');
    }

    function moveGroup(dx, dy) {
        if (!canEditLayout) return;
        commitItems((prev) =>
            prev.map((item) =>
                clampBox(
                    {
                        ...item,
                        x: item.x + dx,
                        y: item.y + dy,
                    },
                    stageSize,
                ),
            ),
        );
    }

    function getLayerRankForItem(item) {
        return getCommercialV2ItemLayerRank(item, assetById.get(item.assetId));
    }

    function getLayerEdgeInsertIndex(items, rank, edge) {
        if (edge === 'back') {
            const sameIndex = items.findIndex((item) => getLayerRankForItem(item) === rank);
            if (sameIndex >= 0) return sameIndex;
            const greaterIndex = items.findIndex((item) => getLayerRankForItem(item) > rank);
            return greaterIndex >= 0 ? greaterIndex : items.length;
        }
        let lastSameOrLowerIndex = -1;
        items.forEach((item, index) => {
            if (getLayerRankForItem(item) <= rank) lastSameOrLowerIndex = index;
        });
        return lastSameOrLowerIndex + 1;
    }

    function moveSelectedToLayerEdge(edge) {
        if (!canEditLayout || !selectedId) return;
        commitItems((prev) => {
            const index = prev.findIndex((item) => item.id === selectedId);
            if (index < 0) return prev;
            const selected = prev[index];
            const rank = getLayerRankForItem(selected);
            const next = prev.slice();
            next.splice(index, 1);
            const insertIndex = getLayerEdgeInsertIndex(next, rank, edge);
            next.splice(insertIndex, 0, selected);
            return next;
        });
    }

    function bringSelectedToFront() {
        moveSelectedToLayerEdge('front');
    }

    function sendSelectedToBack() {
        moveSelectedToLayerEdge('back');
    }

    function moveSelectedLayer(direction) {
        if (!canEditLayout || !selectedId) return;
        commitItems((prev) => {
            const index = prev.findIndex((item) => item.id === selectedId);
            if (index < 0) return prev;
            const selected = prev[index];
            const rank = getLayerRankForItem(selected);
            let targetIndex = -1;
            if (direction === 'up') {
                for (let i = index + 1; i < prev.length; i += 1) {
                    if (getLayerRankForItem(prev[i]) === rank) {
                        targetIndex = i;
                        break;
                    }
                }
            } else {
                for (let i = index - 1; i >= 0; i -= 1) {
                    if (getLayerRankForItem(prev[i]) === rank) {
                        targetIndex = i;
                        break;
                    }
                }
            }
            if (targetIndex < 0) return prev;
            const targetId = prev[targetIndex].id;
            const next = prev.slice();
            const [item] = next.splice(index, 1);
            const targetNextIndex = next.findIndex((candidate) => candidate.id === targetId);
            if (targetNextIndex < 0) return prev;
            next.splice(direction === 'up' ? targetNextIndex + 1 : targetNextIndex, 0, item);
            return next;
        });
    }

    function scaleSelected(multiplier) {
        if (!canEditLayout) return;
        if (groupEditMode) {
            scaleGroup(multiplier);
            return;
        }
        if (!selectedItem) return;
        const nextW = selectedItem.w * multiplier;
        const nextH = selectedItem.h * multiplier;
        updateItem(selectedItem.id, {
            x: selectedItem.x - (nextW - selectedItem.w) / 2,
            y: selectedItem.y - (nextH - selectedItem.h),
            w: nextW,
            h: nextH,
        });
    }

    function scaleGroup(multiplier) {
        if (!canEditLayout) return;
        if (!layoutBounds) return;
        const originX = (layoutBounds.minX + layoutBounds.maxX) / 2;
        const originY = layoutBounds.maxY;
        commitItems((prev) =>
            prev.map((item) =>
                clampBox(
                    {
                        ...item,
                        x: originX + (item.x - originX) * multiplier,
                        y: originY + (item.y - originY) * multiplier,
                        w: item.w * multiplier,
                        h: item.h * multiplier,
                    },
                    stageSize,
                ),
            ),
        );
    }

    function nudgeSelected(dx, dy) {
        if (!canEditLayout) return;
        if (groupEditMode) {
            moveGroup(dx, dy);
            return;
        }
        if (!selectedItem) return;
        updateItem(selectedItem.id, { x: selectedItem.x + dx, y: selectedItem.y + dy }, { wrapX: true });
    }

    function updateSelectedCollisionEnabled(enabled) {
        if (!canEditLayout) return;
        if (!selectedItem || !selectedAsset) return;
        if (!canCommercialV2ItemCollisionTakeEffect(selectedItem, selectedAsset)) {
            setShowCollisionLines(true);
            setNotice('地面层规则已生效：这个实例的碰撞箱不会阻挡人物。');
            return;
        }
        setShowCollisionLines(true);
        updateItem(selectedItem.id, {
            collision: {
                ...normalizeCommercialV2Collision(selectedItem.collision, selectedAsset),
                enabled,
            },
        });
    }

    function updateSelectedCollisionLocalBox(key, value) {
        if (!canEditLayout) return;
        if (!selectedItem || !selectedAsset || !selectedCollisionLocalBox) return;
        if (!canCommercialV2ItemCollisionTakeEffect(selectedItem, selectedAsset)) {
            setShowCollisionLines(true);
            setNotice('地面层规则已生效：这个实例的碰撞箱不会阻挡人物。');
            return;
        }
        setShowCollisionLines(true);
        const pixelValue = Math.round(Number(value) || 0);
        const nextLocalBox = {
            ...selectedCollisionLocalBox,
            [key]: pixelValue,
        };
        updateItem(selectedItem.id, {
            collision: normalizeCommercialV2Collision(
                {
                    enabled: selectedCollision?.enabled ?? true,
                    x: nextLocalBox.x / selectedItem.w,
                    y: nextLocalBox.y / selectedItem.h,
                    w: nextLocalBox.w / selectedItem.w,
                    h: nextLocalBox.h / selectedItem.h,
                },
                selectedAsset,
            ),
        });
    }

    function updateCollisionFromLocalBox(item, asset, localBox) {
        if (!canCommercialV2ItemCollisionTakeEffect(item, asset)) {
            setNotice('地面层规则已生效：这个实例的碰撞箱不会阻挡人物。');
            return;
        }
        const safeLocalBox = {
            x: Number.isFinite(localBox.x) ? localBox.x : 0,
            y: Number.isFinite(localBox.y) ? localBox.y : 0,
            w: Math.max(2, Number.isFinite(localBox.w) ? localBox.w : 2),
            h: Math.max(2, Number.isFinite(localBox.h) ? localBox.h : 2),
        };
        updateItem(item.id, {
            collision: normalizeCommercialV2Collision(
                {
                    enabled: true,
                    x: safeLocalBox.x / item.w,
                    y: safeLocalBox.y / item.h,
                    w: safeLocalBox.w / item.w,
                    h: safeLocalBox.h / item.h,
                },
                asset,
            ),
        });
    }

    function resetSelectedCollision() {
        if (!canEditLayout) return;
        if (!selectedItem || !selectedAsset) return;
        if (!canCommercialV2ItemCollisionTakeEffect(selectedItem, selectedAsset)) {
            setShowCollisionLines(true);
            setNotice('地面层规则已生效：这个实例的碰撞箱不会阻挡人物。');
            return;
        }
        setShowCollisionLines(true);
        updateItem(selectedItem.id, {
            collision: getCommercialV2DefaultCollision(selectedAsset),
        });
    }

    function fitSelectedCollisionToSprite() {
        if (!canEditLayout) return;
        if (!selectedItem || !selectedAsset) return;
        if (!canCommercialV2ItemCollisionTakeEffect(selectedItem, selectedAsset)) {
            setShowCollisionLines(true);
            setNotice('地面层规则已生效：这个实例的碰撞箱不会阻挡人物。');
            return;
        }
        setShowCollisionLines(true);
        updateItem(selectedItem.id, {
            collision: normalizeCommercialV2Collision({ enabled: true, x: 0, y: 0, w: 1, h: 1 }, selectedAsset),
        });
    }

    function updatePlaceAnchorFromLocalPoint(item, localPoint) {
        if (!item?.w || !item?.h) return;
        const safeLocalPoint = {
            x: Number.isFinite(localPoint.x) ? localPoint.x : 0,
            y: Number.isFinite(localPoint.y) ? localPoint.y : 0,
        };
        updateItem(item.id, {
            placeAnchor: normalizeCommercialV2PlaceAnchor({
                x: safeLocalPoint.x / item.w,
                y: safeLocalPoint.y / item.h,
            }),
        });
    }

    function updateSelectedPlaceAnchorLocalPoint(key, value) {
        if (!canEditLayout) return;
        if (!selectedItem || !selectedPlaceAnchorLocalPoint) return;
        setShowPlaceAnchors(true);
        const pixelValue = Math.round(Number(value) || 0);
        updatePlaceAnchorFromLocalPoint(selectedItem, {
            ...selectedPlaceAnchorLocalPoint,
            [key]: pixelValue,
        });
    }

    function resetSelectedPlaceAnchor() {
        if (!canEditLayout) return;
        if (!selectedItem || !selectedPlace) return;
        setShowPlaceAnchors(true);
        updateItem(selectedItem.id, { placeAnchor: undefined });
    }

    function onCollisionPointerDown(event, item, asset, visualOffset, handle = 'move') {
        if (!canEditLayout || groupEditMode) return;
        if (!canCommercialV2ItemCollisionTakeEffect(item, asset)) return;
        event.preventDefault();
        event.stopPropagation();
        const stage = event.currentTarget.closest('.pixel-world-editor-stage') || stageRef.current;
        if (!stage) return;
        const collision = normalizeCommercialV2Collision(item.collision, asset);
        if (!collision.enabled) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const startPoint = getPointerStagePoint(event, stage, stageSize);
        const startLocalBox = {
            x: collision.x * item.w,
            y: collision.y * item.h,
            w: collision.w * item.w,
            h: collision.h * item.h,
        };
        dragRef.current = {
            id: item.id,
            mode: 'collision',
            stage,
            visualOffset,
            handle,
            startPoint,
            startItem: item,
            startAsset: asset,
            startLocalBox,
        };
        setSelectedId(item.id);
        setShowCollisionLines(true);
    }

    function onPlaceAnchorPointerDown(event, item, asset, visualOffset = 0) {
        if (!canEditLayout || groupEditMode) return;
        event.preventDefault();
        event.stopPropagation();
        const stage = event.currentTarget.closest('.pixel-world-editor-stage') || stageRef.current;
        if (!stage) return;
        const place = buildCommercialV2ItemPlace(item, asset);
        if (!place) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const startPoint = getPointerStagePoint(event, stage, stageSize);
        dragRef.current = {
            id: item.id,
            mode: 'place-anchor',
            stage,
            visualOffset,
            startPoint,
            startItem: item,
            startLocalPoint: {
                x: place.anchor.x - item.x,
                y: place.anchor.y - item.y,
            },
        };
        setSelectedId(item.id);
        setShowPlaceAnchors(true);
    }

    function onPointerDown(event, item, visualOffset = 0) {
        if (!canEditLayout) {
            event.preventDefault();
            return;
        }
        const stage = event.currentTarget.closest('.pixel-world-editor-stage') || stageRef.current;
        if (!stage) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const point = getPointerStagePoint(event, stage, stageSize);
        dragRef.current = {
            id: item.id,
            mode: groupEditMode ? 'group' : 'single',
            stage,
            visualOffset,
            dx: point.x - (item.x + visualOffset),
            dy: point.y - item.y,
            startPoint: point,
            startItems: items,
        };
        setSelectedId(item.id);
    }

    function applyDragPoint(point) {
        const drag = dragRef.current;
        if (!drag) return;
        if (drag.mode === 'collision') {
            const deltaX = point.x - drag.startPoint.x;
            const deltaY = point.y - drag.startPoint.y;
            const start = drag.startLocalBox;
            const minSize = Math.max(4, Math.min(drag.startItem.w, drag.startItem.h) * 0.03);
            let nextX = start.x;
            let nextY = start.y;
            let nextW = start.w;
            let nextH = start.h;
            if (drag.handle === 'move') {
                nextX = start.x + deltaX;
                nextY = start.y + deltaY;
            } else {
                if (drag.handle.includes('w')) {
                    nextX = start.x + deltaX;
                    nextW = start.w - deltaX;
                }
                if (drag.handle.includes('e')) {
                    nextW = start.w + deltaX;
                }
                if (drag.handle.includes('n')) {
                    nextY = start.y + deltaY;
                    nextH = start.h - deltaY;
                }
                if (drag.handle.includes('s')) {
                    nextH = start.h + deltaY;
                }
            }
            if (nextW < minSize) {
                if (drag.handle.includes('w')) nextX -= minSize - nextW;
                nextW = minSize;
            }
            if (nextH < minSize) {
                if (drag.handle.includes('n')) nextY -= minSize - nextH;
                nextH = minSize;
            }
            updateCollisionFromLocalBox(drag.startItem, drag.startAsset, {
                x: nextX,
                y: nextY,
                w: nextW,
                h: nextH,
            });
            return;
        }
        if (drag.mode === 'place-anchor') {
            const deltaX = point.x - drag.startPoint.x;
            const deltaY = point.y - drag.startPoint.y;
            updatePlaceAnchorFromLocalPoint(drag.startItem, {
                x: drag.startLocalPoint.x + deltaX,
                y: drag.startLocalPoint.y + deltaY,
            });
            return;
        }
        if (drag.mode === 'group') {
            const deltaX = point.x - drag.startPoint.x;
            const deltaY = point.y - drag.startPoint.y;
            commitItems(
                drag.startItems.map((item) =>
                    clampBox(
                        {
                            ...item,
                            x: item.x + deltaX,
                            y: item.y + deltaY,
                        },
                        stageSize,
                    ),
                ),
            );
            return;
        }
        updateItem(drag.id, { x: point.x - drag.dx - (drag.visualOffset || 0), y: point.y - drag.dy }, { wrapX: true });
    }

    function onPointerMove(event) {
        const drag = dragRef.current;
        const stage = drag?.stage || stageRef.current;
        if (!drag || !stage) return;
        pendingDragPointRef.current = getPointerStagePoint(event, stage, stageSize);
        if (dragFrameRef.current) return;
        dragFrameRef.current = requestAnimationFrame(() => {
            dragFrameRef.current = null;
            if (!pendingDragPointRef.current) return;
            applyDragPoint(pendingDragPointRef.current);
        });
    }

    function onPointerUp(event) {
        const stage = dragRef.current?.stage || stageRef.current;
        if (dragRef.current && stage && event?.clientX !== undefined) {
            pendingDragPointRef.current = getPointerStagePoint(event, stage, stageSize);
            applyDragPoint(pendingDragPointRef.current);
        }
        if (dragFrameRef.current) {
            cancelAnimationFrame(dragFrameRef.current);
            dragFrameRef.current = null;
        }
        pendingDragPointRef.current = null;
        dragRef.current = null;
    }

    function appendCanvasSegment() {
        if (!canEditLayout) return;
        const nextSegmentCount = normalizeSegmentCount(segmentCount + 1);
        if (nextSegmentCount === segmentCount) {
            setNotice(`已经到 ${commercialV2MaxSegmentCount} 段，先别把页面撑成宇宙。`);
            return;
        }
        commitSegmentCount(nextSegmentCount);
        setNotice(`已在尾部追加 ${commercialV2SegmentSize.width}px 纯色背景，当前 ${nextSegmentCount} 段。`);
        pendingLoopScrollRef.current = 'rightEdge';
    }

    function prependCanvasSegment() {
        if (!canEditLayout) return;
        const nextSegmentCount = normalizeSegmentCount(segmentCount + 1);
        if (nextSegmentCount === segmentCount) {
            setNotice(`已经到 ${commercialV2MaxSegmentCount} 段，先别把页面撑成宇宙。`);
            return;
        }
        const shiftedItems = items.map((item) => ({
            ...item,
            x: item.x + commercialV2SegmentSize.width,
        }));
        const nextStageSize = getCommercialV2StageSize(nextSegmentCount, shiftedItems);
        commitSegmentCount(nextSegmentCount);
        commitItems(shiftedItems.map((item) => clampBox(item, nextStageSize)));
        setNotice(`已在左边追加 ${commercialV2SegmentSize.width}px 纯色背景，当前 ${nextSegmentCount} 段。`);
        pendingLoopScrollRef.current = 'leftEdge';
    }

    function removeCanvasSegment() {
        if (!canEditLayout) return;
        const requiredSegmentCount = getRequiredSegmentCount(items);
        if (segmentCount <= requiredSegmentCount) {
            setNotice('尾部这一段已经被素材占用，先把尾部素材移回来再收回。');
            return;
        }
        const nextSegmentCount = normalizeSegmentCount(segmentCount - 1);
        if (nextSegmentCount === segmentCount) return;
        const nextStageSize = getCommercialV2StageSize(nextSegmentCount, items);
        commitSegmentCount(nextSegmentCount);
        commitItems((prev) => prev.map((item) => clampBox(item, nextStageSize)));
        setNotice(`已收回 1 段，当前 ${nextSegmentCount} 段。`);
    }

    return {
        updateSelectedGroundLayer,
        updateSelectedPlaceAnchorLocalPoint,
        resetSelectedPlaceAnchor,
        updateItem,
        nudgeSelected,
        scaleSelected,
        updateSelectedCollisionEnabled,
        updateSelectedCollisionLocalBox,
        resetSelectedCollision,
        fitSelectedCollisionToSprite,
        onPointerDown,
        onCollisionPointerDown,
        onPlaceAnchorPointerDown,
        onPointerMove,
        onPointerUp,
        addAsset,
        saveLayout,
        saveCurrentAsDefaultScene,
        copyLayout,
        prependCanvasSegment,
        appendCanvasSegment,
        removeCanvasSegment,
        restoreResetBackup,
        resetLayout,
        moveSelectedLayer,
        bringSelectedToFront,
        sendSelectedToBack,
        deleteSelected,
    };
}
