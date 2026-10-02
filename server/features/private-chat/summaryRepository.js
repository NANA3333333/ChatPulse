// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getPrivateContextSummaries(characterId, limit = 3) {
        try {
            return dependencies.db.prepare(`
                SELECT *
                FROM private_context_summaries
                WHERE character_id = ?
                ORDER BY end_message_id DESC
                LIMIT ?
            `).all(String(characterId || ''), Math.max(1, Number(limit || 3) || 3)).reverse();
        } catch (e) {
            console.error('[DB] Error reading private context summaries:', e.message);
            return [];
        }
    }

function getLatestPrivateContextSummary(characterId) {
        try {
            return dependencies.db.prepare(`
                SELECT *
                FROM private_context_summaries
                WHERE character_id = ?
                ORDER BY end_message_id DESC
                LIMIT 1
            `).get(String(characterId || '')) || null;
        } catch (e) {
            console.error('[DB] Error reading latest private context summary:', e.message);
            return null;
        }
    }

function addPrivateContextSummary(entry = {}) {
        try {
            const now = Date.now();
            dependencies.db.prepare(`
                INSERT INTO private_context_summaries (
                    character_id, start_message_id, end_message_id, message_count,
                    summary_text, source_hash, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                String(entry.character_id || ''),
                Number(entry.start_message_id || 0),
                Number(entry.end_message_id || 0),
                Number(entry.message_count || 0),
                String(entry.summary_text || ''),
                String(entry.source_hash || ''),
                Number(entry.created_at || now),
                Number(entry.updated_at || now)
            );
            return true;
        } catch (e) {
            console.error('[DB] Error writing private context summary:', e.message);
            return false;
        }
    }

    return { getPrivateContextSummaries, getLatestPrivateContextSummary, addPrivateContextSummary };
}

module.exports = { createModule };
