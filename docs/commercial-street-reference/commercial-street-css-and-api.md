# 商业街 CSS 与接口说明

## 1. 前端 CSS 入口

商业街地图本体没有单独的 `CommercialStreetPanel.css`。它通过 `CommercialStreetPanel.jsx` 引入像素世界共用样式：

```jsx
import './PixelWorldPanel.css';
```

主要文件：

| 文件 | 用途 |
|---|---|
| `client/src/plugins/pixelWorld/CommercialStreetPanel.jsx` | 商业街 App 入口，只包一层 `pixel-world-page`，实际内容交给 `CommercialStreetEditor`。 |
| `client/src/plugins/pixelWorld/CommercialStreetEditor.jsx` | 商业街地图、编辑器、AI 行为面板、玩家移动、交互菜单的主要 React 逻辑。 |
| `client/src/plugins/pixelWorld/commercialStreetCore.js` | 商业街地图核心常量、资产定义、碰撞、遮挡、路径、角色初始状态等。 |
| `client/src/plugins/pixelWorld/PixelWorldPanel.css` | 商业街地图本体和像素小屋共用的主样式。 |
| `client/src/styles/desktop.css` | 桌面窗口中商业街的窗口态、窄屏、紧凑、缩放覆盖。 |
| `client/src/plugins/city/CityLog.jsx` | “商业街日志”页面逻辑。 |
| `client/src/plugins/city/CityLog.css` | “商业街日志”页面样式，不是地图本体样式。 |
| `client/src/plugins/city/CityManager.jsx` | 商业街管理面板，管理地点、物品、任务、市长等。 |

## 2. 商业街地图 CSS 选择器职责

这些选择器主要在 `client/src/plugins/pixelWorld/PixelWorldPanel.css`。

| 选择器 | 管什么 |
|---|---|
| `.pixel-world-page` | 商业街/像素世界页面最外层容器。 |
| `.pixel-world-header` | 顶部标题、说明、状态信息区域。 |
| `.pixel-world-kicker` | 顶部小标签文字。 |
| `.pixel-world-tabs` | 页面主 tab。 |
| `.pixel-world-style-tabs` | 风格/模式切换按钮组。 |
| `.pixel-world-main` | 主体布局容器。 |
| `.pixel-world-scene-panel` | 场景展示面板。 |
| `.pixel-world-scene-title` | 场景标题区域。 |
| `.pixel-world-stage-wrap` | 地图舞台外层，控制裁切、居中、滚动/缩放外观。 |
| `.pixel-world-stage` | 实际商业街画布/地图舞台。 |
| `.pixel-world-editor` | 编辑器整体容器。 |
| `.pixel-world-editor-body` | 编辑器主体三栏布局。 |
| `.pixel-world-editor-toolbar` | 编辑器顶部工具条。 |
| `.pixel-world-editor-canvas-wrap` | 编辑器画布包裹层。 |
| `.pixel-world-editor-stage` | 编辑器里的地图舞台。 |
| `.pixel-world-toolbar-advanced--commercial` | 商业街高级工具区。 |
| `.pixel-world-toolbar-section--maintenance` | 维护类工具区，如恢复、重置、保存等。 |
| `.pixel-world-toolbar-section--metrics` | 坐标、尺寸、段数等指标显示。 |
| `.pixel-world-toolbar-section--canvas-tools` | 画布操作工具。 |
| `.pixel-world-toolbar-section--travel` | 移动/跳转相关控制。 |
| `.pixel-world-toolbar-section--scale` | 缩放相关控制。 |
| `.pixel-world-toolbar-section--edit` | 编辑操作区。 |
| `.pixel-world-toolbar-section--selection` | 当前选中对象相关操作。 |
| `.pixel-world-asset-panel` | 左侧资产/素材面板。 |
| `.pixel-world-asset-panel.collapsed` | 素材面板折叠态。 |
| `.pixel-world-asset-panel-expand` | 折叠后用于展开素材面板的按钮。 |
| `.pixel-world-asset-grid` | 素材按钮网格。 |
| `.pixel-world-asset-type-tabs` | 素材类型切换。 |
| `.pixel-world-inspector` | 右侧或侧边属性检查器。 |
| `.pixel-world-layer-panel` | 图层/对象列表面板。 |
| `.pixel-world-interaction-menu` | 地图内地点/对象交互菜单。 |
| `.pixel-world-direction-card-head` | 方向/朝向设置卡片标题。 |
| `.pixel-world-direction-grid` | 方向按钮网格。 |
| `.pixel-world-place-card-head` | 地点绑定卡片标题。 |
| `.pixel-world-nudge-pad` | 微调位置的方向按钮区。 |
| `.pixel-world-scale-row` | 单个素材尺寸缩放行。 |
| `.pixel-world-collision-actions` | 碰撞盒操作按钮。 |
| `.pixel-world-player-switch-control` | 玩家/角色切换控件。 |
| `.pixel-world-auto-walk-control` | 自动走路/巡游控件。 |
| `.pixel-world-player-scale-control` | 玩家缩放控件。 |

