// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function parseWebSearchIntentTag(text) {
        const raw = String(text || '');
        const tagMatch = raw.match(/\[WEB_SEARCH_INTENT:\s*([\s\S]*?)\]/i);
        if (!tagMatch) return null;
        const payload = String(tagMatch[1] || '').trim();
        if (!payload) return { reason: '', query_hint: '' };
        try {
            const parsed = JSON.parse(dependencies.extractBalancedJsonPayload(payload, '{', '}'));
            return {
                reason: String(parsed?.reason || '').trim(),
                query_hint: String(parsed?.query_hint || parsed?.query || parsed?.keyword || '').trim(),
                tone: String(parsed?.tone || '').trim()
            };
        } catch (e) {
            return {
                reason: payload.replace(/[{}"']/g, '').slice(0, 120),
                query_hint: payload.replace(/[{}"']/g, '').slice(0, 160)
            };
        }
    }

function stripWebSearchIntentTag(text) {
        return String(text || '')
            .replace(/\[WEB_SEARCH_INTENT:\s*[\s\S]*?\]/gi, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

function formatWebSearchResultsForKnowledge(searchResult) {
        const results = Array.isArray(searchResult?.results) ? searchResult.results.slice(0, 3) : [];
        return [
            `查询: ${searchResult?.query || ''}`,
            `来源: ${searchResult?.source || ''}`,
            `时间: ${searchResult?.fetched_at || new Date().toISOString()}`,
            '',
            ...results.map((item, index) => [
                `${index + 1}. ${item.title || item.url || 'Result'}`,
                item.snippet ? `摘要: ${item.snippet}` : '',
                item.page_text ? `来源正文: ${String(item.page_text).slice(0, 4000)}` : '',
                item.url ? `链接: ${item.url}` : ''
            ].filter(Boolean).join('\n'))
        ].join('\n').trim();
    }

function formatWebSearchBlock({ intent, plan, searchResult, error }) {
        if (error) {
            return [
                '[你刚刚尝试联网查询，但没有成功]',
                `想查的原因: ${intent?.reason || '想确认一下公开信息'}`,
                `准备查的方向: ${plan?.queries?.[0] || intent?.query_hint || ''}`,
                `失败原因: ${error}`,
                '',
                '[使用规则]',
                '- 像真人一样继续对话，可以自然说“我这边没刷出来/网有点卡”。',
                '- 不要提后端、API、key、工具或系统。'
            ].join('\n');
        }
        const results = Array.isArray(searchResult?.results) ? searchResult.results.slice(0, 3) : [];
        return [
            '[你刚刚联网查询到的信息]',
            `你刚才因为“${intent?.reason || '想确认一下'}”而查了一下。`,
            `查询词: ${searchResult?.query || plan?.queries?.[0] || intent?.query_hint || ''}`,
            `来源: ${searchResult?.source || ''}`,
            `时间: ${searchResult?.fetched_at || new Date().toLocaleString()}`,
            '',
            '结果摘要:',
            ...(results.length > 0
                ? results.map((item, index) => [
                    `${index + 1}. ${item.title || item.url || '结果'}`,
                    item.snippet ? `搜索摘要: ${item.snippet}` : '',
                    item.page_text ? `来源正文摘录: ${String(item.page_text).slice(0, 3000)}` : '',
                    item.url ? `链接: ${item.url}` : ''
                ].filter(Boolean).join('\n'))
                : ['没有找到特别有用的结果。']),
            '',
            '[使用规则]',
            '- 这是你刚刚查手机/上网看到的公开信息，不是你的亲身经历。',
            '- 自然继续之前的私聊，不要写成搜索报告。',
            '- 可以说“我刚搜了下/我看到网上写着/我这边查到的是”。',
            '- 不要提后端、API、key、工具、prompt 或系统。'
        ].join('\n');
    }

async function planCharacterWebSearch({ character, intent, transformedHistory, recentInputString, conversationDigest, topicSwitchState }) {
        const fallbackQuery = String(intent?.query_hint || recentInputString || '').trim().slice(0, 180);
        const plannerConfig = dependencies.resolveRagPlannerConfig(character);
        if (!plannerConfig.endpoint || !plannerConfig.key || !plannerConfig.model) {
            return { queries: fallbackQuery ? [fallbackQuery] : [], provider: 'auto', need_fetch_pages: false };
        }
        const plannerInstruction = [
            'WEB SEARCH QUERY PLANNER',
            'The character has decided they would naturally check the web before replying.',
            'Your job is only to turn that character intent into concise search queries.',
            'Do not roleplay. Do not answer the user.',
            '',
            '[Character web intent]',
            `Reason: ${intent?.reason || ''}`,
            `Query hint: ${intent?.query_hint || ''}`,
            '',
            '[Output JSON]',
            '{',
            '  "queries": ["one concise query", "optional second query"],',
            '  "provider": "auto",',
            '  "need_fetch_pages": false',
            '  "save_scope": "character"',
            '}',
            '',
            '[Rules]',
            '- Return ONLY valid JSON.',
            '- Use Chinese query terms when the user is chatting in Chinese.',
            '- Preserve dates, locations, names, product titles, and platform names.',
            '- 1 or 2 queries are enough.',
            '- provider should normally be "auto".'
        ].join('\n');
        const messages = dependencies.buildRagPlannerMessages({
            recentHistory: transformedHistory,
            latestUserMessage: recentInputString,
            conversationDigest,
            plannerInstruction,
            topicSwitchState,
            quoteData: true
        });
        try {
            dependencies.recordLlmDebug(character, 'input', messages, {
                context_type: 'web_search_query_plan',
                planner_source: plannerConfig.source,
                latest_user_message: recentInputString
            });
            const { content, usage, finishReason } = await dependencies.callLLM({
                endpoint: plannerConfig.endpoint,
                key: plannerConfig.key,
                model: plannerConfig.model,
                messages,
                maxTokens: dependencies.SMALL_MODEL_PLANNER_MAX_TOKENS,
                temperature: 0,
                returnUsage: true,
                debugAttempt: dependencies.buildLlmAttemptRecorder(character, {
                    context_type: 'web_search_query_plan',
                    planner_source: plannerConfig.source
                })
            });
            dependencies.recordLlmDebug(character, 'output', content, {
                context_type: 'web_search_query_plan',
                planner_source: plannerConfig.source,
                finishReason: finishReason || '',
                usage: usage || null
            });
            if (usage) dependencies.recordTokenUsage(character.id, 'web_search_query_plan', usage);
            const rawJson = dependencies.extractBalancedJsonPayload(content, '{', '}');
            const parsed = JSON.parse(rawJson);
            const queries = (Array.isArray(parsed?.queries) ? parsed.queries : [])
                .map(item => String(item || '').trim())
                .filter(Boolean)
                .slice(0, 2);
            return {
                queries: queries.length > 0 ? queries : (fallbackQuery ? [fallbackQuery] : []),
                provider: String(parsed?.provider || 'auto').trim() || 'auto',
                need_fetch_pages: parsed?.need_fetch_pages === true,
                save_scope: String(parsed?.save_scope || 'character').trim() || 'character'
            };
        } catch (e) {
            console.warn(`[Engine/Web] Query planner failed for ${character.name}: ${e.message}`);
            return { queries: fallbackQuery ? [fallbackQuery] : [], provider: 'auto', need_fetch_pages: false, save_scope: 'character' };
        }
    }

async function runCharacterWebSearch({ character, intent, plan }) {
        const mcpLab = require("./index.js");
        const query = String(plan?.queries?.[0] || intent?.query_hint || '').trim();
        if (!query) throw new Error('没有可查询的关键词');
        const resolved = mcpLab.resolveSearchProvider(dependencies.db, plan?.provider || 'auto');
        const labDb = mcpLab.ensureMcpLabDb(dependencies.db);
        const taskId = mcpLab.makeId();
        const startedAt = new Date().toISOString();
        const taskBase = {
            id: taskId,
            owner_id: dependencies.userId,
            title: `私聊联网：${query}`.slice(0, 160),
            kind: 'private_web_search',
            input: {
                query,
                provider: resolved.id,
                character_id: character.id,
                character_name: character.name || '',
                reason: intent?.reason || '',
                query_hint: intent?.query_hint || ''
            },
            created_at: startedAt,
            started_at: startedAt
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
            searchResult = await mcpLab.runWebSearch(query, {
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
            const content = formatWebSearchResultsForKnowledge(searchResult);
            if (content) {
                try {
                    labDb.saveExternalKnowledge({
                        owner_id: dependencies.userId,
                        character_id: character.id,
                        title: `联网查询：${query}`.slice(0, 240),
                        content,
                        source_url: (searchResult.results || []).map(item => item.url).filter(Boolean).slice(0, 3).join('\n'),
                        source_type: 'web_search',
                        trust_level: 'search_summary',
                        tags: ['web_search', resolved.id]
                    }, labDb.chunkText(content), mcpLab.makeId);
                } catch (saveErr) {
                    console.warn(`[Engine/Web] Failed to save web knowledge for ${character.name}: ${saveErr.message}`);
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
                console.warn(`[Engine/Web] Failed to save web task error for ${character.name}: ${taskErr.message}`);
            }
            throw searchErr;
        }
        return searchResult;
    }

async function runWebSearchFollowupIfRequested({
        character,
        charCheck,
        generatedText,
        usage,
        apiMessages,
        transformedHistory,
        recentInputString,
        conversationDigest,
        topicSwitchState,
        wsClients
    }) {
        const intent = parseWebSearchIntentTag(generatedText);
        if (!intent) return { generatedText, usage, handled: false };
        setWebSearchActive(character.id, wsClients, true);
        dependencies.updateRagProgress(character.id, wsClients, { currentKey: 'retrieve', status: 'running' });
        const draft = stripWebSearchIntentTag(generatedText);
        let plan = null;
        let searchResult = null;
        let webBlock = '';
        try {
            plan = await planCharacterWebSearch({
                character: charCheck,
                intent,
                transformedHistory,
                recentInputString,
                conversationDigest,
                topicSwitchState
            });
            searchResult = await runCharacterWebSearch({ character: charCheck, intent, plan });
            webBlock = formatWebSearchBlock({ intent, plan, searchResult });
        } catch (e) {
            webBlock = formatWebSearchBlock({ intent, plan, error: e.message });
        }
        const currentUserName = String(dependencies.db.getUserProfile?.()?.name || '用户').trim() || '用户';
        const followupMessages = [
            ...apiMessages,
            ...(draft ? [{ role: 'assistant', content: draft }] : []),
            {
                role: 'user',
                content: [
                    '[系统事件：联网查询结果已返回]',
                    '下面是这次联网查询已经返回的内容。请把它当成你刚刚查手机/网页看到的信息。',
                    `根据这些结果继续给 ${currentUserName} 一个自然的用户可见反馈。`,
                    '这一步不是新的联网决策，不需要再输出 WEB_SEARCH_INTENT。',
                    '',
                    webBlock,
                    '',
                    '[现在继续]',
                    `请作为角色本人，直接告诉 ${currentUserName} 你刚刚查到了什么。`
                ].filter(Boolean).join('\n')
            }
        ];
        dependencies.recordLlmDebug(charCheck, 'input', followupMessages, {
            context_type: 'private_reply_web_followup',
            latest_user_message: recentInputString,
            web_intent: intent,
            web_plan: plan,
            web_result_source: searchResult?.source || ''
        });
        let followup = null;
        try {
            followup = await dependencies.callLLM({
                endpoint: character.api_endpoint,
                key: character.api_key,
                model: character.model_name,
                messages: followupMessages,
                maxTokens: character.max_tokens || 2000,
                presencePenalty: 0.35,
                frequencyPenalty: 0.45,
                returnUsage: true,
                debugAttempt: dependencies.buildLlmAttemptRecorder(character, {
                    context_type: 'private_reply_web_followup'
                })
            });
        } catch (e) {
            setWebSearchActive(character.id, wsClients, false);
            throw e;
        }
        dependencies.recordLlmDebug(charCheck, 'output', followup.content, {
            context_type: 'private_reply_web_followup',
            finishReason: followup.finishReason || '',
            usage: followup.usage || null,
            web_intent: intent,
            web_plan: plan
        });
        const nextText = followup.content || draft || generatedText;
        setWebSearchActive(character.id, wsClients, false);
        return {
            generatedText: nextText,
            usage: dependencies.addUsageTotals(usage, followup.usage),
            finishReason: followup.finishReason || '',
            replyRequest: {
                messages: structuredClone(followupMessages),
                maxTokens: character.max_tokens || 2000,
                presencePenalty: 0.35,
                frequencyPenalty: 0.45
            },
            handled: true
        };
    }

function setWebSearchActive(characterId, wsClients, active) {
        if (!dependencies.timers.has(characterId)) return;
        const timerData = dependencies.timers.get(characterId) || {};
        dependencies.timers.set(characterId, { ...timerData, webSearchActive: !!active });
        dependencies.broadcastEngineState(wsClients);
    }

    return { parseWebSearchIntentTag, stripWebSearchIntentTag, formatWebSearchResultsForKnowledge, formatWebSearchBlock, planCharacterWebSearch, runCharacterWebSearch, runWebSearchFollowupIfRequested, setWebSearchActive };
}

module.exports = { createModule };
