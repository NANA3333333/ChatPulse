import { createRoomEditorPlayerState } from '../roomEditorCore.js';
import {
    summarizeMountedGeneratedBehaviorBranches,
    commercialV2BehaviorActions,
    adaptRoomBehaviorTreeStateForPlaces,
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
import {
    commercialV2PlayerCharacters,
    commercialV2RoleActorId,
    commercialV2PlayerCharacterById,
    commercialV2UserActorId,
} from '../commercialStreetCore.js';

export function createRoomBehaviorRequests({
    behaviorAction,
    behaviorPlaceId,
    behaviorPlaceOptions,
    behaviorPlaceLinks,
    userProfile,
    playersRef,
    controlledPlayerIdRef,
    behaviorTreeState,
    behaviorConfig,
    behaviorPromptText,
    behaviorOrderedPlaces,
    roomBehaviorRequiredAnchorBranches,
    aiLayout,
    behaviorCharacterId,
    setBehaviorStatus,
    apiUrl,
    behaviorCharacter,
    setBehaviorLoading,
    setBehaviorOutput,
    commitBehaviorTreeState,
    setBehaviorAction,
    setBehaviorPlaceId,
    setWorldPlayerBubble,
    activateBehaviorBranch,
    clearBehaviorStatusHold,
    setRoomBehaviorFoldOpen,
    behaviorTreeStateRef,
    setBehaviorStatusPinned,
    autonomousBehaviorCursorRef,
    autonomousBehaviorRecentRef,
    clearBehaviorRuntime,
    autonomousBehaviorCooldownRef,
    persistBehaviorTreeStateToServer,
}) {
    function resolveBehaviorAction(actionId = behaviorAction) {
        return commercialV2BehaviorActions.find((item) => item.id === actionId) || commercialV2BehaviorActions[0];
    }

    function resolveBehaviorPlace(placeId = behaviorPlaceId) {
        return behaviorPlaceOptions.find((option) => option.id === placeId) || behaviorPlaceOptions[0] || null;
    }

    function resolveBehaviorPlaceLink(placeOption) {
        if (!placeOption) return null;
        const targetId = String(placeOption.id || '');
        return (
            behaviorPlaceLinks.find(
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

    function summarizeBehaviorActor(actorId, label) {
        const character = commercialV2PlayerCharacterById.get(actorId) || commercialV2PlayerCharacters[0];
        const actor = playersRef.current[actorId] || createRoomEditorPlayerState(character);
        const isUserActor = actorId === commercialV2UserActorId;
        const displayName = isUserActor ? getBehaviorUserDisplayName() : character.label;
        return {
            id: actorId,
            label: isUserActor ? displayName : label,
            display_name: displayName,
            semantic_role: isUserActor ? 'player_user' : 'character_actor',
            sprite: character.label,
            direction: actor.direction,
            moving: Boolean(actor.moving),
            controlled: actorId === controlledPlayerIdRef.current,
            movement_mode: 'room_semantic',
        };
    }

    function summarizeBehaviorTreeForPayload(treeState = behaviorTreeState) {
        return buildBehaviorTreePayloadSummary(treeState, behaviorConfig, 'room_runtime_single_character');
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
            scene: {
                type: 'room',
                id: 'pixel_room',
                label: '居住房间',
                runtime: 'single_character_room_runtime_v1',
                description:
                    '当前角色和玩家正在像素小屋内部；行为树应围绕房间物件锚点（家具、装饰、地毯、墙饰、灯）、中心站位、靠近玩家和室内生活动作生成。',
            },
            world: {
                scene_type: 'room',
                scene_label: '居住房间',
                movement_model: 'room_semantic_v1',
                movement_rule:
                    '角色可以决定自由活动、靠近玩家、闲逛或去当前房间物件锚点（家具、装饰、地毯、墙饰、灯等）；不要生成像素坐标，前端会把 place_id 映射到当前房间物件锚点。全量生成时必须以 required_anchor_branches 为目标逐个写物件枝丫。',
                ordered_place_text: behaviorOrderedPlaces.map((place) => `${place.order}. ${place.name}`).join(' -> '),
                allowed_place_ids: behaviorOrderedPlaces.map((place) => place.placeId),
                required_anchor_branches: roomBehaviorRequiredAnchorBranches,
                anchor_branch_rule:
                    '当前每个房间物件锚点（家具、装饰、地毯、墙饰、灯）都必须对应至少一条 target_node_id=place_affordance 的基础枝丫；枝丫步骤必须引用该锚点 place_id。不要为了枝丫挑锚点，要按锚点写枝丫。',
                allowed_movement_actions: commercialV2BehaviorMovementActions,
                actors: {
                    role: summarizeBehaviorActor(commercialV2RoleActorId, '角色小人'),
                    user: summarizeBehaviorActor(commercialV2UserActorId, '玩家小人'),
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
                    'go_to_place: 前往表内物件或中心站位锚点',
                    'wander_between: 在两个表内锚点之间来回闲逛',
                    'loop_in_front_of: 在表内锚点前小范围循环移动',
                    'browse_near: 在表内锚点附近停停走走',
                    'patrol_segment: 在两个表内锚点之间巡逻',
                    'approach_player: 靠近玩家',
                    'follow_player: 跟随玩家',
                    'walk_with_player: 陪玩家向表内锚点移动',
                    'idle_at_place: 在表内锚点附近停留',
                ],
            },
            room_layout: {
                kind: 'pixel_room_ascii_layout_v1',
                unit: aiLayout.unit,
                room: aiLayout.room,
                current_ascii: aiLayout.currentAscii,
                furniture: aiLayout.furniture.map((item) => ({
                    id: item.id,
                    anchor_id:
                        roomBehaviorRequiredAnchorBranches.find((anchor) => anchor.item_id === item.id)?.id || '',
                    kind: item.kind,
                    direction: item.direction,
                    token: item.token,
                    size: item.size,
                    rules: item.rules,
                    direction_options: item.directionOptions,
                    grid_box: item.gridBox,
                })),
                usage: '只用于理解当前房间和家具；行为树输出仍必须是 tree patch 或 base_branches，不要输出 PLACE 家具摆放行。',
            },
            behavior_context: buildCommercialBehaviorContextConfig(behaviorConfig),
            behavior_tree: summarizeBehaviorTreeForPayload(options.behaviorTreeState || behaviorTreeState),
        };
    }

    async function generateBehaviorBranch(options = {}) {
        if (!behaviorCharacterId) {
            setBehaviorStatus('没有可用角色，先在角色设置里创建或启用一个角色。');
            return { ok: false, error: 'missing_character' };
        }
        const actionId = options.actionId || behaviorAction;
        const placeId = options.placeId || behaviorPlaceId;
        const selectedAction = resolveBehaviorAction(actionId);
        if (actionId !== behaviorAction) setBehaviorAction(actionId);
        if (placeId && placeId !== behaviorPlaceId) setBehaviorPlaceId(placeId);
        setBehaviorLoading(true);
        setBehaviorStatus('正在生成互动回应...');
        setWorldPlayerBubble(commercialV2UserActorId, selectedAction?.label || '互动');
        const requestPayload = buildBehaviorPayload({ actionId, placeId });

        setBehaviorOutput(null);
        try {
            const { response, data } = await fetchBehaviorJsonWithTimeout(
                `${apiUrl}/city/characters/${encodeURIComponent(behaviorCharacterId)}/behavior-branch`,
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
            setBehaviorStatus('AI patch 已合并进完整房间行为树。');
            return { ok: true, patchResult };
        } catch (error) {
            const message = formatBehaviorRequestError(error, '互动回应生成失败，请重试。');
            setBehaviorStatus(`互动回应生成失败：${message}`);
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
        if (!behaviorCharacterId) {
            setBehaviorStatus('没有可用角色，先在角色设置里创建或启用一个角色。');
            return;
        }
        setBehaviorLoading(true);
        clearBehaviorStatusHold();
        setBehaviorStatus('正在生成房间行为枝丫池...基础枝丫和互动开场会一起生成，可能需要 1-2 分钟。');

        setRoomBehaviorFoldOpen((current) => ({ ...current, generation: true, runtime: true, debug: true }));
        const rebuildTree = adaptRoomBehaviorTreeStateForPlaces(
            createCommercialBehaviorTreeRebuildState(
                behaviorTreeStateRef.current || behaviorTreeState,
                'room_runtime_single_character',
            ),
            behaviorOrderedPlaces,
        );
        const requestPayload = buildBehaviorPayload({ behaviorTreeState: rebuildTree });

        setBehaviorOutput(null);
        try {
            const { response, data } = await fetchBehaviorJsonWithTimeout(
                `${apiUrl}/city/characters/${encodeURIComponent(behaviorCharacterId)}/behavior-base-branches`,
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
                setBehaviorStatusPinned(`房间日常行为生成失败：${message}`, 60000);
                return;
            }
            if (baseBranchCount > 0 && mountedGenerated.base_count <= 0) {
                const message = 'AI 返回了基础枝丫，但没有挂进基础行为池；运行树已回滚。';
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
                setBehaviorStatusPinned(`房间日常行为生成失败：${message}`, 60000);
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
            setBehaviorStatusPinned(
                `AI 房间行为树已全量替换：日常 ${mountedGenerated.base_count}/${baseBranchCount} 条，互动开场 ${mountedGenerated.interaction_count}/${interactionBranchCount} 条${data.json_retry_used ? '（JSON 重试后成功）' : ''}。`,
                45000,
            );
        } catch (error) {
            const message = formatBehaviorRequestError(error, '房间日常行为生成失败，请重试。');
            setBehaviorStatusPinned(`房间日常行为生成失败：${message}`, 60000);
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
            behaviorCharacterId,
            behaviorCharacter,
        );
        if (!result.patch) return null;
        const mergedTree = inputPackage
            ? mergeCommercialBehaviorIterationStateFromInput(result.tree, inputPackage)
            : result.tree;
        const nextTree = adaptRoomBehaviorTreeStateForPlaces(mergedTree, behaviorOrderedPlaces);
        commitBehaviorTreeState(nextTree);
        persistBehaviorTreeStateToServer(nextTree, source);

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
            behaviorCharacterId,
            behaviorCharacter,
        );
        if (!result?.patches?.length) return null;
        const mergedTree = inputPackage
            ? mergeCommercialBehaviorIterationStateFromInput(result.tree, inputPackage)
            : result.tree;
        const nextTree = adaptRoomBehaviorTreeStateForPlaces(mergedTree, behaviorOrderedPlaces);
        const patches = result.patches;
        commitBehaviorTreeState(nextTree);
        persistBehaviorTreeStateToServer(nextTree, source);

        return { tree: nextTree, patches };
    }

    return {
        resolveBehaviorAction,
        resolveBehaviorPlace,
        generateBehaviorBranch,
        mergeBehaviorTreePatch,
        generateBaseBehaviorBranches,
        buildBehaviorPayload,
    };
}