## 3. 商业街 AI 行为面板 CSS

这些也在 `PixelWorldPanel.css`，主要服务 `CommercialStreetEditor.jsx` 中的行为模型 UI。

| 选择器 | 管什么 |
|---|---|
| `.pixel-world-behavior-panel` | 右侧 AI 行为面板。 |
| `.pixel-world-behavior-panel.collapsed` | 行为面板折叠态。 |
| `.pixel-world-behavior-panel-expand` | 折叠后展开行为面板的按钮。 |
| `.pixel-world-behavior-head-actions` | 行为面板头部按钮区。 |
| `.pixel-world-behavior-field` | 行为面板里的表单字段。 |
| `.pixel-world-behavior-model-actions` | 模型相关操作按钮。 |
| `.pixel-world-behavior-run-row` | 运行行为模型的按钮行。 |
| `.pixel-world-behavior-model-status` | 模型加载/生成状态提示。 |
| `.pixel-world-behavior-model-list` | 可用模型列表。 |
| `.pixel-world-behavior-model-options` | 模型选项按钮。 |
| `.pixel-world-behavior-fold` | 行为枝丫折叠块。 |
| `.pixel-world-behavior-fold-head` | 行为枝丫折叠块标题。 |
| `.pixel-world-behavior-fold-body` | 行为枝丫折叠块内容。 |
| `.pixel-world-behavior-section-title` | 行为面板小节标题。 |
| `.pixel-world-behavior-constraints` | 行为生成约束说明。 |
| `.pixel-world-behavior-chip-list` | 行为标签/约束 chip 列表。 |
| `.pixel-world-behavior-branch-map` | 行为分支映射结果。 |
| `.pixel-world-behavior-proximity` | 玩家与可交互对象距离提示。 |
| `.pixel-world-behavior-actions` | 行为动作按钮组。 |
| `.pixel-world-behavior-status` | 行为执行状态。 |
| `.pixel-world-behavior-runtime` | 当前行为运行时信息。 |
| `.pixel-world-behavior-runtime-control` | 行为运行控制块。 |
| `.pixel-world-behavior-runtime-choice-grid` | 行为运行时选择按钮网格。 |
| `.pixel-world-behavior-json-grid` | 输入/输出 JSON 调试展示。 |

## 4. 桌面窗口覆盖 CSS

这些选择器主要在 `client/src/styles/desktop.css`，用于商业街在桌面窗口里的尺寸和响应式修正。

| 选择器 | 管什么 |
|---|---|
| `.desktop-browser-shadow-window.tab-commercial_street .plugin-content-shell > *` | 商业街在桌面浮窗里的内容铺满/适配。 |
| `.app-container:is(.tab-commercial_street, .tab-pixel_cottage).is-window-narrow ...` | 窄窗口适配。 |
| `.app-container:is(.tab-commercial_street, .tab-pixel_cottage).is-window-scaled ...` | 缩放窗口适配。 |
| `.app-container:is(.tab-commercial_street, .tab-pixel_cottage).is-window-tight ...` | 更紧凑窗口适配。 |
| `.app-container:is(.tab-commercial_street, .tab-pixel_cottage).is-window-low ...` | 低高度窗口适配。 |
| `.app-container:is(.tab-commercial_street, .tab-pixel_cottage).is-window-floating ...` | 浮窗模式适配。 |

## 5. 商业街日志 CSS

