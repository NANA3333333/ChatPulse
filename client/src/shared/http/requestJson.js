export async function requestJson(url, options = {}) {
    const runId = globalThis.crypto?.randomUUID?.() || `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
            'X-Run-Id': runId,
            ...(typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers
        }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.success === false) {
        throw Object.assign(new Error(data?.error || `HTTP ${response.status}: ${data ? 'Request failed' : 'Invalid server response'}`), {
            status: response.status, runId: data?.runId || response.headers.get('X-Run-Id') || runId
        });
    }
    return data;
}
