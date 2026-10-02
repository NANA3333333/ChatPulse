const assert = require('node:assert/strict');

async function verifyDesktopWindows(page) {
    const desktop = page.locator('.desktop-home');
    async function createItem(label) {
        await desktop.click({ button: 'right', position: { x: 850, y: 450 } });
        await page.getByRole('menuitem', { name: '新建', exact: true }).click();
        await page.getByRole('menuitem', { name: label, exact: true }).click();
    }
    await createItem('文件夹');
    const folder = page.locator('.desktop-folder-window').filter({ has: page.getByRole('button', { name: '关闭标签页', exact: true }) });
    await folder.getByRole('button', { name: '最大化', exact: true }).click();
    await folder.getByRole('button', { name: '还原', exact: true }).click();
    await folder.getByRole('button', { name: '关闭', exact: true }).click();
    await createItem('文本文档');
    const document = page.locator('.desktop-text-window');
    await document.getByRole('textbox', { name: '文档名称' }).fill('结构回归文档');
    await document.getByRole('textbox', { name: '文本文档内容' }).fill('保存后应能从回收站还原。');
    await document.getByRole('button', { name: '保存', exact: true }).click();
    await document.getByRole('button', { name: '关闭', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: '结构回归文档', exact: true }).dblclick();
    assert.equal(await document.getByRole('textbox', { name: '文本文档内容' }).inputValue(), '保存后应能从回收站还原。');
    page.once('dialog', dialog => dialog.accept());
    await document.getByRole('button', { name: '删除', exact: true }).click();
    await document.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '回收站', exact: true }).dblclick();
    await page.getByText('结构回归文档', { exact: true }).first().click();
    await page.getByRole('button', { name: '还原所选项目', exact: true }).click();
    await page.locator('.desktop-folder-window').getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '结构回归文档', exact: true }).dblclick();
    assert.equal(await document.getByRole('textbox', { name: '文本文档内容' }).inputValue(), '保存后应能从回收站还原。');
    await document.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '图片', exact: true }).dblclick();
    await page.locator('.desktop-folder-window').getByRole('button', { name: '关闭', exact: true }).click();
    console.log('PASS desktop windows: folder geometry, document save/reload, recycle restore and album');
}

async function verifyHousingComponents(page, { labsEnabled }) {
    const panel = page.locator('.housing-panel');
    await panel.getByRole('button', { name: '房源管理', exact: true }).click();
    await panel.getByRole('button', { name: '自定义', exact: true }).click();
    const editor = page.locator('.housing-home-editor-modal');
    await editor.getByRole('textbox', { name: '房子名字', exact: true }).fill('结构回归房源');
    await editor.getByRole('button', { name: '新增房子', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    await panel.locator('.housing-home-title').filter({ hasText: '结构回归房源' }).first().waitFor();
    await panel.locator('.housing-drawer-head button').click();
    if (!labsEnabled) {
        console.log('PASS housing: listing creation while scene labs are disabled');
        return;
    }
    await panel.getByRole('button', { name: '中介 AI 创作室', exact: true }).click();
    await page.route('**/api/social-housing/agency/room-assembly', route => route.fulfill({
        status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'E2E assembly unavailable' })
    }));
    await panel.getByRole('button', { name: '中介生成并保存', exact: true }).click();
    await panel.getByText(/AI 生成失败，已先用规则模板保存/).waitFor({ timeout: 30000 });
    const layout = await page.evaluate(() => JSON.parse(localStorage.getItem('pixelWorld.room.layout')));
    assert.ok(layout.items.length > 0, 'Fallback assembly saves furniture');
    assert.ok(layout.items.every(item => [item.x, item.y, item.w, item.h].every(Number.isFinite)), 'Furniture bounds are numeric');
    await panel.locator('.housing-history-row').last().getByRole('button', { name: '打开', exact: true }).click();
    await page.locator('.housing-room-modal-preview').waitFor();
    await page.locator('.housing-room-assembly-modal').getByRole('button', { name: '取消编辑', exact: true }).first().click();
    console.log('PASS housing: listing creation, assembly failure fallback, storage and preview dialog');
}

async function verifySceneEditing(page, name) {
    const room = name === '像素小屋';
    const key = room ? 'pixelWorld.room.layout' : 'pixelWorld.commercialStreetV2.layout';
    const readItems = () => page.evaluate(({ key, room }) => {
        const layout = JSON.parse(localStorage.getItem(key));
        return room ? layout.items : layout;
    }, { key, room });
    // Other desktop windows can stay mounted behind the active application.
    const editor = page.locator('.right-column .pixel-world-editor');
    await editor.getByRole('button', { name: '场景工具', exact: true }).click();
    const toolbar = editor.locator('.pixel-world-editor-toolbar:not(.scene-player-toolbar)');
    if (!room) await toolbar.getByRole('button', { name: '高级设置', exact: true }).click();
    const lock = toolbar.getByRole('button', { name: '观赏模式', exact: true });
    if (await lock.count()) await lock.click();
    const assetToggle = toolbar.getByRole('button', { name: '素材编辑', exact: true });
    if (await assetToggle.count()) await assetToggle.click();
    await toolbar.getByRole('button', { name: '保存布局', exact: true }).click();
    const before = await readItems();
    assert.ok(Array.isArray(before), `${name}: existing storage format`);
    await editor.locator('.pixel-world-asset-grid button').first().click();
    await toolbar.getByRole('button', { name: '保存布局', exact: true }).click();
    const saved = await readItems();
    assert.equal(saved.length, before.length + 1, `${name}: add asset and save`);
    const added = saved.find(item => !before.some(previous => previous.id === item.id));
    assert.ok(added, 'Added asset has its own identity');
    await page.reload();
    await page.getByRole('button', { name, exact: true }).first().dblclick();
    await editor.waitFor();
    const loaded = await readItems();
    assert.ok(loaded.some(item => item.id === added.id), `${name}: reload retains asset`);
    await editor.locator(`.pixel-world-editor-item[data-item-id="${added.id}"]`).first().waitFor({ state: 'attached' });
    if (room) {
        await editor.getByRole('button', { name: '场景工具', exact: true }).click();
        await editor.getByRole('textbox', { name: '补充输入', exact: true }).fill('只用于结构回归的上下文');
        await page.route('**/api/city/characters/*/behavior-input', route => route.fulfill({
            status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'E2E context unavailable' })
        }));
        await editor.getByRole('button', { name: '读取 AI 上文', exact: true }).click();
        await editor.getByText(/E2E context unavailable/).first().waitFor();
        assert.equal(await editor.getByRole('textbox', { name: '补充输入', exact: true }).inputValue(), '只用于结构回归的上下文');
    }
    if (await editor.getByRole('button', { name: '关闭场景工具', exact: true }).count()) {
        await editor.getByRole('button', { name: '关闭场景工具', exact: true }).click();
    }
    assert.ok(await editor.evaluate(node => node.classList.contains('view-mode')));
    assert.equal(await editor.locator('.pixel-world-asset-panel').count(), 0, 'Closing tools removes asset editor');
    console.log(`PASS scene editing: ${name} asset add, layout save/reload${room ? ' and context failure' : ''}`);
}

module.exports = { verifyDesktopWindows, verifyHousingComponents, verifySceneEditing };
