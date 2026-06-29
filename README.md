# ChatPulse

ChatPulse 是一个本地优先的 AI 社交模拟应用。它不是只负责“发一句话、回一句话”的聊天壳，而是把私聊、群聊、长期记忆、秘密日记、关系网络、经济、商业街、小屋、像素世界、住房社交、后台管理和实验性联网工具放进同一个可持续运行的本地世界。

项目的核心目标是让角色拥有连续存在感：角色有自己的头像、人设、模型、记忆、情绪、身体状态、钱包、住处、日程、朋友关系和城市行动。聊天只是入口，记忆、状态变化和跨模块事件会让角色在之后的对话和生活系统里继续保留影响。

## 当前版本亮点

- 像素风登录页和统一粉色像素 UI 资产。
- 私聊、群聊、日记、长期记忆和角色状态互相联动。
- Qdrant 语义记忆检索，SQLite 保存本地事实源。
- RAG 链路可视化，失败保持可见，不用默认回复伪造成功。
- 新版记忆库和记忆维护流程，支持外部聊天记录导入、预览、清洗和提交。
- 商业街生活模拟：角色行动、日程、任务、商品、地点、公告、市长 AI 和社交遭遇。
- 像素世界编辑器：商业街搭建、小屋素材、房间家具、行为树调试和角色移动。
- 住房社交系统：职业阶层、房源、中介推荐、看房链路、签约、租金和私聊反馈。
- 钱包、私聊转账、群红包和商业街金币同步。
- 管理员后台、备份恢复、MCP 实验台和本地安全边界。
- 仓库包含 `client/dist`，后端可以直接服务当前构建版本。

## 功能地图

### 账号与权限

- 本地注册 / 登录，支持 root 和 admin 管理员角色。
- JWT 会话、主动登出、会话撤销、强制登出和账号更新。
- 邀请码、封禁、角色调整、重置密码、全局公告。
- 认证库和用户业务库分离，每个用户都有独立数据世界。
- WebSocket 使用连接后的认证消息，不把 token 放进 URL。

### 私聊与角色

- 创建、编辑、删除角色，支持 AI 生成角色基础配置。
- 每个角色可配置头像、横幅、人设、模型 URL、Key、模型名、上下文窗口、记忆模型、TTS 音色和主动消息。
- 私聊支持消息重试、批量删除、清空角色数据、导入导出角色包。
- 顶部展示角色状态、情绪、生理状态和 RAG 当前进度。
- 消息级 TTS、TTS 预览、腾讯音色列表。
- 私聊转账、钱包、好感、印象、日记和商业街意图都可进入后续链路。
- 连续相同 API 错误会折叠，生成失败会保留错误状态。

### 长期记忆

- SQLite 保存记忆正文、摘要、来源、人物、物品、关系和时间锚点。
- Qdrant 负责向量召回，支持语义检索、词法 fallback 和时间意图加权。
- 记忆库可查看正式记忆、来源卡片、旧库备份和外部导入结果。
- 支持手动提取、删除、导出、导入、批量整理和 Qdrant 迁移。
- 记忆维护可以用小模型进行分类、补全文摘、合并、归档、遗忘曲线和时间绑定。
- 外部聊天记录支持预览、角色识别、自动转换、分批提交和进度事件。

### 用户资料与秘密日记

- 用户资料、头像、横幅和简介。
- 角色秘密日记支持密码解锁、查看和删除。
- 日记和聊天内容会参与后续上下文或记忆整理。

### 群聊

- 创建群聊、编辑群聊、增删成员、删除群聊。
- 群聊历史读取、批量删除、AI 回复和成员头像展示。
- 支持暂停 AI、无链模式和每个群自己的主动消息计时。
- 经济插件提供群红包、领取记录和钱包变更。

### 关系与印象

- 好友推荐、角色关系、角色互相印象和印象历史。
- 私聊、群聊、商业街社交遭遇和推荐重算都可以影响关系。
- 推荐联系人、关系抽屉和角色状态会读取这些关系数据。

### 经济系统

- 用户钱包与角色钱包。
- 私聊转账卡片、领取、退款和状态回写。
- 群红包创建、领取和详情查询。
- 商业街金币、库存、商品消费、任务奖励和钱包同步。

### 商业街

商业街是 ChatPulse 的生活模拟核心之一。

- 角色居民、地点、区域、商品、库存、公告、事件和任务。
- 管理操作：给金币、喂食、给物品、时间跳跃、清理日志、清空数据。
- 角色日程生成、自动行动、行动日志、行动重掷。
- 状态系统：饱腹、体力、压力、心情、睡眠债、胃负担、医院恢复。
- 行动系统：工作、购物、进食、医疗、学习、赌博、休息和地点活动。
- 公告任务：领取、推进、汇报、完成、失败处理和奖励发放。
- 市长 AI：生成事件 / 任务 / 广播，评分任务难度，调整商品价格。
- 社交遭遇：同地点角色碰撞、多人发言、关系变化和印象更新。
- 默认安全模式会降低后台自动行为强度，避免开发环境被后台任务拖慢。

