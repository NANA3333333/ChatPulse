const assert = require('node:assert/strict');

async function approachScenePeer(page, scene, name) {
    const room = name === '像素小屋';
    const stage = scene.locator(room ? '.pixel-world-room-editor-stage' : '.active-loop');
    const canvas = scene.locator('.pixel-world-editor-canvas-wrap');
    let lastPosition;
    for (let attempt = 0; attempt < 70 && !(await stage.locator('.pixel-world-interaction-entry').count()); attempt++) {
        const delta = await stage.evaluate(async (node, room) => {
            const current = node.querySelector('.pixel-world-player.controlled');
            const peer = node.querySelector('.pixel-world-player:not(.controlled)');
            const a = new DOMMatrix(current.style.transform),
                b = new DOMMatrix(peer.style.transform);
            let origin = { x: a.m41, y: a.m42 },
                destination = { x: b.m41, y: b.m42 };
            let target = destination;
            if (room) {
                // Use the public navigation module to walk around furniture through real keyboard input.
                const [core, street, navigation] = await Promise.all([
                    import('/src/features/city/scene/roomEditorCore.js'),
                    import('/src/features/city/scene/commercialStreetCore.js'),
                    import('/src/features/city/scene/movement/createRoomNavigation.js'),
                ]);
                // DOM transforms are scaled sprite top-left coordinates; navigation
                // expects unscaled foot positions in the same space as furniture.
                const zoom = Number(getComputedStyle(node).getPropertyValue('--editor-zoom')) || 1;
                const footPoint = (sprite, matrix) => {
                    const width = parseFloat(sprite.style.width), height = parseFloat(sprite.style.height);
                    const footOffset = height * street.commercialV2PlayerSize.footOffset / street.commercialV2PlayerSize.height;
                    return { x: (matrix.m41 + width / 2) / zoom, y: (matrix.m42 + height - footOffset) / zoom };
                };
                origin = footPoint(current, a);
                destination = footPoint(peer, b);
                const catalog = new Map(core.roomEditorAssetCatalog.map((asset) => [asset.id, asset]));
                const collisionRects = core
                    .readStoredRoomEditorLayout()
                    .items.map((item) => street.getCommercialV2CollisionWorldBox(item, catalog.get(item.assetId)))
                    .filter(Boolean);
                const scale = core.readStoredRoomEditorPlayers().scale;
                const playerDimensions = Object.fromEntries(
                    Object.entries(street.commercialV2PlayerSize).map(([key, value]) => [key, value * scale]),
                );
                const nav = navigation.createRoomNavigation({
                    playerDimensions,
                    roomCollisionRects: collisionRects,
                    behaviorPlaceLinks: [],
                });
                const route = nav.buildBehaviorSmoothTravelPath(origin, destination);
                target = route.find((point) => Math.hypot(point.x - origin.x, point.y - origin.y) > 12) || destination;
            }
            return { x: target.x - origin.x, y: target.y - origin.y, origin, destination };
        }, room);
        lastPosition = delta;
        const key = Math.abs(delta.x) > Math.abs(delta.y) ? (delta.x > 0 ? 'd' : 'a') : delta.y > 0 ? 's' : 'w';
        await canvas.focus();
        await page.keyboard.down(key);
        await page.waitForTimeout(140);
        await page.keyboard.up(key);
    }
    assert.ok(
        await stage.locator('.pixel-world-interaction-entry').count(),
        `${name}: reach the peer: ${JSON.stringify(lastPosition)}`,
    );
    return stage;
}

module.exports = { approachScenePeer };
