const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function within(promise, label) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 10000);
    })]).finally(() => clearTimeout(timer));
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        const state = detail => page.evaluate(value => window.dispatchEvent(new CustomEvent('test_chat_state', { detail: value })), detail);
        const row = (id, content, role = 'character', character_id = 'messages-a') => ({ id, content, role, character_id, timestamp: 1700000000000 + id });
        let messages = [row(1, '已有消息'), row(2, '[System] API Error: 模型失败', 'system')];
        let failAction;
        let warning = false;
        let lastRunId;
        let deferredHistory;
        let deferredSend;
        let onSendStarted;
        let onHistoryStarted;
        let holdSend = false;
        let holdHistory = false;
        let sendCount = 0;
        let latestSaved;
        const historyRequests = [];
        await page.route('**/api/**', async route => {
            const req = route.request();
            const url = new URL(req.url());
            lastRunId = req.headers()['x-run-id'];
            assert.match(lastRunId, /^[a-zA-Z0-9_-]{8,80}$/);
            const runId = lastRunId;
            const error = message => route.fulfill({ status: 503, json: { error: message, errorCode: 'TEST_FAILURE', runId } });
            if (req.method() === 'GET') {
                historyRequests.push(url.search);
                if (url.pathname.endsWith('messages-b')) return route.fulfill({ json: [row(200, '另一个角色的消息', 'character', 'messages-b')] });
                if (failAction === 'history') return error('历史读取失败');
                if (holdHistory) { holdHistory = false; await new Promise(resolve => { deferredHistory = resolve; onHistoryStarted(); }); }
                if (url.searchParams.has('before')) return route.fulfill({ json: [row(4, '更早的消息')] });
                if (url.searchParams.has('around')) return route.fulfill({ json: [row(50, '搜索定位消息')] });
                if (url.searchParams.has('after')) return route.fulfill({ json: [row(51, '搜索后的消息')] });
                return route.fulfill({ json: messages });
            }
            const body = req.postDataJSON();
            if (url.pathname.endsWith('/retry')) {
                if (failAction === 'retry') return error('重试请求失败');
                messages = messages.filter(message => message.id !== body.failedMessageId);
                return route.fulfill({ json: { success: true, runId } });
            }
            if (url.pathname.endsWith('/batch-delete')) {
                if (failAction === 'delete') return error('删除请求失败');
                messages = messages.filter(message => !body.messageIds.includes(message.id));
                return route.fulfill({ json: { success: true, deleted: body.messageIds.length, runId } });
            }
            sendCount++;
            if (failAction === 'send') return error('发送请求失败');
            latestSaved = { ...row(300 + sendCount, body.content, 'user'), runId };
            messages.push(latestSaved);
            if (holdSend) { holdSend = false; await new Promise(resolve => { deferredSend = resolve; onSendStarted(); }); }
            return route.fulfill({ json: { success: true, message: latestSaved, runId,
                ...(warning ? { warnings: ['MESSAGE_REPLY_DISPATCH_FAILED'] } : {}) } });
        });
        const base = process.env.PRIVATE_CHAT_TEST_URL || process.env.REROLL_TEST_URL || 'http://127.0.0.1:5178';
        await page.goto(`${base}/src/features/private-chat/tests/privateMessages.html`);
        await page.getByText('已有消息', { exact: true }).waitFor();
        const input = page.getByPlaceholder('输入消息...');
        const notice = page.locator('.private-message-notice');

        // The same saved message arrives over WS before the HTTP request completes.
        holdSend = true;
        const sendStarted = new Promise(resolve => { onSendStarted = resolve; });
        await input.fill('新发送的消息');
        await input.press('Enter');
        await within(sendStarted, 'send request started');
        assert.ok(deferredSend);
        await state({ queue: [latestSaved] });
        deferredSend();
        await page.waitForFunction(() => document.querySelector('textarea').value === '');
        assert.equal(await page.getByText('新发送的消息', { exact: true }).count(), 1);

        failAction = 'send';
        await input.fill('保留未发送的草稿');
        await input.press('Enter');
        await notice.filter({ hasText: '发送请求失败' }).waitFor();
        assert.equal(await input.inputValue(), '保留未发送的草稿');
        assert.equal(await notice.locator('code').textContent(), lastRunId);
        assert.equal(await page.locator('.chat-history').getByText('保留未发送的草稿', { exact: true }).count(), 0);
        await input.fill('');

        failAction = 'retry';
        await page.getByRole('button', { name: /重新生成/ }).click();
        await notice.filter({ hasText: '重试请求失败' }).waitFor();
        await page.getByText('API Error: 模型失败', { exact: true }).waitFor();
        failAction = null;
        await page.getByRole('button', { name: /重新生成/ }).click();
        await page.getByText('API Error: 模型失败', { exact: true }).waitFor({ state: 'detached' });

        failAction = 'delete';
        await page.getByRole('button', { name: '选择消息' }).click();
        await page.getByText('已有消息', { exact: true }).click();
        const deleteButton = page.locator('.private-select-action-bar').getByRole('button', { name: '删除', exact: true });
        await deleteButton.click();
        await notice.filter({ hasText: '删除请求失败' }).waitFor();
        await page.getByText('已有消息', { exact: true }).waitFor();
        failAction = null;
        await deleteButton.click();
        await page.getByText('已有消息', { exact: true }).waitFor({ state: 'detached' });

        warning = true;
        await input.fill('保存成功但调度失败');
        await input.press('Enter');
        await notice.filter({ hasText: '消息已保存' }).waitFor();
        await page.getByText('保存成功但调度失败', { exact: true }).waitFor();
        const sendsBeforeRetry = sendCount;
        await page.getByRole('button', { name: '重试回复', exact: true }).click();
        await notice.waitFor({ state: 'detached' });
        assert.equal(sendCount, sendsBeforeRetry, 'reply retry must not send the user message again');

        // Exercise the three history cursor routes through the real component.
        messages = Array.from({ length: 100 }, (_, i) => row(10 + i, `分页消息 ${i}`));
        await page.reload();
        await page.getByRole('button', { name: '↑ 加载更早的消息', exact: true }).click();
        await page.getByText('更早的消息', { exact: true }).waitFor();
        await state({ jumpTarget: { scope: 'private', characterId: 'messages-a', messageId: 50, token: 'jump-test' } });
        await page.getByText('搜索定位消息', { exact: true }).waitFor();
        const newer = page.getByRole('button', { name: '↓ 加载更新的消息', exact: true });
        // The scroll handler can auto-load this short page before the button is clicked.
        if (await newer.isVisible()) await newer.click();
        await page.getByText('搜索后的消息', { exact: true }).waitFor();
        assert.ok(historyRequests.some(query => query.includes('before=')));
        assert.ok(historyRequests.some(query => query.includes('around=')));
        assert.ok(historyRequests.some(query => query.includes('after=')));

        // A delayed history request for A must never replace B after switching.
        await page.reload();
        await page.getByText('分页消息 0', { exact: true }).waitFor();
        holdHistory = true;
        const historyStarted = new Promise(resolve => { onHistoryStarted = resolve; });
        await page.evaluate(() => {
            const scroller = document.querySelector('.chat-history');
            scroller.scrollTop = scroller.scrollHeight;
            scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
            window.dispatchEvent(new Event('ws_reconnected'));
        });
        await within(historyStarted, 'history refresh started');
        assert.ok(deferredHistory);
        await state({ characterId: 'messages-b', jumpTarget: null });
        await page.getByText('另一个角色的消息', { exact: true }).waitFor();
        const oldHistoryResponse = page.waitForResponse(response => response.url().includes('/messages/messages-a?'));
        deferredHistory();
        await oldHistoryResponse;
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.getByText('分页消息 0', { exact: true }).count(), 0);
        await page.getByText('另一个角色的消息', { exact: true }).waitFor();

        failAction = 'history';
        await state({ characterId: 'messages-a' });
        await notice.filter({ hasText: '历史读取失败' }).waitFor();
        assert.equal(await notice.locator('code').textContent(), lastRunId);
        await page.setViewportSize({ width: 390, height: 844 });
        const output = path.resolve(__dirname, '../../../../../.codex_tmp/private-messages/browser');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'message-error-mobile.png'), fullPage: true });
        const box = await notice.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= 390, 'error notice fits mobile viewport');
        assert.deepEqual(errors, []);
        console.log('PASS: history cursors, HTTP/WS deduplication, sending, draft preservation, retry/delete failures, saved-message warnings, operation IDs, contact-switch race, mobile notice.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
