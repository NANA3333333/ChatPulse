// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function ensureQueryIndexes() {
        const statements = [
            'CREATE INDEX IF NOT EXISTS idx_messages_character_id_id ON messages(character_id, id DESC)',
            'CREATE INDEX IF NOT EXISTS idx_memories_character_id_id ON memories(character_id, id DESC)',
            'CREATE INDEX IF NOT EXISTS idx_memories_character_archive_id ON memories(character_id, is_archived, id DESC)',
            'CREATE INDEX IF NOT EXISTS idx_emotion_logs_character_id_id ON emotion_logs(character_id, id DESC)',
            'CREATE INDEX IF NOT EXISTS idx_llm_debug_logs_character_id_id ON llm_debug_logs(character_id, id DESC)',
            'CREATE INDEX IF NOT EXISTS idx_llm_debug_logs_character_context_id ON llm_debug_logs(character_id, direction, context_type, id DESC)',
            'CREATE INDEX IF NOT EXISTS idx_token_usage_character_id_id ON token_usage(character_id, id DESC)',
            'CREATE INDEX IF NOT EXISTS idx_token_usage_character_context ON token_usage(character_id, context_type)'
        ];
        for (const statement of statements) {
            try {
                dependencies.db.prepare(statement).run();
            } catch (e) {
                console.warn(`[DB] Failed to ensure index: ${e.message}`);
            }
        }
    }

function quoteSqlIdentifier(identifier) {
        const value = String(identifier || '');
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
            throw new Error(`Invalid SQLite identifier: ${value}`);
        }
        return `"${value}"`;
    }

function getTableColumnNames(tableName) {
        const safeTableName = quoteSqlIdentifier(tableName);
        return new Set(dependencies.db.prepare(`PRAGMA table_info(${safeTableName})`).all().map((col) => col.name));
    }

function addColumnIfMissing(tableName, columnName, definition) {
        const columns = getTableColumnNames(tableName);
        if (columns.has(columnName)) return false;
        const safeTableName = quoteSqlIdentifier(tableName);
        const safeColumnName = quoteSqlIdentifier(columnName);
        dependencies.db.prepare(`ALTER TABLE ${safeTableName} ADD COLUMN ${safeColumnName} ${definition}`).run();
        return true;
    }

function getSqliteSizeStats() {
        try {
            const pageCount = Number(dependencies.db.prepare('PRAGMA page_count').get()?.page_count || 0);
            const freelistCount = Number(dependencies.db.prepare('PRAGMA freelist_count').get()?.freelist_count || 0);
            const pageSize = Number(dependencies.db.prepare('PRAGMA page_size').get()?.page_size || 0);
            return {
                pageCount,
                freelistCount,
                pageSize,
                fileBytes: pageCount * pageSize,
                reusableFreeBytes: freelistCount * pageSize
            };
        } catch (e) {
            return { pageCount: 0, freelistCount: 0, pageSize: 0, fileBytes: 0, reusableFreeBytes: 0 };
        }
    }

function runStartupVacuumIfRequested() {
        if (!dependencies.fs.existsSync(dependencies.startupVacuumMarkerPath)) return;

        try {
            const before = getSqliteSizeStats();
            if (before.reusableFreeBytes < dependencies.DB_STARTUP_VACUUM_MIN_FREE_BYTES) {
                dependencies.fs.rmSync(dependencies.startupVacuumMarkerPath, { force: true });
                console.log('[DB] Startup VACUUM skipped: not enough reusable free space.');
                return;
            }

            console.warn(
                `[DB] Startup VACUUM requested for ${dependencies.path.basename(dependencies.dbPath)}. ` +
                `Reusable free space: ${Math.round(before.reusableFreeBytes / 1024 / 1024)}MB.`
            );
            dependencies.db.pragma('wal_checkpoint(TRUNCATE)');
            dependencies.db.exec('VACUUM');
            dependencies.db.pragma('wal_checkpoint(TRUNCATE)');
            dependencies.fs.rmSync(dependencies.startupVacuumMarkerPath, { force: true });

            const after = getSqliteSizeStats();
            console.warn(
                `[DB] Startup VACUUM complete. File pages: ${before.pageCount} -> ${after.pageCount}; ` +
                `file size approx ${Math.round(before.fileBytes / 1024 / 1024)}MB -> ${Math.round(after.fileBytes / 1024 / 1024)}MB.`
            );
        } catch (e) {
            console.error('[DB] Startup VACUUM failed:', e.message);
        }
    }

