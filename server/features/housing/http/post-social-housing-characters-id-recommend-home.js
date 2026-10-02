// POST /api/social-housing/characters/:id/recommend-home
function register(dependencies) {
dependencies.app.post('/api/social-housing/characters/:id/recommend-home', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/characters/:id/recommend-home"), dependencies.authMiddleware, async (req, res) => {
        try {
            const homeId = String(req.body?.home_id || req.body?.housing_id || '').trim();
            if (!homeId) {
                return res.status(400).json({ success: false, error: '缺少推荐房源' });
            }
            const result = await dependencies.rentalChainService.recommendHomeToCharacter({
                db: req.db,
                userId: req.user.id,
                characterId: req.params.id,
                homeId,
                agencyAdId: Number(req.body?.agency_ad_id || 0),
                runFullChain: req.body?.run_full_chain !== false
            });
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const cityDb = dependencies.ensureCityDb(req.db);
            const wsClients = dependencies.getWsClients(req.user.id);
            wsClients?.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'refresh_contacts' }));
                    client.send(JSON.stringify({ type: 'city_update', action: 'social-housing-rental-chain', character_id: req.params.id }));
                }
            });
            const rentalChains = socialHousingDb.getRentalChains ? socialHousingDb.getRentalChains(20) : [];
            res.json({
                success: true,
                outcome: result.outcome,
                chain: result.chain,
                chain_events: socialHousingDb.getRentalChainEvents ? socialHousingDb.getRentalChainEvents(result.chain?.id) : [],
                characters: dependencies.redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters())),
                rental_chains: rentalChains,
                rental_chain_events: dependencies.getRentalChainEventMap(socialHousingDb, rentalChains),
                agency_ads: dependencies.getAgencyAdsWithPublishState(socialHousingDb, cityDb, 12)
            });
        } catch (e) {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const status = Number(e.status || e.statusCode || 500);
            const rentalChains = socialHousingDb.getRentalChains ? socialHousingDb.getRentalChains(20) : [];
            res.status(status >= 400 && status < 600 ? status : 500).json({
                success: false,
                error: e.message || '租房链路失败，请重试',
                can_retry: e.canRetry !== false,
                chain: e.chain || null,
                rental_chains: rentalChains,
                rental_chain_events: dependencies.getRentalChainEventMap(socialHousingDb, rentalChains)
            });
        }
    });
}
module.exports = { register };
