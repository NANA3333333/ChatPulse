# 记忆库导入与小模型维护两块前端交接文档

更新时间：2026-07-11

本文只交接当前确认要做的两块 UI：

1. **导入记忆**：GPT / Gemini / SillyTavern / 其他外部 App 聊天记录导入。
2. **小模型批次总结与补标签**：旧库记忆迁移总结、已有新版记忆补来源场景和时间标签。

不要把已经删掉或和其他页面重复的功能做回来。

## 1. 项目与技术栈

- 前端技术栈：React + Vite + CSS，图标使用 `lucide-react`。
- 当前组件：`client/src/components/MemoryLibraryPanel.jsx`
- 当前样式：`client/src/components/MemoryLibraryPanel.css`，全局老样式也在 `client/src/App.css`。
- 入口：`client/src/App.jsx` 里 lazy import `./components/MemoryLibraryPanel`。
- 后端：Node/Express，主要路由在 `server/index.js`，记忆维护逻辑在 `server/memoryMaintenanceService.js`，输入校验在 `server/memoryInputGuards.js`。
- 认证：所有接口都需要 `Authorization: Bearer ${localStorage.getItem('cp_token') || ''}`。

适配目标：

- 桌面端优先，需响应式支持平板和移动端。
- 这两块应作为一个完整的表单工作区展示。
- UI 风格应跟记忆库前面页面一致：蓝白、浅色背景、8px 圆角、清晰分区、按钮和输入框统一，不要再使用粉白独立风格。

## 2. 不要展示的内容

这些内容后端可能还有数据或接口，但当前维护页不要显示：

- 左侧统计栏：正式记忆、卡片调用、待迁移卡片、遗忘曲线等统计卡片。
- 记忆引擎状态卡片：后端模式、连接状态、可检索记忆、RAG 召回率。
- 按角色分类左栏、旧库/新版切换浏览入口。
- 遗忘曲线展开列表。
- 新版语义分类列表。
- 新版来源场景分类列表。
- 商业街来源、私聊来源、群聊来源等分类展开卡片。
- 原生角色记忆工具：导出/抽取、原生导入、维护统计/应用这类卡片式工具。

这些功能和已有浏览/地图/详情页重叠，容易让用户误以为维护页还能继续浏览整库。

## 3. 页面需要表现的功能

### 3.1 通用小模型配置区

这个区域是两块功能的共同前置条件。

需要显示：

- URL 输入框：`settings.api_endpoint`
- 密钥输入框：`settings.api_key`
- 模型名输入框：`settings.model_name`
- 拉取模型按钮：调用 `POST /api/models`
- 保存配置按钮：调用 `PUT /api/memory-maintenance/settings`
- 批量大小滑块：`settings.batch_size`，范围 `10..100`
- 小模型输出上限滑块：`settings.max_output_tokens`，范围 `1000..20000`

前端行为：

- 进入页面时读取 `GET /api/memory-maintenance/overview`，里面带脱敏后的 settings。
- 如果后端返回 `api_key: "••••abcd"`，输入框可以显示该脱敏值；再次保存时后端会识别 masked input 并保留旧 key。
- 点“拉取模型”前必须校验 URL 和 Key 不为空。
- 点“开始工作 / 总结预览 / 自动工作”前必须校验 URL、Key、模型名都存在。

### 3.2 导入记忆区

需要显示：

- 来源下拉：
  - `gpt`：GPT / ChatGPT
  - `gemini`：Gemini
  - `sillytavern`：SillyTavern
  - `external_app`：其他外部 App
- 导入类型下拉：
  - `one_to_one`：一对一，GPT/Gemini 默认使用。
  - `multi_role`：多人/多角色，SillyTavern 默认使用。
- 绑定角色名输入：
  - 仅 `one_to_one` 显示。
  - 默认可以是 `Claude`，用户可改。
- 文本框：
  - 可以粘贴导出的聊天记录。
  - 如果选择文件，可以留空。
- 选择文件按钮：
  - 支持 `.json`、`.jsonl`、`.ndjson`、`.txt`、`.md`、`.markdown`。
- 总结预览按钮：
  - 调 `POST /api/memory-import/external/preview`。
  - 返回候选后显示角色标签和记忆候选。
