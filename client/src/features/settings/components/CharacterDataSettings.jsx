import { Database, Download, ChevronRight, Upload, RefreshCw, TriangleAlert } from 'lucide-react';

export function CharacterDataSettings({
    lang,
    handleExportCharacterData,
    activeCharacterDraft,
    selectedOriginalForDraft,
    handleImportCharacterData,
    handleResetPhysicalState,
    handleWipeData,
    handleDeleteContact,
}) {
    return (
        <div className="settings-control-form-stack">
            <section className="settings-control-card">
                <div className="settings-control-card-title">
                    <div>
                        <span>
                            <Database size={18} />
                        </span>
                        <div>
                            <h2>{lang === 'en' ? 'Character archive' : '角色存档'}</h2>
                            <p>
                                {lang === 'en'
                                    ? 'Export or migrate this character settings, messages, memories, and diaries.'
                                    : '单独导出或迁移该角色的资料、消息、记忆与日记。'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="settings-control-data-grid">
                    <button
                        type="button"
                        onClick={() => handleExportCharacterData(activeCharacterDraft.id)}
                        disabled={!selectedOriginalForDraft}
                    >
                        <span>
                            <Download size={18} />
                        </span>
                        <div>
                            <strong>
                                {lang === 'en' ? 'Export character' : `导出 ${activeCharacterDraft.name || '角色'}`}
                            </strong>
                            <small>chatpulse.character.v2 JSON</small>
                        </div>
                        <ChevronRight size={15} />
                    </button>
                    <label className={!selectedOriginalForDraft ? 'is-disabled' : ''}>
                        <span>
                            <Upload size={18} />
                        </span>
                        <div>
                            <strong>{lang === 'en' ? 'Import and replace' : '导入并替换'}</strong>
                            <small>
                                {lang === 'en' ? 'Replace current character data.' : '用存档替换当前角色数据。'}
                            </small>
                        </div>
                        <ChevronRight size={15} />
                        <input
                            type="file"
                            accept=".json,.zip,application/json,application/zip"
                            hidden
                            disabled={!selectedOriginalForDraft}
                            onChange={(event) => handleImportCharacterData(activeCharacterDraft.id, event, 'replace')}
                        />
                    </label>
                    <label className={!selectedOriginalForDraft ? 'is-disabled' : ''}>
                        <span>
                            <Upload size={18} />
                        </span>
                        <div>
                            <strong>{lang === 'en' ? 'Import and merge' : '导入并合并'}</strong>
                            <small>
                                {lang === 'en'
                                    ? 'Merge messages and memories where supported.'
                                    : '在支持的范围内合并消息与记忆。'}
                            </small>
                        </div>
                        <ChevronRight size={15} />
                        <input
                            type="file"
                            accept=".json,.zip,application/json,application/zip"
                            hidden
                            disabled={!selectedOriginalForDraft}
                            onChange={(event) => handleImportCharacterData(activeCharacterDraft.id, event, 'merge')}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => handleResetPhysicalState(activeCharacterDraft.id)}
                        disabled={!selectedOriginalForDraft}
                    >
                        <span>
                            <RefreshCw size={18} />
                        </span>
                        <div>
                            <strong>{lang === 'en' ? 'Reset physical state' : '重置身体状态'}</strong>
                            <small>
                                {lang === 'en' ? 'Keep memories, relationships, and wallet.' : '保留记忆、关系和钱包。'}
                            </small>
                        </div>
                        <ChevronRight size={15} />
                    </button>
                </div>
            </section>
            <section className="settings-control-danger-card">
                <div>
                    <span>
                        <TriangleAlert size={19} />
                    </span>
                    <div>
                        <h2>{lang === 'en' ? 'Dangerous character actions' : '角色危险操作'}</h2>
                        <p>
                            {lang === 'en'
                                ? 'These operations affect messages, memories, relationships, and vector indexes.'
                                : '这些操作会影响消息、记忆、关系和向量索引。'}
                        </p>
                    </div>
                </div>
                <div>
                    <button
                        type="button"
                        onClick={() => handleWipeData(activeCharacterDraft.id)}
                        disabled={!selectedOriginalForDraft}
                    >
                        <span>
                            <strong>{lang === 'en' ? 'Deep-wipe character data' : '深度清空角色数据'}</strong>
                            <small>
                                {lang === 'en'
                                    ? 'Keep the character shell, clear history.'
                                    : '保留角色本体，清空历史并恢复默认状态。'}
                            </small>
                        </span>
                        <em>{lang === 'en' ? 'Wipe data' : '清空数据'}</em>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDeleteContact(activeCharacterDraft.id)}
                        disabled={!selectedOriginalForDraft}
                    >
                        <span>
                            <strong>{lang === 'en' ? 'Delete character permanently' : '永久删除角色'}</strong>
                            <small>
                                {lang === 'en'
                                    ? 'Delete settings, messages, groups, and indexes.'
                                    : '同时删除设置、消息、群关系和索引。'}
                            </small>
                        </span>
                        <em>{lang === 'en' ? 'Delete' : '删除'}</em>
                    </button>
                </div>
            </section>
        </div>
    );
}
