import {
    getRoomEditorFurniturePrice,
    getRoomEditorPaletteAssetName,
    roomEditorAsset,
} from '../../../features/city/scene/roomEditorCore.js';
export function RoomAssetPanel({
    tx,
    groupedAssets,
    activeAssetGroup,
    setActiveAssetType,
    ptxt,
    addAsset,
    canEditLayout,
}) {
    return (
        <aside className="pixel-world-asset-panel">
            <div
                className="pixel-world-room-settings-scroll"
                tabIndex={0}
                aria-label={tx('Room asset settings scroll area', '房间素材设置滚动区')}
            >
                <h3>{tx('Room Assets', '房间素材')}</h3>
                {groupedAssets.length > 0 ? (
                    <>
                        <div
                            className="pixel-world-asset-type-tabs"
                            role="tablist"
                            aria-label={tx('Room asset categories', '房间素材分类')}
                        >
                            {groupedAssets.map(([type, assets]) => (
                                <button
                                    key={type}
                                    className={activeAssetGroup?.[0] === type ? 'active' : ''}
                                    onClick={() => setActiveAssetType(type)}
                                    title={`${ptxt(type)} (${assets.length})`}
                                >
                                    {ptxt(type)}
                                    <span>{assets.length}</span>
                                </button>
                            ))}
                        </div>
                        {activeAssetGroup && (
                            <div className="pixel-world-asset-group" key={activeAssetGroup[0]}>
                                <strong>{ptxt(activeAssetGroup[0])}</strong>
                                <div className="pixel-world-asset-grid">
                                    {activeAssetGroup[1].map((asset) => {
                                        const price = getRoomEditorFurniturePrice(asset.id);
                                        return (
                                            <button
                                                key={asset.id}
                                                onClick={() => addAsset(asset)}
                                                title={
                                                    price
                                                        ? tx(
                                                              `${ptxt(asset.name)} / price ${price}`,
                                                              `${asset.name} / 价格 ${price}`,
                                                          )
                                                        : ptxt(asset.name)
                                                }
                                                disabled={!canEditLayout}
                                            >
                                                <img
                                                    src={roomEditorAsset(asset.path)}
                                                    alt=""
                                                    draggable={false}
                                                    loading="lazy"
                                                />
                                                <span className="pixel-world-asset-name">
                                                    {ptxt(getRoomEditorPaletteAssetName(asset))}
                                                </span>
                                                {price ? (
                                                    <small className="pixel-world-asset-price">
                                                        {tx('Price', '价格')} {price}
                                                    </small>
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="pixel-world-asset-empty">
                        <strong>{tx('No Room Assets', '暂无房间素材')}</strong>
                        <p>
                            {tx(
                                'Furniture, wall decor, and standing-point assets will reuse this scaling, collision, anchor, and layer logic.',
                                '家具、墙饰或站位点素材接入后，会复用这里的缩放、碰撞箱、锚点和图层逻辑。',
                            )}
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
}
