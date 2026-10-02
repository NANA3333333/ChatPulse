// POST /api/social-housing/housing
function register(dependencies) {
dependencies.app.post('/api/social-housing/housing', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/housing"), dependencies.authMiddleware, (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const payload = dependencies.normalizeHousingPayload(req.body || {});
            if (!String(payload.name || '').trim()) {
                return res.status(400).json({ success: false, error: '缺少房子名称' });
            }
            const id = socialHousingDb.upsertHousing(payload);
            res.json({ success: true, id, housing_tiers: socialHousingDb.getHousingTiers() });
        } catch (e) {
            dependencies.sendSocialHousingError(res, e);
        }
    });
}
module.exports = { register };
