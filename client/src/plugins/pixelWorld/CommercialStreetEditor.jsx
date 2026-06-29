import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  commercialV2BehaviorConfigStorageKey,
  commercialV2BehaviorTreeStorageKey,
  commercialV2BehaviorInteractionDistance,
  commercialV2BehaviorInteractionSessionIdleMs,
  commercialV2BehaviorAutonomousInitialDelayMs,
  commercialV2BehaviorAutonomousCooldownMs,
  commercialV2BehaviorNearbyCooldownMs,
  commercialV2BehaviorBaseWaitMs,
  commercialV2BehaviorBaseFallbackMs,
  commercialV2BehaviorGenerationTimeoutMs,
  commercialV2BehaviorBaseGenerationTimeoutMs,
  commercialV2BehaviorContextDefaultQ,
  commercialV2BehaviorContextDefaultP,
  commercialV2BehaviorContextMinQ,
  commercialV2BehaviorContextMaxQ,
  commercialV2BehaviorContextMinP,
  commercialV2BehaviorContextMaxP,
  commercialV2BehaviorIterationRecordLimit,
  commercialV2BehaviorActions,
  commercialV2BehaviorPrimaryActionIds,
  commercialV2BehaviorContextActionIds,
  commercialV2BehaviorImportantPlaceIds,
  commercialV2BehaviorMovementActions,
  commercialV2BehaviorSpecialNodeIds,
  commercialV2BehaviorTravelFailureTrigger,
  commercialV2BehaviorBaseNodeIds,
  commercialV2BehaviorAutonomousNodeIds,
  commercialV2BehaviorNearbyAutonomousNodeIds,
  commercialV2BehaviorDefaultBaseActionNodeIds,
  commercialV2BehaviorLastDemoBranch,
  createCommercialV2PresetInteractionBranch,
  commercialV2BehaviorDefaultConfig,
  fetchBehaviorJsonWithTimeout,
  formatBehaviorRequestError,
  getBehaviorAuthHeaders,
  formatBehaviorJson,
  resolveBehaviorChoicePlaceIdFromPlaces,
  resolveBehaviorChoiceTrigger,
  normalizeBehaviorDialogChoices,
  summarizeBehaviorPlaceForPayload,
  buildBehaviorTreePayloadSummary,
  buildCommercialBehaviorContextStats,
  normalizeCommercialBehaviorContextLimit,
  normalizeCommercialBehaviorConfig,
  readStoredCommercialBehaviorConfig,
  createCommercialV2BehaviorTreeState,
  createCommercialBehaviorTreeRebuildState,
  readStoredCommercialBehaviorTreeState,
  readStoredRoomBehaviorTreeState,
  normalizeCommercialBehaviorNodeId,
  commercialBehaviorBranchMatchesOwner,
  createCommercialBehaviorPatchFromBranch,
  mergeCommercialBehaviorTreePatchForRuntime,
  mergeCommercialBehaviorTreePatchesForRuntime,
  createCommercialBehaviorBranchFromNode,
  sortCommercialBehaviorBranchesByLiveliness,
  normalizeCommercialBehaviorIterationStep,
  buildCommercialBehaviorContextConfig,
  mergeCommercialBehaviorIterationStateFromInput,
  behaviorBranchReferencesOnlyPlaces,
  getCommercialBehaviorTriggerText,
  commercialBehaviorBranchHasTrigger,
  commercialBehaviorBranchIsTravelRecovery,
  pickCommercialBehaviorBaseBranchByTrigger,
  pickGeneratedInteractionStarterBranch,
  adaptRoomBehaviorTreeStateForPlaces
} from './behaviorTreeCore';
import {
  commercialV2Base,
  commercialV2AssetVersion,
  commercialV2Asset,
  commercialV2StorageKey,
  commercialV2CanvasStorageKey,
  commercialV2ResetBackupStorageKey,
  commercialV2DefaultSnapshotStorageKey,
  commercialV2MaxStorageBytes,
  commercialV2MaxSavedItems,
  commercialV2RecoveredLayoutUrl,
  commercialV2RecoveredCanvasUrl,
  commercialV2SegmentSize,
  commercialV2StageBottomPadding,
  commercialV2LoopSeamMargin,
  commercialV2MinSegmentCount,
  commercialV2MaxSegmentCount,
  commercialV2BackgroundColor,
  commercialV2PlayerFrameOrder,
  commercialV2PlayerSize,
  commercialV2PlayerPeerCollision,
  commercialV2PlayerApproachGap,
  commercialV2PlayerInitial,
  commercialV2PlayerCharacters,
  commercialV2DefaultControlledPlayerId,
  commercialV2RoleActorId,
  commercialV2UserActorId,
  commercialV2PlayerCharacterById,
  createCommercialV2PlayerState,
  createCommercialV2PlayerStates,
  getCommercialV2PlayerCharacter,
  commercialV2PlayerFrame,
  commercialV2DefaultPlayerScale,
  commercialV2DefaultZoom,
  commercialV2PlayerSpeed,
  commercialV2BehaviorPlayerSpeed,
  commercialV2LayerBaseZIndex,
  commercialV2LayerStepZIndex,
  commercialV2PlayerLayerGap,
  commercialV2PlayerOccludedZReserve,
  commercialV2DepthZIndexScale,
  commercialV2GroundLayerZIndex,
  commercialV2PathCellSize,
  commercialV2PathWaypointReach,
  commercialV2PathMaxVisited,
  commercialV2StreetCruiseDistances,
  commercialV2StreetCruiseLaneOffsets,
  commercialV2StreetCruiseMinForward,
  commercialV2StreetCruiseCenterStep,
  commercialV2StreetCruiseRoadCenterRatio,
  commercialV2StreetCruiseOffRoadPenalty,
  commercialV2StreetCruiseCenterLinePenalty,
  commercialV2MainRoadCellPenalty,
  commercialV2MainRoadCenterRatio,
  commercialV2MainRoadTargetInset,
  commercialV2ForwardPathBacktrackLimit,
  commercialV2ForwardPathBacktrackPenalty,
  commercialV2ForwardPathOvershootTolerance,
  commercialV2MovementKeys,
  commercialV2DepthYByType,
  commercialV2DepthYByAssetId,
  commercialV2OcclusionSortYRatioByAssetId,
  commercialV2OcclusionRightCornerCapByAssetId,
  commercialV2AspectRatioByAssetId,
  commercialV2SilhouetteColumnCount,
  commercialV2SilhouetteAlphaThreshold,
  commercialV2OcclusionDepthMargin,
  commercialV2SilhouetteCache,
  getCommercialV2ItemZIndex,
  getCommercialV2DepthZIndex,
  commercialV2CollisionByType,
  commercialV2LegacyCollisionByAssetId,
  commercialV2CollisionByAssetId,
  commercialV2AlwaysBackLowerBodyAssetIds,
  commercialV2PlaceLinkByAssetId,
  commercialV2TravelLabelById,
  getCommercialV2Loop,
  getCommercialV2StageSize,
  boardAssetBox,
  makeBoardAsset,
  makeSkyStripAsset,
  commercialV2RoadAssets,
  commercialV2RoadExtraAssets,
  commercialV2CleanCloudAssets,
  commercialV2SkyAssets,
  greeneryPath,
  commercialV2GreeneryAssets,
  streetClutterPath,
  commercialV2StreetClutterAssets,
  largeLifePropPath,
  commercialV2LargeLifePropAssets,
  commercialV2AssetCatalogAll,
  _commercialV2LegacyDefaultLayout,
  commercialV2SceneAssetIds,
  commercialV2AssetCatalog,
  commercialV2AutoAppendAssetIds,
  readStoredCommercialLayout,
  readStoredCommercialCanvas,
  normalizeCommercialV2LayoutState,
  readStoredCommercialResetBackup,
  readStoredCommercialDefaultSnapshot,
  getBuiltInDefaultCommercialItems,
  getDefaultCommercialLayoutState,
  normalizeSegmentCount,
  getRequiredSegmentCount,
  clampBox,
  wrapLoopBox,
  wrapLoopCoordinate,
  getCommercialV2LoopDeltaX,
  isCommercialV2WalkableAsset,
  isCommercialV2MainRoadAsset,
  isCommercialV2StreetCruiseRoadAsset,
  isCommercialV2GroundLayerAsset,
  isCommercialV2GroundLayerItem,
  isCommercialV2DynamicOcclusionItem,
  canCommercialV2ItemCollisionTakeEffect,
  getCommercialV2PlaceLink,
  getCommercialV2PlaceLocationIds,
  normalizeCommercialV2PlaceAnchor,
  buildCommercialV2ItemPlace,
  buildCommercialV2Places,
  getCommercialV2PlaceAnchorLocalPoint,
  buildCommercialV2TravelTargetOptions,
  getCommercialV2TravelAction,
  pushCommercialV2PathHeap,
  popCommercialV2PathHeap,
  isCommercialV2CollisionAsset,
  roundCommercialV2Ratio,
  isSameCommercialV2Collision,
  migrateCommercialV2Collision,
  getCommercialV2DefaultCollision,
  normalizeCommercialV2Collision,
  getCommercialV2EffectiveCollision,
  getCommercialV2CollisionLocalBox,
  getCommercialV2CollisionWorldBox,
  getCommercialV2AutoRouteBlockWorldBox,
  getCommercialV2PlaceApproachMinY,
  boxesOverlap,
  buildCommercialV2Silhouette,
  loadCommercialV2AssetSilhouette,
  getCommercialV2DepthY,
  getCommercialV2SortY,
  getCommercialV2ItemRenderZIndex,
  getCommercialV2PlayerRenderZIndex,
  getCommercialV2OcclusionBox,
  getCommercialV2OcclusionLayer,
  getCommercialV2ColumnOcclusionBottom,
  isCommercialV2AlwaysBackLowerBody,
  getCommercialV2OcclusionDecision,
  serializeCommercialV2Item,
  isCommercialV2SkyStripAsset,
  normalizeCommercialV2ItemAspect,
  getLayoutBounds,
  getPointerStagePoint
} from './commercialStreetCore';

const commercialV2BehaviorActorBindingStorageKey = 'pixelWorld.commercialStreetV2.behaviorActorBindings';

function normalizeCommercialV2BehaviorActorBindings(rawBindings = {}) {
  if (!rawBindings || typeof rawBindings !== 'object') return {};
  return Object.entries(rawBindings).reduce((result, [actorId, characterId]) => {
    const safeActorId = String(actorId || '').trim();
    const safeCharacterId = String(characterId || '').trim();
    if (safeActorId && safeCharacterId && commercialV2PlayerCharacterById.has(safeActorId)) {
      result[safeActorId] = safeCharacterId;
    }
    return result;
  }, {});
}

function readStoredCommercialV2BehaviorActorBindings() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(commercialV2BehaviorActorBindingStorageKey);
    if (!raw) return {};
    return normalizeCommercialV2BehaviorActorBindings(JSON.parse(raw));
  } catch {
    localStorage.removeItem(commercialV2BehaviorActorBindingStorageKey);
    return {};
  }
}

