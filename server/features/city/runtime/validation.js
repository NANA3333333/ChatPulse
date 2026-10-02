// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizePixelBehaviorTreeSceneKey(sceneKey = '') {
        const safe = String(sceneKey || '').trim().slice(0, 80);
        if (!safe || !/^[a-zA-Z0-9_.:-]+$/.test(safe)) return '';
        return safe;
    }

function sanitizePixelBehaviorTreeState(rawTree = null) {
        if (!rawTree || typeof rawTree !== 'object' || Array.isArray(rawTree)) return null;
        const nodes = rawTree.nodes && typeof rawTree.nodes === 'object' && !Array.isArray(rawTree.nodes)
            ? rawTree.nodes
            : null;
        if (!nodes) return null;
        return {
            ...rawTree,
            tree_id: String(rawTree.tree_id || rawTree.treeId || '').trim().slice(0, 120) || 'runtime_single_character',
            schema: String(rawTree.schema || 'full_behavior_tree_patch_v1').trim().slice(0, 120),
            version: Number.isFinite(Number(rawTree.version)) ? Number(rawTree.version) : 1,
            root_id: String(rawTree.root_id || rawTree.rootId || 'street_character_root').trim().slice(0, 120),
            active_node_id: String(rawTree.active_node_id || rawTree.activeNodeId || '').trim().slice(0, 160),
            nodes,
            memory: rawTree.memory && typeof rawTree.memory === 'object' && !Array.isArray(rawTree.memory)
                ? rawTree.memory
                : {},
            patch_history: Array.isArray(rawTree.patch_history) ? rawTree.patch_history.slice(0, 80) : []
        };
    }

function normalizeDistrictPayload(raw) {
        return dependencies.normalizeCityDistrictPayload({
            ...raw,
            id: raw.id || dependencies.slugifyCityId(raw.name, 'district'),
            type: raw.type || 'generic',
            action_label: raw.action_label || '前往',
            emoji: raw.emoji || '🏬'
        });
    }

function normalizeItemPayload(raw) {
        return dependencies.normalizeCityCatalogItemPayload({
            ...raw,
            id: raw.id || dependencies.slugifyCityId(raw.name, 'item'),
            emoji: raw.emoji || '📦',
            category: dependencies.inferItemCategory(raw),
            sold_at: raw.sold_at || ''
        });
    }

function ensureCityDb(db) {
        if (!db.city) {
            const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : db;
            db.city = dependencies.initCityDb(rawDb);
        }
        return db;
    }

function createCityError(message, status = 500, canRetry = false) {
        const err = new Error(message);
        err.status = status;
        if (canRetry) err.canRetry = true;
        return err;
    }

function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

function normalizeDistrictText(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[\s"'`~!@#$%^&*()\-_=+[\]{};:,./<>?|\\]+/g, '');
    }

function scoreDistrictFromText(text, district) {
        const normalizedText = normalizeDistrictText(text);
        if (!normalizedText) return 0;

        let score = 0;
        for (const alias of dependencies.getDistrictAliasValues(district)) {
            const normalizedAlias = normalizeDistrictText(alias);
            if (!normalizedAlias || normalizedAlias.length < 2) continue;
            if (normalizedText === normalizedAlias) score = Math.max(score, 140);
            else if (normalizedText.includes(normalizedAlias)) score = Math.max(score, 110 + Math.min(18, normalizedAlias.length));
            else if (normalizedAlias.includes(normalizedText) && normalizedText.length >= 2) score = Math.max(score, 72 + Math.min(12, normalizedText.length));
        }

        const rawText = String(text || '').toLowerCase();
        const districtType = String(district?.type || '').toLowerCase();
        const districtId = String(district?.id || '').toLowerCase();

        if (districtType === 'work' && /(工作|打工|上班|赚钱|搬砖|厂里|工厂)/.test(rawText)) score = Math.max(score, 55);
        if (districtType === 'food' && /(吃饭|吃东西|吃点|餐馆|饭店|便利店|买吃的|填饱肚子|咖啡|奶茶|小吃)/.test(rawText)) score = Math.max(score, 55);
        if (districtType === 'education' && /(学习|上课|培训|夜校)/.test(rawText)) score = Math.max(score, 55);
        if (districtType === 'medical' && /(医院|看病|治疗|检查)/.test(rawText)) score = Math.max(score, 55);
        if (districtType === 'shopping' && /(逛街|商场|买东西|购物)/.test(rawText)) score = Math.max(score, 55);
        if (districtType === 'leisure' && /(公园|散步|放松|吹风|发呆|走走)/.test(rawText)) score = Math.max(score, 52);
        if (districtType === 'wander' && /(走走|逛逛|闲逛|出去转转|压马路|街上)/.test(rawText)) score = Math.max(score, 52);
        if (districtType === 'gambling' && /(赌场|赌博|赌一把)/.test(rawText)) score = Math.max(score, 55);
        if (districtType === 'rest' && /(回家|回去睡|在家躺|回住所|回寝室|回宿舍|回公寓|补觉|躺下|睡觉)/.test(rawText)) {
            score = Math.max(score, districtId === 'home' ? 68 : 76);
        }

        return score;
    }

function rankDistrictsFromText(text, districts) {
        return districts
            .map(district => ({ district, score: scoreDistrictFromText(text, district) }))
            .filter(entry => entry.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                const aIsHome = String(a.district?.id || '').toLowerCase() === 'home';
                const bIsHome = String(b.district?.id || '').toLowerCase() === 'home';
                if (aIsHome !== bIsHome) return aIsHome ? 1 : -1;
                return String(a.district?.name || '').length - String(b.district?.name || '').length;
            });
    }

