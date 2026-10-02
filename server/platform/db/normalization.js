// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function safeParseJson(value, fallback) {
        if (value == null || value === '') return fallback;
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch (e) {
            return fallback;
        }
    }

function normalizeArrayField(value, fallback = []) {
        if (Array.isArray(value)) {
            return value.filter(Boolean);
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return fallback;
            const parsed = safeParseJson(trimmed, null);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
            return trimmed.split(/[,，、\n]/).map(v => v.trim()).filter(Boolean);
        }
        return fallback;
    }

function normalizeRelationshipField(value, fallback = []) {
        if (Array.isArray(value)) return value.filter(Boolean);
        if (value && typeof value === 'object') return [value];
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return fallback;
            const parsed = safeParseJson(trimmed, null);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
            if (parsed && typeof parsed === 'object') return [parsed];
            return [{ summary: trimmed }];
        }
        return fallback;
    }

function stringifyJson(value, fallback = '[]') {
        try {
            return JSON.stringify(value);
        } catch (e) {
            return fallback;
        }
    }

function normalizePositiveRowId(value, label = 'id') {
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id <= 0) {
            const error = new Error(`Invalid ${label}.`);
            error.status = 400;
            throw error;
        }
        return id;
    }

function normalizeSqlLimit(value, fallback, max) {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
        return Math.min(parsed, max);
    }

    return { safeParseJson, normalizeArrayField, normalizeRelationshipField, stringifyJson, normalizePositiveRowId, normalizeSqlLimit };
}

module.exports = { createModule };
