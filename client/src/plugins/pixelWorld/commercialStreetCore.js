const commercialV2Base = '/assets/pixel-world/commercial-street-v2';
const commercialV2AssetVersion = 'greenery-edgefix-20260520';
const commercialV2Asset = (path) => `${commercialV2Base}/${path}?v=${commercialV2AssetVersion}`;
const commercialV2StorageKey = 'pixelWorld.commercialStreetV2.layout';
const commercialV2CanvasStorageKey = 'pixelWorld.commercialStreetV2.canvas';
const commercialV2ResetBackupStorageKey = 'pixelWorld.commercialStreetV2.resetBackup';
const commercialV2DefaultSnapshotStorageKey = 'pixelWorld.commercialStreetV2.defaultSnapshot';
const commercialV2MaxStorageBytes = 500000;
const commercialV2MaxSavedItems = 250;
const commercialV2RecoveredLayoutUrl = '/recovered-commercial-layout.json';
const commercialV2RecoveredCanvasUrl = '/recovered-commercial-canvas.json';
const commercialV2SegmentSize = { width: 2048, height: 420 };
const commercialV2StageBottomPadding = 5;
const commercialV2LoopSeamMargin = 10;
const commercialV2MinSegmentCount = 1;
const commercialV2MaxSegmentCount = 24;
const commercialV2BackgroundColor = '#f4ead8';
const commercialV2PlayerFrameOrder = ['idle', 'step_a', 'passing', 'step_b'];
const commercialV2PlayerSize = { width: 64, height: 80, footOffset: 8 };
const commercialV2PlayerPeerCollision = { widthRatio: 0.56, minWidth: 36, heightRatio: 2.8, minHeight: 42 };
const commercialV2PlayerApproachGap = 86;
const commercialV2PlayerInitial = { x: 3500, y: 640, direction: 'front', frame: 0, moving: false, stepTime: 0 };
const commercialV2PlayerCharacters = [
  {
    id: 'casual-boy-v1',
    label: '男孩',
    spriteBase: '/assets/pixel-world/characters/casual-boy-v1/frames-64x80',
    assetVersion: 'character-recut-generated-sheet-20260521',
    initial: { x: 3760, y: 640, direction: 'front' }
  },
  {
    id: 'pink-cardigan-girl-v1',
    label: '粉色开衫女孩',
    spriteBase: '/assets/pixel-world/characters/pink-cardigan-girl-v1/frames-64x80',
    assetVersion: 'pink-cardigan-girl-v1-20260524',
    initial: { x: 3508, y: 640, direction: 'front' }
  },
  {
    id: 'droplet-halo-mage-v1',
    label: '水滴光环法师',
    spriteBase: '/assets/pixel-world/characters/droplet-halo-mage-v1/frames-256x320',
    assetVersion: 'droplet-halo-mage-v1-hidpi-256-side-coat-balanced-20260709',
    visualScale: 1.25,
    initial: { x: 3620, y: 640, direction: 'front' }
  }
];
const commercialV2DefaultControlledPlayerId = 'pink-cardigan-girl-v1';
const commercialV2RoleActorId = 'casual-boy-v1';
const commercialV2UserActorId = 'pink-cardigan-girl-v1';
const commercialV2PlayerCharacterById = new Map(commercialV2PlayerCharacters.map((character) => [character.id, character]));
const createCommercialV2PlayerState = (character) => ({
  ...commercialV2PlayerInitial,
  ...character.initial,
  id: character.id,
  characterId: character.id
});
const createCommercialV2PlayerStates = () => Object.fromEntries(
  commercialV2PlayerCharacters.map((character) => [character.id, createCommercialV2PlayerState(character)])
);
const getCommercialV2PlayerCharacter = (player) => (
  commercialV2PlayerCharacterById.get(player?.characterId || player?.id)
  || commercialV2PlayerCharacterById.get(commercialV2DefaultControlledPlayerId)
  || commercialV2PlayerCharacters[0]
);
const commercialV2PlayerFrame = (player, fileName) => {
  const character = getCommercialV2PlayerCharacter(player);
  return `${character.spriteBase}/${fileName}?v=${character.assetVersion}`;
};
const commercialV2DefaultPlayerScale = 2;
const commercialV2DefaultZoom = 0.85;
const commercialV2PlayerSpeed = 220;
const commercialV2BehaviorPlayerSpeed = 180;
const commercialV2LayerBaseZIndex = 10000;
const commercialV2LayerStepZIndex = 20;
const commercialV2PlayerLayerGap = 10;
const commercialV2PlayerOccludedZReserve = 8;
const commercialV2DepthZIndexScale = 10;
const commercialV2SkyLayerZIndex = commercialV2LayerBaseZIndex - 3000;
const commercialV2BackgroundSceneryLayerZIndex = commercialV2LayerBaseZIndex - 2500;
const commercialV2GroundLayerZIndex = commercialV2LayerBaseZIndex - 2000;
const commercialV2PathCellSize = 24;
const commercialV2PathWaypointReach = 10;
const commercialV2PathMaxVisited = 16000;
const commercialV2StreetCruiseDistances = [840, 660, 480, 300, 160];
const commercialV2StreetCruiseLaneOffsets = [0, -24, 24, -48, 48, -72, 72, -96, 96];
const commercialV2StreetCruiseMinForward = 96;
const commercialV2StreetCruiseCenterStep = 144;
const commercialV2StreetCruiseRoadCenterRatio = 0.5;
const commercialV2StreetCruiseOffRoadPenalty = 180;
const commercialV2StreetCruiseCenterLinePenalty = 1.4;
const commercialV2MainRoadCellPenalty = 24;
const commercialV2MainRoadCenterRatio = 0.42;
const commercialV2MainRoadTargetInset = 36;
const commercialV2ForwardPathBacktrackLimit = 180;
const commercialV2ForwardPathBacktrackPenalty = 4;
const commercialV2ForwardPathOvershootTolerance = 96;
const commercialV2MovementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);
const commercialV2DepthYByType = {
  建筑: 0.92,
  租房: 0.96,
  街道: 0.94,
  装饰: 0.96,
  绿化: 0.95
};
const commercialV2DepthYByAssetId = {
  prop_food_truck: 0.8,
  prop_bus_stop: 0.88,
  prop_cafe_table: 0.86,
  prop_bench: 0.86,
  prop_bicycle: 0.82,
  prop_street_lamp: 0.97,
  prop_mailbox: 0.96,
  prop_tree_green: 0.98,
  prop_tree_cherry: 0.98
};
const commercialV2OcclusionSortYRatioByAssetId = {
  prop_food_truck: 0.8
};
const commercialV2OcclusionRightCornerCapByAssetId = {
  building_apartment_villa: { startX: 0.78, maxBottom: 0.86 },
  prop_chalkboard: { startX: 0.78, maxBottom: 0.875 }
};
const commercialV2AspectRatioByAssetId = {
  prop_chalkboard: 246 / 329
};
const commercialV2SilhouetteColumnCount = 48;
const commercialV2SilhouetteAlphaThreshold = 16;
const commercialV2OcclusionDepthMargin = 6;
const commercialV2SilhouetteCache = new Map();

function getCommercialV2ItemZIndex(layerIndex) {
  return commercialV2LayerBaseZIndex + layerIndex * commercialV2LayerStepZIndex;
}

