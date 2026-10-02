// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
    const suspendedSchedules = new Map();
function getRandomDelayMs(min, max) {
        const minMs = min * 60 * 1000;
        const maxMs = max * 60 * 1000;
        return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    }

function scheduleNext(character, wsClients, exactDelayMs = null) {
        if (suspendedSchedules.has(character.id)) return;
        const preservedRagProgress = dependencies.timers.get(character.id)?.ragProgress || null;
        stopTimer(character.id); // clear existing if any

        if (character.status !== 'active') return;

        let delay = exactDelayMs;

        if (delay === null || delay === undefined) {
            // If proactive messaging is toggled OFF, character will not auto-message.
            if (character.sys_proactive === 0) return;

            // Normal random delay calculation
            delay = getRandomDelayMs(character.interval_min, character.interval_max);

            // Apply pressure multiplier: Higher pressure = significantly shorter delay
            const pressure = character.sys_pressure === 0 ? 0 : (character.pressure_level || 0);
            if (pressure === 1) delay = delay * 0.7; // 30% faster
            else if (pressure === 2) delay = delay * 0.5; // 50% faster
            else if (pressure === 3) delay = delay * 0.3; // 70% faster
            else if (pressure >= 4) delay = delay * 0.2; // 80% faster (panic mode)
        } else {
            // It's a self-scheduled timer. If Timer system is OFF, fall back to random proactive message.
            if (character.sys_timer === 0) {
                console.log(`[DEBUG] sys_timer is OFF, ignoring self-schedule for ${character.name}`);
                return scheduleNext(character, wsClients, null);
            }
        }

        armTimer(character, wsClients, delay, exactDelayMs !== null && exactDelayMs !== undefined, preservedRagProgress);
    }

function armTimer(character, wsClients, delay, isSelfScheduled, ragProgress = null, targetTime = Date.now() + delay) {
        console.log(`[DEBUG] scheduleNext for ${character.name}. delay=${delay} ms (${Math.round(delay / 60000)} min)`);
        console.log(`[Engine] Next message for ${character.name} scheduled in ${Math.round(delay / 60000)} minutes. ${isSelfScheduled ? '(Self-Scheduled)' : ''}`);

        const timerId = setTimeout(() => {
            console.log(`[DEBUG] Timeout fired for ${character.name}! Queueing proactive trigger.`);
            dependencies.queueEngineTask(
                `char:${character.id}`,
                () => dependencies.triggerMessage(character, wsClients, false, isSelfScheduled),
                {
                    dedupeKey: `proactive:${character.id}`,
                    maxPending: 1
                }
            ).catch(err => {
                console.error(`[Engine] Failed to run proactive task for ${character.name}:`, err.message);
            });
        }, delay);

        dependencies.timers.set(character.id, {
            timerId,
            targetTime,
            isThinking: false,
            isSelfScheduled,
            ragProgress
        });
        dependencies.broadcastEngineState(wsClients);
    }

function stopTimer(characterId, wsClients = null) {
        if (dependencies.timers.has(characterId)) {
            clearTimeout(dependencies.timers.get(characterId).timerId);
            dependencies.timers.delete(characterId);
            if (wsClients) dependencies.broadcastEngineState(wsClients);
        }
    }

// The importing service owns this lease. On failure restore the old deadline;
// on commit use the imported character's settings, without restarting other roles.
function suspendCharacterSchedule(characterId, wsClients) {
        const previous = dependencies.timers.get(characterId);
        if (suspendedSchedules.has(characterId) || previous?.isThinking) {
            throw Object.assign(new Error('Character is busy. Retry the import when it is idle.'), { status: 409 });
        }
        const lease = {};
        suspendedSchedules.set(characterId, lease);
        stopTimer(characterId, wsClients);
        return ({ committed = false } = {}) => {
            if (suspendedSchedules.get(characterId) !== lease) return;
            suspendedSchedules.delete(characterId);
            const character = dependencies.db.getCharacter(characterId);
            if (dependencies.PRIVATE_AUTONOMY_DISABLED || !character || character.status !== 'active' || character.is_blocked) return;
            if (committed) {
                scheduleNext(character, wsClients);
            } else if (previous?.timerId) {
                armTimer(character, wsClients, Math.max(0, previous.targetTime - Date.now()),
                    Boolean(previous.isSelfScheduled), previous.ragProgress, previous.targetTime);
            }
        };
    }

function startEngine(wsClients) {
        if (dependencies.PRIVATE_AUTONOMY_DISABLED) {
            if (!dependencies.loggedPrivateAutonomyDisabled) {
                console.warn('[Engine] Private proactive timers are disabled by CP_PRIVATE_AUTONOMY=0.');
                dependencies.loggedPrivateAutonomyDisabled = true;
            }
            dependencies.broadcastEngineState(wsClients);
            return;
        }
        console.log('[Engine] Starting background timers...');
        const characters = dependencies.db.getCharacters();
        for (const char of characters) {
            if (char.status !== 'active') continue;

            if (char.sys_proactive === 0) {
                // Proactive messaging is OFF; don't trigger startup message, just keep timer silent.
                console.log(`[Engine] ${char.name}: sys_proactive=OFF, skipping startup message.`);
                continue;
            }

            // Schedule a normal proactive message instead of immediately triggering a reply.
            // This prevents echoing the character's own last message on every server restart.
            scheduleNext(char, wsClients);
        }
        dependencies.broadcastEngineState(wsClients);
        // Broadcast live engine state every second
        if (!dependencies.stateBroadcastInterval) {
            dependencies.stateBroadcastInterval = setInterval(() => {
                dependencies.broadcastEngineState(wsClients);
            }, 1000);
        }
    }

async function triggerProactiveMessage(charId, taskPrompt, wsClients) {
        const character = dependencies.db.getCharacter(charId);
        if (!character || character.is_blocked) return;

        console.log(`[Engine] Proactive task triggered for ${character.name}. promptChars=${String(taskPrompt || '').length}`);

        // Emulate a system message at the end of the context to force the AI's hand
        const sysDirective = `[System Directive: ${taskPrompt} (Respond immediately based on this instruction, but stay in persona)]`;

        // We'll use the existing triggerMessage flow, but we temporarily inject this directive into the chat history just for this prompt
        // To do this safely without corrupting the DB, we can just intercept the generation. 
        // For simplicity and to reuse all anti-repeat/affinity logic, we'll actually insert an invisible system message.

        const { id: internalId } = dependencies.db.addMessage(character.id, 'system', sysDirective);
        dependencies.db.hideMessagesByIds(character.id, [internalId]); // Instantly hide it from the user's UI

        await dependencies.triggerMessage(character, wsClients, false, false, sysDirective);
    }

function stopAllTimers() {
        suspendedSchedules.clear();
        if (dependencies.stateBroadcastInterval) {
            clearInterval(dependencies.stateBroadcastInterval);
            dependencies.stateBroadcastInterval = null;
        }
        for (const [charId, t] of dependencies.timers.entries()) {
            clearTimeout(t.timerId);
        }
        dependencies.timers.clear();
        for (const [groupId, t] of dependencies.groupProactiveTimers.entries()) {
            clearTimeout(t);
        }
        dependencies.groupProactiveTimers.clear();
    }

    return { getRandomDelayMs, scheduleNext, stopTimer, suspendCharacterSchedule, startEngine, triggerProactiveMessage, stopAllTimers };
}

module.exports = { createModule };
