// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function persistVisibleCharacterText({ characterId, text, wsClients, metadata = null }) {
        const clean = dependencies.stripHistoryMetadataPrefixFromOutput(dependencies.stripHiddenTagsForVisibleMessage(text));
        if (!clean) return [];
        const bubbles = clean.split('\n').map(msg => msg.trim()).filter(Boolean);
        const saved = [];
        bubbles.forEach((bubble, index) => {
            const messageMetadata = metadata && index === 0 ? metadata : null;
            const { id: messageId, timestamp: messageTs } = dependencies.db.addMessage(characterId, 'character', bubble, messageMetadata);
            const message = {
                id: messageId,
                character_id: characterId,
                role: 'character',
                content: bubble,
                timestamp: messageTs + index
            };
            saved.push(message);
            dependencies.broadcastNewMessage(wsClients, message);
        });
        return saved;
    }

    return { persistVisibleCharacterText };
}

module.exports = { createModule };
