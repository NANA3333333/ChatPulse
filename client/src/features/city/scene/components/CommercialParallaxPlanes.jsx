import React from 'react';
import {
    commercialV2Asset,
    commercialV2SkyLayerZIndex,
    commercialV2BackgroundSceneryLayerZIndex,
    commercialV2LoopSeamMargin,
    isCommercialV2BackgroundSceneryItem,
    isCommercialV2SkyStripAsset,
} from '../commercialStreetCore.js';

const panelCopies = [0, 1, 2];

function getImageOffsets(item, asset, stageWidth) {
    const offsets = [0];
    if (isCommercialV2SkyStripAsset(asset) && item.w > 0) {
        const minCopy = Math.floor((-item.x - item.w) / item.w);
        const maxCopy = Math.ceil((stageWidth - item.x) / item.w);
        for (let copy = minCopy; copy <= maxCopy; copy += 1) {
            const offset = copy * item.w;
            if (item.x + offset + item.w > 0 && item.x + offset < stageWidth) offsets.push(offset);
        }
        return [...new Set(offsets)];
    }
    if (item.x <= commercialV2LoopSeamMargin) offsets.push(stageWidth);
    if (item.x + item.w >= stageWidth - commercialV2LoopSeamMargin) offsets.push(-stageWidth);
    return offsets;
}

function ParallaxPlane({ kind, entries, baseZIndex, stageSize, zoom }) {
    const panelWidth = stageSize.width * zoom;
    const panelHeight = stageSize.height * zoom;
    return (
        <div
            className={`street-parallax-plane street-parallax-plane--${kind}`}
            data-parallax-layer={kind}
            aria-hidden="true"
            style={{ width: `${panelWidth * 3}px`, height: `${panelHeight}px`, zIndex: baseZIndex }}
        >
            {panelCopies.map((panelCopy) => (
                <div
                    key={panelCopy}
                    className="street-parallax-panel"
                    style={{ left: `${panelCopy * panelWidth}px`, width: `${panelWidth}px`, height: `${panelHeight}px` }}
                >
                    {entries.flatMap(({ item, asset, layerIndex }) =>
                        getImageOffsets(item, asset, stageSize.width).map((offset) => (
                            <img
                                key={`${item.id}-${offset}`}
                                src={commercialV2Asset(asset.path)}
                                alt=""
                                draggable={false}
                                style={{
                                    left: `${(item.x + offset) * zoom}px`,
                                    top: `${item.y * zoom}px`,
                                    width: `${item.w * zoom}px`,
                                    height: `${item.h * zoom}px`,
                                    zIndex: layerIndex,
                                }}
                            />
                        )),
                    )}
                </div>
            ))}
        </div>
    );
}

export const CommercialParallaxPlanes = React.memo(function CommercialParallaxPlanes({ items, assetById, stageSize, zoom }) {
    const far = [];
    const middle = [];
    items.forEach((item, layerIndex) => {
        const asset = assetById.get(item.assetId);
        if (asset?.type === '天空') far.push({ item, asset, layerIndex });
        else if (asset?.id?.startsWith('greenery_') && isCommercialV2BackgroundSceneryItem(item, asset)) {
            middle.push({ item, asset, layerIndex });
        }
    });
    return (
        <>
            <ParallaxPlane kind="far" entries={far} baseZIndex={commercialV2SkyLayerZIndex} stageSize={stageSize} zoom={zoom} />
            <ParallaxPlane kind="middle" entries={middle} baseZIndex={commercialV2BackgroundSceneryLayerZIndex} stageSize={stageSize} zoom={zoom} />
        </>
    );
});
