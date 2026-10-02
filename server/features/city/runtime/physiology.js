// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeMetabolismPerMinute(config) {
        const metabolismRate = dependencies.normalizeCityRuntimeConfigNumber(config, 'metabolism_rate', 20);
        if (metabolismRate <= 0) return 0;
        return Math.max(1, Math.round(metabolismRate / 15));
    }

function getPhysicalCondition(char, state = null, currentCals = null) {
        const s = state || dependencies.normalizeSurvivalState(char);
        const calories = Number(currentCals ?? char.calories ?? 2000);
        let score = 0;

        if (s.energy <= 10) score += 5;
        else if (s.energy <= 25) score += 3;
        else if (s.energy <= 40) score += 1;

        if (s.sleep_debt >= 90) score += 4;
        else if (s.sleep_debt >= 75) score += 3;
        else if (s.sleep_debt >= 55) score += 1;

        if (s.health <= 25) score += 4;
        else if (s.health <= 45) score += 2;

        if (s.satiety <= 15 || calories <= 400) score += 2;
        else if (s.satiety <= 30 || calories <= 900) score += 1;

        if (s.stomach_load >= 80) score += 2;
        else if (s.stomach_load >= 60) score += 1;

        if (s.stress >= 85) score += 2;
        else if (s.stress >= 65) score += 1;

        if (score >= 9) {
            return { level: 'critical', label: '崩溃边缘', summary: '你的身体已经接近极限，注意力、耐心和判断力都在明显下滑，很容易继续硬撑后彻底垮掉。' };
        }
        if (score >= 6) {
            return { level: 'drained', label: '透支', summary: '你现在处在明显透支状态，脑子发钝，身体沉重，恢复速度变慢，普通活动都会比平时更吃力。' };
        }
        if (score >= 3) {
            return { level: 'tired', label: '疲惫', summary: '你现在不在最佳状态，身体和精神都有些被拖住，专注度、耐心和行动流畅度会比平时差一些。' };
        }
        return { level: 'stable', label: '稳定', summary: '你的身体整体还算稳定，没有明显拖垮你的短板。' };
    }

