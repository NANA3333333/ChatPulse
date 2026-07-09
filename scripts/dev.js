const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;

function fileExists(filePath) {
  try {
    return require('fs').existsSync(filePath);
  } catch (e) {
    return false;
  }
}

function getBundledNode() {
  const candidate = isWindows
    ? path.join(root, '.runtime', 'node20', 'node.exe')
    : path.join(root, '.runtime', 'node20', 'bin', 'node');
  return fileExists(candidate) ? candidate : '';
}

function quoteWindowsArg(value) {
  const text = String(value ?? '');
  if (!text || /\s|"/.test(text)) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

function startProcess(name, command, args, cwd, options = {}) {
  const useShell = options.shell ?? (isWindows && String(command).toLowerCase().endsWith('.cmd'));
  const spawnTarget = isWindows && useShell
    ? [ `${quoteWindowsArg(command)} ${args.map(quoteWindowsArg).join(' ')}`, [] ]
    : [ command, args ];

  const child = spawn(spawnTarget[0], spawnTarget[1], {
    cwd,
    stdio: 'inherit',
    // On Windows, npm is a .cmd wrapper and should be spawned via a shell.
    shell: useShell,
    windowsHide: true,
    env: { ...process.env, ...(options.env || {}) }
  });

  child.on('error', (error) => {
    console.error(`[dev] failed to start ${name}: ${error.message}`);
  });

  child.on('exit', (code) => {
    if (shuttingDown) return;
    if (options.required) {
      console.error(`[dev] required process ${name} exited${code ? ` with code ${code}` : ''}`);
      shutdown(code || 1);
      return;
    }
    if (code && code !== 0) {
      console.error(`[dev] ${name} exited with code ${code}`);
    }
  });

  children.push(child);
  return child;
}

function startNodeProcess(name, args, cwd, env = {}) {
  const bundledNode = getBundledNode();
  if (!bundledNode) return false;

  console.log(`[dev] starting ${name} with bundled Node: ${bundledNode}`);
  startProcess(name, bundledNode, args, cwd, { shell: false, env, required: name === 'server' });
  return true;
}

function shutdown(exitCode = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(exitCode);
}

function normalizeEnvValue(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadServerQdrantEnv() {
  const envPath = path.join(root, 'server', '.env');
  if (!fileExists(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(QDRANT_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) {
      process.env[key] = normalizeEnvValue(value);
    }
  }
}

function isDisabled(value) {
  return /^(0|false|no|off)$/i.test(String(value || '').trim());
}

function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const client = url.startsWith('https:') ? https : http;
  return new Promise((resolve) => {
    const attempt = () => {
      const req = client.get(url, { timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          resolve(false);
          return;
        }
        setTimeout(attempt, 500);
      });
      req.on('timeout', () => req.destroy());
      req.on('error', () => {
        if (Date.now() >= deadline) {
          resolve(false);
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function isLocalQdrantUrl(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(url);
}

async function startQdrantIfNeeded() {
  loadServerQdrantEnv();
  if (isDisabled(process.env.QDRANT_ENABLED)) {
    console.log('[dev] Qdrant disabled by QDRANT_ENABLED=0; server will use vectra fallback.');
    return { enabled: false, env: { QDRANT_ENABLED: '0' } };
  }

  const qdrantUrl = String(process.env.QDRANT_URL || 'http://127.0.0.1:6333').replace(/\/+$/, '');
  if (await waitForHttp(`${qdrantUrl}/collections`, 1500)) {
    console.log(`[dev] Qdrant already reachable at ${qdrantUrl}`);
    return { enabled: true, env: { QDRANT_ENABLED: '1', QDRANT_URL: qdrantUrl } };
  }

  const localQdrantExe = isWindows
    ? path.join(root, 'tools', 'qdrant', 'current', 'qdrant.exe')
    : path.join(root, 'tools', 'qdrant', 'current', 'qdrant');
  const localQdrantConfig = path.join(root, 'config', 'qdrant.yaml');
  if (isLocalQdrantUrl(qdrantUrl) && fileExists(localQdrantExe)) {
    const args = fileExists(localQdrantConfig) ? ['--config-path', localQdrantConfig] : [];
    console.log(`[dev] starting Qdrant at ${qdrantUrl}`);
    startProcess('qdrant', localQdrantExe, args, root, { shell: false, required: true });
    if (await waitForHttp(`${qdrantUrl}/collections`, 20000)) {
      return { enabled: true, env: { QDRANT_ENABLED: '1', QDRANT_URL: qdrantUrl } };
    }
    console.error(`[dev] Qdrant did not become reachable at ${qdrantUrl}; aborting startup.`);
    shutdown(1);
  }

  console.error(`[dev] QDRANT_ENABLED=1 but Qdrant is not reachable at ${qdrantUrl}; aborting startup.`);
  console.error('[dev] Set QDRANT_ENABLED=0 only if you intentionally want vectra fallback.');
  shutdown(1);
}

async function main() {
  const qdrantState = await startQdrantIfNeeded();
  const serverEnv = qdrantState.env || {};
  if (!startNodeProcess('server', ['index.js'], path.join(root, 'server'), serverEnv)) {
    startProcess('server', npmCmd, ['run', 'start'], path.join(root, 'server'), { env: serverEnv, required: true });
  }

  const viteEntry = path.join(root, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
  if (!startNodeProcess('client', [viteEntry, '--host', '127.0.0.1', '--port', '5173'], path.join(root, 'client'))) {
    startProcess('client', npmCmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], path.join(root, 'client'));
  }
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
  console.error(`[dev] startup failed: ${error.message}`);
  shutdown(1);
});