- 创建角色并写入按钮：
  - 仅预览成功后显示。
  - 调 `POST /api/memory-import/external/:importId/commit`。
- 自动导入总结按钮：
  - 可选，但建议保留。
  - 调 `POST /api/memory-import/external/auto-run`，直接分批总结并写入，不需要人工 commit。

预览结果需要展示：

- import id、来源、导入模式、文件名、消息数。
- 识别出的角色标签 `role_tags`：名称、置信度、理由；可勾选/取消。
- 候选记忆 `candidates`：summary、character_names、memory_focus、memory_tier、importance、source_refs。
- 需复核项 `needs_review`。
- 清洗统计：原始消息数、清洗后消息数、修改数、丢弃噪声数、JSONL 解析行数。
- 模型信息：模型名、finish reason、usage。

业务逻辑：

- 前端可先用文件名和前 300000 字符做来源自动识别：
  - SillyTavern：文件名含 tavern/imported.jsonl，或内容含 `"chat_metadata"`、`"swipes"`、`"mes"`、`"send_date"`、`LWB_`、`<recall>`。
  - Gemini：文件名含 gemini/bard，或内容含 `"chunkedPrompt"`、`"model":"gemini"`。
  - GPT：文件名含 chatgpt/openai/conversations.json，或内容含 `"mapping"`、`"conversation_id"`、`"author"`。
- 后端也会再检测一次，后端检测结果优先。
- 预览只写入 `external_memory_imports`，不写正式 memories。
- commit 才会写入正式新版记忆。
- SillyTavern / multi_role 可能使用“外部共享导入库”存储共享记忆，并把记忆绑定到多个角色。
- one_to_one 默认把候选写到唯一目标角色。
- 写入后后端会广播：
  - `memory_update`
  - `refresh_contacts`

## 4. 接口总规则

Base URL：前端用传入的 `apiUrl`，通常是 `/api`。

JSON 请求头：

```js
{
  "Content-Type": "application/json",
  "Authorization": `Bearer ${localStorage.getItem('cp_token') || ''}`
}
```

FormData 请求头：

```js
{
  "Authorization": `Bearer ${localStorage.getItem('cp_token') || ''}`
}
```

不要手动设置 `Content-Type`，让浏览器带 boundary。

通用异常：

- `401/403`：登录失效或无权限，由全局登录态处理。
- `400`：参数缺失、参数越界、模型配置缺失、文件不可读。
- `404`：角色、run、import 不存在。
- `422`：小模型返回可解析但结果不可用，或没有提取出候选。
- `500`：服务端错误。
- `504`：小模型超时。

前端错误展示规则：

- 如果响应里有 `error`，优先显示 `error`。
- 如果有 `raw_response` / `raw_response_preview`，放到“错误详情/模型原始返回”里，方便用户判断是不是 JSON 格式问题。
- 如果有 `needs_review`，不要当成失败；应作为“需复核”列表展示。

## 5. 通用接口

### 5.1 读取维护总览

`GET /api/memory-maintenance/overview`

请求参数：无。

