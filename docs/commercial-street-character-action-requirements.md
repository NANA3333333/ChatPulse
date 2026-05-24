# 商业街人物动作绘画需求

## 项目背景

商业街现在不是旧版 `26 x 17` 小网格地图，而是横向长条舞台。画布按段扩展，每段 `2048 px` 宽，当前背景是米白纯色，素材自由摆放；滑到最右侧会直接接回最左侧，前端使用三段预览表现首尾相连。

人物素材要能绑定到这套横向循环商业街里：以后角色会沿商业街横向循迹、停在建筑门口或道具锚点，也会在画布首尾交界处继续移动，不能出现跳帧、裁脚、锚点漂移。

## 当前代码规格

| 项 | 规格 |
| --- | --- |
| 当前人物目录 | `client/public/assets/pixel-world/characters/casual-boy-v1/frames-64x80/` |
| 前端读取路径 | `/assets/pixel-world/characters/{角色id}/frames-64x80/{direction}_walk_{frame}.png` |
| 单帧尺寸 | `64 x 80 px` |
| 渲染尺寸 | `64 x 80 px`，不再二次缩放 |
| 脚底锚点 | 图片内坐标 `x=32, y=72`，底部保留 `8 px` 透明安全区 |
| 舞台坐标 | `player.x` 是脚底中心 X，`player.y` 是脚底锚点 Y |
| 移动速度 | 约 `150 px/s` |
| 行走帧率 | 约 `8 fps` |
| 方向 | `front`、`back`、`left`、`right` |
| 帧名 | `idle`、`step_a`、`passing`、`step_b` |

## P0 必交内容

交付一个完整可接入角色包，先按 `casual-boy-v2` 或实际角色名建目录：

```txt
client/public/assets/pixel-world/characters/{角色id}/frames-64x80/
  front_walk_idle.png
  front_walk_step_a.png
  front_walk_passing.png
  front_walk_step_b.png
  back_walk_idle.png
  back_walk_step_a.png
  back_walk_passing.png
  back_walk_step_b.png
  left_walk_idle.png
  left_walk_step_a.png
  left_walk_passing.png
  left_walk_step_b.png
  right_walk_idle.png
  right_walk_step_a.png
  right_walk_passing.png
  right_walk_step_b.png
```

每张图必须是透明 PNG，画布尺寸严格 `64 x 80 px`，不要自动裁切成不同大小。

## 动作要求

| 动作 | 说明 |
| --- | --- |
| `idle` | 静止站姿。四方向都要有，停下时会显示这一帧。 |
| `step_a` | 左脚或第一步迈出。 |
| `passing` | 身体回到中间经过姿态，适合循环过渡。 |
| `step_b` | 右脚或第二步迈出。 |

循环顺序固定为：

```txt
idle -> step_a -> passing -> step_b -> idle
```

左右方向可以镜像，但如果服装有斜挎包、发饰、袖章等不对称细节，建议单独修正右方向，避免镜像后细节反了。

## 画面风格

- 像素风，和商业街建筑、路面、树、摊位保持同一世界观。
- 人物要比街道道具更清晰，轮廓可略深，但不要厚黑边。
- 颜色不要过暗，放在米白背景和蓝天素材上都要看清。
- 不要自带投影、地面圈、白边、背景色块。
- 不要画超出 `64 x 80` 的飘带、大包、长发甩动；首尾相连时宽度越稳定越好。

## 锚点硬规则

人物的脚底接地点必须稳定在图片内 `x=32, y=72` 附近：

```txt
64 x 80 frame
┌────────────────┐
│                │
│     head       │
│     body       │
│     legs       │
│      feet      │  y=72: 脚底锚点线
│   transparent  │  y=72..79: 8px 安全区
└────────────────┘
       x=32
```

验收时四方向四帧叠在一起，头顶高度可以有 1-2 px 起伏，但脚底锚点不能漂。脚底漂了，角色走路时会在商业街上“蹦”。

## 循环商业街兼容

商业街横向首尾相连，所以人物以后会在这些情况下出现：

- 正常在中间画布行走。
- 接近最左边，右侧画布显示同一个人物的循环副本。
- 接近最右边，左侧画布显示同一个人物的循环副本。
- 自动循迹经过建筑、公告牌、公交站、医院、餐车等前景素材。

因此人物素材需要：

- 每帧左右边缘至少留 `2 px` 透明安全边，不要把身体贴死画布边。
- 角色主体视觉宽度建议控制在 `38-46 px` 内，别撑满 64px。
- 所有帧的身体中心保持在 `x=32`，左右走路时可以摆手，但不要整体横移。
- 头发、包、衣服边缘不要在某一帧突然多出很宽，否则过首尾交界处会闪。

## 需要附带的说明

交付时请附一个 `manifest.json` 或文本说明，至少写：

```json
{
  "id": "casual-boy-v2",
  "frameSize": { "width": 64, "height": 80 },
  "anchor": { "x": 32, "y": 72 },
  "directions": ["front", "back", "left", "right"],
  "frames": ["idle", "step_a", "passing", "step_b"],
  "recommendedFps": 8,
  "notes": "透明PNG，不带阴影，适配商业街横向循环舞台"
}
```

## P1 扩展动作

P0 走路可用后，再补这些扩展动作：

| 动作 | 文件建议 | 用途 |
| --- | --- | --- |
| 点头/说话 | `{direction}_talk_01.png`、`{direction}_talk_02.png` | 角色停在中介所、便利店、公告牌旁冒泡 |
| 惊讶 | `front_emote_surprised.png` | 收到新中介广告、房租压力事件 |
| 思考 | `front_emote_think.png` | 看公告牌、犹豫租房 |
| 坐下 | `front_sit_idle.png`、`left_sit_idle.png`、`right_sit_idle.png` | 咖啡桌、公交站、长椅 |
| 低落 | `front_emote_down.png` | 逾期、没钱、心情差 |

P1 可以不是四方向全套，但文件也必须是 `64 x 80` 透明 PNG，脚底或坐姿锚点要说明。

## 验收标准

- 所有 P0 文件齐全，文件名完全匹配。
- 每张 PNG 都是 `64 x 80`，透明背景。
- 四方向行走循环播放时没有跳脚、抖头、突然变胖变瘦。
- 缩放到 `75%` 预览时仍然清晰。
- 放在商业街 `y=178..408` 之间行走，脚底能贴住路面和人行道。
- 靠近画布左右边界时，人物副本看起来能自然接上，不出现身体被某一帧突然切掉的感觉。
