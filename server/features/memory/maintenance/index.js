const { callLLM } = require("../../../platform/llm/client.js");
const {
    normalizeMemoryMaintenanceSettingsPatch,
    normalizeMemoryMaintenanceBatchOptions
} = require("../inputGuards.js");

let externalSourceAppLabelResolver = (sourceApp = '') => String(sourceApp || '').trim() || 'External App';

const { configureMemoryMaintenanceService, parseBooleanFlag, stripBom, firstImportString, tryParseJsonValue, safeJsonParse, clampNumber, daysBetween, getMemoryLastUsefulAt, detectRoutineCityMemory, hasProtectedMemorySignal, buildMemoryMaintenancePayload, normalizeExternalProcessingState, makeExternalProcessingKey, getExternalSceneTag, cleanExternalSpeakerName, isLikelyUserSpeaker, normalizeExternalCharacterName, getExternalImportRows, getExternalCharacterName, hasCjkText, buildMemoryMaintenanceAttemptError, isNonRetryableMemoryMaintenanceError, buildMemoryMaintenanceNoProgressAttempt, appendExternalImportProcessingEntries, applyExternalImportMigrationItems, incrementCount, clipMemoryDisplayText, quoteSqlIdentifier, getTableColumnSet, parseMemorySourceIds, hasExternalMemorySourceSignal, inferMemorySourceContext, inferMemorySceneTag, getPositiveMin, updateFormalMemoryGraceRows, isMaskedSecretInput, normalizeManualMemoryPatch } = require("./normalization.js").createModule({
        get MEMORY_MAINTENANCE_FOCUS() { return MEMORY_MAINTENANCE_FOCUS; },
        get MEMORY_MAINTENANCE_TIERS() { return MEMORY_MAINTENANCE_TIERS; },
        get MEMORY_SCENE_TAGS() { return MEMORY_SCENE_TAGS; },
        get MEMORY_SOURCE_CONTEXTS() { return MEMORY_SOURCE_CONTEXTS; },
        get MEMORY_TEMPORAL_BINDING_LABELS() { return MEMORY_TEMPORAL_BINDING_LABELS; },
        get MEMORY_TEMPORAL_BINDING_SCOPES() { return MEMORY_TEMPORAL_BINDING_SCOPES; },
        get computeDaysUntilRetentionThreshold() { return computeDaysUntilRetentionThreshold; },
        get computeMemoryForgettingWindow() { return computeMemoryForgettingWindow; },
        get computeMemoryRetention() { return computeMemoryRetention; },
        get externalSourceAppLabelResolver() { return externalSourceAppLabelResolver; }, set externalSourceAppLabelResolver(value) { externalSourceAppLabelResolver = value; },
        get getMemoryRetentionThreshold() { return getMemoryRetentionThreshold; }
    });

const { getExternalSourceAppLabel, buildMemoryTemporalBindingPayload, getMemoryTemporalBindingBatch, buildMemoryTemporalBindingPrompt, normalizeTemporalBindingResult, buildTemporalBindingApplyItems, expandTemporalBindingApplyItemsForFormalBatch, runMemoryTemporalBindingBatch, getMemoryTemporalSignalSql, getMemoryTemporalSignalParams, normalizeMemoryTemporalBindingSource } = require("./temporal.js").createModule({
        get MEMORY_SCENE_TAGS() { return MEMORY_SCENE_TAGS; },
        get MEMORY_SOURCE_CONTEXTS() { return MEMORY_SOURCE_CONTEXTS; },
        get MEMORY_TEMPORAL_BINDING_LABELS() { return MEMORY_TEMPORAL_BINDING_LABELS; },
        get MEMORY_TEMPORAL_BINDING_SCOPES() { return MEMORY_TEMPORAL_BINDING_SCOPES; },
        get MEMORY_TEMPORAL_SIGNAL_TERMS() { return MEMORY_TEMPORAL_SIGNAL_TERMS; },
        get applyMemoryMaintenanceItems() { return applyMemoryMaintenanceItems; },
        get callLLM() { return callLLM; },
        get clampNumber() { return clampNumber; },
        get clipMemoryDisplayText() { return clipMemoryDisplayText; },
        get externalSourceAppLabelResolver() { return externalSourceAppLabelResolver; }, set externalSourceAppLabelResolver(value) { externalSourceAppLabelResolver = value; },
        get extractJsonObjectFromText() { return extractJsonObjectFromText; },
        get getMemoryMaintenanceStats() { return getMemoryMaintenanceStats; },
        get hasCjkText() { return hasCjkText; },
        get inferMemorySceneTag() { return inferMemorySceneTag; },
        get inferMemorySourceContext() { return inferMemorySourceContext; },
        get normalizeMemoryMaintenanceBatchOptions() { return normalizeMemoryMaintenanceBatchOptions; },
        get parseBooleanFlag() { return parseBooleanFlag; }
    });

