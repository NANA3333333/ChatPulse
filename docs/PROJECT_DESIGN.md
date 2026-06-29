# ChatPulse 项目设计说明

本文面向开发者和维护者，把当前仓库中的代码逻辑视为既定设计进行整理。它不是用户手册，也不是重构提案；它的目标是说明 ChatPulse 为什么这样组织、每个功能模块负责什么、核心链路如何流转，以及以后扩展时应守住哪些边界。

## 1. 项目定位

ChatPulse 是一个本地优先的 AI 社交模拟应用。它的核心不是“调用模型返回一句话”的聊天壳，而是让多个角色在同一个本地世界里持续生活：

- 角色拥有长期身份，包括人设、模型配置、头像、语音、钱包、身体状态、情绪状态、好感与关系。
- 对话会进入上下文、缓存、摘要、长期记忆、日记、商业街事件等后续系统。
- 角色可以通过私聊、群聊、城市行动、任务、商品、地点、房租、课程、红包和转账产生状态变化。
- AI 生成被视为真实链路的一环。生成失败时系统应暴露失败，让用户重试，而不是用本地默认文本伪造成功。
- 本地 SQLite 是主要事实源，Qdrant 是长期记忆的语义检索索引，前端仅负责展示与交互编排。

项目的设计重心是“可持续上下文”和“角色生活系统”。聊天只是入口，长期记忆、状态变更和跨模块事件才是让角色连续存在的基础。

## 2. 总体架构

### 2.1 运行组件

```text
client/                 React 19 + Vite 前端
server/                 Express 5 API、WebSocket、AI 编排、插件运行时
server/plugins/         可插拔功能模块
scripts/                初始化、开发、迁移、维护脚本
config/qdrant.yaml      本地 Qdrant 配置
data/                   本地认证库、用户业务库、Qdrant 数据目录
server/public/uploads/  用户上传和生成媒体
.runtime/               本地 bundled Node 等运行时
```

前端开发服务默认运行在 `127.0.0.1:5173`，后端默认运行在 `localhost:8000`。开发时可以由 `npm run dev` 同时拉起服务端和 Vite；生产式访问则由后端静态服务 `client/dist`。

### 2.2 数据隔离

ChatPulse 把认证数据和业务数据分开：

- `data/master.db` 保存账号、会话、邀请码、认证事件和全局公告。
- `data/chatpulse_user_<id>.db` 保存某个用户自己的角色、消息、记忆、群聊、商业街、插件数据。
- 每个登录用户通过 `authMiddleware` 解析 JWT 后拿到自己的 `req.db`，后续业务接口只操作该用户数据库。
- 删除用户时需要同时处理认证库记录、用户数据库文件、调度库和相关运行状态，避免跨用户污染。

这种隔离让本地多账号可以共享一个应用进程，但业务世界彼此独立。

### 2.3 服务端职责

服务端当前主要由几个核心文件和插件组成：

- `server/index.js`：进程入口、Express 中间件、上传处理、鉴权、主路由、WebSocket、插件加载、静态文件服务。
- `server/authDb.js`：认证库初始化、账号注册登录、邀请码、会话、封禁、角色权限、公告。
- `server/db.js`：用户业务数据库初始化和主要数据访问层。
- `server/engine.js`：私聊与群聊 AI 编排、RAG 计划、上下文组织、输出解析、主动消息调度。
- `server/memory.js`：长期记忆提取、检索、摘要、整理、扫除、向量索引写入。
- `server/qdrant.js`：Qdrant collection、向量写入、查询和状态检查。
- `server/contextBuilder.js`、`server/utils/*`：上下文窗口、token、共享工具。
- `server/backgroundQueue.js`：后台任务队列、去重、并发限制、状态快照。

架构上，`server/index.js` 仍然承担了较多职责。`docs/ARCHITECTURE.md` 记录了目标边界：新功能应优先放入 route、service、plugin 或 utils，而不是继续扩大入口文件。

