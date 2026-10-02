import { useAutonomousBehavior } from './behavior/useAutonomousBehavior.js';
import { useRoomBehaviorRuntime } from './behavior/useRoomBehaviorRuntime.js';
import { useRoomMotion } from './movement/useRoomMotion.js';
import { useBehaviorSession } from './behavior/useBehaviorSession.js';
import { createRoomNavigation } from './movement/createRoomNavigation.js';
import { useBehaviorTreeSync } from './useBehaviorTreeSync.js';
import { ScenePlayerToolbar } from './components/ScenePlayerToolbar.jsx';
import { useSceneFitZoom } from './useSceneFitZoom.js';

import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { pixelTx, translatePixelText, translatePixelAction } from './pixelWorldI18n.js';
import {
    readStoredRoomEditorLayout,
    readStoredRoomEditorPlayers,
    readStoredRoomEditorResetBackup,
    roomEditorDefaultZoom,
    roomEditorBehaviorTreeStorageKey,
    roomEditorMaxStorageBytes,
    roomEditorStageSize,
    roomEditorAssetCatalog,
    createRoomEditorPlayerState,
    getRoomEditorDirectionalGroup,
    buildRoomEditorItemAnchor,
    getRoomEditorPlaceAnchorLocalPoint,
    getRoomEditorItemRenderZIndex,
    roomEditorBehaviorSafePoints,
    normalizeRoomEditorItemAspect,
    roomEditorMaxSavedItems,
    roomEditorPlayerRenderIntervalMs,
    normalizeRoomEditorPlayersSnapshot,
    clampRoomEditorPlayerScale,
    normalizeRoomEditorPlayerState,
    roomEditorFurnitureScaleVersion,
    normalizeRoomEditorLayoutState,
    roomEditorLayoutUpdatedEvent,
    roomEditorBackgroundColor,
    roomEditorBackdrop,
    buildRoomEditorAiLayout,
    serializeRoomEditorPlayers,
    createRoomEditorBehaviorTreeSnapshot,
    serializeRoomEditorItem,
} from './roomEditorCore.js';
import {
    readStoredCommercialBehaviorConfig,
    readStoredRoomBehaviorTreeState,
    buildCommercialBehaviorContextStats,
    summarizeMountedGeneratedBehaviorBranches,
    commercialV2BehaviorInteractionDistance,
    commercialV2BehaviorPrimaryActionIds,
    commercialV2BehaviorActions,
    commercialV2BehaviorContextActionIds,
    adaptRoomBehaviorTreeStateForPlaces,
    commercialV2BehaviorConfigStorageKey,
    createCommercialV2BehaviorTreeState,
    commercialV2BehaviorTreeUpdatedEvent,
    buildBehaviorTreeStorageSyncSignature,
    roomBehaviorServerSceneKey,
} from './behaviorTreeCore.js';
import {
    commercialV2DefaultControlledPlayerId,
    commercialV2PlayerCharacters,
    commercialV2RoleActorId,
    commercialV2PlayerCharacterById,
    commercialV2UserActorId,
    commercialV2PlayerSize,
    getCommercialV2PlayerCharacter,
    getCommercialV2CollisionWorldBox,
    canCommercialV2ItemCollisionTakeEffect,
    getCommercialV2EffectiveCollision,
    getCommercialV2CollisionLocalBox,
    getLayoutBounds,
    clampBox,
    commercialV2PlayerFrame,
} from './commercialStreetCore.js';
import { useEventCallback } from '../../../shared/hooks/useEventCallback.js';
import { RoomPlayer } from './components/RoomPlayer.jsx';
import { RoomCanvasItem } from './components/RoomCanvasItem.jsx';
import { RoomPlaceAnchor } from './components/RoomPlaceAnchor.jsx';
import { RoomInteractionMenu } from './components/RoomInteractionMenu.jsx';
import { createRoomBehaviorRequests } from './actions/createRoomBehaviorRequests.js';

