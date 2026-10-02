import { useCallback } from 'react';

export function useDrawers(dependencies) {
const { ChatSettingsDrawer, DiaryTable, GroupManageDrawer, MemoTable, clearConversationJumpTarget, setActiveDrawer } = dependencies;
const preloadChatDrawer = useCallback((drawer) => {
    if (drawer === 'memo') MemoTable.preload?.();
    if (drawer === 'diary') DiaryTable.preload?.();
    if (drawer === 'settings') ChatSettingsDrawer.preload?.();
    if (drawer === 'group-manage') GroupManageDrawer.preload?.();
  }, [ChatSettingsDrawer, DiaryTable, GroupManageDrawer, MemoTable]);

const toggleChatDrawer = useCallback((drawer) => {
    preloadChatDrawer(drawer);
    clearConversationJumpTarget();
    setActiveDrawer((current) => (current === drawer ? null : drawer));
  }, [clearConversationJumpTarget, preloadChatDrawer, setActiveDrawer]);
    return { preloadChatDrawer, toggleChatDrawer };
}
