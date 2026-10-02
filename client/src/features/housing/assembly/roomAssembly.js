import {
    getRoomAssemblyFallbackShopItem,
    summarizeRoomAssemblyPurchases,
    getRoomAssemblyPlacementKind,
    getRoomAssemblyPlacementPriority,
    roomAssemblySingleInstanceKinds,
    resolveRoomAssemblyPlacementItem,
    getRoomAssemblyDirections,
    resolveRoomAssemblyExistingItem,
} from './roomAssemblyGeometry.js';
import {
    roomAssemblyKinds,
    roomAssemblyCoreKinds,
    roomEditorFurnitureScaleVersion,
    roomAssemblyPalettes,
} from './roomAssemblyCatalog.js';
import { toNum } from '../housingFormatting.js';
import { getRoomAssemblyCurrentSizeProfile, persistAgencyRoomAssemblySnapshot } from './roomAssemblyStorage.js';
import { addRoomAssemblySnapshotPreview } from './roomAssemblyPreview.js';

export function hashText(value) {
    return String(value || '')
        .split('')
        .reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);
}

export function pickRoomAssemblyPalette(home = {}) {
    const rent = toNum(home.weekly_rent);
    const comfort = toNum(home.comfort);
    const prestige = toNum(home.prestige);
    if (prestige >= 48 || rent >= 130) return roomAssemblyPalettes.candy;
    if (prestige >= 32 || comfort >= 36) return roomAssemblyPalettes.cloud;
    if (comfort >= 24 || toNum(home.privacy) >= 22) return roomAssemblyPalettes.ocean;
    if (comfort >= 14 || rent >= 32) return roomAssemblyPalettes.standard;
    return roomAssemblyPalettes.budget;
}

export function getRoomAssemblyBudget(home = {}) {
    const rent = toNum(home.weekly_rent);
    const comfort = toNum(home.comfort);
    const prestige = toNum(home.prestige);
    const privacy = toNum(home.privacy);
    if (prestige >= 48 || rent >= 130) return 3200;
    if (prestige >= 32 || rent >= 90 || comfort >= 38) return 2200;
    if (comfort >= 24 || privacy >= 22 || rent >= 55) return 1450;
    if (comfort >= 14 || rent >= 32) return 950;
    return 600;
}

export function buildRoomAssemblyAiItems(palette, aiAssembly, sizeProfile = {}) {
    const placements = Array.isArray(aiAssembly?.placements) ? aiAssembly.placements : [];
    const items = [];
    const kindCounts = {};
    placements
        .map((placement, index) => ({ placement, index, kind: getRoomAssemblyPlacementKind(placement) }))
        .sort(
            (a, b) =>
                getRoomAssemblyPlacementPriority(a.kind) - getRoomAssemblyPlacementPriority(b.kind) ||
                a.index - b.index,
        )
        .forEach(({ placement, index, kind }) => {
            if (roomAssemblySingleInstanceKinds.has(kind) && kindCounts[kind] >= 1) return;
            const item = resolveRoomAssemblyPlacementItem(palette, placement, index, kind, items, sizeProfile);
            if (!item) return;
            items.push(item);
            kindCounts[item.assemblyKind] = (kindCounts[item.assemblyKind] || 0) + 1;
        });
    return items;
}

