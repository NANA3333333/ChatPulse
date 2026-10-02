const { createJobLifecycle } = require('./platform/jobs/lifecycle');

function createApplication({ backgroundJobs = true } = {}) {
const jobs = createJobLifecycle({ enabled: backgroundJobs });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const { getUserDb } = require("./platform/db/userDatabase.js");
const { registerPrivateReplyRoutes, registerPrivateMessageRoutes, createMessageService } = require("./features/private-chat");
const authDb = require("./features/account/authRepository.js");
const { deriveEmotion } = require("./features/characters/emotion.js");
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const {
    getDataDir,
    getJwtSecretPath,
    getUploadsDir,
    getUserUploadDir,
    getTtsDir,
    getClientDistDir
} = require("./paths");

require('dotenv').config({ path: path.join(__dirname, '.env') });

// Generate or load a persistent JWT secret (never hardcoded in source)
function getJwtSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    const secretPath = getJwtSecretPath();
    try {
        if (fs.existsSync(secretPath)) {
            return fs.readFileSync(secretPath, 'utf8').trim();
        }
    } catch (e) { /* fall through to generate */ }
    // Generate a strong 256-bit random secret and persist
    const dataDir = getDataDir();
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const secret = require('crypto').randomBytes(32).toString('base64url');
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
    console.log('[Auth] Generated new JWT secret and saved to data/.jwt_secret');
    return secret;
}
const JWT_SECRET = getJwtSecret();
const AUTH_TOKEN_TTL = String(process.env.CP_AUTH_TOKEN_TTL || '7d');
const PUBLIC_MODE = /^(1|true|yes|on)$/i.test(String(process.env.CP_PUBLIC_MODE || ''));
const TRUST_PROXY = /^(1|true|yes|on)$/i.test(String(process.env.CP_TRUST_PROXY || ''));
const DESKTOP_MODE = /^(1|true|yes|on)$/i.test(String(process.env.CP_DESKTOP_MODE || ''));
const ALLOWED_ORIGINS = String(process.env.CP_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const { getEngine } = require("./features/private-chat/runtime.js");
const { getMemory, extractMemoryFromContext, setWsClientsResolver, getEmbeddingDebugStatus } = require("./features/memory/index.js");
const { getTokenCount } = require("./platform/llm/tokenizer.js");
const { enqueueBackgroundTask, getBackgroundQueueStats } = require("./platform/jobs/backgroundQueue.js");
const { synthesizeSpeech, getTencentVoiceList } = require("./features/speech/service.js");
const { buildOpenAiCompatibleUrlResolved } = require("./platform/http/guards.js");
const { sanitizeCityNarrationText } = require("./features/city/utils/actionNarrationParser.js");
const {
    normalizeMemoryId,
    normalizeMemoryIdList,
    normalizeMemoryMaintenanceAutoRunControls,
    normalizeMemoryMaintenanceBatchOptions,
    normalizeMemoryMaintenanceLibraryOptions,
    normalizeMemoryMaintenanceSettingsPatch,
    normalizeOptionalMemoryId
} = require("./features/memory/inputGuards.js");
const {
    configureMemoryMaintenanceService,
    MEMORY_MAINTENANCE_FOCUS,
    MEMORY_MAINTENANCE_TIERS,
    MEMORY_MAINTENANCE_STATUS,
    MEMORY_MAINTENANCE_ACTIONS,
    MEMORY_SOURCE_CONTEXTS,
    MEMORY_SCENE_TAGS,
    MEMORY_TEMPORAL_BINDING_LABELS,
    MEMORY_TEMPORAL_BINDING_SCOPES,
    getMemoryMaintenanceBatch,
    getExternalImportPendingCountForCharacter,
    getExternalImportPendingStatsByCharacter,
    getExternalImportMaintenanceBatch,
    getMemoryTemporalBindingBatch,
    buildMemoryMigrationPrompt,
    buildMemoryTemporalBindingPrompt,
    extractJsonObjectFromText,
    normalizeTemporalBindingResult,
    applyMemoryMaintenanceItems,
    refreshMaintenanceMemoryIndex,
    getMemoryMaintenanceStats,
    runMemoryMaintenanceBatch,
    runMemoryTemporalBindingBatch,
    normalizeMemoryTemporalBindingSource,
    getMemoryMaintenanceLibrary,
    getMemoryMaintenanceOverview,
    getMemoryMaintenanceSettings,
    redactMemoryMaintenanceSettings,
    updateMemoryMaintenanceSettings,
    normalizeManualMemoryPatch,
    buildMemoryIndexTargets,
    rescueMemoryMaintenanceItems
} = require("./features/memory/maintenance/index.js");
const qdrant = require("./platform/vectors/qdrant.js");
const crypto = require('crypto');

let pluginContext = null;

function isEnvDisabled(value) {
    return /^(0|false|no|off)$/i.test(String(value || '').trim());
}

function isQdrantRequiredForStartup() {
    const config = qdrant.getQdrantConfig();
    if (!config.enabled) return false;
    return !isEnvDisabled(process.env.QDRANT_REQUIRED);
}

async function assertQdrantStartupReady() {
    if (!isQdrantRequiredForStartup()) return;
    const config = qdrant.getQdrantConfig();
    const ok = await qdrant.healthcheck();
    if (!ok) {
        throw new Error(`QDRANT_ENABLED=1 but Qdrant is not reachable at ${config.url}. Start Qdrant first, or set QDRANT_ENABLED=0 only when vectra fallback is intentional.`);
    }
    console.log(`[Startup] Qdrant is reachable at ${config.url}`);
}

const { createRequestTraceId, yieldToServerLoop } = require("./platform/http/requestUtils.js").createModule({
        get crypto() { return crypto; }
    });

const { buildDefaultAvatarUrl } = require("./features/characters/avatar.js").createModule({
        
    });

const { normalizePositiveMoney, normalizePaymentNote } = require("./features/economy/validation.js").createModule({
        
    });

const { normalizeQueryLimit } = require("./platform/http/query.js").createModule({
        
    });

function getEngineWithPluginHooks(userId) {
    const engine = getEngine(userId);
    if (!engine || !pluginContext?.hooks) return engine;
    if (typeof pluginContext.hooks.cityReplyStateSyncCallback === 'function' && typeof engine.setCityReplyStateSyncCallback === 'function') {
        engine.setCityReplyStateSyncCallback(pluginContext.hooks.cityReplyStateSyncCallback);
    }
    if (typeof pluginContext.hooks.cityReplyIntentCallback === 'function' && typeof engine.setCityReplyIntentCallback === 'function') {
        engine.setCityReplyIntentCallback(pluginContext.hooks.cityReplyIntentCallback);
    }
    if (typeof pluginContext.hooks.cityReplyActionCallback === 'function' && typeof engine.setCityReplyActionCallback === 'function') {
        engine.setCityReplyActionCallback(pluginContext.hooks.cityReplyActionCallback);
    }
    return engine;
}

const { getDigestTailWindowSize, extractMessagePlainText, buildClaudePromptCacheEstimateMessages, estimateJsonWrapperTokensForMessages, estimateRequestBodyTokens, formatContextStatsTimestamp, formatContextStatsHistoryMessage } = require("./features/private-chat/diagnostics/contextEstimates.js").createModule({
        get getTokenCount() { return getTokenCount; }
    });

const multer = require('multer');
const { callLLM } = require("./platform/llm/client.js");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
if (TRUST_PROXY) {
    app.set('trust proxy', 1);
}
// Enable security headers. We disable contentSecurityPolicy temporarily to prevent 
// accidentally blocking frontend scripts since it's an SPA.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin(origin, callback) {
        if (!PUBLIC_MODE) return callback(null, true);
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('CORS origin not allowed'));
    }
}));
app.use(express.json({ limit: '50mb' })); // Parses incoming JSON requests
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Parses URL-encoded data

