// Serialized writes and revision-checked reads shared by both scene controllers.
// Tree.version belongs to the behavior format; revision belongs to the server.
export function createBehaviorSyncClient({
    request,
    getTree,
    signature,
    applyRemote,
    onStatus,
    onPending,
    initialPending = null,
    shouldBootstrap = () => false,
    canApplyRemote = () => true,
}) {
    let revision = initialPending?.revision ?? null;
    let pending = initialPending;
    let conflict = false;
    let disposed = false;
    let epoch = 0;
    let reading = null;
    let writing = null;
    let reloading = false;
    const controller = new AbortController();
    const status = (kind, message = '') => {
        if (!disposed) onStatus({ kind, message });
    };
    const remember = () => {
        if (!disposed) onPending(pending);
    };
    const failed = (error) => {
        if (disposed) return;
        conflict = error.status === 409;
        status(conflict ? 'conflict' : 'error', error.message);
    };

    async function poll() {
        if (disposed || pending || writing || conflict || reloading || !canApplyRemote()) return;
        if (reading) return reading;
        const startedAt = epoch;
        reading = (async () => {
            try {
                const data = await request('GET', undefined, controller.signal);
                if (disposed || pending || writing || startedAt !== epoch || !canApplyRemote()) return;
                // Never apply an earlier revision, even if a delayed response arrives later.
                if (revision !== null && data.revision < revision) return;
                revision = data.revision;
                if (!data.tree && shouldBootstrap(getTree())) {
                    await save(getTree(), { reason: 'bootstrap-local-cache' });
                    return;
                }
                if (data.tree && signature(data.tree) !== signature(getTree())) applyRemote(data.tree);
                status('synced');
            } catch (error) {
                failed(error);
            } finally {
                reading = null;
            }
        })();
        return reading;
    }

    function save(tree, meta = {}) {
        if (disposed) return Promise.resolve(false);
        epoch++;
        pending = { tree, meta, revision };
        remember();
        return flush();
    }

    function flush() {
        if (disposed || conflict || !pending) return Promise.resolve(false);
        if (writing) return writing;
        writing = (async () => {
            try {
                status('saving');
                if (revision === null) {
                    const data = await request('GET', undefined, controller.signal);
                    if (disposed) return false;
                    // A local cache with no known base must not silently replace an existing server tree.
                    if (data.tree && signature(data.tree) !== signature(pending.tree)) {
                        throw Object.assign(new Error('Scene already has a server version. Reload it before saving.'), {
                            status: 409,
                        });
                    }
                    revision = data.revision;
                }
                while (pending && !disposed) {
                    const sent = pending;
                    sent.revision = revision;
                    remember();
                    const data = await request(
                        'POST',
                        {
                            tree: sent.tree,
                            meta: sent.meta,
                            expected_revision: revision,
                        },
                        controller.signal,
                    );
                    if (disposed) return false;
                    revision = data.revision;
                    if (pending === sent) pending = null;
                    else pending.revision = revision;
                    remember();
                }
                status('synced');
                return true;
            } catch (error) {
                failed(error);
                return false;
            } finally {
                writing = null;
            }
        })();
        return writing;
    }

    async function reload() {
        if (disposed || writing || reloading) return;
        // The caller keeps the discarded local tree as a separate recovery copy.
        const startedAt = ++epoch;
        reloading = true;
        if (reading) await reading;
        try {
            status('loading');
            const data = await request('GET', undefined, controller.signal);
            if (disposed || startedAt !== epoch) return;
            revision = data.revision;
            pending = null;
            conflict = false;
            remember();
            if (data.tree) applyRemote(data.tree);
            status('synced');
        } catch (error) {
            failed(error);
        } finally {
            reloading = false;
        }
    }

    if (pending) status('error', 'Unsaved local changes');
    else status('loading');
    return {
        poll,
        save,
        retry: () => (pending ? flush() : poll()),
        reload,
        localChanged() {
            epoch++;
        },
        hasPending: () => Boolean(pending),
        dispose() {
            disposed = true;
            controller.abort();
        },
    };
}
