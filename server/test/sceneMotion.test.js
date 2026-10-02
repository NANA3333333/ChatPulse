const test = require('node:test');
const assert = require('node:assert/strict');
const scene = '../../client/src/features/city/scene/';
const dimensions = { width: 100, height: 120, footOffset: 12 };

test('swept collision detects thin obstacles but permits an exact edge touch', async () => {
    const { segmentCrossesBox } = await import(scene + 'movement/segmentCollision.js');
    assert.equal(segmentCrossesBox({ x: 0, y: 5 }, { x: 100, y: 5 }, { x: 49, y: 0, w: 0.1, h: 10 }), true);
    assert.equal(segmentCrossesBox({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 49, y: 0, w: 2, h: 10 }), false);
});

test('room movement slides beside furniture and can leave an overlapping spawn', async () => {
    const { createRoomNavigation } = await import(scene + 'movement/createRoomNavigation.js');
    const nav = createRoomNavigation({
        playerDimensions: dimensions,
        roomCollisionRects: [{ x: 450, y: 300, w: 40, h: 160 }],
        behaviorPlaceLinks: [],
    });
    const moved = nav.resolveRoomPlayerMovement({ x: 420, y: 380 }, { x: 450, y: 390 });
    assert.equal(moved.x, 420);
    assert.equal(moved.y, 390);
    const escaped = nav.resolveRoomPlayerMovement({ x: 450, y: 380 }, { x: 434, y: 380 });
    assert.equal(escaped.x, 434);
});

test('room routes go around furniture and every segment remains walkable', async () => {
    const { createRoomNavigation } = await import(scene + 'movement/createRoomNavigation.js');
    const nav = createRoomNavigation({
        playerDimensions: dimensions,
        roomCollisionRects: [{ x: 450, y: 300, w: 40, h: 160 }],
        behaviorPlaceLinks: [],
    });
    const start = { x: 380, y: 380 },
        target = { x: 580, y: 380 };
    const route = nav.buildBehaviorSmoothTravelPath(start, target);
    assert.ok(route.length > 1, 'The direct line intersects the furniture');
    assert.equal(route.at(-1).x, target.x);
    let previous = start;
    for (const point of route) {
        const steps = Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) / 4);
        for (let i = 1; i <= steps; i++) {
            const next = {
                x: previous.x + ((point.x - previous.x) * i) / steps,
                y: previous.y + ((point.y - previous.y) * i) / steps,
            };
            const safe = nav.findSafeRoomPlayerPointNear(next);
            assert.ok(Math.hypot(safe.x - next.x, safe.y - next.y) < 0.01, 'Route crosses collision geometry');
        }
        previous = point;
    }
});

test('street collision wraps at the seam and reads current peer positions', async () => {
    const { createStreetCollision } = await import(scene + 'movement/createStreetCollision.js');
    const { commercialV2RoleActorId: role, commercialV2UserActorId: user } = await import(
        scene + 'commercialStreetCore.js'
    );
    const playersRef = { current: { [role]: { x: 300, y: 300 }, [user]: { x: 998, y: 300 } } };
    const world = {
        playerDimensions: dimensions,
        stageSize: { width: 1000, height: 600 },
        walkableRects: [],
        controlledPlayerIdRef: { current: role },
        playersRef,
        collisionRects: [],
        autoRouteBlockRects: [],
        mainRoadRects: [],
        streetCruiseRoadRects: [],
    };
    const collision = createStreetCollision(world);
    assert.equal(collision.isPlayerPositionAllowed(2, 300), false, 'Peer blocks across wrapped seam');
    playersRef.current[user].x = 500;
    assert.equal(collision.isPlayerPositionAllowed(2, 300), true, 'Queries use live actor positions');
    const blocked = createStreetCollision({ ...world, collisionRects: [{ x: 995, y: 285, w: 20, h: 30 }] });
    assert.equal(blocked.isPlayerPositionAllowed(2, 300, { ignorePlayers: true }), false);
});

