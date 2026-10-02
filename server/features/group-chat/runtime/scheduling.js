// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getGroupRuntimeKey(userId, groupId) {
        const cleanUserId = String(userId || '').trim();
        const cleanGroupId = String(groupId || '').trim();
        return cleanUserId && cleanGroupId ? `${cleanUserId}:${cleanGroupId}` : '';
    }

function clearGroupRuntimeState(userId, groupId) {
        const id = getGroupRuntimeKey(userId, groupId);
        if (!id) return;
        dependencies.pausedGroups.delete(id);
        dependencies.noChainGroups.delete(id);
        if (dependencies.groupDebounceTimers[id]) {
            clearTimeout(dependencies.groupDebounceTimers[id]);
            delete dependencies.groupDebounceTimers[id];
        }
        delete dependencies.groupReplyLock[id];
        delete dependencies.groupInterrupt[id];
        delete dependencies.groupPendingMentions[id];
    }

    return { getGroupRuntimeKey, clearGroupRuntimeState };
}

module.exports = { createModule };