function getCommercialV2DepthZIndex(sortY, tie = 0) {
  return commercialV2LayerBaseZIndex + Math.round((Number(sortY) || 0) * commercialV2DepthZIndexScale) + tie;
}
const commercialV2CollisionByType = {
  建筑: { x: 0.08, y: 0.86, w: 0.84, h: 0.12 },
  租房: { x: 0.18, y: 0.62, w: 0.64, h: 0.34 },
  街道: { x: 0.16, y: 0.66, w: 0.68, h: 0.3 },
  装饰: { x: 0.24, y: 0.72, w: 0.52, h: 0.24 },
  绿化: { x: 0.12, y: 0.72, w: 0.76, h: 0.22 }
};
const commercialV2LegacyCollisionByAssetId = {
  building_agency: [
    { x: 0.08, y: 0.78, w: 0.84, h: 0.18 },
    { x: 0.08, y: 0.88, w: 0.84, h: 0.1 }
  ],
  building_convenience: [
    { x: 0.07, y: 0.78, w: 0.86, h: 0.18 },
    { x: 0.07, y: 0.85, w: 0.86, h: 0.11 }
  ],
  building_cafe: [
    { x: 0.06, y: 0.76, w: 0.88, h: 0.2 },
    { x: 0.06, y: 0.86, w: 0.88, h: 0.11 }
  ],
  building_apartment_villa: [
    { x: 0.08, y: 0.78, w: 0.84, h: 0.18 },
    { x: 0.08, y: 0.86, w: 0.84, h: 0.12 }
  ],
  building_hacker_den: [
    { x: 0.08, y: 0.78, w: 0.84, h: 0.18 },
    { x: 0.08, y: 0.86, w: 0.84, h: 0.12 }
  ],
  building_hospital: [
    { x: 0.08, y: 0.74, w: 0.84, h: 0.22 },
    { x: 0.08, y: 0.82, w: 0.84, h: 0.14 }
  ],
  prop_food_truck: [
    { x: 0.08, y: 0.68, w: 0.84, h: 0.25 },
    { x: 0.1, y: 0.72, w: 0.8, h: 0.14 }
  ],
  prop_bus_stop: [
    { x: 0.1, y: 0.72, w: 0.8, h: 0.22 }
  ]
};
const commercialV2CollisionByAssetId = {
  building_agency: { x: 0.08, y: 0.94, w: 0.84, h: 0.04 },
  building_convenience: { x: 0.07, y: 0.91, w: 0.86, h: 0.05 },
  building_cafe: { x: 0.06, y: 0.92, w: 0.88, h: 0.05 },
  building_fruit_shop: { x: 0.05, y: 0.78, w: 0.9, h: 0.18 },
  building_apartment_villa: { x: 0.08, y: 0.86, w: 0.84, h: 0.12 },
  building_hacker_den: { x: 0.08, y: 0.86, w: 0.84, h: 0.12 },
  building_hospital: { x: 0.03, y: 0.46, w: 0.94, h: 0.5 },
  prop_notice_board: { x: 0.14, y: 0.66, w: 0.72, h: 0.3 },
  prop_agency_sign: { x: 0.18, y: 0.68, w: 0.64, h: 0.28 },
  prop_vending_machine: { x: 0.12, y: 0.64, w: 0.76, h: 0.32 },
  prop_food_truck: { x: 0.12, y: 0.75, w: 0.76, h: 0.05 },
  prop_chalkboard: { x: 0.18, y: 0.66, w: 0.64, h: 0.3 },
  prop_cafe_table: { x: 0.14, y: 0.56, w: 0.72, h: 0.38 },
  prop_mailbox: { x: 0.18, y: 0.66, w: 0.64, h: 0.3 },
  prop_street_lamp: { x: 0.35, y: 0.78, w: 0.3, h: 0.18 },
  prop_bicycle: { x: 0.08, y: 0.58, w: 0.84, h: 0.34 },
  prop_bench: { x: 0.08, y: 0.56, w: 0.84, h: 0.36 },
  prop_flower_box: { x: 0.08, y: 0.5, w: 0.84, h: 0.42 },
  prop_bus_stop: { x: 0.12, y: 0.58, w: 0.76, h: 0.18 },
  prop_tree_green: { x: 0.36, y: 0.76, w: 0.28, h: 0.2 },
  prop_tree_cherry: { x: 0.36, y: 0.76, w: 0.28, h: 0.2 },
  prop_fruit_stall: { x: 0.08, y: 0.62, w: 0.84, h: 0.32 },
  prop_parking_bollards: { x: 0.28, y: 0.72, w: 0.44, h: 0.24 },
  prop_traffic_cone: { x: 0.24, y: 0.62, w: 0.52, h: 0.34 },
  prop_wall_poster_board: { x: 0.12, y: 0.7, w: 0.76, h: 0.24 },
  prop_road_barrier: { x: 0.06, y: 0.64, w: 0.88, h: 0.3 }
};
const commercialV2AlwaysBackLowerBodyAssetIds = new Set([
  'building_apartment_villa'
]);
const commercialV2PlaceLinkByAssetId = {
  building_agency: {
    placeId: 'agency',
    locationId: 'street',
    label: '房产中介所',
    kind: 'housing',
    anchor: { x: 0.55, y: 0.96 },
    facing: 'front',
    actions: ['咨询房源', '看房集合', '租约提醒'],
    aliases: ['中介', '中介所', '房产中介', '看房', '租房']
  },
  building_convenience: {
    placeId: 'convenience',
    locationId: 'convenience',
    label: '便利店',
    kind: 'shop',
    anchor: { x: 0.5, y: 0.96 },
    facing: 'front',
    actions: ['购物', '买速食', '补给'],
    aliases: ['便利店', '买东西', '买吃的', '补给']
  },
  building_cafe: {
    placeId: 'restaurant',
    locationId: 'restaurant',
    label: '咖啡馆',
    kind: 'food',
    anchor: { x: 0.5, y: 0.96 },
    facing: 'front',
    actions: ['就餐', '喝咖啡', '社交约见'],
    aliases: ['餐厅', '饭店', '咖啡馆', '喝咖啡', '吃饭']
  },
  building_apartment_villa: {
    placeId: 'home_exit',
    locationId: 'home',
    label: '公寓住宅',
    kind: 'home',
    anchor: { x: 0.47, y: 0.96 },
    facing: 'front',
    actions: ['回家', '休息', '离开商业街'],
    aliases: ['家', '住宅', '公寓', '回家']
  },
  building_casino: {
    placeId: 'casino',
    locationId: 'casino',
    label: '地下赌场',
    kind: 'leisure',
    anchor: { x: 0.5, y: 0.96 },
    facing: 'front',
    actions: ['赌博', '试试运气'],
    aliases: ['赌场', '赌城', '赌博']
  },
  building_hacker_den: {
    placeId: 'hacker',
    locationId: 'hacker',
    label: '黑客据点',
    kind: 'intel',
    anchor: { x: 0.52, y: 0.96 },
    facing: 'front',
    actions: ['监听情报', '处理委托'],
    aliases: ['黑客据点', '黑客', '情报']
  },
  building_school: {
    placeId: 'school_factory',
    locationId: 'school',
    locationIds: ['school', 'factory'],
    label: '夜校 / 工厂',
    kind: 'work_education',
    anchor: { x: 0.5, y: 0.96 },
    facing: 'front',
    actions: ['上课', '学习', '打工'],
    aliases: ['学校', '夜校', '学习', '工厂', '打工', '工作']
  },
  building_hospital: {
    placeId: 'hospital',
    locationId: 'hospital',
    label: '医院',
    kind: 'medical',
    anchor: { x: 0.5, y: 0.96 },
    facing: 'front',
    actions: ['治疗', '休养'],
    aliases: ['医院', '看病', '治疗']
  },
  prop_notice_board: {
    placeId: 'notice_board',
    locationId: 'street',
    label: '租房公告牌',
    kind: 'housing_notice',
    anchor: { x: 0.5, y: 1 },
    facing: 'back',
    actions: ['查看中介广告', '浏览房源'],
    aliases: ['公告牌', '租房公告', '广告牌', '房源']
  },
  prop_agency_sign: {
    placeId: 'agency_sign',
    locationId: 'street',
    label: '中介立牌',
    kind: 'housing_notice',
    anchor: { x: 0.5, y: 1 },
    facing: 'back',
    actions: ['查看房源', '读租房广告'],
    aliases: ['中介立牌', '租房牌', '房源牌']
  },
  prop_vending_machine: {
    placeId: 'vending_machine',
    locationId: 'convenience',
    label: '自动售货机',
    kind: 'shop',
    anchor: { x: 0.5, y: 1 },
    facing: 'back',
    actions: ['买饮料', '买零食'],
    aliases: ['售货机', '自动售货机', '买饮料']
  },
  prop_food_truck: {
    placeId: 'food_truck',
    locationId: 'restaurant',
    locationIds: ['restaurant', 'park'],
    label: '中央公园餐车',
    kind: 'food',
    anchor: { x: 0.55, y: 0.7 },
    facing: 'back',
    actions: ['买小吃', '点餐', '去中央公园'],
    aliases: ['餐车', '小吃车', '买小吃', '中央公园']
  },
  prop_chalkboard: {
    placeId: 'menu_board',
    locationId: 'restaurant',
    label: '菜单小黑板',
    kind: 'food_notice',
    anchor: { x: 0.5, y: 1 },
    facing: 'back',
    actions: ['看菜单'],
    aliases: ['菜单', '小黑板']
  },
  prop_cafe_table: {
    placeId: 'cafe_table',
    locationId: 'restaurant',
    label: '咖啡桌椅',
    kind: 'social',
    anchor: { x: 0.5, y: 0.72 },
    facing: 'front',
    actions: ['坐下聊天', '喝咖啡'],
    aliases: ['桌椅', '咖啡桌', '坐下']
  },
  prop_mailbox: {
    placeId: 'mailbox',
    locationId: 'street',
    locationIds: ['street', 'park'],
    label: '邮筒',
    kind: 'street_service',
    anchor: { x: 0.5, y: 1 },
    facing: 'back',
    actions: ['寄信', '查看信件', '经过中央公园'],
    aliases: ['邮筒', '邮箱', '寄信', '中央公园']
  },
  prop_bicycle: {
    placeId: 'bicycle_parking',
    locationId: 'street',
    label: '自行车停放点',
    kind: 'street_service',
    anchor: { x: 0.5, y: 1 },
    facing: 'back',
    actions: ['停放自行车', '经过'],
    aliases: ['自行车', '单车']
  },
  prop_bus_stop: {
    placeId: 'bus_stop',
    locationId: 'street',
    locationIds: ['street', 'park'],
    label: '公交站 / 中央公园入口',
    kind: 'entry',
    anchor: { x: 0.5, y: 0.95 },
    facing: 'back',
    actions: ['进入商业街', '等车', '离开商业街', '去中央公园'],
    aliases: ['公交站', '车站', '入口', '中央公园', '公园']
  },
  prop_fruit_stall: {
    placeId: 'fruit_stall',
    locationId: 'convenience',
    label: '水果摊',
    kind: 'shop',
    anchor: { x: 0.5, y: 0.9 },
    facing: 'back',
    actions: ['买水果', '买食材'],
    aliases: ['水果摊', '水果店', '买水果']
  }
};
const commercialV2TravelLabelById = {
  agency: '房产中介所',
  agency_sign: '中介立牌',
  bus_stop: '公交站 / 中央公园入口',
  cafe_table: '咖啡桌椅',
  casino: '地下赌场',
  convenience: '便利店',
  factory: '工厂（夜校）',
  food_truck: '中央公园餐车',
  fruit_stall: '水果摊',
  hacker: '黑客据点',
  home: '公寓住宅',
  home_exit: '公寓住宅',
  hospital: '医院',
  mailbox: '邮筒',
  menu_board: '菜单小黑板',
  notice_board: '租房公告牌',
  park: '中央公园入口',
  restaurant: '餐厅 / 咖啡馆',
  school: '夜校',
  school_factory: '夜校 / 工厂',
  street: '商业街',
  vending_machine: '自动售货机'
};
const getCommercialV2Loop = (stageSize) => ({
  enabled: true,
  axis: 'x',
  width: stageSize.width,
  seam: 'left-right',
  scrollPreview: 'triple-buffer',
  wrap: '((x % width) + width) % width'
});
const getCommercialV2StageSize = (segmentCount = commercialV2MinSegmentCount, items = null) => {
  const width = commercialV2SegmentSize.width * normalizeSegmentCount(segmentCount);
  const bounds = items ? getLayoutBounds(items) : null;
  return {
    width,
    height: bounds ? Math.ceil(bounds.maxY + commercialV2StageBottomPadding) : commercialV2SegmentSize.height
  };
};
const boardAssetBox = (type, width, height, index) => {
  if (type === '天空' && width > 900) {
    return { x: 0, y: -28 + index * 18, w: 2048, h: Math.round((2048 / width) * height) };
  }
  const maxWidth = type === '道路' ? 360 : 240;
  const scale = Math.min(1, maxWidth / width);
  return {
    x: (type === '道路' ? 72 : 120) + (index % 5) * (type === '道路' ? 135 : 92),
    y: (type === '道路' ? 690 : 70) + (index % 4) * (type === '道路' ? 38 : 32),
    w: Math.round(width * scale),
    h: Math.round(height * scale)
  };
};
const makeBoardAsset = (group, type, [id, name, width, height], index) => ({
  id: `${group}_${id}`,
  name,
  type,
  path: `game-ready/${group}-background-board/${id}.png`,
  box: boardAssetBox(type, width, height, index)
});
const makeSkyStripAsset = ([id, name, width, height], index) => ({
  id: `sky_${id}`,
  name,
  type: '天空',
  path: `game-ready/sky-background-board/${id}_cropped.png`,
  naturalWidth: width,
  naturalHeight: height,
  box: boardAssetBox('天空', width, height, index)
});
const commercialV2RoadAssets = [
  ['asphalt_patch', '沥青补丁', 185, 92],
  ['cracked_asphalt_patch', '裂纹路面', 183, 84],
  ['crosswalk_horizontal', '横向斑马线', 272, 200],
  ['crosswalk_vertical', '竖向斑马线', 116, 202],
  ['curb_ramp_tile', '无障碍路缘坡', 191, 112],
  ['curb_strip_short_a', '短路缘 A', 130, 30],
  ['curb_strip_short_b', '短路缘 B', 130, 30],
  ['curb_strip_short_c', '短路缘 C', 130, 34],
  ['curb_wall_long', '长路缘墙', 307, 56],
  ['lane_marking_single', '单车道线', 31, 102],
  ['manhole_cover', '圆井盖', 150, 118],
  ['puddle_decal', '路面积水', 186, 70],
  ['road_corner_inner_left', '内弯路左', 160, 175],
  ['road_corner_inner_right', '内弯路右', 157, 175],
  ['road_corner_lower_left', '下弯路左', 194, 152],
  ['road_corner_lower_right', '下弯路右', 175, 142],
  ['road_curve_outer', '外弯道路', 160, 166],
  ['road_intersection_cross', '道路十字口', 360, 164],
  ['road_lane_wide', '宽车道', 549, 150],
  ['road_strip_drain', '排水路段', 407, 95],
  ['road_strip_plain', '直道路段', 406, 96],
  ['road_t_junction', 'T 字路口', 192, 161],
  ['road_tile_dashed_line', '虚线路块', 187, 232],
  ['road_tile_double_white_line', '双白线路块', 209, 232],
  ['road_tile_plain', '普通路块', 212, 231],
  ['road_tile_yellow_line', '黄线路块', 178, 232],
  ['sidewalk_ramp_strip', '人行道坡段', 264, 91],
  ['sidewalk_transition_a', '人行道过渡 A', 190, 91],
  ['sidewalk_transition_b', '人行道过渡 B', 160, 91],
  ['sidewalk_transition_c', '人行道过渡 C', 190, 90],
  ['stone_wall_long', '石墙路缘', 362, 50],
  ['storm_drain', '排水栅', 120, 97],
  ['straight_arrow_marking', '直行箭头', 76, 113],
  ['turn_arrow_marking', '转向箭头', 104, 86],
  ['red_curb_strip', '红砖路缘', 317, 56],
  ['cobblestone_strip', '鹅卵石路带', 339, 52]
].map((entry, index) => makeBoardAsset('road', '道路', entry, index));
const commercialV2RoadExtraAssets = Array.from({ length: 119 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `road_extra_${number}`,
    name: `路面扩展 ${number}`,
    type: '道路',
    path: `game-ready/road-extra-background-board/road_extra_${number}.png`,
    box: boardAssetBox('道路', 128, 104, index + commercialV2RoadAssets.length)
  };
});
const commercialV2CleanCloudAssets = [
  ['clean_cloud_01', '云朵 01', 378, 56],
  ['clean_cloud_02', '云朵 02', 279, 42],
  ['clean_cloud_03', '云朵 03', 282, 47],
  ['clean_cloud_04', '云朵 04', 195, 36],
  ['clean_cloud_05', '云朵 05', 152, 37],
  ['clean_cloud_06', '云朵 06', 99, 43],
  ['clean_cloud_07', '云朵 07', 175, 52],
  ['clean_cloud_08', '云朵 08', 118, 39],
  ['clean_cloud_09', '云朵 09', 92, 37],
  ['clean_cloud_10', '云朵 10', 145, 45],
  ['clean_cloud_11', '云朵 11', 179, 45],
  ['clean_cloud_12', '云朵 12', 168, 39],
  ['clean_cloud_13', '云朵 13', 281, 57],
  ['clean_cloud_14', '云朵 14', 252, 62],
  ['clean_cloud_15', '云朵 15', 200, 55],
  ['clean_cloud_16', '云朵 16', 217, 67],
  ['clean_cloud_17', '云朵 17', 214, 55],
  ['clean_cloud_18', '云朵 18', 287, 80],
  ['clean_cloud_19', '云朵 19', 315, 92],
  ['clean_cloud_20', '云朵 20', 338, 73],
  ['clean_cloud_21', '云朵 21', 276, 68],
  ['clean_cloud_22', '云朵 22', 268, 26],
  ['clean_cloud_23', '云朵 23', 188, 26],
  ['clean_cloud_24', '云朵 24', 226, 23],
  ['clean_cloud_25', '云朵 25', 301, 24],
  ['clean_cloud_26', '云朵 26', 229, 23],
  ['clean_cloud_27', '云朵 27', 670, 64],
  ['clean_cloud_28', '云朵 28', 682, 58]
].map(([id, name, width, height], index) => ({
  id: `sky_${id}`,
  name,
  type: '天空',
  path: `game-ready/sky-clean-cloud-board/${id}.png`,
  box: boardAssetBox('天空', width, height, index + 4)
}));
const commercialV2SkyAssets = [
  ['sky_day_strip_a', '蓝天背景 A', 1464, 180],
  ['sky_day_strip_b', '蓝天背景 B', 1464, 162],
  ['sky_sunrise_strip', '日出天空', 1464, 153],
  ['sky_evening_strip', '傍晚天空', 1464, 161]
].map((entry, index) => makeSkyStripAsset(entry, index)).concat(commercialV2CleanCloudAssets);
const greeneryPath = (name) => `game-ready/greenery-background-board/${name}.png`;
const commercialV2GreeneryAssets = [
  { id: 'greenery_bush_cluster_large', name: '大灌木丛', type: '绿化', path: greeneryPath('bush_cluster_large'), box: { x: 96, y: 650, w: 180, h: 107 } },
  { id: 'greenery_bush_cluster_mixed', name: '混合灌木丛', type: '绿化', path: greeneryPath('bush_cluster_mixed'), box: { x: 298, y: 650, w: 190, h: 91 } },
  { id: 'greenery_bush_island_long_flowers', name: '花灌木带', type: '绿化', path: greeneryPath('bush_island_long_flowers'), box: { x: 520, y: 650, w: 232, h: 86 } },
  { id: 'greenery_bush_island_round_plain', name: '圆灌木岛', type: '绿化', path: greeneryPath('bush_island_round_plain'), box: { x: 780, y: 650, w: 162, h: 88 } },
  { id: 'greenery_bush_island_round_small', name: '小圆灌木岛', type: '绿化', path: greeneryPath('bush_island_round_small'), box: { x: 970, y: 650, w: 91, h: 78 } },
  { id: 'greenery_bush_island_small_flowers', name: '小花灌木岛', type: '绿化', path: greeneryPath('bush_island_small_flowers'), box: { x: 1090, y: 650, w: 138, h: 81 } },
  { id: 'greenery_bush_low_single', name: '矮灌木', type: '绿化', path: greeneryPath('bush_low_single'), box: { x: 1250, y: 650, w: 101, h: 86 } },
  { id: 'greenery_bush_round_single', name: '圆灌木', type: '绿化', path: greeneryPath('bush_round_single'), box: { x: 1380, y: 650, w: 81, h: 69 } },
  { id: 'greenery_cypress_tall', name: '高柏树', type: '绿化', path: greeneryPath('cypress_tall'), box: { x: 1490, y: 560, w: 72, h: 155 } },
  { id: 'greenery_cypress_medium', name: '中柏树', type: '绿化', path: greeneryPath('cypress_medium'), box: { x: 1588, y: 580, w: 64, h: 137 } },
  { id: 'greenery_cypress_small', name: '小柏树', type: '绿化', path: greeneryPath('cypress_small'), box: { x: 1678, y: 610, w: 57, h: 107 } },
  { id: 'greenery_flower_bush_pink', name: '粉花灌木', type: '绿化', path: greeneryPath('flower_bush_pink'), box: { x: 96, y: 760, w: 93, h: 83 } },
  { id: 'greenery_flower_bush_purple', name: '紫花灌木', type: '绿化', path: greeneryPath('flower_bush_purple'), box: { x: 218, y: 760, w: 92, h: 84 } },
  { id: 'greenery_flower_bush_white', name: '白花灌木', type: '绿化', path: greeneryPath('flower_bush_white'), box: { x: 340, y: 760, w: 94, h: 84 } },
  { id: 'greenery_flower_bush_white_small', name: '小白花灌木', type: '绿化', path: greeneryPath('flower_bush_white_small'), box: { x: 464, y: 760, w: 91, h: 83 } },
  { id: 'greenery_flower_bush_yellow', name: '黄花灌木', type: '绿化', path: greeneryPath('flower_bush_yellow'), box: { x: 588, y: 760, w: 94, h: 85 } },
  { id: 'greenery_grass_clump_flowers', name: '花草丛', type: '绿化', path: greeneryPath('grass_clump_flowers'), box: { x: 712, y: 770, w: 106, h: 76 } },
  { id: 'greenery_grass_clump_tall', name: '高草丛', type: '绿化', path: greeneryPath('grass_clump_tall'), box: { x: 850, y: 770, w: 90, h: 79 } },
  { id: 'greenery_hedge_low_cluster', name: '低矮绿篱丛', type: '绿化', path: greeneryPath('hedge_low_cluster'), box: { x: 980, y: 750, w: 137, h: 77 } },
  { id: 'greenery_hedge_strip_flowers_mixed', name: '混合花绿篱', type: '绿化', path: greeneryPath('hedge_strip_flowers_mixed'), box: { x: 1140, y: 742, w: 212, h: 90 } },
  { id: 'greenery_hedge_strip_flowers_pink_a', name: '粉花绿篱 A', type: '绿化', path: greeneryPath('hedge_strip_flowers_pink_a'), box: { x: 1380, y: 742, w: 215, h: 92 } },
  { id: 'greenery_hedge_strip_flowers_pink_b', name: '粉花绿篱 B', type: '绿化', path: greeneryPath('hedge_strip_flowers_pink_b'), box: { x: 1625, y: 742, w: 251, h: 92 } },
  { id: 'greenery_hedge_strip_flowers_white', name: '白花绿篱', type: '绿化', path: greeneryPath('hedge_strip_flowers_white'), box: { x: 96, y: 858, w: 233, h: 91 } },
  { id: 'greenery_hedge_strip_plain_a', name: '绿篱条 A', type: '绿化', path: greeneryPath('hedge_strip_plain_a'), box: { x: 360, y: 858, w: 221, h: 92 } },
  { id: 'greenery_hedge_strip_plain_b', name: '绿篱条 B', type: '绿化', path: greeneryPath('hedge_strip_plain_b'), box: { x: 612, y: 858, w: 241, h: 91 } },
  { id: 'greenery_stone_planter_bushes', name: '石砌灌木台', type: '绿化', path: greeneryPath('stone_planter_bushes'), box: { x: 884, y: 826, w: 188, h: 117 } },
  { id: 'greenery_tree_cherry_large', name: '大花树', type: '绿化', path: greeneryPath('tree_cherry_large'), box: { x: 1100, y: 562, w: 139, h: 207 } },
  { id: 'greenery_tree_cherry_medium', name: '中花树', type: '绿化', path: greeneryPath('tree_cherry_medium'), box: { x: 1265, y: 615, w: 118, h: 166 } },
  { id: 'greenery_tree_green_large', name: '大绿树', type: '绿化', path: greeneryPath('tree_green_large'), box: { x: 1410, y: 540, w: 131, h: 223 } },
  { id: 'greenery_tree_green_medium', name: '中绿树', type: '绿化', path: greeneryPath('tree_green_medium'), box: { x: 1570, y: 595, w: 118, h: 181 } },
  { id: 'greenery_tree_green_small', name: '小绿树', type: '绿化', path: greeneryPath('tree_green_small'), box: { x: 1715, y: 630, w: 103, h: 149 } },
  { id: 'greenery_wood_planter_flower_hedge_long', name: '长木花槽', type: '绿化', path: greeneryPath('wood_planter_flower_hedge_long'), box: { x: 96, y: 920, w: 298, h: 87 } },
  { id: 'greenery_wood_planter_flowers_small', name: '木花箱灌木', type: '绿化', path: greeneryPath('wood_planter_flowers_small'), box: { x: 430, y: 920, w: 151, h: 89 } }
];
const streetClutterPath = (name) => `game-ready/street-clutter/${name}.png`;
const commercialV2StreetClutterAssets = [
  { id: 'prop_trash_bin', name: '垃圾桶', type: '街道', path: streetClutterPath('prop_trash_bin'), box: { x: 1840, y: 596, w: 70, h: 96 } },
  { id: 'prop_utility_pole_flyers', name: '招贴电线杆', type: '街道', path: streetClutterPath('prop_utility_pole_flyers'), box: { x: 1888, y: 354, w: 56, h: 150 } },
  { id: 'prop_parking_bollards', name: '停车桩', type: '街道', path: streetClutterPath('prop_parking_bollards'), box: { x: 1700, y: 520, w: 46, h: 120 } },
  { id: 'prop_delivery_box', name: '外卖箱', type: '街道', path: streetClutterPath('prop_delivery_box'), box: { x: 1382, y: 650, w: 92, h: 88 } },
  { id: 'prop_shopping_bag', name: '购物纸袋', type: '街道', path: streetClutterPath('prop_shopping_bag'), box: { x: 720, y: 660, w: 60, h: 92 } },
  { id: 'prop_takeout_cup', name: '外带饮料杯', type: '街道', path: streetClutterPath('prop_takeout_cup'), box: { x: 790, y: 672, w: 50, h: 77 } },
  { id: 'prop_sidewalk_menu_sign', name: '街边菜单牌', type: '街道', path: streetClutterPath('prop_sidewalk_menu_sign'), box: { x: 1010, y: 268, w: 86, h: 106 } },
  { id: 'prop_traffic_cone', name: '施工锥', type: '街道', path: streetClutterPath('prop_traffic_cone'), box: { x: 1628, y: 650, w: 66, h: 88 } },
  { id: 'prop_parcel_locker', name: '快递柜', type: '街道', path: streetClutterPath('prop_parcel_locker'), box: { x: 1508, y: 528, w: 116, h: 136 } },
  { id: 'prop_cardboard_boxes', name: '纸箱堆', type: '街道', path: streetClutterPath('prop_cardboard_boxes'), box: { x: 1330, y: 610, w: 108, h: 104 } },
  { id: 'prop_wall_poster_board', name: '墙面招贴板', type: '街道', path: streetClutterPath('prop_wall_poster_board'), box: { x: 664, y: 240, w: 112, h: 100 } },
  { id: 'prop_road_barrier', name: '道路护栏', type: '街道', path: streetClutterPath('prop_road_barrier'), box: { x: 1760, y: 666, w: 132, h: 88 } }
];
const largeLifePropPath = (name) => `game-ready/large-life-props-simple/${name}.png`;
const commercialV2LargeLifePropAssets = [
  { id: 'prop_simple_parcel_locker', name: '简化快递柜', type: '街道', path: largeLifePropPath('prop_simple_parcel_locker'), box: { x: 1532, y: 486, w: 210, h: 179 } },
  { id: 'prop_simple_bulletin_board', name: '简化公告栏', type: '街道', path: largeLifePropPath('prop_simple_bulletin_board'), box: { x: 96, y: 454, w: 218, h: 183 } },
  { id: 'prop_simple_recycling_bins', name: '简化回收站', type: '街道', path: largeLifePropPath('prop_simple_recycling_bins'), box: { x: 1730, y: 522, w: 204, h: 153 } },
  { id: 'prop_simple_produce_stand', name: '简化果蔬架', type: '街道', path: largeLifePropPath('prop_simple_produce_stand'), box: { x: 1360, y: 568, w: 210, h: 189 } },
  { id: 'prop_simple_bike_shelter', name: '简化自行车棚', type: '街道', path: largeLifePropPath('prop_simple_bike_shelter'), box: { x: 286, y: 514, w: 208, h: 173 } },
  { id: 'prop_simple_vending_corner', name: '简化售货角', type: '街道', path: largeLifePropPath('prop_simple_vending_corner'), box: { x: 1278, y: 250, w: 218, h: 183 } },
  { id: 'prop_simple_delivery_cart', name: '简化货箱推车', type: '街道', path: largeLifePropPath('prop_simple_delivery_cart'), box: { x: 1246, y: 586, w: 206, h: 148 } },
  { id: 'prop_simple_service_tent', name: '简化服务帐篷', type: '街道', path: largeLifePropPath('prop_simple_service_tent'), box: { x: 538, y: 548, w: 210, h: 192 } }
];
const commercialV2AssetCatalogAll = [
  { id: 'building_agency', name: '房产中介所', type: '建筑', path: 'game-ready/building_agency.png', box: { x: 18, y: 20, w: 402, h: 400 } },
  { id: 'building_convenience', name: '便利店', type: '建筑', path: 'game-ready/building_convenience.png', box: { x: 545, y: 32, w: 471, h: 378 } },
  { id: 'building_cafe', name: '咖啡馆', type: '建筑', path: 'game-ready/building_cafe.png', box: { x: 1112, y: 30, w: 396, h: 390 } },
  { id: 'building_fruit_shop', name: '水果店', type: '建筑', path: 'game-ready/building_fruit_shop.png', box: { x: 1450, y: 290, w: 330, h: 228 } },
  { id: 'building_apartment_villa', name: '公寓住宅', type: '建筑', path: 'game-ready/building_apartment_villa.png', box: { x: 1500, y: 20, w: 430, h: 412 } },
  { id: 'building_casino', name: '赌场', type: '建筑', path: 'game-ready/building_casino.png', box: { x: 520, y: 60, w: 610, h: 404 } },
  { id: 'building_hacker_den', name: '黑客据点', type: '建筑', path: 'game-ready/building_hacker_den.png', box: { x: 1190, y: 145, w: 300, h: 345 } },
  { id: 'building_school', name: '学校', type: '建筑', path: 'game-ready/building_school.png', box: { x: 80, y: 36, w: 620, h: 292 } },
  { id: 'building_hospital', name: '医院', type: '建筑', path: 'game-ready/building_hospital.png', box: { x: 690, y: 52, w: 500, h: 307 } },
  { id: 'building_factory', name: '工厂', type: '建筑', path: 'game-ready/building_factory.png', box: { x: 1260, y: 60, w: 520, h: 307 } },
  { id: 'prop_notice_board', name: '租房公告牌', type: '租房', path: 'game-ready/prop_notice_board.png', box: { x: 405, y: 240, w: 143, h: 190 } },
  { id: 'prop_agency_sign', name: '中介立牌', type: '租房', path: 'game-ready/prop_agency_sign.png', box: { x: 330, y: 250, w: 100, h: 180 } },
  { id: 'prop_vending_machine', name: '自动售货机', type: '街道', path: 'game-ready/prop_vending_machine.png', box: { x: 585, y: 250, w: 70, h: 170 } },
  { id: 'prop_food_truck', name: '餐车', type: '街道', path: 'game-ready/prop_food_truck.png', box: { x: 1480, y: 610, w: 330, h: 251 } },
  { id: 'prop_chalkboard', name: '小黑板', type: '街道', path: 'game-ready/prop_chalkboard.png', box: { x: 938, y: 262, w: 109, h: 146 } },
  { id: 'prop_cafe_table', name: '咖啡桌椅', type: '街道', path: 'game-ready/prop_cafe_table.png', box: { x: 1248, y: 318, w: 160, h: 107 } },
  { id: 'prop_mailbox', name: '邮筒', type: '街道', path: 'game-ready/prop_mailbox.png', box: { x: 1448, y: 608, w: 70, h: 140 } },
  { id: 'prop_street_lamp', name: '路灯', type: '街道', path: 'game-ready/prop_street_lamp.png', box: { x: 118, y: 512, w: 100, h: 228 } },
  { id: 'prop_bicycle', name: '自行车', type: '街道', path: 'game-ready/prop_bicycle.png', box: { x: 226, y: 646, w: 130, h: 92 } },
  { id: 'prop_bench', name: '长椅', type: '街道', path: 'game-ready/prop_bench.png', box: { x: 452, y: 666, w: 136, h: 72 } },
  { id: 'prop_flower_box', name: '花箱', type: '装饰', path: 'game-ready/prop_flower_box.png', box: { x: 632, y: 670, w: 158, h: 65 } },
  { id: 'prop_bus_stop', name: '公交站', type: '街道', path: 'game-ready/prop_bus_stop.png', box: { x: 1110, y: 532, w: 218, h: 203 } },
  { id: 'prop_tree_green', name: '绿树', type: '装饰', path: 'game-ready/prop_tree_green.png', box: { x: 0, y: 300, w: 96, h: 148 } },
  { id: 'prop_tree_cherry', name: '花树', type: '装饰', path: 'game-ready/prop_tree_cherry.png', box: { x: 1000, y: 298, w: 96, h: 150 } },
  { id: 'prop_fruit_stall', name: '水果摊', type: '街道', path: 'game-ready/prop_fruit_stall.png', box: { x: 250, y: 575, w: 155, h: 150 } },
  ...commercialV2StreetClutterAssets,
  ...commercialV2LargeLifePropAssets,
  ...commercialV2RoadAssets,
  ...commercialV2RoadExtraAssets,
  ...commercialV2SkyAssets,
  ...commercialV2GreeneryAssets
];

