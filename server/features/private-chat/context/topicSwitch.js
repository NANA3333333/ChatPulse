function getDefaultTopicSwitchState() {
    return {
        decision: 'CONTINUE_CURRENT_TOPIC',
        reason: 'default_continue',
        malformed: false,
        fallback: false
    };
}

function unwrapStructuredPlannerText(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const fenceMatch = raw.match(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/i);
    return fenceMatch ? String(fenceMatch[1] || '').trim() : raw;
}

function parseTopicSwitchDecision(text) {
    const raw = unwrapStructuredPlannerText(text);
    if (!raw) {
        return { ...getDefaultTopicSwitchState(), malformed: true };
    }

    // The planner is asked for one reason label, but some reasoning models can
    // return multiple valid labels. The decision is still usable in that case.
    const match = raw.match(/^(CONTINUE_CURRENT_TOPIC|SWITCH_TOPIC|FOLLOW_UP_ON_RETRIEVED_HISTORY)(?:\s*:\s*([a-z0-9_ -]+(?:\s*[,，]\s*[a-z0-9_ -]+)*))?$/i);
    if (!match) {
        return { ...getDefaultTopicSwitchState(), malformed: true };
    }

    const reason = String(match[2] || '')
        .split(/\s*[,，]\s*/)
        .map(label => label.trim().replace(/\s+/g, '_').toLowerCase())
        .filter(Boolean)
        .join(',');

    return {
        decision: String(match[1] || '').trim().toUpperCase(),
        reason: reason || 'unspecified',
        malformed: false,
        fallback: false
    };
}

module.exports = { getDefaultTopicSwitchState, parseTopicSwitchDecision };
