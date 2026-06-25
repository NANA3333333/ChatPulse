const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const INVITE_DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;
const MAX_FAILED_LOGINS = Math.max(1, Number(process.env.CP_MAX_FAILED_LOGINS || 8) || 8);
const LOGIN_LOCK_MS = Math.max(60 * 1000, Number(process.env.CP_LOGIN_LOCK_MS || 15 * 60 * 1000) || 15 * 60 * 1000);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// master.db is intended strictly for authentication and tracking which user maps to which personal db file
const dbPath = path.join(dataDir, 'master.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function generateInitialAdminPassword() {
    return crypto.randomBytes(18).toString('base64url');
}

function initAuthDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            token_version INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_id TEXT NOT NULL UNIQUE,
            user_agent TEXT DEFAULT '',
            ip TEXT DEFAULT '',
            created_at INTEGER NOT NULL,
            last_seen_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            revoked_at INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active'
        );
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, status, expires_at);
        CREATE TABLE IF NOT EXISTS auth_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT '',
            username TEXT DEFAULT '',
            event_type TEXT NOT NULL,
            ip TEXT DEFAULT '',
            user_agent TEXT DEFAULT '',
            created_at INTEGER NOT NULL,
            detail TEXT DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_auth_events_user_time ON auth_events(user_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS invite_codes (
            code TEXT PRIMARY KEY,
            used_by TEXT,
            created_at INTEGER NOT NULL,
            max_uses INTEGER NOT NULL DEFAULT 1,
            use_count INTEGER NOT NULL DEFAULT 0,
            expires_at INTEGER DEFAULT 0,
            note TEXT DEFAULT '',
            created_by TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active'
        );
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
    `);

    try {
        db.exec("ALTER TABLE users ADD COLUMN last_active_at INTEGER DEFAULT 0;");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.exec("ALTER TABLE users ADD COLUMN username_norm TEXT DEFAULT '';");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.exec("ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.exec("ALTER TABLE users ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0;");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.exec("ALTER TABLE users ADD COLUMN last_login_at INTEGER NOT NULL DEFAULT 0;");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.exec("ALTER TABLE users ADD COLUMN password_updated_at INTEGER NOT NULL DEFAULT 0;");
    } catch (e) {
        // Column may already exist, ignore error
    }
    try {
        db.prepare("UPDATE users SET username_norm = lower(username) WHERE COALESCE(username_norm, '') = ''").run();
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_norm ON users(username_norm);');
    } catch (e) {
        console.warn('[AuthDB] Failed to ensure normalized username index:', e.message);
    }
    const inviteColumns = [
        ["max_uses", "INTEGER NOT NULL DEFAULT 1"],
        ["use_count", "INTEGER NOT NULL DEFAULT 0"],
        ["expires_at", "INTEGER DEFAULT 0"],
        ["note", "TEXT DEFAULT ''"],
        ["created_by", "TEXT DEFAULT ''"],
        ["status", "TEXT NOT NULL DEFAULT 'active'"]
    ];
    for (const [name, type] of inviteColumns) {
        try {
            db.exec(`ALTER TABLE invite_codes ADD COLUMN ${name} ${type};`);
        } catch (e) {
            // Column may already exist, ignore error
        }
    }

    // Auto-seed root admin account "Nana"
    const rootUser = db.prepare('SELECT id FROM users WHERE username = ?').get('Nana');
    if (!rootUser) {
        const adminPw = process.env.ADMIN_PASSWORD || generateInitialAdminPassword();
        if (!process.env.ADMIN_PASSWORD) {
            console.log(`[AuthDB] ⚠️  No ADMIN_PASSWORD env var set. Generated random admin password: ${adminPw}`);
            console.log('[AuthDB] Save this password now, then set ADMIN_PASSWORD in server/.env before the next fresh initialization if you want a fixed first-run password.');
        }
        const id = generateId();
        const hash = bcrypt.hashSync(adminPw, 10);
        db.prepare('INSERT INTO users (id, username, username_norm, password_hash, created_at, role, status, token_version, password_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, 'Nana', normalizeUsername('Nana').normalized, hash, Date.now(), 'root', 'active', 0, Date.now());
        console.log('[AuthDB] Root user Nana seeded successfully.');
    } else {
        db.prepare('UPDATE users SET role = ?, status = COALESCE(status, ?), token_version = COALESCE(token_version, 0), username_norm = ? WHERE username = ?').run('root', 'active', normalizeUsername('Nana').normalized, 'Nana');
    }
    console.log('[AuthDB] Master auth database initialized successfully.');
}

// Generate a simple alphanumeric ID
function generateId() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function generateSecureId(prefix = '') {
    const id = crypto.randomBytes(18).toString('base64url');
    return prefix ? `${prefix}_${id}` : id;
}

function normalizeUsername(username) {
    const display = String(username || '').trim();
    const normalized = display.toLowerCase();
    if (!display || display.length < 2 || display.length > 32) {
        return { ok: false, error: 'Username must be 2-32 characters long' };
    }
    if (!/^[\p{L}\p{N}_@.-]+$/u.test(display)) {
        return { ok: false, error: 'Username can only contain letters, numbers, _, @, ., or -' };
    }
    return { ok: true, display, normalized };
}

function validatePassword(password, label = 'Password') {
    if (!password || String(password).length < PASSWORD_MIN_LENGTH) {
        return `${label} must be at least ${PASSWORD_MIN_LENGTH} characters long`;
    }
    return '';
}

function cleanInviteCode(code) {
    return String(code || '').trim().toUpperCase();
}

function recordAuthEvent(event = {}) {
    try {
        db.prepare(`
            INSERT INTO auth_events (user_id, username, event_type, ip, user_agent, created_at, detail)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            String(event.userId || ''),
            String(event.username || ''),
            String(event.type || 'auth_event'),
            String(event.ip || '').slice(0, 120),
            String(event.userAgent || '').slice(0, 500),
            Date.now(),
            String(event.detail || '').slice(0, 1000)
        );
    } catch (e) {
        console.warn('[AuthDB] Failed to record auth event:', e.message);
    }
}

