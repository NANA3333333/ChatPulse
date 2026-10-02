const fs = require('fs');

// ─── 1. REFACTOR ENGINE.JS ────────────────────────────────────────────────
let engineOld = fs.readFileSync('engine.js', 'utf8');
const engineStartStr = "const timers = new Map();";
const engineEndStr = "module.exports = {";
const engineStartIndex = engineOld.indexOf(engineStartStr);
const engineEndIndex = engineOld.indexOf(engineEndStr);
const engineBody = engineOld.slice(engineStartIndex, engineEndIndex);
const engineExports = engineOld.slice(engineEndIndex + engineEndStr.length, engineOld.lastIndexOf('}'));

const engineNew = `const { getUserDb } = require('./db');
const { callLLM } = require('./llm');

const engineCache = new Map();

function getEngine(userId) {
    if (engineCache.has(userId)) return engineCache.get(userId);
    
    // Lazy loaded memory to avoid circular deps
    const { getMemory } = require('./memory');
    
    const db = getUserDb(userId);
    const memory = getMemory(userId);

    // --- ENCLOSED ENGINE FUNCTIONS ---
${engineBody.replace(/const db = require\(\'\.\/db\'\);/g, '').replace(/const \{ searchMemories, extractMemoryFromContext \} = require\(\'\.\/memory\'\);/g, '').replace(/const \{ setDiaryPassword \} = require\(\'\.\/db\'\);/g, '')}
    
    function stopAllTimers() {
        for (const [charId, t] of timers.entries()) {
            clearTimeout(t.timerId);
        }
        timers.clear();
        for (const [groupId, t] of groupProactiveTimers.entries()) {
            clearTimeout(t);
        }
        groupProactiveTimers.clear();
    }

    // --- END ENCLOSED ENGINE FUNCTIONS ---

    const engineInstance = {
${engineExports},
        stopAllTimers
    };
    
    engineCache.set(userId, engineInstance);
    return engineInstance;
}

module.exports = { getEngine };
`;
fs.writeFileSync('engine.js', engineNew.replace(/db\.setDiaryPassword/g, 'db.setDiaryPassword'));

// ─── 2. REFACTOR MEMORY.JS ────────────────────────────────────────────────
let memoryOld = fs.readFileSync('memory.js', 'utf8');
const memStartStr = "const VECTOR_DIM = 384;";
const memEndStr = "module.exports = {";
const memStartIndex = memoryOld.indexOf(memStartStr);
const memEndIndex = memoryOld.indexOf(memEndStr);
const memBody = memoryOld.slice(memStartIndex, memEndIndex);
const memExports = memoryOld.slice(memEndIndex + memEndStr.length, memoryOld.lastIndexOf('}'));

const memoryNew = `const { getUserDb } = require('./db');
const { callLLM } = require('./llm');
const path = require('path');
const fs = require('fs');
let ort;
try { ort = require('onnxruntime-node'); } catch(e) {}
const { pipeline, cos_sim } = require('@xenova/transformers');

const memoryCache = new Map();

function getMemory(userId) {
    if (memoryCache.has(userId)) return memoryCache.get(userId);
    
    const db = getUserDb(userId);

    // --- ENCLOSED MEMORY FUNCTIONS ---
${memBody}
    // --- END ENCLOSED MEMORY FUNCTIONS ---

    const memoryInstance = {
${memExports}
    };
    
    memoryCache.set(userId, memoryInstance);
    return memoryInstance;
}

module.exports = { getMemory };
`;
// Fix db references inside memory.js (no more require db)
fs.writeFileSync('memory.js', memoryNew);

// ─── 3. REFACTOR INDEX.JS ─────────────────────────────────────────────────
let idxOld = fs.readFileSync('index.js.old', 'utf8');

