// Scheduled city work. Registration and timer ownership remain in index.js.
function createTick(dependencies) { return async () => {
        try {
            const users = dependencies.filterAutomationUsers(dependencies.authDb.getAllUsers(), Date.now());
            for (const user of users) {
                dependencies.queueCityTask(
                    user.id,
                    async () => {
                        const db = dependencies.context.getUserDb(user.id);
                        dependencies.ensureCityDb(db);

                        const config = db.city.getConfig();
                        const cityActivityEnabled = !(config.dlc_enabled === '0' || config.dlc_enabled === 'false');
                        const physiologyPaused = config.city_actions_paused === '1' || config.city_actions_paused === 'true';
                        if (cityActivityEnabled) {
                            const mayorAutoResult = await dependencies.maybeRunMayorAI(db, user.id);
                            if (mayorAutoResult?.success) {
                                console.log(`[Mayor AI] 自动决策已执行 (${user.username || user.id})`);
                            }
                        }
                        if (!cityActivityEnabled && physiologyPaused) return;

                        const districts = db.city.getEnabledDistricts();

                    // Adjust metabolism drain to be per-minute based (originally 20 per 15-min tick)
                    // If old tick means 20 cals/15min, then 1 min = 20/15 = 1.33 cals per real-time minute.
                        const minuteMetabolism = dependencies.normalizeMetabolismPerMinute(config);

                        const characters = db.getCharacters().filter(c =>
                            c.status === 'active' && c.sys_survival !== 0
                        );
                        if (characters.length === 0) return;

                        const cityDate = dependencies.getCityDate(config);
                        const currentMinute = cityDate.getMinutes();
                        const minuteKey = cityDate.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
                        const hourString = cityDate.toISOString().substring(0, 13); // "YYYY-MM-DDTHH"

                        if (typeof db.city?.clearExpiredActionGuards === 'function') {
                            db.city.clearExpiredActionGuards(Date.now() - 6 * 60 * 60 * 1000);
                        }
                        if (typeof db.city?.clearExpiredSocialGuards === 'function') {
                            db.city.clearExpiredSocialGuards(Date.now());
                        }

                        let actedCount = 0;
                        let actingChars = [];

                        for (const char of characters) {
                        const cityNowMs = cityDate.getTime();
                        if (char.city_status === 'medical') {
                            const { untilAt } = dependencies.getMedicalStatusTiming(char, cityNowMs);
                            if (cityNowMs >= untilAt) {
                                const dischargePatch = {
                                    city_status: (char.calories ?? 0) < 500 ? 'hungry' : 'idle',
                                    city_status_started_at: 0,
                                    city_status_until_at: 0,
                                    city_medical_last_recovery_at: 0
                                };
                                db.updateCharacter(char.id, dischargePatch);
                                Object.assign(char, dischargePatch);
                            }
                        }

                        const passiveInterval = dependencies.getPassiveTickIntervalMinutes(char.city_action_frequency || 1);
                        const shouldApplyPassiveTick = currentMinute % passiveInterval === 0;

                        if (!physiologyPaused && shouldApplyPassiveTick) {
                            let currentCityStatus = char.city_status ?? 'idle';
                            const passiveState = dependencies.applyPassiveSurvivalTick(
                                { ...char, city_status: currentCityStatus },
                                char.calories ?? 2000,
                                currentMinute,
                                passiveInterval,
                                minuteMetabolism,
                                db
                            );
                            let currentCals = passiveState.calories;
                            if (currentCals < 500 && currentCityStatus === 'idle') currentCityStatus = 'hungry';
                            if (currentCals === 0 && currentCityStatus !== 'coma') currentCityStatus = 'coma';

                            if (
                                char.calories !== currentCals ||
                                char.city_status !== currentCityStatus ||
                                char.energy !== passiveState.energy ||
                                char.sleep_debt !== passiveState.sleep_debt ||
                                char.mood !== passiveState.mood ||
                                char.stress !== passiveState.stress ||
                                char.social_need !== passiveState.social_need ||
                                char.health !== passiveState.health ||
                                char.satiety !== passiveState.satiety ||
                                char.stomach_load !== passiveState.stomach_load
                            ) {
                                const passivePatch = {
                                    calories: currentCals,
                                    city_status: currentCityStatus,
                                    energy: passiveState.energy,
                                    sleep_debt: passiveState.sleep_debt,
                                    mood: passiveState.mood,
                                    stress: passiveState.stress,
                                    social_need: passiveState.social_need,
                                    health: passiveState.health,
                                    satiety: passiveState.satiety,
                                    stomach_load: passiveState.stomach_load
                                };
                                db.updateCharacter(char.id, passivePatch);
                                dependencies.logEmotionTransitionToState(
                                    db,
                                    char,
                                    { ...char, ...passivePatch },
                                    'city_passive_tick',
                                    `商业街中的时间流逝按该角色的活动频率节奏结算了一次生理变化（约每 ${passiveInterval} 分钟一次）。`
                                );
                                dependencies.broadcastCityEvent(user.id, char.id, 'state_tick', null);
                                Object.assign(char, passivePatch);
                            }
                        }

                        if (dependencies.CITY_BACKGROUND_SAFE_MODE && dependencies.CITY_LIGHT_TICK_MODE && !dependencies.CITY_ENABLE_AUTONOMOUS_ACTIONS) {
                            continue;
                        }

                        if (!cityActivityEnabled) {
                            continue;
                        }

                        // Generate schedule at 6:00 sharp; maybeGenerateSchedule is idempotent and only generates once per day
                        if (dependencies.CITY_ENABLE_SCHEDULE_GENERATION && cityDate.getHours() >= 6 && char.api_endpoint && char.api_key && char.model_name) {
                            await dependencies.maybeGenerateSchedule(char, db, districts, config);
                        }

                        // Determine if it is this character's turn to act
                        const freq = char.city_action_frequency || 1;
                        const activeMinutes = dependencies.getActionMinutesForHour(char.id, hourString, freq);

                        if (activeMinutes.includes(currentMinute)) {
                            if (typeof db.city?.claimActionSlot === 'function') {
                                const claimed = db.city.claimActionSlot(char.id, minuteKey);
                                if (!claimed) {
                                    console.log(`[City] ${char.name} skipped duplicate action for minute ${minuteKey}`);
                                    continue;
                                }
                            }
                            actedCount++;
                            actingChars.push(char);
                            await dependencies.simulateCharacter(char, db, user.id, districts, config, 0); // passing 0 for metabolism since it's passively drained above
                        }
                        }

                        if (actedCount > 0) {
                            console.log(`[City] 🔔 ${user.username}: ${actedCount}/${characters.length} 个角色在 ${hourString}:${String(currentMinute).padStart(2, '0')} 行动`);
                            // Phase 5: after characters move, check for location collisions
                            const socialCandidates = db.getCharacters().filter(c =>
                                c.status === 'active' && c.sys_city_social !== 0
                            );
                            if (dependencies.CITY_ENABLE_SOCIAL_COLLISIONS) {
                                await dependencies.checkSocialCollisions(socialCandidates, db, user.id, districts, config, minuteKey);
                            }
                        } else if (!cityActivityEnabled && !physiologyPaused) {
                            console.log(`[City] ⏸️ ${user.username}: 商业街活动已暂停，仅保留生理流逝 (${hourString}:${String(currentMinute).padStart(2, '0')})`);
                        } else if (cityActivityEnabled && physiologyPaused) {
                            console.log(`[City] 🫀 ${user.username}: 生理流逝已暂停，商业街活动继续运行 (${hourString}:${String(currentMinute).padStart(2, '0')})`);
                        } else if (!cityActivityEnabled && physiologyPaused) {
                            console.log(`[City] ⏹️ ${user.username}: 商业街活动与生理流逝均已暂停 (${hourString}:${String(currentMinute).padStart(2, '0')})`);
                        }
                    },
                    {
                        dedupeKey: `minute:${new Date().toISOString().slice(0, 16)}`,
                        maxPending: 1
                    }
                ).catch((e) => {
                    console.error(`[City] 用户 ${user.username} 出错:`, e.message);
                });
            }
        } catch (e) {
            console.error('[City] 致命错误:', e.message);
        }
        }; }
module.exports = { createTick };