### 2.4 前端职责

前端以 `client/src/App.jsx` 为应用壳：

- 管理登录态、当前 tab、当前私聊角色、当前群聊、抽屉、插件面板和全局公告。
- 拉取角色、群聊、用户资料、系统状态等基础数据。
- 建立 WebSocket，接收私聊、群聊、城市、记忆维护、红包等实时事件。
- 通过懒加载组件减少初始加载压力，例如设置面板、记忆库、商业街、像素世界、MCP 实验台。

主要 UI 分布在 `client/src/components/` 和 `client/src/plugins/`。插件入口由 `client/src/plugins.js` 定义，当前可见插件包括 MCP 实验台、管理员后台、住房与社交、像素实装、商业街。

### 2.5 插件机制

后端插件位于 `server/plugins/`，通过初始化函数接收 `app` 和上下文对象，注册自己的路由、数据库扩展、后台逻辑或 hook。常见上下文包括：

- 当前用户数据库获取能力。
- `authMiddleware`、`adminMiddleware`。
- LLM 调用函数与 engine。
- WebSocket 客户端查询和广播能力。
- 上传中间件、备份工具或插件间共享服务。

插件数据一般保存在用户业务库中。插件可以给 `req.db` 挂载自己的子仓库，例如 `req.db.city`、`req.db.socialHousing`、`req.db.mcpLab`。

## 3. 核心数据流

### 3.1 登录与鉴权

1. 用户通过 `/api/auth/register` 或 `/api/auth/login` 提交账号信息。
2. `authDb.js` 校验用户名、密码、邀请码、封禁状态、锁定状态和密码策略。
3. 登录成功后创建 session，并签发包含用户 id、session id、token id、token version 的 JWT。
4. 普通 HTTP 请求通过 `Authorization: Bearer <token>` 鉴权。
5. WebSocket 不把 token 放进 URL，而是在连接后发送显式认证消息。
6. 管理员接口额外要求 root 或 admin 角色。

会话可以被用户自行撤销，也可以被管理员强制登出。账号更新密码或管理员操作会提升 token version，从而让旧 token 失效。

### 3.2 应用启动与基础加载

前端拿到 token 后会加载用户资料、角色列表、群聊列表、公告和插件可见状态。角色列表是私聊、设置、商业街、群聊、记忆库等多数功能的共同入口。

角色数据来自 `/api/characters`，包含：

- 基本人设、系统提示、头像、横幅、emoji。
- 主模型、记忆模型、TTS 模型和相关密钥配置。
- 上下文窗口、最大 token、主动消息开关。
- 钱包、好感、情绪、城市状态、身体状态和调度开关。

前端在选择角色或群聊后，分别加载消息窗口、上下文状态、记忆、日记、设置抽屉等附属视图。

### 3.3 私聊发送链路

私聊是项目的主链路。一次用户发言大致经过：

1. 前端向 `/api/messages` 提交 `characterId` 和文本。
2. 后端校验角色存在、输入合法、用户数据库可用。
3. 用户消息写入 `messages`。
4. engine 构造上下文，包括角色人设、用户资料、最近历史、摘要、RAG 召回、日记、城市细节等。
5. RAG 计划器判断是否切题、是否需要扩展主题、应检索哪些记忆槽位。
6. memory 模块查询 Qdrant、SQLite fallback、词法 fallback 和时间范围记忆。
7. engine 调用角色配置的模型接口，记录 LLM debug log、token usage 和缓存信息。
8. 回复解析结构化标签，例如好感、日记、情绪、商业街意图、转账反应等。
9. AI 回复写入 `messages`，通过 WebSocket 推送给前端。
10. 后台触发记忆提取、摘要更新、TTS 生成或主动消息调度。

如果模型、RAG、JSON 解析或行为树生成失败，本轮应保留错误可见状态。失败不会被替换成“默认成功回复”。

### 3.4 RAG 与记忆召回链路

