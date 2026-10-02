# 记忆（memory）

负责提取、检索、整理、导入、来源追溯。

- 前端：components/MemoryLibraryPanel.jsx、components/MemoTable.jsx。[打开功能目录](../../client/src/features/memory/)
- 后端：[server/features/memory](../../server/features/memory/)，主要实现：index.js、operations/、maintenance/、import/、sources.js。
- 数据归属：memories、external_memory_*；向量索引调用 platform/vectors。表定义在本功能的 schema.js 或 db.js；历史升级保留原执行顺序。
- 装配：本功能 index.js 提供入口；HTTP 操作在 http/；不要把业务实现加回 server/index.js。

## 排查与回归

前端入口仅组合视图和状态。地图与详情见 `components/MemoryMapView.jsx`、`MemoryInspector.jsx`，原文追溯见 `MemorySourceViewer.jsx`，编辑弹窗见 `MemoryEditDialog.jsx`。主线分类、筛选、去重在 `memoryThreads.js`，显示标签和格式化在 `memoryLabels.js`。

- 自动维护、进度事件与轮询：[useMemoryMaintenance](../../client/src/features/memory/useMemoryMaintenance.js)。
- 外部导入、预览、提交与断点续传：[useExternalMemoryImport](../../client/src/features/memory/useExternalMemoryImport.js)。
- 编辑、删除与来源查询：[useMemoryEditing](../../client/src/features/memory/useMemoryEditing.js)。

定位时先检查对应 hook 的请求，再沿 API 表查服务端；视图组件负责显示和交互。跨分区共享的选中角色、筛选和配置由 `MemoryLibraryPanel` 组合。

从 [API 对应表](api-map.md) 按请求路径找文件；查看响应的 X-Run-Id，再按 feature、action、runId 查服务日志。详细操作见 [故障定位](../runbooks/feature-debugging.md)。跨功能操作通过现有服务与数据库门面调用；目录拆分没有更改用户数据路径、鉴权规则或对话协议。

运行 npm run check:architecture、npm run test:server；界面与跨功能修改再运行 npm run test:e2e。测试使用临时数据库，无需配置模型密钥。真实模型供应商、Qdrant 与桌面打包验收应按实际环境单独执行。
