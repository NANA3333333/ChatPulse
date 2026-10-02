const { randomUUID } = require('node:crypto');

function createOperation({ feature, action, runId, entityId, userId } = {}, { write = record => console.info(JSON.stringify(record)) } = {}) {
    const context = Object.freeze({
        runId: typeof runId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(runId) ? runId : randomUUID(),
        release: process.env.CP_RELEASE || 'development',
        feature, action, entityId, userId
    });
    const startedAt = Date.now();
    let finished = false;

    function record(stage, status, details = {}) {
        // Do not spread arbitrary request/error objects: they may contain prompts or credentials.
        const entry = { ...context, timestamp: new Date().toISOString(), stage, status };
        for (const key of ['durationMs', 'errorCode', 'attempt', 'taskId']) {
            if (details[key] !== undefined) entry[key] = details[key];
        }
        try { write(entry); } catch { /* Diagnostic failures must not alter a committed operation. */ }
    }

    function step(stage, task, errorCode = 'OPERATION_FAILED') {
        const start = Date.now();
        record(stage, 'started');
        const succeeded = value => {
            record(stage, 'succeeded', { durationMs: Date.now() - start });
            return value;
        };
        const failed = error => {
            const failure = error instanceof Error ? error : new Error(String(error));
            failure.code ||= errorCode;
            failure.runId = context.runId;
            record(stage, 'failed', { durationMs: Date.now() - start, errorCode: failure.code });
            throw failure;
        };
        try {
            const value = task();
            return value && typeof value.then === 'function' ? value.then(succeeded, failed) : succeeded(value);
        } catch (error) {
            return failed(error);
        }
    }

    function finish(error = null) {
        if (finished) return;
        finished = true;
        record('operation', error ? 'failed' : 'succeeded', {
            durationMs: Date.now() - startedAt,
            ...(error ? { errorCode: error.code || 'OPERATION_FAILED' } : {})
        });
    }

    record('operation', 'started');
    return { context, runId: context.runId, record, step, finish };
}

module.exports = { createOperation };
