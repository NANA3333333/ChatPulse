import { useCallback, useRef, useState, useEffect } from 'react';
import { emptySettings, summarizeAutoRunError, formatStoppedReason } from './memoryLabels.js';

export function useMemoryMaintenance({
    loadData,
    setSelectedCharacterId,
    tx,
    setNotice,
    apiUrl,
    headers,
    selectedCharacterId,
    settings,
    lang,
    setSettings,
    overview,
}) {
    const progressRefreshRef = useRef(null);
    const activeRunMissRef = useRef(0);
    const [batchPreview, setBatchPreview] = useState(null);
    const [promptPreview, setPromptPreview] = useState('');
    const [temporalPromptPreview, setTemporalPromptPreview] = useState('');
    const temporalPromptSource = 'new';

    const [batchLoading, setBatchLoading] = useState(false);
    const [temporalPromptLoading, setTemporalPromptLoading] = useState(false);
    const [runLoading, setRunLoading] = useState(false);
    const [autoLoading, setAutoLoading] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const [autoProgress, setAutoProgress] = useState(null);
    const [autoProgressLog, setAutoProgressLog] = useState([]);
    const [maintenanceMode, setMaintenanceMode] = useState('manual');
    const [promptTaskMode, setPromptTaskMode] = useState('complete');
    const [manualBatchIndex, setManualBatchIndex] = useState(1);
    const [autoMaxBatches, setAutoMaxBatches] = useState('');
    const scheduleProgressRefresh = useCallback(
        (delay = 700) => {
            if (progressRefreshRef.current) {
                clearTimeout(progressRefreshRef.current);
            }
            progressRefreshRef.current = window.setTimeout(() => {
                progressRefreshRef.current = null;
                loadData();
            }, delay);
        },
        [loadData],
    );

    const adoptRunSnapshot = useCallback(
        (run) => {
            if (!run?.run_id) return;
            activeRunMissRef.current = 0;
            const events = Array.isArray(run.events) ? run.events : [];
            setAutoProgress({
                ...run,
                running: !!run.running,
                last_event: events[events.length - 1] || run,
            });
            setAutoProgressLog(events);
            setAutoLoading(!!run.running);
            if (run.characterId) {
                setSelectedCharacterId((prev) => prev || run.characterId);
            }
        },
        [setSelectedCharacterId],
    );

    const markAutoRunMissing = useCallback(() => {
        activeRunMissRef.current = 0;
        if (!autoProgress?.running) {
            setAutoLoading(false);
            return;
        }
        const event = {
            ...autoProgress,
            running: false,
            phase: 'stopped',
            stopped_reason: 'backend_missing',
            message: tx(
                'The backend no longer has this running task. It may have restarted or cleared the task.',
                '后端没有找到正在运行的自动任务，可能是后端重启或任务已被清掉。',
            ),
            timestamp: Date.now(),
        };
        setAutoProgress(event);
        setAutoProgressLog((prev) => [...prev, event].slice(-80));
        setAutoLoading(false);
        setRunResult({
            mode: 'auto',
            task_mode: autoProgress.task_mode,
            success: false,
            character: autoProgress.character,
            stopped_reason: 'backend_missing',
            can_continue: false,
            continue_from: null,
            stats: autoProgress.stats,
            errors: [],
            processed: autoProgress.processed || 0,
            updated: autoProgress.updated || 0,
            run_until_empty: autoProgress.run_until_empty,
            max_batches: autoProgress.max_batches,
            max_rerolls: autoProgress.max_rerolls,
        });
        setNotice(
            tx(
                'The backend no longer has this task. The old progress was marked stopped; you can start automatic work again.',
                '后端已经没有这个自动任务了，页面已把旧进度标成停止；可以重新点开始自动工作。',
            ),
        );
        scheduleProgressRefresh(100);
    }, [autoProgress, scheduleProgressRefresh, setNotice, tx]);

    const loadMaintenanceRunSnapshot = useCallback(
        async (runId) => {
            if (!runId) return false;
            try {
                const res = await fetch(`${apiUrl}/memory-maintenance/runs/${encodeURIComponent(runId)}`, { headers });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success || !data.run) return false;
                adoptRunSnapshot(data.run);
                return true;
            } catch (e) {
                console.warn('Failed to load memory maintenance run:', e.message);
                return false;
            }
        },
        [adoptRunSnapshot, apiUrl, headers],
    );

    const loadActiveMaintenanceRun = useCallback(async () => {
        try {
            const query = new URLSearchParams({ active: '1' });
            const res = await fetch(`${apiUrl}/memory-maintenance/runs?${query.toString()}`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) return false;
            const run = (data.runs || [])[0];
            if (run) {
                adoptRunSnapshot(run);
                return true;
            }
            return false;
        } catch (e) {
            console.warn('Failed to load active memory maintenance run:', e.message);
            return false;
        }
    }, [adoptRunSnapshot, apiUrl, headers]);

    useEffect(() => {
        loadActiveMaintenanceRun();
    }, [loadActiveMaintenanceRun]);

    useEffect(() => {
        if (!autoLoading && autoProgress?.running !== true) return undefined;
        const timer = window.setInterval(async () => {
            const found = autoProgress?.run_id ? await loadMaintenanceRunSnapshot(autoProgress.run_id) : false;
            const foundActive = found || (await loadActiveMaintenanceRun());
            if (foundActive) {
                activeRunMissRef.current = 0;
            } else {
                activeRunMissRef.current += 1;
                if (activeRunMissRef.current >= 2) {
                    markAutoRunMissing();
                }
            }
            scheduleProgressRefresh(150);
        }, 4000);
        return () => window.clearInterval(timer);
    }, [
        autoLoading,
        autoProgress?.run_id,
        autoProgress?.running,
        loadActiveMaintenanceRun,
        loadMaintenanceRunSnapshot,
        markAutoRunMissing,
        scheduleProgressRefresh,
    ]);

    useEffect(
        () => () => {
            if (progressRefreshRef.current) {
                clearTimeout(progressRefreshRef.current);
            }
        },
        [],
    );

    useEffect(() => {
        const handleMaintenanceProgress = (event) => {
            const detail = event.detail || {};
            if (!detail.run_id) return;
            activeRunMissRef.current = 0;
            const eventCharacterId = String(detail.characterId || detail.character?.id || '');
            const currentCharacterId = String(selectedCharacterId || '');
            const externalImportEvent = detail.task_mode === 'external_import';
            setAutoProgress((prev) => {
                const sameRun = prev?.run_id && prev.run_id === detail.run_id;
                const relevantCharacter = !currentCharacterId || eventCharacterId === currentCharacterId;
                if (!sameRun && !relevantCharacter && !externalImportEvent) return prev;
                const isTerminal = detail.phase === 'done' || detail.phase === 'stopped';
                return {
                    ...(prev || {}),
                    ...detail,
                    running: !isTerminal,
                    last_event: detail,
                };
            });
            setAutoProgressLog((prev) => {
                const sameCurrentRun = autoProgress?.run_id && autoProgress.run_id === detail.run_id;
                const relevantCharacter = !currentCharacterId || eventCharacterId === currentCharacterId;
                if (!sameCurrentRun && !relevantCharacter && !externalImportEvent) return prev;
                return [...prev, detail].slice(-80);
            });
            if (['batch_success', 'batch_empty', 'done', 'stopped'].includes(detail.phase)) {
                scheduleProgressRefresh(detail.phase === 'batch_success' ? 700 : 100);
            }
            if (detail.phase === 'done' || detail.phase === 'stopped') {
                setAutoLoading(false);
                const nextResult = {
                    mode: 'auto',
                    task_mode: detail.task_mode,
                    success: detail.success,
                    character: detail.character,
                    import_id: detail.import_id,
                    source_app: detail.source_app,
                    import_mode: detail.import_mode,
                    filename: detail.filename,
                    stopped_reason: detail.stopped_reason,
                    can_continue: detail.can_continue,
                    continue_from: detail.continue_from,
                    stats: detail.stats,
                    errors: detail.errors || [],
                    processed: detail.processed || 0,
                    updated: detail.updated || 0,
                    run_until_empty: detail.run_until_empty,
                    max_batches: detail.max_batches,
                    max_rerolls: detail.max_rerolls,
                };
                setRunResult(nextResult);
                if (detail.phase === 'stopped' || detail.success === false) {
                    const errorText = summarizeAutoRunError(nextResult);
                    setNotice(
                        tx(
                            `Automatic task stopped: ${formatStoppedReason(detail.stopped_reason)}${errorText ? `; ${errorText}` : ''}`,
                            `自动任务已停止：${formatStoppedReason(detail.stopped_reason)}${errorText ? `；${errorText}` : ''}`,
                        ),
                    );
                }
            }
        };
        window.addEventListener('memory_maintenance_progress', handleMaintenanceProgress);
        return () => window.removeEventListener('memory_maintenance_progress', handleMaintenanceProgress);
    }, [autoProgress?.run_id, scheduleProgressRefresh, selectedCharacterId, setNotice, tx]);

    const loadBatchPreview = async () => {
        if (!selectedCharacterId) return;
        setBatchLoading(true);
        try {
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 30)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const res = await fetch(
                `${apiUrl}/memories/${selectedCharacterId}/maintenance/batch?limit=${limit}&offset=${offset}&status=pending`,
                { headers },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Batch load failed');
            setBatchPreview(data);
            setPromptPreview(data.prompt?.full_prompt || '');
            setRunResult(null);
        } catch (e) {
            alert(lang === 'en' ? `Batch load failed: ${e.message}` : `读取批次失败：${e.message}`);
        } finally {
            setBatchLoading(false);
        }
    };

    const loadTemporalPromptPreview = async () => {
        if (!selectedCharacterId) return;
        setTemporalPromptLoading(true);
        try {
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 40)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const query = new URLSearchParams({
                limit: String(limit),
                offset: String(offset),
                source: temporalPromptSource,
            });
            const res = await fetch(
                `${apiUrl}/memories/${selectedCharacterId}/maintenance/temporal-binding-batch?${query.toString()}`,
                { headers },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Temporal prompt load failed');
            setTemporalPromptPreview(data.prompt?.full_prompt || '');
            setNotice(
                tx(
                    `Generated source-scene and time-tag prompt: new library batch ${data.batch_index || batchIndex}, ${data.items?.length || 0} items.`,
                    `已生成来源场景+时间标签 prompt：新版库第 ${data.batch_index || batchIndex} 批，${data.items?.length || 0} 条。`,
                ),
            );
        } catch (e) {
            alert(
                tx(
                    `Failed to read time-binding supplemental prompt: ${e.message}`,
                    `读取时间绑定补充 prompt 失败：${e.message}`,
                ),
            );
        } finally {
            setTemporalPromptLoading(false);
        }
    };

    const runBatchMigration = async () => {
        if (!selectedCharacterId) return;
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert(
                tx(
                    'Fill and save the small model URL, key, and model name first.',
                    '请先填写并保存小模型 URL、Key 和模型名。',
                ),
            );
            return;
        }
        const confirmBatchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
        if (
            !window.confirm(
                tx(
                    `This will call the small model for old memory-card batch ${confirmBatchIndex} of the current role, ${settings.batch_size} items per batch, max output ${settings.max_output_tokens || 8000} tokens, then write results back to memory maintenance state. Continue?`,
                    `将调用小模型处理当前角色第 ${confirmBatchIndex} 批旧记忆卡片，每批 ${settings.batch_size} 条，输出上限 ${settings.max_output_tokens || 8000} tokens，并把结果写回记忆维护状态。继续吗？`,
                ),
            )
        ) {
            return;
        }
        setRunLoading(true);
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings),
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 30)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const res = await fetch(`${apiUrl}/memories/${selectedCharacterId}/maintenance/run`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ limit, offset, status: 'pending' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                if (data.raw_response || data.prompt) {
                    setRunResult(data);
                    setPromptPreview(data.prompt?.full_prompt || promptPreview);
                }
                throw new Error(data.error || 'Small model run failed');
            }
            setRunResult(data);
            setBatchPreview(
                (prev) => prev || { items: (data.normalized?.apply_items || []).map((item) => ({ id: item.id })) },
            );
            setPromptPreview(data.prompt?.full_prompt || promptPreview);
            setNotice(
                tx(
                    `Manual batch ${data.batch?.batch_index || batchIndex} processed ${data.batch?.item_count || 0} items, applied ${data.apply?.updated || 0} updates.`,
                    `手动第 ${data.batch?.batch_index || batchIndex} 批已处理 ${data.batch?.item_count || 0} 条，应用更新 ${data.apply?.updated || 0} 条。`,
                ),
            );
            await loadData();
        } catch (e) {
            alert(tx(`Small model summarization failed: ${e.message}`, `小模型归纳失败：${e.message}`));
        } finally {
            setRunLoading(false);
        }
    };

    const runTemporalBindingBatch = async () => {
        if (!selectedCharacterId) return;
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert(
                tx(
                    'Fill and save the small model URL, key, and model name first.',
                    '请先填写并保存小模型 URL、Key 和模型名。',
                ),
            );
            return;
        }
        const confirmBatchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
        if (
            !window.confirm(
                tx(
                    `This will call the small model to add source-scene and time tags to new-memory batch ${confirmBatchIndex} of the current role, ${settings.batch_size} items per batch. It will not rewrite memory content. Continue?`,
                    `将调用小模型给当前角色第 ${confirmBatchIndex} 批新版记忆补来源场景和时间标签，每批 ${settings.batch_size} 条。它不会改写记忆内容。继续吗？`,
                ),
            )
        ) {
            return;
        }
        setRunLoading(true);
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings),
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 40)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const res = await fetch(`${apiUrl}/memories/${selectedCharacterId}/maintenance/temporal-binding-run`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ limit, offset, source: 'new' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                if (data.raw_response || data.prompt) {
                    setRunResult(data);
                    setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
                }
                throw new Error(data.error || 'Small model supplemental run failed');
            }
            setRunResult({ ...data, mode: 'supplement' });
            setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
            setNotice(
                tx(
                    `Supplement batch ${data.batch?.batch_index || batchIndex} processed ${data.batch?.item_count || 0} items, wrote back ${data.apply?.updated || 0}.`,
                    `补充第 ${data.batch?.batch_index || batchIndex} 批已处理 ${data.batch?.item_count || 0} 条，写回 ${data.apply?.updated || 0} 条。`,
                ),
            );
            await loadData();
        } catch (e) {
            alert(tx(`Small model supplement failed: ${e.message}`, `小模型补充失败：${e.message}`));
        } finally {
            setRunLoading(false);
        }
    };

    const previewSelectedPrompt = () => {
        if (promptTaskMode === 'complete') {
            loadBatchPreview();
            return;
        }
        loadTemporalPromptPreview();
    };

    const runSelectedPromptTask = () => {
        if (promptTaskMode === 'complete') {
            runBatchMigration();
            return;
        }
        runTemporalBindingBatch();
    };

    const runAutoMigration = async (runOptions = {}) => {
        const options = runOptions?.nativeEvent ? {} : runOptions || {};
        const targetCharacterId = options.characterId || selectedCharacterId;
        const isContinuation = options.continuation === true;
        if (!targetCharacterId) {
            setNotice(
                tx(
                    'This account has no role memories available for automatic summarization. For external import, choose a file and use one-click import summary.',
                    '当前账号没有可自动总结的角色记忆。外部导入请先选择文件，然后直接点“一键导入总结”。',
                ),
            );
            return;
        }
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert(
                tx(
                    'Fill and save the small model URL, key, and model name first.',
                    '请先填写并保存小模型 URL、Key 和模型名。',
                ),
            );
            return;
        }
        const migrationTargets = overview?.migration_characters || overview?.legacy_by_character || [];
        const targetStats = migrationTargets.find((item) => String(item.character_id) === String(targetCharacterId));
        if (!targetStats || Number(targetStats.total || 0) <= 0) {
            setNotice(
                tx(
                    'This account has no pending legacy memories for automatic summarization. For external import, choose a file and run one-click import summary.',
                    '当前账号没有旧库 pending 可自动总结。外部导入请直接选择文件后一键导入总结。',
                ),
            );
            return;
        }
        if (!isContinuation && Number(targetStats.pending || 0) <= 0) {
            setNotice(
                tx(
                    `${targetStats.name || 'Current role'} has no pending legacy memories or external import material to summarize automatically.`,
                    `${targetStats.name || '当前角色'} 没有 pending 旧记忆或外部导入原料需要自动总结。`,
                ),
            );
            return;
        }
        const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 30)));
        const runUntilEmpty = String(autoMaxBatches || '').trim() === '';
        const maxBatches = runUntilEmpty ? null : Math.max(1, Number(autoMaxBatches || 1) || 1);
        const runScopeText = isContinuation
            ? tx(
                  'reread remaining pending items from the breakpoint and continue',
                  '从断点处重新读取剩余 pending 并继续',
              )
            : runUntilEmpty
              ? tx('run until pending is empty or a failure occurs', '一直跑到待分类为空或失败')
              : tx(`up to ${maxBatches} batches`, `最多 ${maxBatches} 批`);
        if (
            !options.skipConfirm &&
            !window.confirm(
                tx(
                    `Automatic summarization will process the current role's pending memories from the start, ${runScopeText}, ${limit} items per batch, max output ${settings.max_output_tokens || 8000} tokens, and write results back to memory maintenance state. Continue?`,
                    `自动总结会从当前角色的待分类记忆开头连续处理，${runScopeText}，每批 ${limit} 条，输出上限 ${settings.max_output_tokens || 8000} tokens，并把结果写回记忆维护状态。继续吗？`,
                ),
            )
        ) {
            return;
        }
        setAutoLoading(true);
        activeRunMissRef.current = 0;
        setAutoProgress({
            running: true,
            phase: 'start',
            characterId: targetCharacterId,
            processed: 0,
            updated: 0,
            applied_errors: 0,
            limit,
            max_batches: maxBatches,
            run_until_empty: runUntilEmpty,
            message: isContinuation
                ? tx('Preparing to continue from breakpoint.', '准备从断点继续。')
                : tx('Preparing automatic summarization.', '准备开始自动总结。'),
        });
        setAutoProgressLog([]);
        let keepAutoLoading = false;
        try {
            if (isContinuation) {
                setNotice(
                    tx(
                        'Continuing automatic summarization from the breakpoint. The first remaining pending batch will be reread.',
                        '正在从断点处继续自动总结，会重新读取当前剩余 pending 的第一批。',
                    ),
                );
            }
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings),
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });
            const res = await fetch(`${apiUrl}/memories/${targetCharacterId}/maintenance/auto-run`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    limit,
                    max_batches: maxBatches,
                    run_until_empty: runUntilEmpty,
                    max_rerolls: 3,
                    status: 'pending',
                    continue_from_breakpoint: isContinuation,
                    background: true,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                setRunResult(data);
                setBatchPreview(null);
                setPromptPreview(data.prompt?.full_prompt || promptPreview);
                await loadData();
                const lastError = (data.errors || []).slice(-1)[0]?.error;
                throw new Error(lastError || data.error || 'Auto migration failed');
            }
            if (data.accepted) {
                keepAutoLoading = !!data.run?.running;
                if (data.run) adoptRunSnapshot(data.run);
                setRunResult(null);
                setBatchPreview(null);
                setNotice(
                    data.reused
                        ? tx(
                              'An automatic summarization task is already running in the background. Progress display has been restored.',
                              '已有自动总结任务正在后台运行，已恢复进度显示。',
                          )
                        : tx(
                              `${isContinuation ? 'Continuation task' : 'Automatic summarization'} started in the background. Changing pages or refreshing will not interrupt it.`,
                              `${isContinuation ? '继续任务' : '自动总结'}已在后台启动，切换页面或刷新不会打断。`,
                          ),
                );
                scheduleProgressRefresh(300);
                return;
            }
            setRunResult(data);
            setAutoProgress((prev) => ({
                ...(prev || {}),
                running: false,
                phase: 'done',
                processed: data.processed || 0,
                updated: data.updated || 0,
                stopped_reason: data.stopped_reason,
                stats: data.stats,
            }));
            setBatchPreview(null);
            setPromptPreview(data.prompt?.full_prompt || promptPreview);
            const realRuns = (data.runs || []).filter((item) => !item.empty).length;
            const rerollCount = (data.runs || []).reduce((sum, item) => sum + Number(item.rerolls || 0), 0);
            const rerollText = rerollCount ? tx(`, rerolled ${rerollCount} times`, `，重 roll ${rerollCount} 次`) : '';
            const stoppedText = data.stopped_reason
                ? tx(
                      `, stop reason: ${formatStoppedReason(data.stopped_reason)}`,
                      `，停止原因：${formatStoppedReason(data.stopped_reason)}`,
                  )
                : '';
            setNotice(
                tx(
                    `${isContinuation ? 'Continuation task completed' : 'Automatic summarization completed'}: ran ${realRuns} batches, processed ${data.processed || 0} items, applied ${data.updated || 0} updates${rerollText}${stoppedText}.`,
                    `${isContinuation ? '继续任务完成' : '自动总结完成'}：跑了 ${realRuns} 批，处理 ${data.processed || 0} 条，应用更新 ${data.updated || 0} 条${rerollText}${stoppedText}。`,
                ),
            );
            await loadData();
        } catch (e) {
            setAutoProgress((prev) =>
                prev ? { ...prev, running: false, phase: prev.phase === 'stopped' ? prev.phase : 'stopped' } : prev,
            );
            alert(
                tx(
                    `${isContinuation ? 'Continuation task failed' : 'Automatic summarization failed'}: ${e.message}`,
                    `${isContinuation ? '继续任务失败' : '自动总结失败'}：${e.message}`,
                ),
            );
        } finally {
            setAutoLoading(keepAutoLoading);
        }
    };

    const runAutoSupplement = async (runOptions = {}) => {
        const options = runOptions?.nativeEvent ? {} : runOptions || {};
        const targetCharacterId = options.characterId || selectedCharacterId;
        const isContinuation = options.continuation === true;
        if (!targetCharacterId) {
            setNotice(
                tx(
                    'This account has no new memories available for automatic supplementation. For external import, choose a file and use one-click import summary.',
                    '当前账号没有新版记忆可自动补充。外部导入请先选择文件，然后直接点“一键导入总结”。',
                ),
            );
            return;
        }
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert(
                tx(
                    'Fill and save the small model URL, key, and model name first.',
                    '请先填写并保存小模型 URL、Key 和模型名。',
                ),
            );
            return;
        }
        const targetStats = (overview?.by_character || []).find(
            (item) => String(item.character_id) === String(targetCharacterId),
        );
        if (!targetStats || Number(targetStats.formal_total || targetStats.total || 0) <= 0) {
            setNotice(
                tx(
                    'The current role has no new memories to supplement yet. External imports write directly to the new memory library and do not need to submit a preview queue first.',
                    '当前角色还没有新版记忆可补充。外部导入会直接写入新版记忆库，不需要先提交预览队列。',
                ),
            );
            return;
        }
        const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 40)));
        const runUntilEmpty = String(autoMaxBatches || '').trim() === '';
        const maxBatches = runUntilEmpty ? null : Math.max(1, Number(autoMaxBatches || 1) || 1);
        const runScopeText = isContinuation
            ? tx('continue supplementation from the breakpoint', '从断点处继续补充')
            : runUntilEmpty
              ? tx('scan the whole new library or stop on failure', '扫完整个新版库或失败')
              : tx(`up to ${maxBatches} batches`, `最多 ${maxBatches} 批`);
        if (
            !options.skipConfirm &&
            !window.confirm(
                tx(
                    `Automatic supplementation will process the current role's new memories continuously, ${runScopeText}, ${limit} items per batch. It adds source-scene and time tags without rewriting memory content. Continue?`,
                    `自动补充会连续处理当前角色的新版记忆，${runScopeText}，每批 ${limit} 条，补来源场景和时间标签，不改写记忆。继续吗？`,
                ),
            )
        ) {
            return;
        }
        setAutoLoading(true);
        activeRunMissRef.current = 0;
        setAutoProgress({
            running: true,
            task_mode: 'supplement',
            phase: 'start',
            characterId: targetCharacterId,
            processed: 0,
            updated: 0,
            applied_errors: 0,
            limit,
            max_batches: maxBatches,
            run_until_empty: runUntilEmpty,
            message: isContinuation
                ? tx('Preparing to continue automatic supplementation.', '准备继续自动补充。')
                : tx('Preparing automatic supplementation.', '准备开始自动补充。'),
        });
        setAutoProgressLog([]);
        let keepAutoLoading = false;
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings),
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });
            const res = await fetch(`${apiUrl}/memories/${targetCharacterId}/maintenance/temporal-binding-auto-run`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    limit,
                    max_batches: maxBatches,
                    run_until_empty: runUntilEmpty,
                    max_rerolls: 3,
                    source: 'new',
                    continue_from_breakpoint: isContinuation,
                    background: true,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                setRunResult(data);
                setBatchPreview(null);
                setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
                await loadData();
                const lastError = (data.errors || []).slice(-1)[0]?.error;
                throw new Error(lastError || data.error || 'Auto supplemental run failed');
            }
            if (data.accepted) {
                keepAutoLoading = !!data.run?.running;
                if (data.run) adoptRunSnapshot(data.run);
                setRunResult(null);
                setBatchPreview(null);
                setNotice(
                    data.reused
                        ? tx(
                              'An automatic task is already running in the background. Progress display has been restored.',
                              '已有自动任务正在后台运行，已恢复进度显示。',
                          )
                        : tx(
                              `${isContinuation ? 'Supplement continuation' : 'Automatic supplementation'} started in the background. Changing pages or refreshing will not interrupt it.`,
                              `${isContinuation ? '继续补充' : '自动补充'}已在后台启动，切换页面或刷新不会打断。`,
                          ),
                );
                scheduleProgressRefresh(300);
                return;
            }
            setRunResult({ ...data, task_mode: 'supplement' });
            setAutoProgress((prev) => ({
                ...(prev || {}),
                running: false,
                task_mode: 'supplement',
                phase: 'done',
                processed: data.processed || 0,
                updated: data.updated || 0,
                stopped_reason: data.stopped_reason,
                stats: data.stats,
            }));
            setBatchPreview(null);
            setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
            const realRuns = (data.runs || []).filter((item) => !item.empty).length;
            const rerollCount = (data.runs || []).reduce((sum, item) => sum + Number(item.rerolls || 0), 0);
            const rerollText = rerollCount ? tx(`, rerolled ${rerollCount} times`, `，重 roll ${rerollCount} 次`) : '';
            const stoppedText = data.stopped_reason
                ? tx(
                      `, stop reason: ${formatStoppedReason(data.stopped_reason)}`,
                      `，停止原因：${formatStoppedReason(data.stopped_reason)}`,
                  )
                : '';
            setNotice(
                tx(
                    `${isContinuation ? 'Supplement continuation completed' : 'Automatic supplementation completed'}: ran ${realRuns} batches, processed ${data.processed || 0} items, wrote back ${data.updated || 0}${rerollText}${stoppedText}.`,
                    `${isContinuation ? '继续补充完成' : '自动补充完成'}：跑了 ${realRuns} 批，处理 ${data.processed || 0} 条，写回 ${data.updated || 0} 条${rerollText}${stoppedText}。`,
                ),
            );
            await loadData();
        } catch (e) {
            setAutoProgress((prev) =>
                prev ? { ...prev, running: false, phase: prev.phase === 'stopped' ? prev.phase : 'stopped' } : prev,
            );
            alert(
                tx(
                    `${isContinuation ? 'Supplement continuation failed' : 'Automatic supplementation failed'}: ${e.message}`,
                    `${isContinuation ? '继续补充失败' : '自动补充失败'}：${e.message}`,
                ),
            );
        } finally {
            setAutoLoading(keepAutoLoading);
        }
    };

    const runAutoSelectedTask = (options = {}) => {
        if (promptTaskMode === 'complete') {
            runAutoMigration(options);
            return;
        }
        runAutoSupplement(options);
    };

    return {
        autoMaxBatches,
        setAutoLoading,
        activeRunMissRef,
        setAutoProgress,
        setAutoProgressLog,
        setRunResult,
        adoptRunSnapshot,
        scheduleProgressRefresh,
        setManualBatchIndex,
        setBatchPreview,
        setPromptPreview,
        promptTaskMode,
        runResult,
        autoLoading,
        autoProgress,
        autoProgressLog,
        setPromptTaskMode,
        setMaintenanceMode,
        maintenanceMode,
        manualBatchIndex,
        previewSelectedPrompt,
        batchLoading,
        temporalPromptLoading,
        runSelectedPromptTask,
        runLoading,
        setAutoMaxBatches,
        runAutoSelectedTask,
        batchPreview,
        runAutoSupplement,
        runAutoMigration,
        promptPreview,
        temporalPromptPreview,
    };
}
