// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function broadcastCityEvent(userId, charId, action, message) {
        try {
            const wsClients = dependencies.getWsClients(userId);
            if (wsClients && wsClients.size > 0) {
                const eventStr = JSON.stringify({ type: 'city_update', charId, action, message });
                wsClients.forEach(c => { if (c.readyState === 1) c.send(eventStr); });
            }
        } catch (e) { /* best-effort */ }
    }

    return { broadcastCityEvent };
}

module.exports = { createModule };
