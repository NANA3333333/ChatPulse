import { normalizeMessages } from "./messages";

export const PRIVATE_REPLY_UPDATED = 'private_reply_updated';

export function dispatchReplyUpdate(update, source = 'http') {
    window.dispatchEvent(new CustomEvent(PRIVATE_REPLY_UPDATED, { detail: update }));
    if (update?.runId) console.debug('[private-chat]', { runId: update.runId, stage: 'update_received', source });
}

export function subscribeToReplyUpdates(handler) {
    const listener = event => handler(event.detail);
    window.addEventListener(PRIVATE_REPLY_UPDATED, listener);
    return () => window.removeEventListener(PRIVATE_REPLY_UPDATED, listener);
}

export function mergeReplyUpdate(messages, update) {
    const removed = new Set((update.removedIds || []).map(String));
    const current = messages.find(message => String(message.id) === String(update.message.id));
    if (!current && !messages.some(message => removed.has(String(message.id)))) return messages;
    if (Number(current?.metadata?.replyVersion?.revision || 0) > update.message.metadata.replyVersion.revision) return messages;
    return normalizeMessages([...messages.filter(message => !removed.has(String(message.id))
        && String(message.id) !== String(update.message.id)), update.message]);
}
