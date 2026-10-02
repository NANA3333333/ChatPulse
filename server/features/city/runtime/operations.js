// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function recordCityTokenUsage(db, characterId, contextType, usage) {
        if (!usage || usage.cached || !characterId || typeof db?.addTokenUsage !== 'function') return;
        try {
            db.addTokenUsage(characterId, contextType, usage.prompt_tokens || 0, usage.completion_tokens || 0);
        } catch (err) {
            console.warn(`[City Usage] failed to record ${contextType} for ${characterId}: ${err.message}`);
        }
    }

function logEmotionTransition(db, beforeState, patch, source, reason) {
        if (!db?.addEmotionLog || !beforeState || !patch || Object.keys(patch).length === 0) return;
        const entry = dependencies.buildEmotionLogEntry(beforeState, { ...beforeState, ...patch }, source, reason);
        if (entry) db.addEmotionLog(entry);
    }

function logEmotionTransitionToState(db, beforeState, afterState, source, reason) {
        if (!db?.addEmotionLog || !beforeState || !afterState) return;
        const entry = dependencies.buildEmotionLogEntry(beforeState, afterState, source, reason);
        if (entry) db.addEmotionLog(entry);
    }

function slugifyCityId(value, fallbackPrefix) {
        const base = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_\-\u4e00-\u9fa5]/g, '')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        return base || `${fallbackPrefix}_${Date.now()}`;
    }

function inferItemCategory(data) {
        if (data.category) return data.category;
        const effect = String(data.effect || '').toLowerCase();
        const calRestore = Number(data.cal_restore || 0);
        const price = Number(data.buy_price || 0);
        if (effect.includes('quest')) return 'misc';
        if (effect.includes('affinity') || price >= 50) return 'gift';
        if (effect.includes('recover') || effect.includes('heal')) return 'medicine';
        if (effect.includes('utility') || effect.includes('tool')) return 'tool';
        if (calRestore > 0) return 'food';
        return 'misc';
    }

function getCityDate() {
        return new Date();
    }

function getDistrictAliasValues(district) {
        return [
            district?.id,
            district?.name,
            district?.action_label,
            district?.description,
            district?.type
        ]
            .map(v => String(v || '').trim())
            .filter(Boolean);
    }

function resolveStructuredTypeAlias(normalized = '') {
        const value = dependencies.normalizeDistrictText(normalized);
        if (!value) return '';
        if (['home'].includes(value)) return 'home';
        if (['rest', 'sleep', 'sleeping'].includes(value)) return 'rest';
        if (['food', 'eat', 'restaurant', 'meal', 'convenience'].includes(value)) return 'food';
        if (['work', 'factory', 'job'].includes(value)) return 'work';
        if (['hospital', 'medical', 'doctor'].includes(value)) return 'medical';
        if (['park', 'leisure'].includes(value)) return 'leisure';
        if (['street', 'wander'].includes(value)) return 'wander';
        if (['mall', 'shopping'].includes(value)) return 'shopping';
        if (['school', 'education', 'study'].includes(value)) return 'education';
        if (['casino', 'gambling'].includes(value)) return 'gambling';
        if ([
            'hacker',
            'hackerspace',
            'hackerspot',
            'hackersite',
            'hackerdistrict',
            'hacker_space'
        ].map(v => dependencies.normalizeDistrictText(v)).includes(value)) return 'hacker';
        return value;
    }

function selectPreferredRestDistrict(districts, explicitHome = false) {
        const restDistricts = districts.filter(d => String(d.type || '').toLowerCase() === 'rest');
        if (restDistricts.length === 0) {
            return districts.find(d => String(d.id || '').toLowerCase() === 'home') || null;
        }
        if (explicitHome) {
            return restDistricts.find(d => String(d.id || '').toLowerCase() === 'home') || restDistricts[0] || null;
        }
        return restDistricts.find(d => String(d.id || '').toLowerCase() !== 'home')
            || restDistricts.find(d => String(d.id || '').toLowerCase() === 'home')
            || restDistricts[0]
            || null;
    }

function buildCollapsedCityLog(char, reason, options = {}) {
        const district = options.district || null;
        const locationText = district ? `${district.emoji || ''}${district.name || district.id || ''}` : (options.locationLabel || '');
        const parts = [
            '【商业街输出折叠】',
            String(char?.name || '角色').trim() || '角色',
            locationText ? `地点=${locationText}` : '',
            reason ? `原因=${String(reason).trim()}` : ''
        ].filter(Boolean);
        return parts.join(' | ');
    }

function isCollapsedCityLog(text = '') {
        return String(text || '').trim().startsWith('【商业街输出折叠】');
    }

function findCityLogForOutreach(db, characterId, candidates = []) {
        const rawDb = typeof db?.getRawDb === 'function' ? db.getRawDb() : db;
        if (!rawDb?.prepare || !characterId) return null;
        const values = Array.from(new Set(
            (Array.isArray(candidates) ? candidates : [candidates])
                .map(value => String(value || '').trim())
                .filter(Boolean)
        ));
        for (const value of values) {
            try {
                const row = rawDb.prepare(`
                    SELECT id, action_type, location
                    FROM city_logs
                    WHERE character_id = ? AND content = ?
                    ORDER BY id DESC
                    LIMIT 1
                `).get(characterId, value);
                if (row) return row;
            } catch (err) {
                console.warn(`[City->Chat] 查询商业街日志来源失败: ${err.message}`);
                return null;
            }
        }
        return null;
    }

function calculateDerivedMood(state) {
        const derived = 55
            + (state.energy - 50) * 0.18
            + (state.health - 50) * 0.12
            - (state.stress - 20) * 0.28
            - (state.sleep_debt - 20) * 0.15
            + (state.satiety - 45) * 0.08
            - Math.max(0, state.stomach_load - 55) * 0.12;
        return dependencies.clamp(Math.round(derived), 0, 100);
    }

function getAvailableDistrictItems(db, districtId) {
        if (!db?.city || !districtId) return [];
        return db.city.getItemsAtDistrict(districtId)
            .filter(item => Number(item?.stock ?? -1) === -1 || Number(item?.stock ?? 0) > 0);
    }

function getInventoryQuantityTotal(inventory = []) {
        return Array.isArray(inventory)
            ? inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0)
            : 0;
    }

function isHackerDistrict(district) {
        const districtType = String(district?.type || '').trim().toLowerCase();
        const districtId = String(district?.id || '').trim().toLowerCase();
        return districtType === 'hacker' || districtId === 'hacker';
    }

function buildCityAttemptRecorder(db, character, contextType, baseMeta = {}) {
        return (attemptMeta = {}) => {
            dependencies.recordCityLlmDebug(
                db,
                character,
                attemptMeta.phase === 'start' ? 'attempt' : 'attempt_result',
                contextType,
                '',
                {
                    ...baseMeta,
                    llm_attempt: true,
                    ...attemptMeta
                }
            );
        };
    }

