# MCP 实验室、住房系统、商业街日志前端重做交接文档

本文档用于把 ChatPulse 现有的 MCP 实验室、住房系统、商业街日志/管理/像素商业街相关前端交给新的前端实现方。重点包含接口列表、请求参数、返回数据、异常情况、接口背后的业务逻辑、现有代码目录、技术栈、适配目标和必须保留功能。

## 0. MCP 实验室最终布局约束（2026-07-11）

用户提供的 `C:/Users/Nana/Downloads/mcp-lab-redesign-source.zip` 是 MCP 实验室的确认方向稿，但不能原封不动复制其中示例组件和样式。当前项目内已按这个方向重做了 MCP Lab：

- 代码位置：`client/src/plugins/mcpLab/McpLabPanel.jsx`
- 新增样式：`client/src/plugins/mcpLab/McpLabPanel.css`
- 保留接口和业务动作：状态加载、联网搜索、网页抓取、任务创建/重跑/删除、搜索源 Key 保存、外部知识保存和检索。
- 布局方向：顶部工具切换、左侧功能入口、中间工作台、右侧任务/搜索源检查器、底部状态栏。
- 实现要求：后续前端继续沿用当前 `mcp-lab-*` 命名和局部 CSS，不要直接套用参考包里的 `mcp-fs-*` 类名、文案结构或整段 CSS。

## 0.1 住房系统最终布局约束（2026-07-11）

用户提供的 `C:/Users/Nana/Downloads/housing-core-loop-source.zip` 是住房系统的确认方向稿。该包只有 HTML 原型、接入说明和实施提示词，不是 React 业务源码，不能直接替换 `HousingSocialPanel.jsx`。

- 主要代码位置：`client/src/plugins/socialHousing/HousingSocialPanel.jsx`
- 主要样式位置：`client/src/plugins/socialHousing/HousingSocialPanel.css`
- 布局方向：默认突出“租房故事”主循环；第二一级页面为“中介 AI 创作室”；房源库、住户租金、中介配置、广告记录和历史链路收入管理抽屉。
- 必须保留：现有接口、辅助函数、房间素材、家具尺寸标尺、AI 样板间生成、`saveAgencyRoomAssembly()`、localStorage 房间写入逻辑。
- 参考包提示词已经覆盖的主动作：`recommendHomeToCharacter()`、`assignHomeToCharacter()`、`publishAgency()`、`runRoomAssembly()`、`saveAgency()`、`saveHome()`、`deleteHome()`、`updateBinding()`、`payRent()`、`deleteAgencyAd()`。
- 参考包没有明确点名但我们后端仍有的接口：`POST /api/social-housing/classes`、`DELETE /api/social-housing/classes/:id`。如果新前端保留“阶层/预设房源分类”管理，就必须接这两个接口。
- 参考包没有强调但 `bootstrap` 会返回的字段：`public_agency_announcements`。如果要展示已发布到商业街公告里的中介广告，需要读取这个字段。

## 0.2 商业街日志最终布局约束（2026-07-11）

用户提供的 `C:/Users/Nana/Downloads/city-commercial-street-source.zip` 是商业街日志的确认方向稿。该包和住房包一样，是 HTML 原型、接线说明和实施提示词，不是 React 业务源码；不能把其中模拟数据、原生 DOM 操作、`city-core-loop-*` 示例结构直接复制进项目。

- 主要代码位置：`client/src/plugins/city/CityLog.jsx`
- 主要样式位置：`client/src/plugins/city/CityLog.css`
- 主要管理代码：`client/src/plugins/city/CityManager.jsx`
- 布局方向：全屏“城市直播 + 市长 AI 办公室”。第一核心是角色行动/相遇/任务推进；第二核心是运行市长 AI；分区、商品、参数、发资源、清空日志、wipe 等收进城市管理抽屉。
- 必须保留：现有 `apiUrl`、`cp_token`、`tx()` 双语、`AvatarWithFrame`、头像解析、5 秒轮询、`city_update` 事件刷新、天气素材、公告去重、折叠日志展开、reroll、任务评分重试、黑客据点内容折叠、`delta_calories`/`delta_money`、任务推进评分块、完整 `CityManager` 功能。
- 参与者规则：默认只显示日志所属角色；只有后端将来提供结构化 participants，或当前 `SOCIAL` 日志正文中唯一匹配到另一个已加载角色名时，才显示双人卡位。不能因为 `action_type === 'SOCIAL'` 就虚构第二个角色。
- 参考包接口清单只写了核心直播和核心操作。我们后端仍有而它没有逐项点名的接口包括：`POST/DELETE/PATCH /api/city/districts*`、`POST /api/city/config`、`POST/DELETE /api/city/items*`、`GET /api/city/inventory/:charId`、`GET /api/city/schedule/:charId`、`POST /api/city/give-gold`、`POST /api/city/feed`、`POST /api/city/give-item`、`POST/DELETE /api/city/events*`、`POST/DELETE /api/city/quests*`、`DELETE /api/city/logs/clear`、`DELETE /api/city/data/wipe`、`/api/city/characters/:id/behavior-*`。新前端如果保留城市管理抽屉和像素商业街，需要继续接这些接口。

## 1. 项目概况

ChatPulse 是本地优先的 AI 社交模拟应用。当前前端是 React + Vite，后端是 Express + SQLite。桌面版通过 Electron 打包。用户登录后，前端请求 `/api/*` 接口并携带 JWT token。

本次需要重做的前端模块：

- MCP 实验室：联网搜索、网页抓取、任务历史、外部知识库。
- 住房系统：房源、角色住房绑定、交房租、中介 AI、租房链路、样板间组装。
- 商业街日志：城市活动流、公告、天气、居民状态、分区管理、商品/任务/市长 AI 等城市管理能力。
- 可能关联的像素商业街：本地布局编辑、行为树生成、角色绑定。

## 2. 技术栈和目录

### 技术栈

- 前端：React 19、React DOM、Vite 6、lucide-react 图标。
- 后端：Node.js、Express 5、better-sqlite3、ws、node-cron。
- 桌面端：Electron、electron-builder。
- 存储：SQLite 为主，部分像素世界布局存在浏览器 `localStorage`。
- 网络：前端使用 `fetch` 调接口。
- 鉴权：JWT，存储在 `localStorage.cp_token`。

### 现有前端目录

- `client/src/plugins/mcpLab/McpLabPanel.jsx`
  MCP 实验室现有页面。
- `client/src/plugins/socialHousing/HousingSocialPanel.jsx`
  住房系统现有页面。
- `client/src/plugins/socialHousing/HousingSocialPanel.css`
  住房系统现有样式。
- `client/src/plugins/city/CityLog.jsx`
  商业街日志页，包括实时动态和管理 tab。
- `client/src/plugins/city/CityLog.css`
  商业街日志样式。
- `client/src/plugins/city/CityManager.jsx`
  商业街管理 tab，包括分区、商品、配置、任务、市长 AI 等。
- `client/src/plugins/pixelWorld/CommercialStreetPanel.jsx`
  像素商业街入口。
- `client/src/plugins/pixelWorld/CommercialStreetEditor.jsx`
  像素商业街编辑器和行为树实验区。
- `client/src/plugins/pixelWorld/PixelWorldPanel.jsx`
  像素世界总入口。
- `client/src/plugins.js`
  插件入口注册。
- `client/src/desktop/ChatPulseDesktop.jsx`
  桌面壳入口，负责打开这些应用窗口。
- `client/public/assets/ui/desktop/apps/*`
  桌面 app 图标。
- `client/public/assets/ui/city/weather/*`
  商业街天气背景图。
- `client/public/assets/pixel-world/*`
  像素商业街、房间、家具和角色素材。

### 现有后端目录

- `server/plugins/mcpLab/index.js`
  MCP 实验室接口和联网搜索/抓取逻辑。
- `server/plugins/mcpLab/db.js`
  MCP 任务和外部知识库表。
- `server/plugins/mcpLab/inputGuards.js`
  MCP 请求校验。
- `server/plugins/socialHousing/index.js`
  住房系统接口、中介广告、收租、样板间。
- `server/plugins/socialHousing/db.js`
  住房系统表、默认房源、绑定、广告、租房链路。
- `server/plugins/socialHousing/rentalChainService.js`
  推荐房源后的完整租房链路。
- `server/plugins/socialHousing/inputGuards.js`
  住房系统请求校验。
- `server/plugins/city/index.js`
  商业街自动行为、市长 AI、行为树接口、日程接口。
