# 记忆库修改后必做

这份清单用于任何涉及记忆库的改动：SQLite `memories` 表、Qdrant 索引、记忆导入导出、遗忘曲线、小模型迁移 prompt、记忆库前端页面。

## 先确认概念

修改前必须明确这三层，不要混用名称：

- 源原文：原始私聊、群聊、city 日志、日记等原始文本。它们存放在各自来源表里。
- 记忆卡片：`memories.summary/content`，是模型从源原文抽取出来的记忆，不是原文。
- 新版记忆库：`memories.consolidation_summary`，是小模型从旧记忆卡片归纳出的正式记忆文本。现在 RAG、历史记忆统计、时间线和记忆库前端默认都只读取它；旧 `summary/content` 只作为迁移来源和只读备份，不再作为 RAG fallback。
- 索引文本：embedding/Qdrant 使用的拼接文本，可以由记忆卡片和元信息重建，不是数据库真相。

当前历史库不完全符合未来理想格式，尤其是 `source_message_ids_json` 里可能出现 `city:3285` 这类来源引用。因此改动时不要假设它只包含私聊 message id。

## 禁止事项

- 不要把 Qdrant 当唯一记忆库。Qdrant 只是索引层。
- 不要把 `memories.content` 当作原始对话全文。
- 不要让小模型迁移 prompt 吃源原文或 embedding 索引文本。
- 不要让聊天 RAG 在已有 `consolidation_summary` 时继续优先召回旧 `summary/content`。
- 不要让聊天 RAG 在没有 `consolidation_summary` 时自动回退召回旧 `summary/content`；未迁移角色应该表现为暂无可召回记忆，等重新建立新版库。
- 不要在没有导出/备份能力的情况下批量覆盖记忆。
- 不要改记忆 schema 后只测前端，不测导入导出和索引重建。
- 不要用旧记忆的创建/更新时间倒推出已经过期的缓冲截止时间；缓冲期必须从首次进入遗忘缓冲池开始算。

## 小模型迁移输入规范

小模型只吃旧记忆卡片概况，格式应保持紧凑：

```json
{
  "input_kind": "old_memory_card_compact_rows",
  "fields": ["id", "memory_card_text", "focus", "tier", "importance", "calls", "score", "forget_in_days", "action"],
  "rows": [
    [6161, "身体出现膝盖响动和手指僵硬的劳损迹象", "user_profile", "ambient", 4, 0, 1, null, "keep"]
  ]
}
```

必须明确提示：输入不是原始对话/日志，也不是 embedding 索引文本。

## 分类边界

`memory_focus` 当前允许：

- `user_profile`：长期稳定的用户身份、偏好、背景、边界、长期目标。
- `relationship`：用户与角色之间的承诺、冲突、和解、告白、亲密度变化和相处边界。
- `user_current_arc`：近期阶段、任务、压力、短期计划。
- `general`：不属于以上分类的普通事实和背景事件。

商业街、群聊、外部 App 导入不要新增为 `memory_focus`。它们属于来源/场景维度；当前版本不使用日记/动态作为来源分类，疑似日记/动态但无法归入现有来源时标 `unknown/other`：

- `source_context`：`private_chat`、`group_chat`、`commercial_street`、`external_app`、`unknown`。
- `scene_tag`：`private_chat`、`group_chat`、`commercial_street`、`external_gpt`、`external_gemini`、`external_sillytavern`、`external_app`、`other`、`none`。

同一条记忆可以同时是 `relationship` 和 `group_chat`，或者 `user_current_arc` 和 `commercial_street`。不要把来源/场景混进语义分类。

W 参数的长时记忆消化必须按来源分池：

- 私聊池只读取 `messages`，只标记这批私聊消息为已消化，生成 `source_context = private_chat` / `scene_tag = private_chat`。
- 群聊池只读取 `group_messages`，只标记这批群聊消息为已消化，生成 `source_context = group_chat` / `scene_tag = group_chat`。
- 商业街池只读取 city logs，只标记这批商业街日志为已消化，生成 `source_context = commercial_street` / `scene_tag = commercial_street`。
- 三个池分别累计到阈值后独立整理，不能因为私聊达到阈值就顺手整理或清零群聊、商业街。

