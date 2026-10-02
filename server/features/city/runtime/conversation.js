// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function recordCityLlmDebug(db, character, direction, contextType, payload, meta = {}) {
        if (!db?.addLlmDebugLog || !character?.id || Number(character.llm_debug_capture || 0) !== 1) return;
        try {
            db.addLlmDebugLog({
                character_id: character.id,
                direction,
                context_type: contextType,
                payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
                meta: meta && Object.keys(meta).length ? JSON.stringify(meta) : null
            });
        } catch (err) {
            console.warn(`[City Debug] failed to record ${contextType} ${direction} for ${character.name}: ${err.message}`);
        }
    }

function getCachedCityPromptBlock(db, characterId, blockType, sourcePayload, buildFn) {
        const sourceHash = dependencies.crypto.createHash('sha256')
            .update(JSON.stringify(sourcePayload || {}))
            .digest('hex');
        const cached = typeof db?.getPromptBlockCache === 'function'
            ? db.getPromptBlockCache(characterId, blockType, sourceHash)
            : null;
        if (cached?.compiled_text) return cached.compiled_text;
        const compiledText = String(buildFn?.() || '');
        if (compiledText) {
            db?.upsertPromptBlockCache?.({
                character_id: characterId,
                block_type: blockType,
                source_hash: sourceHash,
                compiled_text: compiledText
            });
        }
        return compiledText;
    }

async function triggerHackerIntelReply(userId, char, intelText) {
        if (!char?.id) return null;
        const db = dependencies.ensureCityDb(dependencies.getUserDb(userId));
        const engine = dependencies.getEngine(userId);
        const wsClients = dependencies.getWsClients(userId);
        if (!engine || typeof engine.triggerImmediateUserReply !== 'function') {
            throw new Error('私聊引擎不可用');
        }

        const directive = [
            '你刚花钱在黑客据点买到了一份监听反馈。',
            '下面内容是用户过去 5 小时内和其他角色之间的真实私聊片段，不是用户刚刚直接对你说的话。',
            '你已经看完了这份情报，现在要给用户发一条正常私聊回应。',
            '要求：',
            '- 像真人刚看完这些内容后的第一反应那样说话，不要写成汇报工作、监控报告或固定格式摘要。',
            '- 可以自然带出吃醋、委屈、试探、嘴硬、阴阳怪气、装作不在意等情绪，但要符合你当前角色状态。',
            '- 最多只挑一两句最刺到你的内容提，不要逐条复述整份情报。',
            '- 不要提系统、RAG、上下文、日志、功能、监控链路。',
            '- 这次只需要发私聊回应，不要输出任何 CITY_ACTION、CITY_INTENT、TIMER 之类的标签，也不要顺手决定新的商业街行动。',
            '- 如果这份情报里没什么东西，也要像真人那样自然回应。',
            '',
            '[黑客据点监听反馈开始]',
            String(intelText || '').trim(),
            '[黑客据点监听反馈结束]'
        ].join('\n');

        const startNotice = '[系统提示] 黑客据点监听反馈已获取，角色正在根据这份情报组织一条私聊回应。';
        const { id: startMsgId, timestamp: startMsgTs } = db.addMessage(char.id, 'system', startNotice);
        engine?.broadcastNewMessage?.(wsClients, {
            id: startMsgId,
            character_id: char.id,
            role: 'system',
            content: startNotice,
            timestamp: startMsgTs,
            read: 0
        });
        engine?.broadcastEvent?.(wsClients, { type: 'refresh_contacts' });
        recordCityLlmDebug(db, char, 'event', 'hacker_intel_reply', 'Hacker intel reply dispatch started.', {
            has_intel: true,
            intel_length: String(intelText || '').length
        });

        try {
            await engine.triggerImmediateUserReply(char.id, wsClients, {
                propagateError: true,
                extraSystemDirective: directive,
                triggerSource: 'city_hacker_intel',
                triggerRoute: 'city.triggerHackerIntelReply',
                triggerNote: 'hacker intel reply'
            });
            recordCityLlmDebug(db, char, 'event', 'hacker_intel_reply', 'Hacker intel reply dispatch succeeded.', {
                has_intel: true,
                intel_length: String(intelText || '').length
            });
        } catch (err) {
            const failText = `[System] 黑客据点监听回报失败：${String(err?.message || err || '未知错误')}`;
            const { id: failMsgId, timestamp: failMsgTs } = db.addMessage(char.id, 'system', failText);
            engine?.broadcastNewMessage?.(wsClients, {
                id: failMsgId,
                character_id: char.id,
                role: 'system',
                content: failText,
                timestamp: failMsgTs,
                read: 0
            });
            engine?.broadcastEvent?.(wsClients, { type: 'refresh_contacts' });
            recordCityLlmDebug(db, char, 'event', 'hacker_intel_reply', failText, {
                error: true,
                has_intel: true,
                intel_length: String(intelText || '').length
            });
            throw err;
        }
        return true;
    }

function buildBusyChatImpactPatch(char, source = 'private', options = {}) {
        const patch = {};
        const isMentioned = !!options.isMentioned;
        const isAtAll = !!options.isAtAll;
        const weight = source === 'private' ? 3 : isMentioned ? 2 : isAtAll ? 1 : 1;

        if (char.city_status === 'working') {
            patch.work_distraction = dependencies.clamp((char.work_distraction ?? 0) + weight, 0, 100);
            patch.stress = dependencies.clamp((char.stress ?? 20) + (source === 'private' ? 2 : 1), 0, 100);
            patch.mood = dependencies.clamp((char.mood ?? 50) - 1, 0, 100);
        } else if (char.city_status === 'sleeping') {
            patch.sleep_disruption = dependencies.clamp((char.sleep_disruption ?? 0) + weight, 0, 100);
            patch.sleep_debt = dependencies.clamp((char.sleep_debt ?? 0) + (source === 'private' ? 2 : 1), 0, 100);
            patch.energy = dependencies.clamp((char.energy ?? 100) - 1, 0, 100);
            patch.mood = dependencies.clamp((char.mood ?? 50) - 1, 0, 100);
        }

        return patch;
    }

function formatDistrictItemsForPrompt(items = []) {
        if (!Array.isArray(items) || items.length === 0) return '无';
        return items.map(item => {
            const stockText = Number(item?.stock ?? -1) === -1 ? '库存不限' : `库存${Number(item?.stock || 0)}`;
            const priceText = `${Number(item?.buy_price || 0)}金币`;
            const calText = Number(item?.cal_restore || 0) > 0 ? `+${Number(item.cal_restore)}卡` : '无热量恢复';
            return `${item.emoji || ''}${item.name}(${priceText}, ${calText}, ${stockText})`;
        }).join('、');
    }

function formatInventoryItemForPrompt(item = {}) {
        const quantity = Math.max(0, Number(item.quantity || 0));
        const giftedQty = Math.min(quantity, Math.max(0, Number(item.user_gifted_quantity || item.gifted_quantity || 0)));
        const giftText = giftedQty > 0 ? `，用户送的x${giftedQty}` : '';
        const calText = Number(item.cal_restore || 0) > 0 ? `，+${Number(item.cal_restore)}体力` : '';
        return `${item.emoji || ''}${item.name || item.item_id || item.id || '物品'}x${quantity}${giftText}${calText}`;
    }

function buildInventoryPromptBlock(db, inventory = []) {
        const limit = Number(db?.city?.getInventorySlotLimit?.() || 10);
        const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 10;
        const slots = Array.isArray(inventory) ? inventory.length : 0;
        const totalQuantity = Array.isArray(inventory)
            ? inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0)
            : 0;
        const lines = Array.isArray(inventory)
            ? inventory.slice(0, safeLimit).map(formatInventoryItemForPrompt).filter(Boolean)
            : [];
        const overflowText = slots > safeLimit ? `\n- 只展示前 ${safeLimit} 行物品，剩余 ${slots - safeLimit} 行不展开。` : '';
        const fullText = totalQuantity > safeLimit
            ? '\n- 背包超重：物品总数超过 10 件时，必须立刻把这一轮商业街活动用于整理背包；你只能保留 10 件物品，其他由你自己处理。'
            : '';
        return `[当前背包]\n- 容量=${totalQuantity}/${safeLimit} 件物品；同一种物品合并显示，但数量都计入总数。\n- 物品=${lines.length ? lines.join('、') : '空'}${overflowText}\n- 用户送的物品会标注“用户送的”，处理前要更慎重。\n- 你要控制背包数量，不要无限囤货。${fullText}`;
    }

async function generateInventoryOrganizeNarrations(char, district, db, overflow = {}) {
        if (!(char?.api_endpoint && char?.api_key && char?.model_name)) {
            throw dependencies.createCityError('整理背包缺少模型 URL/Key/模型名，无法生成角色自由行动。', 400, true);
        }
        const inventory = db.city.getInventory(char.id);
        const limit = Number(overflow.limit || db.city.getInventorySlotLimit?.() || 10);
        const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? limit : 10;
        const totalQuantity = dependencies.getInventoryQuantityTotal(inventory);
        const targetKeepTotal = Math.min(safeLimit, totalQuantity);
        const state = dependencies.normalizeSurvivalState(char);
        const currentLocation = char.location ? db.city.getDistrict(char.location) : null;
        const currentLocationLabel = currentLocation ? `${currentLocation.emoji}${currentLocation.name}` : (char.location || '当前位置');
        const districtLabel = `${district?.emoji || '🎒'}${district?.name || '商业街'}`;
        const desiredItem = overflow.desiredItem || null;
        const desiredLine = desiredItem
            ? `\n本轮刚新增/准备带上的物品：${desiredItem.emoji || ''}${desiredItem.name || desiredItem.id || '物品'}。`
            : '';
        const antiRepeatBlock = buildRecentNarrationAntiRepeatBlock(db, char, { id: 'organize_bag', type: 'shopping' });
        const prompt = `你是 ${char.name}，这是一轮普通商业街活动。

本轮行动固定为 [ORGANIZE_BAG] 整理背包。触发原因：背包太重，当前共有 ${totalQuantity}/${safeLimit} 件物品，只能保留 ${targetKeepTotal} 件，其他东西由你自己处理。

当前位置：${currentLocationLabel}
活动地点：${districtLabel}
体力：${char.calories ?? 2000}/4000
金币：${Number(char.wallet || 0)}
精力：${state.energy} 睡眠债：${state.sleep_debt} 心情：${state.mood} 压力：${state.stress} 饱腹：${state.satiety} 胃负担：${state.stomach_load}${desiredLine}

当前背包：
${inventory.map(dependencies.formatInventoryDecisionRow).join('\n') || '- 空'}
${antiRepeatBlock}

要求：
- 你自己决定保留哪些物品和数量；不要让系统替你选。
- 用户送的物品已经标注，处理前要慎重，但最终仍由你按角色处境决定。
- log 要像普通商业街活动一样自然描写这轮整理背包，不要套固定句式，不要照抄物品清单。
- chat / diary 只有自然需要时才写，可以留空。
- 为了同步背包，inventory_keep 必须列出最终保留的 item_id 和数量，总数量必须等于 ${targetKeepTotal}，只能使用当前背包里的 item_id。
- 返回必须是合法 JSON 对象；字段包含 action、log、chat、diary、inventory_keep；action 固定为 [ORGANIZE_BAG]。不要返回 JSON 之外的任何内容。`;

        const messages = [
            { role: 'system', content: '你是角色自己的现实行动记录器。只返回合法 JSON 对象，不要输出任何额外解释、markdown、前言或后记。' },
            { role: 'user', content: prompt }
        ];
        recordCityLlmDebug(db, char, 'input', 'city_inventory_organize_action', messages, {
            model: char.model_name,
            totalQuantity,
            limit: safeLimit,
            location: char.location || ''
        });
        let reply = '';
        try {
            reply = await dependencies.callLLM({
                endpoint: char.api_endpoint,
                key: char.api_key,
                model: char.model_name,
                messages,
                maxTokens: 3000,
                temperature: 0.85,
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_inventory_organize_action', {
                    totalQuantity,
                    limit: safeLimit,
                    location: char.location || ''
                })
            });
        } catch (err) {
            throw dependencies.createCityError(`整理背包请求失败，请重试：${err.message}`, 502, true);
        }
        recordCityLlmDebug(db, char, 'output', 'city_inventory_organize_action', reply, {
            model: char.model_name,
            totalQuantity,
            limit: safeLimit,
            location: char.location || ''
        });
        let parsed = null;
        try {
            parsed = tryParseCityActionReply(reply);
        } catch (err) {
            throw dependencies.createCityError(`整理背包返回的 JSON 无法解析，请重试：${err.message || 'parse_failed'}`, 502, true);
        }
        if (!parsed || String(parsed.action || '').trim().toUpperCase() !== '[ORGANIZE_BAG]') {
            throw dependencies.createCityError('整理背包返回缺少有效 action。', 502, true);
        }
        if (!String(parsed.log || '').trim()) {
            throw dependencies.createCityError('整理背包返回缺少可用 log。', 502, true);
        }
        if (!Array.isArray(parsed.inventory_keep) && !parsed.keep_items && !parsed.keep) {
            throw dependencies.createCityError('整理背包返回缺少 inventory_keep。', 502, true);
        }
        return parsed;
    }

