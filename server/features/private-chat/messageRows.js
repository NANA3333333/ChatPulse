// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeMessageRow(row) {
        if (!row) return row;
        let metadata = row.metadata;
        if (typeof metadata === 'string' && metadata.trim()) {
            try {
                metadata = JSON.parse(metadata);
            } catch (e) {
                metadata = null;
            }
        }
        const normalizedMetadata = metadata || {};
        const replyVersion = dependencies.privateReplyVersions?.getInfo(row.id);
        if (replyVersion) normalizedMetadata.replyVersion = replyVersion;
        try {
            const tts = dependencies.db.prepare('SELECT * FROM message_tts WHERE message_id = ? AND character_id = ?')
                .get(row.id, row.character_id);
            if (tts && !replyVersion?.revision) {
                normalizedMetadata.tts = {
                    status: tts.status || 'pending',
                    audio_url: tts.status === 'ready' ? `/tts/audio/${row.id}` : '',
                    provider: tts.provider || '',
                    voice: tts.voice || '',
                    model: tts.model || '',
                    error: tts.error || '',
                    duration_ms: Number(tts.duration_ms || 0)
                };
            }
        } catch (e) {
            // Older in-flight databases may not have the TTS table until initDb completes.
        }
        return { ...row, metadata: Object.keys(normalizedMetadata).length > 0 ? normalizedMetadata : null };
    }

    return { normalizeMessageRow };
}

module.exports = { createModule };
