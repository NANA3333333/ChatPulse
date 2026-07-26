import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    AlarmClock,
    Aperture,
    BrainCircuit,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Clock3,
    Database,
    Edit2,
    FileText,
    GitBranch,
    Heart,
    LibraryBig,
    Lightbulb,
    Link2,
    List,
    ListFilter,
    Laptop,
    LoaderCircle,
    MapPin,
    PanelRightClose,
    Play,
    RefreshCw,
    RotateCcw,
    Route,
    Save,
    ScanSearch,
    Search,
    SlidersHorizontal,
    Sparkles,
    Tags,
    Trash2,
    Upload,
    UserPlus,
    UserRound,
    WandSparkles,
    X
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { LOCAL_OLLAMA_MODEL_PRESET, withLocalModelOption } from '../utils/localModelPreset';
import './MemoryLibraryPanel.css';

const emptySettings = {
    api_endpoint: '',
    api_key: '',
    model_name: '',
    batch_size: 30,
    max_output_tokens: 8000
};

const MEMORY_FOCUS_OPTIONS = [
    ['user_profile', '用户画像'],
    ['relationship', '关系记忆'],
    ['user_current_arc', '当前阶段'],
    ['general', '普通事件']
];

const MEMORY_TIER_OPTIONS = [
    ['core', '核心'],
    ['active', '活跃'],
    ['ambient', '背景']
];

const SOURCE_CONTEXT_OPTIONS = [
    ['private_chat', '私聊'],
    ['group_chat', '群聊'],
    ['commercial_street', '商业街'],
    ['external_app', '外部 App'],
    ['unknown', '来源未明']
];

const SCENE_TAG_OPTIONS = [
    ['none', '无'],
    ['private_chat', '私聊'],
    ['group_chat', '群聊'],
    ['commercial_street', '商业街'],
    ['external_gpt', 'GPT'],
    ['external_gemini', 'Gemini'],
    ['external_sillytavern', 'SillyTavern'],
    ['external_app', '外部 App'],
    ['other', '其他']
];

const EXTERNAL_IMPORT_SOURCE_OPTIONS = [
    ['gpt', 'GPT / ChatGPT'],
    ['gemini', 'Gemini'],
    ['sillytavern', 'SillyTavern'],
    ['external_app', '其他外部 App']
];

const EXTERNAL_IMPORT_SESSION_KEY = 'cp_external_memory_import_preview';

function currentMemoryLang() {
    return typeof localStorage !== 'undefined' && localStorage.getItem('chatpulse_lang') === 'en' ? 'en' : 'zh';
}

function mtx(en, zh) {
    return currentMemoryLang() === 'en' ? en : zh;
}

const OPTION_LABEL_EN = {
    user_profile: 'User Profile',
    relationship: 'Relationship',
    user_current_arc: 'Current Arc',
    general: 'General Event',
    core: 'Core',
    active: 'Active',
    ambient: 'Ambient',
    private_chat: 'Private Chat',
    group_chat: 'Group Chat',
    commercial_street: 'City Street',
    external_app: 'External App',
    unknown: 'Unknown Source',
    none: 'None',
    external_gpt: 'GPT',
    external_gemini: 'Gemini',
    external_sillytavern: 'SillyTavern',
    other: 'Other',
    gpt: 'GPT / ChatGPT',
    gemini: 'Gemini',
    sillytavern: 'SillyTavern'
};

function optionLabel(value, fallback) {
    return currentMemoryLang() === 'en' ? (OPTION_LABEL_EN[value] || fallback || value) : (fallback || value);
}

