// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function handleModelListProxy(req, res, source) {
    try {
        const { endpoint, key } = source || {};
        if (!endpoint || !key) return res.status(400).json({ error: 'Missing endpoint or key' });

        const modelsUrl = await dependencies.buildOpenAiCompatibleUrlResolved(endpoint, 'models', { label: 'Endpoint' });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);

        let response;
        try {
            response = await fetch(modelsUrl, {
                headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                redirect: 'manual',
                signal: controller.signal
            });
        } catch (fetchError) {
            if (fetchError?.name === 'AbortError') return res.status(504).json({ error: '请求超时' });
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }
        if (!response.ok) {
            const text = await response.text();
            return res.status(response.status).json({ error: `API ${response.status}: ${text.slice(0, 200)}` });
        }
        const data = await response.json();
        const models = (data.data || data.models || []).map(m => m.id || m.name || m).filter(Boolean).sort();
        res.json({ models });
    } catch (e) {
        res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message });
    }
}

    return { handleModelListProxy };
}

module.exports = { createModule };
