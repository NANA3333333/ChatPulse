import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../LanguageContext';
import { pixelTx, translatePixelAction, translatePixelText } from './pixelWorldI18n';
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
import {
  roomStyleMeta,
  roomEditorStorageKey,
  roomEditorCanvasStorageKey,
  roomEditorSizeProfileStorageKey,
  roomEditorResetBackupStorageKey,
  roomEditorDefaultSnapshotStorageKey,
  roomEditorPlayerStorageKey,
  roomEditorBehaviorTreeStorageKey,
  roomEditorLayoutUpdatedEvent,
  roomEditorMaxStorageBytes,
  roomEditorMaxSavedItems,
  roomEditorStageSize,
  roomEditorAiGridSize,
  roomEditorBackgroundColor,
  roomEditorDefaultZoom,
  roomEditorLegacyDefaultPlayerScales,
  roomEditorDefaultPlayerScale,
  roomEditorMinPlayerScale,
  roomEditorMaxPlayerScale,
  roomEditorPlayerMoveSpeed,
  roomEditorPlayerRenderIntervalMs,
  roomEditorPlayerBounds,
  roomEditorGroundLayerZIndex,
  roomEditorDepthZIndexBase,
  roomEditorDepthZIndexScale,
  roomEditorOverlayZIndex,
  roomEditorPlayerInitials,
  roomEditorBehaviorSafePoints,
  roomEditorBackdrop,
  roomEditorAssetVersion,
  roomEditorRealWorldScaleByKind,
  roomEditorCalibratedSizeProfile,
  roomEditorDirectionOrder,
  roomEditorDirectionLabels,
  roomEditorDirectionalGroupLabels,
  roomEditorDirectionalAliases,
  roomEditorDirectionalAliasGroups,
  roomEditorAiDirectionalGroupIds,
  getRoomEditorDirectionalMeta,
  getRoomEditorRealWorldKind,
  getRoomEditorRealWorldScale,
  scaleRoomEditorBoxToRealWorld,
  applyRoomEditorCalibratedSizeProfile,
  boxesAreNearlySameSize,
  roomEditorAssetRows,
  roomEditorFurniturePriceByAssetId,
  getRoomEditorBaseFurnitureAssetId,
  getRoomEditorFurniturePrice,
  getRoomEditorAiDirectionalGroupId,
  getRoomEditorAiDirectionalPathSlug,
  isRoomEditorBedGroup,
  canBuildRoomEditorAiDirections,
  getRoomEditorAiSideScale,
  roomEditorAiDirectionalSideBoxWidths,
  roomEditorAiDirectionalSideBoxHeights,
  getRoomEditorDirectionalBox,
  makeRoomEditorAsset,
  makeRoomEditorAiDirectionalVariant,
  buildRoomEditorAssetCatalog,
  roomEditorAssetCatalog,
  roomEditorAsset,
  buildRoomEditorDirectionalGroups,
  roomEditorDirectionalGroups,
  getRoomEditorDirectionalGroup,
  getRoomEditorPaletteAssetName,
  getRoomEditorAiCellSize,
  makeRoomEditorAiBaseGrid,
  formatRoomEditorAiGrid,
  getRoomEditorAiFurnitureKind,
  getRoomEditorAiFurnitureToken,
  getRoomEditorAiFurnitureRules,
  formatRoomEditorAiFurnitureShape,
  getRoomEditorAiItemGridBox,
  getRoomEditorAiDirectionOptions,
  buildRoomEditorAiFurniture,
  buildRoomEditorCurrentAsciiGrid,
  formatRoomEditorAiPrompt,
  buildRoomEditorAiLayout,
  buildRoomScene,
  roomScenes,
  getRoomEditorDefaultState,
  getBuiltInDefaultRoomEditorItems,
  normalizeRoomEditorItemAspect,
  migrateRoomEditorItemToCurrentAssetBox,
  getRoomEditorItemSizeKind,
  getRoomEditorSizeAnchorMode,
  resizeRoomEditorItemByKindSize,
  buildRoomEditorSizeProfile,
  readStoredRoomEditorSizeProfile,
  writeStoredRoomEditorSizeProfile,
  applyRoomEditorSizeProfileToItems,
  applyRoomEditorKindSizeToItems,
  getRoomEditorDefaultCollision,
  getBoxesOverlapArea,
  getRoomEditorDepthZIndex,
  getRoomEditorItemSortY,
  getRoomEditorItemRenderZIndex,
  getRoomEditorPlayerRenderZIndex,
  getRoomEditorPlayerDepthTie,
  normalizeRoomEditorLayoutState,
  readStoredRoomEditorLayout,
  readStoredRoomEditorResetBackup,
  readStoredRoomEditorDefaultSnapshot,
  clampRoomEditorPlayer,
  createRoomEditorPlayerState,
  createRoomEditorPlayerStates,
  normalizeRoomEditorPlayerState,
  clampRoomEditorPlayerScale,
  serializeRoomEditorPlayers,
  normalizeRoomEditorPlayersSnapshot,
  readStoredRoomEditorPlayers,
  getRoomEditorDirectionFromDelta,
  createRoomEditorBehaviorTreeSnapshot,
  serializeRoomEditorItem,
  buildRoomEditorItemAnchor,
  getRoomEditorPlaceAnchorLocalPoint
} from './roomEditorCore';

