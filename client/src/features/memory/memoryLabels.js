export const emptySettings = {
    api_endpoint: '',
    api_key: '',
    model_name: '',
    batch_size: 30,
    max_output_tokens: 8000,
};

export const MEMORY_FOCUS_OPTIONS = [
    ['user_profile', '用户画像'],
    ['relationship', '关系记忆'],
    ['user_current_arc', '当前阶段'],
    ['general', '普通事件'],
];

export const MEMORY_TIER_OPTIONS = [
    ['core', '核心'],
    ['active', '活跃'],
    ['ambient', '背景'],
];

export const SOURCE_CONTEXT_OPTIONS = [
    ['private_chat', '私聊'],
    ['group_chat', '群聊'],
    ['commercial_street', '商业街'],
    ['external_app', '外部 App'],
    ['unknown', '来源未明'],
];

export const SCENE_TAG_OPTIONS = [
    ['none', '无'],
    ['private_chat', '私聊'],
    ['group_chat', '群聊'],
    ['commercial_street', '商业街'],
    ['external_gpt', 'GPT'],
    ['external_gemini', 'Gemini'],
    ['external_sillytavern', 'SillyTavern'],
    ['external_app', '外部 App'],
    ['other', '其他'],
];

export const EXTERNAL_IMPORT_SOURCE_OPTIONS = [
    ['gpt', 'GPT / ChatGPT'],
    ['gemini', 'Gemini'],
    ['sillytavern', 'SillyTavern'],
    ['external_app', '其他外部 App'],
];

export const EXTERNAL_IMPORT_SESSION_KEY = 'cp_external_memory_import_preview';

export function currentMemoryLang() {
    return typeof localStorage !== 'undefined' && localStorage.getItem('chatpulse_lang') === 'en' ? 'en' : 'zh';
}

export function mtx(en, zh) {
    return currentMemoryLang() === 'en' ? en : zh;
}

export const OPTION_LABEL_EN = {
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
    sillytavern: 'SillyTavern',
};

export function optionLabel(value, fallback) {
    return currentMemoryLang() === 'en' ? OPTION_LABEL_EN[value] || fallback || value : fallback || value;
}

export function detectExternalImportSource(filename = '', sample = '') {
    const name = String(filename || '').toLowerCase();
    const text = String(sample || '').slice(0, 300000);
    if (/silly\s*tavern|sillytavern|tavern|imported\.jsonl/.test(name)) return 'sillytavern';
    if (/"chat_metadata"|"swipes"|"mes"|"send_date"|LWB_|<本轮用户输入>|<recall>/i.test(text)) return 'sillytavern';
    if (/gemini|bard/.test(name) || /"chunkedPrompt"|"model":"gemini/i.test(text)) return 'gemini';
    if (/chatgpt|openai|conversations\.json/.test(name) || /"mapping"|"conversation_id"|"author"/i.test(text))
        return 'gpt';
    return '';
}

export function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

export function formatDays(value) {
    if (value === null || value === undefined) return mtx('Protected', '受保护');
    const days = Number(value || 0);
    if (days < 1) return `${Math.ceil(days * 24)} ${mtx('h', '小时')}`;
    return `${Math.ceil(days)} ${mtx('d', '天')}`;
}

export function formatDate(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return mtx('Not recorded', '未记录');
    return new Date(timestamp).toLocaleDateString(currentMemoryLang() === 'en' ? 'en-US' : 'zh-CN', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
    });
}

