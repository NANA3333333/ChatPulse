const { hasCjkText } = require("../maintenance/index.js");
// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function buildExternalImportPrompt({ sourceApp, importMode, targetCharacterName, messages, rawText, knownRoleTags = [], userName = '' }) {
    const appLabel = dependencies.getExternalSourceAppLabel(sourceApp);
    const rows = (messages || []).slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_MAX_MESSAGES).map(message => ({
        id: message.id,
        speaker: message.speaker,
        role: message.role,
        time: message.timestamp ? new Date(message.timestamp).toISOString() : '',
        text: message.text
    }));
    const transcriptText = rows.length
        ? JSON.stringify(rows).slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_PROMPT_CHARS)
        : dependencies.cleanExternalMessageText(rawText || '').slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_PROMPT_CHARS);
    const knownRoles = (Array.isArray(knownRoleTags) ? knownRoleTags : [])
        .map(tag => ({
            name: normalizeExternalCharacterName(tag?.name || tag),
            aliases: normalizeExternalRoleAliases(tag).slice(0, 8),
            persona: dependencies.firstImportString(tag?.profile?.persona, tag?.persona).slice(0, 180)
        }))
        .filter(tag => tag.name)
        .slice(0, 80);
    const knownRolesText = knownRoles.length ? JSON.stringify(knownRoles) : '[]';
    const currentUserName = normalizeExternalCharacterName(userName);
    const targetRule = importMode === 'one_to_one'
        ? `这是 GPT/Gemini 一对一导出。目标角色名是 "${targetCharacterName || appLabel}"。所有有效记忆都绑定到这个角色；不要输出其他角色标签，除非原文明确另有同伴长期参与。`
        : `这是 SillyTavern 或多人聊天导出。每条记忆必须返回 character_names: 只包含原文中有明确姓名、且这条记忆确实涉及的非用户角色。没有明确姓名就 needs_review，不要编名字，不要把 User/Nana/用户${currentUserName ? `/${currentUserName}` : ''}放进 character_names。`;
    const systemPrompt = '你是 ChatPulse 外部聊天记录导入小模型。任务是把外部 App 的聊天记录整理成可进入新版 RAG 记忆库的中文剧情记忆，并标出涉及的角色名。只输出合法 JSON 对象，不要 Markdown，不要解释。';
    const userPrompt = `来源 App: ${appLabel}
导入模式: ${importMode}
${targetRule}
已捕获角色标签 JSON:
${knownRolesText}

请从输入里提取长期或阶段性有用的记忆。输入已经预清洗过：思维链、系统提示、前缀/后缀、模板噪声应视为无效来源；只相信聊天正文，不要把提示词或推理文本总结成记忆。

分类枚举:
- memory_focus: user_profile | relationship | user_current_arc | general
- memory_tier: core | active | ambient
- importance: 1-10

输出 JSON:
{
  "role_tags": [
    {"name":"明确角色名","aliases":["可选别名/简称/译名"],"confidence":0.0-1.0,"reason":"一句中文理由"}
  ],
  "character_profiles": [
    {"name":"角色名","persona":"可选，基于原文概括的简短角色设定"}
  ],
  "memories": [
    {
      "summary":"2-4 句中文正式记忆，概括剧情场景、起因、关键行动、结果或状态变化",
      "content":"更完整的剧情概况，保留角色关系、冲突、时间/地点线索和后续影响，但不要贴长段原文",
      "character_names":["明确角色名"],
      "memory_focus":"user_profile | relationship | user_current_arc | general",
      "memory_tier":"core | active | ambient",
      "importance":1-10,
      "consolidation_key":"english_snake_case_key",
      "source_refs":["m1","m2"],
      "source_time_text":"可选，原文有明确时间才写",
      "reason":"一句中文理由"
    }
  ],
  "needs_review": [
    {"source_refs":["m3"],"reason":"为什么不确定"}
  ]
}

约束:
- summary/content 必须是简体中文。
- summary 不是短标题，不能只写“某人做了某事”。每条 summary 通常 80-260 个中文字符，至少说明“在哪里/什么阶段、为什么发生、谁做了什么、造成了什么结果或关系变化”；只有极简单事实才可以更短。
- content 通常 150-600 个中文字符，用来保留剧情脉络：场景、动机、冲突、角色反应、状态变化、未解决线索。不要复制大段原文，不要输出露骨细节，但也不要压缩成一句话。
- 一条记忆只覆盖一个可召回事件、阶段状态或关系变化；不要把整段关系史糊成一条，也不要拆到失去剧情上下文。
- SillyTavern 记录往往是连续剧情日志，必须给出可读的剧情概况；优先总结“这一小段发生了什么、谁参与、对后续有什么意义”，不要只抽取孤立关键词。
- source_refs 必须来自输入消息 id。
- GPT/Gemini 一对一模式默认绑定到目标角色。
- SillyTavern 多人模式只返回明确姓名的角色标签；多人共同经历可以让多个角色共享同一条记忆。
- role_tags.name、character_profiles.name 和 character_names 是机器角色标签，不是中文自然语言字段：必须保留原文里明确出现的姓名写法和大小写，不要翻译、音译或改写角色名。例如原文写 Conrad/Dominic/Baron，就输出 Conrad/Dominic/Baron，不要改成康拉德/多米尼克/巴伦；原文只写中文名时才用中文名。
- 如果“已捕获角色标签 JSON”非空，character_names 必须优先使用其中的 name 原文作为标准名；简称、姓氏、中文译名、英文名、全名变体都要归并到已有标准名，禁止把同一个人重复输出成新角色。
- role_tags 只输出本批新出现、且不属于已捕获角色标签的新角色；已有角色不要重复输出。若只是补充别名，可以在同一个标准 name 下输出 aliases。
- 如果无法判断某个名字是不是已捕获角色的别名，且原文没有明确姓名证据，就放进 needs_review，不要创建新角色。
- 最多输出 ${dependencies.EXTERNAL_MEMORY_IMPORT_MAX_MEMORIES} 条 memories。

输入消息 JSON:
${transcriptText}`;
    return { system_prompt: systemPrompt, user_prompt: userPrompt, row_count: rows.length };
}

