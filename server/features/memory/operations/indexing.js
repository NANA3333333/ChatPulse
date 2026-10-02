// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function parseLooseJson(value, fallback = null) {
        if (value == null || value === '') return fallback;
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch (e) {
            return fallback;
        }
    }

function normalizeStringArray(value) {
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            const parsed = parseLooseJson(trimmed, null);
            if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
            return trimmed.split(/[,，、\n]/).map(v => v.trim()).filter(Boolean);
        }
        return [];
    }

function normalizeRelationshipArray(value) {
        if (Array.isArray(value)) return value.filter(Boolean);
        if (value && typeof value === 'object') return [value];
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];
            const parsed = parseLooseJson(trimmed, null);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
            if (parsed && typeof parsed === 'object') return [parsed];
            return [{ summary: trimmed }];
        }
        return [];
    }

function summarizeRelationships(relationships) {
        return normalizeRelationshipArray(relationships).map(rel => {
            if (typeof rel === 'string') return rel;
            return rel.summary || rel.type || JSON.stringify(rel);
        }).filter(Boolean);
    }

function buildMemorySubjectRules(character = {}, sourceContext = 'mixed') {
        const characterName = character?.name || '当前角色';
        const contextLine = sourceContext === 'commercial_street'
            ? `- 当前输入是 commercial_street / city activity：这些是 ${characterName} 的城市生活与商业街行动日志。日志里的“我/I”默认是 ${characterName}，不是 User/Nana。`
            : sourceContext === 'group_chat'
                ? '- 当前输入是 group_chat：每行可见说话人就是主语；群友的“我/I”只属于该群友，不能合并成 User。'
                : sourceContext === 'private_chat'
                    ? `- 当前输入是 private_chat："User:" 行属于真实用户，"${characterName}:" 行属于 ${characterName}；每行里的“我/I”只属于该行说话人。`
                    : `- 当前输入可能混合 private_chat / group_chat / commercial_street：必须先按来源前缀判断主语，再写记忆。`;
        return `SUBJECT / PERSON RULES (hard):
- "User"、"用户"、"Nana" 只表示真实用户；"${characterName}"、"当前角色"、"角色" 表示这个角色本人。
${contextLine}
- 工厂、餐厅、便利店、公园、长椅、回家、出租屋、领工钱、日结、搬运等商业街/城市行动，默认是 ${characterName} 的行为，除非文本明确写 User/Nana 做了这件事。
- 输出 summary/content 时必须显式写清主语；不要写“用户……”除非来源明确是 User/Nana 的行为、状态或想法。
- 这里的“角色”只是当前数据库对象，不等于 roleplay。不要把普通事件包装成“在角色扮演中/在设定中/剧情中”；除非原文明确讨论扮演机制本身，否则直接写“${characterName}……”。
- ${characterName} 自己的城市生活、工作、身体状态、金钱压力通常归为 memory_focus="general"；只有直接改变 User 与 ${characterName} 关系时才用 relationship；不要把角色行为归到 user_profile 或 user_current_arc。`;
    }

function looksLikeCityMemory(memoryData = {}) {
        const type = String(memoryData.memory_type || '').toLowerCase();
        const location = String(memoryData.location || '').trim().toLowerCase();
        const text = [
            memoryData.summary,
            memoryData.content,
            memoryData.event
        ].filter(Boolean).join(' ').toLowerCase();
        if (type.startsWith('city')) return true;
        if (dependencies.CITY_MEMORY_LOCATIONS.has(location)) return true;
        return /(city activity|公园|餐厅|便利店|商业街|工厂|街上|回到家|在家|长椅|吃饭|散步|发呆|路灯|晚风|路边)/i.test(text);
    }

function looksLikeReplyDrivenCityNarration(memoryData = {}) {
        const text = [
            memoryData.summary,
            memoryData.content,
            memoryData.event
        ].filter(Boolean).join(' ');
        if (!text) return false;
        return /(被私聊|刚才那句私聊|这轮私聊|嘴上还|话里还挂着点|脚步却已经转向|把这口气全压进了行动里|脑子里还挂着刚才那句私聊|一边嘴硬一边|边走边在心里继续跟你较劲)/i.test(text);
    }