async function buildEmergencyHospitalNarrations(char, hospital, db, details = {}) {
        if (!(char?.api_endpoint && char?.api_key && char?.model_name)) {
            throw dependencies.createCityError('急救送医文案生成缺少模型 URL/Key/模型名，请补全后重试。', 400, true);
        }

        const state = dependencies.normalizeSurvivalState(char);
        const locationLabel = String(details.locationLabel || '商业街').trim();
        const requestedDistrict = details.requestedDistrict || null;
        const actionCode = String(details.actionCode || hospital?.id || 'hospital').trim().toUpperCase();
        const reason = String(details.reason || '身体透支到撑不住').trim();
        const walletAfter = Number(details.walletAfter || 0);
        const walletText = walletAfter < 0
            ? `急救费 ${dependencies.EMERGENCY_HOSPITAL_FEE} 金币已经记账，醒来时账面变成 ${walletAfter} 金币负债。`
            : `急救费 ${dependencies.EMERGENCY_HOSPITAL_FEE} 金币已经扣除，醒来时钱包剩下 ${walletAfter} 金币。`;
        const requestedLine = requestedDistrict?.name
            ? `\n原本还想去：${requestedDistrict.emoji || ''}${requestedDistrict.name}。`
            : '';
        const recentAntiRepeat = dependencies.buildRecentNarrationAntiRepeatBlock(db, char, hospital || { id: 'hospital', type: 'medical' });
        const privateChatAntiRepeat = dependencies.buildRecentPrivateChatAntiRepeatBlock(db, char);
        const prompt = `你是 ${char.name}，这是一轮真实发生的商业街事件。

已经确定的事实：
- 你在 ${locationLabel} 因为「${reason}」失去意识。${requestedLine}
- 你被附近的人、工作人员或急救人员送到 ${hospital?.emoji || '🏥'}${hospital?.name || '医院'}。
- 你醒来时面对陌生的医院环境，以及一张急救账单。
- ${walletText}
- 体力从 ${Number(details.beforeCalories || 0)}/4000 被急救稳定到 ${Number(details.nextCalories || 0)}/4000，接下来需要在医院观察约 ${Number(details.medicalStayMinutes || 60)} 分钟。
- 当前身体状态：精力 ${state.energy}/100，睡眠债 ${state.sleep_debt}/100，心情 ${state.mood}/100，压力 ${state.stress}/100，健康 ${state.health}/100。
${recentAntiRepeat}${privateChatAntiRepeat}

要求：
- log 只写这次昏倒、被送医、醒来面对陌生环境和账单的具体经过，不要写成系统总结。
- 不要使用“因为饥饿晕倒了”“饿晕了”“眼前一黑倒了下去”这类固定句式。
- 具体细节由你按角色性格、身体状态和现场处境自由决定；可以写环境、动作、反应、账单压力或醒来后的迟钝感。
- chat / diary 只有自然需要时才写，可以留空；不要默认求助，不要套固定求救话术。
- 不要照抄上面的事实句，把事实转成角色自己的事件记录。
- 返回必须是合法 JSON 对象，包含 action、log、chat、diary 四个字段；action 固定为 [${actionCode}]。不要返回 JSON 之外的任何内容。`;

        const messages = [
            { role: 'system', content: '你是角色自己的现实行动记录器。只返回合法 JSON 对象，不要输出任何额外解释、markdown、前言或后记。' },
            { role: 'user', content: prompt }
        ];
        dependencies.recordCityLlmDebug(db, char, 'input', 'city_emergency_hospital_narration', messages, {
            model: char.model_name,
            reason,
            actionCode,
            location: char.location || ''
        });
        let reply = '';
        try {
            reply = await dependencies.callLLM({
                endpoint: char.api_endpoint,
                key: char.api_key,
                model: char.model_name,
                messages,
                maxTokens: 2200,
                temperature: 0.9,
                presencePenalty: 0.2,
                frequencyPenalty: 0.35,
                debugAttempt: dependencies.buildCityAttemptRecorder(db, char, 'city_emergency_hospital_narration', {
                    reason,
                    actionCode,
                    location: char.location || ''
                })
            });
        } catch (err) {
            throw dependencies.createCityError(`急救送医文案生成请求失败，请重试：${err.message}`, 502, true);
        }
        dependencies.recordCityLlmDebug(db, char, 'output', 'city_emergency_hospital_narration', reply, {
            model: char.model_name,
            reason,
            actionCode,
            location: char.location || ''
        });

        let parsed = null;
        try {
            parsed = dependencies.tryParseCityActionReply(reply);
        } catch (err) {
            throw dependencies.createCityError(`急救送医返回的 JSON 无法解析，请重试：${err.message || 'parse_failed'}`, 502, true);
        }
        if (!parsed || String(parsed.action || '').trim().toUpperCase() !== `[${actionCode}]`) {
            throw dependencies.createCityError('急救送医返回缺少有效 action。', 502, true);
        }
        if (!String(parsed.log || '').trim()) {
            throw dependencies.createCityError('急救送医返回缺少可用 log。', 502, true);
        }
        return {
            log: String(parsed.log || '').trim(),
            chat: String(parsed.chat || '').trim(),
            diary: String(parsed.diary || '').trim()
        };
    }

function getMedicalStayMinutes(district) {
        const durationTicks = Math.max(1, parseInt(district?.duration_ticks, 10) || 1);
        return Math.max(dependencies.MEDICAL_RECOVERY_INTERVAL_MINUTES, durationTicks * dependencies.MEDICAL_STAY_MINUTES_PER_TICK);
    }

