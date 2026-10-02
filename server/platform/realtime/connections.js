// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getWsClients(userId) {
    if (!dependencies.userWsClients.has(userId)) {
        dependencies.userWsClients.set(userId, new Set());
    }
    return dependencies.userWsClients.get(userId);
}

function broadcastToWsClients(clients, message) {
    if (!clients) return;
    const payload = JSON.stringify(message);
    clients.forEach(client => {
        if (client.readyState === 1) client.send(payload);
    });
}

    return { getWsClients, broadcastToWsClients };
}

module.exports = { createModule };
