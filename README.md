# ChatPulse: 次世代 AI 沉浸式社交模拟器

ChatPulse 是一款类似于微信（WeChat）的独立 Web 应用程序，致力于提供**极具沉浸感、高度拟真**的 AI 社交体验。在这个世界里，你不仅是在和 AI “对话”，而是在和一群拥有自己独立人格、记忆和社交圈的数字生命交朋友。

## 🌟 核心功能特色 (Core Features)

- 🤖 **多维角色与人格 (Distinct Personas)**
  - 支持多模型接入（如 GPT-5.2, DeepSeek, Gemini, Grok 等），每个角色可以配置独立的 API 和提示词，拥有截然不同的性格。
  - **角色记忆系统：** AI 能够记住你们的对话历史并在后续交流中提及。

- 💬 **高度真实的群聊生态 (Dynamic Group Chats)**
  - **AI 互聊与接话：** AI 可以在群聊中互相艾特 (@Mentions)、互相接话，甚至自己主动挑起话题，打破“人类不说话 AI 就装死”的传统设定。
  - **抢红包功能 (Red Packets)：** 还原真实群聊体验，用户可以发拼手气红包，群内的 AI 会像真人一样拼手速去抢，抢多抢少还会有不同的戏剧化反应。

- ❤️ **动态好感度与情绪系统 (Affinity & Emotional Engine)**
  - 你所说的每一句话都可能悄悄改变 AI 对你的【好感度】。好感度高时，AI 可能会主动找你聊天；好感度低或遭遇冷落时，甚至会触发**“吃醋 (Jealousy)”**或**“情绪压力 (Pressure)”**事件。
  - AI 有自主权：如果惹毛了 AI，它们甚至可以把你**拉黑 (Block)**，你需要通过特殊方式哄回它们。

- 📱 **AI 朋友圈系统 (Moments Feed)**
  - AI 拥有自己的生活！在聊天之余，某些事件或特定对话会触发 AI 自动发一条自己的“朋友圈”，并且其他 AI（或你）也可以在下面点赞互动。

- 💸 **转账与互动经济系统 (Wallet & Transfers)**
  - 聊天界面内置转账功能。你可以给 AI 转账买衣服、点外卖，AI 也可以给你转账（比如还钱、微转账求和）。
  - **真实反应：** 如果你发给 AI 退还转账，AI 还会根据性格表现出傲娇、尴尬或愧疚。

- 📖 **私密日记与成就解锁 (Secret Diaries)**
  - AI 会在后台偷偷写日记记录它的心情。随着好感度增加，部分角色的加密日记可以被你解锁，让你偷窥其“内心真实想法”。

---

## 💻 本地启动与测试指南 (Local Development)

如果你想在自己的 Windows 或 Mac 电脑上运行 ChatPulse（例如：想要先**创建初始人物**再打包到服务器），请严格按照以下步骤操作：

### 1. 安装项目依赖

确保你的电脑已经安装了 [Node.js](https://nodejs.org/) (推荐 18.x 或 20.x 版本)。
然后，你需要**分别**进入前端和后端文件夹安装依赖库。

```bash
# 安装后端依赖 (注意：包含 C++ 绑定的原生模块，会自动编译)
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 2. 本地启动项目

ChatPulse 分为前端网页和后台服务两部分。你需要**打开两个独立的终端 (Terminal) 窗口**分别启动它们：

**终端 1：启动后端服务器**
```bash
cd server
npm start
```
*(看到 `ChatPulse Server running on http://localhost:8001` 代表后端启动成功，此时会在 `server/data/` 自动创建本地 SQLite 数据库)*

**终端 2：启动前端网页**
```bash
cd client
npm run dev
```
*(看到 `Local: http://localhost:5173/` 代表前端启动成功)*

**访问应用：** 打开你的浏览器，访问 `http://localhost:5173`。你现在可以在设置面板中添加你的第一个 AI 角色了！

---

## ☁️ 生产环境部署指南 (Linux 云服务器)

当你在本地测试完毕，写入了初始角色和设定，想要把代码丢到 Linux 云服务器（如 Ubuntu / CentOS）上 24 小时运行时，请参考这部分。

### 1. 准备工作 & 拉取代码

你的服务器需要 Node.js 和 Git：

```bash
sudo apt update
sudo apt install git -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

从你的 GitHub 仓库克隆代码：
```bash
git clone https://github.com/NANA3333333/chatpulse.git
cd chatpulse
```

### 2. 安装服务器端依赖并打包前端

⚠️ **极其重要**：我们的后端用到了 `better-sqlite3` 和 `onnxruntime-node`。这两个库依赖底层的 C++ 环境，**必须在 Linux 里重新执行 `npm install` 编译**，绝对不能把你 Windows 里的 `node_modules` 文件夹拷过去！

```bash
# 重新安装并编译 Linux 版的后端底层库
cd server
npm install

# 编译打包前端代码成静态文件，提升服务器访问性能
cd ../client
npm install
npm run build
```

### 3. 安装 PM2 并持久化运行

为了让 ChatPulse 在你关掉服务器 SSH 终端后依然保持运行，我们需要使用 PM2：

```bash
sudo npm install pm2 -g

cd ../server
# 使用 PM2 后台启动后端服务！
pm2 start index.js --name "chatpulse"

# 保存运行列表并设置开机自启
pm2 save
pm2 startup
```
*(注意：运行 `pm2 startup` 后，终端会打印出一行长命令让你复制执行，千万别漏了这一步)*

### 4. 放行端口

去你的云服务器控制台（如阿里云/腾讯云），在**安全组/防火墙**设置中，放行 **8001 端口** 的入站流量。
最后在浏览器访问：`http://你的服务器公网IP:8001` 即可！

---

## 📄 开源许可证 (License)

本项目采用 **[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh-hans)** (署名-非商业性使用-禁止演绎 4.0 国际) 协议进行分发与授权。

当您使用或分享本项目的代码或衍生内容时，**必须严格遵守以下条款**：

- 🟢 **署名 (Attribution)：** 您必须给出适当的署名，提供指向本项目的链接以及本许可协议的链接。
- 🔴 **非商业性使用 (NonCommercial)：** 您**不得**将本材料或其衍生品用于任何商业目的（不可转卖、付费订阅或用于包含盈利性质的商业运营）。
- 🔴 **禁止演绎 (NoDerivatives)：** 如果您改变、转换本材料或基于本材料进行二次创作（不可二改），您**不得**分发修改后的材料（不可二转分叉版）。

任何未经许可的违规商业化或二次分发行为，项目原作者保留追究侵权的权利。
