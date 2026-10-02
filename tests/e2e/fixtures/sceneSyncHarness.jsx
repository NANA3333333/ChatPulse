import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useBehaviorTreeSync } from './features/city/scene/useBehaviorTreeSync.js';

function Harness() {
    const tree = useRef({ tree_id: 'audit-tree', version: 1, nodes: {} });
    const sync = useBehaviorTreeSync({ apiUrl: '/api', sceneKey: 'test-tabs', storageKey: 'test-tabs-tree', enabled: true,
        getTree: () => tree.current, applyRemote: value => { tree.current = value; }, getMeta: () => ({}) });
    window.sceneSyncTest = {
        state: () => ({ tree: tree.current, status: sync.syncStatus,
            pending: JSON.parse(sessionStorage.getItem('test-tabs-tree.pending-sync-local') || 'null') }),
        save(value) { tree.current = value; return sync.persistBehaviorTreeStateToServer(value); },
        retry: sync.retrySync,
        reloadServer: sync.reloadServerTree,
    };
    return <div data-status={sync.syncStatus.kind}>Scene sync regression fixture</div>;
}
createRoot(document.getElementById('root')).render(<Harness />);