function clipHackerIntelContent(content, maxLength = 90) {
        const normalized = String(content || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return '';
        return normalized.length > maxLength
            ? `${normalized.slice(0, maxLength - 1)}…`
            : normalized;
    }

function buildHackerIntelAppendix(db, spyingChar) {
        const intel = db.getRecentUserConversationIntel?.(spyingChar.id, {
            sinceHours: 5,
            maxMessages: 20,
            maxCharacters: 20
        });
        if (!intel || !Array.isArray(intel.characters) || intel.characters.length === 0) {
            return '黑进几层跳板后，最后只抓到一片干净得过头的聊天缓存。过去 5 小时里，用户没有留下可供追踪的新对话对象。';
        }

        const lines = [];
        lines.push(`顺着监听链路把过去 5 小时的私聊记录拆开后，我最终抓到了 ${intel.characters.length} 个对话对象的聊天切片。`);
        lines.push(`每个对象按最近度分到了 ${intel.per_character_limit} 条上下文，下面这些都是带时间戳的原始截获片段。`);
        for (const convo of intel.characters) {
            const charName = String(convo.character_name || convo.character_id || '未知角色').trim();
            lines.push(`【对话对象：${charName}】`);
            if (!Array.isArray(convo.messages) || convo.messages.length === 0) {
                lines.push('  - 暂时只锁定到了目标，没有抄到有效消息。');
                continue;
            }
            for (const msg of convo.messages) {
                const speaker = msg.role === 'user' ? '用户' : charName;
                lines.push(`  - [${dependencies.formatHackerIntelTimestamp(msg.timestamp)}] ${speaker}：${clipHackerIntelContent(msg.content)}`);
            }
        }
        lines.push('以上是这次截获到的重点情报。');
        return lines.join('\n');
    }

function resolveDistrictFromStructuredSignal(signal, districts, options = {}) {
        const allowTypeFallback = !!options.allowTypeFallback;
        if (!signal || !Array.isArray(districts) || districts.length === 0) return null;

        const exactMatchByAlias = (value) => {
            const normalized = dependencies.normalizeDistrictText(value);
            if (!normalized) return null;
            for (const district of districts) {
                const aliases = getDistrictAliasValues(district);
                for (const alias of aliases) {
                    if (dependencies.normalizeDistrictText(alias) === normalized) {
                        return district;
                    }
                }
            }
            return null;
        };

        const matchByType = (value) => {
            const normalized = resolveStructuredTypeAlias(value);
            if (!normalized || !allowTypeFallback) return null;
            if (normalized === 'rest' || normalized === 'sleep' || normalized === 'sleeping') {
                return selectPreferredRestDistrict(districts, false);
            }
            if (normalized === 'home') {
                return selectPreferredRestDistrict(districts, true);
            }
            return districts.find(d => dependencies.normalizeDistrictText(d?.type) === normalized) || null;
        };

        if (typeof signal === 'string') {
            return exactMatchByAlias(signal) || matchByType(signal) || null;
        }

        if (typeof signal !== 'object') return null;

        const directCandidates = [
            signal.district_id,
            signal.districtId,
            signal.district_name,
            signal.districtName,
            signal.district,
            signal.name
        ];
        for (const candidate of directCandidates) {
            const matched = exactMatchByAlias(candidate);
            if (matched) return matched;
        }

        const typeCandidates = [
            signal.district_type,
            signal.districtType,
            signal.type,
            signal.intent
        ];
        for (const candidate of typeCandidates) {
            const matched = matchByType(candidate);
            if (matched) return matched;
        }

        return null;
    }

function getDistrictStateEffects(district, richNarrations = null) {
        const effects = { energy: 0, sleep_debt: 0, stress: 0, social_need: 0, health: 0, mood: 0, satiety: 0, stomach_load: 0 };
        switch (district.type) {
            case 'work':
                effects.energy -= 8;
                effects.sleep_debt += 9;
                effects.stress += 6;
                effects.social_need -= 4;
                effects.mood -= 2;
                break;
            case 'food':
                effects.energy += 7;
                effects.satiety += 14;
                effects.stomach_load += 10;
                effects.sleep_debt += 6;
                effects.stress -= 3;
                effects.mood += 4;
                break;
            case 'shopping':
                effects.energy -= 2;
                effects.stress -= 1;
                effects.mood += 3;
                break;
            case 'rest':
                effects.energy += 16;
                effects.sleep_debt -= 42;
                effects.stress -= 8;
                effects.health += 2;
                effects.mood += 4;
                break;
            case 'leisure':
            case 'wander':
                effects.energy -= 3;
                effects.stress -= 5;
                effects.social_need -= 10;
                effects.mood += 6;
                break;
            case 'education':
                effects.energy -= 6;
                effects.sleep_debt += 3;
                effects.stress += 2;
                effects.mood += 1;
                break;
            case 'medical':
                effects.energy += 4;
                effects.sleep_debt -= 4;
                effects.stress -= 6;
                effects.health += 18;
                effects.mood -= 1;
                break;
            case 'gambling':
                effects.energy -= 4;
                effects.sleep_debt += 4;
                effects.stress += 4;
                break;
            default:
                effects.energy -= 1;
                effects.mood += 1;
                break;
        }

        if (richNarrations?.chat) effects.social_need = Math.max(effects.social_need - 6, -15);
        return effects;
    }

function applyStateEffectsToCharacter(char, effects) {
        const state = dependencies.normalizeSurvivalState(char);
        state.energy = dependencies.clamp(state.energy + (effects.energy || 0), 0, 100);
        state.sleep_debt = dependencies.clamp(state.sleep_debt + (effects.sleep_debt || 0), 0, 100);
        state.stress = dependencies.clamp(state.stress + (effects.stress || 0), 0, 100);
        state.social_need = dependencies.clamp(state.social_need + (effects.social_need || 0), 0, 100);
        state.health = dependencies.clamp(state.health + (effects.health || 0), 0, 100);
        state.satiety = dependencies.clamp(state.satiety + (effects.satiety || 0), 0, 100);
        state.stomach_load = dependencies.clamp(state.stomach_load + (effects.stomach_load || 0), 0, 100);
        if (state.stomach_load > 75) {
            state.energy = dependencies.clamp(state.energy - 5, 0, 100);
            state.sleep_debt = dependencies.clamp(state.sleep_debt + 8, 0, 100);
            state.stress = dependencies.clamp(state.stress + 4, 0, 100);
        }
        state.mood = dependencies.clamp(calculateDerivedMood(state) + (effects.mood || 0), 0, 100);
        return state;
    }

function repairUnescapedJsonStringQuotes(text = '') {
        let repaired = '';
        let inString = false;
        let escaped = false;
        const source = String(text || '');
        for (let index = 0; index < source.length; index += 1) {
            const char = source[index];
            if (!inString) {
                if (char === '"') inString = true;
                repaired += char;
                continue;
            }
            if (escaped) {
                repaired += char;
                escaped = false;
                continue;
            }
            if (char === '\\') {
                repaired += char;
                escaped = true;
                continue;
            }
            if (char === '"') {
                let nextIndex = index + 1;
                while (nextIndex < source.length && /\s/.test(source[nextIndex])) nextIndex += 1;
                const nextChar = source[nextIndex] || '';
                if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '') {
                    inString = false;
                    repaired += char;
                } else {
                    repaired += '\\"';
                }
                continue;
            }
            repaired += char;
        }
        return repaired;
    }

function getBehaviorTreeSkeleton() {
        return {
            version: 'single-character-semantic-runtime-v1',
            root: {
                id: 'street_character_root',
                type: 'PrioritySelector',
                children: [
                    {
                        id: 'player_interaction',
                        branch_kind: 'special',
                        priority: 100,
                        trigger: 'player_event.active',
                        note: '玩家靠近点击互动、或在互动里选择回应后，只局部更新这里。',
                        branches: ['greet', 'small_talk', 'ask_current_action', 'suggest_destination', 'treat_food', 'comfort']
                    },
                    {
                        id: 'hard_needs',
                        branch_kind: 'base',
                        priority: 82,
                        trigger: 'runtime_state.need_high',
                        branches: ['base_needs_cafe_snack', 'base_needs_home_rest']
                    },
                    {
                        id: 'routine_goal',
                        branch_kind: 'base',
                        priority: 76,
                        trigger: 'runtime_state.routine_tick',
                        note: '本地默认节奏，不由私聊或商业街活动触发。',
                        branches: ['base_routine_home_agency', 'base_routine_sign_check']
                    },
                    {
                        id: 'place_affordance',
                        branch_kind: 'base',
                        priority: 68,
                        trigger: 'location.has_affordance',
                        branches: ['base_affordance_agency_window', 'base_affordance_cafe_pause']
                    },
                    {
                        id: 'background_mood',
                        branch_kind: 'base',
                        priority: 60,
                        trigger: 'runtime_state.mood_idle',
                        note: '大输入只作背景情绪，不因私聊或商业街活动触发行动。',
                        branches: ['base_background_walk_cafe', 'base_background_slow_down']
                    },
                    {
                        id: 'curiosity',
                        branch_kind: 'base',
                        priority: 52,
                        trigger: 'nearby_place_or_player',
                        branches: ['base_curiosity_player_glance', 'base_curiosity_window_watch']
                    },
                    {
                        id: 'wander',
                        branch_kind: 'base',
                        priority: 36,
                        trigger: 'otherwise',
                        branches: ['base_wander_convenience_cafe', 'base_loop_cafe_front', 'base_patrol_agency_shop']
                    },
                    {
                        id: 'idle_micro',
                        branch_kind: 'base',
                        priority: 20,
                        trigger: 'idle',
                        branches: ['base_idle_watch_street', 'base_idle_turn_pause']
                    }
                ]
            }
        };
    }

function getBehaviorOutputContract(world = {}) {
        const allowedPlaceIds = Array.isArray(world.allowed_place_ids) ? world.allowed_place_ids : [];
        const allowedMovementActions = Array.isArray(world.allowed_movement_actions) && world.allowed_movement_actions.length
            ? world.allowed_movement_actions
            : dependencies.behaviorSemanticMovementActions;
        return {
            type: 'full_behavior_tree_patch_v1',
            allowed_place_ids: allowedPlaceIds,
            allowed_movement_actions: allowedMovementActions,
            schema: {
                patch_id: 'string',
                operation: 'upsert_child',
                target_node_id: '玩家互动必须为 player_interaction；基础自主枝丫是无互动时角色自己的默认行为，只有明确要求改基础树时才使用 hard_needs/routine_goal/place_affordance/background_mood/curiosity/wander/idle_micro',
                next_active_node_id: '本次 patch 合并后立刻执行的 node.id',
                reason: '一两句话说明为什么更新这个枝丫',
                node: {
                    id: 'string，局部枝丫节点 ID',
                    type: 'ActionSequence',
                    title: 'string',
                    priority: '1-100',
                    ttl_ms: '3000-120000',
                    trigger: {
                        player_action: dependencies.behaviorPlayerInteractionActions.join('|'),
                        place_id: 'optional；如果填写，必须来自 allowed_place_ids'
                    },
                    summary: '一两句话说明角色为什么这么反应',
                    steps: [
                        {
                            action: dependencies.behaviorTreeAllowedActions.join('|'),
                            text: 'say/emote/create_memory/relationship_delta 可用；互动枝丫应多用短 say 和 emote 推进角色反应',
                            place_id: 'go_to_place/loop_in_front_of/browse_near/idle_at_place 可用；必须来自 allowed_place_ids',
                            from_place_id: 'wander_between/patrol_segment 可用；必须来自 allowed_place_ids',
                            to_place_id: 'wander_between/patrol_segment/walk_with_player 可用；必须来自 allowed_place_ids',
                            movement_style: '可选：slow、hesitating、window_shopping、patrol、walk_together 等文字风格',
                            duration_ms: 'wait 可用',
                            choices: 'offer_choices 可用，最多 4 个；choice.trigger 应使用玩家互动动作白名单；如果 choice.trigger 是 suggest_destination，choice.place_id 必须填写且必须来自 allowed_place_ids，不能只写“去沙发/去挂画”这种文字'
                        }
                    ]
                },
                memory_delta: '可选：写入小量运行时状态，如 last_player_choice/current_topic/mood_shift'
            },
            allowed_actions: dependencies.behaviorTreeAllowedActions
        };
    }