function buildActionParseErrorLog(char, error, options = {}) {
        const rawMessage = String(error?.message || error || '未知错误')
            .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
            .replace(/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/g, '$1***')
            .replace(/\s+/g, ' ')
            .trim();
        const isParseLike = /json|unexpected|parse|action|log|可选地点|结构无效|模型没有返回|缺少|背包没有可食用物品/i.test(rawMessage);
        const prefix = isParseLike ? '行动 JSON 解析失败' : '行动生成失败';
        const reason = rawMessage ? `${prefix}：${rawMessage.slice(0, 180)}` : prefix;
        return dependencies.buildCollapsedCityLog(char, reason, options);
    }

function logActionParseError(db, userId, char, error, options = {}) {
        const district = options.district || null;
        const location = district?.id || char?.location || '';
        const content = buildActionParseErrorLog(char, error, options);
        try {
            db.city.logAction(char.id, 'ACTION_PARSE_ERROR', content, 0, 0, location);
        } catch (logErr) {
            console.error(`[City] ${char?.name || char?.id || '角色'} ACTION_PARSE_ERROR 写入失败: ${logErr.message}`);
            return;
        }
        try {
            dependencies.broadcastCityEvent(userId, char.id, 'ACTION_PARSE_ERROR', content);
        } catch (broadcastErr) {
            console.warn(`[City] ACTION_PARSE_ERROR 广播失败: ${broadcastErr.message}`);
        }
    }

function parseSuggestedDistrictCandidates(message, districts) {
        const text = String(message || '').trim().toLowerCase();
        if (!text) return [];

        const rankedNamedMatches = rankDistrictsFromText(text, districts);
        if (rankedNamedMatches.length > 0 && rankedNamedMatches[0].score >= 90) {
            return rankedNamedMatches.slice(0, 5).map(entry => entry.district);
        }

        const matched = new Map();
        const addMatches = (predicate) => {
            for (const district of districts) {
                if (predicate(district) && !matched.has(district.id)) {
                    matched.set(district.id, district);
                }
            }
        };

        addMatches(d => text.includes(String(d.id || '').toLowerCase()) || text.includes(String(d.name || '').toLowerCase()));

        if (/(工作|打工|上班|赚钱|搬砖|厂里)/.test(text)) addMatches(d => d.type === 'work');
        if (/(休息|睡觉|回家|躺着|补觉|回去睡|在家躺|回住所|回寝室|回宿舍|回公寓)/.test(text)) addMatches(d => d.type === 'rest' || d.id === 'home');
        if (/(吃饭|吃东西|吃点|餐馆|饭店|便利店|买吃的|填饱肚子)/.test(text)) addMatches(d => d.type === 'food' || d.id === 'restaurant' || d.id === 'convenience');
        if (/(学习|上课|培训|夜校)/.test(text)) addMatches(d => d.type === 'education');
        if (/(医院|看病|治疗|检查)/.test(text)) addMatches(d => d.type === 'medical' || d.id === 'hospital');
        if (/(逛街|商场|买东西|购物)/.test(text)) addMatches(d => d.type === 'shopping' || d.id === 'mall');
        if (/(公园|散步|放松|吹风|发呆)/.test(text)) addMatches(d => d.id === 'park' || d.type === 'leisure');
        if (/(赌场|赌博|赌一把)/.test(text)) addMatches(d => d.type === 'gambling' || d.id === 'casino');
        if (/(走走|逛逛|闲逛|出去转转|压马路)/.test(text)) addMatches(d => d.type === 'wander' || d.id === 'street');

        const blended = [
            ...rankedNamedMatches.map(entry => entry.district),
            ...Array.from(matched.values())
        ];
        const deduped = [];
        const seen = new Set();
        for (const district of blended) {
            if (!district?.id || seen.has(district.id)) continue;
            seen.add(district.id);
            deduped.push(district);
            if (deduped.length >= 5) break;
        }
        return deduped;
    }