这些选择器在 `client/src/plugins/city/CityLog.css`，只管“商业街日志”页面。

| 选择器 | 管什么 |
|---|---|
| `.city-log-panel` | 日志页最外层。 |
| `.city-log-tabs` | 日志页 tab。 |
| `.city-log-content` | 日志页主体内容。 |
| `.city-log-loading` | 加载态。 |
| `.city-log-feed` | 日志 feed 外层。 |
| `.city-log-overview` | 顶部概览区。 |
| `.city-log-overview-title` | 概览标题。 |
| `.city-log-kicker` | 概览小标签。 |
| `.city-log-stat-grid` | 统计卡片网格。 |
| `.city-log-stat-card` | 单个统计卡片。 |
| `.city-log-feed-layout` | 日志页左右/多栏布局。 |
| `.city-log-main-panel` | 日志主列表面板。 |
| `.city-log-population-panel` | 角色状态面板。 |
| `.city-log-announcement-panel` | 公告/天气/市长广播面板。 |
| `.city-log-activity-panel` | 活动日志面板。 |
| `.city-log-main-header` | 主面板标题栏。 |
| `.city-log-workbench` | 日志工作区。 |
| `.city-log-weather-card` | 天气卡片。 |
| `.city-log-notice-card` | 公告卡片。 |
| `.city-log-date-group` | 按日期分组的日志块。 |
| `.city-log-date-header` | 日期分组标题。 |
| `.city-log-entry` | 单条日志。 |
| `.city-log-entry.is-social` | 社交类日志样式。 |
| `.city-log-entry.is-muted` | 折叠/隐藏/弱化日志样式。 |
| `.city-log-character-card` | 角色状态卡片。 |
| `.city-scroll` | 日志页自定义滚动条。 |

## 6. 前端调用位置

| 文件 | 主要调用 |
|---|---|
| `client/src/plugins/pixelWorld/CommercialStreetEditor.jsx` | 调 `/city/characters`、行为模型相关接口。 |
| `client/src/plugins/city/CityManager.jsx` | 调地点、物品、任务、事件、配置、市长等管理接口。 |
| `client/src/plugins/city/CityLog.jsx` | 调日志、公告、事件、角色、重 roll、任务评分重试接口。 |
| `client/src/desktop/DesktopTaskbar.jsx` | 调 `/city/events` 用于任务栏/事件提示。 |

## 7. 后端接口总览

全部接口都要求登录鉴权，路径基于前端的 `apiUrl`，也就是实际请求一般是 `${apiUrl}/city/...`，后端完整路径是 `/api/city/...`。

### 7.1 日志与公告

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/logs` | 读取商业街行动日志。 | Query: `limit`，默认 `300`，可传 `all`。 | `{ success, logs }` |
| `POST` | `/api/city/logs/:id/reroll` | 对折叠、失败或强制指定的日志重新生成展示文案。 | Param: `id`；Body: `{ force?, messageId? }` | `{ success, log }` |
| `POST` | `/api/city/logs/:id/retry-quest-score` | 重试某条行动日志关联的任务评分。 | Param: `id` | `{ success, review }` |
| `DELETE` | `/api/city/logs/clear` | 清空所有商业街活动记录和市长广播消息。 | 无 | `{ success, message }` |
| `GET` | `/api/city/announcements` | 读取商业街公告、公共播报、中介广告、市长广播。 | Query: `limit`，默认 `50`。 | `{ success, announcements }` |

### 7.2 角色状态、钱包、体力、背包

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/characters` | 获取所有角色在商业街里的状态。包含位置、体力、钱包、情绪、背包等。 | 无 | `{ success, characters }` |
| `POST` | `/api/city/give-gold` | 给角色送钱，并写商业街日志；可能触发角色私聊反馈。 | Body: `{ characterId, amount }` | `{ success, wallet }` |
| `POST` | `/api/city/feed` | 给角色补给体力/卡路里，更新饥饿状态。 | Body: `{ characterId, calories }` | `{ success, calories }` |
| `GET` | `/api/city/inventory/:charId` | 获取某个角色背包。 | Param: `charId` | `{ success, inventory }` |
| `POST` | `/api/city/give-item` | 给角色发物品，并写入日志；可能触发私聊反馈。 | Body: `{ characterId, itemId, quantity }` | `{ success, inventory }` |

