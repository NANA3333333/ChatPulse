// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeDigestList(value, maxItems = 6) {
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).slice(0, maxItems);
        if (typeof value === 'string') return [value.trim()].filter(Boolean).slice(0, maxItems);
        return [];
    }

function stripInlineTags(text) {
        return String(text || '')
            .replace(/\[[A-Z_]+:[^\]]*?\]/g, '')
            .replace(/\[[A-Z_]+\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

function compactDigestText(text, maxLength = 90) {
        const cleaned = stripInlineTags(text).replace(/[“”"]/g, '').trim();
        if (!cleaned) return '';
        if (cleaned.length <= maxLength) return cleaned;
        return `${cleaned.slice(0, Math.max(12, maxLength - 1)).trim()}…`;
    }

function stripCompressedOpener(text = '') {
        return String(text || '')
            .replace(/^[\s.…·—\-~～]+/, '')
            .trim();
    }

function normalizeConversationDigestPayload(raw = {}) {
        const digestText = compactDigestText(raw.digest_text || raw.summary || '', dependencies.PRIVATE_DIGEST_LIMITS.digestText);
        const emotionState = compactDigestText(raw.emotion_state || '', dependencies.PRIVATE_DIGEST_LIMITS.emotionState);
        return {
            digest_text: digestText,
            emotion_state: emotionState,
            relationship_state_json: normalizeDigestList(raw.relationship_state_json ?? raw.relationship_state, dependencies.PRIVATE_DIGEST_LIMITS.relationshipItems).map(v => compactDigestText(v, dependencies.PRIVATE_DIGEST_LIMITS.relationshipItemLength)),
            open_loops_json: normalizeDigestList(raw.open_loops_json ?? raw.open_loops, dependencies.PRIVATE_DIGEST_LIMITS.openLoopItems).map(v => compactDigestText(v, dependencies.PRIVATE_DIGEST_LIMITS.openLoopItemLength)),
            recent_facts_json: normalizeDigestList(raw.recent_facts_json ?? raw.recent_facts, dependencies.PRIVATE_DIGEST_LIMITS.recentFactItems).map(v => compactDigestText(v, dependencies.PRIVATE_DIGEST_LIMITS.recentFactItemLength)),
            scene_state_json: normalizeDigestList(raw.scene_state_json ?? raw.scene_state, dependencies.PRIVATE_DIGEST_LIMITS.sceneStateItems).map(v => compactDigestText(v, dependencies.PRIVATE_DIGEST_LIMITS.sceneStateItemLength))
        };
    }

function formatConversationDigestForPrompt(digest, options = {}) {
        if (!digest || !digest.digest_text) return '';
        const recentMessages = Array.isArray(options.recentMessages) ? options.recentMessages : [];
        const recentSnippets = recentMessages
            .map(m => compactDigestText(m?.content || '', 56).toLowerCase())
            .filter(Boolean);
        const overlapsRecent = (text) => {
            const compacted = compactDigestText(text || '', 56).toLowerCase();
            if (!compacted) return false;
            return recentSnippets.some(snippet => snippet && (compacted.includes(snippet) || snippet.includes(compacted)));
        };
        const blocks = [];
        blocks.push('[Private Conversation Digest]');
        blocks.push('Use this only as compressed background from before the latest raw tail messages. It may be incomplete or slightly stale.');
        blocks.push('If this digest conflicts with the newest raw tail messages or the user\'s latest wording, trust the raw tail messages.');
        if (!overlapsRecent(digest.digest_text)) {
            blocks.push(`Background summary (before latest tail): ${stripCompressedOpener(digest.digest_text)}`);
        }
        if (digest.emotion_state) blocks.push(`Current hidden tone: ${digest.emotion_state}`);
        if (Array.isArray(digest.relationship_state_json) && digest.relationship_state_json.length > 0) {
            blocks.push(`Relationship state:\n- ${digest.relationship_state_json.join('\n- ')}`);
        }
        if (Array.isArray(digest.open_loops_json) && digest.open_loops_json.length > 0) {
            blocks.push(`Open loops:\n- ${digest.open_loops_json.join('\n- ')}`);
        }
        const dedupedFacts = Array.isArray(digest.recent_facts_json)
            ? digest.recent_facts_json.filter(item => !overlapsRecent(item))
            : [];
        if (dedupedFacts.length > 0) {
            blocks.push(`Older relevant facts:\n- ${dedupedFacts.map(item => stripCompressedOpener(item)).join('\n- ')}`);
        }
        if (Array.isArray(digest.scene_state_json) && digest.scene_state_json.length > 0) {
            blocks.push(`Scene state:\n- ${digest.scene_state_json.join('\n- ')}`);
        }
        return blocks.join('\n');
    }

function formatGroupConversationDigestForPrompt(digest, options = {}) {
        if (!digest || !digest.digest_text) return '';
        const recentMessages = Array.isArray(options.recentMessages) ? options.recentMessages : [];
        const recentSnippets = recentMessages
            .map(m => compactDigestText(m?.content || '', 44).toLowerCase())
            .filter(Boolean);
        const overlapsRecent = (text) => {
            const compacted = compactDigestText(text || '', 44).toLowerCase();
            if (!compacted) return false;
            return recentSnippets.some(snippet => snippet && (compacted.includes(snippet) || snippet.includes(compacted)));
        };

        const blocks = [];
        const digestSummary = overlapsRecent(digest.digest_text) ? '' : stripCompressedOpener(digest.digest_text);
        if (digestSummary) {
            blocks.push(`[Group Conversation Digest]\nSummary: ${digestSummary}`);
        } else {
            blocks.push('[Group Conversation Digest]');
        }
        if (digest.emotion_state) blocks.push(`Current group stance: ${digest.emotion_state}`);
        if (Array.isArray(digest.relationship_state_json) && digest.relationship_state_json.length > 0) {
            blocks.push(`Social state:\n- ${digest.relationship_state_json.join('\n- ')}`);
        }
        if (Array.isArray(digest.open_loops_json) && digest.open_loops_json.length > 0) {
            blocks.push(`Open loops:\n- ${digest.open_loops_json.join('\n- ')}`);
        }
        const dedupedFacts = Array.isArray(digest.recent_facts_json)
            ? digest.recent_facts_json.filter(item => !overlapsRecent(item))
            : [];
        if (dedupedFacts.length > 0) {
            blocks.push(`Recent group facts:\n- ${dedupedFacts.map(item => stripCompressedOpener(item)).join('\n- ')}`);
        }
        if (Array.isArray(digest.scene_state_json) && digest.scene_state_json.length > 0) {
            blocks.push(`Scene state:\n- ${digest.scene_state_json.join('\n- ')}`);
        }
        return blocks.join('\n');
    }

function normalizeCompactGroupDigestPayload(raw = {}) {
        const digestText = compactDigestText(raw.digest_text || raw.summary || '', 140);
        const emotionState = compactDigestText(raw.emotion_state || '', 28);
        return {
            digest_text: digestText,
            emotion_state: emotionState,
            relationship_state_json: normalizeDigestList(raw.relationship_state_json ?? raw.relationship_state, 3).map(v => compactDigestText(v, 36)),
            open_loops_json: normalizeDigestList(raw.open_loops_json ?? raw.open_loops, 3).map(v => compactDigestText(v, 42)),
            recent_facts_json: normalizeDigestList(raw.recent_facts_json ?? raw.recent_facts, 3).map(v => compactDigestText(v, 44)),
            scene_state_json: normalizeDigestList(raw.scene_state_json ?? raw.scene_state, 2).map(v => compactDigestText(v, 28))
        };
    }

function cleanMemoryJsonReply(responseText) {
        return String(responseText || '')
            .replace(/```(?:json)?\s*/gi, '')
            .replace(/```/g, '')
            .trim();
    }

function parseStrictMemoryJsonObject(responseText, label = 'Memory model') {
        const cleaned = cleanMemoryJsonReply(responseText);
        if (!cleaned) throw new Error(`${label} returned empty JSON.`);
        const parsed = JSON.parse(cleaned);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error(`${label} did not return a JSON object.`);
        }
        return parsed;
    }

function parseStrictMemoryJsonArray(responseText, label = 'Memory model') {
        const cleaned = cleanMemoryJsonReply(responseText);
        if (!cleaned) throw new Error(`${label} returned empty JSON.`);
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) {
            throw new Error(`${label} did not return a JSON array.`);
        }
        return parsed;
    }

function looksLikeMeaningRepairUserText(text = '') {
        const value = String(text || '').trim();
        if (!value) return false;
        return /(我的意思是|我是在|不是这个意思|你理解错了|你误会了|我没有想过|我一直是在和你调情|不是在为难你|你却一直误解|你为什么这么笨)/i.test(value);
    }

function looksLikeAssistantInterpretation(text = '') {
        const value = String(text || '').trim();
        if (!value) return false;
        return /(你是说|所以你是在说|那现在呢|如果不是调情|是你在逗我玩|我理解错了|我真的分不清|其实你只是在|误读成了调情|不是调情，是我自作多情)/i.test(value);
    }

    return { normalizeDigestList, stripInlineTags, compactDigestText, stripCompressedOpener, normalizeConversationDigestPayload, formatConversationDigestForPrompt, formatGroupConversationDigestForPrompt, normalizeCompactGroupDigestPayload, cleanMemoryJsonReply, parseStrictMemoryJsonObject, parseStrictMemoryJsonArray, looksLikeMeaningRepairUserText, looksLikeAssistantInterpretation };
}

module.exports = { createModule };
