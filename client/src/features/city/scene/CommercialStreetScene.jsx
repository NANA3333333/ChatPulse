import { useAutonomousBehavior } from './behavior/useAutonomousBehavior.js';
import { useStreetBehaviorRuntime } from './behavior/useStreetBehaviorRuntime.js';
import { useStreetMotion } from './movement/useStreetMotion.js';
import { useBehaviorSession } from './behavior/useBehaviorSession.js';
import { createStreetNavigation } from './movement/createStreetNavigation.js';
import { useBehaviorTreeSync } from './useBehaviorTreeSync.js';
import { ScenePlayerToolbar } from './components/ScenePlayerToolbar.jsx';
import { useSceneFitZoom } from './useSceneFitZoom.js';

import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { pixelTx, translatePixelText, translatePixelAction } from './pixelWorldI18n.js';
import {
    createCommercialV2PlayerStates,
    commercialV2DefaultControlledPlayerId,
    commercialV2RoleActorId,
    readStoredCommercialLayout,
    readStoredCommercialResetBackup,
    commercialV2DefaultZoom,
    commercialV2DefaultPlayerScale,
    getCommercialV2StageSize,
    commercialV2AssetCatalog,
    isCommercialV2WalkableAsset,
    isCommercialV2MainRoadAsset,
    isCommercialV2StreetCruiseRoadAsset,
    getCommercialV2CollisionWorldBox,
    getCommercialV2AutoRouteBlockWorldBox,
    buildCommercialV2Places,
    buildCommercialV2TravelTargetOptions,
    isCommercialV2DynamicOcclusionItem,
    commercialV2PlayerSize,
    getCommercialV2PlayerCharacter,
    canCommercialV2ItemCollisionTakeEffect,
    getCommercialV2EffectiveCollision,
    getCommercialV2CollisionLocalBox,
    buildCommercialV2ItemPlace,
    getCommercialV2PlaceAnchorLocalPoint,
    isCommercialV2GroundLayerAsset,
    isCommercialV2GroundLayerItem,
    isCommercialV2BackgroundSceneryAsset,
    isCommercialV2BackgroundSceneryItem,
    getCommercialV2ItemRenderZIndex,
    getLayoutBounds,
    createCommercialV2PlayerState,
    commercialV2PlayerCharacters,
    commercialV2PlayerCharacterById,
    commercialV2UserActorId,
    getCommercialV2LoopDeltaX,
    wrapLoopCoordinate,
    normalizeCommercialV2ItemLayerOrder,
    loadCommercialV2AssetSilhouette,
    commercialV2PlayerFrame,
    commercialV2SegmentSize,
    serializeCommercialV2Item,
    commercialV2BackgroundColor,
    getCommercialV2Loop,
    clampBox,
} from './commercialStreetCore.js';
import {
    readStoredCommercialBehaviorConfig,
    readStoredCommercialBehaviorTreeState,
    buildCommercialBehaviorContextStats,
    summarizeMountedGeneratedBehaviorBranches,
    commercialV2BehaviorImportantPlaceIds,
    commercialV2BehaviorPrimaryActionIds,
    commercialV2BehaviorActions,
    commercialV2BehaviorContextActionIds,
    commercialV2BehaviorInteractionDistance,
    commercialV2BehaviorConfigStorageKey,
    commercialV2BehaviorTreeStorageKey,
    createCommercialV2BehaviorTreeState,
    commercialV2BehaviorTreeUpdatedEvent,
    buildBehaviorTreeStorageSyncSignature,
    commercialV2BehaviorServerSceneKey,
} from './behaviorTreeCore.js';
import {
    readStoredCommercialV2BehaviorActorBindings,
    commercialV2BehaviorActorBindingStorageKey,
} from './commercialBehaviorBindings.js';
import { useEventCallback } from '../../../shared/hooks/useEventCallback.js';
import { CommercialInteractionMenu } from './components/CommercialInteractionMenu.jsx';
import { CommercialCanvasPanel } from './components/CommercialCanvasPanel.jsx';
import { CommercialParallaxPlanes } from './components/CommercialParallaxPlanes.jsx';
import {
    advanceCommercialParallaxCamera,
    commercialParallaxFactors,
    getCommercialParallaxShift,
} from './commercialParallax.js';
import { createCommercialBehaviorRequests } from './actions/createCommercialBehaviorRequests.js';

