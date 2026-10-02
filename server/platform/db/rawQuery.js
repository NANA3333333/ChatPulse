// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function rawRun(sql, params = []) {
        return dependencies.db.prepare(sql).run(...params);
    }

    return { rawRun };
}

module.exports = { createModule };
