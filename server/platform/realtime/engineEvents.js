// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function broadcastEngineState(wsClients) {
        if (!wsClients || wsClients.size === 0) return;

        const allChars = dependencies.db.getCharacters();
        const charMap = {};
        for (const c of allChars) charMap[c.id] = c;

        const stateData = {};
        for (const [charId, timerData] of dependencies.timers.entries()) {
            const charCheck = charMap[charId];
            if (!charCheck) continue;
            stateData[charId] = {
                countdownMs: Math.max(0, timerData.targetTime - Date.now()),
                isThinking: timerData.isThinking || false,
                webSearchActive: timerData.webSearchActive || false,
                ragProgress: timerData.ragProgress || null,
                pressure: charCheck.pressure_level || 0,
                status: charCheck.status,
                isBlocked: charCheck.is_blocked
            };
        }
        const payload = JSON.stringify({ type: 'engine_state', data: stateData });
        wsClients.forEach(client => {
            if (client.readyState === 1) client.send(payload);
        });
    }

function broadcastNewMessage(wsClients, messageObj) {
        const payload = JSON.stringify({
            type: 'new_message',
            data: messageObj
        });
        wsClients.forEach(client => {
            if (client.readyState === 1 /* WebSocket.OPEN */) {
                client.send(payload);
            }
        });
    }

function broadcastEvent(wsClients, eventObj) {
        const payload = JSON.stringify(eventObj);
        wsClients.forEach(client => {
            if (client.readyState === 1 /* WebSocket.OPEN */) {
                client.send(payload);
            }
        });
    }

function broadcastWalletSync(wsClients, charId) {
        if (!charId) return;
        const char = dependencies.db.getCharacter(charId);
        const userProfile = dependencies.db.getUserProfile();
        const payload = JSON.stringify({
            type: 'wallet_sync',
            data: {
                characterId: charId,
                characterWallet: char?.wallet,
                userWallet: userProfile?.wallet
            }
        });
        wsClients.forEach(client => {
            if (client.readyState === 1) client.send(payload);
        });
    }

    return { broadcastEngineState, broadcastNewMessage, broadcastEvent, broadcastWalletSync };
}

module.exports = { createModule };