### 像素世界与小屋素材

- 像素实装面板包含商业街编辑器和房间素材编辑器。
- 商业街编辑器支持建筑、道路、装饰、天空、街段、图层、画布缩放和 JSON 复制。
- 小屋素材包含房间背景、装饰、正面家具、多方向家具和新生成房间资源。
- 支持像素角色预览、地点锚点、碰撞、路径和自动移动。
- 行为树面板支持输入、完整树、patch、输出和失败调试。
- 基础枝丫用于角色自动生活，特殊枝丫用于玩家靠近后的互动，后续枝丫会携带最近互动上下文。
- 行为树生成疑似复读时会返回可重试错误，不在本地改写成成功。

### 住房与社交

- 职业 / 阶层、房源、角色绑定、租金支付和中介系统。
- 用户可以推荐房源给角色，也可以直接指派住处。
- 看房链路包含推荐、信息补充、考虑、最终决定、签约或拒绝。
- 角色需要继续了解时会用结构化标签进入多轮中介问答。
- 签约、拒绝、余额不足等终态都会写入私聊反馈。
- 已入住角色和停用房源会被入口校验拦住，避免覆盖现有住处。

### 成长课程

- 城市成长 DLC 提供课程管理。
- 可配置课程价格、持续时间、恢复 / 消耗字段。
- 角色可通过商业街行动或课程系统参与成长内容。

### MCP 实验台

- 实验性联网工具层。
- 支持搜索、抓取 URL、任务队列、任务重跑和删除任务。
- 支持知识条目保存与检索。
- 搜索源可选 auto、DuckDuckGo、Serper、Tavily、Brave、Bing 等。
- 当前定位是实验台，不是默认自动联网层。

### 媒体与外观

- 默认外观固定为当前粉色像素主题，不再提供主题样式编辑器。
- 用户头像、角色头像、横幅和媒体资源可上传或通过 URL 配置。
- 上传媒体走鉴权读取，前端通过 `AuthenticatedImage` 展示私有头像和图片。
- 登录页和像素 UI 资产位于 `client/public/assets/ui/`。

### 备份与恢复

- 系统备份导出为 zip。
- 支持导入 zip 或数据库文件。
- 支持系统擦除。
- 角色包导入 / 导出包含聊天、记忆、日记和可重建 Qdrant 索引的数据。
- 导入路径做了路径穿越防护。

## 机制约定

这些是当前版本的产品约定，不是待修 bug：

- AI / RAG / 行为树 / JSON 解析失败时，应该返回错误让用户重试。
- 不使用默认回复、默认记忆或默认行为树 patch 去伪造成功。
- 商业街行动、社交遭遇、任务结算、市长 AI、住房链路等生成失败时，优先停止本轮写入。
- 输入校验、数值边界、权限检查、路径安全和数据一致性是必须守住的边界。

## 技术栈

- 前端：React 19、Vite、lucide-react
- 后端：Node.js、Express 5、ws
- 主数据库：SQLite / better-sqlite3
- 向量检索：Qdrant
- 本地嵌入：`@xenova/transformers`、ONNX Runtime
- 上传与媒体：multer、sharp
- 备份：archiver、unzipper
- 定时任务：node-cron

## 快速开始

### 环境要求

- Node.js 18+，推荐 Node 20。
- npm 9+。
- 可选：Docker Desktop，用于本地运行 Qdrant。

Windows 用户可以优先使用仓库里的 `.runtime/node20` 或启动脚本，避免 `better-sqlite3` 因 Node ABI 不一致而加载失败。

### 安装

```bash
git clone https://github.com/NANA3333333/ChatPulse.git
cd ChatPulse
npm run setup
```

`npm run setup` 会安装根目录、`server`、`client` 依赖，创建本地运行目录，并在没有配置文件时从 `server/.env.example` 生成 `server/.env`。

全新本地数据首次启动时会创建默认 root 账号：

```text
账号：Nana
密码：12345
```

Windows 一键安装 / 启动：

```bat
install-and-start.cmd
```

macOS / Linux：

```bash
chmod +x install-and-start.sh
./install-and-start.sh
```

### 启动开发环境

```bash
npm run dev
```

默认访问地址：