function hasHighValueMemorySignals(memoryData = {}) {
        const type = String(memoryData.memory_type || '').toLowerCase();
        const people = normalizeStringArray(memoryData.people_json ?? memoryData.people);
        const relationships = normalizeRelationshipArray(memoryData.relationship_json ?? memoryData.relationships);
        const emotion = String(memoryData.emotion || '').trim();
        const sourceMessageIds = normalizeStringArray(memoryData.source_message_ids_json);
        const text = [
            memoryData.summary,
            memoryData.content,
            memoryData.event
        ].filter(Boolean).join(' ');
        if (['relationship', 'plan', 'preference', 'emotion'].includes(type)) return true;
        if (Number(memoryData.importance || 0) >= 7) return true;
        if (people.length > 0 || relationships.length > 0) return true;
        if (sourceMessageIds.length > 0) return true;
        if (looksLikeCityMemory(memoryData) && looksLikeReplyDrivenCityNarration(memoryData)) return false;
        if (emotion && emotion.length >= 2 && !looksLikeCityMemory(memoryData)) return true;
        if (looksLikeCityMemory(memoryData)) {
            return /(告白|承诺|约定|吵架|冲突|和好|吃醋|嫉妒|委屈|喜欢|讨厌|秘密|密码|没钱|只剩|崩溃|住院|受伤|濒死|透支|极限|昏倒|发烧|还债|还不起|破产|Nana\s*(给|送|转|说|问|要求|答应|拒绝|安慰|哄|骂|亲|抱)|用户\s*(给|送|转|说|问|要求|答应|拒绝|安慰|哄|骂|亲|抱)|user\s*(gave|said|asked|promised|refused|comforted))/i.test(text);
        }
        return /(用户|nana|user|告白|承诺|约定|吵架|冲突|和好|吃醋|嫉妒|委屈|喜欢|讨厌|秘密|密码|没钱|只剩|崩溃|住院|受伤)/i.test(text);
    }

function isRoutineCityMemory(memoryData = {}) {
        if (!looksLikeCityMemory(memoryData)) return false;
        if (looksLikeReplyDrivenCityNarration(memoryData)) return true;
        if (hasHighValueMemorySignals(memoryData)) return false;
        const type = String(memoryData.memory_type || '').toLowerCase();
        if (!type || ['event', 'fact', 'city_event', 'city_log'].includes(type)) {
            return true;
        }
        return false;
    }

function classifyUserCenteredMemory(memoryData = {}) {
        const text = [
            memoryData.summary,
            memoryData.content,
            memoryData.event,
            memoryData.relationships,
            memoryData.people,
            memoryData.location,
            memoryData.emotion
        ].filter(Boolean).join(' ').toLowerCase();
        const type = String(memoryData.memory_type || '').toLowerCase();
        const importance = Number(memoryData.importance || 5);
        const peopleList = Array.isArray(memoryData.people_json)
            ? memoryData.people_json.map(v => String(v || '').toLowerCase())
            : String(memoryData.people || '').toLowerCase().split(/[,\s/]+/).filter(Boolean);
        const hasUser = /(nana|user|用户|你\b)/i.test(text) || peopleList.some(v => /(nana|user|用户)/i.test(v));
        const hasCharacter = /(claude|gemini|grok|glm|gpt|assistant|ai|角色|对方|ta\b|他\b|她\b)/i.test(text)
            || peopleList.some(v => /(claude|gemini|grok|glm|gpt|assistant|ai|角色)/i.test(v));
        const hasRelationshipSignal = /(关系|和好|吵架|冲突|承诺|信任|嫉妒|吃醋|委屈|喜欢|告白|暧昧|拉扯|陪|安慰|伤到|hurt|jealous|relationship|trust|conflict|reconcile|affection)/i.test(text)
            || type === 'relationship';
        const hasLoveConfessionSignal = /(我喜欢你|我爱你|喜欢你|爱你|告白|表白|心动|暧昧|想和你在一起|对你有感觉|不是第一次说|说过很多次|反复示爱|明确示爱|关系确认|只喜欢你|只想要你)/i.test(text);
        const hasUserDemandSignal = /(答应我|你要答应|你得答应|别离开我|不要离开我|只准|不准|要一直陪我|必须回应我|你要记住|不许忘|你得哄我|你要陪我|别找别人|只能对我)/i.test(text);
        const hasCurrentArcSignal = /(最近|这段时间|目前|现在|正在|当时|当天|今天|昨天|前天|上次|这次|那次|几号|日期|时间|第一天|第\d+天|打算|准备|计划|offer|startup|ceo|实习|面试|简历|求职|找工作|工作|公司|入职|考研|学校|项目|论文|焦虑|内耗|压力|病|身体|恢复|不舒服)/i.test(text)
            || ['plan', 'emotion'].includes(type);
        const hasIdentitySignal = /(学历|本科|专业|学校|背景|家庭|性格|偏好|喜欢|讨厌|习惯|口味|过敏|慢性|长期健康|长期体质|长期目标|价值观|梦想|身份|经历)/i.test(text)
            || type === 'preference';

        if ((hasLoveConfessionSignal || hasUserDemandSignal) && (hasUser || hasCharacter)) {
            return {
                memory_focus: 'relationship',
                memory_tier: 'core'
            };
        }
        if (hasRelationshipSignal && (hasUser || hasCharacter)) {
            return {
                memory_focus: 'relationship',
                memory_tier: importance >= 5 ? 'core' : 'active'
            };
        }
        if (hasCurrentArcSignal && hasUser) {
            return {
                memory_focus: 'user_current_arc',
                memory_tier: importance >= 5 ? 'core' : 'active'
            };
        }
        if (hasIdentitySignal && hasUser) {
            return {
                memory_focus: 'user_profile',
                memory_tier: importance >= 4 ? 'core' : 'active'
            };
        }
        if (importance >= 6) {
            return {
                memory_focus: 'general',
                memory_tier: 'active'
            };
        }
        return {
            memory_focus: 'general',
            memory_tier: 'ambient'
        };
    }

