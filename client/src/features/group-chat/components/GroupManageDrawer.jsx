import { useState, useRef, useEffect } from 'react';
import { requestJson } from '../../../shared/http/requestJson.js';
import { getGroupProactiveLevelFromInterval, getGroupProactivePreset } from '../proactivePresets.js';
import { Settings, X, Edit3, UserPlus, UserMinus, Trash2 } from 'lucide-react';
import AvatarWithFrame from '../../../shared/media/AvatarWithFrame.jsx';
import { defaultAvatarUrl, resolveAvatarUrl } from '../../../shared/media/avatar.js';

export function GroupManageDrawer({
    group,
    apiUrl,
    resolveSender,
    onClose,
    lang,
    allContacts,
    onAddMember,
    onRename,
    onGroupUpdated,
}) {
    const [noChain, setNoChain] = useState(false);
    const [noChainLoading, setNoChainLoading] = useState(true);
    const [injectLimit, setInjectLimit] = useState(group?.inject_limit ?? 5);
    const [contextLimit, setContextLimit] = useState(group?.context_msg_limit ?? 60);
    const [groupProactiveEnabled, setGroupProactiveEnabled] = useState(group?.group_proactive_enabled === 1);
    const [groupIntervalMin, setGroupIntervalMin] = useState(group?.group_interval_min ?? 10);
    const [groupIntervalMax, setGroupIntervalMax] = useState(group?.group_interval_max ?? 60);
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(group?.name || '');
    const [showAddMember, setShowAddMember] = useState(false);
    const [addSearch, setAddSearch] = useState('');
    const [mutationBusy, setMutationBusy] = useState(false);
    const [mutationError, setMutationError] = useState('');
    const mutationLock = useRef(false);
    const runMutation = async (task) => {
        if (mutationLock.current) return false;
        mutationLock.current = true;
        setMutationBusy(true);
        setMutationError('');
        try {
            await task();
            return true;
        } catch (error) {
            setMutationError(error.message);
            return false;
        } finally {
            mutationLock.current = false;
            setMutationBusy(false);
        }
    };

    useEffect(() => {
        if (!group) return;
        setInjectLimit(group.inject_limit ?? 5);
        setContextLimit(group.context_msg_limit ?? 60);
        setGroupProactiveEnabled(group.group_proactive_enabled === 1);
        setGroupIntervalMin(group.group_interval_min ?? 10);
        setGroupIntervalMax(group.group_interval_max ?? 60);
        setNameInput(group.name || '');
        const controller = new AbortController();
        setNoChainLoading(true);
        requestJson(`${apiUrl}/groups/${group.id}/no-chain`, { signal: controller.signal })
            .then((data) => {
                if (!controller.signal.aborted) setNoChain(!!data.no_chain);
            })
            .catch((error) => {
                if (!controller.signal.aborted) setMutationError(error.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setNoChainLoading(false);
            });
        return () => controller.abort();
    }, [group, apiUrl]);

    const saveGroupPatch = async (patch) => {
        const data = await requestJson(apiUrl + '/groups/' + group.id, { method: 'PUT', body: JSON.stringify(patch) });
        if (data.group) onGroupUpdated?.(data.group);
    };
    const toggleNoChain = () =>
        runMutation(async () => {
            const value = !noChain;
            await requestJson(apiUrl + '/groups/' + group.id + '/no-chain', {
                method: 'POST',
                body: JSON.stringify({ no_chain: value }),
            });
            setNoChain(value);
        });
    const updateInjectLimit = (value) =>
        runMutation(async () => {
            await saveGroupPatch({ inject_limit: value });
            setInjectLimit(value);
        });
    const updateContextLimit = (value) =>
        runMutation(async () => {
            await saveGroupPatch({ context_msg_limit: value });
            setContextLimit(value);
        });
    const getProactiveLevel = () =>
        getGroupProactiveLevelFromInterval(groupProactiveEnabled, groupIntervalMin, groupIntervalMax);
    const updateGroupProactive = (level) =>
        runMutation(async () => {
            const [min, max] = getGroupProactivePreset(level);
            const patch =
                level === 0
                    ? { group_proactive_enabled: 0 }
                    : { group_proactive_enabled: 1, group_interval_min: min, group_interval_max: max };
            await saveGroupPatch(patch);
            setGroupProactiveEnabled(level !== 0);
            if (level) {
                setGroupIntervalMin(min);
                setGroupIntervalMax(max);
            }
        });
    const deleteAndRefresh = (suffix, prompt) => {
        if (!window.confirm(prompt)) return;
        return runMutation(async () => {
            await requestJson(apiUrl + '/groups/' + group.id + suffix, { method: 'DELETE' });
            window.location.reload();
        });
    };
    const clearMessages = () => deleteAndRefresh('/messages', lang === 'en' ? 'Clear all messages?' : '清空所有消息？');
    const dissolveGroup = () => deleteAndRefresh('', lang === 'en' ? 'Dissolve this group?' : '解散此群？');
    const kickMember = (mid) =>
        deleteAndRefresh('/members/' + encodeURIComponent(mid), lang === 'en' ? 'Remove this member?' : '移除此成员？');
    const handleRename = async () => {
        const newName = nameInput.trim();
        if (!newName) return;
        if (newName === group.name || (await runMutation(() => onRename(newName)))) setEditingName(false);
    };

    // Characters not already in the group
    const memberIds = new Set((group.members || []).map((m) => m.member_id || m));
    const availableChars = (allContacts || []).filter((c) => !memberIds.has(String(c.id)) && !memberIds.has(c.id));
    const filteredChars = availableChars.filter((c) => c.name.toLowerCase().includes(addSearch.toLowerCase()));

    return (
        <div
            className="group-manage-drawer chat-peer-drawer"
            style={{
                width: '280px',
                minWidth: '280px',
                backgroundColor: '#f7f7f7',
                borderLeft: '1px solid #eee',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflowY: 'auto',
            }}
        >
            {/* Header */}
            <div
                className="group-manage-drawer__header"
                style={{
                    padding: '12px 15px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#fff',
                }}
            >
                <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Settings size={16} /> {lang === 'en' ? 'Group Management' : '群管理'}
                </h3>
                <button
                    className="group-manage-drawer__close"
                    onClick={onClose}
                    title={lang === 'en' ? 'Close' : '关闭'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                    <X size={18} />
                </button>
            </div>

            {mutationError && (
                <div role="alert" className="group-message-error">
                    {mutationError}
                </div>
            )}
            {/* Group Name (editable) */}
            <div
                className="group-manage-card group-manage-card--name"
                style={{ backgroundColor: '#fff', padding: '12px 15px', borderBottom: '1px solid #eee' }}
            >
                <div
                    style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                    }}
                >
                    {lang === 'en' ? 'Group Name' : '群名称'}
                </div>
                {editingName ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                            disabled={mutationBusy}
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename();
                                if (e.key === 'Escape') {
                                    setEditingName(false);
                                    setNameInput(group.name);
                                }
                            }}
                            autoFocus
                            style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--accent-color)',
                                fontSize: '14px',
                                outline: 'none',
                            }}
                        />
                        <button
                            disabled={mutationBusy}
                            onClick={handleRename}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'var(--accent-color)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '12px',
                            }}
                        >
                            ✓
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '15px', fontWeight: '500' }}>{group.name}</span>
                        <button
                            disabled={mutationBusy}
                            onClick={() => setEditingName(true)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                padding: '2px',
                            }}
                            title={lang === 'en' ? 'Rename group' : '修改群名'}
                        >
                            <Edit3 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Members */}
            <div
                className="group-manage-card group-manage-card--members"
                style={{ backgroundColor: '#fff', padding: '12px 15px', borderBottom: '1px solid #eee' }}
            >
                <div
                    style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span>
                        {lang === 'en' ? 'Members' : '群成员'} ({group.members?.length || 0})
                    </span>
                    <button
                        disabled={mutationBusy}
                        onClick={() => setShowAddMember(!showAddMember)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--accent-color)',
                            padding: '0',
                        }}
                        title={lang === 'en' ? 'Add member' : '添加成员'}
                    >
                        <UserPlus size={14} />
                    </button>
                </div>
                {group.members?.map((memberObj) => {
                    const mid = memberObj.member_id || memberObj;
                    const m = resolveSender(mid);
                    return (
                        <div
                            key={mid}
                            className="group-manage-member-row"
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' }}
                        >
                            <AvatarWithFrame
                                size={30}
                                frame={m.avatar_frame}
                                src={m.avatar}
                                fallbackSrc={defaultAvatarUrl(m.name || mid || 'User')}
                                alt=""
                            />
                            <span style={{ flex: 1, fontSize: '13px' }}>{m.name}</span>
                            {mid !== 'user' && (
                                <button
                                    disabled={mutationBusy}
                                    onClick={() => kickMember(mid)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--danger)',
                                        padding: '2px',
                                    }}
                                    title={lang === 'en' ? 'Remove member from group' : '将该成员踢出群聊'}
                                >
                                    <UserMinus size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}
                {/* Add Member Panel */}
                {showAddMember && (
                    <div
                        className="group-manage-add-member"
                        style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}
                    >
                        <input
                            disabled={mutationBusy}
                            type="text"
                            placeholder={lang === 'en' ? 'Search characters...' : '搜索角色...'}
                            value={addSearch}
                            onChange={(e) => setAddSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                marginBottom: '8px',
                            }}
                        />
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {filteredChars.length === 0 && (
                                <div
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        textAlign: 'center',
                                        padding: '10px',
                                    }}
                                >
                                    {lang === 'en' ? 'No characters available' : '没有可添加的角色'}
                                </div>
                            )}
                            {filteredChars.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={async () => {
                                        if (await runMutation(() => onAddMember(c.id))) {
                                            setShowAddMember(false);
                                            setAddSearch('');
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '6px 4px',
                                        cursor: 'pointer',
                                        borderRadius: '6px',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9eb')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <AvatarWithFrame
                                        size={28}
                                        frame={c.avatar_frame}
                                        src={resolveAvatarUrl(c.avatar, apiUrl, c.name || c.id || 'User')}
                                        fallbackSrc={defaultAvatarUrl(c.name || c.id || 'User')}
                                        alt=""
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: '500' }}>{c.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* AI Controls */}
            <div
                className="group-manage-card group-manage-card--ai"
                style={{
                    backgroundColor: '#fff',
                    padding: '12px 15px',
                    borderBottom: '1px solid #eee',
                    marginTop: '8px',
                }}
            >
                <div
                    style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                    }}
                >
                    {lang === 'en' ? 'AI Controls' : 'AI 控制'}
                </div>
                <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}
                >
                    <span>{lang === 'en' ? '⚡ Prevent AI Chaining' : '⚡ 禁止AI互相接话'}</span>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                        <input
                            disabled={mutationBusy || noChainLoading}
                            type="checkbox"
                            checked={noChain}
                            onChange={toggleNoChain}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span
                            style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: noChain ? 'var(--accent-color)' : '#ccc',
                                borderRadius: '24px',
                                transition: '0.3s',
                            }}
                        >
                            <span
                                style={{
                                    position: 'absolute',
                                    height: '18px',
                                    width: '18px',
                                    left: noChain ? '23px' : '3px',
                                    bottom: '3px',
                                    backgroundColor: 'white',
                                    borderRadius: '50%',
                                    transition: '0.3s',
                                }}
                            />
                        </span>
                    </label>
                </div>
                <div style={{ marginTop: '14px', borderTop: '1px dashed #eee', paddingTop: '14px' }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '14px',
                            marginBottom: '6px',
                        }}
                    >
                        <span>💬 {lang === 'en' ? 'Proactive group message' : '群聊主动发消息'}</span>
                        <span
                            style={{
                                fontWeight: '600',
                                color: 'var(--accent-color)',
                                minWidth: '70px',
                                textAlign: 'right',
                            }}
                        >
                            {!groupProactiveEnabled
                                ? lang === 'en'
                                    ? 'Off'
                                    : '关闭'
                                : `${groupIntervalMin || 10}~${groupIntervalMax || 60}${lang === 'en' ? ' min' : '分钟'}`}
                        </span>
                    </div>
                    <input
                        disabled={mutationBusy}
                        type="range"
                        min="0"
                        max="10"
                        value={getProactiveLevel()}
                        onChange={(e) => updateGroupProactive(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                    />
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            marginTop: '4px',
                        }}
                    >
                        <span>{lang === 'en' ? 'Off' : '关闭'}</span>
                        <span>{lang === 'en' ? 'Very frequent' : '非常频繁'}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {lang === 'en'
                            ? 'Only controls this group. A random member may start a topic when the group is quiet.'
                            : '只控制当前群。群里安静时，会随机挑一名群成员主动起话题。'}
                    </div>
                </div>
                <div style={{ marginTop: '14px' }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '14px',
                            marginBottom: '6px',
                        }}
                    >
                        <span>📤 {lang === 'en' ? 'Inject into other contexts' : '注入私聊/其他群的消息条数'}</span>
                        <span
                            style={{
                                fontWeight: '600',
                                color: 'var(--accent-color)',
                                minWidth: '28px',
                                textAlign: 'right',
                            }}
                        >
                            {injectLimit}
                        </span>
                    </div>
                    <input
                        disabled={mutationBusy}
                        type="range"
                        min="0"
                        max="30"
                        value={injectLimit}
                        onChange={(e) => updateInjectLimit(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {lang === 'en'
                            ? 'Messages from this group injected into private chat & other group chats. 0 = disabled.'
                            : '本群消息注入私聊和其他群聊的条数。0 = 关闭注入。'}
                    </div>
                </div>
                <div style={{ marginTop: '14px', borderTop: '1px dashed #eee', paddingTop: '14px' }}>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '14px',
                            marginBottom: '6px',
                        }}
                    >
                        <span>🧠 {lang === 'en' ? 'AI Vision Boundary' : 'AI 记忆视界 (上下文条数)'}</span>
                        <span
                            style={{
                                fontWeight: '600',
                                color: 'var(--accent-color)',
                                minWidth: '28px',
                                textAlign: 'right',
                            }}
                        >
                            {contextLimit}
                        </span>
                    </div>
                    <input
                        disabled={mutationBusy}
                        type="range"
                        min="10"
                        max="200"
                        step="10"
                        value={contextLimit}
                        onChange={(e) => updateContextLimit(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {lang === 'en'
                            ? 'How many recent messages AI can "see" in this group. Older ones are hidden from AI.'
                            : 'AI 在本群能感知的最近消息条数。超出该线的旧消息将被忽略，节省算力。'}
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div
                className="group-manage-card group-manage-card--danger"
                style={{ backgroundColor: '#fff', padding: '12px 15px', marginTop: '8px' }}
            >
                <div
                    style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                    }}
                >
                    {lang === 'en' ? 'Danger Zone' : '危险操作'}
                </div>
                <button
                    disabled={mutationBusy}
                    onClick={clearMessages}
                    title={lang === 'en' ? 'Delete all messages in this group' : '清空群聊中的所有消息'}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                    }}
                >
                    <Trash2 size={14} /> {lang === 'en' ? 'Clear Messages' : '清空消息'}
                </button>
                <button
                    disabled={mutationBusy}
                    onClick={dissolveGroup}
                    title={lang === 'en' ? 'Permanently dissolve this group chat' : '永久解散此群聊'}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: 'var(--danger)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                    }}
                >
                    💥 {lang === 'en' ? 'Dissolve Group' : '解散群聊'}
                </button>
            </div>
        </div>
    );
}