async function motionFixture(overrides = {}) {
    const { createStreetMotionStepper } = await import(scene + 'movement/createStreetMotionStepper.js');
    const { commercialV2RoleActorId: role, commercialV2UserActorId: user } = await import(
        scene + 'commercialStreetCore.js'
    );
    const playersRef = {
        current: Object.fromEntries(
            [
                [role, 100],
                [user, 600],
            ].map(([id, x]) => [id, { id, x, y: 300, direction: 'right', moving: false, stepTime: 0, frame: 0 }]),
        ),
    };
    const controlledPlayerIdRef = { current: role },
        playerRef = { current: playersRef.current[role] };
    const pressedKeysRef = { current: new Set() },
        autoTravelRef = { current: null };
    const events = [];
    const setPlayerById = (id, updater) => {
        const current = playersRef.current[id];
        playersRef.current[id] = { ...current, ...(typeof updater === 'function' ? updater(current) : updater) };
        playerRef.current = playersRef.current[controlledPlayerIdRef.current];
    };
    const step = createStreetMotionStepper({
        playersRef,
        controlledPlayerIdRef,
        playerRef,
        pressedKeysRef,
        autoTravelRef,
        stageSize: { width: 1000, height: 600 },
        setPlayerById,
        setPlayer: (update) => setPlayerById(controlledPlayerIdRef.current, update),
        advanceBehaviorRuntime: () => events.push('behavior'),
        setAutoTravelActive: (value) => events.push(['active', value]),
        setNotice: () => {},
        setWorldPlayerBubble: () => {},
        buildAutoTravelPath: () => null,
        buildStreetCruiseSegment: () => null,
        activateBehaviorTravelFailureBranchEvent: (details) => {
            events.push(['failure', details.reason]);
            return true;
        },
        resolvePlayerGroundMove: (current, x, y) => ({ x: ((x % 1000) + 1000) % 1000, y }),
        ...overrides,
    });
    return { step, role, user, playersRef, playerRef, pressedKeysRef, autoTravelRef, events };
}

test('motion frames preserve held movement, wrap positions and stop after key release', async () => {
    const f = await motionFixture();
    f.playersRef.current[f.role].x = 995;
    f.pressedKeysRef.current.add('d');
    for (let i = 0; i < 10; i++) f.step(0.05);
    assert.ok(Math.abs(f.playerRef.current.x - 105) < 0.01);
    f.pressedKeysRef.current.clear();
    f.step(0.05);
    assert.equal(f.playerRef.current.moving, false);
    assert.equal(f.playerRef.current.frame, 0);
    assert.equal(f.events.filter((event) => event === 'behavior').length, 11);
});

test('manual movement and a different actor auto-travel advance in the same frame', async () => {
    const f = await motionFixture();
    f.pressedKeysRef.current.add('d');
    f.autoTravelRef.current = {
        playerId: f.user,
        point: { x: 700, y: 300 },
        place: {},
        action: 'arrived',
        label: 'target',
    };
    f.step(0.05);
    assert.ok(f.playersRef.current[f.role].x > 100);
    assert.ok(f.playersRef.current[f.user].x > 600);
});

test('blocked auto-travel terminates and requests the behavior recovery branch', async () => {
    const f = await motionFixture({ resolvePlayerGroundMove: (current) => ({ x: current.x, y: current.y }) });
    f.autoTravelRef.current = {
        playerId: f.role,
        behaviorRuntimeId: 'behavior-1',
        point: { x: 350, y: 300 },
        place: {},
        action: 'walk',
        label: 'target',
        replanCount: 2,
    };
    for (let i = 0; i < 30; i++) f.step(0.05);
    assert.equal(f.autoTravelRef.current, null);
    assert.equal(f.events.filter((event) => Array.isArray(event) && event[0] === 'failure').length, 1);
    assert.equal(f.playerRef.current.x, 100);
});
