const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
let Database;
try {
    Database = require('better-sqlite3');
} catch (error) {
    Database = require(path.join(repoRoot, 'server', 'node_modules', 'better-sqlite3'));
}
const dataDir = path.join(repoRoot, 'data');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(dataDir, 'backups', `moments-removal-${stamp}`);
const shouldVacuum = !process.argv.includes('--no-vacuum');

function tableExists(db, tableName) {
    return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
}

function columnExists(db, tableName, columnName) {
    if (!tableExists(db, tableName)) return false;
    return db.prepare(`PRAGMA table_info("${tableName}")`).all().some((column) => column.name === columnName);
}

function dropColumnIfExists(db, tableName, columnName) {
    if (!columnExists(db, tableName, columnName)) return false;
    db.prepare(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`).run();
    return true;
}

async function cleanDatabase(dbPath) {
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, path.basename(dbPath));
    const db = new Database(dbPath);
    db.pragma('busy_timeout = 10000');

    await db.backup(backupPath);

    const stats = {
        database: dbPath,
        backup: backupPath,
        memoriesDeleted: 0,
        schedulerTasksDeleted: 0,
        cityConfigDeleted: 0,
        droppedTables: [],
        droppedColumns: []
    };

    const tx = db.transaction(() => {
        if (tableExists(db, 'memories')) {
            const info = db.prepare(`
                DELETE FROM memories
                WHERE lower(COALESCE(source_context, '')) = 'moment'
                   OR lower(COALESCE(scene_tag, '')) = 'moment'
                   OR lower(COALESCE(memory_type, '')) = 'moment'
            `).run();
            stats.memoriesDeleted = Number(info.changes || 0);
        }

        if (tableExists(db, 'scheduled_tasks')) {
            const info = db.prepare("DELETE FROM scheduled_tasks WHERE action_type = 'moment'").run();
            stats.schedulerTasksDeleted = Number(info.changes || 0);
        }

        if (tableExists(db, 'city_config')) {
            const info = db.prepare("DELETE FROM city_config WHERE key = 'city_moment_probability'").run();
            stats.cityConfigDeleted = Number(info.changes || 0);
        }

        for (const tableName of ['moment_likes', 'moment_comments', 'moments']) {
            if (tableExists(db, tableName)) {
                db.prepare(`DROP TABLE "${tableName}"`).run();
                stats.droppedTables.push(tableName);
            }
        }

        for (const [tableName, columnName] of [
            ['user_profile', 'moments_token_limit'],
            ['user_profile', 'moments_reaction_rate'],
            ['characters', 'last_moment_at']
        ]) {
            try {
                if (dropColumnIfExists(db, tableName, columnName)) {
                    stats.droppedColumns.push(`${tableName}.${columnName}`);
                }
            } catch (error) {
                stats.droppedColumns.push(`${tableName}.${columnName}: failed (${error.message})`);
            }
        }
    });

    tx();
    db.pragma('wal_checkpoint(TRUNCATE)');
    if (shouldVacuum) db.prepare('VACUUM').run();
    db.close();
    return stats;
}

async function main() {
    if (!fs.existsSync(dataDir)) {
        console.log(JSON.stringify({ ok: true, message: 'No data directory found.', backupDir: null, results: [] }, null, 2));
        return;
    }

    const dbFiles = fs.readdirSync(dataDir)
        .filter((name) => /^chatpulse_user_.+\.db$/.test(name))
        .map((name) => path.join(dataDir, name));

    const results = [];
    for (const dbPath of dbFiles) {
        results.push(await cleanDatabase(dbPath));
    }

    console.log(JSON.stringify({ ok: true, backupDir, results }, null, 2));
}

main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message, backupDir }, null, 2));
    process.exitCode = 1;
});
