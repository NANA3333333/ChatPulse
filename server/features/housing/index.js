const initSocialHousingDb = require("./db.js");
const initCityDb = require("../city/cityDb.js");
const { buildUniversalContext } = require("../conversation-context/index.js");
const { createRentalChainService } = require("./rentalChainService.js");
const {
    isSocialHousingValidationError,
    normalizeAgencyConfigPayload,
    normalizeAgencyIntervalMinutes,
    normalizeHousingBindingPayload,
    normalizeHousingPayload,
    normalizeSocialClassPayload
} = require("./inputGuards.js");
const { filterAutomationUsers } = require("../../platform/jobs/automationActivity.js");

const AUTO_TICK_MS = 60 * 1000;
const RENT_TICK_MS = 60 * 1000;

const { compactText, sendSocialHousingError, looksLikePriceText, maskSecretLast4, redactSocialHousingCharacterSecrets, clampNumber } = require("./services/validation.js").createModule({
        get isSocialHousingValidationError() { return isSocialHousingValidationError; }
    });

const { buildAgencyAdKey, unwrapAgencyJsonText, parseLooseAgencyJsonText, getAgencyModelOptions, resolveAgencyAiChar, redactAgencyConfig, preserveAgencySecretPatch, removeAgencyArtifacts, cleanupOrphanAgencyArtifacts, getPublicAgencyAnnouncements, getAgencyAdsWithPublishState, doesAgencyAdReferenceHome, removeAgencyArtifactsForHome, recordAgencyDebug, buildAgencySnapshot, generateAgencyAd } = require("./services/agency.js").createModule({
        get compactText() { return compactText; },
        get looksLikePriceText() { return looksLikePriceText; },
        get maskSecretLast4() { return maskSecretLast4; }
    });

const { getRentalChainEventMap, normalizeRentModelConfig, summarizeRentCharacter, summarizeRentHome, getRentEventTimeFacts, getRentWeekdayKey, findRentWeekdayMentions, buildRentCollectionFacts, requireRentTextField, parseRentCityLogOutput, assertRentCityLogMatchesFacts } = require("./services/rent.js").createModule({
        get RENT_EVENT_TIMEZONE() { return RENT_EVENT_TIMEZONE; },
        get RENT_WEEKDAY_KEY_RE() { return RENT_WEEKDAY_KEY_RE; },
        get compactText() { return compactText; },
        get parseLooseAgencyJsonText() { return parseLooseAgencyJsonText; },
        get unwrapAgencyJsonText() { return unwrapAgencyJsonText; }
    });

const RENT_EVENT_TIMEZONE = 'Asia/Shanghai';
const RENT_WEEKDAY_KEY_RE = /^(?:星期|周|礼拜)([一二三四五六日天])$/;

const ROOM_ASSEMBLY_ALLOWED_ITEMS = new Set(['bed', 'nightstand', 'wardrobe', 'vanity', 'bookshelf', 'sofa', 'rug', 'floorLamp', 'wallArt']);
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

const { scrubRoomAssemblyPromptText, normalizeRoomAssemblyItem, normalizeRoomAssemblyDirection, normalizeRoomAssemblyGridValue, normalizeRoomAssemblyAssetId, normalizeRoomAssemblyBudget, normalizeRoomAssemblyShopItem, getRoomAssemblyBaseAssetId, findRoomAssemblyShopItemByAssetId, findCheapestRoomAssemblyShopItem, normalizeAgencyRoomAssemblyOutput, generateAgencyRoomAssembly } = require("./services/roomAssembly.js").createModule({
        get ROOM_ASSEMBLY_ALLOWED_DIRECTIONS() { return ROOM_ASSEMBLY_ALLOWED_DIRECTIONS; },
        get ROOM_ASSEMBLY_ALLOWED_ITEMS() { return ROOM_ASSEMBLY_ALLOWED_ITEMS; },
        get ROOM_ASSEMBLY_ASCII() { return ROOM_ASSEMBLY_ASCII; },
        get ROOM_ASSEMBLY_DIRECTION_ALIASES() { return ROOM_ASSEMBLY_DIRECTION_ALIASES; },
        get ROOM_ASSEMBLY_ITEM_ALIASES() { return ROOM_ASSEMBLY_ITEM_ALIASES; },
        get clampNumber() { return clampNumber; },
        get compactText() { return compactText; },
        get parseLooseAgencyJsonText() { return parseLooseAgencyJsonText; },
        get recordAgencyDebug() { return recordAgencyDebug; }
    });

