# 设置页（settings）

设置页负责组合配置入口，角色、账号、备份等数据仍由各自后端功能管理。

## 从现象找文件

| 现象或修改目标 | 界面 | 状态、请求与恢复逻辑 |
| --- | --- | --- |
| 角色人设、头像、提示词 | [CharacterPersonaSettings](../../client/src/features/settings/components/CharacterPersonaSettings.jsx) | [useCharacterConfiguration](../../client/src/features/settings/useCharacterConfiguration.js) |
| 主模型、记忆模型与上下文参数 | [CharacterModelSettings](../../client/src/features/settings/components/CharacterModelSettings.jsx) | [useSettingsModels](../../client/src/features/settings/useSettingsModels.js) 拉取模型；useCharacterConfiguration 保存草稿 |
| 角色主动行为 | [CharacterBehaviorSettings](../../client/src/features/settings/components/CharacterBehaviorSettings.jsx) | useCharacterConfiguration |
| 音色与试听 | [CharacterVoiceSettings](../../client/src/features/settings/components/CharacterVoiceSettings.jsx) | useSettingsModels、[ttsProviders](../../client/src/features/settings/ttsProviders.js) |
| 单个角色导入、导出、删除 | [CharacterDataSettings](../../client/src/features/settings/components/CharacterDataSettings.jsx) | useCharacterConfiguration |
| 个人资料、账号修改 | [ProfileSettings](../../client/src/features/settings/components/ProfileSettings.jsx)、[AccountSecuritySettings](../../client/src/features/settings/components/AccountSecuritySettings.jsx) | [useSettingsProfile](../../client/src/features/settings/useSettingsProfile.js) |
| 登录设备与撤销会话 | [SessionSettings](../../client/src/features/settings/components/SessionSettings.jsx) | [useSettingsSessions](../../client/src/features/settings/useSettingsSessions.js) |
| 整库导入、导出、清空 | [BackupSettings](../../client/src/features/settings/components/BackupSettings.jsx)、[WipeDataDialog](../../client/src/features/settings/components/WipeDataDialog.jsx) | [useSettingsBackup](../../client/src/features/settings/useSettingsBackup.js) |
| 就绪状态、服务诊断与右栏 | [SettingsContext](../../client/src/features/settings/components/SettingsContext.jsx) | [SettingsPanel](../../client/src/features/settings/components/SettingsPanel.jsx) 组合当前角色、诊断和页面导航 |

## 修改约定

页面组件接收明确的状态和回调。角色的草稿与保存锁放在 useCharacterConfiguration；切换人格、模型、行为、声音和数据页时共享同一份草稿。个人资料的保存锁和保存期间新增输入保护由 useSettingsProfile 管理。

新增配置时，先放入对应分区及其请求逻辑，再在 SettingsPanel 接入。不要复制一套隐藏编辑表单。已无法从导航进入的旧角色弹窗、旧模型总览和旧设置总览已经移除。

回归入口：`tests/e2e/componentSections.cjs` 检查分区切换和取消清空；`tests/e2e/coreFlows.cjs` 检查资料保存失败与重试；私聊 `contextWindow.e2e.cjs` 检查设置保存及刷新后的上下文参数。
