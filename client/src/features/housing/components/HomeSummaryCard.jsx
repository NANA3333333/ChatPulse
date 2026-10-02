import { text } from '../housingLabels.js';
import { Pill, HomeMetricBars } from './HousingPrimitives.jsx';
import { BadgeDollarSign } from 'lucide-react';
import { formatMoney } from '../housingFormatting.js';

export function HomeSummaryCard({ home, title = text.selectedHome, compact = false, actions = null }) {
    if (!home) {
        return (
            <div className="housing-summary-card is-empty">
                <div className="housing-muted">{text.unboundHousing}</div>
            </div>
        );
    }
    const moveInCost = Number(home.weekly_rent || 0) + Number(home.deposit || 0);
    return (
        <div className={`housing-summary-card ${compact ? 'is-compact' : ''}`}>
            <div className="housing-summary-head">
                <div>
                    <div className="housing-card-kicker">{title}</div>
                    <div className="housing-home-title">
                        {home.emoji || ''} {home.name || home.id}
                    </div>
                </div>
                <Pill bg="#fff7ed" color="#c2410c" icon={BadgeDollarSign}>
                    {formatMoney(home.weekly_rent)}/{text.perWeek}
                </Pill>
            </div>
            <div className="housing-home-desc">{home.description || '-'}</div>
            <div className="housing-home-money">
                <span>
                    <strong>{formatMoney(home.deposit)}</strong>
                    {text.deposit}
                </span>
                <span>
                    <strong>{formatMoney(moveInCost)}</strong>
                    {text.moveInCost}
                </span>
                <span>
                    <strong>{formatMoney(home.sale_price)}</strong>
                    {text.buyout}
                </span>
            </div>
            <HomeMetricBars home={home} />
            {actions ? <div className="housing-card-actions">{actions}</div> : null}
        </div>
    );
}
