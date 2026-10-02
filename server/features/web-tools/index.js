const crypto = require('crypto');
const initMcpLabDb = require("./db.js");
const {
    isMcpLabValidationError,
    normalizeMcpHttpUrl,
    normalizeMcpKnowledgeListOptions,
    normalizeMcpKnowledgePayload,
    normalizeMcpKnowledgeSearchPayload,
    normalizeMcpProvider,
    normalizeMcpSearchPayload,
    normalizeMcpTaskListOptions,
    normalizeMcpTaskPayload
} = require("./inputGuards.js");

const WEB_SEARCH_PROVIDERS = [
    {
        id: 'serper',
        label: 'Serper / Google',
        env: 'SERPER_API_KEY',
        docs: 'https://serper.dev/'
    },
    {
        id: 'tavily',
        label: 'Tavily Search',
        env: 'TAVILY_API_KEY',
        docs: 'https://tavily.com/'
    },
    {
        id: 'brave',
        label: 'Brave Search',
        env: 'BRAVE_SEARCH_API_KEY',
        docs: 'https://brave.com/search/api/'
    },
    {
        id: 'bing',
        label: 'Bing Web Search',
        env: 'BING_SEARCH_API_KEY',
        docs: 'https://www.microsoft.com/bing/apis/bing-web-search-api'
    }
];

const { nowIso, safeText, safeSnippet, safeParseJson, makeId, ensureMcpLabDb, assertHttpUrl, maskSecret } = require("./services/validation.js").createModule({
        get crypto() { return crypto; },
        get initMcpLabDb() { return initMcpLabDb; },
        get normalizeMcpHttpUrl() { return normalizeMcpHttpUrl; }
    });

const { fetchWithTimeout, stripHtml, runFetchUrl } = require("./services/fetch.js").createModule({
        get assertHttpUrl() { return assertHttpUrl; },
        get nowIso() { return nowIso; },
        get safeText() { return safeText; }
    });

const { flattenDuckDuckGoTopics, runWebSearch, normalizeSearchResults, runSerperSearch, runTavilySearch, runBraveSearch, runBingSearch, getWebSearchConfig, resolveSearchProvider, getSerperApiKey, enrichSearchResultPages } = require("./services/search.js").createModule({
        get WEB_SEARCH_PROVIDERS() { return WEB_SEARCH_PROVIDERS; },
        get fetchWithTimeout() { return fetchWithTimeout; },
        get maskSecret() { return maskSecret; },
        get nowIso() { return nowIso; },
        get runFetchUrl() { return runFetchUrl; },
        get safeParseJson() { return safeParseJson; },
        get safeSnippet() { return safeSnippet; },
        get safeText() { return safeText; }
    });

const { runTask } = require("./services/tasks.js").createModule({
        get ensureMcpLabDb() { return ensureMcpLabDb; },
        get nowIso() { return nowIso; },
        get resolveSearchProvider() { return resolveSearchProvider; },
        get runFetchUrl() { return runFetchUrl; },
        get runWebSearch() { return runWebSearch; }
    });

const { inspectContext } = require("./services/context.js").createModule({
        get ensureMcpLabDb() { return ensureMcpLabDb; },
        get safeText() { return safeText; }
    });

function initMcpLab(app, context) {
    const { authMiddleware } = context;

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/get-mcp-lab-status.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getSerperApiKey() { return getSerperApiKey; }, get getWebSearchConfig() { return getWebSearchConfig; }, get maskSecret() { return maskSecret; }, get resolveSearchProvider() { return resolveSearchProvider; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/get-mcp-lab-context-characterId.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get inspectContext() { return inspectContext; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/post-mcp-lab-search.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; }, get isMcpLabValidationError() { return isMcpLabValidationError; }, get makeId() { return makeId; }, get normalizeMcpSearchPayload() { return normalizeMcpSearchPayload; }, get nowIso() { return nowIso; }, get resolveSearchProvider() { return resolveSearchProvider; }, get runWebSearch() { return runWebSearch; }, get safeText() { return safeText; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/get-mcp-lab-serper-config.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getWebSearchConfig() { return getWebSearchConfig; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/put-mcp-lab-serper-config.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getWebSearchConfig() { return getWebSearchConfig; }, get safeParseJson() { return safeParseJson; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/get-mcp-lab-web-config.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getWebSearchConfig() { return getWebSearchConfig; }, get resolveSearchProvider() { return resolveSearchProvider; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/put-mcp-lab-web-config.js").register({ get WEB_SEARCH_PROVIDERS() { return WEB_SEARCH_PROVIDERS; }, get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getWebSearchConfig() { return getWebSearchConfig; }, get isMcpLabValidationError() { return isMcpLabValidationError; }, get normalizeMcpProvider() { return normalizeMcpProvider; }, get resolveSearchProvider() { return resolveSearchProvider; }, get safeParseJson() { return safeParseJson; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/post-mcp-lab-fetch.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; }, get isMcpLabValidationError() { return isMcpLabValidationError; }, get makeId() { return makeId; }, get normalizeMcpHttpUrl() { return normalizeMcpHttpUrl; }, get nowIso() { return nowIso; }, get runFetchUrl() { return runFetchUrl; }, get safeText() { return safeText; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/get-mcp-lab-tasks.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; }, get isMcpLabValidationError() { return isMcpLabValidationError; }, get normalizeMcpTaskListOptions() { return normalizeMcpTaskListOptions; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/post-mcp-lab-tasks.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; }, get isMcpLabValidationError() { return isMcpLabValidationError; }, get makeId() { return makeId; }, get normalizeMcpTaskPayload() { return normalizeMcpTaskPayload; }, get nowIso() { return nowIso; }, get runTask() { return runTask; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/post-mcp-lab-tasks-id-run.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; }, get runTask() { return runTask; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/delete-mcp-lab-tasks-id.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/get-mcp-lab-knowledge.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; }, get isMcpLabValidationError() { return isMcpLabValidationError; }, get normalizeMcpKnowledgeListOptions() { return normalizeMcpKnowledgeListOptions; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/post-mcp-lab-knowledge.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; }, get isMcpLabValidationError() { return isMcpLabValidationError; }, get makeId() { return makeId; }, get normalizeMcpKnowledgePayload() { return normalizeMcpKnowledgePayload; } });

    if (require('../../../config/feature-manifest.json').labs.mcp.enabled) require("../../labs/mcp/http/post-mcp-lab-knowledge-search.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get ensureMcpLabDb() { return ensureMcpLabDb; }, get isMcpLabValidationError() { return isMcpLabValidationError; }, get normalizeMcpKnowledgeSearchPayload() { return normalizeMcpKnowledgeSearchPayload; } });

    console.log('[MCP Lab DLC] Experimental web tools registered.');
}

module.exports = initMcpLab;
module.exports.WEB_SEARCH_PROVIDERS = WEB_SEARCH_PROVIDERS;
module.exports.ensureMcpLabDb = ensureMcpLabDb;
module.exports.getWebSearchConfig = getWebSearchConfig;
module.exports.resolveSearchProvider = resolveSearchProvider;
module.exports.runWebSearch = runWebSearch;
module.exports.runFetchUrl = runFetchUrl;
module.exports.safeText = safeText;
module.exports.makeId = makeId;
