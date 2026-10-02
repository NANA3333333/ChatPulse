import { useRef, useState } from 'react';
import { useEventCallback } from '../../../../shared/hooks/useEventCallback.js';
import { resolveBehaviorChoiceTrigger, resolveBehaviorChoicePlaceIdFromPlaces } from '../behaviorTreeCore.js';
// Shared dialog state and choice submission lock; scene runtimes supply activation and generation.
export function useBehaviorDialog({
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
}) {
    const [activeBehaviorDialog, setActiveBehaviorDialog] = useState(null);
    const [interactionMenuOpen, setInteractionMenuOpen] = useState(false);
    const behaviorChoicePendingRef = useRef(false);
    function continueBehaviorDialog() {
        const runtime = behaviorRuntimeRef.current;
        if (runtime && activeBehaviorDialog?.runtimeId === runtime.id) {
            keepBehaviorInteractionSessionActive();
            runtime.waitingForDialog = false;
            runtime.waitingForChoice = false;
            runtime.stepIndex += 1;
            runtime.waitingUntil = Date.now() + 120;
            setBehaviorStatus('已继续执行当前行为。');
        }
        setActiveBehaviorDialog(null);
    }

    function exitBehaviorDialog() {
        behaviorInteractionSessionRef.current = { active: false, expiresAt: 0 };
        autonomousBehaviorCooldownRef.current = Date.now() + 800;
        clearBehaviorRuntime('已退出互动对话。');
        setInteractionMenuOpen(false);
        setBehaviorStatus('已退出互动对话。');
    }

    async function chooseBehaviorDialogChoice(choice) {
        if (behaviorChoicePendingRef.current || behaviorLoading) {
            setBehaviorStatus('正在处理上一个玩家回应，请稍等。');
            return;
        }
        const triggerAction = resolveBehaviorChoiceTrigger(choice);
        const resolvedChoicePlaceId = resolveBehaviorChoicePlaceIdFromPlaces(
            choice,
            triggerAction,
            behaviorOrderedPlaces,
            behaviorPlaceOptions,
        );
        const nextPlaceId = String(
            resolvedChoicePlaceId || (triggerAction === 'suggest_destination' ? '' : behaviorPlaceId) || '',
        ).trim();
        if (!triggerAction) {
            setBehaviorStatus('该选项缺少有效后续动作，请换一个回应。');
            setActiveBehaviorDialog((current) =>
                current ? { ...current, text: '该选项缺少有效后续动作，请换一个回应。' } : current,
            );
            return;
        }
        if (triggerAction === 'suggest_destination' && !nextPlaceId) {
            setBehaviorStatus('该选项没有可识别的目标地点，请换一个回应。');
            setActiveBehaviorDialog((current) =>
                current ? { ...current, text: '该选项没有可识别的目标地点，请换一个回应。' } : current,
            );
            return;
        }
        behaviorChoicePendingRef.current = true;
        keepBehaviorInteractionSessionActive();
        const selectedLabel = String(choice?.label || choice?.text || '这个回应').trim();
        const previousDialog = activeBehaviorDialog;
        setInteractionMenuOpen(false);
        setBehaviorStatus(`已选择“${selectedLabel}”，正在生成后续互动回应...`);
        setActiveBehaviorDialog({
            runtimeId: activeBehaviorDialog?.runtimeId || '',
            type: 'pending',
            title: behaviorCharacter?.name || '角色',
            text: `已选择“${selectedLabel}”，正在生成后续互动回应...`,
            choices: [],
            stepIndex: activeBehaviorDialog?.stepIndex || 0,
            totalSteps: activeBehaviorDialog?.totalSteps || 1,
        });
        try {
            const branchResult = await generateBehaviorBranch({
                actionId: triggerAction,
                placeId: nextPlaceId || behaviorPlaceId,
            });
            if (!branchResult?.ok) {
                setActiveBehaviorDialog({
                    ...(previousDialog || {}),
                    runtimeId: previousDialog?.runtimeId || '',
                    type: 'choice',
                    title: previousDialog?.title || behaviorCharacter?.name || '角色',
                    text: `后续枝丫生成失败：${branchResult?.error || '请重试。'}`,
                    choices: previousDialog?.choices?.length ? previousDialog.choices : [choice],
                    stepIndex: previousDialog?.stepIndex || 0,
                    totalSteps: previousDialog?.totalSteps || 1,
                });
                return;
            }
            setActiveBehaviorDialog((current) => (current?.type === 'pending' ? null : current));
        } finally {
            behaviorChoicePendingRef.current = false;
        }
    }
    const continueBehaviorDialogEvent = useEventCallback(continueBehaviorDialog);
    const exitBehaviorDialogEvent = useEventCallback(exitBehaviorDialog);
    const chooseBehaviorDialogChoiceEvent = useEventCallback(chooseBehaviorDialogChoice);
    return {
        activeBehaviorDialog,
        setActiveBehaviorDialog,
        interactionMenuOpen,
        setInteractionMenuOpen,
        behaviorChoicePendingRef,
        continueBehaviorDialog: continueBehaviorDialogEvent,
        exitBehaviorDialog: exitBehaviorDialogEvent,
        chooseBehaviorDialogChoice: chooseBehaviorDialogChoiceEvent,
    };
}