function computeMemoryRetrievalWeight(memoryData = {}) {
        const type = String(memoryData.memory_type || '').toLowerCase();
        const inferred = classifyUserCenteredMemory(memoryData);
        const tier = String(memoryData.memory_tier || inferred.memory_tier || '').toLowerCase();
        const focus = String(memoryData.memory_focus || inferred.memory_focus || '').toLowerCase();
        if (isRoutineCityMemory(memoryData)) return 0.42;
        if (looksLikeCityMemory(memoryData)) return hasHighValueMemorySignals(memoryData) ? 0.78 : 0.6;
        let weight = 1;
        if (['relationship', 'plan', 'preference', 'emotion'].includes(type)) weight += 0.16;
        if (tier === 'core') weight += 0.4;
        else if (tier === 'active') weight += 0.18;
        if (focus === 'relationship') weight += 0.34;
        else if (focus === 'user_current_arc') weight += 0.22;
        else if (focus === 'user_profile') weight += 0.2;
        return weight;
    }

function computeMemoryTierBoost(memoryData = {}) {
        const inferred = classifyUserCenteredMemory(memoryData);
        const tier = String(memoryData.memory_tier || inferred.memory_tier || '').toLowerCase();
        const focus = String(memoryData.memory_focus || inferred.memory_focus || '').toLowerCase();
        let boost = 0;
        if (tier === 'core') boost += 0.22;
        else if (tier === 'active') boost += 0.1;
        if (focus === 'relationship') boost += 0.26;
        else if (focus === 'user_current_arc') boost += 0.16;
        else if (focus === 'user_profile') boost += 0.14;
        return boost;
    }

function computeUserProfilePriorityBoost(memoryData = {}, queryText = '', queryVariants = []) {
        const inferred = classifyUserCenteredMemory(memoryData);
        const tier = String(memoryData.memory_tier || inferred.memory_tier || '').toLowerCase();
        const focus = String(memoryData.memory_focus || inferred.memory_focus || '').toLowerCase();
        const type = String(memoryData.memory_type || '').toLowerCase();
        const text = [
            memoryData?.summary,
            memoryData?.content,
            memoryData?.event
        ].filter(Boolean).join(' ');
        const queryContext = [
            String(queryText || ''),
            ...(Array.isArray(queryVariants) ? queryVariants : [])
        ].join('\n');

        let boost = 0;
        if (focus === 'user_profile') {
            boost += 0.42;
            if (tier === 'core') boost += 0.18;
        } else if (focus === 'user_current_arc') {
            boost += 0.08;
            if (tier === 'core') boost += 0.06;
        }

        if (/(关于我|记得我|个人信息|用户信息|背景|学习|学历|学校|专业|年级|工作|实习|职业|经历|情况|介绍)/i.test(queryContext)) {
            if (focus === 'user_profile') boost += 0.72;
            else if (focus === 'user_current_arc') boost += 0.34;
            if (focus === 'relationship') boost -= 0.12;
            if (type === 'emotion' || /(焦虑|难过|委屈|情绪|内耗|痛苦|崩溃)/i.test(text)) {
                boost -= 0.18;
            }
        }

        return boost;
    }

