import { commercialV2Asset } from '../../../features/city/scene/commercialStreetCore.js';

export function CommercialAssetPanel({
    assetPanelOpen,
    tx,
    setAssetPanelOpen,
    groupedAssets,
    activeAssetGroup,
    setActiveAssetType,
    ptxt,
    addAsset,
    canEditLayout,
}) {
    if (!assetPanelOpen) return null;

    return (
        <aside className="pixel-world-asset-panel">
            <div className="pixel-world-asset-panel-head">
                <h3>{tx('Assets', '素材')}</h3>
                <button
                    type="button"
                    onClick={() => setAssetPanelOpen(false)}
                    title={tx('Collapse asset editing panel', '收起素材编辑面板')}
                >
                    {tx('Collapse', '收起')}
                </button>
            </div>
            <div className="pixel-world-asset-type-tabs" role="tablist" aria-label={tx('Asset categories', '素材分类')}>
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
                        {activeAssetGroup[1].map((asset) => (
                            <button
                                key={asset.id}
                                onClick={() => addAsset(asset)}
                                title={ptxt(asset.name)}
                                disabled={!canEditLayout}
                            >
                                <img src={commercialV2Asset(asset.path)} alt="" draggable={false} loading="lazy" />
                                <span>{ptxt(asset.name)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
}
