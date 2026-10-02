// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeCharRelationshipEndpoint(value) {
        const id = String(value || '').trim();
        if (!id || !dependencies.getCharacter(id)) return null;
        return id;
    }

function normalizeCharRelationshipSource(value) {
        const source = String(value || '').trim();
        return source ? source.slice(0, 120) : 'recommend';
    }

function normalizeCharRelationshipAffinity(value) {
        if (value === undefined || value === null) return null;
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100) return null;
        return parsed;
    }

function normalizeCharRelationshipImpression(value) {
        return String(value || '').trim().slice(0, 200);
    }

function initCharRelationship(sourceId, targetId, affinity, impression, source = 'recommend') {
        const cleanSourceId = normalizeCharRelationshipEndpoint(sourceId);
        const cleanTargetId = normalizeCharRelationshipEndpoint(targetId);
        if (!cleanSourceId || !cleanTargetId || cleanSourceId === cleanTargetId) return false;
        const safeSource = normalizeCharRelationshipSource(source);
        const safeAffinity = normalizeCharRelationshipAffinity(affinity);
        if (safeAffinity === null) return false;
        const safeImpression = normalizeCharRelationshipImpression(impression);
        // Check existing record to avoid duplicate history entries
        const existing = dependencies.db.prepare('SELECT affinity, impression FROM char_relationships WHERE source_id = ? AND target_id = ? AND source = ?')
            .get(cleanSourceId, cleanTargetId, safeSource);

        dependencies.db.prepare(`INSERT OR REPLACE INTO char_relationships (source_id, target_id, affinity, impression, source) VALUES (?, ?, ?, ?, ?)`)
            .run(cleanSourceId, cleanTargetId, safeAffinity, safeImpression, safeSource);

        // Only add history if: impression changed AND (affinity changed by ≥5 OR it's a brand new relationship)
        const impressionChanged = !existing || existing.impression !== safeImpression;
        const affinityDelta = existing ? Math.abs(safeAffinity - existing.affinity) : 999;
        if (safeImpression.trim() !== '' && impressionChanged && (!existing || affinityDelta >= 5)) {
            addCharImpressionHistory(cleanSourceId, cleanTargetId, safeImpression, `Formed: ${safeSource}`);
        }
        return true;
    }

function getCharRelationship(sourceId, targetId) {
        const cleanSourceId = normalizeCharRelationshipEndpoint(sourceId);
        const cleanTargetId = normalizeCharRelationshipEndpoint(targetId);
        if (!cleanSourceId || !cleanTargetId || cleanSourceId === cleanTargetId) return null;
        // Returns all relationship records between source→target (may have multiple sources)
        const rows = dependencies.db.prepare('SELECT * FROM char_relationships WHERE source_id = ? AND target_id = ?').all(cleanSourceId, cleanTargetId);
        if (rows.length === 0) return null;
        // Merge: total affinity = recommend base + sum of group deltas
        const recommend = rows.find(r => r.source === 'recommend');
        const groupRows = rows.filter(r => r.source !== 'recommend');
        const totalAffinity = (recommend?.affinity || 50) + groupRows.reduce((sum, r) => sum + (r.affinity - 50), 0);

        // Fetch the most recent impression from history
        const history = getCharImpressionHistory(cleanSourceId, cleanTargetId, 1);
        const latestImpression = history.length > 0 ? history[0].impression : (recommend?.impression || groupRows[0]?.impression || '');

        return {
            sourceId: cleanSourceId,
            targetId: cleanTargetId,
            affinity: Math.max(0, Math.min(100, totalAffinity)),
            impression: latestImpression,
            isAcquainted: !!recommend,
            sources: rows
        };
    }

function getCharRelationships(charId) {
        // Get all unique targets this char has a relationship with
        const rows = dependencies.db.prepare('SELECT DISTINCT target_id FROM char_relationships WHERE source_id = ?').all(charId);
        return rows.map(r => getCharRelationship(charId, r.target_id)).filter(Boolean);
    }

