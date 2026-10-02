# 私聊：消息管理、回复版本与重生成

已覆盖消息管理、普通回复与主动调度、上下文编排、回复重生成及版本切换。前端状态、后端流程、HTTP 操作和 SQL 存储均归入本功能；共享上下文与记忆通过各自模块提供。

## 去哪里找代码

| 任务 | 文件 |
| --- | --- |
| 前端公开入口 | [client/src/features/private-chat/index.js](../../client/src/features/private-chat/index.js) |
| 私聊页面、历史分页与搜索定位 | [components/ChatWindow.jsx](../../client/src/features/private-chat/components/ChatWindow.jsx) |
| 发送、重试、删除和乐观消息状态 | [useMessageActions.js](../../client/src/features/private-chat/useMessageActions.js) |
| 消息操作错误、保存后警告与操作编号 | [components/MessageOperationNotice.jsx](../../client/src/features/private-chat/components/MessageOperationNotice.jsx) |
| 回复版本控件、错误和操作编号 | [components/PrivateReplyControls.jsx](../../client/src/features/private-chat/components/PrivateReplyControls.jsx) |
| 点击、忙碌状态、失败和事件订阅 | [useReplyVersions.js](../../client/src/features/private-chat/useReplyVersions.js) |
| HTTP 请求与操作编号 | [api.js](../../client/src/features/private-chat/api.js) |
| 实时事件与旧版本过滤 | [events.js](../../client/src/features/private-chat/events.js) |
| 后端公开入口 | [server/features/private-chat/index.js](../../server/features/private-chat/index.js) |
| 消息接口参数与响应 | [messageRoutes.js](../../server/features/private-chat/messageRoutes.js) |
| 消息业务顺序、回复派发与失败分类 | [messageService.js](../../server/features/private-chat/messageService.js) |
| 消息分页、保存、已读和删除 SQL | [messageRepository.js](../../server/features/private-chat/messageRepository.js) |
| 回复版本接口参数与响应 | [routes.js](../../server/features/private-chat/routes.js) |
| 排队、并发保护、过时结果检查、保存与通知 | [replyVersionService.js](../../server/features/private-chat/replyVersionService.js) |
| 复用上下文、主模型调用、续写和可见内容解析 | [generateReply.js](../../server/features/private-chat/generateReply.js) |
| 版本事务与查询 | [replyVersionsRepository.js](../../server/features/private-chat/replyVersionsRepository.js) |
| 幂等表结构初始化 | [migrations/replyVersions.js](../../server/features/private-chat/migrations/replyVersions.js) |
| 通用操作日志 | [platform/logging/operation.js](../../server/platform/logging/operation.js) |

数据表仍是 private_reply_runs、private_reply_versions、private_reply_members；消息仍保存于原 messages 表。SQL 表结构与用户数据路径没有改变。表定义位于各功能 schema.js；platform/db/schemaRegistry.js 保留原始建表顺序。platform/db/userDatabase.js 在基础表创建后调用回复版本的幂等初始化。

## 兼容入口

- server/index.js 注册消息管理和回复版本 API，并注入当前请求的用户数据库、引擎、连接集合与城市繁忙回调。跨私聊／群聊搜索仍在原入口，优先于 /messages/:characterId 注册。
- server/features/private-chat/runtime.js 的 changePrivateReplyVersion 保留原签名，适配共享队列、普通回复忙碌状态、RAG 进度、主动调度与通知。
- server/platform/db/userDatabase.js 保留原消息读写、分页、已读、删除以及回复版本方法，转给新存储模块。消息归一化在 private-chat/messageRows.js，TTS 在 speech，缓存失效在 conversation-context；数据库装配层共享原连接。
- ChatWindow 已迁入功能目录，通过两个 hook 接入消息操作和版本交互；App 通过功能公开入口加载它，继续负责全局 WebSocket 与联系人刷新。MessageBubble、InputBar、转账和关系弹窗仍是现有共享组件。
- 私聊文风、话题与记忆参考工具在 private-chat/context/；普通生成在 replyGeneration.js，派发在 dispatch.js，调度在 scheduling.js。

运行时和数据库门面保留原方法名，作为跨功能的兼容接口。旧的 server/privateReplyVersions.js、components/PrivateReplyControls 和 components/ChatWindow 实现已迁移，不保留第二份实现。

## 对外接口与行为

| 操作 | API | 请求体 |
| --- | --- | --- |
| 历史读取 | GET /api/messages/:characterId | 查询参数 limit、before、after、around |
| 发送消息 | POST /api/messages | characterId、content |
| 失败回复重试 | POST /api/messages/:characterId/retry | failedMessageId（可选） |
| 批量删除 | POST /api/messages/batch-delete | messageIds、characterId（可选，保留旧行为） |
| 清空消息 | DELETE /api/messages/:characterId | 无 |
| 重生成 | POST /api/messages/:characterId/replies/:messageId/reroll | revision |
| 选择历史版本 | POST /api/messages/:characterId/replies/:messageId/version | revision、version |

接口路径、主要响应形状和原事件名保持兼容。历史仍返回消息数组，操作编号放在 X-Run-Id 响应头；其余成功／失败对象新增 runId，失败新增 errorCode。前端发送合法 X-Run-Id，后端对缺失或不合格式的值生成新编号。空白或非字符串发送内容现在明确返回 400，避免进入数据库后表现为 500。

