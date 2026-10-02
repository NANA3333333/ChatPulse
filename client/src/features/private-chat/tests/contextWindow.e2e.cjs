const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
        const errors = [];
        const saves = [];
        let character = { id: 'zero-test', name: 'Zero Window Test', status: 'active', context_msg_limit: 60, explicit_emotion_state: 'playful' };
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        await page.route('**/api/**', route => {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (request.method() !== 'GET') {
                const patch = request.postDataJSON();
                if ('context_msg_limit' in patch) { character = { ...character, ...patch }; saves.push(patch.context_msg_limit); }
                return route.fulfill({ json: { success: true, character } });
            }
            if (pathname === '/api/characters') return route.fulfill({ json: [character] });
            if (pathname.endsWith('/relationships')) return route.fulfill({ json: [] });
            if (pathname === '/api/user') return route.fulfill({ json: { name: 'Test User' } });
            return route.fulfill({ json: { success: true, stats: {}, logs: [], schedule: [], sessions: [] } });
        });
        const base = process.env.PRIVATE_CHAT_TEST_URL || 'http://127.0.0.1:5173';
        const url = `${base}/src/features/private-chat/tests/contextWindow.html`;
        await page.goto(url);
        const slider = page.locator('input[type="range"][max="200"]');
        await slider.waitFor();
        assert.equal(await slider.getAttribute('min'), '0');
        await slider.focus();
        await slider.press('Home');
        assert.equal(await slider.inputValue(), '0');
        await Promise.all([
            page.waitForResponse(response => response.request().method() === 'PUT'),
            slider.dispatchEvent('mouseup')
        ]);
        assert.equal(saves.at(-1), 0);
        await page.reload();
        await slider.waitFor();
        assert.equal(await slider.inputValue(), '0');

        await page.goto(`${url}?mode=settings`);
        await page.getByRole('button', { name: '行为与上下文', exact: true }).click();
        const number = page.locator('label').filter({ hasText: '私聊上下文' }).locator('input[type="number"]');
        await number.waitFor();
        assert.equal(await number.getAttribute('min'), '0');
        assert.equal(await number.inputValue(), '0');
        await number.fill('20');
        await number.fill('0');
        assert.equal(await number.inputValue(), '0');
        assert.equal(await number.evaluate(element => element.validity.valid), true);
        await Promise.all([
            page.waitForResponse(response => response.request().method() === 'POST'),
            page.getByRole('button', { name: /保存/ }).first().click()
        ]);
        assert.equal(saves.at(-1), 0);
        assert.equal(character.explicit_emotion_state, 'playful');
        assert.deepEqual(errors, []);
        console.log('PASS: drawer and settings accept/save/reload zero; emotion preserved; no page errors.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