const _commercialV2LegacyDefaultLayout = [
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe4bv2u-24",
    "x": 5712,
    "y": 560,
    "w": 322,
    "h": 259
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe4ccxq-25",
    "x": -158,
    "y": 558,
    "w": 322,
    "h": 259
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wsqx-15",
    "x": 115,
    "y": 558,
    "w": 322,
    "h": 259
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wtip-19",
    "x": 409,
    "y": 556,
    "w": 322,
    "h": 259
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wswp-16",
    "x": 699,
    "y": 578,
    "w": 298,
    "h": 240
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wtnd-20",
    "x": 962,
    "y": 577,
    "w": 298,
    "h": 240
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wu6x-24",
    "x": 1214,
    "y": 574,
    "w": 298,
    "h": 240
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1ws7l-13",
    "x": 1466,
    "y": 578,
    "w": 298,
    "h": 240
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wt1l-17",
    "x": 1732,
    "y": 579,
    "w": 296,
    "h": 238
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wts1-21",
    "x": 1995,
    "y": 576,
    "w": 298,
    "h": 240
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wsm9-14",
    "x": 2257,
    "y": 576,
    "w": 298,
    "h": 240
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wtdd-18",
    "x": 2520,
    "y": 579,
    "w": 296,
    "h": 238
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1wtwp-22",
    "x": 2788,
    "y": 601,
    "w": 272,
    "h": 219
  },
  {
    "assetId": "sky_sky_day_strip_a",
    "id": "sky_sky_day_strip_a-mpdc262b-1",
    "x": 2942,
    "y": -180,
    "w": 6089,
    "h": 749
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpdc3sya-1",
    "x": 4595,
    "y": 300,
    "w": 390,
    "h": 233,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "prop_tree_green",
    "id": "prop_tree_green-mpdlsz4k-5",
    "x": 2034,
    "y": 12,
    "w": 337,
    "h": 522,
    "collision": {
      "enabled": true,
      "x": 0.36,
      "y": 0.76,
      "w": 0.28,
      "h": 0.2
    }
  },
  {
    "assetId": "greenery_hedge_low_cluster",
    "id": "greenery_hedge_low_cluster-mpdfqyhz-2",
    "x": 4846,
    "y": 377,
    "w": 297,
    "h": 167,
    "collision": {
      "enabled": true,
      "x": 0.06,
      "y": 0.58,
      "w": 0.88,
      "h": 0.34
    }
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfkf54-9",
    "x": 4755,
    "y": 598,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "greenery_bush_cluster_mixed",
    "id": "greenery_bush_cluster_mixed-mpdfvtvi-2",
    "x": 5517,
    "y": 337,
    "w": 416,
    "h": 200,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpe1v2bd-12",
    "x": 3031,
    "y": 599,
    "w": 274,
    "h": 221
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpes6rcw-10",
    "x": -118,
    "y": 362,
    "w": 334,
    "h": 200,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "road_road_strip_plain",
    "id": "road_road_strip_plain-mpdfes4h-3",
    "x": 4146,
    "y": 480,
    "w": 916,
    "h": 215
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdd96h0-3",
    "x": 3263,
    "y": 590,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdd68p9-1",
    "x": 3637,
    "y": 459,
    "w": 170,
    "h": 138
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpdiohwt-7",
    "x": 3570,
    "y": 363,
    "w": 284,
    "h": 164,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfgiw1-4",
    "x": 3512,
    "y": 596,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfgom0-5",
    "x": 3760,
    "y": 597,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfif6w-8",
    "x": 4011,
    "y": 597,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfie3c-6",
    "x": 4503,
    "y": 578,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpdimzvy-5",
    "x": 4368,
    "y": 342,
    "w": 284,
    "h": 164,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpdinzhz-6",
    "x": 3960,
    "y": 337,
    "w": 284,
    "h": 164,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfif28-7",
    "x": 4255,
    "y": 596,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "road_road_strip_plain",
    "id": "road_road_strip_plain-mpdfeqex-2",
    "x": 3908,
    "y": 479,
    "w": 916,
    "h": 215
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpdltliq-6",
    "x": 2157,
    "y": 210,
    "w": 623,
    "h": 372,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "greenery_hedge_low_cluster",
    "id": "greenery_hedge_low_cluster-mpe6aa26-5",
    "x": 2906,
    "y": 353,
    "w": 296,
    "h": 166,
    "collision": {
      "enabled": true,
      "x": 0.06,
      "y": 0.58,
      "w": 0.88,
      "h": 0.34
    }
  },
  {
    "assetId": "road_road_strip_plain",
    "id": "road_road_strip_plain-mpdqc0mf-4",
    "x": 2147,
    "y": 477,
    "w": 958,
    "h": 225
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpdq4yr5-7",
    "x": 3124,
    "y": 365,
    "w": 245,
    "h": 146,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "greenery_hedge_low_cluster",
    "id": "greenery_hedge_low_cluster-mpeuxjr5-6",
    "x": 1344,
    "y": 213,
    "w": 471,
    "h": 262,
    "collision": {
      "enabled": true,
      "x": 0.06,
      "y": 0.58,
      "w": 0.88,
      "h": 0.34
    }
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpe659lz-8",
    "x": 1114,
    "y": 306,
    "w": 390,
    "h": 233,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "road_road_strip_plain",
    "id": "road_road_strip_plain-mpe21p0w-6",
    "x": 1192,
    "y": 473,
    "w": 978,
    "h": 233
  },
  {
    "assetId": "building_school",
    "id": "building_school-mpdlshph-1",
    "x": 1397,
    "y": 57,
    "w": 1062,
    "h": 499,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.86,
      "w": 0.84,
      "h": 0.12
    }
  },
  {
    "assetId": "road_road_strip_plain",
    "id": "road_road_strip_plain-mpdd50d8-1",
    "x": 3066,
    "y": 480,
    "w": 916,
    "h": 215
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpe6k23f-9",
    "x": 248,
    "y": 317,
    "w": 361,
    "h": 216,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "building_agency",
    "id": "building_agency-1",
    "x": 3246,
    "y": 139,
    "w": 390,
    "h": 390,
    "collision": {
      "enabled": true,
      "x": 0.066,
      "y": 0.95,
      "w": 0.84,
      "h": 0.04
    }
  },
  {
    "assetId": "greenery_hedge_low_cluster",
    "id": "greenery_hedge_low_cluster-mpe61l5k-3",
    "x": 2329,
    "y": 437,
    "w": 274,
    "h": 154,
    "collision": {
      "enabled": true,
      "x": 0.06,
      "y": 0.58,
      "w": 0.88,
      "h": 0.34
    }
  },
  {
    "assetId": "building_convenience",
    "id": "building_convenience-1",
    "x": 3701,
    "y": 233,
    "w": 428,
    "h": 341,
    "collision": {
      "enabled": true,
      "x": 0.07,
      "y": 0.91,
      "w": 0.86,
      "h": 0.05
    }
  },
  {
    "assetId": "building_apartment_villa",
    "id": "building_apartment_villa-mpctwa7n-1",
    "x": 2518,
    "y": -1,
    "w": 620,
    "h": 596,
    "collision": {
      "enabled": true,
      "x": -0.006,
      "y": 0.86,
      "w": 1.024,
      "h": 0.14
    }
  },
  {
    "assetId": "prop_tree_green",
    "id": "prop_tree_green-1",
    "x": 3128,
    "y": 271,
    "w": 188,
    "h": 293,
    "collision": {
      "enabled": true,
      "x": 0.36,
      "y": 0.76,
      "w": 0.28,
      "h": 0.2
    }
  },
  {
    "assetId": "building_cafe",
    "id": "building_cafe-1",
    "x": 4150,
    "y": 176,
    "w": 400,
    "h": 396,
    "collision": {
      "enabled": true,
      "x": 0.06,
      "y": 0.92,
      "w": 0.88,
      "h": 0.05
    }
  },
  {
    "assetId": "prop_notice_board",
    "id": "prop_notice_board-1",
    "x": 3159,
    "y": 550,
    "w": 172,
    "h": 232,
    "collision": {
      "enabled": true,
      "x": 0.14,
      "y": 0.672,
      "w": 0.721,
      "h": 0.302
    }
  },
  {
    "assetId": "prop_agency_sign",
    "id": "prop_agency_sign-1",
    "x": 3624,
    "y": 416,
    "w": 96,
    "h": 172,
    "collision": {
      "enabled": true,
      "x": 0.18,
      "y": 0.68,
      "w": 0.64,
      "h": 0.28
    }
  },
  {
    "assetId": "prop_tree_green",
    "id": "prop_tree_green-mpc2c32q-3",
    "x": 4591,
    "y": 234,
    "w": 214,
    "h": 330,
    "collision": {
      "enabled": true,
      "x": 0.36,
      "y": 0.76,
      "w": 0.28,
      "h": 0.2
    }
  },
  {
    "assetId": "prop_chalkboard",
    "id": "prop_chalkboard-2",
    "x": 3351,
    "y": 572,
    "w": 136,
    "h": 182,
    "collision": {
      "enabled": true,
      "x": 0.065,
      "y": 0.638,
      "w": 0.893,
      "h": 0.408
    },
    "placeAnchor": {
      "x": 0.51,
      "y": 1.154
    }
  },
  {
    "assetId": "prop_vending_machine",
    "id": "prop_vending_machine-1",
    "x": 4556,
    "y": 339,
    "w": 89,
    "h": 224,
    "collision": {
      "enabled": true,
      "x": 0.12,
      "y": 0.64,
      "w": 0.76,
      "h": 0.32
    }
  },
  {
    "assetId": "prop_cafe_table",
    "id": "prop_cafe_table-1",
    "x": 3501,
    "y": 688,
    "w": 207,
    "h": 138,
    "collision": {
      "enabled": true,
      "x": 0.14,
      "y": 0.56,
      "w": 0.72,
      "h": 0.38
    }
  },
  {
    "assetId": "prop_fruit_stall",
    "id": "prop_fruit_stall-mpciwj3b-1",
    "x": 4739,
    "y": 358,
    "w": 224,
    "h": 215,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "prop_bicycle",
    "id": "prop_bicycle-1",
    "x": 3875,
    "y": 490,
    "w": 171,
    "h": 120,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.58,
      "w": 0.84,
      "h": 0.34
    }
  },
  {
    "assetId": "prop_bus_stop",
    "id": "prop_bus_stop-1",
    "x": 4411,
    "y": 499,
    "w": 317,
    "h": 296,
    "collision": {
      "enabled": true,
      "x": 0.144,
      "y": 0.691,
      "w": 0.8,
      "h": 0.22
    }
  },
  {
    "assetId": "prop_food_truck",
    "id": "prop_food_truck-mpctvuoq-1",
    "x": 3983,
    "y": 532,
    "w": 359,
    "h": 272,
    "collision": {
      "enabled": true,
      "x": 0.12,
      "y": 0.75,
      "w": 0.76,
      "h": 0.05
    },
    "placeAnchor": {
      "x": 0.488,
      "y": 1.016
    }
  },
  {
    "assetId": "prop_mailbox",
    "id": "prop_mailbox-1",
    "x": 3040,
    "y": 632,
    "w": 69,
    "h": 150,
    "collision": {
      "enabled": true,
      "x": 0.18,
      "y": 0.66,
      "w": 0.64,
      "h": 0.3
    },
    "placeAnchor": {
      "x": 0.541,
      "y": 1.136
    }
  },
  {
    "assetId": "prop_tree_green",
    "id": "prop_tree_green-mpdftrby-5",
    "x": 5311,
    "y": 93,
    "w": 332,
    "h": 513,
    "collision": {
      "enabled": true,
      "x": 0.36,
      "y": 0.76,
      "w": 0.28,
      "h": 0.2
    }
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfuhqm-10",
    "x": 4999,
    "y": 599,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfuldq-11",
    "x": 5240,
    "y": 599,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "road_extra_41",
    "id": "road_extra_41-mpdfupce-12",
    "x": 5477,
    "y": 601,
    "w": 280,
    "h": 226
  },
  {
    "assetId": "road_road_strip_plain",
    "id": "road_road_strip_plain-mpe21odk-5",
    "x": 405,
    "y": 473,
    "w": 978,
    "h": 233
  },
  {
    "assetId": "road_road_strip_plain",
    "id": "road_road_strip_plain-mpe21p6g-7",
    "x": 8,
    "y": 473,
    "w": 978,
    "h": 233
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpes7x4w-11",
    "x": 4888,
    "y": 522,
    "w": 309,
    "h": 185,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "road_road_strip_plain",
    "id": "road_road_strip_plain-mpe4b0fa-8",
    "x": -524,
    "y": 473,
    "w": 972,
    "h": 231
  },
  {
    "assetId": "greenery_bush_cluster_large",
    "id": "greenery_bush_cluster_large-mpdfv4ny-3",
    "x": 5459,
    "y": 354,
    "w": 390,
    "h": 233,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.62,
      "w": 0.84,
      "h": 0.32
    }
  },
  {
    "assetId": "building_casino",
    "id": "building_casino-mpdqd8v3-1",
    "x": 522,
    "y": 119,
    "w": 684,
    "h": 454,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.86,
      "w": 0.84,
      "h": 0.12
    }
  },
  {
    "assetId": "building_hacker_den",
    "id": "building_hacker_den-mpdqdf8v-1",
    "x": 74,
    "y": 214,
    "w": 300,
    "h": 345,
    "collision": {
      "enabled": true,
      "x": 0.08,
      "y": 0.86,
      "w": 0.84,
      "h": 0.12
    }
  },
  {
    "assetId": "sky_clean_cloud_10",
    "id": "sky_clean_cloud_10-mpe70vtc-3",
    "x": 4510,
    "y": 34,
    "w": 572,
    "h": 177
  },
  {
    "assetId": "greenery_hedge_low_cluster",
    "id": "greenery_hedge_low_cluster-mpdfwtni-3",
    "x": 5572,
    "y": 491,
    "w": 374,
    "h": 212,
    "collision": {
      "enabled": true,
      "x": 0.06,
      "y": 0.58,
      "w": 0.88,
      "h": 0.34
    }
  },
  {
    "assetId": "building_hospital",
    "id": "building_hospital-mpdfsfem-1",
    "x": 4961,
    "y": 147,
    "w": 694,
    "h": 421,
    "collision": {
      "enabled": true,
      "x": 0.029,
      "y": 0.819,
      "w": 0.994,
      "h": 0.5
    },
    "placeAnchor": {
      "x": 0.484,
      "y": 1.357
    }
  },
  {
    "assetId": "greenery_tree_green_medium",
    "id": "greenery_tree_green_medium-mpes4lgw-1",
    "x": 5580,
    "y": 457,
    "w": 202,
    "h": 310,
    "collision": {
      "enabled": true,
      "x": 0.34,
      "y": 0.76,
      "w": 0.32,
      "h": 0.2
    }
  },
  {
    "assetId": "greenery_hedge_low_cluster",
    "id": "greenery_hedge_low_cluster-mpes7r1j-6",
    "x": 4868,
    "y": 627,
    "w": 235,
    "h": 132,
    "collision": {
      "enabled": true,
      "x": 0.06,
      "y": 0.58,
      "w": 0.88,
      "h": 0.34
    }
  }
];
const commercialV2SceneAssetIds = new Set(_commercialV2LegacyDefaultLayout.map((item) => item.assetId));
const commercialV2AssetCatalog = commercialV2AssetCatalogAll.filter((asset) => commercialV2SceneAssetIds.has(asset.id));
const commercialV2AutoAppendAssetIds = new Set([
  'prop_simple_bulletin_board',
  'prop_simple_bike_shelter',
  'prop_simple_delivery_cart',
  'prop_simple_service_tent',
  'prop_simple_produce_stand',
  'prop_simple_parcel_locker',
  'prop_simple_recycling_bins',
  'prop_simple_vending_corner'
]);

