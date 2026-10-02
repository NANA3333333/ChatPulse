export function normalizeGroupMessages(list = []) {
    const byId = new Map();
    list.forEach((msg, index) => {
        if (!msg || !msg.id) return;
        byId.set(String(msg.id), { ...msg, __fallbackIndex: index });
    });
    return Array.from(byId.values())
        .sort((a, b) => {
            const aTs = Number(a.timestamp || 0);
            const bTs = Number(b.timestamp || 0);
            if (aTs !== bTs) return aTs - bTs;
            const aId = String(a.id);
            const bId = String(b.id);
            if (aId !== bId) return aId.localeCompare(bId, 'en', { numeric: true });
            return (a.__fallbackIndex || 0) - (b.__fallbackIndex || 0);
        })
        .map((entry) => {
            const msg = { ...entry };
            delete msg.__fallbackIndex;
            return msg;
        });
}

