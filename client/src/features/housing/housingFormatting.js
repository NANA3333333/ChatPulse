import { text } from './housingLabels.js';
import { AlertTriangle, CheckCircle2, CircleDashed, Home } from 'lucide-react';

export function formatMoney(value) {
    const num = Number(value || 0);
    return Number.isFinite(num)
        ? num
              .toFixed(2)
              .replace(/\.00$/, '')
              .replace(/(\.\d)0$/, '$1')
        : '0';
}

export function formatTime(value) {
    if (!value) return text.untriggered;
    try {
        const locale =
            typeof localStorage !== 'undefined' && localStorage.getItem('chatpulse_lang') === 'en' ? 'en-US' : 'zh-CN';
        return new Date(Number(value)).toLocaleString(locale);
    } catch {
        return text.untriggered;
    }
}

export function toNum(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

export function parseChainPayload(event = {}) {
    if (event.payload && typeof event.payload === 'object') return event.payload;
    try {
        const parsed = JSON.parse(String(event.payload_json || '{}'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function getChainEventsForDisplay(eventMap = {}, chainId) {
    const events = eventMap?.[String(chainId)];
    return Array.isArray(events) ? events : [];
}

export function buildViewingDialogue(events = []) {
    const viewEvent = events.find((event) => event.event_type === 'view_round');
    if (!viewEvent) return null;
    const payload = parseChainPayload(viewEvent);
    const dynamicLines = Array.isArray(payload.dialogue)
        ? payload.dialogue
              .map((line) => ({
                  speaker: line?.speaker === 'agent' ? text.agent : text.character,
                  content: String(line?.content || line?.text || '').trim(),
              }))
              .filter((line) => line.content)
        : [];
    const lines =
        dynamicLines.length > 0
            ? dynamicLines
            : [
                  payload.agent_intro ? { speaker: text.agent, content: payload.agent_intro } : null,
                  payload.char_reply_1 ? { speaker: text.character, content: payload.char_reply_1 } : null,
                  payload.agent_followup ? { speaker: text.agent, content: payload.agent_followup } : null,
                  payload.char_reply_2 ? { speaker: text.character, content: payload.char_reply_2 } : null,
              ].filter(Boolean);
    return {
        lines,
        summary: String(payload.view_summary || '').trim(),
        interest: Number(payload.interest_score_2 || payload.interest_score_1 || 0),
    };
}

export function getChainNote(events = [], type) {
    const event = events.find((item) => item.event_type === type);
    if (!event) return '';
    const payload = parseChainPayload(event);
    return String(payload.log || payload.consideration_log || payload.decision_log || payload.reason || '').trim();
}

export function summarizeAgencyError(value) {
    const raw = String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!raw) return '';
    return raw.length > 320 ? `${raw.slice(0, 320)}...` : raw;
}

export const chainStageLabels = {
    recommended: { zh: '推荐', en: 'Recommended' },
    viewing: { zh: '看房', en: 'Viewing' },
    viewed: { zh: '看完', en: 'Viewed' },
    considering: { zh: '考虑', en: 'Considering' },
    considered: { zh: '已考虑', en: 'Considered' },
    deciding: { zh: '决定', en: 'Deciding' },
    ready_to_sign: { zh: '待签约', en: 'Ready to Sign' },
    signing: { zh: '签约', en: 'Signing' },
    signed: { zh: '已签', en: 'Signed' },
    completed: { zh: '完成', en: 'Completed' },
};

export const chainStageOrder = [
    'recommended',
    'viewing',
    'considering',
    'deciding',
    'ready_to_sign',
    'signing',
    'completed',
];

export function getChainStageLabel(stage) {
    const label = chainStageLabels[stage];
    if (!label) return stage || '';
    return typeof localStorage !== 'undefined' && localStorage.getItem('chatpulse_lang') === 'en' ? label.en : label.zh;
}

export function getChainTone(status) {
    if (status === 'failed') return { bg: '#fff1f2', color: '#be123c', icon: AlertTriangle };
    if (status === 'completed') return { bg: '#dcfce7', color: '#166534', icon: CheckCircle2 };
    return { bg: '#fff0f6', color: '#ff4f82', icon: CircleDashed };
}

export function getHousingStatusTone(status, hasHousing) {
    if (status === 'overdue') return { bg: '#fff1f2', color: '#be123c', icon: AlertTriangle, label: text.overdue };
    if (hasHousing) return { bg: '#effaf4', color: '#2f9c76', icon: Home, label: text.stable };
    return { bg: '#fff8fb', color: '#806273', icon: CircleDashed, label: text.homeless };
}
