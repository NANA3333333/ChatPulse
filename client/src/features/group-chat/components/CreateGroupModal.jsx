import React, { useRef, useState } from 'react';
import { requestJson } from '../../../shared/http/requestJson.js';
import { X, CheckCircle2, Search } from 'lucide-react';
import AvatarWithFrame from "../../../shared/media/AvatarWithFrame.jsx";
import { useLanguage } from "../../../shared/i18n/LanguageContext.jsx";
import { defaultAvatarUrl, resolveAvatarUrl } from "../../../shared/media/avatar.js";

function CreateGroupModal({ apiUrl, contacts, onClose, onCreate }) {
    const { lang } = useLanguage();
    const [groupName, setGroupName] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const creatingRef = useRef(false);
    const authToken = localStorage.getItem('cp_token') || '';
    const authJsonHeaders = React.useMemo(() => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    }), [authToken]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleCreate = async () => {
        if (!groupName.trim() || selectedIds.length === 0 || creatingRef.current) return;
        creatingRef.current = true;
        setCreateError('');
        setCreating(true);
        try {
            const data = await requestJson(`${apiUrl}/groups`, {
                method: 'POST',
                headers: authJsonHeaders,
                body: JSON.stringify({ name: groupName.trim(), member_ids: selectedIds })
            });
            if (!data.group?.id) throw new Error(lang === 'en' ? 'Invalid group response' : '服务器未返回群聊信息');
            onCreate(data.group);
        } catch (e) {
            setCreateError(e.message || (lang === 'en' ? 'Failed to create group' : '创建群聊失败'));
        } finally {
            creatingRef.current = false;
            setCreating(false);
        }
    };

    const filtered = contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="modal-overlay chat-modal-overlay create-group-modal-overlay">
            <div className="modal-content chat-action-modal create-group-modal" style={{ maxWidth: '420px', padding: 0 }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>
                        {lang === 'en' ? 'Create Group Chat' : '发起群聊'}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="#999" />
                    </button>
                </div>

                <div style={{ padding: '15px 20px' }}>
                    <input
                        type="text"
                        placeholder={lang === 'en' ? 'Group Name' : '群聊名称'}
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', marginBottom: '12px' }}
                    />

                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <Search size={16} color="#aaa" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                        <input
                            type="text"
                            placeholder={lang === 'en' ? 'Search contacts...' : '搜索联系人...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                        />
                    </div>

                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {filtered.map(c => (
                            <div
                                key={c.id}
                                className={`chat-modal-list-row ${selectedIds.includes(c.id) ? 'is-selected' : ''}`}
                                onClick={() => toggleSelect(c.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', padding: '8px',
                                    borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                                    backgroundColor: selectedIds.includes(c.id) ? '#f0f9eb' : 'transparent',
                                    borderRadius: '6px'
                                }}
                            >
                                <AvatarWithFrame
                                    size={36}
                                    frame={c.avatar_frame}
                                    src={resolveAvatarUrl(c.avatar, apiUrl, c.name || c.id || 'User')}
                                    fallbackSrc={defaultAvatarUrl(c.name || c.id || 'User')}
                                    alt={c.name}
                                    style={{ marginRight: '10px' }}
                                />
                                <div style={{ flex: 1, fontWeight: '500', fontSize: '14px' }}>{c.name}</div>
                                {selectedIds.includes(c.id) && <CheckCircle2 size={18} color="var(--accent-color)" />}
                            </div>
                        ))}
                    </div>

                    {createError && <p role="alert">{createError}</p>}
                    <button
                        onClick={handleCreate}
                        disabled={!groupName.trim() || selectedIds.length === 0 || creating}
                        style={{
                            width: '100%', padding: '10px', borderRadius: '6px', border: 'none', marginTop: '15px',
                            backgroundColor: (groupName.trim() && selectedIds.length > 0) ? 'var(--accent-color)' : '#e0e0e0',
                            color: (groupName.trim() && selectedIds.length > 0) ? '#fff' : '#999',
                            fontWeight: '500', fontSize: '15px', cursor: (groupName.trim() && selectedIds.length > 0) ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {creating ? '...' : (lang === 'en' ? `Create (${selectedIds.length} selected)` : `创建 (${selectedIds.length} 人)`)}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateGroupModal;