const { isLocalRequest } = require("./features/account/localRequest.js").createModule({
        get PUBLIC_MODE() { return PUBLIC_MODE; }
    });

// Define rate limiters
const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // limit each IP to 20 requests per windowMs for auth routes
    skip: (req) => isLocalRequest(req),
    message: { error: 'Too many authentication attempts. Please try again later.' }
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // limit each IP to 120 api requests per minute
    skip: (req) => isLocalRequest(req),
    message: { error: 'API rate limit exceeded.' }
});

app.use('/api/', (req, res, next) => {
    if (req.path.startsWith('/auth/')) return next();
    return apiLimiter(req, res, next);
}); // Apply general API limiter to non-auth API routes


// Serve static uploaded files with CORP header to bypass browser COEP blocks
const uploadsDir = getUploadsDir();
app.use('/uploads', (req, res, next) => {
    if (req.path === '/users' || req.path.startsWith('/users/')) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(uploadsDir));

const allowedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const allowedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const { isAllowedImageUploadMetadata, isValidImageUploadContent, cleanupUploadedFile } = require("./features/media/uploadsValidation.js").createModule({
        get allowedImageExtensions() { return allowedImageExtensions; },
        get allowedImageMimeTypes() { return allowedImageMimeTypes; },
        get fs() { return fs; },
        get path() { return path; }
    });

const ttsAudioRoot = path.resolve(getTtsDir());

const { resolveTtsAudioPath, sanitizeTtsMimeType } = require("./features/speech/audioPaths.js").createModule({
        get path() { return path; },
        get ttsAudioRoot() { return ttsAudioRoot; }
    });

// Configure Multer for local image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = getUserUploadDir(req.user?.id || 'default');
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'image' && isAllowedImageUploadMetadata(file)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Upload a PNG, JPEG, GIF, or WebP image.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: fileFilter
});

const { resolveUserUploadPath } = require("./features/media/uploadPaths.js").createModule({
        get getUserUploadDir() { return getUserUploadDir; },
        get path() { return path; }
    });

const MEMORY_IMPORT_MAX_ITEMS = 500;
const memoryImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 128 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        const allowedExts = new Set(['.json', '.jsonl', '.ndjson', '.txt', '.md', '.markdown']);
        const allowedMimes = new Set([
            'application/json',
            'application/x-jsonlines',
            'application/x-ndjson',
            'text/plain',
            'text/markdown',
            'application/octet-stream'
        ]);
        if (allowedExts.has(ext) || allowedMimes.has(mime)) {
            cb(null, true);
            return;
        }
        cb(new Error('Invalid memory import file type. Use .json, .jsonl, .txt, or .md.'), false);
    }
});

const { parseBooleanFlag, stripBom, firstImportString, clampImportNumber, makeImportedMemorySummary, inferMemoryImportFormat, hasImportMemoryContent, splitPlainTextMemories, tryParseJsonValue, safeJsonParse, extractMemoryEntriesFromPayload, parseMemoryImportText, parseMemoryImportRequest, normalizeImportedMemoryEntry } = require("./features/memory/import/parse.js").createModule({
        get path() { return path; }
    });

const EXTERNAL_MEMORY_IMPORT_MAX_RAW_CHARS = 180000;
const EXTERNAL_MEMORY_IMPORT_PROMPT_CHARS = 70000;
const EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES = 360;
const EXTERNAL_MEMORY_IMPORT_MAX_MEMORIES = 160;
const EXTERNAL_MEMORY_IMPORT_MAX_MESSAGE_CHARS = 50000;
const EXTERNAL_MEMORY_IMPORT_LLM_TIMEOUT_MS = Math.max(30000, Number(process.env.CP_EXTERNAL_IMPORT_LLM_TIMEOUT_MS || 180000) || 180000);

const { normalizeExternalSourceApp, getExternalSourceAppLabel, getExternalSceneTag, normalizeExternalImportMode, detectExternalSourceApp, cleanExternalSpeakerName, isLikelyUserSpeaker, extractExternalTextContent, escapeImportRegex, stripExternalNoiseBlocks, isExternalNoiseLine, cleanExternalMessageText, cleanExternalMessagesForPrompt, normalizeExternalTimestamp, collectExternalMessages, splitExternalPlainTextMessages, looksLikeExternalJsonl, collectExternalJsonlMessages, parseExternalImportRequest, loadExternalImportRequestFromDb, inferExternalImportContinueOffset } = require("./features/memory/import/externalSource.js").createModule({
        get EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES() { return EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES; },
        get EXTERNAL_MEMORY_IMPORT_MAX_MESSAGE_CHARS() { return EXTERNAL_MEMORY_IMPORT_MAX_MESSAGE_CHARS; },
        get EXTERNAL_MEMORY_IMPORT_MAX_RAW_CHARS() { return EXTERNAL_MEMORY_IMPORT_MAX_RAW_CHARS; },
        get firstImportString() { return firstImportString; },
        get safeJsonParse() { return safeJsonParse; },
        get splitPlainTextMemories() { return splitPlainTextMemories; },
        get stripBom() { return stripBom; }
    });

