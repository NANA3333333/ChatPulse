# 网页桌面与窗口

网页桌面属于应用外壳。ChatPulseDesktop.jsx 负责桌面图标、文件操作和窗口组合；Electron 宿主在 desktop/main.cjs，两者不要混淆。

| 问题 | 定位文件（client/src/desktop/） |
| --- | --- |
| 图片窗口 | windows/DesktopAlbumWindow.jsx；截图和照片格式由 desktopPhoto.js 提供 |
| 文件夹、文件夹内应用 | windows/DesktopFolderWindow.jsx |
| 回收站浏览与还原界面 | windows/DesktopRecycleBinWindow.jsx、recycleBinFormatting.js |
| 文本文档编辑与保存界面 | windows/DesktopTextDocumentWindow.jsx、textDocumentStats.js |
| 上述辅助窗口的打开、置顶、最小化、最大化 | useDesktopAuxiliaryWindows.js、windowGeometry.js |
| 桌面右键菜单 | components/DesktopContextMenu.jsx |
| 桌面文件增删、剪贴板、图标拖放 | ChatPulseDesktop.jsx；存储与标准化在 desktopUtils.js |
| 正式业务应用窗口 | useWindowState.js、useWindowNavigation.js、useWindowInteractions.js、useWindowRenderer.jsx |

无头回归位于 tests/e2e/remainingComponents.cjs，通过主应用实际打开桌面窗口。文件内容写入临时浏览器上下文，不操作用户本机真实文件。