function normalizeSurvivalState(char) {
        const legacySleepPressure = clamp(parseInt(char.sleep_pressure ?? 0, 10) || 0, 0, 100);
        const normalizedSleepDebt = clamp(parseInt(char.sleep_debt ?? 0, 10) || 0, 0, 100);
        return {
            energy: clamp(parseInt(char.energy ?? 100, 10) || 0, 0, 100),
            sleep_debt: Math.max(normalizedSleepDebt, legacySleepPressure),
            mood: clamp(parseInt(char.mood ?? 50, 10) || 0, 0, 100),
            stress: clamp(parseInt(char.stress ?? 20, 10) || 0, 0, 100),
            social_need: clamp(parseInt(char.social_need ?? 50, 10) || 0, 0, 100),
            health: clamp(parseInt(char.health ?? 100, 10) || 0, 0, 100),
            satiety: clamp(parseInt(char.satiety ?? 45, 10) || 0, 0, 100),
            stomach_load: clamp(parseInt(char.stomach_load ?? 0, 10) || 0, 0, 100)
        };
    }

function formatInventoryDecisionRow(item = {}) {
        const quantity = Math.max(0, Number(item.quantity || 0));
        const giftedQty = Math.min(quantity, Math.max(0, Number(item.user_gifted_quantity || item.gifted_quantity || 0)));
        const giftText = giftedQty > 0 ? `，其中用户送的x${giftedQty}` : '';
        const calText = Number(item.cal_restore || 0) > 0 ? `，+${Number(item.cal_restore)}体力` : '';
        return `- ${item.item_id || item.id}: ${item.emoji || ''}${item.name || item.item_id || item.id || '物品'} x${quantity}${giftText}${calText}`;
    }

function normalizeQuestIntent(richNarrations = null) {
        return dependencies.questService.normalizeQuestIntent(richNarrations);
    }

function limitText(value, maxLength = 220) {
        return String(value || '').trim().slice(0, maxLength);
    }

function normalizeAllowedBehaviorPlaceIds(rawIds = []) {
        if (!Array.isArray(rawIds)) return [];
        return Array.from(new Set(rawIds
            .map((id) => limitText(id, 80))
            .filter(Boolean)))
            .slice(0, 80);
    }

function normalizeSemanticMovementStep(step, action, allowedPlaceIdSet) {
        const normalized = { action };
        if (action === 'go_to_place' || action === 'loop_in_front_of' || action === 'browse_near' || action === 'idle_at_place') {
            const placeId = dependencies.readBehaviorStepPlaceId(step, ['place_id', 'placeId', 'target_place_id', 'targetPlaceId', 'to_place_id', 'toPlaceId'], allowedPlaceIdSet);
            if (!placeId) return null;
            normalized.place_id = placeId;
            return normalized;
        }
        if (action === 'wander_between' || action === 'patrol_segment') {
            const fromPlaceId = dependencies.readBehaviorStepPlaceId(step, ['from_place_id', 'fromPlaceId', 'source_place_id', 'sourcePlaceId'], allowedPlaceIdSet);
            const toPlaceId = dependencies.readBehaviorStepPlaceId(step, ['to_place_id', 'toPlaceId', 'target_place_id', 'targetPlaceId', 'place_id', 'placeId'], allowedPlaceIdSet);
            if (!fromPlaceId || !toPlaceId) return null;
            normalized.from_place_id = fromPlaceId;
            normalized.to_place_id = toPlaceId;
            return normalized;
        }
        if (action === 'walk_with_player') {
            const toPlaceId = dependencies.readBehaviorStepPlaceId(step, ['to_place_id', 'toPlaceId', 'target_place_id', 'targetPlaceId', 'place_id', 'placeId'], allowedPlaceIdSet);
            if (toPlaceId) normalized.to_place_id = toPlaceId;
            return normalized;
        }
        if (action === 'approach_player' || action === 'follow_player') {
            return normalized;
        }
        return null;
    }

function normalizeBehaviorChoiceTrigger(choice = {}) {
        const candidates = [
            choice?.trigger,
            choice?.action_id,
            choice?.actionId,
            choice?.next_action,
            choice?.nextAction,
            choice?.player_action,
            choice?.playerAction,
            choice?.id,
            choice?.action
        ].map((value) => limitText(value, 80));
        return candidates.find((value) => dependencies.behaviorPlayerInteractionActionSet.has(value)) || '';
    }

