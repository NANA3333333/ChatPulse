const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = require('./server/db');
db.initDb();

// Insert dummy data
try {
    db.prepare("INSERT OR IGNORE INTO characters (id, name, api_endpoint, api_key, model_name, status) VALUES ('char1', 'TestChar', 'http://localhost:8080/v1', 'fake_key', 'gpt-3.5-turbo', 'active')").run();
    db.prepare("INSERT OR IGNORE INTO user_profile (id, name, private_msg_limit_for_group) VALUES ('default', 'User', 20)").run();
    db.prepare("INSERT OR IGNORE INTO group_chats (id, name, created_at) VALUES ('group1', 'Test Group', 12345)").run();
    db.prepare("INSERT OR IGNORE INTO group_members (group_id, member_id) VALUES ('group1', 'char1'), ('group1', 'user')").run();
} catch (e) { console.error("DB SEED ERROR", e); }

// Load the index module which mounts routes on app
// We must mock app.listen so it doesn't conflict
const originalListen = app.listen;
app.listen = function () { console.log('Mock listen called'); return { on: () => { } }; };

// Mock web socket clients
global.wsClients = new Set();
// We also need to intercept the export or execution of index.js.
// index.js creates its own app instance inside. So requiring it will boot its own server.