长期记忆采用 SQLite 正文加 Qdrant 向量索引：

- SQLite 保存记忆正文、摘要、分类、来源、人物、物品、关系、时间锚点、遗忘状态、维护状态。
- Qdrant 保存向量和必要 payload，用于语义召回。
- 本地 `vectra` 只作为显式开启的兼容路径，实时链路默认优先 Qdrant。

检索前，engine 会根据最新发言和近期历史生成检索计划。计划可能包含多个 slot，例如用户画像、关系、事实事件、近期时间范围、商业街上下文。每个 slot 会生成查询文本、过滤条件和召回限制。

memory 模块会合并以下信号：

- Qdrant 语义分数。
- SQLite 正文和摘要的词法匹配。
- 别名、人物、物品、关系字段的桥接加权。
- 时间意图和记忆时间锚点。
- 记忆层级、保留分、最近有用时间。
- 反向惩罚，例如明显矛盾或不相关的回忆。

最终召回结果会被压缩成可读上下文，而不是直接把数据库行粗暴塞进 prompt。

### 3.5 记忆提取、维护与导入

记忆不只来自私聊。群聊、日记、商业街日志、外部聊天记录都可能进入记忆系统。

主要流程包括：

- 实时或手动从最近上下文提取结构化记忆。
- 按正式记忆、来源卡片、外部导入、群聊来源等维度查看。
- 外部聊天记录预览、角色识别、分批转换、提交绑定。
- 小模型维护：分类、补全文摘、合并、归档、遗忘曲线、时间绑定。
- Qdrant 索引刷新和迁移。

维护任务通常可能耗时，前端会通过记忆库面板和 WebSocket 进度事件展示状态。

### 3.6 WebSocket 与实时事件

WebSocket 是“生成结果”和“后台系统变化”回到前端的主要通道。典型事件包括：

- 私聊新消息、错误、重试结果。
- 群聊消息、群成员 typing、红包领取。
- 商业街日志、角色状态、日程生成、任务变化。
- 记忆维护进度。
- 角色数据清空、插件状态刷新。

前端根据当前 tab、当前角色、当前群聊和事件类型决定是立即展示、放入未读队列，还是刷新列表。

### 3.7 后台队列与定时任务

项目有大量潜在后台工作：主动消息、群聊主动发言、城市 tick、城市社交遭遇、日程生成、记忆整理、外部导入。为了避免本地开发环境被后台任务拖慢，后台任务通过 `backgroundQueue.js` 做基本限流：

- 每个 key 有独立队列。
- 可以用 dedupeKey 避免重复任务。
- 有全局并发上限。
- 队列状态可通过 `/api/system/background-queue` 查看。
- `CP_SAFE_MODE` 会降低或关闭部分商业街自动行为强度。

## 4. 功能模块设计

### 4.1 账号与权限

账号系统由认证库统一管理。它提供本地注册、登录、会话、邀请码、管理员权限、封禁、强制登出、重置密码和全局公告。

设计要点：

- 认证库和用户业务库分离。
- JWT 只证明身份和 session，不承载业务数据。
- 管理员接口必须同时通过登录鉴权和角色鉴权。
- WebSocket 认证不通过 URL 传 token，避免日志泄漏。
- 用户删除需要延迟清理可能仍被占用的数据库资源。

### 4.2 角色与私聊

角色是系统最重要的业务实体。一个角色同时是：

- 聊天对象。
- 模型配置容器。
- 长期记忆 owner。
- 关系与情绪主体。
- 商业街居民。
- 日记、TTS、钱包、课程和住房的参与者。

私聊界面支持消息重试、批量删除、清空角色数据、消息级 TTS、转账卡片、RAG 状态展示和连续同类 API 错误折叠。

角色配置中的 API endpoint、key、model name、max tokens、context limit、memory model、TTS 语音等字段直接影响生成链路。更新角色时必须保留未修改的 secret 字段，避免前端掩码覆盖真实值。