function readStoredCommercialLayout() {
  const defaultState = getDefaultCommercialLayoutState();
  try {
    const raw = localStorage.getItem(commercialV2StorageKey);
    if (!raw) return defaultState;
    if (raw.length > commercialV2MaxStorageBytes) {
      localStorage.removeItem(commercialV2StorageKey);
      return defaultState;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultState;
    const savedCanvas = readStoredCommercialCanvas();
    const rawItems = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(rawItems)) return defaultState;
    let segmentCount = normalizeSegmentCount(
      savedCanvas?.segmentCount || parsed.segmentCount || parsed.segments || getRequiredSegmentCount(rawItems)
    );
    const assetMap = new Map(commercialV2AssetCatalog.map((asset) => [asset.id, asset]));
    let stageSize = { width: getCommercialV2StageSize(segmentCount).width, height: 1024 };
    let cleaned = rawItems
      .slice(0, commercialV2MaxSavedItems)
      .filter((item) => item && assetMap.has(item.assetId))
      .map((item) => {
        const asset = assetMap.get(item.assetId);
        return clampBox(normalizeCommercialV2ItemAspect({
          assetId: item.assetId,
          id: String(item.id || `${item.assetId}-${Date.now().toString(36)}`),
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          collision: item.collision && typeof item.collision === 'object'
            ? normalizeCommercialV2Collision(migrateCommercialV2Collision(item.collision, asset), asset)
            : undefined,
          placeAnchor: normalizeCommercialV2PlaceAnchor(item.placeAnchor) || undefined,
          groundLayer: item.groundLayer === true ? true : undefined,
          foregroundLayer: item.foregroundLayer === true ? true : undefined
        }, asset), stageSize);
      });
    if (!cleaned.length) {
      localStorage.removeItem(commercialV2StorageKey);
      localStorage.removeItem(commercialV2CanvasStorageKey);
      return defaultState;
    }
    if (Array.isArray(parsed)) {
      const usedAssetIds = new Set(cleaned.map((item) => item.assetId));
      const missingDefaultLifeProps = _commercialV2LegacyDefaultLayout
        .filter((item) => commercialV2AutoAppendAssetIds.has(item.assetId) && !usedAssetIds.has(item.assetId))
        .map((item) => clampBox(item, stageSize));
      cleaned = missingDefaultLifeProps.length ? [...cleaned, ...missingDefaultLifeProps] : cleaned;
    }
    cleaned = normalizeCommercialV2ItemLayerOrder(cleaned, assetMap);
    const requiredSegmentCount = getRequiredSegmentCount(cleaned);
    if (requiredSegmentCount > segmentCount) {
      segmentCount = requiredSegmentCount;
      stageSize = getCommercialV2StageSize(segmentCount, cleaned);
      cleaned = cleaned.map((item) => clampBox(item, stageSize));
    }
    stageSize = getCommercialV2StageSize(segmentCount, cleaned);
    cleaned = cleaned.map((item) => clampBox(item, stageSize));
    return { segmentCount, items: cleaned };
  } catch {
    localStorage.removeItem(commercialV2StorageKey);
    return defaultState;
  }
}