configureMemoryMaintenanceService({ getExternalSourceAppLabel });

const { buildExternalImportPrompt, normalizeExternalCharacterName, getExternalNameCompareKey, isExternalImportUserName, getExternalNameTokens, normalizeExternalRoleAliases, getExternalRoleCandidateNames, resolveExternalKnownRoleName, normalizeExternalImportResult, chunkExternalImportMessages, mergeExternalImportRoleTags, buildExternalImportDirectDedupeKey, getExternalImportSharedLibraryId, shouldUseSharedExternalImportLibrary } = require("./features/memory/import/externalNormalization.js").createModule({
        get EXTERNAL_MEMORY_IMPORT_MAX_MEMORIES() { return EXTERNAL_MEMORY_IMPORT_MAX_MEMORIES; },
        get EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES() { return EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES; },
        get EXTERNAL_MEMORY_IMPORT_PROMPT_CHARS() { return EXTERNAL_MEMORY_IMPORT_PROMPT_CHARS; },
        get MEMORY_MAINTENANCE_FOCUS() { return MEMORY_MAINTENANCE_FOCUS; },
        get MEMORY_MAINTENANCE_TIERS() { return MEMORY_MAINTENANCE_TIERS; },
        get clampImportNumber() { return clampImportNumber; },
        get cleanExternalMessageText() { return cleanExternalMessageText; },
        get cleanExternalSpeakerName() { return cleanExternalSpeakerName; },
        get firstImportString() { return firstImportString; },
        get getExternalSourceAppLabel() { return getExternalSourceAppLabel; },
        get isLikelyUserSpeaker() { return isLikelyUserSpeaker; },
        get normalizeMemoryMaintenanceBatchOptions() { return normalizeMemoryMaintenanceBatchOptions; }
    });

const { ensureExternalSharedImportCharacter, saveExternalImportCandidatesDirect, groupExternalImportSavedItems, countUniqueExternalImportSavedItems, formatExternalImportSavedSamples, countExternalImportSavedBindings, getExternalImportSavedCharacterIds } = require("./features/memory/import/persistence.js").createModule({
        get MEMORY_MAINTENANCE_FOCUS() { return MEMORY_MAINTENANCE_FOCUS; },
        get MEMORY_MAINTENANCE_TIERS() { return MEMORY_MAINTENANCE_TIERS; },
        get buildExternalImportDirectDedupeKey() { return buildExternalImportDirectDedupeKey; },
        get clampImportNumber() { return clampImportNumber; },
        get ensureImportedCharacter() { return ensureImportedCharacter; },
        get findCharacterByName() { return findCharacterByName; },
        get firstImportString() { return firstImportString; },
        get getExternalImportSharedLibraryId() { return getExternalImportSharedLibraryId; },
        get getExternalSceneTag() { return getExternalSceneTag; },
        get getExternalSourceAppLabel() { return getExternalSourceAppLabel; },
        get makeCharacterIdFromName() { return makeCharacterIdFromName; },
        get normalizeExternalCharacterName() { return normalizeExternalCharacterName; },
        get shouldUseSharedExternalImportLibrary() { return shouldUseSharedExternalImportLibrary; },
        get yieldToServerLoop() { return yieldToServerLoop; }
    });

const { findCharacterByName, makeCharacterIdFromName, ensureImportedCharacter } = require("./features/memory/import/characters.js").createModule({
        get buildDefaultAvatarUrl() { return buildDefaultAvatarUrl; },
        get firstImportString() { return firstImportString; },
        get getExternalNameCompareKey() { return getExternalNameCompareKey; },
        get getExternalNameTokens() { return getExternalNameTokens; }
    });

const { sanitizeDownloadName, normalizeCharacterArchivePayload, parseCharacterArchiveRequest, getTableColumnSet, stringifyArchiveJson, toArchiveNumber, makeInsertStatement, runArchiveCleanup, clearCharacterArchiveData, importArchiveMessages, importArchiveMemories, importArchiveDiaries, importCharacterArchiveRows } = require("./features/backup/characterArchive.js").createModule({
        get clampImportNumber() { return clampImportNumber; },
        get firstImportString() { return firstImportString; },
        get inferMemoryImportFormat() { return inferMemoryImportFormat; },
        get stripBom() { return stripBom; }
    });

// Initialize the Database schemas


// Setup Server and WebSockets
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const userWsClients = new Map();
const memoryMaintenanceRuns = new Map();

const { getWsClients, broadcastToWsClients } = require("./platform/realtime/connections.js").createModule({
        get userWsClients() { return userWsClients; }
    });

const { getMemoryMaintenanceRunSnapshot, findActiveMemoryMaintenanceRun, pruneMemoryMaintenanceRuns } = require("./features/memory/maintenance/runs.js").createModule({
        get memoryMaintenanceRuns() { return memoryMaintenanceRuns; }
    });

// Inject the global WS resolver into memory.js so it can broadcast without circular dependencies
setWsClientsResolver(getWsClients);

wss.on('connection', (ws) => {
    console.log('[WS] Frontend client connected.');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth') {
                const { user } = verifyAuthToken(data.token);
                ws.userId = user.id;
                authDb.updateLastActive(user.id);
                const clients = getWsClients(user.id);
                clients.add(ws);
                const engine = getEngineWithPluginHooks(user.id);
                engine.startEngine(clients);
                engine.startGroupProactiveTimers(clients);
                console.log(`[WS] Authenticated frontend socket for user: ${user.username}`);
            }
        } catch (e) {
            console.error('[WS] Auth or Engine Start Error:', e.message);
            try { ws.close(1008, 'Unauthorized'); } catch { /* ignore */ }
        }
    });

    ws.on('close', () => {
        console.log('[WS] Frontend client disconnected.');
        if (ws.userId) {
            getWsClients(ws.userId).delete(ws);
        }
    });
});

// AUTHENTICATION MIDDLEWARE
authDb.initAuthDb();

