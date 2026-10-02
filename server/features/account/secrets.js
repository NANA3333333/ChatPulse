// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function secretHasConfiguredValue(field, value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (field === 'web_search_keys_json') {
        try {
            const parsed = JSON.parse(text);
            return !!parsed && typeof parsed === 'object' && Object.values(parsed).some(item => String(item || '').trim());
        } catch (_) {
            return text !== '{}';
        }
    }
    return true;
}

function maskSecretLast4(value) {
    const text = String(value || '').trim();
    return text ? text.slice(-4) : '';
}

function redactSecretFields(record, fields) {
    if (!record) return record;
    const safe = { ...record };
    fields.forEach(field => {
        const value = record[field];
        safe[`${field}_configured`] = secretHasConfiguredValue(field, value);
        safe[`${field}_last4`] = maskSecretLast4(value);
        if (Object.prototype.hasOwnProperty.call(safe, field)) {
            safe[field] = '';
        }
    });
    return safe;
}

function preserveExistingSecretFields(patch, existing, fields) {
    const next = { ...(patch || {}) };
    fields.forEach(field => {
        const clearFlag = `${field}_clear`;
        if (Object.prototype.hasOwnProperty.call(next, clearFlag)) {
            const shouldClear = next[clearFlag] === true || next[clearFlag] === 1 || String(next[clearFlag]).trim().toLowerCase() === 'true';
            delete next[clearFlag];
            if (shouldClear) {
                next[field] = field === 'web_search_keys_json' ? '{}' : '';
                return;
            }
        }
        if (!Object.prototype.hasOwnProperty.call(next, field)) return;
        const raw = next[field];
        const text = typeof raw === 'string' ? raw.trim() : raw;
        const blankValue = field === 'web_search_keys_json'
            ? (!text || text === '{}')
            : !String(text || '').trim();
        if (blankValue && secretHasConfiguredValue(field, existing?.[field])) {
            delete next[field];
        }
    });
    return next;
}

    return { secretHasConfiguredValue, maskSecretLast4, redactSecretFields, preserveExistingSecretFields };
}

module.exports = { createModule };
