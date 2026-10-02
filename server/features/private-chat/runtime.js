const { getUserDb } = require("../../platform/db/userDatabase.js");
const { callLLM } = require("../../platform/llm/client.js");
const { buildUniversalContext, formatTypedAntiRepeatBlock } = require("../conversation-context/index.js");
const { applyEmotionEvent, buildEmotionLogEntry, getExplicitEmotionStatePatch } = require("../characters/emotion.js");
const { getTokenCount } = require("../../platform/llm/tokenizer.js");
const { getLocalDateTimeFacts } = require("../../platform/time/facts.js");
const { enqueueBackgroundTask } = require("../../platform/jobs/backgroundQueue.js");
const { parseTtsIntentTag, stripTtsIntentTags, shouldSynthesizePrivateTts, synthesizeAndStoreMessage } = require("../speech/service.js");
const { getDefaultTopicSwitchState, parseTopicSwitchDecision } = require("./context/topicSwitch.js");
const { createReplyVersionService, createReplyGenerator } = require("./");
const { PRIVATE_REPLY_STYLE_GUIDANCE, DIALOGUE_STYLE_EXAMPLES } = require("./context/replyStyle.js");
const { PAST_CONVERSATION_REFERENCE, formatRetrievedMemoryReference } = require("./context/memoryReference.js");
const { SHARED_CONTEXT_GUIDANCE } = require("../conversation-context/guidance.js");
const crypto = require('crypto');

const engineCache = new Map();
const PRIVATE_AUTONOMY_DISABLED = process.env.CP_PRIVATE_AUTONOMY === '0';
const GROUP_AUTONOMY_DISABLED = process.env.CP_GROUP_AUTONOMY === '0';
const SMALL_MODEL_PLANNER_MAX_TOKENS = 8000;
let loggedPrivateAutonomyDisabled = false;
let loggedGroupAutonomyDisabled = false;

const GENERATED_CITY_ACTION_PAYLOAD_KEYS = [
    'district_id',
    'districtId',
    'district_name',
    'districtName',
    'district',
    'name',
    'district_type',
    'districtType',
    'type',
    'intent',
    'log',
    'chat',
    'diary',
    'prompt',
    'goal',
    'plan'
];

const GENERATED_CITY_ACTION_DISTRICT_KEYS = [
    'district_id',
    'districtId',
    'district_name',
    'districtName',
    'district',
    'name',
    'district_type',
    'districtType',
    'type',
    'intent'
];

const { escapeRegExp, unescapeLooseGeneratedJsonString, normalizeLooseGeneratedCityActionValue, parseLooseGeneratedCityActionPayload, parseGeneratedCityActionPayload } = require("../city/generatedActionParsing.js").createModule({
        get GENERATED_CITY_ACTION_DISTRICT_KEYS() { return GENERATED_CITY_ACTION_DISTRICT_KEYS; },
        get GENERATED_CITY_ACTION_PAYLOAD_KEYS() { return GENERATED_CITY_ACTION_PAYLOAD_KEYS; }
    });

const { getDefaultGuidelines, getDialogueStyleExamples, getDefaultResponseStyleConstitution, getCachedPromptBlock, getDigestTailWindowSize, resolveRagPlannerConfig } = require("./context/defaults.js").createModule({
        get DIALOGUE_STYLE_EXAMPLES() { return DIALOGUE_STYLE_EXAMPLES; },
        get crypto() { return crypto; }
    });

const { looksPrematurelyCutOff, estimateMessageTokens, buildRagPlannerMessages, isSyntheticSystemErrorMessage, unwrapStructuredPlannerText, extractBalancedJsonPayload, parseRagTopics, clampUnit, inferRecentTemporalIntentFromText, normalizeRagTemporalIntent, parseRagDecision, isValidTopicSwitchPayload, isValidRagTopicsPayload, isValidRagDecisionPayload, isValidTemporalBrowseSummaryPayload, parseChineseTemporalNumber, startOfLocalDay, endOfLocalDay, addLocalDays, resolveTemporalBrowseRange, formatTemporalBrowseContext, buildTemporalBrowseContextPartition, parseTemporalBrowseSummaryResult, parseStructuredRagQuery, deriveRagRewriteConstraints, isRagScopeTermMentioned, buildImplicitRagQueryScopeTerms, normalizeRagQuerySpacing, stripImplicitRagQueryScopeTerms, sanitizeStructuredRagQueries, enforceStructuredRagQueryConstraints, buildSlotQueries, deriveRagRetrievalSlots, executeMultiSlotMemorySearch, formatMessageForLLM } = require("./context/planning.js").createModule({
        get PAST_CONVERSATION_REFERENCE() { return PAST_CONVERSATION_REFERENCE; },
        get escapeRegExp() { return escapeRegExp; },
        get getTokenCount() { return getTokenCount; },
        get parseTopicSwitchDecision() { return parseTopicSwitchDecision; }
    });