function buildMedicalAdmissionRecoveryPatch(char, district, currentCals = null, options = {}) {
        const state = dependencies.normalizeSurvivalState(char);
        const resolveNumber = (value, fallback) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const caloriesFloor = Math.max(
            dependencies.EMERGENCY_STABILIZE_CALORIES,
            resolveNumber(options.caloriesFloor, Number(district?.cal_reward || 0) || dependencies.EMERGENCY_STABILIZE_CALORIES)
        );
        const targetCalories = dependencies.clamp(Math.max(
            Math.round(Number(currentCals ?? char.calories ?? 0) || 0),
            caloriesFloor
        ), 0, 4000);
        const targetEnergy = dependencies.clamp(Math.max(state.energy, resolveNumber(options.energyFloor, dependencies.MEDICAL_ADMISSION_ENERGY_FLOOR)), 0, 100);
        const targetSleepDebt = dependencies.clamp(Math.min(state.sleep_debt, resolveNumber(options.sleepDebtCeiling, dependencies.MEDICAL_ADMISSION_SLEEP_DEBT_CEILING)), 0, 100);
        const targetStress = dependencies.clamp(Math.min(state.stress, resolveNumber(options.stressCeiling, dependencies.MEDICAL_ADMISSION_STRESS_CEILING)), 0, 100);
        const targetHealth = dependencies.clamp(Math.max(state.health, resolveNumber(options.healthFloor, dependencies.MEDICAL_ADMISSION_HEALTH_FLOOR)), 0, 100);
        const patch = {
            energy: targetEnergy,
            sleep_debt: targetSleepDebt,
            stress: targetStress,
            social_need: state.social_need,
            health: targetHealth,
            satiety: state.satiety,
            stomach_load: state.stomach_load
        };
        patch.mood = dependencies.clamp(dependencies.calculateDerivedMood({ ...state, calories: targetCalories, ...patch }), 0, 100);
        return {
            calories: targetCalories,
            patch
        };
    }

function getMedicalStatusTiming(char, fallbackNowMs) {
        const startedAt = Number(char.city_status_started_at || 0) || fallbackNowMs;
        let untilAt = Number(char.city_status_until_at || 0) || 0;
        if (!untilAt || untilAt <= startedAt) {
            untilAt = startedAt + dependencies.MEDICAL_STAY_MINUTES_PER_TICK * 60 * 1000;
        }
        const lastRecoveryAt = Number(char.city_medical_last_recovery_at || 0) || startedAt;
        return { startedAt, untilAt, lastRecoveryAt };
    }

function isEmergencyHighDemandDistrict(district = null) {
        const districtType = String(district?.type || '').trim();
        return ['work', 'education', 'gambling', 'leisure', 'wander', 'shopping'].includes(districtType);
    }

function getEmergencyHospitalReason(char, currentCals, requestedDistrict = null) {
        const state = dependencies.normalizeSurvivalState(char);
        const calories = Number(currentCals ?? char.calories ?? 2000);
        const parts = [];
        if (calories <= dependencies.EMERGENCY_HUNGER_CALORIES) {
            parts.push(`体力只剩 ${Math.max(0, Math.round(calories))}/4000`);
        }
        if (state.energy <= dependencies.EMERGENCY_CRITICAL_ENERGY) {
            parts.push(`精力跌到 ${state.energy}/100`);
        } else if (!requestedDistrict && state.energy < dependencies.EMERGENCY_EXHAUSTION_ENERGY) {
            parts.push(`精力只剩 ${state.energy}/100`);
        }
        if (state.sleep_debt >= dependencies.EMERGENCY_CRITICAL_SLEEP_DEBT) {
            parts.push(`睡眠债堆到 ${state.sleep_debt}/100`);
        } else if (!requestedDistrict && state.sleep_debt > dependencies.EMERGENCY_SLEEP_DEBT) {
            parts.push(`睡眠债已经到 ${state.sleep_debt}/100`);
        }

        if (
            requestedDistrict &&
            isEmergencyHighDemandDistrict(requestedDistrict) &&
            (calories < 500 || state.energy < dependencies.EMERGENCY_EXHAUSTION_ENERGY || state.sleep_debt > dependencies.EMERGENCY_SLEEP_DEBT)
        ) {
            parts.push(`还想硬撑去${requestedDistrict.name || requestedDistrict.id || '高消耗地点'}`);
        }

        if (parts.length === 0) return '';
        return `${parts.join('，')}，身体已经撑不住`;
    }