function readStoredCommercialCanvas() {
  try {
    const raw = localStorage.getItem(commercialV2CanvasStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...parsed,
      segmentCount: normalizeSegmentCount(parsed.segmentCount)
    };
  } catch {
    localStorage.removeItem(commercialV2CanvasStorageKey);
    return null;
  }
}

function normalizeCommercialV2LayoutState(rawItems, segmentCountValue = commercialV2MinSegmentCount) {
  if (!Array.isArray(rawItems)) return null;
  const assetMap = new Map(commercialV2AssetCatalog.map((asset) => [asset.id, asset]));
  let segmentCount = normalizeSegmentCount(segmentCountValue || getRequiredSegmentCount(rawItems));
  let stageSize = { width: getCommercialV2StageSize(segmentCount).width, height: 1024 };
  let cleaned = rawItems
    .slice(0, commercialV2MaxSavedItems)
    .filter((item) => item && assetMap.has(item.assetId))
    .map((item) => {
      const asset = assetMap.get(item.assetId);
      return clampBox(normalizeCommercialV2ItemAspect({
        assetId: item.assetId,
        id: String(item.id || `${item.assetId}-${Date.now().toString(36)}`),
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        collision: item.collision && typeof item.collision === 'object'
          ? normalizeCommercialV2Collision(migrateCommercialV2Collision(item.collision, asset), asset)
          : undefined,
        placeAnchor: normalizeCommercialV2PlaceAnchor(item.placeAnchor) || undefined,
        groundLayer: item.groundLayer === true ? true : undefined,
        foregroundLayer: item.foregroundLayer === true ? true : undefined
      }, asset), stageSize);
    });
  if (!cleaned.length) return null;
  cleaned = normalizeCommercialV2ItemLayerOrder(cleaned, assetMap);
  const requiredSegmentCount = getRequiredSegmentCount(cleaned);
  if (requiredSegmentCount > segmentCount) {
    segmentCount = requiredSegmentCount;
  }
  stageSize = getCommercialV2StageSize(segmentCount, cleaned);
  cleaned = cleaned.map((item) => clampBox(item, stageSize));
  return { segmentCount, items: cleaned };
}