function getBehaviorBaseOutputContract(world = {}) {
        const allowedPlaceIds = Array.isArray(world.allowed_place_ids) ? world.allowed_place_ids : [];
        const allowedMovementActions = Array.isArray(world.allowed_movement_actions) && world.allowed_movement_actions.length
            ? world.allowed_movement_actions
            : dependencies.behaviorSemanticMovementActions;
        return {
            type: 'behavior_tree_branch_pack_v1',
            allowed_place_ids: allowedPlaceIds,
            required_anchor_branches: Array.isArray(world.required_anchor_branches) ? world.required_anchor_branches : [],
            anchor_branch_rule: world.anchor_branch_rule || '',
            allowed_movement_actions: allowedMovementActions,
            target_node_ids: Array.from(dependencies.behaviorBasePatchTargetIds),
            schema: {
                base_branches: [
                    {
                        id: 'string，建议以 base_ 开头',
                        target_node_id: 'movement_recovery|hard_needs|routine_goal|place_affordance|background_mood|curiosity|wander|idle_micro',
                        title: '基础：xxx',
                        priority: '1-100',
                        ttl_ms: '3000-120000',
                        trigger: 'runtime_state.travel_failed|runtime_state.need_high|runtime_state.routine_tick|location.has_affordance|runtime_state.mood_idle|nearby_place_or_player|otherwise|idle',
                        summary: '一两句话说明无互动时角色为什么做这件事',
                        steps: [
                            {
                                action: dependencies.behaviorTreeAllowedActions.join('|'),
                                text: 'say/emote 可用；基础枝丫里不要使用 offer_choices；除 movement_recovery 外应至少有一句短 say 或一个 emote',
                                place_id: 'go_to_place/loop_in_front_of/browse_near/idle_at_place 可用；必须来自 allowed_place_ids',
                                from_place_id: 'wander_between/patrol_segment 可用；必须来自 allowed_place_ids',
                                to_place_id: 'wander_between/patrol_segment/walk_with_player 可用；必须来自 allowed_place_ids',
                                movement_style: '可选：slow、window_shopping、patrol、distracted 等文字风格',
                                duration_ms: 'wait/say/emote 可用'
                            }
                        ]
                    }
                ],
                interaction_branches: [
                    {
                        id: 'string，建议以 starter_ 开头',
                        target_node_id: 'player_interaction',
                        title: '互动开场：xxx',
                        priority: '1-100',
                        ttl_ms: '3000-120000',
                        trigger: {
                            player_action: dependencies.behaviorPlayerInteractionActions.join('|'),
                            place_id: 'optional；如果填写，必须来自 allowed_place_ids'
                        },
                        summary: '一两句话说明玩家点击该互动时角色先怎么接住',
                        steps: [
                            {
                                action: dependencies.behaviorTreeAllowedActions.join('|'),
                                text: 'say/emote 可用；第一段开场要短，不要引用私聊当作触发原因；offer_choices 前至少 2 个 say/emote',
                                place_id: '移动或停留可用；必须来自 allowed_place_ids',
                                to_place_id: 'walk_with_player 可用；必须来自 allowed_place_ids',
                                duration_ms: 'wait/say/emote 可用',
                                choices: '最后一步必须 offer_choices，2-4 个后续选项；choice.trigger 使用玩家互动动作白名单；如果 choice.trigger 是 suggest_destination，choice.place_id 必须填写且必须来自 allowed_place_ids，不能只写“去沙发/去挂画”这种文字'
                            }
                        ]
                    }
                ]
            },
            allowed_actions: dependencies.behaviorTreeAllowedActions
        };
    }

function getBehaviorBaseOnlyOutputContract(world = {}) {
        const contract = getBehaviorBaseOutputContract(world);
        return {
            ...contract,
            type: 'behavior_tree_base_branch_pack_v1',
            schema: {
                base_branches: contract.schema.base_branches
            }
        };
    }

function toAllowedBehaviorPlaceId(value, allowedPlaceIdSet) {
        const id = dependencies.limitText(value, 80);
        if (!id || !allowedPlaceIdSet.has(id)) return '';
        return id;
    }

function readBehaviorStepPlaceId(step, keys, allowedPlaceIdSet) {
        for (const key of keys) {
            const id = toAllowedBehaviorPlaceId(step?.[key], allowedPlaceIdSet);
            if (id) return id;
        }
        return '';
    }

function behaviorBranchHasOfferChoices(branch = {}) {
        return Array.isArray(branch.steps)
            && branch.steps.some((step) => step?.action === 'offer_choices' && Array.isArray(step.choices) && step.choices.length > 0);
    }

function collectRecentBehaviorSpecialNodes(behaviorTree = {}) {
        const nodes = behaviorTree?.nodes && typeof behaviorTree.nodes === 'object' ? behaviorTree.nodes : {};
        const playerChildren = new Set(Array.isArray(nodes.player_interaction?.children_ids) ? nodes.player_interaction.children_ids : []);
        const orderedIds = [];
        const pushId = (value) => {
            const id = dependencies.limitText(value, 100);
            if (id && !orderedIds.includes(id)) orderedIds.push(id);
        };
        pushId(behaviorTree.active_node_id);
        (Array.isArray(behaviorTree.patch_history) ? behaviorTree.patch_history : []).forEach((item) => {
            pushId(item?.node_id || item?.nodeId || item?.next_active_node_id || item?.nextActiveNodeId);
        });
        playerChildren.forEach(pushId);
        Object.entries(nodes).forEach(([id, node]) => {
            if (node?.branch_kind === 'special' || node?.branchKind === 'special') pushId(id);
        });
        return orderedIds
            .map((id) => nodes[id])
            .filter((node) => node && Array.isArray(node.steps) && (playerChildren.has(node.id) || node.branch_kind === 'special' || node.branchKind === 'special'))
            .slice(0, 8);
    }

function buildBehaviorIterationRecordsFromTree(behaviorTree = {}) {
        const nodes = behaviorTree?.nodes && typeof behaviorTree.nodes === 'object' ? behaviorTree.nodes : {};
        const patchHistory = Array.isArray(behaviorTree?.patch_history) ? behaviorTree.patch_history : [];
        return patchHistory.slice().reverse().map((item, index) => {
            const nodeId = dependencies.limitText(item?.node_id || item?.nodeId || item?.next_active_node_id || item?.nextActiveNodeId, 80);
            const node = nodeId ? nodes[nodeId] : null;
            const patchId = dependencies.limitText(item?.patch_id || item?.patchId, 100);
            return {
                record_id: patchId || `${nodeId || 'behavior_record'}_${index + 1}`,
                sequence: dependencies.normalizeBehaviorContextInteger(
                    item?.sequence || item?.iteration_sequence || item?.iterationSequence,
                    index + 1,
                    1,
                    1000000
                ),
                created_at: dependencies.limitText(item?.created_at || item?.createdAt, 80),
                source: dependencies.limitText(item?.source || node?.source, 80),
                target_node_id: dependencies.limitText(item?.target_node_id || item?.targetNodeId, 80),
                node_id: nodeId,
                branch_kind: dependencies.limitText(node?.branch_kind || node?.branchKind || (String(item?.target_node_id || '').trim() === 'player_interaction' ? 'special' : 'base'), 40),
                title: dependencies.limitText(item?.title || node?.title || nodeId, 100),
                reason: dependencies.limitText(item?.reason, 180),
                summary: dependencies.limitText(node?.summary || item?.summary, 220),
                trigger: node?.trigger || item?.trigger || '',
                steps: Array.isArray(node?.steps) ? node.steps.map(dependencies.normalizeBehaviorIterationStep).filter(Boolean).slice(0, 10) : []
            };
        }).filter((record) => record.record_id || record.node_id || record.title || record.steps.length);
    }

function resolveBehaviorIterationSummaryCursor(records = [], summaries = [], incomingContext = {}) {
        const explicitCursorId = dependencies.limitText(
            incomingContext.summary_cursor_record_id
            || incomingContext.summaryCursorRecordId
            || '',
            100
        );
        const candidateIds = [
            explicitCursorId,
            ...summaries.slice().reverse().map((summary) => summary?.end_record_id)
        ].map((id) => dependencies.limitText(id, 100)).filter(Boolean);
        for (const recordId of candidateIds) {
            const recordIndex = records.findIndex((record) => record.record_id === recordId);
            if (recordIndex >= 0) {
                const record = records[recordIndex] || {};
                return {
                    record_id: record.record_id,
                    sequence: Number(record.sequence || 0) || 0,
                    index: recordIndex,
                    found: true
                };
            }
        }
        const lastSummary = summaries[summaries.length - 1] || null;
        return {
            record_id: explicitCursorId || lastSummary?.end_record_id || '',
            sequence: 0,
            index: -1,
            found: false
        };
    }

async function summarizeBehaviorIterationBatch(db, char, batch = [], config = {}) {
        const memoryConfig = dependencies.resolveBehaviorSummaryModelConfig(char);
        if (!memoryConfig.endpoint || !memoryConfig.key || !memoryConfig.model) {
            throw dependencies.createCityError('行为树迭代上下文总结失败：未配置记忆/总结小模型，请补全后重试。', 400, true);
        }
        const batchText = batch.map(dependencies.formatBehaviorIterationRecord).join('\n\n---\n\n');
        const summaryPrompt = [
            '请总结下面这一段行为树枝丫迭代记录。',
            '',
            '要求：',
            '- 只总结枝丫迭代事实：玩家选择、角色回应、已出现的台词/动作、开放的后续选项、关系或情绪推进。',
            '- 不要改写成私聊记录；不要新增没有出现过的动机、地点或动作。',
            '- 保留哪些台词/问法已经用过，方便下一轮避免复读。',
            '- 区分日常行为枝丫和玩家互动枝丫。',
            '- 输出纯文本，最高 3000 字，不要 JSON，不要 Markdown 表格。',
            '',
            `[上下文配置] q=${config.q_raw_limit} p=${config.p_summary_threshold}`,
            '',
            '[待总结行为树枝丫原文]',
            batchText
        ].join('\n');
        dependencies.recordCityLlmDebug(db, char, 'input', 'city_behavior_context_summary_update', summaryPrompt, {
            record_count: batch.length,
            q: config.q_raw_limit,
            p: config.p_summary_threshold
        });
        const { content, usage, finishReason } = await dependencies.callLLM({
            endpoint: memoryConfig.endpoint,
            key: memoryConfig.key,
            model: memoryConfig.model,
            messages: [
                { role: 'system', content: '你是行为树迭代上下文总结器。你只输出事实总结，必须保留已用过的互动推进和台词模式。' },
                { role: 'user', content: summaryPrompt }
            ],
            maxTokens: dependencies.BEHAVIOR_CONTEXT_SUMMARY_MAX_TOKENS,
            temperature: 0.1,
            enableCache: true,
            cacheDb: db,
            cacheType: 'city_behavior_context_summary_update',
            cacheTtlMs: 30 * 24 * 60 * 60 * 1000,
            cacheScope: `character:${char.id}`,
            cacheCharacterId: char.id,
            returnUsage: true
        });
        recordCityTokenUsage(db, char.id, 'city_behavior_context_summary_update', usage);
        const summaryText = dependencies.limitText(content, 3000);
        dependencies.recordCityLlmDebug(db, char, 'output', 'city_behavior_context_summary_update', summaryText, {
            usage: usage || null,
            finishReason,
            record_count: batch.length
        });
        if (!summaryText || String(finishReason || '').trim() === 'length') {
            throw dependencies.createCityError('行为树迭代上下文总结失败：小模型输出为空或被截断，请重试。', 502, true);
        }
        return summaryText;
    }

