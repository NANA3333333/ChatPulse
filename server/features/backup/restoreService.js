const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function validateDatabase(filePath) {
    let db;
    try {
        db = new Database(filePath, { readonly: true, fileMustExist: true });
        const integrity = db.pragma('quick_check');
        if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok')
            throw new Error('SQLite integrity check failed');
        db.prepare('SELECT id, name FROM characters LIMIT 1').all();
        db.prepare('SELECT id, character_id, role, content FROM messages LIMIT 1').all();
    } catch (error) {
        throw Object.assign(new Error(`Invalid ChatPulse archive: ${error.message}`), { statusCode: 400 });
    } finally {
        db?.close();
    }
}

function planUploads(source, uploadsRoot, userId, io = fs) {
    if (!source || !io.existsSync(source)) return [];
    const root = path.resolve(uploadsRoot);
    const result = [],
        targets = new Set();
    const walk = (directory, parts = []) => {
        for (const entry of io.readdirSync(directory, { withFileTypes: true })) {
            if (entry.name === 'temp') continue;
            const relative = [...parts, entry.name];
            const file = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) throw new Error('Archive upload links are not supported');
            if (entry.isDirectory()) {
                walk(file, relative);
                continue;
            }
            if (relative[0] === 'users' && relative.length < 3) throw new Error('Invalid archive user upload path');
            const mapped = relative[0] === 'users' ? ['users', String(userId), ...relative.slice(2)] : relative;
            const target = path.resolve(root, ...mapped);
            if (!target.startsWith(root + path.sep) || targets.has(target))
                throw new Error('Invalid or ambiguous archive upload path');
            targets.add(target);
            result.push({ source: file, target });
        }
    };
    walk(source);
    return result;
}

