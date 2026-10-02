// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function scrubRoomAssemblyPromptText(value) {
    return dependencies.compactText(value).replace(/door/ig, '').replace(/门/g, '');
}

function normalizeRoomAssemblyItem(value) {
    const text = String(value || '').trim();
    const compact = text.replace(/[\s_-]+/g, '').toLowerCase();
    const key = dependencies.ROOM_ASSEMBLY_ITEM_ALIASES[text] || dependencies.ROOM_ASSEMBLY_ITEM_ALIASES[text.toLowerCase()] || dependencies.ROOM_ASSEMBLY_ITEM_ALIASES[compact];
    return dependencies.ROOM_ASSEMBLY_ALLOWED_ITEMS.has(key) ? key : '';
}

function normalizeRoomAssemblyDirection(value) {
    const text = String(value || '').trim();
    const key = dependencies.ROOM_ASSEMBLY_DIRECTION_ALIASES[text] || dependencies.ROOM_ASSEMBLY_DIRECTION_ALIASES[text.toLowerCase()];
    return dependencies.ROOM_ASSEMBLY_ALLOWED_DIRECTIONS.has(key) ? key : 'front';
}

function normalizeRoomAssemblyGridValue(value, fallback = 1, options = {}) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const rounded = Math.round(num);
    return options.clamp === false ? num : dependencies.clampNumber(rounded, 1, 14);
}

function normalizeRoomAssemblyAssetId(value) {
    return dependencies.compactText(value).replace(/[^\w.-]/g, '').slice(0, 140);
}

function normalizeRoomAssemblyBudget(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round(dependencies.clampNumber(num, 0, 100000));
}

function normalizeRoomAssemblyShopItem(item = {}) {
    const assetId = normalizeRoomAssemblyAssetId(item.assetId || item.asset_id || item.id);
    const kind = normalizeRoomAssemblyItem(item.item || item.kind || item.category);
    const price = Math.max(0, Math.round(Number(item.price || 0)));
    if (!assetId || !kind) return null;
    return {
        assetId,
        item: kind,
        label: scrubRoomAssemblyPromptText(item.label || item.name || assetId),
        style: scrubRoomAssemblyPromptText(item.style || ''),
        price,
        maxQuantity: Math.max(1, Math.min(99, Math.round(Number(item.maxQuantity || item.max_quantity || 99)))),
        cells: item.cells || item.size || null,
        preferred_dir: normalizeRoomAssemblyDirection(item.preferred_dir || item.direction || 'front'),
        directional: item.directional !== false
    };
}

function getRoomAssemblyBaseAssetId(assetId) {
    const value = normalizeRoomAssemblyAssetId(assetId);
    const match = value.match(/^room_dir_(.+)_(front|back|left|right)_v1$/);
    return match ? `room_front_${match[1]}_v1` : value;
}

function findRoomAssemblyShopItemByAssetId(shopItems, assetId) {
    const baseAssetId = getRoomAssemblyBaseAssetId(assetId);
    return shopItems.find((item) => item.assetId === baseAssetId) || null;
}

function findCheapestRoomAssemblyShopItem(shopItems, kind, remainingBudget = Infinity, quantity = 1) {
    const safeKind = normalizeRoomAssemblyItem(kind);
    if (!safeKind) return null;
    return shopItems
        .filter((item) => item.item === safeKind && item.price * quantity <= remainingBudget)
        .sort((a, b) => (a.price - b.price) || a.assetId.localeCompare(b.assetId))[0] || null;
}

