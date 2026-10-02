// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getMemories(characterId) {
        const rows = dependencies.db.prepare(`
            SELECT * FROM (
                SELECT
                    memories.*,
                    0 AS shared_binding,
                    '' AS bound_character_id,
                    '' AS bound_character_name
                FROM memories
                WHERE memories.character_id = ?
                UNION ALL
                SELECT
                    memories.*,
                    1 AS shared_binding,
                    external_memory_role_bindings.character_id AS bound_character_id,
                    external_memory_role_bindings.character_name AS bound_character_name
                FROM external_memory_role_bindings
                JOIN memories ON memories.id = external_memory_role_bindings.memory_id
                WHERE external_memory_role_bindings.character_id = ?
                  AND memories.character_id <> ?
            )
            ORDER BY
                COALESCE(updated_at, created_at) DESC,
                created_at DESC
        `).all(characterId, characterId, characterId);
        return rows.map(dependencies.normalizeMemoryRow);
    }

function getMemoriesByTimeRange(characterId, startTimestamp, endTimestamp, limit = 80) {
        const safeStart = Number(startTimestamp || 0);
        const safeEnd = Number(endTimestamp || 0);
        const safeLimit = Math.max(1, Math.min(200, Number(limit || 80) || 80));
        if (!characterId || safeStart <= 0 || safeEnd <= 0) return [];
        const rangeStart = Math.min(safeStart, safeEnd);
        const rangeEnd = Math.max(safeStart, safeEnd);
        const rows = dependencies.db.prepare(`
            SELECT * FROM memories
            WHERE character_id = ?
              AND COALESCE(is_archived, 0) = 0
              AND COALESCE(NULLIF(consolidation_summary, ''), '') <> ''
              AND COALESCE(source_started_at, created_at, 0) <= ?
              AND COALESCE(source_ended_at, source_started_at, created_at, 0) >= ?
            ORDER BY
                COALESCE(source_started_at, created_at) ASC,
                COALESCE(source_ended_at, source_started_at, created_at) ASC,
                created_at ASC
            LIMIT ?
        `).all(characterId, rangeEnd, rangeStart, safeLimit);
        return rows.map(dependencies.normalizeMemoryRow);
    }

function getMemory(id) {
        return dependencies.normalizeMemoryRow(dependencies.db.prepare('SELECT * FROM memories WHERE id = ?').get(id));
    }

function getMemoryByDedupeKey(characterId, dedupeKey) {
        if (!characterId || !dedupeKey) return null;
        return dependencies.normalizeMemoryRow(dependencies.db.prepare(`
            SELECT * FROM memories
            WHERE character_id = ? AND dedupe_key = ?
            ORDER BY COALESCE(updated_at, created_at) DESC
            LIMIT 1
        `).get(characterId, dedupeKey));
    }

function bindExternalMemoryToCharacters(importId, memoryId, characters = []) {
        const id = Number(memoryId || 0);
        if (!id || !Array.isArray(characters) || characters.length === 0) return { inserted: 0 };
        const now = Date.now();
        const stmt = dependencies.db.prepare(`
            INSERT OR IGNORE INTO external_memory_role_bindings
                (import_id, memory_id, character_id, character_name, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        let inserted = 0;
        const tx = dependencies.db.transaction((items) => {
            for (const item of items) {
                const characterId = String(item?.id || item?.character_id || '').trim();
                if (!characterId) continue;
                const info = stmt.run(
                    Number(importId || 0),
                    id,
                    characterId,
                    String(item?.name || item?.character_name || '').trim(),
                    now
                );
                inserted += Number(info.changes || 0);
            }
        });
        tx(characters);
        return { inserted };
    }

function addMemory(characterId, memoryData, groupId = null) {
        const now = Date.now();
        const peopleList = dependencies.normalizeArrayField(memoryData.people_json ?? memoryData.people, []);
        const itemList = dependencies.normalizeArrayField(memoryData.items_json ?? memoryData.items, []);
        const relationshipList = dependencies.normalizeRelationshipField(memoryData.relationship_json ?? memoryData.relationships, []);
        const sourceMessageIds = dependencies.normalizeArrayField(memoryData.source_message_ids_json, []);
        const summary = (memoryData.summary || memoryData.event || '').trim();
        const content = (memoryData.content || memoryData.event || summary).trim();
        const consolidationSummary = String(memoryData.consolidation_summary || summary || content || '').trim();
        const consolidationKey = String(memoryData.consolidation_key || memoryData.dedupe_key || '').trim();
        const sourceContext = String(memoryData.source_context || '').trim();
        const sceneTag = String(memoryData.scene_tag || '').trim();
        const sourceApp = String(memoryData.source_app || '').trim();
        const legacyPeople = (memoryData.people || peopleList.join(', ')).trim();
        const legacyItems = (memoryData.items || itemList.join(', ')).trim();
        const legacyRelationships = (memoryData.relationships || relationshipList.map(rel => {
            if (typeof rel === 'string') return rel;
            return rel.summary || rel.type || JSON.stringify(rel);
        }).join('; ')).trim();
        const info = dependencies.db.prepare(`
        INSERT INTO memories
        (character_id, time, location, people, event, relationships, items, importance, embedding, created_at, group_id, memory_type, summary, content, people_json, items_json, relationship_json, emotion, source_message_ids_json, dedupe_key, updated_at, is_archived, source_started_at, source_ended_at, source_time_text, source_message_count, memory_tier, memory_focus, consolidation_key, consolidation_summary, source_context, scene_tag, source_app)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            characterId,
            memoryData.time || '',
            memoryData.location || '',
            legacyPeople,
            memoryData.event || summary || content || '(empty memory)',
            legacyRelationships,
            legacyItems,
            memoryData.importance ?? 5,
            memoryData.embedding || null,
            now,
            groupId,
            memoryData.memory_type || 'event',
            summary,
            content,
            dependencies.stringifyJson(peopleList),
            dependencies.stringifyJson(itemList),
            dependencies.stringifyJson(relationshipList),
            memoryData.emotion || '',
            dependencies.stringifyJson(sourceMessageIds),
            memoryData.dedupe_key || '',
            memoryData.updated_at || now,
            Number(memoryData.is_archived || 0),
            Number(memoryData.source_started_at || 0),
            Number(memoryData.source_ended_at || 0),
            memoryData.source_time_text || '',
            Number(memoryData.source_message_count || sourceMessageIds.length || 0),
            memoryData.memory_tier || 'ambient',
            memoryData.memory_focus || 'general',
            consolidationKey,
            consolidationSummary,
            sourceContext,
            sceneTag,
            sourceApp
        );
        return info.lastInsertRowid;
    }