返回示例：

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
  },
  "overview": {
    "totals": {},
    "by_character": [],
    "legacy_by_character": [],
    "migration_characters": [],
    "upcoming_forgetting": []
  }
}
```

作用：

- 给页面初始化 settings。
- 给角色选择下拉提供 `migration_characters` 和 `by_character`。
- 页面不要渲染 `upcoming_forgetting` 等分类列表。

后端逻辑：

- 读取 user profile 中的 `memory_maintenance_*` 配置。
- 先清理到期 forgetting memories。
- 统计新版记忆、旧库待迁移记忆、角色维度数据。

异常：

- `500 Raw database handle is unavailable.`
- `500 { "error": "..." }`

### 5.2 保存小模型配置

`PUT /api/memory-maintenance/settings`

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

返回：

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

后端逻辑：

- 保存到 user profile：
  - `memory_maintenance_api_endpoint`
  - `memory_maintenance_api_key`
  - `memory_maintenance_model_name`
  - `memory_maintenance_batch_size`
  - `memory_maintenance_max_tokens`
- 如果 `api_key` 是 `••••abcd` 或 `****abcd` 这类 masked input，保留旧 key。
- `batch_size` 必须是整数 `10..100`。
- `max_output_tokens` 必须是整数 `1000..20000`。

异常：

- `400 batch_size must be an integer from 10 to 100.`
- `400 max_output_tokens must be an integer from 1000 to 20000.`
- `500 { "error": "..." }`

### 5.3 拉取模型列表

`POST /api/models`

请求参数：

```json
{
  "endpoint": "https://api.openai.com/v1",
  "key": "sk-..."
}
```

返回：

```json
{
  "models": ["gpt-4o-mini", "gpt-4.1-mini"]
}
```

后端逻辑：

- 后端代理访问 `${endpoint}/models`，避免前端 CORS 和密钥暴露。
- 18 秒超时。
- 兼容 OpenAI 形态返回：从 `data[].id`、`models[].name` 或字符串数组提取模型名。

异常：

- `400 Missing endpoint or key`
- `504 请求超时`
- 上游错误：透传状态码，返回 `API ${status}: ...`
- `500 { "error": "..." }`

## 6. 导入记忆接口

### 6.1 恢复最近未提交预览

`GET /api/memory-import/external/latest`

请求参数：无。

返回：

```json
{
  "success": true,
  "import": {
    "id": 12,
    "source_app": "sillytavern",
    "import_mode": "multi_role",
    "filename": "chat.jsonl",
    "message_count": 300,
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

没有可恢复预览：

```json
{ "success": true, "import": null }
```

后端逻辑：

- 查询 `external_memory_imports` 中 `committed_at = 0` 的最新记录。
- 返回保存过的 summary、role_tags、候选和原始消息数量。

异常：

- `500 Raw database handle is unavailable.`
- `500 { "error": "..." }`

### 6.2 预览外部导入

`POST /api/memory-import/external/preview`

请求类型：`multipart/form-data`

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | File | 否 | 任意文件字段名都可以，后端 `memoryImportUpload.any()`。 |
| `text` | string | 否 | 粘贴的聊天记录。`file` 和 `text` 至少一个。 |
| `source_app` | string | 否 | `gpt` / `gemini` / `sillytavern` / `external_app`。 |
| `import_mode` | string | 否 | `one_to_one` / `multi_role`。 |
| `target_character_name` | string | one_to_one 建议填 | 一对一目标角色名。 |

别名：

- `source_app` 也接受 `source` / `app`。
- `import_mode` 也接受 `mode`。
- `target_character_name` 也接受 `character_name`。

返回：

```json
{
  "success": true,
  "import": {
    "id": 12,
    "source_app": "sillytavern",
    "import_mode": "multi_role",
    "filename": "chat.jsonl",
    "message_count": 300,
    "created_at": 1710000000000,
    "detected_source_app": "sillytavern"
  },
  "role_tags": [
    {
      "name": "Claude",
      "aliases": [],
      "confidence": 0.9,
      "reason": "小模型从导入记录中识别。",
      "profile": { "name": "Claude", "persona": "" }
    }
  ],
  "candidates": [
    {
      "id": "c1",
      "summary": "中文正式记忆",
      "content": "更完整的中文概况",
      "character_names": ["Claude"],
      "memory_focus": "relationship",
      "memory_tier": "active",
      "importance": 7,
      "consolidation_key": "stable_key",
      "source_refs": ["m1", "m2"],
      "source_started_at": 1710000000000,
      "source_ended_at": 1710000060000,
      "source_time_text": "2026-07-11 12:00",
      "source_message_count": 2,
      "reason": "一句中文理由"
    }
  ],
  "needs_review": [],
  "model": {
    "name": "gpt-4o-mini",
    "usage": null,
    "finishReason": "stop"
  },
  "prompt_stats": {
    "row_count": 300,
    "prompt_chars": 12000,
    "clean_stats": {
      "original_messages": 300,
      "cleaned_messages": 280,
      "changed_messages": 20,
      "dropped_messages": 5,
      "jsonl_parsed_lines": 300,
      "jsonl_failed_lines": 0,
      "raw_chars": 100000,
      "stored_raw_chars": 100000
    }
  },
  "raw_response_preview": "{...}"
}
```

后端逻辑：

- 读取小模型配置，缺 URL/Key/Model 则拒绝。
- 读取上传文件或 `text`。
- 自动检测来源 App。
- JSON/JSONL 会尽量从常见字段里收集消息；普通文本按 `说话人: 内容` 或段落切消息。
- 清理系统提示、推理块、模板噪声、空行。
- 限制：
  - 原始存储文本最多 180000 字符。
  - prompt 输入最多 70000 字符。
  - 消息最多 360 条。
  - 单条消息最多 50000 字符。
  - 候选记忆最多 160 条。
  - 小模型超时默认 180000ms。
- 调小模型：
  - `temperature: 0.1`
  - `responseFormat: { type: "json_object" }`
  - `maxTokens` 用 settings 的 `max_output_tokens`，范围 `1500..20000`。
- 归一化小模型输出：
  - `summary/content` 必须是中文有效内容。
  - `memory_focus` 限制为 `user_profile | relationship | user_current_arc | general`。
  - `memory_tier` 限制为 `core | active | ambient`。
  - `importance` clamp 到 `1..10`。
  - `source_refs` 必须指向输入消息 id。
- 保存 preview 到 `external_memory_imports`，但不写正式记忆。

异常：

- `400 No external conversation text or file was provided.`
- `400 请先配置“记忆库管理小模型”的 URL、Key 和模型。`
- `400 Invalid memory import file type. Use .json, .jsonl, .txt, or .md.`
- `422 小模型没有提取出可导入的新记忆。`
  - 可能带 `raw_response`、`role_tags`、`needs_review`。
- `504` 小模型超时。
- `500 { "error": "..." }`

### 6.3 提交外部导入预览

`POST /api/memory-import/external/:importId/commit`

请求参数：

```json
{
  "selected_role_names": ["Claude", "Gemini"],
  "create_characters": true
}
```

返回：

```json
{
  "success": true,
  "import_id": 12,
  "imported_as": "external_direct",
  "characters": [
    { "id": "char-xxx", "name": "Claude", "created": true }
  ],
  "queued": 0,
  "imported": 10,
  "ids": [101, 102],
  "skipped": [],
  "errors": []
}
```

后端逻辑：

- 查找 `external_memory_imports` 的 preview。
- 如果未传 `selected_role_names`，默认用全部 `role_tags`。
- 按选中角色过滤 candidates。
- 创建或复用同名角色。
- 调 `saveExternalImportCandidatesDirect` 写正式 memories。
- `source_context` 固定写 `external_app`。
- `scene_tag` 按来源写：
  - `gpt` -> `external_gpt`
  - `gemini` -> `external_gemini`
  - `sillytavern` -> `external_sillytavern`
  - 其他 -> `external_app`
- 写入后更新 import 的 `selected_character_ids_json`、`memory_ids_json`、`committed_at`。
- 广播 `memory_update` 和 `refresh_contacts`。

异常：

- `400 请选择至少一个角色标签。`
- `400 所选角色没有匹配到可写入的导入候选。`
- `404 External import preview not found.`
- `422 导入候选保存失败。`
- `500 { "error": "..." }`

### 6.4 自动外部导入总结

`POST /api/memory-import/external/auto-run`

请求类型：`multipart/form-data`

请求字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | File | 否 | 外部导出文件。 |
| `text` | string | 否 | 粘贴文本。 |
| `source_app` | string | 否 | `gpt` / `gemini` / `sillytavern` / `external_app`。 |
| `import_mode` | string | 否 | `one_to_one` / `multi_role`。 |
| `target_character_name` | string | 否 | 一对一目标角色。 |
| `limit` | number | 否 | 每批消息数，`1..100`，前端建议用 `10..100`。 |
| `max_batches` | number/string | 否 | 最大批次数；空或 `all` 可表示跑到结束。 |
| `run_until_empty` | boolean/string | 否 | 是否跑到没有剩余。 |
| `max_rerolls` | number | 否 | 自动导入当前前端传 `0`。后端允许到 3。 |
| `background` | boolean/string | 否 | 建议传 `true`。 |
| `dry_run` | boolean/string | 否 | 只预演不写库。 |
| `continue_import_id` | number | 否 | 从某个 import 断点继续。 |
| `continue_from_offset` | number | 否 | 跳过已处理消息数。 |
| `retry_latest_external_import` | boolean/string | 否 | 不知道 import id 时重试最近一条。 |

后台模式返回：

```json
{
  "success": true,
  "accepted": true,
  "reused": false,
  "run": {
    "run_id": "external-import-...",
    "task_mode": "external_import",
    "characterId": "__external_import__",
    "phase": "queued",
    "running": true,
    "limit": 10,
    "processed": 0,
    "updated": 0,
    "events": []
  }
}
```

完成结果返回：

```json
{
  "success": true,
  "mode": "external_import_auto",
  "dry_run": false,
  "import_id": 12,
  "source_app": "sillytavern",
  "import_mode": "multi_role",
  "filename": "chat.jsonl",
  "limit": 10,
  "max_batches": null,
  "run_until_empty": true,
  "max_rerolls": 0,
  "processed": 300,
  "updated": 40,
  "applied_errors": 0,
  "stopped_reason": "completed",
  "roles": [],
  "characters": [],
  "saved": [],
  "errors": [],
  "runs": [],
  "prompt": {},
  "raw_response_preview": "{...}",
  "can_continue": false,
  "continue_from": {
    "import_id": 12,
    "offset": 300,
    "pending": 0,
    "total": 300
  },
  "stats": {
    "message_count": 300,
    "batch_count": 30,
    "candidates": 40,
    "saved": 40,
    "saved_bindings": 40,
    "needs_review": 0
  }
}
```

后端逻辑：

- 不经过人工 preview/commit，直接分批调用小模型并写入正式 memories。
- 若 `background=true`，立即返回 `accepted`，实际任务进入后台队列。
- 同一用户同一外部导入只允许一个 active run；如果已有，返回 `reused: true`。
- 每批处理 `limit` 条 normalized messages。
- 断点继续时使用 `continue_import_id` 和 `continue_from_offset`。
- 任务期间广播 `memory_maintenance_progress`，`task_mode = external_import`。
- 停止原因可能是：
  - `completed`
  - `empty`
  - `no_candidates`
  - `error`
  - `no_progress`
  - `dry_run`
  - `queue_full`
  - `duplicate`

异常：

- `400` 小模型配置缺失、参数非法、无文件/文本。
- `404 External import record not found.`
- `422 This external import has no stored normalized messages to retry.`
- `422` 运行停止但有结果。
- `500 { "error": "..." }`

## 7. 小模型批次总结 / 补标签接口

### 7.1 批次 Prompt 预览：完整迁移/总结

`GET /api/memories/:characterId/maintenance/batch`

请求参数：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | number | 30 | `1..100`，前端滑块建议 `10..100`。 |
| `offset` | number | 0 | 第几批换算：`(batchIndex - 1) * limit`。 |
| `after_id` | number | 0 | 可选游标。 |
| `status` | string | `pending` | 通常固定 pending。 |
| `include_archived` | boolean | false | 是否包含归档。 |

返回：

```json
{
  "success": true,
  "character": { "id": "char-1", "name": "Claude" },
  "prompt": {
    "system_prompt": "...",
    "user_prompt": "...",
    "full_prompt": "..."
  },
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
  "item_count": 0,
  "batch_index": 1,
  "total_batches": 0,
  "remaining_pending": 0,
  "next_after_id": 0
}
```

前端表现：

- 点“预览 Prompt”调用。
- 展示 `prompt.full_prompt`。
- 展示批次信息：第几批、总批数、items 数、下一游标、剩余 pending。

异常：

- `400` limit/offset 非法。
- `404 Character not found`
- `500 Raw database handle is unavailable.`

### 7.2 手动运行：完整迁移/总结

`POST /api/memories/:characterId/maintenance/run`

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

返回：

```json
{
  "success": true,
  "mode": "single",
  "empty": false,
  "character": { "id": "char-1", "name": "Claude" },
  "batch": {
    "batch_index": 1,
    "item_count": 30,
    "ids": [1, 2]
  },
  "normalized": {
    "items": [],
    "errors": [],
    "new_memory_count": 12
  },
  "apply": {
    "updated": 28,
    "errors": []
  },
  "prompt": {},
  "raw_response": "...",
  "model": {
    "name": "gpt-4o-mini",
    "finishReason": "stop"
  },
  "rebuiltMemoryIndex": false,
  "rebuildWarning": ""
}
```

后端逻辑：

- 要求已保存小模型 URL、Key、模型名。
- 拉取一批 pending 旧记忆卡片。
- 构造迁移/总结 prompt。
- 调小模型并解析 JSON。
- 应用输出：写入/更新维护状态、新版正式记忆、合并 key、来源场景、时间标签等。
- 默认广播 `memory_update`。
- `rebuild_index=true` 时会尝试重建该角色索引。

异常：

- `400 Memory maintenance model URL, key, and model are required.`
- `404 Character not found`
- `422/500` 小模型输出不可用，可能带 `prompt`、`raw_response`、`normalized.errors`。

### 7.3 自动运行：完整迁移/总结

`POST /api/memories/:characterId/maintenance/auto-run`

请求参数：

```json
{
  "limit": 30,
  "max_batches": 10,
  "run_until_empty": false,
  "max_rerolls": 3,
  "status": "pending",
  "continue_from_breakpoint": false,
  "background": true,
  "dry_run": false,
  "rebuild_index": false
}
```

后台模式返回：

```json
{
  "success": true,
  "accepted": true,
  "reused": false,
  "run": {
    "run_id": "char-1-...",
    "characterId": "char-1",
    "phase": "queued",
    "running": true,
    "limit": 30,
    "max_batches": 10,
    "run_until_empty": false,
    "processed": 0,
    "updated": 0,
    "events": []
  }
}
```

完成结果：

```json
{
  "success": true,
  "character": { "id": "char-1", "name": "Claude" },
  "mode": "auto",
  "dry_run": false,
  "limit": 30,
  "max_batches": 10,
  "run_until_empty": false,
  "max_rerolls": 3,
  "processed": 120,
  "updated": 110,
  "applied_errors": 0,
  "stopped_reason": "completed",
  "errors": [],
  "runs": [],
  "prompt": {},
  "raw_response": "...",
  "stats": {},
  "can_continue": false,
  "continue_from": {
    "status": "pending",
    "offset": 120,
    "pending": 0
  }
}
```

前端表现：

- 自动模式下，如果连续跑几批输入为空，应传 `max_batches: null` 或空，并传 `run_until_empty: true`。
- 如果传 `background: true`，不要等任务结束；进入进度视图。
- 如果返回 `reused: true`，说明后端已有任务，直接恢复进度。
- 如果结果 `can_continue = true`，显示“从断点继续”按钮，再次调用同接口并传 `continue_from_breakpoint: true`。

后端逻辑：

- 同一用户同一角色只允许一个运行中的维护任务。
- 后台队列 dedupe key：`memory-maintenance:{userId}:{characterId}`。
- 每批失败会按 `max_rerolls` 重试。
- 非可重试错误，如鉴权失败，会停止并返回 `auth_error`。
- 队列重复或队列满会通过进度事件标记 stopped。

异常：

- `400` 参数非法或模型配置缺失。
- `404 Character not found`
- `422` 自动运行停止但有结果。
- `500 { "error": "..." }`

### 7.4 批次 Prompt 预览：补来源/场景/时间标签

`GET /api/memories/:characterId/maintenance/temporal-binding-batch`

请求参数：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | number | 40 | `1..100`。 |
| `offset` | number | 0 | 第几批换算。 |
| `source` | string | `new` | 当前前端固定传 `new`。 |
| `include_archived` | boolean | false | 是否包含归档。 |

返回：

```json
{
  "success": true,
  "character": { "id": "char-1", "name": "Claude" },
  "prompt": {
    "system_prompt": "...",
    "user_prompt": "...",
    "full_prompt": "..."
  },
  "task": {
    "purpose": "Source/scene and time-label-only pass for existing memories. Do not change memory_focus, do not summarize, do not delete memories.",
    "recommended_batch_size": 40,
    "allowed_source_contexts": ["private_chat", "group_chat", "commercial_street", "external_app", "unknown"],
    "allowed_scene_tags": [],
    "allowed_labels": [],
    "allowed_scopes": [],
    "validator": "normalizeTemporalBindingResult",
    "known_ids": [1, 2]
  },
  "items": []
}
```

业务逻辑：

- 只给已有新版正式记忆补 `source_context`、`scene_tag`、时间强绑定标签。
- 不改 `summary/content`。
- 不改 `memory_focus`。
- 不删除、不归档。

异常：同 batch。

### 7.5 手动运行：补来源/场景/时间标签

`POST /api/memories/:characterId/maintenance/temporal-binding-run`

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

返回：

```json
{
  "success": true,
  "mode": "supplement",
  "batch": { "item_count": 40, "ids": [1, 2] },
  "normalized": {
    "source_label_count": 20,
    "time_label_count": 15,
    "errors": []
  },
  "apply": {
    "updated": 35,
    "errors": []
  },
  "prompt": {},
  "raw_response": "...",
  "rebuiltMemoryIndex": false,
  "rebuildWarning": ""
}
```

后端逻辑：

- 要求小模型配置完整。
- 调 `runMemoryTemporalBindingBatch`。
- 应用来源/场景/时间标签。
- 广播 `memory_update`。

异常：

- `400 Memory maintenance model URL, key, and model are required.`
- `404 Character not found`
- `422/500` 小模型输出不可用，可能带 `payload`。

### 7.6 自动运行：补来源/场景/时间标签

`POST /api/memories/:characterId/maintenance/temporal-binding-auto-run`

请求参数：

```json
{
  "source": "new",
  "limit": 40,
  "max_batches": 10,
  "run_until_empty": false,
  "max_rerolls": 3,
  "continue_from_breakpoint": false,
  "background": true,
  "dry_run": false
}
```

返回和 `maintenance/auto-run` 类似，但：

- `task_mode` 为 `supplement`
- `updated` 表示写回标签的记忆数
- `runs[].source_label_count` 表示来源/场景标签数量
- `runs[].time_label_count` 表示时间标签数量

业务逻辑：

- 进入后台队列，dedupe key：`memory-maintenance:{userId}:{characterId}:supplement`。
- 按批扫描当前角色的新版记忆。
- 失败重 roll，成功后继续下一批。
- 出错时可通过 `continue_from` 继续。

异常：同自动总结。

### 7.7 查询后台任务

`GET /api/memory-maintenance/runs?active=1&character_id=...`

请求参数：

- `active=1`：只返回运行中的任务。
- `character_id`：可选。外部导入的角色 id 固定是 `__external_import__`。

返回：

```json
{
  "success": true,
  "runs": [
    {
      "run_id": "char-1-...",
      "characterId": "char-1",
      "task_mode": "supplement",
      "phase": "batch_success",
      "running": true,
      "processed": 40,
      "updated": 35,
      "applied_errors": 0,
      "events": []
    }
  ]
}
```

`GET /api/memory-maintenance/runs/:runId`

返回：

```json
{
  "success": true,
  "run": {
    "run_id": "...",
    "phase": "attempt_start",
    "running": true,
    "events": []
  }
}
```

异常：

- `404 Run not found`
- `500 { "error": "..." }`

### 7.8 WebSocket 进度事件

后端会发 WebSocket：

```json
{
  "type": "memory_maintenance_progress",
  "data": {
    "run_id": "...",
    "task_mode": "external_import",
    "phase": "batch_success",
    "characterId": "__external_import__",
    "character": { "id": "__external_import__", "name": "外部导入" },
    "limit": 10,
    "max_batches": null,
    "run_until_empty": true,
    "max_rerolls": 0,
    "processed": 100,
    "updated": 12,
    "applied_errors": 0,
    "batch_number": 10,
    "attempt": 1,
    "remaining_pending_after_batch": 200,
    "new_memory_samples": ["中文记忆摘要"],
    "stopped_reason": "",
    "can_continue": false,
    "continue_from": null,
    "errors": [],
    "stats": {},
    "timestamp": 1710000000000
  }
}
```

当前 `App.jsx` 会转成浏览器事件：

```js
window.dispatchEvent(new CustomEvent('memory_maintenance_progress', { detail: msg.data || {} }));
```

前端应监听：

```js
window.addEventListener('memory_maintenance_progress', handleProgress);
```

常见 phase：

- `queued`
- `start`
- `batch_start`
- `attempt_start`
- `attempt_result`
- `attempt_error`
- `attempt_no_progress`
- `batch_success`
- `done`
- `stopped`

进度区需要表现：

- 当前任务类型：
  - 默认/空：自动总结
  - `supplement`：自动补标签
  - `external_import`：外部导入
- 当前阶段中文名。
- 批次号、尝试次数、已处理、已写回、剩余、写库错误。
- 最新几条 `new_memory_samples`。
- 如果 `running=false` 且失败，展示 `stopped_reason`、`errors`、`raw_response_preview`。
- 如果 `can_continue=true`，展示断点继续按钮。

## 8. 页面状态和按钮启用条件

建议前端状态：

```ts
type Settings = {
  api_endpoint: string;
  api_key: string;
  model_name: string;
  batch_size: number;
  max_output_tokens: number;
};

type MaintenanceMode = 'manual' | 'auto';
type PromptTaskMode = 'complete' | 'supplement';
type ExternalSourceApp = 'gpt' | 'gemini' | 'sillytavern' | 'external_app';
type ExternalImportMode = 'one_to_one' | 'multi_role';
```

按钮规则：

- 保存配置：URL / Key / 模型名可以为空保存，但开始任务前必须完整。
- 拉取模型：URL + Key 必填。
- 总结预览：需要文件或文本 + 小模型配置完整。
- 创建角色并写入：必须有 `externalImportPreview.import.id`，且至少选择一个 role tag。
- 手动预览 Prompt：必须选中角色；补充/完整按当前 task mode 调不同接口。
- 手动开始工作：必须选中角色 + 小模型配置完整。
- 自动开始工作：必须选中角色 + 小模型配置完整；如果无可处理项，显示空状态，不要弹一堆错误。
- 运行中禁用相关按钮，显示 loading。

## 9. 推荐页面结构

只需要这几个区块：

1. 小模型配置行
   - URL、Key、模型、拉取模型、保存配置。
2. 导入记忆区
   - 来源、导入类型、绑定角色名、文本框、选择文件、总结预览、预览结果、创建角色并写入。
3. 批次设置区
   - 每轮读取条数 slider。
   - 输出上限 slider。
4. 工作模式区
   - 手动选择批次总结 / 自动总结。
   - 角色选择。
   - 完整 / 补充。
   - 手动批次号或自动批次数。
   - 预览 Prompt / 开始工作。
5. 进度和结果区
   - 后台进度。
   - run result。
   - Prompt 预览。

不要在这个页面加：

- 角色分类浏览。
- 整库统计卡片。
- 记忆引擎状态。
- 分类展开列表。
- 商业街/私聊/群聊来源列表。

## 10. 当前源码目录交付范围

如果给其他前端 AI 源码，至少包含：

- `client/src/components/MemoryLibraryPanel.jsx`
- `client/src/components/MemoryLibraryPanel.css`
- `client/src/App.jsx`
- `client/src/App.css`
- `client/src/index.css`
- `client/package.json`
- 根目录 `package.json`
- 相关后端参考：
  - `server/index.js`
  - `server/memoryMaintenanceService.js`
  - `server/memoryInputGuards.js`
- 本文档：
  - `docs/memory-import-maintenance-two-blocks-handoff.md`

## 11. 已有但本页不建议接入的重要接口

这些接口后端存在，但本次两块 UI 不要主动暴露：

- `GET /api/memory-maintenance/library`
  - 当前代码可能仍用于读取数据，但不要把它返回的分类列表渲染成维护页大卡片。
- `GET /api/memories/:characterId/maintenance/stats`
  - 单角色维护统计，和已删除统计栏重复。
- `POST /api/memories/:characterId/maintenance/apply`
  - 人工应用外部维护结果，本页用后端 run 自动应用即可。
- `GET /api/memories/:characterId/export`
- `POST /api/memories/:characterId/import`
- `POST /api/memories/:characterId/extract`

如果未来单独做“高级工具/调试页”，再放这些，不要混进当前导入与小模型工作区。