export function buildAgencyRoomAssembly(
    home = {},
    aiAssembly = null,
    sizeProfile = getRoomAssemblyCurrentSizeProfile(),
) {
    const palette = pickRoomAssemblyPalette(home);
    const directions = getRoomAssemblyDirections();
    const fallbackItems = buildFallbackRoomAssemblyItems(home, palette, directions, sizeProfile);
    const fallbackByKind = new Map(fallbackItems.map((item) => [item.assemblyKind, item]));
    const aiItems = buildRoomAssemblyAiItems(palette, aiAssembly, sizeProfile);
    const hasAiLayout = aiItems.length > 0;
    const presentCoreKinds = new Set(aiItems.map((item) => item.assemblyKind).filter(Boolean));
    const items = hasAiLayout
        ? roomAssemblyCoreKinds
              .filter((kind) => !presentCoreKinds.has(kind))
              .reduce((acc, kind, index) => {
                  const fallbackItem = fallbackByKind.get(kind);
                  if (!fallbackItem) return acc;
                  const resolvedItem = resolveRoomAssemblyExistingItem(
                      palette,
                      fallbackItem,
                      1000 + index,
                      acc,
                      sizeProfile,
                  );
                  return resolvedItem ? [...acc, resolvedItem] : acc;
              }, aiItems)
        : fallbackItems;
    const resolvedDirections = roomAssemblyKinds.reduce((acc, kind) => {
        acc[kind] = items.find((item) => item.assemblyKind === kind)?.direction || directions[kind] || 'front';
        return acc;
    }, {});
    const budget = getRoomAssemblyBudget(home);
    const purchases = summarizeRoomAssemblyPurchases(items);
    const spent = Math.round(purchases.reduce((sum, purchase) => sum + toNum(purchase.subtotal, 0), 0));
    return {
        selectedId: items[0]?.id || '',
        savedAt: Date.now(),
        source: hasAiLayout ? 'social-housing-agency-room-assembly-ai' : 'social-housing-agency-room-assembly-template',
        home: {
            id: String(home.id || ''),
            name: String(home.name || ''),
            emoji: String(home.emoji || ''),
            weekly_rent: toNum(home.weekly_rent),
            comfort: toNum(home.comfort),
            prestige: toNum(home.prestige),
            privacy: toNum(home.privacy),
        },
        palette: palette.label,
        budget,
        spent,
        purchases,
        furnitureScaleVersion: roomEditorFurnitureScaleVersion,
        sizeProfile,
        directions: resolvedDirections,
        ai: hasAiLayout
            ? {
                  model: String(aiAssembly?.model || ''),
                  character: aiAssembly?.ai_character || null,
                  notes: String(aiAssembly?.notes || ''),
                  raw_output: String(aiAssembly?.raw_output || ''),
              }
            : null,
        items,
    };
}

export function saveAgencyRoomAssembly(
    home = {},
    aiAssembly = null,
    sizeProfile = getRoomAssemblyCurrentSizeProfile(),
) {
    return persistAgencyRoomAssemblySnapshot(buildAgencyRoomAssembly(home, aiAssembly, sizeProfile));
}

export async function saveAgencyRoomAssemblyWithPreview(
    home = {},
    aiAssembly = null,
    sizeProfile = getRoomAssemblyCurrentSizeProfile(),
) {
    return addRoomAssemblySnapshotPreview(saveAgencyRoomAssembly(home, aiAssembly, sizeProfile));
}

export function buildFallbackRoomAssemblyItems(
    home = {},
    palette = pickRoomAssemblyPalette(home),
    directions = getRoomAssemblyDirections(),
    sizeProfile = {},
) {
    const seed = hashText(`${home.id || ''}:${home.name || ''}`);
    const softShift = (seed % 29) - 14;
    const budget = getRoomAssemblyBudget(home);
    let spent = 0;
    const fallbackSlots = [
        { kind: 'wardrobe', x: 2, y: 4 },
        { kind: 'vanity', x: 6, y: 4 },
        { kind: 'bed', x: 2 + (seed % 2), y: 4 },
        { kind: 'nightstand', x: 7, y: 10 },
        { kind: 'bookshelf', x: 10, y: 8 },
        { kind: 'sofa', x: 8, y: 10 },
        { kind: 'rug', x: 3, y: 9 },
        { kind: 'floorLamp', x: 5, y: 4 },
        { kind: 'wallArt', x: 5 + (seed % 2), y: 2 },
    ];
    const placements = fallbackSlots.reduce((acc, slot) => {
        const shopItem = getRoomAssemblyFallbackShopItem(palette, slot.kind);
        const price = toNum(shopItem?.price, 0);
        const isCore = roomAssemblyCoreKinds.includes(slot.kind);
        if (!shopItem || (!isCore && spent + price > budget)) return acc;
        spent += price;
        acc.push({
            assetId: shopItem.assetId,
            item: slot.kind,
            x: slot.x,
            y: Math.max(slot.y, slot.y + Math.round(softShift / 40)),
            dir: directions[slot.kind] || shopItem.preferred_dir || 'front',
        });
        return acc;
    }, []);
    return buildRoomAssemblyAiItems(palette, { placements }, sizeProfile);
}
