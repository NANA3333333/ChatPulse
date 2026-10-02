// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function removeFileIfExists(filePath) {
        try { if (filePath && dependencies.fs.existsSync(filePath)) dependencies.fs.unlinkSync(filePath); } catch (e) { }
    }

function removeDirectoryIfExists(dirPath) {
        try { if (dirPath && dependencies.fs.existsSync(dirPath)) dependencies.fs.rmSync(dirPath, { recursive: true, force: true }); } catch (e) { }
    }

function cleanupTemp(filePath, dirPath) {
        removeFileIfExists(filePath);
        removeDirectoryIfExists(dirPath);
    }

function removeReferencedUploads(relPaths = []) {
        for (const relPath of relPaths) {
            if (!relPath) continue;
            const fullPath = dependencies.resolveUploadReferencePath(relPath);
            try {
                if (fullPath && dependencies.fs.existsSync(fullPath) && fullPath !== dependencies.tempUploadsDir && !fullPath.startsWith(dependencies.tempUploadsDir + dependencies.path.sep)) {
                    dependencies.fs.rmSync(fullPath, { recursive: true, force: true });
                }
            } catch (e) { }
        }
        if (!dependencies.fs.existsSync(dependencies.uploadsDir)) {
            dependencies.fs.mkdirSync(dependencies.uploadsDir, { recursive: true });
        }
        if (!dependencies.fs.existsSync(dependencies.tempUploadsDir)) {
            dependencies.fs.mkdirSync(dependencies.tempUploadsDir, { recursive: true });
        }
    }

function removeScopedUserUploads(userId) {
        const userUploadDir = dependencies.path.join(dependencies.uploadsDir, 'users', String(userId || 'default'));
        if (userUploadDir === dependencies.uploadsDir || userUploadDir.startsWith(dependencies.tempUploadsDir + dependencies.path.sep)) return;
        removeDirectoryIfExists(userUploadDir);
    }

function resolveSafeZipEntryPath(outputDir, entryPath) {
        const rawPath = String(entryPath || '').replace(/\\/g, '/');
        if (!rawPath || rawPath.includes('\0') || rawPath.startsWith('/') || /^[a-zA-Z]:/.test(rawPath)) {
            throw new Error('Unsafe zip entry path in backup archive.');
        }

        const normalizedPath = dependencies.path.posix.normalize(rawPath);
        if (normalizedPath === '.' || normalizedPath === '..' || normalizedPath.startsWith('../')) {
            throw new Error('Unsafe zip entry path in backup archive.');
        }

        const outputRoot = dependencies.path.resolve(outputDir);
        const fullPath = dependencies.path.resolve(outputRoot, ...normalizedPath.split('/'));
        if (fullPath !== outputRoot && !fullPath.startsWith(outputRoot + dependencies.path.sep)) {
            throw new Error('Unsafe zip entry path in backup archive.');
        }
        return fullPath;
    }

async function extractZipSafely(zipPath, outputDir) {
        const directory = await dependencies.unzipper.Open.file(zipPath);
        for (const entry of directory.files) {
            const targetPath = resolveSafeZipEntryPath(outputDir, entry.path);
            if (entry.type === 'Directory') {
                dependencies.fs.mkdirSync(targetPath, { recursive: true });
                continue;
            }

            dependencies.fs.mkdirSync(dependencies.path.dirname(targetPath), { recursive: true });
            await new Promise((resolve, reject) => {
                const readStream = entry.stream();
                const writeStream = dependencies.fs.createWriteStream(targetPath);
                readStream.on('error', reject);
                writeStream.on('error', reject);
                writeStream.on('finish', resolve);
                readStream.pipe(writeStream);
            });
        }
    }

function copyDirRecursive(src, dest) {
        if (!dependencies.fs.existsSync(dest)) dependencies.fs.mkdirSync(dest, { recursive: true });
        const entries = dependencies.fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = dependencies.path.join(src, entry.name);
            const destPath = dependencies.path.join(dest, entry.name);
            if (entry.isDirectory()) {
                // Skip 'temp' directory
                if (entry.name === 'temp') continue;
                if (!dependencies.fs.existsSync(destPath)) dependencies.fs.mkdirSync(destPath, { recursive: true });
                copyDirRecursive(srcPath, destPath);
            } else {
                dependencies.fs.copyFileSync(srcPath, destPath);
            }
        }
    }

function restoreBackupUploadsForUser(extractedUploads, targetUserId) {
        if (!dependencies.fs.existsSync(dependencies.uploadsDir)) dependencies.fs.mkdirSync(dependencies.uploadsDir, { recursive: true });
        const entries = dependencies.fs.readdirSync(extractedUploads, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'temp') continue;
            const srcPath = dependencies.path.join(extractedUploads, entry.name);
            if (entry.name === 'users' && entry.isDirectory()) {
                restoreScopedUserUploads(srcPath, targetUserId);
                continue;
            }
            const destPath = dependencies.path.join(dependencies.uploadsDir, entry.name);
            if (entry.isDirectory()) {
                copyDirRecursive(srcPath, destPath);
            } else {
                dependencies.fs.copyFileSync(srcPath, destPath);
            }
        }
    }

function restoreScopedUserUploads(extractedUsersDir, targetUserId) {
        const targetUserDir = dependencies.path.join(dependencies.uploadsDir, 'users', String(targetUserId || 'default'));
        if (!dependencies.fs.existsSync(targetUserDir)) dependencies.fs.mkdirSync(targetUserDir, { recursive: true });
        const entries = dependencies.fs.readdirSync(extractedUsersDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === 'temp') continue;
            const srcPath = dependencies.path.join(extractedUsersDir, entry.name);
            if (entry.isDirectory()) {
                copyDirRecursive(srcPath, targetUserDir);
            }
        }
    }

    return { removeFileIfExists, removeDirectoryIfExists, cleanupTemp, removeReferencedUploads, removeScopedUserUploads, resolveSafeZipEntryPath, extractZipSafely, copyDirRecursive, restoreBackupUploadsForUser, restoreScopedUserUploads };
}

module.exports = { createModule };
