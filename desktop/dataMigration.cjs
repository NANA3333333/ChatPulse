const fs = require('fs');
const path = require('path');

const IMPORT_MARKER = '.chatpulse-desktop-import.json';

function isTruthy(value) {
    return /^(1|true|yes|on|force)$/i.test(String(value || '').trim());
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function pathExists(filePath) {
    try {
        return !!filePath && fs.existsSync(filePath);
    } catch (_) {
        return false;
    }
}

function resolveCandidate(candidate) {
    const raw = String(candidate || '').trim();
    if (!raw) return '';
    return path.resolve(raw);
}

function uniqueExistingRoots(candidates = []) {
    const seen = new Set();
    const roots = [];
    for (const candidate of candidates) {
        const root = resolveCandidate(candidate);
        if (!root) continue;
        const key = process.platform === 'win32' ? root.toLowerCase() : root;
        if (seen.has(key)) continue;
        seen.add(key);
        if (pathExists(path.join(root, 'data', 'master.db'))) {
            roots.push(root);
        }
    }
    return roots;
}

function isSameOrInside(parent, child) {
    const resolvedParent = path.resolve(parent);
    const resolvedChild = path.resolve(child);
    const relative = path.relative(resolvedParent, resolvedChild);
    return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function findImportSourceRoot(options = {}) {
    const env = options.env || process.env;
    if (isTruthy(env.CHATPULSE_DESKTOP_SKIP_IMPORT) || String(env.CHATPULSE_DESKTOP_IMPORT_MODE || '').toLowerCase() === 'skip') {
        return '';
    }

    const candidates = [
        env.CHATPULSE_DESKTOP_IMPORT_FROM,
        options.isDev ? options.appRoot : '',
        options.resourcesPath ? path.resolve(options.resourcesPath, '..', '..', '..') : '',
        options.documentsPath ? path.join(options.documentsPath, 'ChatPluse') : '',
        options.documentsPath ? path.join(options.documentsPath, 'ChatPulse') : ''
    ];

    const userDataDir = options.userDataDir ? path.resolve(options.userDataDir) : '';
    return uniqueExistingRoots(candidates).find(root => {
        if (!userDataDir) return true;
        return !isSameOrInside(root, userDataDir);
    }) || '';
}

function copyRecursive(sourcePath, targetPath) {
    const stat = fs.lstatSync(sourcePath);
    if (stat.isDirectory()) {
        ensureDir(targetPath);
        for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
            copyRecursive(path.join(sourcePath, entry.name), path.join(targetPath, entry.name));
        }
        return;
    }
    if (stat.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(sourcePath);
        try {
            fs.rmSync(targetPath, { recursive: true, force: true });
        } catch (_) { }
        fs.symlinkSync(linkTarget, targetPath);
        return;
    }
    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectoryContents(sourceDir, targetDir, options = {}) {
    if (!pathExists(sourceDir)) return false;
    ensureDir(targetDir);
    const skipTopLevelNames = new Set((options.skipTopLevelNames || []).map(name => String(name).toLowerCase()));
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        if (skipTopLevelNames.has(entry.name.toLowerCase())) continue;
        copyRecursive(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
    }
    return true;
}

function hasDesktopData(userDataDir) {
    return pathExists(path.join(userDataDir, 'data', 'master.db'))
        || directoryHasEntries(path.join(userDataDir, 'data'))
        || directoryHasEntries(path.join(userDataDir, 'uploads'))
        || directoryHasEntries(path.join(userDataDir, 'qdrant'));
}

function directoryHasEntries(dirPath) {
    try {
        return fs.statSync(dirPath).isDirectory() && fs.readdirSync(dirPath).length > 0;
    } catch (_) {
        return false;
    }
}

function makeTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupExistingDesktopData(userDataDir) {
    if (!hasDesktopData(userDataDir)) return '';
    const backupRoot = ensureDir(path.join(userDataDir, 'pre-import-backups', makeTimestamp()));
    for (const name of ['data', 'uploads', 'qdrant']) {
        const source = path.join(userDataDir, name);
        if (pathExists(source)) copyRecursive(source, path.join(backupRoot, name));
    }
    return backupRoot;
}

function removeDesktopDataTargets(userDataDir) {
    const resolvedUserData = path.resolve(userDataDir);
    for (const name of ['data', 'uploads', 'qdrant']) {
        const target = path.resolve(userDataDir, name);
        if (!isSameOrInside(resolvedUserData, target)) {
            throw new Error(`Refusing to remove path outside desktop user data: ${target}`);
        }
        fs.rmSync(target, { recursive: true, force: true });
    }
}

function importExistingLocalData(options = {}) {
    const env = options.env || process.env;
    const logger = options.logger || console;
    const userDataDir = path.resolve(options.userDataDir);
    const sourceRoot = resolveCandidate(options.sourceRoot);
    const force = isTruthy(env.CHATPULSE_DESKTOP_FORCE_IMPORT)
        || String(env.CHATPULSE_DESKTOP_IMPORT_MODE || '').toLowerCase() === 'force'
        || options.force === true;

    if (!sourceRoot || !pathExists(path.join(sourceRoot, 'data', 'master.db'))) {
        return { imported: false, skipped: true, reason: 'source data not found' };
    }

    ensureDir(userDataDir);
    const markerPath = path.join(userDataDir, IMPORT_MARKER);
    const targetDataDir = path.join(userDataDir, 'data');
    const targetHasMaster = pathExists(path.join(targetDataDir, 'master.db'));
    if (!force && pathExists(markerPath)) {
        return { imported: false, skipped: true, reason: 'already imported', sourceRoot };
    }
    if (!force && targetHasMaster) {
        return { imported: false, skipped: true, reason: 'desktop data already exists', sourceRoot };
    }

    const backupRoot = force ? backupExistingDesktopData(userDataDir) : '';
    if (force) removeDesktopDataTargets(userDataDir);
    const copied = {
        data: copyDirectoryContents(path.join(sourceRoot, 'data'), targetDataDir, { skipTopLevelNames: ['qdrant'] }),
        uploads: copyDirectoryContents(path.join(sourceRoot, 'server', 'public', 'uploads'), path.join(userDataDir, 'uploads')),
        qdrant: copyDirectoryContents(path.join(sourceRoot, 'data', 'qdrant'), path.join(userDataDir, 'qdrant'))
    };

    const marker = {
        importedAt: new Date().toISOString(),
        sourceRoot,
        copied,
        backupRoot
    };
    fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2));
    logger.log?.(`[Desktop Import] Imported existing local data from ${sourceRoot}${backupRoot ? `; backup=${backupRoot}` : ''}`);
    return { imported: true, skipped: false, sourceRoot, backupRoot, copied, markerPath };
}

function prepareDesktopUserData(options = {}) {
    const env = options.env || process.env;
    if (isTruthy(env.CHATPULSE_DESKTOP_SKIP_IMPORT) || String(env.CHATPULSE_DESKTOP_IMPORT_MODE || '').toLowerCase() === 'skip') {
        return { imported: false, skipped: true, reason: 'disabled by env' };
    }
    const sourceRoot = options.sourceRoot || findImportSourceRoot(options);
    if (!sourceRoot) return { imported: false, skipped: true, reason: 'source data not found' };
    return importExistingLocalData({ ...options, sourceRoot });
}

module.exports = {
    IMPORT_MARKER,
    backupExistingDesktopData,
    copyDirectoryContents,
    findImportSourceRoot,
    importExistingLocalData,
    removeDesktopDataTargets,
    prepareDesktopUserData
};
