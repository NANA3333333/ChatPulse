import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventCallback } from '../../../shared/hooks/useEventCallback.js';
import {
    buildBehaviorTreeStorageSyncSignature,
    summarizeMountedGeneratedBehaviorBranches,
} from './behaviorTreeCore.js';
import { createBehaviorSyncClient } from './behaviorSyncClient.js';
import { createBehaviorRecoveryStore } from './behaviorRecoveryStore.js';

export function useBehaviorTreeSync({
    apiUrl,
    sceneKey,
    storageKey,
    enabled,
    getTree,
    applyRemote,
    getMeta,
    canApplyRemote = () => true,
}) {
    const [syncStatus, setSyncStatus] = useState({ kind: 'loading', message: '' });
    const clientRef = useRef(null);
    const recoveryRef = useRef(null);
    const getCurrentTree = useEventCallback(getTree);
    const applyCurrentRemote = useEventCallback(applyRemote);
    const getCurrentMeta = useEventCallback(getMeta);
    const canApplyCurrentRemote = useEventCallback(canApplyRemote);
    useEffect(() => {
        if (!enabled) return undefined;
        let recovery = null;
        let initialPending = null;
        try {
            recovery = createBehaviorRecoveryStore({ storageKey, storage: localStorage, session: sessionStorage });
            initialPending = recovery.load();
        } catch {
            /* The sync client still retains pending data in memory when storage is unavailable. */
        }
        recoveryRef.current = recovery;
        if (!initialPending?.tree) initialPending = null;
        if (initialPending) applyCurrentRemote(initialPending.tree);
        const client = createBehaviorSyncClient({
            initialPending,
            getTree: getCurrentTree,
            signature: buildBehaviorTreeStorageSyncSignature,
            shouldBootstrap: (tree) => summarizeMountedGeneratedBehaviorBranches(tree).generated_node_count > 0,
            applyRemote: applyCurrentRemote,
            canApplyRemote: canApplyCurrentRemote,
            onStatus: setSyncStatus,
            onPending(value) {
                try {
                    recovery?.remember(value);
                } catch {
                    /* The pending in-memory copy remains available for retry. */
                }
            },
            async request(method, body, signal) {
                const token = localStorage.getItem('cp_token') || '';
                const timeout = AbortSignal.timeout(15000);
                const response = await fetch(`${apiUrl}/city/behavior-tree-state/${encodeURIComponent(sceneKey)}`, {
                    method,
                    signal: AbortSignal.any([signal, timeout]),
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    ...(body ? { body: JSON.stringify(body) } : {}),
                });
                const data = await response.json();
                if (!response.ok)
                    throw Object.assign(new Error(data.error || `HTTP ${response.status}`), {
                        status: response.status,
                    });
                if (!Number.isSafeInteger(data.revision)) throw new Error('Invalid scene revision');
                return data;
            },
        });
        clientRef.current = client;
        client.poll();
        const timer = window.setInterval(() => client.poll(), 8000);
        return () => {
            window.clearInterval(timer);
            client.dispose();
            if (clientRef.current === client) clientRef.current = null;
            if (recoveryRef.current === recovery) recoveryRef.current = null;
        };
    }, [apiUrl, sceneKey, storageKey, enabled, getCurrentTree, applyCurrentRemote, canApplyCurrentRemote]);
    const persistBehaviorTreeStateToServer = useCallback(
        (tree, reason = 'update') =>
            clientRef.current?.save(tree, { ...getCurrentMeta(), reason }) ?? Promise.resolve(false),
        [getCurrentMeta],
    );
    const markLocalTreeChanged = useCallback(() => clientRef.current?.localChanged(), []);
    const canReceiveExternalTree = useCallback(
        () => !clientRef.current?.hasPending() && canApplyCurrentRemote(),
        [canApplyCurrentRemote],
    );
    const retrySync = useCallback(() => clientRef.current?.retry(), []);
    const reloadServerTree = useCallback(() => {
        // Explicitly choosing the server tree keeps a recovery copy of local changes.
        try {
            recoveryRef.current?.backup(getCurrentTree());
        } catch {
            /* Best effort. */
        }
        return clientRef.current?.reload();
    }, [getCurrentTree]);
    return {
        persistBehaviorTreeStateToServer,
        markLocalTreeChanged,
        canReceiveExternalTree,
        syncStatus,
        retrySync,
        reloadServerTree,
    };
}
