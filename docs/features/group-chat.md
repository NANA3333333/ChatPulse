# 群聊（group-chat）

负责群成员、群消息、群回复、主动调度。

- 前端：components/GroupChatWindow.jsx、useGroupActions.jsx。[打开功能目录](../../client/src/features/group-chat/)
- 后端：[server/features/group-chat](../../server/features/group-chat/)，主要实现：index.js、runtime/、proactive.js、repository.js。
- 数据归属：group_chats、group_members、group_messages。表定义在本功能的 schema.js 或 db.js；历史升级保留原执行顺序。
- 装配：本功能 index.js 提供入口；HTTP 操作在 http/；不要把业务实现加回 server/index.js。

## 排查与回归

前端群管理已独立为 [GroupManageDrawer](../../client/src/features/group-chat/components/GroupManageDrawer.jsx)，主动消息档位在 `proactivePresets.js`。消息历史、发送锁、每群草稿与重连恢复在 [useGroupMessages](../../client/src/features/group-chat/useGroupMessages.js)。红包弹窗和红包卡片归入 [经济功能](economy.md)，不再放在群消息窗口内。

从 [API 对应表](api-map.md) 按请求路径找文件；查看响应的 X-Run-Id，再按 feature、action、runId 查服务日志。详细操作见 [故障定位](../runbooks/feature-debugging.md)。跨功能操作通过现有服务与数据库门面调用；目录拆分没有更改用户数据路径、鉴权规则或对话协议。

运行 npm run check:architecture、npm run test:server；界面与跨功能修改再运行 npm run test:e2e。测试使用临时数据库，无需配置模型密钥。真实模型供应商、Qdrant 与桌面打包验收应按实际环境单独执行。
