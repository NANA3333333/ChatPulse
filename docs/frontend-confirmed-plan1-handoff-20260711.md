# ChatPulse 前端确定方案 1 交接文档

更新时间：2026-07-11

## 1. 项目与技术栈

- 项目目录：`C:\Users\Nana\Documents\ChatPluse`
- 前端目录：`client`
- 主要源码：`client/src`
- 技术栈：React + Vite + 原生 CSS Modules 风格文件 + lucide-react 图标
- 构建命令：在 `client` 下执行 `npm run build`
- 适配目标：桌面端优先，同时保留平板和移动端响应式；当前新增样式已按现有断点折叠为单列。
- 不能改接口路径和返回契约：所有接口仍使用现有 `/api/...` 后端路由。

## 2. 当前前端目录

- MCP 实验室：`client/src/plugins/mcpLab/McpLabPanel.jsx`、`client/src/plugins/mcpLab/McpLabPanel.css`
- 住房系统：`client/src/plugins/socialHousing/HousingSocialPanel.jsx`、`client/src/plugins/socialHousing/HousingSocialPanel.css`
- 商业街日志：`client/src/plugins/city/CityLog.jsx`、`client/src/plugins/city/CityLog.css`、`client/src/plugins/city/CityManager.jsx`
- 记忆库：`client/src/components/MemoryLibraryPanel.jsx`、`client/src/components/MemoryLibraryPanel.css`
- 设置中心：`client/src/components/SettingsPanel.jsx`、`client/src/components/SettingsPanel.css`
- 登录态校验：`client/src/AuthContext.jsx`
- 相关静态素材：`client/public`

## 3. 必须保留的功能

- 不要把真实业务组件换成静态 preview。`preview.html` 只能作为风格参考。
- MCP 必须保留搜索、抓取、任务记录、外部知识、搜索源 Key 管理。
- 住房系统必须保留房源库、住房绑定、交租、推荐/指派、租房链路、中介所 AI、样板间组装。
- 商业街必须保留实时日志、天气、公告、任务、市长办公室、城市管理抽屉和居民雷达。
- 记忆库必须保留地图视图、维护视图、外部聊天导入、小模型批处理、自动总结、旧库/新版库切换。
- 记忆库维护页不要再展示“遗忘曲线展开列表 / 记忆分类 / 新版来源场景分类 / 新版语义分类”的条目浏览区；这些和前面已有页面功能重复。本页重点放在“导入记忆”和小模型整理总结。
- 记忆库维护页不要展示左侧栏；包括“正式记忆 / 卡片调用 / 待迁移卡片 / 遗忘曲线”统计卡、“记忆引擎状态”卡、角色列表和新旧库切换都不放在维护页左侧。维护页只保留导入记忆和小模型整理总结主流程。
- 设置必须使用 `settings-control-center-v1` 控制中心，不要回到 guided setup v2。
- 任何高风险动作，例如替换记忆、清空数据、删除会话，都必须有明确确认状态。

## 4. 缺失表补齐状态

这些接口是新方案包里提到但示例没有真正接全的重点，当前项目已经补上：

- MCP：`GET /api/mcp-lab/context/:characterId`
- 住房：`POST /api/social-housing/classes`、`DELETE /api/social-housing/classes/:id`
- 住房付款前刷新：`GET /api/wallet/:id`
- 商业街背包：`GET /api/city/inventory/:charId`
- 记忆库导入：保留外部聊天导入（GPT / Gemini / SillyTavern）和小模型总结写入新版记忆/角色的主流程；原生记忆导入导出接口因和现有功能重叠，当前不放前端入口。
- 设置诊断：`GET /api/system/embedding-status`、`GET /api/system/background-queue`、`GET /api/characters/:id/cache-stats`
- 登录态启动校验：`GET /api/auth/me`

## 5. MCP 实验室接口与业务逻辑

### `GET /api/mcp-lab/status`

- 请求参数：无。
- 返回数据：`success`、`name`、`stage`、`search_provider`、`preferred_search_provider`、`web_search_providers`、`tools`。
- 异常情况：401 未登录；500 后端读取配置失败。
- 业务逻辑：读取当前用户 MCP Lab 搜索源配置和工具清单，用于顶部状态、搜索源徽章和工具可用性展示。

### `GET /api/mcp-lab/context/:characterId`