function createUser(username, password, inviteCode) {
    try {
        const normalizedUsername = normalizeUsername(username);
        if (!normalizedUsername.ok) return { success: false, error: normalizedUsername.error };

        const passwordError = validatePassword(password);
        if (passwordError) return { success: false, error: passwordError };

        const cleanCode = cleanInviteCode(inviteCode);
        if (!cleanCode) return { success: false, error: 'Invite code is required' };
        const invite = db.prepare('SELECT code, status, use_count, max_uses, expires_at FROM invite_codes WHERE code = ?').get(cleanCode);
        if (!invite) return { success: false, error: 'Invalid invite code' };
        if (invite.status !== 'active') return { success: false, error: 'Invite code is not active' };
        if (invite.expires_at && Date.now() > invite.expires_at) return { success: false, error: 'Invite code has expired' };
        if ((invite.use_count || 0) >= (invite.max_uses || 1)) return { success: false, error: 'Invite code has reached its usage limit' };

        const id = generateId();
        const hash = bcrypt.hashSync(password, 10);
        const role = 'user';

        db.transaction(() => {
            db.prepare('INSERT INTO users (id, username, username_norm, password_hash, created_at, role, status, token_version, password_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, normalizedUsername.display, normalizedUsername.normalized, hash, Date.now(), role, 'active', 0, Date.now());
            db.prepare(`
                UPDATE invite_codes
                SET used_by = CASE WHEN max_uses <= 1 THEN ? ELSE COALESCE(used_by, '') END,
                    use_count = COALESCE(use_count, 0) + 1,
                    status = CASE
                        WHEN (COALESCE(use_count, 0) + 1) >= COALESCE(max_uses, 1) THEN 'used'
                        ELSE status
                    END
                WHERE code = ?
            `).run(normalizedUsername.display, cleanCode);
        })();

        recordAuthEvent({
            userId: id,
            username: normalizedUsername.display,
            type: 'register',
            detail: `invite:${cleanCode}`,
        });
        return { success: true, user: { id, username: normalizedUsername.display, role, status: 'active', tokenVersion: 0 } };
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            return { success: false, error: 'Username already exists' };
        }
        return { success: false, error: e.message };
    }
}

