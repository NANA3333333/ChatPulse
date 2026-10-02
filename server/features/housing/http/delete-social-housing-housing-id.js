// DELETE /api/social-housing/housing/:id
function register(dependencies) {
dependencies.app.delete('/api/social-housing/housing/:id', require("../../../platform/http/trace.js").traceHttp("housing", "DELETE /api/social-housing/housing/:id"), dependencies.authMiddleware, (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const cityDb = dependencies.ensureCityDb(req.db);
            const housingList = socialHousingDb.getHousingTiers() || [];
            const removedHome = housingList.find((item) => String(item.id) === String(req.params.id)) || null;
            const deleted = socialHousingDb.deleteHousing(req.params.id);
            if (!deleted || !removedHome) {
                return res.status(404).json({ success: false, error: '房屋不存在' });
            }
            const removedAgencyAds = removedHome ? dependencies.removeAgencyArtifactsForHome(socialHousingDb, cityDb, removedHome) : 0;
            res.json({
                success: true,
                removed_agency_ads: removedAgencyAds,
                housing_tiers: socialHousingDb.getHousingTiers(),
                agency_ads: dependencies.getAgencyAdsWithPublishState(socialHousingDb, cityDb, 12)
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