export function formatDateTime(value) {
    const timestamp = Number(value || 0);
    if (!timestamp) return mtx('Not recorded', '未记录');
    return new Date(timestamp).toLocaleString(currentMemoryLang() === 'en' ? 'en-US' : 'zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatStoppedReason(reason) {
    const map = {
        empty: { zh: '待分类已清空', en: 'Pending queue cleared' },
        completed: { zh: '已完成', en: 'Completed' },
        max_batches: { zh: '达到批次数', en: 'Reached batch limit' },
        error: { zh: '小模型错误', en: 'Small model error' },
        auth_error: { zh: '小模型鉴权失败', en: 'Small model auth failed' },
        no_progress: { zh: '无进展停止', en: 'Stopped with no progress' },
        no_candidates: { zh: '没有提取出可写入记忆', en: 'No writable memories extracted' },
        dry_run: { zh: '预演停止', en: 'Dry run stopped' },
        backend_missing: { zh: '后端任务不存在', en: 'Backend task missing' },
    };
    return map[reason]?.[currentMemoryLang()] || reason || mtx('Not recorded', '未记录');
}

export function summarizeAutoRunError(result = {}) {
    return getAutoRunErrorDetail(result).summary;
}

export function clipRunErrorText(value = '', max = 520) {
    const text = String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

export function getAutoRunErrorDetail(result = {}) {
    const lastError = (result.errors || []).slice(-1)[0];
    const attemptError = (lastError?.attempts || []).slice(-1)[0];
    const rawError = attemptError?.error || lastError?.error || result.message || '';
    const rawPreview =
        attemptError?.raw_response_preview || lastError?.raw_response_preview || result.raw_response || '';
    const batchNumber = lastError?.batch_number || attemptError?.batch?.batch_index || result.batch?.batch_index || '';
    if (!rawError && !rawPreview) {
        return { summary: '', raw_preview: '', batch_number: batchNumber };
    }
    const prefix = batchNumber ? mtx(`Batch ${batchNumber}: `, `第 ${batchNumber} 批：`) : '';
    const isJsonError = /JSON|Unexpected token|not valid JSON|did not return a JSON object|JSON 对象|格式不合法/i.test(
        rawError,
    );
    const summary = isJsonError
        ? `${prefix}${mtx('The small model did not return valid JSON, so the backend could not parse it. Details: ', '小模型返回的不是合法 JSON，后端无法解析。具体错误：')}${rawError}`
        : `${prefix}${rawError}`;
    return {
        summary,
        raw_preview: rawPreview,
        batch_number: batchNumber,
    };
}

export function formatProgressPhase(phase) {
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
        stopped: { zh: '已停止', en: 'Stopped' },
    };
    return map[phase]?.[currentMemoryLang()] || phase || mtx('Waiting', '等待中');
}

export function formatRunResultDetails(result) {
    if (!result) return '';
    if (result.mode === 'auto') {
        return JSON.stringify(
            {
                stopped_reason: result.stopped_reason,
                max_rerolls: result.max_rerolls,
                errors: result.errors || [],
                runs: result.runs || [],
                raw_response: result.raw_response || '',
            },
            null,
            2,
        );
    }
    return result.raw_response || JSON.stringify(result.parsed || {}, null, 2);
}

export function formatForgettingLabel(item = {}) {
    if (item.days_until_threshold === null || item.days_until_threshold === undefined)
        return mtx('Protected', '受保护');
    if (item.forgetting_stage === 'expired') return mtx('Grace period ended, ready to forget', '缓冲结束，可彻底遗忘');
    if (item.forgetting_stage === 'grace') {
        const daysLeft = Number(item.days_until_grace_expires || 0);
        const leftText = daysLeft <= 0 ? mtx('less than 1 h', '不足 1 小时') : formatDays(daysLeft);
        return mtx(`In grace period, forgettable after ${leftText}`, `缓冲中，${leftText}后可遗忘`);
    }
    return mtx(
        `Enters grace period after ${formatDays(item.days_until_threshold)}`,
        `${formatDays(item.days_until_threshold)}后进入缓冲`,
    );
}

export function formatSourceKind(kind = '') {
    if (kind === 'private_chat') return mtx('Private Chat', '私聊');
    if (kind === 'group_chat') return mtx('Group Chat', '群聊');
    if (kind === 'commercial_street') return mtx('City Street', '商业街');
    if (kind === 'external_app') return mtx('External App', '外部 App');
    return mtx('Unknown Source', '未知来源');
}
