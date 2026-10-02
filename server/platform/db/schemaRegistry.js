// Preserve the established table/index creation order across feature-owned schemas.
function initializeSchemas(db) {
    db.exec([
        require("../../features/characters/schema.js")["characters"],
        require("../../features/private-chat/schema.js")["messages"],
        require("../../features/speech/schema.js")["message_tts"],
        require("../../features/memory/schema.js")["memories"],
        require("../../features/memory/schema.js")["external_memory_imports"],
        require("../../features/memory/schema.js")["external_memory_role_bindings"],
        require("../../features/diaries/schema.js")["diaries"],
        require("../../features/account/schema.js")["user_profile"],
        require("../../features/relationships/schema.js")["character_friends"],
        require("../../features/diagnostics/schema.js")["token_usage"],
        require("../llm/schema.js")["llm_cache"],
        require("../llm/schema.js")["llm_cache_stats"],
        require("../../features/characters/schema.js")["emotion_logs"],
        require("../../features/diagnostics/schema.js")["llm_debug_logs"],
        require("../../features/city/schema.js")["pixel_behavior_tree_states"],
        require("../../features/private-chat/schema.js")["reply_dispatch_logs"],
        require("../../features/conversation-context/schema.js")["prompt_block_cache"],
        require("../../features/conversation-context/schema.js")["history_window_cache"],
        require("../../features/conversation-context/schema.js")["conversation_digest_cache"],
        require("../../features/private-chat/schema.js")["private_context_summaries"],
        require("../../features/group-chat/schema.js")["group_conversation_digest_cache"],
        require("../../features/group-chat/schema.js")["group_chats"],
        require("../../features/group-chat/schema.js")["group_members"],
        require("../../features/group-chat/schema.js")["group_messages"],
        require("../../features/relationships/schema.js")["char_relationships"],
        require("../../features/relationships/schema.js")["char_impression_history"],
        require("../../features/economy/schema.js")["group_red_packets"],
        require("../../features/economy/schema.js")["group_red_packet_claims"],
        require("../../features/economy/schema.js")["private_transfers"]
    ].join(''));
}
module.exports = { initializeSchemas };
