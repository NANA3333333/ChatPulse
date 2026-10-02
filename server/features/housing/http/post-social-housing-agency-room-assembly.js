// POST /api/social-housing/agency/room-assembly
function register(dependencies) {
dependencies.app.post('/api/social-housing/agency/room-assembly', require("../../../platform/http/trace.js").traceHttp("housing", "POST /api/social-housing/agency/room-assembly"), dependencies.authMiddleware, async (req, res) => {
        try {
            const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
            const config = socialHousingDb.getAgencyConfig();
            const aiChar = dependencies.resolveAgencyAiChar(req.db, config);
            const assembly = await dependencies.generateAgencyRoomAssembly({
                callLLM: dependencies.callLLM,
                db: req.db,
                config,
                aiChar,
                home: req.body?.home || {},
                palette: req.body?.palette || {},
                furniture: req.body?.furniture || [],
                budget: req.body?.budget || 0,
                room: req.body?.room || {}
            });
            res.json({
                success: true,
                assembly,
                agency: dependencies.redactAgencyConfig(socialHousingDb.getAgencyConfig())
            });
        } catch (e) {
            try {
                const socialHousingDb = dependencies.ensureSocialHousingDb(req.db);
                const current = socialHousingDb.getAgencyConfig();
                socialHousingDb.saveAgencyConfig({
                    ...current,
                    last_error: String(e.message || '房间组装 AI 执行失败'),
                    last_error_at: Date.now()
                });
            } catch (_) { /* ignore */ }
            res.status(500).json({ success: false, error: e.message });
        }
    });
}
module.exports = { register };