function buildDedupeKey(characterId, memoryData) {
        const location = (memoryData.location || '').trim().toLowerCase();
        const type = (memoryData.memory_type || 'event').trim().toLowerCase();
        const summary = (memoryData.summary || memoryData.event || '').trim().toLowerCase();
        if (!summary) return '';
        return [characterId, type, location, summary].filter(Boolean).join('::').slice(0, 240);
    }

function formatAbsoluteTimestamp(ts) {
        const value = Number(ts || 0);
        if (!Number.isFinite(value) || value <= 0) return '';
        try {
            return new Date(value).toLocaleString('en-US');
        } catch (e) {
            return '';
        }
    }

function formatSourceTimeRange(startTs, endTs) {
        const start = Number(startTs || 0);
        const end = Number(endTs || 0);
        const startText = formatAbsoluteTimestamp(start);
        const endText = formatAbsoluteTimestamp(end);
        if (startText && endText) {
            return start === end ? startText : `${startText} -> ${endText}`;
        }
        return startText || endText || '';
    }

function buildSourceTimeMeta(messages = []) {
        const rows = (Array.isArray(messages) ? messages : []).filter(Boolean);
        const timestamps = rows
            .map(msg => Number(msg?.timestamp || 0))
            .filter(ts => Number.isFinite(ts) && ts > 0)
            .sort((a, b) => a - b);
        const messageIds = rows
            .flatMap(msg => {
                const explicitIds = normalizeStringArray(msg?.source_message_ids_json);
                if (explicitIds.length > 0) return explicitIds;
                return msg?.id !== undefined && msg?.id !== null ? [String(msg.id)] : [];
            });
        const source_started_at = timestamps[0] || 0;
        const source_ended_at = timestamps[timestamps.length - 1] || source_started_at || 0;
        return {
            source_started_at,
            source_ended_at,
            source_time_text: formatSourceTimeRange(source_started_at, source_ended_at),
            source_message_count: rows.length,
            source_message_ids_json: messageIds
        };
    }

function normalizeMemoryPayload(rawMemoryData = {}, options = {}) {
        const peopleList = normalizeStringArray(rawMemoryData.people_json ?? rawMemoryData.people);
        const itemList = normalizeStringArray(rawMemoryData.items_json ?? rawMemoryData.items);
        const relationshipList = normalizeRelationshipArray(rawMemoryData.relationship_json ?? rawMemoryData.relationships);
        const relationshipSummary = summarizeRelationships(relationshipList);
        const summary = (rawMemoryData.summary || rawMemoryData.event || '').trim();
        const content = (rawMemoryData.content || rawMemoryData.event || summary).trim();
        let memoryType = rawMemoryData.memory_type || 'event';
        if (!rawMemoryData.memory_type && looksLikeCityMemory(rawMemoryData)) {
            memoryType = 'city_event';
        }
        let importance = Math.max(1, Math.min(10, Number(rawMemoryData.importance) || 5));
        const classified = classifyUserCenteredMemory({
            ...rawMemoryData,
            memory_type: memoryType,
            importance,
            people_json: peopleList,
            relationship_json: relationshipList,
            people: peopleList.join(', '),
            relationships: relationshipSummary.join('; ')
        });
        const consolidationSummary = String(rawMemoryData.consolidation_summary || rawMemoryData.merge_summary || summary || content || '').trim();
        const normalized = {
            memory_type: memoryType,
            summary: summary || content || '(empty memory)',
            content: content || summary || '(empty memory)',
            time: (rawMemoryData.time || '').trim(),
            location: (rawMemoryData.location || '').trim(),
            people_json: peopleList,
            items_json: itemList,
            relationship_json: relationshipList,
            people: peopleList.join(', '),
            items: itemList.join(', '),
            relationships: relationshipSummary.join('; '),
            event: (rawMemoryData.event || summary || content || '(empty memory)').trim(),
            emotion: (rawMemoryData.emotion || '').trim(),
            importance,
            source_message_ids_json: normalizeStringArray(rawMemoryData.source_message_ids_json),
            dedupe_key: rawMemoryData.dedupe_key || buildDedupeKey(options.characterId || '', rawMemoryData),
            is_archived: Number(rawMemoryData.is_archived || 0),
            surprise_score: Math.max(1, Math.min(10, Number(rawMemoryData.surprise_score) || importance)),
            source_started_at: Number(rawMemoryData.source_started_at || 0),
            source_ended_at: Number(rawMemoryData.source_ended_at || 0),
            source_time_text: String(rawMemoryData.source_time_text || '').trim(),
            source_message_count: Number(rawMemoryData.source_message_count || 0),
            source_context: String(rawMemoryData.source_context || '').trim(),
            scene_tag: String(rawMemoryData.scene_tag || '').trim(),
            source_app: String(rawMemoryData.source_app || '').trim(),
            memory_tier: String(rawMemoryData.memory_tier || classified.memory_tier || 'ambient').trim().toLowerCase(),
            memory_focus: String(rawMemoryData.memory_focus || classified.memory_focus || 'general').trim().toLowerCase(),
            consolidation_key: String(rawMemoryData.consolidation_key || rawMemoryData.merge_key || rawMemoryData.dedupe_key || '').trim(),
            consolidation_summary: consolidationSummary
        };
        if (!normalized.source_time_text) {
            normalized.source_time_text = formatSourceTimeRange(normalized.source_started_at, normalized.source_ended_at);
        }
        if (!['core', 'active', 'ambient'].includes(normalized.memory_tier)) {
            normalized.memory_tier = classified.memory_tier || 'ambient';
        }
        if (!['user_profile', 'user_current_arc', 'relationship', 'general'].includes(normalized.memory_focus)) {
            normalized.memory_focus = classified.memory_focus || 'general';
        }
        if (isRoutineCityMemory(normalized)) {
            normalized.memory_type = 'city_log';
            normalized.importance = Math.min(normalized.importance, 3);
            normalized.surprise_score = Math.min(normalized.surprise_score, 2);
        }
        return normalized;
    }

