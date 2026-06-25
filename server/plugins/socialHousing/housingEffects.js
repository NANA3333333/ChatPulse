const initSocialHousingDb = require('./db');

function clamp(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, parsed));
}

function ensureSocialHousingDb(db) {
    if (!db) return null;
    if (!db.socialHousing) {
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : db;
        db.socialHousing = initSocialHousingDb(rawDb);
    }
    return db.socialHousing;
}

function getHousingRuntimeContext(db, characterOrId) {
    const characterId = typeof characterOrId === 'string'
        ? characterOrId
        : String(characterOrId?.id || '').trim();
    const socialHousingDb = ensureSocialHousingDb(db);
    const context = characterId && socialHousingDb?.getHousingContextForCharacter
        ? socialHousingDb.getHousingContextForCharacter(characterId)
        : null;
    const binding = context?.binding || null;
    const home = context?.housing || null;
    const hasHousing = !!(binding?.housing_id && home);
    const rawStatus = hasHousing ? String(binding.housing_status || 'stable').trim() || 'stable' : 'homeless';
    const status = hasHousing ? rawStatus : 'homeless';
    const comfort = hasHousing ? clamp(home.comfort || 0, 0, 100) : 0;
    const prestige = hasHousing ? clamp(home.prestige || 0, 0, 100) : 0;
    const privacy = hasHousing ? clamp(home.privacy || 0, 0, 100) : 0;
    const missedRentCount = clamp(binding?.missed_rent_count || 0, 0, 365);

    return {
        hasHousing,
        status,
        binding,
        home,
        socialClass: context?.social_class || null,
        comfort,
        prestige,
        privacy,
        missedRentCount,
        label: hasHousing ? getHousingStatusLabel(status) : '无固定住所'
    };
}

function getHousingStatusLabel(status) {
    const labels = {
        homeless: '无固定住所',
        stable: '稳定居住',
        temporary: '临时落脚',
        unstable: '居住不稳',
        overdue: '租金拖欠'
    };
    return labels[String(status || '').trim()] || String(status || '未知');
}

function scaleDelta(delta, multiplier) {
    if (!delta) return 0;
    const scaled = Number(delta) * Number(multiplier || 1);
    if (delta < 0) return Math.min(-1, Math.round(scaled));
    if (delta > 0) return Math.max(1, Math.round(scaled));
    return 0;
}

function applyHousingDistrictEffects(db, character, district, effects = {}) {
    const ctx = getHousingRuntimeContext(db, character);
    const next = { ...effects };
    const districtType = String(district?.type || '').trim();
    const isRest = districtType === 'rest' || String(district?.id || '').trim() === 'home';

    if (!isRest) {
        if (!ctx.hasHousing) {
            next.stress = Number(next.stress || 0) + 1;
        } else if (ctx.status === 'overdue') {
            next.stress = Number(next.stress || 0) + 2;
        }
        return next;
    }

    if (!ctx.hasHousing) {
        next.energy = scaleDelta(next.energy || 0, 0.55);
        next.sleep_debt = scaleDelta(next.sleep_debt || 0, 0.35);
        next.stress = Number(next.stress || 0) + 4;
        next.mood = Number(next.mood || 0) - 2;
        next.health = Number(next.health || 0) - 1;
        return next;
    }

    const comfortBoost = 1 + Math.min(0.35, ctx.comfort / 160);
    const privacyBoost = 1 + Math.min(0.28, ctx.privacy / 180);
    const stabilityPenalty = ctx.status === 'temporary'
        ? 0.82
        : ctx.status === 'unstable'
            ? 0.72
            : ctx.status === 'overdue'
                ? 0.66
                : 1;
    next.energy = scaleDelta(next.energy || 0, comfortBoost * stabilityPenalty);
    next.sleep_debt = scaleDelta(next.sleep_debt || 0, comfortBoost * stabilityPenalty);
    next.stress = scaleDelta(next.stress || 0, privacyBoost * stabilityPenalty);
    if (ctx.status === 'overdue') {
        next.stress = Number(next.stress || 0) + 3 + Math.min(4, ctx.missedRentCount);
        next.mood = Number(next.mood || 0) - 2;
    } else if (ctx.status === 'stable') {
        next.mood = Number(next.mood || 0) + (ctx.comfort >= 25 ? 2 : 1);
        next.health = Number(next.health || 0) + (ctx.comfort >= 30 ? 1 : 0);
    }
    return next;
}