async function buildCompressedBehaviorTreeForInput(db, char, payload = {}) {
        const rawTree = payload.behavior_tree && typeof payload.behavior_tree === 'object' ? payload.behavior_tree : null;
        if (!rawTree) return null;
        const config = dependencies.resolveBehaviorIterationContextConfig(payload, rawTree);
        const incomingContext = rawTree.iteration_context || rawTree.iterationContext || {};
        const records = dependencies.normalizeBehaviorIterationRecords(incomingContext.records || incomingContext.raw_records || incomingContext.rawRecords, rawTree);
        let summaries = dependencies.normalizeBehaviorIterationSummaries(incomingContext.summaries);
        const cursor = resolveBehaviorIterationSummaryCursor(records, summaries, incomingContext);
        let cursorRecordId = cursor.record_id || '';
        let cursorSequence = Number(cursor.sequence || 0) || 0;
        const rawRecords = records.slice(-config.q_raw_limit);
        const overflowRecords = records.slice(0, Math.max(0, records.length - config.q_raw_limit));
        let pendingRecords = cursor.found
            ? (cursor.index >= overflowRecords.length ? [] : overflowRecords.slice(cursor.index + 1))
            : overflowRecords.slice();
        const now = Date.now();
        let summarizedNow = 0;

        try {
            while (pendingRecords.length >= config.p_summary_threshold) {
                const batch = pendingRecords.slice(0, config.p_summary_threshold);
                const summaryText = await summarizeBehaviorIterationBatch(db, char, batch, config);
                const sourceHash = dependencies.crypto.createHash('sha256').update(JSON.stringify({
                    characterId: char.id,
                    q: config.q_raw_limit,
                    p: config.p_summary_threshold,
                    batch: batch.map((record) => [record.record_id, record.sequence, record.title, record.summary, record.steps])
                })).digest('hex');
                const first = batch[0] || {};
                const last = batch[batch.length - 1] || {};
                const summary = {
                    summary_id: `behavior_summary_${last.record_id || now}_${sourceHash.slice(0, 10)}`,
                    start_record_id: first.record_id || '',
                    end_record_id: last.record_id || '',
                    start_sequence: Number(first.sequence || 0),
                    end_sequence: Number(last.sequence || 0),
                    record_count: batch.length,
                    summary_text: summaryText,
                    source_hash: sourceHash,
                    created_at: Date.now()
                };
                summaries.push(summary);
                cursorRecordId = summary.end_record_id;
                cursorSequence = Number(summary.end_sequence || cursorSequence);
                pendingRecords = pendingRecords.slice(batch.length);
                summarizedNow += batch.length;
            }
        } catch (err) {
            if (err?.status) throw err;
            throw dependencies.createCityError(`行为树迭代上下文总结失败，请检查记忆小模型后重试：${err.message || err}`, 502, true);
        }

        summaries = dependencies.normalizeBehaviorIterationSummaries(summaries).slice(-dependencies.BEHAVIOR_CONTEXT_STATE_SUMMARY_LIMIT);
        const promptSummaries = summaries.slice(-dependencies.BEHAVIOR_CONTEXT_MAX_SUMMARIES);
        const compactTree = {
            ...rawTree,
            patch_history: rawRecords.slice().reverse().map((record) => ({
                patch_id: record.record_id,
                sequence: record.sequence,
                node_id: record.node_id,
                target_node_id: record.target_node_id,
                title: record.title,
                source: record.source,
                reason: record.reason,
                created_at: record.created_at
            })),
            iteration_context: {
                config,
                summaries: promptSummaries,
                raw_records: rawRecords,
                pending_count: pendingRecords.length,
                overflow_count: overflowRecords.length,
                summarized_now: summarizedNow,
                rule: '模型实时输入最多读取 3 轮摘要 + q 条枝丫原文；q 窗口外待摘要达到 p 条时先总结。',
                state: {
                    summaries,
                    summary_cursor_record_id: cursorRecordId,
                    last_error: '',
                    last_success_at: summarizedNow > 0 ? Date.now() : (incomingContext?.state?.last_success_at || 0),
                    last_run_at: now
                }
            }
        };
        return compactTree;
    }

function createBehaviorRepeatGrams(normalizedText) {
        const text = String(normalizedText || '');
        const size = text.length >= 18 ? 3 : 2;
        const grams = new Set();
        for (let index = 0; index <= text.length - size; index += 1) {
            grams.add(text.slice(index, index + size));
        }
        return grams;
    }

function getBehaviorRepeatSimilarity(leftText, rightText) {
        const left = dependencies.normalizeBehaviorRepeatText(leftText);
        const right = dependencies.normalizeBehaviorRepeatText(rightText);
        if (left.length < 10 || right.length < 10) return 0;
        if (left === right) return 1;
        if (Math.min(left.length, right.length) >= 14 && (left.includes(right) || right.includes(left))) return 0.94;
        const leftGrams = createBehaviorRepeatGrams(left);
        const rightGrams = createBehaviorRepeatGrams(right);
        if (!leftGrams.size || !rightGrams.size) return 0;
        let overlap = 0;
        leftGrams.forEach((gram) => {
            if (rightGrams.has(gram)) overlap += 1;
        });
        const containment = overlap / Math.min(leftGrams.size, rightGrams.size);
        const jaccard = overlap / (leftGrams.size + rightGrams.size - overlap);
        return Math.max(jaccard, containment * 0.88);
    }

function inferBaseBehaviorTargetNode(triggerValue = '', fallback = 'wander') {
        const trigger = dependencies.limitText(triggerValue, 100);
        if (trigger.includes('travel_failed') || trigger.includes('path_failed') || trigger.includes('movement_recovery')) return 'movement_recovery';
        if (trigger.includes('need') || trigger.includes('hunger') || trigger.includes('energy')) return 'hard_needs';
        if (trigger.includes('routine')) return 'routine_goal';
        if (trigger.includes('affordance') || trigger.includes('location')) return 'place_affordance';
        if (trigger.includes('mood')) return 'background_mood';
        if (trigger.includes('nearby')) return 'curiosity';
        if (trigger === 'idle') return 'idle_micro';
        return fallback;
    }

function collectBehaviorStepPlaceIds(steps = []) {
        if (!Array.isArray(steps)) return [];
        const ids = steps.flatMap((step) => [
            step?.place_id,
            step?.placeId,
            step?.from_place_id,
            step?.fromPlaceId,
            step?.to_place_id,
            step?.toPlaceId,
            step?.target_place_id,
            step?.targetPlaceId
        ]);
        return Array.from(new Set(ids.map((id) => dependencies.limitText(id, 100)).filter(Boolean)));
    }

function summarizeBehaviorCharacter(char) {
        const emotion = dependencies.deriveEmotion(char);
        return {
            id: char.id,
            name: char.name,
            location: char.location || 'home',
            city_status: char.city_status || 'idle',
            wallet: char.wallet ?? 0,
            calories: char.calories ?? 2000,
            energy: char.energy ?? 100,
            mood: char.mood ?? 50,
            stress: char.stress ?? 20,
            social_need: char.social_need ?? 50,
            health: char.health ?? 100,
            emotion_state: emotion.state,
            emotion_label: emotion.label
        };
    }

function summarizeBehaviorCity(db, char) {
        const config = db.city.getConfig();
        const selfLimit = Math.max(1, parseInt(config.city_self_log_limit, 10) || 5);
        const announcementLimit = Math.max(1, parseInt(config.city_announcement_limit, 10) || 5);
        const globalLimit = Math.max(1, parseInt(config.city_global_log_limit, 10) || 5);
        return {
            date: getCityDate(config).toISOString(),
            config_limits: {
                city_self_log_limit: selfLimit,
                city_announcement_limit: announcementLimit,
                city_global_log_limit: globalLimit
            },
            enabled_districts: db.city.getEnabledDistricts?.() || [],
            current_district: db.city.getDistrict?.(char.location) || null,
            recent_self_logs: db.city.getCharacterRecentLogs?.(char.id, selfLimit) || [],
            announcements: db.city.getCityAnnouncements?.(announcementLimit) || [],
            global_logs: db.city.getCityLogs?.(globalLimit) || [],
            active_events: db.city.getActiveEvents?.() || [],
            active_quests: db.city.getActiveQuests?.() || [],
            active_quest_claim: db.city.getCharacterActiveQuestClaim?.(char.id) || null,
            inventory: db.city.getInventory?.(char.id) || []
        };
    }

