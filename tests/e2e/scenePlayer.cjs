const assert = require('node:assert/strict');
const { approachScenePeer } = require('./sceneMovement.cjs');

async function verifyScenePlayer(page, baseUrl, token, name, { labsEnabled }) {
    const scene = page.locator('.right-column .pixel-world-editor');
    const toolbar = scene.locator('.scene-player-toolbar');
    await toolbar.waitFor();
    // Normal interactions start from a known server revision. Recovery tests exercise early/stale edits separately.
    await scene.locator('.scene-player-toolbar[data-sync-status="synced"]').waitFor({ timeout: 20000 });
    assert.ok(await scene.evaluate((node) => node.classList.contains('view-mode')));
    for (const selector of [
        '.pixel-world-asset-panel',
        '.pixel-world-behavior-panel',
        '.pixel-world-collision-box',
        '.pixel-world-layer-badge',
    ]) {
        assert.equal(await scene.locator(selector).count(), 0, `${name}: player mode excludes ${selector}`);
    }
    assert.equal(await toolbar.getByRole('button', { name: '场景工具', exact: true }).count(), labsEnabled ? 1 : 0);
    if (!labsEnabled) {
        for (const [method, route] of [
            ['GET', '/api/city/characters/e2e-character/behavior-models'],
            ['POST', '/api/city/characters/e2e-character/behavior-input'],
        ]) {
            const response = await fetch(baseUrl + route, { method, headers: { Authorization: `Bearer ${token}` } });
            assert.equal(response.status, 404, `${name}: backend diagnostic disabled`);
        }
        const labModules = await page.evaluate(() =>
            performance
                .getEntriesByType('resource')
                .map((item) => item.name)
                .filter((url) => url.includes('/labs/scene-editor/')),
        );
        assert.deepEqual(labModules, [], 'Player entry must not load editor modules');
    }
    const selector = toolbar.getByRole('combobox', { name: '切换控制角色', exact: true });
    const choices = await selector.locator('option').evaluateAll((options) => options.map((option) => option.value));
    assert.ok(choices.length > 1);
    for (const value of choices) {
        await selector.selectOption(value);
        assert.equal(await selector.inputValue(), value);
    }
    const canvas = scene.locator('.pixel-world-editor-canvas-wrap');
    await canvas.focus();
    const player = scene.locator('.pixel-world-player.controlled').first();
    const position = () => player.evaluate((node) => node.style.transform);
    const before = await position();
    // Try both axes so an existing wall or another sprite cannot cause a false failure.
    for (const key of ['d', 's', 'a', 'w']) {
        await page.keyboard.down(key);
        await page.waitForTimeout(180);
        await page.keyboard.up(key);
        if ((await position()) !== before) break;
    }
    assert.notEqual(await position(), before, `${name}: keyboard moves controlled player`);
    const asset = scene.locator('.pixel-world-editor-item').first();
    const originalStyle = await asset.getAttribute('style');
    const box = await asset.boundingBox();
    if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 4 });
        await page.mouse.up();
        assert.equal(await asset.getAttribute('style'), originalStyle, `${name}: player cannot drag assets`);
    }
    // Control the role while approaching the stationary player, so this input test
    // does not depend on catching an independently wandering actor.
    await selector.selectOption(choices[0]);
    const moreControls = toolbar.locator('.scene-player-toolbar__more > summary');
    await moreControls.click();
    await toolbar.getByRole('combobox', { name: '选择场景角色', exact: true }).selectOption('e2e-character');
    const bind = toolbar.getByRole('button', { name: '绑定', exact: true });
    if (await bind.count()) await bind.click();
    await moreControls.click();
    // Walk toward the other visible actor using the rendered positions, then
    // exercise the local greeting branch without contacting an AI provider.
    let stage;
    let dialogOpened = false;
    let lastInteractionError;
    // The other actor can walk away between entering interaction range and pressing
    // the floating button. Re-approach if that happens during the test.
    for (let attempt = 0; attempt < 3 && !dialogOpened; attempt++) {
        stage = await approachScenePeer(page, scene, name);
        try {
            await stage.locator('.pixel-world-interaction-entry').press('Enter', { timeout: 2000 });
            const action = stage.locator('.pixel-world-interaction-menu-primary button').first();
            await action.waitFor({ timeout: 2500 });
            await action.press('Enter', { timeout: 2000 });
            await stage.locator('.pixel-world-behavior-dialog').first().waitFor({ timeout: 8000 });
            dialogOpened = true;
        } catch (error) {
            lastInteractionError = error;
        }
    }
    try {
        if (!dialogOpened) throw lastInteractionError || new Error('Scene interaction dialog did not open');
    } catch (error) {
        console.error('Scene interaction diagnostic:', await scene.evaluate(node => ({
            controls: [...node.querySelectorAll('select')].map(select => ({ name: select.getAttribute('aria-label'), value: select.value })),
            entry: node.querySelector('.pixel-world-interaction-entry')?.outerHTML,
            menu: node.querySelector('.pixel-world-interaction-menu')?.outerHTML,
            dialogs: [...node.querySelectorAll('.pixel-world-behavior-dialog')].map(dialog => dialog.innerText),
            players: [...node.querySelectorAll('.pixel-world-player')].map(player => ({ className: player.className, transform: player.style.transform })),
        })));
        throw error;
    }
    for (let step = 0; step < 8; step++) {
        // A wait/turn step can leave the dialog absent briefly before showing choices.
        const next = stage.getByRole('button', { name: '下一句', exact: true });
        const exit = stage.getByRole('button', { name: '退出对话', exact: true });
        await next.or(exit).first().waitFor();
        if (await exit.count()) break;
        await next.first().click({ force: true });
    }
    const choiceEndpoint = '**/api/city/characters/*/behavior-branch';
    let choiceRequests = 0,
        releaseChoice;
    const choiceResponse = new Promise((resolve) => {
        releaseChoice = resolve;
    });
    await page.route(choiceEndpoint, async (route) => {
        choiceRequests++;
        await choiceResponse;
        await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'E2E choice unavailable' }),
        });
    });
    const choicesPanel = stage.locator('.pixel-world-behavior-dialog-choices').first();
    const choiceLabels = await choicesPanel.getByRole('button').allTextContents();
    await choicesPanel.getByRole('button').first().click({ force: true });
    await stage.getByRole('button', { name: '生成中...', exact: true }).waitFor();
    assert.equal(await stage.getByRole('button', { name: '生成中...', exact: true }).isDisabled(), true);
    releaseChoice();
    await stage.getByText(/后续枝丫生成失败：E2E choice unavailable/).waitFor();
    assert.deepEqual(await choicesPanel.getByRole('button').allTextContents(), choiceLabels);
    await choicesPanel.getByRole('button').first().click({ force: true });
    await stage.getByText(/后续枝丫生成失败：E2E choice unavailable/).waitFor();
    assert.equal(choiceRequests, 2, 'Choice submission unlocks for retry after failure');
    await page.unroute(choiceEndpoint);
    await stage.getByRole('button', { name: '退出对话', exact: true }).first().click({ force: true });
    let generationRequests = 0;
    const endpoint = '**/api/city/characters/*/behavior-base-branches';
    await page.route(endpoint, (route) => {
        generationRequests++;
        return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'E2E generation unavailable' }),
        });
    });
    await moreControls.click();
    await toolbar.getByRole('button', { name: '生成行为树', exact: true }).click();
    await toolbar.getByRole('alert').filter({ hasText: 'E2E generation unavailable' }).waitFor();
    assert.equal(generationRequests, 1);
    assert.equal(await toolbar.getByRole('button', { name: '生成行为树', exact: true }).isEnabled(), true);
    await page.unroute(endpoint);
    await moreControls.click();
    console.log(
        `PASS scene player: ${name} controls, movement, locked assets, greeting, dialog failure/retry and generation failure${labsEnabled ? '' : '; frontend/backend tools disabled'}`,
    );
}

module.exports = { verifyScenePlayer };
