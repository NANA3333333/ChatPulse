import { translatePixelAction } from '../../../features/city/scene/pixelWorldI18n.js';
import { commercialV2PlayerCharacters } from '../../../features/city/scene/commercialStreetCore.js';
import {
    commercialV2BehaviorInteractionDistance,
    createCommercialV2BehaviorTreeState,
    commercialV2BehaviorAutonomousCooldownMs,
    commercialV2BehaviorMovementActions,
    commercialV2BehaviorContextMinQ,
    commercialV2BehaviorContextMaxQ,
    commercialV2BehaviorContextMinP,
    commercialV2BehaviorContextMaxP,
    commercialV2BehaviorLastDemoBranch,
    formatBehaviorJson,
} from '../../../features/city/scene/behaviorTreeCore.js';

export function CommercialBehaviorPanel({
    behaviorLoading,
    tx,
    behaviorOutput,
    behaviorPanelCollapsed,
    setBehaviorPanelCollapsed,
    ptxt,
    behaviorStatus,
    renderBehaviorActorCard,
    behaviorTargetActorId,
    behaviorBoundCharacter,
    behaviorUserActorId,
    userProfile,
    setBehaviorActorId,
    behaviorCharacterId,
    setBehaviorCharacterId,
    behaviorCharacters,
    bindBehaviorActorToCharacter,
    bindControlledSkinToBehaviorCharacter,
    addRoleCharacter,
    behaviorBindingSummary,
    renderBehaviorFold,
    getSelectionFoldSummary,
    renderSelectionInspectorContent,
    behaviorConfig,
    behaviorCharacter,
    updateBehaviorConfig,
    behaviorShowKey,
    behaviorModelOptions,
    pullBehaviorModels,
    behaviorModelsLoading,
    setBehaviorShowKey,
    behaviorModelStatus,
    behaviorContextStats,
    lang,
    behaviorOrderedPlaces,
    behaviorInteractionState,
    behaviorPlaceId,
    setBehaviorPlaceId,
    behaviorPlaceOptions,
    behaviorPromptText,
    setBehaviorPromptText,
    requestBehaviorInput,
    activeBehaviorCharacterId,
    generateBaseBehaviorBranches,
    generateBehaviorBranch,
    pickAutonomousBehaviorBranch,
    setBehaviorStatus,
    autonomousBehaviorCooldownRef,
    activateBehaviorBranch,
    executeBehaviorBranch,
    commitBehaviorTreeState,
    persistBehaviorTreeStateToServer,
    clearBehaviorRuntime,
    setBehaviorPatchOutput,
    activeBehaviorBranch,
    behaviorRuntimeSummary,
    behaviorTreeState,
    activeBehaviorDialog,
    chooseBehaviorDialogChoice,
    exitBehaviorDialog,
    continueBehaviorDialog,
    behaviorInput,
    buildBehaviorPayload,
    behaviorPatchOutput,
}) {
    const behaviorPanelStateLabel = behaviorLoading
        ? tx('Generating', '生成中')
        : behaviorOutput?.error
          ? 'Error'
          : behaviorOutput?.fallback
            ? 'Fallback'
            : behaviorOutput
              ? 'AI'
              : 'Draft';
    const behaviorStatusTone = behaviorLoading
        ? 'busy'
        : behaviorOutput?.error
          ? 'error'
          : behaviorOutput
            ? 'ready'
            : 'idle';
    if (behaviorPanelCollapsed) return null;

    return (
        <aside className="pixel-world-behavior-panel">
            <div className="pixel-world-behavior-head">
                <div>
                    <h3>{tx('Behavior Tree V1', '行为树 V1')}</h3>
                    <span>{tx('Single-character street behavior runtime', '单角色街区行为运行时')}</span>
                </div>
                <div className="pixel-world-behavior-head-actions">
                    <strong>{behaviorPanelStateLabel}</strong>
                    <button
                        type="button"
                        onClick={() => setBehaviorPanelCollapsed(true)}
                        title={tx('Collapse the full behavior-tree panel', '收起整个行为树面板')}
                    >
                        {tx('Collapse', '收起')}
                    </button>
                </div>
            </div>

            <div className={`pixel-world-behavior-live-status ${behaviorStatusTone}`} aria-live="polite">
                <strong>
                    {behaviorLoading
                        ? tx('Request Running', '请求进行中')
                        : behaviorOutput?.error
                          ? tx('Request Failed', '请求失败')
                          : tx('Status', '状态')}
                </strong>
                <span>
                    {behaviorLoading
                        ? tx(
                              'The model is generating a behavior tree. Keep this page open.',
                              '模型正在生成行为树，请保持此页打开。',
                          )
                        : ptxt(behaviorStatus)}
                </span>
            </div>

            <div className="pixel-world-behavior-actors">
                {renderBehaviorActorCard(
                    behaviorTargetActorId,
                    '角色皮套',
                    behaviorBoundCharacter?.name ? `绑定：${behaviorBoundCharacter.name}` : '等待绑定实际角色',
                )}
                {renderBehaviorActorCard(
                    behaviorUserActorId,
                    '玩家小人',
                    userProfile?.name ? `玩家：${userProfile.name}` : '玩家控制入口',
                )}
            </div>

            <div className="pixel-world-behavior-binding-grid">
                <label className="pixel-world-behavior-field">
                    <span>{tx('Behavior Skin', '行为皮套')}</span>
                    <select value={behaviorTargetActorId} onChange={(event) => setBehaviorActorId(event.target.value)}>
                        {commercialV2PlayerCharacters.map((character) => (
                            <option key={character.id} value={character.id}>
                                {ptxt(character.label)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="pixel-world-behavior-field">
                    <span>{tx('Actual Character', '实际角色')}</span>
                    <select
                        value={behaviorCharacterId}
                        onChange={(event) => setBehaviorCharacterId(event.target.value)}
                        disabled={!behaviorCharacters.length}
                    >
                        {behaviorCharacters.length ? (
                            behaviorCharacters.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name || item.id}
                                </option>
                            ))
                        ) : (
                            <option value="">{tx('No characters', '暂无角色')}</option>
                        )}
                    </select>
                </label>
                <button
                    type="button"
                    onClick={() => bindBehaviorActorToCharacter(behaviorTargetActorId, behaviorCharacterId)}
                    disabled={!behaviorCharacters.length || !behaviorCharacterId}
                    title={tx(
                        'Bind the selected actual character to this behavior skin. Behavior-tree generation will read that character context.',
                        '把选中的实际角色绑定到当前行为皮套；行为树生成会读取该角色的上下文。',
                    )}
                >
                    {tx('Bind to Skin', '绑定到此皮套')}
                </button>
                <button
                    type="button"
                    onClick={bindControlledSkinToBehaviorCharacter}
                    disabled={!behaviorCharacters.length || !behaviorCharacterId}
                    title={tx(
                        'Bind the skin currently selected in Control Character to this actual character.',
                        '把上方“控制角色”当前选中的皮套绑定到这个实际角色。',
                    )}
                >
                    {tx('Bind Selected Skin', '绑定当前选中皮套')}
                </button>
                <button
                    type="button"
                    className="pixel-world-behavior-legacy-action"
                    onClick={addRoleCharacter}
                    title={tx(
                        'Legacy shortcut: bind the character sprite to the male character and spawn it beside the player.',
                        '旧功能入口：把角色小人绑定到男孩，并生成在玩家旁边。',
                    )}
                >
                    {tx('Spawn Character Sprite', '生成角色小人')}
                </button>
                <div className={`pixel-world-behavior-binding-status ${behaviorBoundCharacter ? 'bound' : ''}`}>
                    {behaviorBindingSummary}
                </div>
            </div>

            {renderBehaviorFold(
                'selection',
                tx('Selection', '选中'),
                getSelectionFoldSummary(),
                renderSelectionInspectorContent(),
            )}

            {renderBehaviorFold(
                'model',
                tx('Model Config', '模型配置'),
                behaviorConfig.model_name || behaviorCharacter?.model_name || tx('Use Bound Character', '使用绑定角色'),
                <div className="pixel-world-behavior-model-grid">
                    <label className="pixel-world-behavior-field">
                        <span>URL</span>
                        <input
                            value={behaviorConfig.api_endpoint}
                            onChange={(event) => updateBehaviorConfig({ api_endpoint: event.target.value })}
                            placeholder={
                                behaviorCharacter?.api_endpoint
                                    ? tx('Leave empty to use bound character URL', '留空使用绑定角色 URL')
                                    : 'https://api.example.com/v1'
                            }
                        />
                    </label>
                    <label className="pixel-world-behavior-field">
                        <span>{tx('Key', '密钥')}</span>
                        <input
                            type={behaviorShowKey ? 'text' : 'password'}
                            value={behaviorConfig.api_key}
                            onChange={(event) => updateBehaviorConfig({ api_key: event.target.value })}
                            placeholder={tx('Leave empty to use bound character Key', '留空使用绑定角色 Key')}
                        />
                    </label>
                    <label className="pixel-world-behavior-field">
                        <span>{tx('Model', '模型')}</span>
                        <input
                            list="pixel-world-behavior-models"
                            value={behaviorConfig.model_name}
                            onChange={(event) => updateBehaviorConfig({ model_name: event.target.value })}
                            placeholder={behaviorCharacter?.model_name || tx('Model Name', '模型名')}
                        />
                        <datalist id="pixel-world-behavior-models">
                            {behaviorModelOptions.map((model) => (
                                <option key={model} value={model} />
                            ))}
                        </datalist>
                    </label>
                    <div className="pixel-world-behavior-model-actions">
                        <button type="button" onClick={pullBehaviorModels} disabled={behaviorModelsLoading}>
                            {behaviorModelsLoading ? tx('Loading', '拉取中') : tx('Fetch Models', '拉取模型')}
                        </button>
                        <button type="button" onClick={() => setBehaviorShowKey((value) => !value)}>
                            {behaviorShowKey ? tx('Hide Key', '隐藏 Key') : tx('Show Key', '显示 Key')}
                        </button>
                    </div>
                    <div
                        className={`pixel-world-behavior-model-status ${behaviorModelStatus.includes('失败') ? 'error' : ''}`}
                    >
                        {ptxt(behaviorModelStatus)}
                    </div>
                    {behaviorModelOptions.length > 0 && (
                        <div className="pixel-world-behavior-model-list">
                            <div className="pixel-world-behavior-model-list-head">
                                <strong>{tx('Model List', '模型列表')}</strong>
                                <span>
                                    {tx(`${behaviorModelOptions.length} models`, `${behaviorModelOptions.length} 个`)}
                                </span>
                            </div>
                            <div className="pixel-world-behavior-model-options">
                                {behaviorModelOptions.map((model) => (
                                    <button
                                        key={model}
                                        type="button"
                                        className={behaviorConfig.model_name === model ? 'active' : ''}
                                        title={model}
                                        onClick={() => updateBehaviorConfig({ model_name: model })}
                                    >
                                        {model}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>,
            )}

            {renderBehaviorFold(
                'context',
                tx('Branch Context', '枝丫上下文'),
                `q ${behaviorConfig.context_q_limit} / p ${behaviorConfig.context_summary_threshold}`,
                <div className="pixel-world-behavior-context-grid">
                    <label className="pixel-world-behavior-field">
                        <span>{tx('q Raw Window', 'q 原文窗口')}</span>
                        <div className="pixel-world-behavior-slider-row">
                            <input
                                type="range"
                                min={commercialV2BehaviorContextMinQ}
                                max={commercialV2BehaviorContextMaxQ}
                                step="1"
                                value={behaviorConfig.context_q_limit}
                                onChange={(event) => updateBehaviorConfig({ context_q_limit: event.target.value })}
                            />
                            <strong>{behaviorConfig.context_q_limit}</strong>
                        </div>
                        <small>
                            {tx('Live input reads at most q raw branches.', '实时输入最多读取 q 条枝丫原文。')}
                        </small>
                    </label>
                    <label className="pixel-world-behavior-field">
                        <span>{tx('p Summary Threshold', 'p 摘要阈值')}</span>
                        <div className="pixel-world-behavior-slider-row">
                            <input
                                type="range"
                                min={commercialV2BehaviorContextMinP}
                                max={commercialV2BehaviorContextMaxP}
                                step="1"
                                value={behaviorConfig.context_summary_threshold}
                                onChange={(event) =>
                                    updateBehaviorConfig({ context_summary_threshold: event.target.value })
                                }
                            />
                            <strong>{behaviorConfig.context_summary_threshold}</strong>
                        </div>
                        <small>
                            {tx(
                                'When unsummarized branches outside the q window reach p, a small model summarizes them before generation; failure stops this round.',
                                'q 窗口外未摘要枝丫积攒到 p 条时，生成前先用小模型总结；失败会中止本轮。',
                            )}
                        </small>
                    </label>
                    <div className="pixel-world-behavior-context-stats">
                        {tx('Summary backlog:', '摘要积攒：')}
                        <strong>
                            {behaviorContextStats.pending_summary_count} / {behaviorContextStats.p_summary_threshold}
                        </strong>
                        {tx(' items pending summary, currently reading ', '条待总结，当前读取 ')}
                        {behaviorContextStats.active_summary_count}
                        {tx(' summary rounds.', ' 轮摘要。')}
                        <span>
                            {lang === 'en' ? (
                                <>
                                    Raw {behaviorContextStats.raw_readable_count} / {behaviorContextStats.q_raw_limit}{' '}
                                    items
                                </>
                            ) : (
                                <>
                                    原文 {behaviorContextStats.raw_readable_count} / {behaviorContextStats.q_raw_limit}{' '}
                                    条
                                </>
                            )}
                        </span>
                    </div>
                </div>,
            )}

            {renderBehaviorFold(
                'constraints',
                tx('AI Allowlist', 'AI 可选白名单'),
                tx(
                    `${behaviorOrderedPlaces.length} places / ${commercialV2BehaviorMovementActions.length} movement actions`,
                    `${behaviorOrderedPlaces.length} 地点 / ${commercialV2BehaviorMovementActions.length} 移动动作`,
                ),
                <div className="pixel-world-behavior-constraints">
                    <div>
                        <strong>{tx('Places', '地点')}</strong>
                        <div className="pixel-world-behavior-chip-list">
                            {behaviorOrderedPlaces.map((place) => (
                                <span key={place.placeId}>
                                    {place.order}. {ptxt(place.name)}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <strong>{tx('Movement Actions', '移动动作')}</strong>
                        <div className="pixel-world-behavior-chip-list">
                            {commercialV2BehaviorMovementActions.map((action) => (
                                <span key={action.id}>{translatePixelAction(action, lang).label}</span>
                            ))}
                        </div>
                    </div>
                </div>,
            )}

            {renderBehaviorFold(
                'branchMap',
                tx('Behavior Layers', '行为分层'),
                tx('Daily behavior / Interaction response', '日常行为 / 互动回应'),
                <div className="pixel-world-behavior-branch-map">
                    <div>
                        <strong>{tx('Interaction Response', '互动回应')}</strong>
                        <span>
                            {tx(
                                'player_interaction: after the player clicks interact or chooses a reply, AI writes the new interaction behavior here.',
                                'player_interaction · 玩家点击互动或选择回应后，AI 会把新的互动行为写到这里。',
                            )}
                        </span>
                    </div>
                    <div>
                        <strong>{tx('Daily Behavior', '日常行为')}</strong>
                        <span>
                            {tx(
                                'Auto-polled without interaction: hard needs, local routine, place capability, background mood, curiosity, free movement, and micro-actions.',
                                '无互动时自动轮询：硬需求、本地例行、地点能力、背景情绪、好奇、自由活动、微动作。',
                            )}
                        </span>
                    </div>
                </div>,
            )}

            {renderBehaviorFold(
                'interaction',
                tx('Interaction Settings', '互动设置'),
                behaviorInteractionState.nearby
                    ? tx(
                          `Distance ${Math.round(behaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}`,
                          `距离 ${Math.round(behaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}`,
                      )
                    : tx('Menu appears when nearby', '靠近后弹出菜单'),
                <>
                    <div
                        className={`pixel-world-behavior-proximity ${behaviorInteractionState.nearby ? 'nearby' : ''}`}
                    >
                        <strong>
                            {behaviorInteractionState.nearby
                                ? tx('Character is in interaction range', '角色已在互动范围')
                                : tx('Menu appears when the player approaches', '玩家靠近角色后弹出菜单')}
                        </strong>
                        <span>
                            {tx('Distance', '距离')} {Math.round(behaviorInteractionState.distance)} /{' '}
                            {commercialV2BehaviorInteractionDistance}
                        </span>
                    </div>

                    <label className="pixel-world-behavior-field">
                        <span>{tx('Target Place', '目标地点')}</span>
                        <select
                            value={behaviorPlaceId}
                            onChange={(event) => setBehaviorPlaceId(event.target.value)}
                            disabled={!behaviorPlaceOptions.length}
                        >
                            {behaviorPlaceOptions.length ? (
                                behaviorPlaceOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.order ? `${option.order}. ` : ''}
                                        {option.label}
                                    </option>
                                ))
                            ) : (
                                <option value="">{tx('No places', '暂无地点')}</option>
                            )}
                        </select>
                    </label>
                    <label className="pixel-world-behavior-field">
                        <span>{tx('Extra Input', '补充输入')}</span>
                        <textarea
                            value={behaviorPromptText}
                            onChange={(event) => setBehaviorPromptText(event.target.value)}
                            placeholder={tx(
                                'Example: the player wants the character to go to the convenience store with them, but not be too obedient; keep some spontaneous reaction.',
                                '例如：玩家想让角色陪自己去便利店，但别太听话，要有一点临场反应。',
                            )}
                        />
                    </label>

                    <div className="pixel-world-behavior-run-row">
                        <button
                            type="button"
                            onClick={requestBehaviorInput}
                            disabled={behaviorLoading || !activeBehaviorCharacterId}
                            title={tx(
                                'Assemble character memory, current scene, and place allowlist to inspect the AI context.',
                                '整理角色记忆、当前场景和地点白名单，查看 AI 实际会收到的上文。',
                            )}
                        >
                            {tx('Read AI Context', '读取 AI 上文')}
                        </button>
                        <button
                            type="button"
                            onClick={generateBaseBehaviorBranches}
                            disabled={behaviorLoading || !activeBehaviorCharacterId}
                            title={tx(
                                'Let AI generate a daily-action pool for automatic polling when nobody interacts.',
                                '让 AI 生成无人互动时会自动轮询的日常行动池。',
                            )}
                        >
                            {behaviorLoading
                                ? tx('Generating...', '生成中...')
                                : tx('Generate Branches', '生成行为枝丫')}
                        </button>
                        <button
                            type="button"
                            className="primary"
                            onClick={generateBehaviorBranch}
                            disabled={behaviorLoading || !activeBehaviorCharacterId}
                            title={tx(
                                'Generate the next interaction response from the current player action, target place, and extra input.',
                                '根据当前玩家动作、目标地点和补充输入，生成下一段互动回应。',
                            )}
                        >
                            {tx('Generate Response', '生成互动回应')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const branch = pickAutonomousBehaviorBranch();
                                if (!branch) {
                                    setBehaviorStatus(
                                        '当前没有可试跑的日常行为，先确认地点白名单是否存在，或先生成行为枝丫。',
                                    );
                                    return;
                                }
                                autonomousBehaviorCooldownRef.current =
                                    Date.now() + commercialV2BehaviorAutonomousCooldownMs;
                                activateBehaviorBranch(branch, 'base');
                                setBehaviorStatus(`已试跑日常行为：${branch.title}`);
                            }}
                            disabled={behaviorLoading || !activeBehaviorCharacterId}
                            title={tx(
                                'Pick one generated daily action and run it immediately.',
                                '从已生成的日常行动池中挑一条立刻执行。',
                            )}
                        >
                            {tx('Run Daily Behavior', '试跑日常行为')}
                        </button>
                        <button
                            type="button"
                            onClick={() => executeBehaviorBranch(behaviorOutput?.branch, 'replay')}
                            disabled={behaviorLoading || !behaviorOutput?.branch}
                            title={tx(
                                'Replay the last AI-generated interaction behavior.',
                                '重新执行上一次 AI 生成的互动行为。',
                            )}
                        >
                            {tx('Replay Current Behavior', '重跑当前行为')}
                        </button>
                        <button
                            type="button"
                            onClick={() => executeBehaviorBranch(commercialV2BehaviorLastDemoBranch, 'demo')}
                            disabled={behaviorLoading}
                            title={tx(
                                'Load the built-in example to quickly test the behavior-tree dialogue flow.',
                                '载入内置示例，用来快速测试行为树对话流程。',
                            )}
                        >
                            {tx('Run Example', '运行示例互动')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const resetTree = createCommercialV2BehaviorTreeState();
                                commitBehaviorTreeState(resetTree);
                                persistBehaviorTreeStateToServer(resetTree, 'reset');
                                clearBehaviorRuntime('');
                                setBehaviorPatchOutput(null);
                                setBehaviorStatus('完整行为树已重置。');
                            }}
                            disabled={behaviorLoading}
                            title={tx(
                                'Clear generated behavior nodes and restore the default behavior tree.',
                                '清空已生成的行为节点，恢复默认行为树。',
                            )}
                        >
                            {tx('Clear Behavior Tree', '清空行为树')}
                        </button>
                    </div>
                </>,
            )}

            {renderBehaviorFold(
                'runtime',
                tx('Runtime', '运行状态'),
                activeBehaviorBranch ? ptxt(activeBehaviorBranch.title) : behaviorRuntimeSummary,
                <>
                    <div className="pixel-world-behavior-status">
                        {behaviorLoading ? tx('Processing...', '处理中...') : ptxt(behaviorStatus)}
                    </div>
                    <div className={`pixel-world-behavior-runtime ${activeBehaviorBranch ? 'active' : ''}`}>
                        {activeBehaviorBranch ? (
                            <>
                                <strong>{ptxt(activeBehaviorBranch.branchKindLabel || '完整树运行节点')}</strong>
                                <span>{ptxt(activeBehaviorBranch.title)}</span>
                                <small>
                                    {Math.min(
                                        (activeBehaviorBranch.stepIndex || 0) + 1,
                                        activeBehaviorBranch.totalSteps || 1,
                                    )}
                                    /{activeBehaviorBranch.totalSteps || 1}
                                    {activeBehaviorBranch.currentAction
                                        ? ` · ${activeBehaviorBranch.currentAction}`
                                        : ''}
                                    {behaviorTreeState?.active_node_id
                                        ? ` · node:${behaviorTreeState.active_node_id}`
                                        : ''}
                                </small>
                                {activeBehaviorDialog && (
                                    <div className="pixel-world-behavior-runtime-control">
                                        <strong>
                                            {activeBehaviorDialog.type === 'choice'
                                                ? tx('Waiting for player choice', '等待玩家选择')
                                                : tx('Waiting for next line', '等待点击下一句')}
                                        </strong>
                                        <p>{activeBehaviorDialog.text}</p>
                                        {activeBehaviorDialog.type === 'pending' ? (
                                            <button type="button" disabled>
                                                {tx('Generating...', '生成中...')}
                                            </button>
                                        ) : activeBehaviorDialog.type === 'choice' &&
                                          activeBehaviorDialog.choices?.length ? (
                                            <div className="pixel-world-behavior-runtime-choice-grid">
                                                {activeBehaviorDialog.choices.map((choice) => (
                                                    <button
                                                        key={choice.id}
                                                        type="button"
                                                        onClick={() => chooseBehaviorDialogChoice(choice)}
                                                        disabled={behaviorLoading}
                                                    >
                                                        {ptxt(choice.label)}
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    className="pixel-world-behavior-dialog-exit"
                                                    onClick={exitBehaviorDialog}
                                                    disabled={behaviorLoading}
                                                >
                                                    {tx('Exit Dialog', '退出对话')}
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={continueBehaviorDialog}>
                                                {tx('Next Line', '下一句')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <strong>{tx('Full Behavior Tree', '完整行为树')}</strong>
                                <span>
                                    {tx('Version', '版本')} {behaviorTreeState.version} · patch{' '}
                                    {behaviorTreeState.patch_history?.length || 0}
                                </span>
                                <small>
                                    {tx(
                                        'Daily behavior is auto-polled; player interaction generates and immediately runs an interaction response.',
                                        '日常行为会自动轮询；玩家互动会生成互动回应并立即执行。',
                                    )}
                                </small>
                            </>
                        )}
                    </div>
                </>,
            )}

            {renderBehaviorFold(
                'debug',
                tx('Debug JSON', '调试 JSON'),
                tx('Full Tree / Input / Patch / Output', '完整树 / 输入 / Patch / 输出'),
                <div className="pixel-world-behavior-json-grid">
                    <section>
                        <h4>{tx('Full Tree', '完整树')}</h4>
                        <pre>{formatBehaviorJson(behaviorTreeState)}</pre>
                    </section>
                    <section>
                        <h4>{tx('Input', '输入')}</h4>
                        <pre>{formatBehaviorJson(behaviorInput || buildBehaviorPayload())}</pre>
                    </section>
                    <section>
                        <h4>{tx('Patch', '补丁')}</h4>
                        <pre>
                            {formatBehaviorJson(
                                behaviorPatchOutput || {
                                    patch: null,
                                    note: tx(
                                        'The local behavior-tree patch for this generation appears here.',
                                        '生成后显示本次局部行为树 patch。',
                                    ),
                                },
                            )}
                        </pre>
                    </section>
                    <section>
                        <h4>{tx('Output', '输出')}</h4>
                        <pre>
                            {formatBehaviorJson(
                                behaviorOutput || {
                                    base_branches: null,
                                    interaction_branches: null,
                                    branch: null,
                                    tree_patch: null,
                                    note: tx(
                                        'Click Generate Branches to show the auto-action pool and interaction opener pool. The interact button first runs an opener in player_interaction, and choices continue generating responses.',
                                        '点击“生成行为枝丫”会显示自动行动池和互动开场池；互动按钮会先执行 player_interaction 里的开场枝丫，选项会继续生成互动回应。',
                                    ),
                                },
                            )}
                        </pre>
                    </section>
                </div>,
            )}
        </aside>
    );
}
