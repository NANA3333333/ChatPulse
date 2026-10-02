// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function ensureSocialHousingDb(db) {
        if (!db.socialHousing) {
            const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : db;
            db.socialHousing = dependencies.initSocialHousingDb(rawDb);
        }
        return db.socialHousing;
    }

function getRentSettlementLockKey(db, characterId) {
        const dbPath = typeof db.getDbPath === 'function' ? db.getDbPath() : '';
        return `${dbPath || 'unknown-db'}:${String(characterId || '')}`;
    }

async function publishAgencyAdForDb(db, triggerType = 'manual') {
        const socialHousingDb = ensureSocialHousingDb(db);
        const cityDb = dependencies.ensureCityDb(db);
        const config = socialHousingDb.getAgencyConfig();
        const snapshot = dependencies.buildAgencySnapshot(socialHousingDb, db);
        const aiChar = dependencies.resolveAgencyAiChar(db, config);
        const ad = await dependencies.generateAgencyAd({ callLLM: dependencies.callLLM, db, config, snapshot, aiChar });

        socialHousingDb.addAgencyAd({
            home_id: ad.home_id || '',
            title: ad.title,
            content: ad.content,
            trigger_type: triggerType,
            office_district: config.office_district
        });

        const intervalMinutes = dependencies.normalizeAgencyIntervalMinutes(config.decision_interval_hours);
        const now = Date.now();
        socialHousingDb.saveAgencyConfig({
            ...config,
            ad_enabled: Number(config.enabled || 0) === 1 ? 1 : 0,
            ad_min_interval_minutes: intervalMinutes,
            ad_max_interval_minutes: intervalMinutes,
            last_ad_at: now,
            next_ad_at: now + intervalMinutes * 60 * 1000,
            last_error: '',
            last_error_at: 0
        });

        if (typeof cityDb.logAction === 'function') {
            cityDb.logAction('system', 'ANNOUNCE', `[中介所广告] ${ad.title} | ${ad.content}`, 0, 0, config.office_district || 'street');
        }
        if (typeof cityDb.addCityAnnouncement === 'function') {
            cityDb.addCityAnnouncement('agency', ad.title, ad.content, config.office_district || 'street');
        }

        return {
            ...ad,
            office_district: config.office_district || 'street'
        };
    }

async function generateRentCityLog({ db, userId, character, housingContext, amount, paid, weeklyAgencyCollection, now = Date.now() }) {
        if (typeof dependencies.callLLM !== 'function') {
            throw new Error('收租商业街描述需要模型服务，请稍后重试。');
        }
        const { endpoint, key, model } = dependencies.normalizeRentModelConfig(character);
        const facts = dependencies.buildRentCollectionFacts(character, housingContext, amount, paid, weeklyAgencyCollection, now);
        const universal = await dependencies.buildUniversalContext({
            getUserDb: dependencies.getUserDb,
            getMemory: dependencies.getMemory,
            userId,
            forceCityDetail: true
        }, character, '住房系统收租事件', false, []);
        const systemPrompt = [
            `请根据 ${character.name} 的设定和上下文，为商业街活动流写一条公开日志。`,
            '只输出严格 JSON，不要输出 Markdown 或解释。',
            'JSON 格式必须是 {"city_log":"..."}。'
        ].join('\n');
        const userPrompt = [
            '[默认大输入库]',
            universal?.preamble || '',
            '',
            '[收租事实]',
            JSON.stringify(facts, null, 2),
            '',
            '[任务]',
            '根据收租事实生成一条商业街活动描述。',
            '硬性要求：',
            `0. 当前实际日期为 ${facts.event_time.date} ${facts.event_time.weekday} ${facts.event_time.time}（${facts.event_time.timezone}）；如果提到日期或星期，必须和这个事实一致。`,
            '1. city_log 用中文，适合商业街公开活动流。',
            '2. 必须尊重事实：这是角色本人被收租，不是用户替角色交租。',
            facts.rent.paid
                ? '3. 事实结果：本次房租已付，住房保留。'
                : '3. 事实结果：角色钱不够交租，住房已被房东/中介收回，住房状态已清除。',
            '4. 除以上事实边界外，具体反应、语气、细节由模型根据角色和上下文自由发挥。',
            '5. 不要输出模板、字段名、系统、API 或 JSON 之外的内容。'
        ].join('\n');

        dependencies.recordAgencyDebug(db, character, 'input', {
            system_prompt: systemPrompt,
            user_prompt: userPrompt
        }, {
            context_type: 'social_housing_rent_city_log',
            model,
            endpoint
        });

        const result = await dependencies.callLLM({
            endpoint,
            key,
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            maxTokens: 800,
            temperature: 0.72,
            responseFormat: { type: 'json_object' },
            returnUsage: true,
            maxAttempts: 1
        });

        const raw = typeof result === 'string' ? result : result?.content;
        const finishReason = String(result?.finishReason || '').trim();

        dependencies.recordAgencyDebug(db, character, 'output', String(raw || ''), {
            context_type: 'social_housing_rent_city_log',
            model,
            endpoint,
            finishReason,
            cached: !!result?.cached,
            usage: result?.usage || null
        });

        if (finishReason === 'length') {
            throw new Error('收租商业街描述被截断，请重试。');
        }

        let parsed;
        try {
            parsed = dependencies.parseRentCityLogOutput(raw);
        } catch (e) {
            throw new Error('收租商业街描述不是合法 JSON，请重试。');
        }

        const cityLog = dependencies.requireRentTextField(parsed, 'city_log', '收租商业街描述');
        return dependencies.assertRentCityLogMatchesFacts(cityLog, facts);
    }

