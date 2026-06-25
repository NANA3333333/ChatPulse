const CITY_ACTION_NARRATION_FIELDS = ['action', 'log', 'chat', 'moment', 'diary'];
const CITY_ACTION_STRUCTURED_FIELDS = ['quest_intent'];
const CITY_ACTION_LOOSE_MARKER_KEYS = [...CITY_ACTION_NARRATION_FIELDS, ...CITY_ACTION_STRUCTURED_FIELDS];

function stripLlmJsonEnvelope(text) {
    const cleaned = String(text || '')
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim();
    if (!cleaned) return '';

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return cleaned.slice(firstBrace, lastBrace + 1).trim();
    }
    return cleaned;
}

function unescapeLooseJsonString(value) {
    return String(value || '')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .trim();
}

function sanitizeCityNarrationText(value) {
    let text = String(value || '').trim();
    if (!text) return '';

    const cleaned = text.replace(/["'\s,，;；]*"quest_intent"\s*:\s*\{[^{}]*\}["'\s,，;；]*/gi, '').trim();
    if (cleaned !== text) {
        text = cleaned
            .replace(/["']\s*[,，;；]?\s*$/g, '')
            .trim();
    }
    return text;
}

function trimLooseJsonValue(value) {
    return String(value || '')
        .replace(/,\s*$/, '')
        .trim();
}

function parseLooseJsonObject(value) {
    const text = trimLooseJsonValue(value);
    if (!text || !text.startsWith('{')) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function normalizeCityActionNarrations(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
    const normalized = { ...parsed };
    for (const key of CITY_ACTION_NARRATION_FIELDS) {
        normalized[key] = sanitizeCityNarrationText(normalized[key]);
    }
    return normalized;
}

function parseLooseCityActionNarrations(cleaned) {
    const markers = [];
    const markerPattern = new RegExp(`(?:^|[,{;；]\\s*)"(${CITY_ACTION_LOOSE_MARKER_KEYS.join('|')})"\\s*:\\s*("|\\{|null\\b)`, 'g');
    let match;
    while ((match = markerPattern.exec(cleaned))) {
        markers.push({
            key: match[1],
            opener: match[2],
            start: match.index,
            valueStart: markerPattern.lastIndex
        });
    }

    if (markers.length < 2) return null;

    const lastBrace = cleaned.lastIndexOf('}');
    const parsed = {};
    for (let index = 0; index < markers.length; index += 1) {
        const marker = markers[index];
        const next = markers[index + 1];
        const valueEnd = next ? next.start : (lastBrace > marker.valueStart ? lastBrace : cleaned.length);

        if (marker.opener === 'null') {
            parsed[marker.key] = '';
            continue;
        }

        if (marker.key === 'quest_intent') {
            if (marker.opener !== '{') continue;
            const rawObject = cleaned.slice(marker.valueStart - 1, valueEnd);
            const intent = parseLooseJsonObject(rawObject);
            if (intent) parsed.quest_intent = intent;
            continue;
        }

        if (marker.opener !== '"') continue;
        let rawValue = cleaned.slice(marker.valueStart, valueEnd).trim();
        rawValue = trimLooseJsonValue(rawValue).trimEnd();
        if (rawValue.endsWith('"')) {
            rawValue = rawValue.slice(0, -1).trimEnd();
        }
        parsed[marker.key] = sanitizeCityNarrationText(unescapeLooseJsonString(rawValue));
    }

    if (!parsed.action || !parsed.log) return null;
    const result = CITY_ACTION_NARRATION_FIELDS.reduce((acc, key) => {
        acc[key] = parsed[key] || '';
        return acc;
    }, {});
    if (parsed.quest_intent) result.quest_intent = parsed.quest_intent;
    return result;
}

function parseCityActionNarrations(text) {
    const cleaned = stripLlmJsonEnvelope(text);
    if (!cleaned) {
        throw new Error('商业街行动生成失败：模型没有返回 JSON 对象，请重试。');
    }

    try {
        return normalizeCityActionNarrations(JSON.parse(cleaned));
    } catch (error) {
        const loose = parseLooseCityActionNarrations(cleaned);
        if (loose) return normalizeCityActionNarrations(loose);
        throw error;
    }
}

module.exports = {
    parseCityActionNarrations,
    parseLooseCityActionNarrations,
    sanitizeCityNarrationText,
    stripLlmJsonEnvelope
};
