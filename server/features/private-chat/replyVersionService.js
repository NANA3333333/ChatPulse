const { createHash } = require('node:crypto');
const { createOperation } = require("../../platform/logging/operation");
const { replyError } = require("./errors");

function createReplyVersionService({ repository, runtime, queueTask, generateReply, userId }) {
    const inFlight = new Set();
    const historyRevision = characterId => createHash('sha256')
        .update(JSON.stringify(repository.getVisibleMessages(characterId, 0).map(row => [row.id, row.content])))
        .digest('hex');

    return async function changeReplyVersion(characterId, messageId, options = {}) {
        const { version, revision, reroll = false, notify = () => {}, onStart = () => {}, onFinish = () => {} } = options;
        const operation = options.operation || createOperation({
            feature: 'private-chat', action: reroll ? 'reroll' : 'version', entityId: messageId, userId
        });
        let locked = false;
        let completed = false;
        let failure = null;
        try {
            const originalHistory = operation.step('validate', () => {
                if (inFlight.has(characterId) || runtime.isBusy(characterId)) {
                    throw replyError('角色正在回复，请等待当前生成完成。', 409, 'REPLY_BUSY');
                }
                const initialRun = repository.getRun(characterId, messageId);
                if (initialRun.revision !== revision) throw replyError('回复版本已改变，请刷新后重试。', 409, 'REPLY_VERSION_CONFLICT');
                const fingerprint = historyRevision(characterId);
                inFlight.add(characterId);
                locked = true;
                return fingerprint;
            });
            operation.record('queue', 'queued');
            const result = await queueTask(`char:${characterId}`, async () => {
                operation.record('queue', 'running');
                const assertUnchanged = () => {
                    if (historyRevision(characterId) !== originalHistory
                        || repository.getRun(characterId, messageId).revision !== revision
                        || runtime.hasPendingUserReply(characterId)) {
                        throw replyError('对话已更新，本次操作已取消，当前回复已保留。', 409, 'REPLY_HISTORY_CHANGED');
                    }
                };
                const { character, run } = operation.step('load_context', () => {
                    const character = repository.getCharacter(characterId);
                    if (!character) throw replyError('角色不存在。', 404, 'CHARACTER_NOT_FOUND');
                    if (reroll && (character.status !== 'active' || character.is_blocked)) {
                        throw replyError('角色当前不可回复。', 409, 'CHARACTER_UNAVAILABLE');
                    }
                    const run = repository.getRun(characterId, messageId);
                    assertUnchanged();
                    return { character, run };
                });
                let content = null;
                if (reroll) {
                    operation.step('prepare_generation', () => onStart(operation.runId));
                    content = await generateReply({ character, run, messageId, assertUnchanged, operation, notify });
                }
                const update = operation.step('save', () => {
                    if (reroll) {
                        const fresh = repository.getCharacter(characterId);
                        if (!fresh || fresh.status !== 'active' || fresh.is_blocked) {
                            throw replyError('角色状态已变化，已保留原回复。', 409, 'CHARACTER_UNAVAILABLE');
                        }
                    }
                    assertUnchanged();
                    return { ...repository.select(characterId, messageId, version, revision, content), runId: operation.runId };
                }, 'REPLY_SAVE_FAILED');
                completed = true;
                try {
                    operation.step('notify', () => notify({ type: 'private_reply_updated', data: update }), 'REPLY_NOTIFY_FAILED');
                } catch {
                    // The transaction has committed. Return its result instead of inviting another model call.
                    update.notificationWarning = 'REPLY_NOTIFY_FAILED';
                }
                return update;
            }, { dedupeKey: `reply-version:${characterId}`, maxPending: 1, trace: operation.context });
            if (result?.skipped) throw replyError('角色任务繁忙，请稍后重试。', 409, 'REPLY_QUEUE_BUSY');
            return result;
        } catch (error) {
            failure = error;
            error.runId = operation.runId;
            error.code ||= 'REPLY_OPERATION_FAILED';
            throw error;
        } finally {
            if (locked) {
                inFlight.delete(characterId);
                if (reroll) {
                    try { operation.step('runtime_cleanup', () => onFinish(completed), 'REPLY_CLEANUP_FAILED'); }
                    catch { /* Preserve the original failure or committed result. */ }
                }
            }
            operation.finish(failure);
        }
    };
}

module.exports = { createReplyVersionService };
