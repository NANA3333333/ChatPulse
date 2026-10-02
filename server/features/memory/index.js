const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { LocalIndex } = require('vectra');
const { callLLM } = require("../../platform/llm/client.js");
const { getUserDb } = require("../../platform/db/userDatabase.js");
const { buildUniversalContext } = require("../conversation-context/index.js");
const qdrant = require("../../platform/vectors/qdrant.js");
const { getVectorIndexDir: buildVectorIndexDir } = require("../../paths");
const { getExpiredForgettingMemoryRows } = require("./maintenance/index.js");

const LOCAL_EMBEDDING_MODEL = process.env.LOCAL_EMBEDDING_MODEL || 'Xenova/bge-m3';
const LOCAL_EMBEDDING_DIM = Number(process.env.LOCAL_EMBEDDING_DIM || 1024);
const LOCAL_EMBEDDING_INDEX_TAG = process.env.LOCAL_EMBEDDING_INDEX_TAG || 'bge_m3_1024';
const MEMORY_QUERY_EXPANSION_ENABLED = process.env.MEMORY_QUERY_EXPANSION_ENABLED !== '0';
const LOCAL_VECTOR_INDEX_ENABLED = process.env.LOCAL_VECTOR_INDEX_ENABLED === '1';
const MEMORY_RETRIEVAL_SOURCE_VERSION = 'new-library-consolidation-summary-v1';
const MEMORY_INDEX_GRANULARITY = 'new_library_card_v1';
const MEMORY_SMALL_MODEL_MAX_TOKENS = 8000;

function isCompletePrivateContextSummaryResponse(content, metadata = {}) {
    const summaryText = String(content || '').trim();
    const finishReason = String(metadata?.finishReason || '').trim().toLowerCase();
    return !!summaryText && finishReason !== 'length';
}

// Dynamic import for transformers.js
let pipeline = null;
let extractionDisabled = false;
let extractionRetryAt = 0;
const embeddingCache = new Map();
const embeddingInFlight = new Map();
const EMBEDDING_CACHE_LIMIT = 256;
const embeddingStats = {
    model: LOCAL_EMBEDDING_MODEL,
    dimension: LOCAL_EMBEDDING_DIM,
    extractorState: 'idle',
    activeCount: 0,
    cacheSize: 0,
    inflightSize: 0,
    lastStartedAt: 0,
    lastFinishedAt: 0,
    lastDurationMs: 0,
    lastError: '',
    totalCalls: 0,
    totalCacheHits: 0,
    totalInflightHits: 0,
    totalCompleted: 0,
    totalFailures: 0,
    slowestActiveTextPreview: '',
    slowestActiveElapsedMs: 0
};
const activeEmbeddingJobs = new Map();

let globalWsClientsResolver = null;
const activeSweepJobs = new Set();
const sweepPoolCooldowns = new Map();
const sweepPoolAuthFailureCooldowns = new Map();
const SWEEP_COOLDOWN_MS = 10 * 1000;
const SWEEP_AUTH_FAILURE_COOLDOWN_MS = 30 * 60 * 1000;
const EXPIRED_FORGETTING_PURGE_INTERVAL_MS = 10 * 60 * 1000;
function setWsClientsResolver(resolver) {
    globalWsClientsResolver = resolver;
}

const { getExtractor, refreshEmbeddingStats, getEmbedding, getEmbeddingDebugStatus } = require("../../platform/vectors/embeddings.js").createModule({
        get EMBEDDING_CACHE_LIMIT() { return EMBEDDING_CACHE_LIMIT; },
        get LOCAL_EMBEDDING_DIM() { return LOCAL_EMBEDDING_DIM; },
        get LOCAL_EMBEDDING_MODEL() { return LOCAL_EMBEDDING_MODEL; },
        get activeEmbeddingJobs() { return activeEmbeddingJobs; },
        get embeddingCache() { return embeddingCache; },
        get embeddingInFlight() { return embeddingInFlight; },
        get embeddingStats() { return embeddingStats; },
        get extractionDisabled() { return extractionDisabled; }, set extractionDisabled(value) { extractionDisabled = value; },
        get extractionRetryAt() { return extractionRetryAt; }, set extractionRetryAt(value) { extractionRetryAt = value; },
        get pipeline() { return pipeline; }, set pipeline(value) { pipeline = value; }
    });

