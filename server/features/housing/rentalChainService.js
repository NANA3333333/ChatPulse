function compactText(value, fallback = '') {
    return String(value || '').replace(/\s+/g, ' ').trim() || fallback;
}

function unwrapJsonText(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch) return String(fenceMatch[1] || '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return raw.slice(start, end + 1).trim();
    return raw;
}

function parseJsonObject(text, label = '模型输出') {
    const raw = unwrapJsonText(text);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`${label}不是合法 JSON，请重试。`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label}必须是 JSON 对象，请重试。`);
    }
    return parsed;
}

function requireTextField(object, key, label) {
    const value = compactText(object?.[key]);
    if (!value) throw new Error(`${label}缺少 ${key}，请重试。`);
    return value;
}

function normalizeBoolean(value) {
    if (value === true || value === false) return value;
    const text = String(value || '').trim().toLowerCase();
    if (['true', 'yes', 'y', '1', '是', '想', '愿意'].includes(text)) return true;
    if (['false', 'no', 'n', '0', '否', '不想', '不愿意'].includes(text)) return false;
    return null;
}

const VIEWING_MORE_INFO_TAG = 'MORE_INFO';
const VIEWING_DIALOGUE_RUNAWAY_GUARD = 24;

function normalizeMoreInfoTag(value) {
    const text = String(value || '').trim().toUpperCase();
    if (!text) return '';
    return text === VIEWING_MORE_INFO_TAG ? VIEWING_MORE_INFO_TAG : null;
}

function normalizeTextList(value) {
    if (Array.isArray(value)) {
        return value
            .map(item => compactText(item))
            .filter(Boolean);
    }
    const text = compactText(value);
    return text ? [text] : [];
}

function summarizeHome(home = {}) {
    return {
        id: String(home.id || ''),
        name: String(home.name || ''),
        emoji: String(home.emoji || ''),
        description: String(home.description || ''),
        weekly_rent: Number(home.weekly_rent || 0),
        deposit: Number(home.deposit || 0),
        sale_price: Number(home.sale_price || 0),
        comfort: Number(home.comfort || 0),
        prestige: Number(home.prestige || 0),
        privacy: Number(home.privacy || 0)
    };
}

function summarizeCharacter(character = {}, housingContext = null) {
    return {
        id: String(character.id || ''),
        name: String(character.name || ''),
        wallet: Number(character.wallet || 0),
        location: String(character.location || ''),
        city_status: String(character.city_status || ''),
        energy: Number(character.energy ?? 100),
        sleep_debt: Number(character.sleep_debt ?? 0),
        mood: Number(character.mood ?? 50),
        stress: Number(character.stress ?? 20),
        health: Number(character.health ?? 100),
        current_housing: housingContext?.housing ? summarizeHome(housingContext.housing) : null,
        current_housing_status: housingContext?.binding?.housing_id ? String(housingContext.binding.housing_status || 'stable') : 'homeless'
    };
}

function formatViewingDialoguePayload(payload = {}) {
    if (Array.isArray(payload.dialogue) && payload.dialogue.length > 0) {
        const body = payload.dialogue
            .map((line) => {
                const speaker = String(line?.speaker || '') === 'agent' ? '中介' : '角色';
                const content = compactText(line?.content || line?.text || '');
                return content ? `${speaker}：${content}` : '';
            })
            .filter(Boolean)
            .join('\n');
        return [
            body,
            payload.view_summary ? `经过：${payload.view_summary}` : ''
        ].filter(Boolean).join('\n');
    }
    return [
        payload.agent_intro ? `中介：${payload.agent_intro}` : '',
        payload.char_reply_1 ? `角色：${payload.char_reply_1}` : '',
        payload.agent_followup ? `中介：${payload.agent_followup}` : '',
        payload.char_reply_2 ? `角色：${payload.char_reply_2}` : '',
        payload.view_summary ? `经过：${payload.view_summary}` : ''
    ].filter(Boolean).join('\n');
}

function formatChainDialogue(events = []) {
    return events
        .map((event) => {
            const payload = event.payload || {};
            if (event.event_type === 'view_round') {
                return formatViewingDialoguePayload(payload);
            }
            if (event.event_type === 'signing_round') {
                return [
                    payload.agent_contract ? `中介：${payload.agent_contract}` : '',
                    payload.char_reply ? `角色：${payload.char_reply}` : '',
                    payload.signing_summary ? `签约：${payload.signing_summary}` : ''
                ].filter(Boolean).join('\n');
            }
            if (payload.log) return payload.log;
            if (payload.summary) return payload.summary;
            return '';
        })
        .filter(Boolean)
        .join('\n\n');
}

function getChainEvents(socialHousingDb, chainId) {
    return socialHousingDb.getRentalChainEvents
        ? socialHousingDb.getRentalChainEvents(chainId)
        : [];
}

function appendChainEvent(socialHousingDb, chainId, type, payload = {}) {
    if (!socialHousingDb.appendRentalChainEvent) return null;
    return socialHousingDb.appendRentalChainEvent(chainId, type, payload);
}

function createRentalChainService(deps = {}) {
    const {
        callLLM,
        buildUniversalContext,
        getMemory,
        getUserDb,
        getEngine,
        getWsClients,
        ensureSocialHousingDb,
        ensureCityDb,
        resolveAgencyAiChar,
        recordAgencyDebug,
        redactSocialHousingCharacterSecrets
    } = deps;

    function createRetryableError(message) {
        const err = new Error(message);
        err.status = 502;
        err.canRetry = true;
        return err;
    }

    function createBusinessRuleError(message, status = 409) {
        const err = new Error(message);
        err.status = status;
        err.canRetry = false;
        return err;
    }

    function assertHomeIsAvailable(home) {
        if (!home) return;
        if (Number(home.is_enabled ?? 1) !== 1) {
            throw createBusinessRuleError(`房源「${home.name || home.id}」已停用，不能推荐或指派。`);
        }
    }

    function assertCharacterHasNoHousing(socialHousingDb, character, actionLabel = '推荐住房') {
        const context = socialHousingDb.getHousingContextForCharacter(character.id);
        if (context?.binding?.housing_id && context?.housing) {
            const homeLabel = `${context.housing.emoji || ''}${context.housing.name || context.housing.id}`.trim();
            throw createBusinessRuleError(`${character.name || '角色'} 已经住在 ${homeLabel}，不能再${actionLabel}。如需换房，请先在角色住房里解除或调整当前住房。`);
        }
    }

    async function callJsonModel({ db, character, contextType, systemPrompt, userPrompt, temperature = 0.65, maxTokens = 2400 }) {
        if (!character?.api_endpoint || !character?.api_key || !character?.model_name) {
            throw createRetryableError(`${character?.name || '角色'} 没有配置可用 API。`);
        }
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        recordAgencyDebug?.(db, character, 'input', messages, {
            context_type: contextType,
            model: character.model_name
        });
        const result = await callLLM({
            endpoint: character.api_endpoint,
            key: character.api_key,
            model: character.model_name,
            messages,
            maxTokens,
            temperature,
            returnUsage: true
        });
        const raw = typeof result === 'string' ? result : result?.content;
        recordAgencyDebug?.(db, character, 'output', String(raw || ''), {
            context_type: contextType,
            model: character.model_name,
            finishReason: result?.finishReason || '',
            usage: result?.usage || null
        });
        if (String(result?.finishReason || '') === 'length') {
            throw createRetryableError(`${contextType} 输出被截断，请重试。`);
        }
        return parseJsonObject(raw, contextType);
    }

    async function callCharacterJson({ db, userId, character, contextType, stagePrompt, chain, home, extra = {} }) {
        const universal = await buildUniversalContext({
            getUserDb,
            getMemory,
            userId,
            forceCityDetail: true
        }, character, '住房推荐与租房链路', false, []);
        const socialHousingDb = ensureSocialHousingDb(db);
        const housingContext = socialHousingDb.getHousingContextForCharacter(character.id);
        const events = getChainEvents(socialHousingDb, chain.id);
        const userPrompt = [
            '[默认大输入库]',
            universal?.preamble || '',
            '',
            '[角色当前公开状态]',
            JSON.stringify(summarizeCharacter(character, housingContext), null, 2),
            '',
            '[目标房源]',
            JSON.stringify(summarizeHome(home), null, 2),
            '',
            '[租房链路前文]',
            events.length ? formatChainDialogue(events) : '(暂无)',
            '',
            '[当前链路]',
            JSON.stringify({
                chain_id: chain.id,
                stage: chain.stage,
                source: chain.source,
                ...extra
            }, null, 2),
            '',
            stagePrompt
        ].join('\n');
        return callJsonModel({
            db,
            character,
            contextType,
            systemPrompt: [
                `你是 ${character.name}。`,
                '你只输出严格 JSON，不要输出 Markdown 或解释。',
                '所有地点、心理活动和行动细节都由你按自身处境自由决定；系统只提供事实，不强行规定你在哪或怎么想。',
                '如果你没有稳定住房，不要把“自己的房间/自己的床/出租屋里”写成既有事实。'
            ].join('\n'),
            userPrompt,
            temperature: 0.72,
            maxTokens: 3000
        });
    }

    async function callAgencyJson({ db, config, agencyChar, contextType, stagePrompt, chain, home, character, extra = {} }) {
        const systemPrompt = compactText(
            config.persona_prompt,
            '你是商业街里的房产中介 AI。你想把房子推销出去，会根据租客预算与房源条件自然介绍，但不能伪造价格、不能替租客做决定。'
        );
        const socialHousingDb = ensureSocialHousingDb(db);
        const events = getChainEvents(socialHousingDb, chain.id);
        const userPrompt = [
            '[门店信息]',
            JSON.stringify({
                agency_name: config.agency_name,
                agent_name: config.agent_name,
                business_scope: config.business_scope,
                office_district: config.office_district
            }, null, 2),
            '',
            '[租客公开状态]',
            JSON.stringify(summarizeCharacter(character, socialHousingDb.getHousingContextForCharacter(character.id)), null, 2),
            '',
            '[房源]',
            JSON.stringify(summarizeHome(home), null, 2),
            '',
            '[链路前文]',
            events.length ? formatChainDialogue(events) : '(暂无)',
            '',
            '[当前链路]',
            JSON.stringify({ chain_id: chain.id, stage: chain.stage, source: chain.source, ...extra }, null, 2),
            '',
            stagePrompt
        ].join('\n');
        return callJsonModel({
            db,
            character: agencyChar,
            contextType,
            systemPrompt,
            userPrompt,
            temperature: 0.68,
            maxTokens: 2600
        });
    }

    function refreshChain(socialHousingDb, chainId) {
        return socialHousingDb.getRentalChain(chainId);
    }

    async function triggerRecommendationPrivateReply({ db, userId, character, home, chain }) {
        const engine = getEngine(userId);
        if (!engine || typeof engine.triggerImmediateUserReply !== 'function') {
            throw createRetryableError('私聊引擎不可用，请重试。');
        }
        const wsClients = getWsClients(userId);
        const userName = compactText(db.getUserProfile?.().name, '用户');
        const noticeContent = `${userName} 给你推荐了房源「${home.name || home.id}」，想让你去看看合不合适。`;
        const meta = {
            source: 'social_housing_recommendation',
            rental_chain_id: chain.id,
            home_id: home.id
        };
        const { id: msgId, timestamp: msgTs } = db.addMessage(character.id, 'system', noticeContent, meta);
        engine.broadcastNewMessage?.(wsClients, {
            id: msgId,
            character_id: character.id,
            role: 'system',
            content: noticeContent,
            timestamp: msgTs,
            read: 0,
            metadata: meta
        });
        engine.broadcastEvent?.(wsClients, { type: 'refresh_contacts' });
        await engine.triggerImmediateUserReply(character.id, wsClients, {
            propagateError: true,
            extraSystemDirective: [
                '[系统提示：这是一次用户推荐住房后的私聊回应。]',
                `这套房源是 ${userName} 推荐给你（${character.name}）看的，是你可能租住/获得的住处，不是给 ${userName} 自己租的房。`,
                `用户推荐给你的房源：${home.emoji || ''}${home.name || home.id}。`,
                `周租：${Number(home.weekly_rent || 0)} 金币；押金：${Number(home.deposit || 0)} 金币。`,
                '私聊前文和记忆只能作为关系背景；如果前文与本次住房推荐事件的归属冲突，以本次系统事件为准。不要把用户写成看房对象，也不要说“我陪你去看”。',
                '请先按你的性格回应用户这次推荐本身；你可以问用户为什么觉得适合你，可以表达犹豫、接受或吐槽，但你才是被推荐去看房的人，不要替后续看房链路提前下最终结论。',
                '不要输出 [CITY_ACTION:...] 或 [CITY_INTENT:...]；看房行动由租房链路处理，当前只回复这条私聊。'
            ].join('\n'),
            eventUserDirective: `${userName} 给你推荐了房源「${home.name || home.id}」，想让你去看看合不合适。`,
            extraDirectiveRole: 'system',
            skipTopicSwitchGate: true,
            triggerSource: 'social_housing_recommendation',
            triggerRoute: 'socialHousing.recommendHome',
            triggerNote: `rental_chain_${chain.id}`
        });
    }

    function sendFinalPrivateFeedback({ db, userId, socialHousingDb, character, home, chain, outcome, feedback }) {
        const text = compactText(feedback);
        if (!text) throw new Error('租房链路最终私聊反馈为空，请重试。');
        const meta = {
            source: 'social_housing_final_feedback',
            rental_chain_id: chain.id,
            home_id: home.id,
            outcome
        };
        const { id: msgId, timestamp: msgTs } = db.addMessage(character.id, 'character', text, meta);
        const engine = typeof getEngine === 'function' ? getEngine(userId) : null;
        const wsClients = typeof getWsClients === 'function' ? getWsClients(userId) : new Set();
        engine?.broadcastNewMessage?.(wsClients, {
            id: msgId,
            character_id: character.id,
            role: 'character',
            content: text,
            timestamp: msgTs,
            read: 0,
            metadata: meta
        });
        engine?.broadcastEvent?.(wsClients, { type: 'refresh_contacts' });
        appendChainEvent(socialHousingDb, chain.id, 'final_private_feedback', {
            outcome,
            message_id: msgId,
            feedback: text
        });
        return { id: msgId, content: text };
    }

    async function runViewingStage({ db, userId, socialHousingDb, cityDb, chain, character, home, config, agencyChar }) {
        let currentChain = refreshChain(socialHousingDb, chain.id);
        socialHousingDb.updateRentalChain(currentChain.id, { stage: 'viewing', status: 'running' });
        currentChain = refreshChain(socialHousingDb, chain.id);
        const dialogue = [];
        const agentIntro = await callAgencyJson({
            db,
            config,
            agencyChar,
            contextType: 'social_housing_viewing_agent_intro',
            chain: currentChain,
            home,
            character,
            stagePrompt: [
                '第一阶段：看房。',
                '请中介先介绍这套房。',
                '只输出 JSON：{"agent_says":"中介说的话","scene_note":"简短说明中介带看的重点"}。',
                '必须提到真实房名、周租或押金，不要替角色回复。'
            ].join('\n')
        });
        const agentIntroText = requireTextField(agentIntro, 'agent_says', '中介看房介绍');
        dialogue.push({
            speaker: 'agent',
            content: agentIntroText,
            scene_note: compactText(agentIntro.scene_note),
            turn: 0,
            kind: 'intro'
        });

        let finalCharReply = null;
        let lastAgentText = agentIntroText;
        let turn = 0;
        while (true) {
            turn += 1;
            if (turn > VIEWING_DIALOGUE_RUNAWAY_GUARD) {
                throw createRetryableError(`看房问答连续 ${VIEWING_DIALOGUE_RUNAWAY_GUARD} 次仍然带 ${VIEWING_MORE_INFO_TAG} 标签，链路中止，请重试。`);
            }

            const charReply = await callCharacterJson({
                db,
                userId,
                character,
                contextType: `social_housing_viewing_char_reply_${turn}`,
                chain: currentChain,
                home,
                extra: {
                    dialogue,
                    last_agent_says: lastAgentText,
                    more_info_tag: VIEWING_MORE_INFO_TAG
                },
                stagePrompt: [
                    '第一阶段：你正在看房，并和中介问答。',
                    `如果你还需要中介继续回答房源信息，need_more_info_tag 必须填 "${VIEWING_MORE_INFO_TAG}"，open_questions 写出还要问的问题。`,
                    '如果你已经了解够了，need_more_info_tag 必须填空字符串，open_questions 必须为空，并写 view_summary。',
                    `只要你不带 "${VIEWING_MORE_INFO_TAG}"，看房问答就结束，后续你必须基于已知事实做出租或不租的决定，不能再等待中介补答。`,
                    '你可以追问、吐槽、心动、犹豫或保持距离；地点、动作和心理由你自己决定。',
                    `只输出 JSON：{"char_reply":"你对中介说的话","char_narration":"你自己写发生了什么","need_more_info_tag":"${VIEWING_MORE_INFO_TAG} 或空字符串","open_questions":["还需要中介回答的问题"],"view_summary":"摘掉标签时必填的本次看房总结","interest_score":0-100}。`
                ].join('\n')
            });
            const charReplyText = requireTextField(charReply, 'char_reply', `角色看房回应${turn}`);
            const charNarration = requireTextField(charReply, 'char_narration', `角色看房回应${turn}`);
            const moreInfoTag = normalizeMoreInfoTag(charReply.need_more_info_tag);
            if (moreInfoTag === null) {
                throw new Error(`角色看房回应 need_more_info_tag 只能是 ${VIEWING_MORE_INFO_TAG} 或空字符串，请重试。`);
            }
            const openQuestions = moreInfoTag === VIEWING_MORE_INFO_TAG ? normalizeTextList(charReply.open_questions) : [];
            const interestScore = Number(charReply.interest_score || 0);
            const charLine = {
                speaker: 'character',
                content: charReplyText,
                narration: charNarration,
                need_more_info_tag: moreInfoTag,
                open_questions: openQuestions,
                interest_score: interestScore,
                turn
            };
            dialogue.push(charLine);
            finalCharReply = {
                text: charReplyText,
                narration: charNarration,
                need_more_info_tag: moreInfoTag,
                open_questions: openQuestions,
                interest_score: interestScore,
                view_summary: compactText(charReply.view_summary),
                turn
            };

            if (moreInfoTag !== VIEWING_MORE_INFO_TAG) {
                finalCharReply.view_summary = requireTextField(charReply, 'view_summary', '角色看房总结');
                break;
            }

            const agentAnswer = await callAgencyJson({
                db,
                config,
                agencyChar,
                contextType: `social_housing_viewing_agent_answer_${turn}`,
                chain: currentChain,
                home,
                character,
                extra: {
                    dialogue,
                    char_reply: charReplyText,
                    char_narration: charNarration,
                    open_questions: openQuestions,
                    need_more_info_tag: moreInfoTag
                },
                stagePrompt: [
                    `租客这轮带了 ${VIEWING_MORE_INFO_TAG} 标签，说明还需要了解房源情况。`,
                    '请中介继续回答租客刚才的问题或疑虑，再自然推销。',
                    '必须依据房源描述、租金、押金、角色公开状态作答；房源没有提供的事实不要编造，可以明确说“这个我现在不能保证/要再查”。',
                    '不要替租客做决定，也不要强行结束问答。',
                    '只输出 JSON：{"agent_says":"中介继续回答的话","answered_questions":["已经回答的问题"],"unknowns":["无法保证或需要再查的信息"],"selling_angle":"这次主打的卖点或回应的疑虑"}。'
                ].join('\n')
            });
            const agentAnswerText = requireTextField(agentAnswer, 'agent_says', `中介看房回答${turn}`);
            dialogue.push({
                speaker: 'agent',
                content: agentAnswerText,
                answered_questions: normalizeTextList(agentAnswer.answered_questions),
                unknowns: normalizeTextList(agentAnswer.unknowns),
                selling_angle: compactText(agentAnswer.selling_angle),
                turn,
                kind: 'answer'
            });
            lastAgentText = agentAnswerText;
        }

        const characterLines = dialogue.filter(line => line.speaker === 'character');
        const agentAnswerLines = dialogue.filter(line => line.speaker === 'agent' && line.kind === 'answer');
        const firstCharacterLine = characterLines[0] || {};
        const secondCharacterLine = characterLines[1] || finalCharReply || {};
        const firstAgentAnswerLine = agentAnswerLines[0] || {};
        const payload = {
            dialogue,
            agent_intro: agentIntroText,
            agent_scene_note: compactText(agentIntro.scene_note),
            char_reply_1: compactText(firstCharacterLine.content),
            char_narration_1: compactText(firstCharacterLine.narration),
            interest_score_1: Number(firstCharacterLine.interest_score || 0),
            agent_followup: compactText(firstAgentAnswerLine.content),
            selling_angle: compactText(firstAgentAnswerLine.selling_angle),
            char_reply_2: compactText(secondCharacterLine.content || finalCharReply?.text),
            char_narration_2: compactText(secondCharacterLine.narration || finalCharReply?.narration),
            view_summary: finalCharReply.view_summary,
            interest_score_2: Number(finalCharReply.interest_score || 0),
            final_need_more_info_tag: finalCharReply.need_more_info_tag,
            open_questions: finalCharReply.open_questions,
            dialogue_turns: turn
        };
        appendChainEvent(socialHousingDb, currentChain.id, 'view_round', payload);
        cityDb.logAction(
            character.id,
            'HOUSING_VIEW',
            `🏠 看房：${payload.view_summary}`,
            0,
            0,
            character.location || config.office_district || 'street'
        );
        socialHousingDb.updateRentalChain(currentChain.id, { stage: 'viewed', status: 'running' });
        return refreshChain(socialHousingDb, currentChain.id);
    }

    async function runConsiderStage({ db, userId, socialHousingDb, cityDb, chain, character, home }) {
        socialHousingDb.updateRentalChain(chain.id, { stage: 'considering', status: 'running' });
        const currentChain = refreshChain(socialHousingDb, chain.id);
        const result = await callCharacterJson({
            db,
            userId,
            character,
            contextType: 'social_housing_consideration',
            chain: currentChain,
            home,
            stagePrompt: [
                '第二阶段：考虑。',
                `刚才看房问答已经因为你没有继续带 ${VIEWING_MORE_INFO_TAG} 标签而结束。`,
                '请你结合自身情况、钱包、住房状态和刚才看房经历，写一条商业街活动。',
                '你可以犹豫、权衡、烦躁或心动，但不能再把“等待中介回答/还需要补充信息”当成悬置理由。',
                '下一阶段你必须做出租或不租的决定。',
                '不要被系统强行限定地点或心理状态；你自己决定你在哪里、在做什么、怎么想。',
                '只输出 JSON：{"consideration_log":"公开商业街活动一句到一小段","private_thought":"你心里最在意的点","leaning":"rent|decline","concern":"当前最大顾虑"}。'
            ].join('\n')
        });
        const log = requireTextField(result, 'consideration_log', '看房考虑');
        appendChainEvent(socialHousingDb, currentChain.id, 'consideration', {
            log,
            private_thought: compactText(result.private_thought),
            leaning: compactText(result.leaning),
            concern: compactText(result.concern)
        });
        cityDb.logAction(character.id, 'HOUSING_CONSIDER', log, 0, 0, character.location || 'street');
        socialHousingDb.updateRentalChain(currentChain.id, { stage: 'considered', status: 'running' });
        return refreshChain(socialHousingDb, currentChain.id);
    }

    async function runDecisionStage({ db, userId, socialHousingDb, cityDb, chain, character, home, config, agencyChar }) {
        socialHousingDb.updateRentalChain(chain.id, { stage: 'deciding', status: 'running' });
        const currentChain = refreshChain(socialHousingDb, chain.id);
        const totalDue = Number(home.weekly_rent || 0) + Number(home.deposit || 0);
        const result = await callCharacterJson({
            db,
            userId,
            character,
            contextType: 'social_housing_decision',
            chain: currentChain,
            home,
            extra: { total_due_now: totalDue, wallet: Number(character.wallet || 0) },
            stagePrompt: [
                '第三阶段：决定。',
                `看房问答已经结束：你没有继续带 ${VIEWING_MORE_INFO_TAG} 标签，所以现在必须基于已知事实做最终决定。`,
                '你要自己决定是否租这套房。',
                '不能再输出“等中介回答、还要再了解、之后再说”这种未决状态；可以因为已知缺陷、预算、情绪或生活判断而拒租。',
                '后端会真实检查钱包余额；你可以想租但钱不够。',
                '如果你决定不租，private_feedback 必须写成发给推荐你房源的用户的一条私聊反馈；如果你想租，private_feedback 可以为空，后续签约/被拒后会再反馈。',
                '只输出 JSON：{"wants_to_rent":true|false,"decision_log":"一条商业街活动，写你做出决定发生了什么","reason":"决定理由","budget_feeling":"你对价格的感受","private_feedback":"最终私聊反馈，想租时可为空"}。'
            ].join('\n')
        });
        const wantsToRent = normalizeBoolean(result.wants_to_rent);
        if (wantsToRent === null) throw new Error('租房决定缺少 wants_to_rent 布尔值，请重试。');
        const decisionLog = requireTextField(result, 'decision_log', '租房决定');
        appendChainEvent(socialHousingDb, currentChain.id, 'decision', {
            wants_to_rent: wantsToRent,
            log: decisionLog,
            reason: compactText(result.reason),
            budget_feeling: compactText(result.budget_feeling),
            total_due: totalDue,
            wallet: Number(character.wallet || 0)
        });
        cityDb.logAction(character.id, 'HOUSING_DECISION', decisionLog, 0, 0, character.location || 'street');

        if (!wantsToRent) {
            sendFinalPrivateFeedback({
                db,
                userId,
                socialHousingDb,
                character,
                home,
                chain: currentChain,
                outcome: 'declined',
                feedback: requireTextField(result, 'private_feedback', '拒租最终私聊反馈')
            });
            socialHousingDb.updateRentalChain(currentChain.id, {
                stage: 'declined',
                status: 'completed',
                completed_at: Date.now()
            });
            return { chain: refreshChain(socialHousingDb, currentChain.id), outcome: 'declined' };
        }

        if (Number(character.wallet || 0) < totalDue) {
            const rejection = await callAgencyJson({
                db,
                config,
                agencyChar,
                contextType: 'social_housing_insufficient_funds_rejection',
                chain: currentChain,
                home,
                character,
                extra: { total_due: totalDue, wallet: Number(character.wallet || 0) },
                stagePrompt: [
                    '租客想租房，但钱包余额不够支付押金 + 首周租金。',
                    '请中介明确拒绝，语气可以势利、嘲笑或阴阳怪气，但不要暴力威胁。',
                    '只输出 JSON：{"agent_says":"中介拒绝的话","rejection_log":"公开商业街活动，写这次被拒发生了什么"}。'
                ].join('\n')
            });
            const rejectionLog = requireTextField(rejection, 'rejection_log', '中介拒绝');
            appendChainEvent(socialHousingDb, currentChain.id, 'insufficient_rejection', {
                agent_says: requireTextField(rejection, 'agent_says', '中介拒绝'),
                log: rejectionLog,
                total_due: totalDue,
                wallet: Number(character.wallet || 0)
            });
            const finalFeedback = await callCharacterJson({
                db,
                userId,
                character,
                contextType: 'social_housing_insufficient_funds_private_feedback',
                chain: refreshChain(socialHousingDb, currentChain.id),
                home,
                extra: {
                    total_due: totalDue,
                    wallet: Number(character.wallet || 0),
                    agent_rejection: rejectionLog
                },
                stagePrompt: [
                    '最终阶段：你想租这套房，但因为钱不够被中介拒绝了。',
                    '请给推荐你房源的用户发一条私聊反馈，说明最终结果和你的真实反应。',
                    '这是私聊反馈，不是商业街公开活动；不要输出行动标签，也不要再说之后再决定。',
                    '只输出 JSON：{"private_feedback":"发给用户的一条私聊反馈"}。'
                ].join('\n')
            });
            sendFinalPrivateFeedback({
                db,
                userId,
                socialHousingDb,
                character,
                home,
                chain: currentChain,
                outcome: 'rejected_insufficient_funds',
                feedback: requireTextField(finalFeedback, 'private_feedback', '余额不足最终私聊反馈')
            });
            cityDb.logAction(character.id, 'HOUSING_REJECTED', rejectionLog, 0, 0, character.location || config.office_district || 'street');
            socialHousingDb.updateRentalChain(currentChain.id, {
                stage: 'rejected_insufficient_funds',
                status: 'completed',
                completed_at: Date.now()
            });
            return { chain: refreshChain(socialHousingDb, currentChain.id), outcome: 'rejected_insufficient_funds' };
        }

        socialHousingDb.updateRentalChain(currentChain.id, { stage: 'ready_to_sign', status: 'running' });
        return { chain: refreshChain(socialHousingDb, currentChain.id), outcome: 'ready_to_sign' };
    }

    async function runSigningStage({ db, userId, socialHousingDb, cityDb, chain, character, home, config, agencyChar }) {
        socialHousingDb.updateRentalChain(chain.id, { stage: 'signing', status: 'running' });
        const currentChain = refreshChain(socialHousingDb, chain.id);
        const totalDue = Number(home.weekly_rent || 0) + Number(home.deposit || 0);
        const agentContract = await callAgencyJson({
            db,
            config,
            agencyChar,
            contextType: 'social_housing_signing_agent',
            chain: currentChain,
            home,
            character,
            extra: { total_due: totalDue },
            stagePrompt: [
                '第四阶段：签合同。',
                '请中介说明签约与当下要付的钱。',
                '只输出 JSON：{"agent_says":"中介签约说明","contract_terms":"简短合同要点"}。'
            ].join('\n')
        });
        const contractText = requireTextField(agentContract, 'agent_says', '签约中介');
        const charSigning = await callCharacterJson({
            db,
            userId,
            character,
            contextType: 'social_housing_signing_char',
            chain: currentChain,
            home,
            extra: { agent_contract: contractText, total_due: totalDue },
            stagePrompt: [
                '第四阶段：你和中介签合同。',
                '请由你自己描写发生了什么，包含你对这套房真正落到自己名下/租约生效的反应。',
                'private_feedback 必须写成发给推荐你房源的用户的一条私聊反馈，告诉对方你最后租下来了，以及你的反应。',
                '只输出 JSON：{"char_reply":"你对中介说的话","signing_summary":"公开商业街活动，写签约发生了什么","private_aftertaste":"签完后你的余味","private_feedback":"发给用户的一条最终私聊反馈"}。'
            ].join('\n')
        });
        const signingSummary = requireTextField(charSigning, 'signing_summary', '签约角色总结');
        const signingPrivateFeedback = requireTextField(charSigning, 'private_feedback', '签约最终私聊反馈');
        const freshCharacter = db.getCharacter(character.id) || character;
        if (Number(freshCharacter.wallet || 0) < totalDue) {
            throw new Error('签约前余额已经不足，链路中止，请重试。');
        }
        const nextWallet = +(Number(freshCharacter.wallet || 0) - totalDue).toFixed(2);
        const paidAt = Date.now();
        const nextRentDueAt = typeof socialHousingDb.getNextRentCollectionAt === 'function'
            ? socialHousingDb.getNextRentCollectionAt(paidAt + 7 * 24 * 60 * 60 * 1000, { includeCurrentDay: true })
            : paidAt + 7 * 24 * 60 * 60 * 1000;
        db.updateCharacter(character.id, { wallet: nextWallet });
        socialHousingDb.saveBinding(character.id, {
            housing_id: home.id,
            housing_status: 'stable',
            rent_weekly: Number(home.weekly_rent || 0),
            rent_due_day: 7,
            rent_last_paid_at: paidAt,
            rent_due_at: nextRentDueAt,
            deposit_paid: Number(home.deposit || 0),
            missed_rent_count: 0,
            note: `租房链路签约：${home.name || home.id}`
        });
        appendChainEvent(socialHousingDb, currentChain.id, 'signing_round', {
            agent_contract: contractText,
            contract_terms: compactText(agentContract.contract_terms),
            char_reply: requireTextField(charSigning, 'char_reply', '签约角色回应'),
            signing_summary: signingSummary,
            private_aftertaste: compactText(charSigning.private_aftertaste),
            total_due: totalDue,
            wallet_after: nextWallet
        });
        cityDb.logAction(
            character.id,
            'HOUSING_SIGNED',
            `${signingSummary} ${home.emoji || ''}${home.name || home.id} 的租约生效，${character.name} 有了自己的住处。`.trim(),
            0,
            -totalDue,
            character.location || config.office_district || 'street'
        );
        sendFinalPrivateFeedback({
            db,
            userId,
            socialHousingDb,
            character: db.getCharacter(character.id) || character,
            home,
            chain: currentChain,
            outcome: 'signed',
            feedback: signingPrivateFeedback
        });
        socialHousingDb.updateRentalChain(currentChain.id, {
            stage: 'signed',
            status: 'completed',
            completed_at: Date.now()
        });
        return { chain: refreshChain(socialHousingDb, currentChain.id), outcome: 'signed' };
    }

    function failChain(socialHousingDb, chainId, error) {
        const message = compactText(error?.message || error || '租房链路失败');
        if (chainId && socialHousingDb?.markRentalChainFailed) {
            socialHousingDb.markRentalChainFailed(chainId, message);
            appendChainEvent(socialHousingDb, chainId, 'error', { error: message });
        }
        const wrapped = createRetryableError(`${message} 请重试。`);
        wrapped.original = error;
        wrapped.chain = chainId ? socialHousingDb.getRentalChain?.(chainId) : null;
        return wrapped;
    }

    async function recommendHomeToCharacter({ db, userId, characterId, homeId, agencyAdId = 0, runFullChain = true }) {
        const socialHousingDb = ensureSocialHousingDb(db);
        const cityDb = ensureCityDb(db);
        const character = db.getCharacter(characterId);
        if (!character) {
            const err = new Error('角色不存在');
            err.status = 404;
            throw err;
        }
        const home = socialHousingDb.getHousingById(homeId);
        if (!home) {
            const err = new Error('房源不存在');
            err.status = 404;
            throw err;
        }
        assertHomeIsAvailable(home);
        assertCharacterHasNoHousing(socialHousingDb, character, '推荐住房');
        const config = socialHousingDb.getAgencyConfig();
        const agencyChar = resolveAgencyAiChar(db, config);
        if (!agencyChar) throw createRetryableError('中介所没有可用 AI 模型，请先选择中介模型。');

        const chainId = socialHousingDb.createRentalChain({
            character_id: character.id,
            home_id: home.id,
            agency_ad_id: Number(agencyAdId || 0),
            source: 'user_recommendation',
            stage: 'recommended',
            status: 'running'
        });
        let chain = socialHousingDb.getRentalChain(chainId);
        appendChainEvent(socialHousingDb, chain.id, 'recommended', {
            character_id: character.id,
            character_name: character.name,
            home: summarizeHome(home)
        });

        try {
            await triggerRecommendationPrivateReply({ db, userId, character, home, chain });
            appendChainEvent(socialHousingDb, chain.id, 'private_reply_requested', { ok: true });
            if (!runFullChain) return { chain: socialHousingDb.getRentalChain(chain.id), outcome: 'recommended' };
            chain = await runViewingStage({ db, userId, socialHousingDb, cityDb, chain, character: db.getCharacter(character.id) || character, home, config, agencyChar });
            chain = await runConsiderStage({ db, userId, socialHousingDb, cityDb, chain, character: db.getCharacter(character.id) || character, home });
            const decision = await runDecisionStage({ db, userId, socialHousingDb, cityDb, chain, character: db.getCharacter(character.id) || character, home, config, agencyChar });
            if (decision.outcome !== 'ready_to_sign') {
                return { chain: decision.chain, outcome: decision.outcome };
            }
            return runSigningStage({
                db,
                userId,
                socialHousingDb,
                cityDb,
                chain: decision.chain,
                character: db.getCharacter(character.id) || character,
                home,
                config,
                agencyChar
            });
        } catch (error) {
            throw failChain(socialHousingDb, chain.id, error);
        }
    }

    async function assignHomeToCharacter({ db, userId, characterId, homeId }) {
        const socialHousingDb = ensureSocialHousingDb(db);
        const cityDb = ensureCityDb(db);
        const character = db.getCharacter(characterId);
        if (!character) {
            const err = new Error('角色不存在');
            err.status = 404;
            throw err;
        }
        const home = socialHousingDb.getHousingById(homeId);
        if (!home) {
            const err = new Error('房源不存在');
            err.status = 404;
            throw err;
        }
        assertHomeIsAvailable(home);
        assertCharacterHasNoHousing(socialHousingDb, character, '直接指派住房');
        socialHousingDb.saveBinding(character.id, {
            housing_id: home.id,
            housing_status: 'stable',
            rent_weekly: 0,
            rent_due_day: 7,
            rent_last_paid_at: Date.now(),
            rent_due_at: 0,
            deposit_paid: 0,
            missed_rent_count: 0,
            note: `用户指派住房：${home.name || home.id}`
        });
        const userName = compactText(db.getUserProfile?.().name, '用户');
        const log = `${userName} 把 ${home.emoji || ''}${home.name || home.id} 指派给 ${character.name}，${character.name} 终于有了自己的住处。`;
        cityDb.logAction(character.id, 'HOUSING_GRANTED', log, 0, 0, character.location || 'street');

        const engine = getEngine(userId);
        const wsClients = getWsClients(userId);
        if (!engine || typeof engine.triggerImmediateUserReply !== 'function') {
            throw createRetryableError('住房已指派，但私聊引擎不可用，请重试私聊通知。');
        }
        const noticeContent = `${userName} 把「${home.name || home.id}」指派给你了。你现在有了自己的住处。`;
        const { id: msgId, timestamp: msgTs } = db.addMessage(character.id, 'system', noticeContent, {
            source: 'social_housing_assignment',
            home_id: home.id
        });
        engine.broadcastNewMessage?.(wsClients, {
            id: msgId,
            character_id: character.id,
            role: 'system',
            content: noticeContent,
            timestamp: msgTs,
            read: 0,
            metadata: { source: 'social_housing_assignment', home_id: home.id }
        });
        engine.broadcastEvent?.(wsClients, { type: 'refresh_contacts' });
        await engine.triggerImmediateUserReply(character.id, wsClients, {
            propagateError: true,
            extraSystemDirective: [
                '[系统提示：这是一次用户分配住房后的回复。]',
                `${userName} 把 ${home.emoji || ''}${home.name || home.id} 给了你作为住处。`,
                '请先回应“你获得住房”这件事本身。它是真实居住状态变化，不是普通建议。'
            ].join('\n'),
            triggerSource: 'social_housing_assignment',
            triggerRoute: 'socialHousing.assignHome',
            triggerNote: `home_${home.id}`
        });
        return {
            character: db.getCharacter(character.id),
            housing_context: socialHousingDb.getHousingContextForCharacter(character.id),
            characters: redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => db.getCharacters()))
        };
    }

    return {
        recommendHomeToCharacter,
        assignHomeToCharacter
    };
}

module.exports = {
    createRentalChainService
};