### 4.3 情绪、关系与印象

关系系统分为用户与角色、角色与角色两层：

- 角色对用户有好感、拉黑状态、嫉妒等私聊关系信号。
- 角色之间有 `char_relationships` 和印象历史。
- 好友推荐会初始化角色间关系。
- 群聊、商业街社交遭遇、推荐重算都可能更新角色间好感和印象。

关系变化必须由明确事件触发，并且要限制数值范围。AI 返回的好感增量或印象必须被解析和校验，解析失败时应让本轮失败可见。

### 4.4 长期记忆

长期记忆是“角色连续性”的事实层。它承担四件事：

- 记录：从聊天和生活事件中提取可复用事实。
- 检索：按当前语境找回相关事实。
- 维护：整理、归档、合并、补全、时间绑定。
- 解释：让前端展示记忆来源、分类、保留状态和使用痕迹。

记忆库分为新版正式记忆视图和来源卡片视图。正式记忆面向长期召回，来源卡片保留原始上下文和证据。遗忘不是直接删除，而是通过保留分、归档、宽限期等字段管理。

### 4.5 秘密日记

日记是角色私密表达层，使用角色密码解锁。

这个模块的价值不只是 UI 展示：

- 日记可以作为角色隐藏状态和情绪连续性的输入。
- 删除或清空角色数据时，日记也需要随角色一并处理。

### 4.6 群聊

群聊由 `server/plugins/groupChat` 提供。它支持创建群、编辑群、增删成员、群消息、AI 回复、批量删除、暂停 AI、无链模式和按群配置的主动消息。

群聊生成不同于私聊：

- 每个 AI 成员需要判断是否应该发言。
- 被 @ 的角色优先响应，未被提及的角色不能无限接话。
- 群聊会注入成员关系、近期群消息、角色私聊摘要和红包等上下文。
- AI 回复可触发角色间好感变化、对用户好感变化、群红包发送和记忆提取。

群聊失败同样不能伪造成成功。解析好感标签、红包标签失败时，应返回错误或停止相关副作用。

### 4.7 经济系统

经济系统由用户钱包、角色钱包、私聊转账、群红包和商业街金币共同组成。

主要规则：

- 私聊转账先创建 transfer 记录，再以消息卡片形式展示。
- 领取、退款、重复领取都必须校验状态和参与者。
- 群红包支持普通和拼手气，领取记录与钱包联动。
- 商业街奖励、消费、管理员赠与也写入角色钱包和城市日志。

金额必须是正数并限制精度。所有钱包变化都应有可追踪事件，避免只改余额不留上下文。

### 4.8 商业街

商业街是项目里的生活模拟系统，由 `server/plugins/city` 及其 routes、services、db 共同实现。它把角色从“聊天对象”扩展成“城市居民”。

核心对象包括：

- 角色状态：金币、位置、体力、饱腹、压力、心情、健康、睡眠债、胃负担、工作分心、睡眠干扰。
- 地点与区域：商业街地点、区域启用状态、地点模板。
- 商品与库存：食物、礼物、医疗、课程相关物品。
- 日程：每天每个角色的行动计划。
- 日志：工作、购物、进食、医疗、休息、学习、任务、社交、系统广播。
- 公告与事件：市长 AI 或管理员创建的城市动态。
- 任务：公告任务领取、推进、评分、完成、奖励、失败。
- 社交遭遇：同地点角色之间的对话、关系变化和印象更新。

商业街的自动行为由 cron 和后台队列驱动。每次 tick 会按角色状态、日程、地点、任务和安全模式决定是否行动。角色在城市中产生的事件可以回流到私聊上下文，私聊中用户也可以询问或影响城市状态。

### 4.9 市长 AI 与任务系统

市长 AI 是商业街的系统级 LLM 角色，用于生成事件、任务、广播、价格调整和任务评分。它不是普通聊天角色，而是城市调度器。

任务系统分为：

