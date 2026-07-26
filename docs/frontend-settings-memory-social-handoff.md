# 设置、记忆库、社交前端重做交接文档

本文档给新的前端实现方使用，覆盖 ChatPulse 当前「设置」「记忆库」「社交/聊天」三大模块。重点是：现有项目目录、技术栈、适配目标、前端必须保留的功能、接口列表、请求参数、返回数据、异常情况，以及接口背后的业务逻辑。

不要把这里当成视觉稿照抄。前端可以重新设计布局和交互，但不要改接口语义，不要漏掉副作用：很多接口会触发 WebSocket、LLM 调用、缓存清理、向量索引更新、角色计时器重排。

## 1. 项目和技术栈

### 当前技术栈

- 前端：React 19、Vite 6、lucide-react、react-force-graph-2d。
- 后端：Node.js、Express、SQLite、WebSocket。
- 存储：每个用户一份 SQLite；长期记忆存 SQLite，同时可同步到 Qdrant，Qdrant 不可用时走本地向量兜底。
- 鉴权：JWT token 存在 `localStorage.cp_token`，用户信息存在 `localStorage.cp_user`。
- API 基址：`VITE_API_URL`，默认是当前域名的 `/api`。
- WebSocket：`VITE_WS_URL`，默认是当前域名 `/ws`。
- 上传素材：头像、备份导入、记忆导入等使用 `FormData`。

### 通用请求规则

- 所有 `/api/*` 私有接口都需要 `Authorization: Bearer <cp_token>`。
- `client/src/main.jsx` 已经全局拦截 `fetch` 并自动注入 token，但新前端建议仍在关键请求里显式带 `Authorization`，尤其是文件上传、下载、音频、Blob。
- JSON 请求统一带 `Content-Type: application/json`。
- 常规错误形态通常是 `{ "error": "message" }`，部分业务接口是 `{ "success": false, "error": "message" }`。
- 下载/音频接口不是 JSON：导出接口返回文件流，TTS 音频返回音频字节。

### 当前前端目录

- `client/src/components/SettingsPanel.jsx`
  设置页主文件，包含用户资料、账号、角色配置、模型列表、TTS、上传、系统备份入口。
- `client/src/components/MemoryLibraryPanel.jsx`
  记忆库主文件，包含记忆状态、维护概览、记忆分类/自动总结、时间标签补充、外部导入、批量编辑/删除/抢救。
- `client/src/components/ContactList.jsx`
  联系人列表。
- `client/src/components/ChatWindow.jsx`
  私聊窗口，加载/发送/分页/重试/批删/转账/推名片。
- `client/src/components/GroupChatWindow.jsx`
  群聊窗口，群消息、群设置、成员管理、暂停 AI、红包。
- `client/src/components/CreateGroupModal.jsx`
  建群弹窗。
- `client/src/components/AddCharacterModal.jsx`
  快速创建角色弹窗。
- `client/src/components/ChatSettingsDrawer.jsx`
  私聊侧边设置抽屉，关系、日程、上下文统计、调试日志、导入导出、清扫记忆、重置状态。
- `client/src/components/MemoTable.jsx`
  单角色记忆表。
- `client/src/components/DiaryTable.jsx`
  单角色日记表。
- `client/src/components/MessageBubble.jsx`
  聊天气泡，包含 TTS、转账卡片、商业街折叠日志、联系人卡片等解析。
- `client/src/components/TransferModal.jsx`
  私聊转账弹窗。
- `client/public/assets/*`
  前端素材目录，包含桌面图标、像素素材、天气素材等。
- `client/package.json`
  前端依赖和脚本。

### 当前后端目录

- `server/index.js`
  核心 API：登录、用户资料、角色、消息、记忆、日记、TTS、数据导入导出、上下文统计等。
- `server/plugins/groupChat/index.js`
  群聊接口和群 AI 接龙逻辑。
- `server/plugins/economy/index.js`
  钱包、转账、红包接口。
- `server/plugins/relationships/index.js`
  好友、角色间关系、印象历史、重新生成印象。
- `server/plugins/backup/index.js`
  系统备份导出、导入、清空。
- `server/memoryMaintenanceService.js`
  记忆维护、分类、批处理、外部导入的核心逻辑。
- `server/memoryInputGuards.js`
  记忆库请求参数校验。
- `server/db.js`
  SQLite schema 和业务写入方法。

### 适配目标

- 桌面端优先：ChatPulse 主界面和桌面壳都以桌面操作为主。
- 平板端需要可用：抽屉、双栏/三栏布局需要能折叠。
- 移动端需要响应式：不要让联系人列表、侧边设置抽屉、记忆库批处理表格横向溢出；移动端可以改为 tab/底部栏/分步面板。
- 必须保留实时更新：新消息、群消息、钱包同步、记忆维护进度、记忆更新等都来自 WebSocket。

## 2. 必须保留的前端行为

- 登录态必须继续使用 `localStorage.cp_token` 和 `localStorage.cp_user`。
- WebSocket 连接后必须发送 `{ type: "auth", token }`。
- 需要处理这些 WebSocket 事件：
  - `new_message`：私聊新消息。
  - `group_message`：群聊新消息。
  - `group_typing` / `group_typing_stop`：群成员输入态。
  - `wallet_sync`：用户和角色钱包同步。
  - `refresh_contacts`：刷新联系人。
  - `character_deleted`：角色被删除。
  - `redpacket_claim`：红包领取状态更新。
  - `memory_update`：某角色记忆更新。
  - `memory_maintenance_progress`：记忆维护/外部导入后台任务进度。
  - `tts_ready`：TTS 音频就绪。
  - `city_update`：商业街状态更新，社交页可只触发联系人刷新。
- API key 不要明文回显。后端会返回 `*_configured`、`*_last4` 并把原 key 清空；前端应显示“已配置/末四位”，用户留空时表示保留旧 key，勾选清除时传 `field_clear: true`。
- 修改角色 `context_msg_limit` 后，后端会清理私聊摘要和历史窗口缓存。前端不需要自己清，但应提示“影响后续上下文窗口”。
- 删除角色、深度清空角色数据、系统清空数据必须二次确认。
- 记忆批量删除/归档会更新向量索引并广播 `memory_update`，前端要刷新对应角色。
- 记忆维护后台任务不要靠 HTTP 轮询独立实现一套；优先监听 `memory_maintenance_progress`，必要时再用 runs 接口补状态。

## 3. 设置模块

### 3.1 现有功能

设置页目前承担四类工作：

- 用户资料：昵称、头像、头像框、横幅、签名、钱包显示、项目使用天数。
- 账号安全：改用户名、改密码，成功后后端会签发新 token，并撤销旧会话。
- 角色配置：角色名称、头像、人格、世界观、主模型、记忆模型、最大输出、主动消息间隔、主动/定时/压力/嫉妒/商业街参与开关、钱包、情绪/生理相关字段、上下文窗口、TTS。
- 数据和备份：头像上传、角色删除、角色深度清空、系统备份导入/导出/清空、角色生成。

### 3.1.1 已确认的设置布局方案

设置页不要再做“新手任务/引导式 setup”布局。当前确认采用第一版「设置与角色中心」控制中心结构，但必须接真实数据，不要复制原型里的示例角色、示例 key、示例任务。

默认进入设置时打开 `角色配置`，不是概览页。整体结构：

- 左侧分类导航：个人资料、账号安全、角色配置、模型与声音、备份与迁移。
- 中间主工作区：当前分类的表单和操作。`角色配置` 与 `模型与声音` 共用同一个角色工作台，点击 `模型与声音` 时直接切到角色工作台里的 `模型能力` tab。
- 右侧实时预览：显示当前选中角色或正在编辑草稿的头像、就绪状态、人设摘要、模型/记忆/TTS 检查，以及保存后会产生的副作用提示。

角色工作台必须保留 5 个内部 tab：

- `基础人设`：角色 ID、名称、头像/上传、头像框、persona、world_info、system_prompt。
- `模型能力`：主模型 endpoint/key/model/max_tokens，记忆模型 endpoint/key/model，摘要阈值，获取模型列表。
- `行为与上下文`：主动消息、定时、压力、生理、嫉妒、商业街参与、商业街相遇、LLM debug、间隔、上下文窗口、钱包/好感/体力/压力/睡眠/心情等数值。
- `声音`：TTS 开关、provider、触发方式、凭据、音色、模型/档位、endpoint/region、自动播放、Blob 试听。
- `角色数据`：单角色导出、导入替换、导入合并、重置身体状态、深度清空角色数据、永久删除角色。

当前项目已经把这些真实接口接入到 `client/src/components/SettingsPanel.jsx`，包括：

- `/api/user`、`/api/auth/account`、`/api/auth/sessions`、`DELETE /api/auth/sessions/:id`
- `/api/characters`、`DELETE /api/characters/:id`、`POST /api/characters/:id/wipe-data`
- `/api/characters/:id/message-stats`
- `/api/models`、`POST /api/characters/:id/models`
- `/api/tts/preview/:id`
- `/api/data/:id/export`、`POST /api/data/:id/import?mode=replace|merge`
- `POST /api/characters/:id/reset-physical-state`
- `/api/system/export`、`POST /api/system/import`、`POST /api/system/wipe`
- `/api/upload`

Secret 字段的前端规则必须一致：后端不会回传明文 key，只回传 `*_configured` 和 `*_last4`；输入框留空表示保留旧 key；用户主动清除时传 `*_clear: true`；绝对不要把 `••••abcd` 这类掩码当成新 key 保存。

### 3.2 用户资料和账号接口

#### `GET /api/user`

作用：加载当前用户资料。

请求参数：无。

返回数据：

```json
{
  "name": "Nana",
  "username": "nana",
  "avatar": "/api/media/uploads/xxx.png",
  "avatar_frame": "none",
  "banner": "",
  "bio": "",
  "wallet": 520,
  "role": "user",
  "created_at": 1710000000000,
  "serper_api_key": "",
  "serper_api_key_configured": true,
  "serper_api_key_last4": "abcd",
  "web_search_keys_json": "",
  "web_search_keys_json_configured": false,
  "memory_maintenance_api_key": "",
  "memory_maintenance_api_key_configured": true
}
```

