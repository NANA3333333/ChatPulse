/**
 * server/contextBuilder.js
    * 
 * Provides a unified Universal Context(Preamble) for all AI interactions.
 * This guarantees that whether the AI is replying in private chat, group chat,
 * the City DLC, or scheduled memory aggregation, it has the exact same baseline
    * awareness of the world state, its own recent actions, and related memories.
 */

const { getTokenCount } = require("../../platform/llm/tokenizer.js");
const { getAdaptiveTailWindowSize } = require("./window.js");
const { getLocalDateTimeFacts } = require("../../platform/time/facts.js");
const { getEmotionFeelingGuidance, getPhysicalFeelingGuidance } = require("../characters/emotion.js");
const initSocialHousingDb = require("../housing/db.js");
const { buildHousingPromptBlock, getHousingRuntimeContext } = require("../housing/housingEffects.js");
const crypto = require('crypto');
const { callLLM } = require("../../platform/llm/client.js");
const { SHARED_CONTEXT_GUIDANCE, TIME_CONTEXT_GUIDANCE, CITY_REFERENCE_GUIDANCE, GROUP_REFERENCE_GUIDANCE } = require("./guidance.js");

const CONTEXT_ROUTER_MAX_TOKENS = 8000;

const { previewText, parseMetadataObject, getCachedContextBlock, buildBasePrivateContextWindow, compactLine } = require("./context/helpers.js").createModule({
        get crypto() { return crypto; }
    });

const { compactAntiRepeatText, pushUniqueAntiRepeat, buildTypedAntiRepeatHints, flattenTypedAntiRepeatHints, formatTypedAntiRepeatBlock } = require("./context/antiRepeat.js").createModule({
        get parseMetadataObject() { return parseMetadataObject; }
    });

const { recordContextRouteDebug, parseModuleRouteJson, isValidModuleRoutePayload, buildRecentPrivateRouteContext, routeContextModules } = require("./context/routing.js").createModule({
        get CONTEXT_ROUTER_MAX_TOKENS() { return CONTEXT_ROUTER_MAX_TOKENS; },
        get buildRecentCityRouteContext() { return buildRecentCityRouteContext; },
        get callLLM() { return callLLM; },
        get previewText() { return previewText; }
    });

const { getRelationshipAnchorSourceParts, buildRelationshipAnchorContext } = require("../relationships/context/helpers.js").createModule({
        
    });

const { didUserAskAboutCity, formatOtherCityLogForContext, buildCitySceneChatGuidance, buildAvailableCityDistrictSignalGuide, ensureContextCityDb, getInventoryContextSourceParts, formatInventoryContextItem, buildInventoryContextBlock } = require("../city/context/helpers.js").createModule({
        get CONTEXT_ROUTER_MAX_TOKENS() { return CONTEXT_ROUTER_MAX_TOKENS; },
        get callLLM() { return callLLM; },
        get previewText() { return previewText; },
        get recordContextRouteDebug() { return recordContextRouteDebug; }
    });

const { buildRecentCityRouteContext } = require("../city/context/routing.js").createModule({
        
    });

const { getPhysicalCondition, getEnergyHint, getSleepDebtHint, getHealthHint, getSatietyHint, getStomachLoadHint, getPressureHint, buildCompactEmotionImpact, buildCompactPhysicalFeeling } = require("../characters/context/helpers.js").createModule({
        get compactLine() { return compactLine; }
    });

const { ensureSocialHousingDb, buildHousingContextBlock, getHousingContextSourceParts } = require("../housing/context/helpers.js").createModule({
        get buildHousingPromptBlock() { return buildHousingPromptBlock; },
        get getHousingRuntimeContext() { return getHousingRuntimeContext; },
        get initSocialHousingDb() { return initSocialHousingDb; }
    });

const { buildUniversalContext } = require("./context/build.js").createModule({
        get CITY_REFERENCE_GUIDANCE() { return CITY_REFERENCE_GUIDANCE; },
        get GROUP_REFERENCE_GUIDANCE() { return GROUP_REFERENCE_GUIDANCE; },
        get SHARED_CONTEXT_GUIDANCE() { return SHARED_CONTEXT_GUIDANCE; },
        get TIME_CONTEXT_GUIDANCE() { return TIME_CONTEXT_GUIDANCE; },
        get buildAvailableCityDistrictSignalGuide() { return buildAvailableCityDistrictSignalGuide; },
        get buildBasePrivateContextWindow() { return buildBasePrivateContextWindow; },
        get buildCitySceneChatGuidance() { return buildCitySceneChatGuidance; },
        get buildCompactEmotionImpact() { return buildCompactEmotionImpact; },
        get buildCompactPhysicalFeeling() { return buildCompactPhysicalFeeling; },
        get buildHousingContextBlock() { return buildHousingContextBlock; },
        get buildInventoryContextBlock() { return buildInventoryContextBlock; },
        get buildRelationshipAnchorContext() { return buildRelationshipAnchorContext; },
        get buildTypedAntiRepeatHints() { return buildTypedAntiRepeatHints; },
        get compactLine() { return compactLine; },
        get formatOtherCityLogForContext() { return formatOtherCityLogForContext; },
        get getAdaptiveTailWindowSize() { return getAdaptiveTailWindowSize; },
        get getCachedContextBlock() { return getCachedContextBlock; },
        get getEmotionFeelingGuidance() { return getEmotionFeelingGuidance; },
        get getEnergyHint() { return getEnergyHint; },
        get getHealthHint() { return getHealthHint; },
        get getHousingContextSourceParts() { return getHousingContextSourceParts; },
        get getInventoryContextSourceParts() { return getInventoryContextSourceParts; },
        get getLocalDateTimeFacts() { return getLocalDateTimeFacts; },
        get getPhysicalCondition() { return getPhysicalCondition; },
        get getPhysicalFeelingGuidance() { return getPhysicalFeelingGuidance; },
        get getRelationshipAnchorSourceParts() { return getRelationshipAnchorSourceParts; },
        get getSatietyHint() { return getSatietyHint; },
        get getSleepDebtHint() { return getSleepDebtHint; },
        get getStomachLoadHint() { return getStomachLoadHint; },
        get getTokenCount() { return getTokenCount; },
        get routeContextModules() { return routeContextModules; }
    });

module.exports = {
    buildUniversalContext,
    buildTypedAntiRepeatHints,
    formatTypedAntiRepeatBlock,
};