function updateMemory(id, memoryData) {
        const memoryId = Number(id);
        if (!Number.isSafeInteger(memoryId) || memoryId <= 0) {
            const error = new Error('Invalid memory id.');
            error.status = 400;
            throw error;
        }
        const patch = { ...memoryData };
        if (Object.prototype.hasOwnProperty.call(patch, 'people_json') || Object.prototype.hasOwnProperty.call(patch, 'people')) {
            const peopleList = dependencies.normalizeArrayField(patch.people_json ?? patch.people, []);
            patch.people_json = dependencies.stringifyJson(peopleList);
            patch.people = patch.people || peopleList.join(', ');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'items_json') || Object.prototype.hasOwnProperty.call(patch, 'items')) {
            const itemList = dependencies.normalizeArrayField(patch.items_json ?? patch.items, []);
            patch.items_json = dependencies.stringifyJson(itemList);
            patch.items = patch.items || itemList.join(', ');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'relationship_json') || Object.prototype.hasOwnProperty.call(patch, 'relationships')) {
            const relationshipList = dependencies.normalizeRelationshipField(patch.relationship_json ?? patch.relationships, []);
            patch.relationship_json = dependencies.stringifyJson(relationshipList);
            patch.relationships = patch.relationships || relationshipList.map(rel => {
                if (typeof rel === 'string') return rel;
                return rel.summary || rel.type || JSON.stringify(rel);
            }).join('; ');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'source_message_ids_json')) {
            patch.source_message_ids_json = dependencies.stringifyJson(dependencies.normalizeArrayField(patch.source_message_ids_json, []));
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'summary') || Object.prototype.hasOwnProperty.call(patch, 'content') || Object.prototype.hasOwnProperty.call(patch, 'event')) {
            const summary = (patch.summary || patch.event || '').trim();
            const content = (patch.content || patch.event || summary).trim();
            if (summary) {
                patch.summary = summary;
                patch.event = patch.event || summary;
            }
            if (content) {
                patch.content = content;
            }
        }
        const allowedFields = dependencies.getAllowedMemoryUpdateFields(patch);
        patch.updated_at = patch.updated_at || Date.now();
        const fields = Array.from(new Set([...allowedFields, 'updated_at']))
            .filter(field => dependencies.MEMORY_UPDATE_COLUMNS.has(field));
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => patch[f]);
        return dependencies.db.prepare(`UPDATE memories SET ${setClause} WHERE id = ?`).run(...values, memoryId);
    }

function deleteMemory(id) {
        dependencies.db.prepare('DELETE FROM external_memory_role_bindings WHERE memory_id = ?').run(id);
        dependencies.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    }

function markMemoriesRetrieved(memoryIds = []) {
        const ids = (memoryIds || []).filter(Boolean);
        if (ids.length === 0) return;
        const now = Date.now();
        const stmt = dependencies.db.prepare(`
            UPDATE memories
            SET last_retrieved_at = ?, retrieval_count = COALESCE(retrieval_count, 0) + 1
            WHERE id = ?
        `);
        const tx = dependencies.db.transaction((rows) => {
            for (const id of rows) stmt.run(now, id);
        });
        tx(ids);
    }

    return { getMemories, getMemoriesByTimeRange, getMemory, getMemoryByDedupeKey, bindExternalMemoryToCharacters, addMemory, updateMemory, deleteMemory, markMemoriesRetrieved };
}

module.exports = { createModule };
