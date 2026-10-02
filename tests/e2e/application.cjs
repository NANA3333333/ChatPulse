const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const clientRequire = createRequire(path.resolve(__dirname, '../../client/package.json'));
const { chromium } = clientRequire('playwright');
const { verifySceneSync } = require('./sceneSync.cjs');
const { verifyScenePlayer } = require('./scenePlayer.cjs');
const { verifyStreetParallax } = require('./streetParallax.cjs');
const { verifyStreetPerformance } = require('./streetPerformance.cjs');
const { verifyStreetLayers } = require('./streetLayers.cjs');
const { verifySceneKeyboard } = require('./sceneKeyboard.cjs');
const { verifySceneSyncRecovery } = require('./sceneSyncRecovery.cjs');
const { verifySceneSyncTabs } = require('./sceneSyncTabs.cjs');
const { verifyDesktopWindows, verifyHousingComponents, verifySceneEditing } = require('./remainingComponents.cjs');

async function verifyApplication(baseUrl, { labsEnabled = true, sceneOnly = false, streetPerformance = false } = {}) {
    const login = await fetch(baseUrl + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Nana', password: 'E2E-fixture-password-428' })
    }).then(response => response.json());
    assert.ok(login.token, 'Fixture login must succeed');
    const created = await fetch(baseUrl + '/api/characters', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
        body: JSON.stringify({ id: 'e2e-character', name: '结构测试角色', sys_proactive: 0, sys_timer: 0 })
    });
    assert.equal(created.status, 200);
    const browser = await chromium.launch({ headless: true });
    const pages = [
        ['社交', '结构测试角色'], ['记忆库', 'MEMORY LIBRARY'], ['设置', '角色配置工作台'],
        ['住房系统', '租房链路'], ['商业街日志', '实时账本'],
        ['商业街', '控制角色'], ['像素小屋', '控制角色'],
        ...(labsEnabled ? [['MCP 实验室', '联网研究控制台']] : [])
    ];
    try {
        for (const [name, marker] of pages.filter(([name]) => streetPerformance ? name === '商业街' : !sceneOnly || ['商业街', '像素小屋'].includes(name))) {
            const page = await browser.newPage({ viewport: { width: 1360, height: 920 } });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => {
                if (message.type() === 'error' && /ReferenceError|TypeError|Maximum update depth|ErrorBoundary/.test(message.text())) errors.push(message.text());
            });
            await page.addInitScript(data => {
                localStorage.setItem('cp_token', data.token);
                localStorage.setItem('cp_user', JSON.stringify(data.user));
            }, login);
            await page.goto(baseUrl);
            if (name === '社交' && labsEnabled) await verifyDesktopWindows(page);
            if (!labsEnabled) {
                await page.getByRole('button', { name: '社交', exact: true }).first().waitFor();
                for (const hidden of ['MCP 实验室']) {
                    assert.equal(await page.getByRole('button', { name: hidden, exact: true }).count(), 0, hidden);
                }
            }
            await page.getByRole('button', { name, exact: true }).first().dblclick();
            await page.getByText(marker, { exact: true }).first().waitFor({ timeout: streetPerformance ? 60000 : sceneOnly ? 30000 : 15000 });
            if (name === '社交') {
                await page.getByText('结构测试角色', { exact: true }).first().click();
                await page.locator('.chat-header').first().waitFor({ timeout: 10000 });
            }
            if (streetPerformance) {
                await verifyStreetPerformance(page);
            } else if (name === '商业街' || name === '像素小屋') {
                await verifyScenePlayer(page, baseUrl, login.token, name, { labsEnabled });
                await verifySceneSync(page, baseUrl, login.token, name);
                if (labsEnabled) await verifySceneEditing(page, name);
                if (name === '商业街') {
                    await verifyStreetParallax(page, { checkLoopSeam: labsEnabled });
                    if (labsEnabled) await verifyStreetLayers(page);
                }
            }
            if (name === '住房系统') await verifyHousingComponents(page, { labsEnabled });
            assert.deepEqual(errors, [], name);
            await page.close();
            console.log(`PASS application: ${name}${labsEnabled ? '' : ' (labs disabled)'}`);
        }
        if (labsEnabled && !streetPerformance) {
            await verifySceneKeyboard(browser, baseUrl, login);
            await verifySceneSyncRecovery(browser, baseUrl, login);
            await verifySceneSyncTabs(browser, baseUrl);
        }
    } finally { await browser.close(); }
}

module.exports = { verifyApplication };