function readStoredCommercialResetBackup() {
  try {
    const raw = localStorage.getItem(commercialV2ResetBackupStorageKey);
    if (!raw) return null;
    if (raw.length > commercialV2MaxStorageBytes) {
      localStorage.removeItem(commercialV2ResetBackupStorageKey);
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeCommercialV2LayoutState(parsed?.items, parsed?.segmentCount);
    if (!normalized) return null;
    return {
      ...normalized,
      selectedId: String(parsed?.selectedId || normalized.items[0]?.id || ''),
      savedAt: Number(parsed?.savedAt || Date.now())
    };
  } catch {
    localStorage.removeItem(commercialV2ResetBackupStorageKey);
    return null;
  }
}

function readStoredCommercialDefaultSnapshot() {
  try {
    const raw = localStorage.getItem(commercialV2DefaultSnapshotStorageKey);
    if (!raw) return null;
    if (raw.length > commercialV2MaxStorageBytes) {
      localStorage.removeItem(commercialV2DefaultSnapshotStorageKey);
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeCommercialV2LayoutState(parsed?.items, parsed?.segmentCount);
    if (!normalized) return null;
    return {
      ...normalized,
      selectedId: String(parsed?.selectedId || normalized.items[0]?.id || ''),
      savedAt: Number(parsed?.savedAt || Date.now())
    };
  } catch {
    localStorage.removeItem(commercialV2DefaultSnapshotStorageKey);
    return null;
  }
}

function getBuiltInDefaultCommercialItems() {
  const assetMap = new Map(commercialV2AssetCatalog.map((asset) => [asset.id, asset]));
  const segmentCount = getRequiredSegmentCount(_commercialV2LegacyDefaultLayout);
  const stageSize = { width: getCommercialV2StageSize(segmentCount).width, height: 1024 };
  const items = _commercialV2LegacyDefaultLayout.map((item) => {
    const asset = assetMap.get(item.assetId);
    return clampBox(normalizeCommercialV2ItemAspect({
      ...item,
      collision: item.collision && typeof item.collision === 'object'
        ? normalizeCommercialV2Collision(migrateCommercialV2Collision(item.collision, asset), asset)
        : undefined
    }, asset), stageSize);
  });
  return normalizeCommercialV2ItemLayerOrder(items, assetMap);
}

function getDefaultCommercialLayoutState() {
  const savedDefault = readStoredCommercialDefaultSnapshot();
  if (savedDefault?.items?.length) return savedDefault;
  const items = getBuiltInDefaultCommercialItems();
  return {
    segmentCount: getRequiredSegmentCount(items),
    selectedId: items[0]?.id || '',
    items
  };
}

function normalizeSegmentCount(value) {
  return Math.max(
    commercialV2MinSegmentCount,
    Math.min(commercialV2MaxSegmentCount, Math.round(Number(value) || commercialV2MinSegmentCount))
  );
}

function getRequiredSegmentCount(items) {
  if (!items.length) return commercialV2MinSegmentCount;
  const rightmostAnchor = items.reduce((maxX, item) => {
    const x = Number(item.x || 0);
    const w = Math.max(0, Number(item.w || 0));
    if (!Number.isFinite(x) || x < 0) return maxX;
    return Math.max(maxX, x + Math.min(w, commercialV2LoopSeamMargin));
  }, 1);
  return normalizeSegmentCount(Math.ceil(Math.max(1, rightmostAnchor) / commercialV2SegmentSize.width));
}

function clampBox(box, stageSize = getCommercialV2StageSize()) {
  const w = Math.max(8, Math.round(Number(box.w || 80)));
  const h = Math.max(8, Math.round(Number(box.h || 80)));
  return {
    ...box,
    x: Math.round(Math.max(-w + commercialV2LoopSeamMargin, Math.min(stageSize.width - commercialV2LoopSeamMargin, Number(box.x || 0)))),
    y: Math.round(Math.max(-h + commercialV2LoopSeamMargin, Math.min(stageSize.height - commercialV2LoopSeamMargin, Number(box.y || 0)))),
    w,
    h
  };
}

function wrapLoopBox(box, stageSize = getCommercialV2StageSize()) {
  const w = Math.max(8, Math.round(Number(box.w || 80)));
  const minX = -w + commercialV2LoopSeamMargin;
  const maxX = stageSize.width - commercialV2LoopSeamMargin;
  let x = Number(box.x || 0);
  if (Number.isFinite(x) && stageSize.width > 0) {
    while (x < minX) x += stageSize.width;
    while (x > maxX) x -= stageSize.width;
  }
  return clampBox({ ...box, x }, stageSize);
}

function wrapLoopCoordinate(value, width) {
  if (!Number.isFinite(value) || width <= 0) return 0;
  return ((value % width) + width) % width;
}

function getCommercialV2LoopDeltaX(fromX, toX, width) {
  if (!Number.isFinite(fromX) || !Number.isFinite(toX) || width <= 0) return 0;
  let delta = toX - fromX;
  if (delta > width / 2) delta -= width;
  if (delta < -width / 2) delta += width;
  return delta;
}

function isCommercialV2WalkableAsset(assetId) {
  return String(assetId || '').startsWith('road_');
}

function isCommercialV2MainRoadAsset(assetId) {
  const id = String(assetId || '');
  return id.startsWith('road_road_strip')
    || id.startsWith('road_road_lane')
    || id.startsWith('road_road_tile')
    || id.startsWith('road_road_intersection')
    || id.startsWith('road_road_t_junction')
    || id.startsWith('road_road_corner')
    || id.startsWith('road_road_curve')
    || id === 'road_extra_41'
    || id === 'road_asphalt_patch'
    || id === 'road_cracked_asphalt_patch';
}

function isCommercialV2StreetCruiseRoadAsset(assetId) {
  const id = String(assetId || '');
  return id.startsWith('road_road_strip')
    || id.startsWith('road_road_lane')
    || id.startsWith('road_road_tile')
    || id.startsWith('road_road_intersection')
    || id.startsWith('road_road_t_junction')
    || id.startsWith('road_road_corner')
    || id.startsWith('road_road_curve')
    || id === 'road_asphalt_patch'
    || id === 'road_cracked_asphalt_patch';
}

function isCommercialV2SkyLayerAsset(asset) {
  return asset?.type === '天空';
}

function isCommercialV2RoadGroundLayerAsset(asset) {
  return asset?.type === '道路';
}

function isCommercialV2BackgroundSceneryAsset(asset) {
  return String(asset?.id || '').startsWith('greenery_');
}

function isCommercialV2BackgroundSceneryItem(item, asset) {
  if (!item || !asset || item.foregroundLayer === true) return false;
  return item.groundLayer === true || isCommercialV2BackgroundSceneryAsset(asset);
}

function isCommercialV2GroundLayerAsset(asset) {
  return isCommercialV2SkyLayerAsset(asset) || isCommercialV2RoadGroundLayerAsset(asset);
}

function isCommercialV2GroundLayerItem(item, asset) {
  return Boolean(asset && (
    isCommercialV2GroundLayerAsset(asset)
    || isCommercialV2BackgroundSceneryItem(item, asset)
  ));
}

function getCommercialV2ItemLayerRank(item, asset) {
  if (isCommercialV2SkyLayerAsset(asset)) return 0;
  if (isCommercialV2BackgroundSceneryItem(item, asset)) return 1;
  if (isCommercialV2RoadGroundLayerAsset(asset)) return 2;
  return 3;
}

function normalizeCommercialV2ItemLayerOrder(items, assetById = null) {
  const assetMap = assetById || new Map(commercialV2AssetCatalog.map((asset) => [asset.id, asset]));
  return items
    .map((item, index) => ({
      item,
      index,
      rank: getCommercialV2ItemLayerRank(item, assetMap.get(item.assetId))
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}

function isCommercialV2DynamicOcclusionItem(item, asset) {
  return Boolean(item && asset) && !isCommercialV2GroundLayerItem(item, asset);
}

function canCommercialV2ItemCollisionTakeEffect(item, asset) {
  return Boolean(item && asset) && !isCommercialV2GroundLayerItem(item, asset);
}

function getCommercialV2PlaceLink(asset) {
  if (!asset || isCommercialV2GroundLayerAsset(asset)) return null;
  return commercialV2PlaceLinkByAssetId[asset.id] || null;
}

function getCommercialV2PlaceLocationIds(placeLink) {
  if (!placeLink) return [];
  const ids = Array.isArray(placeLink.locationIds)
    ? placeLink.locationIds
    : [placeLink.locationId || placeLink.placeId];
  return [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
}

function normalizeCommercialV2PlaceAnchor(anchor) {
  if (!anchor || typeof anchor !== 'object') return null;
  const x = Number(anchor.x);
  const y = Number(anchor.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: roundCommercialV2Ratio(x),
    y: roundCommercialV2Ratio(y)
  };
}

function buildCommercialV2ItemPlace(item, asset) {
  const placeLink = getCommercialV2PlaceLink(asset);
  if (!placeLink) return null;
  const manualAnchor = normalizeCommercialV2PlaceAnchor(item.placeAnchor);
  const anchor = manualAnchor || placeLink.anchor || { x: 0.5, y: 1 };
  const anchorRatio = {
    x: roundCommercialV2Ratio(Number(anchor.x)),
    y: roundCommercialV2Ratio(Number(anchor.y))
  };
  const anchorPoint = {
    x: Math.round(item.x + item.w * anchorRatio.x),
    y: Math.round(item.y + item.h * anchorRatio.y)
  };
  return {
    id: `${placeLink.placeId}:${item.id}`,
    placeId: placeLink.placeId,
    locationId: placeLink.locationId || placeLink.placeId,
    locationIds: getCommercialV2PlaceLocationIds(placeLink),
    name: placeLink.label || asset.name,
    kind: placeLink.kind || asset.type,
    itemId: item.id,
    assetId: item.assetId,
    anchor: anchorPoint,
    anchorRatio,
    manualAnchor: Boolean(manualAnchor),
    facing: placeLink.facing || 'front',
    actions: placeLink.actions || [],
    aliases: placeLink.aliases || []
  };
}

function buildCommercialV2Places(items, assetById) {
  return items
    .map((item) => buildCommercialV2ItemPlace(item, assetById.get(item.assetId)))
    .filter(Boolean);
}

function getCommercialV2PlaceAnchorLocalPoint(item, asset) {
  const place = buildCommercialV2ItemPlace(item, asset);
  if (!place) return null;
  return {
    x: Math.round(place.anchor.x - item.x),
    y: Math.round(place.anchor.y - item.y)
  };
}

function buildCommercialV2TravelTargetOptions(places) {
  const optionMap = new Map();
  const usedLabels = new Set();
  places.forEach((place) => {
    [place.placeId, ...place.locationIds].forEach((id) => {
      const targetId = String(id || '').trim();
      if (!targetId || optionMap.has(targetId)) return;
      const label = commercialV2TravelLabelById[targetId] || place.name || targetId;
      if (usedLabels.has(label)) return;
      usedLabels.add(label);
      optionMap.set(targetId, {
        id: targetId,
        label
      });
    });
  });
  return Array.from(optionMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));
}

function getCommercialV2TravelAction(place, targetId) {
  if (!place) return '到达';
  if (targetId === 'street') return '闲逛中';
  if (targetId === 'park') return '散步中';
  if (targetId === 'factory') return '打工中';
  if (targetId === 'school') return '学习中';
  if (targetId === 'hospital') return '治疗中';
  if (targetId === 'convenience') return '购物中';
  if (targetId === 'restaurant') return '吃饭中';
  if (targetId === 'casino') return '试试运气中';
  if (targetId === 'home' || targetId === 'home_exit') return '回家中';
  if (targetId === 'agency' || place.kind === 'housing') return '咨询房源中';
  return place.actions?.[0] ? `${place.actions[0]}中` : '互动中';
}

function pushCommercialV2PathHeap(heap, node) {
  heap.push(node);
  let index = heap.length - 1;
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    if (heap[parentIndex].priority <= node.priority) break;
    heap[index] = heap[parentIndex];
    index = parentIndex;
  }
  heap[index] = node;
}

function popCommercialV2PathHeap(heap) {
  if (!heap.length) return null;
  const first = heap[0];
  const last = heap.pop();
  if (heap.length && last) {
    let index = 0;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      if (leftIndex >= heap.length) break;
      const childIndex = rightIndex < heap.length && heap[rightIndex].priority < heap[leftIndex].priority
        ? rightIndex
        : leftIndex;
      if (heap[childIndex].priority >= last.priority) break;
      heap[index] = heap[childIndex];
      index = childIndex;
    }
    heap[index] = last;
  }
  return first;
}

function isCommercialV2CollisionAsset(asset) {
  return Boolean(asset);
}

function roundCommercialV2Ratio(value) {
  return Number(value.toFixed(3));
}

function isSameCommercialV2Collision(a, b) {
  if (!a || !b) return false;
  return ['x', 'y', 'w', 'h'].every((key) => Math.abs(Number(a[key]) - Number(b[key])) < 0.001);
}

function migrateCommercialV2Collision(collision, asset) {
  if (!collision || typeof collision !== 'object' || !asset) return collision;
  const legacyList = commercialV2LegacyCollisionByAssetId[asset.id];
  const legacyMatches = Array.isArray(legacyList)
    ? legacyList.some((legacy) => isSameCommercialV2Collision(collision, legacy))
    : isSameCommercialV2Collision(collision, legacyList);
  if (!legacyMatches) return collision;
  return {
    ...collision,
    ...commercialV2CollisionByAssetId[asset.id]
  };
}

function getCommercialV2DefaultCollision(asset) {
  if (!asset) {
    return { enabled: false, x: 0, y: 0, w: 1, h: 1 };
  }
  if (asset.type === '天空') return { enabled: false, x: 0, y: 0, w: 1, h: 1 };
  if (asset.type === '道路') return { enabled: false, x: 0, y: 0, w: 1, h: 1 };
  const typeDefault = commercialV2CollisionByType[asset.type] || commercialV2CollisionByType.街道;
  let specific = commercialV2CollisionByAssetId[asset.id];
  if (!specific && asset.id.startsWith('greenery_tree_')) {
    specific = { x: 0.34, y: 0.76, w: 0.32, h: 0.2 };
  } else if (!specific && asset.id.startsWith('greenery_grass_')) {
    specific = { x: 0.08, y: 0.54, w: 0.84, h: 0.38 };
  } else if (!specific && asset.id.startsWith('greenery_bush_')) {
    specific = { x: 0.08, y: 0.62, w: 0.84, h: 0.32 };
  } else if (!specific && asset.id.startsWith('greenery_hedge_')) {
    specific = { x: 0.06, y: 0.58, w: 0.88, h: 0.34 };
  } else if (!specific && asset.id.startsWith('greenery_cypress_')) {
    specific = { x: 0.34, y: 0.76, w: 0.32, h: 0.2 };
  } else if (!specific && asset.id.startsWith('prop_simple_')) {
    specific = { x: 0.08, y: 0.68, w: 0.84, h: 0.26 };
  }
  return { enabled: true, ...typeDefault, ...specific };
}

function normalizeCommercialV2Collision(collision, asset) {
  const defaults = getCommercialV2DefaultCollision(asset);
  const source = collision && typeof collision === 'object'
    ? { ...defaults, ...collision }
    : defaults;
  const enabled = Boolean(asset) && source.enabled !== false;
  const sourceX = Number(source.x);
  const sourceY = Number(source.y);
  const sourceW = Number(source.w);
  const sourceH = Number(source.h);
  const x = Number.isFinite(sourceX) ? sourceX : defaults.x;
  const y = Number.isFinite(sourceY) ? sourceY : defaults.y;
  const w = Math.max(0.02, Number.isFinite(sourceW) ? sourceW : defaults.w);
  const h = Math.max(0.02, Number.isFinite(sourceH) ? sourceH : defaults.h);
  return {
    enabled,
    x: roundCommercialV2Ratio(x),
    y: roundCommercialV2Ratio(y),
    w: roundCommercialV2Ratio(w),
    h: roundCommercialV2Ratio(h)
  };
}

function getCommercialV2EffectiveCollision(item, asset) {
  const collision = normalizeCommercialV2Collision(item?.collision, asset);
  if (!canCommercialV2ItemCollisionTakeEffect(item, asset)) {
    return { ...collision, enabled: false };
  }
  return collision;
}

function getCommercialV2CollisionLocalBox(item, asset) {
  const collision = getCommercialV2EffectiveCollision(item, asset);
  return {
    enabled: collision.enabled,
    x: Math.round(collision.x * item.w),
    y: Math.round(collision.y * item.h),
    w: Math.round(collision.w * item.w),
    h: Math.round(collision.h * item.h)
  };
}

function getCommercialV2CollisionWorldBox(item, asset) {
  const collision = getCommercialV2EffectiveCollision(item, asset);
  if (!collision.enabled) return null;
  return {
    x: item.x + collision.x * item.w,
    y: item.y + collision.y * item.h,
    w: collision.w * item.w,
    h: collision.h * item.h
  };
}

function getCommercialV2AutoRouteBlockWorldBox(item, asset) {
  if (!canCommercialV2ItemCollisionTakeEffect(item, asset)) return null;
  return getCommercialV2CollisionWorldBox(item, asset);
}

function getCommercialV2PlaceApproachMinY(place) {
  if (!place || !String(place.assetId || '').startsWith('building_')) return null;
  return place.anchor.y - 4;
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

function buildCommercialV2Silhouette(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const columns = Array.from({ length: commercialV2SilhouetteColumnCount }, () => ({
    top: 1,
    bottom: 0,
    filled: false
  }));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= commercialV2SilhouetteAlphaThreshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const columnIndex = Math.min(
        commercialV2SilhouetteColumnCount - 1,
        Math.floor((x / width) * commercialV2SilhouetteColumnCount)
      );
      const column = columns[columnIndex];
      column.filled = true;
      column.top = Math.min(column.top, y / height);
      column.bottom = Math.max(column.bottom, (y + 1) / height);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    bounds: {
      x: minX / width,
      y: minY / height,
      w: (maxX - minX + 1) / width,
      h: (maxY - minY + 1) / height
    },
    columns
  };
}

function loadCommercialV2AssetSilhouette(asset) {
  if (!asset || isCommercialV2GroundLayerAsset(asset)) return Promise.resolve(null);
  if (commercialV2SilhouetteCache.has(asset.id)) return commercialV2SilhouetteCache.get(asset.id);
  const promise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        resolve({
          assetId: asset.id,
          silhouette: buildCommercialV2Silhouette(image)
        });
      } catch {
        resolve({
          assetId: asset.id,
          silhouette: null
        });
      }
    };
    image.onerror = () => resolve({
      assetId: asset.id,
      silhouette: null
    });
    image.src = commercialV2Asset(asset.path);
  });
  commercialV2SilhouetteCache.set(asset.id, promise);
  return promise;
}

