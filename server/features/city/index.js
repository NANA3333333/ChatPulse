const crypto = require('crypto');
const initCityDb = require("./cityDb.js");
const { createActionService } = require("./services/actionService.js");
const { createMayorService } = require("./services/mayorService.js");
const { createMayorRuntimeService } = require("./services/mayorRuntimeService.js");
const { createQuestService } = require("./services/questService.js");
const { createSocialService } = require("./services/socialService.js");
const { createAdminGrantService } = require("./services/adminGrantService.js");
const { registerCoreCityRoutes } = require("./routes/coreRoutes.js");
const { registerEventQuestRoutes } = require("./routes/eventQuestRoutes.js");
const {
    normalizeCityCatalogItemPayload,
    normalizeCityConfigValue,
    normalizeCityDistrictPayload
} = require("./utils/inputGuards.js");
const { parseCityActionNarrations, sanitizeCityNarrationText } = require("./utils/actionNarrationParser.js");
const mcpLabTools = require("../web-tools/index.js");
const { enqueueBackgroundTask } = require("../../platform/jobs/backgroundQueue.js");
const { buildUniversalContext, formatTypedAntiRepeatBlock } = require("../conversation-context/index.js");
const { buildHousingPromptBlock, getHousingRuntimeContext, getHousingPassiveMinutePatch, applyHousingDistrictEffects, applyNumericPatchToState } = require("../housing/housingEffects.js");
const { deriveEmotion, derivePhysicalState, applyEmotionEvent, getEmotionBehaviorGuidance, buildEmotionLogEntry } = require("../characters/emotion.js");
const { buildOpenAiCompatibleUrlResolved } = require("../../platform/http/guards.js");
const { filterAutomationUsers } = require("../../platform/jobs/automationActivity.js");

// Phase 5: Social encounter cooldown - prevents same pair from chatting every tick
const socialCooldowns = new Map(); // key: "charA_id::charB_id" -> timestamp
const CITY_BACKGROUND_SAFE_MODE = process.env.CP_SAFE_MODE !== '0';
const CITY_LIGHT_TICK_MODE = process.env.CP_CITY_LIGHT_TICK !== '0';
const CITY_ENABLE_AUTONOMOUS_ACTIONS = process.env.CP_CITY_ACTIONS !== '0';
const CITY_ENABLE_SCHEDULE_GENERATION = process.env.CP_CITY_SCHEDULES !== '0';
const CITY_ENABLE_SOCIAL_COLLISIONS = process.env.CP_CITY_SOCIAL !== '0';
const MEDICAL_RECOVERY_INTERVAL_MINUTES = 5;
const MEDICAL_STAY_MINUTES_PER_TICK = 60;
const MEDICAL_ADMISSION_HEALTH_FLOOR = 60;
const MEDICAL_ADMISSION_ENERGY_FLOOR = 40;
const MEDICAL_ADMISSION_SLEEP_DEBT_CEILING = 45;
const MEDICAL_ADMISSION_STRESS_CEILING = 40;
const EMERGENCY_HOSPITAL_FEE = 50;
const EMERGENCY_HUNGER_CALORIES = 300;
const EMERGENCY_EXHAUSTION_ENERGY = 20;
const EMERGENCY_SLEEP_DEBT = 75;
const EMERGENCY_CRITICAL_ENERGY = 10;
const EMERGENCY_CRITICAL_SLEEP_DEBT = 90;
const EMERGENCY_STABILIZE_CALORIES = 300;
const BEHAVIOR_CONTEXT_DEFAULT_Q = 8;
const BEHAVIOR_CONTEXT_DEFAULT_P = 12;
const BEHAVIOR_CONTEXT_MIN_Q = 1;
const BEHAVIOR_CONTEXT_MAX_Q = 30;
const BEHAVIOR_CONTEXT_MIN_P = 2;
const BEHAVIOR_CONTEXT_MAX_P = 50;
const BEHAVIOR_CONTEXT_MAX_SUMMARIES = 3;
const BEHAVIOR_CONTEXT_STATE_SUMMARY_LIMIT = 20;
const BEHAVIOR_CONTEXT_SUMMARY_MAX_TOKENS = 2600;

