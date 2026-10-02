// POST /api/social-housing/characters/:id/pay-rent
function register(dependencies) {
dependencies.app.post('/api/social-housing/characters/:id/pay-rent', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/characters/:id/pay-rent"), dependencies.authMiddleware, async (req, res) => {
        try {
            const character = req.db.getCharacter(req.params.id);
            if (!character) {
                return res.status(404).json({ success: false, error: '角色不存在' });
            }
            const result = await dependencies.settleCharacterRent(req.db, character.id, {
                manual: true,
                notifyPrivate: true,
                userId: req.user.id
            });
            if (!result.success) {
                return res.status(400).json({ success: false, error: result.reason || '房租结算失败' });
            }
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const wsClients = dependencies.getWsClients(req.user.id);
            wsClients?.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({ type: 'refresh_contacts' }));
                    client.send(JSON.stringify({ type: 'city_update', action: 'rent-settled', character_id: character.id }));
                }
            });
            res.json({
                success: true,
                result,
                characters: dependencies.redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters()))
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
