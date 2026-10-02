// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function updateSweepStatus(characterId, patch = {}) {
        const db = dependencies.getDb();
        if (!characterId || typeof db.rawRun !== 'function') return;
        const fields = [];
        const values = [];
        if (Object.prototype.hasOwnProperty.call(patch, 'sweep_last_error')) {
            fields.push('sweep_last_error = ?');
            values.push(patch.sweep_last_error || '');
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'sweep_last_run_at')) {
            fields.push('sweep_last_run_at = ?');
            values.push(patch.sweep_last_run_at || 0);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'sweep_last_success_at')) {
            fields.push('sweep_last_success_at = ?');
            values.push(patch.sweep_last_success_at || 0);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'sweep_last_saved_count')) {
            fields.push('sweep_last_saved_count = ?');
            values.push(patch.sweep_last_saved_count || 0);
        }
        if (fields.length === 0) return;
        values.push(characterId);
        db.rawRun(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`, values);
    }

function recordMemoryTokenUsage(characterId, contextType, usage) {
        const db = dependencies.getDb();
        if (!usage || usage.cached || !characterId || !db?.addTokenUsage) return;
        db.addTokenUsage(characterId, contextType, usage.prompt_tokens || 0, usage.completion_tokens || 0);
    }

    return { updateSweepStatus, recordMemoryTokenUsage };
}

module.exports = { createModule };
