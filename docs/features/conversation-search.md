# 会话搜索（conversation-search）

负责搜索、前后文定位、跨窗口跳转。

- 前端：components/ConversationSearchPanel.jsx、useSearchNavigation.js。[打开功能目录](../../client/src/features/conversation-search/)
- 后端：[server/features/conversation-search](../../server/features/conversation-search/)，主要实现：http/、repository.js。
- 数据归属：读取私聊及群聊消息表。表定义在本功能的 schema.js 或 db.js；历史升级保留原执行顺序。
- 装配：由 server/app.js 或 platform/db/userDatabase.js 注入依赖；HTTP 操作在 http/；不要把业务实现加回 server/index.js。

## 排查与回归

从 [API 对应表](api-map.md) 按请求路径找文件；查看响应的 X-Run-Id，再按 feature、action、runId 查服务日志。详细操作见 [故障定位](../runbooks/feature-debugging.md)。跨功能操作通过现有服务与数据库门面调用；目录拆分没有更改用户数据路径、鉴权规则或对话协议。

运行 npm run check:architecture、npm run test:server；界面与跨功能修改再运行 npm run test:e2e。测试使用临时数据库，无需配置模型密钥。真实模型供应商、Qdrant 与桌面打包验收应按实际环境单独执行。
