import { commercialV2PlayerCharacterById } from './commercialStreetCore.js';

export const commercialV2BehaviorActorBindingStorageKey = 'pixelWorld.commercialStreetV2.behaviorActorBindings';

export function normalizeCommercialV2BehaviorActorBindings(rawBindings = {}) {
    if (!rawBindings || typeof rawBindings !== 'object') return {};
    return Object.entries(rawBindings).reduce((result, [actorId, characterId]) => {
        const safeActorId = String(actorId || '').trim();
        const safeCharacterId = String(characterId || '').trim();
        if (safeActorId && safeCharacterId && commercialV2PlayerCharacterById.has(safeActorId)) {
            result[safeActorId] = safeCharacterId;
        }
        return result;
    }, {});
}

export function readStoredCommercialV2BehaviorActorBindings() {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(commercialV2BehaviorActorBindingStorageKey);
        if (!raw) return {};
        return normalizeCommercialV2BehaviorActorBindings(JSON.parse(raw));
    } catch {
        localStorage.removeItem(commercialV2BehaviorActorBindingStorageKey);
        return {};
    }
}
