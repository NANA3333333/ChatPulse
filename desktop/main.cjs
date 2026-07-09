const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { prepareDesktopUserData } = require('./dataMigration.cjs');

const isWindows = process.platform === 'win32';
const isDev = !app.isPackaged;
const configuredUserDataDir = String(process.env.CHATPULSE_DESKTOP_USER_DATA_DIR || '').trim();
if (configuredUserDataDir) {
    app.setPath('userData', path.resolve(configuredUserDataDir));
}
const desktopFullscreen = !/^(0|false|no|off)$/i.test(String(process.env.CHATPULSE_DESKTOP_FULLSCREEN || '1'));
const qdrantExplicitlyDisabled = /^(0|false|no|off)$/i.test(String(process.env.QDRANT_ENABLED || ''));

let mainWindow = null;
let serverProcess = null;
let qdrantProcess = null;
let isQuitting = false;

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function appRoot() {
    return isDev ? path.resolve(__dirname, '..') : process.resourcesPath;
}

function appPath(...segments) {
    return path.join(appRoot(), ...segments);
}

function desktopPath(...segments) {
    return path.join(__dirname, ...segments);
}

function userDataPath(...segments) {
    return path.join(app.getPath('userData'), ...segments);
}

function logPath(name) {
    return path.join(ensureDir(userDataPath('logs')), name);
}

function findExistingPath(...candidates) {
    return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function spawnVisibleDetached(command, args = [], options = {}) {
    const child = spawn(command, args, {
        cwd: options.cwd || appRoot(),
        detached: true,
        stdio: 'ignore',
        windowsHide: false
    });
    child.unref();
    return child;
}

function escapePowerShellLiteral(value) {
    return String(value || '').replace(/'/g, "''");
}

function openTerminalAtAppRoot() {
    if (!isWindows) {
        return { ok: false, message: 'Open in Terminal is currently implemented for Windows desktop builds.' };
    }

    const powershellExe = findExistingPath(
        process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : '',
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    );
    if (!powershellExe) {
        return { ok: false, message: 'PowerShell was not found on this system.' };
    }

    spawnVisibleDetached(
        powershellExe,
        ['-NoExit', '-Command', `Set-Location -LiteralPath '${escapePowerShellLiteral(appRoot())}'`],
        { cwd: appRoot() }
    );
    return { ok: true, message: 'Terminal opened at the ChatPulse folder.' };
}

function findTortoiseProc() {
    return findExistingPath(
        process.env.TORTOISESVN_PROC,
        process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'TortoiseSVN', 'bin', 'TortoiseProc.exe') : '',
        process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'TortoiseSVN', 'bin', 'TortoiseProc.exe') : ''
    );
}

function runTortoiseSvn(command) {
    if (!isWindows) {
        return { ok: false, message: 'TortoiseSVN actions are available in Windows desktop builds.' };
    }
    const tortoiseProc = findTortoiseProc();
    if (!tortoiseProc) {
        return { ok: false, message: 'TortoiseSVN was not found. Install TortoiseSVN to use this submenu.' };
    }

    const allowedCommands = new Set(['update', 'log', 'repobrowser', 'checkmodifications']);
    const normalizedCommand = allowedCommands.has(command) ? command : 'log';
    spawnVisibleDetached(
        tortoiseProc,
        [`/command:${normalizedCommand}`, `/path:${appRoot()}`],
        { cwd: appRoot() }
    );
    return { ok: true, message: `TortoiseSVN ${normalizedCommand} opened.` };
}

async function handleSystemAction(action, payload = {}) {
    try {
        if (action === 'open-terminal') {
            return openTerminalAtAppRoot();
        }
        if (action === 'tortoise-svn') {
            return runTortoiseSvn(String(payload.command || 'log'));
        }
        return { ok: false, message: `Unknown system action: ${action}` };
    } catch (error) {
        return { ok: false, message: String(error?.message || error) };
    }
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            server.close(() => resolve(address.port));
        });
    });
}

function waitForHttp(url, timeoutMs = 45000) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
        const tick = () => {
            const req = http.get(url, (res) => {
                res.resume();
                if (res.statusCode >= 200 && res.statusCode < 500) {
                    resolve(true);
                    return;
                }
                retry();
            });
            req.setTimeout(1800, () => {
                req.destroy();
                retry();
            });
            req.on('error', retry);
        };
        const retry = () => {
            if (Date.now() - startedAt >= timeoutMs) {
                resolve(false);
                return;
            }
            setTimeout(tick, 500);
        };
        tick();
    });
}

function resolveNodeRunner() {
    const bundledNode = findExistingPath(
        isWindows ? appPath('.runtime', 'node20', 'node.exe') : appPath('.runtime', 'node20', 'bin', 'node'),
        isWindows ? appPath('runtime', 'node20', 'node.exe') : appPath('runtime', 'node20', 'bin', 'node')
    );
    if (bundledNode) {
        return { command: bundledNode, env: {} };
    }
    if (isDev) {
        return { command: isWindows ? 'node.exe' : 'node', env: {} };
    }
    return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } };
}

function pipeChildLogs(child, basename) {
    const out = fs.createWriteStream(logPath(`${basename}.out.log`), { flags: 'a' });
    const err = fs.createWriteStream(logPath(`${basename}.err.log`), { flags: 'a' });
    child.stdout?.pipe(out);
    child.stderr?.pipe(err);
}

function stopChild(child) {
    if (!child || child.killed) return;
    try {
        child.kill();
    } catch (_) {
        // Process may already be gone.
    }
}

