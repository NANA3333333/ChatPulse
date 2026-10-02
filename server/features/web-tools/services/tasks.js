// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
async function runTask(task, context = {}) {
    const input = task.input || {};
    task.status = 'running';
    task.started_at = dependencies.nowIso();
    task.error = '';
    if (context.db) dependencies.ensureMcpLabDb(context.db).saveTask(task);
    try {
        if (task.kind === 'web_search' || task.kind === 'private_web_search' || task.kind === 'city_web_search') {
            const resolved = dependencies.resolveSearchProvider(context.db, input.provider);
            task.output = await dependencies.runWebSearch(input.query || task.title, {
                provider: resolved.id,
                apiKey: resolved.key,
                fetchPages: input.fetch_pages !== false,
                fetchPageLimit: input.fetch_page_limit || 3
            });
        } else if (task.kind === 'fetch_url') {
            task.output = await dependencies.runFetchUrl(input.url);
        } else {
            throw new Error(`Unsupported task kind: ${task.kind}`);
        }
        task.status = 'done';
        task.finished_at = dependencies.nowIso();
    } catch (e) {
        task.status = 'error';
        task.error = e.message;
        task.finished_at = dependencies.nowIso();
    }
    if (context.db) dependencies.ensureMcpLabDb(context.db).saveTask(task);
    return task;
}

    return { runTask };
}

module.exports = { createModule };