后端逻辑：

- 从用户 SQLite 的 `user_profile` 读取资料。
- 合并账号表里的 `username`、`role`、`created_at`。
- 对 `serper_api_key`、`web_search_keys_json`、`memory_maintenance_api_key` 做脱敏。

异常：

- `401` token 无效或过期。
- `500 { error }` 数据库异常。

#### `POST /api/user`

作用：保存用户资料。当前设置页使用这个接口。

请求参数：

```json
{
  "name": "Nana",
  "avatar": "/api/media/uploads/xxx.png",
  "avatar_frame": "gold",
  "banner": "",
  "bio": "签名",
  "group_msg_limit": 80,
  "private_msg_limit_for_group": 20,
  "wallet": 520,
  "web_search_provider": "serper",
  "serper_api_key": "",
  "serper_api_key_clear": false,
  "web_search_keys_json": "",
  "memory_maintenance_api_endpoint": "https://api.openai.com/v1",
  "memory_maintenance_api_key": "",
  "memory_maintenance_api_key_clear": false,
  "memory_maintenance_model_name": "gpt-4o-mini",
  "memory_maintenance_batch_size": 30,
  "memory_maintenance_max_tokens": 8000
}
```

返回数据：

```json
{
  "success": true,
  "profile": { "name": "Nana", "username": "nana", "avatar": "...", "api_key_configured": true }
}
```

后端逻辑：

- 只更新白名单字段。
- 钱包限制为 `0..1000000000`。
- `memory_maintenance_batch_size` 限制 `10..100`。
- `memory_maintenance_max_tokens` 限制 `1000..20000`。
- secret 字段留空时保留旧值；传 `*_clear: true` 才清空。
- 返回前再次脱敏。

异常：

- `400` 字段校验失败。
- `500 { error }` 保存失败。

#### `PUT /api/auth/account`

作用：修改登录用户名/密码。

请求参数：