function detectExternalImportSource(filename = '', sample = '') {
    const name = String(filename || '').toLowerCase();
    const text = String(sample || '').slice(0, 300000);
    if (/silly\s*tavern|sillytavern|tavern|imported\.jsonl/.test(name)) return 'sillytavern';
    if (/"chat_metadata"|"swipes"|"mes"|"send_date"|LWB_|<本轮用户输入>|<recall>/i.test(text)) return 'sillytavern';
    if (/gemini|bard/.test(name) || /"chunkedPrompt"|"model":"gemini/i.test(text)) return 'gemini';
    if (/chatgpt|openai|conversations\.json/.test(name) || /"mapping"|"conversation_id"|"author"/i.test(text)) return 'gpt';
    return '';
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatDays(value) {
    if (value === null || value === undefined) return mtx('Protected', '受保护');
    const days = Number(value || 0);
    if (days < 1) return `${Math.ceil(days * 24)} ${mtx('h', '小时')}`;
    return `${Math.ceil(days)} ${mtx('d', '天')}`;
}

function formatDate(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return mtx('Not recorded', '未记录');
    return new Date(timestamp).toLocaleDateString(currentMemoryLang() === 'en' ? 'en-US' : 'zh-CN', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatDateTime(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return mtx('Not recorded', '未记录');
    return new Date(timestamp).toLocaleString(currentMemoryLang() === 'en' ? 'en-US' : 'zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatStoppedReason(reason) {
    const map = {
        empty: { zh: '待分类已清空', en: 'Pending queue cleared' },
        completed: { zh: '已完成', en: 'Completed' },
        max_batches: { zh: '达到批次数', en: 'Reached batch limit' },
        error: { zh: '小模型错误', en: 'Small model error' },
        auth_error: { zh: '小模型鉴权失败', en: 'Small model auth failed' },
        no_progress: { zh: '无进展停止', en: 'Stopped with no progress' },
        no_candidates: { zh: '没有提取出可写入记忆', en: 'No writable memories extracted' },
        dry_run: { zh: '预演停止', en: 'Dry run stopped' },
        backend_missing: { zh: '后端任务不存在', en: 'Backend task missing' }
    };
    return map[reason]?.[currentMemoryLang()] || reason || mtx('Not recorded', '未记录');
}

function summarizeAutoRunError(result = {}) {
    return getAutoRunErrorDetail(result).summary;
}

function clipRunErrorText(value = '', max = 520) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

function getAutoRunErrorDetail(result = {}) {
    const lastError = (result.errors || []).slice(-1)[0];
    const attemptError = (lastError?.attempts || []).slice(-1)[0];
    const rawError = attemptError?.error || lastError?.error || result.message || '';
    const rawPreview = attemptError?.raw_response_preview || lastError?.raw_response_preview || result.raw_response || '';
    const batchNumber = lastError?.batch_number || attemptError?.batch?.batch_index || result.batch?.batch_index || '';
    if (!rawError && !rawPreview) {
        return { summary: '', raw_preview: '', batch_number: batchNumber };
    }
    const prefix = batchNumber ? mtx(`Batch ${batchNumber}: `, `第 ${batchNumber} 批：`) : '';
    const isJsonError = /JSON|Unexpected token|not valid JSON|did not return a JSON object|JSON 对象|格式不合法/i.test(rawError);
    const summary = isJsonError
        ? `${prefix}${mtx('The small model did not return valid JSON, so the backend could not parse it. Details: ', '小模型返回的不是合法 JSON，后端无法解析。具体错误：')}${rawError}`
        : `${prefix}${rawError}`;
    return {
        summary,
        raw_preview: rawPreview,
        batch_number: batchNumber
    };
}

function formatProgressPhase(phase) {
    const map = {
        start: { zh: '启动中', en: 'Starting' },
        batch_start: { zh: '读取批次', en: 'Reading batch' },
        attempt_start: { zh: '调用小模型', en: 'Calling small model' },
        attempt_result: { zh: '收到结果', en: 'Received result' },
        attempt_no_progress: { zh: '无进展，准备重 roll', en: 'No progress, rerolling' },
        attempt_error: { zh: '本次尝试失败', en: 'Attempt failed' },
        batch_success: { zh: '批次写回完成', en: 'Batch written back' },
        batch_empty: { zh: '待分类已清空', en: 'Pending queue cleared' },
        done: { zh: '已完成', en: 'Done' },
        stopped: { zh: '已停止', en: 'Stopped' }
    };
    return map[phase]?.[currentMemoryLang()] || phase || mtx('Waiting', '等待中');
}

function formatRunResultDetails(result) {
    if (!result) return '';
    if (result.mode === 'auto') {
        return JSON.stringify({
            stopped_reason: result.stopped_reason,
            max_rerolls: result.max_rerolls,
            errors: result.errors || [],
            runs: result.runs || [],
            raw_response: result.raw_response || ''
        }, null, 2);
    }
    return result.raw_response || JSON.stringify(result.parsed || {}, null, 2);
}

function formatForgettingLabel(item = {}) {
    if (item.days_until_threshold === null || item.days_until_threshold === undefined) return mtx('Protected', '受保护');
    if (item.forgetting_stage === 'expired') return mtx('Grace period ended, ready to forget', '缓冲结束，可彻底遗忘');
    if (item.forgetting_stage === 'grace') {
        const daysLeft = Number(item.days_until_grace_expires || 0);
        const leftText = daysLeft <= 0 ? mtx('less than 1 h', '不足 1 小时') : formatDays(daysLeft);
        return mtx(`In grace period, forgettable after ${leftText}`, `缓冲中，${leftText}后可遗忘`);
    }
    return mtx(`Enters grace period after ${formatDays(item.days_until_threshold)}`, `${formatDays(item.days_until_threshold)}后进入缓冲`);
}

function MemoryEntryRow({ item, mode = 'category', onRescue, onCharacterClick, onEdit, onDelete, onViewSource, rescuing, deletingIds = [] }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const daysText = formatForgettingLabel(item);
    const isNewMemory = item.memory_library_source === 'new' || item.memory_library_source === 'new_grouped';
    const sourceIds = Array.isArray(item.source_ids) && item.source_ids.length ? item.source_ids : [item.representative_id || item.id].filter(Boolean);
    const sourceCount = Number(item.source_count || sourceIds.length || 1);
    const displayId = sourceCount > 1
        ? (isEn ? `#${sourceIds[0]} + ${formatNumber(sourceCount - 1)} more` : `#${sourceIds[0]} 等 ${formatNumber(sourceCount)} 条`)
        : `#${item.representative_id || item.id}`;
    const isDeleting = sourceIds.some(id => deletingIds.includes(Number(id)));
    let forgettingTimeLabel = '';
    if (mode === 'forgetting' && item.forgetting_stage === 'approaching' && item.threshold_at) {
        forgettingTimeLabel = isEn ? `Grace starts ${formatDateTime(item.threshold_at)}` : `预计进缓冲 ${formatDateTime(item.threshold_at)}`;
    } else if (mode === 'forgetting' && item.forgetting_stage === 'grace' && item.grace_expires_at) {
        forgettingTimeLabel = isEn ? `Grace ends ${formatDateTime(item.grace_expires_at)}` : `缓冲截止 ${formatDateTime(item.grace_expires_at)}`;
    } else if (mode === 'forgetting' && item.forgetting_stage === 'expired' && item.grace_expires_at) {
        forgettingTimeLabel = isEn ? `Grace ended ${formatDateTime(item.grace_expires_at)}` : `缓冲已截止 ${formatDateTime(item.grace_expires_at)}`;
    }
    const deleteActionLabel = mode === 'forgetting' && item.forgetting_stage === 'expired' ? (isEn ? 'Forget' : '遗忘') : (isEn ? 'Delete' : '删除');
    return (
        <div className={`memory-entry-row ${mode}`}>
            <div className="memory-entry-main">
                <div className="memory-entry-meta">
                    <span className="memory-lib-id">{displayId}</span>
                    <button type="button" className="memory-entry-character" onClick={() => onCharacterClick?.(item.character_id)}>
                        {item.character_name}
                    </button>
                    <span>{optionLabel(item.memory_focus, item.memory_focus)} / {optionLabel(item.memory_tier, item.memory_tier)}</span>
                    <span>{isEn ? 'Calls' : '调用'} {formatNumber(item.retrieval_count)}</span>
                    <span>{isEn ? 'Importance' : '重要性'} {item.importance}</span>
                    {mode === 'forgetting' && <b>{daysText}</b>}
                </div>
                <div className="memory-entry-text">{item.text || (isEn ? 'Empty memory entry' : '空记忆条目')}</div>
                <div className="memory-entry-foot">
                    <span>{isEn ? 'Created' : '创建'} {formatDate(item.created_at)}</span>
                    <span>{isEn ? 'Updated' : '更新'} {formatDate(item.updated_at)}</span>
                    <span>{isEn ? 'Score' : '分数'} {Number(item.retention_score || 0).toFixed(2)}</span>
                    {sourceCount > 1 && <span>{isEn ? 'Sources' : '来源'} {formatNumber(sourceCount)} {isEn ? '' : '条'}</span>}
                    <span>{item.retention_action || 'keep'}</span>
                    {mode === 'forgetting' && forgettingTimeLabel && <span>{forgettingTimeLabel}</span>}
                </div>
            </div>
            {mode === 'forgetting' && (
                <button className="memory-lib-button compact" onClick={() => onRescue(sourceIds)} disabled={rescuing}>
                    <RotateCcw size={14} /> {rescuing ? (isEn ? 'Rescuing' : '救回中') : (isEn ? 'Rescue' : '救回')}
                </button>
            )}
            <div className="memory-entry-actions">
                <button className="memory-lib-button compact ghost" onClick={() => onViewSource?.({ item, ids: sourceIds })}>
                    <FileText size={14} /> {isEn ? 'Source' : '原文'}
                </button>
                <button className="memory-lib-button compact ghost" onClick={() => onEdit?.({ type: isNewMemory ? 'new' : 'legacy', item, ids: isNewMemory ? sourceIds : [item.representative_id || item.id] })} disabled={isDeleting}>
                    <Edit2 size={14} /> {isEn ? 'Edit' : '编辑'}
                </button>
                <button className="memory-lib-button compact danger" onClick={() => onDelete?.({ type: isNewMemory ? 'new' : 'legacy', item, ids: isNewMemory ? sourceIds : [item.representative_id || item.id] })} disabled={isDeleting}>
                    <Trash2 size={14} /> {isDeleting ? (isEn ? `${deleteActionLabel}ing` : `${deleteActionLabel}中`) : deleteActionLabel}
                </button>
            </div>
        </div>
    );
}

function EntryList({ items = [], emptyText, mode, onRescue, onCharacterClick, onEdit, onDelete, onViewSource, rescuingIds, deletingIds = [] }) {
    if (!items.length) return <div className="memory-lib-empty">{emptyText}</div>;
    return (
        <div className="memory-entry-list">
            {items.map(item => {
                const sourceIds = Array.isArray(item.source_ids) && item.source_ids.length
                    ? item.source_ids
                    : [item.representative_id || item.id].filter(Boolean);
                const isRescuing = sourceIds.some(id => rescuingIds?.includes(Number(id)))
                    || rescuingIds?.includes(item.id);
                return (
                    <MemoryEntryRow
                        key={`${mode}-${item.id}`}
                        item={item}
                        mode={mode}
                        onRescue={onRescue}
                        onCharacterClick={onCharacterClick}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onViewSource={onViewSource}
                        rescuing={isRescuing}
                        deletingIds={deletingIds}
                    />
                );
            })}
        </div>
    );
}

function NewMemorySummaryRow({ item, onCharacterClick, onEdit, onDelete, onViewSource, deletingIds = [] }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    const sourceContexts = Array.isArray(item.source_contexts) && item.source_contexts.length
        ? item.source_contexts
        : [item.source_context || 'unknown'];
    const sceneTags = Array.isArray(item.scene_tags) && item.scene_tags.length
        ? item.scene_tags
        : [item.scene_tag || 'none'];
    const sourceIds = Array.isArray(item.source_ids) ? item.source_ids : [];
    const isDeleting = sourceIds.some(id => deletingIds.includes(Number(id)));
    const forgettingLabel = formatForgettingLabel(item);
    return (
        <div className="memory-new-summary-card">
            <div className="memory-entry-meta">
                <button type="button" className="memory-entry-character" onClick={() => onCharacterClick?.(item.character_id)}>
                    {item.character_name}
                </button>
                <span>{optionLabel(item.memory_focus, item.memory_focus)} / {optionLabel(item.memory_tier, item.memory_tier)}</span>
                <span>{sourceContexts.map(value => optionLabel(value, value)).join(' / ')}</span>
                <span>{sceneTags.map(value => optionLabel(value, value)).join(' / ')}</span>
                <span>{isEn ? 'Sources' : '来源'} {formatNumber(item.source_count)} {isEn ? '' : '条'}</span>
                <span>{isEn ? 'Importance' : '重要性'} {item.importance}</span>
                <span>{item.retention_action || 'keep'}</span>
                <b>{forgettingLabel}</b>
            </div>
            <div className="memory-new-summary-text">{item.summary || (isEn ? 'Empty summary' : '空总结')}</div>
            <div className="memory-entry-foot">
                {item.consolidation_key && <span>{item.consolidation_key}</span>}
                <span>{isEn ? 'Updated' : '更新'} {formatDate(item.updated_at)}</span>
                <span>{isEn ? 'Score' : '分数'} {Number(item.retention_score || 0).toFixed(2)}</span>
                <span>{(item.source_ids || []).slice(0, 8).map(id => `#${id}`).join(' ')}</span>
            </div>
            {item.source_preview?.length > 0 && (
                <div className="memory-new-source-preview">
                    {item.source_preview.map(source => (
                        <div key={source.id}><b>#{source.id}</b> {source.text}</div>
                    ))}
                </div>
            )}
            <div className="memory-entry-actions">
                <button className="memory-lib-button compact ghost" onClick={() => onViewSource?.({ item, ids: sourceIds.length ? sourceIds : [item.representative_id].filter(Boolean) })}>
                    <FileText size={14} /> {isEn ? 'Source' : '原文'}
                </button>
                <button className="memory-lib-button compact ghost" onClick={() => onEdit?.({ type: 'new', item, ids: item.source_ids || [] })} disabled={isDeleting}>
                    <Edit2 size={14} /> {isEn ? 'Edit' : '编辑'}
                </button>
                <button className="memory-lib-button compact danger" onClick={() => onDelete?.({ type: 'new', item, ids: item.source_ids || [] })} disabled={isDeleting}>
                    <Trash2 size={14} /> {isDeleting ? (isEn ? 'Deleting' : '删除中') : (isEn ? 'Delete' : '删除')}
                </button>
            </div>
        </div>
    );
}

function NewSummaryList({ items = [], emptyText, onCharacterClick, onEdit, onDelete, onViewSource, deletingIds = [] }) {
    if (!items.length) return <div className="memory-lib-empty">{emptyText}</div>;
    return (
        <div className="memory-new-summary-list">
            {items.map(item => (
                <NewMemorySummaryRow key={item.id} item={item} onCharacterClick={onCharacterClick} onEdit={onEdit} onDelete={onDelete} onViewSource={onViewSource} deletingIds={deletingIds} />
            ))}
        </div>
    );
}

function formatSourceKind(kind = '') {
    if (kind === 'private_chat') return mtx('Private Chat', '私聊');
    if (kind === 'group_chat') return mtx('Group Chat', '群聊');
    if (kind === 'commercial_street') return mtx('City Street', '商业街');
    if (kind === 'external_app') return mtx('External App', '外部 App');
    return mtx('Unknown Source', '未知来源');
}

function SourceViewerModal({ viewer, onClose }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    if (!viewer) return null;
    const data = viewer.data || {};
    const memories = data.memories || [];
    const sources = data.sources || [];
    const stats = data.stats || {};
    return (
        <div className="memory-edit-overlay">
            <div className="memory-source-modal">
                <div className="memory-edit-head">
                    <div>
                        <strong>{isEn ? 'Source Text' : '来源原文'}</strong>
                        <span>{viewer.item?.summary || viewer.item?.text || (isEn ? 'Memory source trace' : '记忆来源追溯')}</span>
                    </div>
                    <button type="button" className="memory-edit-close" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>
                {viewer.loading ? (
                    <div className="memory-source-empty">{isEn ? 'Reading source text...' : '正在读取来源原文...'}</div>
                ) : viewer.error ? (
                    <div className="memory-lib-error">{viewer.error}</div>
                ) : (
                    <>
                        <div className="memory-source-summary">
                            <span>{isEn ? 'Carrier Cards' : '承载卡片'} {formatNumber(stats.memory_count || memories.length)}</span>
                            <span>{isEn ? 'Source Refs' : '来源引用'} {formatNumber(stats.source_ref_count || sources.length)}</span>
                            <span>{isEn ? 'Found Sources' : '找到原文'} {formatNumber(stats.found_source_count || sources.filter(source => source.found).length)}</span>
                            {Number(stats.missing_source_count || 0) > 0 && <b>{isEn ? 'Missing' : '缺失'} {formatNumber(stats.missing_source_count)}</b>}
                        </div>
                        {memories.length > 0 && (
                            <div className="memory-source-memory-list">
                                {memories.map(memory => (
                                    <div key={memory.id}>
                                        <b>#{memory.id}</b>
                                        <span>{memory.summary || (isEn ? 'Empty memory' : '空记忆')}</span>
                                        {memory.source_time_text && <small>{memory.source_time_text}</small>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {sources.length === 0 ? (
                            <div className="memory-source-empty">{isEn ? 'This memory has no saved original message id, so it can only trace back to the memory card itself.' : '这条记忆没有保存可反查的原始消息 id；只能追到记忆卡片本身。'}</div>
                        ) : (
                            <div className="memory-source-list">
                                {sources.map(source => (
                                    <div className={`memory-source-line ${source.found ? '' : 'missing'}`} key={source.source_key}>
                                        <div className="memory-source-line-meta">
                                            <span>{formatSourceKind(source.kind)} #{source.id || source.raw_ref}</span>
                                            {source.timestamp > 0 && <span>{formatDateTime(source.timestamp)}</span>}
                                            {source.speaker && <b>{source.speaker}</b>}
                                            {source.location && <span>{source.location}</span>}
                                            {!source.found && <b>{isEn ? 'Source missing' : '原文缺失'}</b>}
                                        </div>
                                        <div className="memory-source-line-text">
                                            {source.found ? (source.content || (isEn ? 'Empty content' : '空内容')) : (isEn ? `Could not find the original record for ${source.raw_ref || source.source_key}.` : `找不到 ${source.raw_ref || source.source_key} 对应的原始记录。`)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function getMemoryItemKey(item = {}) {
    const ids = getMemorySourceIds(item);
    return `${item.memory_library_source || item.source || 'memory'}-${item.id || item.representative_id || ids[0] || item.consolidation_key || item.summary || item.text}`;
}

function getMemorySourceIds(item = {}) {
    const ids = Array.isArray(item.source_ids) && item.source_ids.length
        ? item.source_ids
        : [item.representative_id || item.id].filter(Boolean);
    return Array.from(new Set(ids.map(id => Number(id || 0)).filter(id => id > 0)));
}

function getMemoryTitle(item = {}, tx = mtx) {
    return item.summary
        || item.text
        || item.event
        || item.consolidation_summary
        || tx('Untitled memory', '未命名记忆');
}

function getMemoryBody(item = {}, tx = mtx) {
    return item.content
        || item.consolidation_summary
        || item.summary
        || item.text
        || item.event
        || tx('This memory does not have saved body text.', '这条记忆没有保存正文。');
}

function getMemorySourceContexts(item = {}) {
    return Array.isArray(item.source_contexts) && item.source_contexts.length
        ? item.source_contexts
        : [item.source_context || 'unknown'];
}

function getMemorySceneTags(item = {}) {
    return Array.isArray(item.scene_tags) && item.scene_tags.length
        ? item.scene_tags
        : [item.scene_tag || 'none'];
}

function uniqueMemoryLabels(values = []) {
    const seen = new Set();
    return values
        .map(value => String(value || '').trim())
        .filter(value => value && value !== 'none')
        .filter(value => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function getMemoryDisplayTags(item = {}) {
    return uniqueMemoryLabels([...getMemorySourceContexts(item), ...getMemorySceneTags(item)]);
}

function getMemoryUpdatedAt(item = {}) {
    return item.updated_at || item.created_at || item.source_time || item.timestamp || 0;
}

function getMemoryImportance(item = {}) {
    const score = Number(item.importance ?? item.retention_score ?? 0);
    return Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0;
}

function getMemoryTier(item = {}) {
    return String(item.memory_tier || item.tier || 'ambient');
}

function getMemoryTone(item = {}) {
    const tier = getMemoryTier(item);
    if (tier === 'core') return 'core';
    if (tier === 'active') return 'active';
    if (String(item.forgetting_stage || '').trim()) return 'fading';
    return 'ambient';
}

function getCharacterInitial(name = '') {
    const text = String(name || '').trim();
    if (!text) return '?';
    return text.slice(0, 1).toUpperCase();
}

function getMemoryCharacterName(item = {}, characterStats = [], tx = mtx) {
    if (item.character_name) return item.character_name;
    const found = characterStats.find(character => String(character.character_id) === String(item.character_id));
    return found?.name || item.character_id || tx('Unknown role', '未知角色');
}

function getThreadIcon(tone) {
    if (tone === 'core') return <Heart size={16} />;
    if (tone === 'active') return <Clock3 size={16} />;
    if (tone === 'fading') return <AlarmClock size={16} />;
    return <Aperture size={16} />;
}

function memoryMatchesLens(item = {}, lens = 'all') {
    if (lens === 'all') return true;
    const focus = String(item.memory_focus || '').toLowerCase();
    const sourceContexts = getMemorySourceContexts(item).map(value => String(value || '').toLowerCase());
    const sceneTags = getMemorySceneTags(item).map(value => String(value || '').toLowerCase());
    if (lens === 'relationship') return focus === 'relationship';
    if (lens === 'user_profile') return focus === 'user_profile';
    if (lens === 'scene') {
        return sourceContexts.some(value => ['private_chat', 'group_chat', 'commercial_street', 'external_app'].includes(value))
            || sceneTags.some(value => value && value !== 'none');
    }
    if (lens === 'temporal') {
        return !item.source_time_text
            || !item.temporal_checked_at
            || !item.source_context
            || String(item.source_context).toLowerCase() === 'unknown';
    }
    if (lens === 'forgetting') return !!item.forgetting_stage || Number(item.days_until_threshold ?? 999) < 14;
    return true;
}

function memoryMatchesSearch(item = {}, search = '') {
    const query = String(search || '').trim().toLowerCase();
    if (!query) return true;
    const text = [
        item.summary,
        item.text,
        item.content,
        item.event,
        item.character_name,
        item.consolidation_key,
        item.consolidation_summary,
        item.memory_focus,
        item.memory_tier,
        ...getMemorySourceContexts(item),
        ...getMemorySceneTags(item)
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(query);
}

function normalizeThreadItems(items = [], lens = 'all', search = '') {
    const seen = new Set();
    return (items || [])
        .filter(item => item && memoryMatchesLens(item, lens) && memoryMatchesSearch(item, search))
        .filter(item => {
            const key = getMemoryItemKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => Number(getMemoryUpdatedAt(b) || 0) - Number(getMemoryUpdatedAt(a) || 0));
}

function buildMemoryThreads({ newCategories = [], newSourceGroups = [], categories = [], forgettingGroups = [], lens = 'all', search = '', tx }) {
    const sourceGroups = lens === 'forgetting'
        ? forgettingGroups
        : [
            ...(newCategories || []).map(group => ({ ...group, groupKind: 'semantic' })),
            ...(newSourceGroups || []).map(group => ({ ...group, groupKind: 'source' })),
            ...(categories || []).map(group => ({ ...group, groupKind: 'legacy' }))
        ];
    const threads = sourceGroups.map((group, index) => {
        const items = normalizeThreadItems(group.items || [], lens, search);
        if (!items.length) return null;
        const strongest = items.reduce((max, item) => Math.max(max, getMemoryImportance(item)), 0);
        const tone = items.some(item => getMemoryTone(item) === 'core')
            ? 'core'
            : items.some(item => getMemoryTone(item) === 'active')
                ? 'active'
                : lens === 'forgetting' || items.some(item => getMemoryTone(item) === 'fading')
                    ? 'fading'
                    : 'ambient';
        return {
            key: `${group.groupKind || 'group'}-${group.key || index}`,
            label: group.label || group.name || tx('Memory Thread', '记忆主线'),
            description: group.description || tx('Grouped by real memory metadata.', '按真实记忆字段聚合。'),
            count: Number(group.count || items.length),
            items,
            tone,
            strongest
        };
    }).filter(Boolean);

    return threads.length ? threads : [];
}

function getAllThreadItems(threads = []) {
    const seen = new Set();
    return threads.flatMap(thread => thread.items.map(item => ({ item, thread })))
        .filter(({ item }) => {
            const key = getMemoryItemKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function buildLensCount(items = [], lens = 'all') {
    return items.filter(item => memoryMatchesLens(item, lens)).length;
}

function MemoryCoreHeader({ tx, primaryView, setPrimaryView, onRefresh, refreshing, autoProgress, onImport }) {
    const pendingCount = Number(autoProgress?.stats?.pending || autoProgress?.pending_before || 0);
    return (
        <header className="memory-core-header">
            <div className="memory-core-brand">
                <span><BrainCircuit size={20} /></span>
                <div>
                    <small>MEMORY LIBRARY</small>
                    <strong>{tx('Memory is not a table', '记忆不是一张表')}</strong>
                </div>
            </div>
            <nav className="memory-core-tabs" aria-label={tx('Memory library views', '记忆库视图')}>
                <button type="button" className={primaryView === 'map' ? 'is-active' : ''} onClick={() => setPrimaryView('map')}>
                    <Route size={16} /> {tx('Memory Map', '记忆地图')}
                </button>
                <button type="button" className={primaryView === 'maintenance' ? 'is-active' : ''} onClick={() => setPrimaryView('maintenance')}>
                    <WandSparkles size={16} /> {tx('Maintenance Workspace', '维护工作台')}
                    {pendingCount > 0 && <em>{formatNumber(pendingCount)}</em>}
                </button>
            </nav>
            <div className="memory-core-actions">
                <button type="button" className="memory-core-ghost" onClick={onImport}>
                    <Upload size={15} /> {tx('Import External Memory', '导入外部记忆')}
                </button>
                <button type="button" className="memory-core-icon" onClick={onRefresh} disabled={refreshing} title={tx('Refresh', '刷新')}>
                    <RefreshCw size={16} className={refreshing ? 'memory-spin' : ''} />
                </button>
            </div>
        </header>
    );
}

function MemoryHealthBar({ tx, memoryStatus, memoryStatusLoading, memoryStatusError, getMemoryBackendLabel, memoryStatusNote, totals, characterStats, autoProgress, setPrimaryView }) {
    const totalMemories = Number(memoryStatus?.memoriesCount ?? memoryStatus?.structuredMemoriesCount ?? totals?.formal_total ?? totals?.total ?? 0);
    const indexed = Number(memoryStatus?.indexedPoints ?? memoryStatus?.embeddedMemoriesCount ?? 0);
    const coverage = totalMemories > 0 ? Math.min(100, Math.round((indexed / totalMemories) * 100)) : Number(memoryStatus?.indexingCoverage || 0);
    const recalled = Number(memoryStatus?.everRetrievedMemoriesCount || 0);
    const backendOnline = memoryStatus?.enabled !== false && memoryStatus?.reachable !== false;
    const running = !!autoProgress?.running;
    return (
        <section className="memory-healthbar">
            <div className={`memory-health-item ${backendOnline ? 'is-healthy' : 'is-warning'}`}>
                <span><Database size={16} /></span>
                <div>
                    <small>{tx('Memory Backend', '记忆后端')}</small>
                    <strong>{memoryStatus ? getMemoryBackendLabel(memoryStatus.backend) : (memoryStatusLoading ? tx('Loading', '加载中') : tx('Unknown', '未知'))}</strong>
                    {(memoryStatusNote || memoryStatusError || memoryStatus?.lastError) && <p>{memoryStatusError || memoryStatus?.lastError || memoryStatusNote}</p>}
                </div>
                <em>{backendOnline ? tx('Online', '在线') : tx('Fallback', '降级')}</em>
            </div>
            <div className="memory-health-item">
                <span><ScanSearch size={16} /></span>
                <div>
                    <small>{tx('Index Coverage', '索引覆盖')}</small>
                    <strong>{coverage ? `${coverage}%` : tx('Waiting', '等待中')}</strong>
                    <i><b style={{ width: `${Math.max(0, Math.min(100, coverage || 0))}%` }} /></i>
                </div>
            </div>
            <div className="memory-health-item">
                <span><LibraryBig size={16} /></span>
                <div>
                    <small>{tx('All Memories', '全部记忆')}</small>
                    <strong>{formatNumber(totalMemories || totals?.formal_total || totals?.total)}</strong>
                </div>
                <em>{formatNumber(characterStats.length)} {tx('roles', '角色')}</em>
            </div>
            <div className="memory-health-item">
                <span><Sparkles size={16} /></span>
                <div>
                    <small>{tx('Recalled', '被唤起')}</small>
                    <strong>{formatNumber(recalled)}</strong>
                </div>
                <em>{tx('lifetime', '累计')}</em>
            </div>
            <div className={`memory-health-item ${running ? 'is-running' : ''}`}>
                <span>{running ? <LoaderCircle size={16} className="memory-spin" /> : <WandSparkles size={16} />}</span>
                <div>
                    <small>{tx('Background Task', '后台任务')}</small>
                    <strong>{running ? (autoProgress.message || formatProgressPhase(autoProgress.phase)) : tx('No active task', '没有运行中的任务')}</strong>
                </div>
                <button type="button" onClick={() => setPrimaryView('maintenance')}>{tx('View', '查看')}</button>
            </div>
        </section>
    );
}

function MemoryMapView(props) {
    const {
        tx,
        threads,
        allThreadItems,
        selectedMemory,
        selectedThread,
        selectedMemoryKey,
        setSelectedMemoryKey,
        characterStats,
        totals,
        activeCharacterId,
        jumpToCharacter,
        memoryLens,
        setMemoryLens,
        memorySearch,
        setMemorySearch,
        libraryViewMode,
        setLibraryViewMode,
        forgettingTotal,
        onViewSource,
        onEdit,
        onDelete,
        deletingIds
    } = props;

    const items = allThreadItems.map(entry => entry.item);
    const lensItems = [
        { key: 'all', icon: <Aperture size={15} />, label: tx('All Threads', '全部脉络'), count: items.length },
        { key: 'relationship', icon: <Heart size={15} />, label: tx('Relationship', '关系与情感'), count: buildLensCount(items, 'relationship') },
        { key: 'user_profile', icon: <UserRound size={15} />, label: tx('About You', '关于你'), count: buildLensCount(items, 'user_profile') },
        { key: 'scene', icon: <MapPin size={15} />, label: tx('Scenes', '地点与场景'), count: buildLensCount(items, 'scene') },
        { key: 'temporal', icon: <Clock3 size={15} />, label: tx('Missing Time', '缺少时间标签'), count: buildLensCount(items, 'temporal') },
        { key: 'forgetting', icon: <AlarmClock size={15} />, label: tx('Forgetting Soon', '即将遗忘'), count: forgettingTotal, warning: true },
    ];

    return (
        <section className="memory-map-screen">
            <aside className="memory-map-sidebar">
                <div className="memory-sidebar-heading">
                    <div>
                        <span className="memory-eyebrow">CHARACTERS</span>
                        <h2>{tx('Whose memories?', '谁的记忆？')}</h2>
                    </div>
                    <ListFilter size={17} />
                </div>
                <div className="memory-character-list">
                    <button type="button" className={!activeCharacterId ? 'is-active' : ''} onClick={() => jumpToCharacter('')}>
                        <span className="memory-avatar is-blue">*</span>
                        <span><strong>{tx('All Roles', '全部角色')}</strong><small>{formatNumber(totals?.formal_total ?? totals?.total ?? 0)} {tx('memories', '条记忆')}</small></span>
                        <em>{formatNumber(characterStats.length)}</em>
                    </button>
                    {characterStats.map((character, index) => (
                        <button
                            type="button"
                            className={String(activeCharacterId) === String(character.character_id) ? 'is-active' : ''}
                            key={character.character_id}
                            onClick={() => jumpToCharacter(character.character_id)}
                        >
                            <span className={`memory-avatar ${index % 2 ? 'is-pink' : 'is-blue'}`}>{getCharacterInitial(character.name)}</span>
                            <span><strong>{character.name}</strong><small>{formatNumber(character.formal_total ?? character.total ?? 0)} {tx('memories', '条记忆')}</small></span>
                            <em>{formatNumber(character.pending || 0)}</em>
                        </button>
                    ))}
                </div>

                <div className="memory-lens-section">
                    <span className="memory-eyebrow">MEMORY LENSES</span>
                    <h3>{tx('View by angle', '从哪个角度看')}</h3>
                    {lensItems.map(item => (
                        <button
                            type="button"
                            className={`${memoryLens === item.key ? 'is-active' : ''}${item.warning ? ' is-warning' : ''}`}
                            key={item.key}
                            onClick={() => setMemoryLens(item.key)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                            <em>{formatNumber(item.count)}</em>
                        </button>
                    ))}
                </div>

                <div className="memory-sidebar-note">
                    <Lightbulb size={17} />
                    <div>
                        <strong>{tx('Threads come from real fields', '主线来自真实字段')}</strong>
                        <p>{tx('Groups use semantic category, source scene, consolidation keys, and dates.', '按语义分类、来源场景、合并键和时间确定性聚合。')}</p>
                    </div>
                </div>
            </aside>

            <main className="memory-map-main">
                <div className="memory-map-toolbar">
                    <div>
                        <span className="memory-eyebrow">MEMORY MAP</span>
                        <h1>{activeCharacterId ? tx('Role Memory Threads', '角色记忆脉络') : tx('All Memory Threads', '全部记忆脉络')}</h1>
                        <p>{tx('Browse formal memories by topic, source, time, and traceable carrier cards.', '按主题、来源、时间和可追溯承载卡浏览正式记忆。')}</p>
                    </div>
                    <div className="memory-toolbar-controls">
                        <label className="memory-search-box">
                            <Search size={15} />
                            <input
                                value={memorySearch}
                                onChange={event => setMemorySearch(event.target.value)}
                                placeholder={tx('Search memory content, people, or places', '搜索记忆内容、人物或地点')}
                            />
                        </label>
                        <div className="memory-view-switch">
                            <button type="button" className={libraryViewMode === 'new' ? 'is-active' : ''} onClick={() => setLibraryViewMode('new')} title={tx('New library', '新版记忆库')}>
                                <GitBranch size={15} />
                            </button>
                            <button type="button" className={libraryViewMode === 'old' ? 'is-active' : ''} onClick={() => setLibraryViewMode('old')} title={tx('Legacy backup', '旧库备份')}>
                                <List size={15} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="memory-map-legend">
                    <span><i className="memory-dot core" />{tx('Core', '核心记忆')}</span>
                    <span><i className="memory-dot active" />{tx('Active', '活跃记忆')}</span>
                    <span><i className="memory-dot ambient" />{tx('Ambient', '背景记忆')}</span>
                    <span><CalendarDays size={14} />{tx('Sorted by latest update', '按最近更新')}</span>
                </div>

                <div className="memory-thread-canvas">
                    {threads.length === 0 ? (
                        <div className="memory-map-empty">{tx('No memories match the current filters.', '当前筛选下没有匹配的记忆。')}</div>
                    ) : threads.map(thread => (
                        <article className={`memory-thread memory-thread-${thread.tone}`} key={thread.key}>
                            <div className="memory-thread-line">
                                <span>{getThreadIcon(thread.tone)}</span>
                                <i />
                            </div>
                            <div className="memory-thread-content">
                                <div className="memory-thread-heading">
                                    <div>
                                        <span>{thread.label} · {formatNumber(thread.count)} {tx('memories', '条记忆')}</span>
                                        <h3>{thread.description}</h3>
                                    </div>
                                    {thread.strongest > 0 && <em>{tx('Importance', '重要性')} {thread.strongest}</em>}
                                </div>
                                <div className="memory-cluster-grid">
                                    {thread.items.slice(0, 6).map(item => {
                                        const itemKey = getMemoryItemKey(item);
                                        const sourceIds = getMemorySourceIds(item);
                                        const deleting = sourceIds.some(id => deletingIds.includes(Number(id)));
                                        return (
                                            <button
                                                type="button"
                                                className={`memory-map-card ${String(selectedMemoryKey || '') === String(itemKey) || (!selectedMemoryKey && selectedMemory && getMemoryItemKey(selectedMemory) === itemKey) ? 'is-selected' : ''}`}
                                                key={itemKey}
                                                onClick={() => setSelectedMemoryKey(itemKey)}
                                            >
                                                <span>{formatDate(getMemoryUpdatedAt(item))}</span>
                                                <strong>{getMemoryTitle(item, tx)}</strong>
                                                <small>{getMemoryCharacterName(item, characterStats, tx)} · {optionLabel(item.memory_focus, item.memory_focus)} · {deleting ? tx('Deleting', '删除中') : `${tx('Sources', '来源')} ${formatNumber(item.source_count || sourceIds.length || 1)}`}</small>
                                                <div>
                                                    {getMemoryDisplayTags(item).slice(0, 4).map((tag, tagIndex) => <em key={`${itemKey}-${tag}-${tagIndex}`}>{optionLabel(tag, tag)}</em>)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </main>

            <MemoryInspector
                tx={tx}
                memory={selectedMemory}
                thread={selectedThread}
                characterStats={characterStats}
                onViewSource={onViewSource}
                onEdit={onEdit}
                onDelete={onDelete}
                deletingIds={deletingIds}
            />
        </section>
    );
}

function MemoryInspector({ tx, memory, thread, characterStats, onViewSource, onEdit, onDelete, deletingIds }) {
    if (!memory) {
        return (
            <aside className="memory-inspector">
                <div className="memory-inspector-heading">
                    <div>
                        <span className="memory-eyebrow">MEMORY DETAIL</span>
                        <h2>{tx('Memory Detail', '记忆详情')}</h2>
                    </div>
                    <PanelRightClose size={17} />
                </div>
                <div className="memory-map-empty">{tx('Select a memory to inspect details.', '选择一条记忆查看详情。')}</div>
            </aside>
        );
    }

    const sourceIds = getMemorySourceIds(memory);
    const isNewMemory = memory.memory_library_source === 'new'
        || memory.memory_library_source === 'new_grouped'
        || Array.isArray(memory.source_ids);
    const isDeleting = sourceIds.some(id => deletingIds.includes(Number(id)));
    const related = (thread?.items || []).filter(item => getMemoryItemKey(item) !== getMemoryItemKey(memory)).slice(0, 3);
    const importance = getMemoryImportance(memory);
    const tone = getMemoryTone(memory);

    return (
        <aside className="memory-inspector">
            <div className="memory-inspector-heading">
                <div>
                    <span className="memory-eyebrow">MEMORY DETAIL</span>
                    <h2>{tx('Memory Detail', '记忆详情')}</h2>
                </div>
                <PanelRightClose size={17} />
            </div>
            <section className="memory-detail-hero">
                <div className="memory-detail-badges">
                    <span>{optionLabel(getMemoryTier(memory), getMemoryTier(memory))}</span>
                    <span>{optionLabel(memory.memory_focus, memory.memory_focus || 'general')}</span>
                </div>
                <h3>{getMemoryTitle(memory, tx)}</h3>
                <p>{getMemoryBody(memory, tx)}</p>
                {importance > 0 && (
                    <div className="memory-importance-meter">
                        <span><strong>{tx('Importance', '重要性')}</strong><em>{importance} / 10</em></span>
                        <i><b className={`is-${tone}`} style={{ width: `${importance * 10}%` }} /></i>
                    </div>
                )}
            </section>
            <section className="memory-detail-card">
                <div className="memory-card-heading">
                    <span><Link2 size={15} />{tx('Source', '来源')}</span>
                    <button type="button" onClick={() => onViewSource({ item: memory, ids: sourceIds })} disabled={!sourceIds.length}>
                        {tx('View Source', '查看原文')}
                    </button>
                </div>
                <div className="memory-source-summary">
                    <strong>{getMemoryCharacterName(memory, characterStats, tx)}</strong>
                    <small>{formatDateTime(getMemoryUpdatedAt(memory))} · {sourceIds.slice(0, 5).map(id => `#${id}`).join(' ') || tx('No carrier id', '无承载卡 ID')}</small>
                </div>
            </section>
            <section className="memory-detail-card">
                <div className="memory-card-heading">
                    <span><Tags size={15} />{tx('Bound Tags', '绑定标签')}</span>
                    <button type="button" onClick={() => onEdit({ type: isNewMemory ? 'new' : 'legacy', item: memory, ids: isNewMemory ? sourceIds : [memory.representative_id || memory.id].filter(Boolean) })}>
                        {tx('Edit', '编辑')}
                    </button>
                </div>
                <div className="memory-tag-cloud">
                    {uniqueMemoryLabels([memory.consolidation_key, ...getMemoryDisplayTags(memory)])
                        .filter(Boolean)
                        .slice(0, 8)
                        .map((tag, tagIndex) => <span key={`${getMemoryItemKey(memory)}-${tag}-${tagIndex}`}>{optionLabel(tag, tag)}</span>)}
                </div>
            </section>
            {related.length > 0 && (
                <section className="memory-detail-card">
                    <div className="memory-card-heading">
                        <span><Activity size={15} />{tx('Related by Same Thread', '同主线关联')}</span>
                        <em>{related.length}</em>
                    </div>
                    <div className="memory-related-list">
                        {related.map(item => (
                            <div key={getMemoryItemKey(item)}>
                                <i className={`memory-dot ${getMemoryTone(item)}`} />
                                <span><strong>{getMemoryTitle(item, tx)}</strong><small>{formatDate(getMemoryUpdatedAt(item))}</small></span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            <div className="memory-detail-actions">
                <button type="button" className="memory-core-ghost" onClick={() => onEdit({ type: isNewMemory ? 'new' : 'legacy', item: memory, ids: isNewMemory ? sourceIds : [memory.representative_id || memory.id].filter(Boolean) })}>
                    <Edit2 size={14} />{tx('Edit', '编辑')}
                </button>
                <button type="button" className="memory-core-ghost" onClick={() => onViewSource({ item: memory, ids: sourceIds })} disabled={!sourceIds.length}>
                    <FileText size={14} />{tx('Source', '原文')}
                </button>
                <button type="button" className="memory-core-ghost danger" onClick={() => onDelete({ type: isNewMemory ? 'new' : 'legacy', item: memory, ids: sourceIds })} disabled={isDeleting}>
                    <Trash2 size={14} />{isDeleting ? tx('Deleting', '删除中') : tx('Delete', '删除')}
                </button>
            </div>
        </aside>
    );
}

function MemoryMaintenanceIntro({ tx, autoProgress, promptTaskMode, setPromptTaskMode, maintenanceMode, setMaintenanceMode, activeCharacterName, pendingCount, temporalCount, reviewCount, onShowExternalImport }) {
    const running = !!autoProgress?.running;
    return (
        <section className="memory-maintenance-intro">
            <aside className="memory-maintenance-sidebar">
                <div>
                    <span className="memory-eyebrow">IMPORT</span>
                    <h2>{tx('Memory Import', '记忆导入')}</h2>
                </div>
                <button type="button" className={promptTaskMode === 'complete' ? 'is-active' : ''} onClick={() => setPromptTaskMode('complete')}>
                    <span><WandSparkles size={16} /></span>
                    <div><strong>{tx('Import Summary', '导入总结')}</strong><small>{formatNumber(pendingCount)} {tx('pending', '待处理')}</small></div>
                    <em>{formatNumber(pendingCount)}</em>
                </button>
                <button type="button" className={promptTaskMode === 'supplement' ? 'is-active' : ''} onClick={() => setPromptTaskMode('supplement')}>
                    <span><Clock3 size={16} /></span>
                    <div><strong>{tx('Supplement Tags', '补充标签')}</strong><small>{formatNumber(temporalCount)} {tx('need tags', '缺标签')}</small></div>
                    <em>{formatNumber(temporalCount)}</em>
                </button>
                <button type="button" onClick={onShowExternalImport}>
                    <span><Upload size={16} /></span>
                    <div><strong>{tx('External Chat Import', '外部聊天导入')}</strong><small>{tx('Preview candidates before writing', '预览候选后再写入')}</small></div>
                </button>
                <button type="button" className={maintenanceMode === 'manual' ? 'is-active' : ''} onClick={() => setMaintenanceMode('manual')}>
                    <span><ListFilter size={16} /></span>
                    <div><strong>{tx('Single Batch Review', '单批预览')}</strong><small>{tx('Preview prompt and run once', '预览 prompt 并运行一次')}</small></div>
                </button>
                <button type="button" className={maintenanceMode === 'auto' ? 'is-active' : ''} onClick={() => setMaintenanceMode('auto')}>
                    <span><Play size={16} /></span>
                    <div><strong>{tx('Background Auto Run', '后台连续运行')}</strong><small>{tx('Recoverable live progress', '可恢复实时进度')}</small></div>
                </button>
            </aside>
            <main className="memory-maintenance-main">
                <div className="memory-maintenance-title">
                    <div>
                        <span className="memory-eyebrow">AI MEMORY IMPORT</span>
                        <h1>{promptTaskMode === 'supplement'
                            ? tx(`Supplement tags for ${activeCharacterName || 'selected role'}`, `为 ${activeCharacterName || '当前角色'} 补来源和时间`)
                            : tx(`Import and summarize ${activeCharacterName || 'selected role'} memories`, `导入并总结 ${activeCharacterName || '当前角色'} 的记忆`)}</h1>
                        <p>{promptTaskMode === 'supplement'
                            ? tx('Supplement mode only adds source-scene and time tags; it does not rewrite memory content.', '补充模式只补来源场景和时间标签，不改写记忆内容。')
                            : tx('The small model summarizes old or external records into new memories, then writes them after preview or confirmation.', '小模型把旧库或外部记录整理成新记忆，预览或确认后再写入。')}</p>
                    </div>
                    <span className={`memory-run-state ${running ? 'is-running' : ''}`}>{running ? formatProgressPhase(autoProgress.phase) : tx('Ready', '准备就绪')}</span>
                </div>
                <div className="memory-pipeline">
                    {[tx('Read old/file records', '读取旧库/文件'), tx('Small-model summary', '小模型总结'), tx('Preview and check', '预览校验'), tx('Write new memories', '写入新记忆')].map((label, index) => (
                        <React.Fragment key={label}>
                            <div className={index === 0 && running ? 'is-current' : ''}><span>{index + 1}</span><strong>{label}</strong></div>
                            {index < 3 && <ChevronDown size={15} />}
                        </React.Fragment>
                    ))}
                </div>
                {reviewCount > 0 && (
                    <div className="memory-review-strip">
                        <strong>{formatNumber(reviewCount)} {tx('items need attention', '条记忆需要关注')}</strong>
                        <span>{tx('Uncertain model results remain visible in the run result area and are not deleted automatically.', '不确定结果会保留在运行结果区，不会自动删除。')}</span>
                    </div>
                )}
            </main>
        </section>
    );
}

function MemoryLibraryPanel({ apiUrl, contacts = [] }) {
    const { lang } = useLanguage();
    const tx = useCallback((en, zh) => (lang === 'en' ? en : zh), [lang]);
    const pageRef = useRef(null);
    const progressRefreshRef = useRef(null);
    const activeRunMissRef = useRef(0);
    const externalImportFileRef = useRef(null);
    const externalImportRequestRef = useRef(false);
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
    const [selectedCharacterId, setSelectedCharacterId] = useState('');
    const [libraryViewMode, setLibraryViewMode] = useState('new');
    const [maintenanceMode, setMaintenanceMode] = useState('manual');
    const [promptTaskMode, setPromptTaskMode] = useState('complete');
    const [manualBatchIndex, setManualBatchIndex] = useState(1);
    const [autoMaxBatches, setAutoMaxBatches] = useState('');
    const [deletingIds, setDeletingIds] = useState([]);
    const [editingMemory, setEditingMemory] = useState(null);
    const [sourceViewer, setSourceViewer] = useState(null);
    const [editSaving, setEditSaving] = useState(false);
    const [externalSourceApp, setExternalSourceApp] = useState('gpt');
    const [externalImportMode, setExternalImportMode] = useState('one_to_one');
    const [externalTargetName, setExternalTargetName] = useState('Claude');
    const [externalImportText, setExternalImportText] = useState('');
    const [externalImportFile, setExternalImportFile] = useState(null);
    const [externalImportPreview, setExternalImportPreview] = useState(null);
    const [selectedExternalRoles, setSelectedExternalRoles] = useState([]);
    const [externalImportLoading, setExternalImportLoading] = useState(false);
    const [externalImportCommitting, setExternalImportCommitting] = useState(false);
    const [memoryStatus, setMemoryStatus] = useState(null);
    const [memoryStatusLoading, setMemoryStatusLoading] = useState(false);
    const [memoryStatusError, setMemoryStatusError] = useState('');
    const [primaryView, setPrimaryView] = useState('map');
    const [memoryLens, setMemoryLens] = useState('all');
    const [memorySearch, setMemorySearch] = useState('');
    const [selectedMemoryKey, setSelectedMemoryKey] = useState('');
    const [mapSidebarsRaised, setMapSidebarsRaised] = useState(false);

    const headers = useMemo(() => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`
    }), []);
    const modelOptions = useMemo(() => withLocalModelOption(models), [models]);

    const applyLocalModelPreset = useCallback(() => {
        setSettings(prev => ({
            ...prev,
            ...LOCAL_OLLAMA_MODEL_PRESET
        }));
        setModels(prev => withLocalModelOption(prev));
        setModelError('');
        setNotice(tx('Local Ollama model selected.', '已选择本地 Ollama 模型。'));
    }, [tx]);

    const handleModelSelect = useCallback((modelName) => {
        if (modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name) {
            applyLocalModelPreset();
            return;
        }
        setSettings(prev => ({ ...prev, model_name: modelName }));
    }, [applyLocalModelPreset]);

    const getModelOptionLabel = useCallback((modelName) => (
        modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name
            ? `${modelName} · ${tx('Local Ollama', '本地 Ollama')}`
            : modelName
    ), [tx]);

    const getMemoryBackendLabel = useCallback((backend) => {
        const labels = {
            'qdrant-primary-with-vectra-fallback': { en: 'Qdrant primary / vectra fallback', zh: 'Qdrant 主检索 / vectra 兜底' },
            'vectra-fallback-only': { en: 'vectra fallback only', zh: '仅使用 vectra 兜底' },
            'qdrant-online-collection-pending': { en: 'Qdrant online / collection pending', zh: 'Qdrant 在线 / 集合待建立' },
            'vectra-fallback-active': { en: 'vectra fallback active', zh: 'vectra 兜底中' },
        };
        return labels[backend]?.[lang] || backend || '-';
    }, [lang]);

    const getMemoryStatusNote = useCallback((status) => {
        const code = status?.statusNoteCode || '';
        const notes = {
            'collection_pending_existing_memories': {
                en: 'Qdrant is online, but this account has not built its vector collection yet.',
                zh: 'Qdrant 已在线，但这个账号的向量集合还没有建立。'
            },
            'collection_pending_first_memory': {
                en: 'Qdrant is online. Your vector collection will appear after the first memory is written or indexed.',
                zh: 'Qdrant 已在线。等第一批记忆被写入或建立索引后，你的向量集合就会出现。'
            }
        };
        if (notes[code]) return notes[code][lang];
        return status?.statusNote || '';
    }, [lang]);

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
            setMapSidebarsRaised(current => (current === shouldRaise ? current : shouldRaise));
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
                setSelectedExternalRoles((data.role_tags || []).map(tag => tag.name).filter(Boolean));
                if (data.import.source_app) setExternalSourceApp(data.import.source_app);
                if (data.import.import_mode) setExternalImportMode(data.import.import_mode);
                sessionStorage.setItem(EXTERNAL_IMPORT_SESSION_KEY, JSON.stringify(data));
                setNotice(prev => prev || tx(`Restored the latest uncommitted external import preview: ${formatNumber(data.candidates.length)} candidates.`, `已恢复最近一次未提交的外部导入预览：${formatNumber(data.candidates.length)} 条候选。`));
            } catch (e) {
                console.warn('Failed to restore latest external import preview:', e.message);
            }
        };
        restorePreview();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, headers]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({ limit_per_group: '36', forgetting_limit: '90' });
            if (activeCharacterId) query.set('character_id', activeCharacterId);
            query.set('source', libraryViewMode === 'old' ? 'legacy' : 'new');
            const [overviewRes, libraryRes] = await Promise.all([
                fetch(`${apiUrl}/memory-maintenance/overview`, { headers }),
                fetch(`${apiUrl}/memory-maintenance/library?${query.toString()}`, { headers })
            ]);
            const overviewData = await overviewRes.json().catch(() => ({}));
            const libraryData = await libraryRes.json().catch(() => ({}));
            if (!overviewRes.ok || !overviewData.success) throw new Error(overviewData.error || 'Failed to load overview');
            if (!libraryRes.ok || !libraryData.success) throw new Error(libraryData.error || 'Failed to load library');
            setOverview(overviewData.overview || null);
            setLibrary(libraryData.library || null);
            setSettings({ ...emptySettings, ...(overviewData.settings || {}) });
            const topCharacter = overviewData.overview?.migration_characters?.[0]?.character_id
                || overviewData.overview?.by_character?.[0]?.character_id
                || contacts?.[0]?.id
                || '';
            const availableCharacterIds = new Set([
                ...(overviewData.overview?.migration_characters || []).map(item => String(item.character_id || '')),
                ...(overviewData.overview?.by_character || []).map(item => String(item.character_id || '')),
                ...(contacts || []).map(item => String(item.id || ''))
            ].filter(Boolean));
            setSelectedCharacterId(prev => (prev && availableCharacterIds.has(String(prev)) ? prev : topCharacter));
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

    const scheduleProgressRefresh = useCallback((delay = 700) => {
        if (progressRefreshRef.current) {
            clearTimeout(progressRefreshRef.current);
        }
        progressRefreshRef.current = window.setTimeout(() => {
            progressRefreshRef.current = null;
            loadData();
        }, delay);
    }, [loadData]);

    const adoptRunSnapshot = useCallback((run) => {
        if (!run?.run_id) return;
        activeRunMissRef.current = 0;
        const events = Array.isArray(run.events) ? run.events : [];
        setAutoProgress({
            ...run,
            running: !!run.running,
            last_event: events[events.length - 1] || run
        });
        setAutoProgressLog(events);
        setAutoLoading(!!run.running);
        if (run.characterId) {
            setSelectedCharacterId(prev => prev || run.characterId);
        }
    }, []);

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
            message: tx('The backend no longer has this running task. It may have restarted or cleared the task.', '后端没有找到正在运行的自动任务，可能是后端重启或任务已被清掉。'),
            timestamp: Date.now()
        };
        setAutoProgress(event);
        setAutoProgressLog(prev => [...prev, event].slice(-80));
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
            max_rerolls: autoProgress.max_rerolls
        });
        setNotice(tx('The backend no longer has this task. The old progress was marked stopped; you can start automatic work again.', '后端已经没有这个自动任务了，页面已把旧进度标成停止；可以重新点开始自动工作。'));
        scheduleProgressRefresh(100);
    }, [autoProgress, scheduleProgressRefresh]);

    const loadMaintenanceRunSnapshot = useCallback(async (runId) => {
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
    }, [adoptRunSnapshot, apiUrl, headers]);

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
        loadData();
    }, [loadData]);

    useEffect(() => {
        loadMemoryStatus();
    }, [loadMemoryStatus]);

    useEffect(() => {
        loadActiveMaintenanceRun();
    }, [loadActiveMaintenanceRun]);

    useEffect(() => {
        if (!autoLoading && autoProgress?.running !== true) return undefined;
        const timer = window.setInterval(async () => {
            const found = autoProgress?.run_id
                ? await loadMaintenanceRunSnapshot(autoProgress.run_id)
                : false;
            const foundActive = found || await loadActiveMaintenanceRun();
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
        scheduleProgressRefresh
    ]);

    useEffect(() => () => {
        if (progressRefreshRef.current) {
            clearTimeout(progressRefreshRef.current);
        }
    }, []);

    useEffect(() => {
        const handleMaintenanceProgress = (event) => {
            const detail = event.detail || {};
            if (!detail.run_id) return;
            activeRunMissRef.current = 0;
            const eventCharacterId = String(detail.characterId || detail.character?.id || '');
            const currentCharacterId = String(selectedCharacterId || '');
            const externalImportEvent = detail.task_mode === 'external_import';
            setAutoProgress(prev => {
                const sameRun = prev?.run_id && prev.run_id === detail.run_id;
                const relevantCharacter = !currentCharacterId || eventCharacterId === currentCharacterId;
                if (!sameRun && !relevantCharacter && !externalImportEvent) return prev;
                const isTerminal = detail.phase === 'done' || detail.phase === 'stopped';
                return {
                    ...(prev || {}),
                    ...detail,
                    running: !isTerminal,
                    last_event: detail
                };
            });
            setAutoProgressLog(prev => {
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
                    max_rerolls: detail.max_rerolls
                };
                setRunResult(nextResult);
                if (detail.phase === 'stopped' || detail.success === false) {
                    const errorText = summarizeAutoRunError(nextResult);
                    setNotice(tx(`Automatic task stopped: ${formatStoppedReason(detail.stopped_reason)}${errorText ? `; ${errorText}` : ''}`, `自动任务已停止：${formatStoppedReason(detail.stopped_reason)}${errorText ? `；${errorText}` : ''}`));
                }
            }
        };
        window.addEventListener('memory_maintenance_progress', handleMaintenanceProgress);
        return () => window.removeEventListener('memory_maintenance_progress', handleMaintenanceProgress);
    }, [autoProgress?.run_id, scheduleProgressRefresh, selectedCharacterId]);

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
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
                    'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`
                },
                body: JSON.stringify({ endpoint: settings.api_endpoint, key: settings.api_key })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            const nextModels = data.models || [];
            setModels(nextModels);
            if (!nextModels.length) setModelError(lang === 'en' ? 'No remote models found. The local Ollama option is still available.' : '未找到远端模型；仍可选择本地 Ollama。');
        } catch (e) {
            setModelError(lang === 'en' ? `Fetch failed: ${e.message}` : `拉取失败：${e.message}`);
        } finally {
            setModelFetching(false);
        }
    };

    const loadBatchPreview = async () => {
        if (!selectedCharacterId) return;
        setBatchLoading(true);
        try {
            const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 30)));
            const batchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
            const offset = (batchIndex - 1) * limit;
            const res = await fetch(`${apiUrl}/memories/${selectedCharacterId}/maintenance/batch?limit=${limit}&offset=${offset}&status=pending`, { headers });
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
                source: temporalPromptSource
            });
            const res = await fetch(`${apiUrl}/memories/${selectedCharacterId}/maintenance/temporal-binding-batch?${query.toString()}`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Temporal prompt load failed');
            setTemporalPromptPreview(data.prompt?.full_prompt || '');
            setNotice(tx(`Generated source-scene and time-tag prompt: new library batch ${data.batch_index || batchIndex}, ${data.items?.length || 0} items.`, `已生成来源场景+时间标签 prompt：新版库第 ${data.batch_index || batchIndex} 批，${data.items?.length || 0} 条。`));
        } catch (e) {
            alert(tx(`Failed to read time-binding supplemental prompt: ${e.message}`, `读取时间绑定补充 prompt 失败：${e.message}`));
        } finally {
            setTemporalPromptLoading(false);
        }
    };

    const runBatchMigration = async () => {
        if (!selectedCharacterId) return;
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert(tx('Fill and save the small model URL, key, and model name first.', '请先填写并保存小模型 URL、Key 和模型名。'));
            return;
        }
        const confirmBatchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
        if (!window.confirm(tx(`This will call the small model for old memory-card batch ${confirmBatchIndex} of the current role, ${settings.batch_size} items per batch, max output ${settings.max_output_tokens || 8000} tokens, then write results back to memory maintenance state. Continue?`, `将调用小模型处理当前角色第 ${confirmBatchIndex} 批旧记忆卡片，每批 ${settings.batch_size} 条，输出上限 ${settings.max_output_tokens || 8000} tokens，并把结果写回记忆维护状态。继续吗？`))) {
            return;
        }
        setRunLoading(true);
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
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
                body: JSON.stringify({ limit, offset, status: 'pending' })
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
            setBatchPreview(prev => prev || { items: (data.normalized?.apply_items || []).map(item => ({ id: item.id })) });
            setPromptPreview(data.prompt?.full_prompt || promptPreview);
            setNotice(tx(`Manual batch ${data.batch?.batch_index || batchIndex} processed ${data.batch?.item_count || 0} items, applied ${data.apply?.updated || 0} updates.`, `手动第 ${data.batch?.batch_index || batchIndex} 批已处理 ${data.batch?.item_count || 0} 条，应用更新 ${data.apply?.updated || 0} 条。`));
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
            alert(tx('Fill and save the small model URL, key, and model name first.', '请先填写并保存小模型 URL、Key 和模型名。'));
            return;
        }
        const confirmBatchIndex = Math.max(1, Number(manualBatchIndex || 1) || 1);
        if (!window.confirm(tx(`This will call the small model to add source-scene and time tags to new-memory batch ${confirmBatchIndex} of the current role, ${settings.batch_size} items per batch. It will not rewrite memory content. Continue?`, `将调用小模型给当前角色第 ${confirmBatchIndex} 批新版记忆补来源场景和时间标签，每批 ${settings.batch_size} 条。它不会改写记忆内容。继续吗？`))) {
            return;
        }
        setRunLoading(true);
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
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
                body: JSON.stringify({ limit, offset, source: 'new' })
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
            setNotice(tx(`Supplement batch ${data.batch?.batch_index || batchIndex} processed ${data.batch?.item_count || 0} items, wrote back ${data.apply?.updated || 0}.`, `补充第 ${data.batch?.batch_index || batchIndex} 批已处理 ${data.batch?.item_count || 0} 条，写回 ${data.apply?.updated || 0} 条。`));
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
        const options = runOptions?.nativeEvent ? {} : (runOptions || {});
        const targetCharacterId = options.characterId || selectedCharacterId;
        const isContinuation = options.continuation === true;
        if (!targetCharacterId) {
            setNotice(tx('This account has no role memories available for automatic summarization. For external import, choose a file and use one-click import summary.', '当前账号没有可自动总结的角色记忆。外部导入请先选择文件，然后直接点“一键导入总结”。'));
            return;
        }
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert(tx('Fill and save the small model URL, key, and model name first.', '请先填写并保存小模型 URL、Key 和模型名。'));
            return;
        }
        const migrationTargets = overview?.migration_characters || overview?.legacy_by_character || [];
        const targetStats = migrationTargets.find(item => String(item.character_id) === String(targetCharacterId));
        if (!targetStats || Number(targetStats.total || 0) <= 0) {
            setNotice(tx('This account has no pending legacy memories for automatic summarization. For external import, choose a file and run one-click import summary.', '当前账号没有旧库 pending 可自动总结。外部导入请直接选择文件后一键导入总结。'));
            return;
        }
        if (!isContinuation && Number(targetStats.pending || 0) <= 0) {
            setNotice(tx(`${targetStats.name || 'Current role'} has no pending legacy memories or external import material to summarize automatically.`, `${targetStats.name || '当前角色'} 没有 pending 旧记忆或外部导入原料需要自动总结。`));
            return;
        }
        const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 30)));
        const runUntilEmpty = String(autoMaxBatches || '').trim() === '';
        const maxBatches = runUntilEmpty ? null : Math.max(1, Number(autoMaxBatches || 1) || 1);
        const runScopeText = isContinuation
            ? tx('reread remaining pending items from the breakpoint and continue', '从断点处重新读取剩余 pending 并继续')
            : (runUntilEmpty ? tx('run until pending is empty or a failure occurs', '一直跑到待分类为空或失败') : tx(`up to ${maxBatches} batches`, `最多 ${maxBatches} 批`));
        if (!options.skipConfirm && !window.confirm(tx(`Automatic summarization will process the current role's pending memories from the start, ${runScopeText}, ${limit} items per batch, max output ${settings.max_output_tokens || 8000} tokens, and write results back to memory maintenance state. Continue?`, `自动总结会从当前角色的待分类记忆开头连续处理，${runScopeText}，每批 ${limit} 条，输出上限 ${settings.max_output_tokens || 8000} tokens，并把结果写回记忆维护状态。继续吗？`))) {
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
            message: isContinuation ? tx('Preparing to continue from breakpoint.', '准备从断点继续。') : tx('Preparing automatic summarization.', '准备开始自动总结。')
        });
        setAutoProgressLog([]);
        let keepAutoLoading = false;
        try {
            if (isContinuation) {
                setNotice(tx('Continuing automatic summarization from the breakpoint. The first remaining pending batch will be reread.', '正在从断点处继续自动总结，会重新读取当前剩余 pending 的第一批。'));
            }
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
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
                    background: true
                })
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
                setNotice(data.reused
                    ? tx('An automatic summarization task is already running in the background. Progress display has been restored.', '已有自动总结任务正在后台运行，已恢复进度显示。')
                    : tx(`${isContinuation ? 'Continuation task' : 'Automatic summarization'} started in the background. Changing pages or refreshing will not interrupt it.`, `${isContinuation ? '继续任务' : '自动总结'}已在后台启动，切换页面或刷新不会打断。`));
                scheduleProgressRefresh(300);
                return;
            }
            setRunResult(data);
            setAutoProgress(prev => ({
                ...(prev || {}),
                running: false,
                phase: 'done',
                processed: data.processed || 0,
                updated: data.updated || 0,
                stopped_reason: data.stopped_reason,
                stats: data.stats
            }));
            setBatchPreview(null);
            setPromptPreview(data.prompt?.full_prompt || promptPreview);
            const realRuns = (data.runs || []).filter(item => !item.empty).length;
            const rerollCount = (data.runs || []).reduce((sum, item) => sum + Number(item.rerolls || 0), 0);
            const rerollText = rerollCount ? tx(`, rerolled ${rerollCount} times`, `，重 roll ${rerollCount} 次`) : '';
            const stoppedText = data.stopped_reason ? tx(`, stop reason: ${formatStoppedReason(data.stopped_reason)}`, `，停止原因：${formatStoppedReason(data.stopped_reason)}`) : '';
            setNotice(tx(`${isContinuation ? 'Continuation task completed' : 'Automatic summarization completed'}: ran ${realRuns} batches, processed ${data.processed || 0} items, applied ${data.updated || 0} updates${rerollText}${stoppedText}.`, `${isContinuation ? '继续任务完成' : '自动总结完成'}：跑了 ${realRuns} 批，处理 ${data.processed || 0} 条，应用更新 ${data.updated || 0} 条${rerollText}${stoppedText}。`));
            await loadData();
        } catch (e) {
            setAutoProgress(prev => prev ? { ...prev, running: false, phase: prev.phase === 'stopped' ? prev.phase : 'stopped' } : prev);
            alert(tx(`${isContinuation ? 'Continuation task failed' : 'Automatic summarization failed'}: ${e.message}`, `${isContinuation ? '继续任务失败' : '自动总结失败'}：${e.message}`));
        } finally {
            setAutoLoading(keepAutoLoading);
        }
    };

    const runAutoSupplement = async (runOptions = {}) => {
        const options = runOptions?.nativeEvent ? {} : (runOptions || {});
        const targetCharacterId = options.characterId || selectedCharacterId;
        const isContinuation = options.continuation === true;
        if (!targetCharacterId) {
            setNotice(tx('This account has no new memories available for automatic supplementation. For external import, choose a file and use one-click import summary.', '当前账号没有新版记忆可自动补充。外部导入请先选择文件，然后直接点“一键导入总结”。'));
            return;
        }
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            alert(tx('Fill and save the small model URL, key, and model name first.', '请先填写并保存小模型 URL、Key 和模型名。'));
            return;
        }
        const targetStats = (overview?.by_character || []).find(item => String(item.character_id) === String(targetCharacterId));
        if (!targetStats || Number(targetStats.formal_total || targetStats.total || 0) <= 0) {
            setNotice(tx('The current role has no new memories to supplement yet. External imports write directly to the new memory library and do not need to submit a preview queue first.', '当前角色还没有新版记忆可补充。外部导入会直接写入新版记忆库，不需要先提交预览队列。'));
            return;
        }
        const limit = Math.max(10, Math.min(100, Number(settings.batch_size || 40)));
        const runUntilEmpty = String(autoMaxBatches || '').trim() === '';
        const maxBatches = runUntilEmpty ? null : Math.max(1, Number(autoMaxBatches || 1) || 1);
        const runScopeText = isContinuation
            ? tx('continue supplementation from the breakpoint', '从断点处继续补充')
            : (runUntilEmpty ? tx('scan the whole new library or stop on failure', '扫完整个新版库或失败') : tx(`up to ${maxBatches} batches`, `最多 ${maxBatches} 批`));
        if (!options.skipConfirm && !window.confirm(tx(`Automatic supplementation will process the current role's new memories continuously, ${runScopeText}, ${limit} items per batch. It adds source-scene and time tags without rewriting memory content. Continue?`, `自动补充会连续处理当前角色的新版记忆，${runScopeText}，每批 ${limit} 条，补来源场景和时间标签，不改写记忆。继续吗？`))) {
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
            message: isContinuation ? tx('Preparing to continue automatic supplementation.', '准备继续自动补充。') : tx('Preparing automatic supplementation.', '准备开始自动补充。')
        });
        setAutoProgressLog([]);
        let keepAutoLoading = false;
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
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
                    background: true
                })
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
                setNotice(data.reused
                    ? tx('An automatic task is already running in the background. Progress display has been restored.', '已有自动任务正在后台运行，已恢复进度显示。')
                    : tx(`${isContinuation ? 'Supplement continuation' : 'Automatic supplementation'} started in the background. Changing pages or refreshing will not interrupt it.`, `${isContinuation ? '继续补充' : '自动补充'}已在后台启动，切换页面或刷新不会打断。`));
                scheduleProgressRefresh(300);
                return;
            }
            setRunResult({ ...data, task_mode: 'supplement' });
            setAutoProgress(prev => ({
                ...(prev || {}),
                running: false,
                task_mode: 'supplement',
                phase: 'done',
                processed: data.processed || 0,
                updated: data.updated || 0,
                stopped_reason: data.stopped_reason,
                stats: data.stats
            }));
            setBatchPreview(null);
            setTemporalPromptPreview(data.prompt?.full_prompt || temporalPromptPreview);
            const realRuns = (data.runs || []).filter(item => !item.empty).length;
            const rerollCount = (data.runs || []).reduce((sum, item) => sum + Number(item.rerolls || 0), 0);
            const rerollText = rerollCount ? tx(`, rerolled ${rerollCount} times`, `，重 roll ${rerollCount} 次`) : '';
            const stoppedText = data.stopped_reason ? tx(`, stop reason: ${formatStoppedReason(data.stopped_reason)}`, `，停止原因：${formatStoppedReason(data.stopped_reason)}`) : '';
            setNotice(tx(`${isContinuation ? 'Supplement continuation completed' : 'Automatic supplementation completed'}: ran ${realRuns} batches, processed ${data.processed || 0} items, wrote back ${data.updated || 0}${rerollText}${stoppedText}.`, `${isContinuation ? '继续补充完成' : '自动补充完成'}：跑了 ${realRuns} 批，处理 ${data.processed || 0} 条，写回 ${data.updated || 0} 条${rerollText}${stoppedText}。`));
            await loadData();
        } catch (e) {
            setAutoProgress(prev => prev ? { ...prev, running: false, phase: prev.phase === 'stopped' ? prev.phase : 'stopped' } : prev);
            alert(tx(`${isContinuation ? 'Supplement continuation failed' : 'Automatic supplementation failed'}: ${e.message}`, `${isContinuation ? '继续补充失败' : '自动补充失败'}：${e.message}`));
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
            alert(tx('Configure the memory-library management small model below first.', '先配置下面的记忆库管理小模型。'));
            return;
        }
        console.info('[External Import] preview request start', {
            source_app: externalSourceApp,
            import_mode: externalImportMode,
            has_file: !!externalImportFile,
            text_chars: externalImportText.trim().length
        });
        const form = new FormData();
        let requestSourceApp = externalSourceApp;
        let requestImportMode = externalImportMode;
        if (externalImportFile) {
            const sample = await externalImportFile.slice(0, 300000).text().catch(() => '');
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
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: form
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                const detail = [
                    data.error || tx('External memory preview failed', '外部记忆预览失败'),
                    data.raw_response_preview ? tx(`Raw model response: ${data.raw_response_preview}`, `模型原始返回：${data.raw_response_preview}`) : '',
                    Array.isArray(data.needs_review) && data.needs_review.length ? tx(`Needs review: ${JSON.stringify(data.needs_review).slice(0, 800)}`, `需复核：${JSON.stringify(data.needs_review).slice(0, 800)}`) : ''
                ].filter(Boolean).join('\n\n');
                throw new Error(detail);
            }
            console.info('[External Import] preview request success', {
                import_id: data.import?.id,
                roles: data.role_tags?.length || 0,
                candidates: data.candidates?.length || 0
            });
            const roleNames = (data.role_tags || []).map(tag => tag.name).filter(Boolean);
            const cleanStats = data.prompt_stats?.clean_stats;
            const cleanNote = cleanStats?.changed_messages || cleanStats?.dropped_messages
                ? tx(`, cleaned ${formatNumber(cleanStats.changed_messages || 0)} messages and dropped ${formatNumber(cleanStats.dropped_messages || 0)} noisy items`, `，清洗 ${formatNumber(cleanStats.changed_messages || 0)} 条，丢弃噪声 ${formatNumber(cleanStats.dropped_messages || 0)} 条`)
                : '';
            setExternalImportPreview(data);
            sessionStorage.setItem(EXTERNAL_IMPORT_SESSION_KEY, JSON.stringify(data));
            setSelectedExternalRoles(roleNames);
            setNotice(tx(`External import preview complete: detected ${formatNumber(roleNames.length)} role tags and generated ${formatNumber(data.candidates?.length || 0)} new-memory candidates${cleanNote}.`, `外部导入预览完成：识别 ${formatNumber(roleNames.length)} 个角色标签，生成 ${formatNumber(data.candidates?.length || 0)} 条新版记忆候选${cleanNote}。`));
        } catch (e) {
            console.error('[External Import] preview request failed', e);
            alert(tx(`External memory preview failed: ${e.message}`, `外部记忆预览失败：${e.message}`));
        } finally {
            externalImportRequestRef.current = false;
            setExternalImportLoading(false);
        }
    };

    const toggleExternalRole = (name) => {
        setSelectedExternalRoles(prev => {
            if (prev.includes(name)) return prev.filter(item => item !== name);
            return [...prev, name];
        });
    };

    const commitExternalImport = async () => {
        const importId = externalImportPreview?.import?.id;
        if (!importId) return;
        const roleNames = selectedExternalRoles.length
            ? selectedExternalRoles
            : (externalImportPreview?.role_tags || []).map(tag => tag.name).filter(Boolean);
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
                    create_characters: true
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || tx('External memory import failed', '外部记忆导入失败'));
            const created = (data.characters || []).filter(character => character.created).length;
            setNotice(tx(`Import complete: wrote ${formatNumber(data.imported || 0)} formal new memories and created ${formatNumber(created)} roles. They will not enter the legacy automatic summarization queue.`, `导入完成：写入 ${formatNumber(data.imported || 0)} 条正式新记忆，创建 ${formatNumber(created)} 个角色。不会再进入旧库自动总结队列。`));
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
        const options = runOptions?.nativeEvent ? {} : (runOptions || {});
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
            alert(tx('Configure the memory-library management small model below first.', '先配置下面的记忆库管理小模型。'));
            return;
        }
        const form = new FormData();
        let requestSourceApp = externalSourceApp;
        let requestImportMode = externalImportMode;
        if (!continueImportId && externalImportFile) {
            const sample = await externalImportFile.slice(0, 300000).text().catch(() => '');
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
                ? tx(`Preparing to continue from breakpoint, skipped ${formatNumber(continueOffset)} items.`, `准备从断点继续，已跳过 ${formatNumber(continueOffset)} 条。`)
                : tx(`Preparing to summarize directly into the library in batches of ${limit} source messages.`, `准备按每批 ${limit} 条正文直接总结入库。`)
        });
        setAutoProgressLog([]);
        try {
            const saveRes = await fetch(`${apiUrl}/memory-maintenance/settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(settings)
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok || !saveData.success) throw new Error(saveData.error || 'Save settings failed');
            setSettings({ ...emptySettings, ...(saveData.settings || {}) });

            sessionStorage.removeItem(EXTERNAL_IMPORT_SESSION_KEY);
            setExternalImportPreview(null);
            setSelectedExternalRoles([]);
            const res = await fetch(`${apiUrl}/memory-import/external/auto-run`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` },
                body: form
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                setRunResult(data);
                await loadData();
                const lastError = (data.errors || []).slice(-1)[0]?.error;
                throw new Error(lastError || data.error || tx('External import automatic summarization failed', '外部导入自动总结失败'));
            }
            if (data.accepted) {
                if (data.run) adoptRunSnapshot(data.run);
                setRunResult(null);
                setNotice(continuation
                    ? tx('External import continued from the breakpoint: only source text after the failed batch will be retried; written batches will not rerun.', '外部导入已从断点继续：只重试失败批次之后的正文，不会重跑已写入的批次。')
                    : tx('External import started in the background: it will summarize by batch and write into the new memory library directly, without the second-scan queue.', '外部导入已在后台启动：会直接分批总结并写入新记忆库，不再走二次扫描队列。'));
                scheduleProgressRefresh(300);
                return;
            }
            setRunResult({ ...data, task_mode: 'external_import' });
            setAutoProgress(prev => ({
                ...(prev || {}),
                running: false,
                task_mode: 'external_import',
                phase: data.success ? 'done' : 'stopped',
                processed: data.processed || 0,
                updated: data.updated || 0,
                stopped_reason: data.stopped_reason,
                stats: data.stats
            }));
            setNotice(tx(`External import complete: processed ${formatNumber(data.processed || 0)} source messages and wrote ${formatNumber(data.updated || 0)} formal memories.`, `外部导入完成：处理 ${formatNumber(data.processed || 0)} 条正文，写入 ${formatNumber(data.updated || 0)} 条正式记忆。`));
            setExternalImportText('');
            setExternalImportFile(null);
            if (externalImportFileRef.current) externalImportFileRef.current.value = '';
            await loadData();
        } catch (e) {
            setAutoProgress(prev => prev ? { ...prev, running: false, phase: prev.phase === 'stopped' ? prev.phase : 'stopped' } : prev);
            alert(tx(`External import automatic summarization failed: ${e.message}`, `外部导入自动总结失败：${e.message}`));
        } finally {
            externalImportRequestRef.current = false;
            setExternalImportLoading(false);
        }
    };

    const openMemoryEditor = ({ type, item, ids }) => {
        const safeIds = (Array.isArray(ids) ? ids : [item?.id]).filter(Boolean);
        setEditingMemory({
            type,
            ids: safeIds,
            character_id: item?.character_id || '',
            title: type === 'new' ? tx('Edit New Memory', '编辑新版记忆') : tx('Edit Memory Entry', '编辑记忆条目'),
            summary: type === 'new' ? (item?.summary || item?.text || '') : (item?.text || ''),
            content: type === 'new' ? (item?.summary || item?.text || '') : (item?.text || ''),
            memory_focus: item?.memory_focus || 'general',
            memory_tier: item?.memory_tier || 'ambient',
            importance: Number(item?.importance || 5),
            source_context: item?.source_context || item?.source_contexts?.[0] || 'unknown',
            scene_tag: item?.scene_tag || item?.scene_tags?.[0] || 'other'
        });
    };

    const saveMemoryEditor = async () => {
        if (!editingMemory?.ids?.length) return;
        setEditSaving(true);
        try {
            const payload = {
                memory_focus: editingMemory.memory_focus,
                memory_tier: editingMemory.memory_tier,
                importance: Number(editingMemory.importance || 5),
                source_context: editingMemory.source_context,
                scene_tag: editingMemory.scene_tag
            };
            if (editingMemory.type === 'new') {
                payload.consolidation_summary = editingMemory.summary;
            } else {
                payload.summary = editingMemory.summary;
                payload.content = editingMemory.content || editingMemory.summary;
                payload.event = editingMemory.summary;
            }
            const res = await fetch(`${apiUrl}/memories/bulk`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ ids: editingMemory.ids, patch: payload })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || tx('Save failed', '保存失败'));
            setNotice(tx(`Saved edits to ${formatNumber(data.updated || editingMemory.ids.length)} memories.`, `已保存 ${formatNumber(data.updated || editingMemory.ids.length)} 条记忆修改。`));
            setEditingMemory(null);
            await loadData();
        } catch (e) {
            alert(tx(`Failed to save memory: ${e.message}`, `保存记忆失败：${e.message}`));
        } finally {
            setEditSaving(false);
        }
    };

    const openSourceViewer = async ({ item, ids }) => {
        const safeIds = Array.from(new Set((Array.isArray(ids) ? ids : [ids])
            .map(id => Number(id || 0))
            .filter(id => id > 0)));
        if (!safeIds.length) {
            setSourceViewer({ item, loading: false, data: null, error: tx('This memory has no carrier-card id, so source tracing cannot continue.', '这条记忆没有承载卡片 id，无法继续反查原文。') });
            return;
        }
        setSourceViewer({ item, loading: true, data: null, error: '' });
        try {
            const query = new URLSearchParams({ ids: safeIds.join(',') });
            const res = await fetch(`${apiUrl}/memory-source?${query.toString()}`, { headers });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || tx('Failed to read source text', '读取来源原文失败'));
            setSourceViewer({ item, loading: false, data, error: '' });
        } catch (e) {
            setSourceViewer({ item, loading: false, data: null, error: e.message || tx('Failed to read source text', '读取来源原文失败') });
        }
    };

    const deleteMemoryItems = async ({ type, item, ids }) => {
        const safeIds = Array.from(new Set((Array.isArray(ids) ? ids : [item?.id])
            .map(id => Number(id || 0))
            .filter(id => id > 0)));
        if (!safeIds.length) return;
        const label = type === 'new'
            ? tx(`${safeIds.length} carrier cards for this new memory`, `这条新版记忆的 ${safeIds.length} 条承载卡片`)
            : `#${item?.id || safeIds[0]}`;
        const isManualForget = item?.forgetting_stage === 'expired';
        const actionText = isManualForget ? tx('permanently forget', '彻底遗忘') : tx('delete', '删除');
        const confirmText = isManualForget
            ? tx(`Permanently forget ${label}? It has passed the forgetting grace period and will be removed from the memory library and RAG index.`, `确定彻底遗忘 ${label} 吗？它已经过遗忘缓冲期，操作后会从记忆库和 RAG 索引里移除。`)
            : tx(`Delete ${label}? It will be removed from the memory library and RAG index.`, `确定删除 ${label} 吗？删除后会从记忆库和 RAG 索引里移除。`);
        if (!window.confirm(confirmText)) return;
        setDeletingIds(prev => Array.from(new Set([...prev, ...safeIds])));
        setNotice(tx(`${actionText} ${formatNumber(safeIds.length)} carrier cards and matching RAG index entries...`, `正在${actionText} ${formatNumber(safeIds.length)} 条承载卡片和对应 RAG 索引...`));
        try {
            const res = await fetch(`${apiUrl}/memories/bulk`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify({ ids: safeIds })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || tx('Delete failed', '删除失败'));
            const indexWarning = data.index_deleted === false
                ? tx('; vector index service is unavailable, so leftover index entries will be cleaned on the next index repair/rebuild', '；但当前向量索引服务不可用，索引残留会在下次索引修复/重建时清理')
                : tx(', and matching RAG index entries were removed', '，并移除对应 RAG 索引');
            setNotice(tx(`${actionText} completed for ${formatNumber(data.deleted || 0)} / ${formatNumber(safeIds.length)} carrier cards${indexWarning}. Refreshing list.`, `已${actionText} ${formatNumber(data.deleted || 0)} / ${formatNumber(safeIds.length)} 条承载卡片${indexWarning}。列表正在刷新。`));
            await loadData();
        } catch (e) {
            alert(tx(`Failed to ${actionText} memory: ${e.message}`, `${actionText}记忆失败：${e.message}`));
        } finally {
            setDeletingIds(prev => prev.filter(id => !safeIds.includes(Number(id))));
        }
    };

    const jumpToCharacter = useCallback((characterId = '') => {
        const nextId = String(characterId || '');
        const character = overview?.by_character?.find(item => String(item.character_id) === nextId);
        setActiveCharacterId(nextId);
        if (nextId) setSelectedCharacterId(nextId);
        setSelectedMemoryKey('');
        setManualBatchIndex(1);
        setBatchPreview(null);
        setPromptPreview('');
        setRunResult(null);
        setNotice(nextId ? tx(`Switched to memory stats for ${character?.name || nextId}.`, `已切到 ${character?.name || nextId} 的记忆库统计。`) : tx('Switched back to all-role memory library.', '已切回全部角色记忆库。'));
    }, [overview]);

    const totals = overview?.totals || {};
    const characterStats = overview?.by_character || [];
    const migrationCharacters = overview?.migration_characters || overview?.legacy_by_character || characterStats;
    const hasMigrationTargets = migrationCharacters.some(item => Number(item.total || 0) > 0);
    const hasSupplementTargets = characterStats.some(item => Number(item.formal_total || item.total || 0) > 0);
    const autoTaskUnavailable = promptTaskMode === 'complete' ? !hasMigrationTargets : !hasSupplementTargets;
    const activeCharacter = characterStats.find(item => String(item.character_id) === String(activeCharacterId));
    const categories = library?.categories || [];
    const newLibrary = library?.new_library || { total: 0, source_total: 0, categories: [] };
    const newCategories = newLibrary.categories || [];
    const newSourceGroups = newLibrary.source_groups || [];
    const forgettingGroups = library?.forgetting_groups || [];
    const fastForgetting = forgettingGroups.find(group => group.key === 'fast')?.count || 0;
    const onCurveForgetting = forgettingGroups.find(group => group.key === 'on_curve')?.count || 0;
    const canContinueAutoRun = runResult?.mode === 'auto'
        && runResult.task_mode !== 'external_import'
        && (runResult.can_continue === true
            || (!runResult.success && ['error', 'no_progress'].includes(runResult.stopped_reason) && Number(runResult.stats?.pending || 0) > 0));
    const runErrorDetail = runResult ? getAutoRunErrorDetail(runResult) : null;
    const autoRunActive = autoLoading || autoProgress?.running === true;
    const latestProgressEvents = autoProgressLog.slice(-8).reverse();
    const latestProgressSamples = Array.isArray(autoProgress?.new_memory_samples) ? autoProgress.new_memory_samples : [];
    const externalPreviewRoles = externalImportPreview?.role_tags || [];
    const externalPreviewCandidates = externalImportPreview?.candidates || [];
    const externalImportDraftReady = !!externalImportFile || !!externalImportText.trim();
    const canRetryExternalImport = runResult?.mode === 'auto'
        && runResult.task_mode === 'external_import'
        && runResult.success === false
        && ['error', 'no_progress'].includes(String(runResult.stopped_reason || ''))
        && (Number(runResult.continue_from?.pending || 0) > 0 || externalImportDraftReady || Number(runResult.processed || 0) > 0);
    const canRunExternalImportDirect = promptTaskMode === 'complete' && externalImportDraftReady;
    const canQueueExternalImport = promptTaskMode === 'complete'
        && !!externalImportPreview?.import?.id
        && (selectedExternalRoles.length > 0 || externalPreviewRoles.some(tag => tag?.name));
    const canPrepareExternalImport = canRunExternalImportDirect || (autoTaskUnavailable && canQueueExternalImport);
    const externalPrepareLabel = canRunExternalImportDirect
        ? (externalImportLoading ? tx('Importing', '导入中') : tx('One-click Import Summary', '一键导入总结'))
        : (externalImportCommitting ? tx('Writing', '写入中') : tx('Write Preview Results', '写入预览结果'));
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
    const scopedLegacyTotal = Number(activeCharacter?.legacy_total ?? totals.legacy_total ?? totals.total ?? 0);
    const scopedMigratedCards = Number(activeCharacter?.migrated_card_total ?? activeCharacter?.migrated_total ?? totals.migrated_card_total ?? totals.total ?? 0);
    const pendingMigrationCards = Math.max(0, scopedLegacyTotal - scopedMigratedCards);
    const viewStats = activeCharacter ? {
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
        on_curve_forgetting: onCurveForgetting
    } : {
        ...totals,
        forgetting_total: fastForgetting + onCurveForgetting,
        fast_forgetting: fastForgetting,
        on_curve_forgetting: onCurveForgetting
    };
    const memoryStatusNote = getMemoryStatusNote(memoryStatus);
    const memoryThreads = buildMemoryThreads({
        newCategories,
        newSourceGroups,
        categories,
        forgettingGroups,
        lens: memoryLens,
        search: memorySearch,
        tx
    });
    const allThreadItems = getAllThreadItems(memoryThreads);
    const selectedThreadEntry = allThreadItems.find(({ item }) => getMemoryItemKey(item) === selectedMemoryKey) || allThreadItems[0] || null;
    const selectedMemory = selectedThreadEntry?.item || null;
    const selectedThread = selectedThreadEntry?.thread || null;
    const forgettingTotal = fastForgetting + onCurveForgetting;
    const pendingMaintenanceCount = Number(viewStats.pending ?? totals.pending ?? pendingMigrationCards ?? 0);
    const temporalMaintenanceCount = buildLensCount(allThreadItems.map(({ item }) => item), 'temporal');
    const reviewCount = (Array.isArray(runResult?.normalized?.errors) ? runResult.normalized.errors.length : 0)
        + (Array.isArray(runResult?.apply?.errors) ? runResult.apply.errors.length : 0)
        + (Array.isArray(runResult?.errors) ? runResult.errors.length : 0)
        + Number(runResult?.applied_errors || 0);
    const selectedMaintenanceCharacterName = migrationCharacters.find(item => String(item.character_id) === String(selectedCharacterId))?.name
        || activeCharacter?.name
        || '';

    return (
        <div
            id="memory-library-core-loop-redesign"
            ref={pageRef}
            className={`memory-library-page memory-core-loop-page${mapSidebarsRaised ? ' memory-map-sidebars-raised' : ''}`}
        >
            {notice && <div className="memory-lib-notice">{notice}</div>}

            {editingMemory && (
                <div className="memory-edit-overlay">
                    <div className="memory-edit-modal">
                        <div className="memory-edit-head">
                            <div>
                                <strong>{editingMemory.title}</strong>
                                <span>{formatNumber(editingMemory.ids.length)} {tx('carrier records', '条承载记录')}</span>
                            </div>
                            <button type="button" className="memory-edit-close" onClick={() => setEditingMemory(null)}>
                                <X size={16} />
                            </button>
                        </div>
                        <label>
                                <span>{editingMemory.type === 'new' ? tx('New Memory Content', '新版记忆内容') : tx('Title / Summary', '标题/摘要')}</span>
                            <textarea
                                value={editingMemory.summary}
                                onChange={e => setEditingMemory(prev => ({ ...prev, summary: e.target.value }))}
                            />
                        </label>
                        {editingMemory.type !== 'new' && (
                            <label>
                                <span>{tx('Details', '详细内容')}</span>
                                <textarea
                                    value={editingMemory.content}
                                    onChange={e => setEditingMemory(prev => ({ ...prev, content: e.target.value }))}
                                />
                            </label>
                        )}
                        <div className="memory-edit-grid">
                            <label>
                                <span>{tx('Semantic Category', '语义分类')}</span>
                                <select value={editingMemory.memory_focus} onChange={e => setEditingMemory(prev => ({ ...prev, memory_focus: e.target.value }))}>
                                    {MEMORY_FOCUS_OPTIONS.map(([value, label]) => <option value={value} key={value}>{optionLabel(value, label)}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{tx('Tier', '层级')}</span>
                                <select value={editingMemory.memory_tier} onChange={e => setEditingMemory(prev => ({ ...prev, memory_tier: e.target.value }))}>
                                    {MEMORY_TIER_OPTIONS.map(([value, label]) => <option value={value} key={value}>{optionLabel(value, label)}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{tx('Source Scene', '来源场景')}</span>
                                <select value={editingMemory.source_context} onChange={e => setEditingMemory(prev => ({ ...prev, source_context: e.target.value }))}>
                                    {SOURCE_CONTEXT_OPTIONS.map(([value, label]) => <option value={value} key={value}>{optionLabel(value, label)}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{tx('Scene Detail', '场景细分')}</span>
                                <select value={editingMemory.scene_tag} onChange={e => setEditingMemory(prev => ({ ...prev, scene_tag: e.target.value }))}>
                                    {SCENE_TAG_OPTIONS.map(([value, label]) => <option value={value} key={value}>{optionLabel(value, label)}</option>)}
                                </select>
                            </label>
                            <label>
                                <span>{tx('Importance', '重要性')} {editingMemory.importance}</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={editingMemory.importance}
                                    onChange={e => setEditingMemory(prev => ({ ...prev, importance: Number(e.target.value) }))}
                                />
                            </label>
                        </div>
                        <div className="memory-edit-actions">
                            <button type="button" className="memory-lib-button ghost" onClick={() => setEditingMemory(null)}>{tx('Cancel', '取消')}</button>
                            <button type="button" className="memory-lib-button" onClick={saveMemoryEditor} disabled={editSaving}>
                                <Save size={15} /> {editSaving ? tx('Saving', '保存中') : tx('Save Changes', '保存修改')}
                            </button>
                        </div>
                    </div>
                </div>
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
                    window.setTimeout(() => document.querySelector('.memory-external-import')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
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
                            onShowExternalImport={() => document.querySelector('.memory-external-import')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        />
            <div className="memory-command-workspace memory-maintenance-workspace memory-maintenance-main-only">
                <main className="memory-command-main">
            <div className="memory-lib-section">
                <div className="memory-lib-section-title"><SlidersHorizontal size={16} /> {tx('Memory Library Management Model', '记忆库管理小模型')}</div>
                <div className="memory-lib-model-grid">
                    <label>
                        <span>URL</span>
                        <input value={settings.api_endpoint} onChange={e => setSettings(prev => ({ ...prev, api_endpoint: e.target.value }))} placeholder="https://api.openai.com/v1" />
                    </label>
                    <label>
                        <span>{tx('Key', '密钥')}</span>
                        <input type="password" value={settings.api_key} onChange={e => setSettings(prev => ({ ...prev, api_key: e.target.value }))} placeholder="sk-..." />
                    </label>
                    <label>
                        <span>{tx('Model', '模型')}</span>
                        <input value={settings.model_name} onChange={e => setSettings(prev => ({ ...prev, model_name: e.target.value }))} placeholder={tx('model name', '模型名称')} />
                    </label>
                    <div className="memory-lib-model-actions">
                        <button className="memory-lib-button ghost" onClick={applyLocalModelPreset}>
                            <Laptop size={15} /> {tx('Use Local Model', '使用本地模型')}
                        </button>
                        <button className="memory-lib-button ghost" onClick={fetchModels} disabled={modelFetching}>
                            <Search size={15} /> {modelFetching ? tx('Fetching', '拉取中') : tx('Fetch Models', '拉取模型')}
                        </button>
                        <button className="memory-lib-button" onClick={saveSettings} disabled={saving}>
                            <Save size={15} /> {saving ? tx('Saving', '保存中') : tx('Save Config', '保存配置')}
                        </button>
                    </div>
                </div>
                {modelError && <div className="memory-lib-error">{modelError}</div>}
                {modelOptions.length > 0 && (
                    <select className="memory-lib-model-select" value="" onChange={e => handleModelSelect(e.target.value)}>
                        <option value="" disabled>{tx('Choose a model', '选择模型')}</option>
                        {modelOptions.map(model => <option key={model} value={model}>{getModelOptionLabel(model)}</option>)}
                    </select>
                )}
                <div className="memory-external-import">
                    <div className="memory-lib-prompt-head">
                        <strong><Upload size={15} /> {tx('Import Memories', '导入记忆')}</strong>
                        <span>{externalImportPreview ? tx(`${formatNumber(externalPreviewCandidates.length)} candidates`, `候选 ${formatNumber(externalPreviewCandidates.length)} 条`) : 'GPT / Gemini / SillyTavern'}</span>
                    </div>
                    <div className="memory-lib-model-grid external">
                        <label>
                            <span>{tx('Source', '来源')}</span>
                            <select value={externalSourceApp} onChange={e => handleExternalSourceChange(e.target.value)}>
                                {EXTERNAL_IMPORT_SOURCE_OPTIONS.map(([value, label]) => <option value={value} key={value}>{optionLabel(value, label)}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>{tx('Import Type', '导入类型')}</span>
                            <select value={externalImportMode} onChange={e => setExternalImportMode(e.target.value)}>
                                <option value="one_to_one">{tx('One-to-one', '一对一')}</option>
                                <option value="multi_role">{tx('Multi-person / multi-role', '多人/多角色')}</option>
                            </select>
                        </label>
                        {externalImportMode !== 'multi_role' ? (
                            <label>
                                <span>{tx('Bound Role Name', '绑定角色名')}</span>
                                <input
                                    value={externalTargetName}
                                    onChange={e => setExternalTargetName(e.target.value)}
                                    placeholder={tx('e.g. Claude / Gemini', '例如 Claude / Gemini')}
                                />
                            </label>
                        ) : (
                            <div className="memory-external-import-hint">
                                {tx('SillyTavern multi-role imports identify explicit names from the text; no role name is needed here.', 'SillyTavern 多人导入会从正文里识别明确姓名；不需要再填角色名。')}
                            </div>
                        )}
                    </div>
                    <textarea
                        className="memory-external-textarea"
                        value={externalImportText}
                        onChange={e => setExternalImportText(e.target.value)}
                        placeholder={tx('Paste exported chat logs here. You can also leave this empty when uploading a file.', '可以直接粘贴导出的聊天记录；上传文件时这里也可以留空。')}
                    />
                    <div className="memory-lib-batch-tools external">
                        <input
                            ref={externalImportFileRef}
                            type="file"
                            accept=".json,.jsonl,.ndjson,.txt,.md,.markdown,application/json,text/plain"
                            onChange={async e => {
                                const file = e.target.files?.[0] || null;
                                setExternalImportFile(file);
                                setExternalImportPreview(null);
                                setSelectedExternalRoles([]);
                                if (file) {
                                    const sample = await file.slice(0, 300000).text().catch(() => '');
                                    const detected = detectExternalImportSource(file.name, sample);
                                    applyDetectedExternalImportSource(detected);
                                }
                            }}
                            hidden
                        />
                        <button type="button" className="memory-lib-button ghost" onClick={() => externalImportFileRef.current?.click()}>
                            <FileText size={15} /> {externalImportFile ? externalImportFile.name : tx('Choose File', '选择文件')}
                        </button>
                        <button type="button" className="memory-lib-button" onClick={previewExternalImport} disabled={externalImportLoading || externalImportCommitting}>
                            <Search size={15} /> {externalImportLoading ? tx('Summarizing', '总结中') : tx('Summary Preview', '总结预览')}
                        </button>
                        {externalImportPreview && (
                            <button type="button" className="memory-lib-button" onClick={commitExternalImport} disabled={externalImportCommitting || selectedExternalRoles.length === 0}>
                                <UserPlus size={15} /> {externalImportCommitting ? tx('Importing', '导入中') : tx('Create Roles & Write', '创建角色并写入')}
                            </button>
                        )}
                    </div>
                    {externalImportPreview && (
                        <div className="memory-external-preview">
                            <div className="memory-external-role-head">
                                <strong>{tx('Role Tags', '角色标签')}</strong>
                                <span>{tx('Checked names will create same-name roles automatically; existing roles with the same names are reused. After submit, memories write directly to the new library instead of the legacy summarization queue.', '勾选后会自动创建同名角色；已有同名角色会复用。提交后直接写入新版记忆库，不再进入旧库自动总结队列。')}</span>
                            </div>
                            <div className="memory-external-role-tags">
                                {externalPreviewRoles.map(tag => (
                                    <button
                                        type="button"
                                        key={tag.name}
                                        className={selectedExternalRoleSet.has(tag.name) ? 'active' : ''}
                                        onClick={() => toggleExternalRole(tag.name)}
                                    >
                                        {selectedExternalRoleSet.has(tag.name) && <CheckCircle2 size={13} />}
                                        {tag.name}
                                        <small>{Math.round(Number(tag.confidence || 0) * 100)}%</small>
                                    </button>
                                ))}
                            </div>
                            <div className="memory-external-candidates">
                                {externalPreviewCandidates.slice(0, 12).map(item => (
                                    <div key={item.id}>
                                        <b>{item.character_names?.join(' / ') || tx('Unbound', '未绑定')}</b>
                                        <span>{item.summary}</span>
                                        <small>{optionLabel(item.memory_focus, item.memory_focus)} · {optionLabel(item.memory_tier, item.memory_tier)} · {tx('Importance', '重要性')} {item.importance}</small>
                                    </div>
                                ))}
                            </div>
                            {externalPreviewCandidates.length > 12 && <div className="memory-lib-more">{tx(`${formatNumber(externalPreviewCandidates.length - 12)} more candidates will be imported together.`, `还有 ${formatNumber(externalPreviewCandidates.length - 12)} 条候选会一起导入。`)}</div>}
                        </div>
                    )}
                </div>
                <div className="memory-lib-batch-row">
                    <div>
                        <strong>{tx(`Read ${settings.batch_size} ${promptTaskMode === 'complete' ? 'old memory cards' : 'formal new memories'} each round`, `每轮读取 ${settings.batch_size} 条${promptTaskMode === 'complete' ? '旧记忆卡片' : '正式新版记忆'}`)}</strong>
                        <p>{promptTaskMode === 'complete'
                            ? tx('The small model only reads card summaries; it does not read raw dialogue/logs or embedding index text.', '小模型只吃卡片概况，输出的新记忆统一中文，不吃原始对话/日志或 embedding 索引文本。')
                            : tx('Supplement mode only scans formal new memories, not carrier cards; it adds source-scene and time tags without rewriting content.', '补充模式只扫正式新版记忆，不扫承载卡片；只补来源场景和时间标签，不改写记忆。')}</p>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={settings.batch_size}
                        onChange={e => setSettings(prev => ({ ...prev, batch_size: Number(e.target.value) }))}
                    />
                </div>
                <div className="memory-lib-batch-row">
                    <div>
                        <strong>{tx(`Small model output cap ${settings.max_output_tokens || 8000} tokens`, `小模型输出上限 ${settings.max_output_tokens || 8000} tokens`)}</strong>
                        <p>{tx('If failure logs show finish_reason=length, raise this value. Reasoning models consume more output budget.', '失败日志如果出现 finish_reason=length，就把这里调大；推理模型会消耗更多输出预算。')}</p>
                    </div>
                    <input
                        type="range"
                        min="1000"
                        max="20000"
                        step="500"
                        value={settings.max_output_tokens || 8000}
                        onChange={e => setSettings(prev => ({ ...prev, max_output_tokens: Number(e.target.value) }))}
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
                    <select value={selectedCharacterId} onChange={e => setSelectedCharacterId(e.target.value)}>
                        {migrationCharacters.length === 0 && (
                            <option value="">{tx('No processable legacy memories', '没有可处理的旧库记忆')}</option>
                        )}
                        {migrationCharacters.map(item => (
                            <option value={item.character_id} key={item.character_id}>
                                {item.name} ({tx('legacy', '旧库')} {formatNumber(item.total)} / {tx('new', '新版')} {formatNumber(item.formal_total ?? item.new_total ?? item.migrated_total ?? 0)})
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
                        ? tx('Complete: migrate legacy / external app memories into the new library while writing source-scene and time tags.', '完整：把旧库/外部 App 记忆迁移进新版库，同时写来源场景和时间标签。')
                        : tx('Supplement: only add source-scene and time tags to existing new memories without rewriting content.', '补充：只给现有新版记忆补来源场景和时间标签，不改写记忆内容。')}
                </div>
                {maintenanceMode === 'manual' ? (
                    <div className="memory-lib-mode-panel">
                        <label className="memory-lib-inline-field">
                            <span>{tx('Batch Number', '选择第几批')}</span>
                            <input
                                type="number"
                                min="1"
                                value={manualBatchIndex}
                                onChange={e => setManualBatchIndex(Math.max(1, Number(e.target.value || 1)))}
                            />
                        </label>
                        <div className="memory-lib-mode-copy">
                            {tx(`Batch ${manualBatchIndex} will skip the first ${formatNumber((Math.max(1, Number(manualBatchIndex || 1)) - 1) * Number(settings.batch_size || 30))} items; complete mode processes pending old cards, supplement mode processes existing new memories.`, `第 ${manualBatchIndex} 批会跳过前 ${formatNumber((Math.max(1, Number(manualBatchIndex || 1)) - 1) * Number(settings.batch_size || 30))} 条；完整处理 pending 旧卡片，补充处理已有新版记忆。`)}
                        </div>
                        <div className="memory-lib-batch-tools">
                            <button className="memory-lib-button ghost" onClick={previewSelectedPrompt} disabled={batchLoading || temporalPromptLoading || !selectedCharacterId || autoTaskUnavailable}>
                                <Database size={15} /> {(batchLoading || temporalPromptLoading) ? tx('Generating', '生成中') : (autoTaskUnavailable ? tx('Nothing to Preview', '无可预览') : tx('Preview Prompt', '预览 Prompt'))}
                            </button>
                            <button
                                className="memory-lib-button"
                                onClick={() => (canPrepareExternalImport ? runExternalPrepareStep() : runSelectedPromptTask())}
                                disabled={runLoading || autoRunActive || externalImportLoading || externalImportCommitting || (!canPrepareExternalImport && (!selectedCharacterId || autoTaskUnavailable))}
                            >
                                <Play size={15} /> {runLoading
                                    ? tx('Working', '工作中')
                                    : (autoTaskUnavailable
                                        ? (canPrepareExternalImport ? externalPrepareLabel : tx('Nothing to Process', '无可处理'))
                                        : tx('Start Work', '开始工作'))}
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
                                onChange={e => {
                                    const raw = e.target.value;
                                    setAutoMaxBatches(raw === '' ? '' : String(Math.max(1, Number(raw || 1) || 1)));
                                }}
                            />
                        </label>
                        <div className="memory-lib-mode-copy">
                            {promptTaskMode === 'complete'
                                ? (canRunExternalImportDirect
                                    ? tx(`External import will call the small model in batches of ${formatNumber(settings.batch_size || 10)} source messages, tag roles for each new memory, and write into the new library; it will not enter the second-scan queue.`, `外部导入会直接按每批 ${formatNumber(settings.batch_size || 10)} 条正文循环调用小模型，给每条新记忆打角色标签并写入新版库；不会再入队二次扫描。`)
                                    : tx('Automatic complete mode processes continuously from the first pending batch. After each batch, the next batch rereads remaining pending items; blank means no batch limit. Failed batches retry up to 3 times; successful batches call once.', '自动完整会从 pending 第一批开始连续处理，每批结束后下一批会重新读取剩余 pending；留空则不限制批数。单批失败最多重试 3 次，正常成功只调用 1 次。'))
                                : tx('Automatic supplement mode continuously scans existing new memories and adds source-scene and time tags. Blank means scan the whole new library. Failed batches retry up to 3 times; successful batches call once.', '自动补充会连续扫描已有新版记忆，补来源场景和时间标签；留空则扫完整个新版库。单批失败最多重试 3 次，正常成功只调用 1 次。')}
                            {autoTaskUnavailable && !canRunExternalImportDirect && (
                                <span>{tx(` This account has no processable ${promptTaskMode === 'complete' ? 'legacy pending / external import material' : 'new memories'}; ${canQueueExternalImport ? 'you can submit the current external import preview to the summary queue first.' : 'you can choose an external export file and run one-click import summary.'}`, ` 当前账号没有可处理的${promptTaskMode === 'complete' ? '旧库 pending / 外部导入原料' : '新版记忆'}；${canQueueExternalImport ? '可以先把当前外部导入预览提交到总结队列。' : '可以选择外部导出文件后直接一键导入总结。'}`)}</span>
                            )}
                        </div>
                        <div className="memory-lib-batch-tools">
                            <button
                                className="memory-lib-button"
                                onClick={() => (canPrepareExternalImport ? runExternalPrepareStep() : runAutoSelectedTask())}
                                disabled={autoRunActive || runLoading || externalImportLoading || externalImportCommitting || (!canPrepareExternalImport && (!selectedCharacterId || autoTaskUnavailable))}
                            >
                                <Play size={15} /> {autoRunActive
                                    ? tx('Automatic Work Running', '自动工作中')
                                    : (autoTaskUnavailable
                                        ? (canPrepareExternalImport ? externalPrepareLabel : tx('No Automatic Work', '无可自动工作'))
                                        : tx('Start Automatic Work', '开始自动工作'))}
                            </button>
                        </div>
                    </div>
                )}
                {autoProgress && (
                    <div className={`memory-lib-live-progress ${autoProgress.running ? 'running' : ''}`}>
                        <div className="memory-lib-live-head">
                            <div>
                                <strong>{autoProgress.task_mode === 'external_import'
                                    ? (autoProgress.running ? tx('External Import Running', '外部导入运行中') : tx('External Import Status', '外部导入状态'))
                                    : (autoProgress.task_mode === 'supplement' ? (autoProgress.running ? tx('Automatic Supplement Running', '自动补充运行中') : tx('Automatic Supplement Status', '自动补充状态')) : (autoProgress.running ? tx('Automatic Summary Running', '自动总结运行中') : tx('Automatic Summary Status', '自动总结状态')))}</strong>
                                <p>{autoProgress.message || formatProgressPhase(autoProgress.phase)}</p>
                            </div>
                            <span>{formatProgressPhase(autoProgress.phase)}</span>
                        </div>
                        {autoProgress.max_batches && autoProgress.batch_number && (
                            <div className="memory-lib-live-bar">
                                <i style={{ width: `${Math.min(100, Math.round((Number(autoProgress.batch_number || 0) / Math.max(1, Number(autoProgress.max_batches || 1))) * 100))}%` }} />
                            </div>
                        )}
                        <div className="memory-lib-live-grid">
                            <span>{tx('Batch:', '批次：')}{autoProgress.batch_number ? tx(`Batch ${autoProgress.batch_number}`, `第 ${autoProgress.batch_number} 批`) : tx('Waiting', '等待中')}</span>
                            <span>{tx('Attempt:', '尝试：')}{autoProgress.attempt ? `${autoProgress.attempt}/${Number(autoProgress.max_rerolls ?? 3) + 1}` : tx('Not started', '未开始')}</span>
                            <span>{tx('Processed:', '已处理：')}{formatNumber(autoProgress.processed)}</span>
                            <span>{tx('Written:', '已写回：')}{formatNumber(autoProgress.updated)}</span>
                            <span>{tx('Pending:', '待分类：')}{formatNumber(autoProgress.remaining_pending_after_batch ?? autoProgress.pending_before ?? autoProgress.stats?.pending)}</span>
                            <span>{tx('Write Errors:', '写库错误：')}{formatNumber(autoProgress.applied_errors)}</span>
                        </div>
                        {latestProgressSamples.length > 0 && (
                            <div className="memory-lib-live-samples">
                                <strong>{tx('New Summary Preview for This Batch', '本批新总结预览')}</strong>
                                {latestProgressSamples.map((sample, idx) => <p key={`${idx}-${sample}`}>{sample}</p>)}
                            </div>
                        )}
                        {latestProgressEvents.length > 0 && (
                            <div className="memory-lib-live-log">
                                {latestProgressEvents.map((event, idx) => (
                                    <span key={`${event.run_id}-${event.timestamp}-${idx}`}>
                                        {formatProgressPhase(event.phase)}
                                        {event.batch_number ? tx(` · batch ${event.batch_number}`, ` · 第 ${event.batch_number} 批`) : ''}
                                        {event.reroll ? tx(` · reroll ${event.reroll}`, ` · 重 roll ${event.reroll}`) : ''}
                                        {event.updated !== undefined ? tx(` · wrote ${formatNumber(event.updated)}`, ` · 写回 ${formatNumber(event.updated)}`) : ''}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {batchPreview && (
                    <div className="memory-lib-batch-preview">
                        {tx(`Prepared batch ${batchPreview.batch_index || manualBatchIndex} / ${formatNumber(batchPreview.total_batches)}, ${batchPreview.items?.length || 0} items, next cursor #${batchPreview.next_after_id || 0}, remaining pending ${formatNumber(batchPreview.remaining_pending)}.`, `已准备第 ${batchPreview.batch_index || manualBatchIndex} 批 / 共 ${formatNumber(batchPreview.total_batches)} 批，${batchPreview.items?.length || 0} 条，下一游标 #${batchPreview.next_after_id || 0}，待分类剩余 ${formatNumber(batchPreview.remaining_pending)}。`)}
                        <div>{(batchPreview.items || []).slice(0, 12).map(item => `#${item.id}`).join('  ')}</div>
                    </div>
                )}
                {runResult && (
                    <div className="memory-lib-run-result">
                        <div className="memory-lib-prompt-head">
                            <strong>{runResult.mode === 'supplement' ? tx('Small Model Supplement Result', '小模型补充结果') : tx('Small Model Summary Result', '小模型归纳结果')}</strong>
                            <span>
                                {runResult.mode === 'supplement'
                                    ? tx(`Source ${formatNumber(runResult.normalized?.source_label_count)} / time ${formatNumber(runResult.normalized?.time_label_count)} / wrote ${formatNumber(runResult.apply?.updated)} items`, `来源 ${formatNumber(runResult.normalized?.source_label_count)} / 时间 ${formatNumber(runResult.normalized?.time_label_count)} / 写回 ${formatNumber(runResult.apply?.updated)} 条`)
                                    : runResult.mode === 'auto'
                                    ? tx(`Automatic ${formatNumber((runResult.runs || []).filter(item => !item.empty).length)} batches / applied ${formatNumber(runResult.updated)} items`, `自动 ${formatNumber((runResult.runs || []).filter(item => !item.empty).length)} 批 / 应用 ${formatNumber(runResult.updated)} 条`)
                                    : tx(`New memory suggestions ${formatNumber(runResult.normalized?.new_memory_count)} / applied ${formatNumber(runResult.apply?.updated)} items`, `新记忆建议 ${formatNumber(runResult.normalized?.new_memory_count)} / 应用 ${formatNumber(runResult.apply?.updated)} 条`)}
                            </span>
                        </div>
                        <div className="memory-lib-result-grid">
                            <span>
                                {runResult.mode === 'supplement'
                                    ? tx(`Batch: ${(runResult.batch?.ids || []).slice(0, 14).map(id => `#${id}`).join(' ')}`, `批次：${(runResult.batch?.ids || []).slice(0, 14).map(id => `#${id}`).join(' ')}`)
                                    : runResult.mode === 'auto'
                                    ? tx(`Processed: ${formatNumber(runResult.processed)} items / ${runResult.run_until_empty ? 'no batch limit' : `limit ${formatNumber(runResult.max_batches)} batches`}`, `处理：${formatNumber(runResult.processed)} 条 / ${runResult.run_until_empty ? '不限制批数' : `上限 ${formatNumber(runResult.max_batches)} 批`}`)
                                    : tx(`Batch: ${(runResult.batch?.ids || []).slice(0, 14).map(id => `#${id}`).join(' ')}`, `批次：${(runResult.batch?.ids || []).slice(0, 14).map(id => `#${id}`).join(' ')}`)}
                            </span>
                            <span>{tx('Errors:', '错误：')}{formatNumber(runResult.mode === 'auto' ? ((runResult.errors || []).length + Number(runResult.applied_errors || 0)) : ((runResult.normalized?.errors || []).length + (runResult.apply?.errors || []).length))}</span>
                            {runResult.mode === 'auto' && <span>{tx('Stop:', '停止：')}{formatStoppedReason(runResult.stopped_reason)}</span>}
                            <span>{tx('Model:', '模型：')}{runResult.model?.name || settings.model_name}{runResult.model?.finishReason ? ` / ${runResult.model.finishReason}` : ''}</span>
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
                                    <strong>{tx('Automatic Task Stopped at Breakpoint', '自动任务已停在断点')}</strong>
                                    <p>{tx(`There are still ${formatNumber(runResult.continue_from?.pending || runResult.stats?.pending || 0)} pending items. Continuing retries from the first remaining pending batch and will not rerun already written batches.`, `当前还有 ${formatNumber(runResult.continue_from?.pending || runResult.stats?.pending || 0)} 条 pending。继续会从剩余 pending 的第一批重新尝试，不会重跑已写回的批次。`)}</p>
                                </div>
                                <button
                                    type="button"
                                    className="memory-lib-button"
                                    onClick={() => (runResult.task_mode === 'supplement' ? runAutoSupplement : runAutoMigration)({
                                        skipConfirm: true,
                                        continuation: true,
                                        characterId: runResult.character?.id || selectedCharacterId
                                    })}
                                    disabled={autoRunActive || runLoading}
                                >
                                    <Play size={15} /> {autoRunActive ? tx('Continuing', '继续中') : tx('Continue from Breakpoint', '从断点继续')}
                                </button>
                            </div>
                        )}
                        {canRetryExternalImport && (
                            <div className="memory-lib-continue">
                                <div>
                                    <strong>{tx('External Import Stopped at Breakpoint', '外部导入停在断点')}</strong>
                                    <p>{tx(`Processed ${formatNumber(runResult.continue_from?.offset ?? runResult.processed ?? 0)} items. Retry will call the small model again from the failed batch and will not rerun memories already written.`, `已处理 ${formatNumber(runResult.continue_from?.offset ?? runResult.processed ?? 0)} 条；继续会从失败批次重新调用小模型，不重跑已经写入的新记忆。`)}</p>
                                </div>
                                <button
                                    type="button"
                                    className="memory-lib-button"
                                    onClick={() => runExternalImportAuto({
                                        continuation: true,
                                        importId: runResult.continue_from?.import_id || runResult.import_id,
                                        continueOffset: runResult.continue_from?.offset ?? runResult.processed ?? 0
                                    })}
                                    disabled={autoRunActive || externalImportLoading}
                                >
                                    <Play size={15} /> {autoRunActive ? tx('Retrying', '重试中') : tx('Retry from Breakpoint', '从断点重试')}
                                </button>
                            </div>
                        )}
                        <textarea readOnly value={formatRunResultDetails(runResult)} />
                    </div>
                )}
                <div className="memory-lib-prompt-window compact">
                    <div className="memory-lib-prompt-head">
                        <strong>{promptTaskMode === 'complete' ? tx('Complete Prompt', '完整 Prompt') : tx('Supplement Prompt', '补充 Prompt')}</strong>
                        <span>
                            {promptTaskMode === 'complete'
                                ? (promptPreview ? tx(`About ${formatNumber(promptPreview.length)} chars`, `约 ${formatNumber(promptPreview.length)} 字符`) : tx('Click "Preview Prompt" first', '先点“预览 Prompt”生成'))
                                : (temporalPromptPreview ? tx(`About ${formatNumber(temporalPromptPreview.length)} chars`, `约 ${formatNumber(temporalPromptPreview.length)} 字符`) : tx('Click "Preview Prompt" first', '先点“预览 Prompt”生成'))}
                        </span>
                    </div>
                    <textarea
                        readOnly
                        value={promptTaskMode === 'complete'
                            ? (promptPreview || tx('Complete Prompt: migrate legacy / external app memories into the new library while generating formal memories, source-scene tags, and time tags. Raw dialogue/logs and embedding index text are not included here.', '完整 Prompt：把旧库/外部 App 记忆迁移进新版库，同时生成中文正式记忆、来源场景标签和时间标签。这里不会放原始对话/日志或 embedding 索引文本。'))
                            : (temporalPromptPreview || tx('Supplement Prompt: only add private chat / group chat / city street / external app source-scene tags and strongly time-bound tags to existing new memories; does not rewrite content or change memory_focus.', '补充 Prompt：只给已有新版记忆补私聊/群聊/商业街/外部 App 来源场景标签，以及时间强绑定标签；不改写记忆内容，不改变 memory_focus。'))}
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
