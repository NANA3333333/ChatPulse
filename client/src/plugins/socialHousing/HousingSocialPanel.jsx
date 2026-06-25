import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AlertTriangle,
  BadgeDollarSign,
  BedDouble,
  Building2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Edit3,
  Home,
  KeyRound,
  MessageSquareText,
  Play,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  WandSparkles,
  X
} from 'lucide-react';
import './HousingSocialPanel.css';

const text = {
  title: '住房系统',
  sellableHomes: '房源',
  roleBinding: '已有住房',
  recommendHousing: '给无房角色推荐住房',
  recommendHome: '推荐住房',
  assignHome: '直接指派住房',
  recentChains: '最近租房链路',
  moveInCost: '入住成本',
  currentHome: '当前住处',
  selectedHome: '本次房源',
  latestChain: '最新链路',
  noChain: '暂无链路',
  eligibleRole: '选择无房角色',
  noHomelessCharacters: '暂无无房角色',
  noHousedCharacters: '暂无已有住房角色',
  noAvailableHomes: '暂无启用房源',
  noHousingActionTarget: '所有角色都有住处，推荐/指派入口暂时关闭。',
  housedActionHint: '本区只处理无房角色；已有住房的角色在“已有住房”区查看/管理。',
  viewDialogue: '看房对话',
  viewSummary: '看房总结',
  consideration: '考虑',
  decision: '决定',
  agent: '中介',
  character: '角色',
  chainRunning: '链路执行中...',
  chainResult: '链路结果',
  chainFailed: '链路失败',
  agencyAi: '中介所 AI',
  roomAssembly: '样板间组装实验',
  openRoomAssembly: '打开组装窗口',
  generateRoomAssembly: '中介生成并保存',
  roomAssemblySaved: '已生成并保存到实际房间。',
  loading: '住房系统加载中...',
  loadFailed: '住房系统加载失败',
  requestFailed: '请求失败 ',
  save: '保存配置',
  run: '手动执行',
  retry: '重新生成',
  clearError: '删除报错',
  enable: '启用中介所',
  disable: '关闭中介所',
  lastAd: '上次广告',
  nextAd: '下次广告',
  lastFailure: '上次失败',
  noAds: '还没有广告记录。',
  published: '已公告',
  manual: '手动',
  auto: '自动',
  agencyFailed: '中介所 AI 执行失败：',
  officeName: '门店名称',
  agentName: '顾问名称',
  officeDistrict: '门店分区',
  businessScope: '业务范围',
  intervalHours: '决策间隔（小时）',
  autoModel: '自动选择可用 API',
  adStyle: '广告风格',
  prompt: '人格提示，可留空',
  applyStyle: '套用风格',
  catalog: '房源库',
  custom: '自定义',
  addHome: '新增房子',
  saveEdit: '保存编辑',
  cancel: '取消编辑',
  edit: '编辑',
  remove: '删除',
  removeAd: '删除记录',
  enabledState: '启用中',
  disabledState: '已停用',
  homeName: '房子名字',
  weeklyRent: '每周租金',
  deposit: '押金',
  buyout: '售价/买断价',
  comfort: '舒适度',
  prestige: '体面感',
  privacy: '隐私感',
  sortOrder: '显示排序',
  desc: '介绍',
  id: 'ID',
  emoji: 'Emoji',
  applyHome: '加入可推销列表',
  applyExistingHome: '已在列表中，去编辑',
  homeApplied: '这套房子已经加入已保存的房子，中介 AI 现在可以直接拿它发广告。',
  homeOpened: '这套房子已经在列表里了，我已经帮你打开编辑。',
  modalCustomHome: '自定义房子',
  modalEditHome: '编辑房子',
  emptyHomes: '还没有可推销的房子。',
  roleName: '角色',
  wallet: '钱包',
  unknown: 'unknown',
  idle: 'idle',
  unboundHousing: '未绑定住房',
  stable: '稳定居住',
  homeless: '无固定住所',
  temporary: '临时落脚',
  unstable: '居住不稳',
  overdue: '租金拖欠',
  note: '备注',
  rentDue: '催租日',
  nextRentDue: '下次催租',
  missedRent: '拖欠次数',
  payRent: '交房租',
  saving: '保存中...',
  untriggered: '未触发',
  agencyPlaceholder: '商业街'
};

const homePresets = [
  { key: 'old_apartment_chunheli', title: '老破小', subtitle: '春和里 4栋302', values: { id: 'old_apartment_chunheli_4_302', name: '春和里小区 4栋302', emoji: '🏚️', weekly_rent: 22, deposit: 40, sale_price: 380, comfort: 8, prestige: 2, privacy: 4, description: '一室一厅，老式水泥楼，五楼步梯，屋里采光一般但通风还行。家具旧，墙皮有点起鼓，厨房很小，卫生间是老式布局。优点是便宜、离便利店近、对刚落脚的人压力最小；缺点是压抑、隔音差、夏天闷、体面感很弱。' } },
  { key: 'shared_room_xinyuan', title: '合租单间', subtitle: '欣园公寓 2单元801-A室', values: { id: 'shared_room_xinyuan_2_801', name: '欣园公寓 2单元801-A室', emoji: '🛏️', weekly_rent: 28, deposit: 60, sale_price: 0, comfort: 12, prestige: 6, privacy: 8, description: '三室一厅里的朝南次卧，简约出租房风格，床、衣柜、书桌都有，公共区域和另外两位租客共用。优点是预算友好、生活机能方便、房间基本齐全；缺点是要看室友脸色，做饭和洗澡高峰期会挤，真正的私人空间有限。' } },
  { key: 'shared_flat_jingan', title: '普通合租', subtitle: '静安新村 6栋502', values: { id: 'shared_flat_jingan_6_502', name: '静安新村 6栋502', emoji: '🏠', weekly_rent: 35, deposit: 80, sale_price: 0, comfort: 18, prestige: 10, privacy: 14, description: '两室一厅标准合租，日常居住氛围比较稳定，客厅和厨房都能正常使用，装修是普通白墙木地板风格。优点是住法最常见、性价比稳、位置不偏；缺点是没什么惊喜，房子本身偏普通，谈不上特别舒服或特别有面子。' } },
  { key: 'studio_yuecheng', title: '独立公寓', subtitle: '悦城公馆 11楼1107', values: { id: 'studio_yuecheng_11_1107', name: '悦城公馆 11楼1107', emoji: '🏢', weekly_rent: 58, deposit: 120, sale_price: 980, comfort: 28, prestige: 22, privacy: 24, description: '一室户带独立卫浴和小厨房，现代简装，采光不错，晚上回家会有比较完整的个人空间。优点是安静、独处感强、适合想把生活收回自己手里的人；缺点是租金明显更高，空间不算大，长期住会开始在意收纳。' } },
  { key: 'riverside_lanwan', title: '江景公寓', subtitle: '澜湾国际 17楼1703', values: { id: 'riverside_lanwan_17_1703', name: '澜湾国际 17楼1703', emoji: '🌉', weekly_rent: 95, deposit: 220, sale_price: 1680, comfort: 40, prestige: 38, privacy: 32, description: '两室一厅带大落地窗，偏现代轻奢风，客厅能看到江景，白天和夜景都很能撑场面。优点是舒适、体面、很适合约人来家里坐；缺点是贵，生活成本会被整体抬高，住进去之后很难再接受太差的房子。' } },
  { key: 'luxury_loft_jinyu', title: '高档 loft', subtitle: '金域中心 23楼2301', values: { id: 'luxury_loft_jinyu_23_2301', name: '金域中心 23楼2301 loft', emoji: '🌇', weekly_rent: 150, deposit: 360, sale_price: 2880, comfort: 48, prestige: 55, privacy: 38, description: '挑高 loft，两层分区明显，下层会客、上层休息，整体偏深色高端都市风，电梯厅和物业都很讲排面。优点是圈层感强、很适合做身份展示、拍照和待客都上镜；缺点是租金和押金都高，对收入和消费习惯要求也高。' } }
];

const promptStyles = [
  { key: 'street', label: '街头招揽', prompt: '你像商业街口发传单的中介一样说话，语气直接、接地气、能快速把价格和房子优点说清楚。' },
  { key: 'warm', label: '温和推荐', prompt: '你像认真替人找房的顾问一样说话，先把房子适合谁讲清楚，再自然带出价格和卖点。' },
  { key: 'budget', label: '穷人友好', prompt: '你主打低预算租客，广告里优先强调租金、押金、性价比和适合刚落脚的人。' },
  { key: 'luxury', label: '体面高端', prompt: '你主打体面和高端感，广告里优先强调地段、空间、圈层感和价格。' },
  { key: 'sellfast', label: '急租/急售', prompt: '你像急租急售的中介，广告简短有力，必须先报价格，再说房型和核心卖点。' }
];

const defaultDistrictOptions = [
  { id: 'street', name: '商业街' },
  { id: 'home', name: '家' },
  { id: 'restaurant', name: '餐厅' },
  { id: 'convenience', name: '便利店' },
  { id: 'park', name: '中央公园' },
  { id: 'mall', name: '商场' },
  { id: 'school', name: '夜校' },
  { id: 'hospital', name: '医院' },
  { id: 'factory', name: '工厂' },
  { id: 'casino', name: '地下赌场' },
  { id: 'hacker', name: '黑客据点' }
];

