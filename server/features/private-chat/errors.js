function replyError(message, status = 409, code = 'REPLY_CONFLICT') {
    return Object.assign(new Error(message), { status, code });
}

module.exports = { replyError };
