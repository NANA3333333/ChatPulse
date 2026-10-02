// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function addEmotionLog(entry) {
        const stmt = dependencies.db.prepare(`
            INSERT INTO emotion_logs (
                character_id, source, reason, old_state, new_state,
                old_mood, new_mood, old_stress, new_stress,
                old_social_need, new_social_need,
                old_pressure, new_pressure,
                old_jealousy, new_jealousy,
                timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const ts = entry.timestamp || Date.now();
        stmt.run(
            entry.character_id,
            entry.source || 'system',
            entry.reason || '',
            entry.old_state || '',
            entry.new_state || '',
            entry.old_mood ?? null,
            entry.new_mood ?? null,
            entry.old_stress ?? null,
            entry.new_stress ?? null,
            entry.old_social_need ?? null,
            entry.new_social_need ?? null,
            entry.old_pressure ?? null,
            entry.new_pressure ?? null,
            entry.old_jealousy ?? null,
            entry.new_jealousy ?? null,
            ts
        );
        return ts;
    }

function getEmotionLogs(characterId, limit = 50) {
        const safeLimit = dependencies.normalizeSqlLimit(limit, 50, 100);
        return dependencies.db.prepare('SELECT * FROM emotion_logs WHERE character_id = ? ORDER BY id DESC LIMIT ?')
            .all(characterId, safeLimit);
    }

    return { addEmotionLog, getEmotionLogs };
}

module.exports = { createModule };
