import {
    buildRoomEditorItemAnchor,
    normalizeRoomEditorItemAspect,
    roomEditorMaxSavedItems,
    normalizeRoomEditorPlayersSnapshot,
    roomEditorFurnitureScaleVersion,
    normalizeRoomEditorLayoutState,
    updateStoredRoomEditorItemSizes,
    applyRoomEditorKindSizeToItems,
    getRoomEditorDefaultCollision,
    getRoomEditorItemSizeKind,
    getRoomEditorCanonicalItemSize,
    resizeRoomEditorItemByKindSize,
    roomEditorBackgroundColor,
    roomEditorBackdrop,
    buildRoomEditorAiLayout,
    serializeRoomEditorPlayers,
    createRoomEditorBehaviorTreeSnapshot,
    serializeRoomEditorItem,
    buildRoomEditorSizeProfile,
    roomEditorStorageKey,
    roomEditorPlayerStorageKey,
    roomEditorCanvasStorageKey,
    roomEditorResetBackupStorageKey,
    roomEditorDefaultSnapshotStorageKey,
    getRoomEditorDefaultState,
    roomEditorDirectionLabels,
    roomEditorDirectionOrder,
} from '../../../features/city/scene/roomEditorCore.js';
import {
    canCommercialV2ItemCollisionTakeEffect,
    clampBox,
    normalizeCommercialV2Collision,
    normalizeCommercialV2PlaceAnchor,
    getPointerStagePoint,
} from '../../../features/city/scene/commercialStreetCore.js';