const MEMORY_MAINTENANCE_FOCUS = new Set(['user_profile', 'user_current_arc', 'relationship', 'general']);
const MEMORY_MAINTENANCE_TIERS = new Set(['core', 'active', 'ambient']);
const MEMORY_MAINTENANCE_STATUS = new Set(['pending', 'classified', 'needs_review', 'consolidated', 'ignored']);
const MEMORY_MAINTENANCE_ACTIONS = new Set(['keep', 'downgrade', 'archive_candidate', 'merge_candidate', 'superseded', 'needs_review']);
const MEMORY_SOURCE_CONTEXTS = new Set(['private_chat', 'group_chat', 'commercial_street', 'external_app', 'unknown']);
const MEMORY_SCENE_TAGS = new Set(['none', 'private_chat', 'group_chat', 'commercial_street', 'external_gpt', 'external_gemini', 'external_sillytavern', 'external_app', 'other']);
const MEMORY_SOURCE_CONTEXT_DEFINITIONS = [
    {
        key: 'private_chat',
        label: '私聊来源',
        description: '来自用户与当前对象的一对一对话。它是来源场景，不等于 user_profile/relationship 等语义分类。'
    },
    {
        key: 'group_chat',
        label: '群聊来源',
        description: '来自群聊消息。群聊只作为来源场景显示，具体内容仍会归入用户画像、关系、当前阶段或普通事件。'
    },
    {
        key: 'commercial_street',
        label: '商业街来源',
        description: '来自商业街/city 行动、工厂、餐厅、便利店、公园、回家、日结等生活日志。默认是当前对象自己的行动。'
    },
    {
        key: 'external_app',
        label: '外部 App 来源',
        description: '来自 GPT、Gemini、SillyTavern 等外部 App 导入记忆。'
    },
    {
        key: 'unknown',
        label: '来源未明',
        description: '暂时无法判断来源场景的正式记忆，后续可用补充 prompt 再打标签。'
    }
];
const MEMORY_FORGETTING_GRACE_MS = 24 * 60 * 60 * 1000;
const MEMORY_TEMPORAL_BINDING_LABELS = new Set([
    'temporary_body_state',
    'temporary_emotion',
    'deadline_or_plan',
    'temporary_location',
    'recent_phase',
    'single_event_state',
    'cyclic_state',
    'other'
]);
const MEMORY_TEMPORAL_BINDING_SCOPES = new Set([
    'single_day',
    'recent_period',
    'until_event_end',
    'cyclic',
    'unknown'
]);
const MEMORY_TEMPORAL_SIGNAL_TERMS = [
    '今天', '昨天', '明天', '今晚', '今早', '刚刚', '刚才', '现在', '此刻', '当下',
    '近期', '最近', '这周', '本周', '这几天', '这段时间', '短期', '临时', '当天',
    '上次', '这次', '那次', '当时', '阶段', '周期', '一次性', '临时状态', '身体状态',
    '情绪状态', '短期状态', '近期状态', '失眠', '困', '疲惫', '焦虑', '崩溃', '心情', '压力',
    'today', 'yesterday', 'tomorrow', 'tonight', 'recent', 'now', 'temporary'
];

