import { useLanguage } from "../../../shared/i18n/LanguageContext.jsx";
import "./MessageOperationNotice.css";

export default function MessageOperationNotice({ notice, onDismiss, onRetry }) {
    const { lang } = useLanguage();
    if (!notice) return null;
    const replyDispatchFailed = notice.warnings?.includes('MESSAGE_REPLY_DISPATCH_FAILED');
    const text = notice.error || (replyDispatchFailed
        ? (lang === 'en' ? 'Message saved. The reply could not be started; retry the reply below.' : '消息已保存，但回复未能启动。请重试回复。')
        : (lang === 'en' ? 'Message saved. Some follow-up updates failed; refresh to check the conversation.' : '消息已保存，部分后续更新失败，可刷新查看对话。'));
    return <div role="alert" className="private-message-notice">
        <span>{text}</span>
        {notice.runId && <span>{lang === 'en' ? 'Operation ID: ' : '操作编号：'}<code>{notice.runId}</code></span>}
        <div>
            {replyDispatchFailed && <button type="button" onClick={() => onRetry()}>{lang === 'en' ? 'Retry reply' : '重试回复'}</button>}
            <button type="button" onClick={onDismiss}>{lang === 'en' ? 'Dismiss' : '关闭提示'}</button>
        </div>
    </div>;
}
