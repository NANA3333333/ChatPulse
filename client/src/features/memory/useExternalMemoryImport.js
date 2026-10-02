import { useRef, useState, useEffect } from 'react';
import {
    emptySettings,
    EXTERNAL_IMPORT_SESSION_KEY,
    formatNumber,
    detectExternalImportSource,
} from './memoryLabels.js';

export function useExternalMemoryImport({
    apiUrl,
    headers,
    setNotice,
    tx,
    settings,
    loadData,
    autoMaxBatches,
    setAutoLoading,
    activeRunMissRef,
    setAutoProgress,
    setAutoProgressLog,
    setSettings,
    setRunResult,
    adoptRunSnapshot,
    scheduleProgressRefresh,
    runResult,
    promptTaskMode,
    autoTaskUnavailable,
}) {
    const externalImportFileRef = useRef(null);
    const externalImportRequestRef = useRef(false);
    const [externalSourceApp, setExternalSourceApp] = useState('gpt');
    const [externalImportMode, setExternalImportMode] = useState('one_to_one');
    const [externalTargetName, setExternalTargetName] = useState('Claude');
    const [externalImportText, setExternalImportText] = useState('');
    const [externalImportFile, setExternalImportFile] = useState(null);
    const [externalImportPreview, setExternalImportPreview] = useState(null);
    const [selectedExternalRoles, setSelectedExternalRoles] = useState([]);
    const [externalImportLoading, setExternalImportLoading] = useState(false);
    const [externalImportCommitting, setExternalImportCommitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const restorePreview = async () => {
            try {
                const res = await fetch(`${apiUrl}/memory-import/external/latest`, { headers });
                const data = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok || !data.success || !data.import?.id || !Array.isArray(data.candidates)) {
                    sessionStorage.removeItem(EXTERNAL_IMPORT_SESSION_KEY);
                    setExternalImportPreview(null);
                    setSelectedExternalRoles([]);
                    return;
                }
                setExternalImportPreview(data);
                setSelectedExternalRoles((data.role_tags || []).map((tag) => tag.name).filter(Boolean));
                if (data.import.source_app) setExternalSourceApp(data.import.source_app);
                if (data.import.import_mode) setExternalImportMode(data.import.import_mode);
                sessionStorage.setItem(EXTERNAL_IMPORT_SESSION_KEY, JSON.stringify(data));
                setNotice(
                    (prev) =>
                        prev ||
                        tx(
                            `Restored the latest uncommitted external import preview: ${formatNumber(data.candidates.length)} candidates.`,
                            `已恢复最近一次未提交的外部导入预览：${formatNumber(data.candidates.length)} 条候选。`,
                        ),
                );
            } catch (e) {
                console.warn('Failed to restore latest external import preview:', e.message);
            }
        };
        restorePreview();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, headers, setNotice, tx]);

    const applyDetectedExternalImportSource = (detected) => {
        if (!detected) return;
        setExternalSourceApp(detected);
        setExternalImportMode(detected === 'sillytavern' ? 'multi_role' : 'one_to_one');
    };

    const handleExternalSourceChange = (value) => {
        setExternalSourceApp(value);
        setExternalImportPreview(null);
        setSelectedExternalRoles([]);
        if (value === 'sillytavern') {
            setExternalImportMode('multi_role');
        } else {
            setExternalImportMode('one_to_one');
        }
    };

    const previewExternalImport = async () => {
        if (externalImportRequestRef.current) return;
        if (!externalImportFile && !externalImportText.trim()) {
            console.warn('[External Import] preview blocked: no file or text');
            alert(tx('Upload an export file first, or paste a chat log.', '先上传导出文件，或者粘贴一段聊天记录。'));
            return;
        }
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            console.warn('[External Import] preview blocked: memory maintenance model settings missing');
            alert(
                tx(
                    'Configure the memory-library management small model below first.',
                    '先配置下面的记忆库管理小模型。',
                ),
            );
            return;
        }
        console.info('[External Import] preview request start', {
            source_app: externalSourceApp,
            import_mode: externalImportMode,
            has_file: !!externalImportFile,
            text_chars: externalImportText.trim().length,
        });
        const form = new FormData();
        let requestSourceApp = externalSourceApp;
        let requestImportMode = externalImportMode;
        if (externalImportFile) {
            const sample = await externalImportFile
                .slice(0, 300000)
                .text()
                .catch(() => '');
            const detected = detectExternalImportSource(externalImportFile.name, sample);
            if (detected) {
                requestSourceApp = detected;
                requestImportMode = detected === 'sillytavern' ? 'multi_role' : requestImportMode;
                applyDetectedExternalImportSource(detected);
            }
        }
        form.append('source_app', requestSourceApp);
        form.append('import_mode', requestImportMode);
        if (requestImportMode !== 'multi_role') {
            form.append('target_character_name', externalTargetName);
        }
        if (externalImportFile) form.append('file', externalImportFile);
        if (externalImportText.trim()) form.append('text', externalImportText.trim());
        setExternalImportLoading(true);
        externalImportRequestRef.current = true;
        setExternalImportPreview(null);
        setSelectedExternalRoles([]);
        try {
            sessionStorage.removeItem(EXTERNAL_IMPORT_SESSION_KEY);
            const res = await fetch(`${apiUrl}/memory-import/external/preview`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                const detail = [
                    data.error || tx('External memory preview failed', '外部记忆预览失败'),
                    data.raw_response_preview
                        ? tx(
                              `Raw model response: ${data.raw_response_preview}`,
                              `模型原始返回：${data.raw_response_preview}`,
                          )
                        : '',
                    Array.isArray(data.needs_review) && data.needs_review.length
                        ? tx(
                              `Needs review: ${JSON.stringify(data.needs_review).slice(0, 800)}`,
                              `需复核：${JSON.stringify(data.needs_review).slice(0, 800)}`,
                          )
                        : '',
                ]
                    .filter(Boolean)
                    .join('\n\n');
                throw new Error(detail);
            }
            console.info('[External Import] preview request success', {
                import_id: data.import?.id,
                roles: data.role_tags?.length || 0,
                candidates: data.candidates?.length || 0,
            });
            const roleNames = (data.role_tags || []).map((tag) => tag.name).filter(Boolean);
            const cleanStats = data.prompt_stats?.clean_stats;
            const cleanNote =
                cleanStats?.changed_messages || cleanStats?.dropped_messages
                    ? tx(
                          `, cleaned ${formatNumber(cleanStats.changed_messages || 0)} messages and dropped ${formatNumber(cleanStats.dropped_messages || 0)} noisy items`,
                          `，清洗 ${formatNumber(cleanStats.changed_messages || 0)} 条，丢弃噪声 ${formatNumber(cleanStats.dropped_messages || 0)} 条`,
                      )
                    : '';
            setExternalImportPreview(data);
            sessionStorage.setItem(EXTERNAL_IMPORT_SESSION_KEY, JSON.stringify(data));
            setSelectedExternalRoles(roleNames);
            setNotice(
                tx(
                    `External import preview complete: detected ${formatNumber(roleNames.length)} role tags and generated ${formatNumber(data.candidates?.length || 0)} new-memory candidates${cleanNote}.`,
                    `外部导入预览完成：识别 ${formatNumber(roleNames.length)} 个角色标签，生成 ${formatNumber(data.candidates?.length || 0)} 条新版记忆候选${cleanNote}。`,
                ),
            );
        } catch (e) {
            console.error('[External Import] preview request failed', e);
            alert(tx(`External memory preview failed: ${e.message}`, `外部记忆预览失败：${e.message}`));
        } finally {
            externalImportRequestRef.current = false;
            setExternalImportLoading(false);
        }
    };

    const toggleExternalRole = (name) => {
        setSelectedExternalRoles((prev) => {
            if (prev.includes(name)) return prev.filter((item) => item !== name);
            return [...prev, name];
        });
    };

    const commitExternalImport = async () => {
        const importId = externalImportPreview?.import?.id;
        if (!importId) return;
        const roleNames = selectedExternalRoles.length
            ? selectedExternalRoles
            : (externalImportPreview?.role_tags || []).map((tag) => tag.name).filter(Boolean);
        if (!roleNames.length) {
            alert(tx('Select at least one role tag.', '至少选择一个角色标签。'));
            return;
        }
        setExternalImportCommitting(true);
        try {
            const res = await fetch(`${apiUrl}/memory-import/external/${importId}/commit`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    selected_role_names: roleNames,
                    create_characters: true,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success)
                throw new Error(data.error || tx('External memory import failed', '外部记忆导入失败'));
            const created = (data.characters || []).filter((character) => character.created).length;
            setNotice(
                tx(
                    `Import complete: wrote ${formatNumber(data.imported || 0)} formal new memories and created ${formatNumber(created)} roles. They will not enter the legacy automatic summarization queue.`,
                    `导入完成：写入 ${formatNumber(data.imported || 0)} 条正式新记忆，创建 ${formatNumber(created)} 个角色。不会再进入旧库自动总结队列。`,
                ),
            );
            setExternalImportPreview(null);
            sessionStorage.removeItem(EXTERNAL_IMPORT_SESSION_KEY);
            setExternalImportText('');
            setExternalImportFile(null);
            if (externalImportFileRef.current) externalImportFileRef.current.value = '';
            await loadData();
        } catch (e) {
            alert(tx(`External memory import failed: ${e.message}`, `外部记忆导入失败：${e.message}`));
        } finally {
            setExternalImportCommitting(false);
        }
    };

    const runExternalImportAuto = async (runOptions = {}) => {
        const options = runOptions?.nativeEvent ? {} : runOptions || {};
        const continuation = options.continuation === true;
        const continueImportId = Number(options.importId || options.import_id || 0);
        const continueOffset = Math.max(0, Number(options.continueOffset || options.offset || 0) || 0);
        const retryLatestExternalImport = continuation && !continueImportId;
        if (externalImportRequestRef.current) return;
        if (!continueImportId && !retryLatestExternalImport && !externalImportFile && !externalImportText.trim()) {
            alert(tx('Upload an export file first, or paste a chat log.', '先上传导出文件，或者粘贴一段聊天记录。'));
            return;
        }
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert(
                tx(
                    'Configure the memory-library management small model below first.',
                    '先配置下面的记忆库管理小模型。',
                ),
            );
            return;
        }
        const form = new FormData();
        let requestSourceApp = externalSourceApp;
        let requestImportMode = externalImportMode;
        if (!continueImportId && externalImportFile) {
            const sample = await externalImportFile
                .slice(0, 300000)
                .text()
                .catch(() => '');
            const detected = detectExternalImportSource(externalImportFile.name, sample);
            if (detected) {
                requestSourceApp = detected;
                requestImportMode = detected === 'sillytavern' ? 'multi_role' : requestImportMode;
                applyDetectedExternalImportSource(detected);
            }
        }
        const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 10) || 10));
        const runUntilEmpty = String(autoMaxBatches || '').trim() === '';
        const maxBatches = runUntilEmpty ? '' : String(Math.max(1, Number(autoMaxBatches || 1) || 1));
        form.append('source_app', requestSourceApp);
        form.append('import_mode', requestImportMode);
        if (requestImportMode !== 'multi_role') {
            form.append('target_character_name', externalTargetName);
        }
        if (!continueImportId && externalImportFile) form.append('file', externalImportFile);
        if (!continueImportId && externalImportText.trim()) form.append('text', externalImportText.trim());
        form.append('limit', String(limit));
        form.append('max_batches', maxBatches);
        form.append('run_until_empty', runUntilEmpty ? 'true' : 'false');
        form.append('max_rerolls', '0');
        form.append('background', 'true');
        if (continueImportId) form.append('continue_import_id', String(continueImportId));
        if (retryLatestExternalImport) form.append('retry_latest_external_import', 'true');
        if (continueOffset > 0) form.append('continue_from_offset', String(continueOffset));

        setAutoLoading(true);
        setExternalImportLoading(true);
        externalImportRequestRef.current = true;
        activeRunMissRef.current = 0;
        setAutoProgress({
            running: true,
            task_mode: 'external_import',
            phase: 'start',
            characterId: '__external_import__',
            character: { id: '__external_import__', name: tx('External Import', '外部导入') },
            import_id: continueImportId || null,
            processed: continueOffset,
            updated: 0,
            applied_errors: 0,
            limit,
            max_batches: runUntilEmpty ? null : Number(maxBatches),
            run_until_empty: runUntilEmpty,
            max_rerolls: 0,
            message: continuation
                ? tx(
                      `Preparing to continue from breakpoint, skipped ${formatNumber(continueOffset)} items.`,
                      `准备从断点继续，已跳过 ${formatNumber(continueOffset)} 条。`,
                  )
                : tx(
                      `Preparing to summarize directly into the library in batches of ${limit} source messages.`,
                      `准备按每批 ${limit} 条正文直接总结入库。`,
                  ),
        });
        setAutoProgressLog([]);
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings),
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });

            sessionStorage.removeItem(EXTERNAL_IMPORT_SESSION_KEY);
            setExternalImportPreview(null);
            setSelectedExternalRoles([]);
            const res = await fetch(`${apiUrl}/memory-import/external/auto-run`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                setRunResult(data);
                await loadData();
                const lastError = (data.errors || []).slice(-1)[0]?.error;
                throw new Error(
                    lastError ||
                        data.error ||
                        tx('External import automatic summarization failed', '外部导入自动总结失败'),
                );
            }
            if (data.accepted) {
                if (data.run) adoptRunSnapshot(data.run);
                setRunResult(null);
                setNotice(
                    continuation
                        ? tx(
                              'External import continued from the breakpoint: only source text after the failed batch will be retried; written batches will not rerun.',
                              '外部导入已从断点继续：只重试失败批次之后的正文，不会重跑已写入的批次。',
                          )
                        : tx(
                              'External import started in the background: it will summarize by batch and write into the new memory library directly, without the second-scan queue.',
                              '外部导入已在后台启动：会直接分批总结并写入新记忆库，不再走二次扫描队列。',
                          ),
                );
                scheduleProgressRefresh(300);
                return;
            }
            setRunResult({ ...data, task_mode: 'external_import' });
            setAutoProgress((prev) => ({
                ...(prev || {}),
                running: false,
                task_mode: 'external_import',
                phase: data.success ? 'done' : 'stopped',
                processed: data.processed || 0,
                updated: data.updated || 0,
                stopped_reason: data.stopped_reason,
                stats: data.stats,
            }));
            setNotice(
                tx(
                    `External import complete: processed ${formatNumber(data.processed || 0)} source messages and wrote ${formatNumber(data.updated || 0)} formal memories.`,
                    `外部导入完成：处理 ${formatNumber(data.processed || 0)} 条正文，写入 ${formatNumber(data.updated || 0)} 条正式记忆。`,
                ),
            );
            setExternalImportText('');
            setExternalImportFile(null);
            if (externalImportFileRef.current) externalImportFileRef.current.value = '';
            await loadData();
        } catch (e) {
            setAutoProgress((prev) =>
                prev ? { ...prev, running: false, phase: prev.phase === 'stopped' ? prev.phase : 'stopped' } : prev,
            );
            alert(
                tx(
                    `External import automatic summarization failed: ${e.message}`,
                    `外部导入自动总结失败：${e.message}`,
                ),
            );
        } finally {
            externalImportRequestRef.current = false;
            setExternalImportLoading(false);
        }
    };

    const externalPreviewRoles = externalImportPreview?.role_tags || [];

    const externalPreviewCandidates = externalImportPreview?.candidates || [];

    const externalImportDraftReady = !!externalImportFile || !!externalImportText.trim();

    const canRetryExternalImport =
        runResult?.mode === 'auto' &&
        runResult.task_mode === 'external_import' &&
        runResult.success === false &&
        ['error', 'no_progress'].includes(String(runResult.stopped_reason || '')) &&
        (Number(runResult.continue_from?.pending || 0) > 0 ||
            externalImportDraftReady ||
            Number(runResult.processed || 0) > 0);

    const canRunExternalImportDirect = promptTaskMode === 'complete' && externalImportDraftReady;

    const canQueueExternalImport =
        promptTaskMode === 'complete' &&
        !!externalImportPreview?.import?.id &&
        (selectedExternalRoles.length > 0 || externalPreviewRoles.some((tag) => tag?.name));

    const canPrepareExternalImport = canRunExternalImportDirect || (autoTaskUnavailable && canQueueExternalImport);

    const externalPrepareLabel = canRunExternalImportDirect
        ? externalImportLoading
            ? tx('Importing', '导入中')
            : tx('One-click Import Summary', '一键导入总结')
        : externalImportCommitting
          ? tx('Writing', '写入中')
          : tx('Write Preview Results', '写入预览结果');

    const runExternalPrepareStep = () => {
        if (canRunExternalImportDirect) {
            runExternalImportAuto();
            return;
        }
        if (canQueueExternalImport) {
            commitExternalImport();
        }
    };

    const selectedExternalRoleSet = new Set(selectedExternalRoles);

    return {
        externalImportPreview,
        externalPreviewCandidates,
        externalSourceApp,
        handleExternalSourceChange,
        externalImportMode,
        setExternalImportMode,
        externalTargetName,
        setExternalTargetName,
        externalImportText,
        setExternalImportText,
        externalImportFileRef,
        setExternalImportFile,
        setExternalImportPreview,
        setSelectedExternalRoles,
        applyDetectedExternalImportSource,
        externalImportFile,
        previewExternalImport,
        externalImportLoading,
        externalImportCommitting,
        commitExternalImport,
        selectedExternalRoles,
        externalPreviewRoles,
        selectedExternalRoleSet,
        toggleExternalRole,
        canPrepareExternalImport,
        runExternalPrepareStep,
        externalPrepareLabel,
        canRunExternalImportDirect,
        canQueueExternalImport,
        canRetryExternalImport,
        runExternalImportAuto,
    };
}