function CommercialStreetEditor({ apiUrl = '/api', userProfile = null }) {
  const stageRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const loopScrollGuardRef = useRef(false);
  const pendingLoopScrollRef = useRef('middle');
  const dragRef = useRef(null);
  const dragFrameRef = useRef(null);
  const pendingDragPointRef = useRef(null);
  const pressedKeysRef = useRef(new Set());
  const playersRef = useRef(createCommercialV2PlayerStates());
  const controlledPlayerIdRef = useRef(commercialV2DefaultControlledPlayerId);
  const playerRef = useRef(playersRef.current[commercialV2DefaultControlledPlayerId]);
  const playerSpawnedRef = useRef(false);
  const autoTravelRef = useRef(null);
  const behaviorRuntimeRef = useRef(null);
  const behaviorChoicePendingRef = useRef(false);
  const behaviorInteractionSessionRef = useRef({ active: false, expiresAt: 0 });
  const behaviorTreeStateRef = useRef(null);
  const behaviorActorIdRef = useRef(commercialV2RoleActorId);
  const behaviorActorSyncRef = useRef('');
  const autonomousBehaviorCooldownRef = useRef(Date.now() + commercialV2BehaviorAutonomousInitialDelayMs);
  const autonomousBehaviorCursorRef = useRef(0);
  const autonomousBehaviorRecentRef = useRef([]);
  const pickAutonomousBehaviorBranchRef = useRef(() => null);
  const activateBehaviorBranchRef = useRef(() => {});
  const advanceBehaviorRuntimeRef = useRef(() => {});
  const [initialLayout] = useState(() => readStoredCommercialLayout());
  const [items, setItemsState] = useState(initialLayout.items);
  const itemsRef = useRef(initialLayout.items);
  const [segmentCount, setSegmentCountState] = useState(initialLayout.segmentCount);
  const segmentCountRef = useRef(initialLayout.segmentCount);
  const [resetBackup, setResetBackup] = useState(() => readStoredCommercialResetBackup());
  const [selectedId, setSelectedId] = useState('');
  const [zoom, setZoom] = useState(commercialV2DefaultZoom);
  const [viewMode, setViewMode] = useState(true);
  const [groupEditMode, setGroupEditMode] = useState(false);
  const [showCollisionLines, setShowCollisionLines] = useState(false);
  const [showPlaceAnchors, setShowPlaceAnchors] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [activeAssetType, setActiveAssetType] = useState('建筑');
  const [autoTargetId, setAutoTargetId] = useState('');
  const [autoTravelActive, setAutoTravelActive] = useState(false);
  const [notice, setNotice] = useState('观赏模式已开启：素材已锁定，可以安心浏览和控制小人。');
  const [controlledPlayerId, setControlledPlayerId] = useState(commercialV2DefaultControlledPlayerId);
  const [players, setPlayers] = useState(() => createCommercialV2PlayerStates());
  const [playerScale, setPlayerScale] = useState(commercialV2DefaultPlayerScale);
  const [playerActionBubble, setPlayerActionBubble] = useState('');
  const [playerActionBubbles, setPlayerActionBubbles] = useState({});
  const [activeBehaviorDialog, setActiveBehaviorDialog] = useState(null);
  const [interactionMenuOpen, setInteractionMenuOpen] = useState(false);
  const [assetSilhouettes, setAssetSilhouettes] = useState({});
  const [behaviorCharacters, setBehaviorCharacters] = useState([]);
  const [behaviorActorId, setBehaviorActorId] = useState(commercialV2RoleActorId);
  const [behaviorActorBindings, setBehaviorActorBindings] = useState(() => readStoredCommercialV2BehaviorActorBindings());
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
  const [behaviorModelStatus, setBehaviorModelStatus] = useState('默认使用绑定角色的模型配置；需要覆盖时再填写 URL 和 Key。');
  const [behaviorLoading, setBehaviorLoading] = useState(false);
  const [behaviorModelsLoading, setBehaviorModelsLoading] = useState(false);
  const [behaviorShowKey, setBehaviorShowKey] = useState(false);
  const [behaviorPanelCollapsed, setBehaviorPanelCollapsed] = useState(true);
  const [behaviorFoldOpen, setBehaviorFoldOpen] = useState({
    model: false,
    context: false,
    constraints: false,
    branchMap: false,
    interaction: false,
    runtime: true,
    debug: false
  });
  const behaviorContextStats = useMemo(
    () => buildCommercialBehaviorContextStats(behaviorTreeState, behaviorConfig),
    [behaviorTreeState, behaviorConfig.context_q_limit, behaviorConfig.context_summary_threshold]
  );
  const stageSize = useMemo(() => getCommercialV2StageSize(segmentCount, items), [items, segmentCount]);
  const assetById = useMemo(() => new Map(commercialV2AssetCatalog.map((asset) => [asset.id, asset])), []);
  const walkableRects = useMemo(() => items
    .filter((item) => isCommercialV2WalkableAsset(item.assetId))
    .map((item) => ({
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h
    })), [items]);
  const mainRoadRects = useMemo(() => items
    .filter((item) => isCommercialV2MainRoadAsset(item.assetId))
    .map((item) => ({
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h
    })), [items]);
  const streetCruiseRoadRects = useMemo(() => items
    .filter((item) => isCommercialV2StreetCruiseRoadAsset(item.assetId))
    .map((item) => ({
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h
    })), [items]);
  const collisionRects = useMemo(() => items
    .map((item) => {
      const asset = assetById.get(item.assetId);
      const collisionBox = getCommercialV2CollisionWorldBox(item, asset);
      if (!collisionBox) return null;
      return {
        id: item.id,
        ...collisionBox
      };
    })
    .filter(Boolean), [assetById, items]);
  const autoRouteBlockRects = useMemo(() => items
    .map((item) => {
      const asset = assetById.get(item.assetId);
      const routeBlockBox = getCommercialV2AutoRouteBlockWorldBox(item, asset);
      if (!routeBlockBox) return null;
      return {
        id: item.id,
        ...routeBlockBox
      };
    })
    .filter(Boolean), [assetById, items]);
  const placeLinks = useMemo(() => buildCommercialV2Places(items, assetById), [assetById, items]);
  const travelTargetOptions = useMemo(() => buildCommercialV2TravelTargetOptions(placeLinks), [placeLinks]);
  const behaviorOrderedPlaces = useMemo(() => placeLinks
    .filter((place) => commercialV2BehaviorImportantPlaceIds.has(place.placeId))
    .slice()
    .sort((a, b) => (a.anchor?.x || 0) - (b.anchor?.x || 0))
    .map((place, index) => ({
      ...place,
      order: index + 1
    })), [placeLinks]);
  const behaviorPlaceOptions = useMemo(() => {
    const importantOptions = behaviorOrderedPlaces.map((place) => ({
      id: place.placeId,
      label: place.name,
      order: place.order
    }));
    return importantOptions.length ? importantOptions : travelTargetOptions;
  }, [behaviorOrderedPlaces, travelTargetOptions]);
  const silhouetteAssetIds = useMemo(() => Array.from(new Set(items
    .filter((item) => isCommercialV2DynamicOcclusionItem(item, assetById.get(item.assetId)))
    .map((item) => item.assetId))), [assetById, items]);
  const playerDimensions = useMemo(() => ({
    width: commercialV2PlayerSize.width * playerScale,
    height: commercialV2PlayerSize.height * playerScale,
    footOffset: commercialV2PlayerSize.footOffset * playerScale
  }), [playerScale]);
  const selectedItem = items.find((item) => item.id === selectedId) || null;
  const selectedAsset = selectedItem ? assetById.get(selectedItem.assetId) : null;
  const selectedCollisionCanTakeEffect = Boolean(
    selectedItem && selectedAsset && canCommercialV2ItemCollisionTakeEffect(selectedItem, selectedAsset)
  );
  const selectedCollision = selectedItem && selectedAsset
    ? getCommercialV2EffectiveCollision(selectedItem, selectedAsset)
    : null;
  const selectedCollisionLocalBox = selectedItem && selectedAsset
    ? getCommercialV2CollisionLocalBox(selectedItem, selectedAsset)
    : null;
  const selectedPlace = selectedItem && selectedAsset
    ? buildCommercialV2ItemPlace(selectedItem, selectedAsset)
    : null;
  const selectedPlaceAnchorLocalPoint = selectedItem && selectedAsset
    ? getCommercialV2PlaceAnchorLocalPoint(selectedItem, selectedAsset)
    : null;
  const selectedIsBuiltInGroundLayer = Boolean(selectedAsset && isCommercialV2GroundLayerAsset(selectedAsset));
  const selectedIsGroundLayer = Boolean(selectedItem && selectedAsset && isCommercialV2GroundLayerItem(selectedItem, selectedAsset));
  const layerRows = useMemo(() => items.map((item, layerIndex) => {
    const asset = assetById.get(item.assetId);
    const isGround = Boolean(asset && isCommercialV2GroundLayerItem(item, asset));
    return {
      item,
      asset,
      layerIndex,
      zIndex: getCommercialV2ItemRenderZIndex(layerIndex, item, asset),
      isGround,
      playerRule: isGround ? '恒在人物下方 / 忽略碰撞' : '按图层顺序 / 遮挡判断'
    };
  }), [assetById, items]);
  const selectedLayerRow = selectedId
    ? layerRows.find((row) => row.item.id === selectedId) || null
    : null;
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
  const canEditLayout = !viewMode;
  const player = players[controlledPlayerId]
    || players[commercialV2DefaultControlledPlayerId]
    || createCommercialV2PlayerState(commercialV2PlayerCharacters[0]);
  const controlledPlayerCharacter = getCommercialV2PlayerCharacter(player);
  const behaviorTargetActorId = commercialV2PlayerCharacterById.has(behaviorActorId)
    ? behaviorActorId
    : commercialV2RoleActorId;
  const behaviorUserActorId = behaviorTargetActorId === commercialV2UserActorId
    ? commercialV2RoleActorId
    : commercialV2UserActorId;
  const behaviorActorCharacter = commercialV2PlayerCharacterById.get(behaviorTargetActorId) || commercialV2PlayerCharacters[0];
  const behaviorUserCharacter = commercialV2PlayerCharacterById.get(behaviorUserActorId) || commercialV2PlayerCharacters[0];
  const behaviorTargetActor = players[behaviorTargetActorId] || createCommercialV2PlayerState(behaviorActorCharacter);
  const behaviorUserActor = players[behaviorUserActorId] || createCommercialV2PlayerState(behaviorUserCharacter);
  const behaviorBoundCharacterId = behaviorActorBindings[behaviorTargetActorId] || '';
  const behaviorBoundCharacter = behaviorCharacters.find((item) => item.id === behaviorBoundCharacterId) || null;
  const behaviorSelectedCharacter = behaviorCharacters.find((item) => item.id === behaviorCharacterId) || null;
  const behaviorRequestCharacterId = behaviorBoundCharacterId || behaviorCharacterId;
  const behaviorCharacter = behaviorCharacters.find((item) => item.id === behaviorRequestCharacterId)
    || behaviorSelectedCharacter
    || behaviorBoundCharacter
    || behaviorCharacters[0]
    || null;
  const activeBehaviorCharacterId = behaviorCharacter?.id || '';
  const behaviorBindingSummary = behaviorBoundCharacter
    ? `${behaviorActorCharacter.label} -> ${behaviorBoundCharacter.name || behaviorBoundCharacter.id}`
    : `${behaviorActorCharacter.label} 尚未绑定实际角色`;
  const controlledBoundCharacterId = behaviorActorBindings[controlledPlayerId] || '';
  const controlledBoundCharacter = behaviorCharacters.find((item) => item.id === controlledBoundCharacterId) || null;
  const controlledBindingSummary = controlledBoundCharacter
    ? `已绑定：${controlledBoundCharacter.name || controlledBoundCharacter.id}`
    : '未绑定';
  const behaviorPrimaryActions = commercialV2BehaviorPrimaryActionIds
    .map((id) => commercialV2BehaviorActions.find((item) => item.id === id))
    .filter(Boolean);
  const behaviorContextActions = commercialV2BehaviorContextActionIds
    .map((id) => commercialV2BehaviorActions.find((item) => item.id === id))
    .filter(Boolean);
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
      side
    };
  }, [
    behaviorTargetActor.x,
    behaviorTargetActor.y,
    behaviorUserActor.x,
    behaviorUserActor.y,
    playerDimensions.footOffset,
    playerDimensions.height,
    stageSize.height,
    stageSize.width
  ]);

  useEffect(() => {
    if (!behaviorInteractionState.nearby || activeBehaviorDialog) {
      setInteractionMenuOpen(false);
    }
  }, [activeBehaviorDialog, behaviorInteractionState.nearby]);

  const setPlayerById = useCallback((playerId, updater) => {
    const character = commercialV2PlayerCharacterById.get(playerId) || commercialV2PlayerCharacters[0];
    setPlayers((currentPlayers) => {
      const currentPlayer = currentPlayers[playerId] || createCommercialV2PlayerState(character);
      const nextPatch = typeof updater === 'function' ? updater(currentPlayer) : updater;
      const nextPlayer = {
        ...currentPlayer,
        ...nextPatch,
        id: playerId,
        characterId: currentPlayer.characterId || playerId
      };
      const nextPlayers = {
        ...currentPlayers,
        [playerId]: nextPlayer
      };
      playersRef.current = nextPlayers;
      if (playerId === controlledPlayerIdRef.current) playerRef.current = nextPlayer;
      return nextPlayers;
    });
  }, []);

  const setPlayer = useCallback((updater) => {
    setPlayerById(controlledPlayerIdRef.current, updater);
  }, [setPlayerById]);

  function setWorldPlayerBubble(playerId, text) {
    const safeText = String(text || '').trim().slice(0, 80);
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

  const commitItems = useCallback((updater) => {
    const previous = itemsRef.current;
    const next = typeof updater === 'function' ? updater(previous) : updater;
    itemsRef.current = next;
    setItemsState(next);
    return next;
  }, []);

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
    const preferredTarget = travelTargetOptions.find((option) => option.id === 'convenience')
      || travelTargetOptions.find((option) => option.id === 'restaurant')
      || travelTargetOptions[0];
    setAutoTargetId(preferredTarget.id);
  }, [autoTargetId, travelTargetOptions]);

  useEffect(() => {
    if (!behaviorPlaceOptions.length) {
      setBehaviorPlaceId('');
      return;
    }
    if (behaviorPlaceId && behaviorPlaceOptions.some((option) => option.id === behaviorPlaceId)) return;
    const preferredTarget = behaviorPlaceOptions.find((option) => option.id === 'restaurant')
      || behaviorPlaceOptions.find((option) => option.id === 'convenience')
      || behaviorPlaceOptions[0];
    setBehaviorPlaceId(preferredTarget.id);
  }, [behaviorPlaceId, behaviorPlaceOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(commercialV2BehaviorConfigStorageKey, JSON.stringify({
        api_endpoint: behaviorConfig.api_endpoint || '',
        model_name: behaviorConfig.model_name || '',
        context_q_limit: behaviorConfig.context_q_limit,
        context_summary_threshold: behaviorConfig.context_summary_threshold
      }));
    } catch {
      // Ignore storage failures; the API key is intentionally never persisted here.
    }
  }, [behaviorConfig.api_endpoint, behaviorConfig.model_name, behaviorConfig.context_q_limit, behaviorConfig.context_summary_threshold]);

  useEffect(() => {
    behaviorTreeStateRef.current = behaviorTreeState;
  }, [behaviorTreeState]);

  useEffect(() => {
    try {
      localStorage.setItem(commercialV2BehaviorTreeStorageKey, JSON.stringify(behaviorTreeState));
    } catch {
      // The tree can still live in memory if browser storage is full or unavailable.
    }
  }, [behaviorTreeState]);

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
      const same = Object.keys(next).length === Object.keys(current).length
        && Object.entries(next).every(([actorId, characterId]) => current[actorId] === characterId);
      return same ? current : next;
    });
  }, [behaviorCharacters]);

  useEffect(() => {
    if (!behaviorCharacters.length) {
      setBehaviorCharacterId('');
      return;
    }
    const characterIds = new Set(behaviorCharacters.map((item) => item.id));
    const preferred = behaviorCharacters.find((item) => Number(item.sys_survival ?? 1) === 1) || behaviorCharacters[0];
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

  function keepBehaviorInteractionSessionActive() {
    behaviorInteractionSessionRef.current = {
      active: true,
      expiresAt: Date.now() + commercialV2BehaviorInteractionSessionIdleMs
    };
    autonomousBehaviorCooldownRef.current = Date.now() + commercialV2BehaviorInteractionSessionIdleMs;
  }

  function isBehaviorInteractionSessionActive() {
    const session = behaviorInteractionSessionRef.current || {};
    if (!session.active) return false;
    if (Date.now() > Number(session.expiresAt || 0)) {
      behaviorInteractionSessionRef.current = { active: false, expiresAt: 0 };
      return false;
    }
    return true;
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!activeBehaviorCharacterId || !behaviorOrderedPlaces.length) return;
      if (behaviorLoading || activeBehaviorDialog || interactionMenuOpen) return;
      if (behaviorChoicePendingRef.current || behaviorRuntimeRef.current) return;
      if (isBehaviorInteractionSessionActive()) return;
      if (Date.now() < autonomousBehaviorCooldownRef.current) return;
      const branch = pickAutonomousBehaviorBranchRef.current({ nearby: behaviorInteractionState.nearby });
      if (!branch) return;
      autonomousBehaviorCooldownRef.current = Date.now() + (behaviorInteractionState.nearby
        ? commercialV2BehaviorNearbyCooldownMs
        : commercialV2BehaviorAutonomousCooldownMs);
      activateBehaviorBranchRef.current(branch, 'base');
      setBehaviorStatus(`日常行为自动执行：${branch.title}`);
    }, 700);
    return () => window.clearInterval(intervalId);
  }, [
    activeBehaviorDialog,
    activeBehaviorCharacterId,
    behaviorInteractionState.nearby,
    behaviorLoading,
    behaviorOrderedPlaces.length,
    behaviorTreeState.version,
    interactionMenuOpen
  ]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('cp_token') || '';
    fetch(`${apiUrl}/city/characters`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`角色列表读取失败 ${response.status}`)))
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
    Promise.all(missingAssetIds.map((assetId) => loadCommercialV2AssetSilhouette(assetById.get(assetId))))
      .then((results) => {
        if (cancelled) return;
        setAssetSilhouettes((current) => {
          const next = { ...current };
          results.forEach((result) => {
            if (!result) return;
            next[result.assetId] = result.silhouette;
          });
          return next;
        });
      });
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
      setNotice(next ? '碰撞箱线已显示：绿色线是真实阻挡范围，黄色线是角色之间的脚底占位；地面层碰撞箱不参与阻挡。' : '碰撞箱线已隐藏，非地面层碰撞仍然默认生效。');
      return next;
    });
  }

  function togglePlaceAnchors() {
    setShowPlaceAnchors((enabled) => {
      const next = !enabled;
      setNotice(next ? '地点锚点已显示：粉色点是角色后续自动前往和交互的位置。' : '地点锚点已隐藏，地点联动数据仍会保留在布局 JSON。');
      return next;
    });
  }

  function focusCanvasForKeyboard() {
    const activeElement = document.activeElement;
    const activeTag = activeElement?.tagName?.toLowerCase();
    if (activeElement?.isContentEditable || activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
      activeElement.blur();
    }
    canvasWrapRef.current?.focus?.({ preventScroll: true });
  }

  function updateBehaviorConfig(patch) {
    setBehaviorConfig((current) => normalizeCommercialBehaviorConfig({
      ...current,
      ...patch
    }));
  }

  function getCurrentBehaviorActorId() {
    const actorId = behaviorActorIdRef.current || behaviorTargetActorId || commercialV2RoleActorId;
    return commercialV2PlayerCharacterById.has(actorId) ? actorId : commercialV2RoleActorId;
  }

  function getCurrentBehaviorUserActorId(actorId = getCurrentBehaviorActorId()) {
    return actorId === commercialV2UserActorId ? commercialV2RoleActorId : commercialV2UserActorId;
  }

  function bindBehaviorActorToCharacter(actorId = behaviorTargetActorId, characterId = behaviorCharacterId) {
    const safeActorId = commercialV2PlayerCharacterById.has(actorId) ? actorId : behaviorTargetActorId;
    const safeCharacterId = String(characterId || '').trim();
    const selectedCharacter = behaviorCharacters.find((item) => item.id === safeCharacterId);
    const selectedActorCharacter = commercialV2PlayerCharacterById.get(safeActorId) || commercialV2PlayerCharacters[0];
    if (!selectedCharacter) {
      const message = '先选择一个已经创建的实际角色，再绑定到皮套。';
      setBehaviorStatus(message);
      setNotice(message);
      return false;
    }
    setBehaviorActorId(safeActorId);
    setBehaviorCharacterId(selectedCharacter.id);
    setBehaviorActorBindings((current) => ({
      ...current,
      [safeActorId]: selectedCharacter.id
    }));
    const message = `已绑定：${selectedActorCharacter.label} -> ${selectedCharacter.name || selectedCharacter.id}。后续行为树会读取这个实际角色的上下文。`;
    setBehaviorStatus(message);
    setNotice(message);
    return true;
  }

  function bindControlledSkinToBehaviorCharacter() {
    const safeActorId = commercialV2PlayerCharacterById.has(controlledPlayerId)
      ? controlledPlayerId
      : commercialV2RoleActorId;
    bindBehaviorActorToCharacter(safeActorId, behaviorCharacterId);
    setBehaviorPanelCollapsed(false);
  }

  function resolveBehaviorAction(actionId = behaviorAction) {
    return commercialV2BehaviorActions.find((item) => item.id === actionId) || commercialV2BehaviorActions[0];
  }

  function resolveBehaviorPlace(placeId = behaviorPlaceId) {
    return behaviorPlaceOptions.find((option) => option.id === placeId)
      || behaviorPlaceOptions.find((option) => option.id === 'restaurant')
      || behaviorPlaceOptions[0]
      || null;
  }

  function resolveBehaviorPlaceLink(placeOption) {
    if (!placeOption) return null;
    const targetId = String(placeOption.id || '');
    return placeLinks.find((place) => (
      place.placeId === targetId || place.locationId === targetId || place.locationIds?.includes(targetId)
    )) || null;
  }

  function getBehaviorUserDisplayName() {
    return String(userProfile?.name || '').trim() || '用户';
  }

  function summarizeBehaviorActor(actorId, label, options = {}) {
    const character = commercialV2PlayerCharacterById.get(actorId) || commercialV2PlayerCharacters[0];
    const actor = players[actorId] || createCommercialV2PlayerState(character);
    const semanticRole = options.semanticRole || (actorId === commercialV2UserActorId ? 'player_user' : 'character_actor');
    const boundCharacter = options.boundCharacter || null;
    const isUserActor = semanticRole === 'player_user';
    const displayName = isUserActor
      ? getBehaviorUserDisplayName()
      : (boundCharacter?.name || character.label);
    return {
      id: actorId,
      label: isUserActor ? displayName : label,
      display_name: displayName,
      semantic_role: semanticRole,
      sprite: character.label,
      bound_character_id: boundCharacter?.id || '',
      bound_character_name: boundCharacter?.name || '',
      direction: actor.direction,
      moving: Boolean(actor.moving),
      controlled: actorId === controlledPlayerId,
      movement_mode: 'side_scrolling_semantic'
    };
  }

  function summarizeBehaviorTreeForPayload(treeState = behaviorTreeState) {
    return buildBehaviorTreePayloadSummary(
      treeState,
      behaviorConfig,
      'street_runtime_single_character'
    );
  }

  function buildBehaviorPayload(options = {}) {
    const selectedAction = resolveBehaviorAction(options.actionId || behaviorAction);
    const selectedPlace = resolveBehaviorPlace(options.placeId || behaviorPlaceId);
    const selectedPlaceLink = resolveBehaviorPlaceLink(selectedPlace);
    return {
      player_event: {
        active: true,
        actor_role: 'player_user',
        actor_name: getBehaviorUserDisplayName(),
        action: selectedAction?.id || options.actionId || behaviorAction,
        action_label: selectedAction?.label || options.actionId || behaviorAction,
        action_hint: selectedAction?.hint || '',
        place_id: selectedPlace?.id || options.placeId || behaviorPlaceId || '',
        place_label: selectedPlace?.label || '',
        free_text: behaviorPromptText
      },
      world: {
        movement_model: 'side_scrolling_semantic_v1',
        movement_rule: '角色可以决定自由活动、靠近玩家、闲逛或去语义地点；不要生成像素坐标，前端会把 place_id 映射到本地平移锚点。',
        ordered_place_text: behaviorOrderedPlaces.map((place) => `${place.order}. ${place.name}`).join(' -> '),
        allowed_place_ids: behaviorOrderedPlaces.map((place) => place.placeId),
        allowed_movement_actions: commercialV2BehaviorMovementActions,
        actors: {
          role: summarizeBehaviorActor(behaviorTargetActorId, '角色小人', {
            semanticRole: 'character_actor',
            boundCharacter: behaviorCharacter
          }),
          user: summarizeBehaviorActor(behaviorUserActorId, '玩家小人', {
            semanticRole: 'player_user'
          })
        },
        actor_binding: {
          skin_actor_id: behaviorTargetActorId,
          skin_label: behaviorActorCharacter.label,
          character_id: behaviorCharacter?.id || '',
          character_name: behaviorCharacter?.name || ''
        },
        selected_place: selectedPlace
          ? {
            id: selectedPlace.id,
            label: selectedPlace.label,
            place: summarizeBehaviorPlaceForPayload(selectedPlaceLink)
          }
          : null,
        places_ordered: behaviorOrderedPlaces.map((place) => summarizeBehaviorPlaceForPayload(place)).filter(Boolean),
        free_activity_options: [
          'go_to_place: 前往表内地点',
          'wander_between: 在两个表内地点之间来回闲逛',
          'loop_in_front_of: 在表内地点前小范围循环移动',
          'browse_near: 在表内地点附近停停走走',
          'patrol_segment: 在两个表内地点之间巡逻',
          'approach_player: 靠近玩家',
          'follow_player: 跟随玩家',
          'walk_with_player: 陪玩家向表内地点移动',
          'idle_at_place: 在表内地点附近停留'
        ]
      },
      behavior_context: buildCommercialBehaviorContextConfig(behaviorConfig),
      behavior_tree: summarizeBehaviorTreeForPayload(options.behaviorTreeState || behaviorTreeState)
    };
  }

  function buildBehaviorPendingInput(options = {}, note = '当前前端请求；服务端会重新补齐 large_input。') {
    return {
      ...buildBehaviorPayload(options),
      debug_source: 'client_pending_behavior_request',
      debug_note: note
    };
  }

  async function pullBehaviorModels() {
    const customEndpoint = String(behaviorConfig.api_endpoint || '').trim();
    const customKey = String(behaviorConfig.api_key || '').trim();
    const customComplete = Boolean(customEndpoint && customKey);
    const customIncomplete = Boolean(customEndpoint || customKey) && !customComplete;
    if (customIncomplete && !activeBehaviorCharacterId) {
      const message = '自定义模型配置需要同时填写 URL 和 Key；当前也没有可用绑定角色。';
      setBehaviorModelStatus(message);
      setBehaviorStatus(message);
      return;
    }
    if (!customComplete && !activeBehaviorCharacterId) {
      const message = '没有绑定角色，无法使用角色模型配置。';
      setBehaviorModelStatus(message);
      setBehaviorStatus(message);
      return;
    }
    setBehaviorModelsLoading(true);
    const sourceLabel = customComplete ? '自定义配置' : '绑定角色配置';
    setBehaviorModelStatus(customIncomplete
      ? '自定义 URL/Key 未填完整，正在改用绑定角色配置拉取模型列表...'
      : `正在通过${sourceLabel}拉取模型列表...`);
    setBehaviorStatus('正在拉取模型列表...');
    try {
      const url = customComplete
        ? `${apiUrl}/models`
        : `${apiUrl}/city/characters/${encodeURIComponent(activeBehaviorCharacterId)}/behavior-models`;
      const { response, data } = await fetchBehaviorJsonWithTimeout(url, {
        method: customComplete ? 'POST' : 'GET',
        headers: getBehaviorAuthHeaders(),
        body: customComplete ? JSON.stringify({ endpoint: customEndpoint, key: customKey }) : undefined
      });
      if (!response.ok) throw new Error(data?.error || `模型列表读取失败 ${response.status}`);
      const models = Array.isArray(data?.models) ? data.models : [];
      setBehaviorModelOptions(models);
      const preferredModel = behaviorConfig.model_name || data?.model_name || behaviorCharacter?.model_name || '';
      if (!behaviorConfig.model_name && (models.includes(preferredModel) || preferredModel)) {
        updateBehaviorConfig({ model_name: preferredModel || models[0] });
      } else if (!behaviorConfig.model_name && models[0]) {
        updateBehaviorConfig({ model_name: models[0] });
      }
      const message = models.length
        ? `已通过${sourceLabel}拉取 ${models.length} 个模型。`
        : '模型接口返回为空，可以手动填写模型名。';
      setBehaviorModelStatus(message);
      setBehaviorStatus(message);
    } catch (error) {
      const message = `模型拉取失败：${error.name === 'AbortError' ? '请求超时' : error.message}`;
      setBehaviorModelStatus(message);
      setBehaviorStatus(message);
    } finally {
      setBehaviorModelsLoading(false);
    }
  }

  async function requestBehaviorInput() {
    if (!activeBehaviorCharacterId) {
      const message = '没有可用角色，先在角色设置里创建或启用一个角色。';
      setBehaviorStatus(message);
      setNotice(message);
      return;
    }
    const pendingMessage = '正在读取 AI 上文...';
    setBehaviorPanelCollapsed(false);
    setBehaviorFoldOpen((current) => ({ ...current, runtime: true, debug: true }));
    setBehaviorLoading(true);
    setBehaviorStatus(pendingMessage);
    setNotice(pendingMessage);
    const requestPayload = buildBehaviorPayload();
    setBehaviorInput({
      ...requestPayload,
      debug_source: 'client_pending_behavior_input_request',
      debug_note: '正在请求服务端补齐 large_input。'
    });
    setBehaviorOutput(null);
    try {
      const response = await fetch(`${apiUrl}/city/characters/${encodeURIComponent(activeBehaviorCharacterId)}/behavior-input`, {
        method: 'POST',
        headers: getBehaviorAuthHeaders(),
        body: JSON.stringify(requestPayload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `读取失败 ${response.status}`);
      setBehaviorInput(data.input || null);
      setBehaviorTreeState((currentTree) => mergeCommercialBehaviorIterationStateFromInput(currentTree, data.input));
      setBehaviorOutput(null);
      const message = '已读取 AI 上文；私聊和商业街活动只作背景，不会触发小人行动。';
      setBehaviorStatus(message);
      setNotice(message);
    } catch (error) {
      const message = `AI 上文读取失败：${error.message}`;
      setBehaviorStatus(message);
      setNotice(message);
    } finally {
      setBehaviorLoading(false);
    }
  }

  async function generateBehaviorBranch(options = {}) {
    if (!activeBehaviorCharacterId) {
      const message = '没有可用角色，先在角色设置里创建或启用一个角色。';
      setBehaviorStatus(message);
      setNotice(message);
      return;
    }
    const actionId = options.actionId || behaviorAction;
    const placeId = options.placeId || behaviorPlaceId;
    const selectedAction = resolveBehaviorAction(actionId);
    if (actionId !== behaviorAction) setBehaviorAction(actionId);
    if (placeId && placeId !== behaviorPlaceId) setBehaviorPlaceId(placeId);
    const pendingMessage = '正在生成互动回应...模型请求可能需要几十秒，请稍等。';
    setBehaviorPanelCollapsed(false);
    setBehaviorFoldOpen((current) => ({ ...current, runtime: true, debug: true }));
    setBehaviorLoading(true);
    setBehaviorStatus(pendingMessage);
    setNotice(pendingMessage);
    setPlayerActionBubble(selectedAction?.label || '互动');
    const requestPayload = buildBehaviorPayload({ actionId, placeId });
    setBehaviorInput(buildBehaviorPendingInput(
      { actionId, placeId },
      '当前点击选项产生的请求；服务端会重新补齐 large_input。'
    ));
    setBehaviorOutput(null);
    try {
      const { response, data } = await fetchBehaviorJsonWithTimeout(`${apiUrl}/city/characters/${encodeURIComponent(activeBehaviorCharacterId)}/behavior-branch`, {
        method: 'POST',
        headers: getBehaviorAuthHeaders(),
        body: JSON.stringify({
          ...requestPayload,
          api_endpoint: behaviorConfig.api_endpoint,
          api_key: behaviorConfig.api_key,
          model_name: behaviorConfig.model_name
        })
      }, commercialV2BehaviorGenerationTimeoutMs);
      if (!response.ok) throw new Error(data?.error || `生成失败 ${response.status}`);
      setBehaviorInput(data.input || null);
      const source = 'ai';
      const patchResult = mergeBehaviorTreePatch(data.tree_patch || data.patch, data.branch, source);
      setBehaviorTreeState((currentTree) => mergeCommercialBehaviorIterationStateFromInput(currentTree, data.input));
      setBehaviorOutput({
        branch: data.branch || null,
        tree_patch: patchResult?.patch || data.tree_patch || data.patch || null,
        tree_version: patchResult?.tree?.version || behaviorTreeState.version,
        fallback: false,
        error: data.error || '',
        raw_output: data.raw_output || ''
      });
      if (patchResult?.activeBranch) activateBehaviorBranch(patchResult.activeBranch, source);
      const message = 'AI patch 已合并进完整行为树。';
      setBehaviorStatus(message);
      setNotice(message);
      return { ok: true, patchResult };
    } catch (error) {
      const message = formatBehaviorRequestError(error, '互动回应生成失败，请重试。');
      const statusMessage = `互动回应生成失败：${message}`;
      setBehaviorStatus(statusMessage);
      setNotice(statusMessage);
      setBehaviorOutput({
        branch: null,
        tree_patch: null,
        tree_version: behaviorTreeState.version,
        fallback: false,
        error: message,
        raw_output: ''
      });
      return { ok: false, error: message };
    } finally {
      setBehaviorLoading(false);
    }
  }

  async function generateBaseBehaviorBranches() {
    if (!activeBehaviorCharacterId) {
      const message = '没有可用角色，先在角色设置里创建或启用一个角色。';
      setBehaviorStatus(message);
      setNotice(message);
      return;
    }
    const pendingMessage = '正在生成行为枝丫池...基础枝丫和互动开场会一起生成，可能需要 1-2 分钟。';
    setBehaviorPanelCollapsed(false);
    setBehaviorLoading(true);
    setBehaviorStatus(pendingMessage);
    setNotice(pendingMessage);
    setBehaviorFoldOpen((current) => ({ ...current, runtime: true, debug: true }));
    const rebuildTree = createCommercialBehaviorTreeRebuildState(
      behaviorTreeStateRef.current || behaviorTreeState,
      'street_runtime_single_character'
    );
    const requestPayload = buildBehaviorPayload({ behaviorTreeState: rebuildTree });
    setBehaviorInput({
      ...requestPayload,
      debug_source: 'client_pending_behavior_base_request',
      debug_note: '当前日常行为整体重建请求；旧枝丫上下文已清空，服务端会重新补齐 large_input。'
    });
    setBehaviorOutput(null);
    try {
      const { response, data } = await fetchBehaviorJsonWithTimeout(`${apiUrl}/city/characters/${encodeURIComponent(activeBehaviorCharacterId)}/behavior-base-branches`, {
        method: 'POST',
        headers: getBehaviorAuthHeaders(),
        body: JSON.stringify({
          ...requestPayload,
          api_endpoint: behaviorConfig.api_endpoint,
          api_key: behaviorConfig.api_key,
          model_name: behaviorConfig.model_name
        })
      }, commercialV2BehaviorBaseGenerationTimeoutMs);
      if (!response.ok) throw new Error(data?.error || `生成失败 ${response.status}`);
      setBehaviorInput(data.input || null);
      const combinedPatches = [
        ...(data.base_patches || []).map((patch) => ({ ...(patch || {}), source: patch?.source || 'ai-base' })),
        ...(data.interaction_patches || []).map((patch) => ({ ...(patch || {}), source: patch?.source || 'ai-interaction-starter' }))
      ];
      const patchResult = mergeBehaviorTreePatches(combinedPatches, 'ai-tree', rebuildTree);
      setBehaviorTreeState((currentTree) => mergeCommercialBehaviorIterationStateFromInput(currentTree, data.input));
      const baseBranchCount = data.base_branches?.length || 0;
      const interactionBranchCount = data.interaction_branches?.length || 0;
      setBehaviorOutput({
        base_branches: data.base_branches || [],
        base_patches: data.base_patches || [],
        interaction_branches: data.interaction_branches || [],
        interaction_patches: data.interaction_patches || [],
        merged_patches: patchResult?.patches || [],
        tree_version: patchResult?.tree?.version || behaviorTreeState.version,
        fallback: false,
        error: data.error || '',
        raw_output: data.raw_output || ''
      });
      autonomousBehaviorCursorRef.current = 0;
      autonomousBehaviorRecentRef.current = [];
      const message = `AI 行为枝丫已加入：日常 ${baseBranchCount} 条，互动开场 ${interactionBranchCount} 条。`;
      setBehaviorStatus(message);
      setNotice(message);
    } catch (error) {
      const message = formatBehaviorRequestError(error, '日常行为生成失败，请重试。');
      const statusMessage = `日常行为生成失败：${message}`;
      setBehaviorStatus(statusMessage);
      setNotice(statusMessage);
      setBehaviorOutput({
        base_branches: [],
        base_patches: [],
        interaction_branches: [],
        interaction_patches: [],
        tree_version: behaviorTreeState.version,
        fallback: false,
        error: message,
        raw_output: ''
      });
    } finally {
      setBehaviorLoading(false);
    }
  }

  function mergeBehaviorTreePatch(rawPatch, fallbackBranch = null, source = 'manual') {
    const result = mergeCommercialBehaviorTreePatchForRuntime(
      behaviorTreeState,
      rawPatch,
      fallbackBranch,
      source,
      activeBehaviorCharacterId,
      behaviorCharacter
    );
    if (!result.patch) return null;
    setBehaviorTreeState(result.tree);
    setBehaviorPatchOutput({
      patch: result.patch,
      active_node_id: result.tree.active_node_id,
      tree_version: result.tree.version,
      patch_history: result.tree.patch_history.slice(0, 6)
    });
    return result;
  }

  function mergeBehaviorTreePatches(rawPatches = [], source = 'manual', baseTree = behaviorTreeState) {
    const result = mergeCommercialBehaviorTreePatchesForRuntime(
      baseTree,
      rawPatches,
      source,
      activeBehaviorCharacterId,
      behaviorCharacter
    );
    if (!result?.patches?.length) return null;
    const nextTree = result.tree;
    const patches = result.patches;
    setBehaviorTreeState(nextTree);
    setBehaviorPatchOutput({
      patches,
      count: patches.length,
      active_node_id: nextTree.active_node_id,
      tree_version: nextTree.version,
      patch_history: nextTree.patch_history.slice(0, 10)
    });
    return { tree: nextTree, patches };
  }

  function pickAutonomousBehaviorBranch(options = {}) {
    const tree = behaviorTreeStateRef.current || behaviorTreeState || createCommercialV2BehaviorTreeState();
    const nodes = tree.nodes || {};
    const allowedPlaceIds = behaviorOrderedPlaces.map((place) => place.placeId);
    const dynamicBaseNodeIds = commercialV2BehaviorBaseNodeIds
      .flatMap((nodeId) => Array.isArray(nodes[nodeId]?.children_ids) ? nodes[nodeId].children_ids : [])
      .filter(Boolean);
    const generatedBaseNodeIds = dynamicBaseNodeIds.filter((nodeId) => {
      const node = nodes[nodeId] || {};
      return String(node.source || '').startsWith('ai') || !commercialV2BehaviorDefaultBaseActionNodeIds.includes(nodeId);
    });
    const sourceNodeIds = generatedBaseNodeIds.length
      ? Array.from(new Set(generatedBaseNodeIds))
      : (options.nearby
        ? Array.from(new Set([...commercialV2BehaviorNearbyAutonomousNodeIds, ...commercialV2BehaviorAutonomousNodeIds]))
        : Array.from(new Set(commercialV2BehaviorAutonomousNodeIds)));
    const candidates = sourceNodeIds
      .map((nodeId) => createCommercialBehaviorBranchFromNode(nodes[nodeId]))
      .filter((branch) => branch
        && commercialBehaviorBranchMatchesOwner(branch, activeBehaviorCharacterId)
        && !commercialBehaviorBranchIsTravelRecovery(branch)
        && Array.isArray(branch.steps)
        && behaviorBranchReferencesOnlyPlaces(branch, allowedPlaceIds));
    if (!candidates.length) return null;
    const recentIds = autonomousBehaviorRecentRef.current || [];
    const freshCandidates = candidates.length > 3
      ? candidates.filter((branch) => !recentIds.includes(branch.branch_id))
      : candidates;
    const playableCandidates = sortCommercialBehaviorBranchesByLiveliness(freshCandidates.length ? freshCandidates : candidates);
    const cursor = autonomousBehaviorCursorRef.current % playableCandidates.length;
    autonomousBehaviorCursorRef.current += 1;
    const selected = playableCandidates[cursor];
    autonomousBehaviorRecentRef.current = [
      selected.branch_id,
      ...recentIds.filter((id) => id !== selected.branch_id)
    ].slice(0, Math.min(4, Math.max(1, candidates.length - 1)));
    return selected;
  }

  function runPlayerInteraction(actionId) {
    if (!behaviorInteractionState.nearby || behaviorLoading) return;
    const selectedAction = resolveBehaviorAction(actionId);
    const selectedPlace = resolveBehaviorPlace(behaviorPlaceId);
    const selectedPlaceId = selectedPlace?.id || behaviorPlaceId || 'restaurant';
    const selectedPlaceLabel = selectedPlace?.label || '街区';
    if (actionId !== behaviorAction) setBehaviorAction(actionId);
    setInteractionMenuOpen(false);
    keepBehaviorInteractionSessionActive();
    if (behaviorRuntimeRef.current?.source === 'base') {
      clearBehaviorRuntime('');
    }
    const generatedStarterBranch = pickGeneratedInteractionStarterBranch(
      behaviorTreeStateRef.current || behaviorTreeState,
      actionId,
      selectedPlaceId,
      behaviorOrderedPlaces.map((place) => place.placeId),
      activeBehaviorCharacterId
    );
    const presetBranch = generatedStarterBranch || createCommercialV2PresetInteractionBranch(
      actionId,
      selectedPlaceId,
      selectedPlaceLabel
    );
    setBehaviorInput(buildBehaviorPendingInput(
      { actionId, placeId: selectedPlaceId },
      generatedStarterBranch
        ? '当前行为树互动开场枝丫；末尾选项会用这个动作继续生成。'
        : '当前本地兜底互动请求；末尾选项会用这个动作继续生成。'
    ));
    executeBehaviorBranch(presetBranch, generatedStarterBranch?.source || 'preset');
    setPlayerActionBubble(selectedAction?.label || '互动');
    setBehaviorStatus(`${generatedStarterBranch ? '已触发行为树互动枝丫' : '已触发本地兜底互动'}：${presetBranch.title}。请选择末尾选项生成后续回应。`);
  }

  function continueBehaviorDialog() {
    const runtime = behaviorRuntimeRef.current;
    if (runtime && activeBehaviorDialog?.runtimeId === runtime.id) {
      keepBehaviorInteractionSessionActive();
      runtime.waitingForDialog = false;
      runtime.waitingForChoice = false;
      runtime.stepIndex += 1;
      runtime.waitingUntil = Date.now() + 120;
      setBehaviorStatus('已继续执行当前行为。');
    }
    setActiveBehaviorDialog(null);
  }

  function exitBehaviorDialog() {
    behaviorInteractionSessionRef.current = { active: false, expiresAt: 0 };
    autonomousBehaviorCooldownRef.current = Date.now() + 800;
    clearBehaviorRuntime('已退出互动对话。');
    setInteractionMenuOpen(false);
    setBehaviorStatus('已退出互动对话。');
  }

  async function chooseBehaviorDialogChoice(choice) {
    if (behaviorChoicePendingRef.current || behaviorLoading) {
      setBehaviorStatus('正在处理上一个玩家回应，请稍等。');
      return;
    }
    const triggerAction = resolveBehaviorChoiceTrigger(choice);
    const resolvedChoicePlaceId = resolveBehaviorChoicePlaceIdFromPlaces(
      choice,
      triggerAction,
      behaviorOrderedPlaces,
      behaviorPlaceOptions
    );
    const nextPlaceId = String(resolvedChoicePlaceId || (triggerAction === 'suggest_destination' ? '' : behaviorPlaceId) || '').trim();
    if (!triggerAction) {
      setBehaviorStatus('该选项缺少有效后续动作，请换一个回应。');
      setActiveBehaviorDialog((current) => current
        ? { ...current, text: '该选项缺少有效后续动作，请换一个回应。' }
        : current);
      return;
    }
    if (triggerAction === 'suggest_destination' && !nextPlaceId) {
      setBehaviorStatus('该选项没有可识别的目标地点，请换一个回应。');
      setActiveBehaviorDialog((current) => current
        ? { ...current, text: '该选项没有可识别的目标地点，请换一个回应。' }
        : current);
      return;
    }
    behaviorChoicePendingRef.current = true;
    keepBehaviorInteractionSessionActive();
    const selectedLabel = String(choice?.label || choice?.text || '这个回应').trim();
    const previousDialog = activeBehaviorDialog;
    setInteractionMenuOpen(false);
    setBehaviorStatus(`已选择“${selectedLabel}”，正在生成后续互动回应...`);
    setActiveBehaviorDialog({
      runtimeId: activeBehaviorDialog?.runtimeId || '',
      type: 'pending',
      title: behaviorCharacter?.name || '角色',
      text: `已选择“${selectedLabel}”，正在生成后续互动回应...`,
      choices: [],
      stepIndex: activeBehaviorDialog?.stepIndex || 0,
      totalSteps: activeBehaviorDialog?.totalSteps || 1
    });
    try {
      const branchResult = await generateBehaviorBranch({ actionId: triggerAction, placeId: nextPlaceId || behaviorPlaceId });
      if (!branchResult?.ok) {
        setActiveBehaviorDialog({
          ...(previousDialog || {}),
          runtimeId: previousDialog?.runtimeId || '',
          type: 'choice',
          title: previousDialog?.title || behaviorCharacter?.name || '角色',
          text: `后续枝丫生成失败：${branchResult?.error || '请重试。'}`,
          choices: previousDialog?.choices?.length ? previousDialog.choices : [choice],
          stepIndex: previousDialog?.stepIndex || 0,
          totalSteps: previousDialog?.totalSteps || 1
        });
        return;
      }
      setActiveBehaviorDialog((current) => current?.type === 'pending' ? null : current);
    } finally {
      behaviorChoicePendingRef.current = false;
    }
  }

  function executeBehaviorBranch(branch, source = 'manual') {
    if (!branch) {
      setBehaviorStatus('当前没有可执行的行为。');
      return;
    }
    const patchResult = mergeBehaviorTreePatch(createCommercialBehaviorPatchFromBranch(branch, source), branch, source);
    setBehaviorOutput({
      branch,
      tree_patch: patchResult?.patch || null,
      tree_version: patchResult?.tree?.version || behaviorTreeState.version,
      fallback: source !== 'ai' && !String(source || '').startsWith('ai-'),
      error: '',
      raw_output: JSON.stringify(branch, null, 2)
    });
    if (patchResult?.activeBranch) activateBehaviorBranch(patchResult.activeBranch, source);
    setBehaviorStatus(source === 'demo' ? '已把 demo patch 合并进完整行为树，并开始执行。' : '已重新合并当前输出 patch 并执行。');
  }

  function renderPlayerInteractionMenu() {
    if (!behaviorInteractionState.nearby || activeBehaviorDialog) return null;
    const style = {
      left: `${(behaviorInteractionState.x / stageSize.width) * 100}%`,
      top: `${(behaviorInteractionState.y / stageSize.height) * 100}%`
    };
    const sideClass = behaviorInteractionState.side === 'left' ? 'side-left' : 'side-right';
    if (!interactionMenuOpen) {
      return (
        <button
          type="button"
          className={`pixel-world-interaction-entry ${sideClass}`}
          style={style}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setInteractionMenuOpen(true)}
          disabled={behaviorLoading || !activeBehaviorCharacterId}
        >
          <strong>{behaviorLoading ? '生成中' : '互动'}</strong>
          <span>{behaviorCharacter?.name || '角色'}</span>
        </button>
      );
    }
    return (
      <div
        className={`pixel-world-interaction-menu ${sideClass}`}
        style={style}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="pixel-world-interaction-menu-head">
          <strong>{behaviorCharacter?.name || '角色'}</strong>
          <button
            type="button"
            className="pixel-world-interaction-close"
            onClick={() => setInteractionMenuOpen(false)}
          >
            收起
          </button>
        </div>
        <div className="pixel-world-interaction-menu-primary">
          {behaviorPrimaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={behaviorAction === action.id ? 'active' : ''}
              disabled={behaviorLoading || !activeBehaviorCharacterId}
              title={action.hint}
              onClick={() => runPlayerInteraction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="pixel-world-interaction-menu-target">
          <span>目的地</span>
          <select
            value={behaviorPlaceId}
            onChange={(event) => setBehaviorPlaceId(event.target.value)}
            disabled={behaviorLoading || !behaviorPlaceOptions.length}
            aria-label="互动目的地"
          >
            {behaviorPlaceOptions.length ? behaviorPlaceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.order ? `${option.order}. ` : ''}{option.label}
              </option>
            )) : (
              <option value="">暂无地点</option>
            )}
          </select>
        </div>
        <div className="pixel-world-interaction-menu-context">
          {behaviorContextActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={behaviorAction === action.id ? 'active' : ''}
              disabled={behaviorLoading || !activeBehaviorCharacterId}
              title={action.hint}
              onClick={() => runPlayerInteraction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderBehaviorActorCard(actorId, title, note) {
    const character = commercialV2PlayerCharacterById.get(actorId) || commercialV2PlayerCharacters[0];
    const actor = players[actorId] || createCommercialV2PlayerState(character);
    const actorKind = actorId === behaviorTargetActorId ? 'role' : 'user';
    return (
      <div className={`pixel-world-behavior-actor ${actorKind}`}>
        <img src={commercialV2PlayerFrame(actor, `${actor.direction || 'front'}_walk_idle.png`)} alt="" draggable={false} />
        <div>
          <strong>{title}</strong>
          <span>{character.label} · 平移街区</span>
          <small>{note}</small>
        </div>
      </div>
    );
  }

  function toggleBehaviorFold(key) {
    setBehaviorFoldOpen((current) => ({
      ...current,
      [key]: !current[key]
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
          <span>{title}</span>
          {summary && <small>{summary}</small>}
          <strong>{open ? '收起' : '展开'}</strong>
        </button>
        {open && (
          <div className="pixel-world-behavior-fold-body">
            {children}
          </div>
        )}
      </section>
    );
  }

  function renderBehaviorTreePanel() {
    const behaviorPanelStateLabel = behaviorLoading
      ? '生成中'
      : behaviorOutput?.error
      ? 'Error'
      : (behaviorOutput?.fallback ? 'Fallback' : behaviorOutput ? 'AI' : 'Draft');
    const behaviorStatusTone = behaviorLoading
      ? 'busy'
      : (behaviorOutput?.error ? 'error' : (behaviorOutput ? 'ready' : 'idle'));
    if (behaviorPanelCollapsed) {
      return (
        <aside className="pixel-world-behavior-panel collapsed">
          <button
            type="button"
            className="pixel-world-behavior-panel-expand"
            onClick={() => setBehaviorPanelCollapsed(false)}
            title="展开行为树面板"
            aria-label="展开行为树面板"
          >
            <span>行为树</span>
            <strong>{behaviorPanelStateLabel}</strong>
            <small>展开</small>
          </button>
        </aside>
      );
    }

    return (
      <aside className="pixel-world-behavior-panel">
        <div className="pixel-world-behavior-head">
          <div>
            <h3>行为树 V1</h3>
            <span>单角色街区行为运行时</span>
          </div>
          <div className="pixel-world-behavior-head-actions">
            <strong>{behaviorPanelStateLabel}</strong>
            <button
              type="button"
              onClick={() => setBehaviorPanelCollapsed(true)}
              title="收起整个行为树面板"
            >
              收起
            </button>
          </div>
        </div>

        <div className={`pixel-world-behavior-live-status ${behaviorStatusTone}`} aria-live="polite">
          <strong>{behaviorLoading ? '请求进行中' : (behaviorOutput?.error ? '请求失败' : '状态')}</strong>
          <span>{behaviorLoading ? '模型正在生成行为树，请保持此页打开。' : behaviorStatus}</span>
        </div>

        <div className="pixel-world-behavior-actors">
          {renderBehaviorActorCard(behaviorTargetActorId, '角色皮套', behaviorBoundCharacter?.name ? `绑定：${behaviorBoundCharacter.name}` : '等待绑定实际角色')}
          {renderBehaviorActorCard(behaviorUserActorId, '玩家小人', userProfile?.name ? `玩家：${userProfile.name}` : '玩家控制入口')}
        </div>

        <div className="pixel-world-behavior-binding-grid">
          <label className="pixel-world-behavior-field">
            <span>行为皮套</span>
            <select
              value={behaviorTargetActorId}
              onChange={(event) => setBehaviorActorId(event.target.value)}
            >
              {commercialV2PlayerCharacters.map((character) => (
                <option key={character.id} value={character.id}>{character.label}</option>
              ))}
            </select>
          </label>
          <label className="pixel-world-behavior-field">
            <span>实际角色</span>
            <select
              value={behaviorCharacterId}
              onChange={(event) => setBehaviorCharacterId(event.target.value)}
              disabled={!behaviorCharacters.length}
            >
              {behaviorCharacters.length ? behaviorCharacters.map((item) => (
                <option key={item.id} value={item.id}>{item.name || item.id}</option>
              )) : (
                <option value="">暂无角色</option>
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={() => bindBehaviorActorToCharacter(behaviorTargetActorId, behaviorCharacterId)}
            disabled={!behaviorCharacters.length || !behaviorCharacterId}
            title="把选中的实际角色绑定到当前行为皮套；行为树生成会读取该角色的上下文。"
          >
            绑定到此皮套
          </button>
          <button
            type="button"
            onClick={bindControlledSkinToBehaviorCharacter}
            disabled={!behaviorCharacters.length || !behaviorCharacterId}
            title="把上方“控制角色”当前选中的皮套绑定到这个实际角色。"
          >
            绑定当前选中皮套
          </button>
          <div className={`pixel-world-behavior-binding-status ${behaviorBoundCharacter ? 'bound' : ''}`}>
            {behaviorBindingSummary}
          </div>
        </div>

        {renderBehaviorFold(
          'model',
          '模型配置',
          behaviorConfig.model_name || behaviorCharacter?.model_name || '使用绑定角色',
          (
            <div className="pixel-world-behavior-model-grid">
              <label className="pixel-world-behavior-field">
                <span>URL</span>
                <input
                  value={behaviorConfig.api_endpoint}
                  onChange={(event) => updateBehaviorConfig({ api_endpoint: event.target.value })}
                  placeholder={behaviorCharacter?.api_endpoint ? '留空使用绑定角色 URL' : 'https://api.example.com/v1'}
                />
              </label>
              <label className="pixel-world-behavior-field">
                <span>Key</span>
                <input
                  type={behaviorShowKey ? 'text' : 'password'}
                  value={behaviorConfig.api_key}
                  onChange={(event) => updateBehaviorConfig({ api_key: event.target.value })}
                  placeholder="留空使用绑定角色 Key"
                />
              </label>
              <label className="pixel-world-behavior-field">
                <span>模型</span>
                <input
                  list="pixel-world-behavior-models"
                  value={behaviorConfig.model_name}
                  onChange={(event) => updateBehaviorConfig({ model_name: event.target.value })}
                  placeholder={behaviorCharacter?.model_name || '模型名'}
                />
                <datalist id="pixel-world-behavior-models">
                  {behaviorModelOptions.map((model) => <option key={model} value={model} />)}
                </datalist>
              </label>
              <div className="pixel-world-behavior-model-actions">
                <button type="button" onClick={pullBehaviorModels} disabled={behaviorModelsLoading}>
                  {behaviorModelsLoading ? '拉取中' : '拉取模型'}
                </button>
                <button type="button" onClick={() => setBehaviorShowKey((value) => !value)}>
                  {behaviorShowKey ? '隐藏 Key' : '显示 Key'}
                </button>
              </div>
              <div className={`pixel-world-behavior-model-status ${behaviorModelStatus.includes('失败') ? 'error' : ''}`}>
                {behaviorModelStatus}
              </div>
              {behaviorModelOptions.length > 0 && (
                <div className="pixel-world-behavior-model-list">
                  <div className="pixel-world-behavior-model-list-head">
                    <strong>模型列表</strong>
                    <span>{behaviorModelOptions.length} 个</span>
                  </div>
                  <div className="pixel-world-behavior-model-options">
                    {behaviorModelOptions.map((model) => (
                      <button
                        key={model}
                        type="button"
                        className={behaviorConfig.model_name === model ? 'active' : ''}
                        title={model}
                        onClick={() => updateBehaviorConfig({ model_name: model })}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {renderBehaviorFold(
          'context',
          '枝丫上下文',
          `q ${behaviorConfig.context_q_limit} / p ${behaviorConfig.context_summary_threshold}`,
          (
            <div className="pixel-world-behavior-context-grid">
              <label className="pixel-world-behavior-field">
                <span>q 原文窗口</span>
                <div className="pixel-world-behavior-slider-row">
                  <input
                    type="range"
                    min={commercialV2BehaviorContextMinQ}
                    max={commercialV2BehaviorContextMaxQ}
                    step="1"
                    value={behaviorConfig.context_q_limit}
                    onChange={(event) => updateBehaviorConfig({ context_q_limit: event.target.value })}
                  />
                  <strong>{behaviorConfig.context_q_limit}</strong>
                </div>
                <small>实时输入最多读取 q 条枝丫原文。</small>
              </label>
              <label className="pixel-world-behavior-field">
                <span>p 摘要阈值</span>
                <div className="pixel-world-behavior-slider-row">
                  <input
                    type="range"
                    min={commercialV2BehaviorContextMinP}
                    max={commercialV2BehaviorContextMaxP}
                    step="1"
                    value={behaviorConfig.context_summary_threshold}
                    onChange={(event) => updateBehaviorConfig({ context_summary_threshold: event.target.value })}
                  />
                  <strong>{behaviorConfig.context_summary_threshold}</strong>
                </div>
                <small>q 窗口外未摘要枝丫积攒到 p 条时，生成前先用小模型总结；失败会中止本轮。</small>
              </label>
              <div className="pixel-world-behavior-context-stats">
                摘要积攒：
                <strong>{behaviorContextStats.pending_summary_count} / {behaviorContextStats.p_summary_threshold}</strong>
                条待总结，当前读取 {behaviorContextStats.active_summary_count} 轮摘要。
                <span>原文 {behaviorContextStats.raw_readable_count} / {behaviorContextStats.q_raw_limit} 条</span>
              </div>
            </div>
          )
        )}

        {renderBehaviorFold(
          'constraints',
          'AI 可选白名单',
          `${behaviorOrderedPlaces.length} 地点 / ${commercialV2BehaviorMovementActions.length} 移动动作`,
          (
            <div className="pixel-world-behavior-constraints">
              <div>
                <strong>地点</strong>
                <div className="pixel-world-behavior-chip-list">
                  {behaviorOrderedPlaces.map((place) => (
                    <span key={place.placeId}>{place.order}. {place.name}</span>
                  ))}
                </div>
              </div>
              <div>
                <strong>移动动作</strong>
                <div className="pixel-world-behavior-chip-list">
                  {commercialV2BehaviorMovementActions.map((action) => (
                    <span key={action.id}>{action.label}</span>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {renderBehaviorFold(
          'branchMap',
          '行为分层',
          '日常行为 / 互动回应',
          (
            <div className="pixel-world-behavior-branch-map">
              <div>
                <strong>互动回应</strong>
                <span>player_interaction · 玩家点击互动或选择回应后，AI 会把新的互动行为写到这里。</span>
              </div>
              <div>
                <strong>日常行为</strong>
                <span>无互动时自动轮询：硬需求、本地例行、地点能力、背景情绪、好奇、自由活动、微动作。</span>
              </div>
            </div>
          )
        )}

        {renderBehaviorFold(
          'interaction',
          '互动设置',
          behaviorInteractionState.nearby ? `距离 ${Math.round(behaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}` : '靠近后弹出菜单',
          (
            <>
              <div className={`pixel-world-behavior-proximity ${behaviorInteractionState.nearby ? 'nearby' : ''}`}>
                <strong>{behaviorInteractionState.nearby ? '角色已在互动范围' : '玩家靠近角色后弹出菜单'}</strong>
                <span>距离 {Math.round(behaviorInteractionState.distance)} / {commercialV2BehaviorInteractionDistance}</span>
              </div>

        <label className="pixel-world-behavior-field">
          <span>目标地点</span>
          <select
            value={behaviorPlaceId}
            onChange={(event) => setBehaviorPlaceId(event.target.value)}
            disabled={!behaviorPlaceOptions.length}
          >
            {behaviorPlaceOptions.length ? behaviorPlaceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.order ? `${option.order}. ` : ''}{option.label}
              </option>
            )) : (
              <option value="">暂无地点</option>
            )}
          </select>
        </label>
        <label className="pixel-world-behavior-field">
          <span>补充输入</span>
          <textarea
            value={behaviorPromptText}
            onChange={(event) => setBehaviorPromptText(event.target.value)}
            placeholder="例如：玩家想让角色陪自己去便利店，但别太听话，要有一点临场反应。"
          />
        </label>

        <div className="pixel-world-behavior-run-row">
          <button
            type="button"
            onClick={requestBehaviorInput}
            disabled={behaviorLoading || !activeBehaviorCharacterId}
            title="整理角色记忆、当前场景和地点白名单，查看 AI 实际会收到的上文。"
          >
            读取 AI 上文
          </button>
          <button
            type="button"
            onClick={generateBaseBehaviorBranches}
            disabled={behaviorLoading || !activeBehaviorCharacterId}
            title="让 AI 生成无人互动时会自动轮询的日常行动池。"
          >
            {behaviorLoading ? '生成中...' : '生成行为枝丫'}
          </button>
          <button
            type="button"
            className="primary"
            onClick={generateBehaviorBranch}
            disabled={behaviorLoading || !activeBehaviorCharacterId}
            title="根据当前玩家动作、目标地点和补充输入，生成下一段互动回应。"
          >
            生成互动回应
          </button>
          <button
            type="button"
            onClick={() => {
              const branch = pickAutonomousBehaviorBranch();
              if (!branch) {
                setBehaviorStatus('当前没有可试跑的日常行为，先确认地点白名单是否存在，或先生成行为枝丫。');
                return;
              }
              autonomousBehaviorCooldownRef.current = Date.now() + commercialV2BehaviorAutonomousCooldownMs;
              activateBehaviorBranch(branch, 'base');
              setBehaviorStatus(`已试跑日常行为：${branch.title}`);
            }}
            disabled={behaviorLoading || !activeBehaviorCharacterId}
            title="从已生成的日常行动池中挑一条立刻执行。"
          >
            试跑日常行为
          </button>
          <button
            type="button"
            onClick={() => executeBehaviorBranch(behaviorOutput?.branch, 'replay')}
            disabled={behaviorLoading || !behaviorOutput?.branch}
            title="重新执行上一次 AI 生成的互动行为。"
          >
            重跑当前行为
          </button>
          <button
            type="button"
            onClick={() => executeBehaviorBranch(commercialV2BehaviorLastDemoBranch, 'demo')}
            disabled={behaviorLoading}
            title="载入内置示例，用来快速测试行为树对话流程。"
          >
            运行示例互动
          </button>
          <button
            type="button"
            onClick={() => {
              const resetTree = createCommercialV2BehaviorTreeState();
              setBehaviorTreeState(resetTree);
              setBehaviorPatchOutput(null);
              setBehaviorStatus('完整行为树已重置。');
            }}
            disabled={behaviorLoading}
            title="清空已生成的行为节点，恢复默认行为树。"
          >
            清空行为树
          </button>
        </div>
            </>
          )
        )}

        {renderBehaviorFold(
          'runtime',
          '运行状态',
          activeBehaviorBranch ? activeBehaviorBranch.title : `版本 ${behaviorTreeState.version} · patch ${behaviorTreeState.patch_history?.length || 0}`,
          (
            <>
              <div className="pixel-world-behavior-status">{behaviorLoading ? '处理中...' : behaviorStatus}</div>
              <div className={`pixel-world-behavior-runtime ${activeBehaviorBranch ? 'active' : ''}`}>
          {activeBehaviorBranch ? (
            <>
              <strong>{activeBehaviorBranch.branchKindLabel || '完整树运行节点'}</strong>
              <span>{activeBehaviorBranch.title}</span>
              <small>
                {Math.min((activeBehaviorBranch.stepIndex || 0) + 1, activeBehaviorBranch.totalSteps || 1)}
                /{activeBehaviorBranch.totalSteps || 1}
                {activeBehaviorBranch.currentAction ? ` · ${activeBehaviorBranch.currentAction}` : ''}
                {behaviorTreeState?.active_node_id ? ` · node:${behaviorTreeState.active_node_id}` : ''}
              </small>
              {activeBehaviorDialog && (
                <div className="pixel-world-behavior-runtime-control">
                  <strong>{activeBehaviorDialog.type === 'choice' ? '等待玩家选择' : '等待点击下一句'}</strong>
                  <p>{activeBehaviorDialog.text}</p>
                  {activeBehaviorDialog.type === 'pending' ? (
                    <button type="button" disabled>生成中...</button>
                  ) : activeBehaviorDialog.type === 'choice' && activeBehaviorDialog.choices?.length ? (
                    <div className="pixel-world-behavior-runtime-choice-grid">
                        {activeBehaviorDialog.choices.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => chooseBehaviorDialogChoice(choice)}
                            disabled={behaviorLoading}
                        >
                            {choice.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="pixel-world-behavior-dialog-exit"
                          onClick={exitBehaviorDialog}
                          disabled={behaviorLoading}
                        >
                          退出对话
                        </button>
                      </div>
                  ) : (
                    <button type="button" onClick={continueBehaviorDialog}>下一句</button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <strong>完整行为树</strong>
              <span>版本 {behaviorTreeState.version} · patch {behaviorTreeState.patch_history?.length || 0}</span>
              <small>日常行为会自动轮询；玩家互动会生成互动回应并立即执行。</small>
            </>
          )}
              </div>
            </>
          )
        )}

        {renderBehaviorFold(
          'debug',
          '调试 JSON',
          '完整树 / 输入 / Patch / 输出',
          (
            <div className="pixel-world-behavior-json-grid">
              <section>
                <h4>完整树</h4>
                <pre>{formatBehaviorJson(behaviorTreeState)}</pre>
              </section>
              <section>
                <h4>输入</h4>
                <pre>{formatBehaviorJson(behaviorInput || buildBehaviorPayload())}</pre>
              </section>
              <section>
                <h4>Patch</h4>
                <pre>{formatBehaviorJson(behaviorPatchOutput || { patch: null, note: '生成后显示本次局部行为树 patch。' })}</pre>
              </section>
              <section>
                <h4>输出</h4>
                <pre>{formatBehaviorJson(behaviorOutput || { base_branches: null, interaction_branches: null, branch: null, tree_patch: null, note: '点击“生成行为枝丫”会显示自动行动池和互动开场池；互动按钮会先执行 player_interaction 里的开场枝丫，选项会继续生成互动回应。' })}</pre>
              </section>
            </div>
          )
        )}
      </aside>
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

  const getPlayerFootBox = useCallback((x, y) => {
    const footWidth = Math.max(12, playerDimensions.width * 0.28);
    const footHeight = Math.max(8, playerDimensions.footOffset * 0.75);
    return {
      x: wrapLoopCoordinate(x, stageSize.width) - footWidth / 2,
      y: y - footHeight / 2,
      w: footWidth,
      h: footHeight
    };
  }, [playerDimensions.footOffset, playerDimensions.width, stageSize.width]);

  const getPlayerPeerCollisionBox = useCallback((x, y) => {
    const width = Math.max(
      commercialV2PlayerPeerCollision.minWidth,
      playerDimensions.width * commercialV2PlayerPeerCollision.widthRatio
    );
    const height = Math.max(
      commercialV2PlayerPeerCollision.minHeight,
      playerDimensions.footOffset * commercialV2PlayerPeerCollision.heightRatio
    );
    return {
      x: wrapLoopCoordinate(x, stageSize.width) - width / 2,
      y: y - height / 2,
      w: width,
      h: height
    };
  }, [playerDimensions.footOffset, playerDimensions.width, stageSize.width]);

  const getPlayerCollisionProbeBoxes = useCallback((x, y) => {
    const footBox = getPlayerFootBox(x, y);
    const upperProbeHeight = Math.max(8, Math.min(26, playerDimensions.footOffset * 1.6));
    return [
      footBox,
      {
        x: footBox.x,
        y: footBox.y - upperProbeHeight,
        w: footBox.w,
        h: upperProbeHeight
      }
    ];
  }, [getPlayerFootBox, playerDimensions.footOffset]);

  const isPlayerPointWalkable = useCallback((x, y) => {
    if (!walkableRects.length) return true;
    const pointX = wrapLoopCoordinate(x, stageSize.width);
    return walkableRects.some((rect) => [-stageSize.width, 0, stageSize.width].some((offset) => (
      pointX >= rect.x + offset
      && pointX <= rect.x + offset + rect.w
      && y >= rect.y
      && y <= rect.y + rect.h
    )));
  }, [stageSize.width, walkableRects]);

  const isPlayerBlockedByOtherPlayers = useCallback((x, y, options = {}) => {
    if (options.ignorePlayers) return false;
    const ignorePlayerId = options.ignorePlayerId || controlledPlayerIdRef.current;
    const currentPlayers = options.players || playersRef.current;
    const playerBox = getPlayerPeerCollisionBox(x, y);
    return commercialV2PlayerCharacters.some((character) => {
      if (character.id === ignorePlayerId) return false;
      const otherPlayer = currentPlayers[character.id];
      if (!otherPlayer) return false;
      const otherBox = getPlayerPeerCollisionBox(otherPlayer.x, otherPlayer.y);
      return [-stageSize.width, 0, stageSize.width].some((offset) => boxesOverlap(playerBox, {
        x: otherBox.x + offset,
        y: otherBox.y,
        w: otherBox.w,
        h: otherBox.h
      }));
    });
  }, [getPlayerPeerCollisionBox, stageSize.width]);

  const isPlayerFootBlocked = useCallback((x, y) => {
    if (!collisionRects.length) return false;
    const probeBoxes = getPlayerCollisionProbeBoxes(x, y);
    return collisionRects.some((rect) => [-stageSize.width, 0, stageSize.width].some((offset) => {
      const shiftedRect = {
        x: rect.x + offset,
        y: rect.y,
        w: rect.w,
        h: rect.h
      };
      return probeBoxes.some((box) => boxesOverlap(box, shiftedRect));
    }));
  }, [collisionRects, getPlayerCollisionProbeBoxes, stageSize.width]);

  const isAutoTravelFootBlocked = useCallback((x, y) => {
    if (!autoRouteBlockRects.length) return false;
    const probeBoxes = getPlayerCollisionProbeBoxes(x, y);
    return autoRouteBlockRects.some((rect) => [-stageSize.width, 0, stageSize.width].some((offset) => {
      const shiftedRect = {
        x: rect.x + offset,
        y: rect.y,
        w: rect.w,
        h: rect.h
      };
      return probeBoxes.some((box) => boxesOverlap(box, shiftedRect));
    }));
  }, [autoRouteBlockRects, getPlayerCollisionProbeBoxes, stageSize.width]);

  const isPlayerPositionAllowed = useCallback((x, y, options = {}) => (
    isPlayerPointWalkable(x, y)
    && !isPlayerFootBlocked(x, y)
    && !isPlayerBlockedByOtherPlayers(x, y, options)
  ), [isPlayerBlockedByOtherPlayers, isPlayerFootBlocked, isPlayerPointWalkable]);

  const isAutoTravelPositionAllowed = useCallback((x, y, options = {}) => (
    isPlayerPointWalkable(x, y)
    && !isAutoTravelFootBlocked(x, y)
    && !isPlayerBlockedByOtherPlayers(x, y, options)
  ), [isAutoTravelFootBlocked, isPlayerBlockedByOtherPlayers, isPlayerPointWalkable]);

  const isMainRoadPoint = useCallback((x, y) => {
    if (!mainRoadRects.length) return false;
    const pointX = wrapLoopCoordinate(x, stageSize.width);
    return mainRoadRects.some((rect) => [-stageSize.width, 0, stageSize.width].some((offset) => (
      pointX >= rect.x + offset
      && pointX <= rect.x + offset + rect.w
      && y >= rect.y
      && y <= rect.y + rect.h
    )));
  }, [mainRoadRects, stageSize.width]);

  const isStreetCruiseRoadPoint = useCallback((x, y) => {
    if (!streetCruiseRoadRects.length) return false;
    const pointX = wrapLoopCoordinate(x, stageSize.width);
    return streetCruiseRoadRects.some((rect) => [-stageSize.width, 0, stageSize.width].some((offset) => (
      pointX >= rect.x + offset
      && pointX <= rect.x + offset + rect.w
      && y >= rect.y
      && y <= rect.y + rect.h
    )));
  }, [stageSize.width, streetCruiseRoadRects]);

  const getStreetCruiseRoadPenalty = useCallback((x, y) => {
    if (!streetCruiseRoadRects.length) return 0;
    const pointX = wrapLoopCoordinate(x, stageSize.width);
    let bestScore = Infinity;
    streetCruiseRoadRects.forEach((rect) => {
      [-stageSize.width, 0, stageSize.width].forEach((offset) => {
        const left = rect.x + offset;
        const right = left + rect.w;
        if (pointX < left || pointX > right || y < rect.y || y > rect.y + rect.h) return;
        const centerY = rect.y + rect.h * commercialV2StreetCruiseRoadCenterRatio;
        bestScore = Math.min(
          bestScore,
          Math.abs(y - centerY) * commercialV2StreetCruiseCenterLinePenalty
        );
      });
    });
    return Number.isFinite(bestScore)
      ? bestScore
      : commercialV2StreetCruiseOffRoadPenalty;
  }, [stageSize.width, streetCruiseRoadRects]);

  const getSafePlayerSpawnPoint = useCallback((targetX = commercialV2PlayerInitial.x, targetY = commercialV2PlayerInitial.y) => {
    const targetPointX = wrapLoopCoordinate(targetX, stageSize.width);
    const candidates = [];
    const addCandidate = (x, y) => {
      candidates.push({
        x: wrapLoopCoordinate(x, stageSize.width),
        y
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
        y: Math.max(178, Math.min(Math.max(179, stageSize.height - 12), targetY))
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
    const largestRoad = walkableRects.reduce((largest, rect) => (
      !largest || rect.w * rect.h > largest.w * largest.h ? rect : largest
    ), null);
    return {
      x: wrapLoopCoordinate((largestRoad?.x ?? targetPointX) + (largestRoad?.w ?? 0) / 2, stageSize.width),
      y: largestRoad ? largestRoad.y + largestRoad.h * 0.6 : targetY
    };
  }, [isPlayerPositionAllowed, stageSize.height, stageSize.width, walkableRects]);

  const buildSafePlayerStates = useCallback((currentPlayers = createCommercialV2PlayerStates()) => {
    const occupiedPoints = [];
    const nextPlayers = {};
    commercialV2PlayerCharacters.forEach((character) => {
      const initial = createCommercialV2PlayerState(character);
      const current = currentPlayers[character.id] || initial;
      const targetOffsets = [0, 72, -72, 128, -128, 196, -196];
      let spawnPoint = null;
      for (const offset of targetOffsets) {
        const candidate = getSafePlayerSpawnPoint(initial.x + offset, initial.y);
        const overlapsExisting = occupiedPoints.some((point) => (
          Math.hypot(
            getCommercialV2LoopDeltaX(point.x, candidate.x, stageSize.width),
            point.y - candidate.y
          ) < 48
        ));
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
        stepTime: 0
      };
    });
    const roleSpawn = nextPlayers[commercialV2RoleActorId];
    const userSpawn = nextPlayers[commercialV2UserActorId];
    if (roleSpawn && userSpawn && isPlayerPositionAllowed(roleSpawn.x, userSpawn.y, { ignorePlayers: true })) {
      roleSpawn.y = userSpawn.y;
    }
    return nextPlayers;
  }, [getSafePlayerSpawnPoint, isPlayerPositionAllowed, stageSize.width]);

  const spawnPlayersOnStage = useCallback((basePlayers = playersRef.current) => {
    const nextPlayers = buildSafePlayerStates(basePlayers);
    playerSpawnedRef.current = true;
    playersRef.current = nextPlayers;
    playerRef.current = nextPlayers[controlledPlayerIdRef.current] || nextPlayers[commercialV2DefaultControlledPlayerId];
    setPlayers(nextPlayers);
  }, [buildSafePlayerStates]);

  const getNearestWalkablePlayerPoint = useCallback((x, y, current = null, options = {}) => {
    const pointOptions = {
      ignorePlayerId: options.ignorePlayerId || current?.id || controlledPlayerIdRef.current,
      ignorePlayers: Boolean(options.ignorePlayers)
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
      y: Math.max(fallbackMinY, Math.min(fallbackMaxY, y))
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
  }, [getSafePlayerSpawnPoint, isAutoTravelPositionAllowed, isPlayerPositionAllowed, stageSize.width, stageSize.height, walkableRects]);

  function addRoleCharacter() {
    const roleCharacter = commercialV2PlayerCharacterById.get(commercialV2RoleActorId);
    const userCharacter = commercialV2PlayerCharacterById.get(commercialV2UserActorId);
    if (!roleCharacter || !userCharacter) return;
    cancelAutoTravel();
    const currentPlayers = playersRef.current;
    const userPlayer = currentPlayers[commercialV2UserActorId] || createCommercialV2PlayerState(userCharacter);
    const rolePlayer = currentPlayers[commercialV2RoleActorId] || createCommercialV2PlayerState(roleCharacter);
    const spawnX = wrapLoopCoordinate(userPlayer.x + commercialV2PlayerApproachGap, stageSize.width);
    const spawnPoint = getNearestWalkablePlayerPoint(spawnX, userPlayer.y, rolePlayer, {
      fallbackToCurrent: false,
      ignorePlayerId: commercialV2RoleActorId
    });
    const faceUserDelta = getCommercialV2LoopDeltaX(spawnPoint.x, userPlayer.x, stageSize.width);
    const nextRole = {
      ...rolePlayer,
      ...spawnPoint,
      id: commercialV2RoleActorId,
      characterId: commercialV2RoleActorId,
      direction: faceUserDelta >= 0 ? 'right' : 'left',
      moving: false,
      frame: 0,
      stepTime: 0
    };
    const nextPlayers = {
      ...currentPlayers,
      [commercialV2RoleActorId]: nextRole
    };
    playersRef.current = nextPlayers;
    controlledPlayerIdRef.current = commercialV2RoleActorId;
    playerRef.current = nextRole;
    setPlayers(nextPlayers);
    setControlledPlayerId(commercialV2RoleActorId);
    setWorldPlayerBubble(commercialV2RoleActorId, 'char 试用');
    setNotice('已新增角色：角色小人现在绑定 char 试用版，并生成在玩家旁边。');
  }

  const getNearestMainRoadTravelPoint = useCallback((rawX, preferredY = null) => {
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
            const score = Math.abs(candidateX - targetX) * 0.8
              + Math.abs(candidateY - centerY) * 2.2
              + Math.abs(candidateY - preferredRoadY) * 0.25;
            if (!best || score < best.score) {
              best = { x, y: candidateY, score };
            }
          });
        });
      });
    });
    return best ? { x: best.x, y: best.y } : null;
  }, [isAutoTravelPositionAllowed, mainRoadRects, stageSize.width]);

  const getNearestStreetCruiseRoadTravelPoint = useCallback((rawX, preferredY = null) => {
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
            const score = Math.abs(candidateX - targetX) * 0.8
              + Math.abs(candidateY - centerY) * 3.6
              + Math.abs(candidateY - preferredRoadY) * 0.05;
            if (!best || score < best.score) {
              best = { x, y: candidateY, score };
            }
          });
        });
      });
    });
    return best ? { x: best.x, y: best.y } : null;
  }, [isAutoTravelPositionAllowed, stageSize.width, streetCruiseRoadRects]);

  const isAutoTravelSegmentClear = useCallback((fromPoint, toPoint) => {
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
  }, [isAutoTravelPositionAllowed, stageSize.width]);

  const simplifyAutoTravelPath = useCallback((points) => {
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
  }, [isAutoTravelSegmentClear]);

  const buildAutoTravelPath = useCallback((fromPoint, targetPoint, options = {}) => {
    if (stageSize.width <= 0 || stageSize.height <= 0) return null;
    const preferMainRoad = Boolean(options.preferMainRoad && mainRoadRects.length);
    const preferStreetCruiseRoad = Boolean(options.preferStreetCruiseRoad && streetCruiseRoadRects.length);
    const preferForward = Boolean(options.preferForward);
    const targetForwardDistance = preferForward
      ? Math.max(commercialV2StreetCruiseMinForward, getCommercialV2LoopDeltaX(fromPoint.x, targetPoint.x, stageSize.width))
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
        y: Math.min(stageSize.height - 1, row * cellSize + cellSize / 2)
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

    const startCell = findNearestCell(fromPoint, { requireClearSegment: isAutoTravelPositionAllowed(fromPoint.x, fromPoint.y) })
      || findNearestCell(fromPoint);
    const targetCell = findNearestCell(targetPoint, { requireClearSegment: isAutoTravelPositionAllowed(targetPoint.x, targetPoint.y) })
      || findNearestCell(targetPoint);
    if (!startCell || !targetCell) return null;
    if (startCell.index === targetCell.index) {
      const destination = isAutoTravelSegmentClear(fromPoint, targetPoint) ? targetPoint : targetCell.center;
      return {
        destination,
        waypoints: [destination],
        totalDistance: Math.hypot(
          getCommercialV2LoopDeltaX(fromPoint.x, destination.x, stageSize.width),
          destination.y - fromPoint.y
        )
      };
    }

    const getHeuristic = (index) => {
      const current = getCellCenter(index);
      const target = targetCell.center;
      return Math.hypot(
        getCommercialV2LoopDeltaX(current.x, target.x, stageSize.width),
        target.y - current.y
      );
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
      priority: getHeuristic(startCell.index)
    });

    const directions = [
      { dx: 1, dy: 0, cost: 1 },
      { dx: -1, dy: 0, cost: 1 },
      { dx: 0, dy: 1, cost: 1 },
      { dx: 0, dy: -1, cost: 1 },
      { dx: 1, dy: 1, cost: Math.SQRT2 },
      { dx: 1, dy: -1, cost: Math.SQRT2 },
      { dx: -1, dy: 1, cost: Math.SQRT2 },
      { dx: -1, dy: -1, cost: Math.SQRT2 }
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
        const mainRoadPenalty = preferMainRoad && !isMainRoadPoint(nextCenter.x, nextCenter.y)
          ? commercialV2MainRoadCellPenalty
          : 0;
        const streetCruiseRoadPenalty = preferStreetCruiseRoad
          ? getStreetCruiseRoadPenalty(nextCenter.x, nextCenter.y)
          : 0;
        const forwardPenalty = preferForward
          ? Math.max(0, getForwardProgress(currentCenter) - getForwardProgress(nextCenter)) * commercialV2ForwardPathBacktrackPenalty
            + Math.max(0, -getForwardProgress(nextCenter)) * commercialV2ForwardPathBacktrackPenalty
          : 0;
        const tentativeScore = gScore[currentNode.index]
          + direction.cost * cellSize
          + mainRoadPenalty
          + streetCruiseRoadPenalty
          + forwardPenalty;
        if (tentativeScore >= gScore[nextIndex]) return;
        cameFrom[nextIndex] = currentNode.index;
        gScore[nextIndex] = tentativeScore;
        pushCommercialV2PathHeap(openHeap, {
          index: nextIndex,
          priority: tentativeScore + getHeuristic(nextIndex)
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
    if (startCenter && Math.hypot(
      getCommercialV2LoopDeltaX(fromPoint.x, startCenter.x, stageSize.width),
      startCenter.y - fromPoint.y
    ) > 2) {
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
      return Math.hypot(
        getCommercialV2LoopDeltaX(previous.x, point.x, stageSize.width),
        point.y - previous.y
      ) > 2;
    });
    const finalWaypoints = waypoints.length ? waypoints : [targetCell.center];
    const destination = finalWaypoints[finalWaypoints.length - 1];
    let totalDistance = 0;
    let previous = fromPoint;
    finalWaypoints.forEach((point) => {
      totalDistance += Math.hypot(
        getCommercialV2LoopDeltaX(previous.x, point.x, stageSize.width),
        point.y - previous.y
      );
      previous = point;
    });
    return {
      destination,
      waypoints: finalWaypoints,
      totalDistance
    };
  }, [getStreetCruiseRoadPenalty, isAutoTravelPositionAllowed, isAutoTravelSegmentClear, isMainRoadPoint, mainRoadRects.length, simplifyAutoTravelPath, stageSize.height, stageSize.width, streetCruiseRoadRects.length]);

  const getAutoTravelPropApproachPoint = useCallback((place, currentPlayer) => {
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
      collisionBox.x + collisionBox.w * 0.75
    ];
    const ySamples = [
      anchorY,
      collisionBox.y + collisionBox.h * 0.5,
      collisionBox.y + collisionBox.h * 0.25,
      collisionBox.y + collisionBox.h * 0.75
    ];
    const sideOrderByFacing = {
      front: ['north', 'west', 'east', 'south'],
      back: ['south', 'west', 'east', 'north'],
      left: ['east', 'north', 'south', 'west'],
      right: ['west', 'north', 'south', 'east']
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
        side
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
      const sideRank = sideOrder.includes(candidate.side)
        ? sideOrder.indexOf(candidate.side)
        : sideOrder.length;
      const anchorDistance = Math.hypot(
        getCommercialV2LoopDeltaX(anchorX, candidate.x, stageSize.width),
        candidate.y - anchorY
      );
      const currentDistance = currentPlayer ? Math.hypot(
        getCommercialV2LoopDeltaX(currentPlayer.x, candidate.x, stageSize.width),
        candidate.y - currentPlayer.y
      ) : 0;
      const score = sideRank * 10000 + anchorDistance + currentDistance * 0.05;
      if (!best || score < best.score) {
        best = { ...candidate, score };
      }
    });
    return best ? { x: best.x, y: best.y } : null;
  }, [assetById, isAutoTravelPositionAllowed, items, playerDimensions.footOffset, playerDimensions.width, stageSize.height, stageSize.width]);

  const getAutoTravelTargetPoint = useCallback((place, currentPlayer) => {
    if (!place) return null;
    const approachMinY = getCommercialV2PlaceApproachMinY(place);
    if (place.manualAnchor) {
      if (approachMinY === null) {
        const propApproachPoint = getAutoTravelPropApproachPoint(place, currentPlayer);
        if (propApproachPoint) return propApproachPoint;
      }
      return getNearestWalkablePlayerPoint(place.anchor.x, place.anchor.y, currentPlayer, {
        useAutoTravelBlocks: true,
        fallbackToCurrent: false
      });
    }
    if (approachMinY === null) {
      const propApproachPoint = getAutoTravelPropApproachPoint(place, currentPlayer);
      if (propApproachPoint) return propApproachPoint;
      return getNearestWalkablePlayerPoint(place.anchor.x, place.anchor.y, currentPlayer, {
        useAutoTravelBlocks: true,
        fallbackToCurrent: false
      });
    }
    const desiredX = wrapLoopCoordinate(place.anchor.x, stageSize.width);
    const buildingApproachOffset = place.assetId === 'building_hospital'
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
      approachMinY
    });
    return fallback && fallback.y >= approachMinY ? fallback : null;
  }, [getAutoTravelPropApproachPoint, getNearestWalkablePlayerPoint, isAutoTravelPositionAllowed, playerDimensions.height, stageSize.height, stageSize.width]);

  const cancelAutoTravel = useCallback((message = '') => {
    const travelPlayerId = autoTravelRef.current?.playerId || controlledPlayerIdRef.current;
    autoTravelRef.current = null;
    setAutoTravelActive(false);
    setPlayerActionBubble('');
    setPlayerActionBubbles((current) => {
      if (!current[travelPlayerId]) return current;
      const next = { ...current };
      delete next[travelPlayerId];
      return next;
    });
    if (message) setNotice(message);
  }, []);

  const switchControlledPlayer = useCallback((nextPlayerId) => {
    const character = commercialV2PlayerCharacterById.get(nextPlayerId);
    if (!character || nextPlayerId === controlledPlayerIdRef.current) return;
    pressedKeysRef.current.clear();
    cancelAutoTravel();
    controlledPlayerIdRef.current = nextPlayerId;
    playerRef.current = playersRef.current[nextPlayerId] || createCommercialV2PlayerState(character);
    setControlledPlayerId(nextPlayerId);
    setBehaviorActorId(nextPlayerId);
    setNotice(`现在控制：${character.label}。WASD 会移动当前选中的人物。`);
  }, [cancelAutoTravel]);

  const buildStreetCruiseSegment = useCallback((fromPoint) => {
    if (!fromPoint || stageSize.width <= 0 || stageSize.height <= 0) return null;
    const origin = {
      x: wrapLoopCoordinate(Number.isFinite(fromPoint.x) ? fromPoint.x : commercialV2PlayerInitial.x, stageSize.width),
      y: Number.isFinite(fromPoint.y) ? fromPoint.y : commercialV2PlayerInitial.y
    };
    const minY = 178;
    const maxY = Math.max(minY + 1, stageSize.height - 12);
    const baseY = Math.max(minY, Math.min(maxY, origin.y));
    const isAcceptableCruiseRoute = (route) => {
      if (!route?.waypoints?.length) return false;
      const routeForwardDelta = getCommercialV2LoopDeltaX(origin.x, route.destination.x, stageSize.width);
      if (routeForwardDelta < commercialV2StreetCruiseMinForward) return false;
      const minProgress = route.waypoints.reduce((minimum, point) => (
        Math.min(minimum, getCommercialV2LoopDeltaX(origin.x, point.x, stageSize.width))
      ), routeForwardDelta);
      const maxProgress = route.waypoints.reduce((maximum, point) => (
        Math.max(maximum, getCommercialV2LoopDeltaX(origin.x, point.x, stageSize.width))
      ), routeForwardDelta);
      return minProgress >= -commercialV2ForwardPathBacktrackLimit * 2
        && maxProgress <= routeForwardDelta + commercialV2ForwardPathOvershootTolerance * 2;
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
        const point = index === distances.length - 1
          ? candidate
          : getNearestStreetCruiseRoadTravelPoint(origin.x + distance, preferredY);
        if (!point) return;
        const previous = centerPoints[centerPoints.length - 1] || origin;
        const progress = getCommercialV2LoopDeltaX(origin.x, point.x, stageSize.width);
        const previousProgress = getCommercialV2LoopDeltaX(origin.x, previous.x, stageSize.width);
        const duplicate = Math.hypot(
          getCommercialV2LoopDeltaX(previous.x, point.x, stageSize.width),
          previous.y - point.y
        ) < 8;
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
          preferForward: forwardDelta >= commercialV2StreetCruiseMinForward
        });
        if (!segment?.waypoints?.length) return null;
        segment.waypoints.forEach((waypoint) => {
          const last = waypoints[waypoints.length - 1] || previous;
          const distance = Math.hypot(
            getCommercialV2LoopDeltaX(last.x, waypoint.x, stageSize.width),
            waypoint.y - last.y
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
        totalDistance
      };
    };
    const buildCruiseRoute = (candidate) => {
      const centerRoute = buildStreetCruiseRoadCenterRoute(candidate);
      if (isAcceptableCruiseRoute(centerRoute)) return centerRoute;
      const attempts = [
        { preferStreetCruiseRoad: isStreetCruiseRoadPoint(candidate.x, candidate.y), preferForward: true },
        { preferMainRoad: isMainRoadPoint(candidate.x, candidate.y), preferForward: true },
        { preferMainRoad: false, preferForward: true },
        { preferMainRoad: false, preferForward: false }
      ];
      for (const routeOptions of attempts) {
        const route = buildAutoTravelPath(origin, candidate, routeOptions);
        if (isAcceptableCruiseRoute(route)) return route;
      }
      return null;
    };
    for (const distance of commercialV2StreetCruiseDistances) {
      for (const laneOffset of commercialV2StreetCruiseLaneOffsets) {
        const candidate = getNearestStreetCruiseRoadTravelPoint(origin.x + distance, baseY + laneOffset)
          || getNearestMainRoadTravelPoint(origin.x + distance, baseY + laneOffset)
          || getNearestWalkablePlayerPoint(
            origin.x + distance,
            baseY + laneOffset,
            origin,
            {
              useAutoTravelBlocks: true,
              fallbackToCurrent: false
            }
          );
        if (!candidate) continue;
        const forwardDelta = getCommercialV2LoopDeltaX(origin.x, candidate.x, stageSize.width);
        if (forwardDelta < commercialV2StreetCruiseMinForward) continue;
        const route = buildCruiseRoute(candidate);
        if (!route) continue;
        return {
          ...route,
          anchorPoint: candidate
        };
      }
    }
    return null;
  }, [buildAutoTravelPath, getNearestMainRoadTravelPoint, getNearestStreetCruiseRoadTravelPoint, getNearestWalkablePlayerPoint, isMainRoadPoint, isStreetCruiseRoadPoint, stageSize.height, stageSize.width, streetCruiseRoadRects.length]);

  const resolveStreetCruiseTarget = useCallback((currentPlayer = playerRef.current) => {
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
      action: '闲逛中'
    };
  }, [buildStreetCruiseSegment]);

  const resolveAutoTravelTarget = useCallback((targetId, currentPlayerOverride = null) => {
    const requestedId = String(targetId || '').trim();
    if (!requestedId) return null;
    const currentPlayer = currentPlayerOverride || playerRef.current;
    if (requestedId === 'street') {
      return resolveStreetCruiseTarget(currentPlayer);
    }
    const exactPlaceCandidates = placeLinks.filter((place) => place.placeId === requestedId);
    const exactLocationCandidates = exactPlaceCandidates.length ? [] : placeLinks.filter((place) => place.locationId === requestedId);
    const candidates = exactPlaceCandidates.length
      ? exactPlaceCandidates
      : (exactLocationCandidates.length
        ? exactLocationCandidates
        : placeLinks.filter((place) => place.locationIds.includes(requestedId)));
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
          action: getCommercialV2TravelAction(place, requestedId)
        };
      }
    });
    return best;
  }, [buildAutoTravelPath, getAutoTravelTargetPoint, placeLinks, resolveStreetCruiseTarget]);

  const startAutoTravel = useCallback((targetId = autoTargetId) => {
    const playerId = controlledPlayerIdRef.current;
    const target = resolveAutoTravelTarget(targetId, playerRef.current);
    if (!target) {
      setNotice('这个地点现在没有可用锚点或绕行路线，先检查地点锚点和碰撞箱。');
      return;
    }
    pressedKeysRef.current.clear();
    autoTravelRef.current = {
      ...target,
      playerId,
      pathIndex: 0,
      stuckTime: 0,
      lastX: playerRef.current.x,
      lastY: playerRef.current.y
    };
    setAutoTargetId(target.targetId);
    setAutoTravelActive(true);
    if (target.mode === 'streetCruise') {
      setPlayerActionBubble(`逛 ${target.label}`);
      setNotice(`沿 ${target.label} 往前走，已规划 ${target.path.length} 个绕行点。`);
      return;
    }
    setPlayerActionBubble(`去 ${target.label}`);
    setNotice(`自动前往 ${target.label}，已规划 ${target.path.length} 个绕行点。`);
  }, [autoTargetId, resolveAutoTravelTarget]);

  function getBehaviorStepPlaceId(step) {
    return String(step?.place_id || step?.to_place_id || step?.target_place_id || step?.placeId || step?.toPlaceId || '').trim();
  }

  function buildBehaviorSmoothTravelPath(fromPoint, toPoint) {
    if (!fromPoint || !toPoint) return [];
    const targetPoint = {
      x: wrapLoopCoordinate(Number.isFinite(toPoint.x) ? toPoint.x : fromPoint.x, stageSize.width),
      y: Number.isFinite(toPoint.y) ? toPoint.y : fromPoint.y
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
      y: laneY
    };
    return [
      midPoint,
      { x: targetPoint.x, y: laneY },
      targetPoint
    ];
  }

  function activateBehaviorBranch(branch, source = 'ai') {
    if (!branch || !Array.isArray(branch.steps) || !branch.steps.length) return;
    const now = Date.now();
    if (autoTravelRef.current?.behaviorRuntimeId) {
      autoTravelRef.current = null;
      setAutoTravelActive(false);
    }
    const ttl = Math.max(3000, Math.min(Number(branch.ttl_ms || branch.ttlMs) || 45000, 120000));
    const runtime = {
      id: `${branch.branch_id || branch.id || 'branch'}_${now}`,
      source,
      branch,
      stepIndex: 0,
      waitingUntil: 0,
      waitingForTravelId: '',
      expiresAt: now + ttl,
      startedAt: now
    };
    behaviorRuntimeRef.current = runtime;
    const isBaseBranch = source === 'base' || branch.branch_kind === 'base';
    if (!isBaseBranch) keepBehaviorInteractionSessionActive();
    const branchKindLabel = isBaseBranch ? '日常行为' : '互动回应';
    const activeNodeId = branch.branch_id || branch.id || runtime.id;
    setBehaviorTreeState((currentTree) => ({
      ...currentTree,
      active_node_id: activeNodeId,
      memory: {
        ...(currentTree.memory || {}),
        last_active_node_id: activeNodeId,
        last_active_source: source
      }
    }));
    setActiveBehaviorBranch({
      branch_id: activeNodeId,
      title: branch.title || branchKindLabel,
      summary: branch.summary || '',
      branchKindLabel,
      source,
      stepIndex: 0,
      totalSteps: branch.steps.length,
      expiresAt: runtime.expiresAt
    });
    setActiveBehaviorDialog(null);
    setInteractionMenuOpen(false);
    setWorldPlayerBubble(getCurrentBehaviorActorId(), branch.title || branchKindLabel);
    setNotice(`${branchKindLabel}开始执行：${branch.title || branch.branch_id || '未命名'}。`);
  }

  function clearBehaviorRuntime(message = '') {
    behaviorRuntimeRef.current = null;
    if (autoTravelRef.current?.behaviorRuntimeId) {
      autoTravelRef.current = null;
      setAutoTravelActive(false);
    }
    setActiveBehaviorBranch(null);
    setActiveBehaviorDialog((current) => current?.type === 'pending' ? current : null);
    setWorldPlayerBubble(getCurrentBehaviorActorId(), '');
    if (message) setNotice(message);
  }

  function activateBehaviorTravelFailureBranch(details = {}) {
    const tree = behaviorTreeStateRef.current || behaviorTreeState || createCommercialV2BehaviorTreeState();
    const recoveryBranch = pickCommercialBehaviorBaseBranchByTrigger(
      tree,
      commercialV2BehaviorTravelFailureTrigger,
      behaviorOrderedPlaces.map((place) => place.placeId),
      activeBehaviorCharacterId
    );
    if (!recoveryBranch) return false;
    setBehaviorTreeState((currentTree) => ({
      ...currentTree,
      memory: {
        ...(currentTree.memory || {}),
        last_travel_failure: {
          reason: String(details.reason || 'travel_failed').slice(0, 80),
          action: String(details.action || '').slice(0, 80),
          target_label: String(details.targetLabel || details.label || '').slice(0, 80),
          at: Date.now()
        }
      }
    }));
    setPlayerById(getCurrentBehaviorActorId(), (current) => ({
      ...current,
      moving: false,
      frame: 0,
      stepTime: 0
    }));
    activateBehaviorBranch(recoveryBranch, 'base');
    setBehaviorStatus(`循迹失败，已触发基础恢复枝丫：${recoveryBranch.title}`);
    return true;
  }

  function startBehaviorTravelStep(runtime, step) {
    const action = String(step?.action || '');
    let targetId = getBehaviorStepPlaceId(step);
    const behaviorActor = getCurrentBehaviorActorId();
    const behaviorUser = getCurrentBehaviorUserActorId(behaviorActor);
    if ((action === 'approach_player' || action === 'follow_player') && !targetId) {
      const roleCharacter = commercialV2PlayerCharacterById.get(behaviorActor) || commercialV2PlayerCharacters[0];
      const userCharacter = commercialV2PlayerCharacterById.get(behaviorUser) || commercialV2PlayerCharacters[0];
      const role = playersRef.current[behaviorActor] || createCommercialV2PlayerState(roleCharacter);
      const user = playersRef.current[behaviorUser] || createCommercialV2PlayerState(userCharacter);
      const dx = getCommercialV2LoopDeltaX(role.x, user.x, stageSize.width);
      const targetPoint = getNearestWalkablePlayerPoint(user.x - Math.sign(dx || 1) * commercialV2PlayerApproachGap, user.y, role, {
        useAutoTravelBlocks: true,
        fallbackToCurrent: false
      });
      const route = targetPoint ? buildAutoTravelPath(role, targetPoint) : null;
      const smoothPath = buildBehaviorSmoothTravelPath(role, targetPoint);
      if (!smoothPath.length && !route?.waypoints?.length) return false;
      const travelId = `${runtime.id}_step_${runtime.stepIndex}`;
      autoTravelRef.current = {
        targetId: 'player',
        playerId: behaviorActor,
        behaviorRuntimeId: runtime.id,
        behaviorTravelId: travelId,
        place: { facing: dx > 0 ? 'right' : 'left' },
        point: smoothPath[smoothPath.length - 1] || route.destination,
        anchorPoint: targetPoint,
        path: smoothPath.length ? smoothPath : route.waypoints,
        semanticSlide: true,
        pathIndex: 0,
        stuckTime: 0,
        lastX: role.x,
        lastY: role.y,
        label: '玩家',
        action: action === 'follow_player' ? '跟随玩家' : '靠近玩家'
      };
      runtime.waitingForTravelId = travelId;
      setAutoTravelActive(true);
      setWorldPlayerBubble(behaviorActor, action === 'follow_player' ? '跟上你' : '靠近你');
      return true;
    }
    if (!targetId) return false;
    const roleCharacter = commercialV2PlayerCharacterById.get(behaviorActor) || commercialV2PlayerCharacters[0];
    const role = playersRef.current[behaviorActor] || createCommercialV2PlayerState(roleCharacter);
    const target = resolveAutoTravelTarget(targetId, role);
    if (!target) return false;
    const travelId = `${runtime.id}_step_${runtime.stepIndex}`;
    const targetPoint = target.anchorPoint || target.point;
    const smoothPath = buildBehaviorSmoothTravelPath(role, targetPoint);
    autoTravelRef.current = {
      ...target,
      playerId: behaviorActor,
      behaviorRuntimeId: runtime.id,
      behaviorTravelId: travelId,
      point: smoothPath[smoothPath.length - 1] || target.point,
      path: smoothPath.length ? smoothPath : target.path,
      semanticSlide: true,
      pathIndex: 0,
      stuckTime: 0,
      lastX: role.x,
      lastY: role.y,
      action: step?.movement_style || target.action || '行动中'
    };
    runtime.waitingForTravelId = travelId;
    setAutoTravelActive(true);
    setWorldPlayerBubble(behaviorActor, target.label ? `去 ${target.label}` : '行动中');
    return true;
  }

  function advanceBehaviorRuntime() {
    const runtime = behaviorRuntimeRef.current;
    if (!runtime?.branch) return;
    const now = Date.now();
    if ((runtime.waitingForDialog || runtime.waitingForChoice) && now > runtime.expiresAt - 10000) {
      runtime.expiresAt = now + 60000;
    }
    if (now > runtime.expiresAt) {
      const label = runtime.source === 'base' || runtime.branch.branch_kind === 'base' ? '日常行为' : '互动回应';
      clearBehaviorRuntime(`${label}已过期：${runtime.branch.title || runtime.branch.branch_id || '未命名'}。`);
      return;
    }
    if (runtime.waitingForDialog || runtime.waitingForChoice) return;
    if (runtime.waitingUntil && now < runtime.waitingUntil) return;
    if (runtime.waitingForTravelId) {
      if (autoTravelRef.current?.behaviorTravelId === runtime.waitingForTravelId) return;
      runtime.waitingForTravelId = '';
      runtime.stepIndex += 1;
    }
    const steps = runtime.branch.steps || [];
    if (runtime.stepIndex >= steps.length) {
      const label = runtime.source === 'base' || runtime.branch.branch_kind === 'base' ? '日常行为' : '互动回应';
      clearBehaviorRuntime(`${label}执行完毕：${runtime.branch.title || runtime.branch.branch_id || '未命名'}。`);
      return;
    }
    const step = steps[runtime.stepIndex] || {};
    const action = String(step.action || '').trim();
    setActiveBehaviorBranch((current) => current ? {
      ...current,
      stepIndex: runtime.stepIndex,
      totalSteps: steps.length,
      currentAction: action
    } : current);
    if (action === 'say' || action === 'emote') {
      const isBaseBranch = runtime.source === 'base' || runtime.branch.branch_kind === 'base';
      if (isBaseBranch) {
        const text = String(step.text || (action === 'say' ? '……' : '停顿了一下')).trim();
        setWorldPlayerBubble(getCurrentBehaviorActorId(), text);
        setBehaviorStatus(action === 'say' ? `日常行为气泡：${text}` : `日常行为动作：${text}`);
        const requestedDuration = Number(step.duration_ms || step.durationMs);
        const readableDuration = Math.min(5200, 1600 + text.length * 85);
        runtime.waitingUntil = now + Math.max(1200, Math.min(Number.isFinite(requestedDuration) ? requestedDuration : readableDuration, 5200));
        runtime.stepIndex += 1;
        return;
      }
      keepBehaviorInteractionSessionActive();
      runtime.waitingForDialog = true;
      runtime.waitingUntil = 0;
      setWorldPlayerBubble(getCurrentBehaviorActorId(), '');
      setInteractionMenuOpen(false);
      setActiveBehaviorDialog({
        runtimeId: runtime.id,
        type: action,
        title: action === 'say' ? (behaviorCharacter?.name || '角色') : '动作',
        text: String(step.text || (action === 'say' ? '……' : '停顿了一下')).trim(),
        stepIndex: runtime.stepIndex,
        totalSteps: steps.length
      });
      setBehaviorStatus(action === 'say' ? '行为树等待：点击“下一句”继续角色台词。' : '行为树等待：点击“下一句”继续角色动作。');
      return;
    }
    if (action === 'wait') {
      const isBaseBranch = runtime.source === 'base' || runtime.branch.branch_kind === 'base';
      runtime.waitingUntil = isBaseBranch
        ? now + Math.max(220, Math.min(Number(step.duration_ms || step.durationMs) || commercialV2BehaviorBaseWaitMs, commercialV2BehaviorBaseWaitMs))
        : now + Math.max(300, Math.min(Number(step.duration_ms || step.durationMs) || 900, 6000));
      runtime.stepIndex += 1;
      return;
    }
    if (action === 'face_player') {
      const behaviorActor = getCurrentBehaviorActorId();
      const behaviorUser = getCurrentBehaviorUserActorId(behaviorActor);
      const roleCharacter = commercialV2PlayerCharacterById.get(behaviorActor) || commercialV2PlayerCharacters[0];
      const userCharacter = commercialV2PlayerCharacterById.get(behaviorUser) || commercialV2PlayerCharacters[0];
      const role = playersRef.current[behaviorActor] || createCommercialV2PlayerState(roleCharacter);
      const user = playersRef.current[behaviorUser] || createCommercialV2PlayerState(userCharacter);
      const dx = getCommercialV2LoopDeltaX(role.x, user.x, stageSize.width);
      const dy = user.y - role.y;
      const direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'front' : 'back');
      setPlayerById(behaviorActor, (current) => ({
        ...current,
        direction,
        moving: false,
        frame: 0
      }));
      runtime.waitingUntil = now + 350;
      runtime.stepIndex += 1;
      return;
    }
    if (
      action === 'go_to_place'
      || action === 'walk_with_player'
      || action === 'idle_at_place'
      || action === 'browse_near'
      || action === 'loop_in_front_of'
      || action === 'wander_between'
      || action === 'patrol_segment'
      || action === 'approach_player'
      || action === 'follow_player'
    ) {
      const moved = startBehaviorTravelStep(runtime, step);
      if (!moved) {
        if (activateBehaviorTravelFailureBranch({
          reason: 'travel_start_failed',
          action,
          targetLabel: getBehaviorStepPlaceId(step) || step.movement_style || action
        })) return;
        setWorldPlayerBubble(getCurrentBehaviorActorId(), step.movement_style || action);
        const isBaseBranch = runtime.source === 'base' || runtime.branch.branch_kind === 'base';
        runtime.waitingUntil = now + (isBaseBranch ? commercialV2BehaviorBaseFallbackMs : 1200);
        runtime.stepIndex += 1;
      }
      return;
    }
    if (action === 'offer_choices') {
      const choices = normalizeBehaviorDialogChoices(step.choices);
      keepBehaviorInteractionSessionActive();
      runtime.waitingForChoice = true;
      runtime.waitingUntil = 0;
      setWorldPlayerBubble(getCurrentBehaviorActorId(), '');
      setInteractionMenuOpen(false);
      setActiveBehaviorDialog({
        runtimeId: runtime.id,
        type: 'choice',
        title: behaviorCharacter?.name || '角色',
        text: String(step.text || '你要怎么回应？').trim(),
        choices,
        stepIndex: runtime.stepIndex,
        totalSteps: steps.length
      });
      setBehaviorStatus('行为树等待：请选择玩家回应。');
      return;
    }
    runtime.stepIndex += 1;
  }

  pickAutonomousBehaviorBranchRef.current = pickAutonomousBehaviorBranch;
  activateBehaviorBranchRef.current = activateBehaviorBranch;
  advanceBehaviorRuntimeRef.current = advanceBehaviorRuntime;

  useEffect(() => {
    if (playerSpawnedRef.current) return;
    spawnPlayersOnStage(playersRef.current);
  }, [spawnPlayersOnStage]);

  const resolvePlayerGroundMove = useCallback((current, nextX, nextY, options = {}) => {
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
    return getNearestWalkablePlayerPoint(wrappedNextX, nextY, current, { useAutoTravelBlocks, ...pointOptions });
  }, [getNearestWalkablePlayerPoint, isAutoTravelPositionAllowed, isPlayerPositionAllowed, stageSize.width]);

  const centerPlayerInView = useCallback((instant = true) => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const panelWidth = stageSize.width * zoom;
    const currentViewportCenter = wrap.scrollLeft + wrap.clientWidth / 2;
    const playerCenterOptions = [
      player.x * zoom,
      panelWidth + player.x * zoom,
      panelWidth * 2 + player.x * zoom
    ];
    const playerCenterX = playerCenterOptions.reduce((closest, option) => (
      Math.abs(option - currentViewportCenter) < Math.abs(closest - currentViewportCenter) ? option : closest
    ));
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
  }, [player.x, player.y, playerDimensions.height, playerDimensions.footOffset, stageSize.width, zoom]);

  useEffect(() => {
    setPlayers((currentPlayers) => {
      let changed = false;
      const nextPlayers = {};
      commercialV2PlayerCharacters.forEach((character) => {
        const current = currentPlayers[character.id] || createCommercialV2PlayerState(character);
        if (isPlayerPositionAllowed(current.x, current.y)) {
          nextPlayers[character.id] = current;
          return;
        }
        const groundedPoint = getNearestWalkablePlayerPoint(current.x, current.y, current);
        nextPlayers[character.id] = {
          ...current,
          ...groundedPoint,
          moving: false,
          frame: 0,
          stepTime: 0
        };
        changed = true;
      });
      return changed ? nextPlayers : currentPlayers;
    });
  }, [getNearestWalkablePlayerPoint, isPlayerPositionAllowed]);

  useEffect(() => {
    const pressedKeys = pressedKeysRef.current;
    const isTypingTarget = (target) => {
      const tagName = target?.tagName?.toLowerCase();
      return target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    };
    const getKeyVector = (key) => {
      if (key === 'a' || key === 'arrowleft') return { dx: -1, dy: 0 };
      if (key === 'd' || key === 'arrowright') return { dx: 1, dy: 0 };
      if (key === 'w' || key === 'arrowup') return { dx: 0, dy: -1 };
      if (key === 's' || key === 'arrowdown') return { dx: 0, dy: 1 };
      return null;
    };
    const getDirection = (dx, dy) => (
      Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'front' : 'back')
    );
    const nudgePlayer = (dx, dy) => {
      const direction = getDirection(dx, dy);
      setPlayer((current) => ({
        ...current,
        ...resolvePlayerGroundMove(current, current.x + dx * 12, current.y + dy * 12),
        direction,
        moving: true,
        frame: 1,
        stepTime: current.stepTime + 0.14
      }));
    };
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (!commercialV2MovementKeys.has(key) || isTypingTarget(event.target)) return;
      if (!autoTravelRef.current?.playerId || autoTravelRef.current.playerId === controlledPlayerIdRef.current) {
        cancelAutoTravel('已切回手动控制。');
      }
      const wasPressed = pressedKeys.has(key);
      pressedKeys.add(key);
      const vector = getKeyVector(key);
      if (!wasPressed && vector) nudgePlayer(vector.dx, vector.dy);
      event.preventDefault();
    };
    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (!commercialV2MovementKeys.has(key)) return;
      pressedKeys.delete(key);
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      pressedKeys.clear();
    };
  }, [cancelAutoTravel, resolvePlayerGroundMove, setPlayer]);

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();
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
      const waypointReach = travel.behaviorRuntimeId ? Math.max(5, commercialV2PathWaypointReach * 0.65) : commercialV2PathWaypointReach;
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
          stepTime: 0
        }));
        return;
      }
      const normalizedX = targetDx / distance;
      const normalizedY = targetDy / distance;
      const direction = Math.abs(normalizedX) > Math.abs(normalizedY)
        ? (normalizedX > 0 ? 'right' : 'left')
        : (normalizedY > 0 ? 'front' : 'back');
      const travelSpeed = travel.behaviorRuntimeId ? commercialV2BehaviorPlayerSpeed : commercialV2PlayerSpeed;
      const frameRate = travel.behaviorRuntimeId ? 6 : 8;
      const stepDistance = Math.min(travelSpeed * delta, distance);
      const rawNextPoint = {
        x: wrapLoopCoordinate(currentPlayer.x + normalizedX * stepDistance, stageSize.width),
        y: currentPlayer.y + normalizedY * stepDistance
      };
      const groundedPoint = travel.semanticSlide
        ? rawNextPoint
        : resolvePlayerGroundMove(
          currentPlayer,
          rawNextPoint.x,
          rawNextPoint.y,
          { useAutoTravelBlocks: true }
        );
      const stepTime = currentPlayer.stepTime + delta;
      setPlayerById(travelPlayerId, {
        x: groundedPoint.x,
        y: groundedPoint.y,
        direction,
        moving: true,
        stepTime,
        frame: Math.floor(stepTime * frameRate) % commercialV2PlayerFrameOrder.length
      });
    };
    const tick = (time) => {
      const delta = Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;
      advanceBehaviorRuntimeRef.current();
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
          const travelCharacter = commercialV2PlayerCharacterById.get(travelPlayerId) || commercialV2PlayerCharacters[0];
          const currentPlayer = playersRef.current[travelPlayerId] || createCommercialV2PlayerState(travelCharacter);
          const path = travel.path?.length ? travel.path : [travel.point];
          let waypointIndex = Math.min(travel.pathIndex || 0, path.length - 1);
          let waypoint = path[waypointIndex] || travel.point;
          let targetDx = getCommercialV2LoopDeltaX(currentPlayer.x, waypoint.x, stageSize.width);
          let targetDy = waypoint.y - currentPlayer.y;
          let distance = Math.hypot(targetDx, targetDy);
          const waypointReach = travel.behaviorRuntimeId ? Math.max(5, commercialV2PathWaypointReach * 0.65) : commercialV2PathWaypointReach;
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
                y: waypoint.y
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
                  lastY: arrivedPoint.y
                };
                setWorldPlayerBubble(travelPlayerId, `逛 ${travel.label}`);
                setPlayerById(travelPlayerId, (current) => ({
                  ...current,
                  ...arrivedPoint,
                  direction: 'right',
                  moving: true
                }));
                frameId = requestAnimationFrame(tick);
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
                stepTime: 0
              }));
              frameId = requestAnimationFrame(tick);
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
              stepTime: 0
            }));
            frameId = requestAnimationFrame(tick);
            return;
          }
          const normalizedX = targetDx / distance;
          const normalizedY = targetDy / distance;
          const direction = Math.abs(normalizedX) > Math.abs(normalizedY)
            ? (normalizedX > 0 ? 'right' : 'left')
            : (normalizedY > 0 ? 'front' : 'back');
          const travelDelta = delta;
          const travelSpeed = travel.behaviorRuntimeId ? commercialV2BehaviorPlayerSpeed : commercialV2PlayerSpeed;
          const frameRate = travel.behaviorRuntimeId ? 6 : 8;
          const stepDistance = Math.min(travelSpeed * travelDelta, distance);
          const rawNextPoint = {
            x: wrapLoopCoordinate(currentPlayer.x + normalizedX * stepDistance, stageSize.width),
            y: currentPlayer.y + normalizedY * stepDistance
          };
          const groundedPoint = travel.semanticSlide
            ? rawNextPoint
            : resolvePlayerGroundMove(
              currentPlayer,
              rawNextPoint.x,
              rawNextPoint.y,
              { useAutoTravelBlocks: true }
            );
          const movedDistance = Math.hypot(
            getCommercialV2LoopDeltaX(currentPlayer.x, groundedPoint.x, stageSize.width),
            currentPlayer.y - groundedPoint.y
          );
          const nextDistance = Math.hypot(
            getCommercialV2LoopDeltaX(groundedPoint.x, waypoint.x, stageSize.width),
            waypoint.y - groundedPoint.y
          );
          travel.stuckTime = !travel.semanticSlide && movedDistance < 0.25 && nextDistance > 10
            ? (travel.stuckTime || 0) + delta
            : 0;
          if (!travel.semanticSlide && travel.stuckTime > 1.2) {
            const reroute = (travel.replanCount || 0) < 2
              ? (travel.mode === 'streetCruise'
                ? buildStreetCruiseSegment(groundedPoint)
                : buildAutoTravelPath(groundedPoint, travel.anchorPoint || travel.point))
              : null;
            if (reroute?.waypoints?.length) {
              travel.path = reroute.waypoints;
              travel.point = reroute.destination;
              if (reroute.anchorPoint) travel.anchorPoint = reroute.anchorPoint;
              travel.pathIndex = 0;
              travel.stuckTime = 0;
              travel.replanCount = (travel.replanCount || 0) + 1;
              setNotice(travel.mode === 'streetCruise'
                ? `${travel.label} 前方被挡住了，正在换一条路继续往前走。`
                : `去 ${travel.label} 的路被挡住了，正在重新绕路。`);
              frameId = requestAnimationFrame(tick);
              return;
            }
            autoTravelRef.current = null;
            setAutoTravelActive(false);
            if (travel.behaviorRuntimeId && activateBehaviorTravelFailureBranch({
              reason: 'travel_blocked',
              action: travel.action,
              targetLabel: travel.label
            })) {
              frameId = requestAnimationFrame(tick);
              return;
            }
            setWorldPlayerBubble(travelPlayerId, '');
            setNotice(travel.mode === 'streetCruise'
              ? `${travel.label} 前方被碰撞挡住了，先停在附近。`
              : `去 ${travel.label} 的路被碰撞挡住了，先停在附近。`);
            setPlayerById(travelPlayerId, (current) => ({
              ...current,
              moving: false,
              frame: 0,
              stepTime: 0
            }));
            frameId = requestAnimationFrame(tick);
            return;
          }
          const stepTime = currentPlayer.stepTime + travelDelta;
          setPlayerById(travelPlayerId, {
            x: groundedPoint.x,
            y: groundedPoint.y,
            direction,
            moving: true,
            stepTime,
            frame: Math.floor(stepTime * frameRate) % commercialV2PlayerFrameOrder.length
          });
          frameId = requestAnimationFrame(tick);
          return;
        }
        if (playerRef.current.moving || playerRef.current.frame !== 0) {
          setPlayer((current) => ({ ...current, moving: false, frame: 0, stepTime: 0 }));
        }
        frameId = requestAnimationFrame(tick);
        return;
      }

      const length = Math.hypot(dx, dy) || 1;
      const normalizedX = dx / length;
      const normalizedY = dy / length;
      const direction = Math.abs(normalizedX) > Math.abs(normalizedY)
        ? (normalizedX > 0 ? 'right' : 'left')
        : (normalizedY > 0 ? 'front' : 'back');

      setPlayer((current) => {
        const stepTime = current.stepTime + delta;
        const groundedPoint = resolvePlayerGroundMove(
          current,
          current.x + normalizedX * commercialV2PlayerSpeed * delta,
          current.y + normalizedY * commercialV2PlayerSpeed * delta
        );
        return {
          x: groundedPoint.x,
          y: groundedPoint.y,
          direction,
          moving: true,
          stepTime,
          frame: Math.floor(stepTime * 8) % commercialV2PlayerFrameOrder.length
        };
      });
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [buildAutoTravelPath, buildStreetCruiseSegment, resolvePlayerGroundMove, setPlayer, setPlayerById, stageSize.width]);

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

  function updateItem(id, patch, options = {}) {
    if (!canEditLayout) return;
    commitItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      return options.wrapX ? wrapLoopBox(next, stageSize) : clampBox(next, stageSize);
    }));
  }

  function updateSelectedGroundLayer(enabled) {
    if (!selectedItem || !selectedAsset || selectedIsBuiltInGroundLayer) return;
    updateItem(selectedItem.id, { groundLayer: enabled ? true : undefined });
    setNotice(enabled
      ? `${selectedAsset.name} 已切到地面层：会恒在人物下方，碰撞箱不再阻挡人物。`
      : `${selectedAsset.name} 已切回普通素材：按图层和遮挡判断显示。`);
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
      collision: getCommercialV2DefaultCollision(asset).enabled ? getCommercialV2DefaultCollision(asset) : undefined
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
      latestStageSize
    };
  }

  function saveLayout() {
    try {
      const { latestItems, latestSegmentCount, latestStageSize } = getLatestLayoutParts();
      const itemsToSave = latestItems
        .slice(0, commercialV2MaxSavedItems)
        .map((item) => serializeCommercialV2Item(item, assetById.get(item.assetId)));
      localStorage.setItem(commercialV2StorageKey, JSON.stringify(itemsToSave));
      localStorage.setItem(commercialV2CanvasStorageKey, JSON.stringify({
        segmentCount: latestSegmentCount,
        segment: { width: commercialV2SegmentSize.width, height: latestStageSize.height },
        backgroundColor: commercialV2BackgroundColor,
        loop: getCommercialV2Loop(latestStageSize)
      }));
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
        items: backupItems
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
        .map((item) => serializeCommercialV2Item(item, assetById.get(item.assetId)))
    };
  }

  function saveCurrentAsDefaultScene() {
    try {
      const snapshot = buildLayoutSnapshot();
      localStorage.setItem(commercialV2DefaultSnapshotStorageKey, JSON.stringify(snapshot));
      localStorage.setItem(commercialV2StorageKey, JSON.stringify(snapshot.items));
      localStorage.setItem(commercialV2CanvasStorageKey, JSON.stringify({
        segmentCount,
        segment: { width: commercialV2SegmentSize.width, height: stageSize.height },
        backgroundColor: commercialV2BackgroundColor,
        loop: getCommercialV2Loop(stageSize)
      }));
      setNotice(`已把当前 ${snapshot.items.length} 个素材保存为默认场景；以后“恢复默认”和重新进入都会使用这个快照。`);
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
      localStorage.setItem(commercialV2CanvasStorageKey, JSON.stringify({
        segmentCount: normalized.segmentCount,
        segment: { width: commercialV2SegmentSize.width, height: nextStageSize.height },
        backgroundColor: commercialV2BackgroundColor,
        loop: getCommercialV2Loop(nextStageSize)
      }));
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
      applyLayoutSnapshot({
        items: recoveredItems,
        segmentCount: recoveredCanvas?.segmentCount || getRequiredSegmentCount(recoveredItems),
        selectedId: recoveredItems[0]?.id || ''
      }, `已从恢复文件找回 ${recoveredItems.length} 个素材。`);
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
    setNotice(defaultLayout.savedAt
      ? '已恢复为你保存的默认场景；误点的话可以点“恢复上次布局”。'
      : '已恢复为内置默认素材摆放；误点的话可以点“恢复上次布局”。');
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
    commitItems((prev) => prev.map((item) => clampBox({
      ...item,
      x: item.x + dx,
      y: item.y + dy
    }, stageSize)));
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
      const nextIndex = direction === 'up'
        ? Math.min(prev.length - 1, index + 1)
        : Math.max(0, index - 1);
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
      h: nextH
    });
  }

  function scaleGroup(multiplier) {
    if (!canEditLayout) return;
    if (!layoutBounds) return;
    const originX = (layoutBounds.minX + layoutBounds.maxX) / 2;
    const originY = layoutBounds.maxY;
    commitItems((prev) => prev.map((item) => clampBox({
      ...item,
      x: originX + (item.x - originX) * multiplier,
      y: originY + (item.y - originY) * multiplier,
      w: item.w * multiplier,
      h: item.h * multiplier
    }, stageSize)));
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
        enabled
      }
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
      [key]: pixelValue
    };
    updateItem(selectedItem.id, {
      collision: normalizeCommercialV2Collision({
        enabled: selectedCollision?.enabled ?? true,
        x: nextLocalBox.x / selectedItem.w,
        y: nextLocalBox.y / selectedItem.h,
        w: nextLocalBox.w / selectedItem.w,
        h: nextLocalBox.h / selectedItem.h
      }, selectedAsset)
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
      h: Math.max(2, Number.isFinite(localBox.h) ? localBox.h : 2)
    };
    updateItem(item.id, {
      collision: normalizeCommercialV2Collision({
        enabled: true,
        x: safeLocalBox.x / item.w,
        y: safeLocalBox.y / item.h,
        w: safeLocalBox.w / item.w,
        h: safeLocalBox.h / item.h
      }, asset)
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
      collision: getCommercialV2DefaultCollision(selectedAsset)
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
      collision: normalizeCommercialV2Collision({ enabled: true, x: 0, y: 0, w: 1, h: 1 }, selectedAsset)
    });
  }

  function updatePlaceAnchorFromLocalPoint(item, localPoint) {
    if (!item?.w || !item?.h) return;
    const safeLocalPoint = {
      x: Number.isFinite(localPoint.x) ? localPoint.x : 0,
      y: Number.isFinite(localPoint.y) ? localPoint.y : 0
    };
    updateItem(item.id, {
      placeAnchor: normalizeCommercialV2PlaceAnchor({
        x: safeLocalPoint.x / item.w,
        y: safeLocalPoint.y / item.h
      })
    });
  }

  function updateSelectedPlaceAnchorLocalPoint(key, value) {
    if (!canEditLayout) return;
    if (!selectedItem || !selectedPlaceAnchorLocalPoint) return;
    setShowPlaceAnchors(true);
    const pixelValue = Math.round(Number(value) || 0);
    updatePlaceAnchorFromLocalPoint(selectedItem, {
      ...selectedPlaceAnchorLocalPoint,
      [key]: pixelValue
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
      h: collision.h * item.h
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
      startLocalBox
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
        y: place.anchor.y - item.y
      }
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
      startItems: items
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
        h: nextH
      });
      return;
    }
    if (drag.mode === 'place-anchor') {
      const deltaX = point.x - drag.startPoint.x;
      const deltaY = point.y - drag.startPoint.y;
      updatePlaceAnchorFromLocalPoint(drag.startItem, {
        x: drag.startLocalPoint.x + deltaX,
        y: drag.startLocalPoint.y + deltaY
      });
      return;
    }
    if (drag.mode === 'group') {
      const deltaX = point.x - drag.startPoint.x;
      const deltaY = point.y - drag.startPoint.y;
      commitItems(drag.startItems.map((item) => clampBox({
        ...item,
        x: item.x + deltaX,
        y: item.y + deltaY
      }, stageSize)));
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
      x: item.x + commercialV2SegmentSize.width
    }));
    const nextStageSize = getCommercialV2StageSize(nextSegmentCount, shiftedItems);
    commitSegmentCount(nextSegmentCount);
    commitItems(shiftedItems.map((item) => clampBox(item, nextStageSize)));
    setNotice(`已在左边追加 ${commercialV2SegmentSize.width}px 纯色背景，当前 ${nextSegmentCount} 段。`);
    pendingLoopScrollRef.current = 'leftEdge';
  }

  function onLoopScroll(event) {
    if (loopScrollGuardRef.current) return;
    const wrap = event.currentTarget;
    const panelWidth = stageSize.width * zoom;
    if (!panelWidth) return;
    const leftWrapPoint = Math.max(0, panelWidth - wrap.clientWidth);
    const rightWrapPoint = panelWidth * 2;
    if (wrap.scrollLeft <= leftWrapPoint) {
      loopScrollGuardRef.current = true;
      wrap.scrollLeft += panelWidth;
      requestAnimationFrame(() => {
        loopScrollGuardRef.current = false;
      });
      return;
    }
    if (wrap.scrollLeft >= rightWrapPoint) {
      loopScrollGuardRef.current = true;
      wrap.scrollLeft -= panelWidth;
      requestAnimationFrame(() => {
        loopScrollGuardRef.current = false;
      });
    }
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

  function renderEditorPanel(panelKey, interactive = false) {
    function getLoopOffsets(item, asset) {
      const offsets = [0];
      if (isCommercialV2SkyStripAsset(asset) && item.w > 0) {
        const minCopy = Math.floor((-item.x - item.w) / item.w);
        const maxCopy = Math.ceil((stageSize.width - item.x) / item.w);
        for (let copy = minCopy; copy <= maxCopy; copy += 1) {
          const offset = copy * item.w;
          const left = item.x + offset;
          const right = left + item.w;
          if (right > 0 && left < stageSize.width) offsets.push(offset);
        }
        return [...new Set(offsets)];
      }
      if (item.x <= commercialV2LoopSeamMargin) offsets.push(stageSize.width);
      if (item.x + item.w >= stageSize.width - commercialV2LoopSeamMargin) offsets.push(-stageSize.width);
      return offsets;
    }

    function getItemStyle(item, offset = 0, zIndex = 1) {
      const style = {
        left: `${((item.x + offset) / stageSize.width) * 100}%`,
        top: `${(item.y / stageSize.height) * 100}%`,
        width: `${(item.w / stageSize.width) * 100}%`,
        height: `${(item.h / stageSize.height) * 100}%`,
        zIndex
      };
      return style;
    }

    function getItemZIndex(layerIndex, item, asset, playerZIndex = null) {
      const zIndex = getCommercialV2ItemRenderZIndex(layerIndex, item, asset);
      if (asset && isCommercialV2GroundLayerItem(item, asset) && Number.isFinite(playerZIndex)) {
        return Math.min(zIndex, playerZIndex - 1);
      }
      return zIndex;
    }

    function getPlayerOcclusionProbeForOffset(targetPlayer, offset = 0) {
      const visualX = targetPlayer.x + offset;
      const probeWidth = Math.max(28, playerDimensions.width * 0.44);
      const probeHeight = Math.max(34, playerDimensions.height * 0.36);
      return {
        x: visualX - probeWidth / 2,
        y: targetPlayer.y - probeHeight,
        w: probeWidth,
        h: probeHeight + playerDimensions.footOffset
      };
    }

    function getPlayerOccludingLayerIndex(targetPlayer) {
      let occludingLayerIndex = null;
      const playerBoxes = getPlayerLoopOffsets(targetPlayer).map((offset) => ({
        probe: getPlayerOcclusionProbeForOffset(targetPlayer, offset)
      }));
      items.forEach((item, layerIndex) => {
        const asset = assetById.get(item.assetId);
        if (!isCommercialV2DynamicOcclusionItem(item, asset)) return;
        const silhouette = assetSilhouettes[item.assetId];
        getLoopOffsets(item, asset).forEach((itemOffset) => {
          playerBoxes.forEach(({ probe }) => {
            const shouldOcclude = getCommercialV2OcclusionDecision(
              item,
              asset,
              silhouette,
              probe,
              targetPlayer.y,
              itemOffset
            ) === 'front';
            if (!shouldOcclude) return;
            occludingLayerIndex = occludingLayerIndex === null
              ? layerIndex
              : Math.min(occludingLayerIndex, layerIndex);
          });
        });
      });
      return occludingLayerIndex;
    }

    function getPlayerDepthTie(targetPlayer) {
      const sortedPlayers = commercialV2PlayerCharacters
        .map((character) => players[character.id] || createCommercialV2PlayerState(character))
        .sort((a, b) => (
          Number(a?.y || 0) - Number(b?.y || 0)
          || Number(a?.x || 0) - Number(b?.x || 0)
          || String(a?.id || '').localeCompare(String(b?.id || ''))
        ));
      return Math.max(0, sortedPlayers.findIndex((item) => item.id === targetPlayer.id));
    }

    function getPlayerZIndex(targetPlayer) {
      const depthTie = getPlayerDepthTie(targetPlayer);
      const occludingLayerIndex = getPlayerOccludingLayerIndex(targetPlayer);
      if (occludingLayerIndex !== null) {
        const occludingItem = items[occludingLayerIndex];
        const occludingAsset = occludingItem ? assetById.get(occludingItem.assetId) : null;
        return getCommercialV2ItemRenderZIndex(occludingLayerIndex, occludingItem, occludingAsset)
          - commercialV2PlayerOccludedZReserve
          + Math.min(depthTie, commercialV2PlayerOccludedZReserve - 1);
      }
      return getCommercialV2PlayerRenderZIndex(targetPlayer, depthTie * commercialV2PlayerLayerGap);
    }

    function renderEditorItem(panelItem, asset, offset, isGhost, layerIndex, playerZIndex) {
      const collision = getCommercialV2EffectiveCollision(panelItem, asset);
      const isSelected = canEditLayout && selectedId === panelItem.id;
      const canEditCollisionBox = showCollisionLines && isSelected && !isGhost && !groupEditMode;
      const collisionHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
      return (
        <button
          key={`${panelKey}-${panelItem.id}-${isGhost ? 'ghost' : 'active'}-${offset}`}
          type="button"
          className={`pixel-world-editor-item ${isGhost ? 'loop-ghost' : ''} ${isSelected ? 'selected' : ''} ${canEditLayout && groupEditMode ? 'group-bound' : ''}`}
          style={getItemStyle(panelItem, offset, getItemZIndex(layerIndex, panelItem, asset, playerZIndex))}
          onPointerDown={(event) => onPointerDown(event, panelItem, offset)}
          onClick={() => {
            if (canEditLayout) setSelectedId(panelItem.id);
          }}
          title={asset.name}
        >
          <img src={commercialV2Asset(asset.path)} alt="" draggable={false} />
          {showLayerPanel && (
            <span className={`pixel-world-layer-badge ${isCommercialV2GroundLayerItem(panelItem, asset) ? 'ground' : 'asset'}`}>
              {layerIndex + 1}
            </span>
          )}
          {showCollisionLines && collision.enabled && (
            <span
              className={`pixel-world-collision-box ${isSelected ? 'selected' : ''} ${canEditCollisionBox ? 'editable' : ''}`}
              onPointerDown={canEditCollisionBox
                ? (event) => onCollisionPointerDown(event, panelItem, asset, offset, 'move')
                : undefined}
              style={{
                left: `${collision.x * 100}%`,
                top: `${collision.y * 100}%`,
                width: `${collision.w * 100}%`,
                height: `${collision.h * 100}%`
              }}
            >
              {canEditCollisionBox && collisionHandles.map((handle) => (
                <span
                  key={handle}
                  className={`pixel-world-collision-handle handle-${handle}`}
                  onPointerDown={(event) => onCollisionPointerDown(event, panelItem, asset, offset, handle)}
                />
              ))}
            </span>
          )}
        </button>
      );
    }

    function renderPlaceAnchor(panelItem, asset, offset, layerIndex, playerZIndex) {
      const place = buildCommercialV2ItemPlace(panelItem, asset);
      if (!place) return null;
      const isSelected = canEditLayout && selectedId === panelItem.id;
      const canEditPlaceAnchor = isSelected && !groupEditMode && offset === 0;
      const locationText = place.locationIds.join(' / ');
      return (
        <span
          key={`${panelKey}-${panelItem.id}-place-anchor-${offset}`}
          className={`pixel-world-place-anchor ${isSelected ? 'selected' : ''} ${canEditPlaceAnchor ? 'editable' : ''} ${place.manualAnchor ? 'manual' : ''}`}
          onPointerDown={canEditPlaceAnchor
            ? (event) => onPlaceAnchorPointerDown(event, panelItem, asset, offset)
            : undefined}
          style={{
            left: `${((place.anchor.x + offset) / stageSize.width) * 100}%`,
            top: `${(place.anchor.y / stageSize.height) * 100}%`,
            zIndex: playerZIndex + 80 + layerIndex
          }}
          title={`${place.name} -> ${locationText}`}
        >
          <span>{place.name}</span>
        </span>
      );
    }

    function getPlayerLoopOffsets(targetPlayer) {
      const offsets = [0];
      const halfWidth = playerDimensions.width / 2;
      if (targetPlayer.x - halfWidth < 0) offsets.push(stageSize.width);
      if (targetPlayer.x + halfWidth > stageSize.width) offsets.push(-stageSize.width);
      return offsets;
    }

    function renderPlayer(targetPlayer, offset = 0, zIndex = getPlayerZIndex(targetPlayer)) {
      const isControlled = targetPlayer.id === controlledPlayerId;
      const actorKind = targetPlayer.id === behaviorTargetActorId
        ? 'role-actor'
        : targetPlayer.id === behaviorUserActorId
          ? 'user-actor'
          : '';
      const actorLabel = actorKind === 'role-actor'
        ? (behaviorCharacter?.name || '角色')
        : actorKind === 'user-actor'
          ? '玩家'
          : '';
      const frameName = targetPlayer.moving ? commercialV2PlayerFrameOrder[targetPlayer.frame] : 'idle';
      const src = commercialV2PlayerFrame(targetPlayer, `${targetPlayer.direction}_walk_${frameName}.png`);
      const visualX = targetPlayer.x + offset;
      const behaviorDialog = targetPlayer.id === behaviorTargetActorId ? activeBehaviorDialog : null;
      const actionBubble = behaviorDialog ? '' : (playerActionBubbles[targetPlayer.id] || (isControlled ? playerActionBubble : ''));
      const playerLeftPx = (visualX - playerDimensions.width / 2) * zoom;
      const playerTopPx = (targetPlayer.y - playerDimensions.height + playerDimensions.footOffset) * zoom;
      const bubbleTop = ((targetPlayer.y - playerDimensions.height + playerDimensions.footOffset - 8) / stageSize.height) * 100;
      const dialogTop = (Math.max(20, targetPlayer.y - playerDimensions.height + playerDimensions.footOffset - 34) / stageSize.height) * 100;
      const nameplateTop = ((targetPlayer.y - playerDimensions.height + playerDimensions.footOffset - 22) / stageSize.height) * 100;
      const peerCollisionWidth = Math.max(
        commercialV2PlayerPeerCollision.minWidth,
        playerDimensions.width * commercialV2PlayerPeerCollision.widthRatio
      );
      const peerCollisionHeight = Math.max(
        commercialV2PlayerPeerCollision.minHeight,
        playerDimensions.footOffset * commercialV2PlayerPeerCollision.heightRatio
      );
      const peerCollisionBox = {
        x: visualX - peerCollisionWidth / 2,
        y: targetPlayer.y - peerCollisionHeight / 2,
        w: peerCollisionWidth,
        h: peerCollisionHeight
      };
      return (
        <React.Fragment key={`player-${targetPlayer.id}-${offset}`}>
          <img
            className={`pixel-world-player ${isControlled ? 'controlled' : ''} ${actorKind}`}
            src={src}
            alt=""
            draggable={false}
            style={{
              left: 0,
              top: 0,
              width: `${playerDimensions.width * zoom}px`,
              height: `${playerDimensions.height * zoom}px`,
              transform: `translate3d(${playerLeftPx}px, ${playerTopPx}px, 0)`,
              zIndex
            }}
          />
          {actorLabel && (
            <span
              className={`pixel-world-player-nameplate ${actorKind}`}
              style={{
                left: `${(visualX / stageSize.width) * 100}%`,
                top: `${nameplateTop}%`,
                zIndex: zIndex + 900
              }}
            >
              {actorLabel}
            </span>
          )}
          {actionBubble && (
            <span
              className="pixel-world-player-action-bubble"
              style={{
                left: `${(visualX / stageSize.width) * 100}%`,
                top: `${bubbleTop}%`,
                zIndex: zIndex + 1000
              }}
            >
              {actionBubble}
            </span>
          )}
          {behaviorDialog && (
            <div
              className={`pixel-world-behavior-dialog ${behaviorDialog.type || ''}`}
              style={{
                left: `${(visualX / stageSize.width) * 100}%`,
                top: `${dialogTop}%`,
                zIndex: zIndex + 1300
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="pixel-world-behavior-dialog-head">
                <strong>{behaviorDialog.title || '角色'}</strong>
                <span>{Math.min((behaviorDialog.stepIndex || 0) + 1, behaviorDialog.totalSteps || 1)}/{behaviorDialog.totalSteps || 1}</span>
              </div>
              <p>{behaviorDialog.text}</p>
              {behaviorDialog.type === 'pending' ? (
                <button type="button" disabled>生成中...</button>
              ) : behaviorDialog.type === 'choice' && behaviorDialog.choices?.length ? (
                <div className="pixel-world-behavior-dialog-choices">
                  {behaviorDialog.choices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => chooseBehaviorDialogChoice(choice)}
                      disabled={behaviorLoading}
                    >
                            {choice.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="pixel-world-behavior-dialog-exit"
                          onClick={exitBehaviorDialog}
                          disabled={behaviorLoading}
                        >
                          退出对话
                        </button>
                      </div>
              ) : (
                <button type="button" onClick={continueBehaviorDialog}>
                  下一句
                </button>
              )}
            </div>
          )}
          {showCollisionLines && (
            <span
              className={`pixel-world-player-footprint ${isControlled ? 'controlled' : ''}`}
              style={{
                left: `${(peerCollisionBox.x / stageSize.width) * 100}%`,
                top: `${(peerCollisionBox.y / stageSize.height) * 100}%`,
                width: `${(peerCollisionBox.w / stageSize.width) * 100}%`,
                height: `${(peerCollisionBox.h / stageSize.height) * 100}%`,
                zIndex: zIndex + 1
              }}
            />
          )}
        </React.Fragment>
      );
    }

    function renderItemCopies(item, asset, interactivePanel, layerIndex, playerZIndex) {
      if (!interactivePanel) {
        return getLoopOffsets(item, asset).map((offset) => renderEditorItem(item, asset, offset, true, layerIndex, playerZIndex));
      }
      return [
        ...getLoopOffsets(item, asset).filter((offset) => offset !== 0).map((offset) => renderEditorItem(item, asset, offset, true, layerIndex, playerZIndex)),
        renderEditorItem(item, asset, 0, false, layerIndex, playerZIndex)
      ];
    }

    const controlledPlayerZIndex = getPlayerZIndex(player);
    const playerNodes = commercialV2PlayerCharacters.flatMap((character) => {
      const targetPlayer = players[character.id] || createCommercialV2PlayerState(character);
      const targetPlayerZIndex = getPlayerZIndex(targetPlayer);
      return getPlayerLoopOffsets(targetPlayer).map((offset) => renderPlayer(targetPlayer, offset, targetPlayerZIndex));
    });
    const placeAnchorNodes = [];
    const orderedNodes = [];
    items.forEach((item, layerIndex) => {
      const asset = assetById.get(item.assetId);
      if (!asset) return;
      orderedNodes.push(...renderItemCopies(item, asset, interactive, layerIndex, controlledPlayerZIndex));
      if (showPlaceAnchors) {
        getLoopOffsets(item, asset).forEach((offset) => {
          const anchorNode = renderPlaceAnchor(item, asset, offset, layerIndex, controlledPlayerZIndex);
          if (anchorNode) placeAnchorNodes.push(anchorNode);
        });
      }
    });
    orderedNodes.push(...playerNodes);
    orderedNodes.push(...placeAnchorNodes);

    return (
      <div
        key={panelKey}
        className={`pixel-world-editor-stage ${interactive ? 'active-loop' : 'loop-copy'} ${showCollisionLines ? 'collision-lines-visible' : ''}`}
        ref={interactive ? stageRef : undefined}
        style={{
          '--editor-zoom': zoom,
          width: `${stageSize.width * zoom}px`,
          height: `${stageSize.height * zoom}px`,
          '--street-bg-color': commercialV2BackgroundColor
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pixel-world-editor-bg" aria-hidden="true" />
        {orderedNodes}
        {interactive && renderPlayerInteractionMenu()}
      </div>
    );
  }

  const layoutJson = useMemo(() => JSON.stringify({
    segment: {
      width: commercialV2SegmentSize.width,
      height: stageSize.height
    },
    segments: segmentCount,
    stage: stageSize,
    background: {
      type: 'solid',
      color: commercialV2BackgroundColor
    },
    loop: getCommercialV2Loop(stageSize),
    collision: {
      unit: 'ratio-of-item-box',
      mode: 'active',
      lineVisibility: 'hidden-by-default',
      player: 'foot-point',
      groundLayer: 'ignored'
    },
    places: placeLinks,
    items: items.map((item) => serializeCommercialV2Item(item, assetById.get(item.assetId)))
  }, null, 2), [assetById, items, placeLinks, segmentCount, stageSize]);

  return (
    <div className={`pixel-world-editor ${viewMode ? 'view-mode' : ''}`}>
      <div className="pixel-world-editor-toolbar">
        <button onClick={saveLayout}>保存布局</button>
        <button onClick={saveCurrentAsDefaultScene}>保存当前场景为默认场景</button>
        <button onClick={copyLayout}>复制 JSON</button>
        <button
          className={viewMode ? 'active' : ''}
          onClick={toggleViewMode}
          title={viewMode ? '素材已锁定，关闭后才能移动和编辑' : '开启后锁定素材，避免误拖'}
        >
          {viewMode ? '观赏模式' : '编辑模式'}
        </button>
        <button onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.1).toFixed(2))))}>画布缩小</button>
        <button onClick={() => setZoom((value) => Math.min(1.4, Number((value + 0.1).toFixed(2))))}>画布放大</button>
        <strong>{Math.round(zoom * 100)}%</strong>
        <button onClick={prependCanvasSegment} disabled={!canEditLayout}>左边增加 {commercialV2SegmentSize.width}px</button>
        <button onClick={appendCanvasSegment} disabled={!canEditLayout}>右边增加 {commercialV2SegmentSize.width}px</button>
        <button onClick={removeCanvasSegment} disabled={!canEditLayout || segmentCount <= commercialV2MinSegmentCount}>收回一段</button>
        <strong>{segmentCount} 段</strong>
        <span>首尾相连</span>
        <span className="pixel-world-player-help">WASD 控制当前人物</span>
        <label className="pixel-world-player-switch-control">
          <span>控制角色</span>
          <select
            value={controlledPlayerId}
            onChange={(event) => {
              switchControlledPlayer(event.target.value);
              event.currentTarget.blur();
            }}
            aria-label="切换控制角色"
          >
            {commercialV2PlayerCharacters.map((character) => (
              <option key={character.id} value={character.id}>{character.label}</option>
            ))}
          </select>
          <strong>{controlledPlayerCharacter.label}</strong>
        </label>
        <button
          type="button"
          onClick={addRoleCharacter}
          title="把角色小人绑定到 char 试用版，并生成在玩家旁边"
        >
          新增角色
        </button>
        <label className="pixel-world-player-bind-control">
          <span>实际角色</span>
          <select
            value={behaviorCharacterId}
            onChange={(event) => {
              setBehaviorActorId(controlledPlayerId);
              setBehaviorCharacterId(event.target.value);
            }}
            disabled={!behaviorCharacters.length}
            aria-label="选择当前皮套绑定的实际角色"
          >
            {behaviorCharacters.length ? behaviorCharacters.map((item) => (
              <option key={item.id} value={item.id}>{item.name || item.id}</option>
            )) : (
              <option value="">暂无角色</option>
            )}
          </select>
          <button
            type="button"
            onClick={bindControlledSkinToBehaviorCharacter}
            disabled={!behaviorCharacters.length || !behaviorCharacterId}
            title="把当前控制的皮套绑定到这个实际角色"
          >
            绑定
          </button>
          <strong>{controlledBindingSummary}</strong>
        </label>
        <label className="pixel-world-auto-walk-control">
          <span>自动循迹</span>
          <select
            value={autoTargetId}
            onChange={(event) => setAutoTargetId(event.target.value)}
            disabled={!travelTargetOptions.length}
            aria-label="自动循迹目标"
          >
            {travelTargetOptions.length ? travelTargetOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            )) : (
              <option value="">暂无地点</option>
            )}
          </select>
          <button type="button" onClick={() => startAutoTravel()} disabled={!travelTargetOptions.length}>前往</button>
          <button
            type="button"
            onClick={() => cancelAutoTravel('自动循迹已停止。')}
            disabled={!autoTravelActive && !playerActionBubble}
          >
            停止
          </button>
        </label>
        <label className="pixel-world-player-scale-control">
          <span>角色尺寸</span>
          <input
            type="range"
            min="0.6"
            max="3"
            step="0.05"
            value={playerScale}
            onChange={(event) => updatePlayerScale(event.target.value)}
          />
          <input
            type="number"
            min="0.6"
            max="3"
            step="0.05"
            value={playerScale}
            onChange={(event) => updatePlayerScale(event.target.value)}
            aria-label="角色尺寸倍率"
          />
          <strong>{Math.round(playerScale * 100)}%</strong>
        </label>
        <button onClick={() => setPlayerScale(commercialV2DefaultPlayerScale)}>默认角色尺寸</button>
        <button onClick={() => centerPlayerInView(true)}>居中当前人物</button>
        <button
          className={showCollisionLines ? 'active' : ''}
          onClick={toggleCollisionLines}
          title="只切换碰撞箱线条显示；碰撞阻挡默认一直生效"
        >
          {showCollisionLines ? '隐藏碰撞箱线' : '查看碰撞箱线'}
        </button>
        <button
          className={showPlaceAnchors ? 'active' : ''}
          onClick={togglePlaceAnchors}
          title="查看角色以后自动前往和交互的地点锚点"
        >
          {showPlaceAnchors ? '隐藏地点锚点' : '查看地点锚点'}
        </button>
        <button
          className={showLayerPanel ? 'active' : ''}
          onClick={() => setShowLayerPanel((value) => !value)}
          title="显示统一图层序号和右侧图层列表"
        >
          {showLayerPanel ? '隐藏图层' : '查看图层'}
        </button>
        <button
          className={canEditLayout && groupEditMode ? 'active' : ''}
          onClick={() => setGroupEditMode((value) => !value)}
          disabled={!canEditLayout}
          title="开启后拖动、缩放和微调会作用于全部素材"
        >
          {groupEditMode ? '整体编辑中' : '整体编辑'}
        </button>
        <button onClick={() => scaleSelected(0.92)} disabled={!canEditLayout || (groupEditMode ? items.length === 0 : !selectedItem)}>{groupEditMode ? '整体缩小' : '素材缩小'}</button>
        <button onClick={() => scaleSelected(1.08)} disabled={!canEditLayout || (groupEditMode ? items.length === 0 : !selectedItem)}>{groupEditMode ? '整体放大' : '素材放大'}</button>
        <button onClick={() => moveSelectedLayer('up')} disabled={!canEditLayout || groupEditMode || !selectedItem}>上移图层</button>
        <button onClick={() => moveSelectedLayer('down')} disabled={!canEditLayout || groupEditMode || !selectedItem}>下移图层</button>
        <button onClick={bringSelectedToFront} disabled={!canEditLayout || groupEditMode || !selectedItem}>置顶</button>
        <button onClick={sendSelectedToBack} disabled={!canEditLayout || groupEditMode || !selectedItem}>置底</button>
        <button onClick={deleteSelected} disabled={!canEditLayout || groupEditMode || !selectedItem}>删除</button>
        <button onClick={restoreResetBackup} disabled={!canEditLayout}>恢复上次布局</button>
        <button onClick={resetLayout} disabled={!canEditLayout}>恢复默认</button>
        <span>{notice}</span>
      </div>

      <div className={`pixel-world-editor-body ${behaviorPanelCollapsed ? 'behavior-collapsed' : ''}`}>
        <aside className="pixel-world-asset-panel">
          <h3>素材</h3>
          <div className="pixel-world-asset-type-tabs" role="tablist" aria-label="素材分类">
            {groupedAssets.map(([type, assets]) => (
              <button
                key={type}
                className={activeAssetGroup?.[0] === type ? 'active' : ''}
                onClick={() => setActiveAssetType(type)}
                title={`${type} (${assets.length})`}
              >
                {type}
                <span>{assets.length}</span>
              </button>
            ))}
          </div>
          {activeAssetGroup && (
            <div className="pixel-world-asset-group" key={activeAssetGroup[0]}>
              <strong>{activeAssetGroup[0]}</strong>
              <div className="pixel-world-asset-grid">
                {activeAssetGroup[1].map((asset) => (
                  <button key={asset.id} onClick={() => addAsset(asset)} title={asset.name} disabled={!canEditLayout}>
                    <img src={commercialV2Asset(asset.path)} alt="" draggable={false} loading="lazy" />
                    <span>{asset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div
          className="pixel-world-editor-canvas-wrap"
          ref={canvasWrapRef}
          tabIndex={0}
          onPointerDownCapture={focusCanvasForKeyboard}
          onScroll={onLoopScroll}
          aria-label="商业街画布，点击后可用 WASD 控制当前人物"
        >
          <div className="pixel-world-editor-loop-track">
            {renderEditorPanel('loop-before')}
            {renderEditorPanel('loop-current', true)}
            {renderEditorPanel('loop-after')}
          </div>
        </div>

        <aside className="pixel-world-inspector">
          <h3>选中</h3>
          {viewMode ? (
            <p>观赏模式已开启，素材不会被选中或拖动；切到编辑模式后可以移动素材。</p>
          ) : selectedItem && selectedAsset ? (
            <>
              <div className="pixel-world-selected-name">{selectedAsset.name}</div>
              <div className={`pixel-world-layer-mode-card ${selectedIsGroundLayer ? 'ground' : ''}`}>
                <div className="pixel-world-layer-mode-head">
                  <strong>图层属性</strong>
                  <label className="pixel-world-collision-toggle">
                    <input
                      type="checkbox"
                      checked={selectedIsGroundLayer}
                      disabled={selectedIsBuiltInGroundLayer}
                      onChange={(event) => updateSelectedGroundLayer(event.target.checked)}
                    />
                    <span>地面层</span>
                  </label>
                </div>
                <small>
                  {selectedIsBuiltInGroundLayer
                    ? '这个素材类型固定为背景板，永远在人物下方，碰撞箱不会阻挡人物。'
                    : selectedIsGroundLayer
                      ? '当前实例会恒在人物下方；碰撞箱保留但不会阻挡人物。'
                      : '普通素材会按图层和遮挡判断显示。'}
                </small>
              </div>
              {selectedPlace && (
                <div className="pixel-world-place-card">
                  <div className="pixel-world-place-card-head">
                    <strong>地点联动</strong>
                    {!showPlaceAnchors && (
                      <button onClick={togglePlaceAnchors}>查看终点</button>
                    )}
                  </div>
                  <span>{selectedPlace.name}</span>
                  <small>ID: {selectedPlace.placeId}</small>
                  <small>后端地点: {selectedPlace.locationIds.join(' / ')}</small>
                  <small>动作: {selectedPlace.actions.join(' / ')}</small>
                  {selectedPlaceAnchorLocalPoint && (
                    <>
                      <div className="pixel-world-place-fields">
                        {['x', 'y'].map((key) => (
                          <label key={`place-anchor-${key}`}>
                            <span>{key.toUpperCase()}</span>
                            <input
                              type="number"
                              value={selectedPlaceAnchorLocalPoint[key]}
                              onChange={(event) => updateSelectedPlaceAnchorLocalPoint(key, event.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="pixel-world-collision-actions">
                        <button onClick={resetSelectedPlaceAnchor}>默认终点</button>
                      </div>
                      <div className="pixel-world-inspector-hint">
                        显示终点后，拖粉色点就能改自动循迹落点；保存布局会一起保存。
                      </div>
                    </>
                  )}
                </div>
              )}
              {['x', 'y', 'w', 'h'].map((key) => (
                <label key={key}>
                  <span>{key.toUpperCase()}</span>
                  <input
                    type="number"
                    value={Math.round(selectedItem[key])}
                    onChange={(event) => updateItem(selectedItem.id, { [key]: Number(event.target.value) })}
                  />
                </label>
              ))}
              <div className="pixel-world-nudge-pad" aria-label="微调位置">
                <button onClick={() => nudgeSelected(0, -4)}>↑</button>
                <button onClick={() => nudgeSelected(-4, 0)}>←</button>
                <button onClick={() => nudgeSelected(4, 0)}>→</button>
                <button onClick={() => nudgeSelected(0, 4)}>↓</button>
              </div>
              <div className="pixel-world-scale-row">
                <button onClick={() => scaleSelected(0.96)}>{groupEditMode ? '整体小一点' : '小一点'}</button>
                <button onClick={() => scaleSelected(1.04)}>{groupEditMode ? '整体大一点' : '大一点'}</button>
              </div>
              <div className={`pixel-world-collision-editor ${showCollisionLines ? 'active' : ''}`}>
                <div className="pixel-world-collision-editor-head">
                  <strong>碰撞体积</strong>
                  {!showCollisionLines && (
                    <button onClick={toggleCollisionLines}>查看碰撞箱线</button>
                  )}
                  <label className="pixel-world-collision-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCollision?.enabled)}
                      disabled={!isCommercialV2CollisionAsset(selectedAsset) || !selectedCollisionCanTakeEffect}
                      onChange={(event) => updateSelectedCollisionEnabled(event.target.checked)}
                    />
                    <span>启用</span>
                  </label>
                </div>
                {selectedCollisionCanTakeEffect && selectedCollisionLocalBox ? (
                  <>
                    <div className="pixel-world-collision-fields">
                      {['x', 'y', 'w', 'h'].map((key) => (
                        <label key={`collision-${key}`}>
                          <span>{key.toUpperCase()}</span>
                          <input
                            type="number"
                            value={selectedCollisionLocalBox[key]}
                            onChange={(event) => updateSelectedCollisionLocalBox(key, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="pixel-world-collision-actions">
                      <button onClick={resetSelectedCollision}>默认</button>
                      <button onClick={fitSelectedCollisionToSprite}>贴合整图</button>
                    </div>
                    <div className="pixel-world-inspector-hint">
                      碰撞默认生效；显示线条后，拖绿色框移动碰撞箱，拖蓝色点调整大小。
                    </div>
                  </>
                ) : (
                  <div className="pixel-world-inspector-hint">
                    {selectedIsGroundLayer
                      ? '地面层规则：这个实例的碰撞箱不会参与人物阻挡或自动循迹绕路。'
                      : '这个素材还没有可编辑的碰撞箱。'}
                  </div>
                )}
              </div>
              <div className="pixel-world-inspector-hint">
                {groupEditMode ? '整体编辑已开启：拖动任意素材会带动当前全部建筑和道具。' : '拖动素材移动；用 W/H 调整大小，显示会保持原图比例。'}
              </div>
            </>
          ) : (
            <p>点击画布上的素材开始编辑。</p>
          )}
          {showLayerPanel && (
            <section className="pixel-world-layer-panel">
              <div className="pixel-world-layer-panel-head">
                <strong>图层</strong>
                <small>上方后绘制；背景板恒在人物下方且不参与碰撞。</small>
              </div>
              {selectedLayerRow && (
                <div className="pixel-world-layer-current">
                  当前：{selectedLayerRow.asset?.name || selectedLayerRow.item.assetId}
                  <span>#{selectedLayerRow.layerIndex + 1}</span>
                </div>
              )}
              <div className="pixel-world-layer-list">
                {layerRows.slice().reverse().map((row) => (
                  <button
                    key={`layer-row-${row.item.id}`}
                    type="button"
                    className={`pixel-world-layer-row ${row.item.id === selectedId ? 'active' : ''} ${row.isGround ? 'ground' : 'asset'}`}
                    onClick={() => setSelectedId(row.item.id)}
                    title={`${row.asset?.name || row.item.assetId} / z-index ${row.zIndex}`}
                  >
                    <span className="pixel-world-layer-index">#{row.layerIndex + 1}</span>
                    <span className="pixel-world-layer-name">
                      {row.asset?.name || row.item.assetId}
                      <small>{row.asset?.type || '未知'} · z {row.zIndex} · {row.playerRule}</small>
                    </span>
                    <span className="pixel-world-layer-kind">{row.isGround ? '背景板' : '素材'}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <h3>布局 JSON</h3>
          <textarea value={layoutJson} readOnly />
        </aside>

        {renderBehaviorTreePanel()}
      </div>
    </div>
  );
}

export default CommercialStreetEditor;
