# 住房（housing）

负责房源、推荐、看房、签约、房租、布置。

- 前端：components/HousingSocialPanel.jsx。[打开功能目录](../../client/src/features/housing/)
- 后端：[server/features/housing](../../server/features/housing/)，主要实现：index.js、rentalChainService.js、housingEffects.js、runtime/。
- 数据归属：db.js 管理住房表。表定义在本功能的 schema.js 或 db.js；历史升级保留原执行顺序。
- 装配：本功能 index.js 提供入口；HTTP 操作在 http/；不要把业务实现加回 server/index.js。

## 排查与回归

| 现象 | 前端位置 |
| --- | --- |
| 进入页面、加载房源/租客/中介数据失败 | useHousingData.js |
| 房源、阶层、中介配置保存或绑定/交租异常 | useHousingManagement.js |
| 租房故事、创作室、管理抽屉或弹窗显示错误 | components/HousingStoryView.jsx、HousingAgencyView.jsx、HousingManagementDrawer.jsx、HomeEditorDialog.jsx、RoomAssemblyDialog.jsx |
| 样板间生成、失败时使用规则模板 | useHousingRoomAssembly.js、assembly/roomAssembly.js |
| 家具尺寸、碰撞、方向、摆放错误 | assembly/roomAssemblyCatalog.js、roomAssemblyGeometry.js |
| 保存或恢复本地布局失败 | assembly/roomAssemblyStorage.js |
| 生成的房间截图错误 | assembly/roomAssemblyPreview.js |

HousingSocialPanel.jsx 负责页面装配和租房链路状态。样板间与像素小屋继续使用原有 localStorage key 和布局更新事件；本次拆分未改变存储协议。

从 [API 对应表](api-map.md) 按请求路径找文件；查看响应的 X-Run-Id，再按 feature、action、runId 查服务日志。详细操作见 [故障定位](../runbooks/feature-debugging.md)。跨功能操作通过现有服务与数据库门面调用；目录拆分没有更改用户数据路径、鉴权规则或对话协议。

运行 npm run check:architecture、npm run test:server；界面与跨功能修改再运行 npm run test:e2e。测试使用临时数据库，无需配置模型密钥。真实模型供应商、Qdrant 与桌面打包验收应按实际环境单独执行。
