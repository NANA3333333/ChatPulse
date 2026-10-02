// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getAllowedMemoryUpdateFields(patch = {}) {
        const fields = Object.keys(patch).filter(field => dependencies.MEMORY_UPDATE_COLUMNS.has(field));
        if (fields.length === 0) {
            const error = new Error('No valid memory fields provided.');
            error.status = 400;
            throw error;
        }
        return fields;
    }

function normalizeMemoryRow(row) {
        if (!row) return row;
        const peopleList = dependencies.normalizeArrayField(row.people_json ?? row.people, []);
        const itemList = dependencies.normalizeArrayField(row.items_json ?? row.items, []);
        const relationshipList = dependencies.normalizeRelationshipField(row.relationship_json ?? row.relationships, []);
        const sourceMessageIds = dependencies.normalizeArrayField(row.source_message_ids_json, []);
        const legacySummary = (row.summary || row.event || '').trim();
        const legacyContent = (row.content || row.event || legacySummary).trim();
        const consolidationSummary = String(row.consolidation_summary || '').trim();
        const summary = consolidationSummary || legacySummary;
        const content = consolidationSummary || legacyContent || summary;
        return {
            ...row,
            memory_type: row.memory_type || 'event',
            memory_tier: row.memory_tier || 'ambient',
            memory_focus: row.memory_focus || 'general',
            legacy_summary: legacySummary,
            legacy_content: legacyContent,
            summary,
            content,
            people_json: peopleList,
            items_json: itemList,
            relationship_json: relationshipList,
            source_message_ids_json: sourceMessageIds,
            people: row.people || peopleList.join(', '),
            items: row.items || itemList.join(', '),
            relationships: row.relationships || relationshipList.map(rel => {
                if (typeof rel === 'string') return rel;
                return rel.summary || rel.type || JSON.stringify(rel);
            }).join('; '),
            event: row.event || summary || content,
            emotion: row.emotion || '',
            dedupe_key: row.dedupe_key || '',
            updated_at: row.updated_at || row.created_at || Date.now(),
            is_archived: Number(row.is_archived || 0),
            source_started_at: Number(row.source_started_at || 0),
            source_ended_at: Number(row.source_ended_at || 0),
            source_time_text: row.source_time_text || '',
            source_message_count: Number(row.source_message_count || 0),
            source_context: row.source_context || '',
            scene_tag: row.scene_tag || '',
            source_app: row.source_app || '',
            maintenance_status: row.maintenance_status || 'pending',
            classification_source: row.classification_source || '',
            classified_at: Number(row.classified_at || 0),
            retention_score: Number(row.retention_score ?? 1),
            retention_action: row.retention_action || '',
            retention_reason: row.retention_reason || '',
            retention_checked_at: Number(row.retention_checked_at || 0),
            consolidation_key: row.consolidation_key || '',
            consolidation_summary: consolidationSummary,
            memory_library_source: consolidationSummary ? 'new' : 'legacy_backup',
            consolidated_into_memory_id: Number(row.consolidated_into_memory_id || 0),
            archive_reason: row.archive_reason || '',
            forgetting_grace_started_at: Number(row.forgetting_grace_started_at || 0),
            forgetting_grace_expires_at: Number(row.forgetting_grace_expires_at || 0),
            temporal_label: row.temporal_label || '',
            temporal_scope: row.temporal_scope || '',
            temporal_anchor: row.temporal_anchor || '',
            temporal_confidence: Number(row.temporal_confidence || 0),
            temporal_reason: row.temporal_reason || '',
            temporal_checked_at: Number(row.temporal_checked_at || 0)
        };
    }

    return { getAllowedMemoryUpdateFields, normalizeMemoryRow };
}

module.exports = { createModule };
