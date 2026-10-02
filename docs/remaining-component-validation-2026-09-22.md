# 住房、桌面与场景编辑器结构验证（2026-09-22）

承接 [上一批组件拆分](component-structure-validation-2026-09-22.md)。本次按功能职责拆开界面、操作和辅助算法，保留原存储 key、接口路径、默认实验开关及现有交互。

回归发现住房弹窗被桌面导航栏遮挡，顶部取消按钮无法点击。HomeEditorDialog 和 RoomAssemblyDialog 现在通过 React portal 挂到 document.body，并在桌面导航上方显示；测试实际点击取消按钮，不使用强制点击跳过遮挡。

## 完成的边界

| 功能 | 现在的定位方式 |
| --- | --- |
| 住房 | 数据加载、管理操作、样板间生成分别由 useHousingData、useHousingManagement、useHousingRoomAssembly 负责；故事、创作室、管理抽屉和两个弹窗单独成组件 |
| 样板间算法 | assembly 下分素材配置、几何/摆放计算、组装流程、本地存储和预览截图；模块之间没有循环导入 |
| 网页桌面 | 图片、文件夹、回收站、文本窗口分别在 desktop/windows；辅助窗口状态、几何、截图、右键菜单分别定位 |
| 场景编辑器 | 素材/工具栏/检查器/行为面板/人物/画布组件放 components；布局操作和 AI 请求分别位于 hooks |
| 正式功能与实验界面 | 结构检查禁止 client/src/features 反向引用 client/src/labs，避免删除实验页面时牵连正式功能 |

入口文件行数仅作定位参考，格式化也会影响行数，不能等同于复杂度指标：

| 文件 | 本批前 | 本批后 |
| --- | ---: | ---: |
| HousingSocialPanel.jsx | 2834 | 687 |
| ChatPulseDesktop.jsx | 4239 | 1769 |
| RoomAssetEditor.jsx | 4147 | 2656 |
| CommercialStreetEditor.jsx | 5803 | 3901 |

## 验证范围

- 结构检查：625 个源码文件、188 个路由注册通过。
- 全量前端 lint：0 错误、0 警告。
- Vite 生产构建通过；输出 `.codex_tmp/remaining-components-2026-09-22/client-dist`，保留既有 client/dist。
- 首轮既有全量无头测试通过，包括 8 个主页面、关闭实验后的 5 个主页面、场景同步、私聊/群聊、设置与记忆业务。
- 新增 tests/e2e/remainingComponents.cjs 并通过完整组件回归：文件夹窗口几何、文档保存/刷新/回收站还原、图片窗口、住房新增房源、样板间模型失败时的规则模板/持久化/预览、场景素材新增/布局保存/重新打开和上下文请求失败。关闭实验后的 5 个主页面及住房新增房源也通过。
- 检查生产产物，HTML 入口只有 index.html；未重新发布历史静态调试工具或自动化测试页面。

可设置 `CHATPULSE_E2E_SUITE=components` 单独跑上述主页面与组件回归，或 `CHATPULSE_E2E_SUITE=scenes` 只验证两个场景编辑器；不设置时仍跑全套。测试使用后台 Vite、临时后端/数据库与无头 Chromium；模型失败通过 HTTP 样例注入，没有请求真实模型。

验证日志保留在 `.codex_tmp/remaining-components-2026-09-22/`：e2e-first.log 为既有全量回归，components-final.log 为最终完整组件回归，scenes.log 为场景定向回归，build-final.log 为最终构建。测试进程和临时服务已退出。场景操作测试限定当前前台窗口，并按素材 ID 确认重新打开后实际渲染的对象，避免把后台窗口或其他素材数量当作成功证据。

## 仍需区分的范围

本次组件拆分完成时，场景入口仍持有场景同步、移动与行为运行代码；桌面入口仍持有图标拖放、剪贴板和文件操作。此次不是“所有文件都已拆到最小”。当时 scene-editor 开关还会同时关闭玩家与编辑界面；随后已完成边界分离，当前行为见 [场景运行与工具分离验证](scene-boundary-validation-2026-09-22.md)。

历史人物换装、动作裁剪、大图裁剪和 3D 人物原型的发现、删除记录及端口证据，见 [前端入口清单](frontend-entry-inventory-2026-09-22.md)。本批没有恢复历史工具，没有删除仍在使用的实验功能。

构建仍有主包超过 500 kB 的提示；未做加载性能优化。真实模型、Qdrant、Electron 安装包、部署环境、密码和多用户隔离仍需分别验收。本批没有修改服务端业务。
