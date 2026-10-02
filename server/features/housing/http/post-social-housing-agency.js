// POST /api/social-housing/agency
function register(dependencies) {
dependencies.app.post('/api/social-housing/agency', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/agency"), dependencies.authMiddleware, (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const current = socialHousingDb.getAgencyConfig();
            const payload = dependencies.normalizeAgencyConfigPayload({
                ...current,
                ...dependencies.preserveAgencySecretPatch(req.body || {}, current)
            }, current);
            const saved = socialHousingDb.saveAgencyConfig(payload);
            res.json({ success: true, agency: dependencies.redactAgencyConfig(saved) });
        } catch (e) {
            dependencies.sendSocialHousingError(res, e);
        }
    });
}
module.exports = { register };
