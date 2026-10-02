# 按功能定位故障

1. 在浏览器 Network 中找到失败请求，记录路径、状态码和响应头 X-Run-Id。JSON 错误还会包含 feature、action、runId、errorCode。私聊操作提示也会显示操作编号。
2. 从 [API 对应表](../features/api-map.md) 找该请求的实现。HTTP 文件负责请求操作，再沿显式依赖查本功能的 service/runtime 和 repository。
3. 用 runId 搜服务日志，同时查看 feature、action、release 和 durationMs。部署时设置 CP_RELEASE 为实际版本或提交号，避免混淆不同版本的错误。
4. HTTP 成功只表示请求处理完成。排队中的工作在后台队列状态中继续检查；任务会保留提交时的 trace，不会串用启动队列的另一请求编号。
5. 涉及界面实时变化时，查本功能 realtimeEvents.js、app/realtimeEvents.js，再查 shared/realtime/connection.js 的传输/重连。私聊版本更新另有 events.js 的去重与版本保护。
6. 修复后运行结构检查、服务端测试和相关 E2E，再生成 API 文档；有模型/向量/桌面依赖的修改，补充对应环境验收。

结构化请求日志只记录功能、操作、操作编号、版本、状态及耗时，不记录请求正文、密码或模型密钥。已有模型正文调试开关仍属于原功能；不要把其中的正文当作可以公开分享的操作日志。

当前覆盖边界：所有已注册的业务 HTTP 操作有操作编号（私聊回复版本沿用自己的详细追踪），后台队列保留请求上下文。私聊有较细的 save/notify/LLM 等阶段；其他功能的 HTTP 追踪并不等于已经覆盖每次 SQL、RAG 和模型调用。独立定时任务没有所属 HTTP 请求，不应伪造其请求编号。没有自动部署集中日志或线上告警服务。

## 常见入口

| 症状 | 先检查 |
| --- | --- |
| 服务启动了但某功能不可用 | featureStatus / Feature registration failed；现在功能注册失败会阻止就绪 |
| 发消息成功但没有角色回复 | private-chat/dispatch.js、scheduling.js、replyGeneration.js 与队列状态 |
| 记忆来源打不开/维护失败 | memory/http、sources.js、maintenance/、import/ |
| 角色不行动/房租不结算 | city/runtime/tick1.js、housing/runtime/tick*.js、platform/jobs/lifecycle.js |
| 城市行动没有触发联网活动 | city/services/actionService.js 与 features/web-tools |
| 实验页面消失或接口 404 | feature-manifest.json，确认前端已重建、服务已重启 |
| 导入后找不到旧数据 | server/paths.js 的路径配置和各功能 migration，先核对数据路径 |
| 主界面空白或跳转报错 | app/App.jsx 的组合、对应功能 hook、浏览器错误与 check:architecture |