function shouldWriteImmediateMemory(memoryData = {}) {
        const normalized = normalizeMemoryPayload(memoryData);
        const importance = Number(normalized.importance || 0);
        const type = String(normalized.memory_type || '').toLowerCase();
        const tier = String(normalized.memory_tier || '').toLowerCase();
        const focus = String(normalized.memory_focus || '').toLowerCase();

        if (isRoutineCityMemory(normalized)) return false;
        if (importance >= 7) return true;
        if (tier === 'core' && importance >= 5) return true;
        if (['relationship', 'user_profile', 'user_current_arc'].includes(focus) && importance >= 5) return true;
        if (['relationship', 'plan', 'preference', 'emotion'].includes(type) && importance >= 5) return true;
        return hasHighValueMemorySignals(normalized) && importance >= 6;
    }

function buildMemoryEmbeddingText(memoryData) {
        const relationshipSummary = summarizeRelationships(memoryData.relationship_json ?? memoryData.relationships);
        const primarySummary = String(memoryData.consolidation_summary || memoryData.summary || memoryData.content || memoryData.event || '').trim();
        const hasNewSummary = !!String(memoryData.consolidation_summary || '').trim();
        const legacySummary = String(memoryData.legacy_summary || '').trim();
        const legacyContent = String(memoryData.legacy_content || '').trim();
        const detailContent = hasNewSummary
            ? (legacyContent || (String(memoryData.content || '').trim() !== primarySummary ? String(memoryData.content || '').trim() : ''))
            : String(memoryData.content || '').trim();
        return [
            hasNewSummary ? 'LibrarySource: new_consolidated_memory' : 'LibrarySource: legacy_memory_backup',
            memoryData.memory_type ? `Type: ${memoryData.memory_type}` : '',
            memoryData.memory_tier ? `Tier: ${memoryData.memory_tier}` : '',
            memoryData.memory_focus ? `Focus: ${memoryData.memory_focus}` : '',
            primarySummary ? `Summary: ${primarySummary}` : '',
            legacySummary && legacySummary !== primarySummary ? `LegacySummary: ${legacySummary}` : '',
            detailContent && detailContent !== primarySummary ? `Content: ${detailContent}` : '',
            memoryData.location ? `Location: ${memoryData.location}` : '',
            memoryData.time ? `Time: ${memoryData.time}` : '',
            memoryData.source_time_text ? `SourceTime: ${memoryData.source_time_text}` : '',
            memoryData.people ? `People: ${memoryData.people}` : '',
            memoryData.items ? `Items: ${memoryData.items}` : '',
            relationshipSummary.length ? `Relationships: ${relationshipSummary.join(', ')}` : '',
            memoryData.emotion ? `Emotion: ${memoryData.emotion}` : ''
        ].filter(Boolean).join('. ');
    }