const { createAuthError, getRequestAuthMeta, issueAuthToken, verifyAuthToken } = require("./features/account/sessions.js").createModule({
        get AUTH_TOKEN_TTL() { return AUTH_TOKEN_TTL; },
        get JWT_SECRET() { return JWT_SECRET; },
        get authDb() { return authDb; },
        get jwt() { return jwt; }
    });

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    let authenticated = false;
    try {
        const { user } = verifyAuthToken(token);
        authenticated = true;
        req.user = user;
        authDb.updateLastActive(req.user.id);
        req.db = getUserDb(req.user.id);
        Object.defineProperty(req, 'engine', {
            configurable: true,
            enumerable: true,
            get() {
            const engine = getEngineWithPluginHooks(req.user.id);
                Object.defineProperty(req, 'engine', {
                    value: engine,
                    writable: false,
                    configurable: true,
                    enumerable: true
                });
                return engine;
            }
        });
        Object.defineProperty(req, 'memory', {
            configurable: true,
            enumerable: true,
            get() {
                const memory = getMemory(req.user.id);
                Object.defineProperty(req, 'memory', {
                    value: memory,
                    writable: false,
                    configurable: true,
                    enumerable: true
                });
                return memory;
            }
        });
        next();
    } catch (e) {
        if (authenticated && !e.statusCode) {
            console.error('[Database] Failed to initialize authenticated account storage:', req.user?.id, e);
            return res.status(500).json({ error: 'Failed to initialize account storage. See the server error log.' });
        }
        return res.status(e.statusCode || 401).json({ error: e.statusCode ? e.message : 'Invalid token' });
    }
};

require("./features/media/http/get-media-uploads-filename.js").register(app, { get authMiddleware() { return authMiddleware; }, get fs() { return fs; }, get resolveUserUploadPath() { return resolveUserUploadPath; } });

// 0. Upload a profile/avatar image
require("./features/media/http/post-upload.js").register(app, { get authMiddleware() { return authMiddleware; }, get cleanupUploadedFile() { return cleanupUploadedFile; }, get isValidImageUploadContent() { return isValidImageUploadContent; }, get multer() { return multer; }, get upload() { return upload; } });

// AUTH ROUTES
require("./features/account/http/post-auth-register.js").register(app, { get authDb() { return authDb; }, get authLimiter() { return authLimiter; }, get getUserDb() { return getUserDb; }, get issueAuthToken() { return issueAuthToken; } });

require("./features/account/http/post-auth-login.js").register(app, { get authDb() { return authDb; }, get authLimiter() { return authLimiter; }, get getRequestAuthMeta() { return getRequestAuthMeta; }, get getUserDb() { return getUserDb; }, get issueAuthToken() { return issueAuthToken; } });

require("./features/account/http/post-desktop-session.js").register(app, { get DESKTOP_MODE() { return DESKTOP_MODE; }, get authDb() { return authDb; }, get getUserDb() { return getUserDb; }, get isLocalRequest() { return isLocalRequest; }, get issueAuthToken() { return issueAuthToken; } });

require("./features/account/http/get-auth-me.js").register(app, { get authMiddleware() { return authMiddleware; } });

require("./features/account/http/post-auth-logout.js").register(app, { get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });

require("./features/account/http/get-auth-sessions.js").register(app, { get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });

require("./features/account/http/delete-auth-sessions-id.js").register(app, { get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });

require("./features/account/http/put-auth-account.js").register(app, { get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get issueAuthToken() { return issueAuthToken; } });

// SYSTEM ROUTES
require("./features/admin/http/get-system-announcement.js").register(app, { get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; } });


// PLUGIN MANAGER
pluginContext = {
    wss,
    getWsClients,
    authDb,
    authMiddleware,
    getUserDb,
    getEngine: getEngineWithPluginHooks,
    getMemory,
    callLLM,
    JWT_SECRET,
    jobs,
    hooks: {}  // Features register late-binding callbacks here
};

const featureStatus = require('./features/registry').registerFeatures(app, pluginContext);

// REST API ROUTES
// ---------------------------------------------------------------------------

const CHARACTER_SECRET_FIELDS = ['api_key', 'memory_api_key', 'tts_api_key'];
const PROFILE_SECRET_FIELDS = ['serper_api_key', 'web_search_keys_json', 'memory_maintenance_api_key'];

const { secretHasConfiguredValue, maskSecretLast4, redactSecretFields, preserveExistingSecretFields } = require("./features/account/secrets.js").createModule({
        
    });

// 0.5 Get User Profile
require("./features/account/http/get-user.js").register(app, { get PROFILE_SECRET_FIELDS() { return PROFILE_SECRET_FIELDS; }, get authMiddleware() { return authMiddleware; }, get redactSecretFields() { return redactSecretFields; } });

// 0.6 Save User Profile
require("./features/account/http/post-user.js").register(app, { get PROFILE_SECRET_FIELDS() { return PROFILE_SECRET_FIELDS; }, get authMiddleware() { return authMiddleware; }, get preserveExistingSecretFields() { return preserveExistingSecretFields; }, get redactSecretFields() { return redactSecretFields; } });

require("./features/memory/http/get-user-memory-status.js").register(app, { get authMiddleware() { return authMiddleware; }, get fs() { return fs; }, get path() { return path; }, get qdrant() { return qdrant; } });

