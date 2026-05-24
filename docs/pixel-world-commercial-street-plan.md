# 商业街地图与租房系统联动策划

目标：商业街保持轻量，不做玩家手操寻路，角色移动以自动播放动画为主。地图承担“角色现在在哪里、要去哪里、为什么去”的可视化表达；主要玩法仍然落在住房/中介/房租系统。

## 1. 核心原则

- 商业街只做一张固定小地图，当前规格沿用 `26 x 17` 网格。
- 角色不需要真实碰撞物理，只需要看起来沿着可走路面移动。
- 后端城市系统继续负责真实状态：`character.location`、`city_status`、城市日志、中介广告、房租结算。
- 前端像素地图只根据状态生成动画：从上一个锚点走到下一个锚点，停留，冒泡提示，再循环。
- 所有素材先进入“摆放清单”，每个素材必须声明占地、碰撞盒、排序锚点和交互锚点。

## 2. 地图区层

从下到上固定分 5 层：

1. `ground`：地面 tile，铺满地图。可走/不可走由 tile 类型决定。
2. `zone`：逻辑区域，不一定可见，例如中介所门口、咖啡座、便利店门口、看房集合点。
3. `staticObject`：建筑、树、路灯、围栏、摊位等不会移动的素材。
4. `character`：角色自动播放移动和待机动画。
5. `label/effect`：气泡、广告牌文字、租房提示、事件标记。

CSS 的 `z-index` 可以按 `sortY` 排：同层对象的 `z-index = floor((y + h) * 10)`，越靠下越盖住上面，避免角色穿过建筑时层级怪。

## 3. 商业街建议布局

当前商业街可以保持简单，建议只承认这些功能点：

| id | 名称 | 地图点 | 用途 |
| --- | --- | --- | --- |
| `agency` | 中介所 | `x: 4.5, y: 6.2` | 中介广告、看房集合、租约提醒 |
| `convenience` | 便利店 | `x: 13.0, y: 6.5` | 低预算角色高频出现，房租压力大时更常去 |
| `cafe` | 咖啡馆 | `x: 21.0, y: 7.0` | 体面/社交/约见 |
| `street_crossing` | 人行道 | `x: 7.0, y: 8.5` | 通用路过点 |
| `notice_board` | 广告牌 | `x: 9.5, y: 9.0` | 展示最新中介广告 |
| `bus_stop` | 入口/公交点 | `x: 1.5, y: 13.0` | 角色从其他区域进入商业街 |
| `home_exit` | 回家出口 | `x: 12.5, y: 14.0` | 去居住房间或离开商业街 |

建筑只放地图上半部，主通行线放 `y=8..10`，底部保留水边/木栈道作为装饰，不承担角色主移动。

## 4. 素材摆放规则

每个素材登记为：

```js
{
  id: 'building_pink_shop',
  kind: 'building',
  asset: 'game-ready/building_pink_shop.png',
  x: 0.7,
  y: 0.15,
  w: 7,
  h: 6,
  solid: [{ x: 0.3, y: 0.4, w: 6.4, h: 5.4 }],
  feet: { x: 3.5, y: 6.05 },
  anchor: { x: 4.5, y: 6.2 },
  tags: ['agency', 'housing']
}
```

规则：

- `x/y/w/h` 是视觉盒，用于绘制。
- `solid` 是碰撞盒，禁止角色路线穿过；建筑/树/摊位必须有，地面装饰可以没有。
- `feet` 是排序脚点，用于决定遮挡关系。
- `anchor` 是角色交互点，必须落在可走格子上。
- 同类大素材不能重叠视觉盒；小道具允许视觉轻微贴边，但 `solid` 不能重叠。
- 角色主路宽度至少保留 2 格，所有 `anchor` 到主路必须有一条可走线。
- 建筑门口前方至少保留 `2 x 1` 空地，给角色站立和气泡显示。
- `notice_board`、中介招牌、广告牌不能挡住角色主路。