async function triggerRentPrivateReply({ db, userId, character, housingContext, amount, paid, weeklyAgencyCollection, now = Date.now() }) {
        if (!userId) {
            throw new Error('缺少用户上下文，无法触发收租私聊，请重试。');
        }
        const engine = dependencies.getEngine(userId);
        if (!engine || typeof engine.triggerImmediateUserReply !== 'function') {
            throw new Error('私聊引擎不可用，请重试。');
        }
        const wsClients = dependencies.getWsClients(userId);
        const facts = dependencies.buildRentCollectionFacts(character, housingContext, amount, paid, weeklyAgencyCollection, now);
        const source = weeklyAgencyCollection
            ? 'social_housing_friday_rent_collection'
            : 'social_housing_manual_rent_collection';
        await engine.triggerImmediateUserReply(character.id, wsClients, {
            propagateError: true,
            extraSystemDirective: [
                '[系统事件：住房系统收租]',
                '事实边界：这是房东/中介向角色本人收取本次房租，不是用户在交租，也不是给用户租房。',
                `当前实际日期：${facts.event_time.date} ${facts.event_time.weekday} ${facts.event_time.time}（${facts.event_time.timezone}）。`,
                '[收租事实]',
                JSON.stringify(facts, null, 2),
                '只把这些事实当作当前事件背景；不要预设心情、态度或剧情细节。',
                '请基于私聊前文、RAG 记忆和你的性格自由回应。',
                '不要输出 [CITY_ACTION:...] 或 [CITY_INTENT:...]；不要说这是模板或系统消息；不要改变上述事实。'
            ].join('\n'),
            eventUserDirective: '住房系统刚触发一次收租事件，事实见系统事件。请按角色本人和私聊记忆自由回应。',
            extraDirectiveRole: 'system',
            skipTopicSwitchGate: true,
            triggerSource: source,
            triggerRoute: weeklyAgencyCollection ? 'socialHousing.weeklyRent' : 'socialHousing.payRent',
            triggerNote: `${facts.home.id || 'home'}:${facts.rent.paid ? 'paid' : 'evicted'}`
        });
        return { triggered: true, source };
    }

async function settleCharacterRent(db, characterId, options = {}) {
        const lockKey = getRentSettlementLockKey(db, characterId);
        if (dependencies.rentSettlementLocks.has(lockKey)) {
            return {
                success: false,
                reason: 'rent_settlement_in_progress',
                character_id: characterId,
                in_progress: true
            };
        }
        dependencies.rentSettlementLocks.add(lockKey);
        try {
            return await settleCharacterRentUnlocked(db, characterId, options);
        } finally {
            dependencies.rentSettlementLocks.delete(lockKey);
        }
    }

