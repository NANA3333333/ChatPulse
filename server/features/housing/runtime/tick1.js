// Scheduled housing work. Registration and timer ownership remain in index.js.
function createTick(dependencies) { return async () => {
        const users = typeof dependencies.authDb.getAllUsers === 'function'
            ? dependencies.filterAutomationUsers(dependencies.authDb.getAllUsers(), Date.now())
            : [];
        for (const user of users) {
            try {
                const db = dependencies.getUserDb(user.id);
                const socialHousingDb = dependencies.ensureSocialHousingDb(db);
                const config = socialHousingDb.getAgencyConfig();
                if (Number(config.enabled || 0) !== 1 || Number(config.ad_enabled || 0) !== 1) continue;

                const now = Date.now();
                const intervalMinutes = dependencies.normalizeAgencyIntervalMinutes(config.decision_interval_hours);
                if (Number(config.next_ad_at || 0) <= 0) {
                    socialHousingDb.saveAgencyConfig({
                        ...config,
                        ad_min_interval_minutes: intervalMinutes,
                        ad_max_interval_minutes: intervalMinutes,
                        next_ad_at: now + intervalMinutes * 60 * 1000
                    });
                    continue;
                }
                if (Number(config.next_ad_at || 0) > now) continue;

                await dependencies.publishAgencyAdForDb(db, 'auto');
                const wsClients = dependencies.getWsClients(user.id);
                wsClients?.forEach((client) => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ type: 'city_update', action: 'social-housing-ad' }));
                    }
                });
            } catch (e) {
                try {
                    const db = dependencies.getUserDb(user.id);
                    const socialHousingDb = dependencies.ensureSocialHousingDb(db);
                    const current = socialHousingDb.getAgencyConfig();
                    socialHousingDb.saveAgencyConfig({
                        ...current,
                        last_error: String(e.message || '中介所 AI 自动执行失败'),
                        last_error_at: Date.now()
                    });
                } catch (_) { /* ignore */ }
            }
        }
    }; }
module.exports = { createTick };