function verifyUser(username, password, meta = {}) {
    const normalizedUsername = normalizeUsername(username);
    const lookup = normalizedUsername.ok ? normalizedUsername.normalized : String(username || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE username_norm = ? OR lower(username) = ?').get(lookup, lookup);
    const genericError = 'Invalid username or password';
    if (!user) {
        recordAuthEvent({ username, type: 'login_failed', ip: meta.ip, userAgent: meta.userAgent, detail: 'unknown_user' });
        return { success: false, error: genericError };
    }

    if (user.status === 'banned') {
        recordAuthEvent({ userId: user.id, username: user.username, type: 'login_blocked', ip: meta.ip, userAgent: meta.userAgent, detail: 'banned' });
        return { success: false, error: 'This account has been banned' };
    }

    const now = Date.now();
    if (Number(user.locked_until || 0) > now) {
        recordAuthEvent({ userId: user.id, username: user.username, type: 'login_blocked', ip: meta.ip, userAgent: meta.userAgent, detail: 'locked' });
        return { success: false, error: 'Too many failed login attempts. Please try again later.' };
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
        const failedCount = Number(user.failed_login_count || 0) + 1;
        const lockedUntil = failedCount >= MAX_FAILED_LOGINS ? now + LOGIN_LOCK_MS : 0;
        db.prepare('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?').run(failedCount, lockedUntil, user.id);
        recordAuthEvent({ userId: user.id, username: user.username, type: 'login_failed', ip: meta.ip, userAgent: meta.userAgent, detail: lockedUntil ? 'locked' : 'bad_password' });
        return { success: false, error: lockedUntil ? 'Too many failed login attempts. Please try again later.' : genericError };
    }

    db.prepare('UPDATE users SET failed_login_count = 0, locked_until = 0, last_login_at = ? WHERE id = ?').run(now, user.id);
    recordAuthEvent({ userId: user.id, username: user.username, type: 'login_success', ip: meta.ip, userAgent: meta.userAgent });

    return {
        success: true,
        user: {
            id: user.id,
            username: user.username,
            role: user.role || 'user',
            status: user.status || 'active',
            tokenVersion: user.token_version || 0
        }
    };
}

function updateOwnAccount(id, options = {}) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return { success: false, error: 'User not found' };

    const currentPassword = String(options.currentPassword || '');
    const nextUsername = typeof options.username === 'string' ? options.username.trim() : '';
    const nextPassword = typeof options.newPassword === 'string' ? options.newPassword : '';

    if (!currentPassword) return { success: false, error: 'Current password is required' };
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return { success: false, error: 'Current password is incorrect' };
    }

    const updates = [];
    const values = [];
    let tokenVersion = Number(user.token_version || 0);

    if (nextUsername && nextUsername !== user.username) {
        const normalizedUsername = normalizeUsername(nextUsername);
        if (!normalizedUsername.ok) return { success: false, error: normalizedUsername.error };
        const existing = db.prepare('SELECT id FROM users WHERE username_norm = ? AND id <> ?').get(normalizedUsername.normalized, id);
        if (existing) return { success: false, error: 'Username already exists' };
        updates.push('username = ?');
        values.push(normalizedUsername.display);
        updates.push('username_norm = ?');
        values.push(normalizedUsername.normalized);
        tokenVersion += 1;
    }

    if (nextPassword) {
        const passwordError = validatePassword(nextPassword, 'New password');
        if (passwordError) return { success: false, error: passwordError };
        updates.push('password_hash = ?');
        values.push(bcrypt.hashSync(nextPassword, 10));
        updates.push('password_updated_at = ?');
        values.push(Date.now());
        tokenVersion += 1;
    }

    if (updates.length === 0) {
        return {
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role || 'user',
                status: user.status || 'active',
                tokenVersion
            }
        };
    }

    updates.push('token_version = ?');
    values.push(tokenVersion);
    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedUser = db.prepare('SELECT id, username, role, status, token_version FROM users WHERE id = ?').get(id);
    return {
        success: true,
        user: {
            id: updatedUser.id,
            username: updatedUser.username,
            role: updatedUser.role || 'user',
            status: updatedUser.status || 'active',
            tokenVersion: updatedUser.token_version || 0
        }
    };
}