function normalizeExternalCharacterName(name = '', fallback = '') {
    const cleaned = dependencies.cleanExternalSpeakerName(name || fallback)
        .replace(/[<>\[\]{}"'`]+/g, '')
        .trim();
    if (!cleaned || dependencies.isLikelyUserSpeaker(cleaned)) return '';
    return cleaned.slice(0, 60);
}

function getExternalNameCompareKey(name = '') {
    return String(name || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/black wood/g, 'blackwood')
        .replace(/van croft/g, 'vancroft')
        .replace(/[·・•．.。_\-—–/\\|()[\]{}'"`“”‘’\s:：,，;；]+/g, '')
        .trim();
}

function isExternalImportUserName(name = '', userName = '') {
    const normalized = normalizeExternalCharacterName(name);
    if (!normalized) return true;
    if (dependencies.isLikelyUserSpeaker(normalized)) return true;
    const userKey = getExternalNameCompareKey(userName);
    return !!userKey && getExternalNameCompareKey(normalized) === userKey;
}

function getExternalNameTokens(name = '') {
    return String(name || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[·・•．.。_\-—–/\\|()[\]{}'"`“”‘’:,，;；]+/g, ' ')
        .split(/\s+/)
        .map(token => token.trim())
        .filter(token => token.length >= 3);
}

function normalizeExternalRoleAliases(tag = {}) {
    const values = [];
    const add = (value) => {
        if (Array.isArray(value)) {
            for (const item of value) add(item);
            return;
        }
        const normalized = normalizeExternalCharacterName(value);
        if (normalized && !values.some(existing => getExternalNameCompareKey(existing) === getExternalNameCompareKey(normalized))) {
            values.push(normalized);
        }
    };
    add(tag?.aliases);
    add(tag?.alias);
    add(tag?.english_name);
    add(tag?.chinese_name);
    add(tag?.profile?.aliases);
    add(tag?.profile?.alias);
    add(tag?.profile?.english_name);
    add(tag?.profile?.chinese_name);
    return values;
}

function getExternalRoleCandidateNames(tag = {}) {
    const names = [];
    const add = (value) => {
        const normalized = normalizeExternalCharacterName(value);
        if (normalized && !names.some(existing => getExternalNameCompareKey(existing) === getExternalNameCompareKey(normalized))) {
            names.push(normalized);
        }
    };
    add(tag?.name || tag);
    for (const alias of normalizeExternalRoleAliases(tag)) add(alias);
    add(tag?.profile?.name);
    return names;
}

function resolveExternalKnownRoleName(name = '', knownRoleTags = []) {
    const normalized = normalizeExternalCharacterName(name);
    if (!normalized) return '';
    const targetKey = getExternalNameCompareKey(normalized);
    if (!targetKey) return '';
    const candidates = (Array.isArray(knownRoleTags) ? knownRoleTags : [])
        .map(tag => {
            const canonical = normalizeExternalCharacterName(tag?.name || tag);
            if (!canonical) return null;
            const names = getExternalRoleCandidateNames(tag);
            return { canonical, names };
        })
        .filter(Boolean);
    for (const candidate of candidates) {
        if (candidate.names.some(item => getExternalNameCompareKey(item) === targetKey)) {
            return candidate.canonical;
        }
    }
    const containmentMatches = candidates.filter(candidate => candidate.names.some(item => {
        const key = getExternalNameCompareKey(item);
        if (!key || key === targetKey) return false;
        const minLength = /[\u4e00-\u9fff]/.test(targetKey + key) ? 2 : 4;
        return targetKey.length >= minLength && key.length >= minLength && (key.includes(targetKey) || targetKey.includes(key));
    }));
    if (containmentMatches.length === 1) {
        return containmentMatches[0].canonical;
    }
    const targetTokens = getExternalNameTokens(normalized);
    if (targetTokens.length > 0) {
        const tokenMatches = candidates.filter(candidate => {
            const candidateTokens = new Set(candidate.names.flatMap(getExternalNameTokens));
            if (candidateTokens.size === 0) return false;
            return targetTokens.some(token => candidateTokens.has(token));
        });
        if (tokenMatches.length === 1) return tokenMatches[0].canonical;
    }
    return normalized;
}

function normalizeExternalImportResult(parsed = {}, context = {}) {
    const sourceApp = context.sourceApp || 'external_app';
    const importMode = context.importMode || 'one_to_one';
    const targetName = normalizeExternalCharacterName(context.targetCharacterName, dependencies.getExternalSourceAppLabel(sourceApp));
    const userName = normalizeExternalCharacterName(context.userName || '');
    const knownRoleTags = Array.isArray(context.knownRoleTags) ? context.knownRoleTags : [];
    const messageById = new Map((context.messages || []).map(message => [String(message.id), message]));
    const roleMap = new Map();
    const profileMap = new Map();
    const addRole = (name, patch = {}) => {
        const rawNormalized = normalizeExternalCharacterName(name, importMode === 'one_to_one' ? targetName : '');
        if (!rawNormalized || (importMode === 'multi_role' && isExternalImportUserName(rawNormalized, userName))) return '';
        const normalized = importMode === 'multi_role'
            ? resolveExternalKnownRoleName(rawNormalized, knownRoleTags)
            : rawNormalized;
        if (!normalized || (importMode === 'multi_role' && isExternalImportUserName(normalized, userName))) return '';
        const existing = roleMap.get(normalized.toLowerCase()) || { name: normalized, confidence: 0.8, reason: '' };
        roleMap.set(normalized.toLowerCase(), {
            ...existing,
            ...patch,
            name: existing.name || normalized,
            confidence: Math.max(Number(existing.confidence || 0), Number(patch.confidence || 0)),
            aliases: Array.from(new Set([
                ...(Array.isArray(existing.aliases) ? existing.aliases : []),
                ...normalizeExternalRoleAliases(patch),
                ...(normalized !== rawNormalized ? [rawNormalized] : [])
            ].map(alias => normalizeExternalCharacterName(alias)).filter(Boolean)))
        });
        return existing.name || normalized;
    };
    for (const tag of knownRoleTags) {
        addRole(tag?.name || tag, {
            ...tag,
            confidence: dependencies.clampImportNumber(tag?.confidence, 0.9, 0, 1),
            reason: dependencies.firstImportString(tag?.reason, '已捕获角色标签。')
        });
    }
    if (importMode === 'one_to_one') addRole(targetName || dependencies.getExternalSourceAppLabel(sourceApp), { confidence: 1, reason: '一对一导入目标角色。' });
    for (const tag of Array.isArray(parsed.role_tags) ? parsed.role_tags : []) {
        addRole(tag?.name, {
            confidence: dependencies.clampImportNumber(tag?.confidence, 0.8, 0, 1),
            reason: dependencies.firstImportString(tag?.reason)
        });
    }
    for (const profile of Array.isArray(parsed.character_profiles) ? parsed.character_profiles : []) {
        const name = addRole(profile?.name, { confidence: 0.85, reason: '小模型从导入记录中识别。' });
        if (name) profileMap.set(name.toLowerCase(), {
            name,
            persona: dependencies.firstImportString(profile?.persona, profile?.description).slice(0, 1500)
        });
    }

    const candidates = [];
    const rawMemories = (Array.isArray(parsed.memories) ? parsed.memories : []).slice(0, dependencies.EXTERNAL_MEMORY_IMPORT_MAX_MEMORIES);
    for (let idx = 0; idx < rawMemories.length; idx++) {
        const item = rawMemories[idx] || {};
        const summary = dependencies.firstImportString(item.summary, item.content, item.memory, item.text).slice(0, 1200);
        const content = dependencies.firstImportString(item.content, item.summary, item.memory, item.text).slice(0, 3000);
        if (!summary || !hasCjkText(summary)) continue;
        let names = Array.isArray(item.character_names) ? item.character_names : (Array.isArray(item.characters) ? item.characters : []);
        if (importMode === 'one_to_one' && names.length === 0) names = [targetName || dependencies.getExternalSourceAppLabel(sourceApp)];
        names = Array.from(new Set(names
            .map(name => addRole(name, { confidence: importMode === 'one_to_one' ? 1 : 0.8 }))
            .filter(Boolean)));
        if (importMode === 'multi_role' && names.length === 0) continue;
        const sourceRefs = Array.from(new Set((Array.isArray(item.source_refs) ? item.source_refs : [])
            .map(ref => String(ref || '').trim())
            .filter(ref => messageById.has(ref))))
            .slice(0, 20);
        const sourceMessages = sourceRefs.map(ref => messageById.get(ref)).filter(Boolean);
        const timestamps = sourceMessages.map(message => Number(message.timestamp || 0)).filter(ts => ts > 0).sort((a, b) => a - b);
        const sourceStartedAt = timestamps[0] || 0;
        const sourceEndedAt = timestamps[timestamps.length - 1] || sourceStartedAt || 0;
        const focus = dependencies.MEMORY_MAINTENANCE_FOCUS.has(String(item.memory_focus || '').trim()) ? String(item.memory_focus).trim() : 'general';
        const tier = dependencies.MEMORY_MAINTENANCE_TIERS.has(String(item.memory_tier || '').trim()) ? String(item.memory_tier).trim() : 'ambient';
        const keySeed = dependencies.firstImportString(item.consolidation_key, item.key, summary)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 90) || `external_memory_${idx + 1}`;
        candidates.push({
            id: `c${idx + 1}`,
            summary,
            content: content || summary,
            character_names: names,
            memory_focus: focus,
            memory_tier: tier,
            importance: Math.round(dependencies.clampImportNumber(item.importance, 5, 1, 10)),
            consolidation_key: keySeed,
            source_refs: sourceRefs,
            source_started_at: sourceStartedAt,
            source_ended_at: sourceEndedAt,
            source_time_text: dependencies.firstImportString(item.source_time_text) || (sourceStartedAt ? (sourceStartedAt === sourceEndedAt ? new Date(sourceStartedAt).toLocaleString('zh-CN') : `${new Date(sourceStartedAt).toLocaleString('zh-CN')} - ${new Date(sourceEndedAt).toLocaleString('zh-CN')}`) : ''),
            source_message_count: sourceRefs.length || sourceMessages.length || 0,
            reason: dependencies.firstImportString(item.reason).slice(0, 500)
        });
    }
    const roleTags = Array.from(roleMap.values())
        .filter(tag => candidates.some(candidate => candidate.character_names.includes(tag.name)) || importMode === 'one_to_one')
        .map(tag => ({
            ...tag,
            profile: profileMap.get(tag.name.toLowerCase()) || { name: tag.name, persona: '' }
        }));
    return {
        source_app: sourceApp,
        import_mode: importMode,
        role_tags: roleTags,
        candidates,
        needs_review: Array.isArray(parsed.needs_review) ? parsed.needs_review.slice(0, 30) : []
    };
}

function chunkExternalImportMessages(messages = [], limit = 10, maxBatches = null) {
    const safeLimit = dependencies.normalizeMemoryMaintenanceBatchOptions({ limit }, { limitFallback: 10 }).limit;
    const chunks = [];
    for (let start = 0; start < messages.length; start += safeLimit) {
        if (maxBatches !== null && chunks.length >= maxBatches) break;
        chunks.push(messages.slice(start, start + safeLimit));
    }
    return chunks;
}

function mergeExternalImportRoleTags(existing = [], incoming = []) {
    const map = new Map();
    const seedTags = Array.isArray(existing) ? existing : [];
    const allTags = [...seedTags, ...(Array.isArray(incoming) ? incoming : [])];
    for (const tag of allTags) {
        const rawName = normalizeExternalCharacterName(tag?.name || tag);
        const name = seedTags.length && !seedTags.some(seed => getExternalNameCompareKey(seed?.name || seed) === getExternalNameCompareKey(rawName))
            ? resolveExternalKnownRoleName(rawName, seedTags)
            : rawName;
        if (!name) continue;
        const key = name.toLowerCase();
        const prev = map.get(key) || { name, confidence: 0, reason: '', profile: { name, persona: '' } };
        const aliases = Array.from(new Set([
            ...(Array.isArray(prev.aliases) ? prev.aliases : []),
            ...normalizeExternalRoleAliases(tag),
            ...(rawName && rawName !== name ? [rawName] : [])
        ].map(alias => normalizeExternalCharacterName(alias)).filter(Boolean)));
        map.set(key, {
            ...prev,
            ...tag,
            name: prev.name || name,
            confidence: Math.max(Number(prev.confidence || 0), Number(tag?.confidence || 0)),
            reason: dependencies.firstImportString(prev.reason, tag?.reason),
            aliases,
            profile: {
                ...(prev.profile || {}),
                ...(tag?.profile || {}),
                name
            }
        });
    }
    return Array.from(map.values());
}

function buildExternalImportDirectDedupeKey({ importId, sourceApp, characterId, candidate }) {
    const refs = Array.isArray(candidate?.source_refs) ? candidate.source_refs.join('_') : '';
    const seed = dependencies.firstImportString(candidate?.consolidation_key, candidate?.id, candidate?.summary, refs)
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100) || 'memory';
    return `external-import-direct:${sourceApp}:${characterId}:${importId}:${seed}`.slice(0, 240);
}

function getExternalImportSharedLibraryId(sourceApp = '') {
    const app = String(sourceApp || 'external_app')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'external-app';
    return `external-shared-${app}`;
}

function shouldUseSharedExternalImportLibrary(sourceApp = '', importMode = '') {
    return sourceApp === 'sillytavern' || importMode === 'multi_role';
}

    return { buildExternalImportPrompt, normalizeExternalCharacterName, getExternalNameCompareKey, isExternalImportUserName, getExternalNameTokens, normalizeExternalRoleAliases, getExternalRoleCandidateNames, resolveExternalKnownRoleName, normalizeExternalImportResult, chunkExternalImportMessages, mergeExternalImportRoleTags, buildExternalImportDirectDedupeKey, getExternalImportSharedLibraryId, shouldUseSharedExternalImportLibrary };
}

module.exports = { createModule };
