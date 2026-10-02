// POST /api/social-housing/characters/:id/assign-home
function register(dependencies) {
dependencies.app.post('/api/social-housing/characters/:id/assign-home', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/characters/:id/assign-home"), dependencies.authMiddleware, async (req, res) => {
        try {
            const homeId = String(req.body?.home_id || req.body?.housing_id || '').trim();
            if (!homeId) {
                return res.status(400).json({ success: false, error: '缺少指派房源' });
            }
            const result = await dependencies.rentalChainService.assignHomeToCharacter({
                db: req.db,
                userId: req.user.id,
                characterId: req.params.id,
                homeId
            });
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const wsClients = dependencies.getWsClients(req.user.id);
            wsClients?.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'refresh_contacts' }));
                    client.send(JSON.stringify({ type: 'city_update', action: 'social-housing-assigned', character_id: req.params.id }));
                }
            });
            res.json({
                success: true,
                ...result,
                characters: result.characters || dependencies.redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters()))
            });
        } catch (e) {
            const status = Number(e.status || e.statusCode || 500);
            res.status(status >= 400 && status < 600 ? status : 500).json({
                success: false,
                error: e.message || '指派住房失败，请重试',
                can_retry: e.canRetry !== false
            });
        }
    });
}
module.exports = { register };