async function startQdrant() {
    if (qdrantExplicitlyDisabled) {
        return { enabled: false, url: '', reason: 'disabled by QDRANT_ENABLED=0' };
    }

    const qdrantExe = findExistingPath(
        process.env.CHATPULSE_QDRANT_EXE,
        isWindows ? appPath('tools', 'qdrant', 'current', 'qdrant.exe') : appPath('tools', 'qdrant', 'current', 'qdrant')
    );
    if (!qdrantExe) {
        throw new Error('QDRANT_ENABLED=1 but the Qdrant binary was not found. Start Qdrant first, or set QDRANT_ENABLED=0 only when vectra fallback is intentional.');
    }

    const httpPort = await getFreePort();
    const grpcPort = await getFreePort();
    const qdrantDir = ensureDir(userDataPath('qdrant'));
    const storageDir = ensureDir(path.join(qdrantDir, 'storage'));
    const snapshotsDir = ensureDir(path.join(qdrantDir, 'snapshots'));
    const configPath = path.join(qdrantDir, 'qdrant-desktop.yaml');
    const toYamlPath = (value) => value.replace(/\\/g, '/');
    fs.writeFileSync(configPath, [
        'log_level: INFO',
        '',
        'storage:',
        `  storage_path: ${toYamlPath(storageDir)}`,
        `  snapshots_path: ${toYamlPath(snapshotsDir)}`,
        '',
        'service:',
        '  host: 127.0.0.1',
        `  http_port: ${httpPort}`,
        `  grpc_port: ${grpcPort}`,
        ''
    ].join('\n'));

    qdrantProcess = spawn(qdrantExe, ['--config-path', configPath], {
        cwd: appRoot(),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    pipeChildLogs(qdrantProcess, 'qdrant');

    const url = `http://127.0.0.1:${httpPort}`;
    const ready = await waitForHttp(`${url}/collections`, 20000);
    if (!ready) {
        stopChild(qdrantProcess);
        qdrantProcess = null;
        throw new Error(`QDRANT_ENABLED=1 but Qdrant did not become reachable at ${url}. Set QDRANT_ENABLED=0 only when vectra fallback is intentional.`);
    }
    return { enabled: true, url };
}

async function startServer(qdrantState) {
    const port = await getFreePort();
    const desktopSessionToken = crypto.randomBytes(32).toString('base64url');
    const serverEntry = appPath('server', 'index.js');
    const clientDist = appPath('client', 'dist');
    const runner = resolveNodeRunner();
    const env = {
        ...process.env,
        ...runner.env,
        PORT: String(port),
        CP_PUBLIC_MODE: '0',
        CP_DESKTOP_MODE: '1',
        CP_DESKTOP_USERNAME: process.env.CP_DESKTOP_USERNAME || 'Nana',
        CP_DESKTOP_SESSION_TOKEN: desktopSessionToken,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || process.env.CP_DESKTOP_ADMIN_PASSWORD || 'ChatPulseLocalOnly!2026',
        CHATPULSE_DATA_DIR: ensureDir(userDataPath('data')),
        CHATPULSE_UPLOADS_DIR: ensureDir(userDataPath('uploads')),
        CHATPULSE_CLIENT_DIST_DIR: clientDist,
        QDRANT_ENABLED: qdrantState.enabled ? '1' : '0',
        QDRANT_URL: qdrantState.enabled ? qdrantState.url : ''
    };

    serverProcess = spawn(runner.command, [serverEntry], {
        cwd: appPath('server'),
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    pipeChildLogs(serverProcess, 'server');

    const baseUrl = `http://127.0.0.1:${port}`;
    const ready = await waitForHttp(baseUrl, 120000);
    if (!ready) {
        throw new Error(`Backend failed to start. See logs in ${logPath('server.err.log')}`);
    }
    return { baseUrl, desktopSessionToken };
}

function createWindow(baseUrl, desktopSessionToken) {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1100,
        minHeight: 720,
        fullscreen: desktopFullscreen,
        fullscreenable: true,
        show: false,
        backgroundColor: '#edf4ff',
        title: 'ChatPulse',
        autoHideMenuBar: true,
        icon: desktopPath('assets', 'chatpulse.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (desktopFullscreen) {
            mainWindow.setFullScreen(true);
        }
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown') return;
        if (input.key === 'F11') {
            event.preventDefault();
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
        if (input.key === 'Escape' && mainWindow.isFullScreen()) {
            event.preventDefault();
            mainWindow.setFullScreen(false);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.loadURL(`${baseUrl}/#cp_desktop_token=${encodeURIComponent(desktopSessionToken)}`);
}

async function boot() {
    try {
        const importState = prepareDesktopUserData({
            userDataDir: app.getPath('userData'),
            appRoot: appRoot(),
            resourcesPath: process.resourcesPath,
            documentsPath: app.getPath('documents'),
            isDev,
            env: process.env,
            logger: console
        });
        if (importState.imported) {
            console.log(`[Desktop Import] Ready: ${JSON.stringify(importState.copied)}`);
        } else {
            console.log(`[Desktop Import] Skipped: ${importState.reason || 'not needed'}`);
        }
        ensureDir(userDataPath('data'));
        ensureDir(userDataPath('uploads'));
        const qdrantState = await startQdrant();
        const serverState = await startServer(qdrantState);
        createWindow(serverState.baseUrl, serverState.desktopSessionToken);
    } catch (error) {
        dialog.showErrorBox('ChatPulse failed to start', String(error?.message || error));
        app.quit();
    }
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
    app.quit();
} else {
    ipcMain.handle('chatpulse:system-action', (_event, request = {}) => (
        handleSystemAction(String(request.action || ''), request.payload || {})
    ));

    app.on('second-instance', () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });

    app.whenReady().then(boot);
}

app.on('before-quit', () => {
    isQuitting = true;
    stopChild(serverProcess);
    stopChild(qdrantProcess);
});

app.on('window-all-closed', () => {
    if (isQuitting) return;
    app.quit();
});
