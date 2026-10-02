import {
    roomAssemblyPreviewAssetById,
    roomEditorStageSize,
    roomAssemblyPreviewSourceCrop,
    roomAssemblyPreviewImageSize,
    roomEditorBackdrop,
    roomAssemblyPreviewMaxStorageBytes,
    roomAssemblyPreviewVersion,
} from './roomAssemblyCatalog.js';
import { getRoomAssemblyBaseAssetId } from './roomAssemblyGeometry.js';
import { roomEditorAsset, getRoomEditorItemRenderZIndex } from '../../city/scene/roomEditorCore.js';
import { toNum } from '../housingFormatting.js';
import { writeAgencyRoomAssemblySnapshot } from './roomAssemblyStorage.js';

export const roomAssemblyPreviewImageCache = new Map();

export function getRoomAssemblyPreviewAsset(assetId) {
    const value = String(assetId || '').trim();
    return (
        roomAssemblyPreviewAssetById.get(value) ||
        roomAssemblyPreviewAssetById.get(getRoomAssemblyBaseAssetId(value)) ||
        null
    );
}

export function getRoomAssemblyPreviewAssetSrc(assetId) {
    const asset = getRoomAssemblyPreviewAsset(assetId);
    return asset?.path ? roomEditorAsset(asset.path) : '';
}

export function loadRoomAssemblyPreviewImage(src) {
    const value = String(src || '');
    if (!value || typeof window === 'undefined') return Promise.resolve(null);
    const cached = roomAssemblyPreviewImageCache.get(value);
    if (cached) return cached;
    const promise = new Promise((resolve) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = () => {
            roomAssemblyPreviewImageCache.delete(value);
            resolve(null);
        };
        image.src = value;
    });
    roomAssemblyPreviewImageCache.set(value, promise);
    return promise;
}

export function getRoomAssemblyPreviewFallbackZIndex(item = {}, index = 0) {
    if (item.groundLayer === true) return 100 + index;
    return 60000 + Math.round((toNum(item.y) + toNum(item.h) * 0.92) * 10) + (index % 5);
}

export function getRoomAssemblyPreviewZIndex(item = {}, index = 0) {
    const asset = getRoomAssemblyPreviewAsset(item.assetId);
    return asset
        ? getRoomEditorItemRenderZIndex(item, asset, index)
        : getRoomAssemblyPreviewFallbackZIndex(item, index);
}

export async function captureRoomAssemblySnapshotPreview(snapshot = {}) {
    if (typeof document === 'undefined') return null;
    const stageW = Math.max(1, Math.round(toNum(roomEditorStageSize.width, 1)));
    const stageH = Math.max(1, Math.round(toNum(roomEditorStageSize.height, 1)));
    const crop = {
        x: Math.max(0, Math.min(stageW - 1, roomAssemblyPreviewSourceCrop.x)),
        y: Math.max(0, Math.min(stageH - 1, roomAssemblyPreviewSourceCrop.y)),
        w: Math.max(1, Math.min(stageW, roomAssemblyPreviewSourceCrop.w)),
        h: Math.max(1, Math.min(stageH, roomAssemblyPreviewSourceCrop.h)),
    };
    const outputW = Math.max(320, Math.round(roomAssemblyPreviewImageSize));
    const outputH = Math.max(240, Math.round((outputW * crop.h) / crop.w));
    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = outputW / crop.w;
    const scaleY = outputH / crop.h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fbf0f7';
    ctx.fillRect(0, 0, outputW, outputH);

    const backdrop = await loadRoomAssemblyPreviewImage(roomEditorBackdrop);
    if (backdrop) {
        ctx.drawImage(backdrop, crop.x, crop.y, crop.w, crop.h, 0, 0, outputW, outputH);
    }

    const rows = (Array.isArray(snapshot.items) ? snapshot.items : [])
        .map((item, index) => ({
            item,
            index,
            src: getRoomAssemblyPreviewAssetSrc(item?.assetId),
            zIndex: getRoomAssemblyPreviewZIndex(item, index),
        }))
        .filter((row) => row.src)
        .sort((a, b) => a.zIndex - b.zIndex || a.index - b.index);

    for (const row of rows) {
        const image = await loadRoomAssemblyPreviewImage(row.src);
        if (!image) continue;
        const item = row.item || {};
        const itemX = toNum(item.x, 0);
        const itemY = toNum(item.y, 0);
        const itemW = toNum(item.w, 1);
        const itemH = toNum(item.h, 1);
        if (
            itemX + itemW <= crop.x ||
            itemX >= crop.x + crop.w ||
            itemY + itemH <= crop.y ||
            itemY >= crop.y + crop.h
        ) {
            continue;
        }
        const w = Math.max(1, Math.round(toNum(item.w, 1) * scaleX));
        const h = Math.max(1, Math.round(toNum(item.h, 1) * scaleY));
        ctx.drawImage(image, Math.round((itemX - crop.x) * scaleX), Math.round((itemY - crop.y) * scaleY), w, h);
    }

    const pngDataUrl = canvas.toDataURL('image/png');
    const webpDataUrl =
        pngDataUrl.length <= roomAssemblyPreviewMaxStorageBytes ? '' : canvas.toDataURL('image/webp', 0.98);
    const jpegDataUrl =
        webpDataUrl && webpDataUrl.length > roomAssemblyPreviewMaxStorageBytes
            ? canvas.toDataURL('image/jpeg', 0.94)
            : '';
    const dataUrl =
        pngDataUrl.length <= roomAssemblyPreviewMaxStorageBytes
            ? pngDataUrl
            : webpDataUrl.length <= roomAssemblyPreviewMaxStorageBytes
              ? webpDataUrl
              : jpegDataUrl;
    return {
        version: roomAssemblyPreviewVersion,
        dataUrl,
        width: outputW,
        height: outputH,
        crop,
        createdAt: Date.now(),
    };
}

export async function addRoomAssemblySnapshotPreview(snapshot = {}) {
    try {
        const previewImage = await captureRoomAssemblySnapshotPreview(snapshot);
        if (!previewImage?.dataUrl || previewImage.dataUrl.length > roomAssemblyPreviewMaxStorageBytes) {
            return snapshot;
        }
        const next = { ...snapshot, previewImage };
        writeAgencyRoomAssemblySnapshot(next);
        return next;
    } catch (error) {
        console.warn('Room assembly preview capture failed:', error);
        return snapshot;
    }
}
