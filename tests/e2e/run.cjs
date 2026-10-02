const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');
const { verifyApplication } = require('./application.cjs');
const { verifyCoreFlows } = require('./coreFlows.cjs');
const { sceneSyncHarnessPlugin } = require('./sceneSyncTabs.cjs');
const root = path.resolve(__dirname, '../..');
const clientRequire = createRequire(path.join(root, 'client/package.json'));

function runScript(file, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [file], { cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, ...env } });
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${file} exited with ${code}`)));
    });
}

async function closeFrontend(frontend) {
    if (!frontend) return;
    if (typeof frontend.close === 'function') await frontend.close();
    else if (frontend.httpServer) await new Promise((resolve, reject) => frontend.httpServer.close((error) => error ? reject(error) : resolve()));
}

(async () => {
    const fixture = spawn(process.execPath, [path.join(__dirname, 'fixture.cjs')], {
        cwd: root, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
    });
    fixture.stderr.on('data', chunk => process.stderr.write(chunk));
    let vite, fixtureInfo;
    try {
        fixtureInfo = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Fixture startup timed out')), ['scenes', 'street-performance', 'street-performance-preview'].includes(process.env.CHATPULSE_E2E_SUITE) ? 60000 : 20000);
            fixture.once('message', info => { clearTimeout(timeout); resolve(info); });
            fixture.once('error', error => { clearTimeout(timeout); reject(error); });
            fixture.once('exit', code => { clearTimeout(timeout); reject(new Error(`Fixture exited with ${code}`)); });
        });
        const { createServer, preview } = await import(pathToFileURL(clientRequire.resolve('vite')).href);
        const coreOnly = process.env.CHATPULSE_E2E_SUITE === 'core';
        const groupOnly = process.env.CHATPULSE_E2E_SUITE === 'group';
        const componentsOnly = process.env.CHATPULSE_E2E_SUITE === 'components';
        const sceneOnly = process.env.CHATPULSE_E2E_SUITE === 'scenes';
        const streetPerformance = process.env.CHATPULSE_E2E_SUITE?.startsWith('street-performance');
        const performancePreview = process.env.CHATPULSE_E2E_SUITE === 'street-performance-preview';
        const uiOnly = componentsOnly || sceneOnly || streetPerformance;
        const focused = coreOnly || groupOnly || streetPerformance;
        for (const labsEnabled of focused ? [true] : [true, false]) {
            if (!labsEnabled) {
                fixtureInfo = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Disabled-labs fixture startup timed out')), 20000);
                    fixture.once('message', info => { clearTimeout(timeout); resolve(info); });
                    fixture.send('disable-labs');
                });
            }
            const proxy = Object.fromEntries(['/api', '/uploads', '/ws'].map(prefix => [prefix, { target: fixtureInfo.baseUrl, ws: prefix === '/ws', changeOrigin: true }]));
            if (performancePreview) {
                if (!process.env.CHATPULSE_E2E_BUILD_DIR) throw new Error('CHATPULSE_E2E_BUILD_DIR is required for preview benchmark');
                vite = await preview({
                    root: path.join(root, 'client'), logLevel: 'error',
                    build: { outDir: path.resolve(process.env.CHATPULSE_E2E_BUILD_DIR) },
                    preview: { host: '127.0.0.1', port: 0, proxy },
                });
            } else {
                vite = await createServer({
                    root: path.join(root, 'client'), logLevel: 'error',
                    plugins: [sceneSyncHarnessPlugin(root), ...(labsEnabled ? [] : [{ name: 'fixture-disable-labs', enforce: 'pre', load(id) {
                        if (!id.replaceAll('\\', '/').endsWith('/config/feature-manifest.json')) return null;
                        return JSON.stringify({ labs: { mcp: { enabled: false }, 'scene-editor': { enabled: false } } });
                    } }])],
                    server: { host: '127.0.0.1', port: 0, proxy }
                });
                await vite.listen();
            }
            const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
            if (!focused || streetPerformance) await verifyApplication(url, { labsEnabled, sceneOnly, streetPerformance });
            if (labsEnabled && !focused && !uiOnly) {
                for (const name of ['privateReplyReroll', 'privateMessages', 'contextWindow']) {
                    await runScript(`client/src/features/private-chat/tests/${name}.e2e.cjs`, { PRIVATE_CHAT_TEST_URL: url, REROLL_TEST_URL: url });
                }
            }
            if (labsEnabled && !coreOnly && !uiOnly) await runScript('client/src/features/group-chat/tests/groupMessages.e2e.cjs', { PRIVATE_CHAT_TEST_URL: url });
            if (labsEnabled && !groupOnly && !uiOnly) await verifyCoreFlows(url);
            await closeFrontend(vite);
            vite = null;
        }
    } finally {
        if (vite) await closeFrontend(vite);
        if (fixture.exitCode === null) {
            const exited = once(fixture, 'exit');
            if (fixture.connected) fixture.send('close'); else fixture.kill();
            const force = setTimeout(() => fixture.kill(), 5000);
            await exited;
            clearTimeout(force);
        }
        if (fixtureInfo) {
            const target = path.resolve(fixtureInfo.dataDir);
            if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('chatpulse-e2e-')) throw new Error('Unexpected fixture cleanup path');
            fs.rmSync(target, { recursive: true, force: true });
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
