const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { getDataDir, getUserDbPath } = require("../../paths");
const { createPrivateReplyVersions, createMessageRepository } = require("../../features/private-chat");

const userDbCache = new Map();
const deletingUserDbIds = new Set();
const maintenanceUserIds = new Set();

function beginUserDbMaintenance(userId) {
    const key = String(userId);
    if (maintenanceUserIds.has(key)) throw Object.assign(new Error('Archive restore is already running.'), { statusCode: 409 });
    maintenanceUserIds.add(key);
    return () => maintenanceUserIds.delete(key);
}

const LLM_DEBUG_DEFAULT_MAX_BYTES = 80 * 1024 * 1024;
const LLM_DEBUG_DEFAULT_MAX_ROWS = 12000;
const LLM_DEBUG_MIN_KEEP_ROWS = 1000;
const LLM_DEBUG_PRUNE_INTERVAL_MS = 60 * 1000;
const PIXEL_BEHAVIOR_TREE_STATE_MAX_BYTES = 1024 * 1024;
const DB_STARTUP_VACUUM_MARKER_SUFFIX = '.vacuum-next';
const DB_STARTUP_VACUUM_MIN_FREE_BYTES = 64 * 1024 * 1024;

function readPositiveIntegerEnv(name, fallback) {
    const raw = Number(process.env[name]);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function buildDefaultAvatarUrl(seed = 'User') {
    const safeSeed = encodeURIComponent(String(seed || 'User').trim() || 'User');
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${safeSeed}&backgroundColor=e8f0ff,fff5d6,e9f7ef,f5eafa,f1f5f9`;
}

function getUserDb(userId, { maintenance = false } = {}) {
    if (!userId) throw new Error("getUserDb requires a valid userId");
    if (!maintenance && maintenanceUserIds.has(String(userId))) {
        throw Object.assign(new Error('Archive restore is in progress. Please retry shortly.'), { statusCode: 503 });
    }
    if (deletingUserDbIds.has(String(userId))) {
        throw new Error(`User DB is being deleted: ${userId}`);
    }
    if (userDbCache.has(userId)) return userDbCache.get(userId);

    getDataDir();
    const dbPath = getUserDbPath(userId);
    const startupVacuumMarkerPath = `${dbPath}${DB_STARTUP_VACUUM_MARKER_SUFFIX}`;
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    const llmDebugMaxBytes = readPositiveIntegerEnv('CP_LLM_DEBUG_MAX_BYTES', LLM_DEBUG_DEFAULT_MAX_BYTES);
    const llmDebugMaxRows = readPositiveIntegerEnv('CP_LLM_DEBUG_MAX_ROWS', LLM_DEBUG_DEFAULT_MAX_ROWS);
    let llmDebugLastPruneAt = 0;
    let privateReplyVersions = null;

    // --- ENCLOSED DB FUNCTIONS ---


    const { safeParseJson, normalizeArrayField, normalizeRelationshipField, stringifyJson, normalizePositiveRowId, normalizeSqlLimit } = require("./normalization.js").createModule({
        
    });

    const { runOptionalDelete, deleteExternalKnowledgeDocsForCharacter, deleteCharacterAttachedRows } = require("../../features/characters/deletionRepository.js").createModule({
        get db() { return db; }
    });

    const { getAllowedMemoryUpdateFields, normalizeMemoryRow } = require("../../features/memory/rowNormalization.js").createModule({
        get MEMORY_UPDATE_COLUMNS() { return MEMORY_UPDATE_COLUMNS; },
        get normalizeArrayField() { return normalizeArrayField; },
        get normalizeRelationshipField() { return normalizeRelationshipField; }
    });

    const { normalizeConversationDigestRow, normalizeGroupConversationDigestRow } = require("../../features/conversation-context/digestRows.js").createModule({
        get normalizeArrayField() { return normalizeArrayField; }
    });

    const { getLlmDebugLogStats, enforceLlmDebugLogRetention } = require("../../features/diagnostics/retentionRepository.js").createModule({
        get LLM_DEBUG_MIN_KEEP_ROWS() { return LLM_DEBUG_MIN_KEEP_ROWS; },
        get LLM_DEBUG_PRUNE_INTERVAL_MS() { return LLM_DEBUG_PRUNE_INTERVAL_MS; },
        get db() { return db; },
        get llmDebugLastPruneAt() { return llmDebugLastPruneAt; }, set llmDebugLastPruneAt(value) { llmDebugLastPruneAt = value; },
        get llmDebugMaxBytes() { return llmDebugMaxBytes; },
        get llmDebugMaxRows() { return llmDebugMaxRows; }
    });

    const { ensureQueryIndexes, quoteSqlIdentifier, getTableColumnNames, addColumnIfMissing, getSqliteSizeStats, runStartupVacuumIfRequested, initDb } = require("./schemaLifecycle.js").createModule({
        get DB_STARTUP_VACUUM_MIN_FREE_BYTES() { return DB_STARTUP_VACUUM_MIN_FREE_BYTES; },
        get db() { return db; },
        get dbPath() { return dbPath; },
        get enforceLlmDebugLogRetention() { return enforceLlmDebugLogRetention; },
        get ensureAllCharacterAvatars() { return ensureAllCharacterAvatars; },
        get ensureAllDiaryPasswords() { return ensureAllDiaryPasswords; },
        get fs() { return fs; },
        get path() { return path; },
        get startupVacuumMarkerPath() { return startupVacuumMarkerPath; },
        get userId() { return userId; }
    });

    const { repairHistoryWindowCacheHitCounts } = require("../../features/conversation-context/cacheRepair.js").createModule({
        get db() { return db; }
    });

    const { getCharacters, getCharacter, generateDiaryPassword, hasCharacterPatchField, normalizeCharacterInteger, normalizeCharacterNumber, normalizeCharacterFlag, normalizeCharacterPatch, updateCharacter, ensureAllDiaryPasswords, ensureAllCharacterAvatars, getCharacterHiddenState, updateCharacterHiddenState } = require("../../features/characters/repository.js").createModule({
        get buildDefaultAvatarUrl() { return buildDefaultAvatarUrl; },
        get characterColumns() { return characterColumns; },
        get db() { return db; }
    });

    const { addEmotionLog, getEmotionLogs } = require("../../features/characters/emotionRepository.js").createModule({
        get db() { return db; },
        get normalizeSqlLimit() { return normalizeSqlLimit; }
    });

    const { addLlmDebugLog, getLlmDebugLogs } = require("../../features/diagnostics/modelLogsRepository.js").createModule({
        get db() { return db; },
        get enforceLlmDebugLogRetention() { return enforceLlmDebugLogRetention; },
        get normalizeSqlLimit() { return normalizeSqlLimit; }
    });

    const { normalizePixelBehaviorTreeSceneKey, getPixelBehaviorTreeState, upsertPixelBehaviorTreeState } = require("../../features/city/behaviorTreeRepository.js").createModule({
        get PIXEL_BEHAVIOR_TREE_STATE_MAX_BYTES() { return PIXEL_BEHAVIOR_TREE_STATE_MAX_BYTES; },
        get db() { return db; },
        get safeParseJson() { return safeParseJson; }
    });

    const { addReplyDispatchLog, getReplyDispatchLogs } = require("../../features/private-chat/dispatchRepository.js").createModule({
        get db() { return db; },
        get normalizeSqlLimit() { return normalizeSqlLimit; }
    });

    const { normalizeMessageRow } = require("../../features/private-chat/messageRows.js").createModule({
        get db() { return db; },
        get privateReplyVersions() { return privateReplyVersions; }, set privateReplyVersions(value) { privateReplyVersions = value; }
    });

    const { normalizeMessageTtsRow, upsertMessageTts, getMessageTts } = require("../../features/speech/repository.js").createModule({
        get db() { return db; },
        get normalizePositiveRowId() { return normalizePositiveRowId; },
        get privateReplyVersions() { return privateReplyVersions; }, set privateReplyVersions(value) { privateReplyVersions = value; }
    });

    const { escapeLikeSearchTerm, normalizeMessageSearchLimit, normalizeMessageSearchOffset, getPrivateSearchContextMessages, getGroupSearchContextMessages, searchMessages } = require("../../features/conversation-search/repository.js").createModule({
        get db() { return db; },
        get getCharacter() { return getCharacter; },
        get getUserProfile() { return getUserProfile; }
    });

    const { getLatestUserMessage, getVisibleMessages, getVisibleMessagesSince, inferCharacterCreatedAtFromId, getCharacterMessageStats, getRecentUserConversationIntel, getLastUserMessageTimestamp, hideMessagesByRange, hideMessagesByIds, unhideMessages } = require("../../features/private-chat/historyRepository.js").createModule({
        get db() { return db; },
        get getCharacter() { return getCharacter; },
        get normalizeMessageRow() { return normalizeMessageRow; }
    });

    const { getUnsummarizedMessages, countUnsummarizedMessages, getOverflowMessages, countOverflowMessages, markOverflowMessagesSummarized, markMessagesSummarized } = require("../../features/memory/privateSweepRepository.js").createModule({
        get db() { return db; }
    });

    const { clearCharacterMessageCaches } = require("../../features/conversation-context/cacheInvalidation.js").createModule({
        get db() { return db; }
    });

    const { clearMemories } = require("../../features/memory/cleanupRepository.js").createModule({
        get db() { return db; }
    });

    const { clearDiaries } = require("../../features/diaries/cleanupRepository.js").createModule({
        get db() { return db; }
    });

    const { clearConversationDigest, clearGroupConversationDigest } = require("../../features/conversation-context/digestCleanup.js").createModule({
        get db() { return db; }
    });

    const { exportCharacterData } = require("../../features/backup/exportRepository.js").createModule({
        get db() { return db; },
        get getCharacter() { return getCharacter; }
    });

    const { getMemories, getMemoriesByTimeRange, getMemory, getMemoryByDedupeKey, bindExternalMemoryToCharacters, addMemory, updateMemory, deleteMemory, markMemoriesRetrieved } = require("../../features/memory/repository.js").createModule({
        get MEMORY_UPDATE_COLUMNS() { return MEMORY_UPDATE_COLUMNS; },
        get db() { return db; },
        get getAllowedMemoryUpdateFields() { return getAllowedMemoryUpdateFields; },
        get normalizeArrayField() { return normalizeArrayField; },
        get normalizeMemoryRow() { return normalizeMemoryRow; },
        get normalizeRelationshipField() { return normalizeRelationshipField; },
        get stringifyJson() { return stringifyJson; }
    });

    const { getDiaries, addDiary, deleteDiary, unlockDiaries, setDiaryPassword, verifyAndUnlockDiary } = require("../../features/diaries/repository.js").createModule({
        get db() { return db; },
        get getCharacter() { return getCharacter; },
        get normalizePositiveRowId() { return normalizePositiveRowId; }
    });

    const { getUserProfile, normalizeProfileInteger, normalizeProfileNumber, normalizeUserProfilePatch, updateUserProfile } = require("../../features/account/profileRepository.js").createModule({
        get buildDefaultAvatarUrl() { return buildDefaultAvatarUrl; },
        get db() { return db; }
    });

    const { getJealousyState } = require("../../features/relationships/jealousyRepository.js").createModule({
        get db() { return db; }
    });

    const { getTokenUsageSummary } = require("../../features/diagnostics/usageRepository.js").createModule({
        get db() { return db; }
    });

    const { addFriend, clearFriends, clearCharRelationships } = require("../../features/relationships/friendsRepository.js").createModule({
        get db() { return db; },
        get getCharacter() { return getCharacter; }
    });

    const { clearTransfers } = require("../../features/economy/cleanupRepository.js").createModule({
        get db() { return db; }
    });

    const { getFriends, isFriend } = require("../../features/relationships/friendQueries.js").createModule({
        get db() { return db; }
    });

    const { createGroup, getGroups, getGroup, deleteGroup, normalizeGroupMessageQueryLimit, getGroupMessages, getGroupMessagesAround, getGroupMessagesAfter, getVisibleGroupMessages, getUnsummarizedGroupMessages, countUnsummarizedGroupMessages, getOverflowGroupMessages, countOverflowGroupMessages, markOverflowGroupMessagesSummarized, markGroupMessagesSummarized, initializeSweepBaseline, addGroupMessage, clearGroupMessages, deleteGroupMessages, addGroupMember, removeGroupMember, hideGroupMessagesByRange, hideGroupMessagesByIds, unhideGroupMessages } = require("../../features/group-chat/repository.js").createModule({
        get db() { return db; },
        get getCharacter() { return getCharacter; },
        get markOverflowMessagesSummarized() { return markOverflowMessagesSummarized; },
        get normalizePositiveRowId() { return normalizePositiveRowId; }
    });

    const { deleteCharacter } = require("../../features/characters/deleteCharacter.js").createModule({
        get db() { return db; },
        get deleteCharacterAttachedRows() { return deleteCharacterAttachedRows; }
    });

    const { normalizeCharRelationshipEndpoint, normalizeCharRelationshipSource, normalizeCharRelationshipAffinity, normalizeCharRelationshipImpression, initCharRelationship, getCharRelationship, getCharRelationships, updateCharRelationship, addCharImpressionHistory, normalizeImpressionHistoryLimit, getCharImpressionHistory, deleteGroupRelationships } = require("../../features/relationships/repository.js").createModule({
        get db() { return db; },
        get getCharacter() { return getCharacter; }
    });

    const { normalizeTransferAmount, normalizePaymentNote, createTransfer, getTransfer, claimTransfer, getUnclaimedTransfersFrom, refundTransfer, generateLuckyAmounts, normalizeRedPacketCount, createRedPacket, getRedPacket, claimRedPacket, getUnclaimedRedPacketsForGroup, getWallet } = require("../../features/economy/repository.js").createModule({
        get db() { return db; }
    });

    const { isCharAcquainted } = require("../../features/relationships/acquaintances.js").createModule({
        get db() { return db; }
    });

    const { rawRun } = require("./rawQuery.js").createModule({
        get db() { return db; }
    });

    const { addTokenUsage } = require("../../features/diagnostics/tokenRepository.js").createModule({
        get db() { return db; }
    });

    const { getLlmCache, incrementLlmCacheLookup, getLlmCacheStats, upsertLlmCache, deleteLlmCache, pruneExpiredLlmCache } = require("../llm/cacheRepository.js").createModule({
        get db() { return db; },
        get safeParseJson() { return safeParseJson; },
        get stringifyJson() { return stringifyJson; }
    });

    const { getPromptBlockCache, upsertPromptBlockCache, getHistoryWindowCache, getLatestHistoryWindowCache, upsertHistoryWindowCache, getConversationDigest, getGroupConversationDigest, upsertConversationDigest } = require("../../features/conversation-context/cacheRepository.js").createModule({
        get db() { return db; },
        get normalizeConversationDigestRow() { return normalizeConversationDigestRow; },
        get normalizeGroupConversationDigestRow() { return normalizeGroupConversationDigestRow; },
        get safeParseJson() { return safeParseJson; },
        get stringifyJson() { return stringifyJson; }
    });

    const { getPrivateContextSummaries, getLatestPrivateContextSummary, addPrivateContextSummary } = require("../../features/private-chat/summaryRepository.js").createModule({
        get db() { return db; }
    });

    const { upsertGroupConversationDigest } = require("../../features/group-chat/digestRepository.js").createModule({
        get db() { return db; },
        get stringifyJson() { return stringifyJson; }
    });

    

    const MEMORY_UPDATE_COLUMNS = new Set([
        'time', 'location', 'people', 'event', 'relationships', 'items', 'importance', 'embedding',
        'last_retrieved_at', 'retrieval_count', 'group_id', 'memory_type', 'summary', 'content',
        'people_json', 'items_json', 'relationship_json', 'emotion', 'source_message_ids_json',
        'dedupe_key', 'updated_at', 'is_archived', 'source_started_at', 'source_ended_at',
        'source_time_text', 'source_message_count', 'memory_tier', 'memory_focus',
        'maintenance_status', 'classification_source', 'classified_at', 'retention_score',
        'retention_action', 'retention_reason', 'retention_checked_at', 'consolidation_key',
        'consolidation_summary', 'consolidated_into_memory_id', 'archive_reason',
        'forgetting_grace_started_at', 'forgetting_grace_expires_at', 'source_context',
        'scene_tag', 'source_app', 'temporal_label', 'temporal_scope', 'temporal_anchor',
        'temporal_confidence', 'temporal_reason', 'temporal_checked_at'
    ]);

    

    

    

    

    

    // ─── Character Queries ──────────────────────────────────────────────────

    

    const characterColumns = [
        'id', 'name', 'avatar', 'avatar_frame', 'persona', 'world_info', 'api_endpoint',
        'api_key', 'model_name', 'memory_api_endpoint', 'memory_api_key',
        'memory_model_name', 'tts_enabled', 'tts_provider', 'tts_api_key', 'tts_voice', 'tts_model', 'tts_endpoint', 'tts_trigger_mode', 'tts_autoplay',
        'interval_min', 'interval_max', 'affinity', 'initial_affinity',
        'status', 'pressure_level', 'created_at', 'last_user_msg_time', 'is_blocked', 'system_prompt', 'max_tokens',
        'sys_proactive', 'sys_timer', 'sys_pressure', 'sys_jealousy', 'is_diary_unlocked', 'diary_password', 'wallet', 'emoji',
        'jealousy_level', 'jealousy_target', 'city_reply_pending', 'city_ignore_streak', 'city_last_outreach_at', 'city_post_ignore_reaction',
        'city_status_started_at', 'city_status_until_at', 'city_medical_last_recovery_at',
        'stat_int', 'stat_sta', 'stat_cha', 'energy', 'sleep_debt', 'sleep_pressure', 'mood', 'stress', 'social_need', 'explicit_emotion_state', 'health', 'satiety', 'stomach_load', 'work_distraction', 'sleep_disruption', 'llm_debug_capture',
        'sweep_limit', 'sweep_last_error', 'sweep_last_run_at', 'sweep_last_success_at', 'sweep_last_saved_count',
        'private_summary_threshold', 'private_summary_last_error', 'private_summary_last_run_at', 'private_summary_last_success_at', 'private_summary_baseline_message_id',
        // City DLC fields
        'calories', 'city_status', 'location', 'education', 'sys_survival', 'sys_city_notify', 'sys_city_social',
        'impression_q_limit', 'is_scheduled', 'city_action_frequency', 'context_msg_limit'
    ];

    // Generates a memorable random diary password (4-digit number)

    // Backfill diary passwords for existing characters that don't have one

    

    

    

    

    

    

    // ─── Message Queries ────────────────────────────────────────────────────

    const { getMessages, getMessagesBefore, getMessagesAfter, getMessagesAround, addMessage, deleteMessage, getMessageCharacterId, markMessagesRead, getUnreadCount, clearMessages, saveUserMessage } = createMessageRepository(db, {
        normalizeSqlLimit, normalizePositiveRowId, normalizeMessageRow,
        clearCharacterMessageCaches: (...args) => clearCharacterMessageCaches(...args), updateCharacter
    });

    

    

    // Returns messages excluding hidden ones — used for LLM context
    // Pass limit=0 to get ALL visible messages (no cap)

    // Hide a range of messages by index (0-based from oldest)
    

    // Hide an array of exact message IDs
    

    // Unhide all messages for a character
    

    // Overflow memory summarization support
    

    

    

    

    

    

    // ─── Memory Queries ─────────────────────────────────────────────────────

    

    // ─── Diaries ───────────────────────────────────────────────────────────

    

    // Set the diary password (called when AI generates [DIARY_PASSWORD:xxxx] tag)
    

    // Verify and unlock the diary if password matches. Returns true on success.
    

    // ─── User Profile ───────────────────────────────────────────────────────

    

    

    

    // ─── Friendship Management ──────────────────────────────────────────────
    

    // Clear all char-to-char relationships involving this character (both directions)
    

    // Clear all private transfers involving this character
    

    

    // ─── Group Chat Management ──────────────────────────────────────────────
    

    // Hide an array of exact group message IDs

    // ─── Character Management ───────────────────────────────────────────────

    

    // ─── Character Relationships (Inter-char Social System) ────────────────

    

    // ─── Private Transfer System ──────────────────────────────────────

    

    // ─── Red Packet System ──────────────────────────────────────────────────

    // Generates lucky (拼手气) amounts: random splits of total into N pieces, min 0.01 each

    // Returns { success, amount, error }
    

    // Get unclaimed red packets in a group for a specific character

    


    // --- END ENCLOSED DB FUNCTIONS ---

    // Generic SQL runner for plugin-level updates
    

    // --- Token Tracking ---
    

    

    

    

    

    const dbInstance = {

        rawRun,
        addTokenUsage,
        getLlmCache,
        getLlmCacheStats,
        getPromptBlockCache,
        getHistoryWindowCache,
        getLatestHistoryWindowCache,
        getConversationDigest,
        getGroupConversationDigest,
        getPrivateContextSummaries,
        getLatestPrivateContextSummary,
        addPrivateContextSummary,
        initDb,
        getCharacters,
        getCharacter,
        addEmotionLog,
        addLlmDebugLog,
        addReplyDispatchLog,
        getEmotionLogs,
        getLlmDebugLogs,
        getPixelBehaviorTreeState,
        upsertPixelBehaviorTreeState,
        getLlmDebugLogStats,
        enforceLlmDebugLogRetention,
        getReplyDispatchLogs,
        getCharacterHiddenState,
        updateCharacterHiddenState,
        updateCharacter,
        deleteCharacter,
        getMessages,
        getMessagesBefore,
        getMessagesAfter,
        getMessagesAround,
        searchMessages,
        getLatestUserMessage,
        getVisibleMessages,
        getVisibleMessagesSince,
        getCharacterMessageStats,
        getRecentUserConversationIntel,
        getLastUserMessageTimestamp,
        getUnsummarizedMessages,
        countUnsummarizedMessages,
        getOverflowMessages,
        countOverflowMessages,
        markOverflowMessagesSummarized,
        markMessagesSummarized,
        hideMessagesByRange,
        hideMessagesByIds,
        unhideMessages,
        addMessage,
        saveUserMessage,
        registerPrivateReply: (...args) => privateReplyVersions.register(...args),
        getPrivateReplyRun: (...args) => privateReplyVersions.getRun(...args),
        selectPrivateReplyVersion: (...args) => privateReplyVersions.select(...args),
        upsertMessageTts,
        getMessageTts,
        deleteMessage,
        markMessagesRead,
        getUnreadCount,
        getMessageCharacterId,
        clearMessages,
        clearCharacterMessageCaches,
        clearMemories,
        clearDiaries,
        clearConversationDigest,
        clearGroupConversationDigest,
        exportCharacterData,
        getMemories,
        getMemoriesByTimeRange,
        getMemory,
        getMemoryByDedupeKey,
        bindExternalMemoryToCharacters,
        addMemory,
        markMemoriesRetrieved,
        updateMemory,
        deleteMemory,
        getDiaries,
        addDiary,
        deleteDiary,
        unlockDiaries,
        setDiaryPassword,
        verifyAndUnlockDiary,
        getUserProfile,
        updateUserProfile,
        getJealousyState,
        getTokenUsageSummary,
        pruneExpiredLlmCache,
        addFriend,
        clearFriends,
        clearCharRelationships,
        clearTransfers,
        getFriends,
        isFriend,
        createGroup,
        getGroups,
        getGroup,
        deleteGroup,
        getGroupMessages,
        getGroupMessagesAfter,
        getGroupMessagesAround,
        addGroupMessage,
        clearGroupMessages,
        deleteGroupMessages,
        addGroupMember,
        removeGroupMember,
        getVisibleGroupMessages,
        getUnsummarizedGroupMessages,
        countUnsummarizedGroupMessages,
        getOverflowGroupMessages,
        countOverflowGroupMessages,
        markOverflowGroupMessagesSummarized,
        markGroupMessagesSummarized,
        initializeSweepBaseline,
        hideGroupMessagesByRange,
        hideGroupMessagesByIds,
        unhideGroupMessages,
        initCharRelationship,
        getCharRelationship,
        getCharRelationships,
        updateCharRelationship,
        addCharImpressionHistory,
        getCharImpressionHistory,
        deleteGroupRelationships,
        isCharAcquainted,
        // Private Transfer
        createTransfer,
        getTransfer,
        claimTransfer,
        refundTransfer,
        getUnclaimedTransfersFrom,
        // Red Packet
        createRedPacket,
        getRedPacket,
        claimRedPacket,
        getUnclaimedRedPacketsForGroup,
        getWallet,
        incrementLlmCacheLookup,
        deleteLlmCache,
        upsertLlmCache,
        upsertPromptBlockCache,
        upsertHistoryWindowCache,
        upsertConversationDigest,
        upsertGroupConversationDigest,
        getRawDb: () => db,
        close: () => db.close(),
        getDbPath: () => dbPath,
        checkpoint: () => {
            try { db.pragma('wal_checkpoint(RESTART)'); } catch (e) { }
        },
        backup: async (destPath) => {
            db.pragma('wal_checkpoint(TRUNCATE)');
            return db.backup(destPath);
        }
    };

    try {
        initDb(); // auto-initialize tables for this user's db if they don't exist
        privateReplyVersions = createPrivateReplyVersions(db, {
            normalizeMessage: normalizeMessageRow,
            invalidateContext: (characterId, firstMessageId) => {
                clearCharacterMessageCaches(characterId);
                const summary = db.prepare('SELECT MIN(start_message_id) AS start FROM private_context_summaries WHERE character_id = ? AND end_message_id >= ?')
                    .get(characterId, firstMessageId);
                const restartAt = Math.min(firstMessageId, summary?.start || firstMessageId);
                db.prepare('DELETE FROM private_context_summaries WHERE character_id = ? AND end_message_id >= ?').run(characterId, restartAt);
                db.prepare('UPDATE characters SET private_summary_baseline_message_id = MIN(COALESCE(private_summary_baseline_message_id, 0), ?) WHERE id = ?')
                    .run(Math.max(0, restartAt - 1), characterId);
            }
        });
        repairHistoryWindowCacheHitCounts();
    } catch (error) {
        db.close();
        throw error;
    }

    userDbCache.set(userId, dbInstance);
    return dbInstance;
}

function markUserDbDeleting(userId) {
    if (!userId) return;
    deletingUserDbIds.add(String(userId));
}

function unmarkUserDbDeleting(userId) {
    if (!userId) return;
    deletingUserDbIds.delete(String(userId));
}

function isUserDbDeleting(userId) {
    return deletingUserDbIds.has(String(userId));
}

module.exports = {
    getUserDb,
    userDbCache,
    markUserDbDeleting,
    unmarkUserDbDeleting,
    isUserDbDeleting,
    beginUserDbMaintenance
};