function CommercialStreetScene({ editorTools = null, apiUrl = '/api', userProfile = null, isActive = true }) {
    const { lang } = useLanguage();
    const [toolsOpen, setToolsOpen] = useState(false);
    const editorEnabled = Boolean(editorTools) && toolsOpen;
    const { CommercialEditorToolbar, CommercialBehaviorPanel, CommercialSelectionInspector, CommercialLayerPanel, CommercialAssetPanel } =
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
    const parallaxCameraRef = useRef(null);
    const loopScrollGuardRef = useRef(false);
    const loopScrollSettleTimerRef = useRef(null);
    const loopScrollPointerActiveRef = useRef(false);
    const loopScrollPendingNormalizeRef = useRef(false);
    const pendingLoopScrollRef = useRef('middle');
    const dragRef = useRef(null);
    const dragFrameRef = useRef(null);
    const pendingDragPointRef = useRef(null);

    const playersRef = useRef(createCommercialV2PlayerStates());
    const controlledPlayerIdRef = useRef(commercialV2DefaultControlledPlayerId);
    const playerRef = useRef(playersRef.current[commercialV2DefaultControlledPlayerId]);
    const playerSpawnedRef = useRef(false);

    const behaviorTreeStateRef = useRef(null);
    const behaviorTreeSyncSourceRef = useRef(`street-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const behaviorActorIdRef = useRef(commercialV2RoleActorId);
    const behaviorActorSyncRef = useRef('');

    const [initialLayout] = useState(() => readStoredCommercialLayout());
    const [items, setItemsState] = useState(initialLayout.items);
    const itemsRef = useRef(initialLayout.items);
    const [segmentCount, setSegmentCountState] = useState(initialLayout.segmentCount);
    const segmentCountRef = useRef(initialLayout.segmentCount);
    const [resetBackup, setResetBackup] = useState(() => readStoredCommercialResetBackup());
    const [selectedId, setSelectedId] = useState('');
    const [zoom, setZoom] = useState(Math.min(commercialV2DefaultZoom, 0.5));
    const [parallaxEnabled, setParallaxEnabled] = useState(true);
    const [visibleLoopCopies, setVisibleLoopCopies] = useState({ before: true, after: true });
    const visibleLoopCopiesRef = useRef({ before: true, after: true });
    const [viewMode, setViewMode] = useState(true);
    const [groupEditMode, setGroupEditMode] = useState(false);
    const [showCollisionLines, setShowCollisionLines] = useState(false);
    const [showPlaceAnchors, setShowPlaceAnchors] = useState(false);
    const [showLayerPanel, setShowLayerPanel] = useState(false);
    const [hiddenLayerItemIds, setHiddenLayerItemIds] = useState(() => new Set());
    useEffect(() => {
        if (!showLayerPanel) return;
        setBehaviorPanelCollapsed(true);
        setAssetPanelOpen(false);
    }, [showLayerPanel]);
    const [showAdvancedToolbar, setShowAdvancedToolbar] = useState(false);
    const [assetPanelOpen, setAssetPanelOpen] = useState(false);
    const [activeAssetType, setActiveAssetType] = useState('建筑');
    const [autoTargetId, setAutoTargetId] = useState('');
    const [autoTravelActive, setAutoTravelActive] = useState(false);
    const [notice, setNotice] = useState('观赏模式已开启：素材已锁定，可以安心浏览和控制小人。');
    const [controlledPlayerId, setControlledPlayerId] = useState(commercialV2DefaultControlledPlayerId);
    const [players, setPlayers] = useState(() => createCommercialV2PlayerStates());
    const [playerScale, setPlayerScale] = useState(commercialV2DefaultPlayerScale);
    const [playerActionBubble, setPlayerActionBubble] = useState('');
    const [playerActionBubbles, setPlayerActionBubbles] = useState({});

    const [assetSilhouettes, setAssetSilhouettes] = useState({});
    const [behaviorCharacters, setBehaviorCharacters] = useState([]);
    const [behaviorActorId, setBehaviorActorId] = useState(commercialV2RoleActorId);
    const [behaviorActorBindings, setBehaviorActorBindings] = useState(() =>
        readStoredCommercialV2BehaviorActorBindings(),
    );
    const [behaviorCharacterId, setBehaviorCharacterId] = useState('');
    const [behaviorAction, setBehaviorAction] = useState('greet');
    const [behaviorPlaceId, setBehaviorPlaceId] = useState('');
    const [behaviorPromptText, setBehaviorPromptText] = useState('');
    const [behaviorConfig, setBehaviorConfig] = useState(() => readStoredCommercialBehaviorConfig());
    const [behaviorModelOptions, setBehaviorModelOptions] = useState([]);
    const [behaviorInput, setBehaviorInput] = useState(null);
    const [behaviorOutput, setBehaviorOutput] = useState(null);
    const [behaviorTreeState, setBehaviorTreeState] = useState(() => readStoredCommercialBehaviorTreeState());
    const [behaviorPatchOutput, setBehaviorPatchOutput] = useState(null);
    const [activeBehaviorBranch, setActiveBehaviorBranch] = useState(null);
    const [behaviorStatus, setBehaviorStatus] = useState('等待读取 AI 上文。');
    const [behaviorModelStatus, setBehaviorModelStatus] = useState(
        '默认使用绑定角色的模型配置；需要覆盖时再填写 URL 和 Key。',
    );
    const [behaviorLoading, setBehaviorLoading] = useState(false);
    const [behaviorModelsLoading, setBehaviorModelsLoading] = useState(false);
    const [behaviorShowKey, setBehaviorShowKey] = useState(false);
    const [behaviorPanelCollapsed, setBehaviorPanelCollapsed] = useState(true);
    const [behaviorFoldOpen, setBehaviorFoldOpen] = useState({
        selection: false,
        model: false,
        context: false,
        constraints: false,
        branchMap: false,
        interaction: false,
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
    const behaviorRuntimeSummary = tx(
        `Version ${behaviorTreeState.version} · patch ${behaviorTreeState.patch_history?.length || 0} · AI daily ${mountedGeneratedBehavior.base_count} · interaction ${mountedGeneratedBehavior.interaction_count}`,
        `版本 ${behaviorTreeState.version} · patch ${behaviorTreeState.patch_history?.length || 0} · AI 日常 ${mountedGeneratedBehavior.base_count} · 互动 ${mountedGeneratedBehavior.interaction_count}`,
    );
    const stageSize = useMemo(() => getCommercialV2StageSize(segmentCount, items), [items, segmentCount]);
    useSceneFitZoom(canvasWrapRef, stageSize.height, Math.min(commercialV2DefaultZoom, 0.5), setZoom);
    const assetById = useMemo(() => new Map(commercialV2AssetCatalog.map((asset) => [asset.id, asset])), []);
    const walkableRects = useMemo(
        () =>
            items
                .filter((item) => isCommercialV2WalkableAsset(item.assetId))
                .map((item) => ({
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h,
                })),
        [items],
    );
    const mainRoadRects = useMemo(
        () =>
            items
                .filter((item) => isCommercialV2MainRoadAsset(item.assetId))
                .map((item) => ({
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h,
                })),
        [items],
    );
    const streetCruiseRoadRects = useMemo(
        () =>
            items
                .filter((item) => isCommercialV2StreetCruiseRoadAsset(item.assetId))
                .map((item) => ({
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h,
                })),
        [items],
    );
    const collisionRects = useMemo(
        () =>
            items
                .map((item) => {
                    const asset = assetById.get(item.assetId);
                    const collisionBox = getCommercialV2CollisionWorldBox(item, asset);
                    if (!collisionBox) return null;
                    return {
                        id: item.id,
                        ...collisionBox,
                    };
                })
                .filter(Boolean),
        [assetById, items],
    );
    const autoRouteBlockRects = useMemo(
        () =>
            items
                .map((item) => {
                    const asset = assetById.get(item.assetId);
                    const routeBlockBox = getCommercialV2AutoRouteBlockWorldBox(item, asset);
                    if (!routeBlockBox) return null;
                    return {
                        id: item.id,
                        ...routeBlockBox,
                    };
                })
                .filter(Boolean),
        [assetById, items],
    );
    const placeLinks = useMemo(() => buildCommercialV2Places(items, assetById), [assetById, items]);
    const travelTargetOptions = useMemo(() => buildCommercialV2TravelTargetOptions(placeLinks), [placeLinks]);
    const behaviorOrderedPlaces = useMemo(
        () =>
            placeLinks
                .filter((place) => commercialV2BehaviorImportantPlaceIds.has(place.placeId))
                .slice()
                .sort((a, b) => (a.anchor?.x || 0) - (b.anchor?.x || 0))
                .map((place, index) => ({
                    ...place,
                    order: index + 1,
                })),
        [placeLinks],
    );
    const behaviorPlaceOptions = useMemo(() => {
        const importantOptions = behaviorOrderedPlaces.map((place) => ({
            id: place.placeId,
            label: place.name,
            order: place.order,
        }));
        return importantOptions.length ? importantOptions : travelTargetOptions;
    }, [behaviorOrderedPlaces, travelTargetOptions]);
    const silhouetteAssetIds = useMemo(
        () =>
            Array.from(
                new Set(
                    items
                        .filter((item) => isCommercialV2DynamicOcclusionItem(item, assetById.get(item.assetId)))
                        .map((item) => item.assetId),
                ),
            ),
        [assetById, items],
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
    const selectedItem = items.find((item) => item.id === selectedId) || null;
    const selectedAsset = selectedItem ? assetById.get(selectedItem.assetId) : null;
    const selectedCollisionCanTakeEffect = Boolean(
        selectedItem && selectedAsset && canCommercialV2ItemCollisionTakeEffect(selectedItem, selectedAsset),
    );
    const selectedCollision =
        selectedItem && selectedAsset ? getCommercialV2EffectiveCollision(selectedItem, selectedAsset) : null;
    const selectedCollisionLocalBox =
        selectedItem && selectedAsset ? getCommercialV2CollisionLocalBox(selectedItem, selectedAsset) : null;
    const selectedPlace =
        selectedItem && selectedAsset ? buildCommercialV2ItemPlace(selectedItem, selectedAsset) : null;
    const selectedPlaceAnchorLocalPoint =
        selectedItem && selectedAsset ? getCommercialV2PlaceAnchorLocalPoint(selectedItem, selectedAsset) : null;
    const selectedIsBuiltInGroundLayer = Boolean(selectedAsset && isCommercialV2GroundLayerAsset(selectedAsset));
    const selectedIsGroundLayer = Boolean(
        selectedItem && selectedAsset && isCommercialV2GroundLayerItem(selectedItem, selectedAsset),
    );
    const selectedIsBackgroundSceneryAsset = Boolean(
        selectedAsset && isCommercialV2BackgroundSceneryAsset(selectedAsset),
    );
    const layerRows = useMemo(
        () =>
            items.map((item, layerIndex) => {
                const asset = assetById.get(item.assetId);
                const isGround = Boolean(asset && isCommercialV2GroundLayerItem(item, asset));
                const isBackgroundScenery = Boolean(asset && isCommercialV2BackgroundSceneryItem(item, asset));
                const sceneryGroup = asset?.type === '天空' ? 'far' : isBackgroundScenery ? 'middle' : 'near';
                const playerRule =
                    asset?.type === '天空'
                        ? '天空底层'
                        : isBackgroundScenery
                          ? '背景树木 / 天空上方 / 地面下方'
                          : asset?.type === '道路'
                            ? '地面层 / 背景树木上方 / 人物下方'
                            : '普通素材 / 地面上方 / 遮挡判断';
                return {
                    item,
                    asset,
                    layerIndex,
                    zIndex: getCommercialV2ItemRenderZIndex(layerIndex, item, asset),
                    isGround,
                    isBackgroundScenery,
                    sceneryGroup,
                    playerRule,
                };
            }),
        [assetById, items],
    );
    const selectedLayerRow = selectedId ? layerRows.find((row) => row.item.id === selectedId) || null : null;
    const layoutBounds = useMemo(() => getLayoutBounds(items), [items]);
    const groupedAssets = useMemo(() => {
        const groups = new Map();
        commercialV2AssetCatalog.forEach((asset) => {
            if (!groups.has(asset.type)) groups.set(asset.type, []);
            groups.get(asset.type).push(asset);
        });
        return Array.from(groups.entries());
    }, []);
    const activeAssetGroup = groupedAssets.find(([type]) => type === activeAssetType) || groupedAssets[0];
    const canEditLayout = editorEnabled && !viewMode;
    const setLayerVisibility = useCallback((itemIds, visible) => {
        setHiddenLayerItemIds((previous) => {
            const next = new Set(previous);
            itemIds.forEach((id) => visible ? next.delete(id) : next.add(id));
            return next;
        });
    }, []);
    const player =
        players[controlledPlayerId] ||
        players[commercialV2DefaultControlledPlayerId] ||
        createCommercialV2PlayerState(commercialV2PlayerCharacters[0]);
    const behaviorTargetActorId = commercialV2PlayerCharacterById.has(behaviorActorId)
        ? behaviorActorId
        : commercialV2RoleActorId;
    const behaviorUserActorId =
        behaviorTargetActorId === commercialV2UserActorId ? commercialV2RoleActorId : commercialV2UserActorId;
    const behaviorActorCharacter =
        commercialV2PlayerCharacterById.get(behaviorTargetActorId) || commercialV2PlayerCharacters[0];
    const behaviorUserCharacter =
        commercialV2PlayerCharacterById.get(behaviorUserActorId) || commercialV2PlayerCharacters[0];
    const behaviorTargetActor = players[behaviorTargetActorId] || createCommercialV2PlayerState(behaviorActorCharacter);
    const behaviorUserActor = players[behaviorUserActorId] || createCommercialV2PlayerState(behaviorUserCharacter);
    const behaviorBoundCharacterId = behaviorActorBindings[behaviorTargetActorId] || '';
    const behaviorBoundCharacter = behaviorCharacters.find((item) => item.id === behaviorBoundCharacterId) || null;
    const behaviorSelectedCharacter = behaviorCharacters.find((item) => item.id === behaviorCharacterId) || null;
    const behaviorRequestCharacterId = behaviorBoundCharacterId || behaviorCharacterId;
    const behaviorCharacter =
        behaviorCharacters.find((item) => item.id === behaviorRequestCharacterId) ||
        behaviorSelectedCharacter ||
        behaviorBoundCharacter ||
        behaviorCharacters[0] ||
        null;
    const activeBehaviorCharacterId = behaviorCharacter?.id || '';
    const behaviorBindingSummary = behaviorBoundCharacter
        ? `${ptxt(behaviorActorCharacter.label)} -> ${behaviorBoundCharacter.name || behaviorBoundCharacter.id}`
        : tx(
              `${ptxt(behaviorActorCharacter.label)} is not bound to an actual character`,
              `${behaviorActorCharacter.label} 尚未绑定实际角色`,
          );
    const controlledBoundCharacterId = behaviorActorBindings[controlledPlayerId] || '';
    const controlledBoundCharacter = behaviorCharacters.find((item) => item.id === controlledBoundCharacterId) || null;
    const controlledBindingSummary = controlledBoundCharacter
        ? tx(
              `Bound: ${controlledBoundCharacter.name || controlledBoundCharacter.id}`,
              `已绑定：${controlledBoundCharacter.name || controlledBoundCharacter.id}`,
          )
        : tx('Not bound', '未绑定');
    const behaviorSession = useBehaviorSession({
        behaviorTreeState,
        setBehaviorStatus,
        behaviorTreeStateRef,
        behaviorOrderedPlaces,
        behaviorCharacterId: activeBehaviorCharacterId,
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
    const behaviorInteractionState = useMemo(() => {
        const dx = getCommercialV2LoopDeltaX(behaviorTargetActor.x, behaviorUserActor.x, stageSize.width);
        const dy = behaviorUserActor.y - behaviorTargetActor.y;
        const distance = Math.hypot(dx, dy);
        let side = dx >= 0 ? 'left' : 'right';
        if (behaviorTargetActor.x < 320) side = 'right';
        if (behaviorTargetActor.x > stageSize.width - 320) side = 'left';
        const bodyY = behaviorTargetActor.y - playerDimensions.height * 0.42 + playerDimensions.footOffset;
        const menuY = Math.max(96, Math.min(stageSize.height - 90, bodyY));
        return {
            distance,
            nearby: distance <= commercialV2BehaviorInteractionDistance,
            x: wrapLoopCoordinate(behaviorTargetActor.x, stageSize.width),
            y: menuY,
            side,
        };
    }, [
        behaviorTargetActor.x,
        behaviorTargetActor.y,
        behaviorUserActor.x,
        behaviorUserActor.y,
        playerDimensions.footOffset,
        playerDimensions.height,
        stageSize.height,
        stageSize.width,
    ]);

    // Keep polling, storage listeners and animation loops on the latest scene state.
    const clearBehaviorRuntimeEvent = useEventCallback(clearBehaviorRuntime);
    const activateBehaviorTravelFailureBranchEvent = useEventCallback(activateBehaviorTravelFailureBranch);
    const normalizeLoopScrollAfterSettleEvent = useEventCallback(normalizeLoopScrollAfterSettle);

    const {
        isPlayerPositionAllowed,
        buildAutoTravelPath,
        buildSafePlayerStates,
        getNearestWalkablePlayerPoint,
        buildStreetCruiseSegment,
        resolveAutoTravelTarget,
        buildBehaviorSmoothTravelPath,
        resolvePlayerGroundMove,
    } = useMemo(
        () =>
            createStreetNavigation({
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
            }),
        [
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
        ],
    );

    const setPlayerById = useCallback((playerId, updater) => {
        const character = commercialV2PlayerCharacterById.get(playerId) || commercialV2PlayerCharacters[0];
        setPlayers((currentPlayers) => {
            const currentPlayer = currentPlayers[playerId] || createCommercialV2PlayerState(character);
            const nextPatch = typeof updater === 'function' ? updater(currentPlayer) : updater;
            const nextPlayer = {
                ...currentPlayer,
                ...nextPatch,
                id: playerId,
                characterId: currentPlayer.characterId || playerId,
            };
            const nextPlayers = {
                ...currentPlayers,
                [playerId]: nextPlayer,
            };
            playersRef.current = nextPlayers;
            if (playerId === controlledPlayerIdRef.current) playerRef.current = nextPlayer;
            return nextPlayers;
        });
    }, []);

    const setPlayer = useCallback(
        (updater) => {
            setPlayerById(controlledPlayerIdRef.current, updater);
        },
        [setPlayerById],
    );

    const streetMotion = useStreetMotion({
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
    });

    const { autoTravelRef } = streetMotion;

    const streetBehavior = useStreetBehaviorRuntime({
        selection: {
            behaviorAction,
            setBehaviorAction,
            behaviorPlaceId,
            behaviorLoading,
            behaviorPlaceOptions,
            behaviorCharacter,
            activeBehaviorCharacterId,
            behaviorInteractionState,
        },
        actors: {
            playersRef,
            setPlayerById,
            setWorldPlayerBubble,
            getCurrentBehaviorActorId: (...args) => getCurrentBehaviorActorId(...args),
            getCurrentBehaviorUserActorId: (...args) => getCurrentBehaviorUserActorId(...args),
        },
        tree: { behaviorTreeStateRef, behaviorTreeState, behaviorOrderedPlaces, commitBehaviorTreeState },
        session: {
            behaviorInteractionSessionRef,
            autonomousBehaviorCooldownRef,
            keepBehaviorInteractionSessionActive,
            setBehaviorRuntimeStatus,
        },
        navigation: {
            stageSize,
            buildAutoTravelPath,
            getNearestWalkablePlayerPoint,
            resolveAutoTravelTarget,
            buildBehaviorSmoothTravelPath,
        },
        motion: { setAutoTravelActive, autoTravelRef },
        presentation: {
            setNotice,
            setPlayerActionBubble,
            setBehaviorInput,
            setBehaviorOutput,
            setActiveBehaviorBranch,
            setBehaviorStatus,
        },
        generation: {
            resolveBehaviorAction: (...args) => resolveBehaviorAction(...args),
            resolveBehaviorPlace: (...args) => resolveBehaviorPlace(...args),
            buildBehaviorPendingInput: (...args) => buildBehaviorPendingInput(...args),
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
    } = streetBehavior;

    useEffect(() => {
        if (!behaviorInteractionState.nearby || activeBehaviorDialog) {
            setInteractionMenuOpen(false);
        }
    }, [activeBehaviorDialog, behaviorInteractionState.nearby, setInteractionMenuOpen]);

    function setWorldPlayerBubble(playerId, text) {
        const safeText = String(text || '')
            .trim()
            .slice(0, 80);
        setPlayerActionBubbles((current) => {
            const next = { ...current };
            if (safeText) next[playerId] = safeText;
            else delete next[playerId];
            return next;
        });
        if (playerId === controlledPlayerIdRef.current) {
            setPlayerActionBubble(safeText);
        }
    }

    const commitItems = useCallback(
        (updater) => {
            const previous = itemsRef.current;
            const next = typeof updater === 'function' ? updater(previous) : updater;
            const orderedNext = Array.isArray(next) ? normalizeCommercialV2ItemLayerOrder(next, assetById) : next;
            itemsRef.current = orderedNext;
            setItemsState(orderedNext);
            return orderedNext;
        },
        [assetById],
    );
    const nudgeLayerGroup = useCallback((group, dx, dy) => {
        if (!canEditLayout) return;
        const ids = new Set(layerRows.filter((row) => row.sceneryGroup === group).map((row) => row.item.id));
        commitItems((previous) => previous.map((item) => ids.has(item.id)
            ? clampBox({ ...item, x: item.x + dx, y: item.y + dy }, stageSize)
            : item));
    }, [canEditLayout, commitItems, layerRows, stageSize]);
    const scaleLayerGroup = useCallback((group, multiplier) => {
        if (!canEditLayout) return;
        const members = layerRows.filter((row) => row.sceneryGroup === group).map((row) => row.item);
        if (!members.length) return;
        const ids = new Set(members.map((item) => item.id));
        const minX = Math.min(...members.map((item) => item.x));
        const maxX = Math.max(...members.map((item) => item.x + item.w));
        const maxY = Math.max(...members.map((item) => item.y + item.h));
        const originX = (minX + maxX) / 2;
        commitItems((previous) => previous.map((item) => ids.has(item.id)
            ? clampBox({
                ...item,
                x: originX + (item.x - originX) * multiplier,
                y: maxY + (item.y - maxY) * multiplier,
                w: item.w * multiplier,
                h: item.h * multiplier,
            }, stageSize)
            : item));
    }, [canEditLayout, commitItems, layerRows, stageSize]);

    const commitSegmentCount = useCallback((updater) => {
        const previous = segmentCountRef.current;
        const next = typeof updater === 'function' ? updater(previous) : updater;
        segmentCountRef.current = next;
        setSegmentCountState(next);
        return next;
    }, []);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        segmentCountRef.current = segmentCount;
    }, [segmentCount]);

    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    useEffect(() => {
        controlledPlayerIdRef.current = controlledPlayerId;
    }, [controlledPlayerId]);

    useEffect(() => {
        behaviorActorIdRef.current = behaviorTargetActorId;
    }, [behaviorTargetActorId]);

    useEffect(() => {
        playerRef.current = player;
    }, [player]);

    useEffect(() => {
        if (!travelTargetOptions.length) {
            setAutoTargetId('');
            return;
        }
        if (autoTargetId && travelTargetOptions.some((option) => option.id === autoTargetId)) return;
        const preferredTarget =
            travelTargetOptions.find((option) => option.id === 'convenience') ||
            travelTargetOptions.find((option) => option.id === 'restaurant') ||
            travelTargetOptions[0];
        setAutoTargetId(preferredTarget.id);
    }, [autoTargetId, travelTargetOptions]);

    useEffect(() => {
        if (!behaviorPlaceOptions.length) {
            setBehaviorPlaceId('');
            return;
        }
        if (behaviorPlaceId && behaviorPlaceOptions.some((option) => option.id === behaviorPlaceId)) return;
        const preferredTarget =
            behaviorPlaceOptions.find((option) => option.id === 'restaurant') ||
            behaviorPlaceOptions.find((option) => option.id === 'convenience') ||
            behaviorPlaceOptions[0];
        setBehaviorPlaceId(preferredTarget.id);
    }, [behaviorPlaceId, behaviorPlaceOptions]);

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
            // Ignore storage failures; the API key is intentionally never persisted here.
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
            localStorage.setItem(commercialV2BehaviorTreeStorageKey, JSON.stringify(treeToStore));
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
            localStorage.setItem(commercialV2BehaviorTreeStorageKey, JSON.stringify(nextTree));
        } catch {
            // The tree can still live in memory if browser storage is full or unavailable.
        }
        if (!options.skipBroadcast && typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent(commercialV2BehaviorTreeUpdatedEvent, {
                    detail: {
                        storageKey: commercialV2BehaviorTreeStorageKey,
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
        sceneKey: commercialV2BehaviorServerSceneKey,
        storageKey: commercialV2BehaviorTreeStorageKey,
        enabled: isActive && behaviorOrderedPlaces.length > 0,
        getTree: () => behaviorTreeStateRef.current || behaviorTreeState,
        canApplyRemote: () => !behaviorLoading && !interactionMenuOpen && !isBehaviorInteractionSessionActive(),
        getMeta: () => ({
            scene: 'commercial_street',
            character_id: activeBehaviorCharacterId || '',
            character_name: behaviorCharacter?.name || '',
        }),
        applyRemote: (tree) => {
            const nextTree = tree;
            behaviorTreeStateRef.current = nextTree;
            try {
                localStorage.setItem(commercialV2BehaviorTreeStorageKey, JSON.stringify(nextTree));
            } catch {
                /* State remains usable in memory. */
            }
            setBehaviorTreeState(nextTree);
            clearBehaviorRuntimeEvent('');
            autonomousBehaviorCursorRef.current = 0;
            autonomousBehaviorRecentRef.current = [];
            setBehaviorStatusPinned('已加载服务器保存的商业街行为树。', 12000);
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
                sourceLabel === 'storage'
                    ? '已同步其他标签页生成的商业街行为树。'
                    : '已同步页面内最新生成的商业街行为树。',
                30000,
            );
        };
        const onBehaviorTreeUpdated = (event) => {
            const detail = event?.detail || {};
            if (detail.storageKey !== commercialV2BehaviorTreeStorageKey) return;
            if (detail.sourceId === behaviorTreeSyncSourceRef.current) return;
            applySyncedBehaviorTree(detail.tree || readStoredCommercialBehaviorTreeState(), 'event');
        };
        const onBehaviorTreeStorage = (event) => {
            if (event.key !== commercialV2BehaviorTreeStorageKey) return;
            applySyncedBehaviorTree(readStoredCommercialBehaviorTreeState(), 'storage');
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
        try {
            localStorage.setItem(commercialV2BehaviorActorBindingStorageKey, JSON.stringify(behaviorActorBindings));
        } catch {
            // Bindings are a convenience layer; behavior requests can still use the current selector.
        }
    }, [behaviorActorBindings]);

    useEffect(() => {
        if (!behaviorCharacters.length) return;
        const characterIds = new Set(behaviorCharacters.map((item) => item.id));
        setBehaviorActorBindings((current) => {
            const next = Object.entries(current).reduce((result, [actorId, characterId]) => {
                if (commercialV2PlayerCharacterById.has(actorId) && characterIds.has(characterId)) {
                    result[actorId] = characterId;
                }
                return result;
            }, {});
            const same =
                Object.keys(next).length === Object.keys(current).length &&
                Object.entries(next).every(([actorId, characterId]) => current[actorId] === characterId);
            return same ? current : next;
        });
    }, [behaviorCharacters]);

    useEffect(() => {
        if (!behaviorCharacters.length) {
            setBehaviorCharacterId('');
            return;
        }
        const characterIds = new Set(behaviorCharacters.map((item) => item.id));
        const preferred =
            behaviorCharacters.find((item) => Number(item.sys_survival ?? 1) === 1) || behaviorCharacters[0];
        const boundCharacterId = behaviorActorBindings[behaviorTargetActorId] || '';
        const actorChanged = behaviorActorSyncRef.current !== behaviorTargetActorId;
        if (actorChanged) {
            behaviorActorSyncRef.current = behaviorTargetActorId;
            if (boundCharacterId && characterIds.has(boundCharacterId)) {
                setBehaviorCharacterId(boundCharacterId);
                return;
            }
        }
        if (!behaviorCharacterId || !characterIds.has(behaviorCharacterId)) {
            setBehaviorCharacterId(preferred?.id || '');
        }
    }, [behaviorActorBindings, behaviorCharacterId, behaviorCharacters, behaviorTargetActorId]);

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
        const missingAssetIds = silhouetteAssetIds.filter((assetId) => assetSilhouettes[assetId] === undefined);
        if (!missingAssetIds.length) return undefined;
        let cancelled = false;
        Promise.all(missingAssetIds.map((assetId) => loadCommercialV2AssetSilhouette(assetById.get(assetId)))).then(
            (results) => {
                if (cancelled) return;
                setAssetSilhouettes((current) => {
                    const next = { ...current };
                    results.forEach((result) => {
                        if (!result) return;
                        next[result.assetId] = result.silhouette;
                    });
                    return next;
                });
            },
        );
        return () => {
            cancelled = true;
        };
    }, [assetById, assetSilhouettes, silhouetteAssetIds]);

    function updatePlayerScale(value) {
        const next = Math.max(0.6, Math.min(3, Number(value) || commercialV2DefaultPlayerScale));
        setPlayerScale(Number(next.toFixed(2)));
    }

    function toggleCollisionLines() {
        setShowCollisionLines((enabled) => {
            const next = !enabled;
            setNotice(
                next
                    ? '碰撞箱线已显示：绿色线是真实阻挡范围，黄色线是角色之间的脚底占位；地面层碰撞箱不参与阻挡。'
                    : '碰撞箱线已隐藏，非地面层碰撞仍然默认生效。',
            );
            return next;
        });
    }

    function togglePlaceAnchors() {
        setShowPlaceAnchors((enabled) => {
            const next = !enabled;
            setNotice(
                next
                    ? '地点锚点已显示：粉色点是角色后续自动前往和交互的位置。'
                    : '地点锚点已隐藏，地点联动数据仍会保留在布局 JSON。',
            );
            return next;
        });
    }

    function focusCanvasForKeyboard() {
        const activeElement = document.activeElement;
        const activeTag = activeElement?.tagName?.toLowerCase();
        if (
            activeElement?.isContentEditable ||
            activeTag === 'input' ||
            activeTag === 'textarea' ||
            activeTag === 'select'
        ) {
            activeElement.blur();
        }
        canvasWrapRef.current?.focus?.({ preventScroll: true });
    }

    function runPlayerInteraction(...args) {
        return streetBehavior.runPlayerInteraction(...args);
    }

    function continueBehaviorDialog(...args) {
        return streetBehavior.continueBehaviorDialog(...args);
    }

    function exitBehaviorDialog(...args) {
        return streetBehavior.exitBehaviorDialog(...args);
    }

    function chooseBehaviorDialogChoice(...args) {
        return streetBehavior.chooseBehaviorDialogChoice(...args);
    }

    function executeBehaviorBranch(...args) {
        return streetBehavior.executeBehaviorBranch(...args);
    }

    function renderPlayerInteractionMenu() {
        return (
            <CommercialInteractionMenu
                behaviorInteractionState={behaviorInteractionState}
                activeBehaviorDialog={activeBehaviorDialog}
                stageSize={stageSize}
                interactionMenuOpen={interactionMenuOpen}
                setInteractionMenuOpen={setInteractionMenuOpen}
                behaviorLoading={behaviorLoading}
                activeBehaviorCharacterId={activeBehaviorCharacterId}
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

    function renderBehaviorActorCard(actorId, title, note) {
        const character = commercialV2PlayerCharacterById.get(actorId) || commercialV2PlayerCharacters[0];
        const actor = players[actorId] || createCommercialV2PlayerState(character);
        const actorKind = actorId === behaviorTargetActorId ? 'role' : 'user';
        return (
            <div className={`pixel-world-behavior-actor ${actorKind}`}>
                <img
                    src={commercialV2PlayerFrame(actor, `${actor.direction || 'front'}_walk_idle.png`)}
                    alt=""
                    draggable={false}
                />
                <div>
                    <strong>{ptxt(title)}</strong>
                    <span>
                        {ptxt(character.label)} · {tx('Street translation', '平移街区')}
                    </span>
                    <small>{ptxt(note)}</small>
                </div>
            </div>
        );
    }

    function toggleBehaviorFold(key) {
        setBehaviorFoldOpen((current) => ({
            ...current,
            [key]: !current[key],
        }));
    }

    function renderBehaviorFold(key, title, summary, children) {
        const open = behaviorFoldOpen[key];
        return (
            <section className={`pixel-world-behavior-fold ${open ? 'open' : ''}`}>
                <button
                    type="button"
                    className="pixel-world-behavior-fold-head"
                    onClick={() => toggleBehaviorFold(key)}
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

    function getSelectionFoldSummary() {
        if (viewMode) return tx('View Mode', '观赏模式');
        if (selectedItem && selectedAsset) return ptxt(selectedAsset.name);
        return tx('No Selection', '未选中');
    }

    function renderSelectionInspectorContent() {
        return (
            <CommercialSelectionInspector
                viewMode={viewMode}
                tx={tx}
                selectedItem={selectedItem}
                selectedAsset={selectedAsset}
                ptxt={ptxt}
                selectedIsGroundLayer={selectedIsGroundLayer}
                selectedIsBuiltInGroundLayer={selectedIsBuiltInGroundLayer}
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
                layoutJson={layoutJson}
            />
        );
    }

    function renderBehaviorTreePanel() {
        return (
            <CommercialBehaviorPanel
                behaviorLoading={behaviorLoading}
                tx={tx}
                behaviorOutput={behaviorOutput}
                behaviorPanelCollapsed={behaviorPanelCollapsed}
                setBehaviorPanelCollapsed={setBehaviorPanelCollapsed}
                ptxt={ptxt}
                behaviorStatus={behaviorStatus}
                renderBehaviorActorCard={renderBehaviorActorCard}
                behaviorTargetActorId={behaviorTargetActorId}
                behaviorBoundCharacter={behaviorBoundCharacter}
                behaviorUserActorId={behaviorUserActorId}
                userProfile={userProfile}
                setBehaviorActorId={setBehaviorActorId}
                behaviorCharacterId={behaviorCharacterId}
                setBehaviorCharacterId={setBehaviorCharacterId}
                behaviorCharacters={behaviorCharacters}
                bindBehaviorActorToCharacter={bindBehaviorActorToCharacter}
                bindControlledSkinToBehaviorCharacter={bindControlledSkinToBehaviorCharacter}
                addRoleCharacter={addRoleCharacter}
                behaviorBindingSummary={behaviorBindingSummary}
                renderBehaviorFold={renderBehaviorFold}
                getSelectionFoldSummary={getSelectionFoldSummary}
                renderSelectionInspectorContent={renderSelectionInspectorContent}
                behaviorConfig={behaviorConfig}
                behaviorCharacter={behaviorCharacter}
                updateBehaviorConfig={updateBehaviorConfig}
                behaviorShowKey={behaviorShowKey}
                behaviorModelOptions={behaviorModelOptions}
                pullBehaviorModels={pullBehaviorModels}
                behaviorModelsLoading={behaviorModelsLoading}
                setBehaviorShowKey={setBehaviorShowKey}
                behaviorModelStatus={behaviorModelStatus}
                behaviorContextStats={behaviorContextStats}
                lang={lang}
                behaviorOrderedPlaces={behaviorOrderedPlaces}
                behaviorInteractionState={behaviorInteractionState}
                behaviorPlaceId={behaviorPlaceId}
                setBehaviorPlaceId={setBehaviorPlaceId}
                behaviorPlaceOptions={behaviorPlaceOptions}
                behaviorPromptText={behaviorPromptText}
                setBehaviorPromptText={setBehaviorPromptText}
                requestBehaviorInput={requestBehaviorInput}
                activeBehaviorCharacterId={activeBehaviorCharacterId}
                generateBaseBehaviorBranches={generateBaseBehaviorBranches}
                generateBehaviorBranch={generateBehaviorBranch}
                pickAutonomousBehaviorBranch={pickAutonomousBehaviorBranch}
                setBehaviorStatus={setBehaviorStatus}
                autonomousBehaviorCooldownRef={autonomousBehaviorCooldownRef}
                activateBehaviorBranch={activateBehaviorBranch}
                executeBehaviorBranch={executeBehaviorBranch}
                commitBehaviorTreeState={commitBehaviorTreeState}
                persistBehaviorTreeStateToServer={persistBehaviorTreeStateToServer}
                clearBehaviorRuntime={clearBehaviorRuntime}
                setBehaviorPatchOutput={setBehaviorPatchOutput}
                activeBehaviorBranch={activeBehaviorBranch}
                behaviorRuntimeSummary={behaviorRuntimeSummary}
                behaviorTreeState={behaviorTreeState}
                activeBehaviorDialog={activeBehaviorDialog}
                chooseBehaviorDialogChoice={chooseBehaviorDialogChoice}
                exitBehaviorDialog={exitBehaviorDialog}
                continueBehaviorDialog={continueBehaviorDialog}
                behaviorInput={behaviorInput}
                buildBehaviorPayload={buildBehaviorPayload}
                behaviorPatchOutput={behaviorPatchOutput}
            />
        );
    }

    function cancelAssetDrag() {
        if (dragFrameRef.current) {
            cancelAnimationFrame(dragFrameRef.current);
            dragFrameRef.current = null;
        }
        pendingDragPointRef.current = null;
        dragRef.current = null;
    }

    function toggleViewMode() {
        setViewMode((enabled) => {
            const next = !enabled;
            if (next) {
                cancelAssetDrag();
                setGroupEditMode(false);
                setSelectedId('');
                setNotice('观赏模式已开启：素材已锁定，可以安心浏览和控制小人。');
            } else {
                setNotice('观赏模式已关闭：现在可以选中、拖动和编辑素材。');
            }
            return next;
        });
    }

    function spawnPlayersOnStage(...args) {
        return streetMotion.spawnPlayersOnStage(...args);
    }

    function addRoleCharacter(...args) {
        return streetMotion.addRoleCharacter(...args);
    }

    function cancelAutoTravel(...args) {
        return streetMotion.cancelAutoTravel(...args);
    }

    function switchControlledPlayer(...args) {
        return streetMotion.switchControlledPlayer(...args);
    }

    function startAutoTravel(...args) {
        return streetMotion.startAutoTravel(...args);
    }

    function activateBehaviorBranch(...args) {
        return streetBehavior.activateBehaviorBranch(...args);
    }

    function clearBehaviorRuntime(...args) {
        return streetBehavior.clearBehaviorRuntime(...args);
    }

    function activateBehaviorTravelFailureBranch(...args) {
        return streetBehavior.activateBehaviorTravelFailureBranch(...args);
    }

    function advanceBehaviorRuntime(...args) {
        return streetBehavior.advanceBehaviorRuntime(...args);
    }

    const parallaxActive = parallaxEnabled && !editorEnabled;
    const updateLoopCopyVisibility = useCallback((wrap) => {
        if (!wrap) return;
        const panelWidth = stageSize.width * zoom;
        if (!panelWidth) return;
        const margin = wrap.clientWidth * 1.5;
        const left = wrap.scrollLeft - margin;
        const right = wrap.scrollLeft + wrap.clientWidth + margin;
        const next = {
            before: panelWidth >= left && 0 <= right,
            after: panelWidth * 3 >= left && panelWidth * 2 <= right,
        };
        const current = visibleLoopCopiesRef.current;
        if (next.before === current.before && next.after === current.after) return;
        visibleLoopCopiesRef.current = next;
        setVisibleLoopCopies(next);
    }, [stageSize.width, zoom]);

    useEffect(() => {
        updateLoopCopyVisibility(canvasWrapRef.current);
    }, [updateLoopCopyVisibility]);

    const updateStreetParallax = useCallback((wrap, normalizedLoopScroll = false) => {
        if (!wrap) return;
        const panelWidth = stageSize.width * zoom;
        if (!panelWidth) return;
        const camera = advanceCommercialParallaxCamera(parallaxCameraRef.current, wrap.scrollLeft, panelWidth, normalizedLoopScroll);
        parallaxCameraRef.current = camera;
        const farShift = getCommercialParallaxShift(camera, commercialParallaxFactors.far);
        const middleShift = getCommercialParallaxShift(camera, commercialParallaxFactors.middle);
        wrap.style.setProperty('--street-parallax-far-x', `${farShift.toFixed(2)}px`);
        wrap.style.setProperty('--street-parallax-middle-x', `${middleShift.toFixed(2)}px`);
        wrap.style.setProperty('--street-parallax-far-base-x', `${(Math.floor((wrap.scrollLeft - farShift) / panelWidth) - 1) * panelWidth}px`);
        wrap.style.setProperty('--street-parallax-middle-base-x', `${(Math.floor((wrap.scrollLeft - middleShift) / panelWidth) - 1) * panelWidth}px`);
    }, [stageSize.width, zoom]);

    useEffect(() => {
        if (!parallaxActive) return undefined;
        parallaxCameraRef.current = null;
        const frameId = requestAnimationFrame(() => updateStreetParallax(canvasWrapRef.current));
        return () => cancelAnimationFrame(frameId);
    }, [parallaxActive, updateStreetParallax]);

    const centerPlayerInView = useCallback(
        (instant = true) => {
            const wrap = canvasWrapRef.current;
            if (!wrap) return;
            const panelWidth = stageSize.width * zoom;
            const currentViewportCenter = wrap.scrollLeft + wrap.clientWidth / 2;
            const playerCenterOptions = [
                player.x * zoom,
                panelWidth + player.x * zoom,
                panelWidth * 2 + player.x * zoom,
            ];
            const playerCenterX = playerCenterOptions.reduce((closest, option) =>
                Math.abs(option - currentViewportCenter) < Math.abs(closest - currentViewportCenter) ? option : closest,
            );
            const playerCenterY = (player.y - (playerDimensions.height - playerDimensions.footOffset) / 2) * zoom;
            const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
            const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
            const targetLeft = Math.max(0, Math.min(maxLeft, playerCenterX - wrap.clientWidth / 2));
            const targetTop = Math.max(0, Math.min(maxTop, playerCenterY - wrap.clientHeight / 2));
            if (instant) {
                wrap.scrollLeft = targetLeft;
                wrap.scrollTop = targetTop;
                return;
            }
            wrap.scrollLeft += (targetLeft - wrap.scrollLeft) * 0.34;
            wrap.scrollTop += (targetTop - wrap.scrollTop) * 0.34;
        },
        [player.x, player.y, playerDimensions.height, playerDimensions.footOffset, stageSize.width, zoom],
    );

    useEffect(() => {
        centerPlayerInView(!player.moving);
    }, [centerPlayerInView, player.moving]);

    useEffect(() => {
        const wrap = canvasWrapRef.current;
        if (!wrap) return undefined;
        const frameId = requestAnimationFrame(() => {
            const panelWidth = stageSize.width * zoom;
            if (!panelWidth) return;
            const requestedPosition = pendingLoopScrollRef.current;
            pendingLoopScrollRef.current = 'middle';
            if (requestedPosition === 'leftEdge') {
                wrap.scrollLeft = panelWidth;
                return;
            }
            if (requestedPosition === 'rightEdge') {
                wrap.scrollLeft = panelWidth + Math.max(0, panelWidth - wrap.clientWidth);
                return;
            }
            const localX = ((wrap.scrollLeft % panelWidth) + panelWidth) % panelWidth;
            wrap.scrollLeft = panelWidth + localX;
        });
        return () => cancelAnimationFrame(frameId);
    }, [stageSize.width, zoom]);

    useEffect(
        () => () => {
            if (loopScrollSettleTimerRef.current) {
                clearTimeout(loopScrollSettleTimerRef.current);
                loopScrollSettleTimerRef.current = null;
            }
        },
        [],
    );

    useEffect(() => {
        function clearLoopScrollPointerState() {
            loopScrollPointerActiveRef.current = false;
            if (!loopScrollPendingNormalizeRef.current) return;
            const wrap = canvasWrapRef.current;
            loopScrollPendingNormalizeRef.current = false;
            if (!wrap) return;
            if (loopScrollSettleTimerRef.current) {
                clearTimeout(loopScrollSettleTimerRef.current);
            }
            loopScrollSettleTimerRef.current = setTimeout(() => {
                loopScrollSettleTimerRef.current = null;
                normalizeLoopScrollAfterSettleEvent(wrap);
            }, 80);
        }

        window.addEventListener('pointerup', clearLoopScrollPointerState);
        window.addEventListener('pointercancel', clearLoopScrollPointerState);
        window.addEventListener('blur', clearLoopScrollPointerState);
        return () => {
            window.removeEventListener('pointerup', clearLoopScrollPointerState);
            window.removeEventListener('pointercancel', clearLoopScrollPointerState);
            window.removeEventListener('blur', clearLoopScrollPointerState);
        };
    }, [stageSize.width, zoom, normalizeLoopScrollAfterSettleEvent]);

    function getLoopScrollWrapTarget(wrap) {
        const panelWidth = stageSize.width * zoom;
        if (!wrap || !panelWidth) return null;
        const leftWrapPoint = Math.max(0, panelWidth - wrap.clientWidth);
        const rightWrapPoint = panelWidth * 2;
        if (wrap.scrollLeft <= leftWrapPoint) {
            return wrap.scrollLeft + panelWidth;
        }
        if (wrap.scrollLeft >= rightWrapPoint) {
            return wrap.scrollLeft - panelWidth;
        }
        return null;
    }

    function normalizeLoopScrollAfterSettle(wrap) {
        const targetLeft = getLoopScrollWrapTarget(wrap);
        if (!wrap || targetLeft === null) return;
        const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
        const nextLeft = Math.max(0, Math.min(maxLeft, targetLeft));
        if (Math.abs(nextLeft - wrap.scrollLeft) < 1) return;
        loopScrollGuardRef.current = true;
        wrap.scrollLeft = nextLeft;
        requestAnimationFrame(() => {
            loopScrollGuardRef.current = false;
        });
    }

    function onLoopScroll(event) {
        updateLoopCopyVisibility(event.currentTarget);
        if (parallaxActive) updateStreetParallax(event.currentTarget, loopScrollGuardRef.current);
        if (loopScrollGuardRef.current) return;
        const wrap = event.currentTarget;
        if (loopScrollSettleTimerRef.current) {
            clearTimeout(loopScrollSettleTimerRef.current);
            loopScrollSettleTimerRef.current = null;
        }
        if (getLoopScrollWrapTarget(wrap) === null) return;
        if (loopScrollPointerActiveRef.current) {
            loopScrollPendingNormalizeRef.current = true;
            return;
        }
        loopScrollSettleTimerRef.current = setTimeout(() => {
            loopScrollSettleTimerRef.current = null;
            normalizeLoopScrollAfterSettle(wrap);
        }, 240);
    }

    function onLoopScrollPointerDown() {
        loopScrollPointerActiveRef.current = true;
        loopScrollPendingNormalizeRef.current = false;
        if (loopScrollSettleTimerRef.current) {
            clearTimeout(loopScrollSettleTimerRef.current);
            loopScrollSettleTimerRef.current = null;
        }
    }

    function renderEditorPanel(panelKey, interactive = false) {
        const renderContents = interactive || editorEnabled ||
            (panelKey === 'loop-before' ? visibleLoopCopies.before : visibleLoopCopies.after);
        return (
            <CommercialCanvasPanel
                key={panelKey}
                panelKey={panelKey}
                interactive={interactive}
                renderContents={renderContents}
                parallaxActive={parallaxActive}
                stageSize={stageSize}
                playerDimensions={playerDimensions}
                items={items}
                assetById={assetById}
                assetSilhouettes={assetSilhouettes}
                players={players}
                canEditLayout={canEditLayout}
                selectedId={selectedId}
                showCollisionLines={showCollisionLines}
                groupEditMode={groupEditMode}
                onPointerDown={onPointerDown}
                setSelectedId={setSelectedId}
                showLayerPanel={showLayerPanel}
                hiddenLayerItemIds={editorEnabled ? hiddenLayerItemIds : null}
                onCollisionPointerDown={onCollisionPointerDown}
                onPlaceAnchorPointerDown={onPlaceAnchorPointerDown}
                ptxt={ptxt}
                getPlayerVisualDimensions={getPlayerVisualDimensions}
                controlledPlayerId={controlledPlayerId}
                behaviorTargetActorId={behaviorTargetActorId}
                behaviorUserActorId={behaviorUserActorId}
                behaviorCharacter={behaviorCharacter}
                tx={tx}
                activeBehaviorDialog={activeBehaviorDialog}
                playerActionBubbles={playerActionBubbles}
                playerActionBubble={playerActionBubble}
                zoom={zoom}
                chooseBehaviorDialogChoice={chooseBehaviorDialogChoice}
                behaviorLoading={behaviorLoading}
                exitBehaviorDialog={exitBehaviorDialog}
                continueBehaviorDialog={continueBehaviorDialog}
                player={player}
                showPlaceAnchors={showPlaceAnchors}
                stageRef={stageRef}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                renderPlayerInteractionMenu={renderPlayerInteractionMenu}
            />
        );
    }

    function renderAssetPanel() {
        return (
            <CommercialAssetPanel
                assetPanelOpen={assetPanelOpen}
                tx={tx}
                setAssetPanelOpen={setAssetPanelOpen}
                groupedAssets={groupedAssets}
                activeAssetGroup={activeAssetGroup}
                setActiveAssetType={setActiveAssetType}
                ptxt={ptxt}
                addAsset={addAsset}
                canEditLayout={canEditLayout}
            />
        );
    }

    const layoutJson = useMemo(
        () =>
            JSON.stringify(
                {
                    segment: {
                        width: commercialV2SegmentSize.width,
                        height: stageSize.height,
                    },
                    segments: segmentCount,
                    stage: stageSize,
                    background: {
                        type: 'solid',
                        color: commercialV2BackgroundColor,
                    },
                    loop: getCommercialV2Loop(stageSize),
                    collision: {
                        unit: 'ratio-of-item-box',
                        mode: 'active',
                        lineVisibility: 'hidden-by-default',
                        player: 'foot-point',
                        groundLayer: 'ignored',
                    },
                    places: placeLinks,
                    items: items.map((item) => serializeCommercialV2Item(item, assetById.get(item.assetId))),
                },
                null,
                2,
            ),
        [assetById, items, placeLinks, segmentCount, stageSize],
    );

    useAutonomousBehavior({
        canRun: () =>
            Boolean(
                activeBehaviorCharacterId &&
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
        buildBehaviorPendingInput,
        generateBehaviorBranch,
        mergeBehaviorTreePatch,
        bindBehaviorActorToCharacter,
        bindControlledSkinToBehaviorCharacter,
        generateBaseBehaviorBranches,
        buildBehaviorPayload,
        getCurrentBehaviorActorId,
        getCurrentBehaviorUserActorId,
    } = createCommercialBehaviorRequests({
        behaviorActorIdRef,
        behaviorTargetActorId,
        behaviorCharacterId,
        behaviorCharacters,
        setBehaviorStatus,
        setNotice,
        setBehaviorActorId,
        setBehaviorCharacterId,
        setBehaviorActorBindings,
        controlledPlayerId,
        behaviorAction,
        behaviorPlaceId,
        behaviorPlaceOptions,
        placeLinks,
        userProfile,
        players,
        behaviorTreeState,
        behaviorConfig,
        behaviorPromptText,
        behaviorOrderedPlaces,
        behaviorCharacter,
        behaviorUserActorId,
        behaviorActorCharacter,
        activeBehaviorCharacterId,
        apiUrl,
        setBehaviorFoldOpen,
        setBehaviorLoading,
        setBehaviorInput,
        setBehaviorOutput,
        commitBehaviorTreeState,
        setBehaviorAction,
        setBehaviorPlaceId,
        setPlayerActionBubble,
        activateBehaviorBranch,
        clearBehaviorStatusHold,
        behaviorTreeStateRef,
        setBehaviorStatusPinned,
        autonomousBehaviorCursorRef,
        autonomousBehaviorRecentRef,
        clearBehaviorRuntime,
        autonomousBehaviorCooldownRef,
        persistBehaviorTreeStateToServer,
        setBehaviorPatchOutput,
    });

    const { updateBehaviorConfig, pullBehaviorModels, requestBehaviorInput } = editorEnabled
        ? editorTools.createBehaviorDiagnostics({
              setBehaviorConfig,
              behaviorConfig,
              activeBehaviorCharacterId,
              setBehaviorModelStatus,
              setBehaviorStatus,
              setBehaviorModelsLoading,
              apiUrl,
              setBehaviorModelOptions,
              behaviorCharacter,
              setNotice,
              setBehaviorFoldOpen,
              setBehaviorLoading,
              buildBehaviorPayload,
              setBehaviorInput,
              setBehaviorOutput,
              commitBehaviorTreeState,
          })
        : {};

    const {
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
    } = editorEnabled
        ? editorTools.createLayoutActions({
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
          })
        : {};

    return (
        <div
            className={`pixel-world-editor ${!canEditLayout ? 'view-mode' : ''} ${editorEnabled ? 'scene-tools-open' : 'scene-player-mode'} ${parallaxActive ? 'street-parallax-on' : ''}`}
        >
            <ScenePlayerToolbar
                syncStatus={syncStatus}
                retrySync={retrySync}
                reloadServerTree={reloadServerTree}
                tx={tx}
                ptxt={ptxt}
                controlledPlayerId={controlledPlayerId}
                onControlPlayer={switchControlledPlayer}
                behaviorCharacterId={behaviorCharacterId}
                behaviorCharacters={behaviorCharacters}
                onChooseCharacter={(value) => {
                    setBehaviorActorId(controlledPlayerId);
                    setBehaviorCharacterId(value);
                }}
                onBindCharacter={bindControlledSkinToBehaviorCharacter}
                bindingSummary={controlledBindingSummary}
                onGenerateBehavior={generateBaseBehaviorBranches}
                behaviorLoading={behaviorLoading}
                behaviorError={behaviorOutput?.error}
                canGenerate={Boolean(activeBehaviorCharacterId)}
                zoom={zoom}
                setZoom={setZoom}
                maxZoom={1.4}
                onCenter={() => centerPlayerInView(true)}
                parallaxEnabled={parallaxEnabled}
                onToggleParallax={() => setParallaxEnabled((value) => !value)}
                travel={{
                    autoTargetId,
                    setAutoTargetId,
                    travelTargetOptions,
                    startAutoTravel,
                    cancelAutoTravel,
                    autoTravelActive,
                }}
                toolsAvailable={Boolean(editorTools)}
                toolsOpen={editorEnabled}
                onToggleTools={toggleTools}
            />
            {editorEnabled && (
                <CommercialEditorToolbar
                    tx={tx}
                    ptxt={ptxt}
                    showAdvancedToolbar={showAdvancedToolbar}
                    setShowAdvancedToolbar={setShowAdvancedToolbar}
                    saveLayout={saveLayout}
                    viewMode={viewMode}
                    toggleViewMode={toggleViewMode}
                    saveCurrentAsDefaultScene={saveCurrentAsDefaultScene}
                    copyLayout={copyLayout}
                    assetPanelOpen={assetPanelOpen}
                    setAssetPanelOpen={setAssetPanelOpen}
                    setBehaviorPanelCollapsed={setBehaviorPanelCollapsed}
                    behaviorPanelCollapsed={behaviorPanelCollapsed}
                    zoom={zoom}
                    segmentCount={segmentCount}
                    setZoom={setZoom}
                    centerPlayerInView={centerPlayerInView}
                    showCollisionLines={showCollisionLines}
                    toggleCollisionLines={toggleCollisionLines}
                    showPlaceAnchors={showPlaceAnchors}
                    togglePlaceAnchors={togglePlaceAnchors}
                    showLayerPanel={showLayerPanel}
                    setShowLayerPanel={setShowLayerPanel}
                    autoTargetId={autoTargetId}
                    setAutoTargetId={setAutoTargetId}
                    travelTargetOptions={travelTargetOptions}
                    startAutoTravel={startAutoTravel}
                    cancelAutoTravel={cancelAutoTravel}
                    autoTravelActive={autoTravelActive}
                    playerActionBubble={playerActionBubble}
                    playerScale={playerScale}
                    updatePlayerScale={updatePlayerScale}
                    setPlayerScale={setPlayerScale}
                    canEditLayout={canEditLayout}
                    prependCanvasSegment={prependCanvasSegment}
                    appendCanvasSegment={appendCanvasSegment}
                    removeCanvasSegment={removeCanvasSegment}
                    groupEditMode={groupEditMode}
                    setGroupEditMode={setGroupEditMode}
                    restoreResetBackup={restoreResetBackup}
                    resetLayout={resetLayout}
                    selectedItem={selectedItem}
                    scaleSelected={scaleSelected}
                    items={items}
                    moveSelectedLayer={moveSelectedLayer}
                    bringSelectedToFront={bringSelectedToFront}
                    sendSelectedToBack={sendSelectedToBack}
                    deleteSelected={deleteSelected}
                    notice={notice}
                />
            )}

            <div
                className={`pixel-world-editor-body ${assetPanelOpen ? 'asset-open' : 'asset-collapsed'} ${behaviorPanelCollapsed ? 'behavior-collapsed' : 'behavior-open'}`}
            >
                {editorEnabled && renderAssetPanel()}

                <div
                    className="pixel-world-editor-canvas-wrap"
                    ref={canvasWrapRef}
                    tabIndex={0}
                    onPointerDownCapture={(event) => {
                        onLoopScrollPointerDown();
                        focusCanvasForKeyboard(event);
                    }}
                    onScroll={onLoopScroll}
                    aria-label={tx(
                        'Commercial street canvas. Click it, then use WASD to control the current character.',
                        '商业街画布，点击后可用 WASD 控制当前人物',
                    )}
                >
                    <div className="pixel-world-editor-loop-track">
                        {parallaxActive && (
                            <CommercialParallaxPlanes items={items} assetById={assetById} stageSize={stageSize} zoom={zoom} />
                        )}
                        {renderEditorPanel('loop-before')}
                        {renderEditorPanel('loop-current', true)}
                        {renderEditorPanel('loop-after')}
                    </div>
                </div>

                {editorEnabled && showLayerPanel && (
                    <CommercialLayerPanel
                        tx={tx}
                        ptxt={ptxt}
                        layerRows={layerRows}
                        selectedLayerRow={selectedLayerRow}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        hiddenLayerItemIds={hiddenLayerItemIds}
                        setLayerVisibility={setLayerVisibility}
                        nudgeLayerGroup={nudgeLayerGroup}
                        scaleLayerGroup={scaleLayerGroup}
                        editable={canEditLayout}
                    />
                )}

                {editorEnabled && renderBehaviorTreePanel()}
            </div>
        </div>
    );
}

export default CommercialStreetScene;
