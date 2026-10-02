import { toNum } from '../housingFormatting.js';
import { roomEditorAssetCatalog } from '../../city/scene/roomEditorCore.js';

export const roomEditorStorageKey = 'pixelWorld.room.layout';

export const roomEditorCanvasStorageKey = 'pixelWorld.room.canvas';

export const roomEditorSizeProfileStorageKey = 'pixelWorld.room.sizeProfile';

export const roomEditorAssemblyStorageKey = 'pixelWorld.room.assemblyExperiment';

export const roomEditorAssemblyPreviewStorageKey = 'pixelWorld.room.assemblyPreview';

export const roomEditorLayoutUpdatedEvent = 'pixel-world-room-layout-updated';

export const roomEditorFurnitureScaleVersion = 'large-furniture-no-desk-v1';

export const roomEditorSizeProfileVersion = `${roomEditorFurnitureScaleVersion}:kind-size-v1`;

export const roomEditorMaxStorageBytes = 200000;

export const roomEditorStageSize = { width: 1254, height: 1254 };

export const roomEditorBackdrop = '/assets/pixel-world/generated-rooms/backgrounds/empty-square-room-v1.png';

export const roomAssemblyPreviewVersion = 'social-housing-room-assembly-preview-v3-upper-room';

export const roomAssemblyPreviewImageSize = roomEditorStageSize.width;

export const roomAssemblyPreviewSourceCrop = {
    x: 0,
    y: Math.round(roomEditorStageSize.height * 0.06),
    w: roomEditorStageSize.width,
    h: Math.round(roomEditorStageSize.height * 0.5),
};

export const roomAssemblyPreviewMaxStorageBytes = 4000000;

export const roomAssemblyWallArtVisualBounds = { minY: -48, maxBottomY: 273 };

export const roomAssemblyBedTopBaselineY = 79;

export const roomAssemblyCalibratedSizeProfile = {
    bed: { w: 343, h: 370, sourceAssetId: 'room_front_bed_scandinavian_blue_v1' },
    nightstand: { w: 185, h: 220, sourceAssetId: 'room_front_ocean_nightstand_v1' },
    wardrobe: { w: 235, h: 330, sourceAssetId: 'room_front_ocean_wardrobe_v1' },
    vanity: { w: 271, h: 340, sourceAssetId: 'room_front_ocean_vanity_v1' },
    bookshelf: { w: 291, h: 444, sourceAssetId: 'room_front_mint_bookshelf_v1' },
    sofa: { w: 526, h: 362, sourceAssetId: 'room_front_mint_sofa_v1' },
    rug: { w: 430, h: 260, sourceAssetId: 'room_decor_mint_rug_v1' },
    floorLamp: { w: 230, h: 410, sourceAssetId: 'room_decor_mint_table_lamp_v1' },
    wallArt: { w: 390, h: 235, sourceAssetId: 'room_decor_mint_wall_art_v1' },
};

export const roomAssemblyPalettes = {
    budget: {
        label: '蜜桃基础套装',
        style: '蜜桃柠檬',
        bedGroup: 'bed_peach_lemon',
        nightstandGroup: 'ocean_nightstand',
        wardrobeGroup: 'ocean_wardrobe',
        vanityGroup: 'ocean_vanity',
        vanityW: 271,
    },
    standard: {
        label: '薄荷日常套装',
        style: '薄荷花园',
        bedGroup: 'bed_mint_garden',
        nightstandGroup: 'ocean_nightstand',
        wardrobeGroup: 'ocean_wardrobe',
        vanityGroup: 'ocean_vanity',
        vanityW: 271,
    },
    ocean: {
        label: '海洋舒适套装',
        bedGroup: 'bed_ocean_shell',
        nightstandGroup: 'ocean_nightstand',
        wardrobeGroup: 'ocean_wardrobe',
        vanityGroup: 'ocean_vanity',
        vanityW: 271,
    },
    cloud: {
        label: '云朵体面套装',
        bedGroup: 'bed_cloud_dream',
        nightstandGroup: 'cloud_nightstand',
        wardrobeGroup: 'cloud_wardrobe',
        vanityGroup: 'cloud_vanity',
        vanityW: 260,
    },
    candy: {
        label: '糖果高档套装',
        bedGroup: 'bed_pastel_candy',
        nightstandGroup: 'candy_nightstand',
        wardrobeGroup: 'candy_wardrobe',
        vanityGroup: 'candy_vanity',
        vanityW: 273,
    },
};