function inferBehaviorScene(payload = {}, rawWorld = {}) {
        const payloadScene = payload.scene && typeof payload.scene === 'object' ? payload.scene : {};
        const rawScene = rawWorld.scene && typeof rawWorld.scene === 'object' ? rawWorld.scene : {};
        const sceneType = dependencies.limitText(
            payloadScene.type || payloadScene.scene_type || rawWorld.scene_type || rawWorld.sceneType || rawScene.type || '',
            40
        ).toLowerCase();
        const movementModel = dependencies.limitText(rawWorld.movement_model || rawWorld.movementModel || '', 80).toLowerCase();
        const candidatePlaceIds = [];
        const pushPlaceId = (value) => {
            if (Array.isArray(value)) {
                value.forEach(pushPlaceId);
                return;
            }
            if (!value && value !== 0) return;
            const id = dependencies.limitText(value, 120);
            if (id) candidatePlaceIds.push(id);
        };
        const pushPlaceObject = (place) => {
            if (!place || typeof place !== 'object') return;
            pushPlaceId(place.id || place.place_id || place.placeId || place.location_id || place.locationId);
            pushPlaceId(place.location_ids || place.locationIds);
            pushPlaceObject(place.place);
        };
        pushPlaceId(payload?.player_event?.place_id || payload?.player_event?.placeId);
        pushPlaceObject(rawWorld.selected_place || rawWorld.selectedPlace);
        pushPlaceId(rawWorld.allowed_place_ids || rawWorld.allowedPlaceIds);
        (Array.isArray(rawWorld.places_ordered || rawWorld.placesOrdered)
            ? (rawWorld.places_ordered || rawWorld.placesOrdered)
            : (Array.isArray(rawWorld.places) ? rawWorld.places : []))
            .forEach(pushPlaceObject);
        const hasRoomPlaceId = candidatePlaceIds.some((id) => (
            id.startsWith('room-anchor:')
            || id.startsWith('room-point:')
            || id.startsWith('room:')
        ));
        const hasRoomLayout = Boolean(payload.room_layout || payload.roomLayout || payload.ai_layout || payload.aiLayout);
        const isRoom = sceneType === 'room' || movementModel.includes('room') || hasRoomPlaceId || hasRoomLayout;
        if (isRoom) {
            return {
                type: 'room',
                label: dependencies.limitText(payloadScene.label || rawWorld.scene_label || rawWorld.sceneLabel || '居住房间', 80),
                runtime_name: '单角色房间行为运行时 V1',
                input_kind: 'room_behavior_input_v1',
                activity_label: '房间',
                place_table_label: '房间物件/中心站位锚点表',
                world_description: '语义房间，不是商业街，也不是大世界地图',
                movement_model: 'room_semantic_v1',
                movement_rule: '角色只能从 allowed_place_ids 选择当前房间里的物件锚点（家具、装饰、地毯、墙饰、灯）或中心站位锚点，只能从 allowed_movement_actions 选择移动动作；不要决定像素坐标，物件锚点和碰撞由前端执行器本地映射。',
                blocked_context_label: '最近私聊、商业街活动记录、公告任务',
                policy_rule: '读取大输入库作为背景材料，但私聊、商业街活动记录、公告任务不得触发小人移动、发起互动、改变目的地或重写基础枝丫；当前行为只能由玩家在房间里的互动事件或房间本地运行时触发。',
                layout_rule: 'input.room_layout 是当前房间 ASCII、当前物件占格和物件清单，只用于理解室内环境；不要输出物件 PLACE 行，行为树仍按 output_contract 生成 patch 或 base_branches。'
            };
        }
        return {
            type: 'commercial_street',
            label: dependencies.limitText(payloadScene.label || rawWorld.scene_label || rawWorld.sceneLabel || '商业街', 80),
            runtime_name: '单角色街区行为运行时 V1',
            input_kind: 'commercial_street_behavior_input_v1',
            activity_label: '商业街',
            place_table_label: '从左到右的可用建筑表',
            world_description: '语义街区，不是大世界地图',
            movement_model: 'side_scrolling_semantic_v1',
            movement_rule: '角色只能从 allowed_place_ids 选择语义地点，只能从 allowed_movement_actions 选择移动动作；不要决定像素坐标。像素锚点、碰撞和平移移动由前端执行器本地映射。',
            blocked_context_label: '最近私聊、商业街活动记录、公告任务',
            policy_rule: '读取大输入库作为背景材料，但私聊和商业街活动记录不得触发小人移动、发起互动、改变目的地或重写基础枝丫。',
            layout_rule: ''
        };
    }

function summarizeSemanticBehaviorWorld(rawWorld = {}, scene = null) {
        const raw = rawWorld && typeof rawWorld === 'object' ? rawWorld : {};
        const sceneInfo = scene || inferBehaviorScene({}, raw);
        const rawPlaces = Array.isArray(raw.places_ordered || raw.placesOrdered)
            ? (raw.places_ordered || raw.placesOrdered)
            : (Array.isArray(raw.places) ? raw.places : []);
        const placesOrdered = rawPlaces.slice(0, 80).map((place, index) => ({
            order: dependencies.clamp(Number(place?.order) || index + 1, 1, 999),
            id: dependencies.limitText(place?.id || place?.place_id || place?.placeId || '', 80),
            location_id: dependencies.limitText(place?.location_id || place?.locationId || '', 80),
            location_ids: Array.isArray(place?.location_ids || place?.locationIds)
                ? (place.location_ids || place.locationIds).slice(0, 8).map((id) => dependencies.limitText(id, 80)).filter(Boolean)
                : [],
            label: dependencies.limitText(place?.label || place?.name || '', 80),
            kind: dependencies.limitText(place?.kind || place?.type || '', 60),
            actions: Array.isArray(place?.actions) ? place.actions.slice(0, 8).map((action) => dependencies.limitText(action, 40)).filter(Boolean) : [],
            aliases: Array.isArray(place?.aliases) ? place.aliases.slice(0, 8).map((alias) => dependencies.limitText(alias, 40)).filter(Boolean) : []
        })).filter((place) => place.id && place.label);
        const placeIdSet = new Set(placesOrdered.map((place) => place.id));
        let allowedPlaceIds = dependencies.normalizeAllowedBehaviorPlaceIds(raw.allowed_place_ids || raw.allowedPlaceIds);
        if (placeIdSet.size) {
            allowedPlaceIds = allowedPlaceIds.filter((id) => placeIdSet.has(id));
        }
        if (!allowedPlaceIds.length) {
            allowedPlaceIds = placesOrdered.map((place) => place.id).filter(Boolean);
        }
        const allowedPlaceIdSet = new Set(allowedPlaceIds);
        const rawRequiredAnchorBranches = Array.isArray(raw.required_anchor_branches || raw.requiredAnchorBranches)
            ? (raw.required_anchor_branches || raw.requiredAnchorBranches)
            : [];
        const requiredAnchorBranches = rawRequiredAnchorBranches.slice(0, 60).map((place, index) => {
            const id = toAllowedBehaviorPlaceId(place?.place_id || place?.placeId || place?.id || '', allowedPlaceIdSet);
            if (!id || !id.startsWith('room-anchor:')) return null;
            const orderedPlace = placesOrdered.find((item) => item.id === id) || {};
            return {
                order: dependencies.clamp(Number(place?.order) || Number(orderedPlace.order) || index + 1, 1, 999),
                id,
                place_id: id,
                label: dependencies.limitText(place?.label || place?.name || orderedPlace.label || id, 80),
                kind: dependencies.limitText(place?.kind || place?.type || orderedPlace.kind || '房间物件', 60),
                item_id: dependencies.limitText(place?.item_id || place?.itemId || '', 100),
                asset_id: dependencies.limitText(place?.asset_id || place?.assetId || '', 100)
            };
        }).filter(Boolean);
        const rawMovementActions = Array.isArray(raw.allowed_movement_actions || raw.allowedMovementActions)
            ? (raw.allowed_movement_actions || raw.allowedMovementActions)
            : [];
        const allowedMovementActions = rawMovementActions
            .map((action) => {
                const id = dependencies.limitText(action?.id || action, 80);
                if (!dependencies.behaviorSemanticMovementActionSet.has(id)) return null;
                const fallbackAction = dependencies.behaviorSemanticMovementActions.find((item) => item.id === id) || { id, needs: [], description: '' };
                return {
                    id,
                    label: dependencies.limitText(action?.label || fallbackAction.label || id, 40),
                    needs: Array.isArray(action?.needs) ? action.needs.slice(0, 4).map((need) => dependencies.limitText(need, 40)).filter(Boolean) : fallbackAction.needs,
                    description: dependencies.limitText(action?.description || fallbackAction.description || '', 100)
                };
            })
            .filter(Boolean);
        const movementActions = allowedMovementActions.length ? allowedMovementActions : dependencies.behaviorSemanticMovementActions;
        const selectedRaw = raw.selected_place && typeof raw.selected_place === 'object' ? raw.selected_place : null;
        const selectedPlaceId = selectedRaw
            ? toAllowedBehaviorPlaceId(selectedRaw.place_id || selectedRaw.placeId || selectedRaw.id || selectedRaw.place?.id || '', allowedPlaceIdSet)
            : '';
        const selectedPlace = selectedRaw && selectedPlaceId
            ? {
                id: selectedPlaceId,
                label: dependencies.limitText(selectedRaw.label || placesOrdered.find((place) => place.id === selectedPlaceId)?.label || '', 80),
                place_id: selectedPlaceId
            }
            : null;
        const orderedPlaceText = dependencies.limitText(
            raw.ordered_place_text || raw.orderedPlaceText || placesOrdered.map((place) => `${place.order}. ${place.label}`).join(' -> '),
            1200
        );
        return {
            scene_type: sceneInfo.type,
            scene_label: sceneInfo.label,
            movement_model: dependencies.limitText(raw.movement_model || raw.movementModel || sceneInfo.movement_model, 80),
            movement_rule: dependencies.limitText(raw.movement_rule || raw.movementRule || sceneInfo.movement_rule, 500),
            ordered_place_text: orderedPlaceText,
            allowed_place_ids: allowedPlaceIds,
            allowed_movement_actions: movementActions,
            actors: raw.actors || {},
            selected_place: selectedPlace,
            places_ordered: placesOrdered,
            required_anchor_branches: requiredAnchorBranches,
            anchor_branch_rule: dependencies.limitText(
                raw.anchor_branch_rule || raw.anchorBranchRule || (
                    requiredAnchorBranches.length
                        ? '当前每个房间物件锚点（家具、装饰、地毯、墙饰、灯）都必须对应至少一条 target_node_id=place_affordance 的基础枝丫；枝丫步骤必须引用该锚点 place_id。不要为了枝丫挑锚点，要按锚点写枝丫。'
                        : ''
                ),
                500
            ),
            travel_targets: placesOrdered.map((place) => ({ id: place.id, label: place.label })),
            free_activity_options: Array.isArray(raw.free_activity_options || raw.freeActivityOptions)
                ? (raw.free_activity_options || raw.freeActivityOptions).slice(0, 20).map((item) => dependencies.limitText(item, 80)).filter(Boolean)
                : movementActions.map((action) => `${action.id}: ${action.description || action.label}`).slice(0, 20)
        };
    }