function getUserById(id) {
    return db.prepare('SELECT id, username, created_at, role, status, token_version, last_active_at FROM users WHERE id = ?').get(id);
}

function generateInviteCode(options = {}) {
    // Use crypto for unpredictable invite codes (12 chars)
    const code = crypto.randomBytes(9).toString('base64url').substring(0, 12).toUpperCase();
    const createdAt = Date.now();
    const maxUses = normalizeInviteMaxUses(options.maxUses);
    const defaultExpiresAt = createdAt + INVITE_DEFAULT_TTL_MS;
    const expiresAt = normalizeInviteExpiresAt(options.expiresAt, defaultExpiresAt);
    const note = String(options.note || '').trim();
    const createdBy = String(options.createdBy || '').trim();
    db.prepare(`
        INSERT INTO invite_codes (code, created_at, max_uses, use_count, expires_at, note, created_by, status)
        VALUES (?, ?, ?, 0, ?, ?, ?, 'active')
    `).run(code, createdAt, maxUses, expiresAt, note, createdBy);
    return code;
}

function normalizeInviteRow(row) {
    if (!row) return row;
    const expiresAt = Number(row.expires_at || 0);
    const now = Date.now();
    const maxUses = Number(row.max_uses || 1);
    const useCount = Number(row.use_count || 0);
    return {
        ...row,
        max_uses: maxUses,
        use_count: useCount,
        expires_at: expiresAt,
        expired: !!(expiresAt && now > expiresAt),
        remaining_uses: Math.max(0, maxUses - useCount),
        remaining_ms: expiresAt ? Math.max(0, expiresAt - now) : 0,
        remaining_days: expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))) : null,
        usage_label: `${useCount}/${maxUses}`
    };
}

function getInviteCodes() {
    return db.prepare(`
        SELECT code, used_by, created_at, max_uses, use_count, expires_at, note, created_by, status
        FROM invite_codes
        ORDER BY created_at DESC
    `).all().map(normalizeInviteRow);
}

function getInviteCode(code) {
    const cleanCode = cleanInviteCode(code);
    if (!cleanCode) return null;
    return normalizeInviteRow(db.prepare(`
        SELECT code, used_by, created_at, max_uses, use_count, expires_at, note, created_by, status
        FROM invite_codes
        WHERE code = ?
    `).get(cleanCode) || null);
}

function getAllUsers() {
    return db.prepare('SELECT id, username, created_at, last_active_at, last_login_at, failed_login_count, locked_until, password_updated_at, role, status, token_version FROM users ORDER BY created_at DESC').all();
}

function isAdminRole(role) {
    return role === 'root' || role === 'admin';
}

function updateLastActive(id) {
    try {
        db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(Date.now(), id);
    } catch (e) {
        console.error('[AuthDB] Failed to update last active:', e.message);
    }
}

const USER_STATUSES = new Set(['active', 'banned']);
const MUTABLE_USER_ROLES = new Set(['user', 'admin']);

function normalizeUserId(id) {
    return String(id || '').trim();
}

function deleteUser(id) {
    const cleanId = normalizeUserId(id);
    if (!cleanId) return 0;
    return db.prepare('DELETE FROM users WHERE id = ?').run(cleanId).changes || 0;
}

function setUserStatus(id, status) {
    const cleanId = normalizeUserId(id);
    const nextStatus = String(status || '').trim();
    if (!cleanId || !USER_STATUSES.has(nextStatus)) return 0;
    return db.prepare('UPDATE users SET status = ? WHERE id = ?').run(nextStatus, cleanId).changes || 0;
}

