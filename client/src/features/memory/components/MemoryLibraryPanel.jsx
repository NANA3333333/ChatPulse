import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
    emptySettings,
    formatNumber,
    formatStoppedReason,
    detectExternalImportSource,
    getAutoRunErrorDetail,
    EXTERNAL_IMPORT_SOURCE_OPTIONS,
    optionLabel,
    formatProgressPhase,
    clipRunErrorText,
    formatRunResultDetails,
} from '../memoryLabels.js';
import { withLocalModelOption, LOCAL_OLLAMA_MODEL_PRESET } from '../../characters/localModelPreset.js';
import { buildMemoryThreads, getAllThreadItems, getMemoryItemKey, buildLensCount } from '../memoryThreads.js';
import { MemoryEditDialog } from './MemoryEditDialog.jsx';
import { SourceViewerModal } from './MemorySourceViewer.jsx';
import { MemoryCoreHeader } from './MemoryCoreHeader.jsx';
import { MemoryHealthBar } from './MemoryHealthBar.jsx';
import { MemoryMapView } from './MemoryMapView.jsx';
import { MemoryMaintenanceIntro } from './MemoryMaintenanceIntro.jsx';
import {
    SlidersHorizontal,
    Laptop,
    Search,
    Save,
    Upload,
    FileText,
    UserPlus,
    CheckCircle2,
    Database,
    Play,
} from 'lucide-react';
import './MemoryLibraryPanel.css';
import { useMemoryMaintenance } from '../useMemoryMaintenance.js';
import { useExternalMemoryImport } from '../useExternalMemoryImport.js';
import { useMemoryEditing } from '../useMemoryEditing.js';

