import {
    commercialV2RoleActorId,
    createCommercialV2PlayerState,
    commercialV2PlayerCharacters,
    commercialV2PlayerCharacterById,
    commercialV2UserActorId,
} from '../commercialStreetCore.js';
import {
    summarizeMountedGeneratedBehaviorBranches,
    commercialV2BehaviorActions,
    buildBehaviorTreePayloadSummary,
    commercialV2BehaviorMovementActions,
    summarizeBehaviorPlaceForPayload,
    buildCommercialBehaviorContextConfig,
    fetchBehaviorJsonWithTimeout,
    getBehaviorAuthHeaders,
    mergeCommercialBehaviorIterationStateFromInput,
    commercialV2BehaviorGenerationTimeoutMs,
    formatBehaviorRequestError,
    createCommercialBehaviorTreeRebuildState,
    commercialV2BehaviorBaseGenerationTimeoutMs,
    mergeCommercialBehaviorTreePatchForRuntime,
    mergeCommercialBehaviorTreePatchesForRuntime,
} from '../behaviorTreeCore.js';

export function createCommercialBehaviorRequests({
    behaviorActorIdRef,
    behaviorTargetActorId,
    behaviorCharacterId,
    behaviorCharacters,
    setBehaviorStatus,
    setNotice,
    setBehaviorActorId,
    setBehaviorCharacterId,
    setBehaviorActorBindings,
    controlledPlayerId,
    behaviorAction,
    behaviorPlaceId,
    behaviorPlaceOptions,
    placeLinks,
    userProfile,
    players,
    behaviorTreeState,
    behaviorConfig,
    behaviorPromptText,
    behaviorOrderedPlaces,
    behaviorCharacter,
    behaviorUserActorId,
    behaviorActorCharacter,
    activeBehaviorCharacterId,
    apiUrl,
    setBehaviorFoldOpen,
    setBehaviorLoading,
    setBehaviorInput,
    setBehaviorOutput,
    commitBehaviorTreeState,
    setBehaviorAction,
    setBehaviorPlaceId,
    setPlayerActionBubble,
    activateBehaviorBranch,
    clearBehaviorStatusHold,
    behaviorTreeStateRef,
    setBehaviorStatusPinned,
    autonomousBehaviorCursorRef,
    autonomousBehaviorRecentRef,
    clearBehaviorRuntime,
    autonomousBehaviorCooldownRef,
    persistBehaviorTreeStateToServer,
    setBehaviorPatchOutput,
}) {
    function getCurrentBehaviorActorId() {
        const actorId = behaviorActorIdRef.current || behaviorTargetActorId || commercialV2RoleActorId;
        return commercialV2PlayerCharacterById.has(actorId) ? actorId : commercialV2RoleActorId;
    }

    function getCurrentBehaviorUserActorId(actorId = getCurrentBehaviorActorId()) {
        return actorId === commercialV2UserActorId ? commercialV2RoleActorId : commercialV2UserActorId;
    }

    function bindBehaviorActorToCharacter(actorId = behaviorTargetActorId, characterId = behaviorCharacterId) {
        const safeActorId = commercialV2PlayerCharacterById.has(actorId) ? actorId : behaviorTargetActorId;
        const safeCharacterId = String(characterId || '').trim();
        const selectedCharacter = behaviorCharacters.find((item) => item.id === safeCharacterId);
        const selectedActorCharacter =
            commercialV2PlayerCharacterById.get(safeActorId) || commercialV2PlayerCharacters[0];
        if (!selectedCharacter) {
            const message = '先选择一个已经创建的实际角色，再绑定到皮套。';
            setBehaviorStatus(message);
            setNotice(message);
            return false;
        }
        setBehaviorActorId(safeActorId);
        setBehaviorCharacterId(selectedCharacter.id);
        setBehaviorActorBindings((current) => ({
            ...current,
            [safeActorId]: selectedCharacter.id,
        }));
        const message = `已绑定：${selectedActorCharacter.label} -> ${selectedCharacter.name || selectedCharacter.id}。后续行为树会读取这个实际角色的上下文。`;
        setBehaviorStatus(message);
        setNotice(message);
        return true;
    }

    function bindControlledSkinToBehaviorCharacter() {
        const safeActorId = commercialV2PlayerCharacterById.has(controlledPlayerId)
            ? controlledPlayerId
            : commercialV2RoleActorId;
        bindBehaviorActorToCharacter(safeActorId, behaviorCharacterId);
    }

    function resolveBehaviorAction(actionId = behaviorAction) {
        return commercialV2BehaviorActions.find((item) => item.id === actionId) || commercialV2BehaviorActions[0];
    }

    function resolveBehaviorPlace(placeId = behaviorPlaceId) {
        return (
            behaviorPlaceOptions.find((option) => option.id === placeId) ||
            behaviorPlaceOptions.find((option) => option.id === 'restaurant') ||
            behaviorPlaceOptions[0] ||
            null
        );
    }

    function resolveBehaviorPlaceLink(placeOption) {
        if (!placeOption) return null;
        const targetId = String(placeOption.id || '');
        return (
            placeLinks.find(
                (place) =>
                    place.placeId === targetId ||
                    place.locationId === targetId ||
                    place.locationIds?.includes(targetId),
            ) || null
        );
    }

    function getBehaviorUserDisplayName() {
        return String(userProfile?.name || '').trim() || '用户';
    }

    function summarizeBehaviorActor(actorId, label, options = {}) {
        const character = commercialV2PlayerCharacterById.get(actorId) || commercialV2PlayerCharacters[0];
        const actor = players[actorId] || createCommercialV2PlayerState(character);
        const semanticRole =
            options.semanticRole || (actorId === commercialV2UserActorId ? 'player_user' : 'character_actor');
        const boundCharacter = options.boundCharacter || null;
        const isUserActor = semanticRole === 'player_user';
        const displayName = isUserActor ? getBehaviorUserDisplayName() : boundCharacter?.name || character.label;
        return {
            id: actorId,
            label: isUserActor ? displayName : label,
            display_name: displayName,
            semantic_role: semanticRole,
            sprite: character.label,
            bound_character_id: boundCharacter?.id || '',
            bound_character_name: boundCharacter?.name || '',
            direction: actor.direction,
            moving: Boolean(actor.moving),
            controlled: actorId === controlledPlayerId,
            movement_mode: 'side_scrolling_semantic',
        };
    }

    function summarizeBehaviorTreeForPayload(treeState = behaviorTreeState) {
        return buildBehaviorTreePayloadSummary(treeState, behaviorConfig, 'street_runtime_single_character');
    }

    function buildBehaviorPayload(options = {}) {
        const selectedAction = resolveBehaviorAction(options.actionId || behaviorAction);
        const selectedPlace = resolveBehaviorPlace(options.placeId || behaviorPlaceId);
        const selectedPlaceLink = resolveBehaviorPlaceLink(selectedPlace);
        return {
            player_event: {
                active: true,
                actor_role: 'player_user',
                actor_name: getBehaviorUserDisplayName(),
                action: selectedAction?.id || options.actionId || behaviorAction,
                action_label: selectedAction?.label || options.actionId || behaviorAction,
                action_hint: selectedAction?.hint || '',
                place_id: selectedPlace?.id || options.placeId || behaviorPlaceId || '',
                place_label: selectedPlace?.label || '',
                free_text: behaviorPromptText,
            },
            world: {
                movement_model: 'side_scrolling_semantic_v1',
                movement_rule:
                    '角色可以决定自由活动、靠近玩家、闲逛或去语义地点；不要生成像素坐标，前端会把 place_id 映射到本地平移锚点。',
                ordered_place_text: behaviorOrderedPlaces.map((place) => `${place.order}. ${place.name}`).join(' -> '),
                allowed_place_ids: behaviorOrderedPlaces.map((place) => place.placeId),
                allowed_movement_actions: commercialV2BehaviorMovementActions,
                actors: {
                    role: summarizeBehaviorActor(behaviorTargetActorId, '角色小人', {
                        semanticRole: 'character_actor',
                        boundCharacter: behaviorCharacter,
                    }),
                    user: summarizeBehaviorActor(behaviorUserActorId, '玩家小人', {
                        semanticRole: 'player_user',
                    }),
                },
                actor_binding: {
                    skin_actor_id: behaviorTargetActorId,
                    skin_label: behaviorActorCharacter.label,
                    character_id: behaviorCharacter?.id || '',
                    character_name: behaviorCharacter?.name || '',
                },
                selected_place: selectedPlace
                    ? {
                          id: selectedPlace.id,
                          label: selectedPlace.label,
                          place: summarizeBehaviorPlaceForPayload(selectedPlaceLink),
                      }
                    : null,
                places_ordered: behaviorOrderedPlaces
                    .map((place) => summarizeBehaviorPlaceForPayload(place))
                    .filter(Boolean),
                free_activity_options: [
                    'go_to_place: 前往表内地点',
                    'wander_between: 在两个表内地点之间来回闲逛',
                    'loop_in_front_of: 在表内地点前小范围循环移动',
                    'browse_near: 在表内地点附近停停走走',
                    'patrol_segment: 在两个表内地点之间巡逻',
                    'approach_player: 靠近玩家',
                    'follow_player: 跟随玩家',
                    'walk_with_player: 陪玩家向表内地点移动',
                    'idle_at_place: 在表内地点附近停留',
                ],
            },
            behavior_context: buildCommercialBehaviorContextConfig(behaviorConfig),
            behavior_tree: summarizeBehaviorTreeForPayload(options.behaviorTreeState || behaviorTreeState),
        };
    }

    function buildBehaviorPendingInput(options = {}, note = '当前前端请求；服务端会重新补齐 large_input。') {
        return {
            ...buildBehaviorPayload(options),
            debug_source: 'client_pending_behavior_request',
            debug_note: note,
        };
    }

    async function generateBehaviorBranch(options = {}) {
        if (!activeBehaviorCharacterId) {
            const message = '没有可用角色，先在角色设置里创建或启用一个角色。';
            setBehaviorStatus(message);
            setNotice(message);
            return;
        }
        const actionId = options.actionId || behaviorAction;
        const placeId = options.placeId || behaviorPlaceId;
        const selectedAction = resolveBehaviorAction(actionId);
        if (actionId !== behaviorAction) setBehaviorAction(actionId);
        if (placeId && placeId !== behaviorPlaceId) setBehaviorPlaceId(placeId);
        const pendingMessage = '正在生成互动回应...模型请求可能需要几十秒，请稍等。';
        setBehaviorFoldOpen((current) => ({ ...current, runtime: true, debug: true }));
        setBehaviorLoading(true);
        setBehaviorStatus(pendingMessage);
        setNotice(pendingMessage);
        setPlayerActionBubble(selectedAction?.label || '互动');
        const requestPayload = buildBehaviorPayload({ actionId, placeId });
        setBehaviorInput(
            buildBehaviorPendingInput({ actionId, placeId }, '当前点击选项产生的请求；服务端会重新补齐 large_input。'),
        );
        setBehaviorOutput(null);
        try {
            const { response, data } = await fetchBehaviorJsonWithTimeout(
                `${apiUrl}/city/characters/${encodeURIComponent(activeBehaviorCharacterId)}/behavior-branch`,
                {
                    method: 'POST',
                    headers: getBehaviorAuthHeaders(),
                    body: JSON.stringify({
                        ...requestPayload,
                        api_endpoint: behaviorConfig.api_endpoint,
                        api_key: behaviorConfig.api_key,
                        model_name: behaviorConfig.model_name,
                    }),
                },
                commercialV2BehaviorGenerationTimeoutMs,
            );
            if (!response.ok) throw new Error(data?.error || `生成失败 ${response.status}`);
            setBehaviorInput(data.input || null);
            const source = 'ai';
            const patchResult = mergeBehaviorTreePatch(data.tree_patch || data.patch, data.branch, source, data.input);
            setBehaviorOutput({
                branch: data.branch || null,
                tree_patch: patchResult?.patch || data.tree_patch || data.patch || null,
                tree_version: patchResult?.tree?.version || behaviorTreeState.version,
                fallback: false,
                error: data.error || '',
                raw_output: data.raw_output || '',
            });
            if (patchResult?.activeBranch) activateBehaviorBranch(patchResult.activeBranch, source);
            const message = 'AI patch 已合并进完整行为树。';
            setBehaviorStatus(message);
            setNotice(message);
            return { ok: true, patchResult };
        } catch (error) {
            const message = formatBehaviorRequestError(error, '互动回应生成失败，请重试。');
            const statusMessage = `互动回应生成失败：${message}`;
            setBehaviorStatus(statusMessage);
            setNotice(statusMessage);
            setBehaviorOutput({
                branch: null,
                tree_patch: null,
                tree_version: behaviorTreeState.version,
                fallback: false,
                error: message,
                raw_output: '',
            });
            return { ok: false, error: message };
        } finally {
            setBehaviorLoading(false);
        }
    }

    async function generateBaseBehaviorBranches() {
        if (!activeBehaviorCharacterId) {
            const message = '没有可用角色，先在角色设置里创建或启用一个角色。';
            setBehaviorStatus(message);
            setNotice(message);
            return;
        }
        const pendingMessage = '正在生成行为枝丫池...基础枝丫和互动开场会一起生成，可能需要 1-2 分钟。';
        setBehaviorLoading(true);
        clearBehaviorStatusHold();
        setBehaviorStatus(pendingMessage);
        setNotice(pendingMessage);
        setBehaviorFoldOpen((current) => ({ ...current, runtime: true, debug: true }));
        const rebuildTree = createCommercialBehaviorTreeRebuildState(
            behaviorTreeStateRef.current || behaviorTreeState,
            'street_runtime_single_character',
        );
        const requestPayload = buildBehaviorPayload({ behaviorTreeState: rebuildTree });
        setBehaviorInput({
            ...requestPayload,
            debug_source: 'client_pending_behavior_base_request',
            debug_note: '当前日常行为整体重建请求；旧枝丫上下文已清空，服务端会重新补齐 large_input。',
        });
        setBehaviorOutput(null);
        try {
            const { response, data } = await fetchBehaviorJsonWithTimeout(
                `${apiUrl}/city/characters/${encodeURIComponent(activeBehaviorCharacterId)}/behavior-base-branches`,
                {
                    method: 'POST',
                    headers: getBehaviorAuthHeaders(),
                    body: JSON.stringify({
                        ...requestPayload,
                        api_endpoint: behaviorConfig.api_endpoint,
                        api_key: behaviorConfig.api_key,
                        model_name: behaviorConfig.model_name,
                    }),
                },
                commercialV2BehaviorBaseGenerationTimeoutMs,
            );
            if (!response.ok) throw new Error(data?.error || `生成失败 ${response.status}`);
            setBehaviorInput(data.input || null);
            const combinedPatches = [
                ...(data.base_patches || []).map((patch) => ({ ...(patch || {}), source: patch?.source || 'ai-base' })),
                ...(data.interaction_patches || []).map((patch) => ({
                    ...(patch || {}),
                    source: patch?.source || 'ai-interaction-starter',
                })),
            ];
            const previousBehaviorTree = behaviorTreeStateRef.current || behaviorTreeState;
            const patchResult = mergeBehaviorTreePatches(combinedPatches, 'ai-tree', rebuildTree, data.input);
            const baseBranchCount = data.base_branches?.length || 0;
            const interactionBranchCount = data.interaction_branches?.length || 0;
            const mountedGenerated = patchResult?.tree
                ? summarizeMountedGeneratedBehaviorBranches(patchResult.tree)
                : { base_count: 0, interaction_count: 0, generated_node_count: 0 };
            if (!patchResult?.tree || !patchResult?.patches?.length) {
                const message = 'AI 返回了枝丫，但没有可合并 patch；运行树未替换。';
                const statusMessage = `日常行为生成失败：${message}`;
                setBehaviorOutput({
                    base_branches: data.base_branches || [],
                    base_patches: data.base_patches || [],
                    interaction_branches: data.interaction_branches || [],
                    interaction_patches: data.interaction_patches || [],
                    merged_patches: [],
                    mounted_generated: mountedGenerated,
                    tree_version: behaviorTreeState.version,
                    fallback: false,
                    error: message,
                    raw_output: data.raw_output || '',
                    json_retry_used: !!data.json_retry_used,
                });
                setBehaviorStatusPinned(statusMessage, 60000);
                setNotice(statusMessage);
                return;
            }
            if (baseBranchCount > 0 && mountedGenerated.base_count <= 0) {
                const message = 'AI 返回了基础枝丫，但没有挂进基础行为池；运行树已回滚。';
                const statusMessage = `日常行为生成失败：${message}`;
                commitBehaviorTreeState(previousBehaviorTree);
                setBehaviorOutput({
                    base_branches: data.base_branches || [],
                    base_patches: data.base_patches || [],
                    interaction_branches: data.interaction_branches || [],
                    interaction_patches: data.interaction_patches || [],
                    merged_patches: patchResult?.patches || [],
                    mounted_generated: mountedGenerated,
                    tree_version: behaviorTreeState.version,
                    fallback: false,
                    error: message,
                    raw_output: data.raw_output || '',
                    json_retry_used: !!data.json_retry_used,
                });
                setBehaviorStatusPinned(statusMessage, 60000);
                setNotice(statusMessage);
                return;
            }
            setBehaviorOutput({
                base_branches: data.base_branches || [],
                base_patches: data.base_patches || [],
                interaction_branches: data.interaction_branches || [],
                interaction_patches: data.interaction_patches || [],
                merged_patches: patchResult?.patches || [],
                mounted_generated: mountedGenerated,
                tree_version: patchResult?.tree?.version || behaviorTreeState.version,
                fallback: false,
                error: data.error || '',
                raw_output: data.raw_output || '',
                json_retry_used: !!data.json_retry_used,
            });
            autonomousBehaviorCursorRef.current = 0;
            autonomousBehaviorRecentRef.current = [];
            if (patchResult?.tree) {
                clearBehaviorRuntime('');
                autonomousBehaviorCooldownRef.current = Date.now() + 800;
            }
            const message = `AI 行为树已全量替换：日常 ${mountedGenerated.base_count}/${baseBranchCount} 条，互动开场 ${mountedGenerated.interaction_count}/${interactionBranchCount} 条${data.json_retry_used ? '（JSON 重试后成功）' : ''}。`;
            setBehaviorStatusPinned(message, 45000);
            setNotice(message);
        } catch (error) {
            const message = formatBehaviorRequestError(error, '日常行为生成失败，请重试。');
            const statusMessage = `日常行为生成失败：${message}`;
            setBehaviorStatusPinned(statusMessage, 60000);
            setNotice(statusMessage);
            setBehaviorOutput({
                base_branches: [],
                base_patches: [],
                interaction_branches: [],
                interaction_patches: [],
                tree_version: behaviorTreeState.version,
                fallback: false,
                error: message,
                raw_output: '',
            });
        } finally {
            setBehaviorLoading(false);
        }
    }

    function mergeBehaviorTreePatch(rawPatch, fallbackBranch = null, source = 'manual', inputPackage = null) {
        const result = mergeCommercialBehaviorTreePatchForRuntime(
            behaviorTreeStateRef.current || behaviorTreeState,
            rawPatch,
            fallbackBranch,
            source,
            activeBehaviorCharacterId,
            behaviorCharacter,
        );
        if (!result.patch) return null;
        const nextTree = inputPackage
            ? mergeCommercialBehaviorIterationStateFromInput(result.tree, inputPackage)
            : result.tree;
        commitBehaviorTreeState(nextTree);
        persistBehaviorTreeStateToServer(nextTree, source);
        setBehaviorPatchOutput({
            patch: result.patch,
            active_node_id: nextTree.active_node_id,
            tree_version: nextTree.version,
            patch_history: nextTree.patch_history.slice(0, 6),
        });
        return { ...result, tree: nextTree };
    }

    function mergeBehaviorTreePatches(
        rawPatches = [],
        source = 'manual',
        baseTree = behaviorTreeState,
        inputPackage = null,
    ) {
        const result = mergeCommercialBehaviorTreePatchesForRuntime(
            baseTree,
            rawPatches,
            source,
            activeBehaviorCharacterId,
            behaviorCharacter,
        );
        if (!result?.patches?.length) return null;
        const nextTree = inputPackage
            ? mergeCommercialBehaviorIterationStateFromInput(result.tree, inputPackage)
            : result.tree;
        const patches = result.patches;
        commitBehaviorTreeState(nextTree);
        persistBehaviorTreeStateToServer(nextTree, source);
        setBehaviorPatchOutput({
            patches,
            count: patches.length,
            active_node_id: nextTree.active_node_id,
            tree_version: nextTree.version,
            patch_history: nextTree.patch_history.slice(0, 10),
        });
        return { tree: nextTree, patches };
    }

    return {
        resolveBehaviorAction,
        resolveBehaviorPlace,
        buildBehaviorPendingInput,
        generateBehaviorBranch,
        mergeBehaviorTreePatch,
        bindBehaviorActorToCharacter,
        bindControlledSkinToBehaviorCharacter,
        generateBaseBehaviorBranches,
        buildBehaviorPayload,
        getCurrentBehaviorActorId,
        getCurrentBehaviorUserActorId,
    };
}
