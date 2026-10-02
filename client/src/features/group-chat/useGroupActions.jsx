import { requestJson } from "../../shared/http/requestJson.js";
import { useCallback } from 'react';

export function useGroupActions(dependencies) {
const { API_URL, BookOpen, GroupManageDrawer, MessageSquare, UsersRound, contacts, effectiveUser, lang, resolveAvatarUrl, setGroups } = dependencies;
const updateGroupInState = useCallback((updatedGroup) => {
    if (!updatedGroup?.id) return;
    setGroups((currentGroups) => (
      currentGroups.map((group) => (
        String(group.id) === String(updatedGroup.id) ? updatedGroup : group
      ))
    ));
  }, [setGroups]);

const resolveGroupSenderForDrawer = useCallback((senderId) => {
    const normalizedId = String(senderId || '');
    if (normalizedId === 'user') {
      const userName = effectiveUser?.name || 'User';
      return {
        name: userName,
        avatar: resolveAvatarUrl(effectiveUser?.avatar, API_URL, userName),
        avatar_frame: effectiveUser?.avatar_frame,
      };
    }

    const contact = contacts.find((item) => String(item.id) === normalizedId);
    const displayName = contact?.name || senderId || 'User';
    return {
      name: displayName,
      avatar: resolveAvatarUrl(contact?.avatar, API_URL, displayName),
      avatar_frame: contact?.avatar_frame,
    };
  }, [API_URL, contacts, effectiveUser?.avatar, effectiveUser?.avatar_frame, effectiveUser?.name, resolveAvatarUrl]);

const handleGroupAddMember = useCallback(async (group, characterId) => {
    if (!group?.id || !characterId) return;
    const data = await requestJson(API_URL + '/groups/' + group.id + '/members', { method: 'POST', body: JSON.stringify({ member_id: characterId }) });
    if (data.group) updateGroupInState(data.group);
  }, [API_URL, updateGroupInState]);

const handleGroupRename = useCallback(async (group, newName) => {
    if (!group?.id || !String(newName || '').trim()) return;
    const data = await requestJson(API_URL + '/groups/' + group.id, { method: 'PUT', body: JSON.stringify({ name: String(newName).trim() }) });
    if (data.group) updateGroupInState(data.group);
  }, [API_URL, updateGroupInState]);

const renderGroupSideSlot = useCallback(({ group, drawer, onClose }) => {
    const isManageDrawer = drawer === 'group-manage';
    return (
      <div className="private-chat-side-slot group-chat-side-slot" data-slot-view={isManageDrawer ? 'group-manage' : 'group-placeholder'}>
        {isManageDrawer && group ? (
          <GroupManageDrawer
            group={group}
            apiUrl={API_URL}
            resolveSender={resolveGroupSenderForDrawer}
            onClose={onClose}
            lang={lang}
            allContacts={contacts}
            onAddMember={(characterId) => handleGroupAddMember(group, characterId)}
            onRename={(newName) => handleGroupRename(group, newName)}
            onGroupUpdated={updateGroupInState}
          />
        ) : (
          <aside className="private-chat-journal group-chat-placeholder" aria-label={lang === 'en' ? 'Group side panel placeholder' : '群聊侧栏占位'}>
            <div className="private-chat-journal__head">
              <span className="private-chat-journal__icon">
                <UsersRound size={17} />
              </span>
              <div>
                <h3>{lang === 'en' ? 'Group Space' : '群聊侧栏'}</h3>
                <p>{lang === 'en' ? 'Reserved area' : '预留区域'}</p>
              </div>
              <span className="private-chat-journal__weather">
                <BookOpen size={14} />
              </span>
            </div>

            <section className="private-chat-journal__section group-chat-placeholder__section">
              <div className="private-chat-journal__section-title">
                <MessageSquare size={14} />
                <span>{lang === 'en' ? 'Waiting' : '先占位'}</span>
              </div>
              <p className="group-chat-placeholder__copy">
                {lang === 'en'
                  ? 'Keeping this side aligned with the private diary panel.'
                  : '这里先和私聊日记区保持同样占位，内容之后再定。'}
              </p>
            </section>
          </aside>
        )}
      </div>
    );
  }, [API_URL, contacts, handleGroupAddMember, handleGroupRename, lang, resolveGroupSenderForDrawer, updateGroupInState]);
    return { updateGroupInState, resolveGroupSenderForDrawer, handleGroupAddMember, handleGroupRename, renderGroupSideSlot };
}
