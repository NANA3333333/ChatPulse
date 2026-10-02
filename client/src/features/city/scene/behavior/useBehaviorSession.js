import { useRef } from 'react';
import {
    commercialV2BehaviorAutonomousInitialDelayMs,
    createCommercialV2BehaviorTreeState,
    commercialV2BehaviorInteractionSessionIdleMs,
    commercialV2BehaviorBaseNodeIds,
    commercialV2BehaviorDefaultBaseActionNodeIds,
    commercialV2BehaviorNearbyAutonomousNodeIds,
    commercialV2BehaviorAutonomousNodeIds,
    createCommercialBehaviorBranchFromNode,
    commercialBehaviorBranchIsTravelRecovery,
    behaviorBranchReferencesOnlyPlaces,
    preferCommercialBehaviorBranchesForOwner,
    sortCommercialBehaviorBranchesByLiveliness,
} from '.././behaviorTreeCore.js';
import { useEventCallback } from '../../../../shared/hooks/useEventCallback.js';

// Owns interaction lifetime, autonomous branch selection and temporary status messages.
export function useBehaviorSession({
    behaviorTreeStateRef,
    behaviorCharacterId,
    behaviorTreeState,
    setBehaviorStatus,
    behaviorOrderedPlaces,
}) {
    const behaviorInteractionSessionRef = useRef({ active: false, expiresAt: 0 });

    const autonomousBehaviorCooldownRef = useRef(Date.now() + commercialV2BehaviorAutonomousInitialDelayMs);

    const autonomousBehaviorCursorRef = useRef(0);

    const autonomousBehaviorRecentRef = useRef([]);

    const behaviorStatusHoldRef = useRef({ text: '', until: 0 });

    function keepBehaviorInteractionSessionActive() {
        behaviorInteractionSessionRef.current = {
            active: true,
            expiresAt: Date.now() + commercialV2BehaviorInteractionSessionIdleMs,
        };
        autonomousBehaviorCooldownRef.current = Date.now() + commercialV2BehaviorInteractionSessionIdleMs;
    }

    function isBehaviorInteractionSessionActive() {
        const session = behaviorInteractionSessionRef.current || {};
        if (!session.active) return false;
        if (Date.now() > Number(session.expiresAt || 0)) {
            behaviorInteractionSessionRef.current = { active: false, expiresAt: 0 };
            return false;
        }
        return true;
    }

    function clearBehaviorStatusHold() {
        behaviorStatusHoldRef.current = { text: '', until: 0 };
    }

    function setBehaviorStatusPinned(message, holdMs = 30000) {
        const text = String(message || '');
        behaviorStatusHoldRef.current = {
            text,
            until: Date.now() + Math.max(0, Number(holdMs) || 0),
        };
        setBehaviorStatus(text);
    }

    function setBehaviorRuntimeStatus(message) {
        const hold = behaviorStatusHoldRef.current || {};
        if (hold.text && Date.now() < Number(hold.until || 0)) {
            setBehaviorStatus(hold.text);
            return;
        }
        setBehaviorStatus(message);
    }

    function pickAutonomousBehaviorBranch(options = {}) {
        const tree = behaviorTreeStateRef.current || behaviorTreeState || createCommercialV2BehaviorTreeState();
        const nodes = tree.nodes || {};
        const allowedPlaceIds = behaviorOrderedPlaces.map((place) => place.placeId);
        const dynamicBaseNodeIds = commercialV2BehaviorBaseNodeIds
            .flatMap((nodeId) => (Array.isArray(nodes[nodeId]?.children_ids) ? nodes[nodeId].children_ids : []))
            .filter(Boolean);
        const aiBaseNodeIds = dynamicBaseNodeIds.filter((nodeId) => {
            const node = nodes[nodeId] || {};
            return String(node.source || '').startsWith('ai');
        });
        const localDynamicBaseNodeIds = dynamicBaseNodeIds.filter(
            (nodeId) => !commercialV2BehaviorDefaultBaseActionNodeIds.includes(nodeId),
        );
        const fallbackNodeIds = localDynamicBaseNodeIds.length
            ? localDynamicBaseNodeIds
            : options.nearby
              ? Array.from(
                    new Set([...commercialV2BehaviorNearbyAutonomousNodeIds, ...commercialV2BehaviorAutonomousNodeIds]),
                )
              : Array.from(new Set(commercialV2BehaviorAutonomousNodeIds));
        const sourceNodeIds = aiBaseNodeIds.length
            ? Array.from(new Set(aiBaseNodeIds))
            : Array.from(new Set(fallbackNodeIds));
        const candidates = sourceNodeIds
            .map((nodeId) => createCommercialBehaviorBranchFromNode(nodes[nodeId]))
            .filter(
                (branch) =>
                    branch &&
                    !commercialBehaviorBranchIsTravelRecovery(branch) &&
                    Array.isArray(branch.steps) &&
                    behaviorBranchReferencesOnlyPlaces(branch, allowedPlaceIds),
            );
        const playableOwnerCandidates = preferCommercialBehaviorBranchesForOwner(candidates, behaviorCharacterId);
        if (!playableOwnerCandidates.length) return null;
        const recentIds = autonomousBehaviorRecentRef.current || [];
        const freshCandidates =
            playableOwnerCandidates.length > 3
                ? playableOwnerCandidates.filter((branch) => !recentIds.includes(branch.branch_id))
                : playableOwnerCandidates;
        const playableCandidates = sortCommercialBehaviorBranchesByLiveliness(
            freshCandidates.length ? freshCandidates : playableOwnerCandidates,
        );
        const cursor = autonomousBehaviorCursorRef.current % playableCandidates.length;
        autonomousBehaviorCursorRef.current += 1;
        const selected = playableCandidates[cursor];
        autonomousBehaviorRecentRef.current = [
            selected.branch_id,
            ...recentIds.filter((id) => id !== selected.branch_id),
        ].slice(0, Math.min(4, Math.max(1, playableOwnerCandidates.length - 1)));
        return selected;
    }
    const keepBehaviorInteractionSessionActiveEvent = useEventCallback(keepBehaviorInteractionSessionActive);
    const isBehaviorInteractionSessionActiveEvent = useEventCallback(isBehaviorInteractionSessionActive);
    const clearBehaviorStatusHoldEvent = useEventCallback(clearBehaviorStatusHold);
    const setBehaviorStatusPinnedEvent = useEventCallback(setBehaviorStatusPinned);
    const setBehaviorRuntimeStatusEvent = useEventCallback(setBehaviorRuntimeStatus);
    const pickAutonomousBehaviorBranchEvent = useEventCallback(pickAutonomousBehaviorBranch);
    return {
        keepBehaviorInteractionSessionActive: keepBehaviorInteractionSessionActiveEvent,
        isBehaviorInteractionSessionActive: isBehaviorInteractionSessionActiveEvent,
        clearBehaviorStatusHold: clearBehaviorStatusHoldEvent,
        setBehaviorStatusPinned: setBehaviorStatusPinnedEvent,
        setBehaviorRuntimeStatus: setBehaviorRuntimeStatusEvent,
        pickAutonomousBehaviorBranch: pickAutonomousBehaviorBranchEvent,
        behaviorInteractionSessionRef,
        autonomousBehaviorCooldownRef,
        autonomousBehaviorCursorRef,
        autonomousBehaviorRecentRef,
    };
}