- 任务发布：事件或市长 AI 生成任务。
- 领取：角色或用户选择任务参与者。
- 推进：角色行动或用户汇报产生进度。
- 评分：AI 判断是否完成以及完成质量。
- 结算：发放金币、物品、状态变化和日志。

任务评分失败时不应直接给奖励。必须让失败可见，或者允许重试评分。

### 4.10 像素世界

像素世界是商业街的可视化和行为树实验面板，主要在前端 `client/src/plugins/pixelWorld/PixelWorldPanel.jsx` 和静态资源中实现。

它承担两类职责：

- 可视化街区：建筑、道路、装饰、天空、图层、地点锚点、保存布局、复制 JSON。
- 行为树实验：基础枝丫、特殊互动枝丫、后续枝丫、输入输出调试、patch 预览。

基础枝丫用于没有玩家互动时的日常行为。特殊枝丫用于玩家靠近角色后的互动。后续枝丫会携带当前树和最近特殊互动上下文。为了避免模型复读，特殊互动有防重复检测，疑似重复时返回可重试错误。

### 4.11 住房与社交

住房社交插件提供职业阶层、房源、角色绑定、租金支付、中介设置和房源广告。

设计上，它把角色从“城市里的行动者”进一步绑定到社会身份：

- 职业和阶层影响角色身份说明。
- 房源影响居住地点、租金和生活背景。
- 中介广告可以通过 AI 生成公共宣传内容。
- 支付房租会扣角色钱包并写城市日志。

住房插件会复用 city 数据库能力，以便房源和商业街地点保持关联。

### 4.12 成长课程

城市成长插件提供课程管理和角色课程进度。课程配置包含名称、价格、持续时间、消耗和恢复效果等字段。

课程设计服务于两个方向：

- 作为商业街行动的一部分，角色可以通过学习影响长期能力。
- 作为前端管理面板，用户可以配置课程并查看角色掌握情况。

课程系统不直接替代角色人设，而是为状态与成长提供结构化补充。

### 4.13 MCP 实验台

MCP 实验台是实验性联网工具层，不是默认自动工具调用层。

它提供：

- 搜索 provider 配置，包括 auto、DuckDuckGo、Serper、Tavily、Brave、Bing。
- URL 抓取和结果预览。
- 任务创建、执行、重跑、删除。
- 知识条目保存和检索。
- 与角色上下文的弱关联。

联网工具的输出应作为用户可见资料或知识库内容，而不是悄悄进入主聊天链路。

### 4.14 固定外观与媒体

ChatPulse 默认使用当前粉色像素主题，不再提供主题样式编辑器、AI 主题生成或自定义 CSS 注入。

用户仍可配置头像、角色头像、横幅和上传媒体。上传媒体必须走鉴权读取，避免把用户私有图片暴露为公共静态资源。

### 4.15 备份与恢复

备份插件提供系统导出、导入和擦除。角色包导入导出则在主路由中处理，覆盖聊天、记忆、日记以及可重建 Qdrant 索引的数据。

安全规则：

- zip 导入必须防路径穿越。
- 上传文件必须限制类型和内容。
- 导入前应清理目标角色相关数据，避免旧数据和新数据混合。
- 重建向量索引应以 SQLite 正文为事实源。

### 4.16 管理后台

管理员后台用于本地多用户管理：

- 查看用户和邀请码。
- 创建、停用、续期、删除邀请码。
- 删除用户、封禁、改角色、重置密码、强制登出。
- 查看 Qdrant 状态。
- 发布全局公告。

管理员操作必须写入认证库或对应用户数据，并避免直接绕过业务清理路径。

## 5. 数据与接口地图

### 5.1 认证库表组

`master.db` 主要包含：

- `users`：账号、密码哈希、角色、状态、token version、登录状态。
- `user_sessions`：登录会话、token id、过期时间、撤销状态。
- `auth_events`：认证事件审计。
- `invite_codes`：邀请码、使用次数、过期、状态。
- `announcements`：全局公告。