function pickSettledShopItemFromNarrations(shopItems = [], richNarrations = null) {
        if (!Array.isArray(shopItems) || shopItems.length === 0) return null;
        const haystack = [
            richNarrations?.log,
            richNarrations?.diary,
            richNarrations?.chat
        ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean).join('\n');
        if (!haystack) return null;

        let best = null;
        for (const item of shopItems) {
            const aliases = [
                item?.id,
                item?.name,
                item?.emoji
            ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
            let score = 0;
            for (const alias of aliases) {
                if (!alias) continue;
                if (haystack.includes(alias)) {
                    score = Math.max(score, alias.length + (alias === String(item?.name || '').trim().toLowerCase() ? 10 : 0));
                }
            }
            if (score > 0 && (!best || score > best.score)) {
                best = { item, score };
            }
        }
        return best?.item || null;
    }

async function buildGamblingOutcomeNarrations(char, district, db, outcome = {}, styleHint = null) {
        if (!(char.api_endpoint && char.api_key && char.model_name)) {
            throw dependencies.createCityError('赌场结果文案生成缺少模型 URL/Key/模型名，请补全后重试。', 400, true);
        }

        const currentLocation = char.location ? db.city.getDistrict(char.location) : null;
        const currentLocationLabel = currentLocation ? `${currentLocation.emoji}${currentLocation.name}` : (char.location || '未知地点');
        const walletBefore = Number(char.wallet || 0);
        const rawWalletAfter = +(walletBefore + Number(outcome.moneyDelta || 0)).toFixed(2);
        const walletAfter = walletBefore < 0 ? rawWalletAfter : Math.max(0, rawWalletAfter);
        const styleText = styleHint && typeof styleHint === 'object'
            ? [styleHint.log, styleHint.diary, styleHint.chat].map(v => String(v || '').trim()).filter(Boolean)[0] || ''
            : '';

        const prompt = `你正在生成一次正常的商业街赌场行动结果。

角色：${char.name}
当前地点：${currentLocationLabel}
目标地点：${district.emoji}${district.name}

[已确定的赌场结果]
- 这次结果已经结算完成，不能改写。
- 胜负：${outcome.didWin ? '赢了' : '输了'}
- 金币变化：${Number(outcome.moneyDelta || 0) >= 0 ? '+' : ''}${Number(outcome.moneyDelta || 0)}
- 行动后钱包：${walletAfter}
- 体力变化：${Number(outcome.calDelta || 0)}

要求：
- 只根据上面的既定结果写这次赌场行动里实际发生了什么。
- 你不能把赢写成输，也不能把输写成赢。
- log 要像普通商业街行动记录，有画面、动作和结果，但不要写成固定模板。
- chat / diary 默认可留空；只有自然出现时才填写。
- 不要写系统、后台、日志、结算、触发器。
${styleText ? `- 可轻微参考这段既有语气，但只能参考语气，不能覆盖既定输赢事实：${styleText}` : ''}

严格返回 JSON 对象：
{
  "log": "自然的赌场行动记录",
  "chat": "",
  "diary": ""
}`;

        const messages = [
            { role: 'system', content: '你是角色自己的现实行动记录器。你只返回合法 JSON 对象，不要输出任何额外解释、markdown、前言或后记。' },
            { role: 'user', content: prompt }
        ];
        recordCityLlmDebug(db, char, 'input', 'city_gambling_outcome_narration', messages, {
            model: char.model_name,
            districtId: district.id,
            didWin: !!outcome.didWin
        });
        let reply = '';
        try {
            reply = await dependencies.callLLM({
                endpoint: char.api_endpoint,
                key: char.api_key,
                model: char.model_name,
                messages,
                maxTokens: 3000,
                temperature: 0.7,
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_gambling_outcome_narration', {
                    districtId: district.id,
                    didWin: !!outcome.didWin
                })
            });
        } catch (err) {
            throw dependencies.createCityError(`赌场结果文案生成请求失败，请重试：${err.message}`, 502, true);
        }
        recordCityLlmDebug(db, char, 'output', 'city_gambling_outcome_narration', reply, {
            model: char.model_name,
            districtId: district.id,
            didWin: !!outcome.didWin
        });

        let parsed = null;
        try {
            parsed = tryParseCityActionReply(reply);
        } catch (err) {
            throw dependencies.createCityError(`赌场结果文案生成返回的 JSON 无法解析，请重试：${err.message || 'parse_failed'}`, 502, true);
        }
        const log = String(parsed?.log || '').trim();
        if (!parsed || !log) {
            throw dependencies.createCityError('赌场结果文案生成缺少可用 log，请重试。', 502, true);
        }
        return {
            log,
            chat: String(parsed.chat || '').trim(),
            diary: String(parsed.diary || '').trim()
        };
    }

function tryParseCityActionReply(reply = '') {
        const parsed = dependencies.parseCityActionNarrations(reply);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    }

async function runPrivateReplyDirectedCityAction(userId, char, district, replyText, db, config) {
        const activeEvents = db.city.getActiveEvents();
        const currentCals = char.calories ?? 2000;
        const districts = db.city.getEnabledDistricts();
        const inventory = db.city.getInventory(char.id);
        const overflowState = typeof db.city.getInventoryCapacityState === 'function'
            ? db.city.getInventoryCapacityState(char.id)
            : null;
        if (overflowState?.over_limit) {
            const overflowDistrict = districts.find(d => d.id === 'street')
                || db.city.getDistrict?.('street')
                || district
                || { id: 'street', name: '商业街', emoji: '🎒', type: 'shopping', cal_cost: 2 };
            try {
                const overflowResult = await dependencies.actionService.maybeOrganizeInventoryOverflow?.(
                    char,
                    db,
                    userId,
                    currentCals,
                    config,
                    { district: overflowDistrict }
                );
                if (overflowResult?.triggered) {
                    return { triggered: true, districtId: overflowDistrict.id, mode: 'inventory_overflow_organize' };
                }
            } catch (err) {
                return { triggered: false, districtId: overflowDistrict.id, reason: err.message, canRetry: true };
            }
        }
        const availableDistrictItems = dependencies.getAvailableDistrictItems(db, district.id);
        const districtItemsPrompt = availableDistrictItems.length > 0
            ? `\n[当前目标地点可用商品]\n${district.name} 现在真实可用的商品只有：${formatDistrictItemsForPrompt(availableDistrictItems)}\n- 如果你在 log / diary / chat 里提到具体吃了、买了、拿了什么，只能从上面这些商品里选。\n- 可以不写具体商品；但如果写了，就绝对不要编造清单外的食物或商品。\n- 便利店是购买/补给场景：在便利店买到的食物会先进入背包，不等于当场恢复体力；如果这次真正目的是“吃饭/恢复体力”，优先去餐厅或吃背包里已有食物。\n- 如果地点已锁定为便利店，就把文案写成买了/带走/准备之后吃，不要写成已经坐下吃完并恢复。`
            : '';
        const engineContextWrapper = { getUserDb: dependencies.context.getUserDb, getMemory: dependencies.context.getMemory, userId, forceCityDetail: true };
        const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, char, '', false);
        const activeQuestClaim = db.city.getCharacterActiveQuestClaim?.(char.id) || null;
        const lastQuestReview = activeQuestClaim ? db.city.getLatestQuestProgressReviewForClaim?.(activeQuestClaim, char.id) : null;
        const recentQuestReviews = activeQuestClaim ? db.city.getRecentQuestProgressReviewsForClaim?.(activeQuestClaim, char.id, 4) || [] : [];
        const questContext = buildQuestPromptContext(db.city.getActiveQuests(), activeQuestClaim, lastQuestReview, recentQuestReviews);
        const basePrompt = buildSurvivalPrompt(districts, { ...char, calories: currentCals }, inventory, activeEvents, universalResult, district, questContext, db);
        const questDirectedBlock = activeQuestClaim ? `

[当前任务优先级]
- 你手上有公告任务：${activeQuestClaim.emoji || '📜'} ${activeQuestClaim.title}。
- 任务目标地点：${activeQuestClaim.target_district || 'street'}；当前进度：${activeQuestClaim.progress_count || 0}/${activeQuestClaim.completion_target || 0}；阶段：${activeQuestClaim.status}。
- 如果本轮锁定地点就是任务目标地点，log / chat / diary 必须写成推进这项任务，而不是写普通地点玩法。
- 本轮必须返回 quest_intent：{"quest_id":${Number(activeQuestClaim.quest_id || activeQuestClaim.id || 0)},"stage":"${['ready_to_report', 'reporting'].includes(String(activeQuestClaim.status || '')) ? 'report' : 'progress'}"}。
- 写任务推进时要出现可评分的具体行动：寻找/接触目标、确认情况、动手处理、护送、交付、汇报、解决阻碍等，按任务要求选择。
- 如果目标地点是赌场，但任务不是“参与赌博”，不要写下注、轮盘、骰宝、牌局输赢或自行消遣；赌场只是任务发生地点。
- 如果目标地点是黑客据点，但任务不是“监听/入侵/截获情报”，不要写黑客行动、监听记录、截获私聊、翻日志；黑客据点只是任务发生地点。` : '';

        const directedPrompt = `${basePrompt}

[触发信号]
- 本轮已经确认开启商业街活动。
- 目标地点已锁定为 ${district.emoji}${district.name}。
- 信号只负责“确认开启 + 指定去哪”，不是让你续写私聊对白。

[这次商业街行动的额外要求]
- 这次按普通商业街活动生成，只是目的地已经锁定，不需要重新犹豫要不要去。
- action 必须选择 [${String(district.id || '').toUpperCase()}]。
- log 要写成这次去 ${district.name} 实际发生了什么，优先参考当前状态、当前位置、最近商业街连续性和商业街常规输入。
- 不要复述私聊对白，不要围绕“刚才那句话”做二次改写。
- 如果当前状态里已经带着明显情绪，就让商业街行动自然延续，但不要夸张到失真。${questDirectedBlock}${districtItemsPrompt}`;

        if (!(char.api_endpoint && char.api_key && char.model_name)) {
            return { triggered: false, districtId: district.id, reason: 'missing_model_config', canRetry: true };
        }

        try {
            const messages = [
                { role: 'system', content: `你是一个城市生活模拟角色行动引擎。你必须严格返回完整 JSON 对象，不要输出 JSON 之外的解释、markdown 或额外文本。返回结果必须包含 action、log、chat、diary 四个字段。\n\n${universalResult.systemGuidance}` },
                { role: 'user', content: directedPrompt }
            ];
            recordCityLlmDebug(db, char, 'input', 'city_private_reply_directed_action', messages, {
                model: char.model_name,
                districtId: district.id,
                location: char.location || ''
            });
            const reply = await dependencies.callLLM({
                endpoint: char.api_endpoint,
                key: char.api_key,
                model: char.model_name,
                messages,
                maxTokens: 3000,
                temperature: 0.75,
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_private_reply_directed_action', {
                    districtId: district.id,
                    location: char.location || ''
                })
            });
            recordCityLlmDebug(db, char, 'output', 'city_private_reply_directed_action', reply, {
                model: char.model_name,
                districtId: district.id,
                location: char.location || ''
            });

            const richNarrations = tryParseCityActionReply(reply);
            if (richNarrations && typeof richNarrations === 'object') {
                const expectedAction = `[${String(district.id || '').toUpperCase()}]`;
                const action = String(richNarrations.action || '').trim();
                if (action !== expectedAction) {
                    throw new Error(`私聊定向商业街行动 action 无效：${action || 'empty'}`);
                }
                if (!String(richNarrations.log || '').trim()) {
                    throw new Error('私聊定向商业街行动缺少 log 字段');
                }
                await dependencies.applyDecision(district, char, db, userId, currentCals, config, activeEvents, richNarrations, { preserveDirectedDistrict: true });
                return { triggered: true, districtId: district.id, mode: 'directed_city_action' };
            }
            throw new Error('私聊定向商业街行动返回内容不是合法 JSON 对象');
        } catch (err) {
            console.warn(`[City] 私聊定向商业街行动失败 ${char.name}: ${err.message}`);
            return { triggered: false, districtId: district.id, reason: err.message, canRetry: true };
        }
    }

function isWeakCityNarration(text, char, district) {
        const value = String(text || '').trim();
        if (!value) return true;

        const genericPatterns = [
            new RegExp(`^${char.name}从?.{0,12}(前往|去了|离开).{0,24}(继续工作|工作|休息|睡觉|用餐|吃饭|学习|娱乐)[。！]?$`),
            new RegExp(`^${char.name}.{0,20}(精神饱满|状态不错|准备好|决定了).{0,20}[。！]?$`),
            new RegExp(`^${char.name}.{0,30}(去了|前往).{0,12}${district.name}.{0,20}[。！]?$`)
        ];
        if (genericPatterns.some((pattern) => pattern.test(value))) return true;

        const genericFragments = [
            '精神饱满地前往',
            '前往工厂继续工作',
            '从餐厅离开',
            '准备好好',
            '继续工作',
            '去了',
            '前往'
        ];
        const blandHitCount = genericFragments.reduce((count, fragment) => count + (value.includes(fragment) ? 1 : 0), 0);
        if (value.length <= 26 && blandHitCount >= 1) return true;
        if (value.length <= 40 && blandHitCount >= 2) return true;
        return false;
    }

