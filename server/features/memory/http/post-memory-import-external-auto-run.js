const { normalizeExternalProcessingState, buildMemoryMaintenanceAttemptError, isNonRetryableMemoryMaintenanceError, clipMemoryDisplayText } = require("../maintenance/index.js");
// POST /api/memory-import/external/auto-run
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memory-import/external/auto-run', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memory-import/external/auto-run"), dependencies.authMiddleware, (req, res) => {
    dependencies.memoryImportUpload.any()(req, res, async function (err) {
        if (err instanceof dependencies.multer.MulterError) {
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        const db = req.db;
        const memory = req.memory;
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });

        let runState = null;
        try {
            const settings = dependencies.getMemoryMaintenanceSettings(db);
            if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
                return res.status(400).json({ error: '请先配置“记忆库管理小模型”的 URL、Key 和模型。' });
            }

            let continueImportId = dependencies.normalizeOptionalMemoryId(req.body?.continue_import_id || req.body?.import_id, 'import_id');
            if (!continueImportId && dependencies.parseBooleanFlag(req.body?.retry_latest_external_import)) {
                const latestImport = rawDb.prepare(`
                    SELECT id
                    FROM external_memory_imports
                    WHERE COALESCE(normalized_messages_json, '') <> ''
                    ORDER BY id DESC
                    LIMIT 1
                `).get();
                continueImportId = Number(latestImport?.id || 0);
            }
            const external = continueImportId
                ? dependencies.loadExternalImportRequestFromDb(rawDb, continueImportId)
                : dependencies.parseExternalImportRequest(req);
            const requestedSourceApp = dependencies.normalizeExternalSourceApp(req.body?.source_app || req.body?.source || req.body?.app);
            const sourceApp = external.storedSourceApp || external.detectedSourceApp || requestedSourceApp;
            const importMode = external.storedImportMode || (external.detectedSourceApp === 'sillytavern'
                ? 'multi_role'
                : dependencies.normalizeExternalImportMode(req.body?.import_mode || req.body?.mode, sourceApp));
            const targetCharacterName = dependencies.normalizeExternalCharacterName(req.body?.target_character_name || req.body?.character_name, dependencies.getExternalSourceAppLabel(sourceApp));
            const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions({
                limit: req.body?.limit,
                offset: req.body?.continue_from_offset ?? req.body?.start_offset
            }, {
                limitFallback: settings.batch_size || 10
            });
            const runControls = dependencies.normalizeMemoryMaintenanceAutoRunControls({
                ...req.body,
                limit: batchOptions.limit
            }, {
                limitFallback: batchOptions.limit,
                maxBatchesFallback: 1,
                maxRerollsFallback: 0,
                maxRerollsMax: 3,
                missingMaxBatchesMeansAll: true
            });
            const limit = runControls.limit;
            const requestedContinueOffset = batchOptions.offset;
            const runUntilEmpty = runControls.run_until_empty;
            const maxBatches = runControls.max_batches;
            const maxRerolls = runControls.max_rerolls;
            const dryRun = dependencies.parseBooleanFlag(req.body?.dry_run);
            const backgroundRun = req.body?.background === true || req.body?.background === 'true';
            const runCharacterId = '__external_import__';

            if (backgroundRun) {
                const activeRun = dependencies.findActiveMemoryMaintenanceRun(req.user.id, runCharacterId);
                if (activeRun) {
                    return res.json({
                        success: true,
                        accepted: true,
                        reused: true,
                        run: dependencies.getMemoryMaintenanceRunSnapshot(activeRun)
                    });
                }
            }

            let importId = continueImportId || 0;
            const importStartedAt = Date.now();
            let previousSaved = [];
            if (!dryRun && continueImportId) {
                previousSaved = normalizeExternalProcessingState(external.row?.memory_ids_json);
            }
            if (!dryRun && !continueImportId) {
                const info = rawDb.prepare(`
                    INSERT INTO external_memory_imports
                        (source_app, import_mode, filename, raw_text, normalized_messages_json, summary_json, role_tags_json, memory_ids_json, created_at, committed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    sourceApp,
                    importMode,
                    external.filename || '',
                    external.rawText || '',
                    JSON.stringify(external.messages || []),
                    JSON.stringify({ source_app: sourceApp, import_mode: importMode, role_tags: [], candidates: [], needs_review: [] }),
                    '[]',
                    '[]',
                    importStartedAt,
                    importStartedAt
                );
                importId = Number(info.lastInsertRowid || 0);
            }

            const totalMessages = external.messages || [];
            const inferredContinueOffset = continueImportId && requestedContinueOffset <= 0
                ? dependencies.inferExternalImportContinueOffset(external.row, limit)
                : requestedContinueOffset;
            const continueOffset = Math.min(totalMessages.length, Math.max(0, inferredContinueOffset));
            const chunks = dependencies.chunkExternalImportMessages(totalMessages.slice(continueOffset), limit, maxBatches);
            const runId = `external-import-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
            const wsClients = dependencies.getWsClients(req.user.id);
            const characterLabel = importMode === 'multi_role' ? '外部导入' : (targetCharacterName || dependencies.getExternalSourceAppLabel(sourceApp));
            runState = {
                run_id: runId,
                user_id: req.user.id,
                characterId: runCharacterId,
                character: { id: runCharacterId, name: characterLabel },
                task_mode: 'external_import',
                import_id: importId || null,
                source_app: sourceApp,
                import_mode: importMode,
                filename: external.filename || '',
                continue_from_offset: continueOffset,
                total_messages: totalMessages.length,
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
            const previousSummary = continueImportId ? dependencies.safeJsonParse(external.row?.summary_json, {}) : {};
            const allCandidates = Array.isArray(previousSummary.candidates) ? [...previousSummary.candidates] : [];
            let allRoleTags = Array.isArray(previousSummary.role_tags) ? [...previousSummary.role_tags] : [];
            const allNeedsReview = Array.isArray(previousSummary.needs_review) ? [...previousSummary.needs_review] : [];
            const allSaved = [...previousSaved];
            let processed = continueOffset;
            let updated = previousSaved.length ? dependencies.countUniqueExternalImportSavedItems(previousSaved) : 0;
            let appliedErrors = 0;
            let lastRawResponse = '';
            let lastPrompt = null;
            let stoppedReason = '';

            const sendProgress = (phase, extra = {}) => {
                const payload = {
                    type: 'memory_maintenance_progress',
                    data: {
                        run_id: runId,
                        task_mode: 'external_import',
                        import_id: importId || null,
                        source_app: sourceApp,
                        import_mode: importMode,
                        filename: external.filename || '',
                        continue_from_offset: continueOffset,
                        total_messages: totalMessages.length,
                        phase,
                        characterId: runCharacterId,
                        character: { id: runCharacterId, name: characterLabel },
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

            const executeExternalImportRun = async () => {
                await dependencies.yieldToServerLoop();
                sendProgress('start', {
                    message: continueOffset > 0
                        ? `外部导入从断点继续：跳过已处理 ${continueOffset} 条，剩余 ${Math.max(0, totalMessages.length - continueOffset)} 条，按每批 ${limit} 条处理。`
                        : `外部导入自动总结已开始：${totalMessages.length} 条正文，按每批 ${limit} 条处理。`,
                    pending_before: Math.max(0, totalMessages.length - continueOffset)
                });

                if (!chunks.length) {
                    stoppedReason = 'empty';
                }

            for (let idx = 0; idx < chunks.length; idx++) {
                const batchNumber = Math.floor(continueOffset / limit) + idx + 1;
                const chunk = chunks[idx];
                const rollAttempts = [];
                let batchSaved = null;
                let batchNormalized = null;
                let batchRawResponse = '';
                let shouldStop = false;

                sendProgress('batch_start', {
                    batch_number: batchNumber,
                    pending_before: Math.max(0, totalMessages.length - continueOffset - idx * limit),
                    message: `第 ${batchNumber} 批开始：读取 ${chunk.length} 条导入正文。`
                });

                for (let reroll = 0; reroll <= maxRerolls; reroll++) {
                    const attemptNumber = reroll + 1;
                    sendProgress('attempt_start', {
                        batch_number: batchNumber,
                        attempt: attemptNumber,
                        reroll,
                        message: reroll > 0 ? `第 ${batchNumber} 批重试第 ${reroll} 次。` : `第 ${batchNumber} 批调用小模型。`
                    });
                    try {
                        const prompt = dependencies.buildExternalImportPrompt({
                            sourceApp,
                            importMode,
                            targetCharacterName,
                            messages: chunk,
                            rawText: '',
                            knownRoleTags: allRoleTags,
                            userName: req.user.username
                        });
                        lastPrompt = prompt;
                        const response = await dependencies.callLLM({
                            endpoint: settings.api_endpoint,
                            key: settings.api_key,
                            model: settings.model_name,
                            messages: [
                                { role: 'system', content: prompt.system_prompt },
                                { role: 'user', content: prompt.user_prompt }
                            ],
                            maxTokens: Math.max(1500, Math.min(20000, Number(settings.max_output_tokens || 8000) || 8000)),
                            temperature: 0.1,
                            returnUsage: true,
                            responseFormat: { type: 'json_object' },
                            requestTimeoutMs: dependencies.EXTERNAL_MEMORY_IMPORT_LLM_TIMEOUT_MS,
                            maxAttempts: 1
                        });
                        batchRawResponse = typeof response === 'string' ? response : response.content;
                        lastRawResponse = batchRawResponse || lastRawResponse;
                        const parsed = dependencies.extractJsonObjectFromText(batchRawResponse);
                        batchNormalized = dependencies.normalizeExternalImportResult(parsed, {
                            sourceApp,
                            importMode,
                            targetCharacterName,
                            messages: chunk,
                            knownRoleTags: allRoleTags,
                            userName: req.user.username
                        });
                        batchNormalized.candidates = (batchNormalized.candidates || []).map(candidate => ({
                            ...candidate,
                            id: `b${batchNumber}_${candidate.id || Math.random().toString(16).slice(2, 8)}`
                        }));
                        allRoleTags = dependencies.mergeExternalImportRoleTags(allRoleTags, batchNormalized.role_tags || []);
                        allCandidates.push(...batchNormalized.candidates);
                        allNeedsReview.push(...(batchNormalized.needs_review || []));
                        batchSaved = await dependencies.saveExternalImportCandidatesDirect({
                            db,
                            memory,
                            settings,
                            importId,
                            sourceApp,
                            importMode,
                            normalized: batchNormalized,
                            dryRun
                        });
                        break;
                    } catch (e) {
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
                            message: nonRetryable ? '小模型鉴权失败，已停止外部导入。' : undefined
                        });
                        if (nonRetryable || reroll >= maxRerolls) {
                            errors.push({
                                batch_number: batchNumber,
                                error: e.message || 'External import batch failed.',
                                attempts: rollAttempts,
                                raw_response_preview: clipMemoryDisplayText(lastRawResponse, 1600)
                            });
                            stoppedReason = nonRetryable ? 'auth_error' : 'error';
                            shouldStop = true;
                            break;
                        }
                    }
                }

                if (shouldStop) break;
                if (!batchSaved || !batchNormalized) {
                    stoppedReason = 'error';
                    errors.push({ batch_number: batchNumber, error: '小模型没有返回可用结果。', attempts: rollAttempts });
                    break;
                }

                const batchUniqueSaved = dependencies.countUniqueExternalImportSavedItems(batchSaved.saved || []);
                const batchBindingCount = dependencies.countExternalImportSavedBindings(batchSaved.saved || []);
                processed += chunk.length;
                updated += batchUniqueSaved;
                appliedErrors += Number(batchSaved.error_count || 0);
                allSaved.push(...(batchSaved.saved || []));
                if (batchSaved.errors?.length) {
                    errors.push({ batch_number: batchNumber, error: '部分记忆保存失败。', attempts: rollAttempts, save_errors: batchSaved.errors });
                }
                const runRecord = {
                    batch_number: batchNumber,
                    item_count: chunk.length,
                    new_memory_count: batchNormalized.candidates.length,
                    updated: batchUniqueSaved,
                    saved_bindings: batchBindingCount,
                    errors: Number(batchSaved.error_count || 0),
                    skipped: batchSaved.skipped || [],
                    rerolls: rollAttempts.length,
                    model: settings.model_name
                };
                runs.push(runRecord);
                sendProgress('batch_success', {
                    ...runRecord,
                    processed,
                    updated,
                    applied_errors: appliedErrors,
                    remaining_pending_after_batch: Math.max(0, totalMessages.length - processed),
                    new_memory_samples: dependencies.formatExternalImportSavedSamples(batchSaved.saved || [], 5),
                    message: dryRun
                        ? `第 ${batchNumber} 批完成：预览 ${batchUniqueSaved} 条，不写库。`
                        : (batchBindingCount > batchUniqueSaved
                            ? `第 ${batchNumber} 批完成：写入 ${batchUniqueSaved} 条共享记忆，绑定 ${batchBindingCount} 次角色。`
                            : `第 ${batchNumber} 批完成：写入 ${batchUniqueSaved} 条。`)
                });
            }

            if (!stoppedReason) {
                stoppedReason = allSaved.length > 0 || dryRun ? 'completed' : 'no_candidates';
            }

            if (!dryRun && importId) {
                rawDb.prepare(`
                    UPDATE external_memory_imports
                    SET summary_json = ?,
                        role_tags_json = ?,
                        memory_ids_json = ?,
                        committed_at = ?
                    WHERE id = ?
                `).run(
                    JSON.stringify({
                        source_app: sourceApp,
                        import_mode: importMode,
                        role_tags: allRoleTags,
                        candidates: allCandidates,
                        needs_review: allNeedsReview.slice(0, 200),
                        last_run: {
                            processed,
                            updated,
                            limit,
                            max_batches: maxBatches,
                            run_until_empty: runUntilEmpty,
                            stopped_reason: stoppedReason || '',
                            errors: errors.slice(-3),
                            finished_at: Date.now()
                        },
                        continue_from: {
                            import_id: importId,
                            offset: processed,
                            pending: Math.max(0, totalMessages.length - processed),
                            total: totalMessages.length
                        }
                    }),
                    JSON.stringify(allRoleTags),
                    JSON.stringify(allSaved),
                    Date.now(),
                    importId
                );
            }

            const characterIds = dependencies.getExternalImportSavedCharacterIds(allSaved);
            for (const characterId of characterIds) {
                dependencies.broadcastToWsClients(wsClients, { type: 'memory_update', characterId });
            }
            dependencies.broadcastToWsClients(wsClients, { type: 'refresh_contacts' });
            const savedBindingCount = dependencies.countExternalImportSavedBindings(allSaved);
            const savedCharacters = Array.from(new Map(allSaved.flatMap(item => {
                if (Array.isArray(item?.bound_characters) && item.bound_characters.length > 0) {
                    return item.bound_characters.map(character => [character.id, { id: character.id, name: character.name }]);
                }
                return item?.character_id ? [[item.character_id, { id: item.character_id, name: item.character_name }]] : [];
            }).filter(([id]) => id)).values());

            const responsePayload = {
                success: errors.length === 0,
                mode: 'external_import_auto',
                dry_run: dryRun,
                import_id: importId || null,
                source_app: sourceApp,
                detected_source_app: external.detectedSourceApp || '',
                import_mode: importMode,
                filename: external.filename || '',
                limit,
                max_batches: maxBatches,
                run_until_empty: runUntilEmpty,
                max_rerolls: maxRerolls,
                processed,
                updated,
                applied_errors: appliedErrors,
                stopped_reason: stoppedReason,
                roles: allRoleTags,
                characters: savedCharacters,
                saved: allSaved,
                errors,
                runs,
                prompt: lastPrompt,
                raw_response_preview: clipMemoryDisplayText(lastRawResponse, 1600),
                can_continue: ['error', 'no_progress'].includes(stoppedReason) && processed < totalMessages.length,
                continue_from: {
                    import_id: importId || null,
                    offset: processed,
                    pending: Math.max(0, totalMessages.length - processed),
                    total: totalMessages.length
                },
                stats: {
                    message_count: totalMessages.length,
                    batch_count: chunks.length,
                    candidates: allCandidates.length,
                    saved: allSaved.length,
                    saved_bindings: savedBindingCount,
                    needs_review: allNeedsReview.length
                }
            };
            sendProgress(responsePayload.success ? 'done' : 'stopped', {
                import_id: responsePayload.import_id,
                source_app: sourceApp,
                import_mode: importMode,
                filename: external.filename || '',
                stopped_reason: responsePayload.stopped_reason,
                success: responsePayload.success,
                can_continue: responsePayload.can_continue,
                continue_from: responsePayload.continue_from,
                stats: responsePayload.stats,
                errors: errors.slice(-3),
                runs_count: runs.length,
                new_memory_samples: dependencies.formatExternalImportSavedSamples(allSaved, 5),
                message: responsePayload.success
                    ? (dryRun
                        ? `外部导入预览完成：处理 ${processed} 条正文，候选 ${updated} 条，未写库。`
                        : (savedBindingCount > updated
                            ? `外部导入完成：处理 ${processed} 条正文，写入 ${updated} 条共享记忆，绑定 ${savedBindingCount} 次角色。`
                            : `外部导入完成：处理 ${processed} 条正文，写入 ${updated} 条正式记忆。`))
                    : `外部导入停止：${responsePayload.stopped_reason || 'error'}。`
            });
            if (!res.headersSent) {
                res.status(responsePayload.success ? 200 : 422).json(responsePayload);
            }
            return responsePayload;
            };

            const failExternalImportRun = (e) => {
                console.error('External memory import auto-run failed:', e);
                runState.running = false;
                runState.success = false;
                runState.finished_at = Date.now();
                runState.stopped_reason = 'error';
                runState.errors = [{ error: e.message || 'External import failed.' }];
                sendProgress('stopped', {
                    stopped_reason: 'error',
                    success: false,
                    errors: runState.errors,
                    message: `外部导入停止：${e.message || 'error'}。`
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
                    key: `memory-import:${req.user.id}`,
                    dedupeKey: `memory-import:${req.user.id}:external`,
                    maxPending: 2,
                    task: executeExternalImportRun
                }).then((queueResult) => {
                    if (queueResult?.skipped) {
                        const reason = queueResult.reason || 'queue_full';
                        sendProgress('stopped', {
                            stopped_reason: reason,
                            success: false,
                            errors: [{ error: reason }],
                            message: reason === 'duplicate'
                                ? '这个账号已有外部导入在跑。'
                                : '这个账号的外部导入队列已满。'
                        });
                    }
                }).catch(failExternalImportRun);
                return;
            }

            await executeExternalImportRun();
        } catch (e) {
            console.error('External memory import auto-run failed:', e);
            if (runState) {
                runState.running = false;
                runState.success = false;
                runState.finished_at = Date.now();
                runState.stopped_reason = 'error';
                runState.errors = [{ error: e.message || 'External import failed.' }];
            }
            if (!res.headersSent) {
                res.status(e.status || 500).json({ error: e.message });
            }
        }
    });
});
}
module.exports = { register };
