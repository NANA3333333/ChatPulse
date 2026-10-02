const AUTOMATION_IDLE_LOGIN_GRACE_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getAutomationIdleLoginGraceMs() {
    const configuredDays = Number(process.env.CP_AUTOMATION_IDLE_LOGIN_GRACE_DAYS || AUTOMATION_IDLE_LOGIN_GRACE_DAYS);
    const safeDays = Number.isFinite(configuredDays) && configuredDays > 0
        ? configuredDays
        : AUTOMATION_IDLE_LOGIN_GRACE_DAYS;
    return safeDays * MS_PER_DAY;
}

function getUserLastLoginAt(user = {}) {
    const value = Number(user.last_login_at || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function getUserLastActiveAt(user = {}) {
    const value = Number(user.last_active_at || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function getUserAutomationActivityAt(user = {}) {
    const lastLoginAt = getUserLastLoginAt(user);
    const lastActiveAt = getUserLastActiveAt(user);
    return Math.max(lastLoginAt, lastActiveAt);
}

function isUserAutomationEligible(user = {}, now = Date.now()) {
    if (!user?.id) return false;
    if (String(user.status || 'active') !== 'active') return false;
    const lastActivityAt = getUserAutomationActivityAt(user);
    if (!lastActivityAt) return false;
    return Number(now || Date.now()) - lastActivityAt <= getAutomationIdleLoginGraceMs();
}

function filterAutomationUsers(users = [], now = Date.now()) {
    return (Array.isArray(users) ? users : []).filter(user => isUserAutomationEligible(user, now));
}

module.exports = {
    AUTOMATION_IDLE_LOGIN_GRACE_DAYS,
    getAutomationIdleLoginGraceMs,
    getUserAutomationActivityAt,
    getUserLastActiveAt,
    getUserLastLoginAt,
    isUserAutomationEligible,
    filterAutomationUsers
};
