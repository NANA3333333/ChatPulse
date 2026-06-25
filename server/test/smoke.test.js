const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(...segments) {
    return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

function readPixelWorldSources() {
    const pixelWorldDir = path.join(repoRoot, 'client', 'src', 'plugins', 'pixelWorld');
    return walkFiles(pixelWorldDir, (filePath) => (
        filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.css')
    ))
        .sort()
        .map((filePath) => fs.readFileSync(filePath, 'utf8'))
        .join('\n');
}

function walkFiles(dir, predicate, shouldSkipDir = () => false, results = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!shouldSkipDir(fullPath)) {
                walkFiles(fullPath, predicate, shouldSkipDir, results);
            }
            continue;
        }
        if (predicate(fullPath)) results.push(fullPath);
    }
    return results;
}

test('system backup export is protected by normal auth middleware', () => {
    const backupPlugin = readRepoFile('server', 'plugins', 'backup', 'index.js');

    assert.match(
        backupPlugin,
        /app\.get\(\s*['"]\/api\/system\/export['"]\s*,\s*authMiddleware\s*,/,
        'export route must use the shared auth middleware'
    );
    assert.doesNotMatch(
        backupPlugin,
        /req\.query\.token|jwt\.verify\(|JWT_SECRET/,
        'export route must not accept or verify URL query tokens directly'
    );
});

test('settings backup download does not put auth tokens in URLs', () => {
    const settingsPanel = readRepoFile('client', 'src', 'components', 'SettingsPanel.jsx');

    assert.doesNotMatch(settingsPanel, /system\/export\?token=/, 'backup URL must not include token query params');
    assert.match(settingsPanel, /fetch\(`\$\{apiUrl\}\/system\/export`/, 'backup export should be downloaded with fetch');
    assert.match(settingsPanel, /Authorization['"]?\s*:\s*`Bearer \$\{localStorage\.getItem\('cp_token'\) \|\| ''\}`/, 'backup fetch must send the cp_token authorization header');
});

test('settings theme guide download sends auth headers', () => {
    const settingsPanel = readRepoFile('client', 'src', 'components', 'SettingsPanel.jsx');

    assert.doesNotMatch(settingsPanel, /href=\{`\$\{apiUrl\}\/theme-guide`\}/, 'theme guide download must not use an unauthenticated anchor href');
    assert.match(settingsPanel, /fetch\(`\$\{apiUrl\}\/theme-guide`,\s*\{[\s\S]*Authorization['"]?\s*:\s*`Bearer \$\{localStorage\.getItem\('cp_token'\) \|\| ''\}`/, 'theme guide fetch must send the cp_token authorization header');
    assert.match(settingsPanel, /downloadAnchorNode\.download = 'chatpulse-theme-prompt\.txt'/, 'theme guide download filename should stay stable');
});

test('social and drawer panels send auth to protected APIs', () => {
    const addCharacterModal = readRepoFile('client', 'src', 'components', 'AddCharacterModal.jsx');
    const createGroupModal = readRepoFile('client', 'src', 'components', 'CreateGroupModal.jsx');
    const momentsFeed = readRepoFile('client', 'src', 'components', 'MomentsFeed.jsx');
    const diaryTable = readRepoFile('client', 'src', 'components', 'DiaryTable.jsx');
    const recommendModal = readRepoFile('client', 'src', 'components', 'RecommendModal.jsx');
    const chatSettingsDrawer = readRepoFile('client', 'src', 'components', 'ChatSettingsDrawer.jsx');

    assert.match(addCharacterModal, /fetch\(`\$\{apiUrl\}\/characters`,\s*\{[\s\S]*headers: authJsonHeaders/, 'character creation should send auth and JSON headers');
    assert.match(addCharacterModal, /fetch\(`\$\{apiUrl\}\/characters\/generate`,\s*\{[\s\S]*headers: authJsonHeaders/, 'character generation should send auth and JSON headers');
    assert.match(addCharacterModal, /fetch\(`\$\{apiUrl\}\/models`,\s*\{[\s\S]*headers: authJsonHeaders/, 'add-character model lookup should send auth and JSON headers');
    assert.match(createGroupModal, /fetch\(`\$\{apiUrl\}\/groups`,\s*\{[\s\S]*headers: authJsonHeaders/, 'group creation should send auth and JSON headers');

    assert.match(momentsFeed, /fetch\(`\$\{apiUrl\}\/characters`, \{ headers: authOnlyHeaders \}\)/, 'moments character preload should send auth');
    assert.match(momentsFeed, /fetch\(`\$\{apiUrl\}\/moments`, \{ headers: authOnlyHeaders \}\)/, 'moments list should send auth');
    assert.match(momentsFeed, /fetch\(`\$\{apiUrl\}\/moments`,\s*\{[\s\S]*headers: authJsonHeaders/, 'moment creation should send auth and JSON headers');
    assert.match(momentsFeed, /fetch\(`\$\{apiUrl\}\/moments\/\$\{id\}\/like`,\s*\{[\s\S]*headers: authJsonHeaders/, 'moment likes should send auth and JSON headers');
    assert.match(momentsFeed, /fetch\(`\$\{apiUrl\}\/moments\/\$\{momentId\}\/comment`,\s*\{[\s\S]*headers: authJsonHeaders/, 'moment comments should send auth and JSON headers');
    assert.doesNotMatch(momentsFeed, /fetch\(`\$\{apiUrl\}\/moments`\)/, 'moments should not use naked protected fetch calls');

    assert.match(diaryTable, /fetch\(`\$\{apiUrl\}\/diaries\/\$\{contactId\}`,\s*\{\s*headers:\s*authOnlyHeaders,\s*signal:\s*controller\.signal\s*\}\)/, 'diary reads should send auth and allow cancellation');
    assert.match(diaryTable, /fetch\(`\$\{apiUrl\}\/diaries\/\$\{contactId\}\/unlock`,\s*\{[\s\S]*headers: authJsonHeaders/, 'diary unlock should send auth and JSON headers');
    assert.match(recommendModal, /fetch\(`\$\{apiUrl\}\/characters\/\$\{currentContact\.id\}\/friends`, \{ headers: authOnlyHeaders \}\)/, 'recommend modal friend list should send auth');

    assert.match(chatSettingsDrawer, /fetch\(`\$\{apiUrl\}\/characters\/\$\{contact\.id\}\/relationships`, \{ headers: authOnlyHeaders \}\)/, 'relationship drawer reads should send auth');
    assert.match(chatSettingsDrawer, /fetch\(`\$\{apiUrl\}\/city\/schedules\/\$\{contact\.id\}`, \{ headers: authOnlyHeaders \}\)/, 'schedule drawer reads should send auth');
    assert.match(chatSettingsDrawer, /fetch\(`\$\{apiUrl\}\/characters\/\$\{contact\.id\}\/impressions\/\$\{targetId\}\?limit=10`, \{ headers: authOnlyHeaders \}\)/, 'impression history reads should send auth');
});

test('backup zip import validates entry paths before extraction', () => {
    const backupPlugin = readRepoFile('server', 'plugins', 'backup', 'index.js');

    assert.doesNotMatch(
        backupPlugin,
        /unzipper\.Extract\(/,
        'backup imports must not blindly extract zip archives'
    );
    assert.match(backupPlugin, /function resolveSafeZipEntryPath/, 'backup imports should validate each zip entry path');
    assert.match(backupPlugin, /path\.posix\.normalize\(rawPath\)/, 'zip path validation should normalize archive paths');
    assert.match(backupPlugin, /normalizedPath\.startsWith\('\.\.\/'\)/, 'zip path validation should reject traversal entries');
    assert.match(backupPlugin, /unzipper\.Open\.file\(zipPath\)/, 'backup imports should inspect entries before writing them');
    assert.match(backupPlugin, /let uploadedPath = req\.file\?\.path \|\| '';\s*let extractedDir = null;\s*let importCompleted = false;/, 'backup import should track temp paths outside the success-only branch');
    assert.match(backupPlugin, /catch \(e\) \{[\s\S]*if \(!importCompleted\) cleanupTemp\(uploadedPath, extractedDir\)/, 'backup import failures should clean uploaded temp files and extracted directories');
});

test('upload references used by backup and admin stats stay inside uploads', () => {
    const backupPlugin = readRepoFile('server', 'plugins', 'backup', 'index.js');
    const files = [
        backupPlugin,
        readRepoFile('server', 'plugins', 'adminDashboard', 'index.js')
    ];

    for (const source of files) {
        assert.match(source, /path\.posix\.normalize\(rel\)/, 'upload reference paths should be normalized as POSIX relative paths');
        assert.match(source, /rel\.includes\('\\0'\)/, 'upload reference paths should reject null bytes');
        assert.match(source, /normalizedPath\.startsWith\('\.\.\/'\)/, 'upload reference paths should reject traversal');
        assert.match(source, /normalizedPath\.startsWith\('uploads\/'\)/, 'upload references should be constrained to the uploads prefix');
        assert.match(source, /(?:function|const)\s+resolveUploadReferencePath/, 'file access should re-resolve upload references before use');
        assert.match(source, /path\.resolve\(/, 'upload reference file access should use resolved absolute paths');
        assert.match(source, /const marker = '\/api\/media\/uploads\/'/, 'authenticated media URLs should be recognized as upload references');
        assert.match(source, /path\.join\('uploads', 'users', String\(userId \|\| 'default'\), filename\)/, 'authenticated media URLs should resolve to the current user upload directory');
        assert.match(source, /filename\.includes\('\/'\) \|\| filename\.includes\('\\\\'\)/, 'authenticated media filenames should reject encoded path separators');
    }
    assert.match(backupPlugin, /function restoreBackupUploadsForUser\(extractedUploads, targetUserId\)/, 'backup import should restore uploaded media through a user-aware helper');
    assert.match(backupPlugin, /function restoreScopedUserUploads\(extractedUsersDir, targetUserId\)[\s\S]*path\.join\(uploadsDir, 'users', String\(targetUserId \|\| 'default'\)\)/, 'backup import should remap scoped user uploads onto the importing user');
    assert.match(backupPlugin, /function removeScopedUserUploads\(userId\)[\s\S]*path\.join\(uploadsDir, 'users', String\(userId \|\| 'default'\)\)[\s\S]*removeDirectoryIfExists\(userUploadDir\)/, 'backup imports should clear stale user-scoped uploads before restoring replacement data');
    assert.match(backupPlugin, /removeScopedUserUploads\(userId\);\s*if \(isZip && extractedDir\)/, 'backup imports should clear scoped upload residue even when importing a raw DB without media');
});

test('system wipe clears user-scoped residual files and live DB handles', () => {
    const backupPlugin = readRepoFile('server', 'plugins', 'backup', 'index.js');
    const wipeStart = backupPlugin.indexOf("app.delete('/api/system/wipe'");
    const importStart = backupPlugin.indexOf("app.post('/api/system/import'", wipeStart);
    assert.notEqual(wipeStart, -1, 'system wipe route should exist');
    assert.notEqual(importStart, -1, 'system import route should follow wipe route');
    const wipeRoute = backupPlugin.slice(wipeStart, importStart);

    assert.match(wipeRoute, /closeSchedulerDb\(userId\)/, 'system wipe should close scheduler DB handles before deleting the user DB');
    assert.match(wipeRoute, /oldEngine[\s\S]*stopAllTimers\(\)/, 'system wipe should stop engine timers before deleting the user DB');
    assert.match(wipeRoute, /removeFileIfExists\(dbPath\)[\s\S]*removeFileIfExists\(`\$\{dbPath\}-wal`\)[\s\S]*removeFileIfExists\(`\$\{dbPath\}-shm`\)/, 'system wipe should remove SQLite sidecar files');
    assert.match(wipeRoute, /removeDirectoryIfExists\(path\.join\(uploadsDir, 'users', String\(userId\)\)\)/, 'system wipe should remove scoped uploaded media');
    assert.match(wipeRoute, /removeDirectoryIfExists\(path\.join\(__dirname, '\.\.', '\.\.', 'data', 'tts', String\(userId\)\)\)/, 'system wipe should remove scoped TTS audio');
    assert.match(backupPlugin, /function cleanupTemp\(filePath, dirPath\)[\s\S]*removeFileIfExists\(filePath\)[\s\S]*removeDirectoryIfExists\(dirPath\)/, 'backup temp cleanup should use the shared safe file helpers');
});

test('general upload endpoint only stores verified image files', () => {
    const serverIndex = readRepoFile('server', 'index.js');

    assert.match(serverIndex, /const allowedImageMimeTypes = new Set\(\[/, 'upload endpoint should enumerate allowed image MIME types');
    assert.match(serverIndex, /const allowedImageExtensions = new Set\(\[/, 'upload endpoint should enumerate allowed image extensions');
    assert.match(serverIndex, /function isValidImageUploadContent\(file\)/, 'upload endpoint should verify saved image content');
    assert.match(serverIndex, /upload\.single\('image'\)/, 'upload endpoint should accept one image field only');
    assert.match(serverIndex, /cleanupUploadedFile\(file\)/, 'invalid uploads should be deleted after content validation');
    assert.doesNotMatch(serverIndex, /file\.originalname\.endsWith\('\.db'\)/, 'general image upload must not accept database files');
    assert.doesNotMatch(serverIndex, /Only images and \.db backups are allowed/, 'general image upload copy must not advertise DB backup upload support');
});

test('tts audio downloads are constrained to the current user audio directory', () => {
    const serverIndex = readRepoFile('server', 'index.js');

    assert.match(serverIndex, /const ttsAudioRoot = path\.resolve\(__dirname, '\.\.', 'data', 'tts'\)/, 'TTS audio root should be explicit');
    assert.match(serverIndex, /function resolveTtsAudioPath\(userId, audioPath\)/, 'TTS audio route should resolve stored paths through a boundary helper');
    assert.match(serverIndex, /path\.resolve\(ttsAudioRoot, String\(userId \|\| 'default'\)\)/, 'TTS audio route should scope files to the current user');
    assert.match(serverIndex, /resolvedPath\.startsWith\(userAudioRoot \+ path\.sep\)/, 'TTS audio route should reject paths outside the user audio directory');
    assert.match(serverIndex, /const audioPath = resolveTtsAudioPath\(req\.user\.id, row\.audio_path\)/, 'TTS audio route should validate the DB path before use');
    assert.match(serverIndex, /res\.sendFile\(audioPath\)/, 'TTS audio route should send only the resolved bounded path');
    assert.doesNotMatch(serverIndex, /res\.sendFile\(path\.resolve\(row\.audio_path\)\)/, 'TTS audio route must not send arbitrary DB paths');
    assert.match(serverIndex, /function sanitizeTtsMimeType\(value\)/, 'TTS audio route should sanitize DB-provided MIME types');
    assert.match(serverIndex, /app\.post\('\/api\/tts\/preview\/:characterId'[\s\S]*res\.status\(e\.statusCode === 400 \? 400 : 500\)\.json\(\{ error: e\.message \}\)/, 'TTS preview should report invalid configured endpoints as 400-level input errors');
});

test('character and memory export filenames never reuse raw character ids', () => {
    const serverIndex = readRepoFile('server', 'index.js');

    assert.match(serverIndex, /function sanitizeDownloadName\(value, fallback = 'character'\)/, 'download filenames should use a shared sanitizer');
    assert.match(serverIndex, /const clean = \(input\) => String\(input \|\| ''\)/, 'download filename fallback values should also be sanitized');
    assert.match(serverIndex, /const filenameId = sanitizeDownloadName\(req\.params\.characterId, 'character'\)/, 'character archive export should sanitize character ids');
    assert.match(serverIndex, /filename="\$\{filenameBase\}_\$\{filenameId\}_character_export\.json"/, 'character archive filename should use the sanitized id');
    assert.match(serverIndex, /const filenameId = sanitizeDownloadName\(characterId, 'character'\)/, 'memory export should sanitize character ids');
    assert.match(serverIndex, /filename="\$\{filenameBase\}_\$\{filenameId\}_memories_export\.json"/, 'memory export filename should use the sanitized id');
    assert.doesNotMatch(serverIndex, /filename="\$\{filenameBase\}_\$\{req\.params\.characterId\}_character_export\.json"/, 'character archive filename must not include raw route params');
    assert.doesNotMatch(serverIndex, /filename="\$\{filenameBase\}_\$\{characterId\}_memories_export\.json"/, 'memory export filename must not include raw route params');
});

test('models proxy requires auth and does not put provider keys in URLs', async () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const llmSource = readRepoFile('server', 'llm.js');
    const ttsSource = readRepoFile('server', 'tts.js');
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const httpGuardsSource = readRepoFile('server', 'httpGuards.js');
    const httpGuards = require(path.join(repoRoot, 'server', 'httpGuards.js'));
    const clientSrc = path.join(repoRoot, 'client', 'src');
    const offenders = [];

    assert.match(
        serverIndex,
        /app\.post\(\s*['"]\/api\/models['"]\s*,\s*authMiddleware\s*,/,
        'models proxy POST route must use shared auth middleware'
    );
    assert.match(
        serverIndex,
        /app\.get\(\s*['"]\/api\/models['"]\s*,\s*authMiddleware\s*,/,
        'legacy models proxy GET route must also require auth'
    );

    for (const filePath of walkFiles(clientSrc, (candidate) => /\.(js|jsx)$/.test(candidate))) {
        const text = fs.readFileSync(filePath, 'utf8');
        if (/\/models\?endpoint=.*key=|\/models\?endpoint=\$\{/.test(text)) {
            offenders.push(path.relative(repoRoot, filePath));
        }
    }

    assert.deepEqual(offenders, [], 'provider API keys must not be sent through /api/models query strings');
    assert.match(httpGuardsSource, /function normalizeServerFetchUrl\(value, label = 'URL', options = \{\}\)/, 'server-side fetch URL validation should be centralized');
    assert.match(httpGuardsSource, /async function normalizeServerFetchUrlResolved\(value, label = 'URL', options = \{\}\)/, 'server-side fetch URL validation should verify resolved DNS addresses before keyed requests');
    assert.match(httpGuardsSource, /dns\.lookup\(hostname, \{ all: true, verbatim: false \}\)/, 'public-mode endpoint guards should inspect resolved addresses to catch DNS-to-private SSRF bypasses');
    assert.match(httpGuardsSource, /isBlockedPrivateNetworkHost\(parsed\.hostname\)/, 'server-side fetch URL validation should reject local and private hosts when public');
    assert.match(serverIndex, /await buildOpenAiCompatibleUrlResolved\(endpoint, 'models', \{ label: 'Endpoint' \}\)/, 'models proxy should normalize and boundary-check provider endpoints');
    assert.match(serverIndex, /redirect: 'manual'/, 'models proxy should not auto-follow redirects with provider keys');
    assert.match(llmSource, /await buildOpenAiCompatibleUrlResolved\(endpoint, 'chat\/completions', \{ label: 'LLM endpoint' \}\)/, 'LLM calls should normalize and boundary-check configured endpoints');
    assert.match(llmSource, /redirect: 'manual'/, 'LLM calls should not auto-follow redirects with provider keys');
    assert.match(llmSource, /function redactEndpointForMessage\(endpoint\)[\s\S]*parsed\.username = '';[\s\S]*parsed\.password = '';[\s\S]*parsed\.search = '';/, 'LLM errors should redact endpoint credentials and query strings');
    assert.match(llmSource, /const safeEndpoint = redactEndpointForMessage\(endpoint\)[\s\S]*LLM Error[\s\S]*safeEndpoint[\s\S]*API Endpoint \[\$\{safeEndpoint\}\]/, 'LLM error logs and user-facing messages should use the redacted endpoint');
    assert.match(cityIndex, /await buildOpenAiCompatibleUrlResolved\(apiEndpoint, 'models', \{ label: 'Endpoint' \}\)/, 'city behavior model listing should share server-side endpoint guards');
    assert.match(ttsSource, /await normalizeServerFetchUrlResolved\(character\.tts_endpoint \|\| 'https:\/\/api\.openai\.com\/v1\/audio\/speech', 'TTS endpoint'\)/, 'OpenAI-compatible TTS should validate configured endpoints');
    assert.match(ttsSource, /await normalizeServerFetchUrlResolved\(character\.tts_endpoint \|\| '', 'TTS endpoint'\)/, 'custom TTS should validate configured endpoints');
    assert.throws(
        () => httpGuards.normalizeServerFetchUrl('http://127.0.0.1:11434/v1', 'Endpoint', { allowPrivateHosts: false }),
        /Endpoint host is not allowed in public mode/,
        'public-mode endpoint guards should reject loopback targets'
    );
    assert.equal(
        httpGuards.buildOpenAiCompatibleUrl('https://api.example.com/v1/chat/completions?x=1', 'models', { allowPrivateHosts: false }),
        'https://api.example.com/v1/models',
        'OpenAI-compatible endpoint helper should strip query strings and preserve the API base path'
    );

    const dns = require('dns').promises;
    const originalLookup = dns.lookup;
    dns.lookup = async () => [{ address: '10.0.0.2', family: 4 }];
    try {
        await assert.rejects(
            () => httpGuards.normalizeServerFetchUrlResolved('https://provider.example/v1', 'Endpoint', { allowPrivateHosts: false }),
            /Endpoint resolves to a private network address in public mode/,
            'public-mode endpoint guards should reject hostnames that resolve to private addresses'
        );
    } finally {
        dns.lookup = originalLookup;
    }
});

test('websocket auth does not put JWTs in URLs and checks account state', () => {
    const app = readRepoFile('client', 'src', 'App.jsx');
    const serverIndex = readRepoFile('server', 'index.js');

    assert.doesNotMatch(app, /new WebSocket\(`\$\{WS_URL\}\/\?token=\$\{token\}`\)/, 'frontend websocket must not put JWTs in the URL');
    assert.match(app, /new WebSocket\(WS_URL\)/, 'frontend websocket should connect without query-string credentials');
    assert.match(serverIndex, /function verifyAuthToken\(token\)/, 'HTTP and WS auth should share token verification');
    assert.match(serverIndex, /verifyAuthToken\(data\.token\)/, 'websocket auth message should use shared token verification');
    assert.match(serverIndex, /authDb\.getUserById\(decoded\.id\)/, 'shared auth must check that the user still exists');
    assert.match(serverIndex, /authUser\.status === 'banned'/, 'shared auth must reject banned users');
    assert.match(serverIndex, /decoded\.tokenVersion[\s\S]*authUser\.token_version/, 'shared auth must reject stale tokens after password or account changes');
});

test('admin user mutations cannot target the protected root account', () => {
    const adminDashboard = readRepoFile('server', 'plugins', 'adminDashboard', 'index.js');

    assert.match(adminDashboard, /const getMutableAdminTarget = \(req, res\) => \{/, 'admin dashboard should centralize target-user validation');
    assert.match(adminDashboard, /targetUser\.role === 'root'[\s\S]*Root account is protected/, 'root account should be protected from admin mutations');

    const protectedRoutes = [
        "app.delete('/api/admin/users/:id'",
        "app.post('/api/admin/users/:id/ban'",
        "app.post('/api/admin/users/:id/role'",
        "app.post('/api/admin/users/:id/reset-password'",
        "app.post('/api/admin/users/:id/force-logout'"
    ];

    for (const route of protectedRoutes) {
        const routeIndex = adminDashboard.indexOf(route);
        assert.notEqual(routeIndex, -1, `${route} should exist`);
        const routeBlock = adminDashboard.slice(routeIndex, routeIndex + 900);
        assert.match(routeBlock, /getMutableAdminTarget\(req, res\)/, `${route} must reject root targets before mutating users`);
    }
});

test('admin user mutations report missing targets instead of fake success', () => {
    const authDb = readRepoFile('server', 'authDb.js');
    const adminDashboard = readRepoFile('server', 'plugins', 'adminDashboard', 'index.js');

    assert.match(authDb, /const USER_STATUSES = new Set\(\['active', 'banned'\]\)/, 'auth db user status writes should be constrained to known statuses');
    assert.match(authDb, /const MUTABLE_USER_ROLES = new Set\(\['user', 'admin'\]\)/, 'auth db role writes should not expose root role mutation');
    assert.match(authDb, /function normalizeUserId\(id\)[\s\S]*return String\(id \|\| ''\)\.trim\(\)/, 'auth db user mutations should normalize user ids');
    assert.match(authDb, /function deleteUser\(id\)[\s\S]*DELETE FROM users WHERE id = \?[\s\S]*changes \|\| 0/, 'user deletes should return actual row changes');
    assert.match(authDb, /function setUserStatus\(id, status\)[\s\S]*USER_STATUSES\.has\(nextStatus\)[\s\S]*UPDATE users SET status = \? WHERE id = \?[\s\S]*changes \|\| 0/, 'user status updates should return actual row changes');
    assert.match(authDb, /function setUserRole\(id, role\)[\s\S]*MUTABLE_USER_ROLES\.has\(nextRole\)[\s\S]*UPDATE users SET role = \? WHERE id = \?[\s\S]*changes \|\| 0/, 'user role updates should return actual row changes');
    assert.match(authDb, /function bumpTokenVersion\(id\)[\s\S]*UPDATE users SET token_version = COALESCE\(token_version, 0\) \+ 1 WHERE id = \?[\s\S]*changes \|\| 0/, 'force logout token bumps should return actual row changes');
    assert.match(authDb, /function resetPassword\(id, newPassword\)[\s\S]*UPDATE users SET password_hash = \?, token_version = COALESCE\(token_version, 0\) \+ 1, password_updated_at = \? WHERE id = \?[\s\S]*changes \|\| 0/, 'password resets should return actual row changes');

    assert.match(adminDashboard, /const sendAdminUserMutationNotFound = \(res\) => \{[\s\S]*res\.status\(404\)\.json\(\{ error: 'User not found' \}\)/, 'admin user mutation routes should share a missing-target response');
    assert.match(adminDashboard, /const deleted = authDb\.deleteUser\(targetId\)[\s\S]*if \(!deleted\)[\s\S]*sendAdminUserMutationNotFound\(res\)/, 'admin user delete should not proceed to storage cleanup when the user row was not deleted');
    assert.match(adminDashboard, /const updated = authDb\.setUserStatus\(targetId, status\)[\s\S]*const tokenUpdated = updated \? authDb\.bumpTokenVersion\(targetId\) : 0[\s\S]*if \(!updated \|\| !tokenUpdated\) return sendAdminUserMutationNotFound\(res\)/, 'admin ban route should not fake success if status or token update fails');
    assert.match(adminDashboard, /const updated = authDb\.setUserRole\(targetId, nextRole\)[\s\S]*const tokenUpdated = updated \? authDb\.bumpTokenVersion\(targetId\) : 0[\s\S]*if \(!updated \|\| !tokenUpdated\) return sendAdminUserMutationNotFound\(res\)/, 'admin role route should not fake success if role or token update fails');
    assert.match(adminDashboard, /const updated = authDb\.resetPassword\(targetId, newPassword\)[\s\S]*if \(!updated\) return sendAdminUserMutationNotFound\(res\)/, 'admin password reset should not fake success if the DB row was not changed');
    assert.match(adminDashboard, /const updated = authDb\.bumpTokenVersion\(targetId\)[\s\S]*if \(!updated\) return sendAdminUserMutationNotFound\(res\)/, 'admin force logout should not fake success if the token version was not changed');
    assert.match(adminDashboard, /path\.join\(__dirname, '\.\.', '\.\.', 'public', 'uploads', 'users', String\(userId\)\)[\s\S]*removeDirectoryIfExists\(userUploadDir\)/, 'admin user delete should remove scoped uploaded media for the deleted account');
    assert.match(adminDashboard, /path\.join\(__dirname, '\.\.', '\.\.', 'data', 'tts', String\(userId\)\)[\s\S]*removeDirectoryIfExists\(userTtsDir\)/, 'admin user delete should remove scoped TTS audio for the deleted account');

    assert.doesNotMatch(adminDashboard, /authDb\.deleteUser\(targetId\);\s*try \{[\s\S]*cleanupUserStorage\(targetId\)/, 'admin user delete must not ignore the DB delete result before cleaning storage');
    assert.doesNotMatch(adminDashboard, /authDb\.setUserStatus\(targetId, banned \? 'banned' : 'active'\);\s*authDb\.bumpTokenVersion\(targetId\)/, 'admin ban route must not ignore DB write results');
    assert.doesNotMatch(adminDashboard, /authDb\.setUserRole\(targetId, nextRole\);\s*authDb\.bumpTokenVersion\(targetId\)/, 'admin role route must not ignore DB write results');
});

test('admin storage stats include current and legacy vector index directories', () => {
    const adminDashboard = readRepoFile('server', 'plugins', 'adminDashboard', 'index.js');

    assert.match(adminDashboard, /const getUserVectorStorageSize = \(userId\) => \{/, 'admin storage stats should centralize vector directory sizing');
    assert.match(adminDashboard, /candidateDirs\.add\(path\.join\(vectorsRoot, String\(userId\)\)\)/, 'admin storage stats should count legacy vector directories');
    assert.match(adminDashboard, /candidateDirs\.add\(path\.join\(vectorsRoot, entry\.name, String\(userId\)\)\)/, 'admin storage stats should count tagged vector index directories');
    assert.match(adminDashboard, /stats\.vector_size_bytes = getUserVectorStorageSize\(user\.id\)/, 'admin storage stats should use the vector directory helper');
    assert.doesNotMatch(adminDashboard, /const vectorDir = path\.join\(__dirname, '\.\.', '\.\.', 'data', 'vectors', String\(user\.id\)\)/, 'admin storage stats must not only inspect the legacy vector path');
});

test('admin invite creation is a POST-only state change', () => {
    const adminDashboard = readRepoFile('server', 'plugins', 'adminDashboard', 'index.js');
    const adminClient = readRepoFile('client', 'src', 'components', 'AdminDashboard.jsx');

    assert.match(
        adminDashboard,
        /app\.post\(\s*['"]\/api\/admin\/invites['"]\s*,\s*authMiddleware\s*,\s*adminMiddleware\s*,/,
        'invite creation must use POST'
    );
    assert.doesNotMatch(
        adminDashboard,
        /app\.get\(\s*['"]\/api\/admin\/invites['"]/,
        'invite creation must not be exposed as a state-changing GET route'
    );
    assert.match(
        adminClient,
        /fetch\(`\$\{cleanApiUrl\}\/api\/admin\/invites`,\s*\{\s*method: 'POST'/,
        'admin UI should create invite codes with POST'
    );
});

test('admin invite numeric fields reject invalid values before auth db writes', () => {
    const authDb = readRepoFile('server', 'authDb.js');
    const adminDashboard = readRepoFile('server', 'plugins', 'adminDashboard', 'index.js');

    assert.match(authDb, /const MAX_INVITE_USES = 100000/, 'invite use counts should have a bounded maximum');
    assert.match(authDb, /class AuthValidationError extends Error/, 'auth db validation errors should be typed as bad requests');
    assert.match(authDb, /function normalizeInviteMaxUses\(value, fallback = 1\)/, 'invite max uses should be normalized centrally');
    assert.match(authDb, /!Number\.isSafeInteger\(parsed\) \|\| parsed < 1 \|\| parsed > MAX_INVITE_USES/, 'invite max uses should reject NaN, Infinity, zero, negative, and overlarge values');
    assert.match(authDb, /function normalizeInviteExpiresAt\(value, fallback = 0\)/, 'invite expiry timestamps should be normalized centrally');
    assert.match(authDb, /!Number\.isSafeInteger\(parsed\) \|\| parsed < 0/, 'invite expiry should reject NaN, Infinity, negative, and unsafe timestamps');
    assert.match(authDb, /const INVITE_STATUSES = new Set\(\['active', 'used', 'revoked'\]\)/, 'invite status updates should be constrained to known states');
    assert.match(authDb, /const maxUses = normalizeInviteMaxUses\(options\.maxUses\)/, 'invite creation should write normalized max uses');
    assert.match(authDb, /values\.push\(normalizeInviteMaxUses\(data\.maxUses\)\)/, 'invite updates should write normalized max uses');
    assert.doesNotMatch(authDb, /Math\.max\(1, Number\((options|data)\.maxUses \|\| 1\)\)/, 'invite writes must not persist raw or non-finite max use values');
    assert.doesNotMatch(authDb, /Math\.max\(0, Number\((options|data)\.expiresAt \|\| 0\)\)/, 'invite writes must not persist raw or non-finite expiry values');

    assert.match(adminDashboard, /res\.status\(e\.statusCode === 400 \? 400 : 500\)\.json\(\{ error: e\.message \}\)/, 'admin invite routes should return validation failures as 400');
});

test('admin invite update and delete report missing codes instead of fake success', () => {
    const authDb = readRepoFile('server', 'authDb.js');
    const adminDashboard = readRepoFile('server', 'plugins', 'adminDashboard', 'index.js');

    assert.match(authDb, /function getInviteCode\(code\)[\s\S]*WHERE code = \?/, 'auth db should expose a single invite lookup by code');
    assert.match(authDb, /function deleteInviteCode\(code\)[\s\S]*const cleanCode = cleanInviteCode\(code\)[\s\S]*DELETE FROM invite_codes WHERE code = \?[\s\S]*changes \|\| 0/, 'invite deletes should return actual row changes');
    assert.match(authDb, /function updateInviteCode\(code, data = \{\}\)[\s\S]*const cleanCode = cleanInviteCode\(code\)[\s\S]*if \(!fields\.length\) return getInviteCode\(cleanCode\) \? 1 : 0[\s\S]*UPDATE invite_codes SET/, 'invite updates should validate code existence even for no-op updates');
    assert.match(authDb, /return db\.prepare\(`UPDATE invite_codes SET \$\{fields\.join\(', '\)\} WHERE code = \?`\)\.run\(\.\.\.values\)\.changes \|\| 0/, 'invite updates should return actual row changes');

    assert.match(adminDashboard, /const deleted = authDb\.deleteInviteCode\(req\.params\.code\)[\s\S]*return res\.status\(404\)\.json\(\{ error: 'Invite code not found' \}\)/, 'invite delete route should return 404 for missing codes');
    assert.match(adminDashboard, /const updated = authDb\.updateInviteCode\(req\.params\.code,[\s\S]*if \(!updated\) return res\.status\(404\)\.json\(\{ error: 'Invite code not found' \}\)/, 'invite update route should return 404 for missing codes');
    assert.doesNotMatch(adminDashboard, /authDb\.deleteInviteCode\(req\.params\.code\);\s*res\.json\(\{ success: true \}\)/, 'invite delete route must not fake success');
    assert.doesNotMatch(adminDashboard, /(?<!const updated = )authDb\.updateInviteCode\(req\.params\.code,/, 'invite update route must not ignore the DB update result');
});

test('public multi-user auth uses invite expiry, revocable sessions, and lockout fields', () => {
    const authDb = readRepoFile('server', 'authDb.js');
    const serverIndex = readRepoFile('server', 'index.js');
    const adminDashboard = readRepoFile('server', 'plugins', 'adminDashboard', 'index.js');
    const authContext = readRepoFile('client', 'src', 'AuthContext.jsx');
    const app = readRepoFile('client', 'src', 'App.jsx');

    assert.match(authDb, /const INVITE_DEFAULT_TTL_MS = 30 \* 24 \* 60 \* 60 \* 1000/, 'invite default TTL should be 30 days');
    assert.match(authDb, /CREATE TABLE IF NOT EXISTS user_sessions/, 'auth DB should store revocable sessions');
    assert.match(authDb, /CREATE TABLE IF NOT EXISTS auth_events/, 'auth DB should record auth events');
    assert.match(authDb, /ALTER TABLE users ADD COLUMN username_norm TEXT DEFAULT ''/, 'users should store normalized usernames');
    assert.match(authDb, /ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0/, 'users should track failed login count');
    assert.match(authDb, /ALTER TABLE users ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0/, 'users should support temporary login locks');
    assert.match(authDb, /ALTER TABLE users ADD COLUMN password_updated_at INTEGER NOT NULL DEFAULT 0/, 'users should record password update time');
    assert.match(authDb, /const defaultExpiresAt = createdAt \+ INVITE_DEFAULT_TTL_MS[\s\S]*normalizeInviteExpiresAt\(options\.expiresAt, defaultExpiresAt\)/, 'invite creation should default to 30 days');
    assert.match(authDb, /function renewInviteCode\(code\)[\s\S]*use_count[\s\S]*>= [\s\S]*max_uses[\s\S]*reached its usage limit/, 'used-up invites should not renew');
    assert.match(authDb, /const base = Number\(invite\.expires_at \|\| 0\) > Date\.now\(\) \? Number\(invite\.expires_at \|\| 0\) : Date\.now\(\)/, 'invite renewals should extend from expiry when still valid and now when expired');
    assert.match(authDb, /const nextExpiresAt = base \+ INVITE_DEFAULT_TTL_MS/, 'invite renewals should add 30 days');
    assert.match(authDb, /function createSession\(userId, meta = \{\}\)/, 'auth DB should create sessions');
    assert.match(authDb, /function verifySession\(userId, sessionId, tokenId\)/, 'auth DB should verify sessions');
    assert.match(authDb, /function revokeUserSessions\(userId\)/, 'auth DB should support force-revoking sessions');
    assert.match(authDb, /const lockedUntil = failedCount >= MAX_FAILED_LOGINS \? now \+ LOGIN_LOCK_MS : 0/, 'login failures should lock after the configured threshold');

    assert.match(serverIndex, /const AUTH_TOKEN_TTL = String\(process\.env\.CP_AUTH_TOKEN_TTL \|\| '7d'\)/, 'JWT TTL should be configurable and default to 7d');
    assert.match(serverIndex, /function issueAuthToken\(user, req\)[\s\S]*authDb\.createSession\(user\.id, getRequestAuthMeta\(req\)\)[\s\S]*sessionId: session\.sessionId[\s\S]*jti: session\.tokenId/, 'JWTs should be bound to auth DB sessions');
    assert.match(serverIndex, /authDb\.verifySession\(authUser\.id, decoded\.sessionId, decoded\.jti\)/, 'shared auth should reject revoked or expired sessions');
    assert.match(serverIndex, /app\.post\('\/api\/auth\/logout', authMiddleware/, 'logout route should revoke the current session');
    assert.match(serverIndex, /app\.get\('\/api\/auth\/sessions', authMiddleware/, 'users should be able to list their sessions');
    assert.match(serverIndex, /app\.delete\('\/api\/auth\/sessions\/:id', authMiddleware/, 'users should be able to revoke their own sessions');
    assert.match(serverIndex, /authDb\.verifyUser\(username, password, getRequestAuthMeta\(req\)\)/, 'login should pass request metadata for auth events');
    assert.match(serverIndex, /authDb\.revokeUserSessions\(req\.user\.id\)[\s\S]*issueAuthToken\(result\.user, req\)/, 'account updates should revoke old sessions and issue a new one');
    assert.match(authContext, /function buildAuthUrl\(apiUrl, path\)/, 'frontend logout should build logout URLs from the configured API base');
    assert.match(authContext, /const logout = async \(apiUrl\)/, 'frontend logout should wait for session revoke before clearing local state');
    assert.match(authContext, /await fetch\(buildAuthUrl\(apiUrl, '\/auth\/logout'\),\s*\{[\s\S]*keepalive:\s*true/, 'frontend logout should use keepalive when revoking the session');
    assert.match(app, /onClick=\{\(\) => logout\(API_URL\)\}/, 'sidebar logout should pass the real API base to the auth provider');

    assert.match(adminDashboard, /app\.post\('\/api\/admin\/invites\/:code\/renew'/, 'admin dashboard should expose invite renewal');
    assert.match(adminDashboard, /authDb\.revokeUserSessions\(targetId\)[\s\S]*disconnectUserSessions\(targetId\)/, 'admin user mutations should revoke DB sessions as well as WS clients');
});

test('public mode CORS, rate limits, uploads, and queue stats are scoped for hosted use', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const backgroundQueue = readRepoFile('server', 'backgroundQueue.js');
    const avatarUtil = readRepoFile('client', 'src', 'utils', 'avatar.js');
    const authenticatedImage = readRepoFile('client', 'src', 'components', 'AuthenticatedImage.jsx');

    assert.match(serverIndex, /const PUBLIC_MODE = \/\^\(1\|true\|yes\|on\)\$\/i\.test/, 'public mode env flag should be parsed');
    assert.match(serverIndex, /const ALLOWED_ORIGINS = String\(process\.env\.CP_ALLOWED_ORIGINS \|\| ''\)/, 'allowed origins should come from env');
    assert.match(serverIndex, /if \(TRUST_PROXY\) \{\s*app\.set\('trust proxy', 1\);/, 'trust proxy should be enabled by env');
    assert.match(serverIndex, /app\.use\(cors\(\{[\s\S]*ALLOWED_ORIGINS\.includes\(origin\)/, 'CORS should use an allowlist in public mode');
    assert.match(serverIndex, /function isLocalRequest\(req\) \{\s*if \(PUBLIC_MODE\) return false;/, 'public mode should disable local rate-limit bypass');
    assert.match(serverIndex, /path\.join\(__dirname, 'public\/uploads\/users', String\(req\.user\?\.id \|\| 'default'\)\)/, 'new uploads should be written under the user upload scope');
    assert.match(serverIndex, /function resolveUserUploadPath\(userId, filename\)/, 'authenticated media reads should resolve through a user boundary helper');
    assert.match(serverIndex, /app\.get\('\/api\/media\/uploads\/:filename', authMiddleware/, 'authenticated media read route should exist');
    assert.match(serverIndex, /app\.use\('\/uploads'[\s\S]*req\.path === '\/users' \|\| req\.path\.startsWith\('\/users\/'\)/, 'scoped user uploads should not remain publicly exposed by the static route');
    assert.match(serverIndex, /const authUrl = `\/api\/media\/uploads\/\$\{encodeURIComponent\(file\.filename\)\}`/, 'new uploads should return the authenticated media URL');
    assert.match(serverIndex, /res\.json\(\{ success: true, url: authUrl, mediaUrl: authUrl, legacyUrl \}\)/, 'upload responses should keep legacy paths separate from the canonical URL');
    assert.match(avatarUtil, /function isLocalUploadUrl\(raw, parsedUrl, apiOrigin\)[\s\S]*raw\.startsWith\('\/'\)[\s\S]*parsedUrl\.origin === apiOrigin/, 'avatar upload URL migration should only coerce local or configured API upload paths');
    assert.match(avatarUtil, /pathPart\.startsWith\('\/uploads\/users\/'\)[\s\S]*\/api\/media\/uploads\/\$\{filename\}/, 'legacy scoped upload URLs should be coerced to the authenticated media route');
    assert.doesNotMatch(avatarUtil, /raw\.includes\('\/uploads\/users\/'\)|raw\.includes\('\/api\/media\/uploads\/'\)/, 'external URLs containing upload-looking path text should not be rewritten as local uploads');
    assert.match(authenticatedImage, /const CONFIGURED_API_URL = import\.meta\.env\.VITE_API_URL/, 'authenticated media image fetches should use the configured API boundary');
    assert.match(authenticatedImage, /new URL\(raw, window\.location\.origin\)/, 'authenticated media image URLs should be parsed before token-bearing fetches');
    assert.match(authenticatedImage, /imageUrl\.origin === apiUrl\.origin && imageUrl\.pathname\.startsWith\(mediaPath\)/, 'authenticated media images should only send bearer tokens to the configured API origin and path');
    assert.match(authenticatedImage, /fetch\(imageSrc, \{ headers: \{ Authorization: `Bearer \$\{token\}` \} \}\)/, 'authenticated media images should be fetched with the current bearer token after boundary checks');

    assert.match(backgroundQueue, /function getBackgroundQueueStats\(options = \{\}\)/, 'background queue stats should accept scoping options');
    assert.match(backgroundQueue, /String\(key \|\| ''\)[\s\S]*\.split\(':'\)[\s\S]*\.some\(part => part === cleanUserId\)/, 'background queue filtering should match user ids as exact key segments');
    assert.match(backgroundQueue, /keyMatchesUser\(task\?\.key, userId\)/, 'recent queue tasks should be filtered by user');
    assert.match(serverIndex, /getBackgroundQueueStats\(includeAll \? \{\} : \{ userId: req\.user\.id \}\)/, 'ordinary users should only see their own background queues');
});

test('default user and character APIs redact user-owned API keys without wiping saved secrets', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const settingsPanel = readRepoFile('client', 'src', 'components', 'SettingsPanel.jsx');
    const themePlugin = readRepoFile('server', 'plugins', 'theme', 'index.js');
    const memoryMaintenanceService = readRepoFile('server', 'memoryMaintenanceService.js');

    assert.match(serverIndex, /const CHARACTER_SECRET_FIELDS = \['api_key', 'memory_api_key', 'tts_api_key'\]/, 'character list should define redacted secret fields');
    assert.match(serverIndex, /const PROFILE_SECRET_FIELDS = \['serper_api_key', 'web_search_keys_json', 'memory_maintenance_api_key'\]/, 'user profile should define redacted secret fields');
    assert.match(serverIndex, /function redactSecretFields\(record, fields\)[\s\S]*safe\[`\$\{field\}_configured`\][\s\S]*safe\[`\$\{field\}_last4`\][\s\S]*safe\[field\] = ''/, 'default reads should return only configured flags and last4');
    assert.match(serverIndex, /const clearFlag = `\$\{field\}_clear`[\s\S]*next\[field\] = field === 'web_search_keys_json' \? '\{\}' : ''/, 'explicit clear flags should allow users to remove saved secrets');
    assert.match(serverIndex, /function preserveExistingSecretFields\(patch, existing, fields\)[\s\S]*delete next\[field\]/, 'blank redacted fields should preserve existing saved secrets');
    assert.match(serverIndex, /res\.json\(redactSecretFields\(\{ \.\.\.\(profile \|\| \{ name: req\.user\.username \}\)/, 'GET /api/user should redact profile secrets');
    assert.match(serverIndex, /db\.updateUserProfile\(preserveExistingSecretFields\(req\.body, currentProfile, PROFILE_SECRET_FIELDS\)\)/, 'profile saves should not wipe hidden secrets');
    assert.match(serverIndex, /return redactSecretFields\(\{[\s\S]*\.\.\.c,[\s\S]*emotion_color: emotion\.color[\s\S]*\}, CHARACTER_SECRET_FIELDS\)/, 'GET /api/characters should redact character secrets');
    assert.match(serverIndex, /const characterPatch = preserveExistingSecretFields\(data, prevCharacter, CHARACTER_SECRET_FIELDS\)/, 'character saves should preserve hidden secrets');
    assert.match(serverIndex, /app\.post\('\/api\/characters\/:id\/models'[\s\S]*scope === 'memory' \? character\.memory_api_key : character\.api_key[\s\S]*handleModelListProxy\(req, res, \{ endpoint, key \}\)/, 'character model fetching should reuse stored secrets without exposing them to the browser');
    assert.match(serverIndex, /const pickTtsOverride[\s\S]*typeof value === 'string' && !value\.trim\(\)[\s\S]*return character\[field\]/, 'TTS preview should not let a blank redacted field mask the stored key');
    assert.match(settingsPanel, /const getSecretPlaceholder[\s\S]*已保存：\$\{last4\}[\s\S]*留空保留，输入新 Key 替换/, 'settings editor should show saved-key state instead of a blank secret field');
    assert.match(settingsPanel, /const renderSecretStatus[\s\S]*markEditingSecretClear\(field\)/, 'settings editor should expose an explicit clear action for saved keys');
    assert.match(settingsPanel, /\/characters\/\$\{encodeURIComponent\(options\.characterId\)\}\/models/, 'settings editor should fetch models through the saved-character-key route when available');
    assert.match(settingsPanel, /if \(!endpoint \|\| \(!key && !characterId\) \|\| !model\)/, 'theme generation should allow saved character keys without front-end plaintext');
    assert.match(settingsPanel, /character_id: characterId/, 'theme generation should pass the selected character id for saved-key lookup');
    assert.match(themePlugin, /const \{ query, character_id \} = req\.body[\s\S]*req\.db\.getCharacter\(character_id\)[\s\S]*api_key = api_key \|\| character\?\.api_key/, 'theme generation should resolve saved character keys server-side');
    assert.match(memoryMaintenanceService, /function redactMemoryMaintenanceSettings\(settings = \{\}\)[\s\S]*api_key: apiKey \? `••••\$\{apiKey\.slice\(-4\)\}` : ''/, 'memory maintenance settings should return a masked key');
    assert.match(memoryMaintenanceService, /isMaskedSecretInput\(safeBody\.api_key\)[\s\S]*delete safeBody\.api_key/, 'saving masked memory maintenance keys should preserve the stored value');
});

test('plugin API key surfaces do not leak secrets or use global web-search env fallback', () => {
    const mcpLab = readRepoFile('server', 'plugins', 'mcpLab', 'index.js');
    const socialHousing = readRepoFile('server', 'plugins', 'socialHousing', 'index.js');

    assert.match(mcpLab, /const profileKey = String\(storedKeys\[item\.id\] \|\| ''\)\.trim\(\)/, 'web search providers should read user profile keys');
    assert.match(mcpLab, /source: profileKey \? 'user_profile' : 'none'/, 'web search provider status should not expose env as an active key source');
    assert.match(mcpLab, /const key = String\(config\.keys\[id\] \|\| ''\)\.trim\(\)/, 'web search resolution should use only the current user profile key');
    assert.doesNotMatch(mcpLab, /process\.env\[item\.env\]/, 'web search config must not fall back to global env keys for ordinary users');
    assert.doesNotMatch(mcpLab, /process\.env\[provider\?\.env\]/, 'web search provider resolution must not fall back to global env keys');

    assert.match(socialHousing, /function redactSocialHousingCharacterSecrets\(characters = \[\]\)[\s\S]*api_key: ''[\s\S]*api_key_configured[\s\S]*api_key_last4/, 'social housing character lists should redact character API keys');
    assert.match(socialHousing, /function redactAgencyConfig\(config = \{\}\)[\s\S]*delete safe\.llm_key/, 'social housing agency config should not return stored legacy LLM keys');
    assert.match(socialHousing, /function preserveAgencySecretPatch\(payload = \{\}, current = \{\}\)[\s\S]*delete next\.llm_key/, 'masked or blank agency key saves should preserve the stored value');
    assert.match(socialHousing, /characters: redactSocialHousingCharacterSecrets\(socialHousingDb\.getCharactersWithBindings/, 'social housing bootstrap and mutations should return redacted characters');
    assert.match(socialHousing, /agency: redactAgencyConfig\(socialHousingDb\.getAgencyConfig\(\)\)/, 'social housing responses should return redacted agency config');
});

test('private and group reply scheduling is isolated per user and discards stale outputs', () => {
    const engineSource = readRepoFile('server', 'engine.js');
    const groupChat = readRepoFile('server', 'plugins', 'groupChat', 'index.js');

    assert.match(engineSource, /const latestUserReplyRequests = new Map\(\)/, 'engine should track the latest pending private reply per character');
    assert.match(engineSource, /function isPrivateReplyStale\(characterId, generationOptions = \{\}\)/, 'engine should detect stale private replies');
    assert.match(engineSource, /getLatestUserMessageId\(characterId\) > targetUserMessageId/, 'stale detection should compare against the latest user message id');
    assert.match(engineSource, /function scheduleQueuedUserReply\(characterId, wsClients, options = \{\}\)/, 'private replies should go through a queued scheduler');
    assert.match(engineSource, /queueEngineTask\(\s*`char:\$\{characterId\}`,[\s\S]*dedupeKey: `private-reply:\$\{characterId\}`/, 'private replies should serialize on the per-character engine queue');
    assert.match(engineSource, /targetUserMessageId: Number\(generationRequest\?\.targetUserMessageId \|\| 0\) \|\| getLatestUserMessageId\(characterId\)/, 'queued private replies should bind to the target user message id');
    assert.match(engineSource, /function mergePrivateUserReplyCleanup\(previousRequest = \{\}, nextRequest = \{\}\)[\s\S]*hadPendingCityReply: true[\s\S]*cityIgnoreStreak: Math\.max/, 'replacement private replies should inherit city cleanup metadata from superseded requests');
    assert.match(engineSource, /const previousRequest = latestUserReplyRequests\.get\(characterId\);[\s\S]*const nextRequest = mergePrivateUserReplyCleanup\(previousRequest, request\);[\s\S]*latestUserReplyRequests\.set\(characterId, nextRequest\)/, 'latest private reply requests should preserve cleanup state when overwritten');
    assert.match(engineSource, /return abortStalePrivateReply\(charCheck, wsClients, generationOptions, 'before_visible_save'\)/, 'engine should drop stale output immediately before visible saves');
    assert.doesNotMatch(engineSource, /setTimeout\(\(\) => \{[\s\S]*triggerMessage\(freshChar, wsClients, true/, 'private user messages should not launch direct parallel reply timers');

    assert.match(groupChat, /function getGroupRuntimeKey\(userId, groupId\)[\s\S]*`\$\{cleanUserId\}:\$\{cleanGroupId\}`/, 'group runtime keys should include user id and group id');
    assert.match(groupChat, /const runtimeKey = getGroupRuntimeKey\(req\.user\.id, groupId\)/, 'group user-message debounce should use user-scoped runtime keys');
    assert.match(groupChat, /const runtimeKey = getGroupRuntimeKey\(userId, groupId\)/, 'group AI chain locks should use user-scoped runtime keys');
    assert.doesNotMatch(groupChat, /groupReplyLock\[groupId\]/, 'group reply locks must not be keyed only by group id');
    assert.doesNotMatch(groupChat, /groupPendingMentions\[groupId\]/, 'group pending mentions must not be keyed only by group id');
});

test('transfer card calls authenticated transfer APIs', () => {
    const messageBubble = readRepoFile('client', 'src', 'components', 'MessageBubble.jsx');
    const economyPlugin = readRepoFile('server', 'plugins', 'economy', 'index.js');

    assert.match(economyPlugin, /app\.get\(\s*['"]\/api\/transfers\/:tid['"]\s*,\s*authMiddleware\s*,/, 'transfer status API is authenticated');
    assert.match(economyPlugin, /app\.post\(\s*['"]\/api\/transfers\/:tid\/claim['"]\s*,\s*authMiddleware\s*,/, 'transfer claim API is authenticated');
    assert.match(economyPlugin, /app\.post\(\s*['"]\/api\/transfers\/:tid\/refund['"]\s*,\s*authMiddleware\s*,/, 'transfer refund API is authenticated');
    assert.match(messageBubble, /function buildAuthHeaders/, 'transfer card should share an auth header helper');
    assert.match(messageBubble, /window\.localStorage\.getItem\('cp_token'\)/, 'transfer card should read the current cp_token');
    assert.match(messageBubble, /headers: buildAuthHeaders\(\)/, 'transfer status refresh should send auth headers');
    assert.match(messageBubble, /headers: buildAuthHeaders\(\{ 'Content-Type': 'application\/json' \}\)/, 'transfer actions should send auth and JSON headers');
    assert.doesNotMatch(messageBubble, /fetch\(`\$\{apiUrl\}\/transfers\/\$\{tid\}`\)/, 'transfer status must not be fetched without auth options');
});

test('private transfer amounts are normalized before wallet writes', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const economyPlugin = readRepoFile('server', 'plugins', 'economy', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(serverIndex, /function normalizePositiveMoney\(value\)/, 'legacy transfer route should share positive money normalization');
    assert.match(serverIndex, /function normalizePaymentNote\(value, fallback = ''\)[\s\S]*typeof value !== 'string'[\s\S]*return value\.trim\(\)\.slice\(0, 120\)/, 'legacy transfer route should normalize optional notes without coercing objects');
    assert.match(serverIndex, /const transferAmount = normalizePositiveMoney\(amount\)/, 'legacy transfer route should normalize request amounts before DB writes');
    assert.match(serverIndex, /if \(!transferAmount\) return res\.status\(400\)\.json\(\{ error: 'Invalid amount' \}\)/, 'legacy transfer route should reject invalid, negative, and sub-cent amounts');
    assert.match(serverIndex, /const transferNote = normalizePaymentNote\(note, 'Transfer'\);[\s\S]*if \(transferNote === null\) return res\.status\(400\)\.json\(\{ error: 'Invalid note' \}\)/, 'legacy transfer route should reject non-string notes');
    assert.match(serverIndex, /amount: transferAmount/, 'legacy transfer route should pass the normalized amount to DB');
    assert.match(serverIndex, /\[TRANSFER\]\$\{tid\}\|\$\{transferAmount\}/, 'legacy transfer message should display the normalized amount');
    assert.doesNotMatch(serverIndex, /const transferNote = note \|\| 'Transfer'/, 'legacy transfer route must not persist raw notes');
    assert.doesNotMatch(serverIndex, /amount: parseFloat\(amount\) \|\| 0\.01/, 'legacy transfer route must not turn invalid values into a fallback transfer');

    assert.match(economyPlugin, /const amountF = normalizePositiveMoney\(amount\)/, 'economy transfer route should normalize request amounts');
    assert.match(economyPlugin, /function normalizePaymentNote\(value\)[\s\S]*typeof value !== 'string'[\s\S]*return value\.trim\(\)\.slice\(0, 120\)/, 'economy routes should normalize optional notes without coercing objects');
    assert.match(economyPlugin, /const noteText = normalizePaymentNote\(note\);[\s\S]*if \(noteText === null\) return res\.status\(400\)\.json\(\{ error: 'Invalid note' \}\)/, 'economy transfer route should reject non-string notes');
    assert.match(economyPlugin, /db\.createTransfer\(\{ charId, senderId: 'user', recipientId: charId, amount: amountF, note: noteText \}\)/, 'economy transfer route should persist normalized notes');
    assert.match(economyPlugin, /\[TRANSFER\]\$\{tid\}\|\$\{amountF\}\|\$\{noteText\}/, 'economy transfer message should display normalized notes');
    assert.doesNotMatch(economyPlugin, /const amountF = parseFloat\(amount\)/, 'economy transfer route must not use raw parseFloat validation');

    assert.match(dbSource, /function normalizeTransferAmount\(value\)/, 'DB transfer writes should use a shared amount normalizer');
    assert.match(dbSource, /function normalizePaymentNote\(value\)[\s\S]*typeof value !== 'string'[\s\S]*备注无效[\s\S]*return value\.trim\(\)\.slice\(0, 120\)/, 'DB payment note writes should reject non-string notes and cap stored text');
    assert.match(dbSource, /if \(!Number\.isFinite\(amount\) \|\| amount <= 0\) throw new Error\('转账金额无效'\)/, 'DB transfer normalizer should reject non-finite and negative amounts');
    assert.match(dbSource, /const transferAmount = normalizeTransferAmount\(amount\)/, 'DB createTransfer should normalize amounts before wallet writes');
    assert.match(dbSource, /const safeNote = normalizePaymentNote\(note\)[\s\S]*\.run\(cleanCharId, cleanSenderId, cleanRecipientId, transferAmount, safeNote, messageId \?\? null, Date\.now\(\)\)/, 'DB createTransfer should persist normalized notes');
    assert.match(dbSource, /if \(bal < transferAmount\) throw new Error\('余额不足'\)/, 'wallet balance checks should use normalized positive transfer amounts');
    assert.match(dbSource, /transferAmount = normalizeTransferAmount\(t\.amount\)/, 'claim/refund should reject corrupted transfer rows before wallet writes');
    assert.doesNotMatch(dbSource, /bal < amount/, 'DB createTransfer must not compare balances against raw request amounts');
    assert.doesNotMatch(dbSource, /bal \+ t\.amount|bal - t\.amount/, 'claim/refund must not write wallets with raw stored transfer amounts');
});

test('generated private transfer tags validate amount before wallet side effects', () => {
    const engineSource = readRepoFile('server', 'engine.js');
    const preflightPos = engineSource.indexOf('const generatedTransferMatch = String(generatedText || \'\').match');
    const timerSideEffectPos = engineSource.indexOf('// Check for self-scheduled timer tags like [TIMER: 60]');
    const walletWritePos = engineSource.indexOf('transferId = db.createTransfer({');

    assert.notEqual(preflightPos, -1, 'engine should preflight generated transfer tags');
    assert.notEqual(timerSideEffectPos, -1, 'engine should still parse timer tags after transfer preflight');
    assert.notEqual(walletWritePos, -1, 'engine should still create valid generated transfers');
    assert.ok(preflightPos < timerSideEffectPos, 'generated transfer amount validation should run before timer or wallet side effects');
    assert.ok(preflightPos < walletWritePos, 'generated transfer amount validation should run before wallet writes');
    assert.match(engineSource, /function normalizeGeneratedTransferAmount\(value\)[\s\S]*\/\^\\d\+\(\?:\\\.\\d\{1,2\}\)\?\$\/\.test\(text\)[\s\S]*amount <= 0/, 'generated transfer amounts should reject partial, malformed, and non-positive values');
    assert.match(engineSource, /amount: normalizeGeneratedTransferAmount\(generatedTransferMatch\[1\]\)/, 'generated transfers should use strict normalized amounts');
    assert.match(engineSource, /if \(generatedTransferMatch && !generatedTransferIntent\.amount\) \{\s*throw new Error\('AI returned invalid transfer amount\. Please retry\.'\);/, 'invalid generated transfer amounts should fail visibly for retry');
    assert.doesNotMatch(engineSource, /parseFloat\(transferMatch\[1\]\)/, 'generated transfers must not parse prefix amounts');
});

test('generated emotion state tags fail instead of clamping malformed values', () => {
    const engineSource = readRepoFile('server', 'engine.js');
    const preflightPos = engineSource.indexOf('const generatedPressureMatch = charCheck.sys_pressure !== 0');
    const moodPreflightPos = engineSource.indexOf("const generatedMoodDelta = parseTaggedDelta(generatedText, 'MOOD_DELTA', -12, 12)");
    const jealousyPreflightPos = engineSource.indexOf("const generatedJealousyLevel = charCheck.sys_jealousy !== 0");
    const affinityPreflightPos = engineSource.indexOf('const generatedAffinityDelta = parseGeneratedAffinityDelta(generatedText)');
    const timerSideEffectPos = engineSource.indexOf('// Check for self-scheduled timer tags like [TIMER: 60]');

    assert.notEqual(preflightPos, -1, 'engine should preflight generated pressure tags');
    assert.notEqual(moodPreflightPos, -1, 'engine should preflight generated mood delta tags');
    assert.notEqual(jealousyPreflightPos, -1, 'engine should preflight generated jealousy tags');
    assert.notEqual(affinityPreflightPos, -1, 'engine should preflight generated affinity tags');
    assert.notEqual(timerSideEffectPos, -1, 'engine should still parse timer tags after pressure preflight');
    assert.ok(preflightPos < timerSideEffectPos, 'generated pressure validation should run before timer or state side effects');
    assert.ok(moodPreflightPos < timerSideEffectPos, 'generated mood delta validation should run before timer or state side effects');
    assert.ok(jealousyPreflightPos < timerSideEffectPos, 'generated jealousy validation should run before timer or state side effects');
    assert.ok(affinityPreflightPos < timerSideEffectPos, 'generated affinity validation should run before timer or state side effects');
    assert.match(engineSource, /function normalizeGeneratedIntegerInRange\(value, min, max\)[\s\S]*\/\^\[\+-\]\?\\d\+\$\/\.test\(text\)[\s\S]*parsed >= min && parsed <= max/, 'generated numeric tags should require whole integer strings within range');
    assert.match(engineSource, /function parseGeneratedBoundedTag\(text, tagName, min, max, errorMessage\)[\s\S]*throw new Error\(errorMessage\)/, 'invalid generated bounded tags should fail visibly for retry');
    assert.match(engineSource, /Use concrete digits only; never output N placeholders/, 'hidden tag prompt should not invite literal +N or -N delta placeholders');
    assert.doesNotMatch(engineSource, /\[PRESSURE_DELTA:\+N\/-N\]|\[MOOD_DELTA:\+N\/-N\]/, 'pressure and mood delta examples should use concrete numeric values');
    assert.match(engineSource, /function parseGeneratedAffinityDelta\(text\)[\s\S]*parseGeneratedBoundedTag\(text, 'AFFINITY', -100, 100, 'AI returned invalid affinity delta\. Please retry\.'\)/, 'generated affinity deltas should reject malformed and out-of-range values');
    assert.match(engineSource, /function normalizeGeneratedPressureLevel\(value\)[\s\S]*return normalizeGeneratedIntegerInRange\(value, 0, 4\)/, 'generated pressure tags should only accept integer levels 0..4');
    assert.match(engineSource, /if \(generatedPressureMatch && generatedPressureLevel == null\) \{\s*throw new Error\('AI returned invalid pressure level\. Please retry\.'\);/, 'invalid generated pressure tags should fail visibly for retry');
    assert.match(engineSource, /parseGeneratedBoundedTag\(generatedText, 'JEALOUSY', 0, 100, 'AI returned invalid jealousy level\. Please retry\.'\)/, 'generated jealousy tags should fail when outside 0..100');
    assert.match(engineSource, /if \(generatedAffinityDelta !== null\) \{[\s\S]*const delta = generatedAffinityDelta[\s\S]*db\.updateCharacter\(character\.id, \{ affinity: newAff \}\)/, 'affinity side effects should write the preflight-normalized delta');
    assert.match(engineSource, /combinedEmotionPatch\.pressure_level = generatedPressureLevel/, 'pressure tag side effects should write the normalized level');
    assert.match(engineSource, /if \(generatedJealousyLevel !== null\) \{[\s\S]*combinedEmotionPatch\.jealousy_level = newJealousy/, 'jealousy side effects should write the preflight-normalized level');
    assert.doesNotMatch(engineSource, /const newPressure = parseInt\(pressureMatch\[1\], 10\)/, 'generated pressure tags must not write raw parsed levels');
    assert.doesNotMatch(engineSource, /const delta = parseInt\(affinityMatch\[1\], 10\)/, 'generated affinity tags must not write raw parsed deltas');
    assert.doesNotMatch(engineSource, /return clamp\(parsed, min, max\)/, 'generated delta tags must not clamp malformed or out-of-range values into success');
    assert.doesNotMatch(engineSource, /Math\.min\(100, Math\.max\(0, parseInt\(jealousyMatch\[1\], 10\)\)\)/, 'generated jealousy tags must not clamp out-of-range values into success');
});

test('generated city action tags tolerate narrow empty-field JSON glitches', () => {
    const engineSource = readRepoFile('server', 'engine.js');
    const cityActionStart = engineSource.indexOf('const cityActionRegex = /\\[CITY_ACTION:');
    const cityIntentStart = engineSource.indexOf('const cityIntentRegex = /\\[CITY_INTENT:', cityActionStart);
    const ttsIntentStart = engineSource.indexOf('const ttsIntent = parseTtsIntentTag', cityIntentStart);

    assert.notEqual(cityActionStart, -1, 'engine should parse generated city action tags');
    assert.notEqual(cityIntentStart, -1, 'engine should parse generated city intent tags after action tags');
    assert.notEqual(ttsIntentStart, -1, 'engine should finish city tag processing before TTS parsing');

    const cityActionBlock = engineSource.slice(cityActionStart, cityIntentStart);
    const cityIntentBlock = engineSource.slice(cityIntentStart, ttsIntentStart);

    assert.match(engineSource, /function parseGeneratedCityActionPayload\(rawCityAction\)[\s\S]*JSON\.parse\(rawText\)/, 'city action tags should still prefer strict JSON parsing');
    assert.match(engineSource, /function parseLooseGeneratedCityActionPayload\(rawCityAction\)[\s\S]*hasDistrictSignal[\s\S]*return hasDistrictSignal \? parsed : null/, 'loose city action parsing should require a district signal before accepting repaired fields');
    assert.match(engineSource, /function normalizeLooseGeneratedCityActionValue\(value\)[\s\S]*\/\^\[,，"'\\s\}\]\+\$\/\.test\(text\) \? '' : text/, 'loose city action parsing should treat punctuation-only broken fields as empty strings');
    assert.match(cityActionBlock, /const parsedCityAction = parseGeneratedCityActionPayload\(rawCityAction\)/, 'city action tags should use the strict-then-loose parser');
    assert.match(cityActionBlock, /const cityActionResult = await cityReplyActionCallback\(userId, character\.id, parsedCityAction, generatedText\)/, 'city action callbacks should return a result before being treated as handled');
    assert.match(cityActionBlock, /if \(cityActionResult\?\.canRetry\) \{[\s\S]*throw new Error\(cityActionResult\.reason \|\| 'city action retry required'\)/, 'retryable city action failures should abort the generated reply');
    assert.ok(
        cityActionBlock.includes('throw new Error(`AI returned invalid city action. Please retry. ${cityActionErr.message}`);'),
        'unrepairable city action tags should surface a retryable generation error'
    );
    assert.doesNotMatch(cityActionBlock, /console\.warn\(`\[Engine\] City reply action sync failed/, 'city action callback failures should not be hidden as normal chat success');

    assert.match(cityIntentBlock, /const cityIntentResult = await cityReplyIntentCallback\(userId, character\.id, cityIntentMatch\[1\]\.trim\(\), generatedText\)/, 'city intent callbacks should return a result before being treated as handled');
    assert.match(cityIntentBlock, /if \(cityIntentResult\?\.canRetry\) \{[\s\S]*throw new Error\(cityIntentResult\.reason \|\| 'city intent retry required'\)/, 'retryable city intent failures should abort the generated reply');
    assert.ok(
        cityIntentBlock.includes('throw new Error(`AI returned invalid city intent. Please retry. ${cityIntentErr.message}`);'),
        'invalid city intent tags should surface a retryable generation error'
    );
    assert.doesNotMatch(cityIntentBlock, /console\.warn\(`\[Engine\] City reply intent sync failed/, 'city intent callback failures should not be hidden as normal chat success');
});

test('private transfer routes validate ids and targets before wallet side effects', () => {
    const economyPlugin = readRepoFile('server', 'plugins', 'economy', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');
    const getStart = economyPlugin.indexOf("app.get('/api/transfers/:tid'");
    const claimStart = economyPlugin.indexOf("app.post('/api/transfers/:tid/claim'", getStart);
    const refundStart = economyPlugin.indexOf("app.post('/api/transfers/:tid/refund'", claimStart);
    const sendStart = economyPlugin.indexOf("app.post('/api/characters/:id/transfer'", refundStart);
    const walletStart = economyPlugin.indexOf("app.get('/api/wallet/:id'", sendStart);

    assert.notEqual(getStart, -1, 'transfer detail route should exist');
    assert.notEqual(claimStart, -1, 'transfer claim route should exist');
    assert.notEqual(refundStart, -1, 'transfer refund route should exist');
    assert.notEqual(sendStart, -1, 'character transfer route should exist');
    assert.notEqual(walletStart, -1, 'wallet route should exist');

    const detailRoute = economyPlugin.slice(getStart, claimStart);
    const claimRoute = economyPlugin.slice(claimStart, refundStart);
    const refundRoute = economyPlugin.slice(refundStart, sendStart);
    const sendRoute = economyPlugin.slice(sendStart, walletStart);
    const walletRoute = economyPlugin.slice(walletStart);

    assert.match(economyPlugin, /function normalizeTransferId\(value\)[\s\S]*Number\.isSafeInteger\(id\) && id > 0/, 'transfer routes should reject non-integer route ids instead of parseInt-prefix matching');
    assert.match(detailRoute, /const transferId = normalizeTransferId\(req\.params\.tid\);[\s\S]*if \(!transferId\) return res\.status\(400\)\.json\(\{ error: 'Invalid transfer id' \}\)/, 'transfer detail should reject invalid transfer ids');
    assert.match(claimRoute, /const transferId = normalizeTransferId\(req\.params\.tid\);[\s\S]*db\.claimTransfer\(transferId, claimer_id\)/, 'transfer claims should use normalized transfer ids');
    assert.match(refundRoute, /const tid = normalizeTransferId\(req\.params\.tid\);[\s\S]*db\.refundTransfer\(tid, refunder_id\)/, 'transfer refunds should use normalized transfer ids');
    assert.doesNotMatch(economyPlugin, /db\.(?:getTransfer|claimTransfer)\(parseInt\(req\.params\.tid\)/, 'transfer routes must not accept parseInt-prefix ids');

    assert.match(sendRoute, /const char = db\.getCharacter\(charId\);[\s\S]*if \(!char\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*db\.createTransfer/, 'character transfer route should reject missing characters before wallet deduction');
    assert.match(sendRoute, /return res\.status\(e\.status \|\| 400\)\.json\(\{ error: e\.message \}\)/, 'character transfer route should return DB validation failures as bad input');
    assert.doesNotMatch(sendRoute, /Fallback: refund if API errors out|系统自动退回了您的转账|fallbackResult = db\.refundTransfer/, 'transfer AI decision failures must not auto-refund or fabricate a default reply');
    assert.match(sendRoute, /catch \(e\) \{\s*console\.error\('\[Transfer\] char decide error or timeout:', e\.message\);\s*\}/, 'transfer AI decision failures should be reported without a fallback wallet mutation');

    assert.match(walletRoute, /const walletId = String\(req\.params\.id \|\| ''\)\.trim\(\)/, 'wallet route should normalize requested wallet ids');
    assert.match(walletRoute, /walletId !== 'user' && !db\.getCharacter\(walletId\)[\s\S]*Character not found/, 'wallet route should reject ghost character wallets');

    assert.match(dbSource, /const cleanCharId = String\(charId \|\| ''\)\.trim\(\)/, 'DB createTransfer should normalize the thread character id');
    assert.match(dbSource, /if \(!cleanCharId \|\| !db\.prepare\('SELECT 1 FROM characters WHERE id = \? LIMIT 1'\)\.get\(cleanCharId\)\)/, 'DB createTransfer should reject ghost thread characters before wallet writes');
    assert.match(dbSource, /if \(!cleanSenderId \|\| !cleanRecipientId\) throw new Error\('转账参与方无效'\)/, 'DB createTransfer should reject blank transfer actors');
    assert.match(dbSource, /付款方不存在/, 'DB createTransfer and refund should reject ghost payers');
    assert.match(dbSource, /收款方不存在/, 'DB createTransfer, claim, and refund should reject ghost recipients');
    assert.match(dbSource, /\.run\(cleanCharId, cleanSenderId, cleanRecipientId, transferAmount/, 'DB createTransfer should persist normalized actor ids');
    assert.match(dbSource, /const cleanClaimerId = String\(claimerId \|\| ''\)\.trim\(\)/, 'DB claimTransfer should normalize claim actors');
    assert.match(dbSource, /const cleanRefunderId = String\(refunderId \|\| ''\)\.trim\(\)/, 'DB refundTransfer should normalize refund actors');
});

test('interactive HTTP routes do not trust client-supplied actor ids', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const economyPlugin = readRepoFile('server', 'plugins', 'economy', 'index.js');
    const momentsFeed = readRepoFile('client', 'src', 'components', 'MomentsFeed.jsx');
    const groupChatWindow = readRepoFile('client', 'src', 'components', 'GroupChatWindow.jsx');

    assert.match(serverIndex, /db\.toggleLike\(moment\.id, 'user'\)/, 'moment likes should always use the authenticated user actor');
    assert.match(serverIndex, /db\.addComment\(moment\.id, 'user', comment\)/, 'moment comments should always use the authenticated user actor');
    assert.doesNotMatch(serverIndex, /const \{ liker_id \} = req\.body/, 'moment like route must not trust a request-body liker id');
    assert.doesNotMatch(serverIndex, /const \{ author_id, content \} = req\.body/, 'moment comment route must not trust a request-body author id');

    assert.match(economyPlugin, /const claimer_id = 'user';[\s\S]*db\.claimTransfer\(transferId, claimer_id\)/, 'transfer claim should always use the authenticated user actor');
    assert.match(economyPlugin, /const refunder_id = 'user';[\s\S]*db\.refundTransfer\(tid, refunder_id\)/, 'transfer refund should always use the authenticated user actor');
    assert.match(economyPlugin, /const sender_id = 'user';[\s\S]*db\.createRedPacket\(\{[\s\S]*senderId: sender_id/, 'red packet creation should always use the authenticated user actor');
    assert.match(economyPlugin, /const claimer_id = 'user';[\s\S]*db\.claimRedPacket\(packetId, claimer_id, group\.id\)/, 'red packet claim should always use the authenticated user actor');
    assert.doesNotMatch(economyPlugin, /const \{ claimer_id = 'user' \} = req\.body/, 'economy routes must not trust request-body claimer ids');
    assert.doesNotMatch(economyPlugin, /const \{ sender_id = 'user'/, 'red packet creation must not trust request-body sender ids');

    assert.doesNotMatch(momentsFeed, /liker_id: 'user'|author_id: 'user'/, 'moments UI should not send spoofable actor ids');
    assert.doesNotMatch(groupChatWindow, /claimer_id: 'user'/, 'red packet UI should not send spoofable actor ids');
});

test('moments routes validate ids and protect character-authored posts', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');
    const engineSource = readRepoFile('server', 'engine.js');
    const groupChat = readRepoFile('server', 'plugins', 'groupChat', 'index.js');

    assert.match(dbSource, /function normalizePositiveRowId\(value, label = 'id'\)/, 'shared social row ids should be normalized defensively');
    assert.match(dbSource, /function getMoment\(momentId\)/, 'DB should expose a safe moment lookup helper');
    assert.match(dbSource, /return db\.prepare\('SELECT \* FROM moments WHERE id = \? LIMIT 1'\)\.get\(id\) \|\| null/, 'moment lookup should use a normalized id');
    assert.match(dbSource, /function addMoment\(characterId, content, imageUrl = null, visibility = 'all'\)[\s\S]*const authorId = String\(characterId \|\| ''\)\.trim\(\);[\s\S]*Moment author not found[\s\S]*Moment content required[\s\S]*\.run\(authorId, safeContent, imageUrl, visibility, Date\.now\(\)\)/, 'moment writes should reject ghost authors and blank or non-string content at the DB layer');
    assert.match(dbSource, /function deleteMoment\(momentId\)[\s\S]*const info = db\.prepare\('DELETE FROM moments WHERE id = \?'\)\.run\(id\)[\s\S]*return info\.changes \|\| 0/, 'moment deletion should report whether a row was actually removed');
    assert.match(dbSource, /function normalizeSocialActorId\(actorId, label = 'actor'\)[\s\S]*id !== 'user' && !getCharacter\(id\)[\s\S]*throw error[\s\S]*return id/, 'social actors should be limited to the user or real characters');
    assert.match(dbSource, /function toggleLike\(momentId, likerId\)[\s\S]*SELECT id FROM moments WHERE id = \? LIMIT 1[\s\S]*Moment not found[\s\S]*const actorId = normalizeSocialActorId\(likerId, 'Moment liker'\)[\s\S]*\.run\(id, actorId, Date\.now\(\)\)/, 'likes should reject missing moments and ghost likers');
    assert.doesNotMatch(dbSource, /INSERT INTO moment_likes\(moment_id,liker_id,timestamp\) VALUES\(\?,\?,\?\)'\)\.run\(id, likerId, Date\.now\(\)\)/, 'likes must not persist raw liker ids');
    assert.match(dbSource, /function addComment\(momentId, authorId, content\)[\s\S]*SELECT id FROM moments WHERE id = \? LIMIT 1[\s\S]*Moment not found[\s\S]*const actorId = normalizeSocialActorId\(authorId, 'Moment comment author'\)[\s\S]*const comment = typeof content === 'string' \? content\.trim\(\) : '';[\s\S]*\.run\(id, actorId, comment, Date\.now\(\)\)/, 'comments should reject missing moments, ghost authors, and non-string content');
    assert.doesNotMatch(dbSource, /const comment = String\(content \|\| ''\)\.trim\(\)/, 'comments must not coerce objects into [object Object] content');
    assert.match(dbSource, /function addDiary\(characterId, content, emotion = null\)[\s\S]*const authorId = String\(characterId \|\| ''\)\.trim\(\);[\s\S]*Diary author not found[\s\S]*Diary content required[\s\S]*\.run\(authorId, safeContent, emotion, Date\.now\(\)\)/, 'diary writes should reject ghost authors and blank or non-string content at the DB layer');
    assert.match(dbSource, /function deleteDiary\(diaryId\)[\s\S]*return info\.changes \|\| 0/, 'diary deletion should report whether a row was actually removed');
    assert.match(dbSource, /function unlockDiaries\(characterId\)[\s\S]*const authorId = String\(characterId \|\| ''\)\.trim\(\);[\s\S]*Diary author not found[\s\S]*UPDATE characters SET is_diary_unlocked = 1 WHERE id = \?'\)\.run\(authorId\)/, 'diary unlock writes should reject ghost authors instead of silently updating zero rows');
    assert.match(dbSource, /function setDiaryPassword\(characterId, password\)[\s\S]*const safePassword = typeof password === 'string' \? password\.trim\(\) : '';[\s\S]*Diary author not found[\s\S]*Diary password required[\s\S]*UPDATE characters SET diary_password = \? WHERE id = \?'\)\.run\(safePassword, authorId\)/, 'diary password writes should reject ghost authors and blank passwords');
    assert.match(dbSource, /function verifyAndUnlockDiary\(characterId, inputPassword\)[\s\S]*const authorId = String\(characterId \|\| ''\)\.trim\(\);[\s\S]*const password = typeof inputPassword === 'string' \? inputPassword\.trim\(\) : '';[\s\S]*if \(!password\) return \{ success: false, reason: 'No password provided\.' \};[\s\S]*if \(!authorId\) return \{ success: false, reason: 'Character not found\.' \};[\s\S]*WHERE id = \?'\)\.get\(authorId\)[\s\S]*WHERE id = \?'\)\.run\(authorId\)/, 'diary unlock verification should normalize character ids and reject non-string or blank passwords before writes');

    assert.match(serverIndex, /const moment = db\.getMoment\(req\.params\.id\);[\s\S]*String\(moment\.character_id \|\| ''\) !== 'user'[\s\S]*Only user moments can be deleted here/, 'moment delete route should only delete user-authored moments');
    assert.match(serverIndex, /app\.post\('\/api\/moments'[\s\S]*const momentContent = typeof content === 'string' \? content\.trim\(\) : '';[\s\S]*if \(!momentContent\) return res\.status\(400\)\.json\(\{ error: 'content required' \}\);[\s\S]*const imageUrl = typeof image_url === 'string' \? image_url\.trim\(\) : '';[\s\S]*db\.addMoment\('user', momentContent, imageUrl \|\| null\)/, 'user moment posts should reject non-string or blank content and store trimmed text');
    assert.doesNotMatch(serverIndex, /db\.addMoment\('user', content, image_url \|\| null\)/, 'user moment posts must not pass raw body content to DB writes');
    assert.match(serverIndex, /const deleted = db\.deleteMoment\(moment\.id\);[\s\S]*if \(!deleted\) return res\.status\(404\)/, 'moment delete route should not report success for missing rows');
    assert.doesNotMatch(serverIndex, /db\.deleteMoment\(req\.params\.id\)/, 'moment delete route must not delete arbitrary raw route ids');
    assert.match(serverIndex, /app\.get\('\/api\/moments\/:characterId'[\s\S]*const char = db\.getCharacter\(req\.params\.characterId\);[\s\S]*if \(!char\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*if \(char && char\.is_blocked\) return res\.json\(\[\]\)/, 'character moment reads should reject missing characters while preserving blocked-character empty feeds');
    assert.match(serverIndex, /const moment = db\.getMoment\(req\.params\.id\);[\s\S]*const liked = db\.toggleLike\(moment\.id, 'user'\)/, 'moment likes should validate the target before writing');
    assert.doesNotMatch(serverIndex, /db\.toggleLike\(req\.params\.id, 'user'\)/, 'moment likes must not write against raw route ids');
    assert.match(serverIndex, /const comment = String\(content \|\| ''\)\.trim\(\);[\s\S]*const moment = db\.getMoment\(req\.params\.id\);[\s\S]*db\.addComment\(moment\.id, 'user', comment\)/, 'moment comments should trim content and validate the target before writing');
    assert.doesNotMatch(serverIndex, /db\.addComment\(req\.params\.id, 'user', content\)/, 'moment comments must not write against raw route ids');
    assert.match(serverIndex, /app\.get\('\/api\/diaries\/:characterId'[\s\S]*const char = db\.getCharacter\(req\.params\.characterId\);[\s\S]*if \(!char\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*isUnlocked: char\.is_diary_unlocked === 1/, 'diary reads should reject missing characters instead of returning a locked empty diary');
    assert.match(serverIndex, /const deleted = db\.deleteDiary\(req\.params\.id\);[\s\S]*if \(!deleted\) return res\.status\(404\)\.json\(\{ error: 'Diary not found' \}\)/, 'diary deletes should not report success for missing rows');
    assert.match(serverIndex, /app\.post\('\/api\/diaries\/:characterId\/unlock'[\s\S]*const character = db\.getCharacter\(req\.params\.characterId\);[\s\S]*if \(!character\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*const password = typeof req\.body\?\.password === 'string' \? req\.body\.password\.trim\(\) : '';[\s\S]*db\.verifyAndUnlockDiary\(character\.id, password\)/, 'diary unlock should reject missing characters and non-string passwords before verification');
    assert.doesNotMatch(serverIndex, /db\.verifyAndUnlockDiary\(req\.params\.characterId, password\)/, 'diary unlock must not verify raw ghost character ids');

    assert.match(engineSource, /db\.addComment\(parseInt\(mCommentMatch\[1\], 10\), character\.id, mCommentMatch\[2\]\.trim\(\)\);[\s\S]*broadcastEvent\(wsClients, \{ type: 'moment_update' \}\)/, 'private AI moment comments should notify the moment feed through the websocket event channel');
    assert.doesNotMatch(engineSource, /broadcastNewMessage\(wsClients, \{ type: 'moment_update' \}\)/, 'moment updates must not be wrapped as malformed new_message payloads');
    assert.match(engineSource, /const pw = diaryPwMatch\[1\]\.trim\(\);[\s\S]*console\.log\(`\[Engine\] \$\{charCheck\.name\} set a diary password\.`\);[\s\S]*db\.setDiaryPassword\(character\.id, pw\)/, 'private diary password tags should avoid logging the generated password value');
    assert.doesNotMatch(engineSource, /set a diary password: \$\{pw\}/, 'private diary password logs must not expose the generated password');
    assert.match(engineSource, /function validateGeneratedMomentInteractions\(text\)[\s\S]*MOMENT_LIKE:[\s\S]*AI returned invalid moment like target[\s\S]*MOMENT_COMMENT:[\s\S]*AI returned invalid moment comment target/, 'private AI moment interactions should validate targets before writes');
    assert.match(engineSource, /validateGeneratedMomentInteractions\(generatedText\);[\s\S]*\/\/ Check for self-scheduled timer tags like \[TIMER: 60\]/, 'private AI moment interaction validation should run before other tag side effects');
    assert.match(groupChat, /function broadcastMomentUpdate\(wsClients\)[\s\S]*JSON\.stringify\(\{ type: 'moment_update' \}\)/, 'group AI moment side effects should have a shared moment update notifier');
    assert.match(groupChat, /function validateGeneratedMomentInteractions\(db, text\)[\s\S]*Group AI returned invalid moment like target[\s\S]*Group AI returned invalid moment comment target/, 'group AI moment interactions should validate targets before writes');
    assert.match(groupChat, /validateGeneratedMomentInteractions\(db, cleanReply\);[\s\S]*Parse \[CHAR_AFFINITY/, 'group AI moment interaction validation should run before group tag side effects');
    assert.match(groupChat, /db\.addMoment\(char\.id, momentMatch\[1\]\.trim\(\)\);[\s\S]*broadcastMomentUpdate\(wsClients\)/, 'group AI moment posts should refresh the moment feed');
    assert.match(groupChat, /db\.toggleLike\(parseInt\(mLikeMatch\[1\], 10\), char\.id\);[\s\S]*broadcastMomentUpdate\(wsClients\)/, 'group AI moment likes should refresh the moment feed');
    assert.match(groupChat, /db\.addComment\(parseInt\(mCommentMatch\[1\], 10\), char\.id, mCommentMatch\[2\]\.trim\(\)\);[\s\S]*broadcastMomentUpdate\(wsClients\)/, 'group AI moment comments should refresh the moment feed');
});

test('red packet creation rejects invalid money and count values before wallet writes', () => {
    const economyPlugin = readRepoFile('server', 'plugins', 'economy', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(economyPlugin, /function normalizePositiveMoney\(value\)/, 'red packet API should normalize positive money values');
    assert.match(economyPlugin, /function normalizePaymentNote\(value\)/, 'red packet API should share note validation with transfers');
    assert.match(economyPlugin, /function normalizePacketCount\(value\)/, 'red packet API should normalize bounded counts');
    assert.match(economyPlugin, /function normalizePacketCount\(value\)[\s\S]*String\(value \?\? ''\)\.trim\(\)[\s\S]*\/\^\\d\+\$\/\.test\(text\)/, 'red packet API should reject non-integer count strings');
    assert.match(economyPlugin, /!\['fixed', 'lucky'\]\.includes\(packetType\) \|\| !packetCount/, 'red packet API should reject invalid types and counts');
    assert.match(economyPlugin, /if \(!total \|\| total <= 0 \|\| Math\.round\(total \* 100\) < packetCount\)/, 'red packet API should reject zero, negative, non-finite, and underfunded totals');
    assert.match(economyPlugin, /const noteText = normalizePaymentNote\(note\);[\s\S]*if \(noteText === null\) return res\.status\(400\)\.json\(\{ error: 'Invalid note' \}\)[\s\S]*note: noteText/, 'red packet API should reject non-string notes before DB writes');
    assert.match(economyPlugin, /perAmount \? \+\(perAmount \* packetCount\)\.toFixed\(2\) : null/, 'fixed red packet totals should be derived from validated positive per-person amounts');
    assert.doesNotMatch(economyPlugin, /Number\.parseInt\(value, 10\)/, 'red packet API must not accept partial count strings');
    assert.doesNotMatch(economyPlugin, /parseFloat\(total_amount\)\.toFixed\(2\)/, 'red packet API must not accept raw total_amount parsing without validation');
    assert.doesNotMatch(economyPlugin, /parseFloat\(per_amount\) \* parseInt\(count\)/, 'red packet API must not multiply raw amount/count values');

    assert.match(dbSource, /function generateLuckyAmounts\(total, count\)[\s\S]*totalCents < count[\s\S]*红包金额不足以分配/, 'lucky red packets should reject totals too small to give every claim a cent');
    assert.match(dbSource, /function normalizeRedPacketCount\(value\)[\s\S]*String\(value \?\? ''\)\.trim\(\)[\s\S]*\/\^\\d\+\$\/\.test\(text\)/, 'DB red packet creation should reject partial count strings');
    assert.match(dbSource, /if \(!Number\.isFinite\(packetTotal\) \|\| packetTotal <= 0\) throw new Error\('红包金额无效'\)/, 'DB red packet creation should reject invalid totals');
    assert.match(dbSource, /const packetCount = normalizeRedPacketCount\(count\);[\s\S]*if \(packetCount == null\) throw new Error\('红包个数无效'\)/, 'DB red packet creation should reject unsafe counts');
    assert.match(dbSource, /function createRedPacket\(\{ groupId, senderId, type, totalAmount, perAmount, count, note \}\)[\s\S]*const safeNote = normalizePaymentNote\(note\)[\s\S]*\.run\(cleanGroupId, cleanSenderId, packetType, normalizedTotal, normalizedPerAmount, packetCount, packetCount, JSON\.stringify\(amounts\), safeNote, Date\.now\(\)\)/, 'DB red packet creation should persist normalized notes');
    assert.doesNotMatch(dbSource, /Number\.parseInt\(count, 10\)/, 'DB red packet creation must not accept partial count strings');
    assert.match(dbSource, /if \(packetType === 'fixed' && \(!Number\.isFinite\(packetPerAmount\) \|\| packetPerAmount <= 0\)\) throw new Error\('红包金额无效'\)/, 'DB fixed red packet creation should reject invalid per-person amounts');
    assert.match(dbSource, /packetPerCents \* packetCount !== packetTotalCents/, 'fixed red packet DB writes should reject totals that do not match per-person amount times count');
    assert.match(dbSource, /SELECT 1 FROM group_chats WHERE id = \? LIMIT 1/, 'DB red packet creation should reject missing groups before wallet writes');
    assert.match(dbSource, /SELECT 1 FROM group_members WHERE group_id = \? AND member_id = \? LIMIT 1/, 'DB red packet creation should reject character senders outside the group');
    assert.match(dbSource, /bal < normalizedTotal/, 'wallet balance checks should use validated normalized totals');
    assert.doesNotMatch(dbSource, /bal < totalAmount/, 'wallet balance checks must not use raw totalAmount values');
});

test('red packet routes scope packets to the route group', () => {
    const economyPlugin = readRepoFile('server', 'plugins', 'economy', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');
    const getStart = economyPlugin.indexOf("app.get('/api/groups/:id/redpackets/:pid'");
    const claimStart = economyPlugin.indexOf("app.post('/api/groups/:id/redpackets/:pid/claim'", getStart);
    const endStart = economyPlugin.indexOf("console.log('[Economy DLC]", claimStart);

    assert.notEqual(getStart, -1, 'red packet detail route should exist');
    assert.notEqual(claimStart, -1, 'red packet claim route should exist');
    assert.notEqual(endStart, -1, 'economy route registration footer should exist');
    const getRoute = economyPlugin.slice(getStart, claimStart);
    const claimRoute = economyPlugin.slice(claimStart, endStart);

    assert.match(economyPlugin, /function normalizeRedPacketId\(value\)[\s\S]*Number\.isSafeInteger\(id\) && id > 0/, 'red packet routes should validate packet ids');
    assert.match(getRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)/, 'red packet details should reject missing groups');
    assert.match(getRoute, /const packetId = normalizeRedPacketId\(req\.params\.pid\);[\s\S]*if \(!packetId\) return res\.status\(400\)\.json\(\{ error: 'Invalid red packet id' \}\)/, 'red packet details should reject invalid packet ids');
    assert.match(getRoute, /if \(String\(pkt\.group_id\) !== String\(group\.id\)\) \{[\s\S]*Red packet not found/, 'red packet details should not expose packets from another group');
    assert.match(claimRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)/, 'red packet claims should reject missing groups');
    assert.match(claimRoute, /const packetId = normalizeRedPacketId\(req\.params\.pid\);[\s\S]*if \(!packetId\) return res\.status\(400\)\.json\(\{ error: 'Invalid red packet id' \}\)/, 'red packet claims should reject invalid packet ids');
    assert.match(claimRoute, /db\.claimRedPacket\(packetId, claimer_id, group\.id\)/, 'red packet claims should pass the route group to the DB');
    assert.match(claimRoute, /group_id: group\.id/, 'red packet claim broadcasts should use the resolved group id');

    assert.match(dbSource, /function claimRedPacket\(packetId, claimerId, groupId = null\)/, 'DB red packet claims should accept an optional group scope');
    assert.match(dbSource, /groupId !== null && String\(pkt\.group_id\) !== String\(groupId\)/, 'DB red packet claims should reject packets outside the supplied group');
    assert.match(dbSource, /红包金额异常/, 'DB red packet claims should reject corrupted stored packet amounts before wallet writes');
});

test('user profile numeric settings are bounded before persistence', () => {
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(dbSource, /function normalizeUserProfilePatch\(data\)/, 'profile numeric normalization should be isolated from the update query');
    assert.match(dbSource, /normalizedData\.group_msg_limit = normalizeProfileInteger\(normalizedData\.group_msg_limit, 20, 1, 200\)/, 'group context limits should be bounded');
    assert.match(dbSource, /normalizedData\.group_skip_rate = normalizeProfileNumber\(normalizedData\.group_skip_rate, 0, 0, 1\)/, 'group skip rates should stay in decimal probability bounds');
    assert.match(dbSource, /normalizedData\.group_proactive_enabled = normalizeProfileBoolean\(normalizedData\.group_proactive_enabled, 0\)/, 'group proactive toggle should persist as a boolean flag');
    assert.match(dbSource, /normalizedData\.group_interval_min = normalizeProfileInteger\(normalizedData\.group_interval_min, 10, 1, 1440\)/, 'group interval minimum should stay inside timer-safe bounds');
    assert.match(dbSource, /normalizedData\.group_interval_max = normalizeProfileInteger\(normalizedData\.group_interval_max, 60, 1, 1440\)/, 'group interval maximum should stay inside timer-safe bounds');
    assert.match(dbSource, /normalizedData\.group_interval_max = normalizedData\.group_interval_min/, 'profile updates should not persist max intervals lower than min intervals');
    assert.match(dbSource, /normalizedData\.wallet = \+normalizeProfileNumber\(normalizedData\.wallet, 0, 0, 1000000000\)\.toFixed\(2\)/, 'user wallet profile edits should reject negative and non-finite money');
    assert.match(dbSource, /normalizedData\.private_msg_limit_for_group = normalizeProfileInteger\(normalizedData\.private_msg_limit_for_group, 3, 0, 50\)/, 'private context limits should be bounded');
    assert.match(dbSource, /normalizedData\.moments_token_limit = normalizeProfileInteger\(normalizedData\.moments_token_limit, 500, 0, 10000\)/, 'moments token limits should match UI bounds');
    assert.match(dbSource, /const normalizedData = normalizeUserProfilePatch\(data\)/, 'profile updates should use the normalized patch before persistence');
});

test('manual memory inputs reject invalid ids and maintenance settings', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const memoryMaintenanceService = readRepoFile('server', 'memoryMaintenanceService.js');
    const memoryGuardsSource = readRepoFile('server', 'memoryInputGuards.js');
    const guards = require(path.join(repoRoot, 'server', 'memoryInputGuards.js'));
    const smallModelParserStart = memoryMaintenanceService.indexOf('function extractJsonObjectFromText');
    const smallModelParserEnd = memoryMaintenanceService.indexOf('function hasCjkText', smallModelParserStart);
    assert.notEqual(smallModelParserStart, -1, 'server should keep a small-model JSON parser');
    assert.notEqual(smallModelParserEnd, -1, 'small-model JSON parser should have a stable end marker');
    const smallModelParser = memoryMaintenanceService.slice(smallModelParserStart, smallModelParserEnd);

    assert.match(memoryGuardsSource, /const MEMORY_BULK_MAX_IDS = 10000/, 'manual memory bulk operations should keep an explicit id cap');
    assert.match(memoryGuardsSource, /class MemoryInputValidationError extends Error/, 'memory input validation should expose typed bad requests');
    assert.match(memoryGuardsSource, /function normalizeMemoryIdList\(value, options = \{\}\)/, 'memory bulk id normalization should be centralized');
    assert.match(memoryGuardsSource, /function normalizeMemoryMaintenanceSettingsPatch\(body = \{\}\)/, 'memory maintenance settings validation should be centralized');
    assert.match(memoryGuardsSource, /function normalizeMemoryMaintenanceBatchOptions\(input = \{\}, defaults = \{\}\)/, 'memory maintenance batch query validation should be centralized');
    assert.match(memoryGuardsSource, /function normalizeMemoryMaintenanceAutoRunControls\(input = \{\}, defaults = \{\}\)/, 'memory maintenance auto-run controls should be centralized');
    assert.match(memoryGuardsSource, /function normalizeMemoryMaintenanceLibraryOptions\(query = \{\}\)/, 'memory library query validation should be centralized');
    assert.match(memoryGuardsSource, /MEMORY_MAINTENANCE_MAX_BATCHES_MAX = 10000/, 'memory maintenance auto-runs should have an explicit batch cap');
    assert.match(memoryGuardsSource, /MEMORY_LIBRARY_TIMELINE_LIMIT_MAX = 3000/, 'memory library timeline limits should have an explicit cap');
    assert.match(memoryGuardsSource, /batch_size[\s\S]*MEMORY_MAINTENANCE_BATCH_MIN[\s\S]*MEMORY_MAINTENANCE_BATCH_MAX/, 'memory maintenance batch size should be range checked');
    assert.match(memoryGuardsSource, /max_output_tokens[\s\S]*MEMORY_MAINTENANCE_TOKENS_MIN[\s\S]*MEMORY_MAINTENANCE_TOKENS_MAX/, 'memory maintenance token budget should be range checked');

    assert.match(memoryMaintenanceService, /normalizeMemoryMaintenanceSettingsPatch\(safeBody\)/, 'settings route should use the shared memory settings guard');
    assert.match(serverIndex, /normalizeMemoryMaintenanceBatchOptions\(req\.query \|\| \{\}, \{ limitFallback: 30 \}\)/, 'memory maintenance batch route should validate query limits and offsets');
    assert.match(serverIndex, /normalizeMemoryMaintenanceBatchOptions\(req\.query \|\| \{\}, \{ limitFallback: 40 \}\)/, 'memory temporal-binding batch route should validate query limits and offsets');
    assert.match(serverIndex, /normalizeOptionalMemoryId\(req\.body\?\.continue_import_id \|\| req\.body\?\.import_id, 'import_id'\)/, 'external import auto-run should validate continuation import ids');
    assert.match(serverIndex, /normalizeMemoryMaintenanceAutoRunControls\(\{[\s\S]*\.\.\.req\.body,[\s\S]*limit: batchOptions\.limit[\s\S]*missingMaxBatchesMeansAll: true/, 'external import auto-run should validate numeric controls while preserving run-until-empty defaults');
    assert.match(serverIndex, /normalizeMemoryMaintenanceAutoRunControls\(req\.body \|\| \{\}, \{[\s\S]*maxBatchesFallback: 10/, 'memory maintenance auto-run should validate numeric controls before queueing');
    assert.match(serverIndex, /const options = normalizeMemoryMaintenanceLibraryOptions\(req\.query \|\| \{\}\)/, 'memory library route should validate query options before building SQL');
    assert.match(serverIndex, /if \(options\.character_id && !req\.db\.getCharacter\(options\.character_id\)\)[\s\S]*Character not found/, 'memory library route should reject ghost character filters');
    assert.match(serverIndex, /res\.status\(e\.status \|\| 500\)\.json\(\{ error: e\.message \}\)/, 'memory validation failures should return 400 rather than 500');
    assert.match(serverIndex, /const ids = normalizeMemoryIdList\(req\.body\?\.ids\)/, 'manual memory bulk routes should reject malformed id arrays');
    assert.match(serverIndex, /const memoryId = normalizeMemoryId\(req\.params\.id\)/, 'manual memory single-item routes should reject malformed route ids');
    assert.match(smallModelParser, /const parsed = JSON\.parse\(raw\)[\s\S]*Array\.isArray\(parsed\)/, 'small-model maintenance parser should require the full cleaned reply to be a JSON object');
    assert.doesNotMatch(smallModelParser, /indexOf\('\{'\)|lastIndexOf\('\}'\)|raw\.slice\(/, 'small-model maintenance parser must not slice JSON out of malformed model text');
    assert.doesNotMatch(serverIndex, /Number\(req\.body\?\.limit \|\| settings\.batch_size/, 'memory maintenance routes must not silently replace invalid run limits with defaults');
    assert.doesNotMatch(serverIndex, /Math\.floor\(Number\(req\.body\?\.max_rerolls/, 'memory maintenance routes must not loosely parse reroll counts');
    assert.doesNotMatch(serverIndex, /MEMORY_BULK_MAX_IDS/, 'server index should not own memory bulk id guard constants');
    assert.doesNotMatch(serverIndex, /parseInt\(body\.batch_size, 10\) \|\| 30/, 'memory settings must not silently replace invalid batch sizes with defaults');
    assert.doesNotMatch(serverIndex, /parseInt\(body\.max_output_tokens, 10\) \|\| 8000/, 'memory settings must not silently replace invalid token budgets with defaults');

    assert.deepEqual(guards.normalizeMemoryIdList(['2', 2, 3]), [2, 3], 'bulk ids should normalize and de-duplicate valid numeric strings');
    assert.throws(
        () => guards.normalizeMemoryId('1.5'),
        /Memory id must be a positive safe integer/,
        'fractional route memory ids should be rejected'
    );
    assert.throws(
        () => guards.normalizeMemoryIdList([1, 0]),
        /Memory id must be a positive safe integer/,
        'bulk memory ids should reject zero rather than silently filtering it'
    );
    assert.throws(
        () => guards.normalizeMemoryIdList(new Array(10001).fill(1).map((_, idx) => idx + 1)),
        /Too many memory ids/,
        'bulk memory operations should reject overlarge id lists'
    );
    assert.equal(
        guards.normalizeMemoryMaintenanceSettingsPatch({ batch_size: '50', max_output_tokens: 4000 }).memory_maintenance_batch_size,
        50,
        'valid memory maintenance batch sizes should normalize to integers'
    );
    assert.throws(
        () => guards.normalizeMemoryMaintenanceSettingsPatch({ batch_size: 'oops' }),
        /batch_size must be an integer/,
        'invalid memory maintenance batch sizes should be rejected'
    );
    assert.throws(
        () => guards.normalizeMemoryMaintenanceSettingsPatch({ max_output_tokens: Infinity }),
        /max_output_tokens must be an integer/,
        'non-finite memory maintenance token budgets should be rejected'
    );
    assert.throws(
        () => guards.normalizeMemoryMaintenanceBatchOptions({ limit: '20x' }, { limitFallback: 30 }),
        /limit must be an integer/,
        'memory maintenance batch limits should reject loose numeric input'
    );
    assert.throws(
        () => guards.normalizeMemoryMaintenanceBatchOptions({ offset: -1 }, { limitFallback: 30 }),
        /offset must be an integer/,
        'memory maintenance offsets should reject negative values'
    );
    assert.throws(
        () => guards.normalizeMemoryMaintenanceAutoRunControls({ max_batches: Infinity }, { maxBatchesFallback: 10 }),
        /max_batches must be an integer/,
        'memory maintenance max_batches should reject non-finite values'
    );
    assert.equal(
        guards.normalizeMemoryMaintenanceAutoRunControls({ max_batches: 'all' }, { maxBatchesFallback: 10 }).max_batches,
        null,
        'memory maintenance max_batches=all should keep run-until-empty semantics'
    );
    assert.throws(
        () => guards.normalizeMemoryMaintenanceLibraryOptions({ limit_per_group: '1abc' }),
        /limit_per_group must be an integer/,
        'memory library group limits should reject loose numeric input'
    );
    assert.throws(
        () => guards.normalizeMemoryMaintenanceLibraryOptions({ timeline_limit: Infinity }),
        /timeline_limit must be an integer/,
        'memory library timeline limits should reject non-finite values'
    );
    assert.equal(
        guards.normalizeMemoryMaintenanceLibraryOptions({ character_id: ' c1 ', limit_per_group: '12' }).limit_per_group,
        12,
        'memory library limits should normalize valid numeric strings'
    );
});

test('memory maintenance library stats can run from the service module', () => {
    const Database = require('better-sqlite3');
    const {
        getMemoryMaintenanceOverview,
        getMemoryMaintenanceLibrary,
        getExpiredForgettingMemoryRows
    } = require(path.join(repoRoot, 'server', 'memoryMaintenanceService.js'));
    const db = new Database(':memory:');
    try {
        db.exec(`
            CREATE TABLE characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                avatar TEXT DEFAULT ''
            );
            CREATE TABLE memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id TEXT NOT NULL,
                time TEXT,
                location TEXT,
                people TEXT,
                event TEXT NOT NULL,
                relationships TEXT,
                items TEXT,
                importance INTEGER DEFAULT 5,
                embedding BLOB,
                created_at INTEGER NOT NULL,
                last_retrieved_at INTEGER,
                retrieval_count INTEGER DEFAULT 0,
                group_id TEXT DEFAULT NULL,
                memory_type TEXT DEFAULT 'event',
                summary TEXT DEFAULT '',
                content TEXT DEFAULT '',
                people_json TEXT DEFAULT '[]',
                items_json TEXT DEFAULT '[]',
                relationship_json TEXT DEFAULT '[]',
                emotion TEXT DEFAULT '',
                source_message_ids_json TEXT DEFAULT '[]',
                dedupe_key TEXT DEFAULT '',
                updated_at INTEGER DEFAULT 0,
                is_archived INTEGER DEFAULT 0,
                source_started_at INTEGER DEFAULT 0,
                source_ended_at INTEGER DEFAULT 0,
                source_time_text TEXT DEFAULT '',
                source_message_count INTEGER DEFAULT 0,
                memory_tier TEXT DEFAULT 'ambient',
                memory_focus TEXT DEFAULT 'general',
                maintenance_status TEXT DEFAULT 'pending',
                classification_source TEXT DEFAULT '',
                classified_at INTEGER DEFAULT 0,
                retention_score REAL DEFAULT 1,
                retention_action TEXT DEFAULT '',
                retention_reason TEXT DEFAULT '',
                retention_checked_at INTEGER DEFAULT 0,
                consolidation_key TEXT DEFAULT '',
                consolidation_summary TEXT DEFAULT '',
                consolidated_into_memory_id INTEGER DEFAULT 0,
                archive_reason TEXT DEFAULT '',
                forgetting_grace_started_at INTEGER DEFAULT 0,
                forgetting_grace_expires_at INTEGER DEFAULT 0,
                source_context TEXT DEFAULT '',
                scene_tag TEXT DEFAULT '',
                source_app TEXT DEFAULT '',
                temporal_label TEXT DEFAULT '',
                temporal_scope TEXT DEFAULT '',
                temporal_anchor TEXT DEFAULT '',
                temporal_confidence REAL DEFAULT 0,
                temporal_reason TEXT DEFAULT '',
                temporal_checked_at INTEGER DEFAULT 0
            );
        `);
        const now = Date.now();
        const old = now - 120 * 24 * 60 * 60 * 1000;
        db.prepare('INSERT INTO characters (id, name, avatar) VALUES (?, ?, ?)').run('char-a', '测试角色', '');
        db.prepare(`
            INSERT INTO memories (
                character_id, event, summary, content, importance, created_at, updated_at,
                memory_type, memory_focus, memory_tier, maintenance_status,
                consolidation_key, consolidation_summary, temporal_label, temporal_confidence,
                source_started_at, source_ended_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            'char-a',
            'memory_event',
            '测试摘要',
            '测试内容',
            6,
            old,
            old,
            'event',
            'general',
            'ambient',
            'classified',
            'test-key',
            '测试正式记忆',
            'single_event_state',
            0.9,
            old,
            old
        );
        db.prepare(`
            UPDATE memories
            SET forgetting_grace_started_at = ?,
                forgetting_grace_expires_at = ?
            WHERE id = 1
        `).run(now - 2 * 24 * 60 * 60 * 1000, now - 24 * 60 * 60 * 1000);

        const overview = getMemoryMaintenanceOverview(db);
        const library = getMemoryMaintenanceLibrary(db, {
            source: 'new',
            timeline_filter: 'all',
            timeline_all: '1'
        });
        const expiredRows = getExpiredForgettingMemoryRows(db, { now, limit: 10 });

        assert.equal(overview.totals.legacy_total, 1);
        assert.equal(overview.totals.migrated_card_total, 1);
        assert.equal(overview.totals.formal_total, 1);
        assert.equal(library.new_library.total, 1);
        assert.equal(library.new_library.source_total, 1);
        assert.equal(library.timeline.count, 1);
        assert.equal(expiredRows.length, 1);
        assert.equal(expiredRows[0].id, 1);
    } finally {
        db.close();
    }
});

test('expired forgetting buffers are auto-purged by memory routes and scheduler', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const memorySource = readRepoFile('server', 'memory.js');
    const schedulerSource = readRepoFile('server', 'plugins', 'scheduler', 'index.js');

    assert.match(memorySource, /async function purgeExpiredForgettingMemories\(options = \{\}\)[\s\S]*getExpiredForgettingMemoryRows/, 'memory module should expose an automatic expired forgetting purge');
    assert.match(memorySource, /deleteMemoryIndexEntries\(characterId, memoryIds\)[\s\S]*db\.deleteMemory\(row\.id\)[\s\S]*refreshMemoryIndexEntries\(characterId, memoryIds/, 'auto-forget should delete vector entries, remove DB rows, then refresh grouped index cards');
    assert.match(serverIndex, /async function purgeExpiredForgettingMemoriesForRequest\(req, source = 'memory-maintenance'\)/, 'memory maintenance reads should run expired forgetting cleanup first');
    assert.match(serverIndex, /app\.get\('\/api\/memory-maintenance\/overview'[\s\S]*await purgeExpiredForgettingMemoriesForRequest\(req, 'memory-maintenance-overview'\)/, 'overview should trigger expired forgetting cleanup');
    assert.match(serverIndex, /app\.get\('\/api\/memory-maintenance\/library'[\s\S]*await purgeExpiredForgettingMemoriesForRequest\(req, 'memory-maintenance-library'\)/, 'library should trigger expired forgetting cleanup');
    assert.match(schedulerSource, /memory\.purgeExpiredForgettingMemories\(\{[\s\S]*minIntervalMs: 10 \* 60 \* 1000/, 'scheduler should periodically purge expired forgetting buffers with a cooldown');
});

test('memory db updates only write whitelisted memory columns', () => {
    const dbSource = readRepoFile('server', 'db.js');
    const memorySource = readRepoFile('server', 'memory.js');

    assert.match(dbSource, /const MEMORY_UPDATE_COLUMNS = new Set\(\[/, 'memory DB updates should use an explicit column allow-list');
    assert.match(dbSource, /function getAllowedMemoryUpdateFields\(patch = \{\}\)/, 'memory update field filtering should be isolated');
    assert.match(dbSource, /Object\.keys\(patch\)\.filter\(field => MEMORY_UPDATE_COLUMNS\.has\(field\)\)/, 'memory updates should drop non-table helper fields before SQL generation');
    assert.match(dbSource, /const memoryId = Number\(id\);[\s\S]*!Number\.isSafeInteger\(memoryId\) \|\| memoryId <= 0/, 'memory DB updates should reject invalid ids defensively');
    assert.match(dbSource, /No valid memory fields provided\./, 'memory DB updates should reject unknown-only patches');
    assert.match(dbSource, /Array\.from\(new Set\(\[\.\.\.allowedFields, 'updated_at'\]\)\)/, 'memory updates should still bump updated_at after field filtering');
    assert.match(dbSource, /return db\.prepare\(`UPDATE memories SET \$\{setClause\} WHERE id = \?`\)\.run\(\.\.\.values, memoryId\)/, 'memory DB updates should run against the normalized memory id');
    assert.doesNotMatch(dbSource, /const fields = Object\.keys\(patch\);\s*const setClause = fields\.map\(f => `\$\{f\} = \?`\)/, 'memory DB updates must not build SQL columns from raw patch keys');
    assert.doesNotMatch(dbSource, /'surprise_score'/, 'memory DB allow-list must not include non-table helper fields from normalized memory payloads');
    assert.match(memorySource, /surprise_score: Math\.max\(1, Math\.min\(10, Number\(rawMemoryData\.surprise_score\) \|\| importance\)\)/, 'memory normalization still carries surprise_score as an internal helper field');
});

test('group conversation digest failures do not persist fallback memory results', () => {
    const memorySource = readRepoFile('server', 'memory.js');
    const updateStart = memorySource.indexOf('async function updateGroupConversationDigest');
    const updateEnd = memorySource.indexOf('function parseMemoryArrayFromResponse', updateStart);
    assert.notEqual(updateStart, -1, 'group digest updater should exist');
    assert.notEqual(updateEnd, -1, 'group digest updater should have a stable end marker');
    const updateBlock = memorySource.slice(updateStart, updateEnd);

    assert.match(updateBlock, /const cleaned = String\(responseText \|\| ''\)[\s\S]*replace\(\/```\(\?:json\)\?\\s\*\/gi, ''\)[\s\S]*const parsed = JSON\.parse\(cleaned\)/, 'group digest updater should parse the full cleaned model JSON');
    assert.match(updateBlock, /if \(!cleaned\) \{[\s\S]*throw new Error\('群聊上下文总结模型没有返回 JSON。'\)/, 'empty group digest model output should fail visibly');
    assert.match(updateBlock, /if \(!normalized\.digest_text\) \{[\s\S]*throw new Error\('群聊上下文总结缺少 digest_text。'\)/, 'empty generated group digest should fail visibly');
    assert.match(updateBlock, /throw new Error\(`群聊上下文总结失败，请检查记忆小模型后重试：\$\{errorText\}`\)/, 'group digest model failures should propagate to the caller');
    assert.match(updateBlock, /db\.upsertGroupConversationDigest\?\.\(\{[\s\S]*digest_text: normalized\.digest_text/, 'group digest should only write normalized generated output');
    assert.doesNotMatch(memorySource, /function buildFallbackGroupConversationDigest|function buildFallbackConversationDigest|persistFallback|fallbackDigest/, 'memory digest fallback builders should not remain available for accidental fake results');
    assert.doesNotMatch(updateBlock, /responseText\.slice\(startIdx, endIdx \+ 1\)|indexOf\('\{'\)|lastIndexOf\('\}'\)/, 'group digest updater must not slice JSON out of malformed model text');
});

test('memory generation parsers require full JSON before persistence', () => {
    const memorySource = readRepoFile('server', 'memory.js');
    const extractStart = memorySource.indexOf('async function extractMemoryFromContext');
    const extractEnd = memorySource.indexOf('async function extractHiddenState', extractStart);
    const arrayParserStart = memorySource.indexOf('function parseMemoryArrayFromResponse');
    const arrayParserEnd = memorySource.indexOf('async function aggregateDailyMemoriesChunked', arrayParserStart);
    const sweepStart = memorySource.indexOf('async function sweepOverflowMemories');
    const sweepEnd = memorySource.indexOf('async function saveExtractedMemory', sweepStart);
    assert.notEqual(extractStart, -1, 'immediate memory extractor should exist');
    assert.notEqual(extractEnd, -1, 'immediate memory extractor should have a stable end marker');
    assert.notEqual(arrayParserStart, -1, 'memory array parser should exist');
    assert.notEqual(arrayParserEnd, -1, 'memory array parser should have a stable end marker');
    assert.notEqual(sweepStart, -1, 'memory sweep should exist');
    assert.notEqual(sweepEnd, -1, 'memory sweep should have a stable end marker');
    const extractBlock = memorySource.slice(extractStart, extractEnd);
    const arrayParserBlock = memorySource.slice(arrayParserStart, arrayParserEnd);
    const sweepBlock = memorySource.slice(sweepStart, sweepEnd);

    assert.match(memorySource, /function cleanMemoryJsonReply\(responseText\)[\s\S]*replace\(\/```\(\?:json\)\?\\s\*\/gi, ''\)/, 'memory JSON cleanup should only strip code fences');
    assert.match(memorySource, /function parseStrictMemoryJsonObject\(responseText[\s\S]*const parsed = JSON\.parse\(cleaned\)[\s\S]*Array\.isArray\(parsed\)/, 'memory object parser should require a full JSON object');
    assert.match(memorySource, /function parseStrictMemoryJsonArray\(responseText[\s\S]*const parsed = JSON\.parse\(cleaned\)[\s\S]*!Array\.isArray\(parsed\)/, 'memory array parser should require a full JSON array');
    assert.match(extractBlock, /const parsed = parseStrictMemoryJsonObject\(responseText, 'Memory extraction'\)/, 'immediate memory extraction should validate full JSON before saveExtractedMemory');
    assert.match(arrayParserBlock, /return parseStrictMemoryJsonArray\(responseText, 'Memory aggregation'\)/, 'daily memory aggregation should use the strict array parser');
    assert.match(sweepBlock, /parsed = parseStrictMemoryJsonObject\(responseText, 'Memory sweep'\)/, 'memory sweep should validate full JSON before collecting memories');
    assert.doesNotMatch(memorySource, /responseText\.slice\(startIdx, endIdx \+ 1\)|responseText\.indexOf\('\{'\)|responseText\.lastIndexOf\('\}'\)|responseText\.indexOf\('\['\)|responseText\.lastIndexOf\('\]'\)/, 'memory generation paths must not slice JSON out of malformed model text');
});

test('character settings are normalized before character writes', () => {
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(dbSource, /function normalizeCharacterPatch\(data, existing = null\)/, 'character setting normalization should be centralized');
    assert.match(dbSource, /if \(!existing && !String\(normalizedData\.name \|\| ''\)\.trim\(\)\) \{[\s\S]*Character name is required\./, 'DB character creation should reject nameless rows before INSERT');
    assert.match(dbSource, /max_tokens: \[2000, 100, 20000\]/, 'character max output tokens should be bounded');
    assert.match(dbSource, /sweep_limit: \[30, 10, 100\]/, 'memory sweep W limits should match drawer bounds');
    assert.match(dbSource, /impression_q_limit: \[3, 0, 10\]/, 'impression Q limits should match drawer bounds');
    assert.match(dbSource, /context_msg_limit: \[60, 10, 200\]/, 'private context window limits should match drawer bounds');
    assert.match(dbSource, /private_summary_threshold: \[30, 5, 100\]/, 'private summary thresholds should match drawer bounds');
    assert.match(dbSource, /city_action_frequency: \[1, 1, 30\]/, 'city action frequency should match drawer bounds');
    assert.match(dbSource, /if \(hasCharacterPatchField\(normalizedData, 'pressure_level'\)\) \{[\s\S]*normalizeCharacterInteger\(existing\?\.pressure_level, 0, 0, 4\)[\s\S]*0,\s*4/, 'character pressure level should stay in the scheduler 0..4 range');
    assert.doesNotMatch(dbSource, /pressure_level: 0,[\s\S]*for \(const \[field, fallback\] of Object\.entries\(boundedPercentFields\)\)/, 'pressure level must not be normalized as a 0..100 percent field');
    assert.match(dbSource, /normalizedData\.wallet = normalizeCharacterNumber\(normalizedData\.wallet,[\s\S]*0, 1000000000\)/, 'character wallet edits should reject negative and non-finite values');
    assert.match(dbSource, /normalizedData\.calories = normalizeCharacterInteger\(normalizedData\.calories,[\s\S]*0, 4000\)/, 'character calorie edits should stay inside city calorie bounds');
    assert.match(dbSource, /if \(nextMax < nextMin\) \{[\s\S]*normalizedData\.interval_max = nextMin/, 'character proactive max interval should not persist below min interval');
    assert.match(dbSource, /const normalizedData = normalizeCharacterPatch\(data, existing\)/, 'character writes should normalize before building SQL values');
    assert.match(dbSource, /const fields = Object\.keys\(normalizedData\)\.filter/, 'character writes should derive fields from the normalized patch');
    assert.match(dbSource, /const values = fields\.map\(f => normalizedData\[f\]\)/, 'character writes should persist normalized values');
    assert.match(dbSource, /const startAffinity = fields\.includes\('affinity'\) \? normalizedData\.affinity : 50/, 'new character initial affinity should snapshot normalized affinity');
    assert.doesNotMatch(dbSource, /const values = fields\.map\(f => data\[f\]\)/, 'character writes must not persist raw request numeric values');
});

test('character lifecycle routes reject missing targets before destructive work', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const deleteRouteStart = serverIndex.indexOf("app.delete('/api/characters/:id'");
    const deleteRoute = deleteRouteStart >= 0 ? serverIndex.slice(deleteRouteStart, deleteRouteStart + 3800) : '';

    assert.match(serverIndex, /app\.put\('\/api\/characters\/:id'[\s\S]*const prevCharacter = typeof db\.getCharacter === 'function' \? db\.getCharacter\(id\) : null;[\s\S]*if \(!prevCharacter\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)/, 'partial character updates should not create missing characters');
    assert.match(serverIndex, /app\.delete\('\/api\/messages\/:characterId'[\s\S]*const character = typeof db\.getCharacter === 'function' \? db\.getCharacter\(characterId\) : null;[\s\S]*if \(!character\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)/, 'legacy message clear should reject missing characters');
    assert.match(serverIndex, /app\.delete\('\/api\/data\/:characterId'[\s\S]*const char = db\.getCharacter\(id\);[\s\S]*if \(!char\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*engine\.stopTimer\(id\)/, 'deep wipe should reject missing characters before timers, vector wipes, or DB writes');
    assert.match(serverIndex, /if \(!existing && \(!includeCharacter \|\| !payload\.character\)\) \{[\s\S]*Target character does not exist, and the archive cannot create it with the current import options/, 'archive import should not write orphan rows when skip_character targets a missing character');
    assert.match(serverIndex, /if \(!existing && !String\(payload\.character\?\.name \|\| ''\)\.trim\(\)\) \{[\s\S]*Archive character name is required to create a missing target character/, 'archive import should require a character name before creating a missing target');
    assert.match(serverIndex, /Character archive import failed:[\s\S]*res\.status\(e\.status \|\| 500\)\.json\(\{ error: e\.message \}\)/, 'archive import should preserve validation status codes from DB guards');
    assert.match(serverIndex, /app\.delete\('\/api\/characters\/:id'[\s\S]*const charToDelete = db\.getCharacter\(charId\);[\s\S]*if \(!charToDelete\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*engine\.stopTimer\(charId\)/, 'character delete should reject missing characters before timer and index cleanup');
    assert.match(deleteRoute, /const deletedMentionMemoryRows = \[\]/, 'character delete should collect cross-character memories that mention the deleted character');
    assert.match(deleteRoute, /deletedMentionMemoryRows\.push\(mem\)/, 'character delete should defer cross-character memory deletion until index targets are collected');
    assert.match(deleteRoute, /const deletedMentionIndexTargets = buildMemoryIndexTargets\(db, deletedMentionMemoryRows\)/, 'character delete should derive all vector index targets before deleting SQL rows');
    assert.match(deleteRoute, /await memory\.deleteMemoryIndexEntries\(targetCharacterId, memoryIds\)[\s\S]*for \(const mem of deletedMentionMemoryRows\) \{[\s\S]*db\.deleteMemory\(mem\.id\)[\s\S]*await memory\.refreshMemoryIndexEntries\(targetCharacterId, memoryIds/, 'character delete should remove stale vector entries and refresh affected characters when cross-character memories are deleted');
});

test('character deletion clears plugin and diagnostic rows tied to the character', () => {
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(dbSource, /function runOptionalDelete\(sql, \.\.\.params\)/, 'optional plugin cleanup should tolerate tables that are not installed yet');
    assert.match(dbSource, /function deleteExternalKnowledgeDocsForCharacter\(characterId\)[\s\S]*SELECT id FROM external_knowledge_docs WHERE character_id = \?[\s\S]*DELETE FROM external_knowledge_chunks WHERE doc_id IN[\s\S]*DELETE FROM external_knowledge_docs WHERE character_id = \?/, 'character deletion should remove MCP Lab knowledge docs and chunks bound to the deleted character');
    assert.match(dbSource, /function deleteCharacterAttachedRows\(characterId\)[\s\S]*DELETE FROM message_tts WHERE character_id = \?[\s\S]*DELETE FROM message_tts WHERE message_id IN \(SELECT id FROM messages WHERE character_id = \?\)/, 'character deletion should remove direct and message-derived TTS rows before messages are deleted');
    assert.match(dbSource, /function deleteCharacterAttachedRows\(characterId\)[\s\S]*DELETE FROM emotion_logs WHERE character_id = \?[\s\S]*DELETE FROM llm_debug_logs WHERE character_id = \?[\s\S]*DELETE FROM reply_dispatch_logs WHERE character_id = \?[\s\S]*DELETE FROM token_usage WHERE character_id = \?/, 'character deletion should remove diagnostic and token rows for the deleted character');
    assert.match(dbSource, /function deleteCharacterAttachedRows\(characterId\)[\s\S]*DELETE FROM scheduled_tasks WHERE character_id = \?[\s\S]*DELETE FROM city_character_courses WHERE character_id = \?/, 'character deletion should remove scheduler tasks and city growth progress for the deleted character');
    assert.match(dbSource, /function deleteCharacterAttachedRows\(characterId\)[\s\S]*DELETE FROM city_logs WHERE character_id = \?[\s\S]*DELETE FROM city_inventory WHERE character_id = \?[\s\S]*DELETE FROM city_quest_progress_reviews WHERE character_id = \?[\s\S]*DELETE FROM city_quest_claims WHERE character_id = \?/, 'character deletion should remove city runtime, inventory, and quest rows for the deleted character');
    assert.match(dbSource, /function deleteCharacterAttachedRows\(characterId\)[\s\S]*DELETE FROM social_housing_bindings WHERE character_id = \?/, 'character deletion should remove social housing bindings for the deleted character');
    assert.match(dbSource, /function deleteCharacterAttachedRows\(characterId\)[\s\S]*DELETE FROM social_housing_rental_chain_events WHERE chain_id IN \(SELECT id FROM social_housing_rental_chains WHERE character_id = \?\)[\s\S]*DELETE FROM social_housing_rental_chains WHERE character_id = \?/, 'character deletion should remove social housing rental chains and their events for the deleted character');
    assert.match(dbSource, /function deleteCharacter\(id\) \{[\s\S]*deleteCharacterAttachedRows\(id\);[\s\S]*DELETE FROM messages WHERE character_id = \?/, 'character deletion should run attached-row cleanup before deleting message rows');
});

test('group message batch deletion is constrained to the route group', () => {
    const groupChatPlugin = readRepoFile('server', 'plugins', 'groupChat', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(groupChatPlugin, /db\.deleteGroupMessages\(group\.id, messageIds\)/, 'group batch delete route should pass the resolved group id to the DB');
    assert.match(dbSource, /function deleteGroupMessages\(groupId, messageIds\)/, 'DB helper should require a group id for batch group message deletion');
    assert.match(dbSource, /filter\(id => Number\.isSafeInteger\(id\) && id > 0\)/, 'DB helper should normalize message ids before building the placeholder list');
    assert.match(dbSource, /DELETE FROM group_messages WHERE group_id = \? AND id IN/, 'DB helper should constrain deletion by group_id and message id');
    assert.doesNotMatch(dbSource, /DELETE FROM group_messages WHERE id IN/, 'DB helper must not delete group messages by id alone');
});

test('group message writes require an existing group and valid sender membership', () => {
    const groupChatPlugin = readRepoFile('server', 'plugins', 'groupChat', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');
    const deleteMemberStart = groupChatPlugin.indexOf("app.delete('/api/groups/:id/members/:memberId'");
    const deleteGroupStart = groupChatPlugin.indexOf("app.delete('/api/groups/:id'", deleteMemberStart);

    assert.notEqual(deleteMemberStart, -1, 'group member delete route should exist');
    assert.notEqual(deleteGroupStart, -1, 'group delete route should follow member delete route');
    const deleteMemberRoute = groupChatPlugin.slice(deleteMemberStart, deleteGroupStart);

    assert.match(dbSource, /function addGroupMessage\(groupId, senderId, content, senderName = null, senderAvatar = null, metadata = null\)[\s\S]*const targetGroupId = String\(groupId \|\| ''\)\.trim\(\)/, 'DB group messages should normalize group ids before writes');
    assert.match(dbSource, /const safeContent = typeof content === 'string' \? content : ''/, 'DB group messages should reject non-string content instead of coercing objects');
    assert.match(dbSource, /!safeContent\.trim\(\)[\s\S]*Group message content required\./, 'DB group messages should reject blank content before inserts');
    assert.match(dbSource, /SELECT 1 FROM group_chats WHERE id = \? LIMIT 1/, 'DB group messages should verify that the group exists');
    assert.match(dbSource, /cleanSenderId !== 'user' && cleanSenderId !== 'system'/, 'DB group messages should reserve user and system sender ids');
    assert.match(dbSource, /SELECT 1 FROM characters WHERE id = \? LIMIT 1/, 'DB group messages should verify character senders exist');
    assert.match(dbSource, /SELECT 1 FROM group_members WHERE group_id = \? AND member_id = \? LIMIT 1/, 'DB group messages should verify character senders are group members');
    assert.match(dbSource, /\.run\(targetGroupId, cleanSenderId, safeContent, Date\.now\(\), senderName, senderAvatar, metadataStr\)/, 'metadata group message inserts should use normalized ids and content');
    assert.match(dbSource, /\.run\(targetGroupId, cleanSenderId, safeContent, Date\.now\(\), senderName, senderAvatar\)/, 'legacy group message inserts should use normalized ids and content');
    assert.doesNotMatch(dbSource, /\.run\(targetGroupId, cleanSenderId, content, Date\.now\(\)/, 'group message inserts must not write raw content values');

    assert.match(deleteMemberRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)/, 'member deletion should reject missing groups before system messages');
    assert.match(deleteMemberRoute, /const memberId = String\(req\.params\.memberId \|\| ''\)\.trim\(\)/, 'member deletion should normalize route member ids');
    assert.match(deleteMemberRoute, /if \(!memberId \|\| memberId === 'user'\) return res\.status\(400\)\.json\(\{ error: 'Invalid group member id' \}\)/, 'member deletion should not remove the reserved user member');
    assert.match(deleteMemberRoute, /const isMember = group\.members\.some\(m => String\(m\.member_id\) === memberId\)/, 'member deletion should verify membership before announcing removal');
    assert.match(deleteMemberRoute, /if \(!isMember\) return res\.status\(404\)\.json\(\{ error: 'Group member not found' \}\)/, 'member deletion should not announce nonexistent memberships');
    assert.match(deleteMemberRoute, /db\.removeGroupMember\(req\.params\.id, memberId\)/, 'member deletion should remove the normalized member id');
    assert.match(deleteMemberRoute, /res\.status\(e\.status \|\| 500\)/, 'member deletion should preserve DB validation status codes');
});

test('group state changes reject missing and duplicate targets before side effects', () => {
    const groupChatPlugin = readRepoFile('server', 'plugins', 'groupChat', 'index.js');
    const addMemberStart = groupChatPlugin.indexOf("app.post('/api/groups/:id/members'");
    const removeMemberStart = groupChatPlugin.indexOf("app.delete('/api/groups/:id/members/:memberId'", addMemberStart);
    const deleteGroupStart = groupChatPlugin.indexOf("app.delete('/api/groups/:id'", removeMemberStart);
    const clearGroupStart = groupChatPlugin.indexOf("app.delete('/api/groups/:id/messages'", deleteGroupStart);
    const batchDeleteStart = groupChatPlugin.indexOf("app.post('/api/groups/:id/messages/batch-delete'", clearGroupStart);
    const debounceStart = groupChatPlugin.indexOf('// Group Chat Debounce System', batchDeleteStart);
    const aiPausePostStart = groupChatPlugin.indexOf("app.post('/api/groups/:id/ai-pause'", debounceStart);
    const aiPauseGetStart = groupChatPlugin.indexOf("app.get('/api/groups/:id/ai-pause'", aiPausePostStart);
    const noChainPostStart = groupChatPlugin.indexOf("app.post('/api/groups/:id/no-chain'", aiPauseGetStart);
    const noChainGetStart = groupChatPlugin.indexOf("app.get('/api/groups/:id/no-chain'", noChainPostStart);
    const triggerGroupStart = groupChatPlugin.indexOf('function triggerGroupAIChain', noChainGetStart);

    assert.notEqual(addMemberStart, -1, 'add member route should exist');
    assert.notEqual(removeMemberStart, -1, 'remove member route should exist');
    assert.notEqual(deleteGroupStart, -1, 'delete group route should exist');
    assert.notEqual(clearGroupStart, -1, 'clear group messages route should exist');
    assert.notEqual(batchDeleteStart, -1, 'batch delete route should exist');
    assert.notEqual(debounceStart, -1, 'debounce section should follow group state routes');
    assert.notEqual(aiPausePostStart, -1, 'group AI pause POST route should exist');
    assert.notEqual(aiPauseGetStart, -1, 'group AI pause GET route should exist');
    assert.notEqual(noChainPostStart, -1, 'group no-chain POST route should exist');
    assert.notEqual(noChainGetStart, -1, 'group no-chain GET route should exist');
    assert.notEqual(triggerGroupStart, -1, 'group AI trigger should follow state routes');

    const addMemberRoute = groupChatPlugin.slice(addMemberStart, removeMemberStart);
    const deleteGroupRoute = groupChatPlugin.slice(deleteGroupStart, clearGroupStart);
    const clearGroupRoute = groupChatPlugin.slice(clearGroupStart, batchDeleteStart);
    const batchDeleteRoute = groupChatPlugin.slice(batchDeleteStart, debounceStart);
    const runtimeStateSection = groupChatPlugin.slice(debounceStart, aiPausePostStart);
    const aiPausePostRoute = groupChatPlugin.slice(aiPausePostStart, aiPauseGetStart);
    const aiPauseGetRoute = groupChatPlugin.slice(aiPauseGetStart, noChainPostStart);
    const noChainPostRoute = groupChatPlugin.slice(noChainPostStart, noChainGetStart);
    const noChainGetRoute = groupChatPlugin.slice(noChainGetStart, triggerGroupStart);

    assert.match(addMemberRoute, /const alreadyMember = group\.members\.some\(m => String\(m\.member_id\) === memberId\)/, 'member addition should detect duplicates before system announcements');
    assert.match(addMemberRoute, /if \(alreadyMember\) return res\.status\(409\)\.json\(\{ error: 'Group member already exists' \}\)/, 'duplicate member additions should return conflict');
    assert.match(addMemberRoute, /const added = db\.addGroupMember\(req\.params\.id, memberId\);[\s\S]*if \(!added\) return res\.status\(400\)\.json\(\{ error: 'Unable to add group member' \}\)/, 'member addition should not announce if the DB write was ignored');

    assert.match(deleteGroupRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)[\s\S]*db\.deleteGroup\(group\.id\)/, 'group deletion should reject missing groups before reporting success');
    assert.match(deleteGroupRoute, /engine\.stopGroupProactiveTimer\(group\.id\)[\s\S]*db\.deleteGroup\(group\.id\)/, 'group deletion should stop engine-owned proactive timers before deleting the group');
    assert.match(deleteGroupRoute, /clearGroupRuntimeState\(req\.user\.id, group\.id\)/, 'group deletion should clear transient pause/debounce/no-chain state');
    assert.match(clearGroupRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)[\s\S]*db\.clearGroupMessages\(group\.id\)/, 'group message clearing should reject missing groups before reporting success');
    assert.match(batchDeleteRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)[\s\S]*db\.deleteGroupMessages\(group\.id, messageIds\)/, 'group message batch deletion should reject missing groups before reporting success');

    assert.match(runtimeStateSection, /function clearGroupRuntimeState\(userId, groupId\)[\s\S]*const id = getGroupRuntimeKey\(userId, groupId\)[\s\S]*pausedGroups\.delete\(id\)[\s\S]*noChainGroups\.delete\(id\)[\s\S]*delete groupPendingMentions\[id\]/, 'group runtime state cleanup should cover pause, no-chain, debounce, locks, and pending mentions');
    assert.match(aiPausePostRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)[\s\S]*const id = getGroupRuntimeKey\(req\.user\.id, group\.id\)/, 'AI pause writes should reject missing groups and use user-scoped runtime ids');
    assert.match(aiPausePostRoute, /String\(requestedPause\)\.toLowerCase\(\) === 'true'/, 'AI pause writes should parse explicit string booleans instead of treating every non-empty string as paused');
    assert.match(aiPausePostRoute, /engine\.scheduleGroupProactive\(group\.id, wsClients\)/, 'unpausing group AI should restart the engine timer with the raw group id');
    assert.match(aiPausePostRoute, /engine\.stopGroupProactiveTimer\(group\.id\)/, 'pausing group AI should stop the engine timer with the raw group id');
    assert.doesNotMatch(aiPausePostRoute, /engine\.(?:scheduleGroupProactive|stopGroupProactiveTimer)\(id\b/, 'engine proactive timers must not receive user-scoped runtime keys');
    assert.match(aiPauseGetRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)[\s\S]*pausedGroups\.has\(getGroupRuntimeKey\(req\.user\.id, group\.id\)\)/, 'AI pause reads should reject missing groups');
    assert.match(noChainPostRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)[\s\S]*const id = getGroupRuntimeKey\(req\.user\.id, group\.id\)/, 'no-chain writes should reject missing groups and use user-scoped runtime ids');
    assert.match(noChainGetRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)[\s\S]*noChainGroups\.has\(getGroupRuntimeKey\(req\.user\.id, group\.id\)\)/, 'no-chain reads should reject missing groups');
});

test('group proactive timer handles do not survive deletion or firing', () => {
    const groupChatPlugin = readRepoFile('server', 'plugins', 'groupChat', 'index.js');
    const engineSource = readRepoFile('server', 'engine.js');
    const deleteGroupStart = groupChatPlugin.indexOf("app.delete('/api/groups/:id'");
    const clearGroupStart = groupChatPlugin.indexOf("app.delete('/api/groups/:id/messages'", deleteGroupStart);

    assert.notEqual(deleteGroupStart, -1, 'delete group route should exist');
    assert.notEqual(clearGroupStart, -1, 'clear messages route should follow delete group route');
    const deleteGroupRoute = groupChatPlugin.slice(deleteGroupStart, clearGroupStart);

    assert.match(deleteGroupRoute, /engine\.stopGroupProactiveTimer\(group\.id\)/, 'deleting a group should cancel engine-owned proactive timers');
    assert.match(engineSource, /function scheduleGroupProactive\(groupId, wsClients\)[\s\S]*const handle = setTimeout\(\(\) => \{[\s\S]*groupProactiveTimers\.delete\(groupId\);[\s\S]*queueEngineTask/, 'expired group proactive timers should remove their map handle before queueing work');
    assert.match(engineSource, /function stopGroupProactiveTimer\(groupId\)[\s\S]*clearTimeout\(groupProactiveTimers\.get\(groupId\)\);[\s\S]*groupProactiveTimers\.delete\(groupId\)/, 'explicit group timer stops should clear timeout handles and map entries');
});

test('group message reads reject missing groups and invalid limits', () => {
    const groupChatPlugin = readRepoFile('server', 'plugins', 'groupChat', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');
    const routeStart = groupChatPlugin.indexOf("app.get('/api/groups/:id/messages'");
    const nextRouteStart = groupChatPlugin.indexOf("app.post('/api/groups/:id/members'", routeStart);

    assert.notEqual(routeStart, -1, 'group message read route should exist');
    assert.notEqual(nextRouteStart, -1, 'group member route should follow group message reads');
    const readRoute = groupChatPlugin.slice(routeStart, nextRouteStart);

    assert.match(groupChatPlugin, /function normalizeGroupMessageLimit\(value\)[\s\S]*if \(value === undefined\) return 100[\s\S]*!Number\.isSafeInteger\(parsed\) \|\| parsed <= 0/, 'group message route should centralize limit validation');
    assert.match(readRoute, /const group = db\.getGroup\(req\.params\.id\);[\s\S]*if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)/, 'group message reads should reject missing groups');
    assert.match(readRoute, /const limit = normalizeGroupMessageLimit\(req\.query\.limit\);[\s\S]*if \(!limit\) return res\.status\(400\)\.json\(\{ error: 'Invalid message limit' \}\)/, 'group message reads should reject negative, decimal, or nonnumeric limits');
    assert.match(readRoute, /res\.json\(db\.getGroupMessages\(group\.id, limit\)\)/, 'group message reads should query with the normalized group id and bounded limit');
    assert.doesNotMatch(readRoute, /parseInt\(req\.query\.limit\) \|\| 100/, 'group message reads must not allow LIMIT -1 to return all rows');

    assert.match(dbSource, /function normalizeGroupMessageQueryLimit\(value, fallback = 100, max = 200\)[\s\S]*!Number\.isSafeInteger\(parsed\) \|\| parsed <= 0\) return fallback/, 'DB group message reads should defensively normalize SQL limits');
    assert.match(dbSource, /function getGroupMessages\(groupId, limit = 100\)[\s\S]*const targetGroupId = String\(groupId \|\| ''\)\.trim\(\)[\s\S]*const safeLimit = normalizeGroupMessageQueryLimit\(limit, 100, 200\)[\s\S]*all\(targetGroupId, safeLimit\)/, 'DB getGroupMessages should not pass raw limits to SQLite');
});

test('group settings reject invalid numeric limits before persistence', () => {
    const groupChatPlugin = readRepoFile('server', 'plugins', 'groupChat', 'index.js');

    assert.match(groupChatPlugin, /function normalizeGroupIntegerSetting\(value, min, max\)/, 'group setting numeric validation should be centralized');
    assert.match(groupChatPlugin, /!Number\.isSafeInteger\(parsed\) \|\| parsed < min \|\| parsed > max/, 'group setting limits should reject NaN, Infinity, decimals, and out-of-range values');
    assert.match(groupChatPlugin, /const injectLimit = normalizeGroupIntegerSetting\(inject_limit, 0, 30\)/, 'group injection limit should match the frontend slider bounds');
    assert.match(groupChatPlugin, /return res\.status\(400\)\.json\(\{ error: 'Invalid inject limit' \}\)/, 'invalid group injection limits should return 400');
    assert.match(groupChatPlugin, /const contextLimit = normalizeGroupIntegerSetting\(context_msg_limit, 10, 200\)/, 'group context window should match the frontend slider bounds');
    assert.match(groupChatPlugin, /return res\.status\(400\)\.json\(\{ error: 'Invalid context message limit' \}\)/, 'invalid group context limits should return 400');
    assert.match(groupChatPlugin, /function normalizeGroupName\(value\)[\s\S]*typeof value !== 'string'[\s\S]*return value\.trim\(\)/, 'group name validation should reject non-string values instead of coercing objects');
    assert.match(groupChatPlugin, /const groupName = normalizeGroupName\(name\)/, 'group create and update routes should normalize names through the shared helper');
    assert.match(groupChatPlugin, /return res\.status\(400\)\.json\(\{ error: 'Invalid group name' \}\)/, 'invalid group names should return 400 during updates');
    assert.doesNotMatch(groupChatPlugin, /const groupName = String\(name \|\| ''\)\.trim\(\)/, 'group names must not coerce request objects into persisted text');
    assert.doesNotMatch(groupChatPlugin, /Math\.max\(0, parseInt\(inject_limit\) \|\| 0\)/, 'group injection limit must not persist raw parsed values');
    assert.doesNotMatch(groupChatPlugin, /Math\.max\(1, parseInt\(context_msg_limit\) \|\| 60\)/, 'group context limit must not persist raw parsed values');
    assert.doesNotMatch(groupChatPlugin, /name !== undefined && name\.trim\(\)/, 'group name updates must not call trim on non-string values');
});

test('scheduler tasks validate time, action, character, and batch fields before writes', () => {
    const schedulerIndex = readRepoFile('server', 'plugins', 'scheduler', 'index.js');
    const schedulerDb = readRepoFile('server', 'plugins', 'scheduler', 'db.js');
    const inputGuards = readRepoFile('server', 'plugins', 'scheduler', 'inputGuards.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'scheduler', 'inputGuards.js'));

    assert.match(inputGuards, /SCHEDULER_ACTION_TYPES = new Set\(\['chat', 'moment', 'diary', 'memory_aggregation'\]\)/, 'scheduler action types should be constrained to implemented actions');
    assert.match(inputGuards, /function normalizeSchedulerTaskPayload\(payload = \{\}\)/, 'scheduler task validation should be centralized');
    assert.match(inputGuards, /normalizeSchedulerBatchSize,/, 'scheduler runtime should be able to reuse batch size validation');
    assert.match(inputGuards, /function normalizeSchedulerTaskId\(value\)[\s\S]*!Number\.isSafeInteger\(parsed\) \|\| parsed <= 0/, 'scheduler route ids should be strict positive integers');
    assert.match(inputGuards, /\^\(\?:\[01\]\\d\|2\[0-3\]\):\[0-5\]\\d\$/, 'scheduler cron times should be HH:MM only');
    assert.match(inputGuards, /!Number\.isSafeInteger\(parsed\) \|\| parsed < 10 \|\| parsed > 500/, 'scheduler memory batch sizes should reject NaN, Infinity, decimals, and out-of-range values');
    assert.match(inputGuards, /actionType === 'memory_aggregation'[\s\S]*normalizeSchedulerBatchSize\(payload\.batch_size, 80\)[\s\S]*: 80/, 'non-memory scheduler actions should not persist arbitrary batch sizes');

    assert.match(schedulerIndex, /const payload = normalizeSchedulerTaskPayload\(req\.body \|\| \{\}\)/, 'scheduler routes should validate payloads before DB writes');
    assert.match(schedulerIndex, /const taskId = normalizeSchedulerTaskId\(req\.params\.id\);[\s\S]*db\.updateTask\(taskId, payload\)/, 'scheduler updates should validate route ids before DB writes');
    assert.match(schedulerIndex, /const taskId = normalizeSchedulerTaskId\(req\.params\.id\);[\s\S]*db\.deleteTask\(taskId\)/, 'scheduler deletes should validate route ids before DB writes');
    assert.match(schedulerIndex, /router\.get\('\/scheduler\/:charId'[\s\S]*const userDb = getUserDb\(req\.user\.id\)[\s\S]*if \(charId !== 'all' && !userDb\.getCharacter\(charId\)\) \{[\s\S]*return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)/, 'scheduler task reads should reject ghost characters instead of returning an empty success');
    assert.match(schedulerIndex, /if \(!userDb\.getCharacter\(payload\.character_id\)\)/, 'scheduler routes should reject ghost character tasks');
    assert.match(schedulerIndex, /batchSize: normalizeSchedulerBatchSize\(task\.batch_size, 80\)/, 'scheduler runtime should reject corrupted stored memory batch sizes instead of silently defaulting');
    assert.match(schedulerIndex, /res\.status\(isSchedulerValidationError\(e\) \? 400 : 500\)/, 'scheduler validation failures should return 400');
    assert.doesNotMatch(schedulerIndex, /Math\.max\(10, Math\.min\(500, Number\(batch_size\) \|\| 80\)\)/, 'scheduler routes must not persist raw parsed batch sizes');
    assert.doesNotMatch(schedulerIndex, /Math\.max\(10, Math\.min\(500, Number\(task\.batch_size\) \|\| 80\)\)/, 'scheduler runtime must not loosely parse stored batch sizes');

    assert.match(schedulerDb, /addTask: \(taskOrCharId/, 'scheduler DB should accept normalized task objects');
    assert.match(schedulerDb, /function normalizeDbTaskId\(taskId\)[\s\S]*Number\.isSafeInteger\(parsed\) && parsed > 0/, 'scheduler DB should defensively normalize task ids');
    assert.match(schedulerDb, /updateTask: \(taskId[\s\S]*const id = normalizeDbTaskId\(taskId\);[\s\S]*if \(!id\) return false[\s\S]*, id\)/, 'scheduler DB updates should not pass raw task ids to SQLite');
    assert.match(schedulerDb, /deleteTask: \(taskId\)[\s\S]*const id = normalizeDbTaskId\(taskId\);[\s\S]*if \(!id\) return false[\s\S]*stmt\.run\(id\)/, 'scheduler DB deletes should not pass raw task ids to SQLite');
    assert.match(schedulerDb, /task\.is_enabled === 1 \? 1 : 0/, 'scheduler DB should persist normalized enabled flags');
    assert.match(schedulerDb, /return \(info\.changes \|\| 0\) > 0/, 'scheduler DB updates and deletes should report whether a task changed');
    assert.match(schedulerIndex, /if \(!updated\) return res\.status\(404\)\.json\(\{ error: 'Task not found' \}\)/, 'scheduler updates should not report success for missing tasks');
    assert.match(schedulerIndex, /if \(!deleted\) return res\.status\(404\)\.json\(\{ error: 'Task not found' \}\)/, 'scheduler deletes should not report success for missing tasks');

    assert.throws(
        () => guards.normalizeSchedulerTaskId('1abc'),
        /Invalid scheduler task id/,
        'loose scheduler route ids should be rejected'
    );
    assert.throws(
        () => guards.normalizeSchedulerTaskPayload({ character_id: 'c1', cron_expr: '25:00', action_type: 'chat' }),
        /Invalid scheduler time/,
        'invalid scheduler times should be rejected'
    );
    assert.throws(
        () => guards.normalizeSchedulerTaskPayload({ character_id: 'c1', cron_expr: '09:00', action_type: 'unknown' }),
        /Invalid scheduler action type/,
        'unknown scheduler actions should be rejected'
    );
    assert.throws(
        () => guards.normalizeSchedulerTaskPayload({ character_id: 'c1', cron_expr: '09:00', action_type: 'memory_aggregation', batch_size: 10.5 }),
        /Invalid scheduler batch size/,
        'decimal memory batch sizes should be rejected'
    );
    assert.equal(
        guards.normalizeSchedulerTaskPayload({ character_id: 'c1', cron_expr: '09:00', action_type: 'chat', batch_size: 500, is_enabled: 'false' }).batch_size,
        80,
        'chat tasks should ignore arbitrary batch sizes'
    );
});

test('background automation pauses for users who have not logged in recently', () => {
    const automationSource = readRepoFile('server', 'automationActivity.js');
    const schedulerSource = readRepoFile('server', 'plugins', 'scheduler', 'index.js');
    const citySource = readRepoFile('server', 'plugins', 'city', 'index.js');
    const socialHousingSource = readRepoFile('server', 'plugins', 'socialHousing', 'index.js');
    const automation = require(path.join(repoRoot, 'server', 'automationActivity.js'));
    const now = Date.now();
    const graceMs = automation.getAutomationIdleLoginGraceMs();

    assert.match(automationSource, /CP_AUTOMATION_IDLE_LOGIN_GRACE_DAYS/, 'automation idle grace should be configurable');
    assert.match(automationSource, /last_login_at/, 'automation eligibility should be based on explicit login time');
    assert.match(automationSource, /last_active_at/, 'automation eligibility should consider live user activity');
    assert.match(automationSource, /Math\.max\(lastLoginAt, lastActiveAt\)/, 'automation should use the newest login or activity timestamp');
    assert.equal(
        automation.isUserAutomationEligible({ id: 'u1', status: 'active', last_login_at: now - graceMs - 1, last_active_at: now - 1000 }, now),
        true,
        'active sessions should keep background automation eligible even after the original login ages out'
    );
    assert.equal(
        automation.isUserAutomationEligible({ id: 'u2', status: 'active', last_login_at: now - graceMs - 1, last_active_at: now - graceMs - 1 }, now),
        false,
        'background automation should still pause when both login and activity are stale'
    );
    assert.match(schedulerSource, /filterAutomationUsers\(authDb\.getAllUsers\(\), now\.getTime\(\)\)/, 'scheduler automation should skip stale-login users');
    assert.match(citySource, /filterAutomationUsers\(authDb\.getAllUsers\(\), Date\.now\(\)\)/, 'city automation should skip stale-login users');
    assert.ok(
        (socialHousingSource.match(/filterAutomationUsers\(authDb\.getAllUsers\(\), Date\.now\(\)\)/g) || []).length >= 2,
        'social housing automation loops should skip stale-login users'
    );
});

test('mcp lab validates task, fetch, and knowledge inputs before persistence', () => {
    const mcpLabIndex = readRepoFile('server', 'plugins', 'mcpLab', 'index.js');
    const mcpLabDb = readRepoFile('server', 'plugins', 'mcpLab', 'db.js');
    const inputGuards = readRepoFile('server', 'plugins', 'mcpLab', 'inputGuards.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'mcpLab', 'inputGuards.js'));

    assert.match(inputGuards, /MCP_TASK_KINDS = new Set\(\['web_search', 'private_web_search', 'city_web_search', 'fetch_url'\]\)/, 'MCP Lab task kinds should be constrained to implemented runTask kinds');
    assert.match(inputGuards, /MCP_SEARCH_PROVIDERS = new Set\(\['auto', 'duckduckgo', 'duckduckgo_instant_answer', 'serper', 'tavily', 'brave', 'bing'\]\)/, 'MCP Lab search providers should be constrained to known providers');
    assert.match(inputGuards, /function normalizeMcpTaskPayload\(payload = \{\}\)/, 'MCP Lab task payload validation should be centralized');
    assert.match(inputGuards, /function normalizeMcpTaskListOptions\(payload = \{\}\)/, 'MCP Lab task list validation should be centralized');
    assert.match(inputGuards, /function normalizeMcpKnowledgePayload\(payload = \{\}\)/, 'MCP Lab knowledge payload validation should be centralized');
    assert.match(inputGuards, /function normalizeMcpKnowledgeSearchPayload\(payload = \{\}\)/, 'MCP Lab knowledge search validation should be centralized');
    assert.match(inputGuards, /function normalizeMcpKnowledgeListOptions\(payload = \{\}\)/, 'MCP Lab knowledge list validation should be centralized');
    assert.match(inputGuards, /new URL\(String\(value \|\| ''\)\.trim\(\)\)/, 'MCP Lab URL validation should parse URLs before fetch/task persistence');
    assert.match(inputGuards, /!\['http:', 'https:'\]\.includes\(parsed\.protocol\)/, 'MCP Lab URL validation should reject non-http protocols');
    assert.match(inputGuards, /function isBlockedMcpFetchHost\(hostname\)/, 'MCP Lab URL validation should block local and private fetch targets');
    assert.match(inputGuards, /clean === 'localhost'[\s\S]*net\.isIP\(clean\)/, 'MCP Lab URL validation should inspect hostnames and IP literals before server-side fetches');
    assert.match(mcpLabIndex, /redirect: 'manual'/, 'MCP Lab server-side fetches should not auto-follow redirects to unvalidated targets');
    assert.match(inputGuards, /!Number\.isSafeInteger\(parsed\) \|\| parsed < min \|\| parsed > max/, 'MCP Lab numeric values should reject NaN, Infinity, decimals, and out-of-range values');

    assert.match(mcpLabIndex, /const payload = normalizeMcpSearchPayload\(req\.body \|\| \{\}\)/, 'MCP Lab direct search should validate query and provider before saving a task');
    assert.match(mcpLabIndex, /const url = normalizeMcpHttpUrl\(req\.body\?\.url\)/, 'MCP Lab fetch route should validate URLs before saving a task');
    assert.match(mcpLabIndex, /const payload = normalizeMcpTaskPayload\(req\.body \|\| \{\}\)/, 'MCP Lab generic task route should reject unsupported task kinds before persistence');
    assert.match(mcpLabIndex, /const options = normalizeMcpTaskListOptions\(req\.query \|\| \{\}\)[\s\S]*listTasks\(req\.user\?\.id \|\| '', options\.limit\)/, 'MCP Lab task list should validate limits before DB reads');
    assert.match(mcpLabIndex, /if \(!deleted\) return res\.status\(404\)\.json\(\{ success: false, error: 'Task not found\.' \}\)/, 'MCP Lab task deletes should not report success for missing tasks');
    assert.match(mcpLabIndex, /if \(payload\.character_id && !req\.db\.getCharacter\?\.\(payload\.character_id\)\)/, 'MCP Lab knowledge should reject ghost character bindings');
    assert.match(mcpLabIndex, /const options = normalizeMcpKnowledgeListOptions\(req\.query \|\| \{\}\)[\s\S]*if \(options\.character_id && !req\.db\.getCharacter\?\.\(options\.character_id\)\)[\s\S]*labDb\.listExternalKnowledgeDocs\(options\)/, 'MCP Lab knowledge list should validate limits and character filters before DB reads');
    assert.match(mcpLabIndex, /const payload = normalizeMcpKnowledgeSearchPayload\(req\.body \|\| \{\}\)[\s\S]*if \(payload\.character_id && !req\.db\.getCharacter\?\.\(payload\.character_id\)\)[\s\S]*labDb\.searchExternalKnowledge\(payload\.query, payload\)/, 'MCP Lab knowledge search should validate query, limit, and character filters before DB reads');
    assert.match(mcpLabIndex, /res\.status\(isMcpLabValidationError\(e\) \? 400 : 500\)/, 'MCP Lab validation failures should return 400');
    assert.doesNotMatch(mcpLabIndex, /const kind = String\(req\.body\?\.kind \|\| 'web_search'\)\.trim\(\)/, 'MCP Lab tasks must not persist raw task kinds');
    assert.doesNotMatch(mcpLabIndex, /const url = String\(req\.body\?\.url \|\| ''\)\.trim\(\)/, 'MCP Lab fetch must not persist raw URLs before validation');
    assert.doesNotMatch(mcpLabIndex, /searchExternalKnowledge\(req\.body\?\.query \|\| ''/, 'MCP Lab knowledge search must not pass raw body query and limit into DB');

    assert.match(mcpLabDb, /const \{ McpLabValidationError \} = require\('\.\/inputGuards'\)/, 'MCP Lab DB defensive validation should use the route-visible validation error type');
    assert.match(mcpLabDb, /function normalizeDbLimit\(value, fallback, max\)[\s\S]*!Number\.isSafeInteger\(parsed\) \|\| parsed <= 0 \|\| parsed > max[\s\S]*throw new McpLabValidationError\('Invalid numeric value'\)/, 'MCP Lab DB should defensively reject invalid list/search limits as a 400 validation error');
    assert.match(mcpLabDb, /function searchExternalKnowledge\(query, options = \{\}\)[\s\S]*const limit = normalizeDbLimit\(options\.limit \?\? 8, 8, 30\)/, 'MCP Lab knowledge search DB should not pass raw limits into slicing');
    assert.match(mcpLabDb, /function listExternalKnowledgeDocs\(options = \{\}\)[\s\S]*const limit = normalizeDbLimit\(options\.limit \?\? 30, 30, 100\)/, 'MCP Lab knowledge list DB should not pass raw limits to SQLite');
    assert.match(mcpLabDb, /function listTasks\(ownerId = '', limit = 80\)[\s\S]*const normalizedLimit = normalizeDbLimit\(limit \?\? 80, 80, 200\)/, 'MCP Lab task list DB should not pass raw limits to SQLite');

    assert.throws(
        () => guards.normalizeMcpTaskPayload({ kind: 'unknown', input: { query: 'x' } }),
        /Unsupported MCP Lab task kind/,
        'unsupported MCP task kinds should be rejected'
    );
    assert.throws(
        () => guards.normalizeMcpTaskPayload({ kind: 'fetch_url', input: { url: 'file:///etc/passwd' } }),
        /URL must be http or https/,
        'non-http fetch URLs should be rejected'
    );
    assert.throws(
        () => guards.normalizeMcpTaskPayload({ kind: 'fetch_url', input: { url: 'http://127.0.0.1:8000/api/auth/me' } }),
        /URL host is not allowed/,
        'loopback fetch URLs should be rejected'
    );
    assert.throws(
        () => guards.normalizeMcpKnowledgePayload({ content: 'x', source_url: 'http://169.254.169.254/latest/meta-data' }),
        /Source URL host is not allowed/,
        'metadata-service source URLs should be rejected'
    );
    assert.throws(
        () => guards.normalizeMcpSearchPayload({ query: 'x', provider: 'made_up' }),
        /Invalid web search provider/,
        'unknown search providers should be rejected'
    );
    assert.throws(
        () => guards.normalizeMcpKnowledgePayload({ content: '', source_url: 'https://example.com' }),
        /External knowledge content is required/,
        'empty external knowledge content should be rejected as bad input'
    );
    assert.throws(
        () => guards.normalizeMcpKnowledgeSearchPayload({ query: '', limit: 8 }),
        /Knowledge search query is required/,
        'blank knowledge search queries should be rejected as bad input'
    );
    assert.throws(
        () => guards.normalizeMcpKnowledgeSearchPayload({ query: 'x', limit: 31 }),
        /Invalid numeric value/,
        'overlarge knowledge search limits should be rejected as bad input'
    );
    assert.throws(
        () => guards.normalizeMcpTaskListOptions({ limit: '1abc' }),
        /Invalid numeric value/,
        'loose MCP task list limits should be rejected as bad input'
    );
    assert.equal(
        guards.normalizeMcpTaskPayload({ kind: 'web_search', input: { query: 'hello', fetch_page_limit: 5 } }).input.fetch_page_limit,
        5,
        'valid MCP search page limits should be preserved'
    );
    assert.equal(
        guards.normalizeMcpKnowledgeListOptions({ limit: '100' }).limit,
        100,
        'valid MCP knowledge list limits should be preserved'
    );
});

test('group member APIs reject ghost members before DB writes', () => {
    const groupChatPlugin = readRepoFile('server', 'plugins', 'groupChat', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(groupChatPlugin, /function normalizeGroupMemberIds\(value\)/, 'group routes should normalize member id arrays');
    assert.match(groupChatPlugin, /function getInvalidGroupMemberIds\(db, memberIds\)/, 'group routes should centralize member existence checks');
    assert.match(groupChatPlugin, /const invalidMemberIds = getInvalidGroupMemberIds\(db, memberIds\)/, 'group creation should validate every requested member');
    assert.match(groupChatPlugin, /return res\.status\(400\)\.json\(\{ error: 'Invalid group member ids'/, 'group creation should reject invalid members instead of filtering silently');
    assert.match(groupChatPlugin, /res\.status\(e\.status \|\| 500\)\.json\(\{ error: e\.message, invalid_member_ids: e\.invalid_member_ids \}\)/, 'group creation should preserve DB validation status codes');
    assert.match(groupChatPlugin, /const group = db\.getGroup\(req\.params\.id\)/, 'member addition should verify that the group exists first');
    assert.match(groupChatPlugin, /if \(!group\) return res\.status\(404\)\.json\(\{ error: 'Group not found' \}\)/, 'missing groups should return 404 before member writes');
    assert.match(groupChatPlugin, /memberId === 'user' \|\| !db\.getCharacter\(memberId\)/, 'member addition should reject reserved and nonexistent ids');
    assert.match(groupChatPlugin, /db\.addGroupMember\(req\.params\.id, memberId\)/, 'member addition should use the normalized member id');
    assert.doesNotMatch(groupChatPlugin, /db\.addGroupMember\(req\.params\.id, member_id\)/, 'member addition must not write raw request-body ids');

    assert.match(dbSource, /function createGroup\(id, name, memberIds, avatar = null\)[\s\S]*const groupId = typeof id === 'string' \? id\.trim\(\) : '';[\s\S]*const groupName = typeof name === 'string' \? name\.trim\(\) : ''/, 'DB group creation should reject non-string group ids and names');
    assert.match(dbSource, /if \(!groupId\)[\s\S]*Invalid group id\.[\s\S]*if \(!groupName\)[\s\S]*Invalid group name\./, 'DB group creation should reject blank ids and names');
    assert.match(dbSource, /const cleanMemberIds = Array\.from\(new Set\(\(Array\.isArray\(memberIds\) \? memberIds : \[\]\)/, 'DB group creation should normalize member arrays defensively');
    assert.match(dbSource, /const invalidMemberIds = cleanMemberIds\.filter\(mid => mid === 'user' \|\| !getCharacter\(mid\)\)/, 'DB group creation should reject reserved or ghost member ids instead of filtering silently');
    assert.match(dbSource, /cleanMemberIds\.length === 0 \|\| invalidMemberIds\.length > 0[\s\S]*Invalid group member ids\.[\s\S]*error\.invalid_member_ids = invalidMemberIds/, 'DB group creation should fail loudly when member ids are missing or invalid');
    assert.match(dbSource, /run\(groupId, groupName, safeAvatar \|\| null, Date\.now\(\)\)/, 'DB group creation should persist normalized group id, name, and avatar');
    assert.doesNotMatch(dbSource, /run\(id, name, avatar, Date\.now\(\)\)/, 'DB group creation must not persist raw group ids or names');
    assert.match(dbSource, /const cleanGroupId = String\(groupId \|\| ''\)\.trim\(\)/, 'DB addGroupMember should normalize a group id defensively');
    assert.match(dbSource, /const cleanMemberId = String\(memberId \|\| ''\)\.trim\(\)/, 'DB addGroupMember should normalize a single member id defensively');
    assert.match(dbSource, /if \(!cleanGroupId \|\| !cleanMemberId \|\| cleanMemberId === 'user'\) return 0/, 'DB addGroupMember should refuse blank group/member ids and reserved user');
    assert.match(dbSource, /SELECT 1 FROM group_chats WHERE id = \? LIMIT 1/, 'DB addGroupMember should reject missing groups before writing');
    assert.match(dbSource, /SELECT 1 FROM characters WHERE id = \? LIMIT 1/, 'DB addGroupMember should reject ghost characters before writing');
    assert.match(dbSource, /run\(cleanGroupId, cleanMemberId, role, Date\.now\(\)\)/, 'DB addGroupMember should write normalized ids');
});

test('group mentions resolve exact character names without prefix collisions', () => {
    const groupChatPlugin = readRepoFile('server', 'plugins', 'groupChat', 'index.js');

    assert.match(groupChatPlugin, /function resolveMentionedGroupCharacterIds\(db, members = \[\], text = '', options = \{\}\)/, 'group chat should centralize @ mention target resolution');
    assert.match(groupChatPlugin, /function isAsciiMentionContinuation\(char = ''\)/, 'mention matching should distinguish Claude from Claude4 style names');
    assert.match(groupChatPlugin, /resolveMentionedGroupCharacterIds\(db, group\.members, cleanReply, \{ selfId: char\.id \}\)/, 'AI-to-AI secondary chains should use strict mention resolution');
    assert.match(groupChatPlugin, /const mentionedIds = resolveMentionedGroupCharacterIds\(db, charMembers, content\)/, 'user group messages should use the same strict mention resolution');
    assert.doesNotMatch(groupChatPlugin, /cName\.includes\(n\) \|\| cNameNoSpace\.includes\(noSpace\) \|\| noSpace\.includes\(cNameNoSpace\)/, 'short character names must not match longer @mentions such as @Claude4.6opus');
});

test('relationship friend recommendations validate both characters before writes', () => {
    const relationships = readRepoFile('server', 'plugins', 'relationships', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(relationships, /app\.get\('\/api\/characters\/:id\/friends'[\s\S]*const sourceChar = db\.getCharacter\(req\.params\.id\);[\s\S]*if \(!sourceChar\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\);[\s\S]*db\.getFriends\(sourceChar\.id\)/, 'friend list reads should reject ghost source characters before returning an empty list');
    assert.doesNotMatch(relationships, /db\.getFriends\(req\.params\.id\)/, 'friend list reads should not query raw ghost source ids');
    assert.match(relationships, /app\.get\('\/api\/characters\/:id\/relationships'[\s\S]*const sourceChar = db\.getCharacter\(req\.params\.id\);[\s\S]*if \(!sourceChar\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\);[\s\S]*db\.getCharRelationships\(sourceChar\.id\)/, 'relationship list reads should reject ghost source characters before returning an empty list');
    assert.doesNotMatch(relationships, /db\.getCharRelationships\(req\.params\.id\)/, 'relationship list reads should not query raw ghost source ids');
    assert.match(relationships, /const targetId = String\(target_id \|\| ''\)\.trim\(\)/, 'friend recommendation route should normalize the target id');
    assert.match(relationships, /const sourceChar = db\.getCharacter\(req\.params\.id\)/, 'friend recommendation route should load the source character before writes');
    assert.match(relationships, /const targetChar = db\.getCharacter\(targetId\)/, 'friend recommendation route should load the target character before writes');
    assert.match(relationships, /if \(!sourceChar \|\| !targetChar\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)/, 'friend recommendation route should reject ghost source or target characters');
    assert.match(relationships, /const added = db\.addFriend\(sourceChar\.id, targetChar\.id\)/, 'friend recommendation route should write normalized existing character ids');
    assert.doesNotMatch(relationships, /db\.addFriend\(req\.params\.id, target_id\)/, 'friend recommendation route must not write raw route/body ids');

    assert.match(dbSource, /const sourceId = String\(char1Id \|\| ''\)\.trim\(\)/, 'DB addFriend should normalize the source id defensively');
    assert.match(dbSource, /const targetId = String\(char2Id \|\| ''\)\.trim\(\)/, 'DB addFriend should normalize the target id defensively');
    assert.match(dbSource, /if \(!sourceId \|\| !targetId \|\| sourceId === targetId\) return false/, 'DB addFriend should reject blank and self relationships');
    assert.match(dbSource, /if \(!getCharacter\(sourceId\) \|\| !getCharacter\(targetId\)\) return false/, 'DB addFriend should reject nonexistent characters before writing');
    assert.match(dbSource, /stmt\.run\(sourceId, targetId, now\)/, 'DB addFriend should write normalized ids');
});

test('character relationship writes reject ghost endpoints and invalid generated markers', () => {
    const dbSource = readRepoFile('server', 'db.js');
    const groupChat = readRepoFile('server', 'plugins', 'groupChat', 'index.js');
    const engine = readRepoFile('server', 'engine.js');

    assert.match(dbSource, /function normalizeCharRelationshipEndpoint\(value\)[\s\S]*if \(!id \|\| !getCharacter\(id\)\) return null/, 'character relationship endpoints should require real characters at the DB layer');
    assert.match(dbSource, /function initCharRelationship\(sourceId, targetId, affinity, impression, source = 'recommend'\)[\s\S]*if \(!cleanSourceId \|\| !cleanTargetId \|\| cleanSourceId === cleanTargetId\) return false/, 'initial relationship writes should reject blank, ghost, or self endpoints');
    assert.match(dbSource, /function getCharRelationship\(sourceId, targetId\)[\s\S]*const cleanSourceId = normalizeCharRelationshipEndpoint\(sourceId\)[\s\S]*const cleanTargetId = normalizeCharRelationshipEndpoint\(targetId\)/, 'relationship reads should not revive stale rows for deleted or nonexistent characters');
    assert.match(dbSource, /function updateCharRelationship\(sourceId, targetId, source, data\)[\s\S]*if \(!cleanSourceId \|\| !cleanTargetId \|\| cleanSourceId === cleanTargetId\) return false/, 'relationship updates should reject blank, ghost, or self endpoints');
    assert.match(dbSource, /const safeAffinity = normalizeCharRelationshipAffinity\(data\.affinity\)[\s\S]*if \(safeAffinity === null\) return false/, 'relationship updates should reject invalid affinity values instead of persisting NaN or loose numbers');
    assert.match(groupChat, /const groupMemberIds = new Set\(\(group\.members \|\| \[\]\)[\s\S]*memberId !== 'user'\)\)/, 'group chat affinity markers should build an allow-list from current group members');
    assert.match(groupChat, /function parseGeneratedCharAffinityDeltas\(db, text, options = \{\}\)[\s\S]*delta = normalizeGeneratedIntegerInRange\(payload\.slice\(splitAt \+ 1\), -100, 100\)[\s\S]*allowedTargetIds && !allowedTargetIds\.has\(targetId\)[\s\S]*Group AI returned invalid character affinity target/, 'group chat affinity markers should fail invalid or out-of-group targets before writes');
    assert.match(groupChat, /const generatedCharAffinityDeltas = parseGeneratedCharAffinityDeltas\(db, cleanReply,[\s\S]*allowedTargetIds: groupMemberIds[\s\S]*for \(const \{ targetId, delta \} of generatedCharAffinityDeltas\)/, 'group chat affinity writes should use preflight-normalized character deltas');
    assert.match(groupChat, /function parseGeneratedAffinityDelta\(text\)[\s\S]*normalizeGeneratedIntegerInRange\(match\[1\], -100, 100\)[\s\S]*Group AI returned invalid affinity delta/, 'group chat user affinity markers should reject malformed or out-of-range deltas before writes');
    assert.match(engine, /function parseGeneratedCharAffinityDeltas\(text, options = \{\}\)[\s\S]*AI returned invalid character affinity target/, 'private affinity markers should fail invalid target ids before side effects');
    assert.match(engine, /const updated = db\.updateCharRelationship\(character\.id, targetId, source, \{ affinity: newAffinity \}\)[\s\S]*if \(updated\) console\.log/, 'private affinity marker logging should reflect whether the DB accepted the relationship update');
    assert.doesNotMatch(groupChat + engine, /parseInt\(affinityMatch\[2\], 10\)|parseInt\(affinityUserMatch\[1\], 10\)|parseInt\(charAffMatch\[2\], 10\)/, 'generated relationship markers must not use raw parseInt deltas');
});

test('group chat generated red packet markers reject loose numeric input', () => {
    const groupChat = readRepoFile('server', 'plugins', 'groupChat', 'index.js');

    assert.match(groupChat, /const GROUP_HIDDEN_TAG_REGEX = \/\s*\\\[\(\?:CHAR_AFFINITY\|AFFINITY\|MOMENT/, 'group chat hidden tags should be centralized for visibility checks and stripping');
    assert.match(groupChat, /function stripGroupHiddenTags\(text\)[\s\S]*\.replace\(GROUP_HIDDEN_TAG_REGEX, ''\)/, 'group replies should use the same hidden-tag stripping for validation and persistence');
    assert.match(groupChat, /const visibleGroupReply = stripGroupHiddenTags\(cleanReply\);[\s\S]*throw new Error\('Group AI returned no visible reply\. Please retry\.'\);[\s\S]*Parse \[CHAR_AFFINITY/, 'group chat should reject tag-only AI output before applying side effects');
    assert.match(groupChat, /cleanReply = stripGroupHiddenTags\(cleanReply\);[\s\S]*if \(cleanReply\.length > 0\)/, 'group chat should persist the same visible text that passed validation');
    assert.match(groupChat, /const GENERATED_RED_PACKET_TYPES = new Set\(\['fixed', 'lucky'\]\)/, 'group generated red packet types should be explicit');
    assert.match(groupChat, /function normalizeGeneratedRedPacketType\(value\)[\s\S]*!GENERATED_RED_PACKET_TYPES\.has\(type\)[\s\S]*throw new Error\('Invalid REDPACKET_SEND type'\)/, 'group generated red packets should reject unknown types instead of defaulting to lucky');
    assert.match(groupChat, /function normalizeGeneratedRedPacketAmount\(value\)[\s\S]*\/\^\\d\+\(\?:\\\.\\d\{1,2\}\)\?\$\/\.test\(text\)[\s\S]*amount < 1 \|\| amount > 200/, 'group generated red packet amounts should reject prefix parses, NaN, Infinity, and out-of-range values');
    assert.match(groupChat, /function normalizeGeneratedRedPacketCount\(value\)[\s\S]*\/\^\\d\+\$\/\.test\(text\)[\s\S]*count < 1 \|\| count > 20/, 'group generated red packet counts should reject decimals, NaN, and out-of-range values');
    assert.match(groupChat, /const rpSendMatch = cleanReply\.match\(\/\\\[REDPACKET_SEND:\(\[\^\|\]\+\)\\\|\(\[\^\|\]\+\)\\\|\(\[\^\|\]\+\)\\\|\(\[\^\\\]\]\*\)\\\]\/i\)/, 'REDPACKET_SEND parsing should capture raw fields for strict validation');
    assert.match(groupChat, /const rpType = normalizeGeneratedRedPacketType\(rpSendMatch\[1\]\)[\s\S]*const rpTotal = normalizeGeneratedRedPacketAmount\(rpSendMatch\[2\]\)[\s\S]*const rpCount = normalizeGeneratedRedPacketCount\(rpSendMatch\[3\]\)/, 'group generated red packet side effects should use strict normalized fields');
    assert.doesNotMatch(groupChat, /parseFloat\(rpSendMatch\[2\]\)/, 'group generated red packets must not parse prefix amounts');
    assert.doesNotMatch(groupChat, /Math\.min\(200, Math\.max\(1, parseFloat/, 'group generated red packets must not clamp malformed or out-of-range amounts into success');
    assert.doesNotMatch(groupChat, /Math\.min\(20, Math\.max\(1, parseInt/, 'group generated red packets must not clamp malformed or out-of-range counts into success');
    assert.doesNotMatch(groupChat, /rpSendMatch\[1\]\.trim\(\)\.toLowerCase\(\) === 'fixed' \? 'fixed' : 'lucky'/, 'group generated red packets must not silently default unknown types to lucky');
});

test('relationships routes delegate LLM impression work to a service module', () => {
    const relationships = readRepoFile('server', 'plugins', 'relationships', 'index.js');
    const impressionService = readRepoFile('server', 'plugins', 'relationships', 'impressionService.js');

    assert.match(relationships, /require\('\.\/impressionService'\)/, 'relationships routes should import the impression service');
    assert.match(relationships, /scheduleInitialImpressions\(\{ db, callLLM, sourceChar, targetChar \}\)/, 'friend route should delegate background impression generation');
    assert.match(relationships, /regenerateImpression\(\{ callLLM, fromChar, toChar \}\)/, 'regenerate route should delegate model parsing and retries');
    assert.doesNotMatch(relationships, /const generateImpression = async|const tryCall = async/, 'route file should not inline bulky LLM workflow functions');
    assert.match(impressionService, /async function generateInitialImpression/, 'impression service should own initial impression generation');
    assert.match(impressionService, /async function regenerateImpression/, 'impression service should own manual impression regeneration');
    assert.match(impressionService, /function parseImpressionResult/, 'impression service should own model response parsing');
});

test('relationships impression generation does not fabricate fallback success', () => {
    const impressionService = readRepoFile('server', 'plugins', 'relationships', 'impressionService.js');

    assert.match(impressionService, /function parseImpressionResult\(cleaned,[\s\S]*const parsed = JSON\.parse\(cleaned\)/, 'relationship impression parsing should require the full cleaned reply to be JSON');
    assert.match(impressionService, /const affinity = clampAffinity\(parsed\.affinity\)[\s\S]*if \(affinity && impression\)/, 'relationship impressions should require valid affinity and impression JSON fields');
    assert.match(impressionService, /Both attempts failed for \$\{fromChar\.name\}->\$\{toChar\.name\}, no impression stored/, 'background impression failure should not write fake recommendation data');
    assert.doesNotMatch(impressionService, /defaultImpressionForAffinity/, 'relationship impressions must not invent a default impression from partial model output');
    assert.doesNotMatch(impressionService, /jsonMatch|cleaned\.match\(\/\\\{\[\\s\\S\]\*\\\}\/\)|JSON\.parse\(jsonMatch\[0\]\)|affinityMatch|useLeftoverFallback|storing empty impression/, 'relationship impression parsing must not regex-salvage malformed model output');
    assert.doesNotMatch(impressionService, /initCharRelationship\(fromChar\.id, toChar\.id, 50, '', 'recommend'\)/, 'relationship impression failures must not persist a neutral fake result');
});

test('relationship impression history limits reject loose numeric input', () => {
    const relationships = readRepoFile('server', 'plugins', 'relationships', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(relationships, /const MAX_IMPRESSION_HISTORY_LIMIT = 200/, 'impression history routes should have an explicit limit cap');
    assert.match(relationships, /function normalizeImpressionHistoryLimit\(value, fallback = 50\)/, 'impression history route limit validation should be centralized');
    assert.match(relationships, /!Number\.isSafeInteger\(parsed\) \|\| parsed < 1 \|\| parsed > MAX_IMPRESSION_HISTORY_LIMIT/, 'impression route limit should reject NaN, Infinity, decimals, negatives, and overlarge values');
    assert.match(relationships, /const limit = normalizeImpressionHistoryLimit\(req\.query\.limit\)[\s\S]*return res\.status\(400\)\.json\(\{ error: 'Invalid impression history limit' \}\)/, 'impression history route should return 400 for invalid limits');
    assert.match(relationships, /const sourceChar = db\.getCharacter\(req\.params\.id\)[\s\S]*const targetChar = db\.getCharacter\(req\.params\.targetId\)[\s\S]*return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)/, 'impression history route should reject ghost source or target characters');
    assert.match(relationships, /db\.getCharImpressionHistory\(sourceChar\.id, targetChar\.id, limit\)/, 'impression history route should query using normalized existing character ids');
    assert.doesNotMatch(relationships, /parseInt\(req\.query\.limit\) \|\| 50/, 'impression history route must not accept parseInt-prefix or negative limits');

    assert.match(dbSource, /function normalizeImpressionHistoryLimit\(value, fallback = 50, max = 200\)[\s\S]*!Number\.isSafeInteger\(parsed\) \|\| parsed < 1\) return fallback[\s\S]*return Math\.min\(max, parsed\)/, 'impression history DB helper should defensively normalize SQL limits');
    assert.match(dbSource, /function addCharImpressionHistory\(sourceId, targetId, impression, triggerEvent\)[\s\S]*const cleanSourceId = normalizeCharRelationshipEndpoint\(sourceId\)[\s\S]*if \(!cleanSourceId \|\| !cleanTargetId \|\| cleanSourceId === cleanTargetId \|\| !safeImpression\) return false/, 'impression history writes should reject ghost endpoints and blank impressions');
    assert.match(dbSource, /function getCharImpressionHistory\(sourceId, targetId, limit = 50\)[\s\S]*const cleanSourceId = normalizeCharRelationshipEndpoint\(sourceId\)[\s\S]*if \(!cleanSourceId \|\| !cleanTargetId \|\| cleanSourceId === cleanTargetId\) return \[\]/, 'impression history reads should ignore stale rows for deleted or nonexistent characters');
    assert.match(dbSource, /const safeLimit = normalizeImpressionHistoryLimit\(limit\)[\s\S]*\.all\(cleanSourceId, cleanTargetId, safeLimit\)/, 'impression history DB query should use normalized existing ids and limit');
    assert.doesNotMatch(dbSource, /\.all\(sourceId, targetId, limit\)/, 'impression history DB query must not pass raw limits to SQLite');
});

test('private message retry and batch delete are scoped to message ownership', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');
    const chatWindow = readRepoFile('client', 'src', 'components', 'ChatWindow.jsx');
    const retryStart = serverIndex.indexOf("app.post('/api/messages/:characterId/retry'");
    const batchStart = serverIndex.indexOf("app.post('/api/messages/batch-delete'");

    assert.notEqual(retryStart, -1, 'retry route should exist');
    assert.notEqual(batchStart, -1, 'batch delete route should exist');
    const retryRoute = serverIndex.slice(retryStart, batchStart);
    const batchRoute = serverIndex.slice(batchStart, batchStart + 1200);

    assert.match(retryRoute, /if \(failedMessage\) db\.deleteMessage\(failedMessage\.id, characterId\)/, 'retry should delete only a failed message found under the route character');
    assert.doesNotMatch(retryRoute, /db\.deleteMessage\(failedMessageId\)/, 'retry must not delete raw request-body ids');

    assert.match(batchRoute, /const ids = Array\.from\(new Set\(\(Array\.isArray\(messageIds\) \? messageIds : \[\]\)/, 'batch delete should normalize message ids');
    assert.match(batchRoute, /const requestedCharacterId = String\(req\.body\?\.characterId \|\| ''\)\.trim\(\)/, 'batch delete should accept a character scope from the client');
    assert.match(batchRoute, /if \(requestedCharacterId && String\(characterId\) !== requestedCharacterId\) continue/, 'batch delete should ignore ids outside the requested character scope');
    assert.match(batchRoute, /const changes = db\.deleteMessage\(id, characterId\)/, 'batch delete should delete with the resolved owning character id');
    assert.match(batchRoute, /deleted \+= changes/, 'batch delete should report actual deleted rows');
    assert.doesNotMatch(batchRoute, /deleted\+\+/, 'batch delete must not count nonexistent or skipped ids as deleted');

    assert.match(dbSource, /function deleteMessage\(messageId, characterId = null\)/, 'DB deleteMessage should accept an optional character scope');
    assert.match(dbSource, /DELETE FROM messages WHERE id = \? AND character_id = \?/, 'DB deleteMessage should support scoped message deletion');
    assert.match(dbSource, /DELETE FROM message_tts WHERE message_id = \?/, 'DB deleteMessage should remove orphaned TTS rows after deleting a message');
    assert.match(chatWindow, /const deletingContactId = contactRef\.current\?\.id[\s\S]*body: JSON\.stringify\(\{ characterId: deletingContactId, messageIds: \[\.\.\.selectedIds\] \}\)/, 'private chat batch delete should send the captured current character scope');
});

test('chat windows do not replay accumulated websocket queues', () => {
    const chatWindow = readRepoFile('client', 'src', 'components', 'ChatWindow.jsx');
    const groupChatWindow = readRepoFile('client', 'src', 'components', 'GroupChatWindow.jsx');

    assert.match(chatWindow, /const processedIncomingMessageIdsRef = useRef\(new Set\(\)\)/, 'private chat should track consumed websocket message ids');
    assert.match(chatWindow, /const deletedMessageIdsRef = useRef\(new Set\(\)\)/, 'private chat should track locally deleted message ids');
    assert.match(chatWindow, /const messageId = `\$\{contact\.id\}:\$\{m\.id\}`/, 'private chat consumed ids should be scoped by contact');
    assert.match(chatWindow, /deletedMessageIdsRef\.current\.has\(messageId\)/, 'private chat should ignore websocket messages deleted locally');
    assert.match(chatWindow, /processedIncomingMessageIdsRef\.current\.has\(messageId\)/, 'private chat should skip already-consumed websocket messages');
    assert.match(chatWindow, /processedIncomingMessageIdsRef\.current\.add\(messageId\)/, 'private chat should mark websocket messages as consumed');
    assert.match(chatWindow, /deletedMessageIdsRef\.current\.add\(`\$\{deletingContactId\}:\$\{id\}`\)/, 'private chat should remember ids after successful deletes');
    assert.doesNotMatch(chatWindow, /incomingMessageQueue\.filter\(m => m\.character_id === contact\.id\)/, 'private chat must not replay the full accumulated queue on each new message');

    assert.match(groupChatWindow, /const processedIncomingGroupMessageIdsRef = useRef\(new Set\(\)\)/, 'group chat should track consumed websocket message ids');
    assert.match(groupChatWindow, /const deletedGroupMessageIdsRef = useRef\(new Set\(\)\)/, 'group chat should track locally deleted message ids');
    assert.match(groupChatWindow, /const messageId = `\$\{group\.id\}:\$\{m\.id\}`/, 'group chat consumed ids should be scoped by group');
    assert.match(groupChatWindow, /deletedGroupMessageIdsRef\.current\.has\(messageId\)/, 'group chat should ignore websocket messages deleted locally');
    assert.match(groupChatWindow, /processedIncomingGroupMessageIdsRef\.current\.has\(messageId\)/, 'group chat should skip already-consumed websocket messages');
    assert.match(groupChatWindow, /processedIncomingGroupMessageIdsRef\.current\.add\(messageId\)/, 'group chat should mark websocket messages as consumed');
    assert.match(groupChatWindow, /deletedGroupMessageIdsRef\.current\.add\(`\$\{group\.id\}:\$\{id\}`\)/, 'group chat should remember ids after successful deletes');
    assert.doesNotMatch(groupChatWindow, /incomingGroupMessageQueue\.filter\(m => m\.group_id === group\.id\)/, 'group chat must not replay the full accumulated queue on each new message');
});

test('private message routes reject missing characters before writing', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const getStart = serverIndex.indexOf("app.get('/api/messages/:characterId'");
    const postStart = serverIndex.indexOf("app.post('/api/messages'");
    const retryStart = serverIndex.indexOf("app.post('/api/messages/:characterId/retry'");
    const ttsStart = serverIndex.indexOf("app.get('/api/tts/audio/:messageId'");

    assert.notEqual(getStart, -1, 'message list route should exist');
    assert.notEqual(postStart, -1, 'message send route should exist');
    assert.notEqual(retryStart, -1, 'message retry route should exist');

    const getRoute = serverIndex.slice(getStart, postStart);
    const postRoute = serverIndex.slice(postStart, retryStart);
    const retryRoute = serverIndex.slice(retryStart, ttsStart);

    assert.match(getRoute, /const charObj = db\.getCharacter\(charId\);[\s\S]*if \(!charObj\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)/, 'message reads should reject missing characters');
    assert.match(serverIndex, /function normalizeQueryLimit\(value, fallback, max\)[\s\S]*!Number\.isSafeInteger\(parsed\) \|\| parsed <= 0/, 'server routes should centralize strict query limit validation');
    assert.match(getRoute, /const limit = normalizeQueryLimit\(req\.query\.limit, 100, 200\);[\s\S]*return res\.status\(400\)\.json\(\{ error: 'Invalid message limit' \}\)/, 'message reads should reject loose, decimal, or negative pagination limits');
    assert.match(getRoute, /if \(req\.query\.before !== undefined && \(!Number\.isSafeInteger\(before\) \|\| before <= 0\)\)/, 'message reads should reject invalid before cursors');
    assert.doesNotMatch(getRoute, /parseInt\(req\.query\.limit, 10\) \|\| 100/, 'message reads must not accept parseInt-prefix limits like 1abc');

    assert.match(postRoute, /const charObj = db\.getCharacter\(characterId\);[\s\S]*if \(!charObj\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*if \(charObj\.is_blocked\)/, 'message sends should distinguish missing characters from blocked characters');
    assert.doesNotMatch(postRoute, /if \(!charObj \|\| charObj\.is_blocked\)[\s\S]*db\.addMessage\(characterId, 'user', content\)/, 'message sends must not write orphan messages for missing characters');

    assert.match(retryRoute, /const charObj = db\.getCharacter\(characterId\);[\s\S]*if \(!charObj\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*const requestId = createRequestTraceId\('retry'\)/, 'message retry should reject missing characters before triggering generation');
});

test('memory list reads reject missing characters before returning empty data', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const listStart = serverIndex.indexOf("app.get('/api/memories/:characterId'");
    const exportStart = serverIndex.indexOf("app.get('/api/memories/:characterId/export'", listStart);

    assert.notEqual(listStart, -1, 'memory list route should exist');
    assert.notEqual(exportStart, -1, 'memory export route should follow memory list route');
    const listRoute = serverIndex.slice(listStart, exportStart);

    assert.match(listRoute, /const charObj = db\.getCharacter\(req\.params\.characterId\);[\s\S]*if \(!charObj\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*db\.getMemories\(charObj\.id\)/, 'memory list reads should reject missing characters and query with the normalized character id');
    assert.doesNotMatch(listRoute, /db\.getMemories\(req\.params\.characterId\)/, 'memory list reads must not return empty success for raw ghost character ids');
});

test('message writes require a real character at the db layer', () => {
    const dbSource = readRepoFile('server', 'db.js');
    const addMessageStart = dbSource.indexOf('function addMessage(characterId, role, content, metadata = null)');
    const deleteMessageStart = dbSource.indexOf('function deleteMessage(messageId, characterId = null)', addMessageStart);

    assert.notEqual(addMessageStart, -1, 'DB addMessage should exist');
    assert.notEqual(deleteMessageStart, -1, 'DB deleteMessage should follow addMessage');
    const addMessageSource = dbSource.slice(addMessageStart, deleteMessageStart);

    assert.match(addMessageSource, /const targetCharacterId = String\(characterId \|\| ''\)\.trim\(\)/, 'message writes should normalize character ids before inserts');
    assert.match(addMessageSource, /const safeRole = String\(role \|\| ''\)\.trim\(\)/, 'message writes should normalize roles before inserts');
    assert.match(addMessageSource, /const safeContent = typeof content === 'string' \? content : ''/, 'message writes should reject non-string content instead of coercing objects');
    assert.match(addMessageSource, /!\['user', 'character', 'system'\]\.includes\(safeRole\)[\s\S]*Invalid message role\./, 'message writes should reject unknown roles before inserts');
    assert.match(addMessageSource, /!safeContent\.trim\(\)[\s\S]*Message content required\./, 'message writes should reject blank content before inserts');
    assert.match(addMessageSource, /SELECT 1 FROM characters WHERE id = \? LIMIT 1/, 'message writes should verify the target character exists');
    assert.match(addMessageSource, /Character not found\./, 'message writes should fail loudly for missing characters');
    assert.match(addMessageSource, /\.run\(targetCharacterId, safeRole, safeContent, ts, metadataStr\)/, 'metadata message inserts should use normalized ids, roles, and content');
    assert.match(addMessageSource, /\.run\(targetCharacterId, safeRole, safeContent, ts\)/, 'legacy message inserts should use normalized ids, roles, and content');
    assert.doesNotMatch(addMessageSource, /\.run\(targetCharacterId, role, content, ts/, 'message inserts must not write raw role or content values');
});

test('message and debug log limits reject loose numeric input', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');
    const messagesStart = serverIndex.indexOf("app.get('/api/messages/:characterId'");
    const emotionStart = serverIndex.indexOf("app.get('/api/characters/:characterId/emotion-logs'");
    const debugStart = serverIndex.indexOf("app.get('/api/characters/:characterId/llm-debug-logs'");
    const replyDispatchStart = serverIndex.indexOf("app.get('/api/debug/reply-dispatch/:characterId'");
    const sendStart = serverIndex.indexOf("app.post('/api/messages'", messagesStart);
    const batchDeleteStart = serverIndex.indexOf("app.post('/api/messages/batch-delete'", replyDispatchStart);

    assert.notEqual(messagesStart, -1, 'message list route should exist');
    assert.notEqual(emotionStart, -1, 'emotion log route should exist');
    assert.notEqual(debugStart, -1, 'LLM debug log route should exist');
    assert.notEqual(replyDispatchStart, -1, 'reply dispatch debug route should exist');
    assert.notEqual(sendStart, -1, 'message send route should follow debug routes');
    assert.notEqual(batchDeleteStart, -1, 'batch delete route should follow reply dispatch route');

    const messagesRoute = serverIndex.slice(messagesStart, emotionStart);
    const emotionRoute = serverIndex.slice(emotionStart, debugStart);
    const debugRoute = serverIndex.slice(debugStart, replyDispatchStart);
    const replyDispatchRoute = serverIndex.slice(replyDispatchStart, batchDeleteStart);

    assert.match(messagesRoute, /const limit = normalizeQueryLimit\(req\.query\.limit, 100, 200\);[\s\S]*Invalid message limit/, 'message list limits should use strict shared validation');
    assert.match(emotionRoute, /const charObj = db\.getCharacter\(req\.params\.characterId\);[\s\S]*if \(!charObj\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*const limit = normalizeQueryLimit\(req\.query\.limit, 50, 100\);[\s\S]*db\.getEmotionLogs\(charObj\.id, limit\)/, 'emotion log reads should reject missing characters and query with the normalized character id');
    assert.match(debugRoute, /const charObj = db\.getCharacter\(req\.params\.characterId\);[\s\S]*if \(!charObj\) return res\.status\(404\)\.json\(\{ error: 'Character not found' \}\)[\s\S]*const limit = normalizeQueryLimit\(req\.query\.limit, 50, 200\);[\s\S]*db\.getLlmDebugLogs\(charObj\.id, limit\)/, 'LLM debug log reads should reject missing characters and query with the normalized character id');
    assert.match(replyDispatchRoute, /const limit = normalizeQueryLimit\(req\.query\.limit, 50, 200\);[\s\S]*Invalid reply dispatch log limit/, 'reply dispatch debug limits should use strict shared validation');
    assert.doesNotMatch(messagesRoute + emotionRoute + debugRoute + replyDispatchRoute, /parseInt\(req\.query\.limit/, 'message and debug routes must not accept parseInt-prefix limits');

    assert.match(dbSource, /function normalizeSqlLimit\(value, fallback, max\)[\s\S]*!Number\.isSafeInteger\(parsed\) \|\| parsed <= 0\) return fallback/, 'DB list helpers should defensively normalize SQL limits');
    assert.match(dbSource, /function getMessages\(characterId, limit = 100\)[\s\S]*const safeLimit = normalizeSqlLimit\(limit, 100, 200\)[\s\S]*\.all\(characterId, safeLimit\)/, 'DB getMessages should not pass raw limits to SQLite');
    assert.match(dbSource, /function getMessagesBefore\(characterId, beforeId, limit = 100\)[\s\S]*const safeLimit = normalizeSqlLimit\(limit, 100, 200\)[\s\S]*\.all\(characterId, beforeId, safeLimit\)/, 'DB getMessagesBefore should not pass raw limits to SQLite');
    assert.match(dbSource, /function getEmotionLogs\(characterId, limit = 50\)[\s\S]*const safeLimit = normalizeSqlLimit\(limit, 50, 100\)[\s\S]*\.all\(characterId, safeLimit\)/, 'DB getEmotionLogs should not pass raw limits to SQLite');
    assert.match(dbSource, /function getLlmDebugLogs\(characterId, limit = 50\)[\s\S]*const safeLimit = normalizeSqlLimit\(limit, 50, 200\)[\s\S]*\.all\(characterId, safeLimit\)/, 'DB getLlmDebugLogs should not pass raw limits to SQLite');
    assert.match(dbSource, /function getReplyDispatchLogs\(characterId, limit = 50\)[\s\S]*const safeLimit = normalizeSqlLimit\(limit, 50, 200\)[\s\S]*\.all\(characterId, safeLimit\)/, 'DB getReplyDispatchLogs should not pass raw limits to SQLite');
});

test('message TTS records are tied to real message ownership', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const dbSource = readRepoFile('server', 'db.js');
    const routeStart = serverIndex.indexOf("app.get('/api/tts/audio/:messageId'");
    const nextRouteStart = serverIndex.indexOf("app.get('/api/tts/tencent/voices'", routeStart);

    assert.notEqual(routeStart, -1, 'TTS audio route should exist');
    assert.notEqual(nextRouteStart, -1, 'TTS voice route should follow audio route');
    const ttsRoute = serverIndex.slice(routeStart, nextRouteStart);

    assert.match(dbSource, /SELECT \* FROM message_tts WHERE message_id = \? AND character_id = \?/, 'message metadata should ignore TTS rows tied to another character');
    assert.match(dbSource, /function upsertMessageTts\(entry = \{\}\)[\s\S]*normalizePositiveRowId\(entry\.message_id, 'message id'\)[\s\S]*SELECT id, character_id FROM messages WHERE id = \? LIMIT 1[\s\S]*Message not found\./, 'TTS writes should require an existing message');
    assert.match(dbSource, /requestedCharacterId && requestedCharacterId !== characterId[\s\S]*TTS character does not match message/, 'TTS writes should reject mismatched character ids');
    assert.match(dbSource, /function getMessageTts\(messageId\)[\s\S]*JOIN messages ON messages\.id = message_tts\.message_id/, 'TTS reads should ignore orphan rows without a backing message');
    assert.match(dbSource, /Math\.floor\(rawDurationMs\)/, 'TTS duration should be normalized after rejecting invalid values');

    assert.match(ttsRoute, /if \(!messageCharId\) \{[\s\S]*TTS audio not found\./, 'TTS audio route should not serve orphan rows');
    assert.match(ttsRoute, /res\.status\(e\.status \|\| 500\)/, 'TTS audio route should preserve validation status codes');
});

test('settings upload and memo drawer avoid debug logs and use explicit auth', () => {
    const settingsPanel = readRepoFile('client', 'src', 'components', 'SettingsPanel.jsx');
    const memoTable = readRepoFile('client', 'src', 'components', 'MemoTable.jsx');
    const app = readRepoFile('client', 'src', 'App.jsx');

    assert.doesNotMatch(settingsPanel, /DEBUG:|DEBUG Upload/, 'avatar upload should not leave production debug logs');
    assert.doesNotMatch(app, /styleTag\.innerHTML/, 'custom CSS should not be injected through HTML parsing');
    assert.match(app, /styleTag\.textContent = userProfile\.custom_css/, 'custom CSS should be assigned as style text content');
    assert.doesNotMatch(memoTable, /MemoTable rendering|Real-time memory update/, 'memo drawer should not log on every render/update');
    assert.match(memoTable, /function buildAuthHeaders/, 'memo drawer should centralize auth headers');
    assert.match(memoTable, /fetch\(`\$\{apiUrl\}\/memories\/\$\{contact\.id\}`,\s*\{ headers: buildAuthHeaders\(\) \}\)/, 'memo load should send auth headers explicitly');
    assert.match(memoTable, /fetch\(`\$\{apiUrl\}\/memories\/\$\{id\}`,\s*\{ method: 'DELETE', headers: buildAuthHeaders\(\) \}\)/, 'memo delete should send auth headers explicitly');
    assert.match(memoTable, /fetch\(`\$\{apiUrl\}\/memories\/\$\{contact\.id\}\/extract`,\s*\{ method: 'POST', headers: buildAuthHeaders\(\) \}\)/, 'memo extraction should send auth headers explicitly');
});

test('relationships plugin does not persist or log raw LLM responses', () => {
    const relationships = readRepoFile('server', 'plugins', 'relationships', 'index.js');
    const impressionService = readRepoFile('server', 'plugins', 'relationships', 'impressionService.js');
    const relationshipSources = `${relationships}\n${impressionService}`;
    const leakingConsoleLines = relationshipSources
        .split(/\r?\n/)
        .filter(line => /console\.(?:log|warn|error)/.test(line))
        .filter(line => /Raw LLM output|Input:|Cleaned:|result\.substring|cleaned\.substring|m\[0\]\.substring|leftover\.substring|iText\?\.\[1\]\?\.substring/.test(line));

    assert.doesNotMatch(relationshipSources, /writeFileSync/, 'relationship regeneration must not write raw model output to debug files');
    assert.doesNotMatch(relationshipSources, /debug_regen\.txt/, 'relationship regeneration must not create ad-hoc debug files');
    assert.doesNotMatch(relationshipSources, /Raw LLM output/, 'relationship routes must not log raw model output');
    assert.doesNotMatch(relationshipSources, /_raw:\s*cleaned/, 'relationship parsing should not carry raw model output beyond local parsing');
    assert.deepEqual(leakingConsoleLines, [], 'relationship debug logging should not include raw response snippets');
});

test('LLM generation routes do not log raw generated content', () => {
    const serverIndex = readRepoFile('server', 'index.js');
    const themePlugin = readRepoFile('server', 'plugins', 'theme', 'index.js');
    const engineSource = readRepoFile('server', 'engine.js');
    const cityPlugin = readRepoFile('server', 'plugins', 'city', 'index.js');
    const citySocialService = readRepoFile('server', 'plugins', 'city', 'services', 'socialService.js');

    assert.doesNotMatch(serverIndex, /Generator Raw Output/, 'character generator must not log raw model output');
    assert.doesNotMatch(serverIndex, /JSON\.parse failed on this string/, 'character generator must not log failed raw JSON');
    assert.doesNotMatch(serverIndex, /Failed to find JSON brackets in cleanText:\s*,\s*cleanText/, 'character generator must not log raw non-JSON responses');
    assert.doesNotMatch(serverIndex, /console\.warn[^\n]*clipMemoryDisplayText\(rawText/, 'external memory import logs must not include raw model output snippets');
    assert.match(serverIndex, /\[Character Generator\] LLM returned \$\{String\(generatedText \|\| ''\)\.length\} chars\./, 'character generator should retain non-content diagnostics');
    assert.match(serverIndex, /rawChars=\$\{String\(rawText \|\| ''\)\.length\}/, 'external memory import logs should keep only non-content response diagnostics');
    assert.match(serverIndex, /function parseGeneratedCharacterReply\(replyText\)[\s\S]*return parsed;/, 'character generator should parse and return only a full JSON object');
    assert.match(serverIndex, /function normalizeGeneratedCharacterPayload\(parsed\)[\s\S]*requireGeneratedCharacterInteger\(parsed\.affinity, 'affinity', 0, 100\)[\s\S]*requireGeneratedCharacterInteger\(parsed\.sys_pressure, 'sys_pressure', 0, 1\)/, 'character generator should validate generated numeric fields before success');
    assert.match(serverIndex, /parsed = normalizeGeneratedCharacterPayload\(parseGeneratedCharacterReply\(generatedText\)\)/, 'character generator should validate model JSON before adding local integration fields');
    assert.doesNotMatch(serverIndex, /cleanText\.indexOf\('\{'\)|cleanText\.lastIndexOf\('\}'\)|cleanText\.slice\(startIdx, endIdx \+ 1\)/, 'character generator must not slice JSON out of malformed model output');

    assert.doesNotMatch(themePlugin, /Theme Generator Raw Output/, 'theme generator must not log raw model output');
    assert.doesNotMatch(themePlugin, /JSON\.parse failed on this theme string/, 'theme generator must not log failed raw JSON');
    assert.doesNotMatch(themePlugin, /Failed to find JSON brackets in cleanText:\s*,\s*cleanText/, 'theme generator must not log raw non-JSON responses');
    assert.match(themePlugin, /\[Theme Generator\] LLM returned \$\{String\(generatedText \|\| ''\)\.length\} chars\./, 'theme generator should retain non-content diagnostics');
    assert.match(themePlugin, /function parseThemeJsonReply\(replyText\)[\s\S]*return JSON\.parse\(cleanText\)/, 'theme generator should parse the full cleaned model reply as JSON');
    assert.match(themePlugin, /const HEX_COLOR_RE = \/\^#\[0-9a-fA-F\]\{6\}\$\//, 'theme generator should define strict hex color validation');
    assert.match(themePlugin, /function validateGeneratedThemeConfig\(value\)[\s\S]*if \(!HEX_COLOR_RE\.test\(color\)\)/, 'theme generator should validate generated colors as strict hex values');
    assert.match(themePlugin, /for \(const key of THEME_COLOR_KEYS\)[\s\S]*throw new Error\(`Generated theme has invalid color for \$\{key\}\.`\)/, 'theme generator should reject missing or invalid generated theme keys');
    assert.doesNotMatch(themePlugin, /cleanText\.indexOf\('\{'\)|cleanText\.lastIndexOf\('\}'\)|cleanText\.slice\(startIdx, endIdx \+ 1\)/, 'theme generator must not slice JSON out of malformed model output');

    assert.doesNotMatch(engineSource, /LLM raw output|JSON\.stringify\(generatedText\)|generatedText\.substring|console\.(?:log|warn|error)[^\n]*(?:Query: "\$\{retrievalLabel\}"|matches for "\$\{retrievalLabel\}"|temporalHint\}"|: "\$\{clean\}"|\$\{taskPrompt\})/, 'runtime engine logs must not include raw generated text, retrieval queries, or proactive prompt content');
    assert.match(engineSource, /LLM output received for \$\{charCheck\.name\}\. chars=\$\{String\(generatedText \|\| ''\)\.length\}/, 'runtime engine should keep only non-content output diagnostics');
    assert.match(engineSource, /Dynamic RAG triggered for \$\{character\.name\}\. queryChars=\$\{String\(retrievalLabel \|\| ''\)\.length\}/, 'runtime engine RAG logs should not include retrieval query text');
    assert.match(engineSource, /Proactive task triggered for \$\{character\.name\}\. promptChars=\$\{String\(taskPrompt \|\| ''\)\.length\}/, 'runtime engine proactive logs should not include prompt text');
    assert.doesNotMatch(cityPlugin, /console\.log[^\n]*(?:chatContent|explicitMoment)\.substring/, 'city-to-chat logs must not include generated chat or moment snippets');
    assert.match(cityPlugin, /发私聊 chars=\$\{String\(chatContent \|\| ''\)\.length\}/, 'city-to-chat private logs should keep only content length');
    assert.match(cityPlugin, /发朋友圈 chars=\$\{String\(explicitMoment \|\| ''\)\.length\}/, 'city-to-chat moment logs should keep only content length');
    assert.doesNotMatch(citySocialService, /console\.error[^\n]*clean\.substring/, 'city social parser logs must not include raw model output snippets');
    assert.match(citySocialService, /尝试解析的文本长度:', clean \? String\(clean\)\.length : 0/, 'city social parser logs should keep only raw output length');
});

test('private reply generation does not fabricate fallback text for empty visible output', () => {
    const engineSource = readRepoFile('server', 'engine.js');
    const visibleCheckPos = engineSource.indexOf('const visibleGeneratedText = stripHistoryMetadataPrefixFromOutput(stripHiddenTagsForVisibleMessage(generatedText));');
    const tagSideEffectPos = engineSource.indexOf('// Check for self-scheduled timer tags like [TIMER: 60]');

    assert.notEqual(visibleCheckPos, -1, 'engine should validate visible model output');
    assert.notEqual(tagSideEffectPos, -1, 'engine should still have tag side effect parsing after validation');
    assert.ok(visibleCheckPos < tagSideEffectPos, 'engine should reject tag-only output before applying tag side effects');
    assert.match(engineSource, /if \(!visibleGeneratedText\) \{\s*throw new Error\('AI returned no visible reply\. Please retry\.'\);/, 'empty visible replies should surface an error for retry');
    assert.doesNotMatch(engineSource, /Use a randomized fallback/, 'engine must not document empty-output fallback text');
    assert.doesNotMatch(engineSource, /const pick = \(arr\) => arr\[Math\.floor\(Math\.random\(\) \* arr\.length\)\]/, 'engine must not keep randomized fallback reply selection');
    assert.doesNotMatch(engineSource, /generatedText = pick\(\["嗯。", "嗯哼", "好的"/, 'engine must not turn empty model output into canned user-reply text');
});

test('private chat anti-repeat uses typed context instead of legacy compact previews', () => {
    const engineSource = readRepoFile('server', 'engine.js');
    const promptStart = engineSource.indexOf('async function buildPrompt');
    const promptEnd = engineSource.indexOf('async function runStructuredRagPipeline', promptStart);
    assert.notEqual(promptStart, -1, 'private chat prompt builder should exist');
    assert.notEqual(promptEnd, -1, 'private chat prompt builder should have a stable end marker');
    const promptBlock = engineSource.slice(promptStart, promptEnd);

    assert.match(promptBlock, /formatTypedAntiRepeatBlock\(universalResult\.antiRepeatHints/, 'private chat prompt should use typed anti-repeat hints from the universal context');
    assert.match(promptBlock, /include: \['private_character_replies', 'city_private_outreach', 'city_self_logs', 'group_character_replies'\]/, 'private chat typed anti-repeat should include ordinary private replies');
    assert.match(promptBlock, /antiRepeat: typedAntiRepeat/, 'private chat debug stats should report the active typed anti-repeat block');
    assert.doesNotMatch(engineSource, /function buildCompactAntiRepeat|function compactPreview|Recent older topics|buildCompactAntiRepeat\(/, 'private chat should not keep the legacy compact anti-repeat preview helper');
    assert.doesNotMatch(promptBlock, /antiRepeatMessages|protectedTailCount|\[Anti-Repeat\]/, 'private chat prompt should not use the old compact anti-repeat path');
});

test('private chat prompts treat similar turns as a linear timeline, not parallel repeats', () => {
    const engineSource = readRepoFile('server', 'engine.js');
    const promptStart = engineSource.indexOf('async function buildPrompt');
    const promptEnd = engineSource.indexOf('async function runStructuredRagPipeline', promptStart);
    const ragStart = engineSource.indexOf('async function runStructuredRagPipeline');
    const ragEnd = engineSource.indexOf('async function triggerMessage', ragStart);
    assert.notEqual(promptStart, -1, 'private chat prompt builder should exist');
    assert.notEqual(promptEnd, -1, 'private chat prompt builder should have a stable end marker');
    assert.notEqual(ragStart, -1, 'RAG pipeline should exist');
    assert.notEqual(ragEnd, -1, 'RAG pipeline should have a stable end marker');
    const promptBlock = engineSource.slice(promptStart, promptEnd);
    const ragBlock = engineSource.slice(ragStart, ragEnd);

    assert.match(promptBlock, /Chat history is a linear timeline: later rows are newer states/, 'private prompt should teach the model that chat is a linear timeline');
    assert.match(promptBlock, /earlier similar turns as already-answered past context/, 'private prompt should not let similar old turns become parallel current questions');
    assert.match(promptBlock, /do not re-list the same old proof every turn/, 'private prompt should prevent repeated proof dumps for repeated motifs');
    assert.match(promptBlock, /Similar earlier turns are past timeline steps you may have already answered/, 'topic gate block should preserve linear continuation semantics');
    assert.match(ragBlock, /The \[Newest user message\] below is the current turn at the end of a linear chat timeline/, 'RAG injection should keep newest-user wording as the current linear turn');
    assert.match(ragBlock, /Use recalled facts to disambiguate, not to re-list the same proof every turn/, 'RAG injection should not invite repeated old proof dumps');
});

test('login screen does not expose default Nana credentials', () => {
    const login = readRepoFile('client', 'src', 'components', 'Login.jsx');

    assert.doesNotMatch(login, /默认账号\s*Nana|Nana，默认密码|默认密码\s*12345|12345/, 'login page should not display default credentials');
});

test('account settings copy does not expose the default root password', () => {
    const settingsPanel = readRepoFile('client', 'src', 'components', 'SettingsPanel.jsx');

    assert.doesNotMatch(
        settingsPanel,
        /Default root password is 12345|默认 root 密码为 12345|默认密码\s*12345/,
        'account settings should not reveal the initial root password'
    );
});

test('fresh installs do not fall back to a hardcoded root password', () => {
    const authDb = readRepoFile('server', 'authDb.js');
    const readme = readRepoFile('README.md');

    assert.doesNotMatch(authDb, /ADMIN_PASSWORD\s*\|\|\s*['"]12345['"]/, 'auth DB must not fall back to a hardcoded root password');
    assert.match(authDb, /generateInitialAdminPassword\(\)/, 'auth DB should generate a first-run password when ADMIN_PASSWORD is absent');
    assert.match(authDb, /crypto\.randomBytes\(/, 'generated first-run password should use cryptographic randomness');
    assert.doesNotMatch(readme, /Default password:\s*`12345`|默认密码：`12345`/, 'README must not advertise a hardcoded default root password');
});

test('client code uses cp_token instead of legacy token storage', () => {
    const clientSrc = path.join(repoRoot, 'client', 'src');
    const main = readRepoFile('client', 'src', 'main.jsx');
    const offenders = [];

    function scan(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scan(fullPath);
                continue;
            }
            if (!/\.(js|jsx)$/.test(entry.name)) continue;
            const text = fs.readFileSync(fullPath, 'utf8');
            if (/localStorage\.(getItem|setItem|removeItem)\(['"]token['"]\)/.test(text)) {
                offenders.push(path.relative(repoRoot, fullPath));
            }
        }
    }

    scan(clientSrc);
    assert.deepEqual(offenders, [], 'legacy localStorage token key should not be used');
    assert.match(main, /function isChatPulseApiRequest\(resource\)/, 'global auth fetch hook should identify first-party API requests through a helper');
    assert.match(main, /requestUrl\.origin === apiUrl\.origin[\s\S]*requestUrl\.pathname\.startsWith\(`\$\{apiPath\}\/`\)/, 'global auth fetch hook should not match arbitrary external /api/ URLs');
    assert.match(main, /const headers = new Headers\(config\.headers \|\| \(resource instanceof Request \? resource\.headers : undefined\)\)/, 'global auth fetch hook should preserve existing Headers objects');
    assert.match(main, /function isBootstrapUserRequest\(resource\)[\s\S]*requestUrl\.pathname === `\$\{getConfiguredApiPath\(\)\}\/user`/, 'automatic logout should only key off the bootstrap user endpoint');
});

test('chat side drawers do not blank the conversation while lazy loading', () => {
    const app = readRepoFile('client', 'src', 'App.jsx');
    const chatWindow = readRepoFile('client', 'src', 'components', 'ChatWindow.jsx');
    const css = readRepoFile('client', 'src', 'App.css');

    assert.match(app, /function lazyWithPreload\(factory\)[\s\S]*const Component = lazy\(load\)[\s\S]*Component\.preload = \(\) => load\(\)\.catch/, 'lazy chat drawer chunks should be pre-loadable');
    assert.match(app, /function DrawerFallback\(\{ type = 'settings', contact, lang = 'zh', onClose \}\)[\s\S]*className="drawer-container memory-drawer memory-table-drawer drawer-loading-fallback"[\s\S]*加载记忆中/, 'memo drawer fallback should immediately render the real loading shell instead of a skeleton transition');
    assert.match(app, /activeDrawer === 'memo'[\s\S]*<Suspense fallback=\{<DrawerFallback type="memo" contact=\{activeChatContact\} lang=\{lang\} onClose=\{\(\) => setActiveDrawer\(null\)\} \/>\}>[\s\S]*<MemoTable/, 'memo drawer lazy loading should be caught by an inner drawer boundary');
    assert.match(app, /activeDrawer === 'diary'[\s\S]*<Suspense fallback=\{<DrawerFallback type="diary" contact=\{activeChatContact\} lang=\{lang\} onClose=\{\(\) => setActiveDrawer\(null\)\} \/>\}>[\s\S]*<DiaryTable/, 'diary drawer lazy loading should be caught by an inner drawer boundary');
    assert.match(app, /activeDrawer === 'settings'[\s\S]*<Suspense fallback=\{<DrawerFallback type="settings" contact=\{activeChatContact\} lang=\{lang\} onClose=\{\(\) => setActiveDrawer\(null\)\} \/>\}>[\s\S]*<ChatSettingsDrawer/, 'settings drawer lazy loading should be caught by an inner drawer boundary');
    assert.match(app, /onPreloadMemo=\{\(\) => preloadChatDrawer\('memo'\)\}[\s\S]*onPreloadDiary=\{\(\) => preloadChatDrawer\('diary'\)\}[\s\S]*onPreloadSettings=\{\(\) => preloadChatDrawer\('settings'\)\}/, 'chat header buttons should receive drawer preloading callbacks');
    assert.match(chatWindow, /onPointerEnter=\{onPreloadMemo\} onFocus=\{onPreloadMemo\} onClick=\{onToggleMemo\}/, 'memo button should preload before opening');
    assert.match(chatWindow, /onPointerEnter=\{onPreloadDiary\} onFocus=\{onPreloadDiary\} onClick=\{onToggleDiary\}/, 'diary button should preload before opening');
    assert.match(chatWindow, /onPointerEnter=\{onPreloadSettings\} onFocus=\{onPreloadSettings\} onClick=\{onToggleSettings\}/, 'settings button should preload before opening');
    assert.match(css, /\.drawer-fallback-action\[aria-disabled="true"\][\s\S]*pointer-events: none/, 'drawer fallback should keep visible controls inert while chunks load');
    assert.doesNotMatch(app, /drawer-loading-card|drawer-loading-line/, 'drawer fallback should not add a skeleton transition before the drawer loading text');
});

test('private chat thinking state is shown by the contact breathing light only', () => {
    const chatWindow = readRepoFile('client', 'src', 'components', 'ChatWindow.jsx');
    const contactList = readRepoFile('client', 'src', 'components', 'ContactList.jsx');

    assert.doesNotMatch(chatWindow, /t\('Thinking'\)/, 'private chat should not render a typing/thinking text bubble before the input area');
    assert.doesNotMatch(chatWindow, /isGeneratingReply/, 'private chat should not use a generated reply flag to render text-only status UI');

    assert.match(contactList, /const isWorking = !!\(state\?\.isThinking \|\| state\?\.webSearchActive\)/, 'contact list should treat live model calls as working');
    assert.match(contactList, /autopulse-status-dot \$\{isWorking \? 'thinking' : 'connected'\}/, 'contact list should turn the breathing light yellow while the character is thinking');
    assert.match(contactList, /const statusText = countdown \? `\$\{countdown\}s` : contact\.time/, 'contact list should not replace the time with thinking text');
    assert.doesNotMatch(contactList, /思考中/, 'private chat list should not show thinking as text');
    assert.doesNotMatch(contactList, /color: isWorking \|\| countdown \?/, 'working state should not turn the timestamp into a text indicator');
});

test('doctor opens sqlite native module instead of only checking installation', () => {
    const doctor = readRepoFile('scripts', 'doctor.js');

    assert.match(doctor, /new Database\(':memory:'\)/, 'doctor should instantiate better-sqlite3 to catch ABI mismatches');
    assert.match(doctor, /SQLite native module/, 'doctor should report the sqlite native module check');
});

test('critical db migrations add grouped columns independently', () => {
    const dbSource = readRepoFile('server', 'db.js');

    assert.match(dbSource, /function addColumnIfMissing/, 'db migrations should use schema-aware column creation');
    assert.match(dbSource, /addColumnIfMissing\('group_messages', 'sender_name', 'TEXT'\)/, 'sender_name should be checked independently');
    assert.match(dbSource, /addColumnIfMissing\('group_messages', 'sender_avatar', 'TEXT'\)/, 'sender_avatar should be checked independently');
    assert.match(dbSource, /addColumnIfMissing\('messages', 'is_summarized', 'INTEGER DEFAULT 0'\)/, 'private message summary flag should be checked independently');
    assert.match(dbSource, /addColumnIfMissing\('group_messages', 'is_summarized', 'INTEGER DEFAULT 0'\)/, 'group message summary flag should be checked independently');
    assert.match(dbSource, /addColumnIfMissing\('characters', 'memory_api_endpoint', 'TEXT'\)/, 'character memory endpoint migration should be checked explicitly');
    assert.match(dbSource, /addColumnIfMissing\('characters', 'memory_api_key', 'TEXT'\)/, 'character memory key migration should be checked explicitly');
    assert.match(dbSource, /addColumnIfMissing\('characters', 'memory_model_name', 'TEXT'\)/, 'character memory model migration should be checked explicitly');
    assert.match(dbSource, /addColumnIfMissing\('characters', 'tts_enabled', 'INTEGER DEFAULT 0'\)/, 'character TTS enabled migration should be checked explicitly');
    assert.match(dbSource, /addColumnIfMissing\('characters', 'tts_provider', "TEXT DEFAULT 'tencent'"\)/, 'character TTS provider migration should be checked explicitly');
    assert.match(dbSource, /addColumnIfMissing\('characters', 'tts_trigger_mode', "TEXT DEFAULT 'tagged'"\)/, 'character TTS trigger migration should be checked explicitly');
    assert.match(dbSource, /addColumnIfMissing\('characters', 'llm_debug_capture', 'INTEGER DEFAULT 1'\)/, 'character LLM debug migration should match fresh-schema defaults');
    assert.doesNotMatch(
        dbSource,
        /ALTER TABLE group_messages ADD COLUMN sender_name TEXT['"`\s\S]*ALTER TABLE group_messages ADD COLUMN sender_avatar TEXT/,
        'sender_name and sender_avatar migrations must not share a silent try/catch block'
    );
    assert.doesNotMatch(
        dbSource,
        /try \{ db\.prepare\(['"]ALTER TABLE characters ADD COLUMN (?:memory_api|tts_)/,
        'character memory/TTS migrations must not silently catch ALTER TABLE failures'
    );
    assert.doesNotMatch(
        dbSource,
        /ALTER TABLE characters ADD COLUMN llm_debug_capture INTEGER DEFAULT 0/,
        'character LLM debug migration must not diverge from the fresh-schema default'
    );
});

test('city db migrations check columns after tables exist', () => {
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');

    assert.match(cityDbSource, /function addColumnIfMissing/, 'city migrations should use schema-aware column creation');
    assert.match(cityDbSource, /CREATE TABLE IF NOT EXISTS city_quests[\s\S]*addColumnIfMissing\('city_quests', 'target_district'/, 'city_quests columns should be added after the table exists');
    assert.doesNotMatch(cityDbSource, /try \{ db\.exec\("ALTER TABLE city_quests ADD COLUMN/, 'city_quests migrations should not silently run before table creation');
    assert.match(cityDbSource, /addColumnIfMissing\('characters', 'calories', 'INTEGER DEFAULT 2000'\)/, 'city character columns should be checked explicitly');
    assert.match(cityDbSource, /addColumnIfMissing\('city_items', 'stock', 'INTEGER DEFAULT -1'\)/, 'city item stock migration should be checked explicitly');
});

test('city admin grant routes reject invalid numeric inputs', () => {
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const inputGuards = readRepoFile('server', 'plugins', 'city', 'utils', 'inputGuards.js');
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');

    assert.match(inputGuards, /const MAX_CITY_GOLD_GRANT = 1000000/, 'city gold grants should have a bounded maximum');
    assert.match(inputGuards, /const MAX_CITY_CALORIES_GRANT = 4000/, 'city calorie grants should cap at the frontend range');
    assert.match(inputGuards, /const MAX_CITY_ITEM_QUANTITY = 100/, 'city item grants should reject excessive quantities');
    assert.match(inputGuards, /const MAX_CITY_TIME_SKIP_MINUTES = 1440/, 'city time skips should match the frontend one-day slider');
    assert.match(inputGuards, /if \(!Number\.isFinite\(amount\) \|\| amount <= 0 \|\| amount > max\) return null/, 'money guard should reject negative, zero, non-finite, and over-limit values');
    assert.match(inputGuards, /if \(!Number\.isFinite\(parsed\) \|\| !Number\.isInteger\(parsed\)\) return null/, 'integer guard should reject fractional and non-finite values');

    assert.match(coreRoutes, /const minutes = normalizeCityTimeSkipMinutes\(req\.body\?\.minutes\)/, 'time skip route should normalize minutes before writes');
    assert.match(coreRoutes, /const oldDays = normalizeStoredCityOffsetDays\(config\.city_time_offset_days\)/, 'time skip should read stored day offsets without loose parsing');
    assert.match(coreRoutes, /const oldHours = normalizeStoredCityOffsetHours\(config\.city_time_offset_hours\)/, 'time skip should preserve fractional stored hour offsets');
    assert.doesNotMatch(coreRoutes, /parseInt\(config\.city_time_offset_hours\)/, 'time skip must not truncate fractional hour offsets');
    assert.match(coreRoutes, /const giftAmount = normalizeCityGoldAmount\(amount\)/, 'gold route should normalize grant amounts before wallet writes');
    assert.match(coreRoutes, /const addCals = normalizeCityCalories\(calories\)/, 'feed route should normalize calories before state writes');
    assert.match(coreRoutes, /const safeQuantity = normalizeCityItemQuantity\(quantity\)/, 'give-item route should normalize quantities before inventory writes');
    assert.doesNotMatch(coreRoutes, /const giftAmount = Number\(amount\) \|\| 0/, 'gold route must not turn invalid values into zero');
    assert.doesNotMatch(coreRoutes, /const addCals = Number\(calories\) \|\| 1000/, 'feed route must not turn invalid values into a default grant');
    assert.doesNotMatch(coreRoutes, /const safeQuantity = quantity \|\| 1/, 'give-item route must not turn invalid values into a default item grant');

    assert.match(cityDbSource, /const safeQty = Number\(qty\)/, 'city DB inventory writes should normalize quantities defensively');
    assert.match(cityDbSource, /if \(!Number\.isSafeInteger\(safeQty\) \|\| safeQty < 1\) throw new Error\('物品数量无效'\)/, 'city DB inventory writes should reject non-positive quantities');
    assert.doesNotMatch(cityDbSource, /quantity = quantity \+ \? WHERE id = \?'\)\.run\(qty/, 'city DB inventory writes must not use raw quantities');
});

test('city admin grant reply workflow is extracted without adding AI fallbacks', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const adminGrantService = readRepoFile('server', 'plugins', 'city', 'services', 'adminGrantService.js');
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');

    assert.match(cityIndex, /require\('\.\/services\/adminGrantService'\)/, 'city plugin should import the admin grant service');
    assert.match(cityIndex, /const \{ triggerAdminGrantChat \} = createAdminGrantService\(/, 'city plugin should create the admin grant service');
    assert.doesNotMatch(cityIndex, /function buildGrantReplyDirective/, 'city index should not keep grant prompt construction inline');
    assert.doesNotMatch(cityIndex, /async function triggerAdminGrantChat/, 'city index should not keep grant chat workflow inline');

    assert.match(adminGrantService, /function buildGrantReplyDirective/, 'admin grant service should own grant prompt construction');
    assert.match(adminGrantService, /async function triggerAdminGrantChat/, 'admin grant service should own grant chat triggering');
    assert.match(adminGrantService, /normalizeCityGoldAmount/, 'admin grant service should reuse strict city gold validation');
    assert.match(adminGrantService, /normalizeCityCalories/, 'admin grant service should reuse strict city calorie validation');
    assert.match(adminGrantService, /normalizeCityItemQuantity/, 'admin grant service should reuse strict city item quantity validation');
    assert.doesNotMatch(adminGrantService, /Number\(details\.amount \|\| 0\)/, 'admin grant service must not turn invalid amounts into zero');
    assert.doesNotMatch(adminGrantService, /details\.quantity \|\| 1/, 'admin grant service must not turn invalid item quantities into one');
    assert.match(adminGrantService, /propagateError: true/, 'admin grant replies should propagate AI failures to the caller');
    assert.doesNotMatch(adminGrantService, /fallback|default reply|默认回复|兜底/, 'admin grant service must not add fallback AI replies');
    assert.doesNotMatch(coreRoutes, /triggerAdminGrantChat\([^;]+\.catch\(/, 'city grant routes should not swallow admin grant chat failures');
});

test('city suggested actions require strict generated logs before writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const suggestStart = cityIndex.indexOf('async function maybeTriggerSuggestedCityAction');
    const suggestEnd = cityIndex.indexOf('function normalizeSurvivalState', suggestStart);
    assert.notEqual(suggestStart, -1, 'city suggested action handler should exist');
    assert.notEqual(suggestEnd, -1, 'city suggested action handler should end before survival helpers');
    const suggestBlock = cityIndex.slice(suggestStart, suggestEnd);

    assert.match(suggestBlock, /decision = tryParseCityActionReply\(reply\)/, 'suggested action decisions should use the strict full-object parser');
    assert.match(suggestBlock, /catch \(err\) \{[\s\S]*return \{ triggered: false, reason: err\.message, canRetry: true \}/, 'suggested action parse/model failures should be retryable non-actions');
    assert.match(suggestBlock, /return \{ triggered: false, reason: 'missing_model_config', canRetry: true \}/, 'suggested actions should not rule-fallback without model config');
    assert.match(suggestBlock, /const district = candidates\.find\(d => d\.id === decision\.district_id\)/, 'suggested actions should only execute candidate districts from the user content');
    assert.match(suggestBlock, /const log = String\(decision\.log \|\| ''\)\.trim\(\);[\s\S]*if \(!log\) return \{ triggered: false, reason: 'missing_log', canRetry: true \}/, 'accepted suggested actions should require a generated log');
    assert.match(suggestBlock, /const narrations = \{[\s\S]*log,[\s\S]*await applyDecision\(district, char, db, userId, currentCals, config, activeEvents, narrations/, 'suggested actions should write only after generated narration is available');
    assert.doesNotMatch(suggestBlock, /jsonMatch|cleaned\.match\(\/\\\{\[\\s\\S\]\*\\\}\/\)|建议行动文案生成失败|buildCollapsedCityLog\(char, '建议行动文案生成失败'|districts\.find\(d => d\.id === decision\.district_id\) \|\| candidates/, 'suggested action generation failures should not be sliced, fallback logged, or broadened beyond candidates');
});

test('city actions force exhausted characters to rest before task or schedule actions', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');

    assert.match(cityIndex, /function getExhaustionRestOverride/, 'city actions should have an exhaustion override helper');
    assert.match(cityIndex, /state\.sleep_debt >= 90/, 'severe sleep debt should trigger exhaustion protection');
    assert.match(cityIndex, /const restOverride = getExhaustionRestOverride\(char, currentCals, districts, targetDistrict\)/, 'scheduled or quest targets should be checked before prompt generation');
    assert.match(cityIndex, /【强制休整】/, 'the action prompt should explicitly describe forced rest');
    assert.match(cityIndex, /本轮不要带 quest_intent/, 'forced rest should suppress quest progression tags');
    assert.match(cityIndex, /const postChoiceRestOverride = getExhaustionRestOverride\(char, currentCals, districts, district\)/, 'model-selected actions should get a post-parse exhaustion guard');
    assert.match(cityIndex, /applyDecision\(postChoiceRestOverride, char, db, userId, currentCals, config, activeEvents, restNarrations/, 'post-parse exhaustion guard should execute the rest action');
});

test('autonomous city action parser tolerates quoted narration text', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const serverIndex = readRepoFile('server', 'index.js');
    const { parseCityActionNarrations, sanitizeCityNarrationText } = require(path.join(repoRoot, 'server', 'plugins', 'city', 'utils', 'actionNarrationParser'));

    assert.match(cityIndex, /parseCityActionNarrations\(reply\)/, 'autonomous city actions should use the narration parser');
    assert.match(cityIndex, /const explicitDiary = sanitizeCityNarrationText\(richNarrations\?\.diary\)/, 'city diary bridge should clean internal structured fields before saving');
    assert.match(serverIndex, /content: sanitizeCityNarrationText\(diary\.content\)/, 'diary reads should hide old internal structured fields from the UI');
    assert.match(cityIndex, /正文内如需引用话语，优先使用中文引号/, 'city action prompt should discourage raw JSON-breaking quotes');

    const valid = parseCityActionNarrations('```json\n{"action":"[HOME]","log":"休息。","chat":"","moment":"","diary":""}\n```');
    assert.equal(valid.action, '[HOME]');
    assert.equal(valid.log, '休息。');

    const loose = parseCityActionNarrations(`\`\`\`json
{
  "action": "[HOME]",
  "log": "她说"只需要产品需求"，我记下了。

然后靠回沙发休息。",
  "chat": "那句"要么我也成为黑客"我听见了。",
  "moment": "",
  "diary": "明天再拆。"
}
\`\`\``);
    assert.equal(loose.action, '[HOME]');
    assert.match(loose.log, /只需要产品需求/);
    assert.match(loose.chat, /要么我也成为黑客/);
    assert.equal(loose.diary, '明天再拆。');

    const looseWithNull = parseCityActionNarrations(`\`\`\`json
{
  "action": "[RESTAURANT]",
  "log": "她说"渠道没渗水"，我听懂了。",
  "chat": "你那句"渠道没渗水"是什么意思，嫌我中间抽了一下风？",
  "moment": null,
  "diary": "面很烫，蛋很好。"
}
\`\`\``);
    assert.equal(looseWithNull.action, '[RESTAURANT]');
    assert.match(looseWithNull.log, /渠道没渗水/);
    assert.match(looseWithNull.chat, /中间抽了一下风/);
    assert.equal(looseWithNull.moment, '');
    assert.equal(looseWithNull.diary, '面很烫，蛋很好。');

    const leakedQuestIntent = parseCityActionNarrations(`\`\`\`json
{
  "action": "[SCHOOL]",
  "log": "她把公告纸叠起来。",
  "chat": "",
  "moment": "",
  "diary": "她确实想知道那个卖身契设定背后到底是什么。";
  "quest_intent": {"quest_id": 180, "stage": "claim"}
}
\`\`\``);
    assert.equal(leakedQuestIntent.diary, '她确实想知道那个卖身契设定背后到底是什么。');
    assert.deepEqual(leakedQuestIntent.quest_intent, { quest_id: 180, stage: 'claim' });
    assert.equal(
        sanitizeCityNarrationText('她确实想知道那个卖身契设定背后到底是什么。";\n"quest_intent": {"quest_id": 180, "stage": "claim"}'),
        '她确实想知道那个卖身契设定背后到底是什么。'
    );
});

test('city behavior generation returns retryable errors instead of fallback patches', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const pixelWorldPanel = readPixelWorldSources();
    const parserStart = cityIndex.indexOf('function repairUnescapedJsonStringQuotes');
    const parserEnd = cityIndex.indexOf('async function fetchBehaviorModelList', parserStart);
    assert.notEqual(parserStart, -1, 'behavior JSON parser should exist');
    assert.notEqual(parserEnd, -1, 'behavior JSON parser should end before model-list fetcher');
    const parserBlock = cityIndex.slice(parserStart, parserEnd);
    const repairedBehaviorJson = vm.runInNewContext(`${parserBlock}
parseJsonObjectFromLlmText(${JSON.stringify('{"reason":"玩家在预设互动末尾选了"叫他换地方"，指定云朵梦幻床。","node":{"steps":[]}}')})`);
    assert.equal(repairedBehaviorJson.reason, '玩家在预设互动末尾选了"叫他换地方"，指定云朵梦幻床。', 'behavior parser should repair unescaped quote characters inside JSON string values');

    assert.match(cityIndex, /function createCityError\(message, status = 500, canRetry = false\)/, 'city plugin should use explicit HTTP errors for behavior generation failures');
    assert.match(cityIndex, /throw createCityError\('行为树生成缺少模型 URL\/Key\/模型名，请补全后重试。', 400, true\)/, 'behavior branch generation should reject missing model config');
    assert.match(cityIndex, /throw createCityError\(`行为树生成返回的 JSON 无法解析，请重试：/, 'behavior branch generation should fail invalid model JSON');
    assert.match(cityIndex, /if \(!treePatch\) \{\s*throw createCityError\('行为树生成结果没有可用的行为步骤，请重试。', 502, true\)/, 'behavior branch generation should fail invalid sanitized output');
    assert.match(cityIndex, /throw createCityError\('基础枝丫生成缺少模型 URL\/Key\/模型名，请补全后重试。', 400, true\)/, 'base branch generation should reject missing model config');
    assert.match(cityIndex, /throw createCityError\(`基础枝丫生成返回的 JSON 无法解析，请重试：/, 'base branch generation should fail invalid model JSON');
    assert.match(cityIndex, /if \(!sanitized\.base_patches\.length\) \{\s*throw createCityError\('基础枝丫生成结果没有可用的行为步骤，请重试。', 502, true\)/, 'base branch generation should fail empty sanitized output');
    assert.match(cityIndex, /schema: \{[\s\S]*base_branches:[\s\S]*interaction_branches:/, 'behavior tree branch pack contract should include generated interaction starter branches');
    assert.match(cityIndex, /function sanitizeBehaviorInteractionStarterPack\(rawValue, char, payload = \{\}, fallbackReason = 'starter_pack_invalid', allowedPlaceIds = \[\]\)/, 'behavior generation should sanitize interaction starter branches into player_interaction patches');
    assert.match(cityIndex, /interaction_branches: generated\.interaction_branches \|\| \[\],[\s\S]*interaction_patches: generated\.interaction_patches \|\| \[\]/, 'behavior base route should return generated interaction starter branches');
    assert.match(cityIndex, /活跃度规则：每条特殊枝丫在 offer_choices 前要有 3-5 个可见步骤，至少 1 个身体动作或移动步骤，至少 2 个 say\/emote/, 'special behavior branches should prompt for visible movement and more short speech');
    assert.match(cityIndex, /活跃度规则：除 movement_recovery 外，每条 base_branch 要有 4-7 个步骤，至少 2 个身体动作\/移动\/地点停留步骤，至少 1 个 say/, 'base behavior branches should prompt for livelier movement and speech');
    assert.match(cityIndex, /interaction_branches 每条 4-6 个步骤[\s\S]*前面至少 2 个 say\/emote 和 1 个身体动作或移动步骤/, 'interaction starter branches should also require movement and speech before choices');
    const behaviorModelFallbackMatches = cityIndex.match(/const payloadModelName = limitText\(payload\.model_name \|\| payload\.model \|\| '', 200\);\s*const modelName = usePayloadCredentials\s*\?\s*limitText\(payloadModelName \|\| char\?\.model_name \|\| '', 200\)\s*:\s*limitText\(char\?\.model_name \|\| '', 200\);/g) || [];
    assert.equal(behaviorModelFallbackMatches.length, 2, 'behavior generation should only use panel model overrides when panel URL and Key are both provided');
    assert.match(cityIndex, /res\.status\(e\.status \|\| 500\)\.json\(\{\s*error: e\.message,[\s\S]*canRetry/, 'behavior routes should return retryable error metadata');
    assert.match(parserBlock, /function repairUnescapedJsonStringQuotes\(text = ''\)[\s\S]*nextChar === ':'[\s\S]*nextChar === ','[\s\S]*repaired \+= char[\s\S]*repaired \+=/, 'behavior JSON parser should narrowly repair unescaped quote characters inside strings');
    assert.match(parserBlock, /function parseJsonObjectFromLlmText\(text\)[\s\S]*try \{[\s\S]*return JSON\.parse\(cleaned\)[\s\S]*const repaired = repairUnescapedJsonStringQuotes\(cleaned\)[\s\S]*return JSON\.parse\(repaired\)/, 'behavior generation should parse full JSON and only retry with narrow string-quote repair');
    assert.match(cityIndex, /JSON 字符串内部不要使用未转义英文双引号/, 'behavior prompts should warn models not to emit bare quote characters inside JSON strings');
    assert.match(cityIndex, /choice\.trigger 为 suggest_destination[\s\S]*必须填写 choice\.place_id[\s\S]*allowed_place_ids/, 'behavior prompts should require destination choices to carry an allowed place_id');
    assert.doesNotMatch(cityIndex, /if \(trigger === 'suggest_destination' && !choicePlaceId\) return null/, 'behavior sanitizer should not silently drop suggest_destination choices without an allowed place_id');
    assert.match(cityIndex, /const userDisplayName = limitText\(userProfile\.name \|\| payload\.user\?\.name \|\| payload\.userName \|\| '', 80\) \|\| '用户'/, 'behavior input should use the configured user display name');
    assert.match(cityIndex, /function personalizeBehaviorPromptText\(text = '', userDisplayName = ''\)[\s\S]*source\.replace\(\/玩家\|用户\/g, displayName\)/, 'behavior input should replace generic user/player wording with the configured name before the model sees it');
    assert.match(cityIndex, /return personalizeBehaviorPromptValue\(inputPackage, userDisplayName\)/, 'behavior input packages should be personalized before being returned or logged');
    assert.match(cityIndex, /const personalizePrompt = \(text\) => personalizeBehaviorPromptText\(text, promptUserDisplayName\)/, 'behavior prompt text should be personalized before LLM calls');
    assert.doesNotMatch(cityIndex, /不要把“玩家”当成用户姓名|naming_rule:/, 'behavior prompts should not carry a separate naming rule for the model');
    assert.match(pixelWorldPanel, /function getBehaviorUserDisplayName\(\) \{[\s\S]*userProfile\?\.name[\s\S]*\|\| '用户'/, 'PixelWorld behavior payloads should read the configured user display name');
    assert.match(pixelWorldPanel, /actor_name: getBehaviorUserDisplayName\(\)/, 'PixelWorld behavior events should include the configured user display name');
    assert.match(pixelWorldPanel, /label: isUserActor \? displayName : label/, 'PixelWorld user actor labels should use the configured display name directly');
    assert.equal((pixelWorldPanel.match(/function resolveBehaviorChoicePlaceIdFromPlaces\(choice = \{\}, triggerAction = '', behaviorPlaces = \[\], fallbackPlaceOptions = \[\]\)/g) || []).length, 1, 'behavior choice destination text resolution should live in the shared behavior tree core');
    assert.equal((pixelWorldPanel.match(/resolveBehaviorChoicePlaceIdFromPlaces\(\s*choice,\s*triggerAction,\s*behaviorOrderedPlaces,\s*behaviorPlaceOptions\s*\)/g) || []).length, 2, 'commercial and room behavior choices should both use the shared destination place resolver');
    assert.equal((pixelWorldPanel.match(/triggerAction === 'suggest_destination' && !nextPlaceId/g) || []).length, 2, 'suggest_destination choices without a resolved place should not fall back to the currently selected place');
    assert.match(cityIndex, /const behaviorPlayerInteractionActionSet = new Set\(behaviorPlayerInteractionActions\)/, 'behavior choice triggers should share the player interaction action whitelist');
    assert.match(cityIndex, /function normalizeBehaviorChoiceTrigger\(choice = \{\}\) \{[\s\S]*choice\?\.nextAction[\s\S]*choice\?\.id[\s\S]*behaviorPlayerInteractionActionSet\.has\(value\)/, 'behavior choice sanitizer should recover valid trigger actions from model choice aliases');
    assert.match(cityIndex, /const normalizedChoices = step\.choices\.slice\(0, 4\)\.map[\s\S]*choice\.place_id \|\| choice\.placeId \|\| choice\.to_place_id \|\| choice\.toPlaceId[\s\S]*if \(action === 'offer_choices' && !normalizedChoices\.length\) return null/, 'offer_choices steps should drop dead choices instead of displaying non-generating buttons');
    assert.match(cityIndex, /const hasStepLimit = Number\.isFinite\(Number\(maxSteps\)\) && Number\(maxSteps\) > 0[\s\S]*if \(!hasStepLimit \|\| sanitizedSteps\.length <= stepLimit\) return sanitizedSteps/, 'behavior step sanitizer should support unlimited cleaned steps');
    assert.match(cityIndex, /const firstChoiceStepIndex = sanitizedSteps\.findIndex[\s\S]*firstChoiceStepIndex >= stepLimit[\s\S]*sanitizedSteps\.slice\(0, Math\.max\(0, stepLimit - 1\)\)[\s\S]*sanitizedSteps\[firstChoiceStepIndex\]/, 'limited behavior step truncation should preserve a valid trailing offer_choices step');
    assert.match(cityIndex, /const steps = sanitizeBehaviorSteps\(rawBranch\.steps, allowedPlaceIds, null, \{ allowChoices: true \}\)/, 'special interaction branches should not impose a hard step-count limit');
    assert.match(cityIndex, /function behaviorBranchHasOfferChoices\(branch = \{\}\)[\s\S]*step\?\.action === 'offer_choices'[\s\S]*step\.choices\.length > 0/, 'special interaction branches should be checked for real follow-up choices');
    assert.match(cityIndex, /if \(targetNodeId === 'player_interaction' && !behaviorBranchHasOfferChoices\(branch\)\) return null/, 'player_interaction patches should not accept one-shot branches without choices');
    assert.match(cityIndex, /特殊枝丫最后一步必须是 offer_choices，给 2-4 个玩家回应选项/, 'special branch prompt should require follow-up player choices');
    assert.match(pixelWorldPanel, /function resolveBehaviorChoiceTrigger\(choice = \{\}\) \{[\s\S]*choice\?\.nextAction[\s\S]*choice\?\.id[\s\S]*commercialV2BehaviorActionIds\.has\(value\)/, 'PixelWorld should resolve branch choice triggers from all accepted aliases');
    assert.match(pixelWorldPanel, /function normalizeBehaviorDialogChoices\(choices\)[\s\S]*return label && trigger \? \{ id: trigger, label, trigger \} : null[\s\S]*if \(!trigger\) return null/, 'PixelWorld should avoid presenting choices that cannot generate a follow-up branch');
    assert.equal((pixelWorldPanel.match(/const triggerAction = resolveBehaviorChoiceTrigger\(choice\)/g) || []).length, 2, 'commercial and room follow-up choices should both use the shared trigger resolver');
    assert.match(pixelWorldPanel, /function formatBehaviorRequestError\(error, fallback = '请求失败，请重试。'\)[\s\S]*AbortError[\s\S]*请求超时，请重试。/, 'PixelWorld should surface behavior generation timeouts as retryable user-visible errors');
    assert.match(pixelWorldPanel, /const commercialV2BehaviorGenerationTimeoutMs = 0/, 'behavior generation should allow the frontend to wait without a local timeout');
    assert.match(pixelWorldPanel, /fetchBehaviorJsonWithTimeout\(`\$\{apiUrl\}\/city\/characters\/\$\{encodeURIComponent\(behaviorCharacterId\)\}\/behavior-branch`[\s\S]*commercialV2BehaviorGenerationTimeoutMs\)/, 'special branch generation should use the shared no-timeout behavior request setting');
    assert.match(pixelWorldPanel, /return \{ ok: false, error: message \}/, 'special branch generation should report failure to the choice dialog instead of hiding it in a folded panel');
    assert.match(pixelWorldPanel, /const branchResult = await generateBehaviorBranch\(\{ actionId: triggerAction, placeId: nextPlaceId \|\| behaviorPlaceId \}\)[\s\S]*后续枝丫生成失败：\$\{branchResult\?\.error \|\| '请重试。'\}[\s\S]*choices: previousDialog\?\.choices\?\.length \? previousDialog\.choices : \[choice\]/, 'PixelWorld should keep branch choices visible when follow-up generation fails');
    assert.match(pixelWorldPanel, /function buildBehaviorPendingInput\(options = \{\}, note = '当前前端请求；服务端会重新补齐 large_input。'\)[\s\S]*debug_source: 'client_pending_behavior_request'/, 'PixelWorld debug input should show the current pending request instead of stale server input');
    assert.match(pixelWorldPanel, /const requestPayload = buildBehaviorPayload\(\{ actionId, placeId \}\);[\s\S]*setBehaviorInput\(buildBehaviorPendingInput\([\s\S]*当前点击选项产生的请求[\s\S]*setBehaviorOutput\(null\)[\s\S]*\.\.\.requestPayload/, 'special branch generation should refresh debug input/output before calling the server');
    assert.match(pixelWorldPanel, /function pickGeneratedInteractionStarterBranch\(treeState, actionId, placeId = '', allowedPlaceIds = \[\], ownerCharacterId = ''\)[\s\S]*ai-interaction-starter/, 'PixelWorld should find generated starter branches from player_interaction before using local fallback presets');
    assert.match(pixelWorldPanel, /const generatedStarterBranch = pickGeneratedInteractionStarterBranch[\s\S]*executeBehaviorBranch\(presetBranch, generatedStarterBranch\?\.source \|\| 'preset'\)/, 'player interactions should execute generated behavior-tree starter branches before falling back to local presets');
    assert.match(pixelWorldPanel, /const commercialV2BehaviorInteractionSessionIdleMs = 180000/, 'PixelWorld should keep an interaction session lock long enough for multi-turn player choices');
    assert.match(pixelWorldPanel, /function keepBehaviorInteractionSessionActive\(\)[\s\S]*expiresAt: Date\.now\(\) \+ commercialV2BehaviorInteractionSessionIdleMs[\s\S]*autonomousBehaviorCooldownRef\.current = Date\.now\(\) \+ commercialV2BehaviorInteractionSessionIdleMs/, 'player interactions should extend the autonomous behavior cooldown while the dialogue is active');
    assert.match(pixelWorldPanel, /function isBehaviorInteractionSessionActive\(\)[\s\S]*behaviorInteractionSessionRef\.current = \{ active: false, expiresAt: 0 \}[\s\S]*return true/, 'expired interaction locks should self-clear before autonomous behavior resumes');
    assert.match(pixelWorldPanel, /if \(isBehaviorInteractionSessionActive\(\)\) return/, 'autonomous behavior should pause while a player interaction session is alive');
    assert.equal((pixelWorldPanel.match(/if \(!behaviorCharacterId \|\| !behaviorOrderedPlaces\.length\) return;/g) || []).length, 2, 'commercial and room autonomous behavior should stay bound to the selected AI character');
    assert.match(pixelWorldPanel, /function buildCommercialBehaviorSourceOwnerMeta\(source = '', characterId = '', character = null\)[\s\S]*isCommercialBehaviorAiSource\(source\)[\s\S]*buildCommercialBehaviorOwnerMeta\(characterId, character\)/, 'AI behavior patches should derive an owner from the selected character');
    assert.match(pixelWorldPanel, /owner_character_id: ownerCharacterId[\s\S]*owner_character_name: ownerCharacterName/, 'AI behavior patch nodes should persist owner metadata');
    assert.match(pixelWorldPanel, /function mergeCommercialBehaviorTreePatchesForRuntime\(currentTree, rawPatches = \[\], source = 'manual', characterId = '', character = null\)[\s\S]*const ownerMeta = buildCommercialBehaviorSourceOwnerMeta\(patchSource, characterId, character\)/, 'merged AI behavior patch packs should bind to the selected AI character');
    assert.match(pixelWorldPanel, /commercialBehaviorBranchMatchesOwner\(branch, behaviorCharacterId\)/, 'autonomous behavior candidates should be filtered by owner character');
    assert.match(pixelWorldPanel, /const commercialV2BehaviorAutonomousCooldownMs = 6200;[\s\S]*const commercialV2BehaviorNearbyCooldownMs = 3000;/, 'autonomous behavior should run often enough to feel alive without interrupting interactions');
    assert.match(pixelWorldPanel, /function sortCommercialBehaviorBranchesByLiveliness\(branches = \[\]\)[\s\S]*getCommercialBehaviorBranchLivelinessScore/, 'autonomous behavior should score livelier branches first');
    assert.equal((pixelWorldPanel.match(/sortCommercialBehaviorBranchesByLiveliness\(freshCandidates\.length \? freshCandidates : candidates\)/g) || []).length, 2, 'commercial and room autonomous behavior should both prefer livelier generated branches');
    assert.match(pixelWorldPanel, /pickGeneratedInteractionStarterBranch\([\s\S]*behaviorOrderedPlaces\.map\(\(place\) => place\.placeId\),\s*\n\s*behaviorCharacterId/, 'generated interaction starter branches should be selected for the current AI character only');
    assert.match(pixelWorldPanel, /const commercialV2BehaviorTravelFailureTrigger = 'runtime_state\.travel_failed'[\s\S]*'movement_recovery'[\s\S]*base_travel_blocked_recover/, 'behavior trees should include a base movement recovery branch for travel failures');
    assert.match(pixelWorldPanel, /function pickCommercialBehaviorBaseBranchByTrigger\(treeState, triggerId = '', allowedPlaceIds = \[\], ownerCharacterId = ''\)[\s\S]*commercialBehaviorBranchHasTrigger\(branch, triggerId\)/, 'runtime events should select base behavior branches by trigger');
    assert.equal((pixelWorldPanel.match(/!commercialBehaviorBranchIsTravelRecovery\(branch\)/g) || []).length, 2, 'movement recovery branches should not enter ordinary commercial or room autonomous polling');
    assert.equal((pixelWorldPanel.match(/function activateBehaviorTravelFailureBranch\(details = \{\}\)/g) || []).length, 2, 'commercial and room runtimes should both trigger the movement recovery base branch');
    assert.equal((pixelWorldPanel.match(/reason: 'travel_start_failed'/g) || []).length, 2, 'failed movement step starts should trigger movement recovery in both runtimes');
    assert.equal((pixelWorldPanel.match(/reason: 'travel_blocked'/g) || []).length, 2, 'blocked behavior travel should trigger movement recovery in both runtimes');
    assert.match(cityIndex, /const behaviorBasePatchTargetIds = new Set\(\[[\s\S]*'movement_recovery'[\s\S]*'idle_micro'[\s\S]*\]\)/, 'backend base branch targets should allow movement recovery');
    assert.match(cityIndex, /movement_recovery 是运行时移动失败专用基础枝丫[\s\S]*runtime_state\.travel_failed/, 'base-branch prompts should describe movement recovery as a travel-failure-only branch');
    assert.match(pixelWorldPanel, /setInteractionMenuOpen\(false\);\s*keepBehaviorInteractionSessionActive\(\);[\s\S]*executeBehaviorBranch\(presetBranch, generatedStarterBranch\?\.source \|\| 'preset'\)/, 'starting a player interaction should lock out autonomous behavior before executing the starter branch');
    assert.match(pixelWorldPanel, /behaviorChoicePendingRef\.current = true;\s*keepBehaviorInteractionSessionActive\(\);[\s\S]*await generateBehaviorBranch\(\{ actionId: triggerAction, placeId: nextPlaceId \|\| behaviorPlaceId \}\)/, 'choosing a follow-up option should keep the interaction session active while the model generates the next branch');
    assert.equal((pixelWorldPanel.match(/function exitBehaviorDialog\(\)/g) || []).length, 2, 'commercial and room behavior dialogs should both expose an exit handler');
    assert.match(pixelWorldPanel, /function exitBehaviorDialog\(\) \{[\s\S]*behaviorInteractionSessionRef\.current = \{ active: false, expiresAt: 0 \}[\s\S]*clearBehaviorRuntime\('已退出互动对话。'\)/, 'exiting a behavior dialog should clear the runtime and interaction lock');
    assert.equal((pixelWorldPanel.match(/className="pixel-world-behavior-dialog-exit"/g) || []).length, 4, 'behavior choice dialogs should render exit buttons in side panels and stage bubbles');
    assert.match(pixelWorldPanel, /\.pixel-world-behavior-dialog-choices \.pixel-world-behavior-dialog-exit,[\s\S]*\.pixel-world-behavior-runtime-choice-grid \.pixel-world-behavior-dialog-exit[\s\S]*grid-column: 1 \/ -1/, 'behavior dialog exit buttons should be styled as a full-width choice action');
    assert.match(pixelWorldPanel, /if \(!isBaseBranch\) keepBehaviorInteractionSessionActive\(\);[\s\S]*const branchKindLabel = isBaseBranch \? '日常行为' : '互动回应'/, 'activating an interaction branch should refresh the interaction session lock');
    assert.match(pixelWorldPanel, /keepBehaviorInteractionSessionActive\(\);\s*runtime\.waitingForChoice = true/, 'offer_choices should keep the interaction session alive until the player picks the next option');
    assert.match(pixelWorldPanel, /当前行为树互动开场枝丫[\s\S]*当前本地兜底互动请求/, 'player interaction debug input should distinguish generated starters from local fallback presets');
    assert.match(pixelWorldPanel, /interaction_patches \|\| \[\]\)\.map[\s\S]*ai-interaction-starter[\s\S]*merged_patches: patchResult\?\.patches \|\| \[\]/, 'base generation should merge interaction starter patches into the behavior tree');
    assert.match(pixelWorldPanel, /setBehaviorOutput\(\{[\s\S]*branch: null,[\s\S]*tree_patch: null,[\s\S]*fallback: false,[\s\S]*error: message/, 'failed branch generation should make the error visible in the output panel without creating fallback success');
    assert.match(pixelWorldPanel, /const contextConfig = buildCommercialBehaviorContextConfig\(behaviorConfig\)[\s\S]*const iterationRecords = buildCommercialBehaviorIterationRecords\(behaviorTreeState\)[\s\S]*patch_history: patchHistory\.slice\(0, contextConfig\.q_raw_limit\)[\s\S]*iteration_context: \{[\s\S]*records: iterationRecords/, 'PixelWorld should send q-limited behavior raw context plus iteration records for backend compression');
    assert.match(pixelWorldPanel, /'枝丫上下文'[\s\S]*q 原文窗口[\s\S]*context_q_limit[\s\S]*p 摘要阈值[\s\S]*context_summary_threshold/, 'PixelWorld behavior panel should expose q/p sliders for branch iteration context');
    assert.match(pixelWorldPanel, /function buildCommercialBehaviorContextStats\(treeState, behaviorConfig = \{\}\)[\s\S]*pending_summary_count: pendingRecords\.length[\s\S]*active_summary_count: summaries\.slice\(-config\.max_summary_rounds\)\.length/, 'PixelWorld should compute behavior summary progress from the same q/p and cursor model as the backend');
    assert.match(pixelWorldPanel, /stats: contextStats,[\s\S]*records: iterationRecords/, 'behavior debug payloads should include branch context progress stats');
    assert.equal((pixelWorldPanel.match(/摘要积攒：/g) || []).length, 2, 'commercial and room behavior panels should show pending summary progress counts');
    assert.equal((pixelWorldPanel.match(/behaviorContextStats\.pending_summary_count/g) || []).length, 2, 'commercial and room behavior panels should read the pending summary counter');
    assert.equal((pixelWorldPanel.match(/原文 \{behaviorContextStats\.raw_readable_count\} \/ \{behaviorContextStats\.q_raw_limit\} 条/g) || []).length, 2, 'commercial and room behavior panels should show the live raw branch window usage');
    assert.match(pixelWorldPanel, /function createCommercialBehaviorTreeRebuildState\(currentTree = null, defaultTreeId = 'street_runtime_single_character'\)[\s\S]*memory: \{\},[\s\S]*patch_history: \[\]/, 'behavior full rebuilds should start from a clean branch context');
    assert.equal((pixelWorldPanel.match(/function summarizeBehaviorTreeForPayload\(treeState = behaviorTreeState\)/g) || []).length, 2, 'commercial and room behavior payload summaries should accept an explicit tree snapshot');
    assert.equal((pixelWorldPanel.match(/behavior_tree: summarizeBehaviorTreeForPayload\(options\.behaviorTreeState \|\| behaviorTreeState\)/g) || []).length, 2, 'commercial and room full rebuild requests should be able to send the clean tree snapshot');
    assert.match(pixelWorldPanel, /const rebuildTree = createCommercialBehaviorTreeRebuildState\([\s\S]*'street_runtime_single_character'[\s\S]*const requestPayload = buildBehaviorPayload\(\{ behaviorTreeState: rebuildTree \}\)[\s\S]*mergeBehaviorTreePatches\(combinedPatches, 'ai-tree', rebuildTree\)/, 'commercial full behavior regeneration should clear old branch context before request and merge');
    assert.match(pixelWorldPanel, /const rebuildTree = adaptRoomBehaviorTreeStateForPlaces\([\s\S]*createCommercialBehaviorTreeRebuildState\([\s\S]*'room_runtime_single_character'[\s\S]*behaviorOrderedPlaces[\s\S]*const requestPayload = buildBehaviorPayload\(\{ behaviorTreeState: rebuildTree \}\)[\s\S]*mergeBehaviorTreePatches\(combinedPatches, 'ai-tree', rebuildTree\)/, 'room full behavior regeneration should clear old branch context before request and merge');
    assert.match(cityIndex, /function buildBehaviorBaseRebuildPayload\(payload = \{\}\)[\s\S]*nodes: \{\},[\s\S]*memory: \{\},[\s\S]*patch_history: \[\],[\s\S]*summaries: \[\],[\s\S]*records: \[\]/, 'backend full base regeneration should hard-reset old behavior tree context even if the frontend sends stale state');
    assert.match(cityIndex, /const rebuildPayload = buildBehaviorBaseRebuildPayload\(req\.body \|\| \{\}\);[\s\S]*buildBehaviorInputPackage\(req\.user\.id, req\.db, char, rebuildPayload\)[\s\S]*createBaseBehaviorBranchesWithModel\(char, input, rebuildPayload, req\.db\)/, 'base behavior regeneration route should use the backend clean rebuild payload');
    assert.match(pixelWorldPanel, /const nextBehaviorIterationSequence = previousIterationSequence \+ 1[\s\S]*sequence: nextBehaviorIterationSequence[\s\S]*behavior_iteration_sequence: nextBehaviorIterationSequence/, 'behavior patch history should persist stable iteration sequence numbers');
    assert.match(cityIndex, /async function buildCompressedBehaviorTreeForInput\(db, char, payload = \{\}\)[\s\S]*while \(pendingRecords\.length >= config\.p_summary_threshold\)[\s\S]*summarizeBehaviorIterationBatch\(db, char, batch, config\)[\s\S]*const promptSummaries = summaries\.slice\(-BEHAVIOR_CONTEXT_MAX_SUMMARIES\)/, 'behavior input should summarize overflow iteration records before model generation and keep only the latest summaries');
    assert.match(cityIndex, /function resolveBehaviorIterationSummaryCursor\(records = \[\], summaries = \[\], incomingContext = \{\}\)[\s\S]*records\.findIndex\(\(record\) => record\.record_id === recordId\)/, 'behavior summary cursor should resolve by stable record ids');
    assert.match(cityIndex, /let pendingRecords = cursor\.found[\s\S]*overflowRecords\.slice\(cursor\.index \+ 1\)[\s\S]*: overflowRecords\.slice\(\)/, 'behavior summary pending records should use cursor position instead of drifting sequence numbers');
    assert.doesNotMatch(cityIndex, /pendingRecords = overflowRecords\.filter\(\(record\) => Number\(record\.sequence/, 'behavior summary pending records must not depend on re-numbered sequence comparisons');
    assert.match(cityIndex, /const behaviorRepeatTextActions = new Set\(\['say', 'emote', 'offer_choices', 'create_memory', 'relationship_delta'\]\)/, 'behavior anti-repeat should inspect spoken special interaction text');
    assert.match(cityIndex, /function summarizeRecentBehaviorSpecialInteractions\(behaviorTree = \{\}\)[\s\S]*collectRecentBehaviorSpecialNodes\(behaviorTree\)[\s\S]*texts: collectBehaviorNodeRepeatTexts\(node\)/, 'behavior input should expose recent special interaction text to the model');
    assert.match(cityIndex, /const behaviorTree = await buildCompressedBehaviorTreeForInput\(db, char, payload\)[\s\S]*recent_special_interactions: summarizeRecentBehaviorSpecialInteractions\(behaviorTree \|\| \{\}\)/, 'behavior input package should include recent special interactions from the compressed behavior tree');
    assert.match(cityIndex, /function inferBehaviorScene\(payload = \{\}, rawWorld = \{\}\)[\s\S]*input_kind: 'room_behavior_input_v1'[\s\S]*movement_model: 'room_semantic_v1'/, 'behavior input should infer room runtime from room payloads');
    assert.match(cityIndex, /const hasRoomPlaceId = candidatePlaceIds\.some[\s\S]*room-anchor:[\s\S]*room-point:[\s\S]*const isRoom = sceneType === 'room' \|\| movementModel\.includes\('room'\) \|\| hasRoomPlaceId \|\| hasRoomLayout/, 'room anchor ids should make behavior input use room scene context even when scene.type is missing');
    assert.match(cityIndex, /function summarizeBehaviorRoomLayout\(rawLayout = \{\}\)[\s\S]*current_ascii[\s\S]*furniture: furniture\.slice\(0, 60\)/, 'room behavior input should expose current room ASCII and furniture context');
    assert.match(cityIndex, /\.\.\.\(roomLayout \? \{ room_layout: roomLayout \} : \{\}\)/, 'behavior input package should include room_layout only for room scenes');
    assert.match(pixelWorldPanel, /scene:\s*\{[\s\S]*type: 'room'[\s\S]*room_layout:\s*\{[\s\S]*current_ascii: aiLayout\.currentAscii[\s\S]*furniture: aiLayout\.furniture\.map/, 'room behavior payload should tell the backend it is in a room and include furniture layout context');
    assert.match(pixelWorldPanel, /function createRoomDefaultBehaviorSeedNodes\(roomPlaces = \[\]\)[\s\S]*room_base_needs_rest/, 'room behavior tree state should seed reusable base branches from current room anchors');
    assert.match(pixelWorldPanel, /function adaptRoomBehaviorTreeStateForPlaces\(treeState, roomPlaces = \[\]\)[\s\S]*room_anchor_signature/, 'room behavior tree state should remember the current room anchor signature');
    assert.match(pixelWorldPanel, /function createCommercialV2PresetInteractionBranch\(actionId, placeId = 'restaurant', placeLabel = '街区', options = \{\}\)[\s\S]*const isRoomScene[\s\S]*预设互动：房间闲聊[\s\S]*往\$\{targetPlaceLabel\}那边看了一眼/, 'room preset small-talk should use room wording instead of street-side wording');
    assert.match(pixelWorldPanel, /selectedPlaceLabel,\s*\n\s*\{ sceneType: 'room' \}/, 'room preset interactions should pass room scene context to the shared preset branch builder');
    assert.match(cityIndex, /function findDuplicateBehaviorInteraction\(treePatch, inputPackage = \{\}\)[\s\S]*getBehaviorRepeatSimilarity\(generated\.normalized, entry\.normalized\) >= 0\.82/, 'behavior branch generation should detect repeated special interaction text');
    assert.match(cityIndex, /const duplicate = findDuplicateBehaviorInteraction\(treePatch, inputPackage\);[\s\S]*throw createCityError\('特殊枝丫生成疑似重复上一轮内容，请重试。', 502, true\)/, 'duplicate special interactions should fail visibly and remain retryable');

    assert.doesNotMatch(cityIndex, /function buildFallbackBehaviorBranch|function buildFallbackBaseBehaviorBranches/, 'behavior generation should not keep local fallback branch builders');
    assert.doesNotMatch(cityIndex, /generated = \{[\s\S]*fallback: true[\s\S]*error: modelErr\.message/, 'behavior routes must not convert model failures into successful fallback patches');
    assert.doesNotMatch(cityIndex, /sanitizeBaseBehaviorBranchPack\(null,[\s\S]*missing_model_config/, 'missing model config must not produce base fallback branches');
    assert.doesNotMatch(parserBlock, /jsonMatch|JSON\.parse\(jsonMatch\[0\]\)/, 'behavior generation must not slice JSON out of malformed model text');
    assert.doesNotMatch(pixelWorldPanel, /已生成 fallback patch|已生成 fallback 基础枝丫/, 'PixelWorld UI should not present fallback behavior generation as a success');
});

test('city social encounter generation does not fabricate fallback relationship writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const socialService = readRepoFile('server', 'plugins', 'city', 'services', 'socialService.js');

    assert.match(socialService, /function createSocialEncounterError\(message, status = 502\)/, 'social encounter generation should expose retryable errors');
    assert.match(socialService, /throw createSocialEncounterError\(`\$\{speaker\.name\} 社交行动生成失败，请重试：/, 'speaker action generation failures should stop the encounter');
    assert.match(socialService, /if \(!lastLog \|\| \/\\\[无响应\\\]\/\.test\(lastLog\)\) \{[\s\S]*throw createSocialEncounterError\(`\$\{speaker\.name\} 社交行动生成为空，请重试。`\)/, 'empty social action output should not become a fake action');
    assert.match(socialService, /function cleanSocialJsonReply\(text\)[\s\S]*replace\(\/```\(\?:json\)\?\\s\*\/gi, ''\)[\s\S]*trim\(\)/, 'social resolution should only strip code fences before JSON parsing');
    assert.match(socialService, /clean = cleanSocialJsonReply\(reply\);[\s\S]*if \(!clean\) throw createSocialEncounterError\('社交遭遇结算没有返回 JSON，请重试。'\)[\s\S]*systemResult = JSON\.parse\(clean\)/, 'social resolution should parse the full cleaned model JSON');
    assert.match(socialService, /if \(!systemResult \|\| !systemResult\.characters\) \{[\s\S]*throw createSocialEncounterError\('社交遭遇结算缺少 characters 字段，请重试。'\)/, 'social resolution should fail missing characters instead of fabricating them');
    assert.match(socialService, /function normalizeSocialAffinityDelta\(value\)[\s\S]*\/\^\[\+-\]\?\\d\+\$\/\.test\(text\)[\s\S]*parsed < -10 \|\| parsed > 10/, 'social encounter affinity deltas should require whole integers in the model range');
    assert.match(socialService, /function normalizeSocialHistoryLimit\(config = \{\}\)/, 'social encounter history limits should be normalized before DB queries');
    assert.match(socialService, /const normalized = normalizeCityConfigValue\('city_social_log_limit', rawValue\)/, 'social encounter history limits should reuse city config validation');
    assert.match(socialService, /const yLimit = normalizeSocialHistoryLimit\(config\)/, 'social encounter collision checks should use the normalized history limit');
    assert.match(socialService, /const encounterWrites = collectSocialEncounterWrites\(systemResult, occupants\);[\s\S]*db\.city\.logAction/, 'social encounter generated deltas should be preflighted before encounter log writes');
    assert.match(socialService, /for \(const \{ character: c, data, relationUpdates \} of encounterWrites\)[\s\S]*for \(const \{ other, delta, impression \} of relationUpdates\)/, 'social encounter relationship writes should use preflight-normalized deltas');

    assert.doesNotMatch(socialService, /采用规则系统 fallback 结算遭遇|社交遭遇文案生成失败|Math\.floor\(Math\.random\(\) \* 5\) - 1|\[由于网络波动没有任何动作\]/, 'social encounters must not fabricate fallback logs or random relationship deltas after generation failures');
    assert.doesNotMatch(socialService, /replyText\.match\(\/\\\{\[\\s\\S\]\*\\\}\/\)|JSON\.parse\(match\[0\]\)|clean = clean\.replace\(/, 'social resolution must not slice or repair malformed JSON into a fake success path');
    assert.doesNotMatch(socialService, /parseInt\(delta\)|clampedDelta|Math\.max\(-10, Math\.min\(10, dAmt\)\)/, 'social encounter affinity deltas must not parse-prefix or clamp malformed model values into success');
    assert.doesNotMatch(socialService, /parseInt\(config\.city_social_log_limit/, 'social encounter history limits must not partially parse malformed config values');
    assert.doesNotMatch(cityIndex, /buildCollapsedCityLog,\s*\n\s*logEmotionTransition,[\s\S]*createSocialService/, 'city plugin should not pass collapsed-log fallback helpers into social generation');
});

test('city automatic actions only accept parsed narrations before writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const actionService = readRepoFile('server', 'plugins', 'city', 'services', 'actionService.js');
    const { parseCityActionNarrations } = require(path.join(repoRoot, 'server', 'plugins', 'city', 'utils', 'actionNarrationParser'));
    const missingModelStart = cityIndex.indexOf('// Missing model config -> skip autonomous actions');
    const missingModelEnd = cityIndex.indexOf('// Schedule is now generated at the cron loop level', missingModelStart);
    const simulateStart = cityIndex.indexOf('// LLM decision with inventory awareness');
    const simulateEnd = cityIndex.indexOf('function selectRandomDistrict', simulateStart);
    const webCallStart = actionService.indexOf('webActivityOutcome = await maybeRunCityWebSearchActivity');
    const webCallEnd = actionService.indexOf('const questOutcome = await handleQuestLifecycleAfterAction', webCallStart);
    assert.notEqual(missingModelStart, -1, 'missing model guard should exist');
    assert.notEqual(missingModelEnd, -1, 'missing model guard should end before schedule handling');
    assert.notEqual(simulateStart, -1, 'simulateCharacter LLM decision block should exist');
    assert.notEqual(simulateEnd, -1, 'simulateCharacter decision block should end before selectRandomDistrict');
    assert.notEqual(webCallStart, -1, 'web activity call should exist');
    assert.notEqual(webCallEnd, -1, 'web activity call should end before quest lifecycle');
    const missingModelBlock = cityIndex.slice(missingModelStart, missingModelEnd);
    const actionDecision = cityIndex.slice(simulateStart, simulateEnd);
    const webCallBlock = actionService.slice(webCallStart, webCallEnd);

    assert.match(missingModelBlock, /if \(!char\.api_endpoint \|\| !char\.api_key \|\| !char\.model_name\) \{\s*return;\s*\}/, 'characters without model config should skip autonomous city actions');
    assert.doesNotMatch(missingModelBlock, /applyDecision|selectRandomDistrict|logAction/, 'missing model config must not become a rule-based city write');

    assert.throws(
        () => parseCityActionNarrations('模型决定先回家休息。'),
        /商业街行动生成失败：模型没有返回 JSON 对象|Unexpected token/,
        'city action generation should fail when the model returns no JSON-shaped narration'
    );
    assert.match(actionDecision, /const richNarrations = parseCityActionNarrations\(reply\)/, 'city action generation should parse the model narration before writes');
    assert.match(actionDecision, /Array\.isArray\(richNarrations\)/, 'city action generation should reject JSON arrays');
    assert.ok(actionDecision.includes('match(/^\\[([A-Z_]+)\\]$/)'), 'city action tags should require the entire action string to be bracketed');
    assert.match(actionDecision, /if \(!codeMatch\) \{[\s\S]*throw new Error\('商业街行动生成失败：缺少有效 action 标签，请重试。'\)/, 'city action generation should fail missing action labels');
    assert.match(actionDecision, /const generatedLog = String\(richNarrations\.log \|\| ''\)\.trim\(\);[\s\S]*throw new Error\('商业街行动生成失败：缺少可用 log，请重试。'\)/, 'city action generation should fail missing logs before writes');
    assert.match(actionDecision, /if \(!foodItems\.length\) throw new Error\('商业街行动生成失败：模型选择 EAT_ITEM，但背包没有可食用物品，请重试。'\)/, 'invalid EAT_ITEM choices should fail instead of falling through to a random district');
    assert.match(actionDecision, /const eatLog = generatedLog;[\s\S]*db\.city\.logAction\(char\.id, 'EAT', eatLog/, 'EAT_ITEM actions should only write the generated log');
    assert.match(actionDecision, /const district = districts\.find\(d => d\.id === codeMatch\);\s*if \(!district\) \{[\s\S]*throw new Error\(`商业街行动生成失败：action 不在可选地点中/, 'invalid district actions should fail instead of picking a random district');
    assert.match(webCallBlock, /baseLog: getLogText\(normalLog, \{ forceDefault: false \}\)/, 'city web activity should receive the generated action log as context');

    assert.doesNotMatch(actionDecision, /非 JSON 回复抢救成功|坏格式回复中抢救 quest_intent|salvageQuestIntentFromReply/, 'city action generation should not keep broad malformed-output salvage paths');
    assert.doesNotMatch(actionDecision, /jsonMatch|if \(!codeMatch\) codeMatch = reply\.match/, 'city action generation should not slice arbitrary JSON or recover action labels from raw text');
    assert.doesNotMatch(actionDecision, /const district = districts\.find\(d => d\.id === codeMatch\) \|\| selectRandomDistrict\(districts, char\)/, 'invalid model actions should not become random city actions');
    assert.doesNotMatch(actionDecision, /背包进食文案生成失败|API连接失败，本轮商业街行动已取消|db\.city\.logAction\([\s\S]*'ERROR'/, 'city action generation failures should not write fallback error or EAT_ITEM logs');
    assert.doesNotMatch(webCallBlock, /buildCollapsedCityLog\(char, '行动文案生成失败'/, 'city web activity context must not be a fake failure log');
});

test('city action chat prompts read the latest private-chat tail without hard duplicate blocking', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const freshTailStart = cityIndex.indexOf('function buildFreshPrivateChatTailBlock');
    const freshTailEnd = cityIndex.indexOf('async function regenerateActionNarrations', freshTailStart);
    const survivalPromptStart = cityIndex.indexOf('function buildSurvivalPrompt');
    const survivalPromptEnd = cityIndex.indexOf('function buildSchedulePrompt', survivalPromptStart);
    const bridgeStart = cityIndex.indexOf('function broadcastCityToChat');
    const bridgeEnd = cityIndex.indexOf('function parseTimeSkipBackfillReply', bridgeStart);
    assert.notEqual(freshTailStart, -1, 'city prompt should have a fresh private-chat tail helper');
    assert.notEqual(freshTailEnd, -1, 'fresh private-chat tail helper should have a stable end marker');
    assert.notEqual(survivalPromptStart, -1, 'city survival prompt should exist');
    assert.notEqual(survivalPromptEnd, -1, 'city survival prompt should have a stable end marker');
    assert.notEqual(bridgeStart, -1, 'city-to-chat bridge should exist');
    assert.notEqual(bridgeEnd, -1, 'city-to-chat bridge should have a stable end marker');
    const freshTailBlock = cityIndex.slice(freshTailStart, freshTailEnd);
    const survivalPromptBlock = cityIndex.slice(survivalPromptStart, survivalPromptEnd);
    const bridgeBlock = cityIndex.slice(bridgeStart, bridgeEnd);

    assert.match(freshTailBlock, /db\.getVisibleMessages\(char\.id, limit\)/, 'fresh private-chat tail should read directly from the current message table');
    assert.match(freshTailBlock, /生成前实时读取的最新私聊/, 'fresh private-chat tail should label itself as generation-time live context');
    assert.match(freshTailBlock, /如果最新用户消息比你上一条回复更新，chat 必须承接最新用户消息/, 'city chat prompt should tell the model to follow the latest user input');
    assert.match(freshTailBlock, /防重复只靠语义自觉/, 'city chat anti-repeat should be a prompt instruction, not a hard write filter');
    assert.match(survivalPromptBlock, /const freshPrivateChatTailBlock = buildFreshPrivateChatTailBlock\(promptHistoryDb, char\)/, 'city action prompt should inject the fresh private-chat tail');
    assert.match(survivalPromptBlock, /\$\{freshPrivateChatTailBlock \? freshPrivateChatTailBlock : ''\}/, 'fresh private-chat tail should be included in the city action prompt text');

    assert.doesNotMatch(bridgeBlock, /findDuplicateCityOutreachChat|跳过重复商业街私聊|getCityOutreachRepeatSimilarity/, 'city-to-chat bridge should not hard-block duplicate-looking chat text');
    assert.doesNotMatch(bridgeBlock, /findNewerUserMessageAfterCityInput|_city_chat_input_started_at|跳过陈旧商业街私聊/, 'city-to-chat bridge should not silently drop generated chat through a stale-input hard gate');
});

test('city web search activity rejects malformed intent and query planning before writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const intentStart = cityIndex.indexOf('function parseCityWebIntentTag');
    const intentEnd = cityIndex.indexOf('function stripCityWebIntentTag', intentStart);
    const planStart = cityIndex.indexOf('async function planCityWebSearchQuery');
    const planEnd = cityIndex.indexOf('async function maybeRunCityWebSearchActivity', planStart);
    const runStart = cityIndex.indexOf('async function maybeRunCityWebSearchActivity');
    const runEnd = cityIndex.indexOf('const actionService = createActionService', runStart);
    assert.notEqual(intentStart, -1, 'city web intent parser should exist');
    assert.notEqual(intentEnd, -1, 'city web intent parser should have a stable end marker');
    assert.notEqual(planStart, -1, 'city web query planner should exist');
    assert.notEqual(planEnd, -1, 'city web query planner should have a stable end marker');
    assert.notEqual(runStart, -1, 'city web activity runner should exist');
    assert.notEqual(runEnd, -1, 'city web activity runner should have a stable end marker');

    const intentBlock = cityIndex.slice(intentStart, intentEnd);
    const planBlock = cityIndex.slice(planStart, planEnd);
    const runBlock = cityIndex.slice(runStart, runEnd);
    const planCallPos = runBlock.indexOf('const plan = await planCityWebSearchQuery');
    const writePos = runBlock.indexOf("db.city.logAction(char.id, 'WEB_SEARCH'");

    assert.match(intentBlock, /const parsed = JSON\.parse\(payload\)/, 'WEB_SEARCH_INTENT should parse the full tag payload as JSON');
    assert.match(intentBlock, /catch \(e\) \{[\s\S]*return null;[\s\S]*\}/, 'malformed WEB_SEARCH_INTENT should become a no-op instead of a salvaged query');
    assert.match(planBlock, /if \(!endpoint \|\| !key \|\| !model\) throw new Error\('联网查询规划缺少模型配置，请重试。'\)/, 'web query planning should fail missing model config');
    assert.match(planBlock, /const cleaned = String\(reply \|\| ''\)[\s\S]*const parsed = JSON\.parse\(cleaned\)/, 'web query planning should parse the full cleaned model JSON');
    assert.match(planBlock, /if \(!queries\.length\) throw new Error\('联网查询规划缺少可用查询词，请重试。'\)/, 'web query planning should reject empty generated queries');
    assert.match(planBlock, /catch \(e\) \{[\s\S]*throw e;[\s\S]*\}/, 'web query planning failures should propagate to the optional activity guard');
    assert.ok(planCallPos !== -1 && writePos !== -1 && planCallPos < writePos, 'WEB_SEARCH logs should be written only after query planning succeeds');
    assert.doesNotMatch(intentBlock, /payload\.indexOf\('\{'\)|payload\.lastIndexOf\('\}'\)|payload\.replace\(/, 'WEB_SEARCH_INTENT parser must not slice or sanitize malformed payloads into success');
    assert.doesNotMatch(planBlock, /fallbackQuery|jsonMatch|JSON\.parse\(jsonMatch\[0\]\)|queries: queries\.length \? queries :/, 'web query planning must not fallback-query or slice malformed model output');
    assert.doesNotMatch(runBlock, /const preLog = stripCityWebIntentTag\(preReply\) \|\|/, 'web search pre-log should not invent fallback activity text');
});

test('city action narration regeneration failures stop before shopping writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const actionService = readRepoFile('server', 'plugins', 'city', 'services', 'actionService.js');
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const regenStart = cityIndex.indexOf('async function regenerateActionNarrations');
    const regenEnd = cityIndex.indexOf('async function buildQuestResolutionNarrations', regenStart);
    const shoppingStart = actionService.indexOf("} else if (district.type === 'food' || district.type === 'shopping')");
    const shoppingEnd = actionService.indexOf("} else if (district.type === 'medical')", shoppingStart);
    const rerollStart = coreRoutes.indexOf("app.post('/api/city/logs/:id/reroll'");
    const rerollEnd = coreRoutes.indexOf("app.get('/api/city/announcements'", rerollStart);

    assert.notEqual(regenStart, -1, 'city action narration regeneration helper should exist');
    assert.notEqual(regenEnd, -1, 'regeneration helper should end before quest narration helper');
    assert.notEqual(shoppingStart, -1, 'shopping action branch should exist');
    assert.notEqual(shoppingEnd, -1, 'shopping action branch should end before medical branch');
    assert.notEqual(rerollStart, -1, 'city log reroll route should exist');
    assert.notEqual(rerollEnd, -1, 'city log reroll route should end before announcements route');

    const regenBlock = cityIndex.slice(regenStart, regenEnd);
    const shoppingBlock = actionService.slice(shoppingStart, shoppingEnd);
    const rerollBlock = coreRoutes.slice(rerollStart, rerollEnd);

    assert.match(regenBlock, /throw createCityError\('行动文案重写缺少模型 URL\/Key\/模型名，请补全后重试。', 400, true\)/, 'regeneration missing model config should be retryable instead of returning old text');
    assert.match(regenBlock, /throw createCityError\(`行动文案重写请求失败，请重试：\$\{err\.message\}`, 502, true\)/, 'regeneration request failures should be retryable');
    assert.match(regenBlock, /parsed = tryParseCityActionReply\(reply\)/, 'regeneration should use the strict full-object parser');
    assert.match(regenBlock, /throw createCityError\(`行动文案重写返回的 JSON 无法解析，请重试：/, 'regeneration malformed JSON should fail');
    assert.match(regenBlock, /const log = String\(parsed\?\.log \|\| ''\)\.trim\(\);[\s\S]*throw createCityError\('行动文案重写缺少可用 log，请重试。', 502, true\)/, 'regeneration should require a fresh generated log');
    assert.doesNotMatch(regenBlock, /return baseNarrations|console\.warn\(`\[City\] 行动文案重写失败|String\(parsed\.log \|\| ''\)\.trim\(\) \|\| String\(baseNarrations\?\.log/, 'regeneration failures should not fall back to the old narration');

    const regenPos = shoppingBlock.indexOf('richNarrations = await regenerateActionNarrations');
    const stockPos = shoppingBlock.indexOf('db.city.decreaseItemStock', regenPos);
    assert.ok(regenPos !== -1 && stockPos !== -1 && regenPos < stockPos, 'shopping inventory writes should happen only after successful regeneration');
    assert.match(rerollBlock, /catch \(e\) \{ res\.status\(e\.status \|\| 500\)\.json\(\{ error: e\.message, canRetry: !!e\.canRetry \}\); \}/, 'reroll regeneration failures should expose retry metadata');
    assert.match(rerollBlock, /const messageId = normalizeCityRowId\(req\.body\?\.messageId \|\| 0\)/, 'reroll route should accept a strict chat message id for updating folded chat bubbles');
    assert.match(rerollBlock, /UPDATE messages[\s\S]*WHERE id = \?[\s\S]*AND character_id = \?[\s\S]*AND role = 'character'[\s\S]*content LIKE '【商业街输出折叠】%/, 'reroll route should update the matching folded private chat bubble after regenerating the city log');
});

test('city generated schedules reject malformed JSON and invalid actions before saving', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const parserStart = cityIndex.indexOf('function tryParseScheduleReply');
    const parserEnd = cityIndex.indexOf('function buildSocialPrompt', parserStart);
    const generateStart = cityIndex.indexOf('async function maybeGenerateSchedule');
    const generateEnd = cityIndex.indexOf('function publishQuestAnnouncement', generateStart);
    assert.notEqual(parserStart, -1, 'schedule parser should exist');
    assert.notEqual(parserEnd, -1, 'schedule parser block should have an end marker');
    assert.notEqual(generateStart, -1, 'schedule generation function should exist');
    assert.notEqual(generateEnd, -1, 'schedule generation block should have an end marker');
    const parserBlock = cityIndex.slice(parserStart, parserEnd);
    const generateBlock = cityIndex.slice(generateStart, generateEnd);

    assert.match(parserBlock, /const parsed = JSON\.parse\(cleaned\);[\s\S]*return Array\.isArray\(parsed\) \? parsed : null/, 'schedule parser should parse the full JSON array directly');
    assert.match(parserBlock, /function normalizeGeneratedSchedulePlan\(plan, districts = \[\]\)/, 'generated schedules should be normalized centrally');
    assert.match(parserBlock, /allowedActions\.add\('none'\)/, 'schedule validation should preserve the explicit no-plan action');
    assert.match(parserBlock, /!Number\.isSafeInteger\(hour\) \|\| hour < 6 \|\| hour > 23/, 'schedule hours should be strict 6-23 integers');
    assert.match(parserBlock, /if \(!allowedActions\.has\(action\)\) return null/, 'schedule actions should be constrained to city districts or none');
    assert.match(parserBlock, /if \(!reason\) return null/, 'schedule entries should require a reason');
    assert.match(generateBlock, /const valid = normalizeGeneratedSchedulePlan\(plan, districts\);[\s\S]*db\.city\.saveSchedule\(char\.id, today, valid\)/, 'schedule generation should validate the full plan before saving');

    assert.doesNotMatch(parserBlock, /lastBrace|repaired|candidate\s*=>|replace\(\/,\\s\*\(\[\\\]\}\]\)/, 'schedule parser should not repair malformed arrays into a success');
    assert.doesNotMatch(generateBlock, /plan\.filter\(e => typeof e\.hour === 'number' && typeof e\.action === 'string'\)/, 'schedule generation should not save a partial filtered plan');
});

test('city private reply directed actions fail instead of fallback writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const parserStart = cityIndex.indexOf('function tryParseCityActionReply');
    const parserEnd = cityIndex.indexOf('async function runPrivateReplyDirectedCityAction', parserStart);
    const directedStart = parserEnd;
    const directedEnd = cityIndex.indexOf('function isWeakCityNarration', directedStart);
    assert.notEqual(parserStart, -1, 'city action parser should exist');
    assert.notEqual(parserEnd, -1, 'directed city action function should follow parser');
    assert.notEqual(directedEnd, -1, 'directed city action block should end before narration helpers');
    const parserBlock = cityIndex.slice(parserStart, parserEnd);
    const directedBlock = cityIndex.slice(directedStart, directedEnd);

    assert.match(parserBlock, /const parsed = parseCityActionNarrations\(reply\);[\s\S]*!Array\.isArray\(parsed\) \? parsed : null/, 'private reply city action parser should use the shared strict-then-loose narration parser');
    assert.match(directedBlock, /return \{ triggered: false, districtId: district\.id, reason: 'missing_model_config', canRetry: true \}/, 'missing model config should not execute a fallback city action');
    assert.match(directedBlock, /const expectedAction = `\[\$\{String\(district\.id \|\| ''\)\.toUpperCase\(\)\}\]`/, 'directed city actions should compute the exact expected action label');
    assert.match(directedBlock, /if \(action !== expectedAction\) \{[\s\S]*throw new Error\(`私聊定向商业街行动 action 无效：/, 'directed city actions should reject mismatched model actions');
    assert.match(directedBlock, /if \(!String\(richNarrations\.log \|\| ''\)\.trim\(\)\) \{[\s\S]*throw new Error\('私聊定向商业街行动缺少 log 字段'\)/, 'directed city actions should reject empty generated logs');
    assert.match(directedBlock, /return \{ triggered: false, districtId: district\.id, reason: err\.message, canRetry: true \}/, 'directed city action generation failures should be retryable non-actions');

    assert.doesNotMatch(cityIndex, /function buildReplyIntentNarrationsFallback|async function buildReplyIntentNarrations|async function buildPrivateReplyCitySelfPrompt/, 'private reply directed city action should not keep local fallback narration helpers');
    assert.doesNotMatch(directedBlock, /fallback_no_api|directed_fallback|buildReplyIntentNarrations\(|applyDecision\([^;]+fallbackNarrations/, 'directed city action failures must not be converted into fallback writes');
    assert.doesNotMatch(parserBlock, /replace\(\/,\\s\*\(\[\\\]\}\]\)|\/\/\.\*\$\/gm|jsonMatch = cleaned\.match/, 'private reply city action parser should not use broad arbitrary JSON slicing');
});

test('city gambling outcome narration failures do not become fallback casino writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const actionService = readRepoFile('server', 'plugins', 'city', 'services', 'actionService.js');
    const gamblingStart = cityIndex.indexOf('async function buildGamblingOutcomeNarrations');
    const gamblingEnd = cityIndex.indexOf('function tryParseCityActionReply', gamblingStart);
    const actionStart = actionService.indexOf("} else if (district.type === 'gambling')");
    const actionEnd = actionService.indexOf("} else if (district.type === 'food' || district.type === 'shopping')", actionStart);

    assert.notEqual(gamblingStart, -1, 'gambling narration generator should exist');
    assert.notEqual(gamblingEnd, -1, 'gambling narration generator should end before city action parser');
    assert.notEqual(actionStart, -1, 'gambling action branch should exist');
    assert.notEqual(actionEnd, -1, 'gambling action branch should end before shopping branch');

    const gamblingBlock = cityIndex.slice(gamblingStart, gamblingEnd);
    const actionBlock = actionService.slice(actionStart, actionEnd);

    assert.match(gamblingBlock, /throw createCityError\('赌场结果文案生成缺少模型 URL\/Key\/模型名，请补全后重试。', 400, true\)/, 'missing gambling narration model config should be retryable instead of fallback');
    assert.match(gamblingBlock, /throw createCityError\(`赌场结果文案生成请求失败，请重试：\$\{err\.message\}`, 502, true\)/, 'gambling narration request failures should be retryable');
    assert.match(gamblingBlock, /parsed = tryParseCityActionReply\(reply\)/, 'gambling narration should use the strict full-object parser');
    assert.match(gamblingBlock, /throw createCityError\(`赌场结果文案生成返回的 JSON 无法解析，请重试：/, 'gambling narration malformed JSON should fail');
    assert.match(gamblingBlock, /const log = String\(parsed\?\.log \|\| ''\)\.trim\(\);[\s\S]*if \(!parsed \|\| !log\) \{[\s\S]*throw createCityError\('赌场结果文案生成缺少可用 log，请重试。', 502, true\)/, 'gambling narration should require a generated log before writes');
    assert.doesNotMatch(gamblingBlock, /fallback|parseLooseJsonObject|赌场赢钱文案生成失败|赌场输钱文案生成失败|console\.warn\(`\[City\] 赌场结果文案生成失败/, 'gambling narration failures should not be converted into fallback text');

    assert.match(actionBlock, /const gamblingNarrations = await buildGamblingOutcomeNarrations\(char, district, db,[\s\S]*const winLog = String\(gamblingNarrations\.log \|\| ''\)\.trim\(\);[\s\S]*db\.city\.logAction/, 'winning casino writes should only use generated narration');
    assert.match(actionBlock, /const gamblingNarrations = await buildGamblingOutcomeNarrations\(char, district, db,[\s\S]*const loseLog = String\(gamblingNarrations\.log \|\| ''\)\.trim\(\);[\s\S]*db\.city\.logAction/, 'losing casino writes should only use generated narration');
    assert.doesNotMatch(actionBlock, /赢了一大笔钱|输光了|gamblingNarrations\.log \|\| `\$\{char\.name\}/, 'casino action branch should not keep local fallback logs');
});

test('city busy penalty narration failures do not become fallback penalty logs', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const busyStart = cityIndex.indexOf('async function buildBusyPenaltyNarration');
    const busyEnd = cityIndex.indexOf('function resolveCityIntentDistrict', busyStart);
    const releaseStart = cityIndex.indexOf('// Busy -> release');
    const releaseEnd = cityIndex.indexOf('// Missing model config -> skip autonomous actions', releaseStart);

    assert.notEqual(busyStart, -1, 'busy penalty narration generator should exist');
    assert.notEqual(busyEnd, -1, 'busy penalty narration generator should end before intent helpers');
    assert.notEqual(releaseStart, -1, 'busy release block should exist');
    assert.notEqual(releaseEnd, -1, 'busy release block should end before ordinary action fallback');

    const busyBlock = cityIndex.slice(busyStart, busyEnd);
    const releaseBlock = cityIndex.slice(releaseStart, releaseEnd);

    assert.match(busyBlock, /throw createCityError\('忙碌惩罚文案生成缺少有效惩罚数值，请重试。', 500, true\)/, 'busy penalty narration should reject invalid penalty amounts');
    assert.match(busyBlock, /throw createCityError\('忙碌惩罚文案生成缺少模型 URL\/Key\/模型名，请补全后重试。', 400, true\)/, 'busy penalty narration missing model config should be retryable instead of fallback');
    assert.match(busyBlock, /if \(!cleaned\) \{[\s\S]*throw createCityError\('忙碌惩罚文案生成缺少可用文案，请重试。', 502, true\)/, 'busy penalty narration should reject empty model output');
    assert.match(busyBlock, /if \(err\?\.canRetry\) throw err;[\s\S]*throw createCityError\(`忙碌惩罚文案生成请求失败，请重试：\$\{err\.message\}`, 502, true\)/, 'busy penalty narration request failures should stay retryable');
    assert.doesNotMatch(busyBlock, /buildBusyPenaltyLog|忙碌惩罚文案生成失败|休息惩罚文案生成失败|return fallback|console\.warn\(`\[City\] 忙碌惩罚文案生成失败/, 'busy penalty failures should not become fallback text');

    assert.match(releaseBlock, /const workLog = await buildBusyPenaltyNarration\(char, 'work', penaltyMoney,[\s\S]*db\.city\.logAction\(char\.id, 'WORK_DISTRACT', workLog/, 'work penalty logs should only be written after generated narration returns');
    assert.match(releaseBlock, /const sleepLog = await buildBusyPenaltyNarration\(char, 'sleep', extraDebt,[\s\S]*db\.city\.logAction\(char\.id, 'SLEEP_DISTURB', sleepLog/, 'sleep penalty logs should only be written after generated narration returns');
    assert.doesNotMatch(releaseBlock, /buildCollapsedCityLog\(char, '(?:忙碌|休息)惩罚文案生成失败'/, 'busy release should not keep local fallback penalty logs');
});

test('city time skip backfill fails instead of ordinary fallback writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const parserStart = cityIndex.indexOf('function parseTimeSkipBackfillReply');
    const normalizeStart = cityIndex.indexOf('function normalizeTimeSkipBackfillResult', parserStart);
    const runStart = cityIndex.indexOf('async function runTimeSkipBackfill', normalizeStart);
    const runEnd = cityIndex.indexOf('function broadcastCityEvent', runStart);
    const routeStart = coreRoutes.indexOf("app.post('/api/city/time-skip'");
    const routeEnd = coreRoutes.indexOf("app.get('/api/city/economy'", routeStart);

    assert.notEqual(parserStart, -1, 'time skip JSON parser should exist');
    assert.notEqual(normalizeStart, -1, 'time skip result normalizer should exist');
    assert.notEqual(runStart, -1, 'time skip backfill runner should exist');
    assert.notEqual(runEnd, -1, 'time skip runner should end before broadcast event helper');
    assert.notEqual(routeStart, -1, 'time skip route should exist');
    assert.notEqual(routeEnd, -1, 'time skip route should end before economy route');

    const parserBlock = cityIndex.slice(parserStart, normalizeStart);
    const normalizeBlock = cityIndex.slice(normalizeStart, runStart);
    const runBlock = cityIndex.slice(runStart, runEnd);
    const routeBlock = coreRoutes.slice(routeStart, routeEnd);

    assert.match(parserBlock, /const parsed = JSON\.parse\(cleaned\)/, 'time skip backfill should parse the exact JSON reply');
    assert.match(parserBlock, /createCityError\(`\$\{char\?\.name \|\| '角色'\} 时间跳过回溯生成失败：JSON 无法解析，请重试。`, 502, true\)/, 'time skip JSON parse failures should be retryable errors');
    assert.match(normalizeBlock, /if \(!summary\) \{[\s\S]*缺少 summary，请重试。/, 'time skip backfill should require a generated summary');
    assert.match(normalizeBlock, /!Array\.isArray\(raw\?\.tasks_completed\) \|\| !Array\.isArray\(raw\?\.tasks_missed\)/, 'time skip backfill should require explicit task classification arrays');
    assert.match(normalizeBlock, /有跳过任务没有被分类，请重试。/, 'time skip backfill should reject omitted skipped task statuses');
    assert.match(runBlock, /const backfillResults = \[\]/, 'time skip backfill should collect generated results before writing');
    assert.match(runBlock, /db\.getCharacters\(\)\.filter\(c => c\.api_endpoint && c\.api_key && c\.model_name\)/, 'time skip should only generate for fully configured model characters');
    assert.match(runBlock, /backfillResults\.push\(\{[\s\S]*result[\s\S]*\}\);[\s\S]*for \(const item of backfillResults\)/, 'time skip should defer schedule and log writes until after generation succeeds');
    assert.match(runBlock, /throw createCityError\(`\$\{char\.name\} 时间跳过回溯结果缺少任务 \$\{h\}:00 的状态，请重试。`, 502, true\)/, 'time skip should not invent statuses for omitted tasks');
    assert.doesNotMatch(runBlock, /fallbackToOrdinary|触发平凡保底|时间跳过总结生成失败|reply\.match\(\/\\\{\[\\s\\S\]\*\\\}\/\)|Default to completed if fallback/, 'time skip generation failures should not become ordinary fallback writes');

    const backfillPos = routeBlock.indexOf('const processedTasks = await runTimeSkipBackfill');
    const firstConfigWritePos = routeBlock.indexOf("req.db.city.setConfig('city_time_offset_days'");
    assert.ok(backfillPos !== -1 && firstConfigWritePos !== -1 && backfillPos < firstConfigWritePos, 'time skip route should run backfill before advancing stored city time');
    assert.match(routeBlock, /res\.status\(e\.status \|\| 500\)\.json\(\{ error: e\.message, canRetry: !!e\.canRetry \}\)/, 'time skip retryable generation failures should be visible to the client');
});

test('city log action routes reject loose numeric ids', () => {
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const eventQuestRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'eventQuestRoutes.js');
    const inputGuards = readRepoFile('server', 'plugins', 'city', 'utils', 'inputGuards.js');

    assert.match(inputGuards, /function normalizeCityRowId\(value\)[\s\S]*Number\.isSafeInteger\(parsed\) \|\| parsed <= 0/, 'city route ids should use strict positive integer validation');
    assert.match(coreRoutes, /normalizeCityRowId\(req\.params\.id\)/, 'city log reroll should normalize route ids strictly');
    assert.doesNotMatch(coreRoutes, /Number\.parseInt\(req\.params\.id, 10\)/, 'city log reroll must not accept parseInt-prefix ids');
    assert.match(eventQuestRoutes, /normalizeCityRowId\(req\.params\.id\)/, 'city quest-score retry should normalize route ids strictly');
    assert.doesNotMatch(eventQuestRoutes, /const logId = Number\(req\.params\.id \|\| 0\)/, 'city quest-score retry must not accept decimal or non-integer ids');
});

test('city log and announcement limits reject loose numeric query input', () => {
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');
    const inputGuardsSource = readRepoFile('server', 'plugins', 'city', 'utils', 'inputGuards.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'city', 'utils', 'inputGuards.js'));
    const logsStart = coreRoutes.indexOf("app.get('/api/city/logs'");
    const rerollStart = coreRoutes.indexOf("app.post('/api/city/logs/:id/reroll'", logsStart);
    const announcementsStart = coreRoutes.indexOf("app.get('/api/city/announcements'");
    const charactersStart = coreRoutes.indexOf("app.get('/api/city/characters'", announcementsStart);

    assert.notEqual(logsStart, -1, 'city logs route should exist');
    assert.notEqual(rerollStart, -1, 'city log reroll route should follow logs route');
    assert.notEqual(announcementsStart, -1, 'city announcements route should exist');
    assert.notEqual(charactersStart, -1, 'city characters route should follow announcements route');

    const logsRoute = coreRoutes.slice(logsStart, rerollStart);
    const announcementsRoute = coreRoutes.slice(announcementsStart, charactersStart);

    assert.match(inputGuardsSource, /const MAX_CITY_LOG_QUERY_LIMIT = 10000/, 'city log query limits should have an explicit maximum');
    assert.match(inputGuardsSource, /const MAX_CITY_ANNOUNCEMENT_QUERY_LIMIT = 200/, 'city announcement query limits should have an explicit maximum');
    assert.match(inputGuardsSource, /function normalizeCityListLimit\(value, \{ fallback, max, allowAll = false \} = \{\}\)/, 'city list limit validation should be centralized');
    assert.match(inputGuardsSource, /if \(!Number\.isSafeInteger\(parsed\) \|\| parsed <= 0\) return null/, 'city list limits should reject loose, decimal, negative, and zero values');

    assert.match(logsRoute, /const limit = normalizeCityListLimit\(req\.query\.limit, \{[\s\S]*fallback: 300,[\s\S]*allowAll: true[\s\S]*if \(limit === null\) return res\.status\(400\)\.json\(\{ error: '无效的活动记录数量' \}\)/, 'city logs route should reject invalid limits while preserving explicit all');
    assert.match(announcementsRoute, /const limit = normalizeCityListLimit\(req\.query\.limit, \{[\s\S]*fallback: 50,[\s\S]*MAX_CITY_ANNOUNCEMENT_QUERY_LIMIT[\s\S]*if \(limit === null\) return res\.status\(400\)\.json\(\{ error: '无效的公告数量' \}\)/, 'city announcements route should reject invalid limits');
    assert.doesNotMatch(logsRoute + announcementsRoute, /Number\.parseInt\(req\.query\.limit, 10\)/, 'city list routes must not accept parseInt-prefix query limits');

    assert.match(cityDbSource, /function getCityLogs\(arg1 = 100, arg2 = null\)[\s\S]*const normalizedLimit = normalizeCityListLimit\(limitInput,[\s\S]*allowAll: true[\s\S]*const allLogs = normalizedLimit === 'all'/, 'city DB log reads should not treat invalid numeric limits as all logs');
    assert.match(cityDbSource, /function getCityAnnouncements\(limit = 20\)[\s\S]*const safeLimit = normalizeCityListLimit\(limit,[\s\S]*MAX_CITY_ANNOUNCEMENT_QUERY_LIMIT[\s\S]*\|\| 20/, 'city DB announcement reads should defensively normalize limits');

    assert.equal(guards.normalizeCityListLimit('all', { fallback: 300, max: 10000, allowAll: true }), 'all');
    assert.equal(guards.normalizeCityListLimit('1abc', { fallback: 300, max: 10000, allowAll: true }), null);
    assert.equal(guards.normalizeCityListLimit(0, { fallback: 300, max: 10000, allowAll: true }), null);
    assert.equal(guards.normalizeCityListLimit(20000, { fallback: 300, max: 10000, allowAll: true }), 10000);
});

test('city quest action routes and db helpers reject loose numeric quest ids', () => {
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');
    const eventQuestRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'eventQuestRoutes.js');

    assert.match(eventQuestRoutes, /app\.post\('\/api\/city\/quests\/:id\/claim'[\s\S]*const questId = normalizeCityRowId\(req\.params\.id\)[\s\S]*return res\.status\(400\)\.json\(\{ error: '无效的任务 ID' \}\)[\s\S]*const quest = req\.db\.city\.getQuestById\?\.\(questId\)/, 'quest claim route should reject loose route ids before DB writes');
    assert.match(eventQuestRoutes, /app\.post\('\/api\/city\/quests\/:id\/complete'[\s\S]*const questId = normalizeCityRowId\(req\.params\.id\)[\s\S]*return res\.status\(400\)\.json\(\{ error: '无效的任务 ID' \}\)[\s\S]*const quest = req\.db\.city\.getQuestById\?\.\(questId\)/, 'quest completion route should reject loose route ids before payouts or completion writes');
    assert.doesNotMatch(eventQuestRoutes, /const questId = req\.params\.id/, 'quest action routes must not pass raw route ids into DB helpers');
    assert.doesNotMatch(eventQuestRoutes, /getAllQuests\(1000\)\.find\(\(item\) => String\(item\.id\) === String\(questId\)\)/, 'quest action routes should not scan all quests with raw string ids');

    assert.match(cityDbSource, /function getQuestById\(id\)[\s\S]*const questId = normalizeCityRowId\(id\)[\s\S]*if \(!questId\) return null/, 'quest lookup should reject invalid ids at the DB layer');
    assert.match(cityDbSource, /function claimQuest\(questId, charId\)[\s\S]*const cleanQuestId = normalizeCityRowId\(questId\)[\s\S]*invalid_quest_id[\s\S]*getQuestById\(cleanQuestId\)/, 'quest claim DB helper should normalize quest ids defensively');
    assert.match(cityDbSource, /function resolveQuestCompletion\(questId, charId\)[\s\S]*const cleanQuestId = normalizeCityRowId\(questId\)[\s\S]*invalid_quest_id[\s\S]*getQuestById\(cleanQuestId\)/, 'quest completion DB helper should normalize quest ids defensively');
    assert.match(cityDbSource, /function updateQuestClaimStage\(questId, charId[\s\S]*const cleanQuestId = normalizeCityRowId\(questId\)/, 'quest stage DB helper should normalize quest ids defensively');
    assert.match(cityDbSource, /function advanceQuestProgress\(questId, charId[\s\S]*const cleanQuestId = normalizeCityRowId\(questId\)/, 'quest progress DB helper should normalize quest ids defensively');
    assert.equal((cityDbSource.match(/function createQuest\(data\)/g) || []).length, 1, 'city DB should not keep duplicate quest creation implementations');
    assert.equal((cityDbSource.match(/function claimQuest\(questId, charId\)/g) || []).length, 1, 'city DB should not keep duplicate quest claim implementations');
});

test('city delete routes report missing targets instead of fake success', () => {
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const eventQuestRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'eventQuestRoutes.js');

    assert.match(cityDbSource, /function deleteDistrict\(id\)[\s\S]*return info\.changes \|\| 0/, 'district deletes should return actual row changes');
    assert.match(cityDbSource, /function deleteItem\(id\)[\s\S]*if \(\(info\.changes \|\| 0\) > 0\)[\s\S]*DELETE FROM city_inventory[\s\S]*return info\.changes \|\| 0/, 'item deletes should only clear inventory when an item was deleted');
    assert.match(cityDbSource, /function deleteEvent\(id\)[\s\S]*const eventId = normalizeCityRowId\(id\)[\s\S]*return info\.changes \|\| 0/, 'event deletes should validate numeric ids and return actual changes');
    assert.match(cityDbSource, /function deleteQuest\(id\)[\s\S]*const questId = normalizeCityRowId\(id\)[\s\S]*return info\.changes \|\| 0/, 'quest deletes should validate numeric ids and return actual changes');
    assert.equal((cityDbSource.match(/function deleteQuest\(id\)/g) || []).length, 1, 'city DB should not keep duplicate quest delete implementations');
    assert.equal((cityDbSource.match(/function completeQuest\(questId\)/g) || []).length, 1, 'city DB should not keep duplicate quest completion implementations');

    assert.match(coreRoutes, /const deleted = req\.db\.city\.deleteDistrict\(req\.params\.id\)[\s\S]*return res\.status\(404\)\.json\(\{ error: '分区不存在' \}\)/, 'district delete route should return 404 for missing districts');
    assert.match(coreRoutes, /const deleted = req\.db\.city\.deleteItem\(req\.params\.id\)[\s\S]*return res\.status\(404\)\.json\(\{ error: '物品不存在' \}\)/, 'item delete route should return 404 for missing items');
    assert.match(eventQuestRoutes, /const eventId = normalizeCityRowId\(req\.params\.id\)[\s\S]*return res\.status\(400\)\.json\(\{ error: '无效的事件 ID' \}\)[\s\S]*const deleted = req\.db\.city\.deleteEvent\(eventId\)[\s\S]*return res\.status\(404\)\.json\(\{ error: '事件不存在' \}\)/, 'event delete route should reject invalid ids and return 404 for missing events');
    assert.match(eventQuestRoutes, /const questId = normalizeCityRowId\(req\.params\.id\)[\s\S]*return res\.status\(400\)\.json\(\{ error: '无效的任务 ID' \}\)[\s\S]*const quest = req\.db\.city\.getQuestById\?\.\(questId\)[\s\S]*return res\.status\(404\)\.json\(\{ error: '任务不存在' \}\)[\s\S]*const deleted = req\.db\.city\.deleteQuest\(questId\)/, 'quest delete route should reject invalid ids and return 404 for missing quests');

    assert.doesNotMatch(coreRoutes, /deleteDistrict\(req\.params\.id\);\s*res\.json\(\{ success: true \}\)/, 'district delete route must not fake success after missing deletes');
    assert.doesNotMatch(coreRoutes, /deleteItem\(req\.params\.id\);\s*res\.json\(\{ success: true \}\)/, 'item delete route must not fake success after missing deletes');
    assert.doesNotMatch(eventQuestRoutes, /deleteEvent\(req\.params\.id\);\s*res\.json\(\{ success: true \}\)/, 'event delete route must not fake success after missing deletes');
    assert.doesNotMatch(eventQuestRoutes, /deleteQuest\(req\.params\.id\);\s*res\.json\(\{ success: true \}\)/, 'quest delete route must not fake success after missing deletes');
});

test('city quest rewards are validated before quest writes and wallet payouts', () => {
    const inputGuards = readRepoFile('server', 'plugins', 'city', 'utils', 'inputGuards.js');
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');
    const eventQuestRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'eventQuestRoutes.js');
    const mayorService = readRepoFile('server', 'plugins', 'city', 'services', 'mayorService.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'city', 'utils', 'inputGuards.js'));

    assert.match(inputGuards, /const MAX_CITY_QUEST_REWARD_GOLD = 1000000/, 'quest gold rewards should have a bounded maximum');
    assert.match(inputGuards, /const MAX_CITY_QUEST_REWARD_CALORIES = 4000/, 'quest calorie rewards should stay within the city calorie range');
    assert.match(inputGuards, /const MAX_CITY_QUEST_COMPLETION_TARGET = 10/, 'quest completion target should match mayor scoring bounds');
    assert.match(inputGuards, /function normalizeCityQuestPayload\(data = \{\}\)/, 'quest numeric validation should be centralized');

    assert.match(eventQuestRoutes, /const baseQuest = normalizeCityQuestPayload\(req\.body \|\| \{\}\)/, 'manual quest route should validate rewards before mayor scoring and DB writes');
    assert.match(eventQuestRoutes, /return res\.status\(400\)\.json\(\{ error: '任务奖励或目标数值无效' \}\)/, 'manual quest route should reject invalid quest numbers with 400');
    assert.match(eventQuestRoutes, /Math\.min\(MAX_CITY_CALORIES_GRANT, Math\.max\(0, Number\(claimant\.calories \|\| 0\) \+ rewardCal\)\)/, 'quest completion should not push calories beyond the city cap');

    assert.match(cityDbSource, /const payload = normalizeCityQuestPayload\(data\)/, 'quest DB writes should keep a defensive validation layer');
    assert.match(cityDbSource, /if \(!payload\) throw new Error\('任务奖励或目标数值无效'\)/, 'quest DB writes should reject invalid reward data');
    assert.match(cityDbSource, /const rewardGold = normalizeCityQuestGoldReward\(quest\.reward_gold, 0\)/, 'quest completion should validate stored gold rewards before state changes');
    assert.match(cityDbSource, /return \{ success: false, reason: 'invalid_reward'/, 'corrupted quest rewards should not be completed or paid out');
    assert.match(cityDbSource, /MAX_CITY_QUEST_COMPLETION_TARGET/, 'quest progress DB writes should share the quest completion target cap');
    assert.match(cityDbSource, /function normalizeQuestProgressInteger\(value, fallback = 0\)[\s\S]*Number\(hasValue \? value : fallback\)[\s\S]*MAX_CITY_QUEST_COMPLETION_TARGET/, 'quest progress DB writes should reject malformed progress numbers');
    assert.match(cityDbSource, /function upsertQuestProgressReview\(data = \{\}\)[\s\S]*const logId = normalizeCityRowId\(data\.log_id \|\| 0\)[\s\S]*const targetScore = normalizeCityQuestCompletionTarget/, 'quest progress review writes should normalize ids and target scores');
    assert.match(cityDbSource, /progress_delta: requireQuestProgressInteger\(data\.progress_delta \?\? existing\?\.progress_delta \?\? 0, 0\)/, 'quest progress review writes should validate progress_delta');
    assert.match(cityDbSource, /function advanceQuestProgress\(questId, charId, increment = 1\)[\s\S]*const delta = requireQuestProgressInteger\(increment, 1\)[\s\S]*const target = normalizeCityQuestCompletionTarget\(quest\.completion_target, 2\)/, 'quest progress advancement should reject malformed increments and targets');
    assert.doesNotMatch(cityDbSource, /Number\(data\.progress_delta \?\? existing\?\.progress_delta \?\? 0\)/, 'quest progress reviews must not write raw progress_delta numbers');
    assert.doesNotMatch(cityDbSource, /Number\(claim\.progress_count \|\| 0\) \+ Number\(increment \|\| 0\)/, 'quest progress advancement must not write raw increment numbers');
    assert.doesNotMatch(cityDbSource, /data\.reward_gold \?\? 50, data\.reward_cal \?\? 0/, 'quest DB writes must not persist raw reward values');

    assert.match(mayorService, /const questDraft = normalizeCityQuestPayload\(/, 'mayor-created quests should validate AI reward numbers before writes');
    assert.match(mayorService, /throw new Error\('市长任务奖励或目标数值无效'\)/, 'invalid mayor quest rewards should fail instead of being silently corrected');
    assert.match(mayorService, /function parseMayorJsonReply\(replyText[\s\S]*replace\(\/```\(\?:json\)\?\\s\*\/gi, ''\)[\s\S]*return JSON\.parse\(cleaned\)/, 'mayor JSON parsing should require the full cleaned reply to be JSON');
    assert.match(mayorService, /function normalizeMayorScoreInteger\(value, min, max\)[\s\S]*String\(value \?\? ''\)\.trim\(\)[\s\S]*\/\^\\d\+\$\/\.test\(text\)/, 'mayor scoring should reject partial numeric strings from AI output');
    assert.match(mayorService, /const targetScore = normalizeMayorScoreInteger\(parsed\?\.target_score, 1, 10\);[\s\S]*throw new Error\('市长 AI 难度评分 target_score 无效。'\)/, 'mayor difficulty scoring should fail invalid target_score instead of using fallback');
    assert.match(mayorService, /let progressDelta = normalizeMayorScoreInteger\(parsed\?\.progress_delta, 0, 3\);[\s\S]*throw new Error\('市长 AI 任务评分 progress_delta 无效。'\)/, 'mayor progress scoring should fail invalid progress_delta instead of accepting parseInt');
    assert.match(mayorService, /if \(!scoredQuest\?\.success\)[\s\S]*throw new Error\(scoredQuest\?\.error \|\| scoredQuest\?\.reason \|\| '市长难度评分失败，请重试。'\)/, 'mayor-created quests should propagate score failures for retry');
    assert.match(eventQuestRoutes, /if \(!scoredQuest\?\.success\)[\s\S]*canRetry: true/, 'manual quest creation should report mayor scoring failures instead of creating fallback-scored quests');
    assert.doesNotMatch(mayorService, /success: false,[\s\S]*fallback: true,[\s\S]*targetScore/, 'missing mayor model must not become a fallback-scored quest');
    assert.doesNotMatch(mayorService, /parseInt\(parsed\?\.target_score, 10\)/, 'mayor difficulty scoring must not parse partial target_score strings');
    assert.doesNotMatch(mayorService, /parseInt\(parsed\?\.progress_delta, 10\)/, 'mayor progress scoring must not parse partial progress_delta strings');
    assert.doesNotMatch(mayorService, /jsonMatch\s*=\s*text\.match\(\/\\\{\[\\s\\S\]\*\\\}\/\)|JSON\.parse\(jsonMatch\[0\]\)/, 'mayor JSON parsing must not slice an object out of malformed model text');
    assert.doesNotMatch(mayorService, /db\.city\.createQuest\(\{\s*title: q\.title[\s\S]*reward_gold: q\.reward_gold \?\? 50/, 'mayor service must not write raw AI reward numbers');

    assert.equal(guards.normalizeCityQuestPayload({ title: 'x', reward_gold: 0, reward_cal: 0, completion_target: 1 }).reward_gold, 0);
    assert.equal(guards.normalizeCityQuestPayload({ title: 'x' }).reward_gold, 50);
    assert.equal(guards.normalizeCityQuestPayload({ title: 'x', reward_gold: -1 }), null);
    assert.equal(guards.normalizeCityQuestPayload({ title: 'x', reward_cal: 4001 }), null);
    assert.equal(guards.normalizeCityQuestPayload({ title: 'x', completion_target: 11 }), null);
});

test('city quest resolution narration failures do not become completed quest writes', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const questService = readRepoFile('server', 'plugins', 'city', 'services', 'questService.js');
    const eventQuestRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'eventQuestRoutes.js');
    const questServiceStart = cityIndex.indexOf('const questService = createQuestService({');
    const questServiceEnd = cityIndex.indexOf('});', questServiceStart);
    assert.notEqual(questServiceStart, -1, 'city plugin should create quest service');
    assert.notEqual(questServiceEnd, -1, 'city plugin quest service options should close');
    const questServiceOptions = cityIndex.slice(questServiceStart, questServiceEnd);

    assert.match(questService, /throw new Error\('任务结果文案生成缺少模型配置，请重试。'\)/, 'quest resolution should fail missing model config instead of local narration fallback');
    assert.match(questService, /function cleanQuestJsonReply\(text\)[\s\S]*replace\(\/```\(\?:json\)\?\\s\*\/gi, ''\)[\s\S]*trim\(\)/, 'quest resolution should only strip code fences before JSON parsing');
    assert.match(questService, /const cleaned = cleanQuestJsonReply\(reply\);[\s\S]*if \(!cleaned\) throw new Error\('任务结果文案生成没有返回 JSON。'\)[\s\S]*const parsed = JSON\.parse\(cleaned\)/, 'quest resolution should parse the full cleaned model JSON');
    assert.match(questService, /if \(!log \|\| !systemLog \|\| !announcement\) \{[\s\S]*throw new Error\('任务结果文案生成字段不完整。'\)/, 'quest resolution should fail incomplete narration fields');
    assert.match(questService, /catch \(err\) \{[\s\S]*console\.warn\(`\[City\] 任务结果文案生成失败[\s\S]*throw err;/, 'quest resolution should propagate generation errors');
    assert.match(questService, /const resolution = await buildQuestResolutionNarrations\(char, quest, district, db, expectedOutcome\);[\s\S]*const result = db\.city\.resolveQuestCompletion\?\.\(activeClaim\.quest_id, char\.id\)/, 'automatic quest completion should generate narration before mutating quest completion state');
    assert.match(eventQuestRoutes, /const resolution = await buildQuestResolutionNarrations\(claimant, quest, questDistrict, req\.db, expectedOutcome\);[\s\S]*const completion = req\.db\.city\.resolveQuestCompletion\(questId, charId\)/, 'manual quest completion should generate narration before mutating quest completion state');

    assert.doesNotMatch(questService, /String\(reply \|\| ''\)\.match\(\/\\\{\[\\s\\S\]\*\\\}\/\)|JSON\.parse\(match\[0\]\)|任务完成文案生成失败|任务失败文案生成失败|任务系统播报生成失败|任务完成公告生成失败|return \{\s*log: fallbackLog|buildCollapsedCityLog/, 'quest resolution should not keep JSON slicing or local fallback narration text');
    assert.doesNotMatch(questServiceOptions, /buildCollapsedCityLog/, 'city plugin should not pass fallback narration helpers into quest resolution');
});

test('city mayor runtime does not keep a rule fallback success path', () => {
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const mayorRuntime = readRepoFile('server', 'plugins', 'city', 'services', 'mayorRuntimeService.js');
    const { createMayorRuntimeService } = require(path.join(repoRoot, 'server', 'plugins', 'city', 'services', 'mayorRuntimeService.js'));
    const mayorRuntimeService = createMayorRuntimeService();
    const makeMayorDb = (config) => ({ city: { getConfig: () => config } });
    const now = 10 * 60 * 60 * 1000;

    assert.match(mayorRuntime, /reason: 'malformed_output'[\s\S]*canRetry: true/, 'malformed mayor JSON should be reported as retryable failure');
    assert.match(mayorRuntime, /reason: 'mayor_api_failed'[\s\S]*canRetry: true/, 'mayor API failures should be reported as retryable failure');
    assert.doesNotMatch(mayorRuntime, /function applyFallbackMayorDecisions|Mayor fallback|使用规则生成|return \{ success: true,[\s\S]*fallback: true \}/, 'mayor runtime must not keep a rule-generated fallback success path');
    assert.doesNotMatch(mayorRuntime, /Math\.random\(\)[\s\S]*createQuest/, 'mayor runtime must not randomly create fallback quests');
    assert.doesNotMatch(mayorRuntime, /parseInt\(config\.mayor_interval_hours|parseInt\(config\.mayor_last_run_at/, 'mayor runtime should not partially parse stored scheduling config');
    assert.doesNotMatch(cityIndex, /applyFallbackMayorDecisions|mayorRuntimeService\.applyFallbackMayorDecisions/, 'city plugin should not expose a mayor fallback wrapper');

    assert.equal(mayorRuntimeService.shouldAutoRunMayor(makeMayorDb({ mayor_enabled: '1' }), now), true);
    assert.equal(mayorRuntimeService.shouldAutoRunMayor(makeMayorDb({ mayor_enabled: '1', mayor_interval_hours: '6', mayor_last_run_at: String(now - 6 * 60 * 60 * 1000) }), now), true);
    assert.equal(mayorRuntimeService.shouldAutoRunMayor(makeMayorDb({ mayor_enabled: '1', mayor_interval_hours: '6', mayor_last_run_at: String(now - 5 * 60 * 60 * 1000) }), now), false);
    assert.equal(mayorRuntimeService.shouldAutoRunMayor(makeMayorDb({ mayor_enabled: '1', mayor_interval_hours: '1abc', mayor_last_run_at: '0' }), now), false);
    assert.equal(mayorRuntimeService.shouldAutoRunMayor(makeMayorDb({ mayor_enabled: '1', mayor_interval_hours: '6', mayor_last_run_at: '10abc' }), now), false);
});

test('city event effects and duration are validated before event writes', () => {
    const inputGuards = readRepoFile('server', 'plugins', 'city', 'utils', 'inputGuards.js');
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');
    const eventQuestRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'eventQuestRoutes.js');
    const mayorService = readRepoFile('server', 'plugins', 'city', 'services', 'mayorService.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'city', 'utils', 'inputGuards.js'));

    assert.match(inputGuards, /const MAX_CITY_EVENT_DURATION_HOURS = 168/, 'city events should have a bounded maximum duration');
    assert.match(inputGuards, /const MAX_CITY_EVENT_CAL_BONUS = 4000/, 'city event calorie effects should be bounded');
    assert.match(inputGuards, /const MAX_CITY_EVENT_MONEY_BONUS = 100000/, 'city event money effects should be bounded');
    assert.match(inputGuards, /function normalizeCityEventPayload\(data = \{\}\)/, 'city event numeric validation should be centralized');

    assert.match(eventQuestRoutes, /const payload = normalizeCityEventPayload\(req\.body \|\| \{\}\)/, 'manual event route should validate before DB writes');
    assert.match(eventQuestRoutes, /return res\.status\(400\)\.json\(\{ error: '城市事件数值无效' \}\)/, 'manual event route should reject invalid event numbers with 400');

    assert.match(cityDbSource, /const payload = normalizeCityEventPayload\(data\)/, 'event DB writes should keep a defensive validation layer');
    assert.match(cityDbSource, /if \(!payload\) throw new Error\('城市事件数值无效'\)/, 'event DB writes should reject invalid event numbers');
    assert.match(cityDbSource, /const expires = now \+ payload\.duration_hours \* 3600000/, 'event expiry should use normalized duration');
    assert.match(cityDbSource, /JSON\.stringify\(payload\.effect \|\| \{\}\)/, 'event effects should be stored from the normalized effect object');
    assert.doesNotMatch(cityDbSource, /\(data\.duration_hours \|\| 24\) \* 3600000/, 'event DB writes must not use raw duration values');

    assert.match(mayorService, /const eventPayload = normalizeCityEventPayload\(/, 'mayor-created events should validate AI effect numbers before writes');
    assert.match(mayorService, /throw new Error\('市长事件数值无效'\)/, 'invalid mayor event effects should fail instead of being silently corrected');
    assert.doesNotMatch(mayorService, /db\.city\.createEvent\(\{\s*type: ev\.type[\s\S]*effect: ev\.effect \|\| \{\}/, 'mayor service must not write raw AI event effects');

    assert.equal(guards.normalizeCityEventPayload({ title: 'x', duration_hours: 0 }), null);
    assert.equal(guards.normalizeCityEventPayload({ title: 'x', duration_hours: 169 }), null);
    assert.equal(guards.normalizeCityEventPayload({ title: 'x', effect: { cal_bonus: 4001 } }), null);
    assert.equal(guards.normalizeCityEventPayload({ title: 'x', effect: { money_bonus: -100001 } }), null);
    assert.equal(guards.normalizeCityEventPayload({ title: 'x', effect: { price_modifier: 0 } }), null);
    assert.deepEqual(
        guards.normalizeCityEventPayload({ title: 'x', duration_hours: 12, effect: { district: 'park', cal_bonus: -50, money_bonus: 20.5, price_modifier: 0.5 } }).effect,
        { district: 'park', cal_bonus: -50, money_bonus: 20.5, price_modifier: 0.5 }
    );
});

test('city catalog items reject invalid prices, recovery, and stock before writes', () => {
    const inputGuards = readRepoFile('server', 'plugins', 'city', 'utils', 'inputGuards.js');
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'city', 'utils', 'inputGuards.js'));

    assert.match(inputGuards, /const MAX_CITY_ITEM_PRICE = 1000000/, 'city catalog item prices should have a bounded maximum');
    assert.match(inputGuards, /const MAX_CITY_ITEM_CAL_RESTORE = 4000/, 'city catalog item calorie restore should stay inside the calorie cap');
    assert.match(inputGuards, /const MAX_CITY_ITEM_STOCK = 100000/, 'city catalog item stock should be bounded');
    assert.match(inputGuards, /function normalizeCityCatalogItemPayload\(data = \{\}\)/, 'city item numeric validation should be centralized');

    assert.match(cityIndex, /normalizeCityCatalogItemPayload[\s\S]*require\('\.\/utils\/inputGuards'\)/, 'city index should use the shared item guard');
    assert.match(cityIndex, /return normalizeCityCatalogItemPayload\(\{[\s\S]*category: inferItemCategory\(raw\)/, 'city item payload normalization should delegate numeric fields to the guard');

    assert.match(coreRoutes, /const payload = normalizeItemPayload\(req\.body \|\| \{\}\)/, 'item route should normalize request data before DB writes');
    assert.match(coreRoutes, /if \(!payload\) return res\.status\(400\)\.json\(\{ error: '物品数值无效' \}\)/, 'item route should reject invalid item numbers with 400');

    assert.match(cityDbSource, /const payload = normalizeCityCatalogItemPayload\(data\)/, 'item DB writes should keep a defensive validation layer');
    assert.match(cityDbSource, /if \(!payload\) throw new Error\('物品数值无效'\)/, 'item DB writes should reject invalid item numbers');
    assert.match(cityDbSource, /payload\.buy_price, payload\.sell_price, payload\.cal_restore/, 'item DB writes should store normalized price and recovery values');
    assert.doesNotMatch(cityDbSource, /data\.buy_price \?\? 10, data\.sell_price \?\? 0, data\.cal_restore \?\? 0/, 'item DB writes must not persist raw item numeric values');

    assert.equal(guards.normalizeCityCatalogItemPayload({ name: 'x', buy_price: -1 }), null);
    assert.equal(guards.normalizeCityCatalogItemPayload({ name: 'x', sell_price: -1 }), null);
    assert.equal(guards.normalizeCityCatalogItemPayload({ name: 'x', cal_restore: 4001 }), null);
    assert.equal(guards.normalizeCityCatalogItemPayload({ name: 'x', stock: -2 }), null);
    assert.equal(guards.normalizeCityCatalogItemPayload({ name: 'x', stock: 100001 }), null);
    assert.deepEqual(
        guards.normalizeCityCatalogItemPayload({ name: 'x', buy_price: 0, sell_price: 2.5, cal_restore: 300, stock: -1, sort_order: 3 }),
        { name: 'x', buy_price: 0, sell_price: 2.5, cal_restore: 300, stock: -1, sort_order: 3, is_available: 1 }
    );
});

test('city districts reject invalid costs, rewards, and duration before writes', () => {
    const inputGuards = readRepoFile('server', 'plugins', 'city', 'utils', 'inputGuards.js');
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'city', 'utils', 'inputGuards.js'));

    assert.match(inputGuards, /const MAX_CITY_DISTRICT_CAL_COST = 4000/, 'city district calorie costs should be bounded');
    assert.match(inputGuards, /const MAX_CITY_DISTRICT_MONEY_REWARD = 1000000/, 'city district money rewards should be bounded');
    assert.match(inputGuards, /const MAX_CITY_DISTRICT_DURATION_TICKS = 1440/, 'city district action duration should be bounded');
    assert.match(inputGuards, /function normalizeCityDistrictPayload\(data = \{\}\)/, 'city district numeric validation should be centralized');

    assert.match(cityIndex, /normalizeCityDistrictPayload\(\{[\s\S]*action_label: raw\.action_label \|\| '前往'/, 'city district payload normalization should delegate numeric fields to the guard');
    assert.match(coreRoutes, /const payload = normalizeDistrictPayload\(req\.body \|\| \{\}\)/, 'district route should normalize request data before DB writes');
    assert.match(coreRoutes, /if \(!payload\) return res\.status\(400\)\.json\(\{ error: '分区数值无效' \}\)/, 'district route should reject invalid district numbers with 400');

    assert.match(cityDbSource, /const payload = normalizeCityDistrictPayload\(data\)/, 'district DB writes should keep a defensive validation layer');
    assert.match(cityDbSource, /if \(!payload\) throw new Error\('分区数值无效'\)/, 'district DB writes should reject invalid district numbers');
    assert.match(cityDbSource, /payload\.cal_cost, payload\.cal_reward, payload\.money_cost, payload\.money_reward/, 'district DB writes should store normalized costs and rewards');
    assert.doesNotMatch(cityDbSource, /data\.cal_cost, data\.cal_reward, data\.money_cost, data\.money_reward/, 'district DB writes must not persist raw district numeric values');

    assert.equal(guards.normalizeCityDistrictPayload({ name: 'x', cal_cost: -1 }), null);
    assert.equal(guards.normalizeCityDistrictPayload({ name: 'x', cal_reward: 4001 }), null);
    assert.equal(guards.normalizeCityDistrictPayload({ name: 'x', money_cost: -1 }), null);
    assert.equal(guards.normalizeCityDistrictPayload({ name: 'x', money_reward: 1000001 }), null);
    assert.equal(guards.normalizeCityDistrictPayload({ name: 'x', duration_ticks: 0 }), null);
    assert.equal(guards.normalizeCityDistrictPayload({ name: 'x', capacity: -1 }), null);
    const normalized = guards.normalizeCityDistrictPayload({
        name: 'x',
        cal_cost: 50,
        cal_reward: 0,
        money_cost: 10.25,
        money_reward: 20,
        duration_ticks: 2,
        capacity: 0,
        sort_order: -3
    });
    assert.equal(normalized.money_cost, 10.25);
    assert.equal(normalized.duration_ticks, 2);
    assert.equal(normalized.is_enabled, 1);
});

test('city config rejects invalid numeric values before persistence', () => {
    const inputGuards = readRepoFile('server', 'plugins', 'city', 'utils', 'inputGuards.js');
    const coreRoutes = readRepoFile('server', 'plugins', 'city', 'routes', 'coreRoutes.js');
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const cityDbSource = readRepoFile('server', 'plugins', 'city', 'cityDb.js');
    const actionService = readRepoFile('server', 'plugins', 'city', 'services', 'actionService.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'city', 'utils', 'inputGuards.js'));

    assert.match(inputGuards, /const MAX_CITY_CONFIG_LOG_LIMIT = 20/, 'city log limit config values should match frontend slider bounds');
    assert.match(inputGuards, /const MAX_CITY_CONFIG_INTERVAL_HOURS = 168/, 'mayor interval config should be bounded');
    assert.match(inputGuards, /function normalizeCityConfigValue\(key, value\)/, 'city config value validation should be centralized');
    assert.match(inputGuards, /function normalizeStoredCityOffsetHours\(value\)[\s\S]*!Number\.isFinite\(parsed\) \|\| parsed < 0 \|\| parsed >= 24/, 'stored city hour offsets should allow fractional hours but reject non-finite and out-of-day values');
    assert.match(inputGuards, /BOOLEAN_CONFIG_KEYS/, 'boolean city config keys should be normalized explicitly');
    assert.match(inputGuards, /city_time_offset_hours' && parsed >= 24/, 'city time offset hours should stay within one day');

    assert.match(coreRoutes, /const value = normalizeCityConfigValue\(key, req\.body\?\.value\)/, 'city config route should validate values before DB writes');
    assert.match(coreRoutes, /if \(value === null\) return res\.status\(400\)\.json\(\{ error: '城市配置值无效' \}\)/, 'city config route should reject invalid config values with 400');
    assert.match(cityIndex, /const hoursOffset = normalizeStoredCityOffsetHours\(config\.city_time_offset_hours\)[\s\S]*now\.setTime\(now\.getTime\(\) \+ daysOffset \* 24 \* 60 \* 60 \* 1000 \+ hoursOffset \* 60 \* 60 \* 1000\)/, 'city virtual clock should preserve fractional hour offsets');
    assert.match(cityIndex, /function normalizeMetabolismPerMinute\(config\)[\s\S]*if \(metabolismRate <= 0\) return 0[\s\S]*Math\.max\(1, Math\.round\(metabolismRate \/ 15\)\)/, 'city metabolism runtime should honor zero metabolism without changing positive-rate behavior');
    assert.match(cityIndex, /const minuteMetabolism = normalizeMetabolismPerMinute\(config\)/, 'city passive survival tick should use normalized metabolism config');
    assert.doesNotMatch(cityIndex, /parseInt\(config\.city_time_offset_hours\)/, 'city virtual clock must not truncate minute-level time skips');
    assert.doesNotMatch(cityIndex, /parseInt\(config\.metabolism_rate\) \|\| 20/, 'city metabolism config must not treat valid zero as missing');

    assert.match(actionService, /function normalizeCityActionConfigNumber\(config, key, fallback\)/, 'city action runtime config reads should share strict config normalization');
    assert.match(actionService, /const inflation = normalizeCityActionConfigNumber\(config, 'inflation', 1\.0\)/, 'city action costs should honor zero inflation config instead of fallback');
    assert.match(actionService, /const workBonus = normalizeCityActionConfigNumber\(config, 'work_bonus', 1\.0\)/, 'city work rewards should honor zero work bonus config instead of fallback');
    assert.match(actionService, /const winRate = normalizeCityActionConfigNumber\(config, 'gambling_win_rate', 0\.35\)/, 'city gambling should honor zero win-rate config instead of fallback');
    assert.match(actionService, /const payout = normalizeCityActionConfigNumber\(config, 'gambling_payout', 3\.0\)/, 'city gambling should honor zero payout config instead of fallback');
    assert.doesNotMatch(actionService, /parseFloat\(config\.(inflation|work_bonus|gambling_win_rate|gambling_payout)\) \|\|/, 'city action runtime config reads must not treat valid zero values as missing');

    assert.match(cityDbSource, /const normalizedValue = normalizeCityConfigValue\(cleanKey, value\)/, 'city config DB writes should keep a defensive validation layer');
    assert.match(cityDbSource, /if \(!cleanKey \|\| normalizedValue === null\) throw new Error\('城市配置值无效'\)/, 'city config DB writes should reject invalid known config values');
    assert.doesNotMatch(cityDbSource, /VALUES \(\?, \?\)'\)\.run\(key, String\(value\)\)/, 'city config DB writes must not persist raw config values');

    assert.equal(guards.normalizeCityConfigValue('mayor_interval_hours', 0), null);
    assert.equal(guards.normalizeCityConfigValue('mayor_interval_hours', 169), null);
    assert.equal(guards.normalizeCityConfigValue('metabolism_rate', 0), '0');
    assert.equal(guards.normalizeCityConfigValue('city_moment_probability', 101), null);
    assert.equal(guards.normalizeCityConfigValue('inflation', 0), '0');
    assert.equal(guards.normalizeCityConfigValue('work_bonus', 0), '0');
    assert.equal(guards.normalizeCityConfigValue('gambling_win_rate', 0), '0');
    assert.equal(guards.normalizeCityConfigValue('gambling_payout', 0), '0');
    assert.equal(guards.normalizeCityConfigValue('gambling_win_rate', 1.1), null);
    assert.equal(guards.normalizeCityConfigValue('city_time_offset_hours', 24), null);
    assert.equal(guards.normalizeCityConfigValue('city_actions_paused', 'true'), '1');
    assert.equal(guards.normalizeCityConfigValue('city_actions_paused', 'false'), '0');
    assert.equal(guards.normalizeCityConfigValue('city_time_offset_hours', 0.0166666667), '0.0166666667');
    assert.equal(guards.normalizeStoredCityOffsetHours('0.5'), 0.5);
    assert.equal(guards.normalizeStoredCityOffsetHours(24), 0);
    assert.equal(guards.normalizeStoredCityOffsetDays('2.5'), 0);
    assert.equal(guards.normalizeCityConfigValue('unknown_plugin_key', undefined), '');
});

test('city growth course writes reject invalid ids and numeric fields', () => {
    const growthIndex = readRepoFile('server', 'plugins', 'cityGrowth', 'index.js');
    const growthDbSource = readRepoFile('server', 'plugins', 'cityGrowth', 'growthDb.js');
    const inputGuards = readRepoFile('server', 'plugins', 'cityGrowth', 'inputGuards.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'cityGrowth', 'inputGuards.js'));

    assert.match(inputGuards, /const MAX_COURSE_SORT_ORDER = 10000/, 'cityGrowth course sort order should be bounded');
    assert.match(inputGuards, /class CityGrowthValidationError extends Error/, 'cityGrowth validation should expose a typed 400 error');
    assert.match(inputGuards, /function normalizeCityGrowthCoursePayload\(payload = \{\}\)/, 'cityGrowth course payload validation should be centralized');
    assert.match(inputGuards, /function normalizeCityGrowthCourseId\(value\)/, 'cityGrowth course id validation should be reusable outside course upserts');
    assert.match(inputGuards, /function normalizeCityGrowthMasteryGain\(value\)/, 'cityGrowth mastery gain validation should be centralized');
    assert.match(inputGuards, /!Number\.isSafeInteger\(parsed\) \|\| parsed < min \|\| parsed > max/, 'cityGrowth numeric fields should reject NaN, Infinity, decimals, and out-of-range values');
    assert.match(inputGuards, /id\.includes\('\\0'\) \|\| \/\[\/\?#\\\\\]\//, 'cityGrowth course ids should reject path-like or null-byte ids');

    assert.match(growthIndex, /const payload = normalizeCityGrowthCoursePayload\(req\.body \|\| \{\}\)/, 'cityGrowth route should validate course payloads before DB writes');
    assert.match(growthIndex, /res\.status\(isCityGrowthValidationError\(e\) \? 400 : 500\)/, 'cityGrowth route should return validation errors as 400');
    assert.doesNotMatch(growthIndex, /sort_order: Number\(payload\.sort_order \|\| 0\) \|\| 0/, 'cityGrowth route must not persist raw or non-finite sort order values');

    assert.match(growthDbSource, /const payload = normalizeCityGrowthCoursePayload\(data\)/, 'cityGrowth DB writes should keep a defensive validation layer');
    assert.match(growthDbSource, /const courseId = normalizeCityGrowthCourseId\(id\)/, 'cityGrowth course lookup and toggle should normalize route ids');
    assert.match(growthDbSource, /const cleanCourseId = normalizeCityGrowthCourseId\(courseId\)/, 'cityGrowth progress writes should normalize course ids defensively');
    assert.match(growthDbSource, /const gain = normalizeCityGrowthMasteryGain\(delta\)/, 'cityGrowth progress writes should reject non-finite or negative mastery gains');
    assert.match(growthDbSource, /SELECT id FROM characters WHERE id = \?/, 'cityGrowth progress writes should reject ghost characters before inserting progress');
    assert.match(growthDbSource, /if \(!getSchoolCourse\(cleanCourseId\)\)[\s\S]*throw new Error\('课程不存在'\)/, 'cityGrowth progress writes should reject ghost courses before inserting progress');
    assert.match(growthDbSource, /payload\.sort_order,[\s\S]*payload\.is_enabled/, 'cityGrowth DB writes should store normalized numeric fields');
    assert.doesNotMatch(growthDbSource, /data\.sort_order \?\? 0/, 'cityGrowth DB writes must not persist raw sort order values');

    assert.throws(
        () => guards.normalizeCityGrowthCoursePayload({ id: 'bad/path', name: 'x' }),
        /课程 id 无效/,
        'path-like course ids should be rejected'
    );
    assert.throws(
        () => guards.normalizeCityGrowthCoursePayload({ id: 'x', name: 'x', sort_order: Infinity }),
        /课程排序无效/,
        'non-finite sort order should be rejected'
    );
    assert.throws(
        () => guards.normalizeCityGrowthCoursePayload({ id: 'x', name: 'x', is_enabled: 2 }),
        /启用状态无效/,
        'invalid enabled flags should be rejected'
    );
    assert.throws(
        () => guards.normalizeCityGrowthCourseId('bad/path'),
        /课程 id 无效/,
        'course id route parameters should reject path-like ids'
    );
    assert.throws(
        () => guards.normalizeCityGrowthMasteryGain(Infinity),
        /课程熟练度增量无效/,
        'non-finite mastery gains should be rejected'
    );
    assert.throws(
        () => guards.normalizeCityGrowthMasteryGain(-1),
        /课程熟练度增量无效/,
        'negative mastery gains should be rejected'
    );
    assert.equal(
        guards.normalizeCityGrowthCoursePayload({ id: '心理课', name: '心理课', sort_order: -2, is_enabled: false }).is_enabled,
        0,
        'human-readable non-path ids should still be accepted'
    );
});

test('small plugin db migrations avoid silent alter-table catches', () => {
    const growthDbSource = readRepoFile('server', 'plugins', 'cityGrowth', 'growthDb.js');
    const socialHousingDbSource = readRepoFile('server', 'plugins', 'socialHousing', 'db.js');

    assert.match(growthDbSource, /function addColumnIfMissing/, 'cityGrowth migrations should use schema-aware column creation');
    assert.match(growthDbSource, /addColumnIfMissing\('city_school_courses', 'prompt_effect_basic'/, 'cityGrowth basic prompt effect migration should be explicit');
    assert.doesNotMatch(growthDbSource, /try \{ db\.exec\("ALTER TABLE/, 'cityGrowth should not silently catch ALTER TABLE migrations');

    assert.match(socialHousingDbSource, /function addColumnIfMissing/, 'socialHousing migrations should use schema-aware column creation');
    assert.match(socialHousingDbSource, /addColumnIfMissing\('social_housing_bindings', 'rent_due_at'/, 'socialHousing rent migration should be explicit');
    assert.match(socialHousingDbSource, /addColumnIfMissing\('social_housing_agency', 'decision_interval_hours'/, 'socialHousing agency migration should be explicit');
    assert.doesNotMatch(socialHousingDbSource, /try \{ db\.exec\("ALTER TABLE/, 'socialHousing should not silently catch ALTER TABLE migrations');
});

test('social housing rental chain is wired from storage through prompts and UI controls', () => {
    const socialHousingIndex = readRepoFile('server', 'plugins', 'socialHousing', 'index.js');
    const socialHousingDbSource = readRepoFile('server', 'plugins', 'socialHousing', 'db.js');
    const rentalChainService = readRepoFile('server', 'plugins', 'socialHousing', 'rentalChainService.js');
    const housingEffects = readRepoFile('server', 'plugins', 'socialHousing', 'housingEffects.js');
    const contextBuilder = readRepoFile('server', 'contextBuilder.js');
    const cityIndex = readRepoFile('server', 'plugins', 'city', 'index.js');
    const cityActionService = readRepoFile('server', 'plugins', 'city', 'services', 'actionService.js');
    const housingPanel = readRepoFile('client', 'src', 'plugins', 'socialHousing', 'HousingSocialPanel.jsx');

    assert.match(socialHousingDbSource, /addColumnIfMissing\('social_housing_ads', 'home_id'/, 'agency ads should persist the home they advertise');
    assert.match(socialHousingDbSource, /INSERT INTO social_housing_ads \(home_id, title, content, trigger_type, office_district, created_at\)/, 'agency ad writes should include home_id');
    assert.match(socialHousingDbSource, /CREATE TABLE IF NOT EXISTS social_housing_rental_chains/, 'rental chains should have durable storage');
    assert.match(socialHousingDbSource, /CREATE TABLE IF NOT EXISTS social_housing_rental_chain_events/, 'rental chain events should have durable storage');
    assert.match(socialHousingDbSource, /addColumnIfMissing\('social_housing_bindings', 'housing_started_at'/, 'housing bindings should remember when the character obtained the home');
    assert.match(socialHousingDbSource, /UPDATE social_housing_bindings[\s\S]*SET housing_started_at = CASE[\s\S]*WHERE COALESCE\(housing_id, ''\) != ''[\s\S]*COALESCE\(housing_started_at, 0\) <= 0/, 'legacy housed bindings should backfill the housing start date');
    assert.match(socialHousingDbSource, /const legacyDueRows = db\.prepare\(`[\s\S]*COALESCE\(rent_due_at, 0\) > 0[\s\S]*if \(isRentCollectionDay\(row\.rent_due_at\)\) continue[\s\S]*getNextRentCollectionAt\(row\.rent_due_at, \{ includeCurrentDay: true \}\)/, 'legacy rent due dates should be migrated onto Friday collection days');
    assert.match(socialHousingDbSource, /const housingStartedAt = hasHousing[\s\S]*housingChanged \? Date\.now\(\) : current\?\.housing_started_at[\s\S]*housing_started_at=excluded\.housing_started_at/, 'housing binding writes should persist a stable housing start date');
    assert.match(socialHousingDbSource, /function createRentalChain\(payload = \{\}\)[\s\S]*if \(!getHousingById\(homeId\)\) throw new SocialHousingValidationError\('房源不存在'\)/, 'rental chains should reject ghost homes');
    assert.match(socialHousingDbSource, /function appendRentalChainEvent\(chainId, eventType, payload = \{\}\)[\s\S]*JSON\.stringify\(payload \|\| \{\}\)/, 'rental chain events should persist structured payloads');
    assert.match(socialHousingDbSource, /function markRentalChainFailed\(id, errorMessage = ''\)[\s\S]*status: 'failed'[\s\S]*retry_count: Number\(chain\.retry_count \|\| 0\) \+ 1/, 'failed rental chains should be marked retryable');
    assert.match(socialHousingDbSource, /const RENT_COLLECTION_WEEKDAY = 5[\s\S]*function getNextRentCollectionAt/, 'rent collection should be anchored to Fridays');
    assert.match(socialHousingDbSource, /function normalizeRentDueAt[\s\S]*if \(!String\(payload\.housing_id \|\| ''\)\.trim\(\)\) return 0[\s\S]*return getNextRentCollectionAt\(Date\.now\(\)\)/, 'new or changed housing bindings should default to the next Friday collection date and cleared housing should have no due date');
    assert.match(socialHousingDbSource, /const hasHousing = !!normalized\.housing_id[\s\S]*const rentWeekly = hasHousing \? normalized\.rent_weekly : 0[\s\S]*const housingStatus = hasHousing[\s\S]*: 'homeless'/, 'cleared housing bindings should not keep stale rent or stable-housing state');
    assert.match(socialHousingDbSource, /function markRentPaid[\s\S]*const dueDays = Math\.max\(1[\s\S]*getNextRentCollectionAt\(paidAt \+ dueDays \* DAY_MS, \{ includeCurrentDay: true \}\)/, 'paid rent should roll to the first Friday after the paid rent period');
    assert.match(socialHousingDbSource, /function getDueRentBindings\(now = Date\.now\(\)\) \{[\s\S]*if \(!isRentCollectionDay\(now\)\) return \[\]/, 'automatic due-rent scans should only return due bindings on Friday');

    assert.match(socialHousingIndex, /function getRentalChainEventMap\(socialHousingDb, chains = \[\]\)[\s\S]*socialHousingDb\.getRentalChainEvents\(id\)/, 'bootstrap and mutations should collect recent rental chain events');
    assert.match(socialHousingIndex, /const rentalChains = socialHousingDb\.getRentalChains \? socialHousingDb\.getRentalChains\(20\) : \[\][\s\S]*rental_chains: rentalChains[\s\S]*rental_chain_events: getRentalChainEventMap\(socialHousingDb, rentalChains\)/, 'bootstrap and mutations should return recent rental chains with events');
    assert.match(socialHousingIndex, /app\.post\('\/api\/social-housing\/characters\/:id\/recommend-home'[\s\S]*rentalChainService\.recommendHomeToCharacter[\s\S]*runFullChain: req\.body\?\.run_full_chain !== false/, 'recommend-home route should enter the full rental chain by default');
    assert.match(socialHousingIndex, /app\.post\('\/api\/social-housing\/characters\/:id\/assign-home'[\s\S]*rentalChainService\.assignHomeToCharacter/, 'assign-home route should support direct user-granted housing');
    assert.match(socialHousingIndex, /app\.post\('\/api\/social-housing\/characters\/:id\/recommend-home'[\s\S]*can_retry: e\.canRetry !== false[\s\S]*rental_chains/, 'rental chain failures should report retryability and current chain state');
    assert.match(socialHousingIndex, /function buildFridayAgencyRentLog[\s\S]*周五中介收费日/, 'weekly rent collection should create a special Friday agency city activity');
    assert.match(socialHousingIndex, /function buildFridayRentPrivateMessage[\s\S]*今天周五，中介来收[\s\S]*他们把我赶出来了/, 'weekly rent collection should create a private chat message and mention eviction on failed payment');
    assert.match(socialHousingIndex, /source: 'social_housing_friday_rent_collection'[\s\S]*evicted: !!extra\.evicted[\s\S]*db\.addMessage\(character\.id, 'character'[\s\S]*engine\?\.broadcastNewMessage/, 'weekly rent collection should write and broadcast a character private message');
    assert.match(socialHousingIndex, /weeklyAgencyCollection \? 'AGENCY_RENT_COLLECTION' : 'RENT'[\s\S]*weeklyAgencyCollection \? 'AGENCY_RENT_EVICTION' : 'RENT_OVERDUE'/, 'weekly rent collection should use special city action types');
    assert.match(socialHousingIndex, /if \(weeklyAgencyCollection\) \{[\s\S]*socialHousingDb\.saveBinding\(character\.id, \{[\s\S]*housing_id: ''[\s\S]*housing_status: 'homeless'[\s\S]*note: `周五中介收费失败：/, 'failed Friday collection should clear the housing binding and make the character homeless');
    assert.match(socialHousingIndex, /source: 'weekly_friday_agency'[\s\S]*notifyPrivate: true[\s\S]*userId: options\.userId/, 'automatic rent settlement should run through the Friday agency collection path');
    assert.match(socialHousingIndex, /settleDueRentsForDb\(db, \{ userId: user\.id \}\)/, 'automatic rent settlement should pass the current user id for private-chat broadcasts');

    assert.match(rentalChainService, /function parseJsonObject[\s\S]*JSON\.parse\(raw\)[\s\S]*不是合法 JSON/, 'chain LLM calls should fail fast on malformed JSON');
    assert.match(rentalChainService, /const VIEWING_MORE_INFO_TAG = 'MORE_INFO'/, 'viewing should use a structured character-controlled continuation tag');
    assert.match(rentalChainService, /async function runViewingStage[\s\S]*while \(true\)[\s\S]*need_more_info_tag[\s\S]*social_housing_viewing_agent_answer_\$\{turn\}[\s\S]*appendChainEvent\(socialHousingDb, currentChain\.id, 'view_round', payload\)/, 'viewing should continue agent-character Q&A while the character keeps the MORE_INFO tag');
    assert.match(rentalChainService, /dialogue_turns: turn/, 'viewing should persist the dynamic dialogue turn count');
    assert.match(rentalChainService, /async function runConsiderStage[\s\S]*没有继续带 \$\{VIEWING_MORE_INFO_TAG\} 标签[\s\S]*不能再把“等待中介回答\/还需要补充信息”当成悬置理由[\s\S]*不要被系统强行限定地点或心理状态/, 'consideration should not force location or reopen agent Q&A after the tag is removed');
    assert.match(rentalChainService, /async function runDecisionStage[\s\S]*没有继续带 \$\{VIEWING_MORE_INFO_TAG\} 标签[\s\S]*必须基于已知事实做最终决定[\s\S]*不能再输出“等中介回答、还要再了解、之后再说”/, 'decision should be mandatory once the viewing continuation tag is removed');
    assert.match(rentalChainService, /async function runDecisionStage[\s\S]*wants_to_rent[\s\S]*HOUSING_REJECTED[\s\S]*ready_to_sign/, 'decision should allow decline, insufficient-funds rejection, or signing');
    assert.match(rentalChainService, /async function runSigningStage[\s\S]*HOUSING_SIGNED[\s\S]*status: 'completed'/, 'successful signing should bind housing and complete the chain');
    assert.match(rentalChainService, /function assertHomeIsAvailable\(home\)[\s\S]*已停用[\s\S]*不能推荐或指派/, 'rental entry points should reject disabled homes before starting a chain');
    assert.match(rentalChainService, /function assertCharacterHasNoHousing\(socialHousingDb, character[\s\S]*已经住在[\s\S]*不能再\$\{actionLabel\}/, 'rental entry points should reject characters who already have housing');
    assert.match(rentalChainService, /assertCharacterHasNoHousing\(socialHousingDb, character, '推荐住房'\)/, 'recommend-home should not start for already housed characters');
    assert.match(rentalChainService, /assertCharacterHasNoHousing\(socialHousingDb, character, '直接指派住房'\)/, 'assign-home should not overwrite an existing home through the shortcut action');
    assert.match(rentalChainService, /function sendFinalPrivateFeedback[\s\S]*source: 'social_housing_final_feedback'[\s\S]*db\.addMessage\(character\.id, 'character'[\s\S]*appendChainEvent\(socialHousingDb, chain\.id, 'final_private_feedback'/, 'terminal rental outcomes should write a private character feedback message');
    assert.match(rentalChainService, /if \(!wantsToRent\) \{[\s\S]*sendFinalPrivateFeedback\([\s\S]*outcome: 'declined'[\s\S]*requireTextField\(result, 'private_feedback'/, 'declined rental decisions should still send final private feedback');
    assert.match(rentalChainService, /social_housing_insufficient_funds_private_feedback[\s\S]*sendFinalPrivateFeedback\([\s\S]*outcome: 'rejected_insufficient_funds'/, 'insufficient-funds rejections should send final private feedback');
    assert.match(rentalChainService, /private_feedback 必须写成发给推荐你房源的用户的一条私聊反馈[\s\S]*sendFinalPrivateFeedback\([\s\S]*outcome: 'signed'/, 'successful signing should send final private feedback');
    assert.match(rentalChainService, /const nextRentDueAt = typeof socialHousingDb\.getNextRentCollectionAt === 'function'[\s\S]*paidAt \+ 7 \* 24 \* 60 \* 60 \* 1000[\s\S]*rent_due_at: nextRentDueAt/, 'signed rental-chain bindings should charge on the first Friday after the prepaid first week');
    assert.match(rentalChainService, /async function triggerRecommendationPrivateReply[\s\S]*db\.addMessage\(character\.id, 'system'[\s\S]*await engine\.triggerImmediateUserReply/, 'recommendations should notify private chat and trigger a character reply');
    assert.match(rentalChainService, /这套房源是 \$\{userName\} 推荐给你（\$\{character\.name\}）看的[\s\S]*不是给 \$\{userName\} 自己租的房/, 'recommendation replies should pin the home ownership to the character, not the user');
    assert.match(rentalChainService, /私聊前文和记忆只能作为关系背景[\s\S]*以本次系统事件为准[\s\S]*不要把用户写成看房对象/, 'recommendation replies should not let private-chat context override the event target');
    assert.match(rentalChainService, /不要输出 \[CITY_ACTION:\.\.\.\] 或 \[CITY_INTENT:\.\.\.\][\s\S]*eventUserDirective:[\s\S]*extraDirectiveRole: 'system'[\s\S]*skipTopicSwitchGate: true/, 'recommendation replies should stay a private acknowledgement and skip the topic switch gate');
    assert.match(rentalChainService, /buildUniversalContext\(\{[\s\S]*forceCityDetail: true/, 'character rental-chain calls should read the default large context library');

    assert.match(contextBuilder, /function buildHousingContextBlock\(db, character\)[\s\S]*const socialClassLine[\s\S]*return `\\n\[住房与阶层\]\\n\$\{socialClassLine\}\$\{buildHousingPromptBlock\(db, character\)\}\\n`;/, 'private chat housing context should use the canonical housing prompt block for both housed and unhoused characters');
    assert.match(contextBuilder, /function getHousingContextSourceParts\(db, character\)[\s\S]*status: 'homeless'[\s\S]*has_housing: 0/, 'prompt cache source parts should distinguish default homelessness');
    assert.match(contextBuilder, /template_version: 4,[\s\S]*housing_context: housingSourceParts/, 'runtime state prompt cache should invalidate when housing prompt semantics change');
    assert.match(housingEffects, /const rawStatus = hasHousing \? String\(binding\.housing_status \|\| 'stable'\)[\s\S]*const status = hasHousing \? rawStatus : 'homeless'/, 'runtime housing state should default to homeless without a valid binding');
    assert.match(housingEffects, /function buildHomeBasicInfo\(home = \{\}, rent = 0\)[\s\S]*description[\s\S]*周租 \$\{rent\} 金币[\s\S]*押金 \$\{deposit\} 金币/, 'housed character prompts should include basic room facts from the home record');
    assert.match(housingEffects, /function formatHousingDate\(timestamp\)[\s\S]*签订租房协议，现在住在[\s\S]*当前住房事实：\$\{housingFact\}[\s\S]*房间基本信息：\$\{homeBasicInfo\}[\s\S]*归属边界：这是你这个角色自己的当前住所/, 'housed character prompts should state the signed date, current home, basic room info, and ownership boundary');
    assert.match(housingEffects, /function getHousingPassiveMinutePatch[\s\S]*if \(!ctx\?\.hasHousing\)[\s\S]*patch\.stress \+= 1[\s\S]*patch\.social_need \+= 1[\s\S]*patch\.sleep_debt \+= 1[\s\S]*patch\.energy -= 1/, 'homeless state should change passive city recovery numerically');
    assert.match(cityIndex, /function applyPassiveSurvivalTick\(char, currentCals, currentMinute[\s\S]*dbForHousing = null\)[\s\S]*getHousingRuntimeContext[\s\S]*getHousingPassiveMinutePatch/, 'city passive ticks should include housing effects');
    assert.match(cityIndex, /const housingPromptBlock = buildHousingPromptBlock\(promptHistoryDb, char\)/, 'city action prompts should include housing constraints');
    assert.match(cityActionService, /if \(typeof applyHousingDistrictEffects === 'function'\)[\s\S]*stateEffects = applyHousingDistrictEffects\(db, char, district, stateEffects\)/, 'city action effects should include housing modifiers');

    assert.match(housingPanel, /const \[rentalChains, setRentalChains\] = useState\(\[\]\)/, 'UI should track recent rental chains');
    assert.match(housingPanel, /const \[rentalChainEvents, setRentalChainEvents\] = useState\(\{\}\)/, 'UI should track recent rental chain events');
    assert.match(housingPanel, /function buildViewingDialogue\(events = \[\]\)[\s\S]*Array\.isArray\(payload\.dialogue\)[\s\S]*payload\.agent_intro[\s\S]*payload\.char_reply_2/, 'UI should reconstruct both dynamic and legacy first-stage viewing dialogue');
    assert.match(housingPanel, /text\.viewDialogue[\s\S]*dialogueLines\.map/, 'UI should render the agent-character viewing dialogue');
    assert.match(housingPanel, /const recommendableCharacters = useMemo\(\(\) => \([\s\S]*characters\.filter\(\(item\) => !item\.binding\?\.housing_id\)/, 'recommendation and assignment controls should only target currently unhoused characters');
    assert.match(housingPanel, /const housedCharacters = useMemo\(\(\) => \([\s\S]*characters\.filter\(\(item\) => item\.binding\?\.housing_id\)/, 'existing housing display should have a separate housed-character source');
    assert.match(housingPanel, /<Section title=\{text\.roleBinding\}[\s\S]*\{housedCharacters\.map\(\(character\) =>/, 'existing housing display should render only housed characters');
    assert.doesNotMatch(housingPanel, /selectedRecommendationCurrentHome/, 'recommendation controls should not display existing-home state');
    assert.match(housingPanel, /const availableHousingTiers = useMemo\(\(\) => \([\s\S]*Number\(item\.is_enabled \?\? 1\) === 1/, 'recommendation and assignment controls should only offer enabled homes');
    assert.match(housingPanel, /\/api\/social-housing\/characters\/\$\{selectedRecommendationCharacter\.id\}\/recommend-home/, 'UI should expose the recommendation chain button for the selected eligible character');
    assert.match(housingPanel, /\/api\/social-housing\/characters\/\$\{selectedRecommendationCharacter\.id\}\/assign-home/, 'UI should expose the direct assignment button for the selected eligible character');
    assert.match(housingPanel, /const housedCount = characters\.filter\(\(c\) => c\.binding\?\.housing_id\)\.length;[\s\S]*const homelessCount = characters\.length - housedCount;[\s\S]*<StatCard label=\{text\.homeless\} value=\{homelessCount\}/, 'UI should count default homeless characters');
});

test('social housing money and rent fields reject invalid values before persistence', () => {
    const socialHousingIndex = readRepoFile('server', 'plugins', 'socialHousing', 'index.js');
    const socialHousingDbSource = readRepoFile('server', 'plugins', 'socialHousing', 'db.js');
    const inputGuardsSource = readRepoFile('server', 'plugins', 'socialHousing', 'inputGuards.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'socialHousing', 'inputGuards.js'));

    assert.match(inputGuardsSource, /const MAX_SOCIAL_HOUSING_MONEY = 1000000/, 'social housing money values should have a bounded maximum');
    assert.match(inputGuardsSource, /const MAX_SOCIAL_HOUSING_CLASS_BIAS = 100/, 'social class bias values should have a bounded maximum');
    assert.match(inputGuardsSource, /class SocialHousingValidationError extends Error/, 'social housing validation should expose a typed 400 error');
    assert.match(inputGuardsSource, /function normalizeSocialClassPayload\(payload = \{\}\)/, 'social class validation should be centralized');
    assert.match(inputGuardsSource, /weekly_rent: normalizeMoney\(payload\.weekly_rent, '每周租金'\)/, 'housing rent should be normalized centrally');
    assert.match(inputGuardsSource, /deposit: normalizeMoney\(payload\.deposit, '押金'\)/, 'housing deposits should be normalized centrally');
    assert.match(inputGuardsSource, /work_bias: normalizeBoundedInteger\(payload\.work_bias, '工作倾向'/, 'class work bias should be range checked');
    assert.match(inputGuardsSource, /rent_due_day: normalizeBoundedInteger\(/, 'binding rent due day should be range checked');
    assert.match(inputGuardsSource, /rent_due_at: normalizeBoundedInteger\([\s\S]*'下次缴租时间'[\s\S]*Number\.MAX_SAFE_INTEGER/, 'binding rent due timestamps should be range checked');
    assert.match(inputGuardsSource, /MAX_SOCIAL_HOUSING_RENT_DUE_DAY/, 'rent due day should stay within the monthly UI range');

    assert.match(socialHousingIndex, /normalizeSocialClassPayload\(req\.body \|\| \{\}\)/, 'class route should validate numeric fields before DB writes');
    assert.match(socialHousingIndex, /normalizeHousingPayload\(req\.body \|\| \{\}\)/, 'housing route should validate numeric fields before DB writes');
    assert.match(socialHousingIndex, /normalizeHousingBindingPayload\(rawPayload, currentBinding, targetHome\)/, 'binding route should validate numeric fields before DB writes');
    assert.match(socialHousingIndex, /const amount = Number\(binding\.rent_weekly \|\| home\.weekly_rent \|\| 0\)[\s\S]*!Number\.isFinite\(amount\) \|\| amount <= 0/, 'rent settlement should reject non-finite or non-positive legacy rent amounts before wallet writes');
    assert.match(socialHousingIndex, /app\.post\('\/api\/social-housing\/characters\/:id\/pay-rent'[\s\S]*const character = req\.db\.getCharacter\(req\.params\.id\)[\s\S]*return res\.status\(404\)\.json\(\{ success: false, error: '角色不存在' \}\)[\s\S]*settleCharacterRent\(req\.db, character\.id/, 'manual rent settlement should reject missing characters with 404 before service work');
    assert.match(socialHousingIndex, /city_update', action: 'rent-settled', character_id: character\.id/, 'manual rent settlement broadcasts should use the normalized character id');
    assert.match(socialHousingIndex, /pressure_level: clampNumber\(Number\(character\.pressure_level \|\| 0\) \+ 1, 0, 4\)/, 'rent-overdue pressure patches should stay within the project-wide 0..4 pressure range');
    assert.doesNotMatch(socialHousingIndex, /pressure_level: clampNumber\(Number\(character\.pressure_level \|\| 0\) \+ 1, 0, 5\)/, 'social housing must not use the old 0..5 pressure range');
    assert.match(socialHousingIndex, /isSocialHousingValidationError\(error\) \? 400 : 500/, 'invalid social housing input should return 400 rather than a server error');

    assert.match(socialHousingDbSource, /const normalized = normalizeSocialClassPayload\(payload\)/, 'class DB writes should keep a defensive validation layer');
    assert.match(socialHousingDbSource, /const normalized = normalizeHousingPayload\(payload\)/, 'housing DB writes should keep a defensive validation layer');
    assert.match(socialHousingDbSource, /SocialHousingValidationError/, 'binding DB writes should use typed validation errors for missing references');
    assert.match(socialHousingDbSource, /function getClassById\(id\)[\s\S]*SELECT \* FROM social_housing_classes WHERE id = \?/, 'social housing DB should expose class lookup for binding validation');
    assert.match(socialHousingDbSource, /const normalized = normalizeHousingBindingPayload\(payload, current, home\)/, 'binding DB writes should keep a defensive validation layer');
    assert.match(socialHousingDbSource, /const nextHousingId = String\(payload\.housing_id \|\| ''\)\.trim\(\)[\s\S]*if \(nextHousingId && !home\) throw new SocialHousingValidationError\('房屋不存在'\)/, 'binding DB writes should reject ghost housing ids');
    assert.match(socialHousingDbSource, /const nextClassId = String\(payload\.social_class_id \|\| ''\)\.trim\(\)[\s\S]*if \(nextClassId && !getClassById\(nextClassId\)\) throw new SocialHousingValidationError\('阶层不存在'\)/, 'binding DB writes should reject ghost social class ids');
    assert.doesNotMatch(socialHousingDbSource, /Number\(payload\.work_bias \|\| 0\)/, 'class DB writes must not persist raw work bias values');
    assert.doesNotMatch(socialHousingDbSource, /Number\(payload\.sort_order \|\| 0\)/, 'class DB writes must not persist raw sort values');
    assert.doesNotMatch(socialHousingDbSource, /Number\(payload\.weekly_rent \|\| 0\)/, 'housing DB writes must not persist raw weekly rent values');
    assert.doesNotMatch(socialHousingDbSource, /Number\(payload\.deposit \|\| 0\)/, 'housing DB writes must not persist raw deposit values');
    assert.doesNotMatch(socialHousingDbSource, /const rentWeekly = Number\(payload\.rent_weekly \|\| 0\)/, 'binding DB writes must not persist raw rent values');
    assert.doesNotMatch(socialHousingDbSource, /String\(payload\.social_class_id \|\| ''\)\.trim\(\),\s*normalized\.housing_id,[\s\S]*normalizeHousingBindingPayload\(payload, current, home\)/, 'binding DB writes must not persist raw class and housing references without validation');

    assert.throws(
        () => guards.normalizeSocialClassPayload({ name: 'x', work_bias: 101 }),
        /工作倾向无效/,
        'overlarge class work bias should be rejected'
    );
    assert.throws(
        () => guards.normalizeSocialClassPayload({ name: 'x', social_barrier: Infinity }),
        /社交门槛无效/,
        'non-finite social barrier should be rejected'
    );
    assert.equal(
        guards.normalizeSocialClassPayload({ name: ' x ', work_bias: '-2', sort_order: '5' }).work_bias,
        -2,
        'valid class bias strings should normalize to integers'
    );
    assert.throws(
        () => guards.normalizeHousingPayload({ name: 'x', weekly_rent: -1, deposit: 0, sale_price: 0, comfort: 0, prestige: 0, privacy: 0 }),
        /每周租金无效/,
        'negative weekly rent should be rejected'
    );
    assert.throws(
        () => guards.normalizeHousingBindingPayload({ rent_weekly: 1, rent_due_day: 31 }, null, { weekly_rent: 10 }),
        /缴租周期无效/,
        'rent due day should reject values above 30'
    );
    assert.throws(
        () => guards.normalizeHousingBindingPayload({ rent_weekly: 1, rent_due_at: Infinity }, null, { weekly_rent: 10 }),
        /下次缴租时间无效/,
        'non-finite rent due timestamps should be rejected'
    );
    assert.equal(
        guards.normalizeHousingBindingPayload({ rent_weekly: 0 }, null, { weekly_rent: 12 }).rent_weekly,
        12,
        'zero binding rent should keep the existing home-rent fallback behavior'
    );
});

test('social housing delete routes report missing targets instead of fake success', () => {
    const socialHousingIndex = readRepoFile('server', 'plugins', 'socialHousing', 'index.js');
    const socialHousingDbSource = readRepoFile('server', 'plugins', 'socialHousing', 'db.js');

    assert.match(socialHousingDbSource, /function deleteClass\(id\)[\s\S]*const cleanId = String\(id \|\| ''\)\.trim\(\)[\s\S]*const info = db\.prepare\('DELETE FROM social_housing_classes WHERE id = \?'\)\.run\(cleanId\)[\s\S]*if \(\(info\.changes \|\| 0\) > 0\)[\s\S]*UPDATE social_housing_bindings SET social_class_id = ''[\s\S]*return info\.changes \|\| 0/, 'class deletes should return actual changes and only clear bindings after a real delete');
    assert.match(socialHousingDbSource, /function deleteHousing\(id\)[\s\S]*const cleanId = String\(id \|\| ''\)\.trim\(\)[\s\S]*const info = db\.prepare\('DELETE FROM social_housing_homes WHERE id = \?'\)\.run\(cleanId\)[\s\S]*if \(\(info\.changes \|\| 0\) > 0\)[\s\S]*UPDATE social_housing_bindings SET housing_id = ''[\s\S]*return info\.changes \|\| 0/, 'housing deletes should return actual changes and only clear bindings after a real delete');
    assert.match(socialHousingDbSource, /function getAgencyAdById\(id\)[\s\S]*Number\.isSafeInteger\(adId\) \|\| adId <= 0[\s\S]*return null/, 'agency ad lookup should reject invalid row ids');
    assert.match(socialHousingDbSource, /function deleteAgencyAd\(id\)[\s\S]*Number\.isSafeInteger\(adId\) \|\| adId <= 0[\s\S]*return 0[\s\S]*DELETE FROM social_housing_ads WHERE id = \?[\s\S]*changes \|\| 0/, 'agency ad deletes should validate ids and return actual changes');

    assert.match(socialHousingIndex, /const deleted = socialHousingDb\.deleteClass\(req\.params\.id\)[\s\S]*return res\.status\(404\)\.json\(\{ success: false, error: '阶层不存在' \}\)/, 'class delete route should return 404 for missing classes');
    assert.match(socialHousingIndex, /const deleted = socialHousingDb\.deleteHousing\(req\.params\.id\)[\s\S]*return res\.status\(404\)\.json\(\{ success: false, error: '房屋不存在' \}\)/, 'housing delete route should return 404 for missing homes');
    assert.match(socialHousingIndex, /const deleted = socialHousingDb\.deleteAgencyAd\(req\.params\.id\)[\s\S]*return res\.status\(404\)\.json\(\{ success: false, error: '中介广告记录不存在' \}\)[\s\S]*removeAgencyArtifacts\(cityDb, ad\.title, ad\.content\)/, 'agency ad route should remove artifacts only after a real DB delete');

    assert.doesNotMatch(socialHousingIndex, /socialHousingDb\.deleteClass\(req\.params\.id\);\s*res\.json\(\{ success: true/, 'class delete route must not fake success');
    assert.doesNotMatch(socialHousingIndex, /socialHousingDb\.deleteHousing\(req\.params\.id\);\s*const removedAgencyAds/, 'housing delete route must not fake success');
    assert.doesNotMatch(socialHousingIndex, /removeAgencyArtifacts\(cityDb, ad\.title, ad\.content\);\s*socialHousingDb\.deleteAgencyAd/, 'agency artifacts must not be deleted before the ad row delete succeeds');
});

test('social housing room assembly generation waits for uncapped model output', () => {
    const socialHousingIndex = readRepoFile('server', 'plugins', 'socialHousing', 'index.js');
    const housingPanel = readRepoFile('client', 'src', 'plugins', 'socialHousing', 'HousingSocialPanel.jsx');
    const pixelWorldPanel = readPixelWorldSources();

    assert.doesNotMatch(housingPanel, /roomAssemblyAiRequestTimeoutMs|请求超时，已改用规则模板/, 'room assembly should not use a frontend timeout fallback');
    assert.doesNotMatch(housingPanel, /\/api\/social-housing\/agency\/room-assembly'[\s\S]{0,260}timeoutMs:/, 'room assembly endpoint should wait for the backend response');

    assert.doesNotMatch(socialHousingIndex, /ROOM_ASSEMBLY_LLM_TIMEOUT_MS|requestTimeoutMs: ROOM_ASSEMBLY_LLM_TIMEOUT_MS/, 'room assembly backend LLM call should not set a request timeout');
    assert.match(socialHousingIndex, /maxTokens: null[\s\S]*maxAttempts: 1/, 'room assembly LLM call should avoid output token limits');
    assert.match(readRepoFile('server', 'llm.js'), /if \(maxTokens != null\) body\.max_tokens = maxTokens/, 'LLM requests should omit max_tokens when a caller explicitly disables the output cap');
    assert.match(socialHousingIndex, /const constrainPlacement = purchase\.item === 'wallArt'[\s\S]*\{ clamp: constrainPlacement \}/, 'room assembly backend should only clamp wall art coordinates');
    assert.match(socialHousingIndex, /return options\.clamp === false \? num : clampNumber\(rounded, 1, 14\)/, 'room assembly backend should preserve fractional AI coordinates for non-wall-art furniture');
    assert.match(socialHousingIndex, /普通家具渲染时地线会按背景向上校准半格/, 'room assembly prompt should explain the raised visual floor line');
    assert.match(housingPanel, /const roomAssemblySingleInstanceKinds = new Set\(\['wallArt'\]\)/, 'room assembly should only keep wall art as a single-instance constrained kind');
    assert.match(housingPanel, /const roomAssemblyVisualFloorLineOffsetCells = 0\.5/, 'room assembly frontend should raise the visual floor line by half a cell');
    assert.match(housingPanel, /const shouldConstrainGrid = kind === 'wallArt'/, 'room assembly frontend should only constrain wall art grid positions');
    assert.match(housingPanel, /function getRoomAssemblyRawGridCoordinate\(value, fallback = roomAssemblyWallBufferCells\) \{[\s\S]*const num = toNum\(value, fallback\)[\s\S]*return Number\.isFinite\(num\) \? num : fallback/, 'room assembly frontend should preserve fractional AI coordinates for non-wall-art furniture');
    assert.match(housingPanel, /const visualGridY = shouldConstrainGrid \? gridY : gridY - roomAssemblyVisualFloorLineOffsetCells/, 'room assembly frontend should apply the raised floor line to non-wall-art furniture');
    assert.match(housingPanel, /if \(baseItem\.assemblyKind !== 'wallArt'\) \{[\s\S]*items\.push\(baseItem\)[\s\S]*return;[\s\S]*\}/, 'room assembly frontend should accept raw AI placement for non-wall-art furniture');
    assert.doesNotMatch(housingPanel, /\.sort\(\(a, b\) => \(a\.occurrence - b\.occurrence\)/, 'room assembly frontend should preserve AI placement order');

    assert.match(pixelWorldPanel, /const roomEditorCalibratedSizeProfile = \{[\s\S]*desk: \{ w: 430, h: 337[\s\S]*bookshelf: \{ w: 291, h: 444[\s\S]*sofa: \{ w: 526, h: 362/, 'manual room editor should share calibrated default furniture sizes');
    assert.match(pixelWorldPanel, /const calibratedBox = applyRoomEditorCalibratedSizeProfile\(displayBox, realWorldKind\)[\s\S]*box: calibratedBox/, 'manual room editor catalog should use calibrated boxes as defaults');
    assert.match(pixelWorldPanel, /const derivedProfile = \{ \.\.\.baseProfile, \.\.\.roomEditorCalibratedSizeProfile \}/, 'room editor size profile application should prefer calibrated defaults');
    assert.match(pixelWorldPanel, /const size = roomEditorCalibratedSizeProfile\[kind\] \|\| liveProfile\[kind\] \|\| storedProfile\[kind\]/, 'manual room editor add should not let stale stored sizes override calibrated defaults');
    assert.match(pixelWorldPanel, /mappedSideW[\s\S]*calibratedSize[\s\S]*mappedSideW \/ legacyW[\s\S]*calibratedSize\.w[\s\S]*mappedSideH[\s\S]*calibratedSize[\s\S]*mappedSideH \/ legacyH[\s\S]*calibratedSize\.h/, 'directional room assets should derive side sizes from calibrated front-size ratios');
});

test('social housing agency schedule rejects invalid intervals and timestamps', () => {
    const socialHousingIndex = readRepoFile('server', 'plugins', 'socialHousing', 'index.js');
    const socialHousingDbSource = readRepoFile('server', 'plugins', 'socialHousing', 'db.js');
    const inputGuardsSource = readRepoFile('server', 'plugins', 'socialHousing', 'inputGuards.js');
    const guards = require(path.join(repoRoot, 'server', 'plugins', 'socialHousing', 'inputGuards.js'));

    assert.match(inputGuardsSource, /const MAX_SOCIAL_HOUSING_AGENCY_INTERVAL_HOURS = 168/, 'agency schedule interval should be bounded');
    assert.match(inputGuardsSource, /function normalizeAgencyConfigPayload\(payload = \{\}, current = \{\}\)/, 'agency config validation should be centralized');
    assert.match(inputGuardsSource, /function normalizeAgencyIntervalMinutes\(value, fallback = DEFAULT_SOCIAL_HOUSING_AGENCY_INTERVAL_HOURS\)/, 'agency interval minutes should be derived by a shared guard');
    assert.match(inputGuardsSource, /function normalizeStoredAgencyDecisionIntervalHours\(value, fallback = DEFAULT_SOCIAL_HOUSING_AGENCY_INTERVAL_HOURS\)/, 'stored agency interval reads should safely normalize legacy DB values');
    assert.match(inputGuardsSource, /function normalizeTimestamp\(value, label, fallback = 0\)/, 'agency timestamps should be validated centrally');

    assert.match(socialHousingIndex, /const payload = normalizeAgencyConfigPayload\(\{[\s\S]*\.\.\.preserveAgencySecretPatch\(req\.body \|\| \{\}, current\)/, 'agency route should validate request config before DB writes');
    assert.match(socialHousingIndex, /const intervalMinutes = normalizeAgencyIntervalMinutes\(config\.decision_interval_hours\)/, 'agency publish and scheduler paths should share interval normalization');
    assert.doesNotMatch(socialHousingIndex, /Math\.max\(60, Number\(config\.decision_interval_hours \|\| 6\) \* 60\)/, 'agency publish and scheduler paths must not calculate intervals with loose Number fallback');
    assert.match(socialHousingIndex, /sendSocialHousingError\(res, e\)/, 'agency route should return validation errors as 400');

    assert.match(socialHousingDbSource, /const decisionIntervalHours = normalizeStoredAgencyDecisionIntervalHours\(row\.decision_interval_hours\)/, 'agency config reads should normalize stored decision intervals');
    assert.match(socialHousingDbSource, /const intervalMinutes = normalizeStoredAgencyIntervalMinutes\(decisionIntervalHours\)/, 'agency config reads should expose interval minutes from normalized hours');
    assert.match(socialHousingDbSource, /last_ad_at: normalizeStoredAgencyTimestamp\(row\.last_ad_at\)/, 'agency config reads should normalize stored timestamps');
    assert.match(socialHousingDbSource, /const next = normalizeAgencyConfigPayload\(\{[\s\S]*\}, current\)/, 'agency DB writes should keep a defensive validation layer');
    assert.match(socialHousingDbSource, /next\.ad_min_interval_minutes,[\s\S]*next\.ad_max_interval_minutes/, 'agency DB writes should store normalized interval minutes');
    assert.match(socialHousingDbSource, /next\.decision_interval_hours/, 'agency DB writes should store normalized interval hours');
    assert.doesNotMatch(socialHousingDbSource, /Math\.max\(1, Number\(next\.decision_interval_hours \|\| 6\)\)/, 'agency DB writes must not persist raw or infinite decision intervals');
    assert.doesNotMatch(socialHousingDbSource, /decision_interval_hours: Math\.max\(1, Number\(row\.decision_interval_hours \|\| 6\)\)/, 'agency DB reads must not expose loose or infinite decision intervals');

    assert.throws(
        () => guards.normalizeAgencyConfigPayload({ decision_interval_hours: 0 }),
        /中介调度间隔无效/,
        'zero agency interval should be rejected'
    );
    assert.throws(
        () => guards.normalizeAgencyConfigPayload({ decision_interval_hours: 169 }),
        /中介调度间隔无效/,
        'overlarge agency interval should be rejected'
    );
    assert.throws(
        () => guards.normalizeAgencyConfigPayload({ next_ad_at: -1 }),
        /下次广告时间无效/,
        'negative next ad timestamps should be rejected'
    );
    const normalized = guards.normalizeAgencyConfigPayload({ decision_interval_hours: 6.5, next_ad_at: 10.9 });
    assert.equal(normalized.ad_min_interval_minutes, 390);
    assert.equal(normalized.ad_max_interval_minutes, 390);
    assert.equal(normalized.next_ad_at, 10);
    assert.equal(guards.normalizeAgencyIntervalMinutes(6.5), 390);
    assert.throws(
        () => guards.normalizeAgencyIntervalMinutes(Infinity),
        /中介调度间隔无效/,
        'non-finite agency interval calculations should fail before scheduling'
    );
    assert.equal(guards.normalizeStoredAgencyDecisionIntervalHours(Infinity), 6);
    assert.equal(guards.normalizeStoredAgencyIntervalMinutes('bad'), 360);
    assert.equal(guards.normalizeStoredAgencyTimestamp(Infinity), 0);
});

test('runtime source does not contain common mojibake markers', () => {
    const roots = [
        path.join(repoRoot, 'client', 'src'),
        path.join(repoRoot, 'server'),
        path.join(repoRoot, 'scripts')
    ];
    const ignoredParts = [
        `${path.sep}node_modules${path.sep}`,
        `${path.sep}.runtime${path.sep}`,
        `${path.sep}client${path.sep}dist${path.sep}`,
        `${path.sep}server${path.sep}public${path.sep}assets${path.sep}`,
        `${path.sep}server${path.sep}_archive_tools${path.sep}`,
        `${path.sep}server${path.sep}test${path.sep}`
    ];
    const mojibakePattern = /馃|鈿|鈥|鈹|锛|锟|�|Ã|Â|鈫|扐|涓|绯|鐢|妯|姝|鏃|閿/;
    const offenders = [];
    const shouldSkipDir = (dir) => ignoredParts.some((part) => `${dir}${path.sep}`.includes(part));

    for (const root of roots) {
        for (const filePath of walkFiles(root, (candidate) => /\.(js|jsx|md|css|json)$/.test(candidate), shouldSkipDir)) {
            if (ignoredParts.some((part) => filePath.includes(part))) continue;
            const text = fs.readFileSync(filePath, 'utf8');
            if (mojibakePattern.test(text)) {
                offenders.push(path.relative(repoRoot, filePath));
            }
        }
    }

    assert.deepEqual(offenders, [], 'runtime source should not contain common mojibake markers');
});