### 5.2 用户业务库表组

用户库主要包含：

- 角色与聊天：`characters`、`messages`、`message_tts`。
- 记忆：`memories`、`external_memory_imports`、`external_memory_role_bindings`。
- 私密内容：`diaries`。
- 用户资料：`user_profile`。
- 关系：`character_friends`、`char_relationships`、`char_impression_history`。
- 群聊：`group_chats`、`group_members`、`group_messages`。
- 经济：`private_transfers`、`group_red_packets`、`group_red_packet_claims`。
- 缓存和统计：`token_usage`、`llm_cache`、`llm_cache_stats`、`prompt_block_cache`、`history_window_cache`、`conversation_digest_cache`、`group_conversation_digest_cache`、`private_context_summaries`。
- 调试日志：`emotion_logs`、`llm_debug_logs`、`reply_dispatch_logs`。

插件扩展表包括：

- 商业街：`city_logs`、`city_announcements`、`city_districts`、`city_config`、`city_items`、`city_inventory`、`city_schedules`、`city_events`、`city_quests`、`city_quest_claims`、`city_quest_progress_reviews`、`city_action_guard`、`city_social_guard`。
- 住房社交：`social_housing_classes`、`social_housing_homes`、`social_housing_bindings`、`social_housing_agency`、`social_housing_ads`。
- 成长课程：`city_school_courses`、`city_character_courses`。
- MCP 实验台：`external_knowledge_docs`、`external_knowledge_chunks`、`mcp_lab_tasks`。
- 调度器：`scheduled_tasks`。

### 5.3 API 路由族

主服务和插件按路由族划分能力：

- `/api/auth/*`：注册、登录、当前用户、登出、会话、账号更新。
- `/api/admin/*`：用户、邀请码、封禁、角色、密码、强制登出、公告、Qdrant 状态。
- `/api/user`、`/api/user/memory-status`：用户资料、钱包、记忆后端状态。
- `/api/upload`、`/api/media/uploads/*`：图片上传和鉴权访问。
- `/api/characters*`：角色 CRUD、生成角色、状态重置、上下文统计、缓存统计。
- `/api/messages*`：私聊消息、发送、重试、批量删除、清空。
- `/api/models`：模型列表代理。
- `/api/tts/*`：音频读取、腾讯音色列表、TTS 预览。
- `/api/memories*`、`/api/memory-*`：记忆查看、导入导出、提取、整理、时间绑定、外部导入、记忆库视图。
- `/api/diaries*`：日记读取、解锁、删除。
- `/api/groups*`：群聊、成员、消息、AI 暂停、无链模式、按群主动消息、红包。
- `/api/transfers*`、`/api/wallet/*`：私聊转账、领取、退款、钱包。
- `/api/city*`：商业街日志、角色、地点、商品、库存、日程、事件、任务、市长 AI、行为树。
- `/api/city-growth*`：课程和角色课程状态。
- `/api/social-housing*`：阶层、房源、绑定、房租、中介广告。
- `/api/mcp-lab*`：搜索、抓取、任务、知识库、provider 配置。
- `/api/system/export`、`/api/system/import`、`/api/system/wipe`：备份、恢复、擦除。
- `/api/system/background-queue`、`/api/system/embedding-status`：运行诊断。
- `/api/scheduler*`：角色定时任务。

### 5.4 前后端接口约定

前端请求应带认证头，后端返回 JSON。对于长任务，HTTP 返回启动结果或当前快照，实时进度由 WebSocket 事件补充。对于文件下载和音频播放，后端负责鉴权和路径解析。

接口失败时应返回明确错误。前端可以展示错误、重试按钮或折叠连续同类错误，但不应把失败渲染成成功内容。

## 6. 失败、安全与一致性约定

这些约定属于产品设计，不是临时修补：

