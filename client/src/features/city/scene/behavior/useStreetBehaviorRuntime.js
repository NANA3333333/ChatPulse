import { useBehaviorDialog } from './useBehaviorDialog.js';
import { useRef } from 'react';
import {
    createCommercialV2PlayerState,
    commercialV2PlayerCharacters,
    commercialV2PlayerCharacterById,
    getCommercialV2LoopDeltaX,
    commercialV2PlayerApproachGap,
} from '../commercialStreetCore.js';
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
import { useEventCallback } from '../../../../shared/hooks/useEventCallback.js';

// Behavior activation, step execution, dialog choices and travel commands. Movement is provided by the scene navigation and motion ports.
export function useStreetBehaviorRuntime({
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
        behaviorAction,
        setBehaviorAction,
        behaviorPlaceId,
        behaviorLoading,
        behaviorPlaceOptions,
        behaviorCharacter,
        activeBehaviorCharacterId,
        behaviorInteractionState,
    } = selection;
    const {
        playersRef,
        setPlayerById,
        setWorldPlayerBubble,
        getCurrentBehaviorActorId,
        getCurrentBehaviorUserActorId,
    } = actors;
    const { behaviorTreeStateRef, behaviorTreeState, behaviorOrderedPlaces, commitBehaviorTreeState } = tree;
    const {
        behaviorInteractionSessionRef,
        autonomousBehaviorCooldownRef,
        keepBehaviorInteractionSessionActive,
        setBehaviorRuntimeStatus,
    } = session;
    const {
        stageSize,
        buildAutoTravelPath,
        getNearestWalkablePlayerPoint,
        resolveAutoTravelTarget,
        buildBehaviorSmoothTravelPath,
    } = navigation;
    const { setAutoTravelActive, autoTravelRef } = motion;
    const {
        setNotice,
        setPlayerActionBubble,
        setBehaviorInput,
        setBehaviorOutput,
        setActiveBehaviorBranch,
        setBehaviorStatus,
    } = presentation;
    const {
        resolveBehaviorAction,
        resolveBehaviorPlace,
        buildBehaviorPendingInput,
        generateBehaviorBranch,
        mergeBehaviorTreePatch,
    } = generation;

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
        const selectedPlaceId = selectedPlace?.id || behaviorPlaceId || 'restaurant';
        const selectedPlaceLabel = selectedPlace?.label || '街区';
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
            activeBehaviorCharacterId,
        );
        const presetBranch =
            generatedStarterBranch ||
            createCommercialV2PresetInteractionBranch(actionId, selectedPlaceId, selectedPlaceLabel);
        setBehaviorInput(
            buildBehaviorPendingInput(
                { actionId, placeId: selectedPlaceId },
                generatedStarterBranch
                    ? '当前行为树互动开场枝丫；末尾选项会用这个动作继续生成。'
                    : '当前本地兜底互动请求；末尾选项会用这个动作继续生成。',
            ),
        );
        executeBehaviorBranch(presetBranch, generatedStarterBranch?.source || 'preset');
        setPlayerActionBubble(selectedAction?.label || '互动');
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
            source === 'demo' ? '已把 demo patch 合并进完整行为树，并开始执行。' : '已重新合并当前输出 patch 并执行。',
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
        if (autoTravelRef.current?.behaviorRuntimeId) {
            autoTravelRef.current = null;
            setAutoTravelActive(false);
        }
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
        setActiveBehaviorBranch({
            branch_id: activeNodeId,
            title: branch.title || branchKindLabel,
            summary: branch.summary || '',
            branchKindLabel,
            source,
            stepIndex: 0,
            totalSteps: branch.steps.length,
            expiresAt: runtime.expiresAt,
        });
        setActiveBehaviorDialog(null);
        setInteractionMenuOpen(false);
        setWorldPlayerBubble(getCurrentBehaviorActorId(), branch.title || branchKindLabel);
        setNotice(`${branchKindLabel}开始执行：${branch.title || branch.branch_id || '未命名'}。`);
    }

    function clearBehaviorRuntime(message = '') {
        behaviorRuntimeRef.current = null;
        if (autoTravelRef.current?.behaviorRuntimeId) {
            autoTravelRef.current = null;
            setAutoTravelActive(false);
        }
        setActiveBehaviorBranch(null);
        setActiveBehaviorDialog((current) => (current?.type === 'pending' ? current : null));
        setWorldPlayerBubble(getCurrentBehaviorActorId(), '');
        if (message) setNotice(message);
    }

    function activateBehaviorTravelFailureBranch(details = {}) {
        const tree = behaviorTreeStateRef.current || behaviorTreeState || createCommercialV2BehaviorTreeState();
        const recoveryBranch = pickCommercialBehaviorBaseBranchByTrigger(
            tree,
            commercialV2BehaviorTravelFailureTrigger,
            behaviorOrderedPlaces.map((place) => place.placeId),
            activeBehaviorCharacterId,
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
        setPlayerById(getCurrentBehaviorActorId(), (current) => ({
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
        const behaviorActor = getCurrentBehaviorActorId();
        const behaviorUser = getCurrentBehaviorUserActorId(behaviorActor);
        if ((action === 'approach_player' || action === 'follow_player') && !targetId) {
            const roleCharacter = commercialV2PlayerCharacterById.get(behaviorActor) || commercialV2PlayerCharacters[0];
            const userCharacter = commercialV2PlayerCharacterById.get(behaviorUser) || commercialV2PlayerCharacters[0];
            const role = playersRef.current[behaviorActor] || createCommercialV2PlayerState(roleCharacter);
            const user = playersRef.current[behaviorUser] || createCommercialV2PlayerState(userCharacter);
            const dx = getCommercialV2LoopDeltaX(role.x, user.x, stageSize.width);
            const targetPoint = getNearestWalkablePlayerPoint(
                user.x - Math.sign(dx || 1) * commercialV2PlayerApproachGap,
                user.y,
                role,
                {
                    useAutoTravelBlocks: true,
                    fallbackToCurrent: false,
                },
            );
            const route = targetPoint ? buildAutoTravelPath(role, targetPoint) : null;
            const smoothPath = buildBehaviorSmoothTravelPath(role, targetPoint);
            if (!smoothPath.length && !route?.waypoints?.length) return false;
            const travelId = `${runtime.id}_step_${runtime.stepIndex}`;
            autoTravelRef.current = {
                targetId: 'player',
                playerId: behaviorActor,
                behaviorRuntimeId: runtime.id,
                behaviorTravelId: travelId,
                place: { facing: dx > 0 ? 'right' : 'left' },
                point: smoothPath[smoothPath.length - 1] || route.destination,
                anchorPoint: targetPoint,
                path: smoothPath.length ? smoothPath : route.waypoints,
                semanticSlide: true,
                pathIndex: 0,
                stuckTime: 0,
                lastX: role.x,
                lastY: role.y,
                label: '玩家',
                action: action === 'follow_player' ? '跟随玩家' : '靠近玩家',
            };
            runtime.waitingForTravelId = travelId;
            setAutoTravelActive(true);
            setWorldPlayerBubble(behaviorActor, action === 'follow_player' ? '跟上你' : '靠近你');
            return true;
        }
        if (!targetId) return false;
        const roleCharacter = commercialV2PlayerCharacterById.get(behaviorActor) || commercialV2PlayerCharacters[0];
        const role = playersRef.current[behaviorActor] || createCommercialV2PlayerState(roleCharacter);
        const target = resolveAutoTravelTarget(targetId, role);
        if (!target) return false;
        const travelId = `${runtime.id}_step_${runtime.stepIndex}`;
        const targetPoint = target.anchorPoint || target.point;
        const smoothPath = buildBehaviorSmoothTravelPath(role, targetPoint);
        autoTravelRef.current = {
            ...target,
            playerId: behaviorActor,
            behaviorRuntimeId: runtime.id,
            behaviorTravelId: travelId,
            point: smoothPath[smoothPath.length - 1] || target.point,
            path: smoothPath.length ? smoothPath : target.path,
            semanticSlide: true,
            pathIndex: 0,
            stuckTime: 0,
            lastX: role.x,
            lastY: role.y,
            action: step?.movement_style || target.action || '行动中',
        };
        runtime.waitingForTravelId = travelId;
        setAutoTravelActive(true);
        setWorldPlayerBubble(behaviorActor, target.label ? `去 ${target.label}` : '行动中');
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
            if (autoTravelRef.current?.behaviorTravelId === runtime.waitingForTravelId) return;
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
        setActiveBehaviorBranch((current) =>
            current
                ? {
                      ...current,
                      stepIndex: runtime.stepIndex,
                      totalSteps: steps.length,
                      currentAction: action,
                  }
                : current,
        );
        if (action === 'say' || action === 'emote') {
            const isBaseBranch = runtime.source === 'base' || runtime.branch.branch_kind === 'base';
            if (isBaseBranch) {
                const text = String(step.text || (action === 'say' ? '……' : '停顿了一下')).trim();
                setWorldPlayerBubble(getCurrentBehaviorActorId(), text);
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
            setWorldPlayerBubble(getCurrentBehaviorActorId(), '');
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
            const behaviorActor = getCurrentBehaviorActorId();
            const behaviorUser = getCurrentBehaviorUserActorId(behaviorActor);
            const roleCharacter = commercialV2PlayerCharacterById.get(behaviorActor) || commercialV2PlayerCharacters[0];
            const userCharacter = commercialV2PlayerCharacterById.get(behaviorUser) || commercialV2PlayerCharacters[0];
            const role = playersRef.current[behaviorActor] || createCommercialV2PlayerState(roleCharacter);
            const user = playersRef.current[behaviorUser] || createCommercialV2PlayerState(userCharacter);
            const dx = getCommercialV2LoopDeltaX(role.x, user.x, stageSize.width);
            const dy = user.y - role.y;
            const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back';
            setPlayerById(behaviorActor, (current) => ({
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
                setWorldPlayerBubble(getCurrentBehaviorActorId(), step.movement_style || action);
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
            setWorldPlayerBubble(getCurrentBehaviorActorId(), '');
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
