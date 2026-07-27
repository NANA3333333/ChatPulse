const { normalizeCityConfigValue } = require('../utils/inputGuards');

function normalizeCityActionConfigNumber(config, key, fallback) {
    const normalized = normalizeCityConfigValue(key, config?.[key]);
    if (normalized === null) return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getWalletAfterDelta(currentWallet, delta) {
    const current = Number(currentWallet || 0);
    const next = current + Number(delta || 0);
    if (current < 0) return +next.toFixed(2);
    return +Math.max(0, next).toFixed(2);
}

const INVENTORY_SLOT_LIMIT_FALLBACK = 10;

function getInventorySlotLimit(db) {
    const limit = Number(db?.city?.getInventorySlotLimit?.() || INVENTORY_SLOT_LIMIT_FALLBACK);
    return Number.isSafeInteger(limit) && limit > 0 ? limit : INVENTORY_SLOT_LIMIT_FALLBACK;
}

function getInventoryItemId(item = {}) {
    return String(item.item_id || item.id || '').trim();
}

function formatInventoryItemLabel(item = {}) {
    const giftedQty = Number(item.user_gifted_quantity || item.gifted_quantity || 0);
    const giftText = giftedQty > 0 ? `，用户送的x${giftedQty}` : '';
    return `${item.emoji || ''}${item.name || getInventoryItemId(item) || '物品'}x${Number(item.quantity || 1)}${giftText}`;
}

function pickDiscardCandidate(inventory = []) {
    const rows = Array.isArray(inventory) ? inventory.filter((item) => getInventoryItemId(item) && Number(item.quantity || 0) > 0) : [];
    if (!rows.length) return null;
    const score = (item) => {
        let value = 0;
        const giftedQty = Number(item.user_gifted_quantity || item.gifted_quantity || 0);
        if (giftedQty > 0) value += 10000;
        if (Number(item.cal_restore || 0) > 0) value += 1000;
        value += Math.max(0, Number(item.buy_price || 0));
        return value;
    };
    return rows.slice().sort((a, b) => score(a) - score(b))[0] || null;
}

function getInventoryStateForNewItem(db, charId, itemId) {
    const inventory = db?.city?.getInventory?.(charId) || [];
    const limit = getInventorySlotLimit(db);
    const hasItem = inventory.some((entry) => getInventoryItemId(entry) === String(itemId || '').trim());
    return {
        inventory,
        limit,
        hasItem,
        fullForNewItem: !hasItem && inventory.length >= limit
    };
}

function createActionService(deps = {}) {
    const {
        getDistrictStateEffects,
        buildGamblingOutcomeNarrations,
        broadcastCityToChat,
        buildCollapsedCityLog,
        pickSettledShopItemFromNarrations,
        isWeakCityNarration,
        regenerateActionNarrations,
        clamp,
        broadcastCityEvent,
        handleQuestLifecycleAfterAction,
        applyStateEffectsToCharacter,
        applyHousingDistrictEffects,
        logEmotionTransitionToState,
        getWsClients,
        getEngine,
        isCollapsedCityLog,
        isHackerDistrict,
        buildHackerIntelAppendix,
        triggerHackerIntelReply,
        getMedicalStayMinutes,
        getCityNowMs,
        maybeRunCityWebSearchActivity
    } = deps;

    async function organizeInventoryAction(char, db, userId, currentCals, config, richNarrations = null, options = {}) {
        const inventory = db?.city?.getInventory?.(char.id) || [];
        const limit = getInventorySlotLimit(db);
        const district = options.district
            || db?.city?.getDistrict?.(char.location || '')
            || { id: char.location || 'street', name: '商业街', emoji: '🎒', cal_cost: 2, type: 'shopping' };
        const desiredItem = options.desiredItem || null;
        const shouldDiscard = inventory.length >= limit || options.forceDiscard;
        const candidate = shouldDiscard ? pickDiscardCandidate(inventory) : null;
        const discarded = candidate && typeof db?.city?.discardInventorySlot === 'function'
            ? db.city.discardInventorySlot(char.id, getInventoryItemId(candidate))
            : null;
        const desiredText = desiredItem ? `${desiredItem.emoji || ''}${desiredItem.name || desiredItem.id || '新物品'}` : '';
        const discardedText = discarded ? formatInventoryItemLabel(discarded) : '';
        const defaultLog = discarded
            ? `${char.name} 本来想买${desiredText || '新东西'}，但背包已经满到 ${inventory.length}/${limit} 格，只好先停下来整理，把${discardedText}清了出去，给之后的补给腾出位置。`
            : shouldDiscard
                ? `${char.name} 翻了翻背包，发现里面已经满到 ${inventory.length}/${limit} 格，这一轮先专心整理背包，没有继续买新东西。`
                : `${char.name} 翻了翻背包，把随身物品重新归位，确认现在还有 ${inventory.length}/${limit} 格在用，没有急着添置新东西。`;
        const explicitLog = options.forceDefaultLog ? '' : String(richNarrations?.log || '').trim();
        const organizeLog = explicitLog || defaultLog;
        const organizeNarrations = options.forceDefaultLog
            ? { log: organizeLog, chat: '', diary: '' }
            : { ...(richNarrations || {}), log: organizeLog };
        const dCal = -Math.min(20, Math.max(1, Number(district.cal_cost || 2)));
        const newCals = Math.min(4000, Math.max(0, Number(currentCals || 0) + dCal));
        const nextState = applyStateEffectsToCharacter(char, {
            energy: -2,
            stress: 2,
            mood: discarded ? 0 : -1,
            social_need: 0,
            health: 0,
            satiety: 0,
            stomach_load: 0,
            sleep_debt: 0
        });
        const patch = {
            calories: newCals,
            city_status: newCals < 500 ? 'hungry' : 'idle',
            location: district.id,
            ...nextState
        };
        db.updateCharacter(char.id, patch);
        const actionLogId = db.city.logAction(char.id, 'ORGANIZE_BAG', organizeLog, dCal, 0, district.id);
        broadcastCityEvent(userId, char.id, 'ORGANIZE_BAG', organizeLog);
        broadcastCityToChat(userId, char, organizeLog, 'ORGANIZE_BAG', organizeNarrations);
        logEmotionTransitionToState(
            db,
            char,
            { ...char, ...patch },
            'city_organize_bag',
            discarded
                ? `角色背包已满，整理背包并丢弃了 ${discarded.name || discarded.item_id || '一个物品'}。`
                : '角色背包已满，优先整理背包而不是继续购买。'
        );
        return { actionLogId, discarded };
    }

    async function applyDecision(district, char, db, userId, currentCals, config, activeEvents, richNarrations = null, options = {}) {
        const cityNowMs = Number(options.cityNowMs || 0) || Number(getCityNowMs?.(config) || 0) || Date.now();

        const inflation = normalizeCityActionConfigNumber(config, 'inflation', 1.0);
        const workBonus = normalizeCityActionConfigNumber(config, 'work_bonus', 1.0);
        const taskNarrationText = [
            richNarrations?.log,
            richNarrations?.chat,
            richNarrations?.diary
        ].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
        const activeQuestClaim = db.city.getCharacterActiveQuestClaim?.(char.id) || null;
        const activeQuestStatus = String(activeQuestClaim?.status || '').trim();
        const activeQuestTarget = String(activeQuestClaim?.target_district || '').trim();
        const isActiveQuestTarget = !!activeQuestClaim
            && activeQuestTarget
            && activeQuestTarget === String(district.id || '').trim()
            && ['accepted', 'in_progress', 'ready_to_report', 'reporting'].includes(activeQuestStatus);
        if (isActiveQuestTarget && richNarrations && (!richNarrations.quest_intent || typeof richNarrations.quest_intent !== 'object')) {
            richNarrations.quest_intent = {
                quest_id: activeQuestClaim.quest_id,
                stage: ['ready_to_report', 'reporting'].includes(activeQuestStatus) ? 'report' : 'progress'
            };
        }
        const rawQuestIntent = richNarrations?.quest_intent;
        const questIntentStage = rawQuestIntent && typeof rawQuestIntent === 'object'
            ? String(rawQuestIntent.stage || '').trim().toLowerCase()
            : '';
        const activeQuestTitle = String(activeQuestClaim?.title || '').trim();
        const isQuestAction = ['claim', 'progress', 'report'].includes(questIntentStage)
            || isActiveQuestTarget
            || (!!activeQuestClaim && /汇报|交付|递交|交差|报告任务|送去交单|去交单/.test(taskNarrationText))
            || (!!activeQuestTitle && taskNarrationText.includes(activeQuestTitle));
        const districtMoneyCost = isQuestAction ? 0 : Number(district.money_cost || 0);
        let dCal = -(district.cal_cost || 0) + (district.cal_reward || 0);
        let dMoney = -districtMoneyCost * inflation + (district.money_reward || 0) * workBonus;
        let stateEffects = getDistrictStateEffects(district, richNarrations);
        if (typeof applyHousingDistrictEffects === 'function') {
            stateEffects = applyHousingDistrictEffects(db, char, district, stateEffects);
        }

        if (activeEvents && activeEvents.length > 0) {
            for (const evt of activeEvents) {
                let eff = {};
                try { eff = typeof evt.effect_json === 'string' ? JSON.parse(evt.effect_json) : (evt.effect_json || {}); } catch (e) { continue; }
                if (eff.district && eff.district !== district.id) continue;
                if (eff.cal_bonus) dCal += Number(eff.cal_bonus) || 0;
                if (eff.money_bonus) dMoney += Number(eff.money_bonus) || 0;
                if (eff.price_modifier) dMoney *= Number(eff.price_modifier) || 1;
                if (eff.cal_modifier) dCal *= Number(eff.cal_modifier) || 1;
                console.log(`[City/Event] ${evt.emoji}${evt.title} 影响 ${char.name} @ ${district.name}: cal${eff.cal_bonus || 0} money${eff.money_bonus || 0}`);
            }
            dCal = Math.round(dCal);
            dMoney = Math.round(dMoney);
        }

        const getLogText = (defaultString, logOptions = {}) => {
            if (logOptions.forceDefault) return defaultString;
            if (!richNarrations) return defaultString;
            const candidates = [
                richNarrations.log,
                richNarrations.diary,
                richNarrations.chat
            ].map(v => String(v || '').trim()).filter(Boolean);

            for (const candidate of candidates) {
                return candidate;
            }
            return defaultString;
        };
        let primaryActionLogId = 0;
        const finishBrokeAction = async (brokeLog) => {
            primaryActionLogId = db.city.logAction(char.id, 'BROKE', brokeLog, 0, 0, district.id);
            const questOutcome = await handleQuestLifecycleAfterAction(db, char, district, richNarrations, { actionLogId: primaryActionLogId });
            const bonusMoney = Number(questOutcome?.bonusMoney || 0);
            const bonusCalories = Number(questOutcome?.bonusCalories || 0);
            if (bonusMoney || bonusCalories) {
                const patch = {
                    wallet: getWalletAfterDelta(char.wallet, bonusMoney),
                    calories: Math.min(4000, Math.max(0, currentCals + bonusCalories))
                };
                db.updateCharacter(char.id, patch);
                const wsClients = getWsClients(userId);
                const engine = getEngine(userId);
                if (engine && typeof engine.broadcastWalletSync === 'function') {
                    engine.broadcastWalletSync(wsClients, char.id);
                }
            }
        };

        if (district.type === 'gambling' && isQuestAction) {
            const questLog = getLogText(buildCollapsedCityLog(char, '任务行动文案生成失败', { district }));
            primaryActionLogId = db.city.logAction(char.id, 'QUEST', questLog, dCal, dMoney, district.id);
            if (richNarrations) broadcastCityToChat(userId, char, questLog, 'QUEST', richNarrations);
        } else if (district.type === 'gambling') {
            const winRate = normalizeCityActionConfigNumber(config, 'gambling_win_rate', 0.35);
            const payout = normalizeCityActionConfigNumber(config, 'gambling_payout', 3.0);
            const didWin = Math.random() < winRate;
            if (didWin) {
                dMoney = districtMoneyCost * payout;
                stateEffects = { ...stateEffects, mood: stateEffects.mood + 10, stress: stateEffects.stress - 6 };
                const gamblingNarrations = await buildGamblingOutcomeNarrations(char, district, db, {
                    didWin: true,
                    moneyDelta: dMoney,
                    calDelta: dCal
                }, richNarrations);
                const winLog = String(gamblingNarrations.log || '').trim();
                primaryActionLogId = db.city.logAction(char.id, district.id.toUpperCase(), winLog, dCal, dMoney, district.id);
                richNarrations = gamblingNarrations;
                broadcastCityToChat(userId, char, winLog, 'GAMBLING_WIN', richNarrations);
            } else {
                dMoney = -districtMoneyCost * inflation;
                stateEffects = { ...stateEffects, mood: stateEffects.mood - 8, stress: stateEffects.stress + 8 };
                const gamblingNarrations = await buildGamblingOutcomeNarrations(char, district, db, {
                    didWin: false,
                    moneyDelta: dMoney,
                    calDelta: dCal
                }, richNarrations);
                const loseLog = String(gamblingNarrations.log || '').trim();
                primaryActionLogId = db.city.logAction(char.id, district.id.toUpperCase(), loseLog, dCal, dMoney, district.id);
                richNarrations = gamblingNarrations;
                broadcastCityToChat(userId, char, loseLog, 'GAMBLING_LOSE', richNarrations);
            }
        } else if (district.type === 'food' || district.type === 'shopping') {
            const realCost = districtMoneyCost * inflation;
            if (realCost > 0 && (char.wallet || 0) < realCost) {
                const brokeLog = getLogText(buildCollapsedCityLog(char, '金币不足，文案折叠', { district }));
                await finishBrokeAction(brokeLog);
                return;
            }
            if (!isQuestAction) {
                let shopItems = db.city.getItemsAtDistrict(district.id);
                shopItems = shopItems.filter(i => i.stock === -1 || i.stock > 0);

                if (shopItems.length > 0) {
                    const item = pickSettledShopItemFromNarrations(shopItems, richNarrations);
                    if (item) {
                        const itemCost = item.buy_price * inflation;
                        if ((char.wallet || 0) >= itemCost) {
                            if (district.id !== 'restaurant') {
                                const inventoryState = getInventoryStateForNewItem(db, char.id, item.id);
                                if (inventoryState.fullForNewItem) {
                                    await organizeInventoryAction(char, db, userId, currentCals, config, null, {
                                        district,
                                        desiredItem: item,
                                        forceDefaultLog: true
                                    });
                                    return;
                                }
                            }
                            if (!richNarrations || isWeakCityNarration(richNarrations?.log, char, district)) {
                                richNarrations = await regenerateActionNarrations(char, district, db, richNarrations || {}, {
                                    item,
                                    currentCals
                                });
                            }
                            if (district.id === 'restaurant') {
                                db.city.decreaseItemStock(item.id, 1);
                                dMoney = -itemCost;
                                dCal = -(district.cal_cost || 0) + (item.cal_restore || 0);
                                const satietyBoost = clamp(Math.round((item.cal_restore || 0) / 18), 10, 30);
                                const loadBoost = clamp(Math.round((item.cal_restore || 0) / 24), 8, 24);
                                stateEffects = {
                                    ...stateEffects,
                                    energy: stateEffects.energy + 6,
                                    stress: stateEffects.stress - 2,
                                    mood: stateEffects.mood + 2,
                                    satiety: (stateEffects.satiety || 0) + satietyBoost,
                                    stomach_load: (stateEffects.stomach_load || 0) + loadBoost,
                                    sleep_debt: (stateEffects.sleep_debt || 0) + Math.round(loadBoost * 0.6)
                                };
                                const eatLog = getLogText(buildCollapsedCityLog(char, '进食文案生成失败', { district }), { allowWeak: true });
                                primaryActionLogId = db.city.logAction(char.id, 'EAT', eatLog, dCal, dMoney, district.id);
                                broadcastCityEvent(userId, char.id, 'EAT', eatLog);
                                broadcastCityToChat(userId, char, eatLog, 'EAT', richNarrations);
                            } else {
                                try {
                                    db.city.addToInventory(char.id, item.id, 1);
                                } catch (e) {
                                    if (e?.code === 'CITY_INVENTORY_FULL') {
                                        await organizeInventoryAction(char, db, userId, currentCals, config, null, {
                                            district,
                                            desiredItem: item,
                                            forceDefaultLog: true
                                        });
                                        return;
                                    }
                                    throw e;
                                }
                                db.city.decreaseItemStock(item.id, 1);
                                dMoney = -itemCost;
                                dCal = -(district.cal_cost || 0);
                                const buyLog = getLogText(buildCollapsedCityLog(char, '购物文案生成失败', { district }), { allowWeak: true });
                                primaryActionLogId = db.city.logAction(char.id, 'BUY', buyLog, dCal, dMoney, district.id);
                                broadcastCityEvent(userId, char.id, 'BUY', buyLog);
                                broadcastCityToChat(userId, char, buyLog, 'BUY', richNarrations);
                            }

                            const questOutcome = await handleQuestLifecycleAfterAction(db, char, district, richNarrations, { actionLogId: primaryActionLogId });
                            const newCals = Math.min(4000, Math.max(0, currentCals + dCal + Number(questOutcome.bonusCalories || 0)));
                            const newWallet = getWalletAfterDelta(char.wallet, dMoney + Number(questOutcome.bonusMoney || 0));
                            const nextState = applyStateEffectsToCharacter(char, stateEffects);
                            const shoppingPatch = {
                                calories: newCals,
                                city_status: newCals < 500 ? 'hungry' : 'idle',
                                location: district.id,
                                wallet: newWallet,
                                ...nextState
                            };
                            db.updateCharacter(char.id, shoppingPatch);
                            logEmotionTransitionToState(
                                db,
                                char,
                                { ...char, ...shoppingPatch },
                                `city_action_${district.type}`,
                                `角色在商业街 ${district.name} 完成了一次${district.type === 'food' ? '进食' : '消费'}行为，状态与主情绪随之变化。`
                            );

                            const wsClients = getWsClients(userId);
                            const engine = getEngine(userId);
                            if (engine && typeof engine.broadcastWalletSync === 'function') {
                                engine.broadcastWalletSync(wsClients, char.id);
                            }

                            return;
                        }
                    }
                }
            }
            if (realCost > 0 && (char.wallet || 0) < realCost) {
                const brokeLog = getLogText(buildCollapsedCityLog(char, '金币不足，文案折叠', { district }));
                await finishBrokeAction(brokeLog);
                return;
            }
            const normalLog = getLogText(buildCollapsedCityLog(char, '行动文案生成失败', { district }));
            primaryActionLogId = db.city.logAction(char.id, district.id.toUpperCase(), normalLog, dCal, dMoney, district.id);
            if (richNarrations) broadcastCityToChat(userId, char, normalLog, district.id.toUpperCase(), richNarrations);
        } else if (district.type === 'medical') {
            if (districtMoneyCost > 0 && (char.wallet || 0) < districtMoneyCost * inflation) {
                const brokeLog = getLogText(buildCollapsedCityLog(char, '金币不足，文案折叠', { district }));
                await finishBrokeAction(brokeLog);
                return;
            }
            if (currentCals >= 800) {
                dCal = -(district.cal_cost || 0);
                const punishLog = getLogText(buildCollapsedCityLog(char, '医疗行动文案折叠', { district }));
                primaryActionLogId = db.city.logAction(char.id, district.id.toUpperCase(), punishLog, dCal, dMoney, district.id);
                if (richNarrations) broadcastCityToChat(userId, char, punishLog, district.id.toUpperCase(), richNarrations);
            } else {
                dCal = -(district.cal_cost || 0);
                stateEffects = { energy: 0, sleep_debt: 0, stress: 0, social_need: 0, health: 0, mood: 0, satiety: 0, stomach_load: 0 };
                const normalLog = getLogText(buildCollapsedCityLog(char, '医疗行动文案生成失败', { district }), { forceDefault: true });
                primaryActionLogId = db.city.logAction(char.id, district.id.toUpperCase(), normalLog, dCal, dMoney, district.id);
                if (richNarrations) broadcastCityToChat(userId, char, normalLog, district.id.toUpperCase(), richNarrations);
            }
        } else {
            if (districtMoneyCost > 0 && (char.wallet || 0) < districtMoneyCost * inflation) {
                const brokeLog = getLogText(buildCollapsedCityLog(char, '金币不足，文案折叠', { district }));
                await finishBrokeAction(brokeLog);
                return;
            }
            let normalLog = getLogText(buildCollapsedCityLog(char, '行动文案生成失败', { district }));
            let hackerIntelPayload = '';
            if (isHackerDistrict(district) && !isQuestAction) {
                hackerIntelPayload = buildHackerIntelAppendix(db, char);
                normalLog = `${normalLog}\n\n[黑客据点情报]\n${hackerIntelPayload}`.trim();
            }
            primaryActionLogId = db.city.logAction(char.id, district.id.toUpperCase(), normalLog, dCal, dMoney, district.id);
            if (richNarrations) broadcastCityToChat(userId, char, normalLog, district.id.toUpperCase(), richNarrations);
            if (hackerIntelPayload) {
                triggerHackerIntelReply(userId, char, hackerIntelPayload).catch(err => {
                    console.error(`[City->Chat] 黑客据点私聊回报失败: ${err.message}`);
                });
            }
        }

        let webActivityOutcome = null;
        if (primaryActionLogId && typeof maybeRunCityWebSearchActivity === 'function') {
            try {
                webActivityOutcome = await maybeRunCityWebSearchActivity({
                    db,
                    userId,
                    char,
                    district,
                    config,
                    baseLog: getLogText(normalLog, { forceDefault: false })
                });
            } catch (webErr) {
                console.warn(`[City/Web] ${char.name} 联网活动失败: ${webErr.message}`);
            }
        }

        const questOutcome = await handleQuestLifecycleAfterAction(db, char, district, richNarrations, { actionLogId: primaryActionLogId });
        const totalCalDelta = dCal + Number(questOutcome.bonusCalories || 0) + Number(webActivityOutcome?.calorieDelta || 0);
        const totalMoneyDelta = dMoney + Number(questOutcome.bonusMoney || 0) + Number(webActivityOutcome?.moneyDelta || 0);
        const newCals = Math.min(4000, Math.max(0, currentCals + totalCalDelta));
        const newWallet = getWalletAfterDelta(char.wallet, totalMoneyDelta);
        const webStateEffects = webActivityOutcome?.stateEffects || {};
        const mergedStateEffects = { ...stateEffects };
        for (const [key, value] of Object.entries(webStateEffects)) {
            mergedStateEffects[key] = Number(mergedStateEffects[key] || 0) + Number(value || 0);
        }
        const nextState = applyStateEffectsToCharacter(char, mergedStateEffects);
        const newCityStatus = district.type === 'medical' && currentCals < 800
            ? 'medical'
            : district.duration_ticks > 1
                ? (district.type === 'work' ? 'working' : district.type === 'rest' ? 'sleeping' : 'eating')
                : (newCals < 500 ? 'hungry' : 'idle');

        const medicalStayMinutes = district.type === 'medical' && newCityStatus === 'medical'
            ? getMedicalStayMinutes(district)
            : 0;

        const actionPatch = {
            calories: newCals,
            city_status: newCityStatus,
            location: district.id,
            wallet: newWallet,
            city_status_started_at: newCityStatus === 'medical' ? cityNowMs : 0,
            city_status_until_at: newCityStatus === 'medical' ? cityNowMs + medicalStayMinutes * 60 * 1000 : 0,
            city_medical_last_recovery_at: newCityStatus === 'medical' ? cityNowMs : 0,
            work_distraction: newCityStatus === 'working' ? 0 : (char.work_distraction ?? 0),
            sleep_disruption: newCityStatus === 'sleeping' ? 0 : (char.sleep_disruption ?? 0),
            ...nextState
        };
        db.updateCharacter(char.id, actionPatch);
        logEmotionTransitionToState(
            db,
            char,
            { ...char, ...actionPatch },
            `city_action_${district.type}`,
            `角色在商业街执行了 ${district.name} 行动，生理状态与主情绪发生变化。`
        );
        broadcastCityEvent(userId, char.id, district.id.toUpperCase(), `${char.name} -> ${district.emoji} ${district.name}`);

        const wsClients = getWsClients(userId);
        const engine = getEngine(userId);
        if (engine && typeof engine.broadcastWalletSync === 'function') {
            engine.broadcastWalletSync(wsClients, char.id);
        }
    }

    return { applyDecision, organizeInventoryAction };
}

module.exports = { createActionService };
