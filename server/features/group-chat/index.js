const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildUniversalContext } = require("../conversation-context/index.js");
const { getAdaptiveTailWindowSize } = require("../conversation-context/window.js");
const { applyEmotionEvent, getEmotionBehaviorGuidance, buildEmotionLogEntry } = require("../characters/emotion.js");
const { getTokenCount } = require("../../platform/llm/tokenizer.js");

function initGroupChatPlugin(app, context) {
    const {
        wss, getWsClients, authDb, authMiddleware,
        getUserDb, getEngine, getMemory, callLLM
    } = context;
    const GROUP_HIDDEN_TAG_REGEX = /\[(?:CHAR_AFFINITY|AFFINITY|DIARY|UNLOCK_DIARY|PRESSURE|TIMER|TRANSFER|DIARY_PASSWORD|Red Packet|REDPACKET_SEND)[^\]]*\]/gi;

    const { recordGroupTokenUsage, isAsciiMentionContinuation, readMentionTokenAfterAt, resolveMentionedGroupCharacterIds, buildGroupAttemptRecorder, logEmotionTransition, triggerGroupAIChain } = require("./runtime/operations.js").createModule({
        get applyEmotionEvent() { return applyEmotionEvent; },
        get buildCompactGroupAntiRepeat() { return buildCompactGroupAntiRepeat; },
        get buildEmotionLogEntry() { return buildEmotionLogEntry; },
        get buildUniversalContext() { return buildUniversalContext; },
        get callLLM() { return callLLM; },
        get context() { return context; },
        get getAdaptiveTailWindowSize() { return getAdaptiveTailWindowSize; },
        get getCachedGroupPromptBlock() { return getCachedGroupPromptBlock; },
        get getEmotionBehaviorGuidance() { return getEmotionBehaviorGuidance; },
        get getEngine() { return getEngine; },
        get getGroupRuntimeKey() { return getGroupRuntimeKey; },
        get getMemory() { return getMemory; },
        get getUserDb() { return getUserDb; },
        get groupDebounceTimers() { return groupDebounceTimers; },
        get groupPendingMentions() { return groupPendingMentions; },
        get groupReplyLock() { return groupReplyLock; },
        get noChainGroups() { return noChainGroups; },
        get normalizeGeneratedRedPacketAmount() { return normalizeGeneratedRedPacketAmount; },
        get normalizeGeneratedRedPacketCount() { return normalizeGeneratedRedPacketCount; },
        get normalizeGeneratedRedPacketType() { return normalizeGeneratedRedPacketType; },
        get normalizeMentionName() { return normalizeMentionName; },
        get parseGeneratedAffinityDelta() { return parseGeneratedAffinityDelta; },
        get parseGeneratedCharAffinityDeltas() { return parseGeneratedCharAffinityDeltas; },
        get pausedGroups() { return pausedGroups; },
        get recordGroupLlmDebug() { return recordGroupLlmDebug; },
        get stripGroupHiddenTags() { return stripGroupHiddenTags; }
    });

    const { stripGroupHiddenTags, normalizeGeneratedIntegerInRange, compactGroupPreview, normalizeMentionName, normalizeGroupIntegerSetting, normalizeGroupBooleanSetting, normalizeGroupName, normalizeGeneratedRedPacketType, normalizeGeneratedRedPacketAmount, normalizeGeneratedRedPacketCount, buildCompactGroupAntiRepeat } = require("./runtime/validation.js").createModule({
        get GENERATED_RED_PACKET_TYPES() { return GENERATED_RED_PACKET_TYPES; },
        get GROUP_HIDDEN_TAG_REGEX() { return GROUP_HIDDEN_TAG_REGEX; }
    });

    const { parseGeneratedAffinityDelta, parseGeneratedCharAffinityDeltas, normalizeGroupMemberIds, getInvalidGroupMemberIds } = require("./runtime/relationships.js").createModule({
        get normalizeGeneratedIntegerInRange() { return normalizeGeneratedIntegerInRange; }
    });

    const { getCachedGroupPromptBlock, normalizeGroupMessageLimit, recordGroupLlmDebug } = require("./runtime/conversation.js").createModule({
        get crypto() { return crypto; }
    });

    const { getGroupRuntimeKey, clearGroupRuntimeState } = require("./runtime/scheduling.js").createModule({
        get groupDebounceTimers() { return groupDebounceTimers; },
        get groupInterrupt() { return groupInterrupt; },
        get groupPendingMentions() { return groupPendingMentions; },
        get groupReplyLock() { return groupReplyLock; },
        get noChainGroups() { return noChainGroups; },
        get pausedGroups() { return pausedGroups; }
    });

    

    

    

    const GENERATED_RED_PACKET_TYPES = new Set(['fixed', 'lucky']);

    // We will extract DB from req.db like original index.js did

    // 14.1 List all groups
    require("./http/get-groups.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; } });

    // 14.2 Create a group
    require("./http/post-groups.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getInvalidGroupMemberIds() { return getInvalidGroupMemberIds; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizeGroupMemberIds() { return normalizeGroupMemberIds; }, get normalizeGroupName() { return normalizeGroupName; } });

    // 14.2.5 Update group settings (inject_limit, name, etc.)
    require("./http/put-groups-id.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizeGroupBooleanSetting() { return normalizeGroupBooleanSetting; }, get normalizeGroupIntegerSetting() { return normalizeGroupIntegerSetting; }, get normalizeGroupName() { return normalizeGroupName; } });

    // 14.3 Get group messages
    require("./http/get-groups-id-messages.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizeGroupMessageLimit() { return normalizeGroupMessageLimit; } });


    // 14.6 Add member to group (with system announcement + AI reactions)
    require("./http/post-groups-id-members.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get triggerGroupAIChain() { return triggerGroupAIChain; } });

    // 14.7 Kick member from group (with system announcement + AI reactions)
    require("./http/delete-groups-id-members-memberId.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get triggerGroupAIChain() { return triggerGroupAIChain; } });

    // 14.8 Dissolve (delete) group
    require("./http/delete-groups-id.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get clearGroupRuntimeState() { return clearGroupRuntimeState; }, get getEngine() { return getEngine; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; } });

    // 14.9 Clear group messages
    require("./http/delete-groups-id-messages.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; } });

    // 14.9b Batch-delete specific group messages
    require("./http/post-groups-id-messages-batch-delete.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getUserDb() { return getUserDb; } });

    // Group Chat Debounce System
    // When user sends multiple messages quickly, we wait until they stop, then fire ONE AI reply chain.
    const groupDebounceTimers = {}; // { userId:groupId: timeoutHandle }
    const groupReplyLock = {};
    const groupInterrupt = {};     // { userId:groupId: true } prevents overlapping chains
    const pausedGroups = new Set(); // groups where AI replies are paused by user
    const noChainGroups = new Set(); // groups where AI-to-AI secondary @-mention chains are blocked
    const groupPendingMentions = {}; // { userId:groupId: { ids: Set, isAtAll: bool } } accumulates mentions across debounce resets

    

    // 14.10 Set AI pause for a group
    require("./http/post-groups-id-ai-pause.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getGroupRuntimeKey() { return getGroupRuntimeKey; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get groupDebounceTimers() { return groupDebounceTimers; }, get groupReplyLock() { return groupReplyLock; }, get pausedGroups() { return pausedGroups; } });

    require("./http/get-groups-id-ai-pause.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getGroupRuntimeKey() { return getGroupRuntimeKey; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get pausedGroups() { return pausedGroups; } });

    // 14.11 Toggle AI-to-AI secondary @-mention chain for a group
    require("./http/post-groups-id-no-chain.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getGroupRuntimeKey() { return getGroupRuntimeKey; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get noChainGroups() { return noChainGroups; } });

    require("./http/get-groups-id-no-chain.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getEngine() { return getEngine; }, get getGroupRuntimeKey() { return getGroupRuntimeKey; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get noChainGroups() { return noChainGroups; } });

    // Register the group chain callback so the core WS handler can wire it into the engine
    context.hooks.groupChainCallback = triggerGroupAIChain;

    // 14.4 Send message to group (user sends)
    require("./http/post-groups-id-messages.js").register({ get app() { return app; }, get applyEmotionEvent() { return applyEmotionEvent; }, get authMiddleware() { return authMiddleware; }, get context() { return context; }, get getEngine() { return getEngine; }, get getGroupRuntimeKey() { return getGroupRuntimeKey; }, get getMemory() { return getMemory; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get groupDebounceTimers() { return groupDebounceTimers; }, get groupPendingMentions() { return groupPendingMentions; }, get logEmotionTransition() { return logEmotionTransition; }, get resolveMentionedGroupCharacterIds() { return resolveMentionedGroupCharacterIds; }, get triggerGroupAIChain() { return triggerGroupAIChain; } });

};

module.exports = initGroupChatPlugin;

