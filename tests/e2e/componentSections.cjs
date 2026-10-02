const assert = require('node:assert/strict');

async function verifySettingsSections(page) {
    const navigate = label => page.locator('.settings-guided-sidebar').getByRole('button', { name: new RegExp(label) }).click();
    await navigate('角色配置');
    const tabs = page.locator('.settings-control-section-tabs');
    await tabs.getByRole('button', { name: '基础人设', exact: true }).click();
    const name = page.getByLabel('角色名称', { exact: true });
    const original = await name.inputValue();
    await name.fill(original + '临时草稿');
    for (const [label, marker] of [
        [/模型/, '.settings-control-model-card'],
        ['行为与上下文', '.settings-control-form-stack'],
        ['声音', '.settings-control-tts-preview'],
        ['角色数据', '.settings-control-form-stack']
    ]) {
        await tabs.getByRole('button', { name: label, exact: typeof label === 'string' }).click();
        await page.locator(marker).first().waitFor();
    }
    await tabs.getByRole('button', { name: '基础人设', exact: true }).click();
    assert.equal(await name.inputValue(), original + '临时草稿', 'Character draft must survive changing sections');
    await name.fill(original);
    await navigate('账号安全');
    await page.locator('.settings-sessions-card').waitFor();
    await navigate('模型与声音');
    await page.locator('.settings-control-model-card').first().waitFor();
    await navigate('备份与迁移');
    await page.locator('.settings-backup-action--danger').click();
    const dialog = page.locator('.settings-wipe-modal');
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('button', { name: '永久清空', exact: true }).isDisabled(), true);
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    console.log('PASS settings sections: character tabs preserve draft, account sessions, model overview and backup cancellation');
}

async function verifyMemorySections(page) {
    let summary = '模块回归：用户偏爱蓝色';
    let saveFailure = true;
    await page.route('**/api/memory-maintenance/library?*', route => route.fulfill({ json: {
        success: true,
        library: { new_library: { categories: [{ key: 'user_profile', label: '用户偏好', items: [{
            id: 9101, source_ids: [9101], memory_library_source: 'new', summary,
            character_id: 'fixture', character_name: '回归角色', memory_focus: 'user_profile',
            memory_tier: 'core', importance: 8, updated_at: Date.now()
        }] }] } }
    } }));
    await page.route('**/api/memories/bulk', route => {
        assert.equal(route.request().method(), 'PATCH');
        if (saveFailure) return route.fulfill({ status: 503, json: { error: '记忆编辑测试失败' } });
        const body = route.request().postDataJSON();
        assert.deepEqual(body.ids, [9101]);
        summary = body.patch.consolidation_summary;
        return route.fulfill({ json: { success: true, updated: 1 } });
    });
    await page.route('**/api/memory-source?*', route => route.fulfill({ json: { success: true,
        memories: [], sources: [{ source_type: 'private_chat', text: '用于回归验证的来源原文' }], stats: {} } }));
    await page.getByRole('button', { name: '记忆地图', exact: true }).click();
    await page.locator('.memory-core-header').getByTitle('刷新', { exact: true }).click();
    await page.getByText(summary, { exact: true }).first().waitFor();
    const actions = page.locator('.memory-detail-actions');
    await actions.getByRole('button', { name: '编辑', exact: true }).click();
    const editor = page.locator('.memory-edit-modal');
    await editor.locator('textarea').first().fill('模块回归：编辑后仍保留蓝色偏好');
    await editor.getByRole('button', { name: '保存修改', exact: true }).click();
    await editor.getByRole('button', { name: '保存修改', exact: true }).waitFor();
    assert.equal(await editor.locator('textarea').first().inputValue(), '模块回归：编辑后仍保留蓝色偏好');
    saveFailure = false;
    await editor.getByRole('button', { name: '保存修改', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    await page.getByText(summary, { exact: true }).first().waitFor();
    await actions.getByRole('button', { name: '原文', exact: true }).click();
    const viewer = page.locator('.memory-source-modal');
    await viewer.getByText('来源原文', { exact: true }).waitFor();
    await viewer.locator('.memory-edit-close').click();
    await viewer.waitFor({ state: 'hidden' });
    console.log('PASS memory sections: map and inspector, edit failure/retry and source dialog (HTTP fixtures)');
}

module.exports = { verifySettingsSections, verifyMemorySections };
