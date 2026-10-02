const test = require('node:test');
const assert = require('node:assert/strict');
const { register } = require('../features/group-chat/http/post-groups-id-messages');

function fixture({ failSave = false } = {}) {
    let handler;
    const saved = [];
    register({
        app: { post: (...args) => { handler = args.at(-1); } },
        authMiddleware() {},
        getUserDb: () => ({
            getGroup: () => ({ id: 'group', name: 'Group', members: [] }),
            getUserProfile: () => ({ name: 'User' }),
            addGroupMessage: (id, sender, content) => {
                if (failSave) throw new Error('Storage unavailable');
                saved.push(content); return saved.length;
            }
        }),
        getWsClients: () => [{ readyState: 1, send() { throw new Error('Socket closed during broadcast'); } }]
    });
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    return { saved, response, run: content => handler({ user: { id: 'test-user' }, params: { id: 'group' }, body: { content } }, response) };
}

test('a group broadcast failure still acknowledges the durably saved message', async () => {
    const f = fixture();
    await f.run('Saved message');
    assert.equal(f.response.statusCode, 200);
    assert.equal(f.response.body.message.content, 'Saved message');
    assert.deepEqual(f.response.body.warnings, ['GROUP_POST_SAVE_FAILED']);
    assert.deepEqual(f.saved, ['Saved message']);
});

test('a group storage failure does not acknowledge a saved message', async () => {
    const f = fixture({ failSave: true });
    await f.run('Unsaved message');
    assert.equal(f.response.statusCode, 500);
    assert.equal(f.response.body.message, undefined);
    assert.deepEqual(f.saved, []);
});
