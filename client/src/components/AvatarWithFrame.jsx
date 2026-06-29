import React from 'react';
import AuthenticatedImage from './AuthenticatedImage';

export const AVATAR_FRAME_OPTIONS = [
    { id: 'none', label: '无头像框', group: '基础' },
    { id: 'rose-lace', label: '玫瑰蕾丝', group: '花朵', shape: 'circle', asset: 'rose-lace.png' },
    { id: 'garden-wreath', label: '花园环', group: '花朵', shape: 'circle', asset: 'garden-wreath.png' },
    { id: 'daisy-lace', label: '雏菊蕾丝', group: '花朵', shape: 'circle', asset: 'daisy-lace.png' },
    { id: 'bow-pearl', label: '珍珠蝴蝶结', group: '蝴蝶结', shape: 'circle', asset: 'bow-pearl.png' },
    { id: 'paper-bloom', label: '纸片花束', group: '贴纸', shape: 'square', asset: 'paper-bloom.png' },
    { id: 'cherry-bow', label: '樱花小结', group: '混合', shape: 'square', asset: 'cherry-bow.png' },
    { id: 'pearl-garden', label: '珍珠花园', group: '混合', shape: 'circle', asset: 'pearl-garden.png' },
    { id: 'flower-bow-circle', label: '花枝蝴蝶结', group: '花朵', shape: 'circle', asset: 'flower-bow-circle.png' },
    { id: 'rose-chain', label: '玫瑰珠链', group: '花朵', shape: 'circle', asset: 'rose-chain.png' },
    { id: 'flower-ticket', label: '花边票券', group: '方形', shape: 'square', asset: 'flower-ticket.png' },
    { id: 'photo-tape', label: '胶带相纸', group: '方形', shape: 'square', asset: 'photo-tape.png' }
];

const FRAME_IDS = new Set(AVATAR_FRAME_OPTIONS.map(option => option.id));
const FRAME_SHAPES = new Map(AVATAR_FRAME_OPTIONS.map(option => [option.id, option.shape || 'circle']));
const FRAME_ASSETS = new Map(AVATAR_FRAME_OPTIONS
    .filter(option => option.asset)
    .map(option => [option.id, `/assets/avatar-frames/${option.asset}`]));
const FRAME_LAYOUTS = {
    'bow-pearl': { centerX: 0.500, centerY: 0.486, scale: 1.459 },
    'cherry-bow': { centerX: 0.499, centerY: 0.551, scale: 1.509 },
    'daisy-lace': { centerX: 0.524, centerY: 0.494, scale: 1.523 },
    'flower-bow-circle': { centerX: 0.404, centerY: 0.394, scale: 1.306 },
    'flower-ticket': { centerX: 0.516, centerY: 0.470, scale: 1.400 },
    'garden-wreath': { centerX: 0.528, centerY: 0.502, scale: 1.459 },
    'paper-bloom': { centerX: 0.522, centerY: 0.506, scale: 1.560 },
    'pearl-garden': { centerX: 0.528, centerY: 0.532, scale: 1.419 },
    'photo-tape': { centerX: 0.471, centerY: 0.480, scale: 1.472 },
    'rose-chain': { centerX: 0.492, centerY: 0.415, scale: 1.418 },
    'rose-lace': { centerX: 0.478, centerY: 0.529, scale: 1.404 }
};

export function normalizeAvatarFrameId(frameId) {
    const normalized = String(frameId || '').trim();
    return FRAME_IDS.has(normalized) ? normalized : 'none';
}

export function getAvatarFrameShape(frameId) {
    return FRAME_SHAPES.get(normalizeAvatarFrameId(frameId)) || 'circle';
}

export function getAvatarFrameAsset(frameId) {
    return FRAME_ASSETS.get(normalizeAvatarFrameId(frameId)) || '';
}

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
