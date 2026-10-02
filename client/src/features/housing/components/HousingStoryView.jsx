import { text } from '../housingLabels.js';
import {
    UserRound,
    Check,
    Circle,
    Building2,
    RotateCw,
    Play,
    ArrowRight,
    MessagesSquare,
    Sparkles,
    Megaphone,
    Armchair,
} from 'lucide-react';
import { formatMoney, getChainStageLabel, formatTime } from '../housingFormatting.js';
import React from 'react';

export function HousingStoryView({
    isEn,
    homelessCount,
    recommendableCharacters,
    recommendCharacterId,
    setRecommendCharacterId,
    housingChainBusy,
    availableHousingTiers,
    recommendHousingId,
    setRecommendHousingId,
    selectedRecommendationCharacter,
    pairLabel,
    selectedRecommendationHome,
    recommendHomeToCharacter,
    housingChainNotice,
    activeChain,
    storySteps,
    storyStepIndex,
    visualStageIndex,
    setStoryStepIndex,
    activeStoryStep,
    activeViewingDialogue,
    activeChainLabel,
    signalLabel,
    rentStress,
    comfortSignal,
    privacySignal,
    activeDecision,
    activeConsideration,
    setActiveHousingView,
}) {
    return (
        <div className="housing-play-screen" data-screen="story">
            <section className="housing-story-launcher">
                <div className="housing-story-intro">
                    <span className="housing-play-kicker">START A HOUSING STORY</span>
                    <h2>{isEn ? 'Let a role find a real home' : '让角色真正走完一次租房故事'}</h2>
                    <p>
                        {isEn
                            ? 'Pick one homeless role and one enabled listing. ChatPulse will run the recommendation, viewing, consideration, decision, and signing chain.'
                            : '选择一个无房角色和一个启用房源，系统会跑完整的推荐、邀约、看房、考虑、决定和签约链路。'}
                    </p>
                </div>

                <div className="housing-market-layout">
                    <aside className="housing-casting-column housing-market-sidebar">
                        <div className="housing-casting-title">
                            <span>{isEn ? 'Choose Role' : '选择角色'}</span>
                            <small>
                                {homelessCount} {text.homeless}
                            </small>
                        </div>
                        {recommendableCharacters.map((item, index) => (
                            <button
                                type="button"
                                key={item.id}
                                className={`housing-choice ${String(recommendCharacterId) === String(item.id) ? 'is-selected' : ''}`}
                                onClick={() => setRecommendCharacterId(String(item.id))}
                                disabled={housingChainBusy}
                            >
                                <span className={`housing-choice-avatar ${index % 2 ? 'is-pink' : ''}`}>
                                    <UserRound size={16} />
                                </span>
                                <span>
                                    <strong>{item.name}</strong>
                                    <small>
                                        {text.wallet} {formatMoney(item.wallet)} · {item.status || text.idle}
                                    </small>
                                </span>
                                {String(recommendCharacterId) === String(item.id) ? (
                                    <Check size={16} />
                                ) : (
                                    <Circle size={16} />
                                )}
                            </button>
                        ))}
                        {recommendableCharacters.length === 0 ? (
                            <div className="housing-empty-card">{text.noHomelessCharacters}</div>
                        ) : null}
                        <div className="housing-launch-action">
                            <div>
                                <span>{isEn ? 'This story' : '本次故事'}</span>
                                <strong>{pairLabel}</strong>
                            </div>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={housingChainBusy || !selectedRecommendationCharacter || !selectedRecommendationHome}
                                onClick={() => recommendHomeToCharacter().catch((error) => alert(error.message))}
                            >
                                {housingChainBusy ? <RotateCw size={16} className="is-spinning" /> : <Play size={16} />}
                                {housingChainBusy ? text.chainRunning : isEn ? 'Start Rental Story' : '开始租房故事'}
                            </button>
                        </div>
                        {housingChainNotice ? (
                            <div
                                className={`housing-chain-notice ${housingChainNotice.startsWith(text.chainFailed) ? 'is-error' : ''}`}
                            >
                                {housingChainNotice}
                            </div>
                        ) : null}
                    </aside>
                    <div className="housing-casting-column housing-market-results">
                        <div className="housing-casting-title">
                            <span>{isEn ? 'Choose Listing' : '选择房源'}</span>
                            <small>
                                {availableHousingTiers.length} {isEn ? text.homeUnit : '个可用'}
                            </small>
                        </div>
                        {availableHousingTiers.map((item, index) => (
                            <button
                                type="button"
                                key={item.id}
                                className={`housing-choice ${String(recommendHousingId) === String(item.id) ? 'is-selected' : ''}`}
                                onClick={() => setRecommendHousingId(String(item.id))}
                                disabled={housingChainBusy || !selectedRecommendationCharacter}
                            >
                                <span className={`housing-choice-avatar ${index % 2 ? 'is-pink' : ''}`}>
                                    <Building2 size={16} />
                                </span>
                                <span>
                                    <strong>
                                        {item.emoji || ''} {item.name || item.id}
                                    </strong>
                                    <small>
                                        {formatMoney(item.weekly_rent)}/{text.perWeek} · {text.deposit}{' '}
                                        {formatMoney(item.deposit)}
                                    </small>
                                </span>
                                {String(recommendHousingId) === String(item.id) ? (
                                    <Check size={16} />
                                ) : (
                                    <Circle size={16} />
                                )}
                            </button>
                        ))}
                        {availableHousingTiers.length === 0 ? (
                            <div className="housing-empty-card">{text.noAvailableHomes}</div>
                        ) : null}
                    </div>
                </div>
            </section>

            <section
                className="housing-story-stage"
                data-run-state={housingChainBusy ? 'running' : activeChain ? 'done' : 'ready'}
            >
                <div className="housing-stage-heading">
                    <div>
                        <span className="housing-play-kicker">LIVE STORY</span>
                        <h3>{isEn ? 'Rental Chain' : '租房链路'}</h3>
                    </div>
                    <div className="housing-stage-state">
                        <span className="housing-live-dot" />
                        <strong>
                            {housingChainBusy
                                ? text.chainRunning
                                : activeChain
                                  ? getChainStageLabel(
                                        activeChain.status === 'completed' ? 'completed' : activeChain.stage,
                                    )
                                  : isEn
                                    ? 'Waiting'
                                    : '等待开始'}
                        </strong>
                        <small>
                            {activeChain
                                ? formatTime(activeChain.updated_at)
                                : isEn
                                  ? 'Estimated 1-2 minutes'
                                  : '预计 1-2 分钟'}
                        </small>
                    </div>
                </div>
                <div
                    className="housing-story-steps"
                    role="list"
                    aria-label={isEn ? 'Rental chain stages' : '租房链路阶段'}
                >
                    {storySteps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                            <React.Fragment key={step.label}>
                                <button
                                    type="button"
                                    className={`housing-story-step ${index === storyStepIndex ? 'is-active' : ''} ${index < visualStageIndex ? 'is-done' : ''}`}
                                    onClick={() => setStoryStepIndex(index)}
                                >
                                    <span>
                                        <Icon size={16} />
                                    </span>
                                    <strong>{step.label}</strong>
                                    <small>{step.sub}</small>
                                </button>
                                {index < storySteps.length - 1 ? <ArrowRight size={14} aria-hidden="true" /> : null}
                            </React.Fragment>
                        );
                    })}
                </div>
                <div className="housing-stage-content">
                    <article className="housing-stage-scene">
                        <div className="housing-scene-head">
                            <span className="housing-scene-icon">
                                {React.createElement(activeStoryStep.icon, { size: 18 })}
                            </span>
                            <div>
                                <small>
                                    {isEn ? `Stage ${storyStepIndex + 1} / 7` : `阶段 ${storyStepIndex + 1} / 7`}
                                </small>
                                <h3>{activeStoryStep.title}</h3>
                            </div>
                        </div>
                        <div className="housing-scene-dialogue">
                            {storyStepIndex === 2 && activeViewingDialogue?.lines?.length ? (
                                activeViewingDialogue.lines.slice(0, 4).map((line, index) => (
                                    <p key={`${line.speaker}-${index}`}>
                                        <strong>{line.speaker}：</strong>
                                        {line.content}
                                    </p>
                                ))
                            ) : (
                                <p>{activeStoryStep.body}</p>
                            )}
                        </div>
                        {activeChain?.error_message ? (
                            <div className="housing-chain-error">{activeChain.error_message}</div>
                        ) : null}
                        <div className="housing-scene-actions">
                            <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={
                                    housingChainBusy || !selectedRecommendationCharacter || !selectedRecommendationHome
                                }
                                onClick={() => recommendHomeToCharacter().catch((error) => alert(error.message))}
                            >
                                <RotateCw size={14} />
                                {isEn ? 'Run Again' : '重试完整故事'}
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setStoryStepIndex(2)}>
                                <MessagesSquare size={14} />
                                {text.viewDialogue}
                            </button>
                        </div>
                    </article>
                    <aside className="housing-story-outcome">
                        <span className="housing-play-kicker">STORY SIGNALS</span>
                        <h3>{activeChainLabel}</h3>
                        <div className="housing-signal">
                            <span>{isEn ? 'Rent Pressure' : '租金压力'}</span>
                            <strong>{signalLabel(rentStress)}</strong>
                            <div>
                                <i style={{ width: `${rentStress}%` }} />
                            </div>
                        </div>
                        <div className="housing-signal">
                            <span>{text.comfort}</span>
                            <strong>{signalLabel(comfortSignal)}</strong>
                            <div>
                                <i style={{ width: `${comfortSignal}%` }} />
                            </div>
                        </div>
                        <div className="housing-signal">
                            <span>{text.privacy}</span>
                            <strong>{signalLabel(privacySignal)}</strong>
                            <div>
                                <i style={{ width: `${privacySignal}%` }} />
                            </div>
                        </div>
                        <div className="housing-outcome-note">
                            <Sparkles size={15} />
                            <p>
                                {activeChain?.status === 'completed'
                                    ? isEn
                                        ? 'The role has moved in and housing was written.'
                                        : '角色已经入住，住房绑定已写入。'
                                    : activeDecision ||
                                      activeConsideration ||
                                      (isEn
                                          ? 'The role tendency changes as each stage completes.'
                                          : '故事开始后，角色倾向会随每个阶段变化。')}
                            </p>
                        </div>
                    </aside>
                </div>
            </section>

            <section className="housing-agency-teaser">
                <div>
                    <span className="housing-play-kicker">SECOND PLAYGROUND</span>
                    <h3>{isEn ? 'Want the agency AI to work?' : '想让中介 AI 做点什么？'}</h3>
                    <p>
                        {isEn
                            ? 'Jump into ad writing or room assembly without making the home page busy.'
                            : '不把默认首页堆满，也能直接进入广告创作或房间布置。'}
                    </p>
                </div>
                <button type="button" onClick={() => setActiveHousingView('agency')}>
                    <span>
                        <Megaphone size={16} />
                    </span>
                    <strong>{isEn ? 'Create a housing ad' : '创作一则住房广告'}</strong>
                    <small>{isEn ? 'Generate copy and publish it' : '生成文案并发布到商业街'}</small>
                    <ArrowRight size={15} />
                </button>
                <button type="button" onClick={() => setActiveHousingView('agency')}>
                    <span className="is-pink">
                        <Armchair size={16} />
                    </span>
                    <strong>{isEn ? 'Stage a showroom' : '为房源布置样板间'}</strong>
                    <small>{isEn ? 'AI buys furniture and saves it' : 'AI 选购家具并保存到像素小屋'}</small>
                    <ArrowRight size={15} />
                </button>
            </section>
        </div>
    );
}
