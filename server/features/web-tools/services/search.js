// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function flattenDuckDuckGoTopics(items, output = []) {
    for (const item of Array.isArray(items) ? items : []) {
        if (item?.Topics) {
            flattenDuckDuckGoTopics(item.Topics, output);
            continue;
        }
        if (item?.Text || item?.FirstURL) {
            output.push({
                title: dependencies.safeText(item.Text || item.FirstURL, 140),
                snippet: dependencies.safeSnippet(item.Text || ''),
                url: String(item.FirstURL || '').trim(),
                raw: item
            });
        }
    }
    return output;
}

async function runWebSearch(query, options = {}) {
    const q = dependencies.safeText(query, 300);
    if (!q) throw new Error('Query is required.');
    const provider = String(options.provider || '').trim();
    const apiKey = String(options.apiKey || options.serperKey || '').trim();
    let result = null;
    if (provider === 'serper' && apiKey) {
        result = await runSerperSearch(q, apiKey);
    } else if (provider === 'tavily' && apiKey) {
        result = await runTavilySearch(q, apiKey);
    } else if (provider === 'brave' && apiKey) {
        result = await runBraveSearch(q, apiKey);
    } else if (provider === 'bing' && apiKey) {
        result = await runBingSearch(q, apiKey);
    } else {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
        const response = await dependencies.fetchWithTimeout(url, { timeoutMs: 12000 });
        if (!response.ok) throw new Error(`Search failed with HTTP ${response.status}`);
        const data = await response.json();
        const results = [];
        if (data.AbstractText || data.AbstractURL) {
            results.push({
                title: dependencies.safeText(data.Heading || q, 140),
                snippet: dependencies.safeSnippet(data.AbstractText || ''),
                url: String(data.AbstractURL || '').trim(),
                raw: {
                    Heading: data.Heading,
                    AbstractText: data.AbstractText,
                    AbstractURL: data.AbstractURL,
                    AbstractSource: data.AbstractSource,
                    Abstract: data.Abstract
                }
            });
        }
        flattenDuckDuckGoTopics(data.RelatedTopics, results);
        result = {
            query: q,
            source: 'duckduckgo_instant_answer',
            results: results.filter(item => item.snippet || item.url).slice(0, 3),
            fetched_at: dependencies.nowIso(),
            raw_response: data
        };
    }
    if (options.fetchPages) {
        return enrichSearchResultPages(result, {
            limit: options.fetchPageLimit,
            textLength: options.fetchPageTextLength
        });
    }
    return result;
}

function normalizeSearchResults(query, source, results, extra = {}) {
    return {
        query,
        source,
        results: (Array.isArray(results) ? results : [])
            .map(item => ({
                title: dependencies.safeText(item.title || item.name || item.url || 'Result', 180),
                snippet: dependencies.safeSnippet(item.snippet || item.description || item.content || ''),
                url: String(item.url || item.link || '').trim(),
                raw: item.raw || item
            }))
            .filter(item => item.snippet || item.url)
            .slice(0, 3),
        fetched_at: dependencies.nowIso(),
        ...extra
    };
}

async function runSerperSearch(query, apiKey) {
    const q = dependencies.safeText(query, 300);
    const key = String(apiKey || '').trim();
    if (!q) throw new Error('Query is required.');
    if (!key) throw new Error('Serper API key is required.');
    const response = await dependencies.fetchWithTimeout('https://google.serper.dev/search', {
        method: 'POST',
        timeoutMs: 12000,
        headers: {
            'X-API-KEY': key,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            q,
            num: 3,
            hl: 'zh-cn',
            gl: 'cn'
        })
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        data = null;
    }
    if (!response.ok) {
        const message = data?.message || data?.error || text || `Serper search failed with HTTP ${response.status}`;
        throw new Error(message);
    }
    const results = [];
    const answerBox = data?.answerBox;
    if (answerBox) {
        results.push({
            title: dependencies.safeText(answerBox.title || answerBox.answer || 'Answer Box', 140),
            snippet: dependencies.safeSnippet(answerBox.answer || answerBox.snippet || answerBox.snippetHighlighted?.join(' ') || ''),
            url: String(answerBox.link || '').trim(),
            raw: answerBox
        });
    }
    const knowledgeGraph = data?.knowledgeGraph;
    if (knowledgeGraph?.title || knowledgeGraph?.description) {
        results.push({
            title: dependencies.safeText(knowledgeGraph.title || q, 140),
            snippet: dependencies.safeSnippet(knowledgeGraph.description || knowledgeGraph.descriptionSource || ''),
            url: String(knowledgeGraph.website || '').trim(),
            raw: knowledgeGraph
        });
    }
    for (const item of Array.isArray(data?.organic) ? data.organic : []) {
        results.push({
            title: dependencies.safeText(item.title || item.link || 'Result', 160),
            snippet: dependencies.safeSnippet(item.snippet || ''),
            url: String(item.link || '').trim(),
            raw: item
        });
    }
    for (const item of Array.isArray(data?.news) ? data.news : []) {
        results.push({
            title: dependencies.safeText(item.title || item.link || 'News', 160),
            snippet: dependencies.safeSnippet(item.snippet || item.date || ''),
            url: String(item.link || '').trim(),
            raw: item
        });
    }
    return normalizeSearchResults(q, 'serper_google_search', results, { raw_response: data });
}