```json
{
  "username": "newName",
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

返回数据：

```json
{
  "success": true,
  "token": "new.jwt.token",
  "user": { "id": "...", "username": "newName", "role": "user", "created_at": 1710000000000 }
}
```

后端逻辑：

- 校验当前密码。
- 可只改用户名，也可同时改密码。
- 成功后撤销该账号所有旧 session，再签发新 token。
- 前端必须立刻替换 `localStorage.cp_token` 和 `localStorage.cp_user`。

异常：

- `400` 当前密码缺失、用户名/密码不符合要求、用户名重复等。
- `401` 当前密码错误。
- `500 { error }`。

#### `GET /api/auth/sessions`

作用：查看当前账号所有会话。当前设置页已接入，用于账号安全页展示登录设备/会话。

请求参数：无。

返回数据：

```json
{
  "success": true,
  "sessions": [
    { "id": "session-id", "created_at": 1710000000000, "last_seen_at": 1710000000000, "current": true }
  ]
}
```

异常：`401`、`500`。

#### `DELETE /api/auth/sessions/:id`

作用：撤销指定会话。

请求参数：路径 `id`。

返回数据：`{ "success": true }`。

异常：

- `404 { error: "Session not found" }`
- `401`、`500`。

### 3.3 上传和媒体接口

#### `POST /api/upload`

作用：上传头像、横幅等图片。

请求参数：`multipart/form-data`，字段名 `image`。

支持类型：PNG、JPEG、GIF、WebP。

返回数据：

```json
{
  "success": true,
  "url": "/api/media/uploads/filename.png",
  "mediaUrl": "/api/media/uploads/filename.png",
  "legacyUrl": "/uploads/users/<userId>/filename.png"
}
```

后端逻辑：

- 文件保存到当前用户作用域的 uploads 目录。
- 前端展示图片时推荐走 `/api/media/uploads/:filename`，这个地址受鉴权保护。

异常：

- `400` 没有文件、文件类型非法、multer 错误。
- `500 { error }`。

#### `GET /api/media/uploads/:filename`

作用：鉴权访问上传图片。

请求参数：路径 `filename`。

返回数据：图片二进制。

异常：

- `400` 文件名非法。
- `404` 文件不存在。
- `401` 未登录。
- `500`。

### 3.4 角色列表和角色设置接口

#### `GET /api/characters`

作用：加载联系人/角色列表，也是设置页角色选择的数据源。

请求参数：无。

返回数据：角色数组。每个角色包含：

```json
{
  "id": "char_1",
  "name": "角色名",
  "avatar": "...",
  "persona": "...",
  "world_info": "...",
  "api_endpoint": "https://...",
  "api_key": "",
  "api_key_configured": true,
  "api_key_last4": "abcd",
  "model_name": "gpt-4o",
  "memory_api_endpoint": "...",
  "memory_api_key": "",
  "memory_api_key_configured": true,
  "memory_model_name": "gpt-4o-mini",
  "tts_enabled": 0,
  "tts_provider": "tencent",
  "tts_api_key_configured": false,
  "interval_min": 10,
  "interval_max": 120,
  "context_msg_limit": 60,
  "wallet": 200,
  "unread_count": 0,
  "private_message_count": 0,
  "inventory": [],
  "emotion_state": "neutral",
  "emotion_label": "平静",
  "emotion_emoji": "..."
}
```

后端逻辑：

- 读取所有普通角色，排除 `external-shared-*` 共享外部导入角色。
- 附加未读数、私聊消息统计、城市背包、情绪派生字段。
- 对 `api_key`、`memory_api_key`、`tts_api_key` 脱敏。

异常：`401`、`500`。

#### `GET /api/characters/:id/message-stats`

作用：设置页展示角色消息统计。

请求参数：路径 `id`。

返回数据：

```json
{
  "success": true,
  "stats": {
    "first_message_at": 0,
    "last_message_at": 0,
    "last_user_message_at": 0,
    "private_message_count": 0,
    "user_message_count": 0,
    "character_message_count": 0
  }
}
```

异常：

- `404 Character not found`
- `500 { error }`

#### `POST /api/characters`

作用：新增或完整保存角色。当前设置页保存角色使用这个接口。

请求参数：角色对象，必须有 `id` 和 `name`。

常用字段：

```json
{
  "id": "char_1",
  "name": "角色名",
  "avatar": "",
  "avatar_frame": "none",
  "persona": "",
  "world_info": "",
  "system_prompt": "",
  "api_endpoint": "https://api.openai.com/v1",
  "api_key": "",
  "api_key_clear": false,
  "model_name": "gpt-4o",
  "memory_api_endpoint": "https://api.openai.com/v1",
  "memory_api_key": "",
  "memory_api_key_clear": false,
  "memory_model_name": "gpt-4o-mini",
  "max_tokens": 2000,
  "context_msg_limit": 60,
  "private_summary_threshold": 30,
  "interval_min": 10,
  "interval_max": 120,
  "sys_proactive": 1,
  "sys_timer": 1,
  "sys_pressure": 1,
  "sys_jealousy": 1,
  "sys_survival": 1,
  "sys_city_social": 1,
  "llm_debug_capture": 1,
  "wallet": 200,
  "tts_enabled": 1,
  "tts_provider": "tencent",
  "tts_api_key": "",
  "tts_api_key_clear": false,
  "tts_voice": "",
  "tts_model": "",
  "tts_endpoint": "",
  "tts_trigger_mode": "tagged",
  "tts_autoplay": 0
}
```

返回数据：

```json
{ "success": true, "character": { "id": "char_1", "name": "角色名", "api_key": "", "api_key_configured": true } }
```

后端逻辑：

- 新增和更新都走 `db.updateCharacter`。
- 数值会被后端裁剪：
  - `max_tokens`: `100..20000`
  - `context_msg_limit`: `10..200`
  - `private_summary_threshold`: `5..100`
  - `interval_min/interval_max`: `0.1..120`，如果 max 小于 min，后端会把 max 提到 min。
  - `wallet`: `0..1000000000`
  - 情绪/身体百分比类：`0..100`
  - `pressure_level`: `0..4`
- secret 字段留空保留旧值；传 `*_clear: true` 清空。
- 如果修改 `context_msg_limit`，后端会清理私聊摘要、历史窗口缓存、对话 digest，并重置 private summary baseline。
- 保存后停止该角色主动消息 timer；不会立即触发 AI 回复。

异常：

- `400 Missing ID or Name`
- `500 { error }`

#### `PUT /api/characters/:id`

作用：局部更新角色字段。聊天抽屉常用。

请求参数：路径 `id`，body 是部分角色字段。

返回数据：`{ "success": true, "character": {...} }`。

后端逻辑：

- 与 `POST /api/characters` 一样脱敏、保留 secret。
- 同样处理 `context_msg_limit` 的缓存清理。

异常：

- `400 Missing ID`
- `404 Character not found`
- `500 { error }`

#### `POST /api/characters/generate`

作用：用大模型根据用户描述生成角色草稿。

请求参数：

```json
{
  "query": "想要一个...",
  "api_endpoint": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "model_name": "gpt-4o"
}
```

返回数据：

```json
{
  "success": true,
  "character": {
    "name": "",
    "persona": "",
    "world_info": "",
    "affinity": 50,
    "sys_pressure": 1,
    "sys_jealousy": 0,
    "interval_min": 10,
    "interval_max": 60,
    "avatar": "https://api.dicebear.com/...",
    "api_endpoint": "...",
    "api_key": "sk-...",
    "model_name": "gpt-4o",
    "sys_timer": 1,
    "sys_proactive": 1,
    "emoji": "..."
  }
}
```

后端逻辑：

- 直接调用传入的大模型。
- 要求模型只返回 JSON，并校验字段。
- 会避开已有角色使用过的 emoji。
- 只返回草稿，不直接写入数据库；前端还需要调用 `POST /api/characters` 保存。

异常：

- `400` 缺少 query/API/model。
- `500` LLM 调用失败、JSON 解析失败、字段校验失败。

#### `DELETE /api/characters/:id`

作用：删除角色和所有关联数据。

请求参数：路径 `id`。

返回数据：`{ "success": true }`。

后端逻辑：

- 停止角色 timer。
- 清除该角色向量索引。
- 删除其他角色记忆中 `people` 字段提到这个角色的旧记忆，并刷新对应索引。
- 删除角色本体、消息、群成员关系、关系数据等。
- 通过 WebSocket 广播 `character_deleted`。

异常：

- `404 Character not found`
- `500 { error }`

#### `POST /api/characters/:id/reset-physical-state`

作用：重置角色身体/压力相关状态，不改好感、记忆、钱包。

请求参数：路径 `id`。

返回数据：`{ "success": true, "character": {...} }`。

后端逻辑：

- 重置能量、睡眠压力、压力、工作分心、健康等字段。

异常：

- `404 Character not found`
- `500 { error }`

### 3.5 模型和 TTS 接口

#### `POST /api/models`

作用：根据手填 endpoint/key 拉取 OpenAI 兼容模型列表。

请求参数：

```json
{ "endpoint": "https://api.openai.com/v1", "key": "sk-..." }
```

返回数据：

```json
{ "models": ["gpt-4o", "gpt-4o-mini"] }
```

后端逻辑：

- 拼接 `/models`，用 Bearer key 请求上游。
- 超时时间约 18 秒。
- 兼容 OpenAI-like 返回格式。

异常：

- `400` endpoint 或 key 缺失。
- `504` 上游超时。
- `500` 上游返回非 2xx 或解析失败。

#### `POST /api/characters/:id/models`

作用：用角色已保存的主模型 key 或记忆模型 key 拉取模型列表。这个接口很重要，因为 secret 已脱敏，前端无法拿到旧 key 明文。

请求参数：

```json
{
  "scope": "main",
  "endpoint": "",
  "key": ""
}
```

字段说明：

- `scope`: `main` 或 `memory`。
- `endpoint/key` 可选；为空时后端使用角色保存的 `api_endpoint/api_key` 或 `memory_api_endpoint/memory_api_key`。

返回数据：`{ "models": [...] }`。

异常：

- `404 Character not found`
- `400` scope 无效或最终 endpoint/key 缺失。
- `504` 超时。
- `500`。

#### `GET /api/models`

作用：旧版模型列表代理，query 形式。

请求参数：`?endpoint=...&key=...`

返回数据：`{ "models": [...] }`。

建议：新前端优先用 `POST /api/models` 和 `POST /api/characters/:id/models`。

#### `GET /api/tts/tencent/voices?refresh=1`

作用：获取腾讯 TTS 音色列表。

请求参数：

- `refresh=1` 可强制刷新缓存。

返回数据：

```json
{
  "success": true,
  "voices": [{ "value": "101001", "label": "..." }],
  "source": "tencent-docs"
}
```

异常：`500 { error }`。

#### `POST /api/tts/preview/:characterId`

作用：试听角色当前或临时 TTS 配置。

请求参数：

```json
{
  "text": "你好，我是这个角色。",
  "config": {
    "tts_provider": "tencent",
    "tts_api_key": "SecretId\nSecretKey",
    "tts_voice": "101001",
    "tts_model": "精品",
    "tts_endpoint": "",
    "tts_enabled": 1
  }
}
```

返回数据：音频 Blob，`Content-Type` 根据 provider 返回。

后端逻辑：

- 找到角色，合并保存配置和本次 preview override。
- 必须启用 TTS。
- 调用对应 TTS provider 生成临时音频，不写入消息。

异常：

- `400` TTS 未启用、配置不完整或 provider 错误。
- `404 Character not found`
- `500 { error }`

### 3.6 数据和备份接口

#### `DELETE /api/data/:characterId`

作用：深度清空某个角色的数据，但保留角色本体。

请求参数：路径 `characterId`。

返回数据：`{ "success": true }`。

后端逻辑：

- 停止 timer。
- 清空私聊消息、消息缓存、SQL 记忆、日记、好友、角色关系、私聊转账、商业街角色数据。
- 清空向量索引。
- 重置好感到 `initial_affinity`，压力/拉黑/日记锁/钱包/卡路里/城市状态/嫉妒等恢复默认。
- 生成新的日记密码。
- 添加系统消息，随后触发一次 `engine.handleUserMessage` 让角色恢复主动逻辑。

异常：

- `404 Character not found`
- `500 { error }`

#### `GET /api/data/:characterId/export`

作用：导出单个角色的资料、消息、记忆、日记等。

请求参数：路径 `characterId`。

返回数据：下载 JSON 文件，格式 `chatpulse.character.v2`。

后端逻辑：

- 导出 SQLite 内可重建角色状态的数据。
- 不导出 Qdrant 点位，导入后会从 SQLite 记忆重建索引。

异常：

- `404 Character not found`
- `500 { error }`

#### `POST /api/data/:characterId/import?mode=replace|merge`

作用：导入单角色数据。

请求参数：`multipart/form-data` 或 JSON，字段可以是文件，也可以是 JSON body；当前前端用文件。

常用 query/body：

- `mode`: `replace` 默认，先清空角色历史再导入；`merge` 只合并并清缓存。
- `skip_character`: 不导入角色配置。

返回数据：

```json
{
  "success": true,
  "characterId": "char_1",
  "mode": "replace",
  "imported": { "messages": 10, "memories": 5, "diaries": 1 },
  "rebuiltMemoryIndex": true,
  "qdrant": { "strategy": "rebuilt_from_imported_sqlite_memories", "rebuilt": true, "warning": "" }
}
```

后端逻辑：

- 停止角色 timer。
- replace 模式清空角色归档数据；merge 模式保留旧数据但清理相关缓存。
- 写入消息、记忆、日记等。
- 重建该角色记忆索引。
- 广播 `memory_update`。

异常：

- `400` archive 不合法。
- `404` 目标角色不存在且导入选项不能创建。
- `500 { error }`

#### `GET /api/system/export`

作用：导出整个当前用户备份 zip。

请求参数：无。

返回数据：zip 文件，内含 `chatpulse.db` 和当前用户引用到的 uploads 文件。

后端逻辑：

- checkpoint SQLite WAL。
- 复制数据库到临时文件。
- 只打包当前用户资料、角色、群头像引用到的上传文件。

异常：

- `404 Database not found`
- `500` archive 创建失败。

#### `POST /api/system/import`

作用：导入整个用户备份。危险操作，会覆盖当前用户数据库。

请求参数：`multipart/form-data`，字段名 `db_file`，支持 `.zip` 或 `.db`，最大 200MB。

返回数据：

```json
{
  "success": true,
  "restoredCharacters": 8,
  "rebuiltMemoryIndexes": 8
}
```

后端逻辑：

- 校验 SQLite header。
- 如果 zip，安全解压，寻找 `chatpulse.db`。
- 清除当前角色的记忆索引。
- 停止 scheduler/engine，关闭当前 DB，覆盖 DB 文件。
- 恢复 uploads。
- 重开 DB，并为所有角色重建记忆索引。

异常：

- `400` 没文件、文件类型非法、zip 内没有 db、SQLite 文件非法。
- `500 { error }`

#### `DELETE /api/system/wipe`

作用：清空当前用户所有数据。极危险。

请求参数：无。

返回数据：`{ "success": true }`。

后端逻辑：

- 遍历角色清空向量索引。
- 停止 scheduler 和所有 engine timer。
- 关闭 DB，删除 DB/WAL/SHM。
- 删除该用户 uploads 和 TTS 文件。
- 清理内存缓存。

异常：`500 { error }`。

## 4. 记忆库模块

### 4.1 现有功能

记忆库不是普通 CRUD 页面，它包含这些业务：

- 总览：Qdrant/Vectra 状态、记忆数量、索引覆盖率、缓存命中、token 使用。
- 维护设置：记忆维护小模型 endpoint/key/model/batch size/max tokens。
- 维护库：按角色、分类、待处理、即将遗忘、时间标签等展示记忆。
- 手动批处理：拉取一批待分类记忆，调用小模型，写回分类结果。
- 自动总结：后台连续跑多个批次，WebSocket 实时回传进度。
- 时间补充：给记忆补来源、场景、时间标签。
- 外部导入：上传 SillyTavern/聊天导出/文本，先预览候选，再选择角色提交，或自动分批导入。
- 批量操作：归档/取消归档、改分类、删除、查看来源、抢救维护项。

### 4.2 状态、设置、运行记录

#### `GET /api/user/memory-status`

作用：记忆系统状态卡片。

请求参数：无。

返回数据核心字段：

```json
{
  "success": true,
  "status": {
    "enabled": true,
    "reachable": true,
    "url": "http://127.0.0.1:6333",
    "mode": "local",
    "backend": "qdrant-primary-with-vectra-fallback",
    "collectionName": "chatpulse_user_xxx",
    "collectionExists": true,
    "indexedPoints": 120,
    "indexingCoverage": 95,
    "indexingSource": "qdrant",
    "charactersCount": 8,
    "charactersWithMemories": 6,
    "memoriesCount": 126,
    "legacyMemoriesCount": 130,
    "embeddedMemoriesCount": 120,
    "structuredMemoriesCount": 126,
    "archivedMemoriesCount": 8,
    "everRetrievedMemoriesCount": 30,
    "totalRetrievals": 88,
    "tokenTotal": 200000,
    "requestCount": 80,
    "cacheEntriesCount": 12,
    "cacheHitCount": 100,
    "healthyContextCacheEntriesCount": 30,
    "cacheByCharacter": [],
    "statusNoteCode": "",
    "statusNote": "",
    "lastError": ""
  }
}
```

后端逻辑：

- 汇总 SQLite `memories`、`token_usage`、`llm_cache`、prompt block cache、conversation digest cache。
- 如果 Qdrant 开启，尝试读取 collection info。
- Qdrant 不可达时不会直接失败，会返回 fallback 状态和 `lastError`。

异常：`500 { error }`。

#### `GET /api/memory-maintenance/settings`

作用：读取记忆维护小模型配置。

返回数据：

```json
{
  "success": true,
  "settings": {
    "api_endpoint": "https://api.openai.com/v1",
    "api_key": "••••abcd",
    "api_key_configured": true,
    "api_key_last4": "abcd",
    "model_name": "gpt-4o-mini",
    "batch_size": 30,
    "max_output_tokens": 8000
  }
}
```

异常：`500 { error }`。

#### `PUT /api/memory-maintenance/settings`

作用：保存记忆维护小模型配置。

请求参数：

```json
{
  "api_endpoint": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "model_name": "gpt-4o-mini",
  "batch_size": 30,
  "max_output_tokens": 8000
}
```

后端逻辑：

- 保存到 user_profile 的 `memory_maintenance_*` 字段。
- `api_key` 如果是 `••••abcd` 这类 masked input，会保留旧 key。
- `batch_size`: `10..100`。
- `max_output_tokens`: `1000..20000`。
- 返回脱敏后的 settings。

异常：

- `400` 参数越界。
- `500 { error }`

#### `GET /api/memory-maintenance/overview`

作用：维护总览。

请求参数：无。

返回数据：

```json
{
  "success": true,
  "settings": { "...": "脱敏设置" },
  "overview": {
    "total": 120,
    "pending": 30,
    "classified": 80,
    "needs_review": 10,
    "by_character": [],
    "upcoming_forgetting": []
  }
}
```

后端逻辑：

- 先自动清理已经到期的 forgetting memories。
- 汇总维护状态、分类状态、即将遗忘条目。

异常：

- `500 Raw database handle is unavailable.`
- `500 { error }`

#### `GET /api/memory-maintenance/library`

作用：获取记忆维护库的分组数据。

请求参数：

- `character_id`: 可选，按角色筛选。
- `all`: 可选，是否看全部。
- `source`: `new` 等，用于时间补充来源筛选。
- `temporal_filter`: 时间标签过滤。
- `limit_per_group`: `1..120`。
- `forgetting_limit`: `1..160`。

返回数据：

```json
{
  "success": true,
  "library": {
    "pending": [],
    "classified": [],
    "archive_candidates": [],
    "forgetting": [],
    "temporal": [],
    "characters": []
  }
}
```

后端逻辑：

- 先清理到期 forgetting memories。
- 如果传了 `character_id`，会校验角色存在。
- 根据维护状态、分类、遗忘策略等分组。

异常：

- `400` limit 参数非法。
- `404 Character not found`
- `500 { error }`

#### `GET /api/memory-maintenance/runs?active=1&character_id=...`

作用：读取后台维护任务列表。

请求参数：

- `active=1` 只看运行中。
- `character_id` 可选。

返回数据：

```json
{
  "success": true,
  "runs": [
    {
      "run_id": "char_1-...",
      "characterId": "char_1",
      "phase": "batch_success",
      "running": true,
      "processed": 30,
      "updated": 28,
      "events": []
    }
  ]
}
```

异常：`500 { error }`。

#### `GET /api/memory-maintenance/runs/:runId`

作用：读取某个后台任务快照。

返回数据：`{ "success": true, "run": {...} }`。

异常：

- `404 Run not found`
- `500 { error }`

### 4.3 记忆读取、编辑、删除、来源

#### `GET /api/memories/:characterId?include_archived=1`

作用：获取单个角色记忆列表。`MemoTable` 使用。

返回数据：记忆数组。

常见字段：

```json
{
  "id": 1,
  "character_id": "char_1",
  "summary": "...",
  "content": "...",
  "event": "...",
  "importance": 8,
  "memory_focus": "relationship",
  "memory_tier": "core",
  "is_archived": 0,
  "consolidation_key": "",
  "consolidation_summary": "",
  "source_context": "private_chat",
  "scene_tag": "daily_chat",
  "source_message_ids_json": "[\"123\"]",
  "created_at": 1710000000000,
  "updated_at": 1710000000000
}
```

后端逻辑：

- 校验角色存在。
- 默认过滤已归档记忆；`include_archived=1` 会包含归档。

异常：

- `404 Character not found`
- `500 { error }`

#### `GET /api/memories/:characterId/export?include_archived=1`

作用：导出某角色记忆 JSON。

返回：下载 JSON 文件，格式 `chatpulse.memories.v1`。

后端逻辑：

- 去掉 embedding 字段。
- 导入时通过 SQLite memories 重建向量索引。

异常：`404`、`500`。

#### `POST /api/memories/:characterId/import?mode=replace|merge&dry_run=1`

作用：导入某角色记忆。

请求参数：JSON、JSONL、txt、md 或 `multipart/form-data` 文件。

返回数据：

```json
{
  "success": true,
  "dryRun": false,
  "mode": "merge",
  "total": 20,
  "imported": 18,
  "skipped": 2,
  "ids": [1, 2],
  "acceptedFormats": ["json", "jsonl", "txt", "md"],
  "preview": [],
  "errors": []
}
```

后端逻辑：

- 支持 `memories` 数组、JSONL、纯文本段落。
- `replace` 会先清空 SQL 记忆并 wipe index。
- 每条记忆调用 `memory.saveExtractedMemory` 写库，可允许未索引。
- `dry_run=1` 只预览不写入。

异常：

- `400` 没有可导入记忆、没有有效记忆。
- `413` 单次导入超过上限。
- `404 Character not found`
- `500 { error }`

#### `PATCH /api/memories/:id`

作用：编辑单条记忆。

请求参数：

```json
{
  "summary": "摘要",
  "content": "内容",
  "event": "事件",
  "consolidation_summary": "合并摘要",
  "consolidation_key": "stable-key",
  "source_app": "chatpulse",
  "time": "昨晚",
  "location": "商业街",
  "emotion": "开心",
  "memory_focus": "relationship",
  "memory_tier": "core",
  "source_context": "private_chat",
  "scene_tag": "daily_chat",
  "importance": 8,
  "is_archived": 0
}
```

后端逻辑：

- 字符串会 trim 和截断。
- `memory_focus`、`memory_tier`、`source_context`、`scene_tag` 必须在枚举范围。
- 自动设置 `maintenance_status = classified`、`classification_source = manual-edit`、`classified_at`、`updated_at`。
- 更新后刷新该记忆的向量索引，并广播 `memory_update`。

返回数据：

```json
{ "success": true, "id": 1, "character_id": "char_1", "patch": {...} }
```

异常：

- `400` 无可编辑字段或枚举非法。
- `404 Memory not found`
- `500 { error }`

#### `PATCH /api/memories/bulk`

作用：批量编辑记忆，常用于批量归档/取消归档/改分类。

请求参数：

```json
{
  "ids": [1, 2, 3],
  "patch": { "is_archived": 1, "memory_tier": "ambient" }
}
```

返回数据：

```json
{
  "success": true,
  "updated": 3,
  "ids": [1, 2, 3],
  "character_ids": ["char_1"],
  "patch": { "is_archived": 1 }
}
```

后端逻辑：

- ids 最多 10000。
- 每条更新后按角色刷新索引。
- 每个受影响角色广播 `memory_update`。

异常：

- `400` ids 非数组、无 ids、patch 非法。
- `500 { error }`

#### `DELETE /api/memories/:id`

作用：删除单条记忆。

返回数据：

```json
{
  "success": true,
  "deleted": 1,
  "id": 1,
  "character_id": "char_1",
  "character_ids": ["char_1"],
  "index_deleted": true,
  "index_results": [],
  "index_refresh": []
}
```

后端逻辑：

- 删除外部导入绑定。
- 删除 SQLite memory。
- 删除/刷新所有相关角色的索引目标。
- 广播 `memory_update`。

异常：

- `404 Memory not found`
- `500 { success: false, error, partial, details }`

#### `DELETE /api/memories/bulk`

作用：批量删除记忆。

请求参数：

```json
{ "ids": [1, 2, 3] }
```

返回数据：

```json
{
  "success": true,
  "deleted": 3,
  "ids": [1, 2, 3],
  "character_ids": ["char_1", "char_2"],
  "index_deleted": true,
  "index_results": []
}
```

后端逻辑：同单删，但按角色合并索引操作。

异常：`400`、`500`。

#### `GET /api/memory-source?ids=1,2,3`

作用：查看记忆来自哪些原始消息/群消息/商业街日志/外部导入候选。

请求参数：

- `ids` 或 `memory_ids`: 逗号/空格分隔，最多 120 个。

返回数据：

```json
{
  "success": true,
  "requested_memory_ids": [1, 2],
  "missing_memory_ids": [],
  "memories": [
    {
      "id": 1,
      "character_id": "char_1",
      "summary": "...",
      "source_context": "private_chat",
      "scene_tag": "daily_chat",
      "source_refs": ["private_chat:123"]
    }
  ],
  "sources": [
    {
      "source_key": "private_chat:123",
      "kind": "private_chat",
      "id": 123,
      "speaker": "User",
      "timestamp": 1710000000000,
      "content": "...",
      "found": true,
      "memory_ids": [1]
    }
  ],
  "stats": { "memory_count": 1, "source_ref_count": 1, "found_source_count": 1, "missing_source_count": 0 }
}
```

异常：

- `400 ids query parameter is required.`
- `500 { error }`

### 4.4 小模型批处理

#### `GET /api/memories/:characterId/maintenance/stats`

作用：读取单角色维护统计。当前页面可以用于右侧状态栏。

返回数据：

```json
{ "success": true, "character": { "id": "char_1", "name": "角色名" }, "stats": {...} }
```

异常：`404`、`500`。

#### `GET /api/memories/:characterId/maintenance/batch`

作用：拉取一批待分类记忆和给小模型的 prompt。

请求参数：

- `limit`: `1..100`，默认 30。
- `offset`: `0..Number.MAX_SAFE_INTEGER`。
- `after_id`: 可选。
- `status`: 默认 `pending`。
- `include_archived`: 是否包含归档。

返回数据：

```json
{
  "success": true,
  "character": { "id": "char_1", "name": "角色名" },
  "prompt": { "system_prompt": "...", "user_prompt": "..." },
  "task": {
    "purpose": "Classify memories and propose consolidation/forgetting actions. Do not delete memories.",
    "recommended_batch_size": 30,
    "allowed_memory_focus": ["user_profile", "user_current_arc", "relationship", "general"],
    "allowed_memory_tier": ["core", "active", "ambient"],
    "allowed_maintenance_status": ["classified", "needs_review", "ignored"],
    "allowed_retention_action": ["keep", "downgrade", "archive_candidate", "merge_candidate", "superseded", "needs_review"],
    "output_schema": { "items": [] }
  },
  "items": [],
  "total_matching": 0,
  "item_count": 0
}
```

异常：

- `400` limit/offset/status 非法。
- `404 Character not found`
- `500` raw DB 不可用或其他错误。

#### `POST /api/memories/:characterId/maintenance/run`

作用：让后端直接调用维护小模型并应用一批分类结果。

请求参数：

```json
{
  "limit": 30,
  "offset": 0,
  "after_id": 0,
  "status": "pending",
  "include_archived": false,
  "dry_run": false,
  "rebuild_index": false
}
```

返回数据核心：

```json
{
  "success": true,
  "mode": "single",
  "empty": false,
  "batch": { "item_count": 30, "ids": [1, 2] },
  "normalized": { "items": [], "errors": [] },
  "apply": { "updated": 28, "errors": [] },
  "prompt": {},
  "raw_response": "...",
  "rebuiltMemoryIndex": false,
  "rebuildWarning": ""
}
```

后端逻辑：

- 要求 `memory-maintenance/settings` 已配置 endpoint/key/model。
- 构造 prompt，调用小模型，解析 JSON。
- 应用分类、合并建议、归档候选等字段。
- 默认局部刷新索引；`rebuild_index` 会全量重建该角色索引。
- 广播 `memory_update`。

异常：

- `400 Memory maintenance model URL, key, and model are required.`
- `404 Character not found`
- `422/500` 小模型返回不可用 JSON 时可能带 `payload`，前端要展示 `raw_response`/`normalized.errors`。

#### `POST /api/memories/:characterId/maintenance/auto-run`

作用：后台连续跑记忆分类批处理。

请求参数：

```json
{
  "limit": 30,
  "max_batches": 10,
  "run_until_empty": false,
  "max_rerolls": 3,
  "dry_run": false,
  "background": true,
  "rebuild_index": false
}
```

返回数据：

- `background: true` 时立刻返回：

```json
{ "success": true, "accepted": true, "run": { "run_id": "...", "phase": "queued", "running": true } }
```

- 非后台或任务完成时返回：

```json
{
  "success": true,
  "character": { "id": "char_1", "name": "角色名" },
  "mode": "auto",
  "dry_run": false,
  "limit": 30,
  "max_batches": 10,
  "processed": 120,
  "updated": 110,
  "applied_errors": 0,
  "stopped_reason": "completed",
  "errors": [],
  "runs": [],
  "stats": {},
  "can_continue": false,
  "continue_from": { "status": "pending", "offset": 0, "pending": 0 }
}
```

WebSocket：持续广播 `memory_maintenance_progress`，`phase` 包含 `queued/start/batch_start/attempt_start/attempt_result/batch_success/done/stopped`。

后端逻辑：

- 同一用户同一角色只复用一个 active run。
- 后台队列去重，队列满会通过进度事件返回 `queue_full`。
- 小模型失败会按 `max_rerolls` 重试。
- 可在错误时继续，前端使用 `continue_from` 作为继续参数。

异常：

- `400` 设置缺失或参数非法。
- `404 Character not found`
- `422` 批处理停止但有可展示结果。
- `500`。

#### `POST /api/memories/:characterId/maintenance/apply`

作用：前端或人工把外部生成的维护结果应用到数据库。当前 UI 不一定暴露，但后端已有。

请求参数：

```json
{
  "items": [
    {
      "id": 1,
      "memory_focus": "relationship",
      "memory_tier": "core",
      "importance": 8,
      "maintenance_status": "classified",
      "retention_action": "keep",
      "retention_reason": "原因",
      "consolidation_key": "",
      "consolidation_summary": ""
    }
  ],
  "source": "manual",
  "rebuild_index": false
}
```

返回数据：

```json
{
  "success": true,
  "character": { "id": "char_1", "name": "角色名" },
  "updated": 1,
  "errors": [],
  "indexRefresh": {},
  "indexRefreshWarning": "",
  "rebuiltMemoryIndex": false,
  "rebuildWarning": "",
  "stats": {}
}
```

异常：

- `400 items array is required.`
- `413 Too many maintenance items. Limit is 100.`
- `404 Character not found`
- `500 { error }`

### 4.5 时间标签补充

#### `GET /api/memories/:characterId/maintenance/temporal-binding-batch`

作用：拉取一批需要补来源/场景/时间标签的记忆。

请求参数：

- `limit`: 默认 40，最大 100。
- `offset`: 默认 0。
- `source`: 默认 `new`。
- `include_archived`: 是否包含归档。

返回数据：

```json
{
  "success": true,
  "character": { "id": "char_1", "name": "角色名" },
  "prompt": {},
  "task": {
    "purpose": "Source/scene and time-label-only pass for existing memories. Do not change memory_focus, do not summarize, do not delete memories.",
    "allowed_source_contexts": [],
    "allowed_scene_tags": [],
    "allowed_labels": [],
    "allowed_scopes": [],
    "validator": "normalizeTemporalBindingResult",
    "known_ids": [1, 2]
  },
  "items": []
}
```

异常：`400`、`404`、`500`。

#### `POST /api/memories/:characterId/maintenance/temporal-binding-run`

作用：直接调用小模型，应用一批时间/来源标签。

请求参数：

```json
{
  "limit": 40,
  "offset": 0,
  "source": "new",
  "include_archived": false,
  "dry_run": false,
  "rebuild_index": false
}
```

返回数据：类似维护 run，包含 `batch`、`normalized`、`apply`、`prompt`、`raw_response`、`rebuiltMemoryIndex`。

后端逻辑：

- 只改来源/场景/时间绑定，不改记忆摘要和分类。
- 广播 `memory_update`。

异常：`400` 设置缺失、`404`、`422/500`。

#### `POST /api/memories/:characterId/maintenance/temporal-binding-auto-run`

作用：后台连续补标签。

请求参数：

```json
{
  "source": "new",
  "limit": 40,
  "max_batches": 10,
  "run_until_empty": false,
  "max_rerolls": 3,
  "dry_run": false,
  "background": true
}
```

返回数据和 WebSocket 规则与 `maintenance/auto-run` 类似，但 `task_mode` 为 `supplement`。

异常：同自动总结。

### 4.6 外部记忆导入

#### `GET /api/memory-import/external/latest`

作用：恢复上一次尚未 commit 的外部导入预览。

返回数据：

```json
{
  "success": true,
  "import": {
    "id": 10,
    "source_app": "sillytavern",
    "import_mode": "multi_role",
    "filename": "chat.jsonl",
    "message_count": 100,
    "created_at": 1710000000000,
    "committed_at": 0,
    "restored": true
  },
  "role_tags": [],
  "candidates": [],
  "needs_review": [],
  "restored": true
}
```

没有待提交预览时：`{ "success": true, "import": null }`。

异常：`500 { error }`。

#### `POST /api/memory-import/external/preview`

作用：上传外部聊天导出，调用小模型预览可导入记忆候选。

请求参数：`multipart/form-data` 或文本字段。

常用字段：

- 文件字段：任意文件字段均可，后端 `memoryImportUpload.any()`。
- `source_app` / `source` / `app`: 外部来源，如 `sillytavern`。
- `import_mode` / `mode`: `multi_role` 或 `one_to_one` 等。
- `target_character_name` / `character_name`: 一对一目标角色名。

返回数据：

```json
{
  "success": true,
  "import": {
    "id": 12,
    "source_app": "sillytavern",
    "import_mode": "multi_role",
    "filename": "export.jsonl",
    "message_count": 300,
    "created_at": 1710000000000,
    "detected_source_app": "sillytavern"
  },
  "role_tags": [{ "name": "角色A", "confidence": 0.9 }],
  "candidates": [],
  "needs_review": [],
  "model": { "name": "gpt-4o-mini", "usage": {}, "finishReason": "stop" },
  "prompt_stats": { "row_count": 300, "prompt_chars": 12000, "clean_stats": {} },
  "raw_response_preview": "..."
}
```

后端逻辑：

- 必须先配置记忆库管理小模型。
- 自动检测 SillyTavern 等格式，清洗消息。
- 构造导入 prompt，要求小模型返回 JSON。
- 预览结果写入 `external_memory_imports`，此时不写正式 memories。

异常：

- `400` 小模型配置缺失、上传解析失败。
- `422` 小模型没有提取出候选，会返回 `raw_response`、`role_tags`、`needs_review`。
- `504` 小模型超时。
- `500 { error }`

#### `POST /api/memory-import/external/:importId/commit`

作用：把预览候选写入正式记忆。

请求参数：

```json
{
  "selected_role_names": ["角色A", "角色B"]
}
```

返回数据：

```json
{
  "success": true,
  "import_id": 12,
  "imported_as": "external_direct",
  "characters": [{ "id": "char_1", "name": "角色A" }],
  "queued": 0,
  "imported": 10,
  "ids": [101, 102],
  "skipped": [],
  "errors": []
}
```

后端逻辑：

- 读取 preview 时保存的候选。
- 如果没有传 `selected_role_names`，默认选全部 role tags。
- 一对一模式下可把候选绑定到唯一选中角色。
- 写入 memories，并可能写外部共享记忆绑定。
- 更新 import 的 `committed_at`。
- 对所有写入角色广播 `memory_update`，并广播 `refresh_contacts`。

异常：

- `400` 没选角色、所选角色没有匹配候选。
- `404 External import preview not found.`
- `422` 候选保存失败。
- `500 { error }`

#### `POST /api/memory-import/external/auto-run`

作用：不走人工 preview/commit，直接把外部导入按批次总结并写库；也可从断点继续。

请求参数：

```json
{
  "source_app": "sillytavern",
  "import_mode": "multi_role",
  "target_character_name": "",
  "limit": 10,
  "max_batches": "all",
  "run_until_empty": true,
  "max_rerolls": 0,
  "dry_run": false,
  "background": true,
  "continue_import_id": 12,
  "continue_from_offset": 100,
  "retry_latest_external_import": false
}
```

返回数据：

```json
{
  "success": true,
  "mode": "external_import_auto",
  "dry_run": false,
  "import_id": 12,
  "source_app": "sillytavern",
  "import_mode": "multi_role",
  "filename": "export.jsonl",
  "limit": 10,
  "processed": 300,
  "updated": 40,
  "stopped_reason": "completed",
  "roles": [],
  "characters": [],
  "saved": [],
  "errors": [],
  "runs": [],
  "can_continue": false,
  "continue_from": { "import_id": 12, "offset": 300, "pending": 0, "total": 300 },
  "stats": { "message_count": 300, "batch_count": 30, "candidates": 40, "saved": 40, "saved_bindings": 40 }
}
```

WebSocket：`memory_maintenance_progress`，`task_mode: external_import`。

后端逻辑：

- 支持 background 队列、断点继续、retry latest。
- 每批构造 prompt 调小模型，保存候选到正式 memories。
- 写入后广播 `memory_update` 和 `refresh_contacts`。
- 如果中途失败，返回 `can_continue` 和 `continue_from`。

异常：

- `400` 配置缺失、上传解析失败、参数非法。
- `422` 自动导入停止但有结果可展示。
- `504` 小模型超时。
- `500 { error }`

### 4.7 记忆清扫和抢救

#### `POST /api/memories/:characterId/sweep`

作用：手动触发长期记忆清扫，把超出窗口的私聊/群聊/城市日志总结进长期记忆。

请求参数：

```json
{ "pool": "auto" }
```

`pool` 可以是后端支持的池，如 `auto`。

返回数据：

```json
{
  "success": true,
  "savedCount": 3,
  "pool": "auto",
  "consumedCount": 30,
  "warning": "",
  "message": "Long-term memory sweep completed for auto. Saved 3 memories."
}
```

后端逻辑：

- 需要角色自己的 `memory_api_endpoint/key/model` 完整配置。
- 防并发：已有清扫在跑返回 409。
- 冷却中返回 429。
- 成功会消费旧上下文并写入长期记忆。

异常：

- `400` 记忆小模型未配置或上次错误。
- `404 Character not found`
- `409` 另一个 sweep 正在运行。
- `429` cooldown，带 `remainingSeconds`。
- `500 { error }`

#### `POST /api/memory-maintenance/rescue`

作用：抢救/恢复维护库中的异常项。

请求参数：

```json
{
  "ids": [1, 2, 3],
  "rebuild_index": true
}
```

也支持 query `?rebuild_index=1`。

返回数据：

```json
{
  "success": true,
  "rescued": 3,
  "characterIds": ["char_1"],
  "rebuilt": ["char_1"],
  "overview": {}
}
```

后端逻辑：

- 根据 ids 恢复维护项。
- 可选按角色重建记忆索引。
- 对相关角色广播 `memory_update`。

异常：`500 { error }`。

## 5. 社交和聊天模块

### 5.1 现有功能

社交模块包括：

- 联系人列表：角色头像、未读数、最后消息、钱包/状态等。
- 私聊：分页加载、发送消息、AI 回复、重试失败回复、批量删除、TTS 播放、转账、推联系人卡片。
- 私聊设置抽屉：角色关系、印象历史、日程、上下文 token 统计、情绪日志、LLM debug 日志、导入导出、长期记忆清扫、重置身体状态。
- 好友/名片：把一个角色推荐给另一个角色，建立好友关系并生成双方初始印象。
- 群聊：建群、群消息、@ 提及、AI 接龙、暂停 AI、禁用 AI-to-AI 连锁、成员管理、清空/批删消息、群红包。
- 钱包：用户和角色的钱包、转账领取/退还、红包领取。
- 日记和记忆表：从角色抽屉查看、解锁、删除。

### 5.2 私聊消息接口

#### `GET /api/messages/:characterId?limit=100&before=123`

作用：加载私聊消息，支持分页。

请求参数：

- `characterId`: 路径。
- `limit`: 默认 100，最大 200。
- `before`: 可选，取某条消息 id 之前的旧消息。

返回数据：消息数组。

```json
[
  {
    "id": 1,
    "character_id": "char_1",
    "role": "user",
    "content": "你好",
    "timestamp": 1710000000000,
    "metadata": null,
    "hidden": 0,
    "tts_audio_url": ""
  }
]
```

后端逻辑：

- 校验角色存在。
- 没有 `before` 时会把该角色消息标记为已读。
- 返回可见消息窗口。

异常：

- `400` limit 非法。
- `404 Character not found`
- `500 { error }`

#### `POST /api/messages`

作用：用户发送私聊消息。

请求参数：

```json
{
  "characterId": "char_1",
  "content": "你好"
}
```

返回数据：

```json
{
  "success": true,
  "message": { "id": 1, "character_id": "char_1", "role": "user", "content": "你好", "timestamp": 1710000000000 }
}
```

如果角色已拉黑：

```json
{ "success": true, "blocked": true, "message": {...} }
```

后端逻辑：

- 保存用户消息。
- 标记已读。
- 广播 `new_message`。
- 如果角色未拉黑，调用 `engine.handleUserMessage`，后续 AI 回复通过 WebSocket `new_message` 推送。
- 会触发商业街忙碌影响、嫉妒检查等副作用。

异常：

- `400` content/characterId 缺失。
- `404 Character not found`
- `500 { error }`

#### `POST /api/messages/:characterId/retry`

作用：重试角色上一次失败回复。

请求参数：

```json
{ "failedMessageId": 123 }
```

`failedMessageId` 可选。

返回数据：

```json
{ "success": true }
```

特殊情况：

```json
{ "success": true, "retriedSystemEvent": true }
```

后端逻辑：

- 如果传了失败消息 id，会先删除该失败消息。
- 如果失败消息 metadata 是系统事件回复，则走系统事件 retry。
- 否则调用 `engine.handleUserMessage` 继续生成回复。

异常：

- `404 Character not found`
- `500 { error }`

#### `POST /api/messages/batch-delete`

作用：批量删除私聊消息。

请求参数：

```json
{
  "messageIds": [1, 2, 3],
  "characterId": "char_1"
}
```

返回数据：`{ "success": true, "deleted": 3 }`。

后端逻辑：

- `messageIds` 必须非空，最多 500。
- 可传 `characterId` 限定删除范围。
- 删除后清理该角色消息相关缓存。

异常：

- `400 messageIds array required`
- `400 Too many messages`
- `500 { error }`

#### `DELETE /api/messages/:characterId`

作用：清空某角色私聊消息。旧版软清空。

返回数据：`{ "success": true }`。

后端逻辑：

- 校验角色存在。
- 清空 messages 和角色消息缓存。
- 不清长期记忆、日记、关系。

异常：`404`、`500`。

### 5.3 TTS 和消息气泡关联接口

#### `GET /api/tts/audio/:messageId`

作用：播放某条消息对应 TTS 音频。

请求参数：路径 `messageId`。

返回数据：音频文件流。

后端逻辑：

- 校验消息属于当前用户数据。
- 找到音频文件后返回。

异常：

- `403` 无权访问。
- `404` 消息或音频不存在。
- `500`。

### 5.4 好友、关系和印象接口

#### `GET /api/characters/:id/friends`

作用：读取角色好友列表。私聊推名片前可用。

返回数据：好友数组。

异常：

- `404 Character not found`
- `500 { error }`

#### `POST /api/characters/:id/friends`

作用：让角色 A 与角色 B 成为好友，并在双方私聊插入联系人卡片。

请求参数：

```json
{ "target_id": "char_2" }
```

返回数据：

```json
{ "success": true, "added": true }
```

后端逻辑：

- 校验两个角色都存在。
- `db.addFriend(source, target)`。
- 如果是新加好友，会给双方消息里插入 `[CONTACT_CARD:id:name:avatar]`。
- 异步调度 `scheduleInitialImpressions`，让两个角色生成初始印象。

异常：

- `400 target_id is required`
- `404 Character not found`
- `500 { error }`

#### `GET /api/characters/:id/relationships`

作用：读取角色对其他角色的关系/好感/印象。

返回数据：

```json
[
  {
    "targetId": "char_2",
    "affinity": 60,
    "impression": "觉得对方...",
    "targetName": "角色B",
    "targetAvatar": "..."
  }
]
```

后端逻辑：

- 读取角色关系表。
- 过滤已删除目标角色。
- 补目标角色名称和头像。

异常：`404`、`500`。

#### `GET /api/characters/:id/impressions/:targetId?limit=50`

作用：读取角色 A 对角色 B 的印象历史。

请求参数：

- `limit`: `1..200`，默认 50。

返回数据：历史数组。

异常：

- `400 Invalid impression history limit`
- `404 Character not found`
- `500 { error }`

#### `POST /api/characters/:id/relationships/regenerate`

作用：重新用 LLM 生成角色 A 对角色 B 的印象。

请求参数：

```json
{ "target_id": "char_2" }
```

返回数据：

```json
{ "success": true, "affinity": 56, "impression": "..." }
```

后端逻辑：

- 校验两个角色存在。
- 调用 `regenerateImpression`。
- 写入关系表，来源标记为 `recommend`。

异常：

- `400 target_id required`
- `404 Character not found`
- `500` LLM 无有效 JSON 或其他错误。

### 5.5 上下文、情绪和调试接口

#### `GET /api/characters/:id/context-stats`

作用：聊天抽屉的上下文 token 统计和缓存节省统计。

返回数据：

```json
{
  "success": true,
  "stats": {
    "total": 12000,
    "system_full": 3000,
    "history_full": 2000,
    "city_x_y": 1000,
    "z_memory": 800,
    "q_impression": 300,
    "w_unsummarized_count": 20,
    "w_private_unsummarized_count": 10,
    "w_group_unsummarized_count": 5,
    "w_city_unsummarized_count": 5,
    "actual_prompt_tokens_total": 100000,
    "actual_completion_tokens_total": 50000,
    "cache_entries_count": 10,
    "cache_hit_count": 30,
    "last_conversation_used_rag": true,
    "last_conversation_topic_switch_decision": "..."
  }
}
```

后端逻辑：

- 构造一次近似的 universal context，不真正发送给模型。
- 统计系统 prompt、近期聊天、私聊摘要、城市上下文、长期记忆、印象等 token。
- 汇总 token_usage、llm cache、prompt block cache、history window、digest。
- 如果角色未初始化 sweep baseline，会初始化 baseline。

异常：

- `404 Character not found`
- `500 { error }`

#### `GET /api/characters/:id/cache-stats`

作用：更底层的角色缓存统计。后端已有，当前 UI 可选接入。

返回数据：`{ "success": true, "stats": { "entries_count": 0, "by_type": [], "prompt_blocks": [], "history_windows": [] } }`

异常：`404`、`500`。

#### `GET /api/characters/:characterId/emotion-logs?limit=30`

作用：读取角色情绪变化日志。

请求参数：

- `limit`: 默认 50，最大 100。

返回数据：

```json
{ "success": true, "logs": [] }
```

异常：`404`、`500`。

#### `GET /api/characters/:characterId/llm-debug-logs?limit=60`

作用：读取该角色 LLM debug 日志。

请求参数：

- `limit`: 默认 50，最大 200。

返回数据：

```json
{ "success": true, "logs": [] }
```

异常：`404`、`500`。

#### `GET /api/debug/reply-dispatch/:characterId?limit=...`

作用：调试回复分发队列。后端存在但可能不可用。

返回数据：实现存在时返回调试 JSON。

异常：

- `501` 调试能力不可用。
- `404` 角色不存在。
- `500`。

### 5.6 日记接口

#### `GET /api/diaries/:characterId`

作用：读取角色日记和解锁状态。

返回数据：

```json
{
  "isUnlocked": true,
  "entries": [
    { "id": 1, "character_id": "char_1", "title": "...", "content": "...", "timestamp": 1710000000000 }
  ]
}
```

后端逻辑：

- 校验角色存在。
- 日记内容会经过商业街叙事文本清洗。
- 即使未解锁也返回 entries，当前前端用 `isUnlocked` 决定遮罩/密码界面；如果新前端要更严谨，可以未解锁时隐藏内容。

异常：

- `404 Character not found`
- `500 { error }`

#### `POST /api/diaries/:characterId/unlock`

作用：用密码解锁日记。

请求参数：

```json
{ "password": "1234" }
```

返回数据：

- 成功：`{ "success": true }`
- 失败：`{ "success": false, "reason": "..." }`

后端逻辑：

- 校验角色存在。
- 调用 `db.verifyAndUnlockDiary`。
- 成功后角色 `is_diary_unlocked` 变为 1。

异常：

- `400 No password provided.`
- `403` 密码错误。
- `404 Character not found`
- `500 { error }`

#### `DELETE /api/diaries/:id`

作用：删除单篇日记。

返回数据：`{ "success": true, "deleted": true }`。

异常：

- `404 Diary not found`
- `501 Not implemented`
- `500 { error }`

### 5.7 群聊接口

#### `GET /api/groups`

作用：读取群聊列表。

返回数据：群数组，每个群包含 id、name、avatar、members、inject_limit、context_msg_limit、group_proactive_enabled、group_interval_min/max 等。

异常：`500 { error }`。

#### `POST /api/groups`

作用：创建群。

请求参数：

```json
{
  "name": "新群聊",
  "member_ids": ["char_1", "char_2"]
}
```

返回数据：

```json
{ "success": true, "group": { "id": "group_171...", "name": "新群聊", "members": [] } }
```

后端逻辑：

- 群名 trim。
- 成员 id 去重并校验必须存在。
- 群头像默认用第一个成员头像，没有则 Dicebear。

异常：

- `400 name and member_ids are required`
- `400 Invalid group member ids`，带 `invalid_member_ids`。
- `500 { error }`

#### `PUT /api/groups/:id`

作用：更新群设置。

请求参数：

```json
{
  "name": "群名",
  "inject_limit": 5,
  "context_msg_limit": 60,
  "group_proactive_enabled": true,
  "group_interval_min": 10,
  "group_interval_max": 60
}
```

校验：

- `inject_limit`: `0..30`
- `context_msg_limit`: `10..200`
- `group_interval_min/max`: `1..1440`
- max 不能小于 min。

返回数据：`{ "success": true, "group": {...} }`。

后端逻辑：

- 改 `context_msg_limit` 会清群聊 digest。
- 改主动群聊开关或间隔会重新 schedule group proactive timer。

异常：

- `400` 字段非法。
- `404 Group not found`
- `500 { error }`

#### `GET /api/groups/:id/messages?limit=100`

作用：加载群消息。

请求参数：

- `limit`: 群消息数量，非法返回 400。

返回数据：群消息数组。

```json
[
  {
    "id": 1,
    "group_id": "group_1",
    "sender_id": "user",
    "sender_name": "Nana",
    "sender_avatar": "",
    "content": "大家好",
    "timestamp": 1710000000000,
    "metadata": null
  }
]
```

异常：

- `400 Invalid message limit`
- `404 Group not found`
- `500 { error }`

#### `POST /api/groups/:id/messages`

作用：用户发送群消息。

请求参数：

```json
{ "content": "@all 晚上好" }
```

返回数据：当前实现主要通过 WebSocket 推送，HTTP 成功通常返回保存状态或消息对象，前端不要只依赖 HTTP 结果更新最终列表。

后端逻辑：

- 保存用户群消息，sender 是 `user`，显示名/头像来自 user profile。
- 广播 `group_message`。
- 解析 `@all` 和具体 @ 角色名，累计到 debounce 状态。
- 对群内角色应用 `group_user_message_received` 情绪事件；被点名和 @all 情绪影响不同。
- 触发商业街忙碌聊天影响。
- debounce 后触发一次群 AI 接龙，避免用户连发多条导致多轮重叠。
- 如果群 AI 已暂停，则只保存用户消息，不触发回复链。

异常：

- `400 content required`
- `404 Group not found`
- `500 { error }`

#### `POST /api/groups/:id/members`

作用：添加群成员。

请求参数：

```json
{ "member_id": "char_3" }
```

返回数据：`{ "success": true, "group": {...} }`。

后端逻辑：

- 不允许添加 `user`，只允许角色。
- 插入系统群消息 `[System] 角色名 加入了群聊` 并广播 `group_message`。
- 1.5 秒后触发群 AI 接龙，让成员对入群做反应。

异常：

- `400 member_id is required`
- `400 Invalid group member id`
- `404 Group not found`
- `409 Group member already exists`
- `500 { error }`

#### `DELETE /api/groups/:id/members/:memberId`

作用：移除群成员。

返回数据：`{ "success": true, "group": {...} }`。

后端逻辑：

- 不允许移除 `user`。
- 插入系统群消息 `[System] 角色名 被移出了群聊`。
- 广播并触发剩余成员 AI 反应。

异常：

- `400 Invalid group member id`
- `404 Group not found`
- `404 Group member not found`
- `500 { error }`

#### `DELETE /api/groups/:id`

作用：解散群。

返回数据：`{ "success": true }`。

后端逻辑：

- 停止群主动 timer。
- 删除群和群消息。
- 清理该用户该群的运行态：暂停状态、no-chain、debounce、锁、pending mentions。

异常：`404`、`500`。

#### `DELETE /api/groups/:id/messages`

作用：清空群消息。

返回数据：`{ "success": true }`。

异常：`404`、`500`。

#### `POST /api/groups/:id/messages/batch-delete`

作用：批量删除指定群消息。

请求参数：

```json
{ "messageIds": [1, 2, 3] }
```

返回数据：`{ "success": true, "deleted": 3 }`。

后端逻辑：

- 删除时用 `group_id + ids` 限定，不会跨群删。

异常：

- `400 messageIds array required`
- `404 Group not found`
- `500 { error }`

#### `POST /api/groups/:id/ai-pause`

作用：暂停/恢复群 AI 回复。

请求参数：

```json
{ "paused": true }
```

`paused` 可省略，省略时切换当前状态。

返回数据：

```json
{ "paused": true }
```

后端逻辑：

- 暂停时停止 group proactive timer，清掉 pending debounce 和 reply lock。
- 恢复时重新 schedule group proactive timer。
- 状态是内存态，服务重启后会丢失。

异常：`404`、`500`。

#### `GET /api/groups/:id/ai-pause`

作用：读取当前群 AI 是否暂停。

返回数据：`{ "paused": false }`。

异常：`404`、`500`。

#### `POST /api/groups/:id/no-chain`

作用：切换是否禁止 AI-to-AI 二级 @ 接龙。

请求参数：无。

返回数据：`{ "noChain": true }`。

后端逻辑：

- 只影响运行态；用于阻止角色回复里继续 @ 另一个角色导致连锁。

异常：`404`、`500`。

#### `GET /api/groups/:id/no-chain`

作用：读取 no-chain 状态。

返回数据：`{ "noChain": false }`。

异常：`404`、`500`。

### 5.8 钱包、转账、红包接口

#### `GET /api/wallet/:id`

作用：读取用户或角色钱包余额。

请求参数：

- `id`: `user` 或角色 id。

返回数据：

```json
{ "wallet": 520 }
```

异常：

- `400 Invalid wallet id`
- `404 Character not found`
- `500 { error }`

#### `POST /api/characters/:id/transfer`

作用：用户给角色转账。

请求参数：

```json
{
  "amount": 20,
  "note": "请喝奶茶"
}
```

返回数据：

```json
{
  "success": true,
  "transfer_id": "tr_...",
  "wallet": 500
}
```

后端逻辑：

- 校验金额为正数，note 长度不超过 120。
- 从用户钱包扣款，创建 transfer 记录。
- 在私聊里插入 `[TRANSFER]tid|amount|note` 消息并广播 `new_message`。
- 广播 `wallet_sync`。
- 5-12 秒后调用角色主模型，决定接受或退还；如果角色已拉黑，模型也可输出解除拉黑。
- 决定结果会改变双方钱包，并可能插入角色反应消息和 `refresh_contacts`。

异常：

- `400 Invalid amount`、`Invalid note`、余额不足等。
- `404 Character not found`
- `500 { error }`

#### `GET /api/transfers/:tid`

作用：读取转账状态，消息气泡里的转账卡片使用。

返回数据：transfer 对象，通常包含 `id`、`char_id`、`sender_id`、`recipient_id`、`amount`、`note`、`status`、`created_at` 等。

异常：

- `400 Invalid transfer id`
- `404 Transfer not found`
- `500 { error }`

#### `POST /api/transfers/:tid/claim`

作用：用户领取角色发来的转账。

返回数据：

```json
{ "success": true, "amount": 20, "wallet": 540 }
```

后端逻辑：

- 当前接口固定 `claimer_id = user`。
- 更新 transfer 状态和用户钱包。
- 广播 `wallet_sync`。

异常：

- `400 Invalid transfer id` 或业务失败。
- `500 { error }`

#### `POST /api/transfers/:tid/refund`

作用：用户退还一笔转账。

返回数据：

```json
{ "success": true, "amount": 20, "wallet": 200 }
```

后端逻辑：

- 当前接口固定 `refunder_id = user`。
- 金额退回 sender。
- 广播 `wallet_sync`。
- 异步调用角色主模型，根据时间差和最近聊天生成被退款反应，并广播 `new_message`。

异常：

- `400 Invalid transfer id` 或业务失败。
- `404 Transfer not found`
- `500 { error }`

#### `POST /api/transfer`

作用：旧版转账/解除拉黑接口。

请求参数：

```json
{ "characterId": "char_1", "amount": 20, "note": "..." }
```

返回数据：

```json
{ "success": true, "unblocked": true, "message": {...} }
```

建议：新前端优先使用 `POST /api/characters/:id/transfer`，但如果保留“通过转账解除拉黑”的旧交互，这个接口仍可用。

#### `POST /api/groups/:id/redpackets`

作用：用户在群里发红包。

请求参数：

固定金额红包：

```json
{
  "type": "fixed",
  "count": 5,
  "per_amount": 2,
  "note": "手气不错"
}
```

拼手气红包：

```json
{
  "type": "lucky",
  "count": 5,
  "total_amount": 10,
  "note": "手气不错"
}
```

校验：

- `type`: `fixed` 或 `lucky`。
- `count`: `1..100`。
- 总金额必须大于 0，且按分计算要够每人至少 0.01。
- note 最多 120。

返回数据：

```json
{
  "success": true,
  "packet_id": "rp_...",
  "message": { "id": 1, "group_id": "group_1", "sender_id": "user", "content": "[REDPACKET:rp_...]" }
}
```

后端逻辑：

- 从用户钱包扣红包总额。
- 创建 red packet 记录。
- 群里插入 `[REDPACKET:id]` 消息并广播 `group_message`。
- 1.5 秒后触发群 AI 接龙，让角色对红包反应。

异常：

- `400 Invalid red packet type or count`
- `400 Invalid red packet amount`
- `400 Invalid note`
- `404 Group not found`
- `500 { error }`

#### `GET /api/groups/:id/redpackets/:pid`

作用：读取红包详情和领取记录。

返回数据：红包对象。

```json
{
  "id": "rp_...",
  "group_id": "group_1",
  "sender_id": "user",
  "type": "lucky",
  "total_amount": 10,
  "remaining_count": 3,
  "claims": [
    { "claimer_id": "char_1", "amount": 2.5, "name": "角色A", "avatar": "..." }
  ]
}
```

异常：

- `400 Invalid red packet id`
- `404 Group not found`
- `404 Red packet not found`
- `500 { error }`

#### `POST /api/groups/:id/redpackets/:pid/claim`

作用：用户领取群红包。

返回数据：

```json
{ "success": true, "amount": 2.5, "wallet": 522.5 }
```

后端逻辑：

- 当前接口固定 `claimer_id = user`。
- 领取后广播 `redpacket_claim`，包含剩余数量。
- 前端收到事件后刷新红包卡片和用户钱包展示。

异常：

- `400 Invalid red packet id` 或业务失败，例如已领完/已领取。
- `404 Group not found`
- `500 { error }`

### 5.9 城市/日程相关社交接口

以下接口主要由 `ChatSettingsDrawer.jsx` 使用，虽然归属商业街/日程插件，但社交抽屉会展示：

#### `GET /api/city/schedules/:characterId`

作用：读取角色日程。

返回：日程数组或对象，具体字段由 city 插件返回。

异常：`404`、`500`。

#### `POST /api/city/schedules/:characterId/generate`

作用：为角色生成日程。

返回：`{ success: true, ... }`。

后端逻辑：通常会调用模型或城市调度逻辑，并通过 `city_update`/`refresh_contacts` 更新前端。

异常：按 city 插件返回。

#### `GET /api/city/logs?limit=all`

作用：消息气泡里的折叠商业街外联日志可能用它解析原始日志 id。

#### `POST /api/city/logs/:logId/reroll`

作用：重 roll 某条商业街日志叙事。`MessageBubble` 内折叠商业街气泡使用。

这些接口已在商业街交接文档中展开；社交前端只要知道消息气泡依赖即可。

## 6. 容易漏接但后端已有的接口

如果新的前端方案没有写到这些，建议评估是否要补上：

- `GET /api/auth/sessions`、`DELETE /api/auth/sessions/:id`
  账号安全页可显示/撤销登录会话。
- `GET /api/system/announcement`
  全局公告。
- `GET /api/system/embedding-status`
  embedding debug 状态，适合记忆库诊断区。
- `GET /api/system/background-queue`
  后台队列状态，适合记忆库后台任务诊断区。
- `GET /api/characters/:id/cache-stats`
  比 `context-stats` 更底层的角色缓存统计。
- `POST /api/memories/:characterId/maintenance/apply`
  手动应用外部维护结果；如果做“复制 prompt 到外部 AI，再贴回结果”的模式需要它。
- `GET /api/memories/:characterId/maintenance/stats`
  单角色记忆维护统计。
- `POST /api/transfer`
  旧版转账并解除拉黑接口；推荐新转账走 `/api/characters/:id/transfer`。
- `PUT /api/user`
  旧版用户资料更新接口；当前设置页使用 `POST /api/user`，新前端建议不要混用。
- `GET /api/debug/reply-dispatch/:characterId`
  调试接口，可能返回 `501`，只适合开发诊断。
- `POST /api/desktop/session`
  桌面本地 session 接口，普通 Web 前端不要调用；Electron/桌面壳才可能用。

## 7. 新前端布局建议

### 设置页

当前确认采用控制中心布局：

- 左侧设置导航：个人资料、账号安全、角色配置、模型与声音、备份与迁移。
- 中间主编辑区：当前分类的主要表单；角色配置页内含 5 个 tab。
- 右侧状态/预览：当前角色或草稿的头像、人设摘要、就绪检查、模型/TTS/上下文变更影响。

必须保留：

- secret 脱敏展示和清除逻辑。
- 角色模型列表要支持已保存 key 的 `/characters/:id/models`。
- TTS 试听要用 Blob 播放，不要当 JSON 处理。
- 系统导入/清空要强确认。
- 单角色数据导出/导入/重置身体状态这些接口也要保留，不要只做整库备份。

### 记忆库

建议分为：

- 顶部状态条：Qdrant 状态、索引覆盖率、记忆数、缓存命中、后台任务。
- 左侧角色/过滤器。
- 中间记忆表和分组视图。
- 右侧批处理面板：小模型设置、单批 run、自动 run、进度事件。
- 外部导入做成独立 wizard：上传/预览/选角色/提交，自动导入做高级模式。

必须保留：

- 后台 run 的 `memory_maintenance_progress` 监听。
- `latest` 预览恢复。
- 批量选择、批量归档、批量删除、来源查看。
- `dry_run` 和 `raw_response` 展示，方便排查小模型 JSON 错误。

### 社交

建议分为：

- 联系人栏：私聊和群聊都在同一入口，支持未读、最后消息、状态。
- 聊天主区：消息流、输入框、转账/红包/名片入口。
- 右侧详情抽屉：关系、日程、记忆、日记、上下文、调试。
- 群聊顶部操作：暂停 AI、no-chain、成员、群设置、红包。

必须保留：

- 私聊分页 `before`。
- 发送消息后不要只等 HTTP；WebSocket 才是最终消息流。
- blocked 状态要显示用户消息已发送但角色不回复，并引导转账/解除。
- 群聊 @all、@角色 的体验要保留，因为后端会根据内容解析。
- 红包领取用 `redpacket_claim` 实时更新。
- 钱包用 `wallet_sync` 更新，不要只靠本地扣减。

## 8. 源码打包要求

交付给前端实现方的源码压缩包至少应包含：

- `client/src`
- `client/public`
- `client/package.json`
- `client/package-lock.json`
- `docs/frontend-settings-memory-social-handoff.md`

建议同时包含：

- `docs/frontend-redesign-handoff.md`
  MCP、住房系统、商业街日志那份交接文档。
- `client/src/plugins`
  这里已包含在 `client/src` 内，方便对照 MCP/住房/城市插件。

不要只发截图或单文件示例。新前端需要读现有组件里的数据流、WebSocket 事件、工具函数和素材路径。
