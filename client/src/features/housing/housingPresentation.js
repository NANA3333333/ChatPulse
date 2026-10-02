export const shell = {
    page: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 24,
        background: 'var(--housing-page-bg)',
        minHeight: '100%',
    },
    section: { display: 'grid', gap: 12 },
    card: {
        background: 'var(--housing-card-bg)',
        border: '1px solid var(--housing-line)',
        borderRadius: 8,
        padding: 16,
        boxShadow: 'var(--housing-shadow)',
    },
    input: {
        width: '100%',
        borderRadius: 8,
        border: '1px solid var(--housing-line)',
        padding: '9px 11px',
        fontSize: 13,
        background: 'var(--housing-input-bg)',
        color: 'var(--housing-ink)',
    },
    btn: { border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer', lineHeight: 1.2 },
};