async function runTavilySearch(query, apiKey) {
    const q = dependencies.safeText(query, 300);
    const response = await dependencies.fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        timeoutMs: 15000,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            api_key: apiKey,
            query: q,
            search_depth: 'basic',
            max_results: 3,
            include_answer: true
        })
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data?.detail || data?.error || text || `Tavily search failed with HTTP ${response.status}`);
    const results = [];
    if (data.answer) results.push({ title: 'Tavily Answer', snippet: data.answer, url: '', raw: { answer: data.answer } });
    for (const item of Array.isArray(data.results) ? data.results : []) {
        results.push({ title: item.title, snippet: item.content || item.snippet, url: item.url, raw: item });
    }
    return normalizeSearchResults(q, 'tavily_search', results, { raw_response: data });
}

async function runBraveSearch(query, apiKey) {
    const q = dependencies.safeText(query, 300);
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=3&country=CN&search_lang=zh-hans`;
    const response = await dependencies.fetchWithTimeout(url, {
        timeoutMs: 12000,
        headers: {
            'X-Subscription-Token': apiKey,
            accept: 'application/json'
        }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data?.message || data?.error || text || `Brave search failed with HTTP ${response.status}`);
    const results = (data?.web?.results || []).map(item => ({
        title: item.title,
        snippet: item.description || item.extra_snippets?.join(' '),
        url: item.url,
        raw: item
    }));
    return normalizeSearchResults(q, 'brave_search', results, { raw_response: data });
}

async function runBingSearch(query, apiKey) {
    const q = dependencies.safeText(query, 300);
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(q)}&count=3&mkt=zh-CN`;
    const response = await dependencies.fetchWithTimeout(url, {
        timeoutMs: 12000,
        headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            accept: 'application/json'
        }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data?.message || data?.error?.message || text || `Bing search failed with HTTP ${response.status}`);
    const results = (data?.webPages?.value || []).map(item => ({
        title: item.name,
        snippet: item.snippet,
        url: item.url,
        raw: item
    }));
    return normalizeSearchResults(q, 'bing_web_search', results, { raw_response: data });
}

function getWebSearchConfig(db) {
    const profile = db?.getUserProfile?.() || {};
    const storedKeys = dependencies.safeParseJson(profile.web_search_keys_json, {});
    if (!storedKeys.serper && profile.serper_api_key) storedKeys.serper = profile.serper_api_key;
    const provider = String(profile.web_search_provider || 'auto').trim() || 'auto';
    const providers = dependencies.WEB_SEARCH_PROVIDERS.map(item => {
        const profileKey = String(storedKeys[item.id] || '').trim();
        return {
            ...item,
            has_key: !!profileKey,
            masked: dependencies.maskSecret(profileKey),
            source: profileKey ? 'user_profile' : 'none'
        };
    });
    return { provider, providers, keys: storedKeys };
}

function resolveSearchProvider(db, preferredProvider = '') {
    const config = getWebSearchConfig(db);
    const requested = String(preferredProvider || config.provider || 'auto').trim();
    if (requested === 'duckduckgo' || requested === 'duckduckgo_instant_answer') {
        return { id: 'duckduckgo', label: 'DuckDuckGo Instant Answer', key: '', config };
    }
    const orderedIds = requested && requested !== 'auto'
        ? [requested, ...dependencies.WEB_SEARCH_PROVIDERS.map(item => item.id).filter(id => id !== requested)]
        : dependencies.WEB_SEARCH_PROVIDERS.map(item => item.id);
    for (const id of orderedIds) {
        const provider = config.providers.find(item => item.id === id);
        const key = String(config.keys[id] || '').trim();
        if (provider && key) return { id, label: provider.label, key, config };
    }
    return { id: 'duckduckgo', label: 'DuckDuckGo Instant Answer', key: '', config };
}

function getSerperApiKey(db) {
    const resolved = resolveSearchProvider(db, 'serper');
    return resolved.id === 'serper' ? resolved.key : '';
}

async function enrichSearchResultPages(searchResult, options = {}) {
    const limit = Math.max(0, Math.min(5, Number(options.limit || 3) || 3));
    if (!searchResult || limit <= 0 || !Array.isArray(searchResult.results)) return searchResult;
    const textLength = Math.max(1000, Math.min(20000, Number(options.textLength || 8000) || 8000));
    const next = {
        ...searchResult,
        page_fetch: {
            enabled: true,
            limit,
            fetched_at: dependencies.nowIso()
        },
        results: searchResult.results.map(item => ({ ...item }))
    };
    const targets = next.results
        .map((item, index) => ({ item, index, url: String(item.url || '').trim() }))
        .filter(entry => /^https?:\/\//i.test(entry.url))
        .slice(0, limit);
    const settled = await Promise.allSettled(targets.map(entry => dependencies.runFetchUrl(entry.url)));
    settled.forEach((outcome, index) => {
        const target = targets[index];
        if (!target) return;
        if (outcome.status === 'fulfilled') {
            const page = outcome.value || {};
            target.item.page_text = dependencies.safeText(page.text || '', textLength);
            target.item.page = {
                url: page.url || target.url,
                status: page.status || 0,
                content_type: page.content_type || '',
                fetched_at: page.fetched_at || dependencies.nowIso()
            };
        } else {
            target.item.page_error = String(outcome.reason?.message || outcome.reason || 'fetch failed').slice(0, 300);
        }
    });
    return next;
}

    return { flattenDuckDuckGoTopics, runWebSearch, normalizeSearchResults, runSerperSearch, runTavilySearch, runBraveSearch, runBingSearch, getWebSearchConfig, resolveSearchProvider, getSerperApiKey, enrichSearchResultPages };
}

module.exports = { createModule };