function getCommercialV2DepthY(asset) {
  if (!asset) return 1;
  if (commercialV2DepthYByAssetId[asset.id] !== undefined) return commercialV2DepthYByAssetId[asset.id];
  if (asset.id.startsWith('greenery_tree_')) return 0.98;
  if (asset.id.startsWith('greenery_')) return 0.94;
  if (asset.id.startsWith('building_')) return 0.92;
  return commercialV2DepthYByType[asset.type] ?? 0.94;
}

function getCommercialV2SortY(item, asset) {
  return item.y + item.h * getCommercialV2DepthY(asset);
}

function getCommercialV2ItemRenderZIndex(layerIndex, item, asset) {
  if (isCommercialV2SkyLayerAsset(asset)) return commercialV2SkyLayerZIndex + layerIndex;
  if (isCommercialV2BackgroundSceneryItem(item, asset)) return commercialV2BackgroundSceneryLayerZIndex + layerIndex;
  if (isCommercialV2RoadGroundLayerAsset(asset)) return commercialV2GroundLayerZIndex + layerIndex;
  return getCommercialV2ItemZIndex(layerIndex);
}

function getCommercialV2PlayerRenderZIndex(player, tie = 0) {
  return getCommercialV2DepthZIndex(player?.y ?? commercialV2PlayerInitial.y, 500 + tie);
}