async function buildBehaviorInputPackage(userId, db, char, payload = {}) {
        const engineContextWrapper = { getUserDb: dependencies.context.getUserDb, getMemory: dependencies.context.getMemory, userId, forceCityDetail: true };
        const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, char, '', false);
        const userProfile = db.getUserProfile?.() || {};
        const userDisplayName = dependencies.limitText(userProfile.name || payload.user?.name || payload.userName || '', 80) || '用户';
        const rawWorld = payload.world || payload.renderer || {};
        const sceneContext = inferBehaviorScene(payload, rawWorld);
        const world = summarizeSemanticBehaviorWorld(rawWorld, sceneContext);
        const roomLayout = sceneContext.type === 'room'
            ? dependencies.summarizeBehaviorRoomLayout(payload.room_layout || payload.roomLayout || payload.ai_layout || payload.aiLayout || {})
            : null;
        const behaviorTree = await buildCompressedBehaviorTreeForInput(db, char, payload);
        const inputPackage = {
            input_kind: sceneContext.input_kind,
            generated_at: new Date().toISOString(),
            scene_context: sceneContext,
            character: summarizeBehaviorCharacter(char),
            user: {
                id: userId,
                name: userDisplayName
            },
            player_event: payload.player_event || {},
            behavior_tree: behaviorTree,
            recent_special_interactions: dependencies.summarizeRecentBehaviorSpecialInteractions(behaviorTree || {}),
            world,
            ...(roomLayout ? { room_layout: roomLayout } : {}),
            input_policy: {
                large_input_enabled: true,
                private_chat_can_trigger_behavior: false,
                city_activity_can_trigger_behavior: false,
                rule: sceneContext.policy_rule
            },
            large_input: {
                source: 'buildUniversalContext(forceCityDetail=true)',
                usage: 'background_only',
                blocked_triggers: ['private_chat', 'city_activity', 'commercial_street_activity'],
                preamble: universalResult.preamble || '',
                breakdown: universalResult.breakdown || {},
                module_routes: universalResult.moduleRoutes || {},
                anti_repeat_hints: universalResult.antiRepeatHints || null
            },
            output_contract: getBehaviorOutputContract(world)
        };
        return dependencies.personalizeBehaviorPromptValue(inputPackage, userDisplayName);
    }

function buildBehaviorBaseRebuildPayload(payload = {}) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const rawTree = source.behavior_tree && typeof source.behavior_tree === 'object' ? source.behavior_tree : {};
        const incomingContext = rawTree.iteration_context && typeof rawTree.iteration_context === 'object'
            ? rawTree.iteration_context
            : {};
        return {
            ...source,
            behavior_tree: {
                tree_id: dependencies.limitText(rawTree.tree_id || rawTree.treeId || 'street_runtime_single_character', 120),
                schema: dependencies.limitText(rawTree.schema || 'full_behavior_tree_patch_v1', 120),
                version: 1,
                root_id: dependencies.limitText(rawTree.root_id || rawTree.rootId || 'street_character_root', 120),
                active_node_id: '',
                nodes: {},
                memory: {},
                patch_history: [],
                iteration_context: {
                    config: incomingContext.config || {},
                    summaries: [],
                    summary_cursor_record_id: '',
                    records: []
                },
                rebuild_context_reset: true
            }
        };
    }

function cyrb128(str) {
        let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
        for (let i = 0, k; i < str.length; i++) {
            k = str.charCodeAt(i);
            h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
            h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
            h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
            h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
        }
        h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
        h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
        h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
        h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
        return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
    }