### 7.3 地点/分区管理

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/districts` | 获取商业街所有地点/分区。 | 无 | `{ success, districts }` |
| `POST` | `/api/city/districts` | 新增或更新地点/分区。 | Body: 地点配置，必须有 `name`。 | `{ success, district }` |
| `DELETE` | `/api/city/districts/:id` | 删除地点/分区。 | Param: `id` | `{ success }` |
| `PATCH` | `/api/city/districts/:id/toggle` | 启用或停用地点/分区。 | Param: `id` | `{ success, district }` |

### 7.4 配置、经济、日程

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/config` | 获取商业街全局配置。 | 无 | `{ success, config }` |
| `POST` | `/api/city/config` | 更新一个配置项。 | Body: `{ key, value }` | `{ success, config }` |
| `GET` | `/api/city/economy` | 获取商业街经济统计。 | 无 | `{ success, stats }` |
| `GET` | `/api/city/schedules/:charId` | 获取角色今日日程；没有日程时返回空数组。 | Param: `charId` | `{ success, schedule }` |
| `GET` | `/api/city/schedule/:charId` | 获取角色今日日程；没有日程时返回 `null`。 | Param: `charId` | `{ success, schedule }` |
| `POST` | `/api/city/schedules/:charId/generate` | 手动强制重新生成某角色今日日程。 | Param: `charId` | `{ success, schedule }` |

### 7.5 商品/物品库

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/items` | 获取商业街商品/物品库。 | 无 | `{ success, items }` |
| `POST` | `/api/city/items` | 新增或更新商品/物品。 | Body: 商品配置，必须有 `name`。 | `{ success, item }` |
| `DELETE` | `/api/city/items/:id` | 删除商品/物品。 | Param: `id` | `{ success }` |

### 7.6 事件系统

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/events` | 获取当前生效事件。传 `all=1` 时获取全部事件。 | Query: `all=1?` | `{ success, events }` |
| `POST` | `/api/city/events` | 新建商业街事件。 | Body: 事件配置，必须有 `title`。 | `{ success }` |
| `DELETE` | `/api/city/events/:id` | 删除事件。 | Param: `id` | `{ success }` |

### 7.7 任务系统

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/quests` | 获取当前可用任务。传 `all=1` 时获取全部任务。 | Query: `all=1?` | `{ success, quests }` |
| `POST` | `/api/city/quests` | 新建任务，并调用市长 AI 对难度/目标分进行评分。 | Body: 任务配置，必须有 `title`。 | `{ success, questId }` |
| `POST` | `/api/city/quests/:id/claim` | 指派某角色领取任务，会登记任务领取并触发一条私聊派发提醒。 | Param: `id`；Body: `{ characterId }` | `{ success, actionTriggered, actionResult, actionError }` |
| `POST` | `/api/city/quests/:id/complete` | 手动结算任务。成功时发奖励；失败时写失效公告。 | Param: `id`；Body: `{ characterId }` | `{ success, won, reason? }` |
| `DELETE` | `/api/city/quests/:id` | 删除任务，并删除关联公告。 | Param: `id` | `{ success }` |

### 7.8 AI 行为模型

这些接口主要给商业街编辑器右侧 AI 行为面板使用。

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/characters/:characterId/behavior-models` | 拉取某角色绑定 API 的可用模型列表。 | Param: `characterId` | `{ success, models, endpoint, model_name }` |
| `POST` | `/api/city/characters/:characterId/behavior-input` | 构建行为模型输入包，用于预览/调试 AI 行为树输入。 | Param: `characterId`；Body: 行为上下文配置。 | `{ success, skeleton, input }` |
| `POST` | `/api/city/characters/:characterId/behavior-base-branches` | 让 AI 生成基础行为枝丫和交互起手式。 | Param: `characterId`；Body: 重建/约束配置。 | `{ success, skeleton, input, base_branches, base_patches, interaction_branches, interaction_patches, raw_output, fallback, error }` |
| `POST` | `/api/city/characters/:characterId/behavior-branch` | 让 AI 生成某一个具体行为分支。 | Param: `characterId`；Body: 分支生成配置。 | `{ success, skeleton, input, tree_patch, branch, raw_output, fallback, error }` |

