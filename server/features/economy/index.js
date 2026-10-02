/**
 * Economy DLC — Private Transfers, Wallet, Red Packets
 * Extracted from server/index.js
 */
module.exports = function initEconomy(app, context) {
    const { authMiddleware, getUserDb, getEngine, getMemory, getWsClients, callLLM } = context;
    const MAX_RED_PACKET_COUNT = 100;

    const { normalizePositiveMoney, normalizePaymentNote, normalizePacketCount, normalizeRedPacketId, normalizeTransferId } = require("./runtime/validation.js").createModule({
        get MAX_RED_PACKET_COUNT() { return MAX_RED_PACKET_COUNT; }
    });

    // ─── Private Transfer APIs ────────────────────────────────────────────────

    // Get transfer info
    require("./http/get-transfers-tid.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getUserDb() { return getUserDb; }, get normalizeTransferId() { return normalizeTransferId; } });

    // Claim a private transfer (recipient clicks "Claim")
    require("./http/post-transfers-tid-claim.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get callLLM() { return callLLM; }, get getEngine() { return getEngine; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizeTransferId() { return normalizeTransferId; } });

    // Refund a private transfer (FIXED: includes time elapsed + recent conversation context)
    require("./http/post-transfers-tid-refund.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get callLLM() { return callLLM; }, get getEngine() { return getEngine; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizeTransferId() { return normalizeTransferId; } });

    // User sends a transfer to a character
    require("./http/post-characters-id-transfer.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get callLLM() { return callLLM; }, get getEngine() { return getEngine; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizePaymentNote() { return normalizePaymentNote; }, get normalizePositiveMoney() { return normalizePositiveMoney; } });

    // ─── Red Packet APIs ─────────────────────────────────────────────────────

    // Get wallet balance
    require("./http/get-wallet-id.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getUserDb() { return getUserDb; } });

    // Create a red packet from the authenticated user. Character-sent packets use direct DB calls.
    require("./http/post-groups-id-redpackets.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get context() { return context; }, get getEngine() { return getEngine; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizePacketCount() { return normalizePacketCount; }, get normalizePaymentNote() { return normalizePaymentNote; }, get normalizePositiveMoney() { return normalizePositiveMoney; } });

    // Get red packet details + claims
    require("./http/get-groups-id-redpackets-pid.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getUserDb() { return getUserDb; }, get normalizeRedPacketId() { return normalizeRedPacketId; } });

    // Claim a red packet
    require("./http/post-groups-id-redpackets-pid-claim.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getUserDb() { return getUserDb; }, get getWsClients() { return getWsClients; }, get normalizeRedPacketId() { return normalizeRedPacketId; } });

    console.log('[Economy DLC] Transfer, Wallet, Red Packet routes registered.');
};
