const assert = require('node:assert/strict');

async function verifySceneKeyboard(browser, baseUrl, login) {
    const page = await browser.newPage({ viewport: { width: 1360, height: 920 } });
    try {
        await page.addInitScript((data) => {
            localStorage.setItem('cp_token', data.token);
            localStorage.setItem('cp_user', JSON.stringify(data.user));
        }, login);
        // No AI actors: changes in position must come from the tested keyboard input.
        await page.route('**/api/city/characters', (route) =>
            route.fulfill({ contentType: 'application/json', body: '[]' }),
        );
        await page.goto(baseUrl);
        await page.getByRole('button', { name: '像素小屋', exact: true }).first().dblclick();
        await page.locator('.right-column .room-editor .scene-player-toolbar').waitFor();
        await page.getByRole('button', { name: '商业街', exact: true }).first().dblclick();
        const active = page.locator('.right-column .pixel-world-editor');
        await active.locator('.scene-player-toolbar').waitFor();
        const snapshots = () =>
            page.locator('.pixel-world-editor').evaluateAll((nodes) =>
                nodes.map((node) => ({
                    active: Boolean(node.closest('.right-column')),
                    position: node.querySelector('.pixel-world-player.controlled')?.style.transform,
                })),
            );
        await page.waitForTimeout(350);
        await page.getByRole('button', { name: '社交', exact: true }).first().focus();
        const desktopBefore = await snapshots();
        await page.keyboard.down('d');
        await page.waitForTimeout(180);
        await page.keyboard.up('d');
        assert.deepEqual(await snapshots(), desktopBefore, 'Desktop focus must not move any mounted scene');

        await active.locator('.pixel-world-editor-canvas-wrap').focus();
        const before = await snapshots();
        assert.ok(
            before.some((item) => !item.active),
            'Regression includes background scenes',
        );
        await page.keyboard.down('d');
        await page.waitForTimeout(180);
        await page.keyboard.up('d');
        const after = await snapshots();
        assert.notDeepEqual(
            after.filter((item) => item.active),
            before.filter((item) => item.active),
            'Focused scene still moves',
        );
        assert.deepEqual(
            after.filter((item) => !item.active),
            before.filter((item) => !item.active),
            'Background scenes ignore foreground movement',
        );

        await page.keyboard.down('d');
        await page.waitForTimeout(120);
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        const blurred = await snapshots();
        await page.waitForTimeout(180);
        assert.deepEqual(await snapshots(), blurred, 'Window blur clears held movement keys');
        await page.keyboard.up('d');
        console.log('PASS scene keyboard: desktop focus, foreground-only movement and held-key blur');
    } finally {
        await page.close();
    }
}

module.exports = { verifySceneKeyboard };
