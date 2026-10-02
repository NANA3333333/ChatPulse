// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizePositiveMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const rounded = +amount.toFixed(2);
    return rounded > 0 ? rounded : null;
}

function normalizePaymentNote(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'string') return null;
    return value.trim().slice(0, 120);
}

    return { normalizePositiveMoney, normalizePaymentNote };
}

module.exports = { createModule };