- 请求参数：路径参数 `characterId`。
- 返回数据：`context.character`、`private_window.tail`、`city.recent_logs`、`group_context.groups`、`external_knowledge.docs`、`recent_llm_debug`。
- 异常情况：404 角色不存在；401 未登录；500 上下文构建失败。
- 业务逻辑：把角色私聊窗口、商业街最近日志、所在群聊、外部知识和 LLM debug 聚合到一个只读检查器。前端右侧 Inspector 新增“上下文”页签，选择角色后会自动刷新，也可手动刷新。

### `PUT /api/mcp-lab/web-config`

- 请求参数：`preferred_provider`、`keys`、`clear_ids`。
- 返回数据：保存后的搜索源配置、`saved_key_count`、provider 列表。
- 异常情况：401 未登录；400 provider/key 无效；500 保存失败。
- 业务逻辑：保存联网搜索源与用户级 Key。搜索前若有未保存 Key 会先静默保存。

### `POST /api/mcp-lab/search`

- 请求参数：`query`、`provider`。
- 返回数据：`result.results`、`result.source`、可选 `task`。
- 异常情况：400 缺少 query；401 未登录；500 搜索源调用失败。
- 业务逻辑：立即执行联网搜索，并把结果写入任务记录。

### `POST /api/mcp-lab/fetch`

- 请求参数：`url`。
- 返回数据：抓取状态、正文、content type、可选任务记录。
- 异常情况：400 URL 非法；500 抓取失败。
- 业务逻辑：抓取网页正文，用于前端展示和之后保存到外部知识。

### `/api/mcp-lab/tasks`

- `GET /api/mcp-lab/tasks`：返回任务列表。
- `POST /api/mcp-lab/tasks`：请求 `kind`、`title`、`input`、`run_now`，创建任务并可立即执行。
- `POST /api/mcp-lab/tasks/:id/run`：重新执行任务。
- `DELETE /api/mcp-lab/tasks/:id`：删除任务。
- 业务逻辑：任务轨迹用于右侧 Inspector，不能删除任务输出预览和重新执行按钮。

### `/api/mcp-lab/knowledge`

- `GET /api/mcp-lab/knowledge?character_id=...`：读取外部知识文档。
- `POST /api/mcp-lab/knowledge`：请求 `character_id`、`title`、`source_url`、`source_type`、`content`。
- `POST /api/mcp-lab/knowledge/search`：请求 `character_id`、`query`，返回匹配资料。
- 业务逻辑：角色上下文检查器的 `external_knowledge.docs` 与这里同源，前端应保留保存资料、搜索资料、归属角色选择。

## 6. 住房系统接口与业务逻辑

### `GET /api/social-housing/bootstrap`

- 请求参数：无。
- 返回数据：`classes`、`housing_tiers`、`characters`、`districts`、`agency_model_options`、`agency`、`agency_ads`、`rental_chains`、`rental_chain_events`、`public_agency_announcements`。
- 异常情况：401 未登录；500 任一住房/城市依赖初始化失败。
- 业务逻辑：页面首屏数据源。前端必须保存 `classes`，因为阶层画像增删后只返回 classes。

### `POST /api/social-housing/classes`

- 请求参数：
  - `id` 可选，未传时后端按 name slugify。
  - `name` 必填。
  - `emoji`、`description`。
  - `work_bias`、`consumption_bias`、`prestige_bias`、`social_barrier`，范围由后端校验。
  - `common_locations` 数组。
  - `is_enabled`、`sort_order`。
- 返回数据：`success`、`id`、`classes`。
- 异常情况：400 缺少阶级名称或数值越界；401 未登录；500 保存失败。
- 业务逻辑：用于“阶层与租客画像”面板。画像会影响住房偏好、消费倾向和社交门槛，前端只负责编辑和展示，具体影响在后端租房链路里执行。

### `DELETE /api/social-housing/classes/:id`

- 请求参数：路径参数 `id`。
- 返回数据：`success`、`classes`。
- 异常情况：404 阶层不存在；401 未登录；500 删除失败。
- 业务逻辑：删除阶层后，后端会把绑定到该阶层的住房绑定记录里的 `social_class_id` 清空。

### `GET /api/wallet/:id`

- 请求参数：路径参数 `id`，可以是 `user` 或角色 id。
- 返回数据：`wallet` 数字。
- 异常情况：400 钱包 id 无效；404 角色不存在；401 未登录；500 读取失败。
- 业务逻辑：交租、推荐住房、直接指派住房前必须刷新付款角色钱包，避免前端使用旧余额。

