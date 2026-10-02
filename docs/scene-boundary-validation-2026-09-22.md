# 场景运行与工具分离验证（2026-09-22）

商业街与像素小屋现在默认打开玩家界面。切换人物、选择/绑定角色、移动、互动、行为生成和状态同步属于城市功能；素材编辑、碰撞箱、锚点、图层及 AI 上文诊断属于可选场景工具。

## 开关行为

`config/feature-manifest.json` 的 `labs.scene-editor.enabled` 默认仍为 true。开启时，玩家工具栏提供“场景工具”按钮；进入后可以使用原有编辑与诊断面板。退出工具会取消正在进行的拖拽、关闭辅助线并锁定素材。

设为 false 并重启后端、重新构建前端后，商业街与小屋的桌面入口继续存在；前端不加载 labs/scene-editor 模块，也没有编辑入口；后端不注册 behavior-models、behavior-input 两个诊断接口。MCP 的独立开关行为保持不变。

开关不是用户权限设计。此次未重新设计密码、用户数据库隔离或生产部署。

## 故障定位

| 现象 | 首先检查 |
| --- | --- |
| 入口缺失、错误加载实验模块 | [featureRegistry.jsx](../client/src/app/featureRegistry.jsx) |
| 玩家工具栏、人物或互动菜单问题 | [城市场景组件](../client/src/features/city/scene/components/) |
| 商业街移动、碰撞、自动行为或同步问题 | [CommercialStreetScene.jsx](../client/src/features/city/scene/CommercialStreetScene.jsx) |
| 小屋移动、互动、布局载入或同步问题 | [RoomScene.jsx](../client/src/features/city/scene/RoomScene.jsx) |
| 行为生成请求和树合并问题 | [场景运行请求](../client/src/features/city/scene/actions/) |
| 家具编辑、布局保存、模型列表或上文预览问题 | [实验动作](../client/src/labs/scene-editor/actions/) 与 [实验面板](../client/src/labs/scene-editor/components/) |
| 状态持久化或行为生成接口失败 | [API 对应表](features/api-map.md)，此四个玩家接口的 feature 为 city |

正式功能通过可选工具对象接入实验组件和动作，不从 features 反向导入 labs；结构检查持续保护这条边界。工具动作是普通函数工厂，使用 create 前缀。场景控制组件仍较长，保留移动、同步与行为执行的状态装配，尚未进一步按这些内部运行职责拆开。

四个玩家接口移回 server/features/city/http：行为树 GET/POST、基础行为生成、互动分支生成。请求路径、鉴权、输入输出和数据表保持兼容。既有布局 storage key、行为树事件名称和角色绑定数据也未更名。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| 架构检查 | 635 个源文件、188 个路由注册通过 |
| 全量前端 lint | 0 错误、0 警告 |
| 后端全量测试 | 53 项通过；包括关闭实验后的玩家接口、鉴权、持久化和错误归属 |
| 生产构建 | 通过；输出到 .codex_tmp/scene-boundary-2026-09-22/client-dist，未覆盖原 client/dist |
| 无头整应用回归 | 8 个默认入口、7 个关闭实验后的入口，以及私聊、群聊、设置、记忆库和核心业务流程通过 |
| 场景玩家回归 | 两种开关状态均通过人物切换、键盘移动、素材锁定、靠近后打招呼/继续/退出对话、生成失败提示与重试按钮恢复 |
| 场景工具回归 | 两座场景素材添加、布局保存/刷新恢复、关闭工具锁定通过；小屋上文请求失败时输入保留 |
| 行为同步回归 | 两座场景在前后端实验开关同时开启/关闭时，页面事件、服务端轮询、本地持久化均通过 |

整应用回归结束后仅移除两项无引用的派生变量，再通过 lint、架构检查和生产构建。浏览器回归使用后台 Vite、临时端口、临时数据库和无头 Chromium。玩家互动使用已有本地问候分支，生成失败使用 HTTP fixture，没有调用真实模型供应商。

构建仍提示主包约 651 kB，此轮未做加载性能优化。真实模型成功生成、Electron 安装包及多人上线环境不在本轮验收范围。此次也没有恢复或删除历史人物素材审核工具，历史调查见 [入口清单](frontend-entry-inventory-2026-09-22.md)。

日志位于 .codex_tmp/scene-boundary-2026-09-22：e2e-final.log、server-full.log、build-final.log。测试服务已结束。