function buildRecentNarrationAntiRepeatBlock(db, char, district) {
        try {
            const recentLogs = db?.city?.getCharacterRecentLogs?.(char.id, 8) || [];
            const targetLocation = String(district?.id || '').trim();
            const targetActionTypes = new Set();
            if (district?.id === 'restaurant') targetActionTypes.add('EAT');
            if (district?.id === 'convenience') targetActionTypes.add('BUY');
            if (district?.type === 'food' && targetActionTypes.size === 0) targetActionTypes.add('EAT');
            if (district?.type === 'shopping' && targetActionTypes.size === 0) targetActionTypes.add('BUY');

            const sameFamilyLogs = recentLogs
                .filter((log) => {
                    const logLocation = String(log.location || '').trim();
                    const logType = String(log.action_type || '').trim().toUpperCase();
                    if (targetLocation && logLocation === targetLocation) return true;
                    return targetActionTypes.has(logType);
                })
                .map((log) => String(log.message || '').trim())
                .filter((text) => text && !dependencies.isCollapsedCityLog(text))
                .slice(0, 3);

            if (sameFamilyLogs.length === 0) return '';
            return `\n[最近同类文案，禁止复写句式]\n${sameFamilyLogs.map((text) => `- ${text}`).join('\n')}\n- 不要沿用这些文案的开头、动机句、收尾句或明显措辞。`;
        } catch (e) {
            return '';
        }
    }

function buildRecentPrivateChatAntiRepeatBlock(db, char) {
        try {
            if (!db || typeof db.getVisibleMessages !== 'function' || !char?.id) return '';
            const recentMessages = db.getVisibleMessages(char.id, 14) || [];
            const recentCharacterReplies = recentMessages
                .filter((message) => message?.role === 'character')
                .map((message) => String(message.content || '').replace(/\s+/g, ' ').trim())
                .filter((text) => text && text.length >= 8)
                .slice(-6);

            if (recentCharacterReplies.length === 0) return '';
            return `\n[最近私聊回复，chat 字段禁止复写]\n${recentCharacterReplies.map((text) => `- ${text}`).join('\n')}\n- 如果本轮要填写 chat，必须承接当前商业街事件说新的状态/发现/决定；不要复述上面这些私聊的观点、控诉、解释、请求或收尾句。\n- 不要把用户刚刚说过的话扩写成同一段争执；如果只是想继续旧话题，chat 可以留空。`;
        } catch (e) {
            return '';
        }
    }

function buildFreshPrivateChatTailBlock(db, char, limit = 10) {
        try {
            if (!db || typeof db.getVisibleMessages !== 'function' || !char?.id) return '';
            const recentMessages = (db.getVisibleMessages(char.id, limit) || [])
                .filter((message) => message && (message.role === 'user' || message.role === 'character'))
                .slice(-limit);
            if (recentMessages.length === 0) return '';
            const userName = db.getUserProfile?.()?.name || '玩家';
            const lines = recentMessages.map((message) => {
                const speaker = message.role === 'user' ? userName : (char.name || '角色');
                const text = String(message.content || '').replace(/\s+/g, ' ').trim().slice(0, 220);
                return text ? `- ${speaker}: ${text}` : '';
            }).filter(Boolean);
            if (lines.length === 0) return '';
            return `\n[生成前实时读取的最新私聊]\n${lines.join('\n')}\n- 上面是本次商业街活动生成前从私聊库实时读取的最新尾巴，优先级高于旧摘要和旧商业街记录。\n- 如果最新用户消息比你上一条回复更新，chat 必须承接最新用户消息；不要只复述旧回复。\n- 防重复只靠语义自觉：不要把最近已经说过的私聊整段复制或近似改写。`;
        } catch (e) {
            return '';
        }
    }

async function regenerateActionNarrations(char, district, db, baseNarrations = {}, options = {}) {
        if (!(char?.api_endpoint && char?.api_key && char?.model_name)) {
            throw dependencies.createCityError('行动文案重写缺少模型 URL/Key/模型名，请补全后重试。', 400, true);
        }

        const currentLocation = char.location ? db.city.getDistrict(char.location) : null;
        const currentLocationLabel = currentLocation ? `${currentLocation.emoji}${currentLocation.name}` : (char.location || '当前位置');
        const districtLabel = `${district.emoji || ''}${district.name || district.id || '未知地点'}`;
        const state = dependencies.normalizeSurvivalState(char);
        const calories = Number(options.currentCals ?? char.calories ?? 2000);
        const recentAntiRepeat = buildRecentNarrationAntiRepeatBlock(db, char, district);
        const privateChatAntiRepeat = buildRecentPrivateChatAntiRepeatBlock(db, char);
        const itemLine = options.item
            ? `\n[这次实际涉及的物品]\n- ${options.item.emoji || ''}${options.item.name || options.item.id || '物品'}`
            : '';
        const draftText = [
            baseNarrations?.log,
            baseNarrations?.chat,
            baseNarrations?.diary
        ].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
        const districtSpecificRule = district.id === 'restaurant'
            ? '- 这是餐厅堂食/现场吃饭，不要写成便利店买完带走。'
            : district.id === 'convenience'
                ? '- 这是便利店购买/带走场景，不要写成坐下来正式堂食。'
                : '';

        const prompt = `你要为一次已经确定发生的商业街行动，重写最终文案。

角色：${char.name}
当前位置：${currentLocationLabel}
本次地点：${districtLabel}
地点类型：${district.type || 'generic'}
体力：${calories}/4000
金币：${Number(char.wallet || 0)}
精力：${state.energy} 睡眠债：${state.sleep_debt} 心情：${state.mood} 压力：${state.stress} 饱腹：${state.satiety} 胃负担：${state.stomach_load}${itemLine}${recentAntiRepeat}${privateChatAntiRepeat}

[已有草稿，仅供参考，不得照抄]
${draftText || '（无）'}

要求：
- 只重写这次行动本身，不改动作结果，不改地点，不改物品。
- 最终文案必须像真人刚经历完这件事，不要套固定模板。
- 不要出现“肚子里空空的”“想先把肚子和整个人安顿好”“从家离开”这类高复用套话。
- log 要有具体动作、感受或现场细节，但不要写成系统总结。
- chat / diary 可以留空，只有自然冒出来时才写。
${districtSpecificRule ? districtSpecificRule + '\n' : ''}严格返回 JSON：
{
  "log": "重写后的商业街行动文案",
  "chat": "",
  "diary": ""
}`;

        const messages = [
            { role: 'system', content: '你是角色自己的现实行动记录器。只返回合法 JSON 对象，不要输出任何额外解释、markdown、前言或后记。' },
            { role: 'user', content: prompt }
        ];
        recordCityLlmDebug(db, char, 'input', 'city_action_regenerate_narration', messages, {
            model: char.model_name,
            districtId: district.id,
            location: char.location || ''
        });
        let reply = '';
        try {
            reply = await dependencies.callLLM({
                endpoint: char.api_endpoint,
                key: char.api_key,
                model: char.model_name,
                messages,
                maxTokens: 3000,
                temperature: 0.9,
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_action_regenerate_narration', {
                    districtId: district.id,
                    location: char.location || ''
                })
            });
        } catch (err) {
            throw dependencies.createCityError(`行动文案重写请求失败，请重试：${err.message}`, 502, true);
        }
        recordCityLlmDebug(db, char, 'output', 'city_action_regenerate_narration', reply, {
            model: char.model_name,
            districtId: district.id,
            location: char.location || ''
        });
        let parsed = null;
        try {
            parsed = tryParseCityActionReply(reply);
        } catch (err) {
            throw dependencies.createCityError(`行动文案重写返回的 JSON 无法解析，请重试：${err.message || 'parse_failed'}`, 502, true);
        }
        const log = String(parsed?.log || '').trim();
        if (!parsed || !log) {
            throw dependencies.createCityError('行动文案重写缺少可用 log，请重试。', 502, true);
        }
        return {
            ...baseNarrations,
            ...parsed,
            log
        };
    }

async function buildQuestResolutionNarrations(char, quest, district, db, outcome = 'success') {
        return dependencies.questService.buildQuestResolutionNarrations(char, quest, district, db, outcome);
    }

async function buildBusyPenaltyNarration(char, kind, amount, districtName, db) {
        const penaltyAmount = Number(amount || 0);
        if (!Number.isFinite(penaltyAmount) || penaltyAmount <= 0) {
            throw dependencies.createCityError('忙碌惩罚文案生成缺少有效惩罚数值，请重试。', 500, true);
        }
        if (!(char?.api_endpoint && char?.api_key && char?.model_name)) {
            throw dependencies.createCityError('忙碌惩罚文案生成缺少模型 URL/Key/模型名，请补全后重试。', 400, true);
        }

        const kindLabel = kind === 'work' ? '工作' : '补觉/休息';
        const actionType = kind === 'work' ? 'WORK_DISTRACT' : 'SLEEP_DISTURB';
        let recentSameKindBlock = '';
        try {
            const recentSameKindLogs = (db?.city?.getCharacterRecentLogs?.(char.id, 12) || [])
                .filter((log) => String(log.action_type || '').toUpperCase() === actionType)
                .map((log) => String(log.message || '').replace(/\s+/g, ' ').trim())
                .filter((text) => text && !dependencies.isCollapsedCityLog(text))
                .slice(0, 5);
            if (recentSameKindLogs.length > 0) {
                recentSameKindBlock = `\n\n最近已经写过的同类结算文案，禁止复写句式或明显措辞：\n${recentSameKindLogs.map((text) => `- ${text}`).join('\n')}`;
            }
        } catch (e) {
            recentSameKindBlock = '';
        }
        const effectLine = kind === 'work'
            ? `这次因为分神，实际少赚了 ${amount} 金币。`
            : `这次因为被打断，额外增加了 ${amount} 点睡眠债。`;
        const prompt = `你是 ${char.name}。你刚刚在商业街的${kindLabel}状态里被私聊打扰，导致现实后果出现。

地点：${districtName || '当前地点'}
后果：${effectLine}
${recentSameKindBlock}

要求：
1. 只写 1-2 句商业街活动记录文案。
2. 要写出“本来在忙/在睡，被聊天打扰后出了现实代价”的感觉。
3. 语气要贴合角色，不要写系统、后台、数值结算说明。
4. 文案里要能让人感觉到一点紧迫感、烦躁、无奈或被拖住的现实感。
5. 必须换一个新的切入点，可以写环境、动作、身体反应、情绪后劲或没完成的事，但不要照搬上面的开头、转折和收尾。
6. 如果是补觉/休息被打断，不要总写“迷迷糊糊、眼皮发沉、脑子更昏、比没睡还累、彻底睡不着”这一组固定表达。
7. 不要脱离场景乱发挥。`;

        try {
            const messages = [
                { role: 'system', content: '你只返回商业街活动记录文案，不要输出 JSON，不要解释。' },
                { role: 'user', content: prompt }
            ];
            recordCityLlmDebug(db, char, 'input', 'city_busy_penalty_narration', messages, {
                model: char.model_name,
                busyKind: kind,
                districtName: districtName || '',
                amount
            });
            const reply = await dependencies.callLLM({
                endpoint: char.api_endpoint,
                key: char.api_key,
                model: char.model_name,
                messages,
                maxTokens: 3000,
                temperature: 0.55,
                presencePenalty: 0.25,
                frequencyPenalty: 0.35,
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_busy_penalty_narration', {
                    busyKind: kind,
                    districtName: districtName || '',
                    amount
                })
            });
            recordCityLlmDebug(db, char, 'output', 'city_busy_penalty_narration', reply, {
                model: char.model_name,
                busyKind: kind,
                districtName: districtName || '',
                amount
            });
            const cleaned = String(reply || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').replace(/\s+/g, ' ').trim();
            if (!cleaned) {
                throw dependencies.createCityError('忙碌惩罚文案生成缺少可用文案，请重试。', 502, true);
            }
            return cleaned;
        } catch (err) {
            if (err?.canRetry) throw err;
            throw dependencies.createCityError(`忙碌惩罚文案生成请求失败，请重试：${err.message}`, 502, true);
        }
    }

async function maybeExecuteReplyCityIntent(userId, characterId, intentText, replyText = '') {
        const db = dependencies.ensureCityDb(dependencies.context.getUserDb(userId));
        const config = db.city.getConfig();
        if (config.dlc_enabled === '0' || config.dlc_enabled === 'false') return { triggered: false, reason: 'city_paused' };

        const char = db.getCharacter(characterId);
        if (!char || char.status !== 'active' || char.sys_survival === 0) return { triggered: false, reason: 'character_inactive' };

        const districts = db.city.getEnabledDistricts();
        const district = dependencies.resolveDistrictFromStructuredSignal(intentText, districts, { allowTypeFallback: true });
        if (!district) return { triggered: false, reason: 'intent_unresolved' };

        if (String(char.location || '').toLowerCase() === String(district.id || '').toLowerCase()) {
            return { triggered: false, reason: district.id === 'home' ? 'same_home_noop' : 'same_location_noop' };
        }

        return runPrivateReplyDirectedCityAction(
            userId,
            char,
            district,
            replyText,
            db,
            config
        );
    }

