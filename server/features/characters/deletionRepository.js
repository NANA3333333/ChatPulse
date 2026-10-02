// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function runOptionalDelete(sql, ...params) {
        try {
            return dependencies.db.prepare(sql).run(...params).changes || 0;
        } catch (e) {
            return 0;
        }
    }

function deleteExternalKnowledgeDocsForCharacter(characterId) {
        let changes = 0;
        let docIds = [];
        try {
            docIds = dependencies.db.prepare('SELECT id FROM external_knowledge_docs WHERE character_id = ?').all(characterId).map(row => row.id);
        } catch (e) {
            return 0;
        }
        if (docIds.length > 0) {
            const placeholders = docIds.map(() => '?').join(', ');
            changes += runOptionalDelete(`DELETE FROM external_knowledge_chunks WHERE doc_id IN (${placeholders})`, ...docIds);
        }
        changes += runOptionalDelete('DELETE FROM external_knowledge_docs WHERE character_id = ?', characterId);
        return changes;
    }

function deleteCharacterAttachedRows(characterId) {
        const id = String(characterId || '').trim();
        if (!id) return 0;
        let changes = 0;
        changes += runOptionalDelete('DELETE FROM message_tts WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM message_tts WHERE message_id IN (SELECT id FROM messages WHERE character_id = ?)', id);
        changes += runOptionalDelete('DELETE FROM emotion_logs WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM llm_debug_logs WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM reply_dispatch_logs WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM token_usage WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM private_context_summaries WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM llm_cache WHERE character_id = ? OR cache_scope = ?', id, `character:${id}`);
        changes += runOptionalDelete('DELETE FROM scheduled_tasks WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM city_logs WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM city_inventory WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM city_schedules WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM city_action_guard WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM city_quest_progress_reviews WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM city_quest_claims WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM social_housing_bindings WHERE character_id = ?', id);
        changes += runOptionalDelete('DELETE FROM social_housing_rental_chain_events WHERE chain_id IN (SELECT id FROM social_housing_rental_chains WHERE character_id = ?)', id);
        changes += runOptionalDelete('DELETE FROM social_housing_rental_chains WHERE character_id = ?', id);
        changes += deleteExternalKnowledgeDocsForCharacter(id);
        return changes;
    }

    return { runOptionalDelete, deleteExternalKnowledgeDocsForCharacter, deleteCharacterAttachedRows };
}

module.exports = { createModule };
