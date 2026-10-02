import {
    roomEditorSizeProfileVersion,
    roomAssemblyCalibratedSizeProfile,
    roomEditorStageSize,
    roomEditorAssemblyPreviewStorageKey,
    roomAssemblyPreviewMaxStorageBytes,
    roomEditorStorageKey,
    roomEditorCanvasStorageKey,
    roomEditorFurnitureScaleVersion,
    roomEditorAssemblyStorageKey,
    roomEditorMaxStorageBytes,
    roomAssemblyPreviewVersion,
    roomAssemblyPreviewImageSize,
    roomAssemblyPreviewSourceCrop,
    roomEditorSizeProfileStorageKey,
    roomEditorBackdrop,
    roomEditorLayoutUpdatedEvent,
} from './roomAssemblyCatalog.js';
import { toNum } from '../housingFormatting.js';
import { summarizeRoomAssemblyPurchases, normalizeRoomAssemblySizeProfile } from './roomAssemblyGeometry.js';

export function stripAgencyRoomAssemblyPreview(snapshot = {}) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot;
    const rest = { ...snapshot };
    delete rest.previewImage;
    return rest;
}

export function doesRoomAssemblyPreviewMatchSnapshot(snapshot = {}, payload = {}) {
    if (!payload?.previewImage?.dataUrl) return false;
    const payloadSavedAt = toNum(payload.savedAt, 0);
    const snapshotSavedAt = toNum(snapshot.savedAt, 0);
    if (payloadSavedAt && snapshotSavedAt && payloadSavedAt !== snapshotSavedAt) return false;
    const payloadSelectedId = String(payload.selectedId || '');
    const snapshotSelectedId = String(snapshot.selectedId || '');
    if (payloadSelectedId && snapshotSelectedId && payloadSelectedId !== snapshotSelectedId) return false;
    return true;
}

export function readAgencyRoomAssemblyPreview(snapshot = {}) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const raw = window.localStorage.getItem(roomEditorAssemblyPreviewStorageKey);
        if (!raw || raw.length > roomAssemblyPreviewMaxStorageBytes + 20000) return null;
        const payload = JSON.parse(raw);
        return doesRoomAssemblyPreviewMatchSnapshot(snapshot, payload) ? payload.previewImage : null;
    } catch {
        return null;
    }
}

export function writeAgencyRoomAssemblyPreview(snapshot = {}, previewImage = null) {
    if (!previewImage?.dataUrl) {
        localStorage.removeItem(roomEditorAssemblyPreviewStorageKey);
        return null;
    }
    const payload = {
        selectedId: String(snapshot.selectedId || ''),
        savedAt: toNum(snapshot.savedAt, 0),
        homeId: String(snapshot.home?.id || ''),
        previewImage,
    };
    localStorage.setItem(roomEditorAssemblyPreviewStorageKey, JSON.stringify(payload));
    return previewImage;
}

export function readAgencyRoomAssemblySnapshotFromRoomEditorLayout() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const rawLayout = window.localStorage.getItem(roomEditorStorageKey);
        if (!rawLayout) return null;
        const layout = JSON.parse(rawLayout);
        if (!layout || !Array.isArray(layout.items) || layout.items.length === 0) return null;
        const rawCanvas = window.localStorage.getItem(roomEditorCanvasStorageKey);
        const canvas = rawCanvas ? JSON.parse(rawCanvas) : null;
        const assembledBy = canvas?.assembledBy && typeof canvas.assembledBy === 'object' ? canvas.assembledBy : {};
        const source = String(layout.source || assembledBy.source || '');
        const isAgencyAssembly =
            source.includes('room-assembly') ||
            Array.isArray(assembledBy.purchases) ||
            Boolean(assembledBy.home?.id || assembledBy.home?.name);
        if (!isAgencyAssembly) return null;
        const snapshot = {
            selectedId: String(layout.selectedId || layout.items[0]?.id || ''),
            savedAt: toNum(layout.savedAt || assembledBy.savedAt, Date.now()),
            source: source || 'social-housing-agency-room-assembly-recovered',
            home: {
                id: String(assembledBy.home?.id || ''),
                name: String(assembledBy.home?.name || ''),
                emoji: String(assembledBy.home?.emoji || ''),
                weekly_rent: toNum(assembledBy.home?.weekly_rent),
                comfort: toNum(assembledBy.home?.comfort),
                prestige: toNum(assembledBy.home?.prestige),
                privacy: toNum(assembledBy.home?.privacy),
            },
            palette: String(assembledBy.palette || ''),
            budget: toNum(assembledBy.budget, 0),
            spent: toNum(assembledBy.spent, 0),
            purchases: Array.isArray(assembledBy.purchases)
                ? assembledBy.purchases
                : summarizeRoomAssemblyPurchases(layout.items),
            furnitureScaleVersion: String(
                layout.furnitureScaleVersion || assembledBy.furnitureScaleVersion || roomEditorFurnitureScaleVersion,
            ),
            sizeProfile: layout.sizeProfile || assembledBy.sizeProfile || getRoomAssemblyCurrentSizeProfile(),
            directions: assembledBy.directions || {},
            ai: assembledBy.ai || null,
            items: layout.items,
        };
        const previewImage = readAgencyRoomAssemblyPreview(snapshot);
        return { ...snapshot, ...(previewImage ? { previewImage } : {}) };
    } catch {
        return null;
    }
}

