import {
    normalizeCommercialBehaviorConfig,
    fetchBehaviorJsonWithTimeout,
    getBehaviorAuthHeaders,
    mergeCommercialBehaviorIterationStateFromInput,
} from '../../../features/city/scene/behaviorTreeCore.js';
export function createCommercialBehaviorDiagnostics({
    setBehaviorConfig,
    behaviorConfig,
    activeBehaviorCharacterId,
    setBehaviorModelStatus,
    setBehaviorStatus,
    setBehaviorModelsLoading,
    apiUrl,
    setBehaviorModelOptions,
    behaviorCharacter,
    setNotice,
    setBehaviorFoldOpen,
    setBehaviorLoading,
    buildBehaviorPayload,
    setBehaviorInput,
    setBehaviorOutput,
    commitBehaviorTreeState,
}) {
    function updateBehaviorConfig(patch) {
        setBehaviorConfig((current) =>
            normalizeCommercialBehaviorConfig({
                ...current,
                ...patch,
            }),
        );
    }

    async function pullBehaviorModels() {
        const customEndpoint = String(behaviorConfig.api_endpoint || '').trim();
        const customKey = String(behaviorConfig.api_key || '').trim();
        const customComplete = Boolean(customEndpoint && customKey);
        const customIncomplete = Boolean(customEndpoint || customKey) && !customComplete;
        if (customIncomplete && !activeBehaviorCharacterId) {
            const message = '自定义模型配置需要同时填写 URL 和 Key；当前也没有可用绑定角色。';
            setBehaviorModelStatus(message);
            setBehaviorStatus(message);
            return;
        }
        if (!customComplete && !activeBehaviorCharacterId) {
            const message = '没有绑定角色，无法使用角色模型配置。';
            setBehaviorModelStatus(message);
            setBehaviorStatus(message);
            return;
        }
        setBehaviorModelsLoading(true);
        const sourceLabel = customComplete ? '自定义配置' : '绑定角色配置';
        setBehaviorModelStatus(
            customIncomplete
                ? '自定义 URL/Key 未填完整，正在改用绑定角色配置拉取模型列表...'
                : `正在通过${sourceLabel}拉取模型列表...`,
        );
        setBehaviorStatus('正在拉取模型列表...');
        try {
            const url = customComplete
                ? `${apiUrl}/models`
                : `${apiUrl}/city/characters/${encodeURIComponent(activeBehaviorCharacterId)}/behavior-models`;
            const { response, data } = await fetchBehaviorJsonWithTimeout(url, {
                method: customComplete ? 'POST' : 'GET',
                headers: getBehaviorAuthHeaders(),
                body: customComplete ? JSON.stringify({ endpoint: customEndpoint, key: customKey }) : undefined,
            });
            if (!response.ok) throw new Error(data?.error || `模型列表读取失败 ${response.status}`);
            const models = Array.isArray(data?.models) ? data.models : [];
            setBehaviorModelOptions(models);
            const preferredModel = behaviorConfig.model_name || data?.model_name || behaviorCharacter?.model_name || '';
            if (!behaviorConfig.model_name && (models.includes(preferredModel) || preferredModel)) {
                updateBehaviorConfig({ model_name: preferredModel || models[0] });
            } else if (!behaviorConfig.model_name && models[0]) {
                updateBehaviorConfig({ model_name: models[0] });
            }
            const message = models.length
                ? `已通过${sourceLabel}拉取 ${models.length} 个模型。`
                : '模型接口返回为空，可以手动填写模型名。';
            setBehaviorModelStatus(message);
            setBehaviorStatus(message);
        } catch (error) {
            const message = `模型拉取失败：${error.name === 'AbortError' ? '请求超时' : error.message}`;
            setBehaviorModelStatus(message);
            setBehaviorStatus(message);
        } finally {
            setBehaviorModelsLoading(false);
        }
    }

    async function requestBehaviorInput() {
        if (!activeBehaviorCharacterId) {
            const message = '没有可用角色，先在角色设置里创建或启用一个角色。';
            setBehaviorStatus(message);
            setNotice(message);
            return;
        }
        const pendingMessage = '正在读取 AI 上文...';
        setBehaviorFoldOpen((current) => ({ ...current, runtime: true, debug: true }));
        setBehaviorLoading(true);
        setBehaviorStatus(pendingMessage);
        setNotice(pendingMessage);
        const requestPayload = buildBehaviorPayload();
        setBehaviorInput({
            ...requestPayload,
            debug_source: 'client_pending_behavior_input_request',
            debug_note: '正在请求服务端补齐 large_input。',
        });
        setBehaviorOutput(null);
        try {
            const response = await fetch(
                `${apiUrl}/city/characters/${encodeURIComponent(activeBehaviorCharacterId)}/behavior-input`,
                {
                    method: 'POST',
                    headers: getBehaviorAuthHeaders(),
                    body: JSON.stringify(requestPayload),
                },
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || `读取失败 ${response.status}`);
            setBehaviorInput(data.input || null);
            commitBehaviorTreeState((currentTree) =>
                mergeCommercialBehaviorIterationStateFromInput(currentTree, data.input),
            );
            setBehaviorOutput(null);
            const message = '已读取 AI 上文；私聊和商业街活动只作背景，不会触发小人行动。';
            setBehaviorStatus(message);
            setNotice(message);
        } catch (error) {
            const message = `AI 上文读取失败：${error.message}`;
            setBehaviorStatus(message);
            setNotice(message);
        } finally {
            setBehaviorLoading(false);
        }
    }
    return { updateBehaviorConfig, pullBehaviorModels, requestBehaviorInput };
}