### 住房动作接口

- `POST /api/social-housing/characters/:id/pay-rent`：交租，前端先调 `GET /api/wallet/:id`。
- `POST /api/social-housing/characters/:id/recommend-home`：请求 `home_id`、`run_full_chain`，执行推荐和租房链路。
- `POST /api/social-housing/characters/:id/assign-home`：请求 `home_id`，直接绑定住房。
- `POST /api/social-housing/characters/:id/binding`：更新住房绑定。
- 异常情况：角色/房源不存在、余额不足、后端链路失败。
- 业务逻辑：推荐入口只处理无房角色；已有住房角色在“已有住房”区管理。

### 房源和中介接口

- `POST /api/social-housing/housing`：新增/更新房源。
- `DELETE /api/social-housing/housing/:id`：删除房源，并清空相关绑定。
- `POST /api/social-housing/agency`：保存中介配置。
- `POST /api/social-housing/agency/publish-ad`：手动生成广告。
- `DELETE /api/social-housing/agency/ads/:id`：删除广告记录。
- 业务逻辑：中介 AI 和样板间组装都必须保留，不能为了新布局删掉。

## 7. 商业街日志接口与业务逻辑

### 基础读取接口

- `GET /api/city/logs?limit=all`：读取活动日志。
- `GET /api/city/announcements?limit=50`：读取公告。
- `GET /api/city/events`：读取事件。
- `GET /api/city/characters`：读取城市居民状态。
- `GET /api/city/quests`：读取任务。
- 异常情况：401 未登录；500 城市 DB 初始化或读取失败。
- 业务逻辑：`CityLog.jsx` 每 5 秒同步一次，并监听 `city_update` 事件做延迟刷新。

### `GET /api/city/inventory/:charId`

- 请求参数：路径参数 `charId`。
- 返回数据：`success`、`inventory`，每项通常有 `id`、`name`、`emoji`、`quantity/count`。
- 异常情况：401 未登录；500 背包读取失败。
- 业务逻辑：居民雷达里的背包按钮点击后懒加载。不要在 5 秒轮询中全量拉所有背包。

### `POST /api/city/give-item`

- 请求参数：`characterId`、`itemId`、`quantity`。
- 返回数据：`success`、`inventory`。
- 异常情况：404 角色或物品不存在；400 数量无效；500 送礼失败。
- 业务逻辑：`CityManager.jsx` 送礼成功后派发 `city_inventory_update`，日志页只更新该角色背包。

### 日志动作接口

- `POST /api/city/logs/:logId/retry-quest-score`：重试任务评分。
- `POST /api/city/logs/:logId/reroll`：重生成指定日志。
- `POST /api/city/mayor/run`：手动运行市长 AI。
- 业务逻辑：市长和重生成成功后必须触发 `city_update`。

### 社交参与者展示规则

- 只有 `action_type === SOCIAL` 时才尝试显示第二参与者。
- 只在日志正文/标题中命中“唯一一个非主角色姓名”时显示第二参与者。
- 命中 0 个或多个都按单人日志展示，避免误把多人场景拆错。

## 8. 记忆库接口与业务逻辑

### 现有维护主接口

- `GET /api/memory-maintenance/overview`：读取统计、角色列表、维护设置。
- `GET /api/memory-maintenance/library?...`：读取当前旧库/新版库视图。
- `PUT /api/memory-maintenance/settings`：保存小模型设置。
- `GET /api/memory-maintenance/runs`、`GET /api/memory-maintenance/runs/:id`：读取后台运行记录。
- 业务逻辑：这些是原本核心维护工作流，不要移除。
- 当前前端不渲染 `/library` 返回的分类展开列表和条目卡片；保留接口读取能力用于地图、统计和维护逻辑，避免把重复浏览页重新放回维护页。

### 外部聊天导入主流程

- `POST /api/memory-import/external/preview`
  - 请求参数：multipart/form-data，`file` 可选，`text` 可选，`source_app`，`import_mode`，`target_character_name`。
  - 返回数据：`success`、`import`、`role_tags`、`candidates`、清洗/识别统计。
  - 异常情况：400 小模型未配置、文件格式不可读、没有可总结内容；500 小模型调用失败。
  - 业务逻辑：小模型读取外部聊天记录，识别角色标签，生成新版记忆候选，不直接写入。
