import { shell } from '../housingPresentation.js';
import { text } from '../housingLabels.js';
import { chainStageOrder, getChainStageLabel } from '../housingFormatting.js';

export function Pill({ children, bg = '#fff8fb', color = '#806273', icon: Icon = null }) {
    return (
        <span className="housing-pill" style={{ background: bg, color }}>
            {Icon ? <Icon size={13} strokeWidth={2.4} /> : null}
            <span>{children}</span>
        </span>
    );
}

export function Section({ title, extra, icon: Icon = null, children }) {
    return (
        <section style={shell.section} className="housing-section">
            <div className="housing-section-head">
                <div className="housing-section-title">
                    {Icon ? <Icon size={17} strokeWidth={2.4} /> : null}
                    <span>{title}</span>
                </div>
                {extra ? <div className="housing-section-extra">{extra}</div> : null}
            </div>
            {children}
        </section>
    );
}

export function Field({ label, children, span = false }) {
    return (
        <label className="housing-field" style={{ gridColumn: span ? '1 / -1' : 'auto' }}>
            <span>{label}</span>
            {children}
        </label>
    );
}

export function ActionButton({
    children,
    icon: Icon = null,
    tone = 'neutral',
    disabled = false,
    className = '',
    style = {},
    ...props
}) {
    return (
        <button
            {...props}
            disabled={disabled}
            className={`housing-action-btn housing-action-btn--${tone} ${className}`.trim()}
            style={{ opacity: disabled ? 0.62 : 1, ...style }}
        >
            {Icon ? <Icon size={15} strokeWidth={2.5} /> : null}
            <span>{children}</span>
        </button>
    );
}

export function StatCard({ label, value, tone = 'neutral', icon: Icon = null }) {
    const color = tone === 'good' ? '#2f9c76' : tone === 'warn' ? '#be4664' : tone === 'info' ? '#ff4f82' : '#342b34';
    const bg = tone === 'good' ? '#effaf4' : tone === 'warn' ? '#fff1f6' : tone === 'info' ? '#fff0f6' : '#fff';
    return (
        <div className="housing-stat-card" style={{ ...shell.card, background: bg }}>
            <div className="housing-stat-meta">
                {Icon ? <Icon size={15} strokeWidth={2.4} /> : null}
                <span>{label}</span>
            </div>
            <div style={{ color }} className="housing-stat-value">
                {value}
            </div>
        </div>
    );
}

export function ScoreBar({ label, value, color = '#ff4f82' }) {
    const safe = Math.max(0, Math.min(60, Number(value || 0)));
    const width = `${Math.min(100, Math.round((safe / 60) * 100))}%`;
    return (
        <div className="housing-score-row">
            <div className="housing-score-label">
                <span>{label}</span>
                <strong>{Number(value || 0)}</strong>
            </div>
            <div className="housing-score-track">
                <span style={{ width, background: color }} />
            </div>
        </div>
    );
}

export function HomeMetricBars({ home = {} }) {
    return (
        <div className="housing-score-grid">
            <ScoreBar label={text.comfort} value={home.comfort} color="#0f766e" />
            <ScoreBar label={text.prestige} value={home.prestige} color="#7c3aed" />
            <ScoreBar label={text.privacy} value={home.privacy} color="#c2410c" />
        </div>
    );
}

export function ChainProgress({ stage = '', status = '' }) {
    const normalized = status === 'completed' ? 'completed' : String(stage || 'recommended');
    const currentIndex = Math.max(0, chainStageOrder.indexOf(normalized));
    return (
        <div className="housing-chain-progress">
            {chainStageOrder.map((item, index) => (
                <div
                    key={item}
                    className={`housing-chain-step ${index <= currentIndex ? 'is-active' : ''} ${item === normalized ? 'is-current' : ''}`}
                    title={getChainStageLabel(item)}
                >
                    <span />
                    <em>{getChainStageLabel(item)}</em>
                </div>
            ))}
        </div>
    );
}
