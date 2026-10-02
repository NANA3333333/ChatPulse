// DELETE /api/social-housing/classes/:id
function register(dependencies) {
dependencies.app.delete('/api/social-housing/classes/:id', require("../../../platform/http/trace.js").traceHttp("housing", "DELETE /api/social-housing/classes/:id"), dependencies.authMiddleware, (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const deleted = socialHousingDb.deleteClass(req.params.id);
            if (!deleted) {
                return res.status(404).json({ success: false, error: '阶层不存在' });
            }
            res.json({ success: true, classes: socialHousingDb.getClasses() });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
