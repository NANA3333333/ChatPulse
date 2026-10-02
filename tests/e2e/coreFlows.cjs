const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.resolve(__dirname, '../../client/package.json'))('playwright');
const { verifySettingsSections, verifyMemorySections } = require('./componentSections.cjs');

async function verifyCoreFlows(baseUrl) {
    const login = await fetch(baseUrl + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Nana', password: 'E2E-fixture-password-428' })
    }).then(r => r.json());
    const browser = await chromium.launch({ headless: true });
    let page;
    const errors = [];
    const open = async name => {
        page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(30000);
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', message => {
            if (message.type() === 'error' && /ReferenceError|TypeError|Maximum update depth|ErrorBoundary/.test(message.text())) errors.push(message.text());
        });
        await page.addInitScript(data => {
            localStorage.setItem('cp_token', data.token);
            localStorage.setItem('cp_user', JSON.stringify(data.user));
        }, login);
        await page.goto(baseUrl);
        await page.getByRole('button', { name, exact: true }).first().dblclick();
    };
    const api = route => fetch(baseUrl + '/api' + route, { headers: { Authorization: `Bearer ${login.token}` } }).then(r => r.json());
    try {
        await open('社交');
        let charFailure = true, releaseCharacter, onCharacterStarted;
        let charPosts = 0;
        await page.route('**/api/characters', async route => {
            if (route.request().method() !== 'POST') return route.continue();
            charPosts++;
            if (charFailure) return route.fulfill({ status: 503, json: { error: '角色创建测试失败' } });
            onCharacterStarted?.();
            await new Promise(resolve => { releaseCharacter = resolve; });
            return route.continue();
        });
        await page.getByRole('button', { name: '创建角色并进入私聊', exact: true }).click();
        const roleName = page.locator('input[required]').first();
        await roleName.fill('业务回归角色');
        const submit = page.locator('.dressup-submit-button');
        await submit.click();
        await page.getByRole('alert').filter({ hasText: '角色创建测试失败' }).waitFor();
        assert.equal(await roleName.inputValue(), '业务回归角色');
        charFailure = false;
        const started = new Promise(resolve => { onCharacterStarted = resolve; });
        await submit.click(); await started;
        assert.equal(await submit.isDisabled(), true);
        releaseCharacter();
        await submit.waitFor({ state: 'hidden' });
        assert.equal(charPosts, 2);
        assert.equal((await api('/characters')).filter(c => c.name === '业务回归角色').length, 1);
        console.log('PASS core UI: character creation failure, preserved input and duplicate-click guard');

        let groupFailure = true;
        await page.route('**/api/groups', route => route.request().method() === 'POST' && groupFailure
            ? route.fulfill({ status: 503, json: { error: '群聊创建测试失败' } }) : route.continue());
        await page.getByRole('button', { name: '创建群聊', exact: true }).click();
        const groupModal = page.locator('.create-group-modal');
        await groupModal.getByPlaceholder('群聊名称').fill('业务回归群聊');
        await groupModal.getByText('业务回归角色', { exact: true }).click();
        await groupModal.getByRole('button', { name: /创建 \(1 人\)/ }).click();
        await groupModal.getByRole('alert').waitFor();
        assert.equal(await groupModal.getByPlaceholder('群聊名称').inputValue(), '业务回归群聊');
        groupFailure = false;
        await groupModal.getByRole('button', { name: /创建 \(1 人\)/ }).click();
        await groupModal.waitFor({ state: 'hidden' });
        assert.equal((await api('/groups')).filter(g => g.name === '业务回归群聊').length, 1);
        await page.reload();
        await page.getByRole('button', { name: '社交', exact: true }).first().dblclick();
        await page.getByText('业务回归角色', { exact: true }).first().waitFor();
        await page.getByLabel('业务回归群聊，群聊', { exact: true }).first().click();
        await page.getByTitle('群管理 — 成员、AI 控制、危险操作').waitFor();
        await page.close();
        console.log('PASS core UI: create group failure/retry and refresh persistence');

        await open('设置');
        await page.getByRole('button', { name: /个人资料.*头像/ }).click();
        await page.locator('.settings-command-edit-profile').click();
        const profileName = page.locator('.settings-profile-edit').getByLabel('名称', { exact: true });
        await profileName.fill('回归测试用户');
        let profileFailure = true, holdProfile = true, onProfileStarted, releaseProfile;
        await page.route('**/api/user', async route => {
            if (route.request().method() !== 'POST') return route.continue();
            if (profileFailure) return route.fulfill({ status: 503, json: { error: '资料保存测试失败' } });
            if (holdProfile) {
                onProfileStarted?.();
                await new Promise(resolve => { releaseProfile = resolve; });
            }
            return route.continue();
        });
        const save = page.getByTitle('保存个人资料修改');
        await save.click();
        await page.getByRole('alert').filter({ hasText: '资料保存测试失败' }).waitFor();
        assert.equal(await profileName.inputValue(), '回归测试用户');
        profileFailure = false;
        const profileStarted = new Promise(resolve => { onProfileStarted = resolve; });
        await save.click(); await profileStarted;
        assert.equal(await save.isDisabled(), true);
        await profileName.fill('发送期间的新资料');
        holdProfile = false; releaseProfile();
        await page.waitForFunction(() => !document.querySelector('[title="保存个人资料修改"]')?.disabled);
        assert.equal(await profileName.inputValue(), '发送期间的新资料');
        await save.click();
        await profileName.waitFor({ state: 'hidden' });
        assert.equal((await api('/user')).name, '发送期间的新资料');
        await page.reload();
        await page.getByRole('button', { name: '设置', exact: true }).first().dblclick();
        await page.getByRole('button', { name: /个人资料.*头像/ }).click();
        await page.getByText('发送期间的新资料', { exact: true }).first().waitFor();
        await verifySettingsSections(page);
        await page.close();
        console.log('PASS core UI: profile failure/retry, in-flight edits and refresh persistence');

        await open('记忆库');
        const dialogs = [];
        page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
        // The provider output is a fixture; preview/commit failures exercise the real UI.
        let previewFailure = true;
        const preview = { success: true, import: { id: 987, source_app: 'chatgpt', import_mode: 'one_to_one' },
            role_tags: [{ name: '导入回归角色', confidence: 1 }],
            candidates: [{ content: '用户喜欢蓝色', summary: '颜色偏好', character_names: ['导入回归角色'] }] };
        await page.route('**/api/memory-import/external/preview', route => previewFailure
            ? route.fulfill({ status: 503, json: { error: '预览测试失败' } }) : route.fulfill({ json: preview }));
        await page.route('**/api/memory-import/external/987/commit', route => route.fulfill({ status: 503, json: { error: '写入测试失败' } }));
        await page.reload();
        await page.getByRole('button', { name: '记忆库', exact: true }).first().dblclick();
        await page.getByRole('button', { name: '维护工作台', exact: true }).click();
        await page.getByPlaceholder('https://api.openai.com/v1', { exact: true }).fill('http://fixture.invalid');
        await page.getByPlaceholder('sk-...', { exact: true }).fill('fixture-key');
        await page.getByPlaceholder('模型名称', { exact: true }).fill('fixture-model');
        const source = page.locator('.memory-external-import textarea').first();
        await source.fill('导入回归角色：用户喜欢蓝色。');
        await page.getByRole('button', { name: '总结预览', exact: true }).click();
        await page.waitForFunction(() => !document.body.innerText.includes('总结中'));
        assert.ok(dialogs.some(text => text.includes('预览测试失败')), JSON.stringify(dialogs));
        assert.equal(await source.inputValue(), '导入回归角色：用户喜欢蓝色。');
        previewFailure = false;
        await page.getByRole('button', { name: '总结预览', exact: true }).click();
        const commit = page.getByRole('button', { name: '创建角色并写入', exact: true });
        await commit.waitFor(); await commit.click();
        await commit.waitFor();
        assert.ok(dialogs.some(text => text.includes('写入测试失败')), JSON.stringify(dialogs));
        assert.equal(await source.inputValue(), '导入回归角色：用户喜欢蓝色。');
        assert.equal(await page.locator('.memory-external-role-tags .active').count(), 1);
        await verifyMemorySections(page);
        assert.deepEqual(errors, []);
        console.log('PASS core UI: external memory preview/commit failures preserve input and selected roles (provider fixture)');
    } catch (error) {
        if (errors.length) console.error('Core flow page errors:', errors);
        if (page && !page.isClosed()) {
            const output = path.resolve(__dirname, '../../.codex_tmp/core-flow-audit/core-ui-failure.txt');
            fs.mkdirSync(path.dirname(output), { recursive: true });
            fs.writeFileSync(output, await page.locator('body').innerText());
        }
        throw error;
    } finally { await browser.close(); }
}

module.exports = { verifyCoreFlows };