function updateCharRelationship(sourceId, targetId, source, data) {
        const cleanSourceId = normalizeCharRelationshipEndpoint(sourceId);
        const cleanTargetId = normalizeCharRelationshipEndpoint(targetId);
        if (!cleanSourceId || !cleanTargetId || cleanSourceId === cleanTargetId) return false;
        const safeSource = normalizeCharRelationshipSource(source);
        const existing = dependencies.db.prepare('SELECT * FROM char_relationships WHERE source_id = ? AND target_id = ? AND source = ?').get(cleanSourceId, cleanTargetId, safeSource);
        if (existing) {
            const fields = [];
            const values = [];
            let nextAffinity = existing.affinity;
            if (data.affinity !== undefined) {
                const safeAffinity = normalizeCharRelationshipAffinity(data.affinity);
                if (safeAffinity === null) return false;
                fields.push('affinity = ?');
                values.push(safeAffinity);
                nextAffinity = safeAffinity;
            }
            if (data.impression !== undefined) {
                const safeImpression = normalizeCharRelationshipImpression(data.impression);
                fields.push('impression = ?');
                values.push(safeImpression);

                // Only log history if impression text actually changed AND affinity shifted by ≥5
                const affinityDelta = data.affinity !== undefined ? Math.abs(nextAffinity - existing.affinity) : 0;
                if (safeImpression !== existing.impression && safeImpression !== '' && affinityDelta >= 5) {
                    addCharImpressionHistory(cleanSourceId, cleanTargetId, safeImpression, `Updated: ${safeSource}`);
                }
            }
            if (fields.length > 0) {
                values.push(cleanSourceId, cleanTargetId, safeSource);
                dependencies.db.prepare(`UPDATE char_relationships SET ${fields.join(', ')} WHERE source_id = ? AND target_id = ? AND source = ?`).run(...values);
                return true;
            }
            return false;
        } else {
            // Auto-create if doesn't exist
            const nextAffinity = data.affinity === undefined ? 50 : data.affinity;
            return initCharRelationship(cleanSourceId, cleanTargetId, nextAffinity, data.impression || '', safeSource);
        }
    }

function addCharImpressionHistory(sourceId, targetId, impression, triggerEvent) {
        const cleanSourceId = normalizeCharRelationshipEndpoint(sourceId);
        const cleanTargetId = normalizeCharRelationshipEndpoint(targetId);
        const safeImpression = normalizeCharRelationshipImpression(impression);
        if (!cleanSourceId || !cleanTargetId || cleanSourceId === cleanTargetId || !safeImpression) return false;
        dependencies.db.prepare('INSERT INTO char_impression_history (source_id, target_id, impression, trigger_event, timestamp) VALUES (?, ?, ?, ?, ?)')
            .run(cleanSourceId, cleanTargetId, safeImpression, String(triggerEvent || '').trim().slice(0, 200), Date.now());
        return true;
    }

function normalizeImpressionHistoryLimit(value, fallback = 50, max = 200) {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
        return Math.min(max, parsed);
    }

function getCharImpressionHistory(sourceId, targetId, limit = 50) {
        const cleanSourceId = normalizeCharRelationshipEndpoint(sourceId);
        const cleanTargetId = normalizeCharRelationshipEndpoint(targetId);
        if (!cleanSourceId || !cleanTargetId || cleanSourceId === cleanTargetId) return [];
        const safeLimit = normalizeImpressionHistoryLimit(limit);
        return dependencies.db.prepare('SELECT * FROM char_impression_history WHERE source_id = ? AND target_id = ? ORDER BY timestamp DESC LIMIT ?')
            .all(cleanSourceId, cleanTargetId, safeLimit);
    }

function deleteGroupRelationships(groupId) {
        dependencies.db.prepare('DELETE FROM char_relationships WHERE source = ?').run(`group:${groupId}`);
    }

    return { normalizeCharRelationshipEndpoint, normalizeCharRelationshipSource, normalizeCharRelationshipAffinity, normalizeCharRelationshipImpression, initCharRelationship, getCharRelationship, getCharRelationships, updateCharRelationship, addCharImpressionHistory, normalizeImpressionHistoryLimit, getCharImpressionHistory, deleteGroupRelationships };
}

module.exports = { createModule };
