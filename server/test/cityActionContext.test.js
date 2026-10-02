const test = require('node:test');
const assert = require('node:assert/strict');
const { createActionService } = require('../features/city/services/actionService');

test('city web activity receives the settled action text outside the action branch', async () => {
    const logs = [], webInputs = [];
    const noop = () => {};
    const service = createActionService({
        getDistrictStateEffects: () => ({}), buildCollapsedCityLog: () => '行动完成',
        isHackerDistrict: () => false, broadcastCityToChat: noop, broadcastCityEvent: noop,
        handleQuestLifecycleAfterAction: async () => ({}), applyStateEffectsToCharacter: () => ({}),
        logEmotionTransitionToState: noop, getWsClients: () => [], getEngine: () => null,
        maybeRunCityWebSearchActivity: async input => { webInputs.push(input); return null; }
    });
    const db = { city: { logAction: (...args) => { logs.push(args); return logs.length; } }, updateCharacter: noop };
    await service.applyDecision({ id: 'park', name: '公园', type: 'leisure' },
        { id: 'character', name: '角色', wallet: 10 }, db, 'test-user', 2000, {}, [], { log: '在公园散步' });
    assert.equal(webInputs.length, 1);
    assert.equal(webInputs[0].baseLog, logs[0][2]);
    assert.equal(webInputs[0].baseLog, '在公园散步');
});
