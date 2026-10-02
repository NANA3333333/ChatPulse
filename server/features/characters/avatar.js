// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function buildDefaultAvatarUrl(seed = 'User') {
    const safeSeed = encodeURIComponent(String(seed || 'User').trim() || 'User');
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${safeSeed}&backgroundColor=e8f0ff,fff5d6,e9f7ef,f5eafa,f1f5f9`;
}

    return { buildDefaultAvatarUrl };
}

module.exports = { createModule };
