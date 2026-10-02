const { createOperation } = require("../../platform/logging/operation");
const { replyError } = require("./errors");

function parseHistoryQuery(query) {
    const rawLimit = query.limit;
    const limit = rawLimit === undefined || rawLimit === null || String(rawLimit).trim() === '' ? 100 : Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit <= 0) throw replyError('Invalid message limit', 400, 'INVALID_MESSAGE_QUERY');
    const result = { limit: Math.min(limit, 200) };
    for (const cursor of ['before', 'after', 'around']) {
        if (query[cursor] === undefined) continue;
        const value = Number(query[cursor]);
        if (!Number.isSafeInteger(value) || value <= 0) throw replyError(`Invalid ${cursor} cursor`, 400, 'INVALID_MESSAGE_QUERY');
        result[cursor] = value;
    }
    return result;
}

function registerPrivateMessageRoutes(app, { authMiddleware, getService, startOperation = createOperation }) {
    function register(method, path, action, handle) {
        app[method](path, authMiddleware, (req, res) => {
            const operation = startOperation({ feature: 'private-chat', action,
                runId: req.get('X-Run-Id'), entityId: req.params.characterId || req.body?.characterId, userId: req.user.id });
            res.set('X-Run-Id', operation.runId);
            try {
                const result = handle(req, getService(req), operation);
                // Keep the history endpoint's array shape for existing clients.
                res.json(Array.isArray(result) ? result : { ...result, runId: operation.runId });
                operation.record('http_response', 'succeeded');
                operation.finish();
            } catch (error) {
                operation.finish(error);
                res.status(error.status || 500).json({ error: error.message,
                    errorCode: error.code || 'MESSAGE_OPERATION_FAILED', runId: operation.runId });
            }
        });
    }
    register('get', '/api/messages/:characterId', 'history', (req, service, operation) => {
        const query = operation.step('request', () => parseHistoryQuery(req.query));
        return service.history(req.params.characterId, query, operation);
    });
    register('post', '/api/messages', 'send', (req, service, operation) => {
        const input = operation.step('request', () => {
            const { characterId, content } = req.body || {};
            if (typeof characterId !== 'string' || !characterId.trim() || typeof content !== 'string' || !content.trim()) {
                throw replyError('Missing characterId or content', 400, 'INVALID_MESSAGE_REQUEST');
            }
            return { characterId, content };
        });
        return service.send(input, operation);
    });
    register('post', '/api/messages/:characterId/retry', 'retry', (req, service, operation) =>
        service.retry(req.params.characterId, req.body || {}, operation));
    register('post', '/api/messages/batch-delete', 'delete', (req, service, operation) => {
        const input = operation.step('request', () => {
            const messageIds = [...new Set((Array.isArray(req.body?.messageIds) ? req.body.messageIds : [])
                .map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 500);
            if (!messageIds.length) throw replyError('messageIds array required', 400, 'INVALID_MESSAGE_IDS');
            return { messageIds, characterId: String(req.body?.characterId || '').trim() };
        });
        return service.deleteMessages(input, operation);
    });
    register('delete', '/api/messages/:characterId', 'clear', (req, service, operation) =>
        service.clear(req.params.characterId, operation));
}

module.exports = { registerPrivateMessageRoutes };
