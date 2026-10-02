// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function isLocalRequest(req) {
    if (dependencies.PUBLIC_MODE) return false;
    const ip = req.ip || req.socket?.remoteAddress || '';
    return ip === '127.0.0.1'
        || ip === '::1'
        || ip === '::ffff:127.0.0.1'
        || ip === 'localhost';
}

    return { isLocalRequest };
}

module.exports = { createModule };
