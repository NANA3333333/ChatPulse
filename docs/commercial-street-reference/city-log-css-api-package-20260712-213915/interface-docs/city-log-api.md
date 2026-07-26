# 商业街日志接口说明

本文档只列出 `client/src/plugins/city/CityLog.jsx` 直接使用的接口，以及它们在日志页面里的用途。

前端调用时通常写成 `${apiUrl}/city/...`；后端完整路径是 `/api/city/...`。
这些接口都需要登录鉴权。

## 前端调用位置

文件：`client/src/plugins/city/CityLog.jsx`

主要调用点：

- 初始化日志页数据：同时请求日志、公告、事件、角色状态。
- 日志条目操作：重试任务评分、重 roll 折叠/失败日志文案。

## 接口清单

| 方法 | 接口 | 日志页用途 | 参数/Body | 返回 |
|---|---|---|---|---|
| `GET` | `/api/city/logs?limit=all` | 读取商业街日志主列表。日志页用它渲染按日期分组的行动记录。 | Query: `limit`。日志页使用 `all` 读取全部。 | `{ success: true, logs: [...] }` |
| `GET` | `/api/city/announcements?limit=50` | 读取商业街公告、市长广播、公共公告、中介广告等侧栏信息。 | Query: `limit`，日志页使用 `50`。 | `{ success: true, announcements: [...] }` |
| `GET` | `/api/city/events` | 读取当前生效的商业街事件，用于日志页概览/活动状态。 | 可选 Query: `all=1`，日志页默认不传，只取活动事件。 | `{ success: true, events: [...] }` |
| `GET` | `/api/city/characters` | 读取商业街角色状态，用于人口/角色状态面板。包含位置、体力、钱包、情绪、背包等。 | 无 | `{ success: true, characters: [...] }` |
| `POST` | `/api/city/logs/:id/retry-quest-score` | 对任务评分失败的日志条目重试市长/任务评分。 | Param: `id` 是日志 ID。Body 通常为空。 | `{ success: true, review: {...} }` |
| `POST` | `/api/city/logs/:id/reroll` | 对折叠、失败或允许强制处理的日志重新生成展示文案。日志页用于“重 roll”按钮。 | Param: `id` 是日志 ID。Body: `{ force?: boolean, messageId?: number }`。 | `{ success: true, log: {...} }` |

## 后端定义位置

| 接口 | 文件 |
|---|---|
| `GET /api/city/logs` | `server/plugins/city/routes/coreRoutes.js` |
| `POST /api/city/logs/:id/reroll` | `server/plugins/city/routes/coreRoutes.js` |
| `GET /api/city/announcements` | `server/plugins/city/routes/coreRoutes.js` |
| `GET /api/city/characters` | `server/plugins/city/routes/coreRoutes.js` |
| `GET /api/city/events` | `server/plugins/city/routes/eventQuestRoutes.js` |
| `POST /api/city/logs/:id/retry-quest-score` | `server/plugins/city/routes/eventQuestRoutes.js` |

## 每个接口更详细说明

### GET /api/city/logs?limit=all

用途：商业街日志主数据源。

日志页会把返回的 `logs` 按日期分组，然后渲染到 `.city-log-activity-panel` 内。每条日志通常包含角色、地点、内容、时间、动作类型、任务评分结果等信息。

常见返回字段包括：

- `id`：日志 ID。
- `character_id`：角色 ID，系统日志可能是 `system`。
- `char_name`：角色名。
- `char_avatar`：角色头像。
- `action_type`：行动类型。
- `content`：日志正文。
- `location`：地点。
- `created_at`：创建时间。
- `quest_review`：任务评分记录，存在时用于展示任务评分/失败重试。

### GET /api/city/announcements?limit=50

用途：日志页公告栏数据源。

它提供天气/公告/市长广播/中介广告等公共信息，渲染到公告相关面板中。

常见返回字段包括：

- `id`：公告 ID。
- `source` 或 `character_id`：来源。
- `title`：公告标题。
- `content`：公告正文。
- `location`：相关地点。
- `created_at`：创建时间。

### GET /api/city/events

用途：读取当前商业街正在生效的事件。

日志页用它判断当前城市是否有活动事件，并在概览区域或事件区域显示。默认只返回 active events；如果传 `all=1`，后端会返回全部事件。

常见返回字段包括：

- `id`：事件 ID。
- `title`：事件标题。
- `description`：事件说明。
- `location` / `target_district`：相关地点。
- `is_active`：是否启用。

### GET /api/city/characters

用途：读取角色在商业街世界线中的状态。

日志页的人口/角色状态面板使用这些数据展示角色的体力、位置、钱包、情绪、是否启用调度等信息。

常见返回字段包括：

- `id`：角色 ID。
- `name`：角色名。
- `avatar`：头像。
- `calories`：体力/卡路里。
- `city_status`：城市状态。
- `location`：当前位置。
- `wallet`：钱包。
- `energy`、`mood`、`stress`、`health`、`satiety`：状态指标。
- `emotion_state`、`emotion_label`、`emotion_emoji`、`emotion_color`：派生情绪。
- `inventory`：背包。

### POST /api/city/logs/:id/retry-quest-score

用途：当某条日志的任务评分失败时，日志页提供按钮重新评分。

后端会根据日志、角色、任务、任务领取记录和地点重新调用市长评分逻辑。只有评分状态是 `error` 的记录才允许重试。

错误情况：

- 日志 ID 无效。
- 这条日志没有任务评分记录。
- 评分记录不是失败状态。
- 行动日志、角色、任务或任务领取记录不存在。

### POST /api/city/logs/:id/reroll

用途：重写折叠/失败的商业街行动文案。

后端会重新调用行动叙事生成逻辑，更新 `city_logs.content`，并尝试同步更新对应的聊天消息内容。系统日志不能重 roll；普通日志默认只有折叠/失败内容需要重 roll，Body 里传 `force` 可以强制。

Body 字段：

```json
{
  "force": true,
  "messageId": 123
}
```

- `force`：允许对非折叠日志强制重 roll。
- `messageId`：如果知道对应聊天消息 ID，就定向同步更新那条消息。

返回的 `log` 是更新后的日志记录。
