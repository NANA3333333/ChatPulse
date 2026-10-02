const assert = require('node:assert/strict');

// Exercise the mounted editors: event updates must reach both React and storage,
// then the existing polling loop must still accept a newer server tree.
async function verifySceneSync(page, baseUrl, token, name) {
    const room = name === '像素小屋';
    const storageKey = room ? 'pixelWorld.room.behaviorTreeState' : 'pixelWorld.commercialStreetV2.behaviorTreeState';
    const sceneKey = room ? 'pixel_cottage_room_v1' : 'commercial_street_v2';
    await page.waitForFunction(key => Boolean(JSON.parse(localStorage.getItem(key) || 'null')?.nodes), storageKey);
    const eventTree = await page.evaluate(key => {
        const tree = JSON.parse(localStorage.getItem(key));
        tree.version = Number(tree.version || 1) + 11;
        tree.memory = { ...tree.memory, sync_test: 'event' };
        window.dispatchEvent(new CustomEvent('pixel-world-behavior-tree-updated', {
            detail: { storageKey: key, sourceId: 'e2e-other-editor', tree }
        }));
        return tree;
    }, storageKey);
    await page.waitForFunction(({ key, version }) => {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        return saved?.version === version && saved?.memory?.sync_test === 'event';
    }, { key: storageKey, version: eventTree.version }).catch(async error => {
        console.error('Scene event sync diagnostic', await page.evaluate(key => ({
            expected: key,
            local: JSON.parse(localStorage.getItem(key) || 'null'),
            pending: JSON.parse(localStorage.getItem(`${key}.pending-sync`) || 'null'),
            text: document.querySelector('.right-column .pixel-world-editor')?.innerText,
        }), storageKey));
        throw error;
    });

    const serverTree = { ...eventTree, version: eventTree.version + 1, memory: { ...eventTree.memory, sync_test: 'server' } };
    const endpoint = `/api/city/behavior-tree-state/${sceneKey}`;
    const baseline = await fetch(baseUrl + endpoint, { headers: { Authorization: `Bearer ${token}` } }).then(response => response.json());
    const saved = await fetch(baseUrl + endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tree: serverTree, expected_revision: baseline.revision })
    });
    assert.equal(saved.status, 200, `${name}: save server tree`);
    let polls = 0;
    const onRequest = request => {
        if (request.method() === 'GET' && new URL(request.url()).pathname === endpoint) polls++;
    };
    page.on('request', onRequest);
    try {
        await page.waitForFunction(({ key, version }) => {
            const tree = JSON.parse(localStorage.getItem(key) || 'null');
            return tree?.version === version && tree?.memory?.sync_test === 'server';
        }, { key: storageKey, version: serverTree.version }, { timeout: 20000 });
        assert.ok(polls >= 1 && polls <= 3, `${name}: bounded polling, observed ${polls}`);
    } finally {
        page.off('request', onRequest);
    }
    console.log(`PASS scene sync: ${name} event, server polling and local persistence`);
}

module.exports = { verifySceneSync };
