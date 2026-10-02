const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTopicSwitchDecision } = require("../features/private-chat/context/topicSwitch.js");

test('parses a topic switch with one reason label', () => {
    assert.deepEqual(parseTopicSwitchDecision('SWITCH_TOPIC: new_event_claim'), {
        decision: 'SWITCH_TOPIC',
        reason: 'new_event_claim',
        malformed: false,
        fallback: false
    });
});

test('accepts multiple comma-separated reason labels', () => {
    assert.deepEqual(parseTopicSwitchDecision('SWITCH_TOPIC: new_time_anchor, new_event_claim'), {
        decision: 'SWITCH_TOPIC',
        reason: 'new_time_anchor,new_event_claim',
        malformed: false,
        fallback: false
    });
});

test('still rejects explanatory text outside the structured result', () => {
    assert.equal(
        parseTopicSwitchDecision('SWITCH_TOPIC: new_event_claim\nThe user changed the subject.').malformed,
        true
    );
});