export function readAgencyRoomAssemblySnapshot() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        const raw = window.localStorage.getItem(roomEditorAssemblyStorageKey);
        if (!raw) {
            const recovered = readAgencyRoomAssemblySnapshotFromRoomEditorLayout();
            if (recovered) writeAgencyRoomAssemblySnapshot(recovered);
            return recovered;
        }
        const snapshot = JSON.parse(raw);
        if (!snapshot || !Array.isArray(snapshot.items)) {
            const recovered = readAgencyRoomAssemblySnapshotFromRoomEditorLayout();
            if (recovered) writeAgencyRoomAssemblySnapshot(recovered);
            return recovered;
        }
        const cleanSnapshot = stripAgencyRoomAssemblyPreview(snapshot);
        const previewImage = readAgencyRoomAssemblyPreview(cleanSnapshot) || snapshot.previewImage || null;
        if (snapshot.previewImage || raw.length > roomEditorMaxStorageBytes) {
            writeAgencyRoomAssemblySnapshot({ ...cleanSnapshot, ...(previewImage ? { previewImage } : {}) });
        }
        return { ...cleanSnapshot, ...(previewImage ? { previewImage } : {}) };
    } catch {
        const recovered = readAgencyRoomAssemblySnapshotFromRoomEditorLayout();
        if (recovered) writeAgencyRoomAssemblySnapshot(recovered);
        return recovered;
    }
}

export function writeAgencyRoomAssemblySnapshot(snapshot) {
    const cleanSnapshot = stripAgencyRoomAssemblyPreview(snapshot);
    localStorage.setItem(roomEditorAssemblyStorageKey, JSON.stringify(cleanSnapshot));
    try {
        writeAgencyRoomAssemblyPreview(cleanSnapshot, snapshot?.previewImage || null);
    } catch (error) {
        console.warn('Room assembly preview storage failed:', error);
        try {
            localStorage.removeItem(roomEditorAssemblyPreviewStorageKey);
        } catch {
            // Ignore cleanup failures; the room layout snapshot has already been saved.
        }
    }
    return { ...cleanSnapshot, ...(snapshot?.previewImage ? { previewImage: snapshot.previewImage } : {}) };
}

export function isRoomAssemblySnapshotPreviewCurrent(snapshot = {}) {
    const preview = snapshot?.previewImage;
    return Boolean(
        preview?.dataUrl &&
            preview.version === roomAssemblyPreviewVersion &&
            toNum(preview.width, 0) >= roomAssemblyPreviewImageSize &&
            toNum(preview.crop?.y, -1) === roomAssemblyPreviewSourceCrop.y &&
            toNum(preview.crop?.h, -1) === roomAssemblyPreviewSourceCrop.h,
    );
}

export function readRoomAssemblyUserSizeProfile() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return { version: roomEditorSizeProfileVersion, kindSizes: {} };
        }
        const raw = window.localStorage.getItem(roomEditorSizeProfileStorageKey);
        if (!raw || raw.length > roomEditorMaxStorageBytes) {
            if (raw) window.localStorage.removeItem(roomEditorSizeProfileStorageKey);
            return { version: roomEditorSizeProfileVersion, kindSizes: {} };
        }
        const normalized = normalizeRoomAssemblySizeProfile(JSON.parse(raw));
        if (!Object.keys(normalized.kindSizes).length) {
            window.localStorage.removeItem(roomEditorSizeProfileStorageKey);
        }
        return normalized;
    } catch {
        try {
            window.localStorage.removeItem(roomEditorSizeProfileStorageKey);
        } catch {
            // Ignore storage access failures; room assembly can fall back to code defaults.
        }
        return { version: roomEditorSizeProfileVersion, kindSizes: {} };
    }
}

export function getRoomAssemblyCurrentSizeProfile() {
    return buildRoomAssemblySizeProfile();
}

export function getRoomAssemblySizeProfileKindCount(sizeProfile = {}) {
    return Object.keys(normalizeRoomAssemblySizeProfile(sizeProfile).kindSizes).length;
}

export function persistAgencyRoomAssemblySnapshot(snapshot) {
    const canvas = {
        stage: roomEditorStageSize,
        background: {
            type: 'room-backdrop',
            color: '#fbf0f7',
            image: roomEditorBackdrop,
        },
        collision: {
            unit: 'ratio-of-item-box',
            mode: 'active',
            groundLayer: 'ignored',
        },
        assembledBy: {
            source: snapshot.source,
            home: snapshot.home,
            palette: snapshot.palette,
            budget: snapshot.budget,
            spent: snapshot.spent,
            purchases: snapshot.purchases,
            furnitureScaleVersion: snapshot.furnitureScaleVersion || roomEditorFurnitureScaleVersion,
            sizeProfile: snapshot.sizeProfile,
            directions: snapshot.directions,
            ai: snapshot.ai
                ? { model: snapshot.ai.model, character: snapshot.ai.character, notes: snapshot.ai.notes }
                : null,
            savedAt: snapshot.savedAt,
        },
    };
    localStorage.setItem(
        roomEditorStorageKey,
        JSON.stringify({
            selectedId: snapshot.selectedId,
            savedAt: snapshot.savedAt,
            source: snapshot.source,
            furnitureScaleVersion: snapshot.furnitureScaleVersion || roomEditorFurnitureScaleVersion,
            sizeProfile: snapshot.sizeProfile || buildRoomAssemblySizeProfile(snapshot.items),
            items: snapshot.items,
        }),
    );
    localStorage.setItem(roomEditorCanvasStorageKey, JSON.stringify(canvas));
    writeAgencyRoomAssemblySnapshot(snapshot);
    window.dispatchEvent(new CustomEvent(roomEditorLayoutUpdatedEvent, { detail: snapshot }));
    return snapshot;
}

export function buildRoomAssemblySizeProfile() {
    const userProfile = readRoomAssemblyUserSizeProfile();
    return {
        version: roomEditorSizeProfileVersion,
        kindSizes: {
            ...roomAssemblyCalibratedSizeProfile,
            ...userProfile.kindSizes,
        },
    };
}
