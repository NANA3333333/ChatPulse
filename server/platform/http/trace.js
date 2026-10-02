const { createOperation } = require('../logging/operation');
const { withTrace } = require('../logging/context');

// Attach ownership at route registration, never infer it from user-controlled URLs.
function traceHttp(feature, action) {
    return (req, res, next) => {
        const operation = createOperation({ feature, action, runId: req.get('X-Run-Id') });
        req.runId = operation.runId;
        req.headers['x-run-id'] = operation.runId;
        res.setHeader('X-Run-Id', operation.runId);
        const json = res.json;
        res.json = function sendJson(body) {
            if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
                body = { ...body, feature, action, runId: operation.runId, errorCode: body.errorCode || `HTTP_${res.statusCode}` };
            }
            return json.call(this, body);
        };
        const finish = () => operation.finish(res.statusCode >= 400 || !res.writableFinished
            ? { code: res.writableFinished ? `HTTP_${res.statusCode}` : 'HTTP_ABORTED' } : null);
        res.once('finish', finish);
        res.once('close', finish);
        withTrace(operation.context, next);
    };
}

module.exports = { traceHttp };