function createRestoreService(dependencies, io = fs) {
    const activeRestores = new Set();
    return async function restore({ userId, db, sourcePath, uploadsPath }) {
        if (activeRestores.has(userId))
            throw Object.assign(new Error('Archive restore is already running.'), { statusCode: 409 });
        activeRestores.add(userId);
        try {
            const oldEngine = dependencies.engineCache.get(userId);
            const queued = dependencies.getBackgroundQueueStats({ userId }).queues;
            if (oldEngine?.isBusy?.() || queued.some((queue) => queue.running || queue.pending)) {
                throw Object.assign(
                    new Error('Wait for active conversations and background tasks to finish before restoring.'),
                    { statusCode: 409 },
                );
            }
            const dbPath = db.getDbPath();
            const release = dependencies.beginUserDbMaintenance(userId);
            let workDir,
                closed = false,
                displaced = false,
                installed = false,
                keepRecovery = false;
            let restoredDb,
                stopped = false;
            const appliedUploads = [];
            let oldCharacters = [];
            let restoredCharacters = [];
            const warnings = [];
            const resume = () => {
                if (!stopped || !oldEngine) return;
                const engine = dependencies.getEngine(userId);
                engine.startEngine(dependencies.getWsClients(userId));
                engine.startGroupProactiveTimers(dependencies.getWsClients(userId));
            };
            try {
                oldCharacters = db.getCharacters();
                workDir = io.mkdtempSync(path.join(path.dirname(dbPath), '.restore-'));
                const stagedDb = path.join(workDir, 'incoming.db');
                io.copyFileSync(sourcePath, stagedDb);
                validateDatabase(stagedDb);
                const uploads = planUploads(uploadsPath, dependencies.uploadsDir, userId, io);
                for (const [index, item] of uploads.entries()) {
                    item.backup = path.join(workDir, `upload-${index}`);
                    item.existed = io.existsSync(item.target);
                    if (item.existed) io.copyFileSync(item.target, item.backup);
                }
                // No index or user file has been changed yet. A backup failure is fatal.
                oldEngine?.stopAllTimers();
                stopped = true;
                dependencies.closeSchedulerDb(userId);
                await db.backup(path.join(workDir, 'snapshot.db'));
                db.close();
                closed = true;
                dependencies.userDbCache.delete(userId);
                for (const suffix of ['-wal', '-shm'])
                    if (io.existsSync(dbPath + suffix)) io.unlinkSync(dbPath + suffix);
                io.renameSync(dbPath, path.join(workDir, 'original.db'));
                displaced = true;
                io.renameSync(stagedDb, dbPath);
                installed = true;
                for (const item of uploads) {
                    appliedUploads.push(item); // Include a partially copied file in rollback.
                    io.mkdirSync(path.dirname(item.target), { recursive: true });
                    io.copyFileSync(item.source, item.target);
                }
                restoredDb = dependencies.getUserDb(userId, { maintenance: true });
                restoredCharacters = restoredDb.getCharacters();
            } catch (error) {
                try {
                    if (closed) {
                        restoredDb?.close();
                        dependencies.userDbCache.delete(userId);
                        for (const suffix of ['-wal', '-shm'])
                            if (io.existsSync(dbPath + suffix)) io.unlinkSync(dbPath + suffix);
                        if (displaced) {
                            if (installed && io.existsSync(dbPath)) io.unlinkSync(dbPath);
                            io.renameSync(path.join(workDir, 'original.db'), dbPath);
                        }
                        for (const item of appliedUploads.reverse()) {
                            if (item.existed) io.copyFileSync(item.backup, item.target);
                            else if (io.existsSync(item.target)) io.unlinkSync(item.target);
                        }
                        dependencies.getUserDb(userId, { maintenance: true });
                        dependencies.engineCache.delete(userId);
                    }
                } catch (rollbackError) {
                    keepRecovery = true;
                    console.error('[Backup] Rollback failed; recovery files retained:', workDir, rollbackError);
                    error = Object.assign(
                        new Error(
                            'Restore and automatic rollback failed. Recovery files have been retained; see the server error log.',
                        ),
                        { cause: error },
                    );
                }
                if (!keepRecovery) {
                    release();
                    try {
                        resume();
                    } catch (resumeError) {
                        console.error('[Backup] Worker restart failed after rollback:', resumeError);
                    }
                }
                throw error;
            } finally {
                // Failed rollback stays unavailable so the next request cannot create an empty DB.
                // Recovery files must be restored before restarting the server.
                if (!keepRecovery) release();
                if (workDir && !keepRecovery) {
                    try {
                        io.rmSync(workDir, { recursive: true, force: true });
                    } catch (error) {
                        console.warn('[Backup] Could not remove restore staging files:', workDir, error);
                    }
                }
            }

            // Core data is committed. Index rebuilding is a recoverable follow-up, not a failed restore.
            try {
                dependencies.clearMemoryCache(userId);
                dependencies.engineCache.delete(userId);
                const memory = dependencies.getMemory(userId);
                for (const id of new Set([...oldCharacters, ...restoredCharacters].map((character) => character.id))) {
                    try {
                        await memory.wipeIndex(id);
                    } catch (error) {
                        warnings.push({ stage: 'clear_index', characterId: id, error: error.message });
                    }
                }
                let rebuilt = 0;
                for (const character of restoredCharacters) {
                    try {
                        await memory.rebuildIndex(character.id);
                        rebuilt++;
                    } catch (error) {
                        warnings.push({ stage: 'rebuild_index', characterId: character.id, error: error.message });
                    }
                }
                try {
                    resume();
                } catch (error) {
                    warnings.push({ stage: 'restart_workers', error: error.message });
                }
                return {
                    success: true,
                    restoredCharacters: restoredCharacters.length,
                    rebuiltMemoryIndexes: rebuilt,
                    warnings,
                };
            } catch (error) {
                warnings.push({ stage: 'initialize_indexes', error: error.message });
                try {
                    resume();
                } catch (resumeError) {
                    warnings.push({ stage: 'restart_workers', error: resumeError.message });
                }
                return {
                    success: true,
                    restoredCharacters: restoredCharacters.length,
                    rebuiltMemoryIndexes: 0,
                    warnings,
                };
            }
        } finally {
            activeRestores.delete(userId);
        }
    };
}

module.exports = { createRestoreService, validateDatabase, planUploads };