- `server/plugins/city/cityDb.js`
  商业街日志、公告、分区、商品、背包、任务、事件、配置。
- `server/plugins/city/routes/coreRoutes.js`
  商业街核心 REST 接口。
- `server/plugins/city/routes/eventQuestRoutes.js`
  事件和任务 REST 接口。
- `server/plugins/city/utils/inputGuards.js`
  商业街请求校验。

## 3. 通用接口约定

### API base

前端通常传入 `apiUrl = '/api'`，然后请求 `${apiUrl}/city/...`、`${apiUrl}/mcp-lab/...`。住房系统当前有些调用硬编码 `/api/social-housing/...`，新实现建议统一封装 API client。

### 请求头

所有登录后接口都需要：

```js
{
  Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}`,
  'Content-Type': 'application/json'
}
```

`GET` 请求可以不带 `Content-Type`，但带上也没有问题。

### 成功和失败返回

多数接口成功：

```js
{ success: true, ...payload }
```

多数接口失败：

```js
{ success: false, error: '错误信息' }
```

部分 `/api/city/*` 旧接口失败没有 `success:false`，只有：

```js
{ error: '错误信息', canRetry?: true }
```

前端错误处理建议：

```js
if (!response.ok || data.success === false) {
  throw new Error(data.error || `Request failed ${response.status}`);
}
```

### WebSocket / 事件刷新

部分接口会通过 WebSocket 广播：

- `refresh_contacts`
- `city_update`
- wallet sync 相关事件

现有前端还监听浏览器事件 `window.addEventListener('city_update', ...)`，并每 5 秒轮询城市日志。新前端如果仍在旧应用壳中运行，建议保留：

- 操作成功后手动刷新相关列表。
- 收到/派发 `city_update` 时刷新商业街日志、居民状态、住房状态。

## 4. MCP 实验室接口

### 4.1 `GET /api/mcp-lab/status`

功能：读取 MCP 实验室状态、当前搜索源、可用 provider、工具清单。

请求参数：无。

返回数据：

```js
{
  success: true,
  name: 'mcpLab',
  stage: 'experimental',
  search_provider: 'duckduckgo' | 'serper' | 'tavily' | 'brave' | 'bing',
  search_provider_label: string,
  preferred_search_provider: 'auto' | 'duckduckgo' | 'serper' | 'tavily' | 'brave' | 'bing',
  web_search_providers: [
    { id, label, env, docs, has_key, masked, source }
  ],
  has_serper_key: boolean,
  serper_key_masked: string,
  tools: [
    { id, label, input_schema }
  ],
  note: string
}
```

业务逻辑：

- 从用户 profile 读取 `web_search_provider`、`web_search_keys_json`、旧字段 `serper_api_key`。
- 解析当前实际可用搜索源：优先用户选择和已保存 Key，否则退回 DuckDuckGo。
- 不会发起真实搜索，只返回状态。

异常情况：

- 数据库/profile 读取异常：`500 { success:false, error }`。

前端展示建议：

- 顶部状态：当前 provider、实验阶段、已保存 Key 数量。
- 工具能力列表：Web Search、Fetch URL、Save External Knowledge、Search External Knowledge、Inspect Character Context。

### 4.2 `GET /api/mcp-lab/web-config`

功能：读取搜索 provider 和 API Key 保存状态。

请求参数：无。

返回数据：

```js
{
  success: true,
  preferred_provider,
  active_provider,
  active_provider_label,
  saved_key_count,
  providers: [
    { id, label, env, docs, has_key, masked, source }
  ]
}
```

业务逻辑：

- 只返回 Key 是否保存和掩码，不返回真实 Key。
- `source` 常见为 `user_profile` 或 `none`。
- `active_provider` 是后端解析后真实会用的 provider。

异常情况：

- 读取配置失败：500。

### 4.3 `PUT /api/mcp-lab/web-config`

功能：保存搜索 provider 和搜索源 Key。

请求参数：

```js
{
  preferred_provider: 'auto' | 'duckduckgo' | 'serper' | 'tavily' | 'brave' | 'bing',
  keys: {
    serper?: string,
    tavily?: string,
    brave?: string,
    bing?: string
  },
  clear_ids?: ['serper' | 'tavily' | 'brave' | 'bing']
}
```

返回数据：同 `GET /api/mcp-lab/web-config`。

业务逻辑：

- `keys` 中空字符串不会覆盖旧 Key。
- `clear_ids` 会删除用户级 Key。
- 同步旧字段 `serper_api_key`，兼容历史代码。
- 保存 `web_search_provider`。

异常情况：

- provider 非法：400 `Invalid web search provider`。
- 数据库更新失败：500。

前端注意：

- 清除 Key 应设计成“标记清除后保存”，不要只改本地状态。

### 4.4 `POST /api/mcp-lab/search`

功能：执行联网搜索，并保存任务历史。

请求参数：

```js
{
  query: string,
  provider?: 'auto' | 'duckduckgo' | 'serper' | 'tavily' | 'brave' | 'bing',
  fetch_pages?: boolean,
  fetch_page_limit?: number // 0..5，默认 3
}
```

返回数据：

```js
{
  success: true,
  result: {
    query,
    source,
    results: [
      {
        title,
        snippet,
        url,
        raw,
        page_text?,
        page?,
        page_error?
      }
    ],
    fetched_at,
    raw_response?,
    page_fetch?
  },
  task: {
    id,
    owner_id,
    title,
    kind: 'web_search',
    input,
    status: 'done' | 'error',
    output,
    error,
    created_at,
    started_at,
    finished_at
  }
}
```

业务逻辑：

- 校验 query 长度和 provider。
- 先创建 `mcp_lab_tasks` 记录，状态 `running`。
- 解析搜索源：
  - 指定 provider 有 Key 时使用指定源。
  - `auto` 会按已保存 Key 找 `serper/tavily/brave/bing`。
  - 没有 Key 时使用 DuckDuckGo Instant Answer。
- 不同 provider 对接不同外部 API：
  - Serper: `https://google.serper.dev/search`
  - Tavily: `https://api.tavily.com/search`
  - Brave: `https://api.search.brave.com/res/v1/web/search`
  - Bing: `https://api.bing.microsoft.com/v7.0/search`
  - DuckDuckGo: `https://api.duckduckgo.com/`
- 搜索结果最多规范化为 3 条。
- 若 `fetch_pages !== false`，后端继续抓取搜索结果页正文，写入 `page_text`。
- 任务最终保存为 `done` 或 `error`。

异常情况：

- query 为空：400 `Query is required`。
- provider 非法：400。
- 外部搜索 API 失败：500，错误信息可能来自 provider。
- 网页抓取失败不会让整个搜索失败，单条结果写 `page_error`。

前端展示建议：

- 结果列表展示 title/snippet/source/open link。
- 可折叠展示 `raw`、`raw_response`、`page_text`。
- 搜索完成后把返回的 `task` 插入任务历史顶部。

### 4.5 `POST /api/mcp-lab/fetch`

功能：抓取单个 URL 的正文，并保存任务。

请求参数：

```js
{ url: 'https://example.com' }
```

返回数据：

```js
{
  success: true,
  result: {
    url,
    status,
    content_type,
    text,
    fetched_at
  },
  task
}
```

业务逻辑：

- 只允许 http/https。
- 阻止 localhost、内网 IP、`.local`、本机地址，避免 SSRF。
- 15 秒超时。
- HTML 会剥离 script/style/noscript/html tag 后提取纯文本。
- 非 HTML 会做空白归一化。
- 文本最长约 12000 字。
- 成功或失败都会保存任务状态。

异常情况：

- URL 非法：400。
- URL 不是公网 http/https：400。
- HTTP 非 2xx：500 `Fetch failed with HTTP xxx`。
- 超时/网络失败：500。

### 4.6 `GET /api/mcp-lab/tasks`

功能：读取当前用户 MCP 任务历史。

请求参数：

```js
?limit=80 // 1..200，默认 80
```

返回数据：

```js
{
  success: true,
  tasks: [
    {
      id,
      owner_id,
      title,
      kind,
      input,
      status,
      output,
      error,
      created_at,
      started_at,
      finished_at
    }
  ]
}
```

业务逻辑：

- 只返回当前用户 `owner_id` 的任务。
- 按 `created_at DESC` 排序。

异常情况：

- limit 非法：400 `Invalid numeric value`。

### 4.7 `POST /api/mcp-lab/tasks`

功能：创建 MCP 任务，可立即运行。

请求参数：

```js
{
  kind: 'web_search' | 'private_web_search' | 'city_web_search' | 'fetch_url',
  title?: string,
  input: {
    query?: string,
    provider?: string,
    fetch_pages?: boolean,
    fetch_page_limit?: number,
    url?: string
  },
  run_now?: boolean
}
```

返回数据：

```js
{ success: true, task }
```

业务逻辑：

- 校验 kind。
- `fetch_url` 任务校验 URL。
- 搜索任务校验 query/provider。
- 先保存 queued 任务。
- `run_now !== false` 时立即执行，并保存 output/status。
- `private_web_search`、`city_web_search` 当前和普通搜索执行逻辑一致，只是保留来源语义。

异常情况：

- kind 非法：400 `Unsupported MCP Lab task kind`。
- input 非法：400。
- 运行失败：任务可能为 `error`，接口仍可能返回成功任务，或返回 500。

### 4.8 `POST /api/mcp-lab/tasks/:id/run`

功能：重跑已有任务。

请求参数：路径参数 `id`。

返回数据：

```js
{ success: true, task }
```

业务逻辑：

- 只能读取当前用户自己的任务。
- 使用原任务 `kind/input` 重新执行。
- 覆盖任务 `status/output/error/started_at/finished_at`。

异常情况：

- 任务不存在：404 `Task not found.`。
- 执行失败：500 或任务状态 `error`。

### 4.9 `DELETE /api/mcp-lab/tasks/:id`

功能：删除当前用户自己的任务。

返回数据：

```js
{ success: true, deleted: true }
```

异常情况：

- 任务不存在：404 `Task not found.`。

### 4.10 `GET /api/mcp-lab/knowledge`

功能：读取外部知识文档列表。

请求参数：

```js
?character_id=角色ID或空
&limit=30 // 1..100
```

返回数据：

```js
{
  success: true,
  docs: [
    {
      id,
      owner_id,
      character_id,
      title,
      source_url,
      source_type,
      trust_level,
      tags_json,
      created_at,
      updated_at,
      tags
    }
  ]
}
```

业务逻辑：

- 传 `character_id` 时，会返回全局知识 `character_id=''` 和该角色知识。
- 不返回 chunks 全文，只返回文档元数据。

异常情况：

- character_id 不存在：404 `Character not found.`。
- limit 非法：400。

### 4.11 `POST /api/mcp-lab/knowledge`

功能：保存外部知识。

请求参数：

```js
{
  character_id?: string,
  title?: string,
  source_url?: string,
  source_type?: 'web' | 'note' | string,
  content: string,
  trust_level?: string,
  tags?: string[] | string
}
```

返回数据：

```js
{
  success: true,
  doc: {
    ...doc,
    tags,
    chunks: [
      { id, doc_id, chunk_index, content, created_at }
    ]
  }
}
```

业务逻辑：

- content 必填，最大约 200000 字。
- source_url 如果传入，必须是允许的公网 http/https。
- 写入 `external_knowledge_docs`。
- 内容按约 1400 字、160 字重叠切块写入 `external_knowledge_chunks`。
- 当前搜索是关键词搜索，不是向量搜索。

异常情况：

- content 为空：400。
- content 太大：400。
- source_url 非法或内网地址：400。
- character_id 不存在：404。

### 4.12 `POST /api/mcp-lab/knowledge/search`

功能：搜索外部知识 chunks。

请求参数：

```js
{
  character_id?: string,
  query: string,
  limit?: number // 1..30，默认 8
}
```

返回数据：

```js
{
  success: true,
  results: [
    {
      chunk_id,
      doc_id,
      title,
      source_url,
      source_type,
      trust_level,
      tags,
      character_id,
      chunk_index,
      content,
      score
    }
  ]
}
```

业务逻辑：

- query 拆成最多 8 个词。
- 在 title/content/source_url 里做关键词计数打分。
- 按 score 和更新时间排序。
- 如果传角色，仍包含全局知识。

异常情况：

- query 为空：400。
- character_id 不存在：404。
- limit 非法：400。

### 4.13 `GET /api/mcp-lab/context/:characterId`

功能：查看某个角色的上下文调试包。

返回数据：

```js
{
  success: true,
  context: {
    character,
    private_window,
    city,
    group_context,
    external_knowledge,
    recent_llm_debug
  }
}
```

业务逻辑：

- 读取角色、最近私聊、最近商业街日志、所属群聊、外部知识文档、LLM debug。
- 用于调试，不是主流程必须功能。

异常情况：

- 角色不存在：404。

### 4.14 `GET /api/mcp-lab/serper-config`

功能：旧版 Serper 单搜索源配置查询接口。现在主配置接口已经升级为 `GET /api/mcp-lab/web-config`，新前端优先使用 `web-config`；只有兼容旧页面或只做 Serper Key 设置时才需要接这个接口。

请求参数：无。

返回数据：

```js
{
  success: true,
  has_key: boolean,
  source: 'env' | 'user' | 'none' | string,
  masked: string
}
```

业务逻辑：

- 读取统一搜索源配置 `getWebSearchConfig`。
- 只取 provider id 为 `serper` 的配置。
- `has_key` 表示环境变量或用户配置里是否有 Serper Key。
- `source` 表示 Key 来源：环境变量、用户配置或无。
- `masked` 返回脱敏后的 Key，不返回明文。

异常情况：

- 服务端读取配置失败：500。

### 4.15 `PUT /api/mcp-lab/serper-config`

功能：旧版 Serper 单搜索源 Key 保存接口。新前端建议使用 `PUT /api/mcp-lab/web-config`，因为 `web-config` 能同时管理 Serper、Tavily、Brave、Bing 和首选搜索源。

请求参数：

```js
{
  serper_api_key: string
}
```

返回数据：

```js
{
  success: true,
  has_key: boolean,
  source: 'env' | 'user' | 'none' | string,
  masked: string
}
```

业务逻辑：

- 读取当前用户 profile。
- 把 `serper_api_key` 写入旧字段 `serper_api_key`，同时写入统一字段 `web_search_keys_json.serper`。
- 如果传入了非空 Key，会把 `web_search_provider` 切到 `serper`；如果清空 Key，则保留现有 provider 或回到 `auto`。
- 返回保存后的 Serper 配置状态。

异常情况：

- 服务端更新 profile 或读取配置失败：500。

## 5. 住房系统接口

### 5.1 `GET /api/social-housing/bootstrap`

功能：住房系统页面初始化，一次性取全部数据。

请求参数：无。

返回数据：

```js
{
  success: true,
  classes,
  housing_tiers,
  characters,
  districts,
  agency_model_options,
  agency,
  agency_ads,
  rental_chains,
  rental_chain_events,
  public_agency_announcements
}
```

关键字段：

```js
housing_tiers: [
  {
    id, name, emoji, description,
    weekly_rent, deposit, sale_price,
    comfort, prestige, privacy,
    is_enabled, sort_order
  }
]

characters: [
  {
    id, name, avatar, wallet, location, city_status,
    api_endpoint, api_key, api_key_configured, api_key_last4, model_name,
    binding: {
      character_id,
      social_class_id,
      housing_id,
      housing_status,
      rent_weekly,
      rent_due_day,
      rent_due_at,
      rent_last_paid_at,
      housing_started_at,
      deposit_paid,
      missed_rent_count,
      note,
      social_class,
      housing
    } | null
  }
]
```

业务逻辑：

- 初始化 socialHousing DB 和 city DB。
- 清理孤儿中介广告：如果 `social_housing_ads` 已没有对应广告，会删除 `city_announcements` 和 city log 里的残留 `[中介所广告]`。
- 返回当前可作为中介模型的角色列表：只包含有 `api_endpoint/api_key/model_name` 的角色。
- 角色真实 `api_key` 会被清空，只返回是否配置和后四位。
- 中介配置真实 `llm_key` 也会被删除。

异常情况：

- 初始化或清理失败：500。
- 如果失败，后端还会尝试把错误写入 agency 的 `last_error/last_error_at`。

前端必须保留：

- 加载总入口。
- 房源数量、稳定居住、无房、欠租、租房链路统计。
- 角色住房状态、广告、租房链路事件。

### 5.2 `POST /api/social-housing/classes`

功能：新增或更新社会阶层。

请求参数：

```js
{
  id?: string,
  name: string,
  emoji?: string,
  description?: string,
  work_bias?: number,        // -100..100
  consumption_bias?: number, // -100..100
  prestige_bias?: number,    // -100..100
  social_barrier?: number,   // -100..100
  common_locations?: string[] | string,
  is_enabled?: 0 | 1,
  sort_order?: number
}
```

返回数据：

```js
{ success: true, id, classes }
```

业务逻辑：

- 校验阶层名称必填。
- id 为空时从名称 slugify。
- 写入 `social_housing_classes`。

异常情况：

- name 为空：400 `缺少阶级名称`。
- 数值超范围：400。

### 5.3 `DELETE /api/social-housing/classes/:id`

功能：删除阶层。

返回数据：

```js
{ success: true, classes }
```

业务逻辑：删除 `social_housing_classes` 指定 id。

异常情况：

- id 不存在：404 `阶层不存在`。
- 数据库失败：500。

### 5.4 `POST /api/social-housing/housing`

功能：新增或更新房源。

请求参数：

```js
{
  id?: string,
  name: string,
  emoji?: string,
  description?: string,
  weekly_rent?: number,
  deposit?: number,
  sale_price?: number,
  comfort?: number,  // 0..100
  prestige?: number, // 0..100
  privacy?: number,  // 0..100
  is_enabled?: 0 | 1,
  sort_order?: number
}
```

返回数据：

```js
{ success: true, id, housing_tiers }
```

业务逻辑：

- 校验 name 必填。
- 校验金额非负，最大 1000000。
- 舒适/体面/隐私范围 0..100。
- id 为空时根据名称生成。
- 写入 `social_housing_homes`。

异常情况：

- name 为空：400 `缺少房子名称`。
- 金额或评分非法：400。

### 5.5 `DELETE /api/social-housing/housing/:id`

功能：删除房源。

返回数据：

```js
{
  success: true,
  removed_agency_ads,
  housing_tiers,
  agency_ads
}
```

业务逻辑：

- 删除 `social_housing_homes`。
- 找到引用该房源的中介广告并删除。
- 同时删除这些广告对应的 `city_announcements` 和 system `ANNOUNCE` 日志。

异常情况：

- 房屋不存在：404 `房屋不存在`。
- 数据库失败：500。

### 5.6 `POST /api/social-housing/characters/:id/binding`

功能：手动编辑角色住房绑定。

请求参数：

```js
{
  social_class_id?: string,
  housing_id?: string,
  housing_status?: 'stable' | 'temporary' | 'unstable' | 'overdue' | 'homeless',
  rent_weekly?: number,
  rent_due_day?: number,       // 1..30
  rent_due_at?: number,        // timestamp ms
  rent_last_paid_at?: number,  // timestamp ms
  deposit_paid?: number,
  missed_rent_count?: number,
  note?: string
}
```

返回数据：

```js
{
  success: true,
  characters,
  housing_context: {
    binding,
    housing,
    social_class
  }
}
```

业务逻辑：

- 校验角色存在。
- 校验房源和阶层存在。
- 如果 `housing_id` 为空，后端会保存为无房状态：租金、押金、下次催租归零。
- 如果换房，会重置欠租次数和入住时间。
- 如果 `rent_weekly` 未提供或为 0，会使用房源默认周租。
- 保存到 `social_housing_bindings`。

异常情况：

- 角色不存在：404。
- 房屋不存在/阶层不存在/租金非法：400。

前端必须保留：

- 已住房角色可以改房源、状态、租金、缴租周期、备注。
- 选择空房源表示解除住房。

### 5.7 `POST /api/social-housing/characters/:id/pay-rent`

功能：手动触发角色交房租。

请求参数：无 body。

返回数据：

```js
{
  success: true,
  result: {
    success,
    paid,
    evicted,
    amount,
    character,
    binding,
    private_reply
  },
  characters
}
```

业务逻辑：

- 读取角色、住房绑定和周租。
- 如果没有住房或租金配置，返回业务失败。
- 必须有角色 API 配置，因为后端会让角色模型生成一条公开商业街收租日志。
- 后端还会触发私聊引擎，让角色对收租事件私聊回应。
- 钱包足够：
  - 扣除角色钱包。
  - 标记房租已付，状态 stable。
  - 更新 `rent_last_paid_at` 和下次催租日。
  - 写 city log，action_type 为 `RENT` 或周五自动收租时的 `AGENCY_RENT_COLLECTION`。
- 钱包不足：
  - 清空住房绑定。
  - 状态变 `homeless`。
  - `missed_rent_count + 1`。
  - 写 city log，action_type 为 `RENT_EVICTION` 或 `AGENCY_RENT_EVICTION`。
- 广播 `refresh_contacts` 和 `city_update`。

异常情况：

- 角色不存在：404。
- 没有住房：400。
- 没有模型配置：500，错误类似 `收租文案需要角色 API 配置`。
- 私聊引擎不可用：500。
- LLM 输出非法 JSON：500。

前端必须保留：

- 交租按钮。
- 交租中 loading。
- 失败时展示错误。
- 成功后刷新角色/住房/商业街日志。

### 5.8 `POST /api/social-housing/characters/:id/recommend-home`

功能：给无房角色推荐房源，并运行完整租房链路。

请求参数：

```js
{
  home_id: string,
  agency_ad_id?: number,
  run_full_chain?: boolean // 默认 true
}
```

返回数据：

```js
{
  success: true,
  outcome: 'recommended' | 'signed' | 'declined' | 'rejected_insufficient_funds',
  chain,
  chain_events,
  characters,
  rental_chains,
  rental_chain_events,
  agency_ads
}
```

业务逻辑：

1. 校验角色存在。
2. 校验房源存在且启用。
3. 校验角色当前没有住房；已有住房会拒绝。
4. 校验中介所有可用 AI 模型。
5. 创建 `social_housing_rental_chains`，状态 running，stage recommended。
6. 写链路事件 `recommended`。
7. 给角色私聊插入系统消息：用户推荐了房源。
8. 触发角色私聊回应。
9. 如果 `run_full_chain=false`，到此结束，outcome 为 `recommended`。
10. 如果 `run_full_chain=true`，继续跑完整 LLM 链路：
    - 看房阶段：中介模型介绍房源，角色模型问答。角色可以输出 `MORE_INFO` 继续问，最多 24 轮。
    - 考虑阶段：角色模型生成 `HOUSING_CONSIDER` 商业街日志。
    - 决定阶段：角色模型决定 `wants_to_rent`。
    - 拒租：链路 completed/declined，给用户最终私聊反馈。
    - 想租但钱不够：中介模型生成拒绝，写 `HOUSING_REJECTED`，给用户最终私聊反馈，outcome `rejected_insufficient_funds`。
    - 钱够签约：中介说明合同，角色签约，扣钱包 `weekly_rent + deposit`，保存住房绑定，写 `HOUSING_SIGNED` 日志，给用户最终私聊反馈，outcome `signed`。

异常情况：

- 缺少 home_id：400。
- 角色不存在：404。
- 房源不存在：404。
- 房源已停用：409，`can_retry:false`。
- 角色已有住房：409，`can_retry:false`。
- 中介所没有可用模型：502，`can_retry:true`。
- 任一 LLM 输出非法/截断/缺字段：502，`can_retry:true`。
- 看房问答超过 24 轮仍未结束：502。

前端必须保留：

- 只对无房角色开放推荐入口。
- 展示链路运行中状态。
- 展示 outcome：已签约、拒租、余额不足、推荐完成。
- 展示链路事件：看房对话、看房总结、考虑、决定、签约/失败。
- 失败后刷新链路列表，因为后端可能已写入失败链路。

### 5.9 `POST /api/social-housing/characters/:id/assign-home`

功能：直接指派住房，不走看房链路。

请求参数：

```js
{ home_id: string }
```

返回数据：

```js
{
  success: true,
  character,
  housing_context,
  characters
}
```

业务逻辑：

- 校验角色、房源、房源启用、角色无住房。
- 直接保存 binding：
  - `housing_status='stable'`
  - `rent_weekly=0`
  - `rent_due_at=0`
  - `deposit_paid=0`
  - note 为用户指派住房。
- 写 city log `HOUSING_GRANTED`。
- 插入系统私聊消息。
- 触发角色对获得住房的私聊回应。

异常情况：

- 缺少 home_id：400。
- 角色/房源不存在：404。
- 房源停用或已有住房：409。
- 私聊引擎不可用：502。

注意：

- 住房绑定会在私聊通知前保存。如果私聊通知失败，接口可能失败但住房状态已经改变。前端失败后也应该刷新 bootstrap。

### 5.10 `POST /api/social-housing/agency`

功能：保存中介所配置。

请求参数：

```js
{
  enabled?: 0 | 1,
  agency_name?: string,
  agent_name?: string,
  office_district?: string,
  business_scope?: string,
  persona_prompt?: string,
  llm_endpoint?: string,
  llm_key?: string,
  llm_model?: string,
  ad_enabled?: 0 | 1,
  decision_interval_hours?: number, // 1..168
  model_char_id?: 'auto' | characterId,
  last_ad_at?: number,
  next_ad_at?: number,
  last_error?: string,
  last_error_at?: number
}
```

返回数据：

```js
{ success: true, agency }
```

业务逻辑：

- 保存到 `social_housing_agency`。
- `enabled` 同时影响广告自动发布开关。
- `decision_interval_hours` 会换算成 `ad_min_interval_minutes/ad_max_interval_minutes`。
- 真实 `llm_key` 不返回，只返回 `llm_key_configured/llm_key_last4`。
- 如果前端传空 key 或掩码，后端不会覆盖旧 Key。

异常情况：

- 时间间隔非法：400。
- timestamp 非法：400。

### 5.11 `POST /api/social-housing/agency/publish-ad`

功能：手动让中介 AI 生成并发布一条广告。

请求参数：无 body。

返回数据：

```js
{
  success: true,
  ad: {
    title,
    content,
    home_id?,
    office_district
  },
  agency,
  agency_ads
}
```

业务逻辑：

- 读取启用房源列表、阶层、角色住房状态。
- 选择中介模型角色：`model_char_id` 指定优先，否则自动找第一个有 API 配置的角色。
- 调用 LLM，要求输出 JSON `{ title, content, home_id? }`。
- 广告必须包含价格、具体房名或门牌。
- 保存到 `social_housing_ads`。
- 写 city log：`character_id='system'`，`action_type='ANNOUNCE'`，内容 `[中介所广告] title | content`。
- 写 `city_announcements`，`source_type='agency'`。
- 更新中介 `last_ad_at`、`next_ad_at`、清空 `last_error`。
- 广播 `city_update`。

异常情况：

- 没有可用模型：500。
- 没有启用房源：500。
- LLM 输出非法、缺字段、广告不含价格/房源：500。
- 失败会写入 `agency.last_error/last_error_at`。

### 5.12 `POST /api/social-housing/agency/room-assembly`

功能：让中介 AI 生成样板间家具购买和摆放方案。

请求参数：

```js
{
  home: housingTier,
  palette: object,
  furniture: [
    {
      assetId,
      item,
      label,
      style,
      price,
      maxQuantity,
      preferred_dir,
      directional,
      cells,
      size_px,
      constraints?
    }
  ],
  budget: number,
  room: {
    size,
    stage_px,
    constraints
  }
}
```

返回数据：

```js
{
  success: true,
  assembly: {
    budget,
    spent,
    purchases: [{ assetId, quantity }],
    placements: [{ assetId, item, x, y, dir }],
    notes,
    room,
    model,
    ai_character,
    raw_output
  },
  agency
}
```

业务逻辑：

- 选择中介模型。
- 构建房间 ASCII、家具商店、预算、硬约束。
- 调用 LLM 输出 JSON。
- 后端校验素材必须来自 furniture list、预算不能超、placements 可用。
- 不直接写数据库，不直接保存房间；当前前端拿结果写入 localStorage 的像素小屋布局。

异常情况：

- 没有中介模型：500。
- LLM 输出截断/非法 JSON/无可用 placements：500。
- 失败会写 agency `last_error`。

### 5.13 `DELETE /api/social-housing/agency/ads/:id`

功能：删除中介广告。

返回数据：

```js
{ success: true, agency_ads }
```

业务逻辑：

- 删除 `social_housing_ads`。
- 删除对应 city announcement。
- 删除对应 system `ANNOUNCE` city log。

异常情况：

- 广告不存在：404。

## 6. 商业街日志和管理接口

### 6.1 `GET /api/city/logs`

功能：读取商业街活动日志。

请求参数：

```js
?limit=300 | all
```

返回数据：

```js
{
  success: true,
  logs: [
    {
      id,
      char_name,
      char_avatar,
      char_avatar_frame,
      character_id,
      action_type,
      content,
      delta_calories,
      delta_money,
      location,
      timestamp,
      is_summarized,
      is_truncated,
      truncated_original_content,
      quest_review?
    }
  ]
}
```

业务逻辑：

- 从 `city_logs` 查数据，join `characters` 补角色名和头像。
- 按 `timestamp DESC`。
- 会检测普通 LLM 行动日志是否疑似截断；截断则附加 `is_truncated` 和原文。
- 如果日志有关联任务评分记录，会附加 `quest_review`。

异常情况：

- limit 非法：400 `无效的活动记录数量`。
- 数据库失败：500。

前端必须保留：

- 活动按日期分组。
- system 公告类日志不要混进个人活动流。
- 截断/折叠日志可以展开原文和重试。
- 显示 `delta_calories`、`delta_money`。
- 显示任务评分块。

### 6.2 `POST /api/city/logs/:id/reroll`

功能：对折叠或失败的商业街行动日志重新生成文案。

请求参数：

```js
{
  force?: boolean,
  messageId?: number
}
```

返回数据：

```js
{ success: true, log }
```

业务逻辑：

- 校验日志存在。
- system 日志不能 reroll。
- 默认只允许内容为 `【商业街输出折叠】...` 或前端传 `force`。
- 找到角色和地点。
- 调用角色模型重写 `log/chat/diary`。
- 更新 `city_logs.content`。
- 尝试更新对应 `messages` 里的角色消息。
- 如果日志关联任务，会重新跑任务进度评分。
- 广播 `city_update`。

异常情况：

- 无效 ID：400。
- 日志不存在：404。
- system 记录：400。
- 不是折叠/失败日志且未 force：400。
- 角色或地点不存在：404。
- 角色没有模型配置：400，`canRetry:true`。
- 模型输出非法/无可用 log：502 或 500。

### 6.3 `GET /api/city/announcements`

功能：读取公告板。

请求参数：

```js
?limit=50 // 最大 200
```

返回数据：

```js
{
  success: true,
  announcements: [
    {
      id,
      source_type,
      title,
      content,
      location,
      timestamp
    }
  ]
}
```

业务逻辑：

- 从 `city_announcements` 读取，通常包含市长广播、中介广告、任务状态等。
- `source_type='agency'` 是中介广告。
- `source_type='mayor'` 是市长广播。

异常情况：

- limit 非法：400。

### 6.4 `GET /api/city/characters`

功能：读取商业街居民状态。

返回数据：

```js
{
  success: true,
  characters: [
    {
      id,
      name,
      avatar,
      avatar_frame,
      calories,
      city_status,
      location,
      sys_survival,
      sys_city_social,
      is_scheduled,
      city_action_frequency,
      wallet,
      energy,
      sleep_debt,
      mood,
      stress,
      social_need,
      health,
      satiety,
      stomach_load,
      emotion_state,
      emotion_label,
      emotion_emoji,
      emotion_color,
      api_endpoint,
      model_name,
      inventory
    }
  ]
}
```

业务逻辑：

- 从角色表读取城市模拟字段。
- 派生情绪标签、颜色、emoji。
- 附加角色背包。
- 不返回真实 API Key。

异常情况：

- 数据库失败：500。

前端必须保留：

- 居民列表。
- 头像框。
- 钱包、地点、城市状态。
- 体力条。
- 情绪/身体状态。
- 背包可展开。

### 6.5 `GET /api/city/districts`

功能：读取商业街分区。

返回数据：

```js
{
  success: true,
  districts: [
    {
      id,
      name,
      emoji,
      type,
      description,
      action_label,
      cal_cost,
      cal_reward,
      money_cost,
      money_reward,
      duration_ticks,
      capacity,
      is_enabled,
      sort_order
    }
  ]
}
```

业务逻辑：

- 分区影响角色可行动地点、任务目标地点、中介办公室地点、像素商业街语义地点。

异常情况：500。

### 6.6 `POST /api/city/districts`

功能：新增或更新商业街分区。

请求参数：同分区字段。

返回数据：

```js
{ success: true, district }
```

业务逻辑：

- id 为空时后端会根据 name 生成。
- type 默认 `generic`。
- action_label 默认 `前往`。
- emoji 默认 `🏬`。
- 校验体力/金币/持续时间/容量/排序。

异常情况：

- name 为空：400 `缺少名称`。
- 数值非法：400 `分区数值无效`。

### 6.7 `DELETE /api/city/districts/:id`

功能：删除分区。

返回数据：

```js
{ success: true }
```

异常情况：

- 分区不存在：404。

### 6.8 `PATCH /api/city/districts/:id/toggle`

功能：启用/停用分区。

返回数据：

```js
{ success: true, district }
```

业务逻辑：

- 读取当前分区，反转 `is_enabled`。

异常情况：

- 分区不存在：404。

### 6.9 `GET /api/city/config`

功能：读取商业街配置。

返回数据：

```js
{ success: true, config: { [key]: value } }
```

常见 key：

- `dlc_enabled`
- `city_actions_paused`
- `metabolism_rate`
- `inflation`
- `work_bonus`
- `gambling_win_rate`
- `gambling_payout`
- `city_self_log_limit`
- `city_social_log_limit`
- `city_announcement_limit`
- `city_global_log_limit`
- `city_stranger_meet_prob`
- `mayor_enabled`
- `mayor_interval_hours`
- `mayor_model_char_id`
- `city_chat_probability`
- `city_diary_probability`

业务逻辑：

- 配置影响后台自动行为、市长 AI、记忆注入和经济倍率。

异常情况：500。

### 6.10 `POST /api/city/config`

功能：更新单个商业街配置项。

请求参数：

```js
{ key: string, value: string | number | boolean }
```

返回数据：

```js
{ success: true, config }
```

业务逻辑：

- 按 key 类型做范围校验。
- boolean key 会规范成 `'0'` 或 `'1'`。
- 未知 key 会直接保存字符串。

异常情况：

- 缺少 key：400。
- 值非法：400 `城市配置值无效`。

### 6.12 `GET /api/city/economy`

功能：读取经济统计。

返回数据：

```js
{ success: true, stats }
```

业务逻辑：

- 从 city DB 汇总经济相关数据，供管理面板展示。

异常情况：500。

### 6.13 `GET /api/city/schedules/:charId`

功能：读取角色今日日程。

返回数据：

```js
{ success: true, schedule: [] }
```

业务逻辑：

- 查 `city_schedules` 今日记录。
- 返回 JSON 解析后的 schedule。

异常情况：500。

### 6.14 `POST /api/city/schedules/:charId/generate`

功能：手动生成角色今日日程。

返回数据：

```js
{ success: true, schedule }
```

业务逻辑：

- 角色必须存在且有 API endpoint/key。
- 删除今天旧日程。
- 清除生成锁。
- 调用 LLM 生成日程。
- 保存并返回 schedule。

异常情况：

- 角色不存在：404。
- 角色未配置 API：400。
- 生成失败：500。

### 6.15 `POST /api/city/give-gold`

功能：给角色发金币。

请求参数：

```js
{ characterId: string, amount: number } // 1..1000000
```

返回数据：

```js
{ success: true, wallet: number }
```

业务逻辑：

- 增加角色钱包。
- 写 city log `GIFT`。
- 广播钱包同步。
- 触发角色私聊反馈。

异常情况：

- 角色不存在：404。
- 金额非法：400。
- 私聊反馈失败：500。

### 6.16 `POST /api/city/feed`

功能：给角色补体力。

请求参数：

```js
{ characterId: string, calories: number } // 1..4000
```

返回数据：

```js
{ success: true, calories: number }
```

业务逻辑：

- 角色体力最高 4000。
- 如果补完 > 500，`city_status='idle'`，否则 `hungry`。
- 写 city log `FED`。
- 触发角色私聊反馈。

异常情况：

- 角色不存在：404。
- 体力数值非法：400。

### 6.17 `GET /api/city/items`

功能：读取商业街商品库。

返回数据：

```js
{
  success: true,
  items: [
    {
      id,
      name,
      emoji,
      category,
      description,
      buy_price,
      sell_price,
      cal_restore,
      effect,
      sold_at,
      is_available,
      sort_order,
      stock
    }
  ]
}
```

业务逻辑：

- 商品供餐厅、便利店、商场、医院、背包、赠送、任务使用。

异常情况：500。

### 6.18 `POST /api/city/items`

功能：新增或更新商品。

请求参数：同商品字段。

返回数据：

```js
{ success: true, item }
```

业务逻辑：

- id 为空时由 name 生成。
- category 默认由 effect/价格/恢复值推断。
- 校验价格、恢复体力、库存、排序。

异常情况：

- name 为空：400。
- 数值非法：400 `物品数值无效`。

### 6.19 `DELETE /api/city/items/:id`

功能：删除商品。

返回数据：

```js
{ success: true }
```

异常情况：

- 商品不存在：404。

### 6.20 `GET /api/city/inventory/:charId`

功能：读取角色背包。

返回数据：

```js
{ success: true, inventory }
```

业务逻辑：

- 读取 `city_inventory` 并 join 商品信息。

异常情况：500。

### 6.21 `POST /api/city/give-item`

功能：给角色发物品。

请求参数：

```js
{
  characterId: string,
  itemId: string,
  quantity: number // 1..100
}
```

返回数据：

```js
{ success: true, inventory }
```

业务逻辑：

- 校验角色和商品。
- 增加背包数量。
- 写 city log `GIVE_ITEM`。
- 触发角色私聊反馈。

异常情况：

- 角色不存在：404。
- 物品不存在：404。
- 数量非法：400。

### 6.22 `GET /api/city/events`

功能：读取城市事件，包含天气、经济、随机事件。

请求参数：

```js
?all=1 // 可选，返回全部事件；默认只返回活跃事件
```

返回数据：

```js
{
  success: true,
  events: [
    {
      id,
      event_type,
      title,
      emoji,
      description,
      effect_json,
      target_district,
      duration_hours,
      is_active,
      created_at,
      expires_at
    }
  ]
}
```

业务逻辑：

- 默认返回 active events。
- 天气事件前端可解析 `effect_json.weather_preset` 和 `effect_json.weather_intensity`。

异常情况：500。

### 6.23 `POST /api/city/events`

功能：新增城市事件。

请求参数：

```js
{
  type?: 'weather' | 'economy' | 'random' | 'disaster',
  event_type?: string,
  title: string,
  emoji?: string,
  description?: string,
  effect?: {
    district?: string,
    weather_preset?: 'sunny' | 'cloudy' | 'rainy' | 'windy' | 'foggy' | 'stormy',
    weather_intensity?: 'light' | 'comfortable' | 'heavy',
    cal_bonus?: number,
    money_bonus?: number,
    price_modifier?: number,
    cal_modifier?: number
  },
  target_district?: string,
  duration_hours?: number // 1..168
}
```

返回数据：

```js
{ success: true }
```

业务逻辑：

- 校验 duration 和 effect。
- weather 类型会强制补齐天气 preset/intensity。
- 写入 `city_events`。

异常情况：

- title 为空：400。
- 事件数值非法：400。

### 6.24 `DELETE /api/city/events/:id`

功能：删除城市事件。

返回数据：

```js
{ success: true }
```

异常情况：

- ID 非法：400。
- 事件不存在：404。

### 6.25 `GET /api/city/quests`

功能：读取悬赏任务。

请求参数：

```js
?all=1 // 可选，返回全部；默认只活跃任务
```

返回数据：

```js
{
  success: true,
  quests: [
    {
      id,
      title,
      emoji,
      description,
      reward_gold,
      reward_cal,
      reward_item_id,
      difficulty,
      claimed_by,
      target_district,
      source_announcement_id,
      quest_type,
      completion_target,
      status,
      completed_by,
      difficulty_reason,
      is_completed,
      created_at,
      expires_at
    }
  ]
}
```

业务逻辑：

- 默认只返回 active/open 任务。
- 任务可被角色领取、推进、结算。

异常情况：500。

### 6.26 `POST /api/city/quests`

功能：创建悬赏任务。

请求参数：

```js
{
  title: string,
  emoji?: string,
  description?: string,
  reward_gold?: number,
  reward_cal?: number,
  reward_item_id?: string,
  difficulty?: 'easy' | 'normal' | 'hard' | string,
  target_district?: string,
  quest_type?: string,
  completion_target?: number // 1..10，会被市长评分覆盖
}
```

返回数据：

```js
{ success: true, questId }
```

业务逻辑：

- 先校验奖励和目标进度。
- 调用市长 AI 评分任务难度，生成 `targetScore` 和 reason。
- 用评分结果创建 `city_quests`。
- 发布任务公告到公告板。

异常情况：

- title 为空：400。
- 奖励/目标数值非法：400。
- 市长评分失败：500，`canRetry:true`。

### 6.27 `POST /api/city/logs/:id/retry-quest-score`

功能：重试某条行动日志的任务推进评分。

请求参数：路径参数 log id。

返回数据：

```js
{ success: true, review }
```

业务逻辑：

- 只能重试已有 `quest_review` 且 status 为 `error` 的日志。
- 找到日志、角色、任务、领取记录、地点。
- 调用市长 AI 评分这次行动对任务的推进分。
- 更新 `city_quest_progress_reviews`。

异常情况：

- 无效日志 ID：400。
- 没有评分记录：404。
- 评分状态不是 error：400。
- 日志/角色/任务/领取记录不存在：404。
- 市长评分失败：500，`canRetry:true`。

### 6.28 `POST /api/city/quests/:id/claim`

功能：手动让角色领取任务。

请求参数：

```js
{ characterId: string }
```

返回数据：

```js
{
  success: true,
  actionTriggered,
  actionResult,
  actionError
}
```

业务逻辑：

- 校验任务和角色。
- 任务已完成则拒绝。
- 写 `city_quest_claims`。
- 写 system `QUEST` 日志。
- 写公告：某角色已领取任务。
- 广播 city event。
- 如果私聊引擎可用，会异步触发角色私聊回应，让角色知道用户给他分派了任务。这个异步失败会写 system 失败日志，但接口可能已经返回成功。

异常情况：

- 任务 ID 非法：400。
- 缺少 characterId：400。
- 任务/角色不存在：404。
- 任务已完成或不可领取：400。

### 6.29 `POST /api/city/quests/:id/complete`

功能：手动结算角色任务。

请求参数：

```js
{ characterId: string }
```

返回数据：

```js
{ success: true, won: boolean, reason?: string }
```

业务逻辑：

- 校验任务和角色。
- 调用 LLM 生成结算文案：角色日志、系统日志、公告。
- 调用 `resolveQuestCompletion` 判断是否赢得任务。
- 赢得任务：
  - 给角色加 `reward_gold` 和 `reward_cal`。
  - 写角色 `QUEST` 日志。
  - 写 system `QUEST` 日志。
  - 删除源任务公告。
  - 添加任务完成公告。
- 未赢：
  - 写角色和 system 任务日志。
  - 添加任务失效公告。

异常情况：

- ID 非法/缺少 characterId：400。
- 任务/角色不存在：404。
- LLM 结算文案失败：500。
- 任务完成失败：400。

### 6.30 `DELETE /api/city/quests/:id`

功能：删除任务。

返回数据：

```js
{ success: true }
```

业务逻辑：

- 如果任务有 `source_announcement_id`，先删除公告。
- 删除任务。

异常情况：

- ID 非法：400。
- 任务不存在：404。

### 6.31 `POST /api/city/mayor/run`

功能：手动运行市长 AI。

请求参数：无。

返回数据：市长运行结果对象，通常包含执行了哪些调价、事件、任务、公告等。

业务逻辑：

- 强制执行 `maybeRunMayorAI`。
- 市长会根据城市状态做决策：
  - 商品调价。
  - 创建天气/经济/随机事件。
  - 创建悬赏任务。
  - 发布城市广播。
- 执行时会写 `city_items`、`city_events`、`city_quests`、`city_announcements`、`city_logs`。

异常情况：

- 没有可用市长模型或模型调用失败：500。

### 6.32 `DELETE /api/city/logs/clear`

功能：清空商业街活动记录和市长广播类系统消息。

返回数据：

```js
{ success: true, message: '商业街活动记录与市长广播已清空' }
```

业务逻辑：

- 清空 city logs。
- 删除 messages 中 role=system 且 content 类似 `【市长播报】%` 的消息。

异常情况：500。

### 6.33 `DELETE /api/city/data/wipe`

功能：危险操作，清空商业街所有数据。

返回数据：

```js
{ success: true, message: '商业街所有数据已清空' }
```

业务逻辑：

- 调用 city DB 的 wipe all data。
- 删除市长播报系统消息。

异常情况：500。

前端注意：

- 必须有强确认。
- 操作后刷新全部城市数据。

## 7. 像素商业街和行为树接口

这部分不等同于“商业街日志”。当前像素商业街布局主要存 `localStorage`，后端只提供角色列表、模型列表、行为树输入和生成。

### 7.1 本地存储

现有编辑器用到的本地数据包括：

- 商业街布局 items。
- 画布尺寸/滚动舞台配置。
- 行为树配置。
- 行为树状态。
- 皮套 actor 与真实角色绑定。
- 默认快照和 reset backup。

新前端如果重做像素商业街编辑器，必须决定是否继续兼容这些 localStorage key。后端没有提供商业街布局保存接口。

### 7.2 `GET /api/city/characters/:characterId/behavior-models`

功能：用绑定角色的 API URL/Key 拉取模型列表。

返回数据：

```js
{
  success: true,
  models: string[],
  endpoint,
  model_name
}
```

业务逻辑：

- 读取角色 API 配置。
- 调用模型服务的模型列表接口。

异常情况：

- 角色不存在：404。
- 绑定角色没有 URL/Key：400。
- 模型列表请求失败：500。

### 7.3 `POST /api/city/characters/:characterId/behavior-input`

功能：构建行为树输入，不调用模型生成。

请求参数：前端行为 payload，核心结构：

```js
{
  player_event: {
    active,
    actor_role,
    actor_name,
    action,
    action_label,
    action_hint,
    place_id,
    place_label,
    free_text
  },
  world: {
    movement_model,
    movement_rule,
    allowed_place_ids,
    actors,
    actor_binding,
    selected_place,
    places_ordered,
    free_activity_options
  },
  behavior_context,
  behavior_tree
}
```

返回数据：

```js
{
  success: true,
  skeleton,
  input
}
```

业务逻辑：

- 读取角色、私聊上下文、商业街状态、地点、行为树摘要。
- 生成给模型使用的大输入包。
- 不触发小人行动，不写数据库日志。

异常情况：

- 角色不存在：404。
- 构建输入失败：500，可能有 `canRetry:true`。

### 7.4 `POST /api/city/characters/:characterId/behavior-base-branches`

功能：生成基础日常行为枝丫池和互动开场枝丫。

请求参数：同 behavior payload，可附加：

```js
{
  api_endpoint?: string,
  api_key?: string,
  model_name?: string
}
```

返回数据：

```js
{
  success: true,
  skeleton,
  input,
  base_branches,
  base_patches,
  interaction_branches,
  interaction_patches,
  raw_output,
  fallback,
  error
}
```

业务逻辑：

- 构建行为输入包。
- 调用角色模型生成完整行为树 patch。
- 后端只返回 patch，不保存到数据库。
- 前端负责合并 patch 并驱动小人行为。

异常情况：

- 角色不存在：404。
- 模型配置缺失/输出非法/无可用行为步骤：500/502，可能 `canRetry:true`。

### 7.5 `POST /api/city/characters/:characterId/behavior-branch`

功能：根据用户点击或互动生成一次行为分支。

请求参数：同 behavior payload，可附加模型配置。

返回数据：

```js
{
  success: true,
  skeleton,
  input,
  tree_patch,
  branch,
  raw_output,
  fallback,
  error
}
```

业务逻辑：

- 构建行为输入包。
- 调用模型生成单次互动分支和树 patch。
- 不写 city log，不保存行为树。
- 前端合并 patch 后执行动画/气泡/移动。

异常情况：

- 角色不存在：404。
- 模型调用失败或输出非法：500/502。

## 8. 当前页面功能拆解

### 8.1 MCP 实验室必须保留功能

- 搜索源选择：auto、DuckDuckGo、Serper、Tavily、Brave、Bing。
- API Key 保存/替换/清除状态。
- 当前活跃 provider 显示。
- 联网搜索输入和执行。
- 网页抓取输入和执行。
- 搜索结果展示：标题、摘要、链接、来源、抓取正文、原始 API 返回。
- 任务历史：
  - 状态 done/error/running。
  - provider/source。
  - 输出展开。
  - 重跑。
  - 删除。
- 外部知识库：
  - 角色归属选择，全局知识。
  - 标题、来源 URL、正文保存。
  - 关键词搜索。
  - 命中内容、来源、分数展示。
- 状态指标：
  - Tasks。
  - Done。
  - Errors。
  - Docs。
  - Keys。

### 8.2 住房系统必须保留功能

- 顶部统计：
  - 房源数。
  - 稳定居住人数。
  - 无房人数。
  - 欠租人数。
  - 最近租房链路数。
- 无房角色推荐住房：
  - 选择无房角色。
  - 选择启用房源。
  - 推荐住房，跑完整链路。
  - 直接指派住房。
  - 显示链路运行中/结果/失败。
- 最近租房链路：
  - 角色名、房源、状态、阶段。
  - 事件时间线。
  - 看房对话、总结、考虑、决定、签约、错误。
- 房源库：
  - 默认预设房源一键加入。
  - 自定义房源新增/编辑/删除。
  - 启用/停用。
  - 周租、押金、售价、舒适、体面、隐私、排序、描述。
- 已有住房角色：
  - 头像/名称。
  - 钱包、地点、城市状态。
  - 当前住房。
  - 住房状态。
  - 周租。
  - 缴租周期。
  - 下次催租。
  - 欠租次数。
  - 备注。
  - 交房租按钮。
- 中介所 AI：
  - 启用/关闭。
  - 门店名称、顾问名称、门店分区、业务范围。
  - 决策间隔小时。
  - 中介模型角色选择。
  - 人格提示和模板风格。
  - 手动发布广告。
  - 上次广告、下次广告、上次失败。
  - 广告列表、是否已公告、删除广告。
- 样板间组装实验：
  - 选择房源。
  - AI 生成并保存到像素小屋。
  - 显示预算、花费、购买件数、尺寸标尺。
  - AI 失败时保留规则兜底方案。

### 8.3 商业街日志必须保留功能

- tab：实时动态、分区管理。
- 实时动态 overview：
  - 日记记录/活动数。
  - 公告数。
  - 居民数。
  - 当前天气。
- 天气展示：
  - 天气卡。
  - 根据 weather preset/intensity 使用背景图。
- 公告区：
  - 市长广播。
  - 中介广告。
  - 任务/系统公告。
  - 去重显示。
- 个人活动：
  - 按日期分组。
  - 默认只展开最新日期。
  - 社交偶遇样式区分。
  - 截断/折叠内容可展开。
  - 截断/折叠内容可以 reroll。
  - 黑客据点监听内容需要折叠，不直接展示原始私聊。
  - 体力/金币变化。
  - 任务推进评分块。
  - 任务评分失败可重试。
- 居民状态：
  - 头像框。
  - 名称。
  - 情绪标签。
  - 身体状态。
  - 钱包。
  - 地点 + 城市状态。
  - 体力条。
  - energy/sleep_debt/stress/social_need/health/satiety/stomach_load。
  - 背包展开。

### 8.4 商业街管理必须保留功能

- 分区管理：
  - 新增/编辑/删除。
  - 启用/停用。
  - 模板快速填充。
  - 类型、消耗、奖励、容量、排序。
- 商品管理：
  - 新增/编辑/删除。
  - 模板快速填充。
  - 售价、库存、恢复体力、售卖地点。
- 城市配置：
  - 暂停生理流逝。
  - 代谢。
  - 通胀。
  - 打工倍率。
  - 赌博概率/赔率。
  - 市长 AI 配置。
  - 日志上下文配置。
- 管理员操作：
  - 给角色金币。
  - 给角色补体力。
  - 给角色物品。
- 事件/任务：
  - 事件列表和删除。
  - 任务列表。
  - 指派任务给角色。
  - 手动完成任务。
  - 删除任务。
- 市长 AI：
  - 手动运行。
  - 运行结果展示。
- 清空日志。
- wipe 所有城市数据。

### 8.5 像素商业街必须保留功能（如果也要重做）

- 继续读取 `/api/city/characters` 绑定真实角色。
- 皮套 actor 绑定真实角色。
- 行为树模型拉取。
- 行为输入调试。
- 基础行为枝丫生成。
- 互动行为分支生成。
- 本地行为树 patch 合并。
- 本地布局保存和恢复。
- 地点锚点、碰撞线、角色移动/互动气泡。
- 注意：后端不保存商业街布局，现有实现依赖 localStorage。

## 9. 页面设计和适配目标

### 适配目标

必须支持：

- 桌面端：Electron 桌面窗口和浏览器大屏。
- 平板端：中等宽度，左右栏可改为上下堆叠。
- 移动端：至少保证可滚动、文字不溢出、按钮可点击。

建议做响应式：

- 大屏：左侧控制/筛选，右侧结果/列表。
- 中屏：两列变一列半或卡片栅格。
- 小屏：单列，顶部 tab 横向滚动，底部/顶部固定关键操作。

### 当前截图/参考风格

当前没有附带截图。可参考现有项目风格：

- 桌面壳是类 Windows 桌面 app。
- 图标使用 `lucide-react`。
- 现有 UI 偏粉色、玻璃感、像素风混合。
- 商业街和像素世界有明确像素资产。
- 住房系统更适合做成管理工作台，不建议做成营销 landing page。
- MCP 实验室更适合研究工作台/任务控制台。
- 商业街日志更适合“城市活动流 + 公告板 + 居民状态面板”。

建议：

- 保留像素世界、桌面 app 的趣味感，但管理类页面要信息密度高、可扫描。
- 不要把所有信息做成大卡片堆叠，尤其住房和城市管理需要表格/列表/紧凑面板。
- 对长文本使用折叠、滚动容器、详情弹窗。
- 对危险操作使用二次确认。

## 10. 重要业务边界

### 10.1 角色住房逻辑

- 推荐住房只允许无房角色。
- 直接指派也只允许无房角色。
- 已有住房角色要先解除或调整当前住房，不能直接推荐新房。
- 推荐链路可能真实扣钱、真实写住房绑定、真实写 city logs、真实发私聊消息。
- 指派住房可能接口失败但住房已写入，因为失败可能发生在私聊通知阶段，前端失败后必须刷新 bootstrap。

### 10.2 中介 AI 逻辑

- 中介广告必须依赖可用模型。
- 中介广告会写入城市公告和城市日志。
- 删除广告要同步删除城市公告和日志。
- 中介模型选择来自有 API 配置的角色。
- 中介 Key/角色 API Key 不应在前端显示真实值。

### 10.3 商业街日志逻辑

- `content` 是日志正文，不是 `message`。
- system 的 `ANNOUNCE/MAYOR/EVENT` 和 system `QUEST` 更适合公告区。
- 普通角色日志进入个人活动流。
- `is_truncated` 或 `【商业街输出折叠】` 要提供 reroll。
- 黑客据点监听内容不要展示原始私聊内容。

### 10.4 任务逻辑

- 任务创建会调用市长 AI 做难度/目标评分。
- 任务推进评分可能失败，失败记录会附在 log 的 `quest_review`。
- `retry-quest-score` 只重试评分，不重写日志。
- 任务领取会写日志/公告，并可能异步触发私聊回应。

### 10.5 MCP 安全逻辑

- fetch URL 禁止内网和 localhost。
- 外部知识 source_url 也禁止内网和 localhost。
- 搜索 API Key 只保存，不回显。
- MCP 任务属于当前用户，不能显示其他用户任务。

## 11. 给前端 AI 的实现建议

### API client

建议封装：

```js
async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('cp_token') || '';
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Request failed ${response.status}`);
  }
  return data;
}
```

### 状态刷新

- MCP：搜索/抓取/任务重跑/删除后刷新 tasks。
- 住房：任何修改后建议刷新 bootstrap。
- 商业街日志：操作后刷新 logs、announcements、events、characters。
- 城市管理：分区/商品/事件/任务/配置操作后刷新对应列表。

### Loading 和错误状态

必须给这些操作明显 loading：

- MCP 搜索/抓网页/任务重跑。
- 住房推荐链路。
- 住房交租。
- 中介广告生成。
- 样板间 AI 生成。
- 商业街日志 reroll。
- 任务评分重试。
- 市长 AI 运行。
- 日程生成。
- 行为树生成。

错误展示建议：

- `canRetry:true` 的错误显示“可重试”。
- 业务规则错误如已有住房、房源停用，不要显示成系统崩溃。
- LLM 输出非法/截断，提示用户重试。

## 12. 接口保留优先级

P0 必须保留：

- MCP：status、web-config、search、fetch、tasks、knowledge、knowledge/search。
- 住房：bootstrap、housing CRUD、binding、pay-rent、recommend-home、assign-home、agency、publish-ad、ads delete。
- 商业街日志：logs、announcements、events、characters、reroll、retry-quest-score。

P1 建议保留：

- 商业街管理：districts、config、items、give-gold、feed、give-item、quests、events、mayor/run。
- 住房样板间：agency/room-assembly。

P2 如果重做像素商业街则保留：

- behavior-models。
- behavior-input。
- behavior-base-branches。
- behavior-branch。
- localStorage 布局兼容。