const { formatMessageTimestampForLLM, resolveHistorySpeakerName, formatHistoryMessageForLLM, stripHistoryMetadataPrefixFromOutput, getCachedHistoryWindow, isBackgroundCharacterMessageAfterUser, markPostUserCharacterMessageAsEvent, compileHistoryMessages, arraysEqual, stripInlineTags, extractSpeechOpener, hasOverusedEllipsisStyle, findWindowForwardOverlap, buildSlidingHistoryWindow } = require("./context/history.js").createModule({
        get crypto() { return crypto; },
        get formatMessageForLLM() { return formatMessageForLLM; }
    });

const { preparePrivateConversationState } = require("./context/conversationState.js").createModule({
        get compileHistoryMessages() { return compileHistoryMessages; },
        get isSyntheticSystemErrorMessage() { return isSyntheticSystemErrorMessage; },
        get markPostUserCharacterMessageAsEvent() { return markPostUserCharacterMessageAsEvent; }
    });

function getEngine(userId) {
    if (engineCache.has(userId)) return engineCache.get(userId);

    // Lazy loaded memory to avoid circular deps
    const { getMemory } = require("../memory/index.js");

    const db = getUserDb(userId);
    const memory = getMemory(userId);

    // --- ENCLOSED ENGINE FUNCTIONS ---
    const timers = new Map();
    const userReplyDebounceTimers = new Map();
    const latestUserReplyRequests = new Map();
    const userReplyInFlight = new Set();
    const ragFailureCache = new Map();
    const dedupBlockCounts = new Map(); // Track consecutive dedup blocks per character
    let stateBroadcastInterval = null;

    const { queueEngineTask, getLatestUserMessageId, isPrivateReplyStale, abortStalePrivateReply, clearUserReplyDebounce, createPrivateUserReplyRequest, cleanupPrivateUserReplyRequest, mergePrivateUserReplyCleanup, scheduleQueuedUserReply, runUserReplyRequest, queueLatestUserReply, handleUserMessage, triggerImmediateUserReply } = require("./dispatch.js").createModule({
        get db() { return db; },
        get enqueueBackgroundTask() { return enqueueBackgroundTask; },
        get getRagFailureState() { return getRagFailureState; },
        get latestUserReplyRequests() { return latestUserReplyRequests; },
        get recordReplyDispatch() { return recordReplyDispatch; },
        get stopTimer() { return stopTimer; },
        get timers() { return timers; },
        get triggerMessage() { return triggerMessage; },
        get updateRagProgress() { return updateRagProgress; },
        get userId() { return userId; },
        get userReplyDebounceTimers() { return userReplyDebounceTimers; },
        get userReplyInFlight() { return userReplyInFlight; }
    });

    const { recordTokenUsage, recordLlmDebug, recordReplyDispatch, buildLlmAttemptRecorder } = require("./diagnostics/recorders.js").createModule({
        get db() { return db; }
    });

    const { clamp, normalizeGeneratedIntegerInRange, parseGeneratedBoundedTag, parseTaggedDelta, parseGeneratedAffinityDelta, parseGeneratedCharAffinityDeltas, normalizeGeneratedTransferAmount, normalizeGeneratedPressureLevel, addUsageTotals, stripHiddenTagsForVisibleMessage } = require("./replyParsing.js").createModule({
        get db() { return db; }
    });

    const { parseWebSearchIntentTag, stripWebSearchIntentTag, formatWebSearchResultsForKnowledge, formatWebSearchBlock, planCharacterWebSearch, runCharacterWebSearch, runWebSearchFollowupIfRequested, setWebSearchActive } = require("../web-tools/chatFollowup.js").createModule({
        get SMALL_MODEL_PLANNER_MAX_TOKENS() { return SMALL_MODEL_PLANNER_MAX_TOKENS; },
        get addUsageTotals() { return addUsageTotals; },
        get broadcastEngineState() { return broadcastEngineState; },
        get buildLlmAttemptRecorder() { return buildLlmAttemptRecorder; },
        get buildRagPlannerMessages() { return buildRagPlannerMessages; },
        get callLLM() { return callLLM; },
        get db() { return db; },
        get extractBalancedJsonPayload() { return extractBalancedJsonPayload; },
        get recordLlmDebug() { return recordLlmDebug; },
        get recordTokenUsage() { return recordTokenUsage; },
        get resolveRagPlannerConfig() { return resolveRagPlannerConfig; },
        get timers() { return timers; },
        get updateRagProgress() { return updateRagProgress; },
        get userId() { return userId; }
    });

    const { persistVisibleCharacterText } = require("./persistence.js").createModule({
        get broadcastNewMessage() { return broadcastNewMessage; },
        get db() { return db; },
        get stripHiddenTagsForVisibleMessage() { return stripHiddenTagsForVisibleMessage; },
        get stripHistoryMetadataPrefixFromOutput() { return stripHistoryMetadataPrefixFromOutput; }
    });

    const { logEmotionTransition } = require("../characters/emotionTransitions.js").createModule({
        get buildEmotionLogEntry() { return buildEmotionLogEntry; },
        get db() { return db; }
    });

    const { broadcastEngineState, broadcastNewMessage, broadcastEvent, broadcastWalletSync } = require("../../platform/realtime/engineEvents.js").createModule({
        get db() { return db; },
        get timers() { return timers; }
    });

    const { createRagProgress, updateRagProgress, clearCompletedRagProgressSoon, setRagFailureState, getRagFailureState } = require("./progress.js").createModule({
        get RAG_PROGRESS_STEP_KEYS() { return RAG_PROGRESS_STEP_KEYS; },
        get RAG_PROGRESS_TOTAL_STEPS() { return RAG_PROGRESS_TOTAL_STEPS; },
        get broadcastEngineState() { return broadcastEngineState; },
        get ragFailureCache() { return ragFailureCache; },
        get timers() { return timers; }
    });

    const { runTopicSwitchGate, buildPrompt, runStructuredRagPipeline } = require("./context/pipeline.js").createModule({
        get PAST_CONVERSATION_REFERENCE() { return PAST_CONVERSATION_REFERENCE; },
        get PRIVATE_REPLY_STYLE_GUIDANCE() { return PRIVATE_REPLY_STYLE_GUIDANCE; },
        get SHARED_CONTEXT_GUIDANCE() { return SHARED_CONTEXT_GUIDANCE; },
        get SMALL_MODEL_PLANNER_MAX_TOKENS() { return SMALL_MODEL_PLANNER_MAX_TOKENS; },
        get broadcastEvent() { return broadcastEvent; },
        get buildImplicitRagQueryScopeTerms() { return buildImplicitRagQueryScopeTerms; },
        get buildLlmAttemptRecorder() { return buildLlmAttemptRecorder; },
        get buildRagPlannerMessages() { return buildRagPlannerMessages; },
        get buildTemporalBrowseContextPartition() { return buildTemporalBrowseContextPartition; },
        get buildUniversalContext() { return buildUniversalContext; },
        get callLLM() { return callLLM; },
        get db() { return db; },
        get deriveRagRetrievalSlots() { return deriveRagRetrievalSlots; },
        get deriveRagRewriteConstraints() { return deriveRagRewriteConstraints; },
        get enforceStructuredRagQueryConstraints() { return enforceStructuredRagQueryConstraints; },
        get executeMultiSlotMemorySearch() { return executeMultiSlotMemorySearch; },
        get formatRetrievedMemoryReference() { return formatRetrievedMemoryReference; },
        get formatTemporalBrowseContext() { return formatTemporalBrowseContext; },
        get formatTypedAntiRepeatBlock() { return formatTypedAntiRepeatBlock; },
        get getCachedPromptBlock() { return getCachedPromptBlock; },
        get getDefaultGuidelines() { return getDefaultGuidelines; },
        get getDefaultResponseStyleConstitution() { return getDefaultResponseStyleConstitution; },
        get getDialogueStyleExamples() { return getDialogueStyleExamples; },
        get getLocalDateTimeFacts() { return getLocalDateTimeFacts; },
        get getUserDb() { return getUserDb; },
        get hasOverusedEllipsisStyle() { return hasOverusedEllipsisStyle; },
        get isValidRagDecisionPayload() { return isValidRagDecisionPayload; },
        get isValidRagTopicsPayload() { return isValidRagTopicsPayload; },
        get isValidTemporalBrowseSummaryPayload() { return isValidTemporalBrowseSummaryPayload; },
        get isValidTopicSwitchPayload() { return isValidTopicSwitchPayload; },
        get memory() { return memory; },
        get parseRagDecision() { return parseRagDecision; },
        get parseRagTopics() { return parseRagTopics; },
        get parseStructuredRagQuery() { return parseStructuredRagQuery; },
        get parseTemporalBrowseSummaryResult() { return parseTemporalBrowseSummaryResult; },
        get parseTopicSwitchDecision() { return parseTopicSwitchDecision; },
        get recordLlmDebug() { return recordLlmDebug; },
        get recordTokenUsage() { return recordTokenUsage; },
        get resolveRagPlannerConfig() { return resolveRagPlannerConfig; },
        get resolveTemporalBrowseRange() { return resolveTemporalBrowseRange; },
        get updateRagProgress() { return updateRagProgress; },
        get userId() { return userId; }
    });

    const { getRandomDelayMs, scheduleNext, stopTimer, suspendCharacterSchedule, startEngine, triggerProactiveMessage, stopAllTimers } = require("./scheduling.js").createModule({
        get PRIVATE_AUTONOMY_DISABLED() { return PRIVATE_AUTONOMY_DISABLED; },
        get broadcastEngineState() { return broadcastEngineState; },
        get db() { return db; },
        get groupProactiveTimers() { return groupProactiveTimers; },
        get loggedPrivateAutonomyDisabled() { return loggedPrivateAutonomyDisabled; }, set loggedPrivateAutonomyDisabled(value) { loggedPrivateAutonomyDisabled = value; },
        get queueEngineTask() { return queueEngineTask; },
        get stateBroadcastInterval() { return stateBroadcastInterval; }, set stateBroadcastInterval(value) { stateBroadcastInterval = value; },
        get timers() { return timers; },
        get triggerMessage() { return triggerMessage; }
    });

    const { triggerMessage } = require("./replyGeneration.js").createModule({
        get abortStalePrivateReply() { return abortStalePrivateReply; },
        get broadcastEngineState() { return broadcastEngineState; },
        get broadcastEvent() { return broadcastEvent; },
        get broadcastNewMessage() { return broadcastNewMessage; },
        get broadcastWalletSync() { return broadcastWalletSync; },
        get buildLlmAttemptRecorder() { return buildLlmAttemptRecorder; },
        get buildPrompt() { return buildPrompt; },
        get callLLM() { return callLLM; },
        get cityReplyActionCallback() { return cityReplyActionCallback; }, set cityReplyActionCallback(value) { cityReplyActionCallback = value; },
        get cityReplyIntentCallback() { return cityReplyIntentCallback; }, set cityReplyIntentCallback(value) { cityReplyIntentCallback = value; },
        get cityReplyStateSyncCallback() { return cityReplyStateSyncCallback; }, set cityReplyStateSyncCallback(value) { cityReplyStateSyncCallback = value; },
        get clearCompletedRagProgressSoon() { return clearCompletedRagProgressSoon; },
        get createRagProgress() { return createRagProgress; },
        get db() { return db; },
        get dedupBlockCounts() { return dedupBlockCounts; },
        get estimateMessageTokens() { return estimateMessageTokens; },
        get getExplicitEmotionStatePatch() { return getExplicitEmotionStatePatch; },
        get getTokenCount() { return getTokenCount; },
        get isPrivateReplyStale() { return isPrivateReplyStale; },
        get logEmotionTransition() { return logEmotionTransition; },
        get looksPrematurelyCutOff() { return looksPrematurelyCutOff; },
        get memory() { return memory; },
        get normalizeGeneratedTransferAmount() { return normalizeGeneratedTransferAmount; },
        get parseGeneratedAffinityDelta() { return parseGeneratedAffinityDelta; },
        get parseGeneratedBoundedTag() { return parseGeneratedBoundedTag; },
        get parseGeneratedCharAffinityDeltas() { return parseGeneratedCharAffinityDeltas; },
        get parseGeneratedCityActionPayload() { return parseGeneratedCityActionPayload; },
        get parseTtsIntentTag() { return parseTtsIntentTag; },
        get persistVisibleCharacterText() { return persistVisibleCharacterText; },
        get preparePrivateConversationState() { return preparePrivateConversationState; },
        get recordLlmDebug() { return recordLlmDebug; },
        get recordTokenUsage() { return recordTokenUsage; },
        get runStructuredRagPipeline() { return runStructuredRagPipeline; },
        get runTopicSwitchGate() { return runTopicSwitchGate; },
        get runWebSearchFollowupIfRequested() { return runWebSearchFollowupIfRequested; },
        get scheduleNext() { return scheduleNext; },
        get setRagFailureState() { return setRagFailureState; },
        get shouldSynthesizePrivateTts() { return shouldSynthesizePrivateTts; },
        get stopTimer() { return stopTimer; },
        get stripHiddenTagsForVisibleMessage() { return stripHiddenTagsForVisibleMessage; },
        get stripHistoryMetadataPrefixFromOutput() { return stripHistoryMetadataPrefixFromOutput; },
        get stripTtsIntentTags() { return stripTtsIntentTags; },
        get synthesizeAndStoreMessage() { return synthesizeAndStoreMessage; },
        get timers() { return timers; },
        get updateRagProgress() { return updateRagProgress; },
        get userId() { return userId; }
    });

    const { changePrivateReplyVersion } = require("./replyVersionAdapter.js").createModule({
        get broadcastEngineState() { return broadcastEngineState; },
        get broadcastEvent() { return broadcastEvent; },
        get changeReplyVersion() { return changeReplyVersion; },
        get clearCompletedRagProgressSoon() { return clearCompletedRagProgressSoon; },
        get createRagProgress() { return createRagProgress; },
        get db() { return db; },
        get latestUserReplyRequests() { return latestUserReplyRequests; },
        get scheduleNext() { return scheduleNext; },
        get stopTimer() { return stopTimer; },
        get timers() { return timers; },
        get updateRagProgress() { return updateRagProgress; },
        get userReplyInFlight() { return userReplyInFlight; }
    });

    const { triggerJealousyCheck, triggerJealousyMessage } = require("../relationships/jealousy.js").createModule({
        get db() { return db; },
        get getRandomDelayMs() { return getRandomDelayMs; },
        get queueEngineTask() { return queueEngineTask; },
        get stopTimer() { return stopTimer; },
        get timers() { return timers; },
        get triggerMessage() { return triggerMessage; }
    });

    const { setGroupChainCallback, stopGroupProactiveTimer, scheduleGroupProactive, triggerGroupProactive, startGroupProactiveTimers } = require("../group-chat/proactive.js").createModule({
        get GROUP_AUTONOMY_DISABLED() { return GROUP_AUTONOMY_DISABLED; },
        get applyEmotionEvent() { return applyEmotionEvent; },
        get buildUniversalContext() { return buildUniversalContext; },
        get callLLM() { return callLLM; },
        get db() { return db; },
        get formatMessageForLLM() { return formatMessageForLLM; },
        get getUserDb() { return getUserDb; },
        get groupChainCallback() { return groupChainCallback; }, set groupChainCallback(value) { groupChainCallback = value; },
        get groupProactiveTimers() { return groupProactiveTimers; },
        get loggedGroupAutonomyDisabled() { return loggedGroupAutonomyDisabled; }, set loggedGroupAutonomyDisabled(value) { loggedGroupAutonomyDisabled = value; },
        get queueEngineTask() { return queueEngineTask; },
        get recordTokenUsage() { return recordTokenUsage; },
        get userId() { return userId; }
    });

    const { setCityReplyStateSyncCallback, setCityReplyIntentCallback, setCityReplyActionCallback } = require("./cityHooks.js").createModule({
        get cityReplyActionCallback() { return cityReplyActionCallback; }, set cityReplyActionCallback(value) { cityReplyActionCallback = value; },
        get cityReplyIntentCallback() { return cityReplyIntentCallback; }, set cityReplyIntentCallback(value) { cityReplyIntentCallback = value; },
        get cityReplyStateSyncCallback() { return cityReplyStateSyncCallback; }, set cityReplyStateSyncCallback(value) { cityReplyStateSyncCallback = value; }
    });

    

    

    

    

    

    

    const RAG_PROGRESS_TOTAL_STEPS = 7;
    const RAG_PROGRESS_STEP_KEYS = ['switch', 'route', 'topics', 'decision', 'rewrite', 'retrieve', 'answer'];

    

    

    // Generate a random delay between min and max minutes
    

    // Generates the system prompt merging character persona, world info, and memories

    // Function that actually triggers the generation of an AI message
    

    const changeReplyVersion = createReplyVersionService({
        userId,
        repository: {
            getRun: db.getPrivateReplyRun,
            getCharacter: db.getCharacter,
            getVisibleMessages: db.getVisibleMessages,
            select: db.selectPrivateReplyVersion
        },
        runtime: {
            isBusy: characterId => userReplyInFlight.has(characterId)
                || latestUserReplyRequests.has(characterId) || userReplyDebounceTimers.has(characterId)
                || timers.get(characterId)?.isThinking,
            hasPendingUserReply: characterId => latestUserReplyRequests.has(characterId) || userReplyInFlight.has(characterId)
        },
        queueTask: queueEngineTask,
        generateReply: createReplyGenerator({
            callLLM, buildLlmAttemptRecorder, recordLlmDebug, recordUsage: recordTokenUsage,
            looksPrematurelyCutOff, addUsageTotals,
            normalizeVisibleText: text => stripHistoryMetadataPrefixFromOutput(stripHiddenTagsForVisibleMessage(text))
        })
    });

    // Compatibility adapter: scheduling stays in the engine until ordinary private chat is migrated.
    

    // Schedules a setTimeout based on character's interval settings
    

    // Explicitly stop a character's engine
    

    // Loop through all active characters and start their engines
    

    // Sends the message object to all connected frontend clients
    

    // Sends a raw event object to all connected frontend clients

    /**
     * Handle a user message. Resets timer, and triggers an immediate "return reaction" 
     * if pressure was high, before zeroing out the pressure.
     */

    /**
     * Iterates through all other active characters. Gives them a chance to trigger a jealousy message
     * since the user is currently talking to someone else.
     * Now tracks WHO the user is chatting with (rival) and accumulates jealousy_level.
     */
    

    /**
     * Specialized message trigger for Jealousy; delegates to triggerMessage.
     * since buildPrompt already injects jealousy context (level + rival name).
     * This ensures jealousy messages get the full chat window, memories, anti-repeat, etc.
     */
    

    /**
     * Specialized message trigger for explicit Proactive Tasks (Scheduler DLC)
     * Injects a specialized system directive to force the AI to output exactly what is asked.
     */
    

    // Group Proactive Messaging
    const groupProactiveTimers = new Map(); // Store group proactive timers { groupId: handle }
    let groupChainCallback = null;
    let cityReplyStateSyncCallback = null;
    let cityReplyIntentCallback = null;
    let cityReplyActionCallback = null;

    

    

    // --- END ENCLOSED ENGINE FUNCTIONS ---

    const engineInstance = {
        isBusy: () => userReplyInFlight.size > 0 || latestUserReplyRequests.size > 0 || userReplyDebounceTimers.size > 0
            || [...timers.values()].some(timer => timer.isThinking),

        startEngine,
        stopTimer,
        suspendCharacterSchedule,
        handleUserMessage,
        triggerImmediateUserReply,
        changePrivateReplyVersion,
        broadcastNewMessage,
        broadcastEvent,
        broadcastWalletSync,
        triggerJealousyCheck,
        triggerProactiveMessage,
        startGroupProactiveTimers,
        stopGroupProactiveTimer,
        scheduleGroupProactive,
        setGroupChainCallback,
        setCityReplyStateSyncCallback,
        setCityReplyIntentCallback,
        setCityReplyActionCallback
        ,
        stopAllTimers
    };

    engineCache.set(userId, engineInstance);
    return engineInstance;
}

module.exports = { getEngine, engineCache, getDefaultGuidelines };