function RoomScene({ editorTools = null, scene, apiUrl = '/api', userProfile = null, isActive = true }) {
    const { lang } = useLanguage();
    const [toolsOpen, setToolsOpen] = useState(false);
    const editorEnabled = Boolean(editorTools) && toolsOpen;
    const { RoomEditorToolbar, RoomSelectionInspector, RoomBehaviorPanel, RoomBehaviorContext, RoomAssetPanel } =
        editorTools || {};
    function toggleTools() {
        // End an in-flight drag before locking the player scene.
        if (dragFrameRef.current) cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
        dragRef.current = null;
        pendingDragPointRef.current = null;
        setViewMode(true);
        setGroupEditMode(false);
        setShowCollisionLines(false);
        setShowPlaceAnchors(false);
        setShowLayerPanel(false);
        setToolsOpen((value) => !value);
    }
    const tx = useCallback((en, zh) => pixelTx(en, zh, lang), [lang]);
    const ptxt = useCallback((value) => translatePixelText(value, lang), [lang]);
    const stageRef = useRef(null);
    const canvasWrapRef = useRef(null);
    const dragRef = useRef(null);
    const dragFrameRef = useRef(null);
    const pendingDragPointRef = useRef(null);
    const [initialLayout] = useState(() => readStoredRoomEditorLayout());
    const [initialPlayers] = useState(() => readStoredRoomEditorPlayers());
    const [items, setItemsState] = useState(initialLayout.items);
    const itemsRef = useRef(initialLayout.items);
    const [players, setPlayersState] = useState(initialPlayers.players);
    const playersRef = useRef(initialPlayers.players);
    const pendingPlayersRenderRef = useRef(null);
    const playerRenderFrameRef = useRef(0);
    const playerRenderLastTimeRef = useRef(0);
    const [controlledPlayerId, setControlledPlayerIdState] = useState(initialPlayers.controlledPlayerId);
    const controlledPlayerIdRef = useRef(initialPlayers.controlledPlayerId);
    const [playerScale, setPlayerScaleState] = useState(initialPlayers.scale);
    const playerScaleRef = useRef(initialPlayers.scale);

    const behaviorTreeStateRef = useRef(null);
    const behaviorTreeSyncSourceRef = useRef(`room-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const [resetBackup, setResetBackup] = useState(() => readStoredRoomEditorResetBackup());
    const [selectedId, setSelectedId] = useState(initialLayout.selectedId || '');
    const [zoom, setZoom] = useState(Math.min(roomEditorDefaultZoom, 0.39));
    const [viewMode, setViewMode] = useState(true);
    const [groupEditMode, setGroupEditMode] = useState(false);
    const [showCollisionLines, setShowCollisionLines] = useState(false);
    const [showPlaceAnchors, setShowPlaceAnchors] = useState(false);
    const [showLayerPanel, setShowLayerPanel] = useState(false);
    const [showAdvancedToolbar, setShowAdvancedToolbar] = useState(false);
    const [activeAssetType, setActiveAssetType] = useState('家具');

    const [behaviorCharacters, setBehaviorCharacters] = useState([]);
    const [behaviorCharacterId, setBehaviorCharacterId] = useState('');
    const [behaviorAction, setBehaviorAction] = useState('greet');
    const [behaviorPlaceId, setBehaviorPlaceId] = useState('');
    const [behaviorPromptText, setBehaviorPromptText] = useState('');
    const [behaviorConfig, setBehaviorConfig] = useState(() => readStoredCommercialBehaviorConfig());
    const [behaviorModelOptions, setBehaviorModelOptions] = useState([]);

    const [behaviorOutput, setBehaviorOutput] = useState(null);
    const [behaviorTreeState, setBehaviorTreeState] = useState(() =>
        readStoredRoomBehaviorTreeState(roomEditorBehaviorTreeStorageKey, roomEditorMaxStorageBytes),
    );

    const [behaviorStatus, setBehaviorStatus] = useState('等待读取房间 AI 上文。');
    const [behaviorModelStatus, setBehaviorModelStatus] = useState(
        '默认使用绑定角色的模型配置；需要覆盖时再填写 URL 和 Key。',
    );
    const [behaviorLoading, setBehaviorLoading] = useState(false);
    const [behaviorModelsLoading, setBehaviorModelsLoading] = useState(false);
    const [behaviorShowKey, setBehaviorShowKey] = useState(false);

    const [roomBehaviorPanelCollapsed, setRoomBehaviorPanelCollapsed] = useState(false);

    const [roomBehaviorFoldOpen, setRoomBehaviorFoldOpen] = useState({
        generation: true,
        model: false,
        context: false,
        constraints: true,
        runtime: true,
        debug: false,
    });
    const behaviorContextStats = useMemo(
        () => buildCommercialBehaviorContextStats(behaviorTreeState, behaviorConfig),
        [behaviorTreeState, behaviorConfig],
    );
    const mountedGeneratedBehavior = useMemo(
        () => summarizeMountedGeneratedBehaviorBranches(behaviorTreeState),
        [behaviorTreeState],
    );
    const behaviorRuntimeNodeCount = useMemo(
        () => Object.keys(behaviorTreeState?.nodes || {}).length,
        [behaviorTreeState],
    );

    const behaviorDebugRuntimeSummary = tx(
        `${behaviorRuntimeNodeCount} runtime nodes · AI daily ${mountedGeneratedBehavior.base_count} · interaction ${mountedGeneratedBehavior.interaction_count}`,
        `${behaviorRuntimeNodeCount} 运行节点 · AI 日常 ${mountedGeneratedBehavior.base_count} · 互动 ${mountedGeneratedBehavior.interaction_count}`,
    );
    const [notice, setNotice] = useState('房间画布已接入小人和行为树面板；WASD/方向键可以移动当前小人。');
    const stageSize = roomEditorStageSize;
    useSceneFitZoom(canvasWrapRef, stageSize.height, Math.min(roomEditorDefaultZoom, 0.39), setZoom);
    const assetById = useMemo(() => new Map(roomEditorAssetCatalog.map((asset) => [asset.id, asset])), []);
    const rolePlayer =
        players[commercialV2RoleActorId] ||
        createRoomEditorPlayerState(
            commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0],
        );
    const userPlayer =
        players[commercialV2UserActorId] ||
        createRoomEditorPlayerState(
            commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0],
        );
    const playerDimensions = useMemo(
        () => ({
            width: commercialV2PlayerSize.width * playerScale,
            height: commercialV2PlayerSize.height * playerScale,
            footOffset: commercialV2PlayerSize.footOffset * playerScale,
        }),
        [playerScale],
    );
    const getPlayerVisualDimensions = useCallback(
        (targetPlayer) => {
            const character = getCommercialV2PlayerCharacter(targetPlayer);
            const visualScale = Math.max(0.25, Number(character?.visualScale) || 1);
            return {
                width: playerDimensions.width * visualScale,
                height: playerDimensions.height * visualScale,
                footOffset: playerDimensions.footOffset * visualScale,
            };
        },
        [playerDimensions],
    );
    const roomCollisionRects = useMemo(
        () =>
            items
                .map((item) => {
                    const asset = assetById.get(item.assetId);
                    const collisionBox = getCommercialV2CollisionWorldBox(item, asset);
                    if (!collisionBox) return null;
                    return {
                        id: item.id,
                        assetId: item.assetId,
                        ...collisionBox,
                    };
                })
                .filter(Boolean),
        [assetById, items],
    );

    const behaviorInteractionState = useMemo(() => {
        const dx = (userPlayer.x || 0) - (rolePlayer.x || 0);
        const dy = (userPlayer.y || 0) - (rolePlayer.y || 0);
        const distance = Math.hypot(dx, dy);
        const bodyY = (rolePlayer.y || 0) - playerDimensions.height * 0.42 + playerDimensions.footOffset;
        return {
            distance,
            nearby: distance <= commercialV2BehaviorInteractionDistance,
            x: rolePlayer.x || 0,
            y: Math.max(96, Math.min(stageSize.height - 90, bodyY)),
            side: (rolePlayer.x || 0) < stageSize.width * 0.5 ? 'right' : 'left',
        };
    }, [
        playerDimensions.footOffset,
        playerDimensions.height,
        rolePlayer.x,
        rolePlayer.y,
        stageSize.height,
        stageSize.width,
        userPlayer.x,
        userPlayer.y,
    ]);
    const roomBehaviorInteractionState = behaviorInteractionState;
    const selectedItem = items.find((item) => item.id === selectedId) || null;
    const selectedAsset = selectedItem ? assetById.get(selectedItem.assetId) : null;
    const selectedDirectionGroup = selectedAsset ? getRoomEditorDirectionalGroup(selectedAsset) : null;
    const selectedDirection = selectedAsset?.directional?.direction || '';
    const selectedIsGroundLayer = Boolean(selectedItem?.groundLayer);
    const selectedCollisionCanTakeEffect = Boolean(
        selectedItem && selectedAsset && canCommercialV2ItemCollisionTakeEffect(selectedItem, selectedAsset),
    );
    const selectedCollision =
        selectedItem && selectedAsset ? getCommercialV2EffectiveCollision(selectedItem, selectedAsset) : null;
    const selectedCollisionLocalBox =
        selectedItem && selectedAsset ? getCommercialV2CollisionLocalBox(selectedItem, selectedAsset) : null;
    const selectedPlace = selectedItem && selectedAsset ? buildRoomEditorItemAnchor(selectedItem, selectedAsset) : null;
    const selectedPlaceAnchorLocalPoint =
        selectedItem && selectedAsset ? getRoomEditorPlaceAnchorLocalPoint(selectedItem, selectedAsset) : null;
    const layerRows = useMemo(
        () =>
            items.map((item, layerIndex) => {
                const asset = assetById.get(item.assetId);
                const isGround = Boolean(item.groundLayer);
                return {
                    item,
                    asset,
                    layerIndex,
                    zIndex: getRoomEditorItemRenderZIndex(item, asset, layerIndex),
                    isGround,
                    playerRule: isGround ? '地面层 / 忽略碰撞' : '普通素材 / 碰撞生效',
                };
            }),
        [assetById, items],
    );
    const selectedLayerRow = selectedId ? layerRows.find((row) => row.item.id === selectedId) || null : null;
    const layoutBounds = useMemo(() => getLayoutBounds(items), [items]);
    const groupedAssets = useMemo(() => {
        const groups = new Map();
        roomEditorAssetCatalog.forEach((asset) => {
            if (asset.hiddenInPalette) return;
            const type = asset.type || '家具';
            if (!groups.has(type)) groups.set(type, []);
            groups.get(type).push(asset);
        });
        return Array.from(groups.entries());
    }, []);
    const activeAssetGroup = groupedAssets.find(([type]) => type === activeAssetType) || groupedAssets[0] || null;
    const roomAnchors = useMemo(
        () => items.map((item) => buildRoomEditorItemAnchor(item, assetById.get(item.assetId))).filter(Boolean),
        [assetById, items],
    );
    const behaviorPlaceLinks = useMemo(() => {
        const furniturePlaces = roomAnchors.map((anchor, index) => ({
            order: index + 1,
            placeId: anchor.id,
            locationId: anchor.id,
            locationIds: [anchor.id, anchor.itemId, anchor.assetId].filter(Boolean),
            name: anchor.name,
            kind: anchor.kind || '房间物件',
            actions: ['go_to_place', 'browse_near', 'idle_at_place', 'loop_in_front_of'],
            aliases: [anchor.name, anchor.itemId, anchor.assetId].filter(Boolean),
            facing: 'front',
            anchor: anchor.anchor,
            rawAnchor: anchor,
        }));
        const genericSafePointPlaces = roomEditorBehaviorSafePoints
            .filter((point) => point.id === 'center')
            .map((point, index) => ({
                order: furniturePlaces.length + index + 1,
                placeId: `room-point:${point.id}`,
                locationId: `room-point:${point.id}`,
                locationIds: [`room-point:${point.id}`, point.id],
                name: point.label,
                kind: '房间站位',
                actions: ['go_to_place', 'idle_at_place', 'wander_between', 'patrol_segment'],
                aliases: [point.label, point.id],
                facing: point.direction,
                anchor: { x: point.x, y: point.y },
            }));
        return [...furniturePlaces, ...genericSafePointPlaces].map((place, index) => ({
            ...place,
            order: index + 1,
        }));
    }, [roomAnchors]);
    const roomBehaviorRequiredAnchorBranches = useMemo(
        () =>
            roomAnchors.map((anchor, index) => ({
                order: index + 1,
                id: anchor.id,
                place_id: anchor.id,
                label: anchor.name,
                kind: anchor.kind || '房间物件',
                item_id: anchor.itemId,
                asset_id: anchor.assetId,
            })),
        [roomAnchors],
    );
    const behaviorOrderedPlaces = useMemo(
        () =>
            behaviorPlaceLinks.map((place, index) => ({
                ...place,
                order: index + 1,
            })),
        [behaviorPlaceLinks],
    );
    const behaviorPlaceOptions = useMemo(
        () =>
            behaviorOrderedPlaces.map((place) => ({
                id: place.placeId,
                label: place.name,
                order: place.order,
            })),
        [behaviorOrderedPlaces],
    );
    const {
        findSafeRoomPlayerPointNear,
        resolveRoomPlayerMovement,
        buildBehaviorSmoothTravelPath,
        resolveRoomBehaviorTarget,
    } = useMemo(
        () => createRoomNavigation({ playerDimensions, roomCollisionRects, behaviorPlaceLinks }),
        [playerDimensions, roomCollisionRects, behaviorPlaceLinks],
    );
    const behaviorCharacter =
        behaviorCharacters.find((item) => item.id === behaviorCharacterId) || behaviorCharacters[0] || null;
    const behaviorSession = useBehaviorSession({
        behaviorTreeStateRef,
        behaviorCharacterId,
        behaviorTreeState,
        setBehaviorStatus,
        behaviorOrderedPlaces,
    });
    const {
        behaviorInteractionSessionRef,
        autonomousBehaviorCooldownRef,
        autonomousBehaviorCursorRef,
        autonomousBehaviorRecentRef,
        keepBehaviorInteractionSessionActive,
        isBehaviorInteractionSessionActive,
        clearBehaviorStatusHold,
        setBehaviorStatusPinned,
        setBehaviorRuntimeStatus,
        pickAutonomousBehaviorBranch,
    } = behaviorSession;
    const behaviorPrimaryActions = commercialV2BehaviorPrimaryActionIds
        .map((id) => commercialV2BehaviorActions.find((item) => item.id === id))
        .filter(Boolean)
        .map((action) => translatePixelAction(action, lang));
    const behaviorContextActions = commercialV2BehaviorContextActionIds
        .map((id) => commercialV2BehaviorActions.find((item) => item.id === id))
        .filter(Boolean)
        .map((action) => translatePixelAction(action, lang));
    const canEditLayout = editorEnabled && !viewMode;
    const canRotateSelected = Boolean(
        canEditLayout && !groupEditMode && selectedItem && selectedAsset && selectedDirectionGroup,
    );
    const normalizeRoomEditorLiveItem = useCallback(
        (item) => {
            const asset = assetById.get(item?.assetId);
            return clampBox(normalizeRoomEditorItemAspect(item, asset), stageSize);
        },
        [assetById, stageSize],
    );

    const commitItems = useCallback(
        (updater) => {
            setItemsState((prev) => {
                const next = typeof updater === 'function' ? updater(prev) : updater;
                const safeNext = Array.isArray(next)
                    ? next.slice(0, roomEditorMaxSavedItems).map((item) => normalizeRoomEditorLiveItem(item))
                    : prev;
                itemsRef.current = safeNext;
                return safeNext;
            });
        },
        [normalizeRoomEditorLiveItem],
    );

    const flushPendingPlayersRender = useCallback((force = false) => {
        const nextPlayers = pendingPlayersRenderRef.current;
        if (!nextPlayers) return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const elapsed = now - playerRenderLastTimeRef.current;
        if (!force && playerRenderLastTimeRef.current && elapsed < roomEditorPlayerRenderIntervalMs) {
            if (!playerRenderFrameRef.current) {
                playerRenderFrameRef.current = requestAnimationFrame(() => {
                    playerRenderFrameRef.current = 0;
                    flushPendingPlayersRender(false);
                });
            }
            return;
        }
        pendingPlayersRenderRef.current = null;
        playerRenderLastTimeRef.current = now;
        setPlayersState(nextPlayers);
    }, []);

    const queuePlayersRender = useCallback(
        (nextPlayers, options = {}) => {
            pendingPlayersRenderRef.current = nextPlayers;
            if (options.immediate) {
                if (playerRenderFrameRef.current) {
                    cancelAnimationFrame(playerRenderFrameRef.current);
                    playerRenderFrameRef.current = 0;
                }
                flushPendingPlayersRender(true);
                return;
            }
            flushPendingPlayersRender(false);
        },
        [flushPendingPlayersRender],
    );

    const commitPlayers = useCallback(
        (updater, options = {}) => {
            const currentPlayers = playersRef.current;
            const rawNext = typeof updater === 'function' ? updater(currentPlayers) : updater;
            const safeNext = normalizeRoomEditorPlayersSnapshot({
                players: rawNext,
                controlledPlayerId: controlledPlayerIdRef.current,
                scale: playerScaleRef.current,
            }).players;
            playersRef.current = safeNext;
            queuePlayersRender(safeNext, options);
            return safeNext;
        },
        [queuePlayersRender],
    );

    // Keep polling, storage listeners and animation loops on the latest scene state.
    const commitBehaviorTreeStateEvent = useEventCallback(commitBehaviorTreeState);
    const clearBehaviorRuntimeEvent = useEventCallback(clearBehaviorRuntime);
    useEffect(
        () => () => {
            if (playerRenderFrameRef.current) {
                cancelAnimationFrame(playerRenderFrameRef.current);
                playerRenderFrameRef.current = 0;
            }
        },
        [],
    );

    const updateControlledPlayerId = useCallback((playerId) => {
        const nextPlayerId = commercialV2PlayerCharacterById.has(playerId)
            ? playerId
            : commercialV2DefaultControlledPlayerId;
        controlledPlayerIdRef.current = nextPlayerId;
        setControlledPlayerIdState(nextPlayerId);
    }, []);

    const updatePlayerScale = useCallback((value) => {
        const nextScale = clampRoomEditorPlayerScale(value);
        playerScaleRef.current = nextScale;
        setPlayerScaleState(nextScale);
    }, []);

    function setWorldPlayerBubble(playerId, text) {
        const safeText = String(text || '')
            .trim()
            .slice(0, 80);
        updateRoomPlayer(playerId, { bubble: safeText });
    }

    useEffect(() => {
        commitItems((prev) => prev);
    }, [commitItems]);

    const updateRoomPlayer = useCallback(
        (playerId, updater) => {
            const character = commercialV2PlayerCharacterById.get(playerId);
            if (!character) return;
            commitPlayers((prev) => {
                const current = prev[playerId] || createRoomEditorPlayerState(character);
                const patch = typeof updater === 'function' ? updater(current) : updater;
                return {
                    ...prev,
                    [playerId]: normalizeRoomEditorPlayerState({ ...current, ...patch }, character),
                };
            });
        },
        [commitPlayers],
    );

    const setPlayerById = useCallback(
        (playerId, updater) => {
            updateRoomPlayer(playerId, updater);
        },
        [updateRoomPlayer],
    );

    const roomMotion = useRoomMotion({
        isActive,
        canvasWrapRef,
        playersRef,
        setControlledPlayerIdState,
        controlledPlayerIdRef,
        setPlayerScaleState,
        playerScaleRef,
        advanceBehaviorRuntime,
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
    });

    const { roomBehaviorTravelRef } = roomMotion;

    const roomBehavior = useRoomBehaviorRuntime({
        selection: {
            behaviorCharacterId,
            behaviorAction,
            setBehaviorAction,
            behaviorPlaceId,
            behaviorLoading,
            behaviorInteractionState,
            behaviorPlaceOptions,
            behaviorCharacter,
        },
        actors: { playersRef, setPlayerById, setWorldPlayerBubble },
        tree: { behaviorTreeStateRef, behaviorTreeState, behaviorOrderedPlaces, commitBehaviorTreeState },
        session: {
            behaviorInteractionSessionRef,
            autonomousBehaviorCooldownRef,
            keepBehaviorInteractionSessionActive,
            setBehaviorRuntimeStatus,
        },
        navigation: { findSafeRoomPlayerPointNear, buildBehaviorSmoothTravelPath, resolveRoomBehaviorTarget },
        motion: { roomBehaviorTravelRef },
        presentation: { setBehaviorOutput, setBehaviorStatus, setNotice },
        generation: {
            resolveBehaviorAction: (...args) => resolveBehaviorAction(...args),
            resolveBehaviorPlace: (...args) => resolveBehaviorPlace(...args),
            generateBehaviorBranch: (...args) => generateBehaviorBranch(...args),
            mergeBehaviorTreePatch: (...args) => mergeBehaviorTreePatch(...args),
        },
    });

    const {
        behaviorRuntimeRef,
        behaviorChoicePendingRef,
        activeBehaviorDialog,
        interactionMenuOpen,
        setInteractionMenuOpen,
    } = roomBehavior;

    useEffect(() => {
        if (!behaviorInteractionState.nearby || activeBehaviorDialog) {
            setInteractionMenuOpen(false);
        }
    }, [activeBehaviorDialog, behaviorInteractionState.nearby, setInteractionMenuOpen]);

    useEffect(() => {
        if (!behaviorPlaceOptions.length) {
            setBehaviorPlaceId('');
            return;
        }
        if (behaviorPlaceId && behaviorPlaceOptions.some((option) => option.id === behaviorPlaceId)) return;
        const preferredTarget =
            behaviorPlaceOptions.find((option) => option.id.includes('bed')) ||
            behaviorPlaceOptions.find((option) => option.id.includes('vanity')) ||
            behaviorPlaceOptions[0];
        setBehaviorPlaceId(preferredTarget.id);
    }, [behaviorPlaceId, behaviorPlaceOptions]);

    useEffect(() => {
        commitBehaviorTreeStateEvent((currentTree) =>
            adaptRoomBehaviorTreeStateForPlaces(currentTree, behaviorOrderedPlaces),
        );
    }, [behaviorOrderedPlaces, commitBehaviorTreeStateEvent]);

    useEffect(() => {
        try {
            localStorage.setItem(
                commercialV2BehaviorConfigStorageKey,
                JSON.stringify({
                    api_endpoint: behaviorConfig.api_endpoint || '',
                    model_name: behaviorConfig.model_name || '',
                    context_q_limit: behaviorConfig.context_q_limit,
                    context_summary_threshold: behaviorConfig.context_summary_threshold,
                }),
            );
        } catch {
            // The API key is intentionally never persisted here.
        }
    }, [
        behaviorConfig.api_endpoint,
        behaviorConfig.model_name,
        behaviorConfig.context_q_limit,
        behaviorConfig.context_summary_threshold,
    ]);

    useEffect(() => {
        if (behaviorTreeStateRef.current && behaviorTreeStateRef.current !== behaviorTreeState) return;
        behaviorTreeStateRef.current = behaviorTreeState;
    }, [behaviorTreeState]);

    useEffect(() => {
        try {
            const treeToStore = behaviorTreeStateRef.current || behaviorTreeState;
            localStorage.setItem(roomEditorBehaviorTreeStorageKey, JSON.stringify(treeToStore));
        } catch {
            // The tree can still live in memory if browser storage is full or unavailable.
        }
    }, [behaviorTreeState]);

    function commitBehaviorTreeState(nextTreeOrUpdater, options = {}) {
        markLocalTreeChanged();
        const currentTree = behaviorTreeStateRef.current || behaviorTreeState || createCommercialV2BehaviorTreeState();
        const nextTree = typeof nextTreeOrUpdater === 'function' ? nextTreeOrUpdater(currentTree) : nextTreeOrUpdater;
        if (!nextTree || typeof nextTree !== 'object') return currentTree;
        behaviorTreeStateRef.current = nextTree;
        try {
            localStorage.setItem(roomEditorBehaviorTreeStorageKey, JSON.stringify(nextTree));
        } catch {
            // The tree can still live in memory if browser storage is full or unavailable.
        }
        if (!options.skipBroadcast && typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent(commercialV2BehaviorTreeUpdatedEvent, {
                    detail: {
                        storageKey: roomEditorBehaviorTreeStorageKey,
                        sourceId: behaviorTreeSyncSourceRef.current,
                        tree: nextTree,
                    },
                }),
            );
        }
        setBehaviorTreeState(nextTree);
        return nextTree;
    }

    const {
        persistBehaviorTreeStateToServer,
        markLocalTreeChanged,
        canReceiveExternalTree,
        syncStatus,
        retrySync,
        reloadServerTree,
    } = useBehaviorTreeSync({
        apiUrl,
        sceneKey: roomBehaviorServerSceneKey,
        storageKey: roomEditorBehaviorTreeStorageKey,
        enabled: isActive && behaviorOrderedPlaces.length > 0,
        getTree: () => behaviorTreeStateRef.current || behaviorTreeState,
        canApplyRemote: () => !behaviorLoading && !interactionMenuOpen && !isBehaviorInteractionSessionActive(),
        getMeta: () => ({
            scene: 'room',
            character_id: behaviorCharacterId || '',
            character_name: behaviorCharacter?.name || '',
        }),
        applyRemote: (tree) => {
            const nextTree = adaptRoomBehaviorTreeStateForPlaces(tree, behaviorOrderedPlaces);
            behaviorTreeStateRef.current = nextTree;
            try {
                localStorage.setItem(roomEditorBehaviorTreeStorageKey, JSON.stringify(nextTree));
            } catch {
                /* State remains usable in memory. */
            }
            setBehaviorTreeState(nextTree);
            clearBehaviorRuntimeEvent('');
            autonomousBehaviorCursorRef.current = 0;
            autonomousBehaviorRecentRef.current = [];
            setBehaviorStatusPinned('已加载服务器保存的房间行为树。', 12000);
        },
    });

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const applySyncedBehaviorTree = (nextTree, sourceLabel = 'other page') => {
            if (!canReceiveExternalTree()) return;
            markLocalTreeChanged();
            if (!nextTree || typeof nextTree !== 'object') return;
            const currentTree = behaviorTreeStateRef.current;
            if (buildBehaviorTreeStorageSyncSignature(nextTree) === buildBehaviorTreeStorageSyncSignature(currentTree))
                return;
            behaviorTreeStateRef.current = nextTree;
            setBehaviorTreeState(nextTree);
            clearBehaviorRuntimeEvent('');
            autonomousBehaviorCursorRef.current = 0;
            autonomousBehaviorRecentRef.current = [];
            setBehaviorStatusPinned(
                sourceLabel === 'storage' ? '已同步其他标签页生成的房间行为树。' : '已同步页面内最新生成的房间行为树。',
                30000,
            );
        };
        const readLatestStoredTree = () =>
            readStoredRoomBehaviorTreeState(roomEditorBehaviorTreeStorageKey, roomEditorMaxStorageBytes);
        const onBehaviorTreeUpdated = (event) => {
            const detail = event?.detail || {};
            if (detail.storageKey !== roomEditorBehaviorTreeStorageKey) return;
            if (detail.sourceId === behaviorTreeSyncSourceRef.current) return;
            applySyncedBehaviorTree(detail.tree || readLatestStoredTree(), 'event');
        };
        const onBehaviorTreeStorage = (event) => {
            if (event.key !== roomEditorBehaviorTreeStorageKey) return;
            applySyncedBehaviorTree(readLatestStoredTree(), 'storage');
        };
        window.addEventListener(commercialV2BehaviorTreeUpdatedEvent, onBehaviorTreeUpdated);
        window.addEventListener('storage', onBehaviorTreeStorage);
        return () => {
            window.removeEventListener(commercialV2BehaviorTreeUpdatedEvent, onBehaviorTreeUpdated);
            window.removeEventListener('storage', onBehaviorTreeStorage);
        };
    }, [
        clearBehaviorRuntimeEvent,
        markLocalTreeChanged,
        canReceiveExternalTree,
        autonomousBehaviorCursorRef,
        autonomousBehaviorRecentRef,
        setBehaviorStatusPinned,
    ]);

    useEffect(() => {
        let cancelled = false;
        const token = localStorage.getItem('cp_token') || '';
        fetch(`${apiUrl}/city/characters`, {
            headers: { Authorization: token ? `Bearer ${token}` : '' },
        })
            .then((response) =>
                response.ok ? response.json() : Promise.reject(new Error(`角色列表读取失败 ${response.status}`)),
            )
            .then((data) => {
                if (cancelled) return;
                const characters = Array.isArray(data?.characters) ? data.characters : [];
                setBehaviorCharacters(characters);
                setBehaviorCharacterId((current) => {
                    if (current && characters.some((item) => item.id === current)) return current;
                    const preferred = characters.find((item) => Number(item.sys_survival ?? 1) === 1) || characters[0];
                    return preferred?.id || '';
                });
            })
            .catch((error) => {
                if (!cancelled) setBehaviorStatus(`角色列表读取失败：${error.message}`);
            });
        return () => {
            cancelled = true;
        };
    }, [apiUrl]);

    useEffect(() => {
        const syncAgencyRoomLayout = (event) => {
            const detail = event?.detail || {};
            const storedLayout = readStoredRoomEditorLayout();
            const snapshot = Array.isArray(detail.items) ? detail : storedLayout;
            const preserveSnapshotItemSizes =
                String(snapshot?.furnitureScaleVersion || '') === roomEditorFurnitureScaleVersion;
            const normalized = normalizeRoomEditorLayoutState(snapshot?.items || [], {
                applyCanonicalSizes: !preserveSnapshotItemSizes,
                migrateAssetBoxes: !preserveSnapshotItemSizes,
            });
            if (!normalized) return;
            commitItems(normalized.items);
            setSelectedId(snapshot?.selectedId || normalized.selectedId || normalized.items[0]?.id || '');
            setNotice('已同步中介组装的样板间布局，并保存到当前房间。');
        };
        window.addEventListener(roomEditorLayoutUpdatedEvent, syncAgencyRoomLayout);
        return () => window.removeEventListener(roomEditorLayoutUpdatedEvent, syncAgencyRoomLayout);
    }, [commitItems]);

    function runPlayerInteraction(...args) {
        return roomBehavior.runPlayerInteraction(...args);
    }

    function continueBehaviorDialog(...args) {
        return roomBehavior.continueBehaviorDialog(...args);
    }

    function exitBehaviorDialog(...args) {
        return roomBehavior.exitBehaviorDialog(...args);
    }

    function chooseBehaviorDialogChoice(...args) {
        return roomBehavior.chooseBehaviorDialogChoice(...args);
    }

    function executeBehaviorBranch(...args) {
        return roomBehavior.executeBehaviorBranch(...args);
    }

    function activateBehaviorBranch(...args) {
        return roomBehavior.activateBehaviorBranch(...args);
    }

    function clearBehaviorRuntime(...args) {
        return roomBehavior.clearBehaviorRuntime(...args);
    }

    function activateBehaviorTravelFailureBranch(...args) {
        return roomBehavior.activateBehaviorTravelFailureBranch(...args);
    }

    function advanceBehaviorRuntime(...args) {
        return roomBehavior.advanceBehaviorRuntime(...args);
    }

    function focusCanvasForKeyboard(event) {
        event.currentTarget.focus({ preventScroll: true });
    }

    function toggleViewMode() {
        setViewMode((value) => {
            const next = !value;
            if (next) setSelectedId('');
            setNotice(next ? '观赏模式已开启：房间素材已锁定。' : '编辑模式已开启：可以移动、缩放、调碰撞箱和锚点。');
            return next;
        });
    }

    function toggleCollisionLines() {
        setShowCollisionLines((value) => {
            const next = !value;
            setNotice(next ? '已显示房间素材碰撞箱线。' : '已隐藏房间素材碰撞箱线，碰撞数据仍会保存。');
            return next;
        });
    }

    function togglePlaceAnchors() {
        setShowPlaceAnchors((value) => {
            const next = !value;
            setNotice(next ? '已显示房间素材锚点。' : '已隐藏房间素材锚点，锚点数据仍会保存。');
            return next;
        });
    }

    function getItemStyle(item, zIndex = 1) {
        return {
            left: `${(item.x / stageSize.width) * 100}%`,
            top: `${(item.y / stageSize.height) * 100}%`,
            width: `${(item.w / stageSize.width) * 100}%`,
            height: `${(item.h / stageSize.height) * 100}%`,
            zIndex,
        };
    }

    function renderRoomEditorItem(item, asset, layerIndex) {
        return (
            <RoomCanvasItem
                key={item.id}
                item={item}
                asset={asset}
                layerIndex={layerIndex}
                canEditLayout={canEditLayout}
                selectedId={selectedId}
                showCollisionLines={showCollisionLines}
                groupEditMode={groupEditMode}
                getItemStyle={getItemStyle}
                onPointerDown={onPointerDown}
                setSelectedId={setSelectedId}
                showLayerPanel={showLayerPanel}
                onCollisionPointerDown={onCollisionPointerDown}
            />
        );
    }

    function renderRoomPlaceAnchor(item, asset, layerIndex) {
        return (
            <RoomPlaceAnchor
                key={item.id}
                item={item}
                asset={asset}
                layerIndex={layerIndex}
                canEditLayout={canEditLayout}
                selectedId={selectedId}
                groupEditMode={groupEditMode}
                onPlaceAnchorPointerDown={onPlaceAnchorPointerDown}
                stageSize={stageSize}
                tx={tx}
                ptxt={ptxt}
            />
        );
    }

    function renderPlayerInteractionMenu() {
        return (
            <RoomInteractionMenu
                behaviorInteractionState={behaviorInteractionState}
                activeBehaviorDialog={activeBehaviorDialog}
                stageSize={stageSize}
                interactionMenuOpen={interactionMenuOpen}
                setInteractionMenuOpen={setInteractionMenuOpen}
                behaviorLoading={behaviorLoading}
                behaviorCharacterId={behaviorCharacterId}
                tx={tx}
                behaviorCharacter={behaviorCharacter}
                behaviorPrimaryActions={behaviorPrimaryActions}
                behaviorAction={behaviorAction}
                runPlayerInteraction={runPlayerInteraction}
                behaviorPlaceId={behaviorPlaceId}
                setBehaviorPlaceId={setBehaviorPlaceId}
                behaviorPlaceOptions={behaviorPlaceOptions}
                behaviorContextActions={behaviorContextActions}
            />
        );
    }

    function renderBehaviorContextGrid(summaryHint) {
        return (
            <RoomBehaviorContext
                summaryHint={summaryHint}
                tx={tx}
                behaviorConfig={behaviorConfig}
                updateBehaviorConfig={updateBehaviorConfig}
                behaviorContextStats={behaviorContextStats}
                lang={lang}
            />
        );
    }

    function faceRoomPlayers(...args) {
        return roomMotion.faceRoomPlayers(...args);
    }

    function approachRoomPlayer(...args) {
        return roomMotion.approachRoomPlayer(...args);
    }

    function wanderRoomPlayer(...args) {
        return roomMotion.wanderRoomPlayer(...args);
    }

    function clearRoomPlayerBubbles(...args) {
        return roomMotion.clearRoomPlayerBubbles(...args);
    }

    function resetRoomPlayers(...args) {
        return roomMotion.resetRoomPlayers(...args);
    }

    function toggleRoomBehaviorFold(key) {
        setRoomBehaviorFoldOpen((current) => ({
            ...current,
            [key]: !current[key],
        }));
    }

    function renderRoomBehaviorFold(key, title, summary, children) {
        const open = roomBehaviorFoldOpen[key];
        return (
            <section className={`pixel-world-behavior-fold ${open ? 'open' : ''}`}>
                <button
                    type="button"
                    className="pixel-world-behavior-fold-head"
                    onClick={() => toggleRoomBehaviorFold(key)}
                    aria-expanded={open}
                >
                    <span>{ptxt(title)}</span>
                    {summary && <small>{ptxt(summary)}</small>}
                    <strong>{open ? tx('Collapse', '收起') : tx('Expand', '展开')}</strong>
                </button>
                {open && <div className="pixel-world-behavior-fold-body">{children}</div>}
            </section>
        );
    }

    function renderRoomPlayer(targetPlayer) {
        return (
            <RoomPlayer
                key={targetPlayer.id}
                targetPlayer={targetPlayer}
                getPlayerVisualDimensions={getPlayerVisualDimensions}
                controlledPlayerId={controlledPlayerId}
                tx={tx}
                players={players}
                activeBehaviorDialog={activeBehaviorDialog}
                zoom={zoom}
                stageSize={stageSize}
                ptxt={ptxt}
                chooseBehaviorDialogChoice={chooseBehaviorDialogChoice}
                behaviorLoading={behaviorLoading}
                exitBehaviorDialog={exitBehaviorDialog}
                continueBehaviorDialog={continueBehaviorDialog}
                showCollisionLines={showCollisionLines}
            />
        );
    }

    const aiLayout = useMemo(() => buildRoomEditorAiLayout(items, assetById, stageSize), [assetById, items, stageSize]);
    const aiLayoutPrompt = aiLayout.prompt;

    const roomBehaviorDebugJson = useMemo(() => {
        if (!roomBehaviorFoldOpen.debug) return '';
        return JSON.stringify(
            {
                scene: 'room',
                controlledPlayerId,
                playerScale,
                interaction: {
                    distance: Math.round(roomBehaviorInteractionState.distance),
                    nearby: roomBehaviorInteractionState.nearby,
                    threshold: commercialV2BehaviorInteractionDistance,
                },
                players: serializeRoomEditorPlayers(playersRef.current, controlledPlayerId, playerScale),
                anchors: roomAnchors.map((anchor) => ({
                    id: anchor.id,
                    name: anchor.name,
                    x: Math.round(anchor.anchor.x),
                    y: Math.round(anchor.anchor.y),
                })),
                aiGrid: {
                    size: aiLayout.gridSize,
                    ascii: aiLayout.ascii,
                },
                behaviorTree: createRoomEditorBehaviorTreeSnapshot(
                    itemsRef.current,
                    assetById,
                    playersRef.current,
                    controlledPlayerIdRef.current,
                    playerScaleRef.current,
                    stageSize,
                ),
                runtimeTree: behaviorTreeStateRef.current || behaviorTreeState,
            },
            null,
            2,
        );
    }, [
        aiLayout.ascii,
        aiLayout.gridSize,
        assetById,
        behaviorTreeState,
        controlledPlayerId,
        playerScale,
        roomAnchors,
        roomBehaviorFoldOpen.debug,
        roomBehaviorInteractionState.distance,
        roomBehaviorInteractionState.nearby,
        stageSize,
    ]);

    const buildRoomLayoutJson = useCallback(() => {
        const latestItems = itemsRef.current;
        const latestPlayers = playersRef.current;
        const latestControlledPlayerId = controlledPlayerIdRef.current;
        const latestPlayerScale = playerScaleRef.current;
        const latestAiLayout = buildRoomEditorAiLayout(latestItems, assetById, stageSize);
        const latestPlayerSnapshot = serializeRoomEditorPlayers(
            latestPlayers,
            latestControlledPlayerId,
            latestPlayerScale,
        );
        const latestBehaviorTreeSnapshot = createRoomEditorBehaviorTreeSnapshot(
            latestItems,
            assetById,
            latestPlayers,
            latestControlledPlayerId,
            latestPlayerScale,
            stageSize,
        );
        return JSON.stringify(
            {
                stage: stageSize,
                background: {
                    type: 'room-backdrop',
                    color: roomEditorBackgroundColor,
                    image: roomEditorBackdrop,
                    scale: zoom,
                },
                collision: {
                    unit: 'ratio-of-item-box',
                    mode: 'active',
                    lineVisibility: 'hidden-by-default',
                    groundLayer: 'ignored',
                },
                aiLayout: latestAiLayout,
                players: latestPlayerSnapshot,
                behaviorTree: {
                    ...latestBehaviorTreeSnapshot,
                    runtime_tree: behaviorTreeStateRef.current || behaviorTreeState,
                },
                anchors: roomAnchors,
                items: latestItems.map((item) => serializeRoomEditorItem(item, assetById.get(item.assetId))),
            },
            null,
            2,
        );
    }, [assetById, behaviorTreeState, roomAnchors, stageSize, zoom]);

    const layoutJson = useMemo(() => {
        const _LAYOUT_JSON_REFRESH_INPUTS = [controlledPlayerId, items, playerScale];
        return buildRoomLayoutJson();
    }, [buildRoomLayoutJson, controlledPlayerId, items, playerScale]);

    function renderRoomBehaviorActorCard(actorId, title, note) {
        const character = commercialV2PlayerCharacterById.get(actorId) || commercialV2PlayerCharacters[0];
        const actor = players[actorId] || createRoomEditorPlayerState(character);
        return (
            <div className={`pixel-world-behavior-actor ${actorId === commercialV2UserActorId ? 'user' : 'role'}`}>
                <img
                    src={commercialV2PlayerFrame(actor, `${actor.direction || 'front'}_walk_idle.png`)}
                    alt=""
                    draggable={false}
                />
                <div>
                    <strong>{ptxt(title)}</strong>
                    <span>
                        {ptxt(character.label)} · x{Math.round(actor.x)} y{Math.round(actor.y)}
                    </span>
                    <small>{ptxt(note)}</small>
                </div>
            </div>
        );
    }

    function renderRoomBehaviorTreePanel() {
        return (
            <RoomBehaviorPanel
                roomBehaviorPanelCollapsed={roomBehaviorPanelCollapsed}
                setRoomBehaviorPanelCollapsed={setRoomBehaviorPanelCollapsed}
                tx={tx}
                roomBehaviorInteractionState={roomBehaviorInteractionState}
                renderRoomBehaviorActorCard={renderRoomBehaviorActorCard}
                controlledPlayerId={controlledPlayerId}
                behaviorCharacterId={behaviorCharacterId}
                setBehaviorCharacterId={setBehaviorCharacterId}
                behaviorCharacters={behaviorCharacters}
                renderRoomBehaviorFold={renderRoomBehaviorFold}
                behaviorCharacter={behaviorCharacter}
                behaviorPlaceId={behaviorPlaceId}
                setBehaviorPlaceId={setBehaviorPlaceId}
                behaviorPlaceOptions={behaviorPlaceOptions}
                behaviorPromptText={behaviorPromptText}
                setBehaviorPromptText={setBehaviorPromptText}
                requestBehaviorInput={requestBehaviorInput}
                behaviorLoading={behaviorLoading}
                generateBaseBehaviorBranches={generateBaseBehaviorBranches}
                generateBehaviorBranch={generateBehaviorBranch}
                pickAutonomousBehaviorBranch={pickAutonomousBehaviorBranch}
                setBehaviorStatus={setBehaviorStatus}
                autonomousBehaviorCooldownRef={autonomousBehaviorCooldownRef}
                activateBehaviorBranch={activateBehaviorBranch}
                executeBehaviorBranch={executeBehaviorBranch}
                behaviorOutput={behaviorOutput}
                ptxt={ptxt}
                behaviorStatus={behaviorStatus}
                behaviorConfig={behaviorConfig}
                updateBehaviorConfig={updateBehaviorConfig}
                behaviorShowKey={behaviorShowKey}
                behaviorModelOptions={behaviorModelOptions}
                pullBehaviorModels={pullBehaviorModels}
                behaviorModelsLoading={behaviorModelsLoading}
                setBehaviorShowKey={setBehaviorShowKey}
                behaviorModelStatus={behaviorModelStatus}
                renderBehaviorContextGrid={renderBehaviorContextGrid}
                roomAnchors={roomAnchors}
                lang={lang}
                approachRoomPlayer={approachRoomPlayer}
                faceRoomPlayers={faceRoomPlayers}
                wanderRoomPlayer={wanderRoomPlayer}
                clearRoomPlayerBubbles={clearRoomPlayerBubbles}
                resetRoomPlayers={resetRoomPlayers}
                behaviorDebugRuntimeSummary={behaviorDebugRuntimeSummary}
                roomBehaviorDebugJson={roomBehaviorDebugJson}
            />
        );
    }

    useAutonomousBehavior({
        canRun: () =>
            Boolean(
                behaviorCharacterId &&
                    behaviorOrderedPlaces.length &&
                    !behaviorLoading &&
                    !activeBehaviorDialog &&
                    !interactionMenuOpen &&
                    !behaviorChoicePendingRef.current &&
                    !behaviorRuntimeRef.current &&
                    !isBehaviorInteractionSessionActive(),
            ),
        nearby: behaviorInteractionState.nearby,
        cooldownRef: autonomousBehaviorCooldownRef,
        pickBranch: pickAutonomousBehaviorBranch,
        activateBranch: activateBehaviorBranch,
        setStatus: setBehaviorRuntimeStatus,
    });
    const {
        resolveBehaviorAction,
        resolveBehaviorPlace,
        generateBehaviorBranch,
        mergeBehaviorTreePatch,
        generateBaseBehaviorBranches,
        buildBehaviorPayload,
    } = createRoomBehaviorRequests({
        behaviorAction,
        behaviorPlaceId,
        behaviorPlaceOptions,
        behaviorPlaceLinks,
        userProfile,
        playersRef,
        controlledPlayerIdRef,
        behaviorTreeState,
        behaviorConfig,
        behaviorPromptText,
        behaviorOrderedPlaces,
        roomBehaviorRequiredAnchorBranches,
        aiLayout,
        behaviorCharacterId,
        setBehaviorStatus,
        apiUrl,
        behaviorCharacter,
        setBehaviorLoading,
        setBehaviorOutput,
        commitBehaviorTreeState,
        setBehaviorAction,
        setBehaviorPlaceId,
        setWorldPlayerBubble,
        activateBehaviorBranch,
        clearBehaviorStatusHold,
        setRoomBehaviorFoldOpen,
        behaviorTreeStateRef,
        setBehaviorStatusPinned,
        autonomousBehaviorCursorRef,
        autonomousBehaviorRecentRef,
        clearBehaviorRuntime,
        autonomousBehaviorCooldownRef,
        persistBehaviorTreeStateToServer,
    });

    const { updateBehaviorConfig, pullBehaviorModels, requestBehaviorInput } = editorEnabled
        ? editorTools.createBehaviorDiagnostics({
              setBehaviorConfig,
              behaviorConfig,
              behaviorCharacterId,
              setBehaviorModelStatus,
              setBehaviorStatus,
              setBehaviorModelsLoading,
              apiUrl,
              setBehaviorModelOptions,
              behaviorCharacter,
              setBehaviorLoading,
              buildBehaviorPayload,
              setBehaviorOutput,
              commitBehaviorTreeState,
          })
        : {};

    const {
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
    } = editorEnabled
        ? editorTools.createLayoutActions({
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
          })
        : {};

    return (
        <div
            className={`pixel-world-editor room-editor ${!canEditLayout ? 'view-mode' : ''} ${editorEnabled ? 'scene-tools-open' : 'scene-player-mode'}`}
        >
            <ScenePlayerToolbar
                syncStatus={syncStatus}
                retrySync={retrySync}
                reloadServerTree={reloadServerTree}
                tx={tx}
                ptxt={ptxt}
                controlledPlayerId={controlledPlayerId}
                onControlPlayer={updateControlledPlayerId}
                behaviorCharacterId={behaviorCharacterId}
                behaviorCharacters={behaviorCharacters}
                onChooseCharacter={setBehaviorCharacterId}
                onGenerateBehavior={generateBaseBehaviorBranches}
                behaviorLoading={behaviorLoading}
                behaviorError={behaviorOutput?.error}
                canGenerate={Boolean(behaviorCharacterId)}
                zoom={zoom}
                setZoom={setZoom}
                maxZoom={1.25}
                toolsAvailable={Boolean(editorTools)}
                toolsOpen={editorEnabled}
                onToggleTools={toggleTools}
            />
            {editorEnabled && (
                <RoomEditorToolbar
                    saveLayout={saveLayout}
                    tx={tx}
                    viewMode={viewMode}
                    toggleViewMode={toggleViewMode}
                    ptxt={ptxt}
                    zoom={zoom}
                    showAdvancedToolbar={showAdvancedToolbar}
                    setShowAdvancedToolbar={setShowAdvancedToolbar}
                    saveCurrentAsDefaultScene={saveCurrentAsDefaultScene}
                    copyLayout={copyLayout}
                    copyAiLayout={copyAiLayout}
                    setZoom={setZoom}
                    showCollisionLines={showCollisionLines}
                    toggleCollisionLines={toggleCollisionLines}
                    showPlaceAnchors={showPlaceAnchors}
                    togglePlaceAnchors={togglePlaceAnchors}
                    showLayerPanel={showLayerPanel}
                    setShowLayerPanel={setShowLayerPanel}
                    playerScale={playerScale}
                    updatePlayerScale={updatePlayerScale}
                    canEditLayout={canEditLayout}
                    groupEditMode={groupEditMode}
                    setGroupEditMode={setGroupEditMode}
                    restoreResetBackup={restoreResetBackup}
                    resetLayout={resetLayout}
                    selectedItem={selectedItem}
                    scaleSelected={scaleSelected}
                    items={items}
                    cycleSelectedDirection={cycleSelectedDirection}
                    canRotateSelected={canRotateSelected}
                    moveSelectedLayer={moveSelectedLayer}
                    bringSelectedToFront={bringSelectedToFront}
                    sendSelectedToBack={sendSelectedToBack}
                    deleteSelected={deleteSelected}
                    notice={notice}
                />
            )}

            <div
                className={`pixel-world-editor-body room-editor-body ${roomBehaviorPanelCollapsed ? 'behavior-collapsed' : ''}`}
                style={{ '--pixel-world-room-frame-height': `${Math.ceil(stageSize.height * zoom + 38)}px` }}
            >
                {editorEnabled && (
                    <RoomAssetPanel
                        tx={tx}
                        groupedAssets={groupedAssets}
                        activeAssetGroup={activeAssetGroup}
                        setActiveAssetType={setActiveAssetType}
                        ptxt={ptxt}
                        addAsset={addAsset}
                        canEditLayout={canEditLayout}
                    />
                )}

                <div
                    className="pixel-world-editor-canvas-wrap room-editor-canvas"
                    ref={canvasWrapRef}
                    tabIndex={0}
                    onPointerDownCapture={focusCanvasForKeyboard}
                    aria-label={tx('Room asset canvas', '居住房间素材画布')}
                >
                    <div
                        className={`pixel-world-editor-stage pixel-world-room-editor-stage ${showCollisionLines ? 'collision-lines-visible' : ''}`}
                        ref={stageRef}
                        style={{
                            '--editor-zoom': zoom,
                            width: `${stageSize.width * zoom}px`,
                            height: `${stageSize.height * zoom}px`,
                            '--street-bg-color': roomEditorBackgroundColor,
                        }}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                    >
                        <div className="pixel-world-editor-bg" aria-hidden="true" />
                        <img
                            className="pixel-world-room-editor-backdrop"
                            src={scene.backdrop || roomEditorBackdrop}
                            alt=""
                            draggable={false}
                        />
                        {items.map((item, layerIndex) => {
                            const asset = assetById.get(item.assetId);
                            if (!asset) return null;
                            return renderRoomEditorItem(item, asset, layerIndex);
                        })}
                        {showPlaceAnchors &&
                            items.map((item, layerIndex) => {
                                const asset = assetById.get(item.assetId);
                                if (!asset) return null;
                                return renderRoomPlaceAnchor(item, asset, layerIndex);
                            })}
                        {commercialV2PlayerCharacters.map((character) =>
                            renderRoomPlayer(players[character.id] || createRoomEditorPlayerState(character)),
                        )}
                        {renderPlayerInteractionMenu()}
                    </div>
                </div>

                {editorEnabled && (
                    <RoomSelectionInspector
                        tx={tx}
                        viewMode={viewMode}
                        selectedItem={selectedItem}
                        selectedAsset={selectedAsset}
                        ptxt={ptxt}
                        selectedDirectionGroup={selectedDirectionGroup}
                        cycleSelectedDirection={cycleSelectedDirection}
                        canRotateSelected={canRotateSelected}
                        selectedDirection={selectedDirection}
                        updateSelectedDirection={updateSelectedDirection}
                        selectedIsGroundLayer={selectedIsGroundLayer}
                        updateSelectedGroundLayer={updateSelectedGroundLayer}
                        selectedPlace={selectedPlace}
                        showPlaceAnchors={showPlaceAnchors}
                        togglePlaceAnchors={togglePlaceAnchors}
                        selectedPlaceAnchorLocalPoint={selectedPlaceAnchorLocalPoint}
                        updateSelectedPlaceAnchorLocalPoint={updateSelectedPlaceAnchorLocalPoint}
                        resetSelectedPlaceAnchor={resetSelectedPlaceAnchor}
                        updateItem={updateItem}
                        nudgeSelected={nudgeSelected}
                        scaleSelected={scaleSelected}
                        groupEditMode={groupEditMode}
                        showCollisionLines={showCollisionLines}
                        toggleCollisionLines={toggleCollisionLines}
                        selectedCollision={selectedCollision}
                        selectedCollisionCanTakeEffect={selectedCollisionCanTakeEffect}
                        updateSelectedCollisionEnabled={updateSelectedCollisionEnabled}
                        selectedCollisionLocalBox={selectedCollisionLocalBox}
                        updateSelectedCollisionLocalBox={updateSelectedCollisionLocalBox}
                        resetSelectedCollision={resetSelectedCollision}
                        fitSelectedCollisionToSprite={fitSelectedCollisionToSprite}
                        showLayerPanel={showLayerPanel}
                        selectedLayerRow={selectedLayerRow}
                        layerRows={layerRows}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        aiLayoutPrompt={aiLayoutPrompt}
                        layoutJson={layoutJson}
                    />
                )}

                {editorEnabled && renderRoomBehaviorTreePanel()}
            </div>
        </div>
    );
}

export default RoomScene;
