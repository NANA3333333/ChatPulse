import { Suspense, useCallback } from 'react';

export function useSocialWindowRenderer(dependencies) {
const { API_URL, AppErrorBoundary, AvatarWithFrame, ChatSettingsDrawer, ChatWindow, ContactList, DiaryTable, DrawerFallback, GroupChatWindow, MemoTable, MessageSquare, PrivateChatDrawerShell, PrivateChatJournalPanel, Search, UserPlus, UsersRound, buildConversationJumpTarget, chatSearch, chatSearchNeedle, contacts, defaultAvatarUrl, effectiveUser, engineState, fetchContacts, filteredContacts, filteredGroups, formatBadge, generatingSchedules, groupChatEnabled, groupTyping, groupUnreadCounts, groups, hiddenMessagesCount, incomingGroupMessageQueue, incomingMessageQueue, lang, normalizeBrowserWindowSocialState, openAddCharacterModal, preloadChatDrawer, privateChatForegroundEnabled, redpacketClaimEvent, renderGroupSideSlot, resolveAvatarUrl, setBrowserWindows, setChatSearch, setContacts, setGroupUnreadCounts, setHiddenMessagesCount, setShowCreateGroupModal, t, updateBrowserWindowSocialState, updateGroupInState, userProfile } = dependencies;
const renderLiveSocialWindowContent = useCallback((windowItem) => {
    const socialState = normalizeBrowserWindowSocialState(windowItem?.social || {});
    const liveContact = socialState.activeContactId
      ? contacts.find(contact => String(contact.id) === String(socialState.activeContactId))
      : null;
    const liveGroup = socialState.activeGroupId
      ? groups.find(group => String(group.id) === String(socialState.activeGroupId))
      : null;
    const liveDrawer = socialState.activeDrawer || null;
    const liveJumpTarget = socialState.searchJumpTarget || null;
    const liveWindowId = windowItem?.id;
    const liveForegroundLayoutLifted = Boolean(liveGroup && privateChatForegroundEnabled && !windowItem?.maximized);

    const updateLiveSocial = (patch) => {
      updateBrowserWindowSocialState(liveWindowId, patch);
    };
    const clearLiveConversationJumpTarget = (handledTarget = null) => {
      const handledToken = String(handledTarget?.token || '');
      if (handledToken && liveJumpTarget?.token && String(liveJumpTarget.token) !== handledToken) return;
      updateLiveSocial({ searchJumpTarget: null });
    };
    const toggleLiveDrawer = (drawer) => {
      preloadChatDrawer(drawer);
      updateLiveSocial({ activeDrawer: liveDrawer === drawer ? null : drawer, searchJumpTarget: null });
    };
    const handleLiveContactSelect = (id) => {
      const selected = contacts.find(contact => String(contact.id) === String(id));
      updateLiveSocial({
        activeContactId: selected?.id || id,
        activeGroupId: null,
        activeDrawer: liveDrawer,
        searchJumpTarget: null,
      });
      setContacts(prev => prev.map(contact => String(contact.id) === String(id) ? { ...contact, unread: 0 } : contact));
    };
    const handleLiveGroupSelect = (groupId) => {
      updateLiveSocial({
        activeContactId: null,
        activeGroupId: groupId,
        activeDrawer: null,
        searchJumpTarget: null,
      });
      setGroupUnreadCounts((current) => {
        if (!current[groupId]) return current;
        const next = { ...current };
        delete next[groupId];
        return next;
      });
    };
    const handleLiveConversationSearchResultSelect = (result) => {
      const target = buildConversationJumpTarget(result);
      if (!target) return;
      if (target.scope === 'group') {
        updateLiveSocial({
          activeContactId: null,
          activeGroupId: target.groupId,
          activeDrawer: null,
          searchJumpTarget: target,
        });
        setGroupUnreadCounts((current) => {
          if (!current[target.groupId]) return current;
          const next = { ...current };
          delete next[target.groupId];
          return next;
        });
        return;
      }
      updateLiveSocial({
        activeContactId: target.characterId,
        activeGroupId: null,
        activeDrawer: liveDrawer,
        searchJumpTarget: target,
      });
      setContacts(prev => prev.map(contact => (
        String(contact.id) === String(target.characterId) ? { ...contact, unread: 0 } : contact
      )));
    };
    const handleLiveSwitchTab = (nextTab) => {
      if (!liveWindowId) return;
      setBrowserWindows((currentWindows) => currentWindows.map((currentWindow) => (
        currentWindow.id === liveWindowId
          ? {
            ...currentWindow,
            tabs: currentWindow.tabs?.includes(nextTab) ? currentWindow.tabs : [...(currentWindow.tabs || []), nextTab],
            activeTab: nextTab,
            activeTabIndex: Math.max(0, (currentWindow.tabs || []).includes(nextTab)
              ? (currentWindow.tabs || []).indexOf(nextTab)
              : (currentWindow.tabs || []).length),
          }
          : currentWindow
      )));
    };

    return (
      <div
        key={`live-social-window-${liveWindowId || 'unknown'}`}
        className="desktop-live-social-window"
        data-desktop-app-tab="chats"
      >
        <div className="middle-column">
          <div className="middle-column-heading">
            <div className="private-chat-heading-actions">
              {groupChatEnabled && <button type="button" onClick={() => setShowCreateGroupModal(true)}
                aria-label={lang === 'en' ? 'Create Group' : '创建群聊'} title={lang === 'en' ? 'Create Group' : '创建群聊'}>
                <UsersRound size={18} />
              </button>}
              <button
                type="button"
                className="private-chat-create-character-button"
                onClick={() => openAddCharacterModal(true)}
                title={lang === 'en' ? 'Create character and open chat' : '创建角色并进入私聊'}
                aria-label={lang === 'en' ? 'Create character and open chat' : '创建角色并进入私聊'}
              >
                <UserPlus size={18} />
              </button>
            </div>
          </div>
          <div className="search-bar-container">
            <input
              type="text"
              className="search-bar"
              value={chatSearch}
              onChange={(event) => setChatSearch(event.target.value)}
              placeholder={t('Search') || 'Search'}
            />
          </div>
          <div className="list-container">
            <ContactList
              apiUrl={API_URL}
              contacts={filteredContacts}
              activeId={liveContact?.id || null}
              engineState={engineState}
              onSelect={handleLiveContactSelect}
            />
            {groupChatEnabled && filteredGroups.length > 0 && (
              <div style={{ borderTop: '1px solid #eee' }}>
                <div style={{ padding: '5px 15px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                  {lang === 'en' ? 'Group Chats' : '群聊'}
                </div>
                {filteredGroups.map(group => {
                  const memberCount = group.members?.length || 0;
                  const groupAvatarSize = memberCount <= 1 ? 58 : 46;
                  const groupAvatarOverlap = memberCount <= 1 ? 0 : -18;
                  const unreadCount = Number(groupUnreadCounts[group.id]) || 0;

                  return (
                    <div
                      key={`live-${liveWindowId}-group-${group.id}`}
                      className={`contact-item group-contact-item ${liveGroup?.id === group.id ? 'active' : ''}`}
                      title={group.name}
                      aria-label={lang === 'en' ? `${group.name}, group chat` : `${group.name}，群聊`}
                      onClick={() => handleLiveGroupSelect(group.id)}
                    >
                      <div className="contact-avatar group-contact-avatar" style={{ width: 'auto', minWidth: '42px', height: '42px', display: 'flex', alignItems: 'center' }}>
                        {group.members?.slice(0, 4).map((memberObj, idx) => {
                          const memberId = typeof memberObj === 'object' ? memberObj.member_id : memberObj;
                          const member = contacts.find(contact => String(contact.id) === String(memberId));
                          const memberName = memberId === 'user'
                            ? userProfile?.name || 'User'
                            : member?.name || memberId || 'User';
                          const memberAvatar = memberId === 'user'
                            ? resolveAvatarUrl(userProfile?.avatar, API_URL, memberName)
                            : resolveAvatarUrl(member?.avatar, API_URL, memberName);
                          const memberFrame = memberId === 'user' ? userProfile?.avatar_frame : member?.avatar_frame;
                          return (
                            <AvatarWithFrame
                              key={`${memberId}-${idx}`}
                              size={groupAvatarSize}
                              frame={memberFrame}
                              src={memberAvatar}
                              fallbackSrc={defaultAvatarUrl(memberName)}
                              alt=""
                              style={{ marginLeft: idx > 0 ? `${groupAvatarOverlap}px` : '0', zIndex: 10 - idx }}
                              imageStyle={{ border: memberCount === 1 ? '1px solid rgba(255, 111, 151, 0.28)' : '2px solid #fff' }}
                            />
                          );
                        })}
                        {(!group.members || group.members.length === 0) && (
                          <div style={{ width: `${groupAvatarSize}px`, height: `${groupAvatarSize}px`, backgroundColor: '#e1e1e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <UsersRound size={22} style={{ color: '#fff' }} />
                          </div>
                        )}
                      </div>
                      <div className="group-contact-item__body">
                        <span className="group-contact-item__name">{group.name}</span>
                        <span className="group-contact-item__meta">{lang === 'en' ? `${memberCount} members` : `${memberCount} 位成员`}</span>
                      </div>
                      {unreadCount > 0 && <span className="unread-badge">{formatBadge(unreadCount)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {chatSearchNeedle && filteredContacts.length === 0 && filteredGroups.length === 0 && (
              <div className="empty-chat-state empty-chat-state--compact">
                <Search size={28} className="empty-icon" />
                <p>{lang === 'en' ? 'No conversations found' : '没有找到会话'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="right-column" style={{ flexDirection: 'row' }}>
          {liveContact ? (
            <div className="private-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minWidth: 0 }}>
              <div className="private-chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <ChatWindow
                  contact={liveContact}
                  allContacts={contacts}
                  userAvatar={effectiveUser?.avatar}
                  userAvatarFrame={effectiveUser?.avatar_frame}
                  apiUrl={API_URL}
                  incomingMessageQueue={incomingMessageQueue}
                  engineState={engineState}
                  onToggleMemo={() => toggleLiveDrawer('memo')}
                  onToggleDiary={() => toggleLiveDrawer('diary')}
                  onToggleSettings={() => toggleLiveDrawer('settings')}
                  onPreloadMemo={() => preloadChatDrawer('memo')}
                  onPreloadDiary={() => preloadChatDrawer('diary')}
                  onPreloadSettings={() => preloadChatDrawer('settings')}
                  onBack={() => updateLiveSocial({ activeContactId: null, activeGroupId: null, searchJumpTarget: null })}
                  onSwitchTab={handleLiveSwitchTab}
                  isGeneratingSchedule={generatingSchedules[liveContact.id]}
                  onMessagesChange={setHiddenMessagesCount}
                  isPrivateChatForegroundEnabled={privateChatForegroundEnabled}
                  chatLayoutKey={liveDrawer || 'journal'}
                  jumpTarget={liveJumpTarget}
                  onSearchResultSelect={handleLiveConversationSearchResultSelect}
                  onJumpHandled={clearLiveConversationJumpTarget}
                />
              </div>
              <div className="private-chat-side-slot" data-slot-view={liveDrawer || 'journal'}>
                {!liveDrawer && (
                  <PrivateChatJournalPanel
                    contact={liveContact}
                    lang={lang}
                    onOpenDiary={() => toggleLiveDrawer('diary')}
                  />
                )}
                {liveDrawer === 'memo' && (
                  <PrivateChatDrawerShell type="memo">
                    <AppErrorBoundary
                      variant="drawer"
                      resetKey={`live-drawer:memo:${liveWindowId}:${liveContact.id}`}
                      lang={lang}
                      title={`${liveContact?.name || (lang === 'en' ? 'Character' : '角色')} ${lang === 'en' ? "'s Memories" : '的记忆'}`}
                      onClose={() => updateLiveSocial({ activeDrawer: null })}
                    >
                      <Suspense fallback={<DrawerFallback type="memo" contact={liveContact} lang={lang} onClose={() => updateLiveSocial({ activeDrawer: null })} />}>
                        <MemoTable
                          contact={liveContact}
                          apiUrl={API_URL}
                          onClose={() => updateLiveSocial({ activeDrawer: null })}
                        />
                      </Suspense>
                    </AppErrorBoundary>
                  </PrivateChatDrawerShell>
                )}
                {liveDrawer === 'diary' && (
                  <PrivateChatDrawerShell type="diary">
                    <AppErrorBoundary
                      variant="drawer"
                      resetKey={`live-drawer:diary:${liveWindowId}:${liveContact.id}`}
                      lang={lang}
                      title={`${liveContact?.name || (lang === 'en' ? 'Character' : '角色')} ${lang === 'en' ? "'s Diary" : '的日记'}`}
                      onClose={() => updateLiveSocial({ activeDrawer: null })}
                    >
                      <Suspense fallback={<DrawerFallback type="diary" contact={liveContact} lang={lang} onClose={() => updateLiveSocial({ activeDrawer: null })} />}>
                        <DiaryTable
                          contact={liveContact}
                          apiUrl={API_URL}
                          onClose={() => updateLiveSocial({ activeDrawer: null })}
                        />
                      </Suspense>
                    </AppErrorBoundary>
                  </PrivateChatDrawerShell>
                )}
                {liveDrawer === 'settings' && (
                  <PrivateChatDrawerShell type="settings">
                    <AppErrorBoundary
                      variant="drawer"
                      resetKey={`live-drawer:settings:${liveWindowId}:${liveContact.id}`}
                      lang={lang}
                      title={lang === 'en' ? 'Chat Settings' : '聊天设置'}
                      onClose={() => updateLiveSocial({ activeDrawer: null })}
                    >
                      <Suspense fallback={<DrawerFallback type="settings" contact={liveContact} lang={lang} onClose={() => updateLiveSocial({ activeDrawer: null })} />}>
                        <ChatSettingsDrawer
                          contact={liveContact}
                          contacts={contacts}
                          apiUrl={API_URL}
                          onClose={() => updateLiveSocial({ activeDrawer: null })}
                          onClearHistory={() => {
                            updateLiveSocial({ activeDrawer: null });
                            fetchContacts();
                          }}
                          isGeneratingSchedule={!!generatingSchedules[liveContact.id]}
                          messagesHideStateCount={hiddenMessagesCount}
                        />
                      </Suspense>
                    </AppErrorBoundary>
                  </PrivateChatDrawerShell>
                )}
              </div>
            </div>
          ) : liveGroup ? (
            <div className="group-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', minWidth: 0 }}>
              <GroupChatWindow
                group={liveGroup}
                apiUrl={API_URL}
                allContacts={contacts}
                userProfile={effectiveUser}
                incomingGroupMessageQueue={incomingGroupMessageQueue}
                typingIndicators={groupTyping[liveGroup.id] || []}
                redpacketClaimEvent={redpacketClaimEvent}
                onBack={() => updateLiveSocial({ activeContactId: null, activeGroupId: null, activeDrawer: null, searchJumpTarget: null })}
                onGroupUpdated={updateGroupInState}
                isManageOpen={liveDrawer === 'group-manage'}
                onToggleManage={() => toggleLiveDrawer('group-manage')}
                onCloseManage={() => updateLiveSocial({ activeDrawer: null })}
                isForegroundLayoutLifted={liveForegroundLayoutLifted}
                jumpTarget={liveJumpTarget}
                onSearchResultSelect={handleLiveConversationSearchResultSelect}
                onJumpHandled={clearLiveConversationJumpTarget}
              />
              {renderGroupSideSlot({
                group: liveGroup,
                drawer: liveDrawer,
                onClose: () => updateLiveSocial({ activeDrawer: null }),
              })}
            </div>
          ) : (
            <div className="empty-chat-state">
              <MessageSquare size={64} className="empty-icon" />
              <p>{lang === 'en' ? 'Select a conversation' : '选择一个会话'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }, [normalizeBrowserWindowSocialState, contacts, groups, privateChatForegroundEnabled, lang, chatSearch, t, API_URL, filteredContacts, engineState, groupChatEnabled, filteredGroups, chatSearchNeedle, effectiveUser, incomingMessageQueue, generatingSchedules, setHiddenMessagesCount, setShowCreateGroupModal, hiddenMessagesCount, incomingGroupMessageQueue, groupTyping, redpacketClaimEvent, updateGroupInState, renderGroupSideSlot, updateBrowserWindowSocialState, preloadChatDrawer, setContacts, setGroupUnreadCounts, buildConversationJumpTarget, setBrowserWindows, openAddCharacterModal, setChatSearch, groupUnreadCounts, formatBadge, userProfile?.name, userProfile?.avatar, userProfile?.avatar_frame, resolveAvatarUrl, defaultAvatarUrl, fetchContacts]);
    return { renderLiveSocialWindowContent };
}
