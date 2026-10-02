import { useBehaviorDialog } from './useBehaviorDialog.js';
import { useRef } from 'react';
import {
    createRoomEditorPlayerState,
    clampRoomEditorPlayer,
    getRoomEditorDirectionFromDelta,
} from '../roomEditorCore.js';
import {
    createCommercialV2BehaviorTreeState,
    pickGeneratedInteractionStarterBranch,
    createCommercialV2PresetInteractionBranch,
    createCommercialBehaviorPatchFromBranch,
    pickCommercialBehaviorBaseBranchByTrigger,
    commercialV2BehaviorTravelFailureTrigger,
    commercialV2BehaviorBaseWaitMs,
    commercialV2BehaviorBaseFallbackMs,
    normalizeBehaviorDialogChoices,
} from '../behaviorTreeCore.js';
import {
    commercialV2PlayerCharacters,
    commercialV2RoleActorId,
    commercialV2PlayerCharacterById,
    commercialV2UserActorId,
    commercialV2PlayerApproachGap,
} from '../commercialStreetCore.js';
import { useEventCallback } from '../../../../shared/hooks/useEventCallback.js';

// Behavior activation, step execution, dialog choices and travel commands. Movement is provided by the scene navigation and motion ports.
export function useRoomBehaviorRuntime({
    selection,
    actors,
    tree,
    session,
    navigation,
    motion,
    presentation,
    generation,
}) {
    const {
        behaviorCharacterId,
        behaviorAction,
        setBehaviorAction,
        behaviorPlaceId,
        behaviorLoading,
        behaviorInteractionState,
        behaviorPlaceOptions,
        behaviorCharacter,
    } = selection;
    const { playersRef, setPlayerById, setWorldPlayerBubble } = actors;
    const { behaviorTreeStateRef, behaviorTreeState, behaviorOrderedPlaces, commitBehaviorTreeState } = tree;
    const {
        behaviorInteractionSessionRef,
        autonomousBehaviorCooldownRef,
        keepBehaviorInteractionSessionActive,
        setBehaviorRuntimeStatus,
    } = session;
    const { findSafeRoomPlayerPointNear, buildBehaviorSmoothTravelPath, resolveRoomBehaviorTarget } = navigation;
    const { roomBehaviorTravelRef } = motion;
    const { setBehaviorOutput, setBehaviorStatus, setNotice } = presentation;
    const { resolveBehaviorAction, resolveBehaviorPlace, generateBehaviorBranch, mergeBehaviorTreePatch } = generation;

    const behaviorRuntimeRef = useRef(null);
    const {
        activeBehaviorDialog,
        setActiveBehaviorDialog,
        interactionMenuOpen,
        setInteractionMenuOpen,
        behaviorChoicePendingRef,
        continueBehaviorDialog,
        exitBehaviorDialog,
        chooseBehaviorDialogChoice,
    } = useBehaviorDialog({
        behaviorPlaceId,
        behaviorLoading,
        behaviorPlaceOptions,
        behaviorCharacter,
        behaviorOrderedPlaces,
        behaviorInteractionSessionRef,
        autonomousBehaviorCooldownRef,
        keepBehaviorInteractionSessionActive,
        setBehaviorStatus,
        generateBehaviorBranch,
        behaviorRuntimeRef,
        clearBehaviorRuntime,
    });

    function runPlayerInteraction(actionId) {
        if (!behaviorInteractionState.nearby || behaviorLoading) return;
        const selectedAction = resolveBehaviorAction(actionId);
        const selectedPlace = resolveBehaviorPlace(behaviorPlaceId);
        const selectedPlaceId =
            selectedPlace?.id || behaviorPlaceId || behaviorPlaceOptions[0]?.id || 'room-point:center';
        const selectedPlaceLabel = selectedPlace?.label || '房间';
        if (actionId !== behaviorAction) setBehaviorAction(actionId);
        setInteractionMenuOpen(false);
        keepBehaviorInteractionSessionActive();
        if (behaviorRuntimeRef.current?.source === 'base') {
            clearBehaviorRuntime('');
        }
        const generatedStarterBranch = pickGeneratedInteractionStarterBranch(
            behaviorTreeStateRef.current || behaviorTreeState,
            actionId,
            selectedPlaceId,
            behaviorOrderedPlaces.map((place) => place.placeId),
            behaviorCharacterId,
        );
        const presetBranch =
            generatedStarterBranch ||
            createCommercialV2PresetInteractionBranch(actionId, selectedPlaceId, selectedPlaceLabel, {
                sceneType: 'room',
            });

        executeBehaviorBranch(presetBranch, generatedStarterBranch?.source || 'preset');
        setWorldPlayerBubble(commercialV2UserActorId, selectedAction?.label || '互动');
        setBehaviorStatus(
            `${generatedStarterBranch ? '已触发行为树互动枝丫' : '已触发本地兜底互动'}：${presetBranch.title}。请选择末尾选项生成后续回应。`,
        );
    }

    function executeBehaviorBranch(branch, source = 'manual') {
        if (!branch) {
            setBehaviorStatus('当前没有可执行的行为。');
            return;
        }
        const patchResult = mergeBehaviorTreePatch(
            createCommercialBehaviorPatchFromBranch(branch, source),
            branch,
            source,
        );
        setBehaviorOutput({
            branch,
            tree_patch: patchResult?.patch || null,
            tree_version: patchResult?.tree?.version || behaviorTreeState.version,
            fallback: source !== 'ai' && !String(source || '').startsWith('ai-'),
            error: '',
            raw_output: JSON.stringify(branch, null, 2),
        });
        if (patchResult?.activeBranch) activateBehaviorBranch(patchResult.activeBranch, source);
        setBehaviorStatus(
            source === 'demo'
                ? '已把 demo patch 合并进完整房间行为树，并开始执行。'
                : '已重新合并当前输出 patch 并执行。',
        );
    }

    function getBehaviorStepPlaceId(step) {
        return String(
            step?.place_id || step?.to_place_id || step?.target_place_id || step?.placeId || step?.toPlaceId || '',
        ).trim();
    }

    function activateBehaviorBranch(branch, source = 'ai') {
        if (!branch || !Array.isArray(branch.steps) || !branch.steps.length) return;
        const now = Date.now();
        roomBehaviorTravelRef.current = null;
        const ttl = Math.max(3000, Math.min(Number(branch.ttl_ms || branch.ttlMs) || 45000, 120000));
        const runtime = {
            id: `${branch.branch_id || branch.id || 'branch'}_${now}`,
            source,
            branch,
            stepIndex: 0,
            waitingUntil: 0,
            waitingForTravelId: '',
            expiresAt: now + ttl,
            startedAt: now,
        };
        behaviorRuntimeRef.current = runtime;
        const isBaseBranch = source === 'base' || branch.branch_kind === 'base';
        if (!isBaseBranch) keepBehaviorInteractionSessionActive();
        const branchKindLabel = isBaseBranch ? '日常行为' : '互动回应';
        const activeNodeId = branch.branch_id || branch.id || runtime.id;
        commitBehaviorTreeState((currentTree) => ({
            ...currentTree,
            active_node_id: activeNodeId,
            memory: {
                ...(currentTree.memory || {}),
                last_active_node_id: activeNodeId,
                last_active_source: source,
            },
        }));

        setActiveBehaviorDialog(null);
        setInteractionMenuOpen(false);
        setWorldPlayerBubble(commercialV2RoleActorId, branch.title || branchKindLabel);
        setNotice(`${branchKindLabel}开始执行：${branch.title || branch.branch_id || '未命名'}。`);
    }

    function clearBehaviorRuntime(message = '') {
        behaviorRuntimeRef.current = null;
        roomBehaviorTravelRef.current = null;

        setActiveBehaviorDialog((current) => (current?.type === 'pending' ? current : null));
        setWorldPlayerBubble(commercialV2RoleActorId, '');
        if (message) setNotice(message);
    }

    function activateBehaviorTravelFailureBranch(details = {}) {
        const tree = behaviorTreeStateRef.current || behaviorTreeState || createCommercialV2BehaviorTreeState();
        const recoveryBranch = pickCommercialBehaviorBaseBranchByTrigger(
            tree,
            commercialV2BehaviorTravelFailureTrigger,
            behaviorOrderedPlaces.map((place) => place.placeId),
            behaviorCharacterId,
        );
        if (!recoveryBranch) return false;
        commitBehaviorTreeState((currentTree) => ({
            ...currentTree,
            memory: {
                ...(currentTree.memory || {}),
                last_travel_failure: {
                    reason: String(details.reason || 'travel_failed').slice(0, 80),
                    action: String(details.action || '').slice(0, 80),
                    target_label: String(details.targetLabel || details.label || '').slice(0, 80),
                    at: Date.now(),
                },
            },
        }));
        setPlayerById(commercialV2RoleActorId, (current) => ({
            ...current,
            moving: false,
            frame: 0,
            stepTime: 0,
        }));
        activateBehaviorBranch(recoveryBranch, 'base');
        setBehaviorStatus(`循迹失败，已触发基础恢复枝丫：${recoveryBranch.title}`);
        return true;
    }

    function startBehaviorTravelStep(runtime, step) {
        const action = String(step?.action || '');
        let targetId = getBehaviorStepPlaceId(step);
        const roleCharacter =
            commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
        const userCharacter =
            commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0];
        const role = playersRef.current[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
        const user = playersRef.current[commercialV2UserActorId] || createRoomEditorPlayerState(userCharacter);
        if (
            (action === 'approach_player' || action === 'follow_player' || action === 'walk_with_player') &&
            !targetId
        ) {
            const side = role.x <= user.x ? -1 : 1;
            const targetPoint = findSafeRoomPlayerPointNear(
                clampRoomEditorPlayer({
                    ...role,
                    x: user.x + side * commercialV2PlayerApproachGap,
                    y: user.y,
                }),
                role,
            );
            const route = buildBehaviorSmoothTravelPath(role, targetPoint);
            if (!route.length) return false;
            const travelId = `${runtime.id}_step_${runtime.stepIndex}`;
            roomBehaviorTravelRef.current = {
                targetId: 'player',
                playerId: commercialV2RoleActorId,
                behaviorRuntimeId: runtime.id,
                behaviorTravelId: travelId,
                place: { facing: targetPoint.x < user.x ? 'right' : 'left' },
                point: route[route.length - 1],
                anchorPoint: targetPoint,
                path: route,
                pathIndex: 0,
                label: '玩家',
                action: action === 'follow_player' ? '跟随玩家' : action === 'walk_with_player' ? '陪你走' : '靠近玩家',
            };
            runtime.waitingForTravelId = travelId;
            setWorldPlayerBubble(commercialV2RoleActorId, action === 'follow_player' ? '跟上你' : '靠近你');
            return true;
        }
        if (!targetId && (action === 'wander_between' || action === 'patrol_segment')) {
            targetId = String(
                step?.to_place_id || step?.toPlaceId || step?.from_place_id || step?.fromPlaceId || '',
            ).trim();
        }
        if (!targetId) return false;
        const target = resolveRoomBehaviorTarget(targetId, role);
        if (!target) return false;
        const travelId = `${runtime.id}_step_${runtime.stepIndex}`;
        const route = target.path?.length ? target.path : [target.point];
        roomBehaviorTravelRef.current = {
            ...target,
            playerId: commercialV2RoleActorId,
            behaviorRuntimeId: runtime.id,
            behaviorTravelId: travelId,
            point: route[route.length - 1] || target.point,
            path: route,
            pathIndex: 0,
            action: step?.movement_style || target.action || '行动中',
        };
        runtime.waitingForTravelId = travelId;
        setWorldPlayerBubble(commercialV2RoleActorId, target.label ? `去 ${target.label}` : '行动中');
        return true;
    }

    function advanceBehaviorRuntime() {
        const runtime = behaviorRuntimeRef.current;
        if (!runtime?.branch) return;
        const now = Date.now();
        if ((runtime.waitingForDialog || runtime.waitingForChoice) && now > runtime.expiresAt - 10000) {
            runtime.expiresAt = now + 60000;
        }
        if (now > runtime.expiresAt) {
            const label = runtime.source === 'base' || runtime.branch.branch_kind === 'base' ? '日常行为' : '互动回应';
            clearBehaviorRuntime(`${label}已过期：${runtime.branch.title || runtime.branch.branch_id || '未命名'}。`);
            return;
        }
        if (runtime.waitingForDialog || runtime.waitingForChoice) return;
        if (runtime.waitingUntil && now < runtime.waitingUntil) return;
        if (runtime.waitingForTravelId) {
            if (roomBehaviorTravelRef.current?.behaviorTravelId === runtime.waitingForTravelId) return;
            runtime.waitingForTravelId = '';
            runtime.stepIndex += 1;
        }
        const steps = runtime.branch.steps || [];
        if (runtime.stepIndex >= steps.length) {
            const label = runtime.source === 'base' || runtime.branch.branch_kind === 'base' ? '日常行为' : '互动回应';
            clearBehaviorRuntime(`${label}执行完毕：${runtime.branch.title || runtime.branch.branch_id || '未命名'}。`);
            return;
        }
        const step = steps[runtime.stepIndex] || {};
        const action = String(step.action || '').trim();

        if (action === 'say' || action === 'emote') {
            const isBaseBranch = runtime.source === 'base' || runtime.branch.branch_kind === 'base';
            if (isBaseBranch) {
                const text = String(step.text || (action === 'say' ? '……' : '停顿了一下')).trim();
                setWorldPlayerBubble(commercialV2RoleActorId, text);
                setBehaviorRuntimeStatus(action === 'say' ? `日常行为气泡：${text}` : `日常行为动作：${text}`);
                const requestedDuration = Number(step.duration_ms || step.durationMs);
                const readableDuration = Math.min(5200, 1600 + text.length * 85);
                runtime.waitingUntil =
                    now +
                    Math.max(
                        1200,
                        Math.min(Number.isFinite(requestedDuration) ? requestedDuration : readableDuration, 5200),
                    );
                runtime.stepIndex += 1;
                return;
            }
            keepBehaviorInteractionSessionActive();
            runtime.waitingForDialog = true;
            runtime.waitingUntil = 0;
            setWorldPlayerBubble(commercialV2RoleActorId, '');
            setInteractionMenuOpen(false);
            setActiveBehaviorDialog({
                runtimeId: runtime.id,
                type: action,
                title: action === 'say' ? behaviorCharacter?.name || '角色' : '动作',
                text: String(step.text || (action === 'say' ? '……' : '停顿了一下')).trim(),
                stepIndex: runtime.stepIndex,
                totalSteps: steps.length,
            });
            setBehaviorStatus(
                action === 'say' ? '行为树等待：点击“下一句”继续角色台词。' : '行为树等待：点击“下一句”继续角色动作。',
            );
            return;
        }
        if (action === 'wait') {
            const isBaseBranch = runtime.source === 'base' || runtime.branch.branch_kind === 'base';
            runtime.waitingUntil = isBaseBranch
                ? now +
                  Math.max(
                      220,
                      Math.min(
                          Number(step.duration_ms || step.durationMs) || commercialV2BehaviorBaseWaitMs,
                          commercialV2BehaviorBaseWaitMs,
                      ),
                  )
                : now + Math.max(300, Math.min(Number(step.duration_ms || step.durationMs) || 900, 6000));
            runtime.stepIndex += 1;
            return;
        }
        if (action === 'face_player') {
            const roleCharacter =
                commercialV2PlayerCharacterById.get(commercialV2RoleActorId) || commercialV2PlayerCharacters[0];
            const userCharacter =
                commercialV2PlayerCharacterById.get(commercialV2UserActorId) || commercialV2PlayerCharacters[0];
            const role = playersRef.current[commercialV2RoleActorId] || createRoomEditorPlayerState(roleCharacter);
            const user = playersRef.current[commercialV2UserActorId] || createRoomEditorPlayerState(userCharacter);
            const direction = getRoomEditorDirectionFromDelta(user.x - role.x, user.y - role.y, role.direction);
            setPlayerById(commercialV2RoleActorId, (current) => ({
                ...current,
                direction,
                moving: false,
                frame: 0,
            }));
            runtime.waitingUntil = now + 350;
            runtime.stepIndex += 1;
            return;
        }
        if (
            action === 'go_to_place' ||
            action === 'walk_with_player' ||
            action === 'idle_at_place' ||
            action === 'browse_near' ||
            action === 'loop_in_front_of' ||
            action === 'wander_between' ||
            action === 'patrol_segment' ||
            action === 'approach_player' ||
            action === 'follow_player'
        ) {
            const moved = startBehaviorTravelStep(runtime, step);
            if (!moved) {
                if (
                    activateBehaviorTravelFailureBranch({
                        reason: 'travel_start_failed',
                        action,
                        targetLabel: getBehaviorStepPlaceId(step) || step.movement_style || action,
                    })
                )
                    return;
                setWorldPlayerBubble(commercialV2RoleActorId, step.movement_style || action);
                const isBaseBranch = runtime.source === 'base' || runtime.branch.branch_kind === 'base';
                runtime.waitingUntil = now + (isBaseBranch ? commercialV2BehaviorBaseFallbackMs : 1200);
                runtime.stepIndex += 1;
            }
            return;
        }
        if (action === 'offer_choices') {
            const choices = normalizeBehaviorDialogChoices(step.choices);
            keepBehaviorInteractionSessionActive();
            runtime.waitingForChoice = true;
            runtime.waitingUntil = 0;
            setWorldPlayerBubble(commercialV2RoleActorId, '');
            setInteractionMenuOpen(false);
            setActiveBehaviorDialog({
                runtimeId: runtime.id,
                type: 'choice',
                title: behaviorCharacter?.name || '角色',
                text: String(step.text || '你要怎么回应？').trim(),
                choices,
                stepIndex: runtime.stepIndex,
                totalSteps: steps.length,
            });
            setBehaviorStatus('行为树等待：请选择玩家回应。');
            return;
        }
        runtime.stepIndex += 1;
    }
    const runPlayerInteractionEvent = useEventCallback(runPlayerInteraction);

    const executeBehaviorBranchEvent = useEventCallback(executeBehaviorBranch);
    const activateBehaviorBranchEvent = useEventCallback(activateBehaviorBranch);
    const clearBehaviorRuntimeEvent = useEventCallback(clearBehaviorRuntime);
    const activateBehaviorTravelFailureBranchEvent = useEventCallback(activateBehaviorTravelFailureBranch);
    const advanceBehaviorRuntimeEvent = useEventCallback(advanceBehaviorRuntime);
    return {
        activeBehaviorDialog,
        setActiveBehaviorDialog,
        interactionMenuOpen,
        setInteractionMenuOpen,
        runPlayerInteraction: runPlayerInteractionEvent,
        continueBehaviorDialog,
        exitBehaviorDialog,
        chooseBehaviorDialogChoice,
        executeBehaviorBranch: executeBehaviorBranchEvent,
        activateBehaviorBranch: activateBehaviorBranchEvent,
        clearBehaviorRuntime: clearBehaviorRuntimeEvent,
        activateBehaviorTravelFailureBranch: activateBehaviorTravelFailureBranchEvent,
        advanceBehaviorRuntime: advanceBehaviorRuntimeEvent,
        behaviorRuntimeRef,
        behaviorChoicePendingRef,
    };
}
