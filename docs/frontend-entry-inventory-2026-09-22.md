# 前端入口与历史调试工具清单（2026-09-22）

本清单区分用户功能、实验界面、自动化测试页面、历史素材工具。检查范围包括当前源码、启动脚本、后端静态资源配置、Electron 入口、本仓库启动日志、Git 全部分支的页面和构建配置历史；不代表电脑其他目录不存在独立项目。

## 当前使用的入口

| 入口 | 位置与用途 | 当前归类 |
| --- | --- | --- |
| ChatPulse 主前端 | [client/index.html](../client/index.html) → [main.jsx](../client/src/main.jsx) | 正式前端；开发默认 5173，生产由后端提供 client/dist |
| 商业街 | [CommercialStreetPanel.jsx](../client/src/features/city/scene/CommercialStreetPanel.jsx) | 正式场景；可选实验工具通过适配入口接入 |
| 像素小屋 | [PixelCottagePanel.jsx](../client/src/features/city/scene/PixelCottagePanel.jsx) | 正式场景；家具编辑和行为调试留在 labs |
| MCP 实验室 | [McpLabPanel.jsx](../client/src/labs/mcp/McpLabPanel.jsx) | 实验界面；联网业务能力另在后端 features/web-tools |
| 住房样板间组装 | [useHousingRoomAssembly.js](../client/src/features/housing/useHousingRoomAssembly.js) | 住房中的实验操作；写入像素小屋的本地布局，不能把共用的布局算法当作无用页面删除 |
| 旧像素世界总面板 | [PixelWorldPanel.jsx](../client/src/labs/scene-editor/PixelWorldPanel.jsx) | 当前源码没有外部导入；未接入导航，保留为待归档旧入口 |
| 私聊测试页面 | client/src/features/private-chat/tests 下的 privateReplyReroll.html、privateMessages.html、contextWindow.html | 无头测试入口；不属于生产构建入口 |
| 群聊测试页面 | client/src/features/group-chat/tests/groupMessages.html | 无头测试入口；不属于生产构建入口 |
| 独立记忆 MCP | [tools/chatpulse-memory-mcp](../tools/chatpulse-memory-mcp/README.md) | 独立工具进程，没有独立网页前端 |

[feature-manifest.json](../config/feature-manifest.json) 的 scene-editor 现在只控制“场景工具”和诊断接口，关闭后商业街、小屋的玩家界面仍保留；mcp 控制 MCP 实验导航和接口。修改后需重启后端并重新构建前端。不要把这些开关理解为权限控制。分离后的排查位置见 [城市](features/city.md) 与 [实验工具](features/experiments.md)。

## Git 历史中的人物与素材工具

以下文件在提交 `83c48000`（2026-07-26，Update app surfaces and bundled assets）中存在，已由 `75d58529`（2026-07-26，Remove temporary test artifacts）删除。本轮仅检查历史，没有恢复或再次删除文件。

| 历史路径 | 页面或文件证明的用途 | 是否独立服务 |
| --- | --- | --- |
| client/public/tools/hair-dressup-review/index.html | 页面标题 RPG Dress-Up Studio，界面“换装试衣间”；自带 app.js、styles.css | 独立静态页面，曾通过 `/tools/hair-dressup-review/` 访问；未发现独立端口启动器 |
| client/public/tools/action-sheet-manual-crop/index.html | “动作表手动审核”，人物动作图裁剪 | 同上，通过主前端静态目录发布 |
| client/public/tools/original-front-reference/index.html | “原版正视图参考”，人物素材核对 | 同上 |
| client/public/tools/large-image-manual-crop/index.html | “大图红线裁剪”，带临时素材和参考图 | 同上 |
| docs/character-prototypes/two-head-4-4/ | README 明确为两头身人物的 3D blockout；make_model.py 生成 OBJ、MTL 和比例数据 | 3D 人物原型文件，没有网页入口或前端服务器 |

这些记录与“以前做过人物编辑和 3D 实验”的记忆相符，但目前没有证据证明它们就是用户提到的“3D 小屋”。不能仅按相近名称认定是同一项目。可用 `git show 83c48000:历史路径` 阅读旧文本；需要继续开发时再恢复到专门的 tools 或 labs 目录，避免把临时审核页重新放进 public 自动发布。

## 端口和后端去向

| 地址或配置 | 实际作用 |
| --- | --- |
| 5173 | Vite 主前端；client/vite-editor.out.log 中所谓 editor 服务也使用此端口，更新的是旧 PixelWorldPanel，并非第二个项目 |
| 8000 | 默认后端；[vite.config.js](../client/vite.config.js) 只把 /api、/uploads、/ws 代理至它 |
| 5178、5181 | 私聊自动化测试使用过的 Vite 端口；当前整套 E2E 使用临时空闲端口 |
| 6333 | Qdrant 向量服务，不是小屋或人物编辑器 |
| 11434 | Ollama 本地模型默认地址，不是项目附加前端 |
| 8080/v1 | server/out.txt 中的旧测试模型地址，不是独立页面入口 |
| 3000 | 历史模型错误响应中的上游代理连接失败地址；日志没有指向本项目独立前端的启动记录 |
| Electron 的动态本地端口 | [desktop/main.cjs](../desktop/main.cjs) 用 getFreePort 启动同一个后端，再打开同一份 client/dist；地址不同不代表另一套前端 |
| CHATPULSE_CLIENT_DIST_DIR | [server/paths.js](../server/paths.js) 允许覆盖前端构建目录；默认 client/dist。Electron 明确传入该目录；本次未在当前进程环境或 server/.env 中发现其他前端目录覆盖 |

后端 [app.js](../server/app.js) 只有一套前端静态目录和 index.html 回退；另有上传文件、语音媒体接口。当前源码未发现将小屋/人物编辑器重定向或代理到另一个前端地址的配置。release、release-external-ui-final 中的客户端属于旧打包产物，不作为另一套在维护的源码入口。
