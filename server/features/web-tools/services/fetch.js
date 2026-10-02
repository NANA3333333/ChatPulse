// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function fetchWithTimeout(url, options = {}) {
    const timeoutMs = Math.max(1000, Math.min(20000, Number(options.timeoutMs || 10000)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...options,
            redirect: 'manual',
            signal: controller.signal,
            headers: {
                'user-agent': 'ChatPulse-MCP-Lab/0.1',
                accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.8',
                ...(options.headers || {})
            }
        });
    } finally {
        clearTimeout(timer);
    }
}

function stripHtml(html, maxLength = 12000) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<\/(p|div|section|article|li|h[1-6]|br)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
        .slice(0, maxLength);
}

async function runFetchUrl(rawUrl) {
    const url = dependencies.assertHttpUrl(rawUrl);
    const response = await fetchWithTimeout(url, { timeoutMs: 15000 });
    const contentType = String(response.headers.get('content-type') || '');
    const body = await response.text();
    if (!response.ok) throw new Error(`Fetch failed with HTTP ${response.status}`);
    return {
        url,
        status: response.status,
        content_type: contentType,
        text: contentType.includes('html') ? stripHtml(body) : dependencies.safeText(body, 12000),
        fetched_at: dependencies.nowIso()
    };
}

    return { fetchWithTimeout, stripHtml, runFetchUrl };
}

module.exports = { createModule };