async function maybeExecuteReplyCityAction(userId, characterId, actionPayload, replyText = '') {
        const db = dependencies.ensureCityDb(dependencies.context.getUserDb(userId));
        const config = db.city.getConfig();
        if (config.dlc_enabled === '0' || config.dlc_enabled === 'false') {
            return { triggered: false, reason: 'city_paused' };
        }

        const char = db.getCharacter(characterId);
        if (!char || char.status !== 'active' || char.sys_survival === 0) {
            return { triggered: false, reason: 'character_inactive' };
        }

        const payload = actionPayload && typeof actionPayload === 'object' ? actionPayload : {};
        const districts = db.city.getEnabledDistricts();
        const district = dependencies.resolveDistrictFromStructuredSignal(payload, districts, { allowTypeFallback: true });
        if (!district) {
            return { triggered: false, reason: 'action_unresolved' };
        }

        const payloadPromptParts = [
            payload.prompt,
            payload.goal,
            payload.plan,
            payload.log,
            payload.diary
        ].map(v => String(v || '').trim()).filter(Boolean);
        const seedPrompt = payloadPromptParts.join(' ');
        return runPrivateReplyDirectedCityAction(
            userId,
            char,
            district,
            replyText,
            db,
            config
        );
    }

async function maybeSyncReplyDeclaredState() {
        return { synced: false, reason: 'disabled' };
    }

function buildQuestPromptContext(activeQuests = [], activeQuestClaim = null, lastQuestReview = null, recentQuestReviews = []) {
        const openTasks = Array.isArray(activeQuests) ? activeQuests.slice(0, 6).map((quest) => {
            const claimantNames = Array.isArray(quest.claimant_names) ? quest.claimant_names.filter(Boolean) : [];
            const claimText = claimantNames.length > 0
                ? `已由 ${claimantNames.join('、')} 接单/领先；后加入也可以帮忙推进，但只有抢先正式交付的人能拿赏金，不能预写自己已经拿到钱`
                : '暂时无人接单';
            return `- [QUEST_${quest.id}] ${quest.emoji || '📜'} ${quest.title} | 地点=${quest.target_district || 'street'} | 奖励=${Number(quest.reward_gold || 0)}金币${Number(quest.reward_cal || 0) > 0 ? ` ${Number(quest.reward_cal || 0)}体力` : ''} | ${claimText} | ${quest.description || ''}`;
        }) : [];

        let personalTask = '';
        if (activeQuestClaim) {
            const stageMap = {
                accepted: '你刚决定去接这单，下一步先赶到对应地点。',
                in_progress: '你已经在处理中，继续按任务要求做事。',
                ready_to_report: '你已经做完主要内容，下一步该去汇报交付。',
                reporting: '你正在准备汇报交付。'
            };
            const nextQuestIntentStage = ['ready_to_report', 'reporting'].includes(String(activeQuestClaim.status || '')) ? 'report' : 'progress';
            const reviewStatus = String(lastQuestReview?.status || '').trim();
            const hasLastReview = !!lastQuestReview && reviewStatus !== 'pending';
            const progressDelta = Number(lastQuestReview?.progress_delta || 0);
            const progressAfter = Number(lastQuestReview?.progress_after ?? activeQuestClaim.progress_count ?? 0);
            const targetScore = Number(lastQuestReview?.target_score || activeQuestClaim.completion_target || 0);
            const reviewComment = String(lastQuestReview?.comment || lastQuestReview?.error_message || '').trim();
            const reviewLabel = String(lastQuestReview?.short_label || '').trim();
            const pressureLine = progressDelta <= 0
                ? '上一次没有推进任务；如果继续闲逛或做普通地点玩法，很可能拿不到赏金。'
                : '上一次已经推进了一点，但还没完成；这次要沿着有效方向继续做具体任务动作。';
            const lastReviewBlock = hasLastReview
                ? `\n[上一次任务评分]\n- 结果：${reviewStatus === 'success' ? `+${progressDelta}分 ${reviewLabel ? `(${reviewLabel})` : ''}` : '评分失败'}\n- 累计进度：${progressAfter}/${targetScore || activeQuestClaim.completion_target || 0}\n- 评价：${reviewComment || '暂无具体评价'}\n- 压力提醒：${pressureLine}`
                : '';
            const reviewTimeline = Array.isArray(recentQuestReviews)
                ? recentQuestReviews
                    .filter((review) => review && String(review.status || '').trim() !== 'pending')
                    .slice(0, 4)
                    .reverse()
                : [];
            const continuityHaystack = reviewTimeline
                .map((review) => [review.short_label, review.comment, review.log_content].map((value) => String(value || '')).join(' '))
                .join('\n');
            const hasContactedTarget = /成功接头|找到目标|找到.*VIP|接触.*VIP|达成护送|需要人送您安全到家|带着他|护送/.test(continuityHaystack);
            const continuityHint = hasContactedTarget
                ? '\n[当前任务连续阶段]\n- 已经找到并接触过目标 VIP，且已达成/开始护送关系。\n- 后续行动必须写护送、保护、避开尾随者、带目标移动、处理阻碍或准备交付；不得再写“VIP还没出现”“不知道他长什么样”“重新寻找目标”。'
                : '';
            const timelineBlock = reviewTimeline.length > 0
                ? `\n[最近任务轨迹]\n${reviewTimeline.map((review) => {
                    const label = String(review.short_label || '').trim();
                    const comment = dependencies.clipQuestContextText(review.comment || review.error_message || '', 110);
                    const log = dependencies.clipQuestContextText(review.log_content || '', 170);
                    const delta = Number(review.progress_delta || 0);
                    const after = Number(review.progress_after || 0);
                    const target = Number(review.target_score || activeQuestClaim.completion_target || 0);
                    return `- ${after}/${target}：${delta >= 0 ? `+${delta}` : delta}分${label ? `（${label}）` : ''}；${comment || '暂无评价'}${log ? `；上轮事实：${log}` : ''}`;
                }).join('\n')}${continuityHint}\n- 连续性要求：本轮必须承接最近任务轨迹继续推进，不要倒退到已经完成过的阶段；如果已经找到/接触目标，就继续护送、处理阻碍、移动到下一节点或准备交付，不要重新写“目标还没出现/不知道目标是谁”。`
                : '';
            personalTask = `\n[你当前手上的公告任务]\n- 任务：${activeQuestClaim.emoji || '📜'} ${activeQuestClaim.title}\n- 目标地点：${activeQuestClaim.target_district || 'street'}\n- 当前阶段：${activeQuestClaim.status}\n- 进度：${activeQuestClaim.progress_count || 0}/${activeQuestClaim.completion_target || 0}\n- 说明：${stageMap[activeQuestClaim.status] || '按任务自然推进。'}\n- 任务要求：${activeQuestClaim.description || ''}${lastReviewBlock}${timelineBlock}\n- 若本轮行动地点等于目标地点，优先推进这项任务，不要写成普通地点闲逛或消费。\n- 本轮推进任务时必须附带 quest_intent：{"quest_id":${Number(activeQuestClaim.quest_id || activeQuestClaim.id || 0)},"stage":"${nextQuestIntentStage}"}。\n- 任务文案必须出现可评分的具体行动：寻找/接触目标、确认情况、动手处理、护送、交付、汇报、解决阻碍等，按任务要求选择。\n- 如果目标地点是赌场，但任务不是“参与赌博”，不要写下注、轮盘、骰宝、牌局输赢或自行消遣；赌场只是任务发生地点。`;
        }

        return {
            openTasks,
            personalTask
        };
    }

