// POST /api/social-housing/characters/:id/binding
function register(dependencies) {
dependencies.app.post('/api/social-housing/characters/:id/binding', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/characters/:id/binding"), dependencies.authMiddleware, (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const character = req.db.getCharacter(req.params.id);
            if (!character) {
                return res.status(404).json({ success: false, error: '角色不存在' });
            }
            const rawPayload = req.body || {};
            const currentBinding = socialHousingDb.getBinding(req.params.id);
            const targetHome = socialHousingDb.getHousingById(String(rawPayload.housing_id || '').trim());
            const payload = dependencies.normalizeHousingBindingPayload(rawPayload, currentBinding, targetHome);
            socialHousingDb.saveBinding(req.params.id, payload);
            res.json({
                success: true,
                characters: dependencies.redactSocialHousingCharacterSecrets(socialHousingDb.getCharactersWithBindings(() => req.db.getCharacters())),
                housing_context: socialHousingDb.getHousingContextForCharacter(req.params.id)
            });
        } catch (e) {
            dependencies.sendSocialHousingError(res, e);
        }
    });
}
module.exports = { register };