临时身体/情绪状态保留在原语义分类中，不单独作为 `memory_focus`。例如痛经、当天疲惫、临时所在地可以仍属于 `user_current_arc` 或 `general`；后续用时间轴、关键词筛选或二轮小模型筛选做横向标记。除非卡片明确表示长期、反复、慢性或稳定偏好，不要写进 `user_profile`。

现在固定保留两套小模型提示词：

- `memory-card-migration-time-tags-v9`：旧库/外部 App 导入记忆迁移进新版库，同时输出 `source_context`、`scene_tag` 和时间标签。
- `memory-source-scene-time-label-v6`：只给已有新版记忆补 `source_context`、`scene_tag` 和时间标签，不改写记忆、不改变 `memory_focus`、不做归纳迁移。

主语判定是硬规则：`用户/Nana` 只指真实用户；`当前角色/角色/角色名` 才指角色。`commercial_street`、商业街、city 活动、工厂、餐厅、便利店、公园、回家、领工钱、日结等第一人称生活日志，默认是角色在商业街发生的事，不是用户做的事。迁移 prompt 不能把“角色在工厂搬货、吃饭、回家、赚钱”写成“用户在工厂/餐厅/商业街……”。这类角色生活日志通常归 `general + commercial_street`，只有直接改变用户与角色关系时才归 `relationship`。反过来，主语是 `用户/Nana/User` 的记忆禁止标 `commercial_street`；即使内容提到商业街、商业街可视化或批次中混有 `city:` source_id，也应按内容标 `private_chat` 或 `unknown`。

不要让小模型把普通记忆写成“在角色扮演中……”。这里的“角色”只是数据库对象或当前对话对象，不等于 roleplay。summary 是给主模型召回的正式记忆，普通事件应直接写“Claude……”“Nana……”；只有输入明确讨论角色扮演机制、API 互动元矛盾或扮演规则本身时，才可以提元层语境，而且优先写“互动语境/元层矛盾”，不要把所有经历都包装成“角色扮演”。

同一套主语判定必须同时覆盖源头写入层，不只覆盖旧库迁移层：

- 即时私聊/群聊记忆抽取：`User:` 行才是用户，`角色名:` 行才是角色。
- 私聊上下文总结：必须保留谁说了什么，不能把角色自述转写成用户经历。
- 群聊摘要：每个可见说话人就是主语，群友的“我”不能合并成用户。
- 日结聚合：按 `[private_chat]`、`[group_chat]`、`[commercial_street]` 前缀判断来源和主语；不要再产生日记/动态来源分类。
- W 参数长时消化：三池分开，私聊池、群聊池、商业街池各自只写自己的 `source_context/scene_tag`；商业街池里的“我”默认是当前角色。
- 输出记忆卡片时 summary/content 必须显式写主语；不允许用模糊的“最近……”逃避主语判断。

前端时间线应保持为横向可缩放的知识图谱式节点轴：中间是一条主干横线，日期节点是挂在主线上的深色小块，记忆条目以浅色卡片从节点上下分叉，颜色代表临时状态/持续阶段/周期性/一次事件/长期事实等横向状态。节点渲染必须有最小横向间距，避免分支卡片互相遮挡。用户要求所有记忆都挂到节点上，不要用 `+N` 折叠隐藏；节点明细列表作为辅助查看。

时间线不是普通“按创建日期排序”。正式时间线只能读取时间强绑定记忆：

