// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function createAuthError(message, statusCode = 401) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getRequestAuthMeta(req) {
    return {
        ip: req.ip || req.socket?.remoteAddress || '',
        userAgent: String(req.get?.('user-agent') || '').slice(0, 500)
    };
}

function issueAuthToken(user, req) {
    const session = dependencies.authDb.createSession(user.id, getRequestAuthMeta(req));
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role || 'user',
        tokenVersion: user.tokenVersion ?? user.token_version ?? 0,
        sessionId: session.sessionId,
        jti: session.tokenId
    };
    const token = dependencies.jwt.sign(payload, dependencies.JWT_SECRET, { expiresIn: dependencies.AUTH_TOKEN_TTL });
    return { token, session };
}

function verifyAuthToken(token) {
    if (!token) throw createAuthError('Unauthorized');
    const decoded = dependencies.jwt.verify(token, dependencies.JWT_SECRET);
    const authUser = dependencies.authDb.getUserById(decoded.id);
    if (!authUser) throw createAuthError('Invalid token');
    if (authUser.status === 'banned') throw createAuthError('Account banned', 403);
    if (Number(decoded.tokenVersion ?? 0) !== Number(authUser.token_version ?? 0)) {
        throw createAuthError('Session expired');
    }
    if (!decoded.sessionId || !decoded.jti || !dependencies.authDb.verifySession(authUser.id, decoded.sessionId, decoded.jti)) {
        throw createAuthError('Session expired');
    }
    return {
        decoded,
        authUser,
        user: {
            id: authUser.id,
            username: authUser.username,
            role: authUser.role || decoded.role || 'user',
            status: authUser.status || 'active',
            created_at: Number(authUser.created_at || 0),
            tokenVersion: authUser.token_version || 0,
            sessionId: decoded.sessionId
        }
    };
}

    return { createAuthError, getRequestAuthMeta, issueAuthToken, verifyAuthToken };
}

module.exports = { createModule };
