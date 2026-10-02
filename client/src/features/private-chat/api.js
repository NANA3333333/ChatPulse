function createRunId() {
    return globalThis.crypto?.randomUUID?.() || `reply-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request({ apiUrl, path, action, method = 'GET', body, fallbackError }) {
    const runId = createRunId();
    try {
        const response = await fetch(`${apiUrl}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', 'X-Run-Id': runId,
                'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        const data = await response.json();
        const responseRunId = data.runId || response.headers.get('X-Run-Id') || runId;
        if (!response.ok) throw Object.assign(new Error(data.error || fallbackError || `HTTP ${response.status}`), {
            runId: responseRunId, code: data.errorCode || 'MESSAGE_REQUEST_FAILED'
        });
        return Array.isArray(data) ? data : { ...data, runId: responseRunId };
    } catch (error) {
        error.runId ||= runId;
        error.code ||= 'MESSAGE_REQUEST_FAILED';
        console.warn('[private-chat]', { runId: error.runId, action, stage: 'http', errorCode: error.code });
        throw error;
    }
}

export function requestReplyVersion({ apiUrl, characterId, message, version, fallbackError }) {
    const action = version === null ? 'reroll' : 'version';
    return request({ apiUrl, action, method: 'POST', fallbackError,
        path: `/messages/${encodeURIComponent(characterId)}/replies/${message.id}/${action}`,
        body: { revision: message.metadata.replyVersion.revision, ...(version === null ? {} : { version }) } });
}

export function fetchMessageHistory({ apiUrl, characterId, limit = 100, before, after, around }) {
    const query = new URLSearchParams({ limit });
    for (const [key, value] of Object.entries({ before, after, around })) {
        if (value !== undefined) query.set(key, value);
    }
    return request({ apiUrl, action: 'history', path: `/messages/${encodeURIComponent(characterId)}?${query}` });
}

export function sendMessage({ apiUrl, characterId, content }) {
    return request({ apiUrl, action: 'send', path: '/messages', method: 'POST', body: { characterId, content } });
}

export function retryMessage({ apiUrl, characterId, failedMessageId }) {
    return request({ apiUrl, action: 'retry', path: `/messages/${encodeURIComponent(characterId)}/retry`,
        method: 'POST', body: { failedMessageId } });
}

export function deleteMessages({ apiUrl, characterId, messageIds }) {
    return request({ apiUrl, action: 'delete', path: '/messages/batch-delete', method: 'POST', body: { characterId, messageIds } });
}