export const roomAssemblyGridSize = { cols: 16, rows: 16 };

export const roomAssemblyCoreKinds = ['wardrobe', 'vanity', 'bed', 'nightstand'];

export const roomAssemblyKinds = [
    'wardrobe',
    'vanity',
    'bed',
    'nightstand',
    'bookshelf',
    'sofa',
    'rug',
    'floorLamp',
    'wallArt',
];

export const roomAssemblyAllowedDirections = new Set(['front', 'back', 'left', 'right']);

export const roomAssemblyDirectionalKinds = new Set(['bed', 'nightstand', 'wardrobe', 'vanity', 'bookshelf', 'sofa']);

export const roomAssemblyWallBufferCells = 2;

export const roomAssemblyVisualFloorLineOffsetCells = 0.5;

export const roomAssemblyBedTopBaselineMinGridY = Math.max(
    0,
    Math.ceil(
        roomAssemblyBedTopBaselineY / (roomEditorStageSize.height / roomAssemblyGridSize.rows) +
            roomAssemblyVisualFloorLineOffsetCells +
            1,
    ),
);

export const roomAssemblyDefaultScaleByKind = {
    bed: 0.78,
    nightstand: 0.52,
    wardrobe: 0.82,
    vanity: 0.78,
    bookshelf: 0.78,
    sofa: 0.68,
    rug: 0.72,
    floorLamp: 0.63,
    wallArt: 0.66,
};

export function scaleRoomAssemblyBoxByKind(box = {}, kind = '') {
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
        h: nextH,
    };
}

export function makeRoomAssemblyShopItem(assetId, name, kind, style, price, box, options = {}) {
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
        preferred_dir: options.preferred_dir || 'front',
    };
}

