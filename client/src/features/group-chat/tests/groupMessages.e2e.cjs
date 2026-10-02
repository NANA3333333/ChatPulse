const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
        page.setDefaultTimeout(8000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const state = detail => page.evaluate(value => window.dispatchEvent(new CustomEvent('test_group_state', { detail: value })), detail);
        const row = (id, content, group_id = 'a') => ({ id, content, group_id, sender_id: 'user', sender_name: 'Test User', timestamp: 1700000000000 + id });
        let messages = [row(1, '原有群消息')];
        let failure = 'http';
        let heldHistory, releaseHistory, heldSend, releaseSend;
        let holdHistory = false, holdSend = false, sent = 0;
        let managementFailure = true;
        await page.route('**/api/groups/*/no-chain', route => route.fulfill({ json: { no_chain: false } }));
        await page.route('**/api/groups/a', route => managementFailure
            ? route.fulfill({ status: 503, json: { error: '群设置保存失败' } })
            : route.fulfill({ json: { success: true, group: { id: 'a', name: route.request().postDataJSON().name, members: [{ member_id: 'user' }] } } }));
        await page.route('**/api/groups/**/messages*', async route => {
            const request = route.request();
            if (request.method() === 'DELETE') return route.fulfill({ status: 503, json: { error: '清空消息测试失败' } });
            if (new URL(request.url()).searchParams.has('around')) return route.fulfill({ json: [row(50, '搜索定位的历史群消息')] });
            const groupId = new URL(request.url()).pathname.split('/')[3];
            if (request.method() === 'GET') {
                const snapshot = groupId === 'b' ? [row(100, '乙群消息', 'b')] : [...messages];
                if (holdHistory && groupId === 'a') {
                    holdHistory = false;
                    heldHistory?.();
                    await new Promise(resolve => { releaseHistory = resolve; });
                }
                return route.fulfill({ json: snapshot }).catch(() => {});
            }
            sent++;
            if (failure === 'http') return route.fulfill({ status: 503, json: { error: '群消息发送失败' } });
            if (failure === 'offline') return route.abort('internetdisconnected');
            if (holdSend) {
                heldSend?.();
                await new Promise(resolve => { releaseSend = resolve; });
            }
            const message = row(2, request.postDataJSON().content, groupId);
            messages.push(message);
            return route.fulfill({ json: { success: true, message } });
        });
        await page.goto(`${process.env.PRIVATE_CHAT_TEST_URL || 'http://127.0.0.1:5173'}/src/features/group-chat/tests/groupMessages.html`);
        await page.getByText('原有群消息', { exact: true }).waitFor();
        const input = page.locator('textarea.input-textarea');
        const send = page.getByRole('button', { name: '发送', exact: true });
        await input.fill('失败后应保留的草稿');
        await send.click();
        await page.getByRole('alert').filter({ hasText: '群消息发送失败' }).waitFor();
        assert.equal(await input.inputValue(), '失败后应保留的草稿');
        failure = 'offline';
        await send.click();
        await page.getByRole('alert').filter({ hasText: /网络|fetch|Failed/i }).waitFor();
        assert.equal(await input.inputValue(), '失败后应保留的草稿');

        failure = null; holdSend = true;
        const started = new Promise(resolve => { heldSend = resolve; });
        await send.click(); await started;
        assert.equal(await send.isDisabled(), true);
        await input.fill('发送期间输入的新草稿');
        holdSend = false; releaseSend();
        await page.getByText('失败后应保留的草稿', { exact: true }).waitFor();
        assert.equal(await input.inputValue(), '发送期间输入的新草稿');
        await state({ queue: [messages.at(-1)] });
        assert.equal(await page.getByText('失败后应保留的草稿', { exact: true }).count(), 1);
        assert.equal(sent, 3);

        holdHistory = true;
        const historyStarted = new Promise(resolve => { heldHistory = resolve; });
        await page.evaluate(() => window.dispatchEvent(new Event('ws_reconnected')));
        let historyTimeout;
        try { await Promise.race([historyStarted, new Promise((_, reject) => { historyTimeout = setTimeout(() => reject(new Error('Reconnect did not reload group messages')), 8000); })]); }
        finally { clearTimeout(historyTimeout); }
        await state({ groupId: 'b', queue: [] });
        await page.getByText('乙群消息', { exact: true }).waitFor();
        await input.fill('乙群草稿');
        releaseHistory();
        await page.waitForTimeout(100);
        assert.equal(await page.getByText('原有群消息', { exact: true }).count(), 0);
        assert.equal(await input.inputValue(), '乙群草稿');
        await state({ groupId: 'a' });
        await page.getByText('原有群消息', { exact: true }).waitFor();
        assert.equal(await input.inputValue(), '发送期间输入的新草稿');
        messages.push(row(3, '断线期间新增的群消息'));
        await page.evaluate(() => window.dispatchEvent(new Event('ws_reconnected')));
        await page.getByText('断线期间新增的群消息', { exact: true }).waitFor();

        await page.getByTitle('群管理 — 成员、AI 控制、危险操作').click();
        const drawer = page.locator('.group-manage-drawer');
        await drawer.getByTitle('修改群名').click();
        const name = drawer.locator('input[type=text]').first();
        await name.fill('保存成功的群名');
        await name.press('Enter');
        await drawer.getByRole('alert').filter({ hasText: '群设置保存失败' }).waitFor();
        assert.equal(await name.inputValue(), '保存成功的群名');
        managementFailure = false;
        await name.press('Enter');
        await name.waitFor({ state: 'hidden' });
        await page.locator('.chat-header-name-text').filter({ hasText: '保存成功的群名' }).waitFor();
        page.on('dialog', dialog => dialog.accept());
        await drawer.getByTitle('清空群聊中的所有消息').click();
        await drawer.getByRole('alert').filter({ hasText: '清空消息测试失败' }).waitFor();
        assert.equal(await page.getByText('原有群消息', { exact: true }).count(), 1);
        assert.equal(await input.inputValue(), '发送期间输入的新草稿');
        await drawer.getByTitle('关闭').click();

        let packetFailure = true;
        await page.route('**/api/groups/a/redpackets', route => packetFailure
            ? route.fulfill({ status: 503, json: { error: '红包回归测试失败' } })
            : route.fulfill({ json: { success: true } }));
        await page.getByTitle('发红包 — 给群友发财运').click();
        const packet = page.getByRole('dialog', { name: '发送红包', exact: true });
        await packet.getByPlaceholder('0.00').fill('10');
        await packet.getByRole('button', { name: '发红包', exact: true }).click();
        await packet.getByText('红包回归测试失败', { exact: true }).waitFor();
        assert.equal(await packet.getByPlaceholder('0.00').inputValue(), '10');
        packetFailure = false;
        await packet.getByRole('button', { name: '发红包', exact: true }).click();
        await packet.waitFor({ state: 'hidden' });

        holdHistory = true;
        const lateHistory = new Promise(resolve => { heldHistory = resolve; });
        await page.evaluate(() => window.dispatchEvent(new Event('ws_reconnected')));
        await lateHistory;
        await state({ jumpTarget: { scope: 'group', groupId: 'a', messageId: 50, token: 'search-1' } });
        await page.getByText('搜索定位的历史群消息', { exact: true }).waitFor();
        releaseHistory();
        await page.waitForTimeout(150);
        assert.equal(await page.getByText('搜索定位的历史群消息', { exact: true }).count(), 1);
        assert.equal(await page.getByText('原有群消息', { exact: true }).count(), 0);
        assert.deepEqual(errors, []);
        console.log('PASS group messages: HTTP/offline failure, drafts, send locking, HTTP/WS dedup, switching race, reconnect, search race and management failures.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
