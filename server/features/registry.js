// Startup order preserves the former plugin loader's order. Only these modules run.
const registrations = [
    ['admin', require('./admin')],
    ['backup', require('./backup')],
    ['city', require('./city')],
    ['economy', require('./economy')],
    ['group-chat', require('./group-chat')],
    ['web-tools', require('./web-tools')],
    ['relationships', require('./relationships')],
    ['scheduler', require('./scheduler')],
    ['housing', require('./housing')]
];

function registerFeatures(app, context) {
    const registered = [];
    const failures = [];
    for (const [id, register] of registrations) {
        try {
            register(app, context);
            registered.push(id);
            console.log(`[Feature] Registered ${id}`);
        } catch (error) {
            failures.push({ feature: id, error });
            console.error(`[Feature] Failed to register ${id}:`, error);
        }
    }
    return { registered, failures };
}

module.exports = { registerFeatures, featureIds: registrations.map(([id]) => id) };