## 5. 碰撞与校验

前端可以加一个开发期校验函数：

- 检查所有 `solid` 是否越界。
- 检查所有 `solid` 之间是否重叠。
- 检查所有 `anchor` 是否在可走 tile 上。
- 检查每个 `anchor` 是否能通过简单 BFS 到达 `bus_stop`。
- 检查角色初始点是否不在 `solid` 内。

生产环境可以只 `console.warn`，开发环境直接在侧栏列出问题。这样素材替换时不靠肉眼猜。

## 6. 角色移动逻辑

商业街角色动画采用“意图到路线”的状态机：

```txt
idle -> chooseIntent -> walking -> dwell -> idle
```

数据来源按优先级：

1. `character.location`：后端真实地点。
2. 最新 `city_update` websocket：即时触发角色换目标。
3. 最新城市日志/中介广告：生成气泡文本。
4. 租房绑定：判断角色住房压力和中介所兴趣。

映射规则：

| 后端 location/status | 地图目标 |
| --- | --- |
| `street` / `wander` | `street_crossing`、`notice_board` 随机 |
| `convenience` | `convenience.anchor` |
| `restaurant` | 后续餐厅素材，没有时映射到 `cafe` |
| `mall` | `notice_board` 或商业街右侧入口 |
| `home` | 居住房间 scene，或商业街 `home_exit` |
| `overdue` / `unstable` | 提高去 `agency` 权重 |
| 有中介广告刷新 | 附近角色短暂停在 `notice_board` |

路线不用复杂寻路，第一版只维护手写路线：

```js
routes: {
  bus_stop_to_agency: ['bus_stop', 'street_crossing', 'agency'],
  bus_stop_to_convenience: ['bus_stop', 'street_crossing', 'convenience'],
  agency_to_home_exit: ['agency', 'street_crossing', 'home_exit']
}
```

动画按 waypoint 插值，不要每格走。商业街是自动播放，看起来连贯即可。

## 7. 租房系统联动

租房系统是主线，地图只做可视化反馈：

- 中介广告发布后：`notice_board` 出现最新标题，`agency` 门口出现小气泡。
- 角色房租拖欠：角色在商业街时更容易移动到 `agency`，气泡显示“问问有没有便宜房”。
- 角色绑定新住房：从 `agency` 走到 `home_exit`，再切到 `room` scene。
- 手动交房租成功：角色在 `home_exit` 或房间内出现“租约稳了一周”。
- 新增/编辑房源：不直接改地图，只更新中介广告和可推荐清单。

建议新增一个轻量前端适配器：

```js
function buildStreetAgents(characters, housingBindings, latestAgencyAd) {
  return characters
    .filter((char) => shouldRenderOnStreet(char))
    .map((char, index) => ({
      id: char.id,
      name: char.name,
      target: resolveStreetTarget(char, housingBindings[char.id], latestAgencyAd),
      route: resolveRoute(char.location, target),
      status: resolveBubble(char, housingBindings[char.id], latestAgencyAd),
      lane: index % 3
    }));
}
```

## 8. 第一版实现范围

第一版不做地图编辑器，只做“规则化配置 + 自动校验 + 自动动画”：

- 把商业街 `props` 拆成 `commercialStreetLayout` 常量。
- 给每个建筑/道具补 `solid`、`anchor`、`tags`。
- 从 `/api/city/characters` 拉角色位置。
- 从 `/api/social-housing/bootstrap` 取角色住房绑定和最新中介广告。
- street scene 根据数据生成 `agents`，保留现有 CSS chibi 风格。
- 新增校验函数，开发期在侧栏展示素材重叠/锚点不可达。

## 9. 后续扩展

- 素材齐后再加“中介所室内”小场景，而不是把所有租房操作塞进街上。
- 房子预览仍在居住房间 scene 或住房面板，不在商业街直接展示完整室内。
- 如果以后要手动点角色，可以把 `anchor` 变成点击热区，但第一版只做自动播放。
