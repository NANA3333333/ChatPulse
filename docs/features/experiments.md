# 实验功能与独立工具

完整的当前入口、历史人物调试工具和端口核查见 [前端入口与历史调试工具清单](../frontend-entry-inventory-2026-09-22.md)。人物换装、动作图裁剪等四个独立静态页面曾位于 public/tools，已在历史提交中清理；不能只靠查找不同端口判断是否有独立页面。

| 项目 | 前端 | 后端 | 开关/运行方式 |
| --- | --- | --- | --- |
| MCP 实验室 | client/src/labs/mcp | server/labs/mcp/http；能力由 features/web-tools 提供 | config/feature-manifest.json → labs.mcp.enabled |
| 场景编辑与 AI 调试 | client/src/labs/scene-editor | server/labs/scene-editor/http（模型列表、AI 上文预览） | config/feature-manifest.json → labs.scene-editor.enabled |
| 独立记忆 MCP | 无独立网页前端 | tools/chatpulse-memory-mcp | 独立 package.json 和 README，不由主服务启动 |
| 历史数据库/调试脚本 | 无 | archive/server-tools | 仅作参考，不应直接运行 |

两个实验开关默认开启。修改后重启服务并重新构建前端；关闭 MCP 会去掉其实验导航和 HTTP 接口。关闭 scene-editor 只移除“场景工具”按钮和诊断接口。联网搜索能力仍可被城市等正式业务调用，不依赖 MCP 实验界面是否打开。

商业街和像素小屋始终保留正式入口，打开时默认使用玩家模式。人物选择、绑定、移动、互动、行为生成与状态同步由 features/city/scene 负责；工具开启时可点“场景工具”进入素材编辑和 AI 调试。退出工具会结束拖拽并锁定素材。房租和签约规则仍归 housing。

这些开关控制功能注册，不是权限或安全边界，也不会抹掉已有实验数据。独立工具的用法见 [MCP README](../../tools/chatpulse-memory-mcp/README.md)。

## 场景编辑器排查位置

- components/：编辑工具栏、素材选择、属性检查器、行为树调试面板。
- actions/createRoomLayoutActions.js、createCommercialLayoutActions.js：素材增删、拖动、碰撞箱、锚点、层级与布局保存/恢复。
- actions/createRoomBehaviorDiagnostics.js、createCommercialBehaviorDiagnostics.js：AI 上文预览、模型列表与诊断配置。
- roomEditorTools.js、commercialEditorTools.js：将工具组件和动作传给正式场景；由 app/featureRegistry.jsx 选择是否加载这些适配入口。
- RoomAssetEditor.jsx、CommercialStreetEditor.jsx：旧实验总面板使用的薄适配器；运行逻辑位置见 [城市功能](city.md)。

共享几何、场景画布和人物展示都在 features/city/scene；正式功能不能导入 labs，结构检查会阻止反向依赖。行为树读写及生成接口归 city 并始终注册，仍使用原有鉴权。接口 URL、布局存储键和同步事件名称保持兼容。
