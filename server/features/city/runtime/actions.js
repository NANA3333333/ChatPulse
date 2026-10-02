// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function maybeTriggerSuggestedCityAction(userId, characterId, content, sourceLabel = '私聊') {
        const db = dependencies.ensureCityDb(dependencies.context.getUserDb(userId));
        const config = db.city.getConfig();
        if (config.dlc_enabled === '0' || config.dlc_enabled === 'false') return { triggered: false, reason: 'city_paused' };

        const char = db.getCharacter(characterId);
        if (!char || char.status !== 'active' || char.sys_survival === 0) return { triggered: false, reason: 'character_inactive' };

        const districts = db.city.getEnabledDistricts();
        const candidates = dependencies.parseSuggestedDistrictCandidates(content, districts);
        if (candidates.length === 0) return { triggered: false, reason: 'no_candidate' };

        const suggestionPrompt = `你是 ${char.name}。下面是用户在${sourceLabel}里对你说的话：
「${content}」

候选商业街行动：
${candidates.map(d => `- ${d.id}: ${d.emoji} ${d.name} (${d.type})`).join('\n')}

你要判断：用户是不是在明确要求/建议你立刻去做其中某件事；以及以你当前状态和性格，会不会答应并马上去做。

当前状态：
- 地点: ${char.location || 'home'}
- 体力: ${char.calories ?? 2000}
- 金币: ${char.wallet ?? 200}
- 精力: ${char.energy ?? 100}
- 睡眠债: ${char.sleep_debt ?? 0}
- 压力: ${char.stress ?? 20}
- 健康: ${char.health ?? 100}

严格返回 JSON：
{
  "accept": true,
  "district_id": "factory",
  "reason": "为什么接受或拒绝，简短",
  "log": "如果接受，自然描述你立刻去做这件事；如果拒绝则留空"
}

如果不是明确建议，或者你不会立刻去做，就返回 {"accept":false,"district_id":"","reason":"...", "log":""}。`;

        let decision = null;
        if (char.api_endpoint && char.api_key && char.model_name) {
            try {
                const messages = [
                    { role: 'system', content: '你只返回 JSON，不要输出任何额外文字。' },
                    { role: 'user', content: suggestionPrompt }
                ];
                dependencies.recordCityLlmDebug(db, char, 'input', 'city_suggestion_action', messages, { model: char.model_name, sourceLabel });
                const reply = await dependencies.callLLM({
                    endpoint: char.api_endpoint,
                    key: char.api_key,
                    model: char.model_name,
                    messages,
                    maxTokens: 3000,
                    temperature: 0.4
                });
                dependencies.recordCityLlmDebug(db, char, 'output', 'city_suggestion_action', reply, { model: char.model_name, sourceLabel });
                decision = dependencies.tryParseCityActionReply(reply);
            } catch (err) {
                return { triggered: false, reason: err.message, canRetry: true };
            }
        } else {
            return { triggered: false, reason: 'missing_model_config', canRetry: true };
        }

        if (!decision?.accept || !decision?.district_id) return { triggered: false, reason: decision?.reason || 'rejected' };

        const district = candidates.find(d => d.id === decision.district_id);
        if (!district) return { triggered: false, reason: 'district_not_found' };
        const log = String(decision.log || '').trim();
        if (!log) return { triggered: false, reason: 'missing_log', canRetry: true };

        const activeEvents = db.city.getActiveEvents();
        const currentCals = char.calories ?? 2000;
        const narrations = {
            log,
            chat: '',
            diary: ''
        };
        await dependencies.applyDecision(district, char, db, userId, currentCals, config, activeEvents, narrations, { preserveDirectedDistrict: true });
        return { triggered: true, districtId: district.id, reason: decision.reason || '' };
    }