### 7.9 市长 AI 与全量清理

| 方法 | 接口 | 用途 | 常用参数/Body | 返回 |
|---|---|---|---|---|
| `POST` | `/api/city/mayor/run` | 手动运行市长 AI，生成或应用城市事件、公告、任务等决策。 | 无 | 市长运行结果对象 |
| `DELETE` | `/api/city/data/wipe` | 清空商业街全部数据，包括地点、物品、资产、日志等。危险操作。 | 无 | `{ success, message }` |

## 8. 哪些页面用哪些接口

### 商业街地图

文件：`client/src/plugins/pixelWorld/CommercialStreetEditor.jsx`

| 接口 | 用在什么地方 |
|---|---|
| `GET /api/city/characters` | 读取商业街角色状态，用于角色选择、位置/行为面板。 |
| `GET /api/city/characters/:characterId/behavior-models` | 行为面板拉取模型列表。 |
| `POST /api/city/characters/:characterId/behavior-input` | 行为面板预览 AI 输入包。 |
| `POST /api/city/characters/:characterId/behavior-branch` | 生成单个行为分支。 |
| `POST /api/city/characters/:characterId/behavior-base-branches` | 生成基础行为枝丫。 |

### 商业街管理

文件：`client/src/plugins/city/CityManager.jsx`

| 接口 | 用在什么地方 |
|---|---|
| `GET /api/city/districts` | 地点管理列表。 |
| `POST /api/city/districts` | 新增/编辑地点。 |
| `DELETE /api/city/districts/:id` | 删除地点。 |
| `PATCH /api/city/districts/:id/toggle` | 启停地点。 |
| `GET /api/city/characters` | 角色状态和操作目标。 |
| `GET /api/city/config` | 配置面板。 |
| `POST /api/city/config` | 保存配置项。 |
| `GET /api/city/economy` | 经济统计。 |
| `GET /api/city/items` | 商品管理列表。 |
| `POST /api/city/items` | 新增/编辑商品。 |
| `DELETE /api/city/items/:id` | 删除商品。 |
| `POST /api/city/give-gold` | 给角色送钱。 |
| `POST /api/city/feed` | 给角色补体力。 |
| `POST /api/city/give-item` | 给角色发物品。 |
| `GET /api/city/events` | 事件列表。 |
| `DELETE /api/city/events/:id` | 删除事件。 |
| `GET /api/city/quests` | 任务列表。 |
| `POST /api/city/quests/:id/claim` | 指派任务。 |
| `POST /api/city/quests/:id/complete` | 完成/结算任务。 |
| `DELETE /api/city/quests/:id` | 删除任务。 |
| `DELETE /api/city/logs/clear` | 清空日志。 |
| `DELETE /api/city/data/wipe` | 格式化商业街数据。 |
| `POST /api/city/mayor/run` | 手动跑市长 AI。 |

### 商业街日志

文件：`client/src/plugins/city/CityLog.jsx`

| 接口 | 用在什么地方 |
|---|---|
| `GET /api/city/logs?limit=all` | 日志主列表。 |
| `GET /api/city/announcements?limit=50` | 公告/市长广播/中介广告。 |
| `GET /api/city/events` | 当前事件展示。 |
| `GET /api/city/characters` | 人口/角色状态面板。 |
| `POST /api/city/logs/:id/retry-quest-score` | 评分失败日志的重试按钮。 |
| `POST /api/city/logs/:id/reroll` | 折叠/失败日志的重 roll 按钮。 |

## 9. 修改时的注意点

- 商业街地图和像素小屋共用 `PixelWorldPanel.css`，改 `.pixel-world-*` 时要确认不会影响像素小屋。
- 只想改商业街窗口尺寸，优先找 `desktop.css` 里的 `.tab-commercial_street`、`.is-window-narrow`、`.is-window-scaled`。
- 只想改商业街日志，不要动 `PixelWorldPanel.css`，应改 `CityLog.css`。
- 行为面板相关样式都是 `.pixel-world-behavior-*`。
- 后端接口都在 `/api/city/*`，前端一般写成 `${apiUrl}/city/...`。
- `DELETE /api/city/data/wipe` 是危险操作，会清空商业街全部数据。