function RoomAssetEditor({ scene, apiUrl = '/api', userProfile = null }) {
  const { lang } = useLanguage();
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
  const roomBehaviorTravelRef = useRef(null);
  const behaviorRuntimeRef = useRef(null);
  const behaviorChoicePendingRef = useRef(false);
  const behaviorInteractionSessionRef = useRef({ active: false, expiresAt: 0 });
  const behaviorTreeStateRef = useRef(null);
  const autonomousBehaviorCooldownRef = useRef(Date.now() + commercialV2BehaviorAutonomousInitialDelayMs);
  const autonomousBehaviorCursorRef = useRef(0);
  const autonomousBehaviorRecentRef = useRef([]);
  const pickAutonomousBehaviorBranchRef = useRef(() => null);
  const activateBehaviorBranchRef = useRef(() => {});
  const advanceBehaviorRuntimeRef = useRef(() => {});
  const roomBehaviorStepRef = useRef(0);
  const [resetBackup, setResetBackup] = useState(() => readStoredRoomEditorResetBackup());
  const [selectedId, setSelectedId] = useState(initialLayout.selectedId || '');
  const [zoom, setZoom] = useState(roomEditorDefaultZoom);
  const [viewMode, setViewMode] = useState(false);
  const [groupEditMode, setGroupEditMode] = useState(false);
  const [showCollisionLines, setShowCollisionLines] = useState(false);
  const [showPlaceAnchors, setShowPlaceAnchors] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showAdvancedToolbar, setShowAdvancedToolbar] = useState(false);
  const [activeAssetType, setActiveAssetType] = useState('家具');
  const [playerActionBubble, setPlayerActionBubble] = useState('');
  const [activeBehaviorDialog, setActiveBehaviorDialog] = useState(null);
  const [interactionMenuOpen, setInteractionMenuOpen] = useState(false);
  const [behaviorCharacters, setBehaviorCharacters] = useState([]);
  const [behaviorCharacterId, setBehaviorCharacterId] = useState('');
  const [behaviorAction, setBehaviorAction] = useState('greet');
  const [behaviorPlaceId, setBehaviorPlaceId] = useState('');
  const [behaviorPromptText, setBehaviorPromptText] = useState('');
  const [behaviorConfig, setBehaviorConfig] = useState(() => readStoredCommercialBehaviorConfig());
  const [behaviorModelOptions, setBehaviorModelOptions] = useState([]);
  const [behaviorInput, setBehaviorInput] = useState(null);
  const [behaviorOutput, setBehaviorOutput] = useState(null);
  const [behaviorTreeState, setBehaviorTreeState] = useState(() => readStoredRoomBehaviorTreeState(
    roomEditorBehaviorTreeStorageKey,
    roomEditorMaxStorageBytes
  ));
  const [behaviorPatchOutput, setBehaviorPatchOutput] = useState(null);
  const [activeBehaviorBranch, setActiveBehaviorBranch] = useState(null);
  const [behaviorStatus, setBehaviorStatus] = useState('等待读取房间 AI 上文。');
  const [behaviorModelStatus, setBehaviorModelStatus] = useState('默认使用绑定角色的模型配置；需要覆盖时再填写 URL 和 Key。');
  const [behaviorLoading, setBehaviorLoading] = useState(false);
  const [behaviorModelsLoading, setBehaviorModelsLoading] = useState(false);
  const [behaviorShowKey, setBehaviorShowKey] = useState(false);
  const [behaviorPanelCollapsed, setBehaviorPanelCollapsed] = useState(false);
  const [roomBehaviorPanelCollapsed, setRoomBehaviorPanelCollapsed] = useState(false);
  const [behaviorFoldOpen, setBehaviorFoldOpen] = useState({
    model: false,
    context: false,
    constraints: true,
    branchMap: false,
    interaction: true,
    runtime: true,
    debug: false
  });
  const [roomBehaviorFoldOpen, setRoomBehaviorFoldOpen] = useState({
    constraints: true,
    runtime: true,
    debug: false
  });
  const behaviorContextStats = useMemo(
    () => buildCommercialBehaviorContextStats(behaviorTreeState, behaviorConfig),
    [behaviorTreeState, behaviorConfig.context_q_limit, behaviorConfig.context_summary_threshold]
  );
  const [notice, setNotice] = useState('房间画布已接入小人和行为树面板；WASD/方向键可以移动当前小人。');
  const stageSize = roomEditorStageSize;
  const assetById = useMemo(() => new Map(roomEditorAssetCatalog.map((asset) => [asset.id, asset])), []);
  const controlledPlayer = players[controlledPlayerId]
    || players[commercialV2DefaultControlledPlayerId]
    || createRoomEditorPlayerState(commercialV2PlayerCharacters[0]);
  const rolePlayer = players[commercialV2RoleActorId]
    || createRoomEditorPlayerState(commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0]);
  const userPlayer = players[commercialV2UserActorId]
    || createRoomEditorPlayerState(commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0]);
  const playerDimensions = useMemo(() => ({
    width: commercialV2PlayerSize.width * playerScale,
    height: commercialV2PlayerSize.height * playerScale,
    footOffset: commercialV2PlayerSize.footOffset * playerScale
  }), [playerScale]);
  const getPlayerVisualDimensions = useCallback((targetPlayer) => {
    const character = getCommercialV2PlayerCharacter(targetPlayer);
    const visualScale = Math.max(0.25, Number(character?.visualScale) || 1);
    return {
      width: playerDimensions.width * visualScale,
      height: playerDimensions.height * visualScale,
      footOffset: playerDimensions.footOffset * visualScale
    };
  }, [playerDimensions]);
  const roomCollisionRects = useMemo(() => items
    .map((item) => {
      const asset = assetById.get(item.assetId);
      const collisionBox = getCommercialV2CollisionWorldBox(item, asset);
      if (!collisionBox) return null;
      return {
        id: item.id,
        assetId: item.assetId,
        ...collisionBox
      };
    })
    .filter(Boolean), [assetById, items]);
  const getRoomPlayerFootBox = useCallback((x, y) => {
    const footWidth = Math.max(14, playerDimensions.width * 0.28);
    const footHeight = Math.max(8, playerDimensions.footOffset * 0.72);
    return {
      x: Number(x || 0) - footWidth / 2,
      y: Number(y || 0) - footHeight / 2,
      w: footWidth,
      h: footHeight
    };
  }, [playerDimensions.footOffset, playerDimensions.width]);
  const getRoomPlayerCollisionOverlapArea = useCallback((x, y) => {
    if (!roomCollisionRects.length) return 0;
    const footBox = getRoomPlayerFootBox(x, y);
    return roomCollisionRects.reduce((total, rect) => (
      total + getBoxesOverlapArea(footBox, rect)
    ), 0);
  }, [getRoomPlayerFootBox, roomCollisionRects]);
  const isRoomPlayerBlockedByItems = useCallback((x, y) => (
    getRoomPlayerCollisionOverlapArea(x, y) > 0.01
  ), [getRoomPlayerCollisionOverlapArea]);
  const findSafeRoomPlayerPointNear = useCallback((point, origin = null) => {
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
      { x: 1, y: -1 }
    ];
    const distances = [18, 32, 52, 76, 108, 144];
    let best = null;
    distances.forEach((distance) => {
      directions.forEach((direction) => {
        const candidate = clampRoomEditorPlayer({
          ...base,
          x: base.x + direction.x * distance,
          y: base.y + direction.y * distance
        });
        if (isRoomPlayerBlockedByItems(candidate.x, candidate.y)) return;
        const anchorDistance = Math.hypot(candidate.x - base.x, candidate.y - base.y);
        const originDistance = origin
          ? Math.hypot(candidate.x - origin.x, candidate.y - origin.y) * 0.08
          : 0;
        const frontBias = direction.y > 0 ? -4 : 0;
        const score = anchorDistance + originDistance + frontBias;
        if (!best || score < best.score) {
          best = { ...candidate, score };
        }
      });
    });
    return best ? clampRoomEditorPlayer({ ...base, x: best.x, y: best.y }) : base;
  }, [isRoomPlayerBlockedByItems]);
  const resolveRoomPlayerMovement = useCallback((currentPlayer, targetPoint) => {
    const currentPoint = clampRoomEditorPlayer(currentPlayer);
    const desiredPoint = clampRoomEditorPlayer({
      ...currentPoint,
      x: Number.isFinite(Number(targetPoint?.x)) ? Number(targetPoint.x) : currentPoint.x,
      y: Number.isFinite(Number(targetPoint?.y)) ? Number(targetPoint.y) : currentPoint.y
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
  }, [getRoomPlayerCollisionOverlapArea]);
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
      side: (rolePlayer.x || 0) < stageSize.width * 0.5 ? 'right' : 'left'
    };
  }, [playerDimensions.footOffset, playerDimensions.height, rolePlayer.x, rolePlayer.y, stageSize.height, stageSize.width, userPlayer.x, userPlayer.y]);
  const roomBehaviorInteractionState = behaviorInteractionState;
  const selectedItem = items.find((item) => item.id === selectedId) || null;
  const selectedAsset = selectedItem ? assetById.get(selectedItem.assetId) : null;
  const selectedDirectionGroup = selectedAsset ? getRoomEditorDirectionalGroup(selectedAsset) : null;
  const selectedDirection = selectedAsset?.directional?.direction || '';
  const selectedIsGroundLayer = Boolean(selectedItem?.groundLayer);
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
    ? buildRoomEditorItemAnchor(selectedItem, selectedAsset)
    : null;
  const selectedPlaceAnchorLocalPoint = selectedItem && selectedAsset
    ? getRoomEditorPlaceAnchorLocalPoint(selectedItem, selectedAsset)
    : null;
  const layerRows = useMemo(() => items.map((item, layerIndex) => {
    const asset = assetById.get(item.assetId);
    const isGround = Boolean(item.groundLayer);
    return {
      item,
      asset,
      layerIndex,
      zIndex: getRoomEditorItemRenderZIndex(item, asset, layerIndex),
      isGround,
      playerRule: isGround ? '地面层 / 忽略碰撞' : '普通素材 / 碰撞生效'
    };
  }), [assetById, items]);
  const selectedLayerRow = selectedId
    ? layerRows.find((row) => row.item.id === selectedId) || null
    : null;
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
  const roomAnchors = useMemo(() => items
    .map((item) => buildRoomEditorItemAnchor(item, assetById.get(item.assetId)))
    .filter(Boolean), [assetById, items]);
  const behaviorPlaceLinks = useMemo(() => {
    const furniturePlaces = roomAnchors.map((anchor, index) => ({
      order: index + 1,
      placeId: anchor.id,
      locationId: anchor.id,
      locationIds: [anchor.id, anchor.itemId, anchor.assetId].filter(Boolean),
      name: anchor.name,
      kind: anchor.kind || '房间家具',
      actions: ['go_to_place', 'browse_near', 'idle_at_place', 'loop_in_front_of'],
      aliases: [anchor.name, anchor.itemId, anchor.assetId].filter(Boolean),
      facing: 'front',
      anchor: anchor.anchor,
      rawAnchor: anchor
    }));
    const safePointPlaces = roomEditorBehaviorSafePoints.map((point, index) => ({
      order: furniturePlaces.length + index + 1,
      placeId: `room-point:${point.id}`,
      locationId: `room-point:${point.id}`,
      locationIds: [`room-point:${point.id}`, point.id],
      name: point.label,
      kind: '房间站位',
      actions: ['go_to_place', 'idle_at_place', 'wander_between', 'patrol_segment'],
      aliases: [point.label, point.id],
      facing: point.direction,
      anchor: { x: point.x, y: point.y }
    }));
    return [...furniturePlaces, ...safePointPlaces].map((place, index) => ({
      ...place,
      order: index + 1
    }));
  }, [roomAnchors]);
  const behaviorOrderedPlaces = useMemo(() => behaviorPlaceLinks.map((place, index) => ({
    ...place,
    order: index + 1
  })), [behaviorPlaceLinks]);
  const behaviorPlaceOptions = useMemo(() => behaviorOrderedPlaces.map((place) => ({
    id: place.placeId,
    label: place.name,
    order: place.order
  })), [behaviorOrderedPlaces]);
  const behaviorCharacter = behaviorCharacters.find((item) => item.id === behaviorCharacterId) || behaviorCharacters[0] || null;
  const behaviorPrimaryActions = commercialV2BehaviorPrimaryActionIds
    .map((id) => commercialV2BehaviorActions.find((item) => item.id === id))
    .filter(Boolean)
    .map((action) => translatePixelAction(action, lang));
  const behaviorContextActions = commercialV2BehaviorContextActionIds
    .map((id) => commercialV2BehaviorActions.find((item) => item.id === id))
    .filter(Boolean)
    .map((action) => translatePixelAction(action, lang));
  const canEditLayout = !viewMode;
  const canRotateSelected = Boolean(canEditLayout && !groupEditMode && selectedItem && selectedAsset && selectedDirectionGroup);
  const normalizeRoomEditorLiveItem = useCallback((item) => {
    const asset = assetById.get(item?.assetId);
    return clampBox(normalizeRoomEditorItemAspect(item, asset), stageSize);
  }, [assetById, stageSize]);

  const commitItems = useCallback((updater) => {
    setItemsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const safeNext = Array.isArray(next)
        ? next.slice(0, roomEditorMaxSavedItems).map((item) => normalizeRoomEditorLiveItem(item))
        : prev;
      writeStoredRoomEditorSizeProfile(safeNext, assetById);
      itemsRef.current = safeNext;
      return safeNext;
    });
  }, [assetById, normalizeRoomEditorLiveItem]);

  useEffect(() => {
    commitItems((prev) => applyRoomEditorSizeProfileToItems(prev, assetById));
  }, [assetById, commitItems]);

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

  const queuePlayersRender = useCallback((nextPlayers, options = {}) => {
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
  }, [flushPendingPlayersRender]);

  const commitPlayers = useCallback((updater, options = {}) => {
    const currentPlayers = playersRef.current;
    const rawNext = typeof updater === 'function' ? updater(currentPlayers) : updater;
    const safeNext = normalizeRoomEditorPlayersSnapshot({
      players: rawNext,
      controlledPlayerId: controlledPlayerIdRef.current,
      scale: playerScaleRef.current
    }).players;
    playersRef.current = safeNext;
    queuePlayersRender(safeNext, options);
    return safeNext;
  }, [queuePlayersRender]);

  useEffect(() => () => {
    if (playerRenderFrameRef.current) {
      cancelAnimationFrame(playerRenderFrameRef.current);
      playerRenderFrameRef.current = 0;
    }
  }, []);

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

  const updateRoomPlayer = useCallback((playerId, updater) => {
    const character = commercialV2PlayerCharacterById.get(playerId);
    if (!character) return;
    commitPlayers((prev) => {
      const current = prev[playerId] || createRoomEditorPlayerState(character);
      const patch = typeof updater === 'function' ? updater(current) : updater;
      return {
        ...prev,
        [playerId]: normalizeRoomEditorPlayerState({ ...current, ...patch }, character)
      };
    });
  }, [commitPlayers]);

  const setPlayerById = useCallback((playerId, updater) => {
    updateRoomPlayer(playerId, updater);
  }, [updateRoomPlayer]);

  function setWorldPlayerBubble(playerId, text) {
    const safeText = String(text || '').trim().slice(0, 80);
    updateRoomPlayer(playerId, { bubble: safeText });
    if (playerId === controlledPlayerIdRef.current) {
      setPlayerActionBubble(safeText);
    }
  }

  useEffect(() => {
    commitItems((prev) => prev);
  }, [commitItems]);

  useEffect(() => {
    if (!behaviorInteractionState.nearby || activeBehaviorDialog) {
      setInteractionMenuOpen(false);
    }
  }, [activeBehaviorDialog, behaviorInteractionState.nearby]);

  useEffect(() => {
    if (!behaviorPlaceOptions.length) {
      setBehaviorPlaceId('');
      return;
    }
    if (behaviorPlaceId && behaviorPlaceOptions.some((option) => option.id === behaviorPlaceId)) return;
    const preferredTarget = behaviorPlaceOptions.find((option) => option.id.includes('bed'))
      || behaviorPlaceOptions.find((option) => option.id.includes('vanity'))
      || behaviorPlaceOptions[0];
    setBehaviorPlaceId(preferredTarget.id);
  }, [behaviorPlaceId, behaviorPlaceOptions]);

  useEffect(() => {
    setBehaviorTreeState((currentTree) => adaptRoomBehaviorTreeStateForPlaces(currentTree, behaviorOrderedPlaces));
  }, [behaviorOrderedPlaces]);

  useEffect(() => {
    try {
      localStorage.setItem(commercialV2BehaviorConfigStorageKey, JSON.stringify({
        api_endpoint: behaviorConfig.api_endpoint || '',
        model_name: behaviorConfig.model_name || '',
        context_q_limit: behaviorConfig.context_q_limit,
        context_summary_threshold: behaviorConfig.context_summary_threshold
      }));
    } catch {
      // The API key is intentionally never persisted here.
    }
  }, [behaviorConfig.api_endpoint, behaviorConfig.model_name, behaviorConfig.context_q_limit, behaviorConfig.context_summary_threshold]);

  useEffect(() => {
    behaviorTreeStateRef.current = behaviorTreeState;
  }, [behaviorTreeState]);

  useEffect(() => {
    try {
      localStorage.setItem(roomEditorBehaviorTreeStorageKey, JSON.stringify(behaviorTreeState));
    } catch {
      // The tree can still live in memory if browser storage is full or unavailable.
    }
  }, [behaviorTreeState]);

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
      if (!behaviorCharacterId || !behaviorOrderedPlaces.length) return;
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
    behaviorCharacterId,
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
    const pressedKeys = new Set();
    let animationFrame = 0;
    let lastTime = performance.now();
    const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
    const isTypingTarget = (target) => {
      const tag = String(target?.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
    };
    const tick = (time) => {
      const deltaSeconds = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
      lastTime = time;
      advanceBehaviorRuntimeRef.current();
      stepRoomBehaviorTravel(deltaSeconds);
      const playerId = controlledPlayerIdRef.current;
      const character = commercialV2PlayerCharacterById.get(playerId);
      if (character) {
        const current = playersRef.current[playerId] || createRoomEditorPlayerState(character);
        let dx = 0;
        let dy = 0;
        if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) dx -= 1;
        if (pressedKeys.has('d') || pressedKeys.has('arrowright')) dx += 1;
        if (pressedKeys.has('w') || pressedKeys.has('arrowup')) dy -= 1;
        if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) dy += 1;
        if (dx || dy) {
          const length = Math.hypot(dx, dy) || 1;
          const step = roomEditorPlayerMoveSpeed * deltaSeconds;
          const nextStepTime = (Number(current.stepTime) || 0) + deltaSeconds;
          const nextPoint = resolveRoomPlayerMovement(current, {
            x: current.x + (dx / length) * step,
            y: current.y + (dy / length) * step
          });
          const moved = Math.hypot(nextPoint.x - current.x, nextPoint.y - current.y) > 0.25;
          updateRoomPlayer(playerId, {
            x: nextPoint.x,
            y: nextPoint.y,
            direction: getRoomEditorDirectionFromDelta(dx, dy, current.direction),
            moving: moved,
            stepTime: moved ? nextStepTime : 0,
            frame: moved ? Math.floor(nextStepTime * 8) % commercialV2PlayerFrameOrder.length : 0
          });
        } else if (current.moving) {
          updateRoomPlayer(playerId, {
            moving: false,
            frame: 0,
            stepTime: 0
          });
        }
      }
      animationFrame = requestAnimationFrame(tick);
    };
    const onKeyDown = (event) => {
      const key = String(event.key || '').toLowerCase();
      if (!movementKeys.has(key) || isTypingTarget(event.target)) return;
      if (roomBehaviorTravelRef.current?.playerId === controlledPlayerIdRef.current) {
        roomBehaviorTravelRef.current = null;
      }
      pressedKeys.add(key);
      event.preventDefault();
    };
    const onKeyUp = (event) => {
      pressedKeys.delete(String(event.key || '').toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    animationFrame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(animationFrame);
    };
  }, [resolveRoomPlayerMovement, updateRoomPlayer]);

  useEffect(() => {
    const syncAgencyRoomLayout = (event) => {
      const normalized = normalizeRoomEditorLayoutState(event?.detail?.items || readStoredRoomEditorLayout().items);
      if (!normalized) return;
      commitItems(normalized.items);
      setSelectedId(event?.detail?.selectedId || normalized.selectedId || normalized.items[0]?.id || '');
      setNotice('已同步中介组装的样板间布局，并保存到当前房间。');
    };
    window.addEventListener(roomEditorLayoutUpdatedEvent, syncAgencyRoomLayout);
    return () => window.removeEventListener(roomEditorLayoutUpdatedEvent, syncAgencyRoomLayout);
  }, [commitItems]);

  function updateBehaviorConfig(patch) {
    setBehaviorConfig((current) => normalizeCommercialBehaviorConfig({
      ...current,
      ...patch
    }));
  }

  function resolveBehaviorAction(actionId = behaviorAction) {
    return commercialV2BehaviorActions.find((item) => item.id === actionId) || commercialV2BehaviorActions[0];
  }

  function resolveBehaviorPlace(placeId = behaviorPlaceId) {
    return behaviorPlaceOptions.find((option) => option.id === placeId)
      || behaviorPlaceOptions[0]
      || null;
  }

  function resolveBehaviorPlaceLink(placeOption) {
    if (!placeOption) return null;
    const targetId = String(placeOption.id || '');
    return behaviorPlaceLinks.find((place) => (
      place.placeId === targetId || place.locationId === targetId || place.locationIds?.includes(targetId)
    )) || null;
  }

  function getBehaviorUserDisplayName() {
    return String(userProfile?.name || '').trim() || '用户';
  }

  function summarizeBehaviorActor(actorId, label) {
    const character = commercialV2PlayerCharacterById.get(actorId) || commercialV2PlayerCharacters[0];
    const actor = playersRef.current[actorId] || createRoomEditorPlayerState(character);
    const isUserActor = actorId === commercialV2UserActorId;
    const displayName = isUserActor ? getBehaviorUserDisplayName() : character.label;
    return {
      id: actorId,
      label: isUserActor ? displayName : label,
      display_name: displayName,
      semantic_role: isUserActor ? 'player_user' : 'character_actor',
      sprite: character.label,
      direction: actor.direction,
      moving: Boolean(actor.moving),
      controlled: actorId === controlledPlayerIdRef.current,
      movement_mode: 'room_semantic'
    };
  }

  function summarizeBehaviorTreeForPayload(treeState = behaviorTreeState) {
    return buildBehaviorTreePayloadSummary(
      treeState,
      behaviorConfig,
      'room_runtime_single_character'
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
      scene: {
        type: 'room',
        id: 'pixel_room',
        label: '居住房间',
        runtime: 'single_character_room_runtime_v1',
        description: '当前角色和玩家正在像素小屋内部；行为树应围绕房间家具、站位锚点、靠近玩家和室内生活动作生成。'
      },
      world: {
        scene_type: 'room',
        scene_label: '居住房间',
        movement_model: 'room_semantic_v1',
        movement_rule: '角色可以决定自由活动、靠近玩家、闲逛或去房间家具锚点；不要生成像素坐标，前端会把 place_id 映射到当前房间家具或站位锚点。',
        ordered_place_text: behaviorOrderedPlaces.map((place) => `${place.order}. ${place.name}`).join(' -> '),
        allowed_place_ids: behaviorOrderedPlaces.map((place) => place.placeId),
        allowed_movement_actions: commercialV2BehaviorMovementActions,
        actors: {
          role: summarizeBehaviorActor(commercialV2RoleActorId, '角色小人'),
          user: summarizeBehaviorActor(commercialV2UserActorId, '玩家小人')
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
          'go_to_place: 前往表内家具或站位锚点',
          'wander_between: 在两个表内锚点之间来回闲逛',
          'loop_in_front_of: 在表内锚点前小范围循环移动',
          'browse_near: 在表内锚点附近停停走走',
          'patrol_segment: 在两个表内锚点之间巡逻',
          'approach_player: 靠近玩家',
          'follow_player: 跟随玩家',
          'walk_with_player: 陪玩家向表内锚点移动',
          'idle_at_place: 在表内锚点附近停留'
        ]
      },
      room_layout: {
        kind: 'pixel_room_ascii_layout_v1',
        unit: aiLayout.unit,
        room: aiLayout.room,
        current_ascii: aiLayout.currentAscii,
        furniture: aiLayout.furniture.map((item) => ({
          id: item.id,
          kind: item.kind,
          direction: item.direction,
          token: item.token,
          size: item.size,
          rules: item.rules,
          direction_options: item.directionOptions,
          grid_box: item.gridBox
        })),
        usage: '只用于理解当前房间和家具；行为树输出仍必须是 tree patch 或 base_branches，不要输出 PLACE 家具摆放行。'
      },
      behavior_context: buildCommercialBehaviorContextConfig(behaviorConfig),
      behavior_tree: summarizeBehaviorTreeForPayload(options.behaviorTreeState || behaviorTreeState)
    };
  }

  function buildBehaviorPendingInput(options = {}, note = '当前前端请求；服务端会重新补齐 large_input。') {
    return {
      ...buildBehaviorPayload(options),
      debug_source: 'client_pending_room_behavior_request',
      debug_note: note
    };
  }

  async function pullBehaviorModels() {
    const customEndpoint = String(behaviorConfig.api_endpoint || '').trim();
    const customKey = String(behaviorConfig.api_key || '').trim();
    const customComplete = Boolean(customEndpoint && customKey);
    const customIncomplete = Boolean(customEndpoint || customKey) && !customComplete;
    if (customIncomplete && !behaviorCharacterId) {
      const message = '自定义模型配置需要同时填写 URL 和 Key；当前也没有可用绑定角色。';
      setBehaviorModelStatus(message);
      setBehaviorStatus(message);
      return;
    }
    if (!customComplete && !behaviorCharacterId) {
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
        : `${apiUrl}/city/characters/${encodeURIComponent(behaviorCharacterId)}/behavior-models`;
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
    if (!behaviorCharacterId) {
      setBehaviorStatus('没有可用角色，先在角色设置里创建或启用一个角色。');
      return;
    }
    setBehaviorLoading(true);
    setBehaviorStatus('正在读取房间 AI 上文...');
    const requestPayload = buildBehaviorPayload();
    setBehaviorInput({
      ...requestPayload,
      debug_source: 'client_pending_room_behavior_input_request',
      debug_note: '正在请求服务端补齐 large_input。'
    });
    setBehaviorOutput(null);
    try {
      const response = await fetch(`${apiUrl}/city/characters/${encodeURIComponent(behaviorCharacterId)}/behavior-input`, {
        method: 'POST',
        headers: getBehaviorAuthHeaders(),
        body: JSON.stringify(requestPayload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `读取失败 ${response.status}`);
      setBehaviorInput(data.input || null);
      setBehaviorTreeState((currentTree) => mergeCommercialBehaviorIterationStateFromInput(currentTree, data.input));
      setBehaviorOutput(null);
      setBehaviorStatus('已读取房间 AI 上文；私聊和活动只作背景，不会直接触发房间小人行动。');
    } catch (error) {
      setBehaviorStatus(`房间 AI 上文读取失败：${error.message}`);
    } finally {
      setBehaviorLoading(false);
    }
  }

  async function generateBehaviorBranch(options = {}) {
    if (!behaviorCharacterId) {
      setBehaviorStatus('没有可用角色，先在角色设置里创建或启用一个角色。');
      return { ok: false, error: 'missing_character' };
    }
    const actionId = options.actionId || behaviorAction;
    const placeId = options.placeId || behaviorPlaceId;
    const selectedAction = resolveBehaviorAction(actionId);
    if (actionId !== behaviorAction) setBehaviorAction(actionId);
    if (placeId && placeId !== behaviorPlaceId) setBehaviorPlaceId(placeId);
    setBehaviorLoading(true);
    setBehaviorStatus('正在生成互动回应...');
    setWorldPlayerBubble(commercialV2UserActorId, selectedAction?.label || '互动');
    const requestPayload = buildBehaviorPayload({ actionId, placeId });
    setBehaviorInput(buildBehaviorPendingInput(
      { actionId, placeId },
      '当前点击选项产生的请求；服务端会重新补齐 large_input。'
    ));
    setBehaviorOutput(null);
    try {
      const { response, data } = await fetchBehaviorJsonWithTimeout(`${apiUrl}/city/characters/${encodeURIComponent(behaviorCharacterId)}/behavior-branch`, {
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
      setBehaviorStatus('AI patch 已合并进完整房间行为树。');
      return { ok: true, patchResult };
    } catch (error) {
      const message = formatBehaviorRequestError(error, '互动回应生成失败，请重试。');
      setBehaviorStatus(`互动回应生成失败：${message}`);
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
    if (!behaviorCharacterId) {
      setBehaviorStatus('没有可用角色，先在角色设置里创建或启用一个角色。');
      return;
    }
    setBehaviorLoading(true);
    setBehaviorStatus('正在生成房间行为枝丫池...基础枝丫和互动开场会一起生成，可能需要 1-2 分钟。');
    setBehaviorFoldOpen((current) => ({ ...current, runtime: true, debug: true }));
    const rebuildTree = adaptRoomBehaviorTreeStateForPlaces(
      createCommercialBehaviorTreeRebuildState(
        behaviorTreeStateRef.current || behaviorTreeState,
        'room_runtime_single_character'
      ),
      behaviorOrderedPlaces
    );
    const requestPayload = buildBehaviorPayload({ behaviorTreeState: rebuildTree });
    setBehaviorInput({
      ...requestPayload,
      debug_source: 'client_pending_room_behavior_base_request',
      debug_note: '当前房间日常行为整体重建请求；旧枝丫上下文已清空，服务端会重新补齐 large_input。'
    });
    setBehaviorOutput(null);
    try {
      const { response, data } = await fetchBehaviorJsonWithTimeout(`${apiUrl}/city/characters/${encodeURIComponent(behaviorCharacterId)}/behavior-base-branches`, {
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
      setBehaviorStatus(`AI 房间行为枝丫已加入：日常 ${baseBranchCount} 条，互动开场 ${interactionBranchCount} 条。`);
    } catch (error) {
      const message = formatBehaviorRequestError(error, '房间日常行为生成失败，请重试。');
      setBehaviorStatus(`房间日常行为生成失败：${message}`);
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
      behaviorCharacterId,
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
      behaviorCharacterId,
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
        && commercialBehaviorBranchMatchesOwner(branch, behaviorCharacterId)
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
    const selectedPlaceId = selectedPlace?.id || behaviorPlaceId || behaviorPlaceOptions[0]?.id || 'room-point:center';
    const selectedPlaceLabel = selectedPlace?.label || '房间';
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
      behaviorCharacterId
    );
    const presetBranch = generatedStarterBranch || createCommercialV2PresetInteractionBranch(
      actionId,
      selectedPlaceId,
      selectedPlaceLabel,
      { sceneType: 'room' }
    );
    setBehaviorInput(buildBehaviorPendingInput(
      { actionId, placeId: selectedPlaceId },
      generatedStarterBranch
        ? '当前行为树互动开场枝丫；末尾选项会用这个动作继续生成。'
        : '当前本地兜底互动请求；末尾选项会用这个动作继续生成。'
    ));
    executeBehaviorBranch(presetBranch, generatedStarterBranch?.source || 'preset');
    setWorldPlayerBubble(commercialV2UserActorId, selectedAction?.label || '互动');
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
    setBehaviorStatus(source === 'demo' ? '已把 demo patch 合并进完整房间行为树，并开始执行。' : '已重新合并当前输出 patch 并执行。');
  }

  function getBehaviorStepPlaceId(step) {
    return String(step?.place_id || step?.to_place_id || step?.target_place_id || step?.placeId || step?.toPlaceId || '').trim();
  }

  function isRoomTravelSegmentClear(fromPoint, toPoint) {
    if (!fromPoint || !toPoint) return false;
    const start = clampRoomEditorPlayer(fromPoint);
    const target = clampRoomEditorPlayer(toPoint);
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return !isRoomPlayerBlockedByItems(target.x, target.y);
    const steps = Math.max(1, Math.ceil(distance / 18));
    const startOverlap = getRoomPlayerCollisionOverlapArea(start.x, start.y);
    let previousOverlap = startOverlap;
    for (let index = 1; index <= steps; index += 1) {
      const ratio = index / steps;
      const sample = clampRoomEditorPlayer({
        ...start,
        x: start.x + dx * ratio,
        y: start.y + dy * ratio
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
      ...roomEditorBehaviorSafePoints
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
        { ...start, x: right, y: centerY }
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
      .sort((a, b) => (
        Math.hypot(a.x - start.x, a.y - start.y) + Math.hypot(a.x - target.x, a.y - target.y)
        - Math.hypot(b.x - start.x, b.y - start.y) - Math.hypot(b.x - target.x, b.y - target.y)
      ))
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
      y: Number.isFinite(toPoint.y) ? toPoint.y : fromPoint.y
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
      const isClear = fullPath.every((point, index) => (
        index === 0 || isRoomTravelSegmentClear(fullPath[index - 1], point)
      ));
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
    const midPoint = findSafeRoomPlayerPointNear(clampRoomEditorPlayer({
      ...fromPoint,
      x: fromPoint.x + dx * 0.5,
      y: laneY
    }), fromPoint);
    const alignedPoint = findSafeRoomPlayerPointNear(clampRoomEditorPlayer({
      ...fromPoint,
      x: safeTargetPoint.x,
      y: laneY
    }), fromPoint);
    return [midPoint, alignedPoint, safeTargetPoint];
  }

  function resolveRoomBehaviorTarget(targetId, currentPlayer) {
    const safeTargetId = String(targetId || '').trim();
    if (!safeTargetId) return null;
    const place = behaviorPlaceLinks.find((item) => (
      item.placeId === safeTargetId
      || item.locationId === safeTargetId
      || item.locationIds?.includes(safeTargetId)
    ));
    if (!place?.anchor) return null;
    const anchorPoint = clampRoomEditorPlayer({
      ...currentPlayer,
      x: Number(place.anchor.x),
      y: Number(place.anchor.y)
    });
    const point = findSafeRoomPlayerPointNear(anchorPoint, currentPlayer);
    const direction = place.facing || getRoomEditorDirectionFromDelta(point.x - currentPlayer.x, point.y - currentPlayer.y, currentPlayer.direction);
    return {
      targetId: place.placeId,
      label: place.name,
      point,
      anchorPoint,
      path: buildBehaviorSmoothTravelPath(currentPlayer, point),
      place: { facing: direction },
      action: place.kind || '房间行动',
      mode: 'roomBehavior'
    };
  }

  function activateBehaviorBranch(branch, source = 'ai') {
    if (!branch || !Array.isArray(branch.steps) || !branch.steps.length) return;
    const now = Date.now();
    roomBehaviorTravelRef.current = null;
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
    setWorldPlayerBubble(commercialV2RoleActorId, branch.title || branchKindLabel);
    setNotice(`${branchKindLabel}开始执行：${branch.title || branch.branch_id || '未命名'}。`);
  }

  function clearBehaviorRuntime(message = '') {
    behaviorRuntimeRef.current = null;
    roomBehaviorTravelRef.current = null;
    setActiveBehaviorBranch(null);
    setActiveBehaviorDialog((current) => current?.type === 'pending' ? current : null);
    setWorldPlayerBubble(commercialV2RoleActorId, '');
    if (message) setNotice(message);
  }

  function activateBehaviorTravelFailureBranch(details = {}) {
    const tree = behaviorTreeStateRef.current || behaviorTreeState || createCommercialV2BehaviorTreeState();
    const recoveryBranch = pickCommercialBehaviorBaseBranchByTrigger(
      tree,
      commercialV2BehaviorTravelFailureTrigger,
      behaviorOrderedPlaces.map((place) => place.placeId),
      behaviorCharacterId
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
    setPlayerById(commercialV2RoleActorId, (current) => ({
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
    const roleCharacter = commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
    const userCharacter = commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0];
    const role = playersRef.current[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
    const user = playersRef.current[commercialV2UserActorId] || createRoomEditorPlayerState(userCharacter);
    if ((action === 'approach_player' || action === 'follow_player' || action === 'walk_with_player') && !targetId) {
      const side = role.x <= user.x ? -1 : 1;
      const targetPoint = findSafeRoomPlayerPointNear(clampRoomEditorPlayer({
        ...role,
        x: user.x + side * commercialV2PlayerApproachGap,
        y: user.y
      }), role);
      const route = buildBehaviorSmoothTravelPath(role, targetPoint);
      if (!route.length) return false;
      const travelId = `${runtime.id}_step_${runtime.stepIndex}`;
      roomBehaviorTravelRef.current = {
        targetId: 'player',
        playerId: commercialV2RoleActorId,
        behaviorRuntimeId: runtime.id,
        behaviorTravelId: travelId,
        place: { facing: targetPoint.x < user.x ? 'right' : 'left' },
        point: route[route.length - 1],
        anchorPoint: targetPoint,
        path: route,
        pathIndex: 0,
        label: '玩家',
        action: action === 'follow_player' ? '跟随玩家' : action === 'walk_with_player' ? '陪你走' : '靠近玩家'
      };
      runtime.waitingForTravelId = travelId;
      setWorldPlayerBubble(commercialV2RoleActorId, action === 'follow_player' ? '跟上你' : '靠近你');
      return true;
    }
    if (!targetId && (action === 'wander_between' || action === 'patrol_segment')) {
      targetId = String(step?.to_place_id || step?.toPlaceId || step?.from_place_id || step?.fromPlaceId || '').trim();
    }
    if (!targetId) return false;
    const target = resolveRoomBehaviorTarget(targetId, role);
    if (!target) return false;
    const travelId = `${runtime.id}_step_${runtime.stepIndex}`;
    const route = target.path?.length ? target.path : [target.point];
    roomBehaviorTravelRef.current = {
      ...target,
      playerId: commercialV2RoleActorId,
      behaviorRuntimeId: runtime.id,
      behaviorTravelId: travelId,
      point: route[route.length - 1] || target.point,
      path: route,
      pathIndex: 0,
      action: step?.movement_style || target.action || '行动中'
    };
    runtime.waitingForTravelId = travelId;
    setWorldPlayerBubble(commercialV2RoleActorId, target.label ? `去 ${target.label}` : '行动中');
    return true;
  }

  function stepRoomBehaviorTravel(delta) {
    const travel = roomBehaviorTravelRef.current;
    if (!travel?.playerId) return;
    const travelCharacter = commercialV2PlayerCharacterById.get(travel.playerId) || commercialV2PlayerCharacters[0];
    const currentPlayer = playersRef.current[travel.playerId] || createRoomEditorPlayerState(travelCharacter);
    const path = travel.path?.length ? travel.path : [travel.point];
    let waypointIndex = Math.min(travel.pathIndex || 0, path.length - 1);
    let waypoint = path[waypointIndex] || travel.point;
    let targetDx = waypoint.x - currentPlayer.x;
    let targetDy = waypoint.y - currentPlayer.y;
    let distance = Math.hypot(targetDx, targetDy);
    const waypointReach = Math.max(5, commercialV2PathWaypointReach * 0.65);
    while (distance <= waypointReach && waypointIndex < path.length - 1) {
      waypointIndex += 1;
      travel.pathIndex = waypointIndex;
      waypoint = path[waypointIndex] || travel.point;
      targetDx = waypoint.x - currentPlayer.x;
      targetDy = waypoint.y - currentPlayer.y;
      distance = Math.hypot(targetDx, targetDy);
    }
    if (distance <= waypointReach) {
      roomBehaviorTravelRef.current = null;
      setWorldPlayerBubble(travel.playerId, travel.action);
      setNotice(`已到达 ${travel.label}，当前状态：${travel.action}。`);
      updateRoomPlayer(travel.playerId, (current) => ({
        ...current,
        x: waypoint.x,
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
    const direction = getRoomEditorDirectionFromDelta(normalizedX, normalizedY, currentPlayer.direction);
    const travelSpeed = travel.behaviorRuntimeId ? commercialV2BehaviorPlayerSpeed : roomEditorPlayerMoveSpeed;
    const frameRate = travel.behaviorRuntimeId ? 6 : 8;
    const stepDistance = Math.min(travelSpeed * delta, distance);
    const desiredPoint = clampRoomEditorPlayer({
      ...currentPlayer,
      x: currentPlayer.x + normalizedX * stepDistance,
      y: currentPlayer.y + normalizedY * stepDistance
    });
    const nextPoint = resolveRoomPlayerMovement(currentPlayer, desiredPoint);
    const moved = Math.hypot(nextPoint.x - currentPlayer.x, nextPoint.y - currentPlayer.y) > 0.25;
    const stepTime = currentPlayer.stepTime + delta;
    if (!moved) {
      travel.stuckTime = (travel.stuckTime || 0) + delta;
      const rerouteTarget = travel.anchorPoint || travel.point || waypoint;
      const reroute = travel.stuckTime > 0.2 && (travel.replanCount || 0) < 4
        ? buildBehaviorSmoothTravelPath(currentPlayer, rerouteTarget)
        : [];
      const usefulReroute = reroute.filter((point) => Math.hypot(point.x - currentPlayer.x, point.y - currentPlayer.y) > waypointReach);
      if (usefulReroute.length) {
        travel.path = usefulReroute;
        travel.point = usefulReroute[usefulReroute.length - 1] || travel.point;
        travel.pathIndex = 0;
        travel.stuckTime = 0;
        travel.replanCount = (travel.replanCount || 0) + 1;
        setWorldPlayerBubble(travel.playerId, '换条路');
        setNotice(`去 ${travel.label || '目标'} 的路被挡住了，正在绕开家具。`);
        return;
      }
      if (travel.stuckTime <= 0.8) {
        updateRoomPlayer(travel.playerId, {
          moving: false,
          frame: 0,
          stepTime: 0
        });
        return;
      }
      roomBehaviorTravelRef.current = null;
      if (travel.behaviorRuntimeId && activateBehaviorTravelFailureBranch({
        reason: 'travel_blocked',
        action: travel.action,
        targetLabel: travel.label
      })) return;
      setWorldPlayerBubble(travel.playerId, '绕不开');
      setNotice(`去 ${travel.label || '目标'} 的路被家具碰撞箱挡住了，先停在附近。`);
      updateRoomPlayer(travel.playerId, {
        moving: false,
        frame: 0,
        stepTime: 0
      });
      return;
    }
    travel.stuckTime = 0;
    updateRoomPlayer(travel.playerId, {
      x: nextPoint.x,
      y: nextPoint.y,
      direction,
      moving: true,
      stepTime,
      frame: Math.floor(stepTime * frameRate) % commercialV2PlayerFrameOrder.length
    });
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
      if (roomBehaviorTravelRef.current?.behaviorTravelId === runtime.waitingForTravelId) return;
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
        setWorldPlayerBubble(commercialV2RoleActorId, text);
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
      setWorldPlayerBubble(commercialV2RoleActorId, '');
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
      const roleCharacter = commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
      const userCharacter = commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0];
      const role = playersRef.current[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
      const user = playersRef.current[commercialV2UserActorId] || createRoomEditorPlayerState(userCharacter);
      const direction = getRoomEditorDirectionFromDelta(user.x - role.x, user.y - role.y, role.direction);
      setPlayerById(commercialV2RoleActorId, (current) => ({
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
        setWorldPlayerBubble(commercialV2RoleActorId, step.movement_style || action);
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
      setWorldPlayerBubble(commercialV2RoleActorId, '');
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

  function updateItem(id, patch) {
    if (!canEditLayout) return;
    const changesSize = Object.prototype.hasOwnProperty.call(patch || {}, 'w')
      || Object.prototype.hasOwnProperty.call(patch || {}, 'h');
    commitItems((prev) => {
      let changedItem = null;
      const nextItems = prev.map((item) => {
        if (item.id !== id) return item;
        const nextItem = { ...item, ...patch };
        const asset = assetById.get(nextItem.assetId || item.assetId);
        changedItem = clampBox(normalizeRoomEditorItemAspect(nextItem, asset), stageSize);
        return changedItem;
      });
      return changesSize && changedItem
        ? applyRoomEditorKindSizeToItems(nextItems, assetById, changedItem)
        : nextItems;
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
      groundLayer: asset.groundLayer === true ? true : undefined
    };
    const kind = getRoomEditorItemSizeKind(next, asset);
    const liveProfile = buildRoomEditorSizeProfile(items, assetById);
    const storedProfile = readStoredRoomEditorSizeProfile();
    const size = liveProfile[kind] || storedProfile[kind] || roomEditorCalibratedSizeProfile[kind];
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
      latestStageSize: stageSize
    };
  }

  function buildCanvasSnapshot() {
    const { latestItems, latestPlayers, latestControlledPlayerId, latestPlayerScale, latestStageSize } = getLatestLayoutParts();
    return {
      stage: stageSize,
      background: {
        type: 'room-backdrop',
        color: roomEditorBackgroundColor,
        image: roomEditorBackdrop
      },
      collision: {
        unit: 'ratio-of-item-box',
        mode: 'active',
        groundLayer: 'ignored'
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
          latestStageSize
        ),
        runtime_tree: behaviorTreeState
      }
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
      players: serializeRoomEditorPlayers(latestPlayers, latestControlledPlayerId, latestPlayerScale),
      sizeProfile: buildRoomEditorSizeProfile(serializedItems, assetById),
      items: serializedItems
    };
  }

  function saveLayout() {
    try {
      const snapshot = buildLayoutSnapshot();
      localStorage.setItem(roomEditorStorageKey, JSON.stringify(snapshot));
      localStorage.setItem(roomEditorSizeProfileStorageKey, JSON.stringify(buildRoomEditorSizeProfile(snapshot.items, assetById)));
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
      localStorage.setItem(roomEditorSizeProfileStorageKey, JSON.stringify(buildRoomEditorSizeProfile(snapshot.items, assetById)));
      localStorage.setItem(roomEditorPlayerStorageKey, JSON.stringify(snapshot.players));
      localStorage.setItem(roomEditorCanvasStorageKey, JSON.stringify(buildCanvasSnapshot()));
      setNotice(`已把当前 ${snapshot.items.length} 个房间素材和小人状态保存为默认场景。`);
    } catch (error) {
      console.error('[PixelWorld] Failed to save room default scene snapshot:', error);
      setNotice('保存默认场景失败：浏览器本地存储不可用或空间不足。');
    }
  }

  function applyLayoutSnapshot(snapshot, message = '已恢复上次房间布局。') {
    const normalized = normalizeRoomEditorLayoutState(snapshot?.items || []);
    if (!normalized) {
      setNotice('找到备份了，但里面没有可用的房间素材。');
      return;
    }
    try {
      const itemsToSave = normalized.items.map((item) => serializeRoomEditorItem(item, assetById.get(item.assetId)));
      localStorage.setItem(roomEditorStorageKey, JSON.stringify({
        selectedId: String(snapshot?.selectedId || normalized.items[0]?.id || ''),
        savedAt: Date.now(),
        sizeProfile: buildRoomEditorSizeProfile(itemsToSave, assetById),
        items: itemsToSave
      }));
      localStorage.setItem(roomEditorSizeProfileStorageKey, JSON.stringify(buildRoomEditorSizeProfile(itemsToSave, assetById)));
      if (snapshot?.players) {
        const nextPlayers = normalizeRoomEditorPlayersSnapshot(snapshot.players);
        playersRef.current = nextPlayers.players;
        controlledPlayerIdRef.current = nextPlayers.controlledPlayerId;
        playerScaleRef.current = nextPlayers.scale;
        queuePlayersRender(nextPlayers.players, { immediate: true });
        setControlledPlayerIdState(nextPlayers.controlledPlayerId);
        setPlayerScaleState(nextPlayers.scale);
        localStorage.setItem(roomEditorPlayerStorageKey, JSON.stringify(serializeRoomEditorPlayers(
          nextPlayers.players,
          nextPlayers.controlledPlayerId,
          nextPlayers.scale
        )));
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
    localStorage.removeItem(roomEditorSizeProfileStorageKey);
    localStorage.removeItem(roomEditorPlayerStorageKey);
    localStorage.removeItem(roomEditorCanvasStorageKey);
    setNotice(defaultLayout.savedAt
      ? '已恢复为你保存的房间默认场景，小人也回到房间初始点；误点的话可以点“恢复上次布局”。'
      : '已恢复为空房间素材层，小人回到房间初始点；小屋底图会保留为画布背景。');
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
      setNotice('AI 布局上下文已复制：里面包含房间 ASCII 和当前家具格子尺寸。');
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
    if (!canEditLayout || !layoutBounds) return;
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
      collision: getRoomEditorDefaultCollision(nextAsset)
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
    setNotice(enabled
      ? '已切到地面层：碰撞箱会保留，但不会阻挡人物或后续寻路。'
      : '已切回普通素材：碰撞箱会正常参与阻挡。');
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
        ...normalizeCommercialV2Collision(selectedItem.collision || getRoomEditorDefaultCollision(selectedAsset), selectedAsset),
        enabled
      }
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
    if (!canEditLayout || !selectedItem || !selectedAsset) return;
    if (!selectedCollisionCanTakeEffect) {
      setShowCollisionLines(true);
      setNotice('地面层规则已生效：这个实例的碰撞箱不会阻挡人物。');
      return;
    }
    setShowCollisionLines(true);
    updateItem(selectedItem.id, {
      collision: getRoomEditorDefaultCollision(selectedAsset)
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
      collision: normalizeCommercialV2Collision({ enabled: true, x: 0, y: 0, w: 1, h: 1 }, selectedAsset)
    });
  }

  function updatePlaceAnchorFromLocalPoint(item, localPoint) {
    if (!item?.w || !item?.h) return;
    updateItem(item.id, {
      placeAnchor: normalizeCommercialV2PlaceAnchor({
        x: (Number(localPoint.x) || 0) / item.w,
        y: (Number(localPoint.y) || 0) / item.h
      })
    });
  }

  function updateSelectedPlaceAnchorLocalPoint(key, value) {
    if (!canEditLayout || !selectedItem || !selectedPlaceAnchorLocalPoint) return;
    setShowPlaceAnchors(true);
    updatePlaceAnchorFromLocalPoint(selectedItem, {
      ...selectedPlaceAnchorLocalPoint,
      [key]: Math.round(Number(value) || 0)
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
        h: collision.h * item.h
      }
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
        y: place.anchor.y - item.y
      }
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

  function focusCanvasForKeyboard(event) {
    event.currentTarget.focus({ preventScroll: true });
  }

  function toggleViewMode() {
    setViewMode((value) => {
      const next = !value;
      if (next) setSelectedId('');
      setNotice(next
        ? '观赏模式已开启：房间素材已锁定。'
        : '编辑模式已开启：可以移动、缩放、调碰撞箱和锚点。');
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
      zIndex
    };
  }

  function renderRoomEditorItem(item, asset, layerIndex) {
    const collision = getCommercialV2EffectiveCollision(item, asset);
    const isSelected = canEditLayout && selectedId === item.id;
    const canEditCollisionBox = showCollisionLines && isSelected && !groupEditMode;
    const collisionHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    return (
      <button
        key={item.id}
        type="button"
        className={`pixel-world-editor-item ${isSelected ? 'selected' : ''} ${canEditLayout && groupEditMode ? 'group-bound' : ''}`}
        style={getItemStyle(item, getRoomEditorItemRenderZIndex(item, asset, layerIndex))}
        onPointerDown={(event) => onPointerDown(event, item)}
        onClick={() => {
          if (canEditLayout) setSelectedId(item.id);
        }}
        title={asset.name}
      >
        <img src={roomEditorAsset(asset.path)} alt="" draggable={false} />
        {showLayerPanel && (
          <span className={`pixel-world-layer-badge ${item.groundLayer ? 'ground' : 'asset'}`}>
            {layerIndex + 1}
          </span>
        )}
        {showCollisionLines && collision.enabled && (
          <span
            className={`pixel-world-collision-box ${isSelected ? 'selected' : ''} ${canEditCollisionBox ? 'editable' : ''}`}
            onPointerDown={canEditCollisionBox
              ? (event) => onCollisionPointerDown(event, item, asset, 'move')
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
                onPointerDown={(event) => onCollisionPointerDown(event, item, asset, handle)}
              />
            ))}
          </span>
        )}
      </button>
    );
  }

  function renderRoomPlaceAnchor(item, asset, layerIndex) {
    const place = buildRoomEditorItemAnchor(item, asset);
    if (!place) return null;
    const isSelected = canEditLayout && selectedId === item.id;
    const canEditPlaceAnchor = isSelected && !groupEditMode;
    return (
      <span
        key={`${item.id}-place-anchor`}
        className={`pixel-world-place-anchor ${isSelected ? 'selected' : ''} ${canEditPlaceAnchor ? 'editable' : ''} ${place.manualAnchor ? 'manual' : ''}`}
        onPointerDown={canEditPlaceAnchor
          ? (event) => onPlaceAnchorPointerDown(event, item, asset)
          : undefined}
        style={{
          left: `${(place.anchor.x / stageSize.width) * 100}%`,
          top: `${(place.anchor.y / stageSize.height) * 100}%`,
          zIndex: roomEditorOverlayZIndex + layerIndex
        }}
        title={tx(`${ptxt(place.name)} anchor`, `${place.name} 锚点`)}
      >
        <span>{place.name}</span>
      </span>
    );
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
          disabled={behaviorLoading || !behaviorCharacterId}
        >
          <strong>{behaviorLoading ? tx('Generating', '生成中') : tx('Interact', '互动')}</strong>
          <span>{behaviorCharacter?.name || tx('Character', '角色')}</span>
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
          <strong>{behaviorCharacter?.name || tx('Character', '角色')}</strong>
          <button
            type="button"
            className="pixel-world-interaction-close"
            onClick={() => setInteractionMenuOpen(false)}
          >
            {tx('Collapse', '收起')}
          </button>
        </div>
        <div className="pixel-world-interaction-menu-primary">
          {behaviorPrimaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={behaviorAction === action.id ? 'active' : ''}
              disabled={behaviorLoading || !behaviorCharacterId}
              title={action.hint}
              onClick={() => runPlayerInteraction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="pixel-world-interaction-menu-target">
          <span>{tx('Destination', '目的地')}</span>
          <select
            value={behaviorPlaceId}
            onChange={(event) => setBehaviorPlaceId(event.target.value)}
            disabled={behaviorLoading || !behaviorPlaceOptions.length}
            aria-label={tx('Interaction destination', '互动目的地')}
          >
            {behaviorPlaceOptions.length ? behaviorPlaceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.order ? `${option.order}. ` : ''}{option.label}
              </option>
            )) : (
              <option value="">{tx('No places', '暂无地点')}</option>
            )}
          </select>
        </div>
        <div className="pixel-world-interaction-menu-context">
          {behaviorContextActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={behaviorAction === action.id ? 'active' : ''}
              disabled={behaviorLoading || !behaviorCharacterId}
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
    const actor = players[actorId] || createRoomEditorPlayerState(character);
    return (
      <div className={`pixel-world-behavior-actor ${actorId === commercialV2RoleActorId ? 'role' : 'user'}`}>
        <img src={commercialV2PlayerFrame(actor, `${actor.direction || 'front'}_walk_idle.png`)} alt="" draggable={false} />
        <div>
          <strong>{ptxt(title)}</strong>
          <span>{ptxt(character.label)} · {tx('Room semantic movement', '房间语义移动')}</span>
          <small>{ptxt(note)}</small>
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
          <span>{ptxt(title)}</span>
          {summary && <small>{ptxt(summary)}</small>}
          <strong>{open ? tx('Collapse', '收起') : tx('Expand', '展开')}</strong>
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
    const behaviorPanelStateLabel = behaviorOutput?.error
      ? 'Error'
      : (behaviorOutput?.fallback ? 'Fallback' : behaviorOutput ? 'AI' : 'Draft');
    if (behaviorPanelCollapsed) {
      return (
        <aside className="pixel-world-behavior-panel collapsed">
          <button
            type="button"
            className="pixel-world-behavior-panel-expand"
            onClick={() => setBehaviorPanelCollapsed(false)}
            title={tx('Expand behavior-tree panel', '展开行为树面板')}
            aria-label={tx('Expand behavior-tree panel', '展开行为树面板')}
          >
            <span>{tx('Behavior Tree', '行为树')}</span>
            <strong>{behaviorPanelStateLabel}</strong>
            <small>{tx('Expand', '展开')}</small>
          </button>
        </aside>
      );
    }

    return (
      <aside className="pixel-world-behavior-panel room-behavior-panel">
        <div className="pixel-world-behavior-head">
          <div>
            <h3>{tx('Room Behavior Tree V1', '房间行为树 V1')}</h3>
            <span>{tx('Shared full behavior tree / room-anchor runtime', '通用完整行为树 / 房间锚点运行时')}</span>
          </div>
          <div className="pixel-world-behavior-head-actions">
            <strong>{behaviorPanelStateLabel}</strong>
            <button
              type="button"
              onClick={() => setBehaviorPanelCollapsed(true)}
              title={tx('Collapse the full behavior-tree panel', '收起整个行为树面板')}
            >
              {tx('Collapse', '收起')}
            </button>
          </div>
        </div>

        <div className="pixel-world-behavior-actors">
          {renderBehaviorActorCard(commercialV2RoleActorId, '角色小人', behaviorCharacter?.name ? `绑定：${behaviorCharacter.name}` : '等待绑定角色')}
          {renderBehaviorActorCard(commercialV2UserActorId, '玩家小人', userProfile?.name ? `玩家：${userProfile.name}` : '玩家控制入口')}
        </div>

        <label className="pixel-world-behavior-field">
          <span>{tx('Bound Character', '绑定角色')}</span>
          <select
            value={behaviorCharacterId}
            onChange={(event) => setBehaviorCharacterId(event.target.value)}
            disabled={!behaviorCharacters.length}
          >
            {behaviorCharacters.length ? behaviorCharacters.map((item) => (
              <option key={item.id} value={item.id}>{item.name || item.id}</option>
            )) : (
              <option value="">{tx('No characters', '暂无角色')}</option>
            )}
          </select>
        </label>

        {renderBehaviorFold(
          'model',
          tx('Model Config', '模型配置'),
          behaviorConfig.model_name || behaviorCharacter?.model_name || tx('Use Bound Character', '使用绑定角色'),
          (
            <div className="pixel-world-behavior-model-grid">
              <label className="pixel-world-behavior-field">
                <span>URL</span>
                <input
                  value={behaviorConfig.api_endpoint}
                  onChange={(event) => updateBehaviorConfig({ api_endpoint: event.target.value })}
                  placeholder={behaviorCharacter?.api_endpoint ? tx('Leave empty to use bound character URL', '留空使用绑定角色 URL') : 'https://api.example.com/v1'}
                />
              </label>
              <label className="pixel-world-behavior-field">
                <span>{tx('Key', '密钥')}</span>
                <input
                  type={behaviorShowKey ? 'text' : 'password'}
                  value={behaviorConfig.api_key}
                  onChange={(event) => updateBehaviorConfig({ api_key: event.target.value })}
                  placeholder={tx('Leave empty to use bound character Key', '留空使用绑定角色 Key')}
                />
              </label>
              <label className="pixel-world-behavior-field">
                <span>{tx('Model', '模型')}</span>
                <input
                  list="pixel-world-room-behavior-models"
                  value={behaviorConfig.model_name}
                  onChange={(event) => updateBehaviorConfig({ model_name: event.target.value })}
                  placeholder={behaviorCharacter?.model_name || tx('Model Name', '模型名')}
                />
                <datalist id="pixel-world-room-behavior-models">
                  {behaviorModelOptions.map((model) => <option key={model} value={model} />)}
                </datalist>
              </label>
              <div className="pixel-world-behavior-model-actions">
                <button type="button" onClick={pullBehaviorModels} disabled={behaviorModelsLoading}>
                  {behaviorModelsLoading ? tx('Loading', '拉取中') : tx('Fetch Models', '拉取模型')}
                </button>
                <button type="button" onClick={() => setBehaviorShowKey((value) => !value)}>
                  {behaviorShowKey ? tx('Hide Key', '隐藏 Key') : tx('Show Key', '显示 Key')}
                </button>
              </div>
              <div className={`pixel-world-behavior-model-status ${behaviorModelStatus.includes('失败') ? 'error' : ''}`}>
                {ptxt(behaviorModelStatus)}
              </div>
              {behaviorModelOptions.length > 0 && (
                <div className="pixel-world-behavior-model-list">
                  <div className="pixel-world-behavior-model-list-head">
                    <strong>{tx('Model List', '模型列表')}</strong>
                    <span>{tx(`${behaviorModelOptions.length} models`, `${behaviorModelOptions.length} 个`)}</span>
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
          tx('Branch Context', '枝丫上下文'),
          `q ${behaviorConfig.context_q_limit} / p ${behaviorConfig.context_summary_threshold}`,
          (
            <div className="pixel-world-behavior-context-grid">
              <label className="pixel-world-behavior-field">
                <span>q {tx('Raw Window', '原文窗口')}</span>
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
                <small>{tx('Live input reads at most q raw branches.', '实时输入最多读取 q 条枝丫原文。')}</small>
              </label>
              <label className="pixel-world-behavior-field">
                <span>p {tx('Summary Threshold', '摘要阈值')}</span>
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
                <small>{tx('When unsummarized branches outside the q window reach p, a small model summarizes them before generation; failure stops this round.', 'q 窗口外未摘要枝丫积攒到 p 条时，生成前先用小模型总结；失败会中止本轮。')}</small>
              </label>
              <div className="pixel-world-behavior-context-stats">
                {tx('Summary backlog:', '摘要积攒：')}
                <strong>{behaviorContextStats.pending_summary_count} / {behaviorContextStats.p_summary_threshold}</strong>
                {tx(' items pending summary, currently reading ', '条待总结，当前读取 ')}{behaviorContextStats.active_summary_count}{tx(' summary rounds.', ' 轮摘要。')}
                <span>{tx('Raw', '原文')} {behaviorContextStats.raw_readable_count} / {behaviorContextStats.q_raw_limit}</span>
              </div>
            </div>
          )
        )}

        {renderBehaviorFold(
          'constraints',
          tx('AI Allowlist', 'AI 可选白名单'),
          tx(`${behaviorOrderedPlaces.length} anchors / ${commercialV2BehaviorMovementActions.length} movement actions`, `${behaviorOrderedPlaces.length} 锚点 / ${commercialV2BehaviorMovementActions.length} 移动动作`),
          (
            <div className="pixel-world-behavior-constraints">
              <div>
                <strong>{tx('Room Anchors', '房间锚点')}</strong>
                <div className="pixel-world-behavior-chip-list">
                  {behaviorOrderedPlaces.map((place) => (
                    <span key={place.placeId}>{place.order}. {ptxt(place.name)}</span>
                  ))}
                </div>
              </div>
              <div>
                <strong>{tx('Movement Actions', '移动动作')}</strong>
                <div className="pixel-world-behavior-chip-list">
                  {commercialV2BehaviorMovementActions.map((action) => (
                    <span key={action.id}>{translatePixelAction(action, lang).label}</span>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {renderBehaviorFold(
          'branchMap',
          tx('Behavior Layers', '行为分层'),
          tx('Daily behavior / Interaction response', '日常行为 / 互动回应'),
          (
            <div className="pixel-world-behavior-branch-map">
              <div>
                <strong>{tx('Interaction Response', '互动回应')}</strong>
                <span>{tx('player_interaction: after the player clicks interact or chooses a reply, AI writes the new interaction behavior here.', 'player_interaction · 玩家点击互动或选择回应后，AI 会把新的互动行为写到这里。')}</span>
              </div>
              <div>
                <strong>{tx('Daily Behavior', '日常行为')}</strong>
                <span>{tx('Auto-polled without interaction: hard needs, local routine, anchor capability, background mood, curiosity, free movement, and micro-actions.', '无互动时自动轮询：硬需求、本地例行、锚点能力、背景情绪、好奇、自由活动、微动作。')}</span>
              </div>
            </div>
          )
        )}

        {renderBehaviorFold(
          'interaction',
          tx('Interaction Settings', '互动设置'),
          behaviorInteractionState.nearby ? tx(`Distance ${Math.round(behaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}`, `距离 ${Math.round(behaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}`) : tx('Menu appears when nearby', '靠近后弹出菜单'),
          (
            <>
              <div className={`pixel-world-behavior-proximity ${behaviorInteractionState.nearby ? 'nearby' : ''}`}>
                <strong>{behaviorInteractionState.nearby ? tx('Character is in interaction range', '角色已在互动范围') : tx('Menu appears when the player approaches', '玩家靠近角色后弹出菜单')}</strong>
                <span>{tx('Distance', '距离')} {Math.round(behaviorInteractionState.distance)} / {commercialV2BehaviorInteractionDistance}</span>
              </div>

              <label className="pixel-world-behavior-field">
                <span>{tx('Target Anchor', '目标锚点')}</span>
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
                    <option value="">{tx('No anchors', '暂无锚点')}</option>
                  )}
                </select>
              </label>
              <label className="pixel-world-behavior-field">
                <span>{tx('Extra Input', '补充输入')}</span>
                <textarea
                  value={behaviorPromptText}
                  onChange={(event) => setBehaviorPromptText(event.target.value)}
                  placeholder={tx('Example: the player wants the character to sit near the bed with them, but the character should still react naturally.', '例如：玩家想让角色陪自己去床边坐一下，但角色要有一点临场反应。')}
                />
              </label>

              <div className="pixel-world-behavior-run-row">
                <button
                  type="button"
                  onClick={requestBehaviorInput}
                  disabled={behaviorLoading || !behaviorCharacterId}
                  title={tx('Assemble character memory, current room, furniture, and anchor allowlist to inspect the AI context.', '整理角色记忆、当前房间、家具和锚点白名单，查看 AI 实际会收到的上文。')}
                >
                  {tx('Read AI Context', '读取 AI 上文')}
                </button>
                <button
                  type="button"
                  onClick={generateBaseBehaviorBranches}
                  disabled={behaviorLoading || !behaviorCharacterId}
                  title={tx('Let AI generate a room daily-action pool for automatic polling when nobody interacts.', '让 AI 生成无人互动时会自动轮询的房间日常行动池。')}
                >
                  {tx('Generate Branches', '生成行为枝丫')}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={generateBehaviorBranch}
                  disabled={behaviorLoading || !behaviorCharacterId}
                  title={tx('Generate the next interaction response from the current player action, target furniture anchor, and extra input.', '根据当前玩家动作、目标家具锚点和补充输入，生成下一段互动回应。')}
                >
                  {tx('Generate Response', '生成互动回应')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const branch = pickAutonomousBehaviorBranch();
                    if (!branch) {
                      setBehaviorStatus('当前没有可试跑的日常行为，先确认房间锚点白名单是否存在，或先生成行为枝丫。');
                      return;
                    }
                    autonomousBehaviorCooldownRef.current = Date.now() + commercialV2BehaviorAutonomousCooldownMs;
                    activateBehaviorBranch(branch, 'base');
                    setBehaviorStatus(`已试跑日常行为：${branch.title}`);
                  }}
                  disabled={behaviorLoading || !behaviorCharacterId}
                  title={tx('Pick one generated daily action and run it immediately.', '从已生成的日常行动池中挑一条立刻执行。')}
                >
                  {tx('Run Daily Behavior', '试跑日常行为')}
                </button>
                <button
                  type="button"
                  onClick={() => executeBehaviorBranch(behaviorOutput?.branch, 'replay')}
                  disabled={behaviorLoading || !behaviorOutput?.branch}
                  title={tx('Replay the last AI-generated interaction behavior.', '重新执行上一次 AI 生成的互动行为。')}
                >
                  {tx('Replay Current Behavior', '重跑当前行为')}
                </button>
                <button
                  type="button"
                  onClick={() => executeBehaviorBranch(commercialV2BehaviorLastDemoBranch, 'demo')}
                  disabled={behaviorLoading}
                  title={tx('Load the built-in example to quickly test the behavior-tree dialogue flow.', '载入内置示例，用来快速测试行为树对话流程。')}
                >
                  {tx('Run Example', '运行示例互动')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const resetTree = createCommercialV2BehaviorTreeState();
                    setBehaviorTreeState({
                      ...resetTree,
                      tree_id: 'room_runtime_single_character'
                    });
                    setBehaviorPatchOutput(null);
                    setBehaviorStatus('完整房间行为树已重置。');
                  }}
                  disabled={behaviorLoading}
                  title={tx('Clear generated behavior nodes and restore the default behavior tree.', '清空已生成的行为节点，恢复默认行为树。')}
                >
                  {tx('Clear Behavior Tree', '清空行为树')}
                </button>
              </div>
            </>
          )
        )}

        {renderBehaviorFold(
          'runtime',
          tx('Runtime', '运行状态'),
          activeBehaviorBranch ? ptxt(activeBehaviorBranch.title) : tx(`Version ${behaviorTreeState.version} · patch ${behaviorTreeState.patch_history?.length || 0}`, `版本 ${behaviorTreeState.version} · patch ${behaviorTreeState.patch_history?.length || 0}`),
          (
            <>
              <div className="pixel-world-behavior-status">{behaviorLoading ? tx('Processing...', '处理中...') : ptxt(behaviorStatus)}</div>
              <div className={`pixel-world-behavior-runtime ${activeBehaviorBranch ? 'active' : ''}`}>
                {activeBehaviorBranch ? (
                  <>
                    <strong>{ptxt(activeBehaviorBranch.branchKindLabel || '完整树运行节点')}</strong>
                    <span>{ptxt(activeBehaviorBranch.title)}</span>
                    <small>
                      {Math.min((activeBehaviorBranch.stepIndex || 0) + 1, activeBehaviorBranch.totalSteps || 1)}
                      /{activeBehaviorBranch.totalSteps || 1}
                      {activeBehaviorBranch.currentAction ? ` · ${activeBehaviorBranch.currentAction}` : ''}
                      {behaviorTreeState?.active_node_id ? ` · node:${behaviorTreeState.active_node_id}` : ''}
                    </small>
                    {activeBehaviorDialog && (
                      <div className="pixel-world-behavior-runtime-control">
                        <strong>{activeBehaviorDialog.type === 'choice' ? tx('Waiting for player choice', '等待玩家选择') : tx('Waiting for next line', '等待点击下一句')}</strong>
                        <p>{activeBehaviorDialog.text}</p>
                        {activeBehaviorDialog.type === 'pending' ? (
                          <button type="button" disabled>{tx('Generating...', '生成中...')}</button>
                        ) : activeBehaviorDialog.type === 'choice' && activeBehaviorDialog.choices?.length ? (
                          <div className="pixel-world-behavior-runtime-choice-grid">
                            {activeBehaviorDialog.choices.map((choice) => (
                              <button
                                key={choice.id}
                                type="button"
                                onClick={() => chooseBehaviorDialogChoice(choice)}
                                disabled={behaviorLoading}
                              >
                                {ptxt(choice.label)}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="pixel-world-behavior-dialog-exit"
                              onClick={exitBehaviorDialog}
                              disabled={behaviorLoading}
                            >
                              {tx('Exit Dialog', '退出对话')}
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={continueBehaviorDialog}>{tx('Next Line', '下一句')}</button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <strong>{tx('Full Behavior Tree', '完整行为树')}</strong>
                    <span>{tx('Version', '版本')} {behaviorTreeState.version} · patch {behaviorTreeState.patch_history?.length || 0}</span>
                    <small>{tx('Daily behavior is auto-polled; player interaction generates and immediately runs an interaction response.', '日常行为会自动轮询；玩家互动会生成互动回应并立即执行。')}</small>
                  </>
                )}
              </div>
            </>
          )
        )}

        {renderBehaviorFold(
          'debug',
          tx('Debug JSON', '调试 JSON'),
          tx('Full Tree / Input / Patch / Output', '完整树 / 输入 / Patch / 输出'),
          (
            <div className="pixel-world-behavior-json-grid">
              <section>
                <h4>{tx('Full Tree', '完整树')}</h4>
                <pre>{formatBehaviorJson(behaviorTreeState)}</pre>
              </section>
              <section>
                <h4>{tx('Input', '输入')}</h4>
                <pre>{formatBehaviorJson(behaviorInput || buildBehaviorPayload())}</pre>
              </section>
              <section>
                <h4>{tx('Patch', '补丁')}</h4>
                <pre>{formatBehaviorJson(behaviorPatchOutput || { patch: null, note: tx('The local behavior-tree patch for this generation appears here.', '生成后显示本次局部行为树 patch。') })}</pre>
              </section>
              <section>
                <h4>{tx('Output', '输出')}</h4>
                <pre>{formatBehaviorJson(behaviorOutput || { base_branches: null, interaction_branches: null, branch: null, tree_patch: null, note: tx('Click Generate Branches to show the auto-action pool and interaction opener pool. The interact button first runs an opener in player_interaction, and choices continue generating responses.', '点击“生成行为枝丫”会显示自动行动池和互动开场池；互动按钮会先执行 player_interaction 里的开场枝丫，选项会继续生成互动回应。') })}</pre>
              </section>
              <section>
                <h4>{tx('Selection', '选中')}</h4>
                <pre>{formatBehaviorJson(selectedItem && selectedAsset ? {
                  asset_id: selectedItem.assetId,
                  name: selectedAsset.name,
                  box: {
                    x: Math.round(selectedItem.x),
                    y: Math.round(selectedItem.y),
                    w: Math.round(selectedItem.w),
                    h: Math.round(selectedItem.h)
                  },
                  ground_layer: Boolean(selectedItem.groundLayer),
                  place_anchor: selectedPlaceAnchorLocalPoint
                } : {
                  selected: null,
                  note: tx('No selected room asset.', '当前没有选中房间素材。')
                })}</pre>
              </section>
              <section>
                <h4>{tx('AI Layout Context', 'AI 布局上下文')}</h4>
                <pre>{aiLayoutPrompt}</pre>
              </section>
              <section>
                <h4>{tx('Layout JSON', '布局 JSON')}</h4>
                <pre>{layoutJson}</pre>
              </section>
            </div>
          )
        )}
      </aside>
    );
  }

  function faceRoomPlayers() {
    commitPlayers((prev) => {
      const roleCharacter = commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
      const userCharacter = commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0];
      const currentRole = prev[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
      const currentUser = prev[commercialV2UserActorId] || createRoomEditorPlayerState(userCharacter);
      return {
        ...prev,
        [commercialV2RoleActorId]: normalizeRoomEditorPlayerState({
          ...currentRole,
          direction: getRoomEditorDirectionFromDelta(currentUser.x - currentRole.x, currentUser.y - currentRole.y, currentRole.direction),
          moving: false,
          frame: 0,
          stepTime: 0,
          bubble: '我看着你。'
        }, roleCharacter),
        [commercialV2UserActorId]: normalizeRoomEditorPlayerState({
          ...currentUser,
          direction: getRoomEditorDirectionFromDelta(currentRole.x - currentUser.x, currentRole.y - currentUser.y, currentUser.direction),
          moving: false,
          frame: 0,
          stepTime: 0
        }, userCharacter)
      };
    });
    setRoomBehaviorStatus('已执行房间行为：两位小人面对彼此。');
  }

  function approachRoomPlayer() {
    commitPlayers((prev) => {
      const roleCharacter = commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
      const userCharacter = commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0];
      const currentRole = prev[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
      const currentUser = prev[commercialV2UserActorId] || createRoomEditorPlayerState(userCharacter);
      const side = currentUser.x > stageSize.width / 2 ? -commercialV2PlayerApproachGap : commercialV2PlayerApproachGap;
      const safePoint = findSafeRoomPlayerPointNear(clampRoomEditorPlayer({
        ...currentRole,
        x: currentUser.x + side,
        y: currentUser.y
      }), currentRole);
      const nextRole = clampRoomEditorPlayer({
        ...currentRole,
        ...safePoint,
        direction: side < 0 ? 'right' : 'left',
        moving: false,
        frame: 0,
        stepTime: 0,
        bubble: '我过来了。'
      });
      return {
        ...prev,
        [commercialV2RoleActorId]: normalizeRoomEditorPlayerState(nextRole, roleCharacter),
        [commercialV2UserActorId]: normalizeRoomEditorPlayerState({
          ...currentUser,
          direction: getRoomEditorDirectionFromDelta(nextRole.x - currentUser.x, nextRole.y - currentUser.y, currentUser.direction),
          moving: false,
          frame: 0,
          stepTime: 0
        }, userCharacter)
      };
    });
    setRoomBehaviorStatus('已执行房间行为：角色靠近玩家，距离进入互动阈值。');
  }

  function wanderRoomPlayer() {
    const point = roomEditorBehaviorSafePoints[roomBehaviorStepRef.current % roomEditorBehaviorSafePoints.length];
    roomBehaviorStepRef.current += 1;
    const roleCharacter = commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
    const currentRole = playersRef.current[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
    const safePoint = findSafeRoomPlayerPointNear(point, currentRole);
    updateRoomPlayer(commercialV2RoleActorId, {
      x: safePoint.x,
      y: safePoint.y,
      direction: point.direction,
      moving: false,
      frame: 0,
      stepTime: 0,
      bubble: `走到${point.label}`
    });
    setRoomBehaviorStatus(`已执行房间行为：角色移动到${point.label}。`);
  }

  function clearRoomPlayerBubbles() {
    commitPlayers((prev) => Object.fromEntries(
      commercialV2PlayerCharacters.map((character) => {
        const current = prev[character.id] || createRoomEditorPlayerState(character);
        return [character.id, normalizeRoomEditorPlayerState({ ...current, bubble: '' }, character)];
      })
    ));
    setRoomBehaviorStatus('已清空房间小人的动作气泡。');
  }

  function resetRoomPlayers() {
    const nextPlayers = Object.fromEntries(commercialV2PlayerCharacters.map((character) => {
      const initial = createRoomEditorPlayerState(character);
      const safePoint = findSafeRoomPlayerPointNear(initial, initial);
      return [character.id, normalizeRoomEditorPlayerState({ ...initial, ...safePoint }, character)];
    }));
    playersRef.current = nextPlayers;
    controlledPlayerIdRef.current = commercialV2DefaultControlledPlayerId;
    playerScaleRef.current = roomEditorDefaultPlayerScale;
    queuePlayersRender(nextPlayers, { immediate: true });
    setControlledPlayerIdState(commercialV2DefaultControlledPlayerId);
    setPlayerScaleState(roomEditorDefaultPlayerScale);
    setRoomBehaviorStatus('两位小人已回到房间默认站位。');
  }

  function toggleRoomBehaviorFold(key) {
    setRoomBehaviorFoldOpen((current) => ({
      ...current,
      [key]: !current[key]
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
        {open && (
          <div className="pixel-world-behavior-fold-body">
            {children}
          </div>
        )}
      </section>
    );
  }

  function renderRoomPlayer(targetPlayer) {
    const character = getCommercialV2PlayerCharacter(targetPlayer);
    const visualDimensions = getPlayerVisualDimensions(targetPlayer);
    const isControlled = targetPlayer.id === controlledPlayerId;
    const actorKind = targetPlayer.id === commercialV2RoleActorId
      ? 'role-actor'
      : targetPlayer.id === commercialV2UserActorId
        ? 'user-actor'
        : '';
    const actorLabel = targetPlayer.id === commercialV2RoleActorId ? tx('Character', '角色') : tx('Player', '玩家');
    const frameName = targetPlayer.moving ? commercialV2PlayerFrameOrder[targetPlayer.frame] : 'idle';
    const src = commercialV2PlayerFrame(targetPlayer, `${targetPlayer.direction || 'front'}_walk_${frameName}.png`);
    const zIndex = getRoomEditorPlayerRenderZIndex(
      targetPlayer,
      getRoomEditorPlayerDepthTie(players, targetPlayer)
    );
    const behaviorDialog = targetPlayer.id === commercialV2RoleActorId ? activeBehaviorDialog : null;
    const actionBubble = behaviorDialog ? '' : targetPlayer.bubble;
    const playerLeftPx = ((targetPlayer.x || 0) - visualDimensions.width / 2) * zoom;
    const playerTopPx = ((targetPlayer.y || 0) - visualDimensions.height + visualDimensions.footOffset) * zoom;
    const nameplateTop = (((targetPlayer.y || 0) - visualDimensions.height + visualDimensions.footOffset - 22) / stageSize.height) * 100;
    const bubbleTop = (((targetPlayer.y || 0) - visualDimensions.height + visualDimensions.footOffset - 8) / stageSize.height) * 100;
    const dialogTop = (Math.max(20, (targetPlayer.y || 0) - visualDimensions.height + visualDimensions.footOffset - 34) / stageSize.height) * 100;
    const footprintWidth = Math.max(
      commercialV2PlayerPeerCollision.minWidth,
      visualDimensions.width * commercialV2PlayerPeerCollision.widthRatio
    );
    const footprintHeight = Math.max(
      commercialV2PlayerPeerCollision.minHeight,
      visualDimensions.footOffset * commercialV2PlayerPeerCollision.heightRatio
    );
    return (
      <React.Fragment key={`room-player-${targetPlayer.id}`}>
        <img
          className={`pixel-world-player ${isControlled ? 'controlled' : ''} ${actorKind}`}
          src={src}
          alt=""
          draggable={false}
          title={`${ptxt(character.label)} · ${actorLabel}`}
          style={{
            left: 0,
            top: 0,
            width: `${visualDimensions.width * zoom}px`,
            height: `${visualDimensions.height * zoom}px`,
            transform: `translate3d(${playerLeftPx}px, ${playerTopPx}px, 0)`,
            zIndex
          }}
        />
        <span
          className={`pixel-world-player-nameplate ${actorKind}`}
          style={{
            left: `${((targetPlayer.x || 0) / stageSize.width) * 100}%`,
            top: `${nameplateTop}%`,
            zIndex: zIndex + 900
          }}
        >
          {actorLabel}
        </span>
        {actionBubble && (
          <span
            className="pixel-world-player-action-bubble"
            style={{
              left: `${((targetPlayer.x || 0) / stageSize.width) * 100}%`,
              top: `${bubbleTop}%`,
              zIndex: zIndex + 1000
            }}
          >
            {ptxt(actionBubble)}
          </span>
        )}
        {behaviorDialog && (
          <div
            className={`pixel-world-behavior-dialog ${behaviorDialog.type || ''}`}
            style={{
              left: `${((targetPlayer.x || 0) / stageSize.width) * 100}%`,
              top: `${dialogTop}%`,
              zIndex: zIndex + 1300
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="pixel-world-behavior-dialog-head">
              <strong>{behaviorDialog.title || tx('Character', '角色')}</strong>
              <span>{Math.min((behaviorDialog.stepIndex || 0) + 1, behaviorDialog.totalSteps || 1)}/{behaviorDialog.totalSteps || 1}</span>
            </div>
            <p>{behaviorDialog.text}</p>
            {behaviorDialog.type === 'pending' ? (
              <button type="button" disabled>{tx('Generating...', '生成中...')}</button>
            ) : behaviorDialog.type === 'choice' && behaviorDialog.choices?.length ? (
              <div className="pixel-world-behavior-dialog-choices">
                {behaviorDialog.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => chooseBehaviorDialogChoice(choice)}
                    disabled={behaviorLoading}
                  >
                    {ptxt(choice.label)}
                  </button>
                ))}
                <button
                  type="button"
                  className="pixel-world-behavior-dialog-exit"
                  onClick={exitBehaviorDialog}
                  disabled={behaviorLoading}
                >
                  {tx('Exit Dialog', '退出对话')}
                </button>
              </div>
            ) : (
              <button type="button" onClick={continueBehaviorDialog}>
                {tx('Next Line', '下一句')}
              </button>
            )}
          </div>
        )}
        {showCollisionLines && (
          <span
            className={`pixel-world-player-footprint ${isControlled ? 'controlled' : ''}`}
            style={{
              left: `${(((targetPlayer.x || 0) - footprintWidth / 2) / stageSize.width) * 100}%`,
              top: `${(((targetPlayer.y || 0) - footprintHeight / 2) / stageSize.height) * 100}%`,
              width: `${(footprintWidth / stageSize.width) * 100}%`,
              height: `${(footprintHeight / stageSize.height) * 100}%`,
              zIndex: zIndex + 1
            }}
          />
        )}
      </React.Fragment>
    );
  }

  const aiLayout = useMemo(
    () => buildRoomEditorAiLayout(items, assetById, stageSize),
    [assetById, items, stageSize]
  );
  const aiLayoutPrompt = aiLayout.prompt;
  const roomBehaviorTreeSnapshot = useMemo(
    () => createRoomEditorBehaviorTreeSnapshot(items, assetById, playersRef.current, controlledPlayerId, playerScale, stageSize),
    [assetById, controlledPlayerId, items, playerScale, stageSize]
  );
  const roomBehaviorDebugJson = useMemo(() => {
    if (!roomBehaviorFoldOpen.debug) return '';
    return JSON.stringify({
      scene: 'room',
      controlledPlayerId,
      playerScale,
      interaction: {
        distance: Math.round(roomBehaviorInteractionState.distance),
        nearby: roomBehaviorInteractionState.nearby,
        threshold: commercialV2BehaviorInteractionDistance
      },
      players: serializeRoomEditorPlayers(playersRef.current, controlledPlayerId, playerScale),
      anchors: roomAnchors.map((anchor) => ({
        id: anchor.id,
        name: anchor.name,
        x: Math.round(anchor.anchor.x),
        y: Math.round(anchor.anchor.y)
      })),
      aiGrid: {
        size: aiLayout.gridSize,
        ascii: aiLayout.ascii
      },
      behaviorTree: createRoomEditorBehaviorTreeSnapshot(
        itemsRef.current,
        assetById,
        playersRef.current,
        controlledPlayerIdRef.current,
        playerScaleRef.current,
        stageSize
      ),
      runtimeTree: behaviorTreeState
    }, null, 2);
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
    stageSize
  ]);

  const buildRoomLayoutJson = useCallback(() => {
    const latestItems = itemsRef.current;
    const latestPlayers = playersRef.current;
    const latestControlledPlayerId = controlledPlayerIdRef.current;
    const latestPlayerScale = playerScaleRef.current;
    const latestAiLayout = buildRoomEditorAiLayout(latestItems, assetById, stageSize);
    const latestPlayerSnapshot = serializeRoomEditorPlayers(latestPlayers, latestControlledPlayerId, latestPlayerScale);
    const latestBehaviorTreeSnapshot = createRoomEditorBehaviorTreeSnapshot(
      latestItems,
      assetById,
      latestPlayers,
      latestControlledPlayerId,
      latestPlayerScale,
      stageSize
    );
    return JSON.stringify({
      stage: stageSize,
      background: {
        type: 'room-backdrop',
        color: roomEditorBackgroundColor,
        image: roomEditorBackdrop,
        scale: zoom
      },
      collision: {
        unit: 'ratio-of-item-box',
        mode: 'active',
        lineVisibility: 'hidden-by-default',
        groundLayer: 'ignored'
      },
      aiLayout: latestAiLayout,
      players: latestPlayerSnapshot,
      behaviorTree: {
        ...latestBehaviorTreeSnapshot,
        runtime_tree: behaviorTreeState
      },
      anchors: roomAnchors,
      items: latestItems.map((item) => serializeRoomEditorItem(item, assetById.get(item.assetId)))
    }, null, 2);
  }, [assetById, behaviorTreeState, roomAnchors, stageSize, zoom]);

  const layoutJson = useMemo(
    () => {
      const _LAYOUT_JSON_REFRESH_INPUTS = [controlledPlayerId, items, playerScale];
      return buildRoomLayoutJson();
    },
    [buildRoomLayoutJson, controlledPlayerId, items, playerScale]
  );

  function renderRoomBehaviorActorCard(actorId, title, note) {
    const character = commercialV2PlayerCharacterById.get(actorId) || commercialV2PlayerCharacters[0];
    const actor = players[actorId] || createRoomEditorPlayerState(character);
    return (
      <div className={`pixel-world-behavior-actor ${actorId === commercialV2UserActorId ? 'user' : 'role'}`}>
        <img src={commercialV2PlayerFrame(actor, `${actor.direction || 'front'}_walk_idle.png`)} alt="" draggable={false} />
        <div>
          <strong>{ptxt(title)}</strong>
          <span>{ptxt(character.label)} · x{Math.round(actor.x)} y{Math.round(actor.y)}</span>
          <small>{ptxt(note)}</small>
        </div>
      </div>
    );
  }

  function renderRoomBehaviorTreePanel() {
    if (roomBehaviorPanelCollapsed) {
      return (
        <aside className="pixel-world-behavior-panel collapsed">
          <button
            type="button"
            className="pixel-world-behavior-panel-expand"
            onClick={() => setRoomBehaviorPanelCollapsed(false)}
            title={tx('Expand room behavior-tree panel', '展开房间行为树面板')}
            aria-label={tx('Expand room behavior-tree panel', '展开房间行为树面板')}
          >
            <span>{tx('Room Behavior Tree', '房间行为树')}</span>
            <strong>{tx('Room', '房间')}</strong>
            <small>{tx('Expand', '展开')}</small>
          </button>
        </aside>
      );
    }

    return (
      <aside className="pixel-world-behavior-panel room-behavior-panel">
        <div
          className="pixel-world-room-settings-scroll"
          tabIndex={0}
          aria-label={tx('Room behavior settings scroll area', '房间行为设置滚动区')}
        >
          <div className="pixel-world-behavior-head">
            <div>
              <h3>{tx('Room Behavior Tree V1', '房间行为树 V1')}</h3>
              <span>{tx('Two sprites / furniture anchors / room context', '两小人 / 家具锚点 / 房间上下文')}</span>
            </div>
            <div className="pixel-world-behavior-head-actions">
              <strong>{roomBehaviorInteractionState.nearby ? 'Near' : 'Room'}</strong>
              <button
                type="button"
                onClick={() => setRoomBehaviorPanelCollapsed(true)}
                title={tx('Collapse room behavior-tree panel', '收起房间行为树面板')}
              >
                {tx('Collapse', '收起')}
              </button>
            </div>
          </div>

          <div className="pixel-world-behavior-actors">
            {renderRoomBehaviorActorCard(commercialV2RoleActorId, '角色小人', '行为树驱动对象')}
            {renderRoomBehaviorActorCard(commercialV2UserActorId, '玩家小人', controlledPlayerId === commercialV2UserActorId ? '当前键盘控制' : '可切换控制')}
          </div>

          {renderRoomBehaviorFold(
            'constraints',
            tx('Room Allowlist', '房间白名单'),
            tx(`${roomAnchors.length} anchors / ${commercialV2BehaviorMovementActions.length} behavior actions`, `${roomAnchors.length} 锚点 / ${commercialV2BehaviorMovementActions.length} 行为动作`),
            (
              <div className="pixel-world-behavior-constraints">
                <div>
                  <strong>{tx('Furniture Anchors', '家具锚点')}</strong>
                  <div className="pixel-world-behavior-chip-list">
                    {roomAnchors.length ? roomAnchors.map((anchor) => (
                      <span key={anchor.id}>{ptxt(anchor.name)}</span>
                    )) : (
                      <span>{tx('No anchors', '暂无锚点')}</span>
                    )}
                  </div>
                </div>
                <div>
                  <strong>{tx('Reusable Actions', '可复用动作')}</strong>
                  <div className="pixel-world-behavior-chip-list">
                    {commercialV2BehaviorMovementActions.map((action) => (
                      <span key={action.id}>{translatePixelAction(action, lang).label}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {renderRoomBehaviorFold(
            'runtime',
            tx('Runtime', '运行状态'),
            roomBehaviorInteractionState.nearby
              ? tx(`Distance ${Math.round(roomBehaviorInteractionState.distance)}`, `距离 ${Math.round(roomBehaviorInteractionState.distance)}`)
              : tx(`Distance ${Math.round(roomBehaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}`, `距离 ${Math.round(roomBehaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}`),
            (
              <>
                <div className={`pixel-world-behavior-proximity ${roomBehaviorInteractionState.nearby ? 'nearby' : ''}`}>
                  <strong>{roomBehaviorInteractionState.nearby ? tx('In interaction range', '已在互动范围') : tx('Not close yet', '还没有靠近')}</strong>
                  <span>{Math.round(roomBehaviorInteractionState.distance)} / {commercialV2BehaviorInteractionDistance}</span>
                </div>
                <div className="pixel-world-behavior-run-row">
                  <button type="button" onClick={approachRoomPlayer}>{tx('Character approaches player', '角色靠近玩家')}</button>
                  <button type="button" onClick={faceRoomPlayers}>{tx('Face Each Other', '面对彼此')}</button>
                  <button type="button" onClick={wanderRoomPlayer}>{tx('Room Wander', '房间闲逛')}</button>
                  <button type="button" onClick={clearRoomPlayerBubbles}>{tx('Clear Bubbles', '清空气泡')}</button>
                  <button type="button" onClick={resetRoomPlayers}>{tx('Reset Sprites', '重置小人')}</button>
                </div>
                <div className="pixel-world-behavior-status">
                  {ptxt(behaviorStatus)}
                </div>
              </>
            )
          )}

          {renderRoomBehaviorFold(
            'debug',
            tx('Debug Context', '调试上下文'),
            tx(`${roomBehaviorTreeSnapshot.node_count} nodes inherit the shared skeleton`, `${roomBehaviorTreeSnapshot.node_count} 节点继承通用骨架`),
            (
              <pre className="pixel-world-behavior-json">
                {roomBehaviorDebugJson}
              </pre>
            )
          )}
        </div>
      </aside>
    );
  }

  return (
    <div className={`pixel-world-editor room-editor ${viewMode ? 'view-mode' : ''}`}>
      <div className="pixel-world-editor-toolbar">
        <div className="pixel-world-toolbar-section pixel-world-toolbar-section--primary">
          <button onClick={saveLayout}>{tx('Save Layout', '保存布局')}</button>
          <button
            className={viewMode ? 'active' : ''}
            onClick={toggleViewMode}
            title={viewMode ? tx('Assets are locked. Turn this off to move and edit.', '素材已锁定，关闭后才能移动和编辑') : tx('Lock assets to avoid accidental dragging.', '开启后锁定素材，避免误拖')}
          >
            {viewMode ? tx('View Mode', '观赏模式') : tx('Edit Mode', '编辑模式')}
          </button>
          <label className="pixel-world-player-switch-control">
            <span>{tx('Control', '控制')}</span>
            <select
              value={controlledPlayerId}
              onChange={(event) => updateControlledPlayerId(event.target.value)}
            >
              {commercialV2PlayerCharacters.map((character) => (
                <option key={character.id} value={character.id}>{ptxt(character.label)}</option>
              ))}
            </select>
            <strong>{ptxt(getCommercialV2PlayerCharacter(controlledPlayer).label)}</strong>
          </label>
        </div>

        <div className="pixel-world-toolbar-section pixel-world-toolbar-section--status">
          <strong>{Math.round(zoom * 100)}%</strong>
          <span className="pixel-world-player-help">{tx('Move sprites with WASD / arrow keys', 'WASD / 方向键移动小人')}</span>
        </div>

        <button
          type="button"
          className={`pixel-world-toolbar-more ${showAdvancedToolbar ? 'active' : ''}`}
          onClick={() => setShowAdvancedToolbar((value) => !value)}
        >
          {showAdvancedToolbar ? tx('Hide Advanced', '收起高级') : tx('Advanced Tools', '高级工具')}
        </button>

        {showAdvancedToolbar && (
          <div className="pixel-world-toolbar-advanced">
            <div className="pixel-world-toolbar-section">
              <button onClick={saveCurrentAsDefaultScene}>{tx('Save Current as Default', '保存当前场景为默认场景')}</button>
              <button onClick={copyLayout}>{tx('Copy JSON', '复制 JSON')}</button>
              <button onClick={copyAiLayout}>{tx('Copy AI Layout Context', '复制 AI 布局上下文')}</button>
              <button onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.08).toFixed(2))))}>{tx('Zoom Out', '画布缩小')}</button>
              <button onClick={() => setZoom((value) => Math.min(1.25, Number((value + 0.08).toFixed(2))))}>{tx('Zoom In', '画布放大')}</button>
              <button
                className={showCollisionLines ? 'active' : ''}
                onClick={toggleCollisionLines}
                title={tx('Only toggles collision-line visibility. Collision data is still saved.', '只切换碰撞箱线条显示；碰撞数据默认会保存')}
              >
                {showCollisionLines ? tx('Hide Collision', '隐藏碰撞箱线') : tx('Show Collision', '查看碰撞箱线')}
              </button>
              <button
                className={showPlaceAnchors ? 'active' : ''}
                onClick={togglePlaceAnchors}
                title={tx('Show future character interaction points, furniture approach points, or standing anchors.', '查看后续角色交互、家具靠近点或站位锚点')}
              >
                {showPlaceAnchors ? tx('Hide Anchors', '隐藏地点锚点') : tx('Show Anchors', '查看地点锚点')}
              </button>
              <button
                className={showLayerPanel ? 'active' : ''}
                onClick={() => setShowLayerPanel((value) => !value)}
                title={tx('Show unified layer numbers and the right-side layer list.', '显示统一图层序号和右侧图层列表')}
              >
                {showLayerPanel ? tx('Hide Layers', '隐藏图层') : tx('Show Layers', '查看图层')}
              </button>
            </div>

            <div className="pixel-world-toolbar-section">
              <label className="pixel-world-player-scale-control">
                <span>{tx('Sprite Size', '小人尺寸')}</span>
                <input
                  type="range"
                  min={roomEditorMinPlayerScale}
                  max={roomEditorMaxPlayerScale}
                  step="0.05"
                  value={playerScale}
                  onChange={(event) => updatePlayerScale(event.target.value)}
                />
                <input
                  type="number"
                  min={roomEditorMinPlayerScale}
                  max={roomEditorMaxPlayerScale}
                  step="0.05"
                  value={playerScale}
                  onChange={(event) => updatePlayerScale(event.target.value)}
                />
                <strong>{Math.round(playerScale * 100)}%</strong>
              </label>
            </div>

            {canEditLayout ? (
              <div className="pixel-world-toolbar-section pixel-world-toolbar-section--edit">
                <button
                  className={groupEditMode ? 'active' : ''}
                  onClick={() => setGroupEditMode((value) => !value)}
                  title={tx('Drag, scale, and nudge all assets together.', '开启后拖动、缩放和微调会作用于全部素材')}
                >
                  {groupEditMode ? tx('Group Editing', '整体编辑中') : tx('Group Edit', '整体编辑')}
                </button>
                <button onClick={restoreResetBackup}>{tx('Restore Previous', '恢复上次布局')}</button>
                <button onClick={resetLayout}>{tx('Restore Default', '恢复默认')}</button>
              </div>
            ) : (
              <span className="pixel-world-toolbar-muted">
                {tx('Switch to edit mode to reveal layout and selected-asset tools.', '切到编辑模式后才显示图层和选中素材工具。')}
              </span>
            )}

            {canEditLayout && (groupEditMode || selectedItem) && (
              <div className="pixel-world-toolbar-section pixel-world-toolbar-section--selection">
                <button onClick={() => scaleSelected(0.92)} disabled={groupEditMode ? items.length === 0 : !selectedItem}>{groupEditMode ? tx('Shrink All', '整体缩小') : tx('Shrink Asset', '素材缩小')}</button>
                <button onClick={() => scaleSelected(1.08)} disabled={groupEditMode ? items.length === 0 : !selectedItem}>{groupEditMode ? tx('Grow All', '整体放大') : tx('Grow Asset', '素材放大')}</button>
                {!groupEditMode && (
                  <>
                    <button onClick={cycleSelectedDirection} disabled={!canRotateSelected}>{tx('Rotate', '旋转方向')}</button>
                    <button onClick={() => moveSelectedLayer('up')} disabled={!selectedItem}>{tx('Layer Up', '上移图层')}</button>
                    <button onClick={() => moveSelectedLayer('down')} disabled={!selectedItem}>{tx('Layer Down', '下移图层')}</button>
                    <button onClick={bringSelectedToFront} disabled={!selectedItem}>{tx('Bring Front', '置顶')}</button>
                    <button onClick={sendSelectedToBack} disabled={!selectedItem}>{tx('Send Back', '置底')}</button>
                    <button onClick={deleteSelected} disabled={!selectedItem}>{tx('Delete', '删除')}</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <span className="pixel-world-toolbar-notice">{ptxt(notice)}</span>
      </div>

      <div
        className={`pixel-world-editor-body room-editor-body ${roomBehaviorPanelCollapsed ? 'behavior-collapsed' : ''}`}
        style={{ '--pixel-world-room-frame-height': `${Math.ceil(stageSize.height * zoom + 38)}px` }}
      >
        <aside className="pixel-world-asset-panel">
          <div
            className="pixel-world-room-settings-scroll"
            tabIndex={0}
            aria-label={tx('Room asset settings scroll area', '房间素材设置滚动区')}
          >
            <h3>{tx('Room Assets', '房间素材')}</h3>
            {groupedAssets.length > 0 ? (
              <>
                <div className="pixel-world-asset-type-tabs" role="tablist" aria-label={tx('Room asset categories', '房间素材分类')}>
                  {groupedAssets.map(([type, assets]) => (
                    <button
                      key={type}
                      className={activeAssetGroup?.[0] === type ? 'active' : ''}
                      onClick={() => setActiveAssetType(type)}
                      title={`${ptxt(type)} (${assets.length})`}
                    >
                      {ptxt(type)}
                      <span>{assets.length}</span>
                    </button>
                  ))}
                </div>
                {activeAssetGroup && (
                  <div className="pixel-world-asset-group" key={activeAssetGroup[0]}>
                    <strong>{ptxt(activeAssetGroup[0])}</strong>
                    <div className="pixel-world-asset-grid">
                      {activeAssetGroup[1].map((asset) => {
                        const price = getRoomEditorFurniturePrice(asset.id);
                        return (
                          <button
                            key={asset.id}
                            onClick={() => addAsset(asset)}
                            title={price ? tx(`${ptxt(asset.name)} / price ${price}`, `${asset.name} / 价格 ${price}`) : ptxt(asset.name)}
                            disabled={!canEditLayout}
                          >
                            <img src={roomEditorAsset(asset.path)} alt="" draggable={false} loading="lazy" />
                            <span className="pixel-world-asset-name">{ptxt(getRoomEditorPaletteAssetName(asset))}</span>
                            {price ? <small className="pixel-world-asset-price">{tx('Price', '价格')} {price}</small> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="pixel-world-asset-empty">
                <strong>{tx('No Room Assets', '暂无房间素材')}</strong>
                <p>{tx('Furniture, wall decor, and standing-point assets will reuse this scaling, collision, anchor, and layer logic.', '家具、墙饰或站位点素材接入后，会复用这里的缩放、碰撞箱、锚点和图层逻辑。')}</p>
              </div>
            )}
          </div>
        </aside>

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
              '--street-bg-color': roomEditorBackgroundColor
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="pixel-world-editor-bg" aria-hidden="true" />
            <img className="pixel-world-room-editor-backdrop" src={scene.backdrop || roomEditorBackdrop} alt="" draggable={false} />
            {items.map((item, layerIndex) => {
              const asset = assetById.get(item.assetId);
              if (!asset) return null;
              return renderRoomEditorItem(item, asset, layerIndex);
            })}
            {showPlaceAnchors && items.map((item, layerIndex) => {
              const asset = assetById.get(item.assetId);
              if (!asset) return null;
              return renderRoomPlaceAnchor(item, asset, layerIndex);
            })}
            {commercialV2PlayerCharacters.map((character) => renderRoomPlayer(
              players[character.id] || createRoomEditorPlayerState(character)
            ))}
            {renderPlayerInteractionMenu()}
          </div>
        </div>

        <aside className="pixel-world-inspector">
          <h3>{tx('Selection', '选中')}</h3>
          {viewMode ? (
            <p>{tx('View mode is on. Assets cannot be selected or dragged. Switch to edit mode to move them.', '观赏模式已开启，素材不会被选中或拖动；切到编辑模式后可以移动素材。')}</p>
          ) : selectedItem && selectedAsset ? (
            <>
              <div className="pixel-world-selected-name">{ptxt(selectedAsset.name)}</div>
              {selectedDirectionGroup && (
                <div className="pixel-world-direction-card">
                  <div className="pixel-world-direction-card-head">
                    <strong>{tx('Direction', '方向')}</strong>
                    <button onClick={cycleSelectedDirection} disabled={!canRotateSelected}>{tx('Rotate', '旋转方向')}</button>
                  </div>
                  <div className="pixel-world-direction-grid" role="group" aria-label={tx(`${ptxt(selectedDirectionGroup.name)} direction`, `${selectedDirectionGroup.name}方向`)}>
                    {roomEditorDirectionOrder.map((direction) => {
                      const variant = selectedDirectionGroup.variants?.[direction];
                      return (
                        <button
                          key={`${selectedDirectionGroup.id}-${direction}`}
                          type="button"
                          className={selectedDirection === direction ? 'active' : ''}
                          onClick={() => updateSelectedDirection(direction)}
                          disabled={!canRotateSelected || !variant}
                          title={ptxt(variant?.name || `${selectedDirectionGroup.name}-${roomEditorDirectionLabels[direction]}`)}
                        >
                          {variant ? (
                            <img src={roomEditorAsset(variant.path)} alt="" draggable={false} loading="lazy" />
                          ) : (
                            <span aria-hidden="true">--</span>
                          )}
                          <em>{ptxt(roomEditorDirectionLabels[direction])}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className={`pixel-world-layer-mode-card ${selectedIsGroundLayer ? 'ground' : ''}`}>
                <div className="pixel-world-layer-mode-head">
                  <strong>{tx('Layer Properties', '图层属性')}</strong>
                  <label className="pixel-world-collision-toggle">
                    <input
                      type="checkbox"
                      checked={selectedIsGroundLayer}
                      onChange={(event) => updateSelectedGroundLayer(event.target.checked)}
                    />
                    <span>{tx('Ground Layer', '地面层')}</span>
                  </label>
                </div>
                <small>
                  {selectedIsGroundLayer
                    ? tx('This instance stays below normal assets. Its collision box is saved but does not block characters.', '当前实例会恒在普通素材下方；碰撞箱保留但不会阻挡人物。')
                    : tx('Normal assets render by layer order, and collision boxes can block characters later.', '普通素材会按图层顺序显示，碰撞箱可用于后续人物阻挡。')}
                </small>
              </div>
              {selectedPlace && (
                <div className="pixel-world-place-card">
                  <div className="pixel-world-place-card-head">
                    <strong>{tx('Place Anchor', '地点锚点')}</strong>
                    {!showPlaceAnchors && (
                      <button onClick={togglePlaceAnchors}>{tx('Show Anchors', '查看锚点')}</button>
                    )}
                  </div>
                  <span>{ptxt(selectedPlace.name)}</span>
                  <small>{tx('Use: furniture approach point / standing point / reserved interaction point', '用途: 家具靠近点 / 站位点 / 交互点预留')}</small>
                  {selectedPlaceAnchorLocalPoint && (
                    <>
                      <div className="pixel-world-place-fields">
                        {['x', 'y'].map((key) => (
                          <label key={`room-place-anchor-${key}`}>
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
                        <button onClick={resetSelectedPlaceAnchor}>{tx('Default Anchor', '默认锚点')}</button>
                      </div>
                      <div className="pixel-world-inspector-hint">
                        {tx('After showing anchors, drag the pink point to edit the approach point. Saving the layout saves it too.', '显示锚点后，拖粉色点就能改靠近点；保存布局会一起保存。')}
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
              <div className="pixel-world-nudge-pad" aria-label={tx('Nudge position', '微调位置')}>
                <button onClick={() => nudgeSelected(0, -4)}>↑</button>
                <button onClick={() => nudgeSelected(-4, 0)}>←</button>
                <button onClick={() => nudgeSelected(4, 0)}>→</button>
                <button onClick={() => nudgeSelected(0, 4)}>↓</button>
              </div>
              <div className="pixel-world-scale-row">
                <button onClick={() => scaleSelected(0.96)}>{groupEditMode ? tx('Smaller All', '整体小一点') : tx('Smaller', '小一点')}</button>
                <button onClick={() => scaleSelected(1.04)}>{groupEditMode ? tx('Larger All', '整体大一点') : tx('Larger', '大一点')}</button>
              </div>
              <div className={`pixel-world-collision-editor ${showCollisionLines ? 'active' : ''}`}>
                <div className="pixel-world-collision-editor-head">
                  <strong>{tx('Collision Volume', '碰撞体积')}</strong>
                  {!showCollisionLines && (
                    <button onClick={toggleCollisionLines}>{tx('Show Collision', '查看碰撞箱线')}</button>
                  )}
                  <label className="pixel-world-collision-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCollision?.enabled)}
                      disabled={!isCommercialV2CollisionAsset(selectedAsset) || !selectedCollisionCanTakeEffect}
                      onChange={(event) => updateSelectedCollisionEnabled(event.target.checked)}
                    />
                    <span>{tx('Enabled', '启用')}</span>
                  </label>
                </div>
                {selectedCollisionCanTakeEffect && selectedCollisionLocalBox ? (
                  <>
                    <div className="pixel-world-collision-fields">
                      {['x', 'y', 'w', 'h'].map((key) => (
                        <label key={`room-collision-${key}`}>
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
                      <button onClick={resetSelectedCollision}>{tx('Default', '默认')}</button>
                      <button onClick={fitSelectedCollisionToSprite}>{tx('Fit Sprite', '贴合整图')}</button>
                    </div>
                    <div className="pixel-world-inspector-hint">
                      {tx('After showing lines, drag the green box to move the collision area and blue handles to resize it.', '显示线条后，拖绿色框移动碰撞箱，拖蓝色点调整大小。')}
                    </div>
                  </>
                ) : (
                  <div className="pixel-world-inspector-hint">
                    {selectedIsGroundLayer
                      ? tx('Ground-layer rule: this collision box will not block characters.', '地面层规则：这个实例的碰撞箱不会参与人物阻挡。')
                      : tx('This asset has no editable collision box yet.', '这个素材还没有可编辑的碰撞箱。')}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p>{tx('Click a room asset on the canvas to edit it. Before assets are connected, the JSON on the right stays as an empty room template.', '点击画布上的房间素材开始编辑；素材还没接入时，右侧 JSON 会保持为空房间模板。')}</p>
          )}
          {showLayerPanel && (
            <section className="pixel-world-layer-panel">
              <div className="pixel-world-layer-panel-head">
                <strong>{tx('Layers', '图层')}</strong>
                <small>{tx('Upper rows render later. Ground layers do not participate in collision.', '上方后绘制；地面层不参与碰撞。')}</small>
              </div>
              {selectedLayerRow && (
                <div className="pixel-world-layer-current">
                  {tx('Current:', '当前：')}{ptxt(selectedLayerRow.asset?.name || selectedLayerRow.item.assetId)}
                  <span>#{selectedLayerRow.layerIndex + 1}</span>
                </div>
              )}
              <div className="pixel-world-layer-list">
                {layerRows.slice().reverse().map((row) => (
                  <button
                    key={`room-layer-row-${row.item.id}`}
                    type="button"
                    className={`pixel-world-layer-row ${row.item.id === selectedId ? 'active' : ''} ${row.isGround ? 'ground' : 'asset'}`}
                    onClick={() => setSelectedId(row.item.id)}
                    title={`${row.asset?.name || row.item.assetId} / z-index ${row.zIndex}`}
                  >
                    <span className="pixel-world-layer-index">#{row.layerIndex + 1}</span>
                    <span className="pixel-world-layer-name">
                      {row.asset?.name || row.item.assetId}
                      <small>{ptxt(row.asset?.type || '未知')} · z {row.zIndex} · {ptxt(row.playerRule)}</small>
                    </span>
                    <span className="pixel-world-layer-kind">{row.isGround ? tx('Ground', '地面') : tx('Asset', '素材')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <h3>{tx('AI Layout Context', 'AI 布局上下文')}</h3>
          <textarea className="pixel-world-ai-layout-textarea" value={aiLayoutPrompt} readOnly />
          <h3>{tx('Layout JSON', '布局 JSON')}</h3>
          <textarea value={layoutJson} readOnly />
        </aside>

        {renderRoomBehaviorTreePanel()}
      </div>
    </div>
  );
}

export default RoomAssetEditor;
