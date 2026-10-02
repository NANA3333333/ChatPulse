const assert = require('node:assert/strict');

async function verifySceneSyncRecovery(browser, baseUrl, login) {
    const page = await browser.newPage({ viewport: { width: 1360, height: 920 } });
    const key = 'pixelWorld.room.behaviorTreeState';
    const endpoint = '/api/city/behavior-tree-state/pixel_cottage_room_v1';
    const headers = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };
    const read = () => fetch(baseUrl + endpoint, { headers }).then((response) => response.json());
    const open = async () => {
        await page.goto(baseUrl);
        await page.getByRole('button', { name: '像素小屋', exact: true }).first().dblclick();
        await page.locator('.right-column .scene-player-toolbar').waitFor();
    };
    try {
        await page.addInitScript((data) => {
            localStorage.setItem('cp_token', data.token);
            localStorage.setItem('cp_user', JSON.stringify(data.user));
        }, login);
        await open();
        const saved = await read();
        assert.ok(saved.tree);
        const seedPending = (tree) =>
            page.evaluate(
                ({ key, tree, revision }) => {
                    sessionStorage.removeItem(`${key}.pending-sync-local`);
                    localStorage.setItem(key, JSON.stringify(tree));
                    localStorage.setItem(
                        `${key}.pending-sync`,
                        JSON.stringify({ tree, revision, meta: { source: 'e2e' } }),
                    );
                },
                { key, tree, revision: saved.revision },
            );
        const local = {
            ...saved.tree,
            version: saved.tree.version + 10,
            memory: { ...saved.tree.memory, recovery_test: 'local' },
        };
        await seedPending(local);
        let posts = 0;
        await page.route('**' + endpoint, (route) => {
            if (route.request().method() === 'POST' && ++posts === 1)
                return route.fulfill({
                    status: 503,
                    contentType: 'application/json',
                    body: '{"error":"offline fixture"}',
                });
            return route.continue();
        });
        await open();
        const toolbar = page.locator('.right-column .scene-player-toolbar');
        const failedSave = page.waitForResponse(
            (response) =>
                response.url().endsWith(endpoint) &&
                response.request().method() === 'POST' &&
                response.status() === 503,
        );
        await toolbar.getByRole('button', { name: '重试同步', exact: true }).click();
        await failedSave;
        await toolbar.getByRole('button', { name: '重试同步', exact: true }).waitFor();
        await page.waitForFunction(
            (key) => Boolean(JSON.parse(localStorage.getItem(sessionStorage.getItem(`${key}.pending-sync-pointer`)))?.pending?.tree?.memory?.recovery_test),
            key,
        );
        await toolbar.getByRole('button', { name: '重试同步', exact: true }).click();
        await page.waitForFunction((key) => sessionStorage.getItem(`${key}.pending-sync-pointer`) === null, key);
        const acknowledged = await read();
        assert.equal(acknowledged.tree.memory.recovery_test, 'local');

        const remote = { ...local, version: local.version + 1, memory: { ...local.memory, recovery_test: 'server' } };
        const update = await fetch(baseUrl + endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ tree: remote, expected_revision: acknowledged.revision }),
        });
        assert.equal(update.status, 200);
        await seedPending(local); // Intentionally stale revision from before the successful save.
        await open();
        await toolbar.getByRole('button', { name: '重试同步', exact: true }).click();
        await toolbar.getByText(/另一窗口已保存修改/).waitFor();
        assert.equal(
            await page.evaluate(
                (key) => JSON.parse(localStorage.getItem(sessionStorage.getItem(`${key}.pending-sync-pointer`))).pending.tree.memory.recovery_test,
                key,
            ),
            'local',
        );
        await toolbar.getByRole('button', { name: '加载服务器版本', exact: true }).click();
        await page.waitForFunction(
            (key) =>
                localStorage.getItem(`${key}.pending-sync`) === null &&
                JSON.parse(localStorage.getItem(key)).memory.recovery_test === 'server',
            key,
        );
        assert.equal(
            await page.evaluate(
                (key) => JSON.parse(localStorage.getItem(`${key}.unsynced-backup`)).memory.recovery_test,
                key,
            ),
            'local',
        );
        console.log(
            'PASS scene sync recovery: failed save retry, stale revision conflict and explicit server reload with local recovery copy',
        );
    } finally {
        await page.close();
    }
}

module.exports = { verifySceneSyncRecovery };