function buildSurvivalPrompt(districts, char, inventory, activeEvents, universalContext, targetDistrict, questContext = null, promptDb = null, options = {}) {
        const energySources = [];
        const resourceGens = [];
        const medicals = [];
        const statTrainers = [];
        const gambles = [];
        const leisures = [];

        for (const d of districts) {
            if (d.type === 'medical' || d.id === 'hospital') {
                medicals.push('[' + d.id.toUpperCase() + ']');
            } else if (d.type === 'gambling' || d.id === 'casino') {
                gambles.push('[' + d.id.toUpperCase() + ']');
            } else if (d.cal_cost > 0 && d.money_cost > 0) {
                statTrainers.push('[' + d.id.toUpperCase() + ']'); // e.g., School
            } else if (d.money_cost > 0 && d.cal_reward > 0) {
                energySources.push('[' + d.id.toUpperCase() + ']'); // e.g., Restaurant, Convenience
            } else if (d.cal_cost > 0 && d.money_reward > 0) {
                resourceGens.push('[' + d.id.toUpperCase() + ']'); // e.g., Factory
            } else {
                leisures.push('[' + d.id.toUpperCase() + ']'); // e.g., Park, Home
            }
        }

        const inventoryLimit = Number(promptDb?.city?.getInventorySlotLimit?.() || 10);
        const safeInventoryLimit = Number.isSafeInteger(inventoryLimit) && inventoryLimit > 0 ? inventoryLimit : 10;
        const inventorySlots = Array.isArray(inventory) ? inventory.length : 0;
        const inventoryQuantity = Array.isArray(inventory)
            ? inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0)
            : 0;
        const isInventoryOverLimit = inventoryQuantity > safeInventoryLimit;
        const inventoryBlock = buildInventoryPromptBlock(promptDb, inventory);
        const foodItems = inventory.filter(i => i.cal_restore > 0);
        const optionsBlock = getCachedCityPromptBlock(
            dependencies.context.getUserDb(char.user_id || 'default'),
            char.id,
            'city_survival_options_v2',
            {
                inventory_limit: safeInventoryLimit,
                inventory_slots: inventorySlots,
                inventory_quantity: inventoryQuantity,
                districts: districts.map(d => ({
                    id: d.id,
                    name: d.name,
                    emoji: d.emoji,
                    description: d.description,
                    type: d.type,
                    cal_cost: d.cal_cost,
                    cal_reward: d.cal_reward,
                    money_cost: d.money_cost,
                    money_reward: d.money_reward
                })),
                foodItems: foodItems.map(f => ({
                    id: f.item_id || f.id,
                    name: f.name,
                    emoji: f.emoji,
                    quantity: f.quantity,
                    cal_restore: f.cal_restore
                }))
            },
            () => {
                let options = '';
                for (const d of districts) {
                    const effects = [];
                    if (d.cal_cost > 0) effects.push(`-${d.cal_cost}体力`);
                    if (d.cal_reward > 0) effects.push(`+${d.cal_reward}体力`);
                    if (d.money_cost > 0) effects.push(`-${d.money_cost}金币`);
                    if (d.money_reward > 0) effects.push(`+${d.money_reward}金币`);
                    const req = d.money_cost > 0 ? ` 需${d.money_cost}金` : '';
                    options += `[${d.id.toUpperCase()}] ${d.emoji} ${d.name} | ${effects.join(', ') || '无明显代价'}${req} | ${d.description}\n`;
                }
                if (foodItems.length > 0) {
                    const foodList = foodItems.map(f => `${f.emoji}${f.name}x${f.quantity}(+${f.cal_restore})`).join(', ');
                    options += `[EAT_ITEM] 🍜 吃背包食物 | ${foodList}\n`;
                }
                if (isInventoryOverLimit) {
                    options += `[ORGANIZE_BAG] 🎒 整理背包 | 背包太重，超过 ${safeInventoryLimit} 件；这一轮只整理背包，保留 ${safeInventoryLimit} 件，其他由角色自己处理\n`;
                }
                return options.trim();
            }
        );

        let eventInfo = '';
        if (activeEvents && activeEvents.length > 0) {
            eventInfo = '\n[城市事件] ' + activeEvents.map(e => `${e.emoji}${e.title}`).join('、');
        }

        const cal = char.calories ?? 2000;
        const wallet = char.wallet ?? 200;
        const state = dependencies.normalizeSurvivalState(char);
        const physicalCondition = dependencies.getPhysicalCondition(char, state, cal);
        const stateFlags = [];

        if (char.city_status === 'coma') stateFlags.push('危险状态=接近失去意识');
        else if (cal <= 300) stateFlags.push('饥饿等级=极度虚弱');
        else if (cal <= 1000) stateFlags.push('饥饿等级=明显饥饿');
        else if (cal >= 3500) stateFlags.push('饱腹等级=过饱');

        if (wallet <= 10) stateFlags.push('钱包状态=极度拮据');

        let taskInstruction = '【自由探索】在别饿晕、别破产的前提下，按性格/身体/钱包/最近经历决定下一步去哪。';
        if (targetDistrict) {
            taskInstruction = `【既定意愿】你已经决定要去 [${targetDistrict.id.toUpperCase()}] ${targetDistrict.name}。身体状态、情绪和钱包只影响你到了之后的表现、效率和后果，不改变目的地本身。当前位置标签也必须跟随这次真实去到的地点。`;
        }
        const questOpenBlock = questContext?.openTasks?.length > 0 ? `\n[公告栏悬赏]\n${questContext.openTasks.join('\n')}` : '';
        const personalQuestBlock = questContext?.personalTask || '';
        const promptHistoryDb = promptDb || dependencies.ensureCityDb(dependencies.context.getUserDb(char.user_id || 'default'));
        const continuityDistrict = targetDistrict || districts.find((entry) => entry.id === char.location) || null;
        const antiRepeatBlock = buildRecentNarrationAntiRepeatBlock(promptHistoryDb, char, continuityDistrict || { type: '', id: '' });
        const typedAntiRepeatBlock = dependencies.formatTypedAntiRepeatBlock(universalContext?.antiRepeatHints, {
            include: ['private_character_replies', 'city_private_outreach', 'city_self_logs'],
            maxPerType: 4,
            maxTextLen: 220,
            mode: 'city_chat',
            title: '[大输入库分型防复读]'
        });
        const privateChatAntiRepeatBlock = typedAntiRepeatBlock || buildRecentPrivateChatAntiRepeatBlock(promptHistoryDb, char);
        const freshPrivateChatTailBlock = buildFreshPrivateChatTailBlock(promptHistoryDb, char);

        let hardConstraintText = '';
        if (state.energy < 20) {
            hardConstraintText += '\n- 精力极低：别再做高消耗。';
        } else if (state.energy < 35) {
            hardConstraintText += '\n- 精力偏低：持续活动会更累。';
        } else if (state.energy > 85) {
            hardConstraintText += '\n- 精力很高：行动欲更强。';
        } else if (state.energy > 70) {
            hardConstraintText += '\n- 精力不错：做事更顺。';
        }
        if (state.sleep_debt > 85) {
            hardConstraintText += '\n- 严重欠觉：脑钝、脾气脆。';
        } else if (state.sleep_debt > 60) {
            hardConstraintText += '\n- 比较缺觉：耐心和专注下降。';
        }
        if (state.health < 25) {
            hardConstraintText += '\n- 身体很差：病感/虚弱明显。';
        } else if (state.health < 45) {
            hardConstraintText += '\n- 身体不适：承受力和恢复更差。';
        }
        if (state.satiety < 20) {
            hardConstraintText += '\n- 很饿：注意力被饥饿拖走。';
        }
        if (state.stomach_load > 80) {
            hardConstraintText += '\n- 很撑：动作慢，易困烦。';
        } else if (state.stomach_load > 55) {
            hardConstraintText += '\n- 有点撑：身体不轻快。';
        }
        const emotionGuidance = dependencies.getEmotionBehaviorGuidance(char);
        hardConstraintText += `\n- 主情绪：${emotionGuidance.emotion.label} ${emotionGuidance.emotion.emoji}`;
        hardConstraintText += `\n- 情绪感受：${emotionGuidance.cityAction}`;
        const housingPromptBlock = dependencies.buildHousingPromptBlock(promptHistoryDb, char);

        return `[世界背景]
${universalContext?.contextPreamble ?? universalContext?.preamble ?? ''}

[任务]
你在商业街真实生活。按此刻状态决定下一步去哪，不要把世界解释成系统。

[地点分类]
- 补体力：${energySources.join(', ') || '暂无'}
- 赚钱：${resourceGens.join(', ') || '暂无'}
- 医疗：${medicals.join(', ') || '暂无'}
- 训练：${statTrainers.join(', ') || '暂无'}
- 高风险：${gambles.join(', ') || '暂无'}
- 休闲：${leisures.join(', ') || '暂无'}

[当前状态]
地点=${char.location || '未知'} | 状态=${char.city_status || '健康'}
体力=${cal}/4000 | 金币=${wallet}
精力=${state.energy} 睡眠债=${state.sleep_debt} 心情=${state.mood} 压力=${state.stress}
社交需求=${state.social_need} 健康=${state.health} 饱腹=${state.satiety} 胃负担=${state.stomach_load}
身体等级=${physicalCondition.label} | 后果=${physicalCondition.summary}${stateFlags.length > 0 ? `\n状态标签=${stateFlags.join(' / ')}` : ''}${eventInfo}
${inventoryBlock}
${housingPromptBlock ? '\n' + housingPromptBlock : ''}

${taskInstruction}
[任务机制补充]
- 你也会看到公告栏里的悬赏任务，它和普通商业街活动一样是真实世界信息。
- 如果你想去接某个公告任务，就在输出里额外带上 quest_intent：{"quest_id":任务ID,"stage":"claim"}，并让 action 去往对应地点。
- 如果你已经在做任务，并且本轮行动地点就是任务目标地点，优先推进任务，必须带 stage="progress"；不要写成普通地点玩法。
- 如果你准备交付任务、领取赏金，就额外带上 quest_intent：{"quest_id":任务ID,"stage":"report"}。
- 不要把 quest_intent 当系统说明写进 log，log 仍然必须像普通商业街活动。${questOpenBlock}${personalQuestBlock}
- 如果本轮行动意图是“接下某个公告任务 / 开始执行某个公告任务 / 推进手上已有任务 / 交付任务”，就要在 JSON 里同步带 quest_intent；不要只在自然文案里表达这个意图却漏掉标签。
- 如果只是看见公告、犹豫、评估要不要接，且没有明确行动，可以不带 quest_intent。
- 任务推进必须贴合任务内容：采购/配送要写拿货、送达；清理/维修要写动手处理；调查类要写打听、寻找、发现；巡逻/护送要写陪同、盯守、来回查看。
- 去错地点、只是在附近闲逛、或者文案和任务不匹配，都不会推进任务进度。
- 如果公告显示已由别人接单/领先，你可以后加入帮忙，但不要在 log/chat/diary 里写自己已经拿到赏金；只有系统确认你抢先正式交付后，才能写领到赏金。
- 如果你没有“你当前手上的公告任务”块，就不能写自己交付任务或领赏，只能写看见、评估、接单、帮忙或普通行动。
- 黑客据点只是地点之一。只有任务内容明确要求监听/入侵/截获情报时，才把行动写成黑客行动；普通公告任务在黑客据点推进时，不要自动写监听记录或截获私聊。
[吃饭/补给语义]
- 餐厅/饭店/现场用餐 = 这轮吃饭并恢复体力。
- 背包里的食物 = 选择 EAT_ITEM 才是当场吃掉并恢复体力。
- 便利店 = 购买包装食品或饮料，默认先放进背包；除非系统明确允许 EAT_ITEM，否则不要把便利店购买写成已经吃完恢复。
- 如果当前真正目标是缓解饥饿、补体力、吃一顿，优先选择餐厅或 EAT_ITEM，而不是便利店 BUY。
- 背包总数超过 10 件时，下一步必须是整理背包；整理时只保留 10 件，其他东西由你自己处理。
[行动约束]${hardConstraintText}

[输出要求]
- 只选一个 action
- log 自然写出这次行动里真正发生的事，要有画面/动作/心理，但不要写成固定模板
- 若想联系玩家再填 chat
- chat 的“主动”优先体现为你主动汇报刚发生的事、自己现在的状态、情绪、处境、发现或决定，而不是默认用寒暄或查岗来拉人回应
- 不要把“你在干嘛 / 你在做什么 / 你在哪 / 忙吗 / 在吗”这种追问当作默认开头，除非这次事件本身真的需要立刻确认用户位置、安危或回应
- 比起泛泛追问，更优先写“我刚刚怎么了 / 我现在什么状态 / 我准备做什么 / 我为什么突然想给你发消息”
- 如果要提问，也要让问题强依附于这次商业街事件本身，而不是空泛地确认用户在不在
- chat 不是正常私聊重 roll；不要复制或近似改写最近私聊已经说过的话
- 若有没说出口的心声再填 diary
- 想花钱但钱不够时，也要把失败尝试真实写进 log
- 不要重复 preamble 里刚做过的地点/动作
- 不要使用高复用套话，不要把“从家离开、肚子里空空的、先把自己安顿好”这类句式当默认开头${freshPrivateChatTailBlock ? freshPrivateChatTailBlock : ''}${antiRepeatBlock ? antiRepeatBlock : ''}${privateChatAntiRepeatBlock ? privateChatAntiRepeatBlock : ''}
- 如果选择 [ORGANIZE_BAG]，必须额外返回 inventory_keep，列出你最终保留的 item_id 和数量；总数量必须等于 ${Math.min(safeInventoryLimit, inventoryQuantity)}，其他东西由你自己处理，log 自由描写这轮整理。

只返回 JSON：
  {
    "action": "[PARK]",
    "log": "自然的行动描写",
    "chat": "（可选）发给玩家的话",
    "diary": "（可选）内心独白",
    "quest_intent": { "quest_id": 12, "stage": "claim|progress|report" }
  }

  [可选行动]
  ${optionsBlock}`;
    }

function buildSocialPrompt(charA, charB, district, relAB, relBA, inventoryA, inventoryB, universalContextA, universalContextB, userName = '玩家') {
        const personaA = (charA.persona || charA.system_prompt || '普通人').substring(0, 120);
        const personaB = (charB.persona || charB.system_prompt || '普通人').substring(0, 120);
        const invAStr = inventoryA.slice(0, 5).map(formatInventoryItemForPrompt).join(', ') || '空';
        const invBStr = inventoryB.slice(0, 5).map(formatInventoryItemForPrompt).join(', ') || '空';
        const affinityAB = relAB?.affinity ?? 50;
        const affinityBA = relBA?.affinity ?? 50;
        const impressionAB = relAB?.impression ? `印象: "${relAB.impression}"` : '';

        return `[商业街偶遇]
两名独立生活角色在 ${district.emoji}${district.name} 偶遇。基于各自上下文，写一小段自然互动。

====== A(${charA.name}) 上下文 ======
${universalContextA?.preamble || ''}
====== B(${charB.name}) 上下文 ======
${universalContextB?.preamble || ''}

[角色摘要]
A=${charA.name}(${personaA}) | 背包=${invAStr} | 金币=${charA.wallet ?? 0} | 对B好感=${affinityAB} ${impressionAB}
B=${charB.name}(${personaB}) | 背包=${invBStr} | 金币=${charB.wallet ?? 0} | 对A好感=${affinityBA}

[约束]
- 可寒暄、试探、送礼、错开、简聊
- 对玩家(${userName})的占有欲/嫉妒默认只指向玩家，不要无故转移到对方
- 若对对方表现敌意或酸意，必须来自这次现场触发或既有关系

只返回 JSON：
  {
    "dialogue": "2-4句具体、生动的互动描写，包含动作和神态细节",
    "gift_from": "${charA.id}|${charB.id}|null",
  "gift_item_id": "物品ID或null",
  "affinity_delta_a": 0,
  "affinity_delta_b": 0,
  "chat_a": "A发给${userName}的私聊，可为空",
  "diary_a": "A写的日记，可为空",
  "chat_b": "B发给${userName}的私聊，可为空",
  "diary_b": "B写的日记，可为空"
}`;
    }