// Replace top requires
idxOld = idxOld.replace("const db = require('./db');", "const { getUserDb } = require('./db');\nconst authDb = require('./authDb');\nconst jwt = require('jsonwebtoken');\nconst JWT_SECRET = process.env.JWT_SECRET || 'chatpulse_super_secret_key';");
idxOld = idxOld.replace("const engine = require('./engine');", "const { getEngine } = require('./engine');");
idxOld = idxOld.replace("const memory = require('./memory');", "const { getMemory } = require('./memory');");

// WS Replacement
const oldWs = `const wsClients = new Set();

wss.on('connection', (ws) => {
    console.log('[WS] Frontend client connected.');
    wsClients.add(ws);

    ws.on('close', () => {
        console.log('[WS] Frontend client disconnected.');
        wsClients.delete(ws);
    });
});`;

const newWs = `const userWsClients = new Map();

wss.on('connection', (ws, req) => {
    try {
        const url = new URL(req.url, \`http://\${req.headers.host || 'localhost'}\`);
        const token = url.searchParams.get('token');
        if (!token) { ws.close(); return; }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;
        
        if (!userWsClients.has(userId)) userWsClients.set(userId, new Set());
        userWsClients.get(userId).add(ws);
        
        ws.userId = userId;
        console.log(\`[WS] User \${userId} connected.\`);
        
        // Start engine proactively when they open the app
        const engine = getEngine(userId);
        if (userWsClients.get(userId).size === 1) {
             engine.startEngine(userWsClients.get(userId));
             engine.startGroupProactiveTimers(userWsClients.get(userId));
        }
        
        ws.on('close', () => {
             console.log(\`[WS] User \${userId} disconnected.\`);
             const set = userWsClients.get(userId);
             if (set) {
                 set.delete(ws);
                 if (set.size === 0) {
                     userWsClients.delete(userId);
                     // Stop engine completely when they close all tabs to save CPU/RAM!
                     engine.stopAllTimers();
                 }
             }
        });
    } catch (e) {
        console.log('[WS] Invalid token connection attempt.');
        ws.close();
    }
});

function getWsClients(userId) {
    if (!userWsClients.has(userId)) userWsClients.set(userId, new Set());
    return userWsClients.get(userId);
}`;
idxOld = idxOld.replace(oldWs, newWs);

// Auth Routes + Middleware
const middleware = `
// ─── AUTHENTICATION MIDDLEWARE ──────────────────────────────────────────
authDb.initAuthDb();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        req.db = getUserDb(req.user.id);
        req.engine = getEngine(req.user.id);
        req.memory = getMemory(req.user.id);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// ─── AUTH ROUTES ────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
        const result = authDb.createUser(username, password);
        if (!result.success) return res.status(400).json({ error: result.error });
        const token = jwt.sign({ id: result.user.id, username: result.user.username }, JWT_SECRET, { expiresIn: '30d' });
        getUserDb(result.user.id);
        res.json({ success: true, token, user: result.user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const result = authDb.verifyUser(username, password);
        if (!result.success) return res.status(401).json({ error: result.error });
        const token = jwt.sign({ id: result.user.id, username: result.user.username }, JWT_SECRET, { expiresIn: '30d' });
        getUserDb(result.user.id);
        res.json({ success: true, token, user: result.user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ success: true, user: req.user });
});

`;
idxOld = idxOld.replace("// REST API ROUTES\n// ─────────────────────────────────────────────────────────────", middleware + "\n// REST API ROUTES\n// ─────────────────────────────────────────────────────────────");

// Refactor endpoint handlers to inject scoped objects
idxOld = idxOld.replace(/app\.(get|post|put|delete)\('\/api\/(?!auth|upload|models)([^']+)', (async )?\((req, res)\) => \{/g,
    "app.$1('/api/$2', authMiddleware, $3(req, res) => {\n        const db = req.db;\n        const engine = req.engine;\n        const memory = req.memory;\n        const wsClients = getWsClients(req.user.id);");

// Remove top-level db.initDb()
idxOld = idxOld.replace("db.initDb();", "");

fs.writeFileSync('index.js', idxOld);
console.log('Successfully refactored engine.js, memory.js, and index.js!');
