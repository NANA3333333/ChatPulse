import {
    SlidersHorizontal,
    Megaphone,
    RotateCw,
    Sparkles,
    Armchair,
    BedDouble,
    NotebookText,
    Flower2,
    WandSparkles,
} from 'lucide-react';
import { text, promptStyles } from '../housingLabels.js';
import { formatTime, summarizeAgencyError, formatMoney } from '../housingFormatting.js';
import { getRoomAssemblyBudget } from '../assembly/roomAssembly.js';
import { roomAssemblyShopItems } from '../assembly/roomAssemblyCatalog.js';
import { getRoomAssemblySizeProfileKindCount } from '../assembly/roomAssemblyStorage.js';

export function HousingAgencyView({
    isEn,
    setManagementTab,
    setManagementOpen,
    recommendHousingId,
    setRecommendHousingId,
    availableHousingTiers,
    agencyTemplateKey,
    setAgencyTemplateKey,
    promptStyleLabel,
    publishingAgency,
    applyAgencyTemplate,
    publishAgency,
    latestAgencyAd,
    agencyForm,
    agencyError,
    selectedRoomAssemblyHome,
    setRoomAssemblyHomeId,
    roomAssemblyHomes,
    roomAssemblyPreviewImage,
    roomAssemblySnapshot,
    currentRoomAssemblySizeProfile,
    roomAssemblyNotice,
    roomAssemblySaving,
    runRoomAssembly,
    setShowRoomAssemblyModal,
}) {
    return (
        <div className="housing-play-screen" data-screen="agency">
            <div className="housing-agency-heading">
                <div>
                    <span className="housing-play-kicker">AGENCY AI STUDIO</span>
                    <h2>{isEn ? 'Agency AI Studio' : '中介 AI 创作室'}</h2>
                    <p>
                        {isEn
                            ? 'One side writes compelling listings; the other turns an empty unit into a liveable room.'
                            : '一个负责把房源讲得让人心动，一个负责把空房变成可以入住的家。'}
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                        setManagementTab('agency');
                        setManagementOpen(true);
                    }}
                >
                    <SlidersHorizontal size={15} />
                    {isEn ? 'Agency Settings' : '中介设置'}
                </button>
            </div>
            <div className="housing-agency-studios">
                <section className="housing-agency-studio">
                    <div className="housing-studio-title">
                        <span>
                            <Megaphone size={18} />
                        </span>
                        <div>
                            <small>ADVERTISEMENT LAB</small>
                            <h3>{isEn ? 'Let the agency write an ad' : '让中介写一则广告'}</h3>
                        </div>
                    </div>
                    <div className="housing-studio-controls">
                        <label>
                            <span>{isEn ? 'Listing' : '宣传房源'}</span>
                            <select
                                className="form-select"
                                value={recommendHousingId}
                                onChange={(e) => setRecommendHousingId(e.target.value)}
                            >
                                {availableHousingTiers.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.emoji || ''} {item.name || item.id}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>{text.adStyle}</span>
                            <select
                                className="form-select"
                                value={agencyTemplateKey}
                                onChange={(e) => setAgencyTemplateKey(e.target.value)}
                            >
                                {promptStyles.map((item) => (
                                    <option key={item.key} value={item.key}>
                                        {promptStyleLabel(item)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={publishingAgency}
                            onClick={() => {
                                applyAgencyTemplate(agencyTemplateKey);
                                publishAgency().catch((e) => alert(e.message));
                            }}
                        >
                            {publishingAgency ? <RotateCw size={15} className="is-spinning" /> : <Sparkles size={15} />}
                            {publishingAgency ? text.saving : isEn ? 'Generate Ad' : '生成广告'}
                        </button>
                    </div>
                    <article className="housing-ad-preview">
                        <span className="housing-play-kicker">PREVIEW</span>
                        <h3>{latestAgencyAd?.title || text.noAds}</h3>
                        <p>
                            {latestAgencyAd?.content ||
                                (isEn
                                    ? 'The newest generated ad appears here after the agency runs.'
                                    : '中介生成广告后，最新标题和正文会显示在这里。')}
                        </p>
                        <div>
                            <span className="housing-soft-tag">
                                {text.lastAd} {formatTime(agencyForm.last_ad_at)}
                            </span>
                            <span className="housing-soft-tag is-pink">
                                {text.nextAd} {formatTime(agencyForm.next_ad_at)}
                            </span>
                        </div>
                    </article>
                    {agencyError ? (
                        <div className="housing-chain-notice is-error">
                            {text.agencyFailed} {summarizeAgencyError(agencyError)}
                        </div>
                    ) : null}
                    <div className="housing-studio-footer">
                        <span>
                            {latestAgencyAd?.is_published
                                ? text.published
                                : isEn
                                  ? 'Generated ads can be published to the city board.'
                                  : '生成后可发布到城市公告。'}
                        </span>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => publishAgency().catch((e) => alert(e.message))}
                        >
                            {text.run}
                        </button>
                    </div>
                </section>

                <section className="housing-agency-studio is-room">
                    <div className="housing-studio-title">
                        <span>
                            <Armchair size={18} />
                        </span>
                        <div>
                            <small>ROOM ASSEMBLY</small>
                            <h3>{isEn ? 'Let the agency stage a showroom' : '让中介布置一间样板房'}</h3>
                        </div>
                    </div>
                    <label className="housing-room-select">
                        <span>{text.homeName}</span>
                        <select
                            className="form-select"
                            value={selectedRoomAssemblyHome?.id || ''}
                            onChange={(e) => setRoomAssemblyHomeId(e.target.value)}
                        >
                            {roomAssemblyHomes.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.emoji || ''} {item.name || item.id}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className={`housing-room-canvas ${roomAssemblyPreviewImage ? 'has-preview' : ''}`}>
                        {roomAssemblyPreviewImage ? (
                            <img
                                className="housing-room-preview-image"
                                src={roomAssemblyPreviewImage}
                                alt={isEn ? 'Last generated showroom screenshot' : '上一次生成的样板房截图'}
                                draggable="false"
                            />
                        ) : (
                            <>
                                <div className="housing-room-wall" />
                                <span className="housing-room-bed">
                                    <BedDouble size={30} />
                                </span>
                                <span className="housing-room-bookshelf">
                                    <NotebookText size={25} />
                                </span>
                                <span className="housing-room-rug" />
                                <span className="housing-room-plant">
                                    <Flower2 size={20} />
                                </span>
                            </>
                        )}
                        <div className="housing-room-budget">
                            <span>{text.budget}</span>
                            <strong>
                                {formatMoney(
                                    selectedRoomAssemblyHome ? getRoomAssemblyBudget(selectedRoomAssemblyHome) : 0,
                                )}
                            </strong>
                            <small>
                                {roomAssemblySnapshot
                                    ? `${text.spent} ${formatMoney(roomAssemblySnapshot.spent)} · ${text.purchased} ${roomAssemblySnapshot.purchases?.length || 0}`
                                    : text.roomAssemblyHint}
                            </small>
                        </div>
                    </div>
                    <div className="housing-room-options">
                        <span className="is-selected">{selectedRoomAssemblyHome?.name || text.selectedHome}</span>
                        <span>
                            {text.furnitureShop} {roomAssemblyShopItems.length}
                        </span>
                        <span>
                            {text.scaleProfile} {getRoomAssemblySizeProfileKindCount(currentRoomAssemblySizeProfile)}
                        </span>
                    </div>
                    {roomAssemblyNotice ? <div className="housing-chain-notice">{roomAssemblyNotice}</div> : null}
                    <div className="housing-studio-footer">
                        <span>{isEn ? 'Falls back to rules if AI fails.' : 'AI 失败时会自动使用规则方案。'}</span>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={roomAssemblySaving || !selectedRoomAssemblyHome}
                            onClick={runRoomAssembly}
                        >
                            {roomAssemblySaving ? (
                                <RotateCw size={15} className="is-spinning" />
                            ) : (
                                <WandSparkles size={15} />
                            )}
                            {roomAssemblySaving ? text.aiGenerating : text.generateRoomAssembly}
                        </button>
                    </div>
                </section>
            </div>
            <section className="housing-agency-history">
                <div>
                    <span className="housing-play-kicker">RECENT CREATIONS</span>
                    <h3>{isEn ? 'Recent Creations' : '最近创作'}</h3>
                </div>
                <div className="housing-history-row">
                    <span className="housing-choice-avatar">
                        <Megaphone size={15} />
                    </span>
                    <span>
                        <strong>{latestAgencyAd?.title || text.noAds}</strong>
                        <small>
                            {latestAgencyAd
                                ? `${formatTime(latestAgencyAd.created_at || agencyForm.last_ad_at)} · ${latestAgencyAd.is_published ? text.published : text.manual}`
                                : text.untriggered}
                        </small>
                    </span>
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                            setManagementTab('history');
                            setManagementOpen(true);
                        }}
                    >
                        {isEn ? 'View' : '查看'}
                    </button>
                </div>
                <div className="housing-history-row">
                    <span className="housing-choice-avatar is-pink">
                        <Armchair size={15} />
                    </span>
                    <span>
                        <strong>
                            {roomAssemblySnapshot?.home?.name || selectedRoomAssemblyHome?.name || text.roomAssembly}
                        </strong>
                        <small>
                            {roomAssemblySnapshot
                                ? `${text.spent} ${formatMoney(roomAssemblySnapshot.spent)} · ${text.purchased} ${roomAssemblySnapshot.purchases?.length || 0}`
                                : text.untriggered}
                        </small>
                    </span>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowRoomAssemblyModal(true)}>
                        {isEn ? 'Open' : '打开'}
                    </button>
                </div>
            </section>
        </div>
    );
}