function resolveCityIntentDistrict(intent, districts) {
        const raw = String(intent || '').trim().toLowerCase();
        if (!raw) return null;

        const rankedMatches = dependencies.rankDistrictsFromText(raw, districts);
        if (rankedMatches.length > 0 && rankedMatches[0].score >= 70) {
            return rankedMatches[0].district;
        }

        if (/(home|回家|到家|回住所|回寝室|回宿舍|回公寓)/.test(raw)) {
            return dependencies.selectPreferredRestDistrict(districts, true);
        }
        if (/(rest|sleep|sleeping|睡|休息|补觉|躺下|在家躺|回去睡)/.test(raw)) {
            return dependencies.selectPreferredRestDistrict(districts, false);
        }
        if (/(food|eat|restaurant|meal|吃|饭|餐馆|便利店)/.test(raw)) {
            return rankedMatches.find(entry => String(entry.district?.type || '').toLowerCase() === 'food')?.district
                || districts.find(d => d.id === 'restaurant')
                || districts.find(d => d.type === 'food')
                || districts.find(d => d.id === 'convenience')
                || null;
        }
        if (/(work|factory|job|赚钱|工作|打工|上班|工厂)/.test(raw)) {
            return rankedMatches.find(entry => String(entry.district?.type || '').toLowerCase() === 'work')?.district
                || districts.find(d => d.id === 'factory') || districts.find(d => d.type === 'work') || null;
        }
        if (/(hospital|medical|doctor|医院|看病|治疗)/.test(raw)) {
            return districts.find(d => d.id === 'hospital') || districts.find(d => d.type === 'medical') || null;
        }
        if (/(park|leisure|散步|公园|放松)/.test(raw)) {
            return rankedMatches.find(entry => String(entry.district?.type || '').toLowerCase() === 'leisure')?.district
                || districts.find(d => d.id === 'park') || districts.find(d => d.type === 'leisure') || null;
        }
        if (/(wander|street|闲逛|逛逛|街上)/.test(raw)) {
            return rankedMatches.find(entry => String(entry.district?.type || '').toLowerCase() === 'wander')?.district
                || districts.find(d => d.id === 'street') || districts.find(d => d.type === 'wander') || null;
        }
        if (/(mall|shopping|购物|商场)/.test(raw)) {
            return districts.find(d => d.id === 'mall') || districts.find(d => d.type === 'shopping') || null;
        }
        if (/(school|education|study|学习|上课)/.test(raw)) {
            return districts.find(d => d.type === 'education') || null;
        }
        if (/(casino|gambling|赌)/.test(raw)) {
            return districts.find(d => d.id === 'casino') || districts.find(d => d.type === 'gambling') || null;
        }

        return null;
    }

function getBehaviorInteractionStarterOutputContract(world = {}) {
        const contract = dependencies.getBehaviorBaseOutputContract(world);
        return {
            ...contract,
            type: 'behavior_tree_interaction_starter_pack_v1',
            target_node_ids: ['player_interaction'],
            schema: {
                interaction_branches: contract.schema.interaction_branches
            }
        };
    }

function summarizeRecentBehaviorSpecialInteractions(behaviorTree = {}) {
        return dependencies.collectRecentBehaviorSpecialNodes(behaviorTree).slice(0, 6).map((node) => ({
            node_id: dependencies.limitText(node.id, 80),
            title: dependencies.limitText(node.title, 80),
            summary: dependencies.limitText(node.summary, 180),
            texts: dependencies.collectBehaviorNodeRepeatTexts(node).map((entry) => entry.text).slice(0, 6)
        }));
    }

function findDuplicateBehaviorInteraction(treePatch, inputPackage = {}) {
        const node = treePatch?.node;
        if (!node || node.branch_kind !== 'special') return null;
        const behaviorTree = inputPackage?.behavior_tree && typeof inputPackage.behavior_tree === 'object' ? inputPackage.behavior_tree : {};
        const existingNodes = behaviorTree.nodes && typeof behaviorTree.nodes === 'object' ? behaviorTree.nodes : {};
        if (existingNodes[node.id]) {
            return { reason: 'duplicate_node_id', node_id: node.id };
        }
        const generatedTexts = dependencies.collectBehaviorNodeRepeatTexts(node).filter((entry) => entry.kind !== 'title' && entry.kind !== 'summary');
        if (!generatedTexts.length) return null;
        const recentEntries = dependencies.collectRecentBehaviorSpecialNodes(behaviorTree)
            .flatMap((recentNode) => dependencies.collectBehaviorNodeRepeatTexts(recentNode)
                .filter((entry) => entry.kind !== 'title' && entry.kind !== 'summary')
                .map((entry) => ({
                    ...entry,
                    node_id: recentNode.id,
                    title: recentNode.title || ''
                })));
        for (const generated of generatedTexts) {
            const duplicate = recentEntries.find((entry) => dependencies.getBehaviorRepeatSimilarity(generated.normalized, entry.normalized) >= 0.82);
            if (duplicate) {
                return {
                    reason: 'duplicate_text',
                    text: generated.text,
                    previous_node_id: duplicate.node_id,
                    previous_title: duplicate.title
                };
            }
        }
        return null;
    }

