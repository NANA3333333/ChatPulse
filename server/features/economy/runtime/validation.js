// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function normalizePositiveMoney(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return +amount.toFixed(2);
    }

function normalizePaymentNote(value) {
        if (value === undefined || value === null) return '';
        if (typeof value !== 'string') return null;
        return value.trim().slice(0, 120);
    }

function normalizePacketCount(value) {
        const text = String(value ?? '').trim();
        if (!/^\d+$/.test(text)) return null;
        const parsed = Number(text);
        if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > dependencies.MAX_RED_PACKET_COUNT) return null;
        return parsed;
    }

function normalizeRedPacketId(value) {
        const id = Number(value);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    }

function normalizeTransferId(value) {
        const id = Number(value);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    }

    return { normalizePositiveMoney, normalizePaymentNote, normalizePacketCount, normalizeRedPacketId, normalizeTransferId };
}

module.exports = { createModule };
