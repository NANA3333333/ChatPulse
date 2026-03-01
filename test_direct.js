const db = require('./server/db');
db.initDb();

const group = db.getGroup('group1');
if (!group) console.log("Group 1 not found! Creating...");
db.prepare("INSERT OR IGNORE INTO characters (id, name, api_endpoint, api_key, model_name, status) VALUES ('char1', 'TestChar', 'http://localhost:8080/v1', 'fake_key', 'gpt-3.5-turbo', 'active')").run();
db.prepare("INSERT OR IGNORE INTO user_profile (id, name, private_msg_limit_for_group) VALUES ('default', 'User', 20)").run();
db.prepare("INSERT OR IGNORE INTO group_chats (id, name, created_at) VALUES ('group1', 'Test Group', 12345)").run();
db.prepare("INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES ('group1', 'char1'), ('group1', 'user')").run();
for (let i = 0; i < 30; i++) {
    db.prepare('INSERT INTO messages (character_id, role, content, timestamp) VALUES (?, ?, ?, ?)').run('char1', 'user', 'hi ' + i, Date.now());
}

const index = require('./server/index');

index.triggerGroupAIChain('group1', [], ['char1'], false, false);
console.log("Called triggerGroupAIChain");