const shell = {
  page: { display: 'flex', flexDirection: 'column', gap: 18, padding: 24, background: 'var(--housing-page-bg)', minHeight: '100%' },
  section: { display: 'grid', gap: 12 },
  card: { background: 'var(--housing-card-bg)', border: '1px solid var(--housing-line)', borderRadius: 8, padding: 16, boxShadow: 'var(--housing-shadow)' },
  input: { width: '100%', borderRadius: 8, border: '1px solid var(--housing-line)', padding: '9px 11px', fontSize: 13, background: 'var(--housing-input-bg)', color: 'var(--housing-ink)' },
  btn: { border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer', lineHeight: 1.2 }
};

const emptyHome = { id: '', name: '', emoji: '', description: '', weekly_rent: 0, deposit: 0, sale_price: 0, comfort: 0, prestige: 0, privacy: 0, is_enabled: 1, sort_order: 0 };
const emptyAgency = { enabled: 1, agency_name: '', agent_name: '', office_district: 'street', business_scope: '', persona_prompt: '', decision_interval_hours: 6, model_char_id: 'auto', next_ad_at: 0, last_ad_at: 0, last_error: '', last_error_at: 0 };
const roomEditorStorageKey = 'pixelWorld.room.layout';
const roomEditorCanvasStorageKey = 'pixelWorld.room.canvas';
const roomEditorSizeProfileStorageKey = 'pixelWorld.room.sizeProfile';
const roomEditorAssemblyStorageKey = 'pixelWorld.room.assemblyExperiment';
const roomEditorLayoutUpdatedEvent = 'pixel-world-room-layout-updated';
const roomEditorStageSize = { width: 1254, height: 1254 };
const roomEditorBackdrop = '/assets/pixel-world/generated-rooms/backgrounds/empty-square-room-v1.png';
const roomAssemblyWallArtVisualBounds = { minY: -48, maxBottomY: 273 };
const roomAssemblyCalibratedSizeProfile = {
  desk: { w: 430, h: 337, sourceAssetId: 'room_front_mint_desk_v1' },
  bookshelf: { w: 291, h: 444, sourceAssetId: 'room_front_mint_bookshelf_v1' },
  sofa: { w: 526, h: 362, sourceAssetId: 'room_front_mint_sofa_v1' }
};
const roomAssemblyPalettes = {
  budget: {
    label: '蜜桃基础套装',
    bedGroup: 'bed_peach_lemon',
    nightstandGroup: 'peach_nightstand',
    wardrobeGroup: 'peach_wardrobe',
    vanityGroup: 'peach_vanity',
    vanityW: 273
  },
  standard: {
    label: '薄荷日常套装',
    bedGroup: 'bed_mint_garden',
    nightstandGroup: 'mint_nightstand',
    wardrobeGroup: 'mint_wardrobe',
    vanityGroup: 'mint_vanity',
    vanityW: 273
  },
  ocean: {
    label: '海洋舒适套装',
    bedGroup: 'bed_ocean_shell',
    nightstandGroup: 'ocean_nightstand',
    wardrobeGroup: 'ocean_wardrobe',
    vanityGroup: 'ocean_vanity',
    vanityW: 271
  },
  cloud: {
    label: '云朵体面套装',
    bedGroup: 'bed_cloud_dream',
    nightstandGroup: 'cloud_nightstand',
    wardrobeGroup: 'cloud_wardrobe',
    vanityGroup: 'cloud_vanity',
    vanityW: 260
  },
  candy: {
    label: '糖果高档套装',
    bedGroup: 'bed_pastel_candy',
    nightstandGroup: 'candy_nightstand',
    wardrobeGroup: 'candy_wardrobe',
    vanityGroup: 'candy_vanity',
    vanityW: 273
  }
};
const roomAssemblyDirectionLabels = {
  front: '正面',
  back: '背面',
  left: '左侧',
  right: '右侧'
};
const roomAssemblyGridSize = { cols: 16, rows: 16 };
const roomAssemblyCoreKinds = ['wardrobe', 'vanity', 'bed', 'nightstand'];
const roomAssemblyKinds = ['wardrobe', 'vanity', 'bed', 'nightstand', 'desk', 'bookshelf', 'sofa', 'rug', 'floorLamp', 'wallArt'];
const roomAssemblyKindLabels = {
  wardrobe: '衣柜',
  vanity: '梳妆台',
  bed: '床',
  nightstand: '床头柜',
  desk: '书桌',
  bookshelf: '书架',
  sofa: '沙发',
  rug: '地毯',
  floorLamp: '落地灯',
  wallArt: '墙面装饰'
};
const roomAssemblyAllowedDirections = new Set(['front', 'back', 'left', 'right']);
const roomAssemblyDirectionalKinds = new Set(['bed', 'nightstand', 'wardrobe', 'vanity', 'desk', 'bookshelf', 'sofa']);
const roomAssemblyWallBufferCells = 2;
const roomAssemblyVisualFloorLineOffsetCells = 0.5;
const roomAssemblyDefaultScaleByKind = {
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

function scaleRoomAssemblyBoxByKind(box = {}, kind = '') {
  const scale = roomAssemblyDefaultScaleByKind[kind] || 1;
  if (scale === 1) return { ...box };
  const w = Math.max(8, Math.round(toNum(box.w, 80)));
  const h = Math.max(8, Math.round(toNum(box.h, 80)));
  const nextW = Math.max(8, Math.round(w * scale));
  const nextH = Math.max(8, Math.round(h * scale));
  const centerX = toNum(box.x, 0) + w / 2;
  const centerY = toNum(box.y, 0) + h / 2;
  return {
    ...box,
    x: Math.round(centerX - nextW / 2),
    y: Math.round(centerY - nextH / 2),
    w: nextW,
    h: nextH
  };
}

function makeRoomAssemblyShopItem(assetId, name, kind, style, price, box, options = {}) {
  const scaledBox = scaleRoomAssemblyBoxByKind(box, kind);
  return {
    assetId,
    name,
    kind,
    label: name,
    style,
    price,
    box: scaledBox,
    maxQuantity: options.maxQuantity || (kind === 'rug' || kind === 'wallArt' ? 1 : 99),
    directional: options.directional !== false && roomAssemblyDirectionalKinds.has(kind),
    groundLayer: options.groundLayer === true || kind === 'rug' || kind === 'wallArt',
    collision: options.collision || null,
    preferred_dir: options.preferred_dir || 'front'
  };
}

const roomAssemblyShopItems = [
  makeRoomAssemblyShopItem('room_front_bed_scandinavian_blue_v1', '北欧蓝白床', 'bed', '北欧蓝白', 115, { x: 82, y: 754, w: 343, h: 370 }),
  makeRoomAssemblyShopItem('room_front_scandinavian_nightstand_v1', '北欧床头柜', 'nightstand', '北欧蓝白', 34, { x: 414, y: 887, w: 185, h: 220 }),
  makeRoomAssemblyShopItem('room_front_scandinavian_wardrobe_v1', '北欧衣柜', 'wardrobe', '北欧蓝白', 85, { x: 88, y: 412, w: 235, h: 330 }),
  makeRoomAssemblyShopItem('room_front_scandinavian_desk_v1', '北欧书桌', 'desk', '北欧蓝白', 80, { x: 438, y: 630, w: 350, h: 275 }),
  makeRoomAssemblyShopItem('room_front_scandinavian_bookshelf_v1', '北欧书柜', 'bookshelf', '北欧蓝白', 75, { x: 840, y: 352, w: 300, h: 390 }),
  makeRoomAssemblyShopItem('room_front_scandinavian_sofa_v1', '北欧沙发', 'sofa', '北欧蓝白', 110, { x: 660, y: 750, w: 420, h: 290 }),
  makeRoomAssemblyShopItem('room_decor_scandinavian_rug_v1', '北欧雪纹地毯', 'rug', '北欧蓝白', 38, { x: 420, y: 882, w: 430, h: 260 }, { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),
  makeRoomAssemblyShopItem('room_decor_scandinavian_floor_lamp_v1', '北欧落地灯', 'floorLamp', '北欧蓝白', 38, { x: 900, y: 526, w: 230, h: 410 }, { directional: false, collision: { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 } }),
  makeRoomAssemblyShopItem('room_decor_scandinavian_wall_art_v1', '北欧雪山挂画', 'wallArt', '北欧蓝白', 30, { x: 500, y: 302, w: 390, h: 235 }, { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),

  makeRoomAssemblyShopItem('room_front_bed_peach_lemon_v1', '蜜桃柠檬床', 'bed', '蜜桃柠檬', 70, { x: 82, y: 754, w: 343, h: 370 }),
  makeRoomAssemblyShopItem('room_front_peach_nightstand_v1', '蜜桃床头柜', 'nightstand', '蜜桃柠檬', 22, { x: 414, y: 887, w: 185, h: 220 }),
  makeRoomAssemblyShopItem('room_front_peach_wardrobe_v1', '蜜桃衣柜', 'wardrobe', '蜜桃柠檬', 55, { x: 88, y: 412, w: 235, h: 330 }),
  makeRoomAssemblyShopItem('room_front_peach_vanity_v1', '蜜桃梳妆台', 'vanity', '蜜桃柠檬', 45, { x: 476, y: 506, w: 273, h: 340 }),
  makeRoomAssemblyShopItem('room_front_peach_desk_v1', '蜜桃书桌', 'desk', '蜜桃柠檬', 50, { x: 438, y: 630, w: 350, h: 275 }),
  makeRoomAssemblyShopItem('room_front_peach_bookshelf_v1', '蜜桃书柜', 'bookshelf', '蜜桃柠檬', 45, { x: 840, y: 352, w: 300, h: 390 }),
  makeRoomAssemblyShopItem('room_front_peach_sofa_v1', '蜜桃沙发', 'sofa', '蜜桃柠檬', 65, { x: 660, y: 750, w: 420, h: 290 }),
  makeRoomAssemblyShopItem('room_decor_peach_rug_v1', '蜜桃柠檬地毯', 'rug', '蜜桃柠檬', 20, { x: 420, y: 882, w: 430, h: 260 }, { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),
  makeRoomAssemblyShopItem('room_decor_peach_floor_lamp_v1', '蜜桃落地灯', 'floorLamp', '蜜桃柠檬', 22, { x: 900, y: 526, w: 230, h: 410 }, { directional: false, collision: { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 } }),
  makeRoomAssemblyShopItem('room_decor_peach_wall_art_v1', '蜜桃柠檬挂画', 'wallArt', '蜜桃柠檬', 18, { x: 500, y: 302, w: 390, h: 235 }, { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),

  makeRoomAssemblyShopItem('room_front_bed_mint_garden_v1', '薄荷花园床', 'bed', '薄荷花园', 95, { x: 82, y: 754, w: 343, h: 370 }),
  makeRoomAssemblyShopItem('room_front_mint_nightstand_v1', '薄荷床头柜', 'nightstand', '薄荷花园', 30, { x: 414, y: 887, w: 185, h: 220 }),
  makeRoomAssemblyShopItem('room_front_mint_wardrobe_v1', '薄荷衣柜', 'wardrobe', '薄荷花园', 75, { x: 88, y: 412, w: 235, h: 330 }),
  makeRoomAssemblyShopItem('room_front_mint_vanity_v1', '薄荷梳妆台', 'vanity', '薄荷花园', 65, { x: 476, y: 506, w: 273, h: 340 }),
  makeRoomAssemblyShopItem('room_front_mint_desk_v1', '薄荷书桌', 'desk', '薄荷花园', 75, { x: 438, y: 630, w: 350, h: 275 }),
  makeRoomAssemblyShopItem('room_front_mint_bookshelf_v1', '薄荷书架', 'bookshelf', '薄荷花园', 65, { x: 840, y: 352, w: 300, h: 390 }),
  makeRoomAssemblyShopItem('room_front_mint_sofa_v1', '薄荷沙发', 'sofa', '薄荷花园', 95, { x: 660, y: 750, w: 420, h: 290 }),
  makeRoomAssemblyShopItem('room_decor_mint_rug_v1', '薄荷绗缝地毯', 'rug', '薄荷花园', 32, { x: 420, y: 882, w: 430, h: 260 }, { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),
  makeRoomAssemblyShopItem('room_decor_mint_table_lamp_v1', '薄荷花园灯', 'floorLamp', '薄荷花园', 32, { x: 900, y: 526, w: 230, h: 410 }, { directional: false, collision: { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 } }),
  makeRoomAssemblyShopItem('room_decor_mint_wall_art_v1', '薄荷花园挂画', 'wallArt', '薄荷花园', 26, { x: 500, y: 302, w: 390, h: 235 }, { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),

  makeRoomAssemblyShopItem('room_front_bed_ocean_shell_v1', '海洋贝壳床', 'bed', '海洋贝壳', 125, { x: 84, y: 754, w: 333, h: 370 }),
  makeRoomAssemblyShopItem('room_front_ocean_nightstand_v1', '贝壳床头柜', 'nightstand', '海洋贝壳', 40, { x: 414, y: 887, w: 185, h: 220 }),
  makeRoomAssemblyShopItem('room_front_ocean_wardrobe_v1', '贝壳衣柜', 'wardrobe', '海洋贝壳', 100, { x: 88, y: 412, w: 235, h: 330 }),
  makeRoomAssemblyShopItem('room_front_ocean_vanity_v1', '贝壳梳妆台', 'vanity', '海洋贝壳', 95, { x: 476, y: 506, w: 271, h: 340 }),
  makeRoomAssemblyShopItem('room_front_ocean_desk_v1', '贝壳书桌', 'desk', '海洋贝壳', 100, { x: 438, y: 630, w: 350, h: 275 }),
  makeRoomAssemblyShopItem('room_front_ocean_bookshelf_v1', '贝壳书架', 'bookshelf', '海洋贝壳', 90, { x: 860, y: 383, w: 235, h: 360 }),
  makeRoomAssemblyShopItem('room_front_ocean_sofa_v1', '贝壳沙发', 'sofa', '海洋贝壳', 130, { x: 660, y: 750, w: 420, h: 290 }),
  makeRoomAssemblyShopItem('room_decor_ocean_rug_v1', '贝壳华毯', 'rug', '海洋贝壳', 45, { x: 420, y: 882, w: 430, h: 260 }, { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),
  makeRoomAssemblyShopItem('room_decor_ocean_floor_lamp_v1', '贝壳落地灯', 'floorLamp', '海洋贝壳', 45, { x: 906, y: 526, w: 230, h: 410 }, { directional: false, collision: { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 } }),
  makeRoomAssemblyShopItem('room_decor_ocean_wall_art_v1', '贝壳海景画', 'wallArt', '海洋贝壳', 36, { x: 520, y: 320, w: 360, h: 205 }, { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),

  makeRoomAssemblyShopItem('room_front_bed_cloud_dream_v1', '云朵梦幻床', 'bed', '云朵梦幻', 165, { x: 82, y: 754, w: 339, h: 370 }),
  makeRoomAssemblyShopItem('room_front_cloud_nightstand_v1', '云朵床头柜', 'nightstand', '云朵梦幻', 55, { x: 414, y: 887, w: 185, h: 220 }),
  makeRoomAssemblyShopItem('room_front_cloud_wardrobe_v1', '云朵衣柜', 'wardrobe', '云朵梦幻', 135, { x: 88, y: 412, w: 235, h: 330 }),
  makeRoomAssemblyShopItem('room_front_cloud_vanity_v1', '云朵梳妆台', 'vanity', '云朵梦幻', 130, { x: 476, y: 506, w: 260, h: 340 }),
  makeRoomAssemblyShopItem('room_front_cloud_desk_v1', '云朵书桌', 'desk', '云朵梦幻', 130, { x: 438, y: 630, w: 350, h: 275 }),
  makeRoomAssemblyShopItem('room_front_cloud_bookshelf_v1', '云朵书架', 'bookshelf', '云朵梦幻', 120, { x: 840, y: 352, w: 300, h: 390 }),
  makeRoomAssemblyShopItem('room_front_cloud_sofa_v1', '云朵沙发', 'sofa', '云朵梦幻', 170, { x: 660, y: 750, w: 420, h: 290 }),
  makeRoomAssemblyShopItem('room_decor_cloud_rug_v1', '云月华毯', 'rug', '云朵梦幻', 60, { x: 420, y: 882, w: 430, h: 260 }, { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),
  makeRoomAssemblyShopItem('room_decor_cloud_floor_lamp_v1', '云朵落地灯', 'floorLamp', '云朵梦幻', 58, { x: 894, y: 506, w: 250, h: 430 }, { directional: false, collision: { enabled: true, x: 0.34, y: 0.8, w: 0.32, h: 0.16 } }),
  makeRoomAssemblyShopItem('room_decor_cloud_wall_art_v1', '云月星空画', 'wallArt', '云朵梦幻', 48, { x: 500, y: 302, w: 390, h: 235 }, { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),

  makeRoomAssemblyShopItem('room_front_bed_pastel_candy_v1', '糖果粉彩床', 'bed', '糖果粉彩', 210, { x: 84, y: 754, w: 333, h: 370 }),
  makeRoomAssemblyShopItem('room_front_candy_nightstand_v1', '糖果床头柜', 'nightstand', '糖果粉彩', 70, { x: 414, y: 887, w: 185, h: 220 }),
  makeRoomAssemblyShopItem('room_front_candy_wardrobe_v1', '糖果衣柜', 'wardrobe', '糖果粉彩', 175, { x: 88, y: 412, w: 235, h: 330 }),
  makeRoomAssemblyShopItem('room_front_candy_vanity_v1', '糖果梳妆台', 'vanity', '糖果粉彩', 165, { x: 476, y: 506, w: 273, h: 340 }),
  makeRoomAssemblyShopItem('room_front_candy_desk_v1', '糖果书桌', 'desk', '糖果粉彩', 165, { x: 438, y: 630, w: 350, h: 275 }),
  makeRoomAssemblyShopItem('room_front_candy_bookshelf_v1', '糖果书架', 'bookshelf', '糖果粉彩', 155, { x: 840, y: 352, w: 300, h: 390 }),
  makeRoomAssemblyShopItem('room_front_candy_sofa_v1', '糖果沙发', 'sofa', '糖果粉彩', 220, { x: 660, y: 750, w: 420, h: 290 }),
  makeRoomAssemblyShopItem('room_decor_candy_rug_v1', '糖心华毯', 'rug', '糖果粉彩', 75, { x: 408, y: 872, w: 450, h: 270 }, { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } }),
  makeRoomAssemblyShopItem('room_decor_candy_floor_lamp_v1', '糖果落地灯', 'floorLamp', '糖果粉彩', 70, { x: 888, y: 494, w: 270, h: 450 }, { directional: false, collision: { enabled: true, x: 0.35, y: 0.82, w: 0.3, h: 0.14 } }),
  makeRoomAssemblyShopItem('room_decor_candy_wall_art_v1', '糖果甜景画', 'wallArt', '糖果粉彩', 60, { x: 492, y: 300, w: 420, h: 245 }, { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } })
];
const roomAssemblyShopByAssetId = new Map(roomAssemblyShopItems.map((item) => [item.assetId, item]));

function formatMoney(value) { const num = Number(value || 0); return Number.isFinite(num) ? num.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') : '0'; }
function formatTime(value) { if (!value) return text.untriggered; try { return new Date(Number(value)).toLocaleString('zh-CN'); } catch { return text.untriggered; } }
function toNum(value, fallback = 0) { const num = Number(value); return Number.isFinite(num) ? num : fallback; }
function parseChainPayload(event = {}) {
  if (event.payload && typeof event.payload === 'object') return event.payload;
  try {
    const parsed = JSON.parse(String(event.payload_json || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
function getChainEventsForDisplay(eventMap = {}, chainId) {
  const events = eventMap?.[String(chainId)];
  return Array.isArray(events) ? events : [];
}
function buildViewingDialogue(events = []) {
  const viewEvent = events.find((event) => event.event_type === 'view_round');
  if (!viewEvent) return null;
  const payload = parseChainPayload(viewEvent);
  const dynamicLines = Array.isArray(payload.dialogue)
    ? payload.dialogue
        .map((line) => ({
          speaker: line?.speaker === 'agent' ? text.agent : text.character,
          content: String(line?.content || line?.text || '').trim()
        }))
        .filter((line) => line.content)
    : [];
  const lines = dynamicLines.length > 0 ? dynamicLines : [
    payload.agent_intro ? { speaker: text.agent, content: payload.agent_intro } : null,
    payload.char_reply_1 ? { speaker: text.character, content: payload.char_reply_1 } : null,
    payload.agent_followup ? { speaker: text.agent, content: payload.agent_followup } : null,
    payload.char_reply_2 ? { speaker: text.character, content: payload.char_reply_2 } : null
  ].filter(Boolean);
  return {
    lines,
    summary: String(payload.view_summary || '').trim(),
    interest: Number(payload.interest_score_2 || payload.interest_score_1 || 0)
  };
}
function getChainNote(events = [], type) {
  const event = events.find((item) => item.event_type === type);
  if (!event) return '';
  const payload = parseChainPayload(event);
  return String(payload.log || payload.consideration_log || payload.decision_log || payload.reason || '').trim();
}
function summarizeAgencyError(value) {
  const raw = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  return raw.length > 320 ? `${raw.slice(0, 320)}...` : raw;
}
function Pill({ children, bg = '#f8fafc', color = '#475569', icon: Icon = null }) {
  return (
    <span className="housing-pill" style={{ background: bg, color }}>
      {Icon ? <Icon size={13} strokeWidth={2.4} /> : null}
      <span>{children}</span>
    </span>
  );
}
function Section({ title, extra, icon: Icon = null, children }) {
  return (
    <section style={shell.section} className="housing-section">
      <div className="housing-section-head">
        <div className="housing-section-title">
          {Icon ? <Icon size={17} strokeWidth={2.4} /> : null}
          <span>{title}</span>
        </div>
        {extra ? <div className="housing-section-extra">{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children, span = false }) { return <label className="housing-field" style={{ gridColumn: span ? '1 / -1' : 'auto' }}><span>{label}</span>{children}</label>; }
function ActionButton({ children, icon: Icon = null, tone = 'neutral', disabled = false, className = '', style = {}, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`housing-action-btn housing-action-btn--${tone} ${className}`.trim()}
      style={{ opacity: disabled ? 0.62 : 1, ...style }}
    >
      {Icon ? <Icon size={15} strokeWidth={2.5} /> : null}
      <span>{children}</span>
    </button>
  );
}
function StatCard({ label, value, tone = 'neutral', icon: Icon = null }) {
  const color = tone === 'good' ? '#047857' : tone === 'warn' ? '#be123c' : tone === 'info' ? '#1d4ed8' : '#334155';
  const bg = tone === 'good' ? '#ecfdf5' : tone === 'warn' ? '#fff1f2' : tone === 'info' ? '#eff6ff' : '#fff';
  return (
    <div className="housing-stat-card" style={{ ...shell.card, background: bg }}>
      <div className="housing-stat-meta">
        {Icon ? <Icon size={15} strokeWidth={2.4} /> : null}
        <span>{label}</span>
      </div>
      <div style={{ color }} className="housing-stat-value">{value}</div>
    </div>
  );
}
const chainStageLabels = {
  recommended: '推荐',
  viewing: '看房',
  viewed: '看完',
  considering: '考虑',
  considered: '已考虑',
  deciding: '决定',
  ready_to_sign: '待签约',
  signing: '签约',
  signed: '已签',
  completed: '完成'
};
const chainStageOrder = ['recommended', 'viewing', 'considering', 'deciding', 'ready_to_sign', 'signing', 'completed'];
function getChainTone(status) {
  if (status === 'failed') return { bg: '#fff1f2', color: '#be123c', icon: AlertTriangle };
  if (status === 'completed') return { bg: '#dcfce7', color: '#166534', icon: CheckCircle2 };
  return { bg: '#eff6ff', color: '#1d4ed8', icon: CircleDashed };
}
function getHousingStatusTone(status, hasHousing) {
  if (status === 'overdue') return { bg: '#fff1f2', color: '#be123c', icon: AlertTriangle, label: text.overdue };
  if (hasHousing) return { bg: '#ecfdf5', color: '#047857', icon: Home, label: text.stable };
  return { bg: '#f8fafc', color: '#475569', icon: CircleDashed, label: text.homeless };
}
function ScoreBar({ label, value, color = '#1d4ed8' }) {
  const safe = Math.max(0, Math.min(60, Number(value || 0)));
  const width = `${Math.min(100, Math.round((safe / 60) * 100))}%`;
  return (
    <div className="housing-score-row">
      <div className="housing-score-label"><span>{label}</span><strong>{Number(value || 0)}</strong></div>
      <div className="housing-score-track"><span style={{ width, background: color }} /></div>
    </div>
  );
}
function HomeMetricBars({ home = {} }) {
  return (
    <div className="housing-score-grid">
      <ScoreBar label={text.comfort} value={home.comfort} color="#0f766e" />
      <ScoreBar label={text.prestige} value={home.prestige} color="#7c3aed" />
      <ScoreBar label={text.privacy} value={home.privacy} color="#c2410c" />
    </div>
  );
}
function ChainProgress({ stage = '', status = '' }) {
  const normalized = status === 'completed' ? 'completed' : String(stage || 'recommended');
  const currentIndex = Math.max(0, chainStageOrder.indexOf(normalized));
  return (
    <div className="housing-chain-progress">
      {chainStageOrder.map((item, index) => (
        <div
          key={item}
          className={`housing-chain-step ${index <= currentIndex ? 'is-active' : ''} ${item === normalized ? 'is-current' : ''}`}
          title={chainStageLabels[item] || item}
        >
          <span />
          <em>{chainStageLabels[item] || item}</em>
        </div>
      ))}
    </div>
  );
}
function RentalChainCard({ chain, events }) {
  const [detailExpanded, setDetailExpanded] = useState(false);
  const viewingDialogue = buildViewingDialogue(events);
  const consideration = getChainNote(events, 'consideration');
  const decision = getChainNote(events, 'decision');
  const tone = getChainTone(chain.status);
  const dialogueLines = Array.isArray(viewingDialogue?.lines) ? viewingDialogue.lines : [];
  const hasDetail = Boolean(dialogueLines.length || viewingDialogue?.summary || consideration || decision);
  const detailPreview = [
    viewingDialogue?.summary,
    consideration,
    decision,
    dialogueLines[0]?.content
  ].find((item) => String(item || '').trim()) || '已生成看房记录，展开查看完整内容。';
  const detailCountLabel = dialogueLines.length ? `${dialogueLines.length} 条对话` : '记录';
  const renderDetail = () => (
    <>
      {dialogueLines.length ? (
        <div className="housing-dialogue-panel">
          <div className="housing-dialogue-title"><MessageSquareText size={15} />{text.viewDialogue}</div>
          <div className="housing-dialogue-scroll">
            {dialogueLines.map((line, index) => (
              <div key={`${chain.id}-view-${index}`} className={`housing-dialogue-line ${line.speaker === text.agent ? 'is-agent' : 'is-character'}`}>
                <span>{line.speaker}</span>
                <p>{line.content}</p>
              </div>
            ))}
          </div>
          {viewingDialogue.summary ? <div className="housing-chain-note">{text.viewSummary}: {viewingDialogue.summary}</div> : null}
        </div>
      ) : null}
      {!dialogueLines.length && viewingDialogue?.summary ? <div className="housing-chain-note">{text.viewSummary}: {viewingDialogue.summary}</div> : null}
      {(consideration || decision) ? (
        <div className="housing-chain-notes">
          {consideration ? <div><strong>{text.consideration}</strong><span>{consideration}</span></div> : null}
          {decision ? <div><strong>{text.decision}</strong><span>{decision}</span></div> : null}
        </div>
      ) : null}
    </>
  );
  return (
    <div className="housing-chain-card">
      <div className="housing-chain-top">
        <div className="housing-chain-title-wrap">
          <div className="housing-chain-kicker">{formatTime(chain.updated_at)}</div>
          <div className="housing-chain-title">{chain.character_name || chain.character_id}<span>→</span>{chain.home_emoji || ''}{chain.home_name || chain.home_id}</div>
        </div>
        <Pill bg={tone.bg} color={tone.color} icon={tone.icon}>{chain.status}</Pill>
      </div>
      <ChainProgress stage={chain.stage} status={chain.status} />
      {chain.error_message ? <div className="housing-chain-error">{chain.error_message}</div> : null}
      {hasDetail ? (
        <div className={`housing-chain-detail ${detailExpanded ? 'is-open' : 'is-collapsed'}`}>
          <button type="button" className="housing-chain-detail-toggle" aria-expanded={detailExpanded} onClick={() => setDetailExpanded((value) => !value)}>
            <span className="housing-chain-detail-toggle-main">
              <MessageSquareText size={15} />
              <span>看房记录</span>
              <em>{detailCountLabel}</em>
            </span>
            <span className="housing-chain-detail-toggle-action">
              {detailExpanded ? '收起' : '展开'}
              {detailExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </span>
          </button>
          {detailExpanded ? renderDetail() : <div className="housing-chain-detail-preview">{detailPreview}</div>}
        </div>
      ) : null}
    </div>
  );
}
function HomeSummaryCard({ home, title = text.selectedHome, compact = false, actions = null }) {
  if (!home) {
    return (
      <div className="housing-summary-card is-empty">
        <div className="housing-muted">{text.unboundHousing}</div>
      </div>
    );
  }
  const moveInCost = Number(home.weekly_rent || 0) + Number(home.deposit || 0);
  return (
    <div className={`housing-summary-card ${compact ? 'is-compact' : ''}`}>
      <div className="housing-summary-head">
        <div>
          <div className="housing-card-kicker">{title}</div>
          <div className="housing-home-title">{home.emoji || ''} {home.name || home.id}</div>
        </div>
        <Pill bg="#fff7ed" color="#c2410c" icon={BadgeDollarSign}>{formatMoney(home.weekly_rent)}/周</Pill>
      </div>
      <div className="housing-home-desc">{home.description || '-'}</div>
      <div className="housing-home-money">
        <span><strong>{formatMoney(home.deposit)}</strong>{text.deposit}</span>
        <span><strong>{formatMoney(moveInCost)}</strong>{text.moveInCost}</span>
        <span><strong>{formatMoney(home.sale_price)}</strong>{text.buyout}</span>
      </div>
      <HomeMetricBars home={home} />
      {actions ? <div className="housing-card-actions">{actions}</div> : null}
    </div>
  );
}
function CharacterHousingCard({ character, binding, selectedHousing, status, sortedHousingTiers, savingBindingId, updateBinding, payRent }) {
  const tone = getHousingStatusTone(status, !!selectedHousing);
  return (
    <div className="housing-character-card">
      <div className="housing-character-head">
        <div className="housing-character-main">
          <div className="housing-character-avatar">{String(character.name || '?').slice(0, 1)}</div>
          <div>
            <div className="housing-character-name">{character.name}</div>
            <div className="housing-character-meta">
              <span><WalletCards size={13} />{formatMoney(character.wallet)}</span>
              <span>{character.location || text.unknown}</span>
              <span>{character.city_status || text.idle}</span>
            </div>
          </div>
        </div>
        <div className="housing-character-actions">
          <Pill bg={tone.bg} color={tone.color} icon={tone.icon}>{tone.label}</Pill>
          <ActionButton
            icon={KeyRound}
            tone="warning"
            title={text.payRent}
            disabled={savingBindingId === character.id}
            onClick={() => payRent(character.id).catch((err) => alert(err.message))}
          >
            {savingBindingId === character.id ? text.saving : text.payRent}
          </ActionButton>
        </div>
      </div>
      <div className="housing-binding-grid">
        <Field label={text.homeName}>
          <select style={shell.input} value={binding.housing_id || ''} onChange={(e) => updateBinding(character.id, { ...binding, housing_id: e.target.value }).catch((err) => alert(err.message))}>
            <option value="">{text.unboundHousing}</option>
            {sortedHousingTiers.map((item) => <option key={item.id} value={item.id}>{item.emoji || ''} {item.name}</option>)}
          </select>
        </Field>
        <Field label="状态">
          <select style={shell.input} value={binding.housing_status || 'stable'} onChange={(e) => updateBinding(character.id, { ...binding, housing_status: e.target.value }).catch((err) => alert(err.message))}>
            <option value="stable">{text.stable}</option>
            <option value="temporary">{text.temporary}</option>
            <option value="unstable">{text.unstable}</option>
            <option value="overdue">{text.overdue}</option>
          </select>
        </Field>
        <Field label={text.weeklyRent}>
          <input style={shell.input} type="number" value={binding.rent_weekly ?? 0} onChange={(e) => updateBinding(character.id, { ...binding, rent_weekly: toNum(e.target.value) }).catch((err) => alert(err.message))} />
        </Field>
        <Field label={text.rentDue}>
          <input style={shell.input} type="number" value={binding.rent_due_day ?? 7} onChange={(e) => updateBinding(character.id, { ...binding, rent_due_day: toNum(e.target.value, 7) }).catch((err) => alert(err.message))} />
        </Field>
        <Field label={text.note} span>
          <input style={shell.input} value={binding.note || ''} onChange={(e) => updateBinding(character.id, { ...binding, note: e.target.value }).catch((err) => alert(err.message))} />
        </Field>
      </div>
      <div className="housing-character-facts">
        <Pill icon={Home}>{text.currentHome} {selectedHousing?.name || text.unboundHousing}</Pill>
        <Pill icon={BadgeDollarSign}>{text.deposit} {formatMoney(selectedHousing?.deposit || 0)}</Pill>
        <Pill icon={Clock3}>{text.nextRentDue} {formatTime(binding.rent_due_at)}</Pill>
        <Pill icon={AlertTriangle}>{text.missedRent} {binding.missed_rent_count || 0}</Pill>
      </div>
      {selectedHousing ? <HomeMetricBars home={selectedHousing} /> : null}
    </div>
  );
}
function hashText(value) {
  return String(value || '').split('').reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) % 9973, 7);
}
function pickRoomAssemblyPalette(home = {}) {
  const rent = toNum(home.weekly_rent);
  const comfort = toNum(home.comfort);
  const prestige = toNum(home.prestige);
  if (prestige >= 48 || rent >= 130) return roomAssemblyPalettes.candy;
  if (prestige >= 32 || comfort >= 36) return roomAssemblyPalettes.cloud;
  if (comfort >= 24 || toNum(home.privacy) >= 22) return roomAssemblyPalettes.ocean;
  if (comfort >= 14 || rent >= 32) return roomAssemblyPalettes.standard;
  return roomAssemblyPalettes.budget;
}
function getRoomAssemblyBudget(home = {}) {
  const rent = toNum(home.weekly_rent);
  const comfort = toNum(home.comfort);
  const prestige = toNum(home.prestige);
  const privacy = toNum(home.privacy);
  if (prestige >= 48 || rent >= 130) return 3200;
  if (prestige >= 32 || rent >= 90 || comfort >= 38) return 2200;
  if (comfort >= 24 || privacy >= 22 || rent >= 55) return 1450;
  if (comfort >= 14 || rent >= 32) return 950;
  return 600;
}
function normalizeRoomAssemblyKind(value) {
  const text = String(value || '').trim();
  const compact = text.replace(/[\s_-]+/g, '').toLowerCase();
  const aliases = {
    bed: 'bed',
    '床': 'bed',
    nightstand: 'nightstand',
    bedside: 'nightstand',
    bedsidecabinet: 'nightstand',
    '床头柜': 'nightstand',
    wardrobe: 'wardrobe',
    closet: 'wardrobe',
    '衣柜': 'wardrobe',
    vanity: 'vanity',
    dresser: 'vanity',
    '梳妆台': 'vanity',
    desk: 'desk',
    table: 'desk',
    '书桌': 'desk',
    bookshelf: 'bookshelf',
    bookcase: 'bookshelf',
    shelf: 'bookshelf',
    '书架': 'bookshelf',
    '书柜': 'bookshelf',
    sofa: 'sofa',
    couch: 'sofa',
    '沙发': 'sofa',
    rug: 'rug',
    carpet: 'rug',
    '地毯': 'rug',
    floorlamp: 'floorLamp',
    lamp: 'floorLamp',
    tablelamp: 'floorLamp',
    '落地灯': 'floorLamp',
    '台灯': 'floorLamp',
    wallart: 'wallArt',
    art: 'wallArt',
    painting: 'wallArt',
    '挂画': 'wallArt',
    '墙面装饰': 'wallArt'
  };
  const kind = aliases[text] || aliases[text.toLowerCase()] || aliases[compact];
  return roomAssemblyKinds.includes(kind) ? kind : '';
}
function normalizeRoomAssemblyDirection(value) {
  const text = String(value || '').trim();
  const aliases = { front: 'front', '正面': 'front', back: 'back', '背面': 'back', left: 'left', '左': 'left', '左侧': 'left', right: 'right', '右': 'right', '右侧': 'right' };
  const direction = aliases[text] || aliases[text.toLowerCase()] || text.toLowerCase();
  return roomAssemblyAllowedDirections.has(direction) ? direction : 'front';
}
function getRoomAssemblyBaseAssetId(assetId) {
  const value = String(assetId || '').trim();
  const match = value.match(/^room_dir_(.+)_(front|back|left|right)_v1$/);
  return match ? `room_front_${match[1]}_v1` : value;
}
function getRoomAssemblyShopItemForAsset(assetId) {
  const baseAssetId = getRoomAssemblyBaseAssetId(assetId);
  return roomAssemblyShopByAssetId.get(baseAssetId) || null;
}
function getRoomAssemblyKindFromAssetId(assetId) {
  const shopItem = getRoomAssemblyShopItemForAsset(assetId);
  if (shopItem?.kind) return shopItem.kind;
  const value = String(assetId || '').toLowerCase();
  if (value.includes('nightstand')) return 'nightstand';
  if (value.includes('wardrobe')) return 'wardrobe';
  if (value.includes('vanity')) return 'vanity';
  if (value.includes('bookshelf')) return 'bookshelf';
  if (value.includes('sofa')) return 'sofa';
  if (value.includes('desk')) return 'desk';
  if (value.includes('floor_lamp') || value.includes('floor-lamp') || value.includes('table_lamp') || value.includes('table-lamp')) return 'floorLamp';
  if (value.includes('wall_art') || value.includes('wall-art')) return 'wallArt';
  if (value.includes('rug')) return 'rug';
  if (value.includes('_bed_') || value.includes('front_bed') || value.includes('bed_')) return 'bed';
  return '';
}
function buildRoomAssemblySizeProfile(items = []) {
  return (Array.isArray(items) ? items : []).reduce((profile, item) => {
    const kind = normalizeRoomAssemblyKind(item?.assemblyKind) || getRoomAssemblyKindFromAssetId(item?.assetId);
    const w = Math.round(toNum(item?.w, 0));
    const h = Math.round(toNum(item?.h, 0));
    if (!kind || w < 8 || h < 8) return profile;
    const current = profile[kind];
    const area = w * h;
    if (!current || area > current.w * current.h) {
      profile[kind] = { w, h, sourceAssetId: String(item?.assetId || '') };
    }
    return profile;
  }, {});
}
function normalizeRoomAssemblySizeProfile(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce((profile, [kind, size]) => {
    const safeKind = normalizeRoomAssemblyKind(kind);
    const w = Math.round(toNum(size?.w, 0));
    const h = Math.round(toNum(size?.h, 0));
    if (!safeKind || w < 8 || h < 8) return profile;
    profile[safeKind] = {
      w,
      h,
      sourceAssetId: String(size?.sourceAssetId || '')
    };
    return profile;
  }, {});
}
function getRoomAssemblyCurrentSizeProfile() {
  if (typeof window === 'undefined') return {};
  try {
    const layoutProfile = buildRoomAssemblySizeProfile(JSON.parse(window.localStorage.getItem(roomEditorStorageKey) || '[]'));
    const storedProfile = normalizeRoomAssemblySizeProfile(JSON.parse(window.localStorage.getItem(roomEditorSizeProfileStorageKey) || '{}'));
    return { ...layoutProfile, ...roomAssemblyCalibratedSizeProfile, ...storedProfile };
  } catch {
    return { ...roomAssemblyCalibratedSizeProfile };
  }
}
function applyRoomAssemblySizeProfile(box = {}, kind = '', sizeProfile = {}) {
  const safeKind = normalizeRoomAssemblyKind(kind);
  const size = safeKind ? sizeProfile?.[safeKind] : null;
  if (!size) return box;
  return {
    ...box,
    w: Math.max(1, Math.round(toNum(size.w, box.w || 1))),
    h: Math.max(1, Math.round(toNum(size.h, box.h || 1)))
  };
}
function roomAssemblyDirectionalAssetId(assetId, direction = 'front') {
  const baseAssetId = getRoomAssemblyBaseAssetId(assetId);
  const shopItem = roomAssemblyShopByAssetId.get(baseAssetId);
  const safeDirection = normalizeRoomAssemblyDirection(direction);
  if (!shopItem?.directional || safeDirection === 'front') return baseAssetId;
  const match = baseAssetId.match(/^room_front_(.+)_v1$/);
  return match ? `room_dir_${match[1]}_${safeDirection}_v1` : baseAssetId;
}
function makeRoomAssemblyItem(assetId, box, suffix, meta = {}) {
  return {
    assetId,
    id: `${assetId}-agency-${suffix}`,
    ...box,
    assemblyKind: meta.kind || meta.assemblyKind || '',
    direction: normalizeRoomAssemblyDirection(meta.direction),
    collision: meta.collision || { enabled: true, x: 0.16, y: 0.68, w: 0.68, h: 0.28 },
    placeAnchor: meta.placeAnchor || { x: 0.5, y: 1 },
    ...(meta.groundLayer ? { groundLayer: true } : {})
  };
}
function roomAssemblyAssetId(groupId, direction = 'front') {
  return direction === 'front'
    ? `room_front_${groupId}_v1`
    : `room_dir_${groupId}_${direction}_v1`;
}
function roomAssemblyNightstandSize(direction) {
  return direction === 'left' || direction === 'right'
    ? { w: 145, h: 220 }
    : { w: 185, h: 220 };
}
function roomAssemblyBedSize(direction) {
  return direction === 'left' || direction === 'right'
    ? { w: 606, h: 370 }
    : { w: 343, h: 370 };
}
function getRoomAssemblyGroup(palette, kind) {
  if (kind === 'bed') return palette.bedGroup;
  if (kind === 'nightstand') return palette.nightstandGroup;
  if (kind === 'wardrobe') return palette.wardrobeGroup;
  if (kind === 'vanity') return palette.vanityGroup;
  return '';
}
function getRoomAssemblyItemSize(palette, kind, direction, sizeProfile = {}) {
  const baseSize = kind === 'bed'
    ? roomAssemblyBedSize(direction)
    : kind === 'nightstand'
      ? roomAssemblyNightstandSize(direction)
      : kind === 'wardrobe'
        ? { w: 235, h: 330 }
        : kind === 'vanity'
          ? { w: palette.vanityW || 273, h: 340 }
          : { w: 120, h: 120 };
  return applyRoomAssemblySizeProfile(baseSize, kind, sizeProfile);
}
function clampRoomAssemblyBox(box, bounds = {}) {
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
    y: Math.max(minY, Math.min(roomEditorStageSize.height - h - maxYPad, Math.round(box.y || minY)))
  };
}
function makeRoomAssemblyKindItem(palette, kind, direction, box, sizeProfile = {}) {
  const safeKind = normalizeRoomAssemblyKind(kind);
  const safeDirection = normalizeRoomAssemblyDirection(direction);
  const group = getRoomAssemblyGroup(palette, safeKind);
  if (!safeKind || !group) return null;
  return makeRoomAssemblyItem(
    roomAssemblyAssetId(group, safeDirection),
    clampRoomAssemblyBox({ ...getRoomAssemblyItemSize(palette, safeKind, safeDirection, sizeProfile), ...box }),
    `${safeKind}-${safeDirection}`,
    { kind: safeKind, direction: safeDirection }
  );
}
function getRoomAssemblyCellsForBox(box = {}) {
  const cellW = roomEditorStageSize.width / roomAssemblyGridSize.cols;
  const cellH = roomEditorStageSize.height / roomAssemblyGridSize.rows;
  return `${Math.max(1, Math.ceil(toNum(box.w, 1) / cellW))}x${Math.max(1, Math.ceil(toNum(box.h, 1) / cellH))}`;
}
function getRoomAssemblyGridFootprint(box = {}) {
  const cellW = roomEditorStageSize.width / roomAssemblyGridSize.cols;
  const cellH = roomEditorStageSize.height / roomAssemblyGridSize.rows;
  return {
    cols: Math.max(1, Math.ceil(toNum(box.w, 1) / cellW)),
    rows: Math.max(1, Math.ceil(toNum(box.h, 1) / cellH))
  };
}
function getRoomAssemblyVisualOffset(kind, box = {}) {
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
function clampRoomAssemblyVisualBoxByKind(kind, box = {}) {
  const safeKind = normalizeRoomAssemblyKind(kind);
  if (safeKind !== 'wallArt') return box;
  const h = Math.max(1, toNum(box.h, 1));
  const minY = roomAssemblyWallArtVisualBounds.minY;
  const maxY = roomAssemblyWallArtVisualBounds.maxBottomY - h;
  const y = maxY < minY
    ? maxY
    : Math.max(minY, Math.min(maxY, toNum(box.y, minY)));
  return {
    ...box,
    y: Math.round(y)
  };
}
function getRoomAssemblyGridAxisRange(footprintSize = 1, axisSize = 16, minOverride = null, maxOverride = null) {
  const baseMin = roomAssemblyWallBufferCells;
  const baseMax = Math.max(baseMin, axisSize - roomAssemblyWallBufferCells - Math.max(1, footprintSize));
  const requestedMin = minOverride == null ? baseMin : toNum(minOverride, baseMin);
  const requestedMax = maxOverride == null ? baseMax : toNum(maxOverride, baseMax);
  const min = Math.max(baseMin, Math.round(requestedMin));
  const max = Math.max(min, Math.min(baseMax, Math.round(requestedMax)));
  return { min, max };
}
function clampRoomAssemblyGridCoordinate(value, footprintSize = 1, axisSize = 16, fallback = roomAssemblyWallBufferCells, minOverride = null, maxOverride = null) {
  const { min, max } = getRoomAssemblyGridAxisRange(footprintSize, axisSize, minOverride, maxOverride);
  const num = Math.round(toNum(value, fallback));
  return Math.max(min, Math.min(max, num));
}
function getRoomAssemblyPlacementGridBounds(kind) {
  if (kind === 'wallArt') return { minY: 2, maxY: 3, fallbackY: 2 };
  if (kind === 'rug') return { minY: 8, fallbackY: 9 };
  if (kind === 'bed') return { minY: 4, fallbackY: 4 };
  return { minY: 4, fallbackY: 4 };
}
function getRoomAssemblyFurnitureContext(sizeProfile = {}) {
  return roomAssemblyShopItems.map((item) => ({
    assetId: item.assetId,
    item: item.kind,
    label: item.name,
    style: item.style,
    price: item.price,
    maxQuantity: item.maxQuantity,
    preferred_dir: item.preferred_dir,
    directional: item.directional,
    cells: {
      front: getRoomAssemblyCellsForBox(applyRoomAssemblySizeProfile(item.box, item.kind, sizeProfile)),
      side: item.directional ? 'directional variant may change width' : undefined
    },
    size_px: {
      w: applyRoomAssemblySizeProfile(item.box, item.kind, sizeProfile).w,
      h: applyRoomAssemblySizeProfile(item.box, item.kind, sizeProfile).h
    }
  }));
}
function getRoomAssemblyDirections(seed, home = {}) {
  return {
    bed: 'front',
    nightstand: 'front',
    wardrobe: 'front',
    vanity: 'front'
  };
}
function getRoomAssemblyDirectionSummary(home = {}) {
  const directions = getRoomAssemblyDirections(hashText(`${home.id || ''}:${home.name || ''}`), home);
  return `床 ${roomAssemblyDirectionLabels[directions.bed]} / 床头柜 ${roomAssemblyDirectionLabels[directions.nightstand]} / 衣柜 ${roomAssemblyDirectionLabels[directions.wardrobe]} / 梳妆台 ${roomAssemblyDirectionLabels[directions.vanity]}`;
}
function getRoomAssemblyFallbackShopItem(palette, kind) {
  const style = roomAssemblyShopByAssetId.get(roomAssemblyAssetId(palette.bedGroup, 'front'))?.style || '';
  return roomAssemblyShopItems.find((item) => item.kind === kind && item.style === style)
    || roomAssemblyShopItems.find((item) => item.kind === kind)
    || null;
}
function buildFallbackRoomAssemblyItems(home = {}, palette = pickRoomAssemblyPalette(home), directions = getRoomAssemblyDirections(hashText(`${home.id || ''}:${home.name || ''}`), home), sizeProfile = {}) {
  const seed = hashText(`${home.id || ''}:${home.name || ''}`);
  const softShift = (seed % 29) - 14;
  const budget = getRoomAssemblyBudget(home);
  let spent = 0;
  const fallbackSlots = [
    { kind: 'wardrobe', x: 2, y: 4 },
    { kind: 'vanity', x: 6, y: 4 },
    { kind: 'bed', x: 2 + (seed % 2), y: 4 },
    { kind: 'nightstand', x: 7, y: 10 },
    { kind: 'desk', x: 10, y: 4 },
    { kind: 'bookshelf', x: 10, y: 8 },
    { kind: 'sofa', x: 8, y: 10 },
    { kind: 'rug', x: 3, y: 9 },
    { kind: 'floorLamp', x: 5, y: 4 },
    { kind: 'wallArt', x: 5 + (seed % 2), y: 2 }
  ];
  const placements = fallbackSlots.reduce((acc, slot) => {
    const shopItem = getRoomAssemblyFallbackShopItem(palette, slot.kind);
    const price = toNum(shopItem?.price, 0);
    const isCore = roomAssemblyCoreKinds.includes(slot.kind);
    if (!shopItem || (!isCore && spent + price > budget)) return acc;
    spent += price;
    acc.push({
      assetId: shopItem.assetId,
      item: slot.kind,
      x: slot.x,
      y: Math.max(slot.y, slot.y + Math.round(softShift / 40)),
      dir: directions[slot.kind] || shopItem.preferred_dir || 'front'
    });
    return acc;
  }, []);
  return buildRoomAssemblyAiItems(palette, { placements }, sizeProfile);
}
function getRoomAssemblyDirectionFromAssetId(assetId) {
  const match = String(assetId || '').match(/^room_dir_.+_(front|back|left|right)_v1$/);
  return match ? match[1] : '';
}
function getRoomAssemblyPlacementPriority(kind) {
  const order = {
    bed: 10,
    wardrobe: 20,
    vanity: 30,
    desk: 40,
    bookshelf: 50,
    sofa: 60,
    nightstand: 70,
    floorLamp: 80,
    wallArt: 90,
    rug: 100
  };
  return order[kind] || 999;
}
const roomAssemblySingleInstanceKinds = new Set(['wallArt']);
const roomAssemblyWallFriendlyKinds = new Set(['bed', 'wardrobe', 'vanity', 'desk', 'bookshelf', 'sofa']);
function getRoomAssemblyRawGridCoordinate(value, fallback = roomAssemblyWallBufferCells) {
  const num = toNum(value, fallback);
  return Number.isFinite(num) ? num : fallback;
}
function getRoomAssemblyPlacementKind(placement) {
  const requestedAssetId = String(placement?.assetId || placement?.asset_id || placement?.asset || '').trim();
  const shopItem = requestedAssetId ? getRoomAssemblyShopItemForAsset(requestedAssetId) : null;
  return normalizeRoomAssemblyKind(placement?.item || placement?.kind || placement?.category || placement?.id || shopItem?.kind);
}
function getRoomAssemblyWallPreferenceScore(kind, candidate, xRange, yRange) {
  if (!roomAssemblyWallFriendlyKinds.has(kind)) return 0;
  const sideWallDistance = Math.min(Math.abs(candidate.x - xRange.min), Math.abs(candidate.x - xRange.max));
  const backWallDistance = Math.abs(candidate.y - yRange.min);
  return (backWallDistance * 2) + sideWallDistance;
}
function getRoomAssemblyPlacementCandidates(kind, footprint = {}, requestedX, requestedY) {
  const placementBounds = getRoomAssemblyPlacementGridBounds(kind);
  const xRange = getRoomAssemblyGridAxisRange(footprint.cols, roomAssemblyGridSize.cols);
  const yRange = getRoomAssemblyGridAxisRange(footprint.rows, roomAssemblyGridSize.rows, placementBounds.minY, placementBounds.maxY);
  const startX = clampRoomAssemblyGridCoordinate(requestedX, footprint.cols, roomAssemblyGridSize.cols, roomAssemblyWallBufferCells);
  const startY = clampRoomAssemblyGridCoordinate(requestedY, footprint.rows, roomAssemblyGridSize.rows, placementBounds.fallbackY, placementBounds.minY, placementBounds.maxY);
  const candidates = [];
  for (let y = yRange.min; y <= yRange.max; y += 1) {
    for (let x = xRange.min; x <= xRange.max; x += 1) {
      const candidate = { x, y, distance: Math.abs(x - startX) + Math.abs(y - startY) };
      candidates.push({
        ...candidate,
        wallScore: getRoomAssemblyWallPreferenceScore(kind, candidate, xRange, yRange)
      });
    }
  }
  return candidates.sort((a, b) => (a.distance - b.distance) || (a.wallScore - b.wallScore) || (a.y - b.y) || (a.x - b.x));
}
function isRoomAssemblyRequestedGridInsideBounds(kind, footprint = {}, requestedX, requestedY) {
  const requestedGridX = Math.round(toNum(requestedX, Number.NaN));
  const requestedGridY = Math.round(toNum(requestedY, Number.NaN));
  if (!Number.isFinite(requestedGridX) || !Number.isFinite(requestedGridY)) return false;
  const placementBounds = getRoomAssemblyPlacementGridBounds(kind);
  const xRange = getRoomAssemblyGridAxisRange(footprint.cols, roomAssemblyGridSize.cols);
  const yRange = getRoomAssemblyGridAxisRange(footprint.rows, roomAssemblyGridSize.rows, placementBounds.minY, placementBounds.maxY);
  return requestedGridX >= xRange.min
    && requestedGridX <= xRange.max
    && requestedGridY >= yRange.min
    && requestedGridY <= yRange.max;
}
function getRoomAssemblyOverlapArea(a, b, padding = 8) {
  if (!a || !b || ['rug', 'wallArt'].includes(a.assemblyKind) || ['rug', 'wallArt'].includes(b.assemblyKind)) return 0;
  const left = Math.max(toNum(a.x), toNum(b.x));
  const top = Math.max(toNum(a.y), toNum(b.y));
  const right = Math.min(toNum(a.x) + toNum(a.w), toNum(b.x) + toNum(b.w));
  const bottom = Math.min(toNum(a.y) + toNum(a.h), toNum(b.y) + toNum(b.h));
  const w = right - left;
  const h = bottom - top;
  if (w <= padding || h <= padding) return 0;
  return w * h;
}
function getRoomAssemblyOverlapScore(item, existingItems = []) {
  return existingItems.reduce((sum, existing) => sum + getRoomAssemblyOverlapArea(item, existing), 0);
}
function buildRoomAssemblyItemFromPlacement(palette, placement, index = 0, sizeProfile = {}, gridOverride = null) {
  const requestedAssetId = String(placement?.assetId || placement?.asset_id || placement?.asset || '').trim();
  const shopItem = requestedAssetId ? getRoomAssemblyShopItemForAsset(requestedAssetId) : null;
  const kind = normalizeRoomAssemblyKind(placement?.item || placement?.kind || placement?.category || placement?.id || shopItem?.kind);
  if (!kind) return null;
  const direction = normalizeRoomAssemblyDirection(placement?.dir || placement?.direction || placement?.facing || getRoomAssemblyDirectionFromAssetId(requestedAssetId) || shopItem?.preferred_dir);
  const cellW = roomEditorStageSize.width / roomAssemblyGridSize.cols;
  const cellH = roomEditorStageSize.height / roomAssemblyGridSize.rows;
  const placementBox = shopItem
    ? applyRoomAssemblySizeProfile(shopItem.box, shopItem.kind, sizeProfile)
    : getRoomAssemblyItemSize(palette, kind, direction, sizeProfile);
  const footprint = getRoomAssemblyGridFootprint(placementBox);
  const placementBounds = getRoomAssemblyPlacementGridBounds(kind);
  const shouldConstrainGrid = kind === 'wallArt';
  const gridX = shouldConstrainGrid
    ? clampRoomAssemblyGridCoordinate(gridOverride?.x ?? placement?.x, footprint.cols, roomAssemblyGridSize.cols, roomAssemblyWallBufferCells)
    : getRoomAssemblyRawGridCoordinate(gridOverride?.x ?? placement?.x, roomAssemblyWallBufferCells);
  const gridY = shouldConstrainGrid
    ? clampRoomAssemblyGridCoordinate(
      gridOverride?.y ?? placement?.y,
      footprint.rows,
      roomAssemblyGridSize.rows,
      placementBounds.fallbackY,
      placementBounds.minY,
      placementBounds.maxY
    )
    : getRoomAssemblyRawGridCoordinate(gridOverride?.y ?? placement?.y, placementBounds.fallbackY);
  const visualGridY = shouldConstrainGrid ? gridY : gridY - roomAssemblyVisualFloorLineOffsetCells;
  if (shopItem) {
    const assetId = roomAssemblyDirectionalAssetId(shopItem.assetId, direction);
    const visualOffset = getRoomAssemblyVisualOffset(shopItem.kind, placementBox);
    const visualBox = clampRoomAssemblyVisualBoxByKind(shopItem.kind, {
      ...placementBox,
      x: Math.round(gridX * cellW + visualOffset.x),
      y: Math.round(visualGridY * cellH + visualOffset.y)
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
        groundLayer: shopItem.groundLayer
      }
    );
  }
  const group = getRoomAssemblyGroup(palette, kind);
  if (!group) return null;
  return makeRoomAssemblyItem(
    roomAssemblyAssetId(group, direction),
    {
      ...getRoomAssemblyItemSize(palette, kind, direction, sizeProfile),
      x: Math.round(gridX * cellW),
      y: Math.round(visualGridY * cellH)
    },
    `${kind}-${index}-${direction}`,
    { kind, direction }
  );
}
function buildRoomAssemblyAiItems(palette, aiAssembly, sizeProfile = {}) {
  const placements = Array.isArray(aiAssembly?.placements) ? aiAssembly.placements : [];
  const items = [];
  const kindCounts = {};
  placements
    .map((placement, index) => ({ placement, index, kind: getRoomAssemblyPlacementKind(placement) }))
    .forEach(({ placement, index, kind }) => {
      if (roomAssemblySingleInstanceKinds.has(kind) && kindCounts[kind] >= 1) return;
      const baseItem = buildRoomAssemblyItemFromPlacement(palette, placement, index, sizeProfile);
      if (!baseItem) return;
      if (baseItem.assemblyKind !== 'wallArt') {
        items.push(baseItem);
        kindCounts[baseItem.assemblyKind] = (kindCounts[baseItem.assemblyKind] || 0) + 1;
        return;
      }
      const footprint = getRoomAssemblyGridFootprint(baseItem);
      const baseScore = getRoomAssemblyOverlapScore(baseItem, items);
      if (isRoomAssemblyRequestedGridInsideBounds(kind || baseItem.assemblyKind, footprint, placement?.x, placement?.y) && baseScore <= 0) {
        items.push(baseItem);
        kindCounts[baseItem.assemblyKind] = (kindCounts[baseItem.assemblyKind] || 0) + 1;
        return;
      }
      const candidates = getRoomAssemblyPlacementCandidates(kind || baseItem.assemblyKind, footprint, placement?.x, placement?.y);
      const resolvedItem = candidates.reduce((best, candidate) => {
        const candidateItem = buildRoomAssemblyItemFromPlacement(palette, placement, index, sizeProfile, candidate);
        const score = getRoomAssemblyOverlapScore(candidateItem, items);
        if (
          !best
          || score < best.score
          || (score === best.score && candidate.distance < best.distance)
          || (score === best.score && candidate.distance === best.distance && candidate.wallScore < best.wallScore)
          || (score === best.score && candidate.distance === best.distance && candidate.wallScore === best.wallScore && candidate.y < best.y)
          || (score === best.score && candidate.distance === best.distance && candidate.wallScore === best.wallScore && candidate.y === best.y && candidate.x < best.x)
        ) {
          return { item: candidateItem, score, wallScore: candidate.wallScore, distance: candidate.distance, x: candidate.x, y: candidate.y };
        }
        return best;
      }, null);
      const item = resolvedItem?.item || baseItem;
      if (!item) return;
      if (resolvedItem?.score > 0 && !roomAssemblyCoreKinds.includes(item.assemblyKind)) return;
      items.push(item);
      kindCounts[item.assemblyKind] = (kindCounts[item.assemblyKind] || 0) + 1;
    });
  return items;
}
function getRoomAssemblyItemPrice(assetId) {
  return toNum(getRoomAssemblyShopItemForAsset(assetId)?.price, 0);
}
function summarizeRoomAssemblyPurchases(items = []) {
  return items.map((item) => {
    const shopItem = getRoomAssemblyShopItemForAsset(item.assetId);
    return {
      assetId: getRoomAssemblyBaseAssetId(item.assetId),
      item: shopItem?.kind || item.assemblyKind || '',
      label: shopItem?.name || item.assetId,
      style: shopItem?.style || '',
      quantity: 1,
      price: toNum(shopItem?.price, 0),
      subtotal: toNum(shopItem?.price, 0)
    };
  });
}
function buildAgencyRoomAssembly(home = {}, aiAssembly = null, sizeProfile = getRoomAssemblyCurrentSizeProfile()) {
  const palette = pickRoomAssemblyPalette(home);
  const directions = getRoomAssemblyDirections(hashText(`${home.id || ''}:${home.name || ''}`), home);
  const fallbackItems = buildFallbackRoomAssemblyItems(home, palette, directions, sizeProfile);
  const fallbackByKind = new Map(fallbackItems.map((item) => [item.assemblyKind, item]));
  const aiItems = buildRoomAssemblyAiItems(palette, aiAssembly, sizeProfile);
  const hasAiLayout = aiItems.length > 0;
  const presentCoreKinds = new Set(aiItems.map((item) => item.assemblyKind).filter(Boolean));
  const missingCoreItems = roomAssemblyCoreKinds
    .filter((kind) => !presentCoreKinds.has(kind))
    .map((kind) => fallbackByKind.get(kind))
    .filter(Boolean);
  const items = hasAiLayout ? [...aiItems, ...missingCoreItems] : fallbackItems;
  const resolvedDirections = roomAssemblyKinds.reduce((acc, kind) => {
    acc[kind] = items.find((item) => item.assemblyKind === kind)?.direction || directions[kind] || 'front';
    return acc;
  }, {});
  const budget = getRoomAssemblyBudget(home);
  const purchases = summarizeRoomAssemblyPurchases(items);
  const spent = Math.round(purchases.reduce((sum, purchase) => sum + toNum(purchase.subtotal, 0), 0));
  return {
    selectedId: items[0]?.id || '',
    savedAt: Date.now(),
    source: hasAiLayout ? 'social-housing-agency-room-assembly-ai' : 'social-housing-agency-room-assembly-template',
    home: {
      id: String(home.id || ''),
      name: String(home.name || ''),
      emoji: String(home.emoji || ''),
      weekly_rent: toNum(home.weekly_rent),
      comfort: toNum(home.comfort),
      prestige: toNum(home.prestige),
      privacy: toNum(home.privacy)
    },
    palette: palette.label,
    budget,
    spent,
    purchases,
    sizeProfile,
    directions: resolvedDirections,
    ai: hasAiLayout ? {
      model: String(aiAssembly?.model || ''),
      character: aiAssembly?.ai_character || null,
      notes: String(aiAssembly?.notes || ''),
      raw_output: String(aiAssembly?.raw_output || '')
    } : null,
    items
  };
}
function persistAgencyRoomAssemblySnapshot(snapshot) {
  const canvas = {
    stage: roomEditorStageSize,
    background: {
      type: 'room-backdrop',
      color: '#fbf0f7',
      image: roomEditorBackdrop
    },
    collision: {
      unit: 'ratio-of-item-box',
      mode: 'active',
      groundLayer: 'ignored'
    },
    assembledBy: {
      source: snapshot.source,
      home: snapshot.home,
      palette: snapshot.palette,
      budget: snapshot.budget,
      spent: snapshot.spent,
      purchases: snapshot.purchases,
      sizeProfile: snapshot.sizeProfile,
      directions: snapshot.directions,
      ai: snapshot.ai ? { model: snapshot.ai.model, character: snapshot.ai.character, notes: snapshot.ai.notes } : null,
      savedAt: snapshot.savedAt
    }
  };
  localStorage.setItem(roomEditorStorageKey, JSON.stringify(snapshot.items));
  localStorage.setItem(roomEditorCanvasStorageKey, JSON.stringify(canvas));
  localStorage.setItem(roomEditorSizeProfileStorageKey, JSON.stringify(snapshot.sizeProfile || buildRoomAssemblySizeProfile(snapshot.items)));
  localStorage.setItem(roomEditorAssemblyStorageKey, JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent(roomEditorLayoutUpdatedEvent, { detail: snapshot }));
  return snapshot;
}
function saveAgencyRoomAssembly(home = {}, aiAssembly = null, sizeProfile = getRoomAssemblyCurrentSizeProfile()) {
  return persistAgencyRoomAssemblySnapshot(buildAgencyRoomAssembly(home, aiAssembly, sizeProfile));
}

export default function HousingSocialPanel() {
  const [loading, setLoading] = useState(true);
  const [housingTiers, setHousingTiers] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [agencyModelOptions, setAgencyModelOptions] = useState([]);
  const [agencyAds, setAgencyAds] = useState([]);
  const [rentalChains, setRentalChains] = useState([]);
  const [rentalChainEvents, setRentalChainEvents] = useState({});
  const [, setPublicAgencyAnnouncements] = useState([]);
  const [agencyForm, setAgencyForm] = useState(emptyAgency);
  const [homeForm, setHomeForm] = useState(emptyHome);
  const [editingHomeId, setEditingHomeId] = useState('');
  const [savingBindingId, setSavingBindingId] = useState('');
  const [savingAgency, setSavingAgency] = useState(false);
  const [publishingAgency, setPublishingAgency] = useState(false);
  const [agencyError, setAgencyError] = useState('');
  const [agencyTemplateKey, setAgencyTemplateKey] = useState('street');
  const [showCustomHomeEditor, setShowCustomHomeEditor] = useState(false);
  const [showRoomAssemblyModal, setShowRoomAssemblyModal] = useState(false);
  const [roomAssemblyHomeId, setRoomAssemblyHomeId] = useState('');
  const [roomAssemblyNotice, setRoomAssemblyNotice] = useState('');
  const [roomAssemblySaving, setRoomAssemblySaving] = useState(false);
  const [roomAssemblySnapshot, setRoomAssemblySnapshot] = useState(null);
  const [homeNotice, setHomeNotice] = useState('');
  const [recommendCharacterId, setRecommendCharacterId] = useState('');
  const [recommendHousingId, setRecommendHousingId] = useState('');
  const [housingChainBusy, setHousingChainBusy] = useState(false);
  const [housingChainNotice, setHousingChainNotice] = useState('');

  const headers = useMemo(() => {
    const token = localStorage.getItem('cp_token') || '';
    return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' };
  }, []);

  const housingById = useMemo(() => new Map(housingTiers.map((item) => [String(item.id), item])), [housingTiers]);
  const savedHomeIds = useMemo(() => new Set(housingTiers.map((item) => String(item.id))), [housingTiers]);
  const resolvedDistrictOptions = useMemo(() => {
    if (Array.isArray(districts) && districts.length > 0) return districts;
    return defaultDistrictOptions;
  }, [districts]);
  const resolvedAgencyModelOptions = useMemo(() => {
    const normalized = Array.isArray(agencyModelOptions) ? agencyModelOptions.filter(Boolean) : [];
    if (normalized.length > 0) return normalized;
    return characters
      .filter((item) => item?.api_endpoint && item?.api_key && item?.model_name)
      .map((item) => ({
        id: String(item.id),
        name: String(item.name || item.id),
        model_name: String(item.model_name || ''),
        api_endpoint: String(item.api_endpoint || '')
      }));
  }, [agencyModelOptions, characters]);
  const roomAssemblyHomes = useMemo(() => {
    if (housingTiers.length > 0) return housingTiers;
    return homePresets.map((preset) => ({ ...emptyHome, ...preset.values }));
  }, [housingTiers]);
  const sortedHousingTiers = useMemo(() => (
    [...housingTiers].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.weekly_rent || 0) - Number(b.weekly_rent || 0))
  ), [housingTiers]);
  const availableHousingTiers = useMemo(() => (
    sortedHousingTiers.filter((item) => Number(item.is_enabled ?? 1) === 1)
  ), [sortedHousingTiers]);
  const housedCharacters = useMemo(() => (
    characters.filter((item) => item.binding?.housing_id)
  ), [characters]);
  const selectedRoomAssemblyHome = useMemo(() => {
    if (!roomAssemblyHomes.length) return null;
    return roomAssemblyHomes.find((item) => String(item.id) === String(roomAssemblyHomeId)) || roomAssemblyHomes[0];
  }, [roomAssemblyHomeId, roomAssemblyHomes]);
  const recommendableCharacters = useMemo(() => (
    characters.filter((item) => !item.binding?.housing_id)
  ), [characters]);
  const selectedRecommendationCharacter = useMemo(() => (
    recommendableCharacters.find((item) => String(item.id) === String(recommendCharacterId)) || recommendableCharacters[0] || null
  ), [recommendableCharacters, recommendCharacterId]);
  const selectedRecommendationHome = useMemo(() => (
    availableHousingTiers.find((item) => String(item.id) === String(recommendHousingId)) || availableHousingTiers[0] || null
  ), [availableHousingTiers, recommendHousingId]);
  const currentRoomAssemblySizeProfile = useMemo(() => (
    showRoomAssemblyModal ? getRoomAssemblyCurrentSizeProfile() : {}
  ), [showRoomAssemblyModal, roomAssemblySnapshot]);

  const requestJson = useCallback(async (url, options = {}) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || `${text.requestFailed}${response.status}`);
    return data;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson('/api/social-housing/bootstrap', { headers });
      setHousingTiers(data.housing_tiers || []);
      setCharacters(data.characters || []);
      setDistricts(data.districts || []);
      setAgencyModelOptions(data.agency_model_options || []);
      setAgencyAds(data.agency_ads || []);
      setRentalChains(data.rental_chains || []);
      setRentalChainEvents(data.rental_chain_events || {});
      setPublicAgencyAnnouncements(data.public_agency_announcements || []);
      setAgencyForm({ ...emptyAgency, ...(data.agency || {}) });
      setAgencyError(data.agency?.last_error || '');
    } finally {
      setLoading(false);
    }
  }, [headers, requestJson]);

  useEffect(() => { loadAll().catch((e) => { console.error(e); alert(e.message || text.loadFailed); }); }, [loadAll]);
  useEffect(() => {
    if (!roomAssemblyHomeId && roomAssemblyHomes[0]?.id) {
      setRoomAssemblyHomeId(String(roomAssemblyHomes[0].id));
    }
  }, [roomAssemblyHomeId, roomAssemblyHomes]);
  useEffect(() => {
    if (!recommendableCharacters.length) {
      if (recommendCharacterId) setRecommendCharacterId('');
      return;
    }
    const stillEligible = recommendableCharacters.some((item) => String(item.id) === String(recommendCharacterId));
    if (!recommendCharacterId || !stillEligible) {
      setRecommendCharacterId(String(recommendableCharacters[0].id));
    }
  }, [recommendableCharacters, recommendCharacterId]);
  useEffect(() => {
    if (!availableHousingTiers.length) {
      if (recommendHousingId) setRecommendHousingId('');
      return;
    }
    const stillAvailable = availableHousingTiers.some((item) => String(item.id) === String(recommendHousingId));
    if (!recommendHousingId || !stillAvailable) {
      setRecommendHousingId(String(availableHousingTiers[0].id));
    }
  }, [availableHousingTiers, recommendHousingId]);

  const saveHome = async (payload = homeForm) => {
    const data = await requestJson('/api/social-housing/housing', { method: 'POST', headers, body: JSON.stringify(payload) });
    setHousingTiers(data.housing_tiers || []);
    setHomeForm(emptyHome); setEditingHomeId(''); setShowCustomHomeEditor(false);
  };
  const deleteHome = async (id) => {
    const data = await requestJson(`/api/social-housing/housing/${id}`, { method: 'DELETE', headers });
    setHousingTiers(data.housing_tiers || []);
    setAgencyAds(data.agency_ads || []);
  };
  const deleteAgencyAd = async (id) => { await requestJson(`/api/social-housing/agency/ads/${id}`, { method: 'DELETE', headers }); await loadAll(); };
  const updateBinding = async (id, binding) => { setSavingBindingId(id); try { const data = await requestJson(`/api/social-housing/characters/${id}/binding`, { method: 'POST', headers, body: JSON.stringify(binding) }); setCharacters(data.characters || []); } finally { setSavingBindingId(''); } };
  const payRent = async (id) => { setSavingBindingId(id); try { const data = await requestJson(`/api/social-housing/characters/${id}/pay-rent`, { method: 'POST', headers }); setCharacters(data.characters || []); } finally { setSavingBindingId(''); } };
  const recommendHomeToCharacter = async () => {
    if (!selectedRecommendationCharacter || !selectedRecommendationHome) return;
    setHousingChainBusy(true);
    setHousingChainNotice(text.chainRunning);
    try {
      const data = await requestJson(`/api/social-housing/characters/${selectedRecommendationCharacter.id}/recommend-home`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ home_id: selectedRecommendationHome.id, run_full_chain: true })
      });
      setCharacters(data.characters || []);
      setRentalChains(data.rental_chains || []);
      setRentalChainEvents((prev) => ({
        ...prev,
        ...(data.rental_chain_events || {}),
        ...(data.chain?.id ? { [String(data.chain.id)]: data.chain_events || [] } : {})
      }));
      const label = data.outcome === 'signed'
        ? '已签约'
        : data.outcome === 'declined'
          ? '角色拒租'
          : data.outcome === 'rejected_insufficient_funds'
            ? '余额不足被拒'
            : data.outcome || '已完成';
      setHousingChainNotice(`${text.chainResult}: ${label}`);
    } catch (e) {
      await loadAll().catch(() => {});
      setHousingChainNotice(`${text.chainFailed}: ${e.message}`);
      throw e;
    } finally {
      setHousingChainBusy(false);
    }
  };
  const assignHomeToCharacter = async () => {
    if (!selectedRecommendationCharacter || !selectedRecommendationHome) return;
    setHousingChainBusy(true);
    setHousingChainNotice(text.chainRunning);
    try {
      const data = await requestJson(`/api/social-housing/characters/${selectedRecommendationCharacter.id}/assign-home`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ home_id: selectedRecommendationHome.id })
      });
      setCharacters(data.characters || []);
      setHousingChainNotice(`${text.chainResult}: 已指派住房`);
      await loadAll();
    } catch (e) {
      setHousingChainNotice(`${text.chainFailed}: ${e.message}`);
      throw e;
    } finally {
      setHousingChainBusy(false);
    }
  };
  const saveAgency = async (payload = agencyForm) => { setSavingAgency(true); setAgencyError(''); try { const data = await requestJson('/api/social-housing/agency', { method: 'POST', headers, body: JSON.stringify(payload) }); setAgencyForm({ ...emptyAgency, ...(data.agency || {}) }); } catch (e) { setAgencyError(e.message || 'agency failed'); throw e; } finally { setSavingAgency(false); } };
  const publishAgency = async () => { setPublishingAgency(true); setAgencyError(''); try { await requestJson('/api/social-housing/agency/publish-ad', { method: 'POST', headers }); await loadAll(); } catch (e) { setAgencyError(e.message || 'ad failed'); throw e; } finally { setPublishingAgency(false); } };
  const clearAgencyError = async () => {
    const payload = { ...agencyForm, last_error: '', last_error_at: 0 };
    const data = await requestJson('/api/social-housing/agency', { method: 'POST', headers, body: JSON.stringify(payload) });
    setAgencyForm({ ...emptyAgency, ...(data.agency || {}) });
    setAgencyError('');
  };
  const updateAgencyField = (key, value) => setAgencyForm((prev) => ({ ...prev, [key]: value }));
  const saveAgencyField = async (key, value) => {
    const next = { ...agencyForm, [key]: value };
    setAgencyForm(next);
    await saveAgency(next);
  };

  const applyHomePreset = async (preset) => {
    const existing = housingTiers.find((item) => String(item.id) === String(preset.values.id));
    if (existing) {
      beginEditHome(existing);
      setHomeNotice(text.homeOpened);
      return;
    }
    await saveHome({ ...emptyHome, ...preset.values });
    setHomeNotice(text.homeApplied);
  };
  const beginEditHome = (item) => { setEditingHomeId(String(item.id)); setHomeForm({ ...emptyHome, ...item }); setShowCustomHomeEditor(true); };
  const applyAgencyTemplate = (key) => { setAgencyTemplateKey(key); const preset = promptStyles.find((item) => item.key === key); if (preset) setAgencyForm((prev) => ({ ...prev, persona_prompt: preset.prompt })); };
  const runRoomAssembly = async () => {
    if (!selectedRoomAssemblyHome) {
      setRoomAssemblyNotice('没有可用房源，先新增或加入一套可推销房子。');
      return;
    }
    const palette = pickRoomAssemblyPalette(selectedRoomAssemblyHome);
    const budget = getRoomAssemblyBudget(selectedRoomAssemblyHome);
    const sizeProfile = getRoomAssemblyCurrentSizeProfile();
    const calibratedKinds = Object.keys(sizeProfile);
    setRoomAssemblySaving(true);
    setRoomAssemblyNotice(`中介 AI 正在根据房间网格、家具价格、房源预算和当前房间比例生成采购摆放...${calibratedKinds.length ? ` 已读取 ${calibratedKinds.length} 类比例标尺。` : ''}`);
    try {
      const data = await requestJson('/api/social-housing/agency/room-assembly', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          home: selectedRoomAssemblyHome,
          palette,
          budget,
          room: { size: roomAssemblyGridSize },
          furniture: getRoomAssemblyFurnitureContext(sizeProfile)
        })
      });
      const snapshot = saveAgencyRoomAssembly(selectedRoomAssemblyHome, data.assembly || null, sizeProfile);
      setRoomAssemblySnapshot(snapshot);
      setRoomAssemblyNotice(`AI 已生成并保存到实际房间。${snapshot.home.emoji || ''}${snapshot.home.name || snapshot.home.id || '样板间'} / 预算 ${formatMoney(snapshot.budget)} / 花费 ${formatMoney(snapshot.spent)} / ${snapshot.items.length} 个素材 / ${Object.keys(snapshot.sizeProfile || {}).length} 类比例标尺。${snapshot.ai?.notes ? ` 备注：${snapshot.ai.notes}` : ''}`);
    } catch (e) {
      const snapshot = saveAgencyRoomAssembly(selectedRoomAssemblyHome, null, sizeProfile);
      setRoomAssemblySnapshot(snapshot);
      setRoomAssemblyNotice(`AI 生成失败，已先用规则模板保存：${e.message || '未知错误'}。${snapshot.home.emoji || ''}${snapshot.home.name || snapshot.home.id || '样板间'} / 预算 ${formatMoney(snapshot.budget)} / 花费 ${formatMoney(snapshot.spent)} / ${snapshot.items.length} 个素材 / ${Object.keys(snapshot.sizeProfile || {}).length} 类比例标尺。`);
    } finally {
      setRoomAssemblySaving(false);
    }
  };

  const visibleAgencyAds = useMemo(() => agencyAds || [], [agencyAds]);
  const housedCount = characters.filter((c) => c.binding?.housing_id).length;
  const homelessCount = characters.length - housedCount;
  const overdueCount = characters.filter((c) => String(c.binding?.housing_status || '') === 'overdue').length;
  const stableCount = characters.filter((c) => c.binding?.housing_id && String(c.binding?.housing_status || 'stable') === 'stable').length;

  if (loading) return <div style={{ padding: 24, color: '#64748b' }}>{text.loading}</div>;

  return (
    <div style={shell.page} className="housing-panel">
      <Section title={text.title} icon={Building2} extra={`${text.sellableHomes} ${housingTiers.length} | ${text.roleBinding} ${characters.length}`}>
        <div className="housing-stat-grid">
          <StatCard label={text.sellableHomes} value={housingTiers.length} tone="info" icon={Building2} />
          <StatCard label={text.stable} value={stableCount} tone="good" icon={CheckCircle2} />
          <StatCard label={text.homeless} value={homelessCount} />
          <StatCard label={text.overdue} value={overdueCount} tone="warn" icon={AlertTriangle} />
          <StatCard label={text.recentChains} value={rentalChains.length} icon={MessageSquareText} />
        </div>
      </Section>

      <Section title={text.recommendHousing} icon={Send} extra={`${text.recentChains} ${rentalChains.length}`}>
        <div className="housing-workbench">
          <div className="housing-command-card">
            <div className="housing-command-grid">
              <Field label={text.eligibleRole}>
                <select style={shell.input} value={recommendCharacterId} onChange={(e) => setRecommendCharacterId(e.target.value)} disabled={housingChainBusy || recommendableCharacters.length === 0}>
                  {recommendableCharacters.length
                    ? recommendableCharacters.map((item) => <option key={item.id} value={item.id}>{item.name} / {text.wallet} {formatMoney(item.wallet)}</option>)
                    : <option value="">{text.noHomelessCharacters}</option>}
                </select>
              </Field>
              <Field label={text.homeName}>
                <select style={shell.input} value={recommendHousingId} onChange={(e) => setRecommendHousingId(e.target.value)} disabled={housingChainBusy || !selectedRecommendationCharacter || availableHousingTiers.length === 0}>
                  {availableHousingTiers.length
                    ? availableHousingTiers.map((item) => <option key={item.id} value={item.id}>{item.emoji || ''} {item.name} / {formatMoney(item.weekly_rent)}/周 / {text.deposit} {formatMoney(item.deposit)}</option>)
                    : <option value="">{text.noAvailableHomes}</option>}
                </select>
              </Field>
            </div>
            <div className="housing-selected-grid">
              <div className="housing-selected-person">
                <div className="housing-card-kicker">{text.character}</div>
                <div className="housing-selected-name"><UserRound size={17} />{selectedRecommendationCharacter?.name || text.noHomelessCharacters}</div>
                {selectedRecommendationCharacter ? (
                  <div className="housing-selected-meta">
                    <Pill icon={WalletCards}>{text.wallet} {formatMoney(selectedRecommendationCharacter.wallet)}</Pill>
                    <Pill icon={CircleDashed}>{text.homeless}</Pill>
                  </div>
                ) : <div className="housing-selected-note">{text.noHousingActionTarget}</div>}
              </div>
              <HomeSummaryCard home={selectedRecommendationHome} compact />
            </div>
            <div className="housing-command-actions">
              {selectedRecommendationCharacter ? (
                <>
                  <ActionButton
                    icon={Send}
                    tone="warning"
                    disabled={housingChainBusy || !selectedRecommendationCharacter || !selectedRecommendationHome}
                    title={text.recommendHome}
                    onClick={() => recommendHomeToCharacter().catch((e) => alert(e.message))}
                  >
                    {housingChainBusy ? text.chainRunning : text.recommendHome}
                  </ActionButton>
                  <ActionButton
                    icon={KeyRound}
                    tone="primary"
                    disabled={housingChainBusy || !selectedRecommendationCharacter || !selectedRecommendationHome}
                    title={text.assignHome}
                    onClick={() => assignHomeToCharacter().catch((e) => alert(e.message))}
                  >
                    {text.assignHome}
                  </ActionButton>
                </>
              ) : <div className="housing-command-empty">{text.noHousingActionTarget}</div>}
            </div>
            {selectedRecommendationCharacter ? <div className="housing-command-hint">{text.housedActionHint}</div> : null}
            {housingChainNotice ? <div className={`housing-chain-notice ${housingChainNotice.startsWith(text.chainFailed) ? 'is-error' : ''}`}>{housingChainNotice}</div> : null}
          </div>
          <div className="housing-chain-list">
            {rentalChains.slice(0, 5).map((chain) => (
              <RentalChainCard key={chain.id} chain={chain} events={getChainEventsForDisplay(rentalChainEvents, chain.id)} />
            ))}
            {rentalChains.length === 0 ? <div className="housing-empty-card">{text.untriggered}</div> : null}
          </div>
        </div>
      </Section>

      <Section title={text.roleBinding} icon={BedDouble} extra={`${housedCount}/${characters.length} 已有住房`}>
        <div className="housing-character-list">
          {housedCharacters.map((character) => {
            const binding = character.binding || {};
            const selectedHousing = housingById.get(String(binding.housing_id || '')) || binding.housing;
            const status = String(binding.housing_status || (selectedHousing ? 'stable' : 'homeless'));
            return (
              <CharacterHousingCard
                key={character.id}
                character={character}
                binding={binding}
                selectedHousing={selectedHousing}
                status={status}
                sortedHousingTiers={sortedHousingTiers}
                savingBindingId={savingBindingId}
                updateBinding={updateBinding}
                payRent={payRent}
              />
            );
          })}
          {housedCharacters.length === 0 ? <div className="housing-empty-card">{text.noHousedCharacters}</div> : null}
        </div>
      </Section>

      <Section title={text.catalog} icon={Home} extra={`${sortedHousingTiers.length} 套`}>
        <div className="housing-card-actions">
          <ActionButton icon={Plus} tone="primary" onClick={() => { setEditingHomeId(''); setHomeForm(emptyHome); setShowCustomHomeEditor(true); }}>{text.custom}</ActionButton>
          <ActionButton icon={WandSparkles} tone="neutral" onClick={() => setShowRoomAssemblyModal(true)}>{text.openRoomAssembly}</ActionButton>
        </div>
        {homeNotice ? <div style={{ ...shell.card, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontSize: 14 }}>{homeNotice}</div> : null}
        <div className="housing-home-grid">
          {sortedHousingTiers.map((home) => (
            <HomeSummaryCard
              key={home.id}
              home={home}
              title={Number(home.is_enabled ?? 1) === 1 ? text.enabledState : text.disabledState}
              actions={(
                <>
                  <ActionButton icon={Edit3} tone="neutral" onClick={() => beginEditHome(home)}>{text.edit}</ActionButton>
                  <ActionButton icon={Trash2} tone="danger" onClick={() => deleteHome(home.id).catch((e) => alert(e.message))}>{text.remove}</ActionButton>
                </>
              )}
            />
          ))}
          {sortedHousingTiers.length === 0 ? <div className="housing-empty-card">{text.emptyHomes}</div> : null}
        </div>
      </Section>

      <Section title="房源模板" icon={Sparkles} extra={`${homePresets.length} 套`}>
        <div className="housing-home-grid">
          {homePresets.map((preset) => (
            <HomeSummaryCard
              key={preset.key}
              home={preset.values}
              title={preset.subtitle}
              actions={(
                <ActionButton icon={Plus} tone="primary" onClick={() => applyHomePreset(preset).catch((e) => alert(e.message))}>
                  {savedHomeIds.has(String(preset.values.id)) ? text.applyExistingHome : text.applyHome}
                </ActionButton>
              )}
            />
          ))}
        </div>
      </Section>

      <Section title={text.agencyAi} icon={Building2} extra={`${text.lastAd} ${formatTime(agencyForm.last_ad_at)}`}>
        <div className="housing-agency-grid">
          <div style={shell.card}>
            <div className="housing-agency-form-grid">
              <Field label={text.officeName}><input style={shell.input} value={agencyForm.agency_name || ''} onChange={(e) => setAgencyForm((p) => ({ ...p, agency_name: e.target.value }))} /></Field>
              <Field label={text.agentName}><input style={shell.input} value={agencyForm.agent_name || ''} onChange={(e) => setAgencyForm((p) => ({ ...p, agent_name: e.target.value }))} /></Field>
              <Field label={text.officeDistrict}><select style={shell.input} value={agencyForm.office_district || 'street'} onChange={(e) => saveAgencyField('office_district', e.target.value).catch((err) => alert(err.message))}>{resolvedDistrictOptions.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></Field>
              <Field label={`${text.autoModel}（${resolvedAgencyModelOptions.length} 个）`}><select style={shell.input} value={agencyForm.model_char_id || 'auto'} onChange={(e) => saveAgencyField('model_char_id', e.target.value).catch((err) => alert(err.message))}>{[{ id: 'auto', name: text.autoModel, model_name: '' }, ...resolvedAgencyModelOptions].map((item) => <option key={item.id} value={item.id}>{item.name}{item.model_name ? ` - ${item.model_name}` : ''}</option>)}</select></Field>
              <Field label={text.businessScope}><input style={shell.input} value={agencyForm.business_scope || ''} onChange={(e) => updateAgencyField('business_scope', e.target.value)} /></Field>
              <Field label={text.intervalHours}><input style={shell.input} type="number" min="1" value={agencyForm.decision_interval_hours || 6} onChange={(e) => setAgencyForm((p) => ({ ...p, decision_interval_hours: toNum(e.target.value, 6) }))} /></Field>
              <Field label={text.adStyle}><div className="housing-ad-style-row"><select style={shell.input} value={agencyTemplateKey} onChange={(e) => setAgencyTemplateKey(e.target.value)}>{promptStyles.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><ActionButton icon={Sparkles} tone="info" style={{ whiteSpace: 'nowrap' }} onClick={() => applyAgencyTemplate(agencyTemplateKey)}>{text.applyStyle}</ActionButton></div></Field>
              <Field label={text.prompt} span><textarea style={{ ...shell.input, minHeight: 96, resize: 'vertical' }} value={agencyForm.persona_prompt || ''} onChange={(e) => updateAgencyField('persona_prompt', e.target.value)} /></Field>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <ActionButton icon={Number(agencyForm.enabled || 0) === 1 ? X : CheckCircle2} tone={Number(agencyForm.enabled || 0) === 1 ? 'danger' : 'success'} onClick={() => saveAgency({ ...agencyForm, enabled: Number(agencyForm.enabled || 0) === 1 ? 0 : 1 }).catch((e) => alert(e.message))}>{Number(agencyForm.enabled || 0) === 1 ? text.disable : text.enable}</ActionButton>
              <ActionButton icon={Save} tone="success" onClick={() => saveAgency().catch((e) => alert(e.message))}>{savingAgency ? text.saving : text.save}</ActionButton>
              <ActionButton icon={Play} tone="warning" onClick={() => publishAgency().catch((e) => alert(e.message))}>{publishingAgency ? text.saving : text.run}</ActionButton>
              {agencyError ? <ActionButton icon={Play} tone="violet" onClick={() => publishAgency().catch((e) => alert(e.message))}>{text.retry}</ActionButton> : null}
              <ActionButton icon={WandSparkles} tone="primary" onClick={() => setShowRoomAssemblyModal(true)}>{text.openRoomAssembly}</ActionButton>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Pill>{text.nextAd} {formatTime(agencyForm.next_ad_at)}</Pill>
              {agencyForm.last_error_at ? <Pill bg="#fff1f2" color="#be123c">{text.lastFailure} {formatTime(agencyForm.last_error_at)}</Pill> : null}
            </div>
            {agencyError ? (
              <div style={{ marginTop: 12, background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{text.agencyFailed}</div>
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>{summarizeAgencyError(agencyError)}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <ActionButton icon={Play} tone="violet" onClick={() => publishAgency().catch((e) => alert(e.message))}>{text.retry}</ActionButton>
                  <ActionButton icon={X} tone="danger" onClick={() => clearAgencyError().catch((e) => alert(e.message))}>{text.clearError}</ActionButton>
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {visibleAgencyAds.length ? visibleAgencyAds.map((ad) => (
              <div key={ad.id} style={shell.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{ad.title || text.noAds}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Pill bg={ad.trigger_type === 'auto' ? '#eff6ff' : '#f8fafc'} color={ad.trigger_type === 'auto' ? '#1d4ed8' : '#475569'}>{ad.trigger_type === 'auto' ? text.auto : text.manual}</Pill>
                    {Number(ad.is_published ? 1 : 0) === 1 ? <Pill bg="#dcfce7" color="#166534">{text.published}</Pill> : null}
                    <ActionButton icon={Trash2} tone="danger" onClick={() => deleteAgencyAd(ad.id).catch((e) => alert(e.message))}>{text.removeAd}</ActionButton>
                  </div>
                </div>
                <div style={{ marginTop: 8, color: '#475569', fontSize: 13, lineHeight: 1.65 }}>{ad.content}</div>
              </div>
            )) : <div style={{ ...shell.card, color: '#94a3b8', fontSize: 13 }}>{text.noAds}</div>}
          </div>
        </div>
      </Section>
      {showRoomAssemblyModal ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', zIndex: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowRoomAssemblyModal(false)}>
          <div style={{ width: 'min(760px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: 20, border: '1px solid #bfdbfe', boxShadow: '0 20px 80px rgba(15,23,42,0.18)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{text.roomAssembly}</div>
                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>实验版会直接覆盖当前像素小屋布局，并保存到浏览器本地房间存储。</div>
              </div>
              <ActionButton icon={X} tone="neutral" onClick={() => setShowRoomAssemblyModal(false)}>{text.cancel}</ActionButton>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label={text.homeName}>
                <select style={shell.input} value={selectedRoomAssemblyHome?.id || ''} onChange={(e) => setRoomAssemblyHomeId(e.target.value)}>
                  {roomAssemblyHomes.map((item) => (
                    <option key={item.id} value={item.id}>{item.emoji || ''} {item.name || item.id} / {formatMoney(item.weekly_rent)}/周</option>
                  ))}
                </select>
              </Field>
              {selectedRoomAssemblyHome ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Pill>{text.comfort} {selectedRoomAssemblyHome.comfort || 0}</Pill>
                  <Pill>{text.prestige} {selectedRoomAssemblyHome.prestige || 0}</Pill>
                  <Pill>{text.privacy} {selectedRoomAssemblyHome.privacy || 0}</Pill>
                  <Pill bg="#eff6ff" color="#1d4ed8">预算 {formatMoney(getRoomAssemblyBudget(selectedRoomAssemblyHome))}</Pill>
                  <Pill bg="#f5f3ff" color="#6d28d9">家具商店 {roomAssemblyShopItems.length} 件</Pill>
                  <Pill bg="#ecfdf5" color="#047857">比例标尺 {Object.keys(currentRoomAssemblySizeProfile).length} 类</Pill>
                </div>
              ) : null}
              <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.65 }}>
                点生成后，中介 AI 会读取房间网格、完整家具商店、每件家具价格和当前房源预算，自行采购并摆放；保存完成后去“像素实装模块 / 居住房间”即可看到实际房间已经变成这套布局。
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <ActionButton icon={WandSparkles} tone="primary" disabled={roomAssemblySaving} onClick={runRoomAssembly}>{roomAssemblySaving ? 'AI生成中...' : text.generateRoomAssembly}</ActionButton>
                <ActionButton icon={X} tone="neutral" onClick={() => setShowRoomAssemblyModal(false)}>{text.cancel}</ActionButton>
              </div>
              {roomAssemblyNotice ? <div style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 14, padding: 12, fontSize: 14, lineHeight: 1.55 }}>{roomAssemblyNotice}</div> : null}
              {roomAssemblySnapshot ? (
                <div style={{ border: '1px solid #e7edf5', borderRadius: 16, padding: 14, background: '#f8fafc' }}>
                  <div style={{ fontWeight: 800, color: '#334155', marginBottom: 8 }}>已保存素材</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <Pill bg="#eff6ff" color="#1d4ed8">预算 {formatMoney(roomAssemblySnapshot.budget)}</Pill>
                    <Pill bg="#ecfdf5" color="#047857">花费 {formatMoney(roomAssemblySnapshot.spent)}</Pill>
                    <Pill>购买 {roomAssemblySnapshot.purchases?.length || 0} 件</Pill>
                    <Pill>比例标尺 {Object.keys(roomAssemblySnapshot.sizeProfile || {}).length} 类</Pill>
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {roomAssemblySnapshot.items.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#64748b', fontSize: 12 }}>
                        <span>{item.assetId}</span>
                        <span>{Math.round(item.x)},{Math.round(item.y)} / {Math.round(item.w)}x{Math.round(item.h)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {(showCustomHomeEditor || editingHomeId) ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => { setShowCustomHomeEditor(false); setEditingHomeId(''); setHomeForm(emptyHome); }}>
          <div style={{ width: 'min(860px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: '#fff', borderRadius: 20, border: '1px solid #e7edf5', boxShadow: '0 20px 80px rgba(15,23,42,0.18)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#334155' }}>{editingHomeId ? text.modalEditHome : text.modalCustomHome}</div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>这里是少数情况才需要手动改的详细资料。</div>
              </div>
              <ActionButton icon={X} tone="neutral" onClick={() => { setShowCustomHomeEditor(false); setEditingHomeId(''); setHomeForm(emptyHome); }}>{text.cancel}</ActionButton>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <Field label={text.id}><input style={shell.input} value={homeForm.id} onChange={(e) => setHomeForm((p) => ({ ...p, id: e.target.value }))} /></Field>
              <Field label={text.homeName}><input style={shell.input} value={homeForm.name} onChange={(e) => setHomeForm((p) => ({ ...p, name: e.target.value }))} /></Field>
              <Field label={text.emoji}><input style={shell.input} value={homeForm.emoji} onChange={(e) => setHomeForm((p) => ({ ...p, emoji: e.target.value }))} /></Field>
              <Field label={text.weeklyRent}><input style={shell.input} type="number" value={homeForm.weekly_rent} onChange={(e) => setHomeForm((p) => ({ ...p, weekly_rent: toNum(e.target.value) }))} /></Field>
              <Field label={text.deposit}><input style={shell.input} type="number" value={homeForm.deposit} onChange={(e) => setHomeForm((p) => ({ ...p, deposit: toNum(e.target.value) }))} /></Field>
              <Field label={text.buyout}><input style={shell.input} type="number" value={homeForm.sale_price} onChange={(e) => setHomeForm((p) => ({ ...p, sale_price: toNum(e.target.value) }))} /></Field>
              <Field label={text.comfort}><input style={shell.input} type="number" value={homeForm.comfort} onChange={(e) => setHomeForm((p) => ({ ...p, comfort: toNum(e.target.value) }))} /></Field>
              <Field label={text.prestige}><input style={shell.input} type="number" value={homeForm.prestige} onChange={(e) => setHomeForm((p) => ({ ...p, prestige: toNum(e.target.value) }))} /></Field>
              <Field label={text.privacy}><input style={shell.input} type="number" value={homeForm.privacy} onChange={(e) => setHomeForm((p) => ({ ...p, privacy: toNum(e.target.value) }))} /></Field>
              <Field label={text.sortOrder}><input style={shell.input} type="number" value={homeForm.sort_order} onChange={(e) => setHomeForm((p) => ({ ...p, sort_order: toNum(e.target.value) }))} /></Field>
              <Field label={text.desc} span><textarea style={{ ...shell.input, minHeight: 110, resize: 'vertical' }} value={homeForm.description} onChange={(e) => setHomeForm((p) => ({ ...p, description: e.target.value }))} /></Field>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <ActionButton icon={Save} tone="primary" onClick={() => saveHome().catch((e) => alert(e.message))}>{editingHomeId ? text.saveEdit : text.addHome}</ActionButton>
              <ActionButton icon={X} tone="neutral" onClick={() => { setShowCustomHomeEditor(false); setEditingHomeId(''); setHomeForm(emptyHome); }}>{text.cancel}</ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}



