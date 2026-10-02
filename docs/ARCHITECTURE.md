# ChatPulse 当前架构

业务按功能拆分已落地。查找入口是 [功能导航](features/README.md)，按接口排查可直接查 [API 对应表](features/api-map.md)。本次整理保持现有接口路径、事件名称、数据路径与启动方式；密码方案和多用户数据隔离不在此次改造范围内。

## 目录职责

```text
client/src/
  main.jsx                 Provider 与页面启动
  app/                     应用状态组合、功能注册、页面与事件装配
  desktop/                 网页桌面的窗口、任务栏、壁纸、交互
  features/<功能>/         功能组件、状态 hook、API 与事件处理
  labs/mcp/                MCP 实验界面
  labs/scene-editor/       可选素材编辑与 AI 诊断；玩家场景归 features/city/scene
  shared/                  通用媒体、国际化、WebSocket 传输与 UI 支持

server/
  index.js                 进程启动、就绪检查和关闭
  app.js                   中间件、依赖组合、功能装配
  features/<功能>/         HTTP、业务流程、数据操作、表定义与兼容升级
  labs/                    显式开启的实验接口
  platform/
    db/                    连接、数据库门面、按原顺序执行升级
    llm/                   模型客户端、分词与模型缓存
    vectors/               向量存储与嵌入执行
    http/                  通用校验与请求追踪
    realtime/              连接管理与通知适配
    jobs/                  队列、定时任务生命周期
    logging/               操作日志与异步请求上下文
    time/                  时间事实
  paths.js                 数据、上传、客户端产物的统一路径

config/feature-manifest.json 实验入口开关，前后端共同使用
scripts/                    开发、检查、维护及素材工具
archive/server-tools/       历史脚本与旧实现，不参与运行和发布

desktop/                    Electron 主进程，与网页桌面分开
tools/chatpulse-memory-mcp/  独立 MCP 工具包
tools/qdrant/               外部向量服务运行文件
tests/e2e/                  临时后端 + Vite + 无头浏览器的整应用回归
```

正式业务不再放在 plugins 或根目录的大型 db/engine/memory 文件中。server/features/registry.js 明确列出需初始化的功能，并保持原启动顺序；初始化失败会使就绪检查失败，防止缺少某个功能仍启动成功。

## 功能内部与跨功能调用

复杂功能分为 http/（请求操作）、runtime/ 或 services/（流程）、repository.js（数据操作）、schema.js 与 migrations/（表及升级）；已有的 city routes/services、住房和定时任务的 db.js 保留其合理分层。功能不同不要求机械地拥有相同文件。

后端工厂通过显式依赖组合连接数据库、引擎和其他功能；延迟 getter 保留旧代码中的初始化顺序。前端 hook 接收明确命名的状态和操作，app 只组合它们。WebSocket 传输位于 shared/realtime，消息反应位于各功能 realtimeEvents.js，由 app/realtimeEvents.js 分发。

这是模块化单体。跨功能事务、角色状态、城市与住房的上下文组合依然通过原服务和用户数据库门面协作；目录拆分不等于运行时或数据的完全隔离。platform/db/userDatabase.js 是组合和兼容入口，各功能拥有具体 SQL。不要再向这个入口添加新业务 SQL。

## 数据兼容

29 个原基础表的定义按功能拆开，schemaRegistry 按原顺序组合执行。历史升级按原顺序调用各功能 migrations/legacy.js，回复版本的初始化仍在基础消息表之后执行；城市、住房、定时任务等原有建表逻辑仍由本功能管理。

没有改表名、数据目录或持久化格式。已经用拆分前的代码对比新建数据库结构，并验证旧库升级后保留角色数据及恢复缺少的兼容列。不要通过移动生产数据库文件来配合新的源码目录。

## 实验与独立工具

[实验说明](features/experiments.md) 记录了开关和边界。当前仍只有一个 Vite 主前端，MCP 实验室和场景工具是其中的独立入口；tools/chatpulse-memory-mcp 是独立 Node 工具包。release 目录中的前端文件是生成产物，不是另一套应继续维护的源代码。

## 检查与维护

```sh
npm run check:architecture
npm run test:server
npm run test:e2e
npm run build:client
npm run docs:routes
```

使用与 better-sqlite3 编译版本兼容的 Node；本仓库在 Windows 上提供 .runtime/node20/node.exe。测试不需要真实模型账号，E2E 自动启动隐藏的临时后端和 Vite，并在结束时关闭它们。首次运行需安装依赖和 Playwright Chromium。

结构检查验证相对模块引用、后端未定义标识符、共享层依赖、重复接口和入口职责。API 文档从注册代码生成。整应用回归覆盖各桌面入口、实验关闭后的入口、私聊消息与回复版本的关键交互。

全量前端 lint 已于 2026-09-17 清理并通过，现有组件中仍有体积较大的界面文件；功能归属已明确。这次验收不代表已完成真实模型供应商、Qdrant、Electron 安装包或多人线上环境的验证。具体故障定位见 [运行手册](runbooks/feature-debugging.md)。