export const roomAssemblyShopItems = [
    makeRoomAssemblyShopItem('room_front_bed_scandinavian_blue_v1', '北欧蓝白床', 'bed', '北欧蓝白', 115, {
        x: 82,
        y: 754,
        w: 343,
        h: 370,
    }),
    makeRoomAssemblyShopItem('room_front_scandinavian_wardrobe_v1', '北欧衣柜', 'wardrobe', '北欧蓝白', 85, {
        x: 88,
        y: 412,
        w: 235,
        h: 330,
    }),
    makeRoomAssemblyShopItem('room_front_scandinavian_bookshelf_v1', '北欧书柜', 'bookshelf', '北欧蓝白', 75, {
        x: 840,
        y: 352,
        w: 300,
        h: 390,
    }),
    makeRoomAssemblyShopItem('room_front_scandinavian_sofa_v1', '北欧沙发', 'sofa', '北欧蓝白', 110, {
        x: 660,
        y: 750,
        w: 420,
        h: 290,
    }),
    makeRoomAssemblyShopItem(
        'room_decor_scandinavian_rug_v1',
        '北欧雪纹地毯',
        'rug',
        '北欧蓝白',
        38,
        { x: 420, y: 882, w: 430, h: 260 },
        { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_scandinavian_floor_lamp_v1',
        '北欧落地灯',
        'floorLamp',
        '北欧蓝白',
        38,
        { x: 900, y: 526, w: 230, h: 410 },
        { directional: false, collision: { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_scandinavian_wall_art_v1',
        '北欧雪山挂画',
        'wallArt',
        '北欧蓝白',
        30,
        { x: 500, y: 302, w: 390, h: 235 },
        { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),

    makeRoomAssemblyShopItem('room_front_bed_peach_lemon_v1', '蜜桃柠檬床', 'bed', '蜜桃柠檬', 70, {
        x: 82,
        y: 754,
        w: 343,
        h: 370,
    }),
    makeRoomAssemblyShopItem('room_front_peach_bookshelf_v1', '蜜桃书柜', 'bookshelf', '蜜桃柠檬', 45, {
        x: 840,
        y: 352,
        w: 300,
        h: 390,
    }),
    makeRoomAssemblyShopItem('room_front_peach_sofa_v1', '蜜桃沙发', 'sofa', '蜜桃柠檬', 65, {
        x: 660,
        y: 750,
        w: 420,
        h: 290,
    }),
    makeRoomAssemblyShopItem(
        'room_decor_peach_rug_v1',
        '蜜桃柠檬地毯',
        'rug',
        '蜜桃柠檬',
        20,
        { x: 420, y: 882, w: 430, h: 260 },
        { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_peach_floor_lamp_v1',
        '蜜桃落地灯',
        'floorLamp',
        '蜜桃柠檬',
        22,
        { x: 900, y: 526, w: 230, h: 410 },
        { directional: false, collision: { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_peach_wall_art_v1',
        '蜜桃柠檬挂画',
        'wallArt',
        '蜜桃柠檬',
        18,
        { x: 500, y: 302, w: 390, h: 235 },
        { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),

    makeRoomAssemblyShopItem('room_front_bed_mint_garden_v1', '薄荷花园床', 'bed', '薄荷花园', 95, {
        x: 82,
        y: 754,
        w: 343,
        h: 370,
    }),
    makeRoomAssemblyShopItem('room_front_mint_bookshelf_v1', '薄荷书架', 'bookshelf', '薄荷花园', 65, {
        x: 840,
        y: 352,
        w: 300,
        h: 390,
    }),
    makeRoomAssemblyShopItem('room_front_mint_sofa_v1', '薄荷沙发', 'sofa', '薄荷花园', 95, {
        x: 660,
        y: 750,
        w: 420,
        h: 290,
    }),
    makeRoomAssemblyShopItem(
        'room_decor_mint_rug_v1',
        '薄荷绗缝地毯',
        'rug',
        '薄荷花园',
        32,
        { x: 420, y: 882, w: 430, h: 260 },
        { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_mint_table_lamp_v1',
        '薄荷花园灯',
        'floorLamp',
        '薄荷花园',
        32,
        { x: 900, y: 526, w: 230, h: 410 },
        { directional: false, collision: { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_mint_wall_art_v1',
        '薄荷花园挂画',
        'wallArt',
        '薄荷花园',
        26,
        { x: 500, y: 302, w: 390, h: 235 },
        { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),

    makeRoomAssemblyShopItem('room_front_bed_ocean_shell_v1', '海洋贝壳床', 'bed', '海洋贝壳', 125, {
        x: 84,
        y: 754,
        w: 333,
        h: 370,
    }),
    makeRoomAssemblyShopItem('room_front_ocean_nightstand_v1', '贝壳床头柜', 'nightstand', '海洋贝壳', 40, {
        x: 414,
        y: 887,
        w: 185,
        h: 220,
    }),
    makeRoomAssemblyShopItem('room_front_ocean_wardrobe_v1', '贝壳衣柜', 'wardrobe', '海洋贝壳', 100, {
        x: 88,
        y: 412,
        w: 235,
        h: 330,
    }),
    makeRoomAssemblyShopItem('room_front_ocean_vanity_v1', '贝壳梳妆台', 'vanity', '海洋贝壳', 95, {
        x: 476,
        y: 506,
        w: 271,
        h: 340,
    }),
    makeRoomAssemblyShopItem('room_front_ocean_sofa_v1', '贝壳沙发', 'sofa', '海洋贝壳', 130, {
        x: 660,
        y: 750,
        w: 420,
        h: 290,
    }),
    makeRoomAssemblyShopItem(
        'room_decor_ocean_rug_v1',
        '贝壳华毯',
        'rug',
        '海洋贝壳',
        45,
        { x: 420, y: 882, w: 430, h: 260 },
        { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_ocean_floor_lamp_v1',
        '贝壳落地灯',
        'floorLamp',
        '海洋贝壳',
        45,
        { x: 906, y: 526, w: 230, h: 410 },
        { directional: false, collision: { enabled: true, x: 0.34, y: 0.78, w: 0.32, h: 0.18 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_ocean_wall_art_v1',
        '贝壳海景画',
        'wallArt',
        '海洋贝壳',
        36,
        { x: 520, y: 320, w: 360, h: 205 },
        { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),

    makeRoomAssemblyShopItem('room_front_bed_cloud_dream_v1', '云朵梦幻床', 'bed', '云朵梦幻', 165, {
        x: 82,
        y: 754,
        w: 339,
        h: 370,
    }),
    makeRoomAssemblyShopItem('room_front_cloud_nightstand_v1', '云朵床头柜', 'nightstand', '云朵梦幻', 55, {
        x: 414,
        y: 887,
        w: 185,
        h: 220,
    }),
    makeRoomAssemblyShopItem('room_front_cloud_wardrobe_v1', '云朵衣柜', 'wardrobe', '云朵梦幻', 135, {
        x: 88,
        y: 412,
        w: 235,
        h: 330,
    }),
    makeRoomAssemblyShopItem('room_front_cloud_vanity_v1', '云朵梳妆台', 'vanity', '云朵梦幻', 130, {
        x: 476,
        y: 506,
        w: 260,
        h: 340,
    }),
    makeRoomAssemblyShopItem('room_front_cloud_bookshelf_v1', '云朵书架', 'bookshelf', '云朵梦幻', 120, {
        x: 840,
        y: 352,
        w: 300,
        h: 390,
    }),
    makeRoomAssemblyShopItem('room_front_cloud_sofa_v1', '云朵沙发', 'sofa', '云朵梦幻', 170, {
        x: 660,
        y: 750,
        w: 420,
        h: 290,
    }),
    makeRoomAssemblyShopItem(
        'room_decor_cloud_rug_v1',
        '云月华毯',
        'rug',
        '云朵梦幻',
        60,
        { x: 420, y: 882, w: 430, h: 260 },
        { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_cloud_floor_lamp_v1',
        '云朵落地灯',
        'floorLamp',
        '云朵梦幻',
        58,
        { x: 894, y: 506, w: 250, h: 430 },
        { directional: false, collision: { enabled: true, x: 0.34, y: 0.8, w: 0.32, h: 0.16 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_cloud_wall_art_v1',
        '云月星空画',
        'wallArt',
        '云朵梦幻',
        48,
        { x: 500, y: 302, w: 390, h: 235 },
        { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),

    makeRoomAssemblyShopItem('room_front_bed_pastel_candy_v1', '糖果粉彩床', 'bed', '糖果粉彩', 210, {
        x: 84,
        y: 754,
        w: 333,
        h: 370,
    }),
    makeRoomAssemblyShopItem('room_front_candy_nightstand_v1', '糖果床头柜', 'nightstand', '糖果粉彩', 70, {
        x: 414,
        y: 887,
        w: 185,
        h: 220,
    }),
    makeRoomAssemblyShopItem('room_front_candy_wardrobe_v1', '糖果衣柜', 'wardrobe', '糖果粉彩', 175, {
        x: 88,
        y: 412,
        w: 235,
        h: 330,
    }),
    makeRoomAssemblyShopItem('room_front_candy_vanity_v1', '糖果梳妆台', 'vanity', '糖果粉彩', 165, {
        x: 476,
        y: 506,
        w: 273,
        h: 340,
    }),
    makeRoomAssemblyShopItem('room_front_candy_bookshelf_v1', '糖果书架', 'bookshelf', '糖果粉彩', 155, {
        x: 840,
        y: 352,
        w: 300,
        h: 390,
    }),
    makeRoomAssemblyShopItem('room_front_candy_sofa_v1', '糖果沙发', 'sofa', '糖果粉彩', 220, {
        x: 660,
        y: 750,
        w: 420,
        h: 290,
    }),
    makeRoomAssemblyShopItem(
        'room_decor_candy_rug_v1',
        '糖心华毯',
        'rug',
        '糖果粉彩',
        75,
        { x: 408, y: 872, w: 450, h: 270 },
        { directional: false, groundLayer: true, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_candy_floor_lamp_v1',
        '糖果落地灯',
        'floorLamp',
        '糖果粉彩',
        70,
        { x: 888, y: 494, w: 270, h: 450 },
        { directional: false, collision: { enabled: true, x: 0.35, y: 0.82, w: 0.3, h: 0.14 } },
    ),
    makeRoomAssemblyShopItem(
        'room_decor_candy_wall_art_v1',
        '糖果甜景画',
        'wallArt',
        '糖果粉彩',
        60,
        { x: 492, y: 300, w: 420, h: 245 },
        { directional: false, collision: { enabled: false, x: 0, y: 0, w: 1, h: 1 } },
    ),
];

export const roomAssemblyShopByAssetId = new Map(roomAssemblyShopItems.map((item) => [item.assetId, item]));

export const roomAssemblyPreviewAssetById = new Map(roomEditorAssetCatalog.map((asset) => [asset.id, asset]));