require("./features/memory/http/get-memory-maintenance-settings.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get redactMemoryMaintenanceSettings() { return redactMemoryMaintenanceSettings; } });

require("./features/memory/http/put-memory-maintenance-settings.js").register(app, { get authMiddleware() { return authMiddleware; }, get redactMemoryMaintenanceSettings() { return redactMemoryMaintenanceSettings; }, get updateMemoryMaintenanceSettings() { return updateMemoryMaintenanceSettings; } });

const { purgeExpiredForgettingMemoriesForRequest } = require("./features/memory/maintenance/expiration.js").createModule({
        
    });

require("./features/memory/http/get-memory-maintenance-overview.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceOverview() { return getMemoryMaintenanceOverview; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get purgeExpiredForgettingMemoriesForRequest() { return purgeExpiredForgettingMemoriesForRequest; }, get redactMemoryMaintenanceSettings() { return redactMemoryMaintenanceSettings; } });

require("./features/memory/http/get-memory-maintenance-library.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceLibrary() { return getMemoryMaintenanceLibrary; }, get normalizeMemoryMaintenanceLibraryOptions() { return normalizeMemoryMaintenanceLibraryOptions; }, get purgeExpiredForgettingMemoriesForRequest() { return purgeExpiredForgettingMemoriesForRequest; } });

require("./features/memory/http/post-memory-maintenance-rescue.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceOverview() { return getMemoryMaintenanceOverview; }, get getWsClients() { return getWsClients; }, get parseBooleanFlag() { return parseBooleanFlag; }, get rescueMemoryMaintenanceItems() { return rescueMemoryMaintenanceItems; } });

// 1. Get all characters (Contacts list)
require("./features/memory/http/get-system-embedding-status.js").register(app, { get authMiddleware() { return authMiddleware; }, get getEmbeddingDebugStatus() { return getEmbeddingDebugStatus; } });

require("./features/admin/http/get-system-background-queue.js").register(app, { get authDb() { return authDb; }, get authMiddleware() { return authMiddleware; }, get getBackgroundQueueStats() { return getBackgroundQueueStats; } });

require("./features/characters/http/get-characters.js").register(app, { get CHARACTER_SECRET_FIELDS() { return CHARACTER_SECRET_FIELDS; }, get authMiddleware() { return authMiddleware; }, get deriveEmotion() { return deriveEmotion; }, get redactSecretFields() { return redactSecretFields; } });

require("./features/characters/http/get-characters-id-message-stats.js").register(app, { get authMiddleware() { return authMiddleware; } });

// 2. Add or Update Character
require("./features/characters/http/post-characters.js").register(app, { get CHARACTER_SECRET_FIELDS() { return CHARACTER_SECRET_FIELDS; }, get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; }, get preserveExistingSecretFields() { return preserveExistingSecretFields; }, get redactSecretFields() { return redactSecretFields; } });

// 2.1 Update Character Fields (Partial)
require("./features/characters/http/put-characters-id.js").register(app, { get CHARACTER_SECRET_FIELDS() { return CHARACTER_SECRET_FIELDS; }, get authMiddleware() { return authMiddleware; }, get preserveExistingSecretFields() { return preserveExistingSecretFields; }, get redactSecretFields() { return redactSecretFields; } });

require("./features/characters/http/post-characters-id-reset-physical-state.js").register(app, { get authMiddleware() { return authMiddleware; } });

const { handleModelListProxy } = require("./features/characters/modelCatalog.js").createModule({
        get buildOpenAiCompatibleUrlResolved() { return buildOpenAiCompatibleUrlResolved; }
    });

// 2.5 Fetch available models from a given API endpoint (proxy to avoid CORS + key exposure in browser)
require("./features/characters/http/post-models.js").register(app, { get authMiddleware() { return authMiddleware; }, get handleModelListProxy() { return handleModelListProxy; } });

// Fetch models for a saved character. This lets the settings editor reuse the
// stored key without returning the secret back to the browser.
require("./features/characters/http/post-characters-id-models.js").register(app, { get authMiddleware() { return authMiddleware; }, get handleModelListProxy() { return handleModelListProxy; } });

// Legacy GET shape kept for compatibility, but it is still authenticated.
require("./features/characters/http/get-models.js").register(app, { get authMiddleware() { return authMiddleware; }, get handleModelListProxy() { return handleModelListProxy; } });

require("./features/conversation-search/http/get-messages-search.js").register(app, { get authMiddleware() { return authMiddleware; }, get normalizeQueryLimit() { return normalizeQueryLimit; } });

// Registered after /messages/search so the static search route keeps precedence.
registerPrivateMessageRoutes(app, {
    authMiddleware,
    getService: req => createMessageService({
        db: req.db,
        runtime: {
            notifyMessage: message => req.engine.broadcastNewMessage?.(getWsClients(req.user.id), message),
            handleUserMessage: (id, options) => req.engine.handleUserMessage(id, getWsClients(req.user.id), options),
            triggerImmediateUserReply: (id, options) => req.engine.triggerImmediateUserReply(id, getWsClients(req.user.id), options),
            triggerJealousyCheck: id => req.engine.triggerJealousyCheck(id, getWsClients(req.user.id)),
            applyCityBusyPatch: character => {
                const patch = pluginContext.hooks?.cityBusyChatImpactPatch?.(character, 'private');
                if (patch && Object.keys(patch).length) req.db.updateCharacter(character.id, patch);
            }
        }
    })
});

require("./features/characters/http/get-characters-characterId-emotion-logs.js").register(app, { get authMiddleware() { return authMiddleware; }, get normalizeQueryLimit() { return normalizeQueryLimit; } });

require("./features/private-chat/http/get-characters-characterId-llm-debug-logs.js").register(app, { get authMiddleware() { return authMiddleware; }, get normalizeQueryLimit() { return normalizeQueryLimit; } });

registerPrivateReplyRoutes(app, {
    authMiddleware,
    changeReplyVersion: (req, characterId, messageId, options) =>
        req.engine.changePrivateReplyVersion(characterId, messageId, getWsClients(req.user.id), options)
});

require("./features/speech/http/get-tts-audio-messageId.js").register(app, { get authMiddleware() { return authMiddleware; }, get fs() { return fs; }, get resolveTtsAudioPath() { return resolveTtsAudioPath; }, get sanitizeTtsMimeType() { return sanitizeTtsMimeType; } });

require("./features/speech/http/get-tts-tencent-voices.js").register(app, { get authMiddleware() { return authMiddleware; }, get getTencentVoiceList() { return getTencentVoiceList; } });

require("./features/speech/http/post-tts-preview-characterId.js").register(app, { get authMiddleware() { return authMiddleware; }, get synthesizeSpeech() { return synthesizeSpeech; } });

require("./features/private-chat/http/get-debug-reply-dispatch-characterId.js").register(app, { get authMiddleware() { return authMiddleware; }, get normalizeQueryLimit() { return normalizeQueryLimit; } });

// 4.5 Send a transfer to a character (Unblock mechanic)
require("./features/economy/http/post-transfer.js").register(app, { get authMiddleware() { return authMiddleware; }, get createRequestTraceId() { return createRequestTraceId; }, get getWsClients() { return getWsClients; }, get normalizePaymentNote() { return normalizePaymentNote; }, get normalizePositiveMoney() { return normalizePositiveMoney; } });

const { parseGeneratedCharacterReply, requireGeneratedCharacterText, requireGeneratedCharacterInteger, requireGeneratedCharacterFlag, normalizeGeneratedCharacterPayload, isLocalOllamaEndpoint, getLocalCharacterGeneratorConfig, buildLocalOllamaNativeChatUrl, callLocalOllamaCharacterGenerator } = require("./features/characters/generation.js").createModule({
        
    });

// 4.55 Generate Character via LLM
require("./features/characters/http/post-characters-generate.js").register(app, { get authMiddleware() { return authMiddleware; }, get buildDefaultAvatarUrl() { return buildDefaultAvatarUrl; }, get callLLM() { return callLLM; }, get callLocalOllamaCharacterGenerator() { return callLocalOllamaCharacterGenerator; }, get getLocalCharacterGeneratorConfig() { return getLocalCharacterGeneratorConfig; }, get getWsClients() { return getWsClients; }, get normalizeGeneratedCharacterPayload() { return normalizeGeneratedCharacterPayload; }, get parseGeneratedCharacterReply() { return parseGeneratedCharacterReply; } });

// 4.7 DEEP WIPE: Clear all messages, sql memories, diaries, and vectors
require("./features/backup/http/delete-data-characterId.js").register(app, { get authMiddleware() { return authMiddleware; }, get createRequestTraceId() { return createRequestTraceId; }, get getWsClients() { return getWsClients; } });

// 4.8 EXPORT: Export character data (settings, messages, memories, diaries)
require("./features/backup/http/get-data-characterId-export.js").register(app, { get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; }, get qdrant() { return qdrant; }, get sanitizeDownloadName() { return sanitizeDownloadName; } });

require("./features/backup/http/post-data-characterId-import.js").register(app, { get authMiddleware() { return authMiddleware; }, get clearCharacterArchiveData() { return clearCharacterArchiveData; }, get getWsClients() { return getWsClients; }, get importCharacterArchiveRows() { return importCharacterArchiveRows; }, get memoryImportUpload() { return memoryImportUpload; }, get multer() { return multer; }, get parseBooleanFlag() { return parseBooleanFlag; }, get parseCharacterArchiveRequest() { return parseCharacterArchiveRequest; }, get runArchiveCleanup() { return runArchiveCleanup; } });

const { normalizeMemorySourceRef, buildMemorySourcePayload } = require("./features/memory/sources.js").createModule({
        get getExternalSourceAppLabel() { return getExternalSourceAppLabel; },
        get tryParseJsonValue() { return tryParseJsonValue; }
    });

require("./features/memory/http/get-memory-source.js").register(app, { get authMiddleware() { return authMiddleware; }, get buildMemorySourcePayload() { return buildMemorySourcePayload; }, get normalizeMemorySourceRef() { return normalizeMemorySourceRef; } });

// 5. Get Memories for Character
require("./features/memory/http/get-memories-characterId.js").register(app, { get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; } });

require("./features/memory/http/get-memories-characterId-export.js").register(app, { get authMiddleware() { return authMiddleware; }, get sanitizeDownloadName() { return sanitizeDownloadName; } });

// 5.5 Trigger Manual Memory Extraction
require("./features/memory/http/post-memories-characterId-extract.js").register(app, { get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; } });