function parseJsonObjectFromLlmText(text) {
        const cleaned = String(text || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
        if (!cleaned) return null;
        try {
            return JSON.parse(cleaned);
        } catch (err) {
            const repaired = dependencies.repairUnescapedJsonStringQuotes(cleaned);
            if (repaired !== cleaned) {
                try {
                    return JSON.parse(repaired);
                } catch (_) { }
            }
            throw err;
        }
    }

async function fetchBehaviorModelList(endpoint, key, timeoutMs = 18000) {
        const apiEndpoint = String(endpoint || '').trim();
        const apiKey = String(key || '').trim();
        if (!apiEndpoint || !apiKey) throw new Error('Missing endpoint or key');
        const modelsUrl = await dependencies.buildOpenAiCompatibleUrlResolved(apiEndpoint, 'models', { label: 'Endpoint' });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(modelsUrl, {
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                redirect: 'manual',
                signal: controller.signal
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
            }
            const data = await response.json();
            return (data.data || data.models || []).map((model) => model.id || model.name || model).filter(Boolean).sort();
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error('请求超时');
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

function resolveBehaviorSummaryModelConfig(character = {}) {
        return {
            endpoint: character.memory_api_endpoint || character.api_endpoint || '',
            key: character.memory_api_key || character.api_key || '',
            model: character.memory_model_name || character.model_name || ''
        };
    }

function escapeBehaviorPromptRegex(value = '') {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

function personalizeBehaviorPromptText(text = '', userDisplayName = '') {
        const displayName = dependencies.limitText(userDisplayName, 80);
        const source = String(text || '');
        if (!displayName || displayName === '用户' || displayName === '玩家') return source;
        const personalized = source.replace(/玩家|用户/g, displayName);
        const escapedName = escapeBehaviorPromptRegex(displayName);
        return personalized.replace(new RegExp(`${escapedName}（${escapedName}小人）`, 'g'), `${displayName}小人`);
    }

function shouldPersonalizeBehaviorPromptKey(key = '') {
        const normalizedKey = String(key || '');
        if (!normalizedKey) return true;
        if (dependencies.behaviorPromptProtocolKeys.has(normalizedKey)) return false;
        if (/_ids?$/.test(normalizedKey) || /Ids?$/.test(normalizedKey)) return false;
        return true;
    }

function personalizeBehaviorPromptValue(value, userDisplayName = '', key = '') {
        if (typeof value === 'string') {
            return shouldPersonalizeBehaviorPromptKey(key)
                ? personalizeBehaviorPromptText(value, userDisplayName)
                : value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => personalizeBehaviorPromptValue(item, userDisplayName, key));
        }
        if (value && typeof value === 'object') {
            return Object.entries(value).reduce((result, [entryKey, entryValue]) => {
                result[entryKey] = personalizeBehaviorPromptValue(entryValue, userDisplayName, entryKey);
                return result;
            }, {});
        }
        return value;
    }

async function createBehaviorBranchWithModel(char, inputPackage, payload = {}, db = null) {
        const payloadEndpoint = dependencies.limitText(payload.api_endpoint || payload.endpoint || '', 500);
        const payloadKey = String(payload.api_key || payload.key || '').trim();
        const usePayloadCredentials = Boolean(payloadEndpoint && payloadKey);
        const apiEndpoint = usePayloadCredentials ? payloadEndpoint : dependencies.limitText(char?.api_endpoint || '', 500);
        const apiKey = usePayloadCredentials ? payloadKey : String(char?.api_key || '').trim();
        const payloadModelName = dependencies.limitText(payload.model_name || payload.model || '', 200);
        const modelName = usePayloadCredentials
            ? dependencies.limitText(payloadModelName || char?.model_name || '', 200)
            : dependencies.limitText(char?.model_name || '', 200);
        if (!apiEndpoint || !apiKey || !modelName) {
            throw dependencies.createCityError('行为树生成缺少模型 URL/Key/模型名，请补全后重试。', 400, true);
        }
        const sceneContext = inputPackage?.scene_context && typeof inputPackage.scene_context === 'object'
            ? inputPackage.scene_context
            : dependencies.inferBehaviorScene(payload, inputPackage?.world || {});
        const promptUserDisplayName = inputPackage?.user?.name || inputPackage?.user?.display_name || '';
        const personalizePrompt = (text) => personalizeBehaviorPromptText(text, promptUserDisplayName);
        const messages = [
            {
                role: 'system',
                content: personalizePrompt([
                    `你是“${sceneContext.runtime_name || '单角色街区行为运行时 V1'}”的完整行为树 patch 生成器。`,
                    '你只返回一个 JSON 对象，不要输出 markdown、解释或额外文本。',
                    '格式硬规则：第一个字符必须是 {，最后一个字符必须是 }；不要先分析、不要写 Let me analyze、不要列思路。',
                    'JSON 字符串内部不要使用未转义英文双引号；引用玩家选项或短语时请用中文引号「」或转义成 \\"。',
                    '你的任务不是替换整棵树，而是基于 input.behavior_tree 返回一个局部 patch，合并进现有完整行为树。',
                    '基础枝丫是角色无玩家互动时自己的生活、闲逛、地点行为；玩家互动后的后续分歧才叫特殊枝丫。',
                    '本接口正在响应玩家互动，所以 patch.operation 固定为 upsert_child，target_node_id 必须是 player_interaction，并设置 next_active_node_id 为本次 node.id。',
                    '这通常是玩家在预制互动枝丫末尾选择某个回应后的后续枝丫；请承接 input.player_event，不要重复预制开场。',
                    '特殊枝丫最后一步必须是 offer_choices，给 2-4 个玩家回应选项；choice.trigger 必须来自玩家互动动作白名单。',
                    '活跃度规则：每条特殊枝丫在 offer_choices 前要有 3-5 个可见步骤，至少 1 个身体动作或移动步骤，至少 2 个 say/emote；不要只站着说一句就给选项。',
                    '硬规则：任何 choice.trigger 为 suggest_destination 的选项，都必须填写 choice.place_id，且必须从 input.world.allowed_place_ids 选择；这是前端判断目的地的必填协议字段，不能只把地点写进 label。',
                    'input.recent_special_interactions 是最近特殊互动台词，禁止复写这些台词、开头、收尾或同一情绪推进。',
                    `你可以读取 input.large_input，但它只是背景材料。${sceneContext.blocked_context_label || '最近私聊、商业街活动记录、公告任务'}不能作为小人移动、发起互动、改变目的地或重写基础枝丫的原因。`,
                    '特殊枝丫只能由当前 input.player_event 触发；基础枝丫只由 runtime_state、location、nearby_player、otherwise、idle 等本地运行时触发。',
                    `角色可以自由决定在${sceneContext.activity_label || '商业街'}做什么，但不要输出 x/y、像素坐标、锚点或碰撞信息。`,
                    sceneContext.layout_rule || '',
                    '如果要移动，node.steps.action 必须从 input.world.allowed_movement_actions 里选择。',
                    '如果动作需要地点，place_id/from_place_id/to_place_id 必须从 input.world.allowed_place_ids 里选择。',
                    '不要编造表外地点、表外动作、像素点或地图对象。',
                    `node.steps.action 只能使用：${dependencies.behaviorTreeAllowedActions.join(', ')}。`
                ].filter(Boolean).join('\n'))
            },
            {
                role: 'user',
                content: personalizePrompt([
                    '基于下面输入，为角色小人生成一个短小、可玩、能合并进完整行为树的局部 patch。',
                    `优先且只响应当前 player_event。large_input.preamble 可以帮助理解角色语气和背景，但不要因为${sceneContext.blocked_context_label || '最近私聊或商业街活动记录'}让角色行动。`,
                    '请把玩家互动造成的分歧写成 player_interaction 下的新 ActionSequence 节点；不要改写基础枝丫，除非输入明确要求重规划角色的无互动默认行为。',
                    '如果 input.behavior_tree.patch_history 里已有上一轮互动，请让新 node 承接上一轮，而不是重复开场。',
                    '如果 input.recent_special_interactions 有内容，请承接最近状态并换新的推进，不要复用里面的句子或相同问法。',
                    '让角色更像正在场景里活动：先有靠近、转身、停顿、看向地点、走两步或整理东西，再说短句；台词每句短一点，但可以有 2 句。',
                    '最后给出 offer_choices 让玩家继续选择；这些选择会触发下一轮特殊枝丫生成。',
                    `world 是${sceneContext.world_description || '语义街区，不是大世界地图'}；不要让角色选择具体像素点。`,
                    `world.places_ordered 是${sceneContext.place_table_label || '从左到右的可用建筑表'}，world.allowed_place_ids 是唯一可用地点 ID 白名单。`,
                    'world.allowed_movement_actions 是唯一可用移动动作白名单。',
                    sceneContext.layout_rule || '',
                    '输出格式必须符合 input.output_contract.schema。',
                    '',
                    JSON.stringify(inputPackage, null, 2)
                ].filter(Boolean).join('\n'))
            }
        ];
        recordCityLlmDebug(db, char, 'input', 'city_behavior_branch', messages, {
            model: modelName,
            action: inputPackage?.player_event?.action || '',
            placeId: inputPackage?.player_event?.place_id || ''
        });
        let rawOutput = '';
        try {
            rawOutput = await dependencies.callLLM({
                endpoint: apiEndpoint,
                key: apiKey,
                model: modelName,
                messages,
                maxTokens: null,
                temperature: 0.72,
                responseFormat: { type: 'json_object' },
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_behavior_branch', {
                    action: inputPackage?.player_event?.action || '',
                    placeId: inputPackage?.player_event?.place_id || ''
                })
            });
        } catch (err) {
            throw dependencies.createCityError(`行为树生成请求失败，请重试：${err.message}`, 502, true);
        }
        recordCityLlmDebug(db, char, 'output', 'city_behavior_branch', rawOutput, {
            model: modelName,
            action: inputPackage?.player_event?.action || '',
            placeId: inputPackage?.player_event?.place_id || ''
        });
        let parsed = null;
        let jsonRetryUsed = false;
        try {
            parsed = parseJsonObjectFromLlmText(rawOutput);
        } catch (err) {
            const retryMessages = [
                ...messages,
                {
                    role: 'user',
                    content: personalizePrompt([
                        `上一轮输出不是完整 JSON（${dependencies.limitText(err.message || 'parse_failed', 160)}）。`,
                        '请完全重新输出一次，不要续写上一轮内容。',
                        '只返回一个完整 JSON 对象；第一个字符必须是 {，最后一个字符必须是 }。',
                        '不要 markdown，不要解释，不要分析过程，不要输出代码块。'
                    ].join('\n'))
                }
            ];
            recordCityLlmDebug(db, char, 'input', 'city_behavior_branch', retryMessages, {
                model: modelName,
                action: inputPackage?.player_event?.action || '',
                placeId: inputPackage?.player_event?.place_id || '',
                jsonRetry: true,
                parseError: dependencies.limitText(err.message || 'parse_failed', 160)
            });
            try {
                rawOutput = await dependencies.callLLM({
                    endpoint: apiEndpoint,
                    key: apiKey,
                    model: modelName,
                    messages: retryMessages,
                    maxTokens: null,
                    temperature: 0.35,
                    responseFormat: { type: 'json_object' },
                    debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_behavior_branch', {
                        action: inputPackage?.player_event?.action || '',
                        placeId: inputPackage?.player_event?.place_id || '',
                        jsonRetry: true
                    })
                });
            } catch (retryErr) {
                throw dependencies.createCityError(`行为树生成 JSON 重试请求失败，请重试：${retryErr.message}`, 502, true);
            }
            recordCityLlmDebug(db, char, 'output', 'city_behavior_branch', rawOutput, {
                model: modelName,
                action: inputPackage?.player_event?.action || '',
                placeId: inputPackage?.player_event?.place_id || '',
                jsonRetry: true
            });
            jsonRetryUsed = true;
            try {
                parsed = parseJsonObjectFromLlmText(rawOutput);
            } catch (retryErr) {
                throw dependencies.createCityError(`行为树生成返回的 JSON 无法解析，请重试：${retryErr.message || err.message || 'parse_failed'}`, 502, true);
            }
        }
        const treePatch = dependencies.sanitizeBehaviorTreePatch(
            parsed,
            char,
            payload,
            'model_output_invalid',
            inputPackage?.world?.allowed_place_ids || []
        );
        if (!treePatch) {
            throw dependencies.createCityError('行为树生成结果没有可用的行为步骤，请重试。', 502, true);
        }
        const duplicate = dependencies.findDuplicateBehaviorInteraction(treePatch, inputPackage);
        if (duplicate) {
            throw dependencies.createCityError('特殊枝丫生成疑似重复上一轮内容，请重试。', 502, true);
        }
        const branch = {
            branch_id: treePatch.node.id,
            title: treePatch.node.title,
            priority: treePatch.node.priority,
            ttl_ms: treePatch.node.ttl_ms,
            trigger: treePatch.node.trigger,
            summary: treePatch.node.summary,
            steps: treePatch.node.steps
        };
        return {
            tree_patch: treePatch,
            branch,
            raw_output: String(rawOutput || ''),
            json_retry_used: jsonRetryUsed,
            fallback: false
        };
    }

