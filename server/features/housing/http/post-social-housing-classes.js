// POST /api/social-housing/classes
function register(dependencies) {
dependencies.app.post('/api/social-housing/classes', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/classes"), dependencies.authMiddleware, (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const payload = dependencies.normalizeSocialClassPayload(req.body || {});
            const id = socialHousingDb.upsertClass(payload);
            res.json({ success: true, id, classes: socialHousingDb.getClasses() });
        } catch (e) {
            dependencies.sendSocialHousingError(res, e);
        }
    });
}
module.exports = { register };