function getNewLibraryIndexGroupKey(memoryRow = {}) {
        const effectiveCharacterId = memoryRow.shared_binding
            ? (memoryRow.bound_character_id || memoryRow.character_id || '')
            : (memoryRow.character_id || '');
        return [
            String(effectiveCharacterId),
            String(memoryRow.consolidation_key || '').trim(),
            String(memoryRow.consolidation_summary || '').trim().toLowerCase()
        ].join('::');
    }

function pickNewLibraryIndexRepresentative(existing, row) {
        if (!existing) return row;
        const existingRank = Number(existing.importance || 0) * 10000000000000
            + Number(existing.updated_at || existing.created_at || 0);
        const rowRank = Number(row.importance || 0) * 10000000000000
            + Number(row.updated_at || row.created_at || 0);
        return rowRank > existingRank ? row : existing;
    }

function buildNewLibraryIndexCards(rows = []) {
        const groups = new Map();
        for (const row of dependencies.selectSearchableMemoryRows(rows)) {
            const key = getNewLibraryIndexGroupKey(row);
            const existing = groups.get(key);
            groups.set(key, {
                key,
                representative: pickNewLibraryIndexRepresentative(existing?.representative, row),
                source_ids: [...(existing?.source_ids || []), row.id],
                row_count: Number(existing?.row_count || 0) + 1
            });
        }
        return Array.from(groups.values()).map(group => {
            const row = group.representative || {};
            const relationshipSummary = summarizeRelationships(row.relationship_json ?? row.relationships).join('; ');
            return {
                id: row.id,
                point_id: row.shared_binding && row.bound_character_id ? `${row.id}:bound:${row.bound_character_id}` : row.id,
                index_group_key: group.key,
                source_ids: group.source_ids,
                row_count: group.row_count,
                character_id: String(row.shared_binding && row.bound_character_id ? row.bound_character_id : row.character_id || ''),
                storage_character_id: String(row.character_id || ''),
                shared_binding: Number(row.shared_binding || 0),
                bound_character_id: row.bound_character_id || '',
                bound_character_name: row.bound_character_name || '',
                group_id: row.group_id || '',
                memory_type: row.memory_type || 'event',
                memory_tier: row.memory_tier || 'ambient',
                memory_focus: row.memory_focus || 'general',
                importance: Number(row.importance || 5),
                created_at: Number(row.created_at || Date.now()),
                updated_at: Number(row.updated_at || row.created_at || Date.now()),
                legacy_summary: row.legacy_summary || '',
                legacy_content: row.legacy_content || '',
                time: row.time || '',
                is_archived: Number(row.is_archived || 0),
                dedupe_key: row.dedupe_key || '',
                source_started_at: Number(row.source_started_at || 0),
                source_ended_at: Number(row.source_ended_at || 0),
                source_time_text: row.source_time_text || row.time || '',
                source_message_count: group.row_count,
                location: row.location || '',
                people: row.people || '',
                items: row.items || '',
                relationships: row.relationships || relationshipSummary,
                relationship_json: row.relationship_json,
                emotion: row.emotion || '',
                event: row.event || row.consolidation_summary || row.summary || '',
                retrieval_count: Number(row.retrieval_count || 0),
                last_retrieved_at: Number(row.last_retrieved_at || 0),
                retention_action: row.retention_action || '',
                retention_reason: row.retention_reason || '',
                consolidation_key: row.consolidation_key || '',
                consolidation_summary: row.consolidation_summary || '',
                summary: row.consolidation_summary || row.summary || row.event || '',
                content: row.legacy_content || row.content || row.consolidation_summary || row.event || ''
            };
        }).sort((a, b) => (
            a.character_id.localeCompare(b.character_id)
            || b.updated_at - a.updated_at
            || b.created_at - a.created_at
            || Number(b.id || 0) - Number(a.id || 0)
        ));
    }

