import { useCallback } from 'react';

export function useJumpTargets() {
const normalizeConversationJumpTarget = useCallback((target = null) => {
    const scope = String(target?.scope || '').trim();
    const messageId = Number(target?.messageId || target?.message_id || 0);
    if (!Number.isSafeInteger(messageId) || messageId <= 0) return null;
    if (scope === 'group') {
      const groupId = String(target?.groupId || target?.group_id || '').trim();
      if (!groupId) return null;
      return {
        scope: 'group',
        messageId,
        groupId,
        token: target?.token || `group:${groupId}:${messageId}`
      };
    }
    const characterId = String(target?.characterId || target?.character_id || '').trim();
    if (!characterId) return null;
    return {
      scope: 'private',
      messageId,
      characterId,
      token: target?.token || `private:${characterId}:${messageId}`
    };
  }, []);

const buildConversationJumpTarget = useCallback((result = {}) => {
    const scope = result.scope === 'group' ? 'group' : 'private';
    return normalizeConversationJumpTarget({
      scope,
      messageId: result.message_id || result.messageId,
      characterId: result.character_id || result.characterId || result.conversation_id,
      groupId: result.group_id || result.groupId || result.conversation_id,
      token: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    });
  }, [normalizeConversationJumpTarget]);
    return { normalizeConversationJumpTarget, buildConversationJumpTarget };
}