module.exports = function initCityPlugin(app, context) {
    const { getWsClients, authMiddleware, authDb, callLLM, getEngine, getMemory, getUserDb } = context;

    const { recordCityLlmDebug, getCachedCityPromptBlock, triggerHackerIntelReply, buildBusyChatImpactPatch, formatDistrictItemsForPrompt, formatInventoryItemForPrompt, buildInventoryPromptBlock, generateInventoryOrganizeNarrations, pickSettledShopItemFromNarrations, buildGamblingOutcomeNarrations, tryParseCityActionReply, runPrivateReplyDirectedCityAction, isWeakCityNarration, buildRecentNarrationAntiRepeatBlock, buildRecentPrivateChatAntiRepeatBlock, buildFreshPrivateChatTailBlock, regenerateActionNarrations, buildQuestResolutionNarrations, buildBusyPenaltyNarration, maybeExecuteReplyCityIntent, maybeExecuteReplyCityAction, maybeSyncReplyDeclaredState, buildQuestPromptContext, buildSurvivalPrompt, buildSocialPrompt, parseJsonObjectFromLlmText, fetchBehaviorModelList, resolveBehaviorSummaryModelConfig, escapeBehaviorPromptRegex, personalizeBehaviorPromptText, shouldPersonalizeBehaviorPromptKey, personalizeBehaviorPromptValue, createBehaviorBranchWithModel, createBaseBehaviorBranchesWithModel, createBehaviorInteractionStarterBranchesWithModel, getQuestNarrationText, parseMayorJsonReply, broadcastCityToChat } = require("./runtime/conversation.js").createModule({
        get actionService() { return actionService; },
        get applyDecision() { return applyDecision; },
        get behaviorPlayerInteractionActions() { return behaviorPlayerInteractionActions; },
        get behaviorPromptProtocolKeys() { return behaviorPromptProtocolKeys; },
        get behaviorTreeAllowedActions() { return behaviorTreeAllowedActions; },
        get buildCityAttemptRecorder() { return buildCityAttemptRecorder; },
        get buildHousingPromptBlock() { return buildHousingPromptBlock; },
        get buildOpenAiCompatibleUrlResolved() { return buildOpenAiCompatibleUrlResolved; },
        get buildUniversalContext() { return buildUniversalContext; },
        get callLLM() { return callLLM; },
        get clamp() { return clamp; },
        get clipQuestContextText() { return clipQuestContextText; },
        get context() { return context; },
        get createCityError() { return createCityError; },
        get crypto() { return crypto; },
        get ensureCityDb() { return ensureCityDb; },
        get findCityLogForOutreach() { return findCityLogForOutreach; },
        get findDuplicateBehaviorInteraction() { return findDuplicateBehaviorInteraction; },
        get findMissingRequiredRoomAnchorBranches() { return findMissingRequiredRoomAnchorBranches; },
        get formatInventoryDecisionRow() { return formatInventoryDecisionRow; },
        get formatTypedAntiRepeatBlock() { return formatTypedAntiRepeatBlock; },
        get getAvailableDistrictItems() { return getAvailableDistrictItems; },
        get getBehaviorBaseOutputContract() { return getBehaviorBaseOutputContract; },
        get getBehaviorInteractionStarterOutputContract() { return getBehaviorInteractionStarterOutputContract; },
        get getEmotionBehaviorGuidance() { return getEmotionBehaviorGuidance; },
        get getEngine() { return getEngine; },
        get getInventoryQuantityTotal() { return getInventoryQuantityTotal; },
        get getPhysicalCondition() { return getPhysicalCondition; },
        get getRequiredRoomAnchorBranchTargets() { return getRequiredRoomAnchorBranchTargets; },
        get getUserDb() { return getUserDb; },
        get getWsClients() { return getWsClients; },
        get inferBehaviorScene() { return inferBehaviorScene; },
        get isCollapsedCityLog() { return isCollapsedCityLog; },
        get limitText() { return limitText; },
        get logEmotionTransition() { return logEmotionTransition; },
        get mayorService() { return mayorService; },
        get normalizeSurvivalState() { return normalizeSurvivalState; },
        get parseCityActionNarrations() { return parseCityActionNarrations; },
        get questService() { return questService; },
        get repairUnescapedJsonStringQuotes() { return repairUnescapedJsonStringQuotes; },
        get resolveDistrictFromStructuredSignal() { return resolveDistrictFromStructuredSignal; },
        get sanitizeBaseBehaviorBranchPack() { return sanitizeBaseBehaviorBranchPack; },
        get sanitizeBehaviorInteractionStarterPack() { return sanitizeBehaviorInteractionStarterPack; },
        get sanitizeBehaviorTreePatch() { return sanitizeBehaviorTreePatch; },
        get sanitizeCityNarrationText() { return sanitizeCityNarrationText; }
    });

    const { recordCityTokenUsage, logEmotionTransition, logEmotionTransitionToState, slugifyCityId, inferItemCategory, getCityDate, getDistrictAliasValues, resolveStructuredTypeAlias, selectPreferredRestDistrict, buildCollapsedCityLog, isCollapsedCityLog, findCityLogForOutreach, calculateDerivedMood, getAvailableDistrictItems, getInventoryQuantityTotal, isHackerDistrict, buildCityAttemptRecorder, clipHackerIntelContent, buildHackerIntelAppendix, resolveDistrictFromStructuredSignal, getDistrictStateEffects, applyStateEffectsToCharacter, repairUnescapedJsonStringQuotes, getBehaviorTreeSkeleton, getBehaviorOutputContract, getBehaviorBaseOutputContract, getBehaviorBaseOnlyOutputContract, toAllowedBehaviorPlaceId, readBehaviorStepPlaceId, behaviorBranchHasOfferChoices, collectRecentBehaviorSpecialNodes, buildBehaviorIterationRecordsFromTree, resolveBehaviorIterationSummaryCursor, summarizeBehaviorIterationBatch, buildCompressedBehaviorTreeForInput, createBehaviorRepeatGrams, getBehaviorRepeatSimilarity, inferBaseBehaviorTargetNode, collectBehaviorStepPlaceIds, summarizeBehaviorCharacter, summarizeBehaviorCity, inferBehaviorScene, summarizeSemanticBehaviorWorld, buildBehaviorInputPackage, buildBehaviorBaseRebuildPayload, cyrb128, mulberry32, simulateCharacter, selectRandomDistrict, applyDecision, publishQuestAnnouncement, recordMayorAnnouncement, planCityWebSearchQuery, resolveMayorAiCharacter, getQuestDifficultyFallbackTarget, scoreQuestDifficultyWithMayor, scoreQuestProgressWithMayor, shouldAutoRunMayor, maybeRunMayorAI, runMayorAI, applyMayorDecisions } = require("./runtime/operations.js").createModule({
        get BEHAVIOR_CONTEXT_MAX_SUMMARIES() { return BEHAVIOR_CONTEXT_MAX_SUMMARIES; },
        get BEHAVIOR_CONTEXT_STATE_SUMMARY_LIMIT() { return BEHAVIOR_CONTEXT_STATE_SUMMARY_LIMIT; },
        get BEHAVIOR_CONTEXT_SUMMARY_MAX_TOKENS() { return BEHAVIOR_CONTEXT_SUMMARY_MAX_TOKENS; },
        get EMERGENCY_EXHAUSTION_ENERGY() { return EMERGENCY_EXHAUSTION_ENERGY; },
        get EMERGENCY_HUNGER_CALORIES() { return EMERGENCY_HUNGER_CALORIES; },
        get EMERGENCY_SLEEP_DEBT() { return EMERGENCY_SLEEP_DEBT; },
        get actionService() { return actionService; },
        get behaviorBasePatchTargetIds() { return behaviorBasePatchTargetIds; },
        get behaviorPlayerInteractionActions() { return behaviorPlayerInteractionActions; },
        get behaviorSemanticMovementActionSet() { return behaviorSemanticMovementActionSet; },
        get behaviorSemanticMovementActions() { return behaviorSemanticMovementActions; },
        get behaviorTreeAllowedActions() { return behaviorTreeAllowedActions; },
        get broadcastCityEvent() { return broadcastCityEvent; },
        get broadcastCityToChat() { return broadcastCityToChat; },
        get buildBusyPenaltyNarration() { return buildBusyPenaltyNarration; },
        get buildEmotionLogEntry() { return buildEmotionLogEntry; },
        get buildQuestPromptContext() { return buildQuestPromptContext; },
        get buildSurvivalPrompt() { return buildSurvivalPrompt; },
        get buildUniversalContext() { return buildUniversalContext; },
        get callLLM() { return callLLM; },
        get clamp() { return clamp; },
        get context() { return context; },
        get createCityError() { return createCityError; },
        get crypto() { return crypto; },
        get deriveEmotion() { return deriveEmotion; },
        get derivePhysicalState() { return derivePhysicalState; },
        get formatBehaviorIterationRecord() { return formatBehaviorIterationRecord; },
        get formatHackerIntelTimestamp() { return formatHackerIntelTimestamp; },
        get getEmergencyHospitalReason() { return getEmergencyHospitalReason; },
        get getMedicalStatusTiming() { return getMedicalStatusTiming; },
        get limitText() { return limitText; },
        get logActionParseError() { return logActionParseError; },
        get mayorRuntimeService() { return mayorRuntimeService; },
        get mayorService() { return mayorService; },
        get normalizeAllowedBehaviorPlaceIds() { return normalizeAllowedBehaviorPlaceIds; },
        get normalizeBehaviorContextInteger() { return normalizeBehaviorContextInteger; },
        get normalizeBehaviorIterationRecords() { return normalizeBehaviorIterationRecords; },
        get normalizeBehaviorIterationStep() { return normalizeBehaviorIterationStep; },
        get normalizeBehaviorIterationSummaries() { return normalizeBehaviorIterationSummaries; },
        get normalizeBehaviorRepeatText() { return normalizeBehaviorRepeatText; },
        get normalizeDistrictText() { return normalizeDistrictText; },
        get normalizeSurvivalState() { return normalizeSurvivalState; },
        get parseCityActionNarrations() { return parseCityActionNarrations; },
        get personalizeBehaviorPromptValue() { return personalizeBehaviorPromptValue; },
        get recordCityLlmDebug() { return recordCityLlmDebug; },
        get resolveBehaviorIterationContextConfig() { return resolveBehaviorIterationContextConfig; },
        get resolveBehaviorSummaryModelConfig() { return resolveBehaviorSummaryModelConfig; },
        get settleEmergencyHospitalTransfer() { return settleEmergencyHospitalTransfer; },
        get summarizeBehaviorRoomLayout() { return summarizeBehaviorRoomLayout; },
        get summarizeRecentBehaviorSpecialInteractions() { return summarizeRecentBehaviorSpecialInteractions; }
    });

    const { normalizePixelBehaviorTreeSceneKey, sanitizePixelBehaviorTreeState, normalizeDistrictPayload, normalizeItemPayload, ensureCityDb, createCityError, clamp, normalizeDistrictText, scoreDistrictFromText, rankDistrictsFromText, buildActionParseErrorLog, logActionParseError, parseSuggestedDistrictCandidates, normalizeSurvivalState, formatInventoryDecisionRow, normalizeQuestIntent, limitText, normalizeAllowedBehaviorPlaceIds, normalizeSemanticMovementStep, normalizeBehaviorChoiceTrigger, sanitizeBehaviorSteps, sanitizeBehaviorBranch, normalizeBehaviorNodeId, sanitizeBehaviorTreePatch, normalizeBehaviorRepeatText, collectBehaviorNodeRepeatTexts, normalizeBehaviorIterationStep, normalizeBehaviorIterationRecords, normalizeBehaviorIterationSummaries, formatBehaviorIterationRecord, sanitizeBaseBehaviorBranch, sanitizeBaseBehaviorBranchPack, sanitizeBehaviorInteractionStarterBranch, sanitizeBehaviorInteractionStarterPack, parseCityWebIntentTag, stripCityWebIntentTag, formatCityWebResultBlock } = require("./runtime/validation.js").createModule({
        get behaviorBasePatchTargetIds() { return behaviorBasePatchTargetIds; },
        get behaviorBranchHasOfferChoices() { return behaviorBranchHasOfferChoices; },
        get behaviorPatchTargetIds() { return behaviorPatchTargetIds; },
        get behaviorPlayerInteractionActionSet() { return behaviorPlayerInteractionActionSet; },
        get behaviorRepeatTextActions() { return behaviorRepeatTextActions; },
        get behaviorSemanticMovementActionSet() { return behaviorSemanticMovementActionSet; },
        get behaviorTreeAllowedActionSet() { return behaviorTreeAllowedActionSet; },
        get broadcastCityEvent() { return broadcastCityEvent; },
        get buildBehaviorIterationRecordsFromTree() { return buildBehaviorIterationRecordsFromTree; },
        get buildCollapsedCityLog() { return buildCollapsedCityLog; },
        get getDistrictAliasValues() { return getDistrictAliasValues; },
        get inferBaseBehaviorTargetNode() { return inferBaseBehaviorTargetNode; },
        get inferBehaviorScene() { return inferBehaviorScene; },
        get inferItemCategory() { return inferItemCategory; },
        get initCityDb() { return initCityDb; },
        get normalizeBehaviorContextInteger() { return normalizeBehaviorContextInteger; },
        get normalizeCityCatalogItemPayload() { return normalizeCityCatalogItemPayload; },
        get normalizeCityDistrictPayload() { return normalizeCityDistrictPayload; },
        get questService() { return questService; },
        get readBehaviorInteractionStarterAction() { return readBehaviorInteractionStarterAction; },
        get readBehaviorStepPlaceId() { return readBehaviorStepPlaceId; },
        get slugifyCityId() { return slugifyCityId; },
        get toAllowedBehaviorPlaceId() { return toAllowedBehaviorPlaceId; }
    });

    const { normalizeCityRuntimeConfigNumber, formatHackerIntelTimestamp, applyPassiveSurvivalTick, buildSchedulePrompt, tryParseScheduleReply, normalizeGeneratedSchedulePlan, getPassiveTickIntervalMinutes, queueCityTask, maybeGenerateSchedule } = require("./runtime/scheduling.js").createModule({
        get applyNumericPatchToState() { return applyNumericPatchToState; },
        get broadcastCityEvent() { return broadcastCityEvent; },
        get buildUniversalContext() { return buildUniversalContext; },
        get calculateDerivedMood() { return calculateDerivedMood; },
        get callLLM() { return callLLM; },
        get clamp() { return clamp; },
        get context() { return context; },
        get enqueueBackgroundTask() { return enqueueBackgroundTask; },
        get getCityDate() { return getCityDate; },
        get getHousingPassiveMinutePatch() { return getHousingPassiveMinutePatch; },
        get getHousingRuntimeContext() { return getHousingRuntimeContext; },
        get normalizeCityConfigValue() { return normalizeCityConfigValue; },
        get normalizeSurvivalState() { return normalizeSurvivalState; },
        get recordCityLlmDebug() { return recordCityLlmDebug; },
        get scheduleGenLocks() { return scheduleGenLocks; }
    });

    const { normalizeMetabolismPerMinute, getPhysicalCondition, buildEmergencyHospitalNarrations, getMedicalStayMinutes, buildMedicalAdmissionRecoveryPatch, getMedicalStatusTiming, isEmergencyHighDemandDistrict, getEmergencyHospitalReason, settleEmergencyHospitalTransfer } = require("./runtime/physiology.js").createModule({
        get EMERGENCY_CRITICAL_ENERGY() { return EMERGENCY_CRITICAL_ENERGY; },
        get EMERGENCY_CRITICAL_SLEEP_DEBT() { return EMERGENCY_CRITICAL_SLEEP_DEBT; },
        get EMERGENCY_EXHAUSTION_ENERGY() { return EMERGENCY_EXHAUSTION_ENERGY; },
        get EMERGENCY_HOSPITAL_FEE() { return EMERGENCY_HOSPITAL_FEE; },
        get EMERGENCY_HUNGER_CALORIES() { return EMERGENCY_HUNGER_CALORIES; },
        get EMERGENCY_SLEEP_DEBT() { return EMERGENCY_SLEEP_DEBT; },
        get EMERGENCY_STABILIZE_CALORIES() { return EMERGENCY_STABILIZE_CALORIES; },
        get MEDICAL_ADMISSION_ENERGY_FLOOR() { return MEDICAL_ADMISSION_ENERGY_FLOOR; },
        get MEDICAL_ADMISSION_HEALTH_FLOOR() { return MEDICAL_ADMISSION_HEALTH_FLOOR; },
        get MEDICAL_ADMISSION_SLEEP_DEBT_CEILING() { return MEDICAL_ADMISSION_SLEEP_DEBT_CEILING; },
        get MEDICAL_ADMISSION_STRESS_CEILING() { return MEDICAL_ADMISSION_STRESS_CEILING; },
        get MEDICAL_RECOVERY_INTERVAL_MINUTES() { return MEDICAL_RECOVERY_INTERVAL_MINUTES; },
        get MEDICAL_STAY_MINUTES_PER_TICK() { return MEDICAL_STAY_MINUTES_PER_TICK; },
        get broadcastCityEvent() { return broadcastCityEvent; },
        get broadcastCityToChat() { return broadcastCityToChat; },
        get buildCityAttemptRecorder() { return buildCityAttemptRecorder; },
        get buildRecentNarrationAntiRepeatBlock() { return buildRecentNarrationAntiRepeatBlock; },
        get buildRecentPrivateChatAntiRepeatBlock() { return buildRecentPrivateChatAntiRepeatBlock; },
        get calculateDerivedMood() { return calculateDerivedMood; },
        get callLLM() { return callLLM; },
        get clamp() { return clamp; },
        get createCityError() { return createCityError; },
        get getCityDate() { return getCityDate; },
        get getEngine() { return getEngine; },
        get getWsClients() { return getWsClients; },
        get logEmotionTransitionToState() { return logEmotionTransitionToState; },
        get normalizeCityRuntimeConfigNumber() { return normalizeCityRuntimeConfigNumber; },
        get normalizeSurvivalState() { return normalizeSurvivalState; },
        get recordCityLlmDebug() { return recordCityLlmDebug; },
        get tryParseCityActionReply() { return tryParseCityActionReply; }
    });

    const { maybeTriggerSuggestedCityAction, resolveCityIntentDistrict, getBehaviorInteractionStarterOutputContract, summarizeRecentBehaviorSpecialInteractions, findDuplicateBehaviorInteraction, readBehaviorInteractionStarterAction, getActionMinutesForHour, handleQuestLifecycleAfterAction, maybeRunCityWebSearchActivity } = require("./runtime/actions.js").createModule({
        get applyDecision() { return applyDecision; },
        get behaviorPlayerInteractionActionSet() { return behaviorPlayerInteractionActionSet; },
        get broadcastCityEvent() { return broadcastCityEvent; },
        get buildCityAttemptRecorder() { return buildCityAttemptRecorder; },
        get callLLM() { return callLLM; },
        get collectBehaviorNodeRepeatTexts() { return collectBehaviorNodeRepeatTexts; },
        get collectRecentBehaviorSpecialNodes() { return collectRecentBehaviorSpecialNodes; },
        get context() { return context; },
        get cyrb128() { return cyrb128; },
        get ensureCityDb() { return ensureCityDb; },
        get formatCityWebResultBlock() { return formatCityWebResultBlock; },
        get formatCityWebSearchKnowledge() { return formatCityWebSearchKnowledge; },
        get getBehaviorBaseOutputContract() { return getBehaviorBaseOutputContract; },
        get getBehaviorRepeatSimilarity() { return getBehaviorRepeatSimilarity; },
        get limitText() { return limitText; },
        get mcpLabTools() { return mcpLabTools; },
        get mulberry32() { return mulberry32; },
        get parseCityWebIntentTag() { return parseCityWebIntentTag; },
        get parseSuggestedDistrictCandidates() { return parseSuggestedDistrictCandidates; },
        get planCityWebSearchQuery() { return planCityWebSearchQuery; },
        get questService() { return questService; },
        get rankDistrictsFromText() { return rankDistrictsFromText; },
        get recordCityLlmDebug() { return recordCityLlmDebug; },
        get selectPreferredRestDistrict() { return selectPreferredRestDistrict; },
        get stripCityWebIntentTag() { return stripCityWebIntentTag; },
        get tryParseCityActionReply() { return tryParseCityActionReply; }
    });

    const { clipQuestContextText, buildQuestCompetitionContext, normalizeBehaviorContextInteger, resolveBehaviorIterationContextConfig, formatCityWebSearchKnowledge } = require("./runtime/context.js").createModule({
        get BEHAVIOR_CONTEXT_DEFAULT_P() { return BEHAVIOR_CONTEXT_DEFAULT_P; },
        get BEHAVIOR_CONTEXT_DEFAULT_Q() { return BEHAVIOR_CONTEXT_DEFAULT_Q; },
        get BEHAVIOR_CONTEXT_MAX_P() { return BEHAVIOR_CONTEXT_MAX_P; },
        get BEHAVIOR_CONTEXT_MAX_Q() { return BEHAVIOR_CONTEXT_MAX_Q; },
        get BEHAVIOR_CONTEXT_MAX_SUMMARIES() { return BEHAVIOR_CONTEXT_MAX_SUMMARIES; },
        get BEHAVIOR_CONTEXT_MIN_P() { return BEHAVIOR_CONTEXT_MIN_P; },
        get BEHAVIOR_CONTEXT_MIN_Q() { return BEHAVIOR_CONTEXT_MIN_Q; },
        get clamp() { return clamp; }
    });

    const { getRequiredRoomAnchorBranchTargets, findMissingRequiredRoomAnchorBranches, summarizeBehaviorRoomLayout } = require("./runtime/housing.js").createModule({
        get clamp() { return clamp; },
        get collectBehaviorStepPlaceIds() { return collectBehaviorStepPlaceIds; },
        get limitText() { return limitText; }
    });

    const { checkSocialCollisions, runSocialEncounter } = require("./runtime/relationships.js").createModule({
        get socialService() { return socialService; }
    });

    const { broadcastCityEvent } = require("./runtime/notifications.js").createModule({
        get getWsClients() { return getWsClients; }
    });

    

    

    const socialService = createSocialService({
        buildUniversalContext,
        callLLM,
        recordCityLlmDebug,
        buildQuestCompetitionContext,
        logEmotionTransition,
        applyEmotionEvent,
        broadcastCityEvent,
        broadcastCityToChat,
        getEngineContextWrapper: (userId) => ({
            getUserDb: context.getUserDb,
            getMemory: context.getMemory,
            userId,
            forceCityDetail: true
        })
    });

    const { triggerAdminGrantChat } = createAdminGrantService({
        ensureCityDb,
        getUserDb,
        getEngine,
        getWsClients
    });

    

    

    

    // LLM prompts

    

    const behaviorTreeAllowedActions = [
        'say',
        'emote',
        'wait',
        'face_player',
        'go_to_place',
        'wander_between',
        'loop_in_front_of',
        'browse_near',
        'patrol_segment',
        'approach_player',
        'follow_player',
        'walk_with_player',
        'idle_at_place',
        'offer_choices',
        'create_memory',
        'relationship_delta',
        'end_interaction'
    ];
    const behaviorTreeAllowedActionSet = new Set(behaviorTreeAllowedActions);
    const behaviorPlayerInteractionActions = [
        'greet',
        'small_talk',
        'ask_current_action',
        'ask_destination',
        'suggest_destination',
        'request_company',
        'treat_food',
        'request_help',
        'joke',
        'comfort'
    ];
    const behaviorPlayerInteractionActionSet = new Set(behaviorPlayerInteractionActions);
    const behaviorRepeatTextActions = new Set(['say', 'emote', 'offer_choices', 'create_memory', 'relationship_delta']);
    const behaviorSemanticMovementActions = [
        { id: 'go_to_place', label: '前往地点', needs: ['place_id'], description: '走到某个表内地点附近。' },
        { id: 'wander_between', label: '两点间闲逛', needs: ['from_place_id', 'to_place_id'], description: '在两个表内地点之间来回平移。' },
        { id: 'loop_in_front_of', label: '门前循环', needs: ['place_id'], description: '在某个表内地点前面小范围左右移动。' },
        { id: 'browse_near', label: '附近浏览', needs: ['place_id'], description: '靠近某个表内地点，停停走走。' },
        { id: 'patrol_segment', label: '街段巡逻', needs: ['from_place_id', 'to_place_id'], description: '在两个表内地点之间巡逻式移动。' },
        { id: 'approach_player', label: '靠近玩家', needs: [], description: '靠近玩家并面对玩家。' },
        { id: 'follow_player', label: '跟随玩家', needs: [], description: '跟随玩家，保持一小段距离。' },
        { id: 'walk_with_player', label: '陪玩家走', needs: ['to_place_id?'], description: '和玩家一起向某个表内地点走，地点可选。' },
        { id: 'idle_at_place', label: '地点停留', needs: ['place_id'], description: '在某个表内地点附近站立、等待、转向或说话。' }
    ];
    const behaviorSemanticMovementActionSet = new Set(behaviorSemanticMovementActions.map((action) => action.id));
    const behaviorPatchTargetIds = new Set([
        'player_interaction',
        'hard_needs',
        'routine_goal',
        'place_affordance',
        'background_mood',
        'curiosity',
        'wander',
        'idle_micro'
    ]);
    const behaviorBasePatchTargetIds = new Set([
        'movement_recovery',
        'hard_needs',
        'routine_goal',
        'place_affordance',
        'background_mood',
        'curiosity',
        'wander',
        'idle_micro'
    ]);

    

    const behaviorPromptProtocolKeys = new Set([
        'id', 'type', 'schema', 'version', 'source', 'operation', 'action', 'trigger',
        'target_node_id', 'targetNodeId', 'next_active_node_id', 'nextActiveNodeId',
        'root_id', 'rootId', 'active_node_id', 'activeNodeId', 'tree_id', 'treeId',
        'node_id', 'nodeId', 'branch_id', 'branchId', 'patch_id', 'patchId',
        'place_id', 'placeId', 'from_place_id', 'fromPlaceId', 'to_place_id', 'toPlaceId',
        'target_place_id', 'targetPlaceId', 'location_id', 'locationId',
        'player_action', 'playerAction', 'semantic_role', 'semanticRole'
    ]);

    require("./http/get-city-behavior-tree-state-sceneKey.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get normalizePixelBehaviorTreeSceneKey() { return normalizePixelBehaviorTreeSceneKey; } });

    require("./http/post-city-behavior-tree-state-sceneKey.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get normalizePixelBehaviorTreeSceneKey() { return normalizePixelBehaviorTreeSceneKey; }, get sanitizePixelBehaviorTreeState() { return sanitizePixelBehaviorTreeState; } });

    if (require('../../../config/feature-manifest.json').labs['scene-editor'].enabled) require("../../labs/scene-editor/http/get-city-characters-characterId-behavior-models.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureCityDb() { return ensureCityDb; }, get fetchBehaviorModelList() { return fetchBehaviorModelList; } });

    if (require('../../../config/feature-manifest.json').labs['scene-editor'].enabled) require("../../labs/scene-editor/http/post-city-characters-characterId-behavior-input.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get buildBehaviorInputPackage() { return buildBehaviorInputPackage; }, get ensureCityDb() { return ensureCityDb; }, get getBehaviorTreeSkeleton() { return getBehaviorTreeSkeleton; } });

    require("./http/post-city-characters-characterId-behavior-base-branches.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get buildBehaviorBaseRebuildPayload() { return buildBehaviorBaseRebuildPayload; }, get buildBehaviorInputPackage() { return buildBehaviorInputPackage; }, get createBaseBehaviorBranchesWithModel() { return createBaseBehaviorBranchesWithModel; }, get ensureCityDb() { return ensureCityDb; }, get getBehaviorBaseOutputContract() { return getBehaviorBaseOutputContract; }, get getBehaviorTreeSkeleton() { return getBehaviorTreeSkeleton; } });

    require("./http/post-city-characters-characterId-behavior-branch.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get buildBehaviorInputPackage() { return buildBehaviorInputPackage; }, get createBehaviorBranchWithModel() { return createBehaviorBranchWithModel; }, get ensureCityDb() { return ensureCityDb; }, get getBehaviorTreeSkeleton() { return getBehaviorTreeSkeleton; } });

    registerCoreCityRoutes(app, {
        authMiddleware,
        ensureCityDb,
        deriveEmotion,
        normalizeDistrictPayload,
        normalizeItemPayload,
        triggerAdminGrantChat,
        getWsClients,
        getEngine,
        isCollapsedCityLog,
        regenerateActionNarrations,
        handleQuestLifecycleAfterAction,
        getActionService: () => actionService
    });

    // Autonomous event loop & RNG minute scheduling

    // Simple deterministic PRNG seed generator
    

    // Mulberry32 PRNG
    

    // Calculates which exact minutes in the hour this character will act

    // Tick every minute
    const tickRate = '* * * * *';

    if (CITY_BACKGROUND_SAFE_MODE && !CITY_LIGHT_TICK_MODE) {
        console.warn('[City DLC] CP_SAFE_MODE is enabled. Autonomous city cron is disabled for stability.');
    } else {
        if (CITY_BACKGROUND_SAFE_MODE && CITY_LIGHT_TICK_MODE) {
            console.warn('[City DLC] CP_SAFE_MODE is enabled. Running city cron in light mode.');
        }
        context.jobs.cron(tickRate, require("./runtime/tick1.js").createTick({ get CITY_BACKGROUND_SAFE_MODE() { return CITY_BACKGROUND_SAFE_MODE; }, get CITY_ENABLE_AUTONOMOUS_ACTIONS() { return CITY_ENABLE_AUTONOMOUS_ACTIONS; }, get CITY_ENABLE_SCHEDULE_GENERATION() { return CITY_ENABLE_SCHEDULE_GENERATION; }, get CITY_ENABLE_SOCIAL_COLLISIONS() { return CITY_ENABLE_SOCIAL_COLLISIONS; }, get CITY_LIGHT_TICK_MODE() { return CITY_LIGHT_TICK_MODE; }, get applyPassiveSurvivalTick() { return applyPassiveSurvivalTick; }, get authDb() { return authDb; }, get broadcastCityEvent() { return broadcastCityEvent; }, get checkSocialCollisions() { return checkSocialCollisions; }, get context() { return context; }, get ensureCityDb() { return ensureCityDb; }, get filterAutomationUsers() { return filterAutomationUsers; }, get getActionMinutesForHour() { return getActionMinutesForHour; }, get getCityDate() { return getCityDate; }, get getMedicalStatusTiming() { return getMedicalStatusTiming; }, get getPassiveTickIntervalMinutes() { return getPassiveTickIntervalMinutes; }, get logEmotionTransitionToState() { return logEmotionTransitionToState; }, get maybeGenerateSchedule() { return maybeGenerateSchedule; }, get maybeRunMayorAI() { return maybeRunMayorAI; }, get normalizeMetabolismPerMinute() { return normalizeMetabolismPerMinute; }, get queueCityTask() { return queueCityTask; }, get simulateCharacter() { return simulateCharacter; } }));
    }

    // Core simulation

    // Phase 5: social collision detection

    

    // In-memory lock to prevent overlapping schedule generation for the same character
    const scheduleGenLocks = new Set();

    const mayorService = createMayorService({
        callLLM,
        recordCityLlmDebug,
        publishQuestAnnouncement,
        recordMayorAnnouncement
    });

    const questService = createQuestService({
        callLLM,
        recordCityLlmDebug,
        buildCityAttemptRecorder,
        scoreQuestProgressWithMayor: (...args) => mayorService.scoreQuestProgressWithMayor(...args)
    });

    const actionService = createActionService({
        normalizeSurvivalState,
        getDistrictStateEffects,
        buildGamblingOutcomeNarrations,
        broadcastCityToChat,
        buildCollapsedCityLog,
        pickSettledShopItemFromNarrations,
        isWeakCityNarration,
        regenerateActionNarrations,
        clamp,
        broadcastCityEvent,
        handleQuestLifecycleAfterAction: (...args) => questService.handleQuestLifecycleAfterAction(...args),
        applyStateEffectsToCharacter,
        applyHousingDistrictEffects,
        logEmotionTransitionToState,
        getWsClients,
        getEngine,
        isCollapsedCityLog,
        isHackerDistrict,
        buildHackerIntelAppendix,
        triggerHackerIntelReply,
        buildMedicalAdmissionRecoveryPatch,
        getMedicalStayMinutes,
        getCityNowMs: (config) => getCityDate(config).getTime(),
        maybeRunCityWebSearchActivity,
        generateInventoryOrganizeNarrations
    });

    const mayorRuntimeService = createMayorRuntimeService({
        callLLM,
        recordCityLlmDebug,
        resolveMayorAiCharacter: (...args) => mayorService.resolveMayorAiCharacter(...args),
        parseMayorJsonReply: (...args) => mayorService.parseMayorJsonReply(...args),
        applyMayorDecisions: (...args) => mayorService.applyMayorDecisions(...args)
    });

    registerEventQuestRoutes(app, {
        authMiddleware,
        ensureCityDb,
        scoreQuestDifficultyWithMayor,
        publishQuestAnnouncement,
        scoreQuestProgressWithMayor,
        buildQuestResolutionNarrations,
        broadcastCityEvent,
        getEngine,
        getWsClients
    });

    // Manual Schedule Generation Trigger
    require("./http/post-city-schedules-charId-generate.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureCityDb() { return ensureCityDb; }, get getCityDate() { return getCityDate; }, get maybeGenerateSchedule() { return maybeGenerateSchedule; }, get scheduleGenLocks() { return scheduleGenLocks; } });

    // Manual trigger for Mayor AI
    require("./http/post-city-mayor-run.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureCityDb() { return ensureCityDb; }, get maybeRunMayorAI() { return maybeRunMayorAI; } });

    // City->Chat bridge: send city events to chat, diary, and memory

    // Broadcast

    

    context.hooks.cityActionSuggestionCallback = maybeTriggerSuggestedCityAction;
    context.hooks.cityBusyChatImpactPatch = buildBusyChatImpactPatch;
    context.hooks.cityReplyStateSyncCallback = maybeSyncReplyDeclaredState;
    context.hooks.cityReplyIntentCallback = maybeExecuteReplyCityIntent;
    context.hooks.cityReplyActionCallback = maybeExecuteReplyCityAction;

    console.log('[City DLC] 商业街与生存系统路由已注册');
};
