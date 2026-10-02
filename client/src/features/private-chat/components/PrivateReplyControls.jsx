import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { useLanguage } from "../../../shared/i18n/LanguageContext.jsx";
import "./PrivateReplyControls.css";

export default function PrivateReplyControls({ info, disabled, pending, error, runId, onChange }) {
    const { lang } = useLanguage();
    const en = lang === 'en';
    const atLatest = info.active === info.count - 1;
    const previous = en ? 'Previous reply version' : '上一个回复版本';
    const next = atLatest
        ? (en ? 'Reroll using saved context (reply text only)' : '重 roll：复用本轮上下文，仅重新生成回复文字')
        : (en ? 'Next reply version' : '下一个回复版本');
    return (
        <div className="private-reply-controls-wrap">
            <div className="private-reply-controls" role="group" aria-label={en ? 'Reply versions' : '回复版本'} aria-busy={!!pending}>
                <button type="button" title={previous} aria-label={previous}
                    disabled={disabled || !!pending || info.active === 0} onClick={() => onChange(info.active - 1)}>
                    <ChevronLeft size={14} />
                </button>
                <span className="private-reply-count" aria-live="polite">{info.active + 1} / {info.count}</span>
                <button type="button" title={next} aria-label={next} disabled={disabled || !!pending}
                    onClick={() => onChange(atLatest ? null : info.active + 1)}>
                    {pending ? <LoaderCircle size={14} className="private-reply-spinner" /> : <ChevronRight size={14} />}
                </button>
                {pending && <span role="status">{pending === 'reroll' ? (en ? 'Rerolling…' : '重 roll 中…') : (en ? 'Switching…' : '切换中…')}</span>}
            </div>
            {error && <div className="private-reply-error" role="alert">
                {error}
                {runId && <div className="private-reply-run-id">{en ? 'Operation ID: ' : '操作编号：'}<code>{runId}</code></div>}
            </div>}
        </div>
    );
}