function sanitizeBehaviorSteps(rawSteps, allowedPlaceIds = [], maxSteps = 10, options = {}) {
        const allowedPlaceIdSet = new Set(normalizeAllowedBehaviorPlaceIds(allowedPlaceIds));
        const allowChoices = options.allowChoices !== false;
        const hasStepLimit = Number.isFinite(Number(maxSteps)) && Number(maxSteps) > 0;
        const stepLimit = hasStepLimit ? Math.floor(Number(maxSteps)) : Infinity;
        const sanitizedSteps = (Array.isArray(rawSteps) ? rawSteps : [])
            .map((step) => {
                if (!step || typeof step !== 'object') return null;
                const action = String(step.action || '').trim();
                if (!dependencies.behaviorTreeAllowedActionSet.has(action)) return null;
                if (!allowChoices && action === 'offer_choices') return null;
                const normalized = dependencies.behaviorSemanticMovementActionSet.has(action)
                    ? normalizeSemanticMovementStep(step, action, allowedPlaceIdSet)
                    : { action };
                if (!normalized) return null;
                if (step.text !== undefined) normalized.text = limitText(step.text, action === 'create_memory' ? 180 : 140);
                if (step.target_label !== undefined || step.targetLabel !== undefined) {
                    normalized.target_label = limitText(step.target_label || step.targetLabel, 80);
                }
                if (step.movement_style !== undefined || step.movementStyle !== undefined) {
                    normalized.movement_style = limitText(step.movement_style || step.movementStyle, 80);
                }
                if (step.activity !== undefined) normalized.activity = limitText(step.activity, 100);
                if (step.duration_ms !== undefined || step.durationMs !== undefined) {
                    normalized.duration_ms = clamp(Number(step.duration_ms || step.durationMs) || 900, 300, 6000);
                }
                if (step.value !== undefined) normalized.value = clamp(Number(step.value) || 0, -3, 3);
                if (step.reason !== undefined) normalized.reason = limitText(step.reason, 120);
                if (step.importance !== undefined) normalized.importance = clamp(Number(step.importance) || 0.2, 0, 1);
                if (allowChoices && Array.isArray(step.choices)) {
                    const normalizedChoices = step.choices.slice(0, 4).map((choice, index) => {
                        if (typeof choice === 'string') {
                            const label = limitText(choice, 24);
                            const trigger = dependencies.behaviorPlayerInteractionActionSet.has(label) ? label : '';
                            return trigger ? { id: trigger, label, trigger } : null;
                        }
                        if (!choice || typeof choice !== 'object') return null;
                        const trigger = normalizeBehaviorChoiceTrigger(choice);
                        if (!trigger) return null;
                        const choicePlaceId = dependencies.toAllowedBehaviorPlaceId(
                            choice.place_id || choice.placeId || choice.to_place_id || choice.toPlaceId || '',
                            allowedPlaceIdSet
                        );
                        return {
                            id: limitText(choice.id || trigger || `choice_${index + 1}`, 40),
                            label: limitText(choice.label || choice.text || `选项 ${index + 1}`, 24),
                            trigger,
                            ...(choicePlaceId ? { place_id: choicePlaceId } : {})
                        };
                    }).filter(Boolean);
                    if (action === 'offer_choices' && !normalizedChoices.length) return null;
                    normalized.choices = normalizedChoices;
                }
                if (action === 'offer_choices' && !Array.isArray(normalized.choices)) return null;
                return normalized;
            })
            .filter(Boolean);
        if (!hasStepLimit || sanitizedSteps.length <= stepLimit) return sanitizedSteps;
        if (allowChoices) {
            const firstChoiceStepIndex = sanitizedSteps.findIndex((step) => step?.action === 'offer_choices'
                && Array.isArray(step.choices)
                && step.choices.length > 0);
            if (firstChoiceStepIndex >= stepLimit) {
                return [
                    ...sanitizedSteps.slice(0, Math.max(0, stepLimit - 1)),
                    sanitizedSteps[firstChoiceStepIndex]
                ];
            }
        }
        return sanitizedSteps.slice(0, stepLimit);
    }

function sanitizeBehaviorBranch(rawBranch, char, payload = {}, fallbackReason = 'sanitize_empty', allowedPlaceIds = []) {
        if (!rawBranch || typeof rawBranch !== 'object') return null;
        const allowedPlaceIdSet = new Set(normalizeAllowedBehaviorPlaceIds(allowedPlaceIds));
        const steps = sanitizeBehaviorSteps(rawBranch.steps, allowedPlaceIds, null, { allowChoices: true });
        if (!steps.length) return null;
        const triggerPlaceId = dependencies.toAllowedBehaviorPlaceId(
            rawBranch.trigger?.place_id || rawBranch.trigger?.placeId || payload?.player_event?.place_id || '',
            allowedPlaceIdSet
        );
        const branchId = normalizeBehaviorNodeId(rawBranch.branch_id || rawBranch.id || `bt_${Date.now().toString(36)}`, 'branch');
        return {
            branch_id: branchId,
            title: limitText(rawBranch.title || '玩家互动分支', 80),
            priority: clamp(Number(rawBranch.priority) || 95, 1, 100),
            ttl_ms: clamp(Number(rawBranch.ttl_ms || rawBranch.ttlMs) || 45000, 3000, 120000),
            trigger: {
                player_action: limitText(rawBranch.trigger?.player_action || rawBranch.trigger?.playerAction || payload?.player_event?.action || 'greet', 60),
                place_id: triggerPlaceId
            },
            summary: limitText(rawBranch.summary || '', 180),
            steps
        };
    }

