const { clipMemoryDisplayText, buildMemoryMaintenanceAttemptError, isNonRetryableMemoryMaintenanceError } = require("../maintenance/index.js");
// POST /api/memories/:characterId/maintenance/temporal-binding-auto-run
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memories/:characterId/maintenance/temporal-binding-auto-run', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memories/:characterId/maintenance/temporal-binding-auto-run"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
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
        const source = dependencies.normalizeMemoryTemporalBindingSource(req.body?.source || 'new');
        const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions(req.body || {}, { limitFallback: settings.batch_size || 40 });
        const limit = batchOptions.limit;
        const totalBatch = dependencies.getMemoryTemporalBindingBatch(rawDb, characterId, {
            limit: 1,
            offset: 0,
            source,
            include_archived: req.body?.include_archived
        });
        const totalMatching = Number(totalBatch.total_matching || 0);
        const totalBatches = Math.max(0, Math.ceil(totalMatching / limit));
        const runControls = dependencies.normalizeMemoryMaintenanceAutoRunControls({
            ...req.body,
            limit
        }, {
            limitFallback: limit,
            maxBatchesFallback: totalBatches || 1,
            maxRerollsFallback: 3,
            maxRerollsMax: 10
        });
        const runUntilEmpty = runControls.run_until_empty;
        const maxBatches = runUntilEmpty ? totalBatches : Math.min(totalBatches, runControls.max_batches);
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
        const runId = `${characterId}-supplement-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const wsClients = dependencies.getWsClients(req.user.id);
        const runState = {
            run_id: runId,
            user_id: req.user.id,
            characterId,
            character: { id: charObj.id, name: charObj.name },
            task_mode: 'supplement',
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
                    task_mode: 'supplement',
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

        const executeTemporalBindingRun = async () => {
            await dependencies.yieldToServerLoop();
            sendProgress('start', {
                message: '自动补充已开始。',
                total_matching: totalMatching,
                total_batches: totalBatches
            });

        for (let idx = 0; idx < maxBatches; idx++) {
            const batchNumber = idx + 1;
            const offset = idx * limit;
            let result = null;
            let batchUpdated = 0;
            let batchErrors = 0;
            let finalAttemptNumber = 1;
            let shouldStopAfterBatch = false;
            const rollAttempts = [];
            sendProgress('batch_start', {
                batch_number: batchNumber,
                pending_before: Math.max(0, totalMatching - offset)
            });
            for (let reroll = 0; reroll <= maxRerolls; reroll++) {
                const attemptNumber = reroll + 1;
                finalAttemptNumber = attemptNumber;
                sendProgress('attempt_start', {
                    batch_number: batchNumber,
                    attempt: attemptNumber,
                    reroll,
                    message: reroll > 0 ? `第 ${batchNumber} 批补充重 roll 第 ${reroll} 次。` : `第 ${batchNumber} 批开始补充标签。`
                });
                try {
                    const candidate = await dependencies.runMemoryTemporalBindingBatch(rawDb, charObj, settings, {
                        limit,
                        offset,
                        source,
                        dry_run: dryRun,
                        source_name: reroll > 0 ? `small-model-temporal-binding-reroll-${reroll}` : 'small-model-temporal-binding'
                    });
                    result = candidate;
                    lastPrompt = candidate.prompt || lastPrompt;
                    lastRawResponse = candidate.raw_response || lastRawResponse;
                    if (candidate.empty) break;
                    batchUpdated = Number(candidate.apply?.updated || 0);
                    batchErrors = Number(candidate.apply?.errors?.length || 0) + Number(candidate.normalized?.errors?.length || 0);
                    sendProgress('attempt_result', {
                        batch_number: batchNumber,
                        attempt: attemptNumber,
                        reroll,
                        item_count: candidate.batch?.item_count || 0,
                        ids: candidate.batch?.ids || [],
                        updated: batchUpdated,
                        source_label_count: candidate.normalized?.source_label_count || 0,
                        time_label_count: candidate.normalized?.time_label_count || 0,
                        errors: batchErrors,
                        remaining_pending_after_batch: Math.max(0, totalMatching - Math.min(totalMatching, offset + limit)),
                        new_memory_samples: [`来源标签 ${candidate.normalized?.source_label_count || 0} 条，时间标签 ${candidate.normalized?.time_label_count || 0} 条`]
                    });
                    const noProgress = !dryRun && batchUpdated <= 0;
                    if (noProgress) {
                        const attemptError = {
                            attempt: attemptNumber,
                            reroll,
                            kind: 'no_progress',
                            error: 'No memory records were updated; rerolling this supplemental batch.',
                            normalized_errors: (candidate.normalized?.errors || []).slice(0, 6),
                            raw_response_preview: candidate.raw_response ? clipMemoryDisplayText(candidate.raw_response, 1600) : ''
                        };
                        rollAttempts.push(attemptError);
                        sendProgress('attempt_no_progress', {
                            batch_number: batchNumber,
                            attempt: attemptNumber,
                            reroll,
                            attempt_error: attemptError,
                            will_reroll: reroll < maxRerolls
                        });
                        if (reroll < maxRerolls) {
                            result = null;
                            continue;
                        }
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
                        message: nonRetryable ? '小模型鉴权失败，已停止自动补充；请检查 URL、Key 和模型名。' : undefined
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
                    error: `Small model did not produce a usable supplemental result after ${maxRerolls} reroll(s).`,
                    attempts: rollAttempts
                });
                break;
            }
            if (result.empty) {
                runs.push({ batch_number: batchNumber, empty: true, message: result.message, attempts: rollAttempts });
                stoppedReason = 'empty';
                break;
            }
            processed += Number(result.batch?.item_count || 0);
            updated += batchUpdated;
            appliedErrors += batchErrors;
            const runRecord = {
                batch_number: batchNumber,
                ids: result.batch?.ids || [],
                item_count: result.batch?.item_count || 0,
                updated: batchUpdated,
                source_label_count: result.normalized?.source_label_count || 0,
                time_label_count: result.normalized?.time_label_count || 0,
                errors: batchErrors,
                remaining_pending_after_batch: Math.max(0, totalMatching - Math.min(totalMatching, offset + limit)),
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
        }

        const stats = dependencies.getMemoryMaintenanceStats(rawDb, characterId);
        const responsePayload = {
            success: errors.length === 0,
            character: { id: charObj.id, name: charObj.name },
            mode: 'auto',
            task_mode: 'supplement',
            dry_run: dryRun,
            limit,
            max_batches: maxBatches,
            run_until_empty: runUntilEmpty,
            max_rerolls: maxRerolls,
            processed,
            updated,
            applied_errors: appliedErrors,
            stopped_on_error: stoppedReason === 'error' && errors.length > 0,
            stopped_reason: stoppedReason || 'completed',
            errors,
            runs,
            prompt: lastPrompt,
            raw_response: lastRawResponse,
            stats,
            can_continue: stoppedReason === 'error',
            continue_from: {
                status: 'new',
                offset: processed,
                pending: Math.max(0, totalMatching - processed)
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

        const failTemporalBindingRun = (e) => {
            console.error('Memory temporal binding auto-run failed:', e);
            runState.running = false;
            runState.success = false;
            runState.finished_at = Date.now();
            runState.stopped_reason = 'error';
            runState.errors = [{ error: e.message || 'Memory temporal binding failed.' }];
            sendProgress('stopped', {
                stopped_reason: 'error',
                success: false,
                errors: runState.errors,
                message: `自动补充停止：${e.message || 'error'}。`
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
                dedupeKey: `memory-maintenance:${req.user.id}:${characterId}:supplement`,
                maxPending: 2,
                task: executeTemporalBindingRun
            }).then((queueResult) => {
                if (queueResult?.skipped) {
                    const reason = queueResult.reason || 'queue_full';
                    sendProgress('stopped', {
                        stopped_reason: reason,
                        success: false,
                        errors: [{ error: reason }],
                        message: reason === 'duplicate'
                            ? '这个角色已有自动补充在跑。'
                            : '这个账号的自动补充队列已满。'
                    });
                }
            }).catch(failTemporalBindingRun);
            return;
        }

        await executeTemporalBindingRun();
    } catch (e) {
        console.error('Memory temporal binding auto-run failed:', e);
        if (!res.headersSent) {
            res.status(e.status || 500).json({ error: e.message });
        }
    }
});
}
module.exports = { register };
