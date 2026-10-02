import { commercialV2PlayerCharacters } from '../commercialStreetCore.js';

export function ScenePlayerToolbar({
    syncStatus,
    retrySync,
    reloadServerTree,
    tx,
    ptxt,
    controlledPlayerId,
    onControlPlayer,
    behaviorCharacterId,
    behaviorCharacters,
    onChooseCharacter,
    onBindCharacter,
    bindingSummary,
    onGenerateBehavior,
    behaviorLoading,
    canGenerate,
    behaviorError,
    zoom,
    setZoom,
    maxZoom,
    onCenter,
    parallaxEnabled,
    onToggleParallax,
    travel,
    toolsAvailable,
    toolsOpen,
    onToggleTools,
}) {
    return (
        <div
            className="pixel-world-editor-toolbar scene-player-toolbar"
            aria-label={tx('Scene controls', '场景控制')}
            data-sync-status={syncStatus?.kind}
        >
            {syncStatus?.kind === 'loading' && (
                <span role="status">{tx('Loading scene sync...', '正在同步场景…')}</span>
            )}
            {['error', 'conflict'].includes(syncStatus?.kind) && (
                <div role="status" className="scene-sync-status">
                    <span>
                        {syncStatus.kind === 'conflict'
                            ? tx(
                                  'Another window saved changes. Local changes are kept; load the server version to continue.',
                                  '另一窗口已保存修改。本地修改已保留；加载服务器版本后可继续。',
                              )
                            : tx('Scene sync failed. Local changes are kept.', '场景同步失败，本地修改已保留。')}
                    </span>
                    {syncStatus.kind === 'error' && (
                        <button type="button" onClick={retrySync}>
                            {tx('Retry Sync', '重试同步')}
                        </button>
                    )}
                    <button type="button" onClick={reloadServerTree}>
                        {tx('Load Server Version', '加载服务器版本')}
                    </button>
                </div>
            )}
            <div className="scene-player-toolbar__main">
                <label className="pixel-world-player-switch-control">
                    <span>{tx('Control Character', '控制角色')}</span>
                    <select
                        value={controlledPlayerId}
                        aria-label={tx('Switch controlled character', '切换控制角色')}
                        onChange={(event) => {
                            onControlPlayer(event.target.value);
                            event.currentTarget.blur();
                        }}
                    >
                        {commercialV2PlayerCharacters.map((character) => (
                            <option key={character.id} value={character.id}>
                                {ptxt(character.label)}
                            </option>
                        ))}
                    </select>
                </label>
                {travel && (
                    <div className="pixel-world-auto-walk-control">
                        <span>{tx('Auto Travel', '自动循迹')}</span>
                        <select
                            value={travel.autoTargetId}
                            onChange={(event) => travel.setAutoTargetId(event.target.value)}
                            disabled={!travel.travelTargetOptions.length}
                            aria-label={tx('Auto-travel target', '自动循迹目标')}
                        >
                            {travel.travelTargetOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => travel.startAutoTravel()}
                            disabled={!travel.travelTargetOptions.length}
                        >
                            {tx('Go', '前往')}
                        </button>
                        <button
                            type="button"
                            onClick={() => travel.cancelAutoTravel('自动循迹已停止。')}
                            disabled={!travel.autoTravelActive}
                        >
                            {tx('Stop', '停止')}
                        </button>
                    </div>
                )}
                <span className="scene-player-toolbar__hint">
                    {tx('Click scene · WASD to move', '点击场景 · WASD 移动')}
                </span>
                <div className="scene-player-toolbar__zoom" role="group" aria-label={tx('Canvas zoom', '画布缩放')}>
                    <button
                        type="button"
                        onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.1).toFixed(2))))}
                        aria-label={tx('Zoom Out', '画布缩小')}
                    >
                        −
                    </button>
                    <strong>{Math.round(zoom * 100)}%</strong>
                    <button
                        type="button"
                        onClick={() => setZoom((value) => Math.min(maxZoom, Number((value + 0.1).toFixed(2))))}
                        aria-label={tx('Zoom In', '画布放大')}
                    >
                        +
                    </button>
                </div>
                {onCenter && (
                    <button type="button" onClick={onCenter}>
                        {tx('Center Character', '居中当前人物')}
                    </button>
                )}
                {toolsAvailable && (
                    <button type="button" onClick={onToggleTools} aria-expanded={toolsOpen}>
                        {toolsOpen ? tx('Close Scene Tools', '关闭场景工具') : tx('Scene Tools', '场景工具')}
                    </button>
                )}
                <details key={toolsOpen ? 'tools-open' : 'player'} className="scene-player-toolbar__more">
                    <summary>{tx('More controls', '更多操作')}</summary>
                    <div className="scene-player-toolbar__more-content">
                        <div className="pixel-world-player-bind-control">
                            <span>{tx('Character', '角色')}</span>
                            <select
                                value={behaviorCharacterId}
                                onChange={(event) => onChooseCharacter(event.target.value)}
                                disabled={!behaviorCharacters.length}
                                aria-label={tx('Choose scene character', '选择场景角色')}
                            >
                                {behaviorCharacters.length ? (
                                    behaviorCharacters.map((character) => (
                                        <option key={character.id} value={character.id}>
                                            {character.name || character.id}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">{tx('No characters', '暂无角色')}</option>
                                )}
                            </select>
                            {onBindCharacter && (
                                <button type="button" onClick={onBindCharacter} disabled={!behaviorCharacterId}>
                                    {tx('Bind', '绑定')}
                                </button>
                            )}
                            {bindingSummary && <strong>{bindingSummary}</strong>}
                        </div>
                        <button type="button" onClick={onGenerateBehavior} disabled={behaviorLoading || !canGenerate}>
                            {behaviorLoading ? tx('Generating...', '生成中...') : tx('Generate Behavior Tree', '生成行为树')}
                        </button>
                        {onToggleParallax && (
                            <button
                                type="button"
                                onClick={onToggleParallax}
                                aria-pressed={parallaxEnabled}
                                className={parallaxEnabled ? 'active' : ''}
                                disabled={toolsOpen}
                                title={tx('Visual effect only; paused while scene tools are open', '仅改变视觉效果；打开场景工具时暂停')}
                            >
                                {tx('Parallax Experiment', '视差实验')}
                            </button>
                        )}
                        {behaviorError && (
                            <p role="alert">
                                {tx('Behavior generation failed: ', '行为生成失败：')}
                                {behaviorError}
                            </p>
                        )}
                    </div>
                </details>
            </div>
        </div>
    );
}