function normalizeBehaviorNodeId(value, fallback = 'node') {
        const raw = limitText(value, 80);
        const safe = raw
            .replace(/[^\w\u4e00-\u9fa5-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        return safe || `${fallback}_${Date.now().toString(36)}`;
    }

function sanitizeBehaviorTreePatch(rawPatch, char, payload = {}, fallbackReason = 'patch_empty', allowedPlaceIds = []) {
        const patch = rawPatch && typeof rawPatch === 'object' ? rawPatch : {};
        const rawNode = patch.node && typeof patch.node === 'object' ? patch.node : null;
        const rawBranch = rawNode?.steps ? rawNode : (patch.branch || patch);
        const branch = sanitizeBehaviorBranch(rawBranch, char, payload, fallbackReason, allowedPlaceIds);
        if (!branch) return null;
        const nodeId = normalizeBehaviorNodeId(rawNode?.id || rawNode?.node_id || branch.branch_id, 'branch');
        const requestedTargetNodeId = normalizeBehaviorNodeId(patch.target_node_id || patch.targetNodeId || 'player_interaction', 'target');
        const targetNodeId = dependencies.behaviorPatchTargetIds.has(requestedTargetNodeId) ? requestedTargetNodeId : 'player_interaction';
        if (targetNodeId === 'player_interaction' && !dependencies.behaviorBranchHasOfferChoices(branch)) return null;
        const nextActiveNodeId = normalizeBehaviorNodeId(patch.next_active_node_id || patch.nextActiveNodeId || nodeId, 'active');
        const patchId = normalizeBehaviorNodeId(patch.patch_id || patch.patchId || `patch_${nodeId}_${Date.now().toString(36)}`, 'patch');
        const memoryDelta = patch.memory_delta && typeof patch.memory_delta === 'object'
            ? Object.fromEntries(Object.entries(patch.memory_delta).slice(0, 12).map(([key, value]) => [limitText(key, 60), limitText(value, 180)]))
            : {};
        return {
            patch_id: patchId,
            operation: 'upsert_child',
            target_node_id: targetNodeId,
            next_active_node_id: nextActiveNodeId,
            reason: limitText(patch.reason || branch.summary || '', 180),
            node: {
                id: nodeId,
                type: 'ActionSequence',
                title: branch.title,
                branch_kind: targetNodeId === 'player_interaction' ? 'special' : 'base',
                priority: branch.priority,
                ttl_ms: branch.ttl_ms,
                trigger: branch.trigger,
                summary: branch.summary,
                steps: branch.steps
            },
            memory_delta: memoryDelta
        };
    }

function normalizeBehaviorRepeatText(value) {
        return limitText(value, 320)
            .toLowerCase()
            .replace(/[\s"'“”‘’`.,，。！？!?、:：;；（）()[\]{}<>《》【】…—_\-~～]+/g, '');
    }

function collectBehaviorNodeRepeatTexts(node = {}) {
        const entries = [];
        const pushText = (value, kind) => {
            const text = limitText(value, 180);
            const normalized = normalizeBehaviorRepeatText(text);
            if (normalized.length < 10) return;
            entries.push({ kind, text, normalized });
        };
        pushText(node.title, 'title');
        pushText(node.summary, 'summary');
        (Array.isArray(node.steps) ? node.steps : []).forEach((step) => {
            const action = String(step?.action || '').trim();
            if (!dependencies.behaviorRepeatTextActions.has(action)) return;
            pushText(step.text, action);
        });
        return entries;
    }

function normalizeBehaviorIterationStep(step = {}) {
        if (!step || typeof step !== 'object') return null;
        const action = limitText(step.action, 60);
        if (!action) return null;
        const normalized = { action };
        if (step.text !== undefined) normalized.text = limitText(step.text, 180);
        if (step.place_id !== undefined || step.placeId !== undefined) normalized.place_id = limitText(step.place_id || step.placeId, 80);
        if (step.from_place_id !== undefined || step.fromPlaceId !== undefined) normalized.from_place_id = limitText(step.from_place_id || step.fromPlaceId, 80);
        if (step.to_place_id !== undefined || step.toPlaceId !== undefined) normalized.to_place_id = limitText(step.to_place_id || step.toPlaceId, 80);
        if (step.movement_style !== undefined || step.movementStyle !== undefined) normalized.movement_style = limitText(step.movement_style || step.movementStyle, 80);
        if (step.reason !== undefined) normalized.reason = limitText(step.reason, 120);
        if (step.duration_ms !== undefined || step.durationMs !== undefined) normalized.duration_ms = clamp(Number(step.duration_ms || step.durationMs) || 0, 0, 120000);
        if (Array.isArray(step.choices)) {
            normalized.choices = step.choices.slice(0, 4).map((choice) => ({
                id: limitText(choice?.id, 40),
                label: limitText(choice?.label || choice?.text, 40),
                trigger: limitText(choice?.trigger, 60),
                place_id: limitText(choice?.place_id || choice?.placeId, 80)
            })).filter((choice) => choice.label || choice.trigger);
        }
        return normalized;
    }

function normalizeBehaviorIterationRecords(rawRecords = [], behaviorTree = {}) {
        const sourceRecords = Array.isArray(rawRecords) && rawRecords.length
            ? rawRecords
            : dependencies.buildBehaviorIterationRecordsFromTree(behaviorTree);
        return sourceRecords.map((record, index) => {
            const normalized = {
                record_id: limitText(record?.record_id || record?.recordId || record?.patch_id || record?.patchId, 100),
                sequence: dependencies.normalizeBehaviorContextInteger(record?.sequence, index + 1, 1, 1000000),
                created_at: limitText(record?.created_at || record?.createdAt, 80),
                source: limitText(record?.source, 80),
                target_node_id: limitText(record?.target_node_id || record?.targetNodeId, 80),
                node_id: limitText(record?.node_id || record?.nodeId, 80),
                branch_kind: limitText(record?.branch_kind || record?.branchKind, 40),
                title: limitText(record?.title, 100),
                reason: limitText(record?.reason, 180),
                summary: limitText(record?.summary, 220),
                trigger: record?.trigger || '',
                steps: Array.isArray(record?.steps) ? record.steps.map(normalizeBehaviorIterationStep).filter(Boolean).slice(0, 10) : []
            };
            if (!normalized.record_id) {
                normalized.record_id = `${normalized.node_id || 'behavior_record'}_${normalized.sequence}`;
            }
            return normalized;
        }).filter((record) => record.record_id || record.node_id || record.title || record.steps.length)
            .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
    }

function normalizeBehaviorIterationSummaries(rawSummaries = []) {
        return (Array.isArray(rawSummaries) ? rawSummaries : []).map((summary, index) => ({
            summary_id: limitText(summary?.summary_id || summary?.summaryId || `behavior_summary_${index + 1}`, 100),
            start_record_id: limitText(summary?.start_record_id || summary?.startRecordId, 100),
            end_record_id: limitText(summary?.end_record_id || summary?.endRecordId, 100),
            start_sequence: dependencies.normalizeBehaviorContextInteger(summary?.start_sequence || summary?.startSequence, 0, 0, 1000000),
            end_sequence: dependencies.normalizeBehaviorContextInteger(summary?.end_sequence || summary?.endSequence, 0, 0, 1000000),
            record_count: dependencies.normalizeBehaviorContextInteger(summary?.record_count || summary?.recordCount, 0, 0, 1000000),
            summary_text: limitText(summary?.summary_text || summary?.summaryText || summary?.text || '', 3000),
            source_hash: limitText(summary?.source_hash || summary?.sourceHash, 128),
            created_at: Number(summary?.created_at || summary?.createdAt || 0) || 0
        })).filter((summary) => summary.summary_text);
    }

function formatBehaviorIterationRecord(record = {}) {
        const triggerText = typeof record.trigger === 'string'
            ? record.trigger
            : JSON.stringify(record.trigger || {});
        const stepText = (record.steps || []).map((step, index) => {
            const parts = [`${index + 1}.${step.action}`];
            if (step.text) parts.push(`text=${step.text}`);
            if (step.place_id) parts.push(`place=${step.place_id}`);
            if (step.from_place_id || step.to_place_id) parts.push(`from=${step.from_place_id || ''}->to=${step.to_place_id || ''}`);
            if (step.movement_style) parts.push(`style=${step.movement_style}`);
            if (Array.isArray(step.choices) && step.choices.length) {
                parts.push(`choices=${step.choices.map((choice) => `${choice.label || choice.id}:${choice.trigger || ''}${choice.place_id ? `@${choice.place_id}` : ''}`).join(' / ')}`);
            }
            return parts.join(' | ');
        }).join('\n');
        return [
            `记录 ${record.sequence} [${record.record_id}]`,
            `类型: ${record.branch_kind || 'unknown'} | 来源: ${record.source || 'unknown'} | 节点: ${record.node_id || ''}`,
            record.created_at ? `时间: ${record.created_at}` : '',
            record.title ? `标题: ${record.title}` : '',
            record.reason ? `原因: ${record.reason}` : '',
            record.summary ? `摘要: ${record.summary}` : '',
            triggerText && triggerText !== '{}' ? `触发: ${triggerText}` : '',
            stepText ? `步骤:\n${stepText}` : ''
        ].filter(Boolean).join('\n');
    }

function sanitizeBaseBehaviorBranch(rawBranch, char, payload = {}, fallbackReason = 'base_branch_invalid', allowedPlaceIds = []) {
        if (!rawBranch || typeof rawBranch !== 'object') return null;
        const sceneContext = dependencies.inferBehaviorScene(payload, payload.world || {});
        const rawTrigger = rawBranch.trigger || rawBranch.trigger_id || rawBranch.triggerId || 'otherwise';
        const requestedTarget = normalizeBehaviorNodeId(rawBranch.target_node_id || rawBranch.targetNodeId || '', 'target');
        const targetNodeId = dependencies.behaviorBasePatchTargetIds.has(requestedTarget)
            ? requestedTarget
            : dependencies.inferBaseBehaviorTargetNode(rawTrigger, 'wander');
        const steps = sanitizeBehaviorSteps(rawBranch.steps, allowedPlaceIds, 12, { allowChoices: false });
        if (!steps.length) return null;
        const nodeId = normalizeBehaviorNodeId(rawBranch.id || rawBranch.branch_id || `base_ai_${targetNodeId}_${Date.now().toString(36)}`, 'base_branch');
        const patchId = normalizeBehaviorNodeId(rawBranch.patch_id || rawBranch.patchId || `patch_${nodeId}_${Date.now().toString(36)}`, 'patch');
        return {
            patch_id: patchId,
            operation: 'upsert_child',
            target_node_id: targetNodeId,
            next_active_node_id: nodeId,
            reason: limitText(rawBranch.reason || rawBranch.summary || fallbackReason, 180),
            node: {
                id: nodeId,
                type: 'ActionSequence',
                title: limitText(rawBranch.title || `基础：${sceneContext.type === 'room' ? '房间行动' : '街区行动'}`, 80),
                branch_kind: 'base',
                priority: clamp(Number(rawBranch.priority) || 50, 1, 100),
                ttl_ms: clamp(Number(rawBranch.ttl_ms || rawBranch.ttlMs) || 45000, 3000, 120000),
                trigger: limitText(rawTrigger, 100),
                summary: limitText(rawBranch.summary || '', 180),
                steps
            },
            memory_delta: {}
        };
    }

function sanitizeBaseBehaviorBranchPack(rawValue, char, payload = {}, fallbackReason = 'base_pack_invalid', allowedPlaceIds = []) {
        const rawBranches = Array.isArray(rawValue?.base_branches)
            ? rawValue.base_branches
            : (Array.isArray(rawValue?.branches) ? rawValue.branches : (Array.isArray(rawValue) ? rawValue : []));
        let patches = rawBranches
            .map((branch) => sanitizeBaseBehaviorBranch(branch, char, payload, fallbackReason, allowedPlaceIds))
            .filter(Boolean)
            .slice(0, 20);
        const baseBranches = patches.map((patch) => ({
            id: patch.node.id,
            branch_id: patch.node.id,
            target_node_id: patch.target_node_id,
            title: patch.node.title,
            priority: patch.node.priority,
            ttl_ms: patch.node.ttl_ms,
            trigger: patch.node.trigger,
            summary: patch.node.summary,
            steps: patch.node.steps,
            branch_kind: 'base'
        }));
        return { base_branches: baseBranches, base_patches: patches, fallback: false };
    }

function sanitizeBehaviorInteractionStarterBranch(rawBranch, char, payload = {}, fallbackReason = 'starter_branch_invalid', allowedPlaceIds = []) {
        if (!rawBranch || typeof rawBranch !== 'object') return null;
        const allowedPlaceIdSet = new Set(normalizeAllowedBehaviorPlaceIds(allowedPlaceIds));
        const rawTrigger = rawBranch.trigger && typeof rawBranch.trigger === 'object' ? rawBranch.trigger : {};
        const playerAction = dependencies.readBehaviorInteractionStarterAction(rawBranch);
        if (!playerAction) return null;
        const triggerPlaceId = dependencies.toAllowedBehaviorPlaceId(
            rawTrigger.place_id || rawTrigger.placeId || rawBranch.place_id || rawBranch.placeId || payload?.player_event?.place_id || '',
            allowedPlaceIdSet
        );
        const branch = sanitizeBehaviorBranch({
            ...rawBranch,
            branch_id: rawBranch.branch_id || rawBranch.id || `starter_${playerAction}_${triggerPlaceId || 'any'}`,
            title: rawBranch.title || `互动开场：${playerAction}`,
            priority: rawBranch.priority || 90,
            ttl_ms: rawBranch.ttl_ms || rawBranch.ttlMs || 60000,
            trigger: {
                ...rawTrigger,
                player_action: playerAction,
                place_id: triggerPlaceId
            }
        }, char, {
            ...payload,
            player_event: {
                ...(payload?.player_event || {}),
                action: playerAction,
                place_id: triggerPlaceId || payload?.player_event?.place_id || ''
            }
        }, fallbackReason, allowedPlaceIds);
        if (!branch || !branch.steps.some((step) => step.action === 'offer_choices')) return null;
        const nodeId = normalizeBehaviorNodeId(rawBranch.id || rawBranch.branch_id || `starter_${playerAction}_${triggerPlaceId || 'any'}`, 'interaction_starter');
        const patchId = normalizeBehaviorNodeId(rawBranch.patch_id || rawBranch.patchId || `patch_${nodeId}`, 'patch');
        return {
            patch_id: patchId,
            source: 'ai-interaction-starter',
            operation: 'upsert_child',
            target_node_id: 'player_interaction',
            next_active_node_id: nodeId,
            reason: limitText(rawBranch.reason || branch.summary || fallbackReason, 180),
            node: {
                id: nodeId,
                type: 'ActionSequence',
                title: branch.title,
                branch_kind: 'special',
                priority: branch.priority,
                ttl_ms: branch.ttl_ms,
                trigger: {
                    player_action: playerAction,
                    ...(triggerPlaceId ? { place_id: triggerPlaceId } : {})
                },
                summary: branch.summary,
                steps: branch.steps,
                source: 'ai-interaction-starter'
            },
            memory_delta: {}
        };
    }

function sanitizeBehaviorInteractionStarterPack(rawValue, char, payload = {}, fallbackReason = 'starter_pack_invalid', allowedPlaceIds = []) {
        const rawBranches = Array.isArray(rawValue?.interaction_branches)
            ? rawValue.interaction_branches
            : (Array.isArray(rawValue?.starter_branches)
                ? rawValue.starter_branches
                : (Array.isArray(rawValue?.special_branches) ? rawValue.special_branches : []));
        const seenActions = new Set();
        const patches = [];
        rawBranches.forEach((branch) => {
            const patch = sanitizeBehaviorInteractionStarterBranch(branch, char, payload, fallbackReason, allowedPlaceIds);
            const playerAction = patch?.node?.trigger?.player_action || '';
            if (!patch || !playerAction || seenActions.has(playerAction)) return;
            seenActions.add(playerAction);
            patches.push(patch);
        });
        const interactionBranches = patches.map((patch) => ({
            id: patch.node.id,
            branch_id: patch.node.id,
            target_node_id: 'player_interaction',
            title: patch.node.title,
            priority: patch.node.priority,
            ttl_ms: patch.node.ttl_ms,
            trigger: patch.node.trigger,
            summary: patch.node.summary,
            steps: patch.node.steps,
            branch_kind: 'special',
            source: 'ai-interaction-starter'
        }));
        return { interaction_branches: interactionBranches, interaction_patches: patches };
    }

function parseCityWebIntentTag(text) {
        const raw = String(text || '');
        const match = raw.match(/\[WEB_SEARCH_INTENT:\s*([\s\S]*?)\]/i);
        if (!match) return null;
        const payload = String(match[1] || '').trim();
        if (!payload) return null;
        try {
            const parsed = JSON.parse(payload);
            const intent = {
                reason: String(parsed?.reason || '').trim(),
                query_hint: String(parsed?.query_hint || parsed?.query || '').trim()
            };
            return intent.reason || intent.query_hint ? intent : null;
        } catch (e) {
            return null;
        }
    }

function stripCityWebIntentTag(text) {
        return String(text || '')
            .replace(/\[WEB_SEARCH_INTENT:\s*[\s\S]*?\]/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

function formatCityWebResultBlock(searchResult, plan, intent) {
        const results = Array.isArray(searchResult?.results) ? searchResult.results.slice(0, 3) : [];
        return [
            '[刚刚查到的公开网页信息]',
            `查阅原因：${intent?.reason || '角色临时想确认一下'}`,
            `查询词：${searchResult?.query || plan?.queries?.[0] || intent?.query_hint || ''}`,
            `来源：${searchResult?.source || ''}`,
            '',
            ...results.map((item, index) => [
                `${index + 1}. ${item.title || item.url || '结果'}`,
                item.snippet ? `搜索摘要: ${item.snippet}` : '',
                item.page_text ? `来源正文摘录: ${String(item.page_text).slice(0, 3000)}` : '',
                item.url ? `链接: ${item.url}` : ''
            ].filter(Boolean).join('\n')),
            '',
            '[边界]',
            '- 这是角色刚刚看手机/上网查到的信息，不是亲身经历。',
            '- 商业街活动文本要写成现实动作，不要写成搜索报告。',
            '- 不要提 API、key、后端、系统或 prompt。'
        ].join('\n');
    }

    return { normalizePixelBehaviorTreeSceneKey, sanitizePixelBehaviorTreeState, normalizeDistrictPayload, normalizeItemPayload, ensureCityDb, createCityError, clamp, normalizeDistrictText, scoreDistrictFromText, rankDistrictsFromText, buildActionParseErrorLog, logActionParseError, parseSuggestedDistrictCandidates, normalizeSurvivalState, formatInventoryDecisionRow, normalizeQuestIntent, limitText, normalizeAllowedBehaviorPlaceIds, normalizeSemanticMovementStep, normalizeBehaviorChoiceTrigger, sanitizeBehaviorSteps, sanitizeBehaviorBranch, normalizeBehaviorNodeId, sanitizeBehaviorTreePatch, normalizeBehaviorRepeatText, collectBehaviorNodeRepeatTexts, normalizeBehaviorIterationStep, normalizeBehaviorIterationRecords, normalizeBehaviorIterationSummaries, formatBehaviorIterationRecord, sanitizeBaseBehaviorBranch, sanitizeBaseBehaviorBranchPack, sanitizeBehaviorInteractionStarterBranch, sanitizeBehaviorInteractionStarterPack, parseCityWebIntentTag, stripCityWebIntentTag, formatCityWebResultBlock };
}

module.exports = { createModule };