function getHousingPassiveMinutePatch(ctx, { isSleeping = false, atHome = false, minuteMark = 0 } = {}) {
    const patch = { energy: 0, sleep_debt: 0, stress: 0, health: 0, mood: 0, social_need: 0 };
    const slowTick = minuteMark % 10 === 0;
    const mediumTick = minuteMark % 5 === 0;
    if (!ctx?.hasHousing) {
        if (slowTick) {
            patch.stress += 1;
            patch.social_need += 1;
            if (isSleeping) patch.sleep_debt += 1;
        }
        if (isSleeping && mediumTick) patch.energy -= 1;
        return patch;
    }

    const hasRealRestScene = isSleeping || atHome;
    if (!hasRealRestScene) {
        if (ctx.status === 'overdue' && slowTick) patch.stress += 1;
        return patch;
    }

    const comfortTier = ctx.comfort >= 40 ? 2 : ctx.comfort >= 22 ? 1 : 0;
    const privacyTier = ctx.privacy >= 32 ? 2 : ctx.privacy >= 18 ? 1 : 0;
    if (isSleeping && slowTick && comfortTier > 0) patch.sleep_debt -= comfortTier;
    if (isSleeping && mediumTick && comfortTier > 0) patch.energy += 1;
    if (slowTick && privacyTier > 0 && ctx.status === 'stable') patch.stress -= privacyTier;
    if (slowTick && ctx.status === 'overdue') patch.stress += 2;
    return patch;
}

function applyNumericPatchToState(state, patch = {}) {
    const next = { ...state };
    for (const key of ['energy', 'sleep_debt', 'stress', 'health', 'mood', 'social_need']) {
        if (!patch[key]) continue;
        next[key] = clamp(Number(next[key] || 0) + Number(patch[key] || 0), 0, 100);
    }
    return next;
}

function formatHousingDate(timestamp) {
    const date = new Date(Number(timestamp || 0));
    if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return '某日';
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function buildHomeBasicInfo(home = {}, rent = 0) {
    const parts = [];
    const description = String(home.description || '').trim().replace(/[。；;,\s]+$/g, '');
    const deposit = Number(home.deposit || 0);
    const salePrice = Number(home.sale_price || 0);
    if (description) parts.push(description.replace(/\s+/g, ' '));
    if (rent > 0) parts.push(`周租 ${rent} 金币`);
    if (deposit > 0) parts.push(`押金 ${deposit} 金币`);
    if (salePrice > 0) parts.push(`可买断价 ${salePrice} 金币`);
    return parts.join('；');
}

function buildHousingPromptBlock(db, character) {
    const ctx = getHousingRuntimeContext(db, character);
    if (!ctx.hasHousing) {
        return [
            '[住房状态]',
            '- 当前住房状态：无固定住所。',
            '- 这是默认持续状态，不是一次偶发事件；只有租到房、买到房或用户明确分配住房后才会解除。',
            '- 叙事边界：不要描写“自己的房子、自己的床、自己的卧室、出租屋里”等既有住所；需要休息时只能写成临时落脚、街头、公共空间、店里角落、借住或其他没有稳定住房的人能做的事。',
            '- 数值影响：休息恢复更差，压力更容易上升。'
        ].join('\n');
    }

    const rent = Number(ctx.binding?.rent_weekly || ctx.home?.weekly_rent || 0);
    const dueAt = Number(ctx.binding?.rent_due_at || 0);
    const dueText = dueAt > 0 ? new Date(dueAt).toLocaleString('zh-CN') : '未设置';
    const startedAt = Number(ctx.binding?.housing_started_at || ctx.binding?.rent_last_paid_at || 0);
    const startedText = formatHousingDate(startedAt);
    const homeLabel = `${ctx.home?.emoji || ''}${ctx.home?.name || ctx.home?.id || '住所'}`;
    const housingFact = rent > 0
        ? `你在 ${startedText} 签订租房协议，现在住在 ${homeLabel}。`
        : `你在 ${startedText} 获得住房安排，现在住在 ${homeLabel}。`;
    const homeBasicInfo = buildHomeBasicInfo(ctx.home, rent);
    const lines = [
        '[住房状态]',
        `- 当前住房事实：${housingFact}`,
        `- 当前住房：${homeLabel}。`,
        ...(homeBasicInfo ? [`- 房间基本信息：${homeBasicInfo}。`] : []),
        `- 居住状态：${ctx.label}。`,
        '- 归属边界：这是你这个角色自己的当前住所，不是用户自己的租房计划；用户问“你租到房了吗/你住哪”时，要按这个住房事实回答。',
        `- 住所数值：舒适度 ${ctx.comfort} / 体面感 ${ctx.prestige} / 隐私感 ${ctx.privacy}。`,
        `- 数值影响：稳定住房会改善休息、睡眠债恢复和压力下降；舒适/隐私越高，恢复越明显。`
    ];
    if (rent > 0) {
        lines.push(`- 房租压力：周租 ${rent} 金币；下次催租 ${dueText}；已拖欠 ${ctx.missedRentCount} 次。`);
    }
    if (ctx.status === 'overdue') {
        lines.push('- 租金拖欠是真实压力，会压低心情并提高压力。');
    }
    return lines.join('\n');
}

module.exports = {
    ensureSocialHousingDb,
    getHousingRuntimeContext,
    getHousingStatusLabel,
    getHousingPassiveMinutePatch,
    applyHousingDistrictEffects,
    applyNumericPatchToState,
    buildHousingPromptBlock
};
