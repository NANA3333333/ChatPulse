// POST /api/social-housing/agency/publish-ad
function register(dependencies) {
dependencies.app.post('/api/social-housing/agency/publish-ad', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/agency/publish-ad"), dependencies.authMiddleware, async (req, res) => {
        try {
            const ad = await dependencies.publishAgencyAdForDb(req.db, 'manual');
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const wsClients = dependencies.getWsClients(req.user.id);
            wsClients?.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'city_update', action: 'social-housing-ad', message: ad.content }));
                }
            });
            res.json({
                success: true,
                ad,
                agency: dependencies.redactAgencyConfig(socialHousingDb.getAgencyConfig()),
                agency_ads: dependencies.getAgencyAdsWithPublishState(socialHousingDb, dependencies.ensureCityDb(req.db), 12)
            });
        } catch (e) {
            try {
                const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
                const current = socialHousingDb.getAgencyConfig();
                socialHousingDb.saveAgencyConfig({
                    ...current,
                    last_error: String(e.message || '中介所 AI 执行失败'),
                    last_error_at: Date.now()
                });
            } catch (_) { /* ignore */ }
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
