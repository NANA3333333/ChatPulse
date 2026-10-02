// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeCityRuntimeConfigNumber(config, key, fallback) {
        const normalized = dependencies.normalizeCityConfigValue(key, config?.[key]);
        if (normalized === null) return fallback;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

function formatHackerIntelTimestamp(timestamp) {
        try {
            return new Date(Number(timestamp || 0)).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch (e) {
            return String(timestamp || '');
        }
    }

function applyPassiveSurvivalTick(char, currentCals, currentMinute, elapsedMinutes = 1, metabolismPerMinute = 0, dbForHousing = null) {
        const state = dependencies.normalizeSurvivalState(char);
        const housingContext = dependencies.getHousingRuntimeContext(dbForHousing, char);
        const totalMinutes = Math.max(1, parseInt(elapsedMinutes, 10) || 1);
        let calories = Math.max(0, parseInt(currentCals ?? char.calories ?? 2000, 10) || 0);

        for (let i = 0; i < totalMinutes; i++) {
            calories = Math.max(0, calories - Math.max(0, metabolismPerMinute));
            const minuteMark = ((currentMinute - totalMinutes + 1 + i) % 60 + 60) % 60;
            const isSleeping = char.city_status === 'sleeping';
            const isComa = char.city_status === 'coma';
            const atHome = (char.location || 'home') === 'home';
            const slowTick = minuteMark % 10 === 0;
            const mediumTick = minuteMark % 5 === 0;

            // Passive survival should drift gradually. The old minute-by-minute
            // penalties were stacking too aggressively and made "paused actions"
            // look broken because stats still collapsed very fast.
            if (slowTick) {
                state.sleep_debt = dependencies.clamp(state.sleep_debt + (isSleeping ? -2 : 1), 0, 100);
            }

            if (minuteMark % 12 === 0) {
                state.satiety = dependencies.clamp(state.satiety - 1, 0, 100);
            }
            if (minuteMark % 6 === 0) {
                state.stomach_load = dependencies.clamp(state.stomach_load - 2, 0, 100);
            }
            if (slowTick && state.stomach_load >= 75) {
                state.sleep_debt = dependencies.clamp(state.sleep_debt + 1, 0, 100);
            }

            if (mediumTick) {
                let energyDelta = isSleeping ? 2 : 0;
                if (!isSleeping && slowTick) energyDelta -= 1;
                if (calories < 800) energyDelta -= 1;
                if (state.sleep_debt > 70) energyDelta -= 1;
                if (state.health < 40) energyDelta -= 1;
                if (state.stomach_load > 75) energyDelta -= 1;
                const sleepDisruption = dependencies.clamp(parseInt(char.sleep_disruption ?? 0, 10) || 0, 0, 100);
                if (isSleeping && sleepDisruption > 0) {
                    energyDelta -= Math.max(1, Math.ceil(sleepDisruption / 20));
                    if (slowTick) {
                        state.sleep_debt = dependencies.clamp(state.sleep_debt + Math.max(1, Math.ceil(sleepDisruption / 25)), 0, 100);
                    }
                }
                state.energy = dependencies.clamp(state.energy + energyDelta, 0, 100);
            }

            if (slowTick) {
                let stressDelta = 0;
                if ((char.wallet ?? 0) < 20) stressDelta += 1;
                if (calories < 500) stressDelta += 1;
                if (state.sleep_debt > 80) stressDelta += 1;
                if (state.stomach_load > 80) stressDelta += 1;
                if (isSleeping || atHome) stressDelta -= 1;
                if (isComa) stressDelta += 2;
                state.stress = dependencies.clamp(state.stress + stressDelta, 0, 100);

                state.social_need = dependencies.clamp(state.social_need + (atHome ? 1 : -1), 0, 100);
            }

            if (slowTick) {
                let healthDelta = 0;
                if (calories === 0) healthDelta -= 2;
                else if (calories < 400) healthDelta -= 1;
                if (state.sleep_debt > 90) healthDelta -= 1;
                if (isSleeping && calories > 900) healthDelta += 1;
                state.health = dependencies.clamp(state.health + healthDelta, 0, 100);
            }

            const housingPatch = dependencies.getHousingPassiveMinutePatch(housingContext, { isSleeping, atHome, minuteMark });
            Object.assign(state, dependencies.applyNumericPatchToState(state, housingPatch));
        }

        state.mood = dependencies.calculateDerivedMood(state);
        state.calories = calories;
        return state;
    }

function buildSchedulePrompt(char, districts, universalContext) {
        const districtList = districts.map(d => `"${d.id}"(${d.emoji}${d.name})`).join('、');
        return `[世界背景]
${universalContext?.preamble || ''}

[任务]
你是 ${char.name}。为今天 6:00~23:00 规划日程，参考体力/钱包/身体状态/性格。

[可去地点]
${districtList}

[输出规则]
- 只返回 JSON 数组
- 每项含 hour / action / reason
- hour 为 6~23 整数
- action 只能是地点 ID 或 "none"
- 如果今天不规划，只返回一项 {"hour":6,"action":"none","reason":"..."}
- 禁止输出 Markdown、解释、前言、后记、注释
- 必须使用英文双引号，不要使用单引号
- 数组必须完整闭合，以 ] 结束
- 每个对象都必须同时有 hour、action、reason
- 不要输出半截字段，例如 "action   或缺少右引号/右括号

示例：
[{"hour":8,"action":"factory","reason":"去打工赚钱"},{"hour":12,"action":"restaurant","reason":"午饭时间"}]`;
    }

function tryParseScheduleReply(reply = '') {
        const cleaned = String(reply || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
        if (!cleaned) return null;
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : null;
    }

function normalizeGeneratedSchedulePlan(plan, districts = []) {
        if (!Array.isArray(plan) || plan.length === 0) return null;
        const allowedActions = new Set((Array.isArray(districts) ? districts : [])
            .map((district) => String(district?.id || '').trim())
            .filter(Boolean));
        allowedActions.add('none');
        const normalized = [];
        for (const entry of plan) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
            const hour = Number(entry.hour);
            const action = String(entry.action || '').trim();
            const reason = String(entry.reason || '').trim();
            if (!Number.isSafeInteger(hour) || hour < 6 || hour > 23) return null;
            if (!allowedActions.has(action)) return null;
            if (!reason) return null;
            normalized.push({
                hour,
                action,
                reason: reason.slice(0, 160)
            });
        }
        return normalized;
    }

function getPassiveTickIntervalMinutes(frequency) {
        const safeFrequency = Math.max(1, Math.min(30, parseInt(frequency, 10) || 1));
        return Math.max(1, Math.round(20 / safeFrequency));
    }

function queueCityTask(userId, task, options = {}) {
        return dependencies.enqueueBackgroundTask({
            key: `city:${userId}`,
            dedupeKey: options.dedupeKey ? `city:${userId}:${options.dedupeKey}` : '',
            maxPending: options.maxPending ?? 1,
            task
        });
    }

async function maybeGenerateSchedule(char, db, districts, config) {
        if (char.is_scheduled === 0) return; // Schedule disabled by user

        const today = dependencies.getCityDate(config).toISOString().split('T')[0];
        const existing = db.city.getSchedule(char.id, today);
        if (existing && existing.schedule_json && existing.schedule_json !== '[]') return; // already has a real plan for today

        // Prevent concurrent generation for the same character (cron fires every minute, LLM may take >1min)
        const lockKey = `${char.id}_${today}`;
        if (dependencies.scheduleGenLocks.has(lockKey)) return;
        dependencies.scheduleGenLocks.add(lockKey);

        try {
            if (!char.api_endpoint || !char.api_key || !char.model_name) {
                return { success: false, reason: '角色未配置主AI，无法生成日程' };
            }

            if (!existing) {
                const claimed = typeof db.city.claimScheduleGeneration === 'function'
                    ? db.city.claimScheduleGeneration(char.id, today)
                    : true;
                if (!claimed) {
                    return { success: false, reason: '今日计划生成已被其他实例占用' };
                }
            }

            // Broadcast generating state
            dependencies.broadcastCityEvent(dependencies.context.userId, char.id, 'schedule_generating', null);

            const engineContextWrapper = { getUserDb: dependencies.context.getUserDb, getMemory: dependencies.context.getMemory, userId: dependencies.context.userId, forceCityDetail: true };
            const universalResult = await dependencies.buildUniversalContext(engineContextWrapper, char, '', false);
            const prompt = buildSchedulePrompt(char, districts, universalResult);
            const isGeminiModel = String(char.model_name || '').toLowerCase().includes('gemini');
            const scheduleSystemPrompt = isGeminiModel
                ? '你是一个极度严格的 JSON 数组生成器。你只能输出合法 JSON 数组，禁止任何解释、Markdown、代码块、注释、额外文本。若你开始输出 JSON，就必须完整闭合整个数组并结束。'
                : '你是一个日程规划助手。只返回一个 JSON 数组，每个元素都包含 hour、action 和 reason 三个字段。不要输出任何 JSON 之外的文字或 Markdown。';
            const messages = [
                { role: 'system', content: scheduleSystemPrompt },
                { role: 'user', content: prompt }
            ];
            dependencies.recordCityLlmDebug(db, char, 'input', 'city_schedule_generate', messages, { model: char.model_name });
            const reply = await dependencies.callLLM({
                endpoint: char.api_endpoint, key: char.api_key, model: char.model_name,
                messages, maxTokens: 3000, temperature: isGeminiModel ? 0.2 : 0.7
            });
            dependencies.recordCityLlmDebug(db, char, 'output', 'city_schedule_generate', reply, { model: char.model_name });
            const plan = tryParseScheduleReply(reply);
            const valid = normalizeGeneratedSchedulePlan(plan, districts);
            if (valid) {
                db.city.saveSchedule(char.id, today, valid);
                const summary = valid.slice(0, 3).map(e => `${e.hour}:00 ${e.action}`).join(' -> ');
                db.city.logAction(char.id, 'PLAN', `${char.name} 制定了今日计划：${summary}... 📝`, 0, 0);
                console.log(`[City] ${char.name} 📝 日程已生成 (${valid.length} 个时段)`);

                // Broadcast success
                dependencies.broadcastCityEvent(dependencies.context.userId, char.id, 'schedule_updated', valid);
                return true;
            }
            // Failed: log the raw reply for debugging
            const snippet = reply.substring(0, 200);
            console.warn(`[City] ${char.name} 日程 JSON 解析失败, LLM 原始回复: ${snippet}`);
            // Broadcast end (if failed validation)
            dependencies.broadcastCityEvent(dependencies.context.userId, char.id, 'schedule_updated', []);
            if (typeof db.city.releaseScheduleGeneration === 'function') {
                db.city.releaseScheduleGeneration(char.id, today);
            }
            return { success: false, reason: `LLM 返回内容无法解析为 JSON: ${snippet}` };
        } catch (e) {
            console.error(`[City] ${char.name} 日程生成失败: ${e.message}`);
            // Broadcast end (if fetch threw error)
            dependencies.broadcastCityEvent(dependencies.context.userId, char.id, 'schedule_updated', []);
            if (typeof db.city.releaseScheduleGeneration === 'function') {
                db.city.releaseScheduleGeneration(char.id, today);
            }
            return { success: false, reason: e.message };
        } finally {
            dependencies.scheduleGenLocks.delete(lockKey);
        }
    }

    return { normalizeCityRuntimeConfigNumber, formatHackerIntelTimestamp, applyPassiveSurvivalTick, buildSchedulePrompt, tryParseScheduleReply, normalizeGeneratedSchedulePlan, getPassiveTickIntervalMinutes, queueCityTask, maybeGenerateSchedule };
}

module.exports = { createModule };