function readBehaviorInteractionStarterAction(rawBranch = {}) {
        const rawTrigger = rawBranch.trigger && typeof rawBranch.trigger === 'object' ? rawBranch.trigger : {};
        return [
            rawTrigger.player_action,
            rawTrigger.playerAction,
            rawBranch.player_action,
            rawBranch.playerAction,
            rawBranch.action_id,
            rawBranch.actionId,
            rawBranch.trigger_id,
            rawBranch.triggerId,
            rawBranch.action
        ]
            .map((value) => dependencies.limitText(value, 80))
            .find((value) => dependencies.behaviorPlayerInteractionActionSet.has(value)) || '';
    }

function getActionMinutesForHour(charId, hourString, frequency) {
        if (frequency <= 0) return [];
        let r = Math.min(60, frequency);

        // Use Character ID + Time String as a fixed seed for this specific hour
        // Example hourString: "2024-03-05T14"
        const seedValue = dependencies.cyrb128(`${charId}::${hourString}`);
        const rng = dependencies.mulberry32(seedValue);

        const possibleMinutes = Array.from({ length: 60 }, (_, i) => i);
        const selectedMinutes = [];

        // Fisher-Yates shuffle with our seeded PRNG to pick 'r' unique minutes
        for (let i = 0; i < r; i++) {
            const randIndex = Math.floor(rng() * possibleMinutes.length);
            selectedMinutes.push(possibleMinutes[randIndex]);
            possibleMinutes.splice(randIndex, 1);
        }

        return selectedMinutes.sort((a, b) => a - b);
    }

async function handleQuestLifecycleAfterAction(db, char, district, richNarrations = null, options = {}) {
        return dependencies.questService.handleQuestLifecycleAfterAction(db, char, district, richNarrations, options);
    }

