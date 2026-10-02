export function RoomInteractionMenu({
    behaviorInteractionState,
    activeBehaviorDialog,
    stageSize,
    interactionMenuOpen,
    setInteractionMenuOpen,
    behaviorLoading,
    behaviorCharacterId,
    tx,
    behaviorCharacter,
    behaviorPrimaryActions,
    behaviorAction,
    runPlayerInteraction,
    behaviorPlaceId,
    setBehaviorPlaceId,
    behaviorPlaceOptions,
    behaviorContextActions,
}) {
    if (!behaviorInteractionState.nearby || activeBehaviorDialog) return null;
    const style = {
        left: `${(behaviorInteractionState.x / stageSize.width) * 100}%`,
        top: `${(behaviorInteractionState.y / stageSize.height) * 100}%`,
    };
    const sideClass = behaviorInteractionState.side === 'left' ? 'side-left' : 'side-right';
    if (!interactionMenuOpen) {
        return (
            <button
                type="button"
                className={`pixel-world-interaction-entry ${sideClass}`}
                style={style}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setInteractionMenuOpen(true)}
                disabled={behaviorLoading || !behaviorCharacterId}
            >
                <strong>{behaviorLoading ? tx('Generating', '生成中') : tx('Interact', '互动')}</strong>
                <span>{behaviorCharacter?.name || tx('Character', '角色')}</span>
            </button>
        );
    }
    return (
        <div
            className={`pixel-world-interaction-menu ${sideClass}`}
            style={style}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <div className="pixel-world-interaction-menu-head">
                <strong>{behaviorCharacter?.name || tx('Character', '角色')}</strong>
                <button
                    type="button"
                    className="pixel-world-interaction-close"
                    onClick={() => setInteractionMenuOpen(false)}
                >
                    {tx('Collapse', '收起')}
                </button>
            </div>
            <div className="pixel-world-interaction-menu-primary">
                {behaviorPrimaryActions.map((action) => (
                    <button
                        key={action.id}
                        type="button"
                        className={behaviorAction === action.id ? 'active' : ''}
                        disabled={behaviorLoading || !behaviorCharacterId}
                        title={action.hint}
                        onClick={() => runPlayerInteraction(action.id)}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
            <div className="pixel-world-interaction-menu-target">
                <span>{tx('Destination', '目的地')}</span>
                <select
                    value={behaviorPlaceId}
                    onChange={(event) => setBehaviorPlaceId(event.target.value)}
                    disabled={behaviorLoading || !behaviorPlaceOptions.length}
                    aria-label={tx('Interaction destination', '互动目的地')}
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
            </div>
            <div className="pixel-world-interaction-menu-context">
                {behaviorContextActions.map((action) => (
                    <button
                        key={action.id}
                        type="button"
                        className={behaviorAction === action.id ? 'active' : ''}
                        disabled={behaviorLoading || !behaviorCharacterId}
                        title={action.hint}
                        onClick={() => runPlayerInteraction(action.id)}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
