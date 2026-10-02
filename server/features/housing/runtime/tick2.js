// Scheduled housing work. Registration and timer ownership remain in index.js.
function createTick(dependencies) { return async () => {
        const users = typeof dependencies.authDb.getAllUsers === 'function'
            ? dependencies.filterAutomationUsers(dependencies.authDb.getAllUsers(), Date.now())
            : [];
        for (const user of users) {
            try {
                const db = dependencies.getUserDb(user.id);
                const results = await dependencies.settleDueRentsForDb(db, { userId: user.id });
                if (!results.some((item) => item?.success)) continue;
                const wsClients = dependencies.getWsClients(user.id);
                wsClients?.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ type: 'refresh_contacts' }));
                        client.send(JSON.stringify({ type: 'city_update', action: 'rent-settled' }));
                    }
                });
            } catch (e) {
                console.warn('[SocialHousing] rent settlement failed:', e.message);
            }
        }
    }; }
module.exports = { createTick };
