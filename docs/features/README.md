# 功能导航

当前业务已经按功能归入 `features/`。先按下表找到功能，再查看 [API 对应表](api-map.md) 定位具体接口文件。应用入口只组合模块，正式功能由后端注册表显式加载。

| 功能 | 前端位置（client/src） | 后端位置（server/features） | 数据 |
| --- | --- | --- | --- |
| [设置页与配置分区](./settings.md) | features/settings/：components/ 按页面分区；useCharacterConfiguration、useSettingsProfile、useSettingsModels、useSettingsSessions、useSettingsBackup | 组合角色、账号、语音和备份接口 | 不新增数据表 |
| [账号与个人资料](./account.md) | features/account/：AuthContext.jsx、components/Login.jsx | account/：authRepository.js、profileRepository.js | 主账号库及 user_profile |
| [角色](./characters.md) | features/characters/：components/ContactList.jsx、useContacts.js、useCharacterCreation.js | characters/：repository.js、emotionRepository.js、deleteCharacter.js | characters、emotion_logs |
| [私聊](./private-chat.md) | features/private-chat/：index.js、useMessageActions.js、useIncomingMessages.js | private-chat/：runtime.js、messageService.js、replyVersionService.js、context/ | messages、reply_dispatch_logs、private_reply_* |
| [群聊](./group-chat.md) | features/group-chat/：components/GroupChatWindow.jsx、useGroupActions.jsx | group-chat/：index.js、runtime/、proactive.js、repository.js | group_chats、group_members、group_messages |
| [记忆](./memory.md) | features/memory/：components/MemoryLibraryPanel.jsx、components/MemoTable.jsx | memory/：index.js、operations/、maintenance/、import/、sources.js | memories、external_memory_*；向量索引调用 platform/vectors |
| [共享上下文](./conversation-context.md) | 由私聊、群聊与城市界面间接使用 | conversation-context/：index.js、context/、cacheRepository.js | prompt_block_cache、history_window_cache、conversation_digest_cache |
| [会话搜索](./conversation-search.md) | features/conversation-search/：components/ConversationSearchPanel.jsx、useSearchNavigation.js | conversation-search/：http/、repository.js | 读取私聊及群聊消息表 |
| [城市](./city.md) | features/city/：components/CityLog.jsx、components/CityManager.jsx、scene/ | city/：index.js、routes/、services/、runtime/ | cityDb.js 管理城市表；schema.js 管理行为树状态表 |
| [住房](./housing.md) | features/housing/：components/HousingSocialPanel.jsx | housing/：index.js、rentalChainService.js、housingEffects.js、runtime/ | db.js 管理住房表 |
| [经济](./economy.md) | features/economy/：components/TransferModal.jsx、realtimeEvents.js | economy/：index.js、http/、repository.js | private_transfers、group_red_packets、group_red_packet_claims |
| [关系](./relationships.md) | features/relationships/：components/RecommendModal.jsx | relationships/：index.js、repository.js、jealousy.js、impressionService.js | character_friends、char_relationships、char_impression_history |
| [日记](./diaries.md) | features/diaries/：components/DiaryTable.jsx、components/PrivateChatJournalPanel.jsx | diaries/：http/、repository.js、cleanupRepository.js | diaries |
| [定时任务](./scheduler.md) | features/scheduler/：components/Scheduler.jsx | scheduler/：index.js、http/、runtime/tick1.js | db.js 管理定时任务表 |
| [备份与迁移](./backup.md) | 通过 settings/components/SettingsPanel.jsx 进入 | backup/：index.js、http/、characterArchive.js、exportRepository.js | 调用数据拥有方；不另建聊天库 |
| [管理](./admin.md) | features/admin/：components/AdminDashboard.jsx；当前常规设置页未直接引用该面板 | admin/：index.js、http/、runtime/callbacks.js | 使用 account/authRepository.js 与系统运行状态 |
| [联网工具](./web-tools.md) | 实验界面位于 labs/mcp/ | web-tools/：index.js、services/、db.js | db.js 管理工具配置、资料与任务表 |
| [媒体](./media.md) | shared/media/ 中的通用展示 | media/：http/、uploadPaths.js、uploadsValidation.js | 使用 server/paths.js 提供的上传目录 |
| [语音](./speech.md) | features/speech/：realtimeEvents.js；私聊组件中的播放入口 | speech/：service.js、http/、repository.js | message_tts；音频路径由 server/paths.js 提供 |
| [诊断数据](./diagnostics.md) | 在角色/管理界面中展示 | diagnostics/：modelLogsRepository.js、tokenRepository.js、retentionRepository.js | llm_debug_logs、token_usage |

前端另外包含 `features/settings/`（配置页面的组合）、`features/notifications/`（通知）、`features/conversation-ui/`（私聊/群聊共享消息展示）。通用展示和协议工具放在 `shared/`，网页桌面窗口放在 `desktop/`。

- [私聊完整链路](private-chat.md)
- [实验功能与独立工具](experiments.md)
- [网页桌面与窗口](desktop.md)
- [前端入口与历史调试工具清单](../frontend-entry-inventory-2026-09-22.md)
- [实际架构](../ARCHITECTURE.md)
- [故障定位](../runbooks/feature-debugging.md)

- [本轮验证记录](../structure-validation.md)