async function createBaseBehaviorBranchesWithModel(char, inputPackage, payload = {}, db = null) {
        const payloadEndpoint = dependencies.limitText(payload.api_endpoint || payload.endpoint || '', 500);
        const payloadKey = String(payload.api_key || payload.key || '').trim();
        const usePayloadCredentials = Boolean(payloadEndpoint && payloadKey);
        const apiEndpoint = usePayloadCredentials ? payloadEndpoint : dependencies.limitText(char?.api_endpoint || '', 500);
        const apiKey = usePayloadCredentials ? payloadKey : String(char?.api_key || '').trim();
        const payloadModelName = dependencies.limitText(payload.model_name || payload.model || '', 200);
        const modelName = usePayloadCredentials
            ? dependencies.limitText(payloadModelName || char?.model_name || '', 200)
            : dependencies.limitText(char?.model_name || '', 200);
        const baseInput = {
            ...inputPackage,
            output_contract: dependencies.getBehaviorBaseOutputContract(inputPackage?.world || {})
        };
        if (!apiEndpoint || !apiKey || !modelName) {
            throw dependencies.createCityError('基础枝丫生成缺少模型 URL/Key/模型名，请补全后重试。', 400, true);
        }
        const sceneContext = baseInput?.scene_context && typeof baseInput.scene_context === 'object'
            ? baseInput.scene_context
            : dependencies.inferBehaviorScene(payload, baseInput?.world || {});
        const requiredAnchorTargets = dependencies.getRequiredRoomAnchorBranchTargets(baseInput);
        const requiredAnchorRule = requiredAnchorTargets.length
            ? [
                `房间锚点驱动硬规则：当前有 ${requiredAnchorTargets.length} 个物件锚点（家具、装饰、地毯、墙饰、灯都算），每个物件锚点都算一个必须生成的基础枝丫目标。`,
                '必须先为 input.world.required_anchor_branches 里的每个物件锚点各写 1 条 target_node_id=place_affordance 的 base_branch；该枝丫步骤必须至少一次引用这个锚点 id 作为 place_id/from_place_id/to_place_id。',
                '不要先构思枝丫再挑锚点；要按 required_anchor_branches 的顺序逐个给物件锚点写枝丫。通用 room-point:center 只能作为辅助移动点，不能替代物件锚点枝丫。',
                `必须覆盖的物件锚点：${requiredAnchorTargets.map((target) => `${target.order}. ${target.label}=${target.id}`).join('；')}`
            ].join('\n')
            : '';
        const promptUserDisplayName = baseInput?.user?.name || baseInput?.user?.display_name || '';
        const personalizePrompt = (text) => personalizeBehaviorPromptText(text, promptUserDisplayName);
        const messages = [
            {
                role: 'system',
                content: personalizePrompt([
                    `你是“${sceneContext.runtime_name || '单角色街区行为运行时 V1'}”的完整行为树初始枝丫包生成器。`,
                    '你只返回一个 JSON 对象，不要输出 markdown、解释或额外文本。',
                    '格式硬规则：第一个字符必须是 {，最后一个字符必须是 }；不要先分析、不要写 Let me analyze、不要列思路。',
                    'JSON 字符串内部不要使用未转义英文双引号；引用玩家选项或短语时请用中文引号「」或转义成 \\"。',
                    `本接口一次性生成完整行为树初始枝丫包：base_branches 是无玩家互动时角色自己在${sceneContext.activity_label || '商业街'}里的生活、闲逛、好奇、地点停留和轻微说话；interaction_branches 是玩家第一次点击打招呼/闲聊/在干嘛等按钮时播放的第一段互动开场。`,
                    'interaction_branches 必须写入 player_interaction，每条对应一个 trigger.player_action，最后一步必须是 offer_choices，给 2-4 个后续选项。',
                    '硬规则：任何 choice.trigger 为 suggest_destination 的选项，都必须填写 choice.place_id，且必须从 input.world.allowed_place_ids 选择；这是前端判断目的地的必填协议字段，不能只把地点写进 label。',
                    'base_branches 不要生成 player_interaction，不要等待玩家选择，不要使用 offer_choices。',
                    '活跃度规则：除 movement_recovery 外，每条 base_branch 要有 4-7 个步骤，至少 2 个身体动作/移动/地点停留步骤，至少 1 个 say，最好再有 1 个 emote；不要输出 wait-only、idle-only 或纯摘要式枝丫。',
                    'interaction_branches 在 offer_choices 前要有 3-5 个可见步骤，至少 1 个身体动作或移动步骤，至少 2 个 say/emote。',
                    `你可以读取 input.large_input，但它只是背景材料。${sceneContext.blocked_context_label || '最近私聊、商业街活动记录、公告任务'}不能作为小人移动、发起互动、改变目的地或重写基础枝丫的原因。`,
                    '基础枝丫只能由 runtime_state、location、nearby_player、otherwise、idle 等本地运行时触发。',
                    'movement_recovery 是运行时移动失败专用基础枝丫；trigger 固定 runtime_state.travel_failed，steps 不要再移动，只用 say/emote/wait/face_player 做短恢复反应。',
                    '互动开场枝丫只能由当前场景内玩家主动点击触发，不要写成模型刚看见私聊后主动说话。',
                    `角色可以自由决定在${sceneContext.activity_label || '商业街'}做什么，但不要输出 x/y、像素坐标、锚点或碰撞信息。`,
                    sceneContext.layout_rule || '',
                    '如果要移动，steps.action 必须从 input.world.allowed_movement_actions 里选择。',
                    '如果动作需要地点，place_id/from_place_id/to_place_id 必须从 input.world.allowed_place_ids 里选择。',
                    '不要编造表外地点、表外动作、像素点或地图对象。',
                    requiredAnchorRule,
                    '生成 8 到 14 条基础枝丫，尽量分布到 hard_needs/routine_goal/place_affordance/background_mood/curiosity/wander/idle_micro；可以额外给 movement_recovery 生成 1 条移动失败恢复枝丫。',
                    '生成 4 到 8 条互动开场枝丫，优先覆盖 greet、small_talk、ask_current_action、ask_destination、request_company、comfort。',
                    `base_branches.steps.action 只能使用：${dependencies.behaviorTreeAllowedActions.filter((action) => action !== 'offer_choices').join(', ')}。`,
                    `interaction_branches.steps.action 只能使用：${dependencies.behaviorTreeAllowedActions.join(', ')}。`
                ].filter(Boolean).join('\n'))
            },
            {
                role: 'user',
                content: personalizePrompt([
                    '基于下面输入，一次性生成完整行为树初始枝丫包。',
                    'base_branches 会写入完整行为树的基础分类节点；movement_recovery 只在循迹失败时触发，不进入普通自动轮询。',
                    'interaction_branches 会写入 player_interaction，玩家点击对应互动按钮时先执行这一段，末尾 choices 再触发下一轮特殊枝丫实时生成。',
                    'base_branches 每条 4-7 个步骤，至少包含 2 个移动/身体动作/idle_at_place/browse_near/loop_in_front_of/patrol_segment/wander_between 步骤，且至少 1 个 say；可以再穿插 1 个 emote。',
                    'interaction_branches 每条 4-6 个步骤，必须短、像第一段临场开场；最后一步 offer_choices，前面至少 2 个 say/emote 和 1 个身体动作或移动步骤。',
                    requiredAnchorRule,
                    `不要因为${sceneContext.blocked_context_label || '最近私聊或商业街活动记录'}让角色行动；它们只能影响语气、轻微心情和说话风格。`,
                    `world 是${sceneContext.world_description || '语义街区，不是大世界地图'}；world.allowed_place_ids 是唯一可用地点 ID 白名单。`,
                    sceneContext.layout_rule || '',
                    '输出格式必须是：{"base_branches":[...],"interaction_branches":[...]}，每项分别符合 input.output_contract.schema.base_branches[0] 和 input.output_contract.schema.interaction_branches[0]。',
                    '',
                    JSON.stringify(baseInput, null, 2)
                ].filter(Boolean).join('\n'))
            }
        ];
        recordCityLlmDebug(db, char, 'input', 'city_behavior_base_branches', messages, {
            model: modelName,
            placeCount: Array.isArray(baseInput?.world?.allowed_place_ids) ? baseInput.world.allowed_place_ids.length : 0
        });
        let rawOutput = '';
        try {
            rawOutput = await dependencies.callLLM({
                endpoint: apiEndpoint,
                key: apiKey,
                model: modelName,
                messages,
                maxTokens: null,
                temperature: 0.72,
                responseFormat: { type: 'json_object' },
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_behavior_base_branches', {
                    placeCount: Array.isArray(baseInput?.world?.allowed_place_ids) ? baseInput.world.allowed_place_ids.length : 0
                })
            });
        } catch (err) {
            throw dependencies.createCityError(`基础枝丫生成请求失败，请重试：${err.message}`, 502, true);
        }
        recordCityLlmDebug(db, char, 'output', 'city_behavior_base_branches', rawOutput, {
            model: modelName,
            placeCount: Array.isArray(baseInput?.world?.allowed_place_ids) ? baseInput.world.allowed_place_ids.length : 0
        });
        let parsed = null;
        let jsonRetryUsed = false;
        try {
            parsed = parseJsonObjectFromLlmText(rawOutput);
        } catch (err) {
            const retryMessages = [
                ...messages,
                {
                    role: 'user',
                    content: personalizePrompt([
                        `上一轮输出不是完整 JSON（${dependencies.limitText(err.message || 'parse_failed', 160)}）。`,
                        '请完全重新输出一次，不要续写上一轮内容。',
                        '只返回一个完整 JSON 对象；第一个字符必须是 {，最后一个字符必须是 }。',
                        '输出格式只允许是 {"base_branches":[...],"interaction_branches":[...]}。',
                        '不要 markdown，不要解释，不要分析过程，不要输出代码块。'
                    ].join('\n'))
                }
            ];
            recordCityLlmDebug(db, char, 'input', 'city_behavior_base_branches', retryMessages, {
                model: modelName,
                placeCount: Array.isArray(baseInput?.world?.allowed_place_ids) ? baseInput.world.allowed_place_ids.length : 0,
                jsonRetry: true,
                parseError: dependencies.limitText(err.message || 'parse_failed', 160)
            });
            try {
                rawOutput = await dependencies.callLLM({
                    endpoint: apiEndpoint,
                    key: apiKey,
                    model: modelName,
                    messages: retryMessages,
                    maxTokens: null,
                    temperature: 0.35,
                    responseFormat: { type: 'json_object' },
                    debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_behavior_base_branches', {
                        placeCount: Array.isArray(baseInput?.world?.allowed_place_ids) ? baseInput.world.allowed_place_ids.length : 0,
                        jsonRetry: true
                    })
                });
            } catch (retryErr) {
                throw dependencies.createCityError(`基础枝丫生成 JSON 重试请求失败，请重试：${retryErr.message}`, 502, true);
            }
            recordCityLlmDebug(db, char, 'output', 'city_behavior_base_branches', rawOutput, {
                model: modelName,
                placeCount: Array.isArray(baseInput?.world?.allowed_place_ids) ? baseInput.world.allowed_place_ids.length : 0,
                jsonRetry: true
            });
            jsonRetryUsed = true;
            try {
                parsed = parseJsonObjectFromLlmText(rawOutput);
            } catch (retryErr) {
                throw dependencies.createCityError(`基础枝丫生成返回的 JSON 无法解析，请重试：${retryErr.message || err.message || 'parse_failed'}`, 502, true);
            }
        }
        const sanitized = dependencies.sanitizeBaseBehaviorBranchPack(
            parsed,
            char,
            payload,
            'model_output_invalid',
            inputPackage?.world?.allowed_place_ids || []
        );
        const interactionStarterPack = dependencies.sanitizeBehaviorInteractionStarterPack(
            parsed,
            char,
            payload,
            'model_output_invalid',
            inputPackage?.world?.allowed_place_ids || []
        );
        if (!sanitized.base_patches.length) {
            throw dependencies.createCityError('基础枝丫生成结果没有可用的行为步骤，请重试。', 502, true);
        }
        const missingRequiredAnchors = dependencies.findMissingRequiredRoomAnchorBranches(sanitized.base_branches, baseInput);
        if (missingRequiredAnchors.length) {
            throw dependencies.createCityError(
                `基础枝丫生成未覆盖当前物件锚点：${missingRequiredAnchors.map((target) => target.label || target.id).join('、')}。请重试。`,
                502,
                true
            );
        }
        if (!interactionStarterPack.interaction_patches.length) {
            throw dependencies.createCityError('互动开场枝丫生成结果没有可用的行为步骤，请重试。', 502, true);
        }
        return {
            ...sanitized,
            ...interactionStarterPack,
            raw_output: String(rawOutput || ''),
            base_json_retry_used: jsonRetryUsed,
            json_retry_used: jsonRetryUsed,
            fallback: false
        };
    }

