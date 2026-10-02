const { replyError } = require("./errors");

// This service owns message use cases. The composition root supplies the current
// user's database and engine; importing the feature never starts either one.
function createMessageService({ db, runtime = {} }) {
    function requireCharacter(characterId) {
        const character = db.getCharacter(characterId);
        if (!character) throw replyError('Character not found', 404, 'CHARACTER_NOT_FOUND');
        return character;
    }

    function history(characterId, query, operation) {
        operation.step('validate', () => requireCharacter(characterId));
        const messages = operation.step('read', () => {
            if (query.around) return db.getMessagesAround(characterId, query.around, query.limit);
            if (query.before) return db.getMessagesBefore(characterId, query.before, query.limit);
            if (query.after) return db.getMessagesAfter(characterId, query.after, query.limit);
            return db.getMessages(characterId, query.limit);
        }, 'MESSAGE_READ_FAILED');
        if (!query.around && !query.before && !query.after) {
            // Unread bookkeeping must not prevent access to saved history.
            try { operation.step('mark_read', () => db.markMessagesRead(characterId), 'MESSAGE_MARK_READ_FAILED'); } catch { /* Logged by step. */ }
        }
        return messages;
    }

    function send({ characterId, content }, operation) {
        const character = operation.step('validate', () => requireCharacter(characterId));
        if (!character.is_blocked) {
            operation.step('city_busy', () => runtime.applyCityBusyPatch?.(character), 'MESSAGE_CITY_PATCH_FAILED');
        }
        const savedMessage = operation.step('save', () => {
            const { id, timestamp } = db.saveUserMessage(characterId, content);
            return { id, character_id: characterId, role: 'user', content, timestamp,
                ...(character.is_blocked ? { isBlocked: true } : {}), runId: operation.runId };
        }, 'MESSAGE_SAVE_FAILED');

        // Once saved, a notification/dispatch failure must not invite a duplicate
        // send. Return the saved message and identify any incomplete side effect.
        const warnings = [];
        const attempt = (stage, task, code) => {
            try { operation.step(stage, task, code); } catch { warnings.push(code); }
        };
        if (!character.is_blocked) attempt('mark_read', () => db.markMessagesRead(characterId), 'MESSAGE_MARK_READ_FAILED');
        attempt('notify', () => runtime.notifyMessage(savedMessage), 'MESSAGE_NOTIFY_FAILED');
        if (!character.is_blocked) {
            attempt('dispatch', () => runtime.handleUserMessage(characterId, {
                triggerSource: 'api_messages', triggerRoute: 'POST /api/messages',
                requestId: operation.runId, trace: operation.context, triggerNote: 'primary user send'
            }), 'MESSAGE_REPLY_DISPATCH_FAILED');
            attempt('jealousy', () => runtime.triggerJealousyCheck(characterId), 'MESSAGE_JEALOUSY_FAILED');
        }
        return { success: true, ...(character.is_blocked ? { blocked: true } : {}), message: savedMessage,
            ...(warnings.length ? { warnings } : {}) };
    }

    function retry(characterId, { failedMessageId }, operation) {
        operation.step('validate', () => requireCharacter(characterId));
        const retryEvent = operation.step('retry_context', () => {
            if (!failedMessageId) return null;
            const failed = db.getMessages(characterId, 200).find(msg => String(msg.id) === String(failedMessageId));
            if (failed) db.deleteMessage(failed.id, characterId);
            return failed?.metadata?.systemEventReply || null;
        }, 'MESSAGE_RETRY_CONTEXT_FAILED');
        const options = {
            triggerRoute: 'POST /api/messages/:characterId/retry',
            requestId: operation.runId, trace: operation.context
        };
        if (retryEvent?.extraSystemDirective) {
            // Dispatch is acknowledged immediately. The existing engine owns the
            // asynchronous generation lifecycle and records request_id separately.
            const pending = operation.step('dispatch', () => {
                const result = runtime.triggerImmediateUserReply(characterId, {
                    ...options, useRetryResume: false,
                    extraSystemDirective: retryEvent.extraSystemDirective,
                    extraDirectiveRole: retryEvent.extraDirectiveRole || 'system',
                    eventUserDirective: retryEvent.eventUserDirective || '', markSystemEventReply: false,
                    triggerSource: 'api_retry_system_event',
                    triggerNote: failedMessageId ? `retry_system_event_message_${failedMessageId}` : 'retry_system_event',
                    skipTopicSwitchGate: !!retryEvent.skipTopicSwitchGate,
                    skipContextModuleRouting: !!retryEvent.skipContextModuleRouting
                });
                return { completion: result };
            }, 'MESSAGE_REPLY_DISPATCH_FAILED');
            Promise.resolve(pending.completion).catch(() => operation.record('background_reply', 'failed', {
                errorCode: 'MESSAGE_BACKGROUND_REPLY_FAILED'
            }));
            return { success: true, retriedSystemEvent: true };
        }
        operation.step('dispatch', () => runtime.handleUserMessage(characterId, {
            ...options, useRetryResume: true, triggerSource: 'api_retry',
            triggerNote: failedMessageId ? `retry_failed_message_${failedMessageId}` : 'retry_without_failed_message_id'
        }), 'MESSAGE_REPLY_DISPATCH_FAILED');
        return { success: true };
    }

    function deleteMessages({ messageIds, characterId }, operation) {
        const deleted = operation.step('delete', () => {
            const affected = new Set();
            let count = 0;
            for (const id of messageIds) {
                const owner = db.getMessageCharacterId(id);
                if (!owner || (characterId && String(owner) !== characterId)) continue;
                const changes = db.deleteMessage(id, owner);
                if (changes > 0) { affected.add(owner); count += changes; }
            }
            for (const id of affected) db.clearCharacterMessageCaches(id);
            return count;
        }, 'MESSAGE_DELETE_FAILED');
        return { success: true, deleted };
    }

    function clear(characterId, operation) {
        operation.step('validate', () => requireCharacter(characterId));
        operation.step('delete', () => db.clearMessages(characterId), 'MESSAGE_CLEAR_FAILED');
        return { success: true };
    }

    return { history, send, retry, deleteMessages, clear };
}

module.exports = { createMessageService };
