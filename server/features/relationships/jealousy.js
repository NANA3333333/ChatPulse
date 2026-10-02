// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function triggerJealousyCheck(activeCharacterId, wsClients) {
        const characters = dependencies.db.getCharacters();
        const activeCharacter = dependencies.db.getCharacter(activeCharacterId);
        const rivalName = activeCharacter?.name || activeCharacterId || 'someone else';

        for (const char of characters) {
            if (char.id !== activeCharacterId && char.status === 'active' && char.sys_jealousy !== 0) {
                const jealousyChance = 0.05;
                if (Math.random() < jealousyChance) {
                    // Accumulate jealousy_level (0-100)
                    const newLevel = Math.min(100, (char.jealousy_level || 0) + 20);
                    dependencies.db.updateCharacter(char.id, { jealousy_level: newLevel, jealousy_target: activeCharacterId });
                    console.log(`[Engine] Jealousy for ${char.name} -> level ${newLevel} (rival: ${rivalName})`);

                    dependencies.stopTimer(char.id);
                    const delayMs = dependencies.getRandomDelayMs(0.5, 2);
                    dependencies.timers.set(char.id, { timerId: null, targetTime: Date.now() + delayMs, isThinking: false });
                    setTimeout(() => {
                        // Re-fetch to get updated jealousy_level
                        const freshChar = dependencies.db.getCharacter(char.id);
                        if (freshChar) {
                            dependencies.queueEngineTask(
                                `char:${freshChar.id}`,
                                () => triggerJealousyMessage(freshChar, wsClients, activeCharacterId),
                                {
                                    dedupeKey: `jealousy:${freshChar.id}`,
                                    maxPending: 1
                                }
                            ).catch(err => {
                                console.error(`[Engine] Failed to run jealousy task for ${freshChar.name}:`, err.message);
                            });
                        }
                    }, delayMs);
                }
            }
        }
    }

async function triggerJealousyMessage(character, wsClients, rivalId = null) {
        const rivalLabel = rivalId ? (dependencies.db.getCharacter(rivalId)?.name || rivalId) : 'someone else';
        console.log(`[Engine] Jealousy message for ${character.name} (rival: ${rivalLabel}, level: ${character.jealousy_level})`);
        // triggerMessage with isUserReply=false so it also escalates pressure
        await dependencies.triggerMessage(character, wsClients, false);
    }

    return { triggerJealousyCheck, triggerJealousyMessage };
}

module.exports = { createModule };