module.exports = function initSocialHousingPlugin(app, context) {
    const { authMiddleware, authDb, getUserDb, getWsClients, getEngine, getMemory, callLLM } = context;
    const rentSettlementLocks = new Set();

    const { ensureSocialHousingDb, getRentSettlementLockKey, publishAgencyAdForDb, generateRentCityLog, triggerRentPrivateReply, settleCharacterRent, settleCharacterRentUnlocked, settleDueRentsForDb } = require("./runtime/housing.js").createModule({
        get assertRentCityLogMatchesFacts() { return assertRentCityLogMatchesFacts; },
        get buildAgencySnapshot() { return buildAgencySnapshot; },
        get buildRentCollectionFacts() { return buildRentCollectionFacts; },
        get buildUniversalContext() { return buildUniversalContext; },
        get callLLM() { return callLLM; },
        get ensureCityDb() { return ensureCityDb; },
        get generateAgencyAd() { return generateAgencyAd; },
        get getEngine() { return getEngine; },
        get getMemory() { return getMemory; },
        get getUserDb() { return getUserDb; },
        get getWsClients() { return getWsClients; },
        get initSocialHousingDb() { return initSocialHousingDb; },
        get normalizeAgencyIntervalMinutes() { return normalizeAgencyIntervalMinutes; },
        get normalizeRentModelConfig() { return normalizeRentModelConfig; },
        get parseRentCityLogOutput() { return parseRentCityLogOutput; },
        get recordAgencyDebug() { return recordAgencyDebug; },
        get rentSettlementLocks() { return rentSettlementLocks; },
        get requireRentTextField() { return requireRentTextField; },
        get resolveAgencyAiChar() { return resolveAgencyAiChar; }
    });

    const { ensureCityDb } = require("./runtime/validation.js").createModule({
        get initCityDb() { return initCityDb; }
    });

    

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

    require("./http/get-social-housing-bootstrap.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get cleanupOrphanAgencyArtifacts() { return cleanupOrphanAgencyArtifacts; }, get ensureCityDb() { return ensureCityDb; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get getAgencyAdsWithPublishState() { return getAgencyAdsWithPublishState; }, get getAgencyModelOptions() { return getAgencyModelOptions; }, get getPublicAgencyAnnouncements() { return getPublicAgencyAnnouncements; }, get getRentalChainEventMap() { return getRentalChainEventMap; }, get redactAgencyConfig() { return redactAgencyConfig; }, get redactSocialHousingCharacterSecrets() { return redactSocialHousingCharacterSecrets; } });

    require("./http/post-social-housing-classes.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get normalizeSocialClassPayload() { return normalizeSocialClassPayload; }, get sendSocialHousingError() { return sendSocialHousingError; } });

    require("./http/delete-social-housing-classes-id.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; } });

    require("./http/post-social-housing-housing.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get normalizeHousingPayload() { return normalizeHousingPayload; }, get sendSocialHousingError() { return sendSocialHousingError; } });

    require("./http/delete-social-housing-housing-id.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureCityDb() { return ensureCityDb; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get getAgencyAdsWithPublishState() { return getAgencyAdsWithPublishState; }, get removeAgencyArtifactsForHome() { return removeAgencyArtifactsForHome; } });

    require("./http/post-social-housing-characters-id-binding.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get normalizeHousingBindingPayload() { return normalizeHousingBindingPayload; }, get redactSocialHousingCharacterSecrets() { return redactSocialHousingCharacterSecrets; }, get sendSocialHousingError() { return sendSocialHousingError; } });

    require("./http/post-social-housing-characters-id-pay-rent.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get getWsClients() { return getWsClients; }, get redactSocialHousingCharacterSecrets() { return redactSocialHousingCharacterSecrets; }, get settleCharacterRent() { return settleCharacterRent; } });

    require("./http/post-social-housing-characters-id-recommend-home.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureCityDb() { return ensureCityDb; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get getAgencyAdsWithPublishState() { return getAgencyAdsWithPublishState; }, get getRentalChainEventMap() { return getRentalChainEventMap; }, get getWsClients() { return getWsClients; }, get redactSocialHousingCharacterSecrets() { return redactSocialHousingCharacterSecrets; }, get rentalChainService() { return rentalChainService; } });

    require("./http/post-social-housing-characters-id-assign-home.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get getWsClients() { return getWsClients; }, get redactSocialHousingCharacterSecrets() { return redactSocialHousingCharacterSecrets; }, get rentalChainService() { return rentalChainService; } });

    require("./http/post-social-housing-agency.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get normalizeAgencyConfigPayload() { return normalizeAgencyConfigPayload; }, get preserveAgencySecretPatch() { return preserveAgencySecretPatch; }, get redactAgencyConfig() { return redactAgencyConfig; }, get sendSocialHousingError() { return sendSocialHousingError; } });

    require("./http/post-social-housing-agency-publish-ad.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureCityDb() { return ensureCityDb; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get getAgencyAdsWithPublishState() { return getAgencyAdsWithPublishState; }, get getWsClients() { return getWsClients; }, get publishAgencyAdForDb() { return publishAgencyAdForDb; }, get redactAgencyConfig() { return redactAgencyConfig; } });

    require("./http/post-social-housing-agency-room-assembly.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get callLLM() { return callLLM; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get generateAgencyRoomAssembly() { return generateAgencyRoomAssembly; }, get redactAgencyConfig() { return redactAgencyConfig; }, get resolveAgencyAiChar() { return resolveAgencyAiChar; } });

    require("./http/delete-social-housing-agency-ads-id.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureCityDb() { return ensureCityDb; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get getAgencyAdsWithPublishState() { return getAgencyAdsWithPublishState; }, get removeAgencyArtifacts() { return removeAgencyArtifacts; } });

    context.jobs.interval(require("./runtime/tick1.js").createTick({ get authDb() { return authDb; }, get ensureSocialHousingDb() { return ensureSocialHousingDb; }, get filterAutomationUsers() { return filterAutomationUsers; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizeAgencyIntervalMinutes() { return normalizeAgencyIntervalMinutes; }, get publishAgencyAdForDb() { return publishAgencyAdForDb; } }), AUTO_TICK_MS);

    context.jobs.interval(require("./runtime/tick2.js").createTick({ get authDb() { return authDb; }, get filterAutomationUsers() { return filterAutomationUsers; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get settleDueRentsForDb() { return settleDueRentsForDb; } }), RENT_TICK_MS);
};