function mulberry32(a) {
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

async function simulateCharacter(char, db, userId, districts, config, metabolismRate) {
        let currentCals = Math.max(0, (char.calories ?? 2000) - metabolismRate);
        let currentCityStatus = char.city_status ?? 'idle';
        const cityNowMs = getCityDate(config).getTime();

        if (currentCityStatus === 'medical') {
            const { untilAt } = dependencies.getMedicalStatusTiming(char, cityNowMs);
            if (cityNowMs < untilAt) {
                db.updateCharacter(char.id, { calories: currentCals, city_status: currentCityStatus });
                return;
            }
            currentCityStatus = currentCals < 500 ? 'hungry' : 'idle';
            const releaseMedicalPatch = {
                calories: currentCals,
                city_status: currentCityStatus,
                city_status_started_at: 0,
                city_status_until_at: 0,
                city_medical_last_recovery_at: 0
            };
            db.updateCharacter(char.id, releaseMedicalPatch);
            Object.assign(char, releaseMedicalPatch);
        }

        const emergencyReason = currentCals === 0
            ? '体力归零、极度饥饿到失去意识'
            : dependencies.getEmergencyHospitalReason(char, currentCals);
        if (emergencyReason) {
            try {
                await dependencies.settleEmergencyHospitalTransfer(char, db, userId, currentCals, emergencyReason, config, null, {
                    actionType: currentCals === 0 ? 'STARVE' : 'HOSPITAL'
                });
            } catch (e) {
                console.error(`[City] ${char.name} 急救送医文案生成失败: ${e.message}`);
                const hospitalDistrict = db.city.getDistrict('hospital')
                    || districts.find(d => d.type === 'medical')
                    || null;
                dependencies.logActionParseError(db, userId, char, e, {
                    district: hospitalDistrict,
                    locationLabel: hospitalDistrict?.name || '医院'
                });
            }
            return;
        }

        if (currentCals < 500) currentCityStatus = 'hungry';
        db.updateCharacter(char.id, { calories: currentCals, city_status: currentCityStatus });

        // Busy -> release
        if (['working', 'sleeping', 'eating', 'coma'].includes(currentCityStatus)) {
            const releasePatch = { city_status: currentCals < 500 ? 'hungry' : 'idle' };
            if (currentCityStatus === 'working') {
                const distraction = dependencies.clamp(parseInt(char.work_distraction ?? 0, 10) || 0, 0, 100);
                if (distraction > 0) {
                    const penaltyMoney = Math.min(char.wallet || 0, Math.max(1, Math.ceil(distraction / 6)));
                    releasePatch.wallet = Math.max(0, (char.wallet || 0) - penaltyMoney);
                    releasePatch.stress = dependencies.clamp((char.stress ?? 20) + Math.max(1, Math.ceil(distraction / 10)), 0, 100);
                    releasePatch.mood = dependencies.clamp((char.mood ?? 50) - Math.max(1, Math.ceil(distraction / 12)), 0, 100);
                    const district = db.city.getDistrict(char.location || '');
                    const workLog = await dependencies.buildBusyPenaltyNarration(char, 'work', penaltyMoney, district?.name || char.location || '工作地点', db);
                    if (workLog) {
                        db.city.logAction(char.id, 'WORK_DISTRACT', workLog, 0, -penaltyMoney, char.location || '');
                        dependencies.broadcastCityEvent(userId, char.id, 'WORK_DISTRACT', workLog);
                    }
                }
                releasePatch.work_distraction = 0;
            } else if (currentCityStatus === 'sleeping') {
                const disruption = dependencies.clamp(parseInt(char.sleep_disruption ?? 0, 10) || 0, 0, 100);
                if (disruption > 0) {
                    const extraDebt = Math.max(1, Math.ceil(disruption / 8));
                    releasePatch.sleep_debt = dependencies.clamp((char.sleep_debt ?? 0) + extraDebt, 0, 100);
                    releasePatch.energy = dependencies.clamp((char.energy ?? 100) - Math.max(1, Math.ceil(disruption / 12)), 0, 100);
                    releasePatch.mood = dependencies.clamp((char.mood ?? 50) - Math.max(1, Math.ceil(disruption / 14)), 0, 100);
                    const district = db.city.getDistrict(char.location || '');
                    const sleepLog = await dependencies.buildBusyPenaltyNarration(char, 'sleep', extraDebt, district?.name || char.location || '休息地点', db);
                    if (sleepLog) {
                        db.city.logAction(char.id, 'SLEEP_DISTURB', sleepLog, 0, 0, char.location || '');
                        dependencies.broadcastCityEvent(userId, char.id, 'SLEEP_DISTURB', sleepLog);
                    }
                }
                releasePatch.sleep_disruption = 0;
            }
            db.updateCharacter(char.id, releasePatch);
            return;
        }

        const overflowDistrict = districts.find(d => d.id === 'street')
            || db.city.getDistrict?.('street')
            || districts.find(d => d.type === 'shopping')
            || districts[0]
            || { id: 'street', name: '商业街', emoji: '🎒', type: 'shopping', cal_cost: 2 };
        try {
            const overflowResult = await dependencies.actionService.maybeOrganizeInventoryOverflow?.(
                { ...char, calories: currentCals, city_status: currentCityStatus },
                db,
                userId,
                currentCals,
                config,
                { district: overflowDistrict }
            );
            if (overflowResult?.triggered) {
                console.log(`[City] ${char.name} -> 🎒 背包超重，自动整理到 ${overflowResult.limit || 10} 件`);
                return;
            }
        } catch (e) {
            console.error(`[City] ${char.name} 整理背包生成失败: ${e.message}`);
            dependencies.logActionParseError(db, userId, char, e, {
                district: overflowDistrict,
                locationLabel: overflowDistrict.name || '商业街'
            });
            return;
        }

        // Missing model config -> skip autonomous actions. Passive survival
        // ticks above still run, but city actions require generated intent/logs.
        const activeEvents = db.city.getActiveEvents();
        if (!char.api_endpoint || !char.api_key || !char.model_name) {
            return;
        }

        // Schedule is now generated at the cron loop level (not here)
            // Check if we have a schedule for today
        const schedule = char.is_scheduled !== 0 ? db.city.getTodaySchedule(char.id) : null;
        let targetDistrict = null;
        if (schedule) {
            try {
                const plan = JSON.parse(schedule.schedule_json);
                const currentHour = getCityDate(config).getHours();
                // Find the plan entry closest to now
                let best = null;
                for (const entry of plan) {
                    if (entry.hour <= currentHour) {
                        if (!best || entry.hour > best.hour) best = entry;
                    }
                }
                if (best) {
                    // Prevent repeated actions in the same hour block for high-frequency characters
                    const lastLogs = db.getCityLogs(char.id, 1);
                    if (lastLogs.length > 0) {
                        const lastLog = lastLogs[0];
                        const lastLogDate = new Date(lastLog.timestamp);
                        const cityDate = getCityDate(config);

                        // If they ALREADY did this scheduled action sometime during this exact hour, skip it
                        if (lastLog.action === best.action.toUpperCase() &&
                            lastLogDate.getHours() === cityDate.getHours() &&
                            lastLogDate.getDate() === cityDate.getDate() &&
                            lastLogDate.getMonth() === cityDate.getMonth() &&
                            lastLogDate.getFullYear() === cityDate.getFullYear()) {
                            console.log(`[City] ${char.name} 本小时已完成日程 ${best.action}，转为自由活动`);
                            best = null;
                        }
                    }
                    if (best) {
                        targetDistrict = districts.find(d => d.id === best.action);
                    }
                }
            } catch (e) { /* ignore bad schedule */ }
        }

        const activeQuestClaim = db.city.getCharacterActiveQuestClaim?.(char.id) || null;
        if (activeQuestClaim?.target_district) {
            const questDistrict = districts.find((entry) => entry.id === activeQuestClaim.target_district);
            if (questDistrict) {
                targetDistrict = questDistrict;
            }
        }

        if (targetDistrict) {
            console.log(`[City] ${char.name} 📅 按日程前往 ${targetDistrict.emoji} ${targetDistrict.name} (准备生成文案)`);
        }

        // LLM decision with inventory awareness + active event context
        const inventory = db.city.getInventory(char.id);
        const engineContextWrapper = { getUserDb: dependencies.context.getUserDb, getMemory: dependencies.context.getMemory, userId, forceCityDetail: true };
        const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, char, '', false);
        const lastQuestReview = activeQuestClaim ? db.city.getLatestQuestProgressReviewForClaim?.(activeQuestClaim, char.id) : null;
        const recentQuestReviews = activeQuestClaim ? db.city.getRecentQuestProgressReviewsForClaim?.(activeQuestClaim, char.id, 4) || [] : [];
        const questContext = dependencies.buildQuestPromptContext(db.city.getActiveQuests(), activeQuestClaim, lastQuestReview, recentQuestReviews);
        const prompt = dependencies.buildSurvivalPrompt(districts, { ...char, calories: currentCals }, inventory, activeEvents, universalResult, targetDistrict, questContext, db);
        let actionDistrict = targetDistrict || null;
        try {
            const messages = [
                { role: 'system', content: `你是一个城市生活模拟角色行动引擎。你必须严格按照用户要求返回完整 JSON 对象，不要输出 JSON 之外的解释、markdown 或额外文本。返回结果必须包含 action、log、chat、diary 四个字段。\n\n${universalResult.systemGuidance}` },
                { role: 'user', content: prompt }
            ];
            dependencies.recordCityLlmDebug(db, char, 'input', 'city_action_decision', messages, { model: char.model_name, location: char.location || '', status: currentCityStatus });
            const reply = await dependencies.callLLM({
                endpoint: char.api_endpoint, key: char.api_key, model: char.model_name,
                messages, maxTokens: 3000, temperature: 0.8,
                debugAttempt: buildCityAttemptRecorder(db, char, 'city_action_decision', {
                    location: char.location || '',
                    status: currentCityStatus
                })
            });
            dependencies.recordCityLlmDebug(db, char, 'output', 'city_action_decision', reply, { model: char.model_name, location: char.location || '', status: currentCityStatus });
            const richNarrations = dependencies.parseCityActionNarrations(reply);
            if (!richNarrations || typeof richNarrations !== 'object' || Array.isArray(richNarrations)) {
                throw new Error('商业街行动生成失败：JSON 结构无效，请重试。');
            }
            const codeMatch = String(richNarrations.action || '').match(/^\[([A-Z_]+)\]$/)?.[1]?.toLowerCase();
            if (!codeMatch) {
                throw new Error('商业街行动生成失败：缺少有效 action 标签，请重试。');
            }
            const generatedLog = String(richNarrations.log || '').trim();
            if (!generatedLog) {
                throw new Error('商业街行动生成失败：缺少可用 log，请重试。');
            }

            // Handle EAT_ITEM action
            if (codeMatch === 'eat_item') {
                const foodItems = db.city.getInventoryFoodItems(char.id);
                if (!foodItems.length) throw new Error('商业街行动生成失败：模型选择 EAT_ITEM，但背包没有可食用物品，请重试。');
                const food = foodItems[0];
                db.city.removeFromInventory(char.id, food.item_id, 1);
                const newCals = Math.min(4000, currentCals + food.cal_restore);
                const satietyBoost = dependencies.clamp(Math.round((food.cal_restore || 0) / 18), 8, 28);
                const loadBoost = dependencies.clamp(Math.round((food.cal_restore || 0) / 24), 6, 22);
                const eatItemState = applyStateEffectsToCharacter(char, {
                    energy: 8,
                    stress: -4,
                    mood: 3,
                    health: 1,
                    satiety: satietyBoost,
                    stomach_load: loadBoost,
                    sleep_debt: Math.round(loadBoost * 0.6)
                });
                const eatItemPatch = { calories: newCals, city_status: newCals > 500 ? 'idle' : 'hungry', ...eatItemState };
                db.updateCharacter(char.id, eatItemPatch);
                logEmotionTransitionToState(
                    db,
                    char,
                    { ...char, ...eatItemPatch },
                    'city_eat_item',
                    `角色主动吃了背包中的 ${food.name}，生理状态和主情绪发生变化。`
                );
                const eatLog = generatedLog;
                db.city.logAction(char.id, 'EAT', eatLog, food.cal_restore, 0);
                dependencies.broadcastCityEvent(userId, char.id, 'EAT', eatLog);
                dependencies.broadcastCityToChat(userId, char, eatLog, 'EAT', richNarrations);
                console.log(`[City] ${char.name} -> 🍜 吃 ${food.name}`);
                return;
            }

            if (codeMatch === 'organize_bag') {
                const organizeDistrict = targetDistrict
                    || db.city.getDistrict?.(char.location || '')
                    || districts.find(d => d.id === 'street')
                    || districts[0]
                    || { id: 'street', name: '商业街', emoji: '🎒', type: 'shopping', cal_cost: 2 };
                const organizeState = typeof db.city.getInventoryCapacityState === 'function'
                    ? db.city.getInventoryCapacityState(char.id)
                    : null;
                await dependencies.actionService.organizeInventoryAction(char, db, userId, currentCals, config, richNarrations, {
                    district: organizeDistrict,
                    requireGeneratedNarration: true,
                    requireKeepDecision: !!organizeState?.over_limit
                });
                console.log(`[City] ${char.name} -> 🎒 整理背包`);
                return;
            }

            const district = districts.find(d => d.id === codeMatch);
            if (!district) {
                throw new Error(`商业街行动生成失败：action 不在可选地点中 (${codeMatch})，请重试。`);
            }
            actionDistrict = district;

            const postChoiceEmergencyReason = dependencies.getEmergencyHospitalReason(char, currentCals, district);
            if (postChoiceEmergencyReason) {
                console.log(`[City] ${char.name} 🚑 状态透支，${district.name} 行动改为急救送医`);
                await dependencies.settleEmergencyHospitalTransfer(char, db, userId, currentCals, postChoiceEmergencyReason, config, district);
                return;
            }

            // Schedule adherence tracking
            if (schedule) {
                try {
                    const plan = JSON.parse(schedule.schedule_json);
                    const currentHour = getCityDate(config).getHours();
                    let scheduleChanged = false;

                    // Mark missed tasks
                    for (const entry of plan) {
                        if (entry.hour < currentHour && !entry.status) {
                            entry.status = 'missed';
                            scheduleChanged = true;
                        }
                    }

                    // Check if current action matches the designated schedule for this hour
                    const currentPlan = plan.find(e => e.hour === currentHour);
                    if (currentPlan && !currentPlan.status) {
                        if (currentPlan.action === district.id) {
                            currentPlan.status = 'completed';
                        } else {
                            currentPlan.status = 'missed';
                        }
                        scheduleChanged = true;
                    }

                    if (scheduleChanged) {
                        db.city.saveSchedule(char.id, getCityDate(config).toISOString().split('T')[0], plan);
                    }
                } catch (e) { /* ignore tracking error */ }
            }

            console.log(`[City] ${char.name} -> ${district.emoji} ${district.name}`);
            await applyDecision(district, char, db, userId, currentCals, config, activeEvents, richNarrations, { preserveDirectedDistrict: true });
        } catch (e) {
            console.error(`[City] ${char.name} LLM 失败: ${e.message}`);
            if (!actionDistrict && char.location) {
                actionDistrict = db.city.getDistrict(char.location)
                    || districts.find((district) => String(district.id || '').toLowerCase() === String(char.location || '').toLowerCase())
                    || null;
            }
            dependencies.logActionParseError(db, userId, char, e, {
                district: actionDistrict || null,
                locationLabel: char.location || ''
            });
            return;
        }
    }

