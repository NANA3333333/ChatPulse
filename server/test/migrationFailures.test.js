const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { upgrade1 } = require('../features/characters/migrations/legacy');
const { upgrade18, upgrade22 } = require('../features/account/migrations/legacy');

test('legacy column upgrades still allow repeated runs but propagate disk and readonly errors', () => {
    const db = new Database(':memory:');
    try {
        db.exec('CREATE TABLE characters(id TEXT)');
        upgrade1({ dependencies: { db } });
        upgrade1({ dependencies: { db } });
        const columns = db
            .prepare('PRAGMA table_info(characters)')
            .all()
            .map((row) => row.name);
        assert.ok(columns.includes('system_prompt'));
    } finally {
        db.close();
    }
    for (const code of ['SQLITE_IOERR', 'SQLITE_READONLY', 'SQLITE_CORRUPT', 'SQLITE_BUSY']) {
        const failure = Object.assign(new Error(code), { code });
        assert.throws(
            () =>
                upgrade1({
                    dependencies: {
                        db: {
                            prepare() {
                                throw failure;
                            },
                        },
                    },
                }),
            (error) => error === failure,
        );
    }
});

test('obsolete profile settings are optional and removed idempotently', () => {
    const db = new Database(':memory:');
    try {
        db.exec('CREATE TABLE user_profile(id TEXT, theme TEXT)');
        upgrade18({ dependencies: { db } });
        upgrade22({ dependencies: { db } });
        upgrade22({ dependencies: { db } });
        assert.deepEqual(
            db
                .prepare('PRAGMA table_info(user_profile)')
                .all()
                .map((row) => row.name),
            ['id'],
        );
    } finally {
        db.close();
    }
});
