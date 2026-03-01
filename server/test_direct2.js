const db = require('./db');
try {
    db.initDb();
    const group = db.getGroup('group1');
    if (!group) console.log("Group 1 not found! Creating...");
    try { db.prepare("INSERT OR IGNORE INTO characters (id, name, api_endpoint, api_key, model_name, status) VALUES ('char1', 'TestChar', 'http://localhost:8080/v1', 'fake_key', 'gpt-3.5-turbo', 'active')").run(); } catch (e) { console.error('insert char', e.message); }
    try { db.prepare("INSERT OR IGNORE INTO user_profile (id, name, private_msg_limit_for_group) VALUES ('default', 'User', 20)").run(); } catch (e) { console.error('insert user', e.message); }
    try { db.prepare("INSERT OR IGNORE INTO group_chats (id, name, created_at) VALUES ('group1', 'Test Group', 12345)").run(); } catch (e) { console.error('insert group', e.message); }
    try { db.prepare("INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES ('group1', 'char1'), ('group1', 'user')").run(); } catch (e) { console.error('insert member', e.message); }

    const index = require('./index');
    global.wsClients = new Set();
    const llmCache = require.cache[require.resolve('./llm')];
    if (llmCache) {
        const llm = require('./llm');
        llm.callLLM = async () => "Hello world";
    }

    index.triggerGroupAIChain('group1', global.wsClients, ['char1'], false, false);
} catch (e) {
    console.error("FATAL:", e);
}