const { yieldToEventLoop, isRecoverableQdrantError, canUseQdrant, getVectorIndex, getVectorIndexDir, getLegacyVectorIndexDir, getLegacyDefaultVectorIndexDir, getVectorIndexFile, getVectorIndexVersionFile, readVectorIndexSourceVersion, writeVectorIndexSourceVersion, getVectorIndexItemCountSync } = require("../../platform/vectors/indexStorage.js").createModule({
        get LOCAL_EMBEDDING_DIM() { return LOCAL_EMBEDDING_DIM; },
        get LOCAL_EMBEDDING_INDEX_TAG() { return LOCAL_EMBEDDING_INDEX_TAG; },
        get LocalIndex() { return LocalIndex; },
        get MEMORY_RETRIEVAL_SOURCE_VERSION() { return MEMORY_RETRIEVAL_SOURCE_VERSION; },
        get QDRANT_AVAILABILITY_CACHE_MS() { return QDRANT_AVAILABILITY_CACHE_MS; },
        get buildVectorIndexDir() { return buildVectorIndexDir; },
        get fs() { return fs; },
        get indices() { return indices; },
        get path() { return path; },
        get qdrant() { return qdrant; },
        get qdrantAvailability() { return qdrantAvailability; }, set qdrantAvailability(value) { qdrantAvailability = value; },
        get qdrantAvailabilityCheckedAt() { return qdrantAvailabilityCheckedAt; }, set qdrantAvailabilityCheckedAt(value) { qdrantAvailabilityCheckedAt = value; }
    });

// Memory vector indices cache: UserId_CharacterID -> LocalIndex
const indices = new Map();
let qdrantAvailability = null;
let qdrantAvailabilityCheckedAt = 0;
const QDRANT_AVAILABILITY_CACHE_MS = 30 * 1000;
const indexRepairAttempts = new Map();

const memoryCache = new Map();

function clearMemoryCache(userId) {
    if (!userId) return;
    memoryCache.delete(String(userId));
}

