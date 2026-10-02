const { createOperation } = require("../../platform/logging/operation");
const { replyError } = require("./errors");
const { traceHttp } = require('../../platform/http/trace');

function registerPrivateReplyRoutes(app, { authMiddleware, changeReplyVersion, startOperation = createOperation }) {
    for (const action of ['reroll', 'version']) {
        app.post(`/api/messages/:characterId/replies/:messageId/${action}`,
            traceHttp('private-chat', `POST /api/messages/:characterId/replies/:messageId/${action}`),
            authMiddleware, async (req, res) => {
            const operation = startOperation({ feature: 'private-chat', action,
                runId: req.get('X-Run-Id'), entityId: req.params.messageId, userId: req.user.id });
            res.set('X-Run-Id', operation.runId);
            try {
                const { messageId, revision, version } = operation.step('request', () => {
                    const messageId = Number(req.params.messageId);
                    const { revision, version } = req.body || {};
                    if (!Number.isSafeInteger(messageId) || messageId <= 0
                        || !Number.isSafeInteger(revision) || revision < 0
                        || (action === 'version' && (!Number.isSafeInteger(version) || version < 0))) {
                        throw replyError('Invalid reply version request', 400, 'INVALID_REPLY_VERSION_REQUEST');
                    }
                    return { messageId, revision, version };
                });
                const update = await changeReplyVersion(req, req.params.characterId, messageId, {
                    reroll: action === 'reroll', revision, version, operation
                });
                res.json({ success: true, ...update, runId: operation.runId });
                operation.record('http_response', 'succeeded');
                operation.finish();
            } catch (error) {
                operation.finish(error);
                res.status(error.status || 500).json({ error: error.message,
                    errorCode: error.code || 'REPLY_OPERATION_FAILED', runId: operation.runId });
            }
        });
    }
}

module.exports = { registerPrivateReplyRoutes };
