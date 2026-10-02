# 备份与迁移（backup）

负责角色打包、导入、导出、恢复编排。

- 前端：通过 settings/components/SettingsPanel.jsx 进入。
- 后端：[server/features/backup](../../server/features/backup/)，主要实现：index.js、http/、characterArchive.js、exportRepository.js。
- 数据归属：调用数据拥有方；不另建聊天库。表定义在本功能的 schema.js 或 db.js；历史升级保留原执行顺序。
- 装配：本功能 index.js 提供入口；HTTP 操作在 http/；不要把业务实现加回 server/index.js。

完整数据库恢复由 restoreService.js 编排，负责临时校验、旧库与附件备份、切换失败回滚和成功后的索引重建。导入响应的 warnings 表示数据已恢复但部分后续步骤失败；具体恢复与排查说明见 [可靠性修复记录](../reliability-fixes-2026-09-22.md)。

## 排查与回归

从 [API 对应表](api-map.md) 按请求路径找文件；查看响应的 X-Run-Id，再按 feature、action、runId 查服务日志。详细操作见 [故障定位](../runbooks/feature-debugging.md)。跨功能操作通过现有服务与数据库门面调用；目录拆分没有更改用户数据路径、鉴权规则或对话协议。

运行 npm run check:architecture、npm run test:server；界面与跨功能修改再运行 npm run test:e2e。测试使用临时数据库，无需配置模型密钥。真实模型供应商、Qdrant 与桌面打包验收应按实际环境单独执行。
