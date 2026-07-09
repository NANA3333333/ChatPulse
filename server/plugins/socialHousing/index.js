const initSocialHousingDb = require('./db');
const initCityDb = require('../city/cityDb');
const { buildUniversalContext } = require('../../contextBuilder');
const { createRentalChainService } = require('./rentalChainService');
const {
    isSocialHousingValidationError,
    normalizeAgencyConfigPayload,
    normalizeAgencyIntervalMinutes,
    normalizeHousingBindingPayload,
    normalizeHousingPayload,
    normalizeSocialClassPayload
} = require('./inputGuards');
const { filterAutomationUsers } = require('../../automationActivity');

const AUTO_TICK_MS = 60 * 1000;
const RENT_TICK_MS = 60 * 1000;

function compactText(value, fallback = '') {
    return String(value || '').replace(/\s+/g, ' ').trim() || fallback;
}

function sendSocialHousingError(res, error) {
    const status = isSocialHousingValidationError(error) ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
}

function buildAgencyAdKey(title, content) {
    return `${compactText(title)}\n${compactText(content)}`;
}

function unwrapAgencyJsonText(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenceMatch ? String(fenceMatch[1] || '').trim() : raw;
}

function parseLooseAgencyJsonText(text) {
    const raw = unwrapAgencyJsonText(text);
    try {
        return JSON.parse(raw);
    } catch (error) {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return JSON.parse(raw.slice(start, end + 1));
        }
        throw error;
    }
}

function looksLikePriceText(text) {
    const value = String(text || '');
    return /\d/.test(value) && /(周租|售价|买断价|元|金币|租)/.test(value);
}

function getAgencyModelOptions(db) {
    const chars = typeof db.getCharacters === 'function' ? db.getCharacters() : [];
    return chars
        .filter((char) => char?.api_endpoint && char?.api_key && char?.model_name)
        .map((char) => ({
            id: String(char.id),
            name: String(char.name || char.id),
            model_name: String(char.model_name || ''),
            api_endpoint: String(char.api_endpoint || '')
        }));
}

function resolveAgencyAiChar(db, config = {}) {
    const chars = typeof db.getCharacters === 'function' ? db.getCharacters() : [];
    if (String(config.model_char_id || 'auto') !== 'auto') {
        const selected = chars.find(
            (char) => String(char.id) === String(config.model_char_id) && char?.api_endpoint && char?.api_key && char?.model_name
        );
        if (selected) return selected;
    }
    return chars.find((char) => char?.api_endpoint && char?.api_key && char?.model_name) || null;
}

function maskSecretLast4(value) {
    const text = String(value || '').trim();
    return text ? text.slice(-4) : '';
}

function redactSocialHousingCharacterSecrets(characters = []) {
    return (Array.isArray(characters) ? characters : []).map((char) => {
        const apiKey = String(char?.api_key || '').trim();
        return {
            ...char,
            api_key: '',
            api_key_configured: !!apiKey,
            api_key_last4: maskSecretLast4(apiKey)
        };
    });
}

function redactAgencyConfig(config = {}) {
    const llmKey = String(config?.llm_key || '').trim();
    const safe = {
        ...config,
        llm_key_configured: !!llmKey,
        llm_key_last4: maskSecretLast4(llmKey)
    };
    delete safe.llm_key;
    return safe;
}

function preserveAgencySecretPatch(payload = {}, current = {}) {
    const next = { ...(payload || {}) };
    if (Object.prototype.hasOwnProperty.call(next, 'llm_key')) {
        const value = String(next.llm_key || '').trim();
        if ((!value || /^(\u2022{2,}|\*{2,})/.test(value)) && String(current?.llm_key || '').trim()) {
            delete next.llm_key;
        }
    }
    return next;
}

function removeAgencyArtifacts(cityDb, title, content) {
    if (!cityDb?.db) return;
    const normalizedTitle = compactText(title);
    const normalizedContent = compactText(content);
    if (!normalizedContent) return;
    const announcementLogContent = `[中介所广告] ${normalizedTitle} | ${normalizedContent}`;

    cityDb.db.prepare(`
        DELETE FROM city_announcements
        WHERE source_type = 'agency'
          AND TRIM(title) = ?
          AND TRIM(content) = ?
    `).run(normalizedTitle, normalizedContent);

    cityDb.db.prepare(`
        DELETE FROM city_logs
        WHERE character_id = 'system'
          AND action_type = 'ANNOUNCE'
          AND TRIM(content) = ?
    `).run(announcementLogContent);
}

function cleanupOrphanAgencyArtifacts(socialHousingDb, cityDb) {
    if (!socialHousingDb || !cityDb?.db) return;
    const ads = socialHousingDb.getAgencyAds(500) || [];
    const keepKeys = new Set(
        ads.map((ad) => `${compactText(ad.title)}\n${compactText(ad.content)}`).filter(Boolean)
    );

    const announcementRows = cityDb.db.prepare(`
        SELECT id, title, content
        FROM city_announcements
        WHERE source_type = 'agency'
    `).all();
    for (const row of announcementRows) {
        const key = `${compactText(row.title)}\n${compactText(row.content)}`;
        if (!keepKeys.has(key)) {
            removeAgencyArtifacts(cityDb, row.title, row.content);
        }
    }

    const logRows = cityDb.db.prepare(`
        SELECT id, content
        FROM city_logs
        WHERE character_id = 'system'
          AND action_type = 'ANNOUNCE'
          AND content LIKE '[中介所广告] %'
    `).all();
    for (const row of logRows) {
        const raw = compactText(row.content);
        const body = raw.replace(/^\[中介所广告\]\s*/, '');
        const splitIndex = body.indexOf(' | ');
        const title = splitIndex >= 0 ? body.slice(0, splitIndex) : '';
        const content = splitIndex >= 0 ? body.slice(splitIndex + 3) : body;
        const key = `${compactText(title)}\n${compactText(content)}`;
        if (!keepKeys.has(key)) {
            cityDb.db.prepare('DELETE FROM city_logs WHERE id = ?').run(Number(row.id));
        }
    }
}

function getPublicAgencyAnnouncements(cityDb, limit = 50) {
    if (typeof cityDb?.getCityAnnouncements !== 'function') return [];
    return (cityDb.getCityAnnouncements(limit) || []).filter((item) => String(item.source_type || '') === 'agency');
}

function getAgencyAdsWithPublishState(socialHousingDb, cityDb, limit = 12) {
    const publicKeys = new Set(
        getPublicAgencyAnnouncements(cityDb, 50)
            .map((item) => buildAgencyAdKey(item.title, item.content))
            .filter(Boolean)
    );
    return (socialHousingDb.getAgencyAds(limit) || []).map((ad) => ({
        ...ad,
        is_published: publicKeys.has(buildAgencyAdKey(ad.title, ad.content))
    }));
}