- `POST /api/memory-import/external/:importId/commit`
  - 请求参数：`selected_roles` 或等价角色选择字段。
  - 返回数据：`success`、`imported`、`created_characters`、`characters`、`errors`。
  - 异常情况：400 未选择角色或 import 不存在；500 写入失败。
  - 业务逻辑：勾选角色后创建/复用同名角色，并把候选写入新版记忆库。
- `POST /api/memory-import/external/auto-run`
  - 请求参数：外部导入文件/文本、小模型设置、批处理参数。
  - 返回数据：后台自动总结运行结果和进度。
  - 异常情况：小模型未配置、批处理失败、超时或输出格式错误。
  - 业务逻辑：一键导入总结，按批读取外部记录并直接写入新版记忆库。

### 原生记忆接口（当前不做前端入口）

后端仍有 `GET /api/memories/:characterId/export`、`POST /api/memories/:characterId/import`、`POST /api/memories/:characterId/extract`、`GET /api/memories/:characterId/maintenance/stats`、`POST /api/memories/:characterId/maintenance/apply`。这些和现有记忆维护/导出/导入功能重叠，本版 UI 不展示，避免用户误选。

## 9. 设置中心接口与业务逻辑

### 登录态与账号

- `GET /api/auth/me`：启动时校验本地 token；401/403 时清除本地登录态。不要用它替代 `/api/user` 的用户资料读取。
- `GET /api/user`：读取用户资料。
- `PUT /api/user`：保存昵称、头像、横幅、签名等资料。
- `PUT /api/auth/account`：保存账号用户名/密码。
- `GET /api/auth/sessions`：读取会话列表。
- `DELETE /api/auth/sessions/:id`：撤销指定会话。

### 角色配置

- `GET /api/characters`：读取角色列表。
- `POST /api/characters`：保存角色设置。
- `DELETE /api/characters/:id`：删除角色。
- `GET /api/characters/:id/message-stats`：读取消息统计。
- `POST /api/characters/:id/reset-physical-state`：重置角色生理状态。
- `GET /api/data/:id/export`、`POST /api/data/:id/import`：导入/导出单角色数据。

### 模型和声音

- `POST /api/models`：请求 `endpoint`、`key`，拉取模型列表。
- `GET /api/tts/tencent/voices?refresh=1`：拉取腾讯音色。
- `POST /api/tts/preview/:id`：角色 TTS 试听，返回音频 Blob。

### 诊断接口

- `GET /api/system/embedding-status`
  - 返回：`embedding.model`、`dimension`、`extractorState`、`activeCount`、`cacheSize`、`totalFailures` 等。
  - 逻辑：诊断本地 embedding 管线和缓存状态。
- `GET /api/system/background-queue`
  - 返回：`stats.globalConcurrency`、`activeWorkers`、`pendingTasks`、`queues`、`recentTasks`。
  - 逻辑：普通用户只看到自己的后台队列，管理员可看全局。
- `GET /api/characters/:id/cache-stats`
  - 返回：`stats.entries_count`、`hit_count`、prompt block、history window、digest cache 统计。
  - 逻辑：右侧预览区展示当前角色缓存状态。

### 系统备份

- `GET /api/system/export`：导出整库备份。
- `POST /api/system/import`：导入整库备份。
- `POST /api/system/wipe`：清空当前账号数据，必须要求强确认。

## 10. 已确认的前端实现点

- MCP Inspector 新增“上下文”页签。
- 住房新增“阶层与租客画像”面板，并在交租/推荐/指派前刷新钱包。
- 商业街居民雷达背包使用真实 inventory 接口，送礼后只刷新对应角色。
- 记忆库保留“导入记忆”：GPT / Gemini / SillyTavern 外部聊天导入、小模型总结预览、角色勾选、创建角色并写入新版记忆库。
- 设置右侧预览新增 Service diagnostics 卡片。
- AuthContext 启动时会验证 `/api/auth/me`。

## 11. 验证记录

- `npx eslint src/AuthContext.jsx src/plugins/mcpLab/McpLabPanel.jsx src/plugins/city/CityLog.jsx src/plugins/city/CityManager.jsx src/components/MemoryLibraryPanel.jsx src/components/SettingsPanel.jsx`
  - 结果：0 errors。
  - 备注：`MemoryLibraryPanel.jsx` 有 4 个已有 hook dependency warning。
- `npm run build`
  - 结果：通过。
  - 备注：Vite 提示部分 chunk 超过 500 kB，是现有体积提示，不影响产物。
