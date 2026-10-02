const assert = require('node:assert/strict');

async function main() {
    const { createStreetMotionStepper } = await import('../client/src/features/city/scene/movement/createStreetMotionStepper.js');

    function walkWithBarrier(barrier) {
        let player = { id: 'walker', x: 0, y: 0, stepTime: 0, frame: 0, moving: false };
        const playerRef = { current: player };
        const moves = [];
        const step = createStreetMotionStepper({
            playersRef: { current: { walker: player } },
            controlledPlayerIdRef: { current: 'walker' },
            playerRef,
            advanceBehaviorRuntime: () => {},
            setPlayer: (updater) => {
                player = { ...player, ...updater(player) };
                playerRef.current = player;
            },
            resolvePlayerGroundMove: (current, x, y) => {
                moves.push({ from: current.x, to: x });
                return { x: x <= barrier ? x : current.x, y };
            },
            pressedKeysRef: { current: new Set(['d']) },
            autoTravelRef: { current: null },
        });
        step(0.05, 0.1);
        return { player, moves };
    }

    const free = walkWithBarrier(Infinity);
    assert.ok(Math.abs(free.player.x - 22) < 0.001, 'Manual travel uses the full elapsed time');
    assert.equal(free.moves.length, 2, 'Long frames are checked in two collision-sized steps');
    assert.ok(free.moves.every(({ from, to }) => to - from <= 11.001));

    const blocked = walkWithBarrier(15);
    assert.ok(Math.abs(blocked.player.x - 11) < 0.001, 'The second step cannot cross a barrier');
    assert.equal(blocked.moves.length, 2);
    console.log('PASS street motion delta: elapsed time and collision-sized steps');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