实时更新事件的 data 包含相同 runId。旧客户端可忽略新增字段；新客户端也能处理没有 runId 的旧事件。

重生成只调用保存上下文对应的主模型，不重新执行检索/规划，不重复触发转账、日记、城市行为或语音。切换历史版本不调用模型。并发点击、对话被改动、删除消息或模型失败继续保留既有保护。

一处明确的失败处理改进：版本事务已经提交但通知发送失败时，HTTP 仍返回已保存的版本，并带 notificationWarning=REPLY_NOTIFY_FAILED；日志记录 notify 阶段失败。不要因为推送失败再次调用模型生成。

消息管理的失败边界：

- 用户消息与 last_user_msg_time 一起提交；后者写入失败会回滚该消息。
- 消息保存后，已读、推送、回复派发或嫉妒检查失败时，仍返回已保存的 message，另带 warnings。MESSAGE_REPLY_DISPATCH_FAILED 会在页面提供“重试回复”，不会重新发送用户正文。
- 重试请求被拒绝时，前端保留原错误气泡；删除失败保留当前消息与选择；发送失败保留输入草稿，提示中显示操作编号。
- 历史请求返回时检查当前角色，避免旧角色的迟到响应覆盖新对话。
- 拉黑后发言仍按原规则保存并返回 blocked，不触发普通回复。重试仍保留原 RAG 恢复和系统事件参数。

消息重试的引擎接收机制仍沿用旧实现：它会先删除指定的失败消息，再请求生成；后台生成的失败、取消和后续错误消息由引擎处理，本轮没有重写该生命周期。HTTP 成功也不保证对方角色当前状态允许生成。

## 用操作编号排查

失败时回复控件或消息提示显示可复制的操作编号。用该编号检索当前服务的 stdout 日志。重生成可关联后台队列及启用 llm_debug_capture 后的模型调试记录。

普通消息的 action 为 history、send、retry、delete、clear。主要阶段是 request、validate、read、city_busy、save、mark_read、notify、dispatch、jealousy、retry_context、delete；不同操作只执行相关阶段。dispatch 成功只说明同步调用已返回。发送和重试的 runId 同时作为旧回复派发日志的 request_id，并传入后台队列的 trace；快速连续发言合并时，排队任务使用最后一次请求编号。普通生成内部的 LLM、RAG 进度和最终角色回复事件尚未统一使用该编号，不能把 HTTP 的 operation succeeded 当成模型回复完成。

回复版本的主要阶段依次为 request、validate、queue、load_context、prepare_generation、llm、llm_continuation（可选）、parse、save、notify、runtime_cleanup。版本切换会跳过生成阶段。http_response 表示成功响应已交给 HTTP 框架，不保证网络已将响应送达浏览器。

- validate 失败：版本冲突、角色忙碌或记录缺失。
- queue 停在 queued：看同一 runId 的后台队列状态。
- llm 失败：看 LLM_REQUEST_FAILED 及原有模型诊断；保存步骤尚未发生。
- save 失败：检查 REPLY_HISTORY_CHANGED、角色状态或存储异常。
- save 成功而 notify 失败：内容已经保存；刷新读取已保存版本，不重复重生成。
- 后端成功、页面未更新：浏览器控制台可按 runId 查 update_received；再检查对应功能的 events/useReplyVersions。当前没有把浏览器诊断自动上传到服务器。

结构化阶段日志只记录操作、功能、状态和耗时等元数据，不记录聊天正文或 API key。原有模型正文调试仍由 llm_debug_capture 控制。日志写入失败不改变已完成业务的结果。

部署时将 CP_RELEASE 设置为实际发布版本或提交号，结构化日志的 release 字段会使用该值；未设置时为 development。当前没有配置日志收集服务、持久化追踪库或线上告警平台。

## 验证

所有命令从仓库根目录执行。后端测试使用隔离临时库和模拟模型；HTTP 测试仅监听临时回环端口，不读取真实账号数据，不调用收费模型。

```powershell
# 只验证本功能，使用与 SQLite 原生模块匹配的 Node
.\.runtime\node20\node.exe --test server/features/private-chat/tests

# 连同现有上下文与话题测试
.\.runtime\node20\node.exe --test server/test server/features/private-chat/tests
```

前端测试需先在后台启动本地 Vite 开发服务；默认测试地址为 127.0.0.1:5178，可指定其他端口。浏览器由脚本以 headless 模式启动，API 为模拟响应。

```powershell
$env:REROLL_TEST_URL = 'http://127.0.0.1:5181'
npm --prefix client run test:private-chat
```

测试页面位于 client/src/features/private-chat/tests/privateReplyReroll.html 和 privateMessages.html；不属于正式构建入口。test:private-chat 顺序执行两个浏览器脚本。

结构拆分验证：2026-09-16 的 45 项服务端测试通过；无头浏览器覆盖八个主要入口、关闭实验后的入口，以及上述消息和回复版本交互。2026-09-17 清理了前端遗留问题，全量 lint 以零错误、零警告通过。生产构建输出到独立临时目录，未覆盖原 client/dist。整应用测试可直接运行 npm run test:e2e，脚本会自动管理临时服务。详见 [本轮验证记录](../structure-validation.md)。

