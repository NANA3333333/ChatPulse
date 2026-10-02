// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function inspectContext(db, characterId) {
    const character = db.getCharacter?.(characterId);
    if (!character) throw new Error('Character not found.');
    const privateLimit = Math.max(0, Number(character.context_msg_limit ?? 60) || 0);
    const privateMessages = privateLimit > 0 ? db.getVisibleMessages?.(character.id, privateLimit) || [] : [];
    const latestUser = [...privateMessages].reverse().find(msg => msg.role === 'user') || null;
    const cityLogs = db.city?.getCharacterRecentLogs?.(character.id, 8) || [];
    const llmDebug = db.getLlmDebugLogs?.(character.id, 8) || [];
    const groups = (db.getGroups?.() || []).filter(group => {
        const members = Array.isArray(group.members) ? group.members : [];
        return members.some(member => String(member?.member_id || member) === String(character.id));
    });
    const externalDocs = dependencies.ensureMcpLabDb(db).listExternalKnowledgeDocs({ character_id: character.id, limit: 8 });

    return {
        character: {
            id: character.id,
            name: character.name,
            location: character.location || '',
            city_status: character.city_status || '',
            context_msg_limit: privateLimit
        },
        private_window: {
            count: privateMessages.length,
            latest_user_message: latestUser ? {
                id: latestUser.id,
                timestamp: latestUser.timestamp,
                content: latestUser.content
            } : null,
            tail: privateMessages.slice(-8).map(msg => ({
                id: msg.id,
                role: msg.role,
                timestamp: msg.timestamp,
                content: dependencies.safeText(msg.content, 260),
                metadata: msg.metadata || null
            }))
        },
        city: {
            recent_logs: cityLogs.map(log => ({
                id: log.id,
                action_type: log.action_type,
                location: log.location,
                message: dependencies.safeText(log.message, 320),
                timestamp: log.timestamp
            }))
        },
        group_context: {
            groups: groups.map(group => ({
                id: group.id,
                name: group.name,
                member_count: Array.isArray(group.members) ? group.members.length : 0,
                inject_limit: group.inject_limit
            }))
        },
        external_knowledge: {
            docs: externalDocs.map(doc => ({
                id: doc.id,
                title: doc.title,
                source_url: doc.source_url,
                source_type: doc.source_type,
                trust_level: doc.trust_level,
                tags: doc.tags,
                updated_at: doc.updated_at
            }))
        },
        recent_llm_debug: llmDebug.map(entry => ({
            id: entry.id,
            direction: entry.direction,
            context_type: entry.context_type,
            timestamp: entry.timestamp,
            payload_preview: dependencies.safeText(entry.payload, 360),
            meta: entry.meta || null
        }))
    };
}

    return { inspectContext };
}

module.exports = { createModule };