function getRentalChainEventMap(socialHousingDb, chains = []) {
    if (!socialHousingDb?.getRentalChainEvents) return {};
    const map = {};
    for (const chain of Array.isArray(chains) ? chains : []) {
        const id = Number(chain?.id || 0);
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        map[String(id)] = socialHousingDb.getRentalChainEvents(id);
    }
    return map;
}

function clampNumber(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, num));
}

function normalizeRentModelConfig(character = {}) {
    const endpoint = compactText(character.api_endpoint);
    const key = compactText(character.api_key);
    const model = compactText(character.model_name);
    if (!endpoint || !key || !model) {
        throw new Error('收租文案需要角色 API 配置，请配置角色 API 后重试。');
    }
    return { endpoint, key, model };
}

function summarizeRentCharacter(character = {}, binding = {}) {
    return {
        id: String(character.id || ''),
        name: String(character.name || character.id || ''),
        wallet: Number(character.wallet || 0)
    };
}

function summarizeRentHome(home = {}, binding = {}) {
    return {
        id: String(home.id || binding.housing_id || ''),
        name: String(home.name || binding.housing_name || binding.housing_id || ''),
        emoji: String(home.emoji || binding.housing_emoji || ''),
        weekly_rent: Number(binding.rent_weekly || home.weekly_rent || 0),
        district: String(home.district || home.location || ''),
        description: String(home.description || '').slice(0, 500)
    };
}

const RENT_EVENT_TIMEZONE = 'Asia/Shanghai';
const RENT_WEEKDAY_KEY_RE = /^(?:星期|周|礼拜)([一二三四五六日天])$/;

function getRentEventTimeFacts(now = Date.now()) {
    const parts = {};
    for (const part of new Intl.DateTimeFormat('zh-CN', {
        timeZone: RENT_EVENT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date(now))) {
        if (part.type !== 'literal') parts[part.type] = part.value;
    }
    return {
        timezone: RENT_EVENT_TIMEZONE,
        date: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: parts.weekday || '',
        time: `${parts.hour || '00'}:${parts.minute || '00'}`
    };
}

function getRentWeekdayKey(label = '') {
    const match = String(label || '').match(RENT_WEEKDAY_KEY_RE);
    if (!match) return '';
    return match[1] === '天' ? '日' : match[1];
}

function findRentWeekdayMentions(text = '') {
    return Array.from(String(text || '').matchAll(/(?:星期|周|礼拜)[一二三四五六日天]/g))
        .map((match) => match[0])
        .filter(Boolean);
}

function buildRentCollectionFacts(character = {}, housingContext = {}, amount = 0, paid = false, weeklyAgencyCollection = false, now = Date.now()) {
    const binding = housingContext.binding || {};
    const home = housingContext.housing || {};
    const walletBefore = Number(character.wallet || 0);
    return {
        event: 'housing_rent_collection',
        event_time: getRentEventTimeFacts(now),
        collection_type: weeklyAgencyCollection ? 'friday_agency_collection' : 'manual_rent_collection',
        character: summarizeRentCharacter(character, binding),
        home: summarizeRentHome(home, binding),
        rent: {
            amount: Number(amount || 0),
            wallet_before: walletBefore,
            wallet_after: paid ? walletBefore - Number(amount || 0) : walletBefore,
            paid: !!paid,
            evicted: !paid,
            reason: paid ? 'wallet_enough' : 'insufficient_funds'
        },
        system_result: paid
            ? 'rent_paid_and_home_kept'
            : 'insufficient_funds_evicted_home_cleared'
    };
}

function requireRentTextField(parsed, field, label) {
    const text = compactText(parsed?.[field]);
    if (!text) {
        throw new Error(`${label} 输出缺少 ${field}，请重试。`);
    }
    return text;
}

function parseRentCityLogOutput(raw) {
    try {
        return parseLooseAgencyJsonText(raw);
    } catch (error) {
        const text = unwrapAgencyJsonText(raw);
        const keyMatch = text.match(/["']city_log["']\s*:\s*["']/);
        if (!keyMatch) throw error;
        const start = (keyMatch.index || 0) + keyMatch[0].length;
        const tail = text.slice(start);
        const closeBraceIndex = tail.lastIndexOf('}');
        const valuePortion = closeBraceIndex >= 0 ? tail.slice(0, closeBraceIndex) : tail;
        const quoteIndex = Math.max(valuePortion.lastIndexOf('"'), valuePortion.lastIndexOf("'"));
        const recovered = compactText((quoteIndex >= 0 ? valuePortion.slice(0, quoteIndex) : valuePortion)
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\'));
        if (!recovered) throw error;
        return { city_log: recovered };
    }
}

function assertRentCityLogMatchesFacts(text, facts = {}) {
    const content = compactText(text);
    if (!/(收租|房租|租金|周租|房东|中介|扣款|交租)/.test(content)) {
        throw new Error('收租商业街描述没有写出收租事件，请重试。');
    }
    if (facts?.rent?.evicted && !/(赶.{0,6}(走|出)|收回|失去|无固定住所|搬离|离开)/.test(content)) {
        throw new Error('收租商业街描述没有写出被赶走/失去住房，请重试。');
    }
    const expectedWeekday = getRentWeekdayKey(facts?.event_time?.weekday);
    const wrongWeekday = expectedWeekday
        ? findRentWeekdayMentions(content).find((weekday) => getRentWeekdayKey(weekday) !== expectedWeekday)
        : '';
    if (wrongWeekday) {
        throw new Error('收租商业街描述的星期和事实不一致，请重试。');
    }
    return content;
}

function doesAgencyAdReferenceHome(ad, home) {
    if (ad?.home_id && home?.id && String(ad.home_id) === String(home.id)) return true;
    const title = compactText(ad?.title);
    const content = compactText(ad?.content);
    const haystack = `${title}\n${content}`;
    const signals = [
        home?.id,
        home?.name
    ]
        .map((value) => compactText(value))
        .filter(Boolean);
    return signals.some((signal) => haystack.includes(signal));
}

function removeAgencyArtifactsForHome(socialHousingDb, cityDb, home) {
    if (!socialHousingDb || !cityDb || !home) return 0;
    const ads = socialHousingDb.getAgencyAds(500) || [];
    let removedCount = 0;
    for (const ad of ads) {
        if (!doesAgencyAdReferenceHome(ad, home)) continue;
        const deleted = socialHousingDb.deleteAgencyAd(ad.id);
        if (deleted) {
            removeAgencyArtifacts(cityDb, ad.title, ad.content);
            removedCount += 1;
        }
    }
    return removedCount;
}

function recordAgencyDebug(db, aiChar, direction, payload, meta = {}) {
    if (!db || typeof db.addLlmDebugLog !== 'function' || !aiChar || aiChar.llm_debug_capture !== 1) return;
    try {
        const normalizedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
        db.addLlmDebugLog({
            character_id: aiChar.id,
            direction,
            context_type: meta.context_type || 'social_housing_agency',
            payload: normalizedPayload || '',
            meta,
            timestamp: Date.now()
        });
    } catch (e) {
        console.warn('[SocialHousing] Failed to record agency debug:', e.message);
    }
}

function buildAgencySnapshot(socialHousingDb, db) {
    const homes = (socialHousingDb.getHousingTiers() || [])
        .filter((item) => Number(item.is_enabled ?? 1) === 1)
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.weekly_rent || 0) - Number(b.weekly_rent || 0));
    const classes = socialHousingDb.getClasses();
    const characters = socialHousingDb.getCharactersWithBindings(() => db.getCharacters());

    const urgentCharacters = characters
        .filter((char) => ['overdue', 'unstable', 'temporary'].includes(String(char.binding?.housing_status || '')))
        .slice(0, 4)
        .map((char) => ({
            name: char.name,
            status: char.binding?.housing_status || 'stable',
            wallet: Number(char.wallet || 0),
            housing_name: char.binding?.housing?.name || '',
            rent_weekly: Number(char.binding?.rent_weekly || 0)
        }));

    const availableHomes = homes.map((item) => ({
        id: String(item.id || ''),
        name: String(item.name || ''),
        emoji: String(item.emoji || ''),
        weekly_rent: Number(item.weekly_rent || 0),
        deposit: Number(item.deposit || 0),
        sale_price: Number(item.sale_price || 0),
        comfort: Number(item.comfort || 0),
        prestige: Number(item.prestige || 0),
        privacy: Number(item.privacy || 0),
        description: String(item.description || '')
    }));

    return {
        homes_count: availableHomes.length,
        classes_count: classes.length,
        urgent_characters: urgentCharacters,
        available_homes: availableHomes
    };
}

