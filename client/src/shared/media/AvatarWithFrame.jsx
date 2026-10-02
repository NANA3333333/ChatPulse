import React from 'react';
import AuthenticatedImage from "./AuthenticatedImage.jsx";

import { FRAME_LAYOUTS, normalizeAvatarFrameId, getAvatarFrameShape, getAvatarFrameAsset } from "./avatarFrames.js";

function AvatarWithFrame({
    src,
    fallbackSrc,
    alt = '',
    frame = 'none',
    size = 40,
    className = '',
    imageClassName = '',
    style,
    imageStyle,
    children
}) {
    const frameId = normalizeAvatarFrameId(frame);
    const shape = getAvatarFrameShape(frameId);
    const frameAsset = getAvatarFrameAsset(frameId);
    const frameLayout = FRAME_LAYOUTS[frameId] || null;
    const dimension = typeof size === 'number' ? `${size}px` : size;

    return (
        <span
            className={`avatar-frame avatar-frame--shape-${shape} ${frameAsset ? 'avatar-frame--has-asset' : ''} avatar-frame--${frameId} ${className}`.trim()}
            data-avatar-frame={frameId}
            data-avatar-shape={shape}
            style={{
                '--avatar-size': dimension,
                '--avatar-frame-image': frameAsset ? `url(${frameAsset})` : undefined,
                '--avatar-frame-scale': frameLayout?.scale,
                '--avatar-frame-center-x': frameLayout?.centerX,
                '--avatar-frame-center-y': frameLayout?.centerY,
                ...style
            }}
        >
            <AuthenticatedImage
                className={`avatar-frame__image ${imageClassName}`.trim()}
                src={src}
                fallbackSrc={fallbackSrc}
                alt={alt}
                style={imageStyle}
            />
            {frameAsset && <span className="avatar-frame__asset" aria-hidden="true" />}
            {children}
        </span>
    );
}

export default AvatarWithFrame;
