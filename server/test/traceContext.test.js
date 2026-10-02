const test = require('node:test');
const assert = require('node:assert/strict');
const { currentTrace, withTrace } = require('../platform/logging/context');
const { enqueueBackgroundTask, getBackgroundQueueStats } = require('../platform/jobs/backgroundQueue');

test('queued work preserves its originating request when another task pumps the queue', async () => {
    const observed = [];
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const first = withTrace({ runId: 'trace-request-one', feature: 'memory', action: 'import' }, () =>
        enqueueBackgroundTask({ key: 'trace-test-user', task: async () => {
            await held;
            observed.push(currentTrace().runId);
        } }));
    const second = withTrace({ runId: 'trace-request-two', feature: 'city', action: 'simulate' }, () =>
        enqueueBackgroundTask({ key: 'trace-test-user', task: async () => observed.push(currentTrace().runId) }));
    release();
    await Promise.all([first, second]);
    assert.deepEqual(observed, ['trace-request-one', 'trace-request-two']);
    assert.equal(currentTrace(), undefined);
    const stats = getBackgroundQueueStats();
    assert.ok(JSON.stringify(stats).includes('trace-request-two'));
});
