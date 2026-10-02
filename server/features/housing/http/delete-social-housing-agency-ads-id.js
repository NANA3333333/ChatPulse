// DELETE /api/social-housing/agency/ads/:id
function register(dependencies) {
dependencies.app.delete('/api/social-housing/agency/ads/:id', require("../../../platform/http/trace.js").traceHttp("housing", "DELETE /api/social-housing/agency/ads/:id"), dependencies.authMiddleware, (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const cityDb = dependencies.ensureCityDb(req.db);
            const ad = socialHousingDb.getAgencyAdById(req.params.id);
            if (!ad) {
                return res.status(404).json({ success: false, error: '中介广告记录不存在' });
            }

            const deleted = socialHousingDb.deleteAgencyAd(req.params.id);
            if (!deleted) {
                return res.status(404).json({ success: false, error: '中介广告记录不存在' });
            }
            dependencies.removeAgencyArtifacts(cityDb, ad.title, ad.content);
            res.json({
                success: true,
                agency_ads: dependencies.getAgencyAdsWithPublishState(socialHousingDb, cityDb, 12)
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
