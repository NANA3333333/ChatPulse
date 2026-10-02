// GET /api/characters
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/characters', require("../../../platform/http/trace.js").traceHttp("characters", "GET /api/characters"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const characters = db.getCharacters();

        // Ensure city DB is attached for inventory queries
        if (!db.city) {
            try {
                const initCityDb = require("../../city/cityDb.js");
                db.city = initCityDb(typeof db.getRawDb === 'function' ? db.getRawDb() : db);
            } catch (e) {
                // City DLC not found or failed to load
            }
        }

        // Attach unread_count so the frontend can initialise badges correctly on load/refresh
        const enriched = characters.map(c => {
            const emotion = dependencies.deriveEmotion(c);
            const messageStats = typeof db.getCharacterMessageStats === 'function'
                ? db.getCharacterMessageStats(c.id)
                : {};
            return dependencies.redactSecretFields({
                ...c,
                unread_count: db.getUnreadCount(c.id),
                first_message_at: Number(messageStats.first_message_at || 0),
                last_message_at: Number(messageStats.last_message_at || 0),
                last_user_message_at: Number(messageStats.last_user_message_at || c.last_user_msg_time || 0),
                private_message_count: Number(messageStats.private_message_count || 0),
                user_message_count: Number(messageStats.user_message_count || 0),
                character_message_count: Number(messageStats.character_message_count || 0),
                inventory: typeof db.city?.getInventory === 'function' ? db.city.getInventory(c.id) : [],
                emotion_state: emotion.state,
                emotion_label: emotion.label,
                emotion_emoji: emotion.emoji,
                emotion_color: emotion.color
            }, dependencies.CHARACTER_SECRET_FIELDS);
        });
        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
