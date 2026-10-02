// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
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

function normalizeRentModelConfig(character = {}) {
    const endpoint = dependencies.compactText(character.api_endpoint);
    const key = dependencies.compactText(character.api_key);
    const model = dependencies.compactText(character.model_name);
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

function getRentEventTimeFacts(now = Date.now()) {
    const parts = {};
    for (const part of new Intl.DateTimeFormat('zh-CN', {
        timeZone: dependencies.RENT_EVENT_TIMEZONE,
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
        timezone: dependencies.RENT_EVENT_TIMEZONE,
        date: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: parts.weekday || '',
        time: `${parts.hour || '00'}:${parts.minute || '00'}`
    };
}

function getRentWeekdayKey(label = '') {
    const match = String(label || '').match(dependencies.RENT_WEEKDAY_KEY_RE);
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
    const text = dependencies.compactText(parsed?.[field]);
    if (!text) {
        throw new Error(`${label} 输出缺少 ${field}，请重试。`);
    }
    return text;
}

function parseRentCityLogOutput(raw) {
    try {
        return dependencies.parseLooseAgencyJsonText(raw);
    } catch (error) {
        const text = dependencies.unwrapAgencyJsonText(raw);
        const keyMatch = text.match(/["']city_log["']\s*:\s*["']/);
        if (!keyMatch) throw error;
        const start = (keyMatch.index || 0) + keyMatch[0].length;
        const tail = text.slice(start);
        const closeBraceIndex = tail.lastIndexOf('}');
        const valuePortion = closeBraceIndex >= 0 ? tail.slice(0, closeBraceIndex) : tail;
        const quoteIndex = Math.max(valuePortion.lastIndexOf('"'), valuePortion.lastIndexOf("'"));
        const recovered = dependencies.compactText((quoteIndex >= 0 ? valuePortion.slice(0, quoteIndex) : valuePortion)
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\'));
        if (!recovered) throw error;
        return { city_log: recovered };
    }
}

function assertRentCityLogMatchesFacts(text, facts = {}) {
    const content = dependencies.compactText(text);
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

    return { getRentalChainEventMap, normalizeRentModelConfig, summarizeRentCharacter, summarizeRentHome, getRentEventTimeFacts, getRentWeekdayKey, findRentWeekdayMentions, buildRentCollectionFacts, requireRentTextField, parseRentCityLogOutput, assertRentCityLogMatchesFacts };
}

module.exports = { createModule };
