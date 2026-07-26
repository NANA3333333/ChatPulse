# 商业街日志 CSS 与接口说明

这个压缩包只包含“商业街日志”相关内容，不包含商业街地图本体、像素世界编辑器或住房系统内容。

## 包内文件

- `interface-docs/city-log-api.md`：商业街日志页面用到的接口说明。
- `css-original/CityLog.css`：商业街日志页面完整 CSS 原文。
- `css-original/desktop-city-log-related.css`：`desktop.css` 中与 `city-log` / `tab-city` 相关的 CSS 原文片段。

## 原始代码位置

- 日志页面组件：`client/src/plugins/city/CityLog.jsx`
- 日志页面 CSS：`client/src/plugins/city/CityLog.css`
- 桌面窗口相关覆盖：`client/src/styles/desktop.css`
- 日志接口后端：`server/plugins/city/routes/coreRoutes.js`
- 任务评分重试接口后端：`server/plugins/city/routes/eventQuestRoutes.js`