function getMemory(userId) {
    const cacheKey = String(userId);
    if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);

    const getDb = () => getUserDb(userId);
    let lastExpiredForgettingPurgeAt = 0;
    let expiredForgettingPurgePromise = null;

    const { parseLooseJson, normalizeStringArray, normalizeRelationshipArray, summarizeRelationships, buildMemorySubjectRules, looksLikeCityMemory, looksLikeReplyDrivenCityNarration, hasHighValueMemorySignals, isRoutineCityMemory, classifyUserCenteredMemory, computeMemoryRetrievalWeight, computeMemoryTierBoost, computeUserProfilePriorityBoost, buildDedupeKey, formatAbsoluteTimestamp, formatSourceTimeRange, buildSourceTimeMeta, normalizeMemoryPayload, shouldWriteImmediateMemory, buildMemoryEmbeddingText, getNewLibraryIndexGroupKey, pickNewLibraryIndexRepresentative, buildNewLibraryIndexCards, upsertNewLibraryIndexCard, formatMemoryForPrompt } = require("./operations/indexing.js").createModule({
        get CITY_MEMORY_LOCATIONS() { return CITY_MEMORY_LOCATIONS; },
        get MEMORY_INDEX_GRANULARITY() { return MEMORY_INDEX_GRANULARITY; },
        get MEMORY_RETRIEVAL_SOURCE_VERSION() { return MEMORY_RETRIEVAL_SOURCE_VERSION; },
        get canUseQdrant() { return canUseQdrant; },
        get getEmbedding() { return getEmbedding; },
        get qdrant() { return qdrant; },
        get qdrantAvailability() { return qdrantAvailability; }, set qdrantAvailability(value) { qdrantAvailability = value; },
        get selectSearchableMemoryRows() { return selectSearchableMemoryRows; },
        get userId() { return userId; }
    });

    const { resolveMemoryModelConfig, buildMemoryConfigFingerprint, isNonRetryableMemoryModelError, recordMemoryDebug, expandMemoryQueriesWithLLM } = require("./operations/modelQueries.js").createModule({
        get MEMORY_QUERY_EXPANSION_ENABLED() { return MEMORY_QUERY_EXPANSION_ENABLED; },
        get MEMORY_SMALL_MODEL_MAX_TOKENS() { return MEMORY_SMALL_MODEL_MAX_TOKENS; },
        get callLLM() { return callLLM; },
        get crypto() { return crypto; },
        get getDb() { return getDb; }
    });

    const { normalizeDigestList, stripInlineTags, compactDigestText, stripCompressedOpener, normalizeConversationDigestPayload, formatConversationDigestForPrompt, formatGroupConversationDigestForPrompt, normalizeCompactGroupDigestPayload, cleanMemoryJsonReply, parseStrictMemoryJsonObject, parseStrictMemoryJsonArray, looksLikeMeaningRepairUserText, looksLikeAssistantInterpretation } = require("./operations/digestFormatting.js").createModule({
        get PRIVATE_DIGEST_LIMITS() { return PRIVATE_DIGEST_LIMITS; }
    });

    const { updateSweepStatus, recordMemoryTokenUsage } = require("./operations/progress.js").createModule({
        get getDb() { return getDb; }
    });

    const { wipeIndex, rebuildIndex, deleteMemoryIndexEntries, refreshMemoryIndexEntries, buildMemoryDeletionTargets, purgeExpiredForgettingMemories, ensureSearchIndexReady } = require("./operations/indexMaintenance.js").createModule({
        get EXPIRED_FORGETTING_PURGE_INTERVAL_MS() { return EXPIRED_FORGETTING_PURGE_INTERVAL_MS; },
        get LOCAL_VECTOR_INDEX_ENABLED() { return LOCAL_VECTOR_INDEX_ENABLED; },
        get MEMORY_INDEX_GRANULARITY() { return MEMORY_INDEX_GRANULARITY; },
        get MEMORY_RETRIEVAL_SOURCE_VERSION() { return MEMORY_RETRIEVAL_SOURCE_VERSION; },
        get buildMemorySearchFilter() { return buildMemorySearchFilter; },
        get buildNewLibraryIndexCards() { return buildNewLibraryIndexCards; },
        get canUseQdrant() { return canUseQdrant; },
        get expiredForgettingPurgePromise() { return expiredForgettingPurgePromise; }, set expiredForgettingPurgePromise(value) { expiredForgettingPurgePromise = value; },
        get fs() { return fs; },
        get getDb() { return getDb; },
        get getExpiredForgettingMemoryRows() { return getExpiredForgettingMemoryRows; },
        get getLegacyDefaultVectorIndexDir() { return getLegacyDefaultVectorIndexDir; },
        get getLegacyVectorIndexDir() { return getLegacyVectorIndexDir; },
        get getNewLibraryIndexGroupKey() { return getNewLibraryIndexGroupKey; },
        get getVectorIndex() { return getVectorIndex; },
        get getVectorIndexDir() { return getVectorIndexDir; },
        get getVectorIndexItemCountSync() { return getVectorIndexItemCountSync; },
        get globalWsClientsResolver() { return globalWsClientsResolver; }, set globalWsClientsResolver(value) { globalWsClientsResolver = value; },
        get hasNewLibrarySummary() { return hasNewLibrarySummary; },
        get indexRepairAttempts() { return indexRepairAttempts; },
        get indices() { return indices; },
        get lastExpiredForgettingPurgeAt() { return lastExpiredForgettingPurgeAt; }, set lastExpiredForgettingPurgeAt(value) { lastExpiredForgettingPurgeAt = value; },
        get qdrant() { return qdrant; },
        get qdrantAvailability() { return qdrantAvailability; }, set qdrantAvailability(value) { qdrantAvailability = value; },
        get readVectorIndexSourceVersion() { return readVectorIndexSourceVersion; },
        get selectSearchableMemoryRows() { return selectSearchableMemoryRows; },
        get upsertNewLibraryIndexCard() { return upsertNewLibraryIndexCard; },
        get userId() { return userId; },
        get writeVectorIndexSourceVersion() { return writeVectorIndexSourceVersion; }
    });

    const { normalizeSearchText, buildMemorySearchQueries, stripGenericMemoryQuery, expandBilingualAliases, expandGenericChineseAnchor, isUsefulGenericChineseAnchor, buildExpandedMemorySearchQueries, extractLexicalQueryTokens, computeLexicalVariantBoost, hasNewLibrarySummary, selectSearchableMemoryRows, buildMemoryRecallText, getNewLibraryRecallKey, prepareMemoryForRecall, finalizeMemorySearchRows, computeLexicalBoost, computeAliasBridgeBoost, computeRecallContradictionPenalty } = require("./operations/queryExpansion.js").createModule({
        get BILINGUAL_MEMORY_ALIASES() { return BILINGUAL_MEMORY_ALIASES; },
        get GENERIC_MEMORY_SEARCH_STOP_PHRASES() { return GENERIC_MEMORY_SEARCH_STOP_PHRASES; },
        get MEMORY_QUERY_EXPANSIONS() { return MEMORY_QUERY_EXPANSIONS; }
    });

    const { runLexicalMemoryFallback, runSemanticMemoryFallback } = require("./operations/fallbackRecall.js").createModule({
        get buildMemoryRecallText() { return buildMemoryRecallText; },
        get buildNewLibraryIndexCards() { return buildNewLibraryIndexCards; },
        get computeAliasBridgeBoost() { return computeAliasBridgeBoost; },
        get computeLexicalBoost() { return computeLexicalBoost; },
        get computeLexicalVariantBoost() { return computeLexicalVariantBoost; },
        get computeMemoryRetrievalWeight() { return computeMemoryRetrievalWeight; },
        get computeMemoryTierBoost() { return computeMemoryTierBoost; },
        get computeRecallContradictionPenalty() { return computeRecallContradictionPenalty; },
        get computeRecencyScoreAdjustment() { return computeRecencyScoreAdjustment; },
        get computeRetentionSearchAdjustment() { return computeRetentionSearchAdjustment; },
        get computeUserProfilePriorityBoost() { return computeUserProfilePriorityBoost; },
        get finalizeMemorySearchRows() { return finalizeMemorySearchRows; },
        get getEmbedding() { return getEmbedding; },
        get normalizeSearchText() { return normalizeSearchText; },
        get yieldToEventLoop() { return yieldToEventLoop; }
    });

    const { normalizeMemorySearchRequest, clampUnit, inferRecentSearchIntent, normalizeSearchTemporalIntent, startOfLocalDay, endOfLocalDay, addLocalDays, parseChineseNumber, resolveTemporalHintRange, getMemoryEffectiveTimeRange, getMemoryTemporalAnchor, getMemoryRecencyAnchor, computeRecencyScoreAdjustment, computeRetentionSearchAdjustment, memoryOverlapsTemporalRange, computeTemporalScoreAdjustment, computeTemporalAnchorPenalty, buildMemorySearchFilter, memoryMatchesSearchFilters } = require("./operations/searchFilters.js").createModule({
        get MEMORY_INDEX_GRANULARITY() { return MEMORY_INDEX_GRANULARITY; },
        get MEMORY_RETRIEVAL_SOURCE_VERSION() { return MEMORY_RETRIEVAL_SOURCE_VERSION; }
    });

    const { searchMemories } = require("./operations/search.js").createModule({
        get LOCAL_VECTOR_INDEX_ENABLED() { return LOCAL_VECTOR_INDEX_ENABLED; },
        get buildExpandedMemorySearchQueries() { return buildExpandedMemorySearchQueries; },
        get buildMemorySearchFilter() { return buildMemorySearchFilter; },
        get canUseQdrant() { return canUseQdrant; },
        get computeAliasBridgeBoost() { return computeAliasBridgeBoost; },
        get computeLexicalBoost() { return computeLexicalBoost; },
        get computeMemoryRetrievalWeight() { return computeMemoryRetrievalWeight; },
        get computeMemoryTierBoost() { return computeMemoryTierBoost; },
        get computeRecallContradictionPenalty() { return computeRecallContradictionPenalty; },
        get computeRecencyScoreAdjustment() { return computeRecencyScoreAdjustment; },
        get computeRetentionSearchAdjustment() { return computeRetentionSearchAdjustment; },
        get computeTemporalAnchorPenalty() { return computeTemporalAnchorPenalty; },
        get computeTemporalScoreAdjustment() { return computeTemporalScoreAdjustment; },
        get computeUserProfilePriorityBoost() { return computeUserProfilePriorityBoost; },
        get ensureSearchIndexReady() { return ensureSearchIndexReady; },
        get expandMemoryQueriesWithLLM() { return expandMemoryQueriesWithLLM; },
        get finalizeMemorySearchRows() { return finalizeMemorySearchRows; },
        get getDb() { return getDb; },
        get getEmbedding() { return getEmbedding; },
        get getVectorIndex() { return getVectorIndex; },
        get hasNewLibrarySummary() { return hasNewLibrarySummary; },
        get isRecoverableQdrantError() { return isRecoverableQdrantError; },
        get memoryMatchesSearchFilters() { return memoryMatchesSearchFilters; },
        get normalizeMemorySearchRequest() { return normalizeMemorySearchRequest; },
        get qdrant() { return qdrant; },
        get qdrantAvailability() { return qdrantAvailability; }, set qdrantAvailability(value) { qdrantAvailability = value; },
        get resolveTemporalHintRange() { return resolveTemporalHintRange; },
        get runLexicalMemoryFallback() { return runLexicalMemoryFallback; },
        get runSemanticMemoryFallback() { return runSemanticMemoryFallback; },
        get selectSearchableMemoryRows() { return selectSearchableMemoryRows; },
        get userId() { return userId; }
    });

    const { extractMemoryFromContext } = require("./operations/extraction.js").createModule({
        get MEMORY_SMALL_MODEL_MAX_TOKENS() { return MEMORY_SMALL_MODEL_MAX_TOKENS; },
        get buildMemorySubjectRules() { return buildMemorySubjectRules; },
        get buildSourceTimeMeta() { return buildSourceTimeMeta; },
        get buildUniversalContext() { return buildUniversalContext; },
        get callLLM() { return callLLM; },
        get formatAbsoluteTimestamp() { return formatAbsoluteTimestamp; },
        get getDb() { return getDb; },
        get getMemory() { return getMemory; },
        get getUserDb() { return getUserDb; },
        get parseStrictMemoryJsonObject() { return parseStrictMemoryJsonObject; },
        get recordMemoryDebug() { return recordMemoryDebug; },
        get recordMemoryTokenUsage() { return recordMemoryTokenUsage; },
        get resolveMemoryModelConfig() { return resolveMemoryModelConfig; },
        get saveExtractedMemory() { return saveExtractedMemory; },
        get shouldWriteImmediateMemory() { return shouldWriteImmediateMemory; },
        get userId() { return userId; }
    });

    const { updateConversationDigest, updateGroupConversationDigest } = require("./operations/digests.js").createModule({
        get MEMORY_SMALL_MODEL_MAX_TOKENS() { return MEMORY_SMALL_MODEL_MAX_TOKENS; },
        get buildMemorySubjectRules() { return buildMemorySubjectRules; },
        get callLLM() { return callLLM; },
        get crypto() { return crypto; },
        get getDb() { return getDb; },
        get isCompletePrivateContextSummaryResponse() { return isCompletePrivateContextSummaryResponse; },
        get normalizeCompactGroupDigestPayload() { return normalizeCompactGroupDigestPayload; },
        get recordMemoryTokenUsage() { return recordMemoryTokenUsage; },
        get resolveMemoryModelConfig() { return resolveMemoryModelConfig; }
    });

    const { parseMemoryArrayFromResponse, aggregateDailyMemoriesChunked, aggregateDailyMemories } = require("./operations/aggregation.js").createModule({
        get MEMORY_SMALL_MODEL_MAX_TOKENS() { return MEMORY_SMALL_MODEL_MAX_TOKENS; },
        get buildMemorySubjectRules() { return buildMemorySubjectRules; },
        get buildUniversalContext() { return buildUniversalContext; },
        get callLLM() { return callLLM; },
        get getDb() { return getDb; },
        get getMemory() { return getMemory; },
        get getUserDb() { return getUserDb; },
        get parseStrictMemoryJsonArray() { return parseStrictMemoryJsonArray; },
        get recordMemoryTokenUsage() { return recordMemoryTokenUsage; },
        get resolveMemoryModelConfig() { return resolveMemoryModelConfig; },
        get saveExtractedMemory() { return saveExtractedMemory; },
        get userId() { return userId; }
    });

    const { normalizeSweepPool, getSweepPoolMeta, getSweepPoolCounts, resolveSweepPool, collectSweepPoolEntries, sweepOverflowMemories } = require("./operations/sweep.js").createModule({
        get MEMORY_SMALL_MODEL_MAX_TOKENS() { return MEMORY_SMALL_MODEL_MAX_TOKENS; },
        get SWEEP_AUTH_FAILURE_COOLDOWN_MS() { return SWEEP_AUTH_FAILURE_COOLDOWN_MS; },
        get SWEEP_COOLDOWN_MS() { return SWEEP_COOLDOWN_MS; },
        get activeSweepJobs() { return activeSweepJobs; },
        get buildMemoryConfigFingerprint() { return buildMemoryConfigFingerprint; },
        get buildMemorySubjectRules() { return buildMemorySubjectRules; },
        get buildSourceTimeMeta() { return buildSourceTimeMeta; },
        get callLLM() { return callLLM; },
        get formatAbsoluteTimestamp() { return formatAbsoluteTimestamp; },
        get getDb() { return getDb; },
        get isNonRetryableMemoryModelError() { return isNonRetryableMemoryModelError; },
        get parseStrictMemoryJsonObject() { return parseStrictMemoryJsonObject; },
        get recordMemoryDebug() { return recordMemoryDebug; },
        get recordMemoryTokenUsage() { return recordMemoryTokenUsage; },
        get resolveMemoryModelConfig() { return resolveMemoryModelConfig; },
        get saveExtractedMemory() { return saveExtractedMemory; },
        get sweepPoolAuthFailureCooldowns() { return sweepPoolAuthFailureCooldowns; },
        get sweepPoolCooldowns() { return sweepPoolCooldowns; },
        get updateSweepStatus() { return updateSweepStatus; }
    });

    const { saveExtractedMemory, importMemories } = require("./operations/persistence.js").createModule({
        get wipeIndex() { return wipeIndex; },
        get LOCAL_VECTOR_INDEX_ENABLED() { return LOCAL_VECTOR_INDEX_ENABLED; },
        get MEMORY_INDEX_GRANULARITY() { return MEMORY_INDEX_GRANULARITY; },
        get MEMORY_RETRIEVAL_SOURCE_VERSION() { return MEMORY_RETRIEVAL_SOURCE_VERSION; },
        get buildMemoryEmbeddingText() { return buildMemoryEmbeddingText; },
        get canUseQdrant() { return canUseQdrant; },
        get computeMemoryRetrievalWeight() { return computeMemoryRetrievalWeight; },
        get getDb() { return getDb; },
        get getEmbedding() { return getEmbedding; },
        get getVectorIndex() { return getVectorIndex; },
        get globalWsClientsResolver() { return globalWsClientsResolver; }, set globalWsClientsResolver(value) { globalWsClientsResolver = value; },
        get hasNewLibrarySummary() { return hasNewLibrarySummary; },
        get isRoutineCityMemory() { return isRoutineCityMemory; },
        get normalizeMemoryPayload() { return normalizeMemoryPayload; },
        get qdrant() { return qdrant; },
        get qdrantAvailability() { return qdrantAvailability; }, set qdrantAvailability(value) { qdrantAvailability = value; },
        get userId() { return userId; }
    });

    const CITY_MEMORY_LOCATIONS = new Set([
        'park', 'restaurant', 'home', 'factory', 'convenience_store', 'school', 'street',
        'mall', 'cafe', 'office', 'hospital'
    ]);

    

    

    const PRIVATE_DIGEST_LIMITS = {
        digestText: 2400,
        emotionState: 180,
        relationshipItems: 12,
        relationshipItemLength: 180,
        openLoopItems: 12,
        openLoopItemLength: 180,
        recentFactItems: 18,
        recentFactItemLength: 220,
        sceneStateItems: 10,
        sceneStateItemLength: 160
    };

    

    

    const MEMORY_QUERY_EXPANSIONS = [
        { pattern: /\bopen\s*ai\b|openai/i, variants: ['openai', 'sam altman', 'anthropic openai', 'openai anthropic'] },
        { pattern: /\banthropic\b/i, variants: ['anthropic', 'claude', 'openai anthropic', 'sam altman anthropic'] },
        { pattern: /\bsam\s*altman\b/i, variants: ['sam altman', 'openai', 'anthropic', 'openai ceo'] },
        { pattern: /找工作|工作|求职|面试|简历|offer|求职/i, variants: ['找工作', '工作细节', '面试', '求职'] }
    ];

    

    const GENERIC_MEMORY_SEARCH_STOP_PHRASES = [
        '你还记得', '你记得', '还记得', '记得', '回忆', '想起', '再想想',
        '我说了什么', '我提过什么', '关于', '那关于', '还有', '之前', '以前', '上次', '当时',
        '到底', '吗', '呢', '呀', '啊', '这个', '那个', '这件事', '那件事', '相关', '事情',
        '内容', '细节', '方面', '情况'
    ];

    const BILINGUAL_MEMORY_ALIASES = [
        ['找工作', '求职', '工作', 'job', 'work', 'employment', 'career'],
        ['面试', 'interview'],
        ['简历', 'resume', 'cv'],
        ['offer', '录用', '录取'],
        ['薪资', '工资', 'salary', 'pay', 'compensation'],
        ['公司', '企业', 'startup', 'company'],
        ['openai', 'open ai'],
        ['anthropic'],
        ['sam altman', 'altman'],
        ['dario amodei', 'amodei'],
        ['ceo'],
        ['商业街', 'city', '街区'],
        ['工厂', 'factory'],
        ['餐厅', 'restaurant'],
        ['便利店', 'convenience store', 'store'],
        ['公园', 'park'],
        ['群聊', 'group chat', 'group'],
        ['日记', 'diary'],
        ['密码', 'password'],
        ['红包', '转账', 'red packet', 'transfer'],
        ['住院', '医院', 'hospital'],
        ['受伤', 'injury', 'injured'],
        ['嫉妒', 'jealous', 'jealousy']
    ];

    



    

    

    

    

    

    

    const instance = {
        wipeIndex,
        rebuildIndex,
        deleteMemoryIndexEntries,
        refreshMemoryIndexEntries,
        searchMemories,
        extractMemoryFromContext,
        formatConversationDigestForPrompt,
        formatGroupConversationDigestForPrompt,
        updateConversationDigest,
        updateGroupConversationDigest,
        aggregateDailyMemories,
        sweepOverflowMemories,
        purgeExpiredForgettingMemories,
        saveExtractedMemory,
        importMemories,
        getEmbeddingDebugStatus
    };

    memoryCache.set(cacheKey, instance);
    return instance;
}
module.exports = { getMemory, clearMemoryCache, setWsClientsResolver, getEmbeddingDebugStatus };