async function settleCharacterRentUnlocked(db, characterId, options = {}) {
        const socialHousingDb = ensureSocialHousingDb(db);
        const cityDb = dependencies.ensureCityDb(db);
        const character = db.getCharacter(characterId);
        if (!character) return { success: false, reason: 'character_missing' };
        const housingContext = socialHousingDb.getHousingContextForCharacter(characterId);
        if (!housingContext?.binding?.housing_id) return { success: false, reason: 'no_housing' };
        const binding = housingContext.binding;
        const home = housingContext.housing || {};
        const amount = Number(binding.rent_weekly || home.weekly_rent || 0);
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, reason: 'rent_not_configured' };
        const weeklyAgencyCollection = String(options.source || '') === 'weekly_friday_agency';
        const paid = Number(character.wallet || 0) >= amount;
        const settledAt = Date.now();
        const cityLog = await generateRentCityLog({
            db,
            userId: options.userId,
            character,
            housingContext,
            amount,
            paid,
            weeklyAgencyCollection,
            now: settledAt
        });
        const privateReply = options.notifyPrivate === false
            ? null
            : await triggerRentPrivateReply({
                db,
                userId: options.userId,
                character,
                housingContext,
                amount,
                paid,
                weeklyAgencyCollection,
                now: settledAt
            });

        if (paid) {
            db.updateCharacter(character.id, { wallet: Number(character.wallet || 0) - amount });
            const nextBinding = socialHousingDb.markRentPaid(character.id, settledAt);
            cityDb.logAction(
                character.id,
                weeklyAgencyCollection ? 'AGENCY_RENT_COLLECTION' : 'RENT',
                cityLog,
                0,
                -amount,
                character.location || 'home'
            );
            return {
                success: true,
                paid: true,
                evicted: false,
                amount,
                character: db.getCharacter(character.id),
                binding: nextBinding,
                private_reply: privateReply
            };
        }

        socialHousingDb.saveBinding(character.id, {
            social_class_id: binding.social_class_id || '',
            housing_id: '',
            housing_status: 'homeless',
            rent_weekly: 0,
            rent_due_day: 7,
            rent_due_at: 0,
            rent_last_paid_at: Number(binding.rent_last_paid_at || 0),
            deposit_paid: 0,
            missed_rent_count: Number(binding.missed_rent_count || 0) + 1,
            note: `收租失败：${home.name || binding.housing_id || '住所'} 被房东或中介收回`
        });
        const nextBinding = socialHousingDb.getBinding(character.id);
        cityDb.logAction(
            character.id,
            weeklyAgencyCollection ? 'AGENCY_RENT_EVICTION' : 'RENT_EVICTION',
            cityLog,
            0,
            0,
            character.location || 'street'
        );
        return {
            success: true,
            paid: false,
            evicted: true,
            amount,
            character: db.getCharacter(character.id),
            binding: nextBinding,
            private_reply: privateReply
        };
    }

async function settleDueRentsForDb(db, options = {}) {
        const socialHousingDb = ensureSocialHousingDb(db);
        const dueBindings = socialHousingDb.getDueRentBindings(Date.now());
        const results = [];
        for (const binding of dueBindings) {
            try {
                results.push(await settleCharacterRent(db, binding.character_id, {
                    source: 'weekly_friday_agency',
                    notifyPrivate: true,
                    userId: options.userId
                }));
            } catch (e) {
                console.warn('[SocialHousing] rent settlement item failed:', e.message);
                results.push({ success: false, character_id: binding.character_id, error: e.message });
            }
        }
        return results;
    }

    return { ensureSocialHousingDb, getRentSettlementLockKey, publishAgencyAdForDb, generateRentCityLog, triggerRentPrivateReply, settleCharacterRent, settleCharacterRentUnlocked, settleDueRentsForDb };
}

module.exports = { createModule };
