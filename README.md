# ChatPulse

## English

ChatPulse is a local-first AI social simulation desktop app.

The app is not a simple chat demo. It combines private chat, group chat, long-term memory, secret journals, character state, relationships, economy, a commercial street, pixel rooms, housing, a Windows-like desktop shell, notifications, quick settings, and experimental MCP tools into one local world.

### Current Product Shape

- Windows-like desktop home with icons, taskbar, start menu, notification center, calendar, quick settings, WLAN panel, brightness and volume simulation.
- Desktop apps for Social, Memory Library, MCP Lab, Settings, Housing, Commercial Street, Pixel Cottage, City Log, folders, and Recycle Bin.
- Real folder-like windows with dragging, resizing, maximizing, minimizing, stacking, and multi-folder support.
- Recycle Bin with empty/full icons, restore, permanent delete, and empty actions.
- Private chat and group chat with character state, memory hooks, avatars, frames, foreground decorations, and settings panels.
- Long-term memory with SQLite facts and optional Qdrant vector recall.
- Commercial street simulation with characters, schedules, inventory, tasks, mayor AI, social encounters, and wallet sync.
- Pixel world tools for commercial street layout, room assets, furniture, character movement, and behavior tree debugging.
- Housing system with listings, recommendations, viewings, signing, rent, and private chat feedback.
- Local admin, backups, restore, MCP Lab, media upload, and safety boundaries.

### Quick Start

Requirements:

- Node.js 18+, Node 20 recommended
- npm 9+
- Docker Desktop optional, for Qdrant

Install:

```bash
git clone <repository-url>
cd ChatPulse
npm run setup
```

Start development mode:

```bash
npm run dev
```

Default local URLs:

