# 历史代码

`server-tools/` 保存旧数据库草稿、一次性诊断/修改脚本和过去的代码迁移脚本，来自原 `server/_archive_tools` 及 `server/refactor_all.js`。这些文件不是可运行的维护工具；旧路径与数据假设保留作历史参考。主服务、客户端构建和桌面发布不会加载它们。

当前维护入口在 `scripts/`；实际数据库升级在功能目录的 `schema.js`、`migrations/` 及数据库装配入口。不要把这里的 wipe/alter/refactor 脚本用于当前数据。
