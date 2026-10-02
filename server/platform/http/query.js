// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizeQueryLimit(value, fallback, max) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
    return Math.min(parsed, max);
}

    return { normalizeQueryLimit };
}

module.exports = { createModule };