const { computeMemoryRetention, getMemoryRetentionThreshold, computeDaysUntilRetentionThreshold, computeMemoryForgettingWindow, ensureForgettingGraceWindows, getExpiredForgettingMemoryRows, compareMemoryForgettingItems, buildMemoryForgettingGroups, applyFormalMemoryForgettingState } = require("./retention.js").createModule({
        get MEMORY_FORGETTING_GRACE_MS() { return MEMORY_FORGETTING_GRACE_MS; },
        get clampNumber() { return clampNumber; },
        get daysBetween() { return daysBetween; },
        get detectRoutineCityMemory() { return detectRoutineCityMemory; },
        get getMemoryLastUsefulAt() { return getMemoryLastUsefulAt; },
        get getMemoryLibraryRowSelect() { return getMemoryLibraryRowSelect; },
        get getPositiveMin() { return getPositiveMin; },
        get getTableColumnSet() { return getTableColumnSet; },
        get hasProtectedMemorySignal() { return hasProtectedMemorySignal; },
        get updateFormalMemoryGraceRows() { return updateFormalMemoryGraceRows; }
    });

const { getMemoryMaintenanceBatch, getExternalImportMaintenanceBatch, applyMemoryMaintenanceItems, refreshMaintenanceMemoryIndex, runMemoryMaintenanceBatch, rescueMemoryMaintenanceItems } = require("./execution.js").createModule({
        get MEMORY_FORGETTING_GRACE_MS() { return MEMORY_FORGETTING_GRACE_MS; },
        get MEMORY_MAINTENANCE_ACTIONS() { return MEMORY_MAINTENANCE_ACTIONS; },
        get MEMORY_MAINTENANCE_FOCUS() { return MEMORY_MAINTENANCE_FOCUS; },
        get MEMORY_MAINTENANCE_STATUS() { return MEMORY_MAINTENANCE_STATUS; },
        get MEMORY_MAINTENANCE_TIERS() { return MEMORY_MAINTENANCE_TIERS; },
        get MEMORY_SCENE_TAGS() { return MEMORY_SCENE_TAGS; },
        get MEMORY_SOURCE_CONTEXTS() { return MEMORY_SOURCE_CONTEXTS; },
        get MEMORY_TEMPORAL_BINDING_LABELS() { return MEMORY_TEMPORAL_BINDING_LABELS; },
        get MEMORY_TEMPORAL_BINDING_SCOPES() { return MEMORY_TEMPORAL_BINDING_SCOPES; },
        get applyExternalImportMigrationItems() { return applyExternalImportMigrationItems; },
        get buildExternalImportPendingItems() { return buildExternalImportPendingItems; },
        get buildMemoryMaintenancePayload() { return buildMemoryMaintenancePayload; },
        get buildMemoryMigrationPrompt() { return buildMemoryMigrationPrompt; },
        get callLLM() { return callLLM; },
        get clampNumber() { return clampNumber; },
        get computeMemoryRetention() { return computeMemoryRetention; },
        get extractJsonObjectFromText() { return extractJsonObjectFromText; },
        get firstImportString() { return firstImportString; },
        get getExternalImportPendingCountForCharacter() { return getExternalImportPendingCountForCharacter; },
        get getMemoryMaintenanceStats() { return getMemoryMaintenanceStats; },
        get inferMemorySceneTag() { return inferMemorySceneTag; },
        get inferMemorySourceContext() { return inferMemorySourceContext; },
        get normalizeMemoryMaintenanceBatchOptions() { return normalizeMemoryMaintenanceBatchOptions; },
        get normalizeSmallModelMigrationResult() { return normalizeSmallModelMigrationResult; },
        get parseBooleanFlag() { return parseBooleanFlag; }
    });

