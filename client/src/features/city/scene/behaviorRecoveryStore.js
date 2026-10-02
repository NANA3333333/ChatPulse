const uniqueId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Each mounted sync client writes its own journal entry. A tab-local pointer survives
// reloads; durable entries also allow recovery after closing and reopening a tab.
export function createBehaviorRecoveryStore({ storageKey, storage, session, makeId = uniqueId }) {
    const legacyKey = `${storageKey}.pending-sync`;
    const prefix = `${legacyKey}/`;
    const pointerKey = `${legacyKey}-pointer`;
    const sessionKey = `${legacyKey}-local`;
    const key = `${prefix}${makeId()}`;
    let ancestors = [];
    let legacySnapshot = null;
    const keepSessionCopy = (pending) => {
        try { session.setItem(sessionKey, JSON.stringify(pending)); } catch { /* Durable journal is the fallback. */ }
        return pending;
    };
    const read = (target) => {
        try {
            const value = JSON.parse(storage.getItem(target) || 'null');
            return value?.pending?.tree ? value : null;
        } catch {
            return null;
        }
    };
    const load = () => {
        let previousKey;
        let sessionPending = null;
        try {
            const saved = session.getItem(sessionKey);
            if (saved === 'null') return null; // This tab explicitly completed or discarded its edit.
            const parsed = JSON.parse(saved || 'null');
            if (parsed?.tree) sessionPending = parsed;
            previousKey = session.getItem(pointerKey);
        } catch { /* A disabled session store only prevents choosing this tab's preferred copy. */ }
        let record = previousKey?.startsWith(prefix) ? read(previousKey) : null;
        // Session storage is independent even when a browser duplicates a tab's pointer.
        if (sessionPending && !record) return sessionPending;
        if (!record) {
            try {
                const raw = storage.getItem(legacyKey);
                const legacy = JSON.parse(raw || 'null');
                if (legacy?.tree) {
                    legacySnapshot = raw;
                    return keepSessionCopy(legacy);
                }
                // A reopened tab may have lost its session pointer. Keep all other copies.
                for (let i = 0; i < storage.length; i++) {
                    const candidateKey = storage.key(i);
                    if (!candidateKey?.startsWith(prefix)) continue;
                    const candidate = read(candidateKey);
                    if (candidate && (!record || candidate.updatedAt > record.updatedAt)) {
                        previousKey = candidateKey;
                        record = candidate;
                    }
                }
            } catch { /* The caller still has its in-memory scene tree. */ }
        }
        if (!record) return null;
        ancestors = [...(record.ancestors || []), { key: previousKey, writeId: record.writeId }];
        return keepSessionCopy(sessionPending || record.pending);
    };
    const remember = (pending) => {
        keepSessionCopy(pending);
        if (pending) {
            const record = { pending, writeId: makeId(), updatedAt: Date.now(), ancestors };
            storage.setItem(key, JSON.stringify(record));
            try { session.setItem(pointerKey, key); } catch { /* The durable journal remains available. */ }
            if (legacySnapshot !== null && storage.getItem(legacyKey) === legacySnapshot) {
                storage.removeItem(legacyKey);
                legacySnapshot = null;
            }
            return;
        }
        storage.removeItem(key);
        for (const previous of ancestors) {
            // A duplicated tab may have edited the recovered entry since we read it.
            if (previous.key?.startsWith(prefix) && read(previous.key)?.writeId === previous.writeId) {
                storage.removeItem(previous.key);
            }
        }
        if (legacySnapshot !== null && storage.getItem(legacyKey) === legacySnapshot) storage.removeItem(legacyKey);
        try {
            const pointer = session.getItem(pointerKey);
            if (pointer === key || (pointer?.startsWith(prefix) && !storage.getItem(pointer))) session.removeItem(pointerKey);
        } catch { /* No pending data is lost if an obsolete pointer remains. */ }
        ancestors = [];
        legacySnapshot = null;
    };
    const backup = (tree) => {
        // Keep separate durable backups; the old key remains a convenient latest-copy alias.
        storage.setItem(`${storageKey}.unsynced-backup/${makeId()}`, JSON.stringify(tree));
        storage.setItem(`${storageKey}.unsynced-backup`, JSON.stringify(tree));
    };
    return { load, remember, backup };
}