function setUserRole(id, role) {
    const cleanId = normalizeUserId(id);
    const nextRole = String(role || '').trim();
    if (!cleanId || !MUTABLE_USER_ROLES.has(nextRole)) return 0;
    return db.prepare('UPDATE users SET role = ? WHERE id = ?').run(nextRole, cleanId).changes || 0;
}

function bumpTokenVersion(id) {
    const cleanId = normalizeUserId(id);
    if (!cleanId) return 0;
    return db.prepare('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?').run(cleanId).changes || 0;
}

function resetPassword(id, newPassword) {
    const cleanId = normalizeUserId(id);
    if (!cleanId) return 0;
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
        throw new AuthValidationError(passwordError);
    }
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    return db.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 0) + 1, password_updated_at = ? WHERE id = ?').run(passwordHash, Date.now(), cleanId).changes || 0;
}

function deleteInviteCode(code) {
    const cleanCode = cleanInviteCode(code);
    if (!cleanCode) return 0;
    return db.prepare('DELETE FROM invite_codes WHERE code = ?').run(cleanCode).changes || 0;
}

const MAX_INVITE_USES = 100000;
const INVITE_STATUSES = new Set(['active', 'used', 'revoked']);

class AuthValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthValidationError';
        this.statusCode = 400;
    }
}

function hasInviteValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeInviteMaxUses(value, fallback = 1) {
    if (!hasInviteValue(value)) return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_INVITE_USES) {
        throw new AuthValidationError('Invalid invite max uses');
    }
    return parsed;
}

function normalizeInviteExpiresAt(value, fallback = 0) {
    if (!hasInviteValue(value)) return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new AuthValidationError('Invalid invite expiry');
    }
    return parsed;
}

function normalizeInviteStatus(value) {
    const status = String(value || '').trim();
    if (!INVITE_STATUSES.has(status)) {
        throw new AuthValidationError('Invalid invite status');
    }
    return status;
}

function updateInviteCode(code, data = {}) {
    const cleanCode = cleanInviteCode(code);
    if (!cleanCode) return 0;
    const fields = [];
    const values = [];
    if (data.status) {
        fields.push('status = ?');
        values.push(normalizeInviteStatus(data.status));
    }
    if (typeof data.note !== 'undefined') {
        fields.push('note = ?');
        values.push(String(data.note || '').trim());
    }
    if (typeof data.maxUses !== 'undefined') {
        fields.push('max_uses = ?');
        values.push(normalizeInviteMaxUses(data.maxUses));
    }
    if (typeof data.expiresAt !== 'undefined') {
        fields.push('expires_at = ?');
        values.push(normalizeInviteExpiresAt(data.expiresAt));
    }
    if (!fields.length) return getInviteCode(cleanCode) ? 1 : 0;
    values.push(cleanCode);
    return db.prepare(`UPDATE invite_codes SET ${fields.join(', ')} WHERE code = ?`).run(...values).changes || 0;
}

function renewInviteCode(code) {
    const cleanCode = cleanInviteCode(code);
    if (!cleanCode) return { success: false, error: 'Invite code not found', statusCode: 404 };
    const invite = getInviteCode(cleanCode);
    if (!invite) return { success: false, error: 'Invite code not found', statusCode: 404 };
    if ((invite.use_count || 0) >= (invite.max_uses || 1)) {
        return { success: false, error: 'Invite code has reached its usage limit', statusCode: 400 };
    }
    const base = Number(invite.expires_at || 0) > Date.now() ? Number(invite.expires_at || 0) : Date.now();
    const nextExpiresAt = base + INVITE_DEFAULT_TTL_MS;
    db.prepare("UPDATE invite_codes SET expires_at = ?, status = CASE WHEN status = 'used' THEN 'active' ELSE status END WHERE code = ?").run(nextExpiresAt, cleanCode);
    return { success: true, invite: getInviteCode(cleanCode) };
}

