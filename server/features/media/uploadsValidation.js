// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function isAllowedImageUploadMetadata(file) {
    const ext = dependencies.path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    return dependencies.allowedImageExtensions.has(ext) && dependencies.allowedImageMimeTypes.has(mime);
}

function isValidImageUploadContent(file) {
    const ext = dependencies.path.extname(file.originalname || file.filename || '').toLowerCase();
    const header = dependencies.fs.readFileSync(file.path).subarray(0, 16);

    if ((ext === '.jpg' || ext === '.jpeg') && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
        return true;
    }
    if (ext === '.png' && header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return true;
    }
    if (ext === '.gif' && header.length >= 6 && (header.subarray(0, 6).toString('ascii') === 'GIF87a' || header.subarray(0, 6).toString('ascii') === 'GIF89a')) {
        return true;
    }
    if (ext === '.webp' && header.length >= 12 && header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP') {
        return true;
    }
    return false;
}

function cleanupUploadedFile(file) {
    try {
        if (file?.path && dependencies.fs.existsSync(file.path)) dependencies.fs.unlinkSync(file.path);
    } catch (e) { }
}

    return { isAllowedImageUploadMetadata, isValidImageUploadContent, cleanupUploadedFile };
}

module.exports = { createModule };
