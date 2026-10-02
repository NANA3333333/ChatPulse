import { useState } from 'react';
import { buildViewingDialogue, getChainNote, getChainTone, formatTime } from '../housingFormatting.js';
import { text } from '../housingLabels.js';
import { MessageSquareText, ChevronDown, ChevronRight } from 'lucide-react';
import { Pill, ChainProgress } from './HousingPrimitives.jsx';

export function RentalChainCard({ chain, events }) {
    const [detailExpanded, setDetailExpanded] = useState(false);
    const viewingDialogue = buildViewingDialogue(events);
    const consideration = getChainNote(events, 'consideration');
    const decision = getChainNote(events, 'decision');
    const tone = getChainTone(chain.status);
    const dialogueLines = Array.isArray(viewingDialogue?.lines) ? viewingDialogue.lines : [];
    const hasDetail = Boolean(dialogueLines.length || viewingDialogue?.summary || consideration || decision);
    const detailPreview =
        [viewingDialogue?.summary, consideration, decision, dialogueLines[0]?.content].find((item) =>
            String(item || '').trim(),
        ) || text.generatedViewingRecord;
    const detailCountLabel = dialogueLines.length ? `${dialogueLines.length} ${text.dialogueCount}` : text.record;
    const renderDetail = () => (
        <>
            {dialogueLines.length ? (
                <div className="housing-dialogue-panel">
                    <div className="housing-dialogue-title">
                        <MessageSquareText size={15} />
                        {text.viewDialogue}
                    </div>
                    <div className="housing-dialogue-scroll">
                        {dialogueLines.map((line, index) => (
                            <div
                                key={`${chain.id}-view-${index}`}
                                className={`housing-dialogue-line ${line.speaker === text.agent ? 'is-agent' : 'is-character'}`}
                            >
                                <span>{line.speaker}</span>
                                <p>{line.content}</p>
                            </div>
                        ))}
                    </div>
                    {viewingDialogue.summary ? (
                        <div className="housing-chain-note">
                            {text.viewSummary}: {viewingDialogue.summary}
                        </div>
                    ) : null}
                </div>
            ) : null}
            {!dialogueLines.length && viewingDialogue?.summary ? (
                <div className="housing-chain-note">
                    {text.viewSummary}: {viewingDialogue.summary}
                </div>
            ) : null}
            {consideration || decision ? (
                <div className="housing-chain-notes">
                    {consideration ? (
                        <div>
                            <strong>{text.consideration}</strong>
                            <span>{consideration}</span>
                        </div>
                    ) : null}
                    {decision ? (
                        <div>
                            <strong>{text.decision}</strong>
                            <span>{decision}</span>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </>
    );
    return (
        <div className="housing-chain-card">
            <div className="housing-chain-top">
                <div className="housing-chain-title-wrap">
                    <div className="housing-chain-kicker">{formatTime(chain.updated_at)}</div>
                    <div className="housing-chain-title">
                        {chain.character_name || chain.character_id}
                        <span>→</span>
                        {chain.home_emoji || ''}
                        {chain.home_name || chain.home_id}
                    </div>
                </div>
                <Pill bg={tone.bg} color={tone.color} icon={tone.icon}>
                    {chain.status}
                </Pill>
            </div>
            <ChainProgress stage={chain.stage} status={chain.status} />
            {chain.error_message ? <div className="housing-chain-error">{chain.error_message}</div> : null}
            {hasDetail ? (
                <div className={`housing-chain-detail ${detailExpanded ? 'is-open' : 'is-collapsed'}`}>
                    <button
                        type="button"
                        className="housing-chain-detail-toggle"
                        aria-expanded={detailExpanded}
                        onClick={() => setDetailExpanded((value) => !value)}
                    >
                        <span className="housing-chain-detail-toggle-main">
                            <MessageSquareText size={15} />
                            <span>{text.viewingRecord}</span>
                            <em>{detailCountLabel}</em>
                        </span>
                        <span className="housing-chain-detail-toggle-action">
                            {detailExpanded ? text.collapse : text.expand}
                            {detailExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </span>
                    </button>
                    {detailExpanded ? (
                        renderDetail()
                    ) : (
                        <div className="housing-chain-detail-preview">{detailPreview}</div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
