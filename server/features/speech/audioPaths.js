// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function resolveTtsAudioPath(userId, audioPath) {
    if (!audioPath) return null;
    const userAudioRoot = dependencies.path.resolve(dependencies.ttsAudioRoot, String(userId || 'default'));
    const resolvedPath = dependencies.path.resolve(String(audioPath));
    if (resolvedPath !== userAudioRoot && !resolvedPath.startsWith(userAudioRoot + dependencies.path.sep)) {
        return null;
    }
    return resolvedPath;
}

function sanitizeTtsMimeType(value) {
    const mime = String(value || '').trim().toLowerCase();
    if (/^audio\/[a-z0-9.+-]+$/i.test(mime)) return mime;
    return 'audio/mpeg';
}

    return { resolveTtsAudioPath, sanitizeTtsMimeType };
}

module.exports = { createModule };
