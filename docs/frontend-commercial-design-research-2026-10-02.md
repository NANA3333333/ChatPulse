# ChatPulse 模拟电脑：真实产品界面布局调研

2026-10-02。此文只研究**布局和功能组织**，没有修改 App 的字体、比例或页面样式。项目功能根据当前源码与 `docs/features/` 核对；外部界面通过 HTTP 检查并用 Playwright 无头浏览器在 1440×900 视口捕获。截图保存在 [证据目录](assets/commercial-layouts-2026-10-02/)。

这里区分两种证据：**实时网页**指浏览器实际打开的公开产品页面；**官方界面图**指品牌官网或文档中展示的产品界面截图。后者能说明区域布局，但不代表我进入了它的登录后产品。以下“可借鉴”是针对 ChatPulse 功能提出的布局转译，和“观察到”分开写。

## 八个业务 App

### 1. 社交：私聊、群聊与回复

项目里有联系人、私聊、群聊、消息搜索、回复版本、语音、转账/红包、角色日记与 RAG 状态。参考 [Slack Channels 官方页面](https://slack.com/intl/en-gb/features/channels)中的[产品界面图](assets/commercial-layouts-2026-10-02/slack-app-ui.png)。

**观察到：** 全局搜索在顶端；左侧窄栏放 Home、DMs、Activity；当前会话占最大区域；Thread 作为右侧临时展开的独立栏；两处输入框都贴各自内容区底部。右栏没有挤进消息正文，回复和主会话的边界清楚。这张图是 Slack 官方标注的 *simplified example*，只能当区域组织参考。

**可借鉴：** ChatPulse 社交页可以用“会话选择 → 消息 → 按需展开的角色资料/日记/回复详情”组织。消息和输入是稳定主区，角色状态与 RAG 诊断只在需要时展开。这里尚未决定具体栏宽、字号或颜色。

### 2. 记忆库：关系图、检索与来源

项目里有记忆地图、人物/主题筛选、搜索、记忆详情、来源追溯、编辑、导入和维护。参考 [Obsidian Graph view 官方文档](https://obsidian.md/help/plugins/graph)中的[界面图](assets/commercial-layouts-2026-10-02/obsidian-graph-ui.png)，以及 [Notion Product](https://www.notion.com/product)中的[任务视图界面图](assets/commercial-layouts-2026-10-02/notion-app-ui.png)。

**观察到：** Obsidian 将文件树留在左边，关系图使用整块主画布，选中节点的连线被强调，其余节点减弱。Notion 将工作区树放左侧，内容区上方才是视图切换，当前截图的主内容是按状态分列的卡片。

**可借鉴：** 记忆的“图谱/列表”应是同一批内容的两种视图；搜索和人物筛选靠近内容区，点击记忆再进入来源与编辑。导入和维护属于另一类任务，应有明确入口，但不需要在浏览记忆时持续占据画布。Obsidian 图中没有现成的“来源检查器”，这是对 ChatPulse 功能的转译，不能声称来自截图。

### 3. MCP 实验室：搜索、抓取、检查结果

项目里有网页搜索、URL 抓取、资料源/密钥设置、任务轨迹和上下文检查。参考 [Postman 导航文档](https://learning.postman.com/docs/getting-started/basics/navigating-postman/)中的[完整工作台界面图](assets/commercial-layouts-2026-10-02/postman-app-ui.png)。

**观察到：** 左侧是 Collection 树；中间工作台上部设置并发送请求，下部展示响应；右侧检查栏可承载辅助说明；顶部是工作区与全局搜索，底部是低频工具。发起任务、查看结果在同一主列的上下游位置，不需要切换到另一个主页面。

**可借鉴：** MCP 的搜索词或 URL 输入应靠近运行按钮，结果紧跟任务；来源、上下文或轨迹可用侧栏检查。搜索源与密钥配置作为设置入口，而不是和运行任务并排争夺主区。具体是否常开右栏，需要根据 ChatPulse 窗口宽度再验证。

### 4. 设置：账号、角色、模型和备份

项目里有个人资料、账号安全、角色人设、模型/行为/声音、角色数据和整库备份。参考 [VS Code Settings 官方文档](https://code.visualstudio.com/docs/configure/settings)中的[设置编辑器界面图](assets/commercial-layouts-2026-10-02/vscode-settings-ui.png)。

**观察到：** 页面顶部是一条设置搜索；User/Workspace 是明确作用域；左侧列出分组；右侧主区按设置项纵向排列，每项有名称、解释与控件；搜索结果数和筛选器在搜索框旁。截图中控件没有被做成大面积同权重卡片。

**可借鉴：** ChatPulse 顶层分组可以对应账号、角色、模型、声音、数据。先显示当前编辑对象，再用搜索与分组定位具体设置；角色编辑内部再提供子分组。危险的整库操作位于数据分组中。此处只确定信息路径，不推导字号比例。

### 5. 住房系统：房源选择、租约与小屋

项目里有房源、角色匹配、推荐、看房、租约、交租、AI 中介、房源管理与小屋布置。参考 [Rightmove 伦敦租房结果实时页](https://www.rightmove.co.uk/property-to-rent/find.html?locationIdentifier=REGION%5E87490)的[无头截图](assets/commercial-layouts-2026-10-02/rightmove-results.png)，以及 [Home Assistant Dashboards 官方页面](https://www.home-assistant.io/dashboards/)中的[管理界面图](assets/commercial-layouts-2026-10-02/home-assistant-app-ui.png)。

**观察到：** Rightmove 第一层是横向地点、价格、卧室与房型筛选；结果数、排序和地图切换位于列表上方；房源行以大图与位置/房型/价格/设施并列，右侧有地图和辅助内容。Home Assistant 将房间/设备状态按区域组成网格，适合扫视持续状态，不承担房源比较。

**可借鉴：** 住房 App 的“找房”视图先支持条件筛选和可比较的房源列表；选中后再进入看房、角色匹配和租约。已租房屋、交租与小屋状态属于管理视图，可参考 Home Assistant 的区域状态组织。Rightmove 的实际页面在截图中显示“Map not available”，因此不能把其地图交互当作已验证样本。

### 6. 商业街：行走与地点互动

项目里有像素街景、角色行走、地点互动、自动前往和缩放；实验模式还有场景/行为编辑。参考 [Stardew Valley 官方 Media 页面](https://www.stardewvalley.net/media/)中的[室外游戏截图](assets/commercial-layouts-2026-10-02/stardew-game-2.png)。

**观察到：** 可行走场景占满背景；时间、天气和金币集中于右上；常用物品是一条贴底的工具栏；交互提示直接出现在场景位置。导航没有覆在场景中央。这里是游戏截图，不是网页 UI，适合比较“场景和覆盖层”的关系。

**可借鉴：** 玩家模式让街景持续成为主区域，角色、地点和交互反馈尽量贴近场景；编辑模式再提供完整工具面板。首先要核对 ChatPulse 当前画布实际裁切与窗口滚动，再决定覆盖层位置。

### 7. 像素小屋：房间与物件互动

项目里有房间风格选择、角色移动、房间布局和物件互动；实验模式有家具与行为编辑。参考同一[官方 Media 页面](https://www.stardewvalley.net/media/)中的[室内游戏截图](assets/commercial-layouts-2026-10-02/stardew-game-3.png)。

**观察到：** 房间本身完整占据画面，角色在场景中间，家具/通道的位置提供空间线索；没有持续覆盖画面的控制面板。这张截图没有展示编辑工具，因此不能据此设计具体编辑器。

**可借鉴：** 常规游玩时让房间、角色和可点物件保持可见；风格切换与家具编辑通过独立模式进入。场景是否完整显示要用 ChatPulse 自己的窗口尺寸验证。

### 8. 商业街日志：事件、居民与状态

项目里有城市动态、角色行动、交易、社交、公告、天气、当前事件、居民快照和管理入口。参考 [GitHub Issues 实时页](https://github.com/microsoft/vscode/issues)的[无头截图](assets/commercial-layouts-2026-10-02/github-issues.png)。

**观察到：** 左侧保存稳定的视图入口；主区先有页标题与创建操作，随后是查询栏、状态/筛选/排序，下面是密集的单列事件行。每行把标题、状态、标签、时间、互动数放在固定位置，用户能连续扫视。

**可借鉴：** 日志主区先呈现时间线，筛选/搜索/排序紧贴其上；天气、公告、居民快照用次要区域或单独视图。空日志、筛选无结果和城市未运行是不同状态，应分别说明。GitHub Issues 不是生活日志，借鉴的是信息扫描结构，不是任务语义。

## 模拟电脑的系统窗口

这些不是八个业务 App，但会影响整台电脑的一致性，记录两个能实际看到的参照：

| ChatPulse 窗口与功能 | 实际布局证据 | 可验证的布局方向 |
| --- | --- | --- |
| 文件夹：快捷方式、排序、视图切换、拖入移出；图片：截图、搜索、网格/列表、详情、下载、删除；回收站：搜索、还原、永久删除 | [GitHub 仓库文件浏览实时页](https://github.com/microsoft/vscode/tree/main)及[截图](assets/commercial-layouts-2026-10-02/github-files.png)：路径/分支与查找在文件行上方，列表为主区，右侧 About 独立。 | 文件与截图先有可扫描的内容区，再让排序、视图切换贴在内容上方；选中后的动作应跟随选择状态。GitHub 页面不提供回收站或照片画廊交互，不能直接照用这两种细节。 |
| 文本文档：编辑/预览、保存、格式、拆分/合并、统计、删除 | [VS Code User Interface 官方文档](https://code.visualstudio.com/docs/editing/getting-started/userinterface)及[界面图](assets/commercial-layouts-2026-10-02/vscode-app-ui.png)：资源导航在左，多个文档以标签区分，编辑器占主区。 | 文本编辑优先保留正文、文档身份与保存状态；拆分/合并/删除是次要操作。实际保存提示需在本项目交互中验证。 |

## 此轮结论的边界

- 研究只支持**区域划分、导航、内容顺序和状态呈现**的讨论；未产生字体大小、比例、配色或 CSS 改动。
- Airbnb 首页无头访问停在加载骨架；Home Assistant 在线演示停在加载页；Discord 帮助页与 Zillow 被拒绝访问。因此没有把它们写成可见布局证据。住房改用实际加载的 Rightmove 结果页。
- 官方界面图有演示数据、裁切或营销标注；真正落地前仍需在 ChatPulse 的业务窗口和真实数据量下做线框与无头浏览器验证。

当前工作分支的 UI 源码与先前检查点 `3048f0ed` 相同；上一轮误改的前端提交已由 `32cf9a9f` 回退。
