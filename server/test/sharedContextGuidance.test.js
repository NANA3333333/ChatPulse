const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SHARED_CONTEXT_GUIDANCE, upgradeLegacySharedContext } = require("../features/conversation-context/guidance.js");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatpulse-shared-context-test-'));
process.env.CHATPULSE_DATA_DIR = dataDir;
require.cache[require.resolve("../platform/llm/client.js")] = { exports: { callLLM: async () => { throw new Error('Unexpected model call'); } } };
const { getUserDb } = require("../platform/db/userDatabase.js");
const { buildUniversalContext } = require("../features/conversation-context/index.js");
const db = getUserDb('shared-context-test');
const rawLog = '她说“那先休息吧”。我回“好”。当时有点困，后来已经休息过了。';
const rawGroup = '我说的只是计划，还没去。';
db.city = {
    getConfig: () => ({ city_self_log_limit: 5, city_global_log_limit: 0, city_announcement_limit: 0 }),
    getCharacterRecentLogs: () => [{ timestamp: 1789533000000, message: rawLog }],
    getEnabledDistricts: () => [{ id: 'park', name: '公园', type: 'leisure' }],
    getInventory: () => [],
    getDistrict: () => ({ name: '公园', type: 'leisure' })
};
db.getGroups = () => [{ id: 'group-1', name: '测试群', members: [{ member_id: 'shared-char' }] }];
db.getVisibleGroupMessages = () => [{ sender_id: 'user', content: rawGroup }];
db.getJealousyState = () => ({ active: true });
const character = { id: 'shared-char', name: '角色', location: 'park', city_status: 'working',
    city_reply_pending: 1, city_ignore_streak: 2, city_post_ignore_reaction: 1, work_distraction: 17 };
const context = { getUserDb: () => db, getMemory: () => ({}), userId: 'shared-context-test', skipModuleRouting: true };

test.after(() => {
    db.close();
    assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dataDir).startsWith('chatpulse-shared-context-test-'));
    fs.rmSync(dataDir, { recursive: true, force: true });
});

test('zero private window is respected by private, group and city contexts without removing emotion', async () => {
    const originalGetVisibleMessages = db.getVisibleMessages;
    let privateReads = 0;
    db.getVisibleMessages = () => { privateReads += 1; return [{ role: 'character', content: 'PRIVATE_HISTORY_SENTINEL' }]; };
    try {
        for (const mode of ['private', 'group', 'city']) {
            const result = await buildUniversalContext({ ...context, forceCityDetail: mode === 'city' },
                { ...character, context_msg_limit: 0, explicit_emotion_state: 'playful' }, '现在感觉怎么样', mode === 'group');
            assert.equal(privateReads, 0);
            assert.ok(!result.preamble.includes('PRIVATE_HISTORY_SENTINEL'));
            assert.ok(result.preamble.includes('playful'));
        }
    } finally {
        db.getVisibleMessages = originalGetVisibleMessages;
    }
});

for (const mode of ['private', 'group', 'city']) {
    test(`${mode} receives the same defaults while keeping data and output contracts separate`, async () => {
        const result = await buildUniversalContext({ ...context, forceCityDetail: mode === 'city' }, character, '现在感觉怎么样，群里呢', mode === 'group');
        assert.equal(result.systemGuidance, SHARED_CONTEXT_GUIDANCE);
        assert.equal(result.preamble, `${SHARED_CONTEXT_GUIDANCE}\n\n${result.contextPreamble}`);
        assert.equal(result.preamble.split(SHARED_CONTEXT_GUIDANCE).length - 1, 1);
        assert.ok(!result.contextPreamble.includes('[Shared Context Guidance'));
        assert.ok(!/必须默认这是在问|优先用第一人称口吻回答|用户此轮在问你的真实生活轨迹|这次不能立刻恢复平静|下次语气应更黏人|先按对方在乱讲话|回答顺序默认/.test(result.preamble));
        assert.ok(result.preamble.includes('连续 2 次主动联系未获回应；原因未记录。'));
        if (mode !== 'group') {
            assert.ok(result.preamble.includes('当前分心值=17/100'));
            assert.ok(result.preamble.includes(rawGroup));
        }
        if (mode === 'city') {
            assert.ok(result.preamble.includes(rawLog));
            assert.equal(result.moduleRoutes.city_detail, 1);
            assert.ok(result.preamble.includes('本次未提供') === false);
        }
        assert.ok(result.breakdown.base > 0);
    });
}

test('cached system guidance changes without rewriting city logs, group dialogue, or current values', () => {
    const cityTail = `\n【本人亲历记录】\n只把下面这些说成“我做过/我刚经历过”。\n- [昨天] ${rawLog}\n`;
    const old = 'Context:\n当前时间: 下午\n[时间行为约束]\n- 下午默认是日常交流节奏。\n'
        + '[嫉妒状态]: 强烈嫉妒已激活；语气可更尖锐、委屈、试探、索要独占关注。\n'
        + `[GROUP SOURCE RULES]\n用户刚刚提到了群聊或群里的事。你必须默认这是在问你亲眼见过的群聊经历。\n群聊《测试群》\n  - Nana: ${rawGroup}\n`
        + '[===== CITY SOURCE: 商业街（真实生活）实时世界线 =====]\n[商业街规则]\n[优先级]\n- 旧说明。\n'
        + '[可用商业街地点信号]\n- 公园 | id=park\n[商业街问答优先级]\n- 用户此轮在问你的真实生活轨迹；优先回答去过哪、做过什么、吃了什么、体力/钱包变化。\n'
        + cityTail + '[商业街执行规则]\n- 回答顺序默认先看【公告区】，再看【本人亲历记录】，最后看【公共事件 / 传闻】。\n';
    const updated = upgradeLegacySharedContext(old);
    assert.ok(updated.includes(rawLog));
    assert.ok(updated.includes(rawGroup));
    assert.ok(updated.includes('- 公园 | id=park'));
    assert.ok(!/用户此轮在问你的真实生活轨迹|必须默认这是在问|回答顺序默认/.test(updated));
    assert.equal(upgradeLegacySharedContext(updated), updated);
    assert.equal(upgradeLegacySharedContext(rawLog), rawLog);
});
