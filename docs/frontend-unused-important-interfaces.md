# 后端已有但前端未充分使用的重要接口（当前状态）

更新时间：2026-07-11

本文档只记录“值得前端知道”的接口缺口。完整交接见 `docs/frontend-confirmed-plan1-handoff-20260711.md`。

## 已从缺失表补齐的接口

这些接口原本属于“后端已有但确定方案示例没有真正接上”的重点，本次已经补进真实前端：

| 模块 | 接口 | 当前前端入口 |
| --- | --- | --- |
| MCP 实验室 | `GET /api/mcp-lab/context/:characterId` | `McpLabPanel.jsx` 右侧 Inspector 的“上下文”页签 |
| 住房系统 | `POST /api/social-housing/classes` | `HousingSocialPanel.jsx` 的“阶层与租客画像”保存 |
| 住房系统 | `DELETE /api/social-housing/classes/:id` | “阶层与租客画像”删除 |
| 住房系统 | `GET /api/wallet/:id` | 交租、推荐住房、直接指派住房前刷新角色钱包 |
| 商业街日志 | `GET /api/city/inventory/:charId` | `CityLog.jsx` 居民雷达背包懒加载 |
| 商业街管理 | `POST /api/city/give-item` 返回的 `inventory` | `CityManager.jsx` 送礼成功后派发局部背包刷新事件 |
| 记忆库 | `POST /api/memory-import/external/preview` 等外部导入接口 | “导入记忆”：GPT / Gemini / SillyTavern 总结预览 |
| 设置中心 | `GET /api/system/embedding-status` | 右侧 Service diagnostics |
| 设置中心 | `GET /api/system/background-queue` | 右侧 Service diagnostics |
| 设置中心 | `GET /api/characters/:id/cache-stats` | 右侧 Service diagnostics 的角色缓存 |
| 登录态 | `GET /api/auth/me` | `AuthContext.jsx` 启动校验 token |

## 仍未作为新页面重点接入的可选接口

### 1. MCP 旧 Serper 兼容接口

#### `GET /api/mcp-lab/serper-config`

- 当前状态：未直接使用。
- 原因：新版 MCP 前端已经使用 `/api/mcp-lab/web-config` 管多供应商搜索源，`serper-config` 只是旧兼容接口。
- 请求参数：无。
- 返回数据：`success`、`has_key`、`source`、`masked`。
- 异常情况：401 未登录；500 读取失败。
- 建议：不要在新 UI 主流程里新增入口，除非要做“旧 Serper 配置迁移提示”。

#### `PUT /api/mcp-lab/serper-config`

- 当前状态：未直接使用。
- 请求参数：`serper_api_key`。
- 返回数据：同 GET。
- 异常情况：401 未登录；500 保存失败。
- 背后逻辑：写入旧字段并同步到统一 web search keys 的 `serper` 项。
- 建议：继续使用 `/api/mcp-lab/web-config`。

### 2. 商业街角色日程接口

#### `GET /api/city/schedule/:charId`

- 当前状态：商业街日志页未做单独日程弹层。
- 请求参数：路径参数 `charId`。
- 返回数据：`success`、`schedule`。
- 异常情况：401 未登录；500 日程读取失败。
- 背后逻辑：读取该角色今日 schedule JSON。
- 可做功能：居民雷达里加“今日日程”折叠区，点开时懒加载。

#### `GET /api/city/schedules/:charId`

- 当前状态：未作为商业街日志主界面功能。
- 请求参数：路径参数 `charId`。
- 返回数据：角色更多日程信息，具体结构以后端返回为准。
- 可做功能：城市管理抽屉里的角色日程编辑/查看。

#### `POST /api/city/schedules/:charId/generate`

- 当前状态：未作为本次确定方案重点。
- 请求参数：路径参数 `charId`，body 以后端生成功能为准。
- 可做功能：为角色生成今日/近期日程。建议放在城市管理抽屉，不要放在日志首屏。

### 3. 记忆库原生高级接口

这些接口后端存在，但当前前端不做入口，因为它们和现有“导入记忆 / 小模型总结 / 记忆维护”功能重叠，容易让用户误解：

- `GET /api/memories/:characterId/export`
- `POST /api/memories/:characterId/import`
- `POST /api/memories/:characterId/extract`
- `GET /api/memories/:characterId/maintenance/stats`
- `POST /api/memories/:characterId/maintenance/apply`

当前保留的导入主流程是：

- 配置记忆库管理小模型。
- 使用“导入记忆”上传或粘贴 GPT / Gemini / SillyTavern 聊天记录。
- 小模型生成总结预览。
- 勾选识别出的角色。
- 创建/复用角色并写入新版记忆库。

当前不再展示的重复前端区块：

- 记忆维护页里的遗忘曲线展开列表。
- 旧库/新版记忆分类条目列表。
- 新版来源场景分类条目列表。
- 新版语义分类条目列表。
- 维护页左侧的正式记忆、卡片调用、待迁移卡片、遗忘曲线统计卡。
- 维护页左侧的记忆引擎状态卡。
- 维护页左侧栏本身，包括角色列表和新旧库切换。

这些不是接口缺失，而是和已有浏览/管理页面重复，当前布局只保留导入与整理工作流。

## 不再算缺口的接口

以下接口虽然以前在缺失表中出现过，但现在已有前端入口，不要重复做第二套入口：

- MCP context inspector。
- 住房阶层 CRUD。
- 城市背包懒加载。
- 外部聊天导入、小模型总结预览、创建角色并写入新版记忆库。
- 设置 embedding/background/cache diagnostics。
- Auth startup `/api/auth/me` 校验。

## 交接提醒

- 如果继续找别的 AI 写前端，请让它基于现有 `client/src` 改，不要用静态 preview 覆盖真实组件。
- 如果它说“没有接口”，优先查 `docs/frontend-confirmed-plan1-handoff-20260711.md` 的接口表。
- 如果它要新增视觉风格，必须保留上表“已补齐接口”的真实调用。
