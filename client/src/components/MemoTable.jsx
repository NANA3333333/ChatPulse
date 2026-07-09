import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

function buildAuthHeaders() {
    return {
        'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`
    };
}

function MemoTable({ contact, apiUrl, onClose }) {
    const { t, lang } = useLanguage();
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchMemories = React.useCallback(() => {
        if (!contact) return;
        setLoading(true);
        fetch(`${apiUrl}/memories/${contact.id}`, { headers: buildAuthHeaders() })
            .then(res => res.json())
            .then(data => {
                if (!Array.isArray(data)) {
                    console.error('API Error:', data);
                    data = [];
                }
                setMemories(data.filter(mem => Number(mem?.is_archived || 0) === 0));
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load memories:', err);
                setLoading(false);
            });
    }, [contact, apiUrl]);

    useEffect(() => {
        fetchMemories();

        const handleMemoryUpdate = (event) => {
            if (contact && event.detail.characterId === contact.id) {
                fetchMemories();
            }
        };

        const handleCharacterDataWiped = (event) => {
            if (contact && event.detail?.characterId === contact.id) {
                setMemories([]);
                setLoading(false);
            }
        };

        window.addEventListener('memory_update', handleMemoryUpdate);
        window.addEventListener('character_data_wiped', handleCharacterDataWiped);

        return () => {
            window.removeEventListener('memory_update', handleMemoryUpdate);
            window.removeEventListener('character_data_wiped', handleCharacterDataWiped);
        };
    }, [contact, fetchMemories]);

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`${apiUrl}/memories/${id}`, { method: 'DELETE', headers: buildAuthHeaders() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                alert(lang === 'en' ? `Delete failed:\n${data?.error || 'Unknown error'}` : `删除失败:\n${data?.error || '未知错误'}`);
                return;
            }
            setMemories(prev => prev.filter(m => m.id !== id));
            fetchMemories();
        } catch (e) {
            console.error('Failed to delete memory:', e);
            alert(lang === 'en' ? 'Failed to connect to the server while deleting memory.' : '删除记忆时无法连接服务器。');
        }
    };

    return (
        <div className="drawer-container memory-drawer memory-table-drawer">
            <div className="memory-header">
                <h3>{contact.name} {lang === 'en' ? "'s Memories" : '的记忆'}</h3>
            </div>

            <div className="memory-content">
                {loading ? (
                    <p className="loading-text">
                        {lang === 'en' ? 'Loading memories...' : '加载记忆中...'}
                    </p>
                ) : memories.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                        <p>{t('No memories yet')}</p>
                        <p style={{ fontSize: '12px', marginTop: '10px' }}>
                            {lang === 'en'
                                ? 'Long-term memories are handled by the memory library and overflow summary flow.'
                                : '长期记忆由记忆库和溢出总结流程统一管理。'}
                        </p>
                    </div>
                ) : (
                    <div className="memory-list">
                        {memories.map(mem => (
                            <div key={mem.id} className="memory-card">
                                <div className="memory-card-header">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span className="memory-time">{new Date(mem.created_at).toLocaleString()}</span>
                                        {(mem.last_retrieved_at || mem.retrieval_count > 0) && (
                                            <span style={{ fontSize: '10px', color: 'var(--accent-color)', fontWeight: 600 }}>
                                                {lang === 'en'
                                                    ? `Recently used ${mem.retrieval_count || 0} times`
                                                    : `最近被调用 ${mem.retrieval_count || 0} 次`}
                                                {mem.last_retrieved_at
                                                    ? ` · ${lang === 'en' ? 'Last used' : '最后调用'} ${new Date(mem.last_retrieved_at).toLocaleString()}`
                                                    : ''}
                                            </span>
                                        )}
                                    </div>
                                    <button className="icon-btn danger" onClick={() => handleDelete(mem.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="memory-card-body">
                                    <div style={{ fontWeight: 700, color: 'var(--accent-color)', lineHeight: 1.5 }}>
                                        {mem.summary || mem.event || mem.content}
                                    </div>
                                    {mem.event && mem.summary !== mem.event && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#888', lineHeight: 1.5 }}>
                                            <strong>{lang === 'en' ? 'Internal tag' : '内部标签'}:</strong> {mem.event}
                                        </div>
                                    )}
                                    {mem.content && mem.content !== mem.summary && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', lineHeight: 1.6 }}>
                                            {mem.content}
                                        </div>
                                    )}
                                </div>
                                {(mem.time || mem.location || mem.people || mem.source_time_text) && (
                                    <div className="memory-card-footer">
                                        {mem.source_time_text && <span>🕒 {mem.source_time_text}</span>}
                                        {mem.time && <span>🕒 {mem.time}</span>}
                                        {mem.location && <span>📍 {mem.location}</span>}
                                        {mem.people && <span>👥 {mem.people}</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MemoTable;

