import React from 'react';
import AuthenticatedImage from './AuthenticatedImage';
import { defaultAvatarUrl, resolveAvatarUrl } from '../utils/avatar';

function ContactList({ apiUrl, contacts, activeId, onSelect, engineState = {} }) {
    return (
        <>
            {contacts.map((contact) => {
                const state = engineState[contact.id];
                const countdown = state?.countdownMs ? Math.ceil(state.countdownMs / 1000) : null;
                const isWorking = !!(state?.isThinking || state?.webSearchActive);
                const statusText = countdown ? `${countdown}s` : contact.time;

                return (
                    <div
                        key={contact.id}
                        className={`contact-item ${activeId === contact.id ? 'active' : ''}`}
                        onClick={() => onSelect(contact.id)}
                    >
                        <div className="contact-avatar" style={{ position: 'relative' }}>
                            <AuthenticatedImage
                                src={resolveAvatarUrl(contact.avatar, apiUrl, contact.name || contact.id || 'User')}
                                alt={contact.name}
                                style={{ objectFit: 'cover' }}
                                fallbackSrc={defaultAvatarUrl(contact.name || contact.id || 'User')}
                            />
                            <div className={`autopulse-status-dot ${isWorking ? 'thinking' : 'connected'}`} />
                        </div>
                        <div className="contact-info">
                            <div className="contact-header">
                                <span
                                    className="contact-name"
                                    style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center' }}
                                >
                                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {contact.name}
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