async function upsertNewLibraryIndexCard(characterId, card, index = null) {
        const textToEmbed = buildMemoryEmbeddingText(card);
        const embeddingArray = await dependencies.getEmbedding(textToEmbed);
        const retrievalWeight = computeMemoryRetrievalWeight(card);
        if (await dependencies.canUseQdrant()) {
            try {
                await dependencies.qdrant.upsertMemoryPoint(dependencies.userId, {
                    id: String(card.point_id),
                    vector: embeddingArray,
                    payload: {
                        memory_id: card.id,
                        character_id: String(characterId),
                        group_id: card.group_id || '',
                        memory_type: card.memory_type || 'event',
                        memory_tier: card.memory_tier || 'ambient',
                        memory_focus: card.memory_focus || 'general',
                        importance: card.importance || 5,
                        created_at: card.created_at || Date.now(),
                        updated_at: card.updated_at || card.created_at || Date.now(),
                        time: card.time || '',
                        is_archived: Number(card.is_archived || 0),
                        dedupe_key: card.dedupe_key || '',
                        retrieval_weight: retrievalWeight,
                        summary: card.summary || card.consolidation_summary || '',
                        content: card.content || card.consolidation_summary || '',
                        location: card.location || '',
                        source_started_at: Number(card.source_started_at || 0),
                        source_ended_at: Number(card.source_ended_at || 0),
                        source_time_text: card.source_time_text || '',
                        source_message_count: Number(card.source_message_count || card.row_count || 0),
                        source_memory_ids: (card.source_ids || []).join(','),
                        retention_action: card.retention_action || '',
                        consolidation_key: card.consolidation_key || '',
                        consolidation_summary: card.consolidation_summary || '',
                        memory_library_source: 'new',
                        memory_index_version: dependencies.MEMORY_RETRIEVAL_SOURCE_VERSION,
                        memory_index_granularity: dependencies.MEMORY_INDEX_GRANULARITY
                    }
                });
            } catch (e) {
                console.error(`[Memory] Qdrant upsert failed for ${characterId}/${card.id}:`, e.message);
                dependencies.qdrantAvailability = false;
            }
        }
        if (index) {
            await index.insertItem({
                id: String(card.point_id),
                vector: embeddingArray,
                metadata: {
                    memory_id: card.id,
                    surprise_score: card.importance || 5,
                    memory_type: card.memory_type || 'event',
                    memory_tier: card.memory_tier || 'ambient',
                    memory_focus: card.memory_focus || 'general',
                    dedupe_key: card.dedupe_key || '',
                    retrieval_weight: retrievalWeight,
                    source_memory_ids: (card.source_ids || []).join(','),
                    memory_library_source: 'new',
                    memory_index_version: dependencies.MEMORY_RETRIEVAL_SOURCE_VERSION,
                    memory_index_granularity: dependencies.MEMORY_INDEX_GRANULARITY
                }
            });
        }
    }

function formatMemoryForPrompt(memory) {
        const parts = [];
        const label = memory.consolidation_summary || memory.summary || memory.event || memory.content;
        if (label) parts.push(label);
        if (memory.time) parts.push(`时间: ${memory.time}`);
        if (memory.source_time_text) parts.push(`来源对话时间: ${memory.source_time_text}`);
        if (memory.location) parts.push(`地点: ${memory.location}`);
        if (memory.people) parts.push(`人物: ${memory.people}`);
        if (memory.relationships) parts.push(`关系: ${memory.relationships}`);
        if (memory.emotion) parts.push(`情绪: ${memory.emotion}`);
        return `- ${parts.join(' | ')}`;
    }

    return { parseLooseJson, normalizeStringArray, normalizeRelationshipArray, summarizeRelationships, buildMemorySubjectRules, looksLikeCityMemory, looksLikeReplyDrivenCityNarration, hasHighValueMemorySignals, isRoutineCityMemory, classifyUserCenteredMemory, computeMemoryRetrievalWeight, computeMemoryTierBoost, computeUserProfilePriorityBoost, buildDedupeKey, formatAbsoluteTimestamp, formatSourceTimeRange, buildSourceTimeMeta, normalizeMemoryPayload, shouldWriteImmediateMemory, buildMemoryEmbeddingText, getNewLibraryIndexGroupKey, pickNewLibraryIndexRepresentative, buildNewLibraryIndexCards, upsertNewLibraryIndexCard, formatMemoryForPrompt };
}

module.exports = { createModule };
