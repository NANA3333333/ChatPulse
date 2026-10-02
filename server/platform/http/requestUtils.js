// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function createRequestTraceId(prefix = 'req') {
    const randomPart = typeof dependencies.crypto.randomUUID === 'function'
        ? dependencies.crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

function yieldToServerLoop() {
    return new Promise(resolve => setImmediate(resolve));
}

    return { createRequestTraceId, yieldToServerLoop };
}

module.exports = { createModule };