async function settleEmergencyHospitalTransfer(char, db, userId, currentCals, reason, config, requestedDistrict = null, options = {}) {
        const hospital = db.city.getDistrict('hospital')
            || db.city.getEnabledDistricts().find(d => d.type === 'medical')
            || { id: 'hospital', name: '医院', emoji: '🏥', duration_ticks: 1, cal_reward: 1500 };
        const cityNowMs = dependencies.getCityDate(config).getTime();
        const beforeCalories = dependencies.clamp(Math.round(Number(currentCals ?? char.calories ?? 0) || 0), 0, 4000);
        const walletBefore = Number(char.wallet || 0);
        const walletAfter = +(walletBefore - dependencies.EMERGENCY_HOSPITAL_FEE).toFixed(2);
        const admission = buildMedicalAdmissionRecoveryPatch(char, hospital, beforeCalories);
        const medicalStayMinutes = getMedicalStayMinutes(hospital);
        const patch = {
            calories: admission.calories,
            city_status: 'medical',
            location: hospital.id || 'hospital',
            wallet: walletAfter,
            city_status_started_at: cityNowMs,
            city_status_until_at: cityNowMs + medicalStayMinutes * 60 * 1000,
            city_medical_last_recovery_at: cityNowMs,
            work_distraction: 0,
            sleep_disruption: 0,
            ...admission.patch
        };
        const locationDistrict = char.location ? db.city.getDistrict(char.location) : null;
        const locationLabel = locationDistrict
            ? `${locationDistrict.emoji || ''}${locationDistrict.name || locationDistrict.id || ''}`
            : (char.location || '商业街');
        const hospitalActionType = String(options.actionType || hospital.id || 'hospital').toUpperCase();

        db.updateCharacter(char.id, patch);
        dependencies.logEmotionTransitionToState(
            db,
            char,
            { ...char, ...patch },
            'city_emergency_hospital',
            `角色因体力或疲劳透支昏倒，被送往医院并被一次性稳定到中等恢复区间，产生 ${dependencies.EMERGENCY_HOSPITAL_FEE} 金币急救费用。`
        );
        const richNarrations = await buildEmergencyHospitalNarrations(char, hospital, db, {
            actionCode: hospitalActionType,
            reason,
            locationLabel,
            requestedDistrict,
            beforeCalories,
            nextCalories: admission.calories,
            walletBefore,
            walletAfter,
            medicalStayMinutes
        });
        const log = String(richNarrations.log || '').trim();
        db.city.logAction(char.id, hospitalActionType, log, admission.calories - beforeCalories, -dependencies.EMERGENCY_HOSPITAL_FEE, hospital.id || 'hospital');
        dependencies.broadcastCityEvent(userId, char.id, hospitalActionType, log);
        dependencies.broadcastCityToChat(userId, char, log, hospitalActionType, richNarrations);
        const wsClients = dependencies.getWsClients(userId);
        const engine = dependencies.getEngine(userId);
        if (engine && typeof engine.broadcastWalletSync === 'function') {
            engine.broadcastWalletSync(wsClients, char.id);
        }
        console.log(`[City] ${char.name} 🚑 急救送医，费用 ${dependencies.EMERGENCY_HOSPITAL_FEE}，钱包 ${walletBefore} -> ${walletAfter}`);
        return { log, patch, richNarrations };
    }

    return { normalizeMetabolismPerMinute, getPhysicalCondition, buildEmergencyHospitalNarrations, getMedicalStayMinutes, buildMedicalAdmissionRecoveryPatch, getMedicalStatusTiming, isEmergencyHighDemandDistrict, getEmergencyHospitalReason, settleEmergencyHospitalTransfer };
}

module.exports = { createModule };
