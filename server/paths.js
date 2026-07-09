const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function resolveConfiguredPath(value, fallback) {
    const raw = String(value || '').trim();
    return path.resolve(raw || fallback);
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function getDataDir() {
    return ensureDir(resolveConfiguredPath(process.env.CHATPULSE_DATA_DIR, path.join(repoRoot, 'data')));
}

function getUploadsDir() {
    return ensureDir(resolveConfiguredPath(process.env.CHATPULSE_UPLOADS_DIR, path.join(__dirname, 'public', 'uploads')));
}

function getClientDistDir() {
    return resolveConfiguredPath(process.env.CHATPULSE_CLIENT_DIST_DIR, path.join(repoRoot, 'client', 'dist'));
}

function getMasterDbPath() {
    return path.join(getDataDir(), 'master.db');
}

function getUserDbPath(userId) {
    return path.join(getDataDir(), `chatpulse_user_${userId}.db`);
}

function getJwtSecretPath() {
    return path.join(getDataDir(), '.jwt_secret');
}

function getTtsDir() {
    return ensureDir(path.join(getDataDir(), 'tts'));
}

function getVectorRootDir() {
    return ensureDir(path.join(getDataDir(), 'vectors'));
}

function getVectorIndexDir(...segments) {
    return path.join(getVectorRootDir(), ...segments.map(segment => String(segment)));
}

function getUserUploadDir(userId = 'default') {
    return ensureDir(path.join(getUploadsDir(), 'users', String(userId || 'default')));
}

function getPublicRootDir() {
    return path.dirname(getUploadsDir());
}

module.exports = {
    repoRoot,
    ensureDir,
    getDataDir,
    getUploadsDir,
    getClientDistDir,
    getMasterDbPath,
    getUserDbPath,
    getJwtSecretPath,
    getTtsDir,
    getVectorRootDir,
    getVectorIndexDir,
    getUserUploadDir,
    getPublicRootDir
};
