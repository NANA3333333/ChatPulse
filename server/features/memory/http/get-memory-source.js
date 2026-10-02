const { parseMemorySourceIds, inferMemorySourceContext, inferMemorySceneTag } = require("../maintenance/index.js");
// GET /api/memory-source
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memory-source', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memory-source"), dependencies.authMiddleware, (req, res) => {
    try {
        const rawDb = typeof req.db.getRawDb === 'function' ? req.db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const memoryIds = Array.from(new Set(String(req.query.ids || req.query.memory_ids || '')
            .split(/[,\s]+/)
            .map(id => Number(id || 0))
            .filter(id => id > 0)))
            .slice(0, 120);
        if (memoryIds.length === 0) {
            return res.status(400).json({ error: 'ids query parameter is required.' });
        }

        const memoryStmt = rawDb.prepare(`
            SELECT id, character_id, summary, content, event, consolidation_key, consolidation_summary,
                   source_message_ids_json, source_started_at, source_ended_at, source_time_text,
                   source_message_count, source_context, scene_tag, source_app, created_at, updated_at
            FROM memories
            WHERE id = ?
        `);
        const memories = [];
        const missingMemoryIds = [];
        const sourceRefByKey = new Map();
        const memoryIdsBySourceKey = new Map();

        for (const id of memoryIds) {
            const row = memoryStmt.get(id);
            if (!row) {
                missingMemoryIds.push(id);
                continue;
            }
            const refs = parseMemorySourceIds(row.source_message_ids_json)
                .map(dependencies.normalizeMemorySourceRef)
                .filter(ref => ref.raw)
                .slice(0, 320);
            const sourceKeys = [];
            for (const ref of refs) {
                sourceKeys.push(ref.key);
                if (!sourceRefByKey.has(ref.key)) sourceRefByKey.set(ref.key, ref);
                if (!memoryIdsBySourceKey.has(ref.key)) memoryIdsBySourceKey.set(ref.key, []);
                memoryIdsBySourceKey.get(ref.key).push(row.id);
            }
            memories.push({
                id: row.id,
                character_id: row.character_id,
                summary: row.consolidation_summary || row.summary || row.content || row.event || '',
                legacy_summary: row.summary || row.content || row.event || '',
                consolidation_key: row.consolidation_key || '',
                source_context: inferMemorySourceContext(row),
                scene_tag: inferMemorySceneTag(row),
                source_time_text: row.source_time_text || '',
                source_started_at: Number(row.source_started_at || 0),
                source_ended_at: Number(row.source_ended_at || 0),
                source_message_count: Number(row.source_message_count || refs.length || 0),
                source_refs: sourceKeys
            });
        }

        const sources = dependencies.buildMemorySourcePayload(rawDb, Array.from(sourceRefByKey.values()))
            .map(source => ({
                ...source,
                memory_ids: Array.from(new Set(memoryIdsBySourceKey.get(source.source_key) || []))
            }))
            .sort((a, b) => {
                const foundDiff = Number(b.found === true) - Number(a.found === true);
                if (foundDiff !== 0) return foundDiff;
                const timeDiff = Number(a.timestamp || 0) - Number(b.timestamp || 0);
                if (timeDiff !== 0) return timeDiff;
                return String(a.source_key || '').localeCompare(String(b.source_key || ''));
            });

        res.json({
            success: true,
            requested_memory_ids: memoryIds,
            missing_memory_ids: missingMemoryIds,
            memories,
            sources,
            stats: {
                memory_count: memories.length,
                source_ref_count: sourceRefByKey.size,
                found_source_count: sources.filter(source => source.found).length,
                missing_source_count: sources.filter(source => !source.found).length
            }
        });
    } catch (e) {
        console.error('Memory source lookup failed:', e);
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