const { buildExternalImportPendingItems, getExternalImportPendingCountForCharacter, getExternalImportPendingStatsByCharacter, getMemoryMaintenanceStats, clampMemoryLibraryLimit, getMemoryLibraryRowSelect, buildMemoryLibraryItem, buildNewMemorySummaryLibrary, getMemoryMaintenanceLibrary, getMemoryMaintenanceOverview, buildMemoryIndexTargets } = require("./library.js").createModule({
        get MEMORY_LIBRARY_FOCUS_DEFINITIONS() { return MEMORY_LIBRARY_FOCUS_DEFINITIONS; },
        get MEMORY_LIBRARY_ROW_COLUMNS() { return MEMORY_LIBRARY_ROW_COLUMNS; },
        get MEMORY_SOURCE_CONTEXT_DEFINITIONS() { return MEMORY_SOURCE_CONTEXT_DEFINITIONS; },
        get applyFormalMemoryForgettingState() { return applyFormalMemoryForgettingState; },
        get buildMemoryForgettingGroups() { return buildMemoryForgettingGroups; },
        get clipMemoryDisplayText() { return clipMemoryDisplayText; },
        get compareMemoryForgettingItems() { return compareMemoryForgettingItems; },
        get computeDaysUntilRetentionThreshold() { return computeDaysUntilRetentionThreshold; },
        get computeMemoryForgettingWindow() { return computeMemoryForgettingWindow; },
        get computeMemoryRetention() { return computeMemoryRetention; },
        get ensureForgettingGraceWindows() { return ensureForgettingGraceWindows; },
        get getExternalCharacterName() { return getExternalCharacterName; },
        get getExternalImportRows() { return getExternalImportRows; },
        get getExternalSceneTag() { return getExternalSceneTag; },
        get getExternalSourceAppLabel() { return getExternalSourceAppLabel; },
        get getMemoryTemporalSignalParams() { return getMemoryTemporalSignalParams; },
        get getMemoryTemporalSignalSql() { return getMemoryTemporalSignalSql; },
        get getTableColumnSet() { return getTableColumnSet; },
        get incrementCount() { return incrementCount; },
        get inferMemorySceneTag() { return inferMemorySceneTag; },
        get inferMemorySourceContext() { return inferMemorySourceContext; },
        get makeExternalProcessingKey() { return makeExternalProcessingKey; },
        get normalizeExternalCharacterName() { return normalizeExternalCharacterName; },
        get normalizeExternalProcessingState() { return normalizeExternalProcessingState; },
        get parseBooleanFlag() { return parseBooleanFlag; },
        get quoteSqlIdentifier() { return quoteSqlIdentifier; },
        get safeJsonParse() { return safeJsonParse; }
    });

const { buildMemoryMigrationPrompt, extractJsonObjectFromText, normalizeSmallModelMigrationResult, getMemoryMaintenanceSettings, redactMemoryMaintenanceSettings, updateMemoryMaintenanceSettings } = require("./configuration.js").createModule({
        get MEMORY_SCENE_TAGS() { return MEMORY_SCENE_TAGS; },
        get MEMORY_SOURCE_CONTEXTS() { return MEMORY_SOURCE_CONTEXTS; },
        get MEMORY_TEMPORAL_BINDING_LABELS() { return MEMORY_TEMPORAL_BINDING_LABELS; },
        get MEMORY_TEMPORAL_BINDING_SCOPES() { return MEMORY_TEMPORAL_BINDING_SCOPES; },
        get clampNumber() { return clampNumber; },
        get clipMemoryDisplayText() { return clipMemoryDisplayText; },
        get hasCjkText() { return hasCjkText; },
        get isMaskedSecretInput() { return isMaskedSecretInput; },
        get normalizeMemoryMaintenanceSettingsPatch() { return normalizeMemoryMaintenanceSettingsPatch; }
    });