- 时间线、临时状态词筛选、商业街/群聊/外部 App 来源标记都只指向新版记忆库，即有 `consolidation_summary` 的正式记忆承载行。
- 旧库备份只作为迁移来源和备份查看，不参与补标签筛选，不驱动正式时间线。
- 后端默认 `timeline_filter = strong_time_bound`。
- 必须有小模型写入的 `temporal_label`，且 `temporal_confidence >= 0.5`，才进入时间线。
- 普通长期事实即使有 `source_time_text` 或 `created_at`，也不能进入正式时间线。
- `timeline_filter = temporal_signal` 只作为二轮扫描预筛接口，用关键词找候选；`timeline_filter = all` 只允许调试，不应作为默认前端。

## 每次改完必测

后端语法：

```powershell
node --check server/index.js
node --check server/db.js
node --check server/memory.js
```

前端构建：

```powershell
npm --prefix client run build
```

前端 lint：

```powershell
cd client
npm exec eslint -- src/App.jsx src/components/MemoryLibraryPanel.jsx
```

如果重启后端，优先使用项目内 Node20，避免系统 Node 和 `better-sqlite3` ABI 不匹配：

```powershell
.\.runtime\node20\node.exe server/index.js
```

## 接口必须检查

- `GET /api/memory-maintenance/overview`
- `GET /api/memory-maintenance/library?all=1`
- `GET /api/memories/:characterId/maintenance/batch?limit=30&status=pending`
- `POST /api/memory-maintenance/rescue`
- 单角色完整导入导出：`/api/data/:characterId/export` 与 `/api/data/:characterId/import`

检查点：

- 记忆总数、角色总数、分类数是否合理。
- 分类页是否仍能全量显示，但使用折叠气泡和内部滚动。
- prompt 预览是否为 `memory-card-migration-time-tags-v9` 或更新版本。
- 来源场景 + 时间标签 prompt 预览是否为 `memory-source-scene-time-label-v6` 或更新版本。
- prompt 中不应出现完整 `content` 字段或源原文。
- 时间线默认是否只显示带 `temporal_label` 且置信度足够的时间强绑定记忆。
- 救回记忆后，遗忘区和活跃记忆状态要刷新。
- 旧记忆第一次进入遗忘缓冲池时，`forgetting_grace_started_at` 应该接近当前时间，`forgetting_grace_expires_at` 应该是约 24 小时后。
- 小模型归纳后的结果要能在前端“新版总结”视图看到；当前来源是旧卡片上的 `consolidation_summary`，不是独立新表。
- RAG 索引应使用新版总结文本，并带 `memory_library_source = new` 和 `memory_index_version = new-library-consolidation-summary-v1`。如果新版总结有更新，检索前应重建或刷新索引；如果该角色没有新版总结，RAG 应返回空记忆，不要继续用旧向量或旧文本。

## 导入导出规则

当前用户要求：单角色导入如果原来有数据，直接覆盖。

因此导入导出修改后必须确认：

- 聊天记录、记忆、日记相关数据都包含在角色归档里。
- replace 模式会清理该角色旧数据。
- 导入后能重建或继续使用记忆索引。
- 不要只导入 `memories`，忽略 messages/diaries。

## 如果改 schema

必须同步检查：

- `server/db.js` 的建表和迁移逻辑。
- `normalizeMemoryRow` 默认值。
- 导入导出的字段白名单。
- 记忆库前端显示字段。
- Qdrant payload 字段。
- 小模型 prompt 输入字段。

如果新增“来源引用”规范，优先新增兼容字段，例如 `source_refs_json`，不要直接破坏旧的 `source_message_ids_json`。

## 提交前人工看一眼

至少打开记忆库前端确认：

- 左侧“记忆库”入口存在。
- 按角色分类能跳到角色统计。
- 每个分类气泡可折叠。
- 展开后条目在气泡内部滚动。
- 全库时间线是横向可缩放节点轴，月份刻度、日期节点、颜色状态和节点明细都能显示。
- 遗忘区显示“快遗忘”和“已进入遗忘曲线”。
- 每条遗忘记忆有“救回”按钮。
- 小模型 prompt 窗口能看到紧凑卡片输入。
