// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function resolveUserUploadPath(userId, filename) {
    const safeFilename = dependencies.path.basename(String(filename || '').trim());
    if (!safeFilename || safeFilename !== String(filename || '').trim()) return null;
    const userUploadRoot = dependencies.path.resolve(dependencies.getUserUploadDir(userId || 'default'));
    const resolvedPath = dependencies.path.resolve(userUploadRoot, safeFilename);
    if (resolvedPath !== userUploadRoot && !resolvedPath.startsWith(userUploadRoot + dependencies.path.sep)) {
        return null;
    }
    return resolvedPath;
}

    return { resolveUserUploadPath };
}

module.exports = { createModule };