async function createBehaviorInteractionStarterBranchesWithModel(char, inputPackage, payload = {}, db = null) {
        const payloadEndpoint = dependencies.limitText(payload.api_endpoint || payload.endpoint || '', 500);
        const payloadKey = String(payload.api_key || payload.key || '').trim();
        const usePayloadCredentials = Boolean(payloadEndpoint && payloadKey);
        const apiEndpoint = usePayloadCredentials ? payloadEndpoint : dependencies.limitText(char?.api_endpoint || '', 500);
        const apiKey = usePayloadCredentials ? payloadKey : String(char?.api_key || '').trim();
        const payloadModelName = dependencies.limitText(payload.model_name || payload.model || '', 200);
        const modelName = usePayloadCredentials
            ? dependencies.limitText(payloadModelName || char?.model_name || '', 200)
            : dependencies.limitText(char?.model_name || '', 200);
        const starterInput = {
            ...inputPackage,
            output_contract: dependencies.getBehaviorInteractionStarterOutputContract(inputPackage?.world || {})
        };
        if (!apiEndpoint || !apiKey || !modelName) {
            throw dependencies.createCityError('互动开场枝丫生成缺少模型 URL/Key/模型名，请补全后重试。', 400, true);
        }
        const sceneContext = starterInput?.scene_context && typeof starterInput.scene_context === 'object'
            ? starterInput.scene_context
            : dependencies.inferBehaviorScene(payload, starterInput?.world || {});
        const promptUserDisplayName = starterInput?.user?.name || starterInput?.user?.display_name || '';
        const personalizePrompt = (text) => personalizeBehaviorPromptText(text, promptUserDisplayName);
        const messages = [
            {
                role: 'system',
                content: personalizePrompt([
                    `你是“${sceneContext.runtime_name || '单角色街区行为运行时 V1'}”的玩家互动开场枝丫包生成器。`,
                    '你只返回一个 JSON 对象，不要输出 markdown、解释或额外文本。',
                    '格式硬规则：第一个字符必须是 {，最后一个字符必须是 }；不要先分析、不要写 Let me analyze、不要列思路。',
                    'JSON 字符串内部不要使用未转义英文双引号；引用玩家选项或短语时请用中文引号「」或转义成 \\"。',
                    '本接口只生成 interaction_branches：玩家第一次点击打招呼/闲聊/在干嘛等按钮时播放的第一段互动开场。',
                    '严禁输出 base_branches、hard_needs、routine_goal、place_affordance、background_mood、curiosity、wander、idle_micro 或 movement_recovery；基础日常枝丫已由第一次模型调用生成。',
                    'interaction_branches 必须写入 player_interaction，每条对应一个 trigger.player_action，最后一步必须是 offer_choices，给 2-4 个后续选项。',
                    '硬规则：任何 choice.trigger 为 suggest_destination 的选项，都必须填写 choice.place_id，且必须从 input.world.allowed_place_ids 选择；这是前端判断目的地的必填协议字段，不能只把地点写进 label。',
                    '互动开场枝丫只能由当前场景内玩家主动点击触发，不要写成模型刚看见私聊后主动说话。',
                    '每条 interaction_branch 在 offer_choices 前要有 3-5 个可见步骤，至少 1 个身体动作或移动步骤，至少 2 个 say/emote。',
                    `你可以读取 input.large_input，但它只是背景材料。${sceneContext.blocked_context_label || '最近私聊、商业街活动记录、公告任务'}不能作为小人移动、发起互动、改变目的地或重写基础枝丫的原因。`,
                    `角色可以自由决定在${sceneContext.activity_label || '商业街'}如何接住玩家互动，但不要输出 x/y、像素坐标、锚点或碰撞信息。`,
                    sceneContext.layout_rule || '',
                    '如果要移动，steps.action 必须从 input.world.allowed_movement_actions 里选择。',
                    '如果动作需要地点，place_id/from_place_id/to_place_id 必须从 input.world.allowed_place_ids 里选择。',
                    '不要编造表外地点、表外动作、像素点或地图对象。',
                    '生成 4 到 8 条互动开场枝丫，优先覆盖 greet、small_talk、ask_current_action、ask_destination、request_company、comfort。',
                    `interaction_branches.trigger.player_action 只能使用：${dependencies.behaviorPlayerInteractionActions.join(', ')}。`,
                    `interaction_branches.steps.action 只能使用：${dependencies.behaviorTreeAllowedActions.join(', ')}。`
                ].filter(Boolean).join('\n'))
            },
            {
                role: 'user',
                content: personalizePrompt([
                    '基于下面输入，只生成玩家互动开场枝丫。',
                    'interaction_branches 会写入 player_interaction，玩家点击对应互动按钮时先执行这一段，末尾 choices 再触发下一轮特殊枝丫实时生成。',
                    '不要输出 base_branches，也不要输出任何基础日常分类节点。',
                    'interaction_branches 每条 4-6 个步骤，必须短、像第一段临场开场；最后一步 offer_choices，前面至少 2 个 say/emote 和 1 个身体动作或移动步骤。',
                    `不要因为${sceneContext.blocked_context_label || '最近私聊或商业街活动记录'}让角色行动；它们只能影响语气、轻微心情和说话风格。`,
                    `world 是${sceneContext.world_description || '语义街区，不是大世界地图'}；world.allowed_place_ids 是唯一可用地点 ID 白名单。`,
                    sceneContext.layout_rule || '',
                    '输出格式必须是：{"interaction_branches":[...]}，每项符合 input.output_contract.schema.interaction_branches[0]。',
                    '',
                    JSON.stringify(starterInput, null, 2)
                ].filter(Boolean).join('\n'))
            }
        ];
        const debugMeta = {
            model: modelName,
            placeCount: Array.isArray(starterInput?.world?.allowed_place_ids) ? starterInput.world.allowed_place_ids.length : 0,
            actionCount: dependencies.behaviorPlayerInteractionActions.length
        };
        recordCityLlmDebug(db, char, 'input', 'city_behavior_interaction_starters', messages, debugMeta);
        let rawOutput = '';
        try {
            rawOutput = await dependencies.callLLM({
                endpoint: apiEndpoint,
                key: apiKey,
                model: modelName,
                messages,
                maxTokens: null,
                temperature: 0.72,
                responseFormat: { type: 'json_object' },
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_behavior_interaction_starters', debugMeta)
            });
        } catch (err) {
            throw dependencies.createCityError(`互动开场枝丫生成请求失败，请重试：${err.message}`, 502, true);
        }
        recordCityLlmDebug(db, char, 'output', 'city_behavior_interaction_starters', rawOutput, debugMeta);
        let parsed = null;
        let jsonRetryUsed = false;
        try {
            parsed = parseJsonObjectFromLlmText(rawOutput);
        } catch (err) {
            const retryMessages = [
                ...messages,
                {
                    role: 'user',
                    content: personalizePrompt([
                        `上一轮输出不是完整 JSON（${dependencies.limitText(err.message || 'parse_failed', 160)}）。`,
                        '请完全重新输出一次，不要续写上一轮内容。',
                        '只返回一个完整 JSON 对象；第一个字符必须是 {，最后一个字符必须是 }。',
                        '输出格式只允许是 {"interaction_branches":[...]}，不要输出 base_branches。',
                        '不要 markdown，不要解释，不要分析过程，不要输出代码块。'
                    ].join('\n'))
                }
            ];
            recordCityLlmDebug(db, char, 'input', 'city_behavior_interaction_starters', retryMessages, {
                ...debugMeta,
                jsonRetry: true,
                parseError: dependencies.limitText(err.message || 'parse_failed', 160)
            });
            try {
                rawOutput = await dependencies.callLLM({
                    endpoint: apiEndpoint,
                    key: apiKey,
                    model: modelName,
                    messages: retryMessages,
                    maxTokens: null,
                    temperature: 0.35,
                    responseFormat: { type: 'json_object' },
                    debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_behavior_interaction_starters', {
                        ...debugMeta,
                        jsonRetry: true
                    })
                });
            } catch (retryErr) {
                throw dependencies.createCityError(`互动开场枝丫生成 JSON 重试请求失败，请重试：${retryErr.message}`, 502, true);
            }
            recordCityLlmDebug(db, char, 'output', 'city_behavior_interaction_starters', rawOutput, {
                ...debugMeta,
                jsonRetry: true
            });
            jsonRetryUsed = true;
            try {
                parsed = parseJsonObjectFromLlmText(rawOutput);
            } catch (retryErr) {
                throw dependencies.createCityError(`互动开场枝丫生成返回的 JSON 无法解析，请重试：${retryErr.message || err.message || 'parse_failed'}`, 502, true);
            }
        }
        const interactionStarterPack = dependencies.sanitizeBehaviorInteractionStarterPack(
            parsed,
            char,
            payload,
            'model_output_invalid',
            inputPackage?.world?.allowed_place_ids || []
        );
        if (!interactionStarterPack.interaction_patches.length) {
            throw dependencies.createCityError('互动开场枝丫生成结果没有可用的行为步骤，请重试。', 502, true);
        }
        return {
            ...interactionStarterPack,
            raw_output: String(rawOutput || ''),
            interaction_json_retry_used: jsonRetryUsed,
            json_retry_used: jsonRetryUsed,
            fallback: false
        };
    }

function getQuestNarrationText(richNarrations = null) {
        return dependencies.questService.getQuestNarrationText(richNarrations);
    }

function parseMayorJsonReply(replyText, errorLabel = '市长 AI 返回内容不是合法 JSON。') {
        return dependencies.mayorService.parseMayorJsonReply(replyText, errorLabel);
    }

function broadcastCityToChat(userId, char, eventSummary, eventType, richNarrations = null) {
        try {
            const db = dependencies.getUserDb(userId);
            dependencies.ensureCityDb(db);
            const explicitChat = dependencies.sanitizeCityNarrationText(richNarrations?.chat);
            const explicitDiary = dependencies.sanitizeCityNarrationText(richNarrations?.diary);

            // 1. Private chat message to user
            // Only send private chat when the character explicitly generated it.
            if (char.sys_city_notify && explicitChat) {
                try {
                    const chatContent = explicitChat;
                    if (chatContent && String(chatContent).trim() !== '') {
                        const engine = dependencies.getEngine(userId);
                        const wsClients = dependencies.getWsClients(userId);
                        const sourceLog = dependencies.findCityLogForOutreach(db, char.id, [
                            chatContent,
                            eventSummary,
                            richNarrations?.log
                        ]);
                        const cityOutreachMeta = {
                            source: 'city_outreach',
                            event_type: eventType || '',
                            generated_from: 'city_action',
                            ...(sourceLog ? {
                                city_outreach: {
                                    log_id: sourceLog.id,
                                    action_type: sourceLog.action_type || '',
                                    location: sourceLog.location || ''
                                }
                            } : {})
                        };
                        const { id: msgId, timestamp: msgTs } = db.addMessage(char.id, 'character', chatContent, cityOutreachMeta);
                        const freshChar = db.getCharacter(char.id) || char;
                        const hadPendingReply = !!freshChar.city_reply_pending;
                        const nextIgnoreStreak = hadPendingReply ? Math.min(6, (freshChar.city_ignore_streak || 0) + 1) : 0;
                        const nextPressure = hadPendingReply && freshChar.sys_pressure !== 0
                            ? Math.min(4, (freshChar.pressure_level || 0) + 1)
                            : (freshChar.pressure_level || 0);
                        const nextJealousy = hadPendingReply && freshChar.sys_jealousy !== 0
                            ? Math.min(100, (freshChar.jealousy_level || 0) + 20)
                            : (freshChar.jealousy_level || 0);
                        const cityChatPatch = {
                            city_reply_pending: 1,
                            city_ignore_streak: nextIgnoreStreak,
                            city_last_outreach_at: Date.now(),
                            city_post_ignore_reaction: 0,
                            pressure_level: nextPressure,
                            jealousy_level: nextJealousy
                        };
                        db.updateCharacter(char.id, cityChatPatch);
                        dependencies.logEmotionTransition(
                            db,
                            freshChar,
                            cityChatPatch,
                            'city_private_outreach',
                            hadPendingReply
                                ? '角色再次从商业街主动发来私聊，但上一条仍未得到回应，焦虑和在意程度上升。'
                                : '角色从商业街主动发来私聊，等待用户回应。'
                        );
                        const newMessage = {
                            id: msgId, character_id: char.id, role: 'character',
                            content: chatContent, timestamp: msgTs, read: 0,
                            metadata: cityOutreachMeta
                        };
                        engine.broadcastNewMessage(wsClients, newMessage);
                        engine.broadcastEvent(wsClients, { type: 'refresh_contacts' });
                        console.log(`[City->Chat] ${char.name} 发私聊 chars=${String(chatContent || '').length}`);
                    }
                } catch (e) {
                    console.error(`[City->Chat] 私聊失败: ${e.message}`);
                }
            }

            // 2. Write diary entry
            // Only persist when the character explicitly produced diary content.
            if (explicitDiary) {
                try {
                    const emotionMap = {
                        'SOCIAL': 'happy', 'BUY': 'happy', 'EAT': 'content',
                        'STARVE': 'desperate', 'GAMBLING_WIN': 'excited',
                        'GAMBLING_LOSE': 'sad', 'BROKE': 'worried'
                    };

                    const diaryText = explicitDiary;

                    if (diaryText) {
                        db.addDiary(char.id, diaryText, emotionMap[eventType] || 'neutral');
                        console.log(`[City->Chat] ${char.name} 写日记 ${eventType}`);
                    }
                } catch (e) {
                    console.error(`[City->Chat] 日记失败: ${e.message}`);
                }
            }

            // 4. City logs stay in city_logs first. Long-term memory is produced
            // by the batched memory sweep, same as private/group chat overflow.
        } catch (e) {
            console.error(`[City->Chat] 桥接异常: ${e.message}`);
        }
    }

    return { recordCityLlmDebug, getCachedCityPromptBlock, triggerHackerIntelReply, buildBusyChatImpactPatch, formatDistrictItemsForPrompt, formatInventoryItemForPrompt, buildInventoryPromptBlock, generateInventoryOrganizeNarrations, pickSettledShopItemFromNarrations, buildGamblingOutcomeNarrations, tryParseCityActionReply, runPrivateReplyDirectedCityAction, isWeakCityNarration, buildRecentNarrationAntiRepeatBlock, buildRecentPrivateChatAntiRepeatBlock, buildFreshPrivateChatTailBlock, regenerateActionNarrations, buildQuestResolutionNarrations, buildBusyPenaltyNarration, maybeExecuteReplyCityIntent, maybeExecuteReplyCityAction, maybeSyncReplyDeclaredState, buildQuestPromptContext, buildSurvivalPrompt, buildSocialPrompt, parseJsonObjectFromLlmText, fetchBehaviorModelList, resolveBehaviorSummaryModelConfig, escapeBehaviorPromptRegex, personalizeBehaviorPromptText, shouldPersonalizeBehaviorPromptKey, personalizeBehaviorPromptValue, createBehaviorBranchWithModel, createBaseBehaviorBranchesWithModel, createBehaviorInteractionStarterBranchesWithModel, getQuestNarrationText, parseMayorJsonReply, broadcastCityToChat };
}

module.exports = { createModule };