require("./features/memory/http/post-memories-characterId-import.js").register(app, { get MEMORY_IMPORT_MAX_ITEMS() { return MEMORY_IMPORT_MAX_ITEMS; }, get authMiddleware() { return authMiddleware; }, get memoryImportUpload() { return memoryImportUpload; }, get multer() { return multer; }, get normalizeImportedMemoryEntry() { return normalizeImportedMemoryEntry; }, get parseBooleanFlag() { return parseBooleanFlag; }, get parseMemoryImportRequest() { return parseMemoryImportRequest; } });

require("./features/memory/http/post-memory-import-external-preview.js").register(app, { get EXTERNAL_MEMORY_IMPORT_LLM_TIMEOUT_MS() { return EXTERNAL_MEMORY_IMPORT_LLM_TIMEOUT_MS; }, get authMiddleware() { return authMiddleware; }, get buildExternalImportPrompt() { return buildExternalImportPrompt; }, get callLLM() { return callLLM; }, get extractJsonObjectFromText() { return extractJsonObjectFromText; }, get getExternalSourceAppLabel() { return getExternalSourceAppLabel; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get memoryImportUpload() { return memoryImportUpload; }, get multer() { return multer; }, get normalizeExternalCharacterName() { return normalizeExternalCharacterName; }, get normalizeExternalImportMode() { return normalizeExternalImportMode; }, get normalizeExternalImportResult() { return normalizeExternalImportResult; }, get normalizeExternalSourceApp() { return normalizeExternalSourceApp; }, get parseExternalImportRequest() { return parseExternalImportRequest; } });

require("./features/memory/http/post-memory-import-external-auto-run.js").register(app, { get EXTERNAL_MEMORY_IMPORT_LLM_TIMEOUT_MS() { return EXTERNAL_MEMORY_IMPORT_LLM_TIMEOUT_MS; }, get authMiddleware() { return authMiddleware; }, get broadcastToWsClients() { return broadcastToWsClients; }, get buildExternalImportPrompt() { return buildExternalImportPrompt; }, get callLLM() { return callLLM; }, get chunkExternalImportMessages() { return chunkExternalImportMessages; }, get countExternalImportSavedBindings() { return countExternalImportSavedBindings; }, get countUniqueExternalImportSavedItems() { return countUniqueExternalImportSavedItems; }, get enqueueBackgroundTask() { return enqueueBackgroundTask; }, get extractJsonObjectFromText() { return extractJsonObjectFromText; }, get findActiveMemoryMaintenanceRun() { return findActiveMemoryMaintenanceRun; }, get formatExternalImportSavedSamples() { return formatExternalImportSavedSamples; }, get getExternalImportSavedCharacterIds() { return getExternalImportSavedCharacterIds; }, get getExternalSourceAppLabel() { return getExternalSourceAppLabel; }, get getMemoryMaintenanceRunSnapshot() { return getMemoryMaintenanceRunSnapshot; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get getWsClients() { return getWsClients; }, get inferExternalImportContinueOffset() { return inferExternalImportContinueOffset; }, get loadExternalImportRequestFromDb() { return loadExternalImportRequestFromDb; }, get memoryImportUpload() { return memoryImportUpload; }, get memoryMaintenanceRuns() { return memoryMaintenanceRuns; }, get mergeExternalImportRoleTags() { return mergeExternalImportRoleTags; }, get multer() { return multer; }, get normalizeExternalCharacterName() { return normalizeExternalCharacterName; }, get normalizeExternalImportMode() { return normalizeExternalImportMode; }, get normalizeExternalImportResult() { return normalizeExternalImportResult; }, get normalizeExternalSourceApp() { return normalizeExternalSourceApp; }, get normalizeMemoryMaintenanceAutoRunControls() { return normalizeMemoryMaintenanceAutoRunControls; }, get normalizeMemoryMaintenanceBatchOptions() { return normalizeMemoryMaintenanceBatchOptions; }, get normalizeOptionalMemoryId() { return normalizeOptionalMemoryId; }, get parseBooleanFlag() { return parseBooleanFlag; }, get parseExternalImportRequest() { return parseExternalImportRequest; }, get safeJsonParse() { return safeJsonParse; }, get saveExternalImportCandidatesDirect() { return saveExternalImportCandidatesDirect; }, get yieldToServerLoop() { return yieldToServerLoop; } });

require("./features/memory/http/get-memory-import-external-latest.js").register(app, { get authMiddleware() { return authMiddleware; }, get safeJsonParse() { return safeJsonParse; } });

require("./features/memory/http/post-memory-import-external-importId-commit.js").register(app, { get authMiddleware() { return authMiddleware; }, get broadcastToWsClients() { return broadcastToWsClients; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get getWsClients() { return getWsClients; }, get normalizeExternalCharacterName() { return normalizeExternalCharacterName; }, get normalizeMemoryId() { return normalizeMemoryId; }, get saveExternalImportCandidatesDirect() { return saveExternalImportCandidatesDirect; }, get tryParseJsonValue() { return tryParseJsonValue; } });

require("./features/memory/http/get-memories-characterId-maintenance-stats.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceStats() { return getMemoryMaintenanceStats; } });

require("./features/memory/http/get-memories-characterId-maintenance-batch.js").register(app, { get MEMORY_MAINTENANCE_ACTIONS() { return MEMORY_MAINTENANCE_ACTIONS; }, get MEMORY_MAINTENANCE_FOCUS() { return MEMORY_MAINTENANCE_FOCUS; }, get MEMORY_MAINTENANCE_STATUS() { return MEMORY_MAINTENANCE_STATUS; }, get MEMORY_MAINTENANCE_TIERS() { return MEMORY_MAINTENANCE_TIERS; }, get authMiddleware() { return authMiddleware; }, get buildMemoryMigrationPrompt() { return buildMemoryMigrationPrompt; }, get getMemoryMaintenanceBatch() { return getMemoryMaintenanceBatch; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get normalizeMemoryMaintenanceBatchOptions() { return normalizeMemoryMaintenanceBatchOptions; }, get parseBooleanFlag() { return parseBooleanFlag; } });

require("./features/memory/http/get-memories-characterId-maintenance-temporal-binding-batch.js").register(app, { get MEMORY_SCENE_TAGS() { return MEMORY_SCENE_TAGS; }, get MEMORY_SOURCE_CONTEXTS() { return MEMORY_SOURCE_CONTEXTS; }, get MEMORY_TEMPORAL_BINDING_LABELS() { return MEMORY_TEMPORAL_BINDING_LABELS; }, get MEMORY_TEMPORAL_BINDING_SCOPES() { return MEMORY_TEMPORAL_BINDING_SCOPES; }, get authMiddleware() { return authMiddleware; }, get buildMemoryTemporalBindingPrompt() { return buildMemoryTemporalBindingPrompt; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get getMemoryTemporalBindingBatch() { return getMemoryTemporalBindingBatch; }, get normalizeMemoryMaintenanceBatchOptions() { return normalizeMemoryMaintenanceBatchOptions; }, get normalizeMemoryTemporalBindingSource() { return normalizeMemoryTemporalBindingSource; }, get parseBooleanFlag() { return parseBooleanFlag; } });

require("./features/memory/http/post-memories-characterId-maintenance-temporal-binding-run.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get getWsClients() { return getWsClients; }, get parseBooleanFlag() { return parseBooleanFlag; }, get runMemoryTemporalBindingBatch() { return runMemoryTemporalBindingBatch; } });

require("./features/memory/http/post-memories-characterId-maintenance-temporal-binding-auto-run.js").register(app, { get authMiddleware() { return authMiddleware; }, get broadcastToWsClients() { return broadcastToWsClients; }, get enqueueBackgroundTask() { return enqueueBackgroundTask; }, get findActiveMemoryMaintenanceRun() { return findActiveMemoryMaintenanceRun; }, get getMemoryMaintenanceRunSnapshot() { return getMemoryMaintenanceRunSnapshot; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get getMemoryMaintenanceStats() { return getMemoryMaintenanceStats; }, get getMemoryTemporalBindingBatch() { return getMemoryTemporalBindingBatch; }, get getWsClients() { return getWsClients; }, get memoryMaintenanceRuns() { return memoryMaintenanceRuns; }, get normalizeMemoryMaintenanceAutoRunControls() { return normalizeMemoryMaintenanceAutoRunControls; }, get normalizeMemoryMaintenanceBatchOptions() { return normalizeMemoryMaintenanceBatchOptions; }, get normalizeMemoryTemporalBindingSource() { return normalizeMemoryTemporalBindingSource; }, get parseBooleanFlag() { return parseBooleanFlag; }, get runMemoryTemporalBindingBatch() { return runMemoryTemporalBindingBatch; }, get yieldToServerLoop() { return yieldToServerLoop; } });

require("./features/memory/http/post-memories-characterId-maintenance-run.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get getWsClients() { return getWsClients; }, get parseBooleanFlag() { return parseBooleanFlag; }, get runMemoryMaintenanceBatch() { return runMemoryMaintenanceBatch; } });

require("./features/memory/http/get-memory-maintenance-runs.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceRunSnapshot() { return getMemoryMaintenanceRunSnapshot; }, get memoryMaintenanceRuns() { return memoryMaintenanceRuns; }, get parseBooleanFlag() { return parseBooleanFlag; }, get pruneMemoryMaintenanceRuns() { return pruneMemoryMaintenanceRuns; } });

require("./features/memory/http/get-memory-maintenance-runs-runId.js").register(app, { get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceRunSnapshot() { return getMemoryMaintenanceRunSnapshot; }, get memoryMaintenanceRuns() { return memoryMaintenanceRuns; }, get pruneMemoryMaintenanceRuns() { return pruneMemoryMaintenanceRuns; } });

require("./features/memory/http/post-memories-characterId-maintenance-auto-run.js").register(app, { get authMiddleware() { return authMiddleware; }, get broadcastToWsClients() { return broadcastToWsClients; }, get enqueueBackgroundTask() { return enqueueBackgroundTask; }, get findActiveMemoryMaintenanceRun() { return findActiveMemoryMaintenanceRun; }, get getMemoryMaintenanceRunSnapshot() { return getMemoryMaintenanceRunSnapshot; }, get getMemoryMaintenanceSettings() { return getMemoryMaintenanceSettings; }, get getMemoryMaintenanceStats() { return getMemoryMaintenanceStats; }, get getWsClients() { return getWsClients; }, get memoryMaintenanceRuns() { return memoryMaintenanceRuns; }, get normalizeMemoryMaintenanceAutoRunControls() { return normalizeMemoryMaintenanceAutoRunControls; }, get parseBooleanFlag() { return parseBooleanFlag; }, get runMemoryMaintenanceBatch() { return runMemoryMaintenanceBatch; }, get yieldToServerLoop() { return yieldToServerLoop; } });

require("./features/memory/http/post-memories-characterId-maintenance-apply.js").register(app, { get applyMemoryMaintenanceItems() { return applyMemoryMaintenanceItems; }, get authMiddleware() { return authMiddleware; }, get getMemoryMaintenanceStats() { return getMemoryMaintenanceStats; }, get getWsClients() { return getWsClients; }, get parseBooleanFlag() { return parseBooleanFlag; }, get refreshMaintenanceMemoryIndex() { return refreshMaintenanceMemoryIndex; } });

require("./features/memory/http/post-memories-characterId-sweep.js").register(app, { get authMiddleware() { return authMiddleware; } });

// 6. Update / delete a Memory manually
require("./features/memory/http/patch-memories-bulk.js").register(app, { get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; }, get normalizeManualMemoryPatch() { return normalizeManualMemoryPatch; }, get normalizeMemoryIdList() { return normalizeMemoryIdList; } });

require("./features/memory/http/patch-memories-id.js").register(app, { get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; }, get normalizeManualMemoryPatch() { return normalizeManualMemoryPatch; }, get normalizeMemoryId() { return normalizeMemoryId; } });

require("./features/memory/http/delete-memories-bulk.js").register(app, { get authMiddleware() { return authMiddleware; }, get buildMemoryIndexTargets() { return buildMemoryIndexTargets; }, get getWsClients() { return getWsClients; }, get normalizeMemoryIdList() { return normalizeMemoryIdList; } });

require("./features/memory/http/delete-memories-id.js").register(app, { get authMiddleware() { return authMiddleware; }, get buildMemoryIndexTargets() { return buildMemoryIndexTargets; }, get getWsClients() { return getWsClients; }, get normalizeMemoryId() { return normalizeMemoryId; } });

// 9. Get Diaries for a Character
require("./features/diaries/http/get-diaries-characterId.js").register(app, { get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; }, get sanitizeCityNarrationText() { return sanitizeCityNarrationText; } });

// 9.5 Delete a Diary Entry
require("./features/diaries/http/delete-diaries-id.js").register(app, { get authMiddleware() { return authMiddleware; } });

// 10. Unlock Diaries for a Character (Password-lock mechanic)
require("./features/diaries/http/post-diaries-characterId-unlock.js").register(app, { get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; } });


// 11. User Profile (GET handler is already registered above at route 0.5)

require("./features/account/http/put-user.js").register(app, { get authMiddleware() { return authMiddleware; }, get getWsClients() { return getWsClients; } });

// 11.8 Context Token Stats
require("./features/private-chat/http/get-characters-id-context-stats.js").register(app, { get authMiddleware() { return authMiddleware; }, get buildClaudePromptCacheEstimateMessages() { return buildClaudePromptCacheEstimateMessages; }, get estimateJsonWrapperTokensForMessages() { return estimateJsonWrapperTokensForMessages; }, get estimateRequestBodyTokens() { return estimateRequestBodyTokens; }, get extractMessagePlainText() { return extractMessagePlainText; }, get formatContextStatsHistoryMessage() { return formatContextStatsHistoryMessage; }, get getTokenCount() { return getTokenCount; } });

require("./features/private-chat/http/get-characters-id-cache-stats.js").register(app, { get authMiddleware() { return authMiddleware; } });

// 12. Delete Character
require("./features/characters/http/delete-characters-id.js").register(app, { get authMiddleware() { return authMiddleware; }, get buildMemoryIndexTargets() { return buildMemoryIndexTargets; }, get getWsClients() { return getWsClients; } });

// 13. Friendships & Relationships
// MOVED TO DLC: server/plugins/relationships/index.js

// Economy System (Transfers, Wallet, Red Packets) MOVED TO DLC
// See: server/plugins/economy/index.js


// Serve React Frontend (Production)
const clientDistPath = getClientDistDir();
app.use(express.static(clientDistPath, {
    index: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Catch-all route to serve the React app for any unhandled paths (client-side routing)
app.use((req, res, next) => {
    // Exclude API and upload paths from SPA fallback
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return next();
    }
    if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(clientDistPath, 'index.html'));
    } else {
        next();
    }
});



    return { app, server, wss, featureStatus, jobs,
        assertReady: async () => {
            if (featureStatus.failures.length) {
                throw new AggregateError(featureStatus.failures.map(item => item.error),
                    'Feature registration failed: ' + featureStatus.failures.map(item => item.feature).join(', '));
            }
            await assertQdrantStartupReady();
        },
        close: async () => {
            jobs.close();
            for (const clients of userWsClients.values()) for (const client of clients) client.terminate();
            for (const engine of require('./features/private-chat/runtime').engineCache.values()) engine.stopAllTimers();
            await new Promise(resolve => wss.close(resolve));
            if (server.listening) {
                server.closeAllConnections();
                await new Promise(resolve => server.close(resolve));
            }
        }
    };
}

module.exports = { createApplication };