async function generateAgencyAd({ callLLM, db, config, snapshot, aiChar }) {
    const endpoint = compactText(aiChar?.api_endpoint || config.llm_endpoint);
    const key = compactText(aiChar?.api_key || config.llm_key);
    const model = compactText(aiChar?.model_name || config.llm_model);

    if (!endpoint || !key || !model) {
        throw new Error('Agency AI model config is missing. Please choose an available API.');
    }
    if (!Array.isArray(snapshot.available_homes) || snapshot.available_homes.length === 0) {
        throw new Error('Agency AI has no enabled homes to promote.');
    }

    const systemPrompt = compactText(
        config.persona_prompt,
        '你是商业街里的房产中介所 AI，擅长像真人中介一样推销房子。你每次都要从可推销房子列表里挑一套房，广告里必须明确写出价格、具体房名或门牌、以及一句卖点。'
    );

    const userPrompt = [
        '请根据下面的数据，为商业街生成一条简短、自然、像真人门店广告一样的房产广告。',
        '要求：',
        '1. 只输出 JSON。',
        '2. JSON 格式必须是 {"title":"标题","content":"正文"}。',
        '3. 标题不超过 16 个字。',
        '4. 正文 1 到 2 句话，不要出现系统、AI、JSON 这些词。',
        '5. 必须明确写出价格，至少出现一次：周租 / 售价 / 买断价 / 元 / 金币。',
        '6. 必须明确写出推销的是哪套房，至少提到房名或门牌中的一个具体标识。',
        '7. 不要每次都推最便宜那套，优先在不同房子之间轮换。',
        `8. 门店名：${config.agency_name}`,
        `9. 顾问名：${config.agent_name}`,
        `10. 经营范围：${config.business_scope}`,
        '',
        '[当前可推销房子列表]',
        JSON.stringify(snapshot, null, 2)
    ].join('\n');

    const richerAdInstructions = [
        '',
        '[补充增强要求]',
        '- 这次广告要比普通短句更像真实中介传单，信息更丰富一些。',
        '- 标题不要太短，尽量带上小区名、门牌、户型或卖点。',
        '- 正文尽量写成 2 到 4 句，而不是只有一句话。',
        '- 除了价格，还尽量自然写出：户型、押金、适合什么人、安静/采光/独卫/离哪里近/适合独居或情侣等信息。',
        '- 文风要像真人中介门店张贴的传单，具体、热情、接地气，不要像系统总结。',
        '- 不要只说“快来看”，而是让租房者看完就知道这套房大概什么样、为什么值得来看。'
    ].join('\n');
    const homeIdInstruction = '\n[home_id requirement]\nIf possible, include an extra JSON field named "home_id". Its value must be exactly one housing id from the provided list.\n';
    const finalUserPrompt = `${userPrompt}${richerAdInstructions}${homeIdInstruction}`;

    recordAgencyDebug(db, aiChar, 'input', {
        system_prompt: systemPrompt,
        user_prompt: finalUserPrompt
    }, {
        context_type: 'social_housing_agency_ad',
        model,
        endpoint
    });

    const result = await callLLM({
        endpoint,
        key,
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: finalUserPrompt }
        ],
        maxTokens: 3000,
        temperature: 0.9,
        returnUsage: true
    });

    const raw = typeof result === 'string' ? result : result?.content;
    const finishReason = String(result?.finishReason || '').trim();

    recordAgencyDebug(db, aiChar, 'output', String(raw || ''), {
        context_type: 'social_housing_agency_ad',
        model,
        endpoint,
        finishReason,
        cached: !!result?.cached,
        usage: result?.usage || null
    });

    if (finishReason === 'length') {
        throw new Error('Agency AI output was truncated. Please retry.');
    }

    let parsed;
    try {
        parsed = JSON.parse(unwrapAgencyJsonText(raw));
    } catch (e) {
        throw new Error('Agency AI output was malformed. Please retry.');
    }

    const title = compactText(parsed?.title, `${config.agency_name || '安家置业'}新房讯息`);
    const content = compactText(parsed?.content);
    const selectedHomeId = compactText(parsed?.home_id || parsed?.homeId);
    if (!title || !content) {
        throw new Error('Agency AI output was malformed. Please retry.');
    }
    if (!looksLikePriceText(`${title} ${content}`)) {
        throw new Error('Agency AI output was missing price information. Please retry.');
    }

    const normalizedAdText = `${title} ${content}`;
    const availableHomeSignals = snapshot.available_homes
        .map((item) => ({
            id: compactText(item.id),
            signals: [item.name, item.id]
                .filter(Boolean)
                .map((value) => String(value || '').trim())
                .filter(Boolean)
        }))
        .filter((item) => item.id || item.signals.length > 0);
    const mentionsSpecificHome = availableHomeSignals.some((item) =>
        item.signals.some((signal) => signal && normalizedAdText.includes(signal))
    );
    const selectedHomeExists = !!selectedHomeId && availableHomeSignals.some((item) => item.id === selectedHomeId);
    if (!mentionsSpecificHome && !selectedHomeExists) {
        throw new Error('Agency AI output did not mention a specific home. Please retry.');
    }

    return { title, content, home_id: selectedHomeExists ? selectedHomeId : '' };
}