function initDb() {
        require('./schemaRegistry').initializeSchemas(dependencies.db);
        addColumnIfMissing('pixel_behavior_tree_states', 'revision', 'INTEGER NOT NULL DEFAULT 0');

        // Add system_prompt for existing DBs (Migration)
        require("../../features/characters/migrations/legacy.js").upgrade1({ get dependencies() { return dependencies; } });

        // Add created_at for newly created characters. Existing characters keep 0 so the UI can be honest.
        

        // Add emoji for existing DBs (Migration)
        

        // Add joined_at for group_members (Migration)
        require("../../features/group-chat/migrations/legacy.js").upgrade2({ get dependencies() { return dependencies; } });

        // Add banner for existing DBs
        require("../../features/account/migrations/legacy.js").upgrade3({ get dependencies() { return dependencies; } });

        // Add context_msg_limit for group_chats
        require("../../features/group-chat/migrations/legacy.js").upgrade4({ get dependencies() { return dependencies; } });

        // Memory retrieval stats
        require("../../features/memory/migrations/legacy.js").upgrade5({ get dependencies() { return dependencies; } });
        

        // Add initial_affinity for existing DBs (migration for the chat wipe bug)
        require("../../features/characters/migrations/legacy.js").upgrade6({ get addColumnIfMissing() { return addColumnIfMissing; }, get dependencies() { return dependencies; } });
        

        // Add max_tokens for existing DBs
        

        // Add is_blocked for older DBs
        

        // Add impression_q_limit for existing DBs
        

        // Add context_msg_limit for characters
        

        // Add master toggles for systems

        // Add is_diary_unlocked to characters
        

        // Add sweep_limit to characters
        

        // Existing characters should start W from zero after upgrade; new characters default to initialized

        // Add diary_password to characters (password-lock mechanic)
        

        // Add hidden_state to characters (hybrid context mechanic)
        

        // --- Data Migration: Backfill char_impression_history ---
        require("../../features/relationships/migrations/legacy.js").upgrade7({ get dependencies() { return dependencies; } });

        // Add hidden column to messages (context hide mechanic)
        require("../../features/private-chat/migrations/legacy.js").upgrade8({ get dependencies() { return dependencies; }, get addColumnIfMissing() { return addColumnIfMissing; } });

        // Add metadata column to messages (memory visualization)
        

        // Add is_summarized for overflow memory feature
        
        require("../../features/group-chat/migrations/legacy.js").upgrade9({ get addColumnIfMissing() { return addColumnIfMissing; } });

        // Add memory API config for existing DBs
        require("../../features/characters/migrations/legacy.js").upgrade10({ get addColumnIfMissing() { return addColumnIfMissing; } });

        // Add per-character private-chat TTS config

        // Add sender_name and sender_avatar to group_messages (so deleted chars still display)
        const { msgs } = require("../../features/group-chat/migrations/legacy.js").upgrade11({ get addColumnIfMissing() { return addColumnIfMissing; }, get dependencies() { return dependencies; } });
        
        // Backfill existing records
        
        require("../../features/account/migrations/legacy.js").upgrade12({ get msgs() { return msgs; }, get dependencies() { return dependencies; } });

        require("../../features/characters/migrations/legacy.js").upgrade13({ get dependencies() { return dependencies; } });
        

        // Migrate old max_tokens=800 (old default) to 2000
        

        // Upgrade memories table for structured long-term memory storage
        require("../../features/memory/migrations/legacy.js").upgrade14({ get dependencies() { return dependencies; } });

        // Add hidden column to group_messages (context hide mechanic)
        require("../../features/group-chat/migrations/legacy.js").upgrade15({ get dependencies() { return dependencies; } });

        // Add metadata column to group_messages (memory visualization)
        

        // Add group_msg_limit to user_profile for controlling group context injection
        require("../../features/account/migrations/legacy.js").upgrade16({ get dependencies() { return dependencies; } });

        // Add private_msg_limit_for_group to user_profile for controlling dual-layer memory injection size
        

        // Add per-group proactive settings.
        require("../../features/group-chat/migrations/legacy.js").upgrade17({ get dependencies() { return dependencies; } });

        // Move the retired global group proactive setting onto existing groups.
        require("../../features/account/migrations/legacy.js").upgrade18({ get dependencies() { return dependencies; } });

        // Add wallet fields
        require("../../features/characters/migrations/legacy.js").upgrade19({ get dependencies() { return dependencies; } });
        require("../../features/account/migrations/legacy.js").upgrade20({ get dependencies() { return dependencies; } });
        // Ensure existing users start at 520 if null
        

        // Add refunded column to private_transfers (for refund feature)
        require("../../features/economy/migrations/legacy.js").upgrade21({ get dependencies() { return dependencies; } });

        // Remove retired theme editor fields from older user databases when SQLite supports it.
        require("../../features/account/migrations/legacy.js").upgrade22({ get dependencies() { return dependencies; } });

        require("../../features/characters/migrations/legacy.js").upgrade23({ get dependencies() { return dependencies; } });
        require("../../features/account/migrations/legacy.js").upgrade24({ get dependencies() { return dependencies; } });
        

        // Add per-group inject_limit (how many messages from this group get injected into private/other group contexts)
        require("../../features/group-chat/migrations/legacy.js").upgrade25({ get dependencies() { return dependencies; } });

        require("../../features/account/migrations/legacy.js").upgrade26({ get dependencies() { return dependencies; } });

        // Enhanced jealousy system
        require("../../features/characters/migrations/legacy.js").upgrade27({ get dependencies() { return dependencies; }, get addColumnIfMissing() { return addColumnIfMissing; } });

        // City DLC: per-character toggle for city event notifications to private chat
        
        
        // City DLC: schedule & activity frequency

        // Character Base Stats

        require("../llm/migrations/legacy.js").upgrade28({ get dependencies() { return dependencies; } });

        require("../../features/conversation-context/migrations/legacy.js").upgrade29({ get dependencies() { return dependencies; } });

        dependencies.enforceLlmDebugLogRetention({ force: true });
        ensureQueryIndexes();
        runStartupVacuumIfRequested();

        console.log('[DB] Database initialized successfully.');
    }

    return { ensureQueryIndexes, quoteSqlIdentifier, getTableColumnNames, addColumnIfMissing, getSqliteSizeStats, runStartupVacuumIfRequested, initDb };
}

module.exports = { createModule };
