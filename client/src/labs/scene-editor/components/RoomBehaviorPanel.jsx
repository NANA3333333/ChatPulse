import { translatePixelAction } from '../../../features/city/scene/pixelWorldI18n.js';
import {
    commercialV2BehaviorInteractionDistance,
    commercialV2BehaviorAutonomousCooldownMs,
    commercialV2BehaviorMovementActions,
} from '../../../features/city/scene/behaviorTreeCore.js';
import { commercialV2RoleActorId, commercialV2UserActorId } from '../../../features/city/scene/commercialStreetCore.js';

export function RoomBehaviorPanel({
    roomBehaviorPanelCollapsed,
    setRoomBehaviorPanelCollapsed,
    tx,
    roomBehaviorInteractionState,
    renderRoomBehaviorActorCard,
    controlledPlayerId,
    behaviorCharacterId,
    setBehaviorCharacterId,
    behaviorCharacters,
    renderRoomBehaviorFold,
    behaviorCharacter,
    behaviorPlaceId,
    setBehaviorPlaceId,
    behaviorPlaceOptions,
    behaviorPromptText,
    setBehaviorPromptText,
    requestBehaviorInput,
    behaviorLoading,
    generateBaseBehaviorBranches,
    generateBehaviorBranch,
    pickAutonomousBehaviorBranch,
    setBehaviorStatus,
    autonomousBehaviorCooldownRef,
    activateBehaviorBranch,
    executeBehaviorBranch,
    behaviorOutput,
    ptxt,
    behaviorStatus,
    behaviorConfig,
    updateBehaviorConfig,
    behaviorShowKey,
    behaviorModelOptions,
    pullBehaviorModels,
    behaviorModelsLoading,
    setBehaviorShowKey,
    behaviorModelStatus,
    renderBehaviorContextGrid,
    roomAnchors,
    lang,
    approachRoomPlayer,
    faceRoomPlayers,
    wanderRoomPlayer,
    clearRoomPlayerBubbles,
    resetRoomPlayers,
    behaviorDebugRuntimeSummary,
    roomBehaviorDebugJson,
}) {
    if (roomBehaviorPanelCollapsed) {
        return (
            <aside className="pixel-world-behavior-panel collapsed">
                <button
                    type="button"
                    className="pixel-world-behavior-panel-expand"
                    onClick={() => setRoomBehaviorPanelCollapsed(false)}
                    title={tx('Expand room behavior-tree panel', '展开房间行为树面板')}
                    aria-label={tx('Expand room behavior-tree panel', '展开房间行为树面板')}
                >
                    <span>{tx('Room Behavior Tree', '房间行为树')}</span>
                    <strong>{tx('Room', '房间')}</strong>
                    <small>{tx('Expand', '展开')}</small>
                </button>
            </aside>
        );
    }

    return (
        <aside className="pixel-world-behavior-panel room-behavior-panel">
            <div
                className="pixel-world-room-settings-scroll"
                tabIndex={0}
                aria-label={tx('Room behavior settings scroll area', '房间行为设置滚动区')}
            >
                <div className="pixel-world-behavior-head">
                    <div>
                        <h3>{tx('Room Behavior Tree V1', '房间行为树 V1')}</h3>
                        <span>
                            {tx('Two sprites / object anchors / room context', '两小人 / 物件锚点 / 房间上下文')}
                        </span>
                    </div>
                    <div className="pixel-world-behavior-head-actions">
                        <strong>{roomBehaviorInteractionState.nearby ? 'Near' : 'Room'}</strong>
                        <button
                            type="button"
                            onClick={() => setRoomBehaviorPanelCollapsed(true)}
                            title={tx('Collapse room behavior-tree panel', '收起房间行为树面板')}
                        >
                            {tx('Collapse', '收起')}
                        </button>
                    </div>
                </div>

                <div className="pixel-world-behavior-actors">
                    {renderRoomBehaviorActorCard(commercialV2RoleActorId, '角色小人', '行为树驱动对象')}
                    {renderRoomBehaviorActorCard(
                        commercialV2UserActorId,
                        '玩家小人',
                        controlledPlayerId === commercialV2UserActorId ? '当前键盘控制' : '可切换控制',
                    )}
                </div>

                <label className="pixel-world-behavior-field">
                    <span>{tx('Bound Character', '绑定角色')}</span>
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

                {renderRoomBehaviorFold(
                    'generation',
                    tx('AI Generation', 'AI 生成'),
                    behaviorCharacter
                        ? tx(
                              `Using ${behaviorCharacter.name || behaviorCharacter.id}`,
                              `使用 ${behaviorCharacter.name || behaviorCharacter.id}`,
                          )
                        : tx('Choose a character first', '先绑定角色'),
                    <>
                        <label className="pixel-world-behavior-field">
                            <span>{tx('Target Anchor', '目标锚点')}</span>
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
                                    <option value="">{tx('No anchors', '暂无锚点')}</option>
                                )}
                            </select>
                        </label>
                        <label className="pixel-world-behavior-field">
                            <span>{tx('Extra Input', '补充输入')}</span>
                            <textarea
                                value={behaviorPromptText}
                                onChange={(event) => setBehaviorPromptText(event.target.value)}
                                placeholder={tx(
                                    'Example: make the character use the bed naturally and avoid blocking wall art.',
                                    '例如：让角色自然使用床边区域，并避免遮挡墙上的画。',
                                )}
                            />
                        </label>
                        <div className="pixel-world-behavior-run-row">
                            <button
                                type="button"
                                onClick={requestBehaviorInput}
                                disabled={behaviorLoading || !behaviorCharacterId}
                                title={tx(
                                    'Assemble character memory, current room, objects, and anchor allowlist to inspect the AI context.',
                                    '整理角色记忆、当前房间、物件和锚点白名单，查看 AI 实际会收到的上文。',
                                )}
                            >
                                {tx('Read AI Context', '读取 AI 上文')}
                            </button>
                            <button
                                type="button"
                                className="primary"
                                onClick={generateBaseBehaviorBranches}
                                disabled={behaviorLoading || !behaviorCharacterId}
                                title={tx(
                                    'Generate the room behavior tree from the current room object anchors and room context.',
                                    '根据当前物件锚点和房间上下文生成房间行为树。',
                                )}
                            >
                                {behaviorLoading
                                    ? tx('Generating...', '生成中...')
                                    : tx('Generate Behavior Tree', '生成行为树')}
                            </button>
                            <button
                                type="button"
                                onClick={generateBehaviorBranch}
                                disabled={behaviorLoading || !behaviorCharacterId}
                                title={tx(
                                    'Generate the next interaction response from the current player action, target room object anchor, and extra input.',
                                    '根据当前玩家动作、目标物件锚点和补充输入，生成下一段互动回应。',
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
                                            '当前没有可试跑的日常行为，先确认房间锚点白名单是否存在，或先生成行为树。',
                                        );
                                        return;
                                    }
                                    autonomousBehaviorCooldownRef.current =
                                        Date.now() + commercialV2BehaviorAutonomousCooldownMs;
                                    activateBehaviorBranch(branch, 'base');
                                    setBehaviorStatus(`已试跑日常行为：${branch.title}`);
                                }}
                                disabled={behaviorLoading || !behaviorCharacterId}
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
                        </div>
                        <div className="pixel-world-behavior-status">{ptxt(behaviorStatus)}</div>
                    </>,
                )}

                {renderRoomBehaviorFold(
                    'model',
                    tx('Model Config', '模型配置'),
                    behaviorConfig.model_name ||
                        behaviorCharacter?.model_name ||
                        tx('Use Bound Character', '使用绑定角色'),
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
                                list="pixel-world-room-behavior-models"
                                value={behaviorConfig.model_name}
                                onChange={(event) => updateBehaviorConfig({ model_name: event.target.value })}
                                placeholder={behaviorCharacter?.model_name || tx('Model Name', '模型名')}
                            />
                            <datalist id="pixel-world-room-behavior-models">
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
                                        {tx(
                                            `${behaviorModelOptions.length} models`,
                                            `${behaviorModelOptions.length} 个`,
                                        )}
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

                {renderRoomBehaviorFold(
                    'context',
                    tx('Branch Context', '枝丫上下文'),
                    `q ${behaviorConfig.context_q_limit} / p ${behaviorConfig.context_summary_threshold}`,
                    renderBehaviorContextGrid(
                        tx(
                            'When unsummarized branches outside the q window reach p, summarize them before generation.',
                            'q 窗口外未摘要枝丫积攒到 p 条时，生成前先做摘要。',
                        ),
                    ),
                )}

                {renderRoomBehaviorFold(
                    'constraints',
                    tx('Room Allowlist', '房间白名单'),
                    tx(
                        `${roomAnchors.length} anchors / ${commercialV2BehaviorMovementActions.length} behavior actions`,
                        `${roomAnchors.length} 锚点 / ${commercialV2BehaviorMovementActions.length} 行为动作`,
                    ),
                    <div className="pixel-world-behavior-constraints">
                        <div>
                            <strong>{tx('Object Anchors', '物件锚点')}</strong>
                            <div className="pixel-world-behavior-chip-list">
                                {roomAnchors.length ? (
                                    roomAnchors.map((anchor) => <span key={anchor.id}>{ptxt(anchor.name)}</span>)
                                ) : (
                                    <span>{tx('No anchors', '暂无锚点')}</span>
                                )}
                            </div>
                        </div>
                        <div>
                            <strong>{tx('Reusable Actions', '可复用动作')}</strong>
                            <div className="pixel-world-behavior-chip-list">
                                {commercialV2BehaviorMovementActions.map((action) => (
                                    <span key={action.id}>{translatePixelAction(action, lang).label}</span>
                                ))}
                            </div>
                        </div>
                    </div>,
                )}

                {renderRoomBehaviorFold(
                    'runtime',
                    tx('Runtime', '运行状态'),
                    roomBehaviorInteractionState.nearby
                        ? tx(
                              `Distance ${Math.round(roomBehaviorInteractionState.distance)}`,
                              `距离 ${Math.round(roomBehaviorInteractionState.distance)}`,
                          )
                        : tx(
                              `Distance ${Math.round(roomBehaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}`,
                              `距离 ${Math.round(roomBehaviorInteractionState.distance)} / ${commercialV2BehaviorInteractionDistance}`,
                          ),
                    <>
                        <div
                            className={`pixel-world-behavior-proximity ${roomBehaviorInteractionState.nearby ? 'nearby' : ''}`}
                        >
                            <strong>
                                {roomBehaviorInteractionState.nearby
                                    ? tx('In interaction range', '已在互动范围')
                                    : tx('Not close yet', '还没有靠近')}
                            </strong>
                            <span>
                                {Math.round(roomBehaviorInteractionState.distance)} /{' '}
                                {commercialV2BehaviorInteractionDistance}
                            </span>
                        </div>
                        <div className="pixel-world-behavior-run-row">
                            <button type="button" onClick={approachRoomPlayer}>
                                {tx('Character approaches player', '角色靠近玩家')}
                            </button>
                            <button type="button" onClick={faceRoomPlayers}>
                                {tx('Face Each Other', '面对彼此')}
                            </button>
                            <button type="button" onClick={wanderRoomPlayer}>
                                {tx('Room Wander', '房间闲逛')}
                            </button>
                            <button type="button" onClick={clearRoomPlayerBubbles}>
                                {tx('Clear Bubbles', '清空气泡')}
                            </button>
                            <button type="button" onClick={resetRoomPlayers}>
                                {tx('Reset Sprites', '重置小人')}
                            </button>
                        </div>
                        <div className="pixel-world-behavior-status">{ptxt(behaviorStatus)}</div>
                    </>,
                )}

                {renderRoomBehaviorFold(
                    'debug',
                    tx('Debug Context', '调试上下文'),
                    behaviorDebugRuntimeSummary,
                    <pre className="pixel-world-behavior-json">{roomBehaviorDebugJson}</pre>,
                )}
            </div>
        </aside>
    );
}