async function maybeRunCityWebSearchActivity({ db, userId, char, district, config, baseLog }) {
        if (!char?.api_endpoint || !char?.api_key || !char?.model_name) return null;
        const status = String(char.city_status || '').trim();
        if (status === 'coma' || status === 'sleeping' || district?.type === 'medical') return null;
        const locationLabel = `${district?.emoji || ''}${district?.name || district?.id || '商业街'}`.trim();
        const prePrompt = [
            `你是 ${char.name}，正在 ${locationLabel}。`,
            '这是一段可选的商业街生活插曲：是否查网页完全由你按角色性格、当前场景和刚刚发生的行动判断。',
            '可以像真人一样掏手机查资料、比价、看攻略、确认新闻、刷八卦；也可以觉得没必要，继续做眼前的事。',
            '',
            `[刚刚发生的商业街行动] ${baseLog || ''}`,
            `[当前状态] 钱包=${char.wallet ?? 0} 体力=${char.calories ?? 0} 压力=${char.stress ?? 50} 心情=${char.mood ?? 50} 状态=${status || 'idle'}`,
            district?.type === 'work' ? '[工作风险] 你现在处在工作相关地点。如果查的不是工作正事，就会像摸鱼，后续可能被发现并受到惩罚；除非诱因、性格或情绪足够强，否则可以输出 NO_WEB。' : '',
            '',
            '请按角色性格和当前场景判断你此刻会不会自然想查一下网页。',
            '如果你觉得这段活动需要额外联网内容来增强真实感或后续输出质量，输出一段商业街活动文本，描述你查之前的动作、想法和查询方向，并在末尾带标签：',
            '[WEB_SEARCH_INTENT:{"reason":"为什么想查","query_hint":"搜索关键词方向"}]',
            '如果不会，只输出 NO_WEB。',
            '不要解释系统，不要提 API、key、后端。'
        ].filter(Boolean).join('\n');
        const preMessages = [
            { role: 'system', content: '你是商业街生活模拟器。联网是可选的角色行为；只有当你决定角色会查网页时，才在活动文本末尾附带 WEB_SEARCH_INTENT 标签。' },
            { role: 'user', content: prePrompt }
        ];
        dependencies.recordCityLlmDebug(db, char, 'input', 'city_web_search_pre_activity', preMessages, { model: char.model_name, location: district?.id || '' });
        const preReply = await dependencies.callLLM({
            endpoint: char.api_endpoint,
            key: char.api_key,
            model: char.model_name,
            messages: preMessages,
            maxTokens: 10000,
            temperature: 0.8,
            debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_web_search_pre_activity', { location: district?.id || '' })
        });
        dependencies.recordCityLlmDebug(db, char, 'output', 'city_web_search_pre_activity', preReply, { model: char.model_name, location: district?.id || '' });
        if (/^\s*NO_WEB\s*$/i.test(String(preReply || '').trim())) return null;
        const intent = dependencies.parseCityWebIntentTag(preReply);
        if (!intent) return null;

        const plan = await dependencies.planCityWebSearchQuery(db, char, district, intent, baseLog);
        const query = String(plan.queries?.[0] || intent.query_hint || '').trim();
        if (!query) throw new Error('联网查询规划缺少可用查询词，请重试。');

        const preLog = dependencies.stripCityWebIntentTag(preReply);
        if (!preLog) throw new Error('联网前活动文案为空，请重试。');
        db.city.logAction(char.id, 'WEB_SEARCH', preLog, 0, 0, district?.id || char.location || '');
        dependencies.broadcastCityEvent(userId, char.id, 'WEB_SEARCH', preLog);

        const resolved = dependencies.mcpLabTools.resolveSearchProvider(db, plan.provider || 'auto');
        const labDb = dependencies.mcpLabTools.ensureMcpLabDb(db);
        const taskId = dependencies.mcpLabTools.makeId();
        const taskTime = new Date().toISOString();
        const taskBase = {
            id: taskId,
            owner_id: userId,
            title: `商业街联网：${query}`.slice(0, 160),
            kind: 'city_web_search',
            input: {
                query,
                provider: resolved.id,
                character_id: char.id,
                character_name: char.name || '',
                district_id: district?.id || '',
                district_name: district?.name || '',
                reason: intent?.reason || '',
                query_hint: intent?.query_hint || ''
            },
            created_at: taskTime,
            started_at: taskTime
        };
        labDb.saveTask({
            ...taskBase,
            status: 'running',
            output: null,
            error: '',
            finished_at: ''
        });
        let searchResult = null;
        try {
            searchResult = await dependencies.mcpLabTools.runWebSearch(query, {
                provider: resolved.id,
                apiKey: resolved.key,
                fetchPages: true,
                fetchPageLimit: 3
            });
            labDb.saveTask({
                ...taskBase,
                status: 'done',
                output: searchResult,
                error: '',
                finished_at: new Date().toISOString()
            });
            const content = dependencies.formatCityWebSearchKnowledge(searchResult);
            if (content) {
                try {
                    labDb.saveExternalKnowledge({
                        owner_id: userId,
                        character_id: char.id,
                        title: `商业街联网：${query}`.slice(0, 240),
                        content,
                        source_url: (searchResult.results || []).map(item => item.url).filter(Boolean).slice(0, 3).join('\n'),
                        source_type: 'city_web_search',
                        trust_level: 'search_summary',
                        tags: ['city_web_search', resolved.id, district?.id || '']
                    }, labDb.chunkText(content), dependencies.mcpLabTools.makeId);
                } catch (saveErr) {
                    console.warn(`[City/Web] 保存外部知识失败 ${char.name}: ${saveErr.message}`);
                }
            }
        } catch (searchErr) {
            try {
                labDb.saveTask({
                    ...taskBase,
                    status: 'error',
                    output: searchResult,
                    error: searchErr.message,
                    finished_at: new Date().toISOString()
                });
            } catch (taskErr) {
                console.warn(`[City/Web] 保存联网任务失败 ${char.name}: ${taskErr.message}`);
            }
            throw searchErr;
        }

        const afterPrompt = [
            `你是 ${char.name}，刚刚在 ${locationLabel} 查了一下手机/网页。`,
            '',
            dependencies.formatCityWebResultBlock(searchResult, plan, intent),
            '',
            '[任务]',
            '输出一段商业街活动文本，描述你看完联网内容后的动作、反应、决定或情绪。不要限制字数，按场景需要展开。',
            '如果是在工作场景摸鱼，要带一点心虚、遮掩或赶紧收手机的现实感。',
            '只输出活动文本，不要 JSON，不要标签。'
        ].join('\n');
        const afterMessages = [
            { role: 'system', content: '你是商业街生活模拟器。只输出一段自然的商业街活动记录文本。' },
            { role: 'user', content: afterPrompt }
        ];
        dependencies.recordCityLlmDebug(db, char, 'input', 'city_web_search_after_activity', afterMessages, { model: char.model_name, location: district?.id || '', query });
        const afterReply = await dependencies.callLLM({
            endpoint: char.api_endpoint,
            key: char.api_key,
            model: char.model_name,
            messages: afterMessages,
            maxTokens: 10000,
            temperature: 0.75,
            debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_web_search_after_activity', { location: district?.id || '', query })
        });
        const afterLog = String(afterReply || '').replace(/\[[A-Z_]+:[^\]]*?\]/g, '').trim();
        dependencies.recordCityLlmDebug(db, char, 'output', 'city_web_search_after_activity', afterLog, { model: char.model_name, location: district?.id || '', query });
        if (afterLog) {
            db.city.logAction(char.id, 'WEB_RESULT', afterLog, 0, 0, district?.id || char.location || '');
            dependencies.broadcastCityEvent(userId, char.id, 'WEB_RESULT', afterLog);
        }

        const outcome = { moneyDelta: 0, calorieDelta: 0, stateEffects: { stress: district?.type === 'work' ? 2 : 0, mood: 1 } };
        const looksLikeWorkResearch = /工作|资料|任务|客户|报告|学习|课程|项目|公告|悬赏|路线|价格|采购/.test(`${intent.reason} ${intent.query_hint} ${query}`);
        if (district?.type === 'work' && !looksLikeWorkResearch) {
            const punishMessages = [
                { role: 'system', content: '你是商业街工作摸鱼后果判定器。只输出 NO_PUNISH 或一段活动记录文本。' },
                {
                    role: 'user',
                    content: [
                        `你是 ${char.name}，刚刚在工作时摸鱼查网页。`,
                        `[摸鱼前] ${preLog}`,
                        `[摸鱼后] ${afterLog}`,
                        '请根据场景判断是否真的会被发现。',
                        '如果没有明显被发现，只输出 NO_PUNISH。',
                        '如果会被发现，输出一段商业街惩罚文本：被主管/同事/顾客发现、尴尬补救、被扣钱或被迫加班。不要限制字数，按场景需要展开，但不要过度夸张。'
                    ].join('\n')
                }
            ];
            dependencies.recordCityLlmDebug(db, char, 'input', 'city_web_search_work_punish', punishMessages, { model: char.model_name, location: district?.id || '', query });
            const punishReply = await dependencies.callLLM({
                endpoint: char.api_endpoint,
                key: char.api_key,
                model: char.model_name,
                messages: punishMessages,
                maxTokens: 10000,
                temperature: 0.75,
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_web_search_work_punish', { location: district?.id || '', query })
            });
            const punishLog = String(punishReply || '').trim();
            dependencies.recordCityLlmDebug(db, char, 'output', 'city_web_search_work_punish', punishLog, { model: char.model_name, location: district?.id || '', query });
            if (punishLog && !/^\s*NO_PUNISH\s*$/i.test(punishLog)) {
                const penaltyMoney = -Math.max(3, Math.min(30, Math.round(Number(district.money_reward || 10) * 0.25)));
                db.city.logAction(char.id, 'WEB_PUNISH', punishLog, 0, penaltyMoney, district?.id || char.location || '');
                dependencies.broadcastCityEvent(userId, char.id, 'WEB_PUNISH', punishLog);
                outcome.moneyDelta += penaltyMoney;
                outcome.stateEffects.stress = (outcome.stateEffects.stress || 0) + 8;
                outcome.stateEffects.mood = (outcome.stateEffects.mood || 0) - 5;
            }
        }

        return outcome;
    }

    return { maybeTriggerSuggestedCityAction, resolveCityIntentDistrict, getBehaviorInteractionStarterOutputContract, summarizeRecentBehaviorSpecialInteractions, findDuplicateBehaviorInteraction, readBehaviorInteractionStarterAction, getActionMinutesForHour, handleQuestLifecycleAfterAction, maybeRunCityWebSearchActivity };
}

module.exports = { createModule };
