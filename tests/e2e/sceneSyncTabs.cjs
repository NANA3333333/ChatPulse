const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// Served only by the E2E Vite server; the application never imports this fixture.
function sceneSyncHarnessPlugin(root) {
    const id = path.join(root, 'client/src/__sceneSyncHarness__.jsx').replaceAll('\\', '/');
    return {
        name: 'scene-sync-regression-fixture', enforce: 'pre',
        resolveId(value) { if (value === '/__sceneSyncHarness__.jsx') return id; },
        load(value) { if (value === id) return fs.readFileSync(path.join(__dirname, 'fixtures/sceneSyncHarness.jsx'), 'utf8'); },
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url !== '/__scene-sync-test') return next();
                try {
                    const html = await server.transformIndexHtml(req.url, '<!doctype html><div id="root"></div><script type="module" src="/__sceneSyncHarness__.jsx"></script>');
                    res.setHeader('Content-Type', 'text/html');
                    res.end(html);
                } catch (error) { next(error); }
            });
        },
    };
}

async function verifySceneSyncTabs(browser, baseUrl) {
    const context = await browser.newContext();
    let release;
    try {
        const a = await context.newPage(), b = await context.newPage();
        const errors = [];
        for (const page of [a, b]) page.on('pageerror', error => errors.push(error.message));
        let remote = { revision: 1, tree: { tree_id: 'audit-tree', version: 1, nodes: {} } };
        let posted;
        const postStarted = new Promise(resolve => { posted = resolve; });
        const gate = new Promise(resolve => { release = resolve; });
        const endpoint = '**/api/city/behavior-tree-state/test-tabs';
        await a.route(endpoint, async route => {
            if (route.request().method() === 'POST') {
                posted(); await gate;
                remote = { revision: 2, tree: route.request().postDataJSON().tree };
            }
            await route.fulfill({ json: remote });
        });
        await b.route(endpoint, route => route.request().method() === 'POST'
            ? route.fulfill({ status: 503, json: { error: 'offline fixture' } }) : route.fulfill({ json: remote }));
        for (const page of [a, b]) {
            await page.goto(baseUrl + '/__scene-sync-test');
            await page.waitForSelector('[data-status="synced"]');
        }
        await a.evaluate(() => { window.saving = window.sceneSyncTest.save({ tree_id: 'audit-tree', version: 2, nodes: {}, marker: 'A' }); });
        await postStarted;
        await b.evaluate(() => window.sceneSyncTest.save({ tree_id: 'audit-tree', version: 3, nodes: {}, marker: 'B' }));
        await b.waitForSelector('[data-status="error"]');
        release(); await a.evaluate(() => window.saving);
        assert.equal(await b.evaluate(() => window.sceneSyncTest.state().pending.tree.marker), 'B');
        await b.reload(); await b.waitForSelector('[data-status="error"]');
        const restored = await b.evaluate(() => window.sceneSyncTest.state());
        assert.equal(restored.tree.marker, 'B');
        assert.equal(restored.pending.tree.marker, 'B');
        // A stale retry still obeys the server revision instead of replacing A silently.
        await b.unroute(endpoint);
        await b.route(endpoint, route => route.request().method() === 'POST'
            ? route.fulfill({ status: 409, json: { error: 'revision conflict' } }) : route.fulfill({ json: remote }));
        await b.evaluate(() => window.sceneSyncTest.retry());
        await b.waitForSelector('[data-status="conflict"]');
        assert.equal(await b.evaluate(() => window.sceneSyncTest.state().pending.tree.marker), 'B');
        // Browser tab duplication copies session storage initially, then separates it.
        const sessionCopy = await b.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
        const copy = await context.newPage();
        copy.on('pageerror', error => errors.push(error.message));
        await copy.addInitScript(entries => { for (const [key, value] of Object.entries(entries)) sessionStorage.setItem(key, value); }, sessionCopy);
        await copy.route(endpoint, route => route.fulfill({ json: remote }));
        await copy.goto(baseUrl + '/__scene-sync-test');
        await copy.waitForSelector('[data-status="error"]');
        await copy.evaluate(() => window.sceneSyncTest.reloadServer());
        await copy.waitForSelector('[data-status="synced"]');
        await b.reload();
        await b.waitForSelector('[data-status="error"]');
        assert.equal(await b.evaluate(() => window.sceneSyncTest.state().tree.marker), 'B');
        assert.equal(await b.evaluate(() => window.sceneSyncTest.state().pending.tree.marker), 'B');
        assert.deepEqual(errors, []);
        console.log('PASS scene tabs: independent recovery, page reload, stale-revision conflict and duplicate-tab discard');
    } finally { release?.(); await context.close(); }
}

module.exports = { sceneSyncHarnessPlugin, verifySceneSyncTabs };
