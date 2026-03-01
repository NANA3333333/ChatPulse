const express = require('express');
const app = express();
app.use(express.json());

const db = require('./server/db');
db.initDb();
db.prepare("INSERT OR IGNORE INTO characters (id, name, api_endpoint, api_key, model_name) VALUES ('char1', 'TestChar', 'http://localhost:8080/v1', 'fake_key', 'gpt-3.5-turbo')").run();
db.prepare("INSERT OR IGNORE INTO user_profile (id, private_msg_limit_for_group) VALUES ('default', 20)").run();
db.prepare("INSERT OR IGNORE INTO group_chats (id, name, created_at) VALUES ('group1', 'Test Group', 12345)").run();
db.prepare("INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES ('group1', 'char1'), ('group1', 'user')").run();
for (let i = 0; i < 30; i++) {
    db.prepare('INSERT INTO messages (character_id, role, content, timestamp) VALUES (?, ?, ?, ?)').run('char1', 'user', 'hi ' + i, Date.now());
}

// Mock WebSocket array
const wsClients = [];

// Require index to attach routes to `app` (but we bypass listen to avoid port conflicts)
// index.js expects `server` to be exported or self-started. We'll simply require engine instead to avoid express boots.
const engine = require('./server/engine');
engine.triggerGroupProactive('group1', wsClients)
    .then(() => console.log('Proactive triggered successfully'))
    .catch(e => console.error('Error in proactive:', e));

// Now test triggerGroupAIChain directly
const index = require('./server/index');
// index exports nothing, it just binds routes. So we will mock an HTTP POST to it using supertest if needed.
// Actually, let's just copy the triggerGroupAIChain code block into our test instead of loading express routes to debug just that function.
