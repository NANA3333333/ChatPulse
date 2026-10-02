// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeConversationDigestRow(row) {
        if (!row) return row;
        return {
            ...row,
            relationship_state_json: dependencies.normalizeArrayField(row.relationship_state_json, []),
            open_loops_json: dependencies.normalizeArrayField(row.open_loops_json, []),
            recent_facts_json: dependencies.normalizeArrayField(row.recent_facts_json, []),
            scene_state_json: dependencies.normalizeArrayField(row.scene_state_json, []),
            last_message_id: Number(row.last_message_id || 0),
            hit_count: Number(row.hit_count || 0),
            created_at: Number(row.created_at || row.updated_at || 0),
            last_hit_at: Number(row.last_hit_at || 0),
            updated_at: Number(row.updated_at || 0)
        };
    }

function normalizeGroupConversationDigestRow(row) {
        if (!row) return row;
        return {
            ...row,
            relationship_state_json: dependencies.normalizeArrayField(row.relationship_state_json, []),
            open_loops_json: dependencies.normalizeArrayField(row.open_loops_json, []),
            recent_facts_json: dependencies.normalizeArrayField(row.recent_facts_json, []),
            scene_state_json: dependencies.normalizeArrayField(row.scene_state_json, []),
            last_message_id: Number(row.last_message_id || 0),
            hit_count: Number(row.hit_count || 0),
            created_at: Number(row.created_at || row.updated_at || 0),
            last_hit_at: Number(row.last_hit_at || 0),
            updated_at: Number(row.updated_at || 0)
        };
    }

    return { normalizeConversationDigestRow, normalizeGroupConversationDigestRow };
}

module.exports = { createModule };
