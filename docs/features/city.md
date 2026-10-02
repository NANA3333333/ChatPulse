# 城市（city）

负责行动、生理、地点、物品、任务、市长、日志。

- 前端：components/CityLog.jsx、components/CityManager.jsx、scene/。[打开功能目录](../../client/src/features/city/)
- 后端：[server/features/city](../../server/features/city/)，主要实现：index.js、routes/、services/、runtime/。
- 数据归属：cityDb.js 管理城市表；schema.js 管理行为树状态表。表定义在本功能的 schema.js 或 db.js；历史升级保留原执行顺序。
- 装配：本功能 index.js 提供入口；HTTP 操作在 http/；不要把业务实现加回 server/index.js。

## 排查与回归

商业街与小屋的运行入口在 scene/CommercialStreetPanel.jsx、scene/PixelCottagePanel.jsx。玩家工具栏、人物、画布和互动菜单在 scene/components；行为生成与树合并在 scene/actions；碰撞、路径计算与逐帧移动在 scene/movement；行为步骤执行、对话和自动行为在 scene/behavior。主组件保留页面、布局、绑定、存储与可选工具装配，具体排查入口见 [场景运行拆分](../scene-runtime-split-2026-09-22.md)。

服务器同步由 scene/useBehaviorTreeSync.js 与 behaviorSyncClient.js 负责，输入焦点由 scene/sceneKeyboard.js 负责。行为树保存现在必须带 GET 返回的 revision（POST 字段为 expected_revision）；冲突返回 409，界面保留本地待保存版本。重试与恢复操作见 [可靠性修复记录](../reliability-fixes-2026-09-22.md)。

素材编辑和 AI 调试通过可选工具对象接入，代码归 labs/scene-editor，正式场景不导入实验目录。关闭 scene-editor 后，两座场景、人物操作和行为状态同步仍可用。查“拖不动家具/图层或碰撞箱编辑”看 [实验工具](experiments.md)；查“人物走不动/互动或同步失败”看本功能。

后端 http/ 下的 behavior-tree-state GET/POST、behavior-base-branches 和 behavior-branch 是玩家能力；错误归属 feature=city。behavior-models、behavior-input 是实验诊断接口，关闭工具后不注册。

从 [API 对应表](api-map.md) 按请求路径找文件；查看响应的 X-Run-Id，再按 feature、action、runId 查服务日志。详细操作见 [故障定位](../runbooks/feature-debugging.md)。跨功能操作通过现有服务与数据库门面调用；目录拆分没有更改用户数据路径、鉴权规则或对话协议。

运行 npm run check:architecture、npm run test:server；界面与跨功能修改再运行 npm run test:e2e。测试使用临时数据库，无需配置模型密钥。真实模型供应商、Qdrant 与桌面打包验收应按实际环境单独执行。