function selectRandomDistrict(districts, char) {
        const cals = char.calories ?? 2000, wallet = char.wallet ?? 200;
        const state = dependencies.normalizeSurvivalState(char);
        const emotionState = dependencies.deriveEmotion(char).state;
        const physicalState = dependencies.derivePhysicalState(char).state;
        if (cals < dependencies.EMERGENCY_HUNGER_CALORIES || state.energy < dependencies.EMERGENCY_EXHAUSTION_ENERGY || state.sleep_debt > dependencies.EMERGENCY_SLEEP_DEBT) {
            return districts.find(d => d.type === 'medical')
                || districts.find(d => d.id === 'hospital')
                || districts[0];
        }
        if (cals < 500 && wallet >= 15) return districts.find(d => d.type === 'food') || districts[0];
        if (state.energy < 20) {
            return districts.find(d => d.type === 'rest')
                || districts.find(d => d.type === 'food')
                || districts[0];
        }
        if (state.energy < 35) return districts.find(d => d.type === 'rest') || districts[0];
        if (state.health < 35) return districts.find(d => d.type === 'medical') || districts[0];
        if (physicalState === 'unwell' || physicalState === 'severe_unwell') return districts.find(d => d.type === 'medical') || districts.find(d => d.type === 'rest') || districts[0];
        if (physicalState === 'sleepy' || physicalState === 'fatigued') return districts.find(d => d.type === 'rest') || districts[0];
        if (emotionState === 'hurt' || emotionState === 'sad') {
            return districts.find(d => d.type === 'rest')
                || districts.find(d => d.type === 'leisure')
                || districts.find(d => d.type === 'wander')
                || districts[0];
        }
        if (emotionState === 'lonely') {
            return districts.find(d => d.type === 'leisure')
                || districts.find(d => d.type === 'wander')
                || districts[0];
        }
        if (emotionState === 'angry' || emotionState === 'tense') {
            return districts.find(d => d.type === 'wander')
                || districts.find(d => d.type === 'leisure')
                || districts.find(d => d.type === 'work')
                || districts[0];
        }
        if (emotionState === 'happy') {
            return districts.find(d => d.type === 'leisure')
                || districts.find(d => d.type === 'wander')
                || districts.find(d => d.type === 'work')
                || districts[0];
        }
        if (emotionState === 'jealous') {
            return districts.find(d => d.type === 'leisure')
                || districts.find(d => d.type === 'wander')
                || districts.find(d => d.type === 'work')
                || districts[0];
        }
        if (state.social_need > 75 && state.mood < 45) return districts.find(d => d.type === 'leisure' || d.type === 'wander') || districts[0];
        if (state.energy > 85) {
            return districts.find(d => d.type === 'leisure')
                || districts.find(d => d.type === 'wander')
                || districts.find(d => d.type === 'work')
                || districts[0];
        }
        if (state.energy > 70) {
            return districts.find(d => d.type === 'wander')
                || districts.find(d => d.type === 'leisure')
                || districts.find(d => d.type === 'work')
                || districts[0];
        }
        if (wallet < 30) return districts.find(d => d.type === 'work') || districts[0];
        return districts[Math.floor(Math.random() * districts.length)];
    }

async function applyDecision(district, char, db, userId, currentCals, config, activeEvents, richNarrations = null, options = {}) {
        return dependencies.actionService.applyDecision(district, char, db, userId, currentCals, config, activeEvents, richNarrations, options);
    }

function publishQuestAnnouncement(db, questId, questData = {}) {
        try {
            const quest = db.city.getQuestById ? db.city.getQuestById(questId) : null;
            const targetDistrictId = quest?.target_district || questData.target_district || 'street';
            const targetDistrict = db.city.getDistrict(targetDistrictId);
            const locationLabel = targetDistrict ? `${targetDistrict.emoji}${targetDistrict.name}` : targetDistrictId;
            const rewardText = `${Number(quest?.reward_gold ?? questData.reward_gold ?? 0)}金币${Number(quest?.reward_cal ?? questData.reward_cal ?? 0) > 0 ? ` + ${Number(quest?.reward_cal ?? questData.reward_cal ?? 0)}体力` : ''}`;
            const content = `${quest?.emoji || questData.emoji || '📜'} ${quest?.title || questData.title || '悬赏任务'}｜前往 ${locationLabel} 处理：${quest?.description || questData.description || '待处理事项'}｜奖励：${rewardText}`;
            const announcementId = db.city.addCityAnnouncement('system', '悬赏任务', content, targetDistrictId);
            if (announcementId && typeof db.city.attachQuestAnnouncement === 'function') {
                db.city.attachQuestAnnouncement(questId, announcementId);
            }
            return announcementId;
        } catch (e) {
            console.warn('[City Quest] Failed to publish quest announcement:', e.message);
            return 0;
        }
    }

function recordMayorAnnouncement(db, title, content) {
        if (!content || !String(content).trim()) return;
        try {
            if (typeof db.city.addCityAnnouncement === 'function') {
                db.city.addCityAnnouncement('mayor', title || '市长广播', String(content).trim(), 'street');
            }
        } catch (e) {
            console.warn('[Mayor AI] Failed to write city announcement:', e.message);
        }
    }

async function planCityWebSearchQuery(db, char, district, intent, baseLog) {
        const endpoint = String(char.memory_api_endpoint || char.api_endpoint || '').trim();
        const key = String(char.memory_api_key || char.api_key || '').trim();
        const model = String(char.memory_model_name || char.model_name || '').trim();
        if (!endpoint || !key || !model) throw new Error('联网查询规划缺少模型配置，请重试。');
        const prompt = [
            '你是商业街联网查询规划器，只负责把角色的查询意图变成搜索关键词。',
            '不要角色扮演，不要写活动文本，只返回 JSON。',
            '',
            `[角色] ${char.name}`,
            `[地点] ${district?.emoji || ''}${district?.name || district?.id || ''} / ${district?.type || ''}`,
            `[刚刚的商业街行动] ${baseLog || ''}`,
            `[角色想查的原因] ${intent?.reason || ''}`,
            `[查询提示] ${intent?.query_hint || ''}`,
            '',
            '返回 JSON：',
            '{ "queries": ["一个简洁搜索词", "可选第二个搜索词"], "provider": "auto" }'
        ].join('\n');
        const messages = [
            { role: 'system', content: '你只返回合法 JSON 对象，不要输出 markdown 或解释。' },
            { role: 'user', content: prompt }
        ];
        try {
            dependencies.recordCityLlmDebug(db, char, 'input', 'city_web_query_plan', messages, { model, location: district?.id || '' });
            const reply = await dependencies.callLLM({
                endpoint,
                key,
                model,
                messages,
                maxTokens: 1000,
                temperature: 0,
                debugAttempt: buildCityAttemptRecorder(db, char, 'city_web_query_plan', { location: district?.id || '' })
            });
            dependencies.recordCityLlmDebug(db, char, 'output', 'city_web_query_plan', reply, { model, location: district?.id || '' });
            const cleaned = String(reply || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
            if (!cleaned) throw new Error('联网查询规划没有返回 JSON，请重试。');
            const parsed = JSON.parse(cleaned);
            const queries = (Array.isArray(parsed.queries) ? parsed.queries : [])
                .map(item => String(item || '').trim())
                .filter(Boolean)
                .slice(0, 2);
            if (!queries.length) throw new Error('联网查询规划缺少可用查询词，请重试。');
            return {
                queries,
                provider: String(parsed.provider || 'auto').trim() || 'auto'
            };
        } catch (e) {
            console.warn(`[City/Web] 查询规划失败 ${char.name}: ${e.message}`);
            throw e;
        }
    }

function resolveMayorAiCharacter(db) {
        return dependencies.mayorService.resolveMayorAiCharacter(db);
    }

function getQuestDifficultyFallbackTarget(questLike = {}) {
        return dependencies.mayorService.getQuestDifficultyFallbackTarget(questLike);
    }

async function scoreQuestDifficultyWithMayor(db, questDraft = {}, aiChar = null) {
        return dependencies.mayorService.scoreQuestDifficultyWithMayor(db, questDraft, aiChar);
    }

async function scoreQuestProgressWithMayor(db, char, quest, claim, district, richNarrations = null, options = {}) {
        return dependencies.mayorService.scoreQuestProgressWithMayor(db, char, quest, claim, district, richNarrations, options);
    }

function shouldAutoRunMayor(db, now = Date.now()) {
        return dependencies.mayorRuntimeService.shouldAutoRunMayor(db, now);
    }

async function maybeRunMayorAI(db, runKey, { force = false } = {}) {
        return dependencies.mayorRuntimeService.maybeRunMayorAI(db, runKey, { force });
    }

async function runMayorAI(db) {
        return dependencies.mayorRuntimeService.runMayorAI(db);
    }

async function applyMayorDecisions(db, decision, aiChar = null) {
        return dependencies.mayorService.applyMayorDecisions(db, decision, aiChar);
    }

    return { recordCityTokenUsage, logEmotionTransition, logEmotionTransitionToState, slugifyCityId, inferItemCategory, getCityDate, getDistrictAliasValues, resolveStructuredTypeAlias, selectPreferredRestDistrict, buildCollapsedCityLog, isCollapsedCityLog, findCityLogForOutreach, calculateDerivedMood, getAvailableDistrictItems, getInventoryQuantityTotal, isHackerDistrict, buildCityAttemptRecorder, clipHackerIntelContent, buildHackerIntelAppendix, resolveDistrictFromStructuredSignal, getDistrictStateEffects, applyStateEffectsToCharacter, repairUnescapedJsonStringQuotes, getBehaviorTreeSkeleton, getBehaviorOutputContract, getBehaviorBaseOutputContract, getBehaviorBaseOnlyOutputContract, toAllowedBehaviorPlaceId, readBehaviorStepPlaceId, behaviorBranchHasOfferChoices, collectRecentBehaviorSpecialNodes, buildBehaviorIterationRecordsFromTree, resolveBehaviorIterationSummaryCursor, summarizeBehaviorIterationBatch, buildCompressedBehaviorTreeForInput, createBehaviorRepeatGrams, getBehaviorRepeatSimilarity, inferBaseBehaviorTargetNode, collectBehaviorStepPlaceIds, summarizeBehaviorCharacter, summarizeBehaviorCity, inferBehaviorScene, summarizeSemanticBehaviorWorld, buildBehaviorInputPackage, buildBehaviorBaseRebuildPayload, cyrb128, mulberry32, simulateCharacter, selectRandomDistrict, applyDecision, publishQuestAnnouncement, recordMayorAnnouncement, planCityWebSearchQuery, resolveMayorAiCharacter, getQuestDifficultyFallbackTarget, scoreQuestDifficultyWithMayor, scoreQuestProgressWithMayor, shouldAutoRunMayor, maybeRunMayorAI, runMayorAI, applyMayorDecisions };
}

module.exports = { createModule };