const ROOM_ASSEMBLY_ALLOWED_ITEMS = new Set(['bed', 'nightstand', 'wardrobe', 'vanity', 'desk', 'bookshelf', 'sofa', 'rug', 'floorLamp', 'wallArt']);
const ROOM_ASSEMBLY_ALLOWED_DIRECTIONS = new Set(['front', 'back', 'left', 'right']);
const ROOM_ASSEMBLY_ITEM_ALIASES = {
    bed: 'bed',
    '床': 'bed',
    nightstand: 'nightstand',
    bedside: 'nightstand',
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
    'floor_lamp': 'floorLamp',
    'floor-lamp': 'floorLamp',
    lamp: 'floorLamp',
    tablelamp: 'floorLamp',
    'table_lamp': 'floorLamp',
    'table-lamp': 'floorLamp',
    '落地灯': 'floorLamp',
    '台灯': 'floorLamp',
    wallart: 'wallArt',
    'wall_art': 'wallArt',
    'wall-art': 'wallArt',
    art: 'wallArt',
    painting: 'wallArt',
    '挂画': 'wallArt',
    '墙面装饰': 'wallArt'
};
const ROOM_ASSEMBLY_DIRECTION_ALIASES = {
    front: 'front',
    '正面': 'front',
    back: 'back',
    '背面': 'back',
    left: 'left',
    '左侧': 'left',
    '左': 'left',
    right: 'right',
    '右侧': 'right',
    '右': 'right'
};
const ROOM_ASSEMBLY_ASCII = [
    'ROOM 16x16',
    '[w][w][w][w][w][w][w][w][w][w][w][w][w][w][w][w]',
    '[w][m][m][m][m][m][m][m][m][m][m][m][m][m][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][d][d][d][d][d][d][d][d][d][d][d][d][m][w]',
    '[w][m][m][m][m][m][m][m][m][m][m][m][m][m][m][w]',
    '[w][w][w][w][w][w][w][w][w][w][w][w][w][w][w][w]'
].join('\n');

function scrubRoomAssemblyPromptText(value) {
    return compactText(value).replace(/door/ig, '').replace(/门/g, '');
}

function normalizeRoomAssemblyItem(value) {
    const text = String(value || '').trim();
    const compact = text.replace(/[\s_-]+/g, '').toLowerCase();
    const key = ROOM_ASSEMBLY_ITEM_ALIASES[text] || ROOM_ASSEMBLY_ITEM_ALIASES[text.toLowerCase()] || ROOM_ASSEMBLY_ITEM_ALIASES[compact];
    return ROOM_ASSEMBLY_ALLOWED_ITEMS.has(key) ? key : '';
}

function normalizeRoomAssemblyDirection(value) {
    const text = String(value || '').trim();
    const key = ROOM_ASSEMBLY_DIRECTION_ALIASES[text] || ROOM_ASSEMBLY_DIRECTION_ALIASES[text.toLowerCase()];
    return ROOM_ASSEMBLY_ALLOWED_DIRECTIONS.has(key) ? key : 'front';
}

function normalizeRoomAssemblyGridValue(value, fallback = 1, options = {}) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const rounded = Math.round(num);
    return options.clamp === false ? num : clampNumber(rounded, 1, 14);
}

function normalizeRoomAssemblyAssetId(value) {
    return compactText(value).replace(/[^\w.-]/g, '').slice(0, 140);
}

