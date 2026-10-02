// Run with a background Vite server: REROLL_TEST_URL=http://127.0.0.1:5178 node src/features/private-chat/tests/privateReplyReroll.e2e.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        let messages = [
            { id: 1, character_id: 'reroll-ui', role: 'user', content: '今晚一起去散步吧？', timestamp: 1000 },
            { id: 2, character_id: 'reroll-ui', role: 'character', content: '好呀，等我一下。', timestamp: 1001 },
            { id: 3, character_id: 'reroll-ui', role: 'character', content: '我拿上外套就来。', timestamp: 1002,
                metadata: { replyVersion: { messageId: 3, active: 0, count: 1, revision: 0 } } }
        ];
        const variants = ['好呀，等我一下。\n我拿上外套就来。'];
        let rerolls = 0;
        let failNext = false;
        let releaseReroll;
        let latestRunId;
        await page.route('**/api/**', async route => {
            const request = route.request();
            if (request.method() === 'GET') return route.fulfill({ json: messages });
            latestRunId = request.headers()['x-run-id'];
            assert.match(latestRunId, /^[a-zA-Z0-9_-]{8,80}$/);
            const body = request.postDataJSON();
            if (request.url().endsWith('/reroll')) {
                rerolls++;
                if (failNext) return route.fulfill({ status: 502, json: { error: '测试：主模型暂时不可用，已保留原回复。',
                    runId: latestRunId, errorCode: 'LLM_REQUEST_FAILED' } });
                await new Promise(resolve => { releaseReroll = resolve; });
                variants.push('走吧，我也正想出去透透气。\n沿着河边慢慢走，好不好？\n回来再买杯热茶。');
                body.version = variants.length - 1;
            }
            const message = { ...messages.at(-1), content: variants[body.version], metadata: {
                replyBubbles: true, replyVersion: { messageId: 3, active: body.version, count: variants.length, revision: body.revision + 1 }
            } };
            messages = [messages[0], message];
            return route.fulfill({ json: { success: true, character_id: 'reroll-ui', removedIds: [2], message, runId: latestRunId } });
        });
        const base = process.env.REROLL_TEST_URL || 'http://127.0.0.1:5178';
        await page.goto(`${base}/src/features/private-chat/tests/privateReplyReroll.html`);
        await page.getByRole('group', { name: '回复版本', exact: true }).waitFor();
        const count = page.locator('.private-reply-count');
        const waitCount = expected => page.waitForFunction(value => document.querySelector('.private-reply-count')?.textContent === value, expected);
        assert.equal(await count.textContent(), '1 / 1');
        await page.getByRole('button', { name: /重 roll：/ }).click();
        await page.getByRole('status').filter({ hasText: '重 roll 中' }).waitFor();
        assert.equal(await page.getByRole('button', { name: /重 roll：/ }).isDisabled(), true);
        assert.equal(rerolls, 1);
        releaseReroll();
        await waitCount('2 / 2');
        assert.equal(await page.getByText('好呀，等我一下。', { exact: true }).count(), 0);
        await page.getByText('回来再买杯热茶。', { exact: true }).waitFor();
        await page.getByRole('button', { name: '上一个回复版本', exact: true }).click();
        await waitCount('1 / 2');
        await page.getByText('好呀，等我一下。', { exact: true }).waitFor();
        await page.getByRole('button', { name: '下一个回复版本', exact: true }).click();
        await waitCount('2 / 2');
        assert.equal(rerolls, 1);
        await page.reload();
        await waitCount('2 / 2');
        failNext = true;
        await page.getByRole('button', { name: /重 roll：/ }).click();
        await page.getByRole('alert').filter({ hasText: '已保留原回复' }).waitFor();
        assert.equal(await page.locator('.private-reply-run-id code').textContent(), latestRunId);
        assert.equal(await count.textContent(), '2 / 2');
        await page.getByText('回来再买杯热茶。', { exact: true }).waitFor();
        // Another connected client selects the original version.
        const remoteMessage = { ...messages.at(-1), content: variants[0], metadata: { replyBubbles: true,
            replyVersion: { messageId: 3, active: 0, count: 2, revision: 8 } } };
        await page.evaluate(message => window.dispatchEvent(new CustomEvent('private_reply_updated', {
            detail: { character_id: 'reroll-ui', removedIds: [], message }
        })), remoteMessage);
        await waitCount('1 / 2');
        // A late HTTP/WS result must not overwrite a newer selected version.
        await page.evaluate(message => window.dispatchEvent(new CustomEvent('private_reply_updated', {
            detail: { character_id: 'reroll-ui', removedIds: [], message }
        })), messages.at(-1));
        await waitCount('1 / 2');
        const output = path.resolve(__dirname, '../../../../../.codex_tmp/feature-structure/reroll-qa');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        const box = await page.locator('.private-reply-controls').boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= 390, 'reply controls fit the mobile viewport');
        assert.deepEqual(errors, []);
        console.log('PASS: reroll, loading lock, multi-bubble replacement, history navigation, reload, failure preservation, operation ID, remote/stale updates, mobile layout.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
