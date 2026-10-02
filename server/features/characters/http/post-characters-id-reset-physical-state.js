// POST /api/characters/:id/reset-physical-state
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/characters/:id/reset-physical-state', require("../../../platform/http/trace.js").traceHttp("characters", "POST /api/characters/:id/reset-physical-state"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const id = req.params.id;
        if (!id) return res.status(400).json({ error: 'Missing ID' });
        const character = typeof db.getCharacter === 'function' ? db.getCharacter(id) : null;
        if (!character) return res.status(404).json({ error: 'Character not found' });

        const patch = {
            energy: 100,
            sleep_debt: 0,
            sleep_pressure: 0,
            stress: 0,
            pressure_level: 0,
            work_distraction: 0,
            sleep_disruption: 0
        };

        db.updateCharacter(id, patch);
        res.json({ success: true, character: db.getCharacter(id) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