function getCommercialV2OcclusionBox(item, asset, silhouette = null) {
  if (!asset || isCommercialV2GroundLayerAsset(asset)) return null;
  const sortYRatio = commercialV2OcclusionSortYRatioByAssetId[asset.id];
  if (silhouette?.bounds) {
    const { bounds } = silhouette;
    return {
      x: item.x + bounds.x * item.w,
      y: item.y + bounds.y * item.h,
      w: bounds.w * item.w,
      h: bounds.h * item.h,
      sortY: item.y + (Number.isFinite(sortYRatio) ? sortYRatio : bounds.y + bounds.h) * item.h,
      silhouette
    };
  }
  const fallbackTop = item.y + item.h * Math.max(0, getCommercialV2DepthY(asset) - 0.18);
  return {
    x: item.x,
    y: fallbackTop,
    w: item.w,
    h: Math.max(1, item.y + item.h - fallbackTop),
    sortY: Number.isFinite(sortYRatio) ? item.y + sortYRatio * item.h : getCommercialV2SortY(item, asset)
  };
}

function getCommercialV2OcclusionLayer(occlusionBox, playerFootY) {
  return occlusionBox.sortY > playerFootY + commercialV2OcclusionDepthMargin ? 'front' : 'back';
}

function getCommercialV2ColumnOcclusionBottom(asset, column, columnIndex, columnCount) {
  const rightCornerCap = commercialV2OcclusionRightCornerCapByAssetId[asset.id];
  if (!rightCornerCap) return column.bottom;
  const columnCenterX = (columnIndex + 0.5) / columnCount;
  if (columnCenterX < rightCornerCap.startX || column.bottom <= rightCornerCap.maxBottom) return column.bottom;
  return rightCornerCap.maxBottom;
}

function isCommercialV2AlwaysBackLowerBody(item, asset, playerBox, itemOffset = 0) {
  if (!commercialV2AlwaysBackLowerBodyAssetIds.has(asset.id)) return false;
  const lowerBodyHeight = Math.min(item.h, Math.max(1, playerBox.h));
  return boxesOverlap(playerBox, {
    x: item.x + itemOffset,
    y: item.y + item.h - lowerBodyHeight,
    w: item.w,
    h: lowerBodyHeight
  });
}

function getCommercialV2OcclusionDecision(item, asset, silhouette, playerBox, playerFootY, itemOffset = 0) {
  const occlusionBox = getCommercialV2OcclusionBox(item, asset, silhouette);
  if (!occlusionBox) return null;
  const shiftedBox = {
    x: occlusionBox.x + itemOffset,
    y: occlusionBox.y,
    w: occlusionBox.w,
    h: occlusionBox.h
  };
  if (!boxesOverlap(playerBox, shiftedBox)) return null;
  if (isCommercialV2AlwaysBackLowerBody(item, asset, playerBox, itemOffset)) return 'back';
  if (!silhouette?.columns?.length || !item.w || !item.h) {
    return getCommercialV2OcclusionLayer(occlusionBox, playerFootY);
  }
  const itemLeft = item.x + itemOffset;
  const itemRight = itemLeft + item.w;
  const overlapLeft = Math.max(playerBox.x, itemLeft);
  const overlapRight = Math.min(playerBox.x + playerBox.w, itemRight);
  if (overlapRight <= overlapLeft) return null;
  const columnCount = silhouette.columns.length;
  const startColumn = Math.max(0, Math.floor(((overlapLeft - itemLeft) / item.w) * columnCount));
  const endColumn = Math.min(columnCount - 1, Math.floor(((overlapRight - itemLeft) / item.w) * columnCount));
  let deepestSilhouetteBottom = -Infinity;
  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    const column = silhouette.columns[columnIndex];
    if (!column?.filled) continue;
    const worldTop = item.y + column.top * item.h;
    const columnBottom = getCommercialV2ColumnOcclusionBottom(asset, column, columnIndex, columnCount);
    const worldBottom = item.y + columnBottom * item.h;
    if (playerBox.y >= worldBottom || playerBox.y + playerBox.h <= worldTop) continue;
    deepestSilhouetteBottom = Math.max(deepestSilhouetteBottom, worldBottom);
  }
  if (!Number.isFinite(deepestSilhouetteBottom)) return null;
  const usesExplicitSortY = Number.isFinite(commercialV2OcclusionSortYRatioByAssetId[asset.id]);
  return getCommercialV2OcclusionLayer({
    ...occlusionBox,
    sortY: usesExplicitSortY ? occlusionBox.sortY : deepestSilhouetteBottom
  }, playerFootY);
}

function serializeCommercialV2Item(item, asset) {
  const next = {
    assetId: item.assetId,
    id: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h
  };
  if (item.groundLayer === true) {
    next.groundLayer = true;
  }
  if (item.foregroundLayer === true) {
    next.foregroundLayer = true;
  }
  const collision = normalizeCommercialV2Collision(item.collision, asset);
  const hasManualCollision = item.collision && typeof item.collision === 'object';
  if (collision.enabled || hasManualCollision || (asset && !isCommercialV2GroundLayerAsset(asset))) {
    next.collision = collision;
  }
  const placeAnchor = normalizeCommercialV2PlaceAnchor(item.placeAnchor);
  if (placeAnchor) {
    next.placeAnchor = placeAnchor;
  }
  return next;
}

function isCommercialV2SkyStripAsset(asset) {
  return asset?.id?.startsWith('sky_sky_');
}

function normalizeCommercialV2ItemAspect(box, asset) {
  const fixedRatio = commercialV2AspectRatioByAssetId[asset?.id];
  if (Number.isFinite(fixedRatio)) {
    const rawX = Number(box.x);
    const rawW = Number(box.w || asset?.box?.w || 80);
    const rawH = Number(box.h || asset?.box?.h || 80);
    const h = Math.max(8, Math.round(Number.isFinite(rawH) ? rawH : 80));
    const currentW = Math.max(8, Math.round(Number.isFinite(rawW) ? rawW : h * fixedRatio));
    const currentRatio = currentW / h;
    if (Math.abs(currentRatio - fixedRatio) > 0.08) {
      const w = Math.max(8, Math.round(h * fixedRatio));
      return {
        ...box,
        x: Number.isFinite(rawX) ? Math.round(rawX - (w - currentW) / 2) : box.x,
        w,
        h
      };
    }
  }
  if (!isCommercialV2SkyStripAsset(asset) || !asset?.naturalWidth || !asset?.naturalHeight) return box;
  const w = Math.max(8, Math.round(Number(box.w || asset.box?.w || 80)));
  const h = Math.max(8, Math.round(w * (asset.naturalHeight / asset.naturalWidth)));
  return { ...box, w, h };
}

function getLayoutBounds(items) {
  if (!items.length) return null;
  return items.reduce((bounds, item) => ({
    minX: Math.min(bounds.minX, item.x),
    minY: Math.min(bounds.minY, item.y),
    maxX: Math.max(bounds.maxX, item.x + item.w),
    maxY: Math.max(bounds.maxY, item.y + item.h)
  }), {
    minX: items[0].x,
    minY: items[0].y,
    maxX: items[0].x + items[0].w,
    maxY: items[0].y + items[0].h
  });
}

function getPointerStagePoint(event, stage, stageSize) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * stageSize.width,
    y: ((event.clientY - rect.top) / rect.height) * stageSize.height
  };
}

export {
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
  commercialV2SkyLayerZIndex,
  commercialV2BackgroundSceneryLayerZIndex,
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
  isCommercialV2BackgroundSceneryAsset,
  isCommercialV2BackgroundSceneryItem,
  isCommercialV2GroundLayerAsset,
  isCommercialV2GroundLayerItem,
  getCommercialV2ItemLayerRank,
  normalizeCommercialV2ItemLayerOrder,
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
};