export function createRoomLayoutActions({
    canEditLayout,
    commitItems,
    assetById,
    stageSize,
    items,
    setSelectedId,
    setNotice,
    itemsRef,
    playersRef,
    controlledPlayerIdRef,
    playerScaleRef,
    behaviorTreeStateRef,
    behaviorTreeState,
    selectedId,
    setResetBackup,
    queuePlayersRender,
    setControlledPlayerIdState,
    setPlayerScaleState,
    resetBackup,
    buildRoomLayoutJson,
    aiLayout,
    groupEditMode,
    selectedItem,
    layoutBounds,
    canRotateSelected,
    selectedAsset,
    selectedDirectionGroup,
    selectedDirection,
    selectedCollisionCanTakeEffect,
    setShowCollisionLines,
    selectedCollisionLocalBox,
    selectedCollision,
    selectedPlaceAnchorLocalPoint,
    setShowPlaceAnchors,
    stageRef,
    dragRef,
    pendingDragPointRef,
    dragFrameRef,
}) {
    function updateItem(id, patch) {
        if (!canEditLayout) return;
        const changesSize =
            Object.prototype.hasOwnProperty.call(patch || {}, 'w') ||
            Object.prototype.hasOwnProperty.call(patch || {}, 'h');
        commitItems((prev) => {
            let changedItem = null;
            const nextItems = prev.map((item) => {
                if (item.id !== id) return item;
                const nextItem = { ...item, ...patch };
                const asset = assetById.get(nextItem.assetId || item.assetId);
                changedItem = clampBox(normalizeRoomEditorItemAspect(nextItem, asset), stageSize);
                return changedItem;
            });
            if (!changesSize || !changedItem) return nextItems;
            updateStoredRoomEditorItemSizes([changedItem], assetById);
            return applyRoomEditorKindSizeToItems(nextItems, assetById, changedItem);
        });
    }

    function addAsset(asset) {
        if (!canEditLayout || !asset) return;
        const count = items.filter((item) => item.assetId === asset.id).length + 1;
        const baseBox = asset.box || { w: 120, h: 120 };
        const w = Math.max(8, Math.round(Number(baseBox.w || 120)));
        const h = Math.max(8, Math.round(Number(baseBox.h || 120)));
        let next = {
            assetId: asset.id,
            id: `${asset.id}-${Date.now().toString(36)}-${count}`,
            x: Math.round(Number.isFinite(Number(baseBox.x)) ? Number(baseBox.x) : (stageSize.width - w) / 2),
            y: Math.round(Number.isFinite(Number(baseBox.y)) ? Number(baseBox.y) : (stageSize.height - h) / 2),
            w,
            h,
            collision: getRoomEditorDefaultCollision(asset),
            groundLayer: asset.groundLayer === true ? true : undefined,
        };
        const kind = getRoomEditorItemSizeKind(next, asset);
        const size = getRoomEditorCanonicalItemSize(next, asset);
        if (size) next = resizeRoomEditorItemByKindSize(next, size, kind);
        commitItems((prev) => [...prev, clampBox(normalizeRoomEditorItemAspect(next, asset), stageSize)]);
        setSelectedId(next.id);
        setNotice(`${asset.name} 已加入房间画布。`);
    }

    function getLatestLayoutParts() {
        return {
            latestItems: itemsRef.current,
            latestPlayers: playersRef.current,
            latestControlledPlayerId: controlledPlayerIdRef.current,
            latestPlayerScale: playerScaleRef.current,
            latestStageSize: stageSize,
        };
    }

    function buildCanvasSnapshot() {
        const { latestItems, latestPlayers, latestControlledPlayerId, latestPlayerScale, latestStageSize } =
            getLatestLayoutParts();
        return {
            stage: stageSize,
            background: {
                type: 'room-backdrop',
                color: roomEditorBackgroundColor,
                image: roomEditorBackdrop,
            },
            collision: {
                unit: 'ratio-of-item-box',
                mode: 'active',
                groundLayer: 'ignored',
            },
            aiLayout: buildRoomEditorAiLayout(latestItems, assetById, latestStageSize),
            players: serializeRoomEditorPlayers(latestPlayers, latestControlledPlayerId, latestPlayerScale),
            behaviorTree: {
                ...createRoomEditorBehaviorTreeSnapshot(
                    latestItems,
                    assetById,
                    latestPlayers,
                    latestControlledPlayerId,
                    latestPlayerScale,
                    latestStageSize,
                ),
                runtime_tree: behaviorTreeStateRef.current || behaviorTreeState,
            },
        };
    }

    function buildLayoutSnapshot() {
        const { latestItems, latestPlayers, latestControlledPlayerId, latestPlayerScale } = getLatestLayoutParts();
        const serializedItems = latestItems
            .slice(0, roomEditorMaxSavedItems)
            .map((item) => serializeRoomEditorItem(item, assetById.get(item.assetId)));
        return {
            selectedId,
            savedAt: Date.now(),
            furnitureScaleVersion: roomEditorFurnitureScaleVersion,
            players: serializeRoomEditorPlayers(latestPlayers, latestControlledPlayerId, latestPlayerScale),
            sizeProfile: buildRoomEditorSizeProfile(serializedItems, assetById),
            items: serializedItems,
        };
    }

    function saveLayout() {
        try {
            const snapshot = buildLayoutSnapshot();
            localStorage.setItem(roomEditorStorageKey, JSON.stringify(snapshot));
            localStorage.setItem(roomEditorPlayerStorageKey, JSON.stringify(snapshot.players));
            localStorage.setItem(roomEditorCanvasStorageKey, JSON.stringify(buildCanvasSnapshot()));
            setNotice(`已保存房间画布、${snapshot.items.length} 个素材、2 个小人、碰撞箱和锚点。`);
        } catch (error) {
            console.error('[PixelWorld] Failed to save room layout:', error);
            setNotice('保存失败：浏览器本地存储不可用或空间不足。');
        }
    }

    function writeResetBackup() {
        try {
            const backup = buildLayoutSnapshot();
            localStorage.setItem(roomEditorResetBackupStorageKey, JSON.stringify(backup));
            setResetBackup(backup);
            return backup;
        } catch (error) {
            console.error('[PixelWorld] Failed to write room reset backup:', error);
            return null;
        }
    }

    function saveCurrentAsDefaultScene() {
        try {
            const snapshot = buildLayoutSnapshot();
            localStorage.setItem(roomEditorDefaultSnapshotStorageKey, JSON.stringify(snapshot));
            localStorage.setItem(roomEditorStorageKey, JSON.stringify(snapshot));
            localStorage.setItem(roomEditorPlayerStorageKey, JSON.stringify(snapshot.players));
            localStorage.setItem(roomEditorCanvasStorageKey, JSON.stringify(buildCanvasSnapshot()));
            setNotice(`已把当前 ${snapshot.items.length} 个房间素材和小人状态保存为默认场景。`);
        } catch (error) {
            console.error('[PixelWorld] Failed to save room default scene snapshot:', error);
            setNotice('保存默认场景失败：浏览器本地存储不可用或空间不足。');
        }
    }

    function applyLayoutSnapshot(snapshot, message = '已恢复上次房间布局。') {
        const preserveSnapshotItemSizes =
            String(snapshot?.furnitureScaleVersion || '') === roomEditorFurnitureScaleVersion;
        const normalized = normalizeRoomEditorLayoutState(snapshot?.items || [], {
            applyCanonicalSizes: !preserveSnapshotItemSizes,
            migrateAssetBoxes: !preserveSnapshotItemSizes,
        });
        if (!normalized) {
            setNotice('找到备份了，但里面没有可用的房间素材。');
            return;
        }
        try {
            const itemsToSave = normalized.items.map((item) =>
                serializeRoomEditorItem(item, assetById.get(item.assetId)),
            );
            localStorage.setItem(
                roomEditorStorageKey,
                JSON.stringify({
                    selectedId: String(snapshot?.selectedId || normalized.items[0]?.id || ''),
                    savedAt: Date.now(),
                    furnitureScaleVersion: roomEditorFurnitureScaleVersion,
                    sizeProfile: buildRoomEditorSizeProfile(itemsToSave, assetById),
                    items: itemsToSave,
                }),
            );
            if (snapshot?.players) {
                const nextPlayers = normalizeRoomEditorPlayersSnapshot(snapshot.players);
                playersRef.current = nextPlayers.players;
                controlledPlayerIdRef.current = nextPlayers.controlledPlayerId;
                playerScaleRef.current = nextPlayers.scale;
                queuePlayersRender(nextPlayers.players, { immediate: true });
                setControlledPlayerIdState(nextPlayers.controlledPlayerId);
                setPlayerScaleState(nextPlayers.scale);
                localStorage.setItem(
                    roomEditorPlayerStorageKey,
                    JSON.stringify(
                        serializeRoomEditorPlayers(
                            nextPlayers.players,
                            nextPlayers.controlledPlayerId,
                            nextPlayers.scale,
                        ),
                    ),
                );
            }
            localStorage.setItem(roomEditorCanvasStorageKey, JSON.stringify(buildCanvasSnapshot()));
        } catch (error) {
            console.error('[PixelWorld] Failed to persist restored room layout:', error);
        }
        commitItems(normalized.items);
        setSelectedId(snapshot?.selectedId || normalized.items[0]?.id || '');
        setNotice(message);
    }

    function restoreResetBackup() {
        if (!canEditLayout) return;
        if (resetBackup) {
            applyLayoutSnapshot(resetBackup, `已恢复误点前的 ${resetBackup.items.length} 个房间素材。`);
            return;
        }
        setNotice('没有找到可恢复的房间布局备份。');
    }

    function resetLayout() {
        if (!canEditLayout) return;
        writeResetBackup();
        const defaultLayout = getRoomEditorDefaultState();
        const defaultPlayers = normalizeRoomEditorPlayersSnapshot(null);
        commitItems(defaultLayout.items);
        playersRef.current = defaultPlayers.players;
        controlledPlayerIdRef.current = defaultPlayers.controlledPlayerId;
        playerScaleRef.current = defaultPlayers.scale;
        queuePlayersRender(defaultPlayers.players, { immediate: true });
        setControlledPlayerIdState(defaultPlayers.controlledPlayerId);
        setPlayerScaleState(defaultPlayers.scale);
        setSelectedId(defaultLayout.selectedId || defaultLayout.items[0]?.id || '');
        localStorage.removeItem(roomEditorStorageKey);
        localStorage.removeItem(roomEditorPlayerStorageKey);
        localStorage.removeItem(roomEditorCanvasStorageKey);
        setNotice(
            defaultLayout.savedAt
                ? '已恢复为你保存的房间默认场景，小人也回到房间初始点；误点的话可以点“恢复上次布局”。'
                : '已恢复为空房间素材层，小人回到房间初始点；小屋底图会保留为画布背景。',
        );
    }

    async function copyLayout() {
        try {
            await navigator.clipboard.writeText(buildRoomLayoutJson());
            setNotice('房间布局 JSON 已复制，可以直接发给我。');
        } catch {
            setNotice('复制失败，但右侧 JSON 可以手动选中。');
        }
    }

    async function copyAiLayout() {
        try {
            await navigator.clipboard.writeText(aiLayout.prompt);
            setNotice('AI 布局上下文已复制：里面包含房间 ASCII 和当前物件格子尺寸。');
        } catch {
            setNotice('复制失败，但右侧 AI 布局上下文可以手动选中。');
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

    function bringSelectedToFront() {
        if (!canEditLayout || !selectedId) return;
        commitItems((prev) => {
            const selected = prev.find((item) => item.id === selectedId);
            if (!selected) return prev;
            return [...prev.filter((item) => item.id !== selectedId), selected];
        });
    }

    function sendSelectedToBack() {
        if (!canEditLayout || !selectedId) return;
        commitItems((prev) => {
            const index = prev.findIndex((item) => item.id === selectedId);
            if (index <= 0) return prev;
            const next = prev.slice();
            const [selected] = next.splice(index, 1);
            next.unshift(selected);
            return next;
        });
    }

    function moveSelectedLayer(direction) {
        if (!canEditLayout || !selectedId) return;
        commitItems((prev) => {
            const index = prev.findIndex((item) => item.id === selectedId);
            if (index < 0) return prev;
            const nextIndex = direction === 'up' ? Math.min(prev.length - 1, index + 1) : Math.max(0, index - 1);
            if (nextIndex === index) return prev;
            const next = prev.slice();
            const [item] = next.splice(index, 1);
            next.splice(nextIndex, 0, item);
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
        if (!canEditLayout || !layoutBounds) return;
        const originX = (layoutBounds.minX + layoutBounds.maxX) / 2;
        const originY = layoutBounds.maxY;
        commitItems((prev) => {
            const scaledItems = prev.map((item) =>
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
            );
            const sizeProfile = updateStoredRoomEditorItemSizes(scaledItems, assetById);
            return scaledItems.map((item) => {
                const asset = assetById.get(item.assetId);
                const kind = getRoomEditorItemSizeKind(item, asset);
                const size = getRoomEditorCanonicalItemSize(item, asset, {
                    sizeProfile,
                    canonicalFallback: false,
                });
                return size ? resizeRoomEditorItemByKindSize(item, size, kind) : item;
            });
        });
    }

    function nudgeSelected(dx, dy) {
        if (!canEditLayout) return;
        if (groupEditMode) {
            moveGroup(dx, dy);
            return;
        }
        if (!selectedItem) return;
        updateItem(selectedItem.id, { x: selectedItem.x + dx, y: selectedItem.y + dy });
    }

    function updateSelectedDirection(direction) {
        if (!canRotateSelected || !selectedItem || !selectedAsset || !selectedDirectionGroup) return;
        const nextAsset = selectedDirectionGroup.variants?.[direction];
        if (!nextAsset) return;
        if (nextAsset.id === selectedAsset.id) {
            setNotice(`${selectedDirectionGroup.name} 已经是${roomEditorDirectionLabels[direction] || direction}。`);
            return;
        }
        const oldBox = selectedAsset.box || selectedItem;
        const nextBox = nextAsset.box || oldBox;
        const oldWidth = Math.max(8, Number(oldBox.w || selectedItem.w || 8));
        const scale = Math.max(0.05, Number(selectedItem.w || oldWidth) / oldWidth);
        const nextW = Math.max(8, Math.round(Number(nextBox.w || selectedItem.w || 8) * scale));
        const nextH = Math.max(8, Math.round(Number(nextBox.h || selectedItem.h || 8) * scale));
        const bottomCenterX = selectedItem.x + selectedItem.w / 2;
        const bottomY = selectedItem.y + selectedItem.h;
        updateItem(selectedItem.id, {
            assetId: nextAsset.id,
            x: Math.round(bottomCenterX - nextW / 2),
            y: Math.round(bottomY - nextH),
            w: nextW,
            h: nextH,
            collision: getRoomEditorDefaultCollision(nextAsset),
        });
        setNotice(`${selectedDirectionGroup.name} 已切到${roomEditorDirectionLabels[direction] || direction}。`);
    }

    function cycleSelectedDirection() {
        if (!canRotateSelected || !selectedDirectionGroup) return;
        const currentIndex = Math.max(0, roomEditorDirectionOrder.indexOf(selectedDirection));
        for (let step = 1; step <= roomEditorDirectionOrder.length; step += 1) {
            const direction = roomEditorDirectionOrder[(currentIndex + step) % roomEditorDirectionOrder.length];
            if (selectedDirectionGroup.variants?.[direction]) {
                updateSelectedDirection(direction);
                return;
            }
        }
    }

    function updateSelectedGroundLayer(enabled) {
        if (!canEditLayout || !selectedItem) return;
        updateItem(selectedItem.id, { groundLayer: enabled ? true : undefined });
        setNotice(
            enabled
                ? '已切到地面层：碰撞箱会保留，但不会阻挡人物或后续寻路。'
                : '已切回普通素材：碰撞箱会正常参与阻挡。',
        );
    }

    function updateSelectedCollisionEnabled(enabled) {
        if (!canEditLayout || !selectedItem || !selectedAsset) return;
        if (!selectedCollisionCanTakeEffect) {
            setShowCollisionLines(true);
            setNotice('地面层规则已生效：这个实例的碰撞箱不会阻挡人物。');
            return;
        }
        setShowCollisionLines(true);
        updateItem(selectedItem.id, {
            collision: {
                ...normalizeCommercialV2Collision(
                    selectedItem.collision || getRoomEditorDefaultCollision(selectedAsset),
                    selectedAsset,
                ),
                enabled,
            },
        });
    }

    function updateSelectedCollisionLocalBox(key, value) {
        if (!canEditLayout || !selectedItem || !selectedAsset || !selectedCollisionLocalBox) return;
        if (!selectedCollisionCanTakeEffect) {
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
        if (!canEditLayout || !selectedItem || !selectedAsset) return;
        if (!selectedCollisionCanTakeEffect) {
            setShowCollisionLines(true);
            setNotice('地面层规则已生效：这个实例的碰撞箱不会阻挡人物。');
            return;
        }
        setShowCollisionLines(true);
        updateItem(selectedItem.id, {
            collision: getRoomEditorDefaultCollision(selectedAsset),
        });
    }

    function fitSelectedCollisionToSprite() {
        if (!canEditLayout || !selectedItem || !selectedAsset) return;
        if (!selectedCollisionCanTakeEffect) {
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
        updateItem(item.id, {
            placeAnchor: normalizeCommercialV2PlaceAnchor({
                x: (Number(localPoint.x) || 0) / item.w,
                y: (Number(localPoint.y) || 0) / item.h,
            }),
        });
    }

    function updateSelectedPlaceAnchorLocalPoint(key, value) {
        if (!canEditLayout || !selectedItem || !selectedPlaceAnchorLocalPoint) return;
        setShowPlaceAnchors(true);
        updatePlaceAnchorFromLocalPoint(selectedItem, {
            ...selectedPlaceAnchorLocalPoint,
            [key]: Math.round(Number(value) || 0),
        });
    }

    function resetSelectedPlaceAnchor() {
        if (!canEditLayout || !selectedItem) return;
        setShowPlaceAnchors(true);
        updateItem(selectedItem.id, { placeAnchor: undefined });
    }

    function onCollisionPointerDown(event, item, asset, handle = 'move') {
        if (!canEditLayout || groupEditMode || !canCommercialV2ItemCollisionTakeEffect(item, asset)) return;
        event.preventDefault();
        event.stopPropagation();
        const stage = event.currentTarget.closest('.pixel-world-editor-stage') || stageRef.current;
        if (!stage) return;
        const collision = normalizeCommercialV2Collision(item.collision || getRoomEditorDefaultCollision(asset), asset);
        if (!collision.enabled) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const startPoint = getPointerStagePoint(event, stage, stageSize);
        dragRef.current = {
            id: item.id,
            mode: 'collision',
            stage,
            handle,
            startPoint,
            startItem: item,
            startAsset: asset,
            startLocalBox: {
                x: collision.x * item.w,
                y: collision.y * item.h,
                w: collision.w * item.w,
                h: collision.h * item.h,
            },
        };
        setSelectedId(item.id);
        setShowCollisionLines(true);
    }

    function onPlaceAnchorPointerDown(event, item, asset) {
        if (!canEditLayout || groupEditMode) return;
        event.preventDefault();
        event.stopPropagation();
        const stage = event.currentTarget.closest('.pixel-world-editor-stage') || stageRef.current;
        if (!stage) return;
        const place = buildRoomEditorItemAnchor(item, asset);
        if (!place) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const startPoint = getPointerStagePoint(event, stage, stageSize);
        dragRef.current = {
            id: item.id,
            mode: 'place-anchor',
            stage,
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

    function onPointerDown(event, item) {
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
            dx: point.x - item.x,
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
                if (drag.handle.includes('e')) nextW = start.w + deltaX;
                if (drag.handle.includes('n')) {
                    nextY = start.y + deltaY;
                    nextH = start.h - deltaY;
                }
                if (drag.handle.includes('s')) nextH = start.h + deltaY;
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
        updateItem(drag.id, { x: point.x - drag.dx, y: point.y - drag.dy });
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

    return {
        onPointerDown,
        onCollisionPointerDown,
        onPlaceAnchorPointerDown,
        saveLayout,
        saveCurrentAsDefaultScene,
        copyLayout,
        copyAiLayout,
        restoreResetBackup,
        resetLayout,
        scaleSelected,
        cycleSelectedDirection,
        moveSelectedLayer,
        bringSelectedToFront,
        sendSelectedToBack,
        deleteSelected,
        addAsset,
        onPointerMove,
        onPointerUp,
        updateSelectedDirection,
        updateSelectedGroundLayer,
        updateSelectedPlaceAnchorLocalPoint,
        resetSelectedPlaceAnchor,
        updateItem,
        nudgeSelected,
        updateSelectedCollisionEnabled,
        updateSelectedCollisionLocalBox,
        resetSelectedCollision,
        fitSelectedCollisionToSprite,
    };
}