function normalizeRoomAssemblyBudget(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round(clampNumber(num, 0, 100000));
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
        { assetId: 'room_front_bed_peach_lemon_v1', item: 'bed', label: '床', style: '基础', price: 70, maxQuantity: 99, cells: { front: '5x5' }, preferred_dir: 'front', directional: true },
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
    const endpoint = compactText(aiChar?.api_endpoint || config.llm_endpoint);
    const key = compactText(aiChar?.api_key || config.llm_key);
    const model = compactText(aiChar?.model_name || config.llm_model);

    if (!endpoint || !key || !model) {
        throw new Error('Agency AI model config is missing. Please choose an available API.');
    }

    const roomSize = {
        cols: clampNumber(room?.size?.cols || room?.cols || 16, 8, 24),
        rows: clampNumber(room?.size?.rows || room?.rows || 16, 8, 24)
    };
    const roomConstraints = room && typeof room === 'object' && !Array.isArray(room)
        ? (room.constraints || {})
        : {};
    const bedTopBaselineY = Math.round(clampNumber(
        roomConstraints.bed_top_baseline_y_px ?? roomConstraints.bedTopBaselineY ?? 79,
        0,
        2000
    ));
    const bedMinGridY = Math.round(clampNumber(
        roomConstraints.bed_min_grid_y ?? roomConstraints.bedMinGridY ?? 3,
        0,
        Number(roomSize.rows || 16)
    ));
    const roomBudget = normalizeRoomAssemblyBudget(budget || home?.room_budget || home?.assembly_budget);
    const safeFurniture = (Array.isArray(furniture) ? furniture : [])
        .map(normalizeRoomAssemblyShopItem)
        .filter(Boolean);
    const furnitureList = safeFurniture.length > 0 ? safeFurniture : [
        { assetId: 'room_front_bed_peach_lemon_v1', item: 'bed', label: '床', style: '基础', price: 70, maxQuantity: 99, cells: { front: '5x5' }, preferred_dir: 'front', directional: true },
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
        ROOM_ASSEMBLY_ASCII,
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
        '5. 如果还有预算和合法空位，不要停在基础四件套；继续加入书桌、书架、沙发、地毯、灯、挂画，直到空间或预算接近上限。',
        '6. 家具商店包含功能家具和装饰品；装饰品包括 rug、floorLamp、wallArt，它们是房屋档次的一部分，不是可忽略杂物。',
        '7. 必需品优先级：床、床头柜、衣柜、梳妆台；然后按房源档次加入书桌、书架、沙发、地毯、灯、挂画。',
        '8. 普通家具 bed/nightstand/wardrobe/vanity/desk/bookshelf/sofa/floorLamp 只放在 [d] 地面范围内；床、书架、衣柜、书桌、梳妆台、沙发等大件推荐靠后墙或侧墙，但不能为了靠墙压住 [w]/[m] 或墙地过渡线。',
        `8a. 床的最高点不得高过当前床顶边基线：渲染后的床顶 y 必须 >= ${bedTopBaselineY}px；换算到输出网格时，bed 的 placements.y 必须 >= ${bedMinGridY}，宁可把床往下放，不要让床越过这条基线。`,
        '9. rug 最多 1 张，必须放在地面/地毯区域，不要挂到墙面；wallArt 最好只放 1 张，必须放在墙面区域，不要贴地、不要落到地板。',
        '10. rug 和 wallArt 都是置底图层，可以被其他家具部分遮盖；但最好仍露出主要图案，不要被床、沙发、衣柜等大件完全盖住。',
        '11. 除 rug/wallArt 外，所有家具必须用 cells 占地面积做碰撞检查，任意两个普通家具的占地矩形不能重叠；可以紧凑摆放，留出一条可读走道即可。',
        '12. 大件家具靠墙/沿墙只是布局建议，不是硬约束；优先保证合法占格、不重叠、走道可读，然后再考虑靠墙。',
        '13. 尽量使用 dir=front，让家具正面朝镜头；只有布局明显更自然时，才使用 left、right 或 back。',
        '14. 衣柜正面、梳妆台镜面、床正面、床头柜正面尽量可见。',
        '15. 床头柜必须靠近床，梳妆台和衣柜前方至少留出 1 格地面。',
        '16. 即使预算 < 950，只要有空位也应加入装饰；预算 >= 950 时优先加入至少 2 类装饰；预算 >= 1450 或 prestige >= 32 时优先加入地毯、灯、挂画三类装饰。',
        '17. 高档房源不要只摆功能家具；如果空间允许，用同风格装饰品、沙发、书桌、书架拉开居住档次。',
        '18. 优先覆盖更多家具种类，再考虑重复同类；书柜、书桌、沙发这类大件优先于第二个梳妆台、第二个床头柜或第二盏灯。',
        '19. 除 rug 和 wallArt 最多 1 张外，不限制购买和摆放数量；可以增加不同家具和装饰，但不要无意义重复堆同一件素材。',
        '20. 输出必须是紧凑 JSON；不要复述家具商店、预算、规则、ASCII 或推理过程。',
        '21. purchases 只写 assetId 和 quantity；placements 只写 assetId、item、x、y、dir；notes 简短。',
        '',
        '[输出格式]',
        '返回一个 JSON 对象，包含 budget、spent、purchases、placements、notes。',
        'purchases 是数组，每项只包含 assetId 和 quantity；assetId 必须完整复制家具商店里的字符串，不要改写。',
        'placements 是数组，每项只包含 assetId、item、x、y、dir；x/y 是左上角视觉网格坐标，必须由你根据 ASCII 和 cells 自己计算，不要复用任何示例。'
    ].join('\n');

    recordAgencyDebug(db, aiChar, 'input', {
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

    recordAgencyDebug(db, aiChar, 'output', String(raw || ''), {
        context_type: 'social_housing_room_assembly',
        model,
        endpoint,
        finishReason,
        cached: !!result?.cached,
        usage: result?.usage || null
    });

    let parsed;
    try {
        parsed = parseLooseAgencyJsonText(raw);
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

module.exports = function initSocialHousingPlugin(app, context) {
    const { authMiddleware, authDb, getUserDb, getWsClients, getEngine, getMemory, callLLM } = context;

    function ensureSocialHousingDb(db) {
        if (!db.socialHousing) {
            const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : db;
            db.socialHousing = initSocialHousingDb(rawDb);
        }
        return db.socialHousing;
    }

    function ensureCityDb(db) {
        if (!db.city) {
            const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : db;
            db.city = initCityDb(rawDb);
        }
        return db.city;
    }

    const rentalChainService = createRentalChainService({
        callLLM,
        buildUniversalContext,
        getMemory,
        getUserDb,
        getEngine,
        getWsClients,
        ensureSocialHousingDb,
        ensureCityDb,
        resolveAgencyAiChar,
        recordAgencyDebug,
        redactSocialHousingCharacterSecrets
    });

    async function publishAgencyAdForDb(db, triggerType = 'manual') {
        const socialHousingDb = ensureSocialHousingDb(db);
        const cityDb = ensureCityDb(db);
        const config = socialHousingDb.getAgencyConfig();
        const snapshot = buildAgencySnapshot(socialHousingDb, db);
        const aiChar = resolveAgencyAiChar(db, config);
        const ad = await generateAgencyAd({ callLLM, db, config, snapshot, aiChar });

        socialHousingDb.addAgencyAd({
            home_id: ad.home_id || '',
            title: ad.title,
            content: ad.content,
            trigger_type: triggerType,
            office_district: config.office_district
        });

        const intervalMinutes = normalizeAgencyIntervalMinutes(config.decision_interval_hours);
        const now = Date.now();
        socialHousingDb.saveAgencyConfig({
            ...config,
            ad_enabled: Number(config.enabled || 0) === 1 ? 1 : 0,
            ad_min_interval_minutes: intervalMinutes,
            ad_max_interval_minutes: intervalMinutes,
            last_ad_at: now,
            next_ad_at: now + intervalMinutes * 60 * 1000,
            last_error: '',
            last_error_at: 0
        });

        if (typeof cityDb.logAction === 'function') {
            cityDb.logAction('system', 'ANNOUNCE', `[中介所广告] ${ad.title} | ${ad.content}`, 0, 0, config.office_district || 'street');
        }
        if (typeof cityDb.addCityAnnouncement === 'function') {
            cityDb.addCityAnnouncement('agency', ad.title, ad.content, config.office_district || 'street');
        }

        return {
            ...ad,
            office_district: config.office_district || 'street'
        };
    }

    async function generateRentCityLog({ db, userId, character, housingContext, amount, paid, weeklyAgencyCollection, now = Date.now() }) {
        if (typeof callLLM !== 'function') {
            throw new Error('收租商业街描述需要模型服务，请稍后重试。');
        }
        const { endpoint, key, model } = normalizeRentModelConfig(character);
        const facts = buildRentCollectionFacts(character, housingContext, amount, paid, weeklyAgencyCollection, now);
        const universal = await buildUniversalContext({
            getUserDb,
            getMemory,
            userId,
            forceCityDetail: true
        }, character, '住房系统收租事件', false, []);
        const systemPrompt = [
            `请根据 ${character.name} 的设定和上下文，为商业街活动流写一条公开日志。`,
            '只输出严格 JSON，不要输出 Markdown 或解释。',
            'JSON 格式必须是 {"city_log":"..."}。'
        ].join('\n');
        const userPrompt = [
            '[默认大输入库]',
            universal?.preamble || '',
            '',
            '[收租事实]',
            JSON.stringify(facts, null, 2),
            '',
            '[任务]',
            '根据收租事实生成一条商业街活动描述。',
            '硬性要求：',
            `0. 当前实际日期为 ${facts.event_time.date} ${facts.event_time.weekday} ${facts.event_time.time}（${facts.event_time.timezone}）；如果提到日期或星期，必须和这个事实一致。`,
            '1. city_log 用中文，适合商业街公开活动流。',
            '2. 必须尊重事实：这是角色本人被收租，不是用户替角色交租。',
            facts.rent.paid
                ? '3. 事实结果：本次房租已付，住房保留。'
                : '3. 事实结果：角色钱不够交租，住房已被房东/中介收回，住房状态已清除。',
            '4. 除以上事实边界外，具体反应、语气、细节由模型根据角色和上下文自由发挥。',
            '5. 不要输出模板、字段名、系统、API 或 JSON 之外的内容。'
        ].join('\n');

        recordAgencyDebug(db, character, 'input', {
            system_prompt: systemPrompt,
            user_prompt: userPrompt
        }, {
            context_type: 'social_housing_rent_city_log',
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
            maxTokens: 800,
            temperature: 0.72,
            responseFormat: { type: 'json_object' },
            returnUsage: true,
            maxAttempts: 1
        });

        const raw = typeof result === 'string' ? result : result?.content;
        const finishReason = String(result?.finishReason || '').trim();

        recordAgencyDebug(db, character, 'output', String(raw || ''), {
            context_type: 'social_housing_rent_city_log',
            model,
            endpoint,
            finishReason,
            cached: !!result?.cached,
            usage: result?.usage || null
        });

        if (finishReason === 'length') {
            throw new Error('收租商业街描述被截断，请重试。');
        }

        let parsed;
        try {
            parsed = parseRentCityLogOutput(raw);
        } catch (e) {
            throw new Error('收租商业街描述不是合法 JSON，请重试。');
        }

        const cityLog = requireRentTextField(parsed, 'city_log', '收租商业街描述');
        return assertRentCityLogMatchesFacts(cityLog, facts);
    }

    async function triggerRentPrivateReply({ db, userId, character, housingContext, amount, paid, weeklyAgencyCollection, now = Date.now() }) {
        if (!userId) {
            throw new Error('缺少用户上下文，无法触发收租私聊，请重试。');
        }
        const engine = getEngine(userId);
        if (!engine || typeof engine.triggerImmediateUserReply !== 'function') {
            throw new Error('私聊引擎不可用，请重试。');
        }
        const wsClients = getWsClients(userId);
        const facts = buildRentCollectionFacts(character, housingContext, amount, paid, weeklyAgencyCollection, now);
        const source = weeklyAgencyCollection
            ? 'social_housing_friday_rent_collection'
            : 'social_housing_manual_rent_collection';
        await engine.triggerImmediateUserReply(character.id, wsClients, {
            propagateError: true,
            extraSystemDirective: [
                '[系统事件：住房系统收租]',
                '事实边界：这是房东/中介向角色本人收取本次房租，不是用户在交租，也不是给用户租房。',
                `当前实际日期：${facts.event_time.date} ${facts.event_time.weekday} ${facts.event_time.time}（${facts.event_time.timezone}）。`,
                '[收租事实]',
                JSON.stringify(facts, null, 2),
                '只把这些事实当作当前事件背景；不要预设心情、态度或剧情细节。',
                '请基于私聊前文、RAG 记忆和你的性格自由回应。',
                '不要输出 [CITY_ACTION:...] 或 [CITY_INTENT:...]；不要说这是模板或系统消息；不要改变上述事实。'
            ].join('\n'),
            eventUserDirective: '住房系统刚触发一次收租事件，事实见系统事件。请按角色本人和私聊记忆自由回应。',
            extraDirectiveRole: 'system',
            skipTopicSwitchGate: true,
            triggerSource: source,
            triggerRoute: weeklyAgencyCollection ? 'socialHousing.weeklyRent' : 'socialHousing.payRent',
            triggerNote: `${facts.home.id || 'home'}:${facts.rent.paid ? 'paid' : 'evicted'}`
        });
        return { triggered: true, source };
    }

    async function settleCharacterRent(db, characterId, options = {}) {
        const socialHousingDb = ensureSocialHousingDb(db);
        const cityDb = ensureCityDb(db);
        const character = db.getCharacter(characterId);
        if (!character) return { success: false, reason: 'character_missing' };
        const housingContext = socialHousingDb.getHousingContextForCharacter(characterId);
        if (!housingContext?.binding?.housing_id) return { success: false, reason: 'no_housing' };
        const binding = housingContext.binding;
        const home = housingContext.housing || {};
        const amount = Number(binding.rent_weekly || home.weekly_rent || 0);
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, reason: 'rent_not_configured' };
        const weeklyAgencyCollection = String(options.source || '') === 'weekly_friday_agency';
        const paid = Number(character.wallet || 0) >= amount;
        const settledAt = Date.now();
        const cityLog = await generateRentCityLog({
            db,
            userId: options.userId,
            character,
            housingContext,
            amount,
            paid,
            weeklyAgencyCollection,
            now: settledAt
        });
        const privateReply = options.notifyPrivate === false
            ? null
            : await triggerRentPrivateReply({
                db,
                userId: options.userId,
                character,
                housingContext,
                amount,
                paid,
                weeklyAgencyCollection,
                now: settledAt
            });

        if (paid) {
            db.updateCharacter(character.id, { wallet: Number(character.wallet || 0) - amount });
            const nextBinding = socialHousingDb.markRentPaid(character.id, settledAt);
            cityDb.logAction(
                character.id,
                weeklyAgencyCollection ? 'AGENCY_RENT_COLLECTION' : 'RENT',
                cityLog,
                0,
                -amount,
                character.location || 'home'
            );
            return {
                success: true,
                paid: true,
                evicted: false,
                amount,
                character: db.getCharacter(character.id),
                binding: nextBinding,
                private_reply: privateReply
            };
        }

        socialHousingDb.saveBinding(character.id, {
            social_class_id: binding.social_class_id || '',
            housing_id: '',
            housing_status: 'homeless',
            rent_weekly: 0,
            rent_due_day: 7,
            rent_due_at: 0,
            rent_last_paid_at: Number(binding.rent_last_paid_at || 0),
            deposit_paid: 0,
            missed_rent_count: Number(binding.missed_rent_count || 0) + 1,
            note: `收租失败：${home.name || binding.housing_id || '住所'} 被房东或中介收回`
        });
        const nextBinding = socialHousingDb.getBinding(character.id);
        cityDb.logAction(
            character.id,
            weeklyAgencyCollection ? 'AGENCY_RENT_EVICTION' : 'RENT_EVICTION',
            cityLog,
            0,
            0,
            character.location || 'street'
        );
        return {
            success: true,
            paid: false,
            evicted: true,
            amount,
            character: db.getCharacter(character.id),
            binding: nextBinding,
            private_reply: privateReply
        };
    }

    async function settleDueRentsForDb(db, options = {}) {
        const socialHousingDb = ensureSocialHousingDb(db);
        const dueBindings = socialHousingDb.getDueRentBindings(Date.now());
        const results = [];
        for (const binding of dueBindings) {
            try {
                results.push(await settleCharacterRent(db, binding.character_id, {
                    source: 'weekly_friday_agency',
                    notifyPrivate: true,
                    userId: options.userId
                }));
            } catch (e) {
                console.warn('[SocialHousing] rent settlement item failed:', e.message);
                results.push({ success: false, character_id: binding.character_id, error: e.message });
            }
        }
        return results;
    }

    app.get('/api/social-housing/bootstrap', authMiddleware, (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const cityDb = ensureCityDb(req.db);
            cleanupOrphanAgencyArtifacts(socialHousingDb, cityDb);
            const publicAgencyAnnouncements = getPublicAgencyAnnouncements(cityDb, 50);
            const rentalChains = socialHousingDb.getRentalChains ? socialHousingDb.getRentalChains(20) : [];
            res.json({
                success: true,
                classes: socialHousingDb.getClasses(),
                housing_tiers: socialHousingDb.getHousingTiers(),
                characters: redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters())),
                districts: cityDb.getDistricts ? cityDb.getDistricts() : [],
                agency_model_options: getAgencyModelOptions(req.db),
                agency: redactAgencyConfig(socialHousingDb.getAgencyConfig()),
                agency_ads: getAgencyAdsWithPublishState(socialHousingDb, cityDb, 12),
                rental_chains: rentalChains,
                rental_chain_events: getRentalChainEventMap(socialHousingDb, rentalChains),
                public_agency_announcements: publicAgencyAnnouncements
            });
        } catch (e) {
            try {
                const socialHousingDb = ensureSocialHousingDb(req.db);
                const current = socialHousingDb.getAgencyConfig();
                socialHousingDb.saveAgencyConfig({
                    ...current,
                    last_error: String(e.message || '中介所 AI 执行失败'),
                    last_error_at: Date.now()
                });
            } catch (_) { /* ignore */ }
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.post('/api/social-housing/classes', authMiddleware, (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const payload = normalizeSocialClassPayload(req.body || {});
            const id = socialHousingDb.upsertClass(payload);
            res.json({ success: true, id, classes: socialHousingDb.getClasses() });
        } catch (e) {
            sendSocialHousingError(res, e);
        }
    });

    app.delete('/api/social-housing/classes/:id', authMiddleware, (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const deleted = socialHousingDb.deleteClass(req.params.id);
            if (!deleted) {
                return res.status(404).json({ success: false, error: '阶层不存在' });
            }
            res.json({ success: true, classes: socialHousingDb.getClasses() });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.post('/api/social-housing/housing', authMiddleware, (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const payload = normalizeHousingPayload(req.body || {});
            if (!String(payload.name || '').trim()) {
                return res.status(400).json({ success: false, error: '缺少房子名称' });
            }
            const id = socialHousingDb.upsertHousing(payload);
            res.json({ success: true, id, housing_tiers: socialHousingDb.getHousingTiers() });
        } catch (e) {
            sendSocialHousingError(res, e);
        }
    });

    app.delete('/api/social-housing/housing/:id', authMiddleware, (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const cityDb = ensureCityDb(req.db);
            const housingList = socialHousingDb.getHousingTiers() || [];
            const removedHome = housingList.find((item) => String(item.id) === String(req.params.id)) || null;
            const deleted = socialHousingDb.deleteHousing(req.params.id);
            if (!deleted || !removedHome) {
                return res.status(404).json({ success: false, error: '房屋不存在' });
            }
            const removedAgencyAds = removedHome ? removeAgencyArtifactsForHome(socialHousingDb, cityDb, removedHome) : 0;
            res.json({
                success: true,
                removed_agency_ads: removedAgencyAds,
                housing_tiers: socialHousingDb.getHousingTiers(),
                agency_ads: getAgencyAdsWithPublishState(socialHousingDb, cityDb, 12)
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.post('/api/social-housing/characters/:id/binding', authMiddleware, (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const character = req.db.getCharacter(req.params.id);
            if (!character) {
                return res.status(404).json({ success: false, error: '角色不存在' });
            }
            const rawPayload = req.body || {};
            const currentBinding = socialHousingDb.getBinding(req.params.id);
            const targetHome = socialHousingDb.getHousingById(String(rawPayload.housing_id || '').trim());
            const payload = normalizeHousingBindingPayload(rawPayload, currentBinding, targetHome);
            socialHousingDb.saveBinding(req.params.id, payload);
            res.json({
                success: true,
                characters: redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters())),
                housing_context: socialHousingDb.getHousingContextForCharacter(req.params.id)
            });
        } catch (e) {
            sendSocialHousingError(res, e);
        }
    });

    app.post('/api/social-housing/characters/:id/pay-rent', authMiddleware, async (req, res) => {
        try {
            const character = req.db.getCharacter(req.params.id);
            if (!character) {
                return res.status(404).json({ success: false, error: '角色不存在' });
            }
            const result = await settleCharacterRent(req.db, character.id, {
                manual: true,
                notifyPrivate: true,
                userId: req.user.id
            });
            if (!result.success) {
                return res.status(400).json({ success: false, error: result.reason || '房租结算失败' });
            }
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const wsClients = getWsClients(req.user.id);
            wsClients?.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'refresh_contacts' }));
                    client.send(JSON.stringify({ type: 'city_update', action: 'rent-settled', character_id: character.id }));
                }
            });
            res.json({
                success: true,
                result,
                characters: redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters()))
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.post('/api/social-housing/characters/:id/recommend-home', authMiddleware, async (req, res) => {
        try {
            const homeId = String(req.body?.home_id || req.body?.housing_id || '').trim();
            if (!homeId) {
                return res.status(400).json({ success: false, error: '缺少推荐房源' });
            }
            const result = await rentalChainService.recommendHomeToCharacter({
                db: req.db,
                userId: req.user.id,
                characterId: req.params.id,
                homeId,
                agencyAdId: Number(req.body?.agency_ad_id || 0),
                runFullChain: req.body?.run_full_chain !== false
            });
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const cityDb = ensureCityDb(req.db);
            const wsClients = getWsClients(req.user.id);
            wsClients?.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'refresh_contacts' }));
                    client.send(JSON.stringify({ type: 'city_update', action: 'social-housing-rental-chain', character_id: req.params.id }));
                }
            });
            const rentalChains = socialHousingDb.getRentalChains ? socialHousingDb.getRentalChains(20) : [];
            res.json({
                success: true,
                outcome: result.outcome,
                chain: result.chain,
                chain_events: socialHousingDb.getRentalChainEvents ? socialHousingDb.getRentalChainEvents(result.chain?.id) : [],
                characters: redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters())),
                rental_chains: rentalChains,
                rental_chain_events: getRentalChainEventMap(socialHousingDb, rentalChains),
                agency_ads: getAgencyAdsWithPublishState(socialHousingDb, cityDb, 12)
            });
        } catch (e) {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const status = Number(e.status || e.statusCode || 500);
            const rentalChains = socialHousingDb.getRentalChains ? socialHousingDb.getRentalChains(20) : [];
            res.status(status >= 400 && status < 600 ? status : 500).json({
                success: false,
                error: e.message || '租房链路失败，请重试',
                can_retry: e.canRetry !== false,
                chain: e.chain || null,
                rental_chains: rentalChains,
                rental_chain_events: getRentalChainEventMap(socialHousingDb, rentalChains)
            });
        }
    });

    app.post('/api/social-housing/characters/:id/assign-home', authMiddleware, async (req, res) => {
        try {
            const homeId = String(req.body?.home_id || req.body?.housing_id || '').trim();
            if (!homeId) {
                return res.status(400).json({ success: false, error: '缺少指派房源' });
            }
            const result = await rentalChainService.assignHomeToCharacter({
                db: req.db,
                userId: req.user.id,
                characterId: req.params.id,
                homeId
            });
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const wsClients = getWsClients(req.user.id);
            wsClients?.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'refresh_contacts' }));
                    client.send(JSON.stringify({ type: 'city_update', action: 'social-housing-assigned', character_id: req.params.id }));
                }
            });
            res.json({
                success: true,
                ...result,
                characters: result.characters || redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters()))
            });
        } catch (e) {
            const status = Number(e.status || e.statusCode || 500);
            res.status(status >= 400 && status < 600 ? status : 500).json({
                success: false,
                error: e.message || '指派住房失败，请重试',
                can_retry: e.canRetry !== false
            });
        }
    });

    app.post('/api/social-housing/agency', authMiddleware, (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const current = socialHousingDb.getAgencyConfig();
            const payload = normalizeAgencyConfigPayload({
                ...current,
                ...preserveAgencySecretPatch(req.body || {}, current)
            }, current);
            const saved = socialHousingDb.saveAgencyConfig(payload);
            res.json({ success: true, agency: redactAgencyConfig(saved) });
        } catch (e) {
            sendSocialHousingError(res, e);
        }
    });

    app.post('/api/social-housing/agency/publish-ad', authMiddleware, async (req, res) => {
        try {
            const ad = await publishAgencyAdForDb(req.db, 'manual');
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const wsClients = getWsClients(req.user.id);
            wsClients?.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'city_update', action: 'social-housing-ad', message: ad.content }));
                }
            });
            res.json({
                success: true,
                ad,
                agency: redactAgencyConfig(socialHousingDb.getAgencyConfig()),
                agency_ads: getAgencyAdsWithPublishState(socialHousingDb, ensureCityDb(req.db), 12)
            });
        } catch (e) {
            try {
                const socialHousingDb = ensureSocialHousingDb(req.db);
                const current = socialHousingDb.getAgencyConfig();
                socialHousingDb.saveAgencyConfig({
                    ...current,
                    last_error: String(e.message || '中介所 AI 执行失败'),
                    last_error_at: Date.now()
                });
            } catch (_) { /* ignore */ }
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.post('/api/social-housing/agency/room-assembly', authMiddleware, async (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const config = socialHousingDb.getAgencyConfig();
            const aiChar = resolveAgencyAiChar(req.db, config);
            const assembly = await generateAgencyRoomAssembly({
                callLLM,
                db: req.db,
                config,
                aiChar,
                home: req.body?.home || {},
                palette: req.body?.palette || {},
                furniture: req.body?.furniture || [],
                budget: req.body?.budget || 0,
                room: req.body?.room || {}
            });
            res.json({
                success: true,
                assembly,
                agency: redactAgencyConfig(socialHousingDb.getAgencyConfig())
            });
        } catch (e) {
            try {
                const socialHousingDb = ensureSocialHousingDb(req.db);
                const current = socialHousingDb.getAgencyConfig();
                socialHousingDb.saveAgencyConfig({
                    ...current,
                    last_error: String(e.message || '房间组装 AI 执行失败'),
                    last_error_at: Date.now()
                });
            } catch (_) { /* ignore */ }
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.delete('/api/social-housing/agency/ads/:id', authMiddleware, (req, res) => {
        try {
            const socialHousingDb = ensureSocialHousingDb(req.db);
            const cityDb = ensureCityDb(req.db);
            const ad = socialHousingDb.getAgencyAdById(req.params.id);
            if (!ad) {
                return res.status(404).json({ success: false, error: '中介广告记录不存在' });
            }

            const deleted = socialHousingDb.deleteAgencyAd(req.params.id);
            if (!deleted) {
                return res.status(404).json({ success: false, error: '中介广告记录不存在' });
            }
            removeAgencyArtifacts(cityDb, ad.title, ad.content);
            res.json({
                success: true,
                agency_ads: getAgencyAdsWithPublishState(socialHousingDb, cityDb, 12)
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    setInterval(async () => {
        const users = typeof authDb.getAllUsers === 'function'
            ? filterAutomationUsers(authDb.getAllUsers(), Date.now())
            : [];
        for (const user of users) {
            try {
                const db = getUserDb(user.id);
                const socialHousingDb = ensureSocialHousingDb(db);
                const config = socialHousingDb.getAgencyConfig();
                if (Number(config.enabled || 0) !== 1 || Number(config.ad_enabled || 0) !== 1) continue;

                const now = Date.now();
                const intervalMinutes = normalizeAgencyIntervalMinutes(config.decision_interval_hours);
                if (Number(config.next_ad_at || 0) <= 0) {
                    socialHousingDb.saveAgencyConfig({
                        ...config,
                        ad_min_interval_minutes: intervalMinutes,
                        ad_max_interval_minutes: intervalMinutes,
                        next_ad_at: now + intervalMinutes * 60 * 1000
                    });
                    continue;
                }
                if (Number(config.next_ad_at || 0) > now) continue;

                await publishAgencyAdForDb(db, 'auto');
                const wsClients = getWsClients(user.id);
                wsClients?.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ type: 'city_update', action: 'social-housing-ad' }));
                    }
                });
            } catch (e) {
                try {
                    const db = getUserDb(user.id);
                    const socialHousingDb = ensureSocialHousingDb(db);
                    const current = socialHousingDb.getAgencyConfig();
                    socialHousingDb.saveAgencyConfig({
                        ...current,
                        last_error: String(e.message || '中介所 AI 自动执行失败'),
                        last_error_at: Date.now()
                    });
                } catch (_) { /* ignore */ }
            }
        }
    }, AUTO_TICK_MS);

    setInterval(async () => {
        const users = typeof authDb.getAllUsers === 'function'
            ? filterAutomationUsers(authDb.getAllUsers(), Date.now())
            : [];
        for (const user of users) {
            try {
                const db = getUserDb(user.id);
                const results = await settleDueRentsForDb(db, { userId: user.id });
                if (!results.some((item) => item?.success)) continue;
                const wsClients = getWsClients(user.id);
                wsClients?.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ type: 'refresh_contacts' }));
                        client.send(JSON.stringify({ type: 'city_update', action: 'rent-settled' }));
                    }
                });
            } catch (e) {
                console.warn('[SocialHousing] rent settlement failed:', e.message);
            }
        }
    }, RENT_TICK_MS);
};
