const { buildMemoryMaintenanceNoProgressAttempt, buildMemoryMaintenanceAttemptError, isNonRetryableMemoryMaintenanceError } = require("../maintenance/index.js");
// POST /api/memories/:characterId/maintenance/auto-run
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memories/:characterId/maintenance/auto-run', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memories/:characterId/maintenance/auto-run"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    try {
        const characterId = req.params.characterId;
        const charObj = db.getCharacter(characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const settings = dependencies.getMemoryMaintenanceSettings(db);
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            return res.status(400).json({ error: 'Memory maintenance model URL, key, and model are required.' });
        }
        const runControls = dependencies.normalizeMemoryMaintenanceAutoRunControls(req.body || {}, {
            limitFallback: settings.batch_size || 30,
            maxBatchesFallback: 10,
            maxRerollsFallback: 3,
            maxRerollsMax: 10
        });
        const limit = runControls.limit;
        const runUntilEmpty = runControls.run_until_empty;
        const maxBatches = runControls.max_batches;
        const maxRerolls = runControls.max_rerolls;
        const dryRun = dependencies.parseBooleanFlag(req.body?.dry_run);
        const backgroundRun = req.body?.background === true;
        if (backgroundRun) {
            const activeRun = dependencies.findActiveMemoryMaintenanceRun(req.user.id, characterId);
            if (activeRun) {
                return res.json({
                    success: true,
                    accepted: true,
                    reused: true,
                    run: dependencies.getMemoryMaintenanceRunSnapshot(activeRun)
                });
            }
        }
        const runId = `${characterId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const wsClients = dependencies.getWsClients(req.user.id);
        const runState = {
            run_id: runId,
            user_id: req.user.id,
            characterId,
            character: { id: charObj.id, name: charObj.name },
            phase: 'queued',
            running: true,
            success: undefined,
            limit,
            max_batches: maxBatches,
            run_until_empty: runUntilEmpty,
            max_rerolls: maxRerolls,
            processed: 0,
            updated: 0,
            applied_errors: 0,
            started_at: Date.now(),
            updated_at: Date.now(),
            finished_at: 0,
            events: []
        };
        dependencies.memoryMaintenanceRuns.set(runId, runState);
        const runs = [];
        const errors = [];
        let processed = 0;
        let updated = 0;
        let appliedErrors = 0;
        let lastPrompt = null;
        let lastRawResponse = '';
        let stoppedReason = '';
        const sendProgress = (phase, extra = {}) => {
            const payload = {
                type: 'memory_maintenance_progress',
                data: {
                    run_id: runId,
                    phase,
                    characterId,
                    character: { id: charObj.id, name: charObj.name },
                    limit,
                    max_batches: maxBatches,
                    run_until_empty: runUntilEmpty,
                    max_rerolls: maxRerolls,
                    processed,
                    updated,
                    applied_errors: appliedErrors,
                    timestamp: Date.now(),
                    ...extra
                }
            };
            const eventData = payload.data;
            runState.phase = phase;
            runState.updated_at = eventData.timestamp;
            runState.running = !['done', 'stopped'].includes(phase);
            runState.processed = eventData.processed ?? runState.processed;
            runState.updated = eventData.updated ?? runState.updated;
            runState.applied_errors = eventData.applied_errors ?? runState.applied_errors;
            runState.batch_number = eventData.batch_number ?? runState.batch_number;
            runState.attempt = eventData.attempt ?? runState.attempt;
            runState.reroll = eventData.reroll ?? runState.reroll;
            runState.message = eventData.message || runState.message || '';
            runState.remaining_pending_after_batch = eventData.remaining_pending_after_batch ?? runState.remaining_pending_after_batch;
            runState.pending_before = eventData.pending_before ?? runState.pending_before;
            runState.new_memory_samples = eventData.new_memory_samples || runState.new_memory_samples || [];
            runState.stopped_reason = eventData.stopped_reason || runState.stopped_reason || '';
            runState.can_continue = eventData.can_continue ?? runState.can_continue;
            runState.continue_from = eventData.continue_from || runState.continue_from || null;
            runState.errors = eventData.errors || runState.errors || [];
            runState.stats = eventData.stats || runState.stats || null;
            if (!runState.running) {
                runState.success = eventData.success;
                runState.finished_at = eventData.timestamp;
            }
            runState.events.push(eventData);
            if (runState.events.length > 100) runState.events.splice(0, runState.events.length - 100);
            dependencies.broadcastToWsClients(wsClients, payload);
        };

        const executeMemoryMaintenanceRun = async () => {
            await dependencies.yieldToServerLoop();
            sendProgress('start', {
                message: req.body?.continue_from_breakpoint
                    ? '从断点继续自动总结。'
                    : '自动总结已开始。'
            });

        for (let idx = 0; maxBatches === null || idx < maxBatches; idx++) {
            const batchNumber = idx + 1;
            let result = null;
            let statsAfterBatch = null;
            let batchUpdated = 0;
            let batchErrors = 0;
            let finalAttemptNumber = 1;
            let shouldStopAfterBatch = false;
            let noProgressAfterRerolls = false;
            const rollAttempts = [];
            let statsBeforeBatch = null;
            try {
                statsBeforeBatch = dependencies.getMemoryMaintenanceStats(rawDb, characterId);
            } catch (_) {
                statsBeforeBatch = null;
            }
            sendProgress('batch_start', {
                batch_number: batchNumber,
                pending_before: Number(statsBeforeBatch?.pending || 0)
            });

            for (let reroll = 0; reroll <= maxRerolls; reroll++) {
                const attemptNumber = reroll + 1;
                finalAttemptNumber = attemptNumber;
                sendProgress('attempt_start', {
                    batch_number: batchNumber,
                    attempt: attemptNumber,
                    reroll,
                    message: reroll > 0 ? `第 ${batchNumber} 批重 roll 第 ${reroll} 次。` : `第 ${batchNumber} 批开始调用小模型。`
                });
                try {
                    const candidate = await dependencies.runMemoryMaintenanceBatch(rawDb, memory, charObj, settings, {
                        limit,
                        offset: 0,
                        status: 'pending',
                        dry_run: dryRun,
                        source: reroll > 0 ? `small-model-auto-migration-reroll-${reroll}` : 'small-model-auto-migration'
                    });
                    result = candidate;
                    lastPrompt = candidate.prompt || lastPrompt;
                    lastRawResponse = candidate.raw_response || lastRawResponse;
                    if (candidate.empty) break;

                    batchUpdated = Number(candidate.apply?.updated || 0);
                    batchErrors = Number(candidate.apply?.errors?.length || 0) + Number(candidate.normalized?.errors?.length || 0);
                    statsAfterBatch = dependencies.getMemoryMaintenanceStats(rawDb, characterId);
                    sendProgress('attempt_result', {
                        batch_number: batchNumber,
                        attempt: attemptNumber,
                        reroll,
                        item_count: candidate.batch?.item_count || 0,
                        ids: candidate.batch?.ids || [],
                        updated: batchUpdated,
                        new_memory_count: candidate.normalized?.new_memory_count || 0,
                        old_action_count: candidate.normalized?.old_action_count || 0,
                        errors: batchErrors,
                        remaining_pending_before_batch: candidate.batch?.remaining_pending || 0,
                        remaining_pending_after_batch: statsAfterBatch.pending || 0,
                        new_memory_samples: Array.from(new Set((candidate.normalized?.apply_items || [])
                            .map(item => item.consolidation_summary)
                            .filter(Boolean))).slice(0, 5)
                    });
                    const noProgress = !dryRun
                        && batchUpdated <= 0
                        && Number(statsAfterBatch.pending || 0) >= Number(candidate.batch?.remaining_pending || 0);
                    if (noProgress) {
                        const noProgressAttempt = buildMemoryMaintenanceNoProgressAttempt(candidate, statsAfterBatch, attemptNumber);
                        rollAttempts.push(noProgressAttempt);
                        sendProgress('attempt_no_progress', {
                            batch_number: batchNumber,
                            attempt: attemptNumber,
                            reroll,
                            attempt_error: noProgressAttempt,
                            will_reroll: reroll < maxRerolls
                        });
                        if (reroll < maxRerolls) {
                            result = null;
                            continue;
                        }
                        noProgressAfterRerolls = true;
                    }
                    break;
                } catch (e) {
                    lastPrompt = e?.payload?.prompt || lastPrompt;
                    lastRawResponse = e?.payload?.raw_response || lastRawResponse;
                    const attemptError = buildMemoryMaintenanceAttemptError(e, attemptNumber);
                    rollAttempts.push(attemptError);
                    const nonRetryable = isNonRetryableMemoryMaintenanceError(e);
                    sendProgress('attempt_error', {
                        batch_number: batchNumber,
                        attempt: attemptNumber,
                        reroll,
                        attempt_error: attemptError,
                        will_reroll: !nonRetryable && reroll < maxRerolls,
                        message: nonRetryable ? '小模型鉴权失败，已停止自动总结；请检查 URL、Key 和模型名。' : undefined
                    });
                    if (nonRetryable) {
                        errors.push({
                            batch_number: batchNumber,
                            error: `Small model authentication failed: ${e.message}`,
                            attempts: rollAttempts,
                            payload: e.payload || null
                        });
                        stoppedReason = 'auth_error';
                        shouldStopAfterBatch = true;
                        break;
                    }
                    if (reroll < maxRerolls) continue;
                    errors.push({
                        batch_number: batchNumber,
                        error: `Small model failed after ${maxRerolls} reroll(s): ${e.message}`,
                        attempts: rollAttempts,
                        payload: e.payload || null
                    });
                    stoppedReason = 'error';
                    shouldStopAfterBatch = true;
                    break;
                }
            }

            if (shouldStopAfterBatch) break;
            if (!result) {
                stoppedReason = 'error';
                errors.push({
                    batch_number: batchNumber,
                    error: `Small model did not produce a usable result after ${maxRerolls} reroll(s).`,
                    attempts: rollAttempts
                });
                break;
            }
            if (result.empty) {
                const emptyRun = {
                    batch_number: batchNumber,
                    empty: true,
                    message: result.message,
                    remaining_pending: result.batch?.remaining_pending || 0,
                    rerolls: Math.max(0, finalAttemptNumber - 1),
                    attempts: rollAttempts
                };
                runs.push(emptyRun);
                sendProgress('batch_empty', emptyRun);
                stoppedReason = 'empty';
                break;
            }

            processed += Number(result.batch?.item_count || 0);
            updated += batchUpdated;
            appliedErrors += batchErrors;
            if (!statsAfterBatch) statsAfterBatch = dependencies.getMemoryMaintenanceStats(rawDb, characterId);
            const runRecord = {
                batch_number: batchNumber,
                ids: result.batch?.ids || [],
                item_count: result.batch?.item_count || 0,
                updated: batchUpdated,
                new_memory_count: result.normalized?.new_memory_count || 0,
                old_action_count: result.normalized?.old_action_count || 0,
                errors: batchErrors,
                remaining_pending_before_batch: result.batch?.remaining_pending || 0,
                remaining_pending_after_batch: statsAfterBatch.pending || 0,
                rerolls: Math.max(0, finalAttemptNumber - 1),
                attempts: rollAttempts,
                model: result.model
            };
            runs.push(runRecord);
            sendProgress('batch_success', {
                ...runRecord,
                processed,
                updated,
                applied_errors: appliedErrors
            });
            if (dryRun) {
                stoppedReason = 'dry_run';
                break;
            }
            if (noProgressAfterRerolls) {
                stoppedReason = 'no_progress';
                errors.push({
                    batch_number: batchNumber,
                    error: `No memory records were updated after ${maxRerolls} reroll(s); auto-run stopped to avoid repeating the same pending batch.`,
                    attempts: rollAttempts
                });
                break;
            }
        }

        let rebuiltMemoryIndex = false;
        let rebuildWarning = '';
        if (!dryRun && processed > 0 && dependencies.parseBooleanFlag(req.body?.rebuild_index)) {
            try {
                await memory.rebuildIndex(characterId);
                rebuiltMemoryIndex = true;
            } catch (e) {
                rebuildWarning = e.message || 'Memory index rebuild failed.';
            }
        }
        dependencies.broadcastToWsClients(wsClients, { type: 'memory_update', characterId });
        const stats = dependencies.getMemoryMaintenanceStats(rawDb, characterId);
        const responsePayload = {
            success: errors.length === 0,
            character: { id: charObj.id, name: charObj.name },
            mode: 'auto',
            dry_run: dryRun,
            limit,
            max_batches: maxBatches,
            run_until_empty: runUntilEmpty,
            max_rerolls: maxRerolls,
            processed,
            updated,
            applied_errors: appliedErrors,
            stopped_on_error: stoppedReason === 'error' && errors.length > 0,
            stopped_reason: stoppedReason || (maxBatches === null ? 'completed' : 'max_batches'),
            errors,
            runs,
            prompt: lastPrompt,
            raw_response: lastRawResponse,
            rebuiltMemoryIndex,
            rebuildWarning,
            stats,
            can_continue: ['error', 'no_progress'].includes(stoppedReason) && Number(stats.pending || 0) > 0,
            continue_from: {
                status: 'pending',
                offset: 0,
                pending: Number(stats.pending || 0)
            }
        };
        sendProgress(responsePayload.success ? 'done' : 'stopped', {
            stopped_reason: responsePayload.stopped_reason,
            success: responsePayload.success,
            stats,
            can_continue: responsePayload.can_continue,
            continue_from: responsePayload.continue_from,
            errors: errors.slice(-3),
            runs_count: runs.length
        });
        if (!res.headersSent) {
            res.status(responsePayload.success ? 200 : 422).json(responsePayload);
        }
        return responsePayload;
        };

        const failMemoryMaintenanceRun = (e) => {
            console.error('Memory maintenance auto-run failed:', e);
            runState.running = false;
            runState.success = false;
            runState.finished_at = Date.now();
            runState.stopped_reason = 'error';
            runState.errors = [{ error: e.message || 'Memory maintenance failed.' }];
            sendProgress('stopped', {
                stopped_reason: 'error',
                success: false,
                errors: runState.errors,
                message: `自动总结停止：${e.message || 'error'}。`
            });
            if (!res.headersSent) {
                res.status(e.status || 500).json({ error: e.message });
            }
        };

        if (backgroundRun) {
            res.json({
                success: true,
                accepted: true,
                run: dependencies.getMemoryMaintenanceRunSnapshot(runState)
            });
            dependencies.enqueueBackgroundTask({
                key: `memory-maintenance:${req.user.id}`,
                dedupeKey: `memory-maintenance:${req.user.id}:${characterId}`,
                maxPending: 2,
                task: executeMemoryMaintenanceRun
            }).then((queueResult) => {
                if (queueResult?.skipped) {
                    const reason = queueResult.reason || 'queue_full';
                    sendProgress('stopped', {
                        stopped_reason: reason,
                        success: false,
                        errors: [{ error: reason }],
                        message: reason === 'duplicate'
                            ? '这个角色已有自动总结在跑。'
                            : '这个账号的自动总结队列已满。'
                    });
                }
            }).catch(failMemoryMaintenanceRun);
            return;
        }

        await executeMemoryMaintenanceRun();
    } catch (e) {
        console.error('Memory maintenance auto-run failed:', e);
        if (!res.headersSent) {
            res.status(e.status || 500).json({ error: e.message });
        }
    }
});
}
module.exports = { register };