- 前端开发服务：[http://127.0.0.1:5173](http://127.0.0.1:5173)
- 后端服务和构建后前端：[http://localhost:8000](http://localhost:8000)
- Qdrant 默认地址：[http://127.0.0.1:6333](http://127.0.0.1:6333)

Windows 也可以使用：

```bat
Start-ChatPulse.cmd
start-stack.cmd
```

### 构建和部署当前版本

```bash
npm --prefix client run build
npm --prefix server run start
```

后端会从 `client/dist` 提供构建后的前端页面。当前仓库已经提交了 `client/dist`，所以拉取 `main` 后可以直接使用这版构建产物；如果修改前端源码，需要重新执行 build。

### 启动 Qdrant

```bash
docker compose up -d
```

迁移已有记忆到 Qdrant：

```bash
npm run migrate:qdrant
```

常用参数：

```bash
npm run migrate:qdrant -- --dry-run
npm run migrate:qdrant -- --user <userId>
npm run migrate:qdrant -- --character <characterId>
```

### 健康检查

```bash
npm run doctor
```

它会检查依赖、目录、SQLite native module 和 Qdrant 连接状态。

## 常用命令

```bash
npm run setup
npm run dev
npm run doctor
npm run migrate:qdrant
npm run cleanup:city-memories
npm --prefix client run lint
npm --prefix client run build
npm --prefix server test
```

Windows 辅助脚本：

```bat
Start-ChatPulse.cmd
start-stack.cmd
status-stack.cmd
stop-stack.cmd
```

## 配置

主要配置文件是 `server/.env`。常用项包括：

- `ADMIN_PASSWORD`：全新认证库初始化时使用的 root 密码；默认示例值是 `12345`，对应初始账号 `Nana`。
- `JWT_SECRET`：固定 JWT secret；不设置时会生成到本地数据目录。
- `PORT`：后端端口，默认 `8000`。
- `QDRANT_ENABLED`：是否启用 Qdrant，默认启用。
- `QDRANT_URL`：Qdrant 地址，默认 `http://127.0.0.1:6333`。
- `QDRANT_API_KEY`：远程 Qdrant 需要鉴权时填写。
- `LOCAL_VECTOR_INDEX_ENABLED=1`：显式启用旧本地 vectra 兼容路径。
- `CP_SAFE_MODE`：商业街后台安全模式，默认更保守。
- `SERPER_API_KEY` / `TAVILY_API_KEY` / `BRAVE_SEARCH_API_KEY` / `BING_SEARCH_API_KEY`：MCP Lab 搜索源可选 Key。

不要把真实模型 Key、管理员密码、生产数据库、上传文件或本地日志提交到仓库。运行时数据默认在 `.gitignore` 里排除。

## 数据与目录

运行时会自动创建：

```text
data/
  master.db
  chatpulse_user_<id>.db
  qdrant/
  .jwt_secret

server/public/uploads/
client/dist/
.runtime/
```

核心源码结构：

```text
client/
  src/
    App.jsx
    components/
    plugins/
    utils/
  public/
    assets/

server/
  index.js
  db.js
  authDb.js
  engine.js
  memory.js
  qdrant.js
  plugins/

scripts/
  setup-local.js
  doctor.js
  dev.js
  migrate-memories-to-qdrant.js
```

后端插件位于 `server/plugins/`：

```text
adminDashboard/
backup/
city/
cityGrowth/
economy/
groupChat/
mcpLab/
relationships/
scheduler/
socialHousing/
```

前端插件入口在 `client/src/plugins.js`，当前可见插件包括：

- MCP 实验台
- 管理员后台
- 住房系统
- 像素实装
- 商业街

## 设计文档

完整开发者设计说明见 [docs/PROJECT_DESIGN.md](./docs/PROJECT_DESIGN.md)。

架构拆分说明见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)。

商业街模块已经从单文件巨块逐步拆为入口、路由、数据层和 service 层。新功能优先放入合适的 plugin、route、service 或 utils 文件，不建议继续把大量业务塞回 `server/index.js` 或 `server/plugins/city/index.js`。

## 测试与质量检查

当前项目主要用 smoke test 保护关键行为和安全边界：

```bash
npm --prefix server test
```

常用前端检查：

```bash
npm --prefix client run lint
npm --prefix client run build
```

重要检查覆盖：

- 鉴权、权限和会话边界。
- 上传、备份、导入路径安全。
- 角色、消息、记忆、群聊、经济、商业街和住房输入校验。
- AI / RAG / 行为树失败不能伪造成成功。
- 商业街数值边界、任务结算和 DB 防御。
- 像素世界行为树选择、失败可见性、防重复。
- 记忆维护设置掩码、外部导入和进度状态。
- 聊天抽屉懒加载不能让中间区域白屏。

## 许可证

本项目采用 **CC BY-NC-ND 4.0** 许可。

这意味着：

- 可以转载和分享。
- 必须注明作者 `NANA3333333 / Nana` 以及原始仓库链接。
- 禁止商用。
- 禁止修改后再发布。

完整许可见 [LICENSE](./LICENSE) 和 [Creative Commons 官方页面](https://creativecommons.org/licenses/by-nc-nd/4.0/)。