const MEMORY_LIBRARY_FOCUS_DEFINITIONS = [
    {
        key: 'user_profile',
        label: '用户画像分类',
        description: '长期稳定的用户身份、偏好、背景、边界、长期目标，以及明确长期存在的约束。带日期、一次性或情境性的状态/事件不归入这里。'
    },
    {
        key: 'relationship',
        label: '关系记忆分类',
        description: '用户与角色之间的承诺、冲突、和解、告白、亲密度变化和相处边界。决定角色如何看待这段关系。'
    },
    {
        key: 'user_current_arc',
        label: '当前阶段分类',
        description: '用户近期或过去某一阶段正在经历的事情、短期计划、压力、情绪、当前任务，以及带时间锚的一次性或情境性状态/事件。时效性强，会更早进入遗忘曲线。'
    },
    {
        key: 'general',
        label: '普通事件分类',
        description: '不属于画像、关系、当前阶段的普通事实和背景事件。重要性低且长期未调用时会优先降级或归档。'
    }
];

const MEMORY_LIBRARY_ROW_COLUMNS = [
    'id',
    'character_id',
    'time',
    'location',
    'people',
    'event',
    'relationships',
    'items',
    'importance',
    'created_at',
    'group_id',
    'last_retrieved_at',
    'retrieval_count',
    'memory_type',
    'summary',
    'content',
    'people_json',
    'items_json',
    'relationship_json',
    'emotion',
    'source_message_ids_json',
    'dedupe_key',
    'updated_at',
    'is_archived',
    'source_started_at',
    'source_ended_at',
    'source_time_text',
    'source_message_count',
    'memory_tier',
    'memory_focus',
    'maintenance_status',
    'classification_source',
    'classified_at',
    'retention_score',
    'retention_action',
    'retention_reason',
    'retention_checked_at',
    'consolidation_key',
    'consolidation_summary',
    'consolidated_into_memory_id',
    'archive_reason',
    'forgetting_grace_started_at',
    'forgetting_grace_expires_at',
    'source_context',
    'scene_tag',
    'source_app',
    'temporal_label',
    'temporal_scope',
    'temporal_anchor',
    'temporal_confidence',
    'temporal_reason',
    'temporal_checked_at'
];

module.exports = {
    parseMemorySourceIds, inferMemorySourceContext, inferMemorySceneTag, buildMemoryMaintenanceNoProgressAttempt, buildMemoryMaintenanceAttemptError, isNonRetryableMemoryMaintenanceError, normalizeExternalProcessingState, clipMemoryDisplayText, hasCjkText,
    configureMemoryMaintenanceService,
    MEMORY_MAINTENANCE_FOCUS,
    MEMORY_MAINTENANCE_TIERS,
    MEMORY_MAINTENANCE_STATUS,
    MEMORY_MAINTENANCE_ACTIONS,
    MEMORY_SOURCE_CONTEXTS,
    MEMORY_SCENE_TAGS,
    MEMORY_SOURCE_CONTEXT_DEFINITIONS,
    MEMORY_TEMPORAL_BINDING_LABELS,
    MEMORY_TEMPORAL_BINDING_SCOPES,
    getMemoryMaintenanceBatch,
    getExternalImportPendingCountForCharacter,
    getExternalImportPendingStatsByCharacter,
    getExternalImportMaintenanceBatch,
    getMemoryTemporalBindingBatch,
    buildMemoryMigrationPrompt,
    buildMemoryTemporalBindingPrompt,
    extractJsonObjectFromText,
    normalizeSmallModelMigrationResult,
    normalizeTemporalBindingResult,
    buildTemporalBindingApplyItems,
    expandTemporalBindingApplyItemsForFormalBatch,
    applyMemoryMaintenanceItems,
    refreshMaintenanceMemoryIndex,
    getMemoryMaintenanceStats,
    runMemoryMaintenanceBatch,
    runMemoryTemporalBindingBatch,
    normalizeMemoryTemporalBindingSource,
    getExpiredForgettingMemoryRows,
    getMemoryMaintenanceLibrary,
    getMemoryMaintenanceOverview,
    getMemoryMaintenanceSettings,
    redactMemoryMaintenanceSettings,
    updateMemoryMaintenanceSettings,
    normalizeManualMemoryPatch,
    buildMemoryIndexTargets,
    rescueMemoryMaintenanceItems
};
