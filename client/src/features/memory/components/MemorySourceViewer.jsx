import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import { X } from 'lucide-react';
import { formatNumber, formatSourceKind, formatDateTime } from '../memoryLabels.js';

export function SourceViewerModal({ viewer, onClose }) {
    const { lang } = useLanguage();
    const isEn = lang === 'en';
    if (!viewer) return null;
    const data = viewer.data || {};
    const memories = data.memories || [];
    const sources = data.sources || [];
    const stats = data.stats || {};
    return (
        <div className="memory-edit-overlay">
            <div className="memory-source-modal">
                <div className="memory-edit-head">
                    <div>
                        <strong>{isEn ? 'Source Text' : '来源原文'}</strong>
                        <span>
                            {viewer.item?.summary ||
                                viewer.item?.text ||
                                (isEn ? 'Memory source trace' : '记忆来源追溯')}
                        </span>
                    </div>
                    <button type="button" className="memory-edit-close" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>
                {viewer.loading ? (
                    <div className="memory-source-empty">{isEn ? 'Reading source text...' : '正在读取来源原文...'}</div>
                ) : viewer.error ? (
                    <div className="memory-lib-error">{viewer.error}</div>
                ) : (
                    <>
                        <div className="memory-source-summary">
                            <span>
                                {isEn ? 'Carrier Cards' : '承载卡片'}{' '}
                                {formatNumber(stats.memory_count || memories.length)}
                            </span>
                            <span>
                                {isEn ? 'Source Refs' : '来源引用'}{' '}
                                {formatNumber(stats.source_ref_count || sources.length)}
                            </span>
                            <span>
                                {isEn ? 'Found Sources' : '找到原文'}{' '}
                                {formatNumber(
                                    stats.found_source_count || sources.filter((source) => source.found).length,
                                )}
                            </span>
                            {Number(stats.missing_source_count || 0) > 0 && (
                                <b>
                                    {isEn ? 'Missing' : '缺失'} {formatNumber(stats.missing_source_count)}
                                </b>
                            )}
                        </div>
                        {memories.length > 0 && (
                            <div className="memory-source-memory-list">
                                {memories.map((memory) => (
                                    <div key={memory.id}>
                                        <b>#{memory.id}</b>
                                        <span>{memory.summary || (isEn ? 'Empty memory' : '空记忆')}</span>
                                        {memory.source_time_text && <small>{memory.source_time_text}</small>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {sources.length === 0 ? (
                            <div className="memory-source-empty">
                                {isEn
                                    ? 'This memory has no saved original message id, so it can only trace back to the memory card itself.'
                                    : '这条记忆没有保存可反查的原始消息 id；只能追到记忆卡片本身。'}
                            </div>
                        ) : (
                            <div className="memory-source-list">
                                {sources.map((source) => (
                                    <div
                                        className={`memory-source-line ${source.found ? '' : 'missing'}`}
                                        key={source.source_key}
                                    >
                                        <div className="memory-source-line-meta">
                                            <span>
                                                {formatSourceKind(source.kind)} #{source.id || source.raw_ref}
                                            </span>
                                            {source.timestamp > 0 && <span>{formatDateTime(source.timestamp)}</span>}
                                            {source.speaker && <b>{source.speaker}</b>}
                                            {source.location && <span>{source.location}</span>}
                                            {!source.found && <b>{isEn ? 'Source missing' : '原文缺失'}</b>}
                                        </div>
                                        <div className="memory-source-line-text">
                                            {source.found
                                                ? source.content || (isEn ? 'Empty content' : '空内容')
                                                : isEn
                                                  ? `Could not find the original record for ${source.raw_ref || source.source_key}.`
                                                  : `找不到 ${source.raw_ref || source.source_key} 对应的原始记录。`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
