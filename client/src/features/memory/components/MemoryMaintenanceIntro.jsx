import { WandSparkles, Clock3, Upload, ListFilter, Play, ChevronDown } from 'lucide-react';
import { formatNumber, formatProgressPhase } from '../memoryLabels.js';
import React from 'react';

export function MemoryMaintenanceIntro({
    tx,
    autoProgress,
    promptTaskMode,
    setPromptTaskMode,
    maintenanceMode,
    setMaintenanceMode,
    activeCharacterName,
    pendingCount,
    temporalCount,
    reviewCount,
    onShowExternalImport,
}) {
    const running = !!autoProgress?.running;
    return (
        <section className="memory-maintenance-intro">
            <aside className="memory-maintenance-sidebar">
                <div>
                    <span className="memory-eyebrow">IMPORT</span>
                    <h2>{tx('Memory Import', '记忆导入')}</h2>
                </div>
                <button
                    type="button"
                    className={promptTaskMode === 'complete' ? 'is-active' : ''}
                    onClick={() => setPromptTaskMode('complete')}
                >
                    <span>
                        <WandSparkles size={16} />
                    </span>
                    <div>
                        <strong>{tx('Import Summary', '导入总结')}</strong>
                        <small>
                            {formatNumber(pendingCount)} {tx('pending', '待处理')}
                        </small>
                    </div>
                    <em>{formatNumber(pendingCount)}</em>
                </button>
                <button
                    type="button"
                    className={promptTaskMode === 'supplement' ? 'is-active' : ''}
                    onClick={() => setPromptTaskMode('supplement')}
                >
                    <span>
                        <Clock3 size={16} />
                    </span>
                    <div>
                        <strong>{tx('Supplement Tags', '补充标签')}</strong>
                        <small>
                            {formatNumber(temporalCount)} {tx('need tags', '缺标签')}
                        </small>
                    </div>
                    <em>{formatNumber(temporalCount)}</em>
                </button>
                <button type="button" onClick={onShowExternalImport}>
                    <span>
                        <Upload size={16} />
                    </span>
                    <div>
                        <strong>{tx('External Chat Import', '外部聊天导入')}</strong>
                        <small>{tx('Preview candidates before writing', '预览候选后再写入')}</small>
                    </div>
                </button>
                <button
                    type="button"
                    className={maintenanceMode === 'manual' ? 'is-active' : ''}
                    onClick={() => setMaintenanceMode('manual')}
                >
                    <span>
                        <ListFilter size={16} />
                    </span>
                    <div>
                        <strong>{tx('Single Batch Review', '单批预览')}</strong>
                        <small>{tx('Preview prompt and run once', '预览 prompt 并运行一次')}</small>
                    </div>
                </button>
                <button
                    type="button"
                    className={maintenanceMode === 'auto' ? 'is-active' : ''}
                    onClick={() => setMaintenanceMode('auto')}
                >
                    <span>
                        <Play size={16} />
                    </span>
                    <div>
                        <strong>{tx('Background Auto Run', '后台连续运行')}</strong>
                        <small>{tx('Recoverable live progress', '可恢复实时进度')}</small>
                    </div>
                </button>
            </aside>
            <main className="memory-maintenance-main">
                <div className="memory-maintenance-title">
                    <div>
                        <span className="memory-eyebrow">AI MEMORY IMPORT</span>
                        <h1>
                            {promptTaskMode === 'supplement'
                                ? tx(
                                      `Supplement tags for ${activeCharacterName || 'selected role'}`,
                                      `为 ${activeCharacterName || '当前角色'} 补来源和时间`,
                                  )
                                : tx(
                                      `Import and summarize ${activeCharacterName || 'selected role'} memories`,
                                      `导入并总结 ${activeCharacterName || '当前角色'} 的记忆`,
                                  )}
                        </h1>
                        <p>
                            {promptTaskMode === 'supplement'
                                ? tx(
                                      'Supplement mode only adds source-scene and time tags; it does not rewrite memory content.',
                                      '补充模式只补来源场景和时间标签，不改写记忆内容。',
                                  )
                                : tx(
                                      'The small model summarizes old or external records into new memories, then writes them after preview or confirmation.',
                                      '小模型把旧库或外部记录整理成新记忆，预览或确认后再写入。',
                                  )}
                        </p>
                    </div>
                    <span className={`memory-run-state ${running ? 'is-running' : ''}`}>
                        {running ? formatProgressPhase(autoProgress.phase) : tx('Ready', '准备就绪')}
                    </span>
                </div>
                <div className="memory-pipeline">
                    {[
                        tx('Read old/file records', '读取旧库/文件'),
                        tx('Small-model summary', '小模型总结'),
                        tx('Preview and check', '预览校验'),
                        tx('Write new memories', '写入新记忆'),
                    ].map((label, index) => (
                        <React.Fragment key={label}>
                            <div className={index === 0 && running ? 'is-current' : ''}>
                                <span>{index + 1}</span>
                                <strong>{label}</strong>
                            </div>
                            {index < 3 && <ChevronDown size={15} />}
                        </React.Fragment>
                    ))}
                </div>
                {reviewCount > 0 && (
                    <div className="memory-review-strip">
                        <strong>
                            {formatNumber(reviewCount)} {tx('items need attention', '条记忆需要关注')}
                        </strong>
                        <span>
                            {tx(
                                'Uncertain model results remain visible in the run result area and are not deleted automatically.',
                                '不确定结果会保留在运行结果区，不会自动删除。',
                            )}
                        </span>
                    </div>
                )}
            </main>
        </section>
    );
}
