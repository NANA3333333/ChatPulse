// GET /api/social-housing/bootstrap
function register(dependencies) {
dependencies.app.get('/api/social-housing/bootstrap', require("../../../platform/http/trace.js").traceHttp("housing", "GET /api/social-housing/bootstrap"), dependencies.authMiddleware, (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const cityDb = dependencies.ensureCityDb(req.db);
            dependencies.cleanupOrphanAgencyArtifacts(socialHousingDb, cityDb);
            const publicAgencyAnnouncements = dependencies.getPublicAgencyAnnouncements(cityDb, 50);
            const rentalChains = socialHousingDb.getRentalChains ? socialHousingDb.getRentalChains(20) : [];
            res.json({
                success: true,
                classes: socialHousingDb.getClasses(),
                housing_tiers: socialHousingDb.getHousingTiers(),
                characters: dependencies.redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters())),
                districts: cityDb.getDistricts ? cityDb.getDistricts() : [],
                agency_model_options: dependencies.getAgencyModelOptions(req.db),
                agency: dependencies.redactAgencyConfig(socialHousingDb.getAgencyConfig()),
                agency_ads: dependencies.getAgencyAdsWithPublishState(socialHousingDb, cityDb, 12),
                rental_chains: rentalChains,
                rental_chain_events: dependencies.getRentalChainEventMap(socialHousingDb, rentalChains),
                public_agency_announcements: publicAgencyAnnouncements
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