- Web app and backend: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Vite dev client: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- Qdrant: [http://127.0.0.1:6333](http://127.0.0.1:6333)

Fresh installs create a local root account during first boot. Set `ADMIN_PASSWORD` in `server/.env` before first initialization if you want a fixed first-run password; otherwise the server generates one and prints it once in the startup log.

Windows helpers:

```bat
install-and-start.cmd
Start-ChatPulse.cmd
start-stack.cmd
status-stack.cmd
stop-stack.cmd
```

### Build And Deploy

Build the current web client:

```bash
npm --prefix client run build
```

Start the backend, which serves `client/dist`:

```bash
npm --prefix server run start
```

Build desktop preview:

```bash
npm run desktop:dev
```

Build desktop package:

```bash
npm run desktop:pack
```

Build Windows installer:

```bash
npm run desktop:dist
```

The committed `client/dist` is the current deployable web build. Vite is configured to clean old build hashes before writing a new build, so `dist` should not accumulate previous versions.

### Configuration

Primary config file:

```text
server/.env
```

Common options:

- `ADMIN_PASSWORD`: initial root password for a fresh auth database
- `JWT_SECRET`: fixed JWT secret, generated locally if absent
- `PORT`: backend port, default `8000`
- `QDRANT_ENABLED`: enables Qdrant memory recall
- `QDRANT_URL`: default `http://127.0.0.1:6333`
- `QDRANT_API_KEY`: optional remote Qdrant key
- `CP_SAFE_MODE`: keeps background city simulation conservative
- `SERPER_API_KEY`, `TAVILY_API_KEY`, `BRAVE_SEARCH_API_KEY`, `BING_SEARCH_API_KEY`: optional MCP Lab search providers

Do not commit real model keys, admin secrets, local databases, uploaded private files, or logs.

### Project Layout

```text
client/
  src/
    App.jsx
    components/
    desktop/
    plugins/
    styles/
    utils/
  public/assets/
  dist/

server/
  index.js
  db.js
  authDb.js
  engine.js
  memory.js
  plugins/

desktop/
  main.cjs
  assets/

scripts/
  setup-local.js
  doctor.js
  dev.js
  migrate-memories-to-qdrant.js
```

Important desktop frontend split:

```text
client/src/desktop/
  ChatPulseDesktop.jsx
  DesktopTaskbar.jsx
  DesktopAppButton.jsx
  desktopUtils.js

client/src/styles/
  desktop.css
```

### Art Assets

Source art lives in:

```text
client/public/assets/
```

Important groups:

- `ui/desktop`: desktop icons, wallpaper, start menu art, weather, and news widgets
- `ui/private-chat`: private chat foreground and decoration assets
- `ui/settings`: settings page decoration and modular UI art
- `ui/login-pixel`: login page pixel UI
- `avatar-frames`: selectable avatar frames
- `pixel-world`: commercial street, room, furniture, character, and editor assets

Do not treat old `client/dist` hashes as source art. Source assets should be judged by code references, manifest references, runtime loading, and pre-use systems such as wallpapers, weather, news, widgets, and pixel-world catalogs.

### Quality Checks

```bash
npm --prefix client run build
npm --prefix client run lint
npm --prefix server test
npm run doctor
```

Current important guarantees:

- AI, RAG, behavior tree, and JSON failures should remain visible instead of being faked as success.
- Auth, upload, backup, import, path safety, and permission checks are product boundaries.
- Desktop shell entry, taskbar, notifications, quick settings, folders, and Recycle Bin are part of the main product surface.

### License

ChatPulse uses **CC BY-NC-ND 4.0**.

You may share it with attribution to the original repository link. Commercial use and modified redistribution are not allowed.

See [LICENSE](./LICENSE) and the [Creative Commons license page](https://creativecommons.org/licenses/by-nc-nd/4.0/).

---

## 中文

ChatPulse 是一个本地优先的 AI 社交模拟桌面应用。

它不是一个普通聊天 demo。它把私聊、群聊、长期记忆、秘密日记、角色状态、关系、经济、商业街、像素小屋、住房系统、类 Windows 桌面壳、通知中心、快捷设置和 MCP 实验工具放进同一个本地世界。

### 当前产品形态

- 类 Windows 桌面主页，包含桌面图标、任务栏、开始菜单、通知中心、日历、快捷设置、WLAN 面板、亮度和音量模拟。
- 桌面应用入口包括社交、记忆库、MCP 实验室、设置、住房系统、商业街、像素小屋、商业街日志、文件夹和回收站。
- 仿真实文件夹窗口支持拖动、缩放、最大化、最小化、层级叠放和多个文件夹并存。
- 回收站支持空/满图标、还原、永久删除和清空。
- 私聊和群聊支持角色状态、记忆链路、头像、头像框、前景装饰和设置面板。
- 长期记忆使用 SQLite 保存事实，可选 Qdrant 做向量召回。
- 商业街模拟支持角色、日程、库存、任务、市长 AI、社交遭遇和钱包同步。
- 像素世界工具支持商业街布局、房间素材、家具、角色移动和行为树调试。
- 住房系统支持房源、推荐、看房、签约、租金和私聊反馈。
- 本地管理、备份恢复、MCP Lab、媒体上传和安全边界仍然保留。

### 快速开始

环境要求：

- Node.js 18+，推荐 Node 20
- npm 9+
- 可选 Docker Desktop，用于 Qdrant

安装：

```bash
git clone <repository-url>
cd ChatPulse
npm run setup
```

启动开发环境：

```bash
npm run dev
```

默认本地地址：

- Web 应用和后端：[http://127.0.0.1:8000](http://127.0.0.1:8000)
- Vite 开发前端：[http://127.0.0.1:5173](http://127.0.0.1:5173)
- Qdrant：[http://127.0.0.1:6333](http://127.0.0.1:6333)

全新本地数据目录首次启动时会创建本地 root 账号。如果希望首次运行密码固定，请在初始化前设置 `server/.env` 里的 `ADMIN_PASSWORD`；否则服务器会生成一次性初始密码，并只在启动日志里打印一次。

Windows 辅助脚本：

```bat
install-and-start.cmd
Start-ChatPulse.cmd
start-stack.cmd
status-stack.cmd
stop-stack.cmd
```

### 构建和部署

构建当前 Web 前端：

```bash
npm --prefix client run build
```

启动后端，后端会服务 `client/dist`：

```bash
npm --prefix server run start
```

桌面开发预览：

```bash
npm run desktop:dev
```

生成桌面目录包：

```bash
npm run desktop:pack
```

生成 Windows 安装包：

```bash
npm run desktop:dist
```

仓库里提交的 `client/dist` 是当前可部署 Web 构建。Vite 已恢复构建前清理旧输出目录，所以 `dist` 不应该继续堆积旧 hash 版本。

### 配置

主要配置文件：

```text
server/.env
```

常用项：

- `ADMIN_PASSWORD`：全新认证库初始化时使用的 root 密码
- `JWT_SECRET`：固定 JWT secret，不设置时会本地生成
- `PORT`：后端端口，默认 `8000`
- `QDRANT_ENABLED`：是否启用 Qdrant 记忆召回
- `QDRANT_URL`：默认 `http://127.0.0.1:6333`
- `QDRANT_API_KEY`：远程 Qdrant 可选密钥
- `CP_SAFE_MODE`：让后台城市模拟更保守
- `SERPER_API_KEY`、`TAVILY_API_KEY`、`BRAVE_SEARCH_API_KEY`、`BING_SEARCH_API_KEY`：MCP Lab 可选搜索源

不要提交真实模型 Key、管理员密钥、本地数据库、私有上传文件或日志。

### 项目结构

```text
client/
  src/
    App.jsx
    components/
    desktop/
    plugins/
    styles/
    utils/
  public/assets/
  dist/

server/
  index.js
  db.js
  authDb.js
  engine.js
  memory.js
  plugins/

desktop/
  main.cjs
  assets/

scripts/
  setup-local.js
  doctor.js
  dev.js
  migrate-memories-to-qdrant.js
```

桌面前端拆分重点：

```text
client/src/desktop/
  ChatPulseDesktop.jsx
  DesktopTaskbar.jsx
  DesktopAppButton.jsx
  desktopUtils.js

client/src/styles/
  desktop.css
```

### 美术资源

源美术资源位于：

```text
client/public/assets/
```

重要分组：

- `ui/desktop`：桌面图标、壁纸、开始菜单图片、天气和新闻小组件
- `ui/private-chat`：私聊前景和装饰素材
- `ui/settings`：设置页装饰和模块化 UI
- `ui/login-pixel`：登录页像素 UI
- `avatar-frames`：可选头像框
- `pixel-world`：商业街、房间、家具、角色和编辑器素材

不要把 `client/dist` 里的旧 hash 包当成源美术维护。判断源素材是否使用时，要同时看源码引用、manifest 引用、运行页加载，以及壁纸、天气、新闻、小组件、像素世界素材库这类预使用系统。

### 质量检查

```bash
npm --prefix client run build
npm --prefix client run lint
npm --prefix server test
npm run doctor
```

当前重要边界：

- AI、RAG、行为树和 JSON 失败要可见，不能伪造成成功。
- 鉴权、上传、备份、导入、路径安全和权限检查是产品边界。
- 桌面入口、任务栏、通知、快捷设置、文件夹和回收站都是主产品界面的一部分。

### 许可证

ChatPulse 使用 **CC BY-NC-ND 4.0**。

可以转载和分享，但必须注明原始仓库链接。禁止商用，禁止修改后再发布。

完整许可见 [LICENSE](./LICENSE) 和 [Creative Commons 官方页面](https://creativecommons.org/licenses/by-nc-nd/4.0/)。
