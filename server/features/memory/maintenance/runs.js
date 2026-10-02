// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getMemoryMaintenanceRunSnapshot(run) {
    if (!run) return null;
    return {
        run_id: run.run_id,
        user_id: run.user_id,
        characterId: run.characterId,
        character: run.character,
        task_mode: run.task_mode || '',
        import_id: run.import_id || null,
        source_app: run.source_app || '',
        import_mode: run.import_mode || '',
        filename: run.filename || '',
        continue_from_offset: run.continue_from_offset || 0,
        total_messages: run.total_messages || 0,
        phase: run.phase || 'queued',
        running: !!run.running,
        success: run.success,
        limit: run.limit,
        max_batches: run.max_batches,
        run_until_empty: run.run_until_empty,
        max_rerolls: run.max_rerolls,
        batch_number: run.batch_number || 0,
        attempt: run.attempt || 0,
        reroll: run.reroll || 0,
        processed: run.processed || 0,
        updated: run.updated || 0,
        applied_errors: run.applied_errors || 0,
        remaining_pending_after_batch: run.remaining_pending_after_batch,
        pending_before: run.pending_before,
        stopped_reason: run.stopped_reason || '',
        can_continue: !!run.can_continue,
        continue_from: run.continue_from || null,
        message: run.message || '',
        new_memory_samples: run.new_memory_samples || [],
        errors: run.errors || [],
        stats: run.stats || null,
        started_at: run.started_at,
        updated_at: run.updated_at,
        finished_at: run.finished_at || 0,
        events: (run.events || []).slice(-30)
    };
}

function findActiveMemoryMaintenanceRun(userId, characterId = '') {
    for (const run of dependencies.memoryMaintenanceRuns.values()) {
        if (String(run.user_id) !== String(userId)) continue;
        if (!run.running) continue;
        if (characterId && String(run.characterId) !== String(characterId)) continue;
        return run;
    }
    return null;
}

function pruneMemoryMaintenanceRuns() {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [runId, run] of dependencies.memoryMaintenanceRuns.entries()) {
        if (!run.running && Number(run.finished_at || run.updated_at || 0) < cutoff) {
            dependencies.memoryMaintenanceRuns.delete(runId);
        }
    }
}

    return { getMemoryMaintenanceRunSnapshot, findActiveMemoryMaintenanceRun, pruneMemoryMaintenanceRuns };
}

module.exports = { createModule };
