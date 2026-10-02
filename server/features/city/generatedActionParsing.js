// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unescapeLooseGeneratedJsonString(value) {
    return String(value || '')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .trim();
}

function normalizeLooseGeneratedCityActionValue(value) {
    const text = unescapeLooseGeneratedJsonString(value);
    return /^[,，"'\s}]+$/.test(text) ? '' : text;
}

function parseLooseGeneratedCityActionPayload(rawCityAction) {
    const text = String(rawCityAction || '').trim();
    if (!text.startsWith('{')) return null;

    const escapedKeys = dependencies.GENERATED_CITY_ACTION_PAYLOAD_KEYS
        .map(key => escapeRegExp(key))
        .join('|');
    const markerPattern = new RegExp(`(?:^|[,{;；]\\s*)"(${escapedKeys})"\\s*:\\s*`, 'g');
    const markers = [];
    let match;
    while ((match = markerPattern.exec(text)) !== null) {
        markers.push({
            key: match[1],
            start: match.index,
            valueStart: markerPattern.lastIndex
        });
    }
    if (markers.length < 2) return null;

    const lastBrace = text.lastIndexOf('}');
    const parsed = {};
    for (let index = 0; index < markers.length; index += 1) {
        const marker = markers[index];
        const next = markers[index + 1];
        const valueEnd = next ? next.start : (lastBrace > marker.valueStart ? lastBrace : text.length);
        let rawValue = text.slice(marker.valueStart, valueEnd).trim().replace(/,\s*$/, '').trim();
        if (rawValue.startsWith('"')) rawValue = rawValue.slice(1).trimStart();
        if (rawValue.endsWith('"')) rawValue = rawValue.slice(0, -1).trimEnd();
        parsed[marker.key] = normalizeLooseGeneratedCityActionValue(rawValue);
    }

    const hasDistrictSignal = dependencies.GENERATED_CITY_ACTION_DISTRICT_KEYS
        .some(key => String(parsed[key] || '').trim());
    return hasDistrictSignal ? parsed : null;
}

function parseGeneratedCityActionPayload(rawCityAction) {
    const rawText = String(rawCityAction || '').trim();
    let parsedCityAction;
    try {
        parsedCityAction = JSON.parse(rawText);
    } catch (jsonError) {
        const looseCityAction = parseLooseGeneratedCityActionPayload(rawText);
        if (looseCityAction) return looseCityAction;
        throw jsonError;
    }
    if (!parsedCityAction || typeof parsedCityAction !== 'object' || Array.isArray(parsedCityAction)) {
        throw new Error('CITY_ACTION payload must be a JSON object');
    }
    return parsedCityAction;
}

    return { escapeRegExp, unescapeLooseGeneratedJsonString, normalizeLooseGeneratedCityActionValue, parseLooseGeneratedCityActionPayload, parseGeneratedCityActionPayload };
}

module.exports = { createModule };