- AI 回复失败、RAG 计划失败、JSON 解析失败、行为树 patch 失败时，本轮失败应可见。
- 不用默认回复、默认记忆、默认行为树 patch 或本地改写伪造成功。
- 写入副作用必须发生在关键生成和解析成功之后。
- 输入数值必须限制范围，例如金币、红包金额、课程价格、体力、状态值、分页 limit。
- 所有跨用户数据访问必须依赖当前 `req.user` 和用户独立数据库。
- 上传、导入、备份恢复必须防路径穿越和不可信文件类型。
- secret 字段更新时要支持掩码保留，避免把显示用掩码写回数据库。
- 后台任务需要去重和限流，不能在请求线程中执行无法预估耗时的大工作。
- Qdrant 是索引，不是事实源。索引损坏时应从 SQLite 重建。

## 7. 开发与维护

### 7.1 常用命令

```bash
npm run setup
npm run dev
npm run doctor
npm run migrate:qdrant
npm run cleanup:city-memories
npm --prefix client run lint
npm --prefix client run build
npm --prefix server test
```

`npm run doctor` 用于检查依赖、目录、SQLite native module 和 Qdrant 可达性。`npm --prefix server test` 是当前主要 smoke test，覆盖权限边界、输入校验、路径安全、失败可见性和关键业务规则。

### 7.2 Qdrant 与记忆索引

本地 Qdrant 可以通过 `docker compose up -d` 启动。历史记忆迁移或重建索引使用：

```bash
npm run migrate:qdrant
npm run migrate:qdrant -- --dry-run
npm run migrate:qdrant -- --user <userId>
npm run migrate:qdrant -- --character <characterId>
```

如果 Qdrant 不可用，系统仍应尽量保持基础聊天可运行，但长期语义召回能力会下降。实时聊天不应在用户请求现场做沉重的索引自愈。

### 7.3 扩展原则

新增功能时优先遵守以下原则：

- 新 HTTP 路由优先放入 route 模块或插件，不继续扩大 `server/index.js`。
- 新长任务走后台队列或调度器，不阻塞请求。
- 新 LLM 能力要有明确 prompt builder、解析器和校验规则。
- 新插件应拥有自己的数据库初始化、路由、前端面板和边界，不直接侵入其他插件内部。
- 新前端功能应尽量拆为面板、section、hook 或 API helper，避免继续扩大 `App.jsx` 和大型设置组件。
- 新数据应明确事实源。如果需要向量检索，SQLite 保存正文，Qdrant 保存索引。

### 7.4 当前维护重点

当前仓库仍有几个大文件承载大量职责，包括 `server/index.js`、`server/engine.js`、`server/memory.js`、`server/db.js`、`server/plugins/city/index.js`、`client/src/App.jsx`、`client/src/components/SettingsPanel.jsx`。维护时不需要一次性重构，但触碰相关功能时应顺手把新逻辑放到更窄的位置。

商业街已经开始拆出 `routes/`、`services/` 和 `utils/`。后续 city 功能应优先进入这些目录：

- route 处理 HTTP 入参和响应。
- service 执行业务规则和 LLM 编排。
- db 模块封装表结构和持久化。
- utils 只放共享校验或纯函数。

## 8. 文档阅读顺序

建议新维护者按以下顺序理解项目：

1. 阅读 `README.md`，确认运行方式和功能概览。
2. 阅读本文，建立系统设计和模块地图。
3. 阅读 `docs/ARCHITECTURE.md`，了解目标边界和重构优先级。
4. 从 `server/index.js`、`server/db.js`、`server/engine.js`、`server/memory.js` 理解主链路。
5. 按需要进入具体插件，例如 `server/plugins/city`、`server/plugins/groupChat`、`server/plugins/mcpLab`。
6. 前端从 `client/src/App.jsx`、`client/src/plugins.js` 和对应面板组件进入。

只要记住一个核心原则：ChatPulse 的每次生成都应留下可追踪的状态变化，任何失败都不应被悄悄包装成成功。这个原则贯穿聊天、记忆、商业街、群聊和所有插件。
