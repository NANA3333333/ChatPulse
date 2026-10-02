// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
    function normalizePixelBehaviorTreeSceneKey(sceneKey) {
        const safe = String(sceneKey || '')
            .trim()
            .slice(0, 80);
        if (!safe || !/^[a-zA-Z0-9_.:-]+$/.test(safe)) return '';
        return safe;
    }

    function getPixelBehaviorTreeState(sceneKey) {
        const safeSceneKey = normalizePixelBehaviorTreeSceneKey(sceneKey);
        if (!safeSceneKey) return null;
        const row = dependencies.db
            .prepare('SELECT * FROM pixel_behavior_tree_states WHERE scene_key = ?')
            .get(safeSceneKey);
        if (!row) return null;
        return {
            scene_key: row.scene_key,
            tree: dependencies.safeParseJson(row.tree_json, null),
            meta: dependencies.safeParseJson(row.meta_json, {}),
            updated_at: row.updated_at,
            revision: row.revision,
        };
    }

    function upsertPixelBehaviorTreeState(sceneKey, treeState, meta = {}, expectedRevision) {
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
            throw Object.assign(new Error('Read the scene revision before saving.'), { status: 428 });
        }
        const safeSceneKey = normalizePixelBehaviorTreeSceneKey(sceneKey);
        if (!safeSceneKey) {
            const error = new Error('Invalid pixel behavior tree scene key');
            error.status = 400;
            throw error;
        }
        if (!treeState || typeof treeState !== 'object' || Array.isArray(treeState)) {
            const error = new Error('Invalid pixel behavior tree state');
            error.status = 400;
            throw error;
        }
        const treeJson = JSON.stringify(treeState);
        if (treeJson.length > dependencies.PIXEL_BEHAVIOR_TREE_STATE_MAX_BYTES) {
            const error = new Error('Pixel behavior tree state is too large');
            error.status = 413;
            throw error;
        }
        const metaJson = JSON.stringify(meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {});
        const updatedAt = Date.now();
        const revision = dependencies.db
            .transaction(() => {
                const current = dependencies.db
                    .prepare('SELECT revision, tree_json FROM pixel_behavior_tree_states WHERE scene_key = ?')
                    .get(safeSceneKey);
                const currentRevision = current?.revision || 0;
                // A timed-out successful write may be retried safely without overwriting another tree.
                if (current?.tree_json === treeJson) return currentRevision;
                if (expectedRevision !== currentRevision) {
                    throw Object.assign(new Error('Scene changed in another window. Reload before saving.'), {
                        status: 409,
                        revision: currentRevision,
                    });
                }
                const nextRevision = currentRevision + 1;
                dependencies.db
                    .prepare(
                        `
                INSERT INTO pixel_behavior_tree_states (scene_key, tree_json, meta_json, updated_at, revision)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(scene_key) DO UPDATE SET
                    tree_json = excluded.tree_json, meta_json = excluded.meta_json,
                    updated_at = excluded.updated_at, revision = excluded.revision
            `,
                    )
                    .run(safeSceneKey, treeJson, metaJson, updatedAt, nextRevision);
                return nextRevision;
            })
            .immediate();
        return {
            scene_key: safeSceneKey,
            tree: treeState,
            meta: dependencies.safeParseJson(metaJson, {}),
            updated_at: updatedAt,
            revision,
        };
    }

    return { normalizePixelBehaviorTreeSceneKey, getPixelBehaviorTreeState, upsertPixelBehaviorTreeState };
}

module.exports = { createModule };