function createSession(userId, meta = {}) {
    const user = getUserById(userId);
    if (!user) throw new Error('User not found');
    const now = Date.now();
    const sessionId = generateSecureId('sess');
    const tokenId = generateSecureId('tok');
    const expiresAt = now + SESSION_DEFAULT_TTL_MS;
    db.prepare(`
        INSERT INTO user_sessions (id, user_id, token_id, user_agent, ip, created_at, last_seen_at, expires_at, revoked_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active')
    `).run(
        sessionId,
        userId,
        tokenId,
        String(meta.userAgent || '').slice(0, 500),
        String(meta.ip || '').slice(0, 120),
        now,
        now,
        expiresAt
    );
    recordAuthEvent({ userId, username: user.username, type: 'session_created', ip: meta.ip, userAgent: meta.userAgent, detail: sessionId });
    return { sessionId, tokenId, expiresAt };
}

function verifySession(userId, sessionId, tokenId) {
    const cleanUserId = normalizeUserId(userId);
    const cleanSessionId = String(sessionId || '').trim();
    const cleanTokenId = String(tokenId || '').trim();
    if (!cleanUserId || !cleanSessionId || !cleanTokenId) return false;
    const row = db.prepare(`
        SELECT id, expires_at, revoked_at, status
        FROM user_sessions
        WHERE id = ? AND user_id = ? AND token_id = ?
    `).get(cleanSessionId, cleanUserId, cleanTokenId);
    if (!row) return false;
    if (row.status !== 'active' || Number(row.revoked_at || 0) > 0 || Number(row.expires_at || 0) <= Date.now()) return false;
    try {
        db.prepare('UPDATE user_sessions SET last_seen_at = ? WHERE id = ?').run(Date.now(), cleanSessionId);
    } catch (e) { }
    return true;
}

function revokeSession(userId, sessionId) {
    const cleanUserId = normalizeUserId(userId);
    const cleanSessionId = String(sessionId || '').trim();
    if (!cleanUserId || !cleanSessionId) return 0;
    return db.prepare(`
        UPDATE user_sessions
        SET status = 'revoked', revoked_at = ?
        WHERE id = ? AND user_id = ? AND status = 'active'
    `).run(Date.now(), cleanSessionId, cleanUserId).changes || 0;
}

function revokeUserSessions(userId) {
    const cleanUserId = normalizeUserId(userId);
    if (!cleanUserId) return 0;
    return db.prepare(`
        UPDATE user_sessions
        SET status = 'revoked', revoked_at = ?
        WHERE user_id = ? AND status = 'active'
    `).run(Date.now(), cleanUserId).changes || 0;
}

function getUserSessions(userId) {
    const cleanUserId = normalizeUserId(userId);
    if (!cleanUserId) return [];
    const now = Date.now();
    return db.prepare(`
        SELECT id, user_agent, ip, created_at, last_seen_at, expires_at, revoked_at, status
        FROM user_sessions
        WHERE user_id = ?
        ORDER BY last_seen_at DESC, created_at DESC
    `).all(cleanUserId).map(row => ({
        ...row,
        active: row.status === 'active' && Number(row.revoked_at || 0) === 0 && Number(row.expires_at || 0) > now
    }));
}

function getLatestAnnouncement() {
    return db.prepare('SELECT content, created_at FROM announcements ORDER BY created_at DESC LIMIT 1').get();
}

function setAnnouncement(content) {
    db.prepare('INSERT INTO announcements (content, created_at) VALUES (?, ?)').run(content, Date.now());
}

module.exports = {
    initAuthDb,
    createUser,
    verifyUser,
    updateOwnAccount,
    getUserById,
    generateInviteCode,
    renewInviteCode,
    getInviteCodes,
    getInviteCode,
    getAllUsers,
    updateLastActive,
    deleteUser,
    setUserStatus,
    setUserRole,
    bumpTokenVersion,
    resetPassword,
    createSession,
    verifySession,
    revokeSession,
    revokeUserSessions,
    getUserSessions,
    recordAuthEvent,
    deleteInviteCode,
    updateInviteCode,
    getLatestAnnouncement,
    setAnnouncement,
    isAdminRole
};