function normalizeAgencyRoomAssemblyOutput(parsed, furnitureList = [], budget = 0) {
    const safeBudget = normalizeRoomAssemblyBudget(budget);
    const shopItems = (Array.isArray(furnitureList) ? furnitureList : [])
        .map(normalizeRoomAssemblyShopItem)
        .filter(Boolean);
    const resolvedShopItems = shopItems.length > 0 ? shopItems : [
        { assetId: 'room_front_bed_scandinavian_blue_v1', item: 'bed', label: '床', style: '基础', price: 115, maxQuantity: 99, cells: { front: '5x5' }, preferred_dir: 'front', directional: true },
        { assetId: 'room_front_ocean_nightstand_v1', item: 'nightstand', label: '床头柜', style: '基础', price: 40, maxQuantity: 99, cells: { front: '3x3' }, preferred_dir: 'front', directional: true },
        { assetId: 'room_front_ocean_wardrobe_v1', item: 'wardrobe', label: '衣柜', style: '基础', price: 100, maxQuantity: 99, cells: { front: '3x5' }, preferred_dir: 'front', directional: true },
        { assetId: 'room_front_ocean_vanity_v1', item: 'vanity', label: '梳妆台', style: '基础', price: 95, maxQuantity: 99, cells: { front: '4x5' }, preferred_dir: 'front', directional: true }
    ];
    const source = Array.isArray(parsed?.placements)
        ? parsed.placements
        : (Array.isArray(parsed?.items) ? parsed.items : (Array.isArray(parsed) ? parsed : []));
    const sourcePurchases = Array.isArray(parsed?.purchases)
        ? parsed.purchases
        : (Array.isArray(parsed?.shopping_list) ? parsed.shopping_list : []);
    const purchasesByAsset = new Map();
    const singlePurchaseKinds = new Set(['rug', 'wallArt']);
    let spent = 0;

    const addPurchase = (candidate = {}, quantityFallback = 1) => {
        const requestedAssetId = normalizeRoomAssemblyAssetId(candidate.assetId || candidate.asset_id || candidate.id || candidate.asset);
        const requestedShopItem = requestedAssetId ? findRoomAssemblyShopItemByAssetId(resolvedShopItems, requestedAssetId) : null;
        const requestedKind = normalizeRoomAssemblyItem(candidate.item || candidate.kind || candidate.category || requestedShopItem?.item);
        const requestedQuantity = Math.max(1, Math.round(Number(candidate.quantity || candidate.qty || quantityFallback || 1)));
        const remainingBudget = safeBudget > 0 ? Math.max(0, safeBudget - spent) : Infinity;
        let shopItem = requestedShopItem || findCheapestRoomAssemblyShopItem(resolvedShopItems, requestedKind, remainingBudget, requestedQuantity);
        if (shopItem && safeBudget > 0 && shopItem.price * requestedQuantity > remainingBudget) {
            shopItem = findCheapestRoomAssemblyShopItem(resolvedShopItems, requestedKind || shopItem.item, remainingBudget, requestedQuantity);
        }
        if (!shopItem) return null;
        if (singlePurchaseKinds.has(shopItem.item)) {
            const existingByKind = Array.from(purchasesByAsset.values()).find((purchase) => purchase.item === shopItem.item);
            if (existingByKind) return existingByKind;
        }
        const quantity = shopItem.item === 'rug' || shopItem.item === 'wallArt'
            ? 1
            : Math.min(requestedQuantity, Math.max(1, Number(shopItem.maxQuantity || requestedQuantity)));
        const subtotal = shopItem.price * quantity;
        if (safeBudget > 0 && spent + subtotal > safeBudget) return null;
        const existing = purchasesByAsset.get(shopItem.assetId);
        if (existing) {
            if (!singlePurchaseKinds.has(existing.item)) {
                existing.quantity += quantity;
                existing.subtotal += subtotal;
                spent += subtotal;
            }
            return existing;
        }
        const purchase = {
            assetId: shopItem.assetId,
            item: shopItem.item,
            label: shopItem.label,
            style: shopItem.style,
            quantity,
            price: shopItem.price,
            subtotal
        };
        purchasesByAsset.set(shopItem.assetId, purchase);
        spent += subtotal;
        return purchase;
    };
    const findPurchasedByKind = (kind) => {
        const safeKind = normalizeRoomAssemblyItem(kind);
        if (!safeKind) return null;
        return Array.from(purchasesByAsset.values()).find((purchase) => purchase.item === safeKind) || null;
    };

    for (const purchase of sourcePurchases) addPurchase(purchase, 1);
    if (sourcePurchases.length === 0) {
        for (const item of source) addPurchase(item, 1);
    }

    const placements = [];
    for (const item of source) {
        const requestedAssetId = normalizeRoomAssemblyAssetId(item?.assetId || item?.asset_id || item?.asset);
        const requestedShopItem = requestedAssetId ? findRoomAssemblyShopItemByAssetId(resolvedShopItems, requestedAssetId) : null;
        const normalizedItem = normalizeRoomAssemblyItem(item?.item || item?.kind || item?.id || item?.name || requestedShopItem?.item);
        const alreadyPurchasedKind = requestedShopItem ? null : findPurchasedByKind(normalizedItem);
        const purchase = requestedShopItem && purchasesByAsset.has(requestedShopItem.assetId)
            ? purchasesByAsset.get(requestedShopItem.assetId)
            : (alreadyPurchasedKind || addPurchase({ ...item, item: normalizedItem }, 1));
        if (!purchase) continue;
        const constrainPlacement = purchase.item === 'wallArt';
        placements.push({
            assetId: purchase.assetId,
            item: purchase.item,
            x: normalizeRoomAssemblyGridValue(item?.x ?? item?.col ?? item?.grid_x, purchase.item === 'wardrobe' ? 1 : 2, { clamp: constrainPlacement }),
            y: normalizeRoomAssemblyGridValue(item?.y ?? item?.row ?? item?.grid_y, 4, { clamp: constrainPlacement }),
            dir: normalizeRoomAssemblyDirection(item?.dir || item?.direction || item?.facing)
        });
    }
    return {
        budget: safeBudget,
        spent,
        purchases: Array.from(purchasesByAsset.values()),
        placements,
        notes: scrubRoomAssemblyPromptText(parsed?.notes || parsed?.reason || parsed?.summary || '')
    };
}

