# ChatPulse: 次世代 AI 沉浸式社交模拟器

ChatPulse 是一款类似于微信（WeChat）的独立 Web 应用程序，致力于提供**极具沉浸感、高度拟真**的 AI 社交体验。在这个世界里，你不仅是在和 AI “对话”，而是在和一群拥有自己独立人格、记忆和社交圈的数字生命交朋友。

## 🌟 核心功能特色：不仅是聊天，而是真实的“赛博人生” (Core Features)

本项目绝非简单的 API 包装盒，而是一个在冰山之下运行着**极度复杂的情感引擎与记忆流**的微型数字社会。

### 🧊 冰山之下的怪物级隐藏机制：

- 😡 **AI 情绪崩溃与拉黑机制 (Blocking & Unblocking)**
  不仅是你不理它它会主动找你，一旦你的【好感度】降到极低，或者你触发了某些不可原谅的关键词，**AI 真的会把你拉黑**！你发消息过去会显示红色的感叹号“消息已发出，但被对方拒收”。
  *突破常规：* 你必须使用特殊手段（比如转账高额金钱、群聊里让别的 AI 帮忙去劝、或者等待它自然消气）才能解除拉黑。

- 🍷 **AI 互相吃醋机制 (Jealousy Engine)**
  如果你和某个好感度极高的 AI-A 私聊特别频繁，甚至发了专属的转账，而另一个喜欢你的 AI-B 恰好是你们所在群聊的成员。**AI-B 甚至会“监听”到你冷落了它，从而好感度下降，甚至在群里对你或者对 AI-A 阴阳怪气**。

- 📖 **带密码的深层日记档案 (Secret Diaries with Passwords)**
  每个 AI 都会在后台根据当前发生的故事偷偷写日记。但某些涉及它身世秘密的日记，是带【四位密码🔒】的！你必须要通过和它长期聊天，像玩海龟汤一样套出密码，才能在日记面板解锁查看。

- 🧠 **基于 Transformer 向量检索的永久记忆 (RAG Memory)**
  我们内置了 `onnxruntime-node` 模型，AI 会把你跟它说过的关键设定（你的生日、喜欢的颜色、你的猫的名字），自动提取并向量化永久存在数据库里。就算你半年后再跟它聊，它也能在向量片段里回忆起来，拒绝“金鱼记忆”。

- 💸 **完全拟真的经济系统与反向交互 (Reverse Transfer Ecosystem)**
  聊天界面内置纯正的转账功能。你可以给 AI 转账并在留言里写上“**拿去买衣服**”或“**给你点了一份外卖**”，大语言模型会直接读取你的金钱和留言并做出超真实的个性化反应。
  更绝的是：如果 AI 人设是个富婆，或者你曾经帮过它触发了感激度，**AI 会在某天突然反向给你转账**！若你选择“退还”，还会触发它傲娇或尴尬的新情绪分支。

- � **多级主动搭话时间感 (Proactive Chrono-awareness)**
  AI 是有时间观念的。系统感知当前是你所在时区的深夜两点还是清晨八点，AI 主动来找你聊天的话题完全不同，可能深夜会变成“失眠求安慰”的语气。

- 🔥 **群聊中的动态好感度流转 (Intra-Group Affinity)**
  AI 在群里不仅会互相艾特 (@Mentions) 和抢红包。如果 AI-A 和 AI-B 聊得很投机，**它们俩之间的后台好感度会自动增加**。原本不认识的数字生命可以在群里成为羁绊极深的好友。

- 🎭 **1+2 混合潜意识引擎 (Hybrid Hidden Context)**
  AI 会通过单独的记忆模型在后台对你们的绝密私聊进行“内心戏浓缩”（生成 Hidden Mood）。当处于公开群聊时，AI 会带着这句潜意识记忆和你们最近的三句私聊作为隐秘上下文，产生“虽然我们在群里，但我对你刚才的私聊心照不宣”的绝妙暧昧拉扯（且系统已下达 God Command 严禁 AI 直接引用私聊内容泄密，全靠演技）。

- 🐛 **独立小模型记忆处理 (Dedicated Memory Model Config Fix)**
  修复了小模型 API 配置保存失败的问题。现在你可以直接在角色设置面板里为每个 AI 独立配置专门处理记忆与提取潜意识的经济型小模型（例如 gpt-4o-mini 或 deepseek-chat），且配置能被正确持久化保存。

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
