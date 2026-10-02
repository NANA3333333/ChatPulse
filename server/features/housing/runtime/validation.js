// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function ensureCityDb(db) {
        if (!db.city) {
            const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : db;
            db.city = dependencies.initCityDb(rawDb);
        }
        return db.city;
    }

    return { ensureCityDb };
}

module.exports = { createModule };
