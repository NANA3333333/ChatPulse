const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

async function verifyStreetLayers(page) {
    const editor = page.locator('.right-column .pixel-world-editor');
    await editor.getByRole('button', { name: '场景工具', exact: true }).click();
    const toolbar = editor.locator('.pixel-world-editor-toolbar:not(.scene-player-toolbar)');
    await toolbar.getByRole('button', { name: '高级设置', exact: true }).click();
    await toolbar.getByRole('button', { name: '观赏模式', exact: true }).click();
    await toolbar.getByRole('button', { name: '查看图层', exact: true }).click();
    const panel = editor.locator('.commercial-layer-panel');
    await panel.waitFor();
    const groups = panel.locator('.commercial-layer-group');
    assert.equal(await groups.count(), 3, 'Foreground, midground, and background folders exist');
    const middle = groups.nth(1);
    await middle.locator('.commercial-layer-folder').click();
    const middleRows = middle.locator('.commercial-layer-row');
    assert.ok(await middleRows.count() > 0, 'Midground contains scenery');
    const row = middleRows.first();
    const middleIds = new Set(await middleRows.evaluateAll((nodes) => nodes.map((node) => node.dataset.itemId)));
    const itemId = await row.getAttribute('data-item-id');
    const readLayout = async () => {
        await toolbar.getByRole('button', { name: '保存布局', exact: true }).click();
        return page.evaluate(() => JSON.parse(localStorage.getItem('pixelWorld.commercialStreetV2.layout')));
    };
    const before = await readLayout();
    const beforeItem = before.find((item) => item.id === itemId);
    assert.ok(beforeItem, 'Layer row identifies a saved item');

    await row.locator('.commercial-layer-eye').click();
    assert.equal(await editor.locator(`.active-loop .pixel-world-editor-item[data-item-id="${itemId}"]`).count(), 0, 'Eye hides preview item');
    assert.deepEqual(await readLayout(), before, 'Preview visibility leaves layout data unchanged');
    await row.locator('.commercial-layer-eye').click();
    assert.ok(await editor.locator(`.active-loop .pixel-world-editor-item[data-item-id="${itemId}"]`).count(), 'Eye restores item');
    await middle.locator('.commercial-layer-group-head .commercial-layer-eye').click();
    assert.equal(await editor.locator(`.active-loop .pixel-world-editor-item[data-item-id="${itemId}"]`).count(), 0, 'Folder eye hides its members');
    assert.deepEqual(await readLayout(), before, 'Folder visibility leaves layout data unchanged');
    await middle.locator('.commercial-layer-group-head .commercial-layer-eye').click();

    const step = middle.getByRole('combobox', { name: '整组移动步长' });
    assert.equal(await step.inputValue(), '20');
    await step.selectOption('4');
    await middle.getByRole('button', { name: '中景右移', exact: true }).click();
    const moved = await readLayout();
    assert.ok(moved.some((item) => middleIds.has(item.id) && item.x !== before.find((previous) => previous.id === item.id)?.x), 'Batch move changes midground position');
    assert.deepEqual(moved.map((item) => [item.id, item.assetId, item.collision]), before.map((item) => [item.id, item.assetId, item.collision]), 'Batch move keeps item order and collision values');
    assert.deepEqual(
        moved.filter((item) => !middleIds.has(item.id)),
        before.filter((item) => !middleIds.has(item.id)),
        'Batch move leaves other folders unchanged',
    );
    await middle.getByRole('button', { name: '中景放大', exact: true }).click();
    const scaled = await readLayout();
    assert.ok(scaled.some((item) => middleIds.has(item.id) && item.w !== before.find((previous) => previous.id === item.id)?.w), 'Batch scale changes midground size');
    assert.deepEqual(scaled.map((item) => [item.id, item.assetId, item.collision]), before.map((item) => [item.id, item.assetId, item.collision]), 'Batch scale keeps collision values');
    if (process.env.CHATPULSE_PARALLAX_SCREENSHOT === '1') {
        const screenshotPath = path.join(os.tmpdir(), 'chatpulse-street-layers.png');
        await panel.screenshot({ path: screenshotPath });
        console.log(`Layer panel screenshot: ${screenshotPath}`);
    }
    await middle.locator('.commercial-layer-group-head .commercial-layer-eye').click();
    assert.equal(await editor.locator(`.active-loop .pixel-world-editor-item[data-item-id="${itemId}"]`).count(), 0, 'Folder eye hides preview before closing tools');
    await editor.getByRole('button', { name: '关闭场景工具', exact: true }).click();
    assert.ok(await editor.locator(`.active-loop .pixel-world-editor-item[data-item-id="${itemId}"]`).count(), 'Closing tools restores gameplay rendering');
    console.log('PASS street layers: folders, preview eyes, batch move/scale, stable collision/order and restored gameplay view');
}

module.exports = { verifyStreetLayers };
