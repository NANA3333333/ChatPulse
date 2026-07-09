import {
  commercialV2DefaultPlayerScale,
  commercialV2DefaultZoom,
  commercialV2RoleActorId,
  commercialV2UserActorId,
  commercialV2PlayerFrameOrder,
  commercialV2PlayerCharacters,
  commercialV2DefaultControlledPlayerId,
  commercialV2PlayerCharacterById,
  createCommercialV2PlayerState,
  clampBox,
  normalizeCommercialV2PlaceAnchor,
  normalizeCommercialV2Collision,
  getCommercialV2EffectiveCollision
} from './commercialStreetCore';
import {
  commercialV2BehaviorInteractionDistance,
  commercialV2BehaviorMovementActions,
  createCommercialV2BehaviorTreeState
} from './behaviorTreeCore';

const roomStyleMeta = {
  empty: {
    label: '方形空小屋',
    subtitle: '上墙保留 / 两侧和底部简化 / 等待家具素材接入',
    notes: []
  }
};
const roomEditorStorageKey = 'pixelWorld.room.layout';
const roomEditorCanvasStorageKey = 'pixelWorld.room.canvas';
const roomEditorSizeProfileStorageKey = 'pixelWorld.room.sizeProfile';
const roomEditorAssemblyStorageKey = 'pixelWorld.room.assemblyExperiment';
const roomEditorResetBackupStorageKey = 'pixelWorld.room.resetBackup';
const roomEditorDefaultSnapshotStorageKey = 'pixelWorld.room.defaultSnapshot';
const roomEditorPlayerStorageKey = 'pixelWorld.room.players';
const roomEditorBehaviorTreeStorageKey = 'pixelWorld.room.behaviorTreeState';
const roomEditorLayoutUpdatedEvent = 'pixel-world-room-layout-updated';
const roomEditorMaxStorageBytes = 200000;
const roomEditorMaxSavedItems = 150;
const roomEditorStageSize = { width: 1254, height: 1254 };
const roomEditorAiGridSize = { cols: 16, rows: 16 };
const roomEditorBackgroundColor = '#fbf0f7';
const roomEditorDefaultZoom = 0.52;
const roomEditorLegacyDefaultPlayerScales = [1.75, commercialV2DefaultPlayerScale];
const roomEditorDefaultPlayerScale = Number((commercialV2DefaultPlayerScale * commercialV2DefaultZoom / roomEditorDefaultZoom).toFixed(2));
const roomEditorMinPlayerScale = 1;
const roomEditorMaxPlayerScale = 3.4;
const roomEditorPlayerMoveSpeed = 220;
const roomEditorPlayerRenderIntervalMs = 33;
const roomEditorPlayerBounds = { minX: 130, maxX: 1128, minY: 360, maxY: 1138 };
const roomEditorGroundLayerZIndex = 100;
const roomEditorDepthZIndexBase = 60000;
const roomEditorDepthZIndexScale = 10;
const roomEditorOverlayZIndex = 900000;
const roomEditorPlayerInitials = {
  [commercialV2RoleActorId]: { x: 536, y: 720, direction: 'right' },
  [commercialV2UserActorId]: { x: 688, y: 720, direction: 'left' }
};
const roomEditorBehaviorSafePoints = [
  { id: 'center', label: '房间中央', x: 612, y: 720, direction: 'front' },
  { id: 'bedside', label: '床边', x: 474, y: 875, direction: 'front' },
  { id: 'vanity', label: '梳妆台前', x: 772, y: 790, direction: 'back' },
  { id: 'wardrobe', label: '衣柜前', x: 360, y: 770, direction: 'left' }
];
const roomEditorBackdrop = '/assets/pixel-world/generated-rooms/backgrounds/empty-square-room-v1.png';
const roomEditorAssetVersion = 'room-style-furniture-fresh-macaron-directions-v80-remove-legacy-chairs-20260614';
const roomEditorDefaultSceneAssetIds = new Set([
  'room_front_bed_mint_garden_v1',
  'room_front_mint_bookshelf_v1',
  'room_decor_mint_rug_v1',
  'room_decor_mint_wall_art_v1',
  'room_decor_mint_table_lamp_v1'
]);
const roomEditorRealWorldScaleByKind = {
  bed: 0.78,
  nightstand: 0.52,
  wardrobe: 0.82,
  desk: 0.72,
  vanity: 0.78,
  bookshelf: 0.78,
  sofa: 0.68,
  rug: 0.72,
  floorLamp: 0.63,
  wallArt: 0.66
};
const roomEditorCalibratedSizeProfile = {
  bed: { w: 268, h: 289, sourceAssetId: 'room_front_bed_mint_garden_v1' },
  nightstand: { w: 96, h: 114, sourceAssetId: 'room_front_ocean_nightstand_v1' },
  wardrobe: { w: 193, h: 271, sourceAssetId: 'room_front_ocean_wardrobe_v1' },
  vanity: { w: 213, h: 265, sourceAssetId: 'room_front_ocean_vanity_v1' },
  desk: { w: 430, h: 337, sourceAssetId: 'room_front_peach_desk_v1' },
  bookshelf: { w: 291, h: 444, sourceAssetId: 'room_front_mint_bookshelf_v1' },
  sofa: { w: 526, h: 362, sourceAssetId: 'room_front_mint_sofa_v1' },
  rug: { w: 310, h: 187, sourceAssetId: 'room_decor_mint_rug_v1' },
  floorLamp: { w: 145, h: 258, sourceAssetId: 'room_decor_mint_table_lamp_v1' },
  wallArt: { w: 257, h: 155, sourceAssetId: 'room_decor_mint_wall_art_v1' }
};
const roomEditorDirectionOrder = ['front', 'back', 'left', 'right'];
const roomEditorDirectionLabels = {
  front: '正面',
  back: '背面',
  left: '左侧',
  right: '右侧'
};
const roomEditorDirectionalGroupLabels = {};
const roomEditorDirectionalAliases = {};
const roomEditorDirectionalAliasGroups = new Set(
  Object.values(roomEditorDirectionalAliases).map((meta) => meta.groupId)
);
const roomEditorAiDirectionalGroupIds = new Set([
  'bed_scandinavian_blue',
  'bed_ocean_shell',
  'bed_cloud_dream',
  'bed_pastel_candy',
  'bed_mint_garden',
  'bed_peach_lemon',
  'ocean_nightstand',
  'cloud_nightstand',
  'candy_nightstand',
  'scandinavian_wardrobe',
  'ocean_wardrobe',
  'cloud_wardrobe',
  'candy_wardrobe',
  'scandinavian_desk',
  'scandinavian_bookshelf',
  'scandinavian_sofa',
  'peach_desk',
  'peach_bookshelf',
  'peach_sofa',
  'ocean_vanity',
  'ocean_desk',
  'ocean_sofa',
  'cloud_vanity',
  'cloud_desk',
  'cloud_bookshelf',
  'cloud_sofa',
  'candy_vanity',
  'candy_desk',
  'candy_bookshelf',
  'candy_sofa',
  'mint_bookshelf',
  'mint_sofa'
]);
function getRoomEditorDirectionalMeta(id) {
  const value = String(id || '');
  const alias = roomEditorDirectionalAliases[value];
  const match = value.match(/^room_dir_(.+)_(front|back|left|right)_v1$/);
  if (!alias && !match) return null;
  const groupId = alias?.groupId || match[1];
  const direction = alias?.direction || match[2];
  return {
    groupId,
    direction,
    groupName: roomEditorDirectionalGroupLabels[groupId] || groupId,
    directionLabel: roomEditorDirectionLabels[direction] || direction,
    source: alias ? 'alias' : 'variant'
  };
}
function getRoomEditorRealWorldKind(id = '', path = '', name = '') {
  const value = `${id} ${path} ${name}`.toLowerCase();
  if (value.includes('nightstand')) return 'nightstand';
  if (value.includes('wardrobe')) return 'wardrobe';
  if (value.includes('vanity')) return 'vanity';
  if (value.includes('bookshelf')) return 'bookshelf';
  if (value.includes('sofa')) return 'sofa';
  if (value.includes('desk')) return 'desk';
  if (value.includes('floor-lamp') || value.includes('table-lamp')) return 'floorLamp';
  if (value.includes('wall-art')) return 'wallArt';
  if (value.includes('rug')) return 'rug';
  if (value.includes('bed_') || value.includes('front-bed') || value.includes('direction-bed')) return 'bed';
  return '';
}
function getRoomEditorRealWorldScale(id = '', path = '', name = '') {
  const kind = getRoomEditorRealWorldKind(id, path, name);
  return roomEditorRealWorldScaleByKind[kind] || 1;
}
function scaleRoomEditorBoxToRealWorld(box = {}, scale = 1) {
  const legacyW = Math.max(8, Math.round(Number(box.w || 80)));
  const legacyH = Math.max(8, Math.round(Number(box.h || 80)));
  const nextW = Math.max(8, Math.round(legacyW * scale));
  const nextH = Math.max(8, Math.round(legacyH * scale));
  const centerX = Number(box.x || 0) + legacyW / 2;
  const bottomY = Number(box.y || 0) + legacyH;
  return {
    ...box,
    x: Math.round(centerX - nextW / 2),
    y: Math.round(bottomY - nextH),
    w: nextW,
    h: nextH
  };
}
function applyRoomEditorCalibratedSizeProfile(box = {}, kind = '') {
  const size = roomEditorCalibratedSizeProfile[kind];
  if (!size) return box;
  const currentW = Math.max(8, Number(box.w || size.w));
  const currentH = Math.max(8, Number(box.h || size.h));
  const nextW = Math.max(8, Math.round(Number(size.w || currentW)));
  const nextH = Math.max(8, Math.round(Number(size.h || currentH)));
  const centerX = Number(box.x || 0) + currentW / 2;
  const bottomY = Number(box.y || 0) + currentH;
  return {
    ...box,
    x: Math.round(centerX - nextW / 2),
    y: Math.round(bottomY - nextH),
    w: nextW,
    h: nextH
  };
}
function boxesAreNearlySameSize(boxA = {}, boxB = {}, tolerance = 2) {
  return Math.abs(Math.round(Number(boxA.w || 0)) - Math.round(Number(boxB.w || 0))) <= tolerance
    && Math.abs(Math.round(Number(boxA.h || 0)) - Math.round(Number(boxB.h || 0))) <= tolerance;
}
const roomEditorAssetRows = [
  ['room_front_bed_scandinavian_blue_v1', '北欧蓝白床', '大型家具', 'furniture-front/front-bed-scandinavian-blue-v1.png', { x: 82, y: 754, w: 343, h: 370 }],
  ['room_front_bed_ocean_shell_v1', '海洋贝壳床', '大型家具', 'furniture-front/front-bed-ocean-shell-v1.png', { x: 84, y: 754, w: 333, h: 370 }],
  ['room_front_bed_cloud_dream_v1', '云朵梦幻床', '大型家具', 'furniture-front/front-bed-cloud-dream-v1.png', { x: 82, y: 754, w: 339, h: 370 }],
  ['room_front_bed_pastel_candy_v1', '糖果粉彩床', '大型家具', 'furniture-front/front-bed-pastel-candy-v1.png', { x: 84, y: 754, w: 333, h: 370 }],
  ['room_front_bed_mint_garden_v1', '薄荷花园床', '大型家具', 'furniture-front/front-bed-mint-garden-v1.png', { x: 82, y: 754, w: 343, h: 370 }],
  ['room_front_bed_peach_lemon_v1', '蜜桃柠檬床', '大型家具', 'furniture-front/front-bed-peach-lemon-v1.png', { x: 82, y: 754, w: 343, h: 370 }],
  ['room_front_scandinavian_wardrobe_v1', '北欧衣柜', '北欧蓝白套装', 'furniture-front/front-scandinavian-wardrobe-v1.png', { x: 88, y: 412, w: 235, h: 330 }],
  ['room_front_scandinavian_desk_v1', '北欧书桌', '北欧蓝白套装', 'furniture-front/front-scandinavian-desk-v1.png', { x: 438, y: 630, w: 350, h: 275 }],
  ['room_front_scandinavian_bookshelf_v1', '北欧书柜', '北欧蓝白套装', 'furniture-front/front-scandinavian-bookshelf-v1.png', { x: 840, y: 352, w: 300, h: 390 }],
  ['room_front_scandinavian_sofa_v1', '北欧沙发', '北欧蓝白套装', 'furniture-front/front-scandinavian-sofa-v1.png', { x: 660, y: 750, w: 420, h: 290 }],
  ['room_decor_scandinavian_rug_v1', '北欧雪纹地毯', '装饰', 'decor/decor-scandinavian-rug-v1.png', { x: 420, y: 882, w: 430, h: 260 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_decor_scandinavian_floor_lamp_v1', '北欧落地灯', '装饰', 'decor/decor-scandinavian-floor-lamp-v1.png', { x: 900, y: 526, w: 230, h: 410 }, false, { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 }],
  ['room_decor_scandinavian_wall_art_v1', '北欧雪山挂画', '装饰', 'decor/decor-scandinavian-wall-art-v1.png', { x: 500, y: 302, w: 390, h: 235 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_front_ocean_nightstand_v1', '贝壳床头柜', '海洋贝壳套装', 'furniture-front/front-ocean-nightstand-v1.png', { x: 414, y: 887, w: 185, h: 220 }],
  ['room_front_ocean_wardrobe_v1', '贝壳衣柜', '海洋贝壳套装', 'furniture-front/front-ocean-wardrobe-v1.png', { x: 88, y: 412, w: 235, h: 330 }],
  ['room_front_ocean_vanity_v1', '贝壳梳妆台', '海洋贝壳套装', 'furniture-front/front-ocean-vanity-v1.png', { x: 476, y: 506, w: 271, h: 340 }],
  ['room_front_ocean_desk_v1', '贝壳书桌', '海洋贝壳套装', 'furniture-front/front-ocean-desk-v1.png', { x: 438, y: 630, w: 350, h: 275 }],
  ['room_front_ocean_sofa_v1', '贝壳沙发', '海洋贝壳套装', 'furniture-front/front-ocean-sofa-v1.png', { x: 660, y: 750, w: 420, h: 290 }],
  ['room_decor_ocean_rug_v1', '贝壳华毯', '装饰', 'decor/decor-ocean-rug-v1.png', { x: 420, y: 882, w: 430, h: 260 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_decor_ocean_floor_lamp_v1', '贝壳落地灯', '装饰', 'decor/decor-ocean-floor-lamp-v1.png', { x: 906, y: 526, w: 230, h: 410 }, false, { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 }],
  ['room_decor_ocean_wall_art_v1', '贝壳海景画', '装饰', 'decor/decor-ocean-wall-art-v1.png', { x: 520, y: 320, w: 360, h: 205 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_front_cloud_nightstand_v1', '云朵床头柜', '云朵梦幻套装', 'furniture-front/front-cloud-nightstand-v1.png', { x: 414, y: 887, w: 185, h: 220 }],
  ['room_front_cloud_wardrobe_v1', '云朵衣柜', '云朵梦幻套装', 'furniture-front/front-cloud-wardrobe-v1.png', { x: 88, y: 412, w: 235, h: 330 }],
  ['room_front_cloud_vanity_v1', '云朵梳妆台', '云朵梦幻套装', 'furniture-front/front-cloud-vanity-v1.png', { x: 476, y: 506, w: 260, h: 340 }],
  ['room_front_cloud_desk_v1', '云朵书桌', '云朵梦幻套装', 'furniture-front/front-cloud-desk-v1.png', { x: 438, y: 630, w: 350, h: 275 }],
  ['room_front_cloud_bookshelf_v1', '云朵书架', '云朵梦幻套装', 'furniture-front/front-cloud-bookshelf-v1.png', { x: 840, y: 352, w: 300, h: 390 }],
  ['room_front_cloud_sofa_v1', '云朵沙发', '云朵梦幻套装', 'furniture-front/front-cloud-sofa-v1.png', { x: 660, y: 750, w: 420, h: 290 }],
  ['room_decor_cloud_rug_v1', '云月华毯', '装饰', 'decor/decor-cloud-rug-v1.png', { x: 420, y: 882, w: 430, h: 260 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_decor_cloud_floor_lamp_v1', '云朵落地灯', '装饰', 'decor/decor-cloud-floor-lamp-v1.png', { x: 894, y: 506, w: 250, h: 430 }, false, { enabled: true, x: 0.34, y: 0.8, w: 0.32, h: 0.16 }],
  ['room_decor_cloud_wall_art_v1', '云月星空画', '装饰', 'decor/decor-cloud-wall-art-v1.png', { x: 500, y: 302, w: 390, h: 235 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_front_candy_nightstand_v1', '糖果床头柜', '糖果粉彩套装', 'furniture-front/front-candy-nightstand-v1.png', { x: 414, y: 887, w: 185, h: 220 }],
  ['room_front_candy_wardrobe_v1', '糖果衣柜', '糖果粉彩套装', 'furniture-front/front-candy-wardrobe-v1.png', { x: 88, y: 412, w: 235, h: 330 }],
  ['room_front_candy_vanity_v1', '糖果梳妆台', '糖果粉彩套装', 'furniture-front/front-candy-vanity-v1.png', { x: 476, y: 506, w: 273, h: 340 }],
  ['room_front_candy_desk_v1', '糖果书桌', '糖果粉彩套装', 'furniture-front/front-candy-desk-v1.png', { x: 438, y: 630, w: 350, h: 275 }],
  ['room_front_candy_bookshelf_v1', '糖果书架', '糖果粉彩套装', 'furniture-front/front-candy-bookshelf-v1.png', { x: 840, y: 352, w: 300, h: 390 }],
  ['room_front_candy_sofa_v1', '糖果沙发', '糖果粉彩套装', 'furniture-front/front-candy-sofa-v1.png', { x: 660, y: 750, w: 420, h: 290 }],
  ['room_decor_candy_rug_v1', '糖心华毯', '装饰', 'decor/decor-candy-rug-v1.png', { x: 408, y: 872, w: 450, h: 270 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_decor_candy_floor_lamp_v1', '糖果落地灯', '装饰', 'decor/decor-candy-floor-lamp-v1.png', { x: 888, y: 494, w: 270, h: 450 }, false, { enabled: true, x: 0.35, y: 0.82, w: 0.3, h: 0.14 }],
  ['room_decor_candy_wall_art_v1', '糖果甜景画', '装饰', 'decor/decor-candy-wall-art-v1.png', { x: 492, y: 300, w: 420, h: 245 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_front_mint_bookshelf_v1', '薄荷书架', '薄荷花园套装', 'furniture-front/front-mint-bookshelf-v1.png', { x: 840, y: 352, w: 300, h: 390 }],
  ['room_front_mint_sofa_v1', '薄荷沙发', '薄荷花园套装', 'furniture-front/front-mint-sofa-v1.png', { x: 660, y: 750, w: 420, h: 290 }],
  ['room_decor_mint_rug_v1', '薄荷绗缝地毯', '装饰', 'decor/decor-mint-rug-v1.png', { x: 420, y: 882, w: 430, h: 260 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_decor_mint_wall_art_v1', '薄荷花园挂画', '装饰', 'decor/decor-mint-wall-art-v1.png', { x: 500, y: 302, w: 390, h: 235 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_decor_mint_table_lamp_v1', '薄荷花园灯', '装饰', 'decor/decor-mint-table-lamp-v1.png', { x: 900, y: 526, w: 230, h: 410 }, false, { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 }],
  ['room_front_peach_desk_v1', '蜜桃书桌', '蜜桃柠檬套装', 'furniture-front/front-peach-desk-v1.png', { x: 438, y: 630, w: 350, h: 275 }],
  ['room_front_peach_bookshelf_v1', '蜜桃书柜', '蜜桃柠檬套装', 'furniture-front/front-peach-bookshelf-v1.png', { x: 840, y: 352, w: 300, h: 390 }],
  ['room_front_peach_sofa_v1', '蜜桃沙发', '蜜桃柠檬套装', 'furniture-front/front-peach-sofa-v1.png', { x: 660, y: 750, w: 420, h: 290 }],
  ['room_decor_peach_rug_v1', '蜜桃柠檬地毯', '装饰', 'decor/decor-peach-rug-v1.png', { x: 420, y: 882, w: 430, h: 260 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }],
  ['room_decor_peach_floor_lamp_v1', '蜜桃落地灯', '装饰', 'decor/decor-peach-floor-lamp-v1.png', { x: 900, y: 526, w: 230, h: 410 }, false, { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 }],
  ['room_decor_peach_wall_art_v1', '蜜桃柠檬挂画', '装饰', 'decor/decor-peach-wall-art-v1.png', { x: 500, y: 302, w: 390, h: 235 }, false, { enabled: false, x: 0, y: 0, w: 1, h: 1 }]
];
const roomEditorFurniturePriceByAssetId = {
  room_front_bed_scandinavian_blue_v1: 115,
  room_front_scandinavian_wardrobe_v1: 85,
  room_front_scandinavian_desk_v1: 80,
  room_front_scandinavian_bookshelf_v1: 75,
  room_front_scandinavian_sofa_v1: 110,
  room_decor_scandinavian_rug_v1: 38,
  room_decor_scandinavian_floor_lamp_v1: 38,
  room_decor_scandinavian_wall_art_v1: 30,

  room_front_bed_peach_lemon_v1: 70,
  room_front_peach_desk_v1: 50,
  room_front_peach_bookshelf_v1: 45,
  room_front_peach_sofa_v1: 65,
  room_decor_peach_rug_v1: 20,
  room_decor_peach_floor_lamp_v1: 22,
  room_decor_peach_wall_art_v1: 18,

  room_front_bed_mint_garden_v1: 95,
  room_front_mint_bookshelf_v1: 65,
  room_front_mint_sofa_v1: 95,
  room_decor_mint_rug_v1: 32,
  room_decor_mint_table_lamp_v1: 32,
  room_decor_mint_wall_art_v1: 26,

  room_front_bed_ocean_shell_v1: 125,
  room_front_ocean_nightstand_v1: 40,
  room_front_ocean_wardrobe_v1: 100,
  room_front_ocean_vanity_v1: 95,
  room_front_ocean_desk_v1: 100,
  room_front_ocean_sofa_v1: 130,
  room_decor_ocean_rug_v1: 45,
  room_decor_ocean_floor_lamp_v1: 45,
  room_decor_ocean_wall_art_v1: 36,

  room_front_bed_cloud_dream_v1: 165,
  room_front_cloud_nightstand_v1: 55,
  room_front_cloud_wardrobe_v1: 135,
  room_front_cloud_vanity_v1: 130,
  room_front_cloud_desk_v1: 130,
  room_front_cloud_bookshelf_v1: 120,
  room_front_cloud_sofa_v1: 170,
  room_decor_cloud_rug_v1: 60,
  room_decor_cloud_floor_lamp_v1: 58,
  room_decor_cloud_wall_art_v1: 48,

  room_front_bed_pastel_candy_v1: 210,
  room_front_candy_nightstand_v1: 70,
  room_front_candy_wardrobe_v1: 175,
  room_front_candy_vanity_v1: 165,
  room_front_candy_desk_v1: 165,
  room_front_candy_bookshelf_v1: 155,
  room_front_candy_sofa_v1: 220,
  room_decor_candy_rug_v1: 75,
  room_decor_candy_floor_lamp_v1: 70,
  room_decor_candy_wall_art_v1: 60
};
function getRoomEditorBaseFurnitureAssetId(assetId) {
  const value = String(assetId || '');
  const match = value.match(/^room_dir_(.+)_(front|back|left|right)_v1$/);
  return match ? `room_front_${match[1]}_v1` : value;
}
function getRoomEditorFurniturePrice(assetId) {
  const price = roomEditorFurniturePriceByAssetId[getRoomEditorBaseFurnitureAssetId(assetId)];
  return Number.isFinite(Number(price)) ? Number(price) : 0;
}
function getRoomEditorAiDirectionalGroupId(id) {
  const match = String(id || '').match(/^room_front_(.+)_v1$/);
  return match ? match[1] : '';
}
function getRoomEditorAiDirectionalPathSlug(groupId) {
  return String(groupId || '').replace(/_/g, '-');
}
function isRoomEditorBedGroup(groupId) {
  return String(groupId || '').startsWith('bed_');
}
function canBuildRoomEditorAiDirections(id, path) {
  const groupId = getRoomEditorAiDirectionalGroupId(id);
  return Boolean(
    groupId
    && roomEditorAiDirectionalGroupIds.has(groupId)
    && String(path || '').startsWith('furniture-front/front-')
    && !String(path || '').includes('preview')
  );
}
function getRoomEditorAiSideScale() {
  return 1;
}
const roomEditorAiDirectionalSideBoxWidths = {
  bed_cloud_dream: 606,
  bed_mint_garden: 606,
  bed_ocean_shell: 606,
  bed_pastel_candy: 606,
  bed_peach_lemon: 606,
  bed_scandinavian_blue: 606,
  ocean_nightstand: 145,
  cloud_nightstand: 145,
  candy_nightstand: 145,
  ocean_desk: 230,
  ocean_sofa: 285,
  cloud_desk: 230,
  cloud_bookshelf: 165,
  cloud_sofa: 285,
  candy_desk: 230,
  candy_bookshelf: 165,
  candy_sofa: 285,
  mint_bookshelf: 165,
  mint_sofa: 285,
  scandinavian_desk: 230,
  scandinavian_bookshelf: 165,
  scandinavian_sofa: 285,
  peach_desk: 230,
  peach_bookshelf: 165,
  peach_sofa: 285,
  scandinavian_wardrobe: 235,
  ocean_wardrobe: 235,
  cloud_wardrobe: 235,
  candy_wardrobe: 235
};
const roomEditorAiDirectionalSideBoxHeights = {
  ocean_nightstand: 220,
  cloud_nightstand: 220,
  candy_nightstand: 220,
  ocean_desk: 275,
  ocean_sofa: 290,
  cloud_desk: 275,
  cloud_bookshelf: 390,
  cloud_sofa: 290,
  candy_desk: 275,
  candy_bookshelf: 390,
  candy_sofa: 290,
  mint_bookshelf: 390,
  mint_sofa: 290,
  scandinavian_desk: 275,
  scandinavian_bookshelf: 390,
  scandinavian_sofa: 290,
  peach_desk: 275,
  peach_bookshelf: 390,
  peach_sofa: 290,
  scandinavian_wardrobe: 330,
  ocean_wardrobe: 330,
  cloud_wardrobe: 330,
  candy_wardrobe: 330
};
function getRoomEditorDirectionalBox(box = {}, direction = 'front', groupId = '', realWorldScale = 1, sourceLegacyBox = null, options = {}) {
  const isSideDirection = direction === 'left' || direction === 'right';
  const isUniformBack = direction === 'back' && /_(?:wardrobe|nightstand)$/.test(String(groupId || ''));
  if (!isSideDirection && !isUniformBack) return { ...box };
  const w = Math.max(8, Math.round(Number(box.w || 80)));
  const h = Math.max(8, Math.round(Number(box.h || 80)));
  if (isUniformBack) {
    return {
      ...box,
      w,
      h
    };
  }
  const mappedSideW = roomEditorAiDirectionalSideBoxWidths[groupId];
  const mappedSideH = roomEditorAiDirectionalSideBoxHeights[groupId];
  const kind = getRoomEditorRealWorldKind(groupId, '', groupId);
  const calibratedSize = options.calibrated === false ? null : roomEditorCalibratedSizeProfile[kind];
  const legacyW = Math.max(8, Math.round(Number(sourceLegacyBox?.w || box.w || 80)));
  const legacyH = Math.max(8, Math.round(Number(sourceLegacyBox?.h || box.h || 80)));
  const sideW = Math.max(
    24,
    Math.round(mappedSideW
      ? (calibratedSize ? (mappedSideW / legacyW) * calibratedSize.w : mappedSideW * realWorldScale)
      : w * getRoomEditorAiSideScale(box))
  );
  const sideH = Math.max(24, Math.round(mappedSideH
    ? (calibratedSize ? (mappedSideH / legacyH) * calibratedSize.h : mappedSideH * realWorldScale)
    : h));
  return {
    ...box,
    x: Math.round(Number(box.x || 0) + (w - sideW) / 2),
    y: Math.round(Number(box.y || 0) + h - sideH),
    w: sideW,
    h: sideH
  };
}
function makeRoomEditorAsset(
  row,
  directionalOverride = null
) {
  const [id, name, type, path, box, defaultInScene = false, collision = null, placeAnchor = { x: 0.5, y: 1 }] = row;
  const directional = directionalOverride || getRoomEditorDirectionalMeta(id);
  const realWorldKind = getRoomEditorRealWorldKind(id, path, name);
  const realWorldScale = roomEditorRealWorldScaleByKind[realWorldKind] || 1;
  const legacyBox = { ...(box || {}) };
  const displayBox = scaleRoomEditorBoxToRealWorld(legacyBox, realWorldScale);
  const calibratedBox = applyRoomEditorCalibratedSizeProfile(displayBox, realWorldKind);
  return {
    id,
    name: directional ? `${directional.groupName}-${directional.directionLabel}` : name,
    paletteName: directional ? directional.groupName : name,
    type,
    path,
    box: calibratedBox,
    legacyBox,
    realWorldKind,
    realWorldScale,
    defaultInScene: Boolean(defaultInScene || roomEditorDefaultSceneAssetIds.has(id)),
    groundLayer: realWorldKind === 'rug' || realWorldKind === 'wallArt',
    ...(directional ? {
      directional,
      hiddenInPalette: directional.source === 'variant'
        ? directional.direction !== 'front' || roomEditorDirectionalAliasGroups.has(directional.groupId)
        : false
    } : {}),
    ...(collision ? { collision } : {}),
    placeAnchor
  };
}
function makeRoomEditorAiDirectionalVariant(asset, direction) {
  const groupId = asset?.directional?.groupId;
  const slug = getRoomEditorAiDirectionalPathSlug(groupId);
  const directionLabel = roomEditorDirectionLabels[direction] || direction;
  const path = direction === 'back' && isRoomEditorBedGroup(groupId)
    ? asset.path
    : `furniture-directions/ai/direction-${slug}-${direction}-v1.png`;
  return {
    ...asset,
    id: `room_dir_${groupId}_${direction}_v1`,
    name: `${asset.directional.groupName}-${directionLabel}`,
    paletteName: asset.directional.groupName,
    path,
    box: getRoomEditorDirectionalBox(asset.box, direction, groupId, asset.realWorldScale, asset.legacyBox || asset.box),
    legacyBox: getRoomEditorDirectionalBox(asset.legacyBox || asset.box, direction, groupId, 1, asset.legacyBox || asset.box, { calibrated: false }),
    defaultInScene: false,
    directional: {
      ...asset.directional,
      direction,
      directionLabel,
      source: 'variant'
    },
    hiddenInPalette: true
  };
}
function buildRoomEditorAssetCatalog(rows) {
  const baseAssets = rows.map((row) => {
    const [id, name, , path] = row;
    const manualDirectional = getRoomEditorDirectionalMeta(id);
    const aiGroupId = !manualDirectional && canBuildRoomEditorAiDirections(id, path)
      ? getRoomEditorAiDirectionalGroupId(id)
      : '';
    const aiDirectional = aiGroupId ? {
      groupId: aiGroupId,
      direction: 'front',
      groupName: name,
      directionLabel: roomEditorDirectionLabels.front,
      source: 'ai-alias'
    } : null;
    return makeRoomEditorAsset(row, manualDirectional || aiDirectional);
  });
  const aiVariants = baseAssets.flatMap((asset) => {
    if (asset.directional?.source !== 'ai-alias') return [];
    return roomEditorDirectionOrder
      .filter((direction) => direction !== 'front')
      .map((direction) => makeRoomEditorAiDirectionalVariant(asset, direction));
  });
  return [...baseAssets, ...aiVariants];
}
const roomEditorAssetCatalog = buildRoomEditorAssetCatalog(roomEditorAssetRows);
const roomEditorAsset = (path) => {
  const value = String(path || '');
  if (value.startsWith('/assets/')) return value;
  return `/assets/pixel-world/generated-rooms/${value}?v=${roomEditorAssetVersion}`;
};
function buildRoomEditorDirectionalGroups(assetCatalog = roomEditorAssetCatalog) {
  const groups = new Map();
  assetCatalog.forEach((asset) => {
    if (!asset?.directional) return;
    const key = asset.directional.groupId;
    const current = groups.get(key) || {
      id: key,
      name: asset.directional.groupName,
      variants: {}
    };
    const currentVariant = current.variants[asset.directional.direction];
    if (!currentVariant || currentVariant.directional?.source !== 'alias') {
      current.variants[asset.directional.direction] = asset;
    }
    groups.set(key, current);
  });
  return groups;
}
const roomEditorDirectionalGroups = buildRoomEditorDirectionalGroups();
function getRoomEditorDirectionalGroup(asset) {
  if (!asset?.directional) return null;
  return roomEditorDirectionalGroups.get(asset.directional.groupId) || null;
}
function getRoomEditorPaletteAssetName(asset) {
  return asset?.paletteName || asset?.name || '素材';
}

function getRoomEditorAiCellSize(stageSize = roomEditorStageSize) {
  const cols = Math.max(1, Number(roomEditorAiGridSize.cols) || 1);
  const rows = Math.max(1, Number(roomEditorAiGridSize.rows) || 1);
  return {
    w: Number(stageSize?.width || roomEditorStageSize.width) / cols,
    h: Number(stageSize?.height || roomEditorStageSize.height) / rows
  };
}

function makeRoomEditorAiBaseGrid() {
  const cols = Math.max(1, Number(roomEditorAiGridSize.cols) || 1);
  const rows = Math.max(1, Number(roomEditorAiGridSize.rows) || 1);
  return Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => {
    if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) return 'w';
    return 'd';
  }));
}

function formatRoomEditorAiGrid(grid) {
  return grid.map((row) => row.map((cell) => `[${cell}]`).join('')).join('\n');
}

function getRoomEditorAiFurnitureKind(asset) {
  const id = String(asset?.directional?.groupId || asset?.id || '');
  if (id.includes('nightstand')) return 'nightstand';
  if (id.includes('wardrobe')) return 'wardrobe';
  if (id.includes('vanity')) return 'vanity';
  if (id.includes('bed')) return 'bed';
  return 'furniture';
}

function getRoomEditorAiFurnitureToken(asset) {
  const kind = getRoomEditorAiFurnitureKind(asset);
  if (kind === 'nightstand') return 'ns';
  if (kind === 'wardrobe') return 'wd';
  if (kind === 'vanity') return 'va';
  if (kind === 'bed') return 'bed';
  return 'fur';
}

function getRoomEditorAiFurnitureRules(asset) {
  const kind = getRoomEditorAiFurnitureKind(asset);
  if (kind === 'bed') {
    return [
      'prefer_front_to_camera',
      'place_head_or_back_against_wall',
      'prefer_nightstand_adjacent',
      'keep_bed_front_visible',
      'keep_center_floor_clear'
    ];
  }
  if (kind === 'nightstand') {
    return [
      'prefer_front_to_camera',
      'prefer_adjacent_to_bed',
      'do_not_float_in_center',
      'keep_center_floor_clear'
    ];
  }
  if (kind === 'wardrobe') {
    return [
      'must_touch_wall',
      'prefer_front_to_camera',
      'keep_1b_free_in_front',
      'keep_center_floor_clear'
    ];
  }
  if (kind === 'vanity') {
    return [
      'prefer_front_to_camera',
      'mirror_visible_to_camera',
      'prefer_touch_wall',
      'keep_1b_free_in_front',
      'keep_center_floor_clear'
    ];
  }
  return ['prefer_front_to_camera', 'keep_center_floor_clear'];
}

function formatRoomEditorAiFurnitureShape(token, size) {
  const cols = Math.max(1, Number(size?.w) || 1);
  const rows = Math.max(1, Number(size?.h) || 1);
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => `[${token}]`).join('')).join('\n');
}

function getRoomEditorAiItemGridBox(item, stageSize = roomEditorStageSize) {
  const cell = getRoomEditorAiCellSize(stageSize);
  const cols = Math.max(1, Number(roomEditorAiGridSize.cols) || 1);
  const rows = Math.max(1, Number(roomEditorAiGridSize.rows) || 1);
  const x = Math.max(0, Math.min(cols - 1, Math.floor(Number(item?.x || 0) / cell.w)));
  const y = Math.max(0, Math.min(rows - 1, Math.floor(Number(item?.y || 0) / cell.h)));
  return {
    x,
    y,
    w: Math.max(1, Math.ceil(Number(item?.w || 1) / cell.w)),
    h: Math.max(1, Math.ceil(Number(item?.h || 1) / cell.h))
  };
}

function getRoomEditorAiDirectionOptions(item, asset, token, stageSize = roomEditorStageSize) {
  const group = getRoomEditorDirectionalGroup(asset);
  if (!group?.variants) {
    const currentBox = getRoomEditorAiItemGridBox(item, stageSize);
    const direction = asset?.directional?.direction || 'front';
    return [{
      direction,
      assetId: asset?.id || item.assetId,
      size: { w: currentBox.w, h: currentBox.h },
      shape: formatRoomEditorAiFurnitureShape(token, currentBox)
    }];
  }
  const oldBox = asset?.box || item;
  const oldWidth = Math.max(8, Number(oldBox.w || item.w || 8));
  const scale = Math.max(0.05, Number(item.w || oldWidth) / oldWidth);
  return roomEditorDirectionOrder
    .map((direction) => {
      const variant = group.variants?.[direction];
      if (!variant) return null;
      const nextBox = variant.box || oldBox;
      const visualBox = {
        x: item.x,
        y: item.y,
        w: Math.max(8, Math.round(Number(nextBox.w || item.w || 8) * scale)),
        h: Math.max(8, Math.round(Number(nextBox.h || item.h || 8) * scale))
      };
      const gridBox = getRoomEditorAiItemGridBox(visualBox, stageSize);
      return {
        direction,
        assetId: variant.id,
        size: { w: gridBox.w, h: gridBox.h },
        shape: formatRoomEditorAiFurnitureShape(token, gridBox)
      };
    })
    .filter(Boolean);
}

function buildRoomEditorAiFurniture(item, asset, index, stageSize = roomEditorStageSize) {
  const gridBox = getRoomEditorAiItemGridBox(item, stageSize);
  const token = getRoomEditorAiFurnitureToken(asset);
  const directionOptions = getRoomEditorAiDirectionOptions(item, asset, token, stageSize);
  return {
    id: item.id,
    assetId: item.assetId,
    name: asset?.name || item.assetId,
    group: asset?.directional?.groupId || item.assetId,
    kind: getRoomEditorAiFurnitureKind(asset),
    direction: asset?.directional?.direction || 'front',
    token,
    size: { w: gridBox.w, h: gridBox.h },
    current: { x: gridBox.x, y: gridBox.y },
    shape: formatRoomEditorAiFurnitureShape(token, gridBox),
    directionOptions,
    rules: getRoomEditorAiFurnitureRules(asset),
    order: index + 1
  };
}

function buildRoomEditorCurrentAsciiGrid(items, assetById, stageSize = roomEditorStageSize) {
  const grid = makeRoomEditorAiBaseGrid().map((row) => row.slice());
  const cols = Math.max(1, Number(roomEditorAiGridSize.cols) || 1);
  const rows = Math.max(1, Number(roomEditorAiGridSize.rows) || 1);
  items.forEach((item, index) => {
    const asset = assetById.get(item.assetId);
    if (!asset || item.groundLayer) return;
    const box = getRoomEditorAiItemGridBox(item, stageSize);
    const token = `${getRoomEditorAiFurnitureToken(asset)}${index + 1}`;
    for (let y = box.y; y < Math.min(rows, box.y + box.h); y += 1) {
      for (let x = box.x; x < Math.min(cols, box.x + box.w); x += 1) {
        if (grid[y][x] === 'w') continue;
        grid[y][x] = token;
      }
    }
  });
  return grid;
}

function formatRoomEditorAiPrompt(aiLayout) {
  const furnitureLines = aiLayout.furniture.length
    ? aiLayout.furniture.map((item) => {
      const rules = item.rules.length ? ` rules=${item.rules.join(',')}` : '';
      const directions = item.directionOptions?.length
        ? ` directions=${item.directionOptions.map((option) => `${option.direction}:${option.size.w}x${option.size.h}`).join(',')}`
        : '';
      return [
        `${item.id} kind=${item.kind} dir=${item.direction} size=${item.size.w}x${item.size.h} token=[${item.token}]${directions}${rules}`,
        'shape:',
        item.shape
      ].join('\n');
    }).join('\n')
    : 'none';
  return [
    '你是一个像素小屋家具布局 AI。你不会生成图片，只会根据 ASCII 房间地图和家具当前格子尺寸输出家具摆放方案。',
    '',
    `ROOM ${aiLayout.room.size.cols}x${aiLayout.room.size.rows}`,
    'LEGEND: [w]=wall, [d]=floor, [b]=one AI layout cell',
    'MAP:',
    aiLayout.room.ascii,
    '',
    'FURNITURE CURRENT SIZE:',
    furnitureLines,
    '',
    'CURRENT PLACEMENT ASCII:',
    aiLayout.currentAscii,
    '',
    'RULES:',
    '- only place furniture on [d]',
    '- do not cover [w]',
    '- do not overlap furniture',
    '- keep the center floor readable as a walking/standing area instead of filling every empty cell',
    '- front means the furniture face is visible to the camera/player; prefer dir=front for most furniture',
    '- use dir=left/right only when a side view clearly improves wall fit or prevents blocking paths',
    '- use dir=back only for objects that should face the back wall; do not hide mirrors, wardrobe front panels, or decorative fronts',
    '- keep the attractive/usable face visible: bed foot/front, vanity mirror, wardrobe front panels, and nightstand front should not be hidden behind other furniture',
    '- large furniture should touch or visually align with a wall; small furniture should support a nearby large furniture instead of floating alone',
    '- keep at least 1[b] clear in front of wardrobe and vanity interaction sides',
    '- output only PLACE lines: PLACE <id> x=<number> y=<number> dir=<front|back|left|right>'
  ].join('\n');
}

function buildRoomEditorAiLayout(items, assetById, stageSize = roomEditorStageSize) {
  const cell = getRoomEditorAiCellSize(stageSize);
  const roomGrid = makeRoomEditorAiBaseGrid();
  const furniture = items
    .map((item, index) => {
      const asset = assetById.get(item.assetId);
      if (!asset || item.groundLayer) return null;
      return buildRoomEditorAiFurniture(item, asset, index, stageSize);
    })
    .filter(Boolean);
  const currentGrid = buildRoomEditorCurrentAsciiGrid(items, assetById, stageSize);
  const aiLayout = {
    version: 1,
    unit: {
      token: '[b]',
      source: 'ceil(current item pixel box / AI cell pixel size)',
      cellPx: {
        w: Number(cell.w.toFixed(3)),
        h: Number(cell.h.toFixed(3))
      }
    },
    room: {
      size: roomEditorAiGridSize,
      legend: {
        w: 'wall / cannot place furniture',
        d: 'floor / can place furniture'
      },
      ascii: formatRoomEditorAiGrid(roomGrid)
    },
    furniture,
    currentAscii: formatRoomEditorAiGrid(currentGrid),
    outputFormat: 'PLACE <id> x=<number> y=<number> dir=<front|back|left|right>'
  };
  return {
    ...aiLayout,
    prompt: formatRoomEditorAiPrompt(aiLayout)
  };
}

const buildRoomScene = (style) => {
  const meta = roomStyleMeta[style];
  return {
    title: meta.label,
    subtitle: meta.subtitle,
    source: '新方形小屋底图',
    assetNote: '新小屋底图：星露谷式上墙结构，左右和底部保持简化，方便后续叠加家具素材。',
    size: { cols: 32, rows: 32 },
    backdrop: roomEditorBackdrop,
    base: null,
    palette: {},
    map: [],
    structures: [],
    props: [],
    agents: [],
    notes: meta.notes
  };
};

const roomScenes = {
  empty: buildRoomScene('empty')
};

function getRoomEditorDefaultState() {
  const savedDefault = readStoredRoomEditorDefaultSnapshot();
  if (savedDefault?.items?.length) return savedDefault;
  const items = getBuiltInDefaultRoomEditorItems();
  return {
    selectedId: items[0]?.id || '',
    items
  };
}

function getBuiltInDefaultRoomEditorItems() {
  return roomEditorAssetCatalog
    .filter((asset) => asset.defaultInScene)
    .map((asset) => clampBox({
      assetId: asset.id,
      id: `${asset.id}-default`,
      ...asset.box,
      collision: getRoomEditorDefaultCollision(asset),
      placeAnchor: normalizeCommercialV2PlaceAnchor(asset.placeAnchor) || undefined,
      groundLayer: asset.groundLayer === true ? true : undefined
    }, roomEditorStageSize));
}

function isBuiltInDefaultRoomEditorLayoutState(layout) {
  const items = Array.isArray(layout?.items) ? layout.items : [];
  const defaultItems = getBuiltInDefaultRoomEditorItems();
  if (!items.length || items.length !== defaultItems.length) return false;
  const defaultAssetIds = new Set(defaultItems.map((item) => item.assetId));
  return items.every((item) => (
    defaultAssetIds.has(item?.assetId)
    && (String(item?.id || '') === `${item.assetId}-default` || String(item?.id || '').endsWith('-default'))
  ));
}

function getRoomEditorLayoutSavedAt(parsed) {
  const value = Number(parsed?.savedAt || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function readStoredRoomEditorCanvasSnapshot() {
  try {
    const raw = localStorage.getItem(roomEditorCanvasStorageKey);
    if (!raw || raw.length > roomEditorMaxStorageBytes) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function shouldUseRoomEditorAssemblyLayout(normalizedLayout, parsedLayout, assemblyState) {
  if (!assemblyState?.items?.length) return false;
  if (!normalizedLayout?.items?.length) return true;
  if (isBuiltInDefaultRoomEditorLayoutState(normalizedLayout)) return true;

  const assemblySavedAt = getRoomEditorLayoutSavedAt(assemblyState);
  if (!assemblySavedAt) return false;

  const layoutSavedAt = getRoomEditorLayoutSavedAt(parsedLayout);
  if (layoutSavedAt) return assemblySavedAt > layoutSavedAt;

  const canvasSnapshot = readStoredRoomEditorCanvasSnapshot();
  const canvasAssemblySavedAt = getRoomEditorLayoutSavedAt(canvasSnapshot?.assembledBy);
  return canvasAssemblySavedAt >= assemblySavedAt;
}

function normalizeRoomEditorItemAspect(box, asset) {
  if (!asset?.naturalWidth || !asset?.naturalHeight) return box;
  const w = Math.max(8, Math.round(Number(box.w || asset.box?.w || 80)));
  const h = Math.max(8, Math.round(w * (asset.naturalHeight / asset.naturalWidth)));
  return { ...box, w, h };
}

function migrateRoomEditorItemToCurrentAssetBox(item, asset, rawItem = null) {
  const baseW = Math.max(8, Math.round(Number(asset?.box?.w || 0)));
  const baseH = Math.max(8, Math.round(Number(asset?.box?.h || 0)));
  if (!baseW || !baseH) return item;
  const sourceBox = rawItem && typeof rawItem === 'object' ? rawItem : item;
  const currentW = Math.max(8, Math.round(Number(sourceBox.w || item.w || baseW)));
  const currentH = Math.max(8, Math.round(Number(sourceBox.h || item.h || baseH)));
  if (Math.abs(currentW - baseW) <= 2 && Math.abs(currentH - baseH) <= 2) {
    return item;
  }
  const legacyBox = asset?.legacyBox;
  const shouldMigrateRealWorldScale = legacyBox
    && !boxesAreNearlySameSize(asset.box, legacyBox, 2)
    && boxesAreNearlySameSize({ w: currentW, h: currentH }, legacyBox, 4);
  if (!shouldMigrateRealWorldScale) return item;

  const sourceX = Number(sourceBox.x ?? item.x ?? 0);
  const sourceY = Number(sourceBox.y ?? item.y ?? 0);
  const centerX = sourceX + currentW / 2;
  const centerY = sourceY + currentH / 2;
  const bottomY = sourceY + currentH;
  const centeredKinds = new Set(['rug', 'wallArt']);
  const anchorMode = centeredKinds.has(asset?.realWorldKind) ? 'center' : 'bottom';
  return {
    ...item,
    x: Math.round(centerX - baseW / 2),
    y: anchorMode === 'center'
      ? Math.round(centerY - baseH / 2)
      : Math.round(bottomY - baseH),
    w: baseW,
    h: baseH
  };
}

function getRoomEditorItemSizeKind(item, asset) {
  return asset?.realWorldKind || getRoomEditorRealWorldKind(item?.assetId || '', asset?.path || '', asset?.name || '');
}

function getRoomEditorSizeAnchorMode(kind) {
  return kind === 'rug' || kind === 'wallArt' ? 'center' : 'bottom';
}

function resizeRoomEditorItemByKindSize(item, size, kind) {
  const nextW = Math.max(8, Math.round(Number(size?.w || item?.w || 8)));
  const nextH = Math.max(8, Math.round(Number(size?.h || item?.h || 8)));
  const currentW = Math.max(8, Number(item?.w || nextW));
  const currentH = Math.max(8, Number(item?.h || nextH));
  const centerX = Number(item?.x || 0) + currentW / 2;
  const centerY = Number(item?.y || 0) + currentH / 2;
  const bottomY = Number(item?.y || 0) + currentH;
  const anchorMode = getRoomEditorSizeAnchorMode(kind);
  return {
    ...item,
    x: Math.round(centerX - nextW / 2),
    y: anchorMode === 'center'
      ? Math.round(centerY - nextH / 2)
      : Math.round(bottomY - nextH),
    w: nextW,
    h: nextH
  };
}

function normalizeRoomEditorSizeProfile(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce((profile, [kind, size]) => {
    const safeKind = String(kind || '').trim();
    const w = Math.round(Number(size?.w || 0));
    const h = Math.round(Number(size?.h || 0));
    if (!safeKind || w < 8 || h < 8) return profile;
    profile[safeKind] = {
      w,
      h,
      sourceAssetId: String(size?.sourceAssetId || '')
    };
    return profile;
  }, {});
}

function buildRoomEditorSizeProfile(items = [], assetMap = new Map()) {
  return (Array.isArray(items) ? items : []).reduce((profile, item) => {
    const asset = assetMap.get(item?.assetId);
    const kind = getRoomEditorItemSizeKind(item, asset);
    const w = Math.round(Number(item?.w || 0));
    const h = Math.round(Number(item?.h || 0));
    if (!kind || w < 8 || h < 8) return profile;
    const current = profile[kind];
    if (!current || w * h > current.w * current.h) {
      profile[kind] = {
        w,
        h,
        sourceAssetId: String(item?.assetId || '')
      };
    }
    return profile;
  }, {});
}

function readStoredRoomEditorSizeProfile() {
  try {
    const raw = localStorage.getItem(roomEditorSizeProfileStorageKey);
    if (!raw || raw.length > roomEditorMaxStorageBytes) return {};
    const parsed = JSON.parse(raw);
    return normalizeRoomEditorSizeProfile(parsed);
  } catch {
    return {};
  }
}

function writeStoredRoomEditorSizeProfile(items = [], assetMap = new Map()) {
  try {
    const profile = buildRoomEditorSizeProfile(items, assetMap);
    localStorage.setItem(roomEditorSizeProfileStorageKey, JSON.stringify(profile));
    return profile;
  } catch {
    return {};
  }
}

function applyRoomEditorSizeProfileToItems(items = [], assetMap = new Map(), explicitProfile = null) {
  const normalizedExplicitProfile = normalizeRoomEditorSizeProfile(explicitProfile);
  const baseProfile = Object.keys(normalizedExplicitProfile).length
    ? normalizedExplicitProfile
    : buildRoomEditorSizeProfile(items, assetMap);
  const derivedProfile = { ...roomEditorCalibratedSizeProfile, ...baseProfile };
  if (!derivedProfile || !Object.keys(derivedProfile).length) return items;
  return items.map((item) => {
    const asset = assetMap.get(item?.assetId);
    const kind = getRoomEditorItemSizeKind(item, asset);
    const size = kind ? derivedProfile[kind] : null;
    if (!size) return item;
    return resizeRoomEditorItemByKindSize(item, size, kind);
  });
}

function applyRoomEditorKindSizeToItems(items = [], assetMap = new Map(), targetItem = null) {
  const targetAsset = assetMap.get(targetItem?.assetId);
  const targetKind = getRoomEditorItemSizeKind(targetItem, targetAsset);
  const targetSize = targetKind ? {
    w: Math.round(Number(targetItem?.w || 0)),
    h: Math.round(Number(targetItem?.h || 0)),
    sourceAssetId: String(targetItem?.assetId || '')
  } : null;
  if (!targetKind || !targetSize?.w || !targetSize?.h) return items;
  return items.map((item) => {
    const asset = assetMap.get(item?.assetId);
    const kind = getRoomEditorItemSizeKind(item, asset);
    if (kind !== targetKind) return item;
    return resizeRoomEditorItemByKindSize(item, targetSize, kind);
  });
}

function getRoomEditorDefaultCollision(asset) {
  if (!asset) return { enabled: false, x: 0, y: 0, w: 1, h: 1 };
  return normalizeCommercialV2Collision(asset.collision || {
    enabled: true,
    x: 0.16,
    y: 0.68,
    w: 0.68,
    h: 0.28
  }, { ...asset, type: asset.type || '装饰' });
}

function getBoxesOverlapArea(a, b) {
  if (!a || !b) return 0;
  const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return overlapW > 0 && overlapH > 0 ? overlapW * overlapH : 0;
}

function getRoomEditorDepthZIndex(sortY, tie = 0) {
  return roomEditorDepthZIndexBase
    + Math.round((Number(sortY) || 0) * roomEditorDepthZIndexScale)
    + Math.round(Number(tie) || 0);
}

function getRoomEditorItemSortY(item, asset) {
  if (!item || !asset) return 0;
  if (item.groundLayer === true) return item.y + item.h * 0.05;
  const collision = getCommercialV2EffectiveCollision(item, asset);
  if (collision.enabled) {
    return item.y + item.h * Math.min(1, collision.y + collision.h);
  }
  return item.y + item.h * 0.92;
}

function getRoomEditorItemRenderZIndex(item, asset, layerIndex = 0) {
  if (!item || !asset || item.groundLayer === true) {
    return roomEditorGroundLayerZIndex + layerIndex;
  }
  return getRoomEditorDepthZIndex(
    getRoomEditorItemSortY(item, asset),
    Math.abs(Math.round(Number(layerIndex) || 0)) % 5
  );
}

function getRoomEditorPlayerRenderZIndex(player, tie = 0) {
  return getRoomEditorDepthZIndex(
    player?.y ?? roomEditorPlayerInitials[commercialV2UserActorId].y,
    5 + Math.min(4, Math.max(0, Math.round(Number(tie) || 0)))
  );
}

function getRoomEditorPlayerDepthTie(players = {}, targetPlayer = null) {
  const targetId = targetPlayer?.id || targetPlayer?.characterId;
  const sortedPlayers = commercialV2PlayerCharacters
    .map((character) => players[character.id] || createRoomEditorPlayerState(character))
    .sort((a, b) => (
      Number(a?.y || 0) - Number(b?.y || 0)
      || Number(a?.x || 0) - Number(b?.x || 0)
      || String(a?.id || '').localeCompare(String(b?.id || ''))
    ));
  return Math.max(0, sortedPlayers.findIndex((item) => item.id === targetId));
}

function normalizeRoomEditorLayoutState(rawItems, explicitSizeProfile = null) {
  if (!Array.isArray(rawItems)) return null;
  const assetMap = new Map(roomEditorAssetCatalog.map((asset) => [asset.id, asset]));
  const normalizedExplicitProfile = normalizeRoomEditorSizeProfile(explicitSizeProfile);
  const cleaned = rawItems
    .slice(0, roomEditorMaxSavedItems)
    .filter((item) => item && assetMap.has(item.assetId))
    .map((item) => {
      const asset = assetMap.get(item.assetId);
      const normalized = normalizeRoomEditorItemAspect({
        assetId: item.assetId,
        id: String(item.id || `${item.assetId}-${Date.now().toString(36)}`),
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        collision: item.collision && typeof item.collision === 'object'
          ? normalizeCommercialV2Collision(item.collision, { ...asset, type: asset.type || '装饰' })
          : getRoomEditorDefaultCollision(asset),
        placeAnchor: normalizeCommercialV2PlaceAnchor(item.placeAnchor) || undefined,
        groundLayer: item.groundLayer === true || asset.groundLayer === true ? true : undefined
      }, asset);
      return clampBox(migrateRoomEditorItemToCurrentAssetBox(normalized, asset, item), roomEditorStageSize);
    });
  const storedSizeProfile = Object.keys(normalizedExplicitProfile).length
    ? normalizedExplicitProfile
    : readStoredRoomEditorSizeProfile();
  const normalizedItems = applyRoomEditorSizeProfileToItems(
    cleaned,
    assetMap,
    Object.keys(storedSizeProfile).length ? storedSizeProfile : null
  ).map((item) => clampBox(item, roomEditorStageSize));
  if (rawItems.length && !normalizedItems.length) return null;
  return {
    selectedId: normalizedItems[0]?.id || '',
    items: normalizedItems
  };
}

function readStoredRoomEditorLayout() {
  const defaultState = getRoomEditorDefaultState();
  const fallbackState = () => readStoredRoomEditorAssemblySnapshot() || defaultState;
  try {
    const raw = localStorage.getItem(roomEditorStorageKey);
    if (!raw) return fallbackState();
    if (raw.length > roomEditorMaxStorageBytes) {
      localStorage.removeItem(roomEditorStorageKey);
      return fallbackState();
    }
    const parsed = JSON.parse(raw);
    const rawItems = Array.isArray(parsed) ? parsed : parsed?.items;
    const parsedSizeProfile = normalizeRoomEditorSizeProfile(parsed?.sizeProfile);
    const normalized = normalizeRoomEditorLayoutState(
      rawItems,
      Object.keys(parsedSizeProfile).length ? parsedSizeProfile : null
    );
    if (normalized && normalized.items.length === 0) return fallbackState();
    const assemblyState = readStoredRoomEditorAssemblySnapshot();
    if (shouldUseRoomEditorAssemblyLayout(normalized, parsed, assemblyState)) return assemblyState;
    return normalized || fallbackState();
  } catch {
    localStorage.removeItem(roomEditorStorageKey);
    return fallbackState();
  }
}

function readStoredRoomEditorAssemblySnapshot() {
  try {
    const raw = localStorage.getItem(roomEditorAssemblyStorageKey);
    if (!raw) return null;
    if (raw.length > roomEditorMaxStorageBytes) {
      localStorage.removeItem(roomEditorAssemblyStorageKey);
      return null;
    }
    const parsed = JSON.parse(raw);
    const rawItems = Array.isArray(parsed) ? parsed : parsed?.items;
    const snapshotSizeProfile = normalizeRoomEditorSizeProfile(parsed?.sizeProfile);
    const normalized = normalizeRoomEditorLayoutState(
      rawItems,
      Object.keys(snapshotSizeProfile).length ? snapshotSizeProfile : null
    );
    if (!normalized || normalized.items.length === 0) return null;
    return {
      ...normalized,
      selectedId: String(parsed?.selectedId || normalized.items[0]?.id || ''),
      home: parsed?.home || null,
      palette: String(parsed?.palette || ''),
      budget: Number(parsed?.budget || 0),
      spent: Number(parsed?.spent || 0),
      purchases: Array.isArray(parsed?.purchases) ? parsed.purchases : [],
      sizeProfile: Object.keys(snapshotSizeProfile).length ? snapshotSizeProfile : null,
      savedAt: getRoomEditorLayoutSavedAt(parsed)
    };
  } catch {
    localStorage.removeItem(roomEditorAssemblyStorageKey);
    return null;
  }
}

function readStoredRoomEditorResetBackup() {
  try {
    const raw = localStorage.getItem(roomEditorResetBackupStorageKey);
    if (!raw) return null;
    if (raw.length > roomEditorMaxStorageBytes) {
      localStorage.removeItem(roomEditorResetBackupStorageKey);
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeRoomEditorLayoutState(parsed?.items);
    if (!normalized || normalized.items.length === 0) return null;
    return {
      ...normalized,
      selectedId: String(parsed?.selectedId || normalized.items[0]?.id || ''),
      players: parsed?.players,
      savedAt: Number(parsed?.savedAt || Date.now())
    };
  } catch {
    localStorage.removeItem(roomEditorResetBackupStorageKey);
    return null;
  }
}

function readStoredRoomEditorDefaultSnapshot() {
  try {
    const raw = localStorage.getItem(roomEditorDefaultSnapshotStorageKey);
    if (!raw) return null;
    if (raw.length > roomEditorMaxStorageBytes) {
      localStorage.removeItem(roomEditorDefaultSnapshotStorageKey);
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeRoomEditorLayoutState(parsed?.items);
    if (!normalized || normalized.items.length === 0) return null;
    return {
      ...normalized,
      selectedId: String(parsed?.selectedId || normalized.items[0]?.id || ''),
      players: parsed?.players,
      savedAt: Number(parsed?.savedAt || Date.now())
    };
  } catch {
    localStorage.removeItem(roomEditorDefaultSnapshotStorageKey);
    return null;
  }
}

function clampRoomEditorPlayer(player) {
  return {
    ...player,
    x: Math.max(roomEditorPlayerBounds.minX, Math.min(roomEditorPlayerBounds.maxX, Number(player?.x) || 0)),
    y: Math.max(roomEditorPlayerBounds.minY, Math.min(roomEditorPlayerBounds.maxY, Number(player?.y) || 0))
  };
}

function createRoomEditorPlayerState(character) {
  return clampRoomEditorPlayer({
    ...createCommercialV2PlayerState(character),
    ...(roomEditorPlayerInitials[character.id] || {}),
    moving: false,
    frame: 0,
    stepTime: 0,
    bubble: ''
  });
}

function createRoomEditorPlayerStates() {
  return Object.fromEntries(
    commercialV2PlayerCharacters.map((character) => [character.id, createRoomEditorPlayerState(character)])
  );
}

function normalizeRoomEditorPlayerState(rawPlayer, character) {
  const fallback = createRoomEditorPlayerState(character);
  const rawDirection = String(rawPlayer?.direction || fallback.direction || 'front');
  return clampRoomEditorPlayer({
    ...fallback,
    ...rawPlayer,
    id: character.id,
    characterId: character.id,
    direction: roomEditorDirectionOrder.includes(rawDirection) ? rawDirection : fallback.direction,
    frame: Math.max(0, Math.min(commercialV2PlayerFrameOrder.length - 1, Number(rawPlayer?.frame) || 0)),
    moving: Boolean(rawPlayer?.moving),
    stepTime: Number(rawPlayer?.stepTime) || 0,
    bubble: String(rawPlayer?.bubble || '').slice(0, 64)
  });
}

function clampRoomEditorPlayerScale(value, { migrateLegacyDefault = false } = {}) {
  const numericScale = Number(value);
  if (migrateLegacyDefault && roomEditorLegacyDefaultPlayerScales.some((scale) => Math.abs(numericScale - scale) < 0.001)) {
    return roomEditorDefaultPlayerScale;
  }
  return Math.max(
    roomEditorMinPlayerScale,
    Math.min(roomEditorMaxPlayerScale, numericScale || roomEditorDefaultPlayerScale)
  );
}

function serializeRoomEditorPlayers(players, controlledPlayerId, scale) {
  const safePlayers = players && typeof players === 'object' ? players : {};
  return {
    controlledPlayerId: commercialV2PlayerCharacterById.has(controlledPlayerId)
      ? controlledPlayerId
      : commercialV2DefaultControlledPlayerId,
    scale: clampRoomEditorPlayerScale(scale),
    actors: commercialV2PlayerCharacters.map((character) => {
      const player = normalizeRoomEditorPlayerState(safePlayers[character.id], character);
      return {
        id: character.id,
        characterId: character.id,
        label: character.label,
        x: Math.round(player.x),
        y: Math.round(player.y),
        direction: player.direction,
        frame: Number(player.frame) || 0,
        moving: false,
        stepTime: 0,
        bubble: player.bubble || ''
      };
    })
  };
}

function normalizeRoomEditorPlayersSnapshot(snapshot) {
  const fallbackPlayers = createRoomEditorPlayerStates();
  const rawActors = Array.isArray(snapshot?.actors)
    ? snapshot.actors
    : Array.isArray(snapshot?.players)
      ? snapshot.players
      : [];
  const rawById = rawActors.reduce((map, actor) => {
    if (actor?.id) map.set(actor.id, actor);
    if (actor?.characterId) map.set(actor.characterId, actor);
    return map;
  }, new Map());
  const players = Object.fromEntries(
    commercialV2PlayerCharacters.map((character) => [
      character.id,
      normalizeRoomEditorPlayerState(
        rawById.get(character.id) || snapshot?.players?.[character.id] || fallbackPlayers[character.id],
        character
      )
    ])
  );
  const controlledPlayerId = commercialV2PlayerCharacterById.has(snapshot?.controlledPlayerId)
    ? snapshot.controlledPlayerId
    : commercialV2DefaultControlledPlayerId;
  const scale = clampRoomEditorPlayerScale(snapshot?.scale, { migrateLegacyDefault: true });
  return { players, controlledPlayerId, scale };
}

function readStoredRoomEditorPlayers() {
  try {
    const raw = localStorage.getItem(roomEditorPlayerStorageKey);
    if (!raw) return normalizeRoomEditorPlayersSnapshot(null);
    if (raw.length > roomEditorMaxStorageBytes) {
      localStorage.removeItem(roomEditorPlayerStorageKey);
      return normalizeRoomEditorPlayersSnapshot(null);
    }
    return normalizeRoomEditorPlayersSnapshot(JSON.parse(raw));
  } catch {
    localStorage.removeItem(roomEditorPlayerStorageKey);
    return normalizeRoomEditorPlayersSnapshot(null);
  }
}

function getRoomEditorDirectionFromDelta(dx, dy, fallback = 'front') {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  if (Math.abs(dy) > 0) return dy > 0 ? 'front' : 'back';
  return fallback;
}

function createRoomEditorBehaviorTreeSnapshot(items, assetById, players, controlledPlayerId, scale, stageSize) {
  const baseTree = createCommercialV2BehaviorTreeState();
  const anchors = items
    .map((item) => buildRoomEditorItemAnchor(item, assetById.get(item.assetId)))
    .filter(Boolean)
    .map((anchor) => ({
      id: anchor.id,
      name: anchor.name,
      x: Math.round(anchor.anchor.x),
      y: Math.round(anchor.anchor.y)
    }));
  return {
    tree_id: 'room_runtime_dual_character',
    schema: baseTree.schema,
    version: baseTree.version,
    root_id: baseTree.root_id,
    inherited_from: 'generic_single_character_behavior_tree_v1',
    actors: serializeRoomEditorPlayers(players, controlledPlayerId, scale),
    room_context: {
      stage: stageSize,
      furniture_count: items.length,
      anchors,
      movement_bounds: roomEditorPlayerBounds,
      interaction_distance: commercialV2BehaviorInteractionDistance
    },
    available_actions: commercialV2BehaviorMovementActions.map((action) => action.id),
    node_count: Object.keys(baseTree.nodes || {}).length
  };
}

function serializeRoomEditorItem(item, asset) {
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
  if (asset) {
    next.collision = normalizeCommercialV2Collision(
      item.collision || getRoomEditorDefaultCollision(asset),
      { ...asset, type: asset.type || '装饰' }
    );
  }
  const placeAnchor = normalizeCommercialV2PlaceAnchor(item.placeAnchor);
  if (placeAnchor) {
    next.placeAnchor = placeAnchor;
  }
  return next;
}

function buildRoomEditorItemAnchor(item, asset) {
  if (!item || !asset) return null;
  const manualAnchor = normalizeCommercialV2PlaceAnchor(item.placeAnchor);
  const assetAnchor = normalizeCommercialV2PlaceAnchor(asset.placeAnchor || asset.anchor);
  const anchorRatio = manualAnchor || assetAnchor || { x: 0.5, y: 1 };
  return {
    id: `room-anchor:${item.id}`,
    name: asset.placeName || asset.name,
    itemId: item.id,
    assetId: item.assetId,
    kind: asset.type || '房间素材',
    anchor: {
      x: Math.round(item.x + item.w * anchorRatio.x),
      y: Math.round(item.y + item.h * anchorRatio.y)
    },
    anchorRatio,
    manualAnchor: Boolean(manualAnchor)
  };
}

function getRoomEditorPlaceAnchorLocalPoint(item, asset) {
  const place = buildRoomEditorItemAnchor(item, asset);
  if (!place) return null;
  return {
    x: Math.round(place.anchor.x - item.x),
    y: Math.round(place.anchor.y - item.y)
  };
}

export {
  roomStyleMeta,
  roomEditorStorageKey,
  roomEditorCanvasStorageKey,
  roomEditorSizeProfileStorageKey,
  roomEditorAssemblyStorageKey,
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
  isBuiltInDefaultRoomEditorLayoutState,
  shouldUseRoomEditorAssemblyLayout,
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
  readStoredRoomEditorAssemblySnapshot,
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
};
