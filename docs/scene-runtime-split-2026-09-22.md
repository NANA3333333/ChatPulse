# 场景移动与行为执行拆分（2026-09-22）

接续 [可靠性修复](reliability-fixes-2026-09-22.md)，本轮拆分商业街、小屋的碰撞与路径计算、逐帧移动、行为树执行。未调整后端接口、数据库、实验开关或存储键。

## 职责与排查入口

| 问题或职责 | 代码入口 |
| --- | --- |
| 小屋家具碰撞、避让、目标位置与绕路 | [createRoomNavigation.js](../client/src/features/city/scene/movement/createRoomNavigation.js) |
| 商业街可行走区域、人物碰撞、横向循环边界 | [createStreetCollision.js](../client/src/features/city/scene/movement/createStreetCollision.js) |
| 商业街搜索路线、简化路径、道路优先策略 | [createStreetPathfinder.js](../client/src/features/city/scene/movement/createStreetPathfinder.js) |
| 商业街安全出生点、目的地落点与连续闲逛路线 | [createStreetNavigation.js](../client/src/features/city/scene/movement/createStreetNavigation.js) |
| 小屋手动移动、自动行走、重规划及人物操作 | [useRoomMotion.js](../client/src/features/city/scene/movement/useRoomMotion.js) |
| 商业街按键、角色切换、动画帧注册与清理 | [useStreetMotion.js](../client/src/features/city/scene/movement/useStreetMotion.js) |
| 商业街每一帧的手动/自动移动、到达与受阻处理 | [createStreetMotionStepper.js](../client/src/features/city/scene/movement/createStreetMotionStepper.js) |
| 行为启动、步骤推进、移动指令与失败恢复枝丫 | [小屋运行 hook](../client/src/features/city/scene/behavior/useRoomBehaviorRuntime.js)、[商业街运行 hook](../client/src/features/city/scene/behavior/useStreetBehaviorRuntime.js) |
| 对话状态、下一句、退出、选项提交与失败重试 | [useBehaviorDialog.js](../client/src/features/city/scene/behavior/useBehaviorDialog.js) |
| 互动会话有效期、自动行为选择与状态提示 | [useBehaviorSession.js](../client/src/features/city/scene/behavior/useBehaviorSession.js) |
| 自动行为触发计时器 | [useAutonomousBehavior.js](../client/src/features/city/scene/behavior/useAutonomousBehavior.js) |
| 场景同步与保存冲突 | 沿用 [useBehaviorTreeSync.js](../client/src/features/city/scene/useBehaviorTreeSync.js)、[behaviorSyncClient.js](../client/src/features/city/scene/behaviorSyncClient.js) |

计算模块不安装浏览器监听、不请求网络，也不写 React 状态，可直接使用给定的世界几何与人物位置测试。运动 hook 管理活动行程、按键及动画循环；商业街每帧计算另外拆出，可以用固定时间步测试。行为运行 hook 管理当前行为与对话状态，通过明确的角色操作、导航、行程、生成接口协作。

两种场景共用对话处理和会话逻辑；房间的家具避让、商业街的循环道路仍分别实现。动画与计时器回调通过 useEventCallback 读取最新提交状态；卸载时清理帧、计时器及键盘监听。

主组件保留页面装配、布局/角色绑定、存储连接、画布显示和可选编辑工具接入。不能把文件缩短等同于所有复杂性消失，后续修改应沿上表定位职责。

| 主组件 | 拆分前 | 拆分后 |
| --- | ---: | ---: |
| CommercialStreetScene.jsx | 3899 行 | 1807 行 |
| RoomScene.jsx | 2573 行 | 1544 行 |

## 同时修复的绕路问题

小屋原来的路径可行性每隔 18 像素采样，斜线擦过家具角落时可能漏检。新测试复现了路线穿过碰撞边缘，现改为用人物脚部包围盒检测完整线段；恰好贴边仍允许通过。若人物已因家具移动而处于重叠位置，保留逐步退出碰撞的规则。

## 验证

- 服务端测试：82 项通过，包含新增 7 项场景计算测试：贴边与细小障碍、家具滑动避让、脱离重叠出生点、绕路、循环边界碰撞、持续按键/释放，以及手动与自动移动并行、自动行走受阻恢复。
- 全量前端 ESLint：0 错误、0 警告。
- 架构检查：658 个源码文件、188 个接口注册，通过。
- 生产构建通过，输出到本轮临时目录；仍有既存的大于 500 kB 分包提示。
- 无头 Chromium 全量回归通过：页面入口、桌面窗口、住房、私聊消息及回复版本、上下文设置、群聊、角色创建、账号设置和记忆操作；实验工具开启、关闭两种配置下的场景运行均通过。
- 本轮文档的 36 个本地链接有效。

浏览器新增对话选项失败后保留原选项、解除提交锁并允许重试的验证；原有移动、互动、编辑、同步失败/冲突、焦点隔离和关闭实验工具的测试均通过。互动测试控制角色走向静止玩家，并通过公开导航模块规划绕开家具的路线，再用真实按键行走，避免直线走入障碍或追逐随机闲逛人物导致测试失败。

全部运行日志及生产构建输出写入 `.codex_tmp/scene-runtime-split-2026-09-22/`。使用临时数据库、临时端口和无头 Chromium，不使用真实账号或模型接口，不覆盖已有 `client/dist`。

最终日志：`server.log`、`lint.log`、`build.log`、`e2e-final.log` 和 `e2e-final.err.log`。测试进程已退出；没有提交或部署版本。