async function generateAgencyRoomAssembly({ callLLM, db, config, home = {}, palette = {}, furniture = [], budget = 0, room = {}, aiChar }) {
    const endpoint = dependencies.compactText(aiChar?.api_endpoint || config.llm_endpoint);
    const key = dependencies.compactText(aiChar?.api_key || config.llm_key);
    const model = dependencies.compactText(aiChar?.model_name || config.llm_model);

    if (!endpoint || !key || !model) {
        throw new Error('Agency AI model config is missing. Please choose an available API.');
    }

    const roomSize = {
        cols: dependencies.clampNumber(room?.size?.cols || room?.cols || 16, 8, 24),
        rows: dependencies.clampNumber(room?.size?.rows || room?.rows || 16, 8, 24)
    };
    const roomConstraints = room && typeof room === 'object' && !Array.isArray(room)
        ? (room.constraints || {})
        : {};
    const bedTopBaselineY = Math.round(dependencies.clampNumber(
        roomConstraints.bed_top_baseline_y_px ?? roomConstraints.bedTopBaselineY ?? 79,
        0,
        2000
    ));
    const bedMinGridY = Math.round(dependencies.clampNumber(
        roomConstraints.bed_min_grid_y ?? roomConstraints.bedMinGridY ?? 3,
        0,
        Number(roomSize.rows || 16)
    ));
    const roomBudget = normalizeRoomAssemblyBudget(budget || home?.room_budget || home?.assembly_budget);
    const safeFurniture = (Array.isArray(furniture) ? furniture : [])
        .map(normalizeRoomAssemblyShopItem)
        .filter(Boolean);
    const furnitureList = safeFurniture.length > 0 ? safeFurniture : [
        { assetId: 'room_front_bed_scandinavian_blue_v1', item: 'bed', label: '床', style: '基础', price: 115, maxQuantity: 99, cells: { front: '5x5' }, preferred_dir: 'front', directional: true },
        { assetId: 'room_front_ocean_nightstand_v1', item: 'nightstand', label: '床头柜', style: '基础', price: 40, maxQuantity: 99, cells: { front: '3x3' }, preferred_dir: 'front', directional: true },
        { assetId: 'room_front_ocean_wardrobe_v1', item: 'wardrobe', label: '衣柜', style: '基础', price: 100, maxQuantity: 99, cells: { front: '3x5' }, preferred_dir: 'front', directional: true },
        { assetId: 'room_front_ocean_vanity_v1', item: 'vanity', label: '梳妆台', style: '基础', price: 95, maxQuantity: 99, cells: { front: '4x5' }, preferred_dir: 'front', directional: true }
    ];
    const homeSummary = {
        name: scrubRoomAssemblyPromptText(home?.name || home?.id || '样板房'),
        weekly_rent: Number(home?.weekly_rent || 0),
        comfort: Number(home?.comfort || 0),
        prestige: Number(home?.prestige || 0),
        privacy: Number(home?.privacy || 0),
        description: scrubRoomAssemblyPromptText(home?.description || '').slice(0, 220)
    };
    const systemPrompt = [
        '你是像素小屋里的房屋销售顾问兼室内家具布局 AI。',
        '你的目标是根据预算把房间布置得更容易被买家喜欢：家具摆放要有生活逻辑、动线清楚、功能区明确、视觉上整洁，并尽量让关键家具正面朝镜头。',
        '你的任务是根据 ASCII 网格、家具商店价格和预算，输出可以直接转换成像素家具坐标的采购摆放方案。',
        '你只负责室内家具采购和摆放，不输出销售文案，不发布广告，不描述商业街内容。',
        '使用快速贪心布局，不要寻找最优解，不要做长篇预算组合推演。',
        '只输出 JSON，不要解释，不要写 Markdown。'
    ].join('\n');
    const userPrompt = [
        '请为当前像素小屋生成家具摆放。',
        '',
        '[房间 ASCII]',
        dependencies.ROOM_ASSEMBLY_ASCII,
        '',
        '[图例]',
        '[w]=墙体',
        '[d]=地面',
        '[m]=墙边视觉缓冲区/踢脚线/留白，不可摆放家具',
        'x,y 使用 0 起点视觉网格坐标，必须给出家具左上角锚点，不是中心点。',
        '每个素材都有 cells，占地是矩形面积；放置时用左上格加宽高形成完整矩形来检查边界和重叠。',
        '普通家具完整占格必须落在 [d] 区域内；边界以 ASCII 中的 [d]/[m]/[w] 为准，不要压住墙体或墙边视觉缓冲区。',
        '墙和地板的过渡线在房间上方墙面与地面相接的位置；普通家具渲染时地线会按背景向上校准半格，第一排地面贴近这条过渡线，wallArt 放在过渡线上方的墙面区域。',
        '检查重叠必须用 cells 占地矩形，不许只比较左上角；ASCII 房间网格就是用来判断可放区域和碰撞的。',
        '',
        '[当前房源]',
        JSON.stringify(homeSummary, null, 2),
        '',
        '[装修预算]',
        String(roomBudget),
        '',
        '[房间硬约束]',
        JSON.stringify({
            bed_top_baseline_y_px: bedTopBaselineY,
            bed_min_grid_y: bedMinGridY
        }, null, 2),
        '',
        '[家具商店]',
        JSON.stringify(furnitureList, null, 2),
        '',
        '[摆放规则]',
        '1. 只能从家具商店选择素材，必须使用商店里的 assetId。',
        '2. purchases 的总价不能超过装修预算，price 以家具商店为准；预算是装修上限，不是存款目标。',
        '3. 用快速贪心：先覆盖更多家具种类，再用剩余预算补装饰或重复件；不要计算最优组合。',
        '4. 在不超预算、普通家具占地不重叠、不压墙的前提下，尽可能多买家具和装饰，尽量把花费推近预算上限。',
        '5. 如果还有预算和合法空位，不要停在基础四件套；继续加入书架、沙发、地毯、灯、挂画，直到空间或预算接近上限。',
        '6. 家具商店包含功能家具和装饰品；装饰品包括 rug、floorLamp、wallArt，它们是房屋档次的一部分，不是可忽略杂物。',
        '7. 必需品优先级：床、床头柜、衣柜、梳妆台；然后按房源档次加入书架、沙发、地毯、灯、挂画。',
        '8. 普通家具 bed/nightstand/wardrobe/vanity/bookshelf/sofa/floorLamp 只放在 [d] 地面范围内；床、书架、衣柜、梳妆台、沙发等大件推荐靠后墙或侧墙，但不能为了靠墙压住 [w]/[m] 或墙地过渡线。',
        `8a. 床的最高点不得高过当前床顶边基线：渲染后的床顶 y 必须 >= ${bedTopBaselineY}px；换算到输出网格时，bed 的 placements.y 必须 >= ${bedMinGridY}，宁可把床往下放，不要让床越过这条基线。`,
        '9. rug 最多 1 张，必须放在地面/地毯区域，不要挂到墙面；wallArt 最好只放 1 张，必须放在墙面区域，不要贴地、不要落到地板。',
        '10. rug 和 wallArt 都是置底图层，可以被其他家具部分遮盖；但最好仍露出主要图案，不要被床、沙发、衣柜等大件完全盖住。',
        '10a. wallArt/挂画的主体图案要尽量完整露出；摆床、衣柜、书柜/书架、沙发等大件时，不要把它们放到挂画正前方，也不要遮住画面主体。',
        '11. 除 rug/wallArt 外，所有家具必须用 cells 占地面积做碰撞检查，任意两个普通家具的占地矩形不能重叠；可以紧凑摆放，留出一条可读走道即可。',
        '13. 尽量使用 dir=front，让家具正面朝镜头；只有布局明显更自然时，才使用 left、right 或 back。',
        '14. 衣柜正面、梳妆台镜面、床正面、床头柜正面尽量可见。',
        '15. 床头柜必须靠近床，梳妆台和衣柜前方至少留出 1 格地面。',
        '16. 即使预算 < 950，只要有空位也应加入装饰；预算 >= 950 时优先加入至少 2 类装饰；预算 >= 1450 或 prestige >= 32 时优先加入地毯、灯、挂画三类装饰。',
        '17. 高档房源不要只摆功能家具；如果空间允许，用同风格装饰品、沙发、书架拉开居住档次。',
        '18. 优先覆盖更多家具种类，再考虑重复同类；书柜、沙发这类大件优先于第二个梳妆台、第二个床头柜或第二盏灯。',
        '19. 除 rug 和 wallArt 最多 1 张外，不限制购买和摆放数量；可以增加不同家具和装饰，但不要无意义重复堆同一件素材。',
        '20. 输出必须是紧凑 JSON；不要复述家具商店、预算、规则、ASCII 或推理过程。',
        '21. purchases 只写 assetId 和 quantity；placements 只写 assetId、item、x、y、dir；notes 简短。',
        '',
        '[输出格式]',
        '返回一个 JSON 对象，包含 budget、spent、purchases、placements、notes。',
        'purchases 是数组，每项只包含 assetId 和 quantity；assetId 必须完整复制家具商店里的字符串，不要改写。',
        'placements 是数组，每项只包含 assetId、item、x、y、dir；x/y 是左上角视觉网格坐标，必须由你根据 ASCII 和 cells 自己计算，不要复用任何示例。'
    ].join('\n');

    dependencies.recordAgencyDebug(db, aiChar, 'input', {
        system_prompt: systemPrompt,
        user_prompt: userPrompt
    }, {
        context_type: 'social_housing_room_assembly',
        model,
        endpoint
    });

    const result = await callLLM({
        endpoint,
        key,
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        maxTokens: null,
        temperature: 0.25,
        responseFormat: { type: 'json_object' },
        returnUsage: true,
        maxAttempts: 1
    });

    const raw = typeof result === 'string' ? result : result?.content;
    const finishReason = String(result?.finishReason || '').trim();

    dependencies.recordAgencyDebug(db, aiChar, 'output', String(raw || ''), {
        context_type: 'social_housing_room_assembly',
        model,
        endpoint,
        finishReason,
        cached: !!result?.cached,
        usage: result?.usage || null
    });

    let parsed;
    try {
        parsed = dependencies.parseLooseAgencyJsonText(raw);
    } catch (e) {
        if (finishReason === 'length') {
            throw new Error('Agency room assembly AI output was truncated. Please retry.');
        }
        throw new Error('Agency room assembly AI output was malformed. Please retry.');
    }

    const assembly = normalizeAgencyRoomAssemblyOutput(parsed, furnitureList, roomBudget);
    if (assembly.placements.length === 0) {
        throw new Error('Agency room assembly AI output had no usable placements. Please retry.');
    }
    if (finishReason === 'length' && !assembly.notes) {
        assembly.notes = '模型返回到长度上限，但前段 JSON 已成功解析。';
    }

    return {
        ...assembly,
        room: roomSize,
        model,
        ai_character: aiChar ? { id: String(aiChar.id), name: String(aiChar.name || aiChar.id) } : null,
        raw_output: String(raw || '')
    };
}

    return { scrubRoomAssemblyPromptText, normalizeRoomAssemblyItem, normalizeRoomAssemblyDirection, normalizeRoomAssemblyGridValue, normalizeRoomAssemblyAssetId, normalizeRoomAssemblyBudget, normalizeRoomAssemblyShopItem, getRoomAssemblyBaseAssetId, findRoomAssemblyShopItemByAssetId, findCheapestRoomAssemblyShopItem, normalizeAgencyRoomAssemblyOutput, generateAgencyRoomAssembly };
}

module.exports = { createModule };