function MemoryLibraryPanel({ apiUrl, contacts = [] }) {
    const { lang } = useLanguage();
    const tx = useCallback((en, zh) => (lang === 'en' ? en : zh), [lang]);
    const pageRef = useRef(null);
    const [overview, setOverview] = useState(null);
    const [library, setLibrary] = useState(null);
    const [settings, setSettings] = useState(emptySettings);
    const [activeCharacterId, setActiveCharacterId] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modelFetching, setModelFetching] = useState(false);
    const [models, setModels] = useState([]);
    const [modelError, setModelError] = useState('');
    const [notice, setNotice] = useState('');
    const [selectedCharacterId, setSelectedCharacterId] = useState('');
    const [libraryViewMode, setLibraryViewMode] = useState('new');
    const [memoryStatus, setMemoryStatus] = useState(null);
    const [memoryStatusLoading, setMemoryStatusLoading] = useState(false);
    const [memoryStatusError, setMemoryStatusError] = useState('');
    const [primaryView, setPrimaryView] = useState('map');
    const [memoryLens, setMemoryLens] = useState('all');
    const [memorySearch, setMemorySearch] = useState('');
    const [selectedMemoryKey, setSelectedMemoryKey] = useState('');
    const [mapSidebarsRaised, setMapSidebarsRaised] = useState(false);
    const headers = useMemo(
        () => ({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
        }),
        [],
    );
    const modelOptions = useMemo(() => withLocalModelOption(models), [models]);

    const applyLocalModelPreset = useCallback(() => {
        setSettings((prev) => ({
            ...prev,
            ...LOCAL_OLLAMA_MODEL_PRESET,
        }));
        setModels((prev) => withLocalModelOption(prev));
        setModelError('');
        setNotice(tx('Local Ollama model selected.', '已选择本地 Ollama 模型。'));
    }, [tx]);

    const handleModelSelect = useCallback(
        (modelName) => {
            if (modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name) {
                applyLocalModelPreset();
                return;
            }
            setSettings((prev) => ({ ...prev, model_name: modelName }));
        },
        [applyLocalModelPreset],
    );

    const getModelOptionLabel = useCallback(
        (modelName) =>
            modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name
                ? `${modelName} · ${tx('Local Ollama', '本地 Ollama')}`
                : modelName,
        [tx],
    );

    const getMemoryBackendLabel = useCallback(
        (backend) => {
            const labels = {
                'qdrant-primary-with-vectra-fallback': {
                    en: 'Qdrant primary / vectra fallback',
                    zh: 'Qdrant 主检索 / vectra 兜底',
                },
                'vectra-fallback-only': { en: 'vectra fallback only', zh: '仅使用 vectra 兜底' },
                'qdrant-online-collection-pending': {
                    en: 'Qdrant online / collection pending',
                    zh: 'Qdrant 在线 / 集合待建立',
                },
                'vectra-fallback-active': { en: 'vectra fallback active', zh: 'vectra 兜底中' },
            };
            return labels[backend]?.[lang] || backend || '-';
        },
        [lang],
    );

    const getMemoryStatusNote = useCallback(
        (status) => {
            const code = status?.statusNoteCode || '';
            const notes = {
                collection_pending_existing_memories: {
                    en: 'Qdrant is online, but this account has not built its vector collection yet.',
                    zh: 'Qdrant 已在线，但这个账号的向量集合还没有建立。',
                },
                collection_pending_first_memory: {
                    en: 'Qdrant is online. Your vector collection will appear after the first memory is written or indexed.',
                    zh: 'Qdrant 已在线。等第一批记忆被写入或建立索引后，你的向量集合就会出现。',
                },
            };
            if (notes[code]) return notes[code][lang];
            return status?.statusNote || '';
        },
        [lang],
    );

    useEffect(() => {
        const page = pageRef.current;
        if (!page) return undefined;

        let frameId = 0;
        const updateMapSidebarState = () => {
            frameId = 0;
            if (primaryView !== 'map') {
                setMapSidebarsRaised(false);
                return;
            }

            const toolbar = page.querySelector('.memory-map-toolbar');
            if (!toolbar) {
                setMapSidebarsRaised(false);
                return;
            }

            const pageRect = page.getBoundingClientRect();
            const toolbarRect = toolbar.getBoundingClientRect();
            const shouldRaise = toolbarRect.bottom <= pageRect.top + 10;
            setMapSidebarsRaised((current) => (current === shouldRaise ? current : shouldRaise));
        };

        const requestUpdate = () => {
            if (frameId) return;
            frameId = window.requestAnimationFrame(updateMapSidebarState);
        };

        updateMapSidebarState();
        page.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            page.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        };
    }, [primaryView]);

    const loadMemoryStatus = useCallback(async () => {
        setMemoryStatusLoading(true);
        setMemoryStatusError('');
        try {
            const res = await fetch(`${apiUrl}/user/memory-status`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load memory engine status');
            setMemoryStatus(data.status || null);
        } catch (e) {
            console.error('Failed to fetch memory status:', e);
            setMemoryStatusError(e.message || 'Failed to load memory engine status');
        } finally {
            setMemoryStatusLoading(false);
        }
    }, [apiUrl, headers]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({ limit_per_group: '36', forgetting_limit: '90' });
            if (activeCharacterId) query.set('character_id', activeCharacterId);
            query.set('source', libraryViewMode === 'old' ? 'legacy' : 'new');
            const [overviewRes, libraryRes] = await Promise.all([
                fetch(`${apiUrl}/memory-maintenance/overview`, { headers }),
                fetch(`${apiUrl}/memory-maintenance/library?${query.toString()}`, { headers }),
            ]);
            const overviewData = await overviewRes.json().catch(() => ({}));
            const libraryData = await libraryRes.json().catch(() => ({}));
            if (!overviewRes.ok || !overviewData.success)
                throw new Error(overviewData.error || 'Failed to load overview');
            if (!libraryRes.ok || !libraryData.success) throw new Error(libraryData.error || 'Failed to load library');
            setOverview(overviewData.overview || null);
            setLibrary(libraryData.library || null);
            setSettings({ ...emptySettings, ...(overviewData.settings || {}) });
            const topCharacter =
                overviewData.overview?.migration_characters?.[0]?.character_id ||
                overviewData.overview?.by_character?.[0]?.character_id ||
                contacts?.[0]?.id ||
                '';
            const availableCharacterIds = new Set(
                [
                    ...(overviewData.overview?.migration_characters || []).map((item) =>
                        String(item.character_id || ''),
                    ),
                    ...(overviewData.overview?.by_character || []).map((item) => String(item.character_id || '')),
                    ...(contacts || []).map((item) => String(item.id || '')),
                ].filter(Boolean),
            );
            setSelectedCharacterId((prev) => (prev && availableCharacterIds.has(String(prev)) ? prev : topCharacter));
        } catch (e) {
            console.error('Failed to load memory library:', e);
        } finally {
            setLoading(false);
        }
    }, [activeCharacterId, apiUrl, contacts, headers, libraryViewMode]);

    const refreshAll = useCallback(() => {
        loadData();
        loadMemoryStatus();
    }, [loadData, loadMemoryStatus]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        loadMemoryStatus();
    }, [loadMemoryStatus]);

    const {
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
    } = useMemoryMaintenance({
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
    });

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
            setSettings({ ...emptySettings, ...(data.settings || {}) });
            setNotice(tx('Small model settings saved.', '小模型配置已保存。'));
        } catch (e) {
            alert(lang === 'en' ? `Save failed: ${e.message}` : `保存失败：${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const fetchModels = async () => {
        if (!settings.api_endpoint || !settings.api_key) {
            setModelError(lang === 'en' ? 'Fill endpoint and key first.' : '请先填写 URL 和 Key。');
            return;
        }
        setModelFetching(true);
        setModelError('');
        setModels([]);
        try {
            const res = await fetch(`${apiUrl}/models`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
                },
                body: JSON.stringify({ endpoint: settings.api_endpoint, key: settings.api_key }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            const nextModels = data.models || [];
            setModels(nextModels);
            if (!nextModels.length)
                setModelError(
                    lang === 'en'
                        ? 'No remote models found. The local Ollama option is still available.'
                        : '未找到远端模型；仍可选择本地 Ollama。',
                );
        } catch (e) {
            setModelError(lang === 'en' ? `Fetch failed: ${e.message}` : `拉取失败：${e.message}`);
        } finally {
            setModelFetching(false);
        }
    };

    const jumpToCharacter = useCallback(
        (characterId = '') => {
            const nextId = String(characterId || '');
            const character = overview?.by_character?.find((item) => String(item.character_id) === nextId);
            setActiveCharacterId(nextId);
            if (nextId) setSelectedCharacterId(nextId);
            setSelectedMemoryKey('');
            setManualBatchIndex(1);
            setBatchPreview(null);
            setPromptPreview('');
            setRunResult(null);
            setNotice(
                nextId
                    ? tx(
                          `Switched to memory stats for ${character?.name || nextId}.`,
                          `已切到 ${character?.name || nextId} 的记忆库统计。`,
                      )
                    : tx('Switched back to all-role memory library.', '已切回全部角色记忆库。'),
            );
        },
        [overview?.by_character, setBatchPreview, setManualBatchIndex, setPromptPreview, setRunResult, tx],
    );

    const {
        editingMemory,
        setEditingMemory,
        saveMemoryEditor,
        editSaving,
        sourceViewer,
        setSourceViewer,
        openSourceViewer,
        openMemoryEditor,
        deleteMemoryItems,
        deletingIds,
    } = useMemoryEditing({ tx, apiUrl, headers, setNotice, loadData });

    const totals = overview?.totals || {};
    const characterStats = overview?.by_character || [];
    const migrationCharacters = overview?.migration_characters || overview?.legacy_by_character || characterStats;
    const hasMigrationTargets = migrationCharacters.some((item) => Number(item.total || 0) > 0);
    const hasSupplementTargets = characterStats.some((item) => Number(item.formal_total || item.total || 0) > 0);
    const autoTaskUnavailable = promptTaskMode === 'complete' ? !hasMigrationTargets : !hasSupplementTargets;
    const activeCharacter = characterStats.find((item) => String(item.character_id) === String(activeCharacterId));
    const categories = library?.categories || [];
    const newLibrary = library?.new_library || { total: 0, source_total: 0, categories: [] };
    const newCategories = newLibrary.categories || [];
    const newSourceGroups = newLibrary.source_groups || [];
    const forgettingGroups = library?.forgetting_groups || [];
    const fastForgetting = forgettingGroups.find((group) => group.key === 'fast')?.count || 0;
    const onCurveForgetting = forgettingGroups.find((group) => group.key === 'on_curve')?.count || 0;
    const canContinueAutoRun =
        runResult?.mode === 'auto' &&
        runResult.task_mode !== 'external_import' &&
        (runResult.can_continue === true ||
            (!runResult.success &&
                ['error', 'no_progress'].includes(runResult.stopped_reason) &&
                Number(runResult.stats?.pending || 0) > 0));
    const runErrorDetail = runResult ? getAutoRunErrorDetail(runResult) : null;
    const autoRunActive = autoLoading || autoProgress?.running === true;
    const latestProgressEvents = autoProgressLog.slice(-8).reverse();
    const latestProgressSamples = Array.isArray(autoProgress?.new_memory_samples)
        ? autoProgress.new_memory_samples
        : [];

    const {
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
    } = useExternalMemoryImport({
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
    });

    const scopedLegacyTotal = Number(activeCharacter?.legacy_total ?? totals.legacy_total ?? totals.total ?? 0);
    const scopedMigratedCards = Number(
        activeCharacter?.migrated_card_total ??
            activeCharacter?.migrated_total ??
            totals.migrated_card_total ??
            totals.total ??
            0,
    );
    const pendingMigrationCards = Math.max(0, scopedLegacyTotal - scopedMigratedCards);
    const viewStats = activeCharacter
        ? {
              total: activeCharacter.total,
              formal_total: activeCharacter.formal_total,
              migrated_card_total: activeCharacter.migrated_card_total,
              legacy_total: activeCharacter.legacy_total,
              active: activeCharacter.active,
              archived: activeCharacter.archived,
              total_retrieval_count: activeCharacter.retrieval_count,
              pending: activeCharacter.pending,
              classified: activeCharacter.classified,
              forgetting_total: fastForgetting + onCurveForgetting,
              fast_forgetting: fastForgetting,
              on_curve_forgetting: onCurveForgetting,
          }
        : {
              ...totals,
              forgetting_total: fastForgetting + onCurveForgetting,
              fast_forgetting: fastForgetting,
              on_curve_forgetting: onCurveForgetting,
          };
    const memoryStatusNote = getMemoryStatusNote(memoryStatus);
    const memoryThreads = buildMemoryThreads({
        newCategories,
        newSourceGroups,
        categories,
        forgettingGroups,
        lens: memoryLens,
        search: memorySearch,
        tx,
    });
    const allThreadItems = getAllThreadItems(memoryThreads);
    const selectedThreadEntry =
        allThreadItems.find(({ item }) => getMemoryItemKey(item) === selectedMemoryKey) || allThreadItems[0] || null;
    const selectedMemory = selectedThreadEntry?.item || null;
    const selectedThread = selectedThreadEntry?.thread || null;
    const forgettingTotal = fastForgetting + onCurveForgetting;
    const pendingMaintenanceCount = Number(viewStats.pending ?? totals.pending ?? pendingMigrationCards ?? 0);
    const temporalMaintenanceCount = buildLensCount(
        allThreadItems.map(({ item }) => item),
        'temporal',
    );
    const reviewCount =
        (Array.isArray(runResult?.normalized?.errors) ? runResult.normalized.errors.length : 0) +
        (Array.isArray(runResult?.apply?.errors) ? runResult.apply.errors.length : 0) +
        (Array.isArray(runResult?.errors) ? runResult.errors.length : 0) +
        Number(runResult?.applied_errors || 0);
    const selectedMaintenanceCharacterName =
        migrationCharacters.find((item) => String(item.character_id) === String(selectedCharacterId))?.name ||
        activeCharacter?.name ||
        '';

    return (
        <div
            id="memory-library-core-loop-redesign"
            ref={pageRef}
            className={`memory-library-page memory-core-loop-page${mapSidebarsRaised ? ' memory-map-sidebars-raised' : ''}`}
        >
            {notice && <div className="memory-lib-notice">{notice}</div>}

            {editingMemory && (
                <MemoryEditDialog
                    editingMemory={editingMemory}
                    tx={tx}
                    setEditingMemory={setEditingMemory}
                    saveMemoryEditor={saveMemoryEditor}
                    editSaving={editSaving}
                />
            )}

            <SourceViewerModal viewer={sourceViewer} onClose={() => setSourceViewer(null)} />

            <MemoryCoreHeader
                tx={tx}
                primaryView={primaryView}
                setPrimaryView={setPrimaryView}
                onRefresh={refreshAll}
                refreshing={loading || memoryStatusLoading}
                autoProgress={autoProgress}
                onImport={() => {
                    setPrimaryView('maintenance');
                    setPromptTaskMode('complete');
                    setMaintenanceMode('manual');
                    window.setTimeout(
                        () =>
                            document
                                .querySelector('.memory-external-import')
                                ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                        80,
                    );
                }}
            />
            <MemoryHealthBar
                tx={tx}
                memoryStatus={memoryStatus}
                memoryStatusLoading={memoryStatusLoading}
                memoryStatusError={memoryStatusError}
                getMemoryBackendLabel={getMemoryBackendLabel}
                memoryStatusNote={memoryStatusNote}
                totals={totals}
                characterStats={characterStats}
                autoProgress={autoProgress}
                setPrimaryView={setPrimaryView}
            />
            <div className="memory-core-content">
                {primaryView === 'map' ? (
                    <MemoryMapView
                        tx={tx}
                        threads={memoryThreads}
                        allThreadItems={allThreadItems}
                        selectedMemory={selectedMemory}
                        selectedThread={selectedThread}
                        selectedMemoryKey={selectedMemoryKey}
                        setSelectedMemoryKey={setSelectedMemoryKey}
                        characterStats={characterStats}
                        totals={totals}
                        activeCharacterId={activeCharacterId}
                        jumpToCharacter={jumpToCharacter}
                        memoryLens={memoryLens}
                        setMemoryLens={setMemoryLens}
                        memorySearch={memorySearch}
                        setMemorySearch={setMemorySearch}
                        libraryViewMode={libraryViewMode}
                        setLibraryViewMode={setLibraryViewMode}
                        forgettingTotal={forgettingTotal}
                        onViewSource={openSourceViewer}
                        onEdit={openMemoryEditor}
                        onDelete={deleteMemoryItems}
                        deletingIds={deletingIds}
                    />
                ) : (
                    <div className="memory-maintenance-layout">
                        <MemoryMaintenanceIntro
                            tx={tx}
                            autoProgress={autoProgress}
                            promptTaskMode={promptTaskMode}
                            setPromptTaskMode={setPromptTaskMode}
                            maintenanceMode={maintenanceMode}
                            setMaintenanceMode={setMaintenanceMode}
                            activeCharacterName={selectedMaintenanceCharacterName}
                            pendingCount={pendingMaintenanceCount}
                            temporalCount={temporalMaintenanceCount}
                            reviewCount={reviewCount}
                            onShowExternalImport={() =>
                                document
                                    .querySelector('.memory-external-import')
                                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }
                        />
                        <div className="memory-command-workspace memory-maintenance-workspace memory-maintenance-main-only">
                            <main className="memory-command-main">
                                <div className="memory-lib-section">
                                    <div className="memory-lib-section-title">
                                        <SlidersHorizontal size={16} />{' '}
                                        {tx('Memory Library Management Model', '记忆库管理小模型')}
                                    </div>
                                    <div className="memory-lib-model-grid">
                                        <label>
                                            <span>URL</span>
                                            <input
                                                value={settings.api_endpoint}
                                                onChange={(e) =>
                                                    setSettings((prev) => ({ ...prev, api_endpoint: e.target.value }))
                                                }
                                                placeholder="https://api.openai.com/v1"
                                            />
                                        </label>
                                        <label>
                                            <span>{tx('Key', '密钥')}</span>
                                            <input
                                                type="password"
                                                value={settings.api_key}
                                                onChange={(e) =>
                                                    setSettings((prev) => ({ ...prev, api_key: e.target.value }))
                                                }
                                                placeholder="sk-..."
                                            />
                                        </label>
                                        <label>
                                            <span>{tx('Model', '模型')}</span>
                                            <input
                                                value={settings.model_name}
                                                onChange={(e) =>
                                                    setSettings((prev) => ({ ...prev, model_name: e.target.value }))
                                                }
                                                placeholder={tx('model name', '模型名称')}
                                            />
                                        </label>
                                        <div className="memory-lib-model-actions">
                                            <button className="memory-lib-button ghost" onClick={applyLocalModelPreset}>
                                                <Laptop size={15} /> {tx('Use Local Model', '使用本地模型')}
                                            </button>
                                            <button
                                                className="memory-lib-button ghost"
                                                onClick={fetchModels}
                                                disabled={modelFetching}
                                            >
                                                <Search size={15} />{' '}
                                                {modelFetching
                                                    ? tx('Fetching', '拉取中')
                                                    : tx('Fetch Models', '拉取模型')}
                                            </button>
                                            <button
                                                className="memory-lib-button"
                                                onClick={saveSettings}
                                                disabled={saving}
                                            >
                                                <Save size={15} />{' '}
                                                {saving ? tx('Saving', '保存中') : tx('Save Config', '保存配置')}
                                            </button>
                                        </div>
                                    </div>
                                    {modelError && <div className="memory-lib-error">{modelError}</div>}
                                    {modelOptions.length > 0 && (
                                        <select
                                            className="memory-lib-model-select"
                                            value=""
                                            onChange={(e) => handleModelSelect(e.target.value)}
                                        >
                                            <option value="" disabled>
                                                {tx('Choose a model', '选择模型')}
                                            </option>
                                            {modelOptions.map((model) => (
                                                <option key={model} value={model}>
                                                    {getModelOptionLabel(model)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <div className="memory-external-import">
                                        <div className="memory-lib-prompt-head">
                                            <strong>
                                                <Upload size={15} /> {tx('Import Memories', '导入记忆')}
                                            </strong>
                                            <span>
                                                {externalImportPreview
                                                    ? tx(
                                                          `${formatNumber(externalPreviewCandidates.length)} candidates`,
                                                          `候选 ${formatNumber(externalPreviewCandidates.length)} 条`,
                                                      )
                                                    : 'GPT / Gemini / SillyTavern'}
                                            </span>
                                        </div>
                                        <div className="memory-lib-model-grid external">
                                            <label>
                                                <span>{tx('Source', '来源')}</span>
                                                <select
                                                    value={externalSourceApp}
                                                    onChange={(e) => handleExternalSourceChange(e.target.value)}
                                                >
                                                    {EXTERNAL_IMPORT_SOURCE_OPTIONS.map(([value, label]) => (
                                                        <option value={value} key={value}>
                                                            {optionLabel(value, label)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label>
                                                <span>{tx('Import Type', '导入类型')}</span>
                                                <select
                                                    value={externalImportMode}
                                                    onChange={(e) => setExternalImportMode(e.target.value)}
                                                >
                                                    <option value="one_to_one">{tx('One-to-one', '一对一')}</option>
                                                    <option value="multi_role">
                                                        {tx('Multi-person / multi-role', '多人/多角色')}
                                                    </option>
                                                </select>
                                            </label>
                                            {externalImportMode !== 'multi_role' ? (
                                                <label>
                                                    <span>{tx('Bound Role Name', '绑定角色名')}</span>
                                                    <input
                                                        value={externalTargetName}
                                                        onChange={(e) => setExternalTargetName(e.target.value)}
                                                        placeholder={tx('e.g. Claude / Gemini', '例如 Claude / Gemini')}
                                                    />
                                                </label>
                                            ) : (
                                                <div className="memory-external-import-hint">
                                                    {tx(
                                                        'SillyTavern multi-role imports identify explicit names from the text; no role name is needed here.',
                                                        'SillyTavern 多人导入会从正文里识别明确姓名；不需要再填角色名。',
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <textarea
                                            className="memory-external-textarea"
                                            value={externalImportText}
                                            onChange={(e) => setExternalImportText(e.target.value)}
                                            placeholder={tx(
                                                'Paste exported chat logs here. You can also leave this empty when uploading a file.',
                                                '可以直接粘贴导出的聊天记录；上传文件时这里也可以留空。',
                                            )}
                                        />
                                        <div className="memory-lib-batch-tools external">
                                            <input
                                                ref={externalImportFileRef}
                                                type="file"
                                                accept=".json,.jsonl,.ndjson,.txt,.md,.markdown,application/json,text/plain"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0] || null;
                                                    setExternalImportFile(file);
                                                    setExternalImportPreview(null);
                                                    setSelectedExternalRoles([]);
                                                    if (file) {
                                                        const sample = await file
                                                            .slice(0, 300000)
                                                            .text()
                                                            .catch(() => '');
                                                        const detected = detectExternalImportSource(file.name, sample);
                                                        applyDetectedExternalImportSource(detected);
                                                    }
                                                }}
                                                hidden
                                            />
                                            <button
                                                type="button"
                                                className="memory-lib-button ghost"
                                                onClick={() => externalImportFileRef.current?.click()}
                                            >
                                                <FileText size={15} />{' '}
                                                {externalImportFile
                                                    ? externalImportFile.name
                                                    : tx('Choose File', '选择文件')}
                                            </button>
                                            <button
                                                type="button"
                                                className="memory-lib-button"
                                                onClick={previewExternalImport}
                                                disabled={externalImportLoading || externalImportCommitting}
                                            >
                                                <Search size={15} />{' '}
                                                {externalImportLoading
                                                    ? tx('Summarizing', '总结中')
                                                    : tx('Summary Preview', '总结预览')}
                                            </button>
                                            {externalImportPreview && (
                                                <button
                                                    type="button"
                                                    className="memory-lib-button"
                                                    onClick={commitExternalImport}
                                                    disabled={
                                                        externalImportCommitting || selectedExternalRoles.length === 0
                                                    }
                                                >
                                                    <UserPlus size={15} />{' '}
                                                    {externalImportCommitting
                                                        ? tx('Importing', '导入中')
                                                        : tx('Create Roles & Write', '创建角色并写入')}
                                                </button>
                                            )}
                                        </div>
                                        {externalImportPreview && (
                                            <div className="memory-external-preview">
                                                <div className="memory-external-role-head">
                                                    <strong>{tx('Role Tags', '角色标签')}</strong>
                                                    <span>
                                                        {tx(
                                                            'Checked names will create same-name roles automatically; existing roles with the same names are reused. After submit, memories write directly to the new library instead of the legacy summarization queue.',
                                                            '勾选后会自动创建同名角色；已有同名角色会复用。提交后直接写入新版记忆库，不再进入旧库自动总结队列。',
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="memory-external-role-tags">
                                                    {externalPreviewRoles.map((tag) => (
                                                        <button
                                                            type="button"
                                                            key={tag.name}
                                                            className={
                                                                selectedExternalRoleSet.has(tag.name) ? 'active' : ''
                                                            }
                                                            onClick={() => toggleExternalRole(tag.name)}
                                                        >
                                                            {selectedExternalRoleSet.has(tag.name) && (
                                                                <CheckCircle2 size={13} />
                                                            )}
                                                            {tag.name}
                                                            <small>
                                                                {Math.round(Number(tag.confidence || 0) * 100)}%
                                                            </small>
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="memory-external-candidates">
                                                    {externalPreviewCandidates.slice(0, 12).map((item) => (
                                                        <div key={item.id}>
                                                            <b>
                                                                {item.character_names?.join(' / ') ||
                                                                    tx('Unbound', '未绑定')}
                                                            </b>
                                                            <span>{item.summary}</span>
                                                            <small>
                                                                {optionLabel(item.memory_focus, item.memory_focus)} ·{' '}
                                                                {optionLabel(item.memory_tier, item.memory_tier)} ·{' '}
                                                                {tx('Importance', '重要性')} {item.importance}
                                                            </small>
                                                        </div>
                                                    ))}
                                                </div>
                                                {externalPreviewCandidates.length > 12 && (
                                                    <div className="memory-lib-more">
                                                        {tx(
                                                            `${formatNumber(externalPreviewCandidates.length - 12)} more candidates will be imported together.`,
                                                            `还有 ${formatNumber(externalPreviewCandidates.length - 12)} 条候选会一起导入。`,
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="memory-lib-batch-row">
                                        <div>
                                            <strong>
                                                {tx(
                                                    `Read ${settings.batch_size} ${promptTaskMode === 'complete' ? 'old memory cards' : 'formal new memories'} each round`,
                                                    `每轮读取 ${settings.batch_size} 条${promptTaskMode === 'complete' ? '旧记忆卡片' : '正式新版记忆'}`,
                                                )}
                                            </strong>
                                            <p>
                                                {promptTaskMode === 'complete'
                                                    ? tx(
                                                          'The small model only reads card summaries; it does not read raw dialogue/logs or embedding index text.',
                                                          '小模型只吃卡片概况，输出的新记忆统一中文，不吃原始对话/日志或 embedding 索引文本。',
                                                      )
                                                    : tx(
                                                          'Supplement mode only scans formal new memories, not carrier cards; it adds source-scene and time tags without rewriting content.',
                                                          '补充模式只扫正式新版记忆，不扫承载卡片；只补来源场景和时间标签，不改写记忆。',
                                                      )}
                                            </p>
                                        </div>
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            step="5"
                                            value={settings.batch_size}
                                            onChange={(e) =>
                                                setSettings((prev) => ({ ...prev, batch_size: Number(e.target.value) }))
                                            }
                                        />
                                    </div>
                                    <div className="memory-lib-batch-row">
                                        <div>
                                            <strong>
                                                {tx(
                                                    `Small model output cap ${settings.max_output_tokens || 8000} tokens`,
                                                    `小模型输出上限 ${settings.max_output_tokens || 8000} tokens`,
                                                )}
                                            </strong>
                                            <p>
                                                {tx(
                                                    'If failure logs show finish_reason=length, raise this value. Reasoning models consume more output budget.',
                                                    '失败日志如果出现 finish_reason=length，就把这里调大；推理模型会消耗更多输出预算。',
                                                )}
                                            </p>
                                        </div>
                                        <input
                                            type="range"
                                            min="1000"
                                            max="20000"
                                            step="500"
                                            value={settings.max_output_tokens || 8000}
                                            onChange={(e) =>
                                                setSettings((prev) => ({
                                                    ...prev,
                                                    max_output_tokens: Number(e.target.value),
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="memory-lib-mode-tabs">
                                        <button
                                            type="button"
                                            className={maintenanceMode === 'manual' ? 'active' : ''}
                                            onClick={() => setMaintenanceMode('manual')}
                                        >
                                            {tx('Manual Batch Summary', '手动选择批次总结')}
                                        </button>
                                        <button
                                            type="button"
                                            className={maintenanceMode === 'auto' ? 'active' : ''}
                                            onClick={() => setMaintenanceMode('auto')}
                                        >
                                            {tx('Automatic Summary', '自动总结')}
                                        </button>
                                    </div>
                                    <div className="memory-lib-batch-tools primary">
                                        <select
                                            value={selectedCharacterId}
                                            onChange={(e) => setSelectedCharacterId(e.target.value)}
                                        >
                                            {migrationCharacters.length === 0 && (
                                                <option value="">
                                                    {tx('No processable legacy memories', '没有可处理的旧库记忆')}
                                                </option>
                                            )}
                                            {migrationCharacters.map((item) => (
                                                <option value={item.character_id} key={item.character_id}>
                                                    {item.name} ({tx('legacy', '旧库')} {formatNumber(item.total)} /{' '}
                                                    {tx('new', '新版')}{' '}
                                                    {formatNumber(
                                                        item.formal_total ?? item.new_total ?? item.migrated_total ?? 0,
                                                    )}
                                                    )
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="memory-lib-mode-tabs">
                                        <button
                                            type="button"
                                            className={promptTaskMode === 'complete' ? 'active' : ''}
                                            onClick={() => setPromptTaskMode('complete')}
                                        >
                                            {tx('Complete', '完整')}
                                        </button>
                                        <button
                                            type="button"
                                            className={promptTaskMode === 'supplement' ? 'active' : ''}
                                            onClick={() => setPromptTaskMode('supplement')}
                                        >
                                            {tx('Supplement', '补充')}
                                        </button>
                                    </div>
                                    <div className="memory-lib-mode-copy">
                                        {promptTaskMode === 'complete'
                                            ? tx(
                                                  'Complete: migrate legacy / external app memories into the new library while writing source-scene and time tags.',
                                                  '完整：把旧库/外部 App 记忆迁移进新版库，同时写来源场景和时间标签。',
                                              )
                                            : tx(
                                                  'Supplement: only add source-scene and time tags to existing new memories without rewriting content.',
                                                  '补充：只给现有新版记忆补来源场景和时间标签，不改写记忆内容。',
                                              )}
                                    </div>
                                    {maintenanceMode === 'manual' ? (
                                        <div className="memory-lib-mode-panel">
                                            <label className="memory-lib-inline-field">
                                                <span>{tx('Batch Number', '选择第几批')}</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={manualBatchIndex}
                                                    onChange={(e) =>
                                                        setManualBatchIndex(Math.max(1, Number(e.target.value || 1)))
                                                    }
                                                />
                                            </label>
                                            <div className="memory-lib-mode-copy">
                                                {tx(
                                                    `Batch ${manualBatchIndex} will skip the first ${formatNumber((Math.max(1, Number(manualBatchIndex || 1)) - 1) * Number(settings.batch_size || 30))} items; complete mode processes pending old cards, supplement mode processes existing new memories.`,
                                                    `第 ${manualBatchIndex} 批会跳过前 ${formatNumber((Math.max(1, Number(manualBatchIndex || 1)) - 1) * Number(settings.batch_size || 30))} 条；完整处理 pending 旧卡片，补充处理已有新版记忆。`,
                                                )}
                                            </div>
                                            <div className="memory-lib-batch-tools">
                                                <button
                                                    className="memory-lib-button ghost"
                                                    onClick={previewSelectedPrompt}
                                                    disabled={
                                                        batchLoading ||
                                                        temporalPromptLoading ||
                                                        !selectedCharacterId ||
                                                        autoTaskUnavailable
                                                    }
                                                >
                                                    <Database size={15} />{' '}
                                                    {batchLoading || temporalPromptLoading
                                                        ? tx('Generating', '生成中')
                                                        : autoTaskUnavailable
                                                          ? tx('Nothing to Preview', '无可预览')
                                                          : tx('Preview Prompt', '预览 Prompt')}
                                                </button>
                                                <button
                                                    className="memory-lib-button"
                                                    onClick={() =>
                                                        canPrepareExternalImport
                                                            ? runExternalPrepareStep()
                                                            : runSelectedPromptTask()
                                                    }
                                                    disabled={
                                                        runLoading ||
                                                        autoRunActive ||
                                                        externalImportLoading ||
                                                        externalImportCommitting ||
                                                        (!canPrepareExternalImport &&
                                                            (!selectedCharacterId || autoTaskUnavailable))
                                                    }
                                                >
                                                    <Play size={15} />{' '}
                                                    {runLoading
                                                        ? tx('Working', '工作中')
                                                        : autoTaskUnavailable
                                                          ? canPrepareExternalImport
                                                              ? externalPrepareLabel
                                                              : tx('Nothing to Process', '无可处理')
                                                          : tx('Start Work', '开始工作')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="memory-lib-mode-panel">
                                            <label className="memory-lib-inline-field">
                                                <span>{tx('Number of Batches', '连续跑几批')}</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder={tx('No limit', '不限制')}
                                                    value={autoMaxBatches}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        setAutoMaxBatches(
                                                            raw === ''
                                                                ? ''
                                                                : String(Math.max(1, Number(raw || 1) || 1)),
                                                        );
                                                    }}
                                                />
                                            </label>
                                            <div className="memory-lib-mode-copy">
                                                {promptTaskMode === 'complete'
                                                    ? canRunExternalImportDirect
                                                        ? tx(
                                                              `External import will call the small model in batches of ${formatNumber(settings.batch_size || 10)} source messages, tag roles for each new memory, and write into the new library; it will not enter the second-scan queue.`,
                                                              `外部导入会直接按每批 ${formatNumber(settings.batch_size || 10)} 条正文循环调用小模型，给每条新记忆打角色标签并写入新版库；不会再入队二次扫描。`,
                                                          )
                                                        : tx(
                                                              'Automatic complete mode processes continuously from the first pending batch. After each batch, the next batch rereads remaining pending items; blank means no batch limit. Failed batches retry up to 3 times; successful batches call once.',
                                                              '自动完整会从 pending 第一批开始连续处理，每批结束后下一批会重新读取剩余 pending；留空则不限制批数。单批失败最多重试 3 次，正常成功只调用 1 次。',
                                                          )
                                                    : tx(
                                                          'Automatic supplement mode continuously scans existing new memories and adds source-scene and time tags. Blank means scan the whole new library. Failed batches retry up to 3 times; successful batches call once.',
                                                          '自动补充会连续扫描已有新版记忆，补来源场景和时间标签；留空则扫完整个新版库。单批失败最多重试 3 次，正常成功只调用 1 次。',
                                                      )}
                                                {autoTaskUnavailable && !canRunExternalImportDirect && (
                                                    <span>
                                                        {tx(
                                                            ` This account has no processable ${promptTaskMode === 'complete' ? 'legacy pending / external import material' : 'new memories'}; ${canQueueExternalImport ? 'you can submit the current external import preview to the summary queue first.' : 'you can choose an external export file and run one-click import summary.'}`,
                                                            ` 当前账号没有可处理的${promptTaskMode === 'complete' ? '旧库 pending / 外部导入原料' : '新版记忆'}；${canQueueExternalImport ? '可以先把当前外部导入预览提交到总结队列。' : '可以选择外部导出文件后直接一键导入总结。'}`,
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="memory-lib-batch-tools">
                                                <button
                                                    className="memory-lib-button"
                                                    onClick={() =>
                                                        canPrepareExternalImport
                                                            ? runExternalPrepareStep()
                                                            : runAutoSelectedTask()
                                                    }
                                                    disabled={
                                                        autoRunActive ||
                                                        runLoading ||
                                                        externalImportLoading ||
                                                        externalImportCommitting ||
                                                        (!canPrepareExternalImport &&
                                                            (!selectedCharacterId || autoTaskUnavailable))
                                                    }
                                                >
                                                    <Play size={15} />{' '}
                                                    {autoRunActive
                                                        ? tx('Automatic Work Running', '自动工作中')
                                                        : autoTaskUnavailable
                                                          ? canPrepareExternalImport
                                                              ? externalPrepareLabel
                                                              : tx('No Automatic Work', '无可自动工作')
                                                          : tx('Start Automatic Work', '开始自动工作')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {autoProgress && (
                                        <div
                                            className={`memory-lib-live-progress ${autoProgress.running ? 'running' : ''}`}
                                        >
                                            <div className="memory-lib-live-head">
                                                <div>
                                                    <strong>
                                                        {autoProgress.task_mode === 'external_import'
                                                            ? autoProgress.running
                                                                ? tx('External Import Running', '外部导入运行中')
                                                                : tx('External Import Status', '外部导入状态')
                                                            : autoProgress.task_mode === 'supplement'
                                                              ? autoProgress.running
                                                                  ? tx('Automatic Supplement Running', '自动补充运行中')
                                                                  : tx('Automatic Supplement Status', '自动补充状态')
                                                              : autoProgress.running
                                                                ? tx('Automatic Summary Running', '自动总结运行中')
                                                                : tx('Automatic Summary Status', '自动总结状态')}
                                                    </strong>
                                                    <p>
                                                        {autoProgress.message ||
                                                            formatProgressPhase(autoProgress.phase)}
                                                    </p>
                                                </div>
                                                <span>{formatProgressPhase(autoProgress.phase)}</span>
                                            </div>
                                            {autoProgress.max_batches && autoProgress.batch_number && (
                                                <div className="memory-lib-live-bar">
                                                    <i
                                                        style={{
                                                            width: `${Math.min(100, Math.round((Number(autoProgress.batch_number || 0) / Math.max(1, Number(autoProgress.max_batches || 1))) * 100))}%`,
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="memory-lib-live-grid">
                                                <span>
                                                    {tx('Batch:', '批次：')}
                                                    {autoProgress.batch_number
                                                        ? tx(
                                                              `Batch ${autoProgress.batch_number}`,
                                                              `第 ${autoProgress.batch_number} 批`,
                                                          )
                                                        : tx('Waiting', '等待中')}
                                                </span>
                                                <span>
                                                    {tx('Attempt:', '尝试：')}
                                                    {autoProgress.attempt
                                                        ? `${autoProgress.attempt}/${Number(autoProgress.max_rerolls ?? 3) + 1}`
                                                        : tx('Not started', '未开始')}
                                                </span>
                                                <span>
                                                    {tx('Processed:', '已处理：')}
                                                    {formatNumber(autoProgress.processed)}
                                                </span>
                                                <span>
                                                    {tx('Written:', '已写回：')}
                                                    {formatNumber(autoProgress.updated)}
                                                </span>
                                                <span>
                                                    {tx('Pending:', '待分类：')}
                                                    {formatNumber(
                                                        autoProgress.remaining_pending_after_batch ??
                                                            autoProgress.pending_before ??
                                                            autoProgress.stats?.pending,
                                                    )}
                                                </span>
                                                <span>
                                                    {tx('Write Errors:', '写库错误：')}
                                                    {formatNumber(autoProgress.applied_errors)}
                                                </span>
                                            </div>
                                            {latestProgressSamples.length > 0 && (
                                                <div className="memory-lib-live-samples">
                                                    <strong>
                                                        {tx('New Summary Preview for This Batch', '本批新总结预览')}
                                                    </strong>
                                                    {latestProgressSamples.map((sample, idx) => (
                                                        <p key={`${idx}-${sample}`}>{sample}</p>
                                                    ))}
                                                </div>
                                            )}
                                            {latestProgressEvents.length > 0 && (
                                                <div className="memory-lib-live-log">
                                                    {latestProgressEvents.map((event, idx) => (
                                                        <span key={`${event.run_id}-${event.timestamp}-${idx}`}>
                                                            {formatProgressPhase(event.phase)}
                                                            {event.batch_number
                                                                ? tx(
                                                                      ` · batch ${event.batch_number}`,
                                                                      ` · 第 ${event.batch_number} 批`,
                                                                  )
                                                                : ''}
                                                            {event.reroll
                                                                ? tx(
                                                                      ` · reroll ${event.reroll}`,
                                                                      ` · 重 roll ${event.reroll}`,
                                                                  )
                                                                : ''}
                                                            {event.updated !== undefined
                                                                ? tx(
                                                                      ` · wrote ${formatNumber(event.updated)}`,
                                                                      ` · 写回 ${formatNumber(event.updated)}`,
                                                                  )
                                                                : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {batchPreview && (
                                        <div className="memory-lib-batch-preview">
                                            {tx(
                                                `Prepared batch ${batchPreview.batch_index || manualBatchIndex} / ${formatNumber(batchPreview.total_batches)}, ${batchPreview.items?.length || 0} items, next cursor #${batchPreview.next_after_id || 0}, remaining pending ${formatNumber(batchPreview.remaining_pending)}.`,
                                                `已准备第 ${batchPreview.batch_index || manualBatchIndex} 批 / 共 ${formatNumber(batchPreview.total_batches)} 批，${batchPreview.items?.length || 0} 条，下一游标 #${batchPreview.next_after_id || 0}，待分类剩余 ${formatNumber(batchPreview.remaining_pending)}。`,
                                            )}
                                            <div>
                                                {(batchPreview.items || [])
                                                    .slice(0, 12)
                                                    .map((item) => `#${item.id}`)
                                                    .join('  ')}
                                            </div>
                                        </div>
                                    )}
                                    {runResult && (
                                        <div className="memory-lib-run-result">
                                            <div className="memory-lib-prompt-head">
                                                <strong>
                                                    {runResult.mode === 'supplement'
                                                        ? tx('Small Model Supplement Result', '小模型补充结果')
                                                        : tx('Small Model Summary Result', '小模型归纳结果')}
                                                </strong>
                                                <span>
                                                    {runResult.mode === 'supplement'
                                                        ? tx(
                                                              `Source ${formatNumber(runResult.normalized?.source_label_count)} / time ${formatNumber(runResult.normalized?.time_label_count)} / wrote ${formatNumber(runResult.apply?.updated)} items`,
                                                              `来源 ${formatNumber(runResult.normalized?.source_label_count)} / 时间 ${formatNumber(runResult.normalized?.time_label_count)} / 写回 ${formatNumber(runResult.apply?.updated)} 条`,
                                                          )
                                                        : runResult.mode === 'auto'
                                                          ? tx(
                                                                `Automatic ${formatNumber((runResult.runs || []).filter((item) => !item.empty).length)} batches / applied ${formatNumber(runResult.updated)} items`,
                                                                `自动 ${formatNumber((runResult.runs || []).filter((item) => !item.empty).length)} 批 / 应用 ${formatNumber(runResult.updated)} 条`,
                                                            )
                                                          : tx(
                                                                `New memory suggestions ${formatNumber(runResult.normalized?.new_memory_count)} / applied ${formatNumber(runResult.apply?.updated)} items`,
                                                                `新记忆建议 ${formatNumber(runResult.normalized?.new_memory_count)} / 应用 ${formatNumber(runResult.apply?.updated)} 条`,
                                                            )}
                                                </span>
                                            </div>
                                            <div className="memory-lib-result-grid">
                                                <span>
                                                    {runResult.mode === 'supplement'
                                                        ? tx(
                                                              `Batch: ${(runResult.batch?.ids || [])
                                                                  .slice(0, 14)
                                                                  .map((id) => `#${id}`)
                                                                  .join(' ')}`,
                                                              `批次：${(runResult.batch?.ids || [])
                                                                  .slice(0, 14)
                                                                  .map((id) => `#${id}`)
                                                                  .join(' ')}`,
                                                          )
                                                        : runResult.mode === 'auto'
                                                          ? tx(
                                                                `Processed: ${formatNumber(runResult.processed)} items / ${runResult.run_until_empty ? 'no batch limit' : `limit ${formatNumber(runResult.max_batches)} batches`}`,
                                                                `处理：${formatNumber(runResult.processed)} 条 / ${runResult.run_until_empty ? '不限制批数' : `上限 ${formatNumber(runResult.max_batches)} 批`}`,
                                                            )
                                                          : tx(
                                                                `Batch: ${(runResult.batch?.ids || [])
                                                                    .slice(0, 14)
                                                                    .map((id) => `#${id}`)
                                                                    .join(' ')}`,
                                                                `批次：${(runResult.batch?.ids || [])
                                                                    .slice(0, 14)
                                                                    .map((id) => `#${id}`)
                                                                    .join(' ')}`,
                                                            )}
                                                </span>
                                                <span>
                                                    {tx('Errors:', '错误：')}
                                                    {formatNumber(
                                                        runResult.mode === 'auto'
                                                            ? (runResult.errors || []).length +
                                                                  Number(runResult.applied_errors || 0)
                                                            : (runResult.normalized?.errors || []).length +
                                                                  (runResult.apply?.errors || []).length,
                                                    )}
                                                </span>
                                                {runResult.mode === 'auto' && (
                                                    <span>
                                                        {tx('Stop:', '停止：')}
                                                        {formatStoppedReason(runResult.stopped_reason)}
                                                    </span>
                                                )}
                                                <span>
                                                    {tx('Model:', '模型：')}
                                                    {runResult.model?.name || settings.model_name}
                                                    {runResult.model?.finishReason
                                                        ? ` / ${runResult.model.finishReason}`
                                                        : ''}
                                                </span>
                                            </div>
                                            {runErrorDetail?.summary && (
                                                <div className="memory-lib-run-error-detail">
                                                    <strong>{tx('Exact Error Reason', '准确错误原因')}</strong>
                                                    <p>{runErrorDetail.summary}</p>
                                                    {runErrorDetail.raw_preview && (
                                                        <code>{clipRunErrorText(runErrorDetail.raw_preview, 700)}</code>
                                                    )}
                                                </div>
                                            )}
                                            {canContinueAutoRun && (
                                                <div className="memory-lib-continue">
                                                    <div>
                                                        <strong>
                                                            {tx(
                                                                'Automatic Task Stopped at Breakpoint',
                                                                '自动任务已停在断点',
                                                            )}
                                                        </strong>
                                                        <p>
                                                            {tx(
                                                                `There are still ${formatNumber(runResult.continue_from?.pending || runResult.stats?.pending || 0)} pending items. Continuing retries from the first remaining pending batch and will not rerun already written batches.`,
                                                                `当前还有 ${formatNumber(runResult.continue_from?.pending || runResult.stats?.pending || 0)} 条 pending。继续会从剩余 pending 的第一批重新尝试，不会重跑已写回的批次。`,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="memory-lib-button"
                                                        onClick={() =>
                                                            (runResult.task_mode === 'supplement'
                                                                ? runAutoSupplement
                                                                : runAutoMigration)({
                                                                skipConfirm: true,
                                                                continuation: true,
                                                                characterId:
                                                                    runResult.character?.id || selectedCharacterId,
                                                            })
                                                        }
                                                        disabled={autoRunActive || runLoading}
                                                    >
                                                        <Play size={15} />{' '}
                                                        {autoRunActive
                                                            ? tx('Continuing', '继续中')
                                                            : tx('Continue from Breakpoint', '从断点继续')}
                                                    </button>
                                                </div>
                                            )}
                                            {canRetryExternalImport && (
                                                <div className="memory-lib-continue">
                                                    <div>
                                                        <strong>
                                                            {tx(
                                                                'External Import Stopped at Breakpoint',
                                                                '外部导入停在断点',
                                                            )}
                                                        </strong>
                                                        <p>
                                                            {tx(
                                                                `Processed ${formatNumber(runResult.continue_from?.offset ?? runResult.processed ?? 0)} items. Retry will call the small model again from the failed batch and will not rerun memories already written.`,
                                                                `已处理 ${formatNumber(runResult.continue_from?.offset ?? runResult.processed ?? 0)} 条；继续会从失败批次重新调用小模型，不重跑已经写入的新记忆。`,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="memory-lib-button"
                                                        onClick={() =>
                                                            runExternalImportAuto({
                                                                continuation: true,
                                                                importId:
                                                                    runResult.continue_from?.import_id ||
                                                                    runResult.import_id,
                                                                continueOffset:
                                                                    runResult.continue_from?.offset ??
                                                                    runResult.processed ??
                                                                    0,
                                                            })
                                                        }
                                                        disabled={autoRunActive || externalImportLoading}
                                                    >
                                                        <Play size={15} />{' '}
                                                        {autoRunActive
                                                            ? tx('Retrying', '重试中')
                                                            : tx('Retry from Breakpoint', '从断点重试')}
                                                    </button>
                                                </div>
                                            )}
                                            <textarea readOnly value={formatRunResultDetails(runResult)} />
                                        </div>
                                    )}
                                    <div className="memory-lib-prompt-window compact">
                                        <div className="memory-lib-prompt-head">
                                            <strong>
                                                {promptTaskMode === 'complete'
                                                    ? tx('Complete Prompt', '完整 Prompt')
                                                    : tx('Supplement Prompt', '补充 Prompt')}
                                            </strong>
                                            <span>
                                                {promptTaskMode === 'complete'
                                                    ? promptPreview
                                                        ? tx(
                                                              `About ${formatNumber(promptPreview.length)} chars`,
                                                              `约 ${formatNumber(promptPreview.length)} 字符`,
                                                          )
                                                        : tx('Click "Preview Prompt" first', '先点“预览 Prompt”生成')
                                                    : temporalPromptPreview
                                                      ? tx(
                                                            `About ${formatNumber(temporalPromptPreview.length)} chars`,
                                                            `约 ${formatNumber(temporalPromptPreview.length)} 字符`,
                                                        )
                                                      : tx('Click "Preview Prompt" first', '先点“预览 Prompt”生成')}
                                            </span>
                                        </div>
                                        <textarea
                                            readOnly
                                            value={
                                                promptTaskMode === 'complete'
                                                    ? promptPreview ||
                                                      tx(
                                                          'Complete Prompt: migrate legacy / external app memories into the new library while generating formal memories, source-scene tags, and time tags. Raw dialogue/logs and embedding index text are not included here.',
                                                          '完整 Prompt：把旧库/外部 App 记忆迁移进新版库，同时生成中文正式记忆、来源场景标签和时间标签。这里不会放原始对话/日志或 embedding 索引文本。',
                                                      )
                                                    : temporalPromptPreview ||
                                                      tx(
                                                          'Supplement Prompt: only add private chat / group chat / city street / external app source-scene tags and strongly time-bound tags to existing new memories; does not rewrite content or change memory_focus.',
                                                          '补充 Prompt：只给已有新版记忆补私聊/群聊/商业街/外部 App 来源场景标签，以及时间强绑定标签；不改写记忆内容，不改变 memory_focus。',
                                                      )
                                            }
                                        />
                                    </div>
                                </div>
                            </main>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MemoryLibraryPanel;
