const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

test('scene writes reject stale revisions and permit identical retries and intentional tree resets', () => {
    const db = new Database(':memory:');
    try {
        db.exec(require('../features/city/schema').pixel_behavior_tree_states);
        const repo = require('../features/city/behaviorTreeRepository').createModule({
            db,
            safeParseJson: JSON.parse,
            PIXEL_BEHAVIOR_TREE_STATE_MAX_BYTES: 500000,
        });
        const fresh = { version: 20, nodes: { fresh: {} } };
        assert.throws(() => repo.upsertPixelBehaviorTreeState('room', fresh), { status: 428 });
        const first = repo.upsertPixelBehaviorTreeState('room', fresh, {}, 0);
        assert.equal(first.revision, 1);
        assert.throws(() => repo.upsertPixelBehaviorTreeState('room', { version: 10, nodes: {} }, {}, 0), {
            status: 409,
        });
        assert.equal(repo.getPixelBehaviorTreeState('room').tree.version, 20);
        assert.equal(repo.upsertPixelBehaviorTreeState('room', fresh, {}, 0).revision, 1);
        assert.equal(repo.upsertPixelBehaviorTreeState('room', { version: 1, nodes: {} }, {}, 1).revision, 2);
    } finally {
        db.close();
    }
});

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
};
async function harness(request, extra = {}) {
    const { createBehaviorSyncClient } = await import('../../client/src/features/city/scene/behaviorSyncClient.js');
    let tree = { version: 1 },
        status,
        pending;
    const client = createBehaviorSyncClient({
        request,
        getTree: () => tree,
        signature: JSON.stringify,
        applyRemote: (value) => {
            tree = value;
        },
        onStatus: (value) => {
            status = value;
        },
        onPending: (value) => {
            pending = value;
        },
        ...extra,
    });
    return {
        client,
        get tree() {
            return tree;
        },
        get status() {
            return status;
        },
        get pending() {
            return pending;
        },
    };
}

test('a GET started before a local change cannot replace that change', async () => {
    const read = deferred();
    const h = await harness(() => read.promise);
    const work = h.client.poll();
    h.client.localChanged();
    read.resolve({ revision: 5, tree: { version: 99 } });
    await work;
    assert.equal(h.tree.version, 1);
    h.client.dispose();
});

test('scene saves serialize and keep the latest pending edit with the acknowledged revision', async () => {
    const write = deferred(),
        requests = [];
    const h = await harness(async (method, body) => {
        if (method === 'GET') return { revision: 0, tree: null };
        requests.push(body);
        return requests.length === 1 ? write.promise : { revision: 2 };
    });
    await h.client.poll();
    const one = h.client.save({ version: 2 });
    const two = h.client.save({ version: 3 });
    assert.equal(requests.length, 1);
    write.resolve({ revision: 1 });
    await Promise.all([one, two]);
    assert.deepEqual(
        requests.map((r) => [r.tree.version, r.expected_revision]),
        [
            [2, 0],
            [3, 1],
        ],
    );
    assert.equal(h.pending, null);
    assert.equal(h.status.kind, 'synced');
    h.client.dispose();
});

test('conflicts retain the local edit and stop polling until the user loads the server version', async () => {
    let reads = 0;
    const h = await harness(async (method) => {
        if (method === 'POST') throw Object.assign(new Error('conflict'), { status: 409 });
        reads++;
        return { revision: reads, tree: { version: reads } };
    });
    await h.client.poll();
    await h.client.save({ version: 9 });
    assert.equal(h.status.kind, 'conflict');
    await h.client.poll();
    await h.client.retry();
    assert.equal(reads, 1);
    assert.equal(h.pending.tree.version, 9);
    await h.client.reload();
    assert.equal(h.tree.version, 2);
    assert.equal(h.pending, null);
    h.client.dispose();
});

test('a failed save can retry without fetching a newer base or discarding local data', async () => {
    let posts = 0;
    const revisions = [];
    const h = await harness(async (method, body) => {
        if (method === 'GET') return { revision: 4, tree: { version: 1 } };
        revisions.push(body.expected_revision);
        if (++posts === 1) throw new Error('offline');
        return { revision: 5 };
    });
    await h.client.poll();
    await h.client.save({ version: 6 });
    assert.equal(h.status.kind, 'error');
    assert.equal(h.pending.tree.version, 6);
    await h.client.retry();
    assert.deepEqual(revisions, [4, 4]);
    assert.equal(h.status.kind, 'synced');
    h.client.dispose();
});

test('unmounted scenes ignore in-flight reads', async () => {
    const read = deferred();
    const h = await harness(() => read.promise);
    const work = h.client.poll();
    h.client.dispose();
    read.resolve({ revision: 7, tree: { version: 7 } });
    await work;
    assert.equal(h.tree.version, 1);
});

test('polling defers remote trees during an interaction, including a read already in flight', async () => {
    let busy = false,
        reads = 0;
    const read = deferred();
    const h = await harness(
        () => {
            reads++;
            return read.promise;
        },
        { canApplyRemote: () => !busy },
    );
    const work = h.client.poll();
    busy = true;
    read.resolve({ revision: 8, tree: { version: 8 } });
    await work;
    await h.client.poll();
    assert.equal(reads, 1);
    assert.equal(h.tree.version, 1);
    busy = false;
    await h.client.poll();
    assert.equal(h.tree.version, 8);
    h.client.dispose();
});

test('explicit reload cannot discard an edit made while the server response is pending', async () => {
    const read = deferred();
    const h = await harness(() => read.promise);
    const work = h.client.reload();
    h.client.localChanged();
    read.resolve({ revision: 9, tree: { version: 9 } });
    await work;
    assert.equal(h.tree.version, 1);
    h.client.dispose();
});

test('editing before the initial read cannot silently overwrite a different server tree', async () => {
    let posts = 0;
    const h = await harness(async (method) => {
        if (method === 'POST') posts++;
        return { revision: 7, tree: { version: 7 } };
    });
    await h.client.save({ version: 2 });
    assert.equal(posts, 0);
    assert.equal(h.status.kind, 'conflict');
    assert.equal(h.pending.tree.version, 2);
    h.client.dispose();
});
