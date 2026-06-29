import React from 'react';
import AvatarWithFrame from './AvatarWithFrame';
import { defaultAvatarUrl, resolveAvatarUrl } from '../utils/avatar';

function hasPrimaryModelConfig(contact = {}) {
    return !!(
        String(contact.api_endpoint || '').trim()
        && contact.api_key_configured === true
        && String(contact.model_name || '').trim()
    );
}

function ContactList({ apiUrl, contacts, activeId, onSelect, engineState = {} }) {
    return (
        <>
            {contacts.map((contact) => {
                const state = engineState[contact.id];
                const countdown = state?.countdownMs ? Math.ceil(state.countdownMs / 1000) : null;
                const isOnline = hasPrimaryModelConfig(contact);
                const isWorking = isOnline && !!(state?.isThinking || state?.webSearchActive);
                const statusText = countdown ? `${countdown}s` : contact.time;
                const modelStatusText = isOnline ? '在线' : '离线';

                return (
                    <div
                        key={contact.id}
                        className={`contact-item ${activeId === contact.id ? 'active' : ''} ${isOnline ? 'is-online' : 'is-offline'}`}
                        onClick={() => onSelect(contact.id)}
                    >
                        <div className="contact-avatar" style={{ position: 'relative' }}>
                            <AvatarWithFrame
                                size={42}
                                frame={contact.avatar_frame}
                                src={resolveAvatarUrl(contact.avatar, apiUrl, contact.name || contact.id || 'User')}
                                alt={contact.name}
                                fallbackSrc={defaultAvatarUrl(contact.name || contact.id || 'User')}
                            />
                            <div className={`autopulse-status-dot ${isWorking ? 'thinking' : (isOnline ? 'connected' : 'offline')}`} />
                        </div>
                        <div className="contact-info">
                            <div className="contact-header">
                                <span className="contact-name">
                                    <span className="contact-name__text">
                                        {contact.name}
                                    </span>
                                    <span className={`contact-model-status ${isOnline ? 'online' : 'offline'}`}>
                                        <span className="contact-model-status__dot" />
                                        <span>{modelStatusText}</span>
                                    </span>
                                </span>
                                <span
                                    className="contact-time"
                                    style={{
                                        color: countdown ? 'var(--accent-color)' : undefined,
                                        fontWeight: countdown ? 'bold' : 'normal',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        marginLeft: '8px'
                                    }}
                                >
                                    {statusText}
                                </span>
                            </div>
                            <div className="contact-last-msg">
                                {contact.lastMessage}
                                {contact.unread > 0 && <span className="unread-badge">{contact.unread}</span>}
                                {state?.isBlocked === 1 && (
                                    <span style={{ marginLeft: 5, color: 'var(--danger)', fontSize: '11px' }} title="Blocked">
                                        已拉黑
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </>
    );
}

export default ContactList;
